"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import styles from "./ResponsiveDataList.module.scss";

export type ResponsiveDataField<T> = {
  key: string;
  label: string;
  primary?: boolean;
  value: (row: T) => ReactNode;
  search?: (row: T) => string;
};

type Props<T> = {
  rows: T[];
  fields: ResponsiveDataField<T>[];
  getRowId: (row: T) => string;
  title?: string;
  description?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  bare?: boolean;
  renderActions?: (row: T) => ReactNode;
};

export default function ResponsiveDataList<T>({ rows, fields, getRowId, title, description, searchPlaceholder = "جستجو در همه اطلاعات...", emptyMessage = "رکوردی برای نمایش وجود ندارد.", bare = false, renderActions }: Props<T>) {
  const [query, setQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const primaryFields = fields.filter((field) => field.primary);
  const detailFields = fields.filter((field) => !field.primary);
  const normalizedQuery = query.trim().toLocaleLowerCase("fa-IR");
  const filteredRows = useMemo(() => {
    if (!normalizedQuery) return rows;
    return rows.filter((row) => fields.some((field) => (field.search ? field.search(row) : String(field.value(row))).toLocaleLowerCase("fa-IR").includes(normalizedQuery)));
  }, [fields, normalizedQuery, rows]);
  useEffect(() => {
    function focusSearch(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); searchRef.current?.focus(); }
    }
    window.addEventListener("keydown", focusSearch);
    return () => window.removeEventListener("keydown", focusSearch);
  }, []);

  return (
    <section className={`${styles.shell} ${bare ? styles.bare : ""}`}>
      {(title || description || rows.length > 0) && <div className={styles.toolbar}>
        <div className={styles.heading}>{title && <h3>{title}</h3>}{description && <p>{description}</p>}</div>
        <div className={styles.toolbarMeta}><span>{filteredRows.length} از {rows.length}</span><label className={styles.search}><span aria-hidden="true">⌕</span><input ref={searchRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={searchPlaceholder} aria-label={searchPlaceholder} /><kbd>Ctrl K</kbd></label></div>
      </div>}
      {filteredRows.length === 0 ? <div className={styles.empty}><span>⌕</span><strong>{query ? "نتیجه‌ای پیدا نشد" : emptyMessage}</strong><small>{query ? "عبارت جستجو را تغییر دهید یا فیلتر را پاک کنید." : "اطلاعات جدید پس از ثبت در این بخش نمایش داده می‌شود."}</small></div> : <LayoutGroup id={`responsive-data-list-${title ?? "records"}`}><div className={styles.list}>{filteredRows.map((row, index) => {
        const id = getRowId(row);
        const isExpanded = expandedId === id;
        return <motion.article layout key={id} initial={{ opacity: 0, y: 4, filter: "blur(2px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} className={`${styles.item} ${isExpanded ? styles.itemExpanded : ""}`} transition={{ layout: { duration: .24, ease: "easeInOut" }, default: { duration: .16, delay: Math.min(index * .025, .14), ease: "easeOut" } }}>
          <button type="button" className={styles.summary} aria-expanded={isExpanded} onClick={() => setExpandedId(isExpanded ? null : id)}>
            <span className={styles.summaryFields}>{(primaryFields.length ? primaryFields : fields.slice(0, 2)).map((field) => <span className={styles.primaryField} key={field.key}><small>{field.label}</small><strong>{field.value(row)}</strong></span>)}</span>
            <span className={`${styles.expandButton} ${isExpanded ? styles.expandButtonOpen : ""}`} aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="m6 9 6 6 6-6" /></svg></span>
          </button>
          <AnimatePresence initial={false}>
            {isExpanded && <motion.div className={styles.details} initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: .22, ease: "easeOut" }}>
              <div className={styles.detailGrid}>{detailFields.map((field) => <div className={styles.detail} key={field.key}><span>{field.label}</span><strong>{field.value(row)}</strong></div>)}</div>
              {renderActions && <div className={styles.actions}>{renderActions(row)}</div>}
            </motion.div>}
          </AnimatePresence>
        </motion.article>;
      })}</div></LayoutGroup>}
    </section>
  );
}
