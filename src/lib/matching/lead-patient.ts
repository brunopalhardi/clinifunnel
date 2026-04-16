import { prisma } from "@/lib/prisma";
import { Lead, Patient } from "@prisma/client";

export async function matchLeadToPatient(
  lead: Lead
): Promise<Patient | null> {
  // 1. Match by phone (last 8 digits to handle format differences)
  if (lead.phone) {
    const digits = lead.phone.replace(/\D/g, "");
    const last8 = digits.slice(-8);
    if (last8.length === 8) {
      const patient = await prisma.patient.findFirst({
        where: {
          clinicId: lead.clinicId,
          phone: { endsWith: last8 },
        },
      });
      if (patient) return patient;
    }
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

  const digits = patient.phone.replace(/\D/g, "");
  const last8 = digits.slice(-8);
  if (last8.length < 8) return 0;

  const unmatchedLeads = await prisma.lead.findMany({
    where: {
      clinicId: patient.clinicId,
      patientId: null,
      phone: { endsWith: last8 },
    },
  });

  for (const lead of unmatchedLeads) {
    await linkLeadToPatient(lead.id, patient.id);
  }

  return unmatchedLeads.length;
}
