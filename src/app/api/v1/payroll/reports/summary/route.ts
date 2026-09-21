import { Prisma, RoleCode } from "@prisma/client";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth";
import { db } from "@/server/db";
import { employeeScopeWhere } from "@/server/permissions";
import { canManagePayroll } from "@/server/payroll";
import { summarizePayrollRegister } from "@/server/payroll-reporting";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || (!canManagePayroll(user.role) && user.role !== RoleCode.AUDITOR && user.role !== RoleCode.MANAGER)) return NextResponse.json({ error: { code: "FORBIDDEN", message: "Payroll summary access required." } }, { status: 403 });
  const periodId = new URL(request.url).searchParams.get("periodId");
  if (!periodId) return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "periodId is required." } }, { status: 400 });
  const scope = await employeeScopeWhere(user);
  const runs = await db.payrollRun.findMany({ where: { periodId, period: { companyId: user.companyId, status: { in: ["APPROVED", "PAID", "LOCKED"] } }, employee: scope }, include: { employee: { select: { id: true, employeeCode: true, firstName: true, lastName: true, department: { select: { id: true, name: true } } }, }, payment: { select: { amount: true, status: true } } }, orderBy: { employee: { employeeCode: "asc" } } });
  const rows = runs.map((run) => ({ employeeId: run.employee.id, employeeCode: run.employee.employeeCode, employeeName: `${run.employee.firstName} ${run.employee.lastName}`, departmentId: run.employee.department?.id ?? null, departmentName: run.employee.department?.name ?? null, gross: run.grossAmount, deductions: run.totalDeductions, net: run.netPayable, employerInsurance: run.employerInsurance, paid: run.payment?.amount ?? new Prisma.Decimal(0), paymentStatus: run.payment?.status ?? "PENDING" }));
  return NextResponse.json({ data: { periodId, employeeCount: rows.length, register: rows.map((row) => ({ ...row, gross: row.gross.toString(), deductions: row.deductions.toString(), net: row.net.toString(), employerInsurance: row.employerInsurance.toString(), paid: row.paid.toString() })), departments: summarizePayrollRegister(rows) } });
}
