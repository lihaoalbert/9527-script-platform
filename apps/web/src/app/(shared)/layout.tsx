"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { Gauge, Sparkles, BookOpen, WalletCards, ShieldCheck, LogOut } from "lucide-react";
import { useAuth } from "../auth-context";

const navItems = [
  { href: "/dashboard", icon: Gauge, label: "工作台" },
  { href: "/studio", icon: Sparkles, label: "AI创作" },
  { href: "/scripts", icon: BookOpen, label: "剧本库" },
  { href: "/credits", icon: WalletCards, label: "积分" },
  { href: "/admin", icon: ShieldCheck, label: "后台" },
];

export default function SharedLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, token, logout } = useAuth();

  useEffect(() => {
    if (!token) {
      router.push("/login");
    }
  }, [token, router]);

  if (!token || !user) {
    return (
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        minHeight: "100vh", background: "var(--bg)",
      }}>
        <p style={{ color: "var(--muted)" }}>加载中...</p>
      </div>
    );
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brandMark">9527</span>
          <div>
            <strong>剧本平台</strong>
            <small>短剧创作与版权运营</small>
          </div>
        </div>
        <nav>
          {navItems.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={isActive ? "active" : ""}
              >
                <item.icon size={18} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div style={{ marginTop: "auto", paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.1)" }}>
          <div style={{ padding: "8px 12px", fontSize: 13, color: "#d2d8d2" }}>
            {user.name}
          </div>
          <button
            onClick={logout}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "8px 12px", background: "transparent",
              border: 0, borderRadius: 8, cursor: "pointer",
              color: "#d2d8d2", fontSize: 12, width: "100%",
              minHeight: "auto",
            }}
          >
            <LogOut size={14} /> 退出登录
          </button>
        </div>
      </aside>
      <section className="content">{children}</section>
    </div>
  );
}
