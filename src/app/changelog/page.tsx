import Link from "next/link";
import { CHANGELOG, APP_VERSION } from "@/lib/version";

export const dynamic = "force-dynamic";

const typeStyles: Record<"major" | "minor" | "patch", string> = {
  major: "bg-red-500/10 text-red-400 border-red-500/30",
  minor: "bg-gold/10 text-gold border-gold/30",
  patch: "bg-blue-500/10 text-blue-400 border-blue-500/30",
};

export default function ChangelogPage() {
  return (
    <div className="min-h-screen bg-background py-12">
      <div className="mx-auto w-full max-w-3xl px-6">
        <header className="mb-10 flex items-end justify-between">
          <div>
            <Link
              href="/login"
              className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground/60 hover:text-muted-foreground"
            >
              &larr; voltar
            </Link>
            <h1 className="mt-2 font-display text-3xl font-bold text-gold">
              Novidades
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Historico de versoes do CliniFunnel
            </p>
          </div>
          <span className="rounded-md border border-gold/30 bg-gold/10 px-3 py-1 text-xs font-medium text-gold">
            atual: v{APP_VERSION}
          </span>
        </header>

        <ol className="space-y-8">
          {CHANGELOG.map((entry) => (
            <li
              key={entry.version}
              className="rounded-lg border border-white/5 bg-white/[0.02] p-5"
            >
              <div className="mb-3 flex flex-wrap items-center gap-3">
                <span className="font-display text-lg font-bold text-foreground">
                  v{entry.version}
                </span>
                <span
                  className={`rounded border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${typeStyles[entry.type]}`}
                >
                  {entry.type}
                </span>
                <span className="text-xs text-muted-foreground">
                  {entry.date}
                </span>
              </div>
              <ul className="space-y-1.5 text-sm text-foreground/80">
                {entry.changes.map((change, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="mt-1.5 inline-block h-1 w-1 flex-shrink-0 rounded-full bg-gold/60" />
                    <span>{change}</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
