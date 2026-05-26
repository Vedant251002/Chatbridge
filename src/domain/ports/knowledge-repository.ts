import type {
  KnowledgeDocument,
  KnowledgeStatus,
  RetrievedChunk,
} from "../entities/knowledge.js";

export interface CreateKnowledgeDocumentInput {
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
  listDocuments(): Promise<KnowledgeDocument[]>;
  getDocument(id: string): Promise<KnowledgeDocument | null>;
  deleteDocument(id: string): Promise<void>;
  updateDocumentStatus(
    id: string,
    status: KnowledgeStatus,
    extras?: { errorMsg?: string | null; chunkCount?: number }
  ): Promise<void>;

  // Chunks: replace-all semantics (delete then bulk insert) for re-indexing.
  replaceChunks(documentId: string, chunks: InsertKnowledgeChunkInput[]): Promise<void>;
  searchSimilar(embedding: number[], topK: number, threshold: number): Promise<RetrievedChunk[]>;
}
