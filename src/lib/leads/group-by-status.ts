export interface LeadForGrouping {
  id: string;
  kommoStatus: string | null;
  statusName: string | null;
  statusColor: string | null;
}

export interface StatusGroup {
  id: string;
  name: string;
  color: string | null;
  count: number;
}

const NONE_BUCKET = "__none__";

// [DASH-8] Agrupa leads pelo kommoStatus para o bloco "Por status" na pagina
// de leads. Leads sem status caem no bucket __none__. Ordenado por count desc
// pra mostrar os status mais lotados em primeiro (geralmente "em qualificacao").
export function groupLeadsByStatus(leads: LeadForGrouping[]): StatusGroup[] {
  const map = new Map<string, StatusGroup>();
  for (const lead of leads) {
    const id = lead.kommoStatus ?? NONE_BUCKET;
    const existing = map.get(id);
    if (existing) {
      existing.count++;
    } else {
      map.set(id, {
        id,
        name: lead.statusName ?? (id === NONE_BUCKET ? "Sem status" : id),
        color: lead.statusColor,
        count: 1,
      });
    }
  }
  return Array.from(map.values()).sort((a, b) => b.count - a.count);
}
