CREATE TABLE "AttendanceGroup" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "AttendanceGroup_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AttendanceGroup_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "CompanyProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
ALTER TABLE "Employee" ADD COLUMN "groupId" TEXT;
ALTER TABLE "PolicyAssignment" ADD COLUMN "groupId" TEXT;
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "AttendanceGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PolicyAssignment" ADD CONSTRAINT "PolicyAssignment_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "AttendanceGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE UNIQUE INDEX "AttendanceGroup_companyId_name_key" ON "AttendanceGroup"("companyId", "name");
CREATE INDEX "Employee_companyId_groupId_idx" ON "Employee"("companyId", "groupId");
CREATE INDEX "PolicyAssignment_groupId_startDate_idx" ON "PolicyAssignment"("groupId", "startDate");
