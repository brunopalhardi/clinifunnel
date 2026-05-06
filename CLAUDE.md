# CLAUDE.md — CliniFunnel

> URL Producao: https://clinifunnel.koaai.com.br
> Deploy: auto via GitHub Actions (push em `main`) — pipeline build GHCR + docker stack deploy

## Stack

- **Framework**: Next.js 14 (App Router) + TypeScript strict
- **UI**: Tailwind CSS + shadcn/ui
- **Database**: PostgreSQL (Prisma ORM)
- **Fila/Jobs**: BullMQ + Redis
- **Auth**: NextAuth (Credentials + JWT)
- **Deploy**: Docker Swarm + Traefik na VPS, imagem em GHCR

## Arquitetura de Deploy

```
GitHub push main
    -> CI (lint+tsc+build)                  [.github/workflows/ci.yml]
    -> Build + push GHCR                    [.github/workflows/deploy.yml job: build]
       imagem: ghcr.io/brunopalhardi/clinifunnel:latest + :sha-XXXXXXX (privada)
    -> SSH na VPS + docker stack deploy     [job: deploy]
       stack: clinifunnel  (services: web, workers)
    -> Healthcheck pos-deploy               [job: healthcheck]
       GET https://clinifunnel.koaai.com.br/api/health  ->  {status: "ok"|"degraded"}
```

### Componentes na VPS (FASE 1)

| Componente | Estado | Como roda |
|---|---|---|
| Traefik | ja existente no swarm | provider=docker swarmMode, network_swarm_public, letsencryptresolver |
| **clinifunnel_web** | service do swarm | imagem GHCR, replicas=1, Koa-Manager01, expoe 3000 internamente, Traefik faz front |
| **clinifunnel_workers** | service do swarm | mesma imagem, command tsx workers, sem porta exposta |
| Postgres | **nativo do host** | acessado via host.docker.internal:5432 |
| Redis | **nativo do host** | acessado via host.docker.internal:6379 |

### FASE 2 (futuro, nao implementado)

- Migrar Postgres e Redis para services do swarm
- Substituir env_file por docker secrets
- Avaliar healthcheck 503 com >1 replica

---

## Padrao de Engenharia (OBRIGATORIO)

Estas regras sao validadas em revisao de PR. Quebrar qualquer uma delas e motivo de pedir rework.

### 1. Worktree por tarefa

Toda feature/fix sai em **worktree dedicada**, nunca no clone principal.

```bash
# A partir do clone principal em main atualizado
git fetch origin && git checkout main && git pull origin main
git worktree add -b feat/nome-da-feature ../clinifunnel-feat-nome main
cd ../clinifunnel-feat-nome
```

Por que: isola a feature, permite rodar varios trabalhos em paralelo, evita commits acidentais no clone principal.

Ao terminar e mergear o PR:
```bash
cd <clone-principal>
git worktree remove ../clinifunnel-feat-nome
git branch -d feat/nome-da-feature  # ou -D se ja foi squash-merged
```

### 2. Branch e PR

- **NUNCA** commitar direto em `main`. **NUNCA** `git push origin main`.
- Cada fix/feature tem branch propria. Branch nao se reusa.
- Nomenclatura:
  ```
  feat/<descricao-curta>     # feature nova (bump minor)
  fix/<descricao-curta>      # bug fix (bump patch)
  chore/<descricao-curta>    # processo/infra/docs (geralmente patch)
  refactor/<descricao-curta> # mudanca interna sem feature/fix (patch)
  ```
- Sempre PR -> revisao -> **squash merge**. Sem merge commits.
- **NUNCA** usar `gh pr merge --admin` ou `--no-verify` para forcar.
- Aguardar **CI verde** antes de mergear.

### 3. Versionamento (Semantic Versioning)

Toda mudanca que vai para producao DEVE ter bump de versao em **dois arquivos**:

1. `package.json` -> campo `"version"`
2. `src/lib/version.ts` -> constante `APP_VERSION` + nova entrada no array `CHANGELOG`

| Tipo  | Bump  | Quando usar |
|-------|-------|-------------|
| Major | X.0.0 | Breaking change (raro) |
| Minor | 0.X.0 | Feature nova ou mudanca de processo |
| Patch | 0.0.X | Bug fix, refactor sem mudanca de comportamento |

A entrada do `CHANGELOG` deve usar pt-BR e listar mudancas em bullets curtos. Manter o estilo das entradas anteriores.

### 4. Backlog rastreavel

- Toda PR referencia um item de [`docs/IMPROVEMENTS.md`](docs/IMPROVEMENTS.md).
- Se a tarefa nao tem item, **abrir o item primeiro** (PR separado ou no proprio PR, mas registrado).
- Mover o item de "Em andamento" -> "Concluidos" como parte do PR (com link pro PR e versao).

### 5. Validacao antes de marcar pronto

Antes de abrir/atualizar PR, rodar **localmente**:

```bash
npm ci
npx prisma generate
npm run lint
npx tsc --noEmit
npm test
npm run build
```

Se algum desses falhar, **nao abrir PR**. Resolver antes. O CI roda os mesmos comandos — quebrar CI no proprio PR e perda de tempo.

Para mudancas de UI: testar no browser local (`npm run dev`) e descrever no PR o que foi testado. Type check e build NAO substituem teste de feature.

### 6. Banco e migrations

- Migrations em desenvolvimento: `npx prisma migrate dev --name descricao_curta`.
- Producao roda `prisma migrate deploy` no `docker-entrypoint.sh` automaticamente. Nao rodar `migrate dev` em producao.
- Migration destrutiva (drop column, rename, mudanca de tipo com perda) exige aviso explicito no corpo do PR + plano de rollback.

### 7. Webhooks e jobs

- Webhooks: responder 200 rapido (<2s), processar async via BullMQ.
- Worker novo: registrar em `src/workers/index.ts` com graceful shutdown.
- Queue nova: factory em `src/lib/queues.ts`.

### 7.1 CI/CD e workflows

- **PM2 e nginx-proxy (setup antigo) sao DEPRECATED**. App roda como `docker stack` no Swarm com Traefik na frente. `ecosystem.config.js` e qualquer config de nginx-proxy do clinifunnel sao zumbis — nao mexer.
- **Todo workflow critico DEVE ter `workflow_dispatch:`** alem dos triggers automaticos. Webhooks do GitHub falham (degradacao parcial acontece algumas vezes por ano) e perdem eventos de push. Sem dispatch manual, deploy fica preso.
- Disparo manual: `gh workflow run <workflow.yml> --ref main` (nao usa webhook, vai direto pro scheduler).
- `deploy.yml` aceita input `skip-wait-ci=true` apenas em emergencia documentada (webhook degradado ou CI ja validado em outro PR).
- Apos cada PR mergeado, conferir que o run de deploy foi disparado (`gh run list --branch main --limit 3`). Se nao disparou em 5 min, suspeitar de degradacao do GitHub e usar dispatch manual.

### 8. Seguranca

- TypeScript strict: sem `any` injustificado, sem `!` desnecessario.
- Variaveis sensiveis: nunca hardcode, sempre via `env` ou banco.
- Tokens de integracao no DB devem ser tratados como secret (mascarar em GET, nao logar payload com token).
- Multi-tenant: toda query DB filtra por `clinicId`. Toda API route valida acesso via `auth-guard`.

### 9. Convencoes de codigo

- Imports: `@/` para paths absolutos.
- Componentes: PascalCase.
- API routes (pasta): kebab-case.
- Funcoes: camelCase, verbos descritivos.
- Mensagens de commit: pt-BR, formato `tipo: descricao` (ex: `feat: adiciona pagina de changelog`).

### 10. O que NAO fazer

- Nao desabilitar regra de lint/tsc para "fazer passar". Se a regra esta errada, abrir PR de chore alterando a regra.
- Nao adicionar `// @ts-ignore` ou `// eslint-disable-next-line` sem comentario explicando motivo + link de issue.
- Nao mexer em `.env`, secrets de GitHub, config de VPS sem instrucao explicita.
- Nao fazer "drive-by refactors" no meio de uma feature. PR pequeno e focado.
- Nao deletar codigo desconhecido sem entender. Investigar `git blame` e changelog primeiro.

---

## Branch Protection (configuracao manual no GitHub)

Em `Settings > Branches > main`, exigir:

- [x] Require a pull request before merging
- [x] Require approvals (1)
- [x] Require status checks to pass before merging
  - [x] `ci` (workflow `.github/workflows/ci.yml`)
- [x] Require branches to be up to date before merging
- [x] Do not allow bypassing the above settings (inclusive admin)
- [ ] Allow force pushes — **DESLIGADO**
- [ ] Allow deletions — **DESLIGADO**

---

## Comandos uteis

```bash
# Dev
docker compose -f docker-compose.dev.yml up -d   # Postgres + Redis
npm run dev                                      # Next.js dev
npm run workers                                  # workers BullMQ

# Database
npx prisma migrate dev --name <nome>             # criar/aplicar migration local
npx prisma studio                                # GUI do banco
npx prisma generate                              # gerar client

# Validacao pre-PR
npm run lint && npx tsc --noEmit && npm test && npm run build

# Worktree
git worktree list
git worktree add -b feat/x ../clinifunnel-feat-x main
git worktree remove ../clinifunnel-feat-x

# CI/CD - dispatch manual (em caso de webhook degradado do GitHub)
gh workflow run ci.yml --ref main
gh workflow run deploy.yml --ref main
gh workflow run deploy.yml --ref main -f skip-wait-ci=true   # emergencia
gh run list --branch main --limit 5                          # status

# Producao na VPS (executar via SSH no manager)
docker stack ps clinifunnel                                  # status replicas
docker service ls --filter name=clinifunnel_                 # services do stack
docker service logs -f clinifunnel_web                       # logs do web
docker service logs -f clinifunnel_workers                   # logs dos workers
docker service rollback clinifunnel_web                      # rollback web
docker service rollback clinifunnel_workers                  # rollback workers
docker service inspect clinifunnel_web --pretty             # config detalhada
docker stack rm clinifunnel                                  # remover stack inteiro
gh workflow run deploy.yml --ref main
gh workflow run deploy.yml --ref main -f skip-wait-ci=true   # emergencia
gh run list --branch main --limit 5                          # status
```

---

## Estrutura

```
src/
  app/
    api/                # API routes (kebab-case)
    dashboard/          # paginas autenticadas
    login/
  components/
    ui/                 # primitives (shadcn)
    layout/             # sidebar, header
    dashboard/          # feature components
  lib/
    prisma.ts
    redis.ts
    auth.ts, auth-guard.ts
    queues.ts
    version.ts          # APP_VERSION + CHANGELOG (renderizado em /changelog publico)
    matching/           # lead <-> patient
    kommo/              # client + types
    clinicorp/          # client + types
    ads/                # meta + google
  workers/              # BullMQ workers
prisma/
  schema.prisma
  migrations/
  seed.ts
docs/
  IMPROVEMENTS.md       # backlog
.github/
  workflows/
    ci.yml              # lint + tsc + build em PR
    deploy.yml          # build GHCR + docker stack deploy
  PULL_REQUEST_TEMPLATE.md
```
