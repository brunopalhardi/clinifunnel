"use client";

import { useState } from "react";

interface DateFilterProps {
  onFilter: (from: string, to: string) => void;
}

export function DateFilter({ onFilter }: DateFilterProps) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [activePreset, setActivePreset] = useState<number | null>(30);

  const presets = [
    { label: "7d", days: 7 },
    { label: "30d", days: 30 },
    { label: "90d", days: 90 },
  ];

  const applyPreset = (days: number) => {
    const toDate = new Date();
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - days);
    const fromStr = fromDate.toISOString().split("T")[0];
    const toStr = toDate.toISOString().split("T")[0];
    setFrom(fromStr);
    setTo(toStr);
    setActivePreset(days);
    onFilter(fromStr, toStr);
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <input
        type="date"
        value={from}
        onChange={(e) => { setFrom(e.target.value); setActivePreset(null); }}
        className="rounded-lg bg-card px-3 py-2 text-sm glass-border outline-none focus:ring-1 focus:ring-gold/40"
      />
      <input
        type="date"
        value={to}
        onChange={(e) => { setTo(e.target.value); setActivePreset(null); }}
        className="rounded-lg bg-card px-3 py-2 text-sm glass-border outline-none focus:ring-1 focus:ring-gold/40"
      />
      <button
        onClick={() => { setActivePreset(null); onFilter(from, to); }}
        className="rounded-lg bg-gold px-4 py-2 text-sm font-medium text-gold-foreground transition-all hover:opacity-90"
      >
        Filtrar
      </button>
      <div className="flex rounded-lg bg-card glass-border p-0.5">
        {presets.map((p) => (
          <button
            key={p.days}
            onClick={() => applyPreset(p.days)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
              activePreset === p.days
                ? "bg-gold text-gold-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}
