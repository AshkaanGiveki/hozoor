import { db } from "./db";
export async function audit(input: { companyId: string; actorId?: string; action: string; entityType: string; entityId?: string; requestId?: string; before?: unknown; after?: unknown }) {
  await db.auditLog.create({ data: { companyId: input.companyId, actorId: input.actorId, action: input.action, entityType: input.entityType, entityId: input.entityId, requestId: input.requestId, before: input.before as object | undefined, after: input.after as object | undefined } });
}
