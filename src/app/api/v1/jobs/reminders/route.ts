import { RoleCode } from "@prisma/client";
import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { dispatchNotification } from "@/server/notification-dispatcher";

export async function POST(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  if (!process.env.CRON_SECRET || token !== process.env.CRON_SECRET) return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Invalid scheduler credentials." } }, { status: 401 });
  const companies = await db.companyProfile.findMany({ select: { id: true } }); let delivered = 0; const failures: Array<{ companyId: string; userId: string; reason?: string; status?: number; providerBody?: string }> = [];
  for (const company of companies) {
    const [leave, offtime, correction] = await Promise.all([
      db.leaveRequest.count({ where: { companyId: company.id, status: { in: ["PENDING_MANAGER", "PENDING_ADMIN"] } } }),
      db.offTimeRequest.count({ where: { companyId: company.id, status: { in: ["PENDING_MANAGER", "PENDING_ADMIN"] } } }),
      db.attendanceCorrectionRequest.count({ where: { companyId: company.id, status: { in: ["PENDING_MANAGER", "PENDING_ADMIN"] } } }),
    ]);
    const pending = leave + offtime + correction; if (!pending) continue;
    const recipients = await db.user.findMany({ where: { companyId: company.id, role: { in: [RoleCode.ADMIN, RoleCode.HR_ADMIN, RoleCode.MANAGER] }, status: "ACTIVE" }, select: { id: true } });
    for (const recipient of recipients) {
      const today = new Date(); today.setUTCHours(0, 0, 0, 0);
      const exists = await db.notification.findFirst({ where: { userId: recipient.id, title: "Pending request reminder", createdAt: { gte: today } } });
      if (exists) continue;
      const notification = await db.notification.create({ data: { companyId: company.id, userId: recipient.id, title: "Pending request reminder", body: `${pending} request(s) are waiting for review.`, href: "/approvals" } });
      const result = await dispatchNotification({ companyId: company.id, userId: recipient.id, title: notification.title, body: notification.body, href: notification.href });
      if (result.delivered) delivered++; else failures.push({ companyId: company.id, userId: recipient.id, reason: result.reason, status: result.status, providerBody: result.providerBody });
    }
  }
  return NextResponse.json({ data: { delivered, failed: failures.length, failures } }, { status: failures.length ? 502 : 200 });
}
