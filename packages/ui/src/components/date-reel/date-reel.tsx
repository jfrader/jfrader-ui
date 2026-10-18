'use client';
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ComponentPropsWithRef,
  type ComponentType,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  type Ref,
  type WheelEvent,
} from 'react';
import { useMergeRefs } from '@floating-ui/react';
import {
  animate,
  motion,
  MotionConfig,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type MotionValue,
} from 'motion/react';
import { vars } from '@jfrader/tokens/vars';
import { css, type Interpolation, type Theme } from '../../styling/css';
import { WithSx, type SxProps } from '../../styling/sx';
import { FORCED_COLORS } from '../../styling/media';

/** Widest the reel card grows before it centers in its container. */
const DATE_REEL_INLINE_CAP = '420px';
import { motionDurationMs } from '../../styling/motion-timings';
import { isRenderable } from '../../utils/renderable';
import { useControlledState } from '../../utils/use-controlled-state';
import { defaultLocale, resolveTimeOptions } from '../../utils/intl';
import {
  dateFromParts,
  dateFromIso,
  isIsoDate,
} from '../calendar/calendar.utils';
import { minutes } from '../time-picker/time-picker';

export type DateReelMode = 'datetime' | 'date' | 'time';
export type DateReelValue = string;
export type DateReelMinuteStep = 1 | 5 | 10 | 15 | 30;
export type DateReelHourCycle = 'h12' | 'h23';
export type DateReelTone = 'accent' | 'neutral';

export interface DateReelPreset {
  id: string;
  label: string;
  value: DateReelValue;
}

export interface DateReelLabels {
  invalidSelection: string;
  /** Accessible name for the root picker group. */
  root: string;
  /** Accessible name for the presets group. */
  presets: string;
  /** Label for the confirmation action button. */
  confirm: string;
  /** Label for the confirmation button while processing. */
  confirmPending: string;
  /** Status announcement upon successful confirmation. */
  confirmSuccess: string;
  /** Error message formatter when confirmation fails. */
  confirmError: (error: unknown) => string;
  /** Configuration error message formatter when value or range is invalid. */
  configError: (detail: string) => string;
  /** Accessible name for the year reel. */
  year: string;
  /** Accessible name for the month reel. */
  month: string;
  /** Accessible name for the day reel. */
  day: string;
  /** Accessible name for the hour reel. */
  hour: string;
  /** Accessible name for the minute reel. */
  minute: string;
  /** Accessible name for the dayPeriod (AM/PM) reel. */
  period: string;
}

export const DEFAULT_DATE_REEL_LABELS: DateReelLabels = {
  invalidSelection: 'Invalid selection',
  root: 'Date and time picker',
  presets: 'Presets',
  confirm: 'Confirm',
  confirmPending: 'Confirming…',
  confirmSuccess: 'Confirmed',
  confirmError: (err) =>
    err instanceof Error ? err.message : 'Confirmation failed',
  configError: (detail) => `Invalid configuration: ${detail}`,
  year: 'Year',
  month: 'Month',
  day: 'Day',
  hour: 'Hour',
  minute: 'Minute',
  period: 'AM/PM',
};

type SlotProps<Tag extends keyof HTMLElementTagNameMap> =
  ComponentPropsWithRef<Tag> & {
    css?: Interpolation<Theme>;
  };

export interface DateReelSlots {
  /** Outer container wrapping the reels, header, presets, and footer controls. */
  root?: ComponentType<SlotProps<'div'>>;
  /** Heading displaying the title. */
  title?: ComponentType<SlotProps<'div'>>;
  /** Text element displaying the human-readable summary of the current value. */
  summary?: ComponentType<SlotProps<'div'>>;
  /** Container holding the reel spinbuttons. */
  reels?: ComponentType<SlotProps<'div'>>;
  /** Individual spinbutton column for one date/time unit. */
  reel?: ComponentType<SlotProps<'div'>>;
  /** Center lens highlighting the selected row. */
  lens?: ComponentType<SlotProps<'div'>>;
  /** Container holding preset shortcut buttons. */
  presets?: ComponentType<SlotProps<'div'>>;
  /** Individual preset shortcut button. */
  preset?: ComponentType<SlotProps<'button'>>;
  /** Confirmation action button. */
  confirm?: ComponentType<SlotProps<'button'>>;
  /** Status announcement element. */
  status?: ComponentType<SlotProps<'span'>>;
  /** Validation or confirmation error alert. */
  error?: ComponentType<SlotProps<'p'>>;
}

export interface DateReelSlotProps {
  root?: SlotProps<'div'>;
  title?: SlotProps<'div'>;
  summary?: SlotProps<'div'>;
  reels?: SlotProps<'div'>;
  reel?: SlotProps<'div'>;
  lens?: SlotProps<'div'>;
  presets?: SlotProps<'div'>;
  preset?: SlotProps<'button'>;
  confirm?: SlotProps<'button'>;
  status?: SlotProps<'span'>;
  error?: SlotProps<'p'>;
}

export interface DateReelProps
  extends
    Omit<
      ComponentPropsWithRef<'div'>,
      'value' | 'defaultValue' | 'onChange' | 'title'
    >,
    SxProps {
  /** Mode determining the civil format and displayed reels: 'datetime' | 'date' | 'time'. Default: 'datetime'. */
  mode?: DateReelMode;
  /** Current controlled civil value string ('YYYY-MM-DDTHH:mm', 'YYYY-MM-DD', or 'HH:mm'). */
  value?: DateReelValue;
  /** Initial uncontrolled civil value string. */
  defaultValue?: DateReelValue;
  /** Callback emitted when the accepted civil value changes. */
  onValueChange?: (value: DateReelValue) => void;
  /** Earliest selectable civil value (inclusive). */
  min: DateReelValue;
  /** Latest selectable civil value (inclusive). */
  max: DateReelValue;
  /** Explicit reference 'YYYY-MM-DD' for relative day words (e.g. 'Today', 'Tomorrow'). */
  today?: string;
  /** Step interval for minute selection (1, 5, 10, 15, or 30). Default: 5. */
  minuteStep?: DateReelMinuteStep;
  /** Hour cycle convention: 'h12' (12-hour with AM/PM) or 'h23' (24-hour). Default: locale convention. */
  hourCycle?: DateReelHourCycle;
  /** BCP 47 language tag controlling part order, numerals, and day period names. */
  locale?: string;
  /** Shortcut chips for quick selection of predefined values. Default: []. */
  presets?: readonly DateReelPreset[];
  /** Optional visible heading above the reels. */
  title?: ReactNode;
  /** Confirmation callback; renders a confirm button if supplied. */
  onConfirm?: (value: DateReelValue) => void | Promise<void>;
  /** Accessible labels and error formatters. */
  labels?: Partial<DateReelLabels>;
  /**
   * Opt-in initial intro roll animation on mount. Default: false.
   * Runs once on mount when not paused, reduced motion is disabled, and the document is visible.
   * Does not attach an offscreen or IntersectionObserver.
   */
  intro?: boolean;
  /** Disables automatic motion while preserving interactive transitions. Default: false. */
  paused?: boolean;
  /** Motion speed multiplier bounded in [0.25, 4]. Default: 1. */
  speed?: number;
  /** Active lens highlight styling: 'accent' | 'neutral'. Default: 'accent'. */
  tone?: DateReelTone;
  /** Disables all reels and actions. Values remain exposed. Default: false. */
  disabled?: boolean;
  /** Replace the wrapper element; `slots.root` takes precedence. */
  component?: DateReelSlots['root'];
  /** Component replacement map. */
  slots?: DateReelSlots;
  /** Props for replaced parts. */
  slotProps?: DateReelSlotProps;
}

const ROW_HEIGHT = 36;
const CYLINDER_RADIUS = 110;
const ROW_ANGLE_DEG = 20;
const HALF_VISIBLE = 5;
const MINUTES_PER_HOUR = 60;

const pad = (n: number, len = 2) => String(n).padStart(len, '0');

function daysInMonth(year: number, month1Indexed: number): number {
  const d = new Date(Date.UTC(0, 0, 1));
  d.setUTCFullYear(year, month1Indexed, 0);
  return d.getUTCDate();
}

function isValidTime(time: string, minuteStep: DateReelMinuteStep): boolean {
  const total = minutes(time);
  return total !== undefined && total % minuteStep === 0;
}

function validateConfiguration(
  mode: DateReelMode,
  value: string,
  min: string,
  max: string,
  minuteStep: DateReelMinuteStep,
): { valid: boolean; reason?: string } {
  if (mode === 'date') {
    if (!isIsoDate(min) || !isIsoDate(max))
      return { valid: false, reason: 'min/max must be valid YYYY-MM-DD' };
    if (min > max)
      return { valid: false, reason: 'min cannot be greater than max' };
    if (!isIsoDate(value))
      return { valid: false, reason: 'value must be a valid YYYY-MM-DD date' };
    if (value < min || value > max)
      return { valid: false, reason: 'value is outside [min, max] range' };
    return { valid: true };
  }
  if (mode === 'time') {
    if (!isValidTime(min, minuteStep) || !isValidTime(max, minuteStep)) {
      return {
        valid: false,
        reason: 'min/max must be valid HH:mm on minuteStep',
      };
    }
    if (min > max)
      return { valid: false, reason: 'min cannot be greater than max' };
    if (!isValidTime(value, minuteStep))
      return {
        valid: false,
        reason: 'value must be valid HH:mm on minuteStep',
      };
    if (value < min || value > max)
      return { valid: false, reason: 'value is outside [min, max] range' };
    return { valid: true };
  }
  const [dVal, tVal] = value.split('T');
  const [dMin, tMin] = min.split('T');
  const [dMax, tMax] = max.split('T');
  if (
    !dMin ||
    !tMin ||
    !dMax ||
    !tMax ||
    !isIsoDate(dMin) ||
    !isIsoDate(dMax) ||
    !isValidTime(tMin, minuteStep) ||
    !isValidTime(tMax, minuteStep)
  ) {
    return { valid: false, reason: 'min/max must be valid YYYY-MM-DDTHH:mm' };
  }
  if (min > max)
    return { valid: false, reason: 'min cannot be greater than max' };
  if (!dVal || !tVal || !isIsoDate(dVal) || !isValidTime(tVal, minuteStep)) {
    return {
      valid: false,
      reason: 'value must be valid YYYY-MM-DDTHH:mm on minuteStep',
    };
  }
  if (value < min || value > max)
    return { valid: false, reason: 'value is outside [min, max] range' };
  return { valid: true };
}

interface CivilParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

const DEFAULT_PARTS: Record<
  DateReelMode,
  { min: CivilParts; max: CivilParts; fallback: CivilParts }
> = {
  date: {
    min: { year: 2020, month: 1, day: 1, hour: 0, minute: 0 },
    max: { year: 2030, month: 12, day: 31, hour: 23, minute: 59 },
    fallback: { year: 2026, month: 1, day: 1, hour: 0, minute: 0 },
  },
  time: {
    min: { year: 2026, month: 1, day: 1, hour: 0, minute: 0 },
    max: { year: 2026, month: 1, day: 1, hour: 23, minute: 59 },
    fallback: { year: 2026, month: 1, day: 1, hour: 0, minute: 0 },
  },
  datetime: {
    min: { year: 2020, month: 1, day: 1, hour: 0, minute: 0 },
    max: { year: 2030, month: 12, day: 31, hour: 23, minute: 59 },
    fallback: { year: 2026, month: 1, day: 1, hour: 0, minute: 0 },
  },
};

function parseCivil(
  value: string | undefined,
  mode: DateReelMode,
  fallback: CivilParts,
): CivilParts {
  if (!value) return fallback;
  if (mode === 'date') {
    if (!isIsoDate(value)) return fallback;
    const date = dateFromIso(value);
    return {
      year: date.getUTCFullYear(),
      month: date.getUTCMonth() + 1,
      day: date.getUTCDate(),
      hour: fallback.hour,
      minute: fallback.minute,
    };
  }
  if (mode === 'time') {
    const total = minutes(value);
    if (total === undefined) return fallback;
    return {
      year: fallback.year,
      month: fallback.month,
      day: fallback.day,
      hour: Math.floor(total / MINUTES_PER_HOUR),
      minute: total % MINUTES_PER_HOUR,
    };
  }
  const [dVal, tVal] = value.split('T');
  if (!dVal || !tVal || !isIsoDate(dVal)) return fallback;
  const total = minutes(tVal);
  if (total === undefined) return fallback;
  const date = dateFromIso(dVal);
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
    hour: Math.floor(total / MINUTES_PER_HOUR),
    minute: total % MINUTES_PER_HOUR,
  };
}

type ReelPartType = 'year' | 'month' | 'day' | 'hour' | 'minute' | 'period';

const DEFAULT_PAGE_STEPS: Record<ReelPartType, number> = {
  year: 10,
  month: 3,
  day: 7,
  hour: 3,
  minute: 3,
  period: 1,
};

function resolvePageStep(
  partType: ReelPartType,
  minuteStep: DateReelMinuteStep,
): number {
  if (partType === 'minute') {
    return Math.ceil(15 / minuteStep);
  }
  return DEFAULT_PAGE_STEPS[partType];
}

const SPRING_CONFIG = {
  type: 'spring',
  stiffness: 400,
  damping: 36,
} as const;

function clampProposedValue(
  mode: DateReelMode,
  currentVal: string,
  partType: ReelPartType,
  newPartVal: number | string,
  min: string,
  max: string,
  is12Hour: boolean,
): string {
  const current = parseCivil(currentVal, mode, DEFAULT_PARTS[mode].fallback);
  let { year, month, day, hour, minute } = current;

  if (partType === 'year') {
    year = Number(newPartVal);
  } else if (partType === 'month') {
    month = Number(newPartVal);
  } else if (partType === 'day') {
    day = Number(newPartVal);
  } else if (partType === 'hour') {
    if (is12Hour) {
      const isPM = hour >= 12;
      const h = Number(newPartVal);
      hour = isPM ? (h % 12) + 12 : h % 12;
    } else {
      hour = Number(newPartVal);
    }
  } else if (partType === 'minute') {
    minute = Number(newPartVal);
  } else if (partType === 'period') {
    const wantsPM = newPartVal === 'PM';
    if (wantsPM && hour < 12) hour += 12;
    else if (!wantsPM && hour >= 12) hour -= 12;
  }

  if (mode === 'date') {
    const maxD = daysInMonth(year, month);
    day = Math.min(day, maxD);
    let candidate = `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}`;
    if (candidate < min) candidate = min;
    if (candidate > max) candidate = max;
    return candidate;
  }

  if (mode === 'time') {
    let candidate = `${pad(hour, 2)}:${pad(minute, 2)}`;
    if (candidate < min) candidate = min;
    if (candidate > max) candidate = max;
    return candidate;
  }

  const maxD = daysInMonth(year, month);
  day = Math.min(day, maxD);
  let candidate = `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}T${pad(hour, 2)}:${pad(minute, 2)}`;
  if (candidate < min) candidate = min;
  if (candidate > max) candidate = max;
  return candidate;
}

const rootStyle = css({
  label: 'date-reel-root',
  display: 'flex',
  flexDirection: 'column',
  gap: vars.space[3],
  inlineSize: '100%',
  maxInlineSize: DATE_REEL_INLINE_CAP,
  boxSizing: 'border-box',
  padding: vars.space[4],
  backgroundColor: vars.color.surfaceRaised,
  border: `1px solid ${vars.color.borderControl}`,
  borderRadius: vars.radius.lg,
  boxShadow: vars.shadow.raised,
  color: vars.color.text,
  fontFamily: vars.font.sans,
  '&[aria-invalid="true"]': {
    borderColor: vars.color.dangerText,
  },
  [FORCED_COLORS]: {
    backgroundColor: 'Canvas',
    color: 'CanvasText',
    borderColor: 'CanvasText',
  },
});

const titleStyle = css({
  label: 'date-reel-title',
  fontSize: vars.textSize.md,
  fontWeight: vars.fontWeight.semibold,
  color: vars.color.text,
  lineHeight: 1.3,
});

const summaryStyle = css({
  label: 'date-reel-summary',
  fontSize: vars.textSize.sm,
  color: vars.color.textMuted,
});

const reelsContainerStyle = css({
  label: 'date-reel-reels',
  display: 'grid',
  gridAutoFlow: 'column',
  gridAutoColumns: 'minmax(0, 1fr)',
  alignItems: 'stretch',
  gap: vars.space[2],
  blockSize: '180px',
  position: 'relative',
  touchAction: 'pan-x',
  overflow: 'hidden',
  userSelect: 'none',
});

const reelStyle = css({
  label: 'date-reel-reel',
  minInlineSize: 0,
  isolation: 'isolate',
  blockSize: '100%',
  position: 'relative',
  perspective: '600px',
  outline: 'none',
  cursor: 'grab',
  touchAction: 'pan-x',
  '&:active': {
    cursor: 'grabbing',
  },
  '&:focus-visible': {
    outline: `2px solid ${vars.color.focusRing}`,
    outlineOffset: '2px',
    borderRadius: vars.radius.md,
  },
  '&[aria-disabled="true"]': {
    cursor: 'not-allowed',
    opacity: 0.65,
  },
  [FORCED_COLORS]: {
    '&:focus-visible': {
      outlineColor: 'Highlight',
    },
  },
});

const rowsWrapperStyle = css({
  position: 'absolute',
  inset: 0,
  transformStyle: 'preserve-3d',
  pointerEvents: 'none',
});

const rowStyle = css({
  boxSizing: 'border-box',
  overflow: 'hidden',
  position: 'absolute',
  insetInline: 0,
  insetBlockStart: `calc(50% - ${ROW_HEIGHT / 2}px)`,
  blockSize: `${ROW_HEIGHT}px`,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: vars.textSize.md,
  whiteSpace: 'nowrap',
  userSelect: 'none',
  pointerEvents: 'auto',
  cursor: 'pointer',
  transition: `color ${vars.motion.duration.fast} ${vars.motion.easeStandard}`,
  '&[data-selected="true"]': {
    fontWeight: vars.fontWeight.semibold,
    color: vars.color.text,
  },
  '&[data-selected="false"]': {
    fontWeight: vars.fontWeight.regular,
    color: vars.color.textMuted,
  },
  '&[aria-disabled="true"]': {
    opacity: 0.35,
    cursor: 'not-allowed',
  },
  [FORCED_COLORS]: {
    color: 'CanvasText',
    '&[data-selected="true"]': {
      fontWeight: 'bold',
    },
  },
});

const lensStyle = (tone: DateReelTone) =>
  css({
    label: 'date-reel-lens',
    position: 'absolute',
    insetInline: 0,
    insetBlockStart: `calc(50% - ${ROW_HEIGHT / 2}px)`,
    blockSize: `${ROW_HEIGHT}px`,
    borderRadius: vars.radius.md,
    pointerEvents: 'none',
    zIndex: 0,
    ...(tone === 'accent'
      ? {
          backgroundColor: vars.color.accentSoft,
          border: `1px solid ${vars.color.accentText}`,
        }
      : {
          backgroundColor: vars.color.surfaceInset,
          border: `1px solid ${vars.color.borderControl}`,
        }),
    [FORCED_COLORS]: {
      borderColor: 'CanvasText',
      backgroundColor: 'transparent',
    },
  });

const presetsStyle = css({
  label: 'date-reel-presets',
  display: 'flex',
  flexWrap: 'wrap',
  gap: vars.space[2],
  alignItems: 'center',
});

const presetStyle = css({
  label: 'date-reel-preset',
  minBlockSize: '32px',
  minInlineSize: '32px',
  paddingInline: vars.space[3],
  borderRadius: vars.radius.md,
  border: `1px solid ${vars.color.borderControl}`,
  backgroundColor: 'transparent',
  color: vars.color.text,
  fontSize: vars.textSize.sm,
  cursor: 'pointer',
  transition: `background-color ${vars.motion.duration.fast} ${vars.motion.easeStandard}, border-color ${vars.motion.duration.fast} ${vars.motion.easeStandard}`,
  '&:focus-visible': {
    outline: `2px solid ${vars.color.focusRing}`,
    outlineOffset: '2px',
  },
  '&[aria-pressed="true"]': {
    backgroundColor: vars.color.accentSoft,
    borderColor: vars.color.accentText,
    color: vars.color.accentText,
    fontWeight: vars.fontWeight.semibold,
  },
  '&[aria-disabled="true"]': {
    cursor: 'not-allowed',
    opacity: 0.6,
  },
  [FORCED_COLORS]: {
    borderColor: 'CanvasText',
    color: 'CanvasText',
    '&[aria-pressed="true"]': {
      outline: '2px solid Highlight',
      outlineOffset: '1px',
    },
  },
});

const confirmStyle = css({
  label: 'date-reel-confirm',
  minBlockSize: '36px',
  paddingInline: vars.space[4],
  borderRadius: vars.radius.md,
  border: 'none',
  backgroundColor: vars.color.accentText,
  color: vars.color.surfaceRaised,
  fontSize: vars.textSize.sm,
  fontWeight: vars.fontWeight.semibold,
  cursor: 'pointer',
  transition: `opacity ${vars.motion.duration.fast} ${vars.motion.easeStandard}`,
  '&:focus-visible': {
    outline: `2px solid ${vars.color.focusRing}`,
    outlineOffset: '2px',
  },
  '&[aria-disabled="true"]': {
    cursor: 'not-allowed',
    opacity: 0.6,
  },
  [FORCED_COLORS]: {
    backgroundColor: 'Highlight',
    color: 'HighlightText',
  },
});

const statusStyle = css({
  label: 'date-reel-status',
  fontSize: vars.textSize.sm,
  color: vars.color.accentText,
  fontWeight: vars.fontWeight.medium,
});

const errorStyle = css({
  label: 'date-reel-error',
  fontSize: vars.textSize.sm,
  color: vars.color.dangerText,
  fontWeight: vars.fontWeight.medium,
  margin: 0,
});

interface ReelItem {
  value: number | string;
  label: string;
  textValue: string;
  disabled: boolean;
}

export function DateReel({
  ref,
  mode = 'datetime',
  value: valueProp,
  defaultValue,
  onValueChange,
  min,
  max,
  today,
  minuteStep: minuteStepProp = 5,
  hourCycle,
  locale: localeProp,
  presets = [],
  title,
  onConfirm,
  labels: labelsProp,
  intro = false,
  paused = false,
  speed = 1,
  tone = 'accent',
  disabled = false,
  component,
  slots,
  slotProps,
  className,
  style,
  sx,
  ...restProps
}: DateReelProps) {
  const minuteStep = [1, 5, 10, 15, 30].includes(minuteStepProp)
    ? minuteStepProp
    : 5;
  const generatedId = useId();
  const titleId = `date-reel-title-${generatedId}`;
  const summaryId = `date-reel-summary-${generatedId}`;
  const errorId = `date-reel-error-${generatedId}`;

  const resolvedLocale = useMemo(
    () =>
      resolveTimeOptions('DateReel', localeProp ?? defaultLocale(), 'UTC').locale,
    [localeProp],
  );
  const effectiveSpeed = Math.min(
    4,
    Math.max(0.25, Number.isFinite(speed) ? speed : 1),
  );
  const prefersReduced = useReducedMotion();
  const isReduced = Boolean(prefersReduced);

  const labels = useMemo(() => {
    const fallbackRoot =
      mode === 'date'
        ? 'Date picker'
        : mode === 'time'
          ? 'Time picker'
          : DEFAULT_DATE_REEL_LABELS.root;
    return {
      ...DEFAULT_DATE_REEL_LABELS,
      root: fallbackRoot,
      ...labelsProp,
    };
  }, [mode, labelsProp]);

  const fallbackInitial = useMemo(() => {
    if (defaultValue !== undefined) return defaultValue;
    if (valueProp !== undefined) return valueProp;
    return min;
  }, [defaultValue, valueProp, min]);

  const [currentValue, requestValueChange] = useControlledState<DateReelValue>(
    valueProp,
    fallbackInitial,
    onValueChange,
  );
  const safeCurrentValue = currentValue ?? fallbackInitial;

  const configCheck = useMemo(() => {
    if (minuteStep !== minuteStepProp)
      return { valid: false, reason: 'minuteStep must be 1, 5, 10, 15, or 30' };
    return validateConfiguration(mode, safeCurrentValue, min, max, minuteStep);
  }, [mode, safeCurrentValue, min, max, minuteStep, minuteStepProp]);

  const isInvalidConfig = !configCheck.valid;

  const [confirmStatus, setConfirmStatus] = useState<
    'idle' | 'pending' | 'success' | 'error'
  >('idle');
  const [confirmErrorMessage, setConfirmErrorMessage] = useState<string | null>(
    null,
  );
  const isMountedRef = useRef(true);
  const isSubmittingRef = useRef(false);
  const confirmationRequestIdRef = useRef(0);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      confirmationRequestIdRef.current++;
      isSubmittingRef.current = false;
    };
  }, []);

  const prevConfirmedValueRef = useRef(safeCurrentValue);
  useEffect(() => {
    if (prevConfirmedValueRef.current !== safeCurrentValue) {
      prevConfirmedValueRef.current = safeCurrentValue;
      confirmationRequestIdRef.current++;
      isSubmittingRef.current = false;
      setConfirmStatus('idle');
      setConfirmErrorMessage(null);
    }
  }, [safeCurrentValue]);

  const isPending = confirmStatus === 'pending' || isSubmittingRef.current;

  const sampleCarrier = useMemo(
    () => new Date(Date.UTC(2026, 9, 17, 15, 30)),
    [],
  );
  const is12Hour = useMemo(() => {
    if (hourCycle === 'h12') return true;
    if (hourCycle === 'h23') return false;
    const testFormatter = new Intl.DateTimeFormat(resolvedLocale, {
      hour: 'numeric',
      minute: 'numeric',
      calendar: 'gregory',
      timeZone: 'UTC',
    });
    return testFormatter
      .formatToParts(sampleCarrier)
      .some((p) => p.type === 'dayPeriod');
  }, [hourCycle, resolvedLocale, sampleCarrier]);

  const reelParts = useMemo((): ReelPartType[] => {
    if (mode === 'date') {
      const dFormatter = new Intl.DateTimeFormat(resolvedLocale, {
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        calendar: 'gregory',
        timeZone: 'UTC',
      });
      return dFormatter
        .formatToParts(sampleCarrier)
        .map((p) => p.type)
        .filter(
          (t): t is 'year' | 'month' | 'day' =>
            t === 'year' || t === 'month' || t === 'day',
        );
    }
    if (mode === 'time') {
      const tFormatter = new Intl.DateTimeFormat(resolvedLocale, {
        hour: 'numeric',
        minute: 'numeric',
        hourCycle: is12Hour ? 'h12' : 'h23',
        calendar: 'gregory',
        timeZone: 'UTC',
      });
      return tFormatter
        .formatToParts(sampleCarrier)
        .map((p) => (p.type === 'dayPeriod' ? 'period' : p.type))
        .filter(
          (t): t is 'hour' | 'minute' | 'period' =>
            t === 'hour' || t === 'minute' || (is12Hour && t === 'period'),
        );
    }
    const dtFormatter = new Intl.DateTimeFormat(resolvedLocale, {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      hourCycle: is12Hour ? 'h12' : 'h23',
      calendar: 'gregory',
      timeZone: 'UTC',
    });
    return dtFormatter
      .formatToParts(sampleCarrier)
      .map((p) => (p.type === 'dayPeriod' ? 'period' : p.type))
      .filter(
        (t): t is ReelPartType =>
          t === 'year' ||
          t === 'month' ||
          t === 'day' ||
          t === 'hour' ||
          t === 'minute' ||
          (is12Hour && t === 'period'),
      );
  }, [mode, resolvedLocale, sampleCarrier, is12Hour]);

  const parsed = useMemo(
    () => parseCivil(safeCurrentValue, mode, DEFAULT_PARTS[mode].fallback),
    [mode, safeCurrentValue],
  );

  const minParsed = useMemo(
    () => parseCivil(min, mode, DEFAULT_PARTS[mode].min),
    [mode, min],
  );

  const maxParsed = useMemo(
    () => parseCivil(max, mode, DEFAULT_PARTS[mode].max),
    [mode, max],
  );

  const yearFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(resolvedLocale, {
        year: 'numeric',
        calendar: 'gregory',
        timeZone: 'UTC',
      }),
    [resolvedLocale],
  );
  const monthShortFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(resolvedLocale, {
        month: 'short',
        calendar: 'gregory',
        timeZone: 'UTC',
      }),
    [resolvedLocale],
  );
  const monthLongFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(resolvedLocale, {
        month: 'long',
        calendar: 'gregory',
        timeZone: 'UTC',
      }),
    [resolvedLocale],
  );
  const dayFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(resolvedLocale, {
        day: 'numeric',
        calendar: 'gregory',
        timeZone: 'UTC',
      }),
    [resolvedLocale],
  );

  const getReelItems = useCallback(
    (
      partType: ReelPartType,
    ): {
      items: ReelItem[];
      selectedIndex: number;
      validMin: number;
      validMax: number;
    } => {
      if (partType === 'year') {
        const items: ReelItem[] = [];
        for (let y = minParsed.year; y <= maxParsed.year; y++) {
          const d = dateFromParts(y, 0, 1);
          const formatted = yearFormatter.format(d);
          items.push({
            value: y,
            label: formatted,
            textValue: formatted,
            disabled: false,
          });
        }
        const selectedIndex = Math.max(0, parsed.year - minParsed.year);
        return {
          items,
          selectedIndex,
          validMin: minParsed.year,
          validMax: maxParsed.year,
        };
      }
      if (partType === 'month') {
        const items: ReelItem[] = [];
        const isMinYear = parsed.year === minParsed.year;
        const isMaxYear = parsed.year === maxParsed.year;
        const validMin = isMinYear ? minParsed.month : 1;
        const validMax = isMaxYear ? maxParsed.month : 12;
        for (let m = 1; m <= 12; m++) {
          const d = dateFromParts(2026, m - 1, 1);
          const shortLabel = monthShortFormatter.format(d);
          const longLabel = monthLongFormatter.format(d);
          items.push({
            value: m,
            label: shortLabel,
            textValue: longLabel,
            disabled: m < validMin || m > validMax,
          });
        }
        const selectedIndex = Math.max(0, Math.min(11, parsed.month - 1));
        return { items, selectedIndex, validMin, validMax };
      }
      if (partType === 'day') {
        const totalDays = daysInMonth(parsed.year, parsed.month);
        const isMinMonth =
          parsed.year === minParsed.year && parsed.month === minParsed.month;
        const isMaxMonth =
          parsed.year === maxParsed.year && parsed.month === maxParsed.month;
        const validMin = isMinMonth ? minParsed.day : 1;
        const validMax = isMaxMonth
          ? Math.min(totalDays, maxParsed.day)
          : totalDays;
        const items: ReelItem[] = [];
        for (let d = 1; d <= totalDays; d++) {
          const dateObj = dateFromParts(2026, 0, d);
          const label = dayFormatter.format(dateObj);
          items.push({
            value: d,
            label,
            textValue: label,
            disabled: d < validMin || d > validMax,
          });
        }
        const selectedIndex = Math.max(
          0,
          Math.min(items.length - 1, parsed.day - 1),
        );
        return { items, selectedIndex, validMin, validMax };
      }
      if (partType === 'hour') {
        const items: ReelItem[] = [];
        const currentDateStr = `${pad(parsed.year, 4)}-${pad(parsed.month, 2)}-${pad(parsed.day, 2)}`;
        const minDateStr = `${pad(minParsed.year, 4)}-${pad(minParsed.month, 2)}-${pad(minParsed.day, 2)}`;
        const maxDateStr = `${pad(maxParsed.year, 4)}-${pad(maxParsed.month, 2)}-${pad(maxParsed.day, 2)}`;
        const isMinDate = mode === 'time' || currentDateStr === minDateStr;
        const isMaxDate = mode === 'time' || currentDateStr === maxDateStr;
        const validMin24 = isMinDate ? minParsed.hour : 0;
        const validMax24 = isMaxDate ? maxParsed.hour : 23;

        if (is12Hour) {
          const isPM = parsed.hour >= 12;
          for (let h = 1; h <= 12; h++) {
            const h24 = isPM ? (h % 12) + 12 : h % 12;
            const disabledItem = h24 < validMin24 || h24 > validMax24;
            const d = new Date(Date.UTC(2026, 0, 1, h, 0));
            const parts = new Intl.DateTimeFormat(resolvedLocale, {
              hour: 'numeric',
              hourCycle: 'h12',
              calendar: 'gregory',
              timeZone: 'UTC',
            }).formatToParts(d);
            const hourLabel =
              parts.find((p) => p.type === 'hour')?.value ?? String(h);
            items.push({
              value: h,
              label: hourLabel,
              textValue: hourLabel,
              disabled: disabledItem,
            });
          }
          const current12 = parsed.hour % 12 || 12;
          const selectedIndex = current12 - 1;
          const validMin = 1;
          const validMax = 12;
          return { items, selectedIndex, validMin, validMax };
        }
        for (let h = 0; h <= 23; h++) {
          const d = new Date(Date.UTC(2026, 0, 1, h, 0));
          const parts = new Intl.DateTimeFormat(resolvedLocale, {
            hour: '2-digit',
            hourCycle: 'h23',
            calendar: 'gregory',
            timeZone: 'UTC',
          }).formatToParts(d);
          const hourLabel =
            parts.find((p) => p.type === 'hour')?.value ?? pad(h);
          items.push({
            value: h,
            label: hourLabel,
            textValue: hourLabel,
            disabled: h < validMin24 || h > validMax24,
          });
        }
        const selectedIndex = parsed.hour;
        return {
          items,
          selectedIndex,
          validMin: validMin24,
          validMax: validMax24,
        };
      }
      if (partType === 'minute') {
        const items: ReelItem[] = [];
        const currentDateStr = `${pad(parsed.year, 4)}-${pad(parsed.month, 2)}-${pad(parsed.day, 2)}`;
        const minDateStr = `${pad(minParsed.year, 4)}-${pad(minParsed.month, 2)}-${pad(minParsed.day, 2)}`;
        const maxDateStr = `${pad(maxParsed.year, 4)}-${pad(maxParsed.month, 2)}-${pad(maxParsed.day, 2)}`;
        const isMinHour =
          (mode === 'time' || currentDateStr === minDateStr) &&
          parsed.hour === minParsed.hour;
        const isMaxHour =
          (mode === 'time' || currentDateStr === maxDateStr) &&
          parsed.hour === maxParsed.hour;
        const validMin = isMinHour ? minParsed.minute : 0;
        const validMax = isMaxHour ? maxParsed.minute : 59;
        for (let m = 0; m < 60; m += minuteStep) {
          const d = new Date(Date.UTC(2026, 0, 1, 0, m));
          const parts = new Intl.DateTimeFormat(resolvedLocale, {
            minute: '2-digit',
            calendar: 'gregory',
            timeZone: 'UTC',
          }).formatToParts(d);
          const minuteLabel =
            parts.find((p) => p.type === 'minute')?.value ?? pad(m);
          items.push({
            value: m,
            label: minuteLabel,
            textValue: minuteLabel,
            disabled: m < validMin || m > validMax,
          });
        }
        const selectedIndex = Math.max(
          0,
          Math.floor(parsed.minute / minuteStep),
        );
        return { items, selectedIndex, validMin, validMax };
      }
      const isPM = parsed.hour >= 12;
      const getPeriodLabel = (pm: boolean) => {
        const d = new Date(Date.UTC(2026, 0, 1, pm ? 13 : 1, 0));
        const parts = new Intl.DateTimeFormat(resolvedLocale, {
          hour: 'numeric',
          hourCycle: 'h12',
          calendar: 'gregory',
          timeZone: 'UTC',
        }).formatToParts(d);
        return (
          parts.find((p) => p.type === 'dayPeriod')?.value ?? (pm ? 'PM' : 'AM')
        );
      };
      const amLabel = getPeriodLabel(false);
      const pmLabel = getPeriodLabel(true);
      const currentDateStr = `${pad(parsed.year, 4)}-${pad(parsed.month, 2)}-${pad(parsed.day, 2)}`;
      const minDateStr = `${pad(minParsed.year, 4)}-${pad(minParsed.month, 2)}-${pad(minParsed.day, 2)}`;
      const maxDateStr = `${pad(maxParsed.year, 4)}-${pad(maxParsed.month, 2)}-${pad(maxParsed.day, 2)}`;
      const isMinDate = mode === 'time' || currentDateStr === minDateStr;
      const isMaxDate = mode === 'time' || currentDateStr === maxDateStr;
      const amDisabled = isMinDate && minParsed.hour >= 12;
      const pmDisabled = isMaxDate && maxParsed.hour < 12;
      const items: ReelItem[] = [
        {
          value: 'AM',
          label: amLabel,
          textValue: amLabel,
          disabled: amDisabled,
        },
        {
          value: 'PM',
          label: pmLabel,
          textValue: pmLabel,
          disabled: pmDisabled,
        },
      ];
      const selectedIndex = isPM ? 1 : 0;
      return { items, selectedIndex, validMin: 0, validMax: 1 };
    },
    [
      minParsed,
      maxParsed,
      parsed,
      yearFormatter,
      monthShortFormatter,
      monthLongFormatter,
      dayFormatter,
      mode,
      is12Hour,
      resolvedLocale,
      minuteStep,
    ],
  );

  const formattedSummary = useMemo(() => {
    if (isInvalidConfig) return labels.invalidSelection;
    const datePart = `${pad(parsed.year, 4)}-${pad(parsed.month, 2)}-${pad(parsed.day, 2)}`;
    const utcDate = dateFromParts(parsed.year, parsed.month - 1, parsed.day);
    utcDate.setUTCHours(parsed.hour, parsed.minute);

    if (today && isIsoDate(today) && (mode === 'date' || mode === 'datetime')) {
      const todayDate = dateFromIso(today);
      const curDate = dateFromIso(datePart);
      const diffDays = Math.round(
        (curDate.getTime() - todayDate.getTime()) / (24 * 3600 * 1000),
      );
      if (Math.abs(diffDays) <= 7) {
        const rtf = new Intl.RelativeTimeFormat(resolvedLocale, {
          numeric: 'auto',
        });
        const word = rtf.format(diffDays, 'day');
        const capitalized = word;
        if (mode === 'date') return capitalized;
        const timeStr = new Intl.DateTimeFormat(resolvedLocale, {
          timeStyle: 'short',
          hourCycle: is12Hour ? 'h12' : 'h23',
          calendar: 'gregory',
          timeZone: 'UTC',
        }).format(utcDate);
        return `${capitalized}, ${timeStr}`;
      }
    }

    if (mode === 'date') {
      return new Intl.DateTimeFormat(resolvedLocale, {
        dateStyle: 'full',
        calendar: 'gregory',
        timeZone: 'UTC',
      }).format(utcDate);
    }
    if (mode === 'time') {
      return new Intl.DateTimeFormat(resolvedLocale, {
        timeStyle: 'short',
        hourCycle: is12Hour ? 'h12' : 'h23',
        calendar: 'gregory',
        timeZone: 'UTC',
      }).format(utcDate);
    }
    return new Intl.DateTimeFormat(resolvedLocale, {
      dateStyle: 'full',
      timeStyle: 'short',
      hourCycle: is12Hour ? 'h12' : 'h23',
      calendar: 'gregory',
      timeZone: 'UTC',
    }).format(utcDate);
  }, [
    isInvalidConfig,
    parsed,
    today,
    mode,
    resolvedLocale,
    is12Hour,
    labels.invalidSelection,
  ]);

  const handlePartSelect = useCallback(
    (partType: ReelPartType, newPartVal: number | string) => {
      if (disabled || isPending || isInvalidConfig) return;
      const proposed = clampProposedValue(
        mode,
        safeCurrentValue,
        partType,
        newPartVal,
        min,
        max,
        is12Hour,
      );
      requestValueChange(proposed);
    },
    [
      disabled,
      isPending,
      isInvalidConfig,
      mode,
      safeCurrentValue,
      min,
      max,
      is12Hour,
      requestValueChange,
    ],
  );

  const reelRefs = useRef<(HTMLDivElement | null)[]>([]);

  const handlePresetClick = useCallback(
    (presetValue: DateReelValue) => {
      if (disabled || isPending || isInvalidConfig) return;
      const check = validateConfiguration(
        mode,
        presetValue,
        min,
        max,
        minuteStep,
      );
      if (!check.valid) return;
      requestValueChange(presetValue);
    },
    [
      disabled,
      isPending,
      isInvalidConfig,
      mode,
      min,
      max,
      minuteStep,
      requestValueChange,
    ],
  );

  const handleConfirm = useCallback(() => {
    if (disabled || isSubmittingRef.current || isInvalidConfig || !onConfirm)
      return;
    isSubmittingRef.current = true;
    const currentRequestId = ++confirmationRequestIdRef.current;
    setConfirmErrorMessage(null);
    try {
      const result = onConfirm(safeCurrentValue);
      if (result && typeof (result as Promise<void>).then === 'function') {
        setConfirmStatus('pending');
        (result as Promise<void>).then(
          () => {
            if (
              !isMountedRef.current ||
              confirmationRequestIdRef.current !== currentRequestId
            )
              return;
            isSubmittingRef.current = false;
            setConfirmStatus('success');
          },
          (err) => {
            if (
              !isMountedRef.current ||
              confirmationRequestIdRef.current !== currentRequestId
            )
              return;
            isSubmittingRef.current = false;
            setConfirmStatus('error');
            setConfirmErrorMessage(labels.confirmError(err));
          },
        );
      } else {
        isSubmittingRef.current = false;
        setConfirmStatus('success');
      }
    } catch (err) {
      isSubmittingRef.current = false;
      setConfirmStatus('error');
      setConfirmErrorMessage(labels.confirmError(err));
    }
  }, [disabled, isInvalidConfig, onConfirm, safeCurrentValue, labels]);

  const RootSlot = slots?.root ?? component ?? 'div';
  const TitleSlot = slots?.title ?? 'div';
  const SummarySlot = slots?.summary ?? 'div';
  const ReelsSlot = slots?.reels ?? 'div';
  const ReelSlot = slots?.reel ?? 'div';
  const LensSlot = slots?.lens ?? 'div';
  const PresetsSlot = slots?.presets ?? 'div';
  const PresetSlot = slots?.preset ?? 'button';
  const ConfirmSlot = slots?.confirm ?? 'button';
  const StatusSlot = slots?.status ?? 'span';
  const ErrorSlot = slots?.error ?? 'p';

  const {
    className: slotRootClassName,
    style: slotRootStyle,
    ...slotRootRest
  } = slotProps?.root ?? {};
  const mergedClassName =
    [className, slotRootClassName].filter(Boolean).join(' ') || undefined;
  const mergedStyle = slotRootStyle ? { ...style, ...slotRootStyle } : style;
  const mergedRootRef = useMergeRefs([ref, slotProps?.root?.ref]);

  const hasTitle = isRenderable(title);
  const rootLabelledBy =
    [hasTitle ? titleId : undefined, restProps['aria-labelledby']]
      .filter(Boolean)
      .join(' ') || undefined;
  const rootDescribedBy =
    [
      summaryId,
      isInvalidConfig || confirmErrorMessage ? errorId : undefined,
      restProps['aria-describedby'],
    ]
      .filter(Boolean)
      .join(' ') || undefined;

  return (
    <MotionConfig reducedMotion="user">
      <WithSx
        className={mergedClassName}
        styles={[rootStyle, slotProps?.root?.css]}
        sx={sx}
      >
        {(withSxClass) => (
          <RootSlot
            {...restProps}
            {...slotRootRest}
            ref={mergedRootRef}
            role="group"
            aria-label={rootLabelledBy ? undefined : labels.root}
            aria-labelledby={rootLabelledBy}
            aria-describedby={rootDescribedBy}
            aria-invalid={isInvalidConfig ? 'true' : restProps['aria-invalid']}
            data-ui="date-reel"
            className={withSxClass}
            style={mergedStyle}
          >
            {hasTitle && (
              <TitleSlot
                {...slotProps?.title}
                id={titleId}
                role="heading"
                aria-level={3}
                data-ui="date-reel-title"
                css={[titleStyle, slotProps?.title?.css]}
              >
                {title}
              </TitleSlot>
            )}

            <SummarySlot
              {...slotProps?.summary}
              id={summaryId}
              data-ui="date-reel-summary"
              css={[summaryStyle, slotProps?.summary?.css]}
            >
              {formattedSummary}
            </SummarySlot>

            <ReelsSlot
              {...slotProps?.reels}
              data-ui="date-reel-reels"
              css={[reelsContainerStyle, slotProps?.reels?.css]}
            >
              {reelParts.map((partType, partIndex) => {
                const { items, selectedIndex, validMin, validMax } =
                  getReelItems(partType);
                const reelLabel = labels[partType];

                return (
                  <ReelColumn
                    key={partType}
                    ref={(node) => {
                      reelRefs.current[partIndex] = node;
                    }}
                    partType={partType}
                    reelLabel={reelLabel}
                    items={items}
                    selectedIndex={selectedIndex}
                    validMin={validMin}
                    validMax={validMax}
                    disabled={disabled || isPending || isInvalidConfig}
                    isInvalidConfig={isInvalidConfig}
                    isReduced={isReduced}
                    intro={intro}
                    paused={paused}
                    speed={effectiveSpeed}
                    tone={tone}
                    minuteStep={minuteStep}
                    onSelect={handlePartSelect}
                    onFocusNeighbor={(direction) => {
                      const targetIndex = partIndex + direction;
                      if (targetIndex >= 0 && targetIndex < reelParts.length) {
                        reelRefs.current[targetIndex]?.focus();
                      }
                    }}
                    ReelSlot={ReelSlot}
                    LensSlot={LensSlot}
                    slotPropsReel={slotProps?.reel}
                    slotPropsLens={slotProps?.lens}
                  />
                );
              })}
            </ReelsSlot>

            {presets && presets.length > 0 && (
              <PresetsSlot
                {...slotProps?.presets}
                role="group"
                aria-label={labels.presets}
                data-ui="date-reel-presets"
                css={[presetsStyle, slotProps?.presets?.css]}
              >
                {presets.map((preset) => {
                  const isSelected = safeCurrentValue === preset.value;
                  const isValid = validateConfiguration(
                    mode,
                    preset.value,
                    min,
                    max,
                    minuteStep,
                  ).valid;
                  const isPresetDisabled = disabled || isPending || !isValid;
                  return (
                    <PresetSlot
                      key={preset.id}
                      {...slotProps?.preset}
                      type="button"
                      aria-pressed={isSelected}
                      aria-disabled={isPresetDisabled ? 'true' : undefined}
                      data-ui="date-reel-preset"
                      css={[presetStyle, slotProps?.preset?.css]}
                      onClick={(e) => {
                        slotProps?.preset?.onClick?.(e);
                        if (e.defaultPrevented) return;
                        handlePresetClick(preset.value);
                      }}
                    >
                      {preset.label}
                    </PresetSlot>
                  );
                })}
              </PresetsSlot>
            )}

            {onConfirm && (
              <ConfirmSlot
                {...slotProps?.confirm}
                type="button"
                aria-busy={isPending ? 'true' : undefined}
                aria-disabled={disabled || isPending ? 'true' : undefined}
                data-ui="date-reel-confirm"
                css={[confirmStyle, slotProps?.confirm?.css]}
                onClick={(e) => {
                  slotProps?.confirm?.onClick?.(e);
                  if (e.defaultPrevented) return;
                  handleConfirm();
                }}
              >
                {isPending ? labels.confirmPending : labels.confirm}
              </ConfirmSlot>
            )}

            <StatusSlot
              {...slotProps?.status}
              role="status"
              aria-live="polite"
              aria-atomic="true"
              data-ui="date-reel-status"
              css={[statusStyle, slotProps?.status?.css]}
            >
              {confirmStatus === 'success' ? labels.confirmSuccess : ''}
            </StatusSlot>

            {(isInvalidConfig || confirmErrorMessage) && (
              <ErrorSlot
                {...slotProps?.error}
                id={errorId}
                role="alert"
                data-ui="date-reel-error"
                css={[errorStyle, slotProps?.error?.css]}
              >
                {isInvalidConfig
                  ? labels.configError(configCheck.reason ?? '')
                  : confirmErrorMessage}
              </ErrorSlot>
            )}
          </RootSlot>
        )}
      </WithSx>
    </MotionConfig>
  );
}
DateReel.displayName = 'DateReel';

interface ReelRowProps {
  item: ReelItem;
  index: number;
  selectedIndex: number;
  rowOffset: number;
  motionOffset: MotionValue<number>;
  isReduced: boolean;
  onSelect: (value: number | string) => void;
}

function ReelRow({
  item,
  index,
  selectedIndex,
  rowOffset,
  motionOffset,
  isReduced,
  onSelect,
}: ReelRowProps) {
  const transform = useTransform(motionOffset, (currentOffset) => {
    const delta = rowOffset - currentOffset;
    if (isReduced) {
      const y = delta * ROW_HEIGHT;
      return `translate3d(0, ${y}px, 0)`;
    }
    const angleDeg = delta * ROW_ANGLE_DEG;
    const angleRad = (angleDeg * Math.PI) / 180;
    const y = Math.sin(angleRad) * CYLINDER_RADIUS;
    const z = (Math.cos(angleRad) - 1) * CYLINDER_RADIUS;
    const rotateX = -angleDeg;
    const scale = Math.cos(angleRad);
    return `translate3d(0, ${y}px, ${z}px) rotateX(${rotateX}deg) scale(${scale})`;
  });

  const isSelected = index === selectedIndex;

  return (
    <motion.div
      css={rowStyle}
      style={{
        transform,
        ...(item.disabled ? { opacity: 0.5 } : {}),
      }}
      data-selected={isSelected ? 'true' : 'false'}
      aria-disabled={item.disabled ? 'true' : undefined}
      onClick={() => {
        if (!item.disabled && !isSelected) {
          onSelect(item.value);
        }
      }}
    >
      {item.label}
    </motion.div>
  );
}

interface ReelColumnProps {
  ref?: Ref<HTMLDivElement>;
  partType: ReelPartType;
  reelLabel: string;
  items: ReelItem[];
  selectedIndex: number;
  validMin: number;
  validMax: number;
  disabled: boolean;
  isInvalidConfig: boolean;
  isReduced: boolean;
  intro: boolean;
  paused: boolean;
  speed: number;
  tone: DateReelTone;
  minuteStep: DateReelMinuteStep;
  onSelect: (partType: ReelPartType, value: number | string) => void;
  onFocusNeighbor: (dir: number) => void;
  ReelSlot: ComponentType<SlotProps<'div'>> | 'div';
  LensSlot: ComponentType<SlotProps<'div'>> | 'div';
  slotPropsReel?: SlotProps<'div'>;
  slotPropsLens?: SlotProps<'div'>;
}

function ReelColumn({
  ref,
  partType,
  reelLabel,
  items,
  selectedIndex,
  validMin,
  validMax,
  disabled,
  isInvalidConfig,
  isReduced,
  intro,
  paused,
  speed,
  tone,
  minuteStep,
  onSelect,
  onFocusNeighbor,
  ReelSlot,
  LensSlot,
  slotPropsReel,
  slotPropsLens,
}: ReelColumnProps) {
  const motionOffset = useMotionValue(0);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const isDraggingRef = useRef(false);
  const dragStartYRef = useRef(0);
  const dragStartTimeRef = useRef(0);
  const dragStartIndexRef = useRef(selectedIndex);
  const lastMoveYRef = useRef(0);
  const lastMoveTimeRef = useRef(0);
  const velocityRef = useRef(0);
  const activePointerIdRef = useRef<number | null>(null);
  const wheelDeltaRef = useRef(0);
  const preventedWheelEvents = useRef(new WeakSet<Event>());
  const typeaheadBufferRef = useRef('');
  const typeaheadTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const activeAnimationRef = useRef<{ stop: () => void } | null>(null);
  const introHasRunRef = useRef(false);

  const mergedReelRef = useMergeRefs([containerRef, ref, slotPropsReel?.ref]);

  const cancelGesture = useCallback(() => {
    activeAnimationRef.current?.stop();
    activeAnimationRef.current = null;
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      if (activePointerIdRef.current !== null && containerRef.current) {
        try {
          containerRef.current.releasePointerCapture(
            activePointerIdRef.current,
          );
        } catch {}
        activePointerIdRef.current = null;
      }
    }
    motionOffset.set(0);
  }, [motionOffset]);

  const prevSelectedIndexRef = useRef(selectedIndex);
  useEffect(() => {
    if (prevSelectedIndexRef.current !== selectedIndex) {
      prevSelectedIndexRef.current = selectedIndex;
      if (isDraggingRef.current) {
        cancelGesture();
      }
    }
  }, [selectedIndex, cancelGesture]);

  useEffect(() => {
    if (disabled) {
      cancelGesture();
    }
  }, [disabled, cancelGesture]);

  useEffect(() => {
    return () => {
      activeAnimationRef.current?.stop();
      if (typeaheadTimerRef.current) {
        clearTimeout(typeaheadTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (introHasRunRef.current) return;
    introHasRunRef.current = true;

    const isDocHidden = containerRef.current
      ? containerRef.current.ownerDocument.visibilityState === 'hidden'
      : typeof document !== 'undefined' &&
        document.visibilityState === 'hidden';

    if (!intro || paused || isReduced || isDocHidden) {
      return;
    }

    motionOffset.set(2);
    const animation = animate(motionOffset, 0, {
      duration: (motionDurationMs.slow / 1000) * (1 / speed),
      ease: [0.16, 1, 0.3, 1],
    });
    activeAnimationRef.current = animation;

    return () => {
      animation.stop();
      if (activeAnimationRef.current === animation) {
        activeAnimationRef.current = null;
      }
    };
  }, [intro, paused, isReduced, speed, motionOffset]);

  const clampIndex = useCallback(
    (index: number) => {
      const minIdx = items.findIndex((it) => !it.disabled);
      const lastEnabled = [...items].reverse().findIndex((it) => !it.disabled);
      const maxIdx =
        lastEnabled === -1 ? items.length - 1 : items.length - 1 - lastEnabled;
      return Math.max(minIdx === -1 ? 0 : minIdx, Math.min(maxIdx, index));
    },
    [items],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (disabled || e.nativeEvent.isComposing) return;

      if (e.key === 'Escape' && isDraggingRef.current) {
        cancelGesture();
        e.preventDefault();
        return;
      }

      if (e.altKey || e.ctrlKey || e.metaKey) return;

      const isRTL = Boolean(containerRef.current?.matches?.(':dir(rtl)'));

      if (e.key === 'ArrowRight') {
        e.preventDefault();
        onFocusNeighbor(isRTL ? -1 : 1);
        return;
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        onFocusNeighbor(isRTL ? 1 : -1);
        return;
      }

      let targetIndex = selectedIndex;
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        targetIndex = clampIndex(selectedIndex - 1);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        targetIndex = clampIndex(selectedIndex + 1);
      } else if (e.key === 'PageUp' || e.key === 'PageDown') {
        e.preventDefault();
        const step = resolvePageStep(partType, minuteStep);
        targetIndex = clampIndex(
          selectedIndex + (e.key === 'PageDown' ? step : -step),
        );
      } else if (e.key === 'Home') {
        e.preventDefault();
        const firstEnabled = items.findIndex((it) => !it.disabled);
        targetIndex = firstEnabled === -1 ? 0 : firstEnabled;
      } else if (e.key === 'End') {
        e.preventDefault();
        const lastIdx = [...items].reverse().findIndex((it) => !it.disabled);
        targetIndex =
          lastIdx === -1 ? items.length - 1 : items.length - 1 - lastIdx;
      } else if (e.key.length === 1) {
        e.preventDefault();
        typeaheadBufferRef.current += e.key.toLowerCase();
        if (typeaheadTimerRef.current) clearTimeout(typeaheadTimerRef.current);
        typeaheadTimerRef.current = setTimeout(() => {
          typeaheadBufferRef.current = '';
          typeaheadTimerRef.current = undefined;
        }, 500);

        const matchIdx = items.findIndex(
          (it) =>
            !it.disabled &&
            (it.label.toLowerCase().startsWith(typeaheadBufferRef.current) ||
              it.textValue
                .toLowerCase()
                .startsWith(typeaheadBufferRef.current) ||
              String(it.value)
                .toLowerCase()
                .startsWith(typeaheadBufferRef.current)),
        );
        if (matchIdx !== -1) {
          targetIndex = matchIdx;
        }
      }

      const targetItem = items[targetIndex];
      if (targetIndex !== selectedIndex && targetItem && !targetItem.disabled) {
        onSelect(partType, targetItem.value);
      }
    },
    [
      disabled,
      cancelGesture,
      selectedIndex,
      clampIndex,
      onFocusNeighbor,
      partType,
      minuteStep,
      items,
      onSelect,
    ],
  );

  const handlePointerDown = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (disabled) return;
      activeAnimationRef.current?.stop();
      activeAnimationRef.current = null;
      isDraggingRef.current = true;
      dragStartYRef.current = e.clientY;
      dragStartTimeRef.current = performance.now();
      dragStartIndexRef.current = selectedIndex;
      lastMoveYRef.current = e.clientY;
      lastMoveTimeRef.current = performance.now();
      velocityRef.current = 0;
      activePointerIdRef.current = e.pointerId;
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {}
    },
    [disabled, selectedIndex],
  );

  const handlePointerMove = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (!isDraggingRef.current) return;
      const now = performance.now();
      const dt = now - lastMoveTimeRef.current;
      if (dt > 0) {
        velocityRef.current = (e.clientY - lastMoveYRef.current) / dt;
      }
      lastMoveYRef.current = e.clientY;
      lastMoveTimeRef.current = now;

      const deltaY = e.clientY - dragStartYRef.current;
      motionOffset.set(-deltaY / ROW_HEIGHT);
    },
    [motionOffset],
  );

  const handlePointerUp = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      if (activePointerIdRef.current !== null) {
        try {
          e.currentTarget.releasePointerCapture(activePointerIdRef.current);
        } catch {}
        activePointerIdRef.current = null;
      }

      const elapsed = performance.now() - dragStartTimeRef.current;
      const totalDeltaY = e.clientY - dragStartYRef.current;

      if (Math.abs(totalDeltaY) < 5 && elapsed < 250) {
        if (isReduced || paused) {
          motionOffset.set(0);
        } else {
          activeAnimationRef.current?.stop();
          activeAnimationRef.current = animate(motionOffset, 0, SPRING_CONFIG);
        }
        return;
      }

      const velocity = velocityRef.current;
      const inertiaDeltaY = isReduced ? 0 : velocity * (150 * speed);
      const projectedDeltaY = totalDeltaY + inertiaDeltaY;
      const candidateStep = Math.round(-projectedDeltaY / ROW_HEIGHT);
      const targetIndex = clampIndex(dragStartIndexRef.current + candidateStep);

      const step = targetIndex - selectedIndex;
      if (step !== 0 && items[targetIndex] && !items[targetIndex].disabled) {
        onSelect(partType, items[targetIndex].value);
        if (isReduced || paused) {
          motionOffset.set(0);
        } else {
          motionOffset.set(motionOffset.get() - step);
          activeAnimationRef.current?.stop();
          activeAnimationRef.current = animate(motionOffset, 0, SPRING_CONFIG);
        }
      } else {
        if (isReduced || paused) {
          motionOffset.set(0);
        } else {
          activeAnimationRef.current?.stop();
          activeAnimationRef.current = animate(motionOffset, 0, SPRING_CONFIG);
        }
      }
    },
    [
      clampIndex,
      isReduced,
      items,
      motionOffset,
      onSelect,
      partType,
      paused,
      selectedIndex,
      speed,
    ],
  );

  const handlePointerCancel = useCallback(() => {
    cancelGesture();
  }, [cancelGesture]);

  const handleLostPointerCapture = useCallback(() => {
    cancelGesture();
  }, [cancelGesture]);

  useEffect(() => {
    const node = containerRef.current;
    if (!node || disabled) return;

    const onNativeWheel = (e: globalThis.WheelEvent) => {
      if (node.ownerDocument.activeElement !== node) return;
      if (!e.composedPath().includes(node)) return;
      if (preventedWheelEvents.current.has(e)) return;
      if (e.defaultPrevented) return;
      wheelDeltaRef.current += e.deltaY;
      if (Math.abs(wheelDeltaRef.current) >= 30) {
        if (e.cancelable) {
          e.preventDefault();
        }
        const dir = wheelDeltaRef.current > 0 ? 1 : -1;
        wheelDeltaRef.current = 0;
        const targetIndex = clampIndex(selectedIndex + dir);
        if (
          targetIndex !== selectedIndex &&
          items[targetIndex] &&
          !items[targetIndex].disabled
        ) {
          onSelect(partType, items[targetIndex].value);
        }
      }
    };

    node.ownerDocument.addEventListener('wheel', onNativeWheel, {
      passive: false,
    });
    return () => {
      node.ownerDocument.removeEventListener('wheel', onNativeWheel);
    };
  }, [disabled, clampIndex, selectedIndex, items, onSelect, partType]);

  const visibleIndices = useMemo(() => {
    const start = Math.max(0, selectedIndex - HALF_VISIBLE);
    const end = Math.min(items.length - 1, selectedIndex + HALF_VISIBLE);
    const indices: number[] = [];
    for (let i = start; i <= end; i++) {
      indices.push(i);
    }
    return indices;
  }, [items.length, selectedIndex]);

  const fallbackItem: ReelItem = {
    value: 0,
    label: '',
    textValue: '',
    disabled: false,
  };
  const selectedItem = items[selectedIndex] ?? items[0] ?? fallbackItem;

  return (
    <ReelSlot
      {...slotPropsReel}
      ref={mergedReelRef}
      role="spinbutton"
      tabIndex={0}
      aria-label={reelLabel}
      aria-valuemin={validMin}
      aria-valuemax={validMax}
      aria-valuenow={
        typeof selectedItem.value === 'number'
          ? selectedItem.value
          : selectedIndex
      }
      aria-valuetext={selectedItem.textValue}
      aria-disabled={disabled ? 'true' : undefined}
      aria-invalid={isInvalidConfig ? 'true' : undefined}
      data-ui="date-reel-reel"
      data-part={partType}
      css={[reelStyle, slotPropsReel?.css]}
      onKeyDown={(e) => {
        slotPropsReel?.onKeyDown?.(e);
        if (e.defaultPrevented) return;
        handleKeyDown(e);
      }}
      onPointerDown={(e) => {
        slotPropsReel?.onPointerDown?.(e);
        if (e.defaultPrevented) return;
        handlePointerDown(e);
      }}
      onPointerMove={(e) => {
        slotPropsReel?.onPointerMove?.(e);
        if (e.defaultPrevented) return;
        handlePointerMove(e);
      }}
      onPointerUp={(e) => {
        slotPropsReel?.onPointerUp?.(e);
        if (e.defaultPrevented) return;
        handlePointerUp(e);
      }}
      onPointerCancel={(e) => {
        slotPropsReel?.onPointerCancel?.(e);
        if (e.defaultPrevented) return;
        handlePointerCancel();
      }}
      onLostPointerCapture={(e) => {
        slotPropsReel?.onLostPointerCapture?.(e);
        if (e.defaultPrevented) return;
        handleLostPointerCapture();
      }}
      onWheel={(event) => {
        slotPropsReel?.onWheel?.(event);
        if (event.defaultPrevented)
          preventedWheelEvents.current.add(event.nativeEvent);
      }}
      onFocus={slotPropsReel?.onFocus}
      onBlur={slotPropsReel?.onBlur}
    >
      <LensSlot
        {...slotPropsLens}
        aria-hidden="true"
        data-ui="date-reel-lens"
        css={[lensStyle(tone), slotPropsLens?.css]}
      />

      <div aria-hidden="true" css={rowsWrapperStyle}>
        {visibleIndices.map((i) => {
          const item = items[i];
          if (!item) return null;
          return (
            <ReelRow
              key={`${i}-${item.value}`}
              item={item}
              index={i}
              selectedIndex={selectedIndex}
              rowOffset={i - selectedIndex}
              motionOffset={motionOffset}
              isReduced={isReduced}
              onSelect={(val) => onSelect(partType, val)}
            />
          );
        })}
      </div>
    </ReelSlot>
  );
}
