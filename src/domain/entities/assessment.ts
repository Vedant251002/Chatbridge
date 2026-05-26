export type AssessmentClassification =
  | "interested"
  | "not_interested"
  | "follow_up_required"
  | "unknown";

export interface AssessmentOutput {
  classification: AssessmentClassification;
  summary: string;
  suggestedReply: string;
  confidence: number;
}

export interface AssessmentResult {
  reply: string;
  structured: AssessmentOutput;
  tokensUsed: number;
}

export interface AiMessage {
  role: "system" | "user" | "assistant";
  content: string;
}
