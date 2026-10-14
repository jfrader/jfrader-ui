import { dateTimeFormatter, defaultLocale } from '../../utils/intl';
import type { CalendarWeekday } from './calendar';

// ---- Date-only arithmetic on 'YYYY-MM-DD' strings (UTC calendar fields).

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_MONTH = /^\d{4}-\d{2}$/;
export const DAYS_PER_WEEK = 7;
const MONTHS_PER_YEAR = 12;
const SUNDAY: CalendarWeekday = 0;
// Any Sunday: weekday column headers are formatted from the dates of this week.
export const REFERENCE_SUNDAY = '2026-01-04';

const pad = (value: number, length: number) => String(value).padStart(length, '0');

export function dateFromParts(year: number, monthIndex: number, day: number): Date {
  // setUTCFullYear keeps years 0–99 literal (Date.UTC maps them to 19xx) and rolls
  // overflowing months/days into the next unit.
  const date = new Date(Date.UTC(0, 0, 1));
  date.setUTCFullYear(year, monthIndex, day);
  return date;
}

export function dateFromIso(iso: string): Date {
  const [year = Number.NaN, month = Number.NaN, day = 1] = iso.split('-').map(Number);
  return dateFromParts(year, month - 1, day);
}

export const isoFromDate = (date: Date) =>
  `${pad(date.getUTCFullYear(), 4)}-${pad(date.getUTCMonth() + 1, 2)}-${pad(date.getUTCDate(), 2)}`;

export const isIsoDate = (value: string | undefined): value is string =>
  value !== undefined && ISO_DATE.test(value) && isoFromDate(dateFromIso(value)) === value;

export const isIsoMonth = (value: string | undefined): value is string =>
  value !== undefined && ISO_MONTH.test(value) && isIsoDate(`${value}-01`);

export const monthOf = (iso: string) => iso.slice(0, 7);
export const firstOfMonth = (month: string) => `${month}-01`;

export function shiftDays(iso: string, days: number): string {
  const date = dateFromIso(iso);
  return isoFromDate(dateFromParts(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + days));
}

function shiftMonths(iso: string, months: number): string {
  const date = dateFromIso(iso);
  const target = dateFromParts(date.getUTCFullYear(), date.getUTCMonth() + months, 1);
  const lastDay = dateFromParts(target.getUTCFullYear(), target.getUTCMonth() + 1, 0).getUTCDate();
  return isoFromDate(
    dateFromParts(target.getUTCFullYear(), target.getUTCMonth(), Math.min(date.getUTCDate(), lastDay)),
  );
}

export const shiftMonth = (month: string, months: number) => monthOf(shiftMonths(firstOfMonth(month), months));
export const lastOfMonth = (month: string) => shiftDays(firstOfMonth(shiftMonth(month, 1)), -1);

export const isWithin = (iso: string, min: string | undefined, max: string | undefined) =>
  (min === undefined || iso >= min) && (max === undefined || iso <= max);

export function clampDate(iso: string, min: string | undefined, max: string | undefined): string {
  if (min !== undefined && iso < min) return min;
  if (max !== undefined && iso > max) return max;
  return iso;
}

export const weekColumn = (iso: string, firstDayOfWeek: CalendarWeekday) =>
  (dateFromIso(iso).getUTCDay() - firstDayOfWeek + DAYS_PER_WEEK) % DAYS_PER_WEEK;

// ---- Locale data from Intl.

export interface Formatters {
  month: Intl.DateTimeFormat;
  day: Intl.DateTimeFormat;
  date: Intl.DateTimeFormat;
  weekdayShort: Intl.DateTimeFormat;
  weekdayLong: Intl.DateTimeFormat;
}

interface WeekInfo {
  /** 1 (Monday) … 7 (Sunday). */
  firstDay: number;
}

/** Intl.Locale week data: `getWeekInfo()` (Baseline 2026) or the older `weekInfo` accessor. */
interface LocaleWeekInfo {
  getWeekInfo?: () => WeekInfo;
  weekInfo?: WeekInfo;
}

export function localeFirstDayOfWeek(locale: string): CalendarWeekday {
  const intlLocale = new Intl.Locale(locale) as unknown as LocaleWeekInfo;
  const info = intlLocale.getWeekInfo?.() ?? intlLocale.weekInfo;
  return info ? ((info.firstDay % DAYS_PER_WEEK) as CalendarWeekday) : SUNDAY;
}

export const CIVIL_DATE_FORMAT_OPTIONS = { calendar: 'gregory', timeZone: 'UTC' } satisfies Intl.DateTimeFormatOptions;

export function createFormatters(locale: string): Formatters {
  return {
    month: dateTimeFormatter(locale, { ...CIVIL_DATE_FORMAT_OPTIONS, month: 'long', year: 'numeric' }),
    day: dateTimeFormatter(locale, { ...CIVIL_DATE_FORMAT_OPTIONS, day: 'numeric' }),
    date: dateTimeFormatter(locale, { ...CIVIL_DATE_FORMAT_OPTIONS, dateStyle: 'long' }),
    weekdayShort: dateTimeFormatter(locale, { ...CIVIL_DATE_FORMAT_OPTIONS, weekday: 'short' }),
    weekdayLong: dateTimeFormatter(locale, { ...CIVIL_DATE_FORMAT_OPTIONS, weekday: 'long' }),
  };
}

export { defaultLocale };

// ---- Keyboard moves.

interface MoveContext {
  firstDayOfWeek: CalendarWeekday;
  shiftKey: boolean;
}

type Move = (from: string, context: MoveContext) => string;

const byDays =
  (days: number): Move =>
  (from) =>
    shiftDays(from, days);

const byMonths =
  (months: number): Move =>
  (from, { shiftKey }) =>
    shiftMonths(from, shiftKey ? months * MONTHS_PER_YEAR : months);

const SHARED_MOVES: Partial<Record<string, Move>> = {
  ArrowDown: byDays(DAYS_PER_WEEK),
  ArrowUp: byDays(-DAYS_PER_WEEK),
  Home: (from, { firstDayOfWeek }) => shiftDays(from, -weekColumn(from, firstDayOfWeek)),
  End: (from, { firstDayOfWeek }) => shiftDays(from, DAYS_PER_WEEK - 1 - weekColumn(from, firstDayOfWeek)),
  PageUp: byMonths(-1),
  PageDown: byMonths(1),
};

export const KEY_MOVES: Record<'ltr' | 'rtl', Partial<Record<string, Move>>> = {
  ltr: { ...SHARED_MOVES, ArrowRight: byDays(1), ArrowLeft: byDays(-1) },
  rtl: { ...SHARED_MOVES, ArrowRight: byDays(-1), ArrowLeft: byDays(1) },
};
