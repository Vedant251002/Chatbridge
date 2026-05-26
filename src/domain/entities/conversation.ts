export interface Conversation {
  id: string;
  phone: string;
  threadId: string;
  aiPaused: boolean;
  takenOverBy: string | null;
  lastActivityAt: Date;
  createdAt: Date;
}

export interface ConversationPage {
  conversations: Conversation[];
  total: number;
}
