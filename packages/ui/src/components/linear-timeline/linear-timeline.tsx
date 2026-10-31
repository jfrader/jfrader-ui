'use client';

// Semantics: an ordered list of caller-ordered moments. The component never sorts, groups or
// reads time; the caller owns order and identity. Each item renders `opposite`, the axis with its
// marker, and `content` in that DOM order, so a reader meets the date before the story.
// With `content` or `opposite` the axis is decorative (`aria-hidden`). Markers-only (neither
// renderer), `getLabel` names every marker; with `details` the marker is a HoverCard trigger
// (hover, keyboard focus and touch tap show read-only details, one card open at a time),
// otherwise the label is visually hidden text beside a decorative marker.
// Horizontal: one row that never scrolls. The list's inline size divided by `minItemSize` is how
// many items fit; when fewer fit than exist, Previous/Next page a window of that many and a status
// shows the range. Items outside the window stay mounted and `hidden`, so their content keeps its
// state. Before the first measurement (server render, hydration, zero width) every item renders
// and the row wraps.
// Vertical: natural document flow. Every item shows; there is no window and no bounded scroller.
// Focus: a resize keeps the focused item inside the window. A data change that hides the focused
// item moves the window to it; one that removes it continues on the nearest visible marker
// trigger, or on the root when markers are not interactive.
import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ComponentPropsWithRef,
  type ComponentType,
  type CSSProperties,
  type FocusEvent,
  type ReactNode,
  type SyntheticEvent,
} from 'react';
import { useMergeRefs, type Placement } from '@floating-ui/react';
import { ChevronLeft, ChevronRight } from '@jfrader/icons';
import { vars } from '@jfrader/tokens/vars';
import { css, keyframes, type SerializedStyles } from '../../styling/css';
import { focusRingOutset } from '../../styling/focus-ring';
import { FORCED_COLORS, REDUCED_MOTION } from '../../styling/media';
import { withoutSx, type SxProps } from '../../styling/sx';
import { visuallyHiddenStyle } from '../../styling/visually-hidden';
import { numberFormatter } from '../../utils/intl';
import { PresentationSlot, repeatedTemplate, type PresentationProps } from '../../utils/presentation-slot';
import { isRenderable } from '../../utils/renderable';
import { Button, type ButtonProps } from '../button';
import { HoverCard, type HoverCardContentProps, type HoverCardTriggerProps } from '../hover-card';

export type LinearTimelineOrientation = 'horizontal' | 'vertical';
export type LinearTimelineMarkerShape = 'square' | 'dot';
export type LinearTimelineKey = string | number;
/** Renders one part of an item; `index` is the item's zero-based position in `items`. */
export type LinearTimelineRenderer<T> = (item: T, index: number) => ReactNode;

export interface LinearTimelineLabels {
  /** Name of the list when neither `aria-label` nor `aria-labelledby` is given. */
  list: string;
  /** Name of the group holding Previous, the range, and Next. */
  navigation: string;
  previous: string;
  next: string;
  /** Shown instead of the list when `items` is empty. */
  empty: string;
  /** Range status text; positions are one-based and inclusive. */
  range: (first: number, last: number, total: number) => string;
}

type PartProps<E extends 'div' | 'ol' | 'span'> = Omit<PresentationProps<E>, 'children'>;
/** Repeated parts share one props object, so per-element `id` and `ref` are not accepted. */
type RepeatedPartProps<E extends 'li' | 'div' | 'span'> = Omit<PresentationProps<E>, 'children' | 'id' | 'ref'> & {
  id?: never;
  ref?: never;
};
type StepButtonProps = Omit<ButtonProps, 'children' | 'type' | 'render'>;

export interface LinearTimelineSlots {
  /** Replaces the outer `div`. */
  root?: ComponentType<ComponentPropsWithRef<'div'>>;
  /** Replaces the ordered list; render an `ol` and keep the items as its direct children. */
  list?: ComponentType<ComponentPropsWithRef<'ol'>>;
  /** Replaces each list item. */
  item?: ComponentType<ComponentPropsWithRef<'li'>>;
  /** Replaces the box beside the rail that holds `opposite`. */
  opposite?: ComponentType<ComponentPropsWithRef<'div'>>;
  /** Replaces the axis that draws the rail and holds the marker. */
  axis?: ComponentType<ComponentPropsWithRef<'div'>>;
  /** Replaces the marker box. */
  marker?: ComponentType<ComponentPropsWithRef<'span'>>;
  /** Replaces the box beside the rail that holds `content`. */
  content?: ComponentType<ComponentPropsWithRef<'div'>>;
  /** Replaces the markers-only trigger; forward all props and the ref to `HoverCard.Trigger`. */
  trigger?: ComponentType<HoverCardTriggerProps>;
  /** Replaces the markers-only details card; forward all props and the ref to `HoverCard.Content`. */
  details?: ComponentType<HoverCardContentProps>;
  /** Replaces the group holding Previous, the range, and Next. */
  controls?: ComponentType<ComponentPropsWithRef<'div'>>;
  /** Replaces the Previous button; renders `Button` by default. */
  previousButton?: ComponentType<ButtonProps>;
  /** Replaces the Next button; renders `Button` by default. */
  nextButton?: ComponentType<ButtonProps>;
  /** Replaces the status showing which items are in view. */
  range?: ComponentType<ComponentPropsWithRef<'div'>>;
  /** Replaces the message shown when `items` is empty. */
  empty?: ComponentType<ComponentPropsWithRef<'div'>>;
}

export interface LinearTimelineSlotProps {
  /** Props for the outer `div`. */
  root?: PartProps<'div'>;
  /** Ordered list of items. */
  list?: PartProps<'ol'>;
  /** Every list item. */
  item?: Omit<RepeatedPartProps<'li'>, 'hidden' | 'inert' | 'aria-hidden' | 'aria-posinset' | 'aria-setsize'>;
  /** Every box holding `opposite`. */
  opposite?: RepeatedPartProps<'div'>;
  /** Every axis drawing the rail. */
  axis?: RepeatedPartProps<'div'>;
  /** Every marker box. */
  marker?: RepeatedPartProps<'span'>;
  /** Every box holding `content`. */
  content?: RepeatedPartProps<'div'>;
  /** Every markers-only trigger; its accessible name always comes from `getLabel`. */
  trigger?: Omit<HoverCardTriggerProps, 'children' | 'render' | 'id' | 'ref'>;
  /** Every markers-only details card. */
  details?: Omit<HoverCardContentProps, 'children' | 'id' | 'ref'>;
  /** Group holding Previous, the range, and Next. */
  controls?: PartProps<'div'>;
  /** Previous button. */
  previousButton?: StepButtonProps;
  /** Next button. */
  nextButton?: StepButtonProps;
  /** Status showing which items are in view. */
  range?: PartProps<'div'>;
  /** Message shown when `items` is empty. */
  empty?: PartProps<'div'>;
}

interface LinearTimelineBaseProps<T> extends Omit<ComponentPropsWithRef<'div'>, 'children' | 'content'>, SxProps {
  /** Moments in display order. The timeline renders them as given and never sorts or groups them. */
  items: readonly T[];
  /** Lay the rail out in a row or a column. Defaults to `vertical`. */
  orientation?: LinearTimelineOrientation;
  /** Draw each marker as a `square` or `dot`, or render a node per item. Defaults to `square`. */
  marker?: LinearTimelineMarkerShape | LinearTimelineRenderer<NoInfer<T>>;
  /**
   * Set the minimum horizontal item width; numbers are in px. When not all items fit, page the row.
   * Defaults to `12rem`, or the touch-target token for markers-only timelines.
   */
  minItemSize?: CSSProperties['inlineSize'];
  /** Format numbers in the default range label with this locale. */
  locale?: Intl.LocalesArgument;
  /** Override the list name, navigation names, empty message, and range text. */
  labels?: Partial<LinearTimelineLabels>;
  /** Replace the root, list, item parts, and navigation controls. */
  slots?: LinearTimelineSlots;
  /** Pass props and `sx` to the generated parts; repeated parts share one props object. */
  slotProps?: LinearTimelineSlotProps;
  /** Shorthand for `slots.root`; `slots.root` takes precedence. */
  component?: LinearTimelineSlots['root'];
}

interface LinearTimelineContentModeProps<T> {
  /** Render the item's main content beside the rail: below it horizontally, at its inline end vertically. */
  content: LinearTimelineRenderer<NoInfer<T>>;
  /** Render a short label across the rail from `content`, such as a date. */
  opposite?: LinearTimelineRenderer<NoInfer<T>>;
  getLabel?: never;
  details?: never;
}

interface LinearTimelineOppositeModeProps<T> {
  content?: never;
  /** Render a short label beside the rail: above it horizontally, at its inline start vertically. */
  opposite: LinearTimelineRenderer<NoInfer<T>>;
  getLabel?: never;
  details?: never;
}

interface LinearTimelineMarkersModeProps<T> {
  content?: never;
  opposite?: never;
  /** Name each marker in a markers-only timeline. */
  getLabel: (item: NoInfer<T>, index: number) => string;
  /** Render a short, read-only summary on marker hover, keyboard focus, or tap. Keep it free of controls. */
  details?: LinearTimelineRenderer<NoInfer<T>>;
}

type LinearTimelineIdentityProps<T> = [T] extends [{ id: LinearTimelineKey }]
  ? {
      /** Return a stable, unique identity per item. Defaults to `item.id`; required for items without an `id`. */
      getKey?: (item: NoInfer<T>, index: number) => LinearTimelineKey;
    }
  : {
      getKey: (item: NoInfer<T>, index: number) => LinearTimelineKey;
    };

export type LinearTimelineProps<T> = LinearTimelineBaseProps<T> &
  (LinearTimelineContentModeProps<T> | LinearTimelineOppositeModeProps<T> | LinearTimelineMarkersModeProps<T>) &
  LinearTimelineIdentityProps<T>;

interface WindowAnchor {
  /** Identity of the first item in view; survives insertions and removals around it. */
  key: LinearTimelineKey | undefined;
  /** Position used when that identity is gone. */
  index: number;
}

interface FocusRecord {
  element: HTMLElement;
  key: LinearTimelineKey;
  index: number;
}

// Bundlers replace `process.env.NODE_ENV` in consumer builds; library mode leaves it in place.
declare const process: { env: { NODE_ENV?: string } };

const DEFAULT_MIN_ITEM_SIZE = '12rem';
const DEFAULT_MARKER_ITEM_SIZE = vars.size.touch;
const DEFAULT_SHAPE: LinearTimelineMarkerShape = 'square';
/** Sub-pixel slack, so an exact fit is not lost to rounding. */
const FIT_TOLERANCE = 0.001;
const AXIS = '--linear-timeline-axis-size';
const MARKER = '--linear-timeline-marker-size';
const MIN_ITEM = '--linear-timeline-min-item-size';
const COLUMNS = '--linear-timeline-columns';
const NODE_SIZE = '--linear-timeline-node-size';
const HALF_AXIS = `calc(var(${AXIS}) / 2)`;
/** Text starts at the marker's start edge. */
const TEXT_INSET = `calc((var(${AXIS}) - var(${MARKER})) / 2)`;
/** Centers the first line of text on the marker. */
const FIRST_LINE_INSET = `calc((var(${AXIS}) - 1lh) / 2)`;
const RAIL_WIDTH = '1px';
// HoverCard.Trigger owns its `data-ui`, so triggers are found through the item's own axis.
const TRIGGER_SELECTOR = ':scope > [data-ui~="linear-timeline-axis"] > [data-ui~="hover-card-trigger"]';

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), Math.max(min, max));
const joinIds = (...ids: (string | undefined)[]) => ids.filter(Boolean).join(' ') || undefined;

/** Runs the consumer handler first; `preventDefault()` there skips the component's own. */
function chain<E extends SyntheticEvent>(theirs: ((event: E) => void) | undefined, ours: (event: E) => void) {
  return (event: E) => {
    theirs?.(event);
    if (!event.defaultPrevented) ours(event);
  };
}

/** The list's own item holding `node`, skipping items of timelines nested in content. */
function ownItem(list: Element, node: Node | null) {
  let current: Node | null = node;
  while (current && current.parentNode !== list) current = current.parentNode;
  return current instanceof HTMLElement ? current : null;
}

function itemIndex(list: Element, node: Node | null) {
  const item = ownItem(list, node);
  return item ? Array.prototype.indexOf.call(list.children, item) : -1;
}

/** First index of a window of `size` that contains `index`, moving as little as possible from `start`. */
function windowStartFor(index: number, start: number, size: number, count: number) {
  if (index >= start && index < start + size) return start;
  return clamp(index < start ? index : index - size + 1, 0, count - size);
}

function findDuplicates(keys: readonly LinearTimelineKey[]) {
  const seen = new Set<LinearTimelineKey>();
  const duplicates = new Set<LinearTimelineKey>();
  for (const key of keys) (seen.has(key) ? duplicates : seen).add(key);
  return [...duplicates];
}

const fadeIn = keyframes({ from: { opacity: 0 }, to: { opacity: 1 } });

const rootStyle = css({
  label: 'linear-timeline',
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  gap: vars.space[2],
  minInlineSize: 0,
  [AXIS]: `max(${vars.size.controlSm}, var(${NODE_SIZE}, 0px))`,
  [MARKER]: vars.space[2],
  fontFamily: vars.font.sans,
  fontSize: vars.textSize.sm,
  lineHeight: vars.lineHeight.base,
  color: vars.color.text,
  '&:focus-visible': focusRingOutset,
});

const markersRootStyle = css({ [AXIS]: `max(${vars.size.touch}, var(${NODE_SIZE}, 0px))` });

const probeStyle = css({
  position: 'absolute',
  insetBlockStart: 0,
  insetInlineStart: 0,
  inlineSize: `max(var(${MIN_ITEM}), var(${AXIS}))`,
  blockSize: 0,
  visibility: 'hidden',
  pointerEvents: 'none',
});

const listStyle = css({
  display: 'grid',
  minInlineSize: 0,
  margin: 0,
  padding: 0,
  listStyle: 'none',
});

// Grid with subgrid items: the opposite, axis and content tracks line up across every item.
const listStyles: Record<LinearTimelineOrientation, SerializedStyles> = {
  horizontal: css({
    gridTemplateColumns: `repeat(auto-fit, minmax(min(max(var(${MIN_ITEM}), var(${AXIS})), 100%), 1fr))`,
    gridAutoRows: `auto var(${AXIS}) auto`,
    '&[data-windowed]': { gridTemplateColumns: `repeat(var(${COLUMNS}), minmax(0, 1fr))` },
  }),
  vertical: css({ gridTemplateColumns: `fit-content(30%) var(${AXIS}) minmax(0, 1fr)` }),
};

const itemStyle = css({
  display: 'grid',
  minInlineSize: 0,
  '&[hidden]': { display: 'none' },
  '[data-navigated] > &': {
    animationName: fadeIn,
    animationDuration: vars.motion.duration.base,
    animationTimingFunction: vars.motion.easeStandard,
  },
  [REDUCED_MOTION]: { '[data-navigated] > &': { animation: 'none' } },
});

const itemStyles: Record<LinearTimelineOrientation, SerializedStyles> = {
  horizontal: css({ gridRow: 'span 3', gridTemplateRows: 'subgrid' }),
  vertical: css({ gridColumn: '1 / -1', gridTemplateColumns: 'subgrid' }),
};

const textPartStyle = css({ minInlineSize: 0, overflowWrap: 'anywhere' });

const oppositeStyles: Record<LinearTimelineOrientation, SerializedStyles> = {
  horizontal: css({
    gridRow: 1,
    alignSelf: 'end',
    paddingInline: `${TEXT_INSET} ${vars.space[4]}`,
    paddingBlockEnd: vars.space[1],
  }),
  vertical: css({
    gridColumn: 1,
    textAlign: 'end',
    paddingInlineEnd: vars.space[1],
    paddingBlockStart: FIRST_LINE_INSET,
    paddingBlockEnd: vars.space[6],
    '[data-last] > &': { paddingBlockEnd: 0 },
  }),
};

const oppositeStyle = css({ color: vars.color.textMuted, fontVariantNumeric: 'tabular-nums' });

const contentStyles: Record<LinearTimelineOrientation, SerializedStyles> = {
  horizontal: css({
    gridRow: 3,
    paddingInline: `${TEXT_INSET} ${vars.space[4]}`,
    paddingBlock: `${vars.space[1]} ${vars.space[2]}`,
  }),
  vertical: css({
    gridColumn: 3,
    paddingInlineStart: vars.space[1],
    paddingBlockStart: FIRST_LINE_INSET,
    paddingBlockEnd: vars.space[6],
    '[data-last] > &': { paddingBlockEnd: 0 },
  }),
};

// The rail is one line per item behind its marker, cut at the first and last marker centers and
// faded where the window hides more items. Text parts sit in their own tracks, never over it.
const axisStyle = css({
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
  minInlineSize: 0,
  color: vars.color.text,
  '&::before': {
    content: '""',
    position: 'absolute',
    borderStyle: 'solid',
    borderWidth: 0,
    borderColor: vars.color.borderControl,
    pointerEvents: 'none',
  },
  [FORCED_COLORS]: { '&::before': { borderColor: 'CanvasText' } },
});

const fadeMask = (direction: 'right' | 'left', edges: 'start' | 'end' | 'both') => {
  const start = edges === 'end' ? 'currentColor' : 'transparent';
  const end = edges === 'start' ? 'currentColor' : 'transparent';
  return `linear-gradient(to ${direction}, ${start}, currentColor ${HALF_AXIS}, currentColor calc(100% - ${HALF_AXIS}), ${end})`;
};

const axisStyles: Record<LinearTimelineOrientation, SerializedStyles> = {
  horizontal: css({
    gridRow: 2,
    paddingInlineStart: HALF_AXIS,
    '&::before': { insetInline: 0, insetBlockStart: `calc(50% - ${RAIL_WIDTH} / 2)`, borderBlockStartWidth: RAIL_WIDTH },
    '&[data-rail-before="none"]::before': { insetInlineStart: HALF_AXIS },
    '&[data-rail-after="none"]::before': { insetInlineEnd: `calc(100% - ${HALF_AXIS})` },
    '&[data-rail-before="fade"]::before': { maskImage: fadeMask('right', 'start') },
    '&[data-rail-after="fade"]::before': { maskImage: fadeMask('right', 'end') },
    '&[data-rail-before="fade"][data-rail-after="fade"]::before': { maskImage: fadeMask('right', 'both') },
    '&:dir(rtl)[data-rail-before="fade"]::before': { maskImage: fadeMask('left', 'start') },
    '&:dir(rtl)[data-rail-after="fade"]::before': { maskImage: fadeMask('left', 'end') },
    '&:dir(rtl)[data-rail-before="fade"][data-rail-after="fade"]::before': { maskImage: fadeMask('left', 'both') },
  }),
  vertical: css({
    gridColumn: 2,
    flexDirection: 'column',
    paddingBlockStart: HALF_AXIS,
    '&::before': { insetBlock: 0, insetInlineStart: `calc(50% - ${RAIL_WIDTH} / 2)`, borderInlineStartWidth: RAIL_WIDTH },
    '&[data-rail-before="none"]::before': { insetBlockStart: HALF_AXIS },
    '&[data-rail-after="none"]::before': { insetBlockEnd: `calc(100% - ${HALF_AXIS})` },
  }),
};

// The axis padding puts the node's start edge on the marker center; translating back by half
// its own size centers a node of any size there.
const nodeStyles: Record<LinearTimelineOrientation, SerializedStyles> = {
  horizontal: css({ flex: 'none', translate: '-50% 0', '&:dir(rtl)': { translate: '50% 0' } }),
  vertical: css({ flex: 'none', translate: '0 -50%' }),
};

const markerStyle = css({
  position: 'relative',
  flex: 'none',
  boxSizing: 'border-box',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minInlineSize: `var(${MARKER})`,
  minBlockSize: `var(${MARKER})`,
  lineHeight: 1,
  '&[data-kind="square"], &[data-kind="dot"]': {
    inlineSize: `var(${MARKER})`,
    blockSize: `var(${MARKER})`,
    backgroundColor: 'currentColor',
  },
  '&[data-kind="dot"]': { borderRadius: vars.radius.full },
  // Custom nodes sit on a plate so the rail never shows through an outline glyph.
  '&[data-kind="custom"]': { paddingInline: vars.space[1], backgroundColor: vars.color.surface },
  [FORCED_COLORS]: {
    '&[data-kind="square"], &[data-kind="dot"]': { forcedColorAdjust: 'none', backgroundColor: 'CanvasText' },
  },
});

const triggerStyle = css({
  position: 'relative',
  inlineSize: `var(${AXIS})`,
  blockSize: `var(${AXIS})`,
  minInlineSize: 0,
  padding: 0,
  borderColor: 'transparent',
  borderRadius: vars.radius.full,
  backgroundColor: 'transparent',
  '& > [data-ui~="linear-timeline-marker"]:not([data-kind="custom"])': {
    transitionProperty: 'scale',
    transitionDuration: vars.motion.duration.fast,
    transitionTimingFunction: vars.motion.easeStandard,
  },
  '&:hover > [data-ui~="linear-timeline-marker"]:not([data-kind="custom"]), &:focus-visible > [data-ui~="linear-timeline-marker"]:not([data-kind="custom"])': {
    scale: '1.35',
  },
  [REDUCED_MOTION]: { '& > [data-ui~="linear-timeline-marker"]': { transitionDuration: '0s' } },
  [FORCED_COLORS]: { '&:focus-visible': { outlineColor: 'Highlight' } },
});

const controlsStyle = css({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  justifyContent: 'flex-end',
  gap: vars.space[1],
});

const rangeStyle = css({
  paddingInline: vars.space[1],
  fontSize: vars.textSize.xs,
  color: vars.color.textMuted,
  fontVariantNumeric: 'tabular-nums',
  maxInlineSize: '100%',
  overflowWrap: 'anywhere',
});

const stepButtonStyle = css({ inlineSize: vars.size.touch, minBlockSize: vars.size.touch, paddingInline: 0 });

const glyphStyle = css({
  inlineSize: vars.space[4],
  blockSize: vars.space[4],
  '&:dir(rtl)': { transform: 'scaleX(-1)' },
});

const emptyStyle = css({ margin: 0, color: vars.color.textMuted });

function Chevron({ direction }: { direction: 'previous' | 'next' }) {
  const Icon = direction === 'previous' ? ChevronLeft : ChevronRight;
  return <Icon size={16} css={glyphStyle} decorative />;
}

export function LinearTimeline<T>(props: LinearTimelineProps<T>) {
  const {
    ref,
    items,
    getKey,
    orientation = 'vertical',
    marker = DEFAULT_SHAPE,
    content,
    opposite,
    getLabel,
    details,
    minItemSize,
    locale,
    labels: labelProps,
    slots,
    slotProps,
    component,
    className,
    sx,
    style,
    tabIndex,
    onFocus,
    onBlur,
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledBy,
    ...rest
  } = props;
  const Trigger = slots?.trigger ?? HoverCard.Trigger;
  const Details = slots?.details ?? HoverCard.Content;
  const PreviousButton = slots?.previousButton ?? Button;
  const NextButton = slots?.nextButton ?? Button;
  const generatedListId = useId();
  const listId = slotProps?.list?.id ?? generatedListId;
  const numberFormat = useMemo(() => numberFormatter(locale), [locale]);
  const labels: LinearTimelineLabels = {
    list: 'Timeline',
    navigation: 'Timeline pages',
    previous: 'Previous items',
    next: 'Next items',
    empty: 'No items',
    range: (first, last, total) =>
      `${first === last ? numberFormat.format(first) : numberFormat.formatRange(first, last)} of ${numberFormat.format(total)}`,
    ...labelProps,
  };

  const horizontal = orientation === 'horizontal';
  const markersOnly = content === undefined && opposite === undefined;
  const interactive = markersOnly && details !== undefined;
  const count = items.length;
  const keys = items.map((item, index) => getKey?.(item, index) ?? (item as { id?: LinearTimelineKey }).id ?? index);

  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLOListElement>(null);
  const probeRef = useRef<HTMLSpanElement>(null);
  const rootRefs = useMergeRefs([ref, rootRef]);
  const [nodeSize, setNodeSize] = useState(0);
  const measuredNodes = useRef(new WeakMap<HTMLElement, number>());

  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list || typeof marker !== 'function') {
      setNodeSize(0);
      return;
    }
    const nodes = Array.from(list.querySelectorAll<HTMLElement>('[data-ui~="linear-timeline-marker"]'))
      .filter((node) => node.closest('[data-ui~="linear-timeline"]') === rootRef.current);
    const measure = () => {
      for (const node of nodes) {
        const extent = Math.max(node.offsetWidth, node.offsetHeight);
        if (extent > 0) measuredNodes.current.set(node, extent);
      }
      setNodeSize(Math.max(0, ...nodes.map((node) => measuredNodes.current.get(node) ?? 0)));
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [marker, items, interactive]);

  // `null` until measured: the server render and the first client render match, and every item shows.
  const [capacity, setCapacity] = useState<number | null>(null);
  const [anchor, setAnchor] = useState<WindowAnchor>({ key: undefined, index: 0 });
  const [navigated, setNavigated] = useState(false);
  const size = horizontal && capacity !== null ? Math.min(capacity, count) : count;
  const windowed = size < count;
  const anchorIndex = anchor.key === undefined ? -1 : keys.indexOf(anchor.key);
  const start = windowed ? clamp(anchorIndex >= 0 ? anchorIndex : anchor.index, 0, count - size) : 0;
  const end = start + size;
  const moveTo = (index: number) => setAnchor({ key: keys[index], index });

  // Read by the resize observer, which outlives renders.
  const latest = useRef({ start, keys, count });
  useLayoutEffect(() => {
    latest.current = { start, keys, count };
  });

  const hasItems = count > 0;
  useLayoutEffect(() => {
    const list = listRef.current;
    const probe = probeRef.current;
    if (!horizontal || !list || !probe) return;
    const measure = () => {
      const width = list.getBoundingClientRect().width;
      // Zero width (hidden ancestor, detached frame): keep the last good measurement.
      if (width <= 0) return;
      const min = probe.getBoundingClientRect().width;
      const next = min > 0 ? Math.max(1, Math.floor(width / min + FIT_TOLERANCE)) : Number.POSITIVE_INFINITY;
      setCapacity(next);
      const { start: current, keys: currentKeys, count: total } = latest.current;
      const nextSize = Math.min(next, total);
      const focused = itemIndex(list, list.ownerDocument.activeElement);
      if (focused < 0 || nextSize >= total) return;
      const target = windowStartFor(focused, current, nextSize, total);
      if (target !== current) setAnchor({ key: currentKeys[target], index: target });
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(list);
    observer.observe(probe);
    return () => observer.disconnect();
  }, [horizontal, hasItems]);

  // HoverCard placement is physical; vertical cards open toward the inline end.
  const [rtl, setRtl] = useState(false);
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!interactive || horizontal || !root) return;
    setRtl(getComputedStyle(root).direction === 'rtl');
  }, [interactive, horizontal]);
  const placement: Placement = horizontal ? 'bottom' : rtl ? 'left-start' : 'right-start';

  const valueOf = (key: LinearTimelineKey) => JSON.stringify(key);
  const [openValue, setOpenValue] = useState<string | null>(null);
  const openIndex = openValue === null ? -1 : keys.findIndex((key) => valueOf(key) === openValue);
  // A card whose marker left the window, or whose item is gone, closes and stays closed.
  if (openValue !== null && (openIndex < start || openIndex >= end)) setOpenValue(null);

  const page = (direction: 1 | -1) => {
    const target = clamp(start + direction * size, 0, count - size);
    if (target === start) return;
    setNavigated(true);
    setOpenValue(null);
    moveTo(target);
  };

  const lastFocus = useRef<FocusRecord | null>(null);
  const controlFocus = useRef<HTMLElement | null>(null);
  const pendingFocus = useRef<HTMLElement | null>(null);
  const handleFocus = (event: FocusEvent<HTMLDivElement>) => {
    (slotProps?.root?.onFocus ?? onFocus)?.(event);
    const list = listRef.current;
    const index = list ? itemIndex(list, event.target) : -1;
    controlFocus.current = index < 0 && event.target.closest('[data-ui~="linear-timeline-controls"]') ? event.target : null;
    lastFocus.current = index < 0 ? null : { element: event.target, key: keys[index]!, index };
  };
  // Focus moving elsewhere forgets the item; focus dropping to the body keeps it for recovery.
  const handleBlur = (event: FocusEvent<HTMLDivElement>) => {
    (slotProps?.root?.onBlur ?? onBlur)?.(event);
    const next = event.relatedTarget;
    if (next !== null && !event.currentTarget.contains(next)) {
      lastFocus.current = null;
      controlFocus.current = null;
    }
  };

  useLayoutEffect(() => {
    const root = rootRef.current;
    const list = listRef.current;
    if (!root) return;
    if (controlFocus.current && !controlFocus.current.isConnected) {
      controlFocus.current = null;
      const active = root.ownerDocument.activeElement;
      if (active === null || active === root.ownerDocument.body) root.focus({ preventScroll: true });
    }
    const inHiddenItem = (element: HTMLElement) => (list ? ownItem(list, element)?.hidden ?? true : true);
    const pending = pendingFocus.current;
    if (pending) {
      pendingFocus.current = null;
      if (pending.isConnected && !inHiddenItem(pending)) pending.focus({ preventScroll: true });
      return;
    }
    const record = lastFocus.current;
    if (!record) return;
    const { element } = record;
    const connected = element.isConnected;
    if (connected && !inHiddenItem(element)) return;
    const document = root.ownerDocument;
    const active = document.activeElement;
    if (active !== null && active !== document.body && active !== element) return;
    const index = connected ? keys.indexOf(record.key) : -1;
    const target = index >= 0 && windowed ? windowStartFor(index, start, size, count) : start;
    if (target !== start) {
      pendingFocus.current = element;
      moveTo(target);
      return;
    }
    lastFocus.current = null;
    const triggers = list
      ? Array.from(list.children).flatMap((item, position) => {
          const trigger = (item as HTMLElement).hidden ? null : item.querySelector<HTMLElement>(TRIGGER_SELECTOR);
          return trigger ? [{ trigger, distance: Math.abs(position - record.index) }] : [];
        })
      : [];
    triggers.sort((a, b) => a.distance - b.distance);
    (triggers[0]?.trigger ?? root).focus({ preventScroll: true });
  });

  // Development diagnostics: identities must be unique and present.
  const duplicates = findDuplicates(keys);
  const missingKey = !getKey && items.some((item) => (item as { id?: LinearTimelineKey } | null)?.id === undefined);
  const diagnostics = [
    ...(duplicates.length > 0 ? [`LinearTimeline: duplicate item keys ${JSON.stringify(duplicates)}.`] : []),
    ...(missingKey ? ['LinearTimeline: items without an `id` need `getKey`; falling back to positions.'] : []),
  ].join('\n');
  useEffect(() => {
    if (process.env.NODE_ENV === 'production' || diagnostics === '') return;
    console.error(diagnostics);
  }, [diagnostics]);

  const minItem = minItemSize ?? (markersOnly ? DEFAULT_MARKER_ITEM_SIZE : DEFAULT_MIN_ITEM_SIZE);
  const rootStyleVars = {
    ...style,
    [NODE_SIZE]: `${nodeSize}px`,
    [MIN_ITEM]: typeof minItem === 'number' ? `${minItem}px` : minItem,
  } as CSSProperties;
  const itemSlot = repeatedTemplate(slotProps?.item);
  const oppositeSlot = repeatedTemplate(slotProps?.opposite);
  const axisSlot = repeatedTemplate(slotProps?.axis);
  const markerSlot = repeatedTemplate(slotProps?.marker);
  const contentSlot = repeatedTemplate(slotProps?.content);
  const { trigger: triggerSlot, details: detailsSlot, previousButton: previousSlot, nextButton: nextSlot } = slotProps ?? {};

  const renderMarker = (item: T, index: number) => {
    const custom = typeof marker === 'function' ? marker(item, index) : undefined;
    const shape = typeof marker === 'function' ? (isRenderable(custom) ? undefined : DEFAULT_SHAPE) : marker;
    return (
      <PresentationSlot
        element="span"
        component={slots?.marker}
        slotProps={markerSlot}
        aria-hidden="true"
        data-ui="linear-timeline-marker"
        data-kind={shape ?? 'custom'}
        styles={[markerStyle, !interactive && nodeStyles[orientation]]}
      >
        {shape ? null : custom}
      </PresentationSlot>
    );
  };

  const renderItem = (item: T, index: number) => {
    const key = keys[index]!;
    const visible = index >= start && index < end;
    const first = index === start;
    const last = index === end - 1;
    const oppositeNode = opposite?.(item, index);
    const contentNode = content?.(item, index);
    const label = getLabel?.(item, index);
    let axisChildren: ReactNode = renderMarker(item, index);
    if (interactive) {
      axisChildren = (
        <HoverCard
          open={openValue === valueOf(key)}
          onOpenChange={(open) => setOpenValue((current) => {
            if (open) return valueOf(key);
            return current === valueOf(key) ? null : current;
          })}
          placement={placement}
        >
          <Trigger
            {...withoutSx(triggerSlot)}
            aria-label={label}
            css={[triggerStyle, nodeStyles[orientation]]}
            sx={triggerSlot?.sx}
          >
            {axisChildren}
          </Trigger>
          <Details {...withoutSx(detailsSlot)} sx={detailsSlot?.sx}>
            {details?.(item, index)}
          </Details>
        </HoverCard>
      );
    } else if (markersOnly) {
      axisChildren = (
        <>
          {axisChildren}
          <span css={visuallyHiddenStyle}>{label}</span>
        </>
      );
    }

    return (
      <PresentationSlot
        key={key}
        element="li"
        component={slots?.item}
        slotProps={{ ...itemSlot, hidden: !visible || undefined, 'aria-posinset': windowed ? index + 1 : undefined, 'aria-setsize': windowed ? count : undefined }}
        hidden={!visible || undefined}
        aria-posinset={windowed ? index + 1 : undefined}
        aria-setsize={windowed ? count : undefined}
        data-ui="linear-timeline-item"
        data-first={first ? '' : undefined}
        data-last={last ? '' : undefined}
        styles={[itemStyle, itemStyles[orientation]]}
      >
        {isRenderable(oppositeNode) ? (
          <PresentationSlot
            element="div"
            component={slots?.opposite}
            slotProps={oppositeSlot}
            data-ui="linear-timeline-opposite"
            styles={[textPartStyle, oppositeStyle, oppositeStyles[orientation]]}
          >
            {oppositeNode}
          </PresentationSlot>
        ) : null}
        <PresentationSlot
          element="div"
          component={slots?.axis}
          slotProps={axisSlot}
          aria-hidden={markersOnly ? undefined : true}
          data-ui="linear-timeline-axis"
          data-rail-before={first ? (start > 0 ? 'fade' : 'none') : undefined}
          data-rail-after={last ? (end < count ? 'fade' : 'none') : undefined}
          styles={[axisStyle, axisStyles[orientation]]}
        >
          {axisChildren}
        </PresentationSlot>
        {isRenderable(contentNode) ? (
          <PresentationSlot
            element="div"
            component={slots?.content}
            slotProps={contentSlot}
            data-ui="linear-timeline-content"
            styles={[textPartStyle, contentStyles[orientation]]}
          >
            {contentNode}
          </PresentationSlot>
        ) : null}
      </PresentationSlot>
    );
  };

  const list = (
    <PresentationSlot
      element="ol"
      component={slots?.list}
      slotProps={slotProps?.list}
      ref={listRef}
      id={listId}
      aria-label={ariaLabel ?? (ariaLabelledBy || slotProps?.list?.['aria-labelledby'] ? undefined : labels.list)}
      aria-labelledby={ariaLabelledBy}
      data-ui="linear-timeline-list"
      data-windowed={windowed ? '' : undefined}
      data-navigated={navigated ? '' : undefined}
      style={windowed ? ({ [COLUMNS]: size } as CSSProperties) : undefined}
      styles={[listStyle, listStyles[orientation]]}
    >
      {items.map(renderItem)}
    </PresentationSlot>
  );

  return (
    <PresentationSlot
      element="div"
      component={slots?.root ?? component}
      slotProps={{ ...slotProps?.root, onFocus: handleFocus, onBlur: handleBlur }}
      styles={[rootStyle, markersOnly && markersRootStyle]}
      sx={sx}
      {...rest}
      ref={rootRefs}
      tabIndex={tabIndex ?? -1}
      style={rootStyleVars}
      data-orientation={orientation}
      marker="linear-timeline"
      className={className}
    >
      {horizontal ? <span ref={probeRef} aria-hidden="true" data-ui="linear-timeline-probe" css={probeStyle} /> : null}
      {hasItems ? (
        list
      ) : (
        <PresentationSlot
          element="div"
          component={slots?.empty}
          slotProps={slotProps?.empty}
          data-ui="linear-timeline-empty"
          styles={emptyStyle}
        >
          {labels.empty}
        </PresentationSlot>
      )}
      {windowed ? (
        <PresentationSlot
          element="div"
          component={slots?.controls}
          slotProps={slotProps?.controls}
          role="group"
          aria-label={labels.navigation}
          data-ui="linear-timeline-controls"
          styles={controlsStyle}
        >
          <PreviousButton
            size="sm"
            variant="ghost"
            {...withoutSx(previousSlot)}
            css={stepButtonStyle}
            sx={previousSlot?.sx}
            data-ui="linear-timeline-previous"
            aria-label={previousSlot?.['aria-label'] ?? labels.previous}
            aria-controls={joinIds(listId, previousSlot?.['aria-controls'])}
            aria-disabled={start === 0 || undefined}
            onClick={chain(previousSlot?.onClick, () => page(-1))}
          >
            <Chevron direction="previous" />
          </PreviousButton>
          <PresentationSlot
            element="div"
            component={slots?.range}
            slotProps={slotProps?.range}
            role="status"
            dir="auto"
            aria-atomic="true"
            data-ui="linear-timeline-range"
            styles={rangeStyle}
          >
            {labels.range(start + 1, end, count)}
          </PresentationSlot>
          <NextButton
            size="sm"
            variant="ghost"
            {...withoutSx(nextSlot)}
            css={stepButtonStyle}
            sx={nextSlot?.sx}
            data-ui="linear-timeline-next"
            aria-label={nextSlot?.['aria-label'] ?? labels.next}
            aria-controls={joinIds(listId, nextSlot?.['aria-controls'])}
            aria-disabled={end >= count || undefined}
            onClick={chain(nextSlot?.onClick, () => page(1))}
          >
            <Chevron direction="next" />
          </NextButton>
        </PresentationSlot>
      ) : null}
    </PresentationSlot>
  );
}

LinearTimeline.displayName = 'LinearTimeline';
