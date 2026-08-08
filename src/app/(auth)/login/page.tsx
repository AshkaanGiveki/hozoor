"use client";
import Image from "next/image";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./page.module.scss";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault(); setLoading(true); setError("");
    const response = await fetch("/api/v1/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, password }) });
    const data = await response.json(); setLoading(false);
    if (!response.ok) { setError(data.error?.message || "ورود انجام نشد"); return; }
    router.push(data.data.mustChangePassword ? "/change-password" : "/dashboard"); router.refresh();
  }
  return <main className={styles.page}><section className={styles.card}><div className={styles.brand}><Image className={styles.mark} src="/assets/icon/OnTyme.png" alt="OnTyme" width={38} height={38} priority /><Image src="/assets/icon/OnTymeText.png" alt="OnTyme" width={132} height={32} priority /></div><div className={styles.heading}><p className="eyebrow">ورود امن به OnTyme</p><h1>خوش آمدید</h1><p>برای ادامه، مشخصات حساب خود را وارد کنید.</p></div><form onSubmit={submit} className="stack"><label>نام کاربری<input dir="ltr" value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" required /></label><label>رمز عبور<input dir="ltr" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required /></label>{error && <div className="alert danger" role="alert">{error}</div>}<button className="button primary wide" disabled={loading}>{loading ? "در حال ورود…" : "ورود به OnTyme"}</button></form><div className={styles.footer}>ثبت‌نام عمومی فعال نیست؛ حساب‌ها توسط مدیر OnTyme ایجاد می‌شوند.</div></section></main>;
}
