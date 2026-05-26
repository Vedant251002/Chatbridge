import { Worker, UnrecoverableError } from "bullmq";
import type { Redis } from "ioredis";
import type { Logger } from "../../domain/ports/logger.js";
import type { WhatsAppSender } from "../../domain/ports/whatsapp-sender.js";
import { OUTBOUND_QUEUE_NAME, type OutboundJob } from "./bullmq-outbound-publisher.js";

export type SenderResolver = (userId: string) => WhatsAppSender | null;

export function createOutboundWorker(
  redis: Redis,
  resolveSender: SenderResolver,
  logger: Logger
): Worker<OutboundJob> {
  const worker = new Worker<OutboundJob>(
    OUTBOUND_QUEUE_NAME,
    async (job) => {
      const sender = resolveSender(job.data.userId);
      if (!sender) {
        // The user's socket isn't connected. BullMQ will retry — by then
        // the user may have re-paired. After max attempts we give up.
        throw new Error(`No WhatsApp socket for user ${job.data.userId}`);
      }
      try {
        await sender.sendMessage(job.data.jid, job.data.text);
      } catch (error) {
        // Convert sender-not-ready failures to retryable errors; everything
        // else propagates.
        throw error instanceof Error ? error : new Error(String(error));
      }
      // Reference UnrecoverableError to keep the import live for future
      // explicit "do-not-retry" cases.
      void UnrecoverableError;
    },
    { connection: redis, concurrency: 3 }
  );

  worker.on("completed", (job) =>
    logger.debug("Outbound delivered", { jobId: job.id, jid: job.data.jid })
  );
  worker.on("failed", (job, error) => {
    logger.error("Outbound failed", {
      jobId: job?.id,
      jid: job?.data.jid,
      userId: job?.data.userId,
      error: String(error),
    });
  });

  return worker;
}
