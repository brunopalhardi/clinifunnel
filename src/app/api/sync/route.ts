import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { KommoClient } from "@/lib/kommo/client";
import { normalizePhoneBR } from "@/lib/utils/phone";
import { matchLeadToPatient, linkLeadToPatient } from "@/lib/matching/lead-patient";
import { getAuthorizedClinicId, AuthError } from "@/lib/auth-guard";
import { getMatchLeadsQueue, getSyncClinicorpQueue } from "@/lib/queues";

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
