import { RoleCode } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/server/auth";
import { db } from "@/server/db";
import { audit } from "@/server/audit";

const schema = z.object({ name: z.string().trim().min(2).max(120), description: z.string().trim().max(500).optional(), active: z.boolean().optional(), shifts: z.array(z.object({ name: z.string().trim().min(1).max(100), startMinutes: z.number().int().min(0).max(1439), endMinutes: z.number().int().min(1).max(1440), overnight: z.boolean().default(false) })).min(1).max(20) });

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || (user.role !== RoleCode.ADMIN && user.role !== RoleCode.HR_ADMIN)) return NextResponse.json({ error: { code: "FORBIDDEN", message: "Administrator access required." } }, { status: 403 });
  const { id } = await context.params;
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Invalid schedule.", fields: parsed.error.flatten().fieldErrors } }, { status: 400 });
  const existing = await db.workScheduleTemplate.findFirst({ where: { id, companyId: user.companyId } });
  if (!existing) return NextResponse.json({ error: { code: "NOT_FOUND", message: "Schedule not found." } }, { status: 404 });
  const updated = await db.$transaction(async (tx) => {
    await tx.shiftTemplate.deleteMany({ where: { scheduleId: id } });
    return tx.workScheduleTemplate.update({ where: { id }, data: { name: parsed.data.name, description: parsed.data.description, active: parsed.data.active ?? existing.active, shifts: { create: parsed.data.shifts } }, include: { shifts: true } });
  });
  await audit({ companyId: user.companyId, actorId: user.id, action: "schedule.update", entityType: "WorkScheduleTemplate", entityId: id, before: existing, after: parsed.data });
  return NextResponse.json({ data: updated });
}
