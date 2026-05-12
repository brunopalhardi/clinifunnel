import { describe, it, expect } from "vitest";
import { mapAppointmentStatus } from "./appointment-mapper";

describe("mapAppointmentStatus - StatusId conhecidos (clinica AD)", () => {
  it("5818903091085312 -> atendido", () => {
    expect(mapAppointmentStatus(5818903091085312, "#66bb6a")).toBe("atendido");
    expect(mapAppointmentStatus("5818903091085312", null)).toBe("atendido");
  });

  it("6447760961830912 -> confirmado", () => {
    expect(mapAppointmentStatus(6447760961830912, "#009688")).toBe("confirmado");
  });

  it("5434991667970048 -> faltou", () => {
    expect(mapAppointmentStatus(5434991667970048, "#424242")).toBe("faltou");
  });
});

describe("mapAppointmentStatus - fallback por cor", () => {
  it("StatusId desconhecido + #66bb6a -> atendido", () => {
    expect(mapAppointmentStatus(99999, "#66bb6a")).toBe("atendido");
  });

  it("StatusId desconhecido + #009688 -> confirmado", () => {
    expect(mapAppointmentStatus("9999", "#009688")).toBe("confirmado");
  });

  it("amarelo -> em_espera", () => {
    expect(mapAppointmentStatus(null, "#ffeb3b")).toBe("em_espera");
    expect(mapAppointmentStatus(null, "#fbc02d")).toBe("em_espera");
  });

  it("azul -> em_atendimento", () => {
    expect(mapAppointmentStatus(null, "#2196f3")).toBe("em_atendimento");
    expect(mapAppointmentStatus(null, "#1976d2")).toBe("em_atendimento");
  });

  it("vermelho -> atrasado", () => {
    expect(mapAppointmentStatus(null, "#f44336")).toBe("atrasado");
    expect(mapAppointmentStatus(null, "#d32f2f")).toBe("atrasado");
  });

  it("cor case-insensitive", () => {
    expect(mapAppointmentStatus(null, "#66BB6A")).toBe("atendido");
    expect(mapAppointmentStatus(null, "  #66bb6a  ")).toBe("atendido");
  });
});

describe("mapAppointmentStatus - default agendado", () => {
  it("statusId e statusColor null -> agendado", () => {
    expect(mapAppointmentStatus(null, null)).toBe("agendado");
    expect(mapAppointmentStatus(undefined, undefined)).toBe("agendado");
    expect(mapAppointmentStatus("", "")).toBe("agendado");
  });

  it("cor desconhecida -> agendado (fallback default)", () => {
    expect(mapAppointmentStatus(null, "#abcdef")).toBe("agendado");
  });
});
