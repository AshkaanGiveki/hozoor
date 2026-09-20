import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { recalculateDates } from "@/server/attendance-service";

export async function POST(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  if (!process.env.CRON_SECRET || token !== process.env.CRON_SECRET) return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Invalid scheduler credentials." } }, { status: 401 });
  const body = await request.json().catch(() => ({})) as { companyId?: string; from?: string; to?: string };
  if (!body.companyId) return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "companyId is required." } }, { status: 400 });
  const from = new Date(body.from || new Date(Date.now() - 86400000).toISOString()); const to = new Date(body.to || new Date().toISOString());
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Invalid date range." } }, { status: 400 });
  const employees = await db.employee.findMany({ where: { companyId: body.companyId, active: true }, select: { id: true } });
  const dates: Date[] = []; for (const cursor = new Date(from); cursor <= to; cursor.setUTCDate(cursor.getUTCDate() + 1)) dates.push(new Date(cursor));
  await recalculateDates(body.companyId, employees.map((employee) => employee.id), dates);
  return NextResponse.json({ data: { employees: employees.length, dates: dates.length, recalculated: employees.length * dates.length } });
}
