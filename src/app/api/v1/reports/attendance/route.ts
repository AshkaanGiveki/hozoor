import * as XLSX from "xlsx";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth";
import { employeeReport, reportCsv } from "@/server/reporting";
import { savePrivateBuffer } from "@/server/file-storage";
import { db } from "@/server/db";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || !["ADMIN", "HR_ADMIN", "MANAGER", "AUDITOR"].includes(user.role)) return NextResponse.json({ error: { code: "FORBIDDEN", message: "Report access required." } }, { status: 403 });
  const url = new URL(request.url);
  const from = new Date(url.searchParams.get("from") || new Date(Date.now() - 30 * 86400000).toISOString());
  const to = new Date(url.searchParams.get("to") || new Date().toISOString());
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Invalid report date range." } }, { status: 400 });
  const rows = await employeeReport(user, from, to, url.searchParams.get("employeeId") || undefined);
  const format = url.searchParams.get("format");
  if (format === "csv") return new NextResponse("\uFEFF" + reportCsv(rows), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": "attachment; filename=ontyme-attendance.csv" } });
  if (format === "xlsx") {
    const sheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "Attendance");
    const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "buffer" });
    const storageName = await savePrivateBuffer(buffer, ".xlsx");
    await db.reportExport.create({ data: { companyId: user.companyId, createdById: user.id, reportType: "attendance", filename: "ontyme-attendance.xlsx", storageName, filters: { from: from.toISOString(), to: to.toISOString(), employeeId: url.searchParams.get("employeeId") } } });
    return new NextResponse(buffer, { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": "attachment; filename=ontyme-attendance.xlsx" } });
  }
  return NextResponse.json({ data: rows, meta: { from, to, count: rows.length } });
}
