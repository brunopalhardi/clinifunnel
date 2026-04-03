"use client";

import { useSession } from "next-auth/react";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { ClinicContext } from "@/hooks/use-clinic";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session, status } = useSession();

  const clinic = session?.user
    ? { id: session.user.clinicId, name: session.user.clinicName }
    : null;

  return (
    <ClinicContext.Provider value={{ clinic, loading: status === "loading" }}>
      <div className="flex h-screen">
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Header />
          <main className="flex-1 overflow-y-auto p-6">{children}</main>
        </div>
      </div>
    </ClinicContext.Provider>
  );
}
