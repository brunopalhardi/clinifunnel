export const APP_VERSION = "0.2.0";

export interface ChangelogEntry {
  version: string;
  date: string;
  type: "major" | "minor" | "patch";
  changes: string[];
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: "0.2.0",
    date: "2026-04-03",
    type: "minor",
    changes: [
      "Clinicorp client reescrito com Basic Auth (sem OAuth)",
      "Webhook captura todos os leads (add + status change)",
      "BullMQ worker cria paciente no Clinicorp ao atingir stage Agendado",
      "Seed da clínica AD com dados reais do Kommo e Clinicorp",
      "Banco PostgreSQL e Redis no servidor de produção",
      "Primeira migration aplicada",
    ],
  },
  {
    version: "0.1.0",
    date: "2026-04-02",
    type: "minor",
    changes: [
      "Setup inicial do projeto",
      "Schema do banco (Clinic, Lead, Patient, Procedure, WebhookLog)",
      "Estrutura de pastas e arquivos base",
      "Docker Compose para dev (PostgreSQL + Redis)",
    ],
  },
];
