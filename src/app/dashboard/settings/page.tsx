"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useClinic } from "@/hooks/use-clinic";

interface ClinicSettings {
  id: string;
  name: string;
  kommoSubdomain: string;
  kommoToken: string;
  pipelineId: string | null;
  stageAgendamento: string | null;
  clinicorpUser: string;
  clinicorpToken: string;
  clinicorpBusinessId: string;
  clinicorpAutoCreatePatient: boolean;
  clinicorpWebhookEnabled: boolean;
  hasKommo: boolean;
  hasClinicorp: boolean;
}

type SaveStatus = "idle" | "saving" | "saved" | "error";

export default function SettingsPage() {
  const { clinic, loading: clinicLoading } = useClinic();
  const [settings, setSettings] = useState<ClinicSettings | null>(null);
  const [loading, setLoading] = useState(true);

  // Kommo form
  const [kommoSubdomain, setKommoSubdomain] = useState("");
  const [kommoToken, setKommoToken] = useState("");
  const [pipelineId, setPipelineId] = useState("");
  const [stageAgendamento, setStageAgendamento] = useState("");
  const [kommoStatus, setKommoStatus] = useState<SaveStatus>("idle");

  // Clinicorp form
  const [clinicorpUser, setClinicorpUser] = useState("");
  const [clinicorpToken, setClinicorpToken] = useState("");
  const [clinicorpBusinessId, setClinicorpBusinessId] = useState("");
  const [clinicorpStatus, setClinicorpStatus] = useState<SaveStatus>("idle");

  useEffect(() => {
    if (!clinic) return;
    setLoading(true);
    fetch(`/api/clinics/${clinic.id}`)
      .then((res) => res.json())
      .then((json) => {
        const data: ClinicSettings = json.data;
        setSettings(data);
        setKommoSubdomain(data.kommoSubdomain);
        setKommoToken(data.kommoToken);
        setPipelineId(data.pipelineId ?? "");
        setStageAgendamento(data.stageAgendamento ?? "");
        setClinicorpUser(data.clinicorpUser);
        setClinicorpToken(data.clinicorpToken);
        setClinicorpBusinessId(data.clinicorpBusinessId);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [clinic]);

  async function saveKommo() {
    if (!clinic) return;
    setKommoStatus("saving");
    try {
      const res = await fetch(`/api/clinics/${clinic.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kommoSubdomain,
          kommoToken,
          pipelineId: pipelineId || null,
          stageAgendamento: stageAgendamento || null,
        }),
      });
      if (!res.ok) throw new Error();
      setKommoStatus("saved");
      setTimeout(() => setKommoStatus("idle"), 2000);
    } catch {
      setKommoStatus("error");
      setTimeout(() => setKommoStatus("idle"), 3000);
    }
  }

  async function saveClinicorp() {
    if (!clinic) return;
    setClinicorpStatus("saving");
    try {
      const res = await fetch(`/api/clinics/${clinic.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clinicorpUser,
          clinicorpToken,
          clinicorpBusinessId: clinicorpBusinessId || null,
        }),
      });
      if (!res.ok) throw new Error();
      setClinicorpStatus("saved");
      setTimeout(() => setClinicorpStatus("idle"), 2000);
    } catch {
      setClinicorpStatus("error");
      setTimeout(() => setClinicorpStatus("idle"), 3000);
    }
  }

  if (clinicLoading || loading) {
    return <p className="text-muted-foreground">Carregando...</p>;
  }

  if (!clinic || !settings) {
    return (
      <p className="text-muted-foreground">
        Nenhuma clinica encontrada. Crie uma clinica para configurar.
      </p>
    );
  }

  const webhookBase =
    typeof window !== "undefined" ? window.location.origin : "https://seu-dominio.com";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Configuracoes</h1>
        <div className="flex gap-2">
          {settings.hasKommo && <Badge variant="default">Kommo</Badge>}
          {settings.hasClinicorp && <Badge variant="default">Clinicorp</Badge>}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Clinica</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            <span className="font-medium">{settings.name}</span> &mdash;{" "}
            {settings.kommoSubdomain}.kommo.com
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Integracao Kommo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="kommo-subdomain">Subdominio</Label>
            <Input
              id="kommo-subdomain"
              placeholder="suaclinica"
              value={kommoSubdomain}
              onChange={(e) => setKommoSubdomain(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Apenas o subdominio, sem .kommo.com
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="kommo-token">Token de API</Label>
            <Input
              id="kommo-token"
              type="password"
              placeholder="Seu token de acesso"
              value={kommoToken}
              onChange={(e) => setKommoToken(e.target.value)}
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="kommo-pipeline">ID do Pipeline</Label>
              <Input
                id="kommo-pipeline"
                placeholder="Ex: 8546210"
                value={pipelineId}
                onChange={(e) => setPipelineId(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="kommo-stage">Stage &quot;Agendado&quot;</Label>
              <Input
                id="kommo-stage"
                placeholder="Ex: 68453202"
                value={stageAgendamento}
                onChange={(e) => setStageAgendamento(e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={saveKommo} disabled={kommoStatus === "saving"}>
              {kommoStatus === "saving" ? "Salvando..." : "Salvar Kommo"}
            </Button>
            {kommoStatus === "saved" && (
              <span className="text-sm text-green-600">Salvo!</span>
            )}
            {kommoStatus === "error" && (
              <span className="text-sm text-red-600">Erro ao salvar</span>
            )}
          </div>
        </CardContent>
      </Card>

      <Separator />

      <Card>
        <CardHeader>
          <CardTitle>Integracao Clinicorp</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="clinicorp-user">Usuario (Basic Auth)</Label>
            <Input
              id="clinicorp-user"
              placeholder="Usuario da API Clinicorp"
              value={clinicorpUser}
              onChange={(e) => setClinicorpUser(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="clinicorp-token">Token (Basic Auth)</Label>
            <Input
              id="clinicorp-token"
              type="password"
              placeholder="Token da API Clinicorp"
              value={clinicorpToken}
              onChange={(e) => setClinicorpToken(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="clinicorp-business">Business ID</Label>
            <Input
              id="clinicorp-business"
              placeholder="ID do business no Clinicorp"
              value={clinicorpBusinessId}
              onChange={(e) => setClinicorpBusinessId(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={saveClinicorp} disabled={clinicorpStatus === "saving"}>
              {clinicorpStatus === "saving" ? "Salvando..." : "Salvar Clinicorp"}
            </Button>
            {clinicorpStatus === "saved" && (
              <span className="text-sm text-green-600">Salvo!</span>
            )}
            {clinicorpStatus === "error" && (
              <span className="text-sm text-red-600">Erro ao salvar</span>
            )}
          </div>
        </CardContent>
      </Card>

      <Separator />

      <Card>
        <CardHeader>
          <CardTitle>Controles de Integracao</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Receber webhooks do Clinicorp</Label>
              <p className="text-xs text-muted-foreground">
                Processar eventos de procedimentos e agendamentos recebidos do Clinicorp
              </p>
            </div>
            <Switch
              checked={settings.clinicorpWebhookEnabled}
              onCheckedChange={(checked) => {
                setSettings({ ...settings, clinicorpWebhookEnabled: checked });
                fetch(`/api/clinics/${clinic.id}`, {
                  method: "PUT",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ clinicorpWebhookEnabled: checked }),
                });
              }}
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Criar pacientes automaticamente no Clinicorp</Label>
              <p className="text-xs text-muted-foreground">
                Quando um lead atinge o stage &quot;Agendado&quot; no Kommo, criar o paciente
                automaticamente no Clinicorp. Desative para apenas observar sem escrever no CRM.
              </p>
            </div>
            <Switch
              checked={settings.clinicorpAutoCreatePatient}
              onCheckedChange={(checked) => {
                setSettings({ ...settings, clinicorpAutoCreatePatient: checked });
                fetch(`/api/clinics/${clinic.id}`, {
                  method: "PUT",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ clinicorpAutoCreatePatient: checked }),
                });
              }}
            />
          </div>
        </CardContent>
      </Card>

      <Separator />

      <Card>
        <CardHeader>
          <CardTitle>Webhook URLs</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Kommo Webhook</Label>
            <p className="text-xs text-muted-foreground">
              Configure esta URL no Kommo em Configuracoes &gt; Integracoes &gt;
              Webhook
            </p>
            <code className="block rounded bg-muted p-3 text-sm">
              {webhookBase}/api/webhooks/kommo
            </code>
          </div>
          <div className="space-y-2">
            <Label>Clinicorp Webhook</Label>
            <p className="text-xs text-muted-foreground">
              Configure esta URL no Clinicorp para receber eventos
            </p>
            <code className="block rounded bg-muted p-3 text-sm">
              {webhookBase}/api/webhooks/clinicorp
            </code>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
