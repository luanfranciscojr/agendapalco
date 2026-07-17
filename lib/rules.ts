import { BookingStatus } from "@prisma/client";

import {
  DEFAULT_MAX_REQUESTS_PER_WEEK,
  MAX_FUTURE_WEEKS,
} from "@/lib/constants";
import {
  buildSlotKey,
  getSelectableWeekContext,
  getWeekStartForDateKey,
  isSlotInPast,
} from "@/lib/time";

export const ACTIVE_STATUSES: BookingStatus[] = [
  "pending",
  "approved",
];

export function canCreateWeeklyRequest(
  activeRequestCount: number,
  limit = DEFAULT_MAX_REQUESTS_PER_WEEK,
) {
  return activeRequestCount < limit;
}

export function getReviewStatus(approvedCount: number) {
  if (approvedCount <= 0) {
    return "rejected" as const;
  }

  return "approved" as const;
}

export function validateWeekStart(weekStart: string) {
  return Boolean(getSelectableWeekContext(weekStart, MAX_FUTURE_WEEKS));
}

export function validateSlotsInSelectableWeek(slotKeys: string[], now = new Date()) {
  if (!slotKeys.length) return false;

  const parsed = slotKeys.map((slotKey) => {
    const [dateKey, time] = slotKey.split("T");
    return { dateKey, hour: Number(time?.slice(0, 2)) };
  });
  const weekStarts = new Set(
    parsed.map(({ dateKey }) => dateKey && getWeekStartForDateKey(dateKey)),
  );
  const weekStart = [...weekStarts][0];

  return (
    weekStarts.size === 1 &&
    Boolean(weekStart && getSelectableWeekContext(weekStart, MAX_FUTURE_WEEKS, now)) &&
    parsed.every(
      ({ dateKey, hour }) =>
        Boolean(dateKey) && !Number.isNaN(hour) && !isSlotInPast(dateKey, hour, now),
    )
  );
}

export function validateWeekStartFor(weekStart: string, now = new Date()) {
  return Boolean(getSelectableWeekContext(weekStart, MAX_FUTURE_WEEKS, now));
}

export function hasDuplicateSlots(slotKeys: string[]) {
  return new Set(slotKeys).size !== slotKeys.length;
}

export function normalizeApprovedSlots(dateKeys: string[], hours: number[]) {
  return dateKeys.flatMap((dateKey) => hours.map((hour) => buildSlotKey(dateKey, hour)));
}
