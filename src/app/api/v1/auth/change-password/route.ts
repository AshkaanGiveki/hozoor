import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, destroyAllSessions, createSession } from "@/server/auth";
import { db } from "@/server/db";
import { hashPassword, passwordIsStrong } from "@/server/security";
const schema = z.object({ currentPassword: z.string().optional(), newPassword: z.string().min(10) });
export async function POST(request: Request) { try { const user = await requireUser(); const body = schema.parse(await request.json()); if (!passwordIsStrong(body.newPassword)) return NextResponse.json({ error: { code: "WEAK_PASSWORD", message: "رمز عبور باید حداقل ۱۰ نویسه و شامل حروف بزرگ، کوچک و عدد باشد." } }, { status: 400 }); const passwordHash = await hashPassword(body.newPassword); await db.$transaction([db.passwordHistory.create({ data: { userId: user.id, passwordHash: user.passwordHash } }), db.user.update({ where: { id: user.id }, data: { passwordHash, mustChangePassword: false } })]); await destroyAllSessions(user.id); await createSession(user.id); return NextResponse.json({ data: { ok: true } }); } catch (error) { const code = error instanceof Error && error.message === "UNAUTHENTICATED" ? 401 : 400; return NextResponse.json({ error: { code: "REQUEST_FAILED", message: "تغییر رمز عبور انجام نشد." } }, { status: code }); } }
