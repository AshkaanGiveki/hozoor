import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth";
import { db } from "@/server/db";
export async function GET(){const user=await getCurrentUser();if(!user)return NextResponse.json({error:{code:"UNAUTHENTICATED",message:"نیاز به ورود دارید."}},{status:401});return NextResponse.json({data:await db.notification.findMany({where:{userId:user.id},orderBy:{createdAt:"desc"},take:30})});}
