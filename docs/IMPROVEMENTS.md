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

- **[SEC-2] Auditoria de isolamento multi-tenant**
  Garantir que toda API route e toda query Prisma filtra `clinicId` e valida via `auth-guard`. Catalogo de rotas + script grep + testes basicos.
  Eixo: seguranca · Bump: minor

- **[SEC-3] Retencao de WebhookLog**
  `WebhookLog.payload` e Json cru, sem TTL. DB infla rapido. Worker semanal removendo logs >90 dias (ou config por clinica).
  Eixo: seguranca · Bump: minor

### Arquitetura

- **[ARCH-1] Estrutura modular + feature flags**
  Reorganizar codigo em modulos coesos (auth, leads, patients, ads, billing, etc) com fronteiras claras. Adicionar feature flags por modulo/clinica (tabela `FeatureFlag` ou config em env) pra liberar features pra clinicas especificas em rollout incremental.
  Eixo: arquitetura · Bump: spans em multiplos PRs (vai mexer em quase tudo)

### Usuarios e RBAC

- **[USR-1] CRUD de usuarios manual + permissoes por modulo**
  Hoje so existe `User.role` (super_admin/clinic_admin/user). Expandir para:
  - Admin cria usuarios manualmente (sem convite por email/Resend) — formulario de "novo usuario" no painel
  - Senha temporaria gerada na criacao + flag `mustChangePassword=true`
  - No primeiro login, app forca troca de senha antes de liberar dashboard
  - Admin pode resetar senha (gera nova temporaria + reaplica flag)
  - Permissoes granulares por modulo/CRUD: `User -> permissions: { leads: ['read','write'], patients: ['read'], ads: [] }`
  - UI de gerenciamento de usuarios e permissoes em /dashboard/settings/users
  Depende de [ARCH-1] estar comecada (modulos definidos).
  Eixo: usuarios · Bump: minor (iterativo — pode ser quebrado em sub-PRs)

### Qualidade

- **[QA-1] Fundacao de testes**
  Sem testes hoje. Setup Vitest + DB de teste isolado (`postgres://test`) + cobertura inicial das areas criticas: matching telefone (`src/lib/matching/`), webhooks Kommo/Clinicorp, auth-guard, normalizacao UTM.
  Eixo: qualidade · Bump: minor

- **[QA-2] Lint mais rigoroso**
  Adicionar regras: `@typescript-eslint/no-explicit-any`, `no-floating-promises`, `prefer-nullish-coalescing`. Corrigir violacoes existentes.
  Eixo: qualidade · Bump: patch

### Observabilidade

- **[OBS-1] Logs estruturados**
  Substituir `console.log` espalhado por logger estruturado (pino) com nivel, contexto (clinicId, leadId) e correlation id. Workers e webhooks como prioridade.
  Eixo: observabilidade · Bump: minor

- **[OBS-2] Metricas de fila BullMQ**
  Endpoint `/api/admin/queues` (super-admin only) com tamanho de cada fila, jobs falhados, tempo medio. Painel simples no `/dashboard/logs`.
  Eixo: observabilidade · Bump: minor

- **[OBS-3.1] Health avancado: ultimo job processado**
  Expandir `/api/health` para tambem reportar status das filas BullMQ (ultimo job processado por queue, jobs falhados nas ultimas 24h). Util pra detectar workers travados antes do usuario reclamar.
  Eixo: observabilidade · Bump: patch
  Nota: depende de [OBS-2] (metricas de fila) — fazer junto.

### Features

- **[FEAT-1] Canal WhatsApp**
  Captura de leads via webhook do WhatsApp Business / Z-API. Modelagem de canal, dedup com Kommo, UTM passthrough.
  Eixo: feature · Bump: minor

- **[FEAT-2] Lembretes proativos por procedimento**
  Expandir `check-reminders` para enviar para Kommo/WhatsApp em vez de so registrar. Configuravel por procedimento.
  Eixo: feature · Bump: minor

---

## Concluidos

- **[SEC-1] Criptografia at-rest dos tokens de integracao** — PR #_TBD_ — v0.21.0
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
