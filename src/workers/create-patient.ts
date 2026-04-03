import { Queue, Worker } from "bullmq";
import { redis } from "@/lib/redis";
import { prisma } from "@/lib/prisma";
import { matchLeadToPatient, linkLeadToPatient } from "@/lib/matching/lead-patient";
import { ClinicorpClient } from "@/lib/clinicorp/client";
import { createOrUpdateLocalPatient, createPatientInClinicorp } from "@/lib/clinicorp/patient";

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
      return;
    }

    // 2. If clinic has Clinicorp configured, create patient there
    if (lead.clinic.clinicorpOAuth && lead.clinic.clinicorpToken) {
      const clinicorpClient = new ClinicorpClient({
        tokens: lead.clinic.clinicorpOAuth as {
          accessToken: string;
          refreshToken: string;
          expiresAt: number;
        },
        clientId: process.env.CLINICORP_CLIENT_ID || "",
        clientSecret: process.env.CLINICORP_CLIENT_SECRET || "",
        onTokenRefresh: async (tokens) => {
          await prisma.clinic.update({
            where: { id: lead.clinicId },
            data: { clinicorpOAuth: tokens as unknown as object },
          });
        },
      });

      // Try finding patient in Clinicorp by phone
      let clinicorpPatient = lead.phone
        ? await clinicorpClient.findPatientByPhone(lead.phone)
        : null;

      // If not found, create new patient in Clinicorp
      if (!clinicorpPatient) {
        const utms = {
          utmSource: lead.utmSource ?? undefined,
          utmMedium: lead.utmMedium ?? undefined,
          utmCampaign: lead.utmCampaign ?? undefined,
          utmContent: lead.utmContent ?? undefined,
          utmTerm: lead.utmTerm ?? undefined,
        };

        clinicorpPatient = await createPatientInClinicorp(clinicorpClient, {
          name: lead.name,
          phone: lead.phone ?? undefined,
          email: lead.email ?? undefined,
          utms,
        });
      }

      // Save/update local patient record
      const patient = await createOrUpdateLocalPatient(
        lead.clinicId,
        clinicorpPatient,
        {
          utmSource: lead.utmSource ?? undefined,
          utmMedium: lead.utmMedium ?? undefined,
          utmCampaign: lead.utmCampaign ?? undefined,
          utmContent: lead.utmContent ?? undefined,
          utmTerm: lead.utmTerm ?? undefined,
        }
      );

      await linkLeadToPatient(lead.id, patient.id);
    }
  },
  { connection: redis, concurrency: 5 }
);

createPatientWorker.on("failed", (job, err) => {
  console.error(`[create-patient] Job ${job?.id} failed:`, err.message);
});
