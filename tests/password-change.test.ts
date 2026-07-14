import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthUser } from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/password";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

import { AppError, updateOwnPassword } from "@/lib/service";

describe("password change", () => {
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
    prismaMock.user.findUnique.mockReset();
    prismaMock.user.update.mockReset();
  });

  it("updates the password when the current password is valid", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: currentUser.id,
      passwordHash: hashPassword("senha-antiga"),
    });
    prismaMock.user.update.mockResolvedValue({});

    const result = await updateOwnPassword(currentUser, {
      currentPassword: "senha-antiga",
      newPassword: "senha-nova",
    });

    expect(result).toEqual({ success: true });
    expect(prismaMock.user.update).toHaveBeenCalledTimes(1);
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: currentUser.id },
      data: {
        passwordHash: expect.any(String),
      },
    });

    const updateArgs = prismaMock.user.update.mock.calls[0]?.[0];
    expect(
      verifyPassword("senha-nova", updateArgs.data.passwordHash),
    ).toBe(true);
  });

  it("rejects the change when the current password is incorrect", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: currentUser.id,
      passwordHash: hashPassword("senha-antiga"),
    });

    await expect(
      updateOwnPassword(currentUser, {
        currentPassword: "senha-errada",
        newPassword: "senha-nova",
      }),
    ).rejects.toMatchObject<AppError>({
      message: "Senha atual incorreta.",
      status: 409,
    });

    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it("rejects the change when the new password matches the current password", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: currentUser.id,
      passwordHash: hashPassword("senha-antiga"),
    });

    await expect(
      updateOwnPassword(currentUser, {
        currentPassword: "senha-antiga",
        newPassword: "senha-antiga",
      }),
    ).rejects.toMatchObject<AppError>({
      message: "A nova senha deve ser diferente da senha atual.",
      status: 409,
    });

    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });
});
