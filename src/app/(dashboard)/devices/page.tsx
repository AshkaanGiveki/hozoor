"use client";

import { useEffect, useState } from "react";

type Device = { id: string; name: string; type: string; timezone: string; active: boolean; mappings: Array<{ id: string; externalId: string; employee: { firstName: string; lastName: string; employeeCode: string } }> };

export default function DevicesPage() {
  const [rows, setRows] = useState<Device[]>([]);
  const [message, setMessage] = useState("");
  async function load() { const response = await fetch("/api/v1/devices"); const result = await response.json(); if (response.ok) setRows(result.data); }
  useEffect(() => { void load(); }, []);
  async function submit(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); const response = await fetch("/api/v1/devices", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.fromEntries(form)) }); const result = await response.json(); setMessage(response.ok ? "Device created." : result.error?.message || "Device creation failed."); if (response.ok) { setRows([...rows, result.data]); event.currentTarget.reset(); } }
  return <><div className="sectionTitle"><div><p className="eyebrow">Attendance sources</p><h1>Devices</h1><p>Register attendance devices and review their employee mappings.</p></div></div><div className="layout"><form className="card stack" onSubmit={submit}><h3>Add device</h3><label>Name<input name="name" required /></label><label>Type<input name="type" defaultValue="generic-csv" required /></label><label>Timezone<input name="timezone" defaultValue="Asia/Tehran" required /></label>{message && <div className="alert success">{message}</div>}<button className="button primary">Add device</button></form><section className="card"><h3>Registered devices</h3>{rows.length ? rows.map((row) => <article key={row.id} style={{ padding: "14px 0", borderBottom: "1px solid var(--color-border-secondary)" }}><strong>{row.name}</strong><p>{row.type} · {row.timezone}</p><small>{row.mappings.length} employee mappings</small></article>) : <div className="empty">No devices yet.</div>}</section></div></>;
}
