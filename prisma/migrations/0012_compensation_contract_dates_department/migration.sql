ALTER TABLE "CompensationProfile" ADD COLUMN "contractStartDate" TIMESTAMP(3);
ALTER TABLE "CompensationProfile" ADD COLUMN "contractEndDate" TIMESTAMP(3);
ALTER TABLE "CompensationProfile" ADD COLUMN "departmentId" TEXT;

UPDATE "CompensationProfile" SET "contractStartDate" = "effectiveFrom" WHERE "contractStartDate" IS NULL;

ALTER TABLE "CompensationProfile" ALTER COLUMN "contractStartDate" SET NOT NULL;

CREATE INDEX "CompensationProfile_companyId_departmentId_idx" ON "CompensationProfile"("companyId", "departmentId");

ALTER TABLE "CompensationProfile" ADD CONSTRAINT "CompensationProfile_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;
