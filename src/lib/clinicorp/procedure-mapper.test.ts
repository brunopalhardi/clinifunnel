import { describe, it, expect } from "vitest";
import { mapEstimateToProcedures } from "./procedure-mapper";
import type { ClinicorpEstimate, ClinicorpEstimateProcedure } from "./types";

function makeEstimate(overrides: Partial<ClinicorpEstimate>): ClinicorpEstimate {
  return {
    id: 1,
    Date: "2026-05-06T20:00:00Z",
    Amount: 0,
    DiscountAmount: 0,
    Status: "APPROVED",
    BusinessId: 1,
    CreateDate: "2026-05-06T19:00:00Z",
    ProfessionalId: 1,
    TreatmentId: 1,
    ProfessionalName: "Dra. X",
    PatientId: 1,
    PatientName: "Test",
    ProcedureList: [],
    ...overrides,
  };
}

function makeProc(overrides: Partial<ClinicorpEstimateProcedure>): ClinicorpEstimateProcedure {
  return {
    id: 1,
    TreatmentId: 1,
    OperationDescription: "Test Proc",
    Amount: 1000,
    FinalAmount: 1000,
    StatusDescription: "Aprovado",
    DentistName: "Dra. X",
    Patient_PersonId: 1,
    ...overrides,
  };
}

describe("mapEstimateToProcedures - basics", () => {
  it("estimate vazia retorna array vazio", () => {
    expect(mapEstimateToProcedures(makeEstimate({ ProcedureList: [] }))).toEqual([]);
  });

  it("estimate sem desconto: discountAmount = 0 em todos os procs", () => {
    const result = mapEstimateToProcedures(makeEstimate({
      DiscountAmount: 0,
      ProcedureList: [
        makeProc({ id: 1, FinalAmount: 1000 }),
        makeProc({ id: 2, FinalAmount: 2000 }),
      ],
    }));
    expect(result).toHaveLength(2);
    expect(result[0].discountAmount).toBe(0);
    expect(result[1].discountAmount).toBe(0);
  });
});

describe("mapEstimateToProcedures - filtro Deleted", () => {
  it("procs com Deleted='X' nao saem no output", () => {
    const result = mapEstimateToProcedures(makeEstimate({
      ProcedureList: [
        makeProc({ id: 1 }),
        makeProc({ id: 2, Deleted: "X" }),
        makeProc({ id: 3 }),
      ],
    }));
    expect(result).toHaveLength(2);
    expect(result.map((p) => p.clinicorpProcedureId)).toEqual(["1", "3"]);
  });

  it("Deleted='X' nao entra no rateio de desconto", () => {
    // 2 procs aprovados R$ 1000 cada, 1 deletado R$ 1000, desconto total 200
    // Rateio: 100 + 100 (so entre os 2 nao-deletados)
    const result = mapEstimateToProcedures(makeEstimate({
      DiscountAmount: 200,
      ProcedureList: [
        makeProc({ id: 1, FinalAmount: 1000 }),
        makeProc({ id: 2, FinalAmount: 1000, Deleted: "X" }),
        makeProc({ id: 3, FinalAmount: 1000 }),
      ],
    }));
    expect(result).toHaveLength(2);
    expect(result[0].discountAmount).toBe(100);
    expect(result[1].discountAmount).toBe(100);
  });
});

describe("mapEstimateToProcedures - rateio de desconto", () => {
  it("rateia desconto proporcional ao FinalAmount entre Aprovados", () => {
    // 3 procs aprovados: R$ 1000, R$ 2000, R$ 2000. Total 5000. Desconto 500 (10%).
    // Rateio: 100, 200, 200
    const result = mapEstimateToProcedures(makeEstimate({
      DiscountAmount: 500,
      ProcedureList: [
        makeProc({ id: 1, FinalAmount: 1000 }),
        makeProc({ id: 2, FinalAmount: 2000 }),
        makeProc({ id: 3, FinalAmount: 2000 }),
      ],
    }));
    expect(result[0].discountAmount).toBe(100);
    expect(result[1].discountAmount).toBe(200);
    expect(result[2].discountAmount).toBe(200);
    // Soma == DiscountAmount original
    const sum = result.reduce((a, p) => a + p.discountAmount, 0);
    expect(sum).toBe(500);
  });

  it("nao ratea desconto pra procs nao-Aprovados (StatusDescription='Orçamento')", () => {
    // 1 Aprovado R$ 1000, 1 Orçamento R$ 1000. Desconto 100 va TODO pro Aprovado.
    const result = mapEstimateToProcedures(makeEstimate({
      DiscountAmount: 100,
      ProcedureList: [
        makeProc({ id: 1, FinalAmount: 1000, StatusDescription: "Aprovado" }),
        makeProc({ id: 2, FinalAmount: 1000, StatusDescription: "Orçamento" }),
      ],
    }));
    expect(result[0].discountAmount).toBe(100);
    expect(result[1].discountAmount).toBe(0);
    expect(result[1].status).toBe("pending"); // Orçamento = pending no schema legado
  });

  it("ultimo proc absorve residuo de centavos pra somar exato", () => {
    // 3 procs Aprovado R$ 100 cada. Desconto 10. Proporcao = 3.33...
    // Primeiros 2: 3.33, ultimo: 10 - 3.33 - 3.33 = 3.34
    const result = mapEstimateToProcedures(makeEstimate({
      DiscountAmount: 10,
      ProcedureList: [
        makeProc({ id: 1, FinalAmount: 100 }),
        makeProc({ id: 2, FinalAmount: 100 }),
        makeProc({ id: 3, FinalAmount: 100 }),
      ],
    }));
    expect(result[0].discountAmount).toBe(3.33);
    expect(result[1].discountAmount).toBe(3.33);
    expect(result[2].discountAmount).toBe(3.34);
    const sum = result.reduce((a, p) => a + p.discountAmount, 0);
    expect(Math.round(sum * 100) / 100).toBe(10);
  });

  it("se nao ha procs Aprovados, desconto nao eh aplicado a ninguem", () => {
    const result = mapEstimateToProcedures(makeEstimate({
      DiscountAmount: 100,
      ProcedureList: [
        makeProc({ id: 1, FinalAmount: 1000, StatusDescription: "Orçamento" }),
        makeProc({ id: 2, FinalAmount: 1000, StatusDescription: "Orçamento" }),
      ],
    }));
    expect(result[0].discountAmount).toBe(0);
    expect(result[1].discountAmount).toBe(0);
  });
});

describe("mapEstimateToProcedures - status mapping", () => {
  it("Executed='X' -> completed (independente do StatusDescription)", () => {
    const result = mapEstimateToProcedures(makeEstimate({
      ProcedureList: [
        makeProc({ id: 1, Executed: "X", StatusDescription: "Aprovado" }),
      ],
    }));
    expect(result[0].status).toBe("completed");
  });

  it("StatusDescription='Aprovado' -> approved", () => {
    const result = mapEstimateToProcedures(makeEstimate({
      ProcedureList: [makeProc({ StatusDescription: "Aprovado" })],
    }));
    expect(result[0].status).toBe("approved");
  });

  it("StatusDescription='Orçamento' -> pending", () => {
    const result = mapEstimateToProcedures(makeEstimate({
      ProcedureList: [makeProc({ StatusDescription: "Orçamento" })],
    }));
    expect(result[0].status).toBe("pending");
  });

  it("StatusDescription='Cancelado' -> cancelled", () => {
    const result = mapEstimateToProcedures(makeEstimate({
      ProcedureList: [makeProc({ StatusDescription: "Cancelado" })],
    }));
    expect(result[0].status).toBe("cancelled");
  });
});

describe("mapEstimateToProcedures - flags adicionais", () => {
  it("paymentAccounted=true quando proc.PaymentAccounted='X'", () => {
    const result = mapEstimateToProcedures(makeEstimate({
      ProcedureList: [
        makeProc({ id: 1, PaymentAccounted: "X" }),
        makeProc({ id: 2, PaymentAccounted: "" }),
      ],
    }));
    expect(result[0].paymentAccounted).toBe(true);
    expect(result[1].paymentAccounted).toBe(false);
  });

  it("deleted sempre false no output (deletados sao filtrados antes)", () => {
    const result = mapEstimateToProcedures(makeEstimate({
      ProcedureList: [
        makeProc({ id: 1 }),
        makeProc({ id: 2, Deleted: "X" }),
      ],
    }));
    expect(result).toHaveLength(1);
    expect(result[0].deleted).toBe(false);
  });
});

describe("mapEstimateToProcedures - dentistName", () => {
  it("propaga DentistName do procedure da estimate", () => {
    const result = mapEstimateToProcedures(makeEstimate({
      ProcedureList: [makeProc({ DentistName: "Dra. Ana" })],
    }));
    expect(result[0].dentistName).toBe("Dra. Ana");
  });
});

describe("mapEstimateToProcedures - cenario real Caroline (3 mai)", () => {
  it("1 proc Aprovado FinalAmount=2900, desconto=240 -> liquido=2660", () => {
    // Reproducao exata do caso real do Bruno: estimate Caroline 04/05
    // Amount=2660 (no painel) = FinalAmount 2900 - DiscountAmount 240
    const result = mapEstimateToProcedures(makeEstimate({
      DiscountAmount: 240,
      ProcedureList: [
        makeProc({
          id: 6321740163579905,
          FinalAmount: 2900,
          OperationDescription: "UFIII - BICHECTOMIA + PAPADA",
          StatusDescription: "Aprovado",
          PaymentAccounted: "X",
        }),
      ],
    }));
    expect(result[0].value).toBe(2900);
    expect(result[0].discountAmount).toBe(240);
    // Liquido = value - discount
    expect(result[0].value - result[0].discountAmount).toBe(2660);
    expect(result[0].status).toBe("approved");
    expect(result[0].statusDescription).toBe("Aprovado");
    expect(result[0].paymentAccounted).toBe(true);
  });
});
