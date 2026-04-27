"use client";

import { useEffect, useMemo, useRef, useState } from "react";

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
function fmtBR(d: Date | null): string {
  if (!d) return "";
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${d.getFullYear()}`;
}
function sameDay(a: Date | null, b: Date | null): boolean {
  if (!a || !b) return false;
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function isBetween(d: Date, from: Date | null, to: Date | null): boolean {
  if (!from || !to) return false;
  const t = d.getTime();
  return t > from.getTime() && t < to.getTime();
}

const MONTHS = ["Janeiro", "Fevereiro", "Marco", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const WEEKDAYS = ["D", "S", "T", "Q", "Q", "S", "S"];

const PRESETS: Preset[] = [
  { id: "today", label: "Hoje", range: () => { const n = new Date(); return { from: startOfDay(n), to: endOfDay(n) }; } },
  { id: "yesterday", label: "Ontem", range: () => { const y = new Date(); y.setDate(y.getDate() - 1); return { from: startOfDay(y), to: endOfDay(y) }; } },
  { id: "7d", label: "7 dias", range: () => { const t = new Date(); const f = new Date(); f.setDate(f.getDate() - 6); return { from: startOfDay(f), to: endOfDay(t) }; } },
  { id: "30d", label: "30 dias", range: () => { const t = new Date(); const f = new Date(); f.setDate(f.getDate() - 29); return { from: startOfDay(f), to: endOfDay(t) }; } },
  { id: "90d", label: "90 dias", range: () => { const t = new Date(); const f = new Date(); f.setDate(f.getDate() - 89); return { from: startOfDay(f), to: endOfDay(t) }; } },
  { id: "thisMonth", label: "Este mes", range: () => { const n = new Date(); const f = new Date(n.getFullYear(), n.getMonth(), 1); return { from: startOfDay(f), to: endOfDay(n) }; } },
  { id: "lastMonth", label: "Mes passado", range: () => { const n = new Date(); const f = new Date(n.getFullYear(), n.getMonth() - 1, 1); const t = new Date(n.getFullYear(), n.getMonth(), 0); return { from: startOfDay(f), to: endOfDay(t) }; } },
];

interface MiniCalendarProps {
  from: Date | null;
  to: Date | null;
  hover: Date | null;
  onSelect: (d: Date) => void;
  onHover: (d: Date | null) => void;
}

function MiniCalendar({ from, to, hover, onSelect, onHover }: MiniCalendarProps) {
  const [viewMonth, setViewMonth] = useState(() => {
    const base = from ?? new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });

  const days = useMemo(() => {
    const firstDay = viewMonth.getDay(); // 0 = Sunday
    const daysInMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0).getDate();
    const cells: Array<{ date: Date | null }> = [];
    for (let i = 0; i < firstDay; i++) cells.push({ date: null });
    for (let i = 1; i <= daysInMonth; i++) {
      cells.push({ date: new Date(viewMonth.getFullYear(), viewMonth.getMonth(), i) });
    }
    return cells;
  }, [viewMonth]);

  const today = new Date();
  // Hover preview: se já tem 'from' mas não 'to', usa hover como to
  const previewTo = !to && from && hover && hover.getTime() > from.getTime() ? hover : to;

  return (
    <div className="select-none">
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1))}
          className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
        </button>
        <p className="text-sm font-semibold">
          {MONTHS[viewMonth.getMonth()]} {viewMonth.getFullYear()}
        </p>
        <button
          onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1))}
          className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
        </button>
      </div>

      <div className="grid grid-cols-7 gap-0.5 mb-1">
        {WEEKDAYS.map((w, i) => (
          <div key={i} className="h-7 flex items-center justify-center text-[10px] font-semibold text-muted-foreground/60 uppercase">{w}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-0.5">
        {days.map((cell, i) => {
          if (!cell.date) return <div key={i} className="h-8" />;
          const d = cell.date;
          const isFrom = sameDay(d, from);
          const isTo = sameDay(d, to);
          const inRange = isBetween(d, from, previewTo);
          const isToday = sameDay(d, today);
          const isEdge = isFrom || isTo;

          return (
            <button
              key={i}
              onClick={() => onSelect(d)}
              onMouseEnter={() => onHover(d)}
              onMouseLeave={() => onHover(null)}
              className={`
                h-8 text-xs font-medium rounded-md transition-all relative
                ${isEdge ? "bg-gold text-gold-foreground font-bold" : ""}
                ${inRange && !isEdge ? "bg-gold/20 text-foreground" : ""}
                ${!isEdge && !inRange ? "text-foreground hover:bg-white/10" : ""}
                ${isToday && !isEdge ? "ring-1 ring-gold/40" : ""}
              `}
            >
              {d.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function DateFilter({ onFilter, defaultPreset = "30d" }: DateFilterProps) {
  const initial = PRESETS.find((p) => p.id === defaultPreset) ?? PRESETS[3];
  const initialRange = initial.range();

  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(initial.id);
  const [from, setFrom] = useState<Date | null>(initialRange.from);
  const [to, setTo] = useState<Date | null>(initialRange.to);
  const [hover, setHover] = useState<Date | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);

  // Aplica filtro inicial uma vez
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    if (from && to) onFilter(from.toISOString(), to.toISOString());
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
    setFrom(r.from);
    setTo(r.to);
    setActiveId(p.id);
    onFilter(r.from.toISOString(), r.to.toISOString());
    setOpen(false);
  }

  function handleDayClick(d: Date) {
    setActiveId(null);
    if (!from || (from && to)) {
      // Reset: começa nova seleção
      setFrom(startOfDay(d));
      setTo(null);
    } else {
      // Já tem from mas não to
      if (d.getTime() < from.getTime()) {
        // Click anterior → vira novo from
        setFrom(startOfDay(d));
        setTo(null);
      } else {
        // Click depois → vira to e aplica
        const newTo = endOfDay(d);
        setTo(newTo);
        onFilter(from.toISOString(), newTo.toISOString());
        setOpen(false);
      }
    }
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
        <div className="absolute right-0 top-full z-50 mt-2 w-[420px] rounded-xl bg-card p-4 shadow-2xl glass-border">
          <div className="flex gap-4">
            {/* Presets */}
            <div className="w-32 shrink-0 space-y-1 border-r border-border/30 pr-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 px-2 mb-2">Atalhos</p>
              {PRESETS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => applyPreset(p)}
                  className={`w-full text-left rounded-md px-2 py-1.5 text-xs font-medium transition-all ${
                    activeId === p.id
                      ? "bg-gold text-gold-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Calendário */}
            <div className="flex-1">
              <MiniCalendar
                from={from}
                to={to}
                hover={hover}
                onSelect={handleDayClick}
                onHover={setHover}
              />
              {from && !to && (
                <p className="text-[11px] text-muted-foreground text-center mt-3">
                  Selecione a data final
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
