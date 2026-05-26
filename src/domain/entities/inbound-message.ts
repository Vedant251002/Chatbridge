export interface InboundMessage {
  // Owner of the WhatsApp socket that received this message. Required so
  // the worker can route to the right user's repos and AI config.
  userId: string;
  phone: string;
  jid: string;
  text: string;
  timestamp: number;
  messageId: string;
}
