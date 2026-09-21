import { PayrollRuleStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { audit } from "@/server/audit";
import { getCurrentUser } from "@/server/auth";
import { db } from "@/server/db";
import { canManagePayroll, validateRuleSetApproval } from "@/server/payroll";

const schema = z.object({ status: z.enum([PayrollRuleStatus.ACCOUNTING_REVIEWED, PayrollRuleStatus.LEGAL_REVIEWED, PayrollRuleStatus.APPROVED, PayrollRuleStatus.RETIRED]) });

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !canManagePayroll(user.role)) return NextResponse.json({ error: { code: "FORBIDDEN", message: "Payroll administration access required." } }, { status: 403 });
  const { id } = await context.params;
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Only staged review, approval, or retirement is allowed." } }, { status: 400 });
  const existing = await db.payrollRuleSet.findFirst({ where: { id, companyId: user.companyId } });
  if (!existing) return NextResponse.json({ error: { code: "NOT_FOUND", message: "Payroll rule set not found." } }, { status: 404 });
  if (existing.status === PayrollRuleStatus.RETIRED) return NextResponse.json({ error: { code: "CONFLICT", message: "A retired rule set cannot be changed." } }, { status: 409 });
  const transitions = { [PayrollRuleStatus.DRAFT]: PayrollRuleStatus.ACCOUNTING_REVIEWED, [PayrollRuleStatus.ACCOUNTING_REVIEWED]: PayrollRuleStatus.LEGAL_REVIEWED, [PayrollRuleStatus.LEGAL_REVIEWED]: PayrollRuleStatus.APPROVED } as const;
  if (parsed.data.status !== PayrollRuleStatus.RETIRED && transitions[existing.status as keyof typeof transitions] !== parsed.data.status) return NextResponse.json({ error: { code: "CONFLICT", message: "Rule sets must move through accounting review, legal review, then approval." } }, { status: 409 });
  if (parsed.data.status === PayrollRuleStatus.ACCOUNTING_REVIEWED && existing.createdById === user.id) return NextResponse.json({ error: { code: "CONFLICT", message: "The rule creator cannot perform the accounting review." } }, { status: 409 });
  if (parsed.data.status === PayrollRuleStatus.LEGAL_REVIEWED && existing.accountingReviewedById === user.id) return NextResponse.json({ error: { code: "CONFLICT", message: "The accounting reviewer cannot perform the legal review." } }, { status: 409 });
  if (parsed.data.status === PayrollRuleStatus.APPROVED && existing.legalReviewedById === user.id) return NextResponse.json({ error: { code: "CONFLICT", message: "The legal reviewer cannot perform final approval." } }, { status: 409 });
  if (parsed.data.status === PayrollRuleStatus.APPROVED) {
    const validationError = validateRuleSetApproval(existing.sourceReference, existing.rules);
    if (validationError) return NextResponse.json({ error: { code: "INCOMPLETE_RULES", message: validationError } }, { status: 422 });
  }
  const updated = await db.payrollRuleSet.update({ where: { id }, data: { status: parsed.data.status, accountingReviewedById: parsed.data.status === PayrollRuleStatus.ACCOUNTING_REVIEWED ? user.id : existing.accountingReviewedById, legalReviewedById: parsed.data.status === PayrollRuleStatus.LEGAL_REVIEWED ? user.id : existing.legalReviewedById, approvedById: parsed.data.status === PayrollRuleStatus.APPROVED ? user.id : null } });
  await audit({ companyId: user.companyId, actorId: user.id, action: `payroll.rules.${parsed.data.status.toLowerCase()}`, entityType: "PayrollRuleSet", entityId: id, before: existing, after: updated });
  return NextResponse.json({ data: updated });
}
