import { PolicyStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { audit } from "@/server/audit";
import { getCurrentUser } from "@/server/auth";
import { db } from "@/server/db";
import { canManagePayroll, hasPolicyOverlap, validatePayrollPolicy } from "@/server/payroll";

const schema = z.object({ status: z.enum([PolicyStatus.ACTIVE, PolicyStatus.ARCHIVED]) });

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !canManagePayroll(user.role)) return NextResponse.json({ error: { code: "FORBIDDEN", message: "Payroll administration access required." } }, { status: 403 });
  const { id } = await context.params;
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Only activate or archive is allowed." } }, { status: 400 });
  const existing = await db.payrollPolicy.findFirst({ where: { id, companyId: user.companyId } });
  if (!existing) return NextResponse.json({ error: { code: "NOT_FOUND", message: "Payroll policy not found." } }, { status: 404 });
  if (existing.status === PolicyStatus.ARCHIVED) return NextResponse.json({ error: { code: "CONFLICT", message: "An archived policy cannot be changed." } }, { status: 409 });
  if (parsed.data.status === PolicyStatus.ACTIVE) {
    const policyError = validatePayrollPolicy(existing.settings);
    if (policyError) return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: policyError } }, { status: 400 });
    if (await hasPolicyOverlap(user.companyId, existing.name, existing.effectiveFrom, existing.effectiveTo, id)) return NextResponse.json({ error: { code: "CONFLICT", message: "Policy effective dates overlap another active or draft version. Close the previous version explicitly first." } }, { status: 409 });
  }
  const updated = await db.payrollPolicy.update({ where: { id }, data: { status: parsed.data.status } });
  await audit({ companyId: user.companyId, actorId: user.id, action: `payroll.policy.${parsed.data.status.toLowerCase()}`, entityType: "PayrollPolicy", entityId: id, before: existing, after: updated });
  return NextResponse.json({ data: updated });
}
