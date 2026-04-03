"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useClinic } from "@/hooks/use-clinic";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";

interface ProcSummary {
  name: string;
  count: number;
  revenue: number;
  ticketMedio: number;
  trend: number | null;
}

interface RevenueByDay {
  name: string;
  value: number;
}

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const fmtK = (v: number) =>
  v >= 1000 ? `R$ ${(v / 1000).toFixed(0)}k` : fmt(v);

const COLORS = [
  "#166534", "#15803d", "#22c55e", "#4ade80",
  "#86efac", "#2563eb", "#7c3aed", "#f59e0b",
  "#ef4444", "#6b7280",
];

export default function ProceduresPage() {
  const { clinic, loading: clinicLoading } = useClinic();
  const [procs, setProcs] = useState<ProcSummary[]>([]);
  const [revenueByDay, setRevenueByDay] = useState<RevenueByDay[]>([]);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  const fetchData = useCallback(() => {
    if (!clinic) return;
    setLoading(true);
    fetch(`/api/metrics/detailed?clinicId=${clinic.id}&days=${days}`)
      .then((res) => res.json())
      .then((json) => {
        const d = json.data;
        setProcs(d?.topProcedures ?? []);
        setRevenueByDay(d?.revenueByDay ?? []);
        setTotalRevenue(d?.totalRevenue ?? 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [clinic, days]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (clinicLoading) return <p className="text-muted-foreground">Carregando...</p>;
  if (!clinic) return <p className="text-muted-foreground">Nenhuma clinica encontrada.</p>;

  const donutData = procs.map((p) => ({ name: p.name, value: p.revenue }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Procedimentos</h1>
          <p className="text-sm text-muted-foreground">Receita e performance por tipo de procedimento</p>
        </div>
        <div className="flex rounded-lg border">
          {[{ d: 7, l: "7 dias" }, { d: 30, l: "30 dias" }, { d: 90, l: "Trimestre" }].map((p) => (
            <button
              key={p.d}
              onClick={() => setDays(p.d)}
              className={`px-4 py-2 text-sm transition-colors ${
                days === p.d ? "bg-primary text-primary-foreground" : "hover:bg-accent"
              } ${p.d === 7 ? "rounded-l-lg" : p.d === 90 ? "rounded-r-lg" : ""}`}
            >
              {p.l}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : (
        <>
          {/* Donut + Receita por dia */}
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Distribuicao de receita</CardTitle>
              </CardHeader>
              <CardContent>
                {donutData.length === 0 ? (
                  <p className="text-center text-muted-foreground py-10">Sem dados no periodo</p>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={280}>
                      <PieChart>
                        <Pie
                          data={donutData}
                          cx="50%"
                          cy="50%"
                          innerRadius={70}
                          outerRadius={110}
                          dataKey="value"
                          paddingAngle={2}
                        >
                          {donutData.map((_, i) => (
                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => fmt(Number(value))} />
                        <Legend
                          verticalAlign="bottom"
                          iconSize={10}
                          wrapperStyle={{ fontSize: 12 }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <p className="mt-2 text-center text-sm text-muted-foreground">
                      Receita total: <span className="text-lg font-bold text-foreground">{fmtK(totalRevenue)}</span>
                    </p>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Receita por dia da semana</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={revenueByDay}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis
                      tick={{ fontSize: 12 }}
                      tickFormatter={(v: number) => `R$ ${(v / 1000).toFixed(0)}k`}
                    />
                    <Tooltip formatter={(value) => [fmt(Number(value)), "Receita"]} />
                    <Bar dataKey="value" fill="#166534" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Tabela de todos os procedimentos */}
          <Card>
            <CardHeader>
              <CardTitle>Todos os procedimentos</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">#</TableHead>
                    <TableHead>Procedimento</TableHead>
                    <TableHead className="text-right">Qtd</TableHead>
                    <TableHead className="text-right">Receita</TableHead>
                    <TableHead className="text-right">Ticket medio</TableHead>
                    <TableHead className="text-right">Trend</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {procs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        Nenhum procedimento no periodo.
                      </TableCell>
                    </TableRow>
                  ) : (
                    procs.map((proc, i) => (
                      <TableRow key={proc.name}>
                        <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                        <TableCell className="font-medium">{proc.name}</TableCell>
                        <TableCell className="text-right">{proc.count}</TableCell>
                        <TableCell className="text-right font-semibold">{fmt(proc.revenue)}</TableCell>
                        <TableCell className="text-right">{fmt(proc.ticketMedio)}</TableCell>
                        <TableCell className="text-right">
                          {proc.trend !== null ? (
                            <span
                              className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${
                                proc.trend >= 0
                                  ? "bg-green-50 text-green-700 border border-green-200"
                                  : "bg-red-50 text-red-700 border border-red-200"
                              }`}
                            >
                              {proc.trend >= 0 ? "+" : ""}{proc.trend}%
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
