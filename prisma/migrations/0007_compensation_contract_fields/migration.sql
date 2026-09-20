-- AlterTable
ALTER TABLE "CompensationProfile" ADD COLUMN     "contractType" TEXT NOT NULL DEFAULT 'STANDARD',
ADD COLUMN     "jobTitle" TEXT,
ADD COLUMN     "payrollIdentifier" TEXT;


