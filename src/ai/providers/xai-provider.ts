import type { Logger } from "../../domain/ports/logger.js";
import type { AiProvider } from "../../domain/ports/ai-provider.js";
import type { AiMessage, AssessmentResult } from "../../domain/entities/assessment.js";
import { sendOpenAiCompatRequest } from "./openai-compat-request.js";

export interface XaiProviderConfig {
  apiKey: string;
  apiUrl: string;
  model: string;
  logger: Logger;
}

export function createXaiProvider(config: XaiProviderConfig): AiProvider {
  return {
    name: "xai",
    async fetchAssessment(messages: AiMessage[]): Promise<AssessmentResult> {
      config.logger.debug("Sending request to xAI Grok", { model: config.model });
      return sendOpenAiCompatRequest(messages, config);
    },
  };
}
