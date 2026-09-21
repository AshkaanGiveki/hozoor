import crypto from "node:crypto";
import { CompensationStatus, PayrollPeriodStatus, PayrollRuleStatus, RoleCode } from "@prisma/client";
import { db } from "./db";

export function canManagePayroll(role: RoleCode) {
  return role === RoleCode.ADMIN || role === RoleCode.HR_ADMIN;
}

export const payrollPeriodTransitions: Record<PayrollPeriodStatus, PayrollPeriodStatus[]> = {
  DRAFT: [],
  CALCULATED: [PayrollPeriodStatus.IN_REVIEW, PayrollPeriodStatus.CORRECTED],
  IN_REVIEW: [PayrollPeriodStatus.APPROVED, PayrollPeriodStatus.CORRECTED],
  APPROVED: [PayrollPeriodStatus.PAID, PayrollPeriodStatus.REVERSED],
  PAID: [PayrollPeriodStatus.LOCKED, PayrollPeriodStatus.REVERSED],
  LOCKED: [PayrollPeriodStatus.REVERSED],
  REVERSED: [],
  CORRECTED: [PayrollPeriodStatus.CALCULATED],
};

export function canApprovePayrollPeriod(status: PayrollPeriodStatus, creatorId: string, approverId: string) {
  return status === PayrollPeriodStatus.IN_REVIEW && creatorId !== approverId;
}

export function canConfirmPayrollPayment(userId: string, creatorId: string, approverId: string | null) {
  return Boolean(approverId) && userId !== creatorId && userId !== approverId;
}

export function checksumRules(rules: unknown) {
  return crypto.createHash("sha256").update(JSON.stringify(rules)).digest("hex");
}

export function validateLegalRules(rules: unknown) {
  if (!rules || typeof rules !== "object" || Array.isArray(rules)) return "Rules must be a JSON object.";
  const record = rules as Record<string, unknown>;
  const required = ["workingDays", "workingHoursPerDay", "overtimeMultiplier", "employeeInsuranceRate", "employerInsuranceRate"];
  const missing = required.filter((key) => typeof record[key] !== "number" || !Number.isFinite(record[key] as number));
  if (missing.length) return `Missing required legal rule values: ${missing.join(", ")}.`;
  if (typeof record.taxRate !== "number" && !Array.isArray(record.taxBrackets)) return "Either taxRate or taxBrackets is required.";
  if (Array.isArray(record.taxBrackets) && record.taxBrackets.some((item) => !item || typeof item !== "object" || typeof (item as { rate?: unknown }).rate !== "number" || ((item as { rate: number }).rate < 0) || ((item as { upTo?: unknown }).upTo !== undefined && (typeof (item as { upTo?: unknown }).upTo !== "number" || (item as { upTo: number }).upTo <= 0)))) return "Tax brackets must contain non-negative rates and positive upTo values.";
  if ((record.workingDays as number) <= 0 || (record.workingHoursPerDay as number) <= 0) return "Working days and working hours must be positive.";
  if (record.minimumMonthlySalary !== undefined && (typeof record.minimumMonthlySalary !== "number" || record.minimumMonthlySalary < 0)) return "minimumMonthlySalary must be non-negative.";
  if (["overtimeMultiplier", "employeeInsuranceRate", "employerInsuranceRate", "taxRate"].some((key) => (record[key] as number) < 0)) return "Legal rates cannot be negative.";
  return null;
}

export function validateRuleSetApproval(sourceReference: string | null | undefined, rules: unknown) {
  if (!sourceReference?.trim()) return "An official source reference is required before approval.";
  return validateLegalRules(rules);
}

export function isValidDateRange(start: Date, end?: Date | null) {
  return !end || end.getTime() > start.getTime();
}

export function validatePayrollPolicy(settings: unknown) {
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) return "Policy settings must be a JSON object.";
  const record = settings as Record<string, unknown>;
  const forbidden = ["minimumMonthlySalary", "taxRate", "taxBrackets", "employeeInsuranceRate", "employerInsuranceRate", "insuranceCeiling"];
  const override = forbidden.find((key) => key in record);
  if (override) return `Company policy cannot define legal rule '${override}'.`;
  if (record.rounding !== undefined && !["nearest-rial", "floor", "ceil"].includes(String(record.rounding))) return "Policy rounding must be nearest-rial, floor, or ceil.";
  if (record.graceMinutes !== undefined && (!Number.isInteger(record.graceMinutes) || (record.graceMinutes as number) < 0 || (record.graceMinutes as number) > 1440)) return "graceMinutes must be an integer from 0 to 1440.";
  if (record.overtimeRequiresApproval !== undefined && typeof record.overtimeRequiresApproval !== "boolean") return "overtimeRequiresApproval must be boolean.";
  if (record.paymentDay !== undefined && (!Number.isInteger(record.paymentDay) || (record.paymentDay as number) < 1 || (record.paymentDay as number) > 31)) return "paymentDay must be between 1 and 31.";
  return null;
}

export function simulatePayrollPolicy(settings: unknown, input: { requestedOvertimeMinutes: number; approvedOvertimeMinutes?: number; amount: number }) {
  const policy = (settings && typeof settings === "object" ? settings : {}) as Record<string, unknown>;
  const requiresApproval = policy.overtimeRequiresApproval !== false;
  const overtimeMinutes = requiresApproval ? Math.max(0, input.approvedOvertimeMinutes ?? 0) : Math.max(0, input.requestedOvertimeMinutes);
  const rounding = policy.rounding ?? "nearest-rial";
  const roundedAmount = rounding === "floor" ? Math.floor(input.amount) : rounding === "ceil" ? Math.ceil(input.amount) : Math.round(input.amount);
  return { overtimeMinutes, roundedAmount, paymentDay: policy.paymentDay ?? null, overtimeRequiresApproval: requiresApproval };
}

export async function hasCompensationOverlap(employeeId: string, start: Date, end?: Date | null, excludeId?: string) {
  const rows = await db.compensationProfile.findMany({
    where: { employeeId, status: { not: CompensationStatus.ARCHIVED }, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
    select: { id: true, effectiveFrom: true, effectiveTo: true },
  });
  return rows.some((row) => {
    const rowEnd = row.effectiveTo?.getTime() ?? Number.POSITIVE_INFINITY;
    const candidateEnd = end?.getTime() ?? Number.POSITIVE_INFINITY;
    return start.getTime() < rowEnd && row.effectiveFrom.getTime() < candidateEnd;
  });
}

export async function hasRuleOverlap(companyId: string, year: number, start: Date, end?: Date | null, excludeId?: string) {
  const rows = await db.payrollRuleSet.findMany({
    where: { companyId, calendarYear: year, status: { not: PayrollRuleStatus.RETIRED }, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
    select: { id: true, effectiveFrom: true, effectiveTo: true },
  });
  return rows.some((row) => {
    const rowEnd = row.effectiveTo?.getTime() ?? Number.POSITIVE_INFINITY;
    const candidateEnd = end?.getTime() ?? Number.POSITIVE_INFINITY;
    return start.getTime() < rowEnd && row.effectiveFrom.getTime() < candidateEnd;
  });
}

export async function hasPolicyOverlap(companyId: string, name: string, start: Date, end?: Date | null, excludeId?: string) {
  const rows = await db.payrollPolicy.findMany({ where: { companyId, name, status: { not: "ARCHIVED" }, ...(excludeId ? { NOT: { id: excludeId } } : {}) }, select: { effectiveFrom: true, effectiveTo: true } });
  return rows.some((row) => start.getTime() < (row.effectiveTo?.getTime() ?? Number.POSITIVE_INFINITY) && row.effectiveFrom.getTime() < (end?.getTime() ?? Number.POSITIVE_INFINITY));
}
