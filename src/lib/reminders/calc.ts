import type {
  ComputeRemindersInput,
  ProcedureForReminder,
  RecallIntervalForCalc,
  Reminder,
  ReminderActionRecord,
  ReminderUrgency,
} from "./types";

const MS_PER_DAY = 86400000;

function daysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / MS_PER_DAY);
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * MS_PER_DAY);
}

function addMonths(d: Date, n: number): Date {
  const out = new Date(d.getTime());
  out.setMonth(out.getMonth() + n);
  return out;
}

function urgencyOf(daysUntilDue: number): ReminderUrgency {
  if (daysUntilDue < 0) return "overdue";
  if (daysUntilDue <= 7) return "urgent";
  return "upcoming";
}

function matchRecallInterval(
  procedureName: string,
  intervals: RecallIntervalForCalc[]
): number | null {
  const lower = procedureName.toLowerCase();
  let best: number | null = null;
  for (const i of intervals) {
    if (lower.includes(i.procedureNamePattern.toLowerCase())) {
      if (best === null || i.days > best) best = i.days;
    }
  }
  return best;
}

function buildKey(type: "recall" | "inactive" | "postconsulta", patientId: string, procedureId: string | null): string {
  return procedureId ? `${type}:${patientId}:${procedureId}` : `${type}:${patientId}`;
}

function describeRecall(procedureName: string, daysUntilDue: number): string {
  if (daysUntilDue < 0) return `${procedureName} vencido ha ${-daysUntilDue} dias`;
  if (daysUntilDue === 0) return `${procedureName} vence hoje`;
  return `${procedureName} vence em ${daysUntilDue} dias`;
}

function describeInactive(daysSinceLast: number): string {
  const months = Math.floor(daysSinceLast / 30);
  if (months <= 1) return `Inativo ha ${daysSinceLast} dias`;
  return `Inativo ha ${months} meses`;
}

function describePostConsulta(procedureName: string, daysUntilDue: number): string {
  if (daysUntilDue < 0) return `Pos-consulta de ${procedureName} venceu ha ${-daysUntilDue} dias`;
  if (daysUntilDue === 0) return `Pos-consulta de ${procedureName} hoje`;
  return `Pos-consulta de ${procedureName} em ${daysUntilDue} dias`;
}

function isReminderConsumed(reminder: Reminder, actions: ReminderActionRecord[], now: Date): boolean {
  const own = actions
    .filter((a) => a.reminderKey === reminder.key)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  if (own.length === 0) return false;
  const last = own[0];
  if (last.action === "TRATADO" || last.action === "DISPENSADO") return true;
  if (last.action === "ADIADO" && last.snoozeUntil && last.snoozeUntil > now) return true;
  return false;
}

function groupLatestProcByPatient(procs: ProcedureForReminder[]): Map<string, ProcedureForReminder> {
  const out = new Map<string, ProcedureForReminder>();
  for (const p of procs) {
    const prev = out.get(p.patient.id);
    if (!prev || p.completedAt > prev.completedAt) out.set(p.patient.id, p);
  }
  return out;
}

export function computeReminders(input: ComputeRemindersInput): Reminder[] {
  const now = input.now ?? new Date();
  const all: Reminder[] = [];

  // 1. Recall por procedimento
  for (const proc of input.procedures) {
    const days = matchRecallInterval(proc.name, input.recallIntervals);
    if (days === null) continue;
    const dueDate = addDays(proc.completedAt, days);
    const daysUntilDue = daysBetween(now, dueDate);
    if (daysUntilDue > 30) continue;
    all.push({
      key: buildKey("recall", proc.patient.id, proc.id),
      type: "recall",
      patientId: proc.patient.id,
      patientName: proc.patient.name,
      patientPhone: proc.patient.phone,
      procedureId: proc.id,
      procedureName: proc.name,
      baseDate: proc.completedAt,
      dueDate,
      daysUntilDue,
      urgency: urgencyOf(daysUntilDue),
      description: describeRecall(proc.name, daysUntilDue),
    });
  }

  // 2. Paciente inativo (1 por patient, pega o procedure mais recente)
  const latest = groupLatestProcByPatient(input.procedures);
  const threshold = addMonths(now, -input.inactiveMonths);
  const latestEntries = Array.from(latest.values());
  for (const lastProc of latestEntries) {
    if (lastProc.completedAt < threshold) {
      const daysSince = daysBetween(lastProc.completedAt, now);
      all.push({
        key: buildKey("inactive", lastProc.patient.id, null),
        type: "inactive",
        patientId: lastProc.patient.id,
        patientName: lastProc.patient.name,
        patientPhone: lastProc.patient.phone,
        procedureId: null,
        procedureName: null,
        baseDate: lastProc.completedAt,
        dueDate: threshold,
        daysUntilDue: -daysSince,
        urgency: "overdue",
        description: describeInactive(daysSince),
      });
    }
  }

  // 3. Pos-consulta
  for (const proc of input.procedures) {
    const dueDate = addDays(proc.completedAt, input.postConsultaDays);
    const daysUntilDue = daysBetween(now, dueDate);
    if (daysUntilDue < -30 || daysUntilDue > 30) continue;
    all.push({
      key: buildKey("postconsulta", proc.patient.id, proc.id),
      type: "postconsulta",
      patientId: proc.patient.id,
      patientName: proc.patient.name,
      patientPhone: proc.patient.phone,
      procedureId: proc.id,
      procedureName: proc.name,
      baseDate: proc.completedAt,
      dueDate,
      daysUntilDue,
      urgency: urgencyOf(daysUntilDue),
      description: describePostConsulta(proc.name, daysUntilDue),
    });
  }

  // 4. Filtrar consumidos
  return all.filter((r) => !isReminderConsumed(r, input.actions, now));
}
