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
    event.preventDefault();
    if (loading) return;
    setLoading(true); setError("");
    const response = await fetch("/api/v1/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, password }) });
    const data = await response.json(); setLoading(false);
    if (!response.ok) { setError(data.error?.message || "Login failed"); return; }
    router.push(data.data.mustChangePassword ? "/change-password" : "/dashboard"); router.refresh();
  }

  return <main className={styles.page}>
    <section className={styles.loginLayout}>
      <div className={styles.visualPanel}>
        <div className={styles.visualGlow} />
        <div className={styles.visualContent}>
          <Image src="/assets/icon/OnTyme.png" alt="OnTyme" width={76} height={76} priority className={styles.visualMark} />
          <Image src="/assets/icon/OnTymeText.png" alt="OnTyme" width={210} height={52} priority className={styles.visualWordmark} />
          <p>Clarity for every working day.</p>
        </div>
        <div className={styles.visualFooter}><span /> <span>Secure workspace access</span></div>
      </div>
      <div className={styles.formPanel}>
        <div className={styles.brand}><Image className={styles.mark} src="/assets/icon/OnTyme.png" alt="OnTyme" width={42} height={42} priority /><Image src="/assets/icon/OnTymeText.png" alt="OnTyme" width={132} height={32} priority className={styles.wordmark} /></div>
        <div className={styles.heading}><p className={styles.kicker}>Welcome back</p><h1>Sign in to OnTyme</h1><p>Enter your account details to continue to your workspace.</p></div>
        <form onSubmit={submit} className={styles.form}>
          <label>Username<input dir="ltr" value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" placeholder="Enter your username" required /></label>
          <label>Password<input dir="ltr" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" placeholder="Enter your password" required /></label>
          {error && <div className="alert danger" role="alert">{error}</div>}
          <button className="button primary wide" disabled={loading}>{loading ? "Signing in…" : "Continue to OnTyme"}</button>
        </form>
        <div className={styles.note}><span className={styles.noteIcon}>i</span><p>Accounts are created and managed by your organization administrator.</p></div>
        <p className={styles.copyright}>© {new Date().getFullYear()} OnTyme</p>
      </div>
    </section>
  </main>;
}
