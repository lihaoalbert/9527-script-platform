import type { Metadata } from "next";
import { AuthProvider } from "./auth-context";
import "./styles.css";

export const metadata: Metadata = {
  title: "9527剧本平台",
  description: "短剧与漫剧剧本创作、管理和运营平台",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
