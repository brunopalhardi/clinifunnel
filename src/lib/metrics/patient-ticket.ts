// [DASH-13] Métricas de ticket médio por PACIENTE (não por procedure/orçamento).
// Motivação (call Sérgio 08/06): um paciente pode ter 2-3 orçamentos aprovados
// no mês (aprovação parcial + retorno); dividir por orçamento distorce o ticket.
// Funções puras — a API faz as queries e delega o cálculo aqui.

export type PatientClass = "novo" | "recorrente";

export interface ProcedureRow {
  patientId: string;
  value: number;
  discountAmount: number;
}

export interface ProcedureRowComDentista extends ProcedureRow {
  dentistName: string | null;
}

export interface PatientTicket {
  patients: number;
  revenue: number;
  ticketMedio: number;
}

export function computePatientTicket(procs: ProcedureRow[]): PatientTicket {
  const byPatient = new Map<string, number>();
  for (const p of procs) {
    const liquido = p.value - p.discountAmount;
    byPatient.set(p.patientId, (byPatient.get(p.patientId) ?? 0) + liquido);
  }
  const revenue = Array.from(byPatient.values()).reduce((a, b) => a + b, 0);
  const patients = byPatient.size;
  return { patients, revenue, ticketMedio: patients > 0 ? revenue / patients : 0 };
}

export function normalizeCategory(desc: string | null | undefined): string {
  return (desc ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();
}

// Valores confirmados na vistoria DASH-12 (prod): "Avaliação"=novo;
// "Consulta"+"Retorno"=recorrente. Demais (Procedimento, Blogueira, etc) caem no
// fallback por histórico.
const CATEGORIAS_NOVO = new Set(["avaliacao"]);
const CATEGORIAS_RECORRENTE = new Set(["consulta", "retorno"]);

export function classifyPatients(input: {
  patientIds: string[];
  /** categoryDescription dos appointments do paciente NO PERÍODO */
  categoriesByPatient: Map<string, string[]>;
  /** pacientes com procedure Aprovado ANTES do período */
  patientsWithHistory: Set<string>;
}): Map<string, PatientClass> {
  const result = new Map<string, PatientClass>();
  for (const id of input.patientIds) {
    // Histórico ganha: quem já aprovou procedure antes do período é recorrente,
    // independente da tag (evita inflar "novo" com retorno mal tagueado).
    if (input.patientsWithHistory.has(id)) {
      result.set(id, "recorrente");
      continue;
    }
    const cats = (input.categoriesByPatient.get(id) ?? []).map(normalizeCategory);
    if (cats.some((c) => CATEGORIAS_NOVO.has(c))) {
      result.set(id, "novo");
    } else if (cats.some((c) => CATEGORIAS_RECORRENTE.has(c))) {
      result.set(id, "recorrente");
    } else {
      result.set(id, "novo"); // sem tag e sem histórico = novo
    }
  }
  return result;
}

export interface DoutoraTicket {
  dentistName: string;
  patients: number;
  revenue: number;
  ticketMedio: number;
}

export function ticketPorDoutora(procs: ProcedureRowComDentista[]): DoutoraTicket[] {
  const byDentist = new Map<string, { patients: Set<string>; revenue: number }>();
  for (const p of procs) {
    const keyName = p.dentistName?.trim() || "Sem dentista";
    const entry = byDentist.get(keyName) ?? { patients: new Set<string>(), revenue: 0 };
    entry.patients.add(p.patientId);
    entry.revenue += p.value - p.discountAmount;
    byDentist.set(keyName, entry);
  }
  return Array.from(byDentist.entries())
    .map(([dentistName, e]) => ({
      dentistName,
      patients: e.patients.size,
      revenue: e.revenue,
      ticketMedio: e.patients.size > 0 ? e.revenue / e.patients.size : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);
}
