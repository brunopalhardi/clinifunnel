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
  const [clinicsLoaded, setClinicsLoaded] = useState(false);

  const role = session?.user?.role;
  const isSuperAdmin = role === "super_admin";

  // Default clinic from session (always available)
  const sessionClinic = useMemo(() => {
    if (!session?.user) return null;
    return { id: session.user.clinicId, name: session.user.clinicName };
  }, [session?.user?.clinicId, session?.user?.clinicName]);

  // For super_admin: fetch all clinics
  useEffect(() => {
    if (!isSuperAdmin || !session?.user) return;
    fetch("/api/clinics")
      .then((res) => res.json())
      .then((json) => {
        const list = json.data ?? [];
        setClinics(list);
        const saved = localStorage.getItem("selectedClinicId");
        const valid = list.find((c: Clinic) => c.id === saved);
        setSelectedClinicId(valid ? saved : list[0]?.id ?? session.user.clinicId);
        setClinicsLoaded(true);
      })
      .catch(() => setClinicsLoaded(true));
  }, [isSuperAdmin, session?.user]);

  const selectClinic = useCallback((clinicId: string) => {
    setSelectedClinicId(clinicId);
    localStorage.setItem("selectedClinicId", clinicId);
  }, []);

  // Clinic resolution: use session clinic as fallback while loading
  const clinic = useMemo(() => {
    if (!session?.user) return null;

    if (isSuperAdmin && clinicsLoaded && clinics.length > 0) {
      return clinics.find((c) => c.id === selectedClinicId) ?? sessionClinic;
    }

    return sessionClinic;
  }, [isSuperAdmin, clinicsLoaded, clinics, selectedClinicId, sessionClinic, session?.user]);

  return {
    clinic,
    clinics,
    role: role ?? "user",
    isSuperAdmin,
    selectClinic,
    loading: status === "loading",
  };
}
