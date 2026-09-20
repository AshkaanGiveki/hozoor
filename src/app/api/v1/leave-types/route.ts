import { LeaveUnit, RoleCode } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/server/auth";
import { db } from "@/server/db";
import { audit } from "@/server/audit";

const schema = z.object({ name: z.string().trim().min(2).max(120), unit: z.nativeEnum(LeaveUnit), paid: z.boolean().default(true), requiresAttachment: z.boolean().default(false), legalNote: z.string().trim().max(500).optional() });
const canManage = (role: RoleCode) => role === RoleCode.ADMIN || role === RoleCode.HR_ADMIN;

export async function GET() { const user = await getCurrentUser(); if (!user) return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Login required." } }, { status: 401 }); return NextResponse.json({ data: await db.leaveType.findMany({ where: { companyId: user.companyId }, orderBy: { name: "asc" } }) }); }
export async function POST(request: Request) { const user = await getCurrentUser(); if (!user || !canManage(user.role)) return NextResponse.json({ error: { code: "FORBIDDEN", message: "Administrator access required." } }, { status: 403 }); const parsed = schema.safeParse(await request.json().catch(() => ({}))); if (!parsed.success) return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Invalid leave type." } }, { status: 400 }); try { const type = await db.leaveType.create({ data: { companyId: user.companyId, ...parsed.data } }); await audit({ companyId: user.companyId, actorId: user.id, action: "leave_type.create", entityType: "LeaveType", entityId: type.id, after: parsed.data }); return NextResponse.json({ data: type }, { status: 201 }); } catch { return NextResponse.json({ error: { code: "CONFLICT", message: "Leave type already exists." } }, { status: 409 }); } }
