import crypto from "node:crypto";
import { db } from "./db";

export function buildAuditHash(input: { companyId: string; actorId?: string; action: string; entityType: string; entityId?: string; requestId?: string; before?: unknown; after?: unknown; previousHash?: string | null; createdAt: Date }) {
  return crypto.createHash("sha256").update(JSON.stringify({ ...input, createdAt: input.createdAt.toISOString() })).digest("hex");
}

export function verifyAuditChain(records: Array<{ id: string; companyId: string; actorId: string | null; action: string; entityType: string; entityId: string | null; requestId: string | null; before: unknown; after: unknown; previousHash: string | null; hash: string | null; createdAt: Date }>) {
  let previousHash: string | null = null;
  for (const record of records) {
    if (!record.hash || record.previousHash !== previousHash) return { valid: false, checked: records.indexOf(record), brokenRecordId: record.id };
    const expected = buildAuditHash({ companyId: record.companyId, actorId: record.actorId ?? undefined, action: record.action, entityType: record.entityType, entityId: record.entityId ?? undefined, requestId: record.requestId ?? undefined, before: record.before, after: record.after, previousHash: record.previousHash, createdAt: record.createdAt });
    if (expected !== record.hash) return { valid: false, checked: records.indexOf(record), brokenRecordId: record.id };
    previousHash = record.hash;
  }
  return { valid: true, checked: records.length, brokenRecordId: null };
}

export async function audit(input: { companyId: string; actorId?: string; action: string; entityType: string; entityId?: string; requestId?: string; before?: unknown; after?: unknown }) {
  const previous = await db.auditLog.findFirst({ where: { companyId: input.companyId, hash: { not: null } }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: { hash: true } });
  const createdAt = new Date();
  const previousHash = previous?.hash ?? null;
  const hash = buildAuditHash({ ...input, previousHash, createdAt });
  await db.auditLog.create({ data: { companyId: input.companyId, actorId: input.actorId, action: input.action, entityType: input.entityType, entityId: input.entityId, requestId: input.requestId, before: input.before as object | undefined, after: input.after as object | undefined, previousHash, hash, createdAt } });
}
