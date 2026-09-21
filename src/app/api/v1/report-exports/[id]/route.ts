import { NextResponse } from "next/server";
import { audit } from "@/server/audit";
import { getCurrentUser } from "@/server/auth";
import { db } from "@/server/db";
import { readPrivateFile } from "@/server/file-storage";

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Login required." } }, { status: 401 });
  const { id } = await context.params;
  const exportRecord = await db.reportExport.findFirst({ where: { id, companyId: user.companyId } });
  if (!exportRecord) return NextResponse.json({ error: { code: "NOT_FOUND", message: "Export not found." } }, { status: 404 });
  try {
    const file = await readPrivateFile(exportRecord.storageName);
    await audit({ companyId: user.companyId, actorId: user.id, action: "report.export.download", entityType: "ReportExport", entityId: id, after: { reportType: exportRecord.reportType, checksum: exportRecord.checksum } });
    return new NextResponse(file, { headers: { "Content-Type": exportRecord.filename.endsWith(".xlsx") ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${exportRecord.filename}"`, "X-Export-Checksum": exportRecord.checksum } });
  } catch {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Export file is unavailable." } }, { status: 404 });
  }
}
