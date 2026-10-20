import { withoutSx } from '../../styling/sx';
'use client';

// Semantics: a named `region` holding one group per local calendar day, labelled by a real day
// heading (`headingLevel`, default h3) and listing its events in an ordered list. Events are always
// shown newest first; equal timestamps keep their input order and events with unusable dates trail
// in their own group.
// No feed/accordion role: rows are plain list items, and an event with `detail` turns its title
// into a native disclosure button (`aria-expanded`/`aria-controls`) whose panel stays mounted and
// `hidden` while collapsed.
// Keyboard map: Tab/Shift+Tab follow DOM order through disclosure buttons and open detail content;
// Enter/Space toggle natively; ArrowDown/ArrowUp on a disclosure move to the next/previous
// expandable event across day groups and clamp at the ends; Home/End jump to the first/last.
// Keys from detail content are never handled.
// Clock: the caller owns `now` (epoch ms, ticked about once a minute); the component keeps no timer.
// Day grouping compares calendar dates in `timeZone`, so 23/25-hour DST days group correctly.
// Updates: new rows never take focus; while the reader is in history (scrolled or focused inside the
// bounded scroller) the visible row keeps its position. `scrollToNew` opts into scrolling to a newer
// event. Genuinely new ids are announced through a text-only status region.
import {
  type ComponentType,
  type ComponentProps,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ComponentPropsWithRef,
  type CSSProperties,
  type FocusEvent,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { useMergeRefs } from '@floating-ui/react';
import { vars } from '@jfrader/tokens/vars';
import { css, keyframes, type Interpolation, type SerializedStyles, type Theme } from '../../styling/css';
import { disclosureCaret } from '../../styling/disclosure-caret';
import { focusRingInset } from '../../styling/focus-ring';
import { iconWrapperStyle } from '../../styling/icon-wrapper';
import { FORCED_COLORS, REDUCED_MOTION } from '../../styling/media';
import type { SxProps } from '../../styling/sx';
import { PresentationSlot, type PresentationProps } from '../../utils/presentation-slot';
import { visuallyHiddenStyle } from '../../styling/visually-hidden';
import {
  DEFAULT_TIME_ZONE,
  dateTimeFormatter,
  numberFormatter,
  relativeTimeFormatter,
  resolveTimeOptions,
  toEpoch,
  validEpoch,
} from '../../utils/intl';
import { partId } from '../../utils/part-id';
import { isRenderable } from '../../utils/renderable';
import { queryOwnedItems, type OwnedItemsQuery } from '../../utils/roving-focus';
import { useControlledState } from '../../utils/use-controlled-state';
import { Avatar } from '../avatar';

export type TimelineTone = 'neutral' | 'success' | 'danger';
export type TimelineSize = 'sm' | 'md';
export type TimelineHeadingLevel = 2 | 3 | 4 | 5 | 6;

export interface TimelineEvent {
  /** Unique, stable identity across updates. */
  id: string;
  /** Epoch ms, a Date, or an ISO date-time with `Z` or an explicit offset. */
  at: string | number | Date;
  /** Who acted; shown as text next to the title. */
  actor?: string;
  /** Outcome text, such as "Deploy failed", to show state alongside tone. */
  title: ReactNode;
  meta?: ReactNode;
  /** Panel content. Makes the title a disclosure button; 0 counts as content, false/null/'' do not. */
  detail?: ReactNode;
  /** Actor portrait URL; takes precedence over `icon`. */
  avatar?: string;
  icon?: ReactNode;
  tone?: TimelineTone;
}

export interface TimelineLabels {
  /** Region name when neither `aria-label` nor `aria-labelledby` is given. */
  region: string;
  empty: string;
  /** Heading of the trailing group for events whose date cannot be read. */
  invalidTime: string;
  /** Announced when events with new ids arrive. */
  newEvents: (count: number) => string;
  /** Event count shown beside each day heading. */
  dayCount: (count: number) => string;
}

export interface TimelinePartProps {
  className?: string;
  sx?: Interpolation<Theme>;
}
export interface TimelineSlots {
  /** Replaces the outer div; forwards its props, ref and className. */
  root?: ComponentType<ComponentPropsWithRef<'div'>>;
  /** Scrollable container holding the day groups. */
  scroller?: ComponentType<ComponentPropsWithRef<'div'> & TimelinePartProps>;
  /** Section containing one day of events. */
  group?: ComponentType<ComponentPropsWithRef<'section'> & TimelinePartProps>;
  /** Heading naming a day group. */
  heading?: ComponentType<ComponentPropsWithRef<'h3'> & TimelinePartProps>;
  /** Ordered list of events. */
  list?: ComponentType<ComponentPropsWithRef<'ol'> & TimelinePartProps>;
  /** List item containing one event. */
  item?: ComponentType<ComponentPropsWithRef<'li'> & TimelinePartProps>;
  /** Decorative event marker. */
  marker?: ComponentType<ComponentPropsWithRef<'span'> & TimelinePartProps>;
  /** Button expanding event details. */
  trigger?: ComponentType<ComponentPropsWithRef<'button'> & TimelinePartProps>;
  /** Timestamp of an event. */
  time?: ComponentType<ComponentPropsWithRef<'time'> & TimelinePartProps>;
  /** Collapsible event details. */
  detail?: ComponentType<ComponentPropsWithRef<'div'> & TimelinePartProps>;
  /** Live region announcing timeline updates. */
  status?: ComponentType<ComponentPropsWithRef<'div'> & TimelinePartProps>;
}

export type TimelineSlotProps = {
  [Part in Exclude<keyof TimelineSlots, 'root'>]?: ComponentProps<NonNullable<TimelineSlots[Part]>>;
} & {
  /** Props for the outer div. */
  root?: Omit<PresentationProps<'div'>, 'children'>;
};

export interface TimelineProps
  extends Omit<ComponentPropsWithRef<'div'>, 'defaultValue' | 'onChange' | 'children'>,
    SxProps {
  /** Caller-owned events in any order; the component sorts a copy. */
  events: readonly TimelineEvent[];
  /** Reference instant in epoch ms. Pass the same value on server and client. */
  now: number;
  /** Ids of events whose detail is open (controlled). */
  value?: readonly string[];
  defaultValue?: readonly string[];
  /** Requested open ids after a disclosure interaction. */
  onValueChange?: (ids: string[]) => void;
  /** Formatting locale. Supply one so server and client output match. */
  locale?: Intl.LocalesArgument;
  /** IANA zone used for day grouping and every displayed date. */
  timeZone?: string;
  headingLevel?: TimelineHeadingLevel;
  /** Height limit for the timeline's scroller. Without it, the timeline grows with the page. */
  maxHeight?: CSSProperties['maxHeight'];
  /** Scroll to an event newer than any shown before. Never moves focus. */
  scrollToNew?: boolean;
  size?: TimelineSize;
  labels?: Partial<TimelineLabels>;
  slotProps?: TimelineSlotProps;
  slots?: TimelineSlots;
  /** Shorthand for slots.root; slots.root takes precedence. */
  component?: TimelineSlots['root'];
}

interface Row {
  event: TimelineEvent;
  order: number;
  epoch: number | null;
}

interface DayGroup {
  key: string;
  /** Days from `now`'s calendar date in the configured zone; null for invalid or unknown. */
  distance: number | null;
  epoch: number | null;
  rows: Row[];
}

interface Formatters {
  dayParts: Intl.DateTimeFormat;
  day: Intl.DateTimeFormat;
  full: Intl.DateTimeFormat;
  clock: Intl.DateTimeFormat;
  relative: Intl.RelativeTimeFormat;
  number: Intl.NumberFormat;
  plural: Intl.PluralRules;
}

interface Anchor {
  id: string;
  top: number;
}

// Bundlers replace `process.env.NODE_ENV` in consumer builds; library mode leaves it in place.
declare const process: { env: { NODE_ENV?: string } };

const INVALID_GROUP_KEY = 'invalid';
const EMPTY_IDS: readonly string[] = [];
const MS_PER_SECOND = 1000;
const MS_PER_DAY = 86_400_000;
/** Same-day relative steps: each unit is used while its magnitude stays below the limit. */
const RELATIVE_STEPS: readonly (readonly [Intl.RelativeTimeFormatUnit, number])[] = [
  ['second', 60],
  ['minute', 60],
  ['hour', 24],
];
/** Machine day keys stay Gregorian with Latin digits whatever the display locale. */
const DAY_KEY_LOCALE = 'en-US';
const ITEM_QUERY: OwnedItemsQuery = { itemSelector: '[data-ui="timeline-item"]', ownerSelector: '[data-ui~="timeline"]' };
const TRIGGER_QUERY: OwnedItemsQuery = {
  itemSelector: '[data-ui="timeline-trigger"]',
  ownerSelector: '[data-ui~="timeline"]',
};
const KEY_TARGETS: Partial<Record<string, (index: number, count: number) => number>> = {
  ArrowDown: (index, count) => Math.min(index + 1, count - 1),
  ArrowUp: (index) => Math.max(index - 1, 0),
  Home: () => 0,
  End: (_index, count) => count - 1,
};

/** Empty strings render nothing, so they count as absent like false/null; 0 is content. */
const hasContent = (node: ReactNode) => isRenderable(node) && node !== '';

function createFormatters(locale: Intl.LocalesArgument, timeZone: string): Formatters {
  return {
    dayParts: dateTimeFormatter(DAY_KEY_LOCALE, {
      timeZone,
      calendar: 'gregory',
      numberingSystem: 'latn',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }),
    day: dateTimeFormatter(locale, { timeZone, dateStyle: 'full' }),
    full: dateTimeFormatter(locale, { timeZone, dateStyle: 'full', timeStyle: 'long' }),
    clock: dateTimeFormatter(locale, { timeZone, timeStyle: 'short' }),
    relative: relativeTimeFormatter(locale),
    number: numberFormatter(locale),
    plural: new Intl.PluralRules(locale),
  };
}

/** Formatters for the requested locale and zone; unusable values fall back and are reported. */
function resolveFormatters(locale: Intl.LocalesArgument, timeZone: string) {
  const resolved = resolveTimeOptions('Timeline', locale, timeZone);
  return { formatters: createFormatters(resolved.locale, resolved.timeZone), problems: resolved.problems };
}

/** ISO calendar date (`YYYY-MM-DD`) of `epoch` in the formatter's zone. */
function dayKey(format: Intl.DateTimeFormat, epoch: number) {
  const parts = Object.fromEntries(format.formatToParts(epoch).map(({ type, value }) => [type, value]));
  return `${parts.year!.padStart(4, '0')}-${parts.month}-${parts.day}`;
}

/** Whole days between two ISO calendar dates, independent of how long those days were. */
const dayOrdinal = (key: string) => Date.parse(`${key}T00:00:00Z`) / MS_PER_DAY;

function buildGroups(events: readonly TimelineEvent[], format: Intl.DateTimeFormat, now: number | null): DayGroup[] {
  const rows = events.map((event, order): Row => ({ event, order, epoch: toEpoch(event.at) }));
  rows.sort((a, b) => {
    if (a.epoch === null || b.epoch === null) return a.epoch === b.epoch ? a.order - b.order : a.epoch === null ? 1 : -1;
    return b.epoch - a.epoch || a.order - b.order;
  });
  const nowOrdinal = now === null ? null : dayOrdinal(dayKey(format, now));
  const groups: DayGroup[] = [];
  for (const row of rows) {
    const key = row.epoch === null ? INVALID_GROUP_KEY : dayKey(format, row.epoch);
    const last = groups.at(-1);
    if (last?.key === key) {
      last.rows.push(row);
      continue;
    }
    const distance = row.epoch === null || nowOrdinal === null ? null : dayOrdinal(key) - nowOrdinal;
    groups.push({ key, distance, epoch: row.epoch, rows: [row] });
  }
  return groups;
}

function findDuplicates(ids: readonly string[]) {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const id of ids) (seen.has(id) ? duplicates : seen).add(id);
  return [...duplicates];
}

/** Order- and repeat-insensitive identity of an id set. */
const idSetKey = (ids: readonly string[]) => JSON.stringify([...new Set(ids)].sort());

function relativeTime(epoch: number, now: number, distance: number, format: Formatters) {
  let value = (epoch - now) / MS_PER_SECOND;
  for (const [unit, limit] of RELATIVE_STEPS) {
    if (Math.abs(value) < limit) return format.relative.format(Math.trunc(value), unit);
    value /= limit;
  }
  // A day or more away: count calendar days, matching the day heading.
  return format.relative.format(distance, 'day');
}

function dayHeading(group: DayGroup, format: Formatters, labels: TimelineLabels) {
  if (group.epoch === null) return labels.invalidTime;
  if (group.distance !== null && Math.abs(group.distance) <= 1) return format.relative.format(group.distance, 'day');
  return format.day.format(group.epoch);
}

function defaultLabels(format: Formatters): TimelineLabels {
  const count = (n: number, one: string, other: string) =>
    `${format.number.format(n)} ${format.plural.select(n) === 'one' ? one : other}`;
  return {
    region: 'Activity',
    empty: 'No activity yet',
    invalidTime: 'Unknown time',
    newEvents: (n) => count(n, 'new event', 'new events'),
    dayCount: (n) => count(n, 'event', 'events'),
  };
}

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
const isReducedMotion = (element: Element) =>
  element.ownerDocument.defaultView?.matchMedia(REDUCED_MOTION_QUERY).matches ?? false;

const fadeIn = keyframes({ from: { opacity: 0 }, to: { opacity: 1 } });

const rootStyle = css({
  position: 'relative',
  minInlineSize: 0,
  fontFamily: vars.font.sans,
  fontSize: vars.textSize.sm,
  lineHeight: vars.lineHeight.base,
  color: vars.color.text,
});

// Per-size spacing as custom properties read by the parts.
const sizeStyles: Record<TimelineSize, SerializedStyles> = {
  sm: css({
    '--timeline-row-gap': vars.space[2],
    '--timeline-heading-pad': vars.space[1],
    '--timeline-trigger-pad': vars.space[1],
  }),
  md: css({
    '--timeline-row-gap': vars.space[4],
    '--timeline-heading-pad': vars.space[2],
    '--timeline-trigger-pad': vars.space[2],
  }),
};

const scrollerStyle = css({
  '&[data-bounded]': {
    overflowY: 'auto',
    overscrollBehavior: 'contain',
    // Anchoring is done by the component, so the browser's own adjustment must not add to it.
    overflowAnchor: 'none',
    // Keeps a focused or scrolled-to row clear of the sticky day heading.
    scrollPaddingBlockStart: vars.space[10],
  },
  '&:focus-visible': { ...focusRingInset },
});

const groupStyle = css({
  '& + &': { marginBlockStart: 'var(--timeline-row-gap)' },
});

const headingStyle = css({
  position: 'sticky',
  insetBlockStart: 0,
  zIndex: 1,
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'baseline',
  columnGap: vars.space[2],
  margin: 0,
  marginBlockEnd: vars.space[2],
  paddingBlock: 'var(--timeline-heading-pad)',
  backgroundColor: vars.color.surface,
  fontSize: vars.textSize.sm,
  fontWeight: vars.fontWeight.semibold,
  color: vars.color.text,
});

const dayCountStyle = css({
  fontSize: vars.textSize.xs,
  fontWeight: vars.fontWeight.regular,
  color: vars.color.textMuted,
});

const listStyle = css({
  listStyle: 'none',
  margin: 0,
  padding: 0,
});

const itemStyle = css({
  position: 'relative',
  display: 'grid',
  gridTemplateColumns: `${vars.space[6]} minmax(0, 1fr)`,
  columnGap: vars.space[3],
  paddingBlockEnd: 'var(--timeline-row-gap)',
  // Rail joining this marker to the next one; drawn with a border so forced colors keep it.
  '&::before': {
    content: '""',
    position: 'absolute',
    insetBlockStart: vars.space[6],
    insetBlockEnd: 0,
    insetInlineStart: `calc(${vars.space[6]} / 2 - 1px)`,
    borderInlineStart: `2px solid ${vars.color.border}`,
  },
  '&:last-child::before': { content: 'none' },
  '&[data-new]': {
    animationName: fadeIn,
    animationDuration: vars.motion.duration.base,
    animationTimingFunction: vars.motion.easeStandard,
  },
  [REDUCED_MOTION]: { '&[data-new]': { animation: 'none' } },
  [FORCED_COLORS]: { '&::before': { borderInlineStartColor: 'GrayText' } },
});

const markerStyle = css({
  boxSizing: 'border-box',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  inlineSize: vars.space[6],
  blockSize: vars.space[6],
  borderRadius: vars.radius.full,
  border: `1px solid ${vars.color.borderStrong}`,
  backgroundColor: vars.color.surface,
  color: vars.color.textMuted,
  overflow: 'hidden',
  fontSize: vars.textSize.xs,
  '&[data-kind="avatar"]': { border: 0 },
  [FORCED_COLORS]: { borderColor: 'CanvasText', color: 'CanvasText' },
});

const markerToneStyles: Record<TimelineTone, SerializedStyles> = {
  neutral: css({}),
  success: css({ borderColor: vars.color.success, color: vars.color.success }),
  danger: css({ borderColor: vars.color.dangerText, color: vars.color.dangerText }),
};

const markerDotStyle = css({
  inlineSize: vars.space[2],
  blockSize: vars.space[2],
  borderRadius: vars.radius.full,
  backgroundColor: 'currentColor',
  [FORCED_COLORS]: { backgroundColor: 'CanvasText', forcedColorAdjust: 'none' },
});

const bodyStyle = css({
  minInlineSize: 0,
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'baseline',
  columnGap: vars.space[3],
  rowGap: vars.space[1],
});

// Short content leaves room for the time on the same line; long content takes the whole line and
// the time wraps below it instead of squeezing the disclosure target.
const contentStyle = css({
  flex: '1 1 0',
  minInlineSize: 'fit-content',
  maxInlineSize: '100%',
  display: 'grid',
  rowGap: vars.space[1],
  overflowWrap: 'anywhere',
});

const titleLineStyle = css({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'baseline',
  columnGap: vars.space[1],
  minBlockSize: vars.space[6],
});

const actorStyle = css({ fontWeight: vars.fontWeight.semibold });

const titleStyle = css({ fontWeight: vars.fontWeight.medium });

const triggerStyle = css({
  appearance: 'none',
  boxSizing: 'border-box',
  display: 'inline-flex',
  alignItems: 'center',
  gap: vars.space[2],
  maxInlineSize: '100%',
  minBlockSize: vars.space[8],
  margin: 0,
  paddingBlock: vars.space[1],
  paddingInline: 'var(--timeline-trigger-pad)',
  // Transparent border becomes the button boundary in forced colors.
  border: '1px solid transparent',
  borderRadius: vars.radius.sm,
  background: 'transparent',
  font: 'inherit',
  fontWeight: vars.fontWeight.medium,
  color: vars.color.text,
  textAlign: 'start',
  overflowWrap: 'anywhere',
  cursor: 'pointer',
  transitionProperty: 'background-color',
  transitionDuration: vars.motion.duration.fast,
  transitionTimingFunction: vars.motion.easeStandard,
  '&::after': { ...disclosureCaret, transitionDuration: vars.motion.duration.fast },
  '&[aria-expanded="true"]::after': { transform: 'rotate(90deg)' },
  // The caret points toward inline-end, so under RTL it turns the other way to point down.
  '&[aria-expanded="true"]:dir(rtl)::after': { transform: 'rotate(-90deg)' },
  '&:hover': { backgroundColor: vars.color.surfaceHover },
  '&:focus-visible': { ...focusRingInset },
  [REDUCED_MOTION]: { transitionDuration: '0s', '&::after': { transitionDuration: '0s' } },
  [FORCED_COLORS]: {
    '&:focus-visible': { outlineColor: 'Highlight' },
    '&::after': { forcedColorAdjust: 'none', color: 'ButtonText' },
  },
});

const metaStyle = css({
  fontSize: vars.textSize.xs,
  color: vars.color.textMuted,
});

const timeStyle = css({
  flexShrink: 0,
  fontSize: vars.textSize.xs,
  color: vars.color.textMuted,
  fontVariantNumeric: 'tabular-nums',
  whiteSpace: 'nowrap',
});

const detailStyle = css({
  gridColumn: 2,
  marginBlockStart: vars.space[2],
  paddingBlock: vars.space[3],
  paddingInline: vars.space[3],
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.md,
  backgroundColor: vars.color.surface,
  color: vars.color.text,
  lineHeight: vars.lineHeight.relaxed,
  overflowWrap: 'anywhere',
  '&[hidden]': { display: 'none' },
});

const emptyStyle = css({
  margin: 0,
  paddingBlock: vars.space[4],
  color: vars.color.textMuted,
});

function TimelineMarker({ event, part, component: Marker = 'span' }: { event: TimelineEvent; part?: TimelineSlotProps['marker']; component?: TimelineSlots['marker'] | 'span' }) {
  const tone = event.tone ?? 'neutral';
  const kind = event.avatar ? 'avatar' : hasContent(event.icon) ? 'icon' : event.actor ? 'avatar' : 'dot';
  const content = {
    avatar: <Avatar name={event.actor ?? ''} src={event.avatar} size="sm" />,
    icon: <span css={iconWrapperStyle}>{event.icon}</span>,
    dot: <span css={markerDotStyle} />,
  }[kind];
  // The adjacent actor and title text identify the event; the marker only decorates it.
  return (
    <Marker
      {...withoutSx(part)}
      aria-hidden="true"
      data-ui="timeline-marker"
      data-kind={kind}
      data-tone={tone}
      className={part?.className}
      css={[markerStyle, markerToneStyles[tone], part?.sx]}
    >
      {content}
    </Marker>
  );
}

export function Timeline({
  ref,
  events,
  now,
  value,
  defaultValue,
  onValueChange,
  locale,
  timeZone = DEFAULT_TIME_ZONE,
  headingLevel = 3,
  maxHeight,
  scrollToNew = false,
  size = 'md',
  labels: labelProps,
  slotProps,
  slots,
  component,
  className,
  sx,
  onKeyDown,
  onFocus,
  onBlur,
  'aria-label': ariaLabelProp,
  'aria-labelledby': ariaLabelledBy,
  'aria-describedby': ariaDescribedBy,
  ...rest
}: TimelineProps) {
  const Scroller = slots?.scroller ?? 'div';
  const Group = slots?.group ?? 'section';
  const Heading = slots?.heading ?? `h${headingLevel}`;
  const List = slots?.list ?? 'ol';
  const Item = slots?.item ?? 'li';
  const Marker = slots?.marker ?? 'span';
  const Trigger = slots?.trigger ?? 'button';
  const Time = slots?.time ?? 'time';
  const Detail = slots?.detail ?? 'div';
  const Status = slots?.status ?? 'div';
  const baseId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const mergedScrollerRef = useMergeRefs([scrollerRef, slotProps?.scroller?.ref]);
  const mergedRef = useMergeRefs([ref, rootRef]);
  const bounded = maxHeight !== undefined;
  const validNow = validEpoch(now) ? now : null;

  const { formatters, problems } = useMemo(() => resolveFormatters(locale, timeZone), [locale, timeZone]);
  const labels: TimelineLabels = { ...defaultLabels(formatters), ...labelProps };
  const groups = useMemo(() => buildGroups(events, formatters.dayParts, validNow), [events, formatters, validNow]);
  const orderedIds = useMemo(() => groups.flatMap((group) => group.rows.map((row) => row.event.id)), [groups]);
  const newestEpoch = groups[0]?.epoch ?? null;

  const [open = EMPTY_IDS, requestOpen] = useControlledState<readonly string[]>(value, defaultValue ?? EMPTY_IDS, (next) =>
    onValueChange?.([...next]),
  );
  const openIds = new Set(open);
  const openKey = idSetKey(open);
  // The id set last requested from the current open set; a request repeating it is not re-sent.
  const lastRequest = useRef<string | null>(null);
  useLayoutEffect(() => {
    lastRequest.current = null;
  }, [openKey]);
  const toggle = (id: string) => {
    const next = openIds.has(id) ? open.filter((openId) => openId !== id) : [...open, id];
    const nextKey = idSetKey(next);
    if (nextKey === openKey || nextKey === lastRequest.current) return;
    lastRequest.current = nextKey;
    requestOpen(next);
  };

  // What the previous commit showed: drives entry feedback, announcements, anchoring and focus repair.
  const committed = useRef<{ ids: ReadonlySet<string>; order: readonly string[]; newestEpoch: number | null } | null>(
    null,
  );
  const anchor = useRef<Anchor | null>(null);
  const focused = useRef<{ element: Element; id: string } | null>(null);
  const [announcement, setAnnouncement] = useState({ text: '', key: 0 });
  // Rows absent from the previous data get entry feedback; nothing animates on first render.
  const entering = useMemo(() => {
    const previousIds = committed.current?.ids;
    return new Set(previousIds ? orderedIds.filter((id) => !previousIds.has(id)) : []);
  }, [orderedIds]);

  const items = () => (rootRef.current ? queryOwnedItems(rootRef.current, ITEM_QUERY) : []);

  // Records the row the reader is looking at, so an update above it can restore its position.
  const captureAnchor = () => {
    const scroller = scrollerRef.current;
    if (!bounded || !scroller) {
      anchor.current = null;
      return;
    }
    const scrollerTop = scroller.getBoundingClientRect().top;
    const active = scroller.ownerDocument.activeElement;
    const focusedItem = active && scroller.contains(active) ? active.closest<HTMLElement>(ITEM_QUERY.itemSelector) : null;
    const target =
      focusedItem ??
      (scroller.scrollTop > 0 ? items().find((item) => item.getBoundingClientRect().bottom > scrollerTop) : undefined);
    anchor.current = target ? { id: target.dataset.eventId!, top: target.getBoundingClientRect().top - scrollerTop } : null;
  };

  useLayoutEffect(() => {
    const root = rootRef.current;
    const scroller = scrollerRef.current;
    const previous = committed.current;
    committed.current = { ids: new Set(orderedIds), order: orderedIds, newestEpoch };
    if (!root || !scroller || !previous) {
      captureAnchor();
      return;
    }
    const currentItems = items();
    const itemFor = (id: string) => currentItems.find((item) => item.dataset.eventId === id);
    const document = root.ownerDocument;

    // Focus was inside an event that is gone: continue on the nearest surviving disclosure.
    const lost = focused.current;
    const active = document.activeElement;
    if (lost && !lost.element.isConnected && !committed.current.ids.has(lost.id) && (!active || active === document.body)) {
      focused.current = null;
      const triggers = new Set(queryOwnedItems(root, TRIGGER_QUERY));
      const from = previous.order.indexOf(lost.id);
      const triggerFor = (id: string | undefined) => {
        const trigger = id === undefined ? undefined : itemFor(id)?.querySelector(TRIGGER_QUERY.itemSelector);
        return trigger && triggers.has(trigger as HTMLElement) ? (trigger as HTMLElement) : undefined;
      };
      for (let step = 1; step < previous.order.length; step++) {
        const next = triggerFor(previous.order[from + step]) ?? triggerFor(previous.order[from - step]);
        if (next) {
          next.focus();
          break;
        }
      }
    }

    const focusInside = root.contains(document.activeElement);
    const hasNewer = newestEpoch !== null && (previous.newestEpoch === null || newestEpoch > previous.newestEpoch);
    if (scrollToNew && hasNewer && !focusInside) {
      // The newest row's whole day group, so its heading comes into view with it.
      itemFor(orderedIds[0]!)
        ?.closest('[data-ui="timeline-group"]')
        ?.scrollIntoView({ block: 'nearest', behavior: isReducedMotion(root) ? 'instant' : 'smooth' });
    } else if (bounded && anchor.current) {
      const anchored = itemFor(anchor.current.id);
      if (anchored) {
        const shift = anchored.getBoundingClientRect().top - scroller.getBoundingClientRect().top - anchor.current.top;
        if (shift !== 0) scroller.scrollTop += shift;
      }
    }
    captureAnchor();

    const fresh = orderedIds.filter((id) => !previous.ids.has(id));
    if (fresh.length > 0) setAnnouncement((current) => ({ text: labels.newEvents(fresh.length), key: current.key + 1 }));
    // Runs per data/layout change only; labels and the anchor helpers read the latest render.
  }, [orderedIds, bounded]);

  // Development diagnostics: invalid Intl inputs, clock and duplicate identities.
  const duplicateIds = findDuplicates(orderedIds);
  const diagnostics = [
    ...problems,
    ...(validNow === null ? [`Timeline: now ${String(now)} is not a finite epoch-ms value; showing absolute times.`] : []),
    ...(duplicateIds.length > 0 ? [`Timeline: duplicate event ids ${JSON.stringify(duplicateIds)}.`] : []),
  ].join('\n');
  useEffect(() => {
    if (process.env.NODE_ENV === 'production' || diagnostics === '') return;
    console.error(diagnostics);
  }, [diagnostics]);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    (slotProps?.root?.onKeyDown ?? onKeyDown)?.(event);
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    const target = KEY_TARGETS[event.key];
    if (!target) return;
    const triggers = queryOwnedItems(event.currentTarget, TRIGGER_QUERY);
    const index = triggers.indexOf(event.target as HTMLElement);
    if (index === -1) return;
    event.preventDefault();
    triggers[target(index, triggers.length)]?.focus();
  };

  const handleFocus = (event: FocusEvent<HTMLDivElement>) => {
    (slotProps?.root?.onFocus ?? onFocus)?.(event);
    const item = event.target.closest<HTMLElement>(ITEM_QUERY.itemSelector);
    focused.current = item?.closest(ITEM_QUERY.ownerSelector) === event.currentTarget
      ? { element: event.target, id: item.dataset.eventId! }
      : null;
    captureAnchor();
  };

  const handleBlur = (event: FocusEvent<HTMLDivElement>) => {
    (slotProps?.root?.onBlur ?? onBlur)?.(event);
    if (event.currentTarget.contains(event.relatedTarget)) return;
    const { target } = event;
    // A focused element removed by an update also blurs; keep its record so focus can be repaired.
    queueMicrotask(() => {
      if (target.isConnected && focused.current?.element === target) focused.current = null;
    });
  };

  const empty = events.length === 0;
  const emptyId = `${baseId}-empty`;
  const name = {
    'aria-label': ariaLabelProp ?? (ariaLabelledBy ? undefined : labels.region),
    'aria-labelledby': ariaLabelledBy,
  };
  const describedBy = [ariaDescribedBy, empty ? emptyId : undefined].filter(Boolean).join(' ') || undefined;

  return (
        <PresentationSlot
          element="div"
          component={slots?.root ?? component}
          slotProps={{ ...slotProps?.root, role: 'region', 'data-size': size, onKeyDown: handleKeyDown, onFocus: handleFocus, onBlur: handleBlur }}
          styles={[rootStyle, sizeStyles[size]]}
          sx={sx}
          {...rest}
          ref={mergedRef}
          role="region"
          {...name}
          aria-describedby={describedBy}
          marker="timeline"
          className={className}
        >
          <Scroller
            {...withoutSx(slotProps?.scroller)}
            ref={mergedScrollerRef}
            data-ui="timeline-scroller"
            data-bounded={bounded ? '' : undefined}
            // A bounded scroller must be scrollable from the keyboard even without disclosures, so it
            // is a tab stop and carries the timeline's name.
            {...(bounded ? { tabIndex: 0, role: 'group', ...name } : undefined)}
            style={bounded ? { ...slotProps?.scroller?.style, maxBlockSize: maxHeight } : slotProps?.scroller?.style}
            onScroll={(event) => {
              slotProps?.scroller?.onScroll?.(event);
              captureAnchor();
            }}
            className={slotProps?.scroller?.className}
            css={[scrollerStyle, slotProps?.scroller?.sx]}
          >
            {empty ? (
              <p id={emptyId} data-ui="timeline-empty" css={emptyStyle}>
                {labels.empty}
              </p>
            ) : (
              groups.map((group) => {
                const headingId = partId(baseId, 'day', group.key);
                return (
                  // A group, not a named section: one region landmark per day would flood landmark navigation.
                  <Group
                    {...withoutSx(slotProps?.group)}
                    key={group.key}
                    role="group"
                    aria-labelledby={headingId}
                    data-ui="timeline-group"
                    data-day={group.key}
                    className={slotProps?.group?.className}
                    css={[groupStyle, slotProps?.group?.sx]}
                  >
                    <Heading
                      {...withoutSx(slotProps?.heading)}
                      id={headingId}
                      data-ui="timeline-heading"
                      className={slotProps?.heading?.className}
                      css={[headingStyle, slotProps?.heading?.sx]}
                    >
                      {group.epoch === null ? (
                        <span>{dayHeading(group, formatters, labels)}</span>
                      ) : (
                        <time dateTime={group.key}>{dayHeading(group, formatters, labels)}</time>
                      )}
                      <span css={dayCountStyle}>{labels.dayCount(group.rows.length)}</span>
                    </Heading>
                    <List
                      {...withoutSx(slotProps?.list)}
                      data-ui="timeline-list"
                      className={slotProps?.list?.className}
                      css={[listStyle, slotProps?.list?.sx]}
                    >
                      {group.rows.map(({ event, epoch, order }) => {
                        const expandable = hasContent(event.detail);
                        const expanded = expandable && openIds.has(event.id);
                        const detailId = partId(baseId, 'detail', event.id);
                        const fullDateId = partId(baseId, 'when', event.id);
                        const title = expandable ? (
                          <Trigger
                            {...withoutSx(slotProps?.trigger)}
                            type="button"
                            data-ui="timeline-trigger"
                            aria-expanded={expanded}
                            aria-controls={detailId}
                            aria-describedby={epoch === null ? undefined : fullDateId}
                            onClick={(click) => {
                              slotProps?.trigger?.onClick?.(click);
                              if (!click.defaultPrevented) toggle(event.id);
                            }}
                            className={slotProps?.trigger?.className}
                            css={[triggerStyle, slotProps?.trigger?.sx]}
                          >
                            {event.title}
                          </Trigger>
                        ) : (
                          <span data-ui="timeline-title" css={titleStyle}>
                            {event.title}
                          </span>
                        );
                        return (
                          <Item
                            {...withoutSx(slotProps?.item)}
                            key={JSON.stringify([event.id, duplicateIds.includes(event.id) ? order : null])}
                            data-ui="timeline-item"
                            data-event-id={event.id}
                            data-tone={event.tone ?? 'neutral'}
                            data-state={expandable ? (expanded ? 'open' : 'closed') : undefined}
                            data-new={entering.has(event.id) ? '' : undefined}
                            className={slotProps?.item?.className}
                            css={[itemStyle, slotProps?.item?.sx]}
                          >
                            <TimelineMarker event={event} part={slotProps?.marker} component={Marker} />
                            <div css={bodyStyle}>
                              <div css={contentStyle}>
                                <div css={titleLineStyle}>
                                  {event.actor ? (
                                    <span data-ui="timeline-actor" css={actorStyle}>
                                      {event.actor}
                                    </span>
                                  ) : null}
                                  {title}
                                </div>
                                {hasContent(event.meta) ? (
                                  <div data-ui="timeline-meta" css={metaStyle}>
                                    {event.meta}
                                  </div>
                                ) : null}
                              </div>
                              {epoch === null ? null : (
                                <Time
                                  {...withoutSx(slotProps?.time)}
                                  dateTime={new Date(epoch).toISOString()}
                                  data-ui="timeline-time"
                                  className={slotProps?.time?.className}
                                  css={[timeStyle, slotProps?.time?.sx]}
                                >
                                  {validNow === null
                                    ? formatters.clock.format(epoch)
                                    : relativeTime(epoch, validNow, group.distance ?? 0, formatters)}
                                  <span id={fullDateId} css={visuallyHiddenStyle}>
                                    {formatters.full.format(epoch)}
                                  </span>
                                </Time>
                              )}
                            </div>
                            {expandable ? (
                              <Detail
                                {...withoutSx(slotProps?.detail)}
                                id={detailId}
                                hidden={!expanded}
                                data-ui="timeline-detail"
                                data-state={expanded ? 'open' : 'closed'}
                                className={slotProps?.detail?.className}
                                css={[detailStyle, slotProps?.detail?.sx]}
                              >
                                {event.detail}
                              </Detail>
                            ) : null}
                          </Item>
                        );
                      })}
                    </List>
                  </Group>
                );
              })
            )}
          </Scroller>
          <Status
            {...withoutSx(slotProps?.status)}
            role="status"
            aria-atomic="true"
            data-ui="timeline-status"
            className={slotProps?.status?.className}
            css={[visuallyHiddenStyle, slotProps?.status?.sx]}
          >
            {announcement.text ? <span key={announcement.key}>{announcement.text}</span> : null}
          </Status>
        </PresentationSlot>
  );
}

Timeline.displayName = 'Timeline';
