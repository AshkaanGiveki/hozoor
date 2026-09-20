import { RoleCode } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/server/auth";
import { retryNotification } from "@/server/notification-dispatcher";

const schema = z.object({ title: z.string().trim().min(1).max(160).default("OnTyme delivery test"), body: z.string().trim().min(1).max(2000).default("This is a temporary notification delivery test."), href: z.string().trim().max(500).nullable().optional(), attempts: z.number().int().min(1).max(5).default(1) });

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || (user.role !== RoleCode.ADMIN && user.role !== RoleCode.HR_ADMIN)) return NextResponse.json({ error: { code: "FORBIDDEN", message: "Notification delivery testing requires administrator access." } }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Invalid test message or retry count." } }, { status: 400 });
  const result = await retryNotification({ companyId: user.companyId, userId: user.id, title: parsed.data.title, body: parsed.data.body, href: parsed.data.href }, parsed.data.attempts);
  return NextResponse.json({ data: result }, { status: result.delivered ? 200 : 502 });
}
