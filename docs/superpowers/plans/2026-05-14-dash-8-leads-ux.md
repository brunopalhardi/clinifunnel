# DASH-8 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Esconder LTV & ROAS + Campanhas da sidebar, adicionar bloco "Por status" filtrável na página de leads, e drawer lateral de detalhe ao clicar num lead.

**Architecture:** Mudanças focadas em sidebar/leads page. Lib pura testável pra agregação de status (TDD). Endpoint novo de read multi-tenant pra payload do drawer. Drawer puro client-side (sem rota nova, sem mudança de URL).

**Tech Stack:** Next.js 14 App Router, TypeScript strict, Tailwind, Prisma. Vitest com jsdom. Spec: `docs/superpowers/specs/2026-05-14-dash-8-leads-ux-design.md`.

---

## File Structure

| Arquivo | Tipo | Responsabilidade |
|---|---|---|
| `src/components/layout/sidebar.tsx` | edit | Flag `hidden?` em `navItems` + filter no `.map` |
| `src/lib/leads/group-by-status.ts` | novo | Função pura `groupLeadsByStatus(leads)` testável |
| `src/lib/leads/group-by-status.test.ts` | novo | 5 unit tests da função |
| `src/app/api/leads/[id]/route.ts` | novo | GET detalhe (lead + patient + procedures), multi-tenant |
| `src/components/dashboard/lead-detail-drawer.tsx` | novo | Drawer slide-in com fetch on-open, timeline, link Kommo |
| `src/app/dashboard/leads/page.tsx` | edit | + bloco "Por status" + state filtro + integração drawer |
| `src/lib/version.ts` | edit | bump `0.45.0` + entrada CHANGELOG |
| `package.json` | edit | `version: "0.45.0"` |
| `docs/IMPROVEMENTS.md` | edit | move `[DASH-8]` pra Concluídos |

---

## Pre-flight: Worktree Setup

### Task 0: Criar worktree

**Files:**
- Create: worktree em `../clinifunnel-dash-8`

- [ ] **Step 0.1: Garantir main atualizado**

Run: `git fetch origin main`

- [ ] **Step 0.2: Criar worktree**

Run: `git worktree add -b feat/dash-8-leads-ux ../clinifunnel-dash-8 origin/main`

Expected: "Preparing worktree (new branch 'feat/dash-8-leads-ux')"

- [ ] **Step 0.3: Instalar deps**

Run: `cd ../clinifunnel-dash-8 && npm ci`

Expected: "added N packages"

- [ ] **Step 0.4: Gerar Prisma client**

Run: `cd ../clinifunnel-dash-8 && npx prisma generate`

Expected: "Generated Prisma Client"

- [ ] **Step 0.5: Confirmar suite base verde**

Run: `cd ../clinifunnel-dash-8 && npx tsc --noEmit && npm test`

Expected: tsc sem erros, 188 testes passam (estado de v0.44.1).

---

## Task 1: Esconder LTV & ROAS + Campanhas da sidebar

**Files:**
- Modify: `src/components/layout/sidebar.tsx`

- [ ] **Step 1.1: Adicionar flag `hidden` no tipo NavItem**

Abrir `src/components/layout/sidebar.tsx`. Localizar a definição do tipo `NavItem` (ou inline na declaração de `navItems`). Como hoje o array é declarado inline, vou trocar o array pra ter o campo opcional.

Edit:

```ts
// antes
const navItems = [
  { href: "/dashboard/captacao", label: "Captacao", icon: "BarChart3" },
  { href: "/dashboard/operacao", label: "Operacao", icon: "DollarSign" },
  { href: "/dashboard/leads", label: "Leads", icon: "Users" },
  { href: "/dashboard/campaigns", label: "Campanhas", icon: "Megaphone" },
  { href: "/dashboard/procedures", label: "Procedimentos", icon: "ClipboardCheck" },
  { href: "/dashboard/ltv", label: "LTV & ROAS", icon: "TrendingUp" },
  { href: "/dashboard/patients", label: "Pacientes", icon: "UserCheck" },
  { href: "/dashboard/settings", label: "Configuracoes", icon: "Settings" },
];

// depois
interface NavItem {
  href: string;
  label: string;
  icon: string;
  hidden?: boolean;
}

const navItems: NavItem[] = [
  { href: "/dashboard/captacao", label: "Captacao", icon: "BarChart3" },
  { href: "/dashboard/operacao", label: "Operacao", icon: "DollarSign" },
  { href: "/dashboard/leads", label: "Leads", icon: "Users" },
  { href: "/dashboard/campaigns", label: "Campanhas", icon: "Megaphone", hidden: true },
  { href: "/dashboard/procedures", label: "Procedimentos", icon: "ClipboardCheck" },
  { href: "/dashboard/ltv", label: "LTV & ROAS", icon: "TrendingUp", hidden: true },
  { href: "/dashboard/patients", label: "Pacientes", icon: "UserCheck" },
  { href: "/dashboard/settings", label: "Configuracoes", icon: "Settings" },
];
```

- [ ] **Step 1.2: Filtrar no `.map` que renderiza os itens**

Localizar o `.map(...)` dentro do `<nav>` (`navItems.map((item) => {...})`). Substituir por `navItems.filter((i) => !i.hidden).map((item) => {...})`.

- [ ] **Step 1.3: Validar tsc + build**

Run: `npx tsc --noEmit`

Expected: sem erros.

- [ ] **Step 1.4: Commit**

```bash
git add src/components/layout/sidebar.tsx
git commit -m "feat: oculta LTV & ROAS e Campanhas da sidebar (DASH-8 part 1/4)"
```

---

## Task 2: Função pura `groupLeadsByStatus` (TDD)

**Files:**
- Create: `src/lib/leads/group-by-status.ts`
- Create: `src/lib/leads/group-by-status.test.ts`

- [ ] **Step 2.1: Criar diretório `src/lib/leads/`**

Run: `mkdir -p src/lib/leads`

- [ ] **Step 2.2: Escrever teste primeiro (red)**

Create `src/lib/leads/group-by-status.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { groupLeadsByStatus, type LeadForGrouping } from "./group-by-status";

function lead(overrides: Partial<LeadForGrouping>): LeadForGrouping {
  return {
    id: "L1",
    kommoStatus: "82505867",
    statusName: "Agendado",
    statusColor: "#4caf50",
    ...overrides,
  };
}

describe("groupLeadsByStatus", () => {
  it("retorna array vazio quando nao ha leads", () => {
    expect(groupLeadsByStatus([])).toEqual([]);
  });

  it("agrupa leads pelo kommoStatus", () => {
    const leads: LeadForGrouping[] = [
      lead({ id: "L1", kommoStatus: "A", statusName: "Em qualif", statusColor: "#999" }),
      lead({ id: "L2", kommoStatus: "A", statusName: "Em qualif", statusColor: "#999" }),
      lead({ id: "L3", kommoStatus: "B", statusName: "Agendado", statusColor: "#0f0" }),
    ];
    const result = groupLeadsByStatus(leads);
    expect(result).toHaveLength(2);
    expect(result.find((g) => g.id === "A")?.count).toBe(2);
    expect(result.find((g) => g.id === "B")?.count).toBe(1);
  });

  it("ordena por count desc", () => {
    const leads: LeadForGrouping[] = [
      lead({ id: "L1", kommoStatus: "A", statusName: "A", statusColor: null }),
      lead({ id: "L2", kommoStatus: "B", statusName: "B", statusColor: null }),
      lead({ id: "L3", kommoStatus: "B", statusName: "B", statusColor: null }),
      lead({ id: "L4", kommoStatus: "B", statusName: "B", statusColor: null }),
    ];
    const result = groupLeadsByStatus(leads);
    expect(result[0].id).toBe("B");
    expect(result[0].count).toBe(3);
    expect(result[1].id).toBe("A");
    expect(result[1].count).toBe(1);
  });

  it("agrupa leads sem kommoStatus no bucket __none__", () => {
    const leads: LeadForGrouping[] = [
      lead({ id: "L1", kommoStatus: null, statusName: null, statusColor: null }),
      lead({ id: "L2", kommoStatus: null, statusName: null, statusColor: null }),
    ];
    const result = groupLeadsByStatus(leads);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("__none__");
    expect(result[0].name).toBe("Sem status");
    expect(result[0].count).toBe(2);
  });

  it("preserva statusColor do primeiro lead de cada grupo", () => {
    const leads: LeadForGrouping[] = [
      lead({ id: "L1", kommoStatus: "A", statusName: "Agendado", statusColor: "#aabb00" }),
      lead({ id: "L2", kommoStatus: "A", statusName: "Agendado", statusColor: null }),
    ];
    const result = groupLeadsByStatus(leads);
    expect(result[0].color).toBe("#aabb00");
  });

  it("soma de counts == total de leads", () => {
    const leads: LeadForGrouping[] = [
      lead({ id: "L1", kommoStatus: "A", statusName: "A", statusColor: null }),
      lead({ id: "L2", kommoStatus: "B", statusName: "B", statusColor: null }),
      lead({ id: "L3", kommoStatus: null, statusName: null, statusColor: null }),
    ];
    const result = groupLeadsByStatus(leads);
    const sum = result.reduce((s, g) => s + g.count, 0);
    expect(sum).toBe(leads.length);
  });
});
```

- [ ] **Step 2.3: Rodar teste e confirmar falha**

Run: `npx vitest run src/lib/leads/group-by-status.test.ts`

Expected: 6 falhas todas com "Cannot find module './group-by-status'".

- [ ] **Step 2.4: Implementar minimal (green)**

Create `src/lib/leads/group-by-status.ts`:

```ts
export interface LeadForGrouping {
  id: string;
  kommoStatus: string | null;
  statusName: string | null;
  statusColor: string | null;
}

export interface StatusGroup {
  id: string;
  name: string;
  color: string | null;
  count: number;
}

const NONE_BUCKET = "__none__";

export function groupLeadsByStatus(leads: LeadForGrouping[]): StatusGroup[] {
  const map = new Map<string, StatusGroup>();
  for (const lead of leads) {
    const id = lead.kommoStatus ?? NONE_BUCKET;
    const existing = map.get(id);
    if (existing) {
      existing.count++;
    } else {
      map.set(id, {
        id,
        name: lead.statusName ?? (id === NONE_BUCKET ? "Sem status" : id),
        color: lead.statusColor,
        count: 1,
      });
    }
  }
  return Array.from(map.values()).sort((a, b) => b.count - a.count);
}
```

- [ ] **Step 2.5: Rodar teste e confirmar passa**

Run: `npx vitest run src/lib/leads/group-by-status.test.ts`

Expected: 6 passed.

- [ ] **Step 2.6: Rodar suite completa pra garantir que nada quebrou**

Run: `npm test`

Expected: 194 passed (188 anteriores + 6 novos).

- [ ] **Step 2.7: Commit**

```bash
git add src/lib/leads/group-by-status.ts src/lib/leads/group-by-status.test.ts
git commit -m "feat: groupLeadsByStatus puro com 6 testes (DASH-8 part 2/4)"
```

---

## Task 3: Endpoint `GET /api/leads/[id]`

**Files:**
- Create: `src/app/api/leads/[id]/route.ts`

- [ ] **Step 3.1: Criar diretório e arquivo**

Run: `mkdir -p src/app/api/leads/\[id\]`

Create `src/app/api/leads/[id]/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthorizedClinicId, AuthError } from "@/lib/auth-guard";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

  // Multi-tenant: findFirst com clinicId obrigatorio.
  const lead = await prisma.lead.findFirst({
    where: { id: params.id, clinicId },
    include: {
      patient: {
        include: {
          procedures: {
            orderBy: { createdAt: "asc" },
            select: {
              id: true,
              name: true,
              value: true,
              discountAmount: true,
              statusDescription: true,
              completedAt: true,
              createdAt: true,
            },
          },
        },
      },
    },
  });

  if (!lead) {
    return NextResponse.json({ error: "Lead nao encontrado" }, { status: 404 });
  }

  // Enriquecer com statusName/Color via Clinic.kommoStages (mesmo padrao de /api/leads).
  const clinic = await prisma.clinic.findUnique({
    where: { id: clinicId },
    select: { kommoStages: true, kommoSubdomain: true },
  });
  const stagesMap = (clinic?.kommoStages ?? {}) as Record<
    string,
    { name: string; color: string; pipelineId: string }
  >;
  const stage = lead.kommoStatus ? stagesMap[lead.kommoStatus] : null;

  return NextResponse.json({
    data: {
      id: lead.id,
      kommoLeadId: lead.kommoLeadId,
      name: lead.name,
      phone: lead.phone,
      channel: lead.channel,
      utmSource: lead.utmSource,
      utmMedium: lead.utmMedium,
      utmCampaign: lead.utmCampaign,
      utmContent: lead.utmContent,
      kommoStatus: lead.kommoStatus,
      statusName: stage?.name ?? lead.kommoStatus ?? null,
      statusColor: stage?.color ?? null,
      kommoCreatedAt: lead.kommoCreatedAt,
      createdAt: lead.createdAt,
      agendamentoAt: lead.agendamentoAt,
      kommoSubdomain: clinic?.kommoSubdomain ?? null,
      patient: lead.patient
        ? {
            id: lead.patient.id,
            firstContact: lead.patient.firstContact,
            procedures: lead.patient.procedures,
          }
        : null,
    },
  });
}
```

- [ ] **Step 3.2: Verificar imports/types via tsc**

Run: `npx tsc --noEmit`

Expected: sem erros. Se Lead não tiver campo `firstContact` no Patient ou os nomes diferirem, ajustar baseado no `prisma/schema.prisma`.

- [ ] **Step 3.3: Atualizar middleware se necessário**

Verificar `src/middleware.ts` — se a rota `/api/leads/:path*` já está coberta, OK. Senão adicionar.

Run: `grep -n "api/leads" src/middleware.ts`

Expected: deve aparecer linha com `/api/leads/:path*` ou equivalente. Se aparecer SÓ `/api/leads` (sem `:path*`), incluir o sub-path.

- [ ] **Step 3.4: Commit**

```bash
git add src/app/api/leads/\[id\]/route.ts
git commit -m "feat: endpoint GET /api/leads/[id] com payload pro drawer (DASH-8 part 3a/4)"
```

---

## Task 4: Componente `LeadDetailDrawer`

**Files:**
- Create: `src/components/dashboard/lead-detail-drawer.tsx`

- [ ] **Step 4.1: Criar arquivo do componente**

Create `src/components/dashboard/lead-detail-drawer.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface LeadDetailDrawerProps {
  leadId: string | null;
  onClose: () => void;
}

interface LeadDetail {
  id: string;
  kommoLeadId: string;
  name: string;
  phone: string | null;
  channel: string;
  utmSource: string | null;
  utmCampaign: string | null;
  kommoStatus: string | null;
  statusName: string | null;
  statusColor: string | null;
  kommoCreatedAt: string | null;
  createdAt: string;
  agendamentoAt: string | null;
  kommoSubdomain: string | null;
  patient: {
    id: string;
    firstContact: string;
    procedures: {
      id: string;
      name: string;
      value: number;
      discountAmount: number;
      statusDescription: string | null;
      completedAt: string | null;
      createdAt: string;
    }[];
  } | null;
}

interface TimelineEvent {
  date: string;
  label: string;
  detail?: string;
  link?: { href: string; label: string };
  ok?: boolean;
}

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
const fmtFull = (d: string) =>
  new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

function buildTimeline(lead: LeadDetail): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  const createdAt = lead.kommoCreatedAt ?? lead.createdAt;
  events.push({ date: createdAt, label: "Lead capturado no Kommo" });
  if (lead.agendamentoAt) {
    events.push({ date: lead.agendamentoAt, label: "Agendado" });
  }
  if (lead.patient) {
    events.push({
      date: lead.patient.firstContact,
      label: "Virou paciente",
      link: { href: `/dashboard/patients/${lead.patient.id}`, label: "Ver perfil completo" },
    });
    for (const proc of lead.patient.procedures) {
      events.push({
        date: proc.completedAt ?? proc.createdAt,
        label: proc.name,
        detail: fmt(proc.value - (proc.discountAmount ?? 0)),
        ok: proc.statusDescription === "Aprovado",
      });
    }
  }
  return events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

export function LeadDetailDrawer({ leadId, onClose }: LeadDetailDrawerProps) {
  const [data, setData] = useState<LeadDetail | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!leadId) {
      setData(null);
      return;
    }
    setLoading(true);
    setData(null);
    const controller = new AbortController();
    fetch(`/api/leads/${leadId}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((json) => setData(json.data ?? null))
      .catch((err) => {
        if (err.name !== "AbortError") setData(null);
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [leadId]);

  useEffect(() => {
    if (!leadId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [leadId, onClose]);

  if (!leadId) return null;

  const timeline = data ? buildTimeline(data) : [];
  const kommoUrl =
    data?.kommoSubdomain && data?.kommoLeadId
      ? `https://${data.kommoSubdomain}.kommo.com/leads/detail/${data.kommoLeadId}`
      : null;

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-black/60 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="absolute right-0 top-0 h-full w-full max-w-md bg-card glass-border shadow-2xl overflow-y-auto">
        <div className="sticky top-0 flex items-start justify-between gap-3 border-b border-border/30 bg-card px-5 py-4">
          <div className="flex-1 min-w-0">
            <h2 className="font-display text-lg font-semibold truncate">
              {loading ? "Carregando..." : data?.name ?? "—"}
            </h2>
            {data?.statusName && (
              <span
                className="inline-flex mt-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium bg-muted text-foreground"
                style={
                  data.statusColor
                    ? { backgroundColor: `${data.statusColor}33`, color: data.statusColor }
                    : undefined
                }
              >
                {data.statusName}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
            aria-label="Fechar"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {loading && (
          <div className="px-5 py-6 text-sm text-muted-foreground">Carregando...</div>
        )}

        {!loading && data && (
          <div className="px-5 py-4 space-y-5">
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm">
              <dt className="text-muted-foreground">Telefone:</dt>
              <dd>{data.phone ?? "—"}</dd>
              <dt className="text-muted-foreground">Canal:</dt>
              <dd>{data.channel === "campaign" ? "Campanha" : "Orgânico"}</dd>
              {data.utmSource && (
                <>
                  <dt className="text-muted-foreground">UTM Source:</dt>
                  <dd>{data.utmSource}</dd>
                </>
              )}
              {data.utmCampaign && (
                <>
                  <dt className="text-muted-foreground">UTM Campaign:</dt>
                  <dd>{data.utmCampaign}</dd>
                </>
              )}
              <dt className="text-muted-foreground">Criado:</dt>
              <dd>{fmtFull(data.kommoCreatedAt ?? data.createdAt)}</dd>
              {data.agendamentoAt && (
                <>
                  <dt className="text-muted-foreground">Agendado:</dt>
                  <dd>{fmtFull(data.agendamentoAt)}</dd>
                </>
              )}
            </dl>

            <div>
              <h3 className="font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                Jornada
              </h3>
              <ol className="space-y-3">
                {timeline.map((ev, i) => (
                  <li key={i} className="flex gap-3">
                    <div className="flex flex-col items-center pt-1">
                      <span className={`h-2.5 w-2.5 rounded-full ${ev.ok === false ? "bg-muted-foreground" : "bg-primary"}`} />
                      {i < timeline.length - 1 && (
                        <span className="w-px flex-1 bg-border mt-1" />
                      )}
                    </div>
                    <div className="flex-1 pb-1">
                      <p className="text-xs text-muted-foreground">{fmtFull(ev.date)}</p>
                      <p className="text-sm">
                        {ev.label}
                        {ev.detail && <span className="ml-2 font-semibold">{ev.detail}</span>}
                        {ev.ok === true && <span className="ml-2 text-success">✓</span>}
                      </p>
                      {ev.link && (
                        <Link
                          href={ev.link.href}
                          className="text-xs text-primary hover:underline"
                        >
                          {ev.link.label} →
                        </Link>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            {kommoUrl && (
              <div className="border-t border-border/30 pt-4">
                <a
                  href={kommoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
                >
                  Abrir no Kommo
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M7 17 17 7M7 7h10v10" />
                  </svg>
                </a>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4.2: Validar tipos**

Run: `npx tsc --noEmit`

Expected: sem erros.

- [ ] **Step 4.3: Commit**

```bash
git add src/components/dashboard/lead-detail-drawer.tsx
git commit -m "feat: componente LeadDetailDrawer com timeline + link Kommo (DASH-8 part 3b/4)"
```

---

## Task 5: Integrar bloco "Por status" + drawer na página de leads

**Files:**
- Modify: `src/app/dashboard/leads/page.tsx`

- [ ] **Step 5.1: Adicionar imports**

Abrir `src/app/dashboard/leads/page.tsx`. Adicionar imports no topo (após os existentes):

```ts
import { groupLeadsByStatus, type LeadForGrouping } from "@/lib/leads/group-by-status";
import { LeadDetailDrawer } from "@/components/dashboard/lead-detail-drawer";
```

- [ ] **Step 5.2: Adicionar state `statusFilter` e `openLeadId`**

Localizar o bloco onde os `useState` ficam (logo após `useStickyDateRange`). Adicionar 2 states:

```ts
const [statusFilter, setStatusFilter] = useState<string | null>(null);
const [openLeadId, setOpenLeadId] = useState<string | null>(null);
```

- [ ] **Step 5.3: Computar `statusGroups` via useMemo**

Logo após os states, antes do `if (clinicLoading)`:

```ts
const statusGroups = useMemo(() => groupLeadsByStatus(leads as LeadForGrouping[]), [leads]);
```

Adicionar `useMemo` ao import do React.

- [ ] **Step 5.4: Aplicar `statusFilter` no `filtered`**

Localizar `const filtered = leads.filter(...)`. Adicionar a condição de `statusFilter`:

```ts
const filtered = leads.filter((l) => {
  if (statusFilter) {
    if (statusFilter === "__none__" && l.kommoStatus !== null) return false;
    if (statusFilter !== "__none__" && l.kommoStatus !== statusFilter) return false;
  }
  if (search && !l.name.toLowerCase().includes(search.toLowerCase()) && !(l.phone || "").includes(search)) return false;
  if (channelFilter !== "all" && l.channel !== channelFilter) return false;
  return true;
});
```

- [ ] **Step 5.5: Renderizar bloco "Por status"**

Localizar o grid de 3 KPIs (`<div className="grid grid-cols-3 gap-4">`). Logo APÓS esse `</div>` que fecha o grid, adicionar:

```tsx
{statusGroups.length > 0 && (
  <div>
    <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
      Por status (clique pra filtrar)
    </p>
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {statusGroups.map((g) => {
        const isActive = statusFilter === g.id;
        return (
          <button
            key={g.id}
            onClick={() => setStatusFilter((curr) => (curr === g.id ? null : g.id))}
            className={`flex items-center gap-2 rounded-xl bg-card p-3 glass-border text-left transition-all hover:bg-card/80 ${
              isActive ? "ring-2 ring-primary" : ""
            }`}
          >
            <span
              className="h-2.5 w-2.5 rounded-full shrink-0"
              style={{ backgroundColor: g.color ?? "#999" }}
            />
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-muted-foreground truncate">{g.name}</p>
              <p className="font-display text-lg font-bold">{g.count}</p>
            </div>
          </button>
        );
      })}
    </div>
  </div>
)}
```

- [ ] **Step 5.6: Tornar a linha da tabela clicável**

Localizar `<tr key={lead.id} className="border-b border-border/10 transition-colors hover:bg-muted/30">`. Trocar o `<tr>` por:

```tsx
<tr
  key={lead.id}
  onClick={() => setOpenLeadId(lead.id)}
  className="border-b border-border/10 transition-colors hover:bg-muted/30 cursor-pointer"
>
```

- [ ] **Step 5.7: Renderizar o drawer no fim do componente**

Logo antes do `</div>` que fecha o JSX raiz (último `</div>` antes do `);`), adicionar:

```tsx
<LeadDetailDrawer leadId={openLeadId} onClose={() => setOpenLeadId(null)} />
```

- [ ] **Step 5.8: Validar tipos + lint**

Run: `npx tsc --noEmit && npm run lint`

Expected: sem erros nem warnings.

- [ ] **Step 5.9: Rodar suite completa**

Run: `npm test`

Expected: 194 passed.

- [ ] **Step 5.10: Commit**

```bash
git add src/app/dashboard/leads/page.tsx
git commit -m "feat: bloco 'Por status' filtravel + drawer integrado na pagina de leads (DASH-8 part 4/4)"
```

---

## Task 6: Bump versão + CHANGELOG + IMPROVEMENTS + spec

**Files:**
- Modify: `package.json`
- Modify: `src/lib/version.ts`
- Modify: `docs/IMPROVEMENTS.md`
- Add (de main, untracked agora): `docs/superpowers/specs/2026-05-14-dash-8-leads-ux-design.md`

- [ ] **Step 6.1: Atualizar `package.json`**

Mudar `"version": "0.44.1"` pra `"version": "0.45.0"`.

- [ ] **Step 6.2: Atualizar `src/lib/version.ts`**

Mudar `APP_VERSION = "0.44.1"` pra `APP_VERSION = "0.45.0"` e adicionar entrada nova ANTES da entrada `0.44.1`:

```ts
{
  version: "0.45.0",
  date: "2026-05-14",
  type: "minor",
  changes: [
    "DASH-8: 3 ajustes acumulados pedidos pelo Bruno (esconder LTV/Campanhas, leads por status, drawer de detalhe)",
    "Sidebar: LTV & ROAS e Campanhas ocultados da nav via flag hidden no array navItems. Rotas continuam funcionais por URL direta — voltam ao menu quando comecarem os anuncios",
    "Leads: bloco 'Por status' com mini cards (1 por status do Kommo, cor + nome + count). Click no card filtra a tabela. Combina com busca + filtro de canal via AND. Mostra onde os leads estao parados no funil",
    "Leads: clicar num lead abre drawer lateral com info basica + timeline (capturado -> agendado -> virou paciente -> procedimentos) + link 'Abrir no Kommo'. URL nao muda (drawer puro, sem rota nova)",
    "Endpoint novo: GET /api/leads/[id] retorna lead enriquecido (statusName/Color via kommoStages cache) + patient + procedures, multi-tenant filtered",
    "Lib pura groupLeadsByStatus com 6 unit tests (agrupa por kommoStatus, bucket __none__ pra leads sem status, ordem por count desc)",
  ],
},
```

- [ ] **Step 6.3: Atualizar `docs/IMPROVEMENTS.md`**

Em "Concluidos", logo antes do item DASH-7a, inserir:

```markdown
- **[DASH-8] 3 ajustes acumulados (LTV/Campanhas hidden, leads por status, drawer de detalhe)** — PR #_TBD_ — v0.45.0
  Bruno enviou 3 ajustes agregados num PR so seguindo o padrao DASH-6/DASH-7a. (Item 1) LTV & ROAS e Campanhas saem do menu lateral via flag `hidden: true` em `navItems` (sidebar). Rotas `/dashboard/ltv` e `/dashboard/campaigns` continuam funcionais por URL direta — voltam ao menu quando comecarem os anuncios (1 caractere por item). (Item 2) Pagina `/dashboard/leads` ganha bloco "Por status" abaixo dos KPIs Total/Campanha/Organico com mini cards (1 por status do Kommo, bolinha colorida + nome humano + count, ordenado por count desc). Click filtra a tabela; click no card ativo limpa o filtro. Combina com busca/canal via AND. Edge case: leads sem `kommoStatus` viram bucket `__none__` ("Sem status"). Lib pura `groupLeadsByStatus` em `src/lib/leads/group-by-status.ts` com 6 unit tests. (Item 3) Clicar num lead abre drawer lateral (`src/components/dashboard/lead-detail-drawer.tsx`) com info basica + timeline derivada (capturado no Kommo → agendado → virou paciente → procedimentos com valor liquido) + link "Abrir no Kommo". URL nao muda — drawer puro sem rota nova. Backdrop click/ESC/[×] fecham; scroll do body trava enquanto aberto. Endpoint novo `GET /api/leads/[id]` (multi-tenant filtered via `findFirst` + clinicId obrigatorio) retorna o payload consolidado.
```

- [ ] **Step 6.4: Adicionar spec ao stage**

Run: `git add docs/superpowers/specs/2026-05-14-dash-8-leads-ux-design.md`

(O arquivo existe em main como untracked porque foi escrito durante brainstorming. Vai ser commitado agora.)

- [ ] **Step 6.5: Validar tudo**

Run: `npm run lint && npx tsc --noEmit && npm test`

Expected: lint limpo, tsc limpo, 194 passed.

- [ ] **Step 6.6: Commit do bump + spec**

```bash
git add package.json src/lib/version.ts docs/IMPROVEMENTS.md
git commit -m "chore: bump v0.45.0 + CHANGELOG + IMPROVEMENTS + commit spec DASH-8"
```

---

## Task 7: Bateria pre-PR final + push + abrir PR

**Files:**
- (nenhum — só validação e operações git)

- [ ] **Step 7.1: Rodar bateria completa**

Run: `npm ci && npx prisma generate && npm run lint && npx tsc --noEmit && npm test && npm run build`

Expected: tudo verde. Se algo falhar, NÃO abrir PR — voltar ao step que originou o erro.

- [ ] **Step 7.2: Push da branch**

Run: `git push -u origin feat/dash-8-leads-ux`

Expected: branch criada no origin.

- [ ] **Step 7.3: Abrir PR**

Run:

```bash
gh pr create --title "feat: esconder LTV/Campanhas + leads por status + drawer de detalhe (v0.45.0)" --body "$(cat <<'EOF'
## Summary
DASH-8 — 3 ajustes acumulados pelo Bruno num PR só. Spec: `docs/superpowers/specs/2026-05-14-dash-8-leads-ux-design.md`.

- **Item 1** — LTV & ROAS e Campanhas saem do menu via flag `hidden: true` em `navItems`. Rotas continuam vivas por URL direta. Reativação trivial.
- **Item 2** — Bloco "Por status" abaixo dos KPIs em `/dashboard/leads`: mini cards (1 por status do Kommo, cor + nome + count). Click filtra (toggle). Combina com busca/canal via AND.
- **Item 3** — Click num lead abre drawer lateral com info + timeline (capturado → agendado → virou paciente → procedimentos) + link "Abrir no Kommo". URL não muda.

Move `[DASH-8]` pra "Concluídos" em `docs/IMPROVEMENTS.md`. Bump v0.44.1 → v0.45.0 (minor).

## Mudanças técnicas
- `src/components/layout/sidebar.tsx` — flag `hidden?` + filter no map
- `src/lib/leads/group-by-status.ts` (novo) — função pura com 6 unit tests
- `src/app/api/leads/[id]/route.ts` (novo) — endpoint detalhe, multi-tenant
- `src/components/dashboard/lead-detail-drawer.tsx` (novo) — drawer slide-in
- `src/app/dashboard/leads/page.tsx` — integra os 3 items
- `docs/superpowers/specs/2026-05-14-dash-8-leads-ux-design.md` — spec aprovado pelo Bruno

## Test plan
- [x] `npm run lint` — limpo
- [x] `npx tsc --noEmit` — limpo
- [x] `npm test` — 194 passed (188 + 6 novos)
- [x] `npm run build` — ok
- [ ] **Validação manual em prod (Bruno):**
  - [ ] Sidebar sem LTV & ROAS e sem Campanhas
  - [ ] `/dashboard/ltv` ainda abre por URL direta
  - [ ] Bloco "Por status" aparece em /dashboard/leads
  - [ ] Click em status filtra; 2º click limpa
  - [ ] Filtro de status combina com busca + canal (AND)
  - [ ] Click em lead abre drawer; ESC/click fora/[×] fecham
  - [ ] Timeline mostra eventos em ordem
  - [ ] Link "Abrir no Kommo" abre em nova aba

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Expected: URL do PR no output.

- [ ] **Step 7.4: Esperar CI verde**

Run: `gh pr view <PR_NUMBER> --json statusCheckRollup`

Esperar até `conclusion: SUCCESS`.

- [ ] **Step 7.5: Avisar Bruno**

PR aberto, CI verde, mergeable. Aguardar autorização do Bruno pra squash merge.

---

## Self-Review Pós-Plano

Confirmação contra a spec:

| Spec section | Coberto em | Status |
|---|---|---|
| §3 Esconder LTV/Campanhas (flag hidden + filter) | Task 1 | ✓ |
| §4 Bloco "Por status" com toggle + edge cases | Tasks 2 + 5.3-5.5 | ✓ |
| §5 Drawer (slide-in, ESC/click-fora/[×], scroll lock, fetch on open, timeline, link Kommo) | Tasks 3 + 4 + 5.6-5.7 | ✓ |
| §6 Endpoint `/api/leads/[id]` (multi-tenant, 404 unificado) | Task 3 | ✓ |
| §7 Bump v0.45.0 + CHANGELOG entry | Task 6 | ✓ |
| §8 Testes (`groupLeadsByStatus` puro; pular drawer/endpoint) | Task 2 | ✓ |
| §9 Validação pre-PR + test plan manual | Task 7 | ✓ |
| §10 Risco "scroll travado se unmount no meio" | Task 4 cleanup do useEffect | ✓ |
| §10 Risco "vazar dados de outra clínica" | Task 3 `findFirst({ where: { id, clinicId } })` | ✓ |

Sem placeholders. Sem `TBD`/`TODO`. Code blocks com conteúdo real em cada step. Paths exatos. Comandos exatos com expected. Commit messages explícitos.
