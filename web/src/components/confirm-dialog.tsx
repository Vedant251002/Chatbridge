"use client";

import { useEffect, useRef, useState } from "react";

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "warning" | "primary";
}

interface PendingConfirm extends ConfirmOptions {
  resolve: (ok: boolean) => void;
  key: number;
}

let setExternal: ((s: PendingConfirm | null) => void) | null = null;

/**
 * Promise-based replacement for `window.confirm`.
 * Renders an attractive modal via <ConfirmHost />.
 */
export function confirmDialog(opts: ConfirmOptions): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    if (!setExternal) {
      // Host not mounted — fall back to native so callers never hang.
      resolve(typeof window !== "undefined" ? window.confirm(opts.message) : false);
      return;
    }
    setExternal({ ...opts, resolve, key: Date.now() });
  });
}

export function ConfirmHost() {
  const [state, setState] = useState<PendingConfirm | null>(null);
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setExternal = setState;
    return () => {
      setExternal = null;
    };
  }, []);

  // Focus the confirm button & enable Esc / Enter shortcuts when open.
  useEffect(() => {
    if (!state) return;

    const id = window.setTimeout(() => confirmBtnRef.current?.focus(), 30);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        decide(false);
      } else if (e.key === "Enter") {
        e.preventDefault();
        decide(true);
      }
    };
    window.addEventListener("keydown", onKey);

    // Lock body scroll while the modal is open.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.clearTimeout(id);
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.key]);

  const decide = (ok: boolean) => {
    if (!state) return;
    state.resolve(ok);
    setState(null);
  };

  if (!state) return null;

  const variant = state.variant ?? "danger";
  const title = state.title ?? (variant === "danger" ? "Are you sure?" : "Confirm");

  return (
    <div
      className="confirm-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) decide(false);
      }}
    >
      <div className={`confirm-card confirm-${variant}`}>
        <div className="confirm-icon" aria-hidden="true">
          {variant === "danger" ? "!" : variant === "warning" ? "?" : "i"}
        </div>
        <h3 id="confirm-title" className="confirm-title">
          {title}
        </h3>
        <p className="confirm-message">{state.message}</p>
        <div className="confirm-actions">
          <button type="button" className="ghost" onClick={() => decide(false)}>
            {state.cancelLabel ?? "Cancel"}
          </button>
          <button
            type="button"
            ref={confirmBtnRef}
            className={variant === "primary" ? "primary" : variant}
            onClick={() => decide(true)}
          >
            {state.confirmLabel ?? (variant === "danger" ? "Delete" : "Confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}
