import { PolicyStatus, Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { audit } from "@/server/audit";
import { getCurrentUser } from "@/server/auth";
import { db } from "@/server/db";
import { canManagePayroll, isValidDateRange } from "@/server/payroll";

const schema = z.object({ name: z.string().trim().min(2).max(120), version: z.number().int().positive(), effectiveFrom: z.coerce.date(), effectiveTo: z.coerce.date().nullable().optional(), settings: z.record(z.unknown()) });

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !canManagePayroll(user.role)) return NextResponse.json({ error: { code: "FORBIDDEN", message: "Payroll administration access required." } }, { status: 403 });
  return NextResponse.json({ data: await db.payrollPolicy.findMany({ where: { companyId: user.companyId }, orderBy: [{ name: "asc" }, { version: "desc" }] }) });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || !canManagePayroll(user.role)) return NextResponse.json({ error: { code: "FORBIDDEN", message: "Payroll administration access required." } }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success || !isValidDateRange(parsed.data.effectiveFrom, parsed.data.effectiveTo)) return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Payroll policy dates or values are invalid." } }, { status: 400 });
  const input = parsed.data;
  try {
    const policy = await db.payrollPolicy.create({ data: { companyId: user.companyId, name: input.name, version: input.version, effectiveFrom: input.effectiveFrom, effectiveTo: input.effectiveTo ?? null, settings: input.settings as Prisma.InputJsonValue, createdById: user.id, status: PolicyStatus.DRAFT } });
    await audit({ companyId: user.companyId, actorId: user.id, action: "payroll.policy.create", entityType: "PayrollPolicy", entityId: policy.id, after: input });
    return NextResponse.json({ data: policy }, { status: 201 });
  } catch { return NextResponse.json({ error: { code: "CONFLICT", message: "A policy with this name and version already exists." } }, { status: 409 }); }
}
