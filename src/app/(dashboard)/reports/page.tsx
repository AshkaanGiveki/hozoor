import { getCurrentUser } from "@/server/auth"; import { employeeReport } from "@/server/reporting"; import ReportsClient from "@/components/ReportsClient";
export default async function Reports(){const user=await getCurrentUser();if(!user)return null;const rows=await employeeReport(user,new Date(Date.now()-30*86400000),new Date());return <ReportsClient initial={rows}/>} 
