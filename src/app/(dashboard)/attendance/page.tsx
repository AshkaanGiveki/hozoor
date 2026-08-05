import { getCurrentUser } from "@/server/auth";
import { db } from "@/server/db";
import { employeeScopeWhere } from "@/server/permissions";
import AttendanceCalendar, { type AttendanceCalendarRecord } from "@/components/AttendanceCalendar";
import styles from "./page.module.scss";

const statusLabels: Record<string, string> = {
  INSUFFICIENT_TIME: "کمبود ساعت کاری",
  PRESENT: "حضور کامل",
  ABSENT: "غیبت",
  INCOMPLETE: "ثبت ناقص",
  ON_LEAVE: "مرخصی تأییدشده",
  PARTIAL_OFF_TIME: "خروج ساعتی تأییدشده",
  HOLIDAY: "تعطیل رسمی",
  WEEKLY_OFF: "روز استراحت",
  NOT_SCHEDULED: "بدون برنامه",
  MISSION: "مأموریت",
  REMOTE_WORK: "دورکاری",
  PARTIAL_LEAVE: "مرخصی ساعتی",
  OFF_TIME: "خروج ساعتی",
};

export default async function Attendance() {
  const user = await getCurrentUser();
  if (!user) return null;

  const from = new Date(Date.now() - 45 * 86400000);
  const rows = await db.attendanceDay.findMany({
    where: {
      companyId: user.companyId,
      date: { gte: from },
      employee: await employeeScopeWhere(user),
    },
    include: { employee: true },
    orderBy: { date: "asc" },
    take: 300,
  });

  const records: AttendanceCalendarRecord[] = rows.map((row) => ({
    id: row.id,
    date: row.date.toISOString().slice(0, 10),
    employee: {
      name: `${row.employee.firstName} ${row.employee.lastName}`,
      code: row.employee.employeeCode,
    },
    status: row.status,
    statusLabel: statusLabels[row.status] ?? "نامشخص",
    firstIn: row.firstIn?.toISOString() ?? null,
    lastOut: row.lastOut?.toISOString() ?? null,
    validWorkMinutes: row.validWorkMinutes,
    requiredMinutes: row.requiredMinutes,
    deficitMinutes: row.deficitMinutes,
    lateMinutes: row.lateMinutes,
    earlyDepartureMinutes: row.earlyDepartureMinutes,
    anomalies: row.anomalies,
  }));

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <p className={styles.breadcrumb}>حضور و غیاب / تقویم حضور</p>
          <h1>تقویم حضور</h1>
          <p className={styles.subtitle}>وضعیت ورود، خروج و کارکرد روزانه را در یک نگاه ببینید.</p>
        </div>
        <div className={styles.headerActions}>
          <a className="button secondary" href="/reports">گزارش کامل</a>
          <a className="button primary" href="/requests?kind=correction">درخواست اصلاح تردد</a>
        </div>
      </header>
      <AttendanceCalendar records={records} />
    </div>
  );
}
