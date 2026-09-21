import { NextResponse } from "next/server";
import { z } from "zod";
import { audit } from "@/server/audit";
import { getCurrentUser } from "@/server/auth";
import { db } from "@/server/db";
import { canManagePayroll } from "@/server/payroll";

const schema = z.object({ reason: z.string().trim().min(3).max(1000) });

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !canManagePayroll(user.role)) return NextResponse.json({ error: { code: "FORBIDDEN", message: "Payroll administration access required." } }, { status: 403 });
  const { id } = await context.params;
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "A correction reason is required." } }, { status: 400 });
  const original = await db.payrollPeriod.findFirst({ where: { id, companyId: user.companyId }, select: { id: true, year: true, month: true, startDate: true, endDate: true, status: true, ruleSetId: true, payrollPolicyId: true } });
  if (!original) return NextResponse.json({ error: { code: "NOT_FOUND", message: "Payroll period not found." } }, { status: 404 });
  if (!["APPROVED", "PAID", "LOCKED"].includes(original.status)) return NextResponse.json({ error: { code: "CONFLICT", message: "Only finalized payroll can be corrected through a new revision." } }, { status: 409 });
  const latest = await db.payrollPeriod.aggregate({ where: { companyId: user.companyId, year: original.year, month: original.month }, _max: { revision: true } });
  const correction = await db.payrollPeriod.create({ data: { companyId: user.companyId, year: original.year, month: original.month, revision: (latest._max.revision ?? 0) + 1, startDate: original.startDate, endDate: original.endDate, ruleSetId: original.ruleSetId, payrollPolicyId: original.payrollPolicyId, status: "DRAFT", createdById: user.id, correctionOfId: original.id, correctionReason: parsed.data.reason } });
  await audit({ companyId: user.companyId, actorId: user.id, action: "payroll.period.correction.create", entityType: "PayrollPeriod", entityId: correction.id, before: { originalPeriodId: original.id, status: original.status }, after: { correctionPeriodId: correction.id, revision: correction.revision, reason: parsed.data.reason } });
  return NextResponse.json({ data: correction }, { status: 201 });
}
