"use client";

import { useState } from "react";
import { formatJalaliDateTime } from "@/lib/date-format";
import styles from "./ApprovalsClient.module.scss";

type Props = { initial: { leave: unknown[]; offtime: unknown[]; correction: unknown[] } };
const statusText = (status: string) => status === "APPROVED" ? "تأیید شد" : "رد شد";

export default function ApprovalsClient({ initial }: Props) {
  const [rows, setRows] = useState(initial);
  const [message, setMessage] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const all: Array<Record<string, any>> = [
    ...(rows.leave as Array<Record<string, unknown>>).map((item) => ({ ...item, type: "leave", label: "مرخصی", title: String((item.leaveType as { name?: string })?.name || "مرخصی") })),
    ...(rows.offtime as Array<Record<string, unknown>>).map((item) => ({ ...item, type: "offtime", label: "خروج ساعتی", title: "خروج ساعتی" })),
    ...(rows.correction as Array<Record<string, unknown>>).map((item) => ({ ...item, type: "correction", label: "اصلاح تردد", title: "اصلاح تردد" })),
  ];

  async function decide(id: string, type: string, approved: boolean) {
    if (busyId) return;
    setBusyId(id);
    try {
      const response = await fetch("/api/v1/approvals", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, type, approved, comment: approved ? "تأیید شد" : "اطلاعات برای بررسی بیشتر کافی نیست" }) });
      const result = await response.json();
      if (!response.ok) { setMessage(result.error?.message || "ثبت تصمیم ناموفق بود."); return; }
      setMessage(statusText(result.data.status));
      setRows({ leave: rows.leave.filter((item: any) => item.id !== id), offtime: rows.offtime.filter((item: any) => item.id !== id), correction: rows.correction.filter((item: any) => item.id !== id) });
    } finally { setBusyId(null); }
  }

  return <>
    <div className="sectionTitle"><div><p className="eyebrow">مدیریت چرخهٔ تأیید</p><h1>مرکز درخواست‌ها</h1><p>درخواست‌های کارکنان را در حوزهٔ مجاز خود بررسی و تعیین تکلیف کنید.</p></div><span className={styles.queueBadge}>{all.length} درخواست در صف</span></div>
    <div className="card">{message && <div className="alert success" role="status">{message}</div>}{all.length ? <div className={styles.list}>{all.map((row) => <div className={styles.request} key={String(row.id)}><div className={styles.info}><span className={styles.type}>{row.label}</span><strong>{row.title}</strong><p>{(row.employee as { firstName?: string; lastName?: string })?.firstName} {(row.employee as { lastName?: string })?.lastName} <span>·</span> {row.reason as string}</p><small>{row.createdAt ? formatJalaliDateTime(String(row.createdAt)) : ""}</small></div><div className={styles.actions}><button className="button primary" disabled={Boolean(busyId)} onClick={() => decide(String(row.id), String(row.type), true)}>{busyId === String(row.id) ? "در حال ثبت…" : "تأیید"}</button><button className="button secondary" disabled={Boolean(busyId)} onClick={() => decide(String(row.id), String(row.type), false)}>رد کردن</button></div></div>)}</div> : <div className={styles.emptyQueue}><div className={styles.emptyIcon}>✓</div><h3>صف درخواست‌ها خالی است</h3><p>در حال حاضر درخواست معوقی برای بررسی وجود ندارد.</p></div>}</div>
  </>;
}
