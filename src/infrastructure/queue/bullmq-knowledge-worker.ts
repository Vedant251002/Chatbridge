import { Worker } from "bullmq";
import type { Redis } from "ioredis";
import type { Logger } from "../../domain/ports/logger.js";
import type { KnowledgeIngestJob } from "./bullmq-knowledge-publisher.js";
import { INGEST_QUEUE_OPTIONS, QUEUE_NAMES } from "./queue-config.js";

export type KnowledgeIngestHandler = (job: KnowledgeIngestJob) => Promise<void>;

export function createKnowledgeIngestWorker(
  redis: Redis,
  handler: KnowledgeIngestHandler,
  logger: Logger
): Worker<KnowledgeIngestJob> {
  const worker = new Worker<KnowledgeIngestJob>(
    QUEUE_NAMES.KNOWLEDGE_INGEST,
    async (job) => handler(job.data),
    { connection: redis, concurrency: INGEST_QUEUE_OPTIONS.workerConcurrency }
  );

  worker.on("completed", (job) =>
    logger.info("Ingest job completed", { jobId: job.id, documentId: job.data.documentId })
  );
  worker.on("failed", (job, error) => {
    logger.error("Ingest job failed", {
      jobId: job?.id,
      documentId: job?.data.documentId,
      error: String(error),
    });
  });

  return worker;
}
