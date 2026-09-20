import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth";
import { db } from "@/server/db";
import { canManagePayroll } from "@/server/payroll";

function escapeHtml(value: unknown) { return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;"); }

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  void request;
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Authentication required", { status: 401 });
  const { id } = await context.params;
  const run = await db.payrollRun.findFirst({ where: { id, publishedAt: { not: null }, period: { companyId: user.companyId, status: { in: ["APPROVED", "PAID", "LOCKED"] } } }, include: { employee: { select: { id: true, employeeCode: true, firstName: true, lastName: true } }, period: { select: { year: true, month: true, status: true } }, lines: true } });
  if (!run || (!canManagePayroll(user.role) && run.employee.id !== user.employee?.id)) return new NextResponse("Payslip not found", { status: 404 });
  const rows = run.lines.map((line) => `<tr><td>${escapeHtml(line.label)}</td><td>${escapeHtml(line.amount.toString())} ریال</td></tr>`).join("");
  const html = `<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><title>پیش‌فیش ${escapeHtml(run.employee.employeeCode)}</title><style>body{font-family:Arial,sans-serif;max-width:800px;margin:40px auto;color:#17212b}header{display:flex;justify-content:space-between;border-bottom:2px solid #17212b;padding-bottom:16px}table{width:100%;border-collapse:collapse;margin-top:28px}td,th{border-bottom:1px solid #ddd;padding:12px;text-align:right}.total{font-weight:700;font-size:18px}@media print{button{display:none}body{margin:0}}</style></head><body><button onclick="window.print()">چاپ / ذخیره PDF</button><header><div><h1>فیش حقوقی</h1><p>دوره ${escapeHtml(`${run.period.year}/${run.period.month}`)}</p></div><div><strong>${escapeHtml(run.employee.firstName)} ${escapeHtml(run.employee.lastName)}</strong><p>کد پرسنلی: ${escapeHtml(run.employee.employeeCode)}</p></div></header><table><thead><tr><th>شرح</th><th>مبلغ</th></tr></thead><tbody>${rows}<tr class="total"><th>حقوق ناخالص</th><th>${escapeHtml(run.grossAmount.toString())} ریال</th></tr><tr class="total"><th>کسورات</th><th>${escapeHtml(run.totalDeductions.toString())} ریال</th></tr><tr class="total"><th>خالص پرداختی</th><th>${escapeHtml(run.netPayable.toString())} ریال</th></tr></tbody></table></body></html>`;
  return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Content-Disposition": `inline; filename="payslip-${run.employee.employeeCode}-${run.period.year}-${run.period.month}.html"` } });
}
