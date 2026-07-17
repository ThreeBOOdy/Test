import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "知练 · 分级智能刷题", template: "%s · 知练" },
  description: "按等级和知识点随机练习的学生题库系统",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = { themeColor: "#16766f", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
