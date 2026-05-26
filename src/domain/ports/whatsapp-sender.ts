// Minimal interface that use cases need. Lifecycle (connect, onMessage,
// disconnect) is handled by the bootstrap layer, not by use cases.
export interface WhatsAppSender {
  sendMessage(phoneOrJid: string, text: string): Promise<void>;
}
