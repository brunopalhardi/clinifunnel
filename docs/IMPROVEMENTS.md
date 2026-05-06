# IMPROVEMENTS — Backlog de Melhorias

Backlog rastreavel de melhorias do CliniFunnel. Toda PR deve referenciar um item daqui (ou registrar um novo). Quando a PR e mergeada, mover o item para "Concluidos" com link do PR e versao.

Estrutura por eixo: **Seguranca**, **Qualidade**, **Observabilidade**, **Multi-tenant**, **Features**.

---

## Em andamento

_(vazio — adicionar quando comecar trabalho)_

### Proxima Fase (planejada, nao iniciada)

- **[INFRA-2] Fase 2: PG + Redis dentro do Swarm + secrets**
  Migrar Postgres e Redis nativos do host para services do swarm. Substituir env_file por docker secrets. Avaliar healthcheck 503 com >=2 replicas web (failover). Subir replicas pra ter rolling update real.
  Eixo: infra · Bump: spans em multiplos PRs

- **[INFRA-3] Build em registry cache + redutor de tempo de build**
  Hoje primeiro build leva 10-15min. Otimizar: BuildKit inline cache + multi-arch (se necessario). Considerar dependencias-only stage com hash de package-lock.

---

## Proximos

### Seguranca

- **[SEC-2.2] Validar autenticidade dos webhooks de entrada**
  Confirmar que payload de Kommo/Clinicorp nao pode ser forjado pra atribuir leads/procedimentos a outra clinica. Hoje matching e por subdomain (Kommo) ou businessId (Clinicorp). Considerar HMAC compartilhado por clinica.
  Eixo: seguranca · Bump: minor

- **[SEC-2.3] Prisma extension que rejeita queries multi-tenant sem clinicId**
  Defesa em profundidade: extension lanca erro se findFirst/findMany em Lead/Patient/Procedure/AdCampaignData nao incluir `clinicId` no `where`. Forca correcao em build/test, evita regressoes humanas. Trade-off: complexidade da extension.
  Eixo: seguranca · Bump: patch (refactor)

- **[SEC-3] Retencao de WebhookLog**
  `WebhookLog.payload` e Json cru, sem TTL. DB infla rapido. Worker semanal removendo logs >90 dias (ou config por clinica).
  Eixo: seguranca · Bump: minor

### Arquitetura

- **[ARCH-1] Estrutura modular + feature flags**
  Reorganizar codigo em modulos coesos (auth, leads, patients, ads, billing, etc) com fronteiras claras. Adicionar feature flags por modulo/clinica (tabela `FeatureFlag` ou config em env) pra liberar features pra clinicas especificas em rollout incremental.
  Eixo: arquitetura · Bump: spans em multiplos PRs (vai mexer em quase tudo)

### Usuarios e RBAC

- **[USR-1.2.1] DELETE/PATCH de usuarios**
  UI ja existe ([USR-1.2]); falta endpoint+botao pra remover/editar role+nome. Considerar soft-delete (campo deletedAt) pra preservar audit trail vs hard-delete.
  Eixo: usuarios · Bump: minor

- **[USR-1.3.1] Aplicar requirePermission em todas as rotas API**
  USR-1.3 fez foundation + aplicou em /api/sync. Resta aplicar em /api/leads (read), /api/patients (read+write), /api/procedures (read+write), /api/campaigns (read), /api/ltv (read), /api/financeiro (read), /api/ads/* (write), /api/settings (write), /api/clinics (write). Conditional rendering no dashboard com useCanAccess.
  Eixo: usuarios · Bump: minor (incremental)

### Qualidade

- **[QA-1.1] Integration tests com Postgres real**
  Vitest + Postgres service no GitHub Actions + transactional rollback per test. Cobrir: cross-tenant via auth-guard + Prisma findFirst (regressao do bug fixado em SEC-2), webhooks Kommo/Clinicorp end-to-end, lazy migration de tokens cifrados ($extends + decrypt no read).
  Eixo: qualidade · Bump: minor
  Nota: depende de [QA-1] (ja pronta — vitest config + 51 unit tests).

- **[QA-2] Lint mais rigoroso**
  Adicionar regras: `@typescript-eslint/no-explicit-any`, `no-floating-promises`, `prefer-nullish-coalescing`. Corrigir violacoes existentes.
  Eixo: qualidade · Bump: patch

### Observabilidade

- **[OBS-1.1] Correlation ID por request (async hooks)**
  Logs estruturados (OBS-1) cobrem workers e webhooks. Falta correlation id automatico — cada request HTTP gera um requestId que se propaga via AsyncLocalStorage por toda chamada subsequente, incluindo workers enfileirados pelo request. Permite trace distribuido sem APM.
  Eixo: observabilidade · Bump: minor

### Features

- **[FEAT-1] Canal WhatsApp**
  Captura de leads via webhook do WhatsApp Business / Z-API. Modelagem de canal, dedup com Kommo, UTM passthrough.
  Eixo: feature · Bump: minor

- **[FEAT-2] Lembretes proativos por procedimento**
  Expandir `check-reminders` para enviar para Kommo/WhatsApp em vez de so registrar. Configuravel por procedimento.
  Eixo: feature · Bump: minor

---

## Concluidos

- **[SEC-2.1] WebhookLog com clinicId** — PR #_TBD_ — v0.29.0
  Migration adiciona coluna `clinicId` (nullable). Webhook handlers Kommo/Clinicorp populam apos identificar a clinica. /api/webhook-logs filtra por clinica: super_admin ve tudo (incluindo legacy nulls), clinic_admin so a propria, user bloqueado. Index composto (clinicId, createdAt) pra perf de listagem por clinica. Resolve o vazamento documentado no SEC-2.

- **[USR-1.3] RBAC granular por modulo (foundation)** — PR #64 — v0.28.0
  src/lib/permissions.ts com 10 modulos canonicos x 3 actions, modelo hibrido (role baseline + User.permissions sobrescreve). PUT /api/users/[id]/permissions, UI checkbox grid em /dashboard/settings/users/[id]/permissions, hook useCanAccess. Aplicado em /api/sync. Foundation pronta — outras rotas seguem em [USR-1.3.1].

- **[USR-1.2] UI admin de usuarios** — PR #62 — v0.27.0
  /dashboard/settings/users com tabela, formulario create, botao reset por linha. Apos create/reset: card destacado com senha temporaria + copy + warning (mostra UMA UNICA vez). Link no header de /dashboard/settings. UI esconde silenciosa pra nao-admin via 403 do backend.

- **[USR-1] foundation: criacao manual + senha temp + force change** — PR #61 — v0.26.0
  Schema: User.mustChangePassword + User.permissions (Json?). Helpers em src/lib/users.ts (generate temp pw cripto-random, hash, verify, create, reset, change). API: POST /api/users (admin cria), POST /api/users/[id]/reset-password (admin reseta), POST /api/auth/change-password (user troca). Middleware redireciona pra /dashboard/change-password se mustChangePassword=true. Pagina change-password com signOut apos sucesso pra reciclar session. UI admin (USR-1.2) e RBAC enforcement (USR-1.3) abertas como follow-ups.

- **[OBS-3.1] Health avancado com status de filas** — PR #60 — v0.25.1
  /api/health agora inclui campo `queues` com waiting/failed counts + lastCompletedAt/lastFailedAt por fila. Reusa getAllQueues() de [OBS-2]. Status agregado (ok|degraded) continua baseado so em db+redis — worker travado nao tira replica do pool. Falha silenciosa em queues:null se Redis estiver sob stress.

- **[OBS-2] Metricas de fila BullMQ** — PR #59 — v0.25.0
  Endpoint /api/admin/queues (super_admin only) retorna counts (waiting/active/completed/failed/delayed/paused) + tempo medio dos ultimos 20 jobs + ultimo OK/fail por fila. Componente QueueMetricsPanel no /dashboard/logs com refresh 10s e cards coloridos por estado (vermelho=falhas, ambar=pendente, neutro=idle). Lista canonica de filas em src/lib/queues.ts (QUEUE_NAMES + getAllQueues()) pra reuso por OBS-3.1. Middleware /api/admin/* protegido. Catalogo da rota em MULTITENANT-AUDIT.md (super_admin only — filas sao globais, expor pra clinic_admin vazaria volume entre clinicas).

- **[OBS-1] Logs estruturados (pino)** — PR #58 — v0.24.0
  src/lib/logger.ts com pino + redact de tokens. 52 console.log/warn/error substituidos em todos os 7 workers, 2 webhooks (Kommo, Clinicorp) e clinicorp/appointment.ts. Padrao: logger.child({ scope: "name" }) + log.info({ contexto }, "mensagem"). Em dev PRETTY_LOGS=1 ativa output colorido; em prod JSON puro pra agregadores. [OBS-1.1] aberta pra correlation id automatico via AsyncLocalStorage.

- **[QA-1] Fundacao de testes (Vitest)** — PR #57 — v0.23.0
  Vitest + 51 unit tests cobrindo crypto (encrypt/decrypt round-trip + tampering), phone (matching com nono digito), utm (classifyChannel + tags), OAuth state (HMAC anti-CSRF + expiracao), auth-guard (super_admin/clinic_admin/user com mocked session). CI roda npm test entre tsc e build. Foundation pronta — adicionar tests pra novas features eh trivial. Integration tests com Postgres ficam pra [QA-1.1].

- **[SEC-2] Auditoria de isolamento multi-tenant** — PR #56 — v0.22.0
  Catalogo de todas as 26 rotas API em `docs/MULTITENANT-AUDIT.md`. 2 bugs criticos fixados: `/api/patients/[id]` agora filtra por clinicId (era cross-tenant trivial), `/api/webhook-logs` restrito a super_admin (era vazamento de payloads de outras clinicas para clinic_admin). Confirmado HMAC-protection do state em OAuth callbacks. Geradas 3 sub-issues SEC-2.1/2.2/2.3 pra continuidade.

- **[SEC-1] Criptografia at-rest dos tokens de integracao** — PRs #54 #55 — v0.21.0 → v0.21.1
  Tokens Kommo/Clinicorp/Meta/Google encriptados com AES-256-GCM via `INTEGRATION_TOKENS_KEY`. Prisma `$extends` faz encrypt automatico em writes e decrypt automatico em reads — invisivel pros 14 callsites existentes. Lazy migration (plaintext legado lido como esta, re-encriptado no proximo write) + script one-shot em `prisma/scripts/encrypt-existing-tokens.ts`. App fail-fast no boot se a chave nao estiver setada.

- **[INFRA-1] Migracao Fase 1: dockerizar app + Docker Swarm + Traefik** — PRs #49 #50 #51 #52 — v0.18.0 → v0.20.1
  App migrado de PM2 nativo + nginx-proxy para docker stack no Swarm com Traefik. Build da imagem em GHA, push GHCR (privado), deploy via `docker stack deploy --with-registry-auth`. Healthcheck robusto pingando DB+Redis. PG e Redis continuam nativos no host (via host.docker.internal). Runbook de cutover em `docs/CUTOVER.md`.

- **[ENG-0.1] Workflows com workflow_dispatch + recovery** — PR #48 — v0.17.1
  Adicionado `workflow_dispatch:` em ci.yml e deploy.yml. Deploy aceita input skip-wait-ci para emergencia. Regra 7.1 no CLAUDE.md exige dispatch manual em todo workflow critico (resposta a degradacao de webhook do GitHub que travou o deploy de v0.17.0).

- **[ENG-0] Padrao de engenharia + visibilidade de versao** — PR #47 — v0.17.0
  CLAUDE.md reforcado, PR template, CI workflow, deploy com healthcheck, IMPROVEMENTS.md, versao no login, pagina /changelog publica, rota /api/health.

---

## Como adicionar um item

1. Escolher eixo (Seguranca / Qualidade / Observabilidade / Multi-tenant / Features) ou criar novo eixo se necessario.
2. Atribuir ID no formato `[<EIXO>-N]` (incrementando o maior N do eixo).
3. Linha 1: titulo curto.
4. Paragrafo: contexto + proposta + impacto.
5. Linha final: `Eixo: ... · Bump: major|minor|patch`.

## Como mover um item para "Concluidos"

Como parte do PR que conclui o item:
1. Remover de "Em andamento" / "Proximos".
2. Adicionar em "Concluidos" com formato:
   `**[ID] Titulo** — PR #N — vX.Y.Z`
   `Resumo de uma linha do que ficou pronto.`
