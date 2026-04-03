"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CampaignMetrics } from "@/types";

interface CampaignTableProps {
  campaigns: CampaignMetrics[];
}

export function CampaignTable({ campaigns }: CampaignTableProps) {
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Campanha</TableHead>
          <TableHead className="text-right">Leads</TableHead>
          <TableHead className="text-right">Agendamentos</TableHead>
          <TableHead className="text-right">Procedimentos</TableHead>
          <TableHead className="text-right">Receita</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {campaigns.length === 0 ? (
          <TableRow>
            <TableCell colSpan={5} className="text-center text-muted-foreground">
              Nenhuma campanha encontrada
            </TableCell>
          </TableRow>
        ) : (
          campaigns.map((c) => (
            <TableRow key={c.campaign}>
              <TableCell className="font-medium">{c.campaign}</TableCell>
              <TableCell className="text-right">{c.leads}</TableCell>
              <TableCell className="text-right">{c.agendamentos}</TableCell>
              <TableCell className="text-right">{c.procedimentos}</TableCell>
              <TableCell className="text-right">
                {formatCurrency(c.revenue)}
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}
