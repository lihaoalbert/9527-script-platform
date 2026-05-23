"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { Gauge, Sparkles, BookOpen, WalletCards, ShieldCheck, LogOut, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { AuthProvider, useAuth } from "./auth-context";

const PUBLIC_PATHS = ["/login"];
const navItems = [
  { href: "/dashboard", icon: Gauge, label: "工作台" },
  { href: "/studio", icon: Sparkles, label: "AI创作" },
  { href: "/scripts", icon: BookOpen, label: "剧本库" },
  { href: "/credits", icon: WalletCards, label: "积分" },
  { href: "/admin", icon: ShieldCheck, label: "后台" },
];

function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, token, logout } = useAuth();
  const isPublic = PUBLIC_PATHS.includes(pathname);
  const [collapsed, setCollapsed] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!isPublic && !token) {
      router.push("/login");
    } else {
      setReady(true);
    }
  }, [isPublic, token, router]);

  if (isPublic) return <>{children}</>;

  if (!ready) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "var(--bg)" }}>
        <p style={{ color: "var(--muted)" }}>加载中...</p>
      </div>
    );
  }

  if (!token || !user) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "var(--bg)" }}>
        <p style={{ color: "var(--muted)" }}>加载中...</p>
      </div>
    );
  }

  return (
    <div className={`shell ${collapsed ? "shellCollapsed" : ""}`}>
      <aside className={`sidebar ${collapsed ? "collapsed" : ""}`}>
        {collapsed ? (
          <div className="brand" style={{ justifyContent: "center", padding: "12px 0" }}>
            <span className="brandMark">95</span>
          </div>
        ) : (
          <div className="brand">
            <span className="brandMark">9527</span>
            <div>
              <strong>剧本平台</strong>
              <small>短剧创作与版权运营</small>
            </div>
          </div>
        )}
        <nav>
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link key={item.href} href={item.href} className={isActive ? "active" : ""} title={item.label}>
                <item.icon size={18} />
                {!collapsed && item.label}
              </Link>
            );
          })}
        </nav>
        {!collapsed && (
          <div style={{ marginTop: "auto", paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.1)" }}>
            <div style={{ padding: "8px 12px", fontSize: 13, color: "#d2d8d2" }}>{user.name}</div>
            <button onClick={logout} style={{
              display: "flex", alignItems: "center", gap: 8, padding: "8px 12px",
              background: "transparent", border: 0, borderRadius: 8, cursor: "pointer",
              color: "#d2d8d2", fontSize: 12, width: "100%", minHeight: "auto",
            }}>
              <LogOut size={14} /> 退出登录
            </button>
          </div>
        )}
      </aside>
      <section className="content">{children}</section>
      <button className="sidebarToggle" onClick={() => setCollapsed(!collapsed)}
        title={collapsed ? "展开侧栏" : "收起侧栏"}>
        {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
      </button>
    </div>
  );
}

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <Shell>{children}</Shell>
    </AuthProvider>
  );
}
