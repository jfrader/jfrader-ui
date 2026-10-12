'use client';

import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentPropsWithRef,
  type ComponentPropsWithoutRef,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { vars } from '@jfrader/tokens/vars';
import { AnimatePresence, MotionConfig, motion, useInView, useReducedMotion } from 'motion/react';
import { css, type Interpolation, type Theme } from '../../styling/css';
import { focusRingOutset } from '../../styling/focus-ring';
import { FORCED_COLORS, REDUCED_MOTION } from '../../styling/media';
import { motionDurationMs } from '../../styling/motion-timings';
import { WithSx, type SxProps } from '../../styling/sx';
import { visuallyHiddenStyle } from '../../styling/visually-hidden';
import { isRenderable } from '../../utils/renderable';
import { useControlledState } from '../../utils/use-controlled-state';
import {
  createUsageFormats,
  DEFAULT_WARN_AT,
  summarizeUsage,
  type UsageMeterState,
  type UsageMeterSummary,
} from './usage-model';

export type { UsageMeterState, UsageMeterSummary } from './usage-model';
export type UsageMeterSize = 'sm' | 'md' | 'lg';
export type UsageMeterSelection = { kind: 'segment'; id: string } | { kind: 'remainder' };
export interface UsageMeterSegment {
  /** Stable, nonempty, unique identity. */
  id: string;
  label: string;
  value: number;
  tone?: 'accent' | 'info' | 'success' | 'warning';
}
export type UsageMeterItem = UsageMeterSelection & {
  label: string;
  value: number;
};
export interface UsageMeterLabels {
  free: string;
  near: string;
  over: string;
  normal: string;
  unavailable: string;
  legend: string;
  used?: string;
  of?: string;
}
export type UsageMeterPartProps<T extends 'div' | 'span' | 'p' | 'ul' | 'button' = 'span'> = Omit<
  ComponentPropsWithoutRef<T>,
  'children'
> & {
  css?: Interpolation<Theme>;
};
export interface UsageMeterProps
  extends Omit<ComponentPropsWithRef<'div'>, 'children' | 'defaultValue'>, SxProps {
  label: ReactNode;
  segments: readonly UsageMeterSegment[];
  limit: number;
  warnAt?: number;
  size?: UsageMeterSize;
  locale?: Intl.LocalesArgument;
  numberFormatOptions?: Intl.NumberFormatOptions;
  unitLabel?: ReactNode;
  /** Defaults to English. Use the value-label callbacks to translate comparison text too. */
  labels?: Partial<UsageMeterLabels>;
  getValueLabel?: (summary: UsageMeterSummary) => string;
  getItemLabel?: (item: UsageMeterItem, summary: UsageMeterSummary) => string;
  interactive?: boolean;
  value?: UsageMeterSelection | null;
  defaultValue?: UsageMeterSelection | null;
  onValueChange?: (selection: UsageMeterSelection | null) => void;
  /** Announce status transitions and growing overage, coalescing rapid updates. Defaults to true. */
  announceChanges?: boolean;
  statusIcon?: (state: UsageMeterState) => ReactNode;
  slotProps?: {
    root?: UsageMeterPartProps<'div'>;
    title?: UsageMeterPartProps;
    status?: UsageMeterPartProps;
    total?: UsageMeterPartProps<'p'>;
    track?: UsageMeterPartProps<'div'>;
    segment?: UsageMeterPartProps;
    overage?: UsageMeterPartProps;
    limit?: UsageMeterPartProps;
    legend?: UsageMeterPartProps<'ul'>;
    item?: UsageMeterPartProps<'button'>;
  };
}

declare const process: { env: { NODE_ENV?: string } };
const DEFAULT_LABELS: UsageMeterLabels = {
  free: 'Free',
  near: 'Near limit',
  over: 'Over limit',
  normal: 'free',
  unavailable: 'Unavailable',
  legend: 'Usage categories',
  used: 'used',
  of: 'of',
};
const STATE_GLYPHS: Record<UsageMeterState, string> = {
  normal: '✓',
  'near-limit': '!',
  'over-limit': '!',
  unavailable: '—',
};
const TONES = ['accent', 'info', 'success', 'warning'] as const;
const rootStyle = css({
  display: 'grid',
  gap: vars.space[3],
  minInlineSize: 0,
  fontFamily: vars.font.sans,
  fontSize: vars.textSize.sm,
  lineHeight: vars.lineHeight.base,
  color: vars.color.text,
  overflowWrap: 'anywhere',
});
const ellipsisStyle = css({
  minInlineSize: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});
const headerStyle = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: vars.space[3],
  minInlineSize: 0,
  flexWrap: 'wrap',
});
const titleStyle = css({ fontWeight: vars.fontWeight.medium, flex: '1 1 0' });
const statusStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  gap: vars.space[1],
  maxInlineSize: '65%',
  minInlineSize: 0,
  overflow: 'hidden',
  paddingBlock: vars.space[1],
  paddingInline: vars.space[2],
  borderRadius: vars.radius.full,
  fontSize: vars.textSize.xs,
  color: vars.color.textMuted,
  backgroundColor: vars.color.surfaceHover,
  '&[data-state="near-limit"]': {
    color: vars.color.warning,
    backgroundColor: vars.color.warningSoft,
  },
  '&[data-state="over-limit"]': {
    color: vars.color.dangerText,
    backgroundColor: vars.color.dangerSoft,
  },
});
const totalCaptionStyle = css({
  marginInlineStart: vars.space[1],
  fontSize: vars.textSize.sm,
  fontWeight: vars.fontWeight.regular,
  color: vars.color.textMuted,
});
const rollingStyle = css({
  display: 'inline-flex',
  fontVariantNumeric: 'tabular-nums',
  whiteSpace: 'pre',
});
const digitStyle = css({
  display: 'inline-grid',
  overflow: 'hidden',
  '& > span': { gridArea: '1 / 1' },
});
const totalStyle = css({
  margin: 0,
  fontSize: 'var(--usage-total-size)',
  fontWeight: vars.fontWeight.medium,
  fontVariantNumeric: 'tabular-nums',
});
const sizeStyles = {
  sm: css({ '--usage-total-size': vars.textSize.md, gap: vars.space[2] }),
  md: css({ '--usage-total-size': vars.textSize.xl }),
  lg: css({ '--usage-total-size': vars.textSize['3xl'], gap: vars.space[4] }),
};
const trackStyle = css({
  position: 'relative',
  blockSize: vars.space[4],
  border: `1px solid ${vars.color.borderControl}`,
  backgroundColor: vars.color.surfaceInset,
  borderRadius: vars.radius.full,
  overflow: 'hidden',
  [FORCED_COLORS]: { backgroundColor: 'Canvas', borderColor: 'CanvasText' },
});
const geometryStyle = css({
  position: 'absolute',
  insetBlock: 0,
  insetInlineStart: 'var(--usage-start)',
  inlineSize: 'var(--usage-width)',
  boxSizing: 'border-box',
});
const segmentStyle = css({
  backgroundColor: 'var(--usage-tone)',
  borderInlineEnd: `1px solid ${vars.color.surfaceInset}`,
  '&[data-dimmed="true"]': { opacity: 0.45 },
  transition: `opacity ${vars.motion.duration.fast} ${vars.motion.easeStandard}`,
  [REDUCED_MOTION]: { transitionDuration: '0s' },
  '&[data-highlighted="true"]': {
    outline: `2px solid ${vars.color.surfaceInset}`,
    outlineOffset: '-2px',
  },
  [FORCED_COLORS]: {
    forcedColorAdjust: 'none',
    backgroundColor: 'Highlight',
    borderColor: 'CanvasText',
    outlineColor: 'CanvasText',
  },
});
const overageStyle = css({
  backgroundColor: vars.color.surfaceInset,
  backgroundImage: `repeating-linear-gradient(135deg, transparent, transparent ${vars.space[1]}, ${vars.color.text} ${vars.space[1]}, ${vars.color.text} calc(${vars.space[1]} + 1px))`,
  borderInlineStart: `1px solid ${vars.color.text}`,
  '&[data-highlighted="true"]': {
    outline: `2px solid ${vars.color.text}`,
    outlineOffset: '-2px',
  },
  [FORCED_COLORS]: {
    forcedColorAdjust: 'none',
    backgroundImage: `repeating-linear-gradient(135deg, Canvas, Canvas ${vars.space[1]}, CanvasText ${vars.space[1]}, CanvasText calc(${vars.space[1]} + 1px))`,
    borderColor: 'CanvasText',
  },
});
const remainderStyle = css({
  '&[data-highlighted="true"]': {
    outline: `2px solid ${vars.color.text}`,
    outlineOffset: '-2px',
  },
  [FORCED_COLORS]: {
    '&[data-highlighted="true"]': { outlineColor: 'CanvasText' },
  },
});
const limitStyle = css({
  position: 'absolute',
  insetBlock: 0,
  insetInlineStart: 'var(--usage-start)',
  borderInlineStart: `2px solid ${vars.color.text}`,
  [FORCED_COLORS]: { borderColor: 'CanvasText' },
});
/** Minimum legend column width: roughly one short label plus the swatch before wrapping to one column. */
const LEGEND_COLUMN_MIN = '108px';
const legendStyle = css({
  display: 'grid',
  gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, ${LEGEND_COLUMN_MIN}), 1fr))`,
  gap: vars.space[2],
  padding: 0,
  margin: 0,
  listStyle: 'none',
});
const itemStyle = css({
  display: 'grid',
  gridTemplateColumns: 'auto minmax(0, 1fr)',
  alignItems: 'center',
  gap: vars.space[2],
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
  borderRadius: vars.radius.sm,
  '&:hover, &[data-highlighted="true"]': {
    backgroundColor: vars.color.surfaceHover,
  },
  '&[aria-pressed="true"]': {
    outline: `2px solid ${vars.color.text}`,
    outlineOffset: '-2px',
  },
  '&:focus-visible': focusRingOutset,
  [FORCED_COLORS]: {
    borderColor: 'CanvasText',
    '&:focus-visible': { outlineColor: 'Highlight' },
    '&[aria-pressed="true"]': { outlineColor: 'CanvasText' },
  },
});
const indexStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minInlineSize: vars.space[4],
  inlineSize: 'fit-content',
  paddingInline: vars.space[1],
  boxSizing: 'border-box',
  blockSize: vars.space[4],
  borderRadius: vars.radius.full,
  backgroundColor: 'var(--usage-tone)',
  color: vars.color.surfaceInset,
  fontSize: vars.textSize.xs,
  fontWeight: vars.fontWeight.medium,
});
const segmentIndexStyle = css({
  display: 'block',
  inlineSize: 'fit-content',
  paddingInline: vars.space[1],
  fontSize: vars.textSize.xs,
  lineHeight: 1,
  color: vars.color.text,
  backgroundColor: vars.color.surfaceInset,
  [FORCED_COLORS]: { color: 'CanvasText', backgroundColor: 'Canvas' },
});
const amountStyle = css({
  gridColumn: 2,
  fontSize: vars.textSize.xs,
  color: vars.color.textMuted,
});
const SEGMENT_STAGGER = motionDurationMs.fast / 2000;
const ANNOUNCEMENT_DELAY = motionDurationMs.slow * 4;
const geometrySpring = {
  type: 'spring',
  duration: motionDurationMs.slow / 1000,
  bounce: 0,
} as const;

function MeterSpan({
  nativeProps,
  ...props
}: ComponentPropsWithRef<'span'> & { nativeProps?: UsageMeterPartProps }) {
  const { css: _css, className, style, ...native } = nativeProps ?? {};
  return (
    <span
      {...native}
      {...props}
      className={[className, props.className].filter(Boolean).join(' ') || undefined}
      style={{ ...style, ...props.style }}
    />
  );
}
const AnimatedSpan = motion.create(MeterSpan);

function RollingTotal({
  text,
  total,
  reduced,
  visible,
}: {
  text: string;
  total: number;
  reduced: boolean;
  visible: boolean;
}) {
  const previous = useRef(total);
  const direction = total >= previous.current ? 1 : -1;
  useEffect(() => {
    previous.current = total;
  }, [total]);
  if (reduced) return <span>{text}</span>;
  return (
    <>
      <span css={visuallyHiddenStyle}>{text}</span>
      <span aria-hidden="true" css={rollingStyle}>
        {Array.from(text).map((character, index) => (
          <span key={index} css={digitStyle}>
            <AnimatePresence custom={direction}>
              <motion.span
                key={character}
                custom={direction}
                variants={{
                  enter: (sign: number) => ({
                    y: `${sign * 100}%`,
                    opacity: 0,
                  }),
                  exit: (sign: number) => ({
                    y: `${sign * -100}%`,
                    opacity: 0,
                  }),
                }}
                initial="enter"
                animate={{ y: visible ? 0 : '100%', opacity: visible ? 1 : 0 }}
                exit="exit"
                transition={{ duration: motionDurationMs.slow / 1000 }}
              >
                {character}
              </motion.span>
            </AnimatePresence>
          </span>
        ))}
      </span>
    </>
  );
}

function sameSelection(a: UsageMeterSelection | null | undefined, b: UsageMeterSelection | null | undefined) {
  if (!a || !b) return a == null && b == null;
  return a.kind === b.kind && (a.kind === 'remainder' || (b.kind === 'segment' && a.id === b.id));
}
function itemKey(item: UsageMeterSelection) {
  return item.kind === 'segment' ? `segment:${item.id}` : 'remainder';
}
function joinIds(...ids: (string | undefined | false)[]) {
  return ids.filter(Boolean).join(' ') || undefined;
}
function geometry(start: number, width: number): CSSProperties {
  return {
    '--usage-start': `${start * 100}%`,
    '--usage-width': `${width * 100}%`,
  } as CSSProperties;
}

/** Shows usage against an allowance, not task progress. The meter cannot receive focus.
 * Legend arrows/Home/End move focus; Enter/Space toggle a pin; Escape clears it.
 * Numeric ARIA stops at the allowance. Displayed text and aria-valuetext include overuse. */
export function UsageMeter({
  ref,
  label,
  segments,
  limit,
  warnAt = DEFAULT_WARN_AT,
  size = 'md',
  locale,
  numberFormatOptions,
  unitLabel,
  labels: labelsProp,
  getValueLabel,
  getItemLabel,
  interactive = true,
  value,
  defaultValue = null,
  onValueChange,
  announceChanges = true,
  statusIcon,
  slotProps,
  className,
  sx,
  'aria-labelledby': labelledBy,
  'aria-describedby': describedBy,
  'aria-label': ariaLabel,
  ...rest
}: UsageMeterProps) {
  const id = useId();
  const reducedMotion = useReducedMotion() === true;
  const viewRef = useRef<HTMLDivElement>(null);
  const inView = useInView(viewRef, { once: true, amount: 0.4 });
  const entered = useRef(false);
  useEffect(() => {
    if (inView) entered.current = true;
  }, [inView]);
  const titleId = slotProps?.title?.id ?? `${id}-title`;
  const statusId = slotProps?.status?.id ?? `${id}-status`;
  const hasLabel = isRenderable(label) && label !== '';
  const labels = { ...DEFAULT_LABELS, ...labelsProp };
  const formats = createUsageFormats(locale, numberFormatOptions);
  const { amount, percent, index: indexFormat } = formats;
  const sanitized = segments.map((segment) => ({
    ...segment,
    value: Number.isFinite(segment.value) && segment.value >= 0 ? segment.value : 0,
  }));
  const total = sanitized.reduce((sum, segment) => sum + segment.value, 0);
  const summary = summarizeUsage(total, limit, {
    warnAt,
    formats,
    unavailable: labels.unavailable,
  });
  const { state } = summary;
  const valid = state !== 'unavailable';
  const stateText = {
    normal: labels.normal,
    'near-limit': labels.near,
    'over-limit': labels.over,
    unavailable: labels.unavailable,
  }[state];
  const hasUnit = isRenderable(unitLabel) && unitLabel !== '';
  const unitText = typeof unitLabel === 'string' || typeof unitLabel === 'number' ? ` ${unitLabel}` : '';
  const formatAmount = (value: number) => `${amount.format(value)}${unitText}`;
  const statusText =
    state === 'over-limit'
      ? `${stateText}: ${formatAmount(summary.over)}`
      : state === 'normal'
        ? `${formatAmount(summary.free)} ${stateText}`
        : state === 'near-limit'
          ? `${stateText} · ${formatAmount(summary.free)} ${labels.normal}`
          : stateText;
  const items: UsageMeterItem[] = [
    ...sanitized.map((segment) => ({
      kind: 'segment' as const,
      id: segment.id,
      label: segment.label,
      value: segment.value,
    })),
    ...(valid
      ? [
          {
            kind: 'remainder' as const,
            label: summary.over > 0 ? labels.over : labels.free,
            value: summary.over > 0 ? summary.over : summary.free,
          },
        ]
      : []),
  ];
  const [pin, requestPin] = useControlledState<UsageMeterSelection | null>(
    value,
    defaultValue,
    onValueChange,
  );
  const [hover, setHover] = useState<UsageMeterSelection | null>(null);
  const [focus, setFocus] = useState<UsageMeterSelection | null>(null);
  const [rovingKey, setRovingKey] = useState<string | null>(null);
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const removedFocus = useRef<{ key: string; index: number } | null>(null);
  const validPin = items.find((item) => sameSelection(item, pin)) ?? null;
  const highlight = hover ?? focus ?? validPin;
  const tabKey = items.some((item) => itemKey(item) === rovingKey)
    ? rovingKey
    : items[0] && itemKey(items[0]);
  const lastAnnounced = useRef({
    state,
    over: summary.over,
    text: formatAmount(summary.over),
  });
  const [announcement, setAnnouncement] = useState('');
  useEffect(() => {
    const overText = `${amount.format(summary.over)}${unitText}`;
    if (!announceChanges) {
      setAnnouncement('');
      lastAnnounced.current = { state, over: summary.over, text: overText };
      return;
    }
    const previous = lastAnnounced.current;
    if (previous.state === state && summary.over < previous.over)
      lastAnnounced.current = { ...previous, over: summary.over };
    if (
      previous.state === state &&
      !(state === 'over-limit' && summary.over > previous.over && overText !== previous.text)
    )
      return;
    const timer = setTimeout(() => {
      setAnnouncement(statusText);
      lastAnnounced.current = { state, over: summary.over, text: overText };
    }, ANNOUNCEMENT_DELAY);
    return () => clearTimeout(timer);
  }, [state, summary.over, statusText, announceChanges, unitText, summary.free]);
  useEffect(() => {
    if (
      process.env.NODE_ENV !== 'production' &&
      (segments.some((segment) => !segment.id) ||
        new Set(segments.map((segment) => segment.id)).size !== segments.length)
    ) {
      console.warn('UsageMeter: segment ids must be nonempty and unique.');
    }
  }, [segments]);
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' && valid && !hasLabel && !ariaLabel && !labelledBy) {
      console.warn('UsageMeter: the meter needs an accessible name (label, ariaLabel, or labelledBy).');
    }
  }, [valid, hasLabel, ariaLabel, labelledBy]);
  useLayoutEffect(() => {
    const removed = removedFocus.current;
    removedFocus.current = null;
    if (interactive && removed && !items.some((item) => itemKey(item) === removed.key) && items.length) {
      buttons.current.get(itemKey(items[Math.min(removed.index, items.length - 1)]!))?.focus();
    }
  });
  const changePin = (next: UsageMeterSelection | null) => {
    if (!sameSelection(pin, next)) requestPin(next);
  };
  const span = valid ? Math.max(limit, total) : 1;
  let start = 0;
  const valueText =
    getValueLabel?.(summary) ??
    `${formatAmount(total)} ${labels.of} ${formatAmount(limit)} ${labels.used}, ${summary.formattedPercent}. ${statusText}`;
  const icon = statusIcon?.(state);
  const root = slotProps?.root;
  const { css: rootCss, className: rootClassName, ...rootNative } = root ?? {};
  const track = slotProps?.track;
  return (
    <MotionConfig reducedMotion="user">
      <WithSx
        className={[rootClassName, className].filter(Boolean).join(' ') || undefined}
        styles={[rootStyle, sizeStyles[size], rootCss]}
        sx={sx}
      >
        {(resolvedClassName) => (
          <div
            {...rootNative}
            {...rest}
            ref={ref}
            role="group"
            data-ui="usage-meter"
            data-state={state}
            data-size={size}
            className={resolvedClassName}
            aria-label={ariaLabel ?? root?.['aria-label']}
            aria-labelledby={joinIds(labelledBy, root?.['aria-labelledby'], hasLabel && titleId)}
            aria-describedby={joinIds(describedBy, root?.['aria-describedby'], statusId)}
          >
            <div css={headerStyle}>
              {hasLabel && (
                <span
                  {...slotProps?.title}
                  id={titleId}
                  data-ui="usage-meter-title"
                  css={[titleStyle, ellipsisStyle, slotProps?.title?.css]}
                >
                  {label}
                </span>
              )}
              <AnimatedSpan
                nativeProps={slotProps?.status}
                id={statusId}
                data-ui="usage-meter-status"
                data-state={state}
                layout={reducedMotion ? false : 'size'}
                transition={reducedMotion ? { duration: 0 } : geometrySpring}
                css={[statusStyle, slotProps?.status?.css]}
              >
                <span aria-hidden="true">
                  {isRenderable(icon) && icon !== '' ? icon : STATE_GLYPHS[state]}
                </span>{' '}
                <span css={ellipsisStyle}>{statusText}</span>
              </AnimatedSpan>
            </div>
            <p {...slotProps?.total} data-ui="usage-meter-total" css={[totalStyle, slotProps?.total?.css]}>
              {valid ? (
                <>
                  <RollingTotal
                    text={summary.formattedTotal}
                    total={total}
                    reduced={reducedMotion}
                    visible={inView}
                  />
                  {hasUnit && <span data-ui="usage-meter-unit"> {unitLabel}</span>}
                  <span css={totalCaptionStyle}>
                    {' '}
                    {labels.of} {summary.formattedLimit}
                    {hasUnit && <> {unitLabel}</>} {labels.used}
                  </span>
                </>
              ) : (
                <>
                  {summary.formattedTotal}
                  {hasUnit && <span data-ui="usage-meter-unit"> {unitLabel}</span>}
                </>
              )}
            </p>
            <div
              {...track}
              ref={viewRef}
              data-ui="usage-meter-track"
              role={valid ? 'meter' : undefined}
              aria-label={
                track?.['aria-label'] ?? (!hasLabel ? (ariaLabel ?? root?.['aria-label']) : undefined)
              }
              aria-labelledby={joinIds(
                track?.['aria-labelledby'],
                hasLabel && titleId,
                !hasLabel && labelledBy,
                !hasLabel && root?.['aria-labelledby'],
              )}
              aria-describedby={joinIds(track?.['aria-describedby'], statusId)}
              aria-valuemin={valid ? 0 : undefined}
              aria-valuemax={valid ? limit : undefined}
              aria-valuenow={valid ? Math.min(total, limit) : undefined}
              aria-valuetext={valid ? (track?.['aria-valuetext'] ?? valueText) : undefined}
              css={[trackStyle, track?.css]}
            >
              {valid &&
                sanitized.map((segment, index) => {
                  const offset = start;
                  start += segment.value / span;
                  return (
                    <AnimatedSpan
                      nativeProps={slotProps?.segment}
                      key={segment.id}
                      aria-hidden="true"
                      data-ui="usage-meter-segment"
                      data-dimmed={
                        highlight != null &&
                        !sameSelection(highlight, {
                          kind: 'segment',
                          id: segment.id,
                        })
                      }
                      initial={reducedMotion ? false : { inlineSize: '0%' }}
                      animate={{
                        inlineSize: `${(reducedMotion || inView ? segment.value / span : 0) * 100}%`,
                        insetInlineStart: `${offset * 100}%`,
                      }}
                      transition={
                        reducedMotion
                          ? { duration: 0 }
                          : {
                              ...geometrySpring,
                              delay: entered.current ? 0 : index * SEGMENT_STAGGER,
                            }
                      }
                      onPointerEnter={(event) => {
                        slotProps?.segment?.onPointerEnter?.(event);
                        if (interactive && !event.defaultPrevented && event.pointerType !== 'touch')
                          setHover({ kind: 'segment', id: segment.id });
                      }}
                      onPointerLeave={(event) => {
                        slotProps?.segment?.onPointerLeave?.(event);
                        setHover(null);
                      }}
                      onClick={(event) => {
                        slotProps?.segment?.onClick?.(event);
                        if (interactive && !event.defaultPrevented)
                          changePin(
                            sameSelection(pin, {
                              kind: 'segment',
                              id: segment.id,
                            })
                              ? null
                              : { kind: 'segment', id: segment.id },
                          );
                      }}
                      data-highlighted={sameSelection(highlight, {
                        kind: 'segment',
                        id: segment.id,
                      })}
                      style={
                        {
                          ...slotProps?.segment?.style,
                          ...geometry(offset, segment.value / span),
                          '--usage-tone': vars.color[segment.tone ?? TONES[index % TONES.length]!],
                        } as CSSProperties
                      }
                      css={[geometryStyle, segmentStyle, slotProps?.segment?.css]}
                    >
                      {segment.value / span >= 0.08 && (
                        <span css={segmentIndexStyle}>{indexFormat.format(index + 1)}</span>
                      )}
                    </AnimatedSpan>
                  );
                })}
              {valid && summary.free > 0 && (
                <AnimatedSpan
                  aria-hidden="true"
                  data-ui="usage-meter-remainder"
                  initial={false}
                  animate={{
                    inlineSize: `${(summary.free / span) * 100}%`,
                    insetInlineStart: `${(total / span) * 100}%`,
                  }}
                  transition={reducedMotion ? { duration: 0 } : geometrySpring}
                  onPointerEnter={(event) => {
                    if (interactive && event.pointerType !== 'touch') setHover({ kind: 'remainder' });
                  }}
                  onPointerLeave={() => setHover(null)}
                  onClick={() => {
                    if (interactive) changePin(pin?.kind === 'remainder' ? null : { kind: 'remainder' });
                  }}
                  data-highlighted={highlight?.kind === 'remainder'}
                  style={geometry(total / span, summary.free / span)}
                  css={[geometryStyle, remainderStyle]}
                />
              )}
              {valid && summary.over > 0 && (
                <>
                  <AnimatedSpan
                    nativeProps={slotProps?.overage}
                    aria-hidden="true"
                    data-ui="usage-meter-overage"
                    initial={reducedMotion ? false : { opacity: 0 }}
                    animate={{
                      opacity: reducedMotion || inView ? 1 : 0,
                      inlineSize: `${(summary.over / span) * 100}%`,
                      insetInlineStart: `${(limit / span) * 100}%`,
                    }}
                    transition={reducedMotion ? { duration: 0 } : geometrySpring}
                    onPointerEnter={(event) => {
                      slotProps?.overage?.onPointerEnter?.(event);
                      if (interactive && !event.defaultPrevented && event.pointerType !== 'touch')
                        setHover({ kind: 'remainder' });
                    }}
                    onPointerLeave={(event) => {
                      slotProps?.overage?.onPointerLeave?.(event);
                      setHover(null);
                    }}
                    onClick={(event) => {
                      slotProps?.overage?.onClick?.(event);
                      if (interactive && !event.defaultPrevented)
                        changePin(pin?.kind === 'remainder' ? null : { kind: 'remainder' });
                    }}
                    data-highlighted={highlight?.kind === 'remainder'}
                    style={{
                      ...slotProps?.overage?.style,
                      ...geometry(limit / span, summary.over / span),
                    }}
                    css={[geometryStyle, overageStyle, slotProps?.overage?.css]}
                  />
                  <AnimatedSpan
                    nativeProps={slotProps?.limit}
                    aria-hidden="true"
                    data-ui="usage-meter-limit"
                    initial={reducedMotion ? false : { opacity: 0 }}
                    animate={{
                      opacity: reducedMotion || inView ? 1 : 0,
                      insetInlineStart: `${(limit / span) * 100}%`,
                    }}
                    transition={reducedMotion ? { duration: 0 } : geometrySpring}
                    style={{
                      ...slotProps?.limit?.style,
                      ...geometry(limit / span, 0),
                    }}
                    css={[limitStyle, slotProps?.limit?.css]}
                  />
                </>
              )}
            </div>
            <ul
              {...slotProps?.legend}
              data-ui="usage-meter-legend"
              aria-label={slotProps?.legend?.['aria-label'] ?? labels.legend}
              css={[legendStyle, slotProps?.legend?.css]}
            >
              {items.map((item, index) => {
                const key = itemKey(item);
                const selected = sameSelection(validPin, item);
                const contents = (
                  <>
                    <span
                      css={indexStyle}
                      style={
                        {
                          '--usage-tone':
                            item.kind === 'segment'
                              ? vars.color[sanitized[index]?.tone ?? TONES[index % TONES.length]!]
                              : vars.color.borderControl,
                        } as CSSProperties
                      }
                    >
                      {item.kind === 'segment' ? indexFormat.format(index + 1) : '—'}
                      {selected && <span aria-hidden="true"> ◆</span>}
                    </span>
                    <span css={ellipsisStyle} title={item.label}>
                      {item.label}
                    </span>
                    <span css={[amountStyle, ellipsisStyle]}>
                      {amount.format(item.value)}
                      {hasUnit && <> {unitLabel}</>}
                    </span>
                    {valid && <span css={visuallyHiddenStyle}>{percent.format(item.value / limit)}</span>}
                  </>
                );
                return (
                  <li key={key}>
                    {interactive ? (
                      <button
                        {...slotProps?.item}
                        type="button"
                        data-ui="usage-meter-item"
                        data-highlighted={sameSelection(highlight, item)}
                        aria-pressed={selected}
                        aria-label={slotProps?.item?.['aria-label'] ?? getItemLabel?.(item, summary)}
                        tabIndex={key === tabKey ? 0 : -1}
                        css={[itemStyle, slotProps?.item?.css]}
                        ref={(node) => {
                          if (!node) return;
                          buttons.current.set(key, node);
                          return () => {
                            if (node.ownerDocument.activeElement === node)
                              removedFocus.current = { key, index };
                            buttons.current.delete(key);
                          };
                        }}
                        onClick={(event) => {
                          slotProps?.item?.onClick?.(event);
                          if (!event.defaultPrevented)
                            changePin(
                              selected
                                ? null
                                : item.kind === 'segment'
                                  ? { kind: 'segment', id: item.id }
                                  : { kind: 'remainder' },
                            );
                        }}
                        onMouseEnter={(event) => {
                          slotProps?.item?.onMouseEnter?.(event);
                          if (!event.defaultPrevented) setHover(item);
                        }}
                        onMouseLeave={(event) => {
                          slotProps?.item?.onMouseLeave?.(event);
                          setHover(null);
                        }}
                        onFocus={(event) => {
                          slotProps?.item?.onFocus?.(event);
                          setFocus(item);
                          setRovingKey(key);
                        }}
                        onBlur={(event) => {
                          slotProps?.item?.onBlur?.(event);
                          setFocus(null);
                        }}
                        onKeyDown={(event) => {
                          slotProps?.item?.onKeyDown?.(event);
                          if (event.defaultPrevented) return;
                          if (event.key === 'Escape') {
                            if (pin != null) {
                              event.preventDefault();
                              changePin(null);
                            }
                            return;
                          }
                          const rtl =
                            event.currentTarget.ownerDocument.defaultView?.getComputedStyle(
                              event.currentTarget,
                            ).direction === 'rtl';
                          const offsets: Record<string, number> = {
                            ArrowRight: rtl ? -1 : 1,
                            ArrowLeft: rtl ? 1 : -1,
                            ArrowDown: 1,
                            ArrowUp: -1,
                          };
                          const offset = offsets[event.key];
                          const next =
                            event.key === 'Home'
                              ? 0
                              : event.key === 'End'
                                ? items.length - 1
                                : offset !== undefined
                                  ? (index + offset + items.length) % items.length
                                  : undefined;
                          if (next !== undefined) {
                            event.preventDefault();
                            buttons.current.get(itemKey(items[next]!))?.focus();
                          }
                        }}
                      >
                        {contents}
                      </button>
                    ) : (
                      <span
                        data-ui="usage-meter-item"
                        css={[itemStyle, slotProps?.item?.css]}
                        className={slotProps?.item?.className}
                      >
                        {contents}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
            {announceChanges && (
              <span
                data-ui="usage-meter-announcement"
                aria-live="polite"
                aria-atomic="true"
                css={visuallyHiddenStyle}
              >
                {announcement}
              </span>
            )}
          </div>
        )}
      </WithSx>
    </MotionConfig>
  );
}
UsageMeter.displayName = 'UsageMeter';
