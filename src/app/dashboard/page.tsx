import { redirect } from "next/navigation";

// [DASH-5] Dashboard foi dividido em duas paginas:
// - /dashboard/captacao (Kommo: funil de captacao)
// - /dashboard/operacao (Clinicorp: operacao da clinica)
// Root /dashboard agora redireciona pra captacao (default).
export default function DashboardRootPage() {
  redirect("/dashboard/captacao");
}
