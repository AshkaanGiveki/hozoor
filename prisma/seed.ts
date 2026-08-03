import { db } from "../src/server/db";
import { hashPassword } from "../src/server/security";
import { EventType, LedgerType, OvertimeMode, PolicyStatus, RoleCode } from "@prisma/client";
import { recalculateDates } from "../src/server/attendance-service";

const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const at = (iso: string) => new Date(`${iso}Z`);
async function ensureUser(companyId: string, username: string, firstName: string, lastName: string, role: RoleCode, password: string, mustChangePassword = false) {
  const passwordHash = await hashPassword(password);
  return db.user.upsert({ where: { companyId_username: { companyId, username } }, update: { firstName, lastName, role, status: "ACTIVE" }, create: { companyId, username, firstName, lastName, role, passwordHash, mustChangePassword } });
}
async function main() {
  let company = await db.companyProfile.findFirst();
  if (!company) company = await db.companyProfile.create({ data: { name: "شرکت نمونه هوضور", legalName: "شرکت نمونه فناوری", timezone: "Asia/Tehran" } });
  const bootstrapUsername = process.env.BOOTSTRAP_ADMIN_USERNAME ?? "admin";
  const bootstrapPassword = process.env.BOOTSTRAP_ADMIN_PASSWORD ?? "ChangeMe123!";
  const admin = await db.user.findFirst({ where: { companyId: company.id, role: RoleCode.ADMIN } }) ?? await ensureUser(company.id, bootstrapUsername, process.env.BOOTSTRAP_ADMIN_FIRST_NAME ?? "مدیر", process.env.BOOTSTRAP_ADMIN_LAST_NAME ?? "سامانه", RoleCode.ADMIN, bootstrapPassword, process.env.FORCE_BOOTSTRAP_PASSWORD_CHANGE !== "false");
  if (process.env.SEED_DEMO_DATA !== "true") return;
  const hr = await ensureUser(company.id, "hr", "سارا", "احمدی", RoleCode.HR_ADMIN, "HrDemo123!", false);
  const manager = await ensureUser(company.id, "manager", "رضا", "کریمی", RoleCode.MANAGER, "Manager123!", false);
  const manager2 = await ensureUser(company.id, "manager2", "مینا", "مرادی", RoleCode.MANAGER, "Manager123!", false);
  const department = await db.department.upsert({ where: { companyId_name: { companyId: company.id, name: "فناوری اطلاعات" } }, update: {}, create: { companyId: company.id, name: "فناوری اطلاعات", code: "IT" } });
  const team = await db.team.upsert({ where: { companyId_name: { companyId: company.id, name: "محصول" } }, update: { departmentId: department.id }, create: { companyId: company.id, name: "محصول", departmentId: department.id } });
  const team2 = await db.team.upsert({ where: { companyId_name: { companyId: company.id, name: "عملیات" } }, update: { departmentId: department.id }, create: { companyId: company.id, name: "عملیات", departmentId: department.id } });
  await db.managerAssignment.deleteMany({ where: { managerId: { in: [manager.id, manager2.id] } } });
  await db.managerAssignment.createMany({ data: [{ managerId: manager.id, teamId: team.id, startDate: day("2025-01-01") }, { managerId: manager2.id, teamId: team2.id, startDate: day("2025-01-01") }] });
  const policy = await db.attendancePolicy.upsert({ where: { companyId_name_version: { companyId: company.id, name: "قانون استاندارد", version: 1 } }, update: { status: PolicyStatus.ACTIVE }, create: { companyId: company.id, name: "قانون استاندارد", version: 1, effectiveFrom: day("2025-01-01"), status: PolicyStatus.ACTIVE, minimumDailyMinutes: 450, graceMinutes: 0, overtimeMode: OvertimeMode.DISABLED, createdById: admin.id, dailyRules: { create: Array.from({length:7}, (_,weekday) => ({ weekday, isWorkingDay: weekday !== 5, startMinutes: weekday === 4 ? 540 : 540, endMinutes: weekday === 4 ? 780 : 1020, flexibleEntryUntil: weekday === 4 ? 555 : 570, requiredMinutes: weekday === 4 ? 300 : 480, minimumMinutes: weekday === 4 ? 285 : 450, breakMinutes: 30 })) } } });
  const schedule = await db.workScheduleTemplate.upsert({ where: { id: "demo-schedule-fixed" }, update: {}, create: { id: "demo-schedule-fixed", companyId: company.id, name: "برنامه اداری استاندارد", shifts: { create: { name: "اداری", startMinutes: 540, endMinutes: 1020 } } } });
  const people = [
    ["1001","علی","رضایی","employee1","EMPLOYEE",team.id], ["1002","نگار","محمدی","employee2","EMPLOYEE",team.id], ["2001","پویان","حسینی","employee3","EMPLOYEE",team2.id]
  ] as const;
  const employees = [];
  for (const [code,first,last,username,role,teamId] of people) {
    const user = await ensureUser(company.id, username, first, last, role as RoleCode, "Employee123!", true);
    const employee = await db.employee.upsert({ where: { companyId_employeeCode: { companyId: company.id, employeeCode: code } }, update: { userId: user.id, teamId, departmentId: department.id }, create: { companyId: company.id, userId: user.id, employeeCode: code, firstName: first, lastName: last, teamId, departmentId: department.id, employmentStart: day("2025-01-01"), createdById: admin.id } });
    employees.push(employee);
    await db.scheduleAssignment.upsert({ where: { id: `assignment-${code}` }, update: {}, create: { id: `assignment-${code}`, employeeId: employee.id, scheduleId: schedule.id, startDate: day("2025-01-01") } });
    const leaveType = await db.leaveType.upsert({ where: { companyId_name: { companyId: company.id, name: "مرخصی استحقاقی روزانه" } }, update: {}, create: { companyId: company.id, name: "مرخصی استحقاقی روزانه", unit: "DAY", paid: true } });
    const balance = await db.leaveBalance.upsert({ where: { employeeId_leaveTypeId_year: { employeeId: employee.id, leaveTypeId: leaveType.id, year: 2025 } }, update: {}, create: { employeeId: employee.id, leaveTypeId: leaveType.id, year: 2025, openingMinutes: 4800 } });
    if (!(await db.leaveBalanceTransaction.findFirst({ where: { balanceId: balance.id, type: LedgerType.OPENING } }))) await db.leaveBalanceTransaction.create({ data: { balanceId: balance.id, type: LedgerType.OPENING, minutes: 4800, description: "مانده اولیه نمونه" } });
  }
  const device = await db.attendanceDevice.upsert({ where: { id: "demo-device" }, update: {}, create: { id: "demo-device", companyId: company.id, name: "دستگاه ورودی اصلی", type: "generic-csv" } });
  for (const employee of employees) await db.deviceEmployeeMapping.upsert({ where: { deviceId_employeeId: { deviceId: device.id, employeeId: employee.id } }, update: {}, create: { deviceId: device.id, employeeId: employee.id, externalId: employee.employeeCode } });
  const demoDate = new Date();
  demoDate.setUTCHours(0, 0, 0, 0);
  demoDate.setUTCDate(demoDate.getUTCDate() - 2);
  const date = demoDate.toISOString().slice(0, 10);
  for (const [idx,employee] of employees.entries()) {
    const events = idx === 1 ? [["IN", "09:20:00"],["OUT","15:30:00"]] : [["IN","09:12:00"],["OUT", idx === 0 ? "18:10:00" : "16:30:00"]];
    for (const [type,time] of events) { const timestamp = at(`${date}T${time}`); const fingerprint = `${device.id}-${employee.id}-${timestamp.toISOString()}-${type}`; await db.rawAttendanceEvent.upsert({ where: { fingerprint }, update: {}, create: { companyId: company.id, deviceId: device.id, employeeId: employee.id, externalId: employee.employeeCode, timestamp, type: type as EventType, fingerprint } }); }
  }
  const leaveType = await db.leaveType.findFirstOrThrow({ where: { companyId: company.id, name: "مرخصی استحقاقی روزانه" } });
  const approvedLeaveDate = new Date(demoDate); approvedLeaveDate.setUTCDate(approvedLeaveDate.getUTCDate() - 1);
  if (!(await db.leaveRequest.findFirst({ where: { companyId: company.id, employeeId: employees[0].id, startDate: approvedLeaveDate } }))) await db.leaveRequest.create({ data: { companyId: company.id, employeeId: employees[0].id, leaveTypeId: leaveType.id, status: "APPROVED", startDate: approvedLeaveDate, endDate: approvedLeaveDate, requestedMinutes: 480, reason: "نمونهٔ مرخصی تأییدشده" } });
  if (!(await db.attendanceCorrectionRequest.findFirst({ where: { companyId: company.id, employeeId: employees[1].id, date: demoDate } }))) await db.attendanceCorrectionRequest.create({ data: { companyId: company.id, employeeId: employees[1].id, status: "PENDING_MANAGER", date: demoDate, proposedOut: at(`${date}T18:00:00`), reason: "نمونهٔ درخواست اصلاح خروج" } });
  const holidayDate = new Date(demoDate); holidayDate.setUTCDate(holidayDate.getUTCDate() + 1);
  await db.holiday.upsert({ where: { companyId_date: { companyId: company.id, date: holidayDate } }, update: {}, create: { companyId: company.id, date: holidayDate, title: "تعطیلی نمونه" } });
  await recalculateDates(company.id, employees.map((employee) => employee.id), [day(date), approvedLeaveDate]);
  console.log(`Hozoor seed ready for ${company.name}; admin=${admin.username}, hr=${hr.username}`);
}
main().catch((error) => { console.error(error); process.exit(1); }).finally(async () => db.$disconnect());
