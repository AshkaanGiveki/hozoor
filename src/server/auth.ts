import { cookies } from "next/headers";
import { db } from "./db";
import { hashToken, randomToken } from "./security";
import { RoleCode, UserStatus } from "@prisma/client";

export const SESSION_COOKIE = "hozoor_session";
const SESSION_DAYS = 14;

export async function createSession(userId: string) {
  const token = randomToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400000);
  await db.session.create({ data: { userId, tokenHash: hashToken(token), expiresAt } });
  const secureCookie = process.env.NODE_ENV === "production" && process.env.APP_URL?.startsWith("https://");
  (await cookies()).set(SESSION_COOKIE, token, { httpOnly: true, sameSite: "lax", secure: secureCookie, expires: expiresAt, path: "/" });
}
export async function destroySession() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  (await cookies()).delete(SESSION_COOKIE);
}
export async function destroyAllSessions(userId: string) { await db.session.deleteMany({ where: { userId } }); }
export async function getCurrentUser() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await db.session.findUnique({ where: { tokenHash: hashToken(token) }, include: { user: { include: { employee: true, company: true } } } });
  if (!session || session.expiresAt < new Date() || session.user.status !== UserStatus.ACTIVE) return null;
  await db.session.update({ where: { id: session.id }, data: { lastUsedAt: new Date() } });
  return session.user;
}
export async function requireUser(roles?: RoleCode[]) {
  const user = await getCurrentUser();
  if (!user) throw new Error("UNAUTHENTICATED");
  if (roles && !roles.includes(user.role)) throw new Error("FORBIDDEN");
  return user;
}
export function isAdmin(role: RoleCode) { return role === RoleCode.ADMIN || role === RoleCode.HR_ADMIN; }
