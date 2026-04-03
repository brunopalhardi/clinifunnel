"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";

interface DateFilterProps {
  onFilter: (from: string, to: string) => void;
}

export function DateFilter({ onFilter }: DateFilterProps) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const presets = [
    { label: "7 dias", days: 7 },
    { label: "30 dias", days: 30 },
    { label: "90 dias", days: 90 },
  ];

  const applyPreset = (days: number) => {
    const toDate = new Date();
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - days);
    const fromStr = fromDate.toISOString().split("T")[0];
    const toStr = toDate.toISOString().split("T")[0];
    setFrom(fromStr);
    setTo(toStr);
    onFilter(fromStr, toStr);
  };

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="space-y-1">
        <Label htmlFor="from" className="text-xs">
          De
        </Label>
        <Input
          id="from"
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="w-36"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="to" className="text-xs">
          Ate
        </Label>
        <Input
          id="to"
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="w-36"
        />
      </div>
      <Button size="sm" onClick={() => onFilter(from, to)}>
        Filtrar
      </Button>
      <div className="flex gap-1">
        {presets.map((p) => (
          <Button
            key={p.days}
            variant="outline"
            size="sm"
            onClick={() => applyPreset(p.days)}
          >
            {p.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
