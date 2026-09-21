import { Prisma, RoleCode } from "@prisma/client";
import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth";
import { db } from "@/server/db";
import { audit } from "@/server/audit";
import { readPrivateFile, savePrivateBuffer } from "@/server/file-storage";
import { canManagePayroll } from "@/server/payroll";

function csvCell(value: unknown) { return `"${String(value ?? "").replace(/"/g, '""')}"`; }

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || (!canManagePayroll(user.role) && user.role !== RoleCode.AUDITOR)) return NextResponse.json({ error: { code: "FORBIDDEN", message: "Payroll report access required." } }, { status: 403 });
  const periodId = new URL(request.url).searchParams.get("periodId");
  const runs = await db.payrollRun.findMany({ where: { periodId: periodId || undefined, period: { companyId: user.companyId, status: { in: ["APPROVED", "PAID", "LOCKED"] } } }, include: { employee: { select: { employeeCode: true, firstName: true, lastName: true } }, period: { select: { year: true, month: true, status: true } }, payment: { select: { status: true, amount: true, paymentReference: true, paidAt: true } } }, orderBy: { employee: { employeeCode: "asc" } } });
  const lines = ["employee_code,employee_name,period,status,gross,tax,employee_insurance,employer_insurance,total_deductions,net_payable,paid_amount,payment_status,payment_reference,paid_at"];
  for (const run of runs) lines.push([run.employee.employeeCode, `${run.employee.firstName} ${run.employee.lastName}`, `${run.period.year}/${run.period.month}`, run.period.status, run.grossAmount, run.taxAmount, run.employeeInsurance, run.employerInsurance, run.totalDeductions, run.netPayable, run.payment?.amount ?? "", run.payment?.status ?? "", run.payment?.paymentReference ?? "", run.payment?.paidAt?.toISOString() ?? ""].map(csvCell).join(","));
  const csv = "\uFEFF" + lines.join("\n");
  const buffer = Buffer.from(csv, "utf8");
  const checksum = crypto.createHash("sha256").update(buffer).digest("hex");
  const idempotencyKey = request.headers.get("Idempotency-Key")?.trim() || null;
  const existing = idempotencyKey ? await db.reportExport.findFirst({ where: { companyId: user.companyId, reportType: "payroll", idempotencyKey } }) : null;
  const storageName = existing?.storageName ?? await savePrivateBuffer(buffer, ".csv");
  const netPayableTotal = runs.reduce((sum, run) => sum.plus(run.netPayable), new Prisma.Decimal(0));
  const exportRecord = existing ?? await db.reportExport.create({ data: { companyId: user.companyId, createdById: user.id, reportType: "payroll", filename: "ontyme-payroll.csv", storageName, filters: { periodId }, schemaVersion: 1, checksum, idempotencyKey, sourceSnapshot: { periodId, runIds: runs.map((run) => run.id), netPayableTotal: String(netPayableTotal) } } });
  await audit({ companyId: user.companyId, actorId: user.id, action: existing ? "payroll.export.reuse" : "payroll.export.create", entityType: "ReportExport", entityId: exportRecord.id, after: { checksum: exportRecord.checksum, schemaVersion: exportRecord.schemaVersion, idempotencyKey } });
  const output = existing ? await readPrivateFile(existing.storageName) : buffer;
  return new NextResponse(output, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${exportRecord.filename}"`, "X-Export-Id": exportRecord.id, "X-Export-Schema-Version": String(exportRecord.schemaVersion), "X-Export-Checksum": exportRecord.checksum } });
}
