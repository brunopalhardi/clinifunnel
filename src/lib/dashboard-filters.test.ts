import { describe, it, expect } from "vitest";
import { buildLeadDateFilter } from "./dashboard-filters";

describe("buildLeadDateFilter", () => {
  it("retorna objeto vazio sem from/to", () => {
    expect(buildLeadDateFilter({})).toEqual({});
    expect(buildLeadDateFilter({ from: null, to: null })).toEqual({});
    expect(buildLeadDateFilter({ from: undefined, to: undefined })).toEqual({});
  });

  it("aplica filtro so com from", () => {
    const f = buildLeadDateFilter({ from: "2026-05-03T00:00:00Z" });
    expect(f).toEqual({
      OR: [
        { kommoCreatedAt: { gte: new Date("2026-05-03T00:00:00Z") } },
        { kommoCreatedAt: null, createdAt: { gte: new Date("2026-05-03T00:00:00Z") } },
      ],
    });
  });

  it("aplica filtro so com to", () => {
    const f = buildLeadDateFilter({ to: "2026-05-10T23:59:59Z" });
    expect(f).toEqual({
      OR: [
        { kommoCreatedAt: { lte: new Date("2026-05-10T23:59:59Z") } },
        { kommoCreatedAt: null, createdAt: { lte: new Date("2026-05-10T23:59:59Z") } },
      ],
    });
  });

  it("aplica filtro com from + to", () => {
    const f = buildLeadDateFilter({ from: "2026-05-03", to: "2026-05-10" });
    expect(f).toEqual({
      OR: [
        {
          kommoCreatedAt: {
            gte: new Date("2026-05-03"),
            lte: new Date("2026-05-10"),
          },
        },
        {
          kommoCreatedAt: null,
          createdAt: {
            gte: new Date("2026-05-03"),
            lte: new Date("2026-05-10"),
          },
        },
      ],
    });
  });

  it("OR garante que lead sem kommoCreatedAt cai no fallback (legacy)", () => {
    // Estrutura logica: SE kommoCreatedAt exists, filtra por ele;
    // SENAO usa createdAt. OR satisfaz isso porque mutuamente exclusivo:
    // o segundo branch exige kommoCreatedAt: null.
    const f = buildLeadDateFilter({ from: "2026-05-03" });
    expect(Array.isArray(f.OR)).toBe(true);
    expect(f.OR).toHaveLength(2);
    // Primeira branch: kommoCreatedAt no range (qualquer createdAt)
    expect(f.OR?.[0]).toHaveProperty("kommoCreatedAt");
    expect(f.OR?.[0]).not.toHaveProperty("createdAt");
    // Segunda branch: kommoCreatedAt null E createdAt no range
    expect(f.OR?.[1]).toEqual({
      kommoCreatedAt: null,
      createdAt: { gte: new Date("2026-05-03") },
    });
  });
});
