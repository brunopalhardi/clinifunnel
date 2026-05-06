// RBAC granular por modulo. Usado em API routes (server-side enforcement) e
// na UI (conditional rendering).
//
// Modelo hibrido:
//  - role da baseline (super_admin tem tudo, user tem leitura limitada)
//  - User.permissions (Json) sobrescreve quando definido
//  - quando permissions e null/undefined, role decide (compat com users legado)

export const MODULES = [
  "leads",
  "patients",
  "campaigns",
  "procedures",
  "ltv",
  "financeiro",
  "logs",
  "settings",
  "users",
  "ads",
] as const;
export type Module = (typeof MODULES)[number];

export const ACTIONS = ["read", "write", "delete"] as const;
export type Action = (typeof ACTIONS)[number];

export type Permissions = Partial<Record<Module, Action[]>>;

interface UserLike {
  role: string;
  permissions?: unknown;
}

// Verifica se permissions tem shape esperado. Json no Prisma vem como unknown.
function parsePermissions(raw: unknown): Permissions | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== "object" || Array.isArray(raw)) return null;
  const out: Permissions = {};
  for (const m of MODULES) {
    const v = (raw as Record<string, unknown>)[m];
    if (Array.isArray(v) && v.every((x) => ACTIONS.includes(x as Action))) {
      out[m] = v as Action[];
    }
  }
  return out;
}

// Baseline por role quando User.permissions e null. Pode ser sobrescrito.
const ROLE_BASELINE: Record<string, Permissions> = {
  super_admin: Object.fromEntries(
    MODULES.map((m) => [m, [...ACTIONS]]),
  ) as Permissions,
  clinic_admin: Object.fromEntries(
    MODULES.map((m) => [
      m,
      m === "users" ? ["read", "write"] : [...ACTIONS], // clinic_admin nao deleta users via UI
    ]),
  ) as Permissions,
  user: {
    leads: ["read"],
    patients: ["read"],
    campaigns: ["read"],
    procedures: ["read"],
    ltv: ["read"],
    financeiro: ["read"],
    logs: ["read"],
    // Sem acesso a settings, users, ads.
  },
};

export function getEffectivePermissions(user: UserLike): Permissions {
  const explicit = parsePermissions(user.permissions);
  if (explicit && Object.keys(explicit).length > 0) {
    return explicit;
  }
  return ROLE_BASELINE[user.role] ?? {};
}

export function canAccess(
  user: UserLike,
  module: Module,
  action: Action,
): boolean {
  // super_admin sempre pode tudo, mesmo se alguem setar permissions: {}.
  // E uma valvula de seguranca pra evitar lockout administrativo.
  if (user.role === "super_admin") return true;

  const perms = getEffectivePermissions(user);
  const moduleActions = perms[module];
  if (!moduleActions) return false;
  return moduleActions.includes(action);
}

// Helper pra rotas: throw 403 se nao tem permissao.
export class PermissionDeniedError extends Error {
  status = 403;
  constructor(module: Module, action: Action) {
    super(`Sem permissao para ${action} em ${module}`);
    this.name = "PermissionDeniedError";
  }
}

export function requirePermission(
  user: UserLike,
  module: Module,
  action: Action,
): void {
  if (!canAccess(user, module, action)) {
    throw new PermissionDeniedError(module, action);
  }
}
