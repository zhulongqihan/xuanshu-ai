import type { Metadata } from "next";
import { AppNavigation } from "@/components/app-navigation";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "玄枢 AI",
    template: "%s | 玄枢 AI",
  },
  description: "可复算、可追溯的个人命理研究工作台",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>
        <a className="skip-link" href="#main-content">跳转到主要内容</a>
        <div className="app-shell">
          <AppNavigation />
          <main className="app-main" id="main-content">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
