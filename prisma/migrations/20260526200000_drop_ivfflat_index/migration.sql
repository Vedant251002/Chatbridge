-- IVFFlat with default probes=1 returns nothing for small datasets and
-- requires ANALYZE after bulk loads. For the assessment scale (typically
-- < a few thousand chunks) a sequential scan is fast enough and always
-- correct. Drop the index — pgvector's <=> operator works without it.
--
-- For larger deployments, swap to HNSW (pgvector >= 0.5):
--   CREATE INDEX knowledge_chunks_embedding_hnsw
--     ON knowledge_chunks USING hnsw (embedding vector_cosine_ops);
DROP INDEX IF EXISTS "knowledge_chunks_embedding_idx";
