import { Queue } from "bullmq";
import type { Redis } from "ioredis";
import { QueueError } from "../../utils/errors.js";
import type { Logger } from "../../domain/ports/logger.js";
import { INGEST_QUEUE_OPTIONS, QUEUE_NAMES } from "./queue-config.js";

export interface KnowledgeIngestJob {
  documentId: string;
}

export class BullMqKnowledgePublisher {
  private readonly queue: Queue<KnowledgeIngestJob>;

  constructor(redis: Redis, private readonly logger: Logger) {
    this.queue = new Queue<KnowledgeIngestJob>(QUEUE_NAMES.KNOWLEDGE_INGEST, {
      connection: redis,
    });
    this.queue.on("error", (error) => {
      this.logger.error("Knowledge queue error", { error: String(error) });
    });
  }

  async publishIngest(documentId: string): Promise<void> {
    try {
      const job = await this.queue.add(
        "ingest",
        { documentId },
        {
          attempts: INGEST_QUEUE_OPTIONS.attempts,
          backoff: { type: "exponential", delay: INGEST_QUEUE_OPTIONS.backoffDelayMs },
          removeOnComplete: INGEST_QUEUE_OPTIONS.removeOnComplete,
          removeOnFail: INGEST_QUEUE_OPTIONS.removeOnFail,
        }
      );
      this.logger.debug("Knowledge ingest job enqueued", { jobId: job.id, documentId });
    } catch (error) {
      throw new QueueError("Failed to enqueue knowledge ingest job", error);
    }
  }
}
