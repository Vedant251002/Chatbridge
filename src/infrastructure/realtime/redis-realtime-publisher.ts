import type { Redis } from "ioredis";
import type { Logger } from "../../domain/ports/logger.js";
import type {
  RealtimeEvent,
  RealtimePublisher,
} from "../../domain/ports/realtime-publisher.js";

// Per-conversation channel so subscribers only get events for the
// conversation they're watching. The Next.js SSE handler wraps a
// duplicate Redis client and subscribes per conversationId.
export function realtimeChannel(conversationId: string): string {
  return `conv:${conversationId}`;
}

export class RedisRealtimePublisher implements RealtimePublisher {
  constructor(
    private readonly redis: Redis,
    private readonly logger: Logger
  ) {}

  async publish(event: RealtimeEvent): Promise<void> {
    try {
      await this.redis.publish(realtimeChannel(event.conversationId), JSON.stringify(event));
    } catch (error) {
      // Realtime fan-out is best-effort — log but don't crash the request.
      this.logger.warn("Realtime publish failed", { error: String(error) });
    }
  }
}
