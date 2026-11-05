import { describe, expect, it } from "vitest";

import { buildRehearsalReport } from "@/lib/rehearsal-report";

const ministries = [
  { id: "teatro", name: "Teatro" },
  { id: "bale", name: "Balé" },
  { id: "coralkids", name: "CoralKids" },
  { id: "blocked", name: "__BLOQUEIO_PALCO__" },
];
type Slot = Parameters<typeof buildRehearsalReport>[1][number];
const now = new Date("2026-11-05T23:00:00Z"); // 19:00 em Manaus.

function slot(date: string, ministryId = "teatro", hour = 18, status: Slot["bookingRequest"]["status"] = "approved", id = `${ministryId}-${date}-${hour}`): Slot {
  return { slotDate: new Date(`${date}T00:00:00Z`), hour, bookingRequest: { id, ministryId, status } };
}

describe("completed rehearsal report", () => {
  it("includes October 1 by rehearsal date and excludes September", () => {
    const report = buildRehearsalReport(ministries, [slot("2026-09-30"), slot("2026-10-01")], now);
    expect(report.total).toBe(1);
    expect(report.startDate).toBe("2026-10-01");
    expect(report.endDate).toBe("2026-11-05");
  });

  it("counts separate bookings on the same day separately", () => {
    const report = buildRehearsalReport(ministries, [
      slot("2026-10-02"), slot("2026-10-02", "teatro", 19),
      slot("2026-10-03"), slot("2026-10-02", "bale", 20),
    ], now);
    expect(report.ministries).toEqual([
      { ministryId: "teatro", ministryName: "Teatro", rehearsalCount: 3 },
      { ministryId: "bale", ministryName: "Balé", rehearsalCount: 1 },
      { ministryId: "coralkids", ministryName: "CoralKids", rehearsalCount: 0 },
    ]);
    expect(report.total).toBe(4);
  });

  it("counts a booking only once across multiple reserved hours and dates", () => {
    const report = buildRehearsalReport(ministries, [
      slot("2026-10-02", "teatro", 18, "approved", "same-booking"),
      slot("2026-10-02", "teatro", 19, "approved", "same-booking"),
      slot("2026-10-03", "teatro", 18, "approved", "same-booking"),
    ], now);
    expect(report.total).toBe(1);
    expect(report.ministries.find((ministry) => ministry.ministryId === "teatro")?.rehearsalCount).toBe(1);
  });

  it("does not count pending, cancelled, rejected, or administrative and collective blocks", () => {
    const report = buildRehearsalReport(ministries, [
      slot("2026-10-02", "teatro", 18, "pending"),
      slot("2026-10-03", "teatro", 18, "cancelled"),
      slot("2026-10-04", "teatro", 18, "rejected"),
      slot("2026-10-05", "blocked"),
    ], now);
    expect(report.total).toBe(0);
    expect(report.ministries).toHaveLength(3);
    expect(report.ministries.every((ministry) => ministry.rehearsalCount === 0)).toBe(true);
  });

  it.each([
    ["2026-11-05T22:59:59Z", 0],
    ["2026-11-05T23:00:00Z", 1],
  ])("counts today's rehearsal only when its hour has ended at %s", (time, expected) => {
    const report = buildRehearsalReport(ministries, [
      slot("2026-11-05"), slot("2026-11-05", "bale", 19),
      slot("2026-11-06", "coralkids"),
    ], new Date(time));
    expect(report.total).toBe(expected);
  });

  it("uses the local date in Manaus after UTC midnight", () => {
    const report = buildRehearsalReport(ministries, [slot("2026-11-05", "teatro", 20)], new Date("2026-11-06T02:00:00Z"));
    expect(report.endDate).toBe("2026-11-05");
    expect(report.total).toBe(1);
  });

  it("shows zero for every registered ministry when there are no completed rehearsals", () => {
    const report = buildRehearsalReport(ministries, [], now);
    expect(report.total).toBe(0);
    expect(report.ministries.map((ministry) => ministry.ministryName)).toEqual(["Balé", "CoralKids", "Teatro"]);
    expect(report.ministries.every((ministry) => ministry.rehearsalCount === 0)).toBe(true);
  });
});
