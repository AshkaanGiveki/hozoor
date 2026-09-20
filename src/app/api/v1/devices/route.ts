import { RoleCode } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/server/auth";
import { db } from "@/server/db";
import { audit } from "@/server/audit";

const schema = z.object({ name: z.string().trim().min(2).max(120), type: z.string().trim().min(2).max(80), timezone: z.string().trim().min(1).max(80).default("Asia/Tehran") });
const canManage = (role: RoleCode) => role === RoleCode.ADMIN || role === RoleCode.HR_ADMIN;

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Login required." } }, { status: 401 });
  return NextResponse.json({ data: await db.attendanceDevice.findMany({ where: { companyId: user.companyId }, include: { mappings: { include: { employee: true } } }, orderBy: { name: "asc" } }) });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || !canManage(user.role)) return NextResponse.json({ error: { code: "FORBIDDEN", message: "Administrator access required." } }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Invalid device.", fields: parsed.error.flatten().fieldErrors } }, { status: 400 });
  const device = await db.attendanceDevice.create({ data: { companyId: user.companyId, ...parsed.data }, include: { mappings: true } });
  await audit({ companyId: user.companyId, actorId: user.id, action: "device.create", entityType: "AttendanceDevice", entityId: device.id, after: parsed.data });
  return NextResponse.json({ data: device }, { status: 201 });
}
