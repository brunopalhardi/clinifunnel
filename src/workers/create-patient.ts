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
      console.log(
        `[create-patient] Lead ${lead.name} matched to existing patient ${existingPatient.name}`
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

    if (!clinic.clinicorpAutoCreatePatient) {
      console.log(
        `[create-patient] Clinic ${clinic.name} has auto-create disabled, skipping Clinicorp`
      );
      return;
    }

    const clinicorpClient = new ClinicorpClient({
      user: clinic.clinicorpUser,
      token: clinic.clinicorpToken,
      subscriberId: clinic.clinicorpUser,
    });

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
      }
    );

    const patient = await createOrUpdateLocalPatient(
      lead.clinicId,
      clinicorpPatient,
      utms
    );

    await linkLeadToPatient(lead.id, patient.id);
    console.log(
      `[create-patient] Lead ${lead.name} → Patient ${clinicorpPatient.Name} (Clinicorp #${clinicorpPatient.id})`
    );
  },
  { connection: redis, concurrency: 5 }
);

createPatientWorker.on("completed", (job) => {
  console.log(`[create-patient] Job ${job.id} completed`);
});

createPatientWorker.on("failed", (job, err) => {
  console.error(`[create-patient] Job ${job?.id} failed:`, err.message);
});
