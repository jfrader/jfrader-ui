'use client';

// APG horizontal single/multi-thumb slider: arrows, Shift+arrows, PageUp/Down,
// Home/End. Horizontal arrows mirror in RTL; Up/PageUp always increase.
// Commit reports the completed request, not controlled-parent acceptance.
// Hidden inputs support submission, not native required/range validation.
import { useState, type ComponentPropsWithRef, type ReactNode } from 'react';
import { MotionConfig, motion, useReducedMotion } from 'motion/react';
import { vars } from '@jfrader/tokens/vars';
import { css } from '../../styling/css';
import { focusRingOutset } from '../../styling/focus-ring';
import { FORCED_COLORS, REDUCED_MOTION } from '../../styling/media';
import { WithSx, type SxProps } from '../../styling/sx';
import { visuallyHiddenStyle } from '../../styling/visually-hidden';
import {
  hasContent,
  indexedPart,
  joinIds,
  useSliderFormat,
  useSliderInteraction,
  type SliderMark,
  type SliderPart as Part,
} from './use-slider-interaction';
import {
  sliderControlStyle,
  sliderDescriptionStyle,
  sliderErrorStyle,
  sliderHeaderStyle,
  sliderLabelStyle,
  sliderMarkStyle,
  sliderMarksStyle,
  sliderReadoutStyle,
  sliderRootStyle,
  sliderRowStyle,
  sliderSizeStyles,
} from './slider-style';

export type { SliderMark, SliderValue } from './use-slider-interaction';
export type SliderSize = 'sm' | 'md';
export interface SliderSlotProps {
  label?: Part<'span'>;
  readout?: Part<'span'>;
  description?: Part<'div'>;
  error?: Part<'div'>;
  control?: Part<'div'>;
  track?: Part<'div'>;
  fill?: Part<'div'>;
  thumb?: Part<'div'> | ((index: number) => Part<'div'>);
  bubble?: Part<'span'>;
  mark?: Part<'button'> | ((index: number) => Part<'button'>);
  start?: Part<'div'>;
  end?: Part<'div'>;
}
interface SliderCommonProps
  extends Omit<ComponentPropsWithRef<'div'>, 'defaultValue' | 'onChange' | 'children'>, SxProps {
  label: ReactNode;
  description?: ReactNode;
  error?: ReactNode;
  invalid?: boolean;
  disabled?: boolean;
  min?: number;
  max?: number;
  step?: number;
  largeStep?: number;
  marks?: readonly SliderMark[];
  locale?: Intl.LocalesArgument;
  formatOptions?: Intl.NumberFormatOptions;
  formatValue?: (value: number, formatter: Intl.NumberFormat) => string;
  showValue?: boolean;
  start?: ReactNode;
  end?: ReactNode;
  size?: SliderSize;
  slotProps?: SliderSlotProps;
}
export type SliderProps = SliderCommonProps &
  (
    | {
        type?: 'single';
        value?: number;
        defaultValue?: number;
        onValueChange?: (value: number) => void;
        onValueCommit?: (value: number) => void;
        name?: string;
        thumbLabels?: never;
        minStepsBetweenThumbs?: never;
      }
    | {
        type: 'range';
        value?: readonly [number, number];
        defaultValue?: readonly [number, number];
        onValueChange?: (value: readonly [number, number]) => void;
        onValueCommit?: (value: readonly [number, number]) => void;
        name?: string | readonly [string, string];
        thumbLabels: readonly [string, string];
        minStepsBetweenThumbs?: number;
      }
  );

const SETTLING_SPRING = { type: 'spring', stiffness: 420, damping: 30 } as const;
const STRAIN_BOUND = 8;
const rootStyle = css(sliderRootStyle, { label: 'slider' });
const trackStyle = css({
  position: 'absolute',
  insetInline: 0,
  insetBlockStart: '50%',
  transform: 'translateY(-50%)',
  blockSize: vars.space[1],
  boxSizing: 'border-box',
  border: `1px solid ${vars.color.borderControl}`,
  borderRadius: vars.radius.full,
  background: vars.color.surfaceInset,
  pointerEvents: 'none',
  [FORCED_COLORS]: { forcedColorAdjust: 'none', background: 'Canvas', borderColor: 'CanvasText' },
});
const fillStyle = css({
  position: 'absolute',
  insetBlock: 0,
  background: vars.color.accent,
  borderRadius: vars.radius.full,
  [FORCED_COLORS]: { background: 'Highlight' },
});
const thumbStyle = css({
  position: 'absolute',
  insetBlockStart: '50%',
  transform: 'translate(-50%, -50%)',
  '&:dir(rtl)': { transform: 'translate(50%, -50%)' },
  inlineSize: vars.space[8],
  blockSize: vars.space[8],
  display: 'grid',
  placeItems: 'center',
  borderRadius: vars.radius.full,
  cursor: 'grab',
  '&:focus-visible': { ...focusRingOutset, zIndex: 2 },
  '&[data-dragging]': { cursor: 'grabbing', zIndex: 3 },
  '&[aria-disabled="true"]': { cursor: 'default' },
});
const visualStyle = css({
  inlineSize: vars.space[6],
  blockSize: vars.space[6],
  boxSizing: 'border-box',
  border: `2px solid ${vars.color.borderControl}`,
  borderRadius: vars.radius.full,
  background: vars.color.surfaceRaised,
  boxShadow: vars.shadow.raised,
  pointerEvents: 'none',
  [FORCED_COLORS]: {
    forcedColorAdjust: 'none',
    background: 'Canvas',
    borderColor: 'CanvasText',
    boxShadow: 'none',
  },
});
const bubbleStyle = css({
  position: 'absolute',
  insetBlockEnd: `calc(100% + ${vars.space[2]})`,
  paddingInline: vars.space[2],
  paddingBlock: vars.space[1],
  inlineSize: 'max-content',
  maxInlineSize: 'min(24rem, 80vw)',
  overflowWrap: 'anywhere',
  border: `1px solid ${vars.color.borderControl}`,
  borderRadius: vars.radius.md,
  background: vars.color.surfaceRaised,
  color: vars.color.text,
  boxShadow: vars.shadow.raised,
  pointerEvents: 'none',
  fontSize: vars.textSize.xs,
  opacity: 0,
  transition: `opacity ${vars.motion.duration.fast} ${vars.motion.easeStandard}`,
  '[data-dragging] > &, [data-slider-thumb]:focus-visible > &': { opacity: 1 },
  [REDUCED_MOTION]: { transitionDuration: '0s' },
  [FORCED_COLORS]: { borderColor: 'CanvasText', boxShadow: 'none' },
});
const tickStyle = css({
  position: 'absolute',
  insetBlockStart: '50%',
  transform: 'translate(-50%, -50%)',
  inlineSize: vars.space[1],
  blockSize: vars.space[2],
  border: `1px solid ${vars.color.borderControl}`,
  background: vars.color.surfaceRaised,
  boxSizing: 'border-box',
  pointerEvents: 'none',
  [FORCED_COLORS]: { background: 'Canvas', borderColor: 'CanvasText' },
});

export function Slider(props: SliderProps) {
  const {
    ref,
    type = 'single',
    value,
    defaultValue,
    label,
    description,
    error,
    invalid = false,
    disabled = false,
    min = 0,
    max = 100,
    step = 1,
    largeStep,
    minStepsBetweenThumbs = 0,
    marks = [],
    thumbLabels,
    locale,
    formatOptions,
    formatValue,
    showValue = true,
    start,
    end,
    name,
    size = 'md',
    slotProps,
    onValueChange,
    onValueCommit,
    className,
    sx,
    onKeyDown,
    'aria-label': ariaLabelProp,
    'aria-labelledby': ariaLabelledByProp,
    'aria-describedby': ariaDescribedByProp,
    'aria-invalid': ariaInvalidProp,
    ...rest
  } = props;
  const range = type === 'range';
  const reduced = useReducedMotion();
  const [strain, setStrain] = useState(0);
  const slider = useSliderInteraction({
    component: 'Slider',
    range,
    value,
    defaultValue,
    min,
    max,
    step,
    largeStep,
    minStepsBetweenThumbs,
    disabled,
    // `props.type === 'range'` (not the `range` alias) is required for the discriminant narrowing.
    onValueChange: (next) => {
      if (props.type === 'range') props.onValueChange?.(next as readonly [number, number]);
      else props.onValueChange?.(next as number);
    },
    onValueCommit: (next) => {
      if (props.type === 'range') props.onValueCommit?.(next as readonly [number, number]);
      else props.onValueCommit?.(next as number);
    },
    onPointerSample: ({ raw, low, high, rtl }) =>
      setStrain(
        reduced
          ? 0
          : Math.max(
              -STRAIN_BOUND,
              Math.min(STRAIN_BOUND, (raw - Math.max(low, Math.min(high, raw))) * (rtl ? -1 : 1)),
            ),
      ),
    onGestureEnd: () => setStrain(0),
  });
  const { id, current, values, active, bounds, percent } = slider;
  const { formatter, format } = useSliderFormat(locale, formatOptions, formatValue);
  const readout =
    typeof current === 'number'
      ? format(current)
      : !formatValue && 'formatRange' in formatter
        ? formatter.formatRange(current[0], current[1])
        : `${format(current[0])} – ${format(current[1])}`;
  const normalizedMarks = slider.normalizeMarks(marks);
  const startPercent = range ? percent(values[0]!) : 0;
  const endPercent = percent(values[range ? 1 : 0]!);
  const hasLabel = hasContent(label);
  const hasDescription = hasContent(description);
  const hasError = hasContent(error);
  return (
    <MotionConfig reducedMotion="user">
      <WithSx className={className} styles={rootStyle} sx={sx}>
        {(rootClass) => (
          <div
            {...rest}
            ref={ref}
            className={rootClass}
            data-ui="slider"
            data-disabled={disabled || undefined}
            onKeyDown={(event) => {
              onKeyDown?.(event);
              slider.handleRootKeyDown(event);
            }}
          >
            {(hasLabel || showValue) && (
              <div css={sliderHeaderStyle}>
                {hasLabel && (
                  <span
                    {...slotProps?.label}
                    id={`${id}-label`}
                    css={[sliderLabelStyle, slotProps?.label?.css]}
                  >
                    {label}
                  </span>
                )}
                {showValue && (
                  <span
                    {...slotProps?.readout}
                    aria-hidden="true"
                    css={[sliderReadoutStyle, slotProps?.readout?.css]}
                  >
                    {readout}
                  </span>
                )}
              </div>
            )}
            {hasDescription && (
              <div
                {...slotProps?.description}
                id={`${id}-description`}
                css={[sliderDescriptionStyle, slotProps?.description?.css]}
              >
                {description}
              </div>
            )}
            {hasError && (
              <div
                {...slotProps?.error}
                id={`${id}-error`}
                role="alert"
                css={[sliderErrorStyle, slotProps?.error?.css]}
              >
                {error}
              </div>
            )}
            <div css={sliderRowStyle}>
              {hasContent(start) && <div {...slotProps?.start}>{start}</div>}
              <div
                {...slotProps?.control}
                {...slider.controlHandlers(slotProps?.control)}
                css={[sliderControlStyle, sliderSizeStyles[size], slotProps?.control?.css]}
                data-ui="slider-control"
                data-disabled={disabled || undefined}
              >
                <div
                  {...slotProps?.track}
                  data-ui="slider-track"
                  aria-hidden="true"
                  css={[trackStyle, slotProps?.track?.css]}
                >
                  <div
                    {...slotProps?.fill}
                    data-ui="slider-fill"
                    css={[fillStyle, slotProps?.fill?.css]}
                    style={{
                      ...slotProps?.fill?.style,
                      insetInlineStart: `${startPercent}%`,
                      inlineSize: `${endPercent - startPercent}%`,
                    }}
                  />
                </div>
                {normalizedMarks.map((mark, index) => (
                  <span
                    key={index}
                    aria-hidden="true"
                    css={tickStyle}
                    style={{ insetInlineStart: `${percent(mark.value)}%` }}
                  />
                ))}
                {values.map((n, index) => {
                  const part = indexedPart(slotProps?.thumb, index);
                  const [low, high] = bounds(index);
                  return (
                    <div
                      {...part}
                      key={index}
                      id={`${id}-thumb-${index}`}
                      data-slider-thumb={index}
                      data-dragging={active === index || undefined}
                      role="slider"
                      tabIndex={disabled ? -1 : 0}
                      aria-orientation="horizontal"
                      aria-disabled={disabled}
                      aria-invalid={hasError || invalid ? true : (part?.['aria-invalid'] ?? ariaInvalidProp)}
                      aria-valuemin={low}
                      aria-valuemax={high}
                      aria-valuenow={n}
                      aria-valuetext={format(n)}
                      aria-label={part?.['aria-label'] ?? (range ? thumbLabels?.[index] : ariaLabelProp)}
                      aria-labelledby={joinIds(
                        ariaLabelledByProp,
                        part?.['aria-labelledby'],
                        range ? `${id}-name-${index}` : hasLabel && `${id}-label`,
                      )}
                      aria-describedby={joinIds(
                        ariaDescribedByProp,
                        part?.['aria-describedby'],
                        hasDescription && `${id}-description`,
                        hasError && `${id}-error`,
                      )}
                      css={[thumbStyle, part?.css]}
                      style={{ ...part?.style, insetInlineStart: `${percent(n)}%` }}
                      onFocus={(e) => {
                        slider.noteFocus(index);
                        part?.onFocus?.(e);
                      }}
                      onKeyDown={(e) => {
                        part?.onKeyDown?.(e);
                      }}
                    >
                      <motion.span
                        aria-hidden="true"
                        css={visualStyle}
                        animate={{
                          scale: reduced ? 1 : active === index ? 0.95 : 1,
                          x: reduced ? 0 : active === index ? strain : 0,
                        }}
                        transition={reduced ? { duration: 0 } : SETTLING_SPRING}
                      />
                      {range && (
                        <span id={`${id}-name-${index}`} css={visuallyHiddenStyle}>
                          {thumbLabels?.[index]}
                        </span>
                      )}
                      <span
                        {...slotProps?.bubble}
                        data-ui="slider-bubble"
                        aria-hidden="true"
                        css={[bubbleStyle, slotProps?.bubble?.css]}
                        style={{
                          ...slotProps?.bubble?.style,
                          ...(percent(n) <= 50 ? { insetInlineStart: 0 } : { insetInlineEnd: 0 }),
                        }}
                      >
                        {format(n)}
                      </span>
                    </div>
                  );
                })}
              </div>
              {hasContent(end) && <div {...slotProps?.end}>{end}</div>}
            </div>
            {normalizedMarks.some((mark) => hasContent(mark.label)) && (
              <div css={sliderMarksStyle}>
                {normalizedMarks.map((mark, index) => {
                  if (!hasContent(mark.label)) return null;
                  const part = indexedPart(slotProps?.mark, index);
                  return (
                    <button
                      {...part}
                      key={index}
                      type="button"
                      disabled={disabled}
                      css={[sliderMarkStyle, part?.css]}
                      onClick={(e) => {
                        part?.onClick?.(e);
                        if (!e.defaultPrevented) slider.selectMark(mark.value);
                      }}
                    >
                      {mark.label}
                    </button>
                  );
                })}
              </div>
            )}
            {name !== undefined &&
              values.map((n, index) => (
                <input
                  key={index}
                  type="hidden"
                  disabled={disabled}
                  name={typeof name === 'string' ? name : name[index]}
                  value={n}
                />
              ))}
          </div>
        )}
      </WithSx>
    </MotionConfig>
  );
}

Slider.displayName = 'Slider';
