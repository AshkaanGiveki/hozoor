import { db } from "./db";

export type GeofenceSettings = { enabled: boolean; latitude: number | null; longitude: number | null; radiusMeters: number };
export async function getGeofenceSettings(companyId: string): Promise<GeofenceSettings> {
  const rows = await db.companySetting.findMany({ where: { companyId, key: { in: ["self_attendance_geofence_enabled", "self_attendance_latitude", "self_attendance_longitude", "self_attendance_radius_meters"] } } });
  const values = Object.fromEntries(rows.map((row) => [row.key, row.value]));
  const latitude = values.self_attendance_latitude ? Number(values.self_attendance_latitude) : null;
  const longitude = values.self_attendance_longitude ? Number(values.self_attendance_longitude) : null;
  const radiusMeters = values.self_attendance_radius_meters ? Number(values.self_attendance_radius_meters) : 250;
  return { enabled: values.self_attendance_geofence_enabled === "true", latitude: Number.isFinite(latitude) ? latitude : null, longitude: Number.isFinite(longitude) ? longitude : null, radiusMeters: Number.isFinite(radiusMeters) ? Math.max(25, Math.min(radiusMeters, 10000)) : 250 };
}

export function distanceMeters(latitudeA: number, longitudeA: number, latitudeB: number, longitudeB: number) {
  const earthRadius = 6371000; const radians = (value: number) => value * Math.PI / 180; const dLat = radians(latitudeB - latitudeA); const dLon = radians(longitudeB - longitudeA); const a = Math.sin(dLat / 2) ** 2 + Math.cos(radians(latitudeA)) * Math.cos(radians(latitudeB)) * Math.sin(dLon / 2) ** 2; return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
