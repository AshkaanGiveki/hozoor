import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { audit } from "@/server/audit";
import { getCurrentUser } from "@/server/auth";
import { db } from "@/server/db";
import { readPrivateFile, savePrivateBuffer } from "@/server/file-storage";
import { canManagePayroll } from "@/server/payroll";

export async function POST(_: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !canManagePayroll(user.role)) return NextResponse.json({ error: { code: "FORBIDDEN", message: "Payroll archive administration access required." } }, { status: 403 });
  const { id } = await context.params;
  const policy = await db.evidenceRetentionPolicy.findFirst({ where: { companyId: user.companyId, evidenceType: "payroll", active: true } });
  if (!policy) return NextResponse.json({ error: { code: "RETENTION_POLICY_REQUIRED", message: "Configure an active payroll retention policy before archiving evidence." } }, { status: 409 });
  const period = await db.payrollPeriod.findFirst({ where: { id, companyId: user.companyId, status: "LOCKED" }, include: { ruleSet: { select: { id: true, name: true, version: true, checksum: true } }, payrollPolicy: { select: { id: true, name: true, version: true } }, runs: { include: { employee: { select: { employeeCode: true, firstName: true, lastName: true } }, lines: true, payment: true, compensationProfile: { select: { payrollIdentifier: true } } }, orderBy: { employee: { employeeCode: "asc" } } } } });
  if (!period) return NextResponse.json({ error: { code: "NOT_FOUND", message: "Only locked payroll periods can be archived." } }, { status: 404 });
  const snapshot = { period: { id: period.id, companyId: period.companyId, year: period.year, month: period.month, revision: period.revision, status: period.status, startDate: period.startDate, endDate: period.endDate }, ruleSet: period.ruleSet, payrollPolicy: period.payrollPolicy, runs: period.runs.map((run) => ({ id: run.id, employeeId: run.employeeId, employeeCode: run.employee.employeeCode, employeeName: `${run.employee.firstName} ${run.employee.lastName}`, payrollIdentifier: run.compensationProfile.payrollIdentifier, snapshot: run.snapshot, snapshotChecksum: run.snapshotChecksum, grossAmount: run.grossAmount.toString(), taxableAmount: run.taxableAmount.toString(), insurableAmount: run.insurableAmount.toString(), employeeInsurance: run.employeeInsurance.toString(), employerInsurance: run.employerInsurance.toString(), taxAmount: run.taxAmount.toString(), totalDeductions: run.totalDeductions.toString(), netPayable: run.netPayable.toString(), lines: run.lines.map((line) => ({ ...line, amount: line.amount.toString(), quantity: line.quantity?.toString() ?? null, rate: line.rate?.toString() ?? null })), payment: run.payment ? { ...run.payment, amount: run.payment.amount.toString() } : null })) };
  const buffer = Buffer.from(JSON.stringify(snapshot), "utf8");
  const checksum = crypto.createHash("sha256").update(buffer).digest("hex");
  const idempotencyKey = `payroll-archive:${period.id}`;
  const existing = await db.reportExport.findFirst({ where: { companyId: user.companyId, reportType: "payroll-archive", idempotencyKey } });
  const expiresAt = new Date(Date.now() + policy.retentionDays * 24 * 60 * 60 * 1000);
  const storageName = existing?.storageName ?? await savePrivateBuffer(buffer, ".json");
  const archive = existing ?? await db.reportExport.create({ data: { companyId: user.companyId, createdById: user.id, reportType: "payroll-archive", filename: `ontyme-payroll-${period.year}-${period.month}-r${period.revision}.json`, storageName, filters: { periodId: period.id }, schemaVersion: 1, checksum, idempotencyKey, expiresAt, sourceSnapshot: { periodId: period.id, revision: period.revision, snapshotChecksum: checksum, retentionDays: policy.retentionDays, legalBasis: policy.legalBasis } } });
  await audit({ companyId: user.companyId, actorId: user.id, action: existing ? "payroll.archive.reuse" : "payroll.archive.create", entityType: "PayrollPeriod", entityId: period.id, after: { archiveId: archive.id, checksum: archive.checksum, expiresAt: archive.expiresAt } });
  return NextResponse.json({ data: { id: archive.id, filename: archive.filename, checksum: archive.checksum, expiresAt: archive.expiresAt, reused: Boolean(existing), bytes: existing ? (await readPrivateFile(existing.storageName)).byteLength : buffer.byteLength } });
}
