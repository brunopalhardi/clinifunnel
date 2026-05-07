import { Queue, Worker } from "bullmq";
import { redis } from "@/lib/redis";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

const log = logger.child({ scope: "create-patient" });
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
import { resolveProfessionalId } from "@/lib/clinicorp/professional-map";

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
      log.info(
        { leadId: lead.id, patientId: existingPatient.id, clinicId: lead.clinicId },
        "lead matched to existing patient (returning)",
      );
      return;
    }

    // 2. If clinic has Clinicorp configured AND auto-create enabled
    const { clinic } = lead;
    if (!clinic.clinicorpUser || !clinic.clinicorpToken) {
      log.info(
        { clinicId: clinic.id },
        "clinic without clinicorp config, skipping",
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
    log.info(
      { leadId: lead.id, classification: existsInClinicorp ? "returning" : "new" },
      "lead classified",
    );

    if (!clinic.clinicorpAutoCreatePatient) {
      log.info(
        { clinicId: clinic.id },
        "auto-create disabled, skipping clinicorp",
      );
      return;
    }

    // Validate required fields
    const missingFields: string[] = [];
    if (!lead.name || lead.name.trim() === "") missingFields.push("name");
    if (!lead.phone) missingFields.push("phone");
    if (!lead.email) missingFields.push("email");

    if (missingFields.length > 0) {
      log.warn(
        { leadId: lead.id, missingFields },
        "missing required fields, skipping clinicorp",
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
    log.info(
      {
        leadId: lead.id,
        patientId: patient.id,
        clinicorpPatientId: clinicorpPatient.id,
      },
      "lead linked to clinicorp patient",
    );

    // Create appointment if we have date/time data
    if (lead.appointmentDate && lead.appointmentTime) {
      const businessId = clinic.clinicorpBusinessId
        ? parseInt(clinic.clinicorpBusinessId, 10)
        : null;
      const professionalId = resolveProfessionalId(
        lead.appointmentProfId,
        clinic.professionalMap,
      );

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
        log.warn(
          {
            leadId: lead.id,
            hasBusinessId: !!businessId,
            hasProfessionalId: !!professionalId,
            kommoProfValue: lead.appointmentProfId,
          },
          professionalId === null && lead.appointmentProfId
            ? "cannot create appointment: ATENDIDO POR sem mapeamento em Clinic.professionalMap"
            : "cannot create appointment: missing businessId or professionalId",
        );
      }
    }
  },
  { connection: redis, concurrency: 5 }
);

createPatientWorker.on("completed", (job) => {
  log.info({ jobId: job.id }, "job completed");
});

createPatientWorker.on("failed", (job, err) => {
  log.error({ jobId: job?.id, err: err.message }, "job failed");
});
