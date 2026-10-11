'use client';

// APG slider driving a two-image reveal. The value is the percentage of Before visible, measured
// from the logical inline-start (horizontal) or the top (vertical): 0 shows only After, 100 only
// Before. Arrows move one step (horizontal arrows mirror in RTL; Up always increases), Shift+arrows
// and PageUp/Down a large step, Home/End go to 0/100. Pointer drags capture only after main-axis
// intent so an orthogonal touch pan keeps scrolling the page. Commit reports the completed request,
// not controlled-parent acceptance.
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ComponentPropsWithRef,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from 'react';
import { useMergeRefs } from '@floating-ui/react';
import { vars } from '@jfrader/tokens/vars';
import { css, type Interpolation, type SerializedStyles, type Theme } from '../../styling/css';
import { focusRingOutset } from '../../styling/focus-ring';
import { FORCED_COLORS, REDUCED_MOTION } from '../../styling/media';
import { WithSx, type SxProps } from '../../styling/sx';
import { useControlledState } from '../../utils/use-controlled-state';
import { Button, type ButtonProps } from '../button';

export type ImageCompareOrientation = 'horizontal' | 'vertical';

type StyleSlot = { css?: Interpolation<Theme> };
type PartSlot = Omit<ComponentPropsWithRef<'div'>, 'children'> & StyleSlot;
type CaptionSlot = Omit<ComponentPropsWithRef<'span'>, 'children' | 'id' | 'aria-hidden'> & StyleSlot;
type HandleSlot = Omit<
  ComponentPropsWithRef<'div'>,
  | 'children'
  | 'role'
  | 'tabIndex'
  | 'aria-orientation'
  | 'aria-disabled'
  | 'aria-valuemin'
  | 'aria-valuemax'
  | 'aria-valuenow'
  | 'aria-valuetext'
> &
  StyleSlot;
type ButtonSlot = Omit<ButtonProps, 'children' | 'type' | 'disabled' | 'aria-disabled' | 'render' | 'sx'>;

export interface ImageCompareSlotProps {
  frame?: PartSlot;
  before?: PartSlot;
  after?: PartSlot;
  beforeLabel?: CaptionSlot;
  afterLabel?: CaptionSlot;
  divider?: Omit<PartSlot, 'aria-hidden'>;
  /** The `role="slider"` element. Slider naming and descriptions (`aria-label`, `aria-labelledby`, `aria-describedby`) go here. */
  handle?: HandleSlot;
  resetButton?: ButtonSlot;
}

export interface ImageCompareProps
  extends Omit<ComponentPropsWithRef<'div'>, 'defaultValue' | 'onChange' | 'children'>, SxProps {
  /** Image shown at inline-start (horizontal) or top (vertical). Give it meaningful alt text. */
  before: ReactNode;
  /** Image shown at inline-end (horizontal) or bottom (vertical). Give it meaningful alt text. */
  after: ReactNode;
  /** Percentage of Before visible (controlled). */
  value?: number;
  defaultValue?: number;
  onValueChange?: (value: number) => void;
  /** Completed interaction: pointer release, key press, tap, reset. Reports the request, not acceptance. */
  onValueCommit?: (value: number) => void;
  orientation?: ImageCompareOrientation;
  step?: number;
  largeStep?: number;
  /** Visible captions for Before and After; `false` hides both. */
  labels?: readonly [string, string] | false;
  /** Accessible name of the slider. */
  label?: string;
  valueText?: (value: number, formattedPercent: string) => string;
  locale?: Intl.LocalesArgument;
  aspectRatio?: CSSProperties['aspectRatio'];
  disabled?: boolean;
  showReset?: boolean;
  resetLabel?: string;
  slotProps?: ImageCompareSlotProps;
}

// Bundlers replace `process.env.NODE_ENV` in consumer builds; library mode leaves it in place.
declare const process: { env: { NODE_ENV?: string } };

const MIN = 0;
const MAX = 100;
const CENTER = 50;
const DEFAULT_STEP = 1;
const DEFAULT_LARGE_STEP = 10;
const DEFAULT_LABELS = ['Before', 'After'] as const;
const DEFAULT_LABEL = 'Image comparison';
const DEFAULT_RESET_LABEL = 'Center divider';
const DEFAULT_ASPECT_RATIO = '3 / 2';
const PERCENT_FORMAT: Intl.NumberFormatOptions = { style: 'percent', maximumFractionDigits: 2 };
/** Significant digits kept when stepping, so 0.1 increments do not accumulate float noise. */
const VALUE_PRECISION = 12;
/** Custom properties read by the styles; values arrive through inline style, never generated classes. */
const VALUE_VAR = '--image-compare-value';
const SLOP_VAR = '--image-compare-slop';
const INTERACTIVE_SELECTOR =
  'a[href], button, input, select, textarea, label, summary, [contenteditable]:not([contenteditable="false"]), [tabindex]';

const defaultValueText = (_value: number, formattedPercent: string) => `${formattedPercent} Before visible`;

const HALF_HANDLE = `calc(${vars.space[10]} / 2)`;
const HALF_DIVIDER = `calc(${vars.space[1]} / 2)`;
// The handle stays a ring's width inside the frame at both ends so its focus ring is never clipped.
const HANDLE_OFFSET = `clamp(${vars.space[1]}, calc(var(${VALUE_VAR}) - ${HALF_HANDLE}), calc(100% - ${vars.space[10]} - ${vars.space[1]}))`;
const DIVIDER_OFFSET = `clamp(0px, calc(var(${VALUE_VAR}) - ${HALF_DIVIDER}), calc(100% - ${vars.space[1]}))`;
const HIDDEN_SHARE = `calc(100% - var(${VALUE_VAR}))`;

const rootStyle = css({
  label: 'image-compare',
  display: 'grid',
  gap: vars.space[2],
  minInlineSize: 0,
  inlineSize: '100%',
  fontFamily: vars.font.sans,
  lineHeight: vars.lineHeight.base,
  color: vars.color.text,
});
const frameStyle = css({
  [SLOP_VAR]: vars.space[1],
  position: 'relative',
  inlineSize: '100%',
  overflow: 'hidden',
  boxSizing: 'border-box',
  border: `1px solid ${vars.color.borderControl}`,
  borderRadius: vars.radius.lg,
  background: vars.color.surfaceInset,
  userSelect: 'none',
  '&[data-disabled]': { cursor: 'default' },
  [FORCED_COLORS]: { borderColor: 'CanvasText' },
});
const frameOrientationStyles: Record<ImageCompareOrientation, SerializedStyles> = {
  horizontal: css({ touchAction: 'pan-y', cursor: 'ew-resize' }),
  vertical: css({ touchAction: 'pan-x', cursor: 'ns-resize' }),
};
const layerStyle = css({
  position: 'absolute',
  inset: 0,
  '& > :is(img, picture, video, svg, canvas), & > picture > img': {
    display: 'block',
    inlineSize: '100%',
    blockSize: '100%',
    objectFit: 'cover',
  },
});
const beforeOrientationStyles: Record<ImageCompareOrientation, SerializedStyles> = {
  horizontal: css({
    clipPath: `inset(0 ${HIDDEN_SHARE} 0 0)`,
    '&:dir(rtl)': { clipPath: `inset(0 0 0 ${HIDDEN_SHARE})` },
  }),
  vertical: css({ clipPath: `inset(0 0 ${HIDDEN_SHARE} 0)` }),
};
const captionStyle = css({
  position: 'absolute',
  maxInlineSize: `calc(50% - ${vars.space[4]})`,
  paddingInline: vars.space[2],
  paddingBlock: vars.space[1],
  boxSizing: 'border-box',
  overflowWrap: 'anywhere',
  borderRadius: vars.radius.full,
  border: `1px solid ${vars.color.borderControl}`,
  background: vars.color.surfaceRaised,
  color: vars.color.text,
  fontSize: vars.textSize.xs,
  fontWeight: vars.fontWeight.medium,
  pointerEvents: 'none',
  [FORCED_COLORS]: { borderColor: 'CanvasText' },
});
const beforeCaptionStyle = css({ insetBlockStart: vars.space[3], insetInlineStart: vars.space[3] });
const afterCaptionStyles: Record<ImageCompareOrientation, SerializedStyles> = {
  horizontal: css({ insetBlockStart: vars.space[3], insetInlineEnd: vars.space[3] }),
  vertical: css({ insetBlockEnd: vars.space[3], insetInlineStart: vars.space[3] }),
};
// A light line between dark edges (or the reverse in light theme) stays visible on any photo.
const dividerStyle = css({
  position: 'absolute',
  boxSizing: 'border-box',
  background: vars.color.text,
  pointerEvents: 'none',
  [FORCED_COLORS]: { forcedColorAdjust: 'none', background: 'CanvasText', borderColor: 'Canvas' },
});
const dividerOrientationStyles: Record<ImageCompareOrientation, SerializedStyles> = {
  horizontal: css({
    insetBlock: 0,
    insetInlineStart: DIVIDER_OFFSET,
    inlineSize: vars.space[1],
    borderInline: `1px solid ${vars.color.surfaceInset}`,
  }),
  vertical: css({
    insetInline: 0,
    insetBlockStart: DIVIDER_OFFSET,
    blockSize: vars.space[1],
    borderBlock: `1px solid ${vars.color.surfaceInset}`,
  }),
};
const handleStyle = css({
  position: 'absolute',
  inlineSize: vars.space[10],
  blockSize: vars.space[10],
  boxSizing: 'border-box',
  display: 'grid',
  placeItems: 'center',
  border: `2px solid ${vars.color.borderControl}`,
  borderRadius: vars.radius.full,
  background: vars.color.surfaceRaised,
  color: vars.color.text,
  boxShadow: vars.shadow.raised,
  cursor: 'grab',
  transitionProperty: 'background-color, border-color',
  transitionDuration: vars.motion.duration.fast,
  transitionTimingFunction: vars.motion.easeStandard,
  '&:hover:not([aria-disabled="true"]), &[data-dragging]': {
    background: vars.color.surfaceHover,
    borderColor: vars.color.text,
  },
  '&[data-dragging]': { cursor: 'grabbing' },
  '&[aria-disabled="true"]': { cursor: 'default', color: vars.color.textMuted },
  '&:focus-visible': focusRingOutset,
  [REDUCED_MOTION]: { transitionDuration: '0s' },
  [FORCED_COLORS]: {
    forcedColorAdjust: 'none',
    background: 'Canvas',
    borderColor: 'CanvasText',
    color: 'CanvasText',
    boxShadow: 'none',
  },
});
const handleOrientationStyles: Record<ImageCompareOrientation, SerializedStyles> = {
  horizontal: css({ insetBlockStart: `calc(50% - ${HALF_HANDLE})`, insetInlineStart: HANDLE_OFFSET }),
  vertical: css({ insetInlineStart: `calc(50% - ${HALF_HANDLE})`, insetBlockStart: HANDLE_OFFSET }),
};
const gripStyle = css({ inlineSize: vars.space[5], blockSize: vars.space[5], pointerEvents: 'none' });
const gripOrientationStyles: Record<ImageCompareOrientation, SerializedStyles | undefined> = {
  horizontal: undefined,
  vertical: css({ transform: 'rotate(90deg)' }),
};
const resetStyle = css({
  justifySelf: 'end',
  maxInlineSize: '100%',
  blockSize: 'auto',
  minBlockSize: vars.space[8],
  paddingBlock: vars.space[1],
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
});

function ids(...values: (string | false | undefined)[]) {
  return values.filter(Boolean).join(' ') || undefined;
}
function clamp(n: number) {
  return Number(Math.min(MAX, Math.max(MIN, n)).toPrecision(VALUE_PRECISION));
}
function positive(n: number | undefined, fallback: number) {
  return n !== undefined && Number.isFinite(n) && n > 0 ? n : fallback;
}
function accepted(n: number | undefined) {
  return n !== undefined && Number.isFinite(n) ? clamp(n) : CENTER;
}

interface Gesture {
  pointerId: number;
  mouse: boolean;
  originX: number;
  originY: number;
  /** Main-axis distance from the pointer to the divider at press time; 0 for frame taps. */
  offset: number;
  onHandle: boolean;
  dragging: boolean;
  initial: number;
  candidate: number;
  frame: HTMLDivElement;
  /** Removes the owner-document listeners that end the gesture when it is released outside the frame. */
  unlisten: () => void;
}

export function ImageCompare({
  ref,
  before,
  after,
  value: valueProp,
  defaultValue,
  onValueChange,
  onValueCommit,
  orientation = 'horizontal',
  step: stepProp,
  largeStep: largeStepProp,
  labels = DEFAULT_LABELS,
  label = DEFAULT_LABEL,
  valueText = defaultValueText,
  locale,
  aspectRatio = DEFAULT_ASPECT_RATIO,
  disabled = false,
  showReset = true,
  resetLabel = DEFAULT_RESET_LABEL,
  slotProps,
  className,
  sx,
  onKeyDown,
  ...rest
}: ImageCompareProps) {
  const id = useId();
  const step = positive(stepProp, DEFAULT_STEP);
  const largeStep = positive(largeStepProp, DEFAULT_LARGE_STEP);
  const [seed] = useState(() => accepted(defaultValue));
  const [state, requestChange] = useControlledState<number>(valueProp, seed, onValueChange);
  const value = accepted(state);
  const percentFormat = useMemo(() => new Intl.NumberFormat(locale, PERCENT_FORMAT), [locale]);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const handleRef = useRef<HTMLDivElement | null>(null);
  const mergedFrameRef = useMergeRefs([frameRef, slotProps?.frame?.ref]);
  const mergedHandleRef = useMergeRefs([handleRef, slotProps?.handle?.ref]);
  const gesture = useRef<Gesture | null>(null);
  const [dragging, setDragging] = useState(false);
  const horizontal = orientation === 'horizontal';

  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    for (const [name, n] of [
      ['value', valueProp],
      ['defaultValue', defaultValue],
    ] as const) {
      if (n !== undefined && !Number.isFinite(n))
        console.warn(`ImageCompare: ${name} ${n} is not finite; showing ${CENTER}%.`);
    }
  }, [valueProp, defaultValue]);

  const request = (next: number) => {
    if (next === value) return false;
    requestChange(next);
    return true;
  };
  const requestAndCommit = (next: number) => {
    if (request(next)) onValueCommit?.(next);
  };
  const finish = (complete: boolean) => {
    const drag = gesture.current;
    if (!drag) return;
    gesture.current = null;
    drag.unlisten();
    setDragging(false);
    if (drag.frame.hasPointerCapture(drag.pointerId)) drag.frame.releasePointerCapture(drag.pointerId);
    if (complete && drag.dragging && drag.candidate !== drag.initial) onValueCommit?.(drag.candidate);
  };
  // Orientation or disabled changes and unmount end any drag without committing.
  useEffect(() => () => finish(false), [orientation, disabled]);

  const rtl = () => frameRef.current?.matches(':dir(rtl)') ?? false;
  const mainAxis = (event: { clientX: number; clientY: number }) => (horizontal ? event.clientX : event.clientY);
  /** Client coordinate of `percent` along the reveal axis of the current frame rect. */
  const clientAt = (percent: number) => {
    const rect = frameRef.current!.getBoundingClientRect();
    if (!horizontal) return rect.top + (rect.height * percent) / MAX;
    return rtl() ? rect.right - (rect.width * percent) / MAX : rect.left + (rect.width * percent) / MAX;
  };
  const percentAt = (client: number) => {
    const rect = frameRef.current!.getBoundingClientRect();
    const size = horizontal ? rect.width : rect.height;
    if (size <= 0) return value;
    const ratio = horizontal
      ? rtl()
        ? (rect.right - client) / size
        : (client - rect.left) / size
      : (client - rect.top) / size;
    return clamp(Math.round((ratio * MAX) / step) * step);
  };
  const reset = () => {
    if (!disabled) requestAndCommit(CENTER);
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.defaultPrevented || disabled || gesture.current || !event.isPrimary || event.button !== 0) return;
    const target = event.target as Element;
    const handle = handleRef.current;
    const onHandle = handle?.contains(target) ?? false;
    const interactive = target.closest(INTERACTIVE_SELECTOR);
    if (!onHandle && interactive && event.currentTarget.contains(interactive)) return;
    const frame = event.currentTarget;
    const doc = frame.ownerDocument;
    // Before capture, a release or cancel outside the frame never reaches it; abandon the gesture there.
    const endOutside = (outside: globalThis.PointerEvent) => {
      if (outside.pointerId === gesture.current?.pointerId && !frame.contains(outside.target as Node)) finish(false);
    };
    doc.addEventListener('pointerup', endOutside, true);
    doc.addEventListener('pointercancel', endOutside, true);
    gesture.current = {
      pointerId: event.pointerId,
      mouse: event.pointerType === 'mouse',
      originX: event.clientX,
      originY: event.clientY,
      offset: onHandle ? mainAxis(event) - clientAt(value) : 0,
      onHandle,
      dragging: false,
      initial: value,
      candidate: value,
      frame,
      unlisten: () => {
        doc.removeEventListener('pointerup', endOutside, true);
        doc.removeEventListener('pointercancel', endOutside, true);
      },
    };
    // Keeps the pressed handle focused (mousedown would otherwise move focus to the frame's ancestor).
    event.preventDefault();
    handle?.focus({ preventScroll: true });
  };
  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = gesture.current;
    if (!drag || event.pointerId !== drag.pointerId) return;
    if (!drag.dragging) {
      const dx = event.clientX - drag.originX;
      const dy = event.clientY - drag.originY;
      const main = Math.abs(horizontal ? dx : dy);
      const cross = Math.abs(horizontal ? dy : dx);
      const slop = Number.parseFloat(getComputedStyle(drag.frame).getPropertyValue(SLOP_VAR)) || 0;
      if (drag.mouse ? Math.hypot(dx, dy) < slop : main < slop && cross < slop) return;
      if (!drag.mouse && cross > main) {
        // Orthogonal intent belongs to the page (scrolling); give the gesture up.
        finish(false);
        return;
      }
      drag.dragging = true;
      drag.frame.setPointerCapture(drag.pointerId);
      setDragging(true);
    }
    const next = percentAt(mainAxis(event) - drag.offset);
    if (next !== drag.candidate) {
      drag.candidate = next;
      request(next);
    }
  };
  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const drag = gesture.current;
    if (!drag || event.pointerId !== drag.pointerId) return;
    // A prevented release still ends the gesture but requests and commits nothing.
    const vetoed = event.defaultPrevented;
    if (!drag.dragging && !drag.onHandle) {
      finish(false);
      if (!vetoed) requestAndCommit(percentAt(mainAxis(event)));
      return;
    }
    finish(!vetoed);
  };
  const handlePointerAbort = (event: PointerEvent<HTMLDivElement>) => {
    if (gesture.current?.pointerId === event.pointerId) finish(false);
  };

  const handleKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (disabled || event.defaultPrevented) return;
    const amount = event.shiftKey ? largeStep : step;
    const physical = horizontal && rtl() ? -1 : 1;
    const targets: Record<string, number> = {
      ArrowRight: value + amount * physical,
      ArrowLeft: value - amount * physical,
      ArrowUp: value + amount,
      ArrowDown: value - amount,
      PageUp: value + largeStep,
      PageDown: value - largeStep,
      Home: MIN,
      End: MAX,
    };
    const target = targets[event.key];
    if (target === undefined) return;
    event.preventDefault();
    requestAndCommit(clamp(target));
  };

  const captions = labels === false ? (['', ''] as const) : labels;
  const beforeCaptionId = captions[0] !== '' ? `${id}-before` : undefined;
  const afterCaptionId = captions[1] !== '' ? `${id}-after` : undefined;
  const frameSlot = slotProps?.frame;
  const handleSlot = slotProps?.handle;
  const resetSlot = slotProps?.resetButton;
  const frameStyleVars = {
    ...frameSlot?.style,
    aspectRatio,
    [VALUE_VAR]: `${value}%`,
  } as CSSProperties;
  const formatted = percentFormat.format(value / MAX);

  return (
    <WithSx className={className} styles={rootStyle} sx={sx}>
      {(rootClass) => (
        <div
          {...rest}
          ref={ref}
          className={rootClass}
          data-ui="image-compare"
          data-orientation={orientation}
          data-disabled={disabled || undefined}
          onKeyDown={(event) => {
            onKeyDown?.(event);
            if (event.target === handleRef.current) handleKey(event);
          }}
        >
          <div
            {...frameSlot}
            ref={mergedFrameRef}
            data-ui="image-compare-frame"
            data-disabled={disabled || undefined}
            css={[frameStyle, frameOrientationStyles[orientation], frameSlot?.css]}
            style={frameStyleVars}
            onPointerDown={(event) => {
              frameSlot?.onPointerDown?.(event);
              handlePointerDown(event);
            }}
            onPointerMove={(event) => {
              frameSlot?.onPointerMove?.(event);
              if (!event.defaultPrevented) handlePointerMove(event);
            }}
            onPointerUp={(event) => {
              frameSlot?.onPointerUp?.(event);
              handlePointerUp(event);
            }}
            onPointerCancel={(event) => {
              frameSlot?.onPointerCancel?.(event);
              handlePointerAbort(event);
            }}
            onLostPointerCapture={(event) => {
              frameSlot?.onLostPointerCapture?.(event);
              handlePointerAbort(event);
            }}
            onDragStart={(event) => {
              frameSlot?.onDragStart?.(event);
              event.preventDefault();
            }}
          >
            <div
              {...slotProps?.after}
              data-ui="image-compare-after"
              css={[layerStyle, slotProps?.after?.css]}
            >
              {after}
              {afterCaptionId && (
                <span
                  {...slotProps?.afterLabel}
                  id={afterCaptionId}
                  aria-hidden="true"
                  data-ui="image-compare-after-label"
                  css={[captionStyle, afterCaptionStyles[orientation], slotProps?.afterLabel?.css]}
                >
                  {captions[1]}
                </span>
              )}
            </div>
            <div
              {...slotProps?.before}
              data-ui="image-compare-before"
              css={[layerStyle, beforeOrientationStyles[orientation], slotProps?.before?.css]}
            >
              {before}
              {beforeCaptionId && (
                <span
                  {...slotProps?.beforeLabel}
                  id={beforeCaptionId}
                  aria-hidden="true"
                  data-ui="image-compare-before-label"
                  css={[captionStyle, beforeCaptionStyle, slotProps?.beforeLabel?.css]}
                >
                  {captions[0]}
                </span>
              )}
            </div>
            <div
              {...slotProps?.divider}
              aria-hidden="true"
              data-ui="image-compare-divider"
              css={[dividerStyle, dividerOrientationStyles[orientation], slotProps?.divider?.css]}
            />
            <div
              {...handleSlot}
              ref={mergedHandleRef}
              role="slider"
              tabIndex={0}
              data-ui="image-compare-handle"
              data-dragging={dragging || undefined}
              aria-orientation={orientation}
              aria-disabled={disabled || undefined}
              aria-valuemin={MIN}
              aria-valuemax={MAX}
              aria-valuenow={value}
              aria-valuetext={valueText(value, formatted)}
              aria-label={handleSlot?.['aria-label'] ?? label}
              aria-describedby={ids(handleSlot?.['aria-describedby'], beforeCaptionId, afterCaptionId)}
              css={[handleStyle, handleOrientationStyles[orientation], handleSlot?.css]}
              onDoubleClick={(event) => {
                handleSlot?.onDoubleClick?.(event);
                if (!event.defaultPrevented) reset();
              }}
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                css={[gripStyle, gripOrientationStyles[orientation]]}
              >
                <path d="M9 6l-6 6 6 6M15 6l6 6-6 6" />
              </svg>
            </div>
          </div>
          {showReset && (
            <Button
              size="sm"
              variant="outline"
              {...resetSlot}
              type="button"
              disabled={disabled}
              css={[resetStyle, resetSlot?.css]}
              onClick={(event) => {
                resetSlot?.onClick?.(event);
                if (!event.defaultPrevented) reset();
              }}
            >
              {resetLabel}
            </Button>
          )}
        </div>
      )}
    </WithSx>
  );
}

ImageCompare.displayName = 'ImageCompare';
