-- CreateEnum
CREATE TYPE "CompensationStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "PayrollRuleStatus" AS ENUM ('DRAFT', 'APPROVED', 'RETIRED');

-- CreateEnum
CREATE TYPE "PayrollPeriodStatus" AS ENUM ('DRAFT', 'CALCULATED', 'IN_REVIEW', 'APPROVED', 'PAID', 'LOCKED', 'REVERSED', 'CORRECTED');

-- CreateEnum
CREATE TYPE "PayrollLineType" AS ENUM ('BASE_SALARY', 'ALLOWANCE', 'BONUS', 'COMMISSION', 'OVERTIME', 'HOLIDAY_PREMIUM', 'LEAVE_ADJUSTMENT', 'ABSENCE_DEDUCTION', 'TAX', 'EMPLOYEE_INSURANCE', 'EMPLOYER_INSURANCE', 'LOAN_REPAYMENT', 'ADVANCE_REPAYMENT', 'OTHER_DEDUCTION', 'OTHER_EARNING');

-- CreateEnum
CREATE TYPE "PayrollPaymentStatus" AS ENUM ('PENDING', 'SUBMITTED', 'PAID', 'FAILED', 'REVERSED');

-- AlterTable
ALTER TABLE "ApprovalDecision" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ApprovalInstance" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ApprovalWorkflow" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ApprovalWorkflowStep" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "AttendanceAnomaly" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "AttendanceCorrectionItem" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "AttendanceCorrectionRequest" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "AttendanceDay" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "anomalies" DROP DEFAULT;

-- AlterTable
ALTER TABLE "AttendanceDevice" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "AttendancePolicy" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "AttendanceSession" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "AuditLog" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "CompanyProfile" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "CompanySetting" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "DailyWorkRule" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Department" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "DeviceEmployeeMapping" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Employee" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "EmploymentPeriod" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "FileAttachment" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Holiday" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ImportJob" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ImportProfile" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ImportRowError" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "LeaveBalance" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "LeaveBalanceTransaction" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "LeavePolicy" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "LeavePolicyRule" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "LeaveRequest" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "LeaveType" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "LoginAttempt" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ManagerAssignment" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Notification" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "OffTimeRequest" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "PasswordHistory" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "PolicyAssignment" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "RawAttendanceEvent" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ReportExport" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "SavedReportFilter" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ScheduleAssignment" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Session" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ShiftTemplate" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Team" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "WorkScheduleTemplate" ALTER COLUMN "id" DROP DEFAULT;

-- CreateTable
CREATE TABLE "CompensationProfile" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "status" "CompensationStatus" NOT NULL DEFAULT 'DRAFT',
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "baseSalary" DECIMAL(20,0) NOT NULL,
    "dailyRate" DECIMAL(20,0),
    "hourlyRate" DECIMAL(20,0),
    "components" JSONB NOT NULL,
    "taxStatus" TEXT NOT NULL DEFAULT 'STANDARD',
    "insuranceStatus" TEXT NOT NULL DEFAULT 'INSURED',
    "bankAccountLast4" TEXT,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompensationProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollRuleSet" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "calendarYear" INTEGER NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "PayrollRuleStatus" NOT NULL DEFAULT 'DRAFT',
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "sourceReference" TEXT,
    "rules" JSONB NOT NULL,
    "checksum" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "approvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollRuleSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollPolicy" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "PolicyStatus" NOT NULL DEFAULT 'DRAFT',
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "settings" JSONB NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollPeriod" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "ruleSetId" TEXT NOT NULL,
    "payrollPolicyId" TEXT,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" "PayrollPeriodStatus" NOT NULL DEFAULT 'DRAFT',
    "calculatedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "lockedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "approvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollRun" (
    "id" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "compensationProfileId" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "grossAmount" DECIMAL(20,0) NOT NULL,
    "taxableAmount" DECIMAL(20,0) NOT NULL,
    "insurableAmount" DECIMAL(20,0) NOT NULL,
    "employeeInsurance" DECIMAL(20,0) NOT NULL,
    "employerInsurance" DECIMAL(20,0) NOT NULL,
    "taxAmount" DECIMAL(20,0) NOT NULL,
    "totalDeductions" DECIMAL(20,0) NOT NULL,
    "netPayable" DECIMAL(20,0) NOT NULL,
    "paidAmount" DECIMAL(20,0),
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayrollRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollLine" (
    "id" TEXT NOT NULL,
    "payrollRunId" TEXT NOT NULL,
    "type" "PayrollLineType" NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "quantity" DECIMAL(20,4),
    "rate" DECIMAL(20,4),
    "amount" DECIMAL(20,0) NOT NULL,
    "sourceData" JSONB,

    CONSTRAINT "PayrollLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollAdjustment" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "payrollRunId" TEXT,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "amount" DECIMAL(20,0) NOT NULL,
    "reason" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayrollAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollPayment" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "payrollRunId" TEXT NOT NULL,
    "amount" DECIMAL(20,0) NOT NULL,
    "status" "PayrollPaymentStatus" NOT NULL DEFAULT 'PENDING',
    "paymentReference" TEXT,
    "paidAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CompensationProfile_companyId_employeeId_effectiveFrom_idx" ON "CompensationProfile"("companyId", "employeeId", "effectiveFrom");

-- CreateIndex
CREATE INDEX "CompensationProfile_employeeId_status_idx" ON "CompensationProfile"("employeeId", "status");

-- CreateIndex
CREATE INDEX "PayrollRuleSet_companyId_calendarYear_status_idx" ON "PayrollRuleSet"("companyId", "calendarYear", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollRuleSet_companyId_calendarYear_version_key" ON "PayrollRuleSet"("companyId", "calendarYear", "version");

-- CreateIndex
CREATE INDEX "PayrollPolicy_companyId_effectiveFrom_status_idx" ON "PayrollPolicy"("companyId", "effectiveFrom", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollPolicy_companyId_name_version_key" ON "PayrollPolicy"("companyId", "name", "version");

-- CreateIndex
CREATE INDEX "PayrollPeriod_companyId_status_startDate_idx" ON "PayrollPeriod"("companyId", "status", "startDate");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollPeriod_companyId_year_month_key" ON "PayrollPeriod"("companyId", "year", "month");

-- CreateIndex
CREATE INDEX "PayrollRun_employeeId_calculatedAt_idx" ON "PayrollRun"("employeeId", "calculatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollRun_periodId_employeeId_key" ON "PayrollRun"("periodId", "employeeId");

-- CreateIndex
CREATE INDEX "PayrollLine_payrollRunId_type_idx" ON "PayrollLine"("payrollRunId", "type");

-- CreateIndex
CREATE INDEX "PayrollAdjustment_companyId_periodId_employeeId_idx" ON "PayrollAdjustment"("companyId", "periodId", "employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollPayment_payrollRunId_key" ON "PayrollPayment"("payrollRunId");

-- CreateIndex
CREATE INDEX "PayrollPayment_companyId_periodId_status_idx" ON "PayrollPayment"("companyId", "periodId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ApprovalWorkflowStep_workflowId_order_key" ON "ApprovalWorkflowStep"("workflowId", "order");

-- CreateIndex
CREATE INDEX "AttendanceCorrectionRequest_employeeId_date_status_idx" ON "AttendanceCorrectionRequest"("employeeId", "date", "status");

-- CreateIndex
CREATE INDEX "AttendancePolicy_companyId_effectiveFrom_effectiveTo_idx" ON "AttendancePolicy"("companyId", "effectiveFrom", "effectiveTo");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "Employee_companyId_teamId_managerId_idx" ON "Employee"("companyId", "teamId", "managerId");

-- CreateIndex
CREATE INDEX "ImportJob_companyId_createdAt_idx" ON "ImportJob"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "LeaveRequest_employeeId_status_idx" ON "LeaveRequest"("employeeId", "status");

-- CreateIndex
CREATE INDEX "LeaveRequest_companyId_startDate_endDate_idx" ON "LeaveRequest"("companyId", "startDate", "endDate");

-- CreateIndex
CREATE INDEX "LoginAttempt_username_createdAt_idx" ON "LoginAttempt"("username", "createdAt");

-- CreateIndex
CREATE INDEX "ManagerAssignment_managerId_teamId_idx" ON "ManagerAssignment"("managerId", "teamId");

-- CreateIndex
CREATE INDEX "OffTimeRequest_employeeId_date_status_idx" ON "OffTimeRequest"("employeeId", "date", "status");

-- CreateIndex
CREATE INDEX "PasswordHistory_userId_idx" ON "PasswordHistory"("userId");

-- CreateIndex
CREATE INDEX "PolicyAssignment_employeeId_startDate_idx" ON "PolicyAssignment"("employeeId", "startDate");

-- CreateIndex
CREATE INDEX "PolicyAssignment_teamId_startDate_idx" ON "PolicyAssignment"("teamId", "startDate");

-- CreateIndex
CREATE INDEX "PolicyAssignment_departmentId_startDate_idx" ON "PolicyAssignment"("departmentId", "startDate");

-- CreateIndex
CREATE INDEX "RawAttendanceEvent_companyId_timestamp_idx" ON "RawAttendanceEvent"("companyId", "timestamp");

-- CreateIndex
CREATE INDEX "ScheduleAssignment_employeeId_startDate_idx" ON "ScheduleAssignment"("employeeId", "startDate");

-- CreateIndex
CREATE INDEX "User_companyId_role_idx" ON "User"("companyId", "role");

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompensationProfile" ADD CONSTRAINT "CompensationProfile_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "CompanyProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompensationProfile" ADD CONSTRAINT "CompensationProfile_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompensationProfile" ADD CONSTRAINT "CompensationProfile_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollRuleSet" ADD CONSTRAINT "PayrollRuleSet_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "CompanyProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollRuleSet" ADD CONSTRAINT "PayrollRuleSet_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollRuleSet" ADD CONSTRAINT "PayrollRuleSet_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollPolicy" ADD CONSTRAINT "PayrollPolicy_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "CompanyProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollPolicy" ADD CONSTRAINT "PayrollPolicy_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollPeriod" ADD CONSTRAINT "PayrollPeriod_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "CompanyProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollPeriod" ADD CONSTRAINT "PayrollPeriod_ruleSetId_fkey" FOREIGN KEY ("ruleSetId") REFERENCES "PayrollRuleSet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollPeriod" ADD CONSTRAINT "PayrollPeriod_payrollPolicyId_fkey" FOREIGN KEY ("payrollPolicyId") REFERENCES "PayrollPolicy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollPeriod" ADD CONSTRAINT "PayrollPeriod_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollPeriod" ADD CONSTRAINT "PayrollPeriod_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollRun" ADD CONSTRAINT "PayrollRun_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "PayrollPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollRun" ADD CONSTRAINT "PayrollRun_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollRun" ADD CONSTRAINT "PayrollRun_compensationProfileId_fkey" FOREIGN KEY ("compensationProfileId") REFERENCES "CompensationProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollLine" ADD CONSTRAINT "PayrollLine_payrollRunId_fkey" FOREIGN KEY ("payrollRunId") REFERENCES "PayrollRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollAdjustment" ADD CONSTRAINT "PayrollAdjustment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "CompanyProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollAdjustment" ADD CONSTRAINT "PayrollAdjustment_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "PayrollPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollAdjustment" ADD CONSTRAINT "PayrollAdjustment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollAdjustment" ADD CONSTRAINT "PayrollAdjustment_payrollRunId_fkey" FOREIGN KEY ("payrollRunId") REFERENCES "PayrollRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollAdjustment" ADD CONSTRAINT "PayrollAdjustment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollPayment" ADD CONSTRAINT "PayrollPayment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "CompanyProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollPayment" ADD CONSTRAINT "PayrollPayment_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "PayrollPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollPayment" ADD CONSTRAINT "PayrollPayment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollPayment" ADD CONSTRAINT "PayrollPayment_payrollRunId_fkey" FOREIGN KEY ("payrollRunId") REFERENCES "PayrollRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


