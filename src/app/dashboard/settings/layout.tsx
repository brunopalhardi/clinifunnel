"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";

interface SubItem {
  label: string;
  href: string;
}

const SUB_ITEMS: SubItem[] = [
  { label: "Integracoes", href: "/dashboard/settings" },
  { label: "Recall por procedimento", href: "/dashboard/settings/recall" },
  { label: "Mapa de profissionais", href: "/dashboard/settings/clinicorp/professionals" },
  { label: "Health automacao", href: "/dashboard/settings/clinicorp/health" },
  { label: "Gerenciar usuarios", href: "/dashboard/settings/users" },
];

export default function SettingsLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/dashboard/settings") {
      // Match exato pra Integracoes (rota raiz das settings)
      return pathname === "/dashboard/settings";
    }
    return pathname === href || pathname.startsWith(href + "/");
  };

  return (
    <div className="flex gap-6">
      <nav className="w-56 shrink-0 space-y-1">
        <h2 className="text-xs font-semibold uppercase text-muted-foreground px-3 pb-2">Configuracoes</h2>
        {SUB_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={
              "block rounded-md px-3 py-2 text-sm font-medium transition-colors " +
              (isActive(item.href)
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground")
            }
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
