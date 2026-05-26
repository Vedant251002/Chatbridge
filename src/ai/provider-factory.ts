import type { AiConfig, AiProviderName } from "../config.js";
import type { Logger } from "../domain/ports/logger.js";
import type { AiProvider } from "../domain/ports/ai-provider.js";
import { createGroqProvider } from "./providers/groq-provider.js";
import { createMockProvider } from "./providers/mock-provider.js";
import { createXaiProvider } from "./providers/xai-provider.js";

export function createAiProvider(config: AiConfig, logger: Logger): AiProvider {
  const provider = buildProvider(config, logger);

  logger.info("AI provider initialised", {
    provider: provider.name,
    note: providerNote(config.provider),
  });

  return provider;
}

function buildProvider(config: AiConfig, logger: Logger): AiProvider {
  switch (config.provider) {
    case "groq":
      return createGroqProvider({ ...config.groq, logger });
    case "xai":
      return createXaiProvider({ ...config.xai, logger });
    case "mock":
      return createMockProvider();
  }
}

function providerNote(provider: AiProviderName): string {
  switch (provider) {
    case "groq":
      return "GroqCloud free tier";
    case "xai":
      return "xAI Grok API";
    case "mock":
      return "mock responses — set GROQ_API_KEY or GROK_API_KEY to use a real provider";
  }
}
