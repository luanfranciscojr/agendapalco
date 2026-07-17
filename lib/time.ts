import { addDays, subDays } from "date-fns";

import { APP_TIME_ZONE, WEEK_START_DAY } from "@/lib/constants";

export type WeekContext = {
  today: string;
  weekStart: string;
  days: string[];
};

export type SelectableWeekContext = WeekContext & {
  previousWeekStart: string | null;
  nextWeekStart: string | null;
};

function formatDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function dateKeyToUtcDate(dateKey: string) {
  return new Date(`${dateKey}T00:00:00.000Z`);
}

export function getTodayInTimeZone(now = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const parts = formatter.formatToParts(now);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    throw new Error("Falha ao resolver a data atual no timezone configurado.");
  }

  return `${year}-${month}-${day}`;
}

export function getCurrentWeekContext(now = new Date()): WeekContext {
  const today = getTodayInTimeZone(now);
  const todayDate = dateKeyToUtcDate(today);
  const diff = (todayDate.getUTCDay() - WEEK_START_DAY + 7) % 7;
  const weekStartDate = subDays(todayDate, diff);
  const weekStart = formatDateKey(weekStartDate);
  const days = Array.from({ length: 7 }, (_, index) =>
    formatDateKey(addDays(weekStartDate, index)),
  );

  return { today, weekStart, days };
}

export function getWeekContext(weekStart: string, now = new Date()): WeekContext {
  const weekStartDate = dateKeyToUtcDate(weekStart);
  const days = Array.from({ length: 7 }, (_, index) =>
    formatDateKey(addDays(weekStartDate, index)),
  );

  return { today: getTodayInTimeZone(now), weekStart, days };
}

export function getWeekStartForDateKey(dateKey: string) {
  const date = dateKeyToUtcDate(dateKey);
  const diff = (date.getUTCDay() - WEEK_START_DAY + 7) % 7;
  return formatDateKey(subDays(date, diff));
}

export function getSelectableWeekContext(
  requestedWeekStart: string | undefined,
  maxFutureWeeks: number,
  now = new Date(),
): SelectableWeekContext | null {
  const current = getCurrentWeekContext(now);
  const selectedWeekStart = requestedWeekStart ?? current.weekStart;
  const selectedDate = dateKeyToUtcDate(selectedWeekStart);
  const currentDate = dateKeyToUtcDate(current.weekStart);
  const maximumDate = addDays(currentDate, maxFutureWeeks * 7);

  if (
    Number.isNaN(selectedDate.getTime()) ||
    selectedWeekStart !== formatDateKey(selectedDate) ||
    selectedDate.getUTCDay() !== WEEK_START_DAY ||
    selectedDate < currentDate ||
    selectedDate > maximumDate
  ) {
    return null;
  }

  return {
    ...getWeekContext(selectedWeekStart, now),
    previousWeekStart:
      selectedDate > currentDate ? formatDateKey(subDays(selectedDate, 7)) : null,
    nextWeekStart:
      selectedDate < maximumDate ? formatDateKey(addDays(selectedDate, 7)) : null,
  };
}

function getCurrentDateTimeKeyInTimeZone(now = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const values = Object.fromEntries(
    formatter
      .formatToParts(now)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );

  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}`;
}

export function isSlotInPast(dateKey: string, hour: number, now = new Date()) {
  return buildSlotKey(dateKey, hour) <= getCurrentDateTimeKeyInTimeZone(now);
}

export function isDateKeyInCurrentWeek(dateKey: string, now = new Date()) {
  return getCurrentWeekContext(now).days.includes(dateKey);
}

export function hourLabel(hour: number) {
  return `${String(hour).padStart(2, "0")}:00`;
}

export function buildSlotKey(dateKey: string, hour: number) {
  return `${dateKey}T${String(hour).padStart(2, "0")}:00`;
}

export function parseSlotKey(slotKey: string) {
  const [dateKey, hourPart] = slotKey.split("T");
  const hour = Number(hourPart?.slice(0, 2));

  if (!dateKey || Number.isNaN(hour)) {
    throw new Error("Horário inválido.");
  }

  return { dateKey, hour };
}

export function slotDateTimeLabel(dateKey: string, hour: number) {
  const date = dateKeyToUtcDate(dateKey);
  const weekday = new Intl.DateTimeFormat("pt-BR", {
    weekday: "short",
    timeZone: "UTC",
  }).format(date);
  const fullDate = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);

  return `${weekday.replace(".", "")} ${fullDate} ${hourLabel(hour)}`;
}

export function formatDatePtBr(dateKey: string) {
  const date = dateKeyToUtcDate(dateKey);
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "UTC",
  }).format(date);
}

export function formatDateFullPtBr(dateKey: string) {
  const date = dateKeyToUtcDate(dateKey);
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function formatWeekdayShortPtBr(dateKey: string) {
  const date = dateKeyToUtcDate(dateKey);
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "short",
    timeZone: "UTC",
  })
    .format(date)
    .replace(".", "")
    .toUpperCase();
}
