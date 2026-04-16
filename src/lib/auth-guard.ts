import { getServerSession } from "next-auth";
import { NextRequest } from "next/server";
import { authOptions } from "@/lib/auth";

interface AuthResult {
  clinicId: string;
  userId: string;
  role: string;
}

export async function getAuthorizedClinicId(
  request: NextRequest
): Promise<AuthResult> {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    throw new AuthError("Nao autenticado", 401);
  }

  const { searchParams } = new URL(request.url);
  const requestedClinicId = searchParams.get("clinicId");
  const userRole = session.user.role;
  const userClinicId = session.user.clinicId;

  // super_admin pode acessar qualquer clínica
  if (userRole === "super_admin") {
    const clinicId = requestedClinicId || userClinicId;
    if (!clinicId) {
      throw new AuthError("clinicId obrigatorio", 400);
    }
    return { clinicId, userId: session.user.id, role: userRole };
  }

  // clinic_admin e user só acessam a própria clínica
  if (requestedClinicId && requestedClinicId !== userClinicId) {
    throw new AuthError("Sem permissao para acessar esta clinica", 403);
  }

  return { clinicId: userClinicId, userId: session.user.id, role: userRole };
}

export class AuthError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}
