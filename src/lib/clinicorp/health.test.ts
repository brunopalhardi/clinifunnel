import { describe, it, expect } from "vitest";
import {
  checkKommoCustomFields,
  computeHealthChecks,
  type HealthClinicInput,
  type HealthCounts,
} from "./health";

const NOW = new Date("2026-05-10T00:00:00Z");

function freshClinic(overrides: Partial<HealthClinicInput> = {}): HealthClinicInput {
  return {
    kommoSubdomain: "clinicaad",
    kommoToken: "kt-token",
    pipelineId: "10755863",
    stageAgendamento: "82505867",
    clinicorpUser: "clinicaad",
    clinicorpToken: "ct-token",
    clinicorpBusinessId: "4698768238313472",
    clinicorpAutoCreatePatient: true,
    clinicorpWebhookEnabled: true,
    professionalMap: { "Dra. Alexia": 12345 },
    lastClinicorpSyncAt: new Date(NOW.getTime() - 5 * 60_000),
    lastMatchLeadsAt: new Date(NOW.getTime() - 5 * 60_000),
    ...overrides,
  };
}

function freshCounts(overrides: Partial<HealthCounts> = {}): HealthCounts {
  return {
    kommoWebhooks24h: 5,
    clinicorpWebhooks24h: 3,
    errorWebhooks24h: 0,
    leadsCreated24h: 4,
    proceduresCreated24h: 2,
    ...overrides,
  };
}

function checkById(checks: ReturnType<typeof computeHealthChecks>, id: string) {
  const c = checks.find((x) => x.id === id);
  if (!c) throw new Error(`check ${id} nao encontrado`);
  return c;
}

describe("computeHealthChecks - happy path", () => {
  it("retorna tudo OK quando clinica esta totalmente configurada", () => {
    const checks = computeHealthChecks(freshClinic(), freshCounts(), NOW);
    const errors = checks.filter((c) => c.status === "error");
    expect(errors).toEqual([]);
    expect(checkById(checks, "kommo-config").status).toBe("ok");
    expect(checkById(checks, "clinicorp-config").status).toBe("ok");
    expect(checkById(checks, "professional-map").status).toBe("ok");
    expect(checkById(checks, "sync-clinicorp").status).toBe("ok");
  });
});

describe("computeHealthChecks - Kommo", () => {
  it("error quando subdomain ou token faltam", () => {
    expect(
      checkById(
        computeHealthChecks(freshClinic({ kommoSubdomain: null }), freshCounts(), NOW),
        "kommo-config",
      ).status,
    ).toBe("error");
    expect(
      checkById(
        computeHealthChecks(freshClinic({ kommoToken: null }), freshCounts(), NOW),
        "kommo-config",
      ).status,
    ).toBe("error");
  });

  it("error quando pipelineId falta", () => {
    expect(
      checkById(
        computeHealthChecks(freshClinic({ pipelineId: null }), freshCounts(), NOW),
        "kommo-pipeline",
      ).status,
    ).toBe("error");
  });

  it("warning quando pipelineId existe mas stageAgendamento falta", () => {
    expect(
      checkById(
        computeHealthChecks(
          freshClinic({ stageAgendamento: null }),
          freshCounts(),
          NOW,
        ),
        "kommo-pipeline",
      ).status,
    ).toBe("warning");
  });
});

describe("computeHealthChecks - Clinicorp", () => {
  it("error quando faltam credenciais", () => {
    expect(
      checkById(
        computeHealthChecks(
          freshClinic({ clinicorpToken: null }),
          freshCounts(),
          NOW,
        ),
        "clinicorp-config",
      ).status,
    ).toBe("error");
  });
});

describe("computeHealthChecks - flags", () => {
  it("warning quando webhook desligado", () => {
    expect(
      checkById(
        computeHealthChecks(
          freshClinic({ clinicorpWebhookEnabled: false }),
          freshCounts(),
          NOW,
        ),
        "webhook-enabled",
      ).status,
    ).toBe("warning");
  });

  it("warning quando auto-create patient desligado", () => {
    expect(
      checkById(
        computeHealthChecks(
          freshClinic({ clinicorpAutoCreatePatient: false }),
          freshCounts(),
          NOW,
        ),
        "auto-create-patient",
      ).status,
    ).toBe("warning");
  });
});

describe("computeHealthChecks - mapa profissionais", () => {
  it("error quando mapa vazio", () => {
    expect(
      checkById(
        computeHealthChecks(
          freshClinic({ professionalMap: null }),
          freshCounts(),
          NOW,
        ),
        "professional-map",
      ).status,
    ).toBe("error");
    expect(
      checkById(
        computeHealthChecks(
          freshClinic({ professionalMap: {} }),
          freshCounts(),
          NOW,
        ),
        "professional-map",
      ).status,
    ).toBe("error");
  });

  it("ok com pluralizacao quando mapa tem entries", () => {
    const oneEntry = computeHealthChecks(
      freshClinic({ professionalMap: { Alexia: 1 } }),
      freshCounts(),
      NOW,
    );
    expect(checkById(oneEntry, "professional-map").label).toContain("1 entrada");

    const manyEntries = computeHealthChecks(
      freshClinic({ professionalMap: { A: 1, B: 2, C: 3 } }),
      freshCounts(),
      NOW,
    );
    expect(checkById(manyEntries, "professional-map").label).toContain("3 entradas");
  });
});

describe("computeHealthChecks - sync periodicos", () => {
  it("warning quando lastClinicorpSyncAt e null", () => {
    expect(
      checkById(
        computeHealthChecks(
          freshClinic({ lastClinicorpSyncAt: null }),
          freshCounts(),
          NOW,
        ),
        "sync-clinicorp",
      ).status,
    ).toBe("warning");
  });

  it("error quando sync esta stale (> 30min)", () => {
    expect(
      checkById(
        computeHealthChecks(
          freshClinic({ lastClinicorpSyncAt: new Date(NOW.getTime() - 60 * 60_000) }),
          freshCounts(),
          NOW,
        ),
        "sync-clinicorp",
      ).status,
    ).toBe("error");
  });

  it("ok quando sync rodou recentemente", () => {
    const c = checkById(
      computeHealthChecks(
        freshClinic({ lastClinicorpSyncAt: new Date(NOW.getTime() - 10 * 60_000) }),
        freshCounts(),
        NOW,
      ),
      "sync-clinicorp",
    );
    expect(c.status).toBe("ok");
    expect(c.message).toContain("10min");
  });
});

describe("computeHealthChecks - atividade", () => {
  it("warning quando 0 webhooks Kommo nas 24h", () => {
    expect(
      checkById(
        computeHealthChecks(freshClinic(), freshCounts({ kommoWebhooks24h: 0 }), NOW),
        "kommo-activity",
      ).status,
    ).toBe("warning");
  });

  it("error quando ha erros recentes", () => {
    expect(
      checkById(
        computeHealthChecks(freshClinic(), freshCounts({ errorWebhooks24h: 3 }), NOW),
        "webhook-errors",
      ).status,
    ).toBe("error");
  });

  it("info checks always present", () => {
    const checks = computeHealthChecks(freshClinic(), freshCounts(), NOW);
    expect(checkById(checks, "info-leads").status).toBe("info");
    expect(checkById(checks, "info-procedures").status).toBe("info");
  });
});

describe("checkKommoCustomFields", () => {
  it("error quando lista vazia", () => {
    const r = checkKommoCustomFields([]);
    expect(r.appointmentDate.status).toBe("error");
    expect(r.professional.status).toBe("error");
  });

  it("ok quando ha campo combinado date_time com nome 'DATA E HORA CONSULTA'", () => {
    const r = checkKommoCustomFields([
      { id: 1, name: "DATA E HORA CONSULTA", type: "date_time", code: null },
      { id: 2, name: "ATENDIDO POR", type: "select", code: null },
    ]);
    expect(r.appointmentDate.status).toBe("ok");
    expect(r.appointmentDate.message).toContain("combinado");
    expect(r.professional.status).toBe("ok");
  });

  it("ok quando ha campos separados de data + hora", () => {
    const r = checkKommoCustomFields([
      { id: 1, name: "Data da consulta", type: "date", code: null },
      { id: 2, name: "Horario", type: "text", code: null },
      { id: 3, name: "Profissional", type: "select", code: null },
    ]);
    expect(r.appointmentDate.status).toBe("ok");
    expect(r.appointmentDate.message).toContain("separados");
    expect(r.professional.status).toBe("ok");
  });

  it("error quando nao ha campo de data nem combinado", () => {
    const r = checkKommoCustomFields([
      { id: 1, name: "Telefone", type: "text", code: null },
      { id: 2, name: "Email", type: "email", code: null },
    ]);
    expect(r.appointmentDate.status).toBe("error");
    expect(r.professional.status).toBe("error");
  });

  it("detecta professional via code='professional_id'", () => {
    const r = checkKommoCustomFields([
      { id: 1, name: "Data agendamento", type: "date_time", code: null },
      { id: 2, name: "Algum nome qualquer", type: "select", code: "professional_id" },
    ]);
    expect(r.professional.status).toBe("ok");
  });

  it("detecta professional via 'dentista'", () => {
    const r = checkKommoCustomFields([
      { id: 1, name: "Data agendamento consulta", type: "date_time", code: null },
      { id: 2, name: "Dentista responsavel", type: "select", code: null },
    ]);
    expect(r.professional.status).toBe("ok");
  });
});
