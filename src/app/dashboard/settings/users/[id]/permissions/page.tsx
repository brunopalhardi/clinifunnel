"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ACTIONS, Action, Module, MODULES, Permissions } from "@/lib/permissions";

export const dynamic = "force-dynamic";

interface UserDetail {
  id: string;
  email: string;
  name: string;
  role: string;
  permissions: Permissions | null;
}

export default function UserPermissionsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [user, setUser] = useState<UserDetail | null>(null);
  const [perms, setPerms] = useState<Permissions>({});
  const [useBaseline, setUseBaseline] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/users");
        if (res.status === 403) {
          setForbidden(true);
          return;
        }
        const json = await res.json();
        const found = (json.data as UserDetail[]).find((u) => u.id === params.id);
        if (!found) {
          setError("Usuario nao encontrado");
          return;
        }
        setUser(found);
        setUseBaseline(found.permissions === null);
        setPerms(found.permissions ?? {});
      } catch {
        setError("Erro ao carregar");
      } finally {
        setLoading(false);
      }
    })();
  }, [params.id]);

  function toggle(m: Module, a: Action) {
    setPerms((p) => {
      const cur = p[m] ?? [];
      const has = cur.includes(a);
      const next = has ? cur.filter((x) => x !== a) : [...cur, a];
      return { ...p, [m]: next };
    });
  }

  async function save() {
    if (!user) return;
    setSaving(true);
    setError(null);
    try {
      const body = useBaseline
        ? { permissions: null }
        : { permissions: perms };
      const res = await fetch(`/api/users/${user.id}/permissions`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "falha ao salvar");
        return;
      }
      router.push("/dashboard/settings/users");
    } finally {
      setSaving(false);
    }
  }

  if (forbidden) {
    return (
      <Card>
        <CardHeader><CardTitle>Sem permissao</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Apenas administradores.</p>
        </CardContent>
      </Card>
    );
  }
  if (loading) return <p className="text-sm text-muted-foreground">carregando...</p>;
  if (error && !user) return <p className="text-sm text-red-600">{error}</p>;
  if (!user) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Permissoes</h1>
          <p className="text-sm text-muted-foreground">
            <span className="font-mono">{user.email}</span> · {user.name} ·{" "}
            <Badge variant="secondary">{user.role}</Badge>
          </p>
        </div>
        <Link href="/dashboard/settings/users">
          <Button variant="outline" size="sm">Voltar</Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Modo</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                checked={useBaseline}
                onChange={() => setUseBaseline(true)}
              />
              <span className="text-sm">
                <strong>Baseline do papel</strong> — usa permissoes padrao do role
              </span>
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                checked={!useBaseline}
                onChange={() => setUseBaseline(false)}
              />
              <span className="text-sm">
                <strong>Customizadas</strong> — controle granular por modulo
              </span>
            </label>
          </div>
          {useBaseline && (
            <p className="mt-3 text-xs text-muted-foreground">
              Sem customizacoes: {user.role === "user" ? "leitura nos modulos operacionais (leads, patients, ltv, etc)" : user.role === "clinic_admin" ? "acesso total exceto delete de users" : "tudo"}.
            </p>
          )}
        </CardContent>
      </Card>

      {!useBaseline && (
        <Card>
          <CardHeader>
            <CardTitle>Permissoes customizadas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-3 text-xs text-muted-foreground">
              <strong>Atencao:</strong> permissoes customizadas SUBSTITUEM as
              do role. Se voce nao marcar nada, o usuario perde acesso a tudo.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="py-2 text-left">Modulo</th>
                    {ACTIONS.map((a) => (
                      <th key={a} className="px-3 py-2 text-center capitalize">
                        {a}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {MODULES.map((m) => (
                    <tr key={m} className="border-b">
                      <td className="py-2 font-mono text-xs">{m}</td>
                      {ACTIONS.map((a) => (
                        <td key={a} className="px-3 py-2 text-center">
                          <input
                            type="checkbox"
                            checked={perms[m]?.includes(a) ?? false}
                            onChange={() => toggle(m, a)}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-2">
        <Button onClick={save} disabled={saving}>
          {saving ? "Salvando..." : "Salvar"}
        </Button>
        <Link href="/dashboard/settings/users">
          <Button variant="outline">Cancelar</Button>
        </Link>
      </div>
    </div>
  );
}
