CREATE TYPE "IntegrationSubmissionStatus" AS ENUM ('QUEUED', 'PROCESSING', 'RETRYING', 'SUCCEEDED', 'FAILED');

CREATE TABLE "IntegrationSubmission" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "integrationType" TEXT NOT NULL,
    "adapterName" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "status" "IntegrationSubmissionStatus" NOT NULL DEFAULT 'QUEUED',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "nextAttemptAt" TIMESTAMP(3),
    "requestPayload" JSONB NOT NULL,
    "responsePayload" JSONB,
    "externalReference" TEXT,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "submittedAt" TIMESTAMP(3),
    CONSTRAINT "IntegrationSubmission_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "IntegrationSubmission_companyId_adapterName_idempotencyKey_key" ON "IntegrationSubmission"("companyId", "adapterName", "idempotencyKey");
CREATE INDEX "IntegrationSubmission_companyId_status_nextAttemptAt_idx" ON "IntegrationSubmission"("companyId", "status", "nextAttemptAt");

ALTER TABLE "IntegrationSubmission" ADD CONSTRAINT "IntegrationSubmission_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "CompanyProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IntegrationSubmission" ADD CONSTRAINT "IntegrationSubmission_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
