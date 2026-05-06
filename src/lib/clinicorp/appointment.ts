import { ClinicorpClient } from "./client";
import { CreateAppointmentPayload } from "./types";
import { logger } from "@/lib/logger";

const log = logger.child({ scope: "clinicorp-appointment" });

export async function createAppointmentInClinicorp(
  client: ClinicorpClient,
  params: {
    patientId: number;
    patientName: string;
    phone?: string;
    email?: string;
    date: string;
    time: string;
    businessId: number;
    professionalId: number;
    duration?: number;
  }
): Promise<{ id: number } | null> {
  const durationMinutes = params.duration ?? 60;
  const [hours, minutes] = params.time.split(":").map(Number);
  const endMinutes = hours * 60 + minutes + durationMinutes;
  const toTime = `${String(Math.floor(endMinutes / 60)).padStart(2, "0")}:${String(endMinutes % 60).padStart(2, "0")}`;

  const payload: CreateAppointmentPayload = {
    Patient_PersonId: params.patientId,
    PatientName: params.patientName,
    MobilePhone: params.phone,
    Email: params.email,
    date: params.date,
    fromTime: params.time,
    toTime,
    Clinic_BusinessId: params.businessId,
    Dentist_PersonId: params.professionalId,
  };

  try {
    const appointment = await client.createAppointment(payload);
    log.info(
      { patientId: params.patientId, date: params.date, time: params.time },
      "appointment created",
    );
    return appointment;
  } catch (error) {
    log.error(
      { patientId: params.patientId, err: error instanceof Error ? error.message : error },
      "failed to create appointment",
    );
    return null;
  }
}
