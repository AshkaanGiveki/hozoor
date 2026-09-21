import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { audit } from "@/server/audit";
import { getCurrentUser } from "@/server/auth";
import { db } from "@/server/db";
import { canManagePayroll } from "@/server/payroll";
import { createPayrollWebhookAdapter, resolveIntegrationSubmissionOutcome, type PayrollIntegrationPayload } from "@/server/payroll-integration";

export async function POST(_: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !canManagePayroll(user.role)) return NextResponse.json({ error: { code: "FORBIDDEN", message: "Integration dispatch administration access required." } }, { status: 403 });
  if (!process.env.PAYROLL_WEBHOOK_URL) return NextResponse.json({ error: { code: "INTEGRATION_NOT_CONFIGURED", message: "PAYROLL_WEBHOOK_URL is not configured." } }, { status: 503 });
  const { id } = await context.params;
  const existing = await db.integrationSubmission.findFirst({ where: { id, companyId: user.companyId } });
  if (!existing) return NextResponse.json({ error: { code: "NOT_FOUND", message: "Integration submission not found." } }, { status: 404 });
  if (existing.adapterName !== "webhook") return NextResponse.json({ error: { code: "ADAPTER_NOT_IMPLEMENTED", message: `No dispatcher is registered for adapter '${existing.adapterName}'.` } }, { status: 409 });
  if (existing.status === "SUCCEEDED") return NextResponse.json({ error: { code: "CONFLICT", message: "A successful submission cannot be dispatched again." } }, { status: 409 });
  if (existing.status === "PROCESSING") return NextResponse.json({ error: { code: "CONFLICT", message: "The submission is already being dispatched." } }, { status: 409 });
  if (existing.attemptCount >= existing.maxAttempts) return NextResponse.json({ error: { code: "CONFLICT", message: "Maximum integration attempts reached." } }, { status: 409 });
  if (existing.nextAttemptAt && existing.nextAttemptAt > new Date()) return NextResponse.json({ error: { code: "RETRY_NOT_DUE", message: "The next retry time has not been reached." } }, { status: 409 });
  const claimed = await db.integrationSubmission.updateMany({ where: { id, companyId: user.companyId, status: { in: ["QUEUED", "RETRYING"] }, attemptCount: { lt: existing.maxAttempts } }, data: { status: "PROCESSING" } });
  if (claimed.count !== 1) return NextResponse.json({ error: { code: "CONFLICT", message: "The submission was claimed by another dispatcher." } }, { status: 409 });
  const result = await createPayrollWebhookAdapter().submit(existing.requestPayload as unknown as PayrollIntegrationPayload);
  const attemptCount = existing.attemptCount + 1;
  const outcome = resolveIntegrationSubmissionOutcome(result.accepted, attemptCount, existing.maxAttempts);
  const updated = await db.integrationSubmission.update({ where: { id }, data: { status: outcome.status, attemptCount, nextAttemptAt: outcome.nextAttemptAt, responsePayload: result.response === undefined ? undefined : result.response as Prisma.InputJsonValue, externalReference: result.externalReference ?? existing.externalReference, lastError: result.accepted ? null : result.message ?? "Provider did not accept the submission.", submittedAt: result.accepted ? new Date() : existing.submittedAt } });
  await audit({ companyId: user.companyId, actorId: user.id, action: `payroll.integration.dispatch.${outcome.status.toLowerCase()}`, entityType: "IntegrationSubmission", entityId: id, before: { status: existing.status, attemptCount: existing.attemptCount }, after: { status: updated.status, attemptCount: updated.attemptCount, externalReference: updated.externalReference, lastError: updated.lastError } });
  return NextResponse.json({ data: updated, provider: { accepted: result.accepted, message: result.message ?? null } });
}
