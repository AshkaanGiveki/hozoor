import { describe, expect, it, vi } from "vitest";
import { canApprovePayrollPeriod, canConfirmPayrollPayment, canManagePayroll, checksumRules, maskBankAccountLast4, payrollPeriodTransitions, productionPayrollGate, simulatePayrollPolicy, validateCompensationMinimum, validateLegalRules, validatePayrollPolicy, validateRuleSetApproval } from "@/server/payroll";
import { applyPartTimeRatio, calculateAttendanceDeductions, calculateInsuranceCeiling, calculateOvertimePay, calculateProgressiveTax, capInsurableBase, isEarningComponent, roundPayrollAmount } from "@/server/payroll-engine";
import { calculateIranianEidi, calculateIranianSeverance, iranianPrivateSector1405Rules } from "@/server/iranian-payroll-law";
import { reconcilePayrollTotals, summarizePayrollRegister } from "@/server/payroll-reporting";
import { Prisma, RoleCode } from "@prisma/client";
import { buildAuditHash, verifyAuditChain } from "@/server/audit";
import { createPayrollIntegrationPayload, createPayrollWebhookAdapter } from "@/server/payroll-integration";
import { resolveIntegrationSubmissionOutcome } from "@/server/payroll-integration";
import { canReadAll } from "@/server/permissions";
import annual1405Fixture from "../fixtures/iranian-payroll-1405.json";

describe("payroll rule safety", () => {
  it("changes the audit hash when chained audit content changes", () => {
    const base = { companyId: "c", action: "payroll.view", entityType: "PayrollRun", entityId: "r", previousHash: null, createdAt: new Date("2026-01-01T00:00:00.000Z") };
    expect(buildAuditHash({ ...base, after: { net: "100" } })).not.toBe(buildAuditHash({ ...base, after: { net: "101" } }));
  });

  it("detects a broken audit chain", () => {
    const createdAt = new Date("2026-01-01T00:00:00.000Z");
    const first = { id: "a1", companyId: "c", actorId: null, action: "x", entityType: "y", entityId: null, requestId: null, before: null, after: { value: 1 }, previousHash: null, hash: "", createdAt };
    first.hash = buildAuditHash({ companyId: first.companyId, action: first.action, entityType: first.entityType, before: first.before, after: first.after, previousHash: first.previousHash, createdAt: first.createdAt });
    const second = { ...first, id: "a2", after: { value: 2 }, previousHash: first.hash, hash: "", createdAt: new Date("2026-01-01T00:01:00.000Z") };
    second.hash = buildAuditHash({ companyId: second.companyId, action: second.action, entityType: second.entityType, before: second.before, after: second.after, previousHash: second.previousHash, createdAt: second.createdAt });
    expect(verifyAuditChain([first, second]).valid).toBe(true);
    expect(verifyAuditChain([{ ...first, after: { value: 9 } }, second]).valid).toBe(false);
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

  it("keeps unaccepted integration submissions retryable and never successful", () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    expect(resolveIntegrationSubmissionOutcome(false, 1, 5, now)).toEqual({ status: "RETRYING", nextAttemptAt: new Date("2026-01-01T00:01:00.000Z") });
    expect(resolveIntegrationSubmissionOutcome(false, 5, 5, now)).toEqual({ status: "FAILED", nextAttemptAt: null });
    expect(resolveIntegrationSubmissionOutcome(true, 1, 5, now)).toEqual({ status: "SUCCEEDED", nextAttemptAt: null });
  });

  it("requires explicit webhook acceptance and sends the idempotency key", async () => {
    const payload = { schemaVersion: 1 as const, idempotencyKey: "payroll:c:p", companyId: "c", periodId: "p", period: { year: 1405, month: 1, revision: 0, status: "PAID" }, rows: [], totals: { gross: "0", deductions: "0", netPayable: "0", employerInsurance: "0" }, checksum: "checksum" };
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ externalReference: "ref-without-acceptance" }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    const rejected = await createPayrollWebhookAdapter({ endpoint: "https://example.test/payroll", secret: "secret" }).submit(payload);
    expect(rejected.accepted).toBe(false);
    expect(rejected.message).toContain("without explicit acceptance");
    expect(fetchMock).toHaveBeenCalledWith("https://example.test/payroll", expect.objectContaining({ headers: expect.objectContaining({ "X-Idempotency-Key": payload.idempotencyKey, Authorization: "Bearer secret" }) }));
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ accepted: true, externalReference: "ref-1" }), { status: 202, headers: { "Content-Type": "application/json" } }));
    const accepted = await createPayrollWebhookAdapter({ endpoint: "https://example.test/payroll" }).submit(payload);
    expect(accepted).toMatchObject({ accepted: true, externalReference: "ref-1" });
    vi.unstubAllGlobals();
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

  it("enforces payroll mutation and privacy boundaries by role", () => {
    expect(canManagePayroll(RoleCode.ADMIN)).toBe(true);
    expect(canManagePayroll(RoleCode.HR_ADMIN)).toBe(true);
    expect(canManagePayroll(RoleCode.AUDITOR)).toBe(false);
    expect(canManagePayroll(RoleCode.MANAGER)).toBe(false);
    expect(canManagePayroll(RoleCode.EMPLOYEE)).toBe(false);
    expect(canReadAll({ role: RoleCode.ADMIN })).toBe(true);
    expect(canReadAll({ role: RoleCode.HR_ADMIN })).toBe(true);
    expect(canReadAll({ role: RoleCode.AUDITOR })).toBe(true);
    expect(canReadAll({ role: RoleCode.MANAGER })).toBe(false);
    expect(canReadAll({ role: RoleCode.EMPLOYEE })).toBe(false);
  });

  it("keeps production payroll disabled without explicit legal activation evidence", () => {
    expect(productionPayrollGate({ nodeEnv: "production", enabled: "false", approvalReference: "approved" })).toContain("disabled");
    expect(productionPayrollGate({ nodeEnv: "production", enabled: "true", approvalReference: "" })).toContain("PAYROLL_LEGAL_APPROVAL_REFERENCE");
    expect(productionPayrollGate({ nodeEnv: "production", enabled: "true", approvalReference: "legal-review-2026" })).toBeNull();
    expect(productionPayrollGate({ nodeEnv: "test", enabled: "false" })).toBeNull();
  });

  it("rejects incomplete legal rules", () => {
    expect(validateLegalRules({ workingDays: 30 })).toContain("Missing required");
  });

  it("accepts a complete non-negative rule set", () => {
    expect(validateLegalRules({ workingDays: 30, workingHoursPerDay: 7.3333, overtimeMultiplier: 1.4, employeeInsuranceRate: 0.07, employerInsuranceRate: 0.23, taxRate: 0.1 })).toBeNull();
  });

  it("enforces stable Iranian labour-law baseline constraints without inventing annual rates", () => {
    expect(validateLegalRules({ workingDays: 30, workingHoursPerDay: 8.01, overtimeMultiplier: 1.4, employeeInsuranceRate: 0, employerInsuranceRate: 0, taxRate: 0 })).toContain("article 51");
    expect(validateLegalRules({ workingDays: 30, workingHoursPerDay: 8, weeklyWorkingHours: 45, overtimeMultiplier: 1.4, employeeInsuranceRate: 0, employerInsuranceRate: 0, taxRate: 0 })).toContain("weeklyWorkingHours");
    expect(validateLegalRules({ workingDays: 30, workingHoursPerDay: 8, overtimeMultiplier: 1.39, employeeInsuranceRate: 0, employerInsuranceRate: 0, taxRate: 0 })).toContain("article 59");
    expect(validateLegalRules({ workingDays: 30, workingHoursPerDay: 8, overtimeMultiplier: 1.4, nightWorkMultiplier: 1.34, employeeInsuranceRate: 0, employerInsuranceRate: 0, taxRate: 0 })).toContain("article 58");
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

  it("rejects compensation below an approved minimum salary", () => {
    expect(validateCompensationMinimum(9_000, { minimumMonthlySalary: 10_000 })).toContain("minimum monthly salary");
    expect(validateCompensationMinimum(10_000, { minimumMonthlySalary: 10_000 })).toBeNull();
    expect(validateCompensationMinimum(9_000, { taxRate: 0.1 })).toBeNull();
  });

  it("covers payroll formula boundaries and rounding modes", () => {
    expect(roundPayrollAmount(new Prisma.Decimal("1.5"))).toEqual(new Prisma.Decimal(2));
    expect(roundPayrollAmount(new Prisma.Decimal("1.9"), "floor")).toEqual(new Prisma.Decimal(1));
    expect(roundPayrollAmount(new Prisma.Decimal("1.1"), "ceil")).toEqual(new Prisma.Decimal(2));
    expect(calculateOvertimePay(new Prisma.Decimal(120), 30, 1.4)).toEqual(new Prisma.Decimal(84));
    expect(capInsurableBase(new Prisma.Decimal(150), 100)).toEqual(new Prisma.Decimal(100));
    expect(calculateProgressiveTax(new Prisma.Decimal(150), { taxExemption: 50, taxBrackets: [{ upTo: 100, rate: 0.1 }, { rate: 0.2 }] })).toEqual(new Prisma.Decimal(10));
    expect(calculateProgressiveTax(new Prisma.Decimal(50), { taxExemption: 50, taxBrackets: [{ upTo: 100, rate: 0.1 }] })).toEqual(new Prisma.Decimal(0));
    expect(calculateProgressiveTax(new Prisma.Decimal(100), { taxExemption: 40, taxBrackets: [{ upTo: 80, rate: 0.1 }, { rate: 0.15 }], specialTaxRates: { FACULTY_JUDGE: 0.1 } }, "FACULTY_JUDGE")).toEqual(new Prisma.Decimal(6));
    expect(calculateProgressiveTax(new Prisma.Decimal(1_000_000_000), iranianPrivateSector1405Rules)).toEqual(new Prisma.Decimal(70_000_000));
    expect(calculateInsuranceCeiling(iranianPrivateSector1405Rules, 30)).toEqual(new Prisma.Decimal("1163788500"));
    expect(calculateIranianEidi(iranianPrivateSector1405Rules.minimumDailyWage, 365)).toEqual({ minimum: 332511000, maximum: 498766500 });
    expect(calculateIranianSeverance(iranianPrivateSector1405Rules.minimumMonthlySalary, 365)).toBe(166255500);
    expect(calculateOvertimePay(new Prisma.Decimal(120), 0, 1.4)).toEqual(new Prisma.Decimal(0));
    expect(capInsurableBase(new Prisma.Decimal(99), 100)).toEqual(new Prisma.Decimal(99));
    expect(applyPartTimeRatio(new Prisma.Decimal(1000), 0.5)).toEqual(new Prisma.Decimal(500));
    expect(applyPartTimeRatio(new Prisma.Decimal(1000))).toEqual(new Prisma.Decimal(1000));
  });

  it("locks the 1405 regression fixture to the draft legal rules", () => {
    expect(iranianPrivateSector1405Rules).toMatchObject(annual1405Fixture);
    expect(iranianPrivateSector1405Rules.taxBrackets).toEqual(annual1405Fixture.taxBrackets);
    expect(iranianPrivateSector1405Rules.specialTaxRates).toEqual(annual1405Fixture.specialTaxRates);
  });

  it("covers Iranian tax threshold edges using annualized monthly bases", () => {
    expect(calculateProgressiveTax(new Prisma.Decimal(400_000_000), iranianPrivateSector1405Rules)).toEqual(new Prisma.Decimal(0));
    expect(calculateProgressiveTax(new Prisma.Decimal(800_000_000), iranianPrivateSector1405Rules)).toEqual(new Prisma.Decimal(40_000_000));
    expect(calculateProgressiveTax(new Prisma.Decimal(1_000_000_000), iranianPrivateSector1405Rules)).toEqual(new Prisma.Decimal(70_000_000));
    expect(calculateProgressiveTax(new Prisma.Decimal(1_200_000_000), iranianPrivateSector1405Rules)).toEqual(new Prisma.Decimal(110_000_000));
    expect(calculateProgressiveTax(new Prisma.Decimal(1_400_000_000), iranianPrivateSector1405Rules)).toEqual(new Prisma.Decimal(160_000_000));
    expect(calculateProgressiveTax(new Prisma.Decimal(1_600_000_000), iranianPrivateSector1405Rules)).toEqual(new Prisma.Decimal(220_000_000));
  });

  it("covers insurance ceilings for every Gregorian month length", () => {
    expect(calculateInsuranceCeiling(iranianPrivateSector1405Rules, 28)).toEqual(new Prisma.Decimal("1086202600"));
    expect(calculateInsuranceCeiling(iranianPrivateSector1405Rules, 29)).toEqual(new Prisma.Decimal("1124995550"));
    expect(calculateInsuranceCeiling(iranianPrivateSector1405Rules, 30)).toEqual(new Prisma.Decimal("1163788500"));
    expect(calculateInsuranceCeiling(iranianPrivateSector1405Rules, 31)).toEqual(new Prisma.Decimal("1202581450"));
    expect(calculateInsuranceCeiling(iranianPrivateSector1405Rules, 0)).toEqual(new Prisma.Decimal(0));
  });

  it("covers leap-year and partial-year benefit proration", () => {
    expect(calculateIranianEidi(iranianPrivateSector1405Rules.minimumDailyWage, 366)).toEqual({ minimum: 333421989.0410959, maximum: 500132983.5616439 });
    expect(calculateIranianEidi(iranianPrivateSector1405Rules.minimumDailyWage, 182.5)).toEqual({ minimum: 166255500, maximum: 249383250 });
    expect(calculateIranianSeverance(iranianPrivateSector1405Rules.minimumMonthlySalary, 182.5)).toBe(83127750);
    expect(calculateIranianSeverance(iranianPrivateSector1405Rules.minimumMonthlySalary, 0)).toBe(0);
  });

  it("applies part-time minimums proportionally and rejects only below-ratio pay", () => {
    const halfTimeMinimum = iranianPrivateSector1405Rules.minimumMonthlySalary * 0.5;
    expect(applyPartTimeRatio(new Prisma.Decimal(iranianPrivateSector1405Rules.minimumMonthlySalary), 0.5).toNumber()).toBe(halfTimeMinimum);
    expect(validateCompensationMinimum(halfTimeMinimum, { minimumMonthlySalary: halfTimeMinimum })).toBeNull();
    expect(validateCompensationMinimum(halfTimeMinimum - 1, { minimumMonthlySalary: halfTimeMinimum })).toContain("minimum monthly salary");
  });

  it("calculates attendance deductions only when the company policy enables them", () => {
    const daily = new Prisma.Decimal(1000);
    const hourly = new Prisma.Decimal(125);
    const attendance = { absenceDays: 1, leaveDays: 2, deficitMinutes: 60 };
    expect(calculateAttendanceDeductions(daily, hourly, attendance)).toEqual({ absence: new Prisma.Decimal(0), shortfall: new Prisma.Decimal(0), total: new Prisma.Decimal(0) });
    expect(calculateAttendanceDeductions(daily, hourly, attendance, { absenceDeductionMode: "DAILY_BASE", attendanceShortfallDeductionMode: "HOURLY_BASE" })).toEqual({ absence: new Prisma.Decimal(1000), shortfall: new Prisma.Decimal(125), total: new Prisma.Decimal(1125) });
  });

  it("masks sensitive bank account suffixes at the response boundary", () => {
    expect(maskBankAccountLast4("1234")).toBe("••••1234");
    expect(maskBankAccountLast4(null)).toBeNull();
  });

  it("rejects legal overrides and simulates policy-only choices", () => {
    expect(validatePayrollPolicy({ taxRate: 0.1 })).toContain("cannot define legal rule");
    expect(validatePayrollPolicy({ rounding: "floor", graceMinutes: 15, overtimeRequiresApproval: true, paymentDay: 25 })).toBeNull();
    expect(simulatePayrollPolicy({ rounding: "floor", overtimeRequiresApproval: true, paymentDay: 25 }, { requestedOvertimeMinutes: 120, approvedOvertimeMinutes: 60, amount: 100.9 })).toEqual({ overtimeMinutes: 60, roundedAmount: 100, paymentDay: 25, overtimeRequiresApproval: true });
    expect(validatePayrollPolicy({ absenceDeductionMode: "DAILY_BASE", attendanceShortfallDeductionMode: "HOURLY_BASE" })).toBeNull();
    expect(validatePayrollPolicy({ absenceDeductionMode: "LEGAL_MAGIC" })).toContain("absenceDeductionMode");
  });

  it("requires a legal source before a rule set can be approved", () => {
    expect(validateRuleSetApproval(null, { workingDays: 30 })).toContain("source reference");
    expect(validateRuleSetApproval("Official circular 1", { workingDays: 30 })).toContain("Missing required");
  });
});
