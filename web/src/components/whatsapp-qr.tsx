"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface QrData {
  status: "waiting" | "ready" | "connected";
  qrImage: string | null;
}

// Aggressive cadence used briefly after the admin asks for a fresh QR.
const ACTIVE_POLL_MS = 2_000;
const ACTIVE_POLL_WINDOW_MS = 30_000;
// Background cadence — keeps the badge honest without DOSing the API.
const IDLE_POLL_MS = 15_000;

export function WhatsAppQr() {
  const [data, setData] = useState<QrData>({ status: "waiting", qrImage: null });
  const [requesting, setRequesting] = useState(false);
  // True for ACTIVE_POLL_WINDOW_MS after the admin clicks Generate/Regenerate
  // so we poll quickly while Baileys spins up a fresh socket.
  const [activeWait, setActiveWait] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const activeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchQr = useCallback(async (): Promise<QrData | null> => {
    try {
      const res = await fetch("/api/qr", { cache: "no-store" });
      const json: QrData = await res.json();
      setData(json);
      return json;
    } catch {
      return null;
    }
  }, []);

  const requestQr = useCallback(async () => {
    setRequesting(true);
    setActiveWait(true);
    setData({ status: "waiting", qrImage: null });

    // Cap the high-frequency window so we don't hammer the API forever
    // if the backend never publishes a code (e.g. WhatsApp servers down).
    if (activeTimeoutRef.current) clearTimeout(activeTimeoutRef.current);
    activeTimeoutRef.current = setTimeout(() => {
      setActiveWait(false);
    }, ACTIVE_POLL_WINDOW_MS);

    try {
      await fetch("/api/qr", { method: "POST" });
      await fetchQr();
    } finally {
      setRequesting(false);
    }
  }, [fetchQr]);

  // One status check on mount.
  useEffect(() => {
    fetchQr();
    return () => {
      if (activeTimeoutRef.current) clearTimeout(activeTimeoutRef.current);
    };
  }, [fetchQr]);

  // Polling loop. Three cadences:
  //   • connected          → don't poll at all
  //   • activeWait || ready → ACTIVE_POLL_MS (admin is interacting)
  //   • otherwise           → IDLE_POLL_MS (just keeps the badge honest)
  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (data.status === "connected") {
      // Stop the spinner and back off entirely.
      setActiveWait(false);
      return;
    }
    // Stop active waiting once a code is on screen.
    if (data.status === "ready" && data.qrImage) {
      setActiveWait(false);
    }
    const cadence =
      activeWait || data.status === "ready" ? ACTIVE_POLL_MS : IDLE_POLL_MS;
    intervalRef.current = setInterval(fetchQr, cadence);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
    };
  }, [data.status, data.qrImage, activeWait, fetchQr]);

  return (
    <div className="card qr-box">
      <h2>
        WhatsApp link <span className={`status ${data.status}`}>{data.status}</span>
      </h2>

      {data.status === "connected" ? (
        <div style={{ padding: "40px 0" }}>
          <div style={{ fontSize: 48 }}>✅</div>
          <p>
            <strong>WhatsApp connected</strong>
          </p>
        </div>
      ) : data.status === "ready" && data.qrImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={data.qrImage} alt="WhatsApp QR code" />
      ) : requesting || activeWait ? (
        <>
          <div className="spinner" />
          <p className="hint">Generating QR…</p>
        </>
      ) : (
        <div style={{ padding: "32px 0" }}>
          <p className="hint" style={{ marginBottom: 16 }}>
            No QR code yet. Generate one when you&apos;re ready to scan.
          </p>
        </div>
      )}

      <div className="row" style={{ justifyContent: "center" }}>
        {data.status === "connected" ? (
          <button className="primary" onClick={fetchQr}>
            Refresh status
          </button>
        ) : data.status === "ready" ? (
          <button className="primary" onClick={requestQr} disabled={requesting}>
            Regenerate QR
          </button>
        ) : (
          <button className="primary" onClick={requestQr} disabled={requesting}>
            {requesting ? "Generating…" : "Generate QR"}
          </button>
        )}
      </div>

      <ol style={{ textAlign: "left", marginTop: 16 }}>
        <li>
          Open <strong>WhatsApp</strong> on your phone
        </li>
        <li>
          Tap <strong>⋮ Menu</strong> → <strong>Linked Devices</strong>
        </li>
        <li>
          Tap <strong>Link a Device</strong> and scan the code
        </li>
      </ol>
    </div>
  );
}
