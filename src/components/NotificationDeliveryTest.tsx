"use client";

import { useState } from "react";

type DeliveryResult = {
  delivered?: boolean;
  attempts?: number;
  reason?: string;
  status?: number;
  providerBody?: string;
};

export default function NotificationDeliveryTest() {
  const [attempts, setAttempts] = useState("3");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DeliveryResult | null>(null);
  const [error, setError] = useState("");

  async function testDelivery() {
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const response = await fetch("/api/v1/notifications/test-delivery", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: "OnTyme delivery test",
          body: "This is a temporary notification delivery diagnostic.",
          href: "/notifications",
          attempts: Number(attempts),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok && !data?.data) throw new Error(data?.error ?? `Request failed (${response.status})`);
      setResult(data.data ?? data);
    } catch (testError) {
      setError(testError instanceof Error ? testError.message : "Delivery test failed");
    } finally {
      setLoading(false);
    }
  }

  return <section className="card" style={{ marginTop: 18 }}>
    <div className="sectionTitle" style={{ marginBottom: 10 }}>
      <div><p className="eyebrow">Delivery diagnostics</p><h2>Test notification delivery</h2></div>
    </div>
    <p style={{ color: "var(--color-text-secondary)", fontSize: 13 }}>
      Sends a temporary test notification and retries it when delivery fails. The result includes the provider’s exact response.
    </p>
    <div style={{ display: "flex", gap: 10, alignItems: "end", flexWrap: "wrap", marginTop: 12 }}>
      <label style={{ display: "grid", gap: 5, fontSize: 13 }}>
        Retry attempts
        <select value={attempts} onChange={(event) => setAttempts(event.target.value)} disabled={loading}>
          {[1, 2, 3, 4, 5].map((value) => <option key={value} value={value}>{value}</option>)}
        </select>
      </label>
      <button type="button" className="button primary" onClick={testDelivery} disabled={loading}>
        {loading ? "Testing…" : "Run delivery test"}
      </button>
    </div>
    {error && <pre style={{ whiteSpace: "pre-wrap", color: "var(--color-danger, #b42318)", marginTop: 14 }}>{error}</pre>}
    {result && <pre style={{ whiteSpace: "pre-wrap", overflowX: "auto", marginTop: 14, padding: 12, borderRadius: 8, background: "var(--color-surface-secondary, #f5f5f5)" }}>{JSON.stringify(result, null, 2)}</pre>}
  </section>;
}
