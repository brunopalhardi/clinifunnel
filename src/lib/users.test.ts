import { describe, expect, it } from "vitest";
import { generateTemporaryPassword, hashPassword, verifyPassword } from "./users";

describe("generateTemporaryPassword", () => {
  it("retorna 12 caracteres", () => {
    expect(generateTemporaryPassword()).toHaveLength(12);
  });

  it("usa apenas charset sem ambiguos (sem 0 O 1 l I)", () => {
    for (let i = 0; i < 50; i++) {
      const pw = generateTemporaryPassword();
      expect(pw).not.toMatch(/[0O1lI]/);
    }
  });

  it("gera valores diferentes a cada chamada (cripto-random)", () => {
    const set = new Set<string>();
    for (let i = 0; i < 100; i++) set.add(generateTemporaryPassword());
    // 100 senhas de 12 chars de um alfabeto de 55 = colisao quase impossivel
    expect(set.size).toBe(100);
  });
});

describe("hashPassword + verifyPassword", () => {
  it("round-trip: verifyPassword(plain, hash(plain)) === true", async () => {
    const hash = await hashPassword("teste-secreto");
    expect(await verifyPassword("teste-secreto", hash)).toBe(true);
  });

  it("verifyPassword retorna false pra senha errada", async () => {
    const hash = await hashPassword("certa");
    expect(await verifyPassword("errada", hash)).toBe(false);
  });

  it("hashes do mesmo plaintext sao diferentes (salt aleatorio)", async () => {
    const a = await hashPassword("mesma");
    const b = await hashPassword("mesma");
    expect(a).not.toBe(b);
    // Mas ambos verificam contra "mesma"
    expect(await verifyPassword("mesma", a)).toBe(true);
    expect(await verifyPassword("mesma", b)).toBe(true);
  });
});
