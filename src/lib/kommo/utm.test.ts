import { describe, it, expect } from "vitest";
import { extractAppointmentFields, extractVendedora } from "./utm";
import type { KommoCustomField } from "./types";

function field(
  name: string,
  value: string,
  opts: { code?: string | null; type?: string } = {},
): KommoCustomField {
  return {
    field_id: 1,
    field_name: name,
    field_code: opts.code ?? null,
    field_type: opts.type ?? "text",
    values: [{ value }],
  };
}

describe("extractAppointmentFields", () => {
  it("returns all nulls when fields is null/undefined/empty", () => {
    expect(extractAppointmentFields(null)).toEqual({
      appointmentDate: null,
      appointmentTime: null,
      appointmentProfId: null,
    });
    expect(extractAppointmentFields(undefined)).toEqual({
      appointmentDate: null,
      appointmentTime: null,
      appointmentProfId: null,
    });
    expect(extractAppointmentFields([])).toEqual({
      appointmentDate: null,
      appointmentTime: null,
      appointmentProfId: null,
    });
  });

  it("splits Kommo date_time field into date and time (Sao Paulo TZ)", () => {
    // 2026-05-15 14:30 in America/Sao_Paulo == 2026-05-15 17:30 UTC == 1779730200 unix seconds
    const ts = Math.floor(Date.UTC(2026, 4, 15, 17, 30, 0) / 1000);
    const result = extractAppointmentFields([
      field("DATA E HORA CONSULTA", String(ts), { type: "date_time" }),
    ]);
    expect(result.appointmentDate).toBe("2026-05-15");
    expect(result.appointmentTime).toBe("14:30");
  });

  it("detects combined datetime by name even without type=date_time", () => {
    // Name contains both 'data + consulta' and 'hora' -> treat as combined
    const ts = Math.floor(Date.UTC(2026, 0, 1, 12, 0, 0) / 1000);
    const result = extractAppointmentFields([
      field("Data e Hora da Consulta", String(ts)),
    ]);
    expect(result.appointmentDate).toBe("2026-01-01");
    expect(result.appointmentTime).toBe("09:00"); // 12h UTC = 09h Sao Paulo
  });

  it("falls back to raw value when combined field has invalid value", () => {
    const result = extractAppointmentFields([
      field("DATA E HORA CONSULTA", "not-a-timestamp", { type: "date_time" }),
    ]);
    expect(result.appointmentDate).toBe("not-a-timestamp");
    expect(result.appointmentTime).toBe(null);
  });

  it("preserves backwards compat: separate date field (no time keyword)", () => {
    const result = extractAppointmentFields([
      field("Data da Consulta", "2026-05-15"),
    ]);
    expect(result.appointmentDate).toBe("2026-05-15");
    expect(result.appointmentTime).toBe(null);
  });

  it("preserves backwards compat: separate time field", () => {
    const result = extractAppointmentFields([
      field("Hora da Consulta", "14:30"),
    ]);
    expect(result.appointmentTime).toBe("14:30");
  });

  it("preserves backwards compat: separate date + time fields", () => {
    const result = extractAppointmentFields([
      field("Data Agendamento", "2026-05-15"),
      field("Horario", "14:30"),
    ]);
    expect(result.appointmentDate).toBe("2026-05-15");
    expect(result.appointmentTime).toBe("14:30");
  });

  it("recognizes professional by name (profissional/dentista/atendido)", () => {
    expect(
      extractAppointmentFields([field("Profissional", "12345")]).appointmentProfId,
    ).toBe("12345");
    expect(
      extractAppointmentFields([field("Dentista responsavel", "67890")]).appointmentProfId,
    ).toBe("67890");
    // INT-2.1: ATENDIDO POR usado pela clinica AD precisa bater
    expect(
      extractAppointmentFields([field("ATENDIDO POR", "Dra Alexia Duarte")]).appointmentProfId,
    ).toBe("Dra Alexia Duarte");
    expect(
      extractAppointmentFields([field("Atendido por", "Dra Joao")]).appointmentProfId,
    ).toBe("Dra Joao");
  });

  it("recognizes professional by field_code", () => {
    const result = extractAppointmentFields([
      field("ATENDIDO POR", "999", { code: "PROFESSIONAL_ID" }),
    ]);
    expect(result.appointmentProfId).toBe("999");
  });

  it("ignores fields with empty value", () => {
    const result = extractAppointmentFields([
      { field_id: 1, field_name: "Data e Hora Consulta", field_code: null, field_type: "date_time", values: [] },
    ]);
    expect(result).toEqual({
      appointmentDate: null,
      appointmentTime: null,
      appointmentProfId: null,
    });
  });

  it("combined datetime field does not trigger separate-time fallback on same field", () => {
    // Regression: name 'data e hora consulta' contains both 'data+consulta' and 'hora'.
    // Should be parsed once (split), not double-set with raw value.
    const ts = Math.floor(Date.UTC(2026, 5, 10, 13, 0, 0) / 1000);
    const result = extractAppointmentFields([
      field("DATA E HORA CONSULTA", String(ts), { type: "date_time" }),
    ]);
    // appointmentTime should be HH:MM, NOT the raw timestamp string
    expect(result.appointmentTime).toMatch(/^\d{2}:\d{2}$/);
    expect(result.appointmentTime).not.toBe(String(ts));
  });
});

describe("extractVendedora", () => {
  it("returns null when fields is null/undefined/empty", () => {
    expect(extractVendedora(null)).toBeNull();
    expect(extractVendedora(undefined)).toBeNull();
    expect(extractVendedora([])).toBeNull();
  });

  it("returns null when no field matches 'vendedora'", () => {
    expect(
      extractVendedora([
        field("Canal de prospeccao", "Instagram"),
        field("UTM Source", "google"),
      ]),
    ).toBeNull();
  });

  it("extracts value from field named 'Vendedora'", () => {
    expect(
      extractVendedora([field("Vendedora", "Ingrid")]),
    ).toBe("Ingrid");
  });

  it("is case-insensitive on field name", () => {
    expect(extractVendedora([field("VENDEDORA", "SDR")])).toBe("SDR");
    expect(extractVendedora([field("vendedora", "Ingrid")])).toBe("Ingrid");
    expect(extractVendedora([field("Vendedora", "SDR")])).toBe("SDR");
  });

  it("returns null when field is present but has no values", () => {
    const f: KommoCustomField = {
      field_id: 1,
      field_name: "Vendedora",
      field_code: null,
      field_type: "select",
      values: [],
    };
    expect(extractVendedora([f])).toBeNull();
  });

  it("picks the vendedora field among many", () => {
    expect(
      extractVendedora([
        field("UTM Source", "google"),
        field("Canal de prospeccao", "Instagram"),
        field("Vendedora", "Ingrid"),
        field("Outro campo", "qualquer"),
      ]),
    ).toBe("Ingrid");
  });
});
