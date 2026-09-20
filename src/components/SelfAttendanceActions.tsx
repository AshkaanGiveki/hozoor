"use client";

import { useState } from "react";

export default function SelfAttendanceActions() {
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");
  async function record(action: "IN" | "OUT") { if (busy) return; setBusy(true); setMessage(""); const send = (position?: GeolocationPosition) => fetch("/api/v1/self-attendance", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, latitude: position?.coords.latitude, longitude: position?.coords.longitude, accuracy: position?.coords.accuracy }) }).then((response) => response.json().then((result) => { setMessage(response.ok ? (action === "IN" ? "Check-in recorded." : "Check-out recorded.") : result.error?.message || "Attendance event failed."); })); try { if (navigator.geolocation) navigator.geolocation.getCurrentPosition((position) => void send(position), () => void send(), { enableHighAccuracy: true, timeout: 5000 }); else await send(); } finally { setBusy(false); } }
  return <div style={{ display: "flex", gap: 8, alignItems: "center" }}><button className="button secondary" type="button" disabled={busy} onClick={() => void record("IN")}>Check in</button><button className="button primary" type="button" disabled={busy} onClick={() => void record("OUT")}>Check out</button>{message && <small role="status">{message}</small>}</div>;
}
