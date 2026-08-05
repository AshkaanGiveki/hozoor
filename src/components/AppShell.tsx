"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import styles from "./AppShell.module.scss";

type Props = {
  children: React.ReactNode;
  user: { firstName: string; lastName: string; role: string; mustChangePassword: boolean; avatarUrl?: string | null };
};

type IconName =
  | "dashboard"
  | "attendance"
  | "requests"
  | "approvals"
  | "reports"
  | "employees"
  | "imports"
  | "settings"
  | "support"
  | "bell"
  | "logout"
  | "sun"
  | "user"
  | "chevron";

type NavItem = { href: string; label: string; caption: string; icon: IconName; roles?: string[]; badge?: number };

const navItems: NavItem[] = [
  { href: "/dashboard", label: "داشبورد", caption: "نمای کلی سامانه", icon: "dashboard" },
  { href: "/attendance", label: "حضور و غیاب", caption: "تقویم و کارکرد", icon: "attendance" },
  { href: "/requests", label: "درخواست‌ها", caption: "مرخصی و اصلاح تردد", icon: "requests" },
  { href: "/approvals", label: "صف تأییدها", caption: "درخواست‌های در انتظار", icon: "approvals", roles: ["ADMIN", "HR_ADMIN", "MANAGER"] },
  { href: "/reports", label: "گزارش‌ها", caption: "گزارش‌های مدیریتی", icon: "reports", roles: ["ADMIN", "HR_ADMIN", "MANAGER", "AUDITOR"] },
  { href: "/employees", label: "کارکنان", caption: "افراد و حوزه مدیریتی", icon: "employees", roles: ["ADMIN", "HR_ADMIN", "MANAGER"] },
  { href: "/imports", label: "ورود اطلاعات", caption: "فایل‌های دستگاه تردد", icon: "imports", roles: ["ADMIN", "HR_ADMIN"] },
  { href: "/settings", label: "تنظیمات", caption: "قوانین و شرکت", icon: "settings", roles: ["ADMIN", "HR_ADMIN"] },
];

function AppIcon({ name, size = 19 }: { name: IconName; size?: number }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  const paths: Record<IconName, React.ReactNode> = {
    dashboard: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
    attendance: <><circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3.5 2"/><path d="M5.8 3.8 4.2 5.4M18.2 3.8l1.6 1.6"/></>,
    requests: <><path d="M4 5.5h16v13H4z"/><path d="m4 7 8 5 8-5M8 3.5h8"/></>,
    approvals: <><circle cx="12" cy="12" r="8.5"/><path d="m8 12 2.6 2.6L16.5 9"/></>,
    reports: <><path d="M4 19V5M4 19h16"/><path d="m7 15 3-4 3 2 5-7"/></>,
    employees: <><circle cx="9" cy="8" r="3"/><path d="M3.5 20c.6-3.1 2.4-4.8 5.5-4.8s4.9 1.7 5.5 4.8"/><path d="M16 5.5a3 3 0 0 1 0 5.7M17 15.2c2.1.4 3.4 2 3.8 4.8"/></>,
    imports: <><path d="M12 15V3M8 7l4-4 4 4"/><path d="M5 13v6h14v-6"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-1.7 1.7-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5v.2h-2.4v-.2a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1L8 17l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H6.7v-2.4h.2a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9L8 8.6l1.7-1.7.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.5v-.2h2.4v.2a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9.3l.1-.1 1.7 1.7-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0-1.5 1h.2v2.4h-.2a1.7 1.7 0 0 0-1.5 1Z"/></>,
    support: <><path d="M4 13v-1a8 8 0 0 1 16 0v1"/><path d="M5 13H3v4h4v-4M19 13h2v4h-4v-4"/><path d="M17 19c-1 .8-2.6 1.3-5 1.3"/></>,
    bell: <><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 8.5h18C21 16 18 16 18 9ZM10 21h4"/></>,
    logout: <><path d="M10 4H5v16h5M14 8l4 4-4 4M8 12h10"/></>,
    sun: <><circle cx="12" cy="12" r="3.5"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></>,
    user: <><circle cx="12" cy="8" r="3.2"/><path d="M5 20c.7-3.3 3-5 7-5s6.3 1.7 7 5"/></>,
    chevron: <path d="m7 9 5 5 5-5"/>,
  };
  return <svg {...common}>{paths[name]}</svg>;
}

export default function AppShell({ children, user }: Props) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const path = usePathname();
  const visibleItems = useMemo(() => navItems.filter((item) => !item.roles || item.roles.includes(user.role)), [user.role]);
  const workspaceItems = visibleItems.filter((item) => ["/dashboard", "/attendance", "/requests", "/approvals", "/reports"].includes(item.href));
  const managementItems = visibleItems.filter((item) => ["/employees", "/imports", "/settings"].includes(item.href));

  useEffect(() => {
    const saved = localStorage.getItem("hozoor-theme");
    const isDark = saved === "dark" || (!saved && window.matchMedia("(prefers-color-scheme: dark)").matches);
    setDarkMode(isDark);
    if (isDark) document.documentElement.classList.add("dark");
  }, []);

  useEffect(() => { setPendingHref(null); }, [path]);
  useEffect(() => {
    function closeAccount(event: MouseEvent) { if (accountRef.current && !accountRef.current.contains(event.target as Node)) setAccountOpen(false); }
    function closeOnEscape(event: KeyboardEvent) { if (event.key === "Escape") setAccountOpen(false); }
    document.addEventListener("mousedown", closeAccount);
    document.addEventListener("keydown", closeOnEscape);
    return () => { document.removeEventListener("mousedown", closeAccount); document.removeEventListener("keydown", closeOnEscape); };
  }, []);

  function go(href: string) { if (pendingHref || href === path) return; setPendingHref(href); setMobileOpen(false); router.push(href); }
  async function logout() { if (loggingOut) return; setLoggingOut(true); setAccountOpen(false); await fetch("/api/v1/auth/logout", { method: "POST" }); router.push("/login"); router.refresh(); }
  function toggleTheme() { const next = !darkMode; setDarkMode(next); document.documentElement.classList.toggle("dark", next); localStorage.setItem("hozoor-theme", next ? "dark" : "light"); }
  function isActive(href: string) { const selectedPath = pendingHref ?? path; return selectedPath === href || selectedPath.startsWith(`${href}/`); }

  return <div className={`${styles.shell} ${styles.shellExpanded}`}>
    <aside
      className={`${styles.sidebar} ${styles.expanded} ${mobileOpen ? styles.mobileOpen : ""}`}
      aria-label="ناوبری سامانه"
    >
      <div className={styles.sidebarTop}>
        <button type="button" className={styles.brand} onClick={() => go("/dashboard")} aria-label="داشبورد">
          <span className={styles.brandMark}>ح</span>
          <span className={styles.brandText}><strong>سامانه حضور</strong><small>Hozoor workspace</small></span>
        </button>
        <span className={styles.currentPath}>{isActive("/dashboard") ? "نمای کلی سامانه" : "فضای کاری شرکت"}</span>
      </div>

      <LayoutGroup id="sidebar-navigation">
      <nav className={styles.nav}>
        <span className={styles.groupLabel}>عملیات روزانه</span>
        {workspaceItems.map((item) => <button key={item.href} type="button" title={item.label} aria-label={item.label} disabled={Boolean(pendingHref)} className={isActive(item.href) ? styles.active : ""} onClick={() => go(item.href)}>
            {isActive(item.href) && <motion.span layoutId="sidebar-active-indicator" initial={false} className={styles.activeIndicator} transition={{ type: "tween", duration: 0.19, ease: "easeInOut" }} />}<AppIcon name={item.icon}/><span className={styles.navText}><strong>{item.label}</strong><small>{item.caption}</small></span>{item.badge ? <b>{item.badge}</b> : null}
        </button>)}
        {managementItems.length > 0 && <span className={styles.groupLabel}>مدیریت سامانه</span>}
        {managementItems.map((item) => <button key={item.href} type="button" title={item.label} aria-label={item.label} disabled={Boolean(pendingHref)} className={isActive(item.href) ? styles.active : ""} onClick={() => go(item.href)}>
            {isActive(item.href) && <motion.span layoutId="sidebar-active-indicator" initial={false} className={styles.activeIndicator} transition={{ type: "tween", duration: 0.19, ease: "easeInOut" }} />}<AppIcon name={item.icon}/><span className={styles.navText}><strong>{item.label}</strong><small>{item.caption}</small></span>{item.badge ? <b>{item.badge}</b> : null}
        </button>)}
      </nav>
      </LayoutGroup>

      <div className={styles.sidebarBottom}>
        <div className={styles.utilityRow}>
          <a href="/notifications" title="اعلان‌ها" aria-label="اعلان‌ها" className={styles.utility} onClick={(event) => { event.preventDefault(); go("/notifications"); }}><AppIcon name="bell"/><span>اعلان‌ها</span><i /></a>
          <button type="button" title="تغییر پوسته" aria-label="تغییر پوسته" className={styles.utility} onClick={toggleTheme}><AppIcon name="sun"/><span>تغییر پوسته</span></button>
          <a href="/settings" title="پروفایل و تنظیمات" aria-label="پروفایل و تنظیمات" className={styles.utility} onClick={(event) => { event.preventDefault(); go("/settings"); }}><AppIcon name="user"/><span>پروفایل</span></a>
        </div>
        <div className={styles.accountArea} ref={accountRef}>
          <button type="button" className={styles.accountTrigger} aria-expanded={accountOpen} aria-haspopup="menu" onClick={() => setAccountOpen((open) => !open)}>
            <span className={styles.avatar}>{user.avatarUrl ? <img src={user.avatarUrl} alt="" /> : <>{user.firstName?.[0] ?? "ک"} {user.lastName?.[0] ?? ""}</>}</span>
            <span className={styles.accountText}><strong>{user.firstName} {user.lastName}</strong><small>{user.role === "ADMIN" ? "مدیر سامانه" : user.role === "HR_ADMIN" ? "مدیر منابع انسانی" : user.role === "MANAGER" ? "مدیر" : "کارمند"}</small></span>
            <span className={styles.accountChevron}><AppIcon name="chevron" size={17}/></span>
          </button>
          {accountOpen && <div className={styles.accountMenu} role="menu">
            <div className={styles.accountMenuHeader}><strong>حساب سازمانی</strong><small>محیط اختصاصی شرکت شما</small></div>
            <div className={styles.accountMenuItems}>
              <a href="/settings" role="menuitem" onClick={(event) => { event.preventDefault(); setAccountOpen(false); go("/settings"); }}><AppIcon name="user" size={17}/><span><strong>پروفایل و تنظیمات</strong><small>اطلاعات حساب و شرکت</small></span></a>
              <a href="/notifications" role="menuitem" onClick={(event) => { event.preventDefault(); setAccountOpen(false); go("/notifications"); }}><AppIcon name="bell" size={17}/><span><strong>اعلان‌ها</strong><small>پیگیری رویدادهای سامانه</small></span></a>
              <button type="button" role="menuitem" onClick={toggleTheme}><AppIcon name="sun" size={17}/><span><strong>تغییر پوسته</strong><small>{darkMode ? "حالت تاریک فعال است" : "حالت روشن فعال است"}</small></span><i className={`${styles.themeSwitch} ${darkMode ? styles.themeSwitchOn : ""}`} /></button>
            </div>
            <div className={styles.accountMenuDivider}/>
            <button type="button" className={styles.accountLogout} role="menuitem" disabled={loggingOut} onClick={logout}><AppIcon name="logout" size={17}/><span>{loggingOut ? "در حال خروج…" : "خروج از حساب"}</span></button>
            <div className={styles.accountMenuFooter}><span>Hozoor</span><span>نسخهٔ سازمانی</span></div>
          </div>}
        </div>
      </div>
    </aside>
    {mobileOpen && <button aria-label="بستن منو" className={styles.overlay} onClick={() => setMobileOpen(false)}/>} 
    <div className={styles.content}>
      <header className={styles.header} aria-busy={Boolean(pendingHref)}>
        <AnimatePresence>{pendingHref && <motion.div className={styles.routeProgress} initial={{ scaleX: 0, opacity: 0 }} animate={{ scaleX: 1, opacity: 1 }} exit={{ scaleX: 0, opacity: 0 }} transition={{ duration: .28 }} aria-hidden="true" />}</AnimatePresence>
        <button className={styles.menu} onClick={() => setMobileOpen(true)} aria-label="باز کردن منو">☰</button>
        <div className={styles.headerIdentity}><span className={styles.headerMark}>ح</span><div><p className="eyebrow">فضای کاری شرکت</p><h2>سامانه حضور و مرخصی</h2></div></div>
        <div className={styles.headerHint}><span className={styles.liveDot}/><span>همگام‌سازی فعال</span><small>امروز</small></div>
      </header>
      <main className={styles.main}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={path} className={styles.pageTransition} initial={{ opacity: 0, filter: "blur(7px)", y: 7 }} animate={{ opacity: 1, filter: "blur(0px)", y: 0 }} exit={{ opacity: 0, filter: "blur(7px)", y: -5 }} transition={{ duration: .24, ease: "easeOut" }}>
            {children}
          </motion.div>
        </AnimatePresence>
      </main>
      <footer className={styles.footer}>
        <a className={styles.footerBrand} href="/dashboard" onClick={(event) => { event.preventDefault(); go("/dashboard"); }}><span className={styles.footerMark}>ح</span><span>سامانه حضور</span></a>
        <span className={styles.copyright}>© {new Date().getFullYear()} سامانه حضور و مرخصی</span>
        <nav className={styles.footerLinks} aria-label="پیوندهای کمکی"><a href="/attendance" onClick={(event) => { event.preventDefault(); go("/attendance"); }}>راهنمای حضور</a><a href="/notifications" onClick={(event) => { event.preventDefault(); go("/notifications"); }}>پشتیبانی و اعلان‌ها</a></nav>
      </footer>
    </div>
  </div>;
}
