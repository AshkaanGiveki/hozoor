-- AlterTable
ALTER TABLE "PayrollPeriod"
ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "correctionOfId" TEXT,
ADD COLUMN "correctionReason" TEXT,
ADD COLUMN "reversalReason" TEXT,
ADD COLUMN "reversedAt" TIMESTAMP(3);

-- Replace the period uniqueness constraint so corrected revisions can coexist with the immutable original.
DROP INDEX "PayrollPeriod_companyId_year_month_key";
CREATE UNIQUE INDEX "PayrollPeriod_companyId_year_month_revision_key" ON "PayrollPeriod"("companyId", "year", "month", "revision");

-- AddForeignKey
ALTER TABLE "PayrollPeriod" ADD CONSTRAINT "PayrollPeriod_correctionOfId_fkey" FOREIGN KEY ("correctionOfId") REFERENCES "PayrollPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
