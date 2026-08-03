import { formatJalaliDateTime } from "@/lib/date-format";
import { getCurrentUser } from "@/server/auth";
import { db } from "@/server/db";

export default async function Notifications() {
  const user = await getCurrentUser();
  if (!user) return null;
  const items = await db.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 50 });
  return <>
    <div className="sectionTitle"><div><p className="eyebrow">مرکز پیام‌ها</p><h1>اعلان‌ها</h1><p>رویدادهای مرتبط با حساب و درخواست‌های شما</p></div></div>
    <section className="card">{items.length ? items.map((item) => <article key={item.id} style={{ padding: "15px 0", borderBottom: "1px solid var(--color-border-secondary)" }}><strong>{item.title}</strong><p style={{ color: "var(--color-text-secondary)", fontSize: 13 }}>{item.body}</p><small style={{ color: "var(--color-text-tertiary)" }}>{formatJalaliDateTime(item.createdAt)}</small></article>) : <div className="empty">اعلانی وجود ندارد.</div>}</section>
  </>;
}
