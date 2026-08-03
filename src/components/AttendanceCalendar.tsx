"use client";

import { useMemo, useState } from "react";
import { jalaaliMonthLength, toGregorian, toJalaali } from "jalaali-js";
import { LayoutGroup, motion } from "motion/react";
import { formatJalaliDate, formatJalaliLongDate, formatJalaliWeekday } from "@/lib/date-format";
import styles from "./AttendanceCalendar.module.scss";

export type AttendanceCalendarRecord = {
  id: string;
  date: string;
  employee: { name: string; code: string };
  status: string;
  statusLabel: string;
  firstIn: string | null;
  lastOut: string | null;
  validWorkMinutes: number;
  requiredMinutes: number;
  deficitMinutes: number;
  lateMinutes: number;
  earlyDepartureMinutes: number;
  anomalies: string[];
};

type ViewMode = "month" | "week" | "day";

const weekDays = ["شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه"];
const monthFormatter = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { month: "long", year: "numeric" });

const pad = (value: number) => String(value).padStart(2, "0");
const keyOf = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const dateFromKey = (key: string) => {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
};
const minutesText = (minutes: number) => `${Math.floor(minutes / 60)}:${pad(minutes % 60)}`;
const timeText = (value: string | null) => value ? new Date(value).toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" }) : "ثبت نشده";
const jalaliOf = (date: Date) => toJalaali(date.getFullYear(), date.getMonth() + 1, date.getDate());
const gregorianOf = (year: number, month: number, day: number) => { const date = toGregorian(year, month, day); return new Date(date.gy, date.gm - 1, date.gd); };
const jalaliDay = (date: Date) => jalaliOf(date).jd;
const statusTone = (status: string) => {
  if (["PRESENT", "MISSION", "REMOTE_WORK"].includes(status)) return "worked";
  if (["ON_LEAVE", "PARTIAL_LEAVE", "OFF_TIME", "PARTIAL_OFF_TIME", "HOLIDAY", "WEEKLY_OFF"].includes(status)) return "approved";
  if (["INSUFFICIENT_TIME", "INCOMPLETE", "ABSENT"].includes(status)) return "warning";
  return "neutral";
};

function shiftDate(date: Date, amount: number, mode: ViewMode) {
  if (mode === "month") {
    const current = jalaliOf(date);
    const target = current.jm + amount;
    const year = target < 1 ? current.jy - 1 : target > 12 ? current.jy + 1 : current.jy;
    const month = target < 1 ? 12 : target > 12 ? 1 : target;
    return gregorianOf(year, month, 1);
  }
  const next = new Date(date);
  next.setDate(next.getDate() + (mode === "week" ? amount * 7 : amount));
  return next;
}

function weekStart(date: Date) {
  const start = new Date(date);
  start.setDate(start.getDate() - ((start.getDay() + 1) % 7));
  return start;
}

export default function AttendanceCalendar({ records }: { records: AttendanceCalendarRecord[] }) {
  const todayKey = keyOf(new Date());
  const [view, setView] = useState<ViewMode>("month");
  const [cursor, setCursor] = useState(() => dateFromKey(records.at(-1)?.date ?? todayKey));
  const [selectedKey, setSelectedKey] = useState(records.at(-1)?.date ?? todayKey);

  const byDate = useMemo(() => {
    const result = new Map<string, AttendanceCalendarRecord[]>();
    for (const record of records) result.set(record.date, [...(result.get(record.date) ?? []), record]);
    return result;
  }, [records]);

  const selectedRecords = byDate.get(selectedKey) ?? [];
  const selectedDate = dateFromKey(selectedKey);
  const monthCells = useMemo(() => {
    const current = jalaliOf(cursor);
    const first = gregorianOf(current.jy, current.jm, 1);
    const offset = (first.getDay() + 1) % 7;
    const length = jalaaliMonthLength(current.jy, current.jm);
    return Array.from({ length: Math.ceil((offset + length) / 7) * 7 }, (_, index) => {
      const date = new Date(first);
      date.setDate(first.getDate() + index - offset);
      return date;
    });
  }, [cursor]);
  const weekCells = useMemo(() => Array.from({ length: 7 }, (_, index) => {
    const date = weekStart(selectedDate);
    date.setDate(date.getDate() + index);
    return date;
  }), [selectedKey]);
  const weekRecords = weekCells.flatMap((date) => byDate.get(keyOf(date)) ?? []);
  const weekWorkedMinutes = weekRecords.reduce((total, record) => total + record.validWorkMinutes, 0);
  const weekRequiredMinutes = weekRecords.reduce((total, record) => total + record.requiredMinutes, 0);
  const weekDeficitMinutes = weekRecords.reduce((total, record) => total + record.deficitMinutes, 0);
  const weekPresentDays = weekCells.filter((date) => (byDate.get(keyOf(date)) ?? []).length > 0).length;

  function selectDate(date: Date) {
    const nextKey = keyOf(date);
    setSelectedKey(nextKey);
    setCursor(date);
  }

  function navigate(amount: number) {
    const next = shiftDate(cursor, amount, view);
    setCursor(next);
    if (view === "day") setSelectedKey(keyOf(next));
  }

  function goToday() {
    const today = new Date();
    setCursor(today);
    setSelectedKey(keyOf(today));
  }

  const visibleTitle = view === "day"
    ? formatJalaliLongDate(selectedDate)
    : view === "week"
      ? `${formatJalaliDate(weekCells[0])} تا ${formatJalaliDate(weekCells[6])}`
      : monthFormatter.format(cursor);

  return (
    <section className={styles.calendarShell}>
      <div className={styles.calendarTopbar}>
        <div className={styles.titleBlock}>
          <span className={styles.calendarIcon}>◫</span>
          <div>
            <h2>{visibleTitle}</h2>
            <p>{records.length ? `${new Intl.NumberFormat("fa-IR").format(records.length)} روز ثبت‌شده` : "هنوز رکوردی برای این بازه ثبت نشده است"}</p>
          </div>
        </div>
        <div className={styles.toolbar}>
          <div className={styles.navigation}>
            <button type="button" aria-label="بازهٔ قبلی" onClick={() => navigate(-1)}><svg className={styles.navigationArrow} viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="m7 4 6 6-6 6" /></svg></button>
            <button type="button" className={styles.todayButton} onClick={goToday}>امروز</button>
            <button type="button" aria-label="بازهٔ بعدی" onClick={() => navigate(1)}><svg className={styles.navigationArrow} viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="m13 4-6 6 6 6" /></svg></button>
          </div>
          <div className={styles.viewSwitch} role="tablist" aria-label="نمای تقویم">
            {([ ["month", "ماهانه"], ["week", "هفتگی"], ["day", "روزانه"] ] as const).map(([id, label]) => (
              <button key={id} type="button" role="tab" aria-selected={view === id} className={view === id ? styles.activeView : ""} onClick={() => setView(id)}>{label}</button>
            ))}
          </div>
        </div>
      </div>

      <div className={styles.calendarBody}>
          <div className={styles.calendarMain}>
          <LayoutGroup id="attendance-calendar-selection">
          <div className={styles.legend}>
            <span><i className={styles.workedDot}/>حضور کامل</span>
            <span><i className={styles.approvedDot}/>مرخصی / مجاز</span>
            <span><i className={styles.warningDot}/>نیازمند بررسی</span>
          </div>
          {view === "month" && (
            <div className={styles.monthGrid}>
              {weekDays.map((day) => <div className={styles.weekday} key={day}>{day}</div>)}
              {monthCells.map((date) => {
                const dateKey = keyOf(date);
                const items = byDate.get(dateKey) ?? [];
                const currentMonth = jalaliOf(cursor);
                const cellJalali = jalaliOf(date);
                const inMonth = cellJalali.jy === currentMonth.jy && cellJalali.jm === currentMonth.jm;
                const tone = items[0] ? statusTone(items[0].status) : "neutral";
                return <button type="button" key={dateKey} aria-current={selectedKey === dateKey ? "date" : undefined} aria-label={`${dateKey}${selectedKey === dateKey ? " - تاریخ انتخاب‌شده" : ""}`} className={`${styles.dayCell} ${!inMonth ? styles.outside : ""} ${selectedKey === dateKey ? styles.selected : ""}`} onClick={() => selectDate(date)}>
                  {selectedKey === dateKey && <motion.span layoutId="attendance-selected-date" initial={false} className={styles.selectedDateIndicator} transition={{ type: "spring", stiffness: 420, damping: 32, mass: 0.72 }} aria-hidden="true" />}
                  <span className={`${styles.dayNumber} ${dateKey === todayKey ? styles.todayNumber : ""}`}>{new Intl.NumberFormat("fa-IR").format(jalaliDay(date))}</span>
                  {items.length > 0 && <span className={`${styles.dayMarker} ${styles[tone]}`} aria-label={items[0].statusLabel}>{items.length > 1 ? `${items.length} نفر` : items[0].statusLabel}</span>}
                  {items[0]?.validWorkMinutes > 0 && <small>{minutesText(items[0].validWorkMinutes)}</small>}
                </button>;
              })}
            </div>
          )}
          {view === "week" && <div className={styles.weekViewStack}>
            <div className={styles.weekSummary} aria-label="خلاصه هفته">
              <div className={styles.weekMetric}><span>روزهای ثبت‌شده</span><strong>{new Intl.NumberFormat("fa-IR").format(weekPresentDays)} از ۷</strong><small>روز دارای داده</small></div>
              <div className={styles.weekMetric}><span>کارکرد معتبر</span><strong>{minutesText(weekWorkedMinutes)}</strong><small>مجموع هفته</small></div>
              <div className={styles.weekMetric}><span>هدف برنامه</span><strong>{minutesText(weekRequiredMinutes)}</strong><small>بر اساس قوانین حضور</small></div>
              <div className={`${styles.weekMetric} ${weekDeficitMinutes ? styles.weekMetricWarning : ""}`}><span>کسری هفته</span><strong>{weekDeficitMinutes ? minutesText(weekDeficitMinutes) : "—"}</strong><small>{weekDeficitMinutes ? "نیازمند بررسی" : "بدون کسری"}</small></div>
            </div>
            <div className={styles.weekGrid}>{weekCells.map((date) => <DayColumn key={keyOf(date)} date={date} records={byDate.get(keyOf(date)) ?? []} selected={selectedKey === keyOf(date)} onSelect={selectDate}/>)}</div>
          </div>}
          {view === "day" && <div className={styles.dayView}><DayColumn date={selectedDate} records={selectedRecords} selected onSelect={selectDate} large/></div>}
          </LayoutGroup>
        </div>
        <SelectedDatePanel date={selectedDate} records={selectedRecords}/>
      </div>
    </section>
  );
}

function DayColumn({ date, records, selected, onSelect, large = false }: { date: Date; records: AttendanceCalendarRecord[]; selected: boolean; onSelect: (date: Date) => void; large?: boolean }) {
  const record = records[0];
  return <button type="button" className={`${styles.dayColumn} ${selected ? styles.selectedColumn : ""} ${large ? styles.largeDay : ""}`} onClick={() => onSelect(date)}>
    {selected && <motion.span layoutId="attendance-selected-date" initial={false} className={styles.selectedDateIndicator} transition={{ type: "spring", stiffness: 420, damping: 32, mass: 0.72 }} aria-hidden="true" />}
    {large ? <>
      <div className={styles.largeDayHeading}><div><span className={styles.columnDate}>{formatJalaliWeekday(date)}</span><strong>{formatJalaliDate(date)}</strong></div>{record && <span className={`${styles.statusPill} ${styles[statusTone(record.status)]}`}>{record.statusLabel}</span>}</div>
      {record ? <><div className={styles.largePunchGrid}><div className={styles.largePunch}><span>ورود</span><strong>{timeText(record.firstIn)}</strong><small>{record.lateMinutes ? `${minutesText(record.lateMinutes)} تأخیر` : "به‌موقع"}</small></div><div className={styles.largeTimeline}><i/><span>زمان حضور</span><i/></div><div className={styles.largePunch}><span>خروج</span><strong>{timeText(record.lastOut)}</strong><small>{record.earlyDepartureMinutes ? `${minutesText(record.earlyDepartureMinutes)} تعجیل` : "ثبت عادی"}</small></div></div><div className={styles.largeDayMetrics}><div><span>کارکرد معتبر</span><strong>{minutesText(record.validWorkMinutes)}</strong></div><div><span>هدف روزانه</span><strong>{minutesText(record.requiredMinutes)}</strong></div><div><span>کسری</span><strong className={record.deficitMinutes ? styles.warningText : ""}>{record.deficitMinutes ? minutesText(record.deficitMinutes) : "—"}</strong></div></div></> : <div className={styles.largeEmpty}><span>◌</span><strong>برای این روز رکوردی ثبت نشده است</strong><small>با انتخاب روز دیگری، جزئیات ورود و خروج نمایش داده می‌شود.</small></div>}
    </> : <><span className={styles.columnDate}>{new Intl.DateTimeFormat("fa-IR-u-ca-persian", { weekday: "short" }).format(date)}</span><strong>{new Intl.NumberFormat("fa-IR").format(jalaliDay(date))}</strong><span className={styles.columnRule}/>{record ? <><span className={`${styles.statusPill} ${styles[statusTone(record.status)]}`}>{record.statusLabel}</span><span className={styles.columnTime}>{timeText(record.firstIn)} - {timeText(record.lastOut)}</span><span className={styles.columnDuration}>{minutesText(record.validWorkMinutes)}</span></> : <span className={styles.noRecord}>بدون ثبت</span>}</>}
    </button>;
}

function SelectedDatePanel({ date, records }: { date: Date; records: AttendanceCalendarRecord[] }) {
  const first = records[0];
  return <aside className={styles.detailsPanel}>
    <div className={styles.detailsHeader}><div><p>جزئیات تاریخ</p><h3>{formatJalaliLongDate(date)}</h3></div><span className={styles.dateBadge}>{new Intl.NumberFormat("fa-IR").format(jalaliDay(date))}</span></div>
    {first ? <>
      <div className={`${styles.detailStatus} ${styles[statusTone(first.status)]}`}><span className={styles.statusIndicator}/><div><strong>{first.statusLabel}</strong><small>{first.employee.name}</small></div></div>
      <div className={styles.punchCard}><div className={styles.punchItem}><span>ورود</span><strong>{timeText(first.firstIn)}</strong><small>{first.lateMinutes ? `${minutesText(first.lateMinutes)} تأخیر` : "به‌موقع"}</small></div><div className={styles.punchDivider}/><div className={styles.punchItem}><span>خروج</span><strong>{timeText(first.lastOut)}</strong><small>{first.earlyDepartureMinutes ? `${minutesText(first.earlyDepartureMinutes)} تعجیل` : "ثبت عادی"}</small></div></div>
      <div className={styles.detailStats}><div><span>کارکرد معتبر</span><strong>{minutesText(first.validWorkMinutes)}</strong></div><div><span>هدف روزانه</span><strong>{minutesText(first.requiredMinutes)}</strong></div><div><span>کسری</span><strong className={first.deficitMinutes ? styles.warningText : ""}>{first.deficitMinutes ? minutesText(first.deficitMinutes) : "—"}</strong></div></div>
      {first.anomalies.length > 0 && <div className={styles.anomalies}><span>نیازمند توجه</span>{first.anomalies.map((anomaly) => <small key={anomaly}>{anomaly === "MISSING_OUT" ? "خروج ثبت نشده" : anomaly === "LATE_ARRIVAL" ? "تأخیر در ورود" : "ثبت غیرعادی"}</small>)}</div>}
      {records.length > 1 && <div className={styles.otherRecords}><span>{new Intl.NumberFormat("fa-IR").format(records.length)} کارمند در این تاریخ</span>{records.slice(1).map((record) => <small key={record.id}>{record.employee.name} · {record.statusLabel}</small>)}</div>}
    </> : <div className={styles.emptyDetail}><span>○</span><strong>رکوردی برای این تاریخ نیست</strong><p>با انتخاب روز دیگری، جزئیات ورود و خروج نمایش داده می‌شود.</p></div>}
    <a className={styles.detailLink} href={`/requests?kind=correction&date=${keyOf(date)}`}>درخواست اصلاح برای این تاریخ <svg className={styles.detailArrow} viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M16 10H4M9 5l-5 5 5 5" /></svg></a>
  </aside>;
}
