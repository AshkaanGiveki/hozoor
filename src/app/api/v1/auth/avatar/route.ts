import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth";
import { db } from "@/server/db";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "برای ادامه وارد شوید." } }, { status: 401 });
  const file = (await request.formData()).get("file");
  if (!(file instanceof File) || !file.type.startsWith("image/") || file.size > 2 * 1024 * 1024) return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "تصویر باید معتبر و حداکثر ۲ مگابایت باشد." } }, { status: 400 });
  const avatarUrl = `data:${file.type};base64,${Buffer.from(await file.arrayBuffer()).toString("base64")}`;
  await db.user.update({ where: { id: user.id }, data: { avatarUrl } });
  return NextResponse.json({ data: { avatarUrl } });
}
