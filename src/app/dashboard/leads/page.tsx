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
import { DateFilter } from "@/components/dashboard/date-filter";
import { useClinic } from "@/hooks/use-clinic";

interface Lead {
  id: string;
  name: string;
  phone: string | null;
  channel: string;
  utmCampaign: string | null;
  kommoStatus: string | null;
  agendamentoAt: string | null;
  createdAt: string;
}

export default function LeadsPage() {
  const { clinic, loading: clinicLoading } = useClinic();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({ from: "", to: "" });

  const fetchLeads = useCallback(() => {
    if (!clinic) return;
    setLoading(true);
    const params = new URLSearchParams({ clinicId: clinic.id });
    if (dateRange.from) params.set("from", dateRange.from);
    if (dateRange.to) params.set("to", dateRange.to);
    fetch(`/api/leads?${params}`)
      .then((res) => res.json())
      .then((json) => setLeads(json.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [clinic, dateRange]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  if (clinicLoading) {
    return <p className="text-muted-foreground">Carregando...</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Leads</h1>
        {loading && (
          <span className="text-sm text-muted-foreground">Carregando...</span>
        )}
      </div>
      <DateFilter onFilter={(from, to) => setDateRange({ from, to })} />
      <Card>
        <CardHeader>
          <CardTitle>Lista de Leads ({leads.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Canal</TableHead>
                <TableHead>Campanha</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Agendamento</TableHead>
                <TableHead>Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leads.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-center text-muted-foreground"
                  >
                    {loading
                      ? "Carregando leads..."
                      : "Nenhum lead encontrado. Configure o webhook do Kommo para comecar."}
                  </TableCell>
                </TableRow>
              ) : (
                leads.map((lead) => (
                  <TableRow key={lead.id}>
                    <TableCell className="font-medium">{lead.name}</TableCell>
                    <TableCell>{lead.phone || "-"}</TableCell>
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
                    <TableCell>{lead.kommoStatus || "-"}</TableCell>
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
