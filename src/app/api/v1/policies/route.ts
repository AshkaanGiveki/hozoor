import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/server/auth";
import { db } from "@/server/db";
import { audit } from "@/server/audit";

const schema = z.object({ name: z.string().min(2), effectiveFrom: z.coerce.date(), minimumDailyMinutes: z.coerce.number().int().min(0).max(1440), startMinutes: z.coerce.number().int().min(0).max(1439), endMinutes: z.coerce.number().int().min(1).max(1440), flexibleEntryUntil: z.coerce.number().int().min(0).max(1440), requiredMinutes: z.coerce.number().int().min(0).max(1440), overtimeMode: z.enum(["DISABLED", "AUTOMATIC", "APPROVAL_REQUIRED", "SCHEDULED_ONLY"]), groupId: z.string().optional() });

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || !["ADMIN", "HR_ADMIN"].includes(user.role)) return NextResponse.json({ error: { code: "FORBIDDEN", message: "دسترسی کافی ندارید." } }, { status: 403 });
  const input = schema.safeParse(await request.json().catch(() => ({})));
  if (!input.success) return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "اطلاعات قانون معتبر نیست." } }, { status: 400 });
  if (input.data.groupId && !(await db.attendanceGroup.findFirst({ where: { id: input.data.groupId, companyId: user.companyId, active: true } }))) return NextResponse.json({ error: { code: "NOT_FOUND", message: "گروه معتبر نیست." } }, { status: 404 });
  const nextVersion = (await db.attendancePolicy.aggregate({ where: { companyId: user.companyId, name: input.data.name }, _max: { version: true } }))._max.version ?? 0;
  const policy = await db.$transaction(async (tx) => {
    const created = await tx.attendancePolicy.create({ data: { companyId: user.companyId, name: input.data.name, version: nextVersion + 1, effectiveFrom: input.data.effectiveFrom, status: "ACTIVE", minimumDailyMinutes: input.data.minimumDailyMinutes, overtimeMode: input.data.overtimeMode, createdById: user.id, dailyRules: { create: Array.from({ length: 7 }, (_, weekday) => ({ weekday, isWorkingDay: weekday !== 5, startMinutes: input.data.startMinutes, endMinutes: input.data.endMinutes, flexibleEntryUntil: input.data.flexibleEntryUntil, requiredMinutes: input.data.requiredMinutes, minimumMinutes: input.data.minimumDailyMinutes, breakMinutes: 30 })) } } });
    if (input.data.groupId) await tx.policyAssignment.create({ data: { policyId: created.id, groupId: input.data.groupId, startDate: input.data.effectiveFrom } });
    return created;
  });
  await audit({ companyId: user.companyId, actorId: user.id, action: "policy.activate", entityType: "AttendancePolicy", entityId: policy.id, after: { name: policy.name, version: policy.version, groupId: input.data.groupId } });
  return NextResponse.json({ data: policy }, { status: 201 });
}
