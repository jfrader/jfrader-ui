// APG patterns: a button opening a non-modal dialog
// (https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/examples/datepicker-dialog/) whose
// month grids use the grid pattern with multi-selection (aria-multiselectable, aria-selected
// on every selectable gridcell).
// DateRangePicker.Trigger is a native button with aria-haspopup="dialog", aria-expanded and
// (while open) aria-controls. Its name joins the consumer's label with the committed range as
// Intl formats it. DateRangePicker.Content is the dialog: an optional preset group, one or two
// Calendar grids, a polite range summary and Cancel/Apply.
// Transaction: opening seeds a draft from the committed value. The first day activation
// anchors the draft on that day; while anchored, the hovered or focused day previews the
// ordered interval (decoration only, never aria-selected); the second activation finishes it,
// the same day included. The last input drives the preview: a keyboard move previews the
// focused day until the pointer moves over the grid again. Presets replace the draft. Only
// Apply commits, and only an ordered draft whose endpoints are both available under the
// current min/max: it requests the value (skipped when structurally unchanged), then the
// close. Cancel, Escape, outside presses and Tab-out discard the draft once the close is
// accepted; a rejected close keeps it.
// Keyboard map, trigger: Enter/ArrowDown on keydown and Space on keyup open the dialog and
// focus the draft start, else today, else the first enabled day; while open they move focus
// back into the grid.
// Keyboard map, dialog: Calendar's grid keys with one day tab stop shared by every month
// (a move into the other shown month focuses it there; past the shown months it reveals the
// target); preset arrows (Up/Down in the rail, inline arrows in the row, RTL-aware) wrap over
// the enabled presets with Home/End; Escape closes and returns focus to the trigger; Tab walks
// presets, month buttons, the day tab stop and the actions, then leaves and closes.
// Focus return is explicit: accepted Apply, Cancel or Escape restore it to the trigger;
// outside presses and Tab-out never move focus.
// Nesting: the picker is an overlay layer; inside another layer (e.g. a Popover) its open
// dialog is topmost, so Escape and outside presses dismiss the picker first.
// Direction: the portaled dialog takes the trigger's effective direction (an explicit `dir`
// on Content wins), so grid and preset arrows follow an RTL subtree of an LTR document.
// Disabled hides the dialog and blocks opening without requesting any open change.
// Motion: the dialog fades in a few pixels from the trigger's side. An accepted close keeps it
// mounted, inert and hidden from assistive technology while it fades out; it is no longer an
// open layer then, so Escape and outside presses already reach the layer below. Reduced motion
// makes both instant.
// Values are inclusive date-only ranges of 'YYYY-MM-DD' strings, parsed and formatted as UTC
// Gregorian dates: there is no time or time zone. An invalid or reversed value is shown as
// empty and invalid, never repaired. `today` makes presets and the today marker deterministic
// for server rendering; without it, they follow the client's local date.
// Required cannot be exposed with aria-required on a button; `messages.required` joins the
// trigger's name instead, and the hidden fields never enforce native constraint validation.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ComponentPropsWithRef,
  type ComponentType,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import {
  FloatingFocusManager,
  useClick,
  useInteractions,
  useMergeRefs,
  useRole,
  type UseInteractionsReturn,
} from '@floating-ui/react';
import { vars } from '@jfrader/tokens/vars';
import { css, type Interpolation, type SerializedStyles, type Theme } from '../../styling/css';
import { focusRingOutset } from '../../styling/focus-ring';
import { FORCED_COLORS, REDUCED_MOTION } from '../../styling/media';
import { floatingSurfaceMotion } from '../../styling/overlay-motion';
import { raisedSurface } from '../../styling/surface';
import { withoutSx, WithSx, type SxProps } from '../../styling/sx';
import { useExitPresence } from '../../overlay/exit-motion';
import { OverlayLayer, useLayerDismiss } from '../../overlay/overlay-layer';
import { OverlayPortal } from '../../overlay/overlay-portal';
import { useOverlayFloating, type OverlayAvailableSize } from '../../overlay/use-overlay-floating';
import { isRenderable } from '../../utils/renderable';
import { dateTimeFormatter, numberFormatter } from '../../utils/intl';
import { moveRovingFocus, type OwnedItemsQuery } from '../../utils/roving-focus';
import { useControlledState } from '../../utils/use-controlled-state';
import { Button } from '../button';
import { Calendar, type CalendarRange, type CalendarWeekday } from '../calendar';
import {
  CIVIL_DATE_FORMAT_OPTIONS,
  clampDate,
  dateFromIso,
  dateFromParts,
  defaultLocale,
  firstOfMonth,
  isIsoDate,
  isWithin,
  isoFromDate,
  monthOf,
  shiftMonth,
} from '../calendar/calendar.utils';

const PLACEMENT = 'bottom-start';
/** Available boundary width from which `months="auto"` shows two months side by side. */
const TWO_MONTH_MIN_WIDTH = 712;
const PRESET_RAIL_MIN_WIDTH = 800;
const MS_PER_DAY = 86_400_000;
const OPEN_KEYS = new Set(['Enter', 'ArrowDown']);
const SPACE = ' ';
const DAY = '[data-ui="calendar-day"]';
const TAB_STOP_DAY = `${DAY}[tabindex="0"]`;
const PRESET_QUERY: OwnedItemsQuery = {
  itemSelector: '[data-ui="date-range-picker-preset"]:not([aria-disabled="true"])',
  ownerSelector: '[data-ui="date-range-picker-presets"]',
};
const NO_PRESETS: readonly DateRangePreset[] = [];
const RANGE_FORMAT_OPTIONS = { ...CIVIL_DATE_FORMAT_OPTIONS, dateStyle: 'medium' } satisfies Intl.DateTimeFormatOptions;

/** Inclusive range of 'YYYY-MM-DD' dates. */
export type DateRangeValue = CalendarRange;

export type DateRangePickerMonths = 'auto' | 1 | 2;
export type DateRangePickerSize = 'sm' | 'md' | 'lg';

export interface DateRangePreset {
  id: string;
  label: ReactNode;
  /** The preset's range for the given 'YYYY-MM-DD' today. Out-of-bounds results disable the preset. */
  range: (today: string) => DateRangeValue;
}

export interface DateRangePickerSummaryDetails {
  /** The range as Intl formats it, e.g. "Oct 3 – 9, 2026". */
  range: string;
  /** Inclusive day count, for plural selection. */
  days: number;
  /** `days` as Intl.NumberFormat formats it in the locale. */
  formattedDays: string;
}

export interface DateRangePickerMessages {
  apply: ReactNode;
  cancel: ReactNode;
  /** Summary while no range is drafted. */
  empty: ReactNode;
  /** Description of the range's first day. */
  start: string;
  /** Description of the range's last day. */
  end: string;
  /** Summary of the drafted (or previewed) range; select plurals from `days`. */
  summary: (details: DateRangePickerSummaryDetails) => ReactNode;
  /** Accessible name of the preset group. */
  presets?: string;
  /** Alert shown next to the trigger while the field is invalid. */
  error?: ReactNode;
  /** Joined to the trigger's name when `required` is set. */
  required?: string;
}

export interface DateRangePickerBaseProps {
  /** Controls the committed inclusive date range; `null` leaves it empty. */
  value?: DateRangeValue | null;
  /** Initial uncontrolled committed range. Defaults to empty. */
  defaultValue?: DateRangeValue | null;
  /** Apply request; a structurally unchanged range is not requested. Controlled values may reject it. */
  onValueChange?: (range: DateRangeValue | null) => void;
  /** Controls whether the date range dialog is open. */
  open?: boolean;
  /** Opens the uncontrolled dialog initially. Defaults to `false`. */
  defaultOpen?: boolean;
  /** Requests a change to the dialog's open state. */
  onOpenChange?: (open: boolean) => void;
  /** Earliest selectable date, 'YYYY-MM-DD'. */
  min?: string;
  /** Latest selectable date, 'YYYY-MM-DD'. */
  max?: string;
  /** BCP 47 tag. Defaults to `navigator.language` (the Intl default on the server). */
  locale?: string;
  /** Defaults to the locale's week start. */
  firstDayOfWeek?: CalendarWeekday;
  /** 'YYYY-MM-DD' used for presets and the today marker. Defaults to the local civil date. */
  today?: string;
  /** `auto` shows two months when the boundary leaves at least 712px. */
  months?: DateRangePickerMonths;
  /** Collision boundary of the dialog. Defaults to the clipping ancestors and the viewport. */
  boundary?: HTMLElement | null;
  /** Lists shortcuts that replace the draft range. Defaults to no presets. */
  presets?: readonly DateRangePreset[];
  /** Blocks the popup, even with controlled open=true, and omits the form fields. */
  disabled?: boolean;
  /** The dialog opens for inspection; days, presets and Apply change nothing. */
  readOnly?: boolean;
  /** Adds `messages.required` to the trigger name without native form validation. */
  required?: boolean;
  /** Hidden form field carrying the start date ('' when empty). */
  startName?: string;
  /** Hidden form field carrying the end date ('' when empty). */
  endName?: string;
  /** Supplies action labels, range summaries and accessible descriptions. */
  messages: DateRangePickerMessages;
  /** One Trigger and one Content. */
  children?: ReactNode;
}

export interface DateRangePickerCompoundProps extends DateRangePickerBaseProps {
  label?: never;
  placeholder?: never;
  size?: never;
  icon?: never;
  slots?: never;
  slotProps?: never;
}

export interface DateRangePickerEasyProps extends Omit<DateRangePickerBaseProps, 'children'> {
  /** Name the generated range trigger and dialog. */
  label: string;
  /** Content shown in the trigger when no valid range is committed. */
  placeholder?: ReactNode;
  /** Sets the generated trigger's size. Defaults to `md`. */
  size?: DateRangePickerSize;
  /** Decorative icon before the generated trigger's range text. */
  icon?: ReactNode;
  children?: never;
  /** Replace native roots with components that forward all supplied props and ref. */
  slots?: DateRangePickerSlots;
  /** Supplies props and `sx` to the generated trigger and dialog. */
  slotProps?: {
    /** Button trigger opening the date range dialog. */
    trigger?: DateRangePickerTriggerProps & DateRangePickerSlotProps;
    /** Dialog popup containing calendar grids and actions. */
    content?: DateRangePickerContentProps & DateRangePickerSlotProps;
  };
}

export type DateRangePickerProps = DateRangePickerCompoundProps | DateRangePickerEasyProps;

export interface DateRangePickerSlots {
  /** Opens the date range dialog. */
  trigger?: ComponentType<ComponentPropsWithRef<'button'>>;
  /** Holds the date range dialog. */
  content?: ComponentType<ComponentPropsWithRef<'div'>>;
}

export interface DateRangePickerContentSlots {
  /** Lists the quick-selection presets. */
  presets?: ComponentType<DateRangePickerSlotProps>;
  /** Holds the month calendars. */
  calendars?: ComponentType<DateRangePickerSlotProps>;
  /** Announces the drafted range. */
  summary?: ComponentType<DateRangePickerSlotProps>;
  /** Holds the cancel and apply actions. */
  actions?: ComponentType<DateRangePickerSlotProps>;
}

export interface DateRangePickerTriggerProps
  extends Omit<ComponentPropsWithRef<'button'>, 'value' | 'defaultValue' | 'children'>,
    SxProps {
  /** Sets the trigger's size. Defaults to `md`. */
  size?: DateRangePickerSize;
  /** Decorative icon before the range text. */
  icon?: ReactNode;
  /** Shown while no valid range is committed. */
  placeholder?: ReactNode;
}

export interface DateRangePickerSlotProps {
  className?: string;
  sx?: Interpolation<Theme>;
}

export interface DateRangePickerContentProps extends Omit<ComponentPropsWithRef<'div'>, 'children'>, SxProps {
  /** Replaces the preset, calendar, summary and action containers. */
  slots?: DateRangePickerContentSlots;
  /** Supplies attributes and `sx` to the dialog's interior containers. */
  slotProps?: {
    /** List of quick-selection date range presets. */
    presets?: DateRangePickerSlotProps;
    /** Container holding one or two month calendar grids. */
    calendars?: DateRangePickerSlotProps;
    /** Live region describing the currently drafted range. */
    summary?: DateRangePickerSlotProps;
    /** Footer container holding the Cancel and Apply buttons. */
    actions?: DateRangePickerSlotProps;
  };
}

type OverlayFloating = ReturnType<typeof useOverlayFloating>;

interface TriggerLabelling {
  labelledBy?: string;
  label?: string;
}

interface DateRangePickerContextValue {
  slots: DateRangePickerEasyProps['slots'];
  open: boolean;
  disabled: boolean;
  readOnly: boolean;
  required: boolean;
  invalid: boolean;
  value: DateRangeValue | null;
  startName: string | undefined;
  endName: string | undefined;
  displayValue: string | undefined;
  min: string | undefined;
  max: string | undefined;
  locale: string;
  firstDayOfWeek: CalendarWeekday | undefined;
  today: string;
  months: DateRangePickerMonths;
  presets: readonly DateRangePreset[];
  messages: DateRangePickerMessages;
  availableSize: OverlayAvailableSize | null;
  triggerLabelling: TriggerLabelling | null;
  contentRef: RefObject<HTMLDivElement | null>;
  refs: OverlayFloating['refs'];
  floatingContext: OverlayFloating['context'];
  floatingStyles: CSSProperties;
  getReferenceProps: UseInteractionsReturn['getReferenceProps'];
  getFloatingProps: UseInteractionsReturn['getFloatingProps'];
  requestOpen: () => void;
  apply: (range: DateRangeValue) => void;
  cancel: () => void;
  resetValue: () => void;
  setTriggerLabelling: (labelling: TriggerLabelling | null) => void;
}

const DateRangePickerContext = createContext<DateRangePickerContextValue | null>(null);

function useDateRangePickerContext(part: string): DateRangePickerContextValue {
  const context = useContext(DateRangePickerContext);
  if (!context) throw new Error(`DateRangePicker.${part} must be rendered inside <DateRangePicker>.`);
  return context;
}

// ---- Date-only ranges.

const isValidRange = (range: DateRangeValue | null | undefined): range is DateRangeValue =>
  range != null && isIsoDate(range.start) && isIsoDate(range.end) && range.start <= range.end;

/** An ordered range whose endpoints are both selectable under the bounds. */
const isAvailableRange = (
  range: DateRangeValue | null | undefined,
  min: string | undefined,
  max: string | undefined,
): range is DateRangeValue => isValidRange(range) && isWithin(range.start, min, max) && isWithin(range.end, min, max);

const rangesEqual = (a: DateRangeValue | null, b: DateRangeValue | null) =>
  a === b || (a !== null && b !== null && a.start === b.start && a.end === b.end);

const orderedRange = (a: string, b: string): DateRangeValue => (a <= b ? { start: a, end: b } : { start: b, end: a });

const dayCount = ({ start, end }: DateRangeValue) =>
  Math.round((dateFromIso(end).getTime() - dateFromIso(start).getTime()) / MS_PER_DAY) + 1;

function localToday(): string {
  const now = new Date();
  return isoFromDate(dateFromParts(now.getFullYear(), now.getMonth(), now.getDate()));
}

const formatRange = (formatter: Intl.DateTimeFormat, { start, end }: DateRangeValue) =>
  formatter.formatRange(dateFromIso(start), dateFromIso(end));

const focusTabStopDay = (container: HTMLElement | null) => {
  const day = container?.querySelector<HTMLButtonElement>(TAB_STOP_DAY) ?? null;
  day?.focus({ preventScroll: true });
  return day;
};

// ---- Styles.

const triggerStyle = css({
  appearance: 'none',
  display: 'inline-flex',
  alignItems: 'center',
  gap: vars.space[2],
  boxSizing: 'border-box',
  maxInlineSize: '100%',
  overflowWrap: 'anywhere',
  border: `1px solid ${vars.color.borderControl}`,
  borderRadius: vars.radius.md,
  backgroundColor: vars.color.surfaceRaised,
  font: 'inherit',
  fontWeight: vars.fontWeight.medium,
  color: vars.color.text,
  textAlign: 'start',
  cursor: 'pointer',
  transitionProperty: 'background-color, border-color',
  transitionDuration: vars.motion.duration.fast,
  transitionTimingFunction: vars.motion.easeStandard,
  '&:hover:not(:disabled)': {
    backgroundColor: vars.color.surfaceHover,
  },
  '&:focus-visible': {
    ...focusRingOutset,
  },
  '&[aria-invalid="true"]:not(:focus-visible)': {
    borderColor: vars.color.dangerText,
  },
  '&:disabled': {
    opacity: 0.55,
    cursor: 'not-allowed',
  },
  [REDUCED_MOTION]: {
    transitionDuration: '0s',
  },
});

const triggerSizeStyles: Record<DateRangePickerSize, SerializedStyles> = {
  sm: css({ minBlockSize: vars.space[8], paddingInline: vars.space[3], fontSize: vars.textSize.sm }),
  md: css({ minBlockSize: vars.space[10], paddingInline: vars.space[4], fontSize: vars.textSize.sm }),
  lg: css({ minBlockSize: vars.space[12], paddingInline: vars.space[4], fontSize: vars.textSize.md }),
};

const iconStyle = css({
  display: 'inline-flex',
  flexShrink: 0,
  color: vars.color.textMuted,
  '& > svg': { inlineSize: '1em', blockSize: '1em' },
});

const placeholderStyle = css({
  color: vars.color.textMuted,
});

const errorStyle = css({
  display: 'block',
  marginBlockStart: vars.space[2],
  fontSize: vars.textSize.xs,
  color: vars.color.dangerText,
});

const contentStyle = css({
  ...raisedSurface,
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr)',
  boxSizing: 'border-box',
  gap: vars.space[4],
  borderRadius: vars.radius.lg,
  boxShadow: vars.shadow.overlay,
  padding: vars.space[4],
  overflow: 'auto',
  ...floatingSurfaceMotion,
  '&[data-layout="rail"]': {
    gridTemplateColumns: 'minmax(0, auto) minmax(0, 1fr)',
  },
  [FORCED_COLORS]: {
    border: '1px solid CanvasText',
  },
});

const presetsStyle = css({
  display: 'flex',
  boxSizing: 'border-box',
  gap: vars.space[2],
  '[data-layout="row"] > &': {
    contain: 'inline-size',
    overflowX: 'auto',
    padding: vars.space[1],
  },
  '[data-layout="rail"] > &': {
    flexDirection: 'column',
    contain: 'size',
    inlineSize: `calc(${vars.space[12]} * 3)`,
    overflowY: 'auto',
    gridRow: '1 / span 2',
    paddingBlock: vars.space[1],
    paddingInlineStart: vars.space[1],
    paddingInlineEnd: vars.space[4],
    borderInlineEnd: `1px solid ${vars.color.border}`,
  },
});

const presetStyle = css({
  appearance: 'none',
  flexShrink: 0,
  maxInlineSize: '100%',
  minBlockSize: vars.space[8],
  paddingInline: vars.space[3],
  border: '1px solid transparent',
  borderRadius: vars.radius.md,
  backgroundColor: 'transparent',
  font: 'inherit',
  fontSize: vars.textSize.sm,
  color: vars.color.text,
  textAlign: 'start',
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
  cursor: 'pointer',
  transitionProperty: 'background-color, border-color',
  transitionDuration: vars.motion.duration.fast,
  transitionTimingFunction: vars.motion.easeStandard,
  '&:hover:not([aria-disabled="true"])': {
    backgroundColor: vars.color.surfaceHover,
  },
  '&[aria-pressed="true"]': {
    backgroundColor: vars.color.accentSoft,
    borderColor: vars.color.accentBorder,
  },
  '&[aria-disabled="true"]': {
    opacity: 0.55,
    cursor: 'not-allowed',
  },
  '&:focus-visible': {
    ...focusRingOutset,
  },
  [REDUCED_MOTION]: {
    transitionDuration: '0s',
  },
  [FORCED_COLORS]: {
    '&[aria-pressed="true"]': {
      borderColor: 'Highlight',
    },
  },
});

// Months sit side by side and stack when the surface is too narrow, so days never shrink.
const calendarsStyle = css({
  display: 'flex',
  minInlineSize: 0,
  flexWrap: 'wrap',
  alignItems: 'flex-start',
  gap: vars.space[6],
  '& [role="gridcell"]': { textAlign: 'center' },
});

const footerStyle = css({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: vars.space[3],
  '[data-layout="rail"] > &': {
    gridColumn: 2,
  },
});

const summaryStyle = css({
  overflowWrap: 'anywhere',
  fontSize: vars.textSize.sm,
  color: vars.color.textMuted,
});

const actionsStyle = css({
  display: 'flex',
  flexWrap: 'wrap',
  maxInlineSize: '100%',
  gap: vars.space[2],
  marginInlineStart: 'auto',
  '& > button': { whiteSpace: 'normal', overflowWrap: 'anywhere', minInlineSize: 0 },
});

// ---- Parts.

function DateRangePickerLayer({
  nodeId,
  value: valueProp,
  defaultValue,
  onValueChange,
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  min: minProp,
  max: maxProp,
  locale: localeProp,
  firstDayOfWeek,
  today: todayProp,
  months = 'auto',
  boundary,
  presets = NO_PRESETS,
  disabled = false,
  readOnly = false,
  required = false,
  startName,
  endName,
  messages,
  children,
  slots,
}: DateRangePickerBaseProps & Pick<DateRangePickerEasyProps, 'slots'> & { nodeId: string | undefined }) {
  const [committed = null, requestValue, resetToDefault] = useControlledState<DateRangeValue | null>(
    valueProp,
    defaultValue ?? null,
    onValueChange,
  );
  const [requestedOpen = false, requestOpenChange] = useControlledState<boolean>(openProp, defaultOpen, onOpenChange);
  const open = requestedOpen && !disabled;
  const [triggerLabelling, setTriggerLabelling] = useState<TriggerLabelling | null>(null);
  const [availableSize, setAvailableSize] = useState<OverlayAvailableSize | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const pendingFocusRestoreRef = useRef(false);
  // Target of the last outside press; focus moving onto it is the same dismissal gesture.
  const outsidePressTargetRef = useRef<Element | null>(null);

  const locale = useMemo(
    () => dateTimeFormatter(localeProp ?? defaultLocale(), CIVIL_DATE_FORMAT_OPTIONS).resolvedOptions().locale,
    [localeProp],
  );
  const formatter = useMemo(() => dateTimeFormatter(locale, RANGE_FORMAT_OPTIONS), [locale]);
  const value = isValidRange(committed) ? committed : null;
  const min = isIsoDate(minProp) ? minProp : undefined;
  const max = isIsoDate(maxProp) ? maxProp : undefined;
  const invalid = (committed !== null && value === null) || (min !== undefined && max !== undefined && min > max);
  const today = isIsoDate(todayProp) ? todayProp : localToday();

  const { refs, floatingStyles, context } = useOverlayFloating({
    open,
    placement: PLACEMENT,
    shiftCrossAxis: false,
    nodeId,
    boundary,
    onAvailableSize: (size) =>
      setAvailableSize((current) =>
        current?.width === size.width && current.height === size.height ? current : size,
      ),
    onOpenChange: (next, event, reason) => {
      if (disabled && next) return;
      const pressTarget = outsidePressTargetRef.current;
      outsidePressTargetRef.current = reason === 'outside-press' && event?.target instanceof Element ? event.target : null;
      // One gesture, one request: an outside press that also moves focus reports focus-out too.
      const focusedNode = reason === 'focus-out' && event instanceof FocusEvent ? event.relatedTarget : null;
      if (pressTarget && focusedNode instanceof Node && focusedNode.contains(pressTarget)) return;
      // Escape requests a close; focus is restored only once the close is actually applied.
      if (!next) pendingFocusRestoreRef.current = reason === 'escape-key';
      requestOpenChange(next);
    },
  });

  // A rejected controlled close keeps the dialog open, so focus stays inside it.
  useEffect(() => {
    if (!open && pendingFocusRestoreRef.current) {
      pendingFocusRestoreRef.current = false;
      refs.domReference.current?.focus();
    }
  }, [open, refs]);

  // Keyboard opening is handled by the trigger (Space on keyup, focus into the grid).
  const click = useClick(context, { enabled: !disabled, keyboardHandlers: false });
  const dismiss = useLayerDismiss(context, 'container');
  const role = useRole(context, { role: 'dialog' });
  const { getReferenceProps, getFloatingProps } = useInteractions([click, ...dismiss, role]);

  const displayValue = useMemo(() => (value ? formatRange(formatter, value) : undefined), [formatter, value]);

  const contextValue = useMemo<DateRangePickerContextValue>(() => {
    const requestRange = (range: DateRangeValue | null) => {
      if (!rangesEqual(range, committed)) requestValue(range);
    };
    return {
      open,
      disabled,
      readOnly,
      required,
      invalid,
      value,
      startName,
      endName,
      displayValue,
      min,
      max,
      locale,
      firstDayOfWeek,
      today,
      months,
      presets,
      messages,
      availableSize,
      triggerLabelling,
      contentRef,
      refs,
      floatingContext: context,
      floatingStyles,
      getReferenceProps,
      getFloatingProps,
      requestOpen: () => {
        if (!disabled) requestOpenChange(true);
      },
      apply: (range) => {
        if (disabled || readOnly || !isAvailableRange(range, min, max)) return;
        // Value and open are independent requests: a controlled parent decides each axis.
        requestRange(range);
        pendingFocusRestoreRef.current = true;
        requestOpenChange(false);
      },
      cancel: () => {
        pendingFocusRestoreRef.current = true;
        requestOpenChange(false);
      },
      resetValue: () => {
        if (valueProp === undefined) resetToDefault();
        else requestRange(defaultValue ?? null);
      },
      setTriggerLabelling,
      slots,
    };
  }, [
    open,
    disabled,
    readOnly,
    required,
    invalid,
    committed,
    value,
    startName,
    endName,
    displayValue,
    min,
    max,
    locale,
    firstDayOfWeek,
    today,
    months,
    presets,
    messages,
    availableSize,
    triggerLabelling,
    refs,
    context,
    floatingStyles,
    getReferenceProps,
    getFloatingProps,
    requestValue,
    requestOpenChange,
    resetToDefault,
    valueProp,
    defaultValue,
    slots,
  ]);

  return (
    <DateRangePickerContext.Provider value={contextValue}>
      {children}
    </DateRangePickerContext.Provider>
  );
}

function DateRangePickerRoot(props: DateRangePickerProps) {
  const children = props.label !== undefined ? (
    <>
      <DateRangePickerTrigger
        aria-label={props.label}
        placeholder={props.placeholder}
        size={props.size}
        icon={props.icon}
        {...props.slotProps?.trigger}
      />
      <DateRangePickerContent {...props.slotProps?.content} />
    </>
  ) : props.children;
  return (
    <OverlayLayer>
      {(nodeId) => <DateRangePickerLayer {...props} nodeId={nodeId}>{children}</DateRangePickerLayer>}
    </OverlayLayer>
  );
}

DateRangePickerRoot.displayName = 'DateRangePicker';

function DateRangePickerTrigger({
  ref,
  id: idProp,
  form,
  size = 'md',
  icon,
  placeholder,
  className,
  sx,
  onKeyDown,
  onKeyUp,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  'aria-describedby': ariaDescribedBy,
  'aria-invalid': ariaInvalidProp,
  ...rest
}: DateRangePickerTriggerProps) {
  const {
    open,
    disabled,
    readOnly,
    required,
    invalid,
    displayValue,
    value,
    startName,
    endName,
    messages,
    contentRef,
    refs,
    getReferenceProps,
    requestOpen,
    resetValue,
    setTriggerLabelling,
    slots,
  } = useDateRangePickerContext('Trigger');
  const Root = slots?.trigger ?? 'button';
  const buttonRef = useRef<HTMLButtonElement>(null);
  const mergedRef = useMergeRefs([refs.setReference, ref, buttonRef]);
  const generatedId = useId();
  const id = idProp ?? generatedId;
  const valueId = `${id}-value`;
  const requiredId = `${id}-required`;
  const errorId = `${id}-error`;
  const hasRequired = required && isRenderable(messages.required);
  const ariaInvalid = invalid || ariaInvalidProp;
  const hasError = (ariaInvalid === true || ariaInvalid === 'true') && isRenderable(messages.error);

  // The dialog reuses the trigger's label so both share one name.
  useLayoutEffect(() => {
    setTriggerLabelling(
      ariaLabelledBy !== undefined ? { labelledBy: ariaLabelledBy } : ariaLabel !== undefined ? { label: ariaLabel } : null,
    );
    return () => setTriggerLabelling(null);
  }, [ariaLabelledBy, ariaLabel, setTriggerLabelling]);

  // Native form reset: an uncontrolled value returns to its default; a controlled one requests it.
  const resetValueRef = useRef(resetValue);
  useEffect(() => {
    resetValueRef.current = resetValue;
  });
  useEffect(() => {
    const form = buttonRef.current?.form;
    if (!form) return;
    const handleReset = () => resetValueRef.current();
    form.addEventListener('reset', handleReset);
    return () => form.removeEventListener('reset', handleReset);
  }, [form]);

  // The name is the consumer's label followed by the committed range (or placeholder);
  // a self reference reads this button's own aria-label.
  const labelSource = ariaLabelledBy ?? (ariaLabel !== undefined ? id : undefined);
  const labelledBy =
    labelSource === undefined ? undefined : [labelSource, valueId, hasRequired ? requiredId : undefined].filter(Boolean).join(' ');
  const describedBy = [ariaDescribedBy, hasError ? errorId : undefined].filter(Boolean).join(' ') || undefined;

  const openOrFocusGrid = () => {
    if (disabled) return;
    if (open) focusTabStopDay(contentRef.current);
    else requestOpen();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    onKeyDown?.(event);
    if (event.defaultPrevented || disabled) return;
    if (event.key === SPACE) {
      // Opening on keyup keeps the keyup from activating the newly focused day.
      event.preventDefault();
      return;
    }
    if (!OPEN_KEYS.has(event.key)) return;
    event.preventDefault();
    openOrFocusGrid();
  };

  const handleKeyUp = (event: KeyboardEvent<HTMLButtonElement>) => {
    onKeyUp?.(event);
    if (event.defaultPrevented || disabled || event.key !== SPACE) return;
    openOrFocusGrid();
  };

  return (
    <>
      <WithSx className={className} styles={[triggerStyle, triggerSizeStyles[size]]} sx={sx}>
        {(className) => (
          <Root
            type="button"
            {...getReferenceProps({ ...rest, onKeyDown: handleKeyDown, onKeyUp: handleKeyUp })}
            ref={mergedRef}
            id={id}
            form={form}
            disabled={disabled}
            aria-label={ariaLabel}
            aria-labelledby={labelledBy}
            aria-describedby={describedBy}
            aria-invalid={ariaInvalid}
            data-ui="date-range-picker"
            data-state={open ? 'open' : 'closed'}
            data-size={size}
            data-readonly={readOnly || undefined}
            data-required={required || undefined}
            className={className}
          >
            {isRenderable(icon) && (
              <span aria-hidden="true" css={iconStyle}>
                {icon}
              </span>
            )}
            {displayValue !== undefined ? (
              <span id={valueId} dir="auto">{displayValue}</span>
            ) : (
              <span id={valueId} dir="auto" data-placeholder="" css={placeholderStyle}>
                {placeholder}
              </span>
            )}
            {hasRequired && (
              <span id={requiredId} hidden>
                {messages.required}
              </span>
            )}
          </Root>
        )}
      </WithSx>
      {hasError && (
        <span id={errorId} role="alert" data-ui="date-range-picker-error" css={errorStyle}>
          {messages.error}
        </span>
      )}
      {startName !== undefined && (
        <input type="hidden" form={form} name={startName} value={value?.start ?? ''} disabled={disabled} />
      )}
      {endName !== undefined && (
        <input type="hidden" form={form} name={endName} value={value?.end ?? ''} disabled={disabled} />
      )}
    </>
  );
}

DateRangePickerTrigger.displayName = 'DateRangePicker.Trigger';

function DateRangePickerContent(props: DateRangePickerContentProps) {
  const { open } = useDateRangePickerContext('Content');
  const presence = useExitPresence<HTMLDivElement>(open);
  // The panel mounts with every open, so each open starts a fresh draft, even one that
  // interrupts the previous panel's exit.
  const [opening, setOpening] = useState({ open, count: 0 });
  if (opening.open !== open) setOpening({ open, count: opening.count + (open ? 1 : 0) });
  return presence.present ? (
    <DateRangePickerPanel key={opening.count} {...props} presenceRef={presence.ref} closing={presence.closing} />
  ) : null;
}

DateRangePickerContent.displayName = 'DateRangePicker.Content';

interface DateRangePickerPanelProps extends DateRangePickerContentProps {
  presenceRef: RefObject<HTMLDivElement | null>;
  closing: boolean;
}

function DateRangePickerPanel({
  ref,
  presenceRef,
  closing,
  dir,
  style,
  className,
  sx,
  slotProps,
  slots: contentSlots,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  'aria-describedby': ariaDescribedBy,
  ...rest
}: DateRangePickerPanelProps) {
  const {
    readOnly,
    value,
    min,
    max,
    locale,
    firstDayOfWeek,
    today,
    months,
    presets,
    messages,
    availableSize,
    triggerLabelling,
    contentRef,
    refs,
    floatingContext,
    floatingStyles,
    getFloatingProps,
    apply,
    cancel,
    slots,
  } = useDateRangePickerContext('Content');
  const Root = slots?.content ?? 'div';
  const Presets = contentSlots?.presets ?? 'div';
  const Calendars = contentSlots?.calendars ?? 'div';
  const Summary = contentSlots?.summary ?? 'span';
  const Actions = contentSlots?.actions ?? 'div';
  const summaryId = useId();
  const formatter = useMemo(() => dateTimeFormatter(locale, RANGE_FORMAT_OPTIONS), [locale]);
  const numberFormat = useMemo(() => numberFormatter(locale), [locale]);

  const isEnabled = (date: string | null | undefined): date is string => date != null && isWithin(date, min, max);
  const hasEnabledDays = min === undefined || max === undefined || min <= max;
  // Initial focus: the draft start, else today, else the first enabled day of today's side.
  const initialFocus = !hasEnabledDays
    ? null
    : isEnabled(value?.start)
      ? value.start
      : max !== undefined && today > max
        ? clampDate(firstOfMonth(monthOf(max)), min, max)
        : clampDate(today, min, max);

  // Draft transaction: `anchored` means one endpoint is chosen and the next activation ends it.
  const [draft, setDraft] = useState<DateRangeValue | null>(value);
  const [anchored, setAnchored] = useState(false);
  const [seenValue, setSeenValue] = useState(value);
  if (!rangesEqual(seenValue, value)) {
    // An external value change rebases the draft without notifying.
    setSeenValue(value);
    setDraft(value);
    setAnchored(false);
  }

  const [focusedDate, setFocusedDate] = useState(initialFocus);
  // The day under a moving pointer; a focus change clears it, so the last input drives the preview.
  const [pointerDate, setPointerDate] = useState<string | null>(null);
  const [focusedPresetId, setFocusedPresetId] = useState<string | null>(null);
  const pendingDayFocusRef = useRef<string | null>(null);

  // Until the first positioning pass reports the boundary, the viewport width stands in.
  const availableWidth = availableSize?.width ?? refs.domReference.current?.ownerDocument.documentElement.clientWidth ?? 0;
  const monthCount = months === 'auto' ? (availableWidth >= TWO_MONTH_MIN_WIDTH ? 2 : 1) : months;
  const [baseMonth, setBaseMonth] = useState(monthOf(initialFocus ?? clampDate(today, min, undefined)));
  const visibleMonths = Array.from({ length: monthCount }, (_, index) => shiftMonth(baseMonth, index));
  const lastMonth = visibleMonths[visibleMonths.length - 1] ?? baseMonth;
  const isShown = (date: string) => monthOf(date) >= baseMonth && monthOf(date) <= lastMonth;

  const reveal = (date: string, count = monthCount) => {
    const month = monthOf(date);
    if (month < baseMonth) setBaseMonth(month);
    else if (month > shiftMonth(baseMonth, count - 1)) setBaseMonth(shiftMonth(month, 1 - count));
  };

  // A layout change keeps the focused day on screen.
  const [seenMonthCount, setSeenMonthCount] = useState(monthCount);
  if (seenMonthCount !== monthCount) {
    setSeenMonthCount(monthCount);
    if (focusedDate !== null) reveal(focusedDate, monthCount);
  }

  // One day tab stop across every shown month.
  const tabStop =
    [focusedDate, draft?.start, today].find((date) => isEnabled(date) && isShown(date)) ??
    visibleMonths.map((month) => clampDate(firstOfMonth(month), min, max)).find((date) => isShown(date) && isEnabled(date)) ??
    null;

  const previewTarget = pointerDate ?? focusedDate;
  const preview = anchored && draft && isEnabled(previewTarget) ? orderedRange(draft.start, previewTarget) : null;
  const summarized = preview ?? draft;

  useEffect(() => {
    const date = pendingDayFocusRef.current;
    if (date === null) return;
    pendingDayFocusRef.current = null;
    const day = contentRef.current?.querySelector<HTMLButtonElement>(`${DAY}[data-date="${date}"]`);
    if (day && day.ownerDocument.activeElement !== day) day.focus();
  });

  // Keyboard moves report a destination to focus; a day's own focus event needs no follow-up.
  const handleFocusedDateChange = (date: string) => {
    setFocusedDate(date);
    setPointerDate(null);
    reveal(date);
    const active = contentRef.current?.ownerDocument.activeElement;
    pendingDayFocusRef.current = active instanceof HTMLElement && active.dataset.date === date ? null : date;
  };

  const activateDay = (date: string) => {
    if (readOnly) return;
    if (anchored && draft) {
      setDraft(orderedRange(draft.start, date));
      setAnchored(false);
    } else {
      setDraft({ start: date, end: date });
      setAnchored(true);
    }
  };

  // pointermove, not pointerover: a day sliding under a resting pointer (month reveal, layout)
  // must not take the preview back from the keyboard.
  const handleGridPointerMove = (event: PointerEvent<HTMLTableElement>) => {
    const day = (event.target as HTMLElement).closest<HTMLButtonElement>(DAY);
    setPointerDate(day && !day.disabled ? (day.dataset.date ?? null) : null);
  };

  const presetItems = presets.map((preset) => {
    const range = preset.range(today);
    const enabled = !readOnly && isAvailableRange(range, min, max);
    return { preset, range, enabled };
  });
  const presetTabStop =
    presetItems.find((item) => item.enabled && item.preset.id === focusedPresetId) ?? presetItems.find((item) => item.enabled);

  const choosePreset = (range: DateRangeValue) => {
    setDraft(range);
    setAnchored(false);
    setFocusedDate(range.start);
    reveal(range.start);
  };

  // Initial focus lands on the day tab stop as the surface attaches (the portal mounts after
  // the first commit); FloatingFocusManager receives the same element.
  const initialFocusRef = useRef<HTMLElement | null>(null);
  const setContentNode = useCallback(
    (node: HTMLDivElement | null) => {
      contentRef.current = node;
      if (node && !initialFocusRef.current) initialFocusRef.current = focusTabStopDay(node);
    },
    [contentRef],
  );
  const mergedRef = useMergeRefs([refs.setFloating, ref, setContentNode, presenceRef]);
  // The trigger's effective direction, which the portal would otherwise lose. Read after the
  // trigger attaches: a surface open on mount renders before the trigger's ref is set.
  const triggerNode = floatingContext.elements.domReference;
  const [triggerDirection, setTriggerDirection] = useState<string>();
  useLayoutEffect(() => {
    setTriggerDirection(triggerNode?.ownerDocument.defaultView?.getComputedStyle(triggerNode).direction);
  }, [triggerNode]);

  const labelling =
    ariaLabelledBy !== undefined || ariaLabel !== undefined
      ? { 'aria-labelledby': ariaLabelledBy, 'aria-label': ariaLabel }
      : triggerLabelling?.labelledBy !== undefined
        ? { 'aria-labelledby': triggerLabelling.labelledBy }
        : { 'aria-label': triggerLabelling?.label };
  const layout = monthCount === 2 && presetItems.length > 0 && availableWidth >= PRESET_RAIL_MIN_WIDTH ? 'rail' : 'row';
  const canApply = !readOnly && isAvailableRange(draft, min, max);

  return (
    <OverlayPortal>
      {/* Non-modal: no trap; Tab-out closes via focus-out. Focus return is explicit (Apply,
          Cancel, Escape), so returnFocus is off and an outside press never moves focus. */}
      <FloatingFocusManager context={floatingContext} modal={false} initialFocus={initialFocusRef} returnFocus={false}>
        <WithSx className={className} styles={contentStyle} sx={sx}>
          {(className) => (
            <Root
              {...getFloatingProps({
                ...labelling,
                'aria-describedby': [ariaDescribedBy, summaryId].filter(Boolean).join(' '),
                ...rest,
              })}
              ref={mergedRef}
              dir={dir ?? triggerDirection}
              data-ui="date-range-picker-content"
              data-layout={layout}
              data-side={floatingContext.placement.split('-')[0]}
              data-state={closing ? 'closing' : 'open'}
              inert={closing}
              aria-hidden={closing || undefined}
              style={{
                ...style,
                ...floatingStyles,
                ...(availableSize && { maxInlineSize: availableSize.width, maxBlockSize: availableSize.height }),
              }}
              className={className}
            >
              {presetItems.length > 0 && (
                <Presets
                  {...withoutSx(slotProps?.presets)}
                  role="group"
                  aria-label={messages.presets}
                  data-ui="date-range-picker-presets"
                  className={slotProps?.presets?.className}
                  css={[presetsStyle, slotProps?.presets?.sx]}
                  onKeyDown={(event) =>
                    moveRovingFocus(event, event.currentTarget, layout === 'rail' ? 'vertical' : 'horizontal', PRESET_QUERY)
                  }
                >
                  {presetItems.map(({ preset, range, enabled }) => (
                    <button
                      key={preset.id}
                      type="button"
                      data-ui="date-range-picker-preset"
                      aria-disabled={!enabled || undefined}
                      aria-pressed={enabled && rangesEqual(range, draft) && !anchored}
                      tabIndex={preset === presetTabStop?.preset ? 0 : -1}
                      onFocus={() => setFocusedPresetId(preset.id)}
                      onClick={() => {
                        if (enabled) choosePreset(range);
                      }}
                      css={presetStyle}
                    >
                      {preset.label}
                    </button>
                  ))}
                </Presets>
              )}
              <Calendars
                {...withoutSx(slotProps?.calendars)}
                data-ui="date-range-picker-calendars"
                className={slotProps?.calendars?.className}
                css={[calendarsStyle, slotProps?.calendars?.sx]}
              >
                {visibleMonths.map((month, index) => (
                  <Calendar
                    // Keyed by position: shifting months keeps each grid (and its focus) mounted.
                    key={index}
                    visibleMonth={month}
                    onVisibleMonthChange={(next) => setBaseMonth(shiftMonth(next, -index))}
                    min={min}
                    max={max}
                    locale={locale}
                    firstDayOfWeek={firstDayOfWeek}
                    today={today}
                    selectionRange={draft}
                    previewRange={preview}
                    tabStopDate={tabStop !== null && monthOf(tabStop) === month ? tabStop : null}
                    onDayActivate={activateDay}
                    onFocusedDateChange={handleFocusedDateChange}
                    rangeLabels={{ start: messages.start, end: messages.end }}
                  >
                    <Calendar.Header />
                    <Calendar.Grid onPointerMove={handleGridPointerMove} onPointerLeave={() => setPointerDate(null)} />
                  </Calendar>
                ))}
              </Calendars>
              <div data-ui="date-range-picker-footer" css={footerStyle}>
                <Summary
                  {...withoutSx(slotProps?.summary)}
                  id={summaryId}
                  dir="auto"
                  role="status"
                  data-ui="date-range-picker-summary"
                  className={slotProps?.summary?.className}
                  css={[summaryStyle, slotProps?.summary?.sx]}
                >
                  {summarized
                    ? messages.summary({
                        range: formatRange(formatter, summarized),
                        days: dayCount(summarized),
                        formattedDays: numberFormat.format(dayCount(summarized)),
                      })
                    : messages.empty}
                </Summary>
                <Actions
                  {...withoutSx(slotProps?.actions)}
                  data-ui="date-range-picker-actions"
                  className={slotProps?.actions?.className}
                  css={[actionsStyle, slotProps?.actions?.sx]}
                >
                  <Button variant="ghost" size="sm" onClick={cancel}>
                    {messages.cancel}
                  </Button>
                  <Button
                    tone="accent"
                    size="sm"
                    disabled={!canApply}
                    onClick={() => {
                      if (canApply) apply(draft);
                    }}
                  >
                    {messages.apply}
                  </Button>
                </Actions>
              </div>
            </Root>
          )}
        </WithSx>
      </FloatingFocusManager>
    </OverlayPortal>
  );
}

export const DateRangePicker = Object.assign(DateRangePickerRoot, {
  Trigger: DateRangePickerTrigger,
  Content: DateRangePickerContent,
});
