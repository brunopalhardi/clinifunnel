# DASH-11 — Lista de leads no final do Dashboard de Captação

> **Status:** spec aprovada
> **Versão alvo:** 0.48.0 (minor — feature nova)
> **Item de backlog:** abrir em `docs/IMPROVEMENTS.md` como `DASH-11`

## Contexto

Hoje o dashboard `/dashboard/captacao` mostra KPIs, funil, gráficos e composição de receita — tudo agregado. Pra ver leads individuais, o usuário precisa navegar pra `/dashboard/leads`. Bruno quer poder olhar quem está no funil **sem sair da captação**, com acesso rápido aos detalhes do lead (timeline, procedimentos, alertas).

Já existe:
- `LeadDetailDrawer` em `src/components/dashboard/lead-detail-drawer.tsx` (timeline + procedimentos) — usado em `/leads`.
- `/api/leads` retorna leads com `patient`, enriquecidos com `statusName`/`statusColor` do cache do Kommo, ordenados por `kommoCreatedAt desc`, limite 100. Aceita `from`, `to`, `channel`, `campaign`, `allPipelines`.
- `/api/reminders` retorna reminders (Recall/Inativo/Pós-consulta) agrupados por urgência (overdue/urgent/upcoming). Hoje retorna tudo da clínica — filtro por paciente é client-side.
- Página `/leads` já implementa grouping por status (`groupLeadsByStatus`), chip de status colorido (`statusColor` do Kommo), e abertura do drawer ao clicar.

## Objetivo

Adicionar **lista de leads** como último bloco da página `/dashboard/captacao`, com tabs por estágio do funil, respeitando o filtro de data global. Click em um lead abre o `LeadDetailDrawer` existente, **estendido com seção de alertas ativos** quando o lead tem `patientId`.

## Não-objetivo

- Busca por nome / filtro avançado (existe em `/leads`).
- Exportar CSV.
- Ações em massa.
- Editar status do lead direto da lista (continua sendo feito no Kommo).
- Adicionar `patientId` como query param à API `/api/reminders` (filtro client-side é suficiente).

## UI

### Posição

Novo bloco como **último filho** do container principal de `src/app/dashboard/captacao/page.tsx`, depois do "Insight automático" (linha ~421 do estado atual).

### Estrutura visual

```
┌──────────────────────────────────────────────────────────────┐
│ Leads no funil                                  120 leads    │
├──────────────────────────────────────────────────────────────┤
│ ┌───────┬───────────┬──────────┬────────────┐                │
│ │ Todos │ Agendados │ Fecharam │ Sem agendar│                │
│ │  120  │    45     │    12    │     63     │                │
│ └───────┴───────────┴──────────┴────────────┘                │
│                                                              │
│ Nome              Telefone           Status         →        │
│ Wesley Bruno     (11) 99999-9999   ● Agendado     →        │
│ Ana Carolina     (11) 98888-8888   ● Atendido     →        │
│ ...                                                          │
│                                                              │
│ Mostrando 50 de 120 leads      [Ver mais leads]              │
└──────────────────────────────────────────────────────────────┘
```

**Detalhes:**

- Wrapper: `rounded-xl bg-card p-6 glass-border` (consistente com outros cards).
- Header: `font-display text-lg font-semibold` + contador discreto.
- **Tabs**: 4 abas controladas via estado local `tab: "todos" | "agendados" | "fecharam" | "sem-agendar"`.
  - Cada tab mostra a contagem entre parênteses.
  - Estado ativo: borda inferior + cor primária.
  - Estilo igual às tabs já usadas em `/dashboard/patients` (Lista/Alertas).
- **Filtro client-side** dos leads recebidos:
  - `todos`: sem filtro.
  - `agendados`: `lead.agendamentoAt != null` E sem procedure aprovada.
  - `fecharam`: `lead.patient?.procedures` tem algum aprovado.
  - `sem-agendar`: `lead.agendamentoAt == null`.
- **Tabela**: 4 colunas — Nome, Telefone, Status (chip colorido com `statusColor` do Kommo igual `/leads`), seta `→` (visual cue de clicável).
  - Hover: `hover:bg-muted/30 cursor-pointer`.
  - Click na linha: `setOpenLeadId(lead.id)` → drawer abre.
  - Telefone formatado igual `/leads`. Se null, mostra `—`.
  - Status: usa mesma renderização do chip já em `src/app/dashboard/leads/page.tsx` (linhas ~190-200).
- **Paginação client-side**: mostra 50 por vez. Botão "Ver mais leads" carrega +50. Some quando todos visíveis.
- **Empty state por tab**: se filtro resulta em 0, mostra texto sutil `Sem leads nessa categoria no periodo.`

### Mobile

- Tabs com scroll horizontal se não couberem.
- Tabela com `overflow-x-auto`. Telefone e status podem encolher (sem stickyness).

## Dados

### Endpoint

Reusar `/api/leads` existente. O cliente da captação faz fetch paralelo:

```ts
// dentro do useEffect / fetchData de captacao/page.tsx
fetch(`/api/leads?from=${from}&to=${to}`)
```

- Sem `channel` nem `campaign` (queremos todos do pipeline).
- Sem `allPipelines=true` (queremos só o pipeline configurado em `clinic.pipelineId` — o default já filtra por isso).
- Limite 100 (default da rota) — suficiente porque a página já paginaria client-side.

**Observação sobre limite:** A rota hoje retorna `take: 100`. Se um range tem >100 leads, o usuário verá o aviso de paginação mas o dataset está truncado. Aceitável no escopo atual (volume da AD raramente passa 100 leads no range padrão). Caso o limite fique apertado em uso real, expandir a rota com paginação real fica como follow-up — não bloqueia este PR.

### Loading / erro

- Loading: skeleton de 3 linhas no espaço da tabela enquanto fetch roda.
- Erro: mensagem `Erro ao carregar leads. Tente recarregar a pagina.` (não bloqueia o resto da página, KPIs continuam ok).
- Estado independente do fetch dos KPIs (`/api/dashboard`). Os dois rodam em paralelo.

## Drawer estendido — alertas ativos

### Mudanças no `LeadDetailDrawer`

Arquivo: `src/components/dashboard/lead-detail-drawer.tsx`.

Adicionar nova seção **"Alertas ativos"** que renderiza apenas quando:
1. O lead carregado tem `patient` não-null (virou paciente), E
2. Existe ao menos 1 reminder pendente para esse paciente.

### Fetch de alertas

Quando o drawer abre com `leadId != null`, além do fetch existente do lead, fazer um fetch adicional:

```ts
fetch("/api/reminders")
  .then((r) => r.json())
  .then((data) => {
    // data tem { overdue, urgent, upcoming } — arrays de reminder
    const all = [...data.overdue, ...data.urgent, ...data.upcoming];
    // Filtra pelo patient atual (depois que `lead` carregar e tivermos `lead.patient.id`)
    const mine = all.filter((r) => r.patient.id === lead.patient.id);
    setAlerts(mine);
  });
```

- O fetch de reminders pode ser feito em paralelo com o de lead, mas a **filtragem** depende de ter `lead.patient.id`. Estratégia: dispara os dois fetches juntos, e quando ambos resolverem, faz o filtro.
- Se `lead.patient == null` (lead ainda não virou paciente), pula a renderização da seção mesmo que reminders carreguem.

### UI da seção

Renderizada acima da seção de procedimentos no drawer. Estrutura:

```
┌─────────────────────────────────────────┐
│ Alertas ativos (3)                      │
├─────────────────────────────────────────┤
│ ● Recall — Botox                        │
│   Atrasado há 12 dias                   │
│   [Tratar ▾]                            │
├─────────────────────────────────────────┤
│ ● Inativo                               │
│   Última consulta em Jan/26             │
│   [Tratar ▾]                            │
└─────────────────────────────────────────┘
```

- Mesmas urgências e ações da página `/dashboard/patients?tab=alertas` (DASH-9): 4 opções no menu Tratar (Tratado / Adiar 7d / Adiar 30d / Dispensar).
- Click em Tratar dispara `POST /api/reminders/action` (mesmo endpoint já usado em `/patients`).
- UX otimista: alerta some imediatamente, rollback em caso de erro.

### Componente compartilhado

A página `/patients` já tem JSX que renderiza esses cards de alerta. **Decisão**: neste PR, extrair pra `src/components/dashboard/reminder-card.tsx` e consumir nos dois lugares (`/patients` e drawer). Mantém DRY desde o primeiro uso e evita drift entre as duas renderizações. O componente exporta tanto o card visual quanto o handler de `POST /api/reminders/action` com UX otimista (alerta some imediatamente, rollback em caso de erro).

Se a extração revelar acoplamentos não-óbvios com o estado da `/patients` (refresh da listagem, contagem do badge), reduzir o escopo: inline o JSX no drawer e abrir item de refatoração separado. O plano de implementação deve começar inspecionando o componente atual em `/patients` antes de extrair.

## Versionamento

- `package.json`: `0.47.0` → `0.48.0`.
- `src/lib/version.ts`: `APP_VERSION = "0.48.0"` + entrada no CHANGELOG:

```
{
  version: "0.48.0",
  date: "2026-05-19",
  type: "minor",
  changes: [
    "DASH-11: Lista de leads no final do Dashboard de Captacao",
    "4 tabs: Todos / Agendados / Fecharam / Sem agendar (filtro client-side)",
    "Respeita o filtro de data global (mesma fonte dos KPIs)",
    "Click no lead abre LeadDetailDrawer com timeline + procedimentos",
    "Drawer agora mostra secao 'Alertas ativos' quando o lead virou paciente e tem reminder pendente",
  ],
}
```

## Backlog

Abrir `DASH-11` em `docs/IMPROVEMENTS.md` (Em andamento).

## Plano de rollout

1. Mudanças puramente de frontend + JSX no drawer. Sem migration. Sem mudança de API.
2. Deploy via pipeline normal (Github Actions → docker stack deploy).
3. Rollback: reverter PR. Drawer volta ao estado pre-DASH-11 sem perda de dado.

## Riscos

- Performance: a página da captação vai disparar 1 fetch extra (`/api/leads`). A rota é leve (`take: 100` + 1 join). Aceitável.
- Filtro client-side por `patientId` no drawer: se o cliente tiver muitos reminders, fetch retorna tudo. Volume real da AD é pequeno; otimização (query param `patientId`) fica como follow-up.

## Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `src/app/dashboard/captacao/page.tsx` | + bloco "Leads no funil" com tabs e tabela; + fetch `/api/leads`; + state do drawer |
| `src/components/dashboard/lead-detail-drawer.tsx` | + fetch de reminders; + seção "Alertas ativos"; + integração com `/api/reminders/action` |
| `src/components/dashboard/reminder-card.tsx` | + extração do card de alerta (compartilhado entre /patients e drawer) |
| `src/app/dashboard/patients/page.tsx` | passa a consumir `ReminderCard` |
| `src/lib/version.ts` | bump 0.48.0 + changelog |
| `package.json` | bump 0.48.0 |
| `docs/IMPROVEMENTS.md` | + item DASH-11 |
