import { prisma } from "@/lib/prisma";
import { ClinicorpClient } from "./client";
import { ClinicorpPatient, CreatePatientPayload } from "./types";
import { normalizePhoneBR } from "@/lib/utils/phone";
import { utmsToNote } from "@/lib/utils/utm";
import { UTMData } from "@/types";

export async function createOrUpdateLocalPatient(
  clinicId: string,
  clinicorpPatient: ClinicorpPatient,
  utms: UTMData
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
      ...utms,
    },
    create: {
      clinicId,
      clinicorpPatientId: String(clinicorpPatient.id),
      name: clinicorpPatient.Name,
      phone,
      cpf: clinicorpPatient.OtherDocumentId ?? null,
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
  }
): Promise<ClinicorpPatient> {
  // Try finding by phone first
  if (data.phone) {
    const digits = data.phone.replace(/\D/g, "");
    const existing = await client.findPatient({ phone: digits });
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
    MobilePhone: data.phone
      ? parseInt(data.phone.replace(/\D/g, ""), 10)
      : undefined,
    Notes: utmsToNote(data.utms),
    IgnoreSameName: "true",
  };

  return client.createPatient(payload);
}
