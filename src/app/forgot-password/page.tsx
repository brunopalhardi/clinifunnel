import Link from "next/link";
import { LoginShell } from "@/components/login/login-shell";

export default function ForgotPasswordPage() {
  return (
    <LoginShell>
      <div className="glass-card rounded-xl p-8 text-center sm:rounded-[1.375rem] sm:p-9">
        <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-primary">
          Esqueci minha senha
        </div>
        <h1 className="mb-3 font-display text-2xl font-bold tracking-tight text-foreground">
          Em breve
        </h1>
        <p className="mb-6 text-sm text-muted-foreground">
          A recuperação automática de senha ainda está em desenvolvimento. Por
          enquanto, peça ao admin da sua clínica pra redefinir sua senha pelo
          painel de usuários.
        </p>
        <Link
          href="/login"
          className="inline-block text-xs font-semibold text-primary hover:underline"
        >
          ← Voltar ao login
        </Link>
      </div>
    </LoginShell>
  );
}
