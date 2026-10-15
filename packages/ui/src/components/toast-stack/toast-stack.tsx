'use client';
import { numberFormatter } from '../../utils/intl';

import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentPropsWithRef,
  type ComponentType,
  type CSSProperties,
} from 'react';
import { useMergeRefs } from '@floating-ui/react';
import { vars } from '@jfrader/tokens/vars';
import { css } from '../../styling/css';
import { REDUCED_MOTION } from '../../styling/media';
import { WithSx, type SxProps } from '../../styling/sx';
import { Button } from '../button';
import { ToastItem, ToastPortal, useToastQueueContext, useToastRenderer, type ToastPartProps } from '../toast/toast';
import { TOAST_VIEWPORT_INLINE_SIZE } from '../toast/toast-layout';

export type ToastStackVariant = 'stacked' | 'list';
export type ToastStackPosition = 'bottom-start' | 'bottom-center' | 'bottom-end';
export interface ToastStackProps extends Omit<ComponentPropsWithRef<'div'>, 'children'>, ToastPartProps, SxProps {
  variant?: ToastStackVariant;
  position?: ToastStackPosition;
  contained?: boolean;
  maxVisible?: number;
  label?: string;
  hotkey?: boolean;
  expandLabel?: string;
  collapseLabel?: string;
  component?: ComponentType<ComponentPropsWithRef<'div'>>;
  slots?: {
    /** Replaces the outer toast stack container; renders a `div` by default. */
    root?: ComponentType<ComponentPropsWithRef<'div'>>;
  };
  slotProps?: {
    /** Outer toast stack container element. */
    root?: Omit<ComponentPropsWithRef<'div'>, 'children'> & ToastPartProps & SxProps;
    /** Container element holding the list of stacked toast items. */
    list?: ToastPartProps;
    /** Button element expanding or collapsing the stacked toasts. */
    toggle?: ToastPartProps;
    /** Container element wrapping an individual toast notification. */
    item?: ToastPartProps;
  };
}

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
  maxBlockSize: `calc(100dvh - ${vars.space[8]})`,
  overflowY: 'auto',
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
  transitionProperty: 'opacity, inset-block-end',
  transitionDuration: vars.motion.duration.base,
  transitionTimingFunction: vars.motion.easeStandard,
  '&[data-stack-visible="false"]': { visibility: 'hidden' },
  [REDUCED_MOTION]: { transitionDuration: '0s' },
});
const toggleStyle = css({ pointerEvents: 'auto', justifySelf: 'end', minBlockSize: vars.space[8] });

/** Replaces Toast.Viewport. Mount one queue renderer per Toast provider.
 * Tab visits controls from newest to oldest. Escape dismisses the focused card.
 * Alt+T must be enabled. Toast items announce messages; the stack region is not live.
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
  expandLabel = 'Expand notifications',
  collapseLabel = 'Collapse notifications',
  slotProps,
  component,
  slots,
  css: consumerCss,
  onPointerEnter,
  onPointerLeave,
  onFocus,
  onBlur,
  onKeyDown,
  ...props
}: ToastStackProps) {
  const { toasts, registerRenderer } = useToastQueueContext('Stack');
  const Root = slots?.root ?? component ?? 'div';
  const {
    className: rootClass, style: rootSlotStyle, css: rootCss, sx: rootSx,
    onKeyDown: slotKeyDown, onKeyDownCapture: slotKeyDownCapture, ...rootProps
  } = slotProps?.root ?? {};
  const rootRef = useRef<HTMLDivElement | null>(null);
  const mergedRef = useMergeRefs([rootRef, rootProps.ref ?? ref]);
  const listRef = useRef<HTMLDivElement | null>(null);
  const listId = useId();
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [latched, setLatched] = useState(false);
  const [heights, setHeights] = useState<Record<string, number>>({});
  const previousOffsets = useRef(new Map<string, string>());
  const records = [...toasts].reverse();
  const open = records.filter((record) => record.state === 'open');
  const limit = Math.max(1, Math.floor(Number.isFinite(maxVisible) ? maxVisible : 3));
  const expanded = variant === 'list' || hovered || focused || latched;
  const paused = hovered || focused || latched;
  useEffect(registerRenderer, [registerRenderer]);
  useEffect(() => {
    if (!open.length) setLatched(false);
  }, [open.length]);
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
      if (!root.contains(event.target as Node)) setLatched(false);
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
      const button = root.querySelector<HTMLButtonElement>('[data-state="open"] [data-toast-dismiss]');
      if (!button) return;
      event.preventDefault();
      setLatched(true);
      button.focus();
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', keyboard);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', keyboard);
    };
  }, [hotkey, toasts]);

  let height = '0px';
  const offsets = new Map<string, string>();
  let sum = 0;
  open.forEach((record, index) => {
    offsets.set(
      record.id,
      expanded ? `calc(${sum}px + ${index} * ${vars.space[2]})` : `calc(${index} * ${vars.space[3]})`,
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
      : `calc(${heights[open[0]!.id] ?? 0}px + ${Math.min(open.length, limit) - 1} * ${vars.space[3]})`;
  const overflow = Math.max(0, open.length - limit);
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
    <WithSx className={[rootClass, className].filter(Boolean).join(' ')} styles={[rootStyle, rootCss, rootSx, consumerCss]} sx={sx}>
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
            if (!event.defaultPrevented && event.pointerType !== 'touch') setHovered(true);
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
          {variant === 'stacked' && open.length > 1 && (
            <Button
              variant="outline"
              size="sm"
              data-ui="toast-stack-toggle"
              aria-expanded={expanded}
              aria-controls={listId}
              aria-label={expanded ? collapseLabel : expandLabel}
              className={slotProps?.toggle?.className}
              css={[toggleStyle, slotProps?.toggle?.css]}
              style={slotProps?.toggle?.style}
              onClick={() => setLatched((value) => !value)}
            >
              {expanded ? collapseLabel : expandLabel}
              {overflow > 0 && ` (+${numberFormatter().format(overflow)})`}
            </Button>
          )}
          <div
            id={listId}
            ref={listRef}
            data-ui="toast-stack-list"
            data-expanded={expanded}
            className={slotProps?.list?.className}
            css={[listStyle, slotProps?.list?.css]}
            style={{ ...slotProps?.list?.style, '--toast-stack-height': height } as CSSProperties}
          >
            {records.map((record) => {
              const index = open.indexOf(record);
              const visible = record.state === 'closing' || (index >= 0 && (expanded || index < limit));
              return (
                <div
                  key={record.id}
                  data-stack-visible={visible}
                  css={itemStyle}
                  style={
                    {
                      '--toast-stack-offset':
                        offsets.get(record.id) ?? previousOffsets.current.get(record.id) ?? '0px',
                      '--toast-stack-order': records.length - records.indexOf(record),
                    } as CSSProperties
                  }
                >
                  <ToastItem
                    record={record}
                    exposed={index >= 0 && (expanded || index === 0)}
                    paused={paused}
                    escapeDismiss
                    partProps={slotProps?.item}
                    style={!expanded && index > 0 ? { minBlockSize: heights[open[0]!.id] } : undefined}
                  />
                </div>
              );
            })}
          </div>
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
