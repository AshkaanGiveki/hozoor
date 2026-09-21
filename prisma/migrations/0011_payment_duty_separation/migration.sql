-- AlterTable
ALTER TABLE "PayrollPayment"
ADD COLUMN "confirmedById" TEXT,
ADD COLUMN "confirmedAt" TIMESTAMP(3);

-- AddForeignKey
ALTER TABLE "PayrollPayment" ADD CONSTRAINT "PayrollPayment_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
