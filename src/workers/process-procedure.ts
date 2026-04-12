import { Queue, Worker } from "bullmq";
import { redis } from "@/lib/redis";
import { prisma } from "@/lib/prisma";
import { normalizePhoneBR } from "@/lib/utils/phone";
import { matchPatientToLeads } from "@/lib/matching/lead-patient";

export const processProcedureQueue = new Queue("process-procedure", {
  connection: redis,
});

interface ProcedureJobData {
  clinicId: string;
  event: string;
  payload: {
    procedureId?: string;
    patientId?: string;
    patientName?: string;
    patientPhone?: string;
    procedureName?: string;
    value?: number;
    status?: string;
    completedAt?: string;
  };
}

export const processProcedureWorker = new Worker<ProcedureJobData>(
  "process-procedure",
  async (job) => {
    const { clinicId, event, payload } = job.data;

    // 1. Find or create local patient
    let patient = null;

    if (payload.patientId) {
      patient = await prisma.patient.findFirst({
        where: {
          clinicId,
          clinicorpPatientId: payload.patientId,
        },
      });
    }

    // Try matching by phone if no clinicorpPatientId match
    if (!patient && payload.patientPhone) {
      const normalized = normalizePhoneBR(payload.patientPhone);
      patient = await prisma.patient.findFirst({
        where: { clinicId, phone: normalized },
      });
    }

    // Create patient locally if not found
    if (!patient) {
      patient = await prisma.patient.create({
        data: {
          clinicId,
          clinicorpPatientId: payload.patientId ?? null,
          name: payload.patientName ?? "Paciente desconhecido",
          phone: payload.patientPhone
            ? normalizePhoneBR(payload.patientPhone)
            : null,
        },
      });
      console.log(
        `[process-procedure] Created local patient: ${patient.name}`
      );
    }

    // 2. Auto-match: vincular paciente a leads existentes por telefone
    const matchedCount = await matchPatientToLeads(patient);
    if (matchedCount > 0) {
      console.log(
        `[process-procedure] Auto-matched ${matchedCount} lead(s) to patient ${patient.name}`
      );
    }

    // 3. Map Clinicorp status to our status
    const statusMap: Record<string, string> = {
      pending: "pending",
      scheduled: "pending",
      confirmed: "approved",
      approved: "approved",
      in_progress: "approved",
      completed: "completed",
      done: "completed",
      finished: "completed",
      cancelled: "cancelled",
      canceled: "cancelled",
      no_show: "cancelled",
    };

    const normalizedStatus =
      statusMap[(payload.status ?? "pending").toLowerCase()] ?? "pending";

    // 4. Upsert procedure
    if (payload.procedureId) {
      await prisma.procedure.upsert({
        where: {
          id: await findProcedureId(clinicId, payload.procedureId),
        },
        update: {
          name: payload.procedureName ?? "Procedimento",
          value: payload.value ?? 0,
          status: normalizedStatus,
          completedAt:
            normalizedStatus === "completed"
              ? payload.completedAt
                ? new Date(payload.completedAt)
                : new Date()
              : null,
        },
        create: {
          clinicId,
          patientId: patient.id,
          clinicorpProcedureId: payload.procedureId,
          name: payload.procedureName ?? "Procedimento",
          value: payload.value ?? 0,
          status: normalizedStatus,
          completedAt:
            normalizedStatus === "completed"
              ? payload.completedAt
                ? new Date(payload.completedAt)
                : new Date()
              : null,
        },
      });
    } else {
      await prisma.procedure.create({
        data: {
          clinicId,
          patientId: patient.id,
          name: payload.procedureName ?? "Procedimento",
          value: payload.value ?? 0,
          status: normalizedStatus,
          completedAt:
            normalizedStatus === "completed" ? new Date() : null,
        },
      });
    }

    console.log(
      `[process-procedure] ${event}: ${payload.procedureName} for ${patient.name} (${normalizedStatus}, R$ ${payload.value ?? 0})`
    );
  },
  {
    connection: redis,
    concurrency: 5,
  }
);

async function findProcedureId(
  clinicId: string,
  clinicorpProcedureId: string
): Promise<string> {
  const existing = await prisma.procedure.findFirst({
    where: { clinicId, clinicorpProcedureId },
    select: { id: true },
  });
  // Return existing id or a placeholder that will cause upsert to create
  return existing?.id ?? "nonexistent-will-create";
}

processProcedureWorker.on("completed", (job) => {
  console.log(`[process-procedure] Job ${job.id} completed`);
});

processProcedureWorker.on("failed", (job, err) => {
  console.error(`[process-procedure] Job ${job?.id} failed:`, err.message);
});
