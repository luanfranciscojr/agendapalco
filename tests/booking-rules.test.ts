import { describe, expect, it } from "vitest";

import {
  canCreateWeeklyRequest,
  getReviewStatus,
  hasDuplicateSlots,
  validateSlotsInCurrentWeek,
  validateWeekStartFor,
} from "@/lib/rules";
import { getCurrentWeekContext } from "@/lib/time";

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

  it("accepts only the current week in requests and availability", () => {
    const week = getCurrentWeekContext(new Date("2026-07-13T12:00:00Z"));

    expect(validateWeekStartFor(week.weekStart, new Date("2026-07-13T12:00:00Z"))).toBe(true);
    expect(validateWeekStartFor("2026-07-05", new Date("2026-07-13T12:00:00Z"))).toBe(false);
    expect(
      validateSlotsInCurrentWeek([
        `${week.days[0]}T19:00`,
        `${week.days[3]}T20:00`,
      ], new Date("2026-07-13T12:00:00Z")),
    ).toBe(true);
    expect(
      validateSlotsInCurrentWeek(["2026-07-25T19:00"], new Date("2026-07-13T12:00:00Z")),
    ).toBe(false);
  });
});
