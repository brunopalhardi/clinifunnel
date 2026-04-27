import { prisma } from "@/lib/prisma";
import { Lead, Patient } from "@prisma/client";
import { phoneMatchKey } from "@/lib/utils/phone";

export async function matchLeadToPatient(
  lead: Lead
): Promise<Patient | null> {
  // 1. Match by phone using normalized key (DDD + last 8 digits)
  const leadKey = phoneMatchKey(lead.phone);
  if (leadKey) {
    const patients = await prisma.patient.findMany({
      where: { clinicId: lead.clinicId },
    });
    const match = patients.find((p) => phoneMatchKey(p.phone) === leadKey);
    if (match) return match;
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
  const patientKey = phoneMatchKey(patient.phone);
  if (!patientKey) return 0;

  const unmatchedLeads = await prisma.lead.findMany({
    where: {
      clinicId: patient.clinicId,
      patientId: null,
    },
  });

  let count = 0;
  for (const lead of unmatchedLeads) {
    if (phoneMatchKey(lead.phone) === patientKey) {
      await linkLeadToPatient(lead.id, patient.id);
      count++;
    }
  }

  return count;
}
