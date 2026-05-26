import type {
  KnowledgeDocument,
  KnowledgeStatus,
  RetrievedChunk,
} from "../entities/knowledge.js";

export interface CreateKnowledgeDocumentInput {
  userId: string;
  title: string;
  sourceType: KnowledgeDocument["sourceType"];
  sourceUrl: string | null;
  sourceText: string;
}

export interface InsertKnowledgeChunkInput {
  documentId: string;
  ordinal: number;
  content: string;
  tokenCount: number;
  embedding: number[];
}

export interface KnowledgeRepository {
  createDocument(input: CreateKnowledgeDocumentInput): Promise<KnowledgeDocument>;
  listDocuments(userId: string): Promise<KnowledgeDocument[]>;
  getDocument(id: string): Promise<KnowledgeDocument | null>;
  deleteDocument(id: string): Promise<void>;
  updateDocumentStatus(
    id: string,
    status: KnowledgeStatus,
    extras?: { errorMsg?: string | null; chunkCount?: number }
  ): Promise<void>;

  // Chunks: replace-all semantics (delete then bulk insert) for re-indexing.
  replaceChunks(documentId: string, chunks: InsertKnowledgeChunkInput[]): Promise<void>;

  // Per-user search — only returns chunks from the calling user's documents.
  searchSimilar(
    userId: string,
    embedding: number[],
    topK: number,
    threshold: number
  ): Promise<RetrievedChunk[]>;
}
