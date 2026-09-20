import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth";
import { db } from "@/server/db";

export async function DELETE(_: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Login required." } }, { status: 401 });
  const { id } = await context.params;
  const filter = await db.savedReportFilter.findFirst({ where: { id, userId: user.id } });
  if (!filter) return NextResponse.json({ error: { code: "NOT_FOUND", message: "Saved filter not found." } }, { status: 404 });
  await db.savedReportFilter.delete({ where: { id } });
  return NextResponse.json({ data: { ok: true } });
}
