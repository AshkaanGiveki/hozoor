import { RoleCode } from "@prisma/client";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth";
import { db } from "@/server/db";
import { canManagePayroll } from "@/server/payroll";

function csvCell(value: unknown) { return `"${String(value ?? "").replace(/"/g, '""')}"`; }

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || (!canManagePayroll(user.role) && user.role !== RoleCode.AUDITOR)) return NextResponse.json({ error: { code: "FORBIDDEN", message: "Payroll report access required." } }, { status: 403 });
  const periodId = new URL(request.url).searchParams.get("periodId");
  const runs = await db.payrollRun.findMany({ where: { periodId: periodId || undefined, period: { companyId: user.companyId, status: { in: ["APPROVED", "PAID", "LOCKED"] } } }, include: { employee: { select: { employeeCode: true, firstName: true, lastName: true } }, period: { select: { year: true, month: true, status: true } }, payment: { select: { status: true, amount: true, paymentReference: true, paidAt: true } } }, orderBy: { employee: { employeeCode: "asc" } } });
  const lines = ["employee_code,employee_name,period,status,gross,tax,employee_insurance,employer_insurance,total_deductions,net_payable,paid_amount,payment_status,payment_reference,paid_at"];
  for (const run of runs) lines.push([run.employee.employeeCode, `${run.employee.firstName} ${run.employee.lastName}`, `${run.period.year}/${run.period.month}`, run.period.status, run.grossAmount, run.taxAmount, run.employeeInsurance, run.employerInsurance, run.totalDeductions, run.netPayable, run.payment?.amount ?? "", run.payment?.status ?? "", run.payment?.paymentReference ?? "", run.payment?.paidAt?.toISOString() ?? ""].map(csvCell).join(","));
  return new NextResponse("\uFEFF" + lines.join("\n"), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": "attachment; filename=ontyme-payroll.csv" } });
}
