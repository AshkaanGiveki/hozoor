import { RoleCode } from "@prisma/client";
import { NextResponse } from "next/server";
import { getCurrentUser, isAdmin } from "@/server/auth";
import { db } from "@/server/db";
import { verifyAuditChain } from "@/server/audit";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || (!isAdmin(user.role) && user.role !== RoleCode.AUDITOR)) return NextResponse.json({ error: { code: "FORBIDDEN", message: "Audit integrity access required." } }, { status: 403 });
  const records = await db.auditLog.findMany({ where: { companyId: user.companyId, hash: { not: null } }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], select: { id: true, companyId: true, actorId: true, action: true, entityType: true, entityId: true, requestId: true, before: true, after: true, previousHash: true, hash: true, createdAt: true } });
  return NextResponse.json({ data: verifyAuditChain(records), generatedAt: new Date().toISOString() });
}
