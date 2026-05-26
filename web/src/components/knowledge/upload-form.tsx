"use client";

import { useState } from "react";
import { showToast } from "../toast";

type Mode = "file" | "text" | "markdown" | "url";

interface Props {
  onUploaded: () => void;
}

export function UploadForm({ onUploaded }: Props) {
  const [mode, setMode] = useState<Mode>("file");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      let res: Response;
      if (mode === "file") {
        if (!file) {
          showToast("Choose a file first", "err");
          return;
        }
        const fd = new FormData();
        fd.append("file", file);
        if (title.trim()) fd.append("title", title.trim());
        res = await fetch("/api/knowledge/upload", { method: "POST", body: fd });
      } else {
        if (!title.trim()) {
          showToast("Title is required", "err");
          return;
        }
        const payload =
          mode === "url"
            ? { sourceType: "url", title, sourceUrl: url }
            : { sourceType: mode, title, sourceText: body };
        res = await fetch("/api/knowledge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      const json = await res.json();
      if (!json.success) {
        const fields = json.error?.fields;
        const msg = fields
          ? Object.entries(fields)
              .map(([k, v]) => `${k}: ${(v as string[]).join(", ")}`)
              .join("; ")
          : json.error?.message;
        showToast(msg ?? "Upload failed", "err");
        return;
      }
      showToast("Document queued for indexing");
      setTitle("");
      setBody("");
      setUrl("");
      setFile(null);
      onUploaded();
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card" aria-label="Add document">
      <h2>Add document</h2>

      <div className="field">
        <label htmlFor="kb-mode">Source type</label>
        <select
          id="kb-mode"
          value={mode}
          onChange={(e) => setMode(e.target.value as Mode)}
        >
          <option value="file">PDF / text file</option>
          <option value="text">Plain text (paste)</option>
          <option value="markdown">Markdown (paste)</option>
          <option value="url">URL</option>
        </select>
      </div>

      {mode === "file" && (
        <div className="field" key="file-field">
          <label htmlFor="kb-file">File (PDF, TXT, MD)</label>
          <input
            id="kb-file"
            type="file"
            accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown"
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              setFile(f);
              if (f && !title) setTitle(f.name.replace(/\.[^.]+$/, ""));
            }}
          />
          {file ? (
            <p className="hint">
              {file.name} · {Math.round(file.size / 1024)} KB
            </p>
          ) : (
            <p className="hint">Up to 20 MB. PDFs are text-extracted before chunking.</p>
          )}
        </div>
      )}

      <div className="field" key="title-field">
        <label htmlFor="kb-title">
          {mode === "file" ? "Title (optional)" : "Title"}
        </label>
        <input
          id="kb-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={
            mode === "file" ? "Defaults to the file name" : "e.g. Refund policy"
          }
          maxLength={200}
        />
      </div>

      {mode === "url" && (
        <div className="field" key="url-field">
          <label htmlFor="kb-url">URL</label>
          <input
            id="kb-url"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/policy"
          />
          <p className="hint">
            The page is fetched once during indexing. JS-rendered content may not be captured.
          </p>
        </div>
      )}

      {(mode === "text" || mode === "markdown") && (
        <div className="field" key="body-field">
          <label htmlFor="kb-body">Content</label>
          <textarea
            id="kb-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={
              mode === "markdown"
                ? "Paste markdown content"
                : "Paste plain text content"
            }
          />
        </div>
      )}

      <div className="row">
        <button className="primary" onClick={submit} disabled={busy}>
          {busy ? "Uploading…" : "Add document"}
        </button>
      </div>
    </section>
  );
}
