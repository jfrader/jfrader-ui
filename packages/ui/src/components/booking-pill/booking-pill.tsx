'use client';

import {
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ComponentPropsWithRef,
  type ReactNode,
} from 'react';
import { useMergeRefs } from '@floating-ui/react';
import { motion, MotionConfig, useReducedMotionConfig } from 'motion/react';
import { vars } from '@jfrader/tokens/vars';
import { css, type SerializedStyles } from '../../styling/css';
import { disclosureCaret } from '../../styling/disclosure-caret';
import { focusRingInset } from '../../styling/focus-ring';
import { FORCED_COLORS, REDUCED_MOTION } from '../../styling/media';
import { motionDurationMs } from '../../styling/motion-timings';
import type { SxProps } from '../../styling/sx';
import { visuallyHiddenStyle } from '../../styling/visually-hidden';
import { dateTimeFormatter } from '../../utils/intl';
import { isRenderable } from '../../utils/renderable';
import { useControlledState } from '../../utils/use-controlled-state';
import { useReducedMotion } from '../../utils/use-reduced-motion';
import { ButtonGroup, type ButtonGroupItemProps } from '../button-group';
import { Calendar, type CalendarProps } from '../calendar';
import {
  dateFromIso,
  isIsoDate,
  isWithin,
  shiftDays,
  CIVIL_DATE_FORMAT_OPTIONS,
} from '../calendar/calendar.utils';
import {
  FieldSlot,
  type FieldSlots,
  type FieldParts,
} from '../field/field-slot';
import { moneyFormat } from '../money-input/money-math';
import { Pill } from '../pill';
import { Select, type SelectItemProps } from '../select';
import { Spinner } from '../spinner';
import { TimePicker, type TimePickerProps } from '../time-picker';
import { minutes } from '../time-picker/time-picker';

export type BookingPillStep = 'party' | 'date' | 'time' | 'review';
export type BookingPillStatus = 'idle' | 'pending' | 'success' | 'error' | 'cancelled';
export type BookingPillSize = 'sm' | 'md';
export interface BookingDraft {
  partySize: number;
  date: string;
  time: string | null;
}
export interface Booking extends BookingDraft {
  time: string;
}
export interface BookingPrice {
  /** Integer amount in the currency's minor units, for example `4500` for £45.00. */
  amount: number;
  /** ISO 4217 currency code, for example `GBP`. */
  currency: string;
}
export interface BookingPillLabels {
  trigger: (draft: BookingDraft, open: boolean) => ReactNode;
  stepParty: string;
  stepDate: string;
  stepTime: string;
  stepReview: string;
  stepBooked: string;
  stepCancelled: string;
  decreaseParty: string;
  increaseParty: string;
  partyCount: (count: number) => string;
  back: string;
  next: string;
  confirm: string;
  confirming: string;
  cancel: string;
  cancelling: string;
  newBooking: string;
  unavailable: string;
  noAvailability: string;
  selectTime: string;
  venue: string;
  party: string;
  date: string;
  time: string;
  price: string;
  statusPending: string;
  statusBooked: string;
  statusCancelled: string;
  errorFallback: (error: unknown) => string;
  cancelErrorFallback: (error: unknown) => string;
  stepStatus: (step: string) => string;
}
type Anatomy = {
  root: 'div';
  trigger: 'button';
  content: 'div';
  /** Renders an `h3` by default. */
  title: 'h3';
  description: 'p';
  back: 'button';
  next: 'button';
  confirm: 'button';
  error: 'p';
  status: 'span';
};
export type BookingPillSlots = FieldSlots<Anatomy>;
export type BookingPillSlotProps = FieldParts<Anatomy>;
type CalendarOverrides = Omit<
  CalendarProps,
  | 'value'
  | 'defaultValue'
  | 'onValueChange'
  | 'min'
  | 'max'
  | 'locale'
  | 'children'
  | 'selectionRange'
  | 'previewRange'
>;
type TimeOverrides = Omit<
  TimePickerProps,
  | 'value'
  | 'defaultValue'
  | 'onValueChange'
  | 'min'
  | 'max'
  | 'disabled'
  | 'locale'
  | 'hourCycle'
  | 'minuteStep'
>;
export interface BookingPillProps
  extends
    Omit<
      ComponentPropsWithRef<'div'>,
      'children' | 'defaultValue' | 'onChange'
    >,
    SxProps {
  /** Names the venue in the trigger and booking summary. */
  venue: string;
  /** Adds venue details beneath the current step title. */
  venueDetail?: ReactNode;
  /** Shows a price in the trigger and booking summary, formatted for `locale`. */
  price?: BookingPrice;
  /** Sets the pill height, text size and action size. `sm` matches small buttons. Defaults to `md`. */
  size?: BookingPillSize;
  /** Controls the party size, date and selected time. */
  value?: BookingDraft;
  /** Seeds the draft and reset target. Defaults to two guests within the party bounds, `startDate` and the first available time. */
  defaultValue?: BookingDraft;
  /** Receives draft changes, including clearing a time that becomes unavailable. */
  onValueChange?: (draft: BookingDraft) => void;
  /** Controls whether the booking steps are expanded. */
  open?: boolean;
  /** Initially expands the uncontrolled booking steps. Defaults to `false`. */
  defaultOpen?: boolean;
  /** Receives requests to expand or collapse the booking steps. */
  onOpenChange?: (open: boolean) => void;
  /** Controls the displayed booking step. */
  step?: BookingPillStep;
  /** Sets the initial uncontrolled step. Defaults to `party`. */
  defaultStep?: BookingPillStep;
  /** Receives step navigation and reset requests. */
  onStepChange?: (step: BookingPillStep) => void;
  /** Sets the first bookable civil date in `YYYY-MM-DD` format. Invalid dates throw. */
  startDate: string;
  /** Sets the number of bookable days including `startDate`. Defaults to 21. Must be a positive integer. */
  days?: number;
  /** Supplies sorted, unique bookable times in `HH:mm` format. Invalid or unordered entries throw. */
  times: readonly string[];
  /** Seeds the selected time when listed and available. Otherwise the first available time is used. */
  preferredTime?: string;
  /** Checks availability for a date, time and party size. Defaults to allowing every listed time. */
  isAvailable?: (date: string, time: string, partySize: number) => boolean;
  /** Sets the smallest party size. Defaults to 1. Must be a positive integer. */
  minPartySize?: number;
  /** Sets the largest party size. Defaults to 12. Must be an integer at least `minPartySize`. */
  maxPartySize?: number;
  /** Confirms a valid booking. Resolution shows the receipt; rejection shows an error. */
  onConfirm: (booking: Booking) => void | Promise<void>;
  /** Cancels a confirmed booking from its receipt. Resolution marks it cancelled; rejection keeps it booked with an error. Omit to hide the cancel action. */
  onCancel?: (booking: Booking) => void | Promise<void>;
  /** Runs after requesting the initial draft and `party` step for a new booking. */
  onReset?: () => void;
  /** Sets the locale for dates, times, prices and guest counts. */
  locale?: string;
  /** Sets 12- or 24-hour time display. Defaults to the locale's hour cycle. */
  hourCycle?: 'h12' | 'h23';
  /** Overrides booking labels, summaries and feedback messages. */
  labels?: Partial<BookingPillLabels>;
  /** Prevents opening, editing, navigation and confirmation. Defaults to `false`. */
  disabled?: boolean;
  /** Configures the calendar without overriding booking-owned dates or selection. */
  calendarProps?: CalendarOverrides;
  /** Configures the time picker without overriding booking-owned selection or availability. */
  timePickerProps?: TimeOverrides;
  /** Replaces booking parts. */
  slots?: BookingPillSlots;
  /** Passes props to booking parts. */
  slotProps?: BookingPillSlotProps;
  /** Replaces the root element. `slots.root` takes precedence. */
  component?: BookingPillSlots['root'];
}
type Operation = 'confirm' | 'cancel';
const STEP_ORDER: readonly BookingPillStep[] = [
  'party',
  'date',
  'time',
  'review',
];
const FACE_SPRING = {
  type: 'spring',
  bounce: 0.12,
  visualDuration: motionDurationMs.slow / 1000,
} as const;
const NARROW_QUERY = '@container booking-pill (max-width: 22rem)';
const ALL_AVAILABLE = () => true;
const DEFAULT_LABELS: Omit<BookingPillLabels, 'partyCount' | 'trigger'> = {
  stepParty: 'Party size',
  stepDate: 'Select date',
  stepTime: 'Select time',
  stepReview: 'Review booking',
  stepBooked: 'Booking confirmed',
  stepCancelled: 'Booking cancelled',
  decreaseParty: 'Decrease party size',
  increaseParty: 'Increase party size',
  back: 'Back',
  next: 'Next',
  confirm: 'Confirm booking',
  confirming: 'Confirming...',
  cancel: 'Cancel booking',
  cancelling: 'Cancelling...',
  newBooking: 'New booking',
  unavailable: 'Unavailable',
  noAvailability: 'No available times for this date.',
  selectTime: 'Select a time',
  venue: 'Venue',
  party: 'Party',
  date: 'Date',
  time: 'Time',
  price: 'Price',
  statusPending: 'Confirming',
  statusBooked: 'Booked',
  statusCancelled: 'Cancelled',
  errorFallback: () => 'Could not confirm this booking. Try another time.',
  cancelErrorFallback: () => 'Could not cancel this booking. Try again.',
  stepStatus: (title) => `Step: ${title}`,
};
const checkGlyph = (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden data-glyph="check">
    <path d="m3.5 8.5 3 3 6-7" />
  </svg>
);
const crossGlyph = (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden data-glyph="cross">
    <path d="m4.5 4.5 7 7m0-7-7 7" />
  </svg>
);
const minusGlyph = (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3.5 8h9" />
  </svg>
);
const plusGlyph = (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3.5 8h9M8 3.5v9" />
  </svg>
);
// The pill and its panel share one radius: at the closed height it reads as a full stadium, and
// opening only grows the box downward instead of swapping corners.
const rootStyle = css({
  boxSizing: 'border-box',
  display: 'grid',
  gridTemplateRows: 'auto 0fr',
  inlineSize: '100%',
  maxInlineSize: '28rem',
  minInlineSize: 0,
  containerType: 'inline-size',
  containerName: 'booking-pill',
  border: `1px solid ${vars.color.borderControl}`,
  borderRadius: vars.radius.xl,
  backgroundColor: vars.color.surfaceRaised,
  boxShadow: vars.shadow.raised,
  color: vars.color.text,
  fontFamily: vars.font.sans,
  fontSize: vars.textSize.sm,
  lineHeight: vars.lineHeight.base,
  transitionProperty: 'grid-template-rows, box-shadow',
  transitionDuration: vars.motion.duration.slow,
  transitionTimingFunction: vars.motion.easeStandard,
  '&[data-state="open"]': {
    gridTemplateRows: 'auto 1fr',
    boxShadow: vars.shadow.overlay,
  },
  '&[data-reduced-motion]': { transitionDuration: '0s' },
  [REDUCED_MOTION]: { transitionDuration: '0s' },
  [FORCED_COLORS]: { borderColor: 'CanvasText', boxShadow: 'none' },
});
const triggerStyle = css({
  boxSizing: 'border-box',
  display: 'flex',
  alignItems: 'center',
  gap: vars.space[3],
  inlineSize: '100%',
  minInlineSize: 0,
  margin: 0,
  border: 0,
  borderRadius: 'inherit',
  backgroundColor: 'transparent',
  color: 'inherit',
  font: 'inherit',
  textAlign: 'start',
  cursor: 'pointer',
  transitionProperty: 'background-color',
  transitionDuration: vars.motion.duration.fast,
  transitionTimingFunction: vars.motion.easeStandard,
  '&:hover:not(:disabled)': { backgroundColor: vars.color.surfaceHover },
  '&:focus-visible': focusRingInset,
  '&:disabled': { cursor: 'not-allowed' },
  '&[aria-expanded="true"]': { borderEndStartRadius: 0, borderEndEndRadius: 0 },
  '&::after': {
    ...disclosureCaret,
    alignSelf: 'center',
    color: vars.color.textMuted,
    transform: 'rotate(90deg)',
  },
  '&[aria-expanded="true"]::after': { transform: 'rotate(-90deg)' },
  '&:dir(rtl)::after': { transform: 'rotate(-90deg)' },
  '&:dir(rtl)[aria-expanded="true"]::after': { transform: 'rotate(90deg)' },
  '[data-reduced-motion] > &, [data-reduced-motion] > &::after': { transitionDuration: '0s' },
  [REDUCED_MOTION]: { '&, &::after': { transitionDuration: '0s' } },
  [FORCED_COLORS]: { '&:focus-visible': { outlineColor: 'Highlight' } },
});
const triggerSizeStyles: Record<BookingPillSize, SerializedStyles> = {
  sm: css({ minBlockSize: vars.space[10], paddingInline: vars.space[4] }),
  md: css({ minBlockSize: vars.space[12], paddingInline: vars.space[5] }),
};
const lineStyle = css({
  display: 'flex',
  alignItems: 'baseline',
  gap: vars.space[2],
  flex: 1,
  minInlineSize: 0,
  whiteSpace: 'nowrap',
});
const primaryTextStyles: Record<BookingPillSize, SerializedStyles> = {
  sm: css({ fontSize: vars.textSize.sm }),
  md: css({ fontSize: vars.textSize.md }),
};
const secondaryTextStyles: Record<BookingPillSize, SerializedStyles> = {
  sm: css({ fontSize: vars.textSize.xs }),
  md: css({ fontSize: vars.textSize.sm }),
};
const actionStyle = css({
  flexShrink: 0,
  fontWeight: vars.fontWeight.semibold,
  '&[data-cancelled]': { textDecorationLine: 'line-through', color: vars.color.textMuted },
  [NARROW_QUERY]: { flexShrink: 1, minInlineSize: 0, overflow: 'clip', textOverflow: 'ellipsis' },
});
const venueStyle = css({
  flex: 1,
  minInlineSize: 0,
  overflow: 'clip',
  textOverflow: 'ellipsis',
  color: vars.color.textMuted,
  [NARROW_QUERY]: visuallyHiddenStyle,
});
const priceStyle = css({
  flexShrink: 0,
  marginInlineStart: 'auto',
  fontWeight: vars.fontWeight.medium,
  fontVariantNumeric: 'tabular-nums',
});
const statusPillStyle = css({
  flexShrink: 0,
  gap: vars.space[1],
  '& svg': { inlineSize: '1em', blockSize: '1em' },
});
const contentStyle = css({
  minBlockSize: 0,
  overflow: 'clip',
  visibility: 'hidden',
  transitionProperty: 'visibility',
  transitionDuration: '0s',
  transitionDelay: vars.motion.duration.slow,
  '[data-state="open"] > &': { visibility: 'visible', transitionDelay: '0s' },
  '[data-reduced-motion] > &': { transitionDelay: '0s' },
  [REDUCED_MOTION]: { transitionDelay: '0s' },
});
const faceStyle = css({
  minInlineSize: 0,
  [REDUCED_MOTION]: { transform: 'none !important' },
});
const stackStyle = css({
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr)',
  gap: vars.space[4],
  minInlineSize: 0,
  marginInline: vars.space[4],
  paddingBlock: vars.space[4],
  borderBlockStart: `1px solid ${vars.color.border}`,
  [FORCED_COLORS]: { borderBlockStartColor: 'CanvasText' },
});
const titleStyle = css({
  margin: 0,
  fontSize: vars.textSize.lg,
  fontWeight: vars.fontWeight.semibold,
  lineHeight: vars.lineHeight.tight,
  overflowWrap: 'anywhere',
  borderRadius: vars.radius.sm,
  '&:focus-visible': { outline: `2px solid ${vars.color.focusRing}`, outlineOffset: vars.space[1] },
});
const rowStyle = css({
  display: 'flex',
  alignItems: 'baseline',
  flexWrap: 'wrap',
  justifyContent: 'space-between',
  gap: vars.space[3],
});
const actionsStyle = css({
  display: 'flex',
  justifyContent: 'flex-end',
});
const mutedStyle = css({ color: vars.color.textMuted, margin: 0, overflowWrap: 'anywhere' });
const ticketStyle = css({
  display: 'grid',
  gap: vars.space[2],
  margin: 0,
  padding: vars.space[4],
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.md,
  backgroundColor: vars.color.surface,
  overflowWrap: 'anywhere',
  '[data-step="cancelled"] &': { textDecorationLine: 'line-through' },
  [FORCED_COLORS]: { borderColor: 'CanvasText' },
});
const ticketValueStyle = css({ fontVariantNumeric: 'tabular-nums', textAlign: 'end' });
const partyCountStyle = css({ minInlineSize: `calc(${vars.space[12]} * 2)`, fontVariantNumeric: 'tabular-nums' });
const errorStyle = css({ margin: 0, color: vars.color.dangerText });
const optionStyle = css({
  display: 'flex',
  flexWrap: 'wrap',
  gap: vars.space[2],
});

type TimeContextValue = {
  available: (time: string) => boolean;
  unavailable: string;
  option?: NonNullable<TimePickerProps['slots']>['option'];
};
const TimeContext = createContext<TimeContextValue | null>(null);
function BookingTimeOption(props: SelectItemProps) {
  const context = useContext(TimeContext)!;
  const Option = context.option ?? Select.Item;
  const available = context.available(props.value);
  return (
    <Option {...props} disabled={props.disabled || !available}>
      <span css={optionStyle}>
        {props.children}
        {!available && <span>({context.unavailable})</span>}
      </span>
    </Option>
  );
}
BookingTimeOption.displayName = 'BookingPill.TimeOption';

// Default renderers for the replaceable action buttons: a slot receives native button props, and
// `aria-busy` becomes the group button's loading spinner.
function BookingAction({ 'aria-busy': busy, ...props }: ButtonGroupItemProps) {
  return <ButtonGroup.Item {...props} loading={busy === true || busy === 'true'} />;
}
BookingAction.displayName = 'BookingPill.Action';
function BookingPrimaryAction(props: ButtonGroupItemProps) {
  return <BookingAction {...props} variant="solid" tone="accent" />;
}
BookingPrimaryAction.displayName = 'BookingPill.PrimaryAction';

export function BookingPill({
  venue,
  venueDetail,
  price,
  size = 'md',
  value,
  defaultValue,
  onValueChange,
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  step: stepProp,
  defaultStep = 'party',
  onStepChange,
  startDate,
  days = 21,
  times,
  preferredTime,
  isAvailable = ALL_AVAILABLE,
  minPartySize = 1,
  maxPartySize = 12,
  onConfirm,
  onCancel,
  onReset,
  locale,
  hourCycle,
  labels: customLabels,
  disabled = false,
  calendarProps,
  timePickerProps,
  slots,
  slotProps,
  component,
  className,
  sx,
  ref,
  ...rest
}: BookingPillProps) {
  if (
    !isIsoDate(startDate) ||
    !Number.isInteger(days) ||
    days < 1 ||
    !Number.isInteger(minPartySize) ||
    !Number.isInteger(maxPartySize) ||
    minPartySize < 1 ||
    maxPartySize < minPartySize ||
    (price !== undefined && !Number.isSafeInteger(price.amount)) ||
    times.some(
      (time, index) =>
        minutes(time) === undefined || (index > 0 && time <= times[index - 1]!),
    )
  )
    throw new Error(
      'BookingPill requires a civil startDate, positive integer days/party bounds, an integer minor-unit price and ordered unique HH:mm times',
    );
  const contentId = useId();
  const titleId = useId();
  const errorId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const mergedRef = useMergeRefs([ref, rootRef]);
  const deviceReduced = useReducedMotion();
  const forcedReduced = useReducedMotionConfig();
  const reduced = Boolean(deviceReduced) || forcedReduced === true;
  const initialParty = Math.min(Math.max(2, minPartySize), maxPartySize);
  const seed = useRef(
    defaultValue ?? {
      partySize: initialParty,
      date: startDate,
      time:
        preferredTime &&
        times.includes(preferredTime) &&
        isAvailable(startDate, preferredTime, initialParty)
          ? preferredTime
          : (times.find((time) => isAvailable(startDate, time, initialParty)) ??
            null),
    },
  ).current;
  const [draft = seed, requestDraft] = useControlledState(
    value,
    seed,
    onValueChange,
  );
  const [open = false, requestOpen] = useControlledState(
    openProp,
    defaultOpen,
    onOpenChange,
  );
  const [step = 'party', requestStep] = useControlledState(
    stepProp,
    defaultStep,
    onStepChange,
  );
  const [status, setStatus] = useState<BookingPillStatus>('idle');
  const [operation, setOperation] = useState<Operation>('confirm');
  const [error, setError] = useState<unknown>();
  const [receipt, setReceipt] = useState<Booking | null>(null);
  const generation = useRef(0);
  const pending = useRef(false);
  const focusIntent = useRef<HTMLElement | null>(null);
  const closeIntent = useRef(false);
  const maxDate = shiftDays(startDate, days - 1);
  const numbers = new Intl.NumberFormat(locale);
  const plurals = new Intl.PluralRules(locale);
  const labels: BookingPillLabels = {
    ...DEFAULT_LABELS,
    partyCount: (count) =>
      `${numbers.format(count)} ${plurals.select(count) === 'one' ? 'guest' : 'guests'}`,
    trigger: (draft) => `Book for ${numbers.format(draft.partySize)}`,
    ...customLabels,
  };
  const titles = {
    party: labels.stepParty,
    date: labels.stepDate,
    time: labels.stepTime,
    review: labels.stepReview,
  };
  const validParty =
    Number.isInteger(draft.partySize) &&
    draft.partySize >= minPartySize &&
    draft.partySize <= maxPartySize;
  const validDate =
    isIsoDate(draft.date) && isWithin(draft.date, startDate, maxDate);
  const available = (time: string) =>
    times.includes(time) && isAvailable(draft.date, time, draft.partySize);
  const validTime = draft.time !== null && available(draft.time);
  const minuteStep = ([30, 15, 10, 5, 1] as const).find((step) =>
    times.every((time) => minutes(time)! % step === 0),
  )!;
  const valid = validParty && validDate && validTime;
  const canNext = {
    party: validParty,
    date: validParty && validDate,
    time: valid,
    review: valid,
  }[step];
  const blocked = disabled || status === 'pending';
  const settled = status === 'success' || status === 'cancelled' || (status === 'pending' && operation === 'cancel');
  const face = settled ? (status === 'cancelled' ? 'cancelled' : 'booked') : step;
  const shown = receipt ?? draft;
  const formattedDate = isIsoDate(shown.date)
    ? dateTimeFormatter(locale, {
        ...CIVIL_DATE_FORMAT_OPTIONS,
        dateStyle: 'long',
      }).format(dateFromIso(shown.date))
    : shown.date;
  const timeMinutes = shown.time === null ? undefined : minutes(shown.time);
  const formattedTime =
    timeMinutes === undefined
      ? labels.selectTime
      : dateTimeFormatter(locale, {
          timeZone: 'UTC',
          hour: 'numeric',
          minute: '2-digit',
          hourCycle,
        }).format(new Date(timeMinutes * 60_000));
  const formattedSlot =
    receipt && isIsoDate(receipt.date)
      ? dateTimeFormatter(locale, {
          ...CIVIL_DATE_FORMAT_OPTIONS,
          weekday: 'short',
          day: 'numeric',
          month: 'short',
          hour: 'numeric',
          minute: '2-digit',
          hourCycle,
        }).format(new Date(dateFromIso(receipt.date).getTime() + minutes(receipt.time)! * 60_000))
      : null;
  const formattedPrice = price ? moneyFormat(locale, price.currency, 'symbol').format(price.amount) : null;
  const faceTitle = face === 'booked' ? labels.stepBooked : face === 'cancelled' ? labels.stepCancelled : titles[face];
  const statusPill =
    status === 'pending' ? (
      <Pill tone="neutral" css={statusPillStyle} data-status="pending">
        <Spinner size="sm" decorative />
        {operation === 'cancel' ? labels.cancelling : labels.statusPending}
      </Pill>
    ) : status === 'success' ? (
      <Pill tone="success" css={statusPillStyle} data-status="booked">
        {checkGlyph}
        {labels.statusBooked}
      </Pill>
    ) : status === 'cancelled' ? (
      <Pill tone="neutral" css={statusPillStyle} data-status="cancelled">
        {crossGlyph}
        {labels.statusCancelled}
      </Pill>
    ) : null;

  useEffect(
    () => () => {
      generation.current++;
      pending.current = false;
    },
    [],
  );
  useEffect(() => {
    const intent = focusIntent.current;
    if (intent) {
      const doc = intent.ownerDocument;
      if (doc.activeElement === intent || doc.activeElement === doc.body) {
        if (!open && closeIntent.current) triggerRef.current?.focus();
        else if (open) {
          if (status === 'success' || status === 'cancelled') titleRef.current?.focus();
          else
            contentRef.current
              ?.querySelector<HTMLElement>(
                'button:not(:disabled):not([tabindex="-1"]), input:not(:disabled)',
              )
              ?.focus();
        }
      }
    }
    focusIntent.current = null;
    closeIntent.current = false;
  }, [open, face]);
  function rememberFocus() {
    const active = rootRef.current?.ownerDocument.activeElement;
    focusIntent.current =
      active instanceof HTMLElement && rootRef.current?.contains(active)
        ? active
        : null;
  }
  function navigate(next: BookingPillStep) {
    if (!blocked) {
      rememberFocus();
      requestStep(next);
    }
  }
  function close() {
    if (!blocked) {
      rememberFocus();
      closeIntent.current = true;
      requestOpen(false);
    }
  }
  function patchDraft(patch: Partial<BookingDraft>) {
    if (blocked) return;
    const next = { ...draft, ...patch };
    if (
      next.time !== null &&
      (!times.includes(next.time) ||
        !isAvailable(next.date, next.time, next.partySize))
    )
      next.time = null;
    if (
      next.partySize !== draft.partySize ||
      next.date !== draft.date ||
      next.time !== draft.time
    )
      requestDraft(next);
  }
  async function run(kind: Operation, booking: Booking, request: (booking: Booking) => void | Promise<void>) {
    pending.current = true;
    const token = ++generation.current;
    rememberFocus();
    setOperation(kind);
    setStatus('pending');
    setError(undefined);
    try {
      await request(booking);
      if (generation.current === token) {
        setReceipt(booking);
        setStatus(kind === 'confirm' ? 'success' : 'cancelled');
      }
    } catch (reason) {
      if (generation.current === token) {
        setError(reason);
        setStatus(kind === 'confirm' ? 'error' : 'success');
      }
    } finally {
      if (generation.current === token) pending.current = false;
    }
  }
  function confirm() {
    if (blocked || pending.current || !valid || draft.time === null) return;
    void run('confirm', { ...draft, time: draft.time }, onConfirm);
  }
  function cancel() {
    if (blocked || pending.current || !receipt || !onCancel) return;
    void run('cancel', receipt, onCancel);
  }
  function reset() {
    if (blocked) return;
    generation.current++;
    rememberFocus();
    setStatus('idle');
    setOperation('confirm');
    setError(undefined);
    setReceipt(null);
    requestDraft({ ...seed });
    requestStep('party');
    onReset?.();
  }
  const failed = error !== undefined && status !== 'pending';
  return (
    <FieldSlot
      element="div"
      root
      component={slots?.root ?? component}
      slotProps={slotProps?.root}
      {...rest}
      ref={mergedRef}
      styles={rootStyle}
      sx={sx}
      className={className}
      data-ui="booking-pill"
      data-state={open ? 'open' : 'closed'}
      data-step={face}
      data-size={size}
      data-status={status}
      data-reduced-motion={reduced || undefined}
      behavior={{
        onKeyDown: (event) => {
          if (
            event.defaultPrevented ||
            event.key !== 'Escape' ||
            !open ||
            blocked
          )
            return;
          event.preventDefault();
          const index = STEP_ORDER.indexOf(step);
          if (!settled && index > 0) navigate(STEP_ORDER[index - 1]!);
          else close();
        },
      }}
    >
      <FieldSlot
        element="button"
        component={slots?.trigger}
        slotProps={slotProps?.trigger}
        ref={triggerRef}
        type="button"
        styles={[triggerStyle, triggerSizeStyles[size]]}
        disabled={blocked}
        aria-expanded={open}
        aria-controls={contentId}
        behavior={{
          onClick: (event) => {
            if (!event.defaultPrevented && !blocked) {
              if (open) close();
              else {
                rememberFocus();
                requestOpen(true);
              }
            }
          },
        }}
      >
        <span css={lineStyle} data-ui="booking-pill-line">
          {statusPill}
          <span
            css={[actionStyle, primaryTextStyles[size]]}
            data-ui="booking-pill-action"
            data-cancelled={status === 'cancelled' || undefined}
          >
            {formattedSlot ?? labels.trigger(draft, open)}
          </span>
          <span css={[venueStyle, secondaryTextStyles[size]]} data-ui="booking-pill-venue">
            {venue}
          </span>
          {formattedPrice !== null && (
            <span css={[priceStyle, primaryTextStyles[size]]} data-ui="booking-pill-price">
              {formattedPrice}
            </span>
          )}
        </span>
      </FieldSlot>
      <FieldSlot
        element="div"
        component={slots?.content}
        slotProps={slotProps?.content}
        ref={contentRef}
        id={contentId}
        role="group"
        aria-labelledby={titleId}
        styles={contentStyle}
        aria-describedby={
          [rest['aria-describedby'], failed && errorId]
            .filter(Boolean)
            .join(' ') || undefined
        }
      >
        <MotionConfig reducedMotion={reduced ? 'always' : 'user'}>
          <motion.div
            css={faceStyle}
            layout={reduced ? false : 'size'}
            transition={reduced ? { duration: 0 } : { layout: FACE_SPRING }}
          >
            <div css={stackStyle}>
              <FieldSlot
                element="h3"
                component={slots?.title}
                slotProps={slotProps?.title}
                id={titleId}
                ref={titleRef}
                styles={titleStyle}
                tabIndex={-1}
              >
                {faceTitle}
              </FieldSlot>
              {isRenderable(venueDetail) && (
                <FieldSlot
                  element="p"
                  component={slots?.description}
                  slotProps={slotProps?.description}
                  styles={mutedStyle}
                >
                  {venueDetail}
                </FieldSlot>
              )}
              {settled || step === 'review' ? (
                <div css={ticketStyle} data-ui="booking-pill-ticket">
                  {[
                    [labels.venue, venue],
                    [labels.party, labels.partyCount(shown.partySize)],
                    [labels.date, formattedDate],
                    [labels.time, formattedTime],
                    ...(formattedPrice !== null ? [[labels.price, formattedPrice]] : []),
                  ].map(([name, text]) => (
                    <div key={name} css={rowStyle}>
                      <span css={mutedStyle}>{name}</span>
                      <span css={ticketValueStyle}>{text}</span>
                    </div>
                  ))}
                </div>
              ) : step === 'party' ? (
                <ButtonGroup size={size} aria-label={labels.party} disabled={blocked}>
                  <ButtonGroup.Item
                    aria-label={labels.decreaseParty}
                    startIcon={minusGlyph}
                    disabled={draft.partySize <= minPartySize}
                    onClick={() =>
                      patchDraft({ partySize: draft.partySize - 1 })
                    }
                  />
                  <ButtonGroup.Label css={partyCountStyle}>
                    <output>{labels.partyCount(draft.partySize)}</output>
                  </ButtonGroup.Label>
                  <ButtonGroup.Item
                    aria-label={labels.increaseParty}
                    startIcon={plusGlyph}
                    disabled={draft.partySize >= maxPartySize}
                    onClick={() =>
                      patchDraft({ partySize: draft.partySize + 1 })
                    }
                  />
                </ButtonGroup>
              ) : step === 'date' ? (
                <div inert={blocked || undefined}>
                  <Calendar
                    {...calendarProps}
                    value={draft.date}
                    onValueChange={(date) => patchDraft({ date })}
                    min={startDate}
                    max={maxDate}
                    locale={locale}
                  />
                </div>
              ) : (
                <TimeContext
                  value={{
                    available,
                    unavailable: labels.unavailable,
                    option: timePickerProps?.slots?.option,
                  }}
                >
                  <TimePicker
                    {...timePickerProps}
                    value={draft.time ?? ''}
                    onValueChange={(time) => {
                      if (available(time)) patchDraft({ time });
                    }}
                    min={times[0]}
                    max={times[times.length - 1]}
                    minuteStep={minuteStep}
                    locale={locale}
                    hourCycle={hourCycle}
                    label={timePickerProps?.label ?? labels.stepTime}
                    placeholder={labels.selectTime}
                    disabled={blocked || !times.length}
                    slots={{
                      ...timePickerProps?.slots,
                      option: BookingTimeOption,
                    }}
                  />
                  {!times.some(available) && (
                    <p css={mutedStyle}>{labels.noAvailability}</p>
                  )}
                </TimeContext>
              )}
              {failed && (
                <FieldSlot
                  element="p"
                  component={slots?.error}
                  slotProps={slotProps?.error}
                  id={errorId}
                  role="alert"
                  styles={errorStyle}
                >
                  {status === 'success'
                    ? labels.cancelErrorFallback(error)
                    : labels.errorFallback(error)}
                </FieldSlot>
              )}
              <div css={actionsStyle}>
                {settled ? (
                  <ButtonGroup size={size}>
                    {onCancel && status !== 'cancelled' && (
                      <BookingAction
                        tone="danger"
                        disabled={disabled}
                        aria-disabled={blocked || undefined}
                        aria-busy={status === 'pending' || undefined}
                        onClick={cancel}
                      >
                        {status === 'pending' ? labels.cancelling : labels.cancel}
                      </BookingAction>
                    )}
                    <BookingPrimaryAction disabled={blocked} onClick={reset}>
                      {labels.newBooking}
                    </BookingPrimaryAction>
                  </ButtonGroup>
                ) : (
                  <ButtonGroup size={size}>
                    {step !== 'party' && (
                      <FieldSlot
                        element="button"
                        component={slots?.back ?? BookingAction}
                        slotProps={slotProps?.back}
                        type="button"
                        disabled={blocked}
                        behavior={{
                          onClick: (event) => {
                            if (!event.defaultPrevented)
                              navigate(
                                STEP_ORDER[STEP_ORDER.indexOf(step) - 1]!,
                              );
                          },
                        }}
                      >
                        {labels.back}
                      </FieldSlot>
                    )}
                    {step !== 'review' ? (
                      <FieldSlot
                        element="button"
                        component={slots?.next ?? BookingPrimaryAction}
                        slotProps={slotProps?.next}
                        type="button"
                        disabled={blocked || !canNext}
                        behavior={{
                          onClick: (event) => {
                            if (!event.defaultPrevented && canNext)
                              navigate(
                                STEP_ORDER[STEP_ORDER.indexOf(step) + 1]!,
                              );
                          },
                        }}
                      >
                        {labels.next}
                      </FieldSlot>
                    ) : (
                      <FieldSlot
                        element="button"
                        component={slots?.confirm ?? BookingPrimaryAction}
                        slotProps={slotProps?.confirm}
                        type="button"
                        disabled={disabled || (!valid && status !== 'pending')}
                        // Pending keeps the button focusable (busy) while aria-disabled reports why it cannot confirm.
                        aria-disabled={blocked || !valid}
                        aria-busy={status === 'pending' || undefined}
                        behavior={{
                          onClick: (event) => {
                            if (!event.defaultPrevented) confirm();
                          },
                        }}
                      >
                        {status === 'pending'
                          ? labels.confirming
                          : labels.confirm}
                      </FieldSlot>
                    )}
                  </ButtonGroup>
                )}
              </div>
            </div>
          </motion.div>
        </MotionConfig>
      </FieldSlot>
      <FieldSlot
        element="span"
        component={slots?.status}
        slotProps={slotProps?.status}
        role="status"
        aria-atomic="true"
        styles={visuallyHiddenStyle}
      >
        {open ? labels.stepStatus(faceTitle) : ''}
      </FieldSlot>
    </FieldSlot>
  );
}
BookingPill.displayName = 'BookingPill';
