import { BookingStatus } from "@prisma/client";

import { DEFAULT_MAX_REQUESTS_PER_WEEK } from "@/lib/constants";
import {
  buildSlotKey,
  getCurrentWeekContext,
  isDateKeyInCurrentWeek,
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
  return weekStart === getCurrentWeekContext().weekStart;
}

export function validateSlotsInCurrentWeek(slotKeys: string[], now = new Date()) {
  return slotKeys.every((slotKey) => {
    const [dateKey] = slotKey.split("T");
    return Boolean(dateKey) && isDateKeyInCurrentWeek(dateKey, now);
  });
}

export function validateWeekStartFor(weekStart: string, now = new Date()) {
  return weekStart === getCurrentWeekContext(now).weekStart;
}

export function hasDuplicateSlots(slotKeys: string[]) {
  return new Set(slotKeys).size !== slotKeys.length;
}

export function normalizeApprovedSlots(dateKeys: string[], hours: number[]) {
  return dateKeys.flatMap((dateKey) => hours.map((hour) => buildSlotKey(dateKey, hour)));
}
