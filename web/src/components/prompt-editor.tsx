"use client";

import { useEffect, useState } from "react";
import { showToast, ToastHost } from "./toast";

const MAX_LENGTH = 4000;

export function PromptEditor() {
  const [prompt, setPrompt] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const res = await fetch("/api/bot-config", { cache: "no-store" });
      const json = await res.json();
      setPrompt(json.data?.prompt ?? "");
    } catch {
      showToast("Failed to load prompt", "err");
    }
  };

  useEffect(() => {
    load();
  }, []);

  const save = async () => {
    const trimmed = prompt.trim();
    if (!trimmed) {
      showToast("Prompt cannot be empty", "err");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/bot-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: trimmed }),
      });
      const json = await res.json();
      if (!json.success) {
        showToast(json.error?.message ?? "Save failed", "err");
        return;
      }
      showToast("Prompt saved");
    } catch {
      showToast("Save failed", "err");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="card">
        <h2>Prompt</h2>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          maxLength={MAX_LENGTH}
          placeholder="Describe your company. e.g. Acme Corp sells handmade leather bags. We ship worldwide. Business hours 9am-6pm IST. Always be friendly and concise."
        />
        <div className="counter">
          {prompt.length} / {MAX_LENGTH}
        </div>
        <div className="row">
          <button className="primary" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save prompt"}
          </button>
          <button className="ghost" onClick={load} disabled={saving}>
            Reload
          </button>
        </div>
      </div>
      <ToastHost />
    </>
  );
}
