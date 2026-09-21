ALTER TYPE "PayrollRuleStatus" ADD VALUE IF NOT EXISTS 'ACCOUNTING_REVIEWED';
ALTER TYPE "PayrollRuleStatus" ADD VALUE IF NOT EXISTS 'LEGAL_REVIEWED';

ALTER TABLE "PayrollRuleSet" ADD COLUMN "accountingReviewedById" TEXT;
ALTER TABLE "PayrollRuleSet" ADD COLUMN "legalReviewedById" TEXT;

ALTER TABLE "PayrollRuleSet" ADD CONSTRAINT "PayrollRuleSet_accountingReviewedById_fkey" FOREIGN KEY ("accountingReviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PayrollRuleSet" ADD CONSTRAINT "PayrollRuleSet_legalReviewedById_fkey" FOREIGN KEY ("legalReviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "PayrollRuleSet_accountingReviewedById_idx" ON "PayrollRuleSet"("accountingReviewedById");
CREATE INDEX "PayrollRuleSet_legalReviewedById_idx" ON "PayrollRuleSet"("legalReviewedById");
