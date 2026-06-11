import { describe, it, expect } from "vitest";
import {
  computePatientTicket,
  classifyPatients,
  normalizeCategory,
  ticketByDentist,
} from "./patient-ticket";

describe("computePatientTicket", () => {
  it("agrega por paciente, não por procedure", () => {
    const r = computePatientTicket([
      { patientId: "p1", value: 1000, discountAmount: 100 },
      { patientId: "p1", value: 500, discountAmount: 0 },
      { patientId: "p2", value: 600, discountAmount: 0 },
    ]);
    expect(r.patients).toBe(2);
    expect(r.revenue).toBe(2000);
    expect(r.ticketMedio).toBe(1000); // 2000/2, não 2000/3
  });
  it("retorna zeros sem dividir por zero", () => {
    expect(computePatientTicket([])).toEqual({ patients: 0, revenue: 0, ticketMedio: 0 });
  });
});

describe("normalizeCategory", () => {
  it("normaliza caixa, espaços e acentos", () => {
    expect(normalizeCategory("  Avaliação ")).toBe("avaliacao");
    expect(normalizeCategory("CONSULTA")).toBe("consulta");
    expect(normalizeCategory(null)).toBe("");
  });
});

describe("classifyPatients", () => {
  it("tag Avaliação classifica como novo", () => {
    const r = classifyPatients({
      patientIds: ["p1"],
      categoriesByPatient: new Map([["p1", ["Avaliação"]]]),
      patientsWithHistory: new Set(),
    });
    expect(r.get("p1")).toBe("novo");
  });
  it("tag Consulta/Retorno classifica como recorrente", () => {
    const r = classifyPatients({
      patientIds: ["p1", "p2"],
      categoriesByPatient: new Map([["p1", ["Consulta"]], ["p2", ["Retorno"]]]),
      patientsWithHistory: new Set(),
    });
    expect(r.get("p1")).toBe("recorrente");
    expect(r.get("p2")).toBe("recorrente");
  });
  it("sem tag, usa histórico: aprovado antes do período = recorrente, senão novo", () => {
    const r = classifyPatients({
      patientIds: ["p1", "p2"],
      categoriesByPatient: new Map(),
      patientsWithHistory: new Set(["p1"]),
    });
    expect(r.get("p1")).toBe("recorrente");
    expect(r.get("p2")).toBe("novo");
  });
  it("histórico ganha da tag (paciente com aprovação anterior é recorrente mesmo com Avaliação)", () => {
    const r = classifyPatients({
      patientIds: ["p1"],
      categoriesByPatient: new Map([["p1", ["Avaliação"]]]),
      patientsWithHistory: new Set(["p1"]),
    });
    expect(r.get("p1")).toBe("recorrente");
  });
});

describe("ticketByDentist", () => {
  it("agrupa receita e pacientes distintos por dentista", () => {
    const r = ticketByDentist([
      { patientId: "p1", value: 1000, discountAmount: 0, dentistName: "Dra. Ana" },
      { patientId: "p2", value: 500, discountAmount: 0, dentistName: "Dra. Ana" },
      { patientId: "p3", value: 300, discountAmount: 0, dentistName: null },
    ]);
    const ana = r.find((d) => d.dentistName === "Dra. Ana");
    expect(ana).toEqual({ dentistName: "Dra. Ana", patients: 2, revenue: 1500, ticketMedio: 750 });
    expect(r.find((d) => d.dentistName === "Sem dentista")?.revenue).toBe(300);
  });
});
