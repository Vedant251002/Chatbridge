"use client";

import { useEffect, useState } from "react";
import { confirmDialog } from "./confirm-dialog";
import { showToast, ToastHost } from "./toast";

interface AllowedNumber {
  id: string;
  phone: string;
  label: string | null;
  createdAt: string;
}

export function AllowedNumbersManager() {
  const [items, setItems] = useState<AllowedNumber[]>([]);
  const [phone, setPhone] = useState("");
  const [label, setLabel] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/allowed-numbers", { cache: "no-store" });
      const json = await res.json();
      setItems(json.data ?? []);
    } catch {
      showToast("Failed to load allowlist", "err");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = phone.trim();
    if (!trimmed) {
      showToast("Phone is required", "err");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/allowed-numbers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: trimmed, label: label.trim() || null }),
      });
      const json = await res.json();
      if (!json.success) {
        showToast(json.error?.message ?? "Failed to add number", "err");
        return;
      }
      setPhone("");
      setLabel("");
      showToast("Number added");
      await load();
    } catch {
      showToast("Failed to add number", "err");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string, displayPhone: string) => {
    const ok = await confirmDialog({
      title: "Remove number?",
      message: `${displayPhone} will be removed from your allowlist. The AI will stop replying to this number.`,
      confirmLabel: "Remove",
      variant: "danger",
    });
    if (!ok) return;
    try {
      const res = await fetch(`/api/allowed-numbers/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!json.success) {
        showToast(json.error?.message ?? "Failed to remove", "err");
        return;
      }
      showToast("Number removed");
      await load();
    } catch {
      showToast("Failed to remove", "err");
    }
  };

  return (
    <>
      <div className="card">
        <h2>Allowed numbers</h2>
        <p className="hint">
          The AI replies only to numbers you have added here. Each user keeps
          their own list — what you add isn&apos;t visible to other admins.
        </p>

        <form onSubmit={add} className="row" style={{ flexWrap: "wrap", gap: 8 }}>
          <input
            type="tel"
            placeholder="+15551234567"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            aria-label="Phone number"
            required
            style={{ flex: "1 1 180px" }}
          />
          <input
            type="text"
            placeholder="Label (optional)"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            aria-label="Label"
            maxLength={100}
            style={{ flex: "1 1 160px" }}
          />
          <button type="submit" className="primary" disabled={saving}>
            {saving ? "Adding…" : "Add"}
          </button>
        </form>

        <div style={{ marginTop: 16 }}>
          {loading ? (
            <p className="hint">Loading…</p>
          ) : items.length === 0 ? (
            <p className="hint">No numbers yet — AI is silent for everyone.</p>
          ) : (
            <ul className="allow-list">
              {items.map((item) => (
                <li key={item.id} className="allow-item">
                  <div>
                    <div className="allow-phone">{item.phone}</div>
                    {item.label && <div className="allow-label">{item.label}</div>}
                  </div>
                  <button
                    className="ghost"
                    onClick={() => remove(item.id, item.phone)}
                    aria-label={`Remove ${item.phone}`}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <ToastHost />
    </>
  );
}
