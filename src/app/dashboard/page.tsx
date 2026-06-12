import { redirect } from "next/navigation";

// [DASH-5] Dashboard foi dividido em duas paginas:
// - /dashboard/captacao (Kommo: funil de captacao)
// - /dashboard/operacao (Clinicorp: operacao da clinica)
// [DASH-14] Root /dashboard agora redireciona pro Painel Principal (novo default).
export default function DashboardRootPage() {
  redirect("/dashboard/painel");
}
