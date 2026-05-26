import { Queue } from "bullmq";
import type { Redis } from "ioredis";
import { QueueError } from "../../utils/errors.js";
import type { Logger } from "../../domain/ports/logger.js";

export interface OutboundJob {
  // The user whose WhatsApp socket should send this message. Required —
  // the worker uses it to look up the right gateway in the manager.
  userId: string;
  jid: string;
  text: string;
  conversationId?: string;
}

const QUEUE_NAME = "outbound-messages";

const OPTIONS = {
  attempts: 5,
  backoffDelayMs: 2_000,
  removeOnComplete: 100,
  removeOnFail: 50,
} as const;

export class BullMqOutboundPublisher {
  private readonly queue: Queue<OutboundJob>;

  constructor(redis: Redis, private readonly logger: Logger) {
    this.queue = new Queue<OutboundJob>(QUEUE_NAME, { connection: redis });
    this.queue.on("error", (error) =>
      this.logger.error("Outbound queue error", { error: String(error) })
    );
  }

  async publish(job: OutboundJob): Promise<void> {
    try {
      await this.queue.add("send", job, {
        attempts: OPTIONS.attempts,
        backoff: { type: "exponential", delay: OPTIONS.backoffDelayMs },
        removeOnComplete: OPTIONS.removeOnComplete,
        removeOnFail: OPTIONS.removeOnFail,
      });
    } catch (error) {
      throw new QueueError("Failed to enqueue outbound WhatsApp message", error);
    }
  }
}

export const OUTBOUND_QUEUE_NAME = QUEUE_NAME;
