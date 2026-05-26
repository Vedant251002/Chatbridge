// Token-aware text chunker. Uses a heuristic ~4 chars per token
// (good enough — we just need consistent, bounded chunks).
const CHARS_PER_TOKEN = 4;

export interface Chunk {
  ordinal: number;
  content: string;
  tokenCount: number;
}

export interface ChunkOptions {
  targetTokens: number; // ~500 is a healthy default for support snippets
  overlapTokens: number; // 50 keeps cross-boundary context
}

const DEFAULT_OPTIONS: ChunkOptions = {
  targetTokens: 500,
  overlapTokens: 50,
};

export function chunkText(text: string, opts: Partial<ChunkOptions> = {}): Chunk[] {
  const { targetTokens, overlapTokens } = { ...DEFAULT_OPTIONS, ...opts };
  const targetChars = targetTokens * CHARS_PER_TOKEN;
  const overlapChars = overlapTokens * CHARS_PER_TOKEN;

  const cleaned = text.replace(/\r\n/g, "\n").replace(/\u0000/g, "").trim();
  if (cleaned.length === 0) return [];
  if (cleaned.length <= targetChars) {
    return [{ ordinal: 0, content: cleaned, tokenCount: estimateTokens(cleaned) }];
  }

  // Split on paragraph breaks first (preserves semantic units), then
  // greedily pack paragraphs into chunks.
  const paragraphs = cleaned.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);

  const chunks: Chunk[] = [];
  let buffer = "";
  let ordinal = 0;

  const flush = () => {
    const content = buffer.trim();
    if (content.length === 0) return;
    chunks.push({ ordinal: ordinal++, content, tokenCount: estimateTokens(content) });
    // Carry overlap from the tail to the next chunk
    buffer = overlapChars > 0 ? content.slice(-overlapChars) : "";
  };

  for (const para of paragraphs) {
    if (para.length > targetChars) {
      // Long paragraph — break by sentences/whitespace
      flush();
      const subChunks = splitLong(para, targetChars, overlapChars);
      for (const c of subChunks) {
        chunks.push({ ordinal: ordinal++, content: c, tokenCount: estimateTokens(c) });
      }
      buffer = overlapChars > 0 ? subChunks[subChunks.length - 1].slice(-overlapChars) : "";
      continue;
    }

    if (buffer.length + para.length + 2 > targetChars) {
      flush();
    }
    buffer = buffer ? `${buffer}\n\n${para}` : para;
  }

  flush();
  return chunks;
}

function splitLong(text: string, targetChars: number, overlapChars: number): string[] {
  const sentences = text.split(/(?<=[.!?])\s+/);
  const out: string[] = [];
  let buffer = "";

  for (const sent of sentences) {
    if (sent.length > targetChars) {
      // Sentence longer than a chunk — hard split
      if (buffer) out.push(buffer.trim());
      for (let i = 0; i < sent.length; i += targetChars - overlapChars) {
        out.push(sent.slice(i, i + targetChars));
      }
      buffer = "";
      continue;
    }
    if (buffer.length + sent.length + 1 > targetChars) {
      out.push(buffer.trim());
      buffer = overlapChars > 0 ? buffer.slice(-overlapChars) : "";
    }
    buffer = buffer ? `${buffer} ${sent}` : sent;
  }
  if (buffer.trim()) out.push(buffer.trim());
  return out;
}

export function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / CHARS_PER_TOKEN));
}
