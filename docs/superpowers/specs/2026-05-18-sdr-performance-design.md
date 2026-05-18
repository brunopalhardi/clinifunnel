# SDR Performance no Dashboard de Captação

> **Status:** spec aprovada
> **Versão alvo:** 0.47.0 (minor — feature nova)
> **Item de backlog:** abrir em `docs/IMPROVEMENTS.md` como `DASH-10` (Performance por SDR)

## Contexto

O dashboard de Captação (`/dashboard/captacao`) hoje mostra funil, leads por período, composição da receita, canal de prospecção e top procedimentos. Não há visibilidade de **quem é a SDR responsável** pelo lead.

No Kommo, cada lead tem um custom field chamado **"Vendedora"** (lista). Atualmente as opções são `SDR` e `Ingrid`. Esse campo não é extraído pelo webhook nem persistido no banco. Bruno precisa acompanhar a performance por SDR diretamente no dashboard.

## Objetivo

Adicionar uma seção "Performance por SDR" na página de captação, com funil completo (leads → agendados → compareceram → fecharam → receita) agrupado por vendedora.

## Não-objetivo

- Backfill de leads históricos. Leads anteriores ao deploy ficam sem SDR.
- Filtro global do dashboard por SDR.
- Página dedicada de SDRs.
- Edição/criação de SDRs no app (gestão fica no Kommo).

## Modelo de dados

### Migration `add_lead_vendedora`

Nova coluna na tabela `Lead`:

```prisma
model Lead {
  // ... campos existentes
  // Vendedora/SDR responsavel (Kommo custom field "Vendedora")
  vendedora       String?
  // ...
}
```

- `String?` (nullable). Leads anteriores ao deploy ficam `null`.
- Sem índice por enquanto (cardinalidade baixa, filtro só na agregação).
- Sem coluna equivalente em `Patient` — SDR é métrica de captação, não de paciente.

## Extração do Kommo

### Nova função `extractVendedora`

Em `src/lib/kommo/utm.ts`, padrão idêntico a `extractCanalProspeccao`:

```ts
export function extractVendedora(
  fields: KommoCustomField[] | null | undefined
): string | null {
  if (!fields) return null;
  for (const field of fields) {
    const name = field.field_name?.toLowerCase() ?? "";
    if (name.includes("vendedora")) {
      if (field.values.length > 0) return field.values[0].value;
    }
  }
  return null;
}
```

Match case-insensitive no `field_name` contendo `"vendedora"`. Retorna o `value` da primeira opção selecionada (campos de lista no Kommo guardam o label da opção em `value`).

### Webhook handler

Em `src/app/api/webhooks/kommo/route.ts`, na função que processa lead criado/atualizado:

1. Chamar `extractVendedora(kommoLead.custom_fields_values)`.
2. Passar pro `prisma.lead.upsert` no `create` E no `update` (mesmo padrão de `canalProspeccao`).

## Agregação no `/api/dashboard`

Em `src/app/api/dashboard/route.ts`, adicionar ao payload:

```ts
interface SdrPerformance {
  vendedora: string;           // "Sem SDR" quando null
  leads: number;
  agendados: number;
  compareceram: number;
  fecharam: number;
  receita: number;
  conversao: number;           // (fecharam / leads) * 100, 0 se leads=0
}

// payload
sdrPerformance: SdrPerformance[];
```

**Lógica:**

- Carregar leads do range com `vendedora`, `agendamentoAt`, `patientId` (já estão na query existente).
- Agrupar por `vendedora ?? "Sem SDR"`.
- Para cada grupo:
  - `leads` = count de leads do grupo
  - `agendados` = leads do grupo com `agendamentoAt != null` ou `kommoStatus` indicando agendado (usar mesma lógica já aplicada no KPI `agendamentos`)
  - `compareceram` = leads do grupo cujo paciente tem appointment `realizada` no range
  - `fecharam` = leads do grupo cujo paciente tem procedure no range
  - `receita` = soma de procedures dos pacientes do grupo
  - `conversao` = `leads > 0 ? (fecharam / leads) * 100 : 0`
- Ordenar por `leads` desc.
- Bucket "Sem SDR" só aparece se houver pelo menos 1 lead nulo no range.

**Reaproveitar lógica existente**: as queries de agendados/compareceram/fecharam/receita já existem na rota. Adicionar o agrupamento por SDR como passo extra na mesma query (`groupBy` por `vendedora` ou loop em memória depois de buscar os leads, dependendo de qual já é o padrão da rota — decidir na implementação ao ver o código atual).

## UI

### Posição

Novo card entre o bloco `Funnel + Revenue Chart` (linha que termina por volta da linha 288 em `src/app/dashboard/captacao/page.tsx`) e o card `Composicao da receita` (linha 291).

### Componente `<SdrPerformance />`

Renderizado inline em `page.tsx` (padrão das outras seções, não vira componente separado).

**Estrutura:**

```
┌─────────────────────────────────────────────────────────────┐
│ Performance por SDR                              N SDRs     │
├─────────────────────────────────────────────────────────────┤
│ SDR     │ Leads │ Agend. │ Comp. │ Fechou │ Receita │ Conv. │
│ Ingrid  │  120  │   80   │  60   │   25   │ R$ 45k  │ 20.8% │
│ SDR     │   45  │   20   │  15   │    5   │ R$ 12k  │ 11.1% │
│ Sem SDR │   10  │    5   │   2   │    1   │ R$ 3k   │ 10.0% │
└─────────────────────────────────────────────────────────────┘
```

**Detalhes visuais:**

- Wrapper: `rounded-xl bg-card p-6 glass-border` (consistente com outros cards).
- Header: `font-display text-lg font-semibold` + contador discreto à direita (`"{N} SDRs"`).
- Tabela:
  - `<table>` semântica com `<thead>`/`<tbody>`.
  - Header: `text-xs uppercase tracking-wider text-muted-foreground`, border-bottom suave.
  - Linhas: padding vertical confortável, hover state sutil (`hover:bg-muted/30`).
  - Coluna SDR à esquerda, métricas alinhadas à direita.
  - Receita formatada via helper `fmtK` existente.
  - Conv. % em verde (`text-success`) se ≥ 20%, neutro caso contrário.
- Linha do topo (melhor performance por leads): pequeno ícone de destaque ou peso de fonte maior na vendedora.

**Empty state:**

Se `sdrPerformance.length === 0`, o card inteiro não é renderizado (`{d.sdrPerformance && d.sdrPerformance.length > 0 && (...)}`). Sem placeholder de "Conecte o Kommo" porque o Kommo já está conectado por definição (todo lead vem dele).

**Responsivo:**

- Mobile: tabela rola horizontalmente (`overflow-x-auto`). Coluna SDR fica sticky à esquerda se possível com Tailwind puro; senão, scroll horizontal simples está OK.

## Testes

### Unit (`src/lib/kommo/utm.test.ts`)

Adicionar bloco `describe("extractVendedora")` com casos:

- `null`/`undefined` → retorna `null`.
- Lista sem campo "vendedora" → `null`.
- Campo "Vendedora" com valor "Ingrid" → `"Ingrid"`.
- Variações de caixa: "VENDEDORA", "vendedora", "Vendedora" → todas funcionam.
- Campo presente mas sem `values` → `null`.
- Múltiplos campos, só um é vendedora → pega o certo.

### Sem testes de UI

Padrão do projeto.

### Verificação manual (Bruno)

Após deploy:

1. Criar lead novo no Kommo com Vendedora = Ingrid.
2. Conferir no `/dashboard/captacao` que a linha "Ingrid" aparece com leads=1.
3. Mover lead pra Agendado e conferir incremento na coluna Agend.
4. Verificar que leads sem vendedora caem em "Sem SDR" (criar um sem preencher o campo).

## Versionamento

- `package.json`: `0.46.0` → `0.47.0`.
- `src/lib/version.ts`: `APP_VERSION = "0.47.0"` + nova entrada no `CHANGELOG`:

```
{
  version: "0.47.0",
  date: "2026-05-18",
  changes: [
    "Performance por SDR no Dashboard de Captacao (DASH-10)",
    "Novo campo Vendedora extraido do Kommo e persistido no Lead",
    "Tabela com funil completo (leads -> agendados -> compareceram -> fecharam -> receita) agrupado por SDR",
  ],
}
```

## Backlog

Adicionar item em `docs/IMPROVEMENTS.md`:

- **DASH-10 — Performance por SDR no dashboard de captação** (em andamento → concluído ao mergear).

## Plano de rollout

1. Migration deploya automaticamente via `docker-entrypoint.sh` (sem destrutivo).
2. Webhook começa a popular `vendedora` em todo lead criado/atualizado a partir do deploy.
3. Card aparece no dashboard. Primeiros minutos: maioria fica em "Sem SDR" até leads serem atualizados no Kommo.
4. Sem rollback complicado: se algo der errado, basta reverter o PR. A coluna `vendedora` pode ficar no banco vazia sem impacto.

## Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `prisma/schema.prisma` | + campo `vendedora` em `Lead` |
| `prisma/migrations/.../migration.sql` | nova migration `add_lead_vendedora` |
| `src/lib/kommo/utm.ts` | + `extractVendedora` |
| `src/lib/kommo/utm.test.ts` | + testes de `extractVendedora` |
| `src/app/api/webhooks/kommo/route.ts` | extrai e persiste `vendedora` |
| `src/app/api/dashboard/route.ts` | + agregação `sdrPerformance` no payload |
| `src/app/dashboard/captacao/page.tsx` | + tipo `SdrPerformance` + card UI |
| `src/lib/version.ts` | bump 0.47.0 + changelog |
| `package.json` | bump 0.47.0 |
| `docs/IMPROVEMENTS.md` | + item DASH-10 |
