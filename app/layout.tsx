import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "波段研习 · 无线电考证智能题库", template: "%s · 波段研习" },
  description: "面向无线电考证的分等级、分知识点智能刷题与题库管理系统",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = { themeColor: "#071727", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
