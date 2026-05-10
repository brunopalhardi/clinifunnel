"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useClinic } from "@/hooks/use-clinic";

interface Entry {
  name: string;
  // String no estado local pra suportar input controlled e digitacao parcial
  // (ex: usuario apagando o numero). Convertido pra number antes do PUT.
  id: string;
}

type SaveStatus = "idle" | "saving" | "saved" | "error";

function entriesEqual(a: Entry[], b: Entry[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((e, i) => e.name === b[i].name && e.id === b[i].id);
}

export default function ProfessionalsPage() {
  const { clinic, loading: clinicLoading } = useClinic();
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [original, setOriginal] = useState<Entry[]>([]);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!clinic) return;
    setLoading(true);
    fetch(`/api/clinics/${clinic.id}/professional-map`)
      .then((res) => {
        if (!res.ok) throw new Error("fetch failed");
        return res.json();
      })
      .then((json) => {
        const fetched: Entry[] = (json.data?.entries ?? []).map(
          (e: { name: string; id: number }) => ({ name: e.name, id: String(e.id) }),
        );
        setEntries(fetched);
        setOriginal(fetched);
      })
      .catch(() => {
        setEntries([]);
        setOriginal([]);
      })
      .finally(() => setLoading(false));
  }, [clinic]);

  function updateEntry(index: number, patch: Partial<Entry>) {
    setEntries((prev) => prev.map((e, i) => (i === index ? { ...e, ...patch } : e)));
  }

  function addRow() {
    setEntries((prev) => [...prev, { name: "", id: "" }]);
  }

  function removeRow(index: number) {
    setEntries((prev) => prev.filter((_, i) => i !== index));
  }

  function reset() {
    setEntries(original);
    setError(null);
  }

  async function save() {
    if (!clinic) return;
    setStatus("saving");
    setError(null);

    // Sanitiza antes de mandar: trim + converte id pra number quando possivel.
    // O server faz validacao final via validateProfessionalMapInput.
    const payload = entries.map((e) => ({
      name: e.name.trim(),
      id: e.id.trim() === "" ? e.id : Number(e.id.trim()),
    }));

    try {
      const res = await fetch(`/api/clinics/${clinic.id}/professional-map`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries: payload }),
      });
      const json = await res.json();
      if (!res.ok) {
        setStatus("error");
        setError(json.error ?? "Erro ao salvar");
        setTimeout(() => setStatus("idle"), 4000);
        return;
      }
      const fetched: Entry[] = (json.data?.entries ?? []).map(
        (e: { name: string; id: number }) => ({ name: e.name, id: String(e.id) }),
      );
      setEntries(fetched);
      setOriginal(fetched);
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 2000);
    } catch {
      setStatus("error");
      setError("Erro de rede ao salvar");
      setTimeout(() => setStatus("idle"), 4000);
    }
  }

  if (clinicLoading || loading) {
    return <p className="text-muted-foreground">Carregando...</p>;
  }

  if (!clinic) {
    return (
      <p className="text-muted-foreground">
        Nenhuma clinica encontrada. Crie uma clinica para configurar.
      </p>
    );
  }

  const dirty = !entriesEqual(entries, original);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/dashboard/settings"
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            ← Configuracoes
          </Link>
          <h1 className="text-2xl font-bold">Mapa de Profissionais</h1>
          <p className="text-sm text-muted-foreground">
            Vincula o nome do profissional no Kommo (campo &quot;ATENDIDO POR&quot;) ao
            ID interno do Clinicorp. Sem isso, agendamentos vindos do Kommo nao
            sabem com qual dentista marcar no Clinicorp.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{clinic.name}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome no Kommo</TableHead>
                <TableHead>ID no Clinicorp</TableHead>
                <TableHead className="w-32"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground">
                    Nenhum profissional cadastrado. Clique em &quot;Adicionar
                    profissional&quot; abaixo.
                  </TableCell>
                </TableRow>
              ) : (
                entries.map((entry, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      <Input
                        value={entry.name}
                        placeholder="Ex: Dra. Alexia Duarte"
                        onChange={(e) => updateEntry(index, { name: e.target.value })}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={entry.id}
                        inputMode="numeric"
                        placeholder="Ex: 6310671343550464"
                        onChange={(e) => updateEntry(index, { id: e.target.value })}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeRow(index)}
                      >
                        Remover
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button variant="outline" size="sm" onClick={addRow}>
              + Adicionar profissional
            </Button>
            <div className="flex items-center gap-3">
              {status === "saved" && (
                <span className="text-sm text-green-600">Salvo!</span>
              )}
              {status === "error" && error && (
                <span className="text-sm text-red-600">{error}</span>
              )}
              {dirty && (
                <Button variant="ghost" size="sm" onClick={reset} disabled={status === "saving"}>
                  Cancelar
                </Button>
              )}
              <Button onClick={save} disabled={!dirty || status === "saving"}>
                {status === "saving" ? "Salvando..." : "Salvar mudancas"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4 text-xs text-muted-foreground space-y-2">
          <p className="font-medium text-foreground">Como descobrir o ID do Clinicorp?</p>
          <p>
            No painel do Clinicorp, na lista de profissionais, o ID aparece na URL ou
            em campos internos. Tambem da pra usar a API do Clinicorp (endpoint{" "}
            <code className="rounded bg-muted px-1">/professionals</code>).
          </p>
          <p>
            <span className="font-medium text-foreground">Sobre nomes:</span> a comparacao
            e case e whitespace insensitive — &quot;Dra Alexia&quot; e &quot;DRA
            ALEXIA&quot; sao considerados o mesmo profissional. Use exatamente o que
            aparece no campo &quot;ATENDIDO POR&quot; do Kommo.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
