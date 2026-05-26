import type { ChatMessage } from "./types";

interface Props {
  message: ChatMessage;
}

interface SourceMeta {
  documentTitle: string;
  ordinal: number;
  similarity: number;
}

export function MessageBubble({ message }: Props) {
  const { sender } = message;
  const time = new Date(message.createdAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  const sources = extractSources(message);

  if (sender === "system") {
    return <div className="bubble system">{message.message}</div>;
  }

  return (
    <div className={`bubble ${sender}`}>
      {sender === "assistant" ? <span className="bubble-tag bot">Bot</span> : null}
      {sender === "agent" ? <span className="bubble-tag agent">Agent</span> : null}
      <div>{message.message}</div>
      {sources.length > 0 ? (
        <div className="bubble-sources" aria-label="Knowledge sources used">
          Sources:{" "}
          {sources.map((s, i) => (
            <span key={`${s.documentTitle}-${s.ordinal}`}>
              {i > 0 ? ", " : ""}
              {s.documentTitle}#{s.ordinal} ({Math.round(s.similarity * 100)}%)
            </span>
          ))}
        </div>
      ) : null}
      <div className="bubble-meta">{time}</div>
    </div>
  );
}

function extractSources(message: ChatMessage): SourceMeta[] {
  const ai = message.aiOutput;
  if (!ai || typeof ai !== "object") return [];
  const sources = (ai as { sources?: unknown }).sources;
  if (!Array.isArray(sources)) return [];
  return sources
    .filter(
      (s): s is SourceMeta =>
        typeof s === "object" &&
        s !== null &&
        typeof (s as SourceMeta).documentTitle === "string"
    )
    .slice(0, 5);
}
