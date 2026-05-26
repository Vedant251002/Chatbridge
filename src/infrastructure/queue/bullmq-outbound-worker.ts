import { Worker } from "bullmq";
import type { Redis } from "ioredis";
import type { Logger } from "../../domain/ports/logger.js";
import type { WhatsAppSender } from "../../domain/ports/whatsapp-sender.js";
import { OUTBOUND_QUEUE_NAME, type OutboundJob } from "./bullmq-outbound-publisher.js";

export function createOutboundWorker(
  redis: Redis,
  sender: WhatsAppSender,
  logger: Logger
): Worker<OutboundJob> {
  const worker = new Worker<OutboundJob>(
    OUTBOUND_QUEUE_NAME,
    async (job) => {
      await sender.sendMessage(job.data.jid, job.data.text);
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
      error: String(error),
    });
  });

  return worker;
}
