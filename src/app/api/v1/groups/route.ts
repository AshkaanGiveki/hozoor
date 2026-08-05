import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/server/auth";
import { db } from "@/server/db";
const schema = z.object({ name: z.string().trim().min(1).max(80) });
export async function GET() { const user = await getCurrentUser(); if (!user) return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "برای ادامه وارد شوید." } }, { status: 401 }); return NextResponse.json({ data: await db.attendanceGroup.findMany({ where: { companyId: user.companyId, active: true }, orderBy: { name: "asc" } }) }); }
export async function POST(request: Request) { const user = await getCurrentUser(); if (!user || !["ADMIN", "HR_ADMIN"].includes(user.role)) return NextResponse.json({ error: { code: "FORBIDDEN", message: "دسترسی کافی ندارید." } }, { status: 403 }); const parsed = schema.safeParse(await request.json().catch(() => ({}))); if (!parsed.success) return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "نام گروه معتبر نیست." } }, { status: 400 }); try { const group = await db.attendanceGroup.create({ data: { companyId: user.companyId, name: parsed.data.name } }); return NextResponse.json({ data: group }, { status: 201 }); } catch { return NextResponse.json({ error: { code: "CONFLICT", message: "این گروه قبلاً ایجاد شده است." } }, { status: 409 }); } }
