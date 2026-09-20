import { LedgerType, RequestKind } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/server/auth";
import { db } from "@/server/db";
import { audit } from "@/server/audit";
import { addLeaveLedgerEntry, getLeaveBalance } from "@/server/leave-balances";
import { ensureWorkflow, statusForRole } from "@/server/approval-service";

const schema = z.union([
  z.object({ kind: z.literal("leave"), leaveTypeId: z.string(), startDate: z.coerce.date(), endDate: z.coerce.date(), requestedMinutes: z.coerce.number().int().positive(), reason: z.string().min(3), description: z.string().optional(), attachmentId: z.string().optional() }).refine((value) => value.startDate <= value.endDate, { message: "Start date must be before end date.", path: ["endDate"] }),
  z.object({ kind: z.literal("offtime"), date: z.coerce.date(), startMinutes: z.coerce.number().int().min(0).max(1439), endMinutes: z.coerce.number().int().min(1).max(1440), reason: z.string().min(3), description: z.string().optional() }).refine((value) => value.startMinutes < value.endMinutes, { message: "Start time must be before end time.", path: ["endMinutes"] }),
  z.object({ kind: z.literal("correction"), date: z.coerce.date(), proposedIn: z.coerce.date().optional(), proposedOut: z.coerce.date().optional(), reason: z.string().min(3), description: z.string().optional() }).refine((value) => !value.proposedIn || !value.proposedOut || value.proposedIn < value.proposedOut, { message: "Entry must be before exit.", path: ["proposedOut"] }),
]);

export async function GET() {
  const user = await getCurrentUser();
  if (!user?.employee) return NextResponse.json({ error: { code: "FORBIDDEN", message: "Employee account required." } }, { status: 403 });
  const [leave, offtime, correction] = await Promise.all([
    db.leaveRequest.findMany({ where: { employeeId: user.employee.id }, include: { leaveType: true, approval: { include: { decisions: true } } }, orderBy: { createdAt: "desc" } }),
    db.offTimeRequest.findMany({ where: { employeeId: user.employee.id }, orderBy: { createdAt: "desc" } }),
    db.attendanceCorrectionRequest.findMany({ where: { employeeId: user.employee.id }, orderBy: { createdAt: "desc" } }),
  ]);
  return NextResponse.json({ data: { leave, offtime, correction } });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user?.employee) return NextResponse.json({ error: { code: "FORBIDDEN", message: "Employee account required." } }, { status: 403 });
  const result = schema.safeParse(await request.json().catch(() => ({})));
  if (!result.success) return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Invalid request data.", fields: result.error.flatten().fieldErrors } }, { status: 400 });
  const value = result.data;
  try {
    if (value.kind === "leave") {
      const year = value.startDate.getUTCFullYear();
      if (year !== value.endDate.getUTCFullYear()) return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "A leave request cannot cross calendar years." } }, { status: 400 });
      const leaveType = await db.leaveType.findFirst({ where: { id: value.leaveTypeId, companyId: user.companyId, active: true }, select: { id: true } });
      if (!leaveType) return NextResponse.json({ error: { code: "NOT_FOUND", message: "Leave type not found." } }, { status: 404 });
      const created = await db.$transaction(async (tx) => {
        const balance = await getLeaveBalance(user.employee!.id, value.leaveTypeId, year, tx);
        if (balance.availableMinutes < value.requestedMinutes) throw new Error("INSUFFICIENT_LEAVE_BALANCE");
        const workflow = await ensureWorkflow(tx, user.companyId, RequestKind.LEAVE);
        const attachment = value.attachmentId ? await tx.fileAttachment.findFirst({ where: { id: value.attachmentId, companyId: user.companyId } }) : null;
        if (value.attachmentId && !attachment) throw new Error("INVALID_ATTACHMENT");
        const requestRecord = await tx.leaveRequest.create({ data: { companyId: user.companyId, employeeId: user.employee!.id, leaveTypeId: value.leaveTypeId, startDate: value.startDate, endDate: value.endDate, requestedMinutes: value.requestedMinutes, reason: value.reason, description: value.description, attachmentId: attachment?.id, status: statusForRole(workflow.steps[0].role) } });
        await addLeaveLedgerEntry(tx, { balanceId: balance.id, type: LedgerType.REQUEST_RESERVED, minutes: value.requestedMinutes, referenceId: requestRecord.id, description: "Leave request reservation" });
        await tx.approvalInstance.create({ data: { workflowId: workflow.id, leaveRequestId: requestRecord.id, currentOrder: workflow.steps[0].order } });
        return requestRecord;
      });
      await audit({ companyId: user.companyId, actorId: user.id, action: "leave.request", entityType: "LeaveRequest", entityId: created.id, after: { requestedMinutes: value.requestedMinutes } });
      return NextResponse.json({ data: created }, { status: 201 });
    }
    if (value.kind === "offtime") {
      const created = await db.$transaction(async (tx) => {
        const workflow = await ensureWorkflow(tx, user.companyId, RequestKind.OFF_TIME);
        const requestRecord = await tx.offTimeRequest.create({ data: { companyId: user.companyId, employeeId: user.employee!.id, date: value.date, startMinutes: value.startMinutes, endMinutes: value.endMinutes, requestedMinutes: value.endMinutes - value.startMinutes, reason: value.reason, description: value.description, status: statusForRole(workflow.steps[0].role) } });
        await tx.approvalInstance.create({ data: { workflowId: workflow.id, offTimeRequestId: requestRecord.id, currentOrder: workflow.steps[0].order } });
        return requestRecord;
      });
      await audit({ companyId: user.companyId, actorId: user.id, action: "offtime.request", entityType: "OffTimeRequest", entityId: created.id });
      return NextResponse.json({ data: created }, { status: 201 });
    }
    const created = await db.$transaction(async (tx) => {
      const workflow = await ensureWorkflow(tx, user.companyId, RequestKind.CORRECTION);
      const requestRecord = await tx.attendanceCorrectionRequest.create({ data: { companyId: user.companyId, employeeId: user.employee!.id, date: value.date, proposedIn: value.proposedIn, proposedOut: value.proposedOut, reason: value.reason, description: value.description, status: statusForRole(workflow.steps[0].role) } });
      await tx.approvalInstance.create({ data: { workflowId: workflow.id, correctionRequestId: requestRecord.id, currentOrder: workflow.steps[0].order } });
      return requestRecord;
    });
    await audit({ companyId: user.companyId, actorId: user.id, action: "correction.request", entityType: "AttendanceCorrectionRequest", entityId: created.id });
    return NextResponse.json({ data: created }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "INSUFFICIENT_LEAVE_BALANCE") return NextResponse.json({ error: { code: "INSUFFICIENT_LEAVE_BALANCE", message: "Requested leave exceeds the available balance." } }, { status: 409 });
    return NextResponse.json({ error: { code: "REQUEST_FAILED", message: "Request could not be created." } }, { status: 400 });
  }
}
