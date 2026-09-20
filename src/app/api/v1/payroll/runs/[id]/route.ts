import { RoleCode } from "@prisma/client";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth";
import { db } from "@/server/db";
import { canManagePayroll } from "@/server/payroll";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  void request;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Authentication required." } }, { status: 401 });
  const { id } = await context.params;
  const run = await db.payrollRun.findFirst({ where: { id, period: { companyId: user.companyId, status: { in: ["APPROVED", "PAID", "LOCKED"] } } }, include: { employee: { select: { id: true, employeeCode: true, firstName: true, lastName: true } }, period: { select: { id: true, year: true, month: true, status: true, ruleSet: { select: { name: true, version: true, checksum: true } } } }, lines: true, payment: true } });
  if (!run || (!canManagePayroll(user.role) && user.role !== RoleCode.AUDITOR && run.employee.id !== user.employee?.id)) return NextResponse.json({ error: { code: "NOT_FOUND", message: "Payslip not found." } }, { status: 404 });
  return NextResponse.json({ data: run });
}
