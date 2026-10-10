// APG pattern: the calendar grid of the date picker dialog example
// (https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/examples/datepicker-dialog/).
// Calendar.Grid is a role="grid" table: one row per week, a gridcell per day holding a day
// button. Roving tabindex: exactly one day button is a tab stop — the last focused day while
// it is in the visible month, else the selected day, else today, else the first enabled day.
// Keyboard map: ArrowRight/ArrowLeft ±1 day (swapped under RTL), ArrowDown/ArrowUp ±1 week
// (both wrap across rows), Home/End first/last day of the week, PageUp/PageDown ±1 month,
// Shift+PageUp/PageDown ±1 year; month moves keep the day number, clamped to the month's last
// day. Every move is clamped into min/max, so disabled days are never focused. A move out of
// the visible month requests visibleMonth; a rejected controlled request keeps focus on the
// current day. Enter/Space (native button activation) and click select the focused day.
// The selected gridcell carries aria-selected="true"; today's button carries aria-current="date"
// and data-today. Calendar.Header's month label is a polite live region that names the grid,
// so month changes are announced. Header month buttons stay focusable at the min/max boundary
// (aria-disabled) so focus is never dropped.
// A Grid without Header has no live month announcement; Header provides the live region.
// Values are date-only: 'YYYY-MM-DD' (value/min/max) and 'YYYY-MM' (visibleMonth) are parsed
// field by field into UTC Dates and formatted in UTC with the Gregorian calendar. This keeps
// civil dates intact even when the local time zone skipped a day. No time or zone is stored.
// Native Date + Intl.DateTimeFormat: Temporal is not Baseline (MDN, checked 2026-10-10).
// The week start comes from Intl.Locale#getWeekInfo (Baseline 2026), the older `weekInfo`
// accessor, or Sunday when the engine exposes neither.
// "Today" is read at render time; server-rendered output can disagree with the client across
// midnight or time zones.
import {
  createContext,
  forwardRef,
  useContext,
  useEffect,
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type HTMLAttributes,
  type KeyboardEvent,
} from 'react';
import { vars } from '@jfrader/tokens/vars';
import { css } from '../../styling/css';
import { useControlledState } from '../../utils/use-controlled-state';

/** Day of the week as counted by `Date#getUTCDay`: 0 is Sunday, 6 is Saturday. */
export type CalendarWeekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface CalendarProps extends Omit<HTMLAttributes<HTMLDivElement>, 'defaultValue' | 'onChange'> {
  /** Selected date, 'YYYY-MM-DD'. */
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** Displayed month, 'YYYY-MM'. Defaults to the month of the value, else the current month. */
  visibleMonth?: string;
  defaultVisibleMonth?: string;
  onVisibleMonthChange?: (month: string) => void;
  /** Earliest selectable date, 'YYYY-MM-DD'. */
  min?: string;
  /** Latest selectable date, 'YYYY-MM-DD'. */
  max?: string;
  /** BCP 47 tag. Defaults to `navigator.language`. */
  locale?: string;
  /** Defaults to the locale's week start. */
  firstDayOfWeek?: CalendarWeekday;
}

/** The header renders its own month buttons and label. */
export type CalendarHeaderProps = Omit<HTMLAttributes<HTMLDivElement>, 'children'>;
export type CalendarGridProps = HTMLAttributes<HTMLTableElement>;

interface Formatters {
  month: Intl.DateTimeFormat;
  day: Intl.DateTimeFormat;
  date: Intl.DateTimeFormat;
  weekdayShort: Intl.DateTimeFormat;
  weekdayLong: Intl.DateTimeFormat;
}

/** The day that carries roving focus, and the day to keep it on if `date` is not shown. */
interface FocusTarget {
  date: string;
  fallback: string;
}

interface CalendarContextValue {
  value: string | undefined;
  visibleMonth: string;
  today: string;
  min: string | undefined;
  max: string | undefined;
  firstDayOfWeek: CalendarWeekday;
  formatters: Formatters;
  focus: FocusTarget | null;
  setFocus: (focus: FocusTarget) => void;
  requestValue: (value: string) => void;
  requestVisibleMonth: (month: string) => void;
  labelId: string;
  hasHeader: boolean;
  setHasHeader: (hasHeader: boolean) => void;
}

const CalendarContext = createContext<CalendarContextValue | null>(null);

function useCalendarContext(part: string): CalendarContextValue {
  const context = useContext(CalendarContext);
  if (!context) throw new Error(`Calendar.${part} must be rendered inside <Calendar>.`);
  return context;
}

// ---- Date-only arithmetic on 'YYYY-MM-DD' strings (UTC calendar fields).

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_MONTH = /^\d{4}-\d{2}$/;
const DAYS_PER_WEEK = 7;
const MONTHS_PER_YEAR = 12;
const SUNDAY: CalendarWeekday = 0;
// Any Sunday: weekday column headers are formatted from the dates of this week.
const REFERENCE_SUNDAY = '2026-01-04';

const pad = (value: number, length: number) => String(value).padStart(length, '0');

function dateFromParts(year: number, monthIndex: number, day: number): Date {
  // setUTCFullYear keeps years 0–99 literal (Date.UTC maps them to 19xx) and rolls
  // overflowing months/days into the next unit.
  const date = new Date(Date.UTC(0, 0, 1));
  date.setUTCFullYear(year, monthIndex, day);
  return date;
}

function dateFromIso(iso: string): Date {
  const [year = Number.NaN, month = Number.NaN, day = 1] = iso.split('-').map(Number);
  return dateFromParts(year, month - 1, day);
}

const isoFromDate = (date: Date) =>
  `${pad(date.getUTCFullYear(), 4)}-${pad(date.getUTCMonth() + 1, 2)}-${pad(date.getUTCDate(), 2)}`;

const isIsoDate = (value: string | undefined): value is string =>
  value !== undefined && ISO_DATE.test(value) && isoFromDate(dateFromIso(value)) === value;

const isIsoMonth = (value: string | undefined): value is string =>
  value !== undefined && ISO_MONTH.test(value) && isIsoDate(`${value}-01`);

const monthOf = (iso: string) => iso.slice(0, 7);
const firstOfMonth = (month: string) => `${month}-01`;

function shiftDays(iso: string, days: number): string {
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

const shiftMonth = (month: string, months: number) => monthOf(shiftMonths(firstOfMonth(month), months));
const lastOfMonth = (month: string) => shiftDays(firstOfMonth(shiftMonth(month, 1)), -1);

const isWithin = (iso: string, min: string | undefined, max: string | undefined) =>
  (min === undefined || iso >= min) && (max === undefined || iso <= max);

function clampDate(iso: string, min: string | undefined, max: string | undefined): string {
  if (min !== undefined && iso < min) return min;
  if (max !== undefined && iso > max) return max;
  return iso;
}

const weekColumn = (iso: string, firstDayOfWeek: CalendarWeekday) =>
  (dateFromIso(iso).getUTCDay() - firstDayOfWeek + DAYS_PER_WEEK) % DAYS_PER_WEEK;

// ---- Locale data from Intl.

interface WeekInfo {
  /** 1 (Monday) … 7 (Sunday). */
  firstDay: number;
}

/** Intl.Locale week data: `getWeekInfo()` (Baseline 2026) or the older `weekInfo` accessor. */
interface LocaleWeekInfo {
  getWeekInfo?: () => WeekInfo;
  weekInfo?: WeekInfo;
}

function localeFirstDayOfWeek(locale: string): CalendarWeekday {
  const intlLocale = new Intl.Locale(locale) as unknown as LocaleWeekInfo;
  const info = intlLocale.getWeekInfo?.() ?? intlLocale.weekInfo;
  return info ? ((info.firstDay % DAYS_PER_WEEK) as CalendarWeekday) : SUNDAY;
}

const CIVIL_DATE_FORMAT_OPTIONS = { calendar: 'gregory', timeZone: 'UTC' } satisfies Intl.DateTimeFormatOptions;

function createFormatters(locale: string): Formatters {
  return {
    month: new Intl.DateTimeFormat(locale, { ...CIVIL_DATE_FORMAT_OPTIONS, month: 'long', year: 'numeric' }),
    day: new Intl.DateTimeFormat(locale, { ...CIVIL_DATE_FORMAT_OPTIONS, day: 'numeric' }),
    date: new Intl.DateTimeFormat(locale, { ...CIVIL_DATE_FORMAT_OPTIONS, dateStyle: 'long' }),
    weekdayShort: new Intl.DateTimeFormat(locale, { ...CIVIL_DATE_FORMAT_OPTIONS, weekday: 'short' }),
    weekdayLong: new Intl.DateTimeFormat(locale, { ...CIVIL_DATE_FORMAT_OPTIONS, weekday: 'long' }),
  };
}

const defaultLocale = () => (typeof navigator === 'undefined' ? undefined : navigator.language);

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

const KEY_MOVES: Record<'ltr' | 'rtl', Partial<Record<string, Move>>> = {
  ltr: { ...SHARED_MOVES, ArrowRight: byDays(1), ArrowLeft: byDays(-1) },
  rtl: { ...SHARED_MOVES, ArrowRight: byDays(-1), ArrowLeft: byDays(1) },
};

// ---- Styles.

const PREVIOUS_GLYPH = '‹';
const NEXT_GLYPH = '›';
const REDUCED_MOTION = '@media (prefers-reduced-motion: reduce)';
const FORCED_COLORS = '@media (forced-colors: active)';

const rootStyle = css({
  display: 'inline-flex',
  flexDirection: 'column',
  gap: vars.space[2],
  fontFamily: vars.font.sans,
  color: vars.color.text,
});

const headerStyle = css({
  display: 'flex',
  alignItems: 'center',
  gap: vars.space[2],
});

const labelStyle = css({
  flex: 1,
  textAlign: 'center',
  fontSize: vars.textSize.sm,
  fontWeight: vars.fontWeight.semibold,
});

const controlTransition = {
  transitionDuration: vars.motion.duration.fast,
  transitionTimingFunction: vars.motion.easeStandard,
  [REDUCED_MOTION]: {
    transitionDuration: '0s',
  },
};

const navButtonStyle = css({
  appearance: 'none',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  inlineSize: '32px',
  blockSize: '32px',
  padding: 0,
  border: `1px solid ${vars.color.borderControl}`,
  borderRadius: vars.radius.sm,
  backgroundColor: 'transparent',
  font: 'inherit',
  fontSize: vars.textSize.lg,
  lineHeight: 1,
  color: vars.color.text,
  cursor: 'pointer',
  transitionProperty: 'background-color',
  ...controlTransition,
  '&:hover:not([aria-disabled="true"])': {
    backgroundColor: vars.color.surfaceHover,
  },
  '&[aria-disabled="true"]': {
    opacity: 0.55,
    cursor: 'not-allowed',
  },
  '&:focus-visible': {
    outline: `2px solid ${vars.color.focusRing}`,
    outlineOffset: '2px',
  },
});

const glyphStyle = css({
  display: 'inline-block',
  '&:dir(rtl)': {
    transform: 'scaleX(-1)',
  },
});

const gridStyle = css({
  borderCollapse: 'separate',
  borderSpacing: vars.space[1],
  marginInline: `calc(-1 * ${vars.space[1]})`,
});

const weekdayStyle = css({
  paddingBlock: vars.space[1],
  fontSize: vars.textSize.xs,
  fontWeight: vars.fontWeight.medium,
  color: vars.color.textMuted,
  textAlign: 'center',
});

const cellStyle = css({
  padding: 0,
});

const dayStyle = css({
  appearance: 'none',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  inlineSize: '36px',
  blockSize: '36px',
  padding: 0,
  border: '1px solid transparent',
  borderRadius: vars.radius.sm,
  backgroundColor: 'transparent',
  font: 'inherit',
  fontSize: vars.textSize.sm,
  fontVariantNumeric: 'tabular-nums',
  color: vars.color.text,
  cursor: 'pointer',
  transitionProperty: 'background-color, border-color, color',
  ...controlTransition,
  '&:hover:not(:disabled):not([data-selected])': {
    backgroundColor: vars.color.surfaceHover,
  },
  '&[data-today]': {
    borderColor: vars.color.borderControl,
    fontWeight: vars.fontWeight.semibold,
  },
  '&[data-selected]': {
    backgroundColor: vars.color.accent,
    borderColor: vars.color.accent,
    color: vars.color.accentContrast,
    fontWeight: vars.fontWeight.semibold,
  },
  '&[data-selected]:hover': {
    backgroundColor: vars.color.accentHover,
  },
  '&:disabled': {
    opacity: 0.55,
    cursor: 'not-allowed',
    textDecoration: 'line-through',
  },
  '&:focus-visible': {
    outline: `2px solid ${vars.color.focusRing}`,
    outlineOffset: '2px',
  },
  [FORCED_COLORS]: {
    '&[data-selected]': {
      forcedColorAdjust: 'none',
      backgroundColor: 'Highlight',
      borderColor: 'Highlight',
      color: 'HighlightText',
    },
  },
});

// ---- Parts.

const Root = forwardRef<HTMLDivElement, CalendarProps>(function Calendar(
  {
    value: valueProp,
    defaultValue,
    onValueChange,
    visibleMonth: visibleMonthProp,
    defaultVisibleMonth,
    onVisibleMonthChange,
    min: minProp,
    max: maxProp,
    locale: localeProp,
    firstDayOfWeek: firstDayOfWeekProp,
    ...rest
  },
  ref,
) {
  const labelId = `${useId()}-label`;
  // Today follows the user's local civil day, not the UTC day used for arithmetic.
  const now = new Date();
  const today = isoFromDate(dateFromParts(now.getFullYear(), now.getMonth(), now.getDate()));
  const locale = useMemo(
    () => new Intl.DateTimeFormat(localeProp ?? defaultLocale(), CIVIL_DATE_FORMAT_OPTIONS).resolvedOptions().locale,
    [localeProp],
  );
  const formatters = useMemo(() => createFormatters(locale), [locale]);
  const localeWeekStart = useMemo(() => localeFirstDayOfWeek(locale), [locale]);
  const firstDayOfWeek = firstDayOfWeekProp ?? localeWeekStart;

  const [value, requestValue] = useControlledState<string>(valueProp, defaultValue, onValueChange);
  const initialValue = valueProp ?? defaultValue;
  const [visibleMonthState, requestVisibleMonth] = useControlledState<string>(
    visibleMonthProp,
    defaultVisibleMonth ?? monthOf(isIsoDate(initialValue) ? initialValue : today),
    onVisibleMonthChange,
  );
  const visibleMonth = isIsoMonth(visibleMonthState) ? visibleMonthState : monthOf(today);
  const min = isIsoDate(minProp) ? minProp : undefined;
  const max = isIsoDate(maxProp) ? maxProp : undefined;

  const [focus, setFocus] = useState<FocusTarget | null>(null);
  const [hasHeader, setHasHeader] = useState(false);

  const context = useMemo<CalendarContextValue>(
    () => ({
      value,
      visibleMonth,
      today,
      min,
      max,
      firstDayOfWeek,
      formatters,
      focus,
      setFocus,
      requestValue,
      requestVisibleMonth,
      labelId,
      hasHeader,
      setHasHeader,
    }),
    [
      value,
      visibleMonth,
      today,
      min,
      max,
      firstDayOfWeek,
      formatters,
      focus,
      requestValue,
      requestVisibleMonth,
      labelId,
      hasHeader,
    ],
  );

  return (
    <CalendarContext.Provider value={context}>
      <div {...rest} ref={ref} data-ui="calendar" css={rootStyle} />
    </CalendarContext.Provider>
  );
});

const Header = forwardRef<HTMLDivElement, CalendarHeaderProps>(function CalendarHeader(props, ref) {
  const { visibleMonth, min, max, formatters, requestVisibleMonth, labelId, setHasHeader } =
    useCalendarContext('Header');

  // The grid takes its name from the header label only while the label exists.
  useLayoutEffect(() => {
    setHasHeader(true);
    return () => setHasHeader(false);
  }, [setHasHeader]);

  const previous = shiftMonth(visibleMonth, -1);
  const next = shiftMonth(visibleMonth, 1);
  const previousDisabled = min !== undefined && lastOfMonth(previous) < min;
  const nextDisabled = max !== undefined && firstOfMonth(next) > max;
  const monthName = (month: string) => formatters.month.format(dateFromIso(firstOfMonth(month)));

  return (
    <div {...props} ref={ref} data-ui="calendar-header" css={headerStyle}>
      <button
        type="button"
        data-ui="calendar-previous"
        aria-label={monthName(previous)}
        aria-disabled={previousDisabled || undefined}
        onClick={() => {
          if (!previousDisabled) requestVisibleMonth(previous);
        }}
        css={navButtonStyle}
      >
        <span aria-hidden="true" css={glyphStyle}>
          {PREVIOUS_GLYPH}
        </span>
      </button>
      <span id={labelId} aria-live="polite" aria-atomic="true" data-ui="calendar-label" css={labelStyle}>
        {monthName(visibleMonth)}
      </span>
      <button
        type="button"
        data-ui="calendar-next"
        aria-label={monthName(next)}
        aria-disabled={nextDisabled || undefined}
        onClick={() => {
          if (!nextDisabled) requestVisibleMonth(next);
        }}
        css={navButtonStyle}
      >
        <span aria-hidden="true" css={glyphStyle}>
          {NEXT_GLYPH}
        </span>
      </button>
    </div>
  );
});

interface DayProps {
  date: string;
  isTabStop: boolean;
}

function Day({ date, isTabStop }: DayProps) {
  const { value, today, min, max, formatters, setFocus, requestValue } = useCalendarContext('Grid');
  const isSelected = value === date;
  const isToday = today === date;
  const civilDate = dateFromIso(date);

  return (
    <td role="gridcell" aria-selected={isSelected || undefined} css={cellStyle}>
      <button
        type="button"
        data-ui="calendar-day"
        data-date={date}
        data-today={isToday || undefined}
        data-selected={isSelected || undefined}
        aria-current={isToday ? 'date' : undefined}
        aria-label={formatters.date.format(civilDate)}
        tabIndex={isTabStop ? 0 : -1}
        disabled={!isWithin(date, min, max)}
        onFocus={() => setFocus({ date, fallback: date })}
        onClick={() => {
          // Safari does not focus buttons on click: move the tab stop explicitly.
          setFocus({ date, fallback: date });
          requestValue(date);
        }}
        css={dayStyle}
      >
        {formatters.day.format(civilDate)}
      </button>
    </td>
  );
}

const Grid = forwardRef<HTMLTableElement, CalendarGridProps>(function CalendarGrid(
  { onKeyDown, 'aria-labelledby': ariaLabelledByProp, 'aria-label': ariaLabelProp, ...rest },
  ref,
) {
  const {
    value,
    visibleMonth,
    today,
    min,
    max,
    firstDayOfWeek,
    formatters,
    focus,
    setFocus,
    requestVisibleMonth,
    labelId,
    hasHeader,
  } = useCalendarContext('Grid');
  const gridRef = useRef<HTMLTableElement>(null);
  useImperativeHandle(ref, () => gridRef.current as HTMLTableElement, []);
  // Set by keyboard moves: after the next commit, DOM focus follows the tab stop.
  const focusPendingRef = useRef(false);

  const first = firstOfMonth(visibleMonth);
  const dayCount = dateFromIso(lastOfMonth(visibleMonth)).getUTCDate();
  const days = Array.from({ length: dayCount }, (_, index) => shiftDays(first, index));
  const isFocusable = (date: string | undefined): date is string =>
    date !== undefined && days.includes(date) && isWithin(date, min, max);
  const tabStop =
    [focus?.date, focus?.fallback, value, today].find(isFocusable) ?? days.find((day) => isWithin(day, min, max));

  const cells: Array<string | null> = [...Array<null>(weekColumn(first, firstDayOfWeek)).fill(null), ...days];
  const weeks = Array.from({ length: Math.ceil(cells.length / DAYS_PER_WEEK) }, (_, week) =>
    Array.from({ length: DAYS_PER_WEEK }, (_, column) => cells[week * DAYS_PER_WEEK + column] ?? null),
  );
  const weekdays = Array.from({ length: DAYS_PER_WEEK }, (_, column) =>
    dateFromIso(shiftDays(REFERENCE_SUNDAY, (firstDayOfWeek + column) % DAYS_PER_WEEK)),
  );

  useEffect(() => {
    if (!focusPendingRef.current) return;
    focusPendingRef.current = false;
    gridRef.current?.querySelector<HTMLButtonElement>(`[data-date="${tabStop}"]`)?.focus();
  });

  const handleKeyDown = (event: KeyboardEvent<HTMLTableElement>) => {
    onKeyDown?.(event);
    const grid = gridRef.current;
    if (event.defaultPrevented || !grid) return;
    const from = (event.target as HTMLElement).dataset.date;
    if (!isFocusable(from)) return;
    const move = KEY_MOVES[getComputedStyle(grid).direction === 'rtl' ? 'rtl' : 'ltr'][event.key];
    if (!move) return;

    event.preventDefault();
    const target = clampDate(move(from, { firstDayOfWeek, shiftKey: event.shiftKey }), min, max);
    if (target === from) return;
    setFocus({ date: target, fallback: from });
    focusPendingRef.current = true;
    if (monthOf(target) !== visibleMonth) requestVisibleMonth(monthOf(target));
  };

  const ariaLabelledBy = [ariaLabelledByProp, hasHeader ? labelId : undefined].filter(Boolean).join(' ') || undefined;
  const monthLabel = formatters.month.format(dateFromIso(first));

  return (
    <table
      {...rest}
      ref={gridRef}
      role="grid"
      aria-labelledby={ariaLabelledBy}
      aria-label={ariaLabelledBy === undefined ? (ariaLabelProp ?? monthLabel) : ariaLabelProp}
      data-ui="calendar-grid"
      onKeyDown={handleKeyDown}
      css={gridStyle}
    >
      <thead>
        <tr role="row">
          {weekdays.map((weekday) => (
            <th
              key={weekday.getUTCDay()}
              role="columnheader"
              scope="col"
              abbr={formatters.weekdayLong.format(weekday)}
              css={weekdayStyle}
            >
              {formatters.weekdayShort.format(weekday)}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {weeks.map((week, weekIndex) => (
          <tr key={weekIndex} role="row">
            {week.map((date, column) =>
              date === null ? (
                <td key={`empty-${column}`} role="gridcell" css={cellStyle} />
              ) : (
                <Day key={date} date={date} isTabStop={date === tabStop} />
              ),
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
});

export const Calendar = Object.assign(Root, { Header, Grid });
