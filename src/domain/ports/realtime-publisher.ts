// Realtime fan-out (pub/sub). Web SSE handlers subscribe per-conversation
// and forward events to the browser.
export type RealtimeEvent =
  | { type: "message.created"; conversationId: string; messageId: string }
  | { type: "conversation.paused"; conversationId: string; agent: string | null }
  | { type: "conversation.resumed"; conversationId: string };

export interface RealtimePublisher {
  publish(event: RealtimeEvent): Promise<void>;
}
