import { RoleCode } from "@prisma/client";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth";
import { db } from "@/server/db";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || (user.role !== RoleCode.ADMIN && user.role !== RoleCode.HR_ADMIN && user.role !== RoleCode.AUDITOR)) return NextResponse.json({ error: { code: "FORBIDDEN", message: "Audit access required." } }, { status: 403 });
  const url = new URL(request.url);
  const action = url.searchParams.get("action") || undefined;
  const entityType = url.searchParams.get("entityType") || undefined;
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") || 50)));
  return NextResponse.json({ data: await db.auditLog.findMany({ where: { companyId: user.companyId, action: action ? { contains: action, mode: "insensitive" } : undefined, entityType }, include: { actor: { select: { username: true, firstName: true, lastName: true } } }, orderBy: { createdAt: "desc" }, take: limit }) });
}
