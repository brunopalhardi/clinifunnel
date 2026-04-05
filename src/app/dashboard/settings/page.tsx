"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  hasMeta: boolean;
  hasGoogle: boolean;
  metaAdAccountId: string;
  googleAdsCustomerId: string;
}

interface WebhookLog {
  id: string;
  source: string;
  event: string;
  payload: unknown;
  status: string;
  error: string | null;
  createdAt: string;
}

type SaveStatus = "idle" | "saving" | "saved" | "error";

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  received: "outline",
  processed: "default",
  error: "destructive",
};

export default function SettingsPage() {
  const { clinic, loading: clinicLoading } = useClinic();
  const [tab, setTab] = useState("integracoes");
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

  // Logs
  const [logs, setLogs] = useState<WebhookLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logFilter, setLogFilter] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Ads disconnect loading
  const [disconnecting, setDisconnecting] = useState<string | null>(null);

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

  const fetchLogs = useCallback(() => {
    setLogsLoading(true);
    const params = new URLSearchParams();
    if (logFilter) params.set("source", logFilter);
    fetch(`/api/webhook-logs?${params}`)
      .then((res) => res.json())
      .then((json) => setLogs(json.data ?? []))
      .catch(() => {})
      .finally(() => setLogsLoading(false));
  }, [logFilter]);

  useEffect(() => {
    if (tab === "logs") fetchLogs();
  }, [tab, fetchLogs]);

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

  async function disconnectAds(platform: "meta" | "google") {
    if (!clinic) return;
    setDisconnecting(platform);
    try {
      await fetch("/api/ads/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clinicId: clinic.id, platform }),
      });
      setSettings((prev) =>
        prev
          ? {
              ...prev,
              ...(platform === "meta"
                ? { hasMeta: false, metaAdAccountId: "" }
                : { hasGoogle: false, googleAdsCustomerId: "" }),
            }
          : null
      );
    } catch {
      // silently fail
    } finally {
      setDisconnecting(null);
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
          {settings.hasMeta && <Badge variant="default">Meta Ads</Badge>}
          {settings.hasGoogle && <Badge variant="default">Google Ads</Badge>}
        </div>
      </div>

      <Card>
        <CardContent className="pt-4">
          <p className="text-sm text-muted-foreground">
            <span className="font-medium">{settings.name}</span> &mdash;{" "}
            {settings.kommoSubdomain}.kommo.com
          </p>
        </CardContent>
      </Card>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="integracoes">Integracoes</TabsTrigger>
          <TabsTrigger value="anuncios">Anuncios</TabsTrigger>
          <TabsTrigger value="controles">Controles</TabsTrigger>
          <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
        </TabsList>

        {/* ===== INTEGRACOES ===== */}
        <TabsContent value="integracoes">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Kommo</CardTitle>
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

            <Card>
              <CardHeader>
                <CardTitle>Clinicorp</CardTitle>
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
          </div>
        </TabsContent>

        {/* ===== ANUNCIOS (Meta + Google Ads) ===== */}
        <TabsContent value="anuncios">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Meta Ads</CardTitle>
                  <Badge variant={settings.hasMeta ? "default" : "outline"}>
                    {settings.hasMeta ? "Conectado" : "Desconectado"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Conecte sua conta do Meta Ads para importar dados de campanhas
                  (gastos, impressoes, cliques). Somente leitura — nenhum dado de
                  paciente e enviado ao Meta.
                </p>
                {settings.hasMeta ? (
                  <div className="space-y-3">
                    <div className="rounded bg-muted p-3">
                      <p className="text-sm">
                        <span className="font-medium">Ad Account:</span>{" "}
                        {settings.metaAdAccountId}
                      </p>
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={disconnecting === "meta"}
                      onClick={() => disconnectAds("meta")}
                    >
                      {disconnecting === "meta" ? "Desconectando..." : "Desconectar Meta Ads"}
                    </Button>
                  </div>
                ) : (
                  <Button
                    onClick={() => {
                      window.location.href = "/api/auth/meta";
                    }}
                  >
                    Conectar Meta Ads
                  </Button>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Google Ads</CardTitle>
                  <Badge variant={settings.hasGoogle ? "default" : "outline"}>
                    {settings.hasGoogle ? "Conectado" : "Desconectado"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Conecte sua conta do Google Ads para importar dados de campanhas.
                  Somente leitura — usado apenas para calcular ROI das campanhas.
                </p>
                {settings.hasGoogle ? (
                  <div className="space-y-3">
                    <div className="rounded bg-muted p-3">
                      <p className="text-sm">
                        <span className="font-medium">Customer ID:</span>{" "}
                        {settings.googleAdsCustomerId}
                      </p>
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={disconnecting === "google"}
                      onClick={() => disconnectAds("google")}
                    >
                      {disconnecting === "google"
                        ? "Desconectando..."
                        : "Desconectar Google Ads"}
                    </Button>
                  </div>
                ) : (
                  <Button
                    onClick={() => {
                      window.location.href = "/api/auth/google-ads";
                    }}
                  >
                    Conectar Google Ads
                  </Button>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">
                  Os dados de anuncios sao sincronizados automaticamente a cada 6 horas.
                  Apenas dados agregados de campanhas (gastos, impressoes, cliques) sao
                  importados. Nenhum dado pessoal de pacientes e compartilhado com as
                  plataformas de anuncios.
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ===== CONTROLES ===== */}
        <TabsContent value="controles">
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
        </TabsContent>

        {/* ===== WEBHOOKS ===== */}
        <TabsContent value="webhooks">
          <Card>
            <CardHeader>
              <CardTitle>Webhook URLs</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Kommo Webhook</Label>
                <p className="text-xs text-muted-foreground">
                  Configure esta URL no Kommo em Configuracoes &gt; Integracoes &gt; Webhook
                </p>
                <code className="block rounded bg-muted p-3 text-sm">
                  {webhookBase}/api/webhooks/kommo
                </code>
              </div>
              <Separator />
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
        </TabsContent>

        {/* ===== LOGS ===== */}
        <TabsContent value="logs">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Webhook Logs</CardTitle>
                <div className="flex gap-2">
                  <Button
                    variant={logFilter === null ? "default" : "outline"}
                    size="sm"
                    onClick={() => setLogFilter(null)}
                  >
                    Todos
                  </Button>
                  <Button
                    variant={logFilter === "kommo" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setLogFilter("kommo")}
                  >
                    Kommo
                  </Button>
                  <Button
                    variant={logFilter === "clinicorp" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setLogFilter("clinicorp")}
                  >
                    Clinicorp
                  </Button>
                  <Button variant="outline" size="sm" onClick={fetchLogs}>
                    Atualizar
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {logsLoading ? (
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
                                  setExpandedId(expandedId === log.id ? null : log.id)
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
        </TabsContent>
      </Tabs>
    </div>
  );
}
