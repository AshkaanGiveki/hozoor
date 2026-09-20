import { PayrollRuleStatus, PayrollPeriodStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { audit } from "@/server/audit";
import { db } from "@/server/db";
import { canManagePayroll } from "@/server/payroll";
import { getCurrentUser } from "@/server/auth";

const schema = z.object({ year: z.number().int().min(1300).max(1600), month: z.number().int().min(1).max(12), startDate: z.coerce.date(), endDate: z.coerce.date(), ruleSetId: z.string().uuid(), payrollPolicyId: z.string().uuid().nullable().optional() }).refine((value) => value.endDate > value.startDate, { message: "endDate must be after startDate" });

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !canManagePayroll(user.role)) return NextResponse.json({ error: { code: "FORBIDDEN", message: "Payroll administration access required." } }, { status: 403 });
  return NextResponse.json({ data: await db.payrollPeriod.findMany({ where: { companyId: user.companyId }, include: { ruleSet: { select: { id: true, name: true, calendarYear: true, version: true, checksum: true } }, _count: { select: { runs: true } } }, orderBy: [{ year: "desc" }, { month: "desc" }] }) });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || !canManagePayroll(user.role)) return NextResponse.json({ error: { code: "FORBIDDEN", message: "Payroll administration access required." } }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message || "Invalid payroll period." } }, { status: 400 });
  const input = parsed.data;
  const ruleSet = await db.payrollRuleSet.findFirst({ where: { id: input.ruleSetId, companyId: user.companyId, calendarYear: input.year, status: PayrollRuleStatus.APPROVED } });
  if (!ruleSet) return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "An approved rule set for this payroll year is required." } }, { status: 400 });
  const payrollPolicy = input.payrollPolicyId ? await db.payrollPolicy.findFirst({ where: { id: input.payrollPolicyId, companyId: user.companyId, status: "ACTIVE" } }) : null;
  if (input.payrollPolicyId && !payrollPolicy) return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "The selected company payroll policy is not active." } }, { status: 400 });
  try {
    const period = await db.payrollPeriod.create({ data: { companyId: user.companyId, ruleSetId: ruleSet.id, payrollPolicyId: payrollPolicy?.id ?? null, year: input.year, month: input.month, startDate: input.startDate, endDate: input.endDate, status: PayrollPeriodStatus.DRAFT, createdById: user.id } });
    await audit({ companyId: user.companyId, actorId: user.id, action: "payroll.period.create", entityType: "PayrollPeriod", entityId: period.id, after: input });
    return NextResponse.json({ data: period }, { status: 201 });
  } catch { return NextResponse.json({ error: { code: "CONFLICT", message: "This payroll period already exists." } }, { status: 409 }); }
}
