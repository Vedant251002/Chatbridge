import type { Logger } from "../../domain/ports/logger.js";
import type { AiProvider } from "../../domain/ports/ai-provider.js";
import type { AiMessage, AssessmentResult } from "../../domain/entities/assessment.js";
import { sendOpenAiCompatRequest } from "./openai-compat-request.js";

export interface GroqProviderConfig {
  apiKey: string;
  apiUrl: string;
  model: string;
  logger: Logger;
}

export function createGroqProvider(config: GroqProviderConfig): AiProvider {
  return {
    name: "groq",
    async fetchAssessment(messages: AiMessage[]): Promise<AssessmentResult> {
      config.logger.debug("Sending request to GroqCloud", { model: config.model });
      return sendOpenAiCompatRequest(messages, config);
    },
  };
}
