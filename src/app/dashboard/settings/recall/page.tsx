"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useClinic } from "@/hooks/use-clinic";

interface Interval {
  id: string;
  procedureNamePattern: string;
  days: number;
}

interface SettingsData {
  intervals: Interval[];
  inactiveMonths: number;
  postConsultaDays: number;
}

export default function RecallSettingsPage() {
  const { clinic, loading: clinicLoading } = useClinic();
  const [data, setData] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);

  const [inactiveMonths, setInactiveMonths] = useState(6);
  const [postConsultaDays, setPostConsultaDays] = useState(3);
  const [limitsStatus, setLimitsStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const [newPattern, setNewPattern] = useState("");
  const [newDays, setNewDays] = useState("");
  const [addStatus, setAddStatus] = useState<"idle" | "saving" | "error">("idle");
  const [addError, setAddError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPattern, setEditPattern] = useState("");
  const [editDays, setEditDays] = useState("");

  const [seedDismissed, setSeedDismissed] = useState(false);

  const reload = useCallback(() => {
    setLoading(true);
    fetch("/api/settings/recall")
      .then((r) => r.json())
      .then((json) => {
        const d: SettingsData = json.data;
        setData(d);
        setInactiveMonths(d.inactiveMonths);
        setPostConsultaDays(d.postConsultaDays);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!clinic) return;
    reload();
  }, [clinic, reload]);

  async function saveLimits() {
    setLimitsStatus("saving");
    try {
      const res = await fetch("/api/settings/recall/limits", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inactiveMonths, postConsultaDays }),
      });
      if (!res.ok) throw new Error();
      setLimitsStatus("saved");
      setTimeout(() => setLimitsStatus("idle"), 2000);
    } catch {
      setLimitsStatus("error");
      setTimeout(() => setLimitsStatus("idle"), 3000);
    }
  }

  async function addInterval() {
    setAddStatus("saving");
    setAddError(null);
    try {
      const days = Number(newDays);
      const res = await fetch("/api/settings/recall", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ procedureNamePattern: newPattern, days }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Erro ao salvar");
      setNewPattern("");
      setNewDays("");
      setAddStatus("idle");
      reload();
    } catch (e) {
      setAddStatus("error");
      setAddError(e instanceof Error ? e.message : "Erro");
    }
  }

  function startEdit(i: Interval) {
    setEditingId(i.id);
    setEditPattern(i.procedureNamePattern);
    setEditDays(String(i.days));
  }

  async function saveEdit(id: string) {
    try {
      const days = Number(editDays);
      const res = await fetch(`/api/settings/recall/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ procedureNamePattern: editPattern, days }),
      });
      if (!res.ok) return;
      setEditingId(null);
      reload();
    } catch {
      // silently fail
    }
  }

  async function removeInterval(id: string) {
    try {
      const res = await fetch(`/api/settings/recall/${id}`, { method: "DELETE" });
      if (!res.ok) return;
      reload();
    } catch {
      // silently fail
    }
  }

  async function seedDefaults() {
    try {
      const res = await fetch("/api/settings/recall/seed", { method: "POST" });
      if (!res.ok) return;
      reload();
    } catch {
      // silently fail
    }
  }

  if (clinicLoading || loading || !data) {
    return <p className="text-muted-foreground p-8">Carregando...</p>;
  }

  const showSeedBanner = data.intervals.length === 0 && !seedDismissed;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Configuracoes &gt; Recall</h1>
        <p className="text-sm text-muted-foreground">
          Intervalos de alerta de retorno por procedimento e limites globais da clinica
        </p>
      </div>

      {showSeedBanner && (
        <Card className="border-primary/40 bg-primary/5">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2">
                <p className="font-medium">Comece com 5 procedimentos comuns pre-configurados?</p>
                <ul className="text-sm text-muted-foreground space-y-0.5">
                  <li>- Botox (120 dias) - Toxina (120 dias)</li>
                  <li>- Preenchimento (240 dias) - Filler (240 dias)</li>
                  <li>- Bioestimulador (365 dias)</li>
                </ul>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button size="sm" onClick={seedDefaults}>Adicionar todos</Button>
                <Button size="sm" variant="ghost" onClick={() => setSeedDismissed(true)}>x</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Limites gerais</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="inactive-months">Paciente inativo a partir de:</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="inactive-months"
                  type="number"
                  min={1}
                  max={60}
                  value={inactiveMonths}
                  onChange={(e) => setInactiveMonths(Number(e.target.value))}
                  className="w-24"
                />
                <span className="text-sm text-muted-foreground">meses sem procedimento aprovado</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="post-days">Pos-consulta:</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="post-days"
                  type="number"
                  min={1}
                  max={30}
                  value={postConsultaDays}
                  onChange={(e) => setPostConsultaDays(Number(e.target.value))}
                  className="w-24"
                />
                <span className="text-sm text-muted-foreground">dias apos o procedimento</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={saveLimits} disabled={limitsStatus === "saving"}>
              {limitsStatus === "saving" ? "Salvando..." : "Salvar"}
            </Button>
            {limitsStatus === "saved" && <span className="text-sm text-green-600">Salvo!</span>}
            {limitsStatus === "error" && <span className="text-sm text-red-600">Erro ao salvar</span>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recall por procedimento</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Padrao de nome</TableHead>
                <TableHead className="w-32">Dias</TableHead>
                <TableHead className="w-48 text-right">Acoes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.intervals.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground">
                    Nenhum padrao configurado ainda.
                  </TableCell>
                </TableRow>
              ) : (
                data.intervals.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell>
                      {editingId === i.id ? (
                        <Input value={editPattern} onChange={(e) => setEditPattern(e.target.value)} />
                      ) : (
                        i.procedureNamePattern
                      )}
                    </TableCell>
                    <TableCell>
                      {editingId === i.id ? (
                        <Input type="number" value={editDays} onChange={(e) => setEditDays(e.target.value)} />
                      ) : (
                        i.days
                      )}
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      {editingId === i.id ? (
                        <>
                          <Button size="sm" onClick={() => saveEdit(i.id)}>Salvar</Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>Cancelar</Button>
                        </>
                      ) : (
                        <>
                          <Button size="sm" variant="outline" onClick={() => startEdit(i)}>Editar</Button>
                          <Button size="sm" variant="destructive" onClick={() => removeInterval(i.id)}>x</Button>
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          <div className="mt-4 flex flex-wrap items-end gap-3 border-t pt-4">
            <div className="space-y-1 flex-1 min-w-48">
              <Label htmlFor="new-pattern">Novo padrao</Label>
              <Input
                id="new-pattern"
                placeholder='Ex: "botox"'
                value={newPattern}
                onChange={(e) => setNewPattern(e.target.value)}
              />
            </div>
            <div className="space-y-1 w-32">
              <Label htmlFor="new-days">Dias</Label>
              <Input
                id="new-days"
                type="number"
                placeholder="120"
                value={newDays}
                onChange={(e) => setNewDays(e.target.value)}
              />
            </div>
            <Button onClick={addInterval} disabled={addStatus === "saving" || !newPattern || !newDays}>
              + Adicionar
            </Button>
          </div>
          {addError && <p className="mt-2 text-sm text-red-600">{addError}</p>}

          <p className="mt-4 text-xs text-muted-foreground">
            O padrao de nome e casado case-insensitive contra o nome do procedimento no Clinicorp. Ex: &quot;botox&quot; pega &quot;Aplicacao Botox 50U&quot; e &quot;Botox Brow Lift&quot;.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
