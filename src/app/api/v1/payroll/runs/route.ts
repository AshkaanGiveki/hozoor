import { RoleCode } from "@prisma/client";
import { NextResponse } from "next/server";
import { audit } from "@/server/audit";
import { getCurrentUser } from "@/server/auth";
import { db } from "@/server/db";
import { canManagePayroll } from "@/server/payroll";
import { employeeScopeWhere } from "@/server/permissions";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Authentication required." } }, { status: 401 });
  const periodId = new URL(request.url).searchParams.get("periodId");
  const allAccess = canManagePayroll(user.role) || user.role === RoleCode.AUDITOR;
  const requestedEmployeeId = new URL(request.url).searchParams.get("employeeId");
  const employeeScope = allAccess ? undefined : await employeeScopeWhere(user);
  if (!allAccess && !user.employee?.id) return NextResponse.json({ data: [] });
  const rows = await db.payrollRun.findMany({ where: { periodId: periodId || undefined, employee: requestedEmployeeId ? { ...employeeScope, id: requestedEmployeeId } : employeeScope, period: { companyId: user.companyId, status: { in: ["APPROVED", "PAID", "LOCKED"] } } }, include: { employee: { select: { employeeCode: true, firstName: true, lastName: true } }, period: { select: { year: true, month: true, status: true } }, lines: true, payment: true }, orderBy: [{ period: { year: "desc" } }, { period: { month: "desc" } }] });
  await audit({ companyId: user.companyId, actorId: user.id, action: "payroll.run.list", entityType: "PayrollRun", after: { periodId, count: rows.length, employeeScope: requestedEmployeeId ?? (allAccess ? "company" : "scoped") } });
  return NextResponse.json({ data: rows });
}
