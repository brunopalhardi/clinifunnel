"use client";

import { useMemo } from "react";
import { useSession } from "next-auth/react";

export function useClinic() {
  const { data: session, status } = useSession();

  const clinic = useMemo(
    () =>
      session?.user
        ? { id: session.user.clinicId, name: session.user.clinicName }
        : null,
    [session?.user?.clinicId, session?.user?.clinicName]
  );

  return {
    clinic,
    loading: status === "loading",
  };
}
