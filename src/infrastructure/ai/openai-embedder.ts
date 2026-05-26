import { AiServiceError } from "../../utils/errors.js";
import type { Logger } from "../../domain/ports/logger.js";
import type { Embedder } from "../../domain/ports/embedder.js";

const REQUEST_TIMEOUT_MS = 30_000;

export interface OpenAiEmbedderConfig {
  apiKey: string;
  apiUrl: string;
  model: string;
  dimensions: number;
  logger: Logger;
}

interface EmbeddingResponse {
  data: Array<{ embedding: number[]; index: number }>;
  usage: { prompt_tokens: number; total_tokens: number };
}

export function createOpenAiEmbedder(config: OpenAiEmbedderConfig): Embedder {
  return {
    name: "openai",
    dimensions: config.dimensions,
    async embed(text: string): Promise<number[]> {
      const [vec] = await callApi([text], config);
      return vec;
    },
    async embedBatch(texts: string[]): Promise<number[][]> {
      if (texts.length === 0) return [];
      return callApi(texts, config);
    },
  };
}

async function callApi(
  inputs: string[],
  config: OpenAiEmbedderConfig
): Promise<number[][]> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(config.apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: config.model,
        input: inputs,
        dimensions: config.dimensions,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new AiServiceError(`Embedding HTTP ${res.status}: ${body}`);
    }

    const json = (await res.json()) as EmbeddingResponse;
    if (!Array.isArray(json.data)) {
      throw new AiServiceError("Unexpected embedding response shape");
    }

    config.logger.debug("Embeddings received", {
      count: json.data.length,
      tokens: json.usage?.total_tokens,
    });

    // Sort by index to be safe (provider may return out of order)
    return json.data
      .slice()
      .sort((a, b) => a.index - b.index)
      .map((entry) => entry.embedding);
  } catch (error) {
    if (error instanceof AiServiceError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new AiServiceError(`Embedding request timed out after ${REQUEST_TIMEOUT_MS}ms`, error);
    }
    throw new AiServiceError("Embedding API request failed", error);
  } finally {
    clearTimeout(timeoutId);
  }
}
