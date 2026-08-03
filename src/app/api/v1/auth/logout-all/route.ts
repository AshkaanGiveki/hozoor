import { NextResponse } from "next/server";
import { getCurrentUser, destroyAllSessions, SESSION_COOKIE } from "@/server/auth";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "برای ادامه وارد شوید." } }, { status: 401 });
  await destroyAllSessions(user.id);
  const response = NextResponse.json({ data: { ok: true } });
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
