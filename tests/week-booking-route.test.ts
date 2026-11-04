import { beforeEach, describe, expect, it, vi } from "vitest";

const { auth, update } = vi.hoisted(() => ({ auth: vi.fn(), update: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getCurrentUser: auth }));
vi.mock("@/lib/service", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/service")>(),
  updateWeekBookingStatus: update,
}));

import { PATCH } from "@/app/api/weeks/[weekStart]/route";
import { AppError } from "@/lib/service";

function patch(body: unknown = { isOpen: true }) {
  return PATCH(new Request("http://localhost/api/weeks/2026-11-01", {
    method: "PATCH", headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }), { params: Promise.resolve({ weekStart: "2026-11-01" }) });
}

beforeEach(() => vi.resetAllMocks());

describe("PATCH /api/weeks/[weekStart]", () => {
  it("requires authentication", async () => {
    auth.mockResolvedValue(null);
    expect((await patch()).status).toBe(401);
    expect(update).not.toHaveBeenCalled();
  });

  it("rejects ministry users", async () => {
    auth.mockResolvedValue({ role: "ministry" });
    expect((await patch()).status).toBe(403);
    expect(update).not.toHaveBeenCalled();
  });

  it.each([{}, { isOpen: "false" }, { isOpen: 1 }, null])("rejects invalid input %j", async (body) => {
    auth.mockResolvedValue({ role: "admin" });
    expect((await patch(body)).status).toBe(422);
    expect(update).not.toHaveBeenCalled();
  });

  it.each([true, false])("saves the explicit state %s", async (isOpen) => {
    const admin = { role: "admin" };
    auth.mockResolvedValue(admin);
    update.mockResolvedValue({ weekStart: "2026-11-01", isOpen });
    const response = await patch({ isOpen });
    expect(response.status).toBe(200);
    expect(update).toHaveBeenCalledWith(admin, "2026-11-01", isOpen);
    await expect(response.json()).resolves.toEqual({ weekStart: "2026-11-01", isOpen });
  });

  it("returns date validation and persistence errors", async () => {
    auth.mockResolvedValue({ role: "admin" });
    update.mockRejectedValueOnce(new AppError("Semana inválida.", 422));
    expect((await patch()).status).toBe(422);
    update.mockRejectedValueOnce(new Error("Database unavailable"));
    const response = await patch();
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Não foi possível atualizar a semana. Tente novamente.",
    });
  });
});
