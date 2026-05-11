/**
 * [DASH-3] Mapeia uma Estimate do Clinicorp pra lista de procedures internos,
 * com rateio proporcional do DiscountAmount entre os procedures Aprovados da
 * estimate. Isso reflete a "Venda" como o Clinicorp calcula no painel
 * (FinalAmount dos Aprovados - Desconto da Estimate).
 *
 * Regras:
 * - Pula procedures com Deleted="X" (nao retorna)
 * - DiscountAmount eh rateado SO entre procedures Aprovados (StatusDescription="Aprovado")
 *   porque eh assim que o Clinicorp aplica o desconto em "Vendas"
 * - Procedures nao-Aprovados (Orçamento, etc) retornam discountAmount=0
 * - Rateio proporcional ao FinalAmount; se soma dos aprovados = 0, retorna 0 desconto
 * - Ultimo procedure absorve qualquer resto de centavos por arredondamento
 */

import type {
  ClinicorpEstimate,
  ClinicorpEstimateProcedure,
} from "./types";

export interface MappedProcedure {
  clinicorpProcedureId: string;
  name: string;
  value: number;
  discountAmount: number;
  status: "approved" | "completed" | "cancelled" | "pending";
  statusDescription: string | null;
  paymentAccounted: boolean;
  deleted: boolean;
  completedAt: Date | null;
  // createdAt sugerido (do Estimate.CreateDate) — caller decide se usa.
  estimateCreatedAt: Date;
}

function isDeleted(proc: ClinicorpEstimateProcedure): boolean {
  return proc.Deleted === "X" || (proc.Deleted as unknown) === true;
}

function isApproved(proc: ClinicorpEstimateProcedure): boolean {
  return proc.StatusDescription === "Aprovado";
}

function isPaymentAccounted(proc: ClinicorpEstimateProcedure): boolean {
  return proc.PaymentAccounted === "X" || (proc.PaymentAccounted as unknown) === true;
}

/**
 * Mapeia o status interno legado a partir do procedure (granularidade certa)
 * em vez de Estimate.Status. Antes:
 *   est.Status=APPROVED -> status=approved pra TODOS os procs (incluindo "Orçamento")
 * Agora:
 *   StatusDescription="Aprovado" -> approved
 *   StatusDescription="Orçamento" -> pending
 *   Executed="X" -> completed
 *   StatusDescription="Cancelado" -> cancelled
 */
function mapStatus(proc: ClinicorpEstimateProcedure): MappedProcedure["status"] {
  if (proc.Executed === "X") return "completed";
  const sd = proc.StatusDescription?.toLowerCase() ?? "";
  if (sd === "aprovado") return "approved";
  if (sd === "cancelado") return "cancelled";
  return "pending";
}

export function mapEstimateToProcedures(
  estimate: ClinicorpEstimate,
): MappedProcedure[] {
  const allProcs = estimate.ProcedureList ?? [];
  const aliveProcs = allProcs.filter((p) => !isDeleted(p));

  // Rateio: soma dos FinalAmount dos APROVADOS da mesma estimate.
  const approvedProcs = aliveProcs.filter(isApproved);
  const sumApprovedFinal = approvedProcs.reduce(
    (acc, p) => acc + (p.FinalAmount || p.Amount || 0),
    0,
  );
  const totalDiscount = estimate.DiscountAmount ?? 0;

  // Calcula discountAmount de cada proc aprovado com cuidado pra arredondamento.
  // Usa 2 casas decimais; ultimo proc absorve o residuo.
  const discountByProcId = new Map<number, number>();
  if (totalDiscount > 0 && sumApprovedFinal > 0 && approvedProcs.length > 0) {
    let allocated = 0;
    for (let i = 0; i < approvedProcs.length; i++) {
      const p = approvedProcs[i];
      const isLast = i === approvedProcs.length - 1;
      if (isLast) {
        // Ultimo: pega o que sobrou pra somar exatamente totalDiscount
        const remaining = Math.round((totalDiscount - allocated) * 100) / 100;
        discountByProcId.set(p.id, remaining);
      } else {
        const value = p.FinalAmount || p.Amount || 0;
        const proportion = value / sumApprovedFinal;
        const share = Math.round(proportion * totalDiscount * 100) / 100;
        discountByProcId.set(p.id, share);
        allocated += share;
      }
    }
  }

  const estimateCreatedAt = new Date(estimate.CreateDate);

  return aliveProcs.map<MappedProcedure>((proc) => {
    const finalAmount = proc.FinalAmount || proc.Amount || 0;
    const discount = discountByProcId.get(proc.id) ?? 0;
    const status = mapStatus(proc);
    const completedAt = proc.ExecutedDate ? new Date(proc.ExecutedDate) : null;

    return {
      clinicorpProcedureId: String(proc.id),
      name: proc.OperationDescription,
      value: finalAmount,
      discountAmount: discount,
      status,
      statusDescription: proc.StatusDescription ?? null,
      paymentAccounted: isPaymentAccounted(proc),
      deleted: false, // ja filtramos os deleted acima
      completedAt,
      estimateCreatedAt,
    };
  });
}
