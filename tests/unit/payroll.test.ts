import { describe, expect, it } from "vitest";
import { canApprovePayrollPeriod, canConfirmPayrollPayment, checksumRules, payrollPeriodTransitions, simulatePayrollPolicy, validateLegalRules, validatePayrollPolicy, validateRuleSetApproval } from "@/server/payroll";
import { isEarningComponent } from "@/server/payroll-engine";
import { reconcilePayrollTotals, summarizePayrollRegister } from "@/server/payroll-reporting";
import { Prisma } from "@prisma/client";
import { buildAuditHash } from "@/server/audit";
import { createPayrollIntegrationPayload } from "@/server/payroll-integration";

describe("payroll rule safety", () => {
  it("changes the audit hash when chained audit content changes", () => {
    const base = { companyId: "c", action: "payroll.view", entityType: "PayrollRun", entityId: "r", previousHash: null, createdAt: new Date("2026-01-01T00:00:00.000Z") };
    expect(buildAuditHash({ ...base, after: { net: "100" } })).not.toBe(buildAuditHash({ ...base, after: { net: "101" } }));
  });

  it("builds a deterministic provider-neutral payroll payload", () => {
    const row = { employeeId: "e1", employeeCode: "E1", grossAmount: new Prisma.Decimal(100), totalDeductions: new Prisma.Decimal(10), netPayable: new Prisma.Decimal(90), employeeInsurance: new Prisma.Decimal(7), employerInsurance: new Prisma.Decimal(23), payment: { amount: new Prisma.Decimal(90), status: "PAID" } };
    const input = { companyId: "c1", period: { id: "p1", year: 1405, month: 1, revision: 1, status: "PAID" }, rows: [row] };
    const first = createPayrollIntegrationPayload(input);
    const second = createPayrollIntegrationPayload(input);
    expect(first).toEqual(second);
    expect(first.totals).toEqual({ gross: "100", deductions: "10", netPayable: "90", employerInsurance: "23" });
    expect(first.idempotencyKey).toBe("payroll:c1:p1");
  });
  it("requires a separate reviewer and an explicit review state", () => {
    expect(canApprovePayrollPeriod("IN_REVIEW", "creator", "reviewer")).toBe(true);
    expect(canApprovePayrollPeriod("IN_REVIEW", "creator", "creator")).toBe(false);
    expect(canApprovePayrollPeriod("CALCULATED", "creator", "reviewer")).toBe(false);
    expect(payrollPeriodTransitions.CALCULATED).toContain("IN_REVIEW");
    expect(payrollPeriodTransitions.CALCULATED).not.toContain("APPROVED");
    expect(payrollPeriodTransitions.LOCKED).toContain("REVERSED");
    expect(payrollPeriodTransitions.LOCKED).not.toContain("CORRECTED");
  });

  it("separates payment confirmation from creation and approval", () => {
    expect(canConfirmPayrollPayment("payment-user", "creator", "approver")).toBe(true);
    expect(canConfirmPayrollPayment("creator", "creator", "approver")).toBe(false);
    expect(canConfirmPayrollPayment("approver", "creator", "approver")).toBe(false);
    expect(canConfirmPayrollPayment("payment-user", "creator", null)).toBe(false);
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

  it("summarizes payroll by department and identifies unmatched payments", () => {
    const summary = summarizePayrollRegister([
      { employeeId: "1", employeeCode: "E1", employeeName: "One", departmentId: "d1", departmentName: "Engineering", gross: new Prisma.Decimal(100), deductions: new Prisma.Decimal(10), net: new Prisma.Decimal(90), employerInsurance: new Prisma.Decimal(20), paid: new Prisma.Decimal(90), paymentStatus: "PAID" },
      { employeeId: "2", employeeCode: "E2", employeeName: "Two", departmentId: "d1", departmentName: "Engineering", gross: new Prisma.Decimal(200), deductions: new Prisma.Decimal(20), net: new Prisma.Decimal(180), employerInsurance: new Prisma.Decimal(40), paid: new Prisma.Decimal(0), paymentStatus: "PENDING" },
    ]);
    expect(summary).toEqual([{ departmentId: "d1", departmentName: "Engineering", employeeCount: 2, gross: "300", deductions: "30", net: "270", employerInsurance: "60", paid: "90", unmatched: 1 }]);
  });

  it("reconciles calculated, exported, and paid net totals", () => {
    const rows = [{ employeeId: "1", employeeCode: "E1", employeeName: "One", departmentId: null, departmentName: null, gross: new Prisma.Decimal(100), deductions: new Prisma.Decimal(10), net: new Prisma.Decimal(90), employerInsurance: new Prisma.Decimal(20), paid: new Prisma.Decimal(90), paymentStatus: "PAID" }];
    expect(reconcilePayrollTotals(rows, new Prisma.Decimal(90))).toEqual({ calculatedNet: "90", exportedNet: "90", paidNet: "90", unmatched: 0, exportMatchesCalculated: true });
  });

  it("rejects legal overrides and simulates policy-only choices", () => {
    expect(validatePayrollPolicy({ taxRate: 0.1 })).toContain("cannot define legal rule");
    expect(validatePayrollPolicy({ rounding: "floor", graceMinutes: 15, overtimeRequiresApproval: true, paymentDay: 25 })).toBeNull();
    expect(simulatePayrollPolicy({ rounding: "floor", overtimeRequiresApproval: true, paymentDay: 25 }, { requestedOvertimeMinutes: 120, approvedOvertimeMinutes: 60, amount: 100.9 })).toEqual({ overtimeMinutes: 60, roundedAmount: 100, paymentDay: 25, overtimeRequiresApproval: true });
  });

  it("requires a legal source before a rule set can be approved", () => {
    expect(validateRuleSetApproval(null, { workingDays: 30 })).toContain("source reference");
    expect(validateRuleSetApproval("Official circular 1", { workingDays: 30 })).toContain("Missing required");
  });
});
