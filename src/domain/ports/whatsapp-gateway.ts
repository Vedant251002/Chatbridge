import type { InboundMessage } from "../entities/inbound-message.js";
import type { WhatsAppSender } from "./whatsapp-sender.js";

// Lifecycle interface for the bootstrap layer. Use cases should depend on
// the narrower WhatsAppSender — this gateway extends it with connection
// management.
export interface WhatsAppGateway extends WhatsAppSender {
  connect(): Promise<void>;
  onInboundMessage(handler: (message: InboundMessage) => Promise<void>): void;
  disconnect(): Promise<void>;
}
