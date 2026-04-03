export const APP_VERSION = "0.6.0";

export interface ChangelogEntry {
  version: string;
  date: string;
  type: "major" | "minor" | "patch";
  changes: string[];
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: "0.6.0",
    date: "2026-04-03",
    type: "minor",
    changes: [
      "Webhook Clinicorp processa eventos de procedimentos e agendamentos",
      "Worker process-procedure: cria/atualiza procedures no banco com matching de paciente",
      "Mapeamento de status Clinicorp → status interno (pending/approved/completed/cancelled)",
      "Workers match-leads e sync-clinicorp registrados no index",
      "Todos os 4 workers com graceful shutdown",
    ],
  },
  {
    version: "0.5.0",
    date: "2026-04-03",
    type: "minor",
    changes: [
      "Autenticacao com NextAuth (CredentialsProvider + JWT)",
      "Modelo User no Prisma vinculado a Clinic",
      "Middleware protegendo /dashboard e /api (exceto webhooks)",
      "Pagina de login com email + senha",
      "SessionProvider no layout, useClinic via session",
      "Header com nome do usuario e botao de logout",
      "Seed de usuario admin",
    ],
  },
  {
    version: "0.4.0",
    date: "2026-04-03",
    type: "minor",
    changes: [
      "Settings backend funcional (GET/PUT /api/clinics/[id])",
      "POST /api/clinics para criar nova clinica",
      "Pagina de configuracoes com formularios Kommo e Clinicorp (Basic Auth)",
      "Tokens mascarados no GET, proteção contra sobrescrita com valor mascarado",
      "Badges de status de integração e webhook URLs dinâmicas",
    ],
  },
  {
    version: "0.3.0",
    date: "2026-04-03",
    type: "minor",
    changes: [
      "Dashboard conectado a dados reais (KPIs, funil, leads, campanhas, procedimentos)",
      "API /api/metrics com metricas agregadas do funil",
      "API /api/procedures com listagem e filtros",
      "API /api/clinics para listagem de clinicas",
      "Hook useClinic para resolver clinica ativa",
    ],
  },
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
