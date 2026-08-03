import { RoleCode } from "@prisma/client";
import { db } from "./db";
import type { User } from "@prisma/client";
type AuthUser = User & { employee?: { id: string } | null };
import { isAdmin } from "./auth";

export function canReadAll(user: Pick<User,"role">) { return isAdmin(user.role) || user.role === RoleCode.AUDITOR; }
export async function canAccessEmployee(user: AuthUser, employeeId: string) {
  if (canReadAll(user) || user.role === RoleCode.MANAGER) {
    if (canReadAll(user)) return true;
    const employee = await db.employee.findFirst({ where: { id: employeeId, companyId: user.companyId, active: true }, select: { teamId: true, managerId: true } });
    if (!employee) return false;
    return employee.managerId === user.employee?.id || Boolean(employee.teamId && await db.managerAssignment.findFirst({ where: { managerId: user.id, teamId: employee.teamId, startDate: { lte: new Date() }, OR: [{ endDate: null }, { endDate: { gte: new Date() } }] } }));
  }
  return user.employee?.id === employeeId;
}
export async function employeeScopeWhere(user: AuthUser) {
  if (canReadAll(user)) return { companyId: user.companyId };
  if (user.role === RoleCode.MANAGER) {
    const teams = await db.managerAssignment.findMany({ where: { managerId: user.id, startDate: { lte: new Date() }, OR: [{ endDate: null }, { endDate: { gte: new Date() } }] }, select: { teamId: true } });
    return { companyId: user.companyId, OR: [{ id: user.employee?.id ?? "" }, { teamId: { in: teams.map((t) => t.teamId) } }] };
  }
  return { companyId: user.companyId, id: user.employee?.id ?? "" };
}
