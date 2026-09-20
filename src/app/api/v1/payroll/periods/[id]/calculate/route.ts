import { NextResponse } from "next/server";
import { audit } from "@/server/audit";
import { getCurrentUser } from "@/server/auth";
import { canManagePayroll } from "@/server/payroll";
import { calculatePayrollPeriod } from "@/server/payroll-engine";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  void request;
  const user = await getCurrentUser();
  if (!user || !canManagePayroll(user.role)) return NextResponse.json({ error: { code: "FORBIDDEN", message: "Payroll administration access required." } }, { status: 403 });
  const { id } = await context.params;
  try {
    const result = await calculatePayrollPeriod(id, user.companyId);
    await audit({ companyId: user.companyId, actorId: user.id, action: "payroll.period.calculate", entityType: "PayrollPeriod", entityId: id, after: result });
    return NextResponse.json({ data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Payroll calculation failed.";
    const status = message === "PAYROLL_PERIOD_NOT_FOUND" ? 404 : message.startsWith("MISSING_COMPENSATION:") || message.startsWith("COMPENSATION_BELOW_MINIMUM:") || message.startsWith("RULES_") ? 422 : 409;
    return NextResponse.json({ error: { code: "PAYROLL_CALCULATION_FAILED", message } }, { status });
  }
}
