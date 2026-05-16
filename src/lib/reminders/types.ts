// [DASH-9] Tipos compartilhados entre lib pura, endpoint e UI.

export type ReminderType = "recall" | "inactive" | "postconsulta";

// Urgencia derivada de daysUntilDue:
//   < 0   -> overdue
//   0..7  -> urgent
//   8..30 -> upcoming
export type ReminderUrgency = "overdue" | "urgent" | "upcoming";

export type ReminderActionKind = "TRATADO" | "ADIADO" | "DISPENSADO";

export interface Reminder {
  key: string;
  type: ReminderType;
  patientId: string;
  patientName: string;
  patientPhone: string | null;
  procedureId: string | null;
  procedureName: string | null;
  baseDate: Date;
  dueDate: Date;
  daysUntilDue: number;
  urgency: ReminderUrgency;
  description: string;
}

export interface ProcedureForReminder {
  id: string;
  name: string;
  completedAt: Date;
  patient: { id: string; name: string; phone: string | null };
}

export interface RecallIntervalForCalc {
  procedureNamePattern: string;
  days: number;
}

export interface ReminderActionRecord {
  reminderKey: string;
  action: ReminderActionKind;
  snoozeUntil: Date | null;
  createdAt: Date;
}

export interface ComputeRemindersInput {
  procedures: ProcedureForReminder[];
  recallIntervals: RecallIntervalForCalc[];
  inactiveMonths: number;
  postConsultaDays: number;
  actions: ReminderActionRecord[];
  now?: Date;
}

export interface ReminderCounts {
  recall: number;
  inactive: number;
  postconsulta: number;
  total: number;
}

export interface RemindersGrouped {
  overdue: Reminder[];
  urgent: Reminder[];
  upcoming: Reminder[];
  counts: ReminderCounts;
}
