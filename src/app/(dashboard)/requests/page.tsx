import { getCurrentUser } from "@/server/auth";
import { db } from "@/server/db";
import ApprovalsClient from "@/components/ApprovalsClient";
import RequestsClient from "@/components/RequestsClient";

const approvalRoles = ["ADMIN", "HR_ADMIN", "MANAGER"];

export default async function Requests() {
  const user = await getCurrentUser();
  if (!user) return null;

  if (!user.employee && approvalRoles.includes(user.role)) {
    const [leave, offtime, correction] = await Promise.all([
      db.leaveRequest.findMany({ where: { companyId: user.companyId, status: { in: ["SUBMITTED", "PENDING_MANAGER", "PENDING_ADMIN"] } }, include: { employee: true, leaveType: true }, orderBy: { createdAt: "asc" } }),
      db.offTimeRequest.findMany({ where: { companyId: user.companyId, status: { in: ["SUBMITTED", "PENDING_MANAGER", "PENDING_ADMIN"] } }, include: { employee: true }, orderBy: { createdAt: "asc" } }),
      db.attendanceCorrectionRequest.findMany({ where: { companyId: user.companyId, status: { in: ["SUBMITTED", "PENDING_MANAGER", "PENDING_ADMIN"] } }, include: { employee: true }, orderBy: { createdAt: "asc" } }),
    ]);
    return <ApprovalsClient initial={{ leave, offtime, correction }} />;
  }

  if (!user.employee) return <div className="empty">برای این حساب، درخواست شخصی قابل نمایش نیست.</div>;

  const [types, leave, offtime, correction] = await Promise.all([
    db.leaveType.findMany({ where: { companyId: user.companyId, active: true } }),
    db.leaveRequest.findMany({ where: { employeeId: user.employee.id }, include: { leaveType: true }, orderBy: { createdAt: "desc" } }),
    db.offTimeRequest.findMany({ where: { employeeId: user.employee.id }, orderBy: { createdAt: "desc" } }),
    db.attendanceCorrectionRequest.findMany({ where: { employeeId: user.employee.id }, orderBy: { createdAt: "desc" } }),
  ]);
  return <RequestsClient types={types.map((type) => ({ id: type.id, name: type.name, unit: type.unit }))} initial={{ leave, offtime, correction }} />;
}
