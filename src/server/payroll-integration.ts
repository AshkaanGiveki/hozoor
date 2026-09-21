import crypto from "node:crypto";
import { Prisma } from "@prisma/client";

export type IntegrationSubmissionOutcome = { status: "SUCCEEDED" | "RETRYING" | "FAILED"; nextAttemptAt: Date | null };

export function resolveIntegrationSubmissionOutcome(accepted: boolean, attemptCount: number, maxAttempts: number, now = new Date()): IntegrationSubmissionOutcome {
  if (accepted) return { status: "SUCCEEDED", nextAttemptAt: null };
  if (attemptCount >= maxAttempts) return { status: "FAILED", nextAttemptAt: null };
  const delayMinutes = Math.min(60, 2 ** Math.max(0, attemptCount - 1));
  return { status: "RETRYING", nextAttemptAt: new Date(now.getTime() + delayMinutes * 60 * 1000) };
}

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
  submit(payload: PayrollIntegrationPayload): Promise<{ accepted: boolean; externalReference?: string; message?: string; response?: unknown }>;
};

type PayrollWebhookOptions = { endpoint?: string; secret?: string };

export function createPayrollWebhookAdapter(options: PayrollWebhookOptions = {}): PayrollIntegrationAdapter {
  const endpoint = options.endpoint ?? process.env.PAYROLL_WEBHOOK_URL;
  const secret = options.secret ?? process.env.PAYROLL_WEBHOOK_SECRET;
  return {
    name: "webhook",
    async submit(payload) {
      if (!endpoint) return { accepted: false, message: "PAYROLL_WEBHOOK_URL is not configured" };
      try {
        const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json", "X-Idempotency-Key": payload.idempotencyKey, ...(secret ? { Authorization: `Bearer ${secret}` } : {}) }, body: JSON.stringify({ event: "payroll.submission", data: payload }) });
        const bodyText = await response.text().catch(() => "");
        let body: unknown = bodyText || null;
        try { body = bodyText ? JSON.parse(bodyText) : null; } catch { /* Keep non-JSON provider bodies for diagnostics. */ }
        const record = body && typeof body === "object" ? body as { accepted?: unknown; externalReference?: unknown; message?: unknown } : null;
        const accepted = response.ok && record?.accepted === true;
        return { accepted, externalReference: typeof record?.externalReference === "string" ? record.externalReference : undefined, message: accepted ? undefined : typeof record?.message === "string" ? record.message : `Provider returned ${response.status} without explicit acceptance`, response: body };
      } catch (error) {
        return { accepted: false, message: error instanceof Error ? error.message : "Payroll webhook request failed" };
      }
    },
  };
}

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
