import { withoutSx } from '../../styling/sx';
'use client';

// APG horizontal single/multi-thumb slider: arrows, Shift+arrows, PageUp/Down,
// Home/End. Horizontal arrows mirror in RTL; Up/PageUp always increase.
// Commit reports the completed request, not controlled-parent acceptance.
// Hidden inputs support submission, not native required/range validation.
import { useState, type ComponentPropsWithRef, type ComponentType, type ReactNode } from 'react';
import { MotionConfig, motion, useReducedMotion } from 'motion/react';
import { vars } from '@jfrader/tokens/vars';
import { css } from '../../styling/css';
import { focusRingOutset } from '../../styling/focus-ring';
import { FORCED_COLORS, REDUCED_MOTION } from '../../styling/media';
import type { SxProps } from '../../styling/sx';
import { PresentationSlot, type PresentationProps } from '../../utils/presentation-slot';
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
export interface SliderSlots {
  /** Replaces the outer field element, not the track. */
  root?: ComponentType<ComponentPropsWithRef<'div'>>;
  /** Text naming the slider. */
  label?: ComponentType<Part<'span'>>;
  /** Current formatted value. */
  readout?: ComponentType<Part<'span'>>;
  /** Helper text below the control. */
  description?: ComponentType<Part<'div'>>;
  /** Validation message below the control. */
  error?: ComponentType<Part<'div'>>;
  /** Interactive area holding the track and thumbs. */
  control?: ComponentType<Part<'div'>>;
  /** Background track bar. */
  track?: ComponentType<Part<'div'>>;
  /** Selected range bar. */
  fill?: ComponentType<Part<'div'>>;
  /** Draggable value handle. */
  thumb?: ComponentType<Part<'div'>>;
  /** Value displayed above a thumb. */
  bubble?: ComponentType<Part<'span'>>;
  /** Button selecting a discrete value. */
  mark?: ComponentType<Part<'button'>>;
  /** Content before the control. */
  start?: ComponentType<Part<'div'>>;
  /** Content after the control. */
  end?: ComponentType<Part<'div'>>;
}
export interface SliderSlotProps {
  /** Outer field element. */
  root?: PresentationProps<'div'>;
  /** Text label naming the slider. */
  label?: Part<'span'>;
  /** Text element displaying the current numeric value. */
  readout?: Part<'span'>;
  /** Helper text container displayed below the control. */
  description?: Part<'div'>;
  /** Validation error message container displayed when invalid. */
  error?: Part<'div'>;
  /** Interactive area enclosing track, fill, and thumbs. */
  control?: Part<'div'>;
  /** Background track bar element. */
  track?: Part<'div'>;
  /** Highlighted range bar showing selected value extent. */
  fill?: Part<'div'>;
  /** Draggable handle used to adjust the value. */
  thumb?: Part<'div'> | ((index: number) => Part<'div'>);
  /** Value tooltip bubble floating above the thumb. */
  bubble?: Part<'span'>;
  /** Discrete tick button along the track. */
  mark?: Part<'button'> | ((index: number) => Part<'button'>);
  /** Container holding prefix content before the slider. */
  start?: Part<'div'>;
  /** Container holding suffix content after the slider. */
  end?: Part<'div'>;
}
interface SliderCommonProps
  extends Omit<ComponentPropsWithRef<'div'>, 'defaultValue' | 'onChange' | 'children'>, SxProps {
  /** Shorthand for slots.root. */
  component?: SliderSlots['root'];
  /** Names the slider with a visible label. */
  label: ReactNode;
  /** Shows supporting text associated with the thumbs. */
  description?: ReactNode;
  /** Shows error text associated with the thumbs. */
  error?: ReactNode;
  /** Marks the thumbs invalid. Defaults to `false`. */
  invalid?: boolean;
  /** Prevents pointer and keyboard value changes. Defaults to `false`. */
  disabled?: boolean;
  /** Sets the lowest selectable value. Defaults to 0. */
  min?: number;
  /** Sets the highest selectable value. Defaults to 100. */
  max?: number;
  /** Sets the positive increment between values. Defaults to 1. */
  step?: number;
  /** Sets the Page Up/Down increment, rounded to a positive multiple of `step`. Defaults to one tenth of the range. */
  largeStep?: number;
  /** Adds selectable labeled positions along the track. */
  marks?: readonly SliderMark[];
  /** Sets the locale used to format values. Defaults to the runtime locale. */
  locale?: Intl.LocalesArgument;
  /** Configures number formatting for displayed and accessible values. */
  formatOptions?: Intl.NumberFormatOptions;
  /** Overrides value text using the configured number formatter. */
  formatValue?: (value: number, formatter: Intl.NumberFormat) => string;
  /** Shows the value readout beside the label. Defaults to `true`; thumb bubbles remain available. */
  showValue?: boolean;
  /** Adds content before the slider control. */
  start?: ReactNode;
  /** Adds content after the slider control. */
  end?: ReactNode;
  /** Sets the slider's visual size. Defaults to `md`. */
  size?: SliderSize;
  /** Passes props and `sx` to individual slider parts. */
  slotProps?: SliderSlotProps;
  /** Replaces the elements rendering individual slider parts. */
  slots?: SliderSlots;
}
export type SliderProps = SliderCommonProps &
  (
    | {
        /** Selects one value with a single thumb. This is the default mode. */
        type?: 'single';
        /** Controls the selected value. */
        value?: number;
        /** Sets the initial uncontrolled value. Defaults to `min`. */
        defaultValue?: number;
        /** Receives requested values during interaction. */
        onValueChange?: (value: number) => void;
        /** Receives the final value after a changed drag, keyboard step or mark selection. */
        onValueCommit?: (value: number) => void;
        /** Submits the value through a hidden form input. */
        name?: string;
        thumbLabels?: never;
        minStepsBetweenThumbs?: never;
      }
    | {
        /** Selects lower and upper values with two thumbs. */
        type: 'range';
        /** Controls the lower and upper selected values. */
        value?: readonly [number, number];
        /** Sets the initial uncontrolled bounds. Defaults to `[min, max]`. */
        defaultValue?: readonly [number, number];
        /** Receives requested bounds during interaction. */
        onValueChange?: (value: readonly [number, number]) => void;
        /** Receives the final bounds after a changed drag, keyboard step or mark selection. */
        onValueCommit?: (value: readonly [number, number]) => void;
        /** Names the hidden form inputs with a shared name or one name per bound. */
        name?: string | readonly [string, string];
        /** Names the lower and upper thumbs for assistive technology. */
        thumbLabels: readonly [string, string];
        /** Sets the minimum gap between thumbs in multiples of `step`. Defaults to 0. */
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
    slots,
    component,
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
  const Label = slots?.label ?? 'span';
  const Readout = slots?.readout ?? 'span';
  const Description = slots?.description ?? 'div';
  const Error = slots?.error ?? 'div';
  const Control = slots?.control ?? 'div';
  const Track = slots?.track ?? 'div';
  const Fill = slots?.fill ?? 'div';
  const Thumb = slots?.thumb ?? 'div';
  const Bubble = slots?.bubble ?? 'span';
  const Mark = slots?.mark ?? 'button';
  const Start = slots?.start ?? 'div';
  const End = slots?.end ?? 'div';
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
          <PresentationSlot
            element="div"
            component={slots?.root ?? component}
            slotProps={slotProps?.root}
            styles={rootStyle}
            sx={sx}
            {...rest}
            ref={ref}
            className={className}
            marker="slider"
            data-disabled={disabled || undefined}
            onKeyDown={(event) => {
              onKeyDown?.(event);
              slider.handleRootKeyDown(event);
            }}
          >
            {(hasLabel || showValue) && (
              <div css={sliderHeaderStyle}>
                {hasLabel && (
                  <Label
                    {...withoutSx(slotProps?.label)}
                    id={`${id}-label`}
                    css={[sliderLabelStyle, slotProps?.label?.sx]}
                  >
                    {label}
                  </Label>
                )}
                {showValue && (
                  <Readout
                    {...withoutSx(slotProps?.readout)}
                    aria-hidden="true"
                    css={[sliderReadoutStyle, slotProps?.readout?.sx]}
                  >
                    {readout}
                  </Readout>
                )}
              </div>
            )}
            {hasDescription && (
              <Description
                {...withoutSx(slotProps?.description)}
                id={`${id}-description`}
                css={[sliderDescriptionStyle, slotProps?.description?.sx]}
              >
                {description}
              </Description>
            )}
            {hasError && (
              <Error
                {...withoutSx(slotProps?.error)}
                id={`${id}-error`}
                role="alert"
                css={[sliderErrorStyle, slotProps?.error?.sx]}
              >
                {error}
              </Error>
            )}
            <div css={sliderRowStyle}>
              {hasContent(start) && <Start {...slotProps?.start}>{start}</Start>}
              <Control
                {...withoutSx(slotProps?.control)}
                {...slider.controlHandlers(slotProps?.control)}
                css={[sliderControlStyle, sliderSizeStyles[size], slotProps?.control?.sx]}
                data-ui="slider-control"
                data-disabled={disabled || undefined}
              >
                <Track
                  {...withoutSx(slotProps?.track)}
                  data-ui="slider-track"
                  aria-hidden="true"
                  css={[trackStyle, slotProps?.track?.sx]}
                >
                  <Fill
                    {...withoutSx(slotProps?.fill)}
                    data-ui="slider-fill"
                    css={[fillStyle, slotProps?.fill?.sx]}
                    style={{
                      ...slotProps?.fill?.style,
                      insetInlineStart: `${startPercent}%`,
                      inlineSize: `${endPercent - startPercent}%`,
                    }}
                  />
                </Track>
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
                    <Thumb
                      {...withoutSx(part)}
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
                      css={[thumbStyle, part?.sx]}
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
                      <Bubble
                        {...withoutSx(slotProps?.bubble)}
                        data-ui="slider-bubble"
                        aria-hidden="true"
                        css={[bubbleStyle, slotProps?.bubble?.sx]}
                        style={{
                          ...slotProps?.bubble?.style,
                          ...(percent(n) <= 50 ? { insetInlineStart: 0 } : { insetInlineEnd: 0 }),
                        }}
                      >
                        {format(n)}
                      </Bubble>
                    </Thumb>
                  );
                })}
              </Control>
              {hasContent(end) && <End {...slotProps?.end}>{end}</End>}
            </div>
            {normalizedMarks.some((mark) => hasContent(mark.label)) && (
              <div css={sliderMarksStyle}>
                {normalizedMarks.map((mark, index) => {
                  if (!hasContent(mark.label)) return null;
                  const part = indexedPart(slotProps?.mark, index);
                  return (
                    <Mark
                      {...withoutSx(part)}
                      key={index}
                      type="button"
                      disabled={disabled}
                      css={[sliderMarkStyle, part?.sx]}
                      onClick={(e) => {
                        part?.onClick?.(e);
                        if (!e.defaultPrevented) slider.selectMark(mark.value);
                      }}
                    >
                      {mark.label}
                    </Mark>
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
          </PresentationSlot>
    </MotionConfig>
  );
}

Slider.displayName = 'Slider';
