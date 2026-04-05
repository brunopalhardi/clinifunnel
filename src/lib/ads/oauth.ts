import crypto from "crypto";

const SECRET = process.env.NEXTAUTH_SECRET || "fallback-secret";

/**
 * Gera state parameter assinado com HMAC para prevenir CSRF no OAuth.
 * Formato: clinicId.timestamp.signature
 */
export function generateOAuthState(clinicId: string): string {
  const timestamp = Date.now().toString();
  const payload = `${clinicId}.${timestamp}`;
  const signature = crypto
    .createHmac("sha256", SECRET)
    .update(payload)
    .digest("hex")
    .slice(0, 16);
  return `${payload}.${signature}`;
}

/**
 * Verifica e extrai clinicId do state parameter.
 * Retorna null se inválido ou expirado (>10 min).
 */
export function verifyOAuthState(state: string): string | null {
  const parts = state.split(".");
  if (parts.length !== 3) return null;

  const [clinicId, timestamp, signature] = parts;
  const payload = `${clinicId}.${timestamp}`;

  const expected = crypto
    .createHmac("sha256", SECRET)
    .update(payload)
    .digest("hex")
    .slice(0, 16);

  if (signature !== expected) return null;

  // Expirar após 10 minutos
  const elapsed = Date.now() - parseInt(timestamp, 10);
  if (elapsed > 10 * 60 * 1000) return null;

  return clinicId;
}
