'use client';

// APG horizontal single/multi-thumb slider: arrows, Shift+arrows, PageUp/Down,
// Home/End. Horizontal arrows mirror in RTL; Up/PageUp always increase.
// Commit reports the completed request, not controlled-parent acceptance.
// Hidden inputs support submission, not native required/range validation.
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ComponentPropsWithRef,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from 'react';
import { MotionConfig, motion, useReducedMotion } from 'motion/react';
import { vars } from '@jfrader/tokens/vars';
import { css, type Interpolation, type Theme } from '../../styling/css';
import { focusRingOutset } from '../../styling/focus-ring';
import { FORCED_COLORS, REDUCED_MOTION } from '../../styling/media';
import { WithSx, type SxProps } from '../../styling/sx';
import { visuallyHiddenStyle } from '../../styling/visually-hidden';
import { isRenderable } from '../../utils/renderable';
import { useControlledState } from '../../utils/use-controlled-state';

export type SliderValue = number | readonly [number, number];
export type SliderMark = number | { value: number; label?: ReactNode };
export type SliderSize = 'sm' | 'md';
type Part<E extends 'div' | 'span' | 'button'> = ComponentPropsWithRef<E> & { css?: Interpolation<Theme> };
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

const STEP_TOLERANCE = 1e-7;
const SETTLING_SPRING = { type: 'spring', stiffness: 420, damping: 30 } as const;
const STRAIN_BOUND = 8;
const rootStyle = css({
  label: 'slider',
  display: 'grid',
  gap: vars.space[2],
  minInlineSize: 0,
  inlineSize: '100%',
  fontFamily: vars.font.sans,
  fontSize: vars.textSize.sm,
  lineHeight: vars.lineHeight.base,
  color: vars.color.text,
});
const headerStyle = css({
  display: 'flex',
  flexWrap: 'wrap',
  justifyContent: 'space-between',
  gap: vars.space[2],
  alignItems: 'baseline',
});
const labelStyle = css({ fontWeight: vars.fontWeight.medium });
const readoutStyle = css({ fontVariantNumeric: 'tabular-nums', overflowWrap: 'anywhere' });
const descriptionStyle = css({ color: vars.color.textMuted });
const errorStyle = css({ color: vars.color.dangerText });
const rowStyle = css({
  display: 'flex',
  alignItems: 'center',
  gap: vars.space[3],
  minInlineSize: 0,
  paddingBlockStart: vars.space[8],
});
const controlStyle = css({
  position: 'relative',
  flex: 1,
  minInlineSize: vars.space[8],
  marginInline: vars.space[4],
  touchAction: 'pan-y',
  userSelect: 'none',
  cursor: 'pointer',
  '&[data-disabled]': { cursor: 'default' },
});
const sizeStyles = { sm: css({ minBlockSize: vars.space[8] }), md: css({ minBlockSize: vars.space[10] }) };
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
const marksStyle = css({ display: 'flex', flexWrap: 'wrap', gap: vars.space[2] });
const markStyle = css({
  minBlockSize: vars.space[8],
  minInlineSize: vars.space[8],
  paddingBlock: vars.space[1],
  paddingInline: vars.space[2],
  font: 'inherit',
  overflowWrap: 'anywhere',
  maxInlineSize: '100%',
  color: vars.color.text,
  background: vars.color.surfaceRaised,
  border: `1px solid ${vars.color.borderControl}`,
  borderRadius: vars.radius.md,
  cursor: 'pointer',
  '&:focus-visible': focusRingOutset,
  '&:disabled': { cursor: 'default' },
  [FORCED_COLORS]: { borderColor: 'ButtonText' },
});

function sameValue(a: SliderValue, b: SliderValue) {
  return typeof a === 'number' ? a === b : typeof b !== 'number' && a[0] === b[0] && a[1] === b[1];
}
function ids(...values: (string | false | undefined)[]) {
  return values.filter(Boolean).join(' ') || undefined;
}
function hasContent(node: ReactNode) {
  return isRenderable(node) && node !== '';
}
function indexed<E extends 'div' | 'button'>(
  part: Part<E> | ((index: number) => Part<E>) | undefined,
  index: number,
) {
  return typeof part === 'function' ? part(index) : part;
}
interface Gesture {
  pointerId: number;
  thumb: number;
  offset: number;
  originX: number;
  coincident: boolean;
  initial: SliderValue;
  candidate: SliderValue;
  control: HTMLDivElement;
}

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
  const steps = (max - min) / step;
  if (
    ![min, max, step, steps].every(Number.isFinite) ||
    max <= min ||
    step <= 0 ||
    !Number.isSafeInteger(Math.round(steps)) ||
    Math.abs(steps - Math.round(steps)) > STEP_TOLERANCE
  )
    throw new Error('Slider requires finite min < max, a positive step, and max aligned to min + n * step.');
  if (
    !Number.isInteger(minStepsBetweenThumbs) ||
    minStepsBetweenThumbs < 0 ||
    minStepsBetweenThumbs > Math.round(steps)
  )
    throw new Error('Slider minStepsBetweenThumbs must be a nonnegative integer that fits the domain.');
  if (largeStep !== undefined && (!Number.isFinite(largeStep) || largeStep <= 0))
    throw new Error('Slider largeStep must be finite and positive.');
  const gap = minStepsBetweenThumbs * step;
  const large = Math.max(1, Math.round((largeStep ?? (max - min) / 10) / step)) * step;
  const snap = (n: number) => {
    if (!Number.isFinite(n)) throw new Error('Slider values must be finite.');
    const index = Math.max(0, Math.min(Math.round(steps), Math.round((n - min) / step)));
    const latticeValue = min + index * step;
    const rounded = Number(latticeValue.toPrecision(15));
    return Math.abs(rounded - latticeValue) <= step * STEP_TOLERANCE ? rounded : latticeValue;
  };
  const normalize = (input: SliderValue): SliderValue => {
    if (!range) {
      if (typeof input !== 'number') throw new Error('Slider single mode requires a number.');
      return snap(input);
    }
    if (typeof input === 'number' || input.length !== 2 || input[0] > input[1])
      throw new Error('Slider range requires an ordered [lower, upper] tuple.');
    const lower = snap(input[0]);
    const upper = snap(input[1]);
    if ((upper - lower) / step + STEP_TOLERANCE < minStepsBetweenThumbs)
      throw new Error('Slider range values must respect minStepsBetweenThumbs.');
    return [lower, upper];
  };
  const [seed] = useState(() => normalize(defaultValue ?? (range ? [min, max] : min)));
  const notify = (next: SliderValue) => {
    if (range) props.onValueChange?.(next as readonly [number, number]);
    else props.onValueChange?.(next as number);
  };
  const commit = (next: SliderValue) => {
    if (range) props.onValueCommit?.(next as readonly [number, number]);
    else props.onValueCommit?.(next as number);
  };
  const [state, requestChange, reset] = useControlledState<SliderValue>(value, seed, notify);
  const current = normalize(state ?? seed);
  const values = typeof current === 'number' ? [current] : current;
  const id = useId();
  const formatter = useMemo(() => new Intl.NumberFormat(locale, formatOptions), [locale, formatOptions]);
  const format = (n: number) => (formatValue ? formatValue(n, formatter) : formatter.format(n));
  const readout =
    typeof current === 'number'
      ? format(current)
      : !formatValue && 'formatRange' in formatter
        ? formatter.formatRange(current[0], current[1])
        : `${format(current[0])} – ${format(current[1])}`;
  const reduced = useReducedMotion();
  const controlRef = useRef<HTMLDivElement | null>(null);
  const gesture = useRef<Gesture | null>(null);
  const lastFocused = useRef(0);
  const [active, setActive] = useState<number | null>(null);
  const [strain, setStrain] = useState(0);
  const bounds = (index: number) =>
    range ? [index === 0 ? min : values[0]! + gap, index === 0 ? values[1]! - gap : max] : [min, max];
  const candidate = (index: number, raw: number): SliderValue => {
    const [low, high] = bounds(index);
    const next = snap(Math.max(low!, Math.min(high!, raw)));
    return range ? (index === 0 ? [next, values[1]!] : [values[0]!, next]) : next;
  };
  const request = (next: SliderValue) => {
    if (!sameValue(current, next)) requestChange(next);
  };
  const finish = (complete: boolean) => {
    const drag = gesture.current;
    if (!drag) return;
    gesture.current = null;
    setActive(null);
    setStrain(0);
    if (drag.control.hasPointerCapture(drag.pointerId)) drag.control.releasePointerCapture(drag.pointerId);
    if (complete && !sameValue(drag.initial, drag.candidate)) commit(drag.candidate);
  };
  useEffect(() => {
    if (disabled) finish(false);
  }, [disabled]);
  useEffect(
    () => () => {
      const drag = gesture.current;
      gesture.current = null;
      if (drag?.control.hasPointerCapture(drag.pointerId)) drag.control.releasePointerCapture(drag.pointerId);
    },
    [],
  );
  useEffect(() => {
    const form = controlRef.current?.closest('form');
    if (!form) return;
    const handleReset = (event: Event) => {
      queueMicrotask(() => {
        if (!event.defaultPrevented) {
          finish(false);
          reset();
        }
      });
    };
    form.addEventListener('reset', handleReset);
    return () => form.removeEventListener('reset', handleReset);
  }, [reset]);
  const focusThumb = (index: number) =>
    controlRef.current?.querySelector<HTMLElement>(`[data-slider-thumb="${index}"]`)?.focus();
  const rtl = () => controlRef.current?.matches(':dir(rtl)') ?? false;
  const pointerValue = (x: number) => {
    const rect = controlRef.current!.getBoundingClientRect();
    const ratio = rect.width > 0 ? (x - rect.left) / rect.width : 0;
    return min + (rtl() ? 1 - ratio : ratio) * (max - min);
  };
  const nearest = (n: number) =>
    !range
      ? 0
      : Math.abs(n - values[0]!) === Math.abs(n - values[1]!)
        ? lastFocused.current
        : Math.abs(n - values[0]!) < Math.abs(n - values[1]!)
          ? 0
          : 1;
  const movePointer = (event: PointerEvent<HTMLDivElement>) => {
    const drag = gesture.current;
    if (!drag || event.pointerId !== drag.pointerId || disabled) return;
    if (drag.coincident && event.clientX !== drag.originX) {
      drag.thumb = event.clientX > drag.originX !== rtl() ? 1 : 0;
      drag.coincident = false;
      setActive(drag.thumb);
      focusThumb(drag.thumb);
    }
    const raw = pointerValue(event.clientX - drag.offset);
    const next = candidate(drag.thumb, raw);
    const [low, high] = bounds(drag.thumb);
    setStrain(
      reduced
        ? 0
        : Math.max(
            -STRAIN_BOUND,
            Math.min(STRAIN_BOUND, (raw - Math.max(low!, Math.min(high!, raw))) * (rtl() ? -1 : 1)),
          ),
    );
    if (!sameValue(drag.candidate, next)) {
      drag.candidate = next;
      request(next);
    }
  };
  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.defaultPrevented || disabled || gesture.current || !event.isPrimary || event.button !== 0)
      return;
    const hit = (event.target as HTMLElement).closest<HTMLElement>('[data-slider-thumb]');
    const index = hit ? Number(hit.dataset.sliderThumb) : nearest(pointerValue(event.clientX));
    const rect = hit?.getBoundingClientRect();
    const offset = rect ? event.clientX - (rect.left + rect.width / 2) : 0;
    gesture.current = {
      pointerId: event.pointerId,
      thumb: index,
      offset,
      originX: event.clientX,
      coincident: range && values[0] === values[1],
      initial: current,
      candidate: current,
      control: event.currentTarget,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
    setActive(index);
    focusThumb(index);
    if (!hit) movePointer(event);
  };
  const handleKey = (event: KeyboardEvent<HTMLDivElement>, index: number) => {
    if (disabled || event.defaultPrevented) return;
    const direction = rtl() ? -1 : 1;
    const amount = event.shiftKey ? large : step;
    const [low, high] = bounds(index);
    const targets: Record<string, number> = {
      ArrowRight: values[index]! + amount * direction,
      ArrowLeft: values[index]! - amount * direction,
      ArrowUp: values[index]! + amount,
      ArrowDown: values[index]! - amount,
      PageUp: values[index]! + large,
      PageDown: values[index]! - large,
      Home: low!,
      End: high!,
    };
    const target = targets[event.key];
    if (target === undefined) return;
    event.preventDefault();
    const next = candidate(index, target);
    if (!sameValue(current, next)) {
      request(next);
      commit(next);
    }
  };
  const normalizedMarks = Array.from(
    new Map(
      marks.flatMap((mark) => {
        const entry = typeof mark === 'number' ? { value: mark } : mark;
        return Number.isFinite(entry.value) && entry.value >= min && entry.value <= max
          ? [[snap(entry.value), { ...entry, value: snap(entry.value) }] as const]
          : [];
      }),
    ).values(),
  );
  const percent = (n: number) => ((n - min) / (max - min)) * 100;
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
              const thumb = (event.target as HTMLElement).closest<HTMLElement>('[data-slider-thumb]');
              if (thumb && controlRef.current?.contains(thumb)) {
                handleKey(event, Number(thumb.dataset.sliderThumb));
              }
            }}
          >
            {(hasLabel || showValue) && (
              <div css={headerStyle}>
                {hasLabel && (
                  <span {...slotProps?.label} id={`${id}-label`} css={[labelStyle, slotProps?.label?.css]}>
                    {label}
                  </span>
                )}
                {showValue && (
                  <span
                    {...slotProps?.readout}
                    aria-hidden="true"
                    css={[readoutStyle, slotProps?.readout?.css]}
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
                css={[descriptionStyle, slotProps?.description?.css]}
              >
                {description}
              </div>
            )}
            {hasError && (
              <div
                {...slotProps?.error}
                id={`${id}-error`}
                role="alert"
                css={[errorStyle, slotProps?.error?.css]}
              >
                {error}
              </div>
            )}
            <div css={rowStyle}>
              {hasContent(start) && <div {...slotProps?.start}>{start}</div>}
              <div
                {...slotProps?.control}
                ref={(node) => {
                  controlRef.current = node;
                  const external = slotProps?.control?.ref;
                  if (typeof external === 'function') return external(node);
                  if (external) external.current = node;
                }}
                css={[controlStyle, sizeStyles[size], slotProps?.control?.css]}
                data-ui="slider-control"
                data-disabled={disabled || undefined}
                onPointerDown={(e) => {
                  slotProps?.control?.onPointerDown?.(e);
                  handlePointerDown(e);
                }}
                onPointerMove={(e) => {
                  slotProps?.control?.onPointerMove?.(e);
                  if (!e.defaultPrevented) movePointer(e);
                }}
                onPointerUp={(e) => {
                  slotProps?.control?.onPointerUp?.(e);
                  if (gesture.current?.pointerId === e.pointerId) finish(true);
                }}
                onPointerCancel={(e) => {
                  slotProps?.control?.onPointerCancel?.(e);
                  if (gesture.current?.pointerId === e.pointerId) finish(false);
                }}
                onLostPointerCapture={(e) => {
                  slotProps?.control?.onLostPointerCapture?.(e);
                  if (gesture.current?.pointerId === e.pointerId) finish(false);
                }}
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
                  const part = indexed(slotProps?.thumb, index);
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
                      aria-invalid={
                        hasError || invalid ? true : (part?.['aria-invalid'] ?? ariaInvalidProp)
                      }
                      aria-valuemin={low}
                      aria-valuemax={high}
                      aria-valuenow={n}
                      aria-valuetext={format(n)}
                      aria-label={part?.['aria-label'] ?? (range ? thumbLabels?.[index] : ariaLabelProp)}
                      aria-labelledby={ids(
                        ariaLabelledByProp,
                        part?.['aria-labelledby'],
                        range ? `${id}-name-${index}` : hasLabel && `${id}-label`,
                      )}
                      aria-describedby={ids(
                        ariaDescribedByProp,
                        part?.['aria-describedby'],
                        hasDescription && `${id}-description`,
                        hasError && `${id}-error`,
                      )}
                      css={[thumbStyle, part?.css]}
                      style={{ ...part?.style, insetInlineStart: `${percent(n)}%` }}
                      onFocus={(e) => {
                        lastFocused.current = index;
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
              <div css={marksStyle}>
                {normalizedMarks.map((mark, index) => {
                  if (!hasContent(mark.label)) return null;
                  const part = indexed(slotProps?.mark, index);
                  return (
                    <button
                      {...part}
                      key={index}
                      type="button"
                      disabled={disabled}
                      css={[markStyle, part?.css]}
                      onClick={(e) => {
                        part?.onClick?.(e);
                        if (disabled || e.defaultPrevented) return;
                        const next = candidate(nearest(mark.value), mark.value);
                        if (!sameValue(current, next)) {
                          request(next);
                          commit(next);
                        }
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
