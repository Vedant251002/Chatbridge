import { config as loadDotenv } from "dotenv";
import { z } from "zod";

loadDotenv();

const AI_PROVIDERS = ["groq", "xai", "mock"] as const;
export type AiProviderName = (typeof AI_PROVIDERS)[number];

const EMBEDDING_PROVIDERS = ["openai", "mock"] as const;
export type EmbeddingProviderName = (typeof EMBEDDING_PROVIDERS)[number];

const configSchema = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),

  AI_PROVIDER: z.enum(AI_PROVIDERS).optional(),

  GROQ_API_KEY: z.string().optional(),
  GROQ_API_URL: z.string().url().default("https://api.groq.com/openai/v1/chat/completions"),
  GROQ_MODEL: z.string().default("llama-3.3-70b-versatile"),

  GROK_API_KEY: z.string().optional(),
  GROK_API_URL: z.string().url().default("https://api.x.ai/v1/chat/completions"),
  GROK_MODEL: z.string().default("grok-3"),

  // Embeddings (RAG). OpenAI text-embedding-3-small is 1536 dims by default.
  EMBEDDINGS_PROVIDER: z.enum(EMBEDDING_PROVIDERS).optional(),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_EMBEDDING_URL: z
    .string()
    .url()
    .default("https://api.openai.com/v1/embeddings"),
  OPENAI_EMBEDDING_MODEL: z.string().default("text-embedding-3-small"),
  EMBEDDING_DIMENSIONS: z.coerce.number().default(1536),

  LOG_LEVEL: z.string().default("info"),
  WHATSAPP_SESSION_DIR: z.string().default("./sessions"),
});

export interface AiConfig {
  provider: AiProviderName;
  groq: { apiKey: string; apiUrl: string; model: string };
  xai: { apiKey: string; apiUrl: string; model: string };
}

export interface EmbeddingsConfig {
  provider: EmbeddingProviderName;
  openai: { apiKey: string; apiUrl: string; model: string; dimensions: number };
}

export interface AppConfig {
  port: number;
  nodeEnv: "development" | "production" | "test";
  databaseUrl: string;
  redisUrl: string;
  ai: AiConfig;
  embeddings: EmbeddingsConfig;
  logLevel: string;
  whatsapp: { sessionDir: string };
}

function resolveActiveProvider(env: z.infer<typeof configSchema>): AiProviderName {
  if (env.AI_PROVIDER) return env.AI_PROVIDER;
  if (env.GROQ_API_KEY) return "groq";
  if (env.GROK_API_KEY) return "xai";
  return "mock";
}

function resolveEmbeddingProvider(
  env: z.infer<typeof configSchema>
): EmbeddingProviderName {
  if (env.EMBEDDINGS_PROVIDER) return env.EMBEDDINGS_PROVIDER;
  if (env.OPENAI_API_KEY) return "openai";
  return "mock";
}

function loadConfig(): AppConfig {
  const parsed = configSchema.safeParse(process.env);

  if (!parsed.success) {
    const missing = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`Missing or invalid environment variables: ${missing}`);
  }

  const env = parsed.data;

  return {
    port: env.PORT,
    nodeEnv: env.NODE_ENV,
    databaseUrl: env.DATABASE_URL,
    redisUrl: env.REDIS_URL,
    ai: {
      provider: resolveActiveProvider(env),
      groq: {
        apiKey: env.GROQ_API_KEY ?? "",
        apiUrl: env.GROQ_API_URL,
        model: env.GROQ_MODEL,
      },
      xai: {
        apiKey: env.GROK_API_KEY ?? "",
        apiUrl: env.GROK_API_URL,
        model: env.GROK_MODEL,
      },
    },
    embeddings: {
      provider: resolveEmbeddingProvider(env),
      openai: {
        apiKey: env.OPENAI_API_KEY ?? "",
        apiUrl: env.OPENAI_EMBEDDING_URL,
        model: env.OPENAI_EMBEDDING_MODEL,
        dimensions: env.EMBEDDING_DIMENSIONS,
      },
    },
    logLevel: env.LOG_LEVEL,
    whatsapp: { sessionDir: env.WHATSAPP_SESSION_DIR },
  };
}

export const CONFIG: AppConfig = loadConfig();
