import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth";
import { db } from "@/server/db";
import { readPrivateFile } from "@/server/file-storage";

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Login required." } }, { status: 401 });
  const { id } = await context.params;
  const attachment = await db.fileAttachment.findFirst({ where: { id, companyId: user.companyId } });
  if (!attachment) return NextResponse.json({ error: { code: "NOT_FOUND", message: "Attachment not found." } }, { status: 404 });
  try { return new NextResponse(await readPrivateFile(attachment.storageName), { headers: { "Content-Type": attachment.mimeType, "Content-Disposition": `inline; filename="${attachment.originalName.replace(/[^a-zA-Z0-9._-]/g, "_")}"` } }); } catch { return NextResponse.json({ error: { code: "NOT_FOUND", message: "Attachment file is unavailable." } }, { status: 404 }); }
}
