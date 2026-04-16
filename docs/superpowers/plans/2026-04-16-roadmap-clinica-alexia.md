# Roadmap Clinica Alexia Duarte — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the 4-phase roadmap from the 15/04/2026 meeting — fix dashboard lead counting, separate new-patient acquisition from returning-patient retention, automate Kommo-to-Clinicorp patient/appointment creation, build unified LTV/ROAS dashboard with patient profiles, and prepare return-reminder automation.

**Architecture:** The CliniFunnel app is a Next.js 14 monolith with BullMQ workers. Changes span: (1) API route fixes for pipeline filtering + new/returning patient segmentation via `isNewPatient` boolean on Lead, (2) worker extensions for Clinicorp appointment creation + tag transfer + patient classification, (3) new Prisma schema fields for canal de prospeccao and isNewPatient tracking, (4) new dashboard pages/tabs for LTV and patient profile views with toggle (Novos / Existentes / Todos). All async processing goes through BullMQ queues.

**Key concept — isNewPatient:** When a lead arrives and reaches "Agendado", the create-patient worker checks if the person already exists in Clinicorp. If they do NOT exist → `isNewPatient = true` (acquisition). If they DO exist → `isNewPatient = false` (retention). This field drives the dashboard toggle that separates acquisition metrics from retention metrics.

**Tech Stack:** Next.js 14, TypeScript, Prisma/PostgreSQL, BullMQ/Redis, Kommo API, Clinicorp REST API, Tailwind CSS, shadcn/ui

---

## Scope Summary

| Phase | What | Priority | Tasks | Status |
|-------|------|----------|-------|--------|
| 1 | Fix dashboard lead count + isNewPatient segmentation | Alta | 1-3 | DONE |
| 2 | Automacao Kommo → Clinicorp (paciente + agendamento + tags) | Alta | 4-7 | DONE |
| 2.5 | Version bump 0.12.0 | — | 8 | PENDENTE |
| 3 | Dashboard LTV/ROAS + Perfil Paciente | Media | 9-13 | PENDENTE |
| 4 | Lembretes de retorno (estrutura) | Baixa | 14-15 | PENDENTE |

## Implementation Notes (Tasks 1-7)

> Executadas em 2026-04-16 na branch `feat/roadmap-clinica-alexia`.
> O codigo real divergiu do plano original em alguns pontos:
> - O dashboard API ja usava `getAuthorizedClinicId` (auth-guard) em vez de `clinicId` via query param. Adaptado.
> - Tasks 3, 5 e 6 (schema) foram consolidadas em UMA unica migration: `add-canal-prospeccao-isnewpatient-appointment`
> - Task 5 (appointment) e Task 6 (canal transfer) foram implementadas junto com Task 4 no worker
> - Todos os 7 tasks compilam com `npm run build` sem erros

---

## File Map

### Phase 1 — Dashboard Fixes + Patient Segmentation
- Modify: `src/app/api/dashboard/route.ts` — add pipeline filter + patientType filter (new/returning/all) to lead counts
- Modify: `src/app/api/leads/route.ts` — add pipeline filter option
- Modify: `src/app/dashboard/page.tsx` — add toggle Novos/Existentes/Todos + canal de prospeccao breakdown

### Phase 2 — Automacao Kommo → Clinicorp
- Modify: `prisma/schema.prisma` — add `canalProspeccao` + `isNewPatient` to Lead, add appointment tracking fields
- Modify: `src/lib/kommo/utm.ts` — extract "Canal de Prospeccao" custom field
- Modify: `src/lib/kommo/webhooks.ts` (if needed for field extraction)
- Modify: `src/app/api/webhooks/kommo/route.ts` — save canalProspeccao
- Modify: `src/workers/create-patient.ts` — validate required fields, create appointment, transfer tags
- Modify: `src/lib/clinicorp/patient.ts` — include canal in Notes
- Create: `src/lib/clinicorp/appointment.ts` — appointment creation logic
- Modify: `src/types/index.ts` — add CanalProspeccao type

### Phase 3 — Dashboard LTV/ROAS + Perfil Paciente
- Create: `src/app/api/dashboard/ltv/route.ts` — LTV/ROAS metrics endpoint
- Create: `src/app/api/patients/[id]/route.ts` — patient profile endpoint
- Create: `src/app/api/patients/route.ts` — patient listing endpoint
- Create: `src/app/dashboard/ltv/page.tsx` — LTV/ROAS dashboard page
- Create: `src/app/dashboard/patients/page.tsx` — patient listing page
- Create: `src/app/dashboard/patients/[id]/page.tsx` — patient profile page
- Modify: `src/components/layout/sidebar.tsx` — add LTV and Pacientes nav items

### Phase 4 — Lembretes de Retorno (estrutura)
- Create: `src/app/api/reminders/route.ts` — reminder check endpoint
- Create: `src/workers/check-reminders.ts` — periodic reminder worker

---

## Task 1: Fix Dashboard Lead Count — Pipeline Filter + Patient Type Segmentation

**Context:** The dashboard API counts ALL leads for the clinic. It should: (1) count only leads from the "Captacao de Leads" pipeline, and (2) support filtering by patient type — new patients (never existed in Clinicorp) vs returning patients (already had a record). This is driven by the `isNewPatient` Boolean field on Lead (added in Task 3, classified in Task 4).

**Files:**
- Modify: `src/app/api/dashboard/route.ts`

- [x] **Step 1: Read clinic + parse new query params**

Add clinic lookup and patientType param at the top of the GET handler, after the clinicId validation:

```typescript
// After line 9 (clinicId validation block)
const patientType = searchParams.get("patientType"); // "new" | "returning" | null (all)

const clinic = await prisma.clinic.findUnique({
  where: { id: clinicId },
  select: { pipelineId: true },
});

if (!clinic) {
  return NextResponse.json({ error: "Clinic not found" }, { status: 404 });
}
```

- [x] **Step 2: Build pipeline + patientType filters**

Create the combined filter object:

```typescript
const pipelineFilter = clinic.pipelineId
  ? { kommoPipelineId: clinic.pipelineId }
  : {};

// Patient type filter: "new" = only isNewPatient=true, "returning" = isNewPatient=false
const patientTypeFilter = patientType === "new"
  ? { isNewPatient: true }
  : patientType === "returning"
    ? { isNewPatient: false }
    : {}; // "all" or null = no filter
```

Then update each lead count call to include both filters:

```typescript
// totalLeads
prisma.lead.count({ where: { clinicId, ...pipelineFilter, ...patientTypeFilter, ...dateFilter } }),
// campaignLeads
prisma.lead.count({ where: { clinicId, channel: "campaign", ...pipelineFilter, ...patientTypeFilter, ...dateFilter } }),
// agendamentos
prisma.lead.count({ where: { clinicId, agendamentoAt: { not: null }, ...pipelineFilter, ...patientTypeFilter, ...dateFilter } }),
// compareceram
prisma.lead.count({
  where: {
    clinicId,
    patientId: { not: null },
    patient: { procedures: { some: {} } },
    ...pipelineFilter,
    ...patientTypeFilter,
    ...dateFilter,
  },
}),
```

- [x] **Step 3: Update funnel procedure filter to respect pipeline**

The `funnelProcedureFilter` should also only count procedures from patients linked to leads in the target pipeline, respecting patientType:

```typescript
const funnelProcedureFilter = {
  clinicId,
  status: { in: ["completed", "approved"] },
  patient: { leads: { some: { ...pipelineFilter, ...patientTypeFilter } } },
  ...procedureDateFilter,
};
```

- [x] **Step 4: Update raw SQL query to filter by pipeline**

The `revenueByDay` query needs both the pipeline filter and patientType filter:

```typescript
const dateParams: string[] = [clinicId];
let dateConditions = "";

// Build lead existence subquery with pipeline + patientType filters
let leadSubquery = `SELECT 1 FROM "Lead" l WHERE l."patientId" = pt.id`;
if (clinic.pipelineId) {
  dateParams.push(clinic.pipelineId);
  leadSubquery += ` AND l."kommoPipelineId" = $${dateParams.length}`;
}
if (patientType === "new") {
  leadSubquery += ` AND l."isNewPatient" = true`;
} else if (patientType === "returning") {
  leadSubquery += ` AND l."isNewPatient" = false`;
}
dateConditions += ` AND EXISTS (${leadSubquery})`;

if (from) {
  dateParams.push(from);
  dateConditions += ` AND p."createdAt" >= $${dateParams.length}::timestamp`;
}
if (to) {
  dateParams.push(to);
  dateConditions += ` AND p."createdAt" <= $${dateParams.length}::timestamp`;
}

const revenueByDay = await prisma.$queryRawUnsafe<Array<{ day: number; total: number }>>(
  `SELECT EXTRACT(DOW FROM p."createdAt") as day, SUM(p.value) as total
   FROM "Procedure" p
   INNER JOIN "Patient" pt ON p."patientId" = pt.id
   WHERE p."clinicId" = $1
     AND p.status IN ('completed', 'approved')
     ${dateConditions}
   GROUP BY day ORDER BY day`,
  ...dateParams
);
```

- [x] **Step 5: Add patientType to response metadata**

Include the active filter in the response so the frontend knows which view is active:

```typescript
return NextResponse.json({
  data: {
    patientType: patientType ?? "all",
    // ... all existing fields
  },
});
```

- [x] **Step 6: Verify locally**

Run: `npm run dev`

Test the API with different patientType values:
- `/api/dashboard?clinicId=X` — all leads (default)
- `/api/dashboard?clinicId=X&patientType=new` — only new patients
- `/api/dashboard?clinicId=X&patientType=returning` — only returning patients

Note: `isNewPatient` field won't be populated until Task 4 is implemented. For now, verify pipeline filtering works and the patientType param is accepted without errors.

- [x] **Step 7: Commit**

```bash
git add src/app/api/dashboard/route.ts
git commit -m "fix: filter dashboard by pipeline + support patientType segmentation

Dashboard was counting leads from all pipelines. Now filters by
clinic.pipelineId. Also accepts ?patientType=new|returning to
separate acquisition from retention metrics."
```

---

## Task 2: Add Pipeline Filter to Leads API

**Context:** The `/api/leads` endpoint also returns all leads. It should respect the pipeline filter for consistency, but also allow querying all leads via a parameter.

**Files:**
- Modify: `src/app/api/leads/route.ts`

- [x] **Step 1: Add pipeline parameter and default filter**

```typescript
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const clinicId = searchParams.get("clinicId");
  const channel = searchParams.get("channel");
  const campaign = searchParams.get("campaign");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const allPipelines = searchParams.get("allPipelines") === "true";

  if (!clinicId) {
    return NextResponse.json(
      { error: "clinicId is required" },
      { status: 400 }
    );
  }

  const where: Record<string, unknown> = { clinicId };

  // Filter by pipeline unless explicitly requesting all
  if (!allPipelines) {
    const clinic = await prisma.clinic.findUnique({
      where: { id: clinicId },
      select: { pipelineId: true },
    });
    if (clinic?.pipelineId) {
      where.kommoPipelineId = clinic.pipelineId;
    }
  }

  if (channel) where.channel = channel;
  if (campaign) where.utmCampaign = campaign;
  if (from || to) {
    where.createdAt = {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to) } : {}),
    };
  }

  const leads = await prisma.lead.findMany({
    where,
    include: { patient: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json({ data: leads });
}
```

- [x] **Step 2: Commit**

```bash
git add src/app/api/leads/route.ts
git commit -m "fix: filter leads list by pipeline by default

Leads API now respects clinic.pipelineId. Use ?allPipelines=true
to see leads from all pipelines."
```

---

## Task 3: Add Canal de Prospeccao + isNewPatient to Schema and Kommo Webhook

**Context:** Two new fields on Lead: (1) Kommo has a custom field "Canal de Prospeccao" (separate from UTMs) that tracks lead source (Meta Ads, Instagram Dra. Gabriela, Instagram Clinica, Indicacao, Organico). (2) `isNewPatient` Boolean that tracks whether the lead is a first-time patient or a returning patient. This field is set by the create-patient worker (Task 4) when checking Clinicorp.

**Files:**
- Modify: `prisma/schema.prisma` — add `canalProspeccao` and `isNewPatient` fields to Lead
- Modify: `src/types/index.ts` — add type
- Modify: `src/lib/kommo/utm.ts` — extract canal field
- Modify: `src/app/api/webhooks/kommo/route.ts` — save it

- [x] **Step 1: Add canalProspeccao and isNewPatient to Prisma schema**

In `prisma/schema.prisma`, add to the Lead model after the `utmTerm` field:

```prisma
  // Canal de Prospeccao (Kommo custom field)
  canalProspeccao String?
  // Patient classification: true = first-time patient (acquisition), false = returning (retention)
  // Set by create-patient worker after checking Clinicorp
  isNewPatient    Boolean?
```

Add an index for efficient filtering:

```prisma
  @@index([clinicId, isNewPatient])
```

- [x] **Step 2: Create and apply migration**

Run:
```bash
npx prisma migrate dev --name add-canal-prospeccao-and-is-new-patient
```
Expected: Migration created and applied successfully.

- [x] **Step 3: Add extraction function in utm.ts**

Add to `src/lib/kommo/utm.ts`:

```typescript
export function extractCanalProspeccao(
  customFields: Array<{
    field_id: number;
    field_name: string;
    field_code?: string;
    values: Array<{ value: string; enum_id?: number }>;
  }> | null | undefined
): string | null {
  if (!customFields) return null;

  for (const field of customFields) {
    const name = field.field_name?.toLowerCase() ?? "";
    const code = field.field_code?.toLowerCase() ?? "";
    if (
      name.includes("canal") ||
      name.includes("prospeccao") ||
      name.includes("prospecção") ||
      code.includes("canal") ||
      code === "prospeccao"
    ) {
      if (field.values.length > 0) {
        return field.values[0].value;
      }
    }
  }
  return null;
}
```

- [x] **Step 4: Update Kommo webhook to save canalProspeccao**

In `src/app/api/webhooks/kommo/route.ts`, in the `processLead` function, after extracting UTMs:

```typescript
const utms = extractUTMsFromCustomFields(kommoLead.custom_fields_values);
const canalProspeccao = extractCanalProspeccao(kommoLead.custom_fields_values);
const channel = classifyChannel(utms);
```

Add the import at the top:

```typescript
import { extractUTMsFromCustomFields, extractCanalProspeccao } from "@/lib/kommo/utm";
```

Update the upsert to include `canalProspeccao`:

```typescript
const lead = await prisma.lead.upsert({
  where: {
    clinicId_kommoLeadId: {
      clinicId: clinic.id,
      kommoLeadId: String(kommoLead.id),
    },
  },
  update: {
    name: kommoLead.name,
    phone,
    email,
    ...utms,
    canalProspeccao,
    channel,
    kommoStatus: statusId,
    kommoPipelineId: pipelineId,
    ...(isAgendamento ? { agendamentoAt: new Date() } : {}),
  },
  create: {
    clinicId: clinic.id,
    kommoLeadId: String(kommoLead.id),
    name: kommoLead.name,
    phone,
    email,
    ...utms,
    canalProspeccao,
    channel,
    kommoStatus: statusId,
    kommoPipelineId: pipelineId,
    kommoCreatedAt: new Date(kommoLead.created_at * 1000),
    ...(isAgendamento ? { agendamentoAt: new Date() } : {}),
  },
});
```

- [x] **Step 5: Verify build compiles**

Run: `npm run build`
Expected: Build succeeds with no type errors.

- [x] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/ src/lib/kommo/utm.ts src/app/api/webhooks/kommo/route.ts
git commit -m "feat: capture 'Canal de Prospeccao' from Kommo custom fields

Adds canalProspeccao field to Lead model. Webhook now extracts the
custom field from Kommo and stores it alongside UTM data."
```

---

## Task 4: Validate Required Fields + Classify isNewPatient

**Context:** The create-patient worker needs two enhancements: (1) validate that the lead has all required data (name, phone, email) before creating a patient in Clinicorp, and (2) classify the lead as new or returning patient based on whether they already exist in Clinicorp. This classification drives the dashboard segmentation.

**Files:**
- Modify: `src/workers/create-patient.ts`

- [x] **Step 1: Add isNewPatient classification logic**

In `src/workers/create-patient.ts`, the worker already tries to match the lead to an existing patient. We use this to classify `isNewPatient`. Restructure the worker logic:

After the `matchLeadToPatient` check (the existing local match), and BEFORE the Clinicorp API call, add classification:

```typescript
// 1. Try matching with existing local patient (existing code)
const existingPatient = await matchLeadToPatient(lead);
if (existingPatient) {
  await linkLeadToPatient(lead.id, existingPatient.id);
  // This lead matched an existing patient → returning patient
  await prisma.lead.update({
    where: { id: lead.id },
    data: { isNewPatient: false },
  });
  console.log(
    `[create-patient] Lead ${lead.name} matched to existing patient ${existingPatient.name} (returning)`
  );
  return;
}

// 2. If clinic has Clinicorp, check if patient exists there
const { clinic } = lead;
if (!clinic.clinicorpUser || !clinic.clinicorpToken) {
  console.log(`[create-patient] Clinic ${clinic.name} has no Clinicorp config, skipping`);
  return;
}

const clinicorpClient = new ClinicorpClient({
  user: clinic.clinicorpUser,
  token: clinic.clinicorpToken,
  subscriberId: clinic.clinicorpUser,
});

// Check Clinicorp for existing patient BEFORE creating
let existsInClinicorp = false;
if (lead.phone) {
  const digits = lead.phone.replace(/\D/g, "");
  const found = await clinicorpClient.findPatient({ phone: digits });
  if (found) existsInClinicorp = true;
}
if (!existsInClinicorp && lead.email) {
  const found = await clinicorpClient.findPatient({ email: lead.email });
  if (found) existsInClinicorp = true;
}

// Classify: new if not found in Clinicorp, returning if found
await prisma.lead.update({
  where: { id: lead.id },
  data: { isNewPatient: !existsInClinicorp },
});

console.log(
  `[create-patient] Lead "${lead.name}" classified as ${existsInClinicorp ? "RETURNING" : "NEW"} patient`
);
```

- [x] **Step 2: Add validation before Clinicorp patient creation**

After the classification, validate required fields before actually creating:

```typescript
if (!clinic.clinicorpAutoCreatePatient) {
  console.log(`[create-patient] Clinic ${clinic.name} has auto-create disabled, skipping Clinicorp`);
  return;
}

// Validate required fields
const missingFields: string[] = [];
if (!lead.name || lead.name.trim() === "") missingFields.push("name");
if (!lead.phone) missingFields.push("phone");
if (!lead.email) missingFields.push("email");

if (missingFields.length > 0) {
  console.warn(
    `[create-patient] Lead "${lead.name}" (${lead.id}) is missing required fields: ${missingFields.join(", ")}. Skipping Clinicorp creation.`
  );
  // Still create local patient for tracking, just skip Clinicorp
  if (lead.phone || lead.email) {
    const localPatient = await prisma.patient.create({
      data: {
        clinicId: lead.clinicId,
        name: lead.name,
        phone: lead.phone,
        ...utms,
      },
    });
    await linkLeadToPatient(lead.id, localPatient.id);
    console.log(
      `[create-patient] Created local-only patient for "${lead.name}" (missing fields for Clinicorp)`
    );
  }
  return;
}
```

- [x] **Step 3: Verify build**

Run: `npm run build`
Expected: Build succeeds.

- [x] **Step 4: Commit**

```bash
git add src/workers/create-patient.ts
git commit -m "feat: classify leads as new/returning + validate before Clinicorp creation

Worker now checks Clinicorp for existing patient before creating.
Sets isNewPatient=true for acquisition, false for retention.
Also validates required fields before Clinicorp API call."
```

---

## Task 5: Auto-Create Appointment in Clinicorp

**Context:** When a lead moves to "Agendado", besides creating the patient, we need to also create the appointment in Clinicorp. The Kommo lead needs custom fields for date/time and professional. We need to extract these from the Kommo lead.

**Files:**
- Modify: `prisma/schema.prisma` — add appointment tracking fields to Lead
- Create: `src/lib/clinicorp/appointment.ts` — appointment creation logic
- Modify: `src/workers/create-patient.ts` — call appointment creation
- Modify: `src/lib/kommo/utm.ts` — extract appointment fields from Kommo

- [x] **Step 1: Add appointment fields to Lead schema**

In `prisma/schema.prisma`, add to the Lead model after `agendamentoAt`:

```prisma
  // Appointment data from Kommo custom fields
  appointmentDate     String?   // "2026-04-20"
  appointmentTime     String?   // "14:00"
  appointmentProfId   String?   // Clinicorp professional ID
  clinicorpAppointmentId String? // ID returned after creation
```

- [x] **Step 2: Create and apply migration**

Run:
```bash
npx prisma migrate dev --name add-appointment-fields-to-lead
```

- [x] **Step 3: Add appointment field extraction from Kommo**

Add to `src/lib/kommo/utm.ts`:

```typescript
export interface AppointmentFields {
  appointmentDate: string | null;
  appointmentTime: string | null;
  appointmentProfId: string | null;
}

export function extractAppointmentFields(
  customFields: Array<{
    field_id: number;
    field_name: string;
    field_code?: string;
    values: Array<{ value: string }>;
  }> | null | undefined
): AppointmentFields {
  const result: AppointmentFields = {
    appointmentDate: null,
    appointmentTime: null,
    appointmentProfId: null,
  };

  if (!customFields) return result;

  for (const field of customFields) {
    const name = field.field_name?.toLowerCase() ?? "";
    const code = field.field_code?.toLowerCase() ?? "";
    const value = field.values?.[0]?.value;
    if (!value) continue;

    if (
      name.includes("data") && (name.includes("consulta") || name.includes("agendamento")) ||
      code === "appointment_date"
    ) {
      result.appointmentDate = value;
    }

    if (
      name.includes("hora") || name.includes("horario") ||
      code === "appointment_time"
    ) {
      result.appointmentTime = value;
    }

    if (
      name.includes("profissional") || name.includes("dentista") ||
      code === "professional_id"
    ) {
      result.appointmentProfId = value;
    }
  }

  return result;
}
```

- [x] **Step 4: Update Kommo webhook to save appointment fields**

In `src/app/api/webhooks/kommo/route.ts`, in `processLead`:

```typescript
import { extractUTMsFromCustomFields, extractCanalProspeccao, extractAppointmentFields } from "@/lib/kommo/utm";

// After extracting canalProspeccao:
const appointmentFields = extractAppointmentFields(kommoLead.custom_fields_values);
```

Add to both `update` and `create` in the upsert:

```typescript
...appointmentFields,
```

- [x] **Step 5: Create appointment creation logic**

Create `src/lib/clinicorp/appointment.ts`:

```typescript
import { ClinicorpClient } from "./client";
import { CreateAppointmentPayload } from "./types";

export async function createAppointmentInClinicorp(
  client: ClinicorpClient,
  params: {
    patientId: number;
    patientName: string;
    phone?: string;
    email?: string;
    date: string;       // "2026-04-20"
    time: string;       // "14:00"
    businessId: number;
    professionalId: number;
    duration?: number;   // minutes, default 60
  }
): Promise<{ id: number } | null> {
  const fromTime = params.time;
  const durationMinutes = params.duration ?? 60;

  // Calculate end time
  const [hours, minutes] = fromTime.split(":").map(Number);
  const endMinutes = hours * 60 + minutes + durationMinutes;
  const toTime = `${String(Math.floor(endMinutes / 60)).padStart(2, "0")}:${String(endMinutes % 60).padStart(2, "0")}`;

  const payload: CreateAppointmentPayload = {
    Patient_PersonId: params.patientId,
    PatientName: params.patientName,
    MobilePhone: params.phone,
    Email: params.email,
    date: params.date,
    fromTime,
    toTime,
    Clinic_BusinessId: params.businessId,
    Dentist_PersonId: params.professionalId,
  };

  try {
    const appointment = await client.createAppointment(payload);
    console.log(
      `[clinicorp-appointment] Created appointment for ${params.patientName} on ${params.date} at ${fromTime}`
    );
    return appointment;
  } catch (error) {
    console.error(
      `[clinicorp-appointment] Failed to create appointment for ${params.patientName}:`,
      error instanceof Error ? error.message : error
    );
    return null;
  }
}
```

- [x] **Step 6: Extend create-patient worker to create appointment**

In `src/workers/create-patient.ts`, after linking lead to patient, add:

```typescript
import { createAppointmentInClinicorp } from "@/lib/clinicorp/appointment";

// After: await linkLeadToPatient(lead.id, patient.id);

// Create appointment if we have the necessary data
if (lead.appointmentDate && lead.appointmentTime) {
  const businessId = clinic.clinicorpBusinessId
    ? parseInt(clinic.clinicorpBusinessId, 10)
    : null;
  const professionalId = lead.appointmentProfId
    ? parseInt(lead.appointmentProfId, 10)
    : null;

  if (businessId && professionalId) {
    const appointment = await createAppointmentInClinicorp(
      clinicorpClient,
      {
        patientId: clinicorpPatient.id,
        patientName: clinicorpPatient.Name,
        phone: lead.phone ?? undefined,
        email: lead.email ?? undefined,
        date: lead.appointmentDate,
        time: lead.appointmentTime,
        businessId,
        professionalId,
      }
    );

    if (appointment) {
      await prisma.lead.update({
        where: { id: lead.id },
        data: { clinicorpAppointmentId: String(appointment.id) },
      });
    }
  } else {
    console.warn(
      `[create-patient] Cannot create appointment for "${lead.name}": missing businessId or professionalId`
    );
  }
} else {
  console.log(
    `[create-patient] No appointment date/time for "${lead.name}", skipping appointment creation`
  );
}
```

- [x] **Step 7: Verify build**

Run: `npm run build`
Expected: Build succeeds.

- [x] **Step 8: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/ src/lib/kommo/utm.ts src/app/api/webhooks/kommo/route.ts src/lib/clinicorp/appointment.ts src/workers/create-patient.ts
git commit -m "feat: auto-create appointment in Clinicorp when lead reaches Agendado

Extracts date/time/professional from Kommo custom fields. Creates
appointment via Clinicorp API after patient creation. Stores
appointment ID back on the lead record."
```

---

## Task 6: Transfer Canal de Prospeccao Tags to Clinicorp

**Context:** When creating a patient in Clinicorp, we need to include the "Canal de Prospeccao" from Kommo in the patient's Notes field, alongside UTM data. This enables tracking lead origin in financial reports.

**Files:**
- Modify: `src/lib/utils/utm.ts` — update utmsToNote to include canal
- Modify: `src/lib/clinicorp/patient.ts` — pass canal to Notes
- Modify: `src/workers/create-patient.ts` — pass canalProspeccao

- [x] **Step 1: Update utmsToNote to accept canal de prospeccao**

In `src/lib/utils/utm.ts`:

```typescript
export function utmsToNote(data: UTMData, canalProspeccao?: string | null): string {
  const parts: string[] = [];
  if (canalProspeccao) parts.push(`Canal: ${canalProspeccao}`);
  if (data.utmSource) parts.push(`Source: ${data.utmSource}`);
  if (data.utmMedium) parts.push(`Medium: ${data.utmMedium}`);
  if (data.utmCampaign) parts.push(`Campaign: ${data.utmCampaign}`);
  if (data.utmContent) parts.push(`Content: ${data.utmContent}`);
  if (data.utmTerm) parts.push(`Term: ${data.utmTerm}`);
  return parts.length > 0 ? `[CliniFunnel] ${parts.join(" | ")}` : "";
}
```

- [x] **Step 2: Update findOrCreatePatientInClinicorp to accept canal**

In `src/lib/clinicorp/patient.ts`, update the function signature and call:

```typescript
export async function findOrCreatePatientInClinicorp(
  client: ClinicorpClient,
  subscriberId: string,
  data: {
    name: string;
    phone?: string;
    email?: string;
    utms: UTMData;
    canalProspeccao?: string | null;
  }
): Promise<ClinicorpPatient> {
  // ... existing find logic stays the same ...

  // Create new patient
  const payload: CreatePatientPayload = {
    subscriber_id: subscriberId,
    Name: data.name,
    Email: data.email,
    MobilePhone: data.phone
      ? parseInt(data.phone.replace(/\D/g, ""), 10)
      : undefined,
    Notes: utmsToNote(data.utms, data.canalProspeccao),
    IgnoreSameName: "true",
  };

  return client.createPatient(payload);
}
```

- [x] **Step 3: Pass canalProspeccao from worker**

In `src/workers/create-patient.ts`, update the call to include canal:

```typescript
const clinicorpPatient = await findOrCreatePatientInClinicorp(
  clinicorpClient,
  clinic.clinicorpUser,
  {
    name: lead.name,
    phone: lead.phone ?? undefined,
    email: lead.email ?? undefined,
    utms,
    canalProspeccao: lead.canalProspeccao,
  }
);
```

- [x] **Step 4: Also store canalProspeccao on Patient model**

Add `canalProspeccao` to Patient in `prisma/schema.prisma`:

```prisma
  // Canal de prospeccao herdado do lead
  canalProspeccao    String?
```

Run migration:
```bash
npx prisma migrate dev --name add-canal-prospeccao-to-patient
```

Update `createOrUpdateLocalPatient` in `src/lib/clinicorp/patient.ts` to accept and save it:

```typescript
export async function createOrUpdateLocalPatient(
  clinicId: string,
  clinicorpPatient: ClinicorpPatient,
  utms: UTMData,
  canalProspeccao?: string | null
) {
  const phone = clinicorpPatient.MobilePhone
    ? normalizePhoneBR(String(clinicorpPatient.MobilePhone))
    : null;

  return prisma.patient.upsert({
    where: {
      clinicId_clinicorpPatientId: {
        clinicId,
        clinicorpPatientId: String(clinicorpPatient.id),
      },
    },
    update: {
      name: clinicorpPatient.Name,
      phone: phone ?? undefined,
      cpf: clinicorpPatient.OtherDocumentId ?? undefined,
      canalProspeccao: canalProspeccao ?? undefined,
      ...utms,
    },
    create: {
      clinicId,
      clinicorpPatientId: String(clinicorpPatient.id),
      name: clinicorpPatient.Name,
      phone,
      cpf: clinicorpPatient.OtherDocumentId ?? null,
      canalProspeccao: canalProspeccao ?? null,
      ...utms,
    },
  });
}
```

Update the worker call:

```typescript
const patient = await createOrUpdateLocalPatient(
  lead.clinicId,
  clinicorpPatient,
  utms,
  lead.canalProspeccao
);
```

- [x] **Step 5: Verify build**

Run: `npm run build`
Expected: Build succeeds.

- [x] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/ src/lib/utils/utm.ts src/lib/clinicorp/patient.ts src/workers/create-patient.ts
git commit -m "feat: transfer canal de prospeccao from Kommo to Clinicorp

Includes canal in Clinicorp patient Notes field alongside UTMs.
Also stores canalProspeccao on local Patient model for dashboard use."
```

---

## Task 7: Add Patient Type Toggle + Canal Breakdown to Dashboard

**Context:** With canalProspeccao and isNewPatient now being captured, the dashboard needs: (1) a toggle to switch between "Novos" (acquisition), "Existentes" (retention), and "Todos" views, and (2) a canal de prospeccao breakdown section.

**Files:**
- Modify: `src/app/api/dashboard/route.ts` — add canal breakdown query
- Modify: `src/app/dashboard/page.tsx` — add toggle + canal breakdown

- [x] **Step 1: Add canal aggregation to dashboard API**

In `src/app/api/dashboard/route.ts`, add a new query to the Promise.all (include both patientType and pipeline filters):

```typescript
// Add to the Promise.all array:
prisma.lead.groupBy({
  by: ["canalProspeccao"],
  where: { clinicId, ...pipelineFilter, ...patientTypeFilter, ...dateFilter, canalProspeccao: { not: null } },
  _count: { id: true },
  orderBy: { _count: { id: "desc" } },
}),
```

Update the destructuring:

```typescript
const [
  totalLeads,
  campaignLeads,
  agendamentos,
  compareceram,
  procedureAgg,
  adSpendAgg,
  topProcedures,
  canalBreakdown,
] = await Promise.all([...]);
```

Add to the response:

```typescript
canalBreakdown: canalBreakdown.map((c) => ({
  canal: c.canalProspeccao ?? "Nao identificado",
  count: c._count.id,
})),
```

- [x] **Step 2: Add patientType toggle to dashboard page**

In `src/app/dashboard/page.tsx`, add state and toggle UI. Add to the component state:

```typescript
const [patientType, setPatientType] = useState<"all" | "new" | "returning">("all");
```

Update `fetchData` to include `patientType`:

```typescript
const fetchData = useCallback(() => {
  if (!clinic) return;
  setLoading(true);
  const params = new URLSearchParams({ clinicId: clinic.id });
  if (dateRange.from) params.set("from", dateRange.from);
  if (dateRange.to) params.set("to", dateRange.to);
  if (patientType !== "all") params.set("patientType", patientType);
  fetch(`/api/dashboard?${params}`)
    .then((res) => res.json())
    .then((json) => setData(json.data ?? empty))
    .catch(() => {})
    .finally(() => setLoading(false));
}, [clinic, dateRange, patientType]);
```

Add toggle buttons in the header area, between the title and the DateFilter:

```tsx
{/* Header */}
<div className="flex items-start justify-between">
  <div>
    <h1 className="font-display text-2xl font-bold">Visao Geral</h1>
    <p className="text-sm text-muted-foreground">{clinic?.name} — Dashboard completo</p>
  </div>
  <div className="flex items-center gap-3">
    {/* Patient Type Toggle */}
    <div className="flex rounded-lg border border-border overflow-hidden">
      {(["all", "new", "returning"] as const).map((type) => {
        const labels = { all: "Todos", new: "Novos", returning: "Existentes" };
        const isActive = patientType === type;
        return (
          <button
            key={type}
            onClick={() => setPatientType(type)}
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${
              isActive
                ? "bg-gold/15 text-gold"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/10"
            }`}
          >
            {labels[type]}
          </button>
        );
      })}
    </div>
    <DateFilter onFilter={(from, to) => setDateRange({ from, to })} />
  </div>
</div>
```

- [x] **Step 3: Add DashboardData type + canal breakdown display**

Add to the `DashboardData` interface:

```typescript
canalBreakdown: { canal: string; count: number }[];
```

Update `empty`:
```typescript
canalBreakdown: [],
```

Add a new section after the "Performance por canal" card:

```tsx
{/* Canal de Prospeccao Breakdown */}
<div className="rounded-xl bg-card p-6 glass-border">
  <h2 className="font-display text-lg font-semibold mb-4">Leads por canal de prospeccao</h2>
  <div className="space-y-3">
    {d.canalBreakdown.length === 0 ? (
      <p className="text-sm text-muted-foreground">Nenhum lead com canal identificado.</p>
    ) : (
      d.canalBreakdown.map((c) => {
        const pct = d.totalLeads > 0 ? (c.count / d.totalLeads) * 100 : 0;
        return (
          <div key={c.canal} className="flex items-center gap-3">
            <div className="flex-1">
              <div className="flex justify-between text-sm mb-1">
                <span className="font-medium">{c.canal}</span>
                <span>{c.count} <span className="text-muted-foreground text-xs">({pct.toFixed(1)}%)</span></span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-gold/60 to-gold transition-all"
                  style={{ width: `${Math.max(pct, 2)}%` }}
                />
              </div>
            </div>
          </div>
        );
      })
    )}
  </div>
</div>
```

- [x] **Step 4: Verify in browser**

Run: `npm run dev`
Open dashboard. Verify:
1. The toggle "Todos | Novos | Existentes" appears in the header
2. Clicking each option refetches data (check network tab)
3. The "Leads por canal de prospeccao" section appears
4. With existing data, "Novos" and "Existentes" may show 0 until isNewPatient gets populated by the worker

- [x] **Step 5: Commit**

```bash
git add src/app/api/dashboard/route.ts src/app/dashboard/page.tsx
git commit -m "feat: add patient type toggle (Novos/Existentes/Todos) + canal breakdown

Dashboard header now has a 3-way toggle to filter all metrics by
new patients (acquisition) vs returning patients (retention).
Also shows lead breakdown by canal de prospeccao."
```

---

## Task 8: Version Bump for Phase 1+2

**Files:**
- Modify: `package.json`
- Modify: `src/lib/version.ts`

- [ ] **Step 1: Bump version to 0.12.0**

In `package.json`, change `"version": "0.11.1"` to `"version": "0.12.0"`.

In `src/lib/version.ts`, update:

```typescript
export const APP_VERSION = "0.12.0";
```

Add new changelog entry at the top of the array:

```typescript
{
  version: "0.12.0",
  date: "2026-04-16",
  type: "minor",
  changes: [
    "Fix: dashboard agora filtra leads apenas do pipeline 'Captacao de Leads'",
    "Fix: API de leads tambem respeita filtro de pipeline",
    "Novo: segmentacao Novos vs Existentes — leads classificados como paciente novo ou retorno",
    "Toggle no dashboard para alternar entre Novos / Existentes / Todos",
    "Novo campo 'Canal de Prospeccao' capturado do Kommo e transferido para Clinicorp",
    "Validacao de campos obrigatorios antes de criar paciente no Clinicorp",
    "Automacao de criacao de agendamento no Clinicorp quando lead chega em 'Agendado'",
    "Canal de prospeccao e UTMs transferidos para Notes do paciente no Clinicorp",
    "Dashboard exibe breakdown de leads por canal de prospeccao",
  ],
},
```

- [ ] **Step 2: Commit**

```bash
git add package.json src/lib/version.ts
git commit -m "chore: bump version to 0.12.0 — pipeline filter + Kommo→Clinicorp automation"
```

---

## Task 9: LTV/ROAS API Endpoint

**Context:** Build the backend for the unified LTV/ROAS dashboard. This endpoint crosses data from leads (Kommo origin) with procedures (Clinicorp financials). Supports the same `patientType` filter as the main dashboard.

**Files:**
- Create: `src/app/api/dashboard/ltv/route.ts`

- [ ] **Step 1: Create the LTV/ROAS API route**

Create `src/app/api/dashboard/ltv/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const clinicId = searchParams.get("clinicId");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const patientType = searchParams.get("patientType"); // "new" | "returning" | null

  if (!clinicId) {
    return NextResponse.json({ error: "clinicId is required" }, { status: 400 });
  }

  const clinic = await prisma.clinic.findUnique({
    where: { id: clinicId },
    select: { pipelineId: true },
  });

  const pipelineFilter = clinic?.pipelineId
    ? { kommoPipelineId: clinic.pipelineId }
    : {};

  const patientTypeFilter = patientType === "new"
    ? { isNewPatient: true }
    : patientType === "returning"
      ? { isNewPatient: false }
      : {};

  const procedureDateFilter = from || to ? {
    createdAt: {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to) } : {}),
    },
  } : {};

  const leadDateFilter = from || to ? {
    kommoCreatedAt: {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to) } : {}),
    },
  } : {};

  const adDateFilter = from || to ? {
    date: {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to) } : {}),
    },
  } : {};

  // 1. Revenue per canal de prospeccao
  const patientsWithRevenue = await prisma.patient.findMany({
    where: {
      clinicId,
      leads: { some: { ...pipelineFilter, ...patientTypeFilter } },
      procedures: {
        some: { status: { in: ["completed", "approved"] }, ...procedureDateFilter },
      },
    },
    include: {
      leads: {
        where: { ...pipelineFilter, ...patientTypeFilter },
        select: {
          canalProspeccao: true,
          channel: true,
          utmCampaign: true,
          kommoCreatedAt: true,
          isNewPatient: true,
        },
        take: 1,
        orderBy: { kommoCreatedAt: "asc" },
      },
      procedures: {
        where: { status: { in: ["completed", "approved"] }, ...procedureDateFilter },
        select: {
          value: true,
          createdAt: true,
          name: true,
        },
      },
    },
  });

  // Aggregate by canal
  const canalMap = new Map<string, { leads: number; patients: number; revenue: number; procedures: number }>();

  // Count all leads per canal (including those without procedures)
  const leadsByCanal = await prisma.lead.groupBy({
    by: ["canalProspeccao"],
    where: { clinicId, ...pipelineFilter, ...patientTypeFilter, ...leadDateFilter },
    _count: { id: true },
  });

  for (const row of leadsByCanal) {
    const canal = row.canalProspeccao ?? "Nao identificado";
    canalMap.set(canal, { leads: row._count.id, patients: 0, revenue: 0, procedures: 0 });
  }

  for (const patient of patientsWithRevenue) {
    const canal = patient.leads[0]?.canalProspeccao ?? "Nao identificado";
    const entry = canalMap.get(canal) ?? { leads: 0, patients: 0, revenue: 0, procedures: 0 };
    entry.patients += 1;
    entry.procedures += patient.procedures.length;
    entry.revenue += patient.procedures.reduce((sum, p) => sum + p.value, 0);
    canalMap.set(canal, entry);
  }

  // Get ad spend by platform for ROAS calculation
  const adSpend = await prisma.adCampaignData.aggregate({
    where: { clinicId, ...adDateFilter },
    _sum: { spend: true },
  });

  const totalAdSpend = adSpend._sum.spend ?? 0;

  // 2. LTV per patient
  const patientLTVs = patientsWithRevenue.map((p) => {
    const totalRevenue = p.procedures.reduce((sum, proc) => sum + proc.value, 0);
    const firstLead = p.leads[0];
    const firstProcedure = p.procedures.sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
    )[0];

    const leadToRevenueMs =
      firstLead?.kommoCreatedAt && firstProcedure
        ? firstProcedure.createdAt.getTime() - firstLead.kommoCreatedAt.getTime()
        : null;

    return {
      patientId: p.id,
      name: p.name,
      canal: firstLead?.canalProspeccao ?? "Nao identificado",
      totalRevenue,
      procedureCount: p.procedures.length,
      leadToRevenueDays: leadToRevenueMs !== null
        ? Math.round(leadToRevenueMs / (1000 * 60 * 60 * 24))
        : null,
    };
  });

  // 3. Aggregated metrics
  const totalRevenue = patientLTVs.reduce((sum, p) => sum + p.totalRevenue, 0);
  const avgLTV = patientLTVs.length > 0 ? totalRevenue / patientLTVs.length : 0;
  const roas = totalAdSpend > 0 ? totalRevenue / totalAdSpend : null;

  const leadToRevenueDays = patientLTVs
    .filter((p) => p.leadToRevenueDays !== null)
    .map((p) => p.leadToRevenueDays!);
  const avgLeadToRevenue = leadToRevenueDays.length > 0
    ? Math.round(leadToRevenueDays.reduce((a, b) => a + b, 0) / leadToRevenueDays.length)
    : null;

  // Canal breakdown with ROAS
  const canalPerformance = Array.from(canalMap.entries()).map(([canal, data]) => ({
    canal,
    ...data,
    avgLTV: data.patients > 0 ? data.revenue / data.patients : 0,
    conversionRate: data.leads > 0 ? (data.patients / data.leads) * 100 : 0,
  })).sort((a, b) => b.revenue - a.revenue);

  return NextResponse.json({
    data: {
      totalRevenue,
      totalAdSpend,
      roas,
      avgLTV,
      avgLeadToRevenueDays: avgLeadToRevenue,
      totalPatients: patientLTVs.length,
      canalPerformance,
      topPatients: patientLTVs
        .sort((a, b) => b.totalRevenue - a.totalRevenue)
        .slice(0, 10),
    },
  });
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/dashboard/ltv/route.ts
git commit -m "feat: add LTV/ROAS API endpoint

Crosses Kommo lead origin with Clinicorp financials. Returns ROAS,
avg LTV, lead-to-revenue timeline, and per-canal performance."
```

---

## Task 10: LTV/ROAS Dashboard Page

**Files:**
- Create: `src/app/dashboard/ltv/page.tsx`
- Modify: `src/components/layout/sidebar.tsx` — add nav item

- [ ] **Step 1: Add nav item to sidebar**

In `src/components/layout/sidebar.tsx`, add to `navItems` array after "Procedimentos":

```typescript
{ href: "/dashboard/ltv", label: "LTV & ROAS", icon: "TrendingUp" },
```

Add to `iconMap`:

```typescript
TrendingUp: "M22 7l-8.5 8.5-5-5L2 17",
```

- [ ] **Step 2: Create LTV dashboard page**

Create `src/app/dashboard/ltv/page.tsx`:

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { DateFilter } from "@/components/dashboard/date-filter";
import { useClinic } from "@/hooks/use-clinic";

interface LTVData {
  totalRevenue: number;
  totalAdSpend: number;
  roas: number | null;
  avgLTV: number;
  avgLeadToRevenueDays: number | null;
  totalPatients: number;
  canalPerformance: {
    canal: string;
    leads: number;
    patients: number;
    revenue: number;
    procedures: number;
    avgLTV: number;
    conversionRate: number;
  }[];
  topPatients: {
    patientId: string;
    name: string;
    canal: string;
    totalRevenue: number;
    procedureCount: number;
    leadToRevenueDays: number | null;
  }[];
}

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const empty: LTVData = {
  totalRevenue: 0, totalAdSpend: 0, roas: null, avgLTV: 0,
  avgLeadToRevenueDays: null, totalPatients: 0, canalPerformance: [], topPatients: [],
};

export default function LTVPage() {
  const { clinic, loading: clinicLoading } = useClinic();
  const [data, setData] = useState<LTVData>(empty);
  const [dateRange, setDateRange] = useState({ from: "", to: "" });
  const [patientType, setPatientType] = useState<"all" | "new" | "returning">("all");

  const fetchData = useCallback(() => {
    if (!clinic) return;
    const params = new URLSearchParams({ clinicId: clinic.id });
    if (dateRange.from) params.set("from", dateRange.from);
    if (dateRange.to) params.set("to", dateRange.to);
    if (patientType !== "all") params.set("patientType", patientType);
    fetch(`/api/dashboard/ltv?${params}`)
      .then((res) => res.json())
      .then((json) => setData(json.data ?? empty))
      .catch(() => {});
  }, [clinic, dateRange, patientType]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (clinicLoading) return <p className="text-muted-foreground p-8">Carregando...</p>;

  const d = data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">LTV & ROAS</h1>
          <p className="text-sm text-muted-foreground">{clinic?.name} — Metricas de receita e retorno</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Patient Type Toggle */}
          <div className="flex rounded-lg border border-border overflow-hidden">
            {(["all", "new", "returning"] as const).map((type) => {
              const labels = { all: "Todos", new: "Novos", returning: "Existentes" };
              const isActive = patientType === type;
              return (
                <button
                  key={type}
                  onClick={() => setPatientType(type)}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                    isActive
                      ? "bg-gold/15 text-gold"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/10"
                  }`}
                >
                  {labels[type]}
                </button>
              );
            })}
          </div>
          <DateFilter onFilter={(from, to) => setDateRange({ from, to })} />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-xl bg-card p-5 glass-border">
          <p className="text-sm text-muted-foreground">Receita Total</p>
          <p className="font-display text-2xl font-bold text-gold mt-1">{fmt(d.totalRevenue)}</p>
        </div>
        <div className="rounded-xl bg-card p-5 glass-border">
          <p className="text-sm text-muted-foreground">Investimento Ads</p>
          <p className="font-display text-2xl font-bold mt-1">{fmt(d.totalAdSpend)}</p>
        </div>
        <div className="rounded-xl bg-card p-5 glass-border">
          <p className="text-sm text-muted-foreground">ROAS Geral</p>
          <p className="font-display text-2xl font-bold mt-1">
            {d.roas !== null ? `${d.roas.toFixed(1)}x` : "—"}
          </p>
        </div>
        <div className="rounded-xl bg-card p-5 glass-border">
          <p className="text-sm text-muted-foreground">LTV Medio</p>
          <p className="font-display text-2xl font-bold mt-1">{fmt(d.avgLTV)}</p>
        </div>
        <div className="rounded-xl bg-card p-5 glass-border">
          <p className="text-sm text-muted-foreground">Lead → Receita</p>
          <p className="font-display text-2xl font-bold mt-1">
            {d.avgLeadToRevenueDays !== null ? `${d.avgLeadToRevenueDays} dias` : "—"}
          </p>
        </div>
      </div>

      {/* Performance por Canal */}
      <div className="rounded-xl bg-card p-6 glass-border">
        <h2 className="font-display text-lg font-semibold mb-4">Performance por Canal de Aquisicao</h2>
        {d.canalPerformance.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum dado disponivel. Leads precisam ter o campo "Canal de Prospeccao" preenchido na Kommo.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="py-3 pr-4 font-medium text-muted-foreground">Canal</th>
                  <th className="py-3 pr-4 font-medium text-muted-foreground text-right">Leads</th>
                  <th className="py-3 pr-4 font-medium text-muted-foreground text-right">Pacientes</th>
                  <th className="py-3 pr-4 font-medium text-muted-foreground text-right">Conversao</th>
                  <th className="py-3 pr-4 font-medium text-muted-foreground text-right">Procedimentos</th>
                  <th className="py-3 pr-4 font-medium text-muted-foreground text-right">Receita</th>
                  <th className="py-3 font-medium text-muted-foreground text-right">LTV Medio</th>
                </tr>
              </thead>
              <tbody>
                {d.canalPerformance.map((c) => (
                  <tr key={c.canal} className="border-b border-border/50">
                    <td className="py-3 pr-4 font-medium">{c.canal}</td>
                    <td className="py-3 pr-4 text-right">{c.leads}</td>
                    <td className="py-3 pr-4 text-right">{c.patients}</td>
                    <td className="py-3 pr-4 text-right">{c.conversionRate.toFixed(1)}%</td>
                    <td className="py-3 pr-4 text-right">{c.procedures}</td>
                    <td className="py-3 pr-4 text-right font-semibold">{fmt(c.revenue)}</td>
                    <td className="py-3 text-right">{fmt(c.avgLTV)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Top Pacientes por Receita */}
      <div className="rounded-xl bg-card p-6 glass-border">
        <h2 className="font-display text-lg font-semibold mb-4">Top 10 Pacientes por Receita</h2>
        {d.topPatients.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum paciente com receita registrada.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="py-3 pr-4 font-medium text-muted-foreground">Paciente</th>
                  <th className="py-3 pr-4 font-medium text-muted-foreground">Canal</th>
                  <th className="py-3 pr-4 font-medium text-muted-foreground text-right">Procedimentos</th>
                  <th className="py-3 pr-4 font-medium text-muted-foreground text-right">Receita Total</th>
                  <th className="py-3 font-medium text-muted-foreground text-right">Lead → Receita</th>
                </tr>
              </thead>
              <tbody>
                {d.topPatients.map((p) => (
                  <tr key={p.patientId} className="border-b border-border/50">
                    <td className="py-3 pr-4">
                      <a href={`/dashboard/patients/${p.patientId}`} className="font-medium hover:text-gold transition-colors">
                        {p.name}
                      </a>
                    </td>
                    <td className="py-3 pr-4 text-muted-foreground">{p.canal}</td>
                    <td className="py-3 pr-4 text-right">{p.procedureCount}</td>
                    <td className="py-3 pr-4 text-right font-semibold">{fmt(p.totalRevenue)}</td>
                    <td className="py-3 text-right text-muted-foreground">
                      {p.leadToRevenueDays !== null ? `${p.leadToRevenueDays}d` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify in browser**

Run: `npm run dev`
Navigate to `/dashboard/ltv`. Verify sidebar shows the new item and the page renders correctly with the KPI cards and tables.

- [ ] **Step 4: Commit**

```bash
git add src/app/dashboard/ltv/page.tsx src/components/layout/sidebar.tsx
git commit -m "feat: add LTV & ROAS dashboard page

Shows total revenue, ad spend, ROAS, avg LTV, lead-to-revenue time.
Table of per-canal performance and top 10 patients by revenue."
```

---

## Task 11: Patient Listing API & Page

**Files:**
- Create: `src/app/api/patients/route.ts`
- Create: `src/app/dashboard/patients/page.tsx`
- Modify: `src/components/layout/sidebar.tsx` — add nav item

- [ ] **Step 1: Create patient listing API**

Create `src/app/api/patients/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const clinicId = searchParams.get("clinicId");
  const search = searchParams.get("search");
  const canal = searchParams.get("canal");

  if (!clinicId) {
    return NextResponse.json({ error: "clinicId is required" }, { status: 400 });
  }

  const where: Record<string, unknown> = { clinicId };

  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { phone: { contains: search } },
    ];
  }

  if (canal) {
    where.canalProspeccao = canal;
  }

  const patients = await prisma.patient.findMany({
    where,
    include: {
      leads: {
        select: {
          canalProspeccao: true,
          channel: true,
          kommoCreatedAt: true,
          agendamentoAt: true,
        },
        take: 1,
        orderBy: { kommoCreatedAt: "asc" },
      },
      procedures: {
        where: { status: { in: ["completed", "approved"] } },
        select: { value: true, name: true, createdAt: true },
      },
      _count: { select: { procedures: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const data = patients.map((p) => ({
    id: p.id,
    name: p.name,
    phone: p.phone,
    canal: p.canalProspeccao ?? p.leads[0]?.canalProspeccao ?? "—",
    totalRevenue: p.procedures.reduce((sum, proc) => sum + proc.value, 0),
    procedureCount: p._count.procedures,
    firstContact: p.leads[0]?.kommoCreatedAt ?? p.createdAt,
    lastProcedure: p.procedures.length > 0
      ? p.procedures.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0].createdAt
      : null,
  }));

  return NextResponse.json({ data });
}
```

- [ ] **Step 2: Add nav item**

In `src/components/layout/sidebar.tsx`, add to `navItems` after the LTV item:

```typescript
{ href: "/dashboard/patients", label: "Pacientes", icon: "UserCheck" },
```

Add to `iconMap`:

```typescript
UserCheck: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM16 11l2 2 4-4",
```

- [ ] **Step 3: Create patient listing page**

Create `src/app/dashboard/patients/page.tsx`:

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { useClinic } from "@/hooks/use-clinic";
import Link from "next/link";

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

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString("pt-BR") : "—";

export default function PatientsPage() {
  const { clinic, loading: clinicLoading } = useClinic();
  const [patients, setPatients] = useState<PatientRow[]>([]);
  const [search, setSearch] = useState("");

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

  if (clinicLoading) return <p className="text-muted-foreground p-8">Carregando...</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Pacientes</h1>
          <p className="text-sm text-muted-foreground">Visao completa de todos os pacientes do funil</p>
        </div>
        <input
          type="text"
          placeholder="Buscar por nome ou telefone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-lg border border-border bg-card px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gold/50 w-72"
        />
      </div>

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
    </div>
  );
}
```

- [ ] **Step 4: Verify in browser**

Run: `npm run dev`
Navigate to `/dashboard/patients`. Verify the table loads and search works.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/patients/route.ts src/app/dashboard/patients/page.tsx src/components/layout/sidebar.tsx
git commit -m "feat: add patient listing page with search and canal breakdown"
```

---

## Task 12: Patient Profile API (360 View)

**Files:**
- Create: `src/app/api/patients/[id]/route.ts`

- [ ] **Step 1: Create patient profile API**

Create `src/app/api/patients/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const patient = await prisma.patient.findUnique({
    where: { id: params.id },
    include: {
      leads: {
        select: {
          id: true,
          name: true,
          channel: true,
          canalProspeccao: true,
          utmSource: true,
          utmMedium: true,
          utmCampaign: true,
          utmContent: true,
          kommoCreatedAt: true,
          agendamentoAt: true,
          kommoStatus: true,
        },
        orderBy: { kommoCreatedAt: "asc" },
      },
      procedures: {
        select: {
          id: true,
          name: true,
          value: true,
          status: true,
          completedAt: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!patient) {
    return NextResponse.json({ error: "Patient not found" }, { status: 404 });
  }

  const firstLead = patient.leads[0] ?? null;
  const totalRevenue = patient.procedures
    .filter((p) => p.status === "completed" || p.status === "approved")
    .reduce((sum, p) => sum + p.value, 0);

  const lastProcedure = patient.procedures.length > 0
    ? patient.procedures[0]
    : null;

  // Build timeline events
  const timeline: { date: string; type: string; description: string }[] = [];

  if (firstLead?.kommoCreatedAt) {
    timeline.push({
      date: firstLead.kommoCreatedAt.toISOString(),
      type: "lead",
      description: `Lead criado (${firstLead.canalProspeccao ?? firstLead.channel})`,
    });
  }

  if (firstLead?.agendamentoAt) {
    timeline.push({
      date: firstLead.agendamentoAt.toISOString(),
      type: "agendamento",
      description: "Consulta agendada",
    });
  }

  for (const proc of patient.procedures) {
    timeline.push({
      date: (proc.completedAt ?? proc.createdAt).toISOString(),
      type: "procedure",
      description: `${proc.name} — R$ ${proc.value.toFixed(2)} (${proc.status})`,
    });
  }

  timeline.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return NextResponse.json({
    data: {
      id: patient.id,
      name: patient.name,
      phone: patient.phone,
      cpf: patient.cpf,
      canalProspeccao: patient.canalProspeccao ?? firstLead?.canalProspeccao ?? null,
      utms: {
        source: firstLead?.utmSource,
        medium: firstLead?.utmMedium,
        campaign: firstLead?.utmCampaign,
        content: firstLead?.utmContent,
      },
      totalRevenue,
      procedureCount: patient.procedures.length,
      firstContact: firstLead?.kommoCreatedAt,
      lastProcedure: lastProcedure ? {
        name: lastProcedure.name,
        date: lastProcedure.completedAt ?? lastProcedure.createdAt,
        value: lastProcedure.value,
      } : null,
      procedures: patient.procedures,
      timeline,
      createdAt: patient.createdAt,
    },
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/patients/\[id\]/route.ts
git commit -m "feat: add patient profile API with full journey timeline"
```

---

## Task 13: Patient Profile Page (360 View)

**Files:**
- Create: `src/app/dashboard/patients/[id]/page.tsx`

- [ ] **Step 1: Create patient profile page**

Create `src/app/dashboard/patients/[id]/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

interface PatientProfile {
  id: string;
  name: string;
  phone: string | null;
  cpf: string | null;
  canalProspeccao: string | null;
  utms: { source?: string; medium?: string; campaign?: string; content?: string };
  totalRevenue: number;
  procedureCount: number;
  firstContact: string | null;
  lastProcedure: { name: string; date: string; value: number } | null;
  procedures: { id: string; name: string; value: number; status: string; completedAt: string | null; createdAt: string }[];
  timeline: { date: string; type: string; description: string }[];
}

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString("pt-BR") : "—";
const fmtFull = (d: string) =>
  new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });

const statusColors: Record<string, string> = {
  completed: "bg-green-500/15 text-green-400",
  approved: "bg-blue-500/15 text-blue-400",
  pending: "bg-yellow-500/15 text-yellow-400",
  cancelled: "bg-red-500/15 text-red-400",
};

const timelineIcons: Record<string, string> = {
  lead: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2",
  agendamento: "M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z",
  procedure: "M20 6 9 17l-5-5",
};

export default function PatientProfilePage() {
  const { id } = useParams<{ id: string }>();
  const [profile, setProfile] = useState<PatientProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/patients/${id}`)
      .then((res) => res.json())
      .then((json) => setProfile(json.data ?? null))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <p className="text-muted-foreground p-8">Carregando...</p>;
  if (!profile) return <p className="text-destructive p-8">Paciente nao encontrado.</p>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Link href="/dashboard/patients" className="mt-1 rounded-lg p-2 hover:bg-muted/10 transition-colors">
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        </Link>
        <div className="flex-1">
          <h1 className="font-display text-2xl font-bold">{profile.name}</h1>
          <div className="flex items-center gap-3 mt-1">
            {profile.phone && <span className="text-sm text-muted-foreground">{profile.phone}</span>}
            {profile.canalProspeccao && (
              <span className="inline-block rounded-full bg-gold/10 px-2.5 py-0.5 text-xs font-medium text-gold">
                {profile.canalProspeccao}
              </span>
            )}
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm text-muted-foreground">Receita Total</p>
          <p className="font-display text-2xl font-bold text-gold">{fmt(profile.totalRevenue)}</p>
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-xl bg-card p-4 glass-border">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Primeiro Contato</p>
          <p className="text-sm font-semibold mt-1">{fmtDate(profile.firstContact)}</p>
        </div>
        <div className="rounded-xl bg-card p-4 glass-border">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Procedimentos</p>
          <p className="text-sm font-semibold mt-1">{profile.procedureCount}</p>
        </div>
        <div className="rounded-xl bg-card p-4 glass-border">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Ultimo Procedimento</p>
          <p className="text-sm font-semibold mt-1">
            {profile.lastProcedure ? `${profile.lastProcedure.name} (${fmtDate(profile.lastProcedure.date)})` : "—"}
          </p>
        </div>
        <div className="rounded-xl bg-card p-4 glass-border">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Canal / UTM</p>
          <p className="text-sm font-semibold mt-1">{profile.canalProspeccao ?? "—"}</p>
          {profile.utms.campaign && (
            <p className="text-xs text-muted-foreground mt-0.5">Campanha: {profile.utms.campaign}</p>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Timeline */}
        <div className="rounded-xl bg-card p-6 glass-border">
          <h2 className="font-display text-lg font-semibold mb-4">Jornada do Paciente</h2>
          <div className="space-y-4">
            {profile.timeline.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum evento registrado.</p>
            ) : (
              profile.timeline.map((event, i) => (
                <div key={i} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted/20 shrink-0">
                      <svg className="h-3.5 w-3.5 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d={timelineIcons[event.type] ?? timelineIcons.procedure} />
                      </svg>
                    </div>
                    {i < profile.timeline.length - 1 && (
                      <div className="w-px flex-1 bg-border mt-1" />
                    )}
                  </div>
                  <div className="pb-4">
                    <p className="text-sm font-medium">{event.description}</p>
                    <p className="text-xs text-muted-foreground">{fmtFull(event.date)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Procedures Table */}
        <div className="rounded-xl bg-card p-6 glass-border">
          <h2 className="font-display text-lg font-semibold mb-4">Procedimentos</h2>
          <div className="space-y-3">
            {profile.procedures.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum procedimento registrado.</p>
            ) : (
              profile.procedures.map((proc) => (
                <div key={proc.id} className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
                  <div>
                    <p className="text-sm font-medium">{proc.name}</p>
                    <p className="text-xs text-muted-foreground">{fmtDate(proc.completedAt ?? proc.createdAt)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${statusColors[proc.status] ?? "bg-muted text-muted-foreground"}`}>
                      {proc.status}
                    </span>
                    <span className="text-sm font-semibold">{fmt(proc.value)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify in browser**

Run: `npm run dev`
Navigate to `/dashboard/patients`, click on a patient name. The profile page should show: header with name/phone/canal, info cards, timeline, and procedures list.

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/patients/\[id\]/page.tsx
git commit -m "feat: add patient profile page with 360-degree journey view

Shows patient info, canal/UTM source, full timeline from lead
creation through procedures, and detailed procedure list."
```

---

## Task 14: Return Reminders — Foundation (Phase 4)

**Context:** This is lower priority. We create the worker structure and API endpoint for future activation. The logic: check Clinicorp for patients with procedures that have a typical return interval (Botox ~4 months, Preenchimento ~8 months). This task creates the infrastructure; the actual Clinicorp "alerta de retorno" API integration depends on field availability in their API.

**Files:**
- Create: `src/workers/check-reminders.ts`
- Modify: `src/workers/index.ts` — register new worker
- Create: `src/app/api/reminders/route.ts`

- [ ] **Step 1: Create reminder worker**

Create `src/workers/check-reminders.ts`:

```typescript
import { Queue, Worker } from "bullmq";
import { redis } from "@/lib/redis";
import { prisma } from "@/lib/prisma";

// Typical return intervals in days
const PROCEDURE_INTERVALS: Record<string, number> = {
  botox: 120,           // ~4 months
  toxina: 120,
  preenchimento: 240,   // ~8 months
  filler: 240,
  bioestimulador: 365,  // ~12 months
};

function getReturnIntervalDays(procedureName: string): number | null {
  const lower = procedureName.toLowerCase();
  for (const [key, days] of Object.entries(PROCEDURE_INTERVALS)) {
    if (lower.includes(key)) return days;
  }
  return null;
}

export const checkRemindersQueue = new Queue("check-reminders", {
  connection: redis,
});

export const checkRemindersWorker = new Worker(
  "check-reminders",
  async (job) => {
    const { clinicId } = job.data;

    // Find completed procedures with known return intervals
    const procedures = await prisma.procedure.findMany({
      where: {
        clinicId,
        status: "completed",
        completedAt: { not: null },
      },
      include: {
        patient: {
          select: { id: true, name: true, phone: true },
        },
      },
      orderBy: { completedAt: "desc" },
    });

    const now = new Date();
    const reminders: Array<{
      patientId: string;
      patientName: string;
      phone: string | null;
      procedureName: string;
      lastDate: Date;
      dueDate: Date;
      daysOverdue: number;
    }> = [];

    for (const proc of procedures) {
      const intervalDays = getReturnIntervalDays(proc.name);
      if (!intervalDays || !proc.completedAt) continue;

      const dueDate = new Date(proc.completedAt.getTime() + intervalDays * 24 * 60 * 60 * 1000);
      const daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

      // Alert if due within 30 days or overdue
      if (daysOverdue >= -30) {
        reminders.push({
          patientId: proc.patient.id,
          patientName: proc.patient.name,
          phone: proc.patient.phone,
          procedureName: proc.name,
          lastDate: proc.completedAt,
          dueDate,
          daysOverdue,
        });
      }
    }

    console.log(`[check-reminders] Found ${reminders.length} pending reminders for clinic ${clinicId}`);

    // TODO: When Kommo automation is ready, move patients to "Lead pronto para reabordagem"
    // For now, just return the reminders for the API to display

    return reminders;
  },
  { connection: redis, concurrency: 1 }
);

checkRemindersWorker.on("completed", (job) => {
  console.log(`[check-reminders] Job ${job.id} completed`);
});

checkRemindersWorker.on("failed", (job, err) => {
  console.error(`[check-reminders] Job ${job?.id} failed:`, err.message);
});
```

- [ ] **Step 2: Register worker in index**

In `src/workers/index.ts`, add import:

```typescript
import { checkRemindersWorker } from "./check-reminders";
```

Add to the workers array (wherever they're listed for graceful shutdown).

- [ ] **Step 3: Create reminders API endpoint**

Create `src/app/api/reminders/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const PROCEDURE_INTERVALS: Record<string, number> = {
  botox: 120,
  toxina: 120,
  preenchimento: 240,
  filler: 240,
  bioestimulador: 365,
};

function getReturnIntervalDays(procedureName: string): number | null {
  const lower = procedureName.toLowerCase();
  for (const [key, days] of Object.entries(PROCEDURE_INTERVALS)) {
    if (lower.includes(key)) return days;
  }
  return null;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const clinicId = searchParams.get("clinicId");

  if (!clinicId) {
    return NextResponse.json({ error: "clinicId is required" }, { status: 400 });
  }

  const procedures = await prisma.procedure.findMany({
    where: {
      clinicId,
      status: "completed",
      completedAt: { not: null },
    },
    include: {
      patient: {
        select: { id: true, name: true, phone: true, canalProspeccao: true },
      },
    },
    orderBy: { completedAt: "desc" },
  });

  const now = new Date();
  const reminders = [];

  for (const proc of procedures) {
    const intervalDays = getReturnIntervalDays(proc.name);
    if (!intervalDays || !proc.completedAt) continue;

    const dueDate = new Date(proc.completedAt.getTime() + intervalDays * 24 * 60 * 60 * 1000);
    const daysUntilDue = Math.floor((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    // Show reminders due within 30 days or overdue
    if (daysUntilDue <= 30) {
      reminders.push({
        patientId: proc.patient.id,
        patientName: proc.patient.name,
        phone: proc.patient.phone,
        canal: proc.patient.canalProspeccao,
        procedureName: proc.name,
        lastDate: proc.completedAt,
        dueDate,
        daysUntilDue,
        status: daysUntilDue < 0 ? "overdue" : daysUntilDue <= 7 ? "urgent" : "upcoming",
      });
    }
  }

  reminders.sort((a, b) => a.daysUntilDue - b.daysUntilDue);

  return NextResponse.json({ data: reminders });
}
```

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/workers/check-reminders.ts src/workers/index.ts src/app/api/reminders/route.ts
git commit -m "feat: add return reminder worker and API (Phase 4 foundation)

Calculates procedure return dates based on known intervals (Botox 4mo,
Preenchimento 8mo). API returns upcoming/overdue reminders. Worker
structure ready for Kommo automation integration."
```

---

## Task 15: Final Version Bump + Build Verification

**Files:**
- Modify: `package.json`
- Modify: `src/lib/version.ts`

- [ ] **Step 1: Bump version to 0.13.0**

In `package.json`, change version to `"0.13.0"`.

In `src/lib/version.ts`:

```typescript
export const APP_VERSION = "0.13.0";
```

Add changelog entry:

```typescript
{
  version: "0.13.0",
  date: "2026-04-16",
  type: "minor",
  changes: [
    "Dashboard LTV & ROAS com metricas por canal de aquisicao",
    "Pagina de listagem de pacientes com busca e filtros",
    "Perfil do paciente 360: timeline completa lead-to-procedure",
    "API de lembretes de retorno por procedimento (Botox 4m, Preenchimento 8m)",
    "Worker check-reminders para automacao futura de fidelizacao",
  ],
},
```

- [ ] **Step 2: Full build verification**

Run: `npm run build`
Expected: Build succeeds with zero errors.

- [ ] **Step 3: Verify all pages in browser**

Run: `npm run dev`

Check each page:
1. `/dashboard` — Pipeline-filtered lead counts, canal breakdown section
2. `/dashboard/leads` — Filtered lead list
3. `/dashboard/ltv` — LTV/ROAS KPIs, canal performance table, top patients
4. `/dashboard/patients` — Patient listing with search
5. `/dashboard/patients/[id]` — Patient profile with timeline
6. `/dashboard/campaigns` — Existing campaign page (no regression)
7. `/dashboard/procedures` — Existing procedures page (no regression)
8. `/dashboard/settings` — Existing settings page (no regression)

- [ ] **Step 4: Commit**

```bash
git add package.json src/lib/version.ts
git commit -m "chore: bump version to 0.13.0 — LTV dashboard + patient profiles + reminders"
```

---

## Notes for Implementation

### External tasks (not code — align with Ingrid/Sergio):
- **UTM setup in Meta Ads**: Define structure `utm_source=meta&utm_medium=cpc&utm_campaign=NOME&utm_content=CRIATIVO` and apply to all campaigns
- **"Canal de Prospeccao" field in Kommo**: Confirm the exact field name/code so extraction works
- **Clinicorp appointment fields in Kommo**: The SDR team needs custom fields for date/time/professional. Confirm field names with Ingrid
- **Clinicorp patient field for canal**: Check if Clinicorp supports custom fields beyond Notes. If yes, update the patient creation payload
- **Validate numbers with Ingrid**: After Task 1 deploy, compare dashboard numbers with her manual count

### isNewPatient backfill for existing leads:
The `isNewPatient` field will be `null` for all existing leads. New leads will get classified automatically by the worker (Task 4). For existing leads, there are two options:
1. **Manual sync**: Create a one-time script that iterates over all leads with `isNewPatient = null`, checks Clinicorp for each, and sets the value. Add this as a button in the Settings page or a sync API endpoint.
2. **Gradual**: Let the field populate naturally as new leads come in. The dashboard toggle will show existing leads under "Todos" only until they get classified.

Recommendation: Option 1 (manual sync script) is better for immediate accuracy. Can be triggered via the existing `/api/sync` endpoint.

### Migration batching:
Tasks 3, 5, and 6 each create a Prisma migration. If implementing in a single session, these can be combined into one migration to keep the migration history clean. Run `npx prisma migrate dev --name roadmap-clinica-alexia` once with all schema changes.

### Version bumps:
The plan has two version bumps (0.12.0 and 0.13.0). If implementing everything in one go, skip 0.12.0 and go straight to 0.13.0 with all changes combined.
