import { RoleCode } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/server/auth";
import { db } from "@/server/db";
import { audit } from "@/server/audit";

const schema = z.object({ date: z.coerce.date().optional(), title: z.string().trim().min(2).max(200).optional() });
const canManage = (role: RoleCode) => role === RoleCode.ADMIN || role === RoleCode.HR_ADMIN;

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !canManage(user.role)) return NextResponse.json({ error: { code: "FORBIDDEN", message: "Administrator access required." } }, { status: 403 });
  const { id } = await context.params;
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Invalid holiday." } }, { status: 400 });
  const existing = await db.holiday.findFirst({ where: { id, companyId: user.companyId } });
  if (!existing) return NextResponse.json({ error: { code: "NOT_FOUND", message: "Holiday not found." } }, { status: 404 });
  const holiday = await db.holiday.update({ where: { id }, data: { title: parsed.data.title, date: parsed.data.date ? new Date(Date.UTC(parsed.data.date.getUTCFullYear(), parsed.data.date.getUTCMonth(), parsed.data.date.getUTCDate())) : undefined } });
  await audit({ companyId: user.companyId, actorId: user.id, action: "holiday.update", entityType: "Holiday", entityId: id, before: existing, after: holiday });
  return NextResponse.json({ data: holiday });
}

export async function DELETE(_: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !canManage(user.role)) return NextResponse.json({ error: { code: "FORBIDDEN", message: "Administrator access required." } }, { status: 403 });
  const { id } = await context.params;
  const existing = await db.holiday.findFirst({ where: { id, companyId: user.companyId } });
  if (!existing) return NextResponse.json({ error: { code: "NOT_FOUND", message: "Holiday not found." } }, { status: 404 });
  await db.holiday.delete({ where: { id } });
  await audit({ companyId: user.companyId, actorId: user.id, action: "holiday.delete", entityType: "Holiday", entityId: id, before: existing });
  return NextResponse.json({ data: { ok: true } });
}
