import { dateTimeFormatter } from './intl';

declare const civilDateBrand: unique symbol;
declare const civilMonthBrand: unique symbol;

export type CivilDate = string & { readonly [civilDateBrand]: true };
export type CivilMonth = string & { readonly [civilMonthBrand]: true };

export interface CivilDateRange {
  readonly start: CivilDate;
  readonly end: CivilDate;
}

export type CivilDateFormatOptions = Omit<
  Intl.DateTimeFormatOptions,
  | 'calendar'
  | 'timeZone'
  | 'timeStyle'
  | 'hour'
  | 'minute'
  | 'second'
  | 'fractionalSecondDigits'
  | 'dayPeriod'
  | 'timeZoneName'
>;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_MONTH = /^\d{4}-\d{2}$/;
export const CIVIL_DATE_FORMAT_OPTIONS = { calendar: 'gregory', timeZone: 'UTC' } satisfies Intl.DateTimeFormatOptions;
const TODAY_LOCALE = 'en-US';
const pad = (value: number, length: number) => String(value).padStart(length, '0');

export function dateFromParts(year: number, monthIndex: number, day: number): Date {
  const date = new Date(0);
  date.setUTCFullYear(year, monthIndex, day);
  return date;
}

export function dateFromIso(iso: string): Date {
  const [year = Number.NaN, month = Number.NaN, day = 1] = iso.split('-').map(Number);
  return dateFromParts(year, month - 1, day);
}

export const isoFromDate = (date: Date) =>
  `${pad(date.getUTCFullYear(), 4)}-${pad(date.getUTCMonth() + 1, 2)}-${pad(date.getUTCDate(), 2)}`;

export function parseCivilDate(value: unknown): CivilDate | null {
  return typeof value === 'string' && ISO_DATE.test(value) && isoFromDate(dateFromIso(value)) === value
    ? (value as CivilDate)
    : null;
}

export function parseCivilMonth(value: unknown): CivilMonth | null {
  return typeof value === 'string' && ISO_MONTH.test(value) && parseCivilDate(`${value}-01`) !== null
    ? (value as CivilMonth)
    : null;
}

export function parseCivilDateRange(value: unknown): CivilDateRange | null {
  if (typeof value !== 'object' || value === null || !('start' in value) || !('end' in value)) return null;
  const start = parseCivilDate(value.start);
  const end = parseCivilDate(value.end);
  return start !== null && end !== null && start <= end ? { start, end } : null;
}

export const civilMonthOf = (value: CivilDate): CivilMonth => value.slice(0, 7) as CivilMonth;

export function formatCivilDate(
  value: CivilDate,
  locales?: Intl.LocalesArgument,
  options: CivilDateFormatOptions = {},
): string {
  const hasFields = [options.dateStyle, options.year, options.month, options.day, options.weekday, options.era]
    .some((field) => field !== undefined);
  return dateTimeFormatter(locales, {
    ...options,
    ...(!hasFields && { dateStyle: 'medium' }),
    ...CIVIL_DATE_FORMAT_OPTIONS,
  }).format(dateFromIso(value));
}

export function formatCivilMonth(
  value: CivilMonth,
  locales?: Intl.LocalesArgument,
  options?: Pick<Intl.DateTimeFormatOptions, 'year' | 'month' | 'era' | 'numberingSystem'>,
): string {
  return dateTimeFormatter(locales, {
    year: 'numeric',
    month: 'long',
    ...options,
    ...CIVIL_DATE_FORMAT_OPTIONS,
  }).format(dateFromIso(value));
}

export function todayCivilDate({ timeZone, now = new Date() }: { timeZone: string; now?: Date }): CivilDate {
  if (typeof timeZone !== 'string' || timeZone.length === 0) throw new RangeError('A time zone is required.');
  const parts = dateTimeFormatter(TODAY_LOCALE, {
    calendar: 'gregory',
    numberingSystem: 'latn',
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    era: 'short',
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((entry) => entry.type === type)?.value;
  const year = Number(part('year'));
  const civilYear = part('era') === 'BC' ? 1 - year : year;
  const result = parseCivilDate(`${pad(civilYear, 4)}-${part('month')}-${part('day')}`);
  if (result === null) throw new RangeError('The current date is outside the civil date domain.');
  return result;
}
