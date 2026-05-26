export type KnowledgeSourceType = "text" | "markdown" | "url";
export type KnowledgeStatus = "pending" | "processing" | "ready" | "failed";

export interface KnowledgeDocument {
  id: string;
  title: string;
  sourceType: KnowledgeSourceType;
  sourceUrl: string | null;
  sourceText: string;
  status: KnowledgeStatus;
  errorMsg: string | null;
  chunkCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface KnowledgeChunk {
  id: string;
  documentId: string;
  ordinal: number;
  content: string;
  tokenCount: number;
  createdAt: Date;
}

export interface RetrievedChunk {
  id: string;
  documentId: string;
  documentTitle: string;
  ordinal: number;
  content: string;
  similarity: number;
}
