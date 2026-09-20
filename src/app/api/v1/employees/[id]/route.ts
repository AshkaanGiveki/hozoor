import { NextResponse } from "next/server";
import { z } from "zod";
import { RoleCode } from "@prisma/client";
import { getCurrentUser } from "@/server/auth";
import { db } from "@/server/db";
import { canAccessEmployee } from "@/server/permissions";
import { audit } from "@/server/audit";

const schema = z.object({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  employeeCode: z.string().trim().min(1).max(50),
  email: z.string().trim().email().optional().or(z.literal("")),
  phone: z.string().trim().max(50).optional(),
  departmentId: z.string().optional().or(z.literal("")),
  teamId: z.string().optional().or(z.literal("")),
  groupId: z.string().optional().or(z.literal("")),
  managerId: z.string().optional().or(z.literal("")),
  active: z.boolean().optional(),
  role: z.nativeEnum(RoleCode).optional(),
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || (user.role !== RoleCode.ADMIN && user.role !== RoleCode.HR_ADMIN && user.role !== RoleCode.MANAGER)) return NextResponse.json({ error: { code: "FORBIDDEN", message: "Employee-management access required." } }, { status: 403 });
  const { id } = await context.params;
  const employee = await db.employee.findFirst({ where: { id, companyId: user.companyId }, include: { user: true } });
  if (!employee || !(await canAccessEmployee(user, id))) return NextResponse.json({ error: { code: "NOT_FOUND", message: "Employee not found or outside your scope." } }, { status: 404 });
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Invalid employee data.", fields: parsed.error.flatten().fieldErrors } }, { status: 400 });
  const input = parsed.data;
  if (user.role === RoleCode.MANAGER && input.role && input.role !== RoleCode.EMPLOYEE) return NextResponse.json({ error: { code: "FORBIDDEN", message: "Managers may only manage employee accounts." } }, { status: 403 });
  try {
    const updated = await db.$transaction(async (tx) => {
      const next = await tx.employee.update({ where: { id }, data: { firstName: input.firstName, lastName: input.lastName, employeeCode: input.employeeCode, email: input.email || null, phone: input.phone || null, departmentId: input.departmentId || null, teamId: input.teamId || null, groupId: input.groupId || null, managerId: input.managerId || null, active: input.active ?? employee.active } });
      if (employee.userId) await tx.user.update({ where: { id: employee.userId }, data: { firstName: input.firstName, lastName: input.lastName, role: user.role === RoleCode.MANAGER ? RoleCode.EMPLOYEE : input.role ?? employee.user?.role, status: input.active === undefined ? employee.user?.status : input.active ? "ACTIVE" : "INACTIVE" } });
      return next;
    });
    await audit({ companyId: user.companyId, actorId: user.id, action: "employee.update", entityType: "Employee", entityId: id, before: employee, after: input });
    return NextResponse.json({ data: updated });
  } catch { return NextResponse.json({ error: { code: "CONFLICT", message: "Employee code or related assignment is invalid." } }, { status: 409 }); }
}
