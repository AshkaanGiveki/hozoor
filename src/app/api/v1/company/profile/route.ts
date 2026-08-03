import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/server/auth";
import { db } from "@/server/db";
import { audit } from "@/server/audit";

const schema = z.object({
  name: z.string().trim().min(1).max(160),
  timezone: z.enum(["Asia/Tehran", "UTC"]),
  weekStartsOn: z.coerce.number().int().min(0).max(6),
});

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user || !["ADMIN", "HR_ADMIN"].includes(user.role)) return NextResponse.json({ error: { code: "FORBIDDEN", message: "فقط مدیر سامانه می‌تواند تنظیمات شرکت را تغییر دهد." } }, { status: 403 });

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "اطلاعات شرکت معتبر نیست." } }, { status: 400 });
  const before = await db.companyProfile.findFirst({ where: { id: user.companyId }, select: { name: true, timezone: true, weekStartsOn: true } });
  if (!before) return NextResponse.json({ error: { code: "NOT_FOUND", message: "پروفایل شرکت پیدا نشد." } }, { status: 404 });

  const company = await db.companyProfile.update({ where: { id: user.companyId }, data: parsed.data, select: { name: true, timezone: true, weekStartsOn: true } });
  await audit({ companyId: user.companyId, actorId: user.id, action: "company.profile.update", entityType: "CompanyProfile", entityId: user.companyId, before, after: company });
  return NextResponse.json({ data: company });
}
