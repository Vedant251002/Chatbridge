import { Worker } from "bullmq";
import type { Redis } from "ioredis";
import type { Logger } from "../../domain/ports/logger.js";
import type { InboundMessage } from "../../domain/entities/inbound-message.js";
import { QUEUE_NAMES, QUEUE_OPTIONS } from "./queue-config.js";

export type InboundMessageHandler = (message: InboundMessage) => Promise<void>;

export function createInboundMessageWorker(
  redis: Redis,
  handler: InboundMessageHandler,
  logger: Logger
): Worker<InboundMessage> {
  const worker = new Worker<InboundMessage>(
    QUEUE_NAMES.INBOUND_MESSAGES,
    async (job) => handler(job.data),
    { connection: redis, concurrency: QUEUE_OPTIONS.workerConcurrency }
  );

  worker.on("completed", (job) => logger.debug("Job completed", { jobId: job.id }));
  worker.on("failed", (job, error) => {
    logger.error("Job failed", {
      jobId: job?.id,
      phone: job?.data.phone,
      error: String(error),
    });
  });

  return worker;
}
