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
// "Today" is read at render time unless `today` is supplied; server-rendered output can disagree
// with the client across midnight or time zones.
// Range mode (`selectionRange` defined, even null) is the APG multi-selection variant of the
// grid: it sets aria-multiselectable, every enabled gridcell reports aria-selected true/false
// for the inclusive interval, and the endpoint day buttons are described by `rangeLabels`.
// `previewRange` decorates a tentative interval (data-preview*) and never sets aria-selected.
// Activation in range mode only reports `onDayActivate`; the parent owns the interval.
// `tabStopDate` hands roving focus to the parent (several grids sharing one tab stop): the
// grid's only tab stop is exactly that date when it is shown and enabled, else none. Keyboard
// moves then report their destination through `onFocusedDateChange` (across months too) and
// neither request visibleMonth nor move DOM focus: the parent reveals the month, passes the
// new tabStopDate and focuses the matching day.
import {
  createContext,
  useContext,
  useEffect,
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ComponentPropsWithRef,
  type KeyboardEvent,
} from 'react';
import { WithSx, type SxProps } from '../../styling/sx';
import { useControlledState } from '../../utils/use-controlled-state';
import { useLatestCallback } from '../../utils/use-latest-callback';
import {
  cellStyle,
  dayStyle,
  glyphStyle,
  gridStyle,
  headerStyle,
  labelStyle,
  navButtonStyle,
  rootStyle,
  weekdayStyle,
} from './calendar.styles';
import {
  CIVIL_DATE_FORMAT_OPTIONS,
  DAYS_PER_WEEK,
  KEY_MOVES,
  REFERENCE_SUNDAY,
  clampDate,
  createFormatters,
  dateFromIso,
  dateFromParts,
  defaultLocale,
  firstOfMonth,
  isIsoDate,
  isIsoMonth,
  isWithin,
  isoFromDate,
  lastOfMonth,
  localeFirstDayOfWeek,
  monthOf,
  shiftDays,
  shiftMonth,
  weekColumn,
  type Formatters,
} from './calendar.utils';

/** Day of the week as counted by `Date#getUTCDay`: 0 is Sunday, 6 is Saturday. */
export type CalendarWeekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** Inclusive interval of 'YYYY-MM-DD' dates, start ≤ end. */
export interface CalendarRange {
  start: string;
  end: string;
}

/** Descriptions read on the first and last day of `selectionRange`. */
export interface CalendarRangeLabels {
  start: string;
  end: string;
}

export interface CalendarProps extends Omit<ComponentPropsWithRef<'div'>, 'defaultValue' | 'onChange'>, SxProps {
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
  /** 'YYYY-MM-DD' marked as today. Defaults to the local civil date at render time. */
  today?: string;
  /** Range mode: the selected interval (null for none). Replaces `value` as the selection. */
  selectionRange?: CalendarRange | null;
  /** Tentative interval, decorated but not selected. */
  previewRange?: CalendarRange | null;
  /** Parent-owned roving tab stop; null or a date outside the shown month leaves no day tab stop. */
  tabStopDate?: string | null;
  /** Every native day activation (click, Enter, Space), including the selected day. */
  onDayActivate?: (date: string) => void;
  /** A day received focus, or a keyboard move chose its destination (possibly in another month). */
  onFocusedDateChange?: (date: string) => void;
  /** Range mode: endpoint descriptions for screen readers. */
  rangeLabels?: CalendarRangeLabels;
}

/** The header renders its own month buttons and label. */
export type CalendarHeaderProps = Omit<ComponentPropsWithRef<'div'>, 'children'> & SxProps;
export type CalendarGridProps = ComponentPropsWithRef<'table'> & SxProps;

/** The day that carries roving focus, and the day to keep it on if `date` is not shown. */
interface FocusTarget {
  date: string;
  fallback: string;
}

interface CalendarContextValue {
  value: string | undefined;
  selectionRange: CalendarRange | null | undefined;
  previewRange: CalendarRange | null | undefined;
  tabStopDate: string | null | undefined;
  onDayActivate: (date: string) => void;
  onFocusedDateChange: (date: string) => void;
  rangeLabelIds: CalendarRangeLabels | undefined;
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

const isInRange = (date: string, range: CalendarRange | null | undefined) =>
  range != null && date >= range.start && date <= range.end;

const PREVIOUS_GLYPH = '‹';
const NEXT_GLYPH = '›';

// ---- Parts.

function CalendarRoot({
  ref,
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
  today: todayProp,
  selectionRange,
  previewRange,
  tabStopDate,
  onDayActivate: onDayActivateProp,
  onFocusedDateChange: onFocusedDateChangeProp,
  rangeLabels,
  className,
  sx,
  children,
  ...rest
}: CalendarProps) {
  const baseId = useId();
  const labelId = `${baseId}-label`;
  const hasRangeLabels = rangeLabels !== undefined;
  const rangeLabelIds = useMemo(
    () => (hasRangeLabels ? { start: `${baseId}-range-start`, end: `${baseId}-range-end` } : undefined),
    [baseId, hasRangeLabels],
  );
  const onDayActivate = useLatestCallback(onDayActivateProp);
  const onFocusedDateChange = useLatestCallback(onFocusedDateChangeProp);
  // Today follows the user's local civil day, not the UTC day used for arithmetic.
  const now = new Date();
  const today = isIsoDate(todayProp)
    ? todayProp
    : isoFromDate(dateFromParts(now.getFullYear(), now.getMonth(), now.getDate()));
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
      selectionRange,
      previewRange,
      tabStopDate,
      onDayActivate,
      onFocusedDateChange,
      rangeLabelIds,
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
      selectionRange,
      previewRange,
      tabStopDate,
      onDayActivate,
      onFocusedDateChange,
      rangeLabelIds,
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
      <WithSx className={className} styles={rootStyle} sx={sx}>
        {(className) => (
          <div {...rest} ref={ref} data-ui="calendar" className={className}>
            {children}
            {rangeLabels && rangeLabelIds && (
              <>
                <span id={rangeLabelIds.start} hidden>
                  {rangeLabels.start}
                </span>
                <span id={rangeLabelIds.end} hidden>
                  {rangeLabels.end}
                </span>
              </>
            )}
          </div>
        )}
      </WithSx>
    </CalendarContext.Provider>
  );
}

CalendarRoot.displayName = 'Calendar';

function CalendarHeader({ ref, className, sx, ...props }: CalendarHeaderProps) {
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
    <WithSx className={className} styles={headerStyle} sx={sx}>
      {(className) => (
        <div {...props} ref={ref} data-ui="calendar-header" className={className}>
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
      )}
    </WithSx>
  );
}

CalendarHeader.displayName = 'Calendar.Header';

interface DayProps {
  date: string;
  isTabStop: boolean;
}

function Day({ date, isTabStop }: DayProps) {
  const {
    value,
    selectionRange,
    previewRange,
    rangeLabelIds,
    today,
    min,
    max,
    formatters,
    setFocus,
    requestValue,
    onDayActivate,
    onFocusedDateChange,
  } = useCalendarContext('Grid');
  const isRangeMode = selectionRange !== undefined;
  const isEnabled = isWithin(date, min, max);
  const isSelected = isRangeMode ? isInRange(date, selectionRange) : value === date;
  const isRangeStart = selectionRange?.start === date;
  const isRangeEnd = selectionRange?.end === date;
  const isToday = today === date;
  const civilDate = dateFromIso(date);
  const describedBy =
    [isRangeStart ? rangeLabelIds?.start : undefined, isRangeEnd ? rangeLabelIds?.end : undefined]
      .filter(Boolean)
      .join(' ') || undefined;
  // Range mode exposes the selection state of every selectable day (APG multi-selection).
  const ariaSelected = isSelected ? true : isRangeMode && isEnabled ? false : undefined;

  return (
    <td role="gridcell" aria-selected={ariaSelected} css={cellStyle}>
      <button
        type="button"
        data-ui="calendar-day"
        data-date={date}
        data-today={isToday || undefined}
        data-selected={(!isRangeMode && isSelected) || undefined}
        data-in-range={(isRangeMode && isSelected) || undefined}
        data-range-start={isRangeStart || undefined}
        data-range-end={isRangeEnd || undefined}
        data-preview={isInRange(date, previewRange) || undefined}
        data-preview-start={previewRange?.start === date || undefined}
        data-preview-end={previewRange?.end === date || undefined}
        aria-current={isToday ? 'date' : undefined}
        aria-label={formatters.date.format(civilDate)}
        aria-describedby={describedBy}
        tabIndex={isTabStop ? 0 : -1}
        disabled={!isEnabled}
        onFocus={() => {
          setFocus({ date, fallback: date });
          onFocusedDateChange(date);
        }}
        onClick={() => {
          // Safari does not focus buttons on click: move the tab stop explicitly.
          setFocus({ date, fallback: date });
          if (!isRangeMode) requestValue(date);
          onDayActivate(date);
        }}
        css={dayStyle}
      >
        {formatters.day.format(civilDate)}
      </button>
    </td>
  );
}

function CalendarGrid({
  ref,
  onKeyDown,
  'aria-labelledby': ariaLabelledByProp,
  'aria-label': ariaLabelProp,
  className,
  sx,
  ...rest
}: CalendarGridProps) {
  const {
    value,
    selectionRange,
    tabStopDate,
    visibleMonth,
    today,
    min,
    max,
    firstDayOfWeek,
    formatters,
    focus,
    setFocus,
    requestVisibleMonth,
    onFocusedDateChange,
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
  const isFocusable = (date: string | null | undefined): date is string =>
    date != null && days.includes(date) && isWithin(date, min, max);
  const isParentFocus = tabStopDate !== undefined;
  const tabStop = isParentFocus
    ? isFocusable(tabStopDate)
      ? tabStopDate
      : undefined
    : ([focus?.date, focus?.fallback, selectionRange === undefined ? value : selectionRange?.start, today].find(
        isFocusable,
      ) ?? days.find((day) => isWithin(day, min, max)));

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
    if (isParentFocus) {
      onFocusedDateChange(target);
      return;
    }
    setFocus({ date: target, fallback: from });
    focusPendingRef.current = true;
    if (monthOf(target) !== visibleMonth) requestVisibleMonth(monthOf(target));
  };

  const ariaLabelledBy = [ariaLabelledByProp, hasHeader ? labelId : undefined].filter(Boolean).join(' ') || undefined;
  const monthLabel = formatters.month.format(dateFromIso(first));

  return (
    <WithSx className={className} styles={gridStyle} sx={sx}>
      {(className) => (
        <table
          {...rest}
          ref={gridRef}
          role="grid"
          aria-multiselectable={selectionRange !== undefined || undefined}
          aria-labelledby={ariaLabelledBy}
          aria-label={ariaLabelledBy === undefined ? (ariaLabelProp ?? monthLabel) : ariaLabelProp}
          data-ui="calendar-grid"
          onKeyDown={handleKeyDown}
          className={className}
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
      )}
    </WithSx>
  );
}

CalendarGrid.displayName = 'Calendar.Grid';

export const Calendar = Object.assign(CalendarRoot, { Header: CalendarHeader, Grid: CalendarGrid });
