export const APP_TIME_ZONE = "America/Manaus";
export const WEEK_START_DAY = 0;
export const SLOT_START_HOUR = 18;
export const SLOT_END_HOUR = 21;
export const DEFAULT_MAX_REQUESTS_PER_WEEK = 1;
export const CONFIG_KEY_MAX_REQUESTS = "max_requests_per_ministry_per_week";

export const SLOT_HOURS = Array.from(
  { length: SLOT_END_HOUR - SLOT_START_HOUR },
  (_, index) => SLOT_START_HOUR + index,
);
