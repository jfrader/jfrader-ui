// WAI-ARIA progressbar (no APG keyboard pattern: it is not focusable and has no keyboard map).
// Determinate: aria-valuemin/max/now, plus aria-valuetext from `getValueLabel`. Indeterminate
// (`value` undefined): no aria-valuenow. An accessible name is required in every usage:
// provide `label` (rendered visually hidden inside the bar), `aria-label`, or `aria-labelledby`
// pointing at a visible label (`label` and `aria-labelledby` merge when given).
import { useId, type ComponentPropsWithRef, type ReactNode } from 'react';
import { vars } from '@jfrader/tokens/vars';
import { css, keyframes, type Interpolation, type Theme } from '../../styling/css';
import { FORCED_COLORS, REDUCED_MOTION } from '../../styling/media';
import { WithSx, type SxProps } from '../../styling/sx';
import { visuallyHiddenStyle } from '../../styling/visually-hidden';
import { isRenderable } from '../../utils/renderable';

export interface ProgressPartProps {
  className?: string;
  css?: Interpolation<Theme>;
}

export interface ProgressProps extends Omit<ComponentPropsWithRef<'div'>, 'children'>, SxProps {
  /** Current value in `0..max`; leave undefined for indeterminate progress. */
  value?: number;
  max?: number;
  /** Accessible name, rendered visually hidden. */
  label?: ReactNode;
  /** Human-readable value for assistive tech (aria-valuetext). */
  getValueLabel?: (value: number, max: number) => string;
  slotProps?: {
    indicator?: ProgressPartProps;
  };
}

const INDETERMINATE_WIDTH = '40%';
const SLIDE_TIMING = '1.4s ease-in-out infinite';
const DEFAULT_MAX = 100;

// The segment is 40% of the track: -100% starts it fully before the track, 250% ends it fully past.
const slideLtr = keyframes({
  from: { transform: 'translateX(-100%)' },
  to: { transform: 'translateX(250%)' },
});

const slideRtl = keyframes({
  from: { transform: 'translateX(100%)' },
  to: { transform: 'translateX(-250%)' },
});

const trackStyle = css({
  position: 'relative',
  display: 'block',
  boxSizing: 'border-box',
  blockSize: '4px',
  overflow: 'hidden',
  backgroundColor: vars.color.surfaceHover,
  border: `1px solid ${vars.color.borderSubtle}`,
  borderRadius: vars.radius.full,
});

const indicatorStyle = css({
  blockSize: '100%',
  backgroundColor: vars.color.accent,
  borderRadius: vars.radius.full,
  transitionProperty: 'width',
  transitionDuration: vars.motion.duration.base,
  transitionTimingFunction: vars.motion.easeStandard,
  [REDUCED_MOTION]: {
    transitionDuration: '0s',
  },
  // Forced colors drops author backgrounds; keep the fill visible with a system color.
  [FORCED_COLORS]: {
    forcedColorAdjust: 'none',
    backgroundColor: 'Highlight',
  },
});

const indeterminateIndicatorStyle = css({
  inlineSize: INDETERMINATE_WIDTH,
  animation: `${slideLtr} ${SLIDE_TIMING}`,
  '&:dir(rtl)': { animation: `${slideRtl} ${SLIDE_TIMING}` },
  [REDUCED_MOTION]: {
    '&, &:dir(rtl)': { animation: 'none' },
    opacity: 0.7,
  },
});

function normalizeProgress(value: number | undefined, max: number) {
  const normalizedMax = Number.isFinite(max) && max > 0 ? max : DEFAULT_MAX;
  const normalizedValue =
    value === undefined
      ? undefined
      : Math.min(Math.max(Number.isFinite(value) ? value : 0, 0), normalizedMax);
  return { value: normalizedValue, max: normalizedMax };
}

export function Progress({
  ref,
  value,
  max = DEFAULT_MAX,
  label,
  getValueLabel,
  slotProps,
  'aria-labelledby': ariaLabelledByProp,
  className,
  sx,
  ...rest
}: ProgressProps) {
  const labelId = `${useId()}-label`;
  const hasLabel = isRenderable(label);
  const ariaLabelledBy = [ariaLabelledByProp, hasLabel && labelId].filter(Boolean).join(' ') || undefined;
  const { value: current, max: normalizedMax } = normalizeProgress(value, max);
  const isIndeterminate = current === undefined;
  const percent = current === undefined ? 0 : (current / normalizedMax) * 100;

  return (
    <WithSx className={className} styles={trackStyle} sx={sx}>
      {(className) => (
        <div
          {...rest}
          ref={ref}
          role="progressbar"
          data-ui="progress"
          data-state={isIndeterminate ? 'indeterminate' : 'determinate'}
          aria-labelledby={ariaLabelledBy}
          aria-valuemin={0}
          aria-valuemax={normalizedMax}
          aria-valuenow={current}
          aria-valuetext={current === undefined ? undefined : getValueLabel?.(current, normalizedMax)}
          className={className}
        >
          {hasLabel && (
            <span id={labelId} css={visuallyHiddenStyle}>
              {label}
            </span>
          )}
          <div
            data-ui="progress-indicator"
            className={slotProps?.indicator?.className}
            style={isIndeterminate ? undefined : { width: `${percent}%` }}
            css={[indicatorStyle, isIndeterminate && indeterminateIndicatorStyle, slotProps?.indicator?.css]}
          />
        </div>
      )}
    </WithSx>
  );
}

Progress.displayName = 'Progress';
