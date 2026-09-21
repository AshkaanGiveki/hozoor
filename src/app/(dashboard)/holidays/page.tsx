"use client";

import { useEffect, useState } from "react";

type Holiday = { id: string; date: string; title: string };

export default function HolidaysPage() {
  const [rows, setRows] = useState<Holiday[]>([]);
  const [message, setMessage] = useState("");
  async function load() { const response = await fetch("/api/v1/holidays"); const result = await response.json(); if (response.ok) setRows(result.data); }
  useEffect(() => { void load(); }, []);
  async function submit(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); const response = await fetch("/api/v1/holidays", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ date: form.get("date"), title: form.get("title"), calendarYear: form.get("calendarYear") ? Number(form.get("calendarYear")) : null, version: Number(form.get("version") || 1), sourceReference: form.get("sourceReference") || null, isOfficial: form.get("isOfficial") === "on" }) }); const result = await response.json(); setMessage(response.ok ? "Holiday added." : result.error?.message || "Holiday creation failed."); if (response.ok) { setRows([...rows, result.data]); event.currentTarget.reset(); } }
  async function remove(id: string) { const response = await fetch(`/api/v1/holidays/${id}`, { method: "DELETE" }); if (response.ok) setRows(rows.filter((row) => row.id !== id)); }
  return <><div className="sectionTitle"><div><p className="eyebrow">Workforce configuration</p><h1>Holidays</h1><p>Manage company holidays used by attendance calculations.</p></div></div><div className="layout"><form className="card stack" onSubmit={submit}><h3>Add holiday</h3><label>Date<input name="date" type="date" required /></label><label>Title<input name="title" required /></label><label>Persian calendar year<input name="calendarYear" type="number" min="1300" max="1600" placeholder="Optional" /></label><div className="two"><label>Table version<input name="version" type="number" min="1" defaultValue="1" required /></label><label>Source reference<input name="sourceReference" placeholder="Official circular/source" /></label></div><label><input name="isOfficial" type="checkbox" /> Official holiday table entry</label>{message && <div className="alert success">{message}</div>}<button className="button primary">Add holiday</button></form><section className="card"><h3>Company holidays</h3>{rows.length ? rows.map((row) => <article key={row.id} style={{ display: "flex", justifyContent: "space-between", padding: "14px 0", borderBottom: "1px solid var(--color-border-secondary)" }}><div><strong>{row.title}</strong><p>{row.date.slice(0, 10)}</p></div><button className="button danger" type="button" onClick={() => remove(row.id)}>Delete</button></article>) : <div className="empty">No holidays yet.</div>}</section></div></>;
}
