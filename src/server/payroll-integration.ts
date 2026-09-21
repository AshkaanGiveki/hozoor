import crypto from "node:crypto";
import { Prisma } from "@prisma/client";

export type PayrollIntegrationRow = {
  employeeId: string;
  employeeCode: string;
  payrollIdentifier: string | null;
  gross: string;
  deductions: string;
  netPayable: string;
  employeeInsurance: string;
  employerInsurance: string;
  paymentAmount: string | null;
  paymentStatus: string;
};

export type PayrollIntegrationPayload = {
  schemaVersion: 1;
  idempotencyKey: string;
  companyId: string;
  periodId: string;
  period: { year: number; month: number; revision: number; status: string };
  rows: PayrollIntegrationRow[];
  totals: { gross: string; deductions: string; netPayable: string; employerInsurance: string };
  checksum: string;
};

export type PayrollIntegrationAdapter = {
  name: string;
  submit(payload: PayrollIntegrationPayload): Promise<{ accepted: boolean; externalReference?: string; message?: string }>;
};

const sum = (values: Prisma.Decimal[]) => values.reduce((total, value) => total.plus(value), new Prisma.Decimal(0)).toString();

export function createPayrollIntegrationPayload(input: {
  companyId: string;
  period: { id: string; year: number; month: number; revision: number; status: string };
  rows: Array<{ employeeId: string; employeeCode: string; payrollIdentifier?: string | null; grossAmount: Prisma.Decimal; totalDeductions: Prisma.Decimal; netPayable: Prisma.Decimal; employeeInsurance: Prisma.Decimal; employerInsurance: Prisma.Decimal; payment?: { amount: Prisma.Decimal; status: string } | null }>;
}) {
  const rows: PayrollIntegrationRow[] = input.rows.map((row) => ({ employeeId: row.employeeId, employeeCode: row.employeeCode, payrollIdentifier: row.payrollIdentifier ?? null, gross: row.grossAmount.toString(), deductions: row.totalDeductions.toString(), netPayable: row.netPayable.toString(), employeeInsurance: row.employeeInsurance.toString(), employerInsurance: row.employerInsurance.toString(), paymentAmount: row.payment?.amount.toString() ?? null, paymentStatus: row.payment?.status ?? "PENDING" }));
  const idempotencyKey = `payroll:${input.companyId}:${input.period.id}`;
  const unsigned = { schemaVersion: 1 as const, idempotencyKey, companyId: input.companyId, periodId: input.period.id, period: { year: input.period.year, month: input.period.month, revision: input.period.revision, status: input.period.status }, rows, totals: { gross: sum(input.rows.map((row) => row.grossAmount)), deductions: sum(input.rows.map((row) => row.totalDeductions)), netPayable: sum(input.rows.map((row) => row.netPayable)), employerInsurance: sum(input.rows.map((row) => row.employerInsurance)) } };
  const checksum = crypto.createHash("sha256").update(JSON.stringify(unsigned)).digest("hex");
  return { ...unsigned, checksum } satisfies PayrollIntegrationPayload;
}
