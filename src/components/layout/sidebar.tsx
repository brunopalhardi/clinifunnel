"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Visao Geral", icon: "📊" },
  { href: "/dashboard/leads", label: "Leads", icon: "👤" },
  { href: "/dashboard/campaigns", label: "Campanhas", icon: "📢" },
  { href: "/dashboard/procedures", label: "Procedimentos", icon: "🦷" },
  { href: "/dashboard/logs", label: "Webhook Logs", icon: "📋" },
  { href: "/dashboard/settings", label: "Configuracoes", icon: "⚙️" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-64 flex-col border-r bg-card">
      <div className="flex h-16 items-center border-b px-6">
        <h1 className="text-xl font-bold">CliniFunnel</h1>
      </div>
      <nav className="flex-1 space-y-1 p-4">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
              pathname === item.href
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
          >
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>
      <div className="border-t p-4">
        <p className="text-xs text-muted-foreground">CliniFunnel v0.9.0</p>
      </div>
    </aside>
  );
}
