/**
 * INT-2: traducao do select ATENDIDO POR (Kommo, string) para Dentist_PersonId (Clinicorp, number).
 *
 * O Kommo armazena o profissional como string (label do select). O Clinicorp espera o ID
 * numerico do profissional. Cada Clinic tem um JSON com pares { "nome no kommo": idClinicorp }.
 * Lookup case e whitespace insensitive pra evitar falha por diferenca trivial de digitacao.
 */
import type { Prisma } from "@prisma/client";

export type ProfessionalMap = Record<string, number>;

function normalize(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function parseProfessionalMap(raw: Prisma.JsonValue | null | undefined): ProfessionalMap {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: ProfessionalMap = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === "number" && Number.isFinite(v) && v > 0) {
      out[k] = v;
    } else if (typeof v === "string") {
      const n = Number(v);
      if (Number.isFinite(n) && n > 0) out[k] = n;
    }
  }
  return out;
}

/**
 * Resolve um profId numerico a partir do valor que veio do Kommo.
 *
 * Estrategia:
 * 1. Se o valor ja for numerico (ex: clinica configurou o select com IDs como label),
 *    usa direto.
 * 2. Senao, faz lookup no professionalMap (case/whitespace insensitive).
 *
 * Retorna null se nao conseguir resolver — caller decide se segue sem appointment ou loga.
 */
export function resolveProfessionalId(
  kommoValue: string | null | undefined,
  rawMap: Prisma.JsonValue | null | undefined,
): number | null {
  if (!kommoValue) return null;
  const trimmed = kommoValue.trim();
  if (!trimmed) return null;

  // Caso 1: valor ja e numerico
  const asNumber = Number(trimmed);
  if (Number.isFinite(asNumber) && asNumber > 0 && /^\d+$/.test(trimmed)) {
    return asNumber;
  }

  // Caso 2: lookup no map normalizado
  const map = parseProfessionalMap(rawMap);
  const target = normalize(trimmed);
  for (const [name, id] of Object.entries(map)) {
    if (normalize(name) === target) return id;
  }
  return null;
}
