import { Queue, Worker } from "bullmq";
import { logger } from "@/lib/logger";

const log = logger.child({ scope: "sync-clinicorp" });

import { redis } from "@/lib/redis";
import { prisma } from "@/lib/prisma";
import { ClinicorpClient } from "@/lib/clinicorp/client";
import { mapEstimateToProcedures } from "@/lib/clinicorp/procedure-mapper";

export const syncClinicorpQueue = new Queue("sync-clinicorp", {
  connection: redis,
});

// Sync periodico a cada 15 minutos. BullMQ deduplica jobs repetidos pela jobId
// derivada do schedule, entao registrar no boot do worker e idempotente.
syncClinicorpQueue.add(
  "sync",
  {},
  {
    repeat: { every: 15 * 60 * 1000 },
    removeOnComplete: 50,
    removeOnFail: 50,
  },
);

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

        log.info({ clinicId: clinic.id, estimates: estimates.length }, "estimates fetched");

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
                phone: est.PatientMobilePhone ? String(est.PatientMobilePhone) : null,
              },
            });
            patientsCreated++;
          } else {
            await prisma.patient.update({
              where: { id: patient.id },
              data: {
                name: est.PatientName,
                phone: est.PatientMobilePhone ? String(est.PatientMobilePhone) : patient.phone,
              },
            });
          }

          // [DASH-3] Procedures com Deleted='X' no Clinicorp: marca deleted=true
          // no nosso DB tambem (em vez de manter como aprovado/cobrado).
          // Pode ser que ja existam de syncs anteriores.
          for (const proc of est.ProcedureList ?? []) {
            if (proc.Deleted === "X") {
              await prisma.procedure.updateMany({
                where: {
                  clinicId: clinic.id,
                  clinicorpProcedureId: String(proc.id),
                },
                data: { deleted: true },
              });
            }
          }

          // [DASH-3] Mapeia procedures ativos: ratea desconto entre aprovados,
          // captura statusDescription/paymentAccounted. Pula deleted (ja tratados acima).
          const mappedProcs = mapEstimateToProcedures(est);
          for (const m of mappedProcs) {
            const existing = await prisma.procedure.findFirst({
              where: {
                clinicId: clinic.id,
                clinicorpProcedureId: m.clinicorpProcedureId,
              },
            });

            const procData = {
              name: m.name,
              value: m.value,
              discountAmount: m.discountAmount,
              status: m.status,
              statusDescription: m.statusDescription,
              paymentAccounted: m.paymentAccounted,
              completedAt: m.completedAt,
            };

            if (existing) {
              await prisma.procedure.update({
                where: { id: existing.id },
                data: procData,
              });
              proceduresUpdated++;
            } else {
              await prisma.procedure.create({
                data: {
                  ...procData,
                  clinicId: clinic.id,
                  patientId: patient.id,
                  clinicorpProcedureId: m.clinicorpProcedureId,
                  createdAt: m.estimateCreatedAt,
                },
              });
              proceduresCreated++;
            }
          }
        }

        await prisma.clinic.update({
          where: { id: clinic.id },
          data: { lastClinicorpSyncAt: new Date() },
        });

        log.info(
          { clinicId: clinic.id, patientsCreated, proceduresCreated, proceduresUpdated },
          "sync done",
        );
      } catch (error) {
        log.error({ clinicId: clinic.id, err: error }, "sync error for clinic");
      }
    }
  },
  { connection: redis }
);

syncClinicorpWorker.on("failed", (job, err) => {
  log.error({ jobId: job?.id, err: err.message }, "job failed");
});
