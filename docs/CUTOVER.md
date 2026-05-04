# Cutover FASE 1 — PM2/nginx-proxy → Docker Swarm

Runbook para a primeira migracao do CliniFunnel rodando nativo (PM2) para `docker stack` no Swarm com Traefik. Postgres e Redis continuam nativos.

**Janela estimada**: 30-45min com janela de downtime de 1-3min durante a troca.

**Comunicar antes**: avisar Bruno + qualquer cliente em uso.

---

## Pre-requisitos (fazer ANTES da janela)

### 1. Secrets no GitHub repo

Em https://github.com/brunopalhardi/clinifunnel/settings/secrets/actions, garantir:

- [ ] `GHCR_USER` = `brunopalhardi`
- [ ] `GHCR_TOKEN` = PAT classic com `read:packages` (criar em https://github.com/settings/tokens)
- [ ] `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY` (ja existem)
- [ ] `VPS_APP_DIR` = `/opt/clinifunnel`

### 2. Branch protection

Em https://github.com/brunopalhardi/clinifunnel/settings/branches:

- [ ] Require PR + 1 approval
- [ ] Require status check `lint + tsc + build`
- [ ] Require up-to-date
- [ ] No force push, no deletions, no admin bypass

### 3. Diretorio do stack na VPS

SSH no Koa-Manager01 (5.161.209.197):

```bash
sudo mkdir -p /opt/clinifunnel
sudo chown $USER:$USER /opt/clinifunnel
ls -la /opt/clinifunnel
```

### 4. .env.production na VPS

Copiar conteudo do `.env.production.example` (do repo) para `/opt/clinifunnel/.env.production` na VPS, preenchendo os valores reais (token Kommo, Clinicorp, secrets do .env atual em /root/clinifunnel/.env):

```bash
# Na VPS, AINDA com PM2 rodando:
cat /root/clinifunnel/.env                    # ver valores atuais
nano /opt/clinifunnel/.env.production          # criar com valores
chmod 600 /opt/clinifunnel/.env.production     # permissoes restritivas
```

Confirmar:
- `DATABASE_URL` aponta pra `host.docker.internal:5432` (NAO `localhost`)
- `REDIS_URL` aponta pra `host.docker.internal:6379` (NAO `localhost`)
- `NEXTAUTH_URL` = `https://clinifunnel.koaai.com.br` (https, nao http)
- `NEXTAUTH_SECRET` = mesmo valor do .env atual (senao todas as sessoes invalidadas)

### 5. Validar que PRs estao mergeados

`docs/IMPROVEMENTS.md` deve mostrar `[INFRA-1]` em "Concluidos" com PRs #49, #50, #51, e este #N. `main` HEAD deve ser >= 0.20.1.

### 6. Testar `host.docker.internal` na VPS

```bash
docker run --rm --add-host=host.docker.internal:host-gateway alpine \
  sh -c 'apk add --no-cache postgresql16-client >/dev/null 2>&1 && \
         pg_isready -h host.docker.internal -p 5432 -U odontofunil'
```

Esperado: `host.docker.internal:5432 - accepting connections`. Se falhar, parar e investigar antes da janela.

### 7. Confirmar Traefik network

```bash
docker network ls | grep network_swarm_public
```

Esperado: linha com `network_swarm_public ... overlay ... swarm`.

---

## Janela de cutover

Tudo a partir daqui na VPS Koa-Manager01.

### Passo 1 — Snapshot do estado atual

```bash
date
pm2 list
docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}'
psql -U odontofunil -d odontofunil -c '\d' | head     # confirma DB acessivel
redis-cli -a odontofunil2026 PING                       # confirma redis
free -m
```

Anotar: PIDs do PM2, container ID do nginx-proxy.

### Passo 2 — Deploy do stack (com PM2 ainda rodando)

A primeira execucao do workflow `Deploy to VPS` ja deve ter pushado a imagem pra GHCR. Confirmar:

```bash
# Local na sua maquina, NAO na VPS:
gh run list --repo brunopalhardi/clinifunnel --workflow deploy.yml --limit 3
```

Se a imagem ja esta em GHCR, na VPS:

```bash
cd /opt/clinifunnel
ls -la                                              # docker-stack.yml + .env.production
echo "$GHCR_TOKEN" | docker login ghcr.io -u brunopalhardi --password-stdin
docker stack deploy -c docker-stack.yml clinifunnel --with-registry-auth
docker stack ps clinifunnel                         # acompanhar replicas subindo
```

Aguardar ~60s ate `clinifunnel_web` ficar `Running` e healthy.

### Passo 3 — Validar stack ANTES de matar PM2

```bash
# Container do swarm responde dentro da rede?
docker exec $(docker ps -q -f name=clinifunnel_web) wget -qO- http://localhost:3000/api/health

# Esperado: JSON com {"status":"ok","version":"0.20.x", "db":"ok", "redis":"ok"}
```

Se nao retornar 200 com `db:"ok"` e `redis:"ok"`, **PARAR** — provavelmente `host.docker.internal` ou env errados. Investigar antes de continuar.

### Passo 4 — Cutover do trafego (1-3min downtime aqui)

Aqui e o momento da troca real. Traefik vai trocar quem serve `clinifunnel.koaai.com.br`.

**Opcao A (mais segura — Bruno escolhe)**: parar nginx-proxy primeiro, Traefik assume:

```bash
# Parar o proxy antigo (libera o roteamento pra Traefik)
docker stop clinifunnel-proxy
docker rm clinifunnel-proxy

# Validar Traefik agora roteia
curl -fsS https://clinifunnel.koaai.com.br/api/health
# Esperado: {"status":"ok",...} com version do GHCR
```

**Opcao B (menos crash)**: dar prioridade Traefik no DNS/Cloudflare antes. Nao aplica aqui (mesmo IP, mesma porta).

### Passo 5 — Parar PM2

Com trafego ja chegando no stack do swarm:

```bash
pm2 list
pm2 stop all
pm2 delete all
pm2 save                          # remove autostart
pm2 unstartup systemd             # remove servico systemd
```

Confirmar nada de PM2 sobrou:
```bash
ps aux | grep -E "next-server|node.*workers" | grep -v grep
# Esperado: vazio
```

### Passo 6 — Validar producao

```bash
curl -fsS https://clinifunnel.koaai.com.br/api/health
curl -fsSI https://clinifunnel.koaai.com.br/changelog | head -3
curl -fsSI https://clinifunnel.koaai.com.br/login | head -3
```

Esperado: 200 em todas, body de health com `version` >= 0.20.1.

Login manual:
- Abrir https://clinifunnel.koaai.com.br/login no navegador
- Footer mostra `v0.20.x · novidades`
- Login com credenciais existentes deve funcionar (mesmo NEXTAUTH_SECRET)
- Sidebar mostra `v0.20.x`
- Pagina inicial /dashboard carrega

### Passo 7 — Cleanup

```bash
free -m                                            # confirmar RAM liberada
docker image prune -f                              # remover imagens nao usadas
ls /root/clinifunnel                               # nao mexer ainda — backup do codigo antigo
```

NAO deletar `/root/clinifunnel` ainda. Manter por uns dias como rollback de emergencia (codigo + .env).

---

## Rollback (se algo der errado depois)

### Se o stack estiver com bug recente

```bash
docker service rollback clinifunnel_web
docker service rollback clinifunnel_workers
```

Volta pra imagem anterior (sha tag). Demora ~30s.

### Se o stack inteiro tiver problema serio

```bash
docker stack rm clinifunnel
# espera 30s para limpar
cd /root/clinifunnel
pm2 start ecosystem.config.js                      # ou comando equivalente que estava rodando
docker run -d --name clinifunnel-proxy \
  --network bridge \
  -p 80:80 -p 443:443 \
  -v /root/clinifunnel/nginx.conf:/etc/nginx/nginx.conf:ro \
  -v /root/clinifunnel/certs:/etc/nginx/certs:ro \
  nginx:alpine
```

Bruno: confirmar comandos exatos do PM2 e nginx-proxy ANTES da janela. Documentar aqui.

---

## Pos-cutover (proximos dias)

- [ ] Acompanhar `docker service logs -f clinifunnel_web` por 24h
- [ ] Validar webhooks Kommo/Clinicorp continuam chegando
- [ ] Validar workers BullMQ processando (acompanhar logs do redis e do worker)
- [ ] Validar prisma migrate deploy aplicou todas as migrations (entrypoint loga)
- [ ] Apos 7 dias estaveis, deletar `/root/clinifunnel` (backup) e o token PAT antigo
- [ ] Atualizar `docs/IMPROVEMENTS.md` movendo `[INFRA-1]` para "Concluidos"

---

## Comandos de operacao do dia-a-dia (apos cutover)

```bash
# Ver status
docker stack ps clinifunnel
docker service ls --filter name=clinifunnel_

# Logs em tempo real
docker service logs -f clinifunnel_web
docker service logs -f clinifunnel_workers

# Rollback de uma versao
docker service rollback clinifunnel_web

# Deploy manual (se webhook do GitHub estiver degradado)
gh workflow run deploy.yml --ref main

# Forcar rebuild sem cache (raro, em ultimo caso)
gh workflow run deploy.yml --ref main          # GHA tem cache, deletar via UI se preciso
```
