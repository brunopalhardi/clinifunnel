import { describe, it, expect } from "vitest";
import { computeReminders } from "./calc";
import type { ComputeRemindersInput, ProcedureForReminder, ReminderActionRecord } from "./types";

const NOW = new Date("2026-05-16T12:00:00Z");

function makeProc(overrides: Partial<ProcedureForReminder> & { id: string; completedAt: Date }): ProcedureForReminder {
  return {
    id: overrides.id,
    name: overrides.name ?? "Botox 50U",
    completedAt: overrides.completedAt,
    patient: overrides.patient ?? { id: "pat1", name: "Maria", phone: "11999999999" },
  };
}

function daysAgo(n: number): Date {
  return new Date(NOW.getTime() - n * 86400000);
}

function baseInput(over: Partial<ComputeRemindersInput> = {}): ComputeRemindersInput {
  return {
    procedures: [],
    recallIntervals: [],
    inactiveMonths: 6,
    postConsultaDays: 3,
    actions: [],
    now: NOW,
    ...over,
  };
}

describe("computeReminders", () => {
  it("retorna lista vazia quando nao ha procedures", () => {
    expect(computeReminders(baseInput())).toEqual([]);
  });

  it("procedure sem match em recallIntervals nao gera alerta de recall", () => {
    const procs = [makeProc({ id: "p1", name: "Limpeza", completedAt: daysAgo(200) })];
    const res = computeReminders(baseInput({ procedures: procs, recallIntervals: [{ procedureNamePattern: "botox", days: 120 }] }));
    expect(res.find((r) => r.type === "recall")).toBeUndefined();
  });

  it("recall: procedure de 200 dias atras com botox 120d gera alerta atrasado 80 dias", () => {
    const procs = [makeProc({ id: "p1", name: "Aplicacao Botox 50U", completedAt: daysAgo(200) })];
    const res = computeReminders(baseInput({ procedures: procs, recallIntervals: [{ procedureNamePattern: "botox", days: 120 }] }));
    const recall = res.find((r) => r.type === "recall");
    expect(recall).toBeDefined();
    expect(recall!.daysUntilDue).toBe(-80);
    expect(recall!.urgency).toBe("overdue");
    expect(recall!.key).toBe("recall:pat1:p1");
  });

  it("recall: multiplos patterns batendo usa o de maior days", () => {
    // Proc ha 170 dias. Pattern com max days = 180 -> dueDate = +10d, daysUntilDue = 10 (visivel).
    // Pattern com days = 120 daria daysUntilDue = -50 (overdue). Diferenca prova que o max venceu.
    const procs = [makeProc({ id: "p1", name: "Botox / Toxina combinado", completedAt: daysAgo(170) })];
    const res = computeReminders(baseInput({
      procedures: procs,
      recallIntervals: [
        { procedureNamePattern: "botox", days: 120 },
        { procedureNamePattern: "toxina", days: 180 },
      ],
    }));
    const recall = res.find((r) => r.type === "recall");
    expect(recall).toBeDefined();
    expect(recall!.daysUntilDue).toBe(10);
  });

  it("recall: alerta com daysUntilDue > 30 e filtrado fora", () => {
    // proc completado ha 80 dias com botox 120d -> dueDate em +40d -> > 30 -> filtrado
    const procs = [makeProc({ id: "p1", name: "Botox", completedAt: daysAgo(80) })];
    const res = computeReminders(baseInput({ procedures: procs, recallIntervals: [{ procedureNamePattern: "botox", days: 120 }] }));
    expect(res.find((r) => r.type === "recall")).toBeUndefined();
  });

  it("inativo: paciente com ultimo procedure ha 7 meses entra em inativo (threshold 6m)", () => {
    const procs = [makeProc({ id: "p1", name: "Limpeza", completedAt: daysAgo(210) })]; // ~7m
    const res = computeReminders(baseInput({ procedures: procs, inactiveMonths: 6 }));
    const inactive = res.find((r) => r.type === "inactive");
    expect(inactive).toBeDefined();
    expect(inactive!.key).toBe("inactive:pat1");
    expect(inactive!.procedureId).toBeNull();
  });

  it("inativo: 1 paciente com 3 procedures conta so o mais recente", () => {
    const procs = [
      makeProc({ id: "p1", name: "Botox", completedAt: daysAgo(400) }),
      makeProc({ id: "p2", name: "Limpeza", completedAt: daysAgo(100) }),
      makeProc({ id: "p3", name: "Toxina", completedAt: daysAgo(50) }),
    ];
    const res = computeReminders(baseInput({ procedures: procs, inactiveMonths: 6 }));
    // mais recente = 50 dias atras, ainda nao inativo (threshold 6m ~ 180d)
    expect(res.filter((r) => r.type === "inactive")).toHaveLength(0);
  });

  it("inativo: nao tem janela superior (vem com daysUntilDue muito negativo, mas aparece)", () => {
    const procs = [makeProc({ id: "p1", name: "Limpeza", completedAt: daysAgo(1000) })];
    const res = computeReminders(baseInput({ procedures: procs, inactiveMonths: 6 }));
    const inactive = res.find((r) => r.type === "inactive");
    expect(inactive).toBeDefined();
  });

  it("pos-consulta: dueDate = completedAt + postConsultaDays", () => {
    const procs = [makeProc({ id: "p1", name: "Limpeza", completedAt: daysAgo(1) })];
    const res = computeReminders(baseInput({ procedures: procs, postConsultaDays: 3 }));
    const post = res.find((r) => r.type === "postconsulta");
    expect(post).toBeDefined();
    expect(post!.daysUntilDue).toBe(2); // 3 - 1
    expect(post!.key).toBe("postconsulta:pat1:p1");
  });

  it("pos-consulta: procedure de 60 dias atras (daysUntilDue < -30) e filtrado fora", () => {
    const procs = [makeProc({ id: "p1", name: "Limpeza", completedAt: daysAgo(60) })];
    const res = computeReminders(baseInput({ procedures: procs, postConsultaDays: 3 }));
    expect(res.find((r) => r.type === "postconsulta")).toBeUndefined();
  });

  it("action TRATADO filtra o alerta fora", () => {
    const procs = [makeProc({ id: "p1", name: "Botox", completedAt: daysAgo(200) })];
    const actions: ReminderActionRecord[] = [
      { reminderKey: "recall:pat1:p1", action: "TRATADO", snoozeUntil: null, createdAt: daysAgo(1) },
    ];
    const res = computeReminders(baseInput({
      procedures: procs,
      recallIntervals: [{ procedureNamePattern: "botox", days: 120 }],
      actions,
    }));
    expect(res.find((r) => r.type === "recall")).toBeUndefined();
  });

  it("action ADIADO com snoozeUntil futuro filtra alerta", () => {
    const procs = [makeProc({ id: "p1", name: "Botox", completedAt: daysAgo(200) })];
    const future = new Date(NOW.getTime() + 7 * 86400000);
    const actions: ReminderActionRecord[] = [
      { reminderKey: "recall:pat1:p1", action: "ADIADO", snoozeUntil: future, createdAt: daysAgo(1) },
    ];
    const res = computeReminders(baseInput({
      procedures: procs,
      recallIntervals: [{ procedureNamePattern: "botox", days: 120 }],
      actions,
    }));
    expect(res.find((r) => r.type === "recall")).toBeUndefined();
  });

  it("action ADIADO com snoozeUntil passado faz alerta reaparecer", () => {
    const procs = [makeProc({ id: "p1", name: "Botox", completedAt: daysAgo(200) })];
    const past = new Date(NOW.getTime() - 1 * 86400000);
    const actions: ReminderActionRecord[] = [
      { reminderKey: "recall:pat1:p1", action: "ADIADO", snoozeUntil: past, createdAt: daysAgo(10) },
    ];
    const res = computeReminders(baseInput({
      procedures: procs,
      recallIntervals: [{ procedureNamePattern: "botox", days: 120 }],
      actions,
    }));
    expect(res.find((r) => r.type === "recall")).toBeDefined();
  });

  it("ultima action vence (ADIADO antigo + TRATADO recente -> filtrado)", () => {
    const procs = [makeProc({ id: "p1", name: "Botox", completedAt: daysAgo(200) })];
    const actions: ReminderActionRecord[] = [
      { reminderKey: "recall:pat1:p1", action: "ADIADO", snoozeUntil: new Date(NOW.getTime() - 86400000), createdAt: daysAgo(10) },
      { reminderKey: "recall:pat1:p1", action: "TRATADO", snoozeUntil: null, createdAt: daysAgo(1) },
    ];
    const res = computeReminders(baseInput({
      procedures: procs,
      recallIntervals: [{ procedureNamePattern: "botox", days: 120 }],
      actions,
    }));
    expect(res.find((r) => r.type === "recall")).toBeUndefined();
  });

  it("urgency: < 0 = overdue, 0..7 = urgent, 8..30 = upcoming", () => {
    const procs = [
      makeProc({ id: "p1", name: "Botox", completedAt: daysAgo(125), patient: { id: "a", name: "A", phone: null } }), // -5 -> overdue
      makeProc({ id: "p2", name: "Botox", completedAt: daysAgo(115), patient: { id: "b", name: "B", phone: null } }), // +5 -> urgent
      makeProc({ id: "p3", name: "Botox", completedAt: daysAgo(105), patient: { id: "c", name: "C", phone: null } }), // +15 -> upcoming
    ];
    const res = computeReminders(baseInput({
      procedures: procs,
      recallIntervals: [{ procedureNamePattern: "botox", days: 120 }],
    }));
    const byKey = (k: string) => res.find((r) => r.key === k)!;
    expect(byKey("recall:a:p1").urgency).toBe("overdue");
    expect(byKey("recall:b:p2").urgency).toBe("urgent");
    expect(byKey("recall:c:p3").urgency).toBe("upcoming");
  });

  it("descricao do recall inclui nome do procedure e dias", () => {
    const procs = [makeProc({ id: "p1", name: "Botox 50U", completedAt: daysAgo(125) })];
    const res = computeReminders(baseInput({ procedures: procs, recallIntervals: [{ procedureNamePattern: "botox", days: 120 }] }));
    const recall = res.find((r) => r.type === "recall")!;
    expect(recall.description.toLowerCase()).toContain("botox 50u");
    expect(recall.description).toMatch(/5 dias/);
  });
});
