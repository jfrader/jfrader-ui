import { dateTimeFormatter, defaultLocale } from '../../utils/intl';
import {
  CIVIL_DATE_FORMAT_OPTIONS,
  dateFromParts,
  dateFromIso,
  isoFromDate,
  parseCivilDate,
  parseCivilMonth,
  type CivilDate,
  type CivilMonth,
} from '../../utils/civil-date';
import type { CalendarWeekday } from './calendar';

export { CIVIL_DATE_FORMAT_OPTIONS, dateFromParts, dateFromIso, isoFromDate };

// ---- Date-only arithmetic on 'YYYY-MM-DD' strings (UTC calendar fields).

export const DAYS_PER_WEEK = 7;
const MONTHS_PER_YEAR = 12;
const SUNDAY: CalendarWeekday = 0;
// Any Sunday: weekday column headers are formatted from the dates of this week.
export const REFERENCE_SUNDAY = '2026-01-04';

export const isIsoDate = (value: unknown): value is CivilDate => parseCivilDate(value) !== null;

export const isIsoMonth = (value: unknown): value is CivilMonth => parseCivilMonth(value) !== null;

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
