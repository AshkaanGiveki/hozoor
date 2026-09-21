CREATE TABLE "EvidenceRetentionPolicy" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "evidenceType" TEXT NOT NULL,
    "retentionDays" INTEGER NOT NULL,
    "archiveAfterDays" INTEGER,
    "legalBasis" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EvidenceRetentionPolicy_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EvidenceRetentionPolicy_companyId_evidenceType_key" ON "EvidenceRetentionPolicy"("companyId", "evidenceType");
CREATE INDEX "EvidenceRetentionPolicy_companyId_active_idx" ON "EvidenceRetentionPolicy"("companyId", "active");

ALTER TABLE "EvidenceRetentionPolicy" ADD CONSTRAINT "EvidenceRetentionPolicy_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "CompanyProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EvidenceRetentionPolicy" ADD CONSTRAINT "EvidenceRetentionPolicy_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
