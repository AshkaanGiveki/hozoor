import { RoleCode } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/server/auth";
import { db } from "@/server/db";
import { audit } from "@/server/audit";

const schema = z.object({ name: z.string().trim().min(2).max(120).optional(), active: z.boolean().optional(), paid: z.boolean().optional(), requiresAttachment: z.boolean().optional(), legalNote: z.string().trim().max(500).optional() });
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) { const user = await getCurrentUser(); if (!user || (user.role !== RoleCode.ADMIN && user.role !== RoleCode.HR_ADMIN)) return NextResponse.json({ error: { code: "FORBIDDEN", message: "Administrator access required." } }, { status: 403 }); const { id } = await context.params; const parsed = schema.safeParse(await request.json().catch(() => ({}))); if (!parsed.success) return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Invalid leave type." } }, { status: 400 }); const existing = await db.leaveType.findFirst({ where: { id, companyId: user.companyId } }); if (!existing) return NextResponse.json({ error: { code: "NOT_FOUND", message: "Leave type not found." } }, { status: 404 }); const type = await db.leaveType.update({ where: { id }, data: parsed.data }); await audit({ companyId: user.companyId, actorId: user.id, action: "leave_type.update", entityType: "LeaveType", entityId: id, before: existing, after: type }); return NextResponse.json({ data: type }); }
