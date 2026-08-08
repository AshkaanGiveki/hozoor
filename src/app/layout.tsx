import "./globals.scss";
import type { Metadata } from "next";
export const metadata: Metadata = { title: "OnTyme", description: "مدیریت حضور، مرخصی و زمان کاری", icons: { icon: "/assets/icon/OnTyme.png" } };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="fa" dir="rtl"><body>{children}</body></html>; }
