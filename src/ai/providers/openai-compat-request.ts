import { AiServiceError } from "../../utils/errors.js";
import type { Logger } from "../../domain/ports/logger.js";
import type { AiMessage, AssessmentResult } from "../../domain/entities/assessment.js";
import { DEFAULT_TEMPERATURE, MAX_TOKENS, parseAssessmentOutput } from "../prompts.js";
import type {
  OpenAiCompatRequest,
  OpenAiCompatResponse,
} from "../types.js";

const REQUEST_TIMEOUT_MS = 30_000;

export interface OpenAiCompatConfig {
  apiKey: string;
  apiUrl: string;
  model: string;
  logger: Logger;
}

export async function sendOpenAiCompatRequest(
  messages: AiMessage[],
  config: OpenAiCompatConfig
): Promise<AssessmentResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const requestBody = buildRequestBody(config.model, messages);

    const response = await fetch(config.apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new AiServiceError(`HTTP ${response.status}: ${body}`);
    }

    const raw = await response.json();
    const parsed = parseResponseBody(raw);

    const replyText = parsed.choices[0].message.content;
    const structured = parseAssessmentOutput(replyText);

    config.logger.debug("AI response received", {
      model: config.model,
      tokens: parsed.usage.total_tokens,
      classification: structured.classification,
    });

    return {
      reply: structured.suggestedReply,
      structured,
      tokensUsed: parsed.usage.total_tokens,
    };
  } catch (error) {
    if (error instanceof AiServiceError) throw error;

    if (error instanceof Error && error.name === "AbortError") {
      throw new AiServiceError(
        `Request timed out after ${REQUEST_TIMEOUT_MS}ms`,
        error
      );
    }

    throw new AiServiceError("AI API request failed", error);
  } finally {
    clearTimeout(timeoutId);
  }
}

function buildRequestBody(model: string, messages: AiMessage[]): OpenAiCompatRequest {
  return {
    model,
    messages,
    temperature: DEFAULT_TEMPERATURE,
    max_tokens: MAX_TOKENS,
    stream: false,
  };
}

function parseResponseBody(raw: unknown): OpenAiCompatResponse {
  if (
    typeof raw !== "object" ||
    raw === null ||
    !("choices" in raw) ||
    !Array.isArray((raw as OpenAiCompatResponse).choices) ||
    (raw as OpenAiCompatResponse).choices.length === 0
  ) {
    throw new AiServiceError("Unexpected API response shape");
  }

  return raw as OpenAiCompatResponse;
}
