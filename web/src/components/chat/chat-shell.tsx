"use client";

import { useEffect, useState } from "react";
import { ConversationList } from "./conversation-list";
import { ConversationView } from "./conversation-view";
import type { ConversationListItem } from "./types";

interface Props {
  activeId: string | null;
}

export function ChatShell({ activeId }: Props) {
  const [items, setItems] = useState<ConversationListItem[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = async () => {
    try {
      const res = await fetch("/api/conversations?limit=100", { cache: "no-store" });
      const json = await res.json();
      if (json.success) setItems(json.data ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
    // Poll the inbox every 8s as a backstop. Per-conversation SSE handles
    // intra-thread updates in real time; this just keeps the inbox sorted
    // when other conversations get new messages.
    const id = setInterval(reload, 8_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className={`chat-shell ${activeId ? "" : ""}`}>
      <ConversationList
        items={items}
        loading={loading}
        activeId={activeId}
      />
      {activeId ? (
        <ConversationView conversationId={activeId} onMutate={reload} />
      ) : (
        <div className="chat-empty">
          {loading ? "Loading…" : "Select a conversation from the left"}
        </div>
      )}
    </div>
  );
}
