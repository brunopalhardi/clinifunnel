# Demandas do Sérgio (call 08/06) — Vistoria + Painel Principal — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolver as demandas da call de 08/06 com o Sérgio (https://fathom.video/calls/703358852): vistoria dos números que ele apontou como divergentes + ticket médio por PACIENTE (não por orçamento) destrinchado em novo/recorrente/doutora/canal + aba Painel Principal.

**Architecture:** Fase 0 é vistoria read-only no Postgres de produção (via SSH na VPS) — as descobertas dela destravam 3 "gates" de decisão. Depois 4 PRs: (A) fundação — migration `Procedure.dentistName` + lib pura de métricas por paciente com testes; (B) API `/api/painel` + aba Painel Principal; (C) atendimentos por tipo na Operação; (D) ticket médio por canal na Captação.

**Tech Stack:** Next.js 14 App Router, Prisma/PostgreSQL, Vitest, Tailwind/shadcn. Padrões do projeto: worktree por PR, squash merge, bump duplo de versão (package.json + src/lib/version.ts), item no docs/IMPROVEMENTS.md antes do PR.

**Versão atual:** 0.53.0. Próximos códigos de backlog: DASH-12 (vistoria), DASH-13 (fundação ticket/paciente), DASH-14 (Painel Principal), DASH-15 (atendimentos por tipo), DASH-16 (ticket por canal).

---

## Contexto: o que o Sérgio pediu (com timestamps da call)

1. **Ticket médio por PACIENTE, não por orçamento aprovado** (13:00) — um paciente pode ter 2-3 orçamentos aprovados no mês; dividir por orçamento distorce. Hoje `/api/operacao:126` faz `totalRevenue / totalProcedures`.
2. **Ticket médio destrinchado**: global mensal, paciente novo (avaliação/primeira consulta) e paciente recorrente (21:47).
3. **Visão por doutora**: ticket médio por doutora + qtde de pacientes atendidos por doutora (18:28).
4. **Aba Painel Principal** com os 4 KPIs acima (18:28).
5. **Atendimentos separados por tipo**: retorno / primeira consulta (avaliação) / paciente recorrente — a tag já é colocada pelas SDRs no agendamento (08:39, 22:11). No banco isso é `Appointment.categoryDescription`.
6. **Ticket médio por canal** (Instagram, indicação...) — "o core do dash" (10:24).

**Erros/dúvidas apontados (vistoria):**
- Divergência reportada quinta 04/06: "leads no período e faturamento não batiam" (01:20) — detalhe está com a Ingrid.
- "Leads captados" conta contato único? (03:12)
- Faltas: Clinicorp mostra 12-16 no mês, funil do dash mostra 2 (06:48) — by design (funil filtra leads do período), mas precisa validar e deixar claro na UI.
- Validar 68 procedimentos / 16 aprovados / R$ 87,8k / 18 pacientes de junho contra o Clinicorp (11:30-13:00).

**Fatos do codebase que viabilizam tudo:**
- `Appointment.categoryDescription` (schema.prisma:148-179) já vem do sync Clinicorp — tipo de consulta existe no banco.
- `Appointment.dentistName` já existe. **MAS `Procedure` não persiste dentista** — a API manda `DentistName` por procedure (`src/lib/clinicorp/types.ts:40-56`) e o mapper descarta (`src/lib/clinicorp/procedure-mapper.ts:103-121`). PR A corrige.
- `Patient.canalProspeccao` herdado do Lead já existe.
- Receita líquida = `value - discountAmount` (rateio DASH-3). Filtro de período de procedures = `createdAt` (consistente com `/api/operacao:32-37`).
- [DASH-9.1] `completedAt` é null em ~100% dos Aprovados (AD não marca ExecutedDate) — features temporais usam `COALESCE(completedAt, createdAt)`.

---

## Fase 0 — Vistoria [DASH-12] (read-only, sem PR de código)

Roda no Postgres nativo da VPS. **Pré-requisito:** acesso SSH ao manager (Bruno tem a chave). Todas as queries são `SELECT` — zero risco. Substituir `<CLINIC_ID>` pelo id real (pegar com a query V0).

### Task V0: Preparar acesso e identificar clinicId

- [ ] **Step 1: Confirmar acesso SSH e psql**

```bash
ssh <user>@<vps-host> "psql -U postgres -d clinifunnel -c '\dt' | head -20"
```
Expected: lista de tabelas (Lead, Patient, Appointment, Procedure...). Se o nome do banco/usuário for outro, conferir o `DATABASE_URL` usado pelo stack: `ssh <user>@<vps-host> "docker service inspect clinifunnel_web --format '{{json .Spec.TaskTemplate.ContainerSpec.Env}}'" ` (não colar o resultado em lugar público — contém secrets).

- [ ] **Step 2: Pegar o clinicId**

```sql
SELECT id, name FROM "Clinic";
```

### Task V1: Enumerar tipos de consulta (GATE 1)

Destrava: strings exatas pra classificar novo vs recorrente (PRs A, B, C).

- [ ] **Step 1: Rodar**

```sql
SELECT "categoryDescription", COUNT(*) AS qtd
FROM "Appointment"
WHERE "clinicId" = '<CLINIC_ID>' AND deleted = false
GROUP BY 1 ORDER BY 2 DESC;
```

- [ ] **Step 2: Registrar no relatório** quais valores significam "novo" (avaliação / primeira consulta) e quais significam "recorrente" (consulta / retorno), e o % de appointments com `categoryDescription` NULL. **Decisão:** se fill-rate ≥ 80%, classificação primária = tag (como o Sérgio descreveu em 22:11), fallback = histórico de procedures. Se < 80%, classificação primária = histórico (paciente sem procedure Aprovado antes do período = novo) e tag vira refinamento futuro.

### Task V2: Fill-rate de dentista (GATE 2)

Destrava: viabilidade do ticket médio por doutora.

- [ ] **Step 1: dentistName nos appointments**

```sql
SELECT COUNT(*) FILTER (WHERE "dentistName" IS NULL OR "dentistName" = '') AS sem_dentista,
       COUNT(*) AS total
FROM "Appointment"
WHERE "clinicId" = '<CLINIC_ID>' AND deleted = false
  AND date >= '2026-05-01';
```

- [ ] **Step 2: DentistName nos procedures da API Clinicorp** (não persiste no banco hoje — checar direto no payload, de dentro do container web que já tem as credenciais):

```bash
ssh <user>@<vps-host> 'docker exec $(docker ps -q -f name=clinifunnel_web | head -1) node -e "
const { PrismaClient } = require(\"@prisma/client\");
(async () => {
  const prisma = new PrismaClient();
  const clinic = await prisma.clinic.findFirst();
  // Reusa o client interno não é trivial em node -e; chamada crua:
  const auth = Buffer.from(process.env.CLINICORP_USER + \":\" + process.env.CLINICORP_TOKEN).toString(\"base64\");
  const url = \"https://sig.clinicorp.com/rest/v1/estimate/list?from=2026-06-01&to=2026-06-08&BusinessId=\" + clinic.clinicorpBusinessId;
  const res = await fetch(url, { headers: { Authorization: \"Basic \" + auth } });
  const data = await res.json();
  let total = 0, comDentista = 0;
  for (const est of data) for (const p of (est.ProcedureList||[])) { total++; if (p.DentistName) comDentista++; }
  console.log({ estimates: data.length, procedures: total, comDentista });
  await prisma.\$disconnect();
})()"'
```
**Nota:** os nomes exatos das env vars e a URL base do Clinicorp estão em `src/lib/clinicorp/client.ts` — conferir antes de rodar e ajustar o snippet. Se o token estiver criptografado no banco (SEC-1) em vez de env, adaptar pra usar o decrypt helper de `src/lib/` (ver como `sync-clinicorp.ts` instancia o client).
Expected: `comDentista / total` próximo de 100%. Se vier baixo, ticket por doutora terá um disclaimer "parcial" na UI.

### Task V3: Validar os números de junho que o Sérgio citou

- [ ] **Step 1: Agendamentos de junho por status (mês cheio e até dia 08, como na call)**

```sql
-- mês cheio (Sérgio viu 93 no Clinicorp)
SELECT "statusKey", COUNT(*) FROM "Appointment"
WHERE "clinicId" = '<CLINIC_ID>' AND deleted = false
  AND date >= '2026-06-01' AND date < '2026-07-01'
GROUP BY 1 ORDER BY 2 DESC;

-- até 08/06 (Sérgio viu ~49 agendamentos, 27 atendidos, 12-16 faltas no Clinicorp)
SELECT "statusKey", COUNT(*) FROM "Appointment"
WHERE "clinicId" = '<CLINIC_ID>' AND deleted = false
  AND date >= '2026-06-01' AND date <= '2026-06-08 23:59:59'
GROUP BY 1 ORDER BY 2 DESC;
```

- [ ] **Step 2: Procedures de junho (Sérgio validou 68 procedimentos / 16 aprovados / R$ 87,8k / 18 pacientes)**

```sql
SELECT "statusDescription", COUNT(*) AS qtd,
       ROUND(SUM(value - "discountAmount")::numeric, 2) AS receita_liquida,
       COUNT(DISTINCT "patientId") AS pacientes
FROM "Procedure"
WHERE "clinicId" = '<CLINIC_ID>' AND deleted = false
  AND "createdAt" >= '2026-06-01' AND "createdAt" < '2026-07-01'
GROUP BY 1 ORDER BY 2 DESC;
```

- [ ] **Step 3: Comparar com o painel do Clinicorp** (Dashboard Analítico, junho) e anotar lado a lado no relatório. Divergência > 5% em qualquer linha = abrir investigação específica antes dos PRs de feature (mesmo playbook do DASH-3/CAP-13).

### Task V4: Divergência de quinta 04/06 (leads + faturamento)

- [ ] **Step 1 (externo): pedir pra Ingrid** o print/critério do que não bateu na quinta 04/06 (qual tela do dash, qual período, qual número esperado). Sem isso a investigação é cega — a call não dá o detalhe (01:20-01:45).

- [ ] **Step 2: Leads por dia de captação (kommoCreatedAt) na janela 01-08/06**

```sql
SELECT DATE("kommoCreatedAt") AS dia, COUNT(*) AS leads
FROM "Lead"
WHERE "clinicId" = '<CLINIC_ID>'
  AND "kommoCreatedAt" >= '2026-06-01' AND "kommoCreatedAt" < '2026-06-09'
GROUP BY 1 ORDER BY 1;
```
Comparar com a contagem manual no Kommo (pipeline de captação) no mesmo recorte.

- [ ] **Step 3: Receita por dia na mesma janela** — reusar a query de `revenueByDay` (`/api/operacao:101-119`):

```sql
SELECT DATE(COALESCE("completedAt", "createdAt")) AS dia,
       ROUND(SUM(value - "discountAmount")::numeric, 2) AS receita, COUNT(*) AS procs
FROM "Procedure"
WHERE "clinicId" = '<CLINIC_ID>' AND "statusDescription" = 'Aprovado' AND deleted = false
  AND COALESCE("completedAt", "createdAt") >= '2026-06-01'
  AND COALESCE("completedAt", "createdAt") < '2026-06-09'
GROUP BY 1 ORDER BY 1;
```
Comparar com o painel Vendas do Clinicorp dia a dia. Suspeito conhecido: webhook Kommo perdido (CAP-12) ou janela de sync de 30 dias.

### Task V5: "Leads captados" é contato único?

- [ ] **Step 1: Duplicatas por telefone**

```sql
SELECT phone, COUNT(*) AS qtd, MIN("kommoCreatedAt") AS primeiro, MAX("kommoCreatedAt") AS ultimo
FROM "Lead"
WHERE "clinicId" = '<CLINIC_ID>' AND phone IS NOT NULL AND phone <> ''
GROUP BY phone HAVING COUNT(*) > 1
ORDER BY 2 DESC LIMIT 20;
```

- [ ] **Step 2: Concluir.** O funil conta `Lead` rows (1 row por kommoLeadId — `@@unique([clinicId, kommoLeadId])`). Se o Kommo cria lead novo pra contato que volta, NÃO é contato único. Se houver duplicatas relevantes, abrir item DASH-17 (dedup por telefone no KPI "Leads captados") — não corrigir dentro desta vistoria.

### Task V6: Relatório da vistoria

- [ ] **Step 1: Escrever** `docs/superpowers/plans/2026-06-11-vistoria-dash12-resultado.md` com: cada query, resultado, comparação com Clinicorp, e as 3 decisões de gate (strings de categoria, método de classificação novo/recorrente, fill-rate de dentista).
- [ ] **Step 2: Atualizar `docs/IMPROVEMENTS.md`**: adicionar [DASH-12] (vistoria, concluída, link pro relatório) e os itens [DASH-13..16] em "Próximos". Commit via PR `chore/dash-12-vistoria` (só docs, bump patch 0.53.1 opcional — seguir convenção: docs-only pode ir sem bump se for o padrão das entradas anteriores; conferir changelog).

---

## PR A — Fundação [DASH-13]: `Procedure.dentistName` + lib de métricas por paciente (v0.54.0)

**Worktree:** `git worktree add -b feat/dash-13-ticket-paciente ../clinifunnel-feat-dash13 main`

**Files:**
- Modify: `prisma/schema.prisma` (model Procedure)
- Create: `prisma/migrations/<timestamp>_add_procedure_dentist_name/migration.sql` (gerada)
- Modify: `src/lib/clinicorp/procedure-mapper.ts`
- Modify: `src/workers/sync-clinicorp.ts:122-130`
- Create: `src/lib/metrics/patient-ticket.ts`
- Test: seguir o padrão de localização dos testes existentes (rodar `git ls-files | grep -E '\.test\.(ts|tsx)$' | head` e colocar o novo teste no mesmo padrão; assumindo colocated: `src/lib/metrics/patient-ticket.test.ts`)
- Modify: `package.json`, `src/lib/version.ts`, `docs/IMPROVEMENTS.md`

### Task A1: Migration `Procedure.dentistName`

- [ ] **Step 1: Editar schema** — em `model Procedure`, depois de `name String`:

```prisma
  // [DASH-13] Dentista do procedure (DentistName da API Clinicorp).
  // Null em procedures sync'ados antes da migration (backfill = re-sync 30d).
  dentistName          String?
```

- [ ] **Step 2: Gerar migration**

```bash
npx prisma migrate dev --name add_procedure_dentist_name
```
Expected: migration com `ALTER TABLE "Procedure" ADD COLUMN "dentistName" TEXT;` (aditiva, não destrutiva).

- [ ] **Step 3: Commit** — `git commit -m "feat: adiciona dentistName ao Procedure (DASH-13)"`

### Task A2: Mapper persiste DentistName

- [ ] **Step 1: Teste falhando** — no arquivo de teste do mapper (já existe teste pro mapper? conferir; se não, criar `src/lib/clinicorp/procedure-mapper.test.ts` no padrão dos testes existentes):

```typescript
it("propaga DentistName do procedure da estimate", () => {
  const est = makeEstimate({
    ProcedureList: [makeProc({ id: 1, DentistName: "Dra. Ana" })],
  });
  const mapped = mapEstimateToProcedures(est);
  expect(mapped[0].dentistName).toBe("Dra. Ana");
});
```
(`makeEstimate`/`makeProc` = helpers/fixtures; se o teste existente do mapper já tem fixtures, reusar.)

- [ ] **Step 2: Rodar e ver falhar** — `npm test -- procedure-mapper` → FAIL (`dentistName` não existe em MappedProcedure).

- [ ] **Step 3: Implementar** — em `procedure-mapper.ts`, adicionar ao interface `MappedProcedure` (após `name: string;`):

```typescript
  dentistName: string | null;
```
E no return do map (`procedure-mapper.ts:109-120`), após `name: proc.OperationDescription,`:

```typescript
      dentistName: proc.DentistName ?? null,
```

- [ ] **Step 4: Rodar e ver passar** — `npm test -- procedure-mapper` → PASS.

- [ ] **Step 5: Persistir no sync** — em `src/workers/sync-clinicorp.ts`, no objeto `procData` (linha ~122):

```typescript
            const procData = {
              name: m.name,
              dentistName: m.dentistName,
              value: m.value,
              discountAmount: m.discountAmount,
              status: m.status,
              statusDescription: m.statusDescription,
              paymentAccounted: m.paymentAccounted,
              completedAt: m.completedAt,
            };
```
O upsert (update + create) já espalha `procData`, então o backfill dos últimos 30 dias acontece sozinho no próximo ciclo do sync (15 min). **Procedures mais antigos que 30 dias ficam com `dentistName` null** — aceitável: o Painel Principal é mensal. Registrar essa limitação no PR.

- [ ] **Step 6: Commit** — `git commit -m "feat: sync persiste dentista do procedure (DASH-13)"`

### Task A3: Lib pura `src/lib/metrics/patient-ticket.ts` (TDD)

Funções puras, sem Prisma — recebem rows, devolvem métricas. A API (PR B) só faz query + chama isso.

- [ ] **Step 1: Testes falhando** — criar o arquivo de teste:

```typescript
import { describe, it, expect } from "vitest";
import {
  computePatientTicket,
  classifyPatients,
  normalizeCategory,
  ticketPorDoutora,
} from "./patient-ticket";

describe("computePatientTicket", () => {
  it("agrega por paciente, não por procedure", () => {
    const r = computePatientTicket([
      { patientId: "p1", value: 1000, discountAmount: 100 }, // p1: 900
      { patientId: "p1", value: 500, discountAmount: 0 },    // p1: +500 = 1400
      { patientId: "p2", value: 600, discountAmount: 0 },    // p2: 600
    ]);
    expect(r.patients).toBe(2);
    expect(r.revenue).toBe(2000);
    expect(r.ticketMedio).toBe(1000); // 2000/2 — e não 2000/3
  });
  it("retorna zeros sem dividir por zero", () => {
    expect(computePatientTicket([])).toEqual({ patients: 0, revenue: 0, ticketMedio: 0 });
  });
});

describe("normalizeCategory", () => {
  it("normaliza caixa, espaços e acentos", () => {
    expect(normalizeCategory("  Avaliação ")).toBe("avaliacao");
    expect(normalizeCategory("PRIMEIRA CONSULTA")).toBe("primeira consulta");
    expect(normalizeCategory(null)).toBe("");
  });
});

describe("classifyPatients", () => {
  it("tag de avaliação/primeira consulta classifica como novo", () => {
    const r = classifyPatients({
      patientIds: ["p1"],
      categoriesByPatient: new Map([["p1", ["Avaliação"]]]),
      patientsWithHistory: new Set(),
    });
    expect(r.get("p1")).toBe("novo");
  });
  it("tag consulta/retorno classifica como recorrente", () => {
    const r = classifyPatients({
      patientIds: ["p1"],
      categoriesByPatient: new Map([["p1", ["Consulta"]]]),
      patientsWithHistory: new Set(),
    });
    expect(r.get("p1")).toBe("recorrente");
  });
  it("sem tag, usa histórico: procedure aprovado antes do período = recorrente", () => {
    const r = classifyPatients({
      patientIds: ["p1", "p2"],
      categoriesByPatient: new Map(),
      patientsWithHistory: new Set(["p1"]),
    });
    expect(r.get("p1")).toBe("recorrente");
    expect(r.get("p2")).toBe("novo");
  });
  it("tag de novo ganha de histórico (paciente antigo voltando por novo tratamento avaliado conta como novo? NÃO — histórico ganha)", () => {
    // DECISÃO: se o paciente TEM histórico de aprovação anterior, é recorrente
    // mesmo com tag de avaliação — evita inflar "novo" com retorno mal tagueado.
    const r = classifyPatients({
      patientIds: ["p1"],
      categoriesByPatient: new Map([["p1", ["Avaliação"]]]),
      patientsWithHistory: new Set(["p1"]),
    });
    expect(r.get("p1")).toBe("recorrente");
  });
});

describe("ticketPorDoutora", () => {
  it("agrupa receita e pacientes distintos por dentista", () => {
    const r = ticketPorDoutora([
      { patientId: "p1", value: 1000, discountAmount: 0, dentistName: "Dra. Ana" },
      { patientId: "p2", value: 500, discountAmount: 0, dentistName: "Dra. Ana" },
      { patientId: "p3", value: 300, discountAmount: 0, dentistName: null },
    ]);
    const ana = r.find((d) => d.dentistName === "Dra. Ana");
    expect(ana).toEqual({ dentistName: "Dra. Ana", patients: 2, revenue: 1500, ticketMedio: 750 });
    const semDentista = r.find((d) => d.dentistName === "Sem dentista");
    expect(semDentista?.revenue).toBe(300);
  });
});
```

**GATE 1 da vistoria:** as listas de categorias `NOVO`/`RECORRENTE` abaixo usam os valores conhecidos ("Avaliação", "Primeira Consulta" / "Consulta", "Retorno") — ajustar com os valores reais da Task V1 antes de implementar, e a regra "histórico ganha da tag" pode inverter conforme decisão da vistoria.

- [ ] **Step 2: Rodar e ver falhar** — `npm test -- patient-ticket` → FAIL (módulo não existe).

- [ ] **Step 3: Implementar** `src/lib/metrics/patient-ticket.ts`:

```typescript
// [DASH-13] Métricas de ticket médio por PACIENTE (não por procedure/orçamento).
// Motivação (call Sérgio 08/06): um paciente pode ter 2-3 orçamentos aprovados
// no mês (aprovação parcial + retorno); dividir por orçamento distorce o ticket.
// Funções puras — a API faz as queries e delega o cálculo aqui.

export type PatientClass = "novo" | "recorrente";

export interface ProcedureRow {
  patientId: string;
  value: number;
  discountAmount: number;
}

export interface ProcedureRowComDentista extends ProcedureRow {
  dentistName: string | null;
}

export interface PatientTicket {
  patients: number;
  revenue: number;
  ticketMedio: number;
}

export function computePatientTicket(procs: ProcedureRow[]): PatientTicket {
  const byPatient = new Map<string, number>();
  for (const p of procs) {
    const liquido = p.value - p.discountAmount;
    byPatient.set(p.patientId, (byPatient.get(p.patientId) ?? 0) + liquido);
  }
  const revenue = [...byPatient.values()].reduce((a, b) => a + b, 0);
  const patients = byPatient.size;
  return { patients, revenue, ticketMedio: patients > 0 ? revenue / patients : 0 };
}

export function normalizeCategory(desc: string | null | undefined): string {
  return (desc ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

// GATE 1 (vistoria V1): ajustar com os valores reais de categoryDescription em prod.
const CATEGORIAS_NOVO = new Set(["avaliacao", "primeira consulta", "1a consulta"]);
const CATEGORIAS_RECORRENTE = new Set(["consulta", "retorno"]);

export function classifyPatients(input: {
  patientIds: string[];
  /** categoryDescription dos appointments do paciente NO PERÍODO */
  categoriesByPatient: Map<string, string[]>;
  /** pacientes com procedure Aprovado ANTES do período */
  patientsWithHistory: Set<string>;
}): Map<string, PatientClass> {
  const result = new Map<string, PatientClass>();
  for (const id of input.patientIds) {
    // Histórico ganha: quem já aprovou procedure antes do período é recorrente,
    // independente da tag (evita inflar "novo" com retorno mal tagueado).
    if (input.patientsWithHistory.has(id)) {
      result.set(id, "recorrente");
      continue;
    }
    const cats = (input.categoriesByPatient.get(id) ?? []).map(normalizeCategory);
    if (cats.some((c) => CATEGORIAS_NOVO.has(c))) {
      result.set(id, "novo");
    } else if (cats.some((c) => CATEGORIAS_RECORRENTE.has(c))) {
      result.set(id, "recorrente");
    } else {
      result.set(id, "novo"); // sem tag e sem histórico = novo
    }
  }
  return result;
}

export interface DoutoraTicket {
  dentistName: string;
  patients: number;
  revenue: number;
  ticketMedio: number;
}

export function ticketPorDoutora(procs: ProcedureRowComDentista[]): DoutoraTicket[] {
  const byDentist = new Map<string, { patients: Set<string>; revenue: number }>();
  for (const p of procs) {
    const key = p.dentistName?.trim() || "Sem dentista";
    const entry = byDentist.get(key) ?? { patients: new Set<string>(), revenue: 0 };
    entry.patients.add(p.patientId);
    entry.revenue += p.value - p.discountAmount;
    byDentist.set(key, entry);
  }
  return [...byDentist.entries()]
    .map(([dentistName, e]) => ({
      dentistName,
      patients: e.patients.size,
      revenue: e.revenue,
      ticketMedio: e.patients.size > 0 ? e.revenue / e.patients.size : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);
}
```

- [ ] **Step 4: Rodar e ver passar** — `npm test -- patient-ticket` → PASS.

- [ ] **Step 5: Commit** — `git commit -m "feat: lib de ticket medio por paciente + classificacao novo/recorrente (DASH-13)"`

### Task A4: Bump + backlog + PR

- [ ] **Step 1:** `package.json` → `"version": "0.54.0"`; `src/lib/version.ts` → `APP_VERSION = "0.54.0"` + entrada no `CHANGELOG` (pt-BR, estilo das anteriores): fundação do ticket médio por paciente, dentista no procedure, sem mudança visual ainda.
- [ ] **Step 2:** `docs/IMPROVEMENTS.md` — mover [DASH-13] pra "Concluídos" com link do PR.
- [ ] **Step 3: Validar local** — `npm ci && npx prisma generate && npm run lint && npx tsc --noEmit && npm test && npm run build` → tudo verde, senão não abre PR.
- [ ] **Step 4: PR** — `gh pr create` referenciando DASH-13; aguardar CI verde; squash merge; conferir `gh run list --branch main --limit 3` (deploy disparou?). Pós-deploy: aguardar 1 ciclo do sync (15 min) e conferir na VPS `SELECT COUNT(*) FROM "Procedure" WHERE "dentistName" IS NOT NULL;` > 0.
- [ ] **Step 5:** remover worktree.

---

## PR B — Aba Painel Principal [DASH-14]: API `/api/painel` + página (v0.55.0)

**Worktree:** `git worktree add -b feat/dash-14-painel-principal ../clinifunnel-feat-dash14 main` (depois do merge do PR A).

**Files:**
- Create: `src/app/api/painel/route.ts`
- Create: `src/app/dashboard/painel/page.tsx`
- Modify: `src/components/layout/sidebar.tsx:22-31` (navItems) e `iconMap` (~:33-43)
- Modify: `src/app/dashboard/page.tsx` (redirect raiz → `/dashboard/painel` em vez de captacao — confirmar com Bruno; default proposto: SIM, painel vira a home)
- Modify: `package.json`, `src/lib/version.ts`, `docs/IMPROVEMENTS.md`

### Task B1: API `/api/painel`

- [ ] **Step 1: Implementar** `src/app/api/painel/route.ts` (mesmo esqueleto de auth/filtros do `/api/operacao:15-47`):

```typescript
// [DASH-14] /api/painel — KPIs executivos do Painel Principal (call Sérgio 08/06):
// ticket médio por PACIENTE (global / novo / recorrente), ticket médio e
// pacientes atendidos por doutora. Cálculo em src/lib/metrics/patient-ticket.ts.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthorizedClinicId, AuthError } from "@/lib/auth-guard";
import { APPROVED_PROCEDURE_FILTER } from "@/lib/dashboard-filters";
import {
  computePatientTicket,
  classifyPatients,
  ticketPorDoutora,
} from "@/lib/metrics/patient-ticket";

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

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  // Mesmo critério de período do /api/operacao: procedures por createdAt.
  const procDateFilter = from || to ? {
    createdAt: {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to) } : {}),
    },
  } : {};

  // 1. Procedures aprovados do período, com dentista.
  const procs = await prisma.procedure.findMany({
    where: { clinicId, ...APPROVED_PROCEDURE_FILTER, ...procDateFilter },
    select: { patientId: true, value: true, discountAmount: true, dentistName: true },
  });
  const patientIds = [...new Set(procs.map((p) => p.patientId))];

  // 2. Tags de tipo de consulta desses pacientes NO período (classificação).
  const appointmentDateFilter = from || to ? {
    date: {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to) } : {}),
    },
  } : {};
  const appts = await prisma.appointment.findMany({
    where: {
      clinicId,
      deleted: false,
      patientId: { in: patientIds },
      ...appointmentDateFilter,
    },
    select: { patientId: true, categoryDescription: true },
  });
  const categoriesByPatient = new Map<string, string[]>();
  for (const a of appts) {
    if (!a.patientId || !a.categoryDescription) continue;
    const list = categoriesByPatient.get(a.patientId) ?? [];
    list.push(a.categoryDescription);
    categoriesByPatient.set(a.patientId, list);
  }

  // 3. Histórico: pacientes do período com procedure Aprovado ANTES do período.
  const historyRows = from
    ? await prisma.procedure.findMany({
        where: {
          clinicId,
          ...APPROVED_PROCEDURE_FILTER,
          patientId: { in: patientIds },
          createdAt: { lt: new Date(from) },
        },
        select: { patientId: true },
        distinct: ["patientId"],
      })
    : [];
  const patientsWithHistory = new Set(historyRows.map((r) => r.patientId));

  // 4. Classifica e calcula.
  const classes = classifyPatients({ patientIds, categoriesByPatient, patientsWithHistory });
  const procsNovo = procs.filter((p) => classes.get(p.patientId) === "novo");
  const procsRecorrente = procs.filter((p) => classes.get(p.patientId) === "recorrente");

  // 5. Pacientes ATENDIDOS por doutora (appointments, não procedures).
  const atendidosPorDoutora = await prisma.appointment.groupBy({
    by: ["dentistName"],
    where: { clinicId, deleted: false, statusKey: "atendido", ...appointmentDateFilter },
    _count: { id: true },
  });
  // Pacientes distintos atendidos por doutora exige query crua (groupBy não faz count distinct):
  const pacientesPorDoutoraRaw = await prisma.$queryRawUnsafe<
    Array<{ dentistName: string | null; patients: number }>
  >(
    `SELECT "dentistName", COUNT(DISTINCT "patientId")::int AS patients
     FROM "Appointment"
     WHERE "clinicId" = $1 AND deleted = false AND "statusKey" = 'atendido'
       ${from ? `AND date >= $2::timestamp` : ""}
       ${to ? `AND date <= $${from ? "3" : "2"}::timestamp` : ""}
     GROUP BY "dentistName"`,
    clinicId,
    ...(from ? [from] : []),
    ...(to ? [to] : []),
  );

  return NextResponse.json({
    data: {
      ticketGlobal: computePatientTicket(procs),
      ticketNovo: computePatientTicket(procsNovo),
      ticketRecorrente: computePatientTicket(procsRecorrente),
      porDoutora: ticketPorDoutora(procs).map((d) => ({
        ...d,
        atendimentos:
          atendidosPorDoutora.find((a) => (a.dentistName ?? "Sem dentista") === d.dentistName)
            ?._count.id ?? 0,
        pacientesAtendidos:
          pacientesPorDoutoraRaw.find((a) => (a.dentistName ?? "Sem dentista") === d.dentistName)
            ?.patients ?? 0,
      })),
    },
  });
}
```

- [ ] **Step 2:** `npx tsc --noEmit` → limpo. Testar manual: `npm run dev` + `curl 'http://localhost:3000/api/painel?from=2026-06-01&to=2026-06-30'` logado (ou via browser) — conferir que ticketGlobal.patients ≤ ticketGlobal e que novo+recorrente = global (patients).

- [ ] **Step 3: Commit** — `git commit -m "feat: API /api/painel com ticket medio por paciente e por doutora (DASH-14)"`

### Task B2: Página + navegação

- [ ] **Step 1: Ler `src/app/dashboard/operacao/page.tsx`** e copiar o esqueleto: `useClinic`, date range sticky, componente `DateFilter`, grid de KPI cards. Manter o mesmo visual.

- [ ] **Step 2: Criar `src/app/dashboard/painel/page.tsx`** com:
  - Linha 1 de KPIs: **Ticket médio (global)** com subtítulo "por paciente", **Ticket médio paciente novo**, **Ticket médio paciente recorrente**, **Pacientes no período** (patients do global).
  - Cada card de ticket mostra embaixo `N pacientes · R$ X receita` pra auditabilidade (Sérgio confere os números — call 06:26).
  - Tabela "Por doutora": colunas Doutora / Pacientes atendidos / Atendimentos / Receita / Ticket médio. Linha "Sem dentista" só aparece se > 0, com tooltip explicando (procedures antigos sem backfill).
  - Estados: loading skeleton + vazio ("Sem dados no período").

- [ ] **Step 3: Sidebar** — em `src/components/layout/sidebar.tsx` adicionar como PRIMEIRO item de `navItems`:

```typescript
  { href: "/dashboard/painel", label: "Painel Principal", icon: "LayoutDashboard" },
```
e o ícone correspondente no `iconMap` (seguir o formato dos existentes).

- [ ] **Step 4: Redirect raiz** — `/dashboard` passa a redirecionar pra `/dashboard/painel`.

- [ ] **Step 5: Testar no browser** (`npm run dev`): navegação, filtro de data muda os números, tema dark/light. Comparar ticketGlobal com uma conta manual (receita Operação ÷ pacientes ativos Operação deve bater com global quando o período é o mesmo).

- [ ] **Step 6: Commit** — `git commit -m "feat: aba Painel Principal com KPIs executivos (DASH-14)"`

### Task B3: Bump + PR

- [ ] **Step 1:** bump 0.55.0 (package.json + version.ts + CHANGELOG: "Painel Principal — ticket médio por paciente (global/novo/recorrente), visão por doutora; pedido do cliente na call de 08/06").
- [ ] **Step 2:** IMPROVEMENTS.md → [DASH-14] concluído.
- [ ] **Step 3:** validação local completa (lint, tsc, test, build) + descrever no PR o que foi testado no browser (regra 5 do CLAUDE.md).
- [ ] **Step 4:** PR, CI verde, squash, conferir deploy, remover worktree.

---

## PR C — Atendimentos por tipo na Operação [DASH-15] (v0.56.0)

**Worktree:** `git worktree add -b feat/dash-15-atendimentos-tipo ../clinifunnel-feat-dash15 main`

**Files:**
- Modify: `src/app/api/operacao/route.ts`
- Modify: `src/app/dashboard/operacao/page.tsx`
- Modify: `src/lib/metrics/patient-ticket.ts` (exporta helper de bucket) + teste

### Task C1: Helper de bucket por categoria (TDD)

- [ ] **Step 1: Teste falhando** (no teste da lib):

```typescript
describe("bucketCategoria", () => {
  it("mapeia categorias nos 3 buckets do Sérgio", () => {
    expect(bucketCategoria("Avaliação")).toBe("primeira_consulta");
    expect(bucketCategoria("Primeira Consulta")).toBe("primeira_consulta");
    expect(bucketCategoria("Consulta")).toBe("recorrente");
    expect(bucketCategoria("Retorno")).toBe("retorno");
    expect(bucketCategoria("Qualquer outra")).toBe("outros");
    expect(bucketCategoria(null)).toBe("outros");
  });
});
```
(Valores ajustados pelo GATE 1 da vistoria.)

- [ ] **Step 2:** rodar → FAIL.

- [ ] **Step 3: Implementar** em `patient-ticket.ts`:

```typescript
export type CategoriaBucket = "primeira_consulta" | "retorno" | "recorrente" | "outros";

export function bucketCategoria(desc: string | null | undefined): CategoriaBucket {
  const c = normalizeCategory(desc);
  if (CATEGORIAS_NOVO.has(c)) return "primeira_consulta";
  if (c === "retorno") return "retorno";
  if (c === "consulta") return "recorrente";
  return "outros";
}
```
(Atenção: `CATEGORIAS_RECORRENTE` continua existindo pra classificação de paciente; aqui retorno e consulta são buckets separados porque o Sérgio quer ver os 3 — retorno "queima agenda mas não tem venda", call 09:06.)

- [ ] **Step 4:** rodar → PASS. Commit.

### Task C2: API + UI

- [ ] **Step 1: API** — em `/api/operacao/route.ts`, adicionar ao `Promise.all` (junto de `appointmentsByStatus`):

```typescript
    prisma.appointment.groupBy({
      by: ["categoryDescription"],
      where: { clinicId, deleted: false, statusKey: "atendido", ...appointmentDateFilter },
      _count: { id: true },
    }),
```
E no response, dentro de `appointments`:

```typescript
        // [DASH-15] Atendidos por tipo de consulta (tag das SDRs no Clinicorp)
        atendidosPorTipo: atendidosPorCategoria.reduce<Record<string, number>>((acc, row) => {
          const bucket = bucketCategoria(row.categoryDescription);
          acc[bucket] = (acc[bucket] ?? 0) + row._count.id;
          return acc;
        }, {}),
```

- [ ] **Step 2: UI** — no card de Atendimentos da Operação, sub-linha: `X primeira consulta · Y retorno · Z recorrente` (+ `· N outros` se > 0).

- [ ] **Step 3:** testar no browser com junho; somatório dos buckets = total de atendidos.

- [ ] **Step 4:** bump 0.56.0 + CHANGELOG + IMPROVEMENTS.md, validação completa, PR, squash, deploy check, remover worktree.

---

## PR D — Ticket médio por canal na Captação [DASH-16] (v0.57.0)

**Worktree:** `git worktree add -b feat/dash-16-ticket-canal ../clinifunnel-feat-dash16 main`

**Files:**
- Modify: `src/app/api/dashboard/route.ts` (ou `/api/painel` — decidir na hora: vai na Captação porque o canalBreakdown já vive lá, `route.ts:210-216`)
- Modify: `src/app/dashboard/captacao/page.tsx`

### Task D1: API

- [ ] **Step 1:** query crua (procedures Aprovado do período juntando canal do paciente):

```typescript
  // [DASH-16] Ticket médio por canal: receita líquida e pacientes distintos
  // por canalProspeccao do paciente (herdado do lead). "O core do dash" — Sérgio.
  const ticketPorCanal = await prisma.$queryRawUnsafe<
    Array<{ canal: string | null; patients: number; revenue: number }>
  >(
    `SELECT pat."canalProspeccao" AS canal,
            COUNT(DISTINCT pr."patientId")::int AS patients,
            SUM(pr.value - pr."discountAmount")::float AS revenue
     FROM "Procedure" pr
     JOIN "Patient" pat ON pat.id = pr."patientId"
     WHERE pr."clinicId" = $1 AND pr."statusDescription" = 'Aprovado' AND pr.deleted = false
       ${from ? `AND pr."createdAt" >= $2::timestamp` : ""}
       ${to ? `AND pr."createdAt" <= $${from ? "3" : "2"}::timestamp` : ""}
     GROUP BY pat."canalProspeccao"
     ORDER BY revenue DESC`,
    clinicId,
    ...(from ? [from] : []),
    ...(to ? [to] : []),
  );
```
No response: `ticketPorCanal: rows.map(r => ({ canal: r.canal ?? "Sem canal", patients: r.patients, revenue: r.revenue, ticketMedio: r.patients > 0 ? r.revenue / r.patients : 0 }))`.

- [ ] **Step 2: UI** — na Captação, ao lado/abaixo do canalBreakdown existente, tabela: Canal / Pacientes / Receita / Ticket médio. "Sem canal" por último com tooltip (paciente walk-in ou lead sem tagueamento das SDRs).

- [ ] **Step 3:** testar no browser; cross-check: soma das receitas por canal = receita do funil quando período igual.

- [ ] **Step 4:** bump 0.57.0 + CHANGELOG + IMPROVEMENTS.md, validação completa, PR, squash, deploy check, remover worktree.

---

## Fora de escopo (registrado, não fazer agora)

- **Dedup de leads por telefone no KPI "Leads captados"** — só se a vistoria V5 mostrar duplicatas relevantes (vira DASH-17).
- **Agente IA conversando com Clinicorp** — Bruno recomendou Claude Code + API direto pro Sérgio, fora do produto.
- **Correções da divergência de 04/06** — dependem do retorno da Ingrid (V4); viram item próprio com o playbook CAP-12/DASH-3.
- **Tooltip/clareza "faltas do funil ≠ faltas da clínica"** — micro-ajuste de UI; encaixar no PR C se sobrar espaço, senão backlog.

## Ordem de execução e dependências

```
Fase 0 (vistoria, sem deploy) ──► GATE 1/2/3 ──► PR A ──► PR B ──► PR C ──► PR D
                                                 (A precisa estar em prod 15min+
                                                  antes de validar B com dados reais)
```
PR C e PR D são independentes entre si (podem rodar em paralelo em worktrees separadas), mas ambos dependem do GATE 1 (strings de categoria) — C também do helper da Task C1 que vive na lib criada no PR A.

## Validação final com o Sérgio

Depois do PR D em produção: mandar mensagem pro Sérgio com print do Painel Principal de junho e os números lado a lado com o Clinicorp (ele disse que vai conferir tudo no início — call 22:27). Pedir pra Ingrid validar uma semana de uso antes de considerar DASH-12..16 fechados.
