"use client";

import { useEffect, useState } from "react";

type Policy = { id: string; evidenceType: string; retentionDays: number; archiveAfterDays: number | null; legalBasis: string; active: boolean };

export default function PayrollRetentionPolicy() {
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [message, setMessage] = useState("");
  useEffect(() => { void fetch("/api/v1/payroll/retention").then((response) => response.json()).then((result) => setPolicy((result.data || []).find((item: Policy) => item.evidenceType === "payroll") || null)); }, []);
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = Object.fromEntries(new FormData(event.currentTarget));
    const response = await fetch("/api/v1/payroll/retention", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ evidenceType: "payroll", retentionDays: Number(input.retentionDays), archiveAfterDays: input.archiveAfterDays ? Number(input.archiveAfterDays) : null, legalBasis: input.legalBasis, active: true }) });
    const result = await response.json();
    setMessage(response.ok ? "Payroll retention policy saved." : result.error?.message || "Could not save retention policy.");
    if (response.ok) setPolicy(result.data);
  }
  return <section className="card"><h2>Payroll evidence retention</h2><p className="muted">Archiving is available only after the company records its legally approved retention period and basis.</p><form className="stack" onSubmit={save}><div className="two"><label>Retention days<input name="retentionDays" type="number" min="1" max="36500" defaultValue={policy?.retentionDays || ""} required /></label><label>Archive after days<input name="archiveAfterDays" type="number" min="0" max="36499" defaultValue={policy?.archiveAfterDays ?? ""} /></label></div><label>Legal basis / approved policy<input name="legalBasis" defaultValue={policy?.legalBasis || ""} required /></label><button className="button secondary">Save retention policy</button></form>{message && <p className="muted">{message}</p>}{policy && <p className="muted">Current policy: {policy.retentionDays} days · {policy.active ? "Active" : "Inactive"}</p>}</section>;
}
