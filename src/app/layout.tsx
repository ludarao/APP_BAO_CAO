import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Cổng báo cáo · PX03",
  description: "Nhập và tổng hợp số liệu báo cáo đơn vị",
  icons: { icon: "/icon.svg" },
};
export default function Layout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
