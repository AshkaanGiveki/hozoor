import { NextResponse } from "next/server";
import { audit } from "@/server/audit";
import { getCurrentUser } from "@/server/auth";
import { db } from "@/server/db";
import { canManagePayroll } from "@/server/payroll";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  void request;
  const user = await getCurrentUser();
  if (!user || !canManagePayroll(user.role)) return NextResponse.json({ error: { code: "FORBIDDEN", message: "Payroll administration access required." } }, { status: 403 });
  const { id } = await context.params;
  const period = await db.payrollPeriod.findFirst({ where: { id, companyId: user.companyId, status: { in: ["APPROVED", "PAID", "LOCKED"] } }, include: { runs: { select: { id: true } } } });
  if (!period) return NextResponse.json({ error: { code: "CONFLICT", message: "Only approved, paid, or locked payroll can be published." } }, { status: 409 });
  const publishedAt = new Date();
  await db.payrollRun.updateMany({ where: { periodId: id }, data: { publishedAt } });
  await audit({ companyId: user.companyId, actorId: user.id, action: "payroll.payslip.publish_period", entityType: "PayrollPeriod", entityId: id, after: { count: period.runs.length, publishedAt } });
  return NextResponse.json({ data: { periodId: id, count: period.runs.length, publishedAt } });
}
