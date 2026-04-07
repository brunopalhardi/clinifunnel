import { Queue, Worker } from "bullmq";
import { redis } from "@/lib/redis";
import { prisma } from "@/lib/prisma";
import { ClinicorpClient } from "@/lib/clinicorp/client";

export const syncClinicorpQueue = new Queue("sync-clinicorp", {
  connection: redis,
});

function mapStatus(estimateStatus: string, executed: boolean): string {
  if (executed) return "completed";
  switch (estimateStatus.toUpperCase()) {
    case "APPROVED":
      return "approved";
    case "CANCELED":
      return "cancelled";
    default:
      return "pending";
  }
}

export const syncClinicorpWorker = new Worker(
  "sync-clinicorp",
  async () => {
    const clinics = await prisma.clinic.findMany({
      where: {
        clinicorpUser: { not: null },
        clinicorpToken: { not: null },
        clinicorpBusinessId: { not: null },
      },
    });

    for (const clinic of clinics) {
      if (!clinic.clinicorpUser || !clinic.clinicorpToken || !clinic.clinicorpBusinessId) continue;

      try {
        const client = new ClinicorpClient({
          user: clinic.clinicorpUser,
          token: clinic.clinicorpToken,
          subscriberId: clinic.clinicorpUser,
        });

        const from = new Date();
        from.setDate(from.getDate() - 30);
        const fromStr = from.toISOString().split("T")[0];
        const toStr = new Date().toISOString().split("T")[0];

        const estimates = await client.listEstimates({
          from: fromStr,
          to: toStr,
          clinicId: clinic.clinicorpBusinessId,
        });

        console.log(`[sync-clinicorp] Clinic ${clinic.name}: ${estimates.length} estimates`);

        let patientsCreated = 0;
        let proceduresCreated = 0;
        let proceduresUpdated = 0;

        for (const est of estimates) {
          // Upsert patient by clinicorpPatientId
          let patient = await prisma.patient.findFirst({
            where: {
              clinicId: clinic.id,
              clinicorpPatientId: String(est.PatientId),
            },
          });

          if (!patient) {
            patient = await prisma.patient.create({
              data: {
                clinicId: clinic.id,
                clinicorpPatientId: String(est.PatientId),
                name: est.PatientName,
                phone: est.PatientMobilePhone || null,
              },
            });
            patientsCreated++;
          } else {
            await prisma.patient.update({
              where: { id: patient.id },
              data: {
                name: est.PatientName,
                phone: est.PatientMobilePhone || patient.phone,
              },
            });
          }

          // Sync procedures from estimate
          for (const proc of est.ProcedureList) {
            const procId = String(proc.id);
            const isExecuted = proc.Executed === "X";
            const status = mapStatus(est.Status, isExecuted);
            const completedAt = proc.ExecutedDate ? new Date(proc.ExecutedDate) : null;

            const existing = await prisma.procedure.findFirst({
              where: {
                clinicId: clinic.id,
                clinicorpProcedureId: procId,
              },
            });

            if (existing) {
              await prisma.procedure.update({
                where: { id: existing.id },
                data: {
                  name: proc.OperationDescription,
                  value: proc.FinalAmount || proc.Amount,
                  status,
                  completedAt,
                },
              });
              proceduresUpdated++;
            } else {
              await prisma.procedure.create({
                data: {
                  clinicId: clinic.id,
                  patientId: patient.id,
                  clinicorpProcedureId: procId,
                  name: proc.OperationDescription,
                  value: proc.FinalAmount || proc.Amount,
                  status,
                  completedAt,
                  createdAt: new Date(est.CreateDate),
                },
              });
              proceduresCreated++;
            }
          }
        }

        console.log(
          `[sync-clinicorp] Done: ${patientsCreated} patients created, ${proceduresCreated} procedures created, ${proceduresUpdated} updated`
        );
      } catch (error) {
        console.error(`[sync-clinicorp] Error syncing clinic ${clinic.id}:`, error);
      }
    }
  },
  { connection: redis }
);

syncClinicorpWorker.on("failed", (job, err) => {
  console.error(`[sync-clinicorp] Job ${job?.id} failed:`, err.message);
});
