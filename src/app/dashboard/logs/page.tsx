"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface WebhookLog {
  id: string;
  source: string;
  event: string;
  payload: unknown;
  status: string;
  error: string | null;
  createdAt: string;
}

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  received: "outline",
  processed: "default",
  error: "destructive",
};

export default function LogsPage() {
  const [logs, setLogs] = useState<WebhookLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<string | null>(null);

  const fetchLogs = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filter) params.set("source", filter);
    fetch(`/api/webhook-logs?${params}`)
      .then((res) => res.json())
      .then((json) => setLogs(json.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [filter]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Webhook Logs</h1>
        <div className="flex gap-2">
          <Button
            variant={filter === null ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(null)}
          >
            Todos
          </Button>
          <Button
            variant={filter === "kommo" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("kommo")}
          >
            Kommo
          </Button>
          <Button
            variant={filter === "clinicorp" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("clinicorp")}
          >
            Clinicorp
          </Button>
          <Button variant="outline" size="sm" onClick={fetchLogs}>
            Atualizar
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ultimos webhooks ({logs.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center text-muted-foreground">Carregando...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Origem</TableHead>
                  <TableHead>Evento</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Erro</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center text-muted-foreground"
                    >
                      Nenhum webhook recebido ainda.
                    </TableCell>
                  </TableRow>
                ) : (
                  logs.map((log) => (
                    <>
                      <TableRow key={log.id}>
                        <TableCell>
                          <Badge variant="secondary">{log.source}</Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {log.event}
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusVariant[log.status] ?? "outline"}>
                            {log.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-48 truncate text-xs text-red-600">
                          {log.error || "-"}
                        </TableCell>
                        <TableCell className="text-xs">
                          {new Date(log.createdAt).toLocaleString("pt-BR")}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setExpandedId(
                                expandedId === log.id ? null : log.id
                              )
                            }
                          >
                            {expandedId === log.id ? "Fechar" : "Payload"}
                          </Button>
                        </TableCell>
                      </TableRow>
                      {expandedId === log.id && (
                        <TableRow key={`${log.id}-payload`}>
                          <TableCell colSpan={6}>
                            <pre className="max-h-96 overflow-auto rounded bg-muted p-4 text-xs">
                              {JSON.stringify(log.payload, null, 2)}
                            </pre>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
