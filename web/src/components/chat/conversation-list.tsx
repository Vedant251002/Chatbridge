"use client";

import Link from "next/link";
import type { ConversationListItem } from "./types";

interface Props {
  items: ConversationListItem[];
  loading: boolean;
  activeId: string | null;
}

export function ConversationList({ items, loading, activeId }: Props) {
  return (
    <aside className="chat-list" aria-label="Conversations">
      <div className="chat-list-header">
        <span>Inbox</span>
        <span>{items.length}</span>
      </div>

      {loading && items.length === 0 ? (
        <div style={{ padding: 20, textAlign: "center" }}>
          <div className="spinner" />
        </div>
      ) : items.length === 0 ? (
        <div style={{ padding: 20, color: "var(--muted)", fontSize: 13 }}>
          No conversations yet. Send a message via WhatsApp to start one.
        </div>
      ) : (
        items.map((item) => (
          <Link
            key={item.id}
            href={`/conversations/${item.id}`}
            className={`chat-list-item ${item.id === activeId ? "active" : ""}`}
          >
            <div className="top">
              <span className="phone">
                {item.phone}
                {item.aiPaused ? <span className="pause-tag">Manual</span> : null}
              </span>
              <span className="time">{formatTime(item.lastActivityAt)}</span>
            </div>
            <div className="preview">
              {item.lastMessage
                ? `${prefix(item.lastMessage.sender)}${item.lastMessage.message}`
                : "No messages yet"}
            </div>
          </Link>
        ))
      )}
    </aside>
  );
}

function prefix(sender: string): string {
  if (sender === "user") return "";
  if (sender === "assistant") return "Bot: ";
  if (sender === "agent") return "You: ";
  if (sender === "system") return "— ";
  return "";
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], { day: "numeric", month: "short" });
}
