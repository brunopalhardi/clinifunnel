import { describe, expect, it } from "vitest";
import { formatPhoneBR, normalizePhoneBR, phoneMatchKey } from "./phone";

describe("phoneMatchKey: chave para matching de telefones BR", () => {
  // Cenario fundamental: dois sistemas armazenam o mesmo numero de jeitos
  // diferentes (com e sem nono digito). A chave de match deve ser igual.

  it("celular com nono digito (Kommo) -> ddd + ultimos 8", () => {
    expect(phoneMatchKey("+5585989296869")).toBe("8589296869");
  });

  it("fixo (Clinicorp) -> ddd + 8 digitos", () => {
    expect(phoneMatchKey("+558598446284")).toBe("8598446284");
  });

  it("sem +55 e sem formatacao", () => {
    expect(phoneMatchKey("85989296869")).toBe("8589296869");
  });

  it("com formatacao (parenteses, hifens, espacos)", () => {
    expect(phoneMatchKey("(85) 98929-6869")).toBe("8589296869");
  });

  it("celular com nono digito sem +55", () => {
    expect(phoneMatchKey("85989296869")).toBe("8589296869");
  });

  it("dois numeros que devem matchear (mesma chave)", () => {
    // Mesmo titular, sistemas diferentes: um com nono digito, outro sem
    // (se o fixo terminar nos mesmos 8 digitos do celular sem o nono)
    const comNono = phoneMatchKey("+5585989296869");
    const semNono = phoneMatchKey("8589296869");
    expect(comNono).toBe(semNono);
  });

  it("retorna null pra entrada nula", () => {
    expect(phoneMatchKey(null)).toBeNull();
  });

  it("retorna null pra string muito curta (< 10 digitos)", () => {
    expect(phoneMatchKey("123456789")).toBeNull();
    expect(phoneMatchKey("")).toBeNull();
  });

  it("ignora caracteres nao-numericos completamente", () => {
    expect(phoneMatchKey("+55 (85) 9 8929-6869")).toBe("8589296869");
  });
});

describe("normalizePhoneBR", () => {
  it("adiciona +55 se ausente", () => {
    expect(normalizePhoneBR("85989296869")).toBe("+5585989296869");
  });

  it("preserva +55 se presente", () => {
    expect(normalizePhoneBR("+5585989296869")).toBe("+5585989296869");
  });

  it("limpa formatacao", () => {
    expect(normalizePhoneBR("(85) 98929-6869")).toBe("+5585989296869");
  });
});

describe("formatPhoneBR", () => {
  it("celular 11 digitos -> (DDD) 9XXXX-XXXX", () => {
    expect(formatPhoneBR("85989296869")).toBe("(85) 98929-6869");
  });

  it("fixo 10 digitos -> (DDD) XXXX-XXXX", () => {
    expect(formatPhoneBR("8533224455")).toBe("(85) 3322-4455");
  });

  it("ignora prefixo 55 do pais", () => {
    expect(formatPhoneBR("+5585989296869")).toBe("(85) 98929-6869");
  });

  it("retorna entrada se formato invalido", () => {
    expect(formatPhoneBR("123")).toBe("123");
  });
});
