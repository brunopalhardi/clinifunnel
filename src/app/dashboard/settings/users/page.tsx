"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const dynamic = "force-dynamic";

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  clinicId: string;
  mustChangePassword: boolean;
  createdAt: string;
}

interface TempPasswordInfo {
  email: string;
  temporaryPassword: string;
  isReset: boolean;
}

const roleLabel: Record<string, string> = {
  super_admin: "Super Admin",
  clinic_admin: "Admin",
  user: "Usuario",
};

export default function UsersAdminPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState("user");
  const [creating, setCreating] = useState(false);

  // Temp password modal state — exibido APENAS uma vez apos create/reset
  const [tempInfo, setTempInfo] = useState<TempPasswordInfo | null>(null);
  const [resettingId, setResettingId] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/users");
      if (res.status === 403) {
        setForbidden(true);
        return;
      }
      if (!res.ok) {
        setError(`erro ${res.status}`);
        return;
      }
      const json = await res.json();
      setUsers(json.data ?? []);
    } catch {
      setError("erro de rede");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: newEmail, name: newName, role: newRole }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "falha ao criar");
        return;
      }
      setTempInfo({
        email: json.data.email,
        temporaryPassword: json.data.temporaryPassword,
        isReset: false,
      });
      setNewEmail("");
      setNewName("");
      setNewRole("user");
      setShowForm(false);
      fetchUsers();
    } finally {
      setCreating(false);
    }
  }

  async function onReset(user: User) {
    if (!confirm(`Resetar senha de ${user.email}? Uma nova senha temporaria sera gerada.`)) {
      return;
    }
    setResettingId(user.id);
    setError(null);
    try {
      const res = await fetch(`/api/users/${user.id}/reset-password`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "falha ao resetar");
        return;
      }
      setTempInfo({
        email: user.email,
        temporaryPassword: json.data.temporaryPassword,
        isReset: true,
      });
      fetchUsers();
    } finally {
      setResettingId(null);
    }
  }

  async function copyTemp() {
    if (!tempInfo) return;
    try {
      await navigator.clipboard.writeText(tempInfo.temporaryPassword);
    } catch {
      // ignore — user pode copiar manual
    }
  }

  if (forbidden) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Sem permissao</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Apenas administradores podem gerenciar usuarios.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Usuarios</h1>
          <p className="text-sm text-muted-foreground">
            Gerencie acesso ao painel da clinica
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/settings">
            <Button variant="outline" size="sm">Voltar</Button>
          </Link>
          <Button size="sm" onClick={() => setShowForm((s) => !s)}>
            {showForm ? "Cancelar" : "Novo usuario"}
          </Button>
        </div>
      </div>

      {/* Modal/alerta de senha temporaria — visivel uma unica vez */}
      {tempInfo && (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardHeader>
            <CardTitle className="text-amber-600 dark:text-amber-400">
              Senha temporaria gerada {tempInfo.isReset ? "(reset)" : ""}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm">
              Anote esta senha agora. <strong>Nao sera mostrada de novo.</strong>{" "}
              Entregue pra <strong>{tempInfo.email}</strong> — no primeiro login,
              o sistema obriga a trocar.
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded bg-muted px-3 py-2 font-mono text-base">
                {tempInfo.temporaryPassword}
              </code>
              <Button size="sm" variant="outline" onClick={copyTemp}>
                Copiar
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setTempInfo(null)}>
                Fechar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>Novo usuario</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={onCreate} className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="new-email">Email</Label>
                <Input
                  id="new-email"
                  type="email"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="usuario@clinica.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-name">Nome</Label>
                <Input
                  id="new-name"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Nome completo"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="new-role">Papel</Label>
                <select
                  id="new-role"
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                >
                  <option value="user">Usuario</option>
                  <option value="clinic_admin">Admin da Clinica</option>
                </select>
                <p className="text-xs text-muted-foreground">
                  Usuario: acesso operacional. Admin: gerencia outros usuarios.
                </p>
              </div>
              <div className="md:col-span-2">
                <Button type="submit" disabled={creating}>
                  {creating ? "Criando..." : "Criar e gerar senha"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Usuarios da clinica ({users.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
          {loading ? (
            <p className="text-sm text-muted-foreground">carregando...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Papel</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Criado em</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      Nenhum usuario.
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-mono text-xs">{u.email}</TableCell>
                      <TableCell>{u.name}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            u.role === "super_admin"
                              ? "destructive"
                              : u.role === "clinic_admin"
                              ? "default"
                              : "secondary"
                          }
                        >
                          {roleLabel[u.role] ?? u.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {u.mustChangePassword ? (
                          <Badge variant="outline" className="border-amber-500/40 text-amber-600">
                            senha pendente
                          </Badge>
                        ) : (
                          <Badge variant="outline">ativo</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">
                        {new Date(u.createdAt).toLocaleDateString("pt-BR")}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={resettingId === u.id || u.role === "super_admin"}
                          onClick={() => onReset(u)}
                          title={
                            u.role === "super_admin"
                              ? "Nao e possivel resetar senha de super_admin via UI"
                              : "Gerar nova senha temporaria"
                          }
                        >
                          {resettingId === u.id ? "..." : "Resetar senha"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
