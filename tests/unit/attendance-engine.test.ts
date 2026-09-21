import { describe, expect, it } from "vitest";
import { calculateAttendance } from "@/server/attendance-engine";
import { EventType, OvertimeMode } from "@prisma/client";

const date = (time: string) => new Date(`2025-02-02T${time}Z`);
const rule = { isWorkingDay: true, startMinutes: 540, endMinutes: 1020, flexibleEntryUntil: 570, flexibleExitFrom: null, requiredMinutes: 480, minimumMinutes: 450, breakMinutes: 0 };

describe("attendance calculation", () => {
  it("does not mark arrival inside the grace window as late", () => {
    const result = calculateAttendance({ date: date("00:00"), events: [{ timestamp: date("09:20"), type: EventType.IN }, { timestamp: date("17:00"), type: EventType.OUT }], rule, overtimeMode: OvertimeMode.DISABLED, graceMinutes: 0 });
    expect(result.lateMinutes).toBe(0);
    expect(result.status).toBe("PRESENT");
  });

  it("separates deficit from raw and calculated overtime", () => {
    const result = calculateAttendance({ date: date("00:00"), events: [{ timestamp: date("09:00"), type: EventType.IN }, { timestamp: date("15:00"), type: EventType.OUT }], rule, overtimeMode: OvertimeMode.DISABLED, graceMinutes: 0 });
    expect(result.deficitMinutes).toBe(90);
    expect(result.calculatedOvertimeMinutes).toBe(0);
  });

  it("calculates multiple sessions and breaks", () => {
    const result = calculateAttendance({ date: date("00:00"), events: [{ timestamp: date("09:00"), type: EventType.IN }, { timestamp: date("13:00"), type: EventType.OUT }, { timestamp: date("14:00"), type: EventType.IN }, { timestamp: date("18:00"), type: EventType.OUT }], rule: { ...rule, breakMinutes: 30 }, overtimeMode: OvertimeMode.AUTOMATIC, graceMinutes: 0 });
    expect(result.rawPresenceMinutes).toBe(480);
    expect(result.validWorkMinutes).toBe(450);
    expect(result.calculatedOvertimeMinutes).toBe(0);
  });

  it("flags an incomplete session", () => {
    const result = calculateAttendance({ date: date("00:00"), events: [{ timestamp: date("09:00"), type: EventType.IN }], rule, overtimeMode: OvertimeMode.DISABLED, graceMinutes: 0 });
    expect(result.anomalies).toContain("MISSING_OUT");
    expect(result.status).toBe("INCOMPLETE");
  });

  it("preserves night, Friday, and holiday work minutes", () => {
    const result = calculateAttendance({ date: new Date("2025-02-07T00:00:00Z"), events: [{ timestamp: new Date("2025-02-07T01:00:00Z"), type: EventType.IN }, { timestamp: new Date("2025-02-07T05:00:00Z"), type: EventType.OUT }], rule: { ...rule, isWorkingDay: false }, overtimeMode: OvertimeMode.AUTOMATIC, graceMinutes: 0, holiday: true });
    expect(result.status).toBe("HOLIDAY");
    expect(result.nightWorkMinutes).toBe(240);
    expect(result.fridayWorkMinutes).toBe(240);
    expect(result.holidayWorkMinutes).toBe(240);
  });
});
