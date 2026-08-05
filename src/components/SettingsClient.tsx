"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { formatJalaliDate } from "@/lib/date-format";
import { LayoutGroup, motion } from "motion/react";
import PolicyForm from "./PolicyForm";
import SelectField from "./SelectField";
import styles from "./SettingsClient.module.scss";

type SettingsTab = "details" | "password" | "sessions" | "notifications" | "company" | "policy" | "device" | "leave";
type Role = "ADMIN" | "HR_ADMIN" | "MANAGER" | "EMPLOYEE" | "AUDITOR";
type Policy = { id: string; name: string; version: number; status: string; effectiveFrom: string; minimumDailyMinutes: number; overtimeMode: string };
type Device = { id: string; name: string; type: string };
type LeaveType = { id: string; name: string; unit: string };

type Props = {
  user: { firstName: string; lastName: string; username: string; role: Role; email: string; phone: string; employeeCode: string; avatarUrl?: string | null };
  company: { name: string; timezone: string; weekStartsOn: number };
  canManageCompany: boolean;
  canEditOrganization: boolean;
  unreadNotifications: number;
  policies: Policy[];
  devices: Device[];
  leaveTypes: LeaveType[];
  groups: { id: string; name: string }[];
};

const personalTabs: Array<{ id: SettingsTab; label: string; description: string; icon: string }> = [
  { id: "details", label: "اطلاعات من", description: "نام و مشخصات حساب", icon: "◎" },
  { id: "password", label: "رمز عبور", description: "امنیت و تغییر رمز", icon: "⌁" },
  { id: "sessions", label: "نشست‌های فعال", description: "دستگاه‌های واردشده", icon: "◌" },
  { id: "notifications", label: "اعلان‌ها", description: "پیام‌ها و رویدادها", icon: "◇" },
];

const organizationTabs: Array<{ id: SettingsTab; label: string; description: string; icon: string }> = [
  { id: "company", label: "پروفایل شرکت", description: "نام، منطقه زمانی و هفته کاری", icon: "⌂" },
  { id: "policy", label: "قوانین حضور", description: "نسخه‌ها و مقررات محاسبه", icon: "◷" },
  { id: "device", label: "دستگاه‌های تردد", description: "منابع ورود و خروج", icon: "▣" },
  { id: "leave", label: "انواع مرخصی", description: "دسته‌بندی و واحد مصرف", icon: "✦" },
];

const roleLabels: Record<Role, string> = { ADMIN: "مدیر سامانه", HR_ADMIN: "مدیر منابع انسانی", MANAGER: "مدیر تیم", EMPLOYEE: "کارمند", AUDITOR: "حسابرس" };
const overtimeLabels: Record<string, string> = { DISABLED: "بدون محاسبه اضافه‌کار", AUTOMATIC: "محاسبه خودکار", APPROVAL_REQUIRED: "نیازمند تأیید", SCHEDULED_ONLY: "فقط طبق برنامه" };

export default function SettingsClient({ user, company, canManageCompany, canEditOrganization, unreadNotifications, policies, devices, leaveTypes, groups }: Props) {
  const [tab, setTab] = useState<SettingsTab>("details");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "danger">("success");
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl ?? "");
  const activeTabs = canManageCompany ? [...personalTabs, ...organizationTabs.filter((item) => canEditOrganization || ["company", "policy"].includes(item.id))] : personalTabs;
  const activeTab = activeTabs.find((item) => item.id === tab) ?? personalTabs[0];

  function chooseTab(nextTab: SettingsTab) {
    setTab(nextTab);
    setMessage("");
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busyAction) return;
    setBusyAction("profile");
    try {
      const response = await fetch("/api/v1/auth/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget))) });
      const result = await response.json();
      setMessageType(response.ok ? "success" : "danger");
      setMessage(response.ok ? "اطلاعات حساب شما ذخیره شد." : result.error?.message ?? "ذخیره اطلاعات انجام نشد.");
    } finally { setBusyAction(null); }
  }

  async function saveCompany(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busyAction) return;
    setBusyAction("company");
    try {
      const response = await fetch("/api/v1/company/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget))) });
      const result = await response.json();
      setMessageType(response.ok ? "success" : "danger");
      setMessage(response.ok ? "تنظیمات شرکت ذخیره شد." : result.error?.message ?? "ذخیره تنظیمات شرکت انجام نشد.");
    } finally { setBusyAction(null); }
  }

  async function uploadAvatar(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 2 * 1024 * 1024) { setMessageType("danger"); setMessage("تصویر باید معتبر و حداکثر ۲ مگابایت باشد."); return; }
    setBusyAction("avatar");
    try { const form = new FormData(); form.append("file", file); const response = await fetch("/api/v1/auth/avatar", { method: "POST", body: form }); const result = await response.json(); setMessageType(response.ok ? "success" : "danger"); setMessage(response.ok ? "تصویر پروفایل ذخیره شد." : result.error?.message ?? "ذخیره تصویر انجام نشد."); if (response.ok) setAvatarUrl(result.data.avatarUrl); } finally { setBusyAction(null); }
  }

  async function logoutAll() {
    if (busyAction) return;
    setBusyAction("logout");
    await fetch("/api/v1/auth/logout-all", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>حساب کاربری و سازمان</p>
          <h1>تنظیمات</h1>
          <p className={styles.heroDescription}>اطلاعات شخصی، امنیت حساب و تنظیمات حضور شرکت را از اینجا مدیریت کنید.</p>
        </div>
        <div className={styles.profileChip}>
          <span className={styles.avatar}>{avatarUrl ? <img src={avatarUrl} alt="" /> : <>{user.firstName.slice(0, 1)} {user.lastName.slice(0, 1)}</>}</span>
          <span><strong>{user.firstName} {user.lastName}</strong><small>{roleLabels[user.role]}</small></span>
        </div>
      </header>

      <div className={styles.settingsLayout}>
        <aside className={styles.settingsNav} aria-label="بخش‌های تنظیمات">
          <LayoutGroup id="settings-submenu-navigation">
          <p className={styles.navLabel}>تنظیمات حساب</p>
          <nav>
            {personalTabs.map((item) => <NavItem key={item.id} item={item} active={tab === item.id} onClick={() => chooseTab(item.id)} badge={item.id === "notifications" ? unreadNotifications : undefined} />)}
          </nav>
          {canManageCompany && <>
            <p className={`${styles.navLabel} ${styles.organizationLabel}`}>تنظیمات سازمان</p>
            <nav>
              {organizationTabs.filter((item) => canEditOrganization || ["company", "policy"].includes(item.id)).map((item) => <NavItem key={item.id} item={item} active={tab === item.id} onClick={() => chooseTab(item.id)} />)}
            </nav>
          </>}
          <div className={styles.navNote}><span>i</span><p>تنظیمات شخصی برای همه کاربران فعال است. تنظیمات سازمان بر اساس نقش نمایش داده می‌شود.</p></div>
          </LayoutGroup>
        </aside>

        <main className={styles.settingsContent}>
          <div className={styles.settingsFrame}>
          <div className={styles.contentHeader}>
            <div><p className={styles.contentKicker}>{activeTab.label}</p><h2>{activeTab.description}</h2></div>
            <span className={styles.secureBadge}><i />ذخیره‌سازی امن</span>
          </div>

          {tab === "details" && <section className={styles.settingsCard}>
            <CardHeader index="۰۱" title="اطلاعات شخصی" description="نام و اطلاعات تماس حساب خود را به‌روزرسانی کنید." />
            <form className={styles.form} onSubmit={saveProfile}>
              <div className={styles.formSection}><h3>مشخصات پایه</h3><p>این اطلاعات در حساب کاربری و درخواست‌های شما نمایش داده می‌شود.</p></div>
              <div className={styles.formGrid}>
                <label>نام<input name="firstName" defaultValue={user.firstName} required /></label>
                <label>نام خانوادگی<input name="lastName" defaultValue={user.lastName} required /></label>
                <label>نام کاربری<input value={user.username} dir="ltr" readOnly /></label>
                <label>کد پرسنلی<input value={user.employeeCode} dir="ltr" readOnly /></label>
                <label>ایمیل<input name="email" type="email" dir="ltr" defaultValue={user.email} placeholder="name@company.ir" /></label>
                <label>شماره تماس<input name="phone" dir="ltr" defaultValue={user.phone} placeholder="۰۹۱۲۱۲۳۴۵۶۷" /></label>
              </div>
              <label className={styles.avatarUpload}>تغییر تصویر پروفایل<input type="file" accept="image/*" onChange={uploadAvatar} disabled={busyAction === "avatar"} /></label><FormFooter message={message} type={messageType} action="ذخیره اطلاعات" loading={busyAction === "profile"} />
            </form>
          </section>}

          {tab === "password" && <section className={styles.settingsCard}>
            <CardHeader index="۰۲" title="رمز عبور" description="برای حفظ امنیت حساب، از یک رمز عبور قوی و منحصربه‌فرد استفاده کنید." />
            <PasswordForm message={message} messageType={messageType} setMessage={setMessage} setMessageType={setMessageType} />
          </section>}

          {tab === "sessions" && <section className={styles.settingsCard}>
            <CardHeader index="۰۳" title="نشست‌های فعال" description="دسترسی‌های فعال حساب خود را بررسی و در صورت نیاز خارج کنید." />
            <div className={styles.sessionRow}><span className={styles.sessionIcon}>⌘</span><div><strong>این دستگاه</strong><small>نشست فعلی · مرورگر مورد استفاده شما</small></div><span className={styles.statusActive}>فعال</span></div>
            <div className={styles.sessionHint}>با خروج از همه نشست‌ها، تمام دستگاه‌های دیگر نیز از حساب شما خارج می‌شوند.</div>
            <div className={styles.formFooter}><span /><button type="button" className="button danger" disabled={busyAction === "logout"} onClick={logoutAll}>{busyAction === "logout" ? "در حال خروج…" : "خروج از همه نشست‌ها"}</button></div>
          </section>}

          {tab === "notifications" && <section className={styles.settingsCard}>
            <CardHeader index="۰۴" title="اعلان‌ها" description="پیام‌های مربوط به درخواست‌ها، ورود فایل و تصمیم‌های مدیریتی را ببینید." />
            <div className={styles.notificationPanel}><span className={styles.notificationIcon}>◇</span><div><strong>{unreadNotifications ? `${unreadNotifications} اعلان خوانده‌نشده دارید` : "اعلان خوانده‌نشده‌ای ندارید"}</strong><p>مرکز اعلان‌ها وضعیت کامل رویدادهای حساب شما را نمایش می‌دهد.</p><a className="button secondary" href="/notifications">مشاهده همه اعلان‌ها</a></div></div>
          </section>}

          {tab === "company" && <section className={styles.settingsCard}>
            <CardHeader index="۰۵" title="پروفایل شرکت" description="اطلاعاتی که در گزارش‌ها، تقویم و محاسبات شرکت استفاده می‌شود." />
            <form className={styles.form} onSubmit={saveCompany}>
              <div className={styles.formGrid}>
                <label>نام نمایشی شرکت<input name="name" defaultValue={company.name} disabled={!canEditOrganization} required /></label>
                <label>منطقه زمانی<SelectField name="timezone" value={company.timezone} disabled={!canEditOrganization} options={[{ value: "Asia/Tehran", label: "ایران — تهران (Asia/Tehran)" }, { value: "UTC", label: "UTC" }]} /></label>
                <label>شروع هفته کاری<SelectField name="weekStartsOn" value={String(company.weekStartsOn)} disabled={!canEditOrganization} options={[{ value: "6", label: "شنبه" }, { value: "0", label: "یکشنبه" }]} /></label>
              </div>
              {!canEditOrganization && <div className={styles.readOnlyNote}>شما به اطلاعات شرکت دسترسی دارید، اما تغییر آن فقط توسط مدیر سامانه یا مدیر منابع انسانی انجام می‌شود.</div>}
              {canEditOrganization && <FormFooter message={message} type={messageType} action="ذخیره تنظیمات شرکت" loading={busyAction === "company"} />}
            </form>
          </section>}

          {tab === "policy" && <>
            {canEditOrganization && <section className={styles.settingsCard}><CardHeader index="۰۶" title="گروه‌های حضور و قوانین اختصاصی" description="برای هر گروه، کارکنان را دسته‌بندی و قانون حضور جداگانه تعیین کنید." /><GroupForm initial={groups} /><PolicyForm groups={groups} /></section>}
            {!canEditOrganization && <section className={styles.readOnlyNote}>قوانین حضور شرکت را مشاهده می‌کنید. ایجاد و فعال‌سازی نسخه جدید فقط برای مدیران مجاز است.</section>}
            <section className={styles.settingsCard}><CardHeader title="نسخه‌های قوانین حضور" description="نسخه فعال بر اساس تاریخ مؤثر برای هر روز انتخاب می‌شود." badge={`${policies.length} نسخه`} /><div className={styles.list}>{policies.length === 0 && <div className={styles.emptyState}>هنوز قانونی ثبت نشده است.</div>}{policies.map((policy) => <div className={styles.listRow} key={policy.id}><div className={styles.listIdentity}><span className={styles.listIcon}>◷</span><div><strong>{policy.name} · نسخه {policy.version}</strong><small>از {formatJalaliDate(policy.effectiveFrom)} · حداقل {policy.minimumDailyMinutes} دقیقه · {overtimeLabels[policy.overtimeMode] ?? policy.overtimeMode}</small></div></div><span className={policy.status === "ACTIVE" ? styles.statusActive : styles.statusDraft}>{policy.status === "ACTIVE" ? "فعال" : "پیش‌نویس"}</span></div>)}</div></section>
          </>}

          {tab === "device" && <section className={styles.settingsCard}><CardHeader title="منابع ثبت تردد" description="دستگاه‌ها و فایل‌های ورودی را برای پردازش حضور مدیریت کنید." action={<a className="button secondary" href="/imports">ورود فایل تردد</a>} /><div className={styles.list}>{devices.length === 0 && <div className={styles.emptyState}>هنوز دستگاهی ثبت نشده است.</div>}{devices.map((device) => <div className={styles.listRow} key={device.id}><div className={styles.listIdentity}><span className={styles.listIcon}>▣</span><div><strong>{device.name}</strong><small>{device.type}</small></div></div><span className={styles.statusActive}>فعال</span></div>)}</div></section>}

          {tab === "leave" && <section className={styles.settingsCard}><CardHeader title="دسته‌بندی‌های مرخصی" description="انواع قابل استفاده در درخواست‌های روزانه و ساعتی." /><div className={styles.list}>{leaveTypes.length === 0 && <div className={styles.emptyState}>هنوز نوع مرخصی ثبت نشده است.</div>}{leaveTypes.map((leaveType) => <div className={styles.listRow} key={leaveType.id}><div className={styles.listIdentity}><span className={styles.listIcon}>✦</span><div><strong>{leaveType.name}</strong><small>{leaveType.unit === "DAY" ? "واحد روزانه" : "واحد ساعتی"}</small></div></div><span className={styles.statusActive}>قابل استفاده</span></div>)}</div></section>}
          </div>
        </main>
      </div>
    </div>
  );
}

function NavItem({ item, active, onClick, badge }: { item: { id: SettingsTab; label: string; description: string; icon: string }; active: boolean; onClick: () => void; badge?: number }) {
  return <button type="button" className={`${styles.navItem} ${active ? styles.navItemActive : ""}`} onClick={onClick} aria-current={active ? "page" : undefined}>{active && <motion.span layoutId="settings-active-indicator" initial={false} className={styles.navActiveIndicator} transition={{ type: "tween", duration: .28, ease: "easeInOut" }} aria-hidden="true" />}<span className={styles.navIcon}>{item.icon}</span><span className={styles.navCopy}><strong>{item.label}</strong><small>{item.description}</small></span>{badge ? <b className={styles.navBadge}>{badge}</b> : <span className={styles.navArrow} aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="m9 6 6 6-6 6" /></svg></span>}</button>;
}

function CardHeader({ index, title, description, badge, action }: { index?: string; title: string; description: string; badge?: string; action?: ReactNode }) {
  return <div className={styles.cardHeader}><div><h3>{title}</h3><p>{description}</p></div>{action ?? (badge ? <span className={styles.counterBadge}>{badge}</span> : index ? <span className={styles.cardIndex}>{index}</span> : null)}</div>;
}

function FormFooter({ message, type, action, loading = false }: { message: string; type: "success" | "danger"; action: string; loading?: boolean }) {
  return <div className={styles.formFooter}><span>{message && <span className={type === "success" ? styles.successMessage : styles.errorMessage} role="status">{message}</span>}</span><button type="submit" className="button primary" disabled={loading}>{loading ? "در حال ذخیره…" : action}</button></div>;
}

function GroupForm({ initial }: { initial: { id: string; name: string }[] }) {
  const [groups, setGroups] = useState(initial);
  const [message, setMessage] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = event.currentTarget; const response = await fetch("/api/v1/groups", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.fromEntries(new FormData(form))) }); const result = await response.json(); if (response.ok) { setGroups([...groups, result.data]); setMessage("گروه ایجاد شد."); form.reset(); } else setMessage(result.error?.message ?? "ایجاد گروه انجام نشد."); }
  return <form className={styles.form} onSubmit={submit}><div className={styles.formGrid}><label>نام گروه<input name="name" placeholder="مثلاً گروه اضافه‌کار" required /></label><div className={styles.list}>{groups.map((group) => <span key={group.id} className={styles.counterBadge}>{group.name}</span>)}</div></div>{message && <div className={styles.successMessage}>{message}</div>}<button className="button secondary">افزودن گروه</button></form>;
}

function PasswordForm({ message, messageType, setMessage, setMessageType }: { message: string; messageType: "success" | "danger"; setMessage: (value: string) => void; setMessageType: (value: "success" | "danger") => void }) {
  const [loading, setLoading] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    const data = Object.fromEntries(new FormData(event.currentTarget));
    if (data.newPassword !== data.confirmPassword) { setMessageType("danger"); setMessage("تکرار رمز عبور با رمز جدید یکسان نیست."); return; }
    setLoading(true);
    try {
      const response = await fetch("/api/v1/auth/change-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ newPassword: data.newPassword }) });
      const result = await response.json();
      setMessageType(response.ok ? "success" : "danger");
      setMessage(response.ok ? "رمز عبور شما با موفقیت تغییر کرد." : result.error?.message ?? "تغییر رمز عبور انجام نشد.");
      if (response.ok) event.currentTarget.reset();
    } finally { setLoading(false); }
  }
  return <form className={styles.form} onSubmit={submit}><div className={`${styles.formGrid} ${styles.passwordGrid}`}><label>رمز عبور جدید<input name="newPassword" type="password" dir="ltr" minLength={10} autoComplete="new-password" required /><small>حداقل ۱۰ نویسه، شامل حرف بزرگ، حرف کوچک و عدد</small></label><label>تکرار رمز عبور<input name="confirmPassword" type="password" dir="ltr" minLength={10} autoComplete="new-password" required /><small className={styles.helperPlaceholder}>تکرار رمز عبور را وارد کنید.</small></label></div><div className={styles.formFooter}><span>{message && <span className={messageType === "success" ? styles.successMessage : styles.errorMessage} role="status">{message}</span>}</span><button type="submit" className="button primary" disabled={loading}>{loading ? "در حال ذخیره…" : "ذخیره رمز عبور"}</button></div></form>;
}
