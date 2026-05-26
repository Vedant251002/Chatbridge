import type { InboundMessage } from "../entities/inbound-message.js";

// Outbound-from-listener port — the listener publishes; the worker consumes
// (consumer is wired in the composition root, not used by domain code).
export interface MessagePublisher {
  publishInbound(message: InboundMessage): Promise<void>;
}
