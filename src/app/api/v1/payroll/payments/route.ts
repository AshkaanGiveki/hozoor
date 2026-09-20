import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth";
import { db } from "@/server/db";
import { canManagePayroll } from "@/server/payroll";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || !canManagePayroll(user.role)) return NextResponse.json({ error: { code: "FORBIDDEN", message: "Payroll administration access required." } }, { status: 403 });
  const periodId = new URL(request.url).searchParams.get("periodId");
  return NextResponse.json({ data: await db.payrollPayment.findMany({ where: { companyId: user.companyId, periodId: periodId || undefined }, include: { employee: { select: { employeeCode: true, firstName: true, lastName: true } }, payrollRun: { select: { netPayable: true } } }, orderBy: { employee: { employeeCode: "asc" } } }) });
}
