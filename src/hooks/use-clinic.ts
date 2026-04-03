"use client";

import { useState, useEffect } from "react";

interface Clinic {
  id: string;
  name: string;
  kommoSubdomain: string;
}

export function useClinic() {
  const [clinic, setClinic] = useState<Clinic | null>(null);
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/clinics")
      .then((res) => res.json())
      .then((json) => {
        const data: Clinic[] = json.data ?? [];
        setClinics(data);
        if (data.length > 0) {
          setClinic(data[0]);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return { clinic, clinics, setClinic, loading };
}
