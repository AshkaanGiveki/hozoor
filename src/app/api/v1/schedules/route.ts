import { RoleCode } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/server/auth";
import { db } from "@/server/db";
import { audit } from "@/server/audit";

const shift = z.object({ name: z.string().trim().min(1).max(100), startMinutes: z.number().int().min(0).max(1439), endMinutes: z.number().int().min(1).max(1440), overnight: z.boolean().default(false) });
const schema = z.object({ name: z.string().trim().min(2).max(120), description: z.string().trim().max(500).optional(), shifts: z.array(shift).min(1).max(20) });
const canManage = (role: RoleCode) => role === RoleCode.ADMIN || role === RoleCode.HR_ADMIN;

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Login required." } }, { status: 401 });
  return NextResponse.json({ data: await db.workScheduleTemplate.findMany({ where: { companyId: user.companyId }, include: { shifts: true, assignments: { include: { employee: true } } }, orderBy: { name: "asc" } }) });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || !canManage(user.role)) return NextResponse.json({ error: { code: "FORBIDDEN", message: "Administrator access required." } }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Invalid schedule.", fields: parsed.error.flatten().fieldErrors } }, { status: 400 });
  const schedule = await db.workScheduleTemplate.create({ data: { companyId: user.companyId, name: parsed.data.name, description: parsed.data.description, shifts: { create: parsed.data.shifts } }, include: { shifts: true } });
  await audit({ companyId: user.companyId, actorId: user.id, action: "schedule.create", entityType: "WorkScheduleTemplate", entityId: schedule.id, after: parsed.data });
  return NextResponse.json({ data: schedule }, { status: 201 });
}
