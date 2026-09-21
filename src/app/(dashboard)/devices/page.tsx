"use client";

import { useEffect, useState } from "react";

type Device = { id: string; name: string; type: string; timezone: string; active: boolean; mappings: Array<{ id: string; externalId: string; employee: { firstName: string; lastName: string; employeeCode: string } }> };

export default function DevicesPage() {
  const [rows, setRows] = useState<Device[]>([]);
  const [message, setMessage] = useState("");
  async function load() { const response = await fetch("/api/v1/devices"); const result = await response.json(); if (response.ok) setRows(result.data); }
  useEffect(() => { void load(); }, []);
  async function submit(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); const response = await fetch("/api/v1/devices", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.fromEntries(form)) }); const result = await response.json(); setMessage(response.ok ? "دستگاه ایجاد شد." : result.error?.message || "ایجاد دستگاه ناموفق بود."); if (response.ok) { setRows([...rows, result.data]); event.currentTarget.reset(); } }
  return <><div className="sectionTitle"><div><p className="eyebrow">منابع ثبت تردد</p><h1>دستگاه‌ها</h1><p>دستگاه‌های حضور و اتصال کارکنان به آن‌ها را مدیریت کنید.</p></div></div><div className="layout"><form className="card stack" onSubmit={submit}><h3>افزودن دستگاه</h3><label>نام<input name="name" required /></label><label>نوع<input name="type" defaultValue="generic-csv" required dir="ltr" /></label><label>منطقه زمانی<input name="timezone" defaultValue="Asia/Tehran" required dir="ltr" /></label>{message && <div className="alert success">{message}</div>}<button className="button primary">افزودن دستگاه</button></form><section className="card"><h3>دستگاه‌های ثبت‌شده</h3>{rows.length ? rows.map((row) => <article key={row.id} style={{ padding: "14px 0", borderBottom: "1px solid var(--color-border-secondary)" }}><strong>{row.name}</strong><p>{row.type} · {row.timezone}</p><small>{row.mappings.length} اتصال کارمند</small></article>) : <div className="empty">هنوز دستگاهی ثبت نشده است.</div>}</section></div></>;
}
