import { RoleCode } from "@prisma/client";
import { NextResponse } from "next/server";
import { audit } from "@/server/audit";
import { getCurrentUser } from "@/server/auth";
import { db } from "@/server/db";
import { canManagePayroll } from "@/server/payroll";
import { createPayrollIntegrationPayload } from "@/server/payroll-integration";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || (!canManagePayroll(user.role) && user.role !== RoleCode.AUDITOR)) return NextResponse.json({ error: { code: "FORBIDDEN", message: "Payroll integration access required." } }, { status: 403 });
  const periodId = new URL(request.url).searchParams.get("periodId");
  if (!periodId) return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "periodId is required." } }, { status: 400 });
  const period = await db.payrollPeriod.findFirst({ where: { id: periodId, companyId: user.companyId, status: { in: ["APPROVED", "PAID", "LOCKED"] } }, select: { id: true, year: true, month: true, revision: true, status: true } });
  if (!period) return NextResponse.json({ error: { code: "NOT_FOUND", message: "Only finalized payroll periods can be prepared for integration." } }, { status: 404 });
  const runs = await db.payrollRun.findMany({ where: { periodId: period.id }, include: { employee: { select: { employeeCode: true } }, compensationProfile: { select: { payrollIdentifier: true } }, payment: { select: { amount: true, status: true } } }, orderBy: { employee: { employeeCode: "asc" } } });
  const payload = createPayrollIntegrationPayload({ companyId: user.companyId, period, rows: runs.map((run) => ({ employeeId: run.employeeId, employeeCode: run.employee.employeeCode, payrollIdentifier: run.compensationProfile.payrollIdentifier, grossAmount: run.grossAmount, totalDeductions: run.totalDeductions, netPayable: run.netPayable, employeeInsurance: run.employeeInsurance, employerInsurance: run.employerInsurance, payment: run.payment })) });
  await audit({ companyId: user.companyId, actorId: user.id, action: "payroll.integration.preview", entityType: "PayrollPeriod", entityId: period.id, after: { schemaVersion: payload.schemaVersion, checksum: payload.checksum, idempotencyKey: payload.idempotencyKey } });
  return NextResponse.json({ data: payload });
}
