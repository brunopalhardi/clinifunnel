import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { KommoClient } from "@/lib/kommo/client";
import { normalizePhoneBR } from "@/lib/utils/phone";
import { matchLeadToPatient, linkLeadToPatient } from "@/lib/matching/lead-patient";
import { matchLeadsQueue } from "@/workers/match-leads";
import { syncClinicorpQueue } from "@/workers/sync-clinicorp";

export async function POST(request: NextRequest) {
  const { type } = await request.json();

  const jobs: string[] = [];

  if (type === "all" || type === "match") {
    await matchLeadsQueue.add("match-leads", {}, { removeOnComplete: 100 });
    jobs.push("match-leads");
  }

  if (type === "all" || type === "clinicorp") {
    await syncClinicorpQueue.add("sync-clinicorp", {}, { removeOnComplete: 100 });
    jobs.push("sync-clinicorp");
  }

  if (type === "reprocess-phones") {
    const result = await reprocessLeadPhones();
    return NextResponse.json({ message: "Reprocess phones completed", ...result });
  }

  if (type === "match-now") {
    const result = await matchLeadsNow();
    return NextResponse.json({ message: "Match leads completed", ...result });
  }

  return NextResponse.json({
    message: `Sync jobs enqueued: ${jobs.join(", ")}`,
    jobs,
  });
}

async function matchLeadsNow() {
  const leads = await prisma.lead.findMany({
    where: { patientId: null },
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

async function reprocessLeadPhones() {
  const clinics = await prisma.clinic.findMany({
    where: { kommoToken: { not: "" } },
    select: { id: true, kommoSubdomain: true, kommoToken: true },
  });

  let totalProcessed = 0;
  let totalUpdated = 0;
  let totalErrors = 0;

  for (const clinic of clinics) {
    const leads = await prisma.lead.findMany({
      where: { clinicId: clinic.id, phone: { equals: null } },
      select: { id: true, kommoLeadId: true },
    });

    if (leads.length === 0) continue;

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

        // Rate limit: 100ms between requests to avoid Kommo API limits
        await new Promise((r) => setTimeout(r, 100));
      } catch (err) {
        totalErrors++;
        console.error(`[reprocess-phones] Lead ${lead.id} error:`, err);
      }
    }
  }

  return { totalProcessed, totalUpdated, totalErrors };
}
