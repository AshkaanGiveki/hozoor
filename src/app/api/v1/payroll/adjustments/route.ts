import { NextResponse } from "next/server";
import { z } from "zod";
import { audit } from "@/server/audit";
import { getCurrentUser } from "@/server/auth";
import { db } from "@/server/db";
import { canManagePayroll } from "@/server/payroll";

const schema = z.object({ periodId: z.string().uuid(), employeeId: z.string().uuid(), code: z.string().trim().min(1).max(80), label: z.string().trim().min(1).max(160), amount: z.number().int(), taxable: z.boolean().default(false), insurable: z.boolean().default(false), reason: z.string().trim().min(3).max(1000) });

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || !canManagePayroll(user.role)) return NextResponse.json({ error: { code: "FORBIDDEN", message: "Payroll administration access required." } }, { status: 403 });
  const periodId = new URL(request.url).searchParams.get("periodId");
  return NextResponse.json({ data: await db.payrollAdjustment.findMany({ where: { companyId: user.companyId, periodId: periodId || undefined }, include: { employee: { select: { employeeCode: true, firstName: true, lastName: true } } }, orderBy: { createdAt: "desc" } }) });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || !canManagePayroll(user.role)) return NextResponse.json({ error: { code: "FORBIDDEN", message: "Payroll administration access required." } }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success || parsed.data.amount === 0) return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "An adjustment must have a non-zero amount." } }, { status: 400 });
  const input = parsed.data;
  const period = await db.payrollPeriod.findFirst({ where: { id: input.periodId, companyId: user.companyId }, select: { id: true, status: true } });
  const employee = await db.employee.findFirst({ where: { id: input.employeeId, companyId: user.companyId }, select: { id: true } });
  if (!period || !employee) return NextResponse.json({ error: { code: "NOT_FOUND", message: "Payroll period or employee not found." } }, { status: 404 });
  if (!["DRAFT", "CALCULATED", "IN_REVIEW", "CORRECTED"].includes(period.status)) return NextResponse.json({ error: { code: "CONFLICT", message: "Locked or paid payroll cannot receive direct adjustments." } }, { status: 409 });
  const adjustment = await db.payrollAdjustment.create({ data: { companyId: user.companyId, periodId: input.periodId, employeeId: input.employeeId, code: input.code, label: input.label, amount: input.amount, taxable: input.taxable, insurable: input.insurable, reason: input.reason, createdById: user.id } });
  await audit({ companyId: user.companyId, actorId: user.id, action: "payroll.adjustment.create", entityType: "PayrollAdjustment", entityId: adjustment.id, after: input });
  return NextResponse.json({ data: adjustment }, { status: 201 });
}
