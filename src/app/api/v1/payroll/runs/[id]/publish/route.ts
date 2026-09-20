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
  const run = await db.payrollRun.findFirst({ where: { id, period: { companyId: user.companyId, status: { in: ["APPROVED", "PAID", "LOCKED"] } } } });
  if (!run) return NextResponse.json({ error: { code: "NOT_FOUND", message: "Finalized payslip not found." } }, { status: 404 });
  const updated = await db.payrollRun.update({ where: { id }, data: { publishedAt: run.publishedAt ?? new Date() } });
  await audit({ companyId: user.companyId, actorId: user.id, action: "payroll.payslip.publish", entityType: "PayrollRun", entityId: id, after: { publishedAt: updated.publishedAt } });
  return NextResponse.json({ data: updated });
}
