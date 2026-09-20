import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth";
import { employeeReport, reportCsv } from "@/server/reporting";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || !["ADMIN", "HR_ADMIN", "AUDITOR"].includes(user.role)) return NextResponse.json({ error: { code: "FORBIDDEN", message: "Payroll export access required." } }, { status: 403 });
  const url = new URL(request.url);
  const from = new Date(url.searchParams.get("from") || new Date(Date.now() - 30 * 86400000).toISOString());
  const to = new Date(url.searchParams.get("to") || new Date().toISOString());
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Invalid date range." } }, { status: 400 });
  const rows = await employeeReport(user, from, to, url.searchParams.get("employeeId") || undefined);
  return new NextResponse("\uFEFF" + reportCsv(rows), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": "attachment; filename=ontyme-payroll-attendance.csv" } });
}
