import { Queue, Worker } from "bullmq";
import { redis } from "@/lib/redis";
import { prisma } from "@/lib/prisma";

const PROCEDURE_INTERVALS: Record<string, number> = {
  botox: 120,
  toxina: 120,
  preenchimento: 240,
  filler: 240,
  bioestimulador: 365,
};

function getReturnIntervalDays(procedureName: string): number | null {
  const lower = procedureName.toLowerCase();
  for (const [key, days] of Object.entries(PROCEDURE_INTERVALS)) {
    if (lower.includes(key)) return days;
  }
  return null;
}

export const checkRemindersQueue = new Queue("check-reminders", {
  connection: redis,
});

export const checkRemindersWorker = new Worker(
  "check-reminders",
  async (job) => {
    const { clinicId } = job.data;

    const procedures = await prisma.procedure.findMany({
      where: {
        clinicId,
        status: "completed",
        completedAt: { not: null },
      },
      include: {
        patient: { select: { id: true, name: true, phone: true } },
      },
      orderBy: { completedAt: "desc" },
    });

    const now = new Date();
    let reminderCount = 0;

    for (const proc of procedures) {
      const intervalDays = getReturnIntervalDays(proc.name);
      if (!intervalDays || !proc.completedAt) continue;

      const dueDate = new Date(proc.completedAt.getTime() + intervalDays * 24 * 60 * 60 * 1000);
      const daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

      if (daysOverdue >= -30) reminderCount++;
    }

    console.log(`[check-reminders] Found ${reminderCount} pending reminders for clinic ${clinicId}`);
  },
  { connection: redis, concurrency: 1 }
);

checkRemindersWorker.on("completed", (job) => {
  console.log(`[check-reminders] Job ${job.id} completed`);
});

checkRemindersWorker.on("failed", (job, err) => {
  console.error(`[check-reminders] Job ${job?.id} failed:`, err.message);
});
