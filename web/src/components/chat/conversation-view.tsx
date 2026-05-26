"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { showToast } from "../toast";
import { MessageBubble } from "./message-bubble";
import type { ChatMessage } from "./types";

interface ConversationDetail {
  id: string;
  phone: string;
  aiPaused: boolean;
  takenOverBy: string | null;
}

interface Props {
  conversationId: string;
  onMutate: () => void;
}

export function ConversationView({ conversationId, onMutate }: Props) {
  const [conversation, setConversation] = useState<ConversationDetail | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [pausing, setPausing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const loadAll = useCallback(async () => {
    const [convRes, msgRes] = await Promise.all([
      fetch(`/api/conversations?limit=200`, { cache: "no-store" }),
      fetch(`/api/messages/${conversationId}`, { cache: "no-store" }),
    ]);
    const convJson = await convRes.json();
    const msgJson = await msgRes.json();
    if (convJson.success) {
      const found = (convJson.data ?? []).find(
        (c: ConversationDetail) => c.id === conversationId
      );
      if (found) setConversation(found);
    }
    if (msgJson.success) setMessages(msgJson.data ?? []);
  }, [conversationId]);

  // Initial load whenever the active conversation changes
  useEffect(() => {
    setMessages([]);
    setConversation(null);
    loadAll();
  }, [loadAll]);

  // Auto-scroll to the bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // Realtime: SSE per conversation. On any event, refetch (cheap and avoids
  // race conditions with optimistic updates).
  useEffect(() => {
    const url = `/api/conversations/${conversationId}/stream`;
    const source = new EventSource(url);
    source.onmessage = () => {
      // Tiny debounce — Redis events can fire rapidly during AI replies
      loadAll();
    };
    source.onerror = () => {
      // EventSource auto-reconnects; nothing to do
    };
    return () => source.close();
  }, [conversationId, loadAll]);

  const togglePause = async () => {
    if (!conversation) return;
    setPausing(true);
    try {
      const res = await fetch(`/api/conversations/${conversationId}/pause`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-agent-id": "agent" },
        body: JSON.stringify({ paused: !conversation.aiPaused }),
      });
      const json = await res.json();
      if (!json.success) {
        showToast(json.error?.message ?? "Failed to update", "err");
        return;
      }
      showToast(conversation.aiPaused ? "AI resumed" : "AI paused — you're driving");
      await loadAll();
      onMutate();
    } finally {
      setPausing(false);
    }
  };

  const sendReply = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      const res = await fetch(`/api/conversations/${conversationId}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-agent-id": "agent" },
        body: JSON.stringify({ text }),
      });
      const json = await res.json();
      if (!json.success) {
        showToast(json.error?.message ?? "Send failed", "err");
        return;
      }
      setDraft("");
      await loadAll();
      onMutate();
    } finally {
      setSending(false);
    }
  };

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      void sendReply();
    }
  };

  return (
    <section className="chat-thread" aria-label="Conversation">
      <header className="chat-thread-header">
        <div>
          <h2>{conversation?.phone ?? "…"}</h2>
          <div className="meta">
            {conversation?.aiPaused
              ? `Manual mode · ${conversation.takenOverBy ?? "agent"}`
              : "AI is replying automatically"}
          </div>
        </div>
        <div>
          <button
            className={conversation?.aiPaused ? "primary" : "warning"}
            onClick={togglePause}
            disabled={pausing || !conversation}
            aria-pressed={conversation?.aiPaused ?? false}
          >
            {pausing
              ? "Updating…"
              : conversation?.aiPaused
              ? "Resume AI"
              : "Pause AI · take over"}
          </button>
        </div>
      </header>

      {conversation?.aiPaused ? (
        <div className="chat-banner paused">
          AI is paused. Replies you send below go directly to the customer.
        </div>
      ) : (
        <div className="chat-banner live">
          AI is handling replies. Pause the AI to take over manually.
        </div>
      )}

      <div className="chat-messages" role="log" aria-live="polite" aria-relevant="additions">
        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} />
        ))}
        <div ref={messagesEndRef} />
      </div>

      <footer className="chat-composer">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKey}
          placeholder={
            conversation?.aiPaused
              ? "Type your reply (Cmd/Ctrl + Enter to send)"
              : "Pause the AI before replying manually"
          }
          disabled={!conversation?.aiPaused}
          aria-label="Reply"
          maxLength={4096}
        />
        <div className="composer-controls">
          <button
            className="primary"
            onClick={sendReply}
            disabled={sending || !conversation?.aiPaused || draft.trim().length === 0}
          >
            {sending ? "Sending…" : "Send"}
          </button>
        </div>
      </footer>
    </section>
  );
}
