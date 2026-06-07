import { DateTime } from 'luxon';

/**
 * Converts a UTC Date to the senior's local timezone.
 * Used by the scheduler and call engine to determine local call times.
 */
export function toSeniorLocalTime(utcDate: Date, timezone: string): DateTime {
  return DateTime.fromJSDate(utcDate, { zone: 'utc' }).setZone(timezone);
}

/**
 * Returns true if the current UTC time matches the senior's configured call time
 * in their local timezone (matched to the minute — seconds are ignored).
 *
 * call_time comes from PostgreSQL as "HH:MM:SS" or "HH:MM".
 * A senior in PST (UTC-8) with call_time "09:00" matches when UTC is 17:00.
 */
export function isSeniorCallTime(
  senior: { call_time: string; timezone: string },
  nowUtc: Date
): boolean {
  const localNow = toSeniorLocalTime(nowUtc, senior.timezone);

  const [callHour, callMinute] = senior.call_time
    .split(':')
    .slice(0, 2)
    .map(Number);

  return localNow.hour === callHour && localNow.minute === callMinute;
}

/**
 * Returns the IANA day-of-week name ('monday' … 'sunday') in the senior's
 * local timezone. Used by the daily theme selector and call frequency checker.
 */
export function getSeniorLocalDay(
  utcDate: Date,
  timezone: string
): 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday' {
  const days = [
    'sunday',
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
  ] as const;
  const localNow = toSeniorLocalTime(utcDate, timezone);
  return days[localNow.weekday % 7]; // luxon: 1=Monday … 7=Sunday
}

/**
 * Returns the senior's local date as a "YYYY-MM-DD" string.
 * Used to check whether a call has already been made today.
 */
export function getSeniorLocalDate(utcDate: Date, timezone: string): string {
  return toSeniorLocalTime(utcDate, timezone).toISODate() ?? '';
}
