'use client';

import {
  useEffect,
  useId,
  useRef,
  useState,
  type ComponentPropsWithRef,
  type ReactNode,
} from 'react';
import { vars } from '@jfrader/tokens/vars';
import { css, keyframes, type Interpolation, type Theme } from '../../styling/css';
import { FORCED_COLORS, REDUCED_MOTION } from '../../styling/media';
import { WithSx, type SxProps } from '../../styling/sx';
import { visuallyHiddenStyle } from '../../styling/visually-hidden';
import { numberFormatter, validEpoch } from '../../utils/intl';
import { isRenderable } from '../../utils/renderable';
import { useLatestCallback } from '../../utils/use-latest-callback';

export type CountdownUnit = 'days' | 'hours' | 'minutes' | 'seconds';
export type CountdownVariant = 'display' | 'compact';
export interface CountdownPartProps {
  className?: string;
  css?: Interpolation<Theme>;
}
export interface CountdownProps extends Omit<ComponentPropsWithRef<'div'>, 'children'>, SxProps {
  /** Exact instant: epoch milliseconds, Date, or an ISO date-time with Z or an explicit offset. */
  target: Date | number | string;
  variant?: CountdownVariant;
  units?: readonly CountdownUnit[];
  label?: ReactNode;
  locale?: Intl.LocalesArgument;
  unitDisplay?: 'long' | 'short' | 'narrow';
  completeLabel?: ReactNode;
  completeText?: string;
  pendingLabel?: ReactNode;
  invalidLabel?: ReactNode;
  invalidText?: string;
  /** Clock source in epoch milliseconds. Background callbacks run when execution next becomes possible. */
  clock?: () => number;
  /** Shared server snapshot for identical SSR and hydration output. */
  initialNow?: number;
  /** Once per resolved target identity, including a target already elapsed at mount. */
  onComplete?: (targetEpochMs: number) => void;
  announceCompletion?: boolean;
  completionIcon?: ReactNode;
  slotProps?: Partial<
    Record<
      | /** Header label displayed above the countdown. */
        'label'
      | /** Container wrapping the rendered time units. */
        'content'
      | /** Individual time unit cell holding a number and unit label. */
        'unit'
      | /** Numeric value displayed inside a time unit cell. */
        'number'
      | /** Completion text displayed when the countdown reaches zero. */
        'complete'
      | /** Icon displayed when the countdown reaches zero. */
        'icon'
      | /** Screen-reader description text explaining the countdown target. */
        'description',
      CountdownPartProps
    >
  >;
}

const MAX_TIMEOUT = 2147483647;
const SECOND_MS = 1000;
const DEFAULT_UNITS: readonly CountdownUnit[] = ['days', 'hours', 'minutes', 'seconds'];
const UNIT_SECONDS: Record<CountdownUnit, number> = {
  days: 86400,
  hours: 3600,
  minutes: 60,
  seconds: 1,
};
const UNIT_NAMES: Record<CountdownUnit, string> = {
  days: 'day',
  hours: 'hour',
  minutes: 'minute',
  seconds: 'second',
};
const systemClock = () => Date.now();
const hasContent = (value: ReactNode) => isRenderable(value) && value !== '';

function resolveTarget(target: CountdownProps['target']): number | null {
  if (typeof target === 'string') {
    const match =
      /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?(Z|[+-](\d{2}):(\d{2}))$/.exec(
        target,
      );
    if (!match) return null;
    const [, year, month, day, hour, minute, second, , offsetHour, offsetMinute] = match;
    const calendar = new Date(`${year}-${month}-01T00:00:00Z`);
    calendar.setUTCMonth(calendar.getUTCMonth() + 1, 0);
    if (
      +month! < 1 ||
      +month! > 12 ||
      +day! < 1 ||
      +day! > calendar.getUTCDate() ||
      +hour! > 23 ||
      +minute! > 59 ||
      +(second ?? 0) > 59 ||
      +(offsetHour ?? 0) > 23 ||
      +(offsetMinute ?? 0) > 59
    )
      return null;
  }
  const epoch =
    typeof target === 'number'
      ? target
      : target instanceof Date
        ? target.getTime()
        : Date.parse(target);
  return validEpoch(epoch) ? epoch : null;
}

function partsFor(seconds: number, units: readonly CountdownUnit[]) {
  return units.map((unit) => {
    const value = Math.floor(seconds / UNIT_SECONDS[unit]);
    seconds %= UNIT_SECONDS[unit];
    return { unit, value };
  });
}

type DurationFormatter = new (
  locale?: Intl.LocalesArgument,
  options?: { style: 'long' } & Partial<Record<`${CountdownUnit}Display`, 'always'>>,
) => {
  format(duration: Partial<Record<CountdownUnit, number>>): string;
};

function spokenDuration(
  seconds: number,
  units: readonly CountdownUnit[],
  locale: Intl.LocalesArgument | undefined,
) {
  const spokenUnits =
    seconds >= 60 && units.length > 1 ? units.filter((unit) => unit !== 'seconds') : units;
  const parts = partsFor(seconds, spokenUnits);
  if (spokenUnits.length === 1 && spokenUnits[0] === 'seconds') {
    return numberFormatter(locale, {
      style: 'unit',
      unit: 'second',
      unitDisplay: 'long',
    }).format(seconds);
  }
  const selected = parts.filter(({ value }) => value > 0);
  if (!selected.length) selected.push(parts[parts.length - 1]!);
  const DurationFormat = (Intl as typeof Intl & { DurationFormat?: DurationFormatter })
    .DurationFormat;
  if (typeof DurationFormat === 'function')
    return new DurationFormat(locale, {
      style: 'long',
      ...Object.fromEntries(selected.map(({ unit }) => [`${unit}Display`, 'always'])),
    }).format(Object.fromEntries(selected.map(({ unit, value }) => [unit, value])));
  return new Intl.ListFormat(locale, {
    style: 'long',
    type: 'conjunction',
  }).format(
    selected.map(({ unit, value }) =>
      numberFormatter(locale, {
        style: 'unit',
        unit: UNIT_NAMES[unit],
        unitDisplay: 'long',
      }).format(value),
    ),
  );
}

const roll = keyframes({
  from: { transform: 'translateY(100%)', opacity: 0 },
  to: { transform: 'translateY(0)', opacity: 1 },
});
const appear = keyframes({ from: { opacity: 0 }, to: { opacity: 1 } });
const rootStyle = css({
  display: 'grid',
  gap: vars.space[2],
  inlineSize: 'fit-content',
  maxInlineSize: '100%',
  minInlineSize: 0,
  fontFamily: vars.font.sans,
  color: vars.color.text,
  textAlign: 'start',
  lineHeight: vars.lineHeight.base,
  overflowWrap: 'anywhere',
  [FORCED_COLORS]: { color: 'CanvasText' },
});
const labelStyle = css({
  fontSize: vars.textSize.sm,
  color: vars.color.textMuted,
});
const contentStyle = css({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'baseline',
  gap: vars.space[4],
  minInlineSize: 0,
  maxInlineSize: '100%',
});
const compactStyle = css({
  minBlockSize: vars.space[8],
  boxSizing: 'border-box',
  border: `1px solid ${vars.color.borderControl}`,
  borderRadius: vars.radius.full,
  paddingInline: vars.space[3],
  paddingBlock: vars.space[1],
  backgroundColor: vars.color.surfaceRaised,
  '& [data-ui="countdown-content"]': { gap: vars.space[2] },
  [FORCED_COLORS]: {
    borderColor: 'CanvasText',
    backgroundColor: 'transparent',
  },
});
const unitStyle = css({
  maxInlineSize: '100%',
  minInlineSize: 0,
  fontSize: vars.textSize.xs,
});
const numberStyle = css({
  display: 'inline-block',
  maxInlineSize: '100%',
  fontFamily: vars.font.mono,
  fontVariantNumeric: 'tabular-nums',
  fontWeight: vars.fontWeight.medium,
  lineHeight: vars.lineHeight.tight,
});
const displayNumberStyle = css({
  fontSize: `clamp(${vars.textSize['2xl']}, 8cqi, ${vars.textSize['3xl']})`,
});
const compactNumberStyle = css({ fontSize: vars.textSize.sm });
const rollingStyle = css({
  animation: `${roll} ${vars.motion.duration.base} ${vars.motion.easeStandard}`,
  [REDUCED_MOTION]: { animation: 'none' },
});
const completeStyle = css({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: vars.space[2],
  color: vars.color.text,
  animation: `${appear} ${vars.motion.duration.fast} ${vars.motion.easeStandard}`,
  [REDUCED_MOTION]: { animation: 'none' },
});
const iconStyle = css({
  display: 'inline-flex',
  color: vars.color.success,
  [FORCED_COLORS]: { color: 'CanvasText' },
});

function NumericRun({
  value,
  variant,
  slot,
}: {
  value: string;
  variant: CountdownVariant;
  slot?: CountdownPartProps;
}) {
  const previous = useRef(value);
  const changed = previous.current !== value;
  useEffect(() => {
    previous.current = value;
  }, [value]);
  return (
    <span
      key={value}
      data-ui="countdown-number"
      className={slot?.className}
      css={[
        numberStyle,
        variant === 'display' ? displayNumberStyle : compactNumberStyle,
        changed && rollingStyle,
        slot?.css,
      ]}
    >
      {value}
    </span>
  );
}

/** Show an ARIA timer without controls. Tab and other keys pass through; it cannot be focused or edited. */
export function Countdown({
  ref,
  target,
  variant = 'display',
  units = DEFAULT_UNITS,
  label = 'Time remaining',
  locale,
  unitDisplay = variant === 'display' ? 'long' : 'narrow',
  completeLabel = 'Live now',
  completeText = 'Complete',
  pendingLabel = '—',
  invalidLabel = 'Unavailable',
  invalidText = 'Unavailable',
  clock = systemClock,
  initialNow,
  onComplete,
  announceCompletion = false,
  completionIcon,
  slotProps,
  className,
  sx,
  'aria-labelledby': externalLabel,
  'aria-describedby': externalDescription,
  'aria-label': ariaLabel,
  ...rest
}: CountdownProps) {
  const labelId = `${useId()}-label`;
  const descriptionId = `${useId()}-description`;
  const epoch = resolveTarget(target);
  const selectedUnits = DEFAULT_UNITS.filter((unit) => units.includes(unit));
  const normalizedUnits = selectedUnits.length ? selectedUnits : DEFAULT_UNITS;
  const [now, setNow] = useState<number | undefined>(initialNow);
  const [announced, setAnnounced] = useState<number | null>(null);
  const notifyComplete = useLatestCallback(onComplete);
  const completion = useRef<{ epoch: number | null; fired: boolean }>({
    epoch,
    fired: false,
  });

  useEffect(() => {
    if (completion.current.epoch !== epoch) completion.current = { epoch, fired: false };
    setAnnounced(null);
    if (epoch === null) return;
    let visualTimeout: ReturnType<typeof setTimeout> | undefined;
    let completionTimeout: ReturnType<typeof setTimeout> | undefined;
    const sample = () => {
      clearTimeout(visualTimeout);
      clearTimeout(completionTimeout);
      let current: number;
      try {
        current = clock();
      } catch {
        current = NaN;
      }
      setNow(current);
      if (!validEpoch(current)) {
        completionTimeout = setTimeout(sample, SECOND_MS);
        return;
      }
      const remaining = epoch - current;
      if (remaining <= 0) {
        if (!completion.current.fired) {
          completion.current.fired = true;
          setAnnounced(epoch);
          notifyComplete(epoch);
        } else setAnnounced(epoch);
        return;
      }
      completionTimeout = setTimeout(sample, Math.min(remaining, MAX_TIMEOUT));
      if (document.visibilityState !== 'hidden')
        visualTimeout = setTimeout(sample, Math.min(remaining, remaining % SECOND_MS || SECOND_MS));
    };
    sample();
    document.addEventListener('visibilitychange', sample);
    window.addEventListener('pageshow', sample);
    return () => {
      clearTimeout(visualTimeout);
      clearTimeout(completionTimeout);
      document.removeEventListener('visibilitychange', sample);
      window.removeEventListener('pageshow', sample);
    };
  }, [epoch, clock, notifyComplete]);

  const state =
    epoch === null || (now !== undefined && !validEpoch(now))
      ? 'invalid'
      : now === undefined
        ? 'pending'
        : now >= epoch
          ? 'complete'
          : 'running';
  const seconds = state === 'running' ? Math.ceil((epoch! - now!) / SECOND_MS) : 0;
  const remainingText =
    state === 'running' ? spokenDuration(seconds, normalizedUnits, locale) : undefined;
  const completionIsText =
    hasContent(completeLabel) &&
    (typeof completeLabel === 'string' || typeof completeLabel === 'number');
  const invalidIsText = typeof invalidLabel === 'string' || typeof invalidLabel === 'number';
  const announce = announceCompletion && state === 'complete' && announced === epoch;
  const description =
    remainingText ??
    (state === 'invalid'
      ? invalidText
      : state === 'complete' && !completionIsText && !announce
        ? completeText
        : undefined);
  const completionContent = (
    <>
      {hasContent(completionIcon) && (
        <span
          data-ui="countdown-icon"
          aria-hidden="true"
          className={slotProps?.icon?.className}
          css={[iconStyle, slotProps?.icon?.css]}
        >
          {completionIcon}
        </span>
      )}
      {hasContent(completeLabel) ? (
        <span aria-hidden={!completionIsText || undefined}>{completeLabel}</span>
      ) : null}
      {!completionIsText && announce && <span css={visuallyHiddenStyle}>{completeText}</span>}
    </>
  );

  return (
    <WithSx
      className={className}
      styles={[rootStyle, variant === 'compact' && compactStyle]}
      sx={sx}
    >
      {(rootClass) => (
        <>
          <div
            {...rest}
            ref={ref}
            className={rootClass}
            data-ui="countdown"
            data-state={state}
            data-variant={variant}
            role="timer"
            aria-live="off"
            aria-label={
              ariaLabel ?? (!hasContent(label) && !externalLabel ? 'Time remaining' : undefined)
            }
            aria-labelledby={
              [externalLabel, hasContent(label) && labelId].filter(Boolean).join(' ') || undefined
            }
            aria-describedby={
              [externalDescription, description !== undefined && descriptionId]
                .filter(Boolean)
                .join(' ') || undefined
            }
          >
            {hasContent(label) && (
              <span
                id={labelId}
                data-ui="countdown-label"
                className={slotProps?.label?.className}
                css={[labelStyle, slotProps?.label?.css]}
              >
                {label}
              </span>
            )}
            {state === 'running' && (
              <div
                data-ui="countdown-content"
                aria-hidden="true"
                className={slotProps?.content?.className}
                css={[contentStyle, slotProps?.content?.css]}
              >
                {partsFor(seconds, normalizedUnits).map(({ unit, value }) => {
                  const formatter = numberFormatter(locale, {
                    style: 'unit',
                    unit: UNIT_NAMES[unit],
                    unitDisplay,
                    minimumIntegerDigits: 2,
                    useGrouping: false,
                  });
                  const resolved = formatter.resolvedOptions();
                  return (
                    <bdi
                      key={`${unit}-${resolved.locale}-${resolved.numberingSystem}`}
                      data-ui="countdown-unit"
                      className={slotProps?.unit?.className}
                      css={[unitStyle, slotProps?.unit?.css]}
                    >
                      {formatter
                        .formatToParts(value)
                        .map((part, index) =>
                          part.type === 'integer' ? (
                            <NumericRun
                              key={index}
                              value={part.value}
                              variant={variant}
                              slot={slotProps?.number}
                            />
                          ) : (
                            <span key={index}>{part.value}</span>
                          ),
                        )}
                    </bdi>
                  );
                })}
              </div>
            )}
            {state === 'complete' &&
              !announce &&
              (hasContent(completeLabel) || hasContent(completionIcon)) && (
                <span
                  data-ui="countdown-complete"
                  className={slotProps?.complete?.className}
                  css={[completeStyle, slotProps?.complete?.css]}
                >
                  {completionContent}
                </span>
              )}
            {state === 'pending' && hasContent(pendingLabel) && (
              <span data-ui="countdown-pending">{pendingLabel}</span>
            )}
            {state === 'invalid' && hasContent(invalidLabel) && (
              <span data-ui="countdown-invalid" aria-hidden={invalidIsText ? undefined : true}>
                {invalidLabel}
              </span>
            )}
            {description !== undefined && (
              <span
                id={descriptionId}
                data-ui="countdown-description"
                className={slotProps?.description?.className}
                css={[visuallyHiddenStyle, slotProps?.description?.css]}
              >
                {description}
              </span>
            )}
          </div>
          {announceCompletion && (
            <span
              role="status"
              aria-live="polite"
              aria-atomic="true"
              data-ui="countdown-announcement"
              className={slotProps?.complete?.className}
              css={announce ? [completeStyle, slotProps?.complete?.css] : visuallyHiddenStyle}
            >
              {announce ? completionContent : null}
            </span>
          )}
        </>
      )}
    </WithSx>
  );
}

Countdown.displayName = 'Countdown';
