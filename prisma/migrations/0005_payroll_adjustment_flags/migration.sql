-- AlterTable
ALTER TABLE "PayrollAdjustment" ADD COLUMN     "insurable" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "taxable" BOOLEAN NOT NULL DEFAULT false;


