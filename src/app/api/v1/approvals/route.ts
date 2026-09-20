import { LedgerType, RoleCode } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/server/auth";
import { db } from "@/server/db";
import { canReadAll } from "@/server/permissions";
import { audit } from "@/server/audit";
import { recalculateAttendanceDay } from "@/server/attendance-service";
import { addLeaveLedgerEntry, getLeaveBalance } from "@/server/leave-balances";
import { statusForRole } from "@/server/approval-service";
import { dispatchNotification } from "@/server/notification-dispatcher";

const roles: RoleCode[] = [RoleCode.ADMIN, RoleCode.HR_ADMIN, RoleCode.MANAGER];
const schema = z.object({ id: z.string(), type: z.enum(["leave", "offtime", "correction"]), approved: z.boolean(), comment: z.string().optional() });

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !roles.includes(user.role)) return NextResponse.json({ error: { code: "FORBIDDEN", message: "Approval access required." } }, { status: 403 });
  const scope = canReadAll(user) ? { companyId: user.companyId } : { companyId: user.companyId, employee: { teamId: { in: (await db.managerAssignment.findMany({ where: { managerId: user.id }, select: { teamId: true } })).map((item) => item.teamId) } } };
  const statuses = { in: ["PENDING_MANAGER", "PENDING_ADMIN", "SUBMITTED"] as ("PENDING_MANAGER" | "PENDING_ADMIN" | "SUBMITTED")[] };
  const [leave, offtime, correction] = await Promise.all([
    db.leaveRequest.findMany({ where: { ...scope, status: statuses }, include: { employee: true, leaveType: true, approval: { include: { workflow: { include: { steps: true } } } } }, orderBy: { createdAt: "asc" } }),
    db.offTimeRequest.findMany({ where: { ...scope, status: statuses }, include: { employee: true, approval: { include: { workflow: { include: { steps: true } } } } }, orderBy: { createdAt: "asc" } }),
    db.attendanceCorrectionRequest.findMany({ where: { ...scope, status: statuses }, include: { employee: true, approval: { include: { workflow: { include: { steps: true } } } } }, orderBy: { createdAt: "asc" } }),
  ]);
  return NextResponse.json({ data: { leave, offtime, correction } });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || !roles.includes(user.role)) return NextResponse.json({ error: { code: "FORBIDDEN", message: "Approval access required." } }, { status: 403 });
  const body = schema.safeParse(await request.json().catch(() => ({})));
  if (!body.success) return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Invalid approval decision." } }, { status: 400 });
  const input = body.data;
  const model = input.type === "leave" ? "leaveRequest" : input.type === "offtime" ? "offTimeRequest" : "attendanceCorrectionRequest";
  const current = await (model === "leaveRequest" ? db.leaveRequest.findFirst({ where: { id: input.id, companyId: user.companyId } }) : model === "offTimeRequest" ? db.offTimeRequest.findFirst({ where: { id: input.id, companyId: user.companyId } }) : db.attendanceCorrectionRequest.findFirst({ where: { id: input.id, companyId: user.companyId } }));
  if (!current || ["APPROVED", "REJECTED", "CANCELLED"].includes(current.status)) return NextResponse.json({ error: { code: "CONFLICT", message: "This request has already been decided." } }, { status: 409 });
  if (current.employeeId === user.employee?.id) return NextResponse.json({ error: { code: "FORBIDDEN", message: "You cannot decide your own request." } }, { status: 403 });
  const employee = await db.employee.findUnique({ where: { id: current.employeeId } });
  if (user.role === RoleCode.MANAGER && (!employee?.teamId || !(await db.managerAssignment.findFirst({ where: { managerId: user.id, teamId: employee.teamId } }))) && !canReadAll(user)) return NextResponse.json({ error: { code: "FORBIDDEN", message: "Request is outside your team scope." } }, { status: 403 });
  const instance = model === "leaveRequest"
    ? await db.approvalInstance.findUnique({ where: { leaveRequestId: input.id }, include: { workflow: { include: { steps: { orderBy: { order: "asc" } } } } } })
    : model === "offTimeRequest"
      ? await db.approvalInstance.findUnique({ where: { offTimeRequestId: input.id }, include: { workflow: { include: { steps: { orderBy: { order: "asc" } } } } } })
      : await db.approvalInstance.findUnique({ where: { correctionRequestId: input.id }, include: { workflow: { include: { steps: { orderBy: { order: "asc" } } } } } });
  const currentStep = instance?.workflow.steps.find((step) => step.order === instance.currentOrder);
  if (currentStep && user.role !== RoleCode.ADMIN && user.role !== currentStep.role) return NextResponse.json({ error: { code: "FORBIDDEN", message: "This request is waiting for another approval role." } }, { status: 403 });
  const status = input.approved ? "APPROVED" : "REJECTED";
  try {
    await db.$transaction(async (tx) => {
      let finalDecision = !instance || !currentStep;
      let nextStep: typeof currentStep | null = null;
      if (instance && currentStep && input.approved) nextStep = instance.workflow.steps.find((step) => step.order > currentStep!.order) ?? null;
      if (nextStep) { finalDecision = false; }
      const nextStatus = nextStep ? statusForRole(nextStep.role) : status;
      if (model === "leaveRequest") {
        const leave = current as { id: string; employeeId: string; leaveTypeId: string; startDate: Date; requestedMinutes: number };
        await tx.leaveRequest.update({ where: { id: input.id }, data: { status: nextStatus } });
        if (finalDecision) {
          const balance = await getLeaveBalance(leave.employeeId, leave.leaveTypeId, leave.startDate.getUTCFullYear(), tx);
          if (input.approved && balance.availableMinutes < leave.requestedMinutes) throw new Error("INSUFFICIENT_LEAVE_BALANCE");
          await addLeaveLedgerEntry(tx, { balanceId: balance.id, type: LedgerType.REQUEST_RELEASED, minutes: leave.requestedMinutes, referenceId: leave.id, description: input.approved ? "Release reservation before consumption" : "Release rejected leave reservation" });
          if (input.approved) await addLeaveLedgerEntry(tx, { balanceId: balance.id, type: LedgerType.REQUEST_CONSUMED, minutes: leave.requestedMinutes, referenceId: leave.id, description: "Approved leave consumption" });
        }
      }
      if (model === "offTimeRequest") await tx.offTimeRequest.update({ where: { id: input.id }, data: { status: nextStatus } });
      if (model === "attendanceCorrectionRequest") await tx.attendanceCorrectionRequest.update({ where: { id: input.id }, data: { status: nextStatus } });
      if (instance && currentStep) {
        await tx.approvalDecision.create({ data: { instanceId: instance.id, approverId: user.id, order: currentStep.order, approved: input.approved, comment: input.comment } });
        await tx.approvalInstance.update({ where: { id: instance.id }, data: nextStep ? { currentOrder: nextStep.order } : { completed: true } });
      }
      const target = await tx.user.findFirst({ where: { companyId: user.companyId, employee: { id: current.employeeId } } });
      if (target) await tx.notification.create({ data: { companyId: user.companyId, userId: target.id, employeeId: current.employeeId, title: nextStep ? "Request moved to next approval step" : input.approved ? "Request approved" : "Request rejected", body: input.comment || "Your request workflow was updated.", href: "/requests" } });
    });
  } catch (error) {
    if (error instanceof Error && error.message === "INSUFFICIENT_LEAVE_BALANCE") return NextResponse.json({ error: { code: "INSUFFICIENT_LEAVE_BALANCE", message: "The leave balance is no longer sufficient." } }, { status: 409 });
    return NextResponse.json({ error: { code: "REQUEST_FAILED", message: "Approval decision could not be recorded." } }, { status: 400 });
  }
  const targetUser = await db.user.findFirst({ where: { companyId: user.companyId, employee: { id: current.employeeId } }, select: { id: true } });
  if (targetUser) await dispatchNotification({ companyId: user.companyId, userId: targetUser.id, title: status === "APPROVED" ? "Request approved" : status === "REJECTED" ? "Request rejected" : "Request workflow updated", body: input.comment || "Your request workflow was updated.", href: "/requests" }).catch(() => undefined);
  const requestDate = model === "leaveRequest" ? (current as { startDate: Date }).startDate : (current as { date: Date }).date;
  await recalculateAttendanceDay(user.companyId, current.employeeId, requestDate);
  await audit({ companyId: user.companyId, actorId: user.id, action: input.approved ? "request.approve" : "request.reject", entityType: model, entityId: input.id, after: { comment: input.comment, status } });
  return NextResponse.json({ data: { status } });
}
