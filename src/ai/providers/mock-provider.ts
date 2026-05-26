import type { AiProvider } from "../../domain/ports/ai-provider.js";
import type {
  AiMessage,
  AssessmentOutput,
  AssessmentResult,
} from "../../domain/entities/assessment.js";

const MOCK_OUTPUTS: AssessmentOutput[] = [
  {
    classification: "interested",
    summary: "User is interested and seeking more information",
    suggestedReply:
      "Thank you for reaching out! I would be happy to help. Could you share more details?",
    confidence: 0.85,
  },
  {
    classification: "follow_up_required",
    summary: "Message requires clarification before proceeding",
    suggestedReply:
      "I understand. Could you clarify what you need so I can assist you better?",
    confidence: 0.6,
  },
  {
    classification: "unknown",
    summary: "Unable to determine clear intent from the message",
    suggestedReply: "I received your message. How can I assist you today?",
    confidence: 0.4,
  },
];

function pickMockOutput(messages: AiMessage[]): AssessmentOutput {
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  const seed = lastUser?.content.length ?? 0;
  return MOCK_OUTPUTS[seed % MOCK_OUTPUTS.length];
}

export function createMockProvider(): AiProvider {
  return {
    name: "mock",
    async fetchAssessment(messages: AiMessage[]): Promise<AssessmentResult> {
      const structured = pickMockOutput(messages);
      return {
        reply: structured.suggestedReply,
        structured,
        tokensUsed: 0,
      };
    },
  };
}
