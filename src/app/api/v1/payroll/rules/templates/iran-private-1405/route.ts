import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth";
import { canManagePayroll } from "@/server/payroll";
import { iranianPrivateSector1405Rules } from "@/server/iranian-payroll-law";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !canManagePayroll(user.role)) return NextResponse.json({ error: { code: "FORBIDDEN", message: "Payroll administration access required." } }, { status: 403 });
  return NextResponse.json({ data: { name: "Iran private-sector payroll rules", calendarYear: 1405, version: 1, effectiveFrom: "2026-03-21", sourceReference: "IR-1405 wage resolution; Social Security circular; Cabinet Resolution 9234; Labour Law; Direct Taxation Act", rules: iranianPrivateSector1405Rules } });
}
