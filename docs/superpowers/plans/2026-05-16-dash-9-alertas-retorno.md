# DASH-9 — Alertas de Retorno — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar sistema de alertas de retorno configurável (recall por procedimento, paciente inativo, pós-consulta) com cálculo on-demand, UI dentro de `/dashboard/patients` (tab Alertas) e tela de configuração em `/dashboard/settings/recall`. Bump v0.45.0 → v0.46.0.

**Architecture:** Função pura `computeReminders(input)` em `src/lib/reminders/calc.ts` (testável, sem I/O) consumida pelo endpoint `GET /api/reminders` (refator do existente). Configuração persiste em 2 tabelas novas (`ProcedureRecallInterval` + `ReminderAction`) e 2 colunas em `Clinic`. UI usa tabs em `/dashboard/patients` e nova rota `/dashboard/settings/recall`. Worker órfão `check-reminders` é deletado.

**Tech Stack:** Next.js 14 App Router, TypeScript strict, Prisma (PostgreSQL), Vitest, Tailwind + shadcn/ui, BullMQ (só pra limpar a queue).

**Spec de referência:** `docs/superpowers/specs/2026-05-14-dash-9-alertas-retorno-design.md` (430 linhas, aprovado por Bruno em 2026-05-14).

---

## Pré-requisitos

- Worktree dedicada criada via `superpowers:using-git-worktrees` (branch `feat/dash-9-alertas-retorno`, partindo de `main` atualizado).
- `npm ci` rodado na worktree.
- Postgres + Redis locais via `docker compose -f docker-compose.dev.yml up -d`.

---

## File Structure

**Create:**
- `prisma/migrations/20260516000000_reminders/migration.sql`
- `src/lib/reminders/types.ts`
- `src/lib/reminders/calc.ts`
- `src/lib/reminders/calc.test.ts`
- `src/app/api/reminders/action/route.ts`
- `src/app/api/settings/recall/route.ts`
- `src/app/api/settings/recall/[id]/route.ts`
- `src/app/api/settings/recall/limits/route.ts`
- `src/app/api/settings/recall/seed/route.ts`
- `src/components/dashboard/patient-alerts.tsx`
- `src/app/dashboard/settings/recall/page.tsx`

**Modify:**
- `prisma/schema.prisma` — adiciona 2 campos em `Clinic`, models `ProcedureRecallInterval` e `ReminderAction`
- `src/app/api/reminders/route.ts` — refator usando `calc.ts` + fix do filtro de status
- `src/app/dashboard/patients/page.tsx` — adiciona tabs Lista/Alertas
- `src/app/dashboard/settings/page.tsx` — adiciona link "Recall por procedimento →"
- `src/lib/queues.ts` — remove `getCheckRemindersQueue` e `"check-reminders"` da lista
- `src/workers/index.ts` — remove import/cleanup do worker
- `package.json` — bump version 0.45.0 → 0.46.0
- `src/lib/version.ts` — bump APP_VERSION + CHANGELOG entry
- `docs/IMPROVEMENTS.md` — adicionar DASH-9 em Concluídos + atualizar FEAT-2

**Delete:**
- `src/workers/check-reminders.ts`

---

## Task 1: Schema + migration

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260516000000_reminders/migration.sql`

- [ ] **Step 1: Adicionar 2 campos no model `Clinic`**

Editar `prisma/schema.prisma`, dentro do bloco `model Clinic { ... }`, logo após `kommoStages Json?` (linha ~60), adicionar:

```prisma
  // [DASH-9] Janela pra considerar paciente "inativo" (sem procedure aprovado).
  recallInactiveMonths   Int  @default(6)
  // [DASH-9] Dias apos procedure pra alerta de pos-consulta.
  recallPostConsultaDays Int  @default(3)
```

Adicionar também as relações novas na lista de relações da Clinic (após `appointments` / antes de `adCampaignData`):

```prisma
  procedureRecallIntervals ProcedureRecallInterval[]
  reminderActions          ReminderAction[]
```

- [ ] **Step 2: Adicionar models novos**

No fim de `prisma/schema.prisma`, adicionar:

```prisma
// [DASH-9] Configuracao de recall por procedimento. Match e case-insensitive
// `procedureNamePattern.toLowerCase()` contra `procedure.name.toLowerCase()` via includes.
// Se multiplos patterns batem, ganha o de maior `days` (heuristica anti-duplicata).
model ProcedureRecallInterval {
  id                   String   @id @default(cuid())
  clinicId             String
  procedureNamePattern String
  days                 Int
  createdAt            DateTime @default(now())
  updatedAt            DateTime @updatedAt
  clinic               Clinic   @relation(fields: [clinicId], references: [id], onDelete: Cascade)

  @@index([clinicId])
}

// [DASH-9] Log de tratamento de alerta. `reminderKey` e string deterministica:
//   recall:${patientId}:${procedureId}
//   inactive:${patientId}
//   postconsulta:${patientId}:${procedureId}
// A *ultima* action por reminderKey decide se o alerta esta consumido.
model ReminderAction {
  id           String    @id @default(cuid())
  clinicId     String
  reminderKey  String
  action       String
  snoozeUntil  DateTime?
  notes        String?
  createdAt    DateTime  @default(now())
  createdById  String?
  clinic       Clinic    @relation(fields: [clinicId], references: [id], onDelete: Cascade)

  @@index([clinicId, reminderKey])
}
```

- [ ] **Step 3: Criar diretório da migration**

Run: `mkdir -p prisma/migrations/20260516000000_reminders`

- [ ] **Step 4: Escrever a migration SQL**

Criar `prisma/migrations/20260516000000_reminders/migration.sql` com o conteúdo:

```sql
-- AlterTable
ALTER TABLE "Clinic" ADD COLUMN "recallInactiveMonths" INTEGER NOT NULL DEFAULT 6;
ALTER TABLE "Clinic" ADD COLUMN "recallPostConsultaDays" INTEGER NOT NULL DEFAULT 3;

-- CreateTable
CREATE TABLE "ProcedureRecallInterval" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "procedureNamePattern" TEXT NOT NULL,
    "days" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProcedureRecallInterval_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProcedureRecallInterval_clinicId_idx" ON "ProcedureRecallInterval"("clinicId");

-- AddForeignKey
ALTER TABLE "ProcedureRecallInterval" ADD CONSTRAINT "ProcedureRecallInterval_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "ReminderAction" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "reminderKey" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "snoozeUntil" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,

    CONSTRAINT "ReminderAction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReminderAction_clinicId_reminderKey_idx" ON "ReminderAction"("clinicId", "reminderKey");

-- AddForeignKey
ALTER TABLE "ReminderAction" ADD CONSTRAINT "ReminderAction_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

- [ ] **Step 5: Aplicar migration localmente e gerar client**

Run: `npx prisma migrate deploy && npx prisma generate`
Expected: "Applied 1 migration" + "Generated Prisma Client".

Verificar tabelas:
Run: `psql "$DATABASE_URL" -c "\dt" | grep -E "ProcedureRecallInterval|ReminderAction"`
Expected: 2 linhas listando ambas tabelas.

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260516000000_reminders/
git commit -m "feat(dash-9): schema ProcedureRecallInterval + ReminderAction + 2 campos em Clinic"
```

---

## Task 2: Tipos compartilhados

**Files:**
- Create: `src/lib/reminders/types.ts`

- [ ] **Step 1: Criar arquivo de tipos**

```ts
// [DASH-9] Tipos compartilhados entre lib pura, endpoint e UI.

export type ReminderType = "recall" | "inactive" | "postconsulta";

// Urgencia derivada de daysUntilDue:
//   < 0   -> overdue
//   0..7  -> urgent
//   8..30 -> upcoming
export type ReminderUrgency = "overdue" | "urgent" | "upcoming";

export type ReminderActionKind = "TRATADO" | "ADIADO" | "DISPENSADO";

export interface Reminder {
  key: string;
  type: ReminderType;
  patientId: string;
  patientName: string;
  patientPhone: string | null;
  procedureId: string | null;
  procedureName: string | null;
  baseDate: Date;
  dueDate: Date;
  daysUntilDue: number;
  urgency: ReminderUrgency;
  description: string;
}

export interface ProcedureForReminder {
  id: string;
  name: string;
  completedAt: Date;
  patient: { id: string; name: string; phone: string | null };
}

export interface RecallIntervalForCalc {
  procedureNamePattern: string;
  days: number;
}

export interface ReminderActionRecord {
  reminderKey: string;
  action: ReminderActionKind;
  snoozeUntil: Date | null;
  createdAt: Date;
}

export interface ComputeRemindersInput {
  procedures: ProcedureForReminder[];
  recallIntervals: RecallIntervalForCalc[];
  inactiveMonths: number;
  postConsultaDays: number;
  actions: ReminderActionRecord[];
  now?: Date;
}

export interface ReminderCounts {
  recall: number;
  inactive: number;
  postconsulta: number;
  total: number;
}

export interface RemindersGrouped {
  overdue: Reminder[];
  urgent: Reminder[];
  upcoming: Reminder[];
  counts: ReminderCounts;
}
```

- [ ] **Step 2: Type check passa**

Run: `npx tsc --noEmit`
Expected: 0 erros (arquivo é só de tipos).

- [ ] **Step 3: Commit**

```bash
git add src/lib/reminders/types.ts
git commit -m "feat(dash-9): tipos compartilhados para alertas de retorno"
```

---

## Task 3: Testes da lib pura (RED)

**Files:**
- Create: `src/lib/reminders/calc.test.ts`

Escrever todos os testes ANTES de qualquer implementação. Eles vão falhar no Step 2 (TDD red).

- [ ] **Step 1: Criar arquivo de testes**

```ts
import { describe, it, expect } from "vitest";
import { computeReminders } from "./calc";
import type { ComputeRemindersInput, ProcedureForReminder, RecallIntervalForCalc, ReminderActionRecord } from "./types";

const NOW = new Date("2026-05-16T12:00:00Z");

function makeProc(overrides: Partial<ProcedureForReminder> & { id: string; completedAt: Date }): ProcedureForReminder {
  return {
    id: overrides.id,
    name: overrides.name ?? "Botox 50U",
    completedAt: overrides.completedAt,
    patient: overrides.patient ?? { id: "pat1", name: "Maria", phone: "11999999999" },
  };
}

function daysAgo(n: number): Date {
  return new Date(NOW.getTime() - n * 86400000);
}

function baseInput(over: Partial<ComputeRemindersInput> = {}): ComputeRemindersInput {
  return {
    procedures: [],
    recallIntervals: [],
    inactiveMonths: 6,
    postConsultaDays: 3,
    actions: [],
    now: NOW,
    ...over,
  };
}

describe("computeReminders", () => {
  it("retorna lista vazia quando nao ha procedures", () => {
    expect(computeReminders(baseInput())).toEqual([]);
  });

  it("procedure sem match em recallIntervals nao gera alerta de recall", () => {
    const procs = [makeProc({ id: "p1", name: "Limpeza", completedAt: daysAgo(200) })];
    const res = computeReminders(baseInput({ procedures: procs, recallIntervals: [{ procedureNamePattern: "botox", days: 120 }] }));
    expect(res.find((r) => r.type === "recall")).toBeUndefined();
  });

  it("recall: procedure de 200 dias atras com botox 120d gera alerta atrasado 80 dias", () => {
    const procs = [makeProc({ id: "p1", name: "Aplicacao Botox 50U", completedAt: daysAgo(200) })];
    const res = computeReminders(baseInput({ procedures: procs, recallIntervals: [{ procedureNamePattern: "botox", days: 120 }] }));
    const recall = res.find((r) => r.type === "recall");
    expect(recall).toBeDefined();
    expect(recall!.daysUntilDue).toBe(-80);
    expect(recall!.urgency).toBe("overdue");
    expect(recall!.key).toBe("recall:pat1:p1");
  });

  it("recall: multiplos patterns batendo usa o de maior days", () => {
    const procs = [makeProc({ id: "p1", name: "Botox / Toxina combinado", completedAt: daysAgo(100) })];
    const res = computeReminders(baseInput({
      procedures: procs,
      recallIntervals: [
        { procedureNamePattern: "botox", days: 120 },
        { procedureNamePattern: "toxina", days: 180 },
      ],
    }));
    const recall = res.find((r) => r.type === "recall");
    expect(recall).toBeDefined();
    // base = -100, days = 180 (maior). dueDate = base + 180 = +80. daysUntilDue = +80.
    expect(recall!.daysUntilDue).toBe(80);
  });

  it("recall: alerta com daysUntilDue > 30 e filtrado fora", () => {
    // proc completado ha 80 dias com botox 120d -> dueDate em +40d -> > 30 -> filtrado
    const procs = [makeProc({ id: "p1", name: "Botox", completedAt: daysAgo(80) })];
    const res = computeReminders(baseInput({ procedures: procs, recallIntervals: [{ procedureNamePattern: "botox", days: 120 }] }));
    expect(res.find((r) => r.type === "recall")).toBeUndefined();
  });

  it("inativo: paciente com ultimo procedure ha 7 meses entra em inativo (threshold 6m)", () => {
    const procs = [makeProc({ id: "p1", name: "Limpeza", completedAt: daysAgo(210) })]; // ~7m
    const res = computeReminders(baseInput({ procedures: procs, inactiveMonths: 6 }));
    const inactive = res.find((r) => r.type === "inactive");
    expect(inactive).toBeDefined();
    expect(inactive!.key).toBe("inactive:pat1");
    expect(inactive!.procedureId).toBeNull();
  });

  it("inativo: 1 paciente com 3 procedures conta so o mais recente", () => {
    const procs = [
      makeProc({ id: "p1", name: "Botox", completedAt: daysAgo(400) }),
      makeProc({ id: "p2", name: "Limpeza", completedAt: daysAgo(100) }),
      makeProc({ id: "p3", name: "Toxina", completedAt: daysAgo(50) }),
    ];
    const res = computeReminders(baseInput({ procedures: procs, inactiveMonths: 6 }));
    // mais recente = 50 dias atras, ainda nao inativo (threshold 6m ~ 180d)
    expect(res.filter((r) => r.type === "inactive")).toHaveLength(0);
  });

  it("inativo: nao tem janela superior (vem com daysUntilDue muito negativo, mas aparece)", () => {
    const procs = [makeProc({ id: "p1", name: "Limpeza", completedAt: daysAgo(1000) })];
    const res = computeReminders(baseInput({ procedures: procs, inactiveMonths: 6 }));
    const inactive = res.find((r) => r.type === "inactive");
    expect(inactive).toBeDefined();
  });

  it("pos-consulta: dueDate = completedAt + postConsultaDays", () => {
    const procs = [makeProc({ id: "p1", name: "Limpeza", completedAt: daysAgo(1) })];
    const res = computeReminders(baseInput({ procedures: procs, postConsultaDays: 3 }));
    const post = res.find((r) => r.type === "postconsulta");
    expect(post).toBeDefined();
    expect(post!.daysUntilDue).toBe(2); // 3 - 1
    expect(post!.key).toBe("postconsulta:pat1:p1");
  });

  it("pos-consulta: procedure de 60 dias atras (daysUntilDue < -30) e filtrado fora", () => {
    const procs = [makeProc({ id: "p1", name: "Limpeza", completedAt: daysAgo(60) })];
    const res = computeReminders(baseInput({ procedures: procs, postConsultaDays: 3 }));
    expect(res.find((r) => r.type === "postconsulta")).toBeUndefined();
  });

  it("action TRATADO filtra o alerta fora", () => {
    const procs = [makeProc({ id: "p1", name: "Botox", completedAt: daysAgo(200) })];
    const actions: ReminderActionRecord[] = [
      { reminderKey: "recall:pat1:p1", action: "TRATADO", snoozeUntil: null, createdAt: daysAgo(1) },
    ];
    const res = computeReminders(baseInput({
      procedures: procs,
      recallIntervals: [{ procedureNamePattern: "botox", days: 120 }],
      actions,
    }));
    expect(res.find((r) => r.type === "recall")).toBeUndefined();
  });

  it("action ADIADO com snoozeUntil futuro filtra alerta", () => {
    const procs = [makeProc({ id: "p1", name: "Botox", completedAt: daysAgo(200) })];
    const future = new Date(NOW.getTime() + 7 * 86400000);
    const actions: ReminderActionRecord[] = [
      { reminderKey: "recall:pat1:p1", action: "ADIADO", snoozeUntil: future, createdAt: daysAgo(1) },
    ];
    const res = computeReminders(baseInput({
      procedures: procs,
      recallIntervals: [{ procedureNamePattern: "botox", days: 120 }],
      actions,
    }));
    expect(res.find((r) => r.type === "recall")).toBeUndefined();
  });

  it("action ADIADO com snoozeUntil passado faz alerta reaparecer", () => {
    const procs = [makeProc({ id: "p1", name: "Botox", completedAt: daysAgo(200) })];
    const past = new Date(NOW.getTime() - 1 * 86400000);
    const actions: ReminderActionRecord[] = [
      { reminderKey: "recall:pat1:p1", action: "ADIADO", snoozeUntil: past, createdAt: daysAgo(10) },
    ];
    const res = computeReminders(baseInput({
      procedures: procs,
      recallIntervals: [{ procedureNamePattern: "botox", days: 120 }],
      actions,
    }));
    expect(res.find((r) => r.type === "recall")).toBeDefined();
  });

  it("ultima action vence (ADIADO antigo + TRATADO recente -> filtrado)", () => {
    const procs = [makeProc({ id: "p1", name: "Botox", completedAt: daysAgo(200) })];
    const actions: ReminderActionRecord[] = [
      { reminderKey: "recall:pat1:p1", action: "ADIADO", snoozeUntil: new Date(NOW.getTime() - 86400000), createdAt: daysAgo(10) },
      { reminderKey: "recall:pat1:p1", action: "TRATADO", snoozeUntil: null, createdAt: daysAgo(1) },
    ];
    const res = computeReminders(baseInput({
      procedures: procs,
      recallIntervals: [{ procedureNamePattern: "botox", days: 120 }],
      actions,
    }));
    expect(res.find((r) => r.type === "recall")).toBeUndefined();
  });

  it("urgency: < 0 = overdue, 0..7 = urgent, 8..30 = upcoming", () => {
    const procs = [
      makeProc({ id: "p1", name: "Botox", completedAt: daysAgo(125), patient: { id: "a", name: "A", phone: null } }), // -5 -> overdue
      makeProc({ id: "p2", name: "Botox", completedAt: daysAgo(115), patient: { id: "b", name: "B", phone: null } }), // +5 -> urgent
      makeProc({ id: "p3", name: "Botox", completedAt: daysAgo(105), patient: { id: "c", name: "C", phone: null } }), // +15 -> upcoming
    ];
    const res = computeReminders(baseInput({
      procedures: procs,
      recallIntervals: [{ procedureNamePattern: "botox", days: 120 }],
    }));
    const byKey = (k: string) => res.find((r) => r.key === k)!;
    expect(byKey("recall:a:p1").urgency).toBe("overdue");
    expect(byKey("recall:b:p2").urgency).toBe("urgent");
    expect(byKey("recall:c:p3").urgency).toBe("upcoming");
  });

  it("descricao do recall inclui nome do procedure e dias", () => {
    const procs = [makeProc({ id: "p1", name: "Botox 50U", completedAt: daysAgo(125) })];
    const res = computeReminders(baseInput({ procedures: procs, recallIntervals: [{ procedureNamePattern: "botox", days: 120 }] }));
    const recall = res.find((r) => r.type === "recall")!;
    expect(recall.description.toLowerCase()).toContain("botox 50u");
    expect(recall.description).toMatch(/5 dias/);
  });
});
```

- [ ] **Step 2: Rodar testes — esperar falhar com "module not found"**

Run: `npx vitest run src/lib/reminders/calc.test.ts`
Expected: FAIL — `Cannot find module './calc'` (porque `calc.ts` ainda não existe).

---

## Task 4: Implementar lib pura (GREEN)

**Files:**
- Create: `src/lib/reminders/calc.ts`

- [ ] **Step 1: Implementar `computeReminders`**

```ts
import type {
  ComputeRemindersInput,
  ProcedureForReminder,
  RecallIntervalForCalc,
  Reminder,
  ReminderActionRecord,
  ReminderUrgency,
} from "./types";

const MS_PER_DAY = 86400000;

function daysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / MS_PER_DAY);
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * MS_PER_DAY);
}

function addMonths(d: Date, n: number): Date {
  const out = new Date(d.getTime());
  out.setMonth(out.getMonth() + n);
  return out;
}

function urgencyOf(daysUntilDue: number): ReminderUrgency {
  if (daysUntilDue < 0) return "overdue";
  if (daysUntilDue <= 7) return "urgent";
  return "upcoming";
}

function matchRecallInterval(
  procedureName: string,
  intervals: RecallIntervalForCalc[]
): number | null {
  const lower = procedureName.toLowerCase();
  let best: number | null = null;
  for (const i of intervals) {
    if (lower.includes(i.procedureNamePattern.toLowerCase())) {
      if (best === null || i.days > best) best = i.days;
    }
  }
  return best;
}

function buildKey(type: "recall" | "inactive" | "postconsulta", patientId: string, procedureId: string | null): string {
  return procedureId ? `${type}:${patientId}:${procedureId}` : `${type}:${patientId}`;
}

function describeRecall(procedureName: string, daysUntilDue: number): string {
  if (daysUntilDue < 0) return `${procedureName} vencido ha ${-daysUntilDue} dias`;
  if (daysUntilDue === 0) return `${procedureName} vence hoje`;
  return `${procedureName} vence em ${daysUntilDue} dias`;
}

function describeInactive(daysSinceLast: number): string {
  const months = Math.floor(daysSinceLast / 30);
  if (months <= 1) return `Inativo ha ${daysSinceLast} dias`;
  return `Inativo ha ${months} meses`;
}

function describePostConsulta(procedureName: string, daysUntilDue: number): string {
  if (daysUntilDue < 0) return `Pos-consulta de ${procedureName} venceu ha ${-daysUntilDue} dias`;
  if (daysUntilDue === 0) return `Pos-consulta de ${procedureName} hoje`;
  return `Pos-consulta de ${procedureName} em ${daysUntilDue} dias`;
}

function isReminderConsumed(reminder: Reminder, actions: ReminderActionRecord[], now: Date): boolean {
  const own = actions
    .filter((a) => a.reminderKey === reminder.key)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  if (own.length === 0) return false;
  const last = own[0];
  if (last.action === "TRATADO" || last.action === "DISPENSADO") return true;
  if (last.action === "ADIADO" && last.snoozeUntil && last.snoozeUntil > now) return true;
  return false;
}

function groupLatestProcByPatient(procs: ProcedureForReminder[]): Map<string, ProcedureForReminder> {
  const out = new Map<string, ProcedureForReminder>();
  for (const p of procs) {
    const prev = out.get(p.patient.id);
    if (!prev || p.completedAt > prev.completedAt) out.set(p.patient.id, p);
  }
  return out;
}

export function computeReminders(input: ComputeRemindersInput): Reminder[] {
  const now = input.now ?? new Date();
  const all: Reminder[] = [];

  // 1. Recall por procedimento
  for (const proc of input.procedures) {
    const days = matchRecallInterval(proc.name, input.recallIntervals);
    if (days === null) continue;
    const dueDate = addDays(proc.completedAt, days);
    const daysUntilDue = daysBetween(now, dueDate);
    if (daysUntilDue > 30) continue;
    all.push({
      key: buildKey("recall", proc.patient.id, proc.id),
      type: "recall",
      patientId: proc.patient.id,
      patientName: proc.patient.name,
      patientPhone: proc.patient.phone,
      procedureId: proc.id,
      procedureName: proc.name,
      baseDate: proc.completedAt,
      dueDate,
      daysUntilDue,
      urgency: urgencyOf(daysUntilDue),
      description: describeRecall(proc.name, daysUntilDue),
    });
  }

  // 2. Paciente inativo (1 por patient, pega o procedure mais recente)
  const latest = groupLatestProcByPatient(input.procedures);
  const threshold = addMonths(now, -input.inactiveMonths);
  for (const [, lastProc] of latest) {
    if (lastProc.completedAt < threshold) {
      const daysSince = daysBetween(lastProc.completedAt, now);
      all.push({
        key: buildKey("inactive", lastProc.patient.id, null),
        type: "inactive",
        patientId: lastProc.patient.id,
        patientName: lastProc.patient.name,
        patientPhone: lastProc.patient.phone,
        procedureId: null,
        procedureName: null,
        baseDate: lastProc.completedAt,
        dueDate: threshold,
        daysUntilDue: -daysSince,
        urgency: "overdue",
        description: describeInactive(daysSince),
      });
    }
  }

  // 3. Pos-consulta
  for (const proc of input.procedures) {
    const dueDate = addDays(proc.completedAt, input.postConsultaDays);
    const daysUntilDue = daysBetween(now, dueDate);
    if (daysUntilDue < -30 || daysUntilDue > 30) continue;
    all.push({
      key: buildKey("postconsulta", proc.patient.id, proc.id),
      type: "postconsulta",
      patientId: proc.patient.id,
      patientName: proc.patient.name,
      patientPhone: proc.patient.phone,
      procedureId: proc.id,
      procedureName: proc.name,
      baseDate: proc.completedAt,
      dueDate,
      daysUntilDue,
      urgency: urgencyOf(daysUntilDue),
      description: describePostConsulta(proc.name, daysUntilDue),
    });
  }

  // 4. Filtrar consumidos
  return all.filter((r) => !isReminderConsumed(r, input.actions, now));
}
```

- [ ] **Step 2: Rodar testes — todos verdes**

Run: `npx vitest run src/lib/reminders/calc.test.ts`
Expected: all PASS (16 testes).

- [ ] **Step 3: Type check passa**

Run: `npx tsc --noEmit`
Expected: 0 erros.

- [ ] **Step 4: Commit**

```bash
git add src/lib/reminders/calc.ts src/lib/reminders/calc.test.ts
git commit -m "feat(dash-9): lib pura computeReminders + 16 unit tests"
```

---

## Task 5: Refator `GET /api/reminders`

**Files:**
- Modify: `src/app/api/reminders/route.ts`

- [ ] **Step 1: Substituir o arquivo inteiro**

```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthorizedClinicId, AuthError } from "@/lib/auth-guard";
import { computeReminders } from "@/lib/reminders/calc";
import type { ReminderActionRecord, RemindersGrouped } from "@/lib/reminders/types";

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

  const [procRows, recallIntervals, clinic, actionRows] = await Promise.all([
    prisma.procedure.findMany({
      where: {
        clinicId,
        statusDescription: "Aprovado",
        deleted: false,
        completedAt: { not: null },
      },
      select: {
        id: true,
        name: true,
        completedAt: true,
        patient: { select: { id: true, name: true, phone: true } },
      },
    }),
    prisma.procedureRecallInterval.findMany({
      where: { clinicId },
      select: { procedureNamePattern: true, days: true },
    }),
    prisma.clinic.findUnique({
      where: { id: clinicId },
      select: { recallInactiveMonths: true, recallPostConsultaDays: true },
    }),
    prisma.reminderAction.findMany({
      where: { clinicId },
      select: { reminderKey: true, action: true, snoozeUntil: true, createdAt: true },
    }),
  ]);

  const procedures = procRows
    .filter((p): p is typeof p & { completedAt: Date } => p.completedAt !== null)
    .map((p) => ({
      id: p.id,
      name: p.name,
      completedAt: p.completedAt,
      patient: p.patient,
    }));

  const actions: ReminderActionRecord[] = actionRows.map((a) => ({
    reminderKey: a.reminderKey,
    action: a.action as ReminderActionRecord["action"],
    snoozeUntil: a.snoozeUntil,
    createdAt: a.createdAt,
  }));

  const reminders = computeReminders({
    procedures,
    recallIntervals,
    inactiveMonths: clinic?.recallInactiveMonths ?? 6,
    postConsultaDays: clinic?.recallPostConsultaDays ?? 3,
    actions,
  });

  reminders.sort((a, b) => a.daysUntilDue - b.daysUntilDue);

  const grouped: RemindersGrouped = {
    overdue: reminders.filter((r) => r.urgency === "overdue"),
    urgent: reminders.filter((r) => r.urgency === "urgent"),
    upcoming: reminders.filter((r) => r.urgency === "upcoming"),
    counts: {
      recall: reminders.filter((r) => r.type === "recall").length,
      inactive: reminders.filter((r) => r.type === "inactive").length,
      postconsulta: reminders.filter((r) => r.type === "postconsulta").length,
      total: reminders.length,
    },
  };

  return NextResponse.json({ data: grouped });
}
```

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit`
Expected: 0 erros.

- [ ] **Step 3: Smoke test manual (opcional, mas recomendado)**

Iniciar `npm run dev` em outro terminal e abrir o navegador autenticado:

```
GET http://localhost:3000/api/reminders
```

Expected: `200` com `{ data: { overdue: [], urgent: [], upcoming: [], counts: { ... } } }`. Em dev sem procedures Aprovados, listas vazias e counts em 0 são corretos.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/reminders/route.ts
git commit -m "feat(dash-9): refator GET /api/reminders usando computeReminders + fix filtro status (DASH-3)"
```

---

## Task 6: `POST /api/reminders/action`

**Files:**
- Create: `src/app/api/reminders/action/route.ts`

- [ ] **Step 1: Criar o endpoint**

```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthorizedClinicId, AuthError } from "@/lib/auth-guard";

export const dynamic = "force-dynamic";

const VALID_ACTIONS = ["TRATADO", "ADIADO", "DISPENSADO"] as const;
type ValidAction = (typeof VALID_ACTIONS)[number];

function isValidAction(s: unknown): s is ValidAction {
  return typeof s === "string" && (VALID_ACTIONS as readonly string[]).includes(s);
}

export async function POST(request: NextRequest) {
  let clinicId: string;
  let userId: string;
  try {
    const auth = await getAuthorizedClinicId(request);
    clinicId = auth.clinicId;
    userId = auth.userId;
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Erro de autorizacao" }, { status: 500 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body invalido" }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const reminderKey = typeof b.reminderKey === "string" ? b.reminderKey.trim() : "";
  if (!reminderKey || reminderKey.length > 200) {
    return NextResponse.json({ error: "reminderKey obrigatorio" }, { status: 400 });
  }
  if (!isValidAction(b.action)) {
    return NextResponse.json({ error: "action invalida" }, { status: 400 });
  }
  const action: ValidAction = b.action;

  let snoozeUntil: Date | null = null;
  if (action === "ADIADO") {
    if (typeof b.snoozeUntil !== "string") {
      return NextResponse.json({ error: "snoozeUntil obrigatorio para ADIADO" }, { status: 400 });
    }
    const d = new Date(b.snoozeUntil);
    if (Number.isNaN(d.getTime()) || d.getTime() <= Date.now()) {
      return NextResponse.json({ error: "snoozeUntil deve ser data futura" }, { status: 400 });
    }
    snoozeUntil = d;
  }

  let notes: string | null = null;
  if (typeof b.notes === "string" && b.notes.trim()) {
    notes = b.notes.trim().slice(0, 500);
  }

  await prisma.reminderAction.create({
    data: {
      clinicId,
      reminderKey,
      action,
      snoozeUntil,
      notes,
      createdById: userId,
    },
  });

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit`
Expected: 0 erros.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/reminders/action/route.ts
git commit -m "feat(dash-9): POST /api/reminders/action para registrar tratamento"
```

---

## Task 7: CRUD `/api/settings/recall` (lista + criar)

**Files:**
- Create: `src/app/api/settings/recall/route.ts`

- [ ] **Step 1: Criar o endpoint**

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

  const [intervals, clinic] = await Promise.all([
    prisma.procedureRecallInterval.findMany({
      where: { clinicId },
      orderBy: { createdAt: "asc" },
    }),
    prisma.clinic.findUnique({
      where: { id: clinicId },
      select: { recallInactiveMonths: true, recallPostConsultaDays: true },
    }),
  ]);

  return NextResponse.json({
    data: {
      intervals,
      inactiveMonths: clinic?.recallInactiveMonths ?? 6,
      postConsultaDays: clinic?.recallPostConsultaDays ?? 3,
    },
  });
}

export async function POST(request: NextRequest) {
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body invalido" }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const pattern = typeof b.procedureNamePattern === "string" ? b.procedureNamePattern.trim() : "";
  const days = typeof b.days === "number" ? Math.floor(b.days) : NaN;

  if (pattern.length < 2 || pattern.length > 100) {
    return NextResponse.json({ error: "procedureNamePattern deve ter 2-100 chars" }, { status: 400 });
  }
  if (!Number.isFinite(days) || days < 1 || days > 3650) {
    return NextResponse.json({ error: "days deve ser inteiro entre 1 e 3650" }, { status: 400 });
  }

  const existing = await prisma.procedureRecallInterval.findFirst({
    where: { clinicId, procedureNamePattern: { equals: pattern, mode: "insensitive" } },
  });
  if (existing) {
    return NextResponse.json({ error: "Pattern ja existe para esta clinica" }, { status: 409 });
  }

  const created = await prisma.procedureRecallInterval.create({
    data: { clinicId, procedureNamePattern: pattern, days },
  });
  return NextResponse.json({ data: created });
}
```

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit`
Expected: 0 erros.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/settings/recall/route.ts
git commit -m "feat(dash-9): GET+POST /api/settings/recall"
```

---

## Task 8: CRUD `/api/settings/recall/[id]` (editar + deletar)

**Files:**
- Create: `src/app/api/settings/recall/[id]/route.ts`

- [ ] **Step 1: Criar o endpoint**

```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthorizedClinicId, AuthError } from "@/lib/auth-guard";

export const dynamic = "force-dynamic";

async function resolveClinicId(request: NextRequest): Promise<string | NextResponse> {
  try {
    const auth = await getAuthorizedClinicId(request);
    return auth.clinicId;
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Erro de autorizacao" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const clinicIdOrErr = await resolveClinicId(request);
  if (typeof clinicIdOrErr !== "string") return clinicIdOrErr;
  const clinicId = clinicIdOrErr;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body invalido" }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const data: { procedureNamePattern?: string; days?: number } = {};

  if (b.procedureNamePattern !== undefined) {
    const pattern = typeof b.procedureNamePattern === "string" ? b.procedureNamePattern.trim() : "";
    if (pattern.length < 2 || pattern.length > 100) {
      return NextResponse.json({ error: "procedureNamePattern deve ter 2-100 chars" }, { status: 400 });
    }
    data.procedureNamePattern = pattern;
  }
  if (b.days !== undefined) {
    const days = typeof b.days === "number" ? Math.floor(b.days) : NaN;
    if (!Number.isFinite(days) || days < 1 || days > 3650) {
      return NextResponse.json({ error: "days deve ser inteiro entre 1 e 3650" }, { status: 400 });
    }
    data.days = days;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nada para atualizar" }, { status: 400 });
  }

  const existing = await prisma.procedureRecallInterval.findFirst({
    where: { id: params.id, clinicId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Nao encontrado" }, { status: 404 });
  }

  if (data.procedureNamePattern) {
    const dup = await prisma.procedureRecallInterval.findFirst({
      where: {
        clinicId,
        procedureNamePattern: { equals: data.procedureNamePattern, mode: "insensitive" },
        NOT: { id: params.id },
      },
    });
    if (dup) {
      return NextResponse.json({ error: "Pattern ja existe para esta clinica" }, { status: 409 });
    }
  }

  const updated = await prisma.procedureRecallInterval.update({
    where: { id: params.id },
    data,
  });
  return NextResponse.json({ data: updated });
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const clinicIdOrErr = await resolveClinicId(request);
  if (typeof clinicIdOrErr !== "string") return clinicIdOrErr;
  const clinicId = clinicIdOrErr;

  const existing = await prisma.procedureRecallInterval.findFirst({
    where: { id: params.id, clinicId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Nao encontrado" }, { status: 404 });
  }

  await prisma.procedureRecallInterval.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit`
Expected: 0 erros.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/settings/recall/[id]/route.ts
git commit -m "feat(dash-9): PUT+DELETE /api/settings/recall/[id]"
```

---

## Task 9: `/api/settings/recall/limits` + `/seed`

**Files:**
- Create: `src/app/api/settings/recall/limits/route.ts`
- Create: `src/app/api/settings/recall/seed/route.ts`

- [ ] **Step 1: Criar `limits/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthorizedClinicId, AuthError } from "@/lib/auth-guard";

export const dynamic = "force-dynamic";

export async function PUT(request: NextRequest) {
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body invalido" }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const data: { recallInactiveMonths?: number; recallPostConsultaDays?: number } = {};

  if (b.inactiveMonths !== undefined) {
    const m = typeof b.inactiveMonths === "number" ? Math.floor(b.inactiveMonths) : NaN;
    if (!Number.isFinite(m) || m < 1 || m > 60) {
      return NextResponse.json({ error: "inactiveMonths deve ser inteiro entre 1 e 60" }, { status: 400 });
    }
    data.recallInactiveMonths = m;
  }
  if (b.postConsultaDays !== undefined) {
    const d = typeof b.postConsultaDays === "number" ? Math.floor(b.postConsultaDays) : NaN;
    if (!Number.isFinite(d) || d < 1 || d > 30) {
      return NextResponse.json({ error: "postConsultaDays deve ser inteiro entre 1 e 30" }, { status: 400 });
    }
    data.recallPostConsultaDays = d;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nada para atualizar" }, { status: 400 });
  }

  await prisma.clinic.update({ where: { id: clinicId }, data });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Criar `seed/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthorizedClinicId, AuthError } from "@/lib/auth-guard";

export const dynamic = "force-dynamic";

const SEEDS: Array<{ procedureNamePattern: string; days: number }> = [
  { procedureNamePattern: "botox", days: 120 },
  { procedureNamePattern: "toxina", days: 120 },
  { procedureNamePattern: "preenchimento", days: 240 },
  { procedureNamePattern: "filler", days: 240 },
  { procedureNamePattern: "bioestimulador", days: 365 },
];

export async function POST(request: NextRequest) {
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

  const existing = await prisma.procedureRecallInterval.findMany({
    where: { clinicId },
    select: { procedureNamePattern: true },
  });
  const existingLower = new Set(existing.map((e) => e.procedureNamePattern.toLowerCase()));

  let created = 0;
  for (const s of SEEDS) {
    if (existingLower.has(s.procedureNamePattern.toLowerCase())) continue;
    await prisma.procedureRecallInterval.create({ data: { clinicId, ...s } });
    created++;
  }

  return NextResponse.json({ created, skipped: SEEDS.length - created });
}
```

- [ ] **Step 3: Type check**

Run: `npx tsc --noEmit`
Expected: 0 erros.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/settings/recall/limits/ src/app/api/settings/recall/seed/
git commit -m "feat(dash-9): PUT /api/settings/recall/limits + POST /seed (5 padroes hardcoded)"
```

---

## Task 10: Tela `/dashboard/settings/recall`

**Files:**
- Create: `src/app/dashboard/settings/recall/page.tsx`

- [ ] **Step 1: Criar o page**

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useClinic } from "@/hooks/use-clinic";

interface Interval {
  id: string;
  procedureNamePattern: string;
  days: number;
}

interface SettingsData {
  intervals: Interval[];
  inactiveMonths: number;
  postConsultaDays: number;
}

export default function RecallSettingsPage() {
  const { clinic, loading: clinicLoading } = useClinic();
  const [data, setData] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);

  const [inactiveMonths, setInactiveMonths] = useState(6);
  const [postConsultaDays, setPostConsultaDays] = useState(3);
  const [limitsStatus, setLimitsStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const [newPattern, setNewPattern] = useState("");
  const [newDays, setNewDays] = useState("");
  const [addStatus, setAddStatus] = useState<"idle" | "saving" | "error">("idle");
  const [addError, setAddError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPattern, setEditPattern] = useState("");
  const [editDays, setEditDays] = useState("");

  const [seedDismissed, setSeedDismissed] = useState(false);

  const reload = useCallback(() => {
    setLoading(true);
    fetch("/api/settings/recall")
      .then((r) => r.json())
      .then((json) => {
        const d: SettingsData = json.data;
        setData(d);
        setInactiveMonths(d.inactiveMonths);
        setPostConsultaDays(d.postConsultaDays);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!clinic) return;
    reload();
  }, [clinic, reload]);

  async function saveLimits() {
    setLimitsStatus("saving");
    try {
      const res = await fetch("/api/settings/recall/limits", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inactiveMonths, postConsultaDays }),
      });
      if (!res.ok) throw new Error();
      setLimitsStatus("saved");
      setTimeout(() => setLimitsStatus("idle"), 2000);
    } catch {
      setLimitsStatus("error");
      setTimeout(() => setLimitsStatus("idle"), 3000);
    }
  }

  async function addInterval() {
    setAddStatus("saving");
    setAddError(null);
    try {
      const days = Number(newDays);
      const res = await fetch("/api/settings/recall", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ procedureNamePattern: newPattern, days }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Erro ao salvar");
      setNewPattern("");
      setNewDays("");
      setAddStatus("idle");
      reload();
    } catch (e) {
      setAddStatus("error");
      setAddError(e instanceof Error ? e.message : "Erro");
    }
  }

  function startEdit(i: Interval) {
    setEditingId(i.id);
    setEditPattern(i.procedureNamePattern);
    setEditDays(String(i.days));
  }

  async function saveEdit(id: string) {
    try {
      const days = Number(editDays);
      const res = await fetch(`/api/settings/recall/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ procedureNamePattern: editPattern, days }),
      });
      if (!res.ok) return;
      setEditingId(null);
      reload();
    } catch {
      // silently fail
    }
  }

  async function removeInterval(id: string) {
    try {
      const res = await fetch(`/api/settings/recall/${id}`, { method: "DELETE" });
      if (!res.ok) return;
      reload();
    } catch {
      // silently fail
    }
  }

  async function seedDefaults() {
    try {
      const res = await fetch("/api/settings/recall/seed", { method: "POST" });
      if (!res.ok) return;
      reload();
    } catch {
      // silently fail
    }
  }

  if (clinicLoading || loading || !data) {
    return <p className="text-muted-foreground p-8">Carregando...</p>;
  }

  const showSeedBanner = data.intervals.length === 0 && !seedDismissed;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Configuracoes &gt; Recall</h1>
        <p className="text-sm text-muted-foreground">
          Intervalos de alerta de retorno por procedimento e limites globais da clinica
        </p>
      </div>

      {showSeedBanner && (
        <Card className="border-primary/40 bg-primary/5">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2">
                <p className="font-medium">Comece com 5 procedimentos comuns pre-configurados?</p>
                <ul className="text-sm text-muted-foreground space-y-0.5">
                  <li>• Botox (120 dias) — Toxina (120 dias)</li>
                  <li>• Preenchimento (240 dias) — Filler (240 dias)</li>
                  <li>• Bioestimulador (365 dias)</li>
                </ul>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button size="sm" onClick={seedDefaults}>Adicionar todos</Button>
                <Button size="sm" variant="ghost" onClick={() => setSeedDismissed(true)}>×</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Limites gerais</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="inactive-months">Paciente inativo a partir de:</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="inactive-months"
                  type="number"
                  min={1}
                  max={60}
                  value={inactiveMonths}
                  onChange={(e) => setInactiveMonths(Number(e.target.value))}
                  className="w-24"
                />
                <span className="text-sm text-muted-foreground">meses sem procedimento aprovado</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="post-days">Pos-consulta:</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="post-days"
                  type="number"
                  min={1}
                  max={30}
                  value={postConsultaDays}
                  onChange={(e) => setPostConsultaDays(Number(e.target.value))}
                  className="w-24"
                />
                <span className="text-sm text-muted-foreground">dias apos o procedimento</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={saveLimits} disabled={limitsStatus === "saving"}>
              {limitsStatus === "saving" ? "Salvando..." : "Salvar"}
            </Button>
            {limitsStatus === "saved" && <span className="text-sm text-green-600">Salvo!</span>}
            {limitsStatus === "error" && <span className="text-sm text-red-600">Erro ao salvar</span>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recall por procedimento</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Padrao de nome</TableHead>
                <TableHead className="w-32">Dias</TableHead>
                <TableHead className="w-48 text-right">Acoes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.intervals.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground">
                    Nenhum padrao configurado ainda.
                  </TableCell>
                </TableRow>
              ) : (
                data.intervals.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell>
                      {editingId === i.id ? (
                        <Input value={editPattern} onChange={(e) => setEditPattern(e.target.value)} />
                      ) : (
                        i.procedureNamePattern
                      )}
                    </TableCell>
                    <TableCell>
                      {editingId === i.id ? (
                        <Input type="number" value={editDays} onChange={(e) => setEditDays(e.target.value)} />
                      ) : (
                        i.days
                      )}
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      {editingId === i.id ? (
                        <>
                          <Button size="sm" onClick={() => saveEdit(i.id)}>Salvar</Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>Cancelar</Button>
                        </>
                      ) : (
                        <>
                          <Button size="sm" variant="outline" onClick={() => startEdit(i)}>Editar</Button>
                          <Button size="sm" variant="destructive" onClick={() => removeInterval(i.id)}>×</Button>
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          <div className="mt-4 flex flex-wrap items-end gap-3 border-t pt-4">
            <div className="space-y-1 flex-1 min-w-48">
              <Label htmlFor="new-pattern">Novo padrao</Label>
              <Input
                id="new-pattern"
                placeholder='Ex: "botox"'
                value={newPattern}
                onChange={(e) => setNewPattern(e.target.value)}
              />
            </div>
            <div className="space-y-1 w-32">
              <Label htmlFor="new-days">Dias</Label>
              <Input
                id="new-days"
                type="number"
                placeholder="120"
                value={newDays}
                onChange={(e) => setNewDays(e.target.value)}
              />
            </div>
            <Button onClick={addInterval} disabled={addStatus === "saving" || !newPattern || !newDays}>
              + Adicionar
            </Button>
          </div>
          {addError && <p className="mt-2 text-sm text-red-600">{addError}</p>}

          <p className="mt-4 text-xs text-muted-foreground">
            ⓘ O padrao de nome e casado case-insensitive contra o nome do procedimento no Clinicorp. Ex: &quot;botox&quot; pega &quot;Aplicacao Botox 50U&quot; e &quot;Botox Brow Lift&quot;.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit`
Expected: 0 erros.

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/settings/recall/page.tsx
git commit -m "feat(dash-9): tela /dashboard/settings/recall (limites + tabela + seed)"
```

---

## Task 11: Link na página `/dashboard/settings`

**Files:**
- Modify: `src/app/dashboard/settings/page.tsx`

- [ ] **Step 1: Adicionar link no header da página**

Em `src/app/dashboard/settings/page.tsx`, dentro do bloco `<div className="flex items-center gap-3">` que contém os links "Health automacao →", "Mapa de profissionais →", "Gerenciar usuarios →" (linhas ~213-231), adicionar logo após `Gerenciar usuarios →`:

```tsx
          <a
            href="/dashboard/settings/recall"
            className="text-sm font-medium text-gold hover:underline"
          >
            Recall por procedimento →
          </a>
```

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit`
Expected: 0 erros.

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/settings/page.tsx
git commit -m "feat(dash-9): link 'Recall por procedimento' no header de /settings"
```

---

## Task 12: Componente `PatientAlerts`

**Files:**
- Create: `src/components/dashboard/patient-alerts.tsx`

- [ ] **Step 1: Criar o componente**

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

interface Reminder {
  key: string;
  type: "recall" | "inactive" | "postconsulta";
  patientId: string;
  patientName: string;
  patientPhone: string | null;
  procedureName: string | null;
  daysUntilDue: number;
  description: string;
}

interface GroupedData {
  overdue: Reminder[];
  urgent: Reminder[];
  upcoming: Reminder[];
  counts: { recall: number; inactive: number; postconsulta: number; total: number };
}

type ActionKind = "TRATADO" | "ADIADO_7" | "ADIADO_30" | "DISPENSADO";

function iconFor(t: Reminder["type"]): string {
  if (t === "recall") return "🔁";
  if (t === "inactive") return "💤";
  return "🩺";
}

interface Props {
  onCountChange?: (total: number) => void;
}

export function PatientAlerts({ onCountChange }: Props) {
  const [data, setData] = useState<GroupedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [busy, setBusy] = useState<Set<string>>(new Set());

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

  const optimisticRemove = (key: string) => {
    setData((prev) => {
      if (!prev) return prev;
      const filter = (arr: Reminder[]) => arr.filter((r) => r.key !== key);
      const next: GroupedData = {
        overdue: filter(prev.overdue),
        urgent: filter(prev.urgent),
        upcoming: filter(prev.upcoming),
        counts: {
          ...prev.counts,
          total: prev.counts.total - 1,
        },
      };
      onCountChange?.(next.counts.total);
      return next;
    });
  };

  async function handleAction(r: Reminder, kind: ActionKind) {
    setOpenMenu(null);
    const newBusy = new Set(busy);
    newBusy.add(r.key);
    setBusy(newBusy);
    optimisticRemove(r.key);
    try {
      const body: Record<string, unknown> = { reminderKey: r.key };
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
    } catch {
      // rollback: recarrega tudo
      reload();
    } finally {
      setBusy((b) => {
        const c = new Set(b);
        c.delete(r.key);
        return c;
      });
    }
  }

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
        <Section title={`Atrasados (${data.overdue.length})`} reminders={data.overdue} onAction={handleAction} openMenu={openMenu} setOpenMenu={setOpenMenu} busy={busy} />
      )}
      {data.urgent.length > 0 && (
        <Section title={`Urgentes (${data.urgent.length})`} reminders={data.urgent} onAction={handleAction} openMenu={openMenu} setOpenMenu={setOpenMenu} busy={busy} />
      )}
      {data.upcoming.length > 0 && (
        <Section title={`Em breve (${data.upcoming.length})`} reminders={data.upcoming} onAction={handleAction} openMenu={openMenu} setOpenMenu={setOpenMenu} busy={busy} />
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
  onAction: (r: Reminder, kind: ActionKind) => void;
  openMenu: string | null;
  setOpenMenu: (k: string | null) => void;
  busy: Set<string>;
}

function Section({ title, reminders, onAction, openMenu, setOpenMenu, busy }: SectionProps) {
  return (
    <div className="space-y-2">
      <h3 className="font-medium text-sm">{title}</h3>
      <div className="rounded-xl bg-card glass-border divide-y divide-border/50">
        {reminders.map((r) => (
          <div key={r.key} className="flex items-center gap-3 px-4 py-3">
            <span className="text-lg">{iconFor(r.type)}</span>
            <Link href={`/dashboard/patients/${r.patientId}`} className="flex-1 min-w-0 hover:text-gold">
              <p className="font-medium truncate">{r.patientName}</p>
              <p className="text-xs text-muted-foreground truncate">{r.description}</p>
            </Link>
            <span className="text-xs text-muted-foreground hidden sm:inline">{r.patientPhone ?? "—"}</span>
            <div className="relative">
              <button
                disabled={busy.has(r.key)}
                onClick={() => setOpenMenu(openMenu === r.key ? null : r.key)}
                className="rounded-md bg-primary/10 px-3 py-1 text-xs font-medium text-primary hover:bg-primary/20 disabled:opacity-50"
              >
                Tratar ▾
              </button>
              {openMenu === r.key && (
                <div className="absolute right-0 top-full mt-1 z-10 w-44 rounded-md border border-border bg-card shadow-lg">
                  <button onClick={() => onAction(r, "TRATADO")} className="block w-full px-3 py-2 text-left text-sm hover:bg-muted/50">Tratado</button>
                  <button onClick={() => onAction(r, "ADIADO_7")} className="block w-full px-3 py-2 text-left text-sm hover:bg-muted/50">Adiar 7 dias</button>
                  <button onClick={() => onAction(r, "ADIADO_30")} className="block w-full px-3 py-2 text-left text-sm hover:bg-muted/50">Adiar 30 dias</button>
                  <button onClick={() => onAction(r, "DISPENSADO")} className="block w-full px-3 py-2 text-left text-sm hover:bg-muted/50 text-red-600">Dispensar</button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit`
Expected: 0 erros.

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/patient-alerts.tsx
git commit -m "feat(dash-9): componente PatientAlerts com 3 minicards + 3 secoes + [Tratar▾]"
```

---

## Task 13: Tab "Alertas" em `/dashboard/patients`

**Files:**
- Modify: `src/app/dashboard/patients/page.tsx`

- [ ] **Step 1: Substituir o arquivo inteiro**

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useClinic } from "@/hooks/use-clinic";
import Link from "next/link";
import { PatientAlerts } from "@/components/dashboard/patient-alerts";

interface PatientRow {
  id: string;
  name: string;
  phone: string | null;
  canal: string;
  totalRevenue: number;
  procedureCount: number;
  firstContact: string;
  lastProcedure: string | null;
}

type Tab = "lista" | "alertas";

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString("pt-BR") : "—";

export default function PatientsPage() {
  const { clinic, loading: clinicLoading } = useClinic();
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialTab: Tab = searchParams.get("tab") === "alertas" ? "alertas" : "lista";

  const [tab, setTab] = useState<Tab>(initialTab);
  const [patients, setPatients] = useState<PatientRow[]>([]);
  const [search, setSearch] = useState("");
  const [alertsCount, setAlertsCount] = useState<number | null>(null);

  const fetchData = useCallback(() => {
    if (!clinic) return;
    const params = new URLSearchParams({ clinicId: clinic.id });
    if (search) params.set("search", search);
    fetch(`/api/patients?${params}`)
      .then((res) => res.json())
      .then((json) => setPatients(json.data ?? []))
      .catch(() => {});
  }, [clinic, search]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Buscar count inicial (mesmo sem clicar na tab Alertas) pra mostrar badge
  useEffect(() => {
    if (!clinic || alertsCount !== null) return;
    fetch("/api/reminders")
      .then((r) => r.json())
      .then((json) => setAlertsCount(json.data?.counts?.total ?? 0))
      .catch(() => setAlertsCount(0));
  }, [clinic, alertsCount]);

  function changeTab(t: Tab) {
    setTab(t);
    const sp = new URLSearchParams(searchParams.toString());
    if (t === "alertas") sp.set("tab", "alertas");
    else sp.delete("tab");
    const qs = sp.toString();
    router.replace(qs ? `/dashboard/patients?${qs}` : "/dashboard/patients");
  }

  if (clinicLoading) return <p className="text-muted-foreground p-8">Carregando...</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Pacientes</h1>
          <p className="text-sm text-muted-foreground">Visao completa de todos os pacientes do funil</p>
        </div>
        {tab === "lista" && (
          <input
            type="text"
            placeholder="Buscar por nome ou telefone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-lg border border-border bg-card px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gold/50 w-72"
          />
        )}
      </div>

      <div className="flex gap-1 border-b border-border">
        <button
          onClick={() => changeTab("lista")}
          className={
            "px-4 py-2 text-sm font-medium border-b-2 -mb-px " +
            (tab === "lista" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")
          }
        >
          Lista ({patients.length})
        </button>
        <button
          onClick={() => changeTab("alertas")}
          className={
            "px-4 py-2 text-sm font-medium border-b-2 -mb-px " +
            (tab === "alertas" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")
          }
        >
          Alertas {alertsCount !== null ? `(${alertsCount})` : ""}
        </button>
      </div>

      {tab === "lista" ? (
        <div className="rounded-xl bg-card glass-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="px-4 py-3 font-medium text-muted-foreground">Nome</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">Telefone</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">Canal</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground text-right">Procedimentos</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground text-right">Receita</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground text-right">Primeiro Contato</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground text-right">Ultimo Proc.</th>
                </tr>
              </thead>
              <tbody>
                {patients.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                      Nenhum paciente encontrado.
                    </td>
                  </tr>
                ) : (
                  patients.map((p) => (
                    <tr key={p.id} className="border-b border-border/50 hover:bg-muted/5 transition-colors">
                      <td className="px-4 py-3">
                        <Link href={`/dashboard/patients/${p.id}`} className="font-medium hover:text-gold transition-colors">
                          {p.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{p.phone ?? "—"}</td>
                      <td className="px-4 py-3">
                        <span className="inline-block rounded-full bg-gold/10 px-2.5 py-0.5 text-xs font-medium text-gold">
                          {p.canal}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">{p.procedureCount}</td>
                      <td className="px-4 py-3 text-right font-semibold">{fmt(p.totalRevenue)}</td>
                      <td className="px-4 py-3 text-right text-muted-foreground">{fmtDate(p.firstContact)}</td>
                      <td className="px-4 py-3 text-right text-muted-foreground">{fmtDate(p.lastProcedure)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <PatientAlerts onCountChange={setAlertsCount} />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Type check + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: 0 erros, 0 warnings.

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/patients/page.tsx
git commit -m "feat(dash-9): tab 'Alertas (N)' em /dashboard/patients com deep-link via ?tab=alertas"
```

---

## Task 14: Cleanup do worker órfão

**Files:**
- Delete: `src/workers/check-reminders.ts`
- Modify: `src/lib/queues.ts`
- Modify: `src/workers/index.ts`

- [ ] **Step 1: Deletar o arquivo do worker**

Run: `git rm src/workers/check-reminders.ts`

- [ ] **Step 2: Atualizar `src/lib/queues.ts`**

Remover a função `getCheckRemindersQueue` (linhas 31-33) e a entrada `"check-reminders"` do array `QUEUE_NAMES`. Resultado final:

```ts
import { Queue } from "bullmq";
import { redis } from "@/lib/redis";

const queues = new Map<string, Queue>();

function getQueue(name: string): Queue {
  let queue = queues.get(name);
  if (!queue) {
    queue = new Queue(name, { connection: redis });
    queues.set(name, queue);
  }
  return queue;
}

export function getCreatePatientQueue() {
  return getQueue("create-patient");
}

export function getProcessProcedureQueue() {
  return getQueue("process-procedure");
}

export function getMatchLeadsQueue() {
  return getQueue("match-leads");
}

export function getSyncClinicorpQueue() {
  return getQueue("sync-clinicorp");
}

// Lista canonica das filas conhecidas. Usada por /api/admin/queues e
// futuras features de monitoramento. Nomes batem com o `name` passado pra
// `new Queue()` em cada worker.
export const QUEUE_NAMES = [
  "create-patient",
  "process-procedure",
  "match-leads",
  "sync-clinicorp",
  "sync-meta-ads",
  "sync-google-ads",
  "webhook-log-cleanup",
] as const;

export type QueueName = (typeof QUEUE_NAMES)[number];

// Retorna instancias Queue de cada uma. Sob a hood usa o cache de getQueue().
export function getAllQueues(): { name: QueueName; queue: Queue }[] {
  return QUEUE_NAMES.map((name) => ({ name, queue: getQueue(name) }));
}
```

- [ ] **Step 3: Atualizar `src/workers/index.ts`**

Remover import e shutdown do worker check-reminders. Conteúdo final:

```ts
import "dotenv/config";
import { logger } from "@/lib/logger";
import { createPatientWorker } from "./create-patient";
import { processProcedureWorker } from "./process-procedure";
import { matchLeadsWorker } from "./match-leads";
import { syncClinicorpWorker } from "./sync-clinicorp";
import { syncMetaAdsWorker } from "./sync-meta-ads";
import { syncGoogleAdsWorker } from "./sync-google-ads";
import { webhookLogCleanupWorker } from "./webhook-log-cleanup";

const log = logger.child({ scope: "workers" });

const WORKERS = [
  "create-patient",
  "process-procedure",
  "match-leads",
  "sync-clinicorp",
  "sync-meta-ads",
  "sync-google-ads",
  "webhook-log-cleanup",
];
log.info({ workers: WORKERS }, "starting CliniFunnel workers");

const shutdown = async () => {
  log.info("shutting down");
  await Promise.all([
    createPatientWorker.close(),
    processProcedureWorker.close(),
    matchLeadsWorker.close(),
    syncClinicorpWorker.close(),
    syncMetaAdsWorker.close(),
    syncGoogleAdsWorker.close(),
    webhookLogCleanupWorker.close(),
  ]);
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
```

- [ ] **Step 4: Verificar que nada mais referencia `check-reminders` ou `checkRemindersQueue`/`Worker`**

Run: `grep -rn "check-reminders\|checkReminders\|CheckReminders" src/ 2>&1 | grep -v "node_modules"`
Expected: 0 linhas (sem nenhuma referência sobrando).

- [ ] **Step 5: Type check**

Run: `npx tsc --noEmit`
Expected: 0 erros.

- [ ] **Step 6: Commit**

```bash
git add src/lib/queues.ts src/workers/index.ts
git commit -m "chore(dash-9): remove worker check-reminders orfao (logica vai pro endpoint on-demand)"
```

---

## Task 15: Bump versão + CHANGELOG

**Files:**
- Modify: `package.json`
- Modify: `src/lib/version.ts`

- [ ] **Step 1: Bump `package.json`**

Editar `package.json`, trocar a linha:
```
  "version": "0.45.0",
```
por:
```
  "version": "0.46.0",
```

- [ ] **Step 2: Bump `src/lib/version.ts` + adicionar entry**

Em `src/lib/version.ts`:
1. Trocar a primeira linha:
```ts
export const APP_VERSION = "0.45.0";
```
por:
```ts
export const APP_VERSION = "0.46.0";
```

2. No array `CHANGELOG`, adicionar como PRIMEIRA entrada (antes da entry `version: "0.45.0"`):

```ts
  {
    version: "0.46.0",
    date: "2026-05-16",
    type: "minor",
    changes: [
      "DASH-9: Alertas de retorno configuraveis (recall por procedimento, paciente inativo, pos-consulta)",
      "Schema novo: ProcedureRecallInterval (config por clinica) + ReminderAction (log de tratamento) + 2 campos em Clinic (recallInactiveMonths default 6, recallPostConsultaDays default 3)",
      "Tab 'Alertas (N)' em /dashboard/patients com 3 mini cards (Recall/Inativos/Pos-consulta), agrupados por urgencia (Atrasados/Urgentes/Em breve). Deep-link via ?tab=alertas",
      "Cada alerta tem botao [Tratar ▾] com 4 opcoes: Tratado, Adiar 7d, Adiar 30d, Dispensar. UX otimista (some na hora, POST em background, rollback em caso de erro)",
      "Tela /dashboard/settings/recall: configura intervalos por procedimento (CRUD) + limites globais (inativo em meses 1-60, pos-consulta em dias 1-30). Banner inicial 'Adicionar todos' chama POST /seed (5 padroes hardcoded: botox/toxina/preenchimento/filler/bioestimulador)",
      "Lib pura computeReminders em src/lib/reminders/calc.ts com 16 unit tests cobrindo match de pattern (maior days vence), janelas (-30..+30 pra recall/pos-consulta, sem limite superior pra inativo) e filtro por actions (ultima vence, snoozeUntil reabre alerta)",
      "Fix DASH-3 carryover: /api/reminders agora filtra statusDescription='Aprovado' (estava com legacy status='completed' e retornava 0)",
      "Cleanup: worker check-reminders (orfao, so logava) deletado. Removido da QUEUE_NAMES e dos imports. Calculo agora e on-demand no endpoint",
      "Migration: 20260516000000_reminders (so adiciona — sem destrutivo)",
    ],
  },
```

- [ ] **Step 3: Type check**

Run: `npx tsc --noEmit`
Expected: 0 erros.

- [ ] **Step 4: Commit**

```bash
git add package.json src/lib/version.ts
git commit -m "chore(dash-9): bump 0.45.0 -> 0.46.0 + CHANGELOG"
```

---

## Task 16: IMPROVEMENTS.md

**Files:**
- Modify: `docs/IMPROVEMENTS.md`

- [ ] **Step 1: Adicionar entry de DASH-9 em "Concluidos"**

Em `docs/IMPROVEMENTS.md`, na seção `## Concluidos`, adicionar como PRIMEIRA entrada (acima do `[DASH-8]`):

```markdown
- **[DASH-9] Alertas de retorno configuraveis (recall + inativo + pos-consulta)** — PR #_TBD_ — v0.46.0
  Sistema de alertas espelhando Clinicorp (que nao expoe via API). 3 tipos: recall por procedure (N dias configuravel por pattern), paciente inativo (M meses default 6), pos-consulta (D dias default 3). Tab "Alertas (N)" em /dashboard/patients com 3 minicards + 3 secoes por urgencia. Botao [Tratar ▾] (Tratado/Adiar 7d/Adiar 30d/Dispensar) com UX otimista. Tela /dashboard/settings/recall com CRUD de patterns + limites + seed de 5 padroes. Schema novo: ProcedureRecallInterval + ReminderAction + 2 campos em Clinic. Lib pura computeReminders com 16 unit tests. Refator de /api/reminders + fix do filtro statusDescription='Aprovado' (era legacy 'completed'). Worker check-reminders orfao deletado. Spec: docs/superpowers/specs/2026-05-14-dash-9-alertas-retorno-design.md.
```

- [ ] **Step 2: Atualizar `[FEAT-2]` em "Proximos"**

Localizar o bloco `[FEAT-2]` (linhas ~83-85) e substituir por:

```markdown
- **[FEAT-2] Lembretes proativos por procedimento (envio via WhatsApp/Kommo)**
  DASH-9 (v0.46.0) entregou a base: calculo + UI manual de tratamento. Proximo passo: enviar automatico via Z-API/WhatsApp Business quando alerta entra em "Urgente". Depende de [FEAT-1] estar pronto (canal WhatsApp). Marcado como [DASH-9.1] no spec.
  Eixo: feature · Bump: minor
```

- [ ] **Step 3: Commit**

```bash
git add docs/IMPROVEMENTS.md
git commit -m "docs(dash-9): mover DASH-9 pra Concluidos + atualizar FEAT-2"
```

---

## Task 17: Bateria pre-PR completa

- [ ] **Step 1: Rodar todas as validações**

Run: `npm ci && npx prisma generate && npm run lint && npx tsc --noEmit && npm test && npm run build`
Expected: tudo passa. Tests devem incluir os 16 novos de `calc.test.ts`.

Se qualquer comando falhar, NÃO abrir PR — voltar e corrigir o que quebrou.

- [ ] **Step 2: Teste manual no browser (golden path)**

Iniciar `npm run dev` e validar passo-a-passo:

- [ ] Login + navegar pra `/dashboard/settings/recall`. Deve mostrar banner de seed (se intervals vazio).
- [ ] Click "Adicionar todos" cria 5 patterns. Banner some.
- [ ] Adicionar pattern manual "limpeza" / 180. Tabela atualiza.
- [ ] Editar "botox" pra 100 dias. Salva.
- [ ] Deletar "filler". Some da tabela.
- [ ] Mudar `inactiveMonths` de 6 pra 3 + clicar Salvar. Toast "Salvo!".
- [ ] Navegar pra `/dashboard/patients`. Ver tab "Alertas (N)" com badge correto.
- [ ] Click na tab. URL muda pra `?tab=alertas`. Lista carrega com 3 minicards + secoes.
- [ ] `[Tratar ▾] > Tratado` num alerta. Some da lista instantaneamente. Contador decrementa.
- [ ] Recarregar a página. O alerta tratado continua sumido (persistido no DB).
- [ ] `[Tratar ▾] > Adiar 7 dias` num outro alerta. Some.
- [ ] `[Tratar ▾] > Dispensar` num terceiro. Some.
- [ ] Acessar `/dashboard/patients?tab=alertas` direto via URL — abre na tab correta.
- [ ] Sem alertas → empty state amigável.

Se algo não funciona, voltar ao passo apropriado e corrigir.

- [ ] **Step 3: Abrir PR**

Run:
```bash
git push -u origin feat/dash-9-alertas-retorno
gh pr create --title "feat: alertas de retorno configuraveis (DASH-9, v0.46.0)" --body "$(cat <<'EOF'
## Summary
- Implementa DASH-9: sistema de alertas de retorno (recall, inativo, pos-consulta) configuravel por clinica
- Tab "Alertas (N)" em /dashboard/patients + tela /dashboard/settings/recall
- Lib pura computeReminders com 16 unit tests (TDD)
- Fix carryover do DASH-3 em /api/reminders (filtro de status legado)
- Worker check-reminders orfao deletado

Spec: `docs/superpowers/specs/2026-05-14-dash-9-alertas-retorno-design.md`
Plan: `docs/superpowers/plans/2026-05-16-dash-9-alertas-retorno.md`

## Test plan
- [x] npm run lint
- [x] npx tsc --noEmit
- [x] npm test (16 novos tests em calc.test.ts passando)
- [x] npm run build
- [x] Migration 20260516000000_reminders aplica sem erro
- [x] /dashboard/settings/recall: banner de seed cria 5 patterns; CRUD funciona; limites salvam
- [x] /dashboard/patients tab Alertas: counts batem; [Tratar ▾] all 4 opcoes funcionam; UX otimista
- [x] Persistencia: alerta tratado continua sumido apos reload
- [x] Deep-link /dashboard/patients?tab=alertas abre na tab correta

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 4: Aguardar CI verde**

Run: `gh pr checks --watch`
Expected: lint + tsc + test + build todos verdes.

- [ ] **Step 5: Squash merge depois da aprovação**

Run: `gh pr merge --squash`

- [ ] **Step 6: Conferir deploy automático**

Run: `gh run list --branch main --limit 3`
Expected: workflow `deploy.yml` rodando ou green. Se não disparar em 5 min (webhook degradado), rodar dispatch manual:

Run: `gh workflow run deploy.yml --ref main`

- [ ] **Step 7: Validar prod**

Run: `curl -s https://clinifunnel.koaai.com.br/api/health | jq '.version'`
Expected: `"0.46.0"`.

Smoke test no browser de prod: `/dashboard/settings/recall` carrega + `/dashboard/patients?tab=alertas` mostra a tab.

- [ ] **Step 8: Cleanup da worktree e do HANDOFF.md**

```bash
# Voltar pro clone principal
cd /Users/macintosh/Documents/Claude.Code/clinifunnel
git worktree remove ../clinifunnel-feat-dash-9
git branch -D feat/dash-9-alertas-retorno    # ja foi squash-merged
# Deletar HANDOFF.md (ja foi pra prod e validado)
git rm HANDOFF.md
git commit -m "chore: remove HANDOFF.md (DASH-9 entregue em v0.46.0)"
git push origin main
```

---

## Self-Review checklist

- ✅ Spec §1 (objetivo) → Tasks 1-17 cobrem o sistema completo.
- ✅ Spec §2 (mudanças por arquivo) → todas as 13 entradas tem task correspondente.
- ✅ Spec §3 (schema) → Task 1.
- ✅ Spec §4 (lib pura) → Tasks 2-4.
- ✅ Spec §5 (endpoints 5.1-5.8) → Tasks 5, 6, 7, 8, 9.
- ✅ Spec §6 (UI patients tab) → Tasks 12, 13.
- ✅ Spec §7 (UI settings/recall) → Tasks 10, 11.
- ✅ Spec §8 (migration + cleanup) → Tasks 1, 14.
- ✅ Spec §9 (bump) → Task 15.
- ✅ Spec §10 (testes) → Tasks 3, 4 (16 tests); §10.3 manual em Task 17.
- ✅ Spec §13 (ordem) → respeitada (schema → lib+tests → endpoints → UI → cleanup → bump).
- ✅ Sem placeholders ("TBD", "TODO", "appropriate error handling").
- ✅ Types consistentes: `Reminder`/`ReminderType`/`ReminderUrgency`/`ReminderActionRecord` definidos em Task 2 e usados consistentemente nos demais.
- ✅ Migration paths conferem (Procedure usa `statusDescription = "Aprovado"` confirmado no schema atual).
- ✅ Auth-guard signature confere (`{ clinicId, userId, role }` confirmado em src/lib/auth-guard.ts).
