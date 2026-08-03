"use client";

import { useState, type FormEvent } from "react";
import JalaliDatePicker from "./JalaliDatePicker";
import SelectField from "./SelectField";
import styles from "./PolicyForm.module.scss";

export default function PolicyForm() {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try {
    const response = await fetch("/api/v1/policies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...data,
        minimumDailyMinutes: Number(data.minimumDailyMinutes),
        startMinutes: Number(data.startMinutes),
        endMinutes: Number(data.endMinutes),
        flexibleEntryUntil: Number(data.flexibleEntryUntil),
        requiredMinutes: Number(data.requiredMinutes),
      }),
    });
    const result = await response.json();
    setMessage(response.ok ? "نسخه جدید قانون فعال شد." : result.error?.message || "ثبت قانون انجام نشد.");
    if (response.ok) event.currentTarget.reset();
    } finally { setLoading(false); }
  }

  return (
    <form className={styles.form} onSubmit={submit}>
      <div className={styles.formGrid}>
        <label>
          نام قانون
          <input name="name" defaultValue="قانون استاندارد" required />
        </label>
        <label>
          تاریخ اثر
          <JalaliDatePicker name="effectiveFrom" required />
        </label>
        <label>
          شروع (دقیقه از نیمه‌شب)
          <input name="startMinutes" type="number" defaultValue="540" min="0" max="1439" />
        </label>
        <label>
          پایان
          <input name="endMinutes" type="number" defaultValue="1020" min="0" max="1439" />
        </label>
        <label>
          پنجره ورود تا
          <input name="flexibleEntryUntil" type="number" defaultValue="570" min="0" max="1439" />
        </label>
        <label>
          مدت لازم روزانه
          <input name="requiredMinutes" type="number" defaultValue="480" min="0" />
        </label>
        <label>
          حداقل مجاز
          <input name="minimumDailyMinutes" type="number" defaultValue="450" min="0" />
        </label>
        <label>
          مدل اضافه‌کار
          <SelectField name="overtimeMode" defaultValue="DISABLED" options={[{ value: "DISABLED", label: "غیرفعال" }, { value: "AUTOMATIC", label: "خودکار" }, { value: "APPROVAL_REQUIRED", label: "نیازمند تأیید" }, { value: "SCHEDULED_ONLY", label: "فقط طبق برنامه" }]} />
        </label>
      </div>
      <div className={styles.footer}>
        <p>قانون جدید از تاریخ مؤثر روی محاسبات همان روز و روزهای آینده اعمال می‌شود.</p>
        <button type="submit" className="button primary" disabled={loading}>{loading ? "در حال فعال‌سازی…" : "فعال‌سازی نسخه"}</button>
      </div>
      {message && <div className={styles.message} role="status">{message}</div>}
    </form>
  );
}
