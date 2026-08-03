import { db } from "./db";
import { employeeScopeWhere } from "./permissions";
import type { User } from "@prisma/client";
type AuthUser = User & { employee?: { id: string } | null };

export async function employeeReport(user: AuthUser, from: Date, to: Date, employeeId?: string) {
  const scope = await employeeScopeWhere(user); const target = employeeId && (await db.employee.findFirst({ where: { ...scope, id: employeeId } })) ? employeeId : (user.role === "EMPLOYEE" ? user.employee?.id : undefined);
  const rows = await db.attendanceDay.findMany({ where: { companyId: user.companyId, employeeId: target ?? undefined, date: { gte: from, lte: to }, employee: scope }, include: { employee: { include: { department: true, team: true } } }, orderBy: { date: "asc" } });
  return rows.map((r) => ({ date: r.date.toISOString().slice(0,10), employeeCode: r.employee.employeeCode, name: `${r.employee.firstName} ${r.employee.lastName}`, department: r.employee.department?.name ?? "—", team: r.employee.team?.name ?? "—", status: r.status, requiredMinutes: r.requiredMinutes, validWorkMinutes: r.validWorkMinutes, deficitMinutes: r.deficitMinutes, lateMinutes: r.lateMinutes, earlyDepartureMinutes: r.earlyDepartureMinutes, overtimeMinutes: r.calculatedOvertimeMinutes, leaveMinutes: r.leaveMinutes, offTimeMinutes: r.offTimeMinutes, anomalies: r.anomalies }));
}
export function csvEscape(value: unknown) { const s = String(value ?? "").replace(/\r?\n/g," "); return /^[=+\-@]/.test(s) ? `'${s}` : `"${s.replace(/"/g,'""')}"`; }
export function reportCsv(rows: Record<string, unknown>[]) { if (!rows.length) return ""; const keys = Object.keys(rows[0]); return [keys.map(csvEscape).join(","), ...rows.map((r) => keys.map((k) => csvEscape(Array.isArray(r[k]) ? r[k].join(" | ") : r[k])).join(","))].join("\n"); }
