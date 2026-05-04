# IMPROVEMENTS — Backlog de Melhorias

Backlog rastreavel de melhorias do CliniFunnel. Toda PR deve referenciar um item daqui (ou registrar um novo). Quando a PR e mergeada, mover o item para "Concluidos" com link do PR e versao.

Estrutura por eixo: **Seguranca**, **Qualidade**, **Observabilidade**, **Multi-tenant**, **Features**.

---

## Em andamento

### Infraestrutura

- **[INFRA-1] Migracao Fase 1: dockerizar app + Docker Swarm + Traefik**
  Substituir setup atual (PM2 nativo + nginx-proxy container) por docker stack no Swarm com Traefik. PG e Redis continuam nativos do host (acessados via host.docker.internal). Build da imagem em GHA, push pra GHCR, deploy via SSH `docker stack deploy`.
  Eixo: infra · Bump: spans 0.18.0 -> 0.20.1
  Sub-tarefas: PR1 health (0.18.0) #49 · PR2 dockerize+stack (0.19.0) #50 · PR3 GHCR+deploy (0.20.0) · PR4 docs+cutover (0.20.1)
  Fase 2 (futuro): PG + Redis dentro do swarm como services.

---

## Proximos

### Seguranca

- **[SEC-1] Criptografia de tokens de integracao no DB**
  Tokens de Kommo, Clinicorp, Meta, Google Ads ficam em texto claro nas colunas do `Clinic`. Mascarados no GET, mas vazamento de DB = vazamento de todas as integracoes.
  Proposta: criptografar com AES-256-GCM usando chave em env (`INTEGRATION_TOKENS_KEY`), helpers `encrypt()` / `decrypt()` em `src/lib/crypto.ts`, migration que reescreve colunas existentes.
  Eixo: seguranca · Bump: minor

- **[SEC-2] Auditoria de isolamento multi-tenant**
  Garantir que toda API route e toda query Prisma filtra `clinicId` e valida via `auth-guard`. Catalogo de rotas + script grep + testes basicos.
  Eixo: seguranca · Bump: minor

- **[SEC-3] Retencao de WebhookLog**
  `WebhookLog.payload` e Json cru, sem TTL. DB infla rapido. Worker semanal removendo logs >90 dias (ou config por clinica).
  Eixo: seguranca · Bump: minor

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

- **[ENG-0.1] Workflows com workflow_dispatch + recovery** — PR #_TBD_ — v0.17.1
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
