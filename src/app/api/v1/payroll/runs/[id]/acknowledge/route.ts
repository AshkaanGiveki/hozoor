import { NextResponse } from "next/server";
import { audit } from "@/server/audit";
import { getCurrentUser } from "@/server/auth";
import { db } from "@/server/db";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  void request;
  const user = await getCurrentUser();
  if (!user?.employee) return NextResponse.json({ error: { code: "FORBIDDEN", message: "Employee access required." } }, { status: 403 });
  const { id } = await context.params;
  const run = await db.payrollRun.findFirst({ where: { id, employeeId: user.employee.id, publishedAt: { not: null }, period: { status: { in: ["APPROVED", "PAID", "LOCKED"] } } }, include: { period: { select: { companyId: true } } } });
  if (!run) return NextResponse.json({ error: { code: "NOT_FOUND", message: "Published payslip not found." } }, { status: 404 });
  const updated = await db.payrollRun.update({ where: { id }, data: { acknowledgedAt: new Date() } });
  await audit({ companyId: run.period.companyId, actorId: user.id, action: "payroll.payslip.acknowledge", entityType: "PayrollRun", entityId: id, after: { acknowledgedAt: updated.acknowledgedAt } });
  return NextResponse.json({ data: updated });
}
