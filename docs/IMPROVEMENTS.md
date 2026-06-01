# IMPROVEMENTS — Backlog de Melhorias

Backlog rastreavel de melhorias do CliniFunnel. Toda PR deve referenciar um item daqui (ou registrar um novo). Quando a PR e mergeada, mover o item para "Concluidos" com link do PR e versao.

Estrutura por eixo: **Seguranca**, **Qualidade**, **Observabilidade**, **Multi-tenant**, **Features**.

---

## Em andamento

- **[UX-1] Redesign visual completo (PRs 3-5)**
  PR1 (login + tokens) entregue em v0.39.0. PR2 (sidebar + header) entregue em v0.40.0. Pendente: PR3 dashboard overview (KPIs + cards), PR4 leads/pacientes/financeiro/etc, PR5 polimento (vazios, erros, formularios). 29 usos de bg-gold/text-gold ainda em paginas internas — consolidados em PR3/4.
  Eixo: produto/ux · Bump: minor por PR

### Proxima Fase (planejada, nao iniciada)

- **[INFRA-2] Fase 2: PG + Redis dentro do Swarm + secrets**
  Migrar Postgres e Redis nativos do host para services do swarm. Substituir env_file por docker secrets. Avaliar healthcheck 503 com >=2 replicas web (failover). Subir replicas pra ter rolling update real.
  Eixo: infra · Bump: spans em multiplos PRs

- **[INFRA-3] Build em registry cache + redutor de tempo de build**
  Hoje primeiro build leva 10-15min. Otimizar: BuildKit inline cache + multi-arch (se necessario). Considerar dependencias-only stage com hash de package-lock.

---

## Proximos

### Seguranca

- **[SEC-2.2] Validar autenticidade dos webhooks de entrada**
  Confirmar que payload de Kommo/Clinicorp nao pode ser forjado pra atribuir leads/procedimentos a outra clinica. Hoje matching e por subdomain (Kommo) ou businessId (Clinicorp). Considerar HMAC compartilhado por clinica.
  Eixo: seguranca · Bump: minor

- **[SEC-2.3] Prisma extension que rejeita queries multi-tenant sem clinicId**
  Defesa em profundidade: extension lanca erro se findFirst/findMany em Lead/Patient/Procedure/AdCampaignData nao incluir `clinicId` no `where`. Forca correcao em build/test, evita regressoes humanas. Trade-off: complexidade da extension.
  Eixo: seguranca · Bump: patch (refactor)

### Arquitetura

- **[ARCH-1] Estrutura modular + feature flags**
  Reorganizar codigo em modulos coesos (auth, leads, patients, ads, billing, etc) com fronteiras claras. Adicionar feature flags por modulo/clinica (tabela `FeatureFlag` ou config em env) pra liberar features pra clinicas especificas em rollout incremental.
  Eixo: arquitetura · Bump: spans em multiplos PRs (vai mexer em quase tudo)

### Usuarios e RBAC

- **[USR-1.2.1] DELETE/PATCH de usuarios**
  UI ja existe ([USR-1.2]); falta endpoint+botao pra remover/editar role+nome. Considerar soft-delete (campo deletedAt) pra preservar audit trail vs hard-delete.
  Eixo: usuarios · Bump: minor

- **[USR-1.3.1] Aplicar requirePermission em todas as rotas API**
  USR-1.3 fez foundation + aplicou em /api/sync. Resta aplicar em /api/leads (read), /api/patients (read+write), /api/procedures (read+write), /api/campaigns (read), /api/ltv (read), /api/financeiro (read), /api/ads/* (write), /api/settings (write), /api/clinics (write). Conditional rendering no dashboard com useCanAccess.
  Eixo: usuarios · Bump: minor (incremental)

### Qualidade

- **[QA-1.1] Integration tests com Postgres real**
  Vitest + Postgres service no GitHub Actions + transactional rollback per test. Cobrir: cross-tenant via auth-guard + Prisma findFirst (regressao do bug fixado em SEC-2), webhooks Kommo/Clinicorp end-to-end, lazy migration de tokens cifrados ($extends + decrypt no read).
  Eixo: qualidade · Bump: minor
  Nota: depende de [QA-1] (ja pronta — vitest config + 51 unit tests).

- **[QA-2] Lint mais rigoroso**
  Adicionar regras: `@typescript-eslint/no-explicit-any`, `no-floating-promises`, `prefer-nullish-coalescing`. Corrigir violacoes existentes.
  Eixo: qualidade · Bump: patch

### Observabilidade

- **[OBS-1.1] Correlation ID por request (async hooks)**
  Logs estruturados (OBS-1) cobrem workers e webhooks. Falta correlation id automatico — cada request HTTP gera um requestId que se propaga via AsyncLocalStorage por toda chamada subsequente, incluindo workers enfileirados pelo request. Permite trace distribuido sem APM.
  Eixo: observabilidade · Bump: minor

### Integracoes

- **[INT-5] Sincronizar profissionais do Clinicorp**
  Botao "Importar profissionais do Clinicorp" na tela INT-3. Puxa lista via API do Clinicorp e pre-preenche entradas do mapa (faltando so casar com nomes do Kommo). Reduz friccao de onboarding pra clinicas novas.
  Eixo: integracoes · Bump: patch

### Features

- **[FEAT-1] Canal WhatsApp**
  Captura de leads via webhook do WhatsApp Business / Z-API. Modelagem de canal, dedup com Kommo, UTM passthrough.
  Eixo: feature · Bump: minor

- **[FEAT-2] Lembretes proativos por procedimento (envio via WhatsApp/Kommo)**
  DASH-9 (v0.46.0) entregou a base: calculo + UI manual de tratamento. Proximo passo: enviar automatico via Z-API/WhatsApp Business quando alerta entra em "Urgente". Depende de [FEAT-1] estar pronto (canal WhatsApp). Marcado como [DASH-9.1] no spec.
  Eixo: feature · Bump: minor

---

## Concluidos

- **[CAP-14] Performance por SDR event-time (coerente com o funil)** — PR #_TBD_ — v0.52.0
  A tabela "Performance por SDR" contava Agend./Comp./Fechou por safra de captacao + coluna "Agendado" do Kommo -> dava ~0 em range curto (enganoso). Rework: `agendados`/`compareceram` por SDR agora vem das **consultas do Clinicorp no periodo** (event-time), atribuidas a vendedora que captou o paciente (lead no pipeline de captacao, preferindo vendedora preenchida via orderBy nulls-last). `fecharam` = clientes (pacientes distintos), `receita` = soma liquida, ambos por SDR. `leads` segue sendo leads captados no periodo por SDR (cohort). Implementacao: 2 queries novas no /api/dashboard (sdrApptsRaw com statusKey+vendedora; sdrProcsRaw com value/discount/patientId+vendedora) + agregacao em memoria. UI inalterada (mesmas chaves). Limitacao conhecida: depende do campo "Vendedora" preenchido no Kommo (hoje ~42/53 leads sem -> caem em "Sem SDR"); ganho real exige disciplina de CRM. Relacionado: [CAP-13].

- **[CAP-13] Funil de Captacao coerente (fonte de agendadas + unidades + bug do 294)** — PR #97 — v0.51.0
  Apos CAP-12, Bruno notou o funil "sem sentido": 5 agendadas < 9 compareceram < 20 fecharam (inversao impossivel), e "294 leads" intermitente no filtro "30 dias". Tres correcoes: **(1) Bug do 294 (race):** a captacao page disparava o fetch no mount com dateRange vazio -> API sem from/to -> retornava TODO o periodo; essa query "tudo" (mais lenta apos o crescimento de dados) resolvia depois da de 30d e sobrescrevia o resultado. Fix: guarda `if (!dateRange.from || !dateRange.to) return` nos 2 fetches (dashboard + leads). **(2) "Consultas agendadas" via Clinicorp:** passou a usar `consultas.total` (appointments marcados no periodo) em vez da coluna "Agendado" do Kommo (d.agendamentos, subutilizada -> dava 5). `consultas.total` JA e filtrado por `patient.leads.some(pipeline captacao)`, entao conta SO os leads que vieram da captacao (decisao do Bruno: nao pode ser walk-in/recorrente/cliente antigo). Funil agora desce: 53 -> 22 -> 9. **(3) Unidades:** funil "Fecharam procedimento" conta CLIENTES (pacientes distintos, novo `pacientesFecharam` no /api/dashboard via distinct patientId); card "Procedimentos fechados" continua contando procedimentos. Relacionado: [CAP-12].

- **[CAP-12.prevent] Auto-limpeza de imagens Docker no deploy (anti disco-cheio)** — PR #96 — v0.50.1
  Em 2026-06-01 a VPS caiu com disco 100% cheio: `/var/lib/docker` tinha 67G, sendo 33GB de imagens Docker antigas acumuladas a cada deploy (nunca limpas). Postgres (nativo no host) passou a recusar conexoes -> dashboard zerou + "Erro", e o proprio deploy do v0.50.0 nao completou (sem espaco pra baixar a imagem). Recuperado liberando 38GB via `docker image/builder/container prune`. Fix preventivo: `deploy.yml` roda `docker image prune -af` + `docker container prune -f` apos cada deploy. Seguro na VPS compartilhada (image prune -a so remove imagens sem container; traefik/n8n/evolution/portainer preservados; `|| true` nao derruba deploy). Pendente futuro (precisa janela): rotacao de log do Docker via /etc/docker/daemon.json (reinicia daemon -> afeta todos os servicos).

- **[CAP-12] Perda de webhooks Kommo zerava "Consultas agendadas" + funil por data do evento** — PR #95 — v0.50.0
  Bruno reportou que ha ~1 mes "Consultas agendadas" e "Comparecimento" estavam em 0, mesmo com leads agendando. Investigacao (eventos da API do Kommo + webhook logs) confirmou 3 bugs + 1 falha de medicao. **Bug 1 (raiz):** o handler do webhook chamava getLead/getContact de forma sincrona, tomava 429 (rate-limit), engolia o erro e respondia 200 — o Kommo via sucesso e nunca reenviava, perdendo a mudanca de stage (100% das transicoes pra "Agendado" no periodo deram erro). Fix: webhook responde 200 rapido e enfileira; novo worker `process-kommo-lead` faz as chamadas com retry/backoff (attempts:8) que absorve o 429. Logica extraida pra `src/lib/kommo/process-lead.ts` (reusada pelo worker e pelo backfill). **Bug 2:** valor numerico do Kommo (timestamp no campo horario) derrubava o `prisma.lead.upsert` ("Expected String, provided Int") — coercao pra string em `extractAppointmentFields`. **Bug 3 (latente):** parser so lia `leads[status][0]` — agora itera todos os eventos do POST. **Metrica:** "Consultas agendadas" passou a contar por DATA DO EVENTO (`agendamentoAt` no range), nao pela safra de captacao (que zerava porque quem agenda foi captado meses antes); funil "Compareceram" usa a fonte event-time do Clinicorp (igual o card). **Backfill:** `npm run backfill-agendamento` recupera o `agendamentoAt` historico (le eventos do Kommo, `skipPatientCreation` pra nao duplicar agendamento no Clinicorp). Roda no container de workers.

- **[DASH-11] Lista de leads no Dashboard de Captacao** — [PR #91](https://github.com/brunopalhardi/clinifunnel/pull/91) — v0.48.0
  Lista de leads no final da pagina /dashboard/captacao com 4 tabs (Todos / Agendados / Fecharam / Sem agendar), respeita filtro de data global, pagina 50 por vez. Click no lead abre LeadDetailDrawer (timeline + procedimentos), agora estendido com secao "Alertas ativos" quando o lead virou paciente e tem reminder pendente. Refactor: useReminderActions hook + ReminderRow component extraidos de PatientAlerts pra compartilhar com o drawer. Reusa /api/leads existente (sem mudancas no backend). Spec: docs/superpowers/specs/2026-05-19-dash-11-captacao-leads-list-design.md.

- **[DASH-10] Performance por SDR no Dashboard de Captacao** — [PR #90](https://github.com/brunopalhardi/clinifunnel/pull/90) — v0.47.0
  Novo campo `vendedora` no Lead extraido do custom field Kommo "Vendedora" via nova helper `extractVendedora` no webhook. Tabela "Performance por SDR" na /dashboard/captacao com funil completo (Leads -> Agend. -> Comp. -> Fechou -> Receita -> Conv.%) agrupado por SDR, ordenada por leads desc, primeira linha em destaque. Sem backfill: leads anteriores ao deploy aparecem como "Sem SDR". Migration add_lead_vendedora (so adiciona coluna nullable). Spec: docs/superpowers/specs/2026-05-18-sdr-performance-design.md.

- **[DASH-9.1] Fix alertas + seletor de procedimento + sub-menu lateral em /settings** — PR #_TBD_ — v0.46.1
  Bruno reportou apos DASH-9 que alertas nao apareciam mesmo configurando patterns. Investigacao confirmou: a clinica AD nao marca ExecutedDate no Clinicorp — 160/160 procedures Aprovados tinham completedAt=null. Fix: usar COALESCE(completedAt, createdAt) — createdAt ja e o estimate.CreateDate via sync. Aproveitou pra adicionar 2 UX wins: (a) seletor de procedimento na config — endpoint GET /api/procedures/names + <select> com nomes reais (27 distintos), removendo o input texto livre que era propenso a erro de digitacao/cedilha; (b) sub-menu lateral em /dashboard/settings/* via layout.tsx, removendo os 4 links laranja do header da pagina de Integracoes — visual mais limpo e escalavel.

- **[DASH-9] Alertas de retorno configuraveis (recall + inativo + pos-consulta)** — PR #_TBD_ — v0.46.0
  Sistema de alertas espelhando Clinicorp (que nao expoe via API). 3 tipos: recall por procedure (N dias configuravel por pattern), paciente inativo (M meses default 6), pos-consulta (D dias default 3). Tab "Alertas (N)" em /dashboard/patients com 3 minicards + 3 secoes por urgencia. Botao Tratar (Tratado/Adiar 7d/Adiar 30d/Dispensar) com UX otimista. Tela /dashboard/settings/recall com CRUD de patterns + limites + seed de 5 padroes. Schema novo: ProcedureRecallInterval + ReminderAction + 2 campos em Clinic. Lib pura computeReminders com 16 unit tests. Refator de /api/reminders + fix do filtro statusDescription='Aprovado' (era legacy 'completed'). Worker check-reminders orfao deletado. Spec: docs/superpowers/specs/2026-05-14-dash-9-alertas-retorno-design.md.

- **[DASH-8] 3 ajustes acumulados (LTV/Campanhas hidden, leads por status, drawer de detalhe)** — PR #_TBD_ — v0.45.0
  Bruno enviou 3 ajustes agregados num PR so seguindo o padrao DASH-6/DASH-7a. (Item 1) LTV & ROAS e Campanhas saem do menu lateral via flag `hidden: true` em `navItems` (sidebar). Rotas `/dashboard/ltv` e `/dashboard/campaigns` continuam funcionais por URL direta — voltam ao menu quando comecarem os anuncios (1 caractere por item). (Item 2) Pagina `/dashboard/leads` ganha bloco "Por status" abaixo dos KPIs Total/Campanha/Organico com mini cards (1 por status do Kommo, bolinha colorida + nome humano + count, ordenado por count desc). Click filtra a tabela; click no card ativo limpa o filtro. Combina com busca/canal via AND. Edge case: leads sem `kommoStatus` viram bucket `__none__` ("Sem status"). Lib pura `groupLeadsByStatus` em `src/lib/leads/group-by-status.ts` com 6 unit tests. (Item 3) Clicar num lead abre drawer lateral (`src/components/dashboard/lead-detail-drawer.tsx`) com info basica + timeline derivada (capturado no Kommo → agendado → virou paciente → procedimentos com valor liquido) + link "Abrir no Kommo". URL nao muda — drawer puro sem rota nova. Backdrop click/ESC/[×] fecham; scroll do body trava enquanto aberto. Endpoint novo `GET /api/leads/[id]` (multi-tenant filtered via `findFirst` + clinicId obrigatorio) retorna o payload consolidado. Spec: `docs/superpowers/specs/2026-05-14-dash-8-leads-ux-design.md`.

- **[UI-4-fix] Filtro sticky agora funciona de verdade** — PR #_TBD_ — v0.44.1
  Bug em v0.44.0: o hook `useStickyDateRange` lia o localStorage via `useEffect`, mas em React 18 effects sao executados child-first — o `useEffect` do `DateFilter` (que dispara `onFilter` no mount com o `defaultPreset` recebido) rodava ANTES do `useEffect` do hook. Como o `onFilter` chama `save(presetId)`, o valor `fallback` ("30d") era escrito no localStorage ANTES do hook conseguir ler o stored. Resultado: sticky resetava em toda navegacao. Fix: leitura sincrona no mesmo tick via `useState` lazy initializer (padrao seguro porque o helper checa `typeof window === "undefined"` antes de tocar localStorage — mesmo padrao de `src/lib/theme.ts`). Helpers `readStoredPreset` e `writeStoredPreset` extraidos como funcoes puras com 8 unit tests (cobrindo fallback, valores invalidos e o cenario de regressao). Paginas nao precisaram mudar — ja passavam `defaultPreset={initialPreset}` corretamente, agora `initialPreset` ja vem com o valor stored na primeira render.

- **[DASH-7a] 3 ajustes acumulados (OP-1, OP-2, UI-4)** — PR #_TBD_ — v0.44.0
  Bruno enviou 3 ajustes em sequencia agregados num PR so. (OP-1) Card "Pacientes ativos" na pagina Operacao foi trocado por "Ticket medio por cliente" (= totalRevenue / activePatients, com subtitulo "N paciente(s) no periodo"); a clinica considera esse KPI mais util que numero bruto de pacientes ativos. (OP-2) Card "Pipeline pendente" foi renomeado pra "Orcamento em aberto" com subtitulo "N orcamento(s) aguardando" (linguagem da clinica em vez de jargao de funil). (UI-4) Filtro de data agora e sticky entre paginas via localStorage — hook `useStickyDateRange` em `src/hooks/use-sticky-date-range.ts` persiste o preset selecionado (chave `clinifunnel:datePreset`). Aplicado nas 6 paginas com DateFilter (captacao, operacao, leads, procedures, ltv, campaigns). Custom ranges (clicar dias no calendario) NAO sao persistidos — so presets; o trade-off e simplicidade vs valor (custom range geralmente e ad-hoc pra investigacao naquela pagina). DateFilter ganhou 3o argumento `presetId: string | null` no callback `onFilter` (null = custom).

- **[DASH-6] 6 ajustes acumulados (UI-2, UI-3, LEAD-1, LEAD-2, PROC-1, PROC-2)** — PR #_TBD_ — v0.43.0
  Bruno enviou varios ajustes em sequencia que foram agregados num PR so: (UI-2) removido toggle Todos/Novos/Existentes da Captacao; (UI-3) trocado grafico de Receita por periodo por "Leads captados por periodo" (sparkline + total + media + melhor dia) — antes ficava ruim com so 2 barrões em datasets esparsos; (LEAD-1) endpoint /api/sync type=reprocess-names pra backfill nomes "Lead #N" via Kommo getContact; (LEAD-2) Clinic.kommoStages cache (atualizado pelo match-leads worker a cada 15min) traduz Lead.kommoStatus de ID pra nome humano com cor — badge na tabela; (PROC-1) totalizadores Vendas vs Pendente no topo da pagina Procedimentos pra deixar claro o split; (PROC-2) donut e ranking filtrados so por statusDescription='Aprovado'. Migration 20260513000000 adiciona Clinic.kommoStages.

- **[DASH-5] Dashboard dividido em Captacao (Kommo) + Operacao (Clinicorp)** — PR #_TBD_ — v0.42.0
  Visao Geral antiga misturava metricas do Kommo (funil de captacao) com Clinicorp (operacao da clinica), criando confusao sobre o que cada KPI media. Bruno propos dividir. Resultado: `/dashboard/captacao` (Kommo-centric, foco no funil de leads ate procedimento fechado, com linha de comparecimento dos leads do funil + composicao da receita) e `/dashboard/operacao` (Clinicorp-centric, unifica /dashboard/financeiro com agenda TODA a clinica — atendidos, faltas com taxa no-show, confirmadas, aguardando — sem filtro de funil). Sidebar troca "Visao Geral" -> "Captacao" e "Financeiro" -> "Operacao". Redirects de retrocompat: `/dashboard` -> `/dashboard/captacao`, `/dashboard/financeiro` -> `/dashboard/operacao`. Endpoint novo `/api/operacao` agrega financeiro + appointments.groupBy(statusKey) sem filtro de pipeline. Fix interno do funil (Compareceram agora usa appointment.statusKey='atendido' em vez de lead.patient.procedures.some()) incluido aqui.

- **[DASH-4] Consultas realizadas / faltas / confirmadas (status real do Clinicorp)** — PR #_TBD_ — v0.41.0
  Bruno observou que o KPI "Consultas realizadas" media `Lead.agendamentoAt != null` (lead foi pra stage Agendado no Kommo) — mas isso eh consulta MARCADA, nao realizada. Confirmacao do que rolou de fato so existe no Clinicorp, onde as meninas atualizam o status do appointment manualmente no dia (Agendado -> Confirmado -> Atendido / Faltou). DASH-4 cria modelo Appointment + sync periodico + 4 KPIs novos. Schema: Appointment com clinicorpAppointmentId, date, statusKey (`agendado`/`confirmado`/`atendido`/`faltou`/`em_espera`/`em_atendimento`/`atrasado`). Helper `mapAppointmentStatus` mapeia 3 StatusIds canonicos confirmados com a equipe da clinica AD (5818=Atendido, 6447=Confirmado, 5434=Faltou) + fallback por StatusColor pra clinicas futuras. Worker sync-clinicorp puxa `/appointment/list` a cada 15min (junto com estimates), match patient via Patient_PersonId. Endpoint `/api/dashboard` ganha campo `consultas` com breakdown, filtrado por patient com lead no pipelineId. UI: KPI antigo "Consultas realizadas" (linha 1) renomeado pra "Consultas agendadas" (Kommo); linha 2 nova com 4 KPIs (Comparecimento/Faltas/Confirmadas pendentes/Aguardando status) filtrados pelos leads do funil. 11 unit tests.

- **[UX-1.2] Redesign visual PR2: sidebar + header** — PR #_TBD_ — v0.40.0
  Sidebar e header reaplicados com a paleta laranja. Sidebar agora acompanha o tema (antes era sempre escura). Brand vira wordmark "CliniFunnel" sem icone + microsubtitulo "PAINEL CLINICO". Item ativo: fundo laranja 12% + texto laranja escuro + barra esquerda 3px. Toggle de tema migra do rodape da sidebar pra pill no header, junto com avatar (gradiente laranja igual ao login). Header sticky + backdrop-blur. Consolidacao bg-gold->bg-primary em sidebar.tsx+header.tsx (10 usos). Os 29 restantes em paginas internas seguem via alias ate PR3/4. Token --sidebar ganhou valor light (38 32% 89% papel) + dark refinado. Nenhuma mudanca de API de componente; spec em docs/superpowers/specs/2026-05-12-redesign-visual-sidebar-header-design.md.

- **[UX-1.1] Redesign visual PR1: tokens laranja + login** — PR #_TBD_ — v0.39.0
  Substitui paleta ambar/dourado por laranja vivo (#FF7A1A). Light mode "Papel Quente" (alabaster, sem branco puro) + dark mode "Carvao Glow" (preto com glow laranja). Login redesenhado com glass card sobre fundo de grid sutil + glow nos cantos, brand mark com icone "C" em gradiente, pre-titulo + headline maiores, link "Esqueci minha senha" novo (rota /forgot-password placeholder ate fluxo real existir), toggle de modo light/dark no topo direito persistido em localStorage com anti-flash via script inline no <head>. Token `--gold` redirecionado pros mesmos valores HSL de `--primary` pra absorver as 39 ocorrencias legadas em dashboard/leads/sidebar/etc sem regressao — consolidacao `bg-gold`->`bg-primary` vai nos PR2/3. PR1 de 5 do redesign; sequencia: sidebar+header (PR2), dashboard overview (PR3), leads+demais (PR4), polimento (PR5). Helpers de tema com 8 unit tests + jsdom adicionado ao vitest (environment global mudado de node pra jsdom — necessario pra testar localStorage; 161 tests existentes continuam verdes, total 169).

- **[DASH-3] Receita reflete "Venda" do Clinicorp (desconto + status nivel-procedure)** — PR #_TBD_ — v0.38.0
  Bruno reportou que dashboard mostrava R$ 67.480 no range 3-9 mai mas Clinicorp mostrava R$ 60.640 (vendas). Investigacao identificou 3 problemas no sync: (a) status mapeado do `est.Status`, mas 13 procs de 48 eram `StatusDescription="Orçamento"` dentro de estimates APPROVED — incluiam indevidamente como receita; (b) `Estimate.DiscountAmount` (R$ 4.160 no periodo) nao era capturado; (c) procs com `Deleted="X"` nao eram filtrados. Schema migration adiciona 4 campos em Procedure (`discountAmount`, `statusDescription`, `paymentAccounted`, `deleted`). Helper `mapEstimateToProcedures` em `src/lib/clinicorp/procedure-mapper.ts` ratea desconto proporcional ao FinalAmount entre procs Aprovados, com ultimo proc absorvendo residuo de centavos. Worker sync usa o helper + marca deleted=true em procs com `Deleted="X"`. Endpoints `/api/dashboard`, `/api/financeiro`, `/api/procedures`, `/api/metrics` filtram por `statusDescription="Aprovado"` + `deleted=false` (em vez de legacy `status IN ('approved','completed')`) e somam `value - discountAmount` pra receita liquida. 15 unit tests novos. Receita esperada em prod: ~R$ 58.340 no range 3-9 mai. Diff residual de R$ 2.300 vs Clinicorp = sinais de consulta (nao expostos na API publica do Clinicorp — `/payment/list` so retorna parcelas de cartao; webhook do Clinicorp so notifica agendamentos, nao sinais). Gap documentado.

- **[DASH-2] Fix do filtro de data dos leads** — PR #_TBD_ — v0.37.0
  Filtro de data de leads (em /api/dashboard, /api/metrics, /api/leads) agora usa `Lead.kommoCreatedAt` (data de criacao no Kommo, fonte de verdade) em vez de `Lead.createdAt` (timestamp de quando o webhook chegou no nosso DB). Bruno reportou que filtro "ultimos 7 dias" mostrava 26 leads no CliniFunnel mas 18 no Kommo — investigacao confirmou: 9 leads "ruidosos" eram leads antigos do Kommo (alguns de marco/2025!) que so chegaram no nosso DB esses dias porque webhook so dispara em mudanca de stage e `@default(now())` marca a primeira insercao. Helper `buildLeadDateFilter` em `src/lib/dashboard-filters.ts` aplica `kommoCreatedAt` com fallback pra `createdAt` em legacy via Prisma OR (sem COALESCE). Listagem de leads tambem ordena por kommoCreatedAt. 5 unit tests novos. NAO toca em filtros de Procedure (so charts foram corrigidos em [INT-3.1]; KPIs de receita ainda usam createdAt — abrir DASH-3 se discrepancia aparecer).

- **[DASH-1] Composicao da receita por origem** — PR #_TBD_ — v0.36.0
  Card novo na Visao Geral mostra de onde vem cada centavo: Captacao (pacientes com lead no `Clinic.pipelineId` — pipeline "QUALIFICACAO DE LEADS/AGENDAMENTO" da AD), Recorrentes (pacientes com lead em outros pipelines do Kommo, principalmente "PACIENTES RECORRENTES"), Walk-ins (pacientes sem lead capturado — entraram direto pelo Clinicorp). Cada bucket: R$, count e %. Surgiu da investigacao de [INT-3.2]: dos 351 procedures da AD, 181 sao Captacao, ~162 sao Recorrentes (de pipelines diferentes do principal), 144 sao Walk-ins. API ganhou `receitaPorOrigem: {captacao, recorrentes, walkIn, total}`. Filtro patientType nao aplica nos buckets (conceito ortogonal — clinica usa pipelines distintos pra cada caso).

- **[INT-3.2] Investigacao dos "78 orfaos"** — sem PR (so investigacao, conclusao em DASH-1) — 2026-05-10
  Hipotese inicial era "leads legacy com kommoPipelineId errado". Investigacao mostrou: nao sao orfaos, sao procedures de pacientes do pipeline `PACIENTES RECORRENTES` (11651619) e outros pipelines secundarios da AD (13635964 etc). Comportamento atual do dashboard ("Receita do funil" so do pipeline principal) esta CORRETO — leads recorrentes nao deveriam contar como captacao. Mas faltava visibilidade desses 162 procedures na UI: tratado em [DASH-1] com a Composicao da receita.

- **[INT-4] Tela de Health da automacao Kommo->Clinicorp** — PR #_TBD_ — v0.35.0
  Pagina `/dashboard/settings/clinicorp/health` com checklist visual em 1 olhada do que esta OK ou faltando. Cobre: configuracao Kommo (subdomain/token/pipeline/stage), configuracao Clinicorp (user/token/businessId), mapa de profissionais cadastrado, flags `clinicorpAutoCreatePatient` e `clinicorpWebhookEnabled`, sync periodico OK (lastSyncAt/lastMatchAt < 30min), atividade nas 24h (webhooks recebidos por origem, leads e procedures criados), erros recentes em WebhookLog. Validacao opcional dos custom fields no Kommo (DATA E HORA CONSULTA + ATENDIDO POR) carrega em paralelo via `/api/clinics/[id]/health/kommo-fields` com fallback amigavel se Kommo offline ou token expirado. Helper `computeHealthChecks` testavel em `src/lib/clinicorp/health.ts` (4 status: ok/warning/error/info). Reuso dos helpers de detecao (hasAppointmentNameKeyword, hasTimeNameKeyword, isProfessionalField — exportados de `src/lib/kommo/utm.ts`) pra detecao de presenca bater com extracao runtime. 21 unit tests novos.

- **[INT-3] UI de gerenciamento do mapa de profissionais** — PR #_TBD_ — v0.34.0
  Tela em `/dashboard/settings/clinicorp/professionals` com tabela editavel (nome no Kommo + ID no Clinicorp), botoes Adicionar/Remover/Cancelar/Salvar. Endpoint `GET/PUT /api/clinics/[id]/professional-map` com RBAC (settings:read e settings:write). Validacao no servidor via helper `validateProfessionalMapInput`: nome nao vazio, ID inteiro positivo, sem duplicado case/whitespace insensitive (mesma regra do `resolveProfessionalId` pra evitar colisao no lookup runtime). Link "Mapa de profissionais →" no header de /dashboard/settings ao lado de "Gerenciar usuarios →". Antes era cadastrado via SQL direto no banco — agora clinic_admin/super_admin gerencia sozinho. 15 unit tests novos. INT-5 ("Importar profissionais do Clinicorp") fica num PR separado depois.

- **[INT-3.1] Sync automatico + fix do agrupamento por data** — PR #_TBD_ — v0.33.0
  Workers `sync-clinicorp` e `match-leads` agora registram repeat job a cada 15min no boot (BullMQ repeat — antes so eram disparados pelo botao manual no dashboard, dia 06/05 ficou 24h sem refletir procedimentos novos). Corrigido tambem o agrupamento dos graficos "Receita por periodo" (Visao Geral) e "Receita por dia" (Financeiro): usavam `Procedure.createdAt` que e `Estimate.CreateDate` do Clinicorp (data de criacao do orcamento, nao do atendimento) — empilhava 45 procedures em 2 dias na timeline. Agora usam `COALESCE(completedAt, createdAt)` tanto no GROUP BY quanto no filtro de data, refletindo a data real de execucao. Schema ganhou `Clinic.lastClinicorpSyncAt` e `Clinic.lastMatchLeadsAt`; novo endpoint `GET /api/sync/status` retorna esses timestamps; header do dashboard mostra "Atualizado ha Xmin" ao lado do botao Sincronizar.

- **[INT-2.2] Fix de qualidade dos dados pro Clinicorp** — PR #_TBD_ — v0.32.2
  Nome do paciente agora vem do contato Kommo (completo, ex: "Gabrielle Freitas") e nao do nome do card (frequentemente curto, ex: "Gabrielle" ou "Lead #N"). Util `phoneToClinicorp` normaliza qualquer formato de telefone (`+55..`, `(15)...`, etc) pra digitos puros sem DDI 55, com cuidado pra preservar DDD 55 (RS). Aplicado em paciente e appointment. 7 unit tests novos.

- **[INT-2.1] Fix do teste end-to-end: email opcional + ATENDIDO POR** — PR #_TBD_ — v0.32.1
  Worker create-patient nao exige mais email pra integrar com Clinicorp (Clinicorp aceita criacao sem email; em estetica/odonto e comum lead chegar so com nome+telefone). `extractAppointmentFields` reconhece "ATENDIDO POR" (alem de profissional/dentista/code professional_id) — desbloqueia o pipeline da clinica AD que usa esse nome de campo. Descoberto em teste end-to-end Bruno-teste.

- **[INT-2] Schema + lib do mapeamento de profissionais Kommo->Clinicorp** — PR #_TBD_ — v0.32.0
  Coluna `Clinic.professionalMap` (JSONB nullable, migration `20260507150000`). Helper `resolveProfessionalId` (`src/lib/clinicorp/professional-map.ts`) com lookup case e whitespace insensitive. Worker `create-patient` resolve o profissional via mapa antes de chamar Clinicorp; fallback pra ID numerico direto se valor do Kommo ja for digit-only (backwards-compat). Cadastro do mapa via SQL nesta versao — UI vem em INT-3. 11 unit tests novos.

- **[INT-1] Suporte a campo unico datetime no Kommo** — PR #_TBD_ — v0.31.0
  `extractAppointmentFields` agora reconhece campo combinado `DATA E HORA CONSULTA` (Kommo type=date_time). Detecta tanto por `field_type="date_time"` quanto por nome contendo data+consulta+hora. Faz split do unix timestamp em `appointmentDate` (YYYY-MM-DD) + `appointmentTime` (HH:MM) no fuso `America/Sao_Paulo`. Desbloqueia automacao Kommo->Clinicorp end-to-end. 11 unit tests novos cobrindo combined/separados/profissional/edge cases.

- **[UI-1] Receita do funil em verde** — PR #_TBD_ — v0.30.1
  KpiCard de receita no dashboard troca a cor de destaque de gold pra verde (token `success`). Prop `highlight` do KpiCard estendida pra aceitar `"gold" | "green"` (backwards-compatible com boolean).

- **[SEC-3] Retencao de WebhookLog** — PR #_TBD_ — v0.30.0
  Worker `webhook-log-cleanup` (BullMQ repeat cron `0 3 * * 0` = dom 03:00 UTC) deleta logs com mais de `WEBHOOK_LOG_RETENTION_DAYS` (default 90, env override; <=0 desabilita). Batching de 5000 por execucao pra evitar transacao longa. Adicionado a QUEUE_NAMES — aparece automaticamente em /api/admin/queues e painel /dashboard/logs.

- **[SEC-2.1] WebhookLog com clinicId** — PR #65 — v0.29.0
  Migration adiciona coluna `clinicId` (nullable). Webhook handlers Kommo/Clinicorp populam apos identificar a clinica. /api/webhook-logs filtra por clinica: super_admin ve tudo (incluindo legacy nulls), clinic_admin so a propria, user bloqueado. Index composto (clinicId, createdAt) pra perf de listagem por clinica. Resolve o vazamento documentado no SEC-2.

- **[USR-1.3] RBAC granular por modulo (foundation)** — PR #64 — v0.28.0
  src/lib/permissions.ts com 10 modulos canonicos x 3 actions, modelo hibrido (role baseline + User.permissions sobrescreve). PUT /api/users/[id]/permissions, UI checkbox grid em /dashboard/settings/users/[id]/permissions, hook useCanAccess. Aplicado em /api/sync. Foundation pronta — outras rotas seguem em [USR-1.3.1].

- **[USR-1.2] UI admin de usuarios** — PR #62 — v0.27.0
  /dashboard/settings/users com tabela, formulario create, botao reset por linha. Apos create/reset: card destacado com senha temporaria + copy + warning (mostra UMA UNICA vez). Link no header de /dashboard/settings. UI esconde silenciosa pra nao-admin via 403 do backend.

- **[USR-1] foundation: criacao manual + senha temp + force change** — PR #61 — v0.26.0
  Schema: User.mustChangePassword + User.permissions (Json?). Helpers em src/lib/users.ts (generate temp pw cripto-random, hash, verify, create, reset, change). API: POST /api/users (admin cria), POST /api/users/[id]/reset-password (admin reseta), POST /api/auth/change-password (user troca). Middleware redireciona pra /dashboard/change-password se mustChangePassword=true. Pagina change-password com signOut apos sucesso pra reciclar session. UI admin (USR-1.2) e RBAC enforcement (USR-1.3) abertas como follow-ups.

- **[OBS-3.1] Health avancado com status de filas** — PR #60 — v0.25.1
  /api/health agora inclui campo `queues` com waiting/failed counts + lastCompletedAt/lastFailedAt por fila. Reusa getAllQueues() de [OBS-2]. Status agregado (ok|degraded) continua baseado so em db+redis — worker travado nao tira replica do pool. Falha silenciosa em queues:null se Redis estiver sob stress.

- **[OBS-2] Metricas de fila BullMQ** — PR #59 — v0.25.0
  Endpoint /api/admin/queues (super_admin only) retorna counts (waiting/active/completed/failed/delayed/paused) + tempo medio dos ultimos 20 jobs + ultimo OK/fail por fila. Componente QueueMetricsPanel no /dashboard/logs com refresh 10s e cards coloridos por estado (vermelho=falhas, ambar=pendente, neutro=idle). Lista canonica de filas em src/lib/queues.ts (QUEUE_NAMES + getAllQueues()) pra reuso por OBS-3.1. Middleware /api/admin/* protegido. Catalogo da rota em MULTITENANT-AUDIT.md (super_admin only — filas sao globais, expor pra clinic_admin vazaria volume entre clinicas).

- **[OBS-1] Logs estruturados (pino)** — PR #58 — v0.24.0
  src/lib/logger.ts com pino + redact de tokens. 52 console.log/warn/error substituidos em todos os 7 workers, 2 webhooks (Kommo, Clinicorp) e clinicorp/appointment.ts. Padrao: logger.child({ scope: "name" }) + log.info({ contexto }, "mensagem"). Em dev PRETTY_LOGS=1 ativa output colorido; em prod JSON puro pra agregadores. [OBS-1.1] aberta pra correlation id automatico via AsyncLocalStorage.

- **[QA-1] Fundacao de testes (Vitest)** — PR #57 — v0.23.0
  Vitest + 51 unit tests cobrindo crypto (encrypt/decrypt round-trip + tampering), phone (matching com nono digito), utm (classifyChannel + tags), OAuth state (HMAC anti-CSRF + expiracao), auth-guard (super_admin/clinic_admin/user com mocked session). CI roda npm test entre tsc e build. Foundation pronta — adicionar tests pra novas features eh trivial. Integration tests com Postgres ficam pra [QA-1.1].

- **[SEC-2] Auditoria de isolamento multi-tenant** — PR #56 — v0.22.0
  Catalogo de todas as 26 rotas API em `docs/MULTITENANT-AUDIT.md`. 2 bugs criticos fixados: `/api/patients/[id]` agora filtra por clinicId (era cross-tenant trivial), `/api/webhook-logs` restrito a super_admin (era vazamento de payloads de outras clinicas para clinic_admin). Confirmado HMAC-protection do state em OAuth callbacks. Geradas 3 sub-issues SEC-2.1/2.2/2.3 pra continuidade.

- **[SEC-1] Criptografia at-rest dos tokens de integracao** — PRs #54 #55 — v0.21.0 → v0.21.1
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
