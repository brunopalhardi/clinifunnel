"use client";

import { useSession } from "next-auth/react";

export function useClinic() {
  const { data: session, status } = useSession();

  const clinic =
    session?.user
      ? { id: session.user.clinicId, name: session.user.clinicName }
      : null;

  return {
    clinic,
    loading: status === "loading",
  };
}
