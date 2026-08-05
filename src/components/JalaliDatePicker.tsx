"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { jalaaliMonthLength, toGregorian, toJalaali } from "jalaali-js";
import styles from "./JalaliDatePicker.module.scss";

type JalaliParts = { jy: number; jm: number; jd: number };
type PickerMode = "days" | "months" | "years";
type Props = { name: string; defaultValue?: string; value?: string; onChange?: (value: string) => void; required?: boolean; withTime?: boolean; placeholder?: string; ariaLabel?: string; minValue?: string; maxValue?: string };

const monthNames = ["فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور", "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"];
const weekDays = ["ش", "ی", "د", "س", "چ", "پ", "ج"];
const faNumber = new Intl.NumberFormat("fa-IR", { useGrouping: false });
const pad = (value: number) => String(value).padStart(2, "0");
const formatYear = (value: number) => faNumber.format(value);

function isoToJalali(value?: string): JalaliParts | null {
  if (!value) return null;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const [year, month, day] = match.slice(1).map(Number);
  const result = toJalaali(year, month, day);
  return { jy: result.jy, jm: result.jm, jd: result.jd };
}

function nowJalali(): JalaliParts {
  const now = new Date();
  const result = toJalaali(now.getFullYear(), now.getMonth() + 1, now.getDate());
  return { jy: result.jy, jm: result.jm, jd: result.jd };
}

function partsToIso(value: JalaliParts) {
  const gregorian = toGregorian(value.jy, value.jm, value.jd);
  return `${gregorian.gy}-${pad(gregorian.gm)}-${pad(gregorian.gd)}`;
}

function monthOffset(year: number, month: number) {
  const first = toGregorian(year, month, 1);
  const weekday = new Date(first.gy, first.gm - 1, first.gd).getDay();
  return (weekday + 1) % 7;
}

function Chevron({ direction }: { direction: "next" | "previous" }) {
  return <svg className={styles.chevron} viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d={direction === "next" ? "m13 4-6 6 6 6" : "m7 4 6 6-6 6"} /></svg>;
}

function CalendarIcon() {
  return <svg className={styles.calendarIcon} viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15" rx="3"/><path d="M7.5 3.5v3M16.5 3.5v3M3.5 9.5h17M8 13h.01M12 13h.01M16 13h.01M8 16.5h.01M12 16.5h.01"/></svg>;
}

export default function JalaliDatePicker({ name, defaultValue, value, onChange, required = false, withTime = false, placeholder = "انتخاب تاریخ", ariaLabel = "انتخاب تاریخ جلالی", minValue, maxValue }: Props) {
  const initial = isoToJalali(value ?? defaultValue);
  const today = useMemo(nowJalali, []);
  const [selected, setSelected] = useState<JalaliParts | null>(initial);
  const [view, setView] = useState<JalaliParts>(initial ?? today);
  const [time, setTime] = useState(defaultValue?.match(/T(\d{2}:\d{2})/)?.[1] ?? "09:00");
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<PickerMode>("days");
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (value === undefined) return;
    const next = isoToJalali(value);
    setSelected(next);
    if (next) setView(next);
  }, [value]);

  useEffect(() => {
    function close(event: MouseEvent) { if (rootRef.current && !rootRef.current.contains(event.target as Node)) { setOpen(false); setMode("days"); } }
    function escape(event: KeyboardEvent) { if (event.key === "Escape") { setOpen(false); setMode("days"); } }
    document.addEventListener("mousedown", close); document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", escape); };
  }, []);

  const isoDate = selected ? partsToIso(selected) : "";
  const submittedValue = isoDate ? `${isoDate}${withTime ? `T${time}` : ""}` : "";
  const offset = monthOffset(view.jy, view.jm);
  const length = jalaaliMonthLength(view.jy, view.jm);
  const cells = Array.from({ length: Math.ceil((offset + length) / 7) * 7 }, (_, index) => index - offset + 1);
  const yearStart = Math.floor(view.jy / 12) * 12;
  const years = Array.from({ length: 12 }, (_, index) => yearStart + index);

  function changeMonth(amount: number) {
    const month = view.jm + amount;
    setView(month < 1 ? { jy: view.jy - 1, jm: 12, jd: 1 } : month > 12 ? { jy: view.jy + 1, jm: 1, jd: 1 } : { jy: view.jy, jm: month, jd: 1 });
    setMode("days");
  }

  function choose(day: number) {
    const next = { jy: view.jy, jm: view.jm, jd: day };
    const nextValue = `${partsToIso(next)}${withTime ? `T${time}` : ""}`;
    if ((minValue && nextValue < minValue) || (maxValue && nextValue > maxValue)) return;
    setSelected(next); onChange?.(partsToIso(next)); setOpen(false); setMode("days");
  }

  function chooseMonth(month: number) { setView({ ...view, jm: month, jd: 1 }); setMode("days"); }
  function chooseYear(year: number) { setView({ ...view, jy: year, jd: 1 }); setMode("days"); }

  function selectToday() { setView(today); setSelected(today); onChange?.(partsToIso(today)); setOpen(false); setMode("days"); }

  return <div className={styles.root} ref={rootRef}>
    <input className={styles.validationInput} type="text" name={name} value={submittedValue} readOnly required={required} tabIndex={-1} aria-hidden="true" />
    <div className={styles.inputRow}>
      <button type="button" className={styles.trigger} aria-label={ariaLabel} aria-expanded={open} onClick={() => setOpen((state) => !state)}><span className={selected ? styles.selectedText : styles.placeholder}>{selected ? `${faNumber.format(selected.jd)} ${monthNames[selected.jm - 1]} ${formatYear(selected.jy)}` : placeholder}</span><CalendarIcon /></button>
      {withTime && <input className={styles.timeInput} type="time" value={time} aria-label="ساعت" onChange={(event) => setTime(event.target.value)} />}
    </div>
    {open && <div className={styles.popover} role="dialog" aria-label={ariaLabel}>
      <div className={styles.popoverTop}><span className={styles.calendarLabel}>تقویم جلالی</span><button type="button" className={styles.todayButton} onClick={selectToday}>امروز</button></div>
      <div className={styles.popoverHeader}>
        <button type="button" className={styles.arrowButton} onClick={() => mode === "years" ? setView({ ...view, jy: view.jy - 12 }) : changeMonth(-1)} aria-label="قبلی"><Chevron direction="previous" /></button>
        {mode === "days" ? <div className={styles.headingButtons}><button type="button" className={styles.monthButton} onClick={() => setMode("months")}>{monthNames[view.jm - 1]}</button><button type="button" className={styles.yearButton} onClick={() => setMode("years")}>{formatYear(view.jy)}</button></div> : <strong className={styles.modeTitle}>{mode === "months" ? "انتخاب ماه" : "انتخاب سال"}</strong>}
        <button type="button" className={styles.arrowButton} onClick={() => mode === "years" ? setView({ ...view, jy: view.jy + 12 }) : changeMonth(1)} aria-label="بعدی"><Chevron direction="next" /></button>
      </div>
      <div className={styles.calendarStage} key={`${mode}-${view.jy}-${view.jm}`}>
        {mode === "days" && <><div className={styles.weekRow}>{weekDays.map((day) => <span key={day}>{day}</span>)}</div><div className={styles.days}>{cells.map((day, index) => { if (day < 1 || day > length) return <span className={styles.emptyDay} key={`${view.jy}-${view.jm}-empty-${index}`} />; const candidate = partsToIso({ jy: view.jy, jm: view.jm, jd: day }); const disabled = Boolean((minValue && candidate < minValue.slice(0, 10)) || (maxValue && candidate > maxValue.slice(0, 10))); return <button type="button" disabled={disabled} key={`${view.jy}-${view.jm}-${day}`} className={`${styles.day} ${selected?.jy === view.jy && selected.jm === view.jm && selected.jd === day ? styles.selectedDay : ""} ${today.jy === view.jy && today.jm === view.jm && today.jd === day ? styles.todayDay : ""}`} onClick={() => choose(day)}>{faNumber.format(day)}</button>; })}</div></>}
        {mode === "months" && <div className={styles.monthGrid}>{monthNames.map((month, index) => <button type="button" key={month} className={view.jm === index + 1 ? styles.selectedOption : ""} onClick={() => chooseMonth(index + 1)}>{month}</button>)}</div>}
        {mode === "years" && <div className={styles.yearGrid}>{years.map((year) => <button type="button" key={year} className={view.jy === year ? styles.selectedOption : ""} onClick={() => chooseYear(year)}>{formatYear(year)}</button>)}</div>}
      </div>
      <div className={styles.popoverFooter}><span>برای انتخاب سریع، ماه یا سال را لمس کنید</span><span className={styles.footerHint}>شنبه تا جمعه</span></div>
    </div>}
  </div>;
}
