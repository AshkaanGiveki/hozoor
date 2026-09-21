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
    setMessage(response.ok ? "سیاست نگهداری اسناد حقوقی ذخیره شد." : result.error?.message || "ذخیره سیاست نگهداری ناموفق بود.");
    if (response.ok) setPolicy(result.data);
  }
  return <section className="card"><h2>نگهداری اسناد حقوقی</h2><p className="muted">بایگانی فقط پس از ثبت مدت و مبنای قانونی تأییدشده شرکت فعال می‌شود.</p><form className="stack" onSubmit={save}><div className="two"><label>مدت نگهداری به روز<input name="retentionDays" type="number" min="1" max="36500" defaultValue={policy?.retentionDays || ""} required /></label><label>بایگانی پس از چند روز<input name="archiveAfterDays" type="number" min="0" max="36499" defaultValue={policy?.archiveAfterDays ?? ""} /></label></div><label>مبنای قانونی / سیاست تأییدشده<input name="legalBasis" defaultValue={policy?.legalBasis || ""} required /></label><button className="button secondary">ذخیره سیاست نگهداری</button></form>{message && <p className="muted">{message}</p>}{policy && <p className="muted">سیاست فعلی: {policy.retentionDays} روز · {policy.active ? "فعال" : "غیرفعال"}</p>}</section>;
}
