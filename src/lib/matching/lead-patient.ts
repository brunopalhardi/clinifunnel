import { prisma } from "@/lib/prisma";
import { normalizePhoneBR } from "@/lib/utils/phone";
import { Lead, Patient } from "@prisma/client";

export async function matchLeadToPatient(
  lead: Lead
): Promise<Patient | null> {
  // 1. Match by phone
  if (lead.phone) {
    const normalized = normalizePhoneBR(lead.phone);
    const patient = await prisma.patient.findFirst({
      where: { clinicId: lead.clinicId, phone: normalized },
    });
    if (patient) return patient;
  }

  // 2. Match by email (if both have it)
  if (lead.email) {
    const patient = await prisma.patient.findFirst({
      where: {
        clinicId: lead.clinicId,
        leads: { some: { email: lead.email } },
      },
    });
    if (patient) return patient;
  }

  return null;
}

export async function linkLeadToPatient(
  leadId: string,
  patientId: string
): Promise<void> {
  await prisma.lead.update({
    where: { id: leadId },
    data: { patientId },
  });
}

export async function matchPatientToLeads(
  patient: { id: string; clinicId: string; phone: string | null }
): Promise<number> {
  if (!patient.phone) return 0;

  const normalized = normalizePhoneBR(patient.phone);
  const unmatchedLeads = await prisma.lead.findMany({
    where: {
      clinicId: patient.clinicId,
      patientId: null,
      phone: normalized,
    },
  });

  for (const lead of unmatchedLeads) {
    await linkLeadToPatient(lead.id, patient.id);
  }

  return unmatchedLeads.length;
}
