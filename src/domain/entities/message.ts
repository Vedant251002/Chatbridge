// agent = human takeover; system = lifecycle markers (pause/resume notes)
export type MessageSender = "user" | "assistant" | "agent" | "system";

export interface Message {
  id: string;
  conversationId: string;
  sender: MessageSender;
  message: string;
  aiOutput: Record<string, unknown> | null;
  createdAt: Date;
}
