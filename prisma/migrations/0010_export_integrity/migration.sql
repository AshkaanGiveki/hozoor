-- AlterTable
ALTER TABLE "ReportExport"
ADD COLUMN "schemaVersion" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "checksum" TEXT NOT NULL DEFAULT '',
ADD COLUMN "idempotencyKey" TEXT,
ADD COLUMN "sourceSnapshot" JSONB;

-- CreateIndex
CREATE UNIQUE INDEX "ReportExport_companyId_reportType_idempotencyKey_key" ON "ReportExport"("companyId", "reportType", "idempotencyKey");
