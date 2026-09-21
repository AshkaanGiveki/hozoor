import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { EventType, PayrollPaymentStatus, PayrollRuleStatus, PolicyStatus } from "@prisma/client";
import { db } from "@/server/db";
import { recalculateAttendanceDay } from "@/server/attendance-service";
import { calculatePayrollPeriod } from "@/server/payroll-engine";
import { checksumRules } from "@/server/payroll";
import { createPayrollIntegrationPayload } from "@/server/payroll-integration";
import { reconcilePayrollTotals } from "@/server/payroll-reporting";

const enabled = Boolean(process.env.PAYROLL_E2E_DATABASE_URL);
const testDate = new Date("2025-01-15T00:00:00.000Z");
const testFingerprintPrefix = "payroll-e2e-";
let companyId = "";
let employeeId = "";
let adminId = "";
let periodId = "";
let compensationIds: string[] = [];
let ruleSetId = "";
let policyId = "";
let deviceId = "";
let reportExportId = "";

describe.skipIf(!enabled)("attendance-to-payroll-to-payment pipeline", () => {
  beforeAll(async () => {
    const company = await db.companyProfile.findFirstOrThrow();
    const admin = await db.user.findFirstOrThrow({ where: { companyId: company.id, role: "ADMIN" } });
    const employee = await db.employee.findFirstOrThrow({ where: { companyId: company.id, employeeCode: "1001" } });
    const activeEmployees = await db.employee.findMany({ where: { companyId: company.id, active: true }, orderBy: { employeeCode: "asc" } });
    const device = await db.attendanceDevice.findFirstOrThrow({ where: { companyId: company.id } });
    companyId = company.id;
    adminId = admin.id;
    employeeId = employee.id;
    deviceId = device.id;

    await db.payrollPeriod.deleteMany({ where: { companyId, year: 1405, month: 1, revision: 99 } });
    await db.compensationProfile.deleteMany({ where: { employeeId, effectiveFrom: testDate } });
    await db.rawAttendanceEvent.deleteMany({ where: { fingerprint: { startsWith: testFingerprintPrefix } } });

    const rules = { workingDays: 30, workingHoursPerDay: 8, overtimeMultiplier: 1.4, employeeInsuranceRate: 0.07, employerInsuranceRate: 0.23, taxRate: 0.1, taxExemption: 0, insuranceCeiling: 10000000, minimumMonthlySalary: 1000000 };
    const ruleSet = await db.payrollRuleSet.create({ data: { companyId, name: "Payroll pipeline test rules", calendarYear: 1405, version: 99, status: PayrollRuleStatus.APPROVED, effectiveFrom: testDate, sourceReference: "isolated-test-fixture", rules, checksum: checksumRules(rules), createdById: adminId, approvedById: adminId } });
    ruleSetId = ruleSet.id;
    const policy = await db.payrollPolicy.create({ data: { companyId, name: "Payroll pipeline test policy", version: 99, status: PolicyStatus.ACTIVE, effectiveFrom: testDate, settings: { rounding: "nearest-rial", overtimeRequiresApproval: true }, createdById: adminId } });
    policyId = policy.id;
    const compensations = await Promise.all(activeEmployees.map((activeEmployee) => db.compensationProfile.create({ data: { companyId, employeeId: activeEmployee.id, status: "ACTIVE", effectiveFrom: testDate, contractStartDate: testDate, contractType: "STANDARD", baseSalary: 3000000, components: [], createdById: adminId } })));
    compensationIds = compensations.map((compensation) => compensation.id);
    const period = await db.payrollPeriod.create({ data: { companyId, ruleSetId, payrollPolicyId: policyId, year: 1405, month: 1, revision: 99, startDate: testDate, endDate: new Date("2025-01-31T00:00:00.000Z"), createdById: adminId } });
    periodId = period.id;

    await db.rawAttendanceEvent.createMany({ data: [
      { companyId, deviceId, employeeId, externalId: "payroll-e2e-in", timestamp: new Date("2025-01-15T09:00:00.000Z"), type: EventType.IN, fingerprint: `${testFingerprintPrefix}in` },
      { companyId, deviceId, employeeId, externalId: "payroll-e2e-out", timestamp: new Date("2025-01-15T17:00:00.000Z"), type: EventType.OUT, fingerprint: `${testFingerprintPrefix}out` },
    ] });
    await recalculateAttendanceDay(companyId, employeeId, testDate);
  });

  afterAll(async () => {
    if (reportExportId) await db.reportExport.deleteMany({ where: { id: reportExportId } });
    if (periodId) await db.payrollPeriod.deleteMany({ where: { id: periodId } });
    if (compensationIds.length) await db.compensationProfile.deleteMany({ where: { id: { in: compensationIds } } });
    if (ruleSetId) await db.payrollRuleSet.deleteMany({ where: { id: ruleSetId } });
    if (policyId) await db.payrollPolicy.deleteMany({ where: { id: policyId } });
    await db.rawAttendanceEvent.deleteMany({ where: { fingerprint: { startsWith: testFingerprintPrefix } } });
    await db.$disconnect();
  });

  it("keeps attendance, payslip, export, payment, and reconciliation on one amount source", async () => {
    const attendance = await db.attendanceDay.findUniqueOrThrow({ where: { employeeId_date: { employeeId, date: testDate } } });
    expect(attendance.validWorkMinutes).toBeGreaterThan(0);

    const activeEmployeeCount = await db.employee.count({ where: { companyId, active: true } });
    expect((await calculatePayrollPeriod(periodId, companyId)).count).toBe(activeEmployeeCount);
    const runs = await db.payrollRun.findMany({ where: { periodId }, include: { payment: true, employee: true } });
    const run = runs.find((candidate) => candidate.employeeId === employeeId)!;
    expect(run.payment?.amount.eq(run.netPayable)).toBe(true);

    await db.payrollPeriod.update({ where: { id: periodId }, data: { status: "PAID", approvedById: adminId, paidAt: new Date() } });
    const payments = await Promise.all(runs.map((candidate) => db.payrollPayment.update({ where: { id: candidate.payment!.id }, data: { status: PayrollPaymentStatus.PAID, amount: candidate.netPayable, paidAt: new Date(), paymentReference: "isolated-e2e" } })));
    const rows = runs.map((candidate) => { const payment = payments.find((item) => item.payrollRunId === candidate.id)!; return { employeeId: candidate.employeeId, employeeCode: candidate.employee.employeeCode, employeeName: `${candidate.employee.firstName} ${candidate.employee.lastName}`, departmentId: null, departmentName: null, gross: candidate.grossAmount, deductions: candidate.totalDeductions, net: candidate.netPayable, employerInsurance: candidate.employerInsurance, paid: payment.amount, paymentStatus: payment.status }; });
    const exportedNet = rows.reduce((total, row) => total.plus(row.net), rows[0].net.minus(rows[0].net));
    const reconciliation = reconcilePayrollTotals(rows, exportedNet);
    expect(reconciliation).toMatchObject({ calculatedNet: exportedNet.toString(), exportedNet: exportedNet.toString(), paidNet: exportedNet.toString(), unmatched: 0, exportMatchesCalculated: true });
    const reportExport = await db.reportExport.create({ data: { companyId, createdById: adminId, reportType: "PAYROLL_REGISTER", filename: "payroll-e2e.csv", storageName: "payroll-e2e.csv", filters: { periodId }, sourceSnapshot: { periodId, net: exportedNet.toString() }, checksum: checksumRules({ periodId, net: exportedNet.toString() }), idempotencyKey: "payroll-e2e-export" } });
    reportExportId = reportExport.id;
    expect(reportExport.sourceSnapshot).toEqual({ periodId, net: exportedNet.toString() });

    const payload = createPayrollIntegrationPayload({ companyId, period: { id: periodId, year: 1405, month: 1, revision: 99, status: "PAID" }, rows: runs.map((candidate) => { const payment = payments.find((item) => item.payrollRunId === candidate.id)!; return { employeeId: candidate.employeeId, employeeCode: candidate.employee.employeeCode, grossAmount: candidate.grossAmount, totalDeductions: candidate.totalDeductions, netPayable: candidate.netPayable, employeeInsurance: candidate.employeeInsurance, employerInsurance: candidate.employerInsurance, payment: { amount: payment.amount, status: payment.status } }; }) });
    expect(payload.totals.netPayable).toBe(exportedNet.toString());
    expect(payload.rows.every((row) => row.paymentAmount === row.netPayable)).toBe(true);
  });
});
