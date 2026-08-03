"use client";

import { useState, type FormEvent } from "react";
import { formatJalaliDateTime } from "@/lib/date-format";
import ResponsiveDataList from "./ResponsiveDataList";
import SelectField from "./SelectField";
import styles from "./ImportsClient.module.scss";

type Job = { id: string; filename: string; status: string; importedCount: number; duplicateCount: number; errorCount: number; createdAt: string; device: string };

export default function ImportsClient({ devices, jobs: initial }: { devices: { id: string; name: string }[]; jobs: Job[] }) {
  const [jobs, setJobs] = useState(initial);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    const form = new FormData(event.currentTarget);
    const file = form.get("file") as File;
    if (!file?.size) { setMessage("فایل را انتخاب کنید."); setLoading(false); return; }
    form.append("mapping", JSON.stringify({ externalId: String(form.get("externalId")), timestamp: String(form.get("timestamp")), type: String(form.get("type")) }));
    try {
      const response = await fetch("/api/v1/imports", { method: "POST", body: form });
      const result = await response.json();
      if (!response.ok) { setMessage(result.error?.message || "ورود فایل ناموفق بود"); return; }
      setMessage(`ورود انجام شد: ${result.data.importedCount} رکورد جدید و ${result.data.duplicateCount} تکراری`);
      setJobs([result.data, ...jobs]);
      event.currentTarget.reset();
    } finally { setLoading(false); }
  }

  return <>
    <div className="sectionTitle"><div><p className="eyebrow">اتصال به دستگاه‌های حضور</p><h1>ورود فایل تردد</h1><p>فایل CSV یا XLSX را پیش‌نمایش و به‌صورت idempotent وارد کنید.</p></div></div>
    <div className={styles.layout}>
      <form className="card stack" onSubmit={submit}>
        <h3>ورود فایل جدید</h3>
        <label>دستگاه<SelectField name="deviceId" required placeholder="انتخاب دستگاه" options={devices.map((device) => ({ value: device.id, label: device.name }))} /></label>
        <label>فایل CSV یا XLSX<input name="file" type="file" accept=".csv,.txt,.xlsx,.xls" required /></label>
        <div className={styles.mapping}><label>ستون شناسه<input name="externalId" defaultValue="employeeCode" dir="ltr" /></label><label>ستون زمان<input name="timestamp" defaultValue="timestamp" dir="ltr" /></label><label>ستون نوع رویداد<input name="type" defaultValue="type" dir="ltr" /></label></div>
        <small className="hint">فرمت استاندارد CSV: employeeCode,timestamp,type — نوع‌ها: IN / OUT یا ورود / خروج</small>
        {message && <div className="alert success">{message}</div>}
        <button className="button primary" disabled={loading}>{loading ? "در حال پردازش فایل…" : "اعتبارسنجی و ثبت فایل"}</button>
      </form>
      <ResponsiveDataList
        title="تاریخچه ورودها"
        description="جستجو در نام فایل، دستگاه، وضعیت و نتیجه پردازش"
        rows={jobs}
        getRowId={(job) => job.id}
        fields={[
          { key: "filename", label: "فایل", primary: true, value: (job) => <span dir="ltr">{job.filename}</span>, search: (job) => job.filename },
          { key: "device", label: "دستگاه", primary: true, value: (job) => job.device, search: (job) => job.device },
          { key: "status", label: "وضعیت", primary: true, value: (job) => <span className={`status ${job.status.toLowerCase()}`}>{job.status === "COMPLETED" ? "تکمیل‌شده" : job.status}</span>, search: (job) => `${job.status} تکمیل‌شده` },
          { key: "createdAt", label: "زمان ثبت", value: (job) => formatJalaliDateTime(job.createdAt), search: (job) => formatJalaliDateTime(job.createdAt) },
          { key: "imported", label: "رکورد جدید", value: (job) => job.importedCount, search: (job) => String(job.importedCount) },
          { key: "duplicates", label: "تکراری", value: (job) => job.duplicateCount, search: (job) => String(job.duplicateCount) },
          { key: "errors", label: "خطا", value: (job) => job.errorCount, search: (job) => String(job.errorCount) },
        ]}
      />
    </div>
  </>;
}
