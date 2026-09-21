import crypto from "node:crypto";
import { db } from "./db";

export function buildAuditHash(input: { companyId: string; actorId?: string; action: string; entityType: string; entityId?: string; requestId?: string; before?: unknown; after?: unknown; previousHash?: string | null; createdAt: Date }) {
  return crypto.createHash("sha256").update(JSON.stringify({ ...input, createdAt: input.createdAt.toISOString() })).digest("hex");
}

export async function audit(input: { companyId: string; actorId?: string; action: string; entityType: string; entityId?: string; requestId?: string; before?: unknown; after?: unknown }) {
  const previous = await db.auditLog.findFirst({ where: { companyId: input.companyId, hash: { not: null } }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: { hash: true } });
  const createdAt = new Date();
  const previousHash = previous?.hash ?? null;
  const hash = buildAuditHash({ ...input, previousHash, createdAt });
  await db.auditLog.create({ data: { companyId: input.companyId, actorId: input.actorId, action: input.action, entityType: input.entityType, entityId: input.entityId, requestId: input.requestId, before: input.before as object | undefined, after: input.after as object | undefined, previousHash, hash, createdAt } });
}
