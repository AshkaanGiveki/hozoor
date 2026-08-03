import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth";
import { db } from "@/server/db";
import { employeeScopeWhere } from "@/server/permissions";
export async function GET(request: Request) { const user=await getCurrentUser(); if(!user) return NextResponse.json({error:{code:"UNAUTHENTICATED",message:"نیاز به ورود دارید."}},{status:401}); const url=new URL(request.url); const from=new Date(url.searchParams.get("from") ?? new Date(Date.now()-30*86400000).toISOString()); const to=new Date(url.searchParams.get("to") ?? new Date().toISOString()); const scope=await employeeScopeWhere(user); const rows=await db.attendanceDay.findMany({where:{companyId:user.companyId,date:{gte:from,lte:to},employee:scope},include:{employee:{select:{employeeCode:true,firstName:true,lastName:true}},policy:{select:{name:true,version:true}}},orderBy:{date:"desc"},take:500}); return NextResponse.json({data:rows,meta:{count:rows.length}}); }
