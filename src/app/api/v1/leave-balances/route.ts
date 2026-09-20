import { LedgerType, RoleCode } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { audit } from "@/server/audit";
import { db } from "@/server/db";
import { getCurrentUser } from "@/server/auth";
import { employeeScopeWhere } from "@/server/permissions";
import { addLeaveLedgerEntry, getLeaveBalances, getLeaveBalance } from "@/server/leave-balances";

const adjustmentSchema = z.object({
  employeeId: z.string().min(1),
  leaveTypeId: z.string().min(1),
  year: z.coerce.number().int().min(2000).max(2200),
  minutes: z.coerce.number().int().refine((value) => value !== 0, "Adjustment cannot be zero"),
  description: z.string().trim().min(3).max(500),
});

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user?.employee) return NextResponse.json({ error: { code: "FORBIDDEN", message: "Employee account required." } }, { status: 403 });
  const url = new URL(request.url);
  const requestedEmployeeId = url.searchParams.get("employeeId") || user.employee.id;
  const year = Number(url.searchParams.get("year") || new Date().getUTCFullYear());
  if (!Number.isInteger(year) || year < 2000 || year > 2200) return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Invalid year." } }, { status: 400 });
  const scope = await employeeScopeWhere(user);
  const employee = await db.employee.findFirst({ where: { ...scope, id: requestedEmployeeId }, select: { id: true } });
  if (!employee) return NextResponse.json({ error: { code: "FORBIDDEN", message: "Employee is outside your access scope." } }, { status: 403 });
  return NextResponse.json({ data: await getLeaveBalances(employee.id, year), meta: { year } });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || (user.role !== RoleCode.ADMIN && user.role !== RoleCode.HR_ADMIN)) return NextResponse.json({ error: { code: "FORBIDDEN", message: "Administrator access required." } }, { status: 403 });
  const parsed = adjustmentSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Invalid balance adjustment.", fields: parsed.error.flatten().fieldErrors } }, { status: 400 });
  const input = parsed.data;
  const employee = await db.employee.findFirst({ where: { id: input.employeeId, companyId: user.companyId }, select: { id: true } });
  const leaveType = await db.leaveType.findFirst({ where: { id: input.leaveTypeId, companyId: user.companyId, active: true }, select: { id: true } });
  if (!employee || !leaveType) return NextResponse.json({ error: { code: "NOT_FOUND", message: "Employee or leave type not found." } }, { status: 404 });
  const balance = await db.$transaction(async (tx) => {
    const current = await getLeaveBalance(input.employeeId, input.leaveTypeId, input.year, tx);
    await addLeaveLedgerEntry(tx, { balanceId: current.id, type: LedgerType.MANUAL_ADJUSTMENT, minutes: input.minutes, description: input.description });
    return getLeaveBalance(input.employeeId, input.leaveTypeId, input.year, tx);
  });
  await audit({ companyId: user.companyId, actorId: user.id, action: "leave_balance.adjust", entityType: "LeaveBalance", entityId: balance.id, after: input });
  return NextResponse.json({ data: balance });
}
