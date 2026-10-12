'use client';

import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentPropsWithRef,
  type CSSProperties,
  type PointerEvent,
  type ReactNode,
} from 'react';
import { useMergeRefs } from '@floating-ui/react';
import {
  MotionConfig,
  animate,
  cubicBezier,
  motion,
  useMotionValue,
  useReducedMotion,
} from 'motion/react';
import { base } from '@jfrader/tokens';
import { vars } from '@jfrader/tokens/vars';
import { css, type Interpolation, type Theme } from '../../styling/css';
import { focusRingInset } from '../../styling/focus-ring';
import { FORCED_COLORS } from '../../styling/media';
import { WithSx, type SxProps } from '../../styling/sx';
import { isRenderable } from '../../utils/renderable';
import { useControlledState } from '../../utils/use-controlled-state';
import { Button, type ButtonProps } from '../button';

type Slot<E extends 'div' | 'header' | 'h2' | 'ul' | 'li'> = Omit<
  ComponentPropsWithRef<E>,
  'children'
> & { css?: Interpolation<Theme> };
export interface StretchRefreshSlotProps<T> {
  header?: Slot<'header'>;
  title?: Slot<'h2'>;
  subtitle?: Slot<'div'>;
  feed?: Slot<'div'>;
  list?: Slot<'ul'>;
  item?: Slot<'li'> | ((item: T, index: number) => Slot<'li'>);
  indicator?: Omit<Slot<'div'>, 'aria-hidden'>;
  refreshButton?: Omit<ButtonProps, 'children' | 'type' | 'disabled' | 'loading' | 'render' | 'sx'>;
  status?: Omit<Slot<'div'>, 'role' | 'aria-atomic'>;
  empty?: Slot<'div'>;
}
export interface StretchRefreshLabels {
  refresh?: string;
  refreshing?: string;
  pull?: string;
  release?: string;
  done?: string;
  error?: string;
}
export interface StretchRefreshProps<T>
  extends Omit<ComponentPropsWithRef<'div'>, 'children' | 'title'>, SxProps {
  title: ReactNode;
  headingLevel?: 2 | 3 | 4 | 5 | 6;
  subtitle?: ReactNode;
  items: readonly T[];
  getKey: (item: T) => string;
  renderItem: (item: T, index: number) => ReactNode;
  onRefresh: () => Promise<string | void>;
  refreshing?: boolean;
  defaultRefreshing?: boolean;
  onRefreshingChange?: (refreshing: boolean) => void;
  disabled?: boolean;
  threshold?: number;
  emptyContent?: ReactNode;
  labels?: StretchRefreshLabels;
  locale?: Intl.LocalesArgument;
  slotProps?: StretchRefreshSlotProps<T>;
}

declare const process: { env: { NODE_ENV?: string } };
const DEFAULT_THRESHOLD = 72;
const INTENT_SLOP = 8;
const MAX_PULL_RATIO = 2;
const SPRING = {
  type: 'spring',
  stiffness: 420,
  damping: 40,
  mass: 1,
} as const;
const RESULT_SECONDS = Number.parseFloat(base.motion.duration.base) / 1000;
const RESULT_START_OPACITY = 0.85;
const EASE_POINTS = base.motion.easeStandard.match(/[\d.]+/g)!.map(Number) as [
  number,
  number,
  number,
  number,
];
const RESULT_EASE = cubicBezier(...EASE_POINTS);
const LABELS = {
  refresh: 'Refresh',
  refreshing: 'Refreshing',
  pull: 'Pull to refresh',
  release: 'Release to refresh',
  done: 'Updated',
  error: 'Could not refresh. Try again.',
};
const INTERACTIVE =
  'a[href],button,input,select,textarea,label,summary,[contenteditable]:not([contenteditable="false"]),[role="button"],[tabindex]';
const rootStyle = css({
  label: 'stretch-refresh',
  display: 'flex',
  flexDirection: 'column',
  minBlockSize: 0,
  minInlineSize: 0,
  fontFamily: vars.font.sans,
  lineHeight: vars.lineHeight.base,
  color: vars.color.text,
  background: vars.color.surface,
  border: `1px solid ${vars.color.borderControl}`,
  borderRadius: vars.radius.md,
});
const headerStyle = css({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: vars.space[3],
  padding: vars.space[4],
});
const headingStyle = css({
  flex: '1 1 auto',
  margin: 0,
  minInlineSize: 0,
  overflowWrap: 'anywhere',
  fontSize: vars.textSize.md,
  fontWeight: vars.fontWeight.semibold,
});
const subtitleStyle = css({
  flexBasis: '100%',
  fontSize: vars.textSize.sm,
  color: vars.color.textMuted,
  overflowWrap: 'anywhere',
});
const buttonStyle = css({
  minBlockSize: vars.space[8],
  blockSize: 'auto',
  paddingBlock: vars.space[2],
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
  maxInlineSize: '100%',
});
const feedStyle = css({
  overflow: 'auto',
  flex: '1 1 auto',
  minBlockSize: 0,
  minInlineSize: 0,
  padding: vars.space[2],
  overscrollBehaviorY: 'contain',
  '&:focus-visible': focusRingInset,
});
const indicatorStyle = css({
  padding: vars.space[2],
  fontSize: vars.textSize.sm,
  color: vars.color.accentText,
  '&::after': {
    content: '""',
    display: 'block',
    marginBlockStart: vars.space[1],
    blockSize: vars.space[1],
    background: vars.color.accentText,
    transform: 'scaleX(var(--stretch-refresh-progress, 0))',
    transformOrigin: 'center',
  },
  [FORCED_COLORS]: {
    color: 'CanvasText',
    '&::after': { background: 'CanvasText', outline: '1px solid CanvasText' },
  },
});
const listStyle = css({ listStyle: 'none', padding: 0, margin: 0 });
const itemStyle = css({
  padding: vars.space[3],
  overflowWrap: 'anywhere',
  borderBlockEnd: `1px solid ${vars.color.borderControl}`,
  '& :is(button,a,input,select,textarea):focus-visible': focusRingInset,
});
const statusStyle = css({
  paddingInline: vars.space[4],
  paddingBlock: vars.space[2],
  fontSize: vars.textSize.sm,
  overflowWrap: 'anywhere',
});
const emptyStyle = css({ padding: vars.space[4], color: vars.color.textMuted });
const ids = (...values: (string | undefined)[]) => values.filter(Boolean).join(' ') || undefined;
type Result = { phase: 'done' | 'error'; message: string };
type Gesture = {
  pointer: number;
  touch: boolean;
  x: number;
  y: number;
  distance: number;
  locked: boolean;
  node: HTMLDivElement;
  cleanup: () => void;
};

export function StretchRefresh<T>({
  title,
  headingLevel = 2,
  subtitle,
  items,
  getKey,
  renderItem,
  onRefresh,
  refreshing,
  defaultRefreshing = false,
  onRefreshingChange,
  disabled = false,
  threshold: thresholdProp = DEFAULT_THRESHOLD,
  emptyContent,
  labels,
  locale: _locale,
  slotProps,
  ref,
  className,
  sx,
  onKeyDown,
  ...props
}: StretchRefreshProps<T>) {
  const id = useId();
  const Heading = `h${headingLevel}` as const;
  const copy = { ...LABELS, ...labels };
  const threshold =
    Number.isFinite(thresholdProp) && thresholdProp > 0 ? thresholdProp : DEFAULT_THRESHOLD;
  const [busy = false, changeBusy] = useControlledState(
    refreshing,
    defaultRefreshing,
    onRefreshingChange,
  );
  const [result, setResult] = useState<Result | null>(null);
  const [distance, setDistance] = useState(0);
  const feed = useRef<HTMLDivElement>(null);
  const mergedFeedRef = useMergeRefs([feed, slotProps?.feed?.ref]);
  const gesture = useRef<Gesture | null>(null);
  const mounted = useRef(false);
  const inFlight = useRef(false);
  const pending = useRef(false);
  const acceptanceFrame = useRef<number | undefined>(undefined);
  const y = useMotionValue(0);
  const opacity = useMotionValue(1);
  const reduced = useReducedMotion();

  const run = () => {
    if (inFlight.current || !mounted.current) return;
    pending.current = false;
    if (acceptanceFrame.current !== undefined) {
      feed.current?.ownerDocument.defaultView?.cancelAnimationFrame(acceptanceFrame.current);
      acceptanceFrame.current = undefined;
    }
    inFlight.current = true;
    setResult(null);
    Promise.resolve()
      .then(onRefresh)
      .then(
        (message) => settle({ phase: 'done', message: message ?? copy.done }),
        () => settle({ phase: 'error', message: copy.error }),
      );
  };
  const settle = (next: Result) => {
    if (!mounted.current) return;
    inFlight.current = false;
    setResult(next);
    if (refreshing === undefined) changeBusy(false);
    else onRefreshingChange?.(false);
  };
  const request = () => {
    if (disabled || busy || inFlight.current || pending.current) return;
    pending.current = true;
    if (refreshing === undefined) {
      changeBusy(true);
      run();
    } else {
      const view = feed.current?.ownerDocument.defaultView;
      acceptanceFrame.current = view?.requestAnimationFrame(() => {
        pending.current = false;
        acceptanceFrame.current = undefined;
      });
      changeBusy(true);
    }
  };
  useLayoutEffect(() => {
    if (disabled) pending.current = false;
    if (pending.current && busy && !disabled) run();
  });
  const finish = (complete: boolean) => {
    const drag = gesture.current;
    if (!drag) return;
    gesture.current = null;
    drag.cleanup();
    if (drag.node.hasPointerCapture(drag.pointer)) drag.node.releasePointerCapture(drag.pointer);
    setDistance(0);
    if (reduced || drag.node.ownerDocument.hidden) y.jump(0);
    else animate(y, 0, SPRING);
    if (complete && drag.locked && drag.distance >= threshold) request();
  };
  useEffect(() => {
    mounted.current = true;
    const view = feed.current?.ownerDocument.defaultView;
    return () => {
      mounted.current = false;
      pending.current = false;
      gesture.current?.cleanup();
      gesture.current = null;
      if (acceptanceFrame.current !== undefined)
        view?.cancelAnimationFrame(acceptanceFrame.current);
      y.stop();
    };
  }, [y]);
  useEffect(() => {
    if (reduced) y.jump(0);
  }, [reduced, y]);
  useEffect(() => {
    if (!result || reduced || feed.current?.ownerDocument.hidden) {
      opacity.jump(1);
      return;
    }
    const animation = animate(opacity, [RESULT_START_OPACITY, 1], {
      duration: RESULT_SECONDS,
      ease: RESULT_EASE,
    });
    return () => animation.stop();
  }, [result, reduced, opacity]);
  useEffect(() => {
    if (disabled || busy) finish(false);
  }, [disabled, busy]);
  useEffect(() => {
    const doc = feed.current?.ownerDocument;
    const hide = () => {
      if (doc?.hidden) {
        finish(false);
        y.jump(0);
        opacity.jump(1);
      }
    };
    doc?.addEventListener('visibilitychange', hide);
    return () => doc?.removeEventListener('visibilitychange', hide);
  }, [y, opacity]);
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    const keys = items.map(getKey);
    if (new Set(keys).size !== keys.length)
      console.warn('StretchRefresh: getKey must return unique keys.');
  }, [items, getKey]);

  const move = (clientX: number, clientY: number, prevent: () => void) => {
    const drag = gesture.current;
    if (!drag) return;
    const dx = clientX - drag.x;
    const dy = clientY - drag.y;
    if (!drag.locked) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) < INTENT_SLOP) return;
      if (dy <= 0 || Math.abs(dx) > dy || drag.node.scrollTop > 0) {
        finish(false);
        return;
      }
      drag.locked = true;
      if (!drag.touch) drag.node.setPointerCapture(drag.pointer);
    }
    prevent();
    drag.distance =
      MAX_PULL_RATIO * threshold * (1 - Math.exp(-Math.max(0, dy) / (MAX_PULL_RATIO * threshold)));
    setDistance(drag.distance);
    y.stop();
    y.set(reduced ? 0 : drag.distance);
  };
  const down = (event: PointerEvent<HTMLDivElement>) => {
    const node = event.currentTarget;
    const target = event.target as Element;
    const interactive = target.closest(INTERACTIVE);
    if (
      event.defaultPrevented ||
      disabled ||
      busy ||
      inFlight.current ||
      pending.current ||
      gesture.current ||
      !event.isPrimary ||
      event.button !== 0 ||
      node.scrollTop > 0 ||
      (interactive && interactive !== node) ||
      node.ownerDocument.getSelection()?.toString()
    )
      return;
    const doc = node.ownerDocument;
    const outside = (e: globalThis.PointerEvent) => {
      if (gesture.current?.pointer === e.pointerId && !node.contains(e.target as Node))
        finish(false);
    };
    const touchMove = (e: TouchEvent) => {
      if (e.touches.length !== 1) {
        finish(false);
        return;
      }
      const touch = e.touches[0];
      if (touch && !e.defaultPrevented)
        move(touch.clientX, touch.clientY, () => e.preventDefault());
    };
    const touchEnd = (e: TouchEvent) => finish(e.type === 'touchend' && !e.defaultPrevented);
    doc.addEventListener('pointerup', outside, true);
    doc.addEventListener('pointercancel', outside, true);
    if (event.pointerType === 'touch') {
      node.addEventListener('touchmove', touchMove, { passive: false });
      doc.addEventListener('touchend', touchEnd);
      doc.addEventListener('touchcancel', touchEnd);
    }
    gesture.current = {
      pointer: event.pointerId,
      touch: event.pointerType === 'touch',
      x: event.clientX,
      y: event.clientY,
      distance: 0,
      locked: false,
      node,
      cleanup: () => {
        doc.removeEventListener('pointerup', outside, true);
        doc.removeEventListener('pointercancel', outside, true);
        node.removeEventListener('touchmove', touchMove);
        doc.removeEventListener('touchend', touchEnd);
        doc.removeEventListener('touchcancel', touchEnd);
      },
    };
  };
  const phase = busy
    ? 'refreshing'
    : distance >= threshold
      ? 'armed'
      : distance > 0
        ? 'pulling'
        : (result?.phase ?? 'idle');
  const indicatorText = busy ? copy.refreshing : phase === 'armed' ? copy.release : copy.pull;
  const subtitlePresent = isRenderable(subtitle) && subtitle !== '';
  const titleId = slotProps?.title?.id ?? `${id}-title`;
  const subtitleId = slotProps?.subtitle?.id ?? `${id}-subtitle`;
  const feedSlot = slotProps?.feed;
  const status = result?.message ?? (busy ? copy.refreshing : '');
  return (
    <MotionConfig reducedMotion="user">
      <WithSx className={className} styles={rootStyle} sx={sx}>
        {(rootClass) => (
          <div
            {...props}
            ref={ref}
            className={rootClass}
            data-ui="stretch-refresh"
            data-state={phase}
            onKeyDown={(event) => {
              onKeyDown?.(event);
              if (
                !event.defaultPrevented &&
                event.key === 'Escape' &&
                (gesture.current || pending.current)
              ) {
                event.preventDefault();
                pending.current = false;
                finish(false);
              }
            }}
          >
            <header
              {...slotProps?.header}
              role={slotProps?.header?.role ?? 'presentation'}
              css={[headerStyle, slotProps?.header?.css]}
            >
              <Heading
                {...slotProps?.title}
                id={titleId}
                css={[headingStyle, slotProps?.title?.css]}
              >
                {title}
              </Heading>
              <Button
                variant="outline"
                size="sm"
                {...slotProps?.refreshButton}
                type="button"
                disabled={disabled}
                aria-disabled={
                  busy || inFlight.current || slotProps?.refreshButton?.['aria-disabled']
                }
                css={[buttonStyle, slotProps?.refreshButton?.css]}
                onClick={(event) => {
                  slotProps?.refreshButton?.onClick?.(event);
                  if (!event.defaultPrevented) request();
                }}
              >
                {copy.refresh}
              </Button>
              {subtitlePresent && (
                <div
                  {...slotProps?.subtitle}
                  id={subtitleId}
                  data-ui="stretch-refresh-subtitle"
                  css={[subtitleStyle, slotProps?.subtitle?.css]}
                >
                  {subtitle}
                </div>
              )}
            </header>
            <div
              {...feedSlot}
              ref={mergedFeedRef}
              role="region"
              tabIndex={feedSlot?.tabIndex ?? 0}
              data-ui="stretch-refresh-feed"
              aria-label={feedSlot?.['aria-label']}
              aria-labelledby={ids(feedSlot?.['aria-labelledby'], titleId)}
              aria-describedby={ids(
                feedSlot?.['aria-describedby'],
                subtitlePresent ? subtitleId : undefined,
              )}
              css={[feedStyle, feedSlot?.css]}
              onPointerDown={(event) => {
                feedSlot?.onPointerDown?.(event);
                down(event);
              }}
              onPointerMove={(event) => {
                feedSlot?.onPointerMove?.(event);
                if (!event.defaultPrevented && gesture.current?.pointer === event.pointerId)
                  move(event.clientX, event.clientY, () => event.preventDefault());
              }}
              onPointerUp={(event) => {
                feedSlot?.onPointerUp?.(event);
                if (gesture.current?.pointer === event.pointerId) finish(!event.defaultPrevented);
              }}
              onPointerCancel={(event) => {
                feedSlot?.onPointerCancel?.(event);
                if (gesture.current?.pointer === event.pointerId) finish(false);
              }}
              onLostPointerCapture={(event) => {
                feedSlot?.onLostPointerCapture?.(event);
                if (gesture.current?.pointer === event.pointerId) finish(false);
              }}
            >
              <div
                {...slotProps?.indicator}
                aria-hidden="true"
                data-ui="stretch-refresh-indicator"
                css={[indicatorStyle, slotProps?.indicator?.css]}
                style={
                  {
                    ...slotProps?.indicator?.style,
                    '--stretch-refresh-progress':
                      reduced || busy ? 1 : Math.min(1, distance / threshold),
                  } as CSSProperties
                }
              >
                {indicatorText}
              </div>
              <motion.div style={{ y }}>
                <ul
                  {...slotProps?.list}
                  aria-busy={busy}
                  data-ui="stretch-refresh-list"
                  css={[listStyle, slotProps?.list?.css]}
                >
                  {items.map((item, index) => {
                    const itemSlot =
                      typeof slotProps?.item === 'function'
                        ? slotProps.item(item, index)
                        : slotProps?.item;
                    return (
                      <li {...itemSlot} key={getKey(item)} css={[itemStyle, itemSlot?.css]}>
                        {renderItem(item, index)}
                      </li>
                    );
                  })}
                </ul>
                {items.length === 0 && isRenderable(emptyContent) && emptyContent !== '' && (
                  <div
                    {...slotProps?.empty}
                    data-ui="stretch-refresh-empty"
                    css={[emptyStyle, slotProps?.empty?.css]}
                  >
                    {emptyContent}
                  </div>
                )}
              </motion.div>
            </div>
            <div
              {...slotProps?.status}
              id={slotProps?.status?.id ?? `${id}-status`}
              role="status"
              aria-atomic="true"
              data-ui="stretch-refresh-status"
              css={[statusStyle, slotProps?.status?.css]}
            >
              <motion.span style={{ opacity }}>{status}</motion.span>
            </div>
          </div>
        )}
      </WithSx>
    </MotionConfig>
  );
}
StretchRefresh.displayName = 'StretchRefresh';
