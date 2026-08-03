import { getCurrentUser } from "@/server/auth";
import { db } from "@/server/db";
import { employeeScopeWhere } from "@/server/permissions";
import { toGregorian, toJalaali } from "jalaali-js";
import { formatJalaliDate, formatJalaliDateTime } from "@/lib/date-format";
import styles from "./page.module.scss";

const faNumber = (value: number) => new Intl.NumberFormat("fa-IR").format(value);
const minutes = (value: number) => `${Math.floor(value / 60)} ساعت و ${value % 60} دقیقه`;
const shortMinutes = (value: number) => `${Math.floor(value / 60)}:${String(value % 60).padStart(2, "0")}`;
const keyOf = (date: Date) => date.toISOString().slice(0, 10);
const roleLabels: Record<string, string> = { ADMIN: "مدیر سامانه", HR_ADMIN: "مدیر منابع انسانی", MANAGER: "مدیر تیم", EMPLOYEE: "کارمند", AUDITOR: "حسابرس" };

export default async function Dashboard() {
  const user = await getCurrentUser();
  if (!user) return null;

  const now = new Date();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const from = new Date(today);
  from.setDate(from.getDate() - 13);
  const currentJalali = toJalaali(today.getFullYear(), today.getMonth() + 1, today.getDate());
  const monthStartJalali = toGregorian(currentJalali.jy, currentJalali.jm, 1);
  const monthFrom = new Date(monthStartJalali.gy, monthStartJalali.gm - 1, monthStartJalali.gd);
  const disciplineFrom = new Date(today);
  disciplineFrom.setDate(disciplineFrom.getDate() - 29);
  const scope = await employeeScopeWhere(user);

  const [todayRows, recentRows, monthRows, monthPendingLeave, monthPendingOffTime, monthPendingCorrections, disciplineRows, pending, employeeCount, notifications] = await Promise.all([
    db.attendanceDay.findMany({ where: { companyId: user.companyId, date: today, employee: scope }, include: { employee: true } }),
    db.attendanceDay.findMany({ where: { companyId: user.companyId, date: { gte: from, lte: today }, employee: scope }, orderBy: { date: "asc" }, include: { employee: true } }),
    user.employee ? db.attendanceDay.findMany({ where: { companyId: user.companyId, employeeId: user.employee.id, date: { gte: monthFrom, lte: today } }, orderBy: { date: "asc" } }) : Promise.resolve([]),
    user.employee ? db.leaveRequest.findMany({ where: { companyId: user.companyId, employeeId: user.employee.id, status: { in: ["SUBMITTED", "PENDING_MANAGER", "PENDING_ADMIN"] }, startDate: { lte: today }, endDate: { gte: monthFrom } }, select: { startDate: true, endDate: true } }) : Promise.resolve([]),
    user.employee ? db.offTimeRequest.findMany({ where: { companyId: user.companyId, employeeId: user.employee.id, status: { in: ["SUBMITTED", "PENDING_MANAGER", "PENDING_ADMIN"] }, date: { gte: monthFrom, lte: today } }, select: { date: true } }) : Promise.resolve([]),
    user.employee ? db.attendanceCorrectionRequest.findMany({ where: { companyId: user.companyId, employeeId: user.employee.id, status: { in: ["SUBMITTED", "PENDING_MANAGER", "PENDING_ADMIN"] }, date: { gte: monthFrom, lte: today } }, select: { date: true } }) : Promise.resolve([]),
    db.attendanceDay.findMany({ where: { companyId: user.companyId, date: { gte: disciplineFrom, lte: today }, employee: scope }, orderBy: { date: "asc" }, include: { employee: true } }),
    db.leaveRequest.count({ where: { companyId: user.companyId, status: { in: ["SUBMITTED", "PENDING_MANAGER", "PENDING_ADMIN"] }, employee: scope } }),
    db.employee.count({ where: scope }),
    db.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 4 }),
  ]);

  const focusedDay = user.employee ? todayRows.find((row) => row.employeeId === user.employee?.id) : null;
  const presentToday = todayRows.filter((row) => ["PRESENT", "MISSION", "REMOTE_WORK"].includes(row.status)).length;
  const leaveToday = todayRows.filter((row) => ["ON_LEAVE", "PARTIAL_LEAVE", "OFF_TIME", "PARTIAL_OFF_TIME"].includes(row.status)).length;
  const reviewDays = recentRows.filter((row) => ["INSUFFICIENT_TIME", "INCOMPLETE", "ABSENT"].includes(row.status)).length;
  const recentWork = recentRows.reduce((sum, row) => sum + row.validWorkMinutes, 0);
  const recentRequired = recentRows.reduce((sum, row) => sum + row.requiredMinutes, 0);
  const attendanceRate = employeeCount ? Math.round((presentToday / employeeCount) * 100) : 0;
  const trend = Array.from({ length: 14 }, (_, index) => {
    const date = new Date(from);
    date.setDate(from.getDate() + index);
    const dateKey = keyOf(date);
    const rows = recentRows.filter((row) => keyOf(new Date(row.date)) === dateKey);
    return { label: new Intl.DateTimeFormat("fa-IR-u-ca-persian", { day: "numeric", month: "short" }).format(date), value: rows.filter((row) => ["PRESENT", "MISSION", "REMOTE_WORK"].includes(row.status)).length, total: rows.length };
  });
  const discipline = buildDiscipline(disciplineRows);
  const isManagement = ["ADMIN", "HR_ADMIN", "MANAGER"].includes(user.role);
  const monthlyHealth = buildMonthlyHealth(monthRows, monthPendingLeave, monthPendingOffTime, monthPendingCorrections);

  return <div className={styles.page}>
    <header className={styles.pageHead}>
      <div><p className={styles.dateLine}>{formatJalaliDate(now)}</p><div className={styles.headingLine}><h1>سلام، {user.firstName}</h1><span className={styles.roleBadge}>{roleLabels[user.role]}</span></div><p className={styles.subtitle}>نمای کلی وضعیت حضور و درخواست‌های شما</p></div>
      <a className="button primary" href="/requests">ثبت درخواست جدید <span>＋</span></a>
    </header>

    <section className={styles.metricsGrid} aria-label="شاخص‌های اصلی">
      <Metric icon="◷" tone="purple" label={user.employee ? "وضعیت حضور امروز" : "نرخ حضور امروز"} value={user.employee ? (focusedDay ? (focusedDay.status === "PRESENT" ? "حاضر" : "نیازمند بررسی") : "ثبت نشده") : `${faNumber(attendanceRate)}٪`} detail={user.employee ? (focusedDay ? shortMinutes(focusedDay.validWorkMinutes) : "بدون محاسبه") : `${faNumber(presentToday)} نفر از ${faNumber(employeeCount)}`} />
      <Metric icon="✓" tone="green" label="کارکرد ۱۴ روز اخیر" value={shortMinutes(recentWork)} detail={`هدف برنامه: ${shortMinutes(recentRequired)}`} />
      <Metric icon="□" tone="amber" label="درخواست‌های در انتظار" value={faNumber(pending)} detail="در صف بررسی مجاز شما" />
      <Metric icon="!" tone="red" label="روزهای نیازمند بررسی" value={faNumber(reviewDays)} detail={reviewDays ? "کمبود، غیبت یا ثبت ناقص" : "وضعیت پایدار"} />
    </section>

    {user.employee && <MonthlyHealth health={monthlyHealth} />}

    <section className={styles.primaryGrid}>
      <article className={styles.chartCard}>
        <div className={styles.cardHeader}><div><p className={styles.cardEyebrow}>روند واقعی ثبت‌شده</p><h2>روند حضور در دو هفته اخیر</h2><p>تعداد رکوردهای حضور کامل در هر روز</p></div><span className={styles.chartLegend}><i />حضور ثبت‌شده</span></div>
        <DashboardTrend values={trend} />
      </article>
      <article className={styles.todayCard}>
        <div className={styles.cardHeader}><div><p className={styles.cardEyebrow}>نمای امروز</p><h2>{user.employee ? "کارکرد شخصی" : "وضعیت تیم"}</h2><p>آخرین محاسبه حضور امروز</p></div><a href="/attendance">جزئیات</a></div>
        {user.employee ? <PersonalToday day={focusedDay} /> : <TeamToday present={presentToday} leave={leaveToday} total={employeeCount} rate={attendanceRate} />}
      </article>
    </section>

    {isManagement && <DisciplineBoard employees={discipline} />}

    <section className={styles.secondaryGrid}>
      <article className={styles.activityCard}><div className={styles.cardHeader}><div><h2>آخرین اعلان‌ها</h2><p>رویدادهای مرتبط با حساب شما</p></div><a href="/notifications">مشاهده همه</a></div>{notifications.length ? <div className={styles.notificationList}>{notifications.map((item) => <a className={styles.notification} href={item.href ?? "/notifications"} key={item.id}><span className={styles.notificationDot} /><span><strong>{item.title}</strong><small>{item.body}</small></span><time>{formatJalaliDateTime(item.createdAt)}</time></a>)}</div> : <div className={styles.empty}>اعلان جدیدی وجود ندارد.</div>}</article>
      <article className={styles.quickCard}><div className={styles.cardHeader}><div><h2>دسترسی سریع</h2><p>کارهای پرتکرار شما</p></div></div><div className={styles.quickGrid}><QuickLink href="/requests?kind=correction" icon="⌁" title="اصلاح تردد" detail="ورود یا خروج ناقص" /><QuickLink href="/requests?kind=leave" icon="◫" title="درخواست مرخصی" detail="روزانه یا ساعتی" /><QuickLink href="/requests?kind=offtime" icon="◷" title="خروج ساعتی" detail="ثبت مجوز خروج" /><QuickLink href="/reports" icon="▤" title="گزارش عملکرد" detail="مشاهده و دریافت خروجی" /></div></article>
    </section>

    <section className={styles.notice}><span>ⓘ</span><div><strong>حریم خصوصی در اولویت است</strong><p>هر کاربر فقط داده‌های مجاز نقش و حوزهٔ مدیریتی خود را مشاهده می‌کند. داده‌های نمودار بالا نیز با همین scope محاسبه شده‌اند.</p></div></section>
  </div>;
}

type DisciplineEmployee = { id: string; name: string; code: string; score: number; days: number; present: number; issues: number; lateMinutes: number; deficitMinutes: number };

type MonthlyHealthData = { total: number; clean: number; attention: number; pending: number; progress: number; status: "clean" | "attention" | "pending" };

function buildMonthlyHealth(rows: any[], pendingLeave: any[], pendingOffTime: any[], pendingCorrections: any[]): MonthlyHealthData {
  const pendingKeys = new Set<string>();
  for (const request of pendingLeave) {
    const start = new Date(request.startDate);
    const end = new Date(request.endDate);
    for (const cursor = new Date(start); cursor <= end && cursor <= new Date(); cursor.setDate(cursor.getDate() + 1)) pendingKeys.add(keyOf(cursor));
  }
  for (const request of [...pendingOffTime, ...pendingCorrections]) pendingKeys.add(keyOf(new Date(request.date)));

  const tracked = rows.filter((row) => row.requiredMinutes > 0 && !["HOLIDAY", "WEEKLY_OFF", "NOT_SCHEDULED"].includes(row.status));
  const clean = tracked.filter((row) => row.validWorkMinutes >= row.minimumMinutes || row.leaveMinutes > 0 || row.offTimeMinutes > 0 || ["MISSION", "REMOTE_WORK"].includes(row.status) || pendingKeys.has(keyOf(new Date(row.date)))).length;
  const attention = Math.max(0, tracked.length - clean);
  const pending = Array.from(pendingKeys).filter((date) => tracked.some((row) => keyOf(new Date(row.date)) === date)).length;
  const progress = tracked.length ? Math.round((clean / tracked.length) * 100) : 0;
  return { total: tracked.length, clean, attention, pending, progress, status: attention ? "attention" : pending ? "pending" : "clean" };
}

function MonthlyHealth({ health }: { health: MonthlyHealthData }) {
  const isClean = health.status === "clean";
  const isPending = health.status === "pending";
  const tone = isClean ? "clean" : isPending ? "pending" : "attention";
  return <section className={`${styles.monthlyHealth} ${styles[tone]}`} aria-label="وضعیت ماه جاری">
    <div className={styles.healthCopy}>
      <div className={styles.healthTitle}><span className={styles.healthIcon}>{isClean ? "✓" : isPending ? "◷" : "!"}</span><div><p className={styles.cardEyebrow}>بررسی سریع ماه جاری</p><h2>{isClean ? "وضعیت شما مرتب است" : isPending ? "وضعیت شما در انتظار بررسی است" : "این ماه نیاز به پیگیری دارد"}</h2></div></div>
      <p className={styles.healthDescription}>{health.total ? `از ${faNumber(health.total)} روز کاری ثبت‌شده تا امروز، ${faNumber(health.clean)} روز بدون کمبود ساعت یا مشکل نهایی بوده است.` : "هنوز روز کاری محاسبه‌شده‌ای برای این ماه وجود ندارد."}</p>
      <div className={styles.healthChips}><span className={styles.chipGood}>روزهای سالم <b>{faNumber(health.clean)}</b></span><span className={styles.chipWarn}>نیازمند پیگیری <b>{faNumber(health.attention)}</b></span>{health.pending > 0 && <span className={styles.chipPending}>در انتظار تصمیم <b>{faNumber(health.pending)}</b></span>}</div>
    </div>
    <div className={styles.healthProgress} style={{ "--progress": `${health.progress * 3.6}deg` } as React.CSSProperties}><div><strong>{faNumber(health.progress)}٪</strong><small>سلامت ماه</small></div></div>
    <a className={styles.healthAction} href="/attendance">مشاهده جزئیات ماه <LeftArrow /></a>
  </section>;
}

function buildDiscipline(rows: any[]): DisciplineEmployee[] {
  const grouped = new Map<string, { name: string; code: string; days: number; present: number; issues: number; lateMinutes: number; deficitMinutes: number }>();
  for (const row of rows) {
    const current = grouped.get(row.employeeId) ?? { name: `${row.employee.firstName} ${row.employee.lastName}`, code: row.employee.employeeCode, days: 0, present: 0, issues: 0, lateMinutes: 0, deficitMinutes: 0 };
    current.days += 1;
    if (["PRESENT", "MISSION", "REMOTE_WORK"].includes(row.status)) current.present += 1;
    if (["ABSENT", "INCOMPLETE", "INSUFFICIENT_TIME"].includes(row.status) || row.lateMinutes > 0 || row.earlyDepartureMinutes > 0) current.issues += 1;
    current.lateMinutes += row.lateMinutes ?? 0;
    current.deficitMinutes += row.deficitMinutes ?? 0;
    grouped.set(row.employeeId, current);
  }
  return Array.from(grouped.entries()).map(([id, item]) => ({ ...item, id, score: Math.max(0, Math.min(100, Math.round((item.present / Math.max(item.days, 1)) * 100 - item.issues * 7 - item.lateMinutes / 30 - item.deficitMinutes / 120))) })).sort((left, right) => right.score - left.score);
}

function DisciplineBoard({ employees }: { employees: DisciplineEmployee[] }) {
  const eligible = employees.filter((employee) => employee.days >= 2);
  const pool = eligible.length ? eligible : employees;
  const best = pool.slice(0, 3);
  const worst = pool.slice().sort((left, right) => left.score - right.score).slice(0, 3);
  return <section className={styles.disciplineSection}><div className={styles.sectionIntro}><div><p className={styles.cardEyebrow}>تحلیل ۳۰ روز اخیر</p><h2>انضباط حضور کارکنان</h2><p>رتبه‌بندی بر اساس حضور کامل، تأخیر، کسری ساعت و روزهای نیازمند بررسی</p></div><span className={styles.sectionInfo}>فقط داده‌های حوزه مجاز</span></div><div className={styles.disciplineGrid}><DisciplineCard title="منظم‌ترین کارکنان" description="پایدارترین الگوی حضور" tone="best" icon="↑" employees={best} /><DisciplineCard title="نیازمند توجه" description="بیشترین نشانه‌های بی‌نظمی" tone="needs" icon="!" employees={worst} /></div></section>;
}

function DisciplineCard({ title, description, tone, icon, employees }: { title: string; description: string; tone: "best" | "needs"; icon: string; employees: DisciplineEmployee[] }) {
  return <article className={`${styles.disciplineCard} ${styles[tone]}`}><div className={styles.disciplineHeader}><span className={styles.disciplineIcon}>{icon}</span><div><h3>{title}</h3><p>{description}</p></div></div>{employees.length ? <div className={styles.disciplineList}>{employees.map((employee, index) => <div className={styles.disciplineItem} key={employee.id}><span className={styles.rank}>{faNumber(index + 1)}</span><div className={styles.employeeIdentity}><strong>{employee.name}</strong><small>{employee.code} · {faNumber(employee.days)} روز بررسی</small></div><div className={styles.employeeScore}><strong>{faNumber(employee.score)}</strong><small>امتیاز</small></div><div className={styles.scoreBar}><i style={{ width: `${employee.score}%` }} /></div><div className={styles.disciplineMeta}><span>حضور کامل {faNumber(employee.present)}</span><span>{employee.issues ? `${faNumber(employee.issues)} روز مسئله‌دار` : "بدون مسئله"}</span></div></div>)}</div> : <div className={styles.empty}>داده کافی برای رتبه‌بندی وجود ندارد.</div>}</article>;
}

function Metric({ icon, tone, label, value, detail }: { icon: string; tone: string; label: string; value: string; detail: string }) { return <article className={`${styles.metric} ${styles[tone]}`}><span className={styles.metricIcon}>{icon}</span><div><span className={styles.metricLabel}>{label}</span><strong>{value}</strong><small>{detail}</small></div><span className={styles.metricMenu}>•••</span></article>; }

function DashboardTrend({ values }: { values: Array<{ label: string; value: number; total: number }> }) {
  const max = Math.max(...values.map((item) => item.total), 1);
  const points = values.map((item, index) => `${(index / (values.length - 1)) * 100},${100 - (item.value / max) * 82}`).join(" ");
  return <div className={styles.trend}><div className={styles.trendChart}><div className={styles.chartGrid}><span /><span /><span /><span /></div><svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="نمودار روند حضور"><polyline points={points} fill="none" vectorEffect="non-scaling-stroke" /><polygon points={`0,100 ${points} 100,100`} /></svg></div><div className={styles.trendLabels}>{values.map((item) => <span key={item.label}>{item.label}</span>)}</div></div>;
}

function PersonalToday({ day }: { day: any }) { const progress = day?.requiredMinutes ? Math.min(100, (day.validWorkMinutes / day.requiredMinutes) * 100) : 0; return day ? <div className={styles.personalToday}><div className={styles.todayStatus}><span className={`status ${day.status.toLowerCase()}`}>{day.status === "PRESENT" ? "حضور کامل" : day.status === "INSUFFICIENT_TIME" ? "کمبود ساعت کاری" : day.status}</span><strong>{shortMinutes(day.validWorkMinutes)}</strong><small>کارکرد معتبر امروز</small></div><div className={styles.progressRing} style={{ "--progress": `${progress * 3.6}deg` } as React.CSSProperties}><div><strong>{faNumber(Math.round(progress))}٪</strong><small>از هدف روزانه</small></div></div><div className={styles.todayMeta}><span>ورود<strong>{day.firstIn ? new Date(day.firstIn).toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" }) : "—"}</strong></span><span>خروج<strong>{day.lastOut ? new Date(day.lastOut).toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" }) : "—"}</strong></span></div></div> : <div className={styles.empty}>برای امروز هنوز داده‌ای محاسبه نشده است.</div>; }
function TeamToday({ present, leave, total, rate }: { present: number; leave: number; total: number; rate: number }) { return <div className={styles.teamToday}><div className={styles.teamRate}><strong>{faNumber(rate)}٪</strong><span>نرخ حضور امروز</span></div><div className={styles.teamBars}><span><i className={styles.presentBar} style={{ width: `${total ? (present / total) * 100 : 0}%` }} /><b>حاضر</b><em>{faNumber(present)}</em></span><span><i className={styles.leaveBar} style={{ width: `${total ? (leave / total) * 100 : 0}%` }} /><b>مرخصی / مجاز</b><em>{faNumber(leave)}</em></span><span><i className={styles.remainingBar} style={{ width: `${total ? Math.max(0, ((total - present - leave) / total) * 100) : 0}%` }} /><b>بدون ثبت</b><em>{faNumber(Math.max(0, total - present - leave))}</em></span></div></div>; }
function LeftArrow() { return <svg className={styles.leftArrow} viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M16 10H4M9 5l-5 5 5 5" /></svg>; }
function QuickLink({ href, icon, title, detail }: { href: string; icon: string; title: string; detail: string }) { return <a href={href} className={styles.quickLink}><span>{icon}</span><div><strong>{title}</strong><small>{detail}</small></div><LeftArrow /></a>; }
