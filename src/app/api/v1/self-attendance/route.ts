import crypto from "node:crypto";
import { EventType } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/server/auth";
import { db } from "@/server/db";
import { recalculateAttendanceDay } from "@/server/attendance-service";
import { distanceMeters, getGeofenceSettings } from "@/server/geofence";

const schema = z.object({ action: z.enum(["IN", "OUT"]), timestamp: z.coerce.date().optional(), latitude: z.number().min(-90).max(90).optional(), longitude: z.number().min(-180).max(180).optional(), accuracy: z.number().nonnegative().max(10000).optional() });

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user?.employee) return NextResponse.json({ error: { code: "FORBIDDEN", message: "Employee account required." } }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Invalid attendance event." } }, { status: 400 });
  const input = parsed.data; const timestamp = input.timestamp || new Date();
  const geofence = await getGeofenceSettings(user.companyId);
  if (geofence.enabled) {
    if (input.latitude === undefined || input.longitude === undefined || geofence.latitude === null || geofence.longitude === null) return NextResponse.json({ error: { code: "LOCATION_REQUIRED", message: "Location is required for self-service attendance." } }, { status: 400 });
    const distance = distanceMeters(input.latitude, input.longitude, geofence.latitude, geofence.longitude);
    if (distance > geofence.radiusMeters) return NextResponse.json({ error: { code: "OUTSIDE_GEOFENCE", message: "You are outside the allowed attendance area." } }, { status: 403 });
  }
  const device = await db.attendanceDevice.upsert({ where: { id: `self-service-${user.companyId}` }, update: { active: true }, create: { id: `self-service-${user.companyId}`, companyId: user.companyId, name: "Self-service attendance", type: "self-service" } });
  const type = input.action === "IN" ? EventType.IN : EventType.OUT;
  const fingerprint = crypto.createHash("sha256").update([device.id, user.employee.employeeCode, timestamp.toISOString(), type].join("|")).digest("hex");
  try { await db.rawAttendanceEvent.create({ data: { companyId: user.companyId, deviceId: device.id, employeeId: user.employee.id, externalId: user.employee.employeeCode, timestamp, type, fingerprint, sourceData: { source: "self-service", latitude: input.latitude, longitude: input.longitude, accuracy: input.accuracy } } }); } catch { return NextResponse.json({ error: { code: "DUPLICATE_EVENT", message: "This attendance event was already recorded." } }, { status: 409 }); }
  const day = new Date(timestamp); day.setUTCHours(0, 0, 0, 0); const attendance = await recalculateAttendanceDay(user.companyId, user.employee.id, day);
  return NextResponse.json({ data: { event: type, timestamp, attendance } }, { status: 201 });
}
