import { Suspense } from "react";
import { LoginShell } from "@/components/login/login-shell";
import { LoginCard } from "@/components/login/login-card";

export default function LoginPage() {
  return (
    <LoginShell>
      <Suspense>
        <LoginCard />
      </Suspense>
    </LoginShell>
  );
}
