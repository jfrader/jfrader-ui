export const DEFAULT_TIME_ZONE = 'UTC';

export const defaultLocale = () => (typeof navigator === 'undefined' ? undefined : navigator.language);

export const numberFormatter = (locale?: Intl.LocalesArgument, options?: Intl.NumberFormatOptions) =>
  new Intl.NumberFormat(locale, options);

export const dateTimeFormatter = (locale?: Intl.LocalesArgument, options?: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat(locale, options);

export const relativeTimeFormatter = (locale?: Intl.LocalesArgument) =>
  new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

const MAX_EPOCH = 8.64e15;
const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const YEAR = 365.2425 * DAY;
const MONTH = YEAR / 12;
const WEEK = 7 * DAY;
const RELATIVE_UNITS: readonly (readonly [Intl.RelativeTimeFormatUnit, number])[] = [
  ['year', YEAR],
  ['month', MONTH],
  ['week', WEEK],
  ['day', DAY],
  ['hour', HOUR],
  ['minute', MINUTE],
];
const ISO_DATE_TIME = /^(\d{4})-(\d{2})-(\d{2})T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/;
const VALIDATION_LOCALE = 'en-US';

export const validEpoch = (epoch: number) => Number.isFinite(epoch) && Math.abs(epoch) <= MAX_EPOCH;

export function toEpoch(value: Date | string | number): number | null {
  if (typeof value === 'number') return validEpoch(value) ? value : null;
  if (value instanceof Date) return validEpoch(value.getTime()) ? value.getTime() : null;
  if (typeof value !== 'string') return null;
  const match = ISO_DATE_TIME.exec(value);
  if (!match) return null;
  const [year, month, day] = match.slice(1, 4).map(Number) as [number, number, number];
  const calendar = new Date(Date.UTC(year, month - 1, day));
  if (calendar.getUTCMonth() !== month - 1 || calendar.getUTCDate() !== day) return null;
  const epoch = Date.parse(value);
  return validEpoch(epoch) ? epoch : null;
}

export function relativeTime(epoch: number, now: number, format: Intl.RelativeTimeFormat) {
  const distance = epoch - now;
  for (const [unit, size] of RELATIVE_UNITS) {
    if (Math.abs(distance) >= size) return format.format(Math.trunc(distance / size), unit);
  }
  return format.format(Math.trunc(distance / SECOND), 'second');
}

export function resolveTimeOptions(owner: string, locale: Intl.LocalesArgument, timeZone: string) {
  const problems: string[] = [];
  let safeLocale = locale;
  try {
    Intl.getCanonicalLocales(locale as string | string[] | undefined);
  } catch {
    problems.push(`${owner}: locale ${JSON.stringify(String(locale))} is not a valid language tag; using the default locale.`);
    safeLocale = undefined;
  }
  let safeTimeZone = timeZone;
  try {
    dateTimeFormatter(VALIDATION_LOCALE, { timeZone });
  } catch {
    problems.push(`${owner}: timeZone ${JSON.stringify(timeZone)} is not a valid IANA time zone; using ${DEFAULT_TIME_ZONE}.`);
    safeTimeZone = DEFAULT_TIME_ZONE;
  }
  return { locale: safeLocale, timeZone: safeTimeZone, problems };
}
