import { PayrollPaymentStatus, PayrollPeriodStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { audit } from "@/server/audit";
import { getCurrentUser } from "@/server/auth";
import { db } from "@/server/db";
import { canApprovePayrollPeriod, canManagePayroll, payrollPeriodTransitions } from "@/server/payroll";

const schema = z.object({ status: z.enum([PayrollPeriodStatus.IN_REVIEW, PayrollPeriodStatus.APPROVED, PayrollPeriodStatus.PAID, PayrollPeriodStatus.LOCKED, PayrollPeriodStatus.REVERSED, PayrollPeriodStatus.CORRECTED]) });

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  void request;
  const user = await getCurrentUser();
  if (!user || !canManagePayroll(user.role)) return NextResponse.json({ error: { code: "FORBIDDEN", message: "Payroll administration access required." } }, { status: 403 });
  const { id } = await context.params;
  const period = await db.payrollPeriod.findFirst({ where: { id, companyId: user.companyId }, include: { ruleSet: true, runs: { include: { employee: { select: { employeeCode: true, firstName: true, lastName: true } }, lines: true, payment: true }, orderBy: { employee: { employeeCode: "asc" } } } } });
  if (!period) return NextResponse.json({ error: { code: "NOT_FOUND", message: "Payroll period not found." } }, { status: 404 });
  return NextResponse.json({ data: period });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !canManagePayroll(user.role)) return NextResponse.json({ error: { code: "FORBIDDEN", message: "Payroll administration access required." } }, { status: 403 });
  const { id } = await context.params;
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Invalid payroll state." } }, { status: 400 });
  const existing = await db.payrollPeriod.findFirst({ where: { id, companyId: user.companyId }, include: { payments: true } });
  if (!existing) return NextResponse.json({ error: { code: "NOT_FOUND", message: "Payroll period not found." } }, { status: 404 });
  const next = parsed.data.status;
  if (!payrollPeriodTransitions[existing.status].includes(next)) return NextResponse.json({ error: { code: "CONFLICT", message: `Cannot move payroll from ${existing.status} to ${next}.` } }, { status: 409 });
  if (next === PayrollPeriodStatus.APPROVED && !canApprovePayrollPeriod(existing.status, existing.createdById, user.id)) return NextResponse.json({ error: { code: "MAKER_CHECKER_REQUIRED", message: "Payroll must be submitted for review and approved by a different payroll administrator." } }, { status: 409 });
  if (next === PayrollPeriodStatus.APPROVED && existing.payments.length === 0) return NextResponse.json({ error: { code: "CONFLICT", message: "A calculated payroll must contain payment records before approval." } }, { status: 409 });
  if (next === PayrollPeriodStatus.PAID && existing.payments.some((payment) => payment.status !== PayrollPaymentStatus.PAID)) return NextResponse.json({ error: { code: "CONFLICT", message: "Every employee payment must be confirmed before the payroll is marked paid." } }, { status: 409 });
  const data = { status: next, approvedAt: next === PayrollPeriodStatus.APPROVED ? new Date() : existing.approvedAt, approvedById: next === PayrollPeriodStatus.APPROVED ? user.id : existing.approvedById, paidAt: next === PayrollPeriodStatus.PAID ? new Date() : existing.paidAt, lockedAt: next === PayrollPeriodStatus.LOCKED ? new Date() : existing.lockedAt };
  const updated = await db.payrollPeriod.update({ where: { id }, data });
  await audit({ companyId: user.companyId, actorId: user.id, action: "payroll.period.status", entityType: "PayrollPeriod", entityId: id, before: { status: existing.status }, after: { status: next } });
  return NextResponse.json({ data: updated });
}
