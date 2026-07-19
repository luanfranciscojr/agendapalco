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
  isBlocked: boolean;
  isCollectiveRehearsal: boolean;
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
  isBlocked: boolean;
  isCollectiveRehearsal: boolean;
};

export type DashboardData = {
  currentUser: AuthUser;
  weekStart: string;
  today: string;
  days: string[];
  previousWeekStart: string | null;
  nextWeekStart: string | null;
  unavailableSlotKeys: string[];
  slotHours: number[];
  maxRequestsPerMinistryPerWeek: number;
  ministries: { id: string; name: string }[];
  reservations: SlotReservation[];
  requests: DashboardRequest[];
};

export type PublicPanelData = {
  weekStart: string;
  today: string;
  days: string[];
  previousWeekStart: string | null;
  nextWeekStart: string | null;
  unavailableSlotKeys: string[];
  slotHours: number[];
  reservations: SlotReservation[];
};
