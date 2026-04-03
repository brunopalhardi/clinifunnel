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
        clinicorpUser: { not: null },
        clinicorpToken: { not: null },
      },
    });

    for (const clinic of clinics) {
      if (!clinic.clinicorpUser || !clinic.clinicorpToken) continue;

      try {
        const client = new ClinicorpClient({
          user: clinic.clinicorpUser,
          token: clinic.clinicorpToken,
          subscriberId: clinic.clinicorpUser,
        });

        // Sync patients that have UTMs (came from leads)
        const patients = await prisma.patient.findMany({
          where: {
            clinicId: clinic.id,
            clinicorpPatientId: { not: null },
            utmSource: { not: null },
          },
        });

        for (const patient of patients) {
          if (!patient.clinicorpPatientId || !clinic.clinicorpBusinessId)
            continue;

          const appointments = await client.listAppointments({
            from: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
              .toISOString()
              .split("T")[0],
            to: new Date().toISOString().split("T")[0],
            businessId: parseInt(clinic.clinicorpBusinessId, 10),
            patientId: patient.clinicorpPatientId,
          });

          console.log(
            `[sync-clinicorp] Patient ${patient.name}: ${appointments.length} appointments`
          );
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
