"use client";

import { useEffect, useState } from "react";
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
import { useClinic } from "@/hooks/use-clinic";

interface Procedure {
  id: string;
  name: string;
  value: number;
  status: string;
  completedAt: string | null;
  createdAt: string;
  patient: {
    name: string;
    utmCampaign: string | null;
  };
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  completed: { label: "Concluido", variant: "default" },
  approved: { label: "Aprovado", variant: "secondary" },
  pending: { label: "Pendente", variant: "outline" },
  cancelled: { label: "Cancelado", variant: "destructive" },
};

export default function ProceduresPage() {
  const { clinic, loading: clinicLoading } = useClinic();
  const [procedures, setProcedures] = useState<Procedure[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!clinic) return;
    setLoading(true);
    fetch(`/api/procedures?clinicId=${clinic.id}`)
      .then((res) => res.json())
      .then((json) => setProcedures(json.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [clinic]);

  if (clinicLoading) {
    return <p className="text-muted-foreground">Carregando...</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Procedimentos</h1>
        {loading && (
          <span className="text-sm text-muted-foreground">Carregando...</span>
        )}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Procedimentos Fechados ({procedures.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Procedimento</TableHead>
                <TableHead>Paciente</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Campanha</TableHead>
                <TableHead>Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {procedures.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center text-muted-foreground"
                  >
                    {loading
                      ? "Carregando procedimentos..."
                      : "Nenhum procedimento encontrado."}
                  </TableCell>
                </TableRow>
              ) : (
                procedures.map((proc) => {
                  const cfg = statusConfig[proc.status] ?? {
                    label: proc.status,
                    variant: "outline" as const,
                  };
                  return (
                    <TableRow key={proc.id}>
                      <TableCell className="font-medium">{proc.name}</TableCell>
                      <TableCell>{proc.patient.name}</TableCell>
                      <TableCell>{formatCurrency(proc.value)}</TableCell>
                      <TableCell>
                        <Badge variant={cfg.variant}>{cfg.label}</Badge>
                      </TableCell>
                      <TableCell>{proc.patient.utmCampaign || "-"}</TableCell>
                      <TableCell>
                        {proc.completedAt
                          ? new Date(proc.completedAt).toLocaleDateString("pt-BR")
                          : new Date(proc.createdAt).toLocaleDateString("pt-BR")}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
