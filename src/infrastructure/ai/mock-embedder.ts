import { createHash } from "crypto";
import type { Embedder } from "../../domain/ports/embedder.js";

// Feature-hashing token embedder. Real semantic embeddings need a model;
// this gives us the next best thing without any deps or API keys: tokens
// are hashed into bucket positions in the vector, with sublinear term
// frequency and L2 normalisation. Cosine similarity then reflects token
// overlap between query and chunks — good enough for keyword-style support
// queries. Drop-in compatible with the OpenAI 1536-dim layout so the
// pgvector schema doesn't change.

const STOPWORDS = new Set([
  "a","an","and","are","as","at","be","but","by","for","from","has","have",
  "he","i","in","is","it","its","me","my","of","on","or","so","that","the",
  "this","to","was","were","what","when","where","who","why","will","with",
  "you","your","do","does","did","not","no","yes","please","hi","hello","hey",
]);

export function createMockEmbedder(dimensions = 1536): Embedder {
  return {
    name: "feature-hash",
    dimensions,
    async embed(text: string): Promise<number[]> {
      return featureHash(text, dimensions);
    },
    async embedBatch(texts: string[]): Promise<number[][]> {
      return texts.map((t) => featureHash(t, dimensions));
    },
  };
}

function tokenize(input: string): string[] {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 2 && !STOPWORDS.has(t));
}

// Hash a string to a 32-bit unsigned int via SHA-256 first 4 bytes.
function hash32(token: string, salt: string): number {
  const buf = createHash("sha256").update(salt).update(token).digest();
  return ((buf[0] << 24) | (buf[1] << 16) | (buf[2] << 8) | buf[3]) >>> 0;
}

function featureHash(text: string, dim: number): number[] {
  const tokens = tokenize(text);
  const vec = new Float64Array(dim);

  if (tokens.length === 0) {
    // Empty input → uniform zero vector. Cosine with anything is 0/NaN, so
    // bias to a tiny constant to keep math well-defined.
    vec[0] = 1;
    return Array.from(vec);
  }

  // Sublinear term frequency: 1 + log(count). Cuts the impact of repetition.
  const counts = new Map<string, number>();
  for (const t of tokens) counts.set(t, (counts.get(t) ?? 0) + 1);

  // Hash each token into TWO positions (with a sign flip on the second)
  // — classic "hashing trick" with random sign reduces collision noise.
  for (const [token, count] of counts) {
    const tf = 1 + Math.log(count);
    const hA = hash32(token, "a");
    const hB = hash32(token, "b");
    const idxA = hA % dim;
    const idxB = hB % dim;
    const signB = (hB & 0x80000000) !== 0 ? -1 : 1;
    vec[idxA] += tf;
    vec[idxB] += tf * signB;
  }

  // L2 normalise so cosine reduces to a plain dot product.
  let mag = 0;
  for (let i = 0; i < dim; i++) mag += vec[i] * vec[i];
  mag = Math.sqrt(mag) || 1;
  const out = new Array<number>(dim);
  for (let i = 0; i < dim; i++) out[i] = vec[i] / mag;
  return out;
}
