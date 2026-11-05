import type { BookingStatus } from "@prisma/client";

import { BLOCKED_MINISTRY_NAME } from "@/lib/constants";
import { buildSlotKey, getCurrentDateTimeKeyInTimeZone } from "@/lib/time";

export const REHEARSAL_REPORT_START_DATE = "2026-10-01";

export type RehearsalReport = {
  startDate: string;
  endDate: string;
  total: number;
  ministries: {
    ministryId: string;
    ministryName: string;
    rehearsalCount: number;
  }[];
};

type RehearsalSlot = {
  slotDate: Date;
  hour: number;
  bookingRequest: { id: string; ministryId: string; status: BookingStatus };
};

export function buildRehearsalReport(
  ministries: { id: string; name: string }[],
  slots: RehearsalSlot[],
  now = new Date(),
): RehearsalReport {
  const currentTime = getCurrentDateTimeKeyInTimeZone(now);
  const bookingsByMinistry = new Map<string, Set<string>>();

  for (const slot of slots) {
    const date = slot.slotDate.toISOString().slice(0, 10);
    if (
      slot.bookingRequest.status !== "approved" ||
      date < REHEARSAL_REPORT_START_DATE ||
      buildSlotKey(date, slot.hour + 1) > currentTime
    ) {
      continue;
    }

    const ministryId = slot.bookingRequest.ministryId;
    const bookings = bookingsByMinistry.get(ministryId) ?? new Set<string>();
    bookings.add(slot.bookingRequest.id);
    bookingsByMinistry.set(ministryId, bookings);
  }

  const rows = ministries
    .filter((ministry) => ministry.name !== BLOCKED_MINISTRY_NAME)
    .map((ministry) => ({
      ministryId: ministry.id,
      ministryName: ministry.name,
      rehearsalCount: bookingsByMinistry.get(ministry.id)?.size ?? 0,
    }))
    .sort((a, b) => b.rehearsalCount - a.rehearsalCount || a.ministryName.localeCompare(b.ministryName, "pt-BR"));

  return {
    startDate: REHEARSAL_REPORT_START_DATE,
    endDate: currentTime.slice(0, 10),
    total: rows.reduce((total, ministry) => total + ministry.rehearsalCount, 0),
    ministries: rows,
  };
}
