import "./globals.scss";
import type { Metadata } from "next";
export const metadata: Metadata = { title: "سامانه حضور و مرخصی", description: "مدیریت حضور، مرخصی و زمان کاری" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="fa" dir="rtl"><body>{children}</body></html>; }
