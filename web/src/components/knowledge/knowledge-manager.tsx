"use client";

import { useCallback, useEffect, useState } from "react";
import { confirmDialog } from "../confirm-dialog";
import { showToast, ToastHost } from "../toast";
import { UploadForm } from "./upload-form";
import type { KnowledgeDocument } from "./types";

export function KnowledgeManager() {
  const [docs, setDocs] = useState<KnowledgeDocument[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      const res = await fetch("/api/knowledge", { cache: "no-store" });
      const json = await res.json();
      if (json.success) setDocs(json.data ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
    // Light polling so status badges advance without manual refresh.
    const id = setInterval(reload, 3_000);
    return () => clearInterval(id);
  }, [reload]);

  const remove = async (id: string) => {
    const ok = await confirmDialog({
      title: "Delete document?",
      message: "This document and all of its indexed chunks will be permanently removed. This action cannot be undone.",
      confirmLabel: "Delete",
      variant: "danger",
    });
    if (!ok) return;
    const res = await fetch(`/api/knowledge/${id}`, { method: "DELETE" });
    const json = await res.json();
    if (!json.success) {
      showToast(json.error?.message ?? "Delete failed", "err");
      return;
    }
    showToast("Document deleted");
    setDocs((prev) => prev.filter((d) => d.id !== id));
  };

  const reindex = async (id: string) => {
    const res = await fetch(`/api/knowledge/${id}/reindex`, { method: "POST" });
    const json = await res.json();
    if (!json.success) {
      showToast(json.error?.message ?? "Re-index failed", "err");
      return;
    }
    showToast("Re-indexing started");
    reload();
  };

  return (
    <>
      <div className="kb-grid">
        <UploadForm onUploaded={reload} />

        <section aria-label="Documents">
          <div className="card" style={{ padding: "12px 16px", marginBottom: 12 }}>
            <strong>{docs.length}</strong> document{docs.length === 1 ? "" : "s"}
            {loading ? " · loading…" : ""}
          </div>

          {docs.length === 0 && !loading ? (
            <div className="kb-item" style={{ textAlign: "center", color: "var(--muted)" }}>
              No documents yet. Add one on the left to ground the bot.
            </div>
          ) : (
            <div className="kb-list">
              {docs.map((doc) => (
                <article key={doc.id} className="kb-item">
                  <div className="top">
                    <div>
                      <div className="title">{doc.title}</div>
                      <div className="meta">
                        {doc.sourceType.toUpperCase()} ·{" "}
                        {doc.chunkCount} chunk{doc.chunkCount === 1 ? "" : "s"} ·{" "}
                        {new Date(doc.createdAt).toLocaleString()}
                      </div>
                      {doc.errorMsg ? (
                        <div className="meta" style={{ color: "var(--red)" }}>
                          Error: {doc.errorMsg}
                        </div>
                      ) : null}
                      {doc.sourceUrl ? (
                        <div className="meta">
                          <a href={doc.sourceUrl} target="_blank" rel="noopener noreferrer">
                            {doc.sourceUrl}
                          </a>
                        </div>
                      ) : null}
                    </div>
                    <span className={`status-badge ${doc.status}`}>{doc.status}</span>
                  </div>
                  <div className="actions">
                    <button className="ghost" onClick={() => reindex(doc.id)}>
                      Re-index
                    </button>
                    <button className="danger" onClick={() => remove(doc.id)}>
                      Delete
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
      <ToastHost />
    </>
  );
}
