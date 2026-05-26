import { Queue } from "bullmq";
import type { Redis } from "ioredis";
import { QueueError } from "../../utils/errors.js";
import type { Logger } from "../../domain/ports/logger.js";
import type { MessagePublisher } from "../../domain/ports/message-publisher.js";
import type { InboundMessage } from "../../domain/entities/inbound-message.js";
import { QUEUE_NAMES, QUEUE_OPTIONS } from "./queue-config.js";

export class BullMqMessagePublisher implements MessagePublisher {
  private readonly queue: Queue<InboundMessage>;

  constructor(redis: Redis, private readonly logger: Logger) {
    this.queue = new Queue<InboundMessage>(QUEUE_NAMES.INBOUND_MESSAGES, {
      connection: redis,
    });
    this.queue.on("error", (error) => {
      this.logger.error("Message queue error", { error: String(error) });
    });
  }

  async publishInbound(message: InboundMessage): Promise<void> {
    try {
      const job = await this.queue.add("process", message, {
        attempts: QUEUE_OPTIONS.attempts,
        backoff: { type: "exponential", delay: QUEUE_OPTIONS.backoffDelayMs },
        removeOnComplete: QUEUE_OPTIONS.removeOnComplete,
        removeOnFail: QUEUE_OPTIONS.removeOnFail,
      });
      this.logger.debug("Message enqueued", {
        jobId: job.id,
        userId: message.userId,
        phone: message.phone,
      });
    } catch (error) {
      throw new QueueError("Failed to enqueue inbound message", error);
    }
  }
}
