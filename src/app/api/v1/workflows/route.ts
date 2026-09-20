import { RequestKind, RoleCode } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/server/auth";
import { db } from "@/server/db";
import { audit } from "@/server/audit";

const schema = z.object({
  name: z.string().trim().min(3).max(120),
  kind: z.nativeEnum(RequestKind),
  steps: z.array(z.object({ order: z.number().int().positive(), role: z.nativeEnum(RoleCode), required: z.boolean().default(true) })).min(1).max(8),
}).refine((value) => new Set(value.steps.map((step) => step.order)).size === value.steps.length, { message: "Step order must be unique." });

export async function GET() {
  const user = await getCurrentUser();
  if (!user || (user.role !== RoleCode.ADMIN && user.role !== RoleCode.HR_ADMIN)) return NextResponse.json({ error: { code: "FORBIDDEN", message: "Administrator access required." } }, { status: 403 });
  return NextResponse.json({ data: await db.approvalWorkflow.findMany({ where: { companyId: user.companyId }, include: { steps: { orderBy: { order: "asc" } } }, orderBy: [{ kind: "asc" }, { name: "asc" }] }) });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || (user.role !== RoleCode.ADMIN && user.role !== RoleCode.HR_ADMIN)) return NextResponse.json({ error: { code: "FORBIDDEN", message: "Administrator access required." } }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Invalid workflow definition.", fields: parsed.error.flatten().fieldErrors } }, { status: 400 });
  const input = parsed.data;
  const workflow = await db.approvalWorkflow.create({ data: { companyId: user.companyId, name: input.name, kind: input.kind, active: true, steps: { create: input.steps } }, include: { steps: { orderBy: { order: "asc" } } } });
  await audit({ companyId: user.companyId, actorId: user.id, action: "approval_workflow.create", entityType: "ApprovalWorkflow", entityId: workflow.id, after: input });
  return NextResponse.json({ data: workflow }, { status: 201 });
}
