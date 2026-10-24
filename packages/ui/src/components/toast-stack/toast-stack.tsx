'use client';

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentPropsWithRef,
  type ComponentType,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { useMergeRefs } from '@floating-ui/react';
import { vars } from '@jfrader/tokens/vars';
import { css } from '../../styling/css';
import { REDUCED_MOTION } from '../../styling/media';
import { withoutSx, WithSx, type SxProps } from '../../styling/sx';
import { ToastItem, ToastPortal, useToastQueueContext, useToastRenderer, type ToastPartProps } from '../toast/toast';
import { TOAST_VIEWPORT_INLINE_SIZE } from '../toast/toast-layout';

export type ToastStackVariant = 'stacked' | 'list';
export type ToastStackPosition = 'bottom-start' | 'bottom-center' | 'bottom-end';
export interface ToastStackSlots {
  /** Container holding the toast stack. */
  root?: ComponentType<ComponentPropsWithRef<'div'>>;
  /** Container holding the stacked notifications. */
  list?: ComponentType<ToastPartProps>;
  /** Container wrapping one notification. */
  item?: ComponentType<ToastPartProps>;
}
export interface ToastStackProps extends Omit<ComponentPropsWithRef<'div'>, 'children'>, Omit<ToastPartProps, 'css'>, SxProps {
  /** Chooses a collapsible stack or an always-expanded list. Defaults to `"stacked"`. */
  variant?: ToastStackVariant;
  /** Anchors the stack at a logical bottom edge or center. Defaults to `"bottom-end"`. */
  position?: ToastStackPosition;
  /** Renders inline with absolute positioning instead of in a fixed portal. Defaults to `false`. */
  contained?: boolean;
  /** Limits visible cards while collapsed. Rounded down with a minimum of `1`; omitted or nonfinite values use `3`. */
  maxVisible?: number;
  /** Names the notification region unless ARIA naming props override it. Defaults to `"Notifications"`. */
  label?: string;
  /** Enables Alt+T to move focus into the stack outside editable fields. Defaults to `false`. */
  hotkey?: boolean;
  /** Replaces the root `div`. `slots.root` takes precedence. */
  component?: ComponentType<ComponentPropsWithRef<'div'>>;
  /** Replaces the root, list, and toast item containers. */
  slots?: ToastStackSlots;
  /** Passes props to the root, list, and toast item containers. */
  slotProps?: {
    /** Outer toast stack container element. */
    root?: Omit<ComponentPropsWithRef<'div'>, 'children'> & ToastPartProps & SxProps;
    /** Container element holding the list of stacked toast items. */
    list?: ToastPartProps;
    /** Container element wrapping an individual toast notification. */
    item?: ToastPartProps;
  };
}

/** Pointer travel before a gesture counts as a drag rather than a tap. */
const DRAG_SLOP_PX = 6;
/** Share of a card's width a swipe covers to dismiss it on release. */
const SWIPE_DISMISS_RATIO = 0.4;
/** How far each tucked card peeks above the one in front. */
const TUCK_PEEK = vars.space[4];
/** Each step back narrows the card, so the pile reads as depth instead of nested rectangles. */
const TUCK_SCALE_STEP = 0.05;
/** The narrowest a tucked card goes, however deep the pile is. */
const TUCK_SCALE_FLOOR = 0.9;
/** Milliseconds of travel a release still carries the card. */
const THROW_DECAY_MS = 99;
/** Samples older than this do not count toward the release speed. */
const THROW_WINDOW_MS = 100;
/** A finger that rested this long before lifting carries no throw. */
const THROW_REST_MS = 60;
const NARROW_VIEWPORT = '@media (max-width: 30rem)';
const rootStyle = css({
  boxSizing: 'border-box',
  position: 'fixed',
  insetBlockEnd: vars.space[4],
  insetInlineEnd: vars.space[4],
  inlineSize: TOAST_VIEWPORT_INLINE_SIZE,
  fontFamily: vars.font.sans,
  display: 'grid',
  gap: vars.space[2],
  padding: vars.space[1],
  maxBlockSize: `calc(100dvh - ${vars.space[8]})`,
  overflowY: 'auto',
  overscrollBehavior: 'contain',
  pointerEvents: 'auto',
  '&[data-empty="true"]': { pointerEvents: 'none' },
  '&[data-contained="true"]': {
    position: 'absolute',
    maxInlineSize: `calc(100% - ${vars.space[8]})`,
    maxBlockSize: `calc(100% - ${vars.space[8]})`,
  },
  '&[data-position="bottom-start"]': { insetInlineEnd: 'auto', insetInlineStart: vars.space[4] },
  '&[data-position="bottom-center"]': { insetInline: vars.space[4], marginInline: 'auto' },
  [NARROW_VIEWPORT]: { '&[data-position]': { insetInline: vars.space[4], marginInline: 'auto' } },
});
const listStyle = css({
  position: 'relative',
  blockSize: 'var(--toast-stack-height, 0px)',
  pointerEvents: 'auto',
  transitionProperty: 'block-size',
  transitionDuration: vars.motion.duration.base,
  transitionTimingFunction: vars.motion.easeStandard,
  // A collapsed pile reads as one object, so it casts one shadow. Per-card shadows would fall from
  // the front card onto the white cards behind it and read as grey bands on light surfaces.
  '&[data-expanded="false"]': {
    borderRadius: vars.radius.lg,
    boxShadow: vars.shadow.floating,
    '& [data-ui="toast"]': { boxShadow: 'none' },
  },
  [REDUCED_MOTION]: { transitionDuration: '0s' },
});
const itemStyle = css({
  position: 'absolute',
  insetInline: 0,
  insetBlockEnd: 'var(--toast-stack-offset, 0px)',
  zIndex: 'var(--toast-stack-order)',
  // The browser keeps vertical panning; horizontal travel comes to the swipe below.
  touchAction: 'pan-y',
  // Scaling from the top edge keeps a tucked card's top where it is and narrows its sides, so a
  // collapsed pile shows crescents behind the front card.
  transformOrigin: '50% 0',
  transform: 'translateX(var(--toast-swipe-x, 0px)) scale(var(--toast-stack-scale, 1))',
  opacity: 'var(--toast-swipe-fade, 1)',
  transitionProperty: 'opacity, inset-block-end, transform',
  transitionDuration: vars.motion.duration.base,
  transitionTimingFunction: vars.motion.easeStandard,
  '&[data-stack-visible="false"]': { visibility: 'hidden' },
  // A tucked card shows only its edge: the recessed surface and its border, with the message hidden
  // so the peek never clips a line of text in half.
  '&[data-stack-collapsed="true"] > [data-ui~="toast"]': {
    overflow: 'hidden',
    backgroundColor: vars.color.surfaceInset,
    '& > *': { visibility: 'hidden' },
  },
  // The card follows the finger frame by frame, so it never lags behind the pointer.
  '&[data-swiping="true"]': { transitionDuration: '0s' },
  [REDUCED_MOTION]: { transitionDuration: '0s' },
});

type SwipeGesture = {
  id: string;
  pointerId: number;
  startX: number;
  startY: number;
  /** `1` for left-to-right, `-1` for right-to-left, so a swipe travels toward the dismiss edge. */
  sign: number;
  active: boolean;
  samples: { time: number; x: number }[];
};

/** Release speed in pixels per second, from the last samples of the drag. */
function throwSpeed(samples: SwipeGesture['samples']) {
  const first = samples[0];
  const last = samples[samples.length - 1];
  if (!first || !last || last.time === first.time) return 0;
  return ((last.x - first.x) / (last.time - first.time)) * 1000;
}

/** How far a release at this speed still carries the card. */
function throwDistance(speed: number) {
  return (speed / 1000) * THROW_DECAY_MS;
}

/** Travel against the dismiss direction resists, so only a right swipe throws a card away. */
function rubberBand(distance: number, width: number) {
  return (1 - 1 / ((distance * 0.55) / width + 1)) * width;
}

/** Replaces Toast.Viewport. Mount one queue renderer per Toast provider.
 * A mouse hover, a keyboard focus, or a touch or pen tap fans the pile out. Escape dismisses the
 * focused card, a touch or pen swipe right dismisses a card, and Alt+T must be enabled to reach the
 * stack from the keyboard. Toast items announce messages; the stack region is not live.
 */
function ToastStackContent({
  ref,
  className,
  sx,
  variant = 'stacked',
  position = 'bottom-end',
  contained = false,
  maxVisible = 3,
  label = 'Notifications',
  hotkey = false,
  slotProps,
  component,
  slots,
  onPointerEnter,
  onPointerLeave,
  onFocus,
  onBlur,
  onKeyDown,
  ...props
}: ToastStackProps) {
  const { toasts, dismiss, registerRenderer } = useToastQueueContext('Stack');
  const Root = slots?.root ?? component ?? 'div';
  const List = slots?.list ?? 'div';
  const Item = slots?.item ?? 'div';
  const {
    className: rootClass, style: rootSlotStyle, sx: rootSx,
    onKeyDown: slotKeyDown, onKeyDownCapture: slotKeyDownCapture, ...rootProps
  } = slotProps?.root ?? {};
  const rootRef = useRef<HTMLDivElement | null>(null);
  const mergedRef = useMergeRefs([rootRef, rootProps.ref ?? ref]);
  const listRef = useRef<HTMLDivElement | null>(null);
  const mergedListRef = useMergeRefs([listRef, slotProps?.list?.ref]);
  const swipe = useRef<SwipeGesture | null>(null);
  // A drag that turned into a swipe must not also toggle the pile when its click arrives.
  const swallowedClick = useRef(false);
  // Touch and pen have no hover, so a tap on a card stands in for one.
  const pointerType = useRef('mouse');
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [tapped, setTapped] = useState(false);
  // The toast under a live drag, so a dismissal mid-gesture can end it cleanly.
  const [dragging, setDragging] = useState<string | null>(null);
  const [heights, setHeights] = useState<Record<string, number>>({});
  const previousOffsets = useRef(new Map<string, string>());
  const records = [...toasts].reverse();
  const open = records.filter((record) => record.state === 'open');
  const limit = Math.max(1, Math.floor(Number.isFinite(maxVisible) ? maxVisible : 3));
  const expanded = variant === 'list' || hovered || focused || tapped;
  const paused = hovered || focused || tapped || dragging !== null;
  useEffect(registerRenderer, [registerRenderer]);
  useEffect(() => {
    if (!open.length) setTapped(false);
  }, [open.length]);
  // A toast dismissed or evicted mid-drag never gets its pointerup, so the gesture ends here.
  useEffect(() => {
    if (dragging && !toasts.some((record) => record.id === dragging)) {
      swipe.current = null;
      setDragging(null);
    }
  }, [toasts, dragging]);
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (focused && root && !root.contains(root.ownerDocument.activeElement)) setFocused(false);
  }, [toasts, focused]);
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const measure = () => {
      const next: Record<string, number> = {};
      list.querySelectorAll<HTMLElement>('[data-toast-id]').forEach((item) => {
        next[item.dataset.toastId!] = item.getBoundingClientRect().height;
      });
      setHeights((current) => (JSON.stringify(current) === JSON.stringify(next) ? current : next));
    };
    const observer = new ResizeObserver(measure);
    Array.from(list.children).forEach((item) => observer.observe(item));
    measure();
    return () => observer.disconnect();
  }, [toasts]);
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const document = root.ownerDocument;
    const outside = (event: PointerEvent) => {
      if (!root.contains(event.target as Node)) setTapped(false);
    };
    const keyboard = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (
        !hotkey ||
        !event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.key.toLowerCase() !== 't' ||
        event.defaultPrevented ||
        target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])')
      )
        return;
      const button = root.querySelector<HTMLButtonElement>('[data-state="open"]:not([inert]) [data-toast-dismiss]');
      if (!button) return;
      event.preventDefault();
      // Focus fans the pile out on its own and collapses it again when focus leaves.
      button.focus();
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', keyboard);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', keyboard);
    };
  }, [hotkey, toasts]);

  function startSwipe(event: ReactPointerEvent<HTMLDivElement>, id: string) {
    pointerType.current = event.pointerType;
    // A second finger belongs to the drag already in progress, so only a primary pointer starts one.
    if (!event.isPrimary) return;
    // A gesture that lost its pointerup to an element the finger left cannot block the next one.
    swipe.current = null;
    // The previous gesture is over, so its click, if any, has already arrived.
    swallowedClick.current = false;
    // Touch and pen drag; a mouse drag is text selection, and a button has its own job on press.
    if (event.pointerType === 'mouse' || event.button !== 0) return;
    if ((event.target as Element).closest('button, a')) return;
    const card = event.currentTarget;
    card.style.removeProperty('--toast-swipe-x');
    card.style.removeProperty('--toast-swipe-fade');
    // The swipe follows the writing direction, so a right-to-left stack is swiped the other way.
    const rtl = card.ownerDocument.defaultView?.getComputedStyle(card).direction === 'rtl';
    swipe.current = {
      id,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      sign: rtl ? -1 : 1,
      active: false,
      samples: [],
    };
  }
  function moveSwipe(event: ReactPointerEvent<HTMLDivElement>) {
    const gesture = swipe.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    const card = event.currentTarget;
    const width = card.offsetWidth || 1;
    if (!gesture.active) {
      const dx = event.clientX - gesture.startX;
      const dy = event.clientY - gesture.startY;
      if (Math.hypot(dx, dy) < DRAG_SLOP_PX) return;
      // A vertical drag is the page scrolling, so the card lets go of it.
      if (Math.abs(dy) > Math.abs(dx)) {
        swipe.current = null;
        return;
      }
      gesture.active = true;
      gesture.startX = event.clientX;
      swallowedClick.current = true;
      card.setPointerCapture(event.pointerId);
      card.dataset.swiping = 'true';
      setDragging(gesture.id);
      card.ownerDocument.getSelection()?.removeAllRanges();
    }
    const travelled = (event.clientX - gesture.startX) * gesture.sign;
    const distance = travelled >= 0 ? travelled : -rubberBand(-travelled, width);
    gesture.samples.push({ time: event.timeStamp, x: travelled });
    while (gesture.samples.length > 2 && event.timeStamp - gesture.samples[0]!.time > THROW_WINDOW_MS)
      gesture.samples.shift();
    card.style.setProperty('--toast-swipe-x', `${distance * gesture.sign}px`);
    card.style.setProperty('--toast-swipe-fade', `${Math.max(0, 1 - distance / width)}`);
  }
  function endSwipe(event: ReactPointerEvent<HTMLDivElement>, cancelled: boolean) {
    const gesture = swipe.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    swipe.current = null;
    if (!gesture.active) return;
    const card = event.currentTarget;
    const width = card.offsetWidth || 1;
    const last = gesture.samples[gesture.samples.length - 1];
    const rested = event.timeStamp - (last?.time ?? event.timeStamp);
    delete card.dataset.swiping;
    setDragging(null);
    // A finger that stopped before it lifted carries no throw.
    const speed = cancelled || rested > THROW_REST_MS ? 0 : throwSpeed(gesture.samples);
    const landed = last?.x ?? 0;
    if (!cancelled && landed > 0 && landed + throwDistance(speed) > width * SWIPE_DISMISS_RATIO) {
      card.style.setProperty('--toast-swipe-x', `${(width + 40) * gesture.sign}px`);
      card.style.setProperty('--toast-swipe-fade', '0');
      dismiss(gesture.id);
      return;
    }
    // Released short: clearing the variables eases the card back into the pile.
    card.style.removeProperty('--toast-swipe-x');
    card.style.removeProperty('--toast-swipe-fade');
  }
  function handleCardClick(event: ReactMouseEvent<HTMLDivElement>) {
    if (swallowedClick.current) {
      swallowedClick.current = false;
      return;
    }
    // Touch and pen have no hover, so a tap on a card fans the pile out or tucks it away again.
    if (pointerType.current === 'mouse' || variant === 'list') return;
    if ((event.target as Element).closest('button, a')) return;
    setTapped((value) => !value);
  }

  let height = '0px';
  const offsets = new Map<string, string>();
  let sum = 0;
  open.forEach((record, index) => {
    offsets.set(
      record.id,
      expanded ? `calc(${sum}px + ${index} * ${vars.space[2]})` : `calc(${index} * ${TUCK_PEEK})`,
    );
    sum += heights[record.id] ?? 0;
  });
  useLayoutEffect(() => {
    offsets.forEach((offset, id) => previousOffsets.current.set(id, offset));
    for (const id of previousOffsets.current.keys()) {
      if (!records.some((record) => record.id === id)) previousOffsets.current.delete(id);
    }
  });
  if (open.length)
    height = expanded
      ? `calc(${sum}px + ${open.length - 1} * ${vars.space[2]})`
      : `calc(${heights[open[0]!.id] ?? 0}px + ${Math.min(open.length, limit) - 1} * ${TUCK_PEEK})`;
  const newestId = open[0]?.id;
  useEffect(() => {
    const root = rootRef.current;
    const list = listRef.current;
    if (!root || !list || focused) return;
    let cancelled = false;
    const animations = typeof list.getAnimations === 'function' ? list.getAnimations() : [];
    void Promise.allSettled(animations.map((animation) => animation.finished)).then(() => {
      if (!cancelled) root.scrollTop = root.scrollHeight;
    });
    return () => {
      cancelled = true;
    };
  }, [height, newestId, expanded, focused]);
  return (
    <WithSx className={[rootClass, className].filter(Boolean).join(' ')} styles={[rootStyle, rootSx]} sx={sx}>
      {(className) => (
        <Root
          {...props}
          {...rootProps}
          style={{ ...props.style, ...rootSlotStyle }}
          role="region"
          aria-label={rootProps['aria-label'] ?? props['aria-label'] ??
            ((rootProps['aria-labelledby'] ?? props['aria-labelledby']) ? undefined : label)}
          className={className}
          data-ui="toast-stack"
          data-empty={!open.length}
          data-contained={contained}
          data-position={position}
          data-expanded={expanded}
          ref={mergedRef}
          onPointerEnter={(event) => {
            (rootProps.onPointerEnter ?? onPointerEnter)?.(event);
            if (!event.defaultPrevented && event.pointerType === 'mouse') setHovered(true);
          }}
          onPointerLeave={(event) => {
            (rootProps.onPointerLeave ?? onPointerLeave)?.(event);
            if (!event.defaultPrevented) setHovered(false);
          }}
          onFocus={(event) => {
            (rootProps.onFocus ?? onFocus)?.(event);
            if (!event.defaultPrevented) setFocused(true);
          }}
          onBlur={(event) => {
            (rootProps.onBlur ?? onBlur)?.(event);
            if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
          }}
          onKeyDownCapture={(event) => {
            (slotKeyDownCapture ?? props.onKeyDownCapture)?.(event);
            (slotKeyDown ?? onKeyDown)?.(event);
          }}
        >
          <List
            {...withoutSx(slotProps?.list)}
            ref={mergedListRef}
            data-ui="toast-stack-list"
            data-expanded={expanded}
            className={slotProps?.list?.className}
            css={[listStyle, slotProps?.list?.sx]}
            style={{ ...slotProps?.list?.style, '--toast-stack-height': height } as CSSProperties}
          >
            {records.map((record) => {
              const index = open.indexOf(record);
              const visible = record.state === 'closing' || (index >= 0 && (expanded || index < limit));
              return (
                <div
                  key={record.id}
                  data-stack-visible={visible}
                  data-stack-collapsed={!expanded && index > 0}
                  css={itemStyle}
                  onPointerDown={(event) => startSwipe(event, record.id)}
                  onPointerMove={moveSwipe}
                  onPointerUp={(event) => endSwipe(event, false)}
                  onPointerCancel={(event) => endSwipe(event, true)}
                  onClick={handleCardClick}
                  style={
                    {
                      '--toast-stack-offset':
                        offsets.get(record.id) ?? previousOffsets.current.get(record.id) ?? '0px',
                      '--toast-stack-order': records.length - records.indexOf(record),
                      '--toast-stack-scale':
                        expanded || index <= 0
                          ? '1'
                          : `${Math.max(TUCK_SCALE_FLOOR, 1 - index * TUCK_SCALE_STEP)}`,
                    } as CSSProperties
                  }
                >
                  <ToastItem
                    record={record}
                    exposed={index >= 0 && (expanded || index === 0)}
                    paused={paused}
                    escapeDismiss
                    partProps={slotProps?.item}
                    component={Item}
                    style={!expanded && index > 0 ? {
                      blockSize: heights[open[0]!.id],
                      minBlockSize: heights[open[0]!.id],
                    } : undefined}
                  />
                </div>
              );
            })}
          </List>
        </Root>
      )}
    </WithSx>
  );
}
export function ToastStack(props: ToastStackProps) {
  const enabled = useToastRenderer('Stack');
  if (!enabled) return null;
  return (
    <ToastPortal contained={props.contained}>
      <ToastStackContent {...props} />
    </ToastPortal>
  );
}
ToastStack.displayName = 'ToastStack';
