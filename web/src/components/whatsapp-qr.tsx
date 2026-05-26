"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface QrData {
  status: "waiting" | "ready" | "connected";
  qrImage: string | null;
}

export function WhatsAppQr() {
  const [data, setData] = useState<QrData>({ status: "waiting", qrImage: null });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchQr = useCallback(async () => {
    try {
      const res = await fetch("/api/qr", { cache: "no-store" });
      const json: QrData = await res.json();
      setData(json);
    } catch {
      // ignore — next tick will retry
    }
  }, []);

  // Always poll while the page is open. The interval is cheap (one Redis
  // GET on the server) and ensures the badge tracks reality even after
  // reconnects, logout/relink, or background drops.
  useEffect(() => {
    fetchQr();
    intervalRef.current = setInterval(fetchQr, 3000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchQr]);

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
      ) : (
        <>
          <div className="spinner" />
          <p className="hint">Waiting for QR code…</p>
        </>
      )}

      <div className="row" style={{ justifyContent: "center" }}>
        <button className="primary" onClick={fetchQr}>
          {data.status === "connected" ? "Refresh status" : "Refresh"}
        </button>
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
