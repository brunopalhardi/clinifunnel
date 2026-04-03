import { Queue, Worker } from "bullmq";
import { redis } from "@/lib/redis";
import { prisma } from "@/lib/prisma";
import { ClinicorpClient } from "@/lib/clinicorp/client";

export const syncClinicorpQueue = new Queue("sync-clinicorp", {
  connection: redis,
});

export const syncClinicorpWorker = new Worker(
  "sync-clinicorp",
  async () => {
    const clinics = await prisma.clinic.findMany({
      where: {
        clinicorpToken: { not: null },
        clinicorpOAuth: { not: undefined },
      },
    });

    for (const clinic of clinics) {
      try {
        const client = new ClinicorpClient({
          tokens: clinic.clinicorpOAuth as {
            accessToken: string;
            refreshToken: string;
            expiresAt: number;
          },
          clientId: process.env.CLINICORP_CLIENT_ID || "",
          clientSecret: process.env.CLINICORP_CLIENT_SECRET || "",
          onTokenRefresh: async (tokens) => {
            await prisma.clinic.update({
              where: { id: clinic.id },
              data: { clinicorpOAuth: tokens as unknown as object },
            });
          },
        });

        // Get patients that have UTMs (came from leads)
        const patients = await prisma.patient.findMany({
          where: {
            clinicId: clinic.id,
            clinicorpPatientId: { not: null },
            utmSource: { not: null },
          },
        });

        for (const patient of patients) {
          if (!patient.clinicorpPatientId) continue;

          const procedures = await client.getPatientProcedures(
            patient.clinicorpPatientId
          );

          for (const proc of procedures) {
            await prisma.procedure.upsert({
              where: {
                id: proc.id,
              },
              update: {
                name: proc.name,
                value: proc.value,
                status: proc.status,
                completedAt: proc.completedAt
                  ? new Date(proc.completedAt)
                  : null,
              },
              create: {
                clinicId: clinic.id,
                patientId: patient.id,
                clinicorpProcedureId: proc.id,
                name: proc.name,
                value: proc.value,
                status: proc.status,
                completedAt: proc.completedAt
                  ? new Date(proc.completedAt)
                  : null,
              },
            });
          }
        }
      } catch (error) {
        console.error(
          `[sync-clinicorp] Error syncing clinic ${clinic.id}:`,
          error
        );
      }
    }
  },
  { connection: redis }
);

syncClinicorpWorker.on("failed", (job, err) => {
  console.error(`[sync-clinicorp] Job ${job?.id} failed:`, err.message);
});
