-- Enable pgvector for semantic search
CREATE EXTENSION IF NOT EXISTS vector;

-- ─── HITL fields on conversations ────────────────────────────────────────────
ALTER TABLE "conversations"
  ADD COLUMN "ai_paused" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "taken_over_by" TEXT,
  ADD COLUMN "last_activity_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX "conversations_last_activity_at_idx"
  ON "conversations" ("last_activity_at" DESC);

-- ─── Knowledge base enums ────────────────────────────────────────────────────
CREATE TYPE "knowledge_status" AS ENUM ('pending', 'processing', 'ready', 'failed');
CREATE TYPE "knowledge_source_type" AS ENUM ('text', 'markdown', 'url');

-- ─── Documents ───────────────────────────────────────────────────────────────
CREATE TABLE "knowledge_documents" (
    "id"          UUID NOT NULL,
    "title"       TEXT NOT NULL,
    "source_type" "knowledge_source_type" NOT NULL,
    "source_url"  TEXT,
    "source_text" TEXT NOT NULL,
    "status"      "knowledge_status" NOT NULL DEFAULT 'pending',
    "error_msg"   TEXT,
    "chunk_count" INTEGER NOT NULL DEFAULT 0,
    "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"  TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_documents_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "knowledge_documents_status_idx" ON "knowledge_documents" ("status");
CREATE INDEX "knowledge_documents_created_at_idx" ON "knowledge_documents" ("created_at" DESC);

-- ─── Chunks (with pgvector embedding) ────────────────────────────────────────
-- Embedding column added via raw SQL — Prisma doesn't generate vector(N).
CREATE TABLE "knowledge_chunks" (
    "id"          UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "ordinal"     INTEGER NOT NULL,
    "content"     TEXT NOT NULL,
    "token_count" INTEGER NOT NULL,
    "embedding"   vector(1536),
    "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "knowledge_chunks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "knowledge_chunks_document_id_idx" ON "knowledge_chunks" ("document_id");

-- IVFFlat index for cosine similarity. lists=100 is fine up to ~100k chunks;
-- bump for larger corpora and ANALYZE after bulk inserts.
CREATE INDEX "knowledge_chunks_embedding_idx"
  ON "knowledge_chunks" USING ivfflat ("embedding" vector_cosine_ops) WITH (lists = 100);

ALTER TABLE "knowledge_chunks"
  ADD CONSTRAINT "knowledge_chunks_document_id_fkey"
  FOREIGN KEY ("document_id") REFERENCES "knowledge_documents"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
