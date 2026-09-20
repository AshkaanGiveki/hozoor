import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { reportCsv } from "@/server/reporting";
import { savePrivateBuffer } from "@/server/file-storage";

export async function POST(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  if (!process.env.CRON_SECRET || token !== process.env.CRON_SECRET) return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Invalid scheduler credentials." } }, { status: 401 });
  const body = await request.json().catch(() => ({})) as { companyId?: string; from?: string; to?: string };
  if (!body.companyId) return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "companyId is required." } }, { status: 400 });
  const from = new Date(body.from || new Date(Date.now() - 30 * 86400000).toISOString()); const to = new Date(body.to || new Date().toISOString());
  const creator = await db.user.findFirst({ where: { companyId: body.companyId, role: "ADMIN", status: "ACTIVE" }, select: { id: true } });
  if (!creator) return NextResponse.json({ error: { code: "NOT_FOUND", message: "Active administrator not found." } }, { status: 404 });
  const rows = await db.attendanceDay.findMany({ where: { companyId: body.companyId, date: { gte: from, lte: to } }, include: { employee: { include: { department: true, team: true } } }, orderBy: { date: "asc" } });
  const data = rows.map((row) => ({ date: row.date.toISOString().slice(0, 10), employeeCode: row.employee.employeeCode, name: `${row.employee.firstName} ${row.employee.lastName}`, department: row.employee.department?.name || "", team: row.employee.team?.name || "", status: row.status, requiredMinutes: row.requiredMinutes, validWorkMinutes: row.validWorkMinutes, deficitMinutes: row.deficitMinutes, lateMinutes: row.lateMinutes, earlyDepartureMinutes: row.earlyDepartureMinutes, overtimeMinutes: row.calculatedOvertimeMinutes, leaveMinutes: row.leaveMinutes, offTimeMinutes: row.offTimeMinutes, anomalies: row.anomalies }));
  const csv = "\uFEFF" + reportCsv(data); const storageName = await savePrivateBuffer(Buffer.from(csv, "utf8"), ".csv");
  const exportRecord = await db.reportExport.create({ data: { companyId: body.companyId, createdById: creator.id, reportType: "scheduled-attendance", filename: "ontyme-scheduled-attendance.csv", storageName, filters: { from: from.toISOString(), to: to.toISOString() } } });
  return NextResponse.json({ data: { id: exportRecord.id, rows: data.length, filename: exportRecord.filename } }, { status: 201 });
}
