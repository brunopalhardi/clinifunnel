import { describe, it, expect } from "vitest";
import { groupLeadsByStatus, type LeadForGrouping } from "./group-by-status";

function lead(overrides: Partial<LeadForGrouping>): LeadForGrouping {
  return {
    id: "L1",
    kommoStatus: "82505867",
    statusName: "Agendado",
    statusColor: "#4caf50",
    ...overrides,
  };
}

describe("groupLeadsByStatus", () => {
  it("retorna array vazio quando nao ha leads", () => {
    expect(groupLeadsByStatus([])).toEqual([]);
  });

  it("agrupa leads pelo kommoStatus", () => {
    const leads: LeadForGrouping[] = [
      lead({ id: "L1", kommoStatus: "A", statusName: "Em qualif", statusColor: "#999" }),
      lead({ id: "L2", kommoStatus: "A", statusName: "Em qualif", statusColor: "#999" }),
      lead({ id: "L3", kommoStatus: "B", statusName: "Agendado", statusColor: "#0f0" }),
    ];
    const result = groupLeadsByStatus(leads);
    expect(result).toHaveLength(2);
    expect(result.find((g) => g.id === "A")?.count).toBe(2);
    expect(result.find((g) => g.id === "B")?.count).toBe(1);
  });

  it("ordena por count desc", () => {
    const leads: LeadForGrouping[] = [
      lead({ id: "L1", kommoStatus: "A", statusName: "A", statusColor: null }),
      lead({ id: "L2", kommoStatus: "B", statusName: "B", statusColor: null }),
      lead({ id: "L3", kommoStatus: "B", statusName: "B", statusColor: null }),
      lead({ id: "L4", kommoStatus: "B", statusName: "B", statusColor: null }),
    ];
    const result = groupLeadsByStatus(leads);
    expect(result[0].id).toBe("B");
    expect(result[0].count).toBe(3);
    expect(result[1].id).toBe("A");
    expect(result[1].count).toBe(1);
  });

  it("agrupa leads sem kommoStatus no bucket __none__", () => {
    const leads: LeadForGrouping[] = [
      lead({ id: "L1", kommoStatus: null, statusName: null, statusColor: null }),
      lead({ id: "L2", kommoStatus: null, statusName: null, statusColor: null }),
    ];
    const result = groupLeadsByStatus(leads);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("__none__");
    expect(result[0].name).toBe("Sem status");
    expect(result[0].count).toBe(2);
  });

  it("preserva statusColor do primeiro lead de cada grupo", () => {
    const leads: LeadForGrouping[] = [
      lead({ id: "L1", kommoStatus: "A", statusName: "Agendado", statusColor: "#aabb00" }),
      lead({ id: "L2", kommoStatus: "A", statusName: "Agendado", statusColor: null }),
    ];
    const result = groupLeadsByStatus(leads);
    expect(result[0].color).toBe("#aabb00");
  });

  it("soma de counts == total de leads", () => {
    const leads: LeadForGrouping[] = [
      lead({ id: "L1", kommoStatus: "A", statusName: "A", statusColor: null }),
      lead({ id: "L2", kommoStatus: "B", statusName: "B", statusColor: null }),
      lead({ id: "L3", kommoStatus: null, statusName: null, statusColor: null }),
    ];
    const result = groupLeadsByStatus(leads);
    const sum = result.reduce((s, g) => s + g.count, 0);
    expect(sum).toBe(leads.length);
  });
});
