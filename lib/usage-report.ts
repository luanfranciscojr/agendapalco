import type { DashboardRequest } from "@/lib/types";

export type MinistryUsage = {
  ministryId: string;
  ministryName: string;
  bookingCount: number;
  hourCount: number;
};

export type UsageReport = {
  ministryCount: number;
  bookingCount: number;
  hourCount: number;
  ministries: MinistryUsage[];
};

export function buildUsageReport(
  requests: DashboardRequest[],
): UsageReport {
  const ministries = new Map<string, MinistryUsage>();
  let bookingCount = 0;
  let hourCount = 0;

  for (const request of requests) {
    if (
      request.status !== "approved" ||
      request.isBlocked ||
      request.reservedSlotKeys.length === 0
    ) {
      continue;
    }

    bookingCount += 1;
    hourCount += request.reservedSlotKeys.length;

    const current = ministries.get(request.ministryId);
    if (current) {
      current.bookingCount += 1;
      current.hourCount += request.reservedSlotKeys.length;
      continue;
    }

    ministries.set(request.ministryId, {
      ministryId: request.ministryId,
      ministryName: request.ministryName,
      bookingCount: 1,
      hourCount: request.reservedSlotKeys.length,
    });
  }

  const ministryList = [...ministries.values()].sort(
    (first, second) =>
      second.hourCount - first.hourCount ||
      first.ministryName.localeCompare(second.ministryName, "pt-BR"),
  );

  return {
    ministryCount: ministryList.length,
    bookingCount,
    hourCount,
    ministries: ministryList,
  };
}
