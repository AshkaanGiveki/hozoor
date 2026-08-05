import { getCurrentUser } from "@/server/auth";
import { db } from "@/server/db";
import SettingsClient from "@/components/SettingsClient";
import styles from "./page.module.scss";

export default async function Settings() {
  const user = await getCurrentUser();
  if (!user) return null;

  const canManageCompany = ["ADMIN", "HR_ADMIN", "MANAGER"].includes(user.role);
  const canEditOrganization = ["ADMIN", "HR_ADMIN"].includes(user.role);

  const [company, policies, devices, leaveTypes, groups, unreadNotifications] = await Promise.all([
    db.companyProfile.findUnique({ where: { id: user.companyId }, select: { name: true, timezone: true, weekStartsOn: true } }),
    canManageCompany
      ? db.attendancePolicy.findMany({ where: { companyId: user.companyId }, orderBy: { version: "desc" }, select: { id: true, name: true, version: true, status: true, effectiveFrom: true, minimumDailyMinutes: true, overtimeMode: true } })
      : Promise.resolve([]),
    canEditOrganization
      ? db.attendanceDevice.findMany({ where: { companyId: user.companyId }, orderBy: { name: "asc" }, select: { id: true, name: true, type: true } })
      : Promise.resolve([]),
    canEditOrganization
      ? db.leaveType.findMany({ where: { companyId: user.companyId }, orderBy: { name: "asc" }, select: { id: true, name: true, unit: true } })
      : Promise.resolve([]),
    canEditOrganization ? db.attendanceGroup.findMany({ where: { companyId: user.companyId, active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }) : Promise.resolve([]),
    db.notification.count({ where: { userId: user.id, readAt: null } }),
  ]);

  if (!company) {
    return (
      <section className={styles.accessCard}>
        <div className={styles.accessIcon} aria-hidden="true">!</div>
        <div>
          <p className={styles.eyebrow}>پیکربندی ناقص</p>
          <h1>پروفایل شرکت پیدا نشد</h1>
          <p>اطلاعات شرکت برای نمایش تنظیمات کامل نشده است. با مدیر سامانه تماس بگیرید.</p>
        </div>
      </section>
    );
  }

  return (
    <SettingsClient
      user={{
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
        role: user.role,
        email: user.employee?.email ?? "",
        phone: user.employee?.phone ?? "",
        employeeCode: user.employee?.employeeCode ?? "—",
        avatarUrl: user.avatarUrl,
      }}
      company={company}
      canManageCompany={canManageCompany}
      canEditOrganization={canEditOrganization}
      unreadNotifications={unreadNotifications}
      policies={policies.map((policy) => ({ ...policy, effectiveFrom: policy.effectiveFrom.toISOString() }))}
      devices={devices}
      leaveTypes={leaveTypes}
      groups={groups}
    />
  );
}
