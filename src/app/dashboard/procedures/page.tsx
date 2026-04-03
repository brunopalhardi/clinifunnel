"use client";

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

export default function ProceduresPage() {
  // TODO: Fetch procedures from API
  const procedures: Array<{
    id: string;
    name: string;
    patientName: string;
    value: number;
    status: string;
    utmCampaign: string | null;
    completedAt: string | null;
  }> = [];

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);

  const statusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      completed: "default",
      approved: "secondary",
      pending: "outline",
      cancelled: "destructive",
    };
    const labels: Record<string, string> = {
      completed: "Concluido",
      approved: "Aprovado",
      pending: "Pendente",
      cancelled: "Cancelado",
    };
    return (
      <Badge variant={variants[status] || "outline"}>
        {labels[status] || status}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Procedimentos</h1>
      <Card>
        <CardHeader>
          <CardTitle>Procedimentos Fechados</CardTitle>
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
                    Nenhum procedimento encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                procedures.map((proc) => (
                  <TableRow key={proc.id}>
                    <TableCell className="font-medium">{proc.name}</TableCell>
                    <TableCell>{proc.patientName}</TableCell>
                    <TableCell>{formatCurrency(proc.value)}</TableCell>
                    <TableCell>{statusBadge(proc.status)}</TableCell>
                    <TableCell>{proc.utmCampaign || "-"}</TableCell>
                    <TableCell>
                      {proc.completedAt
                        ? new Date(proc.completedAt).toLocaleDateString(
                            "pt-BR"
                          )
                        : "-"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
