import { PayrollRuleStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { audit } from "@/server/audit";
import { getCurrentUser } from "@/server/auth";
import { db } from "@/server/db";
import { canManagePayroll, validateLegalRules } from "@/server/payroll";

const schema = z.object({ status: z.enum([PayrollRuleStatus.APPROVED, PayrollRuleStatus.RETIRED]) });

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !canManagePayroll(user.role)) return NextResponse.json({ error: { code: "FORBIDDEN", message: "Payroll administration access required." } }, { status: 403 });
  const { id } = await context.params;
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Only approve or retire is allowed." } }, { status: 400 });
  const existing = await db.payrollRuleSet.findFirst({ where: { id, companyId: user.companyId } });
  if (!existing) return NextResponse.json({ error: { code: "NOT_FOUND", message: "Payroll rule set not found." } }, { status: 404 });
  if (existing.status === PayrollRuleStatus.RETIRED) return NextResponse.json({ error: { code: "CONFLICT", message: "A retired rule set cannot be changed." } }, { status: 409 });
  if (parsed.data.status === PayrollRuleStatus.APPROVED) {
    const validationError = validateLegalRules(existing.rules);
    if (validationError) return NextResponse.json({ error: { code: "INCOMPLETE_RULES", message: validationError } }, { status: 422 });
  }
  const updated = await db.payrollRuleSet.update({ where: { id }, data: { status: parsed.data.status, approvedById: parsed.data.status === PayrollRuleStatus.APPROVED ? user.id : null } });
  await audit({ companyId: user.companyId, actorId: user.id, action: `payroll.rules.${parsed.data.status.toLowerCase()}`, entityType: "PayrollRuleSet", entityId: id, before: existing, after: updated });
  return NextResponse.json({ data: updated });
}
