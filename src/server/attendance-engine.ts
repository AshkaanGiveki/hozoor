import { DayStatus, EventType, OvertimeMode, Prisma } from "@prisma/client";

export type WorkRule = { isWorkingDay: boolean; startMinutes: number | null; endMinutes: number | null; flexibleEntryUntil: number | null; flexibleExitFrom: number | null; requiredMinutes: number; minimumMinutes: number | null; breakMinutes: number };
export type AttendanceInput = { date: Date; events: { timestamp: Date; type: EventType }[]; rule: WorkRule; overtimeMode: OvertimeMode; graceMinutes: number; leaveMinutes?: number; offTimeMinutes?: number; holiday?: boolean };
export type AttendanceResult = { status: DayStatus; requiredMinutes: number; minimumMinutes: number; firstIn: Date | null; lastOut: Date | null; rawPresenceMinutes: number; validWorkMinutes: number; breakMinutes: number; lateMinutes: number; earlyDepartureMinutes: number; deficitMinutes: number; rawOvertimeMinutes: number; calculatedOvertimeMinutes: number; anomalies: string[]; sessions: { startAt: Date; endAt: Date | null; durationMinutes: number }[] };

export function minutesBetween(a: Date, b: Date) { return Math.max(0, Math.round((b.getTime() - a.getTime()) / 60000)); }
export function calculateAttendance(input: AttendanceInput): AttendanceResult {
  const { rule, events } = input;
  const anomalies: string[] = [];
  if (input.holiday) return emptyResult(DayStatus.HOLIDAY);
  if (!rule.isWorkingDay) return emptyResult(DayStatus.WEEKLY_OFF);
  const sorted = [...events].sort((a,b) => a.timestamp.getTime() - b.timestamp.getTime());
  const sessions: AttendanceResult["sessions"] = [];
  let open: Date | null = null;
  for (const event of sorted) {
    if (event.type === EventType.IN || (event.type === EventType.UNKNOWN && !open)) { if (open) anomalies.push("DUPLICATE_EVENT"); open = event.timestamp; }
    else if (event.type === EventType.OUT || (event.type === EventType.UNKNOWN && open)) { if (!open) { anomalies.push("MISSING_IN"); continue; } sessions.push({ startAt: open, endAt: event.timestamp, durationMinutes: minutesBetween(open,event.timestamp) }); open = null; }
  }
  if (open) { sessions.push({ startAt: open, endAt: null, durationMinutes: 0 }); anomalies.push("MISSING_OUT"); }
  if (!sessions.length) return { ...emptyResult(DayStatus.ABSENT), requiredMinutes: rule.requiredMinutes, minimumMinutes: rule.minimumMinutes ?? rule.requiredMinutes, anomalies: ["MISSING_IN","MISSING_OUT"] };
  const firstIn = sessions[0].startAt; const completed = sessions.filter((s) => s.endAt);
  const lastOut = completed.at(-1)?.endAt ?? null;
  const rawPresenceMinutes = completed.reduce((sum,s) => sum + s.durationMinutes, 0);
  const breakMinutes = Math.max(0, (completed.length - 1) * rule.breakMinutes);
  const validWorkMinutes = Math.max(0, rawPresenceMinutes - breakMinutes);
  const minimumMinutes = rule.minimumMinutes ?? rule.requiredMinutes;
  let lateMinutes = 0; let earlyDepartureMinutes = 0;
  if (rule.startMinutes !== null) { const start = firstIn.getUTCHours()*60 + firstIn.getUTCMinutes(); const graceEnd = rule.flexibleEntryUntil ?? rule.startMinutes + input.graceMinutes; lateMinutes = Math.max(0, start - graceEnd); }
  if (rule.endMinutes !== null && lastOut) { const end = lastOut.getUTCHours()*60 + lastOut.getUTCMinutes(); const allowed = rule.flexibleExitFrom ?? rule.endMinutes; earlyDepartureMinutes = Math.max(0, allowed - end); }
  const deficitMinutes = Math.max(0, minimumMinutes - validWorkMinutes - (input.leaveMinutes ?? 0) - (input.offTimeMinutes ?? 0));
  const rawOvertimeMinutes = Math.max(0, validWorkMinutes - rule.requiredMinutes);
  let calculatedOvertimeMinutes = input.overtimeMode === OvertimeMode.DISABLED ? 0 : rawOvertimeMinutes;
  if (input.overtimeMode === OvertimeMode.SCHEDULED_ONLY && rule.endMinutes === null) calculatedOvertimeMinutes = 0;
  const status = input.leaveMinutes && validWorkMinutes < minimumMinutes ? DayStatus.PARTIAL_LEAVE : input.leaveMinutes && validWorkMinutes >= minimumMinutes ? DayStatus.ON_LEAVE : input.offTimeMinutes ? DayStatus.PARTIAL_OFF_TIME : anomalies.length ? DayStatus.INCOMPLETE : validWorkMinutes < minimumMinutes ? DayStatus.INSUFFICIENT_TIME : DayStatus.PRESENT;
  return { status, requiredMinutes: rule.requiredMinutes, minimumMinutes, firstIn, lastOut, rawPresenceMinutes, validWorkMinutes, breakMinutes, lateMinutes, earlyDepartureMinutes, deficitMinutes, rawOvertimeMinutes, calculatedOvertimeMinutes, anomalies, sessions };
}
function emptyResult(status: DayStatus): AttendanceResult { return { status, requiredMinutes: 0, minimumMinutes: 0, firstIn: null, lastOut: null, rawPresenceMinutes: 0, validWorkMinutes: 0, breakMinutes: 0, lateMinutes: 0, earlyDepartureMinutes: 0, deficitMinutes: 0, rawOvertimeMinutes: 0, calculatedOvertimeMinutes: 0, anomalies: [], sessions: [] }; }
export function toAttendanceDayData(result: AttendanceResult): Prisma.AttendanceDayUncheckedCreateInput { return { status: result.status, requiredMinutes: result.requiredMinutes, minimumMinutes: result.minimumMinutes, firstIn: result.firstIn, lastOut: result.lastOut, rawPresenceMinutes: result.rawPresenceMinutes, validWorkMinutes: result.validWorkMinutes, breakMinutes: result.breakMinutes, lateMinutes: result.lateMinutes, earlyDepartureMinutes: result.earlyDepartureMinutes, deficitMinutes: result.deficitMinutes, rawOvertimeMinutes: result.rawOvertimeMinutes, calculatedOvertimeMinutes: result.calculatedOvertimeMinutes, approvedOvertimeMinutes: 0, leaveMinutes: 0, offTimeMinutes: 0, anomalies: result.anomalies } as Prisma.AttendanceDayUncheckedCreateInput; }
