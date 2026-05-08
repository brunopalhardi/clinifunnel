import { prisma } from "@/lib/prisma";
import { ClinicorpClient } from "./client";
import { ClinicorpPatient, CreatePatientPayload } from "./types";
import { normalizePhoneBR, phoneToClinicorp } from "@/lib/utils/phone";
import { utmsToNote } from "@/lib/utils/utm";
import { UTMData } from "@/types";

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
  // Telefone formatado pra Clinicorp: sem DDI (55), 10-11 digitos.
  const clinicorpPhone = phoneToClinicorp(data.phone);

  // Try finding by phone first
  if (clinicorpPhone) {
    const existing = await client.findPatient({ phone: clinicorpPhone });
    if (existing) return existing;
  }

  // Try finding by email
  if (data.email) {
    const existing = await client.findPatient({ email: data.email });
    if (existing) return existing;
  }

  // Create new patient
  const payload: CreatePatientPayload = {
    subscriber_id: subscriberId,
    Name: data.name,
    Email: data.email,
    MobilePhone: clinicorpPhone ? parseInt(clinicorpPhone, 10) : undefined,
    Notes: utmsToNote(data.utms, data.canalProspeccao),
    IgnoreSameName: "true",
  };

  return client.createPatient(payload);
}
