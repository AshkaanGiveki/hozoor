"use client";

import { useMemo, useState } from "react";
import { formatJalaliShortDate } from "@/lib/date-format";
import { motion } from "motion/react";
import JalaliDatePicker from "./JalaliDatePicker";
import ResponsiveDataList from "./ResponsiveDataList";
import styles from "./ReportsClient.module.scss";

const minutes = (value: number) => `${Math.floor(value / 60)}:${String(value % 60).padStart(2, "0")}`;
const statusLabels: Record<string, string> = { PRESENT: "حضور کامل", ABSENT: "غیبت", INCOMPLETE: "ثبت ناقص", ON_LEAVE: "مرخصی تأییدشده", PARTIAL_LEAVE: "مرخصی ساعتی", OFF_TIME: "خروج ساعتی", PARTIAL_OFF_TIME: "خروج ساعتی تأییدشده", HOLIDAY: "تعطیل رسمی", WEEKLY_OFF: "روز استراحت", NOT_SCHEDULED: "بدون برنامه", INSUFFICIENT_TIME: "کمبود ساعت کاری", MISSION: "مأموریت", REMOTE_WORK: "دورکاری" };
const statusLabel = (status: string) => statusLabels[status] ?? "نامشخص";

export default function ReportsClient({ initial }: { initial: any[] }) {
  const [rows, setRows] = useState(initial);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [message, setMessage] = useState("");

  const totals = useMemo(() => ({
    records: rows.length,
    work: rows.reduce((sum, row) => sum + row.validWorkMinutes, 0),
    deficit: rows.reduce((sum, row) => sum + row.deficitMinutes, 0),
    deficientDays: rows.filter((row) => row.status === "INSUFFICIENT_TIME").length,
  }), [rows]);

  const dailyTrend = useMemo(() => {
    const grouped = new Map<string, number>();
    rows.forEach((row) => grouped.set(row.date, (grouped.get(row.date) ?? 0) + row.validWorkMinutes));
    return Array.from(grouped.entries()).sort(([left], [right]) => left.localeCompare(right)).slice(-14).map(([, value]) => value);
  }, [rows]);

  async function load() {
    if (from && to && from > to) { setMessage("تاریخ شروع باید قبل از تاریخ پایان باشد."); return; }
    const query = new URLSearchParams();
    if (from) query.set("from", from);
    if (to) query.set("to", to);
    const response = await fetch(`/api/v1/reports/attendance?${query}`);
    const result = await response.json();
    if (response.ok) setRows(result.data);
  }

  return <>
    <div className="sectionTitle"><div><p className="eyebrow">گزارش‌های واقعی از پایگاه داده</p><h1>گزارش عملکرد</h1><p>بازهٔ زمانی و خروجی قابل استفاده برای منابع انسانی</p></div><a className="button primary" href={`/api/v1/reports/attendance?format=csv${from ? `&from=${from}` : ""}${to ? `&to=${to}` : ""}`}>دریافت CSV</a></div>

    <section className={styles.controlsCard}>
      <div className={styles.controlsHeader}><div><h2>بازه گزارش</h2><p>داده‌های metrics و فهرست جزئیات با همین بازه به‌روزرسانی می‌شوند.</p></div><span className={styles.liveBadge}><i />داده زنده</span></div>
      <div className="filterBar"><label>از تاریخ<JalaliDatePicker name="from" value={from} onChange={setFrom} maxValue={to || undefined} /></label><label>تا تاریخ<JalaliDatePicker name="to" value={to} onChange={setTo} minValue={from || undefined} /></label><button className="button secondary" onClick={load}>اعمال فیلتر</button></div>{message && <div className="alert" role="alert">{message}</div>}
    </section>

    <section className={styles.metricsSection} aria-label="خلاصه عملکرد گزارش">
      <div className={styles.metricsHeader}><div><p className="eyebrow">خلاصه عملکرد</p><h2>نمای کلی بازه انتخابی</h2></div><span className={styles.metricsHint}>بر اساس {totals.records} رکورد محاسبه‌شده</span></div>
      <div className={styles.metricsGrid}>
        <MetricCard label="تعداد رکوردها" value={new Intl.NumberFormat("fa-IR").format(totals.records)} context="رکورد حضور در این بازه" tone="purple" values={dailyTrend.map(() => 1)} icon="▤" />
        <MetricCard label="کارکرد معتبر" value={minutes(totals.work)} context="مجموع زمان کارکرد" tone="green" values={dailyTrend} icon="◷" />
        <MetricCard label="مجموع کسری" value={minutes(totals.deficit)} context="زمان نیازمند جبران" tone="amber" values={rows.slice(-14).map((row) => row.deficitMinutes)} icon="↘" />
        <MetricCard label="روزهای کمبود" value={new Intl.NumberFormat("fa-IR").format(totals.deficientDays)} context={totals.deficientDays ? "نیازمند بررسی منابع انسانی" : "بدون روز کمبود"} tone={totals.deficientDays ? "red" : "green"} values={rows.slice(-14).map((row) => row.status === "INSUFFICIENT_TIME" ? 1 : 0)} icon="!" />
      </div>
    </section>

    <ResponsiveDataList
      title="جزئیات رکوردهای حضور"
      description="جستجو در تمام ستون‌ها؛ برای دیدن جزئیات هر رکورد آن را باز کنید"
      rows={rows}
      getRowId={(row) => `${row.employeeCode}-${row.date}`}
      fields={[
        { key: "date", label: "تاریخ", primary: true, value: (row) => formatJalaliShortDate(row.date), search: (row) => formatJalaliShortDate(row.date) },
        { key: "employee", label: "کارمند", primary: true, value: (row) => <span>{row.name}<small className={styles.code}>{row.employeeCode}</small></span>, search: (row) => `${row.name} ${row.employeeCode}` },
        { key: "status", label: "وضعیت", primary: true, value: (row) => <span className={`status ${String(row.status).toLowerCase()}`}>{statusLabel(row.status)}</span>, search: (row) => `${row.status} ${statusLabel(row.status)}` },
        { key: "department", label: "بخش", value: (row) => row.department || "—", search: (row) => row.department || "" },
        { key: "work", label: "کارکرد معتبر", value: (row) => minutes(row.validWorkMinutes), search: (row) => minutes(row.validWorkMinutes) },
        { key: "deficit", label: "کسری", value: (row) => row.deficitMinutes ? minutes(row.deficitMinutes) : "—", search: (row) => row.deficitMinutes ? minutes(row.deficitMinutes) : "" },
        { key: "overtime", label: "اضافه‌کار", value: (row) => row.overtimeMinutes ? minutes(row.overtimeMinutes) : "—", search: (row) => row.overtimeMinutes ? minutes(row.overtimeMinutes) : "" },
        { key: "anomalies", label: "ناهنجاری", value: (row) => row.anomalies?.join("، ") || "—", search: (row) => row.anomalies?.join(" ") || "" },
      ]}
    />
  </>;
}

function MetricCard({ label, value, context, tone, values, icon }: { label: string; value: string; context: string; tone: "purple" | "green" | "amber" | "red"; values: number[]; icon: string }) {
  return <motion.article className={`${styles.metricCard} ${styles[tone]}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .28 }}>
    <div className={styles.metricTop}><span className={styles.metricIcon}>{icon}</span><span className={styles.metricLabel}>{label}</span><span className={styles.metricMenu}>•••</span></div>
    <strong className={styles.metricValue}>{value}</strong>
    <p className={styles.metricContext}>{context}</p>
    <div className={styles.metricChart}><Sparkline values={values} /><span>{values.length ? "روند ۱۴ روز اخیر" : "بدون داده روندی"}</span></div>
  </motion.article>;
}

function Sparkline({ values }: { values: number[] }) {
  const points = values.length > 1 ? values : [0, 0];
  const max = Math.max(...points, 1);
  const min = Math.min(...points, 0);
  const range = Math.max(max - min, 1);
  const coordinates = points.map((value, index) => ({ x: (index / (points.length - 1)) * 120, y: 30 - ((value - min) / range) * 24 }));
  const curve = coordinates.slice(1).reduce((path, point, index) => { const previous = coordinates[index]; const midpoint = (previous.x + point.x) / 2; return `${path} C ${midpoint},${previous.y} ${midpoint},${point.y} ${point.x},${point.y}`; }, `M ${coordinates[0].x},${coordinates[0].y}`);
  return <svg viewBox="0 0 120 36" preserveAspectRatio="none" aria-hidden="true"><path d={curve} fill="none" vectorEffect="non-scaling-stroke" /><path d={`${curve} L 120 34 L 0 34 Z`} className={styles.chartArea} /></svg>;
}
