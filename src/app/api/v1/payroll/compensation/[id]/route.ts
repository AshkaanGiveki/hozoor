import { CompensationStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { audit } from "@/server/audit";
import { getCurrentUser } from "@/server/auth";
import { db } from "@/server/db";
import { canManagePayroll, maskBankAccountLast4 } from "@/server/payroll";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  void request;
  const user = await getCurrentUser();
  if (!user || !canManagePayroll(user.role)) return NextResponse.json({ error: { code: "FORBIDDEN", message: "Payroll administration access required." } }, { status: 403 });
  const { id } = await context.params;
  const existing = await db.compensationProfile.findFirst({ where: { id, companyId: user.companyId } });
  if (!existing) return NextResponse.json({ error: { code: "NOT_FOUND", message: "Compensation profile not found." } }, { status: 404 });
  if (existing.status === CompensationStatus.ARCHIVED) return NextResponse.json({ error: { code: "CONFLICT", message: "This compensation profile is already archived." } }, { status: 409 });
  const updated = await db.compensationProfile.update({ where: { id }, data: { status: CompensationStatus.ARCHIVED, effectiveTo: existing.effectiveTo ?? new Date() } });
  await audit({ companyId: user.companyId, actorId: user.id, action: "payroll.compensation.archive", entityType: "CompensationProfile", entityId: id, before: { id: existing.id, employeeId: existing.employeeId, status: existing.status, baseSalary: existing.baseSalary.toString(), bankAccountLast4: maskBankAccountLast4(existing.bankAccountLast4) }, after: { id: updated.id, status: updated.status } });
  return NextResponse.json({ data: updated });
}
