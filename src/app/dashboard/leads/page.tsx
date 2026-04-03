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

export default function LeadsPage() {
  // TODO: Fetch leads from API
  const leads: Array<{
    id: string;
    name: string;
    phone: string;
    channel: string;
    utmCampaign: string | null;
    agendamentoAt: string | null;
    createdAt: string;
  }> = [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Leads</h1>
      <Card>
        <CardHeader>
          <CardTitle>Lista de Leads</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Canal</TableHead>
                <TableHead>Campanha</TableHead>
                <TableHead>Agendamento</TableHead>
                <TableHead>Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leads.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center text-muted-foreground"
                  >
                    Nenhum lead encontrado. Configure o webhook do Kommo para
                    comecar.
                  </TableCell>
                </TableRow>
              ) : (
                leads.map((lead) => (
                  <TableRow key={lead.id}>
                    <TableCell className="font-medium">{lead.name}</TableCell>
                    <TableCell>{lead.phone}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          lead.channel === "campaign" ? "default" : "secondary"
                        }
                      >
                        {lead.channel === "campaign" ? "Campanha" : "Organico"}
                      </Badge>
                    </TableCell>
                    <TableCell>{lead.utmCampaign || "-"}</TableCell>
                    <TableCell>
                      {lead.agendamentoAt
                        ? new Date(lead.agendamentoAt).toLocaleDateString(
                            "pt-BR"
                          )
                        : "-"}
                    </TableCell>
                    <TableCell>
                      {new Date(lead.createdAt).toLocaleDateString("pt-BR")}
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
