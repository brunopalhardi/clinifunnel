"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CampaignTable } from "@/components/dashboard/campaign-table";

export default function CampaignsPage() {
  // TODO: Fetch campaigns from API
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Performance por Campanha</h1>
      <Card>
        <CardHeader>
          <CardTitle>Campanhas</CardTitle>
        </CardHeader>
        <CardContent>
          <CampaignTable campaigns={[]} />
        </CardContent>
      </Card>
    </div>
  );
}
