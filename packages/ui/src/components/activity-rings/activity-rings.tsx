'use client';

import {
  useEffect,
  useId,
  useRef,
  type ComponentPropsWithoutRef,
  type ComponentPropsWithRef,
  type CSSProperties,
  type KeyboardEvent,
} from 'react';
import { MotionConfig, animate, motion, useMotionValue, useReducedMotion } from 'motion/react';
import { base } from '@jfrader/tokens';
import { vars } from '@jfrader/tokens/vars';
import { css, type Interpolation, type Theme } from '../../styling/css';
import { focusRingOutset } from '../../styling/focus-ring';
import { FORCED_COLORS, REDUCED_MOTION } from '../../styling/media';
import { WithSx, type SxProps } from '../../styling/sx';
import { visuallyHiddenStyle } from '../../styling/visually-hidden';
import { useControlledState } from '../../utils/use-controlled-state';
import { CIVIL_DATE_FORMAT_OPTIONS, dateFromIso, isIsoDate } from '../calendar/calendar.utils';
import { createUsageFormats, summarizeUsage, type UsageMeterSummary } from '../usage-meter/usage-model';

export type ActivityTone = 'accent' | 'warning' | 'success' | 'info';
export type ActivityRingsSize = 'sm' | 'md' | 'lg';
export type ActivityValues = Readonly<Record<string, number | null>>;
export interface ActivityMetric {
  /** Stable, nonempty, unique identity. */
  id: string;
  label: string;
  /** Positive target; nonpositive or nonfinite goals render the metric as unavailable. */
  goal: number;
  /** Unit supported by `Intl.NumberFormat` (`'kilometer'`, `'minute'`, `'hour'`, …); otherwise use `formatValue`. */
  unit?: string;
  tone?: ActivityTone;
  /** Formats amounts for units Intl does not support. Use Intl in the formatter. */
  formatValue?: (value: number, locale: string | undefined) => string;
}
export interface ActivityDay {
  id: string;
  /** Civil date, `YYYY-MM-DD`. */
  date: string;
  values: ActivityValues;
}
/** `open` is below goal, `closed` at or above it; `unknown` has no finite value. */
export type ActivityRingStatus = 'unknown' | 'unavailable' | 'open' | 'closed';
interface ActivityRingSummary {
  metric: ActivityMetric;
  status: ActivityRingStatus;
  /** Normalized value: negative values read as zero; `null` when unknown. */
  value: number | null;
  /** Shared usage summary of `value` against `goal`; `null` when the value is unknown. */
  usage: UsageMeterSummary | null;
}
export interface ActivityRingsLabels {
  /** Region name when no consumer name is given. */
  root: string;
  /** Day picker group label. */
  days: string;
  legend: string;
  unknown: string;
  unavailable: string;
  goalMet: string;
  noSelection: string;
  empty: string;
  amount: (value: string, goal: string) => string;
  summary: (met: string, total: string) => string;
}
type PartElement = 'svg' | 'ul' | 'button' | 'div' | 'fieldset' | 'label' | 'p';
export type ActivityRingsPartProps<T extends PartElement> = Omit<
  ComponentPropsWithoutRef<T>,
  'children'
> & {
  css?: Interpolation<Theme>;
};
type DataSource =
  | {
      /** Standalone values when there is no day picker. */
      values?: ActivityValues;
      days?: never;
    }
  | {
      /** Days win over standalone values; supplying both is a type error. */
      days: readonly ActivityDay[];
      values?: never;
    };
interface ActivityRingsSlotProps {
  rings?: ActivityRingsPartProps<'svg'>;
  legend?: ActivityRingsPartProps<'ul'>;
  dayPicker?: ActivityRingsPartProps<'fieldset'>;
  dayLabel?: ActivityRingsPartProps<'label'>;
  summary?: ActivityRingsPartProps<'p'>;
}
/** Metric slot props shared by the toggle-button and plain-row legend elements. */
export type ActivityRingsMetricProps = Pick<
  ActivityRingsPartProps<'button'> & ActivityRingsPartProps<'div'>,
  keyof ActivityRingsPartProps<'button'> & keyof ActivityRingsPartProps<'div'>
>;
/**
 * The metric slot targets a toggle button when `interactiveLegend` is `true`, or a row when false
 * or omitted. A runtime boolean accepts only props shared by both elements.
 */
type LegendMode =
  | {
      /** Legend rows become toggle buttons that isolate one ring. */
      interactiveLegend: true;
      slotProps?: ActivityRingsSlotProps & { metric?: ActivityRingsPartProps<'button'> };
    }
  | {
      interactiveLegend?: false;
      slotProps?: ActivityRingsSlotProps & { metric?: ActivityRingsPartProps<'div'> };
    }
  | {
      interactiveLegend?: boolean;
      slotProps?: ActivityRingsSlotProps & { metric?: ActivityRingsMetricProps };
    };
export type ActivityRingsProps = Omit<
  ComponentPropsWithRef<'section'>,
  'children' | 'defaultValue' | 'onChange'
> &
  SxProps &
  DataSource &
  LegendMode & {
    /** Rendered outside → inside. */
    metrics: readonly ActivityMetric[];
    /** Selected day id. A missing id renders the no-selection summary. */
    value?: string | null;
    /** Seeds the selected day once; defaults to the last day. */
    defaultValue?: string | null;
    onValueChange?: (dayId: string) => void;
    focusedMetric?: string | null;
    defaultFocusedMetric?: string | null;
    onFocusedMetricChange?: (metricId: string | null) => void;
    /** Fires once when a same-day value observed below its goal reaches it. */
    onRingClose?: (metricId: string, dayId: string | null) => void;
    size?: ActivityRingsSize;
    locale?: string;
    /** English defaults. */
    labels?: Partial<ActivityRingsLabels>;
    /** Keeps the legend for assistive tech while removing it visually. */
    hideLegend?: boolean;
  };

declare const process: { env: { NODE_ENV?: string } };
const DEFAULT_LABELS: ActivityRingsLabels = {
  root: 'Activity',
  days: 'Day',
  legend: 'Goals',
  unknown: 'No data',
  unavailable: 'Goal unavailable',
  goalMet: 'Goal met',
  noSelection: 'No day selected',
  empty: 'No goals',
  amount: (value, goal) => `${value} of ${goal}`,
  summary: (met, total) => `${met} of ${total} goals met`,
};
const TONES: readonly ActivityTone[] = ['accent', 'success', 'info', 'warning'];
const NO_VALUES: ActivityValues = {};
const NO_DAYS: readonly ActivityDay[] = [];

// Ring geometry in viewBox units: rings fill the band between OUTER_RADIUS and CORE_RADIUS,
// so any metric count fits without negative radii; strokes thin out as rings are added.
const VIEWBOX = 120;
const CENTER = VIEWBOX / 2;
const OUTER_RADIUS = 58;
const CORE_RADIUS = 14;
/** Share of each ring's band drawn as stroke; the rest is the gap to the next ring. */
const STROKE_SHARE = 0.8;
/** Second-lap stroke as a share of the ring stroke, drawn inset over the first lap. */
const LAP_SHARE = 0.4;
/** A second lap is the visual cap: 200% and beyond draws two full laps, the text stays exact. */
const MAX_LAPS = 2;
/** Goal tick length past the ring stroke on both sides, in viewBox units. */
const TICK_OVERHANG = 1;
const MAX_STROKE: Record<ActivityRingsSize, number> = { sm: 16, md: 14, lg: 12 };
const RING_SIZE: Record<ActivityRingsSize, string> = { sm: '7rem', md: '10rem', lg: '14rem' };
/** Root width from which the legend sits beside the rings instead of below them. */
const WIDE_MIN = '32rem';
/** `motion.easeStandard` (tokens.ts) as cubic-bezier numbers; `motion` cannot consume the CSS string. */
const EASE_STANDARD = [0.2, 0.6, 0.2, 1] as const;
const SWEEP = {
  duration: Number.parseFloat(base.motion.duration.slow) / 1000, // e.g. '240ms' -> 0.24s
  ease: EASE_STANDARD,
} as const;

const rootStyle = css({
  label: 'activity-rings',
  minInlineSize: 0,
  fontFamily: vars.font.sans,
  fontSize: vars.textSize.sm,
  lineHeight: vars.lineHeight.base,
  color: vars.color.text,
  overflowWrap: 'anywhere',
});
// Wide/narrow switch from the root's own width, without size containment (which would drop the
// root's intrinsic width in shrink-to-fit parents). The body's flex basis resolves against the
// layout width: below WIDE_MIN it overflows the line, so the body wraps under the centered rings
// and fills the row; from WIDE_MIN it goes negative (floored at zero) and the body fills the space
// beside the rings. A shrink-to-fit parent sizes the root to the rings plus the unwrapped legend
// (capped at the parent), so the rings stack there when that sum is under WIDE_MIN.
const layoutStyle = css({
  display: 'flex',
  flexWrap: 'wrap',
  gap: vars.space[4],
  alignItems: 'center',
  justifyContent: 'center',
});
const bodyStyle = css({
  display: 'grid',
  gap: vars.space[3],
  flex: `1 1 calc((${WIDE_MIN} - 100%) * 999)`,
  minInlineSize: 0,
});
const sizeStyles = {
  sm: css({ '--rings-size': RING_SIZE.sm }),
  md: css({ '--rings-size': RING_SIZE.md }),
  lg: css({ '--rings-size': RING_SIZE.lg, fontSize: vars.textSize.md }),
};
const svgStyle = css({
  display: 'block',
  flex: 'none',
  inlineSize: 'var(--rings-size)',
  maxInlineSize: '100%',
  blockSize: 'auto',
  aspectRatio: '1',
  overflow: 'visible',
});
const ringStyle = css({
  transitionProperty: 'opacity',
  transitionDuration: vars.motion.duration.base,
  transitionTimingFunction: vars.motion.easeStandard,
  '&[data-dimmed="true"]': { opacity: 0.3 },
  [REDUCED_MOTION]: { transitionDuration: '0s' },
  [FORCED_COLORS]: { '&[data-dimmed="true"]': { opacity: 1 } },
});
const trackStyle = css({
  fill: 'none',
  stroke: vars.color.surfaceHover,
  [FORCED_COLORS]: {
    stroke: 'GrayText',
    '&[data-pattern="dashed"]': { strokeDasharray: '2 2' },
  },
});
const fillStyle = css({
  fill: 'none',
  stroke: 'var(--ring-tone)',
  [FORCED_COLORS]: { stroke: 'CanvasText' },
  '[data-dimmed="true"] > &': { [FORCED_COLORS]: { stroke: 'GrayText' } },
});
const lapStyle = css({
  fill: 'none',
  stroke: vars.color.bg,
  [FORCED_COLORS]: { stroke: 'Canvas' },
});
const tickStyle = css({
  stroke: vars.color.text,
  strokeWidth: 1,
  [FORCED_COLORS]: { stroke: 'CanvasText' },
});
const summaryStyle = css({ margin: 0, fontWeight: vars.fontWeight.medium });
const legendStyle = css({
  display: 'grid',
  gap: vars.space[2],
  padding: 0,
  margin: 0,
  listStyle: 'none',
});
const metricStyle = css({
  display: 'grid',
  gridTemplateColumns: 'auto auto minmax(0, 1fr)',
  columnGap: vars.space[2],
  alignItems: 'baseline',
  inlineSize: '100%',
  minInlineSize: 0,
  minBlockSize: vars.space[8],
  boxSizing: 'border-box',
  paddingBlock: vars.space[1],
  paddingInline: vars.space[2],
  textAlign: 'start',
  font: 'inherit',
  color: 'inherit',
  backgroundColor: 'transparent',
  border: '1px solid transparent',
  borderRadius: vars.radius.md,
  'button&': {
    cursor: 'pointer',
    backgroundColor: vars.color.surfaceRaised,
    borderColor: vars.color.borderControl,
    boxShadow: vars.shadow.raised,
  },
  '&[aria-pressed="true"]': {
    outline: `2px solid ${vars.color.text}`,
    outlineOffset: '-2px',
    fontWeight: vars.fontWeight.semibold,
  },
  '&:focus-visible': focusRingOutset,
  [FORCED_COLORS]: {
    'button&': { borderColor: 'CanvasText' },
    '&[aria-pressed="true"]': { outlineColor: 'Highlight' },
    '&:focus-visible': { outlineColor: 'Highlight' },
  },
});
const indexStyle = css({
  fontSize: vars.textSize.xs,
  fontWeight: vars.fontWeight.medium,
  color: vars.color.textMuted,
});
const swatchStyle = css({
  display: 'inline-block',
  inlineSize: '0.75em',
  blockSize: '0.75em',
  borderRadius: vars.radius.full,
  backgroundColor: 'var(--ring-tone)',
  border: `1px solid ${vars.color.borderControl}`,
  [FORCED_COLORS]: { backgroundColor: 'CanvasText', borderColor: 'CanvasText' },
});
const metricLabelStyle = css({ fontWeight: vars.fontWeight.medium });
const metricDetailStyle = css({
  gridColumn: '3',
  display: 'flex',
  flexWrap: 'wrap',
  columnGap: vars.space[2],
  color: vars.color.textMuted,
});
const statusStyle = css({ color: vars.color.text });
const dayPickerStyle = css({
  display: 'flex',
  flexWrap: 'wrap',
  gap: vars.space[1],
  minInlineSize: 0,
  margin: 0,
  padding: 0,
  border: 0,
});
const dayLabelStyle = css({
  position: 'relative',
  display: 'inline-grid',
  placeItems: 'center',
  minInlineSize: vars.space[10],
  minBlockSize: vars.space[10],
  boxSizing: 'border-box',
  paddingInline: vars.space[2],
  paddingBlock: vars.space[1],
  borderRadius: vars.radius.md,
  border: `1px solid ${vars.color.borderControl}`,
  backgroundColor: vars.color.surfaceRaised,
  fontSize: vars.textSize.xs,
  lineHeight: vars.lineHeight.tight,
  textAlign: 'center',
  cursor: 'pointer',
  transitionProperty: 'background-color, border-color',
  transitionDuration: vars.motion.duration.base,
  transitionTimingFunction: vars.motion.easeStandard,
  '&:has(input:checked)': {
    borderColor: vars.color.text,
    outline: `1px solid ${vars.color.text}`,
    outlineOffset: '-2px',
    fontWeight: vars.fontWeight.semibold,
  },
  '&:has(input:focus-visible)': focusRingOutset,
  [REDUCED_MOTION]: { transitionDuration: '0s' },
  [FORCED_COLORS]: {
    borderColor: 'CanvasText',
    '&:has(input:checked)': { borderColor: 'Highlight', outlineColor: 'Highlight' },
    '&:has(input:focus-visible)': { outlineColor: 'Highlight' },
  },
});
const radioStyle = css({
  position: 'absolute',
  inset: 0,
  margin: 0,
  opacity: 0,
  cursor: 'pointer',
});
const dayNumberStyle = css({ fontSize: vars.textSize.sm, fontWeight: vars.fontWeight.medium });

function joinIds(...ids: (string | undefined | false)[]) {
  return ids.filter(Boolean).join(' ') || undefined;
}
const clampLap = (ratio: number) => Math.min(1, Math.max(0, ratio));
const toneStyle = (metric: ActivityMetric, index: number) =>
  ({ '--ring-tone': vars.color[metric.tone ?? TONES[index % TONES.length]!] }) as CSSProperties;

function readValue(values: ActivityValues, id: string): number | null {
  const value = Object.hasOwn(values, id) ? values[id] : null;
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : null;
}

/** Unit formats for sanctioned units; any other unit falls back to the plain amount format. */
function ringFormats(locale: string | undefined, unit: string | undefined) {
  if (!unit) return createUsageFormats(locale);
  try {
    return createUsageFormats(locale, { style: 'unit', unit, unitDisplay: 'short' });
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    return createUsageFormats(locale);
  }
}

function summarizeRing(
  metric: ActivityMetric,
  values: ActivityValues | null,
  locale: string | undefined,
  labels: ActivityRingsLabels,
): ActivityRingSummary {
  const value = values ? readValue(values, metric.id) : null;
  if (value === null) return { metric, status: 'unknown', value, usage: null };
  const usage = summarizeUsage(value, metric.goal, {
    formats: ringFormats(locale, metric.unit),
    unavailable: labels.unavailable,
    formatAmount: metric.formatValue && ((amount) => metric.formatValue!(amount, locale)),
  });
  const status: ActivityRingStatus =
    usage.state === 'unavailable' ? 'unavailable' : usage.ratio >= 1 ? 'closed' : 'open';
  return { metric, status, value, usage };
}

interface RingStrokeProps {
  radius: number;
  strokeWidth: number;
  /** Target sweep in laps (0–1). */
  laps: number;
  className?: string;
  'data-ui': string;
}

/** Sweeps from the displayed length to `laps` through a motion value: no React render per frame. */
function RingStroke({ laps, radius, strokeWidth, className, ...rest }: RingStrokeProps) {
  const reduced = useReducedMotion();
  const length = useMotionValue(reduced ? laps : 0);
  useEffect(() => {
    if (reduced) {
      length.set(laps);
      return;
    }
    const controls = animate(length, laps, SWEEP);
    return () => controls.stop();
  }, [laps, reduced, length]);
  return (
    <motion.circle
      {...rest}
      cx={CENTER}
      cy={CENTER}
      r={radius}
      strokeWidth={strokeWidth}
      strokeLinecap="butt"
      data-laps={laps}
      className={className}
      style={{ pathLength: length }}
    />
  );
}

/**
 * Compare each metric with its goal using the UsageMeter value rules. The SVG is decorative;
 * the legend gives amounts, goals, and percentages. The optional day picker uses native radios
 * with arrows and Home/End. Enable legend toggle buttons to isolate a ring with Enter/Space.
 */
export function ActivityRings({
  ref,
  metrics,
  values: valuesProp,
  days: daysProp,
  value,
  defaultValue,
  onValueChange,
  focusedMetric,
  defaultFocusedMetric = null,
  onFocusedMetricChange,
  interactiveLegend = false,
  onRingClose,
  size = 'md',
  locale,
  labels: labelsProp,
  hideLegend = false,
  slotProps,
  className,
  sx,
  'aria-label': ariaLabel,
  'aria-labelledby': labelledBy,
  ...rest
}: ActivityRingsProps) {
  const id = useId();
  const titleId = `${id}-title`;
  const labels = { ...DEFAULT_LABELS, ...labelsProp };
  const days = daysProp ?? NO_DAYS;
  const hasDays = daysProp !== undefined && days.length > 0;
  const [selectedDay, requestDay] = useControlledState<string | null>(
    value,
    defaultValue !== undefined ? defaultValue : (days.at(-1)?.id ?? null),
    (next) => {
      if (next !== null) onValueChange?.(next);
    },
  );
  const [focused, requestFocused] = useControlledState<string | null>(
    focusedMetric,
    defaultFocusedMetric,
    onFocusedMetricChange,
  );
  const day = hasDays ? days.find((item) => item.id === selectedDay) : undefined;
  const values = hasDays ? (day?.values ?? null) : (valuesProp ?? NO_VALUES);
  const dayKey = hasDays ? (day?.id ?? null) : null;
  const rings = metrics.map((metric) => summarizeRing(metric, values, locale, labels));
  const isolated = rings.some((ring) => ring.metric.id === focused) ? focused : null;
  const count = createUsageFormats(locale).index;
  const met = rings.filter((ring) => ring.status === 'closed').length;
  const dateFormats = {
    full: new Intl.DateTimeFormat(locale, { ...CIVIL_DATE_FORMAT_OPTIONS, dateStyle: 'full' }),
    weekday: new Intl.DateTimeFormat(locale, { ...CIVIL_DATE_FORMAT_OPTIONS, weekday: 'short' }),
    day: new Intl.DateTimeFormat(locale, { ...CIVIL_DATE_FORMAT_OPTIONS, day: 'numeric' }),
  };
  const dayName = (item: ActivityDay) =>
    isIsoDate(item.date) ? dateFormats.full.format(dateFromIso(item.date)) : item.id;
  const summaryText =
    metrics.length === 0
      ? labels.empty
      : hasDays && !day
        ? labels.noSelection
        : labels.summary(count.format(met), count.format(metrics.length));

  // External-data notification only: a same-day value observed below its goal that reaches it.
  // Mount, remount and day switches set the baseline silently; unknown → known never counts.
  const baseline = useRef<{ dayKey: string | null; ratios: Map<string, number | null> } | null>(null);
  const ratioSignature = rings.map((ring) => `${ring.metric.id}:${ring.usage?.ratio ?? ''}`).join('|');
  useEffect(() => {
    const ratios = new Map(
      rings.map((ring) => [
        ring.metric.id,
        ring.status === 'open' || ring.status === 'closed' ? ring.usage!.ratio : null,
      ]),
    );
    const previous = baseline.current;
    baseline.current = { dayKey, ratios };
    if (!previous || previous.dayKey !== dayKey) return;
    for (const [metricId, ratio] of ratios) {
      const before = previous.ratios.get(metricId);
      if (before != null && ratio != null && before < 1 && ratio >= 1) onRingClose?.(metricId, dayKey);
    }
    // `ratioSignature` encodes every metric id and ratio the effect reads, so [dayKey,
    // ratioSignature] covers all its inputs; `rings` is this render's derivation of them, and
    // `onRingClose` is read from the render that changed them, so it is never stale.
  }, [dayKey, ratioSignature]);

  useEffect(() => {
    if (
      process.env.NODE_ENV !== 'production' &&
      (metrics.some((metric) => !metric.id) ||
        new Set(metrics.map((metric) => metric.id)).size !== metrics.length)
    ) {
      console.warn('ActivityRings: metric ids must be nonempty and unique.');
    }
  }, [metrics]);

  const radios = useRef(new Map<string, HTMLInputElement>());
  const onDayKeyDown = (event: KeyboardEvent<HTMLFieldSetElement>) => {
    slotProps?.dayPicker?.onKeyDown?.(event);
    if (event.defaultPrevented || (event.key !== 'Home' && event.key !== 'End')) return;
    const target = event.key === 'Home' ? days[0] : days.at(-1);
    if (!target) return;
    event.preventDefault();
    radios.current.get(target.id)?.focus();
    requestDay(target.id);
  };

  const band = (OUTER_RADIUS - CORE_RADIUS) / Math.max(1, rings.length);
  const stroke = Math.min(MAX_STROKE[size], band * STROKE_SHARE);
  const ringsSlot = slotProps?.rings;
  const legendSlot = slotProps?.legend;
  // Re-pair the destructured props so the metric slot narrows with the legend mode.
  const legendMode = { interactiveLegend, slotProps } as LegendMode;
  const metricButtonSlot = legendMode.interactiveLegend ? (legendMode.slotProps?.metric ?? {}) : null;
  const metricRowSlot = legendMode.interactiveLegend ? undefined : legendMode.slotProps?.metric;
  const pickerSlot = slotProps?.dayPicker;
  const dayLabelSlot = slotProps?.dayLabel;
  const summarySlot = slotProps?.summary;

  return (
    <WithSx className={className} styles={[rootStyle, sizeStyles[size]]} sx={sx}>
      {(resolvedClassName) => (
        <section
          {...rest}
          ref={ref}
          data-ui="activity-rings"
          data-size={size}
          className={resolvedClassName}
          aria-label={ariaLabel}
          aria-labelledby={joinIds(labelledBy, ariaLabel === undefined && titleId)}
        >
          {ariaLabel === undefined && (
            <span id={titleId} hidden>
              {labels.root}
            </span>
          )}
          <div css={layoutStyle}>
            <MotionConfig reducedMotion="user">
              <svg
                {...ringsSlot}
                data-ui="activity-rings-rings"
                viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}
                aria-hidden="true"
                focusable="false"
                css={[svgStyle, ringsSlot?.css]}
              >
                <g transform={`rotate(-90 ${CENTER} ${CENTER})`}>
                  {rings.map((ring, index) => {
                    const radius = OUTER_RADIUS - stroke / 2 - index * band;
                    const ratio = ring.usage && ring.status !== 'unavailable' ? ring.usage.ratio : 0;
                    return (
                      <g
                        key={ring.metric.id}
                        data-ui="activity-rings-ring"
                        data-status={ring.status}
                        data-dimmed={isolated !== null && isolated !== ring.metric.id}
                        style={toneStyle(ring.metric, index)}
                        css={ringStyle}
                      >
                        <circle
                          data-ui="activity-rings-track"
                          data-pattern={index % 2 ? 'dashed' : 'solid'}
                          cx={CENTER}
                          cy={CENTER}
                          r={radius}
                          strokeWidth={stroke}
                          css={trackStyle}
                        />
                        <RingStroke
                          data-ui="activity-rings-fill"
                          radius={radius}
                          strokeWidth={stroke}
                          laps={clampLap(ratio)}
                          css={fillStyle}
                        />
                        {ratio > 1 && (
                          <RingStroke
                            data-ui="activity-rings-lap"
                            radius={radius}
                            strokeWidth={stroke * LAP_SHARE}
                            laps={clampLap(Math.min(ratio, MAX_LAPS) - 1)}
                            css={lapStyle}
                          />
                        )}
                        {(ring.status === 'open' || ring.status === 'closed') && (
                          <line
                            data-ui="activity-rings-tick"
                            x1={CENTER + radius + stroke / 2 + TICK_OVERHANG}
                            x2={CENTER + radius - stroke / 2 - TICK_OVERHANG}
                            y1={CENTER}
                            y2={CENTER}
                            css={tickStyle}
                          />
                        )}
                      </g>
                    );
                  })}
                </g>
              </svg>
            </MotionConfig>
            <div css={bodyStyle}>
              <p
                {...summarySlot}
                data-ui="activity-rings-summary"
                css={[summaryStyle, summarySlot?.css]}
              >
                {day && <>{dayName(day)} · </>}
                {summaryText}
              </p>
              {hasDays && (
                <fieldset
                  {...pickerSlot}
                  data-ui="activity-rings-days"
                  css={[dayPickerStyle, pickerSlot?.css]}
                  onKeyDown={onDayKeyDown}
                >
                  <legend css={visuallyHiddenStyle}>{labels.days}</legend>
                  {days.map((item) => {
                    const civil = isIsoDate(item.date) ? dateFromIso(item.date) : null;
                    return (
                      <label
                        {...dayLabelSlot}
                        key={item.id}
                        data-ui="activity-rings-day"
                        css={[dayLabelStyle, dayLabelSlot?.css]}
                      >
                        <input
                          ref={(node) => {
                            if (!node) return;
                            radios.current.set(item.id, node);
                            return () => {
                              radios.current.delete(item.id);
                            };
                          }}
                          type="radio"
                          name={`${id}-day`}
                          value={item.id}
                          checked={item.id === selectedDay}
                          onChange={() => requestDay(item.id)}
                          css={radioStyle}
                        />
                        <span css={visuallyHiddenStyle}>{dayName(item)}</span>
                        <span aria-hidden="true">
                          {civil ? dateFormats.weekday.format(civil) : item.id}
                        </span>
                        {civil && (
                          <span aria-hidden="true" css={dayNumberStyle}>
                            {dateFormats.day.format(civil)}
                          </span>
                        )}
                      </label>
                    );
                  })}
                </fieldset>
              )}
              {rings.length > 0 && (
                <ul
                  {...legendSlot}
                  data-ui="activity-rings-legend"
                  aria-label={legendSlot?.['aria-label'] ?? labels.legend}
                  css={[legendStyle, hideLegend && visuallyHiddenStyle, legendSlot?.css]}
                >
                  {rings.map((ring, index) => {
                    const { metric, usage, status } = ring;
                    const pressed = isolated === metric.id;
                    const contents = (
                      <>
                        <span aria-hidden="true" css={indexStyle}>
                          {count.format(index + 1)}
                        </span>
                        <span aria-hidden="true" css={swatchStyle} style={toneStyle(metric, index)} />
                        <span css={metricLabelStyle}>{metric.label}</span>
                        <span css={metricDetailStyle} data-ui="activity-rings-detail">
                          {status === 'unknown' || !usage ? (
                            <span>{labels.unknown}</span>
                          ) : status === 'unavailable' ? (
                            <>
                              <span>{usage.formattedTotal}</span>
                              <span css={statusStyle}>{labels.unavailable}</span>
                            </>
                          ) : (
                            <>
                              <span>{labels.amount(usage.formattedTotal, usage.formattedLimit)}</span>
                              <span>{usage.formattedPercent}</span>
                              {status === 'closed' && (
                                <span css={statusStyle}>
                                  <span aria-hidden="true">✓ </span>
                                  {labels.goalMet}
                                </span>
                              )}
                            </>
                          )}
                        </span>
                      </>
                    );
                    return (
                      <li key={metric.id}>
                        {metricButtonSlot ? (
                          <button
                            {...metricButtonSlot}
                            type="button"
                            data-ui="activity-rings-metric"
                            data-status={status}
                            aria-pressed={pressed}
                            css={[metricStyle, metricButtonSlot.css]}
                            onClick={(event) => {
                              metricButtonSlot.onClick?.(event);
                              if (!event.defaultPrevented) requestFocused(pressed ? null : metric.id);
                            }}
                          >
                            {contents}
                          </button>
                        ) : (
                          <div
                            {...metricRowSlot}
                            data-ui="activity-rings-metric"
                            data-status={status}
                            css={[metricStyle, metricRowSlot?.css]}
                          >
                            {contents}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </section>
      )}
    </WithSx>
  );
}
ActivityRings.displayName = 'ActivityRings';
