import type { Logger } from "../../domain/ports/logger.js";
import type { Embedder } from "../../domain/ports/embedder.js";
import type { EmbeddingsConfig } from "../../config.js";
import { createMockEmbedder } from "./mock-embedder.js";
import { createOpenAiEmbedder } from "./openai-embedder.js";

export function createEmbedder(config: EmbeddingsConfig, logger: Logger): Embedder {
  if (config.provider === "openai" && config.openai.apiKey) {
    logger.info("Embedder initialised", { provider: "openai", model: config.openai.model });
    return createOpenAiEmbedder({ ...config.openai, logger });
  }

  logger.warn(
    "Embedder falling back to mock — set EMBEDDINGS_PROVIDER=openai and OPENAI_API_KEY for real embeddings"
  );
  return createMockEmbedder(config.openai.dimensions);
}
