"use client";

import { useCallback, useEffect, useState } from "react";
import { DateFilter } from "@/components/dashboard/date-filter";
import { useClinic } from "@/hooks/use-clinic";
import { useStickyDateRange } from "@/hooks/use-sticky-date-range";

interface RevenueBucket {
  count: number;
  revenue: number;
  percent: number;
}

interface ReceitaPorOrigem {
  captacao: RevenueBucket;
  recorrentes: RevenueBucket;
  walkIn: RevenueBucket;
  total: { count: number; revenue: number };
}

interface ConsultasBreakdown {
  realizadas: number;
  confirmadas: number;
  faltaram: number;
  agendadas: number;
  emEspera: number;
  emAtendimento: number;
  atrasadas: number;
  total: number;
}

interface SdrPerformance {
  vendedora: string;
  leads: number;
  agendados: number;
  compareceram: number;
  fecharam: number;
  receita: number;
  conversao: number;
}

interface DashboardData {
  totalLeads: number;
  campaignLeads: number;
  organicLeads: number;
  agendamentos: number;
  compareceram: number;
  procedimentos: number;
  pacientesFecharam: number;
  totalRevenue: number;
  procedimentosClinica: number;
  receitaClinica: number;
  totalSpend: number;
  cpl: number | null;
  conversionRate: number;
  // [UI-3] Leads captados por dia/semana/mes (substituiu o antigo revenueChart)
  leadsByDay: { day: string; iso?: string; count: number }[];
  leadsByDayTotal: number;
  leadsByDayAvg: number;
  leadsByDayBest: { day: string; count: number } | null;
  leadsGranularity?: "day" | "week" | "month";
  topProcedures: { name: string; count: number; revenue: number; ticketMedio: number }[];
  channelPerformance: { channel: string; spend: number; impressions: number; clicks: number }[];
  receitaPorOrigem?: ReceitaPorOrigem;
  consultas?: ConsultasBreakdown;
  sdrPerformance: SdrPerformance[];
  canalBreakdown: { canal: string; count: number }[];
}

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
const fmtK = (v: number) => v >= 1000 ? `R$ ${(v / 1000).toFixed(0)}k` : fmt(v);

const empty: DashboardData = {
  totalLeads: 0, campaignLeads: 0, organicLeads: 0, agendamentos: 0,
  compareceram: 0, procedimentos: 0, pacientesFecharam: 0, totalRevenue: 0, procedimentosClinica: 0, receitaClinica: 0, totalSpend: 0, cpl: null,
  conversionRate: 0,
  leadsByDay: [], leadsByDayTotal: 0, leadsByDayAvg: 0, leadsByDayBest: null,
  topProcedures: [], channelPerformance: [],
  sdrPerformance: [],
  canalBreakdown: [],
};

export default function DashboardPage() {
  const { clinic, loading: clinicLoading } = useClinic();
  const { initialPreset, save: saveDatePreset } = useStickyDateRange();
  const [data, setData] = useState<DashboardData>(empty);
  const [, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({ from: "", to: "" });

  const fetchData = useCallback(() => {
    // [funil] Espera o intervalo de data estar definido antes de buscar. Sem
    // isso, o fetch dispara no mount com dateRange vazio -> API sem from/to ->
    // retorna dados de TODO o periodo (ex: 294 leads). Como essa query "tudo"
    // ficou mais lenta com o crescimento dos dados, ela resolvia DEPOIS da
    // query de 30d e sobrescrevia o resultado correto (race). Agora so busca
    // quando ha range, e a tela sempre reflete o filtro selecionado.
    if (!clinic || !dateRange.from || !dateRange.to) return;
    setLoading(true);
    const params = new URLSearchParams({ clinicId: clinic.id });
    if (dateRange.from) params.set("from", dateRange.from);
    if (dateRange.to) params.set("to", dateRange.to);
    fetch(`/api/dashboard?${params}`)
      .then((res) => res.json())
      .then((json) => setData(json.data ?? empty))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [clinic, dateRange]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (clinicLoading) return <p className="text-muted-foreground p-8">Carregando...</p>;

  const d = data;
  // [CAP-12] "Compareceram" no funil usa a mesma fonte event-time do card de
  // cima "Comparecimento" (Clinicorp: appointments atendidos no periodo), em vez
  // do calculo legado por safra de lead — assim os dois lugares batem.
  const comparecimento = d.consultas?.realizadas ?? d.compareceram;
  // [funil] "Consultas agendadas" = consultas marcadas no Clinicorp DOS LEADS DA
  // CAPTACAO no periodo (consultas.total ja e filtrado por paciente com lead no
  // pipeline de captacao — exclui walk-ins/recorrentes sem origem na captacao).
  // Antes vinha da coluna "Agendado" do Kommo (d.agendamentos), subutilizada pela
  // clinica, o que deixava o funil invertido (5 agendadas < 9 compareceram).
  const agendadas = d.consultas?.total ?? 0;
  // [funil] "Fecharam procedimento" no funil = nº de CLIENTES (pacientes
  // distintos) que fecharam, nao nº de procedimentos. O card de cima continua
  // mostrando procedimentos (d.procedimentos).
  const fecharamClientes = d.pacientesFecharam ?? 0;
  const agendRate = d.totalLeads > 0 ? (agendadas / d.totalLeads) * 100 : 0;
  const compareRate = d.totalLeads > 0 ? (comparecimento / d.totalLeads) * 100 : 0;
  const procRate = d.totalLeads > 0 ? (fecharamClientes / d.totalLeads) * 100 : 0;
  const maxLeads = Math.max(...d.leadsByDay.map((r) => r.count), 1);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Funil de Captacao</h1>
          <p className="text-sm text-muted-foreground">
            {clinic?.name} — Origem: Kommo (leads captados ate procedimento fechado)
          </p>
        </div>
        <DateFilter
          defaultPreset={initialPreset}
          onFilter={(from, to, presetId) => {
            setDateRange({ from, to });
            saveDatePreset(presetId);
          }}
        />
      </div>

      {/* Linha 1 — KPIs do funil (Kommo + receita) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Leads captados"
          value={d.totalLeads}
          breakdown={`Meta: ${d.campaignLeads}  Organico: ${d.organicLeads}`}
          icon={<UsersIcon />}
        />
        <KpiCard
          label="Consultas agendadas"
          value={agendadas}
          breakdown="Marcadas no periodo (so leads da captacao)"
          icon={<CalendarIcon />}
        />
        <KpiCard
          label="Procedimentos fechados"
          value={d.procedimentos}
          breakdown={d.procedimentosClinica > d.procedimentos ? `Clinica: ${d.procedimentosClinica} (total)` : undefined}
          icon={<CheckIcon />}
        />
        <KpiCard
          label="Receita do funil"
          value={d.totalRevenue}
          isCurrency
          breakdown={d.receitaClinica > d.totalRevenue ? `Clinica: ${fmtK(d.receitaClinica)} (total)` : undefined}
          icon={<DollarIcon />}
          highlight="green"
        />
      </div>

      {/* [DASH-4] Linha 2 — Comparecimento dos leads (Clinicorp).
          So leads do funil de captacao. Aparece se houver appointments no range. */}
      {d.consultas && d.consultas.total > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            label="Comparecimento"
            value={d.consultas.realizadas}
            breakdown="Leads que vieram pra consulta"
            icon={<CheckIcon />}
            highlight="green"
          />
          <KpiCard
            label="Faltas"
            value={d.consultas.faltaram}
            breakdown={d.consultas.realizadas + d.consultas.faltaram > 0
              ? `${((d.consultas.faltaram / (d.consultas.realizadas + d.consultas.faltaram)) * 100).toFixed(1)}% no-show`
              : undefined}
            icon={<XIcon />}
          />
          <KpiCard
            label="Confirmadas (pendentes)"
            value={d.consultas.confirmadas}
            breakdown="Confirmou, ainda nao veio"
            icon={<CalendarIcon />}
          />
          <KpiCard
            label="Aguardando status"
            value={d.consultas.agendadas}
            breakdown="Sem atualizacao no Clinicorp ainda"
            icon={<CalendarIcon />}
          />
        </div>
      )}

      {/* Funnel + Revenue Chart */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Funnel */}
        <div className="rounded-xl bg-card p-6 glass-border">
          <h2 className="font-display text-lg font-semibold mb-5">Funil de conversao</h2>
          <div className="space-y-5">
            <FunnelRow label="Leads captados" value={d.totalLeads} max={d.totalLeads} pct={100} />
            <FunnelRow
              label="Consultas agendadas"
              value={agendadas}
              max={d.totalLeads}
              pct={agendRate}
            />
            <FunnelRow
              label="Compareceram"
              value={comparecimento}
              max={d.totalLeads}
              pct={compareRate}
            />
            <FunnelRow
              label="Fecharam procedimento"
              value={fecharamClientes}
              max={d.totalLeads}
              pct={procRate}
            />
          </div>
        </div>

        {/* [UI-3] Leads captados por dia/semana/mes — substitui o antigo grafico
            de receita por periodo (que ficava com 2 barrões gigantes em datasets
            esparsos). Foco no topo do funil (entrada de leads) ja que a receita
            ja aparece no KPI "Receita do funil" acima. */}
        <div className="rounded-xl bg-card p-6 glass-border">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-display text-lg font-semibold">Leads captados por periodo</h2>
            <span className="text-[11px] text-muted-foreground uppercase tracking-wider">
              {d.leadsGranularity === "day" && "Por dia"}
              {d.leadsGranularity === "week" && "Por semana"}
              {d.leadsGranularity === "month" && "Por mes"}
            </span>
          </div>

          {/* Stats agregadas em cima do grafico */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            <div className="rounded-lg bg-muted/30 p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Total</p>
              <p className="font-display text-xl font-bold mt-1">{d.leadsByDayTotal}</p>
            </div>
            <div className="rounded-lg bg-muted/30 p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Media {d.leadsGranularity === "day" ? "diaria" : d.leadsGranularity === "week" ? "semanal" : "mensal"}
              </p>
              <p className="font-display text-xl font-bold mt-1">{d.leadsByDayAvg.toFixed(1)}</p>
            </div>
            <div className="rounded-lg bg-muted/30 p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Melhor</p>
              <p className="font-display text-xl font-bold mt-1">
                {d.leadsByDayBest ? d.leadsByDayBest.count : "—"}
                {d.leadsByDayBest && (
                  <span className="text-xs font-normal text-muted-foreground ml-1.5">
                    em {d.leadsByDayBest.day}
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Sparkline (barras finas) */}
          {d.leadsByDay.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem leads no periodo.</p>
          ) : (
            <div className="overflow-x-auto pb-1">
              <div
                className="flex items-end gap-1 pt-6"
                style={{ minWidth: `${Math.max(d.leadsByDay.length * 24, 100)}px`, height: "140px" }}
              >
                {d.leadsByDay.map((r, idx) => {
                  const heightPct = maxLeads > 0 ? (r.count / maxLeads) * 100 : 0;
                  const renderHeight = r.count > 0 ? Math.max(heightPct, 6) : 0;
                  return (
                    <div key={`${r.day}-${idx}`} className="flex flex-1 min-w-[20px] flex-col items-center group relative">
                      <span className="text-[10px] font-semibold text-foreground opacity-0 group-hover:opacity-100 transition-opacity absolute -top-5 whitespace-nowrap z-10">
                        {r.count} lead{r.count === 1 ? "" : "s"}
                      </span>
                      <div className="w-full flex items-end justify-center" style={{ height: "100px" }}>
                        <div
                          className="w-full rounded-t-md bg-primary/70 hover:bg-primary transition-all duration-300 cursor-pointer"
                          style={{ height: `${renderHeight}%`, minHeight: r.count > 0 ? "3px" : "0" }}
                          title={`${r.day}: ${r.count} lead${r.count === 1 ? "" : "s"}`}
                        />
                      </div>
                      <span className="text-[10px] text-muted-foreground mt-1.5 whitespace-nowrap">
                        {r.day}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* [DASH-10] Performance por SDR — leads agrupados pela vendedora
          (custom field Kommo). Funil completo: leads -> agendados ->
          compareceram -> fecharam -> receita. So renderiza se houver SDR. */}
      {d.sdrPerformance.length > 0 && (
        <div className="rounded-xl bg-card p-6 glass-border">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-lg font-semibold">Performance por SDR</h2>
            <span className="text-xs text-muted-foreground">
              {d.sdrPerformance.length} SDR{d.sdrPerformance.length === 1 ? "" : "s"}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50 text-[10px] uppercase tracking-wider text-muted-foreground">
                  <th className="text-left font-medium py-2 pr-3">SDR</th>
                  <th className="text-right font-medium py-2 px-3">Leads</th>
                  <th className="text-right font-medium py-2 px-3">Agend.</th>
                  <th className="text-right font-medium py-2 px-3">Comp.</th>
                  <th className="text-right font-medium py-2 px-3">Fechou</th>
                  <th className="text-right font-medium py-2 px-3">Receita</th>
                  <th className="text-right font-medium py-2 pl-3">Conv.</th>
                </tr>
              </thead>
              <tbody>
                {d.sdrPerformance.map((s, idx) => (
                  <tr
                    key={s.vendedora}
                    className="border-b border-border/30 last:border-0 hover:bg-muted/30 transition-colors"
                  >
                    <td className={`py-3 pr-3 ${idx === 0 ? "font-semibold" : "font-medium"}`}>
                      {s.vendedora}
                    </td>
                    <td className="py-3 px-3 text-right tabular-nums">{s.leads}</td>
                    <td className="py-3 px-3 text-right tabular-nums">{s.agendados}</td>
                    <td className="py-3 px-3 text-right tabular-nums">{s.compareceram}</td>
                    <td className="py-3 px-3 text-right tabular-nums">{s.fecharam}</td>
                    <td className="py-3 px-3 text-right tabular-nums">
                      {s.receita > 0 ? fmtK(s.receita) : "—"}
                    </td>
                    <td
                      className={`py-3 pl-3 text-right tabular-nums ${
                        s.conversao >= 20 ? "text-success font-semibold" : ""
                      }`}
                    >
                      {s.conversao.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Composicao da receita (DASH-1) */}
      {d.receitaPorOrigem && d.receitaPorOrigem.total.revenue > 0 && (
        <div className="rounded-xl bg-card p-6 glass-border">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-lg font-semibold">Composicao da receita</h2>
            <span className="text-xs text-muted-foreground">Total: {fmt(d.receitaPorOrigem.total.revenue)}</span>
          </div>
          <div className="space-y-3">
            <RevenueOriginRow
              label="Captacao"
              tooltip="Pacientes com lead no pipeline de captacao"
              bucket={d.receitaPorOrigem.captacao}
              colorClass="from-success/60 to-success"
            />
            <RevenueOriginRow
              label="Recorrentes"
              tooltip="Pacientes com lead em outros pipelines (recorrentes)"
              bucket={d.receitaPorOrigem.recorrentes}
              colorClass="from-gold/60 to-gold"
            />
            <RevenueOriginRow
              label="Walk-ins"
              tooltip="Pacientes sem lead capturado (entraram direto pelo Clinicorp)"
              bucket={d.receitaPorOrigem.walkIn}
              colorClass="from-muted-foreground/40 to-muted-foreground/70"
            />
          </div>
        </div>
      )}

      {/* Performance by Channel + Top Procedures */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Channel Performance */}
        <div className="rounded-xl bg-card p-6 glass-border">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-lg font-semibold">Performance por canal</h2>
            <span className="text-xs text-muted-foreground">Top 3</span>
          </div>
          <div className="space-y-4">
            {d.channelPerformance.length === 0 ? (
              <p className="text-sm text-muted-foreground">Conecte Meta/Google Ads para ver dados.</p>
            ) : (
              d.channelPerformance.slice(0, 3).map((ch) => (
                <div key={ch.channel} className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-sm font-medium">{ch.channel}</p>
                    <p className="text-xs text-muted-foreground">
                      {ch.clicks} cliques · {ch.impressions > 0 ? `${((ch.clicks / ch.impressions) * 100).toFixed(1)}% CTR` : "—"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">{ch.spend > 0 ? fmtK(ch.spend) : "—"}</p>
                    {ch.spend > 0 && d.totalRevenue > 0 && (
                      <p className="text-xs text-success">{((d.totalRevenue / ch.spend)).toFixed(1)}x ROI</p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Top Procedures */}
        <div className="rounded-xl bg-card p-6 glass-border">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-lg font-semibold">Top procedimentos</h2>
            <span className="text-xs text-muted-foreground">Top 3</span>
          </div>
          <div className="space-y-4">
            {d.topProcedures.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum procedimento no periodo.</p>
            ) : (
              d.topProcedures.map((p) => (
                <div key={p.name} className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-sm font-medium">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.count} fechados · TM {fmtK(p.ticketMedio)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">{fmtK(p.revenue)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Canal de Prospeccao Breakdown */}
      {d.canalBreakdown.length > 0 && (
        <div className="rounded-xl bg-card p-6 glass-border">
          <h2 className="font-display text-lg font-semibold mb-4">Leads por canal de prospeccao</h2>
          <div className="space-y-3">
            {d.canalBreakdown.map((c) => {
              const pct = d.totalLeads > 0 ? (c.count / d.totalLeads) * 100 : 0;
              return (
                <div key={c.canal} className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium">{c.canal}</span>
                      <span>{c.count} <span className="text-muted-foreground text-xs">({pct.toFixed(1)}%)</span></span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-gold/60 to-gold transition-all"
                        style={{ width: `${Math.max(pct, 2)}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Insight Card */}
      <div className="rounded-xl border-l-4 border-gold bg-card p-5 glass-border">
        <div className="flex gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gold/15 text-gold shrink-0">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9.663 17h4.673M12 3v1m6.364 1.636-.707.707M21 12h-1M4 12H3m3.343-5.657-.707-.707m2.828 9.9a5 5 0 1 1 7.072 0l-.548.547A3.374 3.374 0 0 0 14 18.469V19a2 2 0 1 1-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-gold">Insight automatico</p>
            <p className="text-sm text-muted-foreground mt-1">
              {d.totalLeads > 0
                ? `Nos ultimos dias, a taxa de conversao de leads para procedimentos esta em ${procRate.toFixed(1)}%. ${procRate > 20 ? "Performance acima da media do setor." : "Recomendacao: reforcar follow-up pos-consulta para aumentar conversao."}`
                : "Configure as integracoes para receber insights automaticos."}
            </p>
          </div>
        </div>
      </div>

    </div>
  );
}

// --- Components ---

function KpiCard({ label, value, isCurrency, breakdown, icon, highlight }: {
  label: string; value: number; isCurrency?: boolean;
  breakdown?: string; icon: React.ReactNode; highlight?: boolean | "gold" | "green";
}) {
  const displayValue = isCurrency ? fmt(value) : String(value);
  const variant = highlight === "green" ? "green" : highlight ? "gold" : "none";
  const ringClass = variant === "green" ? "ring-1 ring-success/20" : variant === "gold" ? "ring-1 ring-gold/20" : "";
  const valueClass = variant === "green" ? "text-success" : variant === "gold" ? "text-gold" : "";
  const iconClass = variant === "green" ? "bg-success/10 text-success" : "bg-gold/10 text-gold";
  return (
    <div className={`rounded-xl bg-card p-5 glass-border ${ringClass}`}>
      <div className="flex items-start justify-between mb-3">
        <p className="text-sm text-muted-foreground">{label}</p>
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${iconClass}`}>{icon}</div>
      </div>
      <p className={`font-display text-2xl font-bold ${valueClass}`}>{displayValue}</p>
      {breakdown && <p className="text-[11px] text-muted-foreground mt-1">{breakdown}</p>}
    </div>
  );
}

function RevenueOriginRow({
  label,
  tooltip,
  bucket,
  colorClass,
}: {
  label: string;
  tooltip: string;
  bucket: RevenueBucket;
  colorClass: string;
}) {
  const width = Math.max(bucket.percent, 2);
  return (
    <div title={tooltip}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-sm">
          <span className="font-semibold">{fmt(bucket.revenue)}</span>{" "}
          <span className="text-xs text-muted-foreground">
            · {bucket.count} {bucket.count === 1 ? "procedure" : "procedures"}
            {" · "}
            {bucket.percent.toFixed(1)}%
          </span>
        </span>
      </div>
      <div className="h-2.5 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${colorClass} transition-all duration-700`}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}

function FunnelRow({ label, value, max, pct }: {
  label: string; value: number; max: number; pct: number;
}) {
  const width = max > 0 ? Math.max((value / max) * 100, 4) : 4;
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-sm">
          <span className="font-semibold">{value}</span>
          {pct < 100 && <span className="text-xs text-muted-foreground ml-1">({pct.toFixed(1)}%)</span>}
        </span>
      </div>
      <div className="h-3 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-success/70 to-success transition-all duration-700"
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}

function UsersIcon() {
  return <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
}
function CalendarIcon() {
  return <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>;
}
function CheckIcon() {
  return <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>;
}
function DollarIcon() {
  return <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>;
}
function XIcon() {
  return <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>;
}
