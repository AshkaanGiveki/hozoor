import { Prisma } from "@prisma/client";
import { db } from "./db";
import { checksumRules, productionPayrollGate } from "./payroll";

type RuleData = {
  workingDays?: number;
  workingHoursPerDay?: number;
  overtimeMultiplier?: number;
  employeeInsuranceRate?: number;
  employerInsuranceRate?: number;
  taxRate?: number;
  taxExemption?: number;
  insuranceCeiling?: number;
  taxBrackets?: ReadonlyArray<{ upTo?: number; rate: number }>;
  minimumMonthlySalary?: number;
  minimumDailyWage?: number;
  insuranceCeilingMultiplier?: number;
  specialTaxRates?: Record<string, number>;
  taxAnnualized?: boolean;
  nightWorkMultiplier?: number;
  fridayWorkMultiplier?: number;
  holidayWorkMultiplier?: number;
};
type PolicyData = { rounding?: "nearest-rial" | "floor" | "ceil"; overtimeRequiresApproval?: boolean; absenceDeductionMode?: "NONE" | "DAILY_BASE"; attendanceShortfallDeductionMode?: "NONE" | "HOURLY_BASE" };
export type AttendancePayrollSummary = { absenceDays: number; leaveDays: number; deficitMinutes: number };
export type CompensationComponentType = "ALLOWANCE" | "BONUS" | "COMMISSION" | "BENEFIT" | "OTHER_EARNING" | "LOAN_REPAYMENT" | "ADVANCE_REPAYMENT" | "OTHER_DEDUCTION";
type Component = { code: string; label: string; type?: CompensationComponentType; amount: number; taxable?: boolean; insurable?: boolean; prorateForPartTime?: boolean };

const earningComponentTypes: CompensationComponentType[] = ["ALLOWANCE", "BONUS", "COMMISSION", "BENEFIT", "OTHER_EARNING"];

export function isEarningComponent(component: Component) {
  return earningComponentTypes.includes(component.type ?? "ALLOWANCE");
}

const money = (value: Prisma.Decimal | number | string) => new Prisma.Decimal(value);
export function applyPartTimeRatio(value: Prisma.Decimal, ratio?: Prisma.Decimal | number | string | null) { return value.mul(ratio === undefined || ratio === null ? 1 : ratio); }
export function roundPayrollAmount(value: Prisma.Decimal, rounding: PolicyData["rounding"] = "nearest-rial") {
  if (rounding === "floor") return value.toDecimalPlaces(0, Prisma.Decimal.ROUND_DOWN);
  if (rounding === "ceil") return value.toDecimalPlaces(0, Prisma.Decimal.ROUND_UP);
  return value.toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP);
}
function rounded(value: Prisma.Decimal, policy: PolicyData = {}) { return roundPayrollAmount(value, policy.rounding); }
export function calculateProgressiveTax(base: Prisma.Decimal, rules: RuleData, taxCategory?: string) {
  const periodBase = rules.taxAnnualized ? base.mul(12) : base;
  const taxable = periodBase.minus(rules.taxExemption ?? 0).greaterThan(0) ? periodBase.minus(rules.taxExemption ?? 0) : money(0);
  const specialRate = taxCategory ? rules.specialTaxRates?.[taxCategory] : undefined;
  if (specialRate !== undefined) {
    const result = taxable.mul(specialRate);
    return rules.taxAnnualized ? result.div(12) : result;
  }
  if (!rules.taxBrackets?.length) return taxable.mul(rules.taxRate ?? 0);
  let lower = money(0); let result = money(0);
  for (const bracket of rules.taxBrackets) {
    const upper = bracket.upTo === undefined ? taxable : money(bracket.upTo);
    const band = taxable.lessThan(upper) ? taxable.minus(lower) : upper.minus(lower);
    if (band.greaterThan(0)) result = result.plus(band.mul(bracket.rate));
    lower = upper;
    if (taxable.lessThanOrEqualTo(upper)) break;
  }
  return rules.taxAnnualized ? result.div(12) : result;
}
export function calculateOvertimePay(hourlyRate: Prisma.Decimal, minutes: number, multiplier: number) { return hourlyRate.mul(minutes).div(60).mul(multiplier); }
export function calculatePremiumPay(hourlyRate: Prisma.Decimal, minutes: number, multiplier?: number) { return multiplier === undefined ? money(0) : hourlyRate.mul(minutes).div(60).mul(Math.max(0, multiplier - 1)); }
export function capInsurableBase(base: Prisma.Decimal, ceiling?: number) { return ceiling === undefined ? base : Prisma.Decimal.min(base, money(ceiling)); }
export function calculateInsuranceCeiling(rules: RuleData, insuredDays: number) {
  if (rules.minimumDailyWage !== undefined && rules.insuranceCeilingMultiplier !== undefined) return money(rules.minimumDailyWage).mul(rules.insuranceCeilingMultiplier).mul(Math.max(0, insuredDays));
  return rules.insuranceCeiling === undefined ? undefined : money(rules.insuranceCeiling);
}
export function calculateAttendanceDeductions(dailyBase: Prisma.Decimal, hourlyBase: Prisma.Decimal, attendance: AttendancePayrollSummary, policy: PolicyData = {}) {
  const absence = policy.absenceDeductionMode === "DAILY_BASE" ? dailyBase.mul(Math.max(0, attendance.absenceDays)) : money(0);
  const shortfall = policy.attendanceShortfallDeductionMode === "HOURLY_BASE" ? hourlyBase.mul(Math.max(0, attendance.deficitMinutes)).div(60) : money(0);
  return { absence, shortfall, total: absence.plus(shortfall) };
}

export async function calculatePayrollPeriod(periodId: string, companyId: string) {
  const productionGateError = productionPayrollGate();
  if (productionGateError) throw new Error(`PAYROLL_PRODUCTION_DISABLED:${productionGateError}`);
  const period = await db.payrollPeriod.findFirst({ where: { id: periodId, companyId }, include: { ruleSet: true, payrollPolicy: true } });
  if (!period) throw new Error("PAYROLL_PERIOD_NOT_FOUND");
  if (!["DRAFT", "CALCULATED", "CORRECTED"].includes(period.status)) throw new Error("PAYROLL_PERIOD_NOT_CALCULABLE");
  const rules = (period.ruleSet.rules || {}) as RuleData;
  const policy = (period.payrollPolicy?.settings || {}) as PolicyData;
  const requiredRules: Array<keyof RuleData> = ["workingDays", "workingHoursPerDay", "overtimeMultiplier", "employeeInsuranceRate", "employerInsuranceRate"];
  if (requiredRules.some((key) => typeof rules[key] !== "number" || !Number.isFinite(rules[key] as number)) || (typeof rules.taxRate !== "number" && !rules.taxBrackets?.length)) throw new Error("RULES_INCOMPLETE:workingDays,workingHoursPerDay,overtimeMultiplier,employeeInsuranceRate,employerInsuranceRate,and taxRate or taxBrackets are required");
  const workingDays = rules.workingDays as number;
  const workingHours = rules.workingHoursPerDay as number;
  const overtimeMultiplier = rules.overtimeMultiplier as number;
  const employeeInsuranceRate = rules.employeeInsuranceRate as number;
  const employerInsuranceRate = rules.employerInsuranceRate as number;
  const taxRate = rules.taxRate ?? 0;
  if (workingDays <= 0 || workingHours <= 0 || overtimeMultiplier < 0 || employeeInsuranceRate < 0 || employerInsuranceRate < 0 || taxRate < 0) throw new Error("RULES_INVALID:legal rates and working-time values must be non-negative and working time must be positive");
  const employees = await db.employee.findMany({ where: { companyId, active: true }, orderBy: { employeeCode: "asc" } });
  const missingCompensation: string[] = [];
  const calculations: Array<{ employeeId: string; compensationProfileId: string; gross: Prisma.Decimal; taxable: Prisma.Decimal; insurable: Prisma.Decimal; employeeInsurance: Prisma.Decimal; employerInsurance: Prisma.Decimal; tax: Prisma.Decimal; net: Prisma.Decimal; lines: Array<{ type: "BASE_SALARY" | "ALLOWANCE" | "BONUS" | "COMMISSION" | "BENEFIT" | "OVERTIME" | "TAX" | "EMPLOYEE_INSURANCE" | "EMPLOYER_INSURANCE" | "LOAN_REPAYMENT" | "ADVANCE_REPAYMENT" | "OTHER_EARNING" | "OTHER_DEDUCTION"; code: string; label: string; amount: Prisma.Decimal; sourceData: object }> ; snapshot: object }> = [];

  for (const employee of employees) {
    const compensation = await db.compensationProfile.findFirst({ where: { employeeId: employee.id, status: "ACTIVE", effectiveFrom: { lte: period.endDate }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: period.startDate } }] }, orderBy: { effectiveFrom: "desc" } });
    if (!compensation) { missingCompensation.push(employee.employeeCode); continue; }
    const days = await db.attendanceDay.findMany({ where: { employeeId: employee.id, date: { gte: period.startDate, lte: period.endDate } }, select: { date: true, validWorkMinutes: true, approvedOvertimeMinutes: true, rawOvertimeMinutes: true, lateMinutes: true, earlyDepartureMinutes: true, deficitMinutes: true, leaveMinutes: true, nightWorkMinutes: true, fridayWorkMinutes: true, holidayWorkMinutes: true, status: true } });
    const adjustments = await db.payrollAdjustment.findMany({ where: { periodId, employeeId: employee.id, payrollRunId: null }, select: { id: true, code: true, label: true, amount: true, taxable: true, insurable: true, reason: true } });
    const workedDays = days.filter((day) => day.validWorkMinutes > 0).length;
    const overtimeMinutes = days.reduce((sum, day) => sum + (policy.overtimeRequiresApproval === false ? day.rawOvertimeMinutes : day.approvedOvertimeMinutes), 0);
    const attendanceSummary = { workedDays, absenceDays: days.filter((day) => day.status === "ABSENT").length, leaveDays: days.filter((day) => ["ON_LEAVE", "PARTIAL_LEAVE"].includes(day.status)).length, holidayDays: days.filter((day) => day.status === "HOLIDAY").length, validWorkMinutes: days.reduce((sum, day) => sum + day.validWorkMinutes, 0), overtimeMinutes, leaveMinutes: days.reduce((sum, day) => sum + day.leaveMinutes, 0), lateMinutes: days.reduce((sum, day) => sum + day.lateMinutes, 0), earlyDepartureMinutes: days.reduce((sum, day) => sum + day.earlyDepartureMinutes, 0), deficitMinutes: days.reduce((sum, day) => sum + day.deficitMinutes, 0), nightWorkMinutes: days.reduce((sum, day) => sum + day.nightWorkMinutes, 0), fridayWorkMinutes: days.reduce((sum, day) => sum + day.fridayWorkMinutes, 0), holidayWorkMinutes: days.reduce((sum, day) => sum + day.holidayWorkMinutes, 0) };
    const components = Array.isArray(compensation.components) ? compensation.components as unknown as Component[] : [];
    const partTimeRatio = compensation.partTimeRatio ?? money(1);
    const base = applyPartTimeRatio(money(compensation.baseSalary), partTimeRatio);
    if (rules.minimumMonthlySalary !== undefined && base.lessThan(money(rules.minimumMonthlySalary).mul(partTimeRatio))) throw new Error(`COMPENSATION_BELOW_MINIMUM:${employee.employeeCode}`);
    const earnings = components.filter(isEarningComponent);
    const deductions = components.filter((item) => !isEarningComponent(item));
    const componentAmount = (item: Component) => applyPartTimeRatio(money(item.amount), isEarningComponent(item) && item.prorateForPartTime !== false ? partTimeRatio : null);
    const componentEarnings = earnings.reduce((sum, item) => sum.plus(componentAmount(item)), money(0));
    const componentDeductions = deductions.reduce((sum, item) => sum.plus(componentAmount(item)), money(0));
    const hourly = compensation.hourlyRate ? money(compensation.hourlyRate) : money(compensation.dailyRate ?? base.div(workingDays)).div(workingHours);
    const daily = compensation.dailyRate ? money(compensation.dailyRate) : base.div(workingDays);
    const attendanceDeductions = calculateAttendanceDeductions(daily, hourly, attendanceSummary, policy);
    const overtime = calculateOvertimePay(hourly, overtimeMinutes, overtimeMultiplier);
    const nightPremium = calculatePremiumPay(hourly, attendanceSummary.nightWorkMinutes, rules.nightWorkMultiplier);
    const fridayPremium = calculatePremiumPay(hourly, attendanceSummary.fridayWorkMinutes, rules.fridayWorkMultiplier);
    const holidayPremium = calculatePremiumPay(hourly, attendanceSummary.holidayWorkMinutes, rules.holidayWorkMultiplier);
    const premiumEarnings = nightPremium.plus(fridayPremium).plus(holidayPremium);
    const adjustmentEarnings = adjustments.filter((item) => item.amount.gt(0)).reduce((sum, item) => sum.plus(item.amount), money(0));
    const adjustmentDeductions = adjustments.filter((item) => item.amount.lt(0)).reduce((sum, item) => sum.plus(item.amount.abs()), money(0));
    const gross = rounded(base.plus(componentEarnings).plus(overtime).plus(premiumEarnings).plus(adjustmentEarnings), policy);
    const taxableAdjustments = adjustments.filter((item) => item.taxable).reduce((sum, item) => sum.plus(item.amount), money(0));
    const insurableAdjustments = adjustments.filter((item) => item.insurable).reduce((sum, item) => sum.plus(item.amount), money(0));
    const taxable = rounded(base.plus(earnings.filter((item) => item.taxable !== false).reduce((sum, item) => sum.plus(componentAmount(item)), money(0))).plus(overtime).plus(premiumEarnings).plus(taxableAdjustments), policy);
    const calculatedInsurable = rounded(base.plus(earnings.filter((item) => item.insurable !== false).reduce((sum, item) => sum.plus(componentAmount(item)), money(0))).plus(overtime).plus(premiumEarnings).plus(insurableAdjustments), policy);
    const insuredDays = Math.max(0, Math.floor((period.endDate.getTime() - period.startDate.getTime()) / 86_400_000) + 1);
    const insurable = capInsurableBase(calculatedInsurable, calculateInsuranceCeiling(rules, insuredDays)?.toNumber());
    const employeeInsurance = rounded(insurable.mul(employeeInsuranceRate), policy);
    const employerInsurance = rounded(insurable.mul(employerInsuranceRate), policy);
    const tax = rounded(calculateProgressiveTax(taxable, rules, compensation.taxStatus), policy);
    const net = rounded(gross.minus(employeeInsurance).minus(tax).minus(componentDeductions).minus(adjustmentDeductions).minus(attendanceDeductions.total), policy);
    const premiumLines = [
      { type: "OTHER_EARNING" as const, code: "NIGHT_WORK_PREMIUM", label: "Night-work premium", amount: rounded(nightPremium, policy), sourceData: { minutes: attendanceSummary.nightWorkMinutes, multiplier: rules.nightWorkMultiplier ?? null } },
      { type: "OTHER_EARNING" as const, code: "FRIDAY_WORK_PREMIUM", label: "Friday-work premium", amount: rounded(fridayPremium, policy), sourceData: { minutes: attendanceSummary.fridayWorkMinutes, multiplier: rules.fridayWorkMultiplier ?? null } },
      { type: "OTHER_EARNING" as const, code: "HOLIDAY_WORK_PREMIUM", label: "Holiday-work premium", amount: rounded(holidayPremium, policy), sourceData: { minutes: attendanceSummary.holidayWorkMinutes, multiplier: rules.holidayWorkMultiplier ?? null } },
    ].filter((line) => line.amount.gt(0));
    const lines = [
      { type: "BASE_SALARY" as const, code: "BASE", label: "Base salary", amount: rounded(base, policy), sourceData: { compensationProfileId: compensation.id, workedDays } },
      ...components.map((item) => ({ type: (item.type ?? "ALLOWANCE") as "ALLOWANCE" | "BONUS" | "COMMISSION" | "BENEFIT" | "OTHER_EARNING" | "LOAN_REPAYMENT" | "ADVANCE_REPAYMENT" | "OTHER_DEDUCTION", code: item.code, label: item.label, amount: rounded(isEarningComponent(item) ? componentAmount(item) : componentAmount(item).neg(), policy), sourceData: { compensationProfileId: compensation.id, componentType: item.type ?? "ALLOWANCE", taxable: item.taxable !== false, insurable: item.insurable !== false, partTimeRatio: partTimeRatio.toString(), prorated: isEarningComponent(item) && item.prorateForPartTime !== false } })),
      { type: "OVERTIME" as const, code: "OVERTIME", label: "Policy overtime", amount: rounded(overtime, policy), sourceData: { overtimeMinutes, multiplier: overtimeMultiplier, requiresApproval: policy.overtimeRequiresApproval !== false } },
      ...premiumLines,
      ...adjustments.map((item) => ({ type: item.amount.gte(0) ? "OTHER_EARNING" as const : "OTHER_DEDUCTION" as const, code: item.code, label: item.label, amount: rounded(item.amount, policy), sourceData: { adjustmentId: item.id, reason: item.reason, taxable: item.taxable, insurable: item.insurable } })),
      { type: "OTHER_DEDUCTION" as const, code: "ABSENCE_DEDUCTION", label: "Unpaid absence deduction", amount: rounded(attendanceDeductions.absence.neg(), policy), sourceData: { mode: policy.absenceDeductionMode ?? "NONE", absenceDays: attendanceSummary.absenceDays, dailyBase: daily.toString() } },
      { type: "OTHER_DEDUCTION" as const, code: "ATTENDANCE_SHORTFALL_DEDUCTION", label: "Attendance shortfall deduction", amount: rounded(attendanceDeductions.shortfall.neg(), policy), sourceData: { mode: policy.attendanceShortfallDeductionMode ?? "NONE", deficitMinutes: attendanceSummary.deficitMinutes, hourlyBase: hourly.toString() } },
      { type: "EMPLOYEE_INSURANCE" as const, code: "EMPLOYEE_INSURANCE", label: "Employee insurance", amount: employeeInsurance.neg(), sourceData: { rate: employeeInsuranceRate, base: insurable.toString(), insuredDays, ceiling: calculateInsuranceCeiling(rules, insuredDays)?.toString() ?? null } },
      { type: "TAX" as const, code: "TAX", label: "Tax", amount: tax.neg(), sourceData: { rate: taxRate, brackets: rules.taxBrackets ?? null, taxCategory: compensation.taxStatus, annualized: rules.taxAnnualized === true, base: taxable.toString() } },
      { type: "EMPLOYER_INSURANCE" as const, code: "EMPLOYER_INSURANCE", label: "Employer insurance", amount: employerInsurance, sourceData: { rate: employerInsuranceRate, base: insurable.toString(), insuredDays } },
    ];
    const snapshot = { employeeId: employee.id, compensationProfileId: compensation.id, ruleSetId: period.ruleSetId, ruleSetChecksum: period.ruleSet.checksum, payrollPolicyId: period.payrollPolicyId, payrollPolicySettings: period.payrollPolicy?.settings ?? null, attendanceDayIds: days.map((day) => day.date.toISOString()), attendanceSummary, rules, source: "attendance-and-compensation" };
    calculations.push({ employeeId: employee.id, compensationProfileId: compensation.id, gross, taxable, insurable, employeeInsurance, employerInsurance, tax, net, lines, snapshot });
  }
  if (missingCompensation.length) throw new Error(`MISSING_COMPENSATION:${missingCompensation.join(",")}`);
  await db.$transaction(async (tx) => {
    await tx.payrollRun.deleteMany({ where: { periodId } });
    for (const calculation of calculations) {
      const deductionLines = calculation.lines.filter((line) => ["TAX", "EMPLOYEE_INSURANCE", "LOAN_REPAYMENT", "ADVANCE_REPAYMENT", "OTHER_DEDUCTION"].includes(line.type)).reduce((sum, line) => sum.plus(line.amount.abs()), money(0));
      const run = await tx.payrollRun.create({ data: { periodId, employeeId: calculation.employeeId, compensationProfileId: calculation.compensationProfileId, snapshot: calculation.snapshot, snapshotChecksum: checksumRules(calculation.snapshot), grossAmount: calculation.gross, taxableAmount: calculation.taxable, insurableAmount: calculation.insurable, employeeInsurance: calculation.employeeInsurance, employerInsurance: calculation.employerInsurance, taxAmount: calculation.tax, totalDeductions: deductionLines, netPayable: calculation.net, lines: { create: calculation.lines.map((line) => ({ type: line.type, code: line.code, label: line.label, amount: line.amount, sourceData: line.sourceData })) } } });
      await tx.payrollPayment.upsert({ where: { payrollRunId: run.id }, update: { amount: calculation.net, status: "PENDING", paidAt: null, paymentReference: null, failureReason: null }, create: { companyId, periodId, employeeId: calculation.employeeId, payrollRunId: run.id, amount: calculation.net, status: "PENDING" } });
    }
    await tx.payrollPeriod.update({ where: { id: periodId }, data: { status: "CALCULATED", calculatedAt: new Date() } });
  });
  return { count: calculations.length, missingCompensation };
}
