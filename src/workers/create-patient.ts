import { Queue, Worker } from "bullmq";
import { redis } from "@/lib/redis";
import { prisma } from "@/lib/prisma";
import {
  matchLeadToPatient,
  linkLeadToPatient,
} from "@/lib/matching/lead-patient";
import { ClinicorpClient } from "@/lib/clinicorp/client";
import {
  createOrUpdateLocalPatient,
  findOrCreatePatientInClinicorp,
} from "@/lib/clinicorp/patient";
import { createAppointmentInClinicorp } from "@/lib/clinicorp/appointment";

export const createPatientQueue = new Queue("create-patient", {
  connection: redis,
});

export const createPatientWorker = new Worker(
  "create-patient",
  async (job) => {
    const { leadId } = job.data;

    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      include: { clinic: true },
    });

    if (!lead) throw new Error(`Lead not found: ${leadId}`);
    if (lead.patientId) return; // Already matched

    // 1. Try matching with existing local patient
    const existingPatient = await matchLeadToPatient(lead);
    if (existingPatient) {
      await linkLeadToPatient(lead.id, existingPatient.id);
      await prisma.lead.update({
        where: { id: lead.id },
        data: { isNewPatient: false },
      });
      console.log(
        `[create-patient] Lead ${lead.name} matched to existing patient ${existingPatient.name} (returning)`
      );
      return;
    }

    // 2. If clinic has Clinicorp configured AND auto-create enabled
    const { clinic } = lead;
    if (!clinic.clinicorpUser || !clinic.clinicorpToken) {
      console.log(
        `[create-patient] Clinic ${clinic.name} has no Clinicorp config, skipping`
      );
      return;
    }

    const clinicorpClient = new ClinicorpClient({
      user: clinic.clinicorpUser,
      token: clinic.clinicorpToken,
      subscriberId: clinic.clinicorpUser,
    });

    // Check Clinicorp for existing patient to classify new vs returning
    let existsInClinicorp = false;
    if (lead.phone) {
      const digits = lead.phone.replace(/\D/g, "");
      const found = await clinicorpClient.findPatient({ phone: digits });
      if (found) existsInClinicorp = true;
    }
    if (!existsInClinicorp && lead.email) {
      const found = await clinicorpClient.findPatient({ email: lead.email });
      if (found) existsInClinicorp = true;
    }

    await prisma.lead.update({
      where: { id: lead.id },
      data: { isNewPatient: !existsInClinicorp },
    });
    console.log(
      `[create-patient] Lead "${lead.name}" classified as ${existsInClinicorp ? "RETURNING" : "NEW"} patient`
    );

    if (!clinic.clinicorpAutoCreatePatient) {
      console.log(
        `[create-patient] Clinic ${clinic.name} has auto-create disabled, skipping Clinicorp`
      );
      return;
    }

    // Validate required fields
    const missingFields: string[] = [];
    if (!lead.name || lead.name.trim() === "") missingFields.push("name");
    if (!lead.phone) missingFields.push("phone");
    if (!lead.email) missingFields.push("email");

    if (missingFields.length > 0) {
      console.warn(
        `[create-patient] Lead "${lead.name}" missing: ${missingFields.join(", ")}. Skipping Clinicorp.`
      );
      if (lead.phone || lead.email) {
        const localPatient = await prisma.patient.create({
          data: {
            clinicId: lead.clinicId,
            name: lead.name,
            phone: lead.phone,
          },
        });
        await linkLeadToPatient(lead.id, localPatient.id);
      }
      return;
    }

    const utms = {
      utmSource: lead.utmSource ?? undefined,
      utmMedium: lead.utmMedium ?? undefined,
      utmCampaign: lead.utmCampaign ?? undefined,
      utmContent: lead.utmContent ?? undefined,
      utmTerm: lead.utmTerm ?? undefined,
    };

    const clinicorpPatient = await findOrCreatePatientInClinicorp(
      clinicorpClient,
      clinic.clinicorpUser,
      {
        name: lead.name,
        phone: lead.phone ?? undefined,
        email: lead.email ?? undefined,
        utms,
        canalProspeccao: lead.canalProspeccao,
      }
    );

    const patient = await createOrUpdateLocalPatient(
      lead.clinicId,
      clinicorpPatient,
      utms,
      lead.canalProspeccao
    );

    await linkLeadToPatient(lead.id, patient.id);
    console.log(
      `[create-patient] Lead ${lead.name} → Patient ${clinicorpPatient.Name} (Clinicorp #${clinicorpPatient.id})`
    );

    // Create appointment if we have date/time data
    if (lead.appointmentDate && lead.appointmentTime) {
      const businessId = clinic.clinicorpBusinessId
        ? parseInt(clinic.clinicorpBusinessId, 10)
        : null;
      const professionalId = lead.appointmentProfId
        ? parseInt(lead.appointmentProfId, 10)
        : null;

      if (businessId && professionalId) {
        const appointment = await createAppointmentInClinicorp(
          clinicorpClient,
          {
            patientId: clinicorpPatient.id,
            patientName: clinicorpPatient.Name,
            phone: lead.phone ?? undefined,
            email: lead.email ?? undefined,
            date: lead.appointmentDate,
            time: lead.appointmentTime,
            businessId,
            professionalId,
          }
        );
        if (appointment) {
          await prisma.lead.update({
            where: { id: lead.id },
            data: { clinicorpAppointmentId: String(appointment.id) },
          });
        }
      } else {
        console.warn(
          `[create-patient] Cannot create appointment for "${lead.name}": missing businessId or professionalId`
        );
      }
    }
  },
  { connection: redis, concurrency: 5 }
);

createPatientWorker.on("completed", (job) => {
  console.log(`[create-patient] Job ${job.id} completed`);
});

createPatientWorker.on("failed", (job, err) => {
  console.error(`[create-patient] Job ${job?.id} failed:`, err.message);
});
