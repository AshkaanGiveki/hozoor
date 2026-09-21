import { PayrollPaymentStatus, Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { audit } from "@/server/audit";
import { getCurrentUser } from "@/server/auth";
import { db } from "@/server/db";
import { canConfirmPayrollPayment, canManagePayroll, productionPayrollGate } from "@/server/payroll";

const schema = z.object({ status: z.enum([PayrollPaymentStatus.SUBMITTED, PayrollPaymentStatus.PAID, PayrollPaymentStatus.FAILED, PayrollPaymentStatus.REVERSED]), amount: z.string().regex(/^\\d+$/).optional(), paymentReference: z.string().trim().max(200).nullable().optional(), failureReason: z.string().trim().max(1000).nullable().optional() });

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !canManagePayroll(user.role)) return NextResponse.json({ error: { code: "FORBIDDEN", message: "Payroll administration access required." } }, { status: 403 });
  const productionGateError = productionPayrollGate();
  if (productionGateError) return NextResponse.json({ error: { code: "PAYROLL_PRODUCTION_GATE", message: productionGateError } }, { status: 503 });
  const { id } = await context.params;
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Invalid payment update." } }, { status: 400 });
  const existing = await db.payrollPayment.findFirst({ where: { id, companyId: user.companyId }, include: { payrollRun: { select: { netPayable: true, period: { select: { status: true, createdById: true, approvedById: true } } } } } });
  if (!existing) return NextResponse.json({ error: { code: "NOT_FOUND", message: "Payment record not found." } }, { status: 404 });
  if (existing.status === PayrollPaymentStatus.PAID && parsed.data.status !== PayrollPaymentStatus.REVERSED) return NextResponse.json({ error: { code: "CONFLICT", message: "A paid payment can only be reversed." } }, { status: 409 });
  const amount = parsed.data.amount ? new Prisma.Decimal(parsed.data.amount) : existing.amount;
  if (parsed.data.status === PayrollPaymentStatus.PAID) {
    if (!["APPROVED", "PAID", "LOCKED"].includes(existing.payrollRun.period.status)) return NextResponse.json({ error: { code: "CONFLICT", message: "Payroll must be approved before payment confirmation." } }, { status: 409 });
    if (!canConfirmPayrollPayment(user.id, existing.payrollRun.period.createdById, existing.payrollRun.period.approvedById)) return NextResponse.json({ error: { code: "DUTY_SEPARATION_REQUIRED", message: "Payment confirmation must be performed by a third payroll administrator who did not create or approve this payroll." } }, { status: 409 });
  }
  if (parsed.data.status === PayrollPaymentStatus.PAID && !amount.eq(existing.amount)) return NextResponse.json({ error: { code: "AMOUNT_MISMATCH", message: "The paid amount must exactly match the calculated net payable." } }, { status: 409 });
  const payment = await db.payrollPayment.update({ where: { id }, data: { status: parsed.data.status, amount, paymentReference: parsed.data.paymentReference ?? existing.paymentReference, failureReason: parsed.data.failureReason ?? null, paidAt: parsed.data.status === PayrollPaymentStatus.PAID ? new Date() : null, confirmedById: parsed.data.status === PayrollPaymentStatus.PAID ? user.id : existing.confirmedById, confirmedAt: parsed.data.status === PayrollPaymentStatus.PAID ? new Date() : existing.confirmedAt } });
  await audit({ companyId: user.companyId, actorId: user.id, action: parsed.data.status === PayrollPaymentStatus.PAID ? "payroll.payment.confirm" : "payroll.payment.update", entityType: "PayrollPayment", entityId: id, before: { status: existing.status, amount: existing.amount.toString() }, after: { status: payment.status, amount: payment.amount.toString(), paymentReference: payment.paymentReference, confirmedById: payment.confirmedById } });
  return NextResponse.json({ data: payment });
}
