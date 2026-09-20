import { RoleCode } from "@prisma/client";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth";
import { db } from "@/server/db";

export async function GET() { const user = await getCurrentUser(); if (!user || (user.role !== RoleCode.ADMIN && user.role !== RoleCode.HR_ADMIN && user.role !== RoleCode.AUDITOR)) return NextResponse.json({ error: { code: "FORBIDDEN", message: "Report export access required." } }, { status: 403 }); return NextResponse.json({ data: await db.reportExport.findMany({ where: { companyId: user.companyId }, orderBy: { createdAt: "desc" }, take: 100, select: { id: true, reportType: true, filename: true, filters: true, createdAt: true, expiresAt: true } }) }); }
