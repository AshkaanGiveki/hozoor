import { describe, expect, it } from "vitest";
import { calculateAttendance } from "@/server/attendance-engine";
import { EventType, OvertimeMode } from "@prisma/client";
const date=(time:string)=>new Date(`2025-02-02T${time}Z`);
const rule={isWorkingDay:true,startMinutes:540,endMinutes:1020,flexibleEntryUntil:570,flexibleExitFrom:null,requiredMinutes:480,minimumMinutes:450,breakMinutes:0};
describe("موتور محاسبه حضور",()=>{
  it("ورود داخل پنجره شناور را دیرکرد نمی‌کند",()=>{const r=calculateAttendance({date:date("00:00"),events:[{timestamp:date("09:20"),type:EventType.IN},{timestamp:date("17:00"),type:EventType.OUT}],rule,overtimeMode:OvertimeMode.DISABLED,graceMinutes:0});expect(r.lateMinutes).toBe(0);expect(r.status).toBe("PRESENT");});
  it("کمبود حداقل زمان و اضافه‌کار خام را جدا می‌کند",()=>{const r=calculateAttendance({date:date("00:00"),events:[{timestamp:date("09:00"),type:EventType.IN},{timestamp:date("15:00"),type:EventType.OUT}],rule,overtimeMode:OvertimeMode.DISABLED,graceMinutes:0});expect(r.deficitMinutes).toBe(90);expect(r.calculatedOvertimeMinutes).toBe(0);});
  it("جلسه‌های متعدد و break را محاسبه می‌کند",()=>{const r=calculateAttendance({date:date("00:00"),events:[{timestamp:date("09:00"),type:EventType.IN},{timestamp:date("13:00"),type:EventType.OUT},{timestamp:date("14:00"),type:EventType.IN},{timestamp:date("18:00"),type:EventType.OUT}],rule:{...rule,breakMinutes:30},overtimeMode:OvertimeMode.AUTOMATIC,graceMinutes:0});expect(r.rawPresenceMinutes).toBe(480);expect(r.validWorkMinutes).toBe(450);expect(r.calculatedOvertimeMinutes).toBe(0);});
  it("خروج ناقص را پرچم می‌کند",()=>{const r=calculateAttendance({date:date("00:00"),events:[{timestamp:date("09:00"),type:EventType.IN}],rule,overtimeMode:OvertimeMode.DISABLED,graceMinutes:0});expect(r.anomalies).toContain("MISSING_OUT");expect(r.status).toBe("INCOMPLETE");});
});
