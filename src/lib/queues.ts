import { Queue } from "bullmq";
import { redis } from "@/lib/redis";

const queues = new Map<string, Queue>();

function getQueue(name: string): Queue {
  let queue = queues.get(name);
  if (!queue) {
    queue = new Queue(name, { connection: redis });
    queues.set(name, queue);
  }
  return queue;
}

export function getCreatePatientQueue() {
  return getQueue("create-patient");
}

export function getProcessProcedureQueue() {
  return getQueue("process-procedure");
}

export function getMatchLeadsQueue() {
  return getQueue("match-leads");
}

export function getSyncClinicorpQueue() {
  return getQueue("sync-clinicorp");
}

// Lista canonica das filas conhecidas. Usada por /api/admin/queues e
// futuras features de monitoramento. Nomes batem com o `name` passado pra
// `new Queue()` em cada worker.
export const QUEUE_NAMES = [
  "create-patient",
  "process-procedure",
  "match-leads",
  "sync-clinicorp",
  "sync-meta-ads",
  "sync-google-ads",
  "webhook-log-cleanup",
] as const;

export type QueueName = (typeof QUEUE_NAMES)[number];

// Retorna instancias Queue de cada uma. Sob a hood usa o cache de getQueue().
export function getAllQueues(): { name: QueueName; queue: Queue }[] {
  return QUEUE_NAMES.map((name) => ({ name, queue: getQueue(name) }));
}
