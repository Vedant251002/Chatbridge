import type { PrismaClient } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { DatabaseError } from "../../utils/errors.js";
import type {
  CreateKnowledgeDocumentInput,
  InsertKnowledgeChunkInput,
  KnowledgeRepository,
} from "../../domain/ports/knowledge-repository.js";
import type {
  KnowledgeDocument,
  KnowledgeStatus,
  RetrievedChunk,
} from "../../domain/entities/knowledge.js";

// Format a JS number[] as a pgvector literal: '[0.1,0.2,...]'
function toVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}

export class PrismaKnowledgeRepository implements KnowledgeRepository {
  constructor(private readonly db: PrismaClient) {}

  async createDocument(input: CreateKnowledgeDocumentInput): Promise<KnowledgeDocument> {
    try {
      const created = await this.db.knowledgeDocument.create({
        data: {
          title: input.title,
          sourceType: input.sourceType,
          sourceUrl: input.sourceUrl,
          sourceText: input.sourceText,
          status: "pending",
        },
      });
      return created as KnowledgeDocument;
    } catch (error) {
      throw new DatabaseError("Failed to create knowledge document", error);
    }
  }

  async listDocuments(): Promise<KnowledgeDocument[]> {
    try {
      const rows = await this.db.knowledgeDocument.findMany({
        orderBy: { createdAt: "desc" },
      });
      return rows as KnowledgeDocument[];
    } catch (error) {
      throw new DatabaseError("Failed to list knowledge documents", error);
    }
  }

  async getDocument(id: string): Promise<KnowledgeDocument | null> {
    try {
      return (await this.db.knowledgeDocument.findUnique({
        where: { id },
      })) as KnowledgeDocument | null;
    } catch (error) {
      throw new DatabaseError("Failed to fetch knowledge document", error);
    }
  }

  async deleteDocument(id: string): Promise<void> {
    try {
      // Cascade in schema removes chunks automatically
      await this.db.knowledgeDocument.delete({ where: { id } });
    } catch (error) {
      throw new DatabaseError("Failed to delete knowledge document", error);
    }
  }

  async updateDocumentStatus(
    id: string,
    status: KnowledgeStatus,
    extras?: { errorMsg?: string | null; chunkCount?: number }
  ): Promise<void> {
    try {
      await this.db.knowledgeDocument.update({
        where: { id },
        data: {
          status,
          errorMsg: extras?.errorMsg ?? null,
          ...(extras?.chunkCount !== undefined ? { chunkCount: extras.chunkCount } : {}),
        },
      });
    } catch (error) {
      throw new DatabaseError("Failed to update knowledge document status", error);
    }
  }

  async replaceChunks(
    documentId: string,
    chunks: InsertKnowledgeChunkInput[]
  ): Promise<void> {
    if (chunks.length === 0) {
      try {
        await this.db.knowledgeChunk.deleteMany({ where: { documentId } });
      } catch (error) {
        throw new DatabaseError("Failed to clear knowledge chunks", error);
      }
      return;
    }

    try {
      await this.db.$transaction(async (tx) => {
        await tx.knowledgeChunk.deleteMany({ where: { documentId } });
        // Bulk insert via parameterised raw SQL — pgvector requires the
        // ::vector cast which Prisma's `createMany` cannot express.
        for (const chunk of chunks) {
          await tx.$executeRaw`
            INSERT INTO "knowledge_chunks"
              ("id", "document_id", "ordinal", "content", "token_count", "embedding")
            VALUES (
              gen_random_uuid(),
              ${chunk.documentId}::uuid,
              ${chunk.ordinal},
              ${chunk.content},
              ${chunk.tokenCount},
              ${toVectorLiteral(chunk.embedding)}::vector
            )
          `;
        }
      });
    } catch (error) {
      throw new DatabaseError("Failed to replace knowledge chunks", error);
    }
  }

  async searchSimilar(
    embedding: number[],
    topK: number,
    threshold: number
  ): Promise<RetrievedChunk[]> {
    try {
      // Cosine distance: 1 - (embedding <=> query). Lower distance = closer.
      // We compute similarity = 1 - distance for the consumer.
      const literal = toVectorLiteral(embedding);
      const rows = await this.db.$queryRaw<
        Array<{
          id: string;
          document_id: string;
          document_title: string;
          ordinal: number;
          content: string;
          similarity: number;
        }>
      >(Prisma.sql`
        SELECT
          c."id",
          c."document_id",
          d."title" AS "document_title",
          c."ordinal",
          c."content",
          1 - (c."embedding" <=> ${literal}::vector) AS "similarity"
        FROM "knowledge_chunks" c
        JOIN "knowledge_documents" d ON d."id" = c."document_id"
        WHERE d."status" = 'ready'
          AND c."embedding" IS NOT NULL
          AND 1 - (c."embedding" <=> ${literal}::vector) >= ${threshold}
        ORDER BY c."embedding" <=> ${literal}::vector ASC
        LIMIT ${topK}
      `);

      return rows.map((r) => ({
        id: r.id,
        documentId: r.document_id,
        documentTitle: r.document_title,
        ordinal: r.ordinal,
        content: r.content,
        similarity: Number(r.similarity),
      }));
    } catch (error) {
      throw new DatabaseError("Failed to search knowledge chunks", error);
    }
  }
}
