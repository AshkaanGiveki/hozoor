"use client";

import { useEffect, useState } from "react";

type Schedule = { id: string; name: string; description?: string | null; active: boolean; shifts: Array<{ name: string; startMinutes: number; endMinutes: number }> };

export default function SchedulesPage() {
  const [rows, setRows] = useState<Schedule[]>([]);
  const [message, setMessage] = useState("");
  async function load() { const response = await fetch("/api/v1/schedules"); const result = await response.json(); if (response.ok) setRows(result.data); }
  useEffect(() => { void load(); }, []);
  async function submit(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); const response = await fetch("/api/v1/schedules", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: form.get("name"), description: form.get("description"), shifts: [{ name: "پیش‌فرض", startMinutes: Number(form.get("startMinutes")), endMinutes: Number(form.get("endMinutes")), overnight: false }] }) }); const result = await response.json(); setMessage(response.ok ? "برنامه کاری ایجاد شد." : result.error?.message || "ایجاد برنامه کاری ناموفق بود."); if (response.ok) { setRows([...rows, result.data]); event.currentTarget.reset(); } }
  return <><div className="sectionTitle"><div><p className="eyebrow">پیکربندی سازمان</p><h1>برنامه‌های کاری</h1><p>ساعات کار و شیفت‌های مورد استفاده در محاسبه حضور را تعریف کنید.</p></div></div><div className="layout"><form className="card stack" onSubmit={submit}><h3>ایجاد برنامه کاری</h3><label>نام<input name="name" required /></label><label>توضیحات<input name="description" /></label><div className="two"><label>دقیقه شروع<input name="startMinutes" type="number" min="0" max="1439" defaultValue="540" required /></label><label>دقیقه پایان<input name="endMinutes" type="number" min="1" max="1440" defaultValue="1020" required /></label></div>{message && <div className="alert success">{message}</div>}<button className="button primary">ایجاد برنامه کاری</button></form><section className="card"><h3>برنامه‌های کاری</h3>{rows.length ? rows.map((row) => <article key={row.id} style={{ padding: "14px 0", borderBottom: "1px solid var(--color-border-secondary)" }}><strong>{row.name}</strong><p>{row.description || "توضیحی ثبت نشده است"}</p><small>{row.shifts.map((shift) => `${shift.name}: ${shift.startMinutes}–${shift.endMinutes}`).join(" · ")}</small></article>) : <div className="empty">هنوز برنامه کاری ثبت نشده است.</div>}</section></div></>;
}
