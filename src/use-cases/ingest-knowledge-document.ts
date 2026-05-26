import type { Logger } from "../domain/ports/logger.js";
import type { Embedder } from "../domain/ports/embedder.js";
import type { KnowledgeRepository } from "../domain/ports/knowledge-repository.js";
import type { InsertKnowledgeChunkInput } from "../domain/ports/knowledge-repository.js";
import { chunkText } from "../utils/chunker.js";

const URL_FETCH_TIMEOUT_MS = 20_000;
const URL_MAX_BYTES = 2 * 1024 * 1024;

export interface IngestKnowledgeDocumentDeps {
  knowledgeRepo: KnowledgeRepository;
  embedder: Embedder;
  logger: Logger;
}

export class IngestKnowledgeDocument {
  constructor(private readonly deps: IngestKnowledgeDocumentDeps) {}

  async execute(documentId: string): Promise<void> {
    const { knowledgeRepo, embedder, logger } = this.deps;
    const document = await knowledgeRepo.getDocument(documentId);
    if (!document) {
      logger.warn("Ingest skipped — document not found", { documentId });
      return;
    }

    await knowledgeRepo.updateDocumentStatus(documentId, "processing", { errorMsg: null });

    try {
      const sourceText = await resolveSourceText(document, logger);
      // Prepend the doc title so title-keyword queries (e.g. "what does
      // avesta labs do") have a strong match in every chunk of that doc.
      const titledText = `${document.title}\n\n${sourceText}`;
      const chunks = chunkText(titledText);

      if (chunks.length === 0) {
        await knowledgeRepo.replaceChunks(documentId, []);
        await knowledgeRepo.updateDocumentStatus(documentId, "ready", { chunkCount: 0 });
        logger.warn("Ingest produced zero chunks", { documentId });
        return;
      }

      // Batch embed (provider takes an array). Some providers limit batch
      // size to 256/2048 tokens, so chunk by 50 to stay safe.
      const inserts: InsertKnowledgeChunkInput[] = [];
      const batchSize = 50;
      for (let i = 0; i < chunks.length; i += batchSize) {
        const slice = chunks.slice(i, i + batchSize);
        const vectors = await embedder.embedBatch(slice.map((c) => c.content));
        slice.forEach((c, idx) => {
          inserts.push({
            documentId,
            ordinal: c.ordinal,
            content: c.content,
            tokenCount: c.tokenCount,
            embedding: vectors[idx],
          });
        });
      }

      await knowledgeRepo.replaceChunks(documentId, inserts);
      await knowledgeRepo.updateDocumentStatus(documentId, "ready", {
        chunkCount: inserts.length,
      });
      logger.info("Knowledge document ingested", {
        documentId,
        chunkCount: inserts.length,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error("Knowledge ingest failed", { documentId, error: message });
      await knowledgeRepo.updateDocumentStatus(documentId, "failed", { errorMsg: message });
      throw error;
    }
  }
}

async function resolveSourceText(
  document: { sourceType: "text" | "markdown" | "url"; sourceText: string; sourceUrl: string | null },
  logger: Logger
): Promise<string> {
  if (document.sourceType !== "url") return document.sourceText;
  if (!document.sourceUrl) return document.sourceText;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), URL_FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(document.sourceUrl, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "user-agent": "WhatsAppAI-KnowledgeIngester/1.0" },
    });
    if (!res.ok) {
      throw new Error(`URL fetch failed: HTTP ${res.status}`);
    }
    const buf = await res.arrayBuffer();
    if (buf.byteLength > URL_MAX_BYTES) {
      throw new Error(`URL response exceeds ${URL_MAX_BYTES} bytes`);
    }
    const html = new TextDecoder("utf-8").decode(buf);
    return stripHtml(html);
  } catch (error) {
    logger.warn("URL ingest fell back to stored text", {
      url: document.sourceUrl,
      error: String(error),
    });
    // Fall back to whatever was stored (might be empty)
    return document.sourceText;
  } finally {
    clearTimeout(timeout);
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<\/(?:p|div|li|h[1-6]|br)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
