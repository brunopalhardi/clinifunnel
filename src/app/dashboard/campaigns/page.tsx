"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CampaignTable } from "@/components/dashboard/campaign-table";
import { DateFilter } from "@/components/dashboard/date-filter";
import { useClinic } from "@/hooks/use-clinic";
import { CampaignMetrics } from "@/types";

export default function CampaignsPage() {
  const { clinic, loading: clinicLoading } = useClinic();
  const [campaigns, setCampaigns] = useState<CampaignMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({ from: "", to: "" });

  const fetchCampaigns = useCallback(() => {
    if (!clinic) return;
    setLoading(true);
    const params = new URLSearchParams({ clinicId: clinic.id });
    if (dateRange.from) params.set("from", dateRange.from);
    if (dateRange.to) params.set("to", dateRange.to);
    fetch(`/api/campaigns?${params}`)
      .then((res) => res.json())
      .then((json) => setCampaigns(json.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [clinic, dateRange]);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  if (clinicLoading) {
    return <p className="text-muted-foreground">Carregando...</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Performance por Campanha</h1>
        {loading && (
          <span className="text-sm text-muted-foreground">Carregando...</span>
        )}
      </div>
      <DateFilter onFilter={(from, to) => setDateRange({ from, to })} />
      <Card>
        <CardHeader>
          <CardTitle>Campanhas ({campaigns.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <CampaignTable campaigns={campaigns} />
        </CardContent>
      </Card>
    </div>
  );
}
