import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { KommoClient } from "@/lib/kommo/client";
import { normalizePhoneBR } from "@/lib/utils/phone";
import { matchLeadToPatient, linkLeadToPatient } from "@/lib/matching/lead-patient";
import { getAuthorizedClinicId, AuthError } from "@/lib/auth-guard";
import { getMatchLeadsQueue, getSyncClinicorpQueue } from "@/lib/queues";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { PermissionDeniedError, requirePermission } from "@/lib/permissions";

export const dynamic = "force-dynamic";

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

  // RBAC: sync usa tokens de integracao = write em settings.
  const session = await getServerSession(authOptions);
  try {
    if (session?.user) requirePermission(session.user, "settings", "write");
  } catch (e) {
    if (e instanceof PermissionDeniedError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }

  const { type } = await request.json();
  const jobs: string[] = [];

  if (type === "all" || type === "match") {
    await getMatchLeadsQueue().add("match-leads", { clinicId }, { removeOnComplete: 100 });
    jobs.push("match-leads");
  }

  if (type === "all" || type === "clinicorp") {
    await getSyncClinicorpQueue().add("sync-clinicorp", { clinicId }, { removeOnComplete: 100 });
    jobs.push("sync-clinicorp");
  }

  if (type === "reprocess-phones") {
    const result = await reprocessLeadPhones(clinicId);
    return NextResponse.json({ message: "Reprocess phones completed", ...result });
  }

  if (type === "reprocess-names") {
    const result = await reprocessLeadNames(clinicId);
    return NextResponse.json({ message: "Reprocess names completed", ...result });
  }

  if (type === "match-now") {
    const result = await matchLeadsNow(clinicId);
    return NextResponse.json({ message: "Match leads completed", ...result });
  }

  return NextResponse.json({ message: `Sync jobs enqueued: ${jobs.join(", ")}`, jobs });
}

async function matchLeadsNow(clinicId: string) {
  const leads = await prisma.lead.findMany({
    where: { clinicId, patientId: null },
  });

  let matched = 0;
  for (const lead of leads) {
    const patient = await matchLeadToPatient(lead);
    if (patient) {
      await linkLeadToPatient(lead.id, patient.id);
      matched++;
    }
  }

  return { totalProcessed: leads.length, matched };
}

async function reprocessLeadPhones(clinicId: string) {
  const clinic = await prisma.clinic.findUnique({
    where: { id: clinicId },
    select: { id: true, kommoSubdomain: true, kommoToken: true },
  });

  if (!clinic || !clinic.kommoToken) {
    return { totalProcessed: 0, totalUpdated: 0, totalErrors: 0 };
  }

  let totalProcessed = 0;
  let totalUpdated = 0;
  let totalErrors = 0;

  const leads = await prisma.lead.findMany({
    where: { clinicId: clinic.id, phone: { equals: null } },
    select: { id: true, kommoLeadId: true },
  });

  if (leads.length === 0) return { totalProcessed, totalUpdated, totalErrors };

  const kommoClient = new KommoClient(clinic.kommoSubdomain, clinic.kommoToken);

  for (const lead of leads) {
    totalProcessed++;
    try {
      const kommoLead = await kommoClient.getLead(parseInt(lead.kommoLeadId));
      const contacts = kommoLead._embedded?.contacts;
      if (!contacts?.length) continue;

      const contact = await kommoClient.getContact(contacts[0].id);
      if (!contact.custom_fields_values) continue;

      let phone: string | null = null;
      let email: string | null = null;

      for (const field of contact.custom_fields_values) {
        const code = field.field_code?.toUpperCase();
        if (code === "PHONE" && field.values.length > 0) {
          phone = normalizePhoneBR(field.values[0].value);
        }
        if (code === "EMAIL" && field.values.length > 0) {
          email = field.values[0].value;
        }
      }

      if (phone || email) {
        await prisma.lead.update({
          where: { id: lead.id },
          data: { ...(phone ? { phone } : {}), ...(email ? { email } : {}) },
        });
        totalUpdated++;
      }

      await new Promise((r) => setTimeout(r, 100));
    } catch (err) {
      totalErrors++;
      console.error(`[reprocess-phones] Lead ${lead.id} error:`, err);
    }
  }

  return { totalProcessed, totalUpdated, totalErrors };
}

/**
 * [LEAD-1] Reprocessa o nome dos leads que ficaram com "Lead #N" no DB.
 *
 * Esses leads sao antigos (pre-INT-2.2 / v0.32.2) ou casos onde o webhook
 * processou sem buscar o contato do Kommo. Agora o webhook ja usa contact.name
 * como displayName, mas o backfill aqui resolve os leads antigos.
 *
 * Estrategia:
 * - Busca leads cujo `name` matcheia o padrao /^Lead #\d+$/i
 * - Pra cada um, chama getLead(kommoLeadId) -> pega contacts[0].id -> getContact()
 *   -> usa contact.name se nao vazio
 * - Throttle de 100ms entre requests pra evitar rate limit
 */
async function reprocessLeadNames(clinicId: string) {
  const clinic = await prisma.clinic.findUnique({
    where: { id: clinicId },
    select: { id: true, kommoSubdomain: true, kommoToken: true },
  });

  if (!clinic || !clinic.kommoToken) {
    return { totalProcessed: 0, totalUpdated: 0, totalErrors: 0 };
  }

  // Leads com nome no padrao "Lead #12345" (ou null/vazio)
  const leads = await prisma.lead.findMany({
    where: {
      clinicId: clinic.id,
      OR: [
        { name: { startsWith: "Lead #" } },
        { name: "" },
      ],
    },
    select: { id: true, kommoLeadId: true },
  });

  let totalProcessed = 0;
  let totalUpdated = 0;
  let totalErrors = 0;

  if (leads.length === 0) return { totalProcessed, totalUpdated, totalErrors };

  const kommoClient = new KommoClient(clinic.kommoSubdomain, clinic.kommoToken);

  for (const lead of leads) {
    totalProcessed++;
    try {
      const kommoLead = await kommoClient.getLead(parseInt(lead.kommoLeadId));
      const contacts = kommoLead._embedded?.contacts;
      if (!contacts?.length) continue;

      const contact = await kommoClient.getContact(contacts[0].id);
      const realName = contact.name?.trim();
      if (realName) {
        await prisma.lead.update({
          where: { id: lead.id },
          data: { name: realName },
        });
        totalUpdated++;
      }

      await new Promise((r) => setTimeout(r, 100));
    } catch (err) {
      totalErrors++;
      console.error(`[reprocess-names] Lead ${lead.id} error:`, err);
    }
  }

  return { totalProcessed, totalUpdated, totalErrors };
}
