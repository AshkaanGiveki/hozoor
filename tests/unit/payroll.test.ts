import { describe, expect, it } from "vitest";
import { canApprovePayrollPeriod, checksumRules, payrollPeriodTransitions, validateLegalRules } from "@/server/payroll";
import { isEarningComponent } from "@/server/payroll-engine";

describe("payroll rule safety", () => {
  it("requires a separate reviewer and an explicit review state", () => {
    expect(canApprovePayrollPeriod("IN_REVIEW", "creator", "reviewer")).toBe(true);
    expect(canApprovePayrollPeriod("IN_REVIEW", "creator", "creator")).toBe(false);
    expect(canApprovePayrollPeriod("CALCULATED", "creator", "reviewer")).toBe(false);
    expect(payrollPeriodTransitions.CALCULATED).toContain("IN_REVIEW");
    expect(payrollPeriodTransitions.CALCULATED).not.toContain("APPROVED");
  });

  it("rejects incomplete legal rules", () => {
    expect(validateLegalRules({ workingDays: 30 })).toContain("Missing required");
  });

  it("accepts a complete non-negative rule set", () => {
    expect(validateLegalRules({ workingDays: 30, workingHoursPerDay: 7.3333, overtimeMultiplier: 1.4, employeeInsuranceRate: 0.07, employerInsuranceRate: 0.23, taxRate: 0.1 })).toBeNull();
  });

  it("creates a stable rule checksum", () => {
    expect(checksumRules({ taxRate: 0.1 })).toBe(checksumRules({ taxRate: 0.1 }));
  });

  it("separates earning components from repayment deductions", () => {
    expect(isEarningComponent({ code: "BONUS", label: "Bonus", type: "BONUS", amount: 100 })).toBe(true);
    expect(isEarningComponent({ code: "LOAN", label: "Loan repayment", type: "LOAN_REPAYMENT", amount: 100 })).toBe(false);
    expect(isEarningComponent({ code: "LEGACY", label: "Legacy allowance", amount: 100 })).toBe(true);
  });
});
