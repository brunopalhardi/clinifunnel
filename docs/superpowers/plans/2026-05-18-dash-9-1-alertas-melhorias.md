# DASH-9.1 — Fix alertas + seletor + sub-menu — Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development.

**Goal:** v0.46.1 patch resolvendo 3 ajustes do feedback do Bruno após DASH-9:
1. **Bug fix:** alertas não apareciam — a clínica AD não preenche `ExecutedDate` no Clinicorp (160/160 procedures Aprovados com `completedAt = null`). Usar `COALESCE(completedAt, createdAt)` (createdAt = estimate.CreateDate via sync).
2. **Feature UX:** substituir Input texto livre por seletor com nomes reais (combobox com busca, 27 nomes distintos hoje).
3. **UX:** mover os 4 links laranja do header `/dashboard/settings` pra sub-menu lateral (sidebar vertical em `/dashboard/settings/layout.tsx`).

**Architecture:**
- Endpoint `GET /api/procedures/names` retorna distinct `procedure.name` Aprovados da clínica, ordenado por count desc.
- Combobox simples (Datalist HTML5 ou Select shadcn) — sem nova dep.
- Layout `app/dashboard/settings/layout.tsx` com sidebar vertical lateral lista 5 sub-rotas; remove links do header das pages individuais.

**Tech stack:** Next.js 14 App Router, Prisma. Sem deps novas.

---

## File Structure

**Create:**
- `src/app/api/procedures/names/route.ts`
- `src/app/dashboard/settings/layout.tsx`

**Modify:**
- `src/app/api/reminders/route.ts` — usar `createdAt` como fallback de `completedAt`
- `src/app/dashboard/settings/recall/page.tsx` — combobox com nomes do `/api/procedures/names`
- `src/app/dashboard/settings/page.tsx` — remover os 4 links laranja do header (agora estão na sidebar do layout)
- `package.json` + `src/lib/version.ts` — bump 0.46.0 → 0.46.1 + CHANGELOG
- `docs/IMPROVEMENTS.md` — adicionar entry DASH-9.1 em Concluídos

---

## Task 1: Bug fix — fallback completedAt → createdAt

**File:** `src/app/api/reminders/route.ts`

### Step 1: Adicionar `createdAt` ao select + usar como fallback

Em `src/app/api/reminders/route.ts`, no `prisma.procedure.findMany`, adicionar `createdAt` ao select:

```ts
select: {
  id: true,
  name: true,
  completedAt: true,
  createdAt: true,           // ← novo
  patient: { select: { id: true, name: true, phone: true } },
},
```

Substituir o filter+map atual:

```ts
const procedures = procRows
  .filter((p): p is typeof p & { completedAt: Date } => p.completedAt !== null)
  .map((p) => ({
    id: p.id,
    name: p.name,
    completedAt: p.completedAt,
    patient: p.patient,
  }));
```

por:

```ts
// [DASH-9.1] Fallback: clinicas que nao preenchem ExecutedDate no Clinicorp tem
// completedAt=null. Usa createdAt (que vem do estimate.CreateDate via sync — data
// real de aprovacao do orcamento no Clinicorp, nao o now() do nosso DB).
const procedures = procRows.map((p) => ({
  id: p.id,
  name: p.name,
  completedAt: p.completedAt ?? p.createdAt,
  patient: p.patient,
}));
```

### Step 2: Remover filtro `completedAt: { not: null }` do where

Old:
```ts
where: {
  clinicId,
  statusDescription: "Aprovado",
  deleted: false,
  completedAt: { not: null },
},
```

New:
```ts
where: {
  clinicId,
  statusDescription: "Aprovado",
  deleted: false,
},
```

### Step 3: tsc + lint + test + commit

```bash
cd /Users/macintosh/Documents/Claude.Code/clinifunnel-fix-dash-9-1
npx tsc --noEmit
npm run lint
npm test 2>&1 | tail -3
git add src/app/api/reminders/route.ts
git commit -m "fix(dash-9.1): usar createdAt como fallback de completedAt pra clinicas sem ExecutedDate"
```

---

## Task 2: Endpoint `GET /api/procedures/names`

**File:** `src/app/api/procedures/names/route.ts` (novo)

### Step 1: Criar o endpoint

```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthorizedClinicId, AuthError } from "@/lib/auth-guard";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  let clinicId: string;
  try {
    const auth = await getAuthorizedClinicId(request);
    clinicId = auth.clinicId;
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Erro de autorizacao" }, { status: 500 });
  }

  const grouped = await prisma.procedure.groupBy({
    by: ["name"],
    where: { clinicId, statusDescription: "Aprovado", deleted: false },
    _count: { name: true },
    orderBy: { _count: { name: "desc" } },
  });

  const names = grouped.map((g) => ({ name: g.name, count: g._count.name }));
  return NextResponse.json({ data: names });
}
```

### Step 2: tsc + lint + commit

```bash
npx tsc --noEmit
npm run lint
git add src/app/api/procedures/names/route.ts
git commit -m "feat(dash-9.1): GET /api/procedures/names (distinct names Aprovados com count)"
```

---

## Task 3: Seletor de procedimento na tela de recall

**File:** `src/app/dashboard/settings/recall/page.tsx`

Substituir o `<Input>` livre do "Novo padrao" e do edit inline por um `<select>` HTML nativo com `<option>` dos nomes reais. Usa nativo pra não adicionar dep (shadcn não tem Combobox built-in).

### Step 1: Adicionar state + fetch dos nomes

No topo do componente `RecallSettingsPage`, depois dos states existentes, adicionar:

```tsx
const [procedureNames, setProcedureNames] = useState<Array<{ name: string; count: number }>>([]);
```

E um useEffect que carrega:

```tsx
useEffect(() => {
  if (!clinic) return;
  fetch("/api/procedures/names")
    .then((r) => r.json())
    .then((json) => setProcedureNames(json.data ?? []))
    .catch(() => {});
}, [clinic]);
```

### Step 2: Substituir o input de "Novo padrao"

Localizar o bloco que tem `<Label htmlFor="new-pattern">Novo padrao</Label>` seguido de `<Input ... value={newPattern} ...>` e trocar o `<Input>` por um `<select>`:

```tsx
<div className="space-y-1 flex-1 min-w-48">
  <Label htmlFor="new-pattern">Procedimento</Label>
  <select
    id="new-pattern"
    value={newPattern}
    onChange={(e) => setNewPattern(e.target.value)}
    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gold/50"
  >
    <option value="">Selecione...</option>
    {procedureNames.map((p) => (
      <option key={p.name} value={p.name}>
        {p.name} ({p.count})
      </option>
    ))}
  </select>
</div>
```

### Step 3: Substituir o input de edit inline também

Localizar o bloco `editingId === i.id ? (<Input value={editPattern} ...>` e trocar o Input por um select igual:

```tsx
<select
  value={editPattern}
  onChange={(e) => setEditPattern(e.target.value)}
  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gold/50"
>
  <option value={i.procedureNamePattern}>{i.procedureNamePattern}</option>
  {procedureNames
    .filter((p) => p.name !== i.procedureNamePattern)
    .map((p) => (
      <option key={p.name} value={p.name}>
        {p.name} ({p.count})
      </option>
    ))}
</select>
```

(Mantém o pattern atual como option default e lista os outros — caso o pattern atual seja um texto legacy que não bate com nenhum nome, ele continua visível.)

### Step 4: Ajustar texto de ajuda

Trocar o parágrafo final:

```
O padrao de nome e casado case-insensitive contra o nome do procedimento no Clinicorp. Ex: "botox" pega "Aplicacao Botox 50U" e "Botox Brow Lift".
```

por:

```
Selecione o procedimento da lista. Os nomes vem direto dos procedimentos Aprovados sincronizados do Clinicorp. Match e case-insensitive — escolher "BOTOX TERÇO SUPERIOR" pega tambem variantes como "Botox Terço Superior + Pescoço" (match por substring).
```

### Step 5: tsc + lint + commit

```bash
npx tsc --noEmit
npm run lint
git add src/app/dashboard/settings/recall/page.tsx
git commit -m "feat(dash-9.1): seletor com nomes reais dos procedimentos (Clinicorp) em vez de texto livre"
```

---

## Task 4: Sub-menu lateral em `/dashboard/settings/*`

**Files:**
- Create: `src/app/dashboard/settings/layout.tsx`
- Modify: `src/app/dashboard/settings/page.tsx` (remover links do header)

### Step 1: Criar `src/app/dashboard/settings/layout.tsx`

```tsx
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
```

### Step 2: Editar `src/app/dashboard/settings/page.tsx` — remover os 4 links laranja do header

Localizar o bloco com os 4 `<a href="/dashboard/settings/...">...→</a>`:

```tsx
          <a
            href="/dashboard/settings/clinicorp/health"
            className="text-sm font-medium text-gold hover:underline"
          >
            Health automacao →
          </a>
          <a
            href="/dashboard/settings/clinicorp/professionals"
            className="text-sm font-medium text-gold hover:underline"
          >
            Mapa de profissionais →
          </a>
          <a
            href="/dashboard/settings/users"
            className="text-sm font-medium text-gold hover:underline"
          >
            Gerenciar usuarios →
          </a>
          <a
            href="/dashboard/settings/recall"
            className="text-sm font-medium text-gold hover:underline"
          >
            Recall por procedimento →
          </a>
```

Apagar inteiramente (não substitui — os links agora vivem na sidebar do layout). Os badges (`{settings.hasKommo && ...}`) ficam.

### Step 3: tsc + lint + build (build valida que layout não quebrou roteamento) + commit

```bash
npx tsc --noEmit
npm run lint
npm run build 2>&1 | tail -10
git add src/app/dashboard/settings/layout.tsx src/app/dashboard/settings/page.tsx
git commit -m "feat(dash-9.1): sub-menu lateral em /dashboard/settings/* (remove links laranja do header)"
```

---

## Task 5: Bump 0.46.0 → 0.46.1 + IMPROVEMENTS

**Files:** `package.json`, `src/lib/version.ts`, `docs/IMPROVEMENTS.md`

### Step 1: Bump

`package.json`: `"version": "0.46.0"` → `"version": "0.46.1"`
`src/lib/version.ts`: `APP_VERSION = "0.46.0"` → `"0.46.1"`

Adicionar nova entry no topo do CHANGELOG (acima da entry 0.46.0):

```ts
  {
    version: "0.46.1",
    date: "2026-05-18",
    type: "patch",
    changes: [
      "DASH-9.1: 3 ajustes acumulados pos-DASH-9 (1 bug fix + 2 melhorias UX)",
      "Fix alertas nao aparecendo: clinicas que nao marcam ExecutedDate no Clinicorp tinham 100% dos procedures Aprovados com completedAt=null. /api/reminders agora usa COALESCE(completedAt, createdAt) — createdAt vem do estimate.CreateDate via sync, e nao do now() do nosso DB (DASH-3 ja setava isso)",
      "Removido filtro completedAt:{not: null} do where — todos os Aprovados entram no calculo agora",
      "Seletor de procedimento na tela /dashboard/settings/recall: novo endpoint GET /api/procedures/names retorna distinct dos nomes Aprovados ordenado por count desc. UI substitui <Input> texto livre por <select> com os nomes reais (27 distintos hoje na AD). Tira o risco de erro de digitacao/cedilha que tornava o pattern silenciosamente invalido",
      "Sub-menu lateral em /dashboard/settings/*: criado src/app/dashboard/settings/layout.tsx com nav vertical listando 5 sub-rotas (Integracoes, Recall, Mapa de profissionais, Health, Usuarios). Removidos os 4 links laranja que estavam no header da pagina principal — limpeza visual e mais escalavel pra sub-rotas futuras",
    ],
  },
```

### Step 2: IMPROVEMENTS.md

Adicionar no topo de "Concluidos" (acima do DASH-9):

```markdown
- **[DASH-9.1] Fix alertas + seletor de procedimento + sub-menu lateral em /settings** — PR #_TBD_ — v0.46.1
  Bruno reportou apos DASH-9 que alertas nao apareciam mesmo configurando patterns. Investigacao confirmou: a clinica AD nao marca ExecutedDate no Clinicorp — 160/160 procedures Aprovados tinham completedAt=null. Fix: usar COALESCE(completedAt, createdAt) — createdAt ja e o estimate.CreateDate via sync. Aproveitou pra adicionar 2 UX wins: (a) seletor de procedimento na config — endpoint GET /api/procedures/names + <select> com nomes reais, removendo o input texto livre que era propenso a erro de digitacao; (b) sub-menu lateral em /dashboard/settings/* via layout.tsx, removendo os 4 links laranja do header da pagina de Integracoes — visual mais limpo e escalavel.
```

### Step 3: commit

```bash
git add package.json src/lib/version.ts docs/IMPROVEMENTS.md
git commit -m "chore(dash-9.1): bump 0.46.0 -> 0.46.1 + CHANGELOG + IMPROVEMENTS"
```

---

## Task 6: Bateria pre-PR + PR + deploy + cleanup

```bash
cd /Users/macintosh/Documents/Claude.Code/clinifunnel-fix-dash-9-1
npm ci && npx prisma generate && npm run lint && npx tsc --noEmit && npm test && npm run build
```

Expected: tudo verde, 210/210 tests.

Push + PR:

```bash
git push -u origin fix/dash-9-1-alertas-melhorias
gh pr create --title "fix: alertas + seletor de procedimento + sub-menu de settings (DASH-9.1, v0.46.1)" --body "..."
gh pr checks --watch
gh pr merge --squash
```

Monitor deploy, validar `/api/health` → `0.46.1`, smoke test prod.

Cleanup:
```bash
cd /Users/macintosh/Documents/Claude.Code/clinifunnel
git pull origin main
git worktree remove ../clinifunnel-fix-dash-9-1
git branch -D fix/dash-9-1-alertas-melhorias
```
