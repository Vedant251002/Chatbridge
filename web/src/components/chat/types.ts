export interface ConversationListItem {
  id: string;
  phone: string;
  threadId: string;
  aiPaused: boolean;
  takenOverBy: string | null;
  lastActivityAt: string;
  createdAt: string;
  lastMessage: {
    id: string;
    sender: string;
    message: string;
    createdAt: string;
  } | null;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  sender: "user" | "assistant" | "agent" | "system";
  message: string;
  aiOutput: Record<string, unknown> | null;
  createdAt: string;
}
