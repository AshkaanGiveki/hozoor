import { PayrollRuleStatus, Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { audit } from "@/server/audit";
import { db } from "@/server/db";
import { canManagePayroll, checksumRules, hasRuleOverlap, isValidDateRange } from "@/server/payroll";
import { getCurrentUser } from "@/server/auth";

const schema = z.object({ name: z.string().trim().min(2).max(120), calendarYear: z.number().int().min(1300).max(1600), version: z.number().int().positive(), effectiveFrom: z.coerce.date(), effectiveTo: z.coerce.date().nullable().optional(), sourceReference: z.string().trim().max(500).nullable().optional(), rules: z.record(z.unknown()) });

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !canManagePayroll(user.role)) return NextResponse.json({ error: { code: "FORBIDDEN", message: "Payroll administration access required." } }, { status: 403 });
  return NextResponse.json({ data: await db.payrollRuleSet.findMany({ where: { companyId: user.companyId }, orderBy: [{ calendarYear: "desc" }, { version: "desc" }] }) });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || !canManagePayroll(user.role)) return NextResponse.json({ error: { code: "FORBIDDEN", message: "Payroll administration access required." } }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success || !isValidDateRange(parsed.data.effectiveFrom, parsed.data.effectiveTo)) return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Payroll rule dates or values are invalid." } }, { status: 400 });
  const input = parsed.data;
  if (await hasRuleOverlap(user.companyId, input.calendarYear, input.effectiveFrom, input.effectiveTo)) return NextResponse.json({ error: { code: "CONFLICT", message: "This legal-rule period overlaps an existing rule set." } }, { status: 409 });
  try {
    const created = await db.payrollRuleSet.create({ data: { companyId: user.companyId, name: input.name, calendarYear: input.calendarYear, version: input.version, effectiveFrom: input.effectiveFrom, effectiveTo: input.effectiveTo ?? null, sourceReference: input.sourceReference ?? null, rules: input.rules as Prisma.InputJsonValue, checksum: checksumRules(input.rules), createdById: user.id, status: PayrollRuleStatus.DRAFT } });
    await audit({ companyId: user.companyId, actorId: user.id, action: "payroll.rules.create", entityType: "PayrollRuleSet", entityId: created.id, after: { ...input, checksum: created.checksum } });
    return NextResponse.json({ data: created }, { status: 201 });
  } catch { return NextResponse.json({ error: { code: "CONFLICT", message: "A rule set with this year and version already exists." } }, { status: 409 }); }
}
