"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { APP_VERSION } from "@/lib/version";

// [DASH-5] Dashboard dividido em 2 paginas principais:
// - "Captacao" (Kommo): funil de leads ate procedimento fechado
// - "Operacao" (Clinicorp): caixa + agenda da clinica inteira
// "Visao Geral" e "Financeiro" antigos foram substituidos por redirects.
interface NavItem {
  href: string;
  label: string;
  icon: string;
  hidden?: boolean;
}

// [DASH-8] LTV & ROAS e Campanhas ocultos do menu via hidden: true. Rotas
// continuam funcionais por URL direta — voltam ao menu quando comecarem os
// anuncios (so remover a flag).
const navItems: NavItem[] = [
  { href: "/dashboard/painel", label: "Painel Principal", icon: "LayoutDashboard" },
  { href: "/dashboard/captacao", label: "Captacao", icon: "BarChart3" },
  { href: "/dashboard/operacao", label: "Operacao", icon: "DollarSign" },
  { href: "/dashboard/leads", label: "Leads", icon: "Users" },
  { href: "/dashboard/campaigns", label: "Campanhas", icon: "Megaphone", hidden: true },
  { href: "/dashboard/procedures", label: "Procedimentos", icon: "ClipboardCheck" },
  { href: "/dashboard/ltv", label: "LTV & ROAS", icon: "TrendingUp", hidden: true },
  { href: "/dashboard/patients", label: "Pacientes", icon: "UserCheck" },
  { href: "/dashboard/settings", label: "Configuracoes", icon: "Settings" },
];

const iconMap: Record<string, string> = {
  LayoutDashboard: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z",
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
    <svg
      className={cn("h-[18px] w-[18px]", className)}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={d} />
      {name === "Settings" && <circle cx="12" cy="12" r="3" />}
    </svg>
  );
}

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-60 flex-col border-r border-sidebar-foreground/10 bg-sidebar text-sidebar-foreground">
      <div className="px-5 pb-2 pt-5">
        <h1 className="font-display text-[20px] font-extrabold leading-none tracking-[-0.03em]">
          Clini<span className="text-primary">Funnel</span>
        </h1>
        <p className="mt-1.5 text-[8px] font-bold uppercase tracking-[0.22em] text-sidebar-foreground/40">
          Painel Clínico
        </p>
      </div>

      <nav className="flex-1 space-y-0.5 px-3 pt-5">
        {navItems.filter((i) => !i.hidden).map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-colors",
                isActive
                  ? "bg-primary/[0.12] font-semibold text-primary"
                  : "text-sidebar-foreground/60 hover:bg-sidebar-foreground/[0.05] hover:text-sidebar-foreground"
              )}
            >
              {isActive && (
                <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-primary" />
              )}
              <NavIcon
                name={item.icon}
                className={
                  isActive
                    ? "text-primary"
                    : "text-sidebar-foreground/40 group-hover:text-sidebar-foreground/70"
                }
              />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-foreground/10 px-5 pb-5 pt-3">
        <Link
          href="/changelog"
          className="block text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40 transition-colors hover:text-sidebar-foreground/70"
        >
          CliniFunnel v{APP_VERSION} · novidades
        </Link>
      </div>
    </aside>
  );
}
