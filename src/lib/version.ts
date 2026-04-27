export const APP_VERSION = "0.16.0";

export interface ChangelogEntry {
  version: string;
  date: string;
  type: "major" | "minor" | "patch";
  changes: string[];
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: "0.16.0",
    date: "2026-04-27",
    type: "minor",
    changes: [
      "Receita por periodo: troca grafico fixo de 7 dias da semana por timeline real",
      "Granularity automatica: <=31 dias por dia, <=90 dias por semana, >90 dias por mes",
      "Tooltip com receita exata, scroll horizontal quando muitos pontos",
      "Label dinamico mostrando granularity ativo (Por dia/semana/mes)",
    ],
  },
  {
    version: "0.15.2",
    date: "2026-04-27",
    type: "patch",
    changes: [
      "DateFilter premium: calendario customizado com tema dark/gold (sem mais o feio nativo)",
      "Range selection: clica no inicio + clica no fim, com hover preview do range",
      "Layout reorganizado: atalhos a esquerda, calendario a direita",
    ],
  },
  {
    version: "0.15.1",
    date: "2026-04-27",
    type: "patch",
    changes: [
      "DateFilter modernizado: popover unico com presets (Hoje, Ontem, 7d, 30d, 90d, Este mes, Mes passado)",
      "Fix: 'Ate' agora pega ate o fim do dia (23:59:59) em vez de 00:00:00",
      "Fix: datas tratadas em horario local (nao UTC), evitando off-by-one",
      "Custom range com inputs de data + botao 'Aplicar periodo'",
    ],
  },
  {
    version: "0.15.0",
    date: "2026-04-27",
    type: "minor",
    changes: [
      "Nova aba Financeiro: caixa total da clinica (todos procedimentos)",
      "KPIs: receita confirmada, ticket medio, pacientes ativos, pipeline pendente",
      "Receita diaria, top 10 procedimentos, distribuicao por status",
    ],
  },
  {
    version: "0.14.0",
    date: "2026-04-27",
    type: "minor",
    changes: [
      "Matching de telefones agora normaliza o nono digito brasileiro (DDD + ultimos 8 digitos)",
      "Dashboard mostra Receita do funil + Receita total da clinica em paralelo",
      "Card 'Procedimentos fechados' inclui breakdown com total da clinica",
    ],
  },
  {
    version: "0.13.2",
    date: "2026-04-17",
    type: "patch",
    changes: [
      "Fix: forcar dynamic rendering em /dashboard/* e /login para Cloudflare nao cachear HTML",
      "Paginas antes estavam como static (prerendered) e recebiam s-maxage=31536000",
    ],
  },
  {
    version: "0.13.1",
    date: "2026-04-17",
    type: "patch",
    changes: [
      "Fix: adicionar no-cache em /dashboard, /login e / para evitar Cloudflare CDN servir HTML antigo",
      "Fix: command_timeout do deploy aumentado para 40m (build no VPS pode demorar >20m)",
    ],
  },
  {
    version: "0.13.0",
    date: "2026-04-16",
    type: "minor",
    changes: [
      "Fix: dashboard filtra leads apenas do pipeline 'Captacao de Leads'",
      "Segmentacao Novos vs Existentes: leads classificados como paciente novo ou retorno",
      "Toggle no dashboard para alternar entre Novos / Existentes / Todos",
      "Campo 'Canal de Prospeccao' capturado do Kommo e transferido para Clinicorp",
      "Validacao de campos obrigatorios antes de criar paciente no Clinicorp",
      "Automacao de agendamento no Clinicorp quando lead chega em 'Agendado'",
      "Dashboard LTV & ROAS com metricas por canal de aquisicao",
      "Pagina de listagem de pacientes com busca",
      "Perfil do paciente 360: timeline completa lead-to-procedure",
      "API de lembretes de retorno por procedimento (Botox 4m, Preenchimento 8m)",
    ],
  },
  {
    version: "0.12.0",
    date: "2026-04-16",
    type: "minor",
    changes: [
      "Multi-tenant: campo role no User (super_admin, clinic_admin, user)",
      "Auth guard: API routes validam que user tem acesso a clinica solicitada",
      "Super admin pode trocar entre clinicas via selector no header",
      "clinic_admin e user so acessam dados da propria clinica",
      "Seguranca: requests para clinicId nao autorizado retornam 403",
    ],
  },
  {
    version: "0.11.1",
    date: "2026-04-12",
    type: "patch",
    changes: [
      "Fix: telefone do lead agora e buscado via API de contatos do Kommo (antes tentava extrair do embed que nao trazia custom_fields)",
      "Novo metodo getContact() no KommoClient para buscar dados completos do contato",
      "field_code agora e case-insensitive (PHONE, Phone, phone todos funcionam)",
      "Logging de erro quando busca de contato falha",
    ],
  },
  {
    version: "0.11.0",
    date: "2026-04-12",
    type: "minor",
    changes: [
      "Funil agora mostra apenas dados de leads do Kommo (nao todos os procedimentos da clinica)",
      "Compareceram reflete dados reais: leads cujo paciente teve pelo menos 1 procedimento",
      "Auto-matching: quando procedimento chega do Clinicorp, vincula paciente a leads existentes por telefone",
      "Removidos trends hardcoded e porcentagens aleatorias do dashboard",
      "Corrigido SQL injection na query de receita por dia",
      "Receita e top procedimentos filtrados apenas por pacientes vinculados a leads",
    ],
  },
  {
    version: "0.10.1",
    date: "2026-04-06",
    type: "patch",
    changes: [
      "Fix: infinite re-render loop em todas as paginas do dashboard causado por referencia instavel do objeto clinic no useClinic hook",
      "useClinic agora usa useMemo para estabilizar referencia do objeto clinic",
    ],
  },
  {
    version: "0.10.0",
    date: "2026-04-04",
    type: "minor",
    changes: [
      "Integracao Meta Ads (Marketing API) — OAuth, sync automatico a cada 6h, somente leitura (ads_read)",
      "Integracao Google Ads — OAuth com refresh token, sync via GAQL, somente leitura",
      "Model AdCampaignData para armazenar dados de campanhas (spend, impressions, clicks) por dia",
      "API /api/campaigns enriquecida com dados de ad spend, CPL, CPC e ROI",
      "API /api/ads/status e /api/ads/disconnect para gerenciar conexoes",
      "Workers sync-meta-ads e sync-google-ads com BullMQ (repeat every 6h)",
      "Aba Anuncios no settings com botoes conectar/desconectar Meta e Google",
      "Pagina de campanhas redesenhada: KPIs (investimento, receita, ROI, CPL), grafico comparativo, tabela com plataforma e metricas de ads",
      "Compliance Meta: scope ads_read apenas, zero dados de pacientes enviados",
    ],
  },
  {
    version: "0.9.0",
    date: "2026-04-03",
    type: "minor",
    changes: [
      "Pagina Webhook Logs no dashboard com filtro por origem e visualizacao de payload JSON",
      "API /api/webhook-logs com filtros (source, status, limit)",
      "Link no sidebar para Webhook Logs",
      "Versao atualizada no sidebar",
    ],
  },
  {
    version: "0.8.0",
    date: "2026-04-03",
    type: "minor",
    changes: [
      "Toggles de integracao: receber webhooks Clinicorp (on/off) e criar pacientes automaticamente (off por padrao)",
      "Worker create-patient respeita flag clinicorpAutoCreatePatient",
      "Webhook Clinicorp respeita flag clinicorpWebhookEnabled",
      "Componente Switch adicionado ao UI kit",
      "Secao 'Controles de Integracao' na pagina de settings",
    ],
  },
  {
    version: "0.7.0",
    date: "2026-04-03",
    type: "minor",
    changes: [
      "Botao Sincronizar funcional (dispara match-leads + sync-clinicorp)",
      "Filtros de data em todas as paginas do dashboard (presets 7/30/90 dias + custom)",
      "Home page redireciona para /dashboard",
      "API /api/sync implementada",
    ],
  },
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
