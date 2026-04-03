"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Configuracoes</h1>

      <Card>
        <CardHeader>
          <CardTitle>Integracao Kommo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="kommo-subdomain">Subdominio</Label>
            <Input
              id="kommo-subdomain"
              placeholder="suaclinica.kommo.com"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="kommo-token">Token de API</Label>
            <Input
              id="kommo-token"
              type="password"
              placeholder="Seu token de acesso"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="kommo-pipeline">ID do Pipeline</Label>
            <Input
              id="kommo-pipeline"
              placeholder="ID do pipeline a monitorar"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="kommo-stage">
              ID do Stage &quot;Agendamento Realizado&quot;
            </Label>
            <Input
              id="kommo-stage"
              placeholder="ID do stage de agendamento"
            />
          </div>
          <Button>Salvar Kommo</Button>
        </CardContent>
      </Card>

      <Separator />

      <Card>
        <CardHeader>
          <CardTitle>Integracao Clinicorp</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="clinicorp-client-id">Client ID</Label>
            <Input
              id="clinicorp-client-id"
              placeholder="Client ID OAuth2"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="clinicorp-client-secret">Client Secret</Label>
            <Input
              id="clinicorp-client-secret"
              type="password"
              placeholder="Client Secret OAuth2"
            />
          </div>
          <Button>Conectar Clinicorp</Button>
        </CardContent>
      </Card>

      <Separator />

      <Card>
        <CardHeader>
          <CardTitle>Webhook URL</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Configure esta URL no Kommo para receber webhooks de mudanca de
            status:
          </p>
          <code className="block rounded bg-muted p-3 text-sm">
            https://seu-dominio.com/api/webhooks/kommo
          </code>
        </CardContent>
      </Card>
    </div>
  );
}
