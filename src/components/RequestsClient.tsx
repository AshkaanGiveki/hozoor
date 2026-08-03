"use client";

import { useState } from "react";
import { formatJalaliDate } from "@/lib/date-format";
import styles from "./RequestsClient.module.scss";
import SelectField from "./SelectField";
import JalaliDatePicker from "./JalaliDatePicker";

const timeToMinutes = (value: unknown) => {
  const [hours, minutes] = String(value || "0:0").split(":").map(Number);
  return hours * 60 + minutes;
};

type Props = { types: { id: string; name: string; unit: string }[]; initial: { leave: unknown[]; offtime: unknown[]; correction: unknown[] } };
const labels: Record<string, string> = { SUBMITTED: "ثبت‌شده", PENDING_MANAGER: "در انتظار مدیر", PENDING_ADMIN: "در انتظار منابع انسانی", APPROVED: "تأییدشده", REJECTED: "ردشده", CANCELLED: "لغوشده" };

export default function RequestsClient({ types, initial }: Props) {
  const [kind, setKind] = useState<"leave" | "offtime" | "correction">("leave");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [data] = useState(initial);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    const form = new FormData(event.currentTarget);
    const body = kind === "leave"
      ? { kind, leaveTypeId: form.get("leaveTypeId"), startDate: form.get("startDate"), endDate: form.get("endDate"), requestedMinutes: Number(form.get("requestedMinutes")), reason: form.get("reason") }
      : kind === "offtime"
        ? { kind, date: form.get("date"), startMinutes: timeToMinutes(form.get("startMinutes")), endMinutes: timeToMinutes(form.get("endMinutes")), reason: form.get("reason") }
        : { kind, date: form.get("date"), proposedIn: form.get("proposedIn") || undefined, proposedOut: form.get("proposedOut") || undefined, reason: form.get("reason") };

    try {
      const response = await fetch("/api/v1/requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok) { setMessage(result.error?.message || "ثبت درخواست انجام نشد."); return; }
      setMessage("درخواست شما با موفقیت ثبت شد.");
      event.currentTarget.reset();
    } finally { setSubmitting(false); }
  }

  const rows: Array<Record<string, any>> = [
    ...(data.leave as Array<Record<string, unknown>>).map((item) => ({ ...item, title: String((item.leaveType as { name?: string })?.name || "مرخصی") })),
    ...(data.offtime as Array<Record<string, unknown>>).map((item) => ({ ...item, title: "خروج ساعتی" })),
    ...(data.correction as Array<Record<string, unknown>>).map((item) => ({ ...item, title: "اصلاح تردد" })),
  ];

  return <>
    <div className="sectionTitle">
      <div><p className="eyebrow">چرخهٔ درخواست</p><h1>درخواست‌های من</h1><p>ثبت و پیگیری مرخصی، خروج ساعتی و اصلاح تردد</p></div>
      <div className={styles.titleBadge}><span className={styles.titleBadgeDot}/>پیگیری شفاف درخواست‌ها</div>
    </div>
    <div className={styles.layout}>
      <section className="card">
        <div className={styles.formIntro}><span className={styles.formIcon}>＋</span><div><h3>درخواست جدید</h3><p>اطلاعات را وارد کنید تا برای بررسی ارسال شود.</p></div></div>
        <div className={styles.tabs} role="tablist" aria-label="نوع درخواست">
          {[["leave", "مرخصی"], ["offtime", "خروج ساعتی"], ["correction", "اصلاح تردد"]].map(([id, label]) => <button type="button" role="tab" aria-selected={kind === id} key={id} className={kind === id ? styles.selected : ""} onClick={() => { setKind(id as typeof kind); setMessage(""); }}>{label}</button>)}
        </div>
        <form className="stack" onSubmit={submit}>
          {kind === "leave" && <>
            <label>نوع مرخصی<SelectField name="leaveTypeId" required placeholder="انتخاب نوع مرخصی" options={types.map((type) => ({ value: type.id, label: `${type.name} (${type.unit === "DAY" ? "روزانه" : "ساعتی"})` }))} /></label>
            <div className={styles.two}><label>از تاریخ<JalaliDatePicker name="startDate" required/></label><label>تا تاریخ<JalaliDatePicker name="endDate" required/></label></div>
            <label>مدت درخواست <span className="hint">(دقیقه)</span><input type="number" name="requestedMinutes" min="1" placeholder="مثال: ۴۸۰" required/></label>
          </>}
          {kind === "offtime" && <>
            <label>تاریخ<JalaliDatePicker name="date" required/></label>
            <div className={styles.two}><label>از ساعت<input type="time" name="startMinutes" required/></label><label>تا ساعت<input type="time" name="endMinutes" required/></label></div>
          </>}
          {kind === "correction" && <>
            <label>روز موردنظر<JalaliDatePicker name="date" required/></label>
            <div className={styles.two}><label>ورود صحیح<JalaliDatePicker name="proposedIn" withTime/></label><label>خروج صحیح<JalaliDatePicker name="proposedOut" withTime/></label></div>
          </>}
          <label>دلیل درخواست<textarea name="reason" required placeholder="شرح کوتاه دلیل را بنویسید"/></label>
          {message && <div className="alert success" role="status">{message}</div>}
          <button className="button primary" disabled={submitting}>{submitting ? "در حال ثبت درخواست…" : "ثبت درخواست"}</button>
        </form>
      </section>
      <section className="card">
        <div className="cardHead"><div><h3>تاریخچهٔ درخواست‌ها</h3><p>آخرین وضعیت درخواست‌های ثبت‌شده</p></div><span className={styles.count}>{rows.length} مورد</span></div>
        <div className={styles.list}>{rows.length ? rows.map((row) => <div className={styles.item} key={String(row.id)}><div><strong>{row.title}</strong><small>{row.createdAt ? formatJalaliDate(String(row.createdAt)) : "—"}</small></div><span className={`status ${String(row.status).toLowerCase()}`}>{labels[String(row.status)] || String(row.status)}</span></div>) : <div className="empty">هنوز درخواستی ثبت نشده است.</div>}</div>
      </section>
    </div>
  </>;
}
