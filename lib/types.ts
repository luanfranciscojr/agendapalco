import type { BookingOrigin, BookingStatus } from "@prisma/client";
import type { AuthUser } from "@/lib/auth";

export type SlotReservation = {
  slotKey: string;
  dateKey: string;
  hour: number;
  requestId: string;
  ministryId: string;
  ministryName: string;
  requestedByName: string;
  status: BookingStatus;
};

export type DashboardRequest = {
  id: string;
  ministryId: string;
  ministryName: string;
  requestedByName: string;
  origin: BookingOrigin;
  status: BookingStatus;
  reviewNote: string | null;
  createdAt: string;
  requestedSlotKeys: string[];
  reservedSlotKeys: string[];
};

export type DashboardData = {
  currentUser: AuthUser;
  weekStart: string;
  today: string;
  days: string[];
  slotHours: number[];
  maxRequestsPerMinistryPerWeek: number;
  ministries: { id: string; name: string }[];
  reservations: SlotReservation[];
  requests: DashboardRequest[];
};
