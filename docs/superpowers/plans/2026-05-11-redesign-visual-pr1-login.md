# Redesign Visual — PR1: Tokens + Login

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir a paleta âmbar/dourada por laranja vivo (#FF7A1A) com light mode "papel quente" e dark mode "carvão glow", e entregar a tela de login redesenhada (glass card + grid + glow + toggle de modo) sem regredir nenhuma das 13 telas que usam o token `gold` legado.

**Architecture:** Tokens viram CSS vars HSL em `src/app/globals.css`. O token `--gold` legado passa a apontar pros mesmos valores de `--primary` (laranja) — assim os 39 usos atuais migram visualmente sem refator. Login vira `LoginShell` (background com glow+grid) + `LoginCard` (glass card) + `ThemeToggle` (botão pill que persiste em localStorage). `/forgot-password` ganha página placeholder.

**Tech Stack:** Next.js 14 (App Router) · React 18 · Tailwind 3.4 · shadcn/ui · CSS vars HSL · Vitest (lib utils) · `localStorage` (sem dependência nova).

**Spec:** [`docs/superpowers/specs/2026-05-11-redesign-visual-design.md`](../specs/2026-05-11-redesign-visual-design.md)

---

## File Structure

**Criar:**
- `src/components/layout/theme-toggle.tsx` — botão pill light/dark, lê e persiste em localStorage
- `src/lib/theme.ts` — helpers puros pra ler/escrever modo (`getStoredTheme`, `applyTheme`, type `ThemeMode`)
- `src/lib/theme.test.ts` — vitest cobrindo os helpers
- `src/components/login/login-shell.tsx` — wrapper full-screen com background (glow + grid + base)
- `src/components/login/login-card.tsx` — glass card com brand mark + form
- `src/app/forgot-password/page.tsx` — placeholder "Em breve"

**Modificar:**
- `src/app/globals.css` — substituir blocos `:root` e `.dark` por nova paleta; redirecionar `--gold` → `--primary`; adicionar utility classes pra fundo glow+grid se útil
- `tailwind.config.ts` — adicionar `boxShadow.glow`, `boxShadow.button`, `borderRadius.xl` se ainda não existir
- `src/app/login/page.tsx` — usar `LoginShell` + `LoginCard`, remover Card antigo do shadcn nesta tela
- `src/app/layout.tsx` (root) — adicionar script inline que aplica `dark` class antes do paint (evita flash)
- `package.json` — bump `0.38.0` → `0.39.0`
- `src/lib/version.ts` — bump `APP_VERSION` + nova entrada no `CHANGELOG`
- `docs/IMPROVEMENTS.md` — item movido pra "Concluidos"

**NÃO mexer (intencional, vai pros PR2+):**
- `src/components/layout/sidebar.tsx`, `header.tsx` (PR2)
- `src/components/dashboard/*` (PR3)
- Páginas de feature em `src/app/dashboard/**` (PR3+)

---

## Task 0: Worktree e branch

- [ ] **Step 1: Criar worktree isolada (a partir do clone principal)**

Rodar do clone principal:
```bash
cd /Users/macintosh/Documents/Claude.Code/clinifunnel
git fetch origin
git checkout main
git pull origin main
git worktree add -b feat/visual-redesign-pr1-login ../clinifunnel-feat-visual-pr1 main
cd ../clinifunnel-feat-visual-pr1
```

Esperado: `git worktree list` mostra os dois paths; estamos em `feat/visual-redesign-pr1-login`.

- [ ] **Step 2: Instalar deps na worktree**

```bash
npm ci
npx prisma generate
```

Esperado: instalação limpa, sem erro.

- [ ] **Step 3: Confirmar baseline verde**

```bash
npm run lint
npx tsc --noEmit
npm test
npm run build
```

Esperado: todos passam (baseline antes de mexer).

- [ ] **Step 4: Copiar spec + plan pra dentro da worktree se ainda não existirem**

Os arquivos `docs/superpowers/specs/2026-05-11-redesign-visual-design.md` e `docs/superpowers/plans/2026-05-11-redesign-visual-pr1-login.md` foram escritos no clone principal. Na worktree:
```bash
ls docs/superpowers/specs/2026-05-11-redesign-visual-design.md
ls docs/superpowers/plans/2026-05-11-redesign-visual-pr1-login.md
```
Se não existirem (criados depois do `worktree add`), copiar:
```bash
cp -r ../clinifunnel/docs/superpowers docs/
```

- [ ] **Step 5: Commit inicial (spec + plan)**

```bash
git add docs/superpowers/
git commit -m "docs: spec e plano do redesign visual (PR1 login)"
```

---

## Task 1: Helpers de tema (TDD)

**Files:**
- Create: `src/lib/theme.ts`
- Test: `src/lib/theme.test.ts`

- [ ] **Step 1: Escrever os testes (vão falhar)**

Criar `src/lib/theme.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import { getStoredTheme, setStoredTheme, resolveTheme, STORAGE_KEY } from "./theme";

describe("theme helpers", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe("getStoredTheme", () => {
    it('retorna "system" quando nada foi salvo', () => {
      expect(getStoredTheme()).toBe("system");
    });

    it('retorna o valor salvo quando valido', () => {
      localStorage.setItem(STORAGE_KEY, "dark");
      expect(getStoredTheme()).toBe("dark");
    });

    it('retorna "system" quando o valor salvo eh invalido', () => {
      localStorage.setItem(STORAGE_KEY, "azul");
      expect(getStoredTheme()).toBe("system");
    });
  });

  describe("setStoredTheme", () => {
    it("salva o modo em localStorage", () => {
      setStoredTheme("dark");
      expect(localStorage.getItem(STORAGE_KEY)).toBe("dark");
    });

    it('remove do storage ao salvar "system"', () => {
      localStorage.setItem(STORAGE_KEY, "dark");
      setStoredTheme("system");
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    });
  });

  describe("resolveTheme", () => {
    it('retorna "light" pra modo light', () => {
      expect(resolveTheme("light", () => false)).toBe("light");
    });

    it('retorna "dark" pra modo dark', () => {
      expect(resolveTheme("dark", () => true)).toBe("dark");
    });

    it('resolve "system" usando o matcher de prefers-color-scheme', () => {
      expect(resolveTheme("system", () => true)).toBe("dark");
      expect(resolveTheme("system", () => false)).toBe("light");
    });
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
npx vitest run src/lib/theme.test.ts
```

Esperado: FAIL — "Cannot find module './theme'".

- [ ] **Step 3: Implementar `src/lib/theme.ts`**

```typescript
export type ThemeMode = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export const STORAGE_KEY = "clinifunnel-theme";

const VALID: readonly ThemeMode[] = ["light", "dark", "system"] as const;

function isValid(value: string): value is ThemeMode {
  return (VALID as readonly string[]).includes(value);
}

export function getStoredTheme(): ThemeMode {
  if (typeof window === "undefined") return "system";
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw && isValid(raw)) return raw;
  return "system";
}

export function setStoredTheme(mode: ThemeMode): void {
  if (typeof window === "undefined") return;
  if (mode === "system") {
    window.localStorage.removeItem(STORAGE_KEY);
  } else {
    window.localStorage.setItem(STORAGE_KEY, mode);
  }
}

export function resolveTheme(
  mode: ThemeMode,
  prefersDark: () => boolean,
): ResolvedTheme {
  if (mode === "light") return "light";
  if (mode === "dark") return "dark";
  return prefersDark() ? "dark" : "light";
}

export function applyTheme(resolved: ResolvedTheme): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.toggle("dark", resolved === "dark");
}
```

- [ ] **Step 4: Rodar testes — esperado verde**

```bash
npx vitest run src/lib/theme.test.ts
```

Esperado: PASS — 8 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/theme.ts src/lib/theme.test.ts
git commit -m "feat: helpers puros de tema (light/dark/system + persistencia)"
```

---

## Task 2: Tokens de design (CSS vars + tailwind)

**Files:**
- Modify: `src/app/globals.css`
- Modify: `tailwind.config.ts`

- [ ] **Step 1: Substituir blocos `:root` e `.dark` em `src/app/globals.css`**

Substituir o conteúdo dos dois blocos abaixo de `@layer base` (mantendo `@import` da fonte e os blocos depois):

```css
@layer base {
  /* Light Mode — Papel Quente */
  :root {
    --background: 38 38% 93%;
    --foreground: 36 35% 13%;
    --card: 40 80% 98%;
    --card-foreground: 36 35% 13%;
    --popover: 40 80% 98%;
    --popover-foreground: 36 35% 13%;
    --primary: 22 100% 55%;
    --primary-foreground: 0 0% 100%;
    --secondary: 40 30% 90%;
    --secondary-foreground: 36 35% 13%;
    --muted: 40 30% 90%;
    --muted-foreground: 36 18% 40%;
    --accent: 22 100% 55%;
    --accent-foreground: 0 0% 100%;
    --destructive: 0 75% 50%;
    --destructive-foreground: 0 0% 100%;
    --success: 160 70% 30%;
    --success-foreground: 0 0% 100%;
    /* --gold redirecionado para --primary: absorve os 39 usos legados sem regressao */
    --gold: 22 100% 55%;
    --gold-foreground: 0 0% 100%;
    --border: 38 35% 83%;
    --input: 38 35% 83%;
    --ring: 22 100% 55%;
    --radius: 0.75rem;
    --sidebar: 240 14% 7%;
    --sidebar-foreground: 0 0% 90%;
  }

  /* Dark Mode — Carvão Glow */
  .dark {
    --background: 240 14% 5%;
    --foreground: 0 0% 100%;
    --card: 240 12% 9%;
    --card-foreground: 0 0% 100%;
    --popover: 240 12% 9%;
    --popover-foreground: 0 0% 100%;
    --primary: 22 100% 55%;
    --primary-foreground: 0 0% 100%;
    --secondary: 240 10% 13%;
    --secondary-foreground: 0 0% 90%;
    --muted: 240 10% 13%;
    --muted-foreground: 240 6% 53%;
    --accent: 22 100% 55%;
    --accent-foreground: 0 0% 100%;
    --destructive: 0 72% 51%;
    --destructive-foreground: 0 0% 100%;
    --success: 160 72% 50%;
    --success-foreground: 0 0% 100%;
    --gold: 22 100% 55%;
    --gold-foreground: 0 0% 100%;
    --border: 240 8% 16%;
    --input: 240 8% 16%;
    --ring: 22 100% 55%;
    --radius: 0.75rem;
    --sidebar: 240 14% 5%;
    --sidebar-foreground: 0 0% 90%;
  }
}
```

- [ ] **Step 2: Adicionar utility classes do fundo glow + grid no fim de `globals.css`**

Anexar ao fim do arquivo:

```css
@layer utilities {
  .bg-hero {
    background-color: hsl(var(--background));
    background-image:
      radial-gradient(circle at 22% 28%, hsl(var(--primary) / 0.20), transparent 55%),
      radial-gradient(circle at 78% 82%, hsl(var(--primary) / 0.12), transparent 55%);
  }
  .dark .bg-hero {
    background-image:
      radial-gradient(circle at 22% 28%, hsl(var(--primary) / 0.28), transparent 55%),
      radial-gradient(circle at 78% 82%, hsl(var(--primary) / 0.18), transparent 55%);
  }
  .bg-grid-overlay::before {
    content: "";
    position: absolute;
    inset: 0;
    pointer-events: none;
    background-image:
      linear-gradient(hsl(36 35% 13% / 0.06) 1px, transparent 1px),
      linear-gradient(90deg, hsl(36 35% 13% / 0.06) 1px, transparent 1px);
    background-size: 32px 32px;
    -webkit-mask-image: radial-gradient(circle at center, #000 30%, transparent 80%);
            mask-image: radial-gradient(circle at center, #000 30%, transparent 80%);
  }
  .dark .bg-grid-overlay::before {
    background-image:
      linear-gradient(hsl(0 0% 100% / 0.05) 1px, transparent 1px),
      linear-gradient(90deg, hsl(0 0% 100% / 0.05) 1px, transparent 1px);
  }
  .glass-card {
    background: hsl(40 80% 98% / 0.82);
    backdrop-filter: blur(24px) saturate(180%);
    -webkit-backdrop-filter: blur(24px) saturate(180%);
    border: 1px solid hsl(40 80% 98% / 0.95);
    box-shadow:
      0 24px 70px hsl(22 100% 55% / 0.18),
      inset 0 1px 0 hsl(0 0% 100% / 0.9),
      0 0 0 1px hsl(36 35% 13% / 0.05);
  }
  .dark .glass-card {
    background: hsl(240 12% 9% / 0.72);
    border: 1px solid hsl(0 0% 100% / 0.08);
    box-shadow:
      0 24px 70px hsl(22 100% 55% / 0.22),
      inset 0 0 0 1px hsl(0 0% 100% / 0.04);
  }
}
```

- [ ] **Step 3: Adicionar `boxShadow.glow`, `boxShadow.button` e `borderRadius.xl` em `tailwind.config.ts`**

Substituir o bloco `boxShadow` existente e adicionar `borderRadius.xl`:

```typescript
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        xl: "calc(var(--radius) + 10px)",
      },
      boxShadow: {
        glass: "0 8px 32px rgba(0, 0, 0, 0.08)",
        "glass-dark": "0 8px 32px rgba(0, 0, 0, 0.4)",
        glow: "0 24px 70px hsl(22 100% 55% / 0.20)",
        button: "0 6px 18px hsl(22 100% 55% / 0.35), inset 0 1px 0 rgba(255,255,255,0.2)",
        gold: "0 0 20px rgba(212, 168, 83, 0.15)",
      },
```

> `shadow-gold` permanece pra não quebrar usos legados, mas com cor que ainda combina (sutil dourado). Pode ser migrado em PR2/3.

- [ ] **Step 4: Verificar que nada quebrou**

```bash
npm run lint
npx tsc --noEmit
npm run build
```

Esperado: todos verdes. Build pode demorar 30–60s.

- [ ] **Step 5: Conferir visual rapidamente**

```bash
npm run dev
```

Abrir `http://localhost:3000/dashboard` (com usuário logado se houver) e `http://localhost:3000/changelog` — verificar que **nada está cinza/quebrado**: layouts dos cards, sidebar, tabelas seguem reconhecíveis, apenas com tons trocados (dourado virou laranja). Reportar visualmente o que viu.

> Critério: se você abriu 3 telas e nenhuma está com texto invisível, botão sem cor, ou layout colapsado, o redirecionamento `--gold → --primary` deu certo.

- [ ] **Step 6: Commit**

```bash
git add src/app/globals.css tailwind.config.ts
git commit -m "feat: nova paleta laranja (light papel + dark glow), --gold redirecionado pra --primary"
```

---

## Task 3: ThemeToggle component

**Files:**
- Create: `src/components/layout/theme-toggle.tsx`

- [ ] **Step 1: Implementar o componente**

```tsx
"use client";

import { useEffect, useState } from "react";
import { Moon, Sun, Monitor } from "lucide-react";
import {
  type ThemeMode,
  getStoredTheme,
  setStoredTheme,
  resolveTheme,
  applyTheme,
} from "@/lib/theme";

export function ThemeToggle() {
  const [mode, setMode] = useState<ThemeMode>("system");

  useEffect(() => {
    setMode(getStoredTheme());
  }, []);

  function cycle() {
    const next: ThemeMode =
      mode === "light" ? "dark" : mode === "dark" ? "system" : "light";
    setMode(next);
    setStoredTheme(next);
    applyTheme(
      resolveTheme(next, () =>
        window.matchMedia("(prefers-color-scheme: dark)").matches,
      ),
    );
  }

  const label =
    mode === "light" ? "Light" : mode === "dark" ? "Dark" : "Sistema";
  const Icon = mode === "light" ? Sun : mode === "dark" ? Moon : Monitor;

  return (
    <button
      type="button"
      onClick={cycle}
      aria-label={`Modo: ${label}. Clique para alternar.`}
      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground/80 transition-colors hover:bg-secondary"
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}
```

- [ ] **Step 2: Confirmar tipos**

```bash
npx tsc --noEmit
```

Esperado: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/theme-toggle.tsx
git commit -m "feat: ThemeToggle (light/dark/system com persistencia)"
```

---

## Task 4: Anti-flash script no layout root

**Files:**
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Ler o arquivo atual**

```bash
cat src/app/layout.tsx
```

Identificar onde `<html>` é aberta e o `<body>` começa.

- [ ] **Step 2: Inserir script inline logo antes do `</head>` (ou no topo do `<body>` se não tiver `<head>` explícito)**

O Next.js App Router não usa `<head>` literal; injeta no `<html>`. Adicionar uma tag `<Script>` ou um `<script dangerouslySetInnerHTML={{__html: ...}} />` no topo do `<body>`. Exemplo (adaptar ao arquivo):

```tsx
<body className={...}>
  <script
    dangerouslySetInnerHTML={{
      __html: `(function(){try{var s=localStorage.getItem('clinifunnel-theme');var d=s==='dark'||(s!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(d)document.documentElement.classList.add('dark');}catch(e){}})();`,
    }}
  />
  {/* resto do body existente */}
</body>
```

> Razão: o script roda antes do React hidratar. Sem isso, o usuário em dark mode vê 1 frame branco antes do dark aplicar.

- [ ] **Step 3: Verificar `tsc` e `build`**

```bash
npx tsc --noEmit
npm run build
```

Esperado: ambos verdes.

- [ ] **Step 4: Commit**

```bash
git add src/app/layout.tsx
git commit -m "feat: anti-flash script aplica dark class antes do paint"
```

---

## Task 5: LoginShell (background) + LoginCard (glass form)

**Files:**
- Create: `src/components/login/login-shell.tsx`
- Create: `src/components/login/login-card.tsx`

- [ ] **Step 1: Implementar `LoginShell`**

```tsx
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
```

- [ ] **Step 2: Implementar `LoginCard` (extrai o form do `LoginPage` atual)**

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginCard() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        setError("Email ou senha invalidos");
        setLoading(false);
        return;
      }
      window.location.href = callbackUrl;
    } catch {
      setError("Erro ao conectar. Tente novamente.");
      setLoading(false);
    }
  }

  return (
    <div className="glass-card rounded-xl p-8 sm:rounded-[1.375rem] sm:p-9">
      <div className="mb-6 flex items-center gap-2.5">
        <div
          aria-hidden
          className="flex h-9 w-9 items-center justify-center rounded-[10px] font-display text-[17px] font-extrabold text-white shadow-button"
          style={{
            background: "linear-gradient(135deg, hsl(22 100% 55%), hsl(16 100% 55%))",
          }}
        >
          C
        </div>
        <span className="font-display text-[19px] font-extrabold tracking-tight text-foreground">
          Clini<span className="text-primary">Funnel</span>
        </span>
      </div>

      <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-primary">
        Painel de gestão
      </div>
      <h1 className="mb-1.5 font-display text-2xl font-bold tracking-tight text-foreground">
        Acessar sua clínica
      </h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Entre com email e senha pra continuar
      </p>

      <form onSubmit={handleSubmit} className="space-y-3.5">
        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-xs font-medium">
            Email
          </Label>
          <Input
            id="email"
            type="email"
            placeholder="seu@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password" className="text-xs font-medium">
            Senha
          </Label>
          <Input
            id="password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <div className="flex justify-end pt-1">
          <Link
            href="/forgot-password"
            className="text-xs font-semibold text-primary hover:underline"
          >
            Esqueci minha senha →
          </Link>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button
          type="submit"
          disabled={loading}
          className="h-12 w-full text-sm font-semibold shadow-button"
        >
          {loading ? "Entrando..." : "Entrar"}
        </Button>
      </form>
    </div>
  );
}
```

- [ ] **Step 3: Verificar tipos**

```bash
npx tsc --noEmit
```

Esperado: sem erros.

- [ ] **Step 4: Commit**

```bash
git add src/components/login/
git commit -m "feat: LoginShell e LoginCard (glass + glow + form)"
```

---

## Task 6: Refazer `src/app/login/page.tsx`

**Files:**
- Modify: `src/app/login/page.tsx`

- [ ] **Step 1: Substituir o arquivo inteiro**

```tsx
import { Suspense } from "react";
import { LoginShell } from "@/components/login/login-shell";
import { LoginCard } from "@/components/login/login-card";

export default function LoginPage() {
  return (
    <LoginShell>
      <Suspense>
        <LoginCard />
      </Suspense>
    </LoginShell>
  );
}
```

- [ ] **Step 2: Verificar build**

```bash
npx tsc --noEmit
npm run build
```

Esperado: ambos verdes.

- [ ] **Step 3: Commit**

```bash
git add src/app/login/page.tsx
git commit -m "feat: pagina de login usa novo LoginShell + LoginCard"
```

---

## Task 7: `/forgot-password` placeholder

**Files:**
- Create: `src/app/forgot-password/page.tsx`

- [ ] **Step 1: Criar a página**

```tsx
import Link from "next/link";
import { LoginShell } from "@/components/login/login-shell";

export default function ForgotPasswordPage() {
  return (
    <LoginShell>
      <div className="glass-card rounded-xl p-8 sm:rounded-[1.375rem] sm:p-9 text-center">
        <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-primary">
          Esqueci minha senha
        </div>
        <h1 className="mb-3 font-display text-2xl font-bold tracking-tight text-foreground">
          Em breve
        </h1>
        <p className="mb-6 text-sm text-muted-foreground">
          A recuperação automática de senha ainda está em desenvolvimento. Por
          enquanto, peça ao admin da sua clínica pra redefinir sua senha pelo
          painel de usuários.
        </p>
        <Link
          href="/login"
          className="inline-block text-xs font-semibold text-primary hover:underline"
        >
          ← Voltar ao login
        </Link>
      </div>
    </LoginShell>
  );
}
```

- [ ] **Step 2: Verificar build**

```bash
npm run build
```

Esperado: build verde com a nova rota.

- [ ] **Step 3: Commit**

```bash
git add src/app/forgot-password/
git commit -m "feat: pagina /forgot-password placeholder ate fluxo real existir"
```

---

## Task 8: Verificação visual no browser

**Esta task não tem commit — é verificação obrigatória.**

- [ ] **Step 1: Subir o dev server**

```bash
npm run dev
```

- [ ] **Step 2: Conferir `/login` em light**

Abrir `http://localhost:3000/login`. Verificar:
- Fundo bege/papel quente (não branco puro), com glow laranja nos cantos
- Grid sutil de linhas (32×32 com mask radial)
- Glass card centralizado, semi-transparente, com sombra alaranjada
- Brand mark "C" laranja + "Clini**Funnel**" com Funnel em laranja
- Pré-título "PAINEL DE GESTÃO" em laranja maiúsculo
- Inputs com placeholder visível, foco com ring laranja
- Link "Esqueci minha senha →" em laranja
- Botão "Entrar" com gradiente laranja
- Footer "CliniFunnel vX.Y.Z · novidades" no rodapé
- Toggle de modo no topo direito, "PT-BR" no topo esquerdo

- [ ] **Step 3: Conferir toggle light → dark**

Clicar no toggle. Esperado: vira dark. Verificar:
- Fundo preto com glow laranja
- Grid em linhas claras
- Glass card escuro semi-transparente
- Texto todo legível (contraste alto)
- Botão "Entrar" continua igual (gradiente laranja)
- Toggle agora mostra "Dark"

Clicar de novo: vira "Sistema" — segue prefers-color-scheme do SO. Clicar de novo: volta pra "Light".

Recarregar a página. Esperado: modo escolhido persiste, sem flash branco.

- [ ] **Step 4: Submeter form com credenciais inválidas**

Digitar `teste@x.com` / `senha-errada`, clicar Entrar. Esperado: aparece "Email ou senha invalidos" em vermelho. Botão volta a "Entrar".

- [ ] **Step 5: Submeter com credenciais válidas (admin)**

Esperado: redireciona pra `/dashboard`. Confirmar que dashboard NÃO regrediu visualmente — sidebar, header, cards, tabelas seguem reconhecíveis (laranja onde antes era dourado é OK; quebra de layout NÃO é OK).

- [ ] **Step 6: Visitar `/forgot-password`**

Abrir `http://localhost:3000/forgot-password`. Verificar: mesma estética do login, mensagem "Em breve", link "← Voltar ao login" funciona.

- [ ] **Step 7: Passar olho em 3 telas internas (sanity check do --gold → --primary)**

Com sessão logada, abrir:
- `/dashboard` (overview)
- `/dashboard/leads`
- `/dashboard/financeiro`

Em cada uma: pegar print mental ou screenshot. Critério: nada está cinza-onde-não-deveria, nenhum botão sem cor, nenhuma KPI invisível.

> Se algo quebrou, identificar o uso problemático de `gold` e ou (a) ajustar pontualmente o componente afetado neste mesmo PR, ou (b) registrar em `docs/IMPROVEMENTS.md` pra PR2.

---

## Task 9: Versão + CHANGELOG + IMPROVEMENTS

**Files:**
- Modify: `package.json`
- Modify: `src/lib/version.ts`
- Modify: `docs/IMPROVEMENTS.md`

- [ ] **Step 1: Bumpar `package.json`**

Trocar `"version": "0.38.0"` por `"version": "0.39.0"`.

- [ ] **Step 2: Atualizar `src/lib/version.ts`**

```typescript
export const APP_VERSION = "0.39.0";
```

E adicionar **no topo do array `CHANGELOG`** uma nova entrada (antes da 0.38.0):

```typescript
  {
    version: "0.39.0",
    date: "2026-05-11",
    type: "minor",
    changes: [
      "Visual: nova paleta laranja vivo (#FF7A1A) substitui o tema dourado/ambar; light mode 'papel quente' (fundo alabaster, sem branco puro) e dark mode 'carvao glow' (preto com glow laranja)",
      "Login redesenhado: glass card centralizado sobre fundo com grid sutil e brilhos laranja; brand mark com icone 'C' em gradiente; pre-titulo, headline e link 'Esqueci minha senha'",
      "Toggle de modo (light/dark/system) no topo direito do login, com persistencia em localStorage e anti-flash via script inline no <body>",
      "Pagina /forgot-password placeholder ate o fluxo real existir",
      "Token --gold mantido como alias visual de --primary (laranja), pra absorver os 39 usos legados em dashboard/leads/sidebar sem regressao; consolidacao bg-gold->bg-primary vira em PR2/3",
    ],
  },
```

- [ ] **Step 3: Mover item em `docs/IMPROVEMENTS.md`**

Em "Em andamento" (linha 9), adicionar entrada se ainda não tiver:
```
- ~~Redesign visual: nova paleta laranja + login (PR1 de 5)~~ → concluído em v0.39.0
```
Em "Concluidos" (linha 87), adicionar:
```
- v0.39.0 (2026-05-11): Redesign visual PR1 — tokens light/dark com paleta laranja vivo + login com glass card e toggle de modo. Inclui /forgot-password placeholder e alias --gold → --primary pra absorver usos legados. PR #<numero>. Próximos: sidebar+header (PR2), dashboard overview (PR3), leads/demais (PR4), polimento (PR5).
```

> Se não existir uma entrada "Em andamento" pro redesign, criar primeiro a entrada e já marcá-la como concluída no mesmo commit — isso satisfaz a regra "se a tarefa não tem item, abrir o item primeiro".

- [ ] **Step 4: Rodar validação final**

```bash
npm run lint
npx tsc --noEmit
npm test
npm run build
```

Esperado: todos os 4 verdes.

- [ ] **Step 5: Commit**

```bash
git add package.json src/lib/version.ts docs/IMPROVEMENTS.md
git commit -m "chore: bump v0.39.0 e changelog do redesign visual PR1"
```

---

## Task 10: Push + abrir PR

- [ ] **Step 1: Push da branch**

```bash
git push -u origin feat/visual-redesign-pr1-login
```

- [ ] **Step 2: Abrir PR via gh**

```bash
gh pr create --title "feat: redesign visual PR1 — nova paleta laranja + login (v0.39.0)" --body "$(cat <<'EOF'
## Summary
- Substitui paleta âmbar/dourado por **laranja vivo #FF7A1A** com light "papel quente" e dark "carvão glow"
- Login redesenhado: glass card sobre fundo com grid sutil + glow laranja, brand mark com ícone "C", toggle de modo (light/dark/system) persistido, link "Esqueci minha senha" novo
- Página `/forgot-password` placeholder
- Token `--gold` legado redirecionado pros mesmos valores de `--primary` — absorve as 39 ocorrências em dashboard/leads/sidebar/etc sem regressão visual
- Bump v0.38.0 → v0.39.0

Spec: `docs/superpowers/specs/2026-05-11-redesign-visual-design.md`
Plano: `docs/superpowers/plans/2026-05-11-redesign-visual-pr1-login.md`

PR1 de 5. Próximos: sidebar+header (PR2), dashboard overview (PR3), leads/demais (PR4), polimento (PR5).

## Test plan
- [x] `npm run lint` verde
- [x] `npx tsc --noEmit` verde
- [x] `npm test` verde
- [x] `npm run build` verde
- [x] `/login` light: glass card + glow + grid + brand + toggle visíveis e bonitos
- [x] `/login` dark: tudo legível, sem flash ao recarregar
- [x] Submit com senha inválida mostra erro em vermelho
- [x] Submit com senha correta redireciona pro dashboard
- [x] `/forgot-password` renderiza placeholder e link de volta funciona
- [x] Sanity check em `/dashboard`, `/dashboard/leads`, `/dashboard/financeiro`: nenhuma regressão visual (laranja onde antes era dourado é esperado)
EOF
)"
```

- [ ] **Step 3: Aguardar CI verde**

```bash
gh pr checks --watch
```

- [ ] **Step 4: Squash merge (apenas após review aprovada por Bruno)**

```bash
gh pr merge --squash --delete-branch
```

- [ ] **Step 5: Confirmar deploy disparado**

```bash
gh run list --branch main --limit 3
```

Esperado: run de `deploy.yml` rodando. Se não disparou em 5 min, disparar manual: `gh workflow run deploy.yml --ref main`.

- [ ] **Step 6: Healthcheck pós-deploy**

Depois do deploy verde:
```bash
curl -sS https://clinifunnel.koaai.com.br/api/health
```
Esperado: `{"status":"ok"...}`. Abrir https://clinifunnel.koaai.com.br/login no browser e confirmar visual em produção.

- [ ] **Step 7: Limpar worktree local**

```bash
cd /Users/macintosh/Documents/Claude.Code/clinifunnel
git worktree remove ../clinifunnel-feat-visual-pr1
git branch -d feat/visual-redesign-pr1-login || git branch -D feat/visual-redesign-pr1-login
```

---

## Notas finais

- **Foco do PR1**: paleta + login + placeholder. Sidebar/dashboard/leads NÃO mudam de estrutura nesse PR — só absorvem o laranja via `--gold` alias.
- **TDD aplicado** onde fez sentido (helpers de tema em `src/lib/theme.ts`). Visual é verificado no browser local + screenshot na PR.
- **Sem deps novas.** Tudo com a stack atual.
- **Reversibilidade**: rollback de PR1 = `git revert` da PR + redeploy. Como `--gold` foi mantido como alias, nenhuma página interna depende do nome `gold` semanticamente — só visualmente.
