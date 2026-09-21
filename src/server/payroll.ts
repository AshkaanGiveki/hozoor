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
  LOCKED: [PayrollPeriodStatus.CORRECTED],
  REVERSED: [],
  CORRECTED: [PayrollPeriodStatus.CALCULATED],
};

export function canApprovePayrollPeriod(status: PayrollPeriodStatus, creatorId: string, approverId: string) {
  return status === PayrollPeriodStatus.IN_REVIEW && creatorId !== approverId;
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

export function isValidDateRange(start: Date, end?: Date | null) {
  return !end || end.getTime() > start.getTime();
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
