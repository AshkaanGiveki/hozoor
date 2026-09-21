import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { audit } from "@/server/audit";
import { getCurrentUser } from "@/server/auth";
import { db } from "@/server/db";
import { canManagePayroll } from "@/server/payroll";
import { resolveIntegrationSubmissionOutcome } from "@/server/payroll-integration";

const schema = z.object({ accepted: z.boolean(), externalReference: z.string().trim().max(200).nullable().optional(), response: z.unknown().optional(), error: z.string().trim().max(2000).nullable().optional() });

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !canManagePayroll(user.role)) return NextResponse.json({ error: { code: "FORBIDDEN", message: "Integration response administration access required." } }, { status: 403 });
  const { id } = await context.params;
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Invalid provider response." } }, { status: 400 });
  const existing = await db.integrationSubmission.findFirst({ where: { id, companyId: user.companyId } });
  if (!existing) return NextResponse.json({ error: { code: "NOT_FOUND", message: "Integration submission not found." } }, { status: 404 });
  if (existing.status === "SUCCEEDED") return NextResponse.json({ error: { code: "CONFLICT", message: "A successful submission cannot be changed." } }, { status: 409 });
  const attemptCount = existing.attemptCount + 1;
  const outcome = resolveIntegrationSubmissionOutcome(parsed.data.accepted, attemptCount, existing.maxAttempts);
  const updated = await db.integrationSubmission.update({ where: { id }, data: { status: outcome.status, attemptCount, nextAttemptAt: outcome.nextAttemptAt, responsePayload: parsed.data.response as Prisma.InputJsonValue | undefined, externalReference: parsed.data.externalReference ?? existing.externalReference, lastError: parsed.data.accepted ? null : parsed.data.error ?? "Provider did not accept the submission.", submittedAt: parsed.data.accepted ? new Date() : existing.submittedAt } });
  await audit({ companyId: user.companyId, actorId: user.id, action: `payroll.integration.${outcome.status.toLowerCase()}`, entityType: "IntegrationSubmission", entityId: id, before: { status: existing.status, attemptCount: existing.attemptCount }, after: { status: updated.status, attemptCount: updated.attemptCount, externalReference: updated.externalReference, lastError: updated.lastError } });
  return NextResponse.json({ data: updated });
}
