"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "../login/page.module.scss";

export default function ChangePassword() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    const response = await fetch("/api/v1/auth/change-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ newPassword: password }) });
    const data = await response.json();
    if (!response.ok) { setError(data.error?.message || "عملیات ناموفق بود"); setLoading(false); return; }
    router.push("/dashboard");
    router.refresh();
  }

  return <main className={styles.page}><section className={styles.card}><div className={styles.brand}><span className={styles.mark}>ح</span><strong>سامانه حضور و مرخصی</strong></div><div className={styles.heading}><p className="eyebrow">امنیت حساب</p><h1>تغییر اجباری رمز عبور</h1><p>برای اولین ورود، یک رمز عبور قوی انتخاب کنید.</p></div><form onSubmit={submit} className="stack"><label>رمز عبور جدید<input dir="ltr" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={10}/><small className="hint">حداقل ۱۰ نویسه، شامل حرف بزرگ، حرف کوچک و عدد</small></label>{error && <div className="alert danger">{error}</div>}<button className="button primary wide" disabled={loading}>{loading ? "در حال ذخیره…" : "ذخیره و ادامه"}</button></form></section></main>;
}
