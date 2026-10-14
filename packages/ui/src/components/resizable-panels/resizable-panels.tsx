'use client';

// Horizontal window splitter (WAI-ARIA APG Window Splitter). The root reads its ordered Panel
// children, lays each pane out with one flex factor and generates a focusable role="separator"
// between every adjacent pair. A separator only trades space between its two neighbours, so the
// rest of the group keeps its size.
//
// Keyboard on a separator: Left/Right move it 16px (Shift: 64px) physically, so in RTL they act
// the other way on the primary (preceding) pane. At a limit the next press collapses a
// collapsible pane, and a press back toward the interior restores its remembered size.
// Home/End jump to the smallest/largest open primary size; Enter collapses or restores the
// primary pane, or the secondary when only it is collapsible; Ctrl/Meta+Home (and a double
// click) reset the group to its initial layout; Escape cancels an active drag. Vertical arrows,
// Space and an idle Escape stay with the page.
//
// State: one weight per pane, emitted as percentages of the usable extent (group width minus
// separators) totalling 100. A zero share on a collapsible pane is its collapsed state. Pixel
// limits are resolved against the measured extent at render, so a container resize refits the
// panes without emitting. A drag requests at most once per frame, from the gesture origin plus
// the pointer delta, and commits once on release. A cancelled drag (pointercancel, lost capture,
// Escape) requests the pre-gesture layout back and never commits.
import {
  Children,
  Fragment,
  createContext,
  isValidElement,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ComponentPropsWithRef,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactElement,
  type ReactNode,
  type Ref,
} from 'react';
import { animate, useReducedMotion, type AnimationPlaybackControls } from 'motion/react';
import { vars } from '@jfrader/tokens/vars';
import { css, type Interpolation, type Theme } from '../../styling/css';
import { focusRingInset } from '../../styling/focus-ring';
import { FORCED_COLORS, REDUCED_MOTION } from '../../styling/media';
import { WithSx, type SxProps } from '../../styling/sx';
import { numberFormatter } from '../../utils/intl';
import { partId } from '../../utils/part-id';
import { useControlledState } from '../../utils/use-controlled-state';

export type ResizablePanelsSeparatorProps = ComponentPropsWithRef<'div'> & { css?: Interpolation<Theme> };

export interface ResizablePanelsSlotProps {
  /** Applied to every generated separator. */
  separator?: ResizablePanelsSeparatorProps;
}

export interface ResizablePanelsProps
  extends Omit<ComponentPropsWithRef<'div'>, 'defaultValue' | 'onChange'>, SxProps {
  /** Controlled weights, one per panel in order. A zero collapses a collapsible panel. */
  value?: readonly number[];
  /** Initial weights; equal weights when omitted. */
  defaultValue?: readonly number[];
  /** Requested layout as percentages totalling 100; drags request at most once per frame. */
  onValueChange?: (shares: number[]) => void;
  /** Completed key press, reset or pointer release. */
  onValueCommit?: (shares: number[]) => void;
  disabled?: boolean;
  /** Locale for the default separator value text. */
  locale?: Intl.LocalesArgument;
  /** Separator value text for the primary panel's share (percent of the usable extent). */
  getValueText?: (share: number, panelValue: string, collapsed: boolean) => string;
  slotProps?: ResizablePanelsSlotProps;
}

export interface ResizablePanelsPanelProps extends ComponentPropsWithRef<'div'>, SxProps {
  /** Stable identifier, unique within the group. */
  value: string;
  /** Smallest open width in px. */
  minSize?: number;
  /** Largest width in px. */
  maxSize?: number;
  /** Allows the panel to collapse to zero width. */
  collapsible?: boolean;
}

const DEFAULT_MIN_SIZE = 80;
const KEY_STEP = 16;
const LARGE_KEY_STEP = 64;
/** Rubber-band overshoot approaches this many px however far the pointer travels. */
const RESISTANCE_SPAN = 44;
const VELOCITY_WINDOW_MS = 90;
/** A collapsible pane dragged below this fraction of its minimum snaps shut. */
const COLLAPSE_FRACTION = 0.5;
/** Release speed (px/ms) that counts as a flick. */
const FLICK_VELOCITY = 0.5;
/** How far ahead (ms) a flick projects the separator before testing for a collapse. */
const FLICK_PROJECTION_MS = 160;
const RELEASE_SPRING = { type: 'spring', stiffness: 400, damping: 40, mass: 1 } as const;
/** Shares keep four decimals. */
const SHARE_SCALE = 1e4;
/** Geometry tolerance in px. */
const EPSILON = 1e-3;
const SIZE_VAR = '--resizable-panels-size';
const PANEL_SELECTOR = ':scope > [data-ui="resizable-panels-panel"]';
const SEPARATOR_SELECTOR = ':scope > [data-ui="resizable-panels-separator"]';
const BOX_EDGES = ['border-left-width', 'border-right-width', 'padding-left', 'padding-right'];

const rootStyle = css({
  label: 'resizable-panels',
  display: 'flex',
  flexDirection: 'row',
  boxSizing: 'border-box',
  inlineSize: '100%',
  blockSize: '100%',
  minInlineSize: 0,
  minBlockSize: 0,
  overflow: 'hidden',
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.md,
  backgroundColor: vars.color.surface,
  color: vars.color.text,
  fontFamily: vars.font.sans,
  fontSize: vars.textSize.sm,
  lineHeight: vars.lineHeight.base,
  '&[data-dragging]': { userSelect: 'none', cursor: 'col-resize' },
});

const panelStyle = css({
  label: 'resizable-panels-panel',
  display: 'flex',
  flex: `var(${SIZE_VAR}) 1 0px`,
  minInlineSize: 0,
  minBlockSize: 0,
  overflow: 'hidden',
});

const contentStyle = css({
  flex: '1 1 auto',
  minInlineSize: 0,
  overflow: 'auto',
  '&[inert]': { overflow: 'hidden' },
});

const GRIP = '& > [data-ui="resizable-panels-grip"]';
const ACTIVE_GRIP =
  '&:hover > [data-ui="resizable-panels-grip"], &[data-state="dragging"] > [data-ui="resizable-panels-grip"]';

const separatorStyle = css({
  label: 'resizable-panels-separator',
  position: 'relative',
  flex: '0 0 auto',
  boxSizing: 'border-box',
  inlineSize: vars.space[8],
  display: 'grid',
  placeItems: 'center',
  cursor: 'col-resize',
  touchAction: 'none',
  userSelect: 'none',
  color: vars.color.text,
  '&::before': {
    content: '""',
    position: 'absolute',
    insetBlock: 0,
    insetInline: 0,
    marginInline: 'auto',
    inlineSize: '1px',
    backgroundColor: vars.color.borderControl,
  },
  '&:focus-visible': focusRingInset,
  '&[aria-disabled="true"]': { cursor: 'default' },
  [GRIP]: {
    position: 'relative',
    inlineSize: vars.space[1],
    blockSize: vars.space[8],
    borderRadius: vars.radius.full,
    backgroundColor: vars.color.borderControl,
    transition: `transform ${vars.motion.duration.fast} ${vars.motion.easeStandard}, background-color ${vars.motion.duration.fast} ${vars.motion.easeStandard}`,
  },
  [ACTIVE_GRIP]: { backgroundColor: vars.color.textMuted, transform: 'scaleY(1.25)' },
  [REDUCED_MOTION]: { [GRIP]: { transition: 'none' }, [ACTIVE_GRIP]: { transform: 'none' } },
  [FORCED_COLORS]: {
    '&::before': { forcedColorAdjust: 'none', backgroundColor: 'CanvasText' },
    [GRIP]: { forcedColorAdjust: 'none', backgroundColor: 'CanvasText' },
    [ACTIVE_GRIP]: { backgroundColor: 'Highlight' },
  },
});

// Restore cue on a separator next to a collapsed pane: a caret pointing the way that reopens it.
const restoreStyle = css({
  position: 'relative',
  display: 'grid',
  placeItems: 'center',
  boxSizing: 'border-box',
  inlineSize: vars.space[6],
  blockSize: vars.space[6],
  border: `1px solid ${vars.color.borderControl}`,
  borderRadius: vars.radius.full,
  backgroundColor: vars.color.surfaceRaised,
  boxShadow: vars.shadow.raised,
  color: vars.color.text,
  '&::before': {
    content: '""',
    borderBlock: `${vars.space[1]} solid transparent`,
    forcedColorAdjust: 'none',
  },
  '&[data-side="start"]::before': { borderInlineStart: `${vars.space[1]} solid currentColor` },
  '&[data-side="end"]::before': { borderInlineEnd: `${vars.space[1]} solid currentColor` },
  [FORCED_COLORS]: { borderColor: 'CanvasText', boxShadow: 'none', color: 'CanvasText' },
});

interface PanelConfig {
  value: string;
  id: string;
  min: number;
  max: number;
  collapsible: boolean;
  label: string | undefined;
  labelledBy: string | undefined;
}

interface PanelState {
  id: string;
  /** Fraction of the usable extent, the pane's flex factor. */
  size: number;
  collapsed: boolean;
  /** Separator that takes focus when the pane collapses around it. */
  repairId: string | undefined;
}

const PanelContext = createContext<PanelState | null>(null);

const sum = (values: readonly number[]) => values.reduce((total, value) => total + value, 0);
const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));
const roundShare = (value: number) => Math.round(value * SHARE_SCALE) / SHARE_SCALE;
const roundPercent = (value: number) => Math.round(value * 100) / 100;
const sameShares = (a: readonly number[], b: readonly number[]) =>
  a.length === b.length && a.every((value, index) => Math.abs(value - b[index]!) < 0.5 / SHARE_SCALE);
const closeFractions = (a: readonly number[], b: readonly number[]) =>
  a.length === b.length && a.every((value, index) => Math.abs(value - b[index]!) < 1e-4);

function normalizeShares(weights: readonly number[], count: number): number[] {
  if (weights.length !== count || !weights.every((weight) => Number.isFinite(weight) && weight >= 0))
    throw new Error(`ResizablePanels value needs ${count} finite nonnegative weights, one per panel.`);
  const total = sum(weights);
  if (total <= 0) throw new Error('ResizablePanels value needs at least one positive weight.');
  return weights.map((weight) => roundShare((weight / total) * 100));
}

const toShares = (sizes: readonly number[]) => {
  const total = sum(sizes);
  return sizes.map((size) => roundShare(total > 0 ? (size / total) * 100 : 0));
};

function attachRef<T>(ref: Ref<T> | undefined, node: T | null) {
  const cleanup = typeof ref === 'function' ? ref(node) : undefined;
  if (ref && typeof ref !== 'function') ref.current = node;
  return () => {
    if (typeof cleanup === 'function') cleanup();
    else if (typeof ref === 'function') ref(null);
    else if (ref) ref.current = null;
  };
}

function readPanels(children: ReactNode, baseId: string) {
  const elements: ReactElement<ResizablePanelsPanelProps>[] = [];
  for (const child of Children.toArray(children)) {
    if (!isValidElement<ResizablePanelsPanelProps>(child) || child.type !== ResizablePanelsPanel)
      throw new Error('ResizablePanels accepts only ResizablePanels.Panel children.');
    elements.push(child);
  }
  if (elements.length === 0) throw new Error('ResizablePanels needs at least one ResizablePanels.Panel.');
  const seen = new Set<string>();
  const configs = elements.map(({ props }): PanelConfig => {
    const { value, minSize = DEFAULT_MIN_SIZE, maxSize, collapsible = false } = props;
    if (typeof value !== 'string' || value === '')
      throw new Error('ResizablePanels.Panel needs a nonempty string value.');
    if (seen.has(value)) throw new Error(`ResizablePanels.Panel values must be unique: "${value}".`);
    seen.add(value);
    if (!props['aria-label'] && !props['aria-labelledby'])
      throw new Error(`ResizablePanels.Panel "${value}" needs aria-label or aria-labelledby.`);
    if (!Number.isFinite(minSize) || minSize < 0)
      throw new Error(`ResizablePanels.Panel "${value}" minSize must be finite and nonnegative.`);
    if (maxSize !== undefined && (!Number.isFinite(maxSize) || maxSize < minSize))
      throw new Error(`ResizablePanels.Panel "${value}" maxSize must be finite and at least minSize.`);
    return {
      value,
      id: props.id ?? partId(baseId, 'panel', value),
      min: minSize,
      max: maxSize ?? Infinity,
      collapsible,
      label: props['aria-label'],
      labelledBy: props['aria-labelledby'],
    };
  });
  return { elements, configs };
}

/** Pixel limits of the open panes; minima shrink together when they do not fit. */
function limits(configs: readonly PanelConfig[], open: readonly boolean[], usable: number) {
  const minimum = sum(configs.map((config, index) => (open[index] ? config.min : 0)));
  const scale = minimum > usable ? usable / minimum : 1;
  return {
    low: configs.map((config, index) => (open[index] ? config.min * scale : 0)),
    high: configs.map((config, index) => (open[index] ? Math.min(config.max, usable) : 0)),
  };
}

/** Pixel sizes for a layout: constrained, then any surplus or deficit spread over panes with room. */
function resolve(layout: readonly number[], configs: readonly PanelConfig[], usable: number) {
  const open = configs.map((config, index) => !(config.collapsible && layout[index] === 0));
  const { low, high } = limits(configs, open, usable);
  const sizes = layout.map((share, index) => clamp((share / 100) * usable, low[index]!, high[index]!));
  const gap = usable - sum(sizes);
  const room = sizes.map((size, index) => (gap > 0 ? high[index]! - size : size - low[index]!));
  const available = sum(room);
  if (Math.abs(gap) > EPSILON && available > 0) {
    const ratio = Math.min(1, Math.abs(gap) / available);
    return sizes.map((size, index) => size + Math.sign(gap) * room[index]! * ratio);
  }
  return sizes;
}

interface Pair {
  index: number;
  total: number;
  /** Primary pane size. */
  size: number;
  /** Open primary range. */
  lower: number;
  upper: number;
  feasible: boolean;
  minPrimary: number;
  minSecondary: number;
  primaryCollapsible: boolean;
  secondaryCollapsible: boolean;
  primaryCollapsed: boolean;
  secondaryCollapsed: boolean;
  canCollapsePrimary: boolean;
  canCollapseSecondary: boolean;
}

function pairOf(
  sizes: readonly number[],
  index: number,
  configs: readonly PanelConfig[],
  usable: number,
): Pair {
  const primary = configs[index]!;
  const secondary = configs[index + 1]!;
  const open = configs.map(
    (config, i) => i === index || i === index + 1 || !(config.collapsible && sizes[i]! <= EPSILON),
  );
  const { low, high } = limits(configs, open, usable);
  const size = sizes[index]!;
  const total = size + sizes[index + 1]!;
  const lower = Math.max(low[index]!, total - high[index + 1]!);
  const upper = Math.min(high[index]!, total - low[index + 1]!);
  return {
    index,
    total,
    size,
    lower,
    upper,
    feasible: lower <= upper + EPSILON,
    minPrimary: low[index]!,
    minSecondary: low[index + 1]!,
    primaryCollapsible: primary.collapsible,
    secondaryCollapsible: secondary.collapsible,
    primaryCollapsed: primary.collapsible && size <= EPSILON,
    secondaryCollapsed: secondary.collapsible && total - size <= EPSILON,
    canCollapsePrimary: primary.collapsible && total <= high[index + 1]! + EPSILON,
    canCollapseSecondary: secondary.collapsible && total <= high[index]! + EPSILON,
  };
}

const place = (sizes: readonly number[], pair: Pair, size: number) =>
  sizes.map((value, i) => (i === pair.index ? size : i === pair.index + 1 ? pair.total - size : value));

const reachLow = (pair: Pair) => (pair.canCollapsePrimary ? 0 : pair.feasible ? pair.lower : pair.size);
const reachHigh = (pair: Pair) =>
  pair.canCollapseSecondary ? pair.total : pair.feasible ? pair.upper : pair.size;

/** Primary size for a pointer position; snaps collapsible panes shut below half their minimum. */
function dragSize(pair: Pair, desired: number) {
  if (pair.canCollapsePrimary && desired < pair.minPrimary * COLLAPSE_FRACTION) return 0;
  if (pair.canCollapseSecondary && pair.total - desired < pair.minSecondary * COLLAPSE_FRACTION)
    return pair.total;
  return pair.feasible ? clamp(desired, pair.lower, pair.upper) : pair.size;
}

const resist = (overshoot: number) =>
  Math.sign(overshoot) * RESISTANCE_SPAN * (1 - 1 / (1 + Math.abs(overshoot) / RESISTANCE_SPAN));

type KeyAction = (pair: Pair, restore: Restore, delta: number) => number;
interface Restore {
  primary: number;
  secondary: number;
}

function stepSize(pair: Pair, restore: Restore, delta: number) {
  if (pair.primaryCollapsed) return delta > 0 ? restore.primary : pair.size;
  if (pair.secondaryCollapsed) return delta < 0 ? restore.secondary : pair.size;
  if (!pair.feasible) return pair.size;
  if (delta < 0 && pair.size <= pair.lower + EPSILON && pair.canCollapsePrimary) return 0;
  if (delta > 0 && pair.size >= pair.upper - EPSILON && pair.canCollapseSecondary) return pair.total;
  return clamp(pair.size + delta, pair.lower, pair.upper);
}

/** Collapses or restores the primary pane, or the secondary when only it is collapsible. */
function toggleSize(pair: Pair, restore: Restore) {
  if (pair.primaryCollapsible)
    return pair.primaryCollapsed ? restore.primary : pair.canCollapsePrimary ? 0 : pair.size;
  if (pair.secondaryCollapsible)
    return pair.secondaryCollapsed ? restore.secondary : pair.canCollapseSecondary ? pair.total : pair.size;
  return pair.size;
}

const keyActions: Record<string, KeyAction> = {
  ArrowLeft: (pair, restore, delta) => stepSize(pair, restore, -delta),
  ArrowRight: stepSize,
  Home: (pair) => (pair.feasible ? pair.lower : pair.size),
  End: (pair) => (pair.feasible ? pair.upper : pair.size),
  Enter: toggleSize,
};

interface Gesture {
  pointerId: number;
  index: number;
  originX: number;
  /** +1 when rightward travel grows the primary pane. */
  direction: 1 | -1;
  /** Accepted layout when the gesture started. */
  originLayout: readonly number[];
  /** Resolved shares when the gesture started. */
  start: number[];
  /** Last requested shares. */
  last: number[];
  candidate: number[] | null;
  pending: boolean;
  frame: number;
  samples: { position: number; time: number }[];
  /** Rubber-banded fractions painted past a limit; null within limits. */
  visual: number[] | null;
  target: HTMLElement;
  usable: number;
}

function ResizablePanelsRoot({
  ref,
  children,
  value,
  defaultValue,
  onValueChange,
  onValueCommit,
  disabled = false,
  locale,
  getValueText,
  slotProps,
  className,
  sx,
  ...rest
}: ResizablePanelsProps) {
  const baseId = useId();
  const { elements, configs } = readPanels(children, baseId);
  const count = configs.length;
  const [initial] = useState(() => normalizeShares(defaultValue ?? value ?? configs.map(() => 1), count));
  const [state, requestChange] = useControlledState<readonly number[]>(value, initial, (next) =>
    onValueChange?.([...next]),
  );
  const layout = normalizeShares(state ?? initial, count);
  const controlled = value !== undefined;
  const reduced = useReducedMotion() ?? false;
  const [usable, setUsable] = useState(0);
  const [dragging, setDragging] = useState<number | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const gesture = useRef<Gesture | null>(null);
  const animation = useRef<{ controls: AnimationPlaybackControls | null; visual: number[] } | null>(null);
  const transition = useRef<{ from: number[]; to: number[] } | null>(null);
  const remembered = useRef(new Map<string, number>());
  const formatter = useMemo(
    () => numberFormatter(locale, { style: 'percent', maximumFractionDigits: 0 }),
    [locale],
  );

  const sizes = usable > 0 ? resolve(layout, configs, usable) : null;
  const fractions = sizes ? sizes.map((size) => size / usable) : layout.map((share) => share / 100);
  const fractionsKey = fractions.map((fraction) => fraction.toFixed(5)).join(' ');
  const separatorId = (index: number) => partId(baseId, 'separator', configs[index]!.value);

  const attachRoot = useCallback(
    (node: HTMLDivElement | null) => {
      rootRef.current = node;
      const cleanup = attachRef(ref, node);
      return () => {
        rootRef.current = null;
        cleanup();
      };
    },
    [ref],
  );

  const paint = (next: readonly number[]) => {
    rootRef.current
      ?.querySelectorAll<HTMLElement>(PANEL_SELECTOR)
      .forEach((node, index) => node.style.setProperty(SIZE_VAR, String(Math.max(0, next[index] ?? 0))));
  };
  const stopAnimation = () => {
    const running = animation.current;
    animation.current = null;
    running?.controls?.stop();
  };
  const settle = (from: readonly number[], to: readonly number[]) => {
    stopAnimation();
    if (reduced || closeFractions(from, to)) {
      paint(to);
      return;
    }
    const entry: { controls: AnimationPlaybackControls | null; visual: number[] } = {
      controls: null,
      visual: [...from],
    };
    animation.current = entry;
    paint(from);
    entry.controls = animate(0, 1, {
      ...RELEASE_SPRING,
      onUpdate: (progress) => {
        if (animation.current !== entry) return;
        entry.visual = from.map((start, index) => Math.max(0, start + (to[index]! - start) * progress));
        paint(entry.visual);
      },
      onComplete: () => {
        if (animation.current !== entry) return;
        animation.current = null;
        paint(to);
      },
    });
  };
  const visualNow = () => animation.current?.visual ?? gesture.current?.visual ?? fractions;

  useLayoutEffect(() => {
    const root = rootRef.current;
    const win = root?.ownerDocument.defaultView;
    if (!root || !win) return;
    const measure = () => {
      const style = win.getComputedStyle(root);
      const box =
        root.getBoundingClientRect().width -
        sum(BOX_EDGES.map((edge) => parseFloat(style.getPropertyValue(edge)) || 0));
      const handles = sum(
        Array.from(root.querySelectorAll(SEPARATOR_SELECTOR), (node) => node.getBoundingClientRect().width),
      );
      const next = Math.max(0, Math.round((box - handles) * 100) / 100);
      setUsable((previous) => (Math.abs(previous - next) < 0.01 ? previous : next));
    };
    measure();
    const observer = new win.ResizeObserver(measure);
    observer.observe(root);
    return () => observer.disconnect();
  }, [count]);

  // React owns the committed flex factors; springs and rubber-banding paint over them directly.
  useLayoutEffect(() => {
    const pending = transition.current;
    transition.current = null;
    const visual = gesture.current?.visual;
    if (visual) {
      stopAnimation();
      paint(visual);
    } else if (pending && closeFractions(pending.to, fractions)) settle(pending.from, fractions);
    else {
      stopAnimation();
      paint(fractions);
    }
  }, [fractionsKey]);

  const releaseCapture = (drag: Gesture) => {
    window.cancelAnimationFrame(drag.frame);
    if (drag.target.hasPointerCapture(drag.pointerId)) drag.target.releasePointerCapture(drag.pointerId);
  };

  useEffect(
    () => () => {
      const drag = gesture.current;
      gesture.current = null;
      if (drag) releaseCapture(drag);
      animation.current?.controls?.stop();
      animation.current = null;
    },
    [],
  );

  const remember = (origin: readonly number[], next: readonly number[], extent: number) =>
    configs.forEach((config, index) => {
      if (config.collapsible && origin[index]! > EPSILON && next[index]! <= EPSILON)
        remembered.current.set(config.value, (origin[index]! / extent) * 100);
    });

  /** Requests a pixel layout; returns the requested shares, or null when nothing changes. */
  const request = (next: readonly number[], origin: readonly number[], animated: boolean) => {
    if (!sizes) return null;
    const shares = toShares(next);
    if (sameShares(shares, toShares(sizes))) return null;
    remember(origin, next, usable);
    if (animated) transition.current = { from: [...visualNow()], to: next.map((size) => size / usable) };
    requestChange(shares);
    return shares;
  };

  const restoreSizes = (pair: Pair): Restore => {
    const recall = (index: number, fallback: number) => {
      const share = remembered.current.get(configs[index]!.value);
      return share === undefined ? fallback : (share / 100) * usable;
    };
    return {
      primary: pair.feasible ? clamp(recall(pair.index, pair.minPrimary), pair.lower, pair.upper) : pair.size,
      secondary: pair.feasible
        ? clamp(pair.total - recall(pair.index + 1, pair.minSecondary), pair.lower, pair.upper)
        : pair.size,
    };
  };

  const reset = () => {
    if (!sizes) return;
    const next = request(resolve(initial, configs, usable), sizes, true);
    if (next) onValueCommit?.([...next]);
  };

  const flush = (drag: Gesture) => {
    drag.pending = false;
    const candidate = drag.candidate;
    if (!candidate) return;
    const shares = toShares(candidate);
    if (sameShares(shares, drag.last)) return;
    remember(resolve(drag.originLayout, configs, drag.usable), candidate, drag.usable);
    drag.last = shares;
    requestChange(shares);
  };

  const track = (drag: Gesture, event: PointerEvent<HTMLDivElement>) => {
    const origin = resolve(drag.originLayout, configs, usable);
    const pair = pairOf(origin, drag.index, configs, usable);
    const delta = (event.clientX - drag.originX) * drag.direction;
    drag.usable = usable;
    drag.samples = [...drag.samples, { position: delta, time: event.timeStamp }].filter(
      (sample) => event.timeStamp - sample.time <= VELOCITY_WINDOW_MS,
    );
    const desired = pair.size + delta;
    const size = dragSize(pair, desired);
    drag.candidate = place(origin, pair, size);
    const overshoot = desired - clamp(desired, reachLow(pair), reachHigh(pair));
    drag.visual =
      controlled || reduced || Math.abs(overshoot) <= EPSILON
        ? null
        : place(origin, pair, clamp(size + resist(overshoot), 0, pair.total)).map((part) => part / usable);
    return { origin, pair, desired };
  };

  const endDrag = (drag: Gesture) => {
    gesture.current = null;
    releaseCapture(drag);
    setDragging(null);
  };

  const cancelDrag = () => {
    const drag = gesture.current;
    if (!drag) return;
    endDrag(drag);
    const from = drag.visual ?? visualNow();
    if (!sameShares(drag.last, drag.start) || !sameShares(layout, drag.originLayout)) {
      transition.current = {
        from: [...from],
        to: resolve(drag.originLayout, configs, usable).map((size) => size / usable),
      };
      requestChange(drag.originLayout);
    } else if (drag.visual) settle(drag.visual, fractions);
  };

  useEffect(() => {
    if (disabled) cancelDrag();
  }, [disabled]);

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>, index: number) => {
    if (disabled || event.defaultPrevented || gesture.current || !sizes || !event.isPrimary) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.focus({ preventScroll: true });
    stopAnimation();
    paint(fractions);
    const start = toShares(sizes);
    gesture.current = {
      pointerId: event.pointerId,
      index,
      originX: event.clientX,
      direction: getComputedStyle(event.currentTarget).direction === 'rtl' ? -1 : 1,
      originLayout: layout,
      start,
      last: start,
      candidate: null,
      pending: false,
      frame: 0,
      samples: [{ position: 0, time: event.timeStamp }],
      visual: null,
      target: event.currentTarget,
      usable,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(index);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = gesture.current;
    if (!drag || event.pointerId !== drag.pointerId) return;
    track(drag, event);
    if (drag.visual) paint(drag.visual);
    if (!drag.pending) {
      drag.pending = true;
      drag.frame = window.requestAnimationFrame(() => {
        if (gesture.current === drag) flush(drag);
      });
    }
  };

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const drag = gesture.current;
    if (!drag || event.pointerId !== drag.pointerId) return;
    const { origin, pair, desired } = track(drag, event);
    const first = drag.samples[0]!;
    const last = drag.samples.at(-1)!;
    const elapsed = last.time - first.time;
    const velocity = elapsed > 0 ? (last.position - first.position) / elapsed : 0;
    let flicked = false;
    if (Math.abs(velocity) >= FLICK_VELOCITY) {
      const projected = dragSize(pair, desired + velocity * FLICK_PROJECTION_MS);
      if ((projected === 0 || projected === pair.total) && projected !== dragSize(pair, desired)) {
        drag.candidate = place(origin, pair, projected);
        flicked = true;
      }
    }
    const visual = drag.visual;
    endDrag(drag);
    const before = drag.last;
    if (drag.candidate && (visual || flicked))
      transition.current = {
        from: [...(visual ?? visualNow())],
        to: drag.candidate.map((size) => size / usable),
      };
    flush(drag);
    if (drag.last === before) {
      transition.current = null;
      if (visual) settle(visual, fractions);
    }
    if (!sameShares(drag.last, drag.start)) onValueCommit?.([...drag.last]);
  };

  const handleLostCapture = (event: PointerEvent<HTMLDivElement>) => {
    if (gesture.current?.pointerId === event.pointerId) cancelDrag();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>, index: number) => {
    if (disabled || event.defaultPrevented) return;
    if (gesture.current) {
      if (event.key === 'Escape') {
        event.preventDefault();
        cancelDrag();
      }
      return;
    }
    if (!sizes) return;
    if (event.key === 'Home' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      reset();
      return;
    }
    const pair = pairOf(sizes, index, configs, usable);
    const restore = restoreSizes(pair);
    // Arrows move the separator on screen; in RTL the primary pane sits on the right.
    const direction = getComputedStyle(event.currentTarget).direction === 'rtl' ? -1 : 1;
    const action = keyActions[event.key];
    if (!action) return;
    event.preventDefault();
    const next = place(
      sizes,
      pair,
      action(pair, restore, (event.shiftKey ? LARGE_KEY_STEP : KEY_STEP) * direction),
    );
    const animated = next.some((part, i) => part <= EPSILON !== sizes[i]! <= EPSILON);
    const shares = request(next, sizes, animated);
    if (shares) onValueCommit?.([...shares]);
  };

  const handleDoubleClick = (event: MouseEvent<HTMLDivElement>) => {
    if (disabled || event.defaultPrevented) return;
    reset();
  };

  const formatShare = (share: number, index: number, collapsed: boolean) =>
    getValueText ? getValueText(share, configs[index]!.value, collapsed) : formatter.format(share / 100);

  const renderSeparator = (index: number) => {
    const slot = slotProps?.separator;
    const primary = configs[index]!;
    const pair = sizes ? pairOf(sizes, index, configs, usable) : null;
    const percent = (size: number) => roundPercent((size / usable) * 100);
    const now = pair ? percent(pair.size) : roundPercent(layout[index]!);
    const min = Math.min(now, pair ? percent(reachLow(pair)) : 0);
    const max = Math.max(
      now,
      pair ? percent(reachHigh(pair)) : roundPercent(layout[index]! + layout[index + 1]!),
    );
    const primaryCollapsed = pair ? pair.primaryCollapsed : primary.collapsible && layout[index] === 0;
    const secondaryCollapsed = pair
      ? pair.secondaryCollapsed
      : configs[index + 1]!.collapsible && layout[index + 1] === 0;
    const collapsedSide = primaryCollapsed ? 'start' : secondaryCollapsed ? 'end' : undefined;
    const labelledBy = [slot?.['aria-labelledby'], primary.labelledBy].filter(Boolean).join(' ') || undefined;
    return (
      <div
        {...slot}
        id={separatorId(index)}
        role="separator"
        tabIndex={disabled ? -1 : 0}
        aria-orientation="vertical"
        aria-controls={[slot?.['aria-controls'], primary.id].filter(Boolean).join(' ')}
        aria-valuenow={now}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuetext={formatShare(now, index, primaryCollapsed)}
        aria-label={slot?.['aria-label'] ?? (labelledBy ? undefined : primary.label)}
        aria-labelledby={labelledBy}
        aria-disabled={disabled || undefined}
        data-ui="resizable-panels-separator"
        data-state={dragging === index ? 'dragging' : 'idle'}
        data-collapsed={collapsedSide}
        css={[separatorStyle, slot?.css]}
        onPointerDown={(event) => {
          slot?.onPointerDown?.(event);
          handlePointerDown(event, index);
        }}
        onPointerMove={(event) => {
          slot?.onPointerMove?.(event);
          handlePointerMove(event);
        }}
        onPointerUp={(event) => {
          slot?.onPointerUp?.(event);
          handlePointerUp(event);
        }}
        onPointerCancel={(event) => {
          slot?.onPointerCancel?.(event);
          if (gesture.current?.pointerId === event.pointerId) cancelDrag();
        }}
        onLostPointerCapture={(event) => {
          slot?.onLostPointerCapture?.(event);
          handleLostCapture(event);
        }}
        onKeyDown={(event) => {
          slot?.onKeyDown?.(event);
          handleKeyDown(event, index);
        }}
        onDoubleClick={(event) => {
          slot?.onDoubleClick?.(event);
          handleDoubleClick(event);
        }}
      >
        {collapsedSide ? (
          <span
            aria-hidden="true"
            data-ui="resizable-panels-restore"
            data-side={collapsedSide}
            css={restoreStyle}
          />
        ) : (
          <span aria-hidden="true" data-ui="resizable-panels-grip" />
        )}
      </div>
    );
  };

  return (
    <WithSx className={className} styles={rootStyle} sx={sx}>
      {(rootClass) => (
        <div
          role="group"
          {...rest}
          ref={attachRoot}
          className={rootClass}
          data-ui="resizable-panels"
          data-disabled={disabled || undefined}
          data-dragging={dragging !== null || undefined}
        >
          {configs.map((config, index) => (
            <Fragment key={config.value}>
              <PanelContext.Provider
                value={{
                  id: config.id,
                  size: fractions[index]!,
                  collapsed: config.collapsible && (sizes ? sizes[index]! <= EPSILON : layout[index] === 0),
                  repairId: count > 1 ? separatorId(index < count - 1 ? index : index - 1) : undefined,
                }}
              >
                {elements[index]}
              </PanelContext.Provider>
              {index < count - 1 && renderSeparator(index)}
            </Fragment>
          ))}
        </div>
      )}
    </WithSx>
  );
}

ResizablePanelsRoot.displayName = 'ResizablePanels';

function ResizablePanelsPanel({
  ref,
  value: _value,
  minSize: _minSize,
  maxSize: _maxSize,
  collapsible: _collapsible,
  className,
  sx,
  style,
  children,
  ...rest
}: ResizablePanelsPanelProps) {
  const state = useContext(PanelContext);
  if (!state) throw new Error('ResizablePanels.Panel must be rendered inside ResizablePanels.');
  const contentRef = useRef<HTMLDivElement>(null);
  const { collapsed, repairId } = state;

  // Runs after React marks the content inert but before the browser moves focus out of it.
  useLayoutEffect(() => {
    const content = contentRef.current;
    if (!collapsed || !content || !repairId) return;
    const scope = content.getRootNode() as Document | ShadowRoot;
    if (content.contains(scope.activeElement)) scope.getElementById(repairId)?.focus();
  }, [collapsed, repairId]);

  return (
    <WithSx className={className} styles={panelStyle} sx={sx}>
      {(panelClass) => (
        <div
          role="group"
          {...rest}
          ref={ref}
          id={state.id}
          className={panelClass}
          data-ui="resizable-panels-panel"
          data-state={collapsed ? 'collapsed' : 'open'}
          style={{ ...style, [SIZE_VAR]: state.size } as CSSProperties}
        >
          <div
            ref={contentRef}
            css={contentStyle}
            data-ui="resizable-panels-content"
            inert={collapsed}
            aria-hidden={collapsed || undefined}
          >
            {children}
          </div>
        </div>
      )}
    </WithSx>
  );
}

ResizablePanelsPanel.displayName = 'ResizablePanels.Panel';

export const ResizablePanels = Object.assign(ResizablePanelsRoot, { Panel: ResizablePanelsPanel });
