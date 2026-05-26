// HTTP wire format for OpenAI-compatible providers (xAI, Groq).
// Kept internal to the AI infrastructure module.

import type { AiMessage } from "../domain/entities/assessment.js";

export interface OpenAiCompatRequest {
  model: string;
  messages: AiMessage[];
  temperature?: number;
  max_tokens?: number;
  stream?: false;
}

export interface OpenAiCompatChoice {
  index: number;
  message: AiMessage;
  finish_reason: "stop" | "length" | "content_filter";
}

export interface OpenAiCompatUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface OpenAiCompatResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: OpenAiCompatChoice[];
  usage: OpenAiCompatUsage;
}
