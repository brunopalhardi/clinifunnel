"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { APP_VERSION } from "@/lib/version";

export function LoginShell({ children }: { children: ReactNode }) {
  return (
    <div className="bg-hero bg-grid-overlay relative flex min-h-screen items-center justify-center overflow-hidden px-4">
      <span className="absolute left-4 top-4 z-10 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        PT-BR
      </span>
      <div className="absolute right-4 top-4 z-10">
        <ThemeToggle />
      </div>

      <div className="relative z-10 w-full max-w-sm">{children}</div>

      <footer className="absolute bottom-4 left-0 right-0 flex justify-center">
        <Link
          href="/changelog"
          className="text-[10px] font-semibold uppercase tracking-[0.10em] text-muted-foreground transition-colors hover:text-foreground"
        >
          CliniFunnel v{APP_VERSION} · novidades
        </Link>
      </footer>
    </div>
  );
}
