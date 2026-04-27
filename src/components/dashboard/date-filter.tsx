"use client";

import { useEffect, useRef, useState } from "react";

interface DateFilterProps {
  onFilter: (from: string, to: string) => void;
  defaultPreset?: "today" | "yesterday" | "7d" | "30d" | "90d" | "thisMonth" | "lastMonth";
}

interface Preset {
  id: string;
  label: string;
  range: () => { from: Date; to: Date };
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}
function fmtDateLocal(d: Date): string {
  // YYYY-MM-DD em horário local (não UTC)
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function fmtBR(s: string): string {
  if (!s) return "";
  const [y, m, d] = s.split("-");
  return `${d}/${m}/${y}`;
}
function toIsoStart(s: string): string {
  if (!s) return "";
  const [y, m, d] = s.split("-").map(Number);
  return startOfDay(new Date(y, m - 1, d)).toISOString();
}
function toIsoEnd(s: string): string {
  if (!s) return "";
  const [y, m, d] = s.split("-").map(Number);
  return endOfDay(new Date(y, m - 1, d)).toISOString();
}

const PRESETS: Preset[] = [
  {
    id: "today",
    label: "Hoje",
    range: () => {
      const now = new Date();
      return { from: startOfDay(now), to: endOfDay(now) };
    },
  },
  {
    id: "yesterday",
    label: "Ontem",
    range: () => {
      const y = new Date();
      y.setDate(y.getDate() - 1);
      return { from: startOfDay(y), to: endOfDay(y) };
    },
  },
  {
    id: "7d",
    label: "7 dias",
    range: () => {
      const to = new Date();
      const from = new Date();
      from.setDate(from.getDate() - 6);
      return { from: startOfDay(from), to: endOfDay(to) };
    },
  },
  {
    id: "30d",
    label: "30 dias",
    range: () => {
      const to = new Date();
      const from = new Date();
      from.setDate(from.getDate() - 29);
      return { from: startOfDay(from), to: endOfDay(to) };
    },
  },
  {
    id: "90d",
    label: "90 dias",
    range: () => {
      const to = new Date();
      const from = new Date();
      from.setDate(from.getDate() - 89);
      return { from: startOfDay(from), to: endOfDay(to) };
    },
  },
  {
    id: "thisMonth",
    label: "Este mes",
    range: () => {
      const now = new Date();
      const from = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: startOfDay(from), to: endOfDay(now) };
    },
  },
  {
    id: "lastMonth",
    label: "Mes passado",
    range: () => {
      const now = new Date();
      const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const to = new Date(now.getFullYear(), now.getMonth(), 0);
      return { from: startOfDay(from), to: endOfDay(to) };
    },
  },
];

export function DateFilter({ onFilter, defaultPreset = "30d" }: DateFilterProps) {
  const initial = PRESETS.find((p) => p.id === defaultPreset) ?? PRESETS[3];
  const initialRange = initial.range();

  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(initial.id);
  const [from, setFrom] = useState(fmtDateLocal(initialRange.from));
  const [to, setTo] = useState(fmtDateLocal(initialRange.to));
  const ref = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);

  // Aplica filtro inicial uma vez
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    onFilter(toIsoStart(from), toIsoEnd(to));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fecha popover ao clicar fora
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  function applyPreset(p: Preset) {
    const r = p.range();
    const fromStr = fmtDateLocal(r.from);
    const toStr = fmtDateLocal(r.to);
    setFrom(fromStr);
    setTo(toStr);
    setActiveId(p.id);
    onFilter(toIsoStart(fromStr), toIsoEnd(toStr));
    setOpen(false);
  }

  function applyCustom() {
    if (!from || !to) return;
    setActiveId(null);
    onFilter(toIsoStart(from), toIsoEnd(to));
    setOpen(false);
  }

  const label = activeId
    ? PRESETS.find((p) => p.id === activeId)?.label ?? "Custom"
    : from && to
      ? `${fmtBR(from)} → ${fmtBR(to)}`
      : "Selecionar periodo";

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-lg bg-card px-4 py-2 text-sm font-medium glass-border transition-all hover:bg-card/80"
      >
        <svg className="h-4 w-4 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
        <span>{label}</span>
        <svg className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-xl bg-card p-4 shadow-2xl glass-border">
          {/* Presets */}
          <div className="grid grid-cols-2 gap-1.5 mb-4">
            {PRESETS.map((p) => (
              <button
                key={p.id}
                onClick={() => applyPreset(p)}
                className={`rounded-md px-3 py-2 text-xs font-medium transition-all ${
                  activeId === p.id
                    ? "bg-gold text-gold-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Custom range */}
          <div className="space-y-3 border-t border-border/30 pt-4">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground/70">Periodo customizado</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] text-muted-foreground">De</label>
                <input
                  type="date"
                  value={from}
                  onChange={(e) => { setFrom(e.target.value); setActiveId(null); }}
                  className="mt-1 w-full rounded-md bg-background px-2 py-1.5 text-xs glass-border outline-none focus:ring-1 focus:ring-gold/40"
                />
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground">Ate</label>
                <input
                  type="date"
                  value={to}
                  onChange={(e) => { setTo(e.target.value); setActiveId(null); }}
                  className="mt-1 w-full rounded-md bg-background px-2 py-1.5 text-xs glass-border outline-none focus:ring-1 focus:ring-gold/40"
                />
              </div>
            </div>
            <button
              onClick={applyCustom}
              disabled={!from || !to}
              className="w-full rounded-md bg-gold px-3 py-2 text-xs font-semibold text-gold-foreground transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Aplicar periodo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
