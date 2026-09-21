import { CompensationStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { audit } from "@/server/audit";
import { db } from "@/server/db";
import { canManagePayroll, hasCompensationOverlap, isValidDateRange, maskBankAccountLast4, validateCompensationMinimum } from "@/server/payroll";
import { getCurrentUser } from "@/server/auth";

const component = z.object({ code: z.string().trim().min(1).max(80), label: z.string().trim().min(1).max(160), type: z.enum(["ALLOWANCE", "BONUS", "COMMISSION", "BENEFIT", "OTHER_EARNING", "LOAN_REPAYMENT", "ADVANCE_REPAYMENT", "OTHER_DEDUCTION"]).default("ALLOWANCE"), amount: z.number().int().nonnegative(), taxable: z.boolean().default(true), insurable: z.boolean().default(true) });
const schema = z.object({ employeeId: z.string().uuid(), effectiveFrom: z.coerce.date(), effectiveTo: z.coerce.date().nullable().optional(), contractStartDate: z.coerce.date().nullable().optional(), contractEndDate: z.coerce.date().nullable().optional(), departmentId: z.string().uuid().nullable().optional(), status: z.nativeEnum(CompensationStatus).default(CompensationStatus.DRAFT), contractType: z.string().trim().min(1).max(40).default("STANDARD"), jobTitle: z.string().trim().max(160).nullable().optional(), payrollIdentifier: z.string().trim().max(80).nullable().optional(), baseSalary: z.number().int().nonnegative(), dailyRate: z.number().int().nonnegative().nullable().optional(), hourlyRate: z.number().int().nonnegative().nullable().optional(), components: z.array(component).max(100).default([]), taxStatus: z.string().trim().min(1).max(40).default("STANDARD"), insuranceStatus: z.string().trim().min(1).max(40).default("INSURED"), bankAccountLast4: z.string().regex(/^\\d{4}$/).nullable().optional(), notes: z.string().max(2000).nullable().optional() });

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !canManagePayroll(user.role)) return NextResponse.json({ error: { code: "FORBIDDEN", message: "Payroll administration access required." } }, { status: 403 });
  const rows = await db.compensationProfile.findMany({ where: { companyId: user.companyId }, include: { employee: { select: { id: true, employeeCode: true, firstName: true, lastName: true } }, department: { select: { id: true, name: true } }, createdBy: { select: { firstName: true, lastName: true } } }, orderBy: [{ employee: { lastName: "asc" } }, { effectiveFrom: "desc" }] });
  await audit({ companyId: user.companyId, actorId: user.id, action: "payroll.compensation.list", entityType: "CompensationProfile", after: { count: rows.length } });
  return NextResponse.json({ data: rows.map((row) => ({ ...row, bankAccountLast4: maskBankAccountLast4(row.bankAccountLast4) })) });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || !canManagePayroll(user.role)) return NextResponse.json({ error: { code: "FORBIDDEN", message: "Payroll administration access required." } }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Compensation dates or values are invalid." } }, { status: 400 });
  const input = parsed.data;
  const contractStartDate = input.contractStartDate ?? input.effectiveFrom;
  const contractEndDate = input.contractEndDate ?? input.effectiveTo ?? null;
  if (!isValidDateRange(input.effectiveFrom, input.effectiveTo) || !isValidDateRange(contractStartDate, contractEndDate)) return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Compensation or contract dates are invalid." } }, { status: 400 });
  const employee = await db.employee.findFirst({ where: { id: input.employeeId, companyId: user.companyId }, select: { id: true } });
  if (!employee) return NextResponse.json({ error: { code: "NOT_FOUND", message: "Employee not found." } }, { status: 404 });
  if (input.departmentId && !(await db.department.findFirst({ where: { id: input.departmentId, companyId: user.companyId }, select: { id: true } }))) return NextResponse.json({ error: { code: "NOT_FOUND", message: "Department not found." } }, { status: 404 });
  const legalRuleSet = await db.payrollRuleSet.findFirst({ where: { companyId: user.companyId, status: "APPROVED", effectiveFrom: { lte: input.effectiveFrom } }, orderBy: { effectiveFrom: "desc" }, select: { rules: true } });
  const minimumError = validateCompensationMinimum(input.baseSalary, legalRuleSet?.rules);
  if (minimumError) return NextResponse.json({ error: { code: "COMPENSATION_BELOW_MINIMUM", message: minimumError } }, { status: 400 });
  if (await hasCompensationOverlap(input.employeeId, input.effectiveFrom, input.effectiveTo)) return NextResponse.json({ error: { code: "CONFLICT", message: "This compensation period overlaps an existing period." } }, { status: 409 });
  const created = await db.compensationProfile.create({ data: { companyId: user.companyId, employeeId: input.employeeId, createdById: user.id, status: input.status, effectiveFrom: input.effectiveFrom, effectiveTo: input.effectiveTo ?? null, contractStartDate, contractEndDate, departmentId: input.departmentId ?? null, contractType: input.contractType, jobTitle: input.jobTitle ?? null, payrollIdentifier: input.payrollIdentifier ?? null, baseSalary: input.baseSalary, dailyRate: input.dailyRate ?? null, hourlyRate: input.hourlyRate ?? null, components: input.components, taxStatus: input.taxStatus, insuranceStatus: input.insuranceStatus, bankAccountLast4: input.bankAccountLast4 ?? null, notes: input.notes ?? null } });
  await audit({ companyId: user.companyId, actorId: user.id, action: "payroll.compensation.create", entityType: "CompensationProfile", entityId: created.id, after: input });
  return NextResponse.json({ data: { ...created, bankAccountLast4: maskBankAccountLast4(created.bankAccountLast4) } }, { status: 201 });
}
