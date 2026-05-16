# DASH-9 — Alertas de Retorno

> **Status:** aprovado por Bruno em 2026-05-14
> **Autor da spec:** Claude (Opus 4.7)
> **Versão alvo:** v0.46.0 (minor — feature significativa)
> **Depende de:** DASH-8 mergeado (rota de Pacientes vai ganhar tab "Alertas")
> **Escopo:** sistema de alertas de retorno (recall, paciente inativo, pós-consulta) com configuração por clínica e ações de tratamento.

---

## 1. Objetivo

Bruno pediu para espelhar os "alertas de retorno" que existem no Clinicorp dentro do CliniFunnel. **A API pública do Clinicorp não expõe isso** — não tem endpoint pra recall/alertas. Logo, calculamos do nosso lado a partir dos dados de procedimentos que já sincronizamos.

Já existe código órfão em `src/app/api/reminders/route.ts` + worker `check-reminders` — esta spec **substitui** essa lógica por algo completo, configurável e com UI.

### O que entra

| Tipo de alerta | Lógica | Configuração |
|---|---|---|
| **Recall por procedimento** | Procedure X concluído em DATA → alerta em DATA + N dias | N por procedure (configurável na tela de Settings) |
| **Paciente inativo** | Último procedure aprovado há > M meses | M global por clínica (default 6, configurável) |
| **Pós-consulta** | D dias após o procedure | D global por clínica (default 3, configurável) |

### O que **não** entra neste PR

- Envio automático via WhatsApp/Kommo (depende de `[FEAT-1]` Z-API/WhatsApp Business — futuro PR `[DASH-9.1]`)
- Aniversário (depende de campo de data de nascimento que não puxamos do Clinicorp hoje)
- Histórico de quem tratou o alerta com filtros/relatórios (só registra; visualização rica é PR futuro se útil)

---

## 2. Mudanças por arquivo

| Arquivo | Tipo | Mudança |
|---|---|---|
| `prisma/schema.prisma` | edit | + `ProcedureRecallInterval` model + `ReminderAction` model + 2 campos em `Clinic` |
| `prisma/migrations/20260515000000_reminders/migration.sql` | novo | migração |
| `src/lib/reminders/types.ts` | novo | tipos `Reminder`, `ReminderType`, `ReminderUrgency` |
| `src/lib/reminders/calc.ts` | novo | função pura `computeReminders(input) → Reminder[]` |
| `src/lib/reminders/calc.test.ts` | novo | unit tests da função pura |
| `src/app/api/reminders/route.ts` | refactor | usa `calc.ts` + corrige bug do filter status (DASH-3 carryover) |
| `src/app/api/reminders/action/route.ts` | novo | `POST` registrar tratamento |
| `src/app/api/settings/recall/route.ts` | novo | `GET`+`POST` config |
| `src/app/api/settings/recall/[id]/route.ts` | novo | `PUT`+`DELETE` config |
| `src/app/dashboard/patients/page.tsx` | edit | adiciona tab "Alertas (N)" + componente novo |
| `src/components/dashboard/patient-alerts.tsx` | novo | lista de alertas com [Tratar▾] dropdown |
| `src/app/dashboard/settings/recall/page.tsx` | novo | tela de config com 2 cards |
| `src/components/layout/sidebar.tsx` | edit (mínimo) | nenhuma mudança (recall fica em `/dashboard/settings/recall`, sub-rota) |
| `src/workers/check-reminders.ts` | edit ou delete | hoje só loga; vou **deletar** (lógica vai pro endpoint que computa on-demand) e remover da queue config |
| `src/lib/queues.ts` | edit | remove `check-reminders` queue |
| `src/workers/index.ts` | edit | remove import/cleanup do worker |
| `src/lib/version.ts` + `package.json` | edit | bump v0.46.0 + CHANGELOG |
| `docs/IMPROVEMENTS.md` | edit | move `[DASH-9]` pra Concluídos; move `[FEAT-2]` pra "Próximos" detalhando próximo passo |

---

## 3. Schema novo

### 3.1 Campos em `Clinic`

```prisma
model Clinic {
  // ... campos existentes ...
  recallInactiveMonths   Int  @default(6)
  recallPostConsultaDays Int  @default(3)
}
```

Por que campos diretos em `Clinic` em vez de tabela `ClinicReminderSettings`: são **2 inteiros** com defaults claros. Tabela separada seria over-engineered. Migration adiciona com default — clínicas existentes ficam com 6/3 imediatamente.

### 3.2 `ProcedureRecallInterval`

```prisma
model ProcedureRecallInterval {
  id                   String   @id @default(cuid())
  clinicId             String
  procedureNamePattern String                       // case-insensitive contains, ex: "botox"
  days                 Int
  createdAt            DateTime @default(now())
  updatedAt            DateTime @updatedAt
  clinic               Clinic   @relation(fields: [clinicId], references: [id], onDelete: Cascade)

  @@index([clinicId])
}
```

Match: se `procedureName.toLowerCase().includes(pattern.toLowerCase())`, aplica `days`. Se múltiplos padrões batem, **pega o de maior `days`** (intervalo mais longo) — heurística pra evitar duplicar alertas em padrões sobrepostos (ex: "botox" e "toxina" no mesmo proc).

### 3.3 `ReminderAction`

```prisma
model ReminderAction {
  id           String    @id @default(cuid())
  clinicId     String
  reminderKey  String                              // chave determinística (ver §4.3)
  action       String                              // "TRATADO" | "ADIADO" | "DISPENSADO"
  snoozeUntil  DateTime?
  notes        String?
  createdAt    DateTime  @default(now())
  createdById  String?                             // userId que tratou (audit trail)
  clinic       Clinic    @relation(fields: [clinicId], references: [id], onDelete: Cascade)

  @@index([clinicId, reminderKey])
}
```

**Por que `reminderKey` (string) em vez de FK pra Procedure**: alertas de "paciente inativo" não têm um procedure específico (é estado do patient). Alertas de "pós-consulta" referenciam procedure mas com tipo diferente do recall. Uma key textual unifica os 3 tipos:

- `recall:${patientId}:${procedureId}` (alerta de recall)
- `inactive:${patientId}` (paciente inativo — sem procedure específico)
- `postconsulta:${patientId}:${procedureId}` (pós-consulta de um procedure específico)

Múltiplos `ReminderAction` com mesma `reminderKey` podem coexistir (ex: 2 adiamentos sucessivos). A regra de "qual conta agora" está em §4.4.

---

## 4. Lógica de cálculo (lib pura)

### 4.1 `src/lib/reminders/types.ts`

```ts
export type ReminderType = "recall" | "inactive" | "postconsulta";
export type ReminderUrgency = "overdue" | "urgent" | "upcoming";  // <0 / 0-7 / 8-30 dias

export interface Reminder {
  key: string;                          // ver §3.3
  type: ReminderType;
  patientId: string;
  patientName: string;
  patientPhone: string | null;
  procedureId: string | null;           // null pra inactive
  procedureName: string | null;
  baseDate: Date;                       // data do procedure ou último contato
  dueDate: Date;                        // quando o alerta deve aparecer
  daysUntilDue: number;                 // negativo = atrasado
  urgency: ReminderUrgency;
  description: string;                  // ex: "Botox de 16/jan vencido há 12 dias"
}

export interface ComputeRemindersInput {
  procedures: ProcedureForReminder[];   // só Aprovado + deleted=false + completedAt!=null
  recallIntervals: ProcedureRecallInterval[];
  inactiveMonths: number;
  postConsultaDays: number;
  actions: ReminderAction[];            // todos da clinica, pra filtrar consumidos
  now?: Date;                           // injetável pra testes
}

interface ProcedureForReminder {
  id: string;
  name: string;
  completedAt: Date;
  patient: { id: string; name: string; phone: string | null };
}
```

### 4.2 `src/lib/reminders/calc.ts`

Função pura `computeReminders(input: ComputeRemindersInput): Reminder[]`:

```ts
export function computeReminders(input: ComputeRemindersInput): Reminder[] {
  const now = input.now ?? new Date();
  const all: Reminder[] = [];

  // 1. Recall por procedimento
  for (const proc of input.procedures) {
    const days = matchRecallInterval(proc.name, input.recallIntervals);
    if (days === null) continue;
    const dueDate = addDays(proc.completedAt, days);
    all.push(buildRecallReminder(proc, dueDate, now));
  }

  // 2. Paciente inativo (1 por patient — pega o procedure mais recente)
  const latestByPatient = groupLatestProcByPatient(input.procedures);
  const inactiveThreshold = addMonths(now, -input.inactiveMonths);
  for (const [patientId, lastProc] of latestByPatient) {
    if (lastProc.completedAt < inactiveThreshold) {
      all.push(buildInactiveReminder(patientId, lastProc, now));
    }
  }

  // 3. Pós-consulta
  for (const proc of input.procedures) {
    const dueDate = addDays(proc.completedAt, input.postConsultaDays);
    const daysUntilDue = daysBetween(now, dueDate);
    // Aparece apenas na janela [-30, +30] pra não inflar lista com procs antigos
    if (daysUntilDue < -30 || daysUntilDue > 30) continue;
    all.push(buildPostConsultaReminder(proc, dueDate, now));
  }

  // 4. Filtrar consumidos via actions
  return filterByActions(all, input.actions, now);
}
```

Função `urgency(daysUntilDue)`:
- `< 0` → `overdue`
- `0..7` → `urgent`
- `8..30` → `upcoming`
- `> 30` → não entra na lista (ver §4.5)

### 4.3 `reminderKey`

```ts
function buildKey(type: ReminderType, patientId: string, procedureId: string | null): string {
  return procedureId ? `${type}:${patientId}:${procedureId}` : `${type}:${patientId}`;
}
```

### 4.4 `filterByActions`

Pra cada reminder candidato, busca actions com mesma `key` ordenadas por `createdAt desc` (mais recente primeiro):

```ts
function isReminderConsumed(reminder: Reminder, actions: ReminderAction[], now: Date): boolean {
  const ownActions = actions
    .filter((a) => a.reminderKey === reminder.key)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  if (ownActions.length === 0) return false;

  const last = ownActions[0];
  if (last.action === "TRATADO" || last.action === "DISPENSADO") return true;
  if (last.action === "ADIADO" && last.snoozeUntil && last.snoozeUntil > now) return true;

  return false;
}
```

Regra: a **última action** decide. `TRATADO`/`DISPENSADO` → consumido pra sempre. `ADIADO` com `snoozeUntil > now` → consumido temporariamente; quando `snoozeUntil` passa, alerta reaparece.

### 4.5 Janela de "Em breve"

Recall e pós-consulta listam alertas em **`daysUntilDue ≤ 30`** (já passados ou nos próximos 30 dias). Procedures muito antigos não geram alertas perenes — depois de 30 dias atrasado, sai da lista (o paciente já é "inativo" e cai no outro tipo).

**Inativo** não tem janela superior — uma vez inativo, fica até voltar (procedure novo) ou ser tratado/dispensado.

---

## 5. Endpoints

### 5.1 `GET /api/reminders`

**Refator do existente.** Lê:

```ts
const [procedures, recallIntervals, clinic, actions] = await Promise.all([
  prisma.procedure.findMany({
    where: {
      clinicId,
      statusDescription: "Aprovado",   // ← fix do bug DASH-3
      deleted: false,
      completedAt: { not: null },
    },
    include: { patient: { select: { id: true, name: true, phone: true } } },
  }),
  prisma.procedureRecallInterval.findMany({ where: { clinicId } }),
  prisma.clinic.findUnique({
    where: { id: clinicId },
    select: { recallInactiveMonths: true, recallPostConsultaDays: true },
  }),
  prisma.reminderAction.findMany({ where: { clinicId } }),
]);
```

Chama `computeReminders(...)` e retorna agrupado por urgência:

```ts
{
  data: {
    overdue: Reminder[],
    urgent: Reminder[],
    upcoming: Reminder[],
    counts: { recall: number; inactive: number; postconsulta: number; total: number };
  }
}
```

### 5.2 `POST /api/reminders/action`

Body:
```ts
{
  reminderKey: string;
  action: "TRATADO" | "ADIADO" | "DISPENSADO";
  snoozeUntil?: string;   // ISO date, obrigatório se action === "ADIADO"
  notes?: string;
}
```

Validação:
- `action` em enum
- `snoozeUntil` obrigatório e futuro se `ADIADO`; ignorado se outras actions
- `notes` max 500 chars

Cria `ReminderAction` com `clinicId` (do auth-guard) e `createdById` (userId do session). Retorna `{ ok: true }`.

### 5.3 `GET /api/settings/recall`

Retorna:
```ts
{
  intervals: ProcedureRecallInterval[];   // ordenados por createdAt asc
  inactiveMonths: number;
  postConsultaDays: number;
}
```

### 5.4 `POST /api/settings/recall`

Cria um `ProcedureRecallInterval` novo. Body: `{ procedureNamePattern: string; days: number }`.

Validação:
- `procedureNamePattern` trimmed, min 2 chars, max 100
- `days` integer, 1 ≤ days ≤ 3650 (10 anos)
- **Não permite duplicar pattern** (case-insensitive) na mesma clínica → 409

### 5.5 `PUT /api/settings/recall/[id]`

Atualiza `procedureNamePattern` e/ou `days`. Mesma validação. Filtra `clinicId` (multi-tenant).

### 5.6 `DELETE /api/settings/recall/[id]`

Remove. Filtra `clinicId`. Retorna `{ ok: true }`.

### 5.7 `PUT /api/settings/recall/limits`

Atualiza `inactiveMonths` / `postConsultaDays` em `Clinic`. Body: `{ inactiveMonths?: number; postConsultaDays?: number }`.

Validação:
- `inactiveMonths`: 1 ≤ m ≤ 60
- `postConsultaDays`: 1 ≤ d ≤ 30

### 5.8 `POST /api/settings/recall/seed`

One-click pra popular com os 5 padrões hardcoded atuais. Idempotente — só cria os que ainda não existem (match por `procedureNamePattern` lowercased).

```ts
const SEEDS = [
  { procedureNamePattern: "botox", days: 120 },
  { procedureNamePattern: "toxina", days: 120 },
  { procedureNamePattern: "preenchimento", days: 240 },
  { procedureNamePattern: "filler", days: 240 },
  { procedureNamePattern: "bioestimulador", days: 365 },
];
```

Retorna `{ created: number; skipped: number }`.

---

## 6. UI — `/dashboard/patients` (tab Alertas)

### 6.1 Tabs

Topo da página ganha 2 tabs (não modal/drawer):

```
Pacientes
┌─────────────────────────────────────┐
│ [ Lista (108) ]  [ Alertas (24) ]   │
└─────────────────────────────────────┘
                      ↑ badge = total
```

Estado: `const [tab, setTab] = useState<"lista" | "alertas">("lista")`. Tab inicial respeita query string `?tab=alertas` (pra deep-link).

### 6.2 Conteúdo da tab Alertas

```
3 mini cards (counts):
┌──────────┬──────────┬──────────────┐
│ Recall   │ Inativos │ Pós-consulta │
│   12     │    8     │       4      │
└──────────┴──────────┴──────────────┘

Atrasados (5)
┌──────────────────────────────────────────────────────────────────┐
│ 🔁 Maria Silva  · Botox vencido há 12 dias  · (11) 99999  [Tratar▾] │
│ 💤 João Souza   · Inativo há 9 meses          · (11) 88888  [Tratar▾] │
└──────────────────────────────────────────────────────────────────┘

Urgentes (≤ 7 dias)  (8)
...

Em breve (≤ 30 dias)  (11)
...
```

Ícones por tipo:
- 🔁 recall (ou ícone Lucide `RefreshCw`)
- 💤 inativo (ícone `MoonStar`)
- 🩺 pós-consulta (ícone `Stethoscope`)

Linha do alerta:
- Clicável (link pro `/dashboard/patients/[patientId]`)
- Descrição computada em `calc.ts` (ex: "Botox vencido há 12 dias", "Inativo há 9 meses", "Pós-consulta em 2 dias")
- Telefone como `<span>` ao lado, copy on click (nice to have, sem prioridade)
- Botão `[Tratar▾]` ao final (ver §6.3)

### 6.3 Botão [Tratar▾]

Dropdown com 4 opções:
- **Tratado** — POST action `TRATADO`
- **Adiar 7 dias** — POST `ADIADO` com `snoozeUntil = now + 7d`
- **Adiar 30 dias** — POST `ADIADO` com `snoozeUntil = now + 30d`
- **Dispensar** — POST `DISPENSADO` (variante "sumir pra sempre")

UX otimista: ao clicar, remove o alerta da lista instantaneamente. Faz POST em background. Se POST falhar, mostra toast de erro + recoloca o alerta na lista (rollback).

**Sem campo de notes neste PR** — feature inicial enxuta. Pode entrar em PR futuro se Bruno pedir.

### 6.4 Empty state

Sem alertas: "Nenhum alerta pendente. Volte aqui depois que sincronizar com Clinicorp." (mensagem amigável, sem call-to-action).

---

## 7. UI — `/dashboard/settings/recall` (nova)

### 7.1 Layout

```
Configurações > Recall

Limites gerais
┌────────────────────────────────────────────┐
│ Paciente inativo a partir de:              │
│   [ 6 ] meses sem procedimento aprovado    │
│                                            │
│ Pós-consulta:                              │
│   [ 3 ] dias após o procedimento           │
│                                  [Salvar]  │
└────────────────────────────────────────────┘

Recall por procedimento
┌─────────────────────────────────────────────┐
│ Padrão de nome   Dias   Ações                │
│ botox            120    [editar] [×]        │
│ limpeza dental   180    [editar] [×]        │
│ preenchimento    240    [editar] [×]        │
│                                              │
│ + Adicionar procedimento                     │
└─────────────────────────────────────────────┘

ⓘ O padrão de nome é casado case-insensitive contra o nome do procedimento
  no Clinicorp. Ex: "botox" pega "Aplicação Botox 50U" e "Botox Brow Lift".
```

### 7.2 Seed inicial

Se `intervals.length === 0` na primeira visita, mostra banner:

```
┌──────────────────────────────────────────────────────────────────┐
│ ⚡ Comece com 5 procedimentos comuns pré-configurados?            │
│                                                                  │
│ • Botox (120 dias)        • Filler (240 dias)                    │
│ • Toxina (120 dias)       • Bioestimulador (365 dias)            │
│ • Preenchimento (240 dias)                                       │
│                                          [Adicionar todos]  [×]  │
└──────────────────────────────────────────────────────────────────┘
```

Click em "Adicionar todos" chama `POST /api/settings/recall/seed`. Idempotente. Banner some.

### 7.3 Acesso à tela

Adicionar link em `/dashboard/settings` (página existente) com card "Recall por procedimento → Configurar intervalos de alerta de retorno". Rota: `/dashboard/settings/recall`.

**Sidebar não muda** — fica como sub-rota dentro de Settings.

---

## 8. Migração e cleanup do código órfão

### 8.1 Migration

```sql
-- 20260515000000_reminders/migration.sql
ALTER TABLE "Clinic" ADD COLUMN "recallInactiveMonths" INTEGER NOT NULL DEFAULT 6;
ALTER TABLE "Clinic" ADD COLUMN "recallPostConsultaDays" INTEGER NOT NULL DEFAULT 3;

CREATE TABLE "ProcedureRecallInterval" (
  "id" TEXT NOT NULL,
  "clinicId" TEXT NOT NULL,
  "procedureNamePattern" TEXT NOT NULL,
  "days" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProcedureRecallInterval_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProcedureRecallInterval_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE
);
CREATE INDEX "ProcedureRecallInterval_clinicId_idx" ON "ProcedureRecallInterval"("clinicId");

CREATE TABLE "ReminderAction" (
  "id" TEXT NOT NULL,
  "clinicId" TEXT NOT NULL,
  "reminderKey" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "snoozeUntil" TIMESTAMP(3),
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdById" TEXT,
  CONSTRAINT "ReminderAction_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ReminderAction_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE
);
CREATE INDEX "ReminderAction_clinicId_reminderKey_idx" ON "ReminderAction"("clinicId", "reminderKey");
```

### 8.2 Cleanup

Deletar arquivos:
- `src/workers/check-reminders.ts` (worker órfão que só logava)

Editar:
- `src/lib/queues.ts` — remover `getCheckRemindersQueue` e `"check-reminders"` da lista de queues.
- `src/workers/index.ts` — remover import + cleanup do `checkRemindersWorker`.

Por que deletar em vez de evoluir o worker: o `computeReminders` é função pura barata e roda on-demand no endpoint `GET /api/reminders`. Não precisa de queue/worker — o cálculo é < 100ms até pra centenas de procedures. Worker fica fazendo nada útil → deletar.

---

## 9. Bump de versão

| Arquivo | De | Para |
|---|---|---|
| `package.json` `version` | `0.45.0` | `0.46.0` |
| `src/lib/version.ts` `APP_VERSION` | `"0.45.0"` | `"0.46.0"` |

Entrada CHANGELOG:

```ts
{
  version: "0.46.0",
  date: "2026-05-15",   // ou data real do PR
  type: "minor",
  changes: [
    "DASH-9: Alertas de retorno configuraveis (recall por procedimento, paciente inativo, pos-consulta)",
    "Schema novo: ProcedureRecallInterval (config por clinica) + ReminderAction (log de tratamento) + 2 campos em Clinic (recallInactiveMonths, recallPostConsultaDays)",
    "Tab 'Alertas (N)' em /dashboard/patients com 3 mini cards (Recall/Inativos/Pos-consulta), agrupados por urgencia (Atrasados/Urgentes/Em breve)",
    "Cada alerta tem botao [Tratar] com opcoes: Tratado, Adiar 7d, Adiar 30d, Dispensar. UX otimista (some na hora, POST em background)",
    "Tela /dashboard/settings/recall: configura intervalos por procedimento + limites globais (inativo em meses, pos-consulta em dias). Botao 'seed' pra adicionar os 5 padroes hardcoded de uma vez",
    "Fix: /api/reminders agora filtra statusDescription='Aprovado' (estava com legacy status='completed' do pre-DASH-3 — retornava 0)",
    "Cleanup: worker check-reminders (orfao, so logava) removido. Calculo agora e on-demand no endpoint",
    "Migration: 20260515000000_reminders",
  ],
}
```

---

## 10. Testes

### 10.1 Unit tests obrigatórios

`src/lib/reminders/calc.test.ts` — cobertura de `computeReminders`:

| Cenário | Verificação |
|---|---|
| Sem procedures | retorna `[]` |
| Procedure sem match em recallIntervals | não gera alerta de recall (mas pode gerar pós-consulta e/ou inativo) |
| Procedure recém-completado | pós-consulta `daysUntilDue` correto |
| Procedure de 200 dias atrás (botox 120d) | recall atrasado 80 dias |
| Procedure de 7 meses atrás | paciente inativo (se threshold = 6 meses) |
| Patient com 3 procedures | apenas o mais recente conta pra "inativo" |
| Multiple recallIntervals match no mesmo nome | usa o de maior `days` |
| Reminder com action TRATADO | filtrado fora |
| Reminder com action ADIADO + snoozeUntil futuro | filtrado fora |
| Reminder com action ADIADO + snoozeUntil passado | aparece de novo |
| Reminder com multiple actions, última é DISPENSADO | filtrado fora |
| Recall com daysUntilDue > 30 | filtrado fora (janela) |
| Pós-consulta com daysUntilDue < -30 | filtrado fora |
| Urgency: < 0 = overdue, 0..7 = urgent, 8..30 = upcoming | correto |

### 10.2 Endpoint tests

Hoje o projeto não tem padrão de integration test pra endpoints. Vou seguir o padrão atual (não testar endpoints isoladamente). Função de cálculo é o que mais importa cobrir.

### 10.3 Validação manual (test plan no PR)

- [ ] Migration roda em dev sem erro
- [ ] Settings/recall vazia mostra banner de seed
- [ ] Click "Adicionar todos" popula 5 padrões
- [ ] Editar dias de um padrão salva e reflete em /patients?tab=alertas
- [ ] Adicionar padrão novo ("limpeza", 180) funciona
- [ ] Deletar padrão funciona
- [ ] Mudar `inactiveMonths` de 6 pra 3 aumenta alertas de inativo
- [ ] Tab "Alertas" mostra contagem correta no badge
- [ ] Mini cards (Recall/Inativos/Pós-consulta) batem com a lista
- [ ] [Tratar > Tratado] some o alerta da lista
- [ ] [Tratar > Adiar 7d] some o alerta; 7 dias depois (forçando data) reaparece
- [ ] [Tratar > Dispensar] some pra sempre
- [ ] Recarregar a página mantém o estado tratado (persistido no DB)
- [ ] Clínica B não vê alertas da Clínica A (multi-tenant)

---

## 11. Riscos e mitigação

| Risco | Probabilidade | Mitigação |
|---|---|---|
| Cálculo on-demand virar caro com 10k+ procedures | baixa (AD tem ~200) | medir `Date.now()` no endpoint; se > 500ms, partir pra cache em memória ou job background |
| Pattern de procedure matchear demais (ex: "limpeza" pega "limpeza facial" + "limpeza de pele") | média | Bruno decide os patterns — UX da tela é editável a qualquer momento |
| `reminderKey` colidir entre 2 procedures com mesmo nome (ex: 2 botox no mesmo patient) | baixa | usa `procedureId` na key, não o nome |
| User dispensar alerta sem querer | média | "Dispensar" pode entrar em PR futuro com confirmação se reclamarem; por ora sem confirmação |
| Migration falhar em prod | baixa | só adiciona colunas com defaults + tabelas novas. Sem `DROP`/`ALTER` destrutivo. Rollback = `prisma migrate resolve` |

---

## 12. Fora de escopo

- Envio automático via WhatsApp/Kommo (`[DASH-9.1]` futuro, depende de `[FEAT-1]`)
- Aniversário (precisa puxar data de nascimento do Clinicorp — endpoint não testado)
- Relatório de alertas tratados / histórico (só registra; visualização rica é PR futuro)
- Notificação push no header global
- Notes/observações no momento de tratar
- Confirmação antes de dispensar
- Bulk action (tratar todos os recall de uma procedure de uma vez)

---

## 13. Ordem de implementação sugerida (pra writing-plans)

1. **Schema + migration + Prisma generate**
2. **Lib pura `reminders/calc.ts`** + tests (TDD: red → green)
3. **Endpoint `GET /api/reminders`** (refator usando calc.ts)
4. **Endpoint `POST /api/reminders/action`**
5. **Endpoints CRUD `/api/settings/recall/*`**
6. **Tela `/dashboard/settings/recall`**
7. **Tab "Alertas" em `/dashboard/patients`** + componente `patient-alerts.tsx`
8. **Cleanup**: deletar worker `check-reminders`, ajustar `queues.ts` e `workers/index.ts`
9. **Bump + CHANGELOG + IMPROVEMENTS**
10. **Bateria pre-PR + manual test plan**
