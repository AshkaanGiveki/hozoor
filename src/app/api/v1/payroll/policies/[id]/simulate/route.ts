import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/server/auth";
import { db } from "@/server/db";
import { canManagePayroll, simulatePayrollPolicy } from "@/server/payroll";

const schema = z.object({ requestedOvertimeMinutes: z.number().int().nonnegative(), approvedOvertimeMinutes: z.number().int().nonnegative().optional(), amount: z.number().finite() });

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !canManagePayroll(user.role)) return NextResponse.json({ error: { code: "FORBIDDEN", message: "Payroll administration access required." } }, { status: 403 });
  const { id } = await context.params;
  const policy = await db.payrollPolicy.findFirst({ where: { id, companyId: user.companyId } });
  if (!policy) return NextResponse.json({ error: { code: "NOT_FOUND", message: "Payroll policy not found." } }, { status: 404 });
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Simulation inputs are invalid." } }, { status: 400 });
  return NextResponse.json({ data: { policyId: id, version: policy.version, result: simulatePayrollPolicy(policy.settings, parsed.data) } });
}
