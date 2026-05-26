import { Redis } from "ioredis";

// Realtime fan-out matches the backend's RedisRealtimePublisher: per-conversation
// channel `conv:{id}`. Each SSE handler creates its own Redis subscriber.

export type RealtimeEvent =
  | { type: "message.created"; conversationId: string; messageId: string }
  | { type: "conversation.paused"; conversationId: string; agent: string | null }
  | { type: "conversation.resumed"; conversationId: string };

export function realtimeChannel(conversationId: string): string {
  return `conv:${conversationId}`;
}

export function createRealtimeSubscriber(): Redis {
  const url = process.env.REDIS_URL ?? "redis://localhost:6379";
  return new Redis(url, { maxRetriesPerRequest: null, enableReadyCheck: false });
}

// Server-side publish helper for routes that mutate state (agent reply, pause).
// Uses a singleton publisher Redis client.
declare global {
  var __realtimePublisher: Redis | undefined;
}

export function realtimePublisher(): Redis {
  if (!globalThis.__realtimePublisher) {
    const url = process.env.REDIS_URL ?? "redis://localhost:6379";
    globalThis.__realtimePublisher = new Redis(url, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });
  }
  return globalThis.__realtimePublisher;
}

export async function publishEvent(event: RealtimeEvent): Promise<void> {
  try {
    await realtimePublisher().publish(realtimeChannel(event.conversationId), JSON.stringify(event));
  } catch (error) {
    console.warn("Realtime publish failed:", error);
  }
}
