import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { getCurrentUser } from "@/server/auth";
import { db } from "@/server/db";

const schema = z.object({ name: z.string().trim().min(2).max(100), reportType: z.string().trim().min(2).max(80), filters: z.record(z.unknown()) });

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Login required." } }, { status: 401 });
  return NextResponse.json({ data: await db.savedReportFilter.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } }) });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Login required." } }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Invalid saved filter." } }, { status: 400 });
  return NextResponse.json({ data: await db.savedReportFilter.create({ data: { userId: user.id, name: parsed.data.name, reportType: parsed.data.reportType, filters: parsed.data.filters as Prisma.InputJsonValue } }) }, { status: 201 });
}
