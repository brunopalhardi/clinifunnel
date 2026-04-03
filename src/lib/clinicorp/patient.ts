import { prisma } from "@/lib/prisma";
import { ClinicorpClient } from "./client";
import { ClinicorpPatient, CreatePatientPayload } from "./types";
import { normalizePhoneBR } from "@/lib/utils/phone";
import { utmsToNote, utmsToTags } from "@/lib/utils/utm";
import { UTMData } from "@/types";

export async function createOrUpdateLocalPatient(
  clinicId: string,
  clinicorpPatient: ClinicorpPatient,
  utms: UTMData
) {
  return prisma.patient.upsert({
    where: {
      clinicId_clinicorpPatientId: {
        clinicId,
        clinicorpPatientId: clinicorpPatient.id,
      },
    },
    update: {
      name: clinicorpPatient.name,
      phone: clinicorpPatient.phone
        ? normalizePhoneBR(clinicorpPatient.phone)
        : undefined,
      cpf: clinicorpPatient.cpf,
      ...utms,
    },
    create: {
      clinicId,
      clinicorpPatientId: clinicorpPatient.id,
      name: clinicorpPatient.name,
      phone: clinicorpPatient.phone
        ? normalizePhoneBR(clinicorpPatient.phone)
        : null,
      cpf: clinicorpPatient.cpf,
      ...utms,
    },
  });
}

export async function createPatientInClinicorp(
  client: ClinicorpClient,
  data: {
    name: string;
    phone?: string;
    email?: string;
    cpf?: string;
    utms: UTMData;
  }
): Promise<ClinicorpPatient> {
  const payload: CreatePatientPayload = {
    name: data.name,
    phone: data.phone,
    email: data.email,
    cpf: data.cpf,
    tags: utmsToTags(data.utms),
    notes: utmsToNote(data.utms),
  };

  return client.createPatient(payload);
}
