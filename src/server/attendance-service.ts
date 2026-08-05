import { db } from "./db";
import { calculateAttendance, toAttendanceDayData } from "./attendance-engine";
import { EventType, DayStatus } from "@prisma/client";

export async function recalculateAttendanceDay(companyId: string, employeeId: string, date: Date) {
  const day = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const next = new Date(day.getTime() + 86400000);
  const employee = await db.employee.findFirst({ where: { id: employeeId, companyId }, select: { groupId: true } });
  if (!employee) return null;
  const groupAssignment = employee.groupId ? await db.policyAssignment.findFirst({ where: { groupId: employee.groupId, startDate: { lte: day }, OR: [{ endDate: null }, { endDate: { gte: day } }] }, include: { policy: { include: { dailyRules: true } } }, orderBy: { startDate: "desc" } }) : null;
  const policy = groupAssignment?.policy ?? await db.attendancePolicy.findFirst({ where: { companyId, status: "ACTIVE", effectiveFrom: { lte: day }, OR: [{ effectiveTo: null }, { effectiveTo: { gte: day } }], policyAssignments: { none: {} } }, include: { dailyRules: true }, orderBy: { version: "desc" } }) ?? await db.attendancePolicy.findFirst({ where: { companyId, status: "ACTIVE", effectiveFrom: { lte: day } }, include: { dailyRules: true }, orderBy: { version: "desc" } });
  if (!policy) return null;
  const rule = policy.dailyRules.find((r) => r.weekday === day.getUTCDay()) ?? { isWorkingDay: false, startMinutes: null, endMinutes: null, flexibleEntryUntil: null, flexibleExitFrom: null, requiredMinutes: 0, minimumMinutes: 0, breakMinutes: 0 };
  const [raw, holiday, leaves, offTimes, corrections] = await Promise.all([
    db.rawAttendanceEvent.findMany({ where: { companyId, employeeId, timestamp: { gte: day, lt: next } }, orderBy: { timestamp: "asc" } }),
    db.holiday.findFirst({ where: { companyId, date: day } }),
    db.leaveRequest.findMany({ where: { companyId, employeeId, status: "APPROVED", startDate: { lte: day }, endDate: { gte: day } } }),
    db.offTimeRequest.findMany({ where: { companyId, employeeId, status: "APPROVED", date: day } }),
    db.attendanceCorrectionRequest.findMany({ where: { companyId, employeeId, status: "APPROVED", date: day } }),
  ]);
  const events = raw.map((e) => ({ timestamp: e.timestamp, type: e.type }));
  for (const correction of corrections) { if (correction.proposedIn) events.push({ timestamp: correction.proposedIn, type: EventType.IN }); if (correction.proposedOut) events.push({ timestamp: correction.proposedOut, type: EventType.OUT }); }
  const leaveMinutes = leaves.reduce((sum, request) => sum + request.requestedMinutes, 0);
  const offTimeMinutes = offTimes.reduce((sum, request) => sum + request.requestedMinutes, 0);
  const result = calculateAttendance({ date: day, events, rule, overtimeMode: policy.overtimeMode, graceMinutes: policy.graceMinutes, leaveMinutes, offTimeMinutes, holiday: Boolean(holiday) });
  const status = leaves.length && !events.length ? DayStatus.ON_LEAVE : result.status;
  return db.$transaction(async (tx) => {
    const attendance = await tx.attendanceDay.upsert({ where: { employeeId_date: { employeeId, date: day } }, update: { ...toAttendanceDayData(result), companyId, employeeId, date: day, policyId: policy.id, status, leaveMinutes, offTimeMinutes, scheduledStartMinutes: rule.startMinutes, scheduledEndMinutes: rule.endMinutes, calculatedAt: new Date() }, create: { ...toAttendanceDayData(result), companyId, employeeId, date: day, policyId: policy.id, status, leaveMinutes, offTimeMinutes, scheduledStartMinutes: rule.startMinutes, scheduledEndMinutes: rule.endMinutes } });
    await tx.attendanceSession.deleteMany({ where: { attendanceDayId: attendance.id } });
    if (result.sessions.length) await tx.attendanceSession.createMany({ data: result.sessions.map((s) => ({ attendanceDayId: attendance.id, startAt: s.startAt, endAt: s.endAt, durationMinutes: s.durationMinutes })) });
    return attendance;
  });
}
export async function recalculateDates(companyId: string, employeeIds: string[], dates: Date[]) { for (const employeeId of employeeIds) for (const date of dates) await recalculateAttendanceDay(companyId, employeeId, date); }
