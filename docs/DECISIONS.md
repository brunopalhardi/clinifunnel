# Decisoes de Arquitetura — CliniFunnel

> Architecture Decision Records (ADRs) condensados. Cada item: **decisao + WHY + alternativas rejeitadas**. Le antes de propor refator que conflite — provavelmente ja foi pensado.

Ordem cronologica da v0.17.0 em diante (anteriores foram pre-padronizacao).

---

## ADR-001 (v0.17.0): Padrao de engenharia (worktree + semver + PR template)

**Decisao**: toda mudanca via worktree dedicada + branch `tipo/descricao` + PR + squash merge. Versao bumpada em `package.json` E `src/lib/version.ts` (tipado). CHANGELOG visivel ao usuario via `/changelog` publica.

**Por que**:
- Worktree isola features e permite varias em paralelo sem trocar branch.
- Bump em 2 arquivos forca disciplina e da CHANGELOG estruturado renderizavel.
- `/changelog` publica e UX simples — usuario ve "novidades" no login.

**Alternativas rejeitadas**:
- `git flow`: complexidade que nao entrega valor pra time pequeno.
- Conventional Commits + semantic-release: bom mas overkill antes de termos volume.

---

## ADR-002 (v0.17.1): Workflows com `workflow_dispatch:` obrigatorio

**Decisao**: todo workflow critico (CI, deploy) tem `workflow_dispatch:` alem dos triggers automaticos. Permite re-disparar via `gh workflow run`.

**Por que**: webhooks do GitHub falham (degradacao parcial acontece). Sem dispatch manual, deploy fica preso ate webhook voltar — pode ser horas. Aprendizado direto do incidente do v0.17.0 deploy.

---

## ADR-003 (v0.18.0 → v0.20.1): Migracao Fase 1 — PM2 + nginx-proxy → Docker Swarm + Traefik

**Decisao**: containerizar app, deploy via `docker stack deploy` no Swarm ja existente, Traefik (ja configurado em `swarmMode`) na frente. Postgres e Redis continuam **nativos do host** (acessados via `host.docker.internal`), Fase 2 migra eles tambem.

**Por que**:
- Traefik ja estava em `swarmMode` na VPS — incompativel com docker-compose puro.
- Stack swarm da rolling update + rollback automatico (`failure_action: rollback`).
- PG/Redis nativos = menos refactor agora; FASE 2 trata isso quando tiver mais 1 replica.
- VPS apertada de RAM (446MB free) — build na VPS demorava 20min e usava recursos. Movimento para build em GHA + push GHCR libera VPS.

**Alternativas rejeitadas**:
- Kubernetes: overkill pra 1 service de 1 clinica.
- Manter PM2: nao integra com Traefik swarmMode.
- Compose puro: incompativel com `swarmMode` do Traefik existente.

**Quirks descobertos**:
- `docker stack deploy` NAO consome aspas em `env_file` (diferente de compose). Documentado em `.env.production.example`.
- `npx tsx` e instalado on-demand no container porque tsx fica em `.next/standalone/node_modules` que e minimal.

---

## ADR-004 (v0.21.0): Cripto AES-256-GCM dos tokens via Prisma `$extends`

**Decisao**: encrypt/decrypt automatico de `kommoToken/clinicorpToken/metaAccessToken/googleAdsRefreshToken` via Prisma `$extends`. Format `v1:<iv>:<ciphertext>:<tag>`. Lazy migration (plaintext legado lido como esta, re-encriptado no proximo write).

**Por que**:
- Tokens em texto claro no DB = vazamento de DB compromete todas as integracoes.
- AES-256-GCM e AEAD (autenticacao + cifra) — detecta tampering.
- `$extends` torna a cripto **invisivel pros 14 callsites existentes**. Zero refactor de feature code.
- Lazy migration evita big-bang: legacy continua funcionando, script one-shot acelera.
- Prefixo `v1:` permite rotacao futura (`v2:`).

**Alternativas rejeitadas**:
- Helpers explicitos por callsite: 14 lugares pra atualizar e regredir.
- KMS gerenciado: overkill pra MVP (mas vale na FASE 2).
- Symmetric key generated per request: complexidade sem ganho.

**Pegadinha (v0.21.1)**: `assertKeyAvailable()` no module load quebra `next build` porque NEXT_PHASE=phase-production-build importa rotas mas nao tem chave. Fix: skip valida no build, valida em runtime.

---

## ADR-005 (v0.22.0): Auditoria multi-tenant + helper canonico

**Decisao**: toda rota multi-tenant DEVE usar `getAuthorizedClinicId(request)` E filtrar `clinicId` em todo `where` Prisma. `findUnique({ where: { id } })` substituido por `findFirst({ where: { id, clinicId } })` em rotas que recebem id de URL.

**Por que**: bug critico encontrado em `/api/patients/[id]` — qualquer user autenticado podia ler paciente de qualquer clinica. Cross-tenant trivial.

**Alternativas rejeitadas**:
- Prisma extension que rejeita queries sem clinicId (`[SEC-2.3]`): mais robusto mas complexidade alta. Ficou no backlog.
- Migrar pra schema-per-tenant: desproporcional ao tamanho atual.

**Catalogo**: `docs/MULTITENANT-AUDIT.md` documenta todas as rotas + checklist pra novas + grep checks anti-regressao.

---

## ADR-006 (v0.23.0): Vitest sobre Jest

**Decisao**: Vitest como test runner. Unit tests primeiro (sem DB). Integration tests com Postgres ficam pra `[QA-1.1]`.

**Por que**:
- ESM-native, sem transformer config (Jest precisa de babel/swc setup).
- API compativel com Jest (describe/it/expect) — migracao indolor.
- Compativel com `vite-tsconfig-paths` pros `@/` imports.
- Foco em areas de risco historico: matching telefone (changelog v0.14.0), crypto, OAuth state, auth-guard.

---

## ADR-007 (v0.24.0): Logs estruturados com pino + redact paths

**Decisao**: pino como logger. JSON em prod, pino-pretty colorido em dev (PRETTY_LOGS=1). Redact paths cobrem tokens sensiveis.

**Por que**:
- JSON facilita filtro com `jq` em prod (`docker logs ... | jq 'select(.scope == "create-patient")'`).
- Redact previne leak acidental se alguem fizer `log.info({ clinic }, ...)` (clinic completo com tokens).
- pino e o mais rapido entre os structured loggers Node.

**Padrao adotado**:
```ts
const log = logger.child({ scope: "create-patient" });
log.info({ leadId, clinicId, ...contexto }, "mensagem curta");
log.error({ err, ...contexto }, "msg");
```

---

## ADR-008 (v0.25.0): Metricas BullMQ super_admin only

**Decisao**: `/api/admin/queues` retorna metricas globais das filas, restrito a super_admin. Expor pra clinic_admin vazaria volume entre clinicas (info competitiva).

**Por que**: BullMQ nao tem nocao de "tenant" — filas sao globais. Quando precisar dar acesso pra clinic_admin no futuro, refactor envolvera filtrar metricas pelo `clinicId` no payload do job ou separar filas por clinica.

---

## ADR-009 (v0.25.1): /api/health com queues, mas status agregado NAO inclui filas

**Decisao**: `/api/health` ganha campo `queues`, mas o `status` agregado (`ok|degraded`) continua baseado SO em `db+redis`.

**Por que**: worker travado **nao deve** tirar a replica web do pool do Traefik. Em deploy single-replica, isso = downtime artificial. Recovery de worker eh independente do web. Detection de worker travado fica com observabilidade externa.

---

## ADR-010 (v0.26.0): User foundation — criacao manual + senha temp + force change

**Decisao**: admin cria user manualmente (sem convite por email/Resend). Sistema gera senha temp 12 chars cripto-random charset sem ambiguos (`0/O/1/l/I`). User troca obrigatoriamente no primeiro login (middleware enforced). Self-reset bloqueado — admin reseta.

**Por que**:
- Convite por email = dependencia de provider (Resend, SES) + UX trickier (deep link, expiry).
- Senha temp e direta — admin entrega por whatsapp/telefone.
- Charset sem ambiguos: facilita ditar por voz.
- Force change garante que admin nao tem senha do user em nenhum momento (ele diz, user troca).
- Self-reset bloqueado: se user esquece, **admin reseta**. Reduz superficie de ataque (esqueci-senha por email = possivel takeover).

**Alternativas rejeitadas**:
- Magic link: requer email infra + UX mais complexa.
- Password recovery por SMS: custo + SS7/swap risk.

**Quirk**: apos POST /api/auth/change-password, a JWT precisa refletir `mustChangePassword=false`. Em vez de tentar update inline (race conditions), forco signOut + redirect /login. User digita login e session nova ja vem limpa.

---

## ADR-011 (geral): Logs nao usam middleware — cada modulo tem seu logger.child

**Decisao**: nao temos correlation ID automatico via AsyncLocalStorage (item `[OBS-1.1]` aberto). Cada modulo cria `logger.child({ scope: "name" })` manualmente.

**Por que adiou**: AsyncLocalStorage funciona mas tem custo de complexidade. Nao bloqueia debug atual — scope + clinicId + leadId/etc no payload ja da contexto. Quando volume crescer (muitos requests/s), volta na lista.

---

## Como adicionar novo ADR

1. Numera sequencial (ADR-NNN).
2. Estrutura fixa: **Decisao + Por que + Alternativas rejeitadas**.
3. Adiciona em ordem cronologica (mais novo no fim).
4. Referencia versao do CHANGELOG quando aplicavel.

Quem propor refator que conflite com um ADR DEVE explicar por que mudou de opiniao (em PR description ou novo ADR). ADRs sao reversiveis — mas com argumento.
