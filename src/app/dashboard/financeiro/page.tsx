import { redirect } from "next/navigation";

// [DASH-5] /dashboard/financeiro foi unificado em /dashboard/operacao.
// Mantemos o redirect pra nao quebrar links externos / favoritos.
export default function FinanceiroRedirect() {
  redirect("/dashboard/operacao");
}
