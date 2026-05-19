# DASH-10 — Performance por SDR no Dashboard de Captação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar tabela "Performance por SDR" no dashboard de Captação, mostrando funil completo (leads → agendados → compareceram → fecharam → receita) agrupado pela vendedora extraída do custom field Kommo "Vendedora".

**Architecture:** Novo campo `vendedora` em `Lead` populado pelo webhook do Kommo via nova helper `extractVendedora`. Agregação adicional no `/api/dashboard` que retorna `sdrPerformance[]`. Novo card na página de captação entre o funil e a composição de receita.

**Tech Stack:** Next.js 14 App Router, Prisma, PostgreSQL, TypeScript strict, Vitest, Tailwind.

**Spec:** `docs/superpowers/specs/2026-05-18-sdr-performance-design.md`

---

## Pré-requisitos

- Trabalhar em worktree dedicada: `git worktree add -b feat/dash-10-sdr-performance ../clinifunnel-feat-dash-10 main`.
- `npm ci` e `npx prisma generate` executados na worktree.

---

## Task 1: Adicionar item DASH-10 no backlog

**Files:**
- Modify: `docs/IMPROVEMENTS.md`

- [ ] **Step 1: Abrir `docs/IMPROVEMENTS.md` e localizar a seção "Em andamento"**

- [ ] **Step 2: Adicionar item DASH-10**

Adicionar entrada (no estilo dos itens existentes, geralmente bullet curto com código + descrição):

```markdown
- **DASH-10** — Performance por SDR no Dashboard de Captação. Novo campo `vendedora` no Lead (extraído do custom field Kommo) + tabela com funil completo agrupado por SDR.
```

- [ ] **Step 3: Commit**

```bash
git add docs/IMPROVEMENTS.md
git commit -m "chore: abre item DASH-10 (performance por SDR) no backlog"
```

---

## Task 2: Schema — adicionar campo `vendedora` em `Lead`

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_add_lead_vendedora/migration.sql` (gerada pelo Prisma)

- [ ] **Step 1: Adicionar campo no model Lead**

Em `prisma/schema.prisma`, dentro do bloco `model Lead { ... }`, logo abaixo da linha `canalProspeccao String?`:

```prisma
  // Vendedora/SDR responsavel (Kommo custom field "Vendedora")
  vendedora       String?
```

- [ ] **Step 2: Gerar migration**

```bash
npx prisma migrate dev --name add_lead_vendedora
```

Expected: cria pasta `prisma/migrations/<timestamp>_add_lead_vendedora/` com `migration.sql` contendo `ALTER TABLE "Lead" ADD COLUMN "vendedora" TEXT;`. Banco local atualizado. Client regenerado.

- [ ] **Step 3: Conferir que client typecheck passa**

```bash
npx tsc --noEmit
```

Expected: 0 erros (a coluna nova é opcional, não quebra nada).

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: adiciona campo Lead.vendedora (DASH-10)"
```

---

## Task 3: Helper `extractVendedora` (TDD)

**Files:**
- Modify: `src/lib/kommo/utm.ts`
- Modify: `src/lib/kommo/utm.test.ts`

- [ ] **Step 1: Escrever os testes (failing)**

No fim de `src/lib/kommo/utm.test.ts`, adicionar:

```ts
import { extractVendedora } from "./utm";

describe("extractVendedora", () => {
  it("returns null when fields is null/undefined/empty", () => {
    expect(extractVendedora(null)).toBeNull();
    expect(extractVendedora(undefined)).toBeNull();
    expect(extractVendedora([])).toBeNull();
  });

  it("returns null when no field matches 'vendedora'", () => {
    expect(
      extractVendedora([
        field("Canal de prospeccao", "Instagram"),
        field("UTM Source", "google"),
      ]),
    ).toBeNull();
  });

  it("extracts value from field named 'Vendedora'", () => {
    expect(
      extractVendedora([field("Vendedora", "Ingrid")]),
    ).toBe("Ingrid");
  });

  it("is case-insensitive on field name", () => {
    expect(extractVendedora([field("VENDEDORA", "SDR")])).toBe("SDR");
    expect(extractVendedora([field("vendedora", "Ingrid")])).toBe("Ingrid");
    expect(extractVendedora([field("Vendedora", "SDR")])).toBe("SDR");
  });

  it("returns null when field is present but has no values", () => {
    const f: KommoCustomField = {
      field_id: 1,
      field_name: "Vendedora",
      field_code: null,
      field_type: "select",
      values: [],
    };
    expect(extractVendedora([f])).toBeNull();
  });

  it("picks the vendedora field among many", () => {
    expect(
      extractVendedora([
        field("UTM Source", "google"),
        field("Canal de prospeccao", "Instagram"),
        field("Vendedora", "Ingrid"),
        field("Outro campo", "qualquer"),
      ]),
    ).toBe("Ingrid");
  });
});
```

- [ ] **Step 2: Rodar testes pra confirmar falha**

```bash
npm test -- src/lib/kommo/utm.test.ts
```

Expected: FAIL com erro de import `extractVendedora` (função não existe).

- [ ] **Step 3: Implementar a função**

Em `src/lib/kommo/utm.ts`, logo após `extractCanalProspeccao` (por volta da linha 77), adicionar:

```ts
export function extractVendedora(
  fields: KommoCustomField[] | null | undefined
): string | null {
  if (!fields) return null;
  for (const field of fields) {
    const name = field.field_name?.toLowerCase() ?? "";
    if (name.includes("vendedora")) {
      if (field.values.length > 0) return field.values[0].value;
    }
  }
  return null;
}
```

- [ ] **Step 4: Rodar testes — todos passam**

```bash
npm test -- src/lib/kommo/utm.test.ts
```

Expected: PASS (incluindo os novos 6 cases de `extractVendedora`).

- [ ] **Step 5: Commit**

```bash
git add src/lib/kommo/utm.ts src/lib/kommo/utm.test.ts
git commit -m "feat: extractVendedora para custom field Kommo (DASH-10)"
```

---

## Task 4: Persistir `vendedora` no webhook do Kommo

**Files:**
- Modify: `src/app/api/webhooks/kommo/route.ts`

- [ ] **Step 1: Importar `extractVendedora`**

Em `src/app/api/webhooks/kommo/route.ts`, linha 8, ajustar import:

```ts
import { extractUTMsFromCustomFields, extractCanalProspeccao, extractAppointmentFields, extractVendedora } from "@/lib/kommo/utm";
```

- [ ] **Step 2: Extrair vendedora antes do upsert**

Logo após a linha `const canalProspeccao = extractCanalProspeccao(...)` (linha 69), adicionar:

```ts
  const vendedora = extractVendedora(kommoLead.custom_fields_values);
```

- [ ] **Step 3: Passar `vendedora` no `update` e `create` do upsert**

No bloco `update:` (linhas 86-97), adicionar `vendedora,` logo após `canalProspeccao,`:

```ts
    update: {
      name: displayName,
      phone,
      email,
      ...utms,
      canalProspeccao,
      vendedora,
      ...appointmentFields,
      channel,
      kommoStatus: statusId,
      kommoPipelineId: pipelineId,
      ...(isAgendamento ? { agendamentoAt: new Date() } : {}),
    },
```

No bloco `create:` (linhas 98-112), adicionar `vendedora,` logo após `canalProspeccao,`:

```ts
    create: {
      clinicId: clinic.id,
      kommoLeadId: String(kommoLead.id),
      name: displayName,
      phone,
      email,
      ...utms,
      canalProspeccao,
      vendedora,
      ...appointmentFields,
      channel,
      kommoStatus: statusId,
      kommoPipelineId: pipelineId,
      kommoCreatedAt: new Date(kommoLead.created_at * 1000),
      ...(isAgendamento ? { agendamentoAt: new Date() } : {}),
    },
```

- [ ] **Step 4: Type check**

```bash
npx tsc --noEmit
```

Expected: 0 erros (Prisma client tipa `vendedora?: string | null`).

- [ ] **Step 5: Lint**

```bash
npm run lint
```

Expected: pass.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/webhooks/kommo/route.ts
git commit -m "feat: webhook Kommo persiste vendedora no Lead (DASH-10)"
```

---

## Task 5: API `/api/dashboard` — agregar `sdrPerformance`

**Files:**
- Modify: `src/app/api/dashboard/route.ts`

- [ ] **Step 1: Adicionar query `sdrPerformance` no `Promise.all`**

Em `src/app/api/dashboard/route.ts`, dentro do array do `Promise.all` (logo após o bloco `canalBreakdown` que está em linhas 191-196), adicionar a nova variável `sdrLeads` que retorna leads do range com os campos necessários para agregação em memória:

Localizar:

```ts
    // Canal de prospeccao breakdown
    prisma.lead.groupBy({
      by: ["canalProspeccao"],
      where: { ...leadWhere, canalProspeccao: { not: null } },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
    }),
```

Adicionar logo abaixo:

```ts
    // [DASH-10] Leads do range com vendedora + dados de funil pra agregar
    // SDR performance em memoria. Buscamos so leads do funil (mesma where do
    // KPI principal) pra coerencia com "Leads captados".
    prisma.lead.findMany({
      where: leadWhere,
      select: {
        vendedora: true,
        agendamentoAt: true,
        patientId: true,
        patient: {
          select: {
            appointments: {
              where: { statusKey: "atendido", deleted: false },
              select: { id: true },
              take: 1,
            },
            procedures: {
              where: {
                ...APPROVED_PROCEDURE_FILTER,
                ...procedureDateFilter,
              },
              select: { value: true, discountAmount: true },
            },
          },
        },
      },
    }),
```

E ajustar a desestruturação do array no `const [ ... ] = await Promise.all([...])` para incluir `sdrLeads`:

```ts
  const [
    totalLeads,
    campaignLeads,
    agendamentos,
    compareceram,
    procedureAgg,
    totalProcedureAgg,
    adSpendAgg,
    topProcedures,
    canalBreakdown,
    sdrLeads,
    captacaoAgg,
    recorrentesAgg,
    walkInAgg,
    appointmentsByStatus,
  ] = await Promise.all([
```

Importante: a ordem da variável `sdrLeads` no array de destructuring DEVE corresponder à posição da nova query no `Promise.all` (logo após `canalBreakdown`, antes de `captacaoAgg`).

- [ ] **Step 2: Computar `sdrPerformance` em memória**

Após o bloco do `consultas` (por volta da linha 368, antes do `return NextResponse.json`), adicionar:

```ts
  // [DASH-10] Agregacao por SDR (vendedora do Kommo). Faz em memoria porque
  // precisamos juntar lead -> patient -> appointments + procedures por SDR,
  // o que ficaria pesado/feio em SQL puro. Volume baixo (leads do range).
  type SdrBucket = {
    leads: number;
    agendados: number;
    compareceram: number;
    fecharam: number;
    receita: number;
  };
  const sdrBuckets = new Map<string, SdrBucket>();
  for (const lead of sdrLeads) {
    const key = lead.vendedora ?? "Sem SDR";
    const bucket = sdrBuckets.get(key) ?? {
      leads: 0,
      agendados: 0,
      compareceram: 0,
      fecharam: 0,
      receita: 0,
    };
    bucket.leads += 1;
    if (lead.agendamentoAt) bucket.agendados += 1;
    if (lead.patient && lead.patient.appointments.length > 0) {
      bucket.compareceram += 1;
    }
    if (lead.patient && lead.patient.procedures.length > 0) {
      bucket.fecharam += 1;
      for (const proc of lead.patient.procedures) {
        bucket.receita += (proc.value ?? 0) - (proc.discountAmount ?? 0);
      }
    }
    sdrBuckets.set(key, bucket);
  }
  const sdrPerformance = Array.from(sdrBuckets.entries())
    .map(([vendedora, b]) => ({
      vendedora,
      leads: b.leads,
      agendados: b.agendados,
      compareceram: b.compareceram,
      fecharam: b.fecharam,
      receita: b.receita,
      conversao: b.leads > 0 ? (b.fecharam / b.leads) * 100 : 0,
    }))
    .sort((a, b) => b.leads - a.leads);
```

- [ ] **Step 3: Incluir `sdrPerformance` no payload de resposta**

No `return NextResponse.json({ data: { ... } })` (perto da linha 370), adicionar `sdrPerformance,` logo após `canalBreakdown: ...`:

```ts
      canalBreakdown: canalBreakdown.map((c) => ({
        canal: c.canalProspeccao ?? "Nao identificado",
        count: c._count.id,
      })),
      sdrPerformance,
```

- [ ] **Step 4: Type check**

```bash
npx tsc --noEmit
```

Expected: 0 erros.

- [ ] **Step 5: Lint**

```bash
npm run lint
```

Expected: pass.

- [ ] **Step 6: Build sanity check**

```bash
npm run build
```

Expected: build completo (vai compilar a rota dinamica).

- [ ] **Step 7: Commit**

```bash
git add src/app/api/dashboard/route.ts
git commit -m "feat: /api/dashboard retorna sdrPerformance agregado (DASH-10)"
```

---

## Task 6: UI — card "Performance por SDR" na página de Captação

**Files:**
- Modify: `src/app/dashboard/captacao/page.tsx`

- [ ] **Step 1: Adicionar tipo `SdrPerformance` na interface `DashboardData`**

Em `src/app/dashboard/captacao/page.tsx`, antes da interface `DashboardData` (perto da linha 32), adicionar:

```tsx
interface SdrPerformance {
  vendedora: string;
  leads: number;
  agendados: number;
  compareceram: number;
  fecharam: number;
  receita: number;
  conversao: number;
}
```

E dentro de `interface DashboardData`, adicionar antes de `canalBreakdown`:

```tsx
  sdrPerformance: SdrPerformance[];
```

- [ ] **Step 2: Inicializar `sdrPerformance: []` no `empty`**

No objeto `empty` (linhas 62-69), adicionar `sdrPerformance: [],` logo antes de `canalBreakdown: [],`:

```tsx
const empty: DashboardData = {
  totalLeads: 0, campaignLeads: 0, organicLeads: 0, agendamentos: 0,
  compareceram: 0, procedimentos: 0, totalRevenue: 0, procedimentosClinica: 0, receitaClinica: 0, totalSpend: 0, cpl: null,
  conversionRate: 0,
  leadsByDay: [], leadsByDayTotal: 0, leadsByDayAvg: 0, leadsByDayBest: null,
  topProcedures: [], channelPerformance: [],
  sdrPerformance: [],
  canalBreakdown: [],
};
```

- [ ] **Step 3: Renderizar o card entre Funnel/Revenue Chart e Composicao da receita**

Localizar o fim do bloco `<div className="grid gap-6 lg:grid-cols-2">` que contém Funnel + leadsByDay (termina com `</div>` por volta da linha 288, exatamente o `</div>` que fecha esse grid).

Logo após esse `</div>` de fechamento e ANTES do bloco `{/* Composicao da receita (DASH-1) */}` (linha 291), inserir:

```tsx
      {/* [DASH-10] Performance por SDR — leads agrupados pela vendedora
          (custom field Kommo). Funil completo: leads -> agendados ->
          compareceram -> fecharam -> receita. So renderiza se houver SDR. */}
      {d.sdrPerformance.length > 0 && (
        <div className="rounded-xl bg-card p-6 glass-border">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-lg font-semibold">Performance por SDR</h2>
            <span className="text-xs text-muted-foreground">
              {d.sdrPerformance.length} SDR{d.sdrPerformance.length === 1 ? "" : "s"}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50 text-[10px] uppercase tracking-wider text-muted-foreground">
                  <th className="text-left font-medium py-2 pr-3">SDR</th>
                  <th className="text-right font-medium py-2 px-3">Leads</th>
                  <th className="text-right font-medium py-2 px-3">Agend.</th>
                  <th className="text-right font-medium py-2 px-3">Comp.</th>
                  <th className="text-right font-medium py-2 px-3">Fechou</th>
                  <th className="text-right font-medium py-2 px-3">Receita</th>
                  <th className="text-right font-medium py-2 pl-3">Conv.</th>
                </tr>
              </thead>
              <tbody>
                {d.sdrPerformance.map((s, idx) => (
                  <tr
                    key={s.vendedora}
                    className="border-b border-border/30 last:border-0 hover:bg-muted/30 transition-colors"
                  >
                    <td className={`py-3 pr-3 ${idx === 0 ? "font-semibold" : "font-medium"}`}>
                      {s.vendedora}
                    </td>
                    <td className="py-3 px-3 text-right tabular-nums">{s.leads}</td>
                    <td className="py-3 px-3 text-right tabular-nums">{s.agendados}</td>
                    <td className="py-3 px-3 text-right tabular-nums">{s.compareceram}</td>
                    <td className="py-3 px-3 text-right tabular-nums">{s.fecharam}</td>
                    <td className="py-3 px-3 text-right tabular-nums">
                      {s.receita > 0 ? fmtK(s.receita) : "—"}
                    </td>
                    <td
                      className={`py-3 pl-3 text-right tabular-nums ${
                        s.conversao >= 20 ? "text-success font-semibold" : ""
                      }`}
                    >
                      {s.conversao.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
```

- [ ] **Step 4: Type check**

```bash
npx tsc --noEmit
```

Expected: 0 erros.

- [ ] **Step 5: Lint**

```bash
npm run lint
```

Expected: pass.

- [ ] **Step 6: Smoke test manual**

```bash
npm run dev
```

Abrir `http://localhost:3000/dashboard/captacao` e conferir:
- Página renderiza sem erro de console.
- Se já existir lead com vendedora no banco local, o card aparece com a tabela.
- Se não existir nenhum lead com vendedora E nenhum lead nulo no range, o card não aparece.

Encerrar o `npm run dev` (Ctrl+C) antes do commit.

- [ ] **Step 7: Commit**

```bash
git add src/app/dashboard/captacao/page.tsx
git commit -m "feat: tabela Performance por SDR na pagina de Captacao (DASH-10)"
```

---

## Task 7: Bump versão + changelog

**Files:**
- Modify: `package.json`
- Modify: `src/lib/version.ts`

- [ ] **Step 1: Bump em `package.json`**

Localizar `"version": "0.46.1"` e trocar pra `"version": "0.47.0"`.

- [ ] **Step 2: Bump em `src/lib/version.ts` + entrada no CHANGELOG**

Trocar `export const APP_VERSION = "0.46.1";` por `export const APP_VERSION = "0.47.0";`.

E adicionar nova entrada no topo do array `CHANGELOG` (antes da entrada `0.46.1`):

```ts
  {
    version: "0.47.0",
    date: "2026-05-18",
    type: "minor",
    changes: [
      "DASH-10: Performance por SDR no Dashboard de Captacao",
      "Novo campo Vendedora extraido do custom field Kommo e persistido em Lead.vendedora",
      "Tabela na pagina /dashboard/captacao com funil completo (Leads -> Agend. -> Comp. -> Fechou -> Receita -> Conv.%) agrupado por SDR, ordenado por leads desc",
      "Leads sem vendedora preenchida aparecem como 'Sem SDR' (sem backfill — so leads novos a partir do deploy)",
      "Migration add_lead_vendedora (so adiciona coluna nullable — sem destrutivo)",
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
git commit -m "chore: bump 0.47.0 (DASH-10)"
```

---

## Task 8: Validação completa pré-PR

**Files:** —

- [ ] **Step 1: Rodar a suite de validação que o CI vai rodar**

```bash
npm run lint && npx tsc --noEmit && npm test && npm run build
```

Expected: tudo passa. Se algo falhar, voltar à task correspondente e corrigir antes de abrir PR.

- [ ] **Step 2: Conferir worktree limpa**

```bash
git status
```

Expected: `nothing to commit, working tree clean`.

- [ ] **Step 3: Push da branch**

```bash
git push -u origin feat/dash-10-sdr-performance
```

- [ ] **Step 4: Abrir PR**

```bash
gh pr create --title "feat: performance por SDR no Dashboard de Captacao (DASH-10, v0.47.0)" --body "$(cat <<'EOF'
## Summary
- Novo campo `Lead.vendedora` populado a partir do custom field Kommo "Vendedora"
- Tabela "Performance por SDR" na pagina `/dashboard/captacao` com funil completo + receita + conversao
- Sem backfill: leads anteriores ao deploy ficam como "Sem SDR" no breakdown

## Backlog
- Fecha item DASH-10 em `docs/IMPROVEMENTS.md`

## Migration
- `add_lead_vendedora` — somente adiciona coluna `vendedora TEXT NULL`. Sem destrutivo. Sem rollback necessario.

## Test plan
- [ ] CI verde (lint + tsc + build)
- [ ] Unit: `extractVendedora` (6 casos em utm.test.ts)
- [ ] Apos deploy: criar lead no Kommo com Vendedora=Ingrid -> conferir linha na tabela
- [ ] Mover lead pra Agendado -> conferir incremento na coluna Agend.
- [ ] Criar lead sem preencher Vendedora -> conferir bucket "Sem SDR"

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 5: Aguardar CI verde**

```bash
gh pr checks --watch
```

Expected: todos os checks `pass`. Não mergear sem CI verde.

---

## Task 9: Pós-merge — fechar item no backlog

**Files:**
- Modify: `docs/IMPROVEMENTS.md` (no clone principal, após squash-merge)

- [ ] **Step 1: Voltar ao clone principal e atualizar main**

```bash
cd <clone-principal>
git checkout main && git pull origin main
```

- [ ] **Step 2: Mover item DASH-10 para "Concluídos"**

Em `docs/IMPROVEMENTS.md`, mover a entrada `DASH-10` da seção "Em andamento" para "Concluídos" com link pro PR e versão (segue padrão dos itens concluídos existentes):

```markdown
- **DASH-10** — Performance por SDR no Dashboard de Captação. [PR #XX](https://github.com/brunopalhardi/clinifunnel/pull/XX) — v0.47.0
```

- [ ] **Step 3: Commit + push em chore branch curta**

```bash
git checkout -b chore/dash-10-concluido
git add docs/IMPROVEMENTS.md
git commit -m "chore: move DASH-10 para Concluidos"
git push -u origin chore/dash-10-concluido
gh pr create --title "chore: move DASH-10 para Concluidos" --body "Move item DASH-10 do backlog 'Em andamento' para 'Concluidos' apos merge do PR #XX (v0.47.0)."
```

- [ ] **Step 4: Limpar worktree após merge**

```bash
git worktree remove ../clinifunnel-feat-dash-10
git branch -D feat/dash-10-sdr-performance
```

---

## Self-Review checklist

- [x] Spec coverage: schema (Task 2), helper (Task 3), webhook (Task 4), API agregação (Task 5), UI (Task 6), versionamento + CHANGELOG (Task 7), backlog (Task 1 + 9), testes unit (Task 3), validação pré-PR (Task 8). Testes manuais listados no test plan do PR (Task 8).
- [x] Sem placeholders. Todo step tem código exato ou comando exato.
- [x] Tipo `SdrPerformance` consistente entre API (Task 5) e UI (Task 6) — mesmas keys/tipos.
- [x] Worktree dedicada conforme CLAUDE.md.
- [x] Bump duplo `package.json` + `version.ts` conforme convenção do projeto.
- [x] Branch única, squash merge, sem `--no-verify` ou `--admin`.
