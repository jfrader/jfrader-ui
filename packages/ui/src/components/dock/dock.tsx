'use client';

import {
  useEffect, useId, useLayoutEffect, useMemo, useRef, useState,
  type ComponentPropsWithRef, type ComponentType, type KeyboardEvent, type PointerEvent, type ReactNode,
} from 'react';
import { useInteractions, useMergeRefs } from '@floating-ui/react';
import { AnimatePresence, MotionConfig, motion, useMotionValue, useReducedMotion, useSpring } from 'motion/react';
import { base } from '@jfrader/tokens';
import { vars } from '@jfrader/tokens/vars';
import { css, type Interpolation, type Theme } from '../../styling/css';
import { FORCED_COLORS, REDUCED_MOTION } from '../../styling/media';
import { visuallyHiddenStyle } from '../../styling/visually-hidden';
import { WithSx, type SxProps } from '../../styling/sx';
import { OverlayLayer, useLayerDismiss } from '../../overlay/overlay-layer';
import { OverlayPortal } from '../../overlay/overlay-portal';
import { useOverlayFloating } from '../../overlay/use-overlay-floating';
import { isRenderable } from '../../utils/renderable';
import { useControlledState } from '../../utils/use-controlled-state';
import { Button, type ButtonProps } from '../button';
import { Menu } from '../menu';
import { joinIds } from '../menu/menu';
import { tooltipContentStyle } from '../tooltip/tooltip';

export interface DockTool {
  id: string;
  label: string;
  icon: ReactNode;
  shortcut?: string;
  badge?: number;
  badgeLabel?: string;
  disabled?: boolean;
}

export interface DockGroup {
  id: string;
  label: string;
  icon?: ReactNode;
  items: readonly DockTool[];
  disabled?: boolean;
}

export type DockItem = DockTool | DockGroup;
export interface DockMove { type: 'move'; id: string; index: number }
export interface DockMessages {
  groupName: (group: string, child: string) => string;
  selected: string;
  badge: (formatted: string, category: Intl.LDMLPluralRule, label?: string) => string;
  moved: (label: string, positionFormatted: string, totalFormatted: string) => string;
  trayLabel: (group: string) => string;
  moveBefore: string;
  moveAfter: string;
  empty: string;
}

type DivSlot = ComponentPropsWithRef<'div'> & { css?: Interpolation<Theme> };
type ButtonSlot = Omit<ComponentPropsWithRef<'button'>, 'children'> & { css?: Interpolation<Theme> };
export interface DockSlotProps {
  /** Container holding the top-level tool buttons. */
  toolbar?: DivSlot;
  /** Props for each top-level tool button. */
  item?: (item: DockItem) => ButtonSlot;
  /** Floating container holding the active group's tools. */
  tray?: DivSlot;
  /** Props for each tool button inside the tray. */
  trayItem?: (item: DockTool) => ButtonSlot;
  /** Floating label shared by focused and hovered tools. */
  floatingLabel?: DivSlot;
  /** Count badge beside a tool button. */
  badge?: ComponentPropsWithRef<'span'> & { css?: Interpolation<Theme> };
  /** Live region announcing accepted reorder operations. */
  status?: DivSlot;
}

export interface DockSlots {
  /** Replaces the top-level toolbar container. */
  toolbar?: ComponentType<DivSlot>;
  /** Replaces each top-level tool button; forwards button props and ref. */
  item?: ComponentType<ButtonProps>;
  /** Replaces the floating group container. */
  tray?: ComponentType<DivSlot>;
  /** Replaces each tray tool button; forwards button props and ref. */
  trayItem?: ComponentType<ButtonProps>;
  /** Replaces the shared floating label. */
  floatingLabel?: ComponentType<DivSlot>;
  /** Replaces each tool's count badge. */
  badge?: ComponentType<ComponentPropsWithRef<'span'> & { css?: Interpolation<Theme> }>;
  /** Replaces the reorder announcement live region. */
  status?: ComponentType<DivSlot>;
}

export interface DockProps extends Omit<ComponentPropsWithRef<'div'>, 'defaultValue'>, SxProps {
  items: readonly DockItem[];
  value?: string | null;
  defaultValue?: string | null;
  onValueChange?: (next: string | null) => void;
  order?: readonly string[];
  defaultOrder?: readonly string[];
  onOrderChange?: (ids: string[], change: DockMove) => void;
  reorderable?: boolean;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (next: boolean) => void;
  tray?: string | null;
  defaultTray?: string | null;
  onTrayChange?: (next: string | null) => void;
  label?: string;
  labels?: 'focus' | 'always';
  locale?: string;
  messages?: DockMessages;
  slots?: DockSlots;
  slotProps?: DockSlotProps;
}

const DEFAULT_LABEL = 'Tools';
const LABEL_FIRST_HOVER_MS = 120;
const LABEL_COOLDOWN_MS = 300;
const LABEL_LEAVE_MS = 100;
const DRAG_THRESHOLD_PX = 8;
const SELECTION_SPRING = { type: 'spring', stiffness: 420, damping: 38 } as const;
const REORDER_SPRING = { type: 'spring', stiffness: 450, damping: 40 } as const;
const PRESS_SPRING = { type: 'spring', stiffness: 500, damping: 35 } as const;
const FAST_FADE_SECONDS = parseFloat(base.motion.duration.fast) / 1000;
const DEFAULT_MESSAGES: DockMessages = {
  groupName: (group, child) => `${group}: ${child}`,
  selected: 'Selected',
  badge: (formatted, category, label) => `${formatted} ${label ?? (category === 'one' ? 'item' : 'items')}`,
  moved: (label, position, total) => `${label} moved to position ${position} of ${total}`,
  trayLabel: (group) => `${group} tools`,
  moveBefore: 'Move before',
  moveAfter: 'Move after',
  empty: 'No tools',
};

const rootStyle = css({
  position: 'relative', display: 'inline-flex', alignItems: 'center', gap: vars.space[2],
  maxInlineSize: '100%', minInlineSize: 0, color: vars.color.text, fontFamily: vars.font.sans,
});
const toolbarStyle = css({
  display: 'flex', gap: vars.space[1], padding: vars.space[2], overflowX: 'auto',
  minInlineSize: 0, maxInlineSize: '100%', boxSizing: 'border-box',
  border: `1px solid ${vars.color.borderControl}`, borderRadius: vars.radius.lg,
  backgroundColor: vars.color.surfaceRaised, boxShadow: vars.shadow.overlay,
  [FORCED_COLORS]: { backgroundColor: 'Canvas', color: 'CanvasText', borderColor: 'CanvasText' },
});
const cellStyle = css({ position: 'relative', flexShrink: 0, display: 'grid' });
const controlStyle = css({
  gridArea: '1 / 1', justifySelf: 'center',
  position: 'relative', boxSizing: 'border-box', flexShrink: 0,
  inlineSize: vars.space[10], minInlineSize: vars.space[10], blockSize: vars.space[10],
  padding: vars.space[1], borderColor: vars.color.borderControl, color: vars.color.text,
  touchAction: 'pan-y',
  '&[aria-pressed="true"]': { color: vars.color.accentText },
  [FORCED_COLORS]: {
    backgroundColor: 'Canvas', color: 'CanvasText', borderColor: 'CanvasText',
    '&[aria-pressed="true"]': { color: 'Highlight', borderColor: 'Highlight' },
  },
});
const alwaysControlStyle = css({ inlineSize: 'auto', paddingInline: vars.space[3], gap: vars.space[2] });
/** Join idref lists without duplicates (external ids can legitimately repeat). */
const uniqueIds = (...ids: Array<string | undefined>) => {
  const out = new Set<string>();
  for (const value of ids) for (const id of value?.split(/\s+/).filter(Boolean) ?? []) out.add(id);
  return out.size ? [...out].join(' ') : undefined;
};
const iconStyle = css({ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: vars.textSize.md });
const selectionStyle = css({
  position: 'absolute', inset: 0, backgroundColor: vars.color.accentSoft, pointerEvents: 'none',
  '&::after': {
    content: '""', position: 'absolute', insetBlockEnd: vars.space[1], insetInlineStart: `calc(50% - ${vars.space[1]} / 2)`,
    inlineSize: vars.space[1], blockSize: vars.space[1], borderRadius: vars.radius.full,
    backgroundColor: vars.color.accentText,
  },
  [FORCED_COLORS]: { backgroundColor: 'Canvas', '&::after': { backgroundColor: 'Highlight' } },
});
const glyphStyle = css({ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: vars.space[2] });
const badgeStyle = css({
  position: 'relative', gridArea: '1 / 1', alignSelf: 'start', justifySelf: 'end',
  insetBlockStart: `calc(-1 * ${vars.space[1]})`, insetInlineEnd: `calc(-1 * ${vars.space[1]})`,
  pointerEvents: 'none', zIndex: 1, whiteSpace: 'nowrap',
  minInlineSize: vars.space[4], paddingInline: vars.space[1], boxSizing: 'border-box',
  border: `1px solid ${vars.color.borderControl}`, borderRadius: vars.radius.full,
  color: vars.color.text, backgroundColor: vars.color.surfaceRaised, fontSize: vars.textSize.xs,
  fontWeight: vars.fontWeight.semibold, lineHeight: vars.lineHeight.base,
  [FORCED_COLORS]: { backgroundColor: 'Canvas', color: 'CanvasText', borderColor: 'CanvasText' },
});
const trayStyle = css({
  display: 'flex', gap: vars.space[2], padding: vars.space[2], boxSizing: 'border-box',
  maxInlineSize: `calc(100vw - 2 * ${vars.space[2]})`, overflowX: 'auto',
  border: `1px solid ${vars.color.borderControl}`, borderRadius: vars.radius.lg,
  backgroundColor: vars.color.surfaceRaised, boxShadow: vars.shadow.overlay,
  '&[hidden]': { display: 'none' },
  [FORCED_COLORS]: { backgroundColor: 'Canvas', color: 'CanvasText', borderColor: 'CanvasText' },
});
const trayContentStyle = css({ display: 'flex', gap: vars.space[1] });
const labelStyle = css({
  '&[data-glide="true"]': {
    transitionProperty: 'left, top', transitionDuration: vars.motion.duration.fast,
    transitionTimingFunction: vars.motion.easeStandard,
  },
  [REDUCED_MOTION]: { '&[data-glide="true"]': { transitionDuration: '0s' } },
  [FORCED_COLORS]: { backgroundColor: 'Canvas', color: 'CanvasText', borderColor: 'CanvasText' },
});
const optionsStyle = css({ minInlineSize: vars.space[8], minBlockSize: vars.space[8], flexShrink: 0 });

const isGroup = (item: DockItem): item is DockGroup => 'items' in item;
const enabled = (item: DockItem) => !item.disabled && (!isGroup(item) || item.items.some((child) => !child.disabled));
const badgeCount = (tool: DockTool) =>
  typeof tool.badge === 'number' && Number.isFinite(tool.badge) && Number.isInteger(tool.badge) && tool.badge > 0
    ? tool.badge : null;
const sameOrder = (first: readonly string[], second: readonly string[]) =>
  first.length === second.length && first.every((id, index) => id === second[index]);

function normalizeOrder(items: readonly DockItem[], order: readonly string[] | undefined) {
  const known = new Set(items.map((item) => item.id));
  return [...new Set([...(order ?? []), ...items.map((item) => item.id)])].filter((id) => known.has(id));
}

function rove(event: KeyboardEvent<HTMLButtonElement>, nodes: HTMLButtonElement[], rtl: boolean) {
  if (event.altKey || event.ctrlKey || event.metaKey) return;
  const current = nodes.indexOf(event.currentTarget);
  const step = rtl ? -1 : 1;
  const destinations: Record<string, number> = {
    ArrowRight: current + step, ArrowLeft: current - step, Home: 0, End: nodes.length - 1,
  };
  const next = destinations[event.key];
  if (next === undefined || !nodes.length) return;
  event.preventDefault();
  const node = nodes[(next + nodes.length) % nodes.length];
  node?.focus();
  node?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}

interface DragSnapshot {
  id: string;
  pointerId: number;
  startX: number;
  startY: number;
  order: string[];
  centers: number[];
  active: boolean;
  aborted: boolean;
}

interface ControlProps {
  item: DockItem;
  tool?: DockTool;
  selected: boolean;
  tabIndex: number;
  expanded?: boolean;
  controls?: string;
  labels: DockProps['labels'];
  name: string;
  count: string | null;
  namespace: string;
  layoutOrder?: string;
  slot?: ButtonSlot;
  badgeSlot?: DockSlotProps['badge'];
  component?: DockSlots['item'];
  badgeComponent?: DockSlots['badge'];
  register: (node: HTMLButtonElement | null) => void;
  activate: () => void;
  keyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
  focused: (node: HTMLButtonElement) => void;
  hovered: (node: HTMLButtonElement) => void;
  leave: () => void;
  startDrag?: (event: PointerEvent<HTMLButtonElement>) => void;
  updateDrag?: (event: PointerEvent<HTMLButtonElement>) => number;
  finishDrag?: (event: PointerEvent<HTMLButtonElement>, cancel: boolean) => boolean;
}

function DockControl({
  item, tool, selected, tabIndex, expanded, controls, labels, name, count, namespace, layoutOrder, slot = {}, badgeSlot,
  component: Control = Button, badgeComponent,
  register, activate, keyDown, focused, hovered, leave, startDrag, updateDrag, finishDrag,
}: ControlProps) {
  const Badge = badgeComponent ?? 'span';
  const id = useId();
  const reduced = useReducedMotion();
  const x = useMotionValue(0);
  const press = useMotionValue(1);
  const scale = useSpring(press, PRESS_SPRING);
  const suppressClick = useRef(false);
  const ref = useMergeRefs([register, slot.ref]);
  const { css: slotCss, onClick, onKeyDown, onFocus, onBlur, onPointerEnter, onPointerLeave,
    onPointerDown, onPointerMove, onPointerUp, onPointerCancel, ...native } = slot;
  const icon = isGroup(item) && isRenderable(item.icon) ? item.icon : tool?.icon;
  return (
    <motion.div css={cellStyle} layout={layoutOrder !== undefined && !reduced ? 'position' : false}
      layoutDependency={layoutOrder} transition={REORDER_SPRING} style={{ x }}>
      <Control
        {...native} ref={ref} variant="ghost" id={slot.id ?? id}
        css={[controlStyle, labels === 'always' && alwaysControlStyle, slotCss]}
        type="button" disabled={!enabled(item)} tabIndex={tabIndex} aria-pressed={selected} aria-hidden={undefined}
        aria-expanded={expanded} aria-controls={joinIds(native['aria-controls'], controls)}
        aria-haspopup={isGroup(item) ? false : native['aria-haspopup']}
        aria-label={native['aria-label'] ?? name}
        aria-labelledby={joinIds(native['aria-labelledby'], `${id}-name`)}
        data-dock-item={item.id} data-selected={selected ? 'true' : 'false'}
        onClick={(event) => {
          if (suppressClick.current) { suppressClick.current = false; event.preventDefault(); return; }
          onClick?.(event);
          if (!event.defaultPrevented) activate();
        }}
        onKeyDown={(event) => { onKeyDown?.(event); if (!event.defaultPrevented) keyDown(event); }}
        onFocus={(event) => { onFocus?.(event); if (!event.defaultPrevented) focused(event.currentTarget); }}
        onBlur={(event) => { onBlur?.(event); leave(); }}
        onPointerEnter={(event) => {
          onPointerEnter?.(event);
          if (!event.defaultPrevented && event.pointerType !== 'touch') hovered(event.currentTarget);
        }}
        onPointerLeave={(event) => { onPointerLeave?.(event); leave(); }}
        onPointerDown={(event) => {
          suppressClick.current = false;
          onPointerDown?.(event);
          if (!event.defaultPrevented) { if (!reduced) press.set(0.96); startDrag?.(event); }
        }}
        onPointerMove={(event) => {
          onPointerMove?.(event);
          if (!event.defaultPrevented && updateDrag) x.set(updateDrag(event));
        }}
        onPointerUp={(event) => {
          onPointerUp?.(event);
          suppressClick.current = suppressClick.current || (finishDrag?.(event, event.defaultPrevented) ?? false);
          x.set(0); press.set(1);
        }}
        onPointerCancel={(event) => {
          onPointerCancel?.(event);
          suppressClick.current = finishDrag?.(event, true) ?? false;
          x.set(0); press.set(1);
        }}
      >
        {selected && <motion.span
          aria-hidden css={selectionStyle} data-ui="dock-selection" layoutId={`${namespace}-selection`}
          transition={reduced ? { duration: 0 } : SELECTION_SPRING} style={{ borderRadius: vars.radius.md }}
        />}
        <span id={`${id}-name`} css={visuallyHiddenStyle}>{native['aria-label'] ?? name}</span>
        <motion.span css={glyphStyle} aria-hidden style={{ scale: reduced ? 1 : scale }}>
          <AnimatePresence mode="wait" initial={false}>
            {isRenderable(icon) && <motion.span key={tool?.id ?? item.id} css={iconStyle}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: reduced ? FAST_FADE_SECONDS / 2 : FAST_FADE_SECONDS }} data-ui="dock-icon">{icon}</motion.span>}
          </AnimatePresence>
          {labels === 'always' && <span>{tool?.label ?? item.label}</span>}
        </motion.span>
      </Control>
      {count !== null && <Badge {...badgeSlot} css={[badgeStyle, badgeSlot?.css]} aria-hidden data-ui="dock-badge">
          <AnimatePresence mode="wait" initial={false}>
            <motion.span key={count} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: reduced ? 0 : FAST_FADE_SECONDS }}>{count}</motion.span>
          </AnimatePresence>
      </Badge>}
    </motion.div>
  );
}

function DockWidget({
  items, value: valueProp, defaultValue = null, onValueChange,
  order: orderProp, defaultOrder, onOrderChange, reorderable = false,
  open: openProp, defaultOpen = false, onOpenChange,
  tray: trayProp, defaultTray = null, onTrayChange,
  label = DEFAULT_LABEL, labels = 'focus', locale, messages = DEFAULT_MESSAGES, slots, slotProps,
  ref, className, sx, dir, nodeId, ...native
}: DockProps & { nodeId: string | undefined }) {
  const namespace = useId();
  const trayId = useId();
  const reduced = useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const mergedRootRef = useMergeRefs([rootRef, ref]);
  const [direction, setDirection] = useState(dir ?? 'ltr');
  const [value, requestValue] = useControlledState(valueProp, defaultValue, onValueChange);
  const [open, requestOpen] = useControlledState(openProp, defaultOpen, onOpenChange);
  const [tray, requestTray] = useControlledState(trayProp, defaultTray, onTrayChange);
  const pendingMove = useRef<{ change: DockMove; order: string[]; focus: HTMLElement | null } | null>(null);
  const [order, requestOrder] = useControlledState<readonly string[]>(orderProp, defaultOrder, (ids) => {
    if (pendingMove.current) onOrderChange?.([...ids], pendingMove.current.change);
  });
  const orderedIds = normalizeOrder(items, order);
  const definitions = new Map(items.map((item) => [item.id, item]));
  const ordered = orderedIds.map((id) => definitions.get(id)!);
  const controls = useRef(new Map<string, HTMLButtonElement>());
  const children = useRef(new Map<string, HTMLButtonElement>());
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [childFocusedId, setChildFocusedId] = useState<string | null>(null);
  const [lastChoices, setLastChoices] = useState<ReadonlyMap<string, string>>(() => new Map());
  const [retained, setRetained] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const restore = useRef<HTMLButtonElement | null>(null);
  const focusTray = useRef<string | null>(null);
  const timers = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warm = useRef(false);
  const drag = useRef<DragSnapshot | null>(null);
  const [floatingLabel, setFloatingLabel] = useState<string | null>(null);
  const [labelReady, setLabelReady] = useState(false);
  const formatter = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const plural = useMemo(() => new Intl.PluralRules(locale), [locale]);

  const activeGroup = items.find((item): item is DockGroup => isGroup(item) && item.id === tray && enabled(item));
  const shown = Boolean(open && activeGroup);
  const retainedGroup = items.find((item): item is DockGroup => isGroup(item) && item.id === retained);
  const renderedGroup = shown ? activeGroup : retainedGroup;
  const shownTool = (item: DockItem): DockTool | undefined => {
    if (!isGroup(item)) return item;
    return item.items.find((child) => child.id === value && !child.disabled)
      ?? item.items.find((child) => child.id === lastChoices.get(item.id) && !child.disabled)
      ?? item.items.find((child) => !child.disabled);
  };
  const selected = (item: DockItem) => enabled(item) &&
    (isGroup(item) ? item.items.some((child) => child.id === value && !child.disabled) : item.id === value);
  const enabledItems = ordered.filter(enabled);
  const focusItem = enabledItems.find((item) => item.id === focusedId)
    ?? enabledItems.find(selected) ?? enabledItems[0];

  function later(action: () => void, delay: number) {
    const timer = setTimeout(() => { timers.current.delete(timer); action(); }, delay);
    timers.current.add(timer);
    return timer;
  }
  function cancel(timer: ReturnType<typeof setTimeout> | null) {
    if (timer !== null) { clearTimeout(timer); timers.current.delete(timer); }
  }
  function close(returnFocus: boolean) {
    restore.current = returnFocus && tray != null ? controls.current.get(tray) ?? null : null;
    requestOpen(false);
  }
  const floating = useOverlayFloating({
    open: shown, placement: 'top', nodeId, transform: false,
    onOpenChange: (next, _event, reason) => { if (!next) close(reason === 'escape-key'); },
  });
  const dismiss = useLayerDismiss(floating.context, 'container');
  const { getFloatingProps } = useInteractions(dismiss);
  const labelFloating = useOverlayFloating({
    open: floatingLabel !== null, placement: 'top', transform: false,
    onOpenChange: () => setFloatingLabel(null),
  });
  useEffect(() => { setLabelReady(labelFloating.isPositioned); }, [labelFloating.isPositioned]);

  // Deliberately dependency-less: re-reads the portaled/tray direction every render until it settles.
  useLayoutEffect(() => {
    const root = rootRef.current;
    const effective = root?.ownerDocument.defaultView?.getComputedStyle(root).direction;
    if (effective && effective !== direction) setDirection(effective);
  });
  useLayoutEffect(() => {
    if (shown && activeGroup) {
      setRetained(activeGroup.id);
      floating.refs.setReference(controls.current.get(activeGroup.id) ?? null);
      if (focusTray.current === activeGroup.id) {
        const child = shownTool(activeGroup);
        const target = child ? children.current.get(child.id) : null;
        if (target && floating.isPositioned) { focusTray.current = null; target.focus(); }
      }
    } else if (!open && restore.current) {
      const target = restore.current;
      restore.current = null;
      if (target.isConnected && !target.closest('[inert]')) target.focus();
    }
  });
  useEffect(() => {
    const group = items.find((item): item is DockGroup => isGroup(item) && enabled(item) &&
      item.items.some((child) => child.id === value && !child.disabled));
    if (group && value != null && lastChoices.get(group.id) !== value) {
      setLastChoices((current) => new Map(current).set(group.id, value));
    }
  }, [items, value, lastChoices]);
  useLayoutEffect(() => {
    const pending = pendingMove.current;
    if (!pending || !sameOrder(orderedIds, pending.order)) return;
    pendingMove.current = null;
    const item = definitions.get(pending.change.id);
    if (item) setStatus(messages.moved(item.label, formatter.format(pending.change.index + 1), formatter.format(ordered.length)));
    const target = controls.current.get(pending.change.id);
    if (target && pending.focus === target && target.ownerDocument.activeElement !== target) target.focus();
  });
  useEffect(() => () => { for (const timer of timers.current) clearTimeout(timer); timers.current.clear(); }, []);

  function name(item: DockItem) {
    const tool = shownTool(item);
    const count = tool ? badgeCount(tool) : null;
    return [
      isGroup(item) ? messages.groupName(item.label, tool?.label ?? messages.empty) : item.label,
      tool?.shortcut,
      count !== null ? messages.badge(formatter.format(count), plural.select(count), tool?.badgeLabel) : null,
      selected(item) ? messages.selected : null,
    ].filter((part) => part !== null && part !== undefined && part !== '').join(', ');
  }
  function showLabel(node: HTMLButtonElement, immediate: boolean) {
    cancel(hoverTimer.current); cancel(warmTimer.current); cancel(leaveTimer.current);
    labelFloating.refs.setReference(node);
    const reveal = () => { setFloatingLabel(node.getAttribute('aria-label')); warm.current = true; };
    if (immediate || warm.current || reduced) reveal();
    else hoverTimer.current = later(reveal, LABEL_FIRST_HOVER_MS);
  }
  function hideLabel() {
    cancel(hoverTimer.current); cancel(warmTimer.current); cancel(leaveTimer.current);
    leaveTimer.current = later(() => setFloatingLabel(null), LABEL_LEAVE_MS);
    warmTimer.current = later(() => { warm.current = false; }, LABEL_COOLDOWN_MS);
  }
  function move(id: string, index: number, snapshot = orderedIds) {
    const from = snapshot.indexOf(id);
    if (!reorderable || from < 0 || index < 0 || index >= snapshot.length || from === index) return;
    const next = [...snapshot];
    next.splice(from, 1); next.splice(index, 0, id);
    pendingMove.current = { change: { type: 'move', id, index }, order: next,
      focus: controls.current.get(id)?.ownerDocument.activeElement as HTMLElement | null };
    requestOrder(next);
  }
  function startDrag(event: PointerEvent<HTMLButtonElement>, id: string) {
    const item = definitions.get(id);
    if (!reorderable || !item || !enabled(item) || event.button !== 0 || !event.isPrimary) return;
    drag.current = {
      id, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY,
      order: [...orderedIds], centers: orderedIds.map((itemId) => {
        const rect = controls.current.get(itemId)!.getBoundingClientRect();
        return (rect.left + rect.right) / 2;
      }), active: false, aborted: false,
    };
  }
  function updateDrag(event: PointerEvent<HTMLButtonElement>) {
    const snapshot = drag.current;
    if (!snapshot || snapshot.pointerId !== event.pointerId || snapshot.aborted) return 0;
    const dx = event.clientX - snapshot.startX;
    const dy = event.clientY - snapshot.startY;
    if (!snapshot.active && Math.abs(dy) >= DRAG_THRESHOLD_PX && Math.abs(dy) > Math.abs(dx)) {
      snapshot.aborted = true; return 0;
    }
    if (!snapshot.active && Math.abs(dx) >= DRAG_THRESHOLD_PX) {
      snapshot.active = true; event.currentTarget.setPointerCapture(event.pointerId); hideLabel();
    }
    return snapshot.active ? dx : 0;
  }
  function finishDrag(event: PointerEvent<HTMLButtonElement>, cancelled: boolean) {
    const snapshot = drag.current;
    if (!snapshot || snapshot.pointerId !== event.pointerId) return false;
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (!snapshot.active || snapshot.aborted) return snapshot.aborted;
    if (!cancelled) {
      const from = snapshot.order.indexOf(snapshot.id);
      const center = snapshot.centers[from]! + event.clientX - snapshot.startX;
      const index = snapshot.centers.reduce((nearest, candidate, i) =>
        Math.abs(candidate - center) < Math.abs(snapshot.centers[nearest]! - center) ? i : nearest, from);
      move(snapshot.id, index, snapshot.order);
    }
    return true;
  }
  function toolbarKey(event: KeyboardEvent<HTMLButtonElement>, item: DockItem) {
    if (event.altKey && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
      if (reorderable) {
        event.preventDefault();
        const step = (event.key === 'ArrowRight' ? 1 : -1) * (direction === 'rtl' ? -1 : 1);
        move(item.id, orderedIds.indexOf(item.id) + step);
      }
      return;
    }
    if (event.key === 'ArrowUp' && isGroup(item)) {
      event.preventDefault(); restore.current = null; focusTray.current = item.id;
      requestTray(item.id); requestOpen(true);
      if (shown && tray === item.id) {
        focusTray.current = null;
        const child = shownTool(item);
        if (child) children.current.get(child.id)?.focus();
      }
      return;
    }
    rove(event, enabledItems.flatMap((item) => controls.current.get(item.id) ?? []), direction === 'rtl');
  }

  const toolbarSlot = slotProps?.toolbar;
  const traySlot = slotProps?.tray;
  const labelSlot = slotProps?.floatingLabel;
  const statusSlot = slotProps?.status;
  const Toolbar = slots?.toolbar ?? 'div';
  const Tray = slots?.tray ?? 'div';
  const FloatingLabel = slots?.floatingLabel ?? 'div';
  const Status = slots?.status ?? 'div';
  const toolbarRef = toolbarSlot?.ref;
  const trayRef = useMergeRefs([shown ? floating.refs.setFloating : undefined, traySlot?.ref]);
  const labelRef = useMergeRefs([labelFloating.refs.setFloating, labelSlot?.ref]);
  const groupChildren = renderedGroup?.items.filter((child) => !child.disabled) ?? [];
  const childStop = groupChildren.find((child) => child.id === childFocusedId)
    ?? (renderedGroup ? shownTool(renderedGroup) : undefined) ?? groupChildren[0];
  const trigger = renderedGroup ? controls.current.get(renderedGroup.id) : null;

  return (
    <WithSx className={className} styles={rootStyle} sx={sx}>
      {(className) => <div {...native} ref={mergedRootRef} className={className} dir={dir} data-ui="dock"
        onKeyDownCapture={(event) => {
          native.onKeyDownCapture?.(event);
          if (!event.defaultPrevented && event.key === 'Escape') {
            cancel(hoverTimer.current); setFloatingLabel(null);
          }
        }}
        data-state={shown ? 'open' : 'closed'} data-selected={ordered.some(selected) ? 'true' : 'false'}>
        <Toolbar {...toolbarSlot} ref={toolbarRef} css={[toolbarStyle, toolbarSlot?.css]} role="toolbar"
          aria-hidden={undefined}
          aria-label={toolbarSlot?.['aria-label'] ?? native['aria-label'] ?? label}
          aria-labelledby={uniqueIds(native['aria-labelledby'], toolbarSlot?.['aria-labelledby'])}>
          {ordered.map((item) => {
            const tool = shownTool(item);
            const count = tool ? badgeCount(tool) : null;
            return <DockControl key={item.id} item={item} tool={tool} name={name(item)} selected={selected(item)}
              namespace={namespace} tabIndex={focusItem?.id === item.id ? 0 : -1} labels={labels}
              layoutOrder={reorderable ? JSON.stringify(orderedIds) : undefined}
              expanded={isGroup(item) ? shown && tray === item.id : undefined}
              controls={isGroup(item) && renderedGroup?.id === item.id ? trayId : undefined}
              count={count !== null ? formatter.format(count) : null} slot={slotProps?.item?.(item)} badgeSlot={slotProps?.badge}
              component={slots?.item} badgeComponent={slots?.badge}
              register={(node) => { if (node) controls.current.set(item.id, node); else controls.current.delete(item.id); }}
              activate={() => {
                if (tool) requestValue(tool.id);
                if (isGroup(item)) {
                  restore.current = null; focusTray.current = null;
                  requestTray(item.id); requestOpen(!(shown && tray === item.id));
                }
              }}
              keyDown={(event) => toolbarKey(event, item)}
              focused={(node) => { setFocusedId(item.id); showLabel(node, true); }} hovered={(node) => showLabel(node, false)}
              leave={hideLabel} startDrag={(event) => startDrag(event, item.id)} updateDrag={updateDrag} finishDrag={finishDrag}
            />;
          })}
          {items.length === 0 && <span>{messages.empty}</span>}
        </Toolbar>
        {reorderable && focusItem && <Menu>
          <Menu.Trigger sx={optionsStyle} aria-label={`${messages.moveBefore} / ${messages.moveAfter}: ${focusItem.label}`}>↔</Menu.Trigger>
          <Menu.Content dir={direction}>
            <Menu.Item disabled={orderedIds.indexOf(focusItem.id) === 0}
              onSelect={() => move(focusItem.id, orderedIds.indexOf(focusItem.id) - 1)}>{messages.moveBefore}</Menu.Item>
            <Menu.Item disabled={orderedIds.indexOf(focusItem.id) === orderedIds.length - 1}
              onSelect={() => move(focusItem.id, orderedIds.indexOf(focusItem.id) + 1)}>{messages.moveAfter}</Menu.Item>
          </Menu.Content>
        </Menu>}
        {renderedGroup && <>
            <Tray {...getFloatingProps(traySlot ?? {})} ref={trayRef} css={[trayStyle, traySlot?.css]}
              id={trayId} role="group" dir={direction} hidden={!shown} inert={!shown} aria-hidden={shown ? undefined : true}
              aria-label={traySlot?.['aria-label'] ?? messages.trayLabel(renderedGroup.label)}
              aria-labelledby={joinIds(traySlot?.['aria-labelledby'], trigger?.id)}
              style={{ ...traySlot?.style, ...floating.floatingStyles,
                visibility: shown && !floating.isPositioned ? 'hidden' : traySlot?.style?.visibility }} data-ui="dock-tray">
              <motion.div css={trayContentStyle} layout={reduced ? false : 'size'} layoutDependency={renderedGroup.id}
                transition={reduced ? { duration: 0 } : SELECTION_SPRING}>
                {renderedGroup.items.map((tool) => <DockControl key={tool.id} item={tool} tool={tool} name={name(tool)}
                  selected={enabled(renderedGroup) && tool.id === value && !tool.disabled} namespace={`${namespace}-tray`}
                  labels={labels} count={badgeCount(tool) !== null ? formatter.format(badgeCount(tool)!) : null}
                  tabIndex={shown && childStop?.id === tool.id ? 0 : -1} slot={slotProps?.trayItem?.(tool)} badgeSlot={slotProps?.badge}
                  component={slots?.trayItem} badgeComponent={slots?.badge}
                  register={(node) => { if (node) children.current.set(tool.id, node); else children.current.delete(tool.id); }}
                  activate={() => { requestValue(tool.id); close(true); }}
                  focused={(node) => { setChildFocusedId(tool.id); showLabel(node, true); }} hovered={(node) => showLabel(node, false)} leave={hideLabel}
                  keyDown={(event) => {
                    if (event.key === 'ArrowDown') { event.preventDefault(); close(true); return; }
                    if (event.key === 'Tab') { later(() => close(false), 0); return; }
                    rove(event, groupChildren.flatMap((child) => children.current.get(child.id) ?? []), direction === 'rtl');
                  }}
                />)}
              </motion.div>
            </Tray>
        </>}
        {floatingLabel !== null && labels === 'focus' && <OverlayPortal>
          <FloatingLabel {...labelSlot} ref={labelRef} css={[tooltipContentStyle, labelStyle, labelSlot?.css]}
            aria-hidden dir={direction} data-ui="dock-floating-label" data-glide={labelReady ? 'true' : 'false'}
            style={{ ...labelSlot?.style, ...labelFloating.floatingStyles,
              visibility: labelFloating.isPositioned ? labelSlot?.style?.visibility : 'hidden' }}
            onPointerEnter={(event) => { labelSlot?.onPointerEnter?.(event); cancel(leaveTimer.current); cancel(warmTimer.current); }}
            onPointerLeave={(event) => { labelSlot?.onPointerLeave?.(event); hideLabel(); }}>
            {floatingLabel}
          </FloatingLabel>
        </OverlayPortal>}
        <Status {...statusSlot} css={[visuallyHiddenStyle, statusSlot?.css]} role="status" aria-live="polite" aria-atomic="true"
          aria-hidden={undefined} data-ui="dock-status">{status}</Status>
      </div>}
    </WithSx>
  );
}

export function Dock(props: DockProps) {
  return <MotionConfig reducedMotion="user"><OverlayLayer>{(nodeId) => <DockWidget {...props} nodeId={nodeId} />}</OverlayLayer></MotionConfig>;
}

Dock.displayName = 'Dock';
