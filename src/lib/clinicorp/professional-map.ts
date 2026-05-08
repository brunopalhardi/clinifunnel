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

// Forma do input que o frontend manda pro endpoint PUT do mapa. Cada entry
// representa uma linha da tabela ("nome no Kommo" -> "ID no Clinicorp").
export interface ProfessionalMapEntry {
  name: string;
  id: number | string;
}

export type ValidateResult =
  | { ok: true; map: ProfessionalMap }
  | { ok: false; error: string };

/**
 * Valida e normaliza um array de entries vindo da UI antes de salvar no DB.
 *
 * Regras:
 * - entries precisa ser array
 * - cada entry: name nao vazio (apos trim) + id positivo (number ou string numerica)
 * - sem nome duplicado case/whitespace insensitive (lookup do resolveProfessionalId
 *   ja e normalizado, manter dois "Dra Alexia" e "Dra. ALEXIA" causa colisao)
 * - retorna { ok: true, map } com chaves usando o nome ORIGINAL (preserva
 *   maiusculas/espacos pra exibir na UI), valores convertidos pra number
 */
export function validateProfessionalMapInput(input: unknown): ValidateResult {
  if (!Array.isArray(input)) {
    return { ok: false, error: "entries deve ser um array" };
  }

  const map: ProfessionalMap = {};
  const seenNormalized = new Map<string, string>(); // normalized -> originalName

  for (let i = 0; i < input.length; i++) {
    const entry = input[i] as Partial<ProfessionalMapEntry> | null | undefined;
    if (!entry || typeof entry !== "object") {
      return { ok: false, error: `entry ${i + 1}: formato invalido` };
    }

    const rawName = typeof entry.name === "string" ? entry.name.trim() : "";
    if (!rawName) {
      return { ok: false, error: `entry ${i + 1}: nome obrigatorio` };
    }

    let id: number;
    if (typeof entry.id === "number") {
      id = entry.id;
    } else if (typeof entry.id === "string") {
      const parsed = Number(entry.id.trim());
      if (!Number.isFinite(parsed)) {
        return { ok: false, error: `entry ${i + 1} ("${rawName}"): ID invalido` };
      }
      id = parsed;
    } else {
      return { ok: false, error: `entry ${i + 1} ("${rawName}"): ID obrigatorio` };
    }

    if (!Number.isInteger(id) || id <= 0) {
      return { ok: false, error: `entry ${i + 1} ("${rawName}"): ID precisa ser inteiro positivo` };
    }

    const norm = normalize(rawName);
    const existing = seenNormalized.get(norm);
    if (existing) {
      return {
        ok: false,
        error: `entry ${i + 1}: nome "${rawName}" duplica "${existing}" (comparacao case/whitespace insensitive)`,
      };
    }
    seenNormalized.set(norm, rawName);
    map[rawName] = id;
  }

  return { ok: true, map };
}

/**
 * Converte o ProfessionalMap (Record<string, number>) pra array de entries —
 * formato consumido pela UI (lista de linhas da tabela).
 */
export function toEntries(map: ProfessionalMap): ProfessionalMapEntry[] {
  return Object.entries(map).map(([name, id]) => ({ name, id }));
}
