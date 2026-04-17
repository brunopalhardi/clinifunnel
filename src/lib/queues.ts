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

export function getCheckRemindersQueue() {
  return getQueue("check-reminders");
}
