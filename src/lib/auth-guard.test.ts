import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mockamos getServerSession ANTES de importar auth-guard.
// Type-only import e usado depois pra inferir tipos.
vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

import { getServerSession } from "next-auth";
import { AuthError, getAuthorizedClinicId } from "./auth-guard";

const mockedGetSession = vi.mocked(getServerSession);

function makeRequest(url = "https://app.test/api/foo"): NextRequest {
  return new NextRequest(url);
}

beforeEach(() => {
  mockedGetSession.mockReset();
});

describe("getAuthorizedClinicId — sem session", () => {
  it("lanca AuthError 401 se nao autenticado", async () => {
    mockedGetSession.mockResolvedValue(null);
    await expect(getAuthorizedClinicId(makeRequest())).rejects.toThrow(AuthError);
    await expect(getAuthorizedClinicId(makeRequest())).rejects.toMatchObject({
      status: 401,
    });
  });
});

describe("getAuthorizedClinicId — clinic_admin / user", () => {
  it("retorna a clinica do user quando nao especifica clinicId", async () => {
    mockedGetSession.mockResolvedValue({
      user: { id: "u1", clinicId: "clinic-A", role: "clinic_admin" },
    } as never);
    const r = await getAuthorizedClinicId(makeRequest());
    expect(r).toEqual({ clinicId: "clinic-A", userId: "u1", role: "clinic_admin" });
  });

  it("aceita clinicId na query DESDE QUE seja a propria clinica", async () => {
    mockedGetSession.mockResolvedValue({
      user: { id: "u1", clinicId: "clinic-A", role: "clinic_admin" },
    } as never);
    const r = await getAuthorizedClinicId(
      makeRequest("https://app.test/api/foo?clinicId=clinic-A"),
    );
    expect(r.clinicId).toBe("clinic-A");
  });

  it("403 quando tenta acessar clinica diferente da propria", async () => {
    mockedGetSession.mockResolvedValue({
      user: { id: "u1", clinicId: "clinic-A", role: "clinic_admin" },
    } as never);
    await expect(
      getAuthorizedClinicId(
        makeRequest("https://app.test/api/foo?clinicId=clinic-B"),
      ),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("user (nao clinic_admin) tambem so pode propria clinica", async () => {
    mockedGetSession.mockResolvedValue({
      user: { id: "u2", clinicId: "clinic-A", role: "user" },
    } as never);
    await expect(
      getAuthorizedClinicId(
        makeRequest("https://app.test/api/foo?clinicId=clinic-Z"),
      ),
    ).rejects.toMatchObject({ status: 403 });
  });
});

describe("getAuthorizedClinicId — super_admin", () => {
  it("acessa qualquer clinica via ?clinicId=", async () => {
    mockedGetSession.mockResolvedValue({
      user: { id: "u3", clinicId: "clinic-Home", role: "super_admin" },
    } as never);
    const r = await getAuthorizedClinicId(
      makeRequest("https://app.test/api/foo?clinicId=clinic-OTHER"),
    );
    expect(r.clinicId).toBe("clinic-OTHER");
  });

  it("fallback para clinicId da session se nao especificar query", async () => {
    mockedGetSession.mockResolvedValue({
      user: { id: "u3", clinicId: "clinic-Home", role: "super_admin" },
    } as never);
    const r = await getAuthorizedClinicId(makeRequest());
    expect(r.clinicId).toBe("clinic-Home");
  });

  it("400 se nao tem clinicId nem na query nem na session", async () => {
    mockedGetSession.mockResolvedValue({
      user: { id: "u3", clinicId: "", role: "super_admin" },
    } as never);
    await expect(getAuthorizedClinicId(makeRequest())).rejects.toMatchObject({
      status: 400,
    });
  });
});
