import { describe, expect, it } from "vitest";

import type { DashboardRequest } from "@/lib/types";
import { buildUsageReport } from "@/lib/usage-report";

function request(
  overrides: Partial<DashboardRequest> & Pick<DashboardRequest, "id" | "ministryId" | "ministryName">,
): DashboardRequest {
  return {
    requestedByName: "Admin",
    origin: "admin_created",
    status: "approved",
    reviewNote: null,
    createdAt: "2026-07-17T12:00:00.000Z",
    requestedSlotKeys: ["2026-07-19T18:00"],
    reservedSlotKeys: ["2026-07-19T18:00"],
    isBlocked: false,
    isCollectiveRehearsal: false,
    ...overrides,
  };
}

describe("usage report", () => {
  it("counts each ministry once and totals bookings and hours", () => {
    const report = buildUsageReport([
      request({ id: "1", ministryId: "teatro", ministryName: "Teatro" }),
      request({
        id: "2",
        ministryId: "teatro",
        ministryName: "Teatro",
        reservedSlotKeys: ["2026-07-20T18:00", "2026-07-20T19:00"],
      }),
      request({ id: "3", ministryId: "bale", ministryName: "Balé" }),
    ]);

    expect(report.ministryCount).toBe(2);
    expect(report.bookingCount).toBe(3);
    expect(report.hourCount).toBe(4);
    expect(report.ministries.find((item) => item.ministryId === "teatro")).toMatchObject({
      bookingCount: 2,
      hourCount: 3,
    });
  });

  it("ignores pending, cancelled, rejected, and administrative blocks", () => {
    const report = buildUsageReport([
      request({ id: "1", ministryId: "pending", ministryName: "Pendente", status: "pending" }),
      request({ id: "2", ministryId: "cancelled", ministryName: "Cancelado", status: "cancelled" }),
      request({ id: "3", ministryId: "rejected", ministryName: "Reprovado", status: "rejected" }),
      request({ id: "4", ministryId: "blocked", ministryName: "Ocupado", isBlocked: true }),
    ]);

    expect(report).toMatchObject({ ministryCount: 0, bookingCount: 0, hourCount: 0 });
  });
});
