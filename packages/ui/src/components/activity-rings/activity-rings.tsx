'use client';

import {
  useEffect,
  useId,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type ComponentPropsWithRef,
  type CSSProperties,
  type KeyboardEvent,
} from 'react';
import { MotionConfig, animate, motion, useMotionValue, useReducedMotion, useTransform } from 'motion/react';
import { vars } from '@jfrader/tokens/vars';
import { css, type Interpolation, type Theme } from '../../styling/css';
import { focusRingOutset } from '../../styling/focus-ring';
import { FORCED_COLORS, REDUCED_MOTION } from '../../styling/media';
import { motionDurationMs } from '../../styling/motion-timings';
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
  /** Ring colour for known values, including met goals. Omit for the neutral positional palette. */
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
  /** Caption under the mean completion percentage. */
  completion?: string;
  /** Formats the amount above a valid goal, including the surplus sign and caption. */
  overGoal?: (amount: string) => string;
  amount: (value: string, goal: string) => string;
  summary: (met: string, total: string) => string;
}
type PartElement = 'svg' | 'ul' | 'button' | 'div' | 'fieldset' | 'label' | 'p';
export type ActivityRingsPartProps<T extends PartElement> = Omit<ComponentPropsWithoutRef<T>, 'children'> & {
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
const DEFAULT_LABELS = {
  root: 'Activity',
  days: 'Day',
  legend: 'Goals',
  unknown: 'No data',
  unavailable: 'Goal unavailable',
  goalMet: 'Goal met',
  noSelection: 'No day selected',
  empty: 'No goals',
  completion: 'of goals',
  overGoal: (amount: string) => `+${amount} over goal`,
  amount: (value, goal) => `${value} of ${goal}`,
  summary: (met, total) => `${met} of ${total} goals met`,
} satisfies ActivityRingsLabels;
const CATEGORY_COLORS = [vars.color.text, vars.color.textMuted, vars.color.textSubtle];
const NO_VALUES: ActivityValues = {};
const NO_DAYS: readonly ActivityDay[] = [];

// Ring geometry in viewBox units: rings fill the band between OUTER_RADIUS and CORE_RADIUS,
// so any metric count fits without negative radii; strokes thin out as rings are added.
const VIEWBOX = 120;
const CENTER = VIEWBOX / 2;
const OUTER_RADIUS = 58;
const CORE_RADIUS = 27;
/** Share of each ring's band drawn as stroke; the rest is the gap to the next ring. */
const STROKE_SHARE = 0.55;
const TICK_SPACING = 6;
const MIN_TICKS = 24;
const TICK_FILL_SHARE = 0.35;
const MAX_STROKE: Record<ActivityRingsSize, number> = { sm: 16, md: 14, lg: 12 };
const RING_SIZE: Record<ActivityRingsSize, string> = { sm: '10rem', md: '13.5rem', lg: '16rem' };
/** Root width from which the legend sits beside the rings instead of below them. */
const WIDE_MIN = '30rem';
/** `motion.easeStandard` (tokens.ts) as cubic-bezier numbers; `motion` cannot consume the CSS string. */
const EASE_STANDARD = [0.2, 0.6, 0.2, 1] as const;
const SWEEP = {
  duration: motionDurationMs.slow / 1000,
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
const dialStyle = css({
  display: 'grid',
  flex: 'none',
  inlineSize: 'var(--rings-size)',
  maxInlineSize: '100%',
  '& > *': { gridArea: '1 / 1' },
});
const centerStyle = css({
  alignSelf: 'center',
  justifySelf: 'center',
  inlineSize: '44%',
  textAlign: 'center',
  minInlineSize: 0,
  lineHeight: vars.lineHeight.tight,
  fontVariantNumeric: 'tabular-nums',
  pointerEvents: 'none',
});
const centerNumberStyle = css({
  display: 'block',
  fontSize: 'var(--rings-figure-size)',
  fontWeight: vars.fontWeight.semibold,
  '&[data-focused="true"]': {
    fontSize: vars.textSize.xl,
    display: '-webkit-box',
    WebkitBoxOrient: 'vertical',
    WebkitLineClamp: 2,
    overflow: 'hidden',
  },
});
const centerCaptionStyle = css({
  display: '-webkit-box',
  WebkitBoxOrient: 'vertical',
  WebkitLineClamp: 2,
  overflow: 'hidden',
  marginBlockStart: vars.space[1],
  fontSize: vars.textSize.xs,
  color: vars.color.textMuted,
});
const bodyStyle = css({
  display: 'grid',
  gap: vars.space[3],
  flex: `1 1 calc((${WIDE_MIN} - 100%) * 999)`,
  minInlineSize: 0,
});
const sizeStyles = {
  sm: css({ '--rings-size': RING_SIZE.sm, '--rings-figure-size': vars.textSize.xl }),
  md: css({ '--rings-size': RING_SIZE.md, '--rings-figure-size': vars.textSize['3xl'] }),
  lg: css({
    '--rings-size': RING_SIZE.lg,
    '--rings-figure-size': vars.textSize['3xl'],
    fontSize: vars.textSize.md,
  }),
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
  stroke: vars.color.border,
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
const LEGEND_INSET = vars.space[2];
const LEGEND_BORDER_WIDTH = '1px';
const summaryStyle = css({
  marginBlock: 0,
  marginInline: `calc(${LEGEND_INSET} + ${LEGEND_BORDER_WIDTH})`,
  color: vars.color.textMuted,
  fontSize: vars.textSize.xs,
});
const legendStyle = css({
  display: 'grid',
  gap: 0,
  padding: 0,
  margin: 0,
  listStyle: 'none',
  '& > li + li': { borderBlockStart: `1px solid ${vars.color.border}` },
});
const metricStyle = css({
  display: 'grid',
  gridTemplateColumns: 'auto minmax(0, 1fr) auto',
  columnGap: vars.space[2],
  alignItems: 'baseline',
  inlineSize: '100%',
  minInlineSize: 0,
  minBlockSize: vars.space[8],
  boxSizing: 'border-box',
  paddingBlock: vars.space[2],
  paddingInline: LEGEND_INSET,
  textAlign: 'start',
  font: 'inherit',
  color: 'inherit',
  backgroundColor: 'transparent',
  border: `${LEGEND_BORDER_WIDTH} solid transparent`,
  borderRadius: vars.radius.sm,
  'button&': {
    cursor: 'pointer',
    '&:hover, &[data-preview="true"]': { backgroundColor: vars.color.surfaceHover },
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
  display: 'none',
  fontSize: vars.textSize.xs,
  fontWeight: vars.fontWeight.medium,
  color: vars.color.textMuted,
  [FORCED_COLORS]: { display: 'inline' },
});
const swatchStyle = css({
  display: 'inline-block',
  inlineSize: vars.space[2],
  blockSize: vars.space[2],
  backgroundColor: 'var(--ring-tone)',
  border: `1px solid ${vars.color.borderControl}`,
  [FORCED_COLORS]: { backgroundColor: 'CanvasText', borderColor: 'CanvasText' },
});
const metricLabelStyle = css({ fontWeight: vars.fontWeight.medium });
const metricDetailStyle = css({
  gridColumn: '2',
  display: 'flex',
  flexWrap: 'wrap',
  columnGap: vars.space[2],
  color: vars.color.textMuted,
  fontSize: vars.textSize.xs,
  fontVariantNumeric: 'tabular-nums',
});
const metricPercentStyle = css({
  gridColumn: '3',
  gridRow: '1 / span 2',
  alignSelf: 'center',
  fontVariantNumeric: 'tabular-nums',
  whiteSpace: 'nowrap',
});
const statusStyle = css({ color: vars.color.text });
const metricStatusStyle = css({
  gridColumn: '2 / -1',
  fontSize: vars.textSize.xs,
  color: vars.color.textMuted,
  fontVariantNumeric: 'tabular-nums',
});
const dayPickerStyle = css({
  display: 'flex',
  flexWrap: 'wrap',
  gap: vars.space[1],
  minInlineSize: 0,
  margin: 0,
  padding: 0,
  border: 0,
  marginBlockStart: vars.space[4],
  justifyContent: 'center',
});
const dayLabelStyle = css({
  position: 'relative',
  display: 'inline-grid',
  placeItems: 'center',
  minInlineSize: vars.space[10],
  minBlockSize: vars.space[10],
  boxSizing: 'border-box',
  paddingInline: vars.space[1],
  paddingBlock: vars.space[1],
  borderRadius: vars.radius.md,
  border: '1px solid transparent',
  backgroundColor: 'transparent',
  fontSize: vars.textSize.xs,
  lineHeight: vars.lineHeight.tight,
  textAlign: 'center',
  cursor: 'pointer',
  transitionProperty: 'background-color, border-color',
  transitionDuration: vars.motion.duration.base,
  transitionTimingFunction: vars.motion.easeStandard,
  '&:has(input:checked)': {
    backgroundColor: vars.color.surfaceHover,
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
const miniatureStyle = css({
  inlineSize: vars.space[8],
  blockSize: vars.space[8],
  marginBlockEnd: vars.space[1],
});
const miniatureMissingStyle = css({
  fill: vars.color.textMuted,
  fontSize: vars.textSize['3xl'],
  [FORCED_COLORS]: { fill: 'CanvasText' },
});

function joinIds(...ids: (string | undefined | false)[]) {
  return ids.filter(Boolean).join(' ') || undefined;
}
const clampCompletion = (ratio: number) => Math.min(1, Math.max(0, ratio));
const toneStyle = (metric: ActivityMetric, index: number, valid: boolean) =>
  ({
    '--ring-tone': !valid
      ? vars.color.textMuted
      : metric.tone
        ? vars.color[metric.tone]
        : CATEGORY_COLORS[index % CATEGORY_COLORS.length]!,
  }) as CSSProperties;

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

function useDisplayedNumber(target: number) {
  const reduced = useReducedMotion();
  const displayed = useMotionValue(reduced ? target : 0);
  useEffect(() => {
    if (reduced) {
      displayed.set(target);
      return;
    }
    const controls = animate(displayed, target, SWEEP);
    return () => controls.stop();
  }, [target, reduced, displayed]);
  return displayed;
}

function Count({ value, format }: { value: number; format: (value: number) => string }) {
  const node = useRef<HTMLSpanElement>(null);
  const displayed = useDisplayedNumber(value);
  useEffect(() => {
    const write = (next: number) => {
      if (node.current) node.current.textContent = format(next);
    };
    write(displayed.get());
    return displayed.on('change', write);
  }, [displayed, format]);
  return <span ref={node} data-ui="activity-rings-count" />;
}

function RingPlot({
  ring,
  index,
  band,
  stroke,
  dimmed,
}: {
  ring: ActivityRingSummary;
  index: number;
  band: number;
  stroke: number;
  dimmed: boolean;
}) {
  const maskId = useId();
  const radius = OUTER_RADIUS - stroke / 2 - index * band;
  const valid = ring.status === 'open' || ring.status === 'closed';
  const ratio = valid ? ring.usage!.ratio : 0;
  const displayed = useDisplayedNumber(ratio);
  const completion = useTransform(displayed, clampCompletion);
  const tickCount = Math.max(MIN_TICKS, Math.round((2 * Math.PI * radius) / TICK_SPACING));
  const tickStep = (2 * Math.PI * radius) / tickCount;
  const ticks = `${tickStep * TICK_FILL_SHARE} ${tickStep * (1 - TICK_FILL_SHARE)}`;
  return (
    <g
      data-ui="activity-rings-ring"
      data-status={ring.status}
      data-dimmed={dimmed}
      style={toneStyle(ring.metric, index, valid)}
      css={ringStyle}
    >
      <defs>
        <mask id={maskId} style={{ maskType: 'alpha' }}>
          <motion.circle
            data-ui="activity-rings-fill"
            cx={CENTER}
            cy={CENTER}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={stroke + 1}
            data-progress={clampCompletion(ratio)}
            style={{ pathLength: completion }}
          />
        </mask>
      </defs>
      <circle
        data-ui="activity-rings-track"
        data-pattern={index % 2 ? 'dashed' : 'solid'}
        cx={CENTER}
        cy={CENTER}
        r={radius}
        strokeWidth={stroke}
        strokeDasharray={ticks}
        css={trackStyle}
      />
      <circle
        cx={CENTER}
        cy={CENTER}
        r={radius}
        strokeWidth={stroke}
        strokeDasharray={ticks}
        mask={`url(#${maskId})`}
        css={fillStyle}
      />
    </g>
  );
}

function DayPreview({
  metrics,
  values,
  locale,
  labels,
}: {
  metrics: readonly ActivityMetric[];
  values: ActivityValues;
  locale: string | undefined;
  labels: ActivityRingsLabels;
}) {
  const band = (OUTER_RADIUS - CORE_RADIUS) / Math.max(1, metrics.length);
  const rings = metrics.map((metric) => summarizeRing(metric, values, locale, labels));
  return (
    <svg viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`} aria-hidden="true" focusable="false" css={miniatureStyle}>
      <g transform={`rotate(-90 ${CENTER} ${CENTER})`}>
        {rings.map((ring, index) => {
          const { metric } = ring;
          const valid = ring.status === 'open' || ring.status === 'closed';
          const radius = OUTER_RADIUS - band / 2 - index * band;
          return (
            <g key={metric.id} style={toneStyle(metric, index, valid)} data-status={ring.status}>
              <circle
                cx={CENTER}
                cy={CENTER}
                r={radius}
                strokeWidth={band * STROKE_SHARE}
                strokeDasharray={valid ? undefined : '3 5'}
                css={trackStyle}
              />
              {valid && (
                <circle
                  cx={CENTER}
                  cy={CENTER}
                  r={radius}
                  strokeWidth={band * STROKE_SHARE}
                  pathLength={1}
                  strokeDasharray={`${clampCompletion(ring.usage!.ratio)} 1`}
                  css={fillStyle}
                />
              )}
            </g>
          );
        })}
      </g>
      {rings.some((ring) => ring.status === 'unknown' || ring.status === 'unavailable') && (
        <text
          x={CENTER}
          y={CENTER}
          textAnchor="middle"
          dominantBaseline="central"
          css={miniatureMissingStyle}
        >
          —
        </text>
      )}
    </svg>
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
  const overGoal = labels.overGoal ?? DEFAULT_LABELS.overGoal;
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
  const [hovered, setHovered] = useState<string | null>(null);
  const [keyboardPreview, setKeyboardPreview] = useState<string | null>(null);
  const day = hasDays ? days.find((item) => item.id === selectedDay) : undefined;
  const values = hasDays ? (day?.values ?? null) : (valuesProp ?? NO_VALUES);
  const dayKey = hasDays ? (day?.id ?? null) : null;
  const rings = metrics.map((metric) => summarizeRing(metric, values, locale, labels));
  const isolated = rings.some((ring) => ring.metric.id === focused) ? focused : null;
  const preview = interactiveLegend ? (hovered ?? keyboardPreview) : null;
  const active = rings.some((ring) => ring.metric.id === preview) ? preview : isolated;
  const activeRing = rings.find((ring) => ring.metric.id === active);
  const activeFormats = ringFormats(locale, activeRing?.metric.unit);
  const allKnown =
    rings.length > 0 && rings.every((ring) => ring.status === 'open' || ring.status === 'closed');
  const completion = allKnown
    ? rings.reduce((total, ring) => total + clampCompletion(ring.usage!.ratio), 0) / rings.length
    : null;
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
        : rings.every((ring) => ring.status === 'unavailable')
          ? labels.unavailable
          : rings.every((ring) => ring.status === 'unknown' || ring.status === 'unavailable')
            ? labels.unknown
            : labels.summary(count.format(met), count.format(metrics.length));

  // External-data notification only: a same-day value observed below its goal that reaches it.
  // Mount, remount and day switches set the baseline silently; unknown → known never counts.
  const baseline = useRef<{ dayKey: string | null; ratios: Map<string, number | null> } | null>(null);
  const ratioSignature = JSON.stringify(
    rings.map((ring) => [ring.metric.id, ring.status, ring.usage?.ratio]),
  );
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
    // `ratioSignature` encodes every metric id, validity and ratio the effect reads, so [dayKey,
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
          <MotionConfig reducedMotion="user">
            <div css={layoutStyle}>
              {rings.length > 0 && (
                <div css={dialStyle}>
                  <svg
                    {...ringsSlot}
                    data-ui="activity-rings-rings"
                    viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}
                    aria-hidden="true"
                    focusable="false"
                    css={[svgStyle, ringsSlot?.css]}
                  >
                    <g transform={`rotate(-90 ${CENTER} ${CENTER})`}>
                      {rings.map((ring, index) => (
                        <RingPlot
                          key={ring.metric.id}
                          ring={ring}
                          index={index}
                          band={band}
                          stroke={stroke}
                          dimmed={active !== null && active !== ring.metric.id}
                        />
                      ))}
                    </g>
                  </svg>
                  <div
                    aria-hidden="true"
                    css={centerStyle}
                    data-ui="activity-rings-center"
                    data-metric={active ?? undefined}
                  >
                    <span css={centerNumberStyle} data-focused={!!activeRing}>
                      {activeRing ? (
                        activeRing.value === null ? (
                          '—'
                        ) : (
                          <Count
                            key={activeRing.metric.id}
                            value={activeRing.value}
                            format={(next) =>
                              activeRing.metric.formatValue?.(next, locale) ??
                              activeFormats.amount.format(next)
                            }
                          />
                        )
                      ) : completion === null ? (
                        '—'
                      ) : (
                        <Count
                          key="completion"
                          value={completion}
                          format={createUsageFormats(locale).percent.format}
                        />
                      )}
                    </span>
                    <span css={centerCaptionStyle}>
                      {activeRing?.metric.label ?? (completion === null ? labels.unknown : labels.completion)}
                    </span>
                  </div>
                </div>
              )}
              <div css={bodyStyle}>
                <p {...summarySlot} data-ui="activity-rings-summary" css={[summaryStyle, summarySlot?.css]}>
                  {day && <>{dayName(day)} · </>}
                  {summaryText}
                  {completion !== null && (
                    <span css={visuallyHiddenStyle}>
                      {' · '}
                      {createUsageFormats(locale).percent.format(completion)} {labels.completion}
                    </span>
                  )}
                </p>
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
                      const valid = status === 'open' || status === 'closed';
                      const formats = ringFormats(locale, metric.unit);
                      const formatAmount = (next: number) =>
                        metric.formatValue?.(next, locale) ?? formats.amount.format(next);
                      const metLabel =
                        usage && usage.over > 0 ? overGoal(formatAmount(usage.over)) : labels.goalMet;
                      const committedDetail = !usage
                        ? labels.unknown
                        : status === 'unavailable'
                          ? `${usage.formattedTotal} · ${labels.unavailable}`
                          : [
                              labels.amount(usage.formattedTotal, usage.formattedLimit),
                              usage.formattedPercent,
                              ...(status === 'closed' ? [metLabel] : []),
                            ].join(' · ');
                      const contents = (
                        <>
                          <span aria-hidden="true">
                            <span css={indexStyle}>{count.format(index + 1)} </span>
                            <span css={swatchStyle} style={toneStyle(metric, index, valid)} />
                          </span>
                          <span css={metricLabelStyle}>{metric.label}</span>
                          <span css={metricDetailStyle} data-ui="activity-rings-detail">
                            <span css={visuallyHiddenStyle}>{committedDetail}</span>
                            <span aria-hidden="true">
                              {status === 'unknown' || !usage ? (
                                labels.unknown
                              ) : (
                                <Count
                                  value={usage.total}
                                  format={(next) =>
                                    valid
                                      ? labels.amount(formatAmount(next), usage.formattedLimit)
                                      : `${formatAmount(next)} · ${labels.unavailable}`
                                  }
                                />
                              )}
                            </span>
                          </span>
                          <span aria-hidden="true" css={metricPercentStyle}>
                            {valid && usage ? (
                              <>
                                {status === 'closed' && <span css={statusStyle}>✓ </span>}
                                <Count value={usage.ratio} format={formats.percent.format} />
                              </>
                            ) : (
                              '—'
                            )}
                          </span>
                          {status === 'closed' && usage && (
                            <span aria-hidden="true" css={metricStatusStyle} data-ui="activity-rings-status">
                              {usage.over > 0 ? (
                                <Count value={usage.over} format={(next) => overGoal(formatAmount(next))} />
                              ) : (
                                labels.goalMet
                              )}
                            </span>
                          )}
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
                              data-preview={active === metric.id}
                              css={[metricStyle, metricButtonSlot.css]}
                              onMouseEnter={(event) => {
                                metricButtonSlot.onMouseEnter?.(event);
                                if (!event.defaultPrevented) setHovered(metric.id);
                              }}
                              onMouseLeave={(event) => {
                                metricButtonSlot.onMouseLeave?.(event);
                                if (!event.defaultPrevented) setHovered(null);
                              }}
                              onFocus={(event) => {
                                metricButtonSlot.onFocus?.(event);
                                if (!event.defaultPrevented) setKeyboardPreview(metric.id);
                              }}
                              onBlur={(event) => {
                                metricButtonSlot.onBlur?.(event);
                                if (!event.defaultPrevented) setKeyboardPreview(null);
                              }}
                              onClick={(event) => {
                                metricButtonSlot.onClick?.(event);
                                if (!event.defaultPrevented) {
                                  setHovered(null);
                                  setKeyboardPreview(null);
                                  requestFocused(pressed ? null : metric.id);
                                }
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
                      <DayPreview metrics={metrics} values={item.values} locale={locale} labels={labels} />
                      <span aria-hidden="true">{civil ? dateFormats.weekday.format(civil) : item.id}</span>
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
          </MotionConfig>
        </section>
      )}
    </WithSx>
  );
}
ActivityRings.displayName = 'ActivityRings';
