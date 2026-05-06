"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface QueueMetric {
  name: string;
  counts: {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
    paused: number;
  };
  avgProcessingMs: number | null;
  sampleSize: number;
  lastCompletedAt: string | null;
  lastFailedAt: string | null;
}

const REFRESH_MS = 10_000;

function formatDuration(ms: number | null): string {
  if (ms === null) return "—";
  if (ms < 1_000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1_000).toFixed(1)}s`;
  return `${(ms / 60_000).toFixed(1)}m`;
}

function formatRelative(iso: string | null): string {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return `${Math.floor(ms / 1_000)}s atras`;
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m atras`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h atras`;
  return `${Math.floor(ms / 86_400_000)}d atras`;
}

export function QueueMetricsPanel() {
  const [metrics, setMetrics] = useState<QueueMetric[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const fetchMetrics = async () => {
      try {
        const res = await fetch("/api/admin/queues");
        if (res.status === 403) {
          if (!cancelled) setError("forbidden");
          return;
        }
        if (!res.ok) throw new Error(`status ${res.status}`);
        const json = await res.json();
        if (!cancelled) {
          setMetrics(json.data);
          setGeneratedAt(json.generatedAt);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "erro");
      }
    };
    fetchMetrics();
    const interval = setInterval(fetchMetrics, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  // Painel so visivel pra super_admin (endpoint retorna 403 pra outros).
  // Em vez de mostrar erro de "sem permissao", silenciamos pro user.
  if (error === "forbidden") return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Filas BullMQ</span>
          {generatedAt && (
            <span className="text-xs font-normal text-muted-foreground">
              atualizado {formatRelative(generatedAt)}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {error && error !== "forbidden" && (
          <p className="text-sm text-red-600">erro carregando metricas: {error}</p>
        )}
        {!metrics ? (
          <p className="text-sm text-muted-foreground">carregando...</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {metrics.map((m) => {
              const stuck = m.counts.failed > 0;
              const busy = m.counts.active > 0 || m.counts.waiting > 0;
              return (
                <div
                  key={m.name}
                  className={`rounded-md border p-3 text-xs ${
                    stuck
                      ? "border-red-500/40 bg-red-500/5"
                      : busy
                      ? "border-amber-500/40 bg-amber-500/5"
                      : "border-muted-foreground/20"
                  }`}
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span className="font-medium">{m.name}</span>
                    {stuck ? (
                      <Badge variant="destructive">{m.counts.failed} fail</Badge>
                    ) : busy ? (
                      <Badge variant="secondary">{m.counts.active + m.counts.waiting} pend</Badge>
                    ) : (
                      <Badge variant="outline">idle</Badge>
                    )}
                  </div>
                  <dl className="space-y-1 text-muted-foreground">
                    <div className="flex justify-between">
                      <dt>aguardando</dt>
                      <dd>{m.counts.waiting}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt>ativos</dt>
                      <dd>{m.counts.active}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt>completos</dt>
                      <dd>{m.counts.completed}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt>tempo medio</dt>
                      <dd>
                        {formatDuration(m.avgProcessingMs)}
                        {m.sampleSize > 0 && (
                          <span className="text-muted-foreground/60"> (n={m.sampleSize})</span>
                        )}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt>ultimo OK</dt>
                      <dd>{formatRelative(m.lastCompletedAt)}</dd>
                    </div>
                    {m.lastFailedAt && (
                      <div className="flex justify-between text-red-500">
                        <dt>ultimo fail</dt>
                        <dd>{formatRelative(m.lastFailedAt)}</dd>
                      </div>
                    )}
                  </dl>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
