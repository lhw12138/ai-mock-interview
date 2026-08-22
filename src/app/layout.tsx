import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI 面试模拟助手",
  description: "面向中国产品经理求职者的 AI 模拟面试工具，支持语音与文字作答。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  );
}
