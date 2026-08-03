import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/server/auth";
import { db } from "@/server/db";
import { audit } from "@/server/audit";

const schema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  email: z.string().trim().email().max(160).or(z.literal("")),
  phone: z.string().trim().max(30),
});

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "برای ادامه وارد شوید." } }, { status: 401 });

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "اطلاعات پروفایل معتبر نیست." } }, { status: 400 });

  const data = parsed.data;
  await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: user.id }, data: { firstName: data.firstName, lastName: data.lastName } });
    if (user.employee) {
      await tx.employee.update({ where: { id: user.employee.id }, data: { firstName: data.firstName, lastName: data.lastName, email: data.email || null, phone: data.phone || null } });
    }
  });

  await audit({ companyId: user.companyId, actorId: user.id, action: "profile.update", entityType: "User", entityId: user.id, after: { firstName: data.firstName, lastName: data.lastName, email: data.email ? "[updated]" : null, phone: data.phone ? "[updated]" : null } });
  return NextResponse.json({ data: { ok: true } });
}
