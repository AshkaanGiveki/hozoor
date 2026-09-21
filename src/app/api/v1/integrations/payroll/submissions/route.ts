import { Prisma, RoleCode } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { audit } from "@/server/audit";
import { getCurrentUser } from "@/server/auth";
import { db } from "@/server/db";
import { canManagePayroll } from "@/server/payroll";
import { createPayrollIntegrationPayload } from "@/server/payroll-integration";

const schema = z.object({ periodId: z.string().uuid(), adapterName: z.string().trim().regex(/^[a-z0-9._-]{2,80}$/i) });

export async function GET() {
  const user = await getCurrentUser();
  if (!user || (!canManagePayroll(user.role) && user.role !== RoleCode.AUDITOR)) return NextResponse.json({ error: { code: "FORBIDDEN", message: "Integration submission access required." } }, { status: 403 });
  return NextResponse.json({ data: await db.integrationSubmission.findMany({ where: { companyId: user.companyId }, orderBy: { createdAt: "desc" }, take: 100 }) });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || !canManagePayroll(user.role)) return NextResponse.json({ error: { code: "FORBIDDEN", message: "Integration submission administration access required." } }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "periodId and adapterName are required." } }, { status: 400 });
  const period = await db.payrollPeriod.findFirst({ where: { id: parsed.data.periodId, companyId: user.companyId, status: { in: ["APPROVED", "PAID", "LOCKED"] } }, select: { id: true, year: true, month: true, revision: true, status: true } });
  if (!period) return NextResponse.json({ error: { code: "NOT_FOUND", message: "Only finalized payroll periods can be queued." } }, { status: 404 });
  const runs = await db.payrollRun.findMany({ where: { periodId: period.id }, include: { employee: { select: { employeeCode: true } }, compensationProfile: { select: { payrollIdentifier: true } }, payment: { select: { amount: true, status: true } } }, orderBy: { employee: { employeeCode: "asc" } } });
  const payload = createPayrollIntegrationPayload({ companyId: user.companyId, period, rows: runs.map((run) => ({ employeeId: run.employeeId, employeeCode: run.employee.employeeCode, payrollIdentifier: run.compensationProfile.payrollIdentifier, grossAmount: run.grossAmount, totalDeductions: run.totalDeductions, netPayable: run.netPayable, employeeInsurance: run.employeeInsurance, employerInsurance: run.employerInsurance, payment: run.payment })) });
  const existing = await db.integrationSubmission.findUnique({ where: { companyId_adapterName_idempotencyKey: { companyId: user.companyId, adapterName: parsed.data.adapterName, idempotencyKey: payload.idempotencyKey } } });
  if (existing) return NextResponse.json({ data: existing, reused: true });
  const submission = await db.integrationSubmission.create({ data: { companyId: user.companyId, createdById: user.id, integrationType: "payroll", adapterName: parsed.data.adapterName, idempotencyKey: payload.idempotencyKey, requestPayload: payload as unknown as Prisma.InputJsonValue } });
  await audit({ companyId: user.companyId, actorId: user.id, action: "payroll.integration.queue", entityType: "IntegrationSubmission", entityId: submission.id, after: { adapterName: submission.adapterName, idempotencyKey: submission.idempotencyKey, checksum: payload.checksum } });
  return NextResponse.json({ data: submission, reused: false }, { status: 201 });
}
