# Redesign Visual — PR2: Sidebar + Header

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aplicar a nova paleta laranja + tokens light/dark (já em produção desde v0.39.0) ao `Sidebar` e `Header`, mover o toggle de tema da sidebar pro header, e migrar os 10 usos de `text-gold`/`bg-gold` desses dois componentes pra `text-primary`/`bg-primary` — zerando a maior fonte do "legado dourado" sem mexer em página interna.

**Architecture:** PR pequeno e focado. Atualiza só 3 arquivos: `globals.css` (token `--sidebar` ganha valor light), `sidebar.tsx` (brand wordmark + nav atualizado + remove toggle + remove imports legados), `header.tsx` (importa `<ThemeToggle/>` + avatar com gradiente + sticky+blur). Nenhuma dependência nova, nenhum componente novo.

**Tech Stack:** Next.js 14 (App Router) · React 18 · Tailwind 3.4 · shadcn/ui · `lucide-react` (já dep) · `ThemeToggle` (já criado no PR1)

**Spec:** [`docs/superpowers/specs/2026-05-12-redesign-visual-sidebar-header-design.md`](../specs/2026-05-12-redesign-visual-sidebar-header-design.md)

---

## File Structure

**Modificar:**
- `src/app/globals.css` — atualizar tokens `--sidebar` e `--sidebar-foreground` em `:root` (light) e `.dark` (dark)
- `src/components/layout/sidebar.tsx` — refator visual completo (brand wordmark, nav, footer simplificado)
- `src/components/layout/header.tsx` — refator visual (sticky+blur, avatar gradiente, ThemeToggle integrado)
- `package.json` — bump `0.39.0` → `0.40.0`
- `src/lib/version.ts` — bump `APP_VERSION` + nova entrada no `CHANGELOG`
- `docs/IMPROVEMENTS.md` — item movido pra "Concluidos"

**NÃO mexer:**
- `src/components/layout/theme-toggle.tsx` (já existe, ok)
- `src/components/theme-provider.tsx` (API estável)
- `src/app/dashboard/layout.tsx` (já usa `flex h-screen` sem fundo hardcoded — não precisa)
- Qualquer arquivo em `src/app/dashboard/**` (PR3+)
- `tailwind.config.ts` (todos os tokens necessários já existem)

---

## Task 0: Worktree e branch

- [ ] **Step 1: Criar worktree do main remoto atualizado**

```bash
cd /Users/macintosh/Documents/Claude.Code/clinifunnel
git fetch origin
git worktree add -b feat/visual-redesign-pr2-sidebar-header ../clinifunnel-feat-visual-pr2 origin/main
cd ../clinifunnel-feat-visual-pr2
```

Esperado: worktree em `../clinifunnel-feat-visual-pr2`, branch `feat/visual-redesign-pr2-sidebar-header` apontando pro `9b889bd` (v0.39.0).

- [ ] **Step 2: Instalar deps e gerar Prisma client**

```bash
npm ci
npx prisma generate
```

- [ ] **Step 3: Confirmar baseline verde**

```bash
npm run lint
npx tsc --noEmit
npm test
```

Esperado: lint clean, tsc clean, 169 tests pass.

- [ ] **Step 4: Copiar spec + plan pra worktree se não tiver**

```bash
ls docs/superpowers/specs/2026-05-12-redesign-visual-sidebar-header-design.md 2>/dev/null
ls docs/superpowers/plans/2026-05-12-redesign-visual-pr2-sidebar-header.md 2>/dev/null
```

Se algum não existir (porque foram criados após o `worktree add`):
```bash
cp ../clinifunnel/docs/superpowers/specs/2026-05-12-redesign-visual-sidebar-header-design.md docs/superpowers/specs/
cp ../clinifunnel/docs/superpowers/plans/2026-05-12-redesign-visual-pr2-sidebar-header.md docs/superpowers/plans/
```

- [ ] **Step 5: Commit inicial (spec + plan)**

```bash
git add docs/superpowers/
git commit -m "docs: spec e plano do redesign visual PR2 (sidebar + header)"
```

---

## Task 1: Token `--sidebar` ganha valor light

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1: Atualizar `:root` (light)**

Em `src/app/globals.css`, dentro do bloco `:root { ... }` (Light Mode — Papel Quente), localizar a linha:

```css
    --sidebar: 240 14% 7%;
    --sidebar-foreground: 0 0% 90%;
```

Substituir por:

```css
    --sidebar: 38 32% 89%;
    --sidebar-foreground: 36 25% 25%;
```

- [ ] **Step 2: Atualizar `.dark` (sem mudança real, só garantir valores)**

Dentro do bloco `.dark { ... }` (Dark Mode — Carvão Glow), localizar:

```css
    --sidebar: 240 12% 8%;
    --sidebar-foreground: 270 5% 80%;
```

(Pode estar com valores ligeiramente diferentes do PR1.) Substituir por:

```css
    --sidebar: 240 14% 5%;
    --sidebar-foreground: 0 0% 88%;
```

- [ ] **Step 3: Validar**

```bash
npm run lint
npx tsc --noEmit
```

Esperado: ambos verdes (CSS não tem tsc, mas garantia de que nada quebrou).

- [ ] **Step 4: Commit**

```bash
git add src/app/globals.css
git commit -m "feat: token --sidebar ganha valor light (papel quente); dark refinado"
```

---

## Task 2: Refazer `src/components/layout/sidebar.tsx`

**Files:**
- Modify: `src/components/layout/sidebar.tsx`

- [ ] **Step 1: Substituir o arquivo inteiro**

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
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
        {navItems.map((item) => {
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
```

- [ ] **Step 2: Validar tipos e lint**

```bash
npx tsc --noEmit
npm run lint
```

Esperado: ambos verdes. Importante: confirmar que `useTheme` foi removido (não há mais import em `sidebar.tsx`).

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/sidebar.tsx
git commit -m "refactor: sidebar usa tokens novos (papel/carvao), brand wordmark, sem toggle de tema"
```

---

## Task 3: Refazer `src/components/layout/header.tsx`

**Files:**
- Modify: `src/components/layout/header.tsx`

- [ ] **Step 1: Substituir o arquivo inteiro**

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useClinic } from "@/hooks/use-clinic";
import { ThemeToggle } from "@/components/layout/theme-toggle";

const pageNames: Record<string, string> = {
  "/dashboard": "Visao Geral",
  "/dashboard/leads": "Leads",
  "/dashboard/campaigns": "Campanhas",
  "/dashboard/procedures": "Procedimentos",
  "/dashboard/logs": "Webhook Logs",
  "/dashboard/settings": "Configuracoes",
};

function formatRelative(iso: string | null): string | null {
  if (!iso) return null;
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return null;
  const diffMs = Date.now() - ts;
  if (diffMs < 0) return "agora";
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return "agora";
  const min = Math.floor(sec / 60);
  if (min < 60) return `ha ${min}min`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `ha ${hr}h`;
  const days = Math.floor(hr / 24);
  return `ha ${days}d`;
}

export function Header() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const { clinic, clinics, isSuperAdmin, selectClinic } = useClinic();
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [, setTick] = useState(0);

  const pageName = pageNames[pathname] || "Dashboard";

  const fetchSyncStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/sync/status", { cache: "no-store" });
      if (!res.ok) return;
      const json = await res.json();
      const last =
        [json?.data?.lastSyncAt, json?.data?.lastMatchAt]
          .filter((x): x is string => Boolean(x))
          .sort()
          .pop() ?? null;
      setLastSyncAt(last);
    } catch {
      // silencioso
    }
  }, []);

  useEffect(() => {
    fetchSyncStatus();
    const refetch = setInterval(fetchSyncStatus, 60_000);
    const repaint = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => {
      clearInterval(refetch);
      clearInterval(repaint);
    };
  }, [fetchSyncStatus]);

  async function handleSync() {
    setSyncing(true);
    setSyncMsg("");
    try {
      const res = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "all" }),
      });
      setSyncMsg(res.ok ? "Sincronizado" : "Erro");
      if (res.ok) setTimeout(fetchSyncStatus, 5_000);
    } catch {
      setSyncMsg("Erro");
    }
    setSyncing(false);
    setTimeout(() => setSyncMsg(""), 3000);
  }

  const relative = formatRelative(lastSyncAt);

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background/85 px-6 backdrop-blur-md">
      <div className="flex items-center gap-2 text-sm">
        {isSuperAdmin && clinics.length >= 1 ? (
          <select
            value={clinic?.id ?? ""}
            onChange={(e) => selectClinic(e.target.value)}
            className="rounded-md border border-border bg-card px-2 py-1 font-display text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            {clinics.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        ) : (
          <span className="font-display font-semibold">{clinic?.name ?? "Dashboard"}</span>
        )}
        <span className="text-muted-foreground/40">/</span>
        <span className="text-muted-foreground">{pageName}</span>
      </div>
      <div className="flex items-center gap-3">
        {syncMsg && <span className="text-xs text-success">{syncMsg}</span>}
        {!syncMsg && relative && (
          <span
            className="text-xs text-muted-foreground"
            title={
              lastSyncAt
                ? `Ultima sincronizacao: ${new Date(lastSyncAt).toLocaleString("pt-BR")}`
                : undefined
            }
          >
            Atualizado {relative}
          </span>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={handleSync}
          disabled={syncing}
          className="h-8 gap-1.5 text-xs"
        >
          <svg
            className="h-3.5 w-3.5 text-primary"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
            <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
            <path d="M16 16h5v5" />
          </svg>
          {syncing ? "..." : "Sincronizar"}
        </Button>
        <ThemeToggle />
        {session?.user && (
          <>
            <span className="h-5 w-px bg-border" />
            <div className="flex items-center gap-2">
              <div
                className="flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-semibold text-white shadow-[0_2px_8px_hsl(22_100%_55%_/_0.3)]"
                style={{
                  background: "linear-gradient(135deg, hsl(22 100% 55%), hsl(16 100% 55%))",
                }}
              >
                {session.user.name?.charAt(0).toUpperCase() || "U"}
              </div>
              <button
                onClick={async () => {
                  await fetch("/api/logout", { method: "POST" });
                  window.location.href = "/login";
                }}
                className="text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                Sair
              </button>
            </div>
          </>
        )}
      </div>
    </header>
  );
}
```

- [ ] **Step 2: Validar tipos e lint**

```bash
npx tsc --noEmit
npm run lint
```

Esperado: ambos verdes. Confirmar via grep que não sobrou `text-gold`/`bg-gold` em sidebar/header:
```bash
grep -n "gold" src/components/layout/sidebar.tsx src/components/layout/header.tsx
```
Esperado: nenhum resultado (zero usos).

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/header.tsx
git commit -m "feat: header com ThemeToggle, avatar gradiente, sticky+backdrop-blur"
```

---

## Task 4: Build limpo + verificação visual local

**Esta task não tem commit — é verificação obrigatória.**

- [ ] **Step 1: Build de produção**

```bash
npm run build
```

Esperado: build verde, sem warnings novos.

- [ ] **Step 2: Subir dev server**

```bash
PORT=3500 npm run dev
```

(Em background ou em outro shell.) Aguardar "Ready in X.Xs".

- [ ] **Step 3: Conferir `/dashboard` em light**

Logar com admin se necessário. Abrir `http://localhost:3500/dashboard`. Verificar:
- Sidebar com fundo bege papel (~4% mais escuro que o conteúdo)
- Wordmark "Clini**Funnel**" com "Funnel" em laranja
- Microsubtítulo "PAINEL CLÍNICO" em tracking largo, ~8px
- Item "Visao Geral" ativo: texto laranja escuro + fundo laranja translúcido + barra esquerda 3px
- Outros itens em cinza-papel; hover de qualquer um mostra background sutil
- Versão "CliniFunnel v0.40.0 · novidades" no rodapé da sidebar, sem toggle de tema
- Header sticky com backdrop-blur, clinic selector + "/" + "Visao Geral"
- Direita do header: badge "Atualizado há X min", botão "Sincronizar" com ícone laranja, ThemeToggle pill "Light", divider, avatar laranja gradiente, link "Sair"

- [ ] **Step 4: Conferir toggle light → dark**

Clicar no `ThemeToggle`. Esperado:
- Sidebar vira preta carvão (`#0a0a0c`), texto branco/cinza
- Header vira backdrop dark
- Item ativo continua legível (texto `#FF9F5C` em fundo translúcido)
- Avatar continua igual (gradiente laranja)
- Conteúdo da área principal também escurece

Recarregar a página: modo escolhido persiste, sem flash branco no light→dark.

- [ ] **Step 5: Conferir outras telas (regression check)**

Navegar (sidebar) por:
- `/dashboard/leads`
- `/dashboard/campaigns`
- `/dashboard/financeiro`
- `/dashboard/settings`

Cada uma: verificar que (a) sidebar marca o item ativo correto, (b) header mostra o page name correto, (c) layout do conteúdo não regrediu. Os 29 usos restantes de `bg-gold`/`text-gold` dentro dessas páginas seguem aparecendo em laranja (via alias) — esperado.

- [ ] **Step 6: Parar o dev server**

```bash
pkill -f "next dev"
```

---

## Task 5: Versão + CHANGELOG + IMPROVEMENTS

**Files:**
- Modify: `package.json`
- Modify: `src/lib/version.ts`
- Modify: `docs/IMPROVEMENTS.md`

- [ ] **Step 1: Bumpar `package.json`**

Trocar `"version": "0.39.0"` por `"version": "0.40.0"`.

- [ ] **Step 2: Atualizar `src/lib/version.ts`**

Trocar:
```typescript
export const APP_VERSION = "0.39.0";
```
por:
```typescript
export const APP_VERSION = "0.40.0";
```

E adicionar **no topo do array `CHANGELOG`** (antes da entrada `0.39.0`):

```typescript
  {
    version: "0.40.0",
    date: "2026-05-12",
    type: "minor",
    changes: [
      "Visual PR2: sidebar e header repaginados com a paleta laranja. Sidebar agora respira o tema (light = papel quente, dark = preto carvao), antes era sempre escura.",
      "Brand block da sidebar vira wordmark 'CliniFunnel' (Funnel em laranja) com microsubtitulo 'PAINEL CLINICO'. Removido o icone CF quadrado e o subtitulo 'Precision Analytics'.",
      "Item ativo da nav: fundo laranja translucido (12%) + texto laranja escuro + barra lateral 3px. Hover em cinza-papel sutil.",
      "Toggle de tema sai do rodape da sidebar e vira pill no header, junto com Sincronizar + avatar + Sair. Avatar agora tem gradiente laranja + sombra colorida (mesmo tratamento do icone do login).",
      "Header ganha sticky + backdrop-blur sobre o fundo papel/carvao.",
      "Consolidacao bg-gold/text-gold -> bg-primary/text-primary nos 10 usos do sidebar+header. Os 29 usos restantes em paginas internas seguem migrando automatico via alias --gold->--primary; consolidacao definitiva vira nos PRs 3+.",
    ],
  },
```

- [ ] **Step 3: Atualizar `docs/IMPROVEMENTS.md`**

Em "Em andamento", localizar o item `[UX-1] Redesign visual completo (PRs 2-5)` (adicionado no PR1). Atualizar a descrição:

```
- **[UX-1] Redesign visual completo (PRs 3-5)**
  PR1 (login + tokens) entregue em v0.39.0. PR2 (sidebar + header) entregue em v0.40.0. Pendente: PR3 dashboard overview (KPIs + cards), PR4 leads/pacientes/financeiro/etc, PR5 polimento (vazios, erros, formularios). 29 usos de bg-gold/text-gold ainda em paginas internas — consolidados em PR3/4.
  Eixo: produto/ux · Bump: minor por PR
```

Em "Concluidos", **acima** da entrada `[UX-1.1]` existente:

```
- **[UX-1.2] Redesign visual PR2: sidebar + header** — PR #_TBD_ — v0.40.0
  Sidebar e header reaplicados com a paleta laranja. Sidebar agora acompanha o tema (antes sempre escura). Brand vira wordmark, item ativo ganha fundo translucido + barra, toggle de tema migra pra pill no header, avatar com gradiente laranja igual ao login. Header sticky+backdrop-blur. 10 usos de bg-gold/text-gold consolidados em bg-primary/text-primary (sidebar.tsx + header.tsx); 29 restantes em paginas internas seguem via alias ate PR3/4. Token --sidebar ganhou valor light (38 32% 89% papel) + dark refinado (240 14% 5%). Nenhuma mudanca de API de componente; spec em docs/superpowers/specs/2026-05-12-redesign-visual-sidebar-header-design.md.
```

- [ ] **Step 4: Validação final completa**

```bash
npm run lint
npx tsc --noEmit
npm test
npm run build
```

Esperado: todos verdes. 169 tests pass.

- [ ] **Step 5: Commit**

```bash
git add package.json src/lib/version.ts docs/IMPROVEMENTS.md
git commit -m "chore: bump v0.40.0 e changelog do redesign visual PR2"
```

---

## Task 6: Push + abrir PR

- [ ] **Step 1: Push da branch**

```bash
git push -u origin feat/visual-redesign-pr2-sidebar-header
```

- [ ] **Step 2: Abrir PR**

```bash
gh pr create --title "feat: redesign visual PR2 — sidebar + header (v0.40.0)" --body "$(cat <<'EOF'
## Summary

PR2 de 5 do redesign visual. Aplica a paleta laranja aos dois componentes de chrome (sidebar + header) e move o toggle de tema da sidebar pro header.

**Sidebar:**
- Agora respira o tema (antes era sempre escura)
- Brand vira wordmark "Clini**Funnel**" sem ícone, com microsubtítulo "PAINEL CLÍNICO"
- Item ativo: fundo laranja 12% + texto laranja-escuro + barra lateral 3px
- Rodapé só com versão (toggle de tema removido)

**Header:**
- Sticky + backdrop-blur
- Avatar com gradiente laranja + sombra colorida (mesmo do login)
- `<ThemeToggle />` integrado entre Sincronizar e avatar
- Divider entre toggle e avatar

**Consolidação `bg-gold`/`text-gold` → `bg-primary`/`text-primary`:** 10 usos no sidebar+header reescritos. Os 29 restantes em páginas internas seguem migrando automático via alias `--gold` → `--primary` (introduzido no PR1) até consolidação nos PRs 3+.

**Token:** `--sidebar` ganha valor light (`38 32% 89%` = papel quente ~4% mais escuro que o background); dark refinado.

Bump: v0.39.0 → **v0.40.0** (minor).

Spec: `docs/superpowers/specs/2026-05-12-redesign-visual-sidebar-header-design.md`
Plano: `docs/superpowers/plans/2026-05-12-redesign-visual-pr2-sidebar-header.md`

Próximos PRs: dashboard overview (PR3), leads/demais (PR4), polimento (PR5).

## Test plan

- [x] `npm run lint` verde
- [x] `npx tsc --noEmit` verde
- [x] `npm test` verde (169/169)
- [x] `npm run build` verde
- [x] `/dashboard` light: sidebar bege papel + brand wordmark + item ativo com 3 sinais visuais + header sticky + avatar laranja
- [x] `/dashboard` dark: sidebar preto carvão + tudo legível sem flash ao recarregar
- [x] Toggle de tema no header alterna corretamente e persiste
- [x] Páginas internas (leads/campaigns/financeiro/settings) seguem sem regressão visual — `bg-gold`/`text-gold` legado continua aparecendo em laranja via alias
- [ ] **Bruno revisa visualmente em produção após merge** em https://clinifunnel.koaai.com.br/dashboard

## Riscos

- Sidebar light pode ficar parecida demais com o conteúdo principal. Mitigação: `border-r border-sidebar-foreground/10` + bg ~4% mais escuro garante separação. Verificado no companion + browser local.
- Remoção do toggle da sidebar quebra muscle memory (era no rodapé). Mitigação: substituto bem visível no header.
EOF
)"
```

- [ ] **Step 3: Aguardar CI verde**

```bash
gh pr checks --watch
```

(Ou monitorar manualmente com `gh pr checks <numero>`.)

- [ ] **Step 4: Squash merge (apenas após review por Bruno)**

```bash
gh pr merge --squash --delete-branch
```

- [ ] **Step 5: Confirmar deploy disparado**

```bash
gh run list --branch main --limit 3
```

Esperado: run de `Deploy to VPS` rodando. Se não disparou em 5 min, dispatch manual: `gh workflow run deploy.yml --ref main`.

- [ ] **Step 6: Healthcheck pós-deploy**

```bash
curl -sS https://clinifunnel.koaai.com.br/api/health | head -c 200
```
Esperado: `{"status":"ok","version":"0.40.0",...}`. Abrir https://clinifunnel.koaai.com.br/dashboard e confirmar visual em produção.

- [ ] **Step 7: Limpar worktree local**

```bash
cd /Users/macintosh/Documents/Claude.Code/clinifunnel
git worktree remove ../clinifunnel-feat-visual-pr2
git branch -d feat/visual-redesign-pr2-sidebar-header || git branch -D feat/visual-redesign-pr2-sidebar-header
```

---

## Notas finais

- **Foco do PR2:** sidebar + header. Nenhuma página interna muda nessa PR — só absorve o laranja via alias.
- **Sem novos tokens.** Os 6 existentes do PR1 (`--background`, `--card`, `--primary`, `--border`, `--foreground`, `--muted-foreground`) já cobrem tudo. Só `--sidebar` ganhou valor light.
- **Sem testes novos.** Visual é verificado no browser local + screenshot na PR. ThemeToggle (componente que migra pro header) já tem cobertura via theme.ts helpers do PR1.
- **Reversibilidade:** rollback = `git revert` da PR + redeploy. Como `--gold` ainda existe como alias, mesmo reverter o PR2 sozinho não quebra nada.
