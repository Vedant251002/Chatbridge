import type { Logger } from "../domain/ports/logger.js";
import type { Embedder } from "../domain/ports/embedder.js";
import type { KnowledgeRepository } from "../domain/ports/knowledge-repository.js";
import type { RetrievedChunk } from "../domain/entities/knowledge.js";

const DEFAULT_TOP_K = 5;
// Feature-hash embedder produces lower absolute cosine values than
// transformer embeddings. ~0.05 is a workable cut-off; the LLM still
// only uses material that's in the prompt, so noise is bounded.
const DEFAULT_SIMILARITY_THRESHOLD = 0.05;

export interface RetrieveKnowledgeDeps {
  knowledgeRepo: KnowledgeRepository;
  embedder: Embedder;
  logger: Logger;
}

export class RetrieveKnowledge {
  constructor(private readonly deps: RetrieveKnowledgeDeps) {}

  async execute(
    userId: string,
    query: string,
    topK: number = DEFAULT_TOP_K,
    threshold: number = DEFAULT_SIMILARITY_THRESHOLD
  ): Promise<RetrievedChunk[]> {
    const { knowledgeRepo, embedder, logger } = this.deps;
    const trimmed = query.trim();
    if (!trimmed) return [];

    try {
      const embedding = await embedder.embed(trimmed);
      const results = await knowledgeRepo.searchSimilar(userId, embedding, topK, threshold);
      logger.debug("RAG retrieved", { count: results.length, topK, threshold });
      return results;
    } catch (error) {
      // Retrieval failure must NOT block the AI reply — log and degrade.
      logger.warn("RAG retrieval failed, continuing without context", {
        error: String(error),
      });
      return [];
    }
  }
}
