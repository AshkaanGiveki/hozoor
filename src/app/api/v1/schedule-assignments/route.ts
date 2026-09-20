import { RoleCode } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/server/auth";
import { db } from "@/server/db";
import { audit } from "@/server/audit";

const schema = z.object({ employeeId: z.string(), scheduleId: z.string(), startDate: z.coerce.date(), endDate: z.coerce.date().optional() }).refine((value) => !value.endDate || value.startDate <= value.endDate, { message: "Invalid assignment date range." });

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || (user.role !== RoleCode.ADMIN && user.role !== RoleCode.HR_ADMIN)) return NextResponse.json({ error: { code: "FORBIDDEN", message: "Administrator access required." } }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Invalid schedule assignment." } }, { status: 400 });
  const input = parsed.data;
  const [employee, schedule] = await Promise.all([db.employee.findFirst({ where: { id: input.employeeId, companyId: user.companyId } }), db.workScheduleTemplate.findFirst({ where: { id: input.scheduleId, companyId: user.companyId, active: true } })]);
  if (!employee || !schedule) return NextResponse.json({ error: { code: "NOT_FOUND", message: "Employee or schedule not found." } }, { status: 404 });
  const assignment = await db.scheduleAssignment.create({ data: input });
  await audit({ companyId: user.companyId, actorId: user.id, action: "schedule.assign", entityType: "ScheduleAssignment", entityId: assignment.id, after: input });
  return NextResponse.json({ data: assignment }, { status: 201 });
}
