'use client';

// APG horizontal single-thumb slider with elastic feedback. Values, keys, pointer capture,
// commits and form behavior come from the shared slider engine; this skin only adds visuals:
// overscroll stretch, thumb swell, a tilting value tag and magnetic detents on marks.
// Detents adjust pointer requests on the step lattice; keys and mark buttons reach every value.
// Elastic geometry never changes the value, ARIA or form state.
import { useEffect, useRef, useState, type ComponentPropsWithRef, type ReactNode } from 'react';
import {
  MotionConfig,
  motion,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useSpring,
  useTransform,
  useVelocity,
} from 'motion/react';
import { vars } from '@jfrader/tokens/vars';
import { css, keyframes } from '../../styling/css';
import { focusRingOutset } from '../../styling/focus-ring';
import { COARSE_POINTER, FORCED_COLORS, REDUCED_MOTION } from '../../styling/media';
import { WithSx, type SxProps } from '../../styling/sx';
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
} from '../slider/slider-style';
import {
  hasContent,
  indexedPart,
  joinIds,
  useSliderFormat,
  useSliderInteraction,
  type SliderMark,
  type SliderPart as Part,
  type SliderPointerSample,
} from '../slider/use-slider-interaction';

export type ElasticSliderMark = SliderMark;
export type ElasticSliderSize = 'sm' | 'md';
export interface ElasticSliderSlotProps {
  label?: Part<'span'>;
  readout?: Part<'span'>;
  description?: Part<'div'>;
  error?: Part<'div'>;
  control?: Part<'div'>;
  rail?: Part<'div'>;
  track?: Part<'div'>;
  fill?: Part<'div'>;
  thumb?: Part<'div'>;
  bubble?: Part<'span'>;
  tick?: Part<'span'> | ((index: number) => Part<'span'>);
  mark?: Part<'button'> | ((index: number) => Part<'button'>);
  start?: Part<'div'>;
  end?: Part<'div'>;
}
export interface ElasticSliderProps
  extends Omit<ComponentPropsWithRef<'div'>, 'defaultValue' | 'onChange' | 'children'>, SxProps {
  label: ReactNode;
  value?: number;
  defaultValue?: number;
  onValueChange?: (value: number) => void;
  onValueCommit?: (value: number) => void;
  description?: ReactNode;
  error?: ReactNode;
  invalid?: boolean;
  disabled?: boolean;
  min?: number;
  max?: number;
  step?: number;
  largeStep?: number;
  /** Detents. Normalized to the step lattice; invalid or out-of-domain marks are ignored. */
  marks?: readonly ElasticSliderMark[];
  locale?: Intl.LocalesArgument;
  formatOptions?: Intl.NumberFormatOptions;
  formatValue?: (value: number, formatter: Intl.NumberFormat) => string;
  showValue?: boolean;
  start?: ReactNode;
  end?: ReactNode;
  /** Short vibration when a touch drag latches onto a detent, where supported. Off under reduced motion. */
  haptics?: boolean;
  name?: string;
  size?: ElasticSliderSize;
  slotProps?: ElasticSliderSlotProps;
}

/** Visual overscroll cap in CSS px. */
const MAX_STRETCH_PX = 26;
/** Track thickness kept at full stretch (fraction of rest thickness). */
const MIN_SQUASH = 0.6;
const THUMB_SWELL = 1.15;
/** Pointer distance (CSS px) that latches a detent, and the larger distance that releases it. */
const DETENT_ENTRY_PX = 7;
const DETENT_RELEASE_PX = 10;
const HAPTIC_PULSE_MS = 6;
/** Tag tilt per percent-of-track per second, capped at MAX_TAG_TILT_DEG. */
const TAG_TILT_PER_VELOCITY = 0.02;
const MAX_TAG_TILT_DEG = 10;
const SNAPBACK_SPRING = { stiffness: 380, damping: 26 };
const TAG_SPRING = { stiffness: 300, damping: 20 };
const SWELL_SPRING = { type: 'spring', stiffness: 420, damping: 28 } as const;
const STRETCH_START = '--elastic-slider-stretch-start';
const STRETCH_END = '--elastic-slider-stretch-end';
const SQUASH = '--elastic-slider-squash';
const SHIFT = '--elastic-slider-shift';
const TILT = '--elastic-slider-tilt';

const tickPop = keyframes({ '0%': { scale: '1' }, '45%': { scale: '1.8' }, '100%': { scale: '1' } });
const rootStyle = css(sliderRootStyle, { label: 'elastic-slider' });
const controlStyle = css({ marginInline: vars.space[6] });
const railStyle = css({
  position: 'absolute',
  insetInline: 0,
  insetBlock: 0,
  marginBlock: 'auto',
  blockSize: vars.space[2],
  borderRadius: vars.radius.full,
  background: vars.color.surfaceInset,
  pointerEvents: 'none',
  [FORCED_COLORS]: { forcedColorAdjust: 'none', background: 'Canvas' },
});
const trackStyle = css({
  position: 'absolute',
  insetInlineStart: `calc(-1 * var(${STRETCH_START}, 0px))`,
  insetInlineEnd: `calc(-1 * var(${STRETCH_END}, 0px))`,
  insetBlock: 0,
  marginBlock: 'auto',
  blockSize: vars.space[2],
  boxSizing: 'border-box',
  overflow: 'hidden',
  border: `1px solid ${vars.color.borderControl}`,
  borderRadius: vars.radius.full,
  scale: `1 var(${SQUASH}, 1)`,
  pointerEvents: 'none',
  [REDUCED_MOTION]: { insetInline: 0, scale: 'none' },
  [FORCED_COLORS]: { forcedColorAdjust: 'none', borderColor: 'CanvasText' },
});
const fillStyle = css({
  position: 'absolute',
  insetBlock: 0,
  insetInlineStart: 0,
  background: vars.color.accent,
  [FORCED_COLORS]: { background: 'Highlight' },
});
const tickStyle = css({
  position: 'absolute',
  insetBlock: 0,
  marginBlock: 'auto',
  marginInlineStart: `calc(${vars.space[1]} / -2)`,
  inlineSize: vars.space[1],
  blockSize: vars.space[3],
  boxSizing: 'border-box',
  border: `1px solid ${vars.color.borderControl}`,
  borderRadius: vars.radius.full,
  background: vars.color.surfaceRaised,
  pointerEvents: 'none',
  '&[data-latched]': {
    blockSize: vars.space[4],
    background: vars.color.accent,
    animation: `${tickPop} ${vars.motion.duration.slow} ${vars.motion.easeStandard}`,
  },
  [REDUCED_MOTION]: { '&[data-latched]': { animation: 'none' } },
  [FORCED_COLORS]: {
    forcedColorAdjust: 'none',
    background: 'Canvas',
    borderColor: 'CanvasText',
    '&[data-latched]': { background: 'Highlight' },
  },
});
const thumbStyle = css({
  position: 'absolute',
  insetBlock: 0,
  marginBlock: 'auto',
  marginInlineStart: `calc(${vars.space[8]} / -2)`,
  inlineSize: vars.space[8],
  blockSize: vars.space[8],
  display: 'grid',
  placeItems: 'center',
  borderRadius: vars.radius.full,
  // The whole thumb follows the stretched track end, so the focus ring stays on the visual.
  translate: `var(${SHIFT}, 0px)`,
  cursor: 'grab',
  '&:focus-visible': { ...focusRingOutset, zIndex: 2 },
  [REDUCED_MOTION]: { translate: 'none' },
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
  fontSize: vars.textSize.xs,
  fontVariantNumeric: 'tabular-nums',
  pointerEvents: 'none',
  transformOrigin: 'bottom center',
  rotate: `var(${TILT}, 0deg)`,
  opacity: 0,
  transition: `opacity ${vars.motion.duration.fast} ${vars.motion.easeStandard}`,
  '[data-dragging] > &, [data-slider-thumb]:focus-visible > &': { opacity: 1 },
  [COARSE_POINTER]: { insetBlockEnd: `calc(100% + ${vars.space[4]})` },
  [REDUCED_MOTION]: { rotate: 'none' },
  [FORCED_COLORS]: { borderColor: 'CanvasText', boxShadow: 'none' },
});

/** Rubber-band response: grows with overshoot and approaches MAX_STRETCH_PX asymptotically. */
function rubberBand(overshootPx: number) {
  return Math.sign(overshootPx) * MAX_STRETCH_PX * (1 - Math.exp(-Math.abs(overshootPx) / MAX_STRETCH_PX));
}

export function ElasticSlider(props: ElasticSliderProps) {
  const {
    ref,
    value,
    defaultValue,
    onValueChange,
    onValueCommit,
    label,
    description,
    error,
    invalid = false,
    disabled = false,
    min = 0,
    max = 100,
    step = 1,
    largeStep,
    marks = [],
    locale,
    formatOptions,
    formatValue,
    showValue = true,
    start,
    end,
    haptics = false,
    name,
    size = 'md',
    slotProps,
    className,
    sx,
    onKeyDown,
    'aria-label': ariaLabelProp,
    'aria-labelledby': ariaLabelledByProp,
    'aria-describedby': ariaDescribedByProp,
    'aria-invalid': ariaInvalidProp,
    ...rest
  } = props;
  const reduced = useReducedMotion() ?? false;
  const stretch = useSpring(0, SNAPBACK_SPRING);
  const latchRef = useRef<number | null>(null);
  const rtlRef = useRef(false);
  const [latched, setLatched] = useState<number | null>(null);
  const setLatch = (next: number | null) => {
    latchRef.current = next;
    setLatched(next);
  };
  const vibrate = (pointerType: string) => {
    if (!haptics || reduced || pointerType !== 'touch') return;
    const navigator = slider.controlRef.current?.ownerDocument.defaultView?.navigator;
    if (typeof navigator?.vibrate !== 'function') return;
    try {
      navigator.vibrate(HAPTIC_PULSE_MS);
    } catch {
      // Vibration is optional feedback; a refusing platform changes nothing.
    }
  };
  const slider = useSliderInteraction({
    component: 'ElasticSlider',
    range: false,
    value,
    defaultValue,
    min,
    max,
    step,
    largeStep,
    minStepsBetweenThumbs: 0,
    disabled,
    onValueChange: (next) => onValueChange?.(next as number),
    onValueCommit: (next) => onValueCommit?.(next as number),
    onPointerSample: ({ raw, low, high, pxPerUnit, rtl }: SliderPointerSample) => {
      rtlRef.current = rtl;
      stretch.set(reduced ? 0 : rubberBand((raw - Math.max(low, Math.min(high, raw))) * pxPerUnit));
    },
    resolvePointer: ({ raw, pxPerUnit, pointerType }: SliderPointerSample) => {
      const distance = (detent: number) => Math.abs(raw - detent) * pxPerUnit;
      let next = latchRef.current;
      if (next !== null && distance(next) > DETENT_RELEASE_PX) next = null;
      if (next === null) {
        // Ascending order with a strict comparison: an exact tie keeps the lower mark.
        for (const detent of detents) {
          if (distance(detent) <= DETENT_ENTRY_PX && (next === null || distance(detent) < distance(next)))
            next = detent;
        }
        if (next !== null) vibrate(pointerType);
      }
      if (next !== latchRef.current) setLatch(next);
      return next ?? raw;
    },
    onGestureEnd: () => {
      stretch.set(0);
      setLatch(null);
    },
  });
  const { id, controlRef, current, percent } = slider;
  const n = current as number;
  const { format } = useSliderFormat(locale, formatOptions, formatValue);
  const normalizedMarks = slider.normalizeMarks(marks);
  const detents = normalizedMarks.map((mark) => mark.value).sort((a, b) => a - b);
  const domainKey = [min, max, step, ...detents].join(' ');
  useEffect(() => {
    latchRef.current = null;
    setLatched(null);
    stretch.jump(0);
  }, [domainKey]);

  const position = useMotionValue(percent(n));
  useEffect(() => position.set(percent(n)), [n, min, max]);
  const tilt = useSpring(
    useTransform(useVelocity(position), (velocity) => {
      // The tag leans against the physical direction of travel, which flips in RTL.
      const lean = controlRef.current?.matches(':dir(rtl)') ? velocity : -velocity;
      return Math.max(-MAX_TAG_TILT_DEG, Math.min(MAX_TAG_TILT_DEG, lean * TAG_TILT_PER_VELOCITY));
    }),
    TAG_SPRING,
  );
  const writeVar = (property: string, cssValue: string) =>
    controlRef.current?.style.setProperty(property, cssValue);
  useMotionValueEvent(stretch, 'change', (s) => {
    writeVar(STRETCH_START, `${Math.max(0, -s)}px`);
    writeVar(STRETCH_END, `${Math.max(0, s)}px`);
    writeVar(SQUASH, String(1 - (1 - MIN_SQUASH) * Math.min(1, Math.abs(s) / MAX_STRETCH_PX)));
    writeVar(SHIFT, `${rtlRef.current ? -s : s}px`);
  });
  useMotionValueEvent(tilt, 'change', (deg) => writeVar(TILT, `${reduced ? 0 : deg}deg`));

  const hasLabel = hasContent(label);
  const hasDescription = hasContent(description);
  const hasError = hasContent(error);
  const thumb = slotProps?.thumb;
  const dragging = slider.active === 0;
  return (
    <MotionConfig reducedMotion="user">
      <WithSx className={className} styles={rootStyle} sx={sx}>
        {(rootClass) => (
          <div
            {...rest}
            ref={ref}
            className={rootClass}
            data-ui="elastic-slider"
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
                    data-ui="elastic-slider-readout"
                    css={[sliderReadoutStyle, slotProps?.readout?.css]}
                  >
                    {format(n)}
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
                css={[sliderControlStyle, controlStyle, sliderSizeStyles[size], slotProps?.control?.css]}
                data-ui="elastic-slider-control"
                data-disabled={disabled || undefined}
              >
                <div
                  {...slotProps?.rail}
                  data-ui="elastic-slider-rail"
                  aria-hidden="true"
                  css={[railStyle, slotProps?.rail?.css]}
                />
                <div
                  {...slotProps?.track}
                  data-ui="elastic-slider-track"
                  aria-hidden="true"
                  css={[trackStyle, slotProps?.track?.css]}
                >
                  <div
                    {...slotProps?.fill}
                    data-ui="elastic-slider-fill"
                    css={[fillStyle, slotProps?.fill?.css]}
                    style={{ ...slotProps?.fill?.style, inlineSize: `${percent(n)}%` }}
                  />
                </div>
                {normalizedMarks.map((mark, index) => {
                  const part = indexedPart(slotProps?.tick, index);
                  return (
                    <span
                      {...part}
                      key={mark.value}
                      data-ui="elastic-slider-tick"
                      data-latched={latched === mark.value || undefined}
                      aria-hidden="true"
                      css={[tickStyle, part?.css]}
                      style={{ ...part?.style, insetInlineStart: `${percent(mark.value)}%` }}
                    />
                  );
                })}
                <div
                  {...thumb}
                  id={`${id}-thumb`}
                  data-slider-thumb={0}
                  data-dragging={dragging || undefined}
                  role="slider"
                  tabIndex={disabled ? -1 : 0}
                  aria-orientation="horizontal"
                  aria-disabled={disabled}
                  aria-invalid={hasError || invalid ? true : (thumb?.['aria-invalid'] ?? ariaInvalidProp)}
                  aria-valuemin={min}
                  aria-valuemax={max}
                  aria-valuenow={n}
                  aria-valuetext={format(n)}
                  aria-label={thumb?.['aria-label'] ?? ariaLabelProp}
                  aria-labelledby={joinIds(
                    ariaLabelledByProp,
                    thumb?.['aria-labelledby'],
                    hasLabel && `${id}-label`,
                  )}
                  aria-describedby={joinIds(
                    ariaDescribedByProp,
                    thumb?.['aria-describedby'],
                    hasDescription && `${id}-description`,
                    hasError && `${id}-error`,
                  )}
                  css={[thumbStyle, thumb?.css]}
                  style={{ ...thumb?.style, insetInlineStart: `${percent(n)}%` }}
                >
                  <motion.span
                    aria-hidden="true"
                    data-ui="elastic-slider-thumb-visual"
                    css={visualStyle}
                    animate={{ scale: !reduced && dragging ? THUMB_SWELL : 1 }}
                    transition={reduced ? { duration: 0 } : SWELL_SPRING}
                  />
                  <span
                    {...slotProps?.bubble}
                    data-ui="elastic-slider-bubble"
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
                      key={mark.value}
                      type="button"
                      disabled={disabled}
                      data-ui="elastic-slider-mark"
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
            {name !== undefined && <input type="hidden" disabled={disabled} name={name} value={n} />}
          </div>
        )}
      </WithSx>
    </MotionConfig>
  );
}

ElasticSlider.displayName = 'ElasticSlider';
