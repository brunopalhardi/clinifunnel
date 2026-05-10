/**
 * DASH-2: filtros de data padronizados pro dashboard.
 *
 * Lead.createdAt e o timestamp de quando o webhook chegou no nosso DB. NAO eh
 * a data de criacao no Kommo — webhook so dispara em mudanca de status, entao
 * leads antigos do Kommo que mudam de etapa hoje viram "novos" no nosso DB.
 *
 * Para o usuario, "leads dos ultimos 7 dias" significa "leads CRIADOS NO KOMMO
 * nos ultimos 7 dias", igual ao que o painel do Kommo mostra. Esse helper
 * aplica esse filtro usando kommoCreatedAt como fonte de verdade, com fallback
 * pra createdAt apenas pra leads legacy que nao tem kommoCreatedAt populado.
 */

import type { Prisma } from "@prisma/client";

interface DateRange {
  from?: string | null;
  to?: string | null;
}

/**
 * Retorna fragmento Prisma `where` pra filtrar leads por janela de tempo
 * usando kommoCreatedAt (fonte de verdade) com fallback pra createdAt apenas
 * em leads sem kommoCreatedAt (legacy).
 *
 * Retorna {} se nao tem filtro — caller pode espalhar com seguranca.
 */
export function buildLeadDateFilter(range: DateRange): Prisma.LeadWhereInput {
  const fromDate = range.from ? new Date(range.from) : null;
  const toDate = range.to ? new Date(range.to) : null;

  if (!fromDate && !toDate) return {};

  const kommoBound: Prisma.DateTimeNullableFilter = {};
  const fallbackBound: Prisma.DateTimeFilter = {};
  if (fromDate) {
    kommoBound.gte = fromDate;
    fallbackBound.gte = fromDate;
  }
  if (toDate) {
    kommoBound.lte = toDate;
    fallbackBound.lte = toDate;
  }

  return {
    OR: [
      { kommoCreatedAt: kommoBound },
      { kommoCreatedAt: null, createdAt: fallbackBound },
    ],
  };
}
