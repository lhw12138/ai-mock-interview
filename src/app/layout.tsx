import type { Metadata } from "next";
import { FeedbackLauncher } from "@/components/feedback-launcher";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI 面试模拟助手",
  description:
    "面向求职者的 AI 模拟面试工具，覆盖产品与技术岗位，支持语音与文字作答、多维能力评分与逐题改进建议。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">
        {children}
        <FeedbackLauncher />
        {process.env.NODE_ENV === "production" && (
          <script
            async
            src="https://hm.baidu.com/hm.js?a650d747ca84cbab28e308e3bb99e71a"
          />
        )}
      </body>
    </html>
  );
}
