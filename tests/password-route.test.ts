import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthUser } from "@/lib/auth";

const { authMock, serviceMock } = vi.hoisted(() => ({
  authMock: {
    getCurrentUser: vi.fn(),
  },
  serviceMock: {
    updateOwnPassword: vi.fn(),
  },
}));

vi.mock("@/lib/auth", () => ({
  getCurrentUser: authMock.getCurrentUser,
}));

vi.mock("@/lib/service", async () => {
  const actual = await vi.importActual<typeof import("@/lib/service")>("@/lib/service");

  return {
    ...actual,
    updateOwnPassword: serviceMock.updateOwnPassword,
  };
});

import { AppError } from "@/lib/service";
import { PATCH } from "@/app/api/profile/password/route";

describe("PATCH /api/profile/password", () => {
  const currentUser: AuthUser = {
    id: "user-1",
    name: "Líder Louvor",
    username: "louvor",
    whatsappPhone: null,
    role: "ministry",
    ministryId: "min-1",
    ministryName: "Louvor",
  };

  beforeEach(() => {
    authMock.getCurrentUser.mockReset();
    serviceMock.updateOwnPassword.mockReset();
  });

  it("returns 401 when there is no authenticated user", async () => {
    authMock.getCurrentUser.mockResolvedValue(null);

    const response = await PATCH(
      new Request("http://localhost/api/profile/password", {
        method: "PATCH",
        body: JSON.stringify({
          currentPassword: "atual",
          newPassword: "nova1",
          confirmPassword: "nova1",
        }),
        headers: {
          "content-type": "application/json",
        },
      }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "Não autenticado.",
    });
  });

  it("returns 422 when the password confirmation does not match", async () => {
    authMock.getCurrentUser.mockResolvedValue(currentUser);

    const response = await PATCH(
      new Request("http://localhost/api/profile/password", {
        method: "PATCH",
        body: JSON.stringify({
          currentPassword: "atual",
          newPassword: "nova1",
          confirmPassword: "nova2",
        }),
        headers: {
          "content-type": "application/json",
        },
      }),
    );

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({
      error: "A confirmação da senha não confere.",
    });
    expect(serviceMock.updateOwnPassword).not.toHaveBeenCalled();
  });

  it("returns 409 when the current password is wrong", async () => {
    authMock.getCurrentUser.mockResolvedValue(currentUser);
    serviceMock.updateOwnPassword.mockRejectedValue(
      new AppError("Senha atual incorreta.", 409),
    );

    const response = await PATCH(
      new Request("http://localhost/api/profile/password", {
        method: "PATCH",
        body: JSON.stringify({
          currentPassword: "errada",
          newPassword: "nova1",
          confirmPassword: "nova1",
        }),
        headers: {
          "content-type": "application/json",
        },
      }),
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "Senha atual incorreta.",
    });
  });

  it("returns success when the password is updated", async () => {
    authMock.getCurrentUser.mockResolvedValue(currentUser);
    serviceMock.updateOwnPassword.mockResolvedValue({ success: true });

    const response = await PATCH(
      new Request("http://localhost/api/profile/password", {
        method: "PATCH",
        body: JSON.stringify({
          currentPassword: "atual",
          newPassword: "nova1",
          confirmPassword: "nova1",
        }),
        headers: {
          "content-type": "application/json",
        },
      }),
    );

    expect(serviceMock.updateOwnPassword).toHaveBeenCalledWith(currentUser, {
      currentPassword: "atual",
      newPassword: "nova1",
      confirmPassword: "nova1",
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
    });
  });
});
