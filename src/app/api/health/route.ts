import { NextResponse } from "next/server";
import { db } from "@/server/db";
export async function GET() { try { await db.$queryRaw`SELECT 1`; return NextResponse.json({ ok: true, service: "ontyme" }); } catch { return NextResponse.json({ ok: false }, { status: 503 }); } }
