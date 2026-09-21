import { RoleCode } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/server/auth";
import { db } from "@/server/db";
import { audit } from "@/server/audit";

const schema = z.object({ date: z.coerce.date(), title: z.string().trim().min(2).max(200), calendarYear: z.number().int().min(1300).max(1600).nullable().optional(), version: z.number().int().min(1).default(1), sourceReference: z.string().trim().max(500).nullable().optional(), isOfficial: z.boolean().default(false), active: z.boolean().default(true) }).refine((value) => !value.isOfficial || Boolean(value.sourceReference?.trim()), { message: "An official holiday requires a source reference." });
const isAdmin = (role: RoleCode) => role === RoleCode.ADMIN || role === RoleCode.HR_ADMIN;

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Login required." } }, { status: 401 });
  const url = new URL(request.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  return NextResponse.json({ data: await db.holiday.findMany({ where: { companyId: user.companyId, active: true, date: { gte: from ? new Date(from) : undefined, lte: to ? new Date(to) : undefined } }, orderBy: { date: "asc" } }) });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user.role)) return NextResponse.json({ error: { code: "FORBIDDEN", message: "Administrator access required." } }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Invalid holiday." } }, { status: 400 });
  try {
    const holiday = await db.holiday.create({ data: { companyId: user.companyId, date: new Date(Date.UTC(parsed.data.date.getUTCFullYear(), parsed.data.date.getUTCMonth(), parsed.data.date.getUTCDate())), title: parsed.data.title, calendarYear: parsed.data.calendarYear ?? null, version: parsed.data.version, sourceReference: parsed.data.sourceReference ?? null, isOfficial: parsed.data.isOfficial, active: parsed.data.active } });
    await audit({ companyId: user.companyId, actorId: user.id, action: "holiday.create", entityType: "Holiday", entityId: holiday.id, after: parsed.data });
    return NextResponse.json({ data: holiday }, { status: 201 });
  } catch { return NextResponse.json({ error: { code: "CONFLICT", message: "A holiday already exists on this date." } }, { status: 409 }); }
}
