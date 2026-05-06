import { describe, expect, it } from "vitest";
import {
  canAccess,
  getEffectivePermissions,
  PermissionDeniedError,
  requirePermission,
} from "./permissions";

describe("canAccess: super_admin", () => {
  it("sempre pode tudo, mesmo com permissions vazio", () => {
    const user = { role: "super_admin", permissions: {} };
    expect(canAccess(user, "leads", "read")).toBe(true);
    expect(canAccess(user, "users", "delete")).toBe(true);
    expect(canAccess(user, "ads", "write")).toBe(true);
  });

  it("ignora permissions explicit (lockout protection)", () => {
    const user = { role: "super_admin", permissions: { leads: [] } };
    expect(canAccess(user, "leads", "read")).toBe(true);
  });
});

describe("canAccess: clinic_admin baseline (permissions null)", () => {
  const user = { role: "clinic_admin", permissions: null };

  it("pode read/write/delete em quase tudo", () => {
    expect(canAccess(user, "leads", "read")).toBe(true);
    expect(canAccess(user, "leads", "write")).toBe(true);
    expect(canAccess(user, "patients", "delete")).toBe(true);
    expect(canAccess(user, "settings", "write")).toBe(true);
  });

  it("users NAO pode delete (so super_admin)", () => {
    expect(canAccess(user, "users", "read")).toBe(true);
    expect(canAccess(user, "users", "write")).toBe(true);
    expect(canAccess(user, "users", "delete")).toBe(false);
  });
});

describe("canAccess: user baseline (permissions null)", () => {
  const user = { role: "user", permissions: null };

  it("read em modulos operacionais", () => {
    expect(canAccess(user, "leads", "read")).toBe(true);
    expect(canAccess(user, "patients", "read")).toBe(true);
    expect(canAccess(user, "ltv", "read")).toBe(true);
  });

  it("nao pode write em nada por baseline", () => {
    expect(canAccess(user, "leads", "write")).toBe(false);
    expect(canAccess(user, "patients", "delete")).toBe(false);
  });

  it("nao acessa settings, users, ads", () => {
    expect(canAccess(user, "settings", "read")).toBe(false);
    expect(canAccess(user, "users", "read")).toBe(false);
    expect(canAccess(user, "ads", "read")).toBe(false);
  });
});

describe("canAccess: permissions explicitas sobrescrevem baseline", () => {
  it("user com leads:write ganha permissao alem do baseline", () => {
    const user = { role: "user", permissions: { leads: ["read", "write"] } };
    expect(canAccess(user, "leads", "write")).toBe(true);
    // Mas permissions explicit = override total. Patients (no baseline) NAO esta listado.
    expect(canAccess(user, "patients", "read")).toBe(false);
  });

  it("clinic_admin com permissions: { leads: ['read'] } perde write em outros modulos", () => {
    const user = {
      role: "clinic_admin",
      permissions: { leads: ["read"] },
    };
    expect(canAccess(user, "leads", "read")).toBe(true);
    expect(canAccess(user, "leads", "write")).toBe(false);
    // Modulos nao listados: sem permissao.
    expect(canAccess(user, "patients", "read")).toBe(false);
  });
});

describe("canAccess: permissions invalidas viram baseline (defesa)", () => {
  it("permissions com chave fora dos modulos canonicos: ignorada", () => {
    const user = {
      role: "user",
      permissions: { leads: ["read"], desconhecido: ["write"] },
    };
    expect(canAccess(user, "leads", "read")).toBe(true);
  });

  it("permissions com action invalida: array descartado, cai no baseline do role", () => {
    const user = {
      role: "user",
      permissions: { leads: ["read", "hack"] as unknown as string[] },
    };
    // every() falha pq "hack" nao e action valida -> out[leads] nao setado ->
    // permissions virtualmente vazia -> getEffective volta pro baseline -> user
    // baseline tem leads:[read].
    expect(canAccess(user, "leads", "read")).toBe(true);
    // Write continua bloqueado (baseline user nao tem write em leads).
    expect(canAccess(user, "leads", "write")).toBe(false);
  });

  it("permissions nao-objeto: usa baseline do role", () => {
    const u = { role: "user", permissions: "string-invalida" };
    expect(canAccess(u, "leads", "read")).toBe(true); // baseline user
  });
});

describe("getEffectivePermissions", () => {
  it("retorna permissions explicit se valida", () => {
    const u = { role: "user", permissions: { leads: ["write"] } };
    expect(getEffectivePermissions(u)).toEqual({ leads: ["write"] });
  });

  it("retorna baseline do role se permissions null", () => {
    const u = { role: "user", permissions: null };
    const eff = getEffectivePermissions(u);
    expect(eff.leads).toEqual(["read"]);
    expect(eff.users).toBeUndefined();
  });
});

describe("requirePermission", () => {
  it("nao lanca se autorizado", () => {
    const u = { role: "clinic_admin", permissions: null };
    expect(() => requirePermission(u, "leads", "write")).not.toThrow();
  });

  it("lanca PermissionDeniedError se nao autorizado", () => {
    const u = { role: "user", permissions: null };
    expect(() => requirePermission(u, "settings", "write")).toThrow(PermissionDeniedError);
  });

  it("erro tem status 403", () => {
    const u = { role: "user", permissions: null };
    try {
      requirePermission(u, "settings", "write");
    } catch (e) {
      expect(e).toBeInstanceOf(PermissionDeniedError);
      expect((e as PermissionDeniedError).status).toBe(403);
    }
  });
});
