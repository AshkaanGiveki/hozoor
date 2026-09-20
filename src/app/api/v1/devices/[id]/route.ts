import { RoleCode } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/server/auth";
import { db } from "@/server/db";
import { audit } from "@/server/audit";

const schema = z.object({ name: z.string().trim().min(2).max(120).optional(), type: z.string().trim().min(2).max(80).optional(), timezone: z.string().trim().min(1).max(80).optional(), active: z.boolean().optional() });
const canManage = (role: RoleCode) => role === RoleCode.ADMIN || role === RoleCode.HR_ADMIN;

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !canManage(user.role)) return NextResponse.json({ error: { code: "FORBIDDEN", message: "Administrator access required." } }, { status: 403 });
  const { id } = await context.params;
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Invalid device." } }, { status: 400 });
  const existing = await db.attendanceDevice.findFirst({ where: { id, companyId: user.companyId } });
  if (!existing) return NextResponse.json({ error: { code: "NOT_FOUND", message: "Device not found." } }, { status: 404 });
  const device = await db.attendanceDevice.update({ where: { id }, data: parsed.data });
  await audit({ companyId: user.companyId, actorId: user.id, action: "device.update", entityType: "AttendanceDevice", entityId: id, before: existing, after: device });
  return NextResponse.json({ data: device });
}
