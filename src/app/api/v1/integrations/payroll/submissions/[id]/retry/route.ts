import { NextResponse } from "next/server";
import { audit } from "@/server/audit";
import { getCurrentUser } from "@/server/auth";
import { db } from "@/server/db";
import { canManagePayroll } from "@/server/payroll";

export async function POST(_: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !canManagePayroll(user.role)) return NextResponse.json({ error: { code: "FORBIDDEN", message: "Integration retry administration access required." } }, { status: 403 });
  const { id } = await context.params;
  const existing = await db.integrationSubmission.findFirst({ where: { id, companyId: user.companyId } });
  if (!existing) return NextResponse.json({ error: { code: "NOT_FOUND", message: "Integration submission not found." } }, { status: 404 });
  if (existing.status === "SUCCEEDED") return NextResponse.json({ error: { code: "CONFLICT", message: "A successful submission cannot be retried." } }, { status: 409 });
  if (existing.attemptCount >= existing.maxAttempts) return NextResponse.json({ error: { code: "CONFLICT", message: "Maximum integration attempts reached." } }, { status: 409 });
  const updated = await db.integrationSubmission.update({ where: { id }, data: { status: "QUEUED", nextAttemptAt: new Date(), lastError: null } });
  await audit({ companyId: user.companyId, actorId: user.id, action: "payroll.integration.retry", entityType: "IntegrationSubmission", entityId: id, before: { status: existing.status, attemptCount: existing.attemptCount }, after: { status: updated.status, nextAttemptAt: updated.nextAttemptAt } });
  return NextResponse.json({ data: updated });
}
