import { RoleCode } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/server/auth";
import { db } from "@/server/db";
import { getGeofenceSettings } from "@/server/geofence";
import { audit } from "@/server/audit";

const schema = z.object({ enabled: z.boolean(), latitude: z.number().min(-90).max(90).nullable(), longitude: z.number().min(-180).max(180).nullable(), radiusMeters: z.number().int().min(25).max(10000) }).refine((value) => !value.enabled || (value.latitude !== null && value.longitude !== null), { message: "Enabled geofencing requires coordinates." });
const allowed = (role: RoleCode) => role === RoleCode.ADMIN || role === RoleCode.HR_ADMIN;

export async function GET() { const user = await getCurrentUser(); if (!user) return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Login required." } }, { status: 401 }); return NextResponse.json({ data: await getGeofenceSettings(user.companyId) }); }
export async function PATCH(request: Request) { const user = await getCurrentUser(); if (!user || !allowed(user.role)) return NextResponse.json({ error: { code: "FORBIDDEN", message: "Administrator access required." } }, { status: 403 }); const parsed = schema.safeParse(await request.json().catch(() => ({}))); if (!parsed.success) return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Invalid geofence settings." } }, { status: 400 }); const input = parsed.data; const values = { self_attendance_geofence_enabled: String(input.enabled), self_attendance_latitude: input.latitude === null ? "" : String(input.latitude), self_attendance_longitude: input.longitude === null ? "" : String(input.longitude), self_attendance_radius_meters: String(input.radiusMeters) }; await db.$transaction(Object.entries(values).map(([key, value]) => db.companySetting.upsert({ where: { companyId_key: { companyId: user.companyId, key } }, update: { value }, create: { companyId: user.companyId, key, value } }))); await audit({ companyId: user.companyId, actorId: user.id, action: "self_attendance.geofence_update", entityType: "CompanySetting", after: input }); return NextResponse.json({ data: input }); }
