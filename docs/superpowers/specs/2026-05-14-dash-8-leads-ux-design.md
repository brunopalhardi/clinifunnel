# DASH-8 — Ajustes UX de Leads + esconder LTV/Campanhas

> **Status:** aprovado por Bruno em 2026-05-14
> **Autor da spec:** Claude (Opus 4.7)
> **Versão alvo:** v0.45.0 (minor — features novas)
> **Escopo:** 3 ajustes acumulados num PR só, seguindo o padrão de DASH-6/DASH-7a.

---

## 1. Objetivo

Bruno pediu 3 ajustes:

1. **Esconder LTV & ROAS e Campanhas da sidebar** — voltarão quando começar a rodar anúncios. Rotas permanecem funcionais por URL direta.
2. **Mostrar quantidade de leads por status** na página `/dashboard/leads`, com filtro click.
3. **Drawer lateral com timeline básica** ao clicar em um lead, semelhante ao detalhe de paciente que já existe.

Sem mudança de schema, sem novo sync. Frontend + 1 endpoint novo de read.

---

## 2. Mudanças por arquivo

| Arquivo | Tipo | Mudança |
|---|---|---|
| `src/components/layout/sidebar.tsx` | edit | adiciona flag `hidden?: true` em 2 itens do array `navItems`, filtra no `.map` |
| `src/app/dashboard/leads/page.tsx` | edit | + bloco "Por status" com mini cards + state `statusFilter` + integração com drawer |
| `src/components/dashboard/lead-detail-drawer.tsx` | novo | componente do drawer (slide-in à direita, backdrop, ESC/click-fora, fetch on open) |
| `src/app/api/leads/[id]/route.ts` | novo | endpoint detalhe: lead enriquecido (statusName/Color via `Clinic.kommoStages`) + patient se houver match + procedures do patient |
| `src/lib/version.ts` | edit | bump APP_VERSION pra `0.45.0` + entrada no CHANGELOG |
| `package.json` | edit | bump `version` pra `0.45.0` |
| `docs/IMPROVEMENTS.md` | edit | move item `[DASH-8]` pra "Concluídos" com referência ao PR e versão |

Nenhum arquivo é deletado. Nenhuma rota antiga é removida — `/dashboard/ltv` e `/dashboard/campaigns` continuam acessíveis por URL direta.

---

## 3. Item 1 — Esconder LTV & ROAS + Campanhas

### Como

`src/components/layout/sidebar.tsx` tem `navItems` (array de 8 entradas). Solução:

```ts
// antes
{ href: "/dashboard/campaigns", label: "Campanhas", icon: "Megaphone" },
{ href: "/dashboard/ltv", label: "LTV & ROAS", icon: "TrendingUp" },

// depois
{ href: "/dashboard/campaigns", label: "Campanhas", icon: "Megaphone", hidden: true },
{ href: "/dashboard/ltv", label: "LTV & ROAS", icon: "TrendingUp", hidden: true },
```

E no `.map`:
```ts
{navItems.filter((i) => !i.hidden).map((item) => ...)}
```

Tipo `NavItem` ganha `hidden?: boolean`.

### Por que não deletar do array

- **Reativação trivial** quando começar com anúncios (1 char).
- Histórico de qual rota existia fica documentado no próprio array.
- Sem mexer nas rotas em si — código de `/dashboard/ltv` e `/dashboard/campaigns` continua intacto.

### O que NÃO muda

- As páginas `/dashboard/ltv` e `/dashboard/campaigns` continuam acessíveis por URL direta.
- Endpoints `/api/dashboard/ltv` e `/api/campaigns` continuam funcionando.
- Bookmarks antigos continuam funcionando.

---

## 4. Item 2 — Leads por status

### Onde

`src/app/dashboard/leads/page.tsx`, logo abaixo dos 3 KPIs existentes (Total / Via Campanha / Via Orgânico).

### Layout

```
┌─────────────────────────────────────────────┐
│ Total: 52    Campanha: 18    Orgânico: 34   │   ← já existe
└─────────────────────────────────────────────┘

Por status (clique pra filtrar)
┌─────────┬─────────┬─────────┬─────────┬─────────┐
│ ● Leads │ ● Em    │ ● Agen- │ ● Venda │ ● Não   │
│ entrada │ qualif. │ dado    │ ganha   │ qualif. │
│   8     │   24    │   11    │   4     │   5     │
└─────────┴─────────┴─────────┴─────────┴─────────┘
              ↑ ring laranja se filtro ativo
```

- Grid responsivo: 2 cols mobile, 3 cols sm, 5 cols lg.
- Bolinha colorida = `statusColor` (hex do Kommo, mesmo padrão dos badges atuais).
- Click no card alterna o filtro (toggle: 2º click no mesmo card limpa).
- Combina com filtros existentes (busca por nome/telefone + canal) via **AND**.

### Implementação client-side

Os dados já vêm completos do `/api/leads` (até 100 leads enriquecidos com `statusName` e `statusColor`). Aggregar no client:

```ts
const statusCounts = useMemo(() => {
  const map = new Map<string, { id: string; name: string; color: string | null; count: number }>();
  for (const lead of leads) {
    const id = lead.kommoStatus ?? "__none__";
    const existing = map.get(id);
    if (existing) existing.count++;
    else map.set(id, {
      id,
      name: lead.statusName ?? lead.kommoStatus ?? "Sem status",
      color: lead.statusColor ?? null,
      count: 1,
    });
  }
  return Array.from(map.values()).sort((a, b) => b.count - a.count);
}, [leads]);
```

Ordenado por count desc — status mais lotados em primeiro.

### Filtro

```ts
const [statusFilter, setStatusFilter] = useState<string | null>(null);

const filtered = leads.filter((l) => {
  if (statusFilter && l.kommoStatus !== statusFilter) return false;
  if (search && !match(l.name, l.phone, search)) return false;
  if (channelFilter !== "all" && l.channel !== channelFilter) return false;
  return true;
});

function toggleStatus(id: string) {
  setStatusFilter((curr) => (curr === id ? null : id));
}
```

### Edge cases

- **0 leads no período** → bloco "Por status" não renderiza (volta a só ter os 3 KPIs do topo).
- **Lead sem `kommoStatus`** (legacy) → entra no bucket `__none__` com nome "Sem status" e bolinha cinza neutra.
- **Cache `kommoStages` vazio** → fallback pra ID cru como nome (mesmo comportamento atual dos badges).
- **Status filtrado vazio depois de combinar com outros filtros** → empty state atual da tabela ("Nenhum lead encontrado") continua válido.

---

## 5. Item 3 — Drawer lateral

### Componente novo: `src/components/dashboard/lead-detail-drawer.tsx`

API:
```tsx
interface LeadDetailDrawerProps {
  leadId: string | null;   // null = fechado
  onClose: () => void;
}

export function LeadDetailDrawer({ leadId, onClose }: LeadDetailDrawerProps) { ... }
```

### Comportamento

- Renderiza `null` se `leadId === null` (sem painel, sem backdrop).
- Quando `leadId` muda pra string: monta backdrop `bg-black/60` em z-50 + painel slide-in pela direita (CSS transition `translate-x`).
- **Fecha em 3 ações:** botão `[×]` no canto superior direito, click no backdrop, tecla `ESC` (event listener com cleanup).
- Trava scroll do body enquanto aberto (`document.body.style.overflow = "hidden"` com cleanup).
- **URL NÃO muda** — drawer puro, sem rota nova. Voltar pra lista é instantâneo.
- `useEffect` faz `fetch('/api/leads/${leadId}')` quando `leadId` muda; mostra skeleton enquanto carrega.

### Conteúdo do drawer

```
┌─ Maria Silva ──────────────────────── [×] ─┐
│ ● Agendado  (badge cor Kommo)              │
│                                            │
│ Telefone:  (11) 99999-1234                 │
│ Canal:     Campanha                        │
│ UTM:       facebook-conversao-2026         │
│ Criado:    12/mai/2026 às 10:30            │
│ Agendado:  14/mai/2026 às 09:15            │
│                                            │
│ Jornada                                    │
│ ● 12/mai 10:30  Lead capturado no Kommo    │
│ ● 14/mai 09:15  Agendado                   │
│ ● 15/mai 14:00  Virou paciente             │
│                 → [Ver perfil completo]    │
│ ● 16/mai 10:20  Limpeza dental  R$ 350 ✓  │
│                                            │
│ ─────────────────────────────────────────  │
│ [Abrir no Kommo ↗]                         │
└────────────────────────────────────────────┘
```

### Timeline — eventos derivados

Computados client-side a partir do payload do endpoint:

| Evento | Condição | Data | Descrição |
|---|---|---|---|
| **Lead capturado** | sempre | `kommoCreatedAt` (fallback `createdAt`) | "Lead capturado no Kommo" |
| **Agendado** | `agendamentoAt != null` | `agendamentoAt` | "Agendado" |
| **Virou paciente** | `patientId != null` | `patient.firstContact` ou `patient.createdAt` | "Virou paciente" + link `/dashboard/patients/[id]` |
| **Procedimento** (1 por proc) | patient + cada `procedure` | `proc.completedAt ?? proc.createdAt` | `${proc.name}  R$ ${value}  ${✓ se Aprovado}` |

Ordenado por data ascendente.

### Limitação documentada

Não temos histórico de **mudanças de stage do Kommo** armazenado (só o estado atual). Se Bruno quiser ver "passou por Em qualificação → Interesse → Investimento → Agendado", seria outro PR (sync de `/events` do Kommo, schema novo). Documentado como `[LEAD-3]` no IMPROVEMENTS.md (item futuro).

### Link "Abrir no Kommo"

`https://${clinic.kommoSubdomain}.kommo.com/leads/detail/${lead.kommoLeadId}`, abre em `target="_blank"` com `rel="noopener noreferrer"`.

---

## 6. Endpoint novo: `GET /api/leads/[id]`

### Request
- Path param: `id` (Lead.id do nosso DB, cuid)
- Auth: via `getAuthorizedClinicId` (mesmo middleware das outras rotas)

### Response

```ts
{
  data: {
    id: string;
    kommoLeadId: string;
    name: string;
    phone: string | null;
    channel: string;
    utmSource: string | null;
    utmMedium: string | null;
    utmCampaign: string | null;
    utmContent: string | null;
    kommoStatus: string | null;
    statusName: string | null;   // enriquecido via Clinic.kommoStages
    statusColor: string | null;
    kommoCreatedAt: string | null;
    createdAt: string;
    agendamentoAt: string | null;
    patient: {
      id: string;
      firstContact: string;
      procedures: {
        id: string;
        name: string;
        value: number;
        discountAmount: number;
        statusDescription: string | null;
        completedAt: string | null;
        createdAt: string;
      }[];
    } | null;
  }
}
```

### Erros

- `401` se não autenticado
- `404` se lead não existe OU pertence a outra clínica (mesmo erro pra evitar leak de existência)

### Multi-tenancy

`prisma.lead.findFirst({ where: { id, clinicId } })` — filtra clinicId obrigatoriamente. Sem isso, código viola SEC-1.

---

## 7. Bump de versão

| Arquivo | De | Para |
|---|---|---|
| `package.json` `version` | `0.44.1` | `0.45.0` |
| `src/lib/version.ts` `APP_VERSION` | `"0.44.1"` | `"0.45.0"` |
| `src/lib/version.ts` `CHANGELOG[0]` | (n/a) | nova entrada `version: "0.45.0", type: "minor"` |

Entrada do CHANGELOG (pt-BR, padrão do projeto):

```ts
{
  version: "0.45.0",
  date: "2026-05-14",
  type: "minor",
  changes: [
    "DASH-8: 3 ajustes pedidos pelo Bruno (esconder LTV/Campanhas, leads por status, drawer de detalhe)",
    "Sidebar: LTV & ROAS e Campanhas foram ocultados da nav (flag hidden no array navItems). Rotas continuam funcionais por URL direta — voltam ao menu quando começarem os anuncios",
    "Leads: bloco 'Por status' com mini cards (1 por status do Kommo, cor + nome + count). Click no card filtra a tabela. Mostra onde os leads estao parados no funil",
    "Leads: clicar num nome abre drawer lateral com info basica + timeline (capturado -> agendado -> virou paciente -> procedimentos) + link 'Abrir no Kommo'. URL nao muda (sem rota nova)",
    "Endpoint novo: GET /api/leads/[id] retorna lead enriquecido + patient + procedures (multi-tenant filtered)",
  ],
}
```

---

## 8. Testes

Cobertura desejada:

| Componente | Testes |
|---|---|
| `lead-detail-drawer.tsx` | fora de escopo unit testar componente client com timer/fetch — testes mais valiosos seriam E2E (Playwright), e não temos infra E2E. Cobertura manual via test plan do PR. |
| `/api/leads/[id]` | **deve ter unit test** se houver tempo — mas seguindo padrão atual do projeto, endpoints de read simples não têm tests dedicados (ver `/api/leads/route.ts`, sem test). Vou pular pra não criar pattern inconsistente. |
| status-counting client-side | função pura — `useMemo` que faz reduce. **Tirar como função `groupLeadsByStatus(leads)` exportada** + 4-5 unit tests cobrindo: 0 leads, leads sem status, leads com statusColor null, ordem por count desc, soma de counts == total. |

Decisão: ✅ unit-testar `groupLeadsByStatus`, deixar drawer e endpoint pra teste manual.

---

## 9. Validação pré-PR

```bash
npm ci
npx prisma generate
npm run lint
npx tsc --noEmit
npm test
npm run build
```

Validação manual (test plan no PR):

- [ ] Sidebar sem LTV & ROAS e sem Campanhas
- [ ] Acessar `/dashboard/ltv` por URL direta — página carrega
- [ ] Bloco "Por status" aparece em `/dashboard/leads` se há leads no período
- [ ] Click em status filtra a tabela; 2º click no mesmo limpa
- [ ] Filtro de status combina com busca e filtro de canal (AND)
- [ ] Click em nome de lead abre drawer
- [ ] Timeline mostra eventos na ordem correta
- [ ] Lead que virou paciente tem link funcional pro perfil
- [ ] ESC, click fora e [×] fecham o drawer
- [ ] Scroll do body trava enquanto drawer aberto
- [ ] "Abrir no Kommo" abre em nova aba com URL correta

---

## 10. Riscos e mitigação

| Risco | Mitigação |
|---|---|
| Drawer travar scroll do body e esquecer de destrava no unmount | useEffect com cleanup explícito |
| Endpoint `/api/leads/[id]` retornar dados de outra clínica | `findFirst({ where: { id, clinicId } })` obrigatório |
| Bug do filtro de status quebrar listagem se `kommoStatus` for null | bucket `__none__` tratado explicitamente; testado em unit |
| Sidebar quebrar layout se algum item ficar com `hidden: undefined` | filter `!item.hidden` aceita undefined como falsy, OK |

---

## 11. Fora de escopo

Itens que **não** entram neste PR:

- Histórico completo de stage transitions do Kommo (`[LEAD-3]` futuro)
- Reativar LTV/Campanhas com features novas (separado quando começarem anúncios)
- Pesquisa/filtros adicionais na lista de leads
- Paginação além de 100 leads atuais
- Export CSV
- Edição de leads pela UI
