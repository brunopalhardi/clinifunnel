# Auditoria Multi-Tenant

> Data: 2026-05-06 · Versao: 0.22.0 · PR de origem: SEC-2

CliniFunnel e multi-tenant: dados de varias clinicas convivem nas mesmas tabelas, isolados por `clinicId`. Esta auditoria garante que **toda rota API e cada query Prisma respeita esse isolamento**.

## Modelo de autorizacao

Tres papeis (`User.role`):

| Role | Pode acessar |
|------|--------------|
| `super_admin` | Qualquer clinica via `?clinicId=X` ou fallback para a propria |
| `clinic_admin` | Apenas a propria clinica (`session.user.clinicId`) |
| `user` | Apenas a propria clinica + algumas restricoes adicionais por feature |

Helper canonico: [`src/lib/auth-guard.ts`](../src/lib/auth-guard.ts) -> `getAuthorizedClinicId(request)`.

Toda rota que toca dados por clinica DEVE chamar essa funcao e usar o `clinicId` retornado em **todos** os `WHERE` de Prisma.

## Catalogo de rotas (26)

### ✅ Usam `getAuthorizedClinicId` corretamente (12)

| Rota | Notas |
|------|-------|
| `/api/ads/disconnect` | OK |
| `/api/ads/status` | OK |
| `/api/campaigns` | OK |
| `/api/dashboard` | OK |
| `/api/dashboard/ltv` | OK |
| `/api/financeiro` | OK |
| `/api/leads` | OK |
| `/api/metrics` | OK |
| `/api/patients` (lista) | OK — filtra por clinicId |
| `/api/procedures` | OK |
| `/api/reminders` | OK |
| `/api/sync` | OK |

### ✅ Auth check explicito (nao usa helper, mas implementa logica equivalente) (3)

| Rota | Pattern |
|------|---------|
| `/api/clinics` (GET/POST) | `super_admin` lista/cria todas; clinic_admin/user lista so a sua |
| `/api/clinics/[id]` (GET/PUT) | `super_admin` ou `id === session.user.clinicId` |
| `/api/auth/google-ads` + `/api/auth/meta` | Pega `clinicId` direto da `session`, nao aceita override |

### ✅ Publicas/auth-handlers (nao precisam guard) (7)

| Rota | Razao |
|------|-------|
| `/api/auth/[...nextauth]` | Handler interno do NextAuth |
| `/api/health` | Healthcheck publico (deliberado) |
| `/api/login` | Endpoint de auth |
| `/api/logout` | Endpoint de logout |
| `/api/webhooks/kommo` | Webhook externo — autenticacao via subdomain Kommo no payload |
| `/api/webhooks/clinicorp` | Webhook externo — sem autenticacao (toggle `clinicorpWebhookEnabled`) |
| `/api/auth/google-ads/callback`, `/api/auth/meta/callback` | OAuth callbacks — `clinicId` extraido de `state` parameter HMAC-assinado (anti-CSRF) |

### 🔒 Fixados nesta auditoria (2)

| Rota | Bug | Fix |
|------|-----|-----|
| `/api/patients/[id]` GET | `findUnique({ where: { id } })` sem clinicId. Qualquer user autenticado podia ler paciente de qualquer clinica conhecendo o id. | Trocado para `findFirst({ where: { id, clinicId } })` apos `getAuthorizedClinicId`. Retorna 404 se paciente nao pertence a clinica do requester. |
| `/api/webhook-logs` GET | `findMany` sem clinicId. `clinic_admin` de qualquer clinica via logs de TODAS as clinicas (vazamento de payloads). | Restricao temporaria a `super_admin` only. **Issue [SEC-2.1] aberta para fix definitivo** (adicionar coluna `clinicId` ao schema `WebhookLog` e filtrar). |

### Workers (BullMQ)

Todos os workers pegam `clinicId` do payload do job e usam em queries. Como jobs sao enfileirados pelo proprio app (rotas autenticadas), o `clinicId` no payload e implicitamente confiavel — desde que a rota que enfileirou tenha validado.

| Worker | Origem do clinicId |
|--------|---------------------|
| `create-patient` | Job payload (vem de webhook Kommo apos identificar clinic via subdomain) |
| `process-procedure` | Job payload (vem de webhook Clinicorp) |
| `match-leads` | Job payload (enfileirado por `/api/sync`, com clinicId validado) |
| `sync-clinicorp` | Loop por clinic — busca todas com `clinicorpToken` e processa cada uma |
| `sync-meta-ads` | Idem |
| `sync-google-ads` | Idem |
| `check-reminders` | Idem |

Os webhooks de entrada (`kommo`/`clinicorp`) sao seguros se identificarem a clinica corretamente pelo conteudo do payload — auditoria **secundaria** (proximo passo) e validar que a logica de match webhook -> clinic eh resistente a forjarem requests com subdomain de outra clinica.

## Backlog gerado por essa auditoria

- **[SEC-2.1]** Adicionar coluna `clinicId` ao `WebhookLog` (migration + parser de payload pra preencher) e filtrar `/api/webhook-logs` por clinica. Liberar de novo pra `clinic_admin` apos fix.
- **[SEC-2.2]** Validar autenticacao de webhooks de entrada — confirmar que payload de Kommo/Clinicorp nao pode ser forjado pra atribuir leads a outra clinica.
- **[SEC-2.3]** Considerar mover de "verificar `clinicId` em cada rota manualmente" para Prisma middleware/extension que **rejeita queries sem clinicId** em models multi-tenant. Forca correcao em build se alguem esquecer. Custo: complexidade da extension. Valor: defesa em profundidade.

## Como auditar uma rota nova (checklist)

1. A rota lida com dados especificos de uma clinica? Se sim, **DEVE** chamar `getAuthorizedClinicId(request)`.
2. Cada query Prisma usa o `clinicId` retornado em **todos** os `WHERE` que tocam tabelas multi-tenant (`Lead`, `Patient`, `Procedure`, `AdCampaignData`, `Clinic`, `User`)?
3. Se a rota recebe `id` de recurso via params (ex: `/api/foo/[id]`), use `findFirst({ where: { id, clinicId } })`, **nao** `findUnique({ where: { id } })`.
4. Para mutations (POST/PUT/DELETE), valide que o recurso pertence a clinica antes de modificar.
5. Adicionar a rota a tabela acima neste documento.

## Como rodar uma checagem rapida (grep)

```bash
# Rotas que NAO chamam getAuthorizedClinicId — revisar manualmente:
grep -L "getAuthorizedClinicId" src/app/api/**/route.ts | sort

# Queries findUnique por id (suspeitas de cross-tenant):
grep -rn "findUnique.*where.*id:" src/app/api/

# Queries findMany sem clinicId:
grep -rn "findMany" src/app/api/ | grep -v clinicId
```
