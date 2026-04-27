"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/theme-provider";
import { APP_VERSION } from "@/lib/version";

const navItems = [
  { href: "/dashboard", label: "Visao Geral", icon: "BarChart3" },
  { href: "/dashboard/leads", label: "Leads", icon: "Users" },
  { href: "/dashboard/campaigns", label: "Campanhas", icon: "Megaphone" },
  { href: "/dashboard/procedures", label: "Procedimentos", icon: "ClipboardCheck" },
  { href: "/dashboard/ltv", label: "LTV & ROAS", icon: "TrendingUp" },
  { href: "/dashboard/patients", label: "Pacientes", icon: "UserCheck" },
  { href: "/dashboard/financeiro", label: "Financeiro", icon: "DollarSign" },
  { href: "/dashboard/settings", label: "Configuracoes", icon: "Settings" },
];

const iconMap: Record<string, string> = {
  BarChart3: "M3 3v18h18M9 17V9m4 8V5m4 12v-4",
  Users: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
  Megaphone: "m3 11 18-5v12L3 13v-2zm0 0V7a2 2 0 0 1 2-2h2m14 4v6m-4-3h.01",
  ClipboardCheck: "M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2M9 5h6m-5 4 2 2 4-4",
  TrendingUp: "M22 7l-8.5 8.5-5-5L2 17",
  UserCheck: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM16 11l2 2 4-4",
  DollarSign: "M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6",
  Terminal: "m4 17 6-6-6-6m8 14h6",
  Settings: "M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z",
};

function NavIcon({ name, className }: { name: string; className?: string }) {
  const d = iconMap[name];
  if (!d) return null;
  return (
    <svg className={cn("h-[18px] w-[18px]", className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
      {name === "Settings" && <circle cx="12" cy="12" r="3" />}
    </svg>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();

  return (
    <aside className="flex h-screen w-60 flex-col bg-sidebar">
      {/* Logo */}
      <div className="flex items-center gap-2 px-6 py-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gold/20">
          <span className="text-sm font-bold text-gold">CF</span>
        </div>
        <div>
          <h1 className="font-display text-sm font-bold text-gold">CliniFunnel</h1>
          <p className="text-[10px] uppercase tracking-[0.15em] text-sidebar-foreground/50">Precision Analytics</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-0.5 px-3 pt-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-all duration-200",
                isActive
                  ? "text-gold"
                  : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-white/5"
              )}
            >
              {isActive && (
                <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-gold" />
              )}
              <NavIcon name={item.icon} className={isActive ? "text-gold" : "text-sidebar-foreground/40 group-hover:text-sidebar-foreground/70"} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="space-y-3 px-4 pb-5">
        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[12px] text-sidebar-foreground/40 transition-colors hover:text-sidebar-foreground/70 hover:bg-white/5"
        >
          {theme === "dark" ? (
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="5"/><path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.73 12.73 1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
          ) : (
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
          )}
          <span>{theme === "dark" ? "Modo Claro" : "Modo Escuro"}</span>
        </button>

        <div className="px-3">
          <p className="text-[10px] uppercase tracking-wider text-sidebar-foreground/30">
            CliniFunnel v{APP_VERSION}
          </p>
        </div>
      </div>
    </aside>
  );
}
