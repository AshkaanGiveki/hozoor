import { RoleCode } from "@prisma/client";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth";
import { db } from "@/server/db";
import { savePrivateFile } from "@/server/file-storage";

const allowed = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp", "text/plain"]);

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user?.employee) return NextResponse.json({ error: { code: "FORBIDDEN", message: "Employee account required." } }, { status: 403 });
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "File is required." } }, { status: 400 });
  if (file.size > 10 * 1024 * 1024 || !allowed.has(file.type)) return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Unsupported file or file size." } }, { status: 400 });
  const storageName = await savePrivateFile(file);
  const attachment = await db.fileAttachment.create({ data: { companyId: user.companyId, originalName: file.name.slice(0, 200), storageName, mimeType: file.type, size: file.size } });
  return NextResponse.json({ data: attachment }, { status: 201 });
}
