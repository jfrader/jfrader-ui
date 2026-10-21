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
import { motion, MotionConfig } from 'motion/react';
import { vars } from '@jfrader/tokens/vars';
import { css } from '../../styling/css';
import { focusRingInset, focusRingOutset } from '../../styling/focus-ring';
import { FORCED_COLORS, REDUCED_MOTION } from '../../styling/media';
import { motionDurationMs } from '../../styling/motion-timings';
import type { SxProps } from '../../styling/sx';
import { visuallyHiddenStyle } from '../../styling/visually-hidden';
import { dateTimeFormatter } from '../../utils/intl';
import { isRenderable } from '../../utils/renderable';
import { useControlledState } from '../../utils/use-controlled-state';
import { useReducedMotion } from '../../utils/use-reduced-motion';
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
import { Select, type SelectItemProps } from '../select';
import { TimePicker, type TimePickerProps } from '../time-picker';
import { minutes } from '../time-picker/time-picker';

export type BookingPillStep = 'party' | 'date' | 'time' | 'review';
export type BookingPillStatus = 'idle' | 'pending' | 'success' | 'error';
export interface BookingDraft {
  partySize: number;
  date: string;
  time: string | null;
}
export interface Booking extends BookingDraft {
  time: string;
}
export interface BookingPillLabels {
  trigger: (draft: BookingDraft, open: boolean) => ReactNode;
  stepParty: string;
  stepDate: string;
  stepTime: string;
  stepReview: string;
  stepBooked: string;
  decreaseParty: string;
  increaseParty: string;
  partyCount: (count: number) => string;
  back: string;
  next: string;
  confirm: string;
  confirming: string;
  newBooking: string;
  unavailable: string;
  noAvailability: string;
  selectTime: string;
  venue: string;
  party: string;
  date: string;
  time: string;
  errorFallback: (error: unknown) => string;
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
  /** Runs after requesting the initial draft and `party` step for a new booking. */
  onReset?: () => void;
  /** Sets the locale for dates, times and guest counts. */
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
const ALL_AVAILABLE = () => true;
const DEFAULT_LABELS: Omit<BookingPillLabels, 'partyCount' | 'trigger'> = {
  stepParty: 'Party size',
  stepDate: 'Select date',
  stepTime: 'Select time',
  stepReview: 'Review booking',
  stepBooked: 'Booking confirmed',
  decreaseParty: 'Decrease party size',
  increaseParty: 'Increase party size',
  back: 'Back',
  next: 'Next',
  confirm: 'Confirm booking',
  confirming: 'Confirming...',
  newBooking: 'New booking',
  unavailable: 'Unavailable',
  noAvailability: 'No available times for this date.',
  selectTime: 'Select a time',
  venue: 'Venue',
  party: 'Party',
  date: 'Date',
  time: 'Time',
  errorFallback: () => 'Could not confirm this booking. Try another time.',
  stepStatus: (title) => `Step: ${title}`,
};
const rootStyle = css({
  display: 'grid',
  inlineSize: '100%',
  maxInlineSize: '28rem',
  minInlineSize: 0,
  border: `1px solid ${vars.color.borderControl}`,
  borderRadius: vars.radius.lg,
  backgroundColor: vars.color.surfaceRaised,
  color: vars.color.text,
  fontFamily: vars.font.sans,
  fontSize: vars.textSize.sm,
  overflowWrap: 'anywhere',
  '&[data-state="closed"]': { borderRadius: vars.radius.full },
  [FORCED_COLORS]: { borderColor: 'CanvasText' },
});
const buttonStyle = css({
  minBlockSize: vars.space[10],
  paddingInline: vars.space[4],
  paddingBlock: vars.space[2],
  border: `1px solid ${vars.color.borderControl}`,
  borderRadius: vars.radius.md,
  backgroundColor: vars.color.surface,
  color: vars.color.text,
  font: 'inherit',
  cursor: 'pointer',
  '&:focus-visible': focusRingOutset,
  '&:disabled, &[aria-disabled="true"]': {
    cursor: 'not-allowed',
    opacity: 0.6,
  },
  [FORCED_COLORS]: { borderColor: 'ButtonText' },
});
const primaryStyle = css({
  backgroundColor: vars.color.accent,
  color: vars.color.accentContrast,
});
const triggerStyle = css({
  display: 'grid',
  gap: vars.space[1],
  inlineSize: '100%',
  textAlign: 'start',
  border: 0,
  borderRadius: 'inherit',
  backgroundColor: 'transparent',
  '&:focus-visible': focusRingInset,
  overflowWrap: 'anywhere',
});
const contentStyle = css({
  padding: vars.space[4],
  borderBlockStart: `1px solid ${vars.color.borderControl}`,
  '&[hidden]': { display: 'none' },
});
const stackStyle = css({
  display: 'grid',
  gap: vars.space[4],
  minInlineSize: 0,
});
const titleStyle = css({
  margin: 0,
  fontSize: vars.textSize.lg,
  fontWeight: vars.fontWeight.semibold,
  overflowWrap: 'anywhere',
});
const rowStyle = css({
  display: 'flex',
  alignItems: 'center',
  flexWrap: 'wrap',
  justifyContent: 'space-between',
  gap: vars.space[3],
});
const mutedStyle = css({ color: vars.color.textMuted, margin: 0 });
const ticketStyle = css({
  display: 'grid',
  gap: vars.space[3],
  margin: 0,
  padding: vars.space[4],
  border: `1px solid ${vars.color.borderControl}`,
  borderRadius: vars.radius.md,
  backgroundColor: vars.color.surface,
  overflowWrap: 'anywhere',
});
const errorStyle = css({ margin: 0, color: vars.color.dangerText });
const optionStyle = css({
  display: 'flex',
  flexWrap: 'wrap',
  gap: vars.space[2],
});
const faceStyle = css({
  minInlineSize: 0,
  [REDUCED_MOTION]: { transform: 'none !important' },
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

export function BookingPill({
  venue,
  venueDetail,
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
    times.some(
      (time, index) =>
        minutes(time) === undefined || (index > 0 && time <= times[index - 1]!),
    )
  )
    throw new Error(
      'BookingPill requires a civil startDate, positive integer days/party bounds and ordered unique HH:mm times',
    );
  const contentId = useId();
  const titleId = useId();
  const errorId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const mergedRef = useMergeRefs([ref, rootRef]);
  const reduced = useReducedMotion();
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
    trigger: (draft, expanded) =>
      expanded
        ? 'Close booking'
        : `Book for ${numbers.format(draft.partySize)}`,
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
          if (status === 'success') titleRef.current?.focus();
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
  }, [open, step, status === 'success']);
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
  async function confirm() {
    if (blocked || pending.current || !valid || draft.time === null) return;
    pending.current = true;
    const token = ++generation.current;
    const booking: Booking = { ...draft, time: draft.time };
    rememberFocus();
    setStatus('pending');
    setError(undefined);
    try {
      await onConfirm(booking);
      if (generation.current === token) {
        setReceipt(booking);
        setStatus('success');
      }
    } catch (reason) {
      if (generation.current === token) {
        setError(reason);
        setStatus('error');
      }
    } finally {
      if (generation.current === token) pending.current = false;
    }
  }
  function reset() {
    if (blocked) return;
    generation.current++;
    rememberFocus();
    setStatus('idle');
    setError(undefined);
    setReceipt(null);
    requestDraft({ ...seed });
    requestStep('party');
    onReset?.();
  }
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
      data-step={status === 'success' ? 'booked' : step}
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
          if (index > 0) navigate(STEP_ORDER[index - 1]!);
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
        styles={[buttonStyle, triggerStyle]}
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
        <span>{labels.trigger(draft, open)}</span>
        <span css={mutedStyle}>{venue}</span>
      </FieldSlot>
      <FieldSlot
        element="div"
        component={slots?.content}
        slotProps={slotProps?.content}
        ref={contentRef}
        id={contentId}
        role="group"
        aria-labelledby={titleId}
        hidden={!open}
        styles={contentStyle}
        aria-describedby={
          [rest['aria-describedby'], status === 'error' && errorId]
            .filter(Boolean)
            .join(' ') || undefined
        }
      >
        <MotionConfig reducedMotion="user">
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
                {status === 'success' ? labels.stepBooked : titles[step]}
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
              {status === 'success' || step === 'review' ? (
                <div css={ticketStyle}>
                  {[
                    [labels.venue, venue],
                    [labels.party, labels.partyCount(shown.partySize)],
                    [labels.date, formattedDate],
                    [labels.time, formattedTime],
                  ].map(([name, text]) => (
                    <div key={name} css={rowStyle}>
                      <span css={mutedStyle}>{name}</span>
                      <span>{text}</span>
                    </div>
                  ))}
                </div>
              ) : step === 'party' ? (
                <div css={rowStyle}>
                  <button
                    type="button"
                    css={buttonStyle}
                    aria-label={labels.decreaseParty}
                    disabled={blocked || draft.partySize <= minPartySize}
                    onClick={() =>
                      patchDraft({ partySize: draft.partySize - 1 })
                    }
                  >
                    −
                  </button>
                  <output>{labels.partyCount(draft.partySize)}</output>
                  <button
                    type="button"
                    css={buttonStyle}
                    aria-label={labels.increaseParty}
                    disabled={blocked || draft.partySize >= maxPartySize}
                    onClick={() =>
                      patchDraft({ partySize: draft.partySize + 1 })
                    }
                  >
                    +
                  </button>
                </div>
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
              {status === 'error' && (
                <FieldSlot
                  element="p"
                  component={slots?.error}
                  slotProps={slotProps?.error}
                  id={errorId}
                  role="alert"
                  styles={errorStyle}
                >
                  {labels.errorFallback(error)}
                </FieldSlot>
              )}
              <div css={rowStyle}>
                {status === 'success' ? (
                  <button
                    type="button"
                    css={[buttonStyle, primaryStyle]}
                    disabled={disabled}
                    onClick={reset}
                  >
                    {labels.newBooking}
                  </button>
                ) : (
                  <>
                    {step !== 'party' && (
                      <FieldSlot
                        element="button"
                        component={slots?.back}
                        slotProps={slotProps?.back}
                        type="button"
                        styles={buttonStyle}
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
                        component={slots?.next}
                        slotProps={slotProps?.next}
                        type="button"
                        styles={[buttonStyle, primaryStyle]}
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
                        component={slots?.confirm}
                        slotProps={slotProps?.confirm}
                        type="button"
                        styles={[buttonStyle, primaryStyle]}
                        disabled={disabled || (!valid && status !== 'pending')}
                        // Pending keeps the button focusable (busy) while aria-disabled reports why it cannot confirm.
                        aria-disabled={blocked || !valid}
                        aria-busy={status === 'pending' || undefined}
                        behavior={{
                          onClick: (event) => {
                            if (!event.defaultPrevented) void confirm();
                          },
                        }}
                      >
                        {status === 'pending'
                          ? labels.confirming
                          : labels.confirm}
                      </FieldSlot>
                    )}
                  </>
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
        {open
          ? labels.stepStatus(
              status === 'success' ? labels.stepBooked : titles[step],
            )
          : ''}
      </FieldSlot>
    </FieldSlot>
  );
}
BookingPill.displayName = 'BookingPill';
