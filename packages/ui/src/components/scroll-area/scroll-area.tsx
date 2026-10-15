'use client';

import {
  useCallback,
  useEffect,
  useRef,
  type ComponentPropsWithRef,
  type ComponentType,
  type CSSProperties,
  type PointerEvent,
  type Ref,
  type UIEvent,
} from 'react';
import { vars } from '@jfrader/tokens/vars';
import { css, type Interpolation, type Theme } from '../../styling/css';
import { focusRingInset } from '../../styling/focus-ring';
import { FORCED_COLORS, REDUCED_MOTION } from '../../styling/media';
import { WithSx, type SxProps } from '../../styling/sx';
import { useLatestCallback } from '../../utils/use-latest-callback';

export interface ScrollAreaEdges {
  top: boolean;
  bottom: boolean;
  left: boolean;
  right: boolean;
}
type Slot = ComponentPropsWithRef<'div'> & { css?: Interpolation<Theme> };
export interface ScrollAreaSlotProps {
  /** Scrollable viewport container holding the scrollable content. */
  viewport?: Slot;
  /** Scrollbar track element along which the thumb moves. */
  track?: Slot;
  /** Scrollbar thumb element indicating scroll position. */
  thumb?: Slot;
}
export interface ScrollAreaSlots {
  /** Scrollable viewport holding the content. */
  viewport?: ComponentType<Slot>;
  /** Scrollbar track along which the thumb moves. */
  track?: ComponentType<Slot>;
  /** Scrollbar thumb indicating scroll position. */
  thumb?: ComponentType<Slot>;
}
export interface ScrollAreaProps extends Omit<ComponentPropsWithRef<'div'>, 'onScroll'>, SxProps {
  orientation?: 'vertical' | 'horizontal' | 'both';
  fade?: number;
  scrollbars?: 'auto' | 'always' | 'native';
  hideDelay?: number;
  maxBlockSize?: CSSProperties['maxBlockSize'];
  snap?: CSSProperties['scrollSnapType'];
  wheelToHorizontal?: boolean;
  onScroll?: (event: UIEvent<HTMLDivElement>) => void;
  onEdgeChange?: (edges: ScrollAreaEdges) => void;
  slotProps?: ScrollAreaSlotProps;
  slots?: ScrollAreaSlots;
}

const DEFAULT_HIDE_DELAY = 900;
const PAGE_FRACTION = 0.9;
const EDGE_TOLERANCE = 1;
const rootStyle = css({
  label: 'scroll-area',
  position: 'relative',
  display: 'grid',
  minInlineSize: 0,
  minBlockSize: 0,
  '--scroll-area-hit': vars.space[8],
  '--scroll-area-min-thumb': vars.space[8],
  '--scroll-area-fade': vars.space[6],
  '&:hover > [data-ui="scroll-area-track"], &:focus-within > [data-ui="scroll-area-track"], &[data-scrolling] > [data-ui="scroll-area-track"], &[data-dragging] > [data-ui="scroll-area-track"], &[data-scrollbars="always"] > [data-ui="scroll-area-track"]':
    { opacity: 1 },
  '&:focus-within > [data-ui="scroll-area-viewport"]': { maskImage: 'none' },
  [FORCED_COLORS]: { '& > [data-ui="scroll-area-track"]': { display: 'none' } },
});
const viewportStyle = css({
  label: 'scroll-area-viewport',
  minInlineSize: 0,
  minBlockSize: 0,
  maxBlockSize: '100%',
  overflowX: 'hidden',
  overflowY: 'auto',
  '&:focus-visible': focusRingInset,
  maskImage:
    'linear-gradient(to bottom, transparent, black var(--fade-top), black calc(100% - var(--fade-bottom)), transparent), linear-gradient(to right, transparent, black var(--fade-left), black calc(100% - var(--fade-right)), transparent)',
  maskComposite: 'intersect',
  '&[data-orientation="horizontal"]': { overflowX: 'auto', overflowY: 'hidden' },
  '&[data-orientation="both"]': { overflowX: 'auto', overflowY: 'auto' },
  '&[data-scrollbars="native"]': { scrollbarWidth: 'auto' },
  '&:not([data-scrollbars="native"])': {
    scrollbarWidth: 'none',
    '&::-webkit-scrollbar': { display: 'none' },
  },
  [FORCED_COLORS]: {
    maskImage: 'none',
    '&:not([data-scrollbars="native"])': {
      scrollbarWidth: 'auto',
      '&::-webkit-scrollbar': { display: 'block' },
    },
  },
});
const contentStyle = css({
  display: 'flow-root',
  minInlineSize: '100%',
  '&[data-orientation="horizontal"], &[data-orientation="both"]': { inlineSize: 'max-content' },
});
const trackStyle = css({
  label: 'scroll-area-track',
  opacity: 0,
  touchAction: 'none',
  userSelect: 'none',
  transition: `opacity ${vars.motion.duration.base} ${vars.motion.easeStandard}`,
  '&[hidden]': { display: 'none' },
  [REDUCED_MOTION]: { transition: 'none' },
});
const thumbStyle = css({
  label: 'scroll-area-thumb',
  '&::after': {
    content: '""',
    position: 'absolute',
    backgroundColor: vars.color.borderControl,
    borderRadius: vars.radius.full,
    transition: `background-color ${vars.motion.duration.fast} ${vars.motion.easeStandard}`,
  },
  '&[data-axis="block"]::after': {
    insetBlock: 0,
    inlineSize: vars.space[2],
    insetInlineStart: `calc(50% - ${vars.space[2]} / 2)`,
  },
  '&[data-axis="inline"]::after': {
    insetInline: 0,
    blockSize: vars.space[2],
    insetBlockStart: `calc(50% - ${vars.space[2]} / 2)`,
  },
  '&:hover::after': { backgroundColor: vars.color.text },
  [REDUCED_MOTION]: { '&::after': { transition: 'none' } },
});

type Axis = 'block' | 'inline';
const trackGeometry: Record<Axis, CSSProperties> = {
  block: {
    position: 'absolute',
    insetInlineStart: 'auto',
    insetInlineEnd: 0,
    insetBlockStart: 0,
    insetBlockEnd: 'auto',
    inlineSize: 'var(--scroll-area-hit)',
    blockSize: 'var(--track-size)',
    transform: 'none',
  },
  inline: {
    position: 'absolute',
    insetInlineStart: 0,
    insetInlineEnd: 'auto',
    insetBlockStart: 'auto',
    insetBlockEnd: 0,
    blockSize: 'var(--scroll-area-hit)',
    inlineSize: 'var(--track-size)',
    transform: 'none',
  },
};
const thumbGeometry: Record<Axis, CSSProperties> = {
  block: {
    position: 'absolute',
    insetBlockStart: 0,
    insetBlockEnd: 'auto',
    insetInlineStart: 0,
    insetInlineEnd: 'auto',
    inlineSize: '100%',
    blockSize: 'var(--thumb-size)',
    transform: 'translateY(var(--thumb-position))',
  },
  inline: {
    position: 'absolute',
    insetBlockStart: 0,
    insetBlockEnd: 'auto',
    // translateX uses a physical left-origin offset normalized from scrollLeft, including in RTL.
    left: 0,
    right: 'auto',
    blockSize: '100%',
    inlineSize: 'var(--thumb-size)',
    transform: 'translateX(var(--thumb-position))',
  },
};
interface Geometry {
  length: number;
  thumb: number;
  offset: number;
  maximum: number;
}

function attachRef(ref: Ref<HTMLDivElement> | undefined, node: HTMLDivElement | null) {
  const cleanup = typeof ref === 'function' ? ref(node) : undefined;
  if (ref && typeof ref !== 'function') ref.current = node;
  return () => {
    if (typeof cleanup === 'function') cleanup();
    else if (typeof ref === 'function') ref(null);
    else if (ref) ref.current = null;
  };
}
interface Drag {
  axis: Axis;
  pointerId: number;
  start: number;
  offset: number;
  track: HTMLDivElement;
  snap: string;
}

export function ScrollArea({
  ref,
  children,
  className,
  sx,
  orientation = 'vertical',
  fade,
  scrollbars = 'auto',
  hideDelay = DEFAULT_HIDE_DELAY,
  maxBlockSize,
  snap,
  wheelToHorizontal = false,
  onScroll,
  onEdgeChange,
  slotProps,
  slots,
  ...rest
}: ScrollAreaProps) {
  const viewport = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const wheelVetoes = useRef(new WeakSet<Event>());
  const tracks = useRef<Partial<Record<Axis, HTMLDivElement>>>({});
  const thumbs = useRef<Partial<Record<Axis, HTMLDivElement>>>({});
  const actions = useRef<{
    press: (axis: Axis, event: PointerEvent<HTMLDivElement>) => void;
    move: (event: PointerEvent<HTMLDivElement>) => void;
    end: (event?: PointerEvent<HTMLDivElement>) => void;
  }>(null);
  const notifyEdges = useLatestCallback(onEdgeChange);
  const Viewport = slots?.viewport ?? 'div';
  const Track = slots?.track ?? 'div';
  const Thumb = slots?.thumb ?? 'div';
  const viewportRef = slotProps?.viewport?.ref;
  const attachViewport = useCallback(
    (node: HTMLDivElement | null) => {
      viewport.current = node;
      const cleanup = attachRef(viewportRef, node);
      return () => {
        viewport.current = null;
        cleanup();
      };
    },
    [viewportRef],
  );

  useEffect(() => {
    const node = viewport.current;
    const wrapper = content.current;
    const win = node?.ownerDocument.defaultView;
    const root = node?.parentElement;
    if (!node || !wrapper || !win || !root) return;
    let frame = 0;
    let timer = 0;
    let previous: ScrollAreaEdges | undefined;
    let drag: Drag | undefined;
    const geometry: Record<Axis, Geometry> = {
      block: { length: 0, thumb: 0, offset: 0, maximum: 0 },
      inline: { length: 0, thumb: 0, offset: 0, maximum: 0 },
    };
    const rtl = () => win.getComputedStyle(node).direction === 'rtl';
    const activate = () => {
      root.setAttribute('data-scrolling', '');
      win.clearTimeout(timer);
      timer = win.setTimeout(
        () => root.removeAttribute('data-scrolling'),
        Number.isFinite(hideDelay) ? Math.max(0, hideDelay) : DEFAULT_HIDE_DELAY,
      );
    };
    const measure = () => {
      win.cancelAnimationFrame(frame);
      frame = 0;
      const maxY = orientation === 'horizontal' ? 0 : Math.max(0, node.scrollHeight - node.clientHeight);
      const maxX = orientation === 'vertical' ? 0 : Math.max(0, node.scrollWidth - node.clientWidth);
      // Normalize RTL scrollLeft to distance from the physical left edge for the thumb and fades.
      const x = Math.max(0, Math.min(maxX, rtl() ? maxX + node.scrollLeft : node.scrollLeft));
      const y = Math.max(0, Math.min(maxY, node.scrollTop));
      // These are physical overflow edges: the mask gradients and onEdgeChange use left/right, not start/end.
      const edges = {
        top: y > EDGE_TOLERANCE,
        bottom: maxY - y > EDGE_TOLERANCE,
        left: x > EDGE_TOLERANCE,
        right: maxX - x > EDGE_TOLERANCE,
      };
      if (
        !previous ||
        Object.keys(edges).some(
          (key) => edges[key as keyof ScrollAreaEdges] !== previous?.[key as keyof ScrollAreaEdges],
        )
      ) {
        previous = edges;
        notifyEdges(edges);
      }
      for (const edge of Object.keys(edges) as (keyof ScrollAreaEdges)[])
        node.style.setProperty(`--fade-${edge}`, edges[edge] ? 'var(--scroll-area-fade)' : '0px');
      const hit = parseFloat(win.getComputedStyle(tracks.current.block!).width) || 0;
      const minimum =
        parseFloat(win.getComputedStyle(root).getPropertyValue('--scroll-area-min-thumb')) || hit;
      for (const axis of ['block', 'inline'] as const) {
        const vertical = axis === 'block';
        const visible = vertical ? node.clientHeight : node.clientWidth;
        const maximum = vertical ? maxY : maxX;
        const length = Math.max(0, visible - ((vertical ? maxX : maxY) > 0 ? hit : 0));
        const thumb = Math.min(length, Math.max(minimum, (length * visible) / (visible + maximum || 1)));
        const offset = vertical ? y : x;
        const position = maximum > 0 ? (offset / maximum) * (length - thumb) : 0;
        geometry[axis] = { length, thumb, maximum, offset };
        const track = tracks.current[axis];
        const pill = thumbs.current[axis];
        if (track && pill) {
          track.hidden = maximum <= 0 || scrollbars === 'native';
          track.style.setProperty('--track-size', `${length}px`);
          pill.style.setProperty('--thumb-size', `${thumb}px`);
          pill.style.setProperty('--thumb-position', `${position}px`);
        }
      }
    };
    const schedule = () => {
      if (!frame) frame = win.requestAnimationFrame(measure);
    };
    const setOffset = (axis: Axis, offset: number, behavior: ScrollBehavior = 'auto') => {
      const bounded = Math.max(0, Math.min(geometry[axis].maximum, offset));
      // scrollTo takes physical top/left coordinates; convert the left-origin offset back to RTL scrollLeft.
      node.scrollTo(
        axis === 'block'
          ? { top: bounded, behavior }
          : { left: rtl() ? bounded - geometry.inline.maximum : bounded, behavior },
      );
    };
    const end = (event?: PointerEvent<HTMLDivElement>) => {
      if (!drag || (event && event.pointerId !== drag.pointerId)) return;
      const ended = drag;
      drag = undefined;
      node.style.scrollSnapType = ended.snap;
      root.removeAttribute('data-dragging');
      if (ended.track.hasPointerCapture(ended.pointerId)) ended.track.releasePointerCapture(ended.pointerId);
      activate();
    };
    actions.current = {
      end,
      press: (axis, event) => {
        if (
          event.defaultPrevented ||
          event.button !== 0 ||
          event.isPrimary === false ||
          scrollbars === 'native'
        )
          return;
        measure();
        const track = tracks.current[axis];
        const pill = thumbs.current[axis];
        if (!track || !pill || track.hidden) return;
        event.preventDefault();
        activate();
        const coordinate = axis === 'block' ? event.clientY : event.clientX;
        if (pill.contains(event.target as Node)) {
          end();
          drag = {
            axis,
            pointerId: event.pointerId,
            start: coordinate,
            offset: geometry[axis].offset,
            track,
            snap: node.style.scrollSnapType,
          };
          node.style.scrollSnapType = 'none';
          root.setAttribute('data-dragging', '');
          track.setPointerCapture(event.pointerId);
        } else {
          const bounds = pill.getBoundingClientRect();
          const direction = coordinate < (axis === 'block' ? bounds.top : bounds.left) ? -1 : 1;
          setOffset(
            axis,
            geometry[axis].offset +
              direction * PAGE_FRACTION * (axis === 'block' ? node.clientHeight : node.clientWidth),
            win.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
          );
        }
      },
      move: (event) => {
        if (!drag || event.pointerId !== drag.pointerId || event.defaultPrevented) return;
        const current = geometry[drag.axis];
        const travel = current.length - current.thumb;
        if (travel <= 0) return;
        setOffset(
          drag.axis,
          drag.offset +
            (((drag.axis === 'block' ? event.clientY : event.clientX) - drag.start) / travel) *
              current.maximum,
        );
      },
    };
    const wheel = (event: WheelEvent) => {
      if (wheelVetoes.current.has(event)) {
        event.preventDefault();
        return;
      }
      if (
        !wheelToHorizontal ||
        orientation !== 'horizontal' ||
        !node.contains(event.target as Node) ||
        event.defaultPrevented ||
        event.ctrlKey ||
        event.metaKey ||
        event.deltaX !== 0 ||
        event.deltaY === 0
      )
        return;
      measure();
      const line =
        parseFloat(win.getComputedStyle(node).lineHeight) || parseFloat(win.getComputedStyle(node).fontSize);
      const delta = event.deltaY * ([1, line, node.clientWidth][event.deltaMode] ?? 1) * (rtl() ? -1 : 1);
      const { offset, maximum } = geometry.inline;
      if ((delta < 0 && offset <= 0) || (delta > 0 && offset >= maximum)) return;
      event.preventDefault();
      setOffset('inline', offset + delta);
    };
    const scroll = () => {
      schedule();
      activate();
    };
    const observer = new win.ResizeObserver(schedule);
    observer.observe(node);
    observer.observe(wrapper);
    const mutations = new win.MutationObserver(schedule);
    mutations.observe(wrapper, { subtree: true, childList: true, characterData: true, attributes: true });
    node.addEventListener('scroll', scroll);
    if (wheelToHorizontal && orientation === 'horizontal')
      node.ownerDocument.addEventListener('wheel', wheel, { passive: false });
    schedule();
    return () => {
      end();
      observer.disconnect();
      mutations.disconnect();
      node.removeEventListener('scroll', scroll);
      node.ownerDocument.removeEventListener('wheel', wheel);
      win.cancelAnimationFrame(frame);
      win.clearTimeout(timer);
      root.removeAttribute('data-scrolling');
      actions.current = null;
    };
  }, [orientation, scrollbars, hideDelay, wheelToHorizontal, notifyEdges]);

  const {
    ref: _viewportRef,
    css: viewportCss,
    className: viewportClass,
    style: viewportInline,
    onScroll: viewportScroll,
    onWheel: viewportWheel,
    onWheelCapture: viewportWheelCapture,
    ...viewportProps
  } = slotProps?.viewport ?? {};
  const track = slotProps?.track;
  const thumb = slotProps?.thumb;
  const fadeStyle =
    fade !== undefined && Number.isFinite(fade)
      ? ({ '--scroll-area-fade': `${Math.max(0, fade)}px` } as CSSProperties)
      : undefined;
  return (
    <WithSx className={className} styles={rootStyle} sx={sx}>
      {(resolvedClass) => (
        <div
          {...rest}
          ref={ref}
          data-ui="scroll-area"
          data-scrollbars={scrollbars}
          className={resolvedClass}
          style={{ ...fadeStyle, ...rest.style }}
          onWheel={(event) => {
            rest.onWheel?.(event);
            if (event.defaultPrevented) wheelVetoes.current.add(event.nativeEvent);
          }}
          onWheelCapture={(event) => {
            rest.onWheelCapture?.(event);
            if (event.defaultPrevented) wheelVetoes.current.add(event.nativeEvent);
          }}
        >
          <Viewport
            {...viewportProps}
            ref={attachViewport}
            css={[viewportStyle, viewportCss]}
            className={viewportClass}
            data-ui="scroll-area-viewport"
            data-orientation={orientation}
            data-scrollbars={scrollbars}
            tabIndex={viewportProps.tabIndex ?? 0}
            role={
              viewportProps.role ??
              (viewportProps['aria-label'] || viewportProps['aria-labelledby'] ? 'region' : undefined)
            }
            style={{
              ...viewportInline,
              ...(maxBlockSize !== undefined ? { maxBlockSize } : {}),
              ...(snap !== undefined ? { scrollSnapType: snap } : {}),
            }}
            onScroll={(event) => {
              viewportScroll?.(event);
              onScroll?.(event);
            }}
            onWheel={(event) => {
              viewportWheel?.(event);
              if (event.defaultPrevented) wheelVetoes.current.add(event.nativeEvent);
            }}
            onWheelCapture={(event) => {
              viewportWheelCapture?.(event);
              if (event.defaultPrevented) wheelVetoes.current.add(event.nativeEvent);
            }}
          >
            <div
              ref={content}
              css={contentStyle}
              data-orientation={orientation}
              data-ui="scroll-area-content"
            >
              {children}
            </div>
          </Viewport>
          {(['block', 'inline'] as const).map((axis) => (
            <Track
              {...track}
              key={axis}
              ref={(node) => {
                if (node) tracks.current[axis] = node;
                const cleanup = attachRef(track?.ref, node);
                return () => {
                  delete tracks.current[axis];
                  cleanup();
                };
              }}
              css={[trackStyle, track?.css]}
              style={{ ...track?.style, ...trackGeometry[axis] }}
              data-ui="scroll-area-track"
              data-axis={axis}
              aria-hidden="true"
              tabIndex={undefined}
              hidden
              onPointerDown={(event) => {
                track?.onPointerDown?.(event);
                actions.current?.press(axis, event);
              }}
              onPointerMove={(event) => {
                track?.onPointerMove?.(event);
                actions.current?.move(event);
              }}
              onPointerUp={(event) => {
                track?.onPointerUp?.(event);
                actions.current?.end(event);
              }}
              onPointerCancel={(event) => {
                track?.onPointerCancel?.(event);
                actions.current?.end(event);
              }}
              onLostPointerCapture={(event) => {
                track?.onLostPointerCapture?.(event);
                actions.current?.end(event);
              }}
            >
              <Thumb
                {...thumb}
                ref={(node) => {
                  if (node) thumbs.current[axis] = node;
                  const cleanup = attachRef(thumb?.ref, node);
                  return () => {
                    delete thumbs.current[axis];
                    cleanup();
                  };
                }}
                css={[thumbStyle, thumb?.css]}
                style={{ ...thumb?.style, ...thumbGeometry[axis] }}
                data-ui="scroll-area-thumb"
                data-axis={axis}
                aria-hidden="true"
                tabIndex={undefined}
              />
            </Track>
          ))}
        </div>
      )}
    </WithSx>
  );
}
ScrollArea.displayName = 'ScrollArea';
