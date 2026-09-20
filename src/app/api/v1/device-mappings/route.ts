import { RoleCode } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/server/auth";
import { db } from "@/server/db";
import { audit } from "@/server/audit";

const schema = z.object({ deviceId: z.string(), employeeId: z.string(), externalId: z.string().trim().min(1).max(120) });

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || (user.role !== RoleCode.ADMIN && user.role !== RoleCode.HR_ADMIN)) return NextResponse.json({ error: { code: "FORBIDDEN", message: "Administrator access required." } }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Invalid device mapping." } }, { status: 400 });
  const input = parsed.data;
  const [device, employee] = await Promise.all([db.attendanceDevice.findFirst({ where: { id: input.deviceId, companyId: user.companyId } }), db.employee.findFirst({ where: { id: input.employeeId, companyId: user.companyId } })]);
  if (!device || !employee) return NextResponse.json({ error: { code: "NOT_FOUND", message: "Device or employee not found." } }, { status: 404 });
  try {
    const mapping = await db.deviceEmployeeMapping.upsert({ where: { deviceId_employeeId: { deviceId: input.deviceId, employeeId: input.employeeId } }, update: { externalId: input.externalId }, create: input });
    await audit({ companyId: user.companyId, actorId: user.id, action: "device_mapping.upsert", entityType: "DeviceEmployeeMapping", entityId: mapping.id, after: input });
    return NextResponse.json({ data: mapping });
  } catch { return NextResponse.json({ error: { code: "CONFLICT", message: "This external identifier is already mapped on the device." } }, { status: 409 }); }
}
