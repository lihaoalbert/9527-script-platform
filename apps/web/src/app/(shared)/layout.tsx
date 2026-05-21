"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { Gauge, Sparkles, BookOpen, WalletCards, ShieldCheck } from "lucide-react";

const navItems = [
  { href: "/dashboard", icon: Gauge, label: "工作台" },
  { href: "/studio", icon: Sparkles, label: "AI创作" },
  { href: "/scripts", icon: BookOpen, label: "剧本库" },
  { href: "/credits", icon: WalletCards, label: "积分" },
  { href: "/admin", icon: ShieldCheck, label: "后台" },
];

export default function SharedLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

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
      </aside>
      <section className="content">{children}</section>
    </div>
  );
}