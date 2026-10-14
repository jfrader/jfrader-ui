// Shared numeric, pointer, keyboard and form engine behind every slider skin (Slider,
// skins). The skin owns rendering and visual feedback; this module owns the value lattice,
// the controlled/uncontrolled authority, gestures, key handling and commit semantics.
import { numberFormatter } from '../../utils/intl';
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
  type RefCallback,
  type RefObject,
} from 'react';
import type { Interpolation, Theme } from '../../styling/css';
import { isRenderable } from '../../utils/renderable';
import { useControlledState } from '../../utils/use-controlled-state';

export type SliderValue = number | readonly [number, number];
export type SliderMark = number | { value: number; label?: ReactNode };
export type SliderPart<E extends 'div' | 'span' | 'button'> = ComponentPropsWithRef<E> & {
  css?: Interpolation<Theme>;
};
/** Pointer position for one gesture sample, in domain units plus the geometry to convert them. */
export interface SliderPointerSample {
  /** Unclamped domain value under the pointer (grab offset applied). */
  raw: number;
  /** Bounds the dragged thumb may take. */
  low: number;
  high: number;
  /** CSS pixels per domain unit along the control. */
  pxPerUnit: number;
  rtl: boolean;
  pointerType: string;
}

const STEP_TOLERANCE = 1e-7;
// Skins render `data-slider-thumb={index}` on each role=slider element inside the control.
const SLIDER_THUMB_ATTRIBUTE = 'data-slider-thumb';

function sameSliderValue(a: SliderValue, b: SliderValue) {
  return typeof a === 'number' ? a === b : typeof b !== 'number' && a[0] === b[0] && a[1] === b[1];
}
export function joinIds(...values: (string | false | undefined)[]) {
  return values.filter(Boolean).join(' ') || undefined;
}
export function hasContent(node: ReactNode) {
  return isRenderable(node) && node !== '';
}
export function indexedPart<E extends 'div' | 'span' | 'button'>(
  part: SliderPart<E> | ((index: number) => SliderPart<E>) | undefined,
  index: number,
) {
  return typeof part === 'function' ? part(index) : part;
}

export function useSliderFormat(
  locale: Intl.LocalesArgument,
  formatOptions: Intl.NumberFormatOptions | undefined,
  formatValue: ((value: number, formatter: Intl.NumberFormat) => string) | undefined,
) {
  const formatter = useMemo(() => numberFormatter(locale, formatOptions), [locale, formatOptions]);
  const format = (n: number) => (formatValue ? formatValue(n, formatter) : formatter.format(n));
  return { formatter, format };
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

export interface SliderInteractionOptions {
  /** Public component name used in configuration errors. */
  component: string;
  range: boolean;
  value: SliderValue | undefined;
  defaultValue: SliderValue | undefined;
  min: number;
  max: number;
  step: number;
  largeStep: number | undefined;
  minStepsBetweenThumbs: number;
  disabled: boolean;
  onValueChange: (next: SliderValue) => void;
  onValueCommit: (next: SliderValue) => void;
  /** Visual feedback hook: runs for every accepted pointer sample, before the value request. */
  onPointerSample?: (sample: SliderPointerSample) => void;
  /** Maps a pointer sample to the raw domain target (e.g. magnetic detents). Defaults to `raw`. */
  resolvePointer?: (sample: SliderPointerSample) => number;
  /** Runs once when a gesture ends: completed (pointerup) or cancelled (cancel, lost capture, disable, reset). */
  onGestureEnd?: (completed: boolean) => void;
}

export interface SliderInteraction {
  id: string;
  controlRef: RefObject<HTMLDivElement | null>;
  current: SliderValue;
  values: number[] | readonly [number, number];
  active: number | null;
  bounds: (index: number) => number[];
  percent: (n: number) => number;
  normalizeMarks: (marks: readonly SliderMark[]) => { value: number; label?: ReactNode }[];
  /** Handlers for the pointer-capture control; consumer slot handlers run first and may veto. */
  controlHandlers: (part: SliderPart<'div'> | undefined) => {
    ref: RefCallback<HTMLDivElement>;
    onPointerDown: (e: PointerEvent<HTMLDivElement>) => void;
    onPointerMove: (e: PointerEvent<HTMLDivElement>) => void;
    onPointerUp: (e: PointerEvent<HTMLDivElement>) => void;
    onPointerCancel: (e: PointerEvent<HTMLDivElement>) => void;
    onLostPointerCapture: (e: PointerEvent<HTMLDivElement>) => void;
  };
  /** Root `onKeyDown` tail: routes movement keys from a thumb inside this control. */
  handleRootKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
  /** Activation of a mark shortcut: one change + commit for a changed request, nothing otherwise. */
  selectMark: (markValue: number) => void;
  /** Remembers the last focused thumb for equidistant range presses. */
  noteFocus: (index: number) => void;
}

export function useSliderInteraction(options: SliderInteractionOptions): SliderInteraction {
  const {
    component,
    range,
    value,
    defaultValue,
    min,
    max,
    step,
    largeStep,
    minStepsBetweenThumbs,
    disabled,
    onValueChange,
    onValueCommit,
    onPointerSample,
    resolvePointer,
    onGestureEnd,
  } = options;
  const steps = (max - min) / step;
  if (
    ![min, max, step, steps].every(Number.isFinite) ||
    max <= min ||
    step <= 0 ||
    !Number.isSafeInteger(Math.round(steps)) ||
    Math.abs(steps - Math.round(steps)) > STEP_TOLERANCE
  )
    throw new Error(
      `${component} requires finite min < max, a positive step, and max aligned to min + n * step.`,
    );
  if (
    !Number.isInteger(minStepsBetweenThumbs) ||
    minStepsBetweenThumbs < 0 ||
    minStepsBetweenThumbs > Math.round(steps)
  )
    throw new Error(`${component} minStepsBetweenThumbs must be a nonnegative integer that fits the domain.`);
  if (largeStep !== undefined && (!Number.isFinite(largeStep) || largeStep <= 0))
    throw new Error(`${component} largeStep must be finite and positive.`);
  const gap = minStepsBetweenThumbs * step;
  const large = Math.max(1, Math.round((largeStep ?? (max - min) / 10) / step)) * step;
  const snap = (n: number) => {
    if (!Number.isFinite(n)) throw new Error(`${component} values must be finite.`);
    const index = Math.max(0, Math.min(Math.round(steps), Math.round((n - min) / step)));
    const latticeValue = min + index * step;
    const rounded = Number(latticeValue.toPrecision(15));
    return Math.abs(rounded - latticeValue) <= step * STEP_TOLERANCE ? rounded : latticeValue;
  };
  const normalize = (input: SliderValue): SliderValue => {
    if (!range) {
      if (typeof input !== 'number') throw new Error(`${component} single mode requires a number.`);
      return snap(input);
    }
    if (typeof input === 'number' || input.length !== 2 || input[0] > input[1])
      throw new Error(`${component} range requires an ordered [lower, upper] tuple.`);
    const lower = snap(input[0]);
    const upper = snap(input[1]);
    if ((upper - lower) / step + STEP_TOLERANCE < minStepsBetweenThumbs)
      throw new Error(`${component} range values must respect minStepsBetweenThumbs.`);
    return [lower, upper];
  };
  const [seed] = useState(() => normalize(defaultValue ?? (range ? [min, max] : min)));
  const [state, requestChange, reset] = useControlledState<SliderValue>(value, seed, onValueChange);
  const current = normalize(state ?? seed);
  const values = typeof current === 'number' ? [current] : current;
  const id = useId();
  const controlRef = useRef<HTMLDivElement | null>(null);
  const gesture = useRef<Gesture | null>(null);
  const lastFocused = useRef(0);
  const [active, setActive] = useState<number | null>(null);
  const bounds = (index: number) =>
    range
      ? [index === 0 ? min : snap(values[0]! + gap), index === 0 ? snap(values[1]! - gap) : max]
      : [min, max];
  const candidate = (index: number, raw: number): SliderValue => {
    const [low, high] = bounds(index);
    const next = snap(Math.max(low!, Math.min(high!, raw)));
    return range ? (index === 0 ? [next, values[1]!] : [values[0]!, next]) : next;
  };
  const request = (next: SliderValue) => {
    if (!sameSliderValue(current, next)) requestChange(next);
  };
  const finish = (complete: boolean) => {
    const drag = gesture.current;
    if (!drag) return;
    gesture.current = null;
    setActive(null);
    onGestureEnd?.(complete);
    if (drag.control.hasPointerCapture(drag.pointerId)) drag.control.releasePointerCapture(drag.pointerId);
    if (complete && !sameSliderValue(drag.initial, drag.candidate)) onValueCommit(drag.candidate);
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
    controlRef.current?.querySelector<HTMLElement>(`[${SLIDER_THUMB_ATTRIBUTE}="${index}"]`)?.focus();
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
    const [low, high] = bounds(drag.thumb);
    const width = controlRef.current!.getBoundingClientRect().width;
    const sample: SliderPointerSample = {
      raw: pointerValue(event.clientX - drag.offset),
      low: low!,
      high: high!,
      pxPerUnit: width / (max - min),
      rtl: rtl(),
      pointerType: event.pointerType,
    };
    onPointerSample?.(sample);
    const next = candidate(drag.thumb, resolvePointer ? resolvePointer(sample) : sample.raw);
    if (!sameSliderValue(drag.candidate, next)) {
      drag.candidate = next;
      request(next);
    }
  };
  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.defaultPrevented || disabled || gesture.current || !event.isPrimary || event.button !== 0)
      return;
    const hit = (event.target as HTMLElement).closest<HTMLElement>(`[${SLIDER_THUMB_ATTRIBUTE}]`);
    const index = hit
      ? Number(hit.getAttribute(SLIDER_THUMB_ATTRIBUTE))
      : nearest(pointerValue(event.clientX));
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
    if (!sameSliderValue(current, next)) {
      request(next);
      onValueCommit(next);
    }
  };
  /** Root `onKeyDown` tail: routes movement keys from a thumb inside this control. */
  const handleRootKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const thumb = (event.target as HTMLElement).closest<HTMLElement>(`[${SLIDER_THUMB_ATTRIBUTE}]`);
    if (thumb && controlRef.current?.contains(thumb)) {
      handleKey(event, Number(thumb.getAttribute(SLIDER_THUMB_ATTRIBUTE)));
    }
  };
  /** Activation of a mark shortcut: one change + commit for a changed request, nothing otherwise. */
  const selectMark = (markValue: number) => {
    if (disabled) return;
    const next = candidate(nearest(markValue), markValue);
    if (!sameSliderValue(current, next)) {
      request(next);
      onValueCommit(next);
    }
  };
  const normalizeMarks = (marks: readonly SliderMark[]) =>
    Array.from(
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
  /** Handlers for the pointer-capture control; consumer slot handlers run first and may veto. */
  const controlHandlers = (part: SliderPart<'div'> | undefined) => ({
    ref: (node: HTMLDivElement | null) => {
      controlRef.current = node;
      const external = part?.ref;
      if (typeof external === 'function') return external(node);
      if (external) external.current = node;
    },
    onPointerDown: (e: PointerEvent<HTMLDivElement>) => {
      part?.onPointerDown?.(e);
      handlePointerDown(e);
    },
    onPointerMove: (e: PointerEvent<HTMLDivElement>) => {
      part?.onPointerMove?.(e);
      if (!e.defaultPrevented) movePointer(e);
    },
    onPointerUp: (e: PointerEvent<HTMLDivElement>) => {
      part?.onPointerUp?.(e);
      if (gesture.current?.pointerId === e.pointerId) finish(true);
    },
    onPointerCancel: (e: PointerEvent<HTMLDivElement>) => {
      part?.onPointerCancel?.(e);
      if (gesture.current?.pointerId === e.pointerId) finish(false);
    },
    onLostPointerCapture: (e: PointerEvent<HTMLDivElement>) => {
      part?.onLostPointerCapture?.(e);
      if (gesture.current?.pointerId === e.pointerId) finish(false);
    },
  });
  return {
    id,
    controlRef,
    current,
    values,
    active,
    bounds,
    percent,
    normalizeMarks,
    controlHandlers,
    handleRootKeyDown,
    selectMark,
    /** Remembers the last focused thumb for equidistant range presses. */
    noteFocus: (index: number) => {
      lastFocused.current = index;
    },
  };
}
