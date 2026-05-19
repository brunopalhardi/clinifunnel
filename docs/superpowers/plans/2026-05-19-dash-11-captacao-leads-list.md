# DASH-11 — Lista de leads no Dashboard de Captação Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar lista de leads como último bloco da página `/dashboard/captacao` com tabs (Todos / Agendados / Fecharam / Sem agendar), respeitando o filtro de data global. Click em um lead abre o `LeadDetailDrawer` estendido com seção de alertas ativos do paciente.

**Architecture:** Mudança puramente client-side. A página de captação faz fetch paralelo de `/api/leads` (já existente, sem mudanças). O `LeadDetailDrawer` é estendido com fetch adicional de `/api/reminders` + filtro client-side por `patient.id`. A lógica de "Tratar alerta" é extraída do componente `PatientAlerts` num hook `useReminderActions` + componente `ReminderRow`, ambos reutilizados pelo drawer.

**Tech Stack:** Next.js 14 App Router, React 18, TypeScript strict, Tailwind, Vitest.

**Spec:** `docs/superpowers/specs/2026-05-19-dash-11-captacao-leads-list-design.md`

---

## Pré-requisitos

- Worktree dedicada: `git worktree add -b feat/dash-11-captacao-leads-list ../clinifunnel-feat-dash-11 main`.
- `npm ci` na worktree.
- A worktree principal está em `main` no commit `56ebeed` (DASH-10 mergeado em v0.47.0).
- Copiar a spec pra worktree: `cp docs/superpowers/specs/2026-05-19-dash-11-captacao-leads-list-design.md ../clinifunnel-feat-dash-11/docs/superpowers/specs/`.
- Copiar este plano: `cp docs/superpowers/plans/2026-05-19-dash-11-captacao-leads-list.md ../clinifunnel-feat-dash-11/docs/superpowers/plans/`.

---

## Estrutura de arquivos

| Arquivo | Tipo | Responsabilidade |
|---|---|---|
| `src/lib/reminders/use-reminder-actions.ts` | NOVO | Hook client `useReminderActions(onActioned)` — encapsula `busy` Set, `openMenu`, `handleAction(key, kind)` que faz POST em `/api/reminders/action`. |
| `src/components/dashboard/reminder-row.tsx` | NOVO | Componente de UMA linha de reminder (ícone + nome + descrição + menu Tratar). Recebe `reminder`, `busy`, `menuOpen`, `onMenuToggle`, `onAction` como props. |
| `src/components/dashboard/patient-alerts.tsx` | REFACTOR | Passa a usar `useReminderActions` + `ReminderRow`. Comportamento idêntico ao atual. |
| `src/components/dashboard/lead-detail-drawer.tsx` | EXTEND | + fetch `/api/reminders`; + nova seção "Alertas ativos" usando hook + `ReminderRow`. |
| `src/app/dashboard/captacao/page.tsx` | EXTEND | + bloco "Leads no funil" com tabs + fetch `/api/leads`; + estado do drawer. |
| `src/lib/version.ts` | EDIT | Bump 0.48.0 + entrada CHANGELOG. |
| `package.json` | EDIT | Bump 0.48.0. |
| `docs/IMPROVEMENTS.md` | EDIT | + item DASH-11. |

---

## Task 1: Backlog DASH-11

**Files:**
- Modify: `docs/IMPROVEMENTS.md`

- [ ] **Step 1: Adicionar entrada na seção "Em andamento"**

Logo após o cabeçalho `## Em andamento` e antes do primeiro item (DASH-10 ou UX-1), adicionar:

```markdown
- **[DASH-11] Lista de leads no Dashboard de Captacao**
  Lista de leads no final da pagina /dashboard/captacao com 4 tabs (Todos / Agendados / Fecharam / Sem agendar) e drawer com timeline + procedimentos + alertas ativos do paciente. Respeita o filtro de data global. Reusa /api/leads existente.
  Eixo: produto/dash · Bump: minor (0.48.0)
```

- [ ] **Step 2: Commit**

```bash
git add docs/IMPROVEMENTS.md
git commit -m "chore: abre item DASH-11 (lista de leads na captacao) no backlog"
```

---

## Task 2: Hook `useReminderActions` + componente `ReminderRow`

Extrai a lógica de ação de reminder em hook + a renderização de linha em componente, pra ser reaproveitada pelo drawer. Refatora `PatientAlerts` pra usar os dois sem mudar comportamento.

**Files:**
- Create: `src/lib/reminders/use-reminder-actions.ts`
- Create: `src/components/dashboard/reminder-row.tsx`
- Modify: `src/components/dashboard/patient-alerts.tsx`

- [ ] **Step 1: Inspecionar o estado atual**

Ler `src/components/dashboard/patient-alerts.tsx` completo (194 linhas). Confirmar que:
- O tipo `Reminder` está definido nas linhas 6-15.
- O tipo `ActionKind` está na linha 24.
- O sub-componente `Section` está nas linhas 159-194 e o `iconFor` nas linhas 26-30.

- [ ] **Step 2: Criar o hook `useReminderActions`**

Criar `src/lib/reminders/use-reminder-actions.ts`:

```ts
"use client";

import { useCallback, useState } from "react";

export type ActionKind = "TRATADO" | "ADIADO_7" | "ADIADO_30" | "DISPENSADO";

export interface UseReminderActions {
  busy: Set<string>;
  openMenu: string | null;
  setOpenMenu: (key: string | null) => void;
  handleAction: (key: string, kind: ActionKind) => Promise<void>;
}

interface Options {
  onActioned: (key: string) => void;
  onError: () => void;
}

export function useReminderActions({ onActioned, onError }: Options): UseReminderActions {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [busy, setBusy] = useState<Set<string>>(new Set());

  const handleAction = useCallback(
    async (key: string, kind: ActionKind) => {
      setOpenMenu(null);
      setBusy((b) => {
        const c = new Set(b);
        c.add(key);
        return c;
      });
      try {
        const body: Record<string, unknown> = { reminderKey: key };
        if (kind === "TRATADO") body.action = "TRATADO";
        else if (kind === "DISPENSADO") body.action = "DISPENSADO";
        else {
          body.action = "ADIADO";
          const days = kind === "ADIADO_7" ? 7 : 30;
          body.snoozeUntil = new Date(Date.now() + days * 86400000).toISOString();
        }
        const res = await fetch("/api/reminders/action", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error();
        onActioned(key);
      } catch {
        onError();
      } finally {
        setBusy((b) => {
          const c = new Set(b);
          c.delete(key);
          return c;
        });
      }
    },
    [onActioned, onError],
  );

  return { busy, openMenu, setOpenMenu, handleAction };
}
```

- [ ] **Step 3: Criar componente `ReminderRow`**

Criar `src/components/dashboard/reminder-row.tsx`:

```tsx
"use client";

import Link from "next/link";
import type { ActionKind } from "@/lib/reminders/use-reminder-actions";

export interface Reminder {
  key: string;
  type: "recall" | "inactive" | "postconsulta";
  patientId: string;
  patientName: string;
  patientPhone: string | null;
  procedureName: string | null;
  daysUntilDue: number;
  description: string;
}

function iconFor(t: Reminder["type"]): string {
  if (t === "recall") return "RC";
  if (t === "inactive") return "IN";
  return "PC";
}

interface Props {
  reminder: Reminder;
  busy: boolean;
  menuOpen: boolean;
  onMenuToggle: () => void;
  onAction: (kind: ActionKind) => void;
  /** Se true, esconde o link pro perfil do paciente (usado no drawer onde ja estamos vendo o lead). */
  hidePatientLink?: boolean;
}

export function ReminderRow({
  reminder: r,
  busy,
  menuOpen,
  onMenuToggle,
  onAction,
  hidePatientLink,
}: Props) {
  const body = (
    <>
      <p className="font-medium truncate">{r.patientName}</p>
      <p className="text-xs text-muted-foreground truncate">{r.description}</p>
    </>
  );
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-[10px] font-semibold text-primary">
        {iconFor(r.type)}
      </span>
      {hidePatientLink ? (
        <div className="flex-1 min-w-0">{body}</div>
      ) : (
        <Link
          href={`/dashboard/patients/${r.patientId}`}
          className="flex-1 min-w-0 hover:text-gold"
        >
          {body}
        </Link>
      )}
      <span className="text-xs text-muted-foreground hidden sm:inline">
        {r.patientPhone ?? "-"}
      </span>
      <div className="relative">
        <button
          disabled={busy}
          onClick={onMenuToggle}
          className="rounded-md bg-primary/10 px-3 py-1 text-xs font-medium text-primary hover:bg-primary/20 disabled:opacity-50"
        >
          Tratar
        </button>
        {menuOpen && (
          <div className="absolute right-0 top-full mt-1 z-10 w-44 rounded-md border border-border bg-card shadow-lg">
            <button
              onClick={() => onAction("TRATADO")}
              className="block w-full px-3 py-2 text-left text-sm hover:bg-muted/50"
            >
              Tratado
            </button>
            <button
              onClick={() => onAction("ADIADO_7")}
              className="block w-full px-3 py-2 text-left text-sm hover:bg-muted/50"
            >
              Adiar 7 dias
            </button>
            <button
              onClick={() => onAction("ADIADO_30")}
              className="block w-full px-3 py-2 text-left text-sm hover:bg-muted/50"
            >
              Adiar 30 dias
            </button>
            <button
              onClick={() => onAction("DISPENSADO")}
              className="block w-full px-3 py-2 text-left text-sm hover:bg-muted/50 text-red-600"
            >
              Dispensar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Refatorar `PatientAlerts` pra usar hook + row**

Substituir o conteúdo de `src/components/dashboard/patient-alerts.tsx` por:

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { useReminderActions } from "@/lib/reminders/use-reminder-actions";
import { ReminderRow, type Reminder } from "@/components/dashboard/reminder-row";

interface GroupedData {
  overdue: Reminder[];
  urgent: Reminder[];
  upcoming: Reminder[];
  counts: { recall: number; inactive: number; postconsulta: number; total: number };
}

interface Props {
  onCountChange?: (total: number) => void;
}

export function PatientAlerts({ onCountChange }: Props) {
  const [data, setData] = useState<GroupedData | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(() => {
    setLoading(true);
    fetch("/api/reminders")
      .then((r) => r.json())
      .then((json) => {
        const d: GroupedData = json.data;
        setData(d);
        onCountChange?.(d.counts.total);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [onCountChange]);

  useEffect(() => {
    reload();
  }, [reload]);

  const optimisticRemove = useCallback(
    (key: string) => {
      setData((prev) => {
        if (!prev) return prev;
        const filter = (arr: Reminder[]) => arr.filter((r) => r.key !== key);
        const next: GroupedData = {
          overdue: filter(prev.overdue),
          urgent: filter(prev.urgent),
          upcoming: filter(prev.upcoming),
          counts: { ...prev.counts, total: prev.counts.total - 1 },
        };
        onCountChange?.(next.counts.total);
        return next;
      });
    },
    [onCountChange],
  );

  const { busy, openMenu, setOpenMenu, handleAction } = useReminderActions({
    onActioned: optimisticRemove,
    onError: reload,
  });

  if (loading || !data) return <p className="text-muted-foreground p-8">Carregando alertas...</p>;

  if (data.counts.total === 0) {
    return (
      <div className="rounded-xl bg-card glass-border p-8 text-center text-muted-foreground">
        Nenhum alerta pendente. Volte aqui depois que sincronizar com Clinicorp.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <MiniCard label="Recall" value={data.counts.recall} />
        <MiniCard label="Inativos" value={data.counts.inactive} />
        <MiniCard label="Pos-consulta" value={data.counts.postconsulta} />
      </div>

      {data.overdue.length > 0 && (
        <Section
          title={`Atrasados (${data.overdue.length})`}
          reminders={data.overdue}
          busy={busy}
          openMenu={openMenu}
          setOpenMenu={setOpenMenu}
          handleAction={handleAction}
        />
      )}
      {data.urgent.length > 0 && (
        <Section
          title={`Urgentes (${data.urgent.length})`}
          reminders={data.urgent}
          busy={busy}
          openMenu={openMenu}
          setOpenMenu={setOpenMenu}
          handleAction={handleAction}
        />
      )}
      {data.upcoming.length > 0 && (
        <Section
          title={`Em breve (${data.upcoming.length})`}
          reminders={data.upcoming}
          busy={busy}
          openMenu={openMenu}
          setOpenMenu={setOpenMenu}
          handleAction={handleAction}
        />
      )}
    </div>
  );
}

function MiniCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-card glass-border p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-display text-2xl font-bold">{value}</p>
    </div>
  );
}

interface SectionProps {
  title: string;
  reminders: Reminder[];
  busy: Set<string>;
  openMenu: string | null;
  setOpenMenu: (k: string | null) => void;
  handleAction: (key: string, kind: import("@/lib/reminders/use-reminder-actions").ActionKind) => Promise<void>;
}

function Section({ title, reminders, busy, openMenu, setOpenMenu, handleAction }: SectionProps) {
  return (
    <div className="space-y-2">
      <h3 className="font-medium text-sm">{title}</h3>
      <div className="rounded-xl bg-card glass-border divide-y divide-border/50">
        {reminders.map((r) => (
          <ReminderRow
            key={r.key}
            reminder={r}
            busy={busy.has(r.key)}
            menuOpen={openMenu === r.key}
            onMenuToggle={() => setOpenMenu(openMenu === r.key ? null : r.key)}
            onAction={(kind) => handleAction(r.key, kind)}
          />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Type check + lint**

```bash
npx tsc --noEmit && npm run lint
```

Expected: 0 erros.

- [ ] **Step 6: Smoke test manual da página /patients**

Não rodar `npm run dev` no subagent. O controller (Bruno) valida depois que tudo terminar. Pular esse step.

- [ ] **Step 7: Commit**

```bash
git add src/lib/reminders/use-reminder-actions.ts src/components/dashboard/reminder-row.tsx src/components/dashboard/patient-alerts.tsx
git commit -m "refactor: extrai useReminderActions + ReminderRow do PatientAlerts (DASH-11)"
```

---

## Task 3: Estender `LeadDetailDrawer` com seção de alertas

**Files:**
- Modify: `src/components/dashboard/lead-detail-drawer.tsx`

- [ ] **Step 1: Adicionar tipo `Reminder` ao topo do arquivo**

Localizar a linha 1-9 do drawer (imports + props). Adicionar import:

```ts
import { useReminderActions } from "@/lib/reminders/use-reminder-actions";
import { ReminderRow, type Reminder } from "@/components/dashboard/reminder-row";
```

- [ ] **Step 2: Adicionar tipos pro payload de `/api/reminders`**

Logo após o `interface LeadDetail` (que termina por volta da linha 39), adicionar:

```ts
interface RemindersPayload {
  overdue: Reminder[];
  urgent: Reminder[];
  upcoming: Reminder[];
  counts: { total: number };
}
```

- [ ] **Step 3: Adicionar fetch + filtro de reminders no componente**

Dentro de `LeadDetailDrawer`, logo após `const [loading, setLoading] = useState(false);` (linha 92), adicionar:

```tsx
  const [alerts, setAlerts] = useState<Reminder[]>([]);
  const [allReminders, setAllReminders] = useState<Reminder[] | null>(null);
```

Logo após o `useEffect` que busca o lead (linha 94-110), adicionar novo `useEffect` que busca reminders quando o drawer abre:

```tsx
  useEffect(() => {
    if (!leadId) {
      setAllReminders(null);
      setAlerts([]);
      return;
    }
    const controller = new AbortController();
    fetch("/api/reminders", { signal: controller.signal })
      .then((r) => r.json())
      .then((json) => {
        const p: RemindersPayload | undefined = json.data;
        if (!p) {
          setAllReminders([]);
          return;
        }
        setAllReminders([...p.overdue, ...p.urgent, ...p.upcoming]);
      })
      .catch((err) => {
        if (err.name !== "AbortError") setAllReminders([]);
      });
    return () => controller.abort();
  }, [leadId]);
```

E adicionar mais um `useEffect` que filtra os reminders pelo `patient.id` quando ambos carregam:

```tsx
  useEffect(() => {
    if (!data?.patient?.id || allReminders === null) {
      setAlerts([]);
      return;
    }
    const patientId = data.patient.id;
    setAlerts(allReminders.filter((r) => r.patientId === patientId));
  }, [data, allReminders]);
```

- [ ] **Step 4: Adicionar hook `useReminderActions` no componente**

Logo após os useEffects (antes do `if (!leadId) return null;`), adicionar:

```tsx
  const { busy, openMenu, setOpenMenu, handleAction } = useReminderActions({
    onActioned: (key: string) => setAlerts((prev) => prev.filter((r) => r.key !== key)),
    onError: () => {
      // rollback: refaz fetch
      if (data?.patient?.id) {
        fetch("/api/reminders")
          .then((r) => r.json())
          .then((json) => {
            const p: RemindersPayload | undefined = json.data;
            if (!p || !data.patient) return;
            const patientId = data.patient.id;
            const all = [...p.overdue, ...p.urgent, ...p.upcoming];
            setAlerts(all.filter((r) => r.patientId === patientId));
          })
          .catch(() => {});
      }
    },
  });
```

- [ ] **Step 5: Renderizar a seção "Alertas ativos" antes da seção "Jornada"**

Localizar a seção `<div>` que tem o `<h3>` "Jornada" (linha 210-248 do arquivo atual). Inserir IMEDIATAMENTE ANTES dela (entre o `</dl>` e o `<div>` do "Jornada"):

```tsx
            {alerts.length > 0 && (
              <div>
                <h3 className="font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                  Alertas ativos ({alerts.length})
                </h3>
                <div className="rounded-xl bg-card glass-border divide-y divide-border/50">
                  {alerts.map((r) => (
                    <ReminderRow
                      key={r.key}
                      reminder={r}
                      busy={busy.has(r.key)}
                      menuOpen={openMenu === r.key}
                      onMenuToggle={() => setOpenMenu(openMenu === r.key ? null : r.key)}
                      onAction={(kind) => handleAction(r.key, kind)}
                      hidePatientLink
                    />
                  ))}
                </div>
              </div>
            )}
```

- [ ] **Step 6: Type check + lint**

```bash
npx tsc --noEmit && npm run lint
```

Expected: 0 erros.

- [ ] **Step 7: Commit**

```bash
git add src/components/dashboard/lead-detail-drawer.tsx
git commit -m "feat: drawer mostra alertas ativos do paciente (DASH-11)"
```

---

## Task 4: Bloco "Leads no funil" na página de Captação

Adiciona a lista de leads com 4 tabs e integra com o `LeadDetailDrawer` já existente.

**Files:**
- Modify: `src/app/dashboard/captacao/page.tsx`

- [ ] **Step 1: Adicionar imports**

No topo de `src/app/dashboard/captacao/page.tsx`, adicionar (logo após o import de `useStickyDateRange`):

```ts
import { LeadDetailDrawer } from "@/components/dashboard/lead-detail-drawer";
```

- [ ] **Step 2: Adicionar interface `LeadListItem`**

Antes de `interface DashboardData` (perto da linha 32), adicionar:

```ts
interface LeadListItem {
  id: string;
  name: string;
  phone: string | null;
  kommoStatus: string | null;
  statusName: string | null;
  statusColor: string | null;
  agendamentoAt: string | null;
  patient: {
    id: string;
    procedures: { statusDescription: string | null }[];
  } | null;
}

type LeadTab = "todos" | "agendados" | "fecharam" | "sem-agendar";
```

- [ ] **Step 3: Adicionar estado e fetch dos leads**

Dentro do `DashboardPage()`, logo após o `const [dateRange, setDateRange] = useState({ from: "", to: "" });`, adicionar:

```tsx
  const [leads, setLeads] = useState<LeadListItem[]>([]);
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [leadsError, setLeadsError] = useState(false);
  const [leadTab, setLeadTab] = useState<LeadTab>("todos");
  const [visibleCount, setVisibleCount] = useState(50);
  const [openLeadId, setOpenLeadId] = useState<string | null>(null);
```

Adicionar um novo `useEffect` que busca os leads quando o range muda, logo após o `useEffect` existente que chama `fetchData()`:

```tsx
  useEffect(() => {
    if (!clinic) return;
    setLeadsLoading(true);
    setLeadsError(false);
    const params = new URLSearchParams({ clinicId: clinic.id });
    if (dateRange.from) params.set("from", dateRange.from);
    if (dateRange.to) params.set("to", dateRange.to);
    fetch(`/api/leads?${params}`)
      .then((res) => res.json())
      .then((json) => {
        setLeads(json.data ?? []);
        setVisibleCount(50);
      })
      .catch(() => setLeadsError(true))
      .finally(() => setLeadsLoading(false));
  }, [clinic, dateRange]);
```

- [ ] **Step 4: Adicionar helpers de filtro/contagem antes do `return`**

Logo antes da linha `return (` no componente, adicionar:

```tsx
  const hasApprovedProc = (l: LeadListItem) =>
    !!l.patient && l.patient.procedures.some((p) => p.statusDescription === "Aprovado");

  const counts = {
    todos: leads.length,
    agendados: leads.filter((l) => l.agendamentoAt !== null && !hasApprovedProc(l)).length,
    fecharam: leads.filter((l) => hasApprovedProc(l)).length,
    semAgendar: leads.filter((l) => l.agendamentoAt === null).length,
  };

  const filteredLeads = leads.filter((l) => {
    if (leadTab === "agendados") return l.agendamentoAt !== null && !hasApprovedProc(l);
    if (leadTab === "fecharam") return hasApprovedProc(l);
    if (leadTab === "sem-agendar") return l.agendamentoAt === null;
    return true;
  });
  const visibleLeads = filteredLeads.slice(0, visibleCount);
  const hasMoreLeads = filteredLeads.length > visibleCount;
```

- [ ] **Step 5: Renderizar o bloco no final do JSX**

Localizar o último `</div>` do componente (que fecha o `<div className="space-y-6">`). Logo antes dele E depois do bloco do "Insight automatico", inserir:

```tsx
      {/* [DASH-11] Lista de leads no funil — tabs por estagio + drawer ao clicar.
          Carrega de /api/leads (mesmo endpoint da pagina /leads), respeita filtro
          de data global. Cada linha abre o LeadDetailDrawer (timeline + procs +
          alertas ativos do paciente). */}
      <div className="rounded-xl bg-card p-6 glass-border">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg font-semibold">Leads no funil</h2>
          <span className="text-xs text-muted-foreground">
            {counts.todos} lead{counts.todos === 1 ? "" : "s"}
          </span>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-border mb-4 overflow-x-auto">
          <TabButton active={leadTab === "todos"} onClick={() => { setLeadTab("todos"); setVisibleCount(50); }}>
            Todos ({counts.todos})
          </TabButton>
          <TabButton active={leadTab === "agendados"} onClick={() => { setLeadTab("agendados"); setVisibleCount(50); }}>
            Agendados ({counts.agendados})
          </TabButton>
          <TabButton active={leadTab === "fecharam"} onClick={() => { setLeadTab("fecharam"); setVisibleCount(50); }}>
            Fecharam ({counts.fecharam})
          </TabButton>
          <TabButton active={leadTab === "sem-agendar"} onClick={() => { setLeadTab("sem-agendar"); setVisibleCount(50); }}>
            Sem agendar ({counts.semAgendar})
          </TabButton>
        </div>

        {leadsLoading ? (
          <div className="space-y-2">
            <div className="h-10 rounded bg-muted/30 animate-pulse" />
            <div className="h-10 rounded bg-muted/30 animate-pulse" />
            <div className="h-10 rounded bg-muted/30 animate-pulse" />
          </div>
        ) : leadsError ? (
          <p className="text-sm text-destructive">Erro ao carregar leads. Tente recarregar a pagina.</p>
        ) : filteredLeads.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem leads nessa categoria no periodo.</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50 text-[10px] uppercase tracking-wider text-muted-foreground">
                    <th className="text-left font-medium py-2 pr-3">Nome</th>
                    <th className="text-left font-medium py-2 px-3">Telefone</th>
                    <th className="text-left font-medium py-2 px-3">Status</th>
                    <th className="text-right font-medium py-2 pl-3 w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {visibleLeads.map((l) => (
                    <tr
                      key={l.id}
                      onClick={() => setOpenLeadId(l.id)}
                      className="border-b border-border/30 last:border-0 hover:bg-muted/30 cursor-pointer transition-colors"
                    >
                      <td className="py-3 pr-3 font-medium">{l.name}</td>
                      <td className="py-3 px-3 text-muted-foreground">{l.phone ?? "—"}</td>
                      <td className="py-3 px-3">
                        <span
                          className="inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-medium bg-muted text-foreground"
                          style={l.statusColor ? {
                            backgroundColor: `${l.statusColor}33`,
                            color: l.statusColor,
                          } : undefined}
                        >
                          {l.statusName || l.kommoStatus || "—"}
                        </span>
                      </td>
                      <td className="py-3 pl-3 text-right text-muted-foreground">→</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between mt-4 text-xs text-muted-foreground">
              <span>
                Mostrando {visibleLeads.length} de {filteredLeads.length} leads
              </span>
              {hasMoreLeads && (
                <button
                  onClick={() => setVisibleCount((c) => c + 50)}
                  className="rounded-md bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20"
                >
                  Ver mais leads
                </button>
              )}
            </div>
          </>
        )}
      </div>

      <LeadDetailDrawer leadId={openLeadId} onClose={() => setOpenLeadId(null)} />
```

- [ ] **Step 6: Adicionar componente `TabButton` no fim do arquivo**

Após a função `XIcon` (último componente do arquivo), adicionar:

```tsx
function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={
        "whitespace-nowrap px-4 py-2 text-sm font-medium border-b-2 -mb-px " +
        (active
          ? "border-primary text-primary"
          : "border-transparent text-muted-foreground hover:text-foreground")
      }
    >
      {children}
    </button>
  );
}
```

- [ ] **Step 7: Type check + lint**

```bash
npx tsc --noEmit && npm run lint
```

Expected: 0 erros.

- [ ] **Step 8: Build sanity check**

```bash
npm run build
```

Expected: build completo.

- [ ] **Step 9: Commit**

```bash
git add src/app/dashboard/captacao/page.tsx
git commit -m "feat: lista de leads no final da pagina de captacao com tabs (DASH-11)"
```

---

## Task 5: Bump versão + changelog

**Files:**
- Modify: `package.json`
- Modify: `src/lib/version.ts`

- [ ] **Step 1: Bump `package.json`**

Trocar `"version": "0.47.0"` por `"version": "0.48.0"`.

- [ ] **Step 2: Bump `version.ts` + entrada CHANGELOG**

Trocar `export const APP_VERSION = "0.47.0";` por `export const APP_VERSION = "0.48.0";`.

Adicionar no topo do array `CHANGELOG` (antes da entrada `0.47.0`):

```ts
  {
    version: "0.48.0",
    date: "2026-05-19",
    type: "minor",
    changes: [
      "DASH-11: Lista de leads no final do Dashboard de Captacao com 4 tabs (Todos / Agendados / Fecharam / Sem agendar)",
      "Click em um lead abre LeadDetailDrawer (timeline + procedimentos)",
      "Drawer agora inclui secao 'Alertas ativos' quando o lead virou paciente e tem reminder pendente",
      "Refactor: useReminderActions hook + ReminderRow component extraidos de PatientAlerts pra compartilhar com o drawer",
      "Lista respeita o filtro de data global, pagina 50 por vez client-side (endpoint /api/leads ja existente, sem mudancas)",
    ],
  },
```

- [ ] **Step 3: Type check + lint**

```bash
npx tsc --noEmit && npm run lint
```

Expected: 0 erros.

- [ ] **Step 4: Commit**

```bash
git add package.json src/lib/version.ts
git commit -m "chore: bump 0.48.0 (DASH-11)"
```

---

## Task 6: Validação pré-PR + abrir PR

**Files:** —

- [ ] **Step 1: Suite completa de validação**

```bash
npm run lint && npx tsc --noEmit && npm test && npm run build
```

Expected: tudo passa.

- [ ] **Step 2: Worktree limpa**

```bash
git status
```

Expected: `nothing to commit, working tree clean`.

- [ ] **Step 3: Push da branch**

```bash
git push -u origin feat/dash-11-captacao-leads-list
```

- [ ] **Step 4: Abrir PR**

```bash
gh pr create --title "feat: lista de leads no Dashboard de Captacao (DASH-11, v0.48.0)" --body "$(cat <<'EOF'
## Summary
- Novo bloco "Leads no funil" no final de `/dashboard/captacao` com 4 tabs (Todos / Agendados / Fecharam / Sem agendar)
- Click em um lead abre `LeadDetailDrawer` (timeline + procedimentos)
- Drawer agora mostra secao "Alertas ativos" quando o lead virou paciente e tem reminder pendente
- Refactor: `useReminderActions` hook + `ReminderRow` component extraidos de `PatientAlerts` pra compartilhar com o drawer

## Backlog
- Fecha item DASH-11 em `docs/IMPROVEMENTS.md`

## Migration
- Nao tem. Mudanca puramente frontend.

## Test plan
- [ ] CI verde (lint + tsc + build)
- [x] Unit local: 216 testes passando (sem novos)
- [x] Build local OK
- [ ] Apos deploy: abrir /dashboard/captacao -> conferir bloco "Leads no funil" no final
- [ ] Trocar entre as 4 tabs -> conferir contagens batendo com KPIs em cima
- [ ] Clicar num lead -> drawer abre com timeline + procedimentos
- [ ] Clicar num lead que virou paciente com alerta pendente -> conferir secao "Alertas ativos"
- [ ] Clicar em "Tratar" no alerta -> ação executa e alerta some
- [ ] Conferir /dashboard/patients?tab=alertas -> comportamento inalterado (refactor sem regressao)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 5: Aguardar CI verde**

```bash
gh pr checks --watch
```

Expected: todos os checks `pass`.

---

## Task 7: Pós-merge — fechar item no backlog

Executar no clone principal após o squash-merge.

**Files:**
- Modify: `docs/IMPROVEMENTS.md` (no clone principal)

- [ ] **Step 1: Voltar ao clone principal e atualizar main**

```bash
cd /Users/macintosh/Documents/Claude.Code/clinifunnel
git checkout main && git pull origin main
```

- [ ] **Step 2: Mover DASH-11 para "Concluídos"**

Em `docs/IMPROVEMENTS.md`, remover a entrada de "Em andamento" e adicionar na seção "Concluidos" (perto do topo, em ordem cronológica):

```markdown
- **[DASH-11]** Lista de leads no Dashboard de Captacao. [PR #XX](https://github.com/brunopalhardi/clinifunnel/pull/XX) — v0.48.0
```

(Substituir `#XX` pelo número real do PR.)

- [ ] **Step 3: Commit + push em chore branch**

```bash
git checkout -b chore/dash-11-concluido
git add docs/IMPROVEMENTS.md
git commit -m "chore: move DASH-11 para Concluidos"
git push -u origin chore/dash-11-concluido
gh pr create --title "chore: move DASH-11 para Concluidos" --body "Move item DASH-11 do backlog 'Em andamento' para 'Concluidos' apos merge do PR #XX (v0.48.0)."
```

- [ ] **Step 4: Limpar worktree**

```bash
git worktree remove ../clinifunnel-feat-dash-11
git branch -D feat/dash-11-captacao-leads-list
```

---

## Self-Review checklist

- [x] **Spec coverage:**
  - UI position (último bloco) — Task 4
  - Tabs (Todos / Agendados / Fecharam / Sem agendar) com contagens — Task 4
  - Filtro de data global respeitado — Task 4 (fetch usa `dateRange` do estado)
  - Tabela Nome/Telefone/Status — Task 4
  - Paginação client-side (50 + "Ver mais") — Task 4
  - Empty state por tab — Task 4
  - Loading/error states — Task 4
  - Drawer estendido com alertas — Task 3
  - Filtro client-side de reminders por `patient.id` — Task 3
  - Componente compartilhado `ReminderRow` + hook `useReminderActions` — Task 2
  - `PatientAlerts` refatorado pra usar os dois — Task 2
  - Bump 0.48.0 + CHANGELOG — Task 5
  - Backlog DASH-11 — Task 1 + Task 7

- [x] **Placeholder scan:** nenhum TBD/TODO inline. Todos os steps mostram código exato ou comando exato.

- [x] **Type consistency:**
  - `Reminder` definido em `reminder-row.tsx` e importado nos demais (PatientAlerts, drawer).
  - `ActionKind` definido em `use-reminder-actions.ts` e importado onde necessário.
  - `useReminderActions` assina `{ onActioned, onError }` consistente entre Task 2 (PatientAlerts) e Task 3 (drawer).
  - `LeadListItem` em `captacao/page.tsx` casa com o shape de `/api/leads` (lead com `patient` + `procedures` mínimos pra detectar status "Aprovado").

- [x] **Convenções do projeto:** worktree dedicada, bump duplo (package.json + version.ts), commits em pt-BR formato `tipo: descricao`, sem `--no-verify`/`--admin`.
