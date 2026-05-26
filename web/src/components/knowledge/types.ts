export type KnowledgeStatus = "pending" | "processing" | "ready" | "failed";
export type KnowledgeSourceType = "text" | "markdown" | "url";

export interface KnowledgeDocument {
  id: string;
  title: string;
  sourceType: KnowledgeSourceType;
  sourceUrl: string | null;
  status: KnowledgeStatus;
  errorMsg: string | null;
  chunkCount: number;
  createdAt: string;
  updatedAt: string;
}
