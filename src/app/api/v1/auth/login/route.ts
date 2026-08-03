import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { z } from "zod";
import { db } from "@/server/db";
import { createSession } from "@/server/auth";
import { verifyPassword } from "@/server/security";

const schema = z.object({ username: z.string().trim().min(1).max(100), password: z.string().min(1).max(200) });
export async function POST(request: Request) {
  const input = schema.safeParse(await request.json().catch(() => ({}))); if (!input.success) return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "نام کاربری و رمز عبور را وارد کنید." } }, { status: 400 });
  const user = await db.user.findFirst({ where: { username: input.data.username }, include: { employee: true } });
  const locked = user?.lockedUntil && user.lockedUntil > new Date();
  const valid = user && !locked && user.status === "ACTIVE" && await verifyPassword(user.passwordHash, input.data.password).catch(() => false);
  await db.loginAttempt.create({ data: { username: input.data.username, success: Boolean(valid) } });
  if (!valid) { if (user) { const count = user.failedLoginCount + 1; await db.user.update({ where: { id: user.id }, data: { failedLoginCount: count, lockedUntil: count >= 5 ? new Date(Date.now()+15*60000) : undefined } }); } return NextResponse.json({ error: { code: "INVALID_CREDENTIALS", message: "نام کاربری یا رمز عبور صحیح نیست." } }, { status: 401 }); }
  await db.user.update({ where: { id: user.id }, data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() } }); await createSession(user.id);
  return NextResponse.json({ data: { mustChangePassword: user.mustChangePassword, role: user.role }, meta: {}, requestId: crypto.randomUUID() });
}
