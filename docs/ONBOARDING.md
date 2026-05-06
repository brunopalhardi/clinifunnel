# Onboarding — CliniFunnel

> Bem-vindo. Este documento e o ponto de entrada pra qualquer pessoa (humano ou Claude) que vai trabalhar no projeto. Le primeiro, depois desbrava.

## TL;DR fluxo de trabalho

```
git fetch origin && git checkout main && git pull
git worktree add -b feat/algo ../clinifunnel-feat-algo main
cd ../clinifunnel-feat-algo
# muda codigo
npm run lint && npx tsc --noEmit && npm test && npm run build  # validacao obrigatoria
# bump version em 2 arquivos: package.json + src/lib/version.ts (CHANGELOG)
# atualiza docs/IMPROVEMENTS.md
git add -A && git commit -m "tipo: descricao curta"
git push -u origin feat/algo
gh pr create --title "..." --body "..."
# aguarda CI verde + revisao -> squash merge -> deploy automatico
```

Detalhes: `CLAUDE.md` (regras) · `docs/DECISIONS.md` (por que) · `docs/CUTOVER.md` (deploy/ops) · `docs/IMPROVEMENTS.md` (backlog) · `docs/MULTITENANT-AUDIT.md` (rotas).

---

## 1. Setup local (primeira vez)

### Pre-requisitos
- Node 20+ (e usado em build/CI)
- Docker + docker-compose (pra Postgres/Redis em dev)
- gh CLI autenticada (`gh auth status`)
- Acesso ao repo `brunopalhardi/clinifunnel`

### Passos

```bash
git clone https://github.com/brunopalhardi/clinifunnel.git
cd clinifunnel

# Postgres + Redis em containers locais
docker compose -f docker-compose.dev.yml up -d

# Deps
npm ci

# Schema + Prisma client
npx prisma migrate dev
npx prisma generate

# .env local — copiar de .env.example
cp .env.example .env.local
# editar .env.local: DATABASE_URL aponta pro postgres local, gerar NEXTAUTH_SECRET e INTEGRATION_TOKENS_KEY
openssl rand -base64 32  # NEXTAUTH_SECRET
openssl rand -base64 32  # INTEGRATION_TOKENS_KEY

# Seed (cria admin@clinifunnel.com / admin123)
npm run seed

# Dev server
npm run dev
# Em outro terminal: workers BullMQ
npm run workers
```

Acessa http://localhost:3000/login com `admin@clinifunnel.com` / `admin123`.

---

## 2. Estrutura do projeto

```
src/
  app/
    api/                # API routes (Next.js App Router)
    dashboard/          # paginas autenticadas
    login/, changelog/  # paginas publicas
  components/
    ui/                 # primitives (shadcn-style)
    layout/             # sidebar, header
    dashboard/          # feature components
  lib/
    auth.ts             # NextAuth config
    auth-guard.ts       # getAuthorizedClinicId — usa em toda rota multi-tenant
    crypto.ts           # encrypt/decrypt AES-GCM (tokens de integracao)
    logger.ts           # pino — log estruturado JSON
    prisma.ts           # PrismaClient extendido com encrypt/decrypt automatico
    queues.ts           # BullMQ queues
    redis.ts            # cliente Redis
    users.ts            # CRUD users + temp pw + change pw
    matching/           # lead <-> patient (telefone)
    kommo/              # client + webhooks
    clinicorp/          # client + appointments + patient
    ads/                # Meta + Google Ads (OAuth + sync)
    utils/              # phone, utm, etc
  workers/              # BullMQ workers (7)
prisma/
  schema.prisma
  migrations/
  scripts/              # one-shots manuais (encrypt-existing-tokens)
  seed.ts
docs/
  ONBOARDING.md         # este arquivo
  DECISIONS.md          # ADRs — por que cada escolha
  IMPROVEMENTS.md       # backlog rastreado
  CUTOVER.md            # runbook deploy
  MULTITENANT-AUDIT.md  # catalogo de rotas
.github/
  workflows/
    ci.yml              # lint+tsc+test+build em PR
    deploy.yml          # build GHCR + docker stack deploy
```

---

## 3. Workflow obrigatorio (regras do CLAUDE.md)

### Worktree por tarefa (sempre)

Nunca commit no clone principal. Cada feature/fix ganha worktree dedicada:

```bash
git worktree add -b feat/x ../clinifunnel-feat-x main
cd ../clinifunnel-feat-x
```

Por que: isolamento (varias features em paralelo sem conflito de ferramentas), zero commit acidental.

### Versionamento (semver)

Toda PR mergeavel bumpa **2 arquivos**:
1. `package.json` → campo `version`
2. `src/lib/version.ts` → `APP_VERSION` + nova entrada no array `CHANGELOG`

| Tipo | Bump | Quando |
|---|---|---|
| Major | X.0.0 | Breaking change (raro) |
| Minor | 0.X.0 | Feature nova / mudanca de processo |
| Patch | 0.0.X | Bug fix / refactor |

### Validacao obrigatoria pre-PR

```bash
npm run lint && npx tsc --noEmit && npm test && npm run build
```

Falhar **qualquer** um = nao abre PR. CI roda os mesmos comandos — quebrar la e perda de tempo de todo mundo.

### Commit format

`tipo: descricao curta` em pt-BR. Tipos: `feat`, `fix`, `chore`, `docs`, `refactor`. Sub-escopo opcional: `feat(security): ...`, `feat(obs): ...`.

### Backlog em `docs/IMPROVEMENTS.md`

Toda PR move um item do backlog ou registra um novo. Itens vao por eixo (Seguranca, Qualidade, Observabilidade, etc) e sao numerados (`[SEC-1]`, `[OBS-2]`, etc). Quando merger, mover pra "Concluidos" com link do PR.

---

## 4. Como adicionar nova rota API multi-tenant (checklist)

Comum no app. Sequencia obrigatoria:

```ts
// src/app/api/<algo>/route.ts
import { getAuthorizedClinicId, AuthError } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

const log = logger.child({ scope: "api-algo" });

export async function GET(request: NextRequest) {
  let clinicId: string;
  try {
    ({ clinicId } = await getAuthorizedClinicId(request));
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }

  // SEMPRE filtra por clinicId em qualquer query Prisma de Lead/Patient/Procedure/Clinic/AdCampaignData
  const data = await prisma.lead.findMany({ where: { clinicId } });

  // Se for buscar por id, use findFirst com clinicId, NUNCA findUnique({ where: { id } })
  // const item = await prisma.patient.findFirst({ where: { id, clinicId } });

  return NextResponse.json({ data });
}
```

Adiciona a rota a:
- `src/middleware.ts` (matcher) — gate de auth
- `docs/MULTITENANT-AUDIT.md` (catalogo) — atualiza tabela com a nova rota

---

## 5. Como adicionar novo worker BullMQ

```ts
// src/workers/meu-worker.ts
import { Queue, Worker } from "bullmq";
import { redis } from "@/lib/redis";
import { logger } from "@/lib/logger";

const log = logger.child({ scope: "meu-worker" });

export const meuWorkerQueue = new Queue("meu-worker", { connection: redis });

export const meuWorker = new Worker(
  "meu-worker",
  async (job) => {
    log.info({ jobId: job.id, data: job.data }, "starting");
    // ... fazer trabalho
    log.info({ jobId: job.id }, "completed");
  },
  { connection: redis }
);

meuWorker.on("failed", (job, err) => {
  log.error({ jobId: job?.id, err: err.message }, "job failed");
});
```

Registra em:
- `src/workers/index.ts` (import + Promise.all em shutdown)
- `src/lib/queues.ts` (factory `getMeuWorkerQueue` + entrada em `QUEUE_NAMES`)
- `docs/MULTITENANT-AUDIT.md` se relevante (workers respeitam clinicId vindo do payload)

---

## 6. Como debugar problemas

### App nao sobe local

```bash
# Postgres/Redis rodando?
docker ps | grep -E "postgres|redis"
docker compose -f docker-compose.dev.yml up -d  # se nao

# Migration aplicada?
npx prisma migrate status

# Env completo?
grep -E "^(DATABASE_URL|REDIS_URL|NEXTAUTH_SECRET|INTEGRATION_TOKENS_KEY)" .env.local
```

### Test falhando

```bash
npm test                                    # roda tudo
npx vitest run src/lib/users.test.ts        # roda 1 arquivo
npx vitest run -t "round-trip"              # roda tests com nome contendo "round-trip"
npx vitest                                  # watch mode
```

### Build OK local mas falha no CI

CI usa env dummy. Se a falha for por env, ver `.github/workflows/ci.yml` (env block).

### Deploy falhou

```bash
gh run list --branch main --workflow "Deploy to VPS" --limit 5
gh run view <run-id> --log-failed | tail -30
```

Se for `npm warn exec ... tsx`: aceitavel, workers baixa tsx on-demand.
Se for `INTEGRATION_TOKENS_KEY env var nao definida`: env nao chegou no container — checar `.env.production` na VPS (sem aspas!).

### Em prod (na VPS)

```bash
ssh -i ~/.ssh/clinifunnel_deploy rafa-clinifunnel.admin@5.161.209.197

# status
docker stack ps clinifunnel
docker service ls --filter name=clinifunnel_

# logs (sempre prefere docker logs do container atual em vez de docker service logs — historico polui)
docker logs $(docker ps -q -f name=clinifunnel_web) --tail 50
docker logs $(docker ps -q -f name=clinifunnel_workers) --tail 50

# rollback se algo deu ruim
docker service rollback clinifunnel_web
docker service rollback clinifunnel_workers

# health
curl https://clinifunnel.koaai.com.br/api/health
```

Mais comandos em `docs/CUTOVER.md`.

---

## 7. Trabalhando com Claude (Code/Agent SDK)

Este projeto foi construido em parceria humano-Claude. Pra continuar nesse modo:

1. **Le `CLAUDE.md` primeiro** sempre que comecar uma sessao. Define regras nao-negociaveis.
2. **`docs/DECISIONS.md`** explica o WHY de escolhas arquiteturais. Evita reinventar.
3. **`docs/IMPROVEMENTS.md`** e a fonte de verdade do backlog. Toda PR refere um item.
4. **Em cada nova rota/worker/feature**, segue o checklist do item 4 e 5 deste documento.
5. **NUNCA pular validacao pre-PR** (`lint + tsc + test + build`). E o gate mais barato pra evitar regredir prod.
6. **Worktree obrigatoria.** Editar no clone principal e recipe pra commit acidental.

### Custom agents (futuro)

Se quiser agentes Claude especializados pro projeto, locais sugeridos:
- `.claude/agents/code-reviewer.md` — agent que aplica regras do CLAUDE.md em PRs
- `.claude/agents/feature-builder.md` — agent que segue o checklist de nova rota/worker

Hoje (v0.27.x) ainda nao temos esses agents. Anotado no backlog.

---

## 8. Onde pedir ajuda

- Bug em prod: `gh run list` + `docker logs` + cross-ref com `docs/CUTOVER.md`
- Decisao de arquitetura: `docs/DECISIONS.md` cobre o que ja foi decidido
- Item novo no backlog: criar entrada em `docs/IMPROVEMENTS.md` antes do PR
- Regra de processo: `CLAUDE.md` e a fonte
