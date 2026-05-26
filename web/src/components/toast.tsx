"use client";

import { useEffect, useState } from "react";

interface ToastState {
  message: string;
  type: "ok" | "err";
  key: number;
}

let setExternal: ((s: ToastState | null) => void) | null = null;

export function showToast(message: string, type: "ok" | "err" = "ok") {
  setExternal?.({ message, type, key: Date.now() });
}

export function ToastHost() {
  const [state, setState] = useState<ToastState | null>(null);

  useEffect(() => {
    setExternal = setState;
    return () => {
      setExternal = null;
    };
  }, []);

  useEffect(() => {
    if (!state) return;
    const t = setTimeout(() => setState(null), 2500);
    return () => clearTimeout(t);
  }, [state]);

  if (!state) return null;
  return <div className={`toast show ${state.type}`}>{state.message}</div>;
}
