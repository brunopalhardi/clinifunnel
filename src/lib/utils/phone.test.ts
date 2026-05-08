import { describe, expect, it } from "vitest";
import { formatPhoneBR, normalizePhoneBR, phoneMatchKey, phoneToClinicorp } from "./phone";

describe("phoneToClinicorp: formata telefone pra envio ao Clinicorp", () => {
  it("remove DDI 55 quando presente", () => {
    expect(phoneToClinicorp("+5515997599933")).toBe("15997599933");
    expect(phoneToClinicorp("5515997599933")).toBe("15997599933");
    expect(phoneToClinicorp("+55 15 99759-9933")).toBe("15997599933");
    expect(phoneToClinicorp("+55 (15) 99759-9933")).toBe("15997599933");
  });

  it("preserva numero sem DDI", () => {
    expect(phoneToClinicorp("(15) 99759-9933")).toBe("15997599933");
    expect(phoneToClinicorp("15997599933")).toBe("15997599933");
    expect(phoneToClinicorp("(85) 99614-2824")).toBe("85996142824");
  });

  it("preserva DDD 55 (Rio Grande do Sul)", () => {
    // 11 digitos: DDD 55 + celular -> NAO faz strip
    expect(phoneToClinicorp("(55) 99761-1234")).toBe("55997611234");
    expect(phoneToClinicorp("55997611234")).toBe("55997611234");
  });

  it("aceita fixo de 10 digitos", () => {
    expect(phoneToClinicorp("(11) 3456-7890")).toBe("1134567890");
    expect(phoneToClinicorp("1134567890")).toBe("1134567890");
  });

  it("retorna null pra entradas invalidas", () => {
    expect(phoneToClinicorp(null)).toBe(null);
    expect(phoneToClinicorp(undefined)).toBe(null);
    expect(phoneToClinicorp("")).toBe(null);
    expect(phoneToClinicorp("123")).toBe(null);
    expect(phoneToClinicorp("+55")).toBe(null);
    expect(phoneToClinicorp("999999999999")).toBe(null); // 12 digitos sem 55
  });

  it("limpa caracteres nao-numericos antes de processar", () => {
    expect(phoneToClinicorp("+55  (15)  99759-9933 ")).toBe("15997599933");
  });
});

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
