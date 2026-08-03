import { redirect } from "next/navigation"; import AppShell from "@/components/AppShell"; import { getCurrentUser } from "@/server/auth";
export default async function DashboardLayout({children}:{children:React.ReactNode}){const user=await getCurrentUser();if(!user)redirect("/login");if(user.mustChangePassword)redirect("/change-password");return <AppShell user={user}>{children}</AppShell>}
