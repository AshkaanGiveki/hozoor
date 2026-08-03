import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth";
export async function GET() { const user = await getCurrentUser(); if (!user) return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "نیاز به ورود دارید." } }, { status: 401 }); return NextResponse.json({ data: { id:user.id, username:user.username, name:`${user.firstName} ${user.lastName}`, role:user.role, mustChangePassword:user.mustChangePassword, employee:user.employee } }); }
