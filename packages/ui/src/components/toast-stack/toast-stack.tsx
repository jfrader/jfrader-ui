'use client';

import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentPropsWithRef,
  type CSSProperties,
} from 'react';
import { vars } from '@jfrader/tokens/vars';
import { css, type Interpolation, type Theme } from '../../styling/css';
import { REDUCED_MOTION } from '../../styling/media';
import { WithSx, type SxProps } from '../../styling/sx';
import { Button } from '../button';
import { ToastItem, ToastPortal, TOAST_VIEWPORT_INLINE_SIZE, useToastQueueContext } from '../toast/toast';

export type ToastStackVariant = 'stacked' | 'list';
export type ToastStackPosition = 'bottom-start' | 'bottom-center' | 'bottom-end';
type PartStyle = { className?: string; css?: Interpolation<Theme> };
export interface ToastStackProps extends Omit<ComponentPropsWithRef<'div'>, 'children'>, SxProps {
  variant?: ToastStackVariant;
  position?: ToastStackPosition;
  contained?: boolean;
  maxVisible?: number;
  label?: string;
  hotkey?: boolean;
  expandLabel?: string;
  collapseLabel?: string;
  slotProps?: { list?: PartStyle; toggle?: PartStyle };
}

const NARROW_VIEWPORT = '@media (max-width: 30rem)';
const rootStyle = css({
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
  transitionProperty: 'height',
  transitionDuration: vars.motion.duration.base,
  transitionTimingFunction: vars.motion.easeStandard,
  [REDUCED_MOTION]: { transitionDuration: '0s' },
});
const itemStyle = css({
  position: 'absolute',
  insetInline: 0,
  insetBlockEnd: 'var(--toast-stack-offset, 0px)',
  zIndex: 'var(--toast-stack-order)',
  transitionProperty: 'opacity, transform, inset-block-end',
  transitionDuration: vars.motion.duration.base,
  transitionTimingFunction: vars.motion.easeStandard,
  '&[data-stack-visible="false"]': { visibility: 'hidden' },
  [REDUCED_MOTION]: { transitionDuration: '0s', transform: 'none' },
});
const toggleStyle = css({ pointerEvents: 'auto', justifySelf: 'end', minBlockSize: vars.space[8] });

/** Replaces Toast.Viewport: mount exactly one queue renderer in each Toast provider.
 * Tab follows newest-to-oldest controls; Escape dismisses only the focused card.
 * Alt+T is opt-in. The region is not live; shared Toast items own announcements.
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
  onPointerEnter,
  onPointerLeave,
  onFocus,
  onBlur,
  onKeyDown,
  ...props
}: ToastStackProps) {
  const { toasts, registerRenderer } = useToastQueueContext('Stack');
  const rootRef = useRef<HTMLDivElement | null>(null);
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
  }, [hotkey, contained, toasts]);

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
  return (
    <WithSx className={className} styles={rootStyle} sx={sx}>
      {(className) => (
        <div
          {...props}
          role="region"
          aria-label={props['aria-label'] ?? (props['aria-labelledby'] ? undefined : label)}
          className={className}
          data-ui="toast-stack"
          data-empty={!open.length}
          data-contained={contained}
          data-position={position}
          data-expanded={expanded}
          ref={(element) => {
            rootRef.current = element;
            if (typeof ref === 'function') return ref(element);
            if (ref) ref.current = element;
          }}
          onPointerEnter={(event) => {
            onPointerEnter?.(event);
            if (!event.defaultPrevented && event.pointerType !== 'touch') setHovered(true);
          }}
          onPointerLeave={(event) => {
            onPointerLeave?.(event);
            if (!event.defaultPrevented) setHovered(false);
          }}
          onFocus={(event) => {
            onFocus?.(event);
            if (!event.defaultPrevented) setFocused(true);
          }}
          onBlur={(event) => {
            onBlur?.(event);
            if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
          }}
          onKeyDownCapture={(event) => {
            props.onKeyDownCapture?.(event);
            onKeyDown?.(event);
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
              onClick={() => setLatched((value) => !value)}
            >
              {expanded ? collapseLabel : expandLabel}
              {overflow > 0 && ` (+${new Intl.NumberFormat().format(overflow)})`}
            </Button>
          )}
          <div
            id={listId}
            ref={listRef}
            data-ui="toast-stack-list"
            className={slotProps?.list?.className}
            css={[listStyle, slotProps?.list?.css]}
            style={{ '--toast-stack-height': height } as CSSProperties}
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
                    style={!expanded && index > 0 ? { minBlockSize: heights[open[0]!.id] } : undefined}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </WithSx>
  );
}
export function ToastStack(props: ToastStackProps) {
  return (
    <ToastPortal contained={props.contained}>
      <ToastStackContent {...props} />
    </ToastPortal>
  );
}
ToastStack.displayName = 'ToastStack';
