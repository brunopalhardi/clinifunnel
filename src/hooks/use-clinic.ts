"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";

interface Clinic {
  id: string;
  name: string;
}

export function useClinic() {
  const { data: session, status } = useSession();
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [selectedClinicId, setSelectedClinicId] = useState<string | null>(null);

  const role = session?.user?.role;
  const isSuperAdmin = role === "super_admin";

  // For super_admin: fetch all clinics
  useEffect(() => {
    if (!isSuperAdmin) return;
    fetch("/api/clinics")
      .then((res) => res.json())
      .then((json) => {
        const list = json.data ?? [];
        setClinics(list);
        // Restore from localStorage or use first
        const saved = localStorage.getItem("selectedClinicId");
        const valid = list.find((c: Clinic) => c.id === saved);
        setSelectedClinicId(valid ? saved : list[0]?.id ?? null);
      })
      .catch(() => {});
  }, [isSuperAdmin]);

  const selectClinic = useCallback((clinicId: string) => {
    setSelectedClinicId(clinicId);
    localStorage.setItem("selectedClinicId", clinicId);
  }, []);

  const clinic = useMemo(() => {
    if (isSuperAdmin) {
      const selected = clinics.find((c) => c.id === selectedClinicId);
      return selected ?? null;
    }
    return session?.user
      ? { id: session.user.clinicId, name: session.user.clinicName }
      : null;
  }, [isSuperAdmin, clinics, selectedClinicId, session?.user?.clinicId, session?.user?.clinicName]);

  return {
    clinic,
    clinics,
    role: role ?? "user",
    isSuperAdmin,
    selectClinic,
    loading: status === "loading",
  };
}
