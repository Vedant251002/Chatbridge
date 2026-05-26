import type {
  AiMessage,
  AssessmentClassification,
  AssessmentOutput,
} from "../domain/entities/assessment.js";
import type { RetrievedChunk } from "../domain/entities/knowledge.js";

// Instructs the AI to return strict JSON — no prose, no markdown wrapper
export const ASSESSMENT_SYSTEM_PROMPT = `You are an AI assessment assistant for a WhatsApp communication platform.

Analyse the incoming message and respond with a valid JSON object ONLY. No markdown. No preamble. No explanation.

Your response must be exactly this JSON structure:
{
  "classification": "interested" | "not_interested" | "follow_up_required" | "unknown",
  "summary": "One sentence describing what the user said or wants",
  "suggestedReply": "A helpful, natural reply to send back to the user",
  "confidence": 0.95
}

Classification rules:
- interested: User is clearly interested, wants to proceed, or requesting more information
- not_interested: User explicitly declines, says stop, or shows clear disinterest
- follow_up_required: Message is unclear, ambiguous, or requires human review
- unknown: Cannot determine intent from the message

confidence is a float between 0.0 and 1.0 reflecting your certainty about the classification.

Respond with ONLY the JSON object. No other text before or after.`;

export const MAX_CONTEXT_MESSAGES = 10;
export const MAX_TOKENS = 1024;
export const DEFAULT_TEMPERATURE = 0.3;

const MAX_COMPANY_PROMPT_LENGTH = 4000;
const MAX_KNOWLEDGE_BLOCK_CHARS = 8000;

export function sanitizeCompanyPrompt(input: string): string {
  return input
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    .trim()
    .slice(0, MAX_COMPANY_PROMPT_LENGTH);
}

export function composeSystemPrompt(companyPrompt: string | null): string {
  return composeSystemPromptWithContext(companyPrompt, []);
}

// Adds a `--- KNOWLEDGE ---` block sourced from RAG. Each chunk is labelled
// [n] so the model can cite, and the source title is included for traceability.
export function composeSystemPromptWithContext(
  companyPrompt: string | null,
  retrieved: RetrievedChunk[]
): string {
  const cleaned = companyPrompt ? sanitizeCompanyPrompt(companyPrompt) : "";
  const sections: string[] = [];

  if (cleaned) {
    sections.push(
      "You are an AI assistant for the following business. Use this context when crafting replies:",
      "",
      "--- COMPANY CONTEXT ---",
      cleaned,
      "--- END COMPANY CONTEXT ---",
      ""
    );
  }

  if (retrieved.length > 0) {
    const knowledgeBlock = formatKnowledgeBlock(retrieved);
    sections.push(
      "When the user's question relates to the knowledge below, ground your reply in it. If the knowledge does not cover the question, say what you can and offer to follow up.",
      "",
      "--- KNOWLEDGE ---",
      knowledgeBlock,
      "--- END KNOWLEDGE ---",
      ""
    );
  }

  sections.push(ASSESSMENT_SYSTEM_PROMPT);
  return sections.join("\n");
}

function formatKnowledgeBlock(retrieved: RetrievedChunk[]): string {
  let total = 0;
  const parts: string[] = [];
  for (let i = 0; i < retrieved.length; i++) {
    const c = retrieved[i];
    const header = `[${i + 1}] (source: ${c.documentTitle})`;
    const body = c.content.replace(/\s+/g, " ").trim();
    const block = `${header}\n${body}`;
    if (total + block.length > MAX_KNOWLEDGE_BLOCK_CHARS) break;
    parts.push(block);
    total += block.length;
  }
  return parts.join("\n\n");
}

const VALID_CLASSIFICATIONS: readonly AssessmentClassification[] = [
  "interested",
  "not_interested",
  "follow_up_required",
  "unknown",
];

const PARSE_FALLBACK: AssessmentOutput = {
  classification: "unknown",
  summary: "Unable to parse AI response",
  suggestedReply: "I'm here to help. Could you please clarify your message?",
  confidence: 0.0,
};

export function parseAssessmentOutput(text: string): AssessmentOutput {
  const trimmed = text.trim();
  const stripped = trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();

  const jsonMatch = stripped.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return { ...PARSE_FALLBACK, summary: trimmed.slice(0, 200), suggestedReply: trimmed };
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
    return {
      classification: isValidClassification(parsed.classification)
        ? parsed.classification
        : "unknown",
      summary:
        typeof parsed.summary === "string" ? parsed.summary : trimmed.slice(0, 200),
      suggestedReply:
        typeof parsed.suggestedReply === "string" ? parsed.suggestedReply : trimmed,
      confidence:
        typeof parsed.confidence === "number"
          ? Math.min(1, Math.max(0, parsed.confidence))
          : 0.5,
    };
  } catch {
    return { ...PARSE_FALLBACK, summary: trimmed.slice(0, 200), suggestedReply: trimmed };
  }
}

function isValidClassification(value: unknown): value is AssessmentClassification {
  return VALID_CLASSIFICATIONS.includes(value as AssessmentClassification);
}

export function buildConversationMessages(
  systemPrompt: string,
  history: Array<{ sender: string; message: string }>,
  newMessage: string
): AiMessage[] {
  const recentHistory = history
    .filter((m) => m.sender === "user" || m.sender === "assistant" || m.sender === "agent")
    .slice(-MAX_CONTEXT_MESSAGES);

  const historyMessages: AiMessage[] = recentHistory.map((entry) => ({
    role: entry.sender === "user" ? "user" : "assistant",
    content: entry.message,
  }));

  return [
    { role: "system", content: systemPrompt },
    ...historyMessages,
    { role: "user", content: newMessage },
  ];
}
