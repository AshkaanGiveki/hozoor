import { RoleCode } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { audit } from "@/server/audit";
import { getCurrentUser } from "@/server/auth";
import { db } from "@/server/db";
import { canManagePayroll } from "@/server/payroll";

const schema = z.object({ evidenceType: z.string().trim().min(2).max(80), retentionDays: z.number().int().min(1).max(36500), archiveAfterDays: z.number().int().min(0).max(36500).nullable().optional(), legalBasis: z.string().trim().min(3).max(500), active: z.boolean().default(true) }).refine((value) => value.archiveAfterDays === null || value.archiveAfterDays === undefined || value.archiveAfterDays < value.retentionDays, { message: "archiveAfterDays must be less than retentionDays." });

function canView(user: { role: RoleCode }) { return canManagePayroll(user.role) || user.role === RoleCode.AUDITOR; }

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !canView(user)) return NextResponse.json({ error: { code: "FORBIDDEN", message: "Payroll retention access required." } }, { status: 403 });
  return NextResponse.json({ data: await db.evidenceRetentionPolicy.findMany({ where: { companyId: user.companyId }, orderBy: { evidenceType: "asc" } }) });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || !canManagePayroll(user.role)) return NextResponse.json({ error: { code: "FORBIDDEN", message: "Payroll retention administration access required." } }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message || "Invalid retention policy." } }, { status: 400 });
  const input = parsed.data;
  const policy = await db.evidenceRetentionPolicy.upsert({ where: { companyId_evidenceType: { companyId: user.companyId, evidenceType: input.evidenceType } }, update: { retentionDays: input.retentionDays, archiveAfterDays: input.archiveAfterDays ?? null, legalBasis: input.legalBasis, active: input.active, createdById: user.id }, create: { companyId: user.companyId, evidenceType: input.evidenceType, retentionDays: input.retentionDays, archiveAfterDays: input.archiveAfterDays ?? null, legalBasis: input.legalBasis, active: input.active, createdById: user.id } });
  await audit({ companyId: user.companyId, actorId: user.id, action: "payroll.retention.upsert", entityType: "EvidenceRetentionPolicy", entityId: policy.id, after: input });
  return NextResponse.json({ data: policy }, { status: 201 });
}
