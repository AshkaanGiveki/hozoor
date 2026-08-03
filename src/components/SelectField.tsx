"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { AnimatePresence, motion } from "motion/react";
import styles from "./SelectField.module.scss";

export type SelectOption = { value: string; label: string; disabled?: boolean };

type Props = {
  name?: string;
  options: SelectOption[];
  defaultValue?: string;
  value?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  id?: string;
  onChange?: (value: string) => void;
};

export default function SelectField({ name, options, defaultValue = "", value, placeholder = "انتخاب کنید", required, disabled, id, onChange }: Props) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [internalValue, setInternalValue] = useState(value ?? defaultValue);
  const selectedValue = value ?? internalValue;
  const selected = options.find((option) => option.value === selectedValue);

  useEffect(() => {
    function close(event: PointerEvent) { if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false); }
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);

  useEffect(() => {
    const form = buttonRef.current?.form;
    if (!form) return;
    function reset() { queueMicrotask(() => setInternalValue(defaultValue)); }
    form.addEventListener("reset", reset);
    return () => form.removeEventListener("reset", reset);
  }, [defaultValue]);

  function choose(nextValue: string) {
    setInternalValue(nextValue);
    onChange?.(nextValue);
    setOpen(false);
    buttonRef.current?.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const currentIndex = Math.max(0, options.findIndex((option) => option.value === selectedValue));
    if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setOpen((current) => !current); return; }
    if (event.key === "Escape") { setOpen(false); return; }
    if (!open && ["ArrowDown", "ArrowUp"].includes(event.key)) { event.preventDefault(); setOpen(true); return; }
    if (!open) return;
    if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      const direction = event.key === "ArrowUp" ? -1 : 1;
      const nextIndex = event.key === "Home" ? 0 : event.key === "End" ? options.length - 1 : Math.min(options.length - 1, Math.max(0, currentIndex + direction));
      const next = options[nextIndex];
      if (next && !next.disabled) choose(next.value);
    }
  }

  return <div className={`${styles.root} ${disabled ? styles.disabled : ""}`} ref={rootRef}>
    {name && <input className={styles.hiddenInput} tabIndex={-1} aria-hidden="true" type="hidden" name={name} value={selectedValue} required={required} />}
    <button ref={buttonRef} id={fieldId} type="button" className={`${styles.trigger} ${open ? styles.triggerOpen : ""}`} aria-haspopup="listbox" aria-expanded={open} aria-controls={`${fieldId}-menu`} disabled={disabled} onClick={() => setOpen((current) => !current)} onKeyDown={handleKeyDown}>
      <span className={selected ? styles.selectedLabel : styles.placeholder}>{selected?.label ?? placeholder}</span>
      <svg className={`${styles.chevron} ${open ? styles.chevronOpen : ""}`} viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
    </button>
    <AnimatePresence>
      {open && <motion.div id={`${fieldId}-menu`} className={styles.menu} role="listbox" initial={{ opacity: 0, y: -5, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -5, scale: .98 }} transition={{ duration: .16 }}>
        {options.map((option) => <button type="button" role="option" aria-selected={option.value === selectedValue} disabled={option.disabled} className={`${styles.option} ${option.value === selectedValue ? styles.optionSelected : ""}`} key={option.value} onClick={() => choose(option.value)}><span>{option.label}</span>{option.value === selectedValue && <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m5 12 4 4L19 6" /></svg>}</button>)}
      </motion.div>}
    </AnimatePresence>
  </div>;
}
