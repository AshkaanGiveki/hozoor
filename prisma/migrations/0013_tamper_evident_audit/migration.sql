ALTER TABLE "AuditLog" ADD COLUMN "previousHash" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN "hash" TEXT;

CREATE INDEX "AuditLog_companyId_hash_idx" ON "AuditLog"("companyId", "hash");
