import { describe, expect, it } from "vitest";

import {
  canCreateWeeklyRequest,
  getReviewStatus,
  hasDuplicateSlots,
  validateSlotsInSelectableWeek,
  validateWeekStartFor,
} from "@/lib/rules";
import {
  getCurrentWeekContext,
  getSelectableWeekContext,
  getTodayInTimeZone,
  isSlotInPast,
} from "@/lib/time";

describe("booking rules", () => {
  it("blocks a second weekly request once the limit is reached", () => {
    expect(canCreateWeeklyRequest(0, 1)).toBe(true);
    expect(canCreateWeeklyRequest(1, 1)).toBe(false);
  });

  it("derives review status for approved and rejected reviews", () => {
    expect(getReviewStatus(1)).toBe("approved");
    expect(getReviewStatus(0)).toBe("rejected");
  });

  it("detects duplicated slot keys", () => {
    expect(hasDuplicateSlots(["2026-07-13T19:00", "2026-07-13T19:00"])).toBe(true);
    expect(hasDuplicateSlots(["2026-07-13T19:00", "2026-07-13T20:00"])).toBe(false);
  });

  it("accepts the current week and the next eight weeks", () => {
    const week = getCurrentWeekContext(new Date("2026-07-13T12:00:00Z"));

    expect(validateWeekStartFor(week.weekStart, new Date("2026-07-13T12:00:00Z"))).toBe(true);
    expect(validateWeekStartFor("2026-07-05", new Date("2026-07-13T12:00:00Z"))).toBe(false);
    expect(validateWeekStartFor("2026-09-06", new Date("2026-07-13T12:00:00Z"))).toBe(true);
    expect(validateWeekStartFor("2026-09-13", new Date("2026-07-13T12:00:00Z"))).toBe(false);
    expect(
      validateSlotsInSelectableWeek([
        `${week.days[1]}T19:00`,
        `${week.days[3]}T20:00`,
      ], new Date("2026-07-13T12:00:00Z")),
    ).toBe(true);
    expect(
      validateSlotsInSelectableWeek(
        ["2026-07-20T19:00", "2026-07-27T19:00"],
        new Date("2026-07-13T12:00:00Z"),
      ),
    ).toBe(false);
  });

  it("builds bounded navigation for selectable weeks", () => {
    const now = new Date("2026-07-13T12:00:00Z");
    const current = getSelectableWeekContext(undefined, 8, now);
    const last = getSelectableWeekContext("2026-09-06", 8, now);

    expect(current?.previousWeekStart).toBeNull();
    expect(current?.nextWeekStart).toBe("2026-07-19");
    expect(last?.previousWeekStart).toBe("2026-08-30");
    expect(last?.nextWeekStart).toBeNull();
  });

  it("blocks slots that have already started in Manaus", () => {
    const now = new Date("2026-07-13T23:30:00Z");

    expect(isSlotInPast("2026-07-13", 19, now)).toBe(true);
    expect(isSlotInPast("2026-07-13", 20, now)).toBe(false);
    expect(isSlotInPast("2026-07-14", 18, now)).toBe(false);
  });

  it("uses America/Manaus to resolve the current day", () => {
    expect(getTodayInTimeZone(new Date("2026-07-13T02:30:00Z"))).toBe("2026-07-12");
    expect(getTodayInTimeZone(new Date("2026-07-13T05:30:00Z"))).toBe("2026-07-13");
  });

  it("turns the week over at midnight on Sunday in Manaus", () => {
    const saturdayNight = getCurrentWeekContext(new Date("2026-07-19T03:59:00Z"));
    const sundayMidnight = getCurrentWeekContext(new Date("2026-07-19T04:00:00Z"));

    expect(saturdayNight.today).toBe("2026-07-18");
    expect(saturdayNight.weekStart).toBe("2026-07-12");
    expect(sundayMidnight.today).toBe("2026-07-19");
    expect(sundayMidnight.weekStart).toBe("2026-07-19");
  });
});
