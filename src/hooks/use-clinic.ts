"use client";

import { createContext, useContext } from "react";

interface ClinicContextValue {
  clinic: { id: string; name: string } | null;
  loading: boolean;
}

export const ClinicContext = createContext<ClinicContextValue>({
  clinic: null,
  loading: true,
});

export function useClinic() {
  return useContext(ClinicContext);
}
