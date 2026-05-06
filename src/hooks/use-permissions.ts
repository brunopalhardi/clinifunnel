"use client";

import { useSession } from "next-auth/react";
import { Action, canAccess, Module } from "@/lib/permissions";

// Hook pra UI hide. Server e a fonte de verdade — UI escondida e UX, nao
// seguranca. Chamadas a APIs continuam validando via requirePermission.
//
// Uso:
//   const canEditUsers = useCanAccess("users", "write");
//   {canEditUsers && <Button>Editar</Button>}
export function useCanAccess(module: Module, action: Action): boolean {
  const { data } = useSession();
  if (!data?.user) return false;
  return canAccess(data.user, module, action);
}
