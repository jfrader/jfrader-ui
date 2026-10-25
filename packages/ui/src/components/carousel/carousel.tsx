'use client';

// APG pattern: tabbed carousel. The root is a named region with aria-roledescription
// "carousel"; each slide is a tabpanel labelled by its picker tab, and only the root carries a
// role description. Inactive slides stay mounted, inert and aria-hidden, even while their edges
// peek into view.
// Tab order: rotation control (only when `interval` is set) → slide viewport and the active
// slide's content → one picker tab (roving tabindex on the focused tab, falling back to the
// active one) → Previous/Next.
// Keyboard map: on a picker tab, ArrowRight/ArrowLeft (swapped under RTL) move focus and wrap,
// Home/End jump; activation="auto" selects on focus, "manual" selects on Enter/Space. On the
// viewport itself, ArrowRight/ArrowLeft step one slide (RTL-aware, no wrap) and Home/End jump
// to the first/last slide; keys from the slide's own content are never intercepted.
// Rotation never starts by itself: it needs `interval` plus an explicit Start (or an explicit
// playing seed). Any focus inside the carousel, or a rotation step the parent declines,
// latches it off until Start is pressed again; hover, drag, an offscreen root, a hidden page and
// reduced motion pause it.
// Scrolling is native (scroll-snap); a mouse drag adapter scrolls the viewport and, on release,
// requests the nearest slide once. A rejected controlled request scrolls back to the accepted
// slide.
import {
  Children,
  isValidElement,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ComponentPropsWithRef,
  type ComponentType,
  type CSSProperties,
  type FocusEvent,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  type SyntheticEvent,
} from 'react';
import { useMergeRefs } from '@floating-ui/react';
import { ChevronLeft, ChevronRight } from '@jfrader/icons';
import { vars } from '@jfrader/tokens/vars';
import { css, type Interpolation, type Theme } from '../../styling/css';
import { focusRingInset, focusRingOutset } from '../../styling/focus-ring';
import { FORCED_COLORS, REDUCED_MOTION } from '../../styling/media';
import { withoutSx, WithSx, type SxProps } from '../../styling/sx';
import { numberFormatter } from '../../utils/intl';
import { moveRovingFocus, type OwnedItemsQuery } from '../../utils/roving-focus';
import { useControlledState } from '../../utils/use-controlled-state';
import { Button, type ButtonProps } from '../button';

export type CarouselActivation = 'auto' | 'manual';

export interface CarouselLabels {
  /** Name of the slide viewport. */
  slides: string;
  /** Name of the slide picker tablist. */
  chooseSlide: string;
  previous: string;
  next: string;
  startRotation: string;
  stopRotation: string;
  /** Shown when there are no slides. */
  empty: string;
  /** The root's aria-roledescription. */
  carouselRole: string;
  /** Default slide name; `index` is zero-based. */
  slideCount: (index: number, count: number) => string;
}

type StyleSlot = { sx?: Interpolation<Theme> };
type PartSlot = Omit<ComponentPropsWithRef<'div'>, 'children' | 'role' | 'id' | 'tabIndex' | 'hidden' | 'inert'> &
  StyleSlot;
type SlideSlot = Omit<PartSlot, 'ref' | 'aria-hidden'>;
type IndicatorSlot = Omit<
  ComponentPropsWithRef<'button'>,
  | 'ref'
  | 'children'
  | 'role'
  | 'id'
  | 'type'
  | 'tabIndex'
  | 'disabled'
  | 'aria-selected'
  | 'aria-controls'
  | 'aria-disabled'
  | 'aria-label'
> &
  StyleSlot;
type ButtonSlot = Omit<ButtonProps, 'children' | 'type' | 'disabled' | 'aria-disabled' | 'render' | 'sx'> & StyleSlot;

export interface CarouselSlots {
  /** Replaces the button that toggles auto-rotation on and off; renders `Button` by default. */
  rotationButton?: ComponentType<ButtonProps>;
  /** Replaces the scrollable clipping container that holds the track; renders `div` by default. */
  viewport?: ComponentType<ComponentPropsWithRef<'div'>>;
  /** Replaces the flex row that aligns and lays out the slides; renders `div` by default. */
  track?: ComponentType<ComponentPropsWithRef<'div'>>;
  /** Replaces the individual slide container holding one item of content; renders `div` by default. */
  slide?: ComponentType<ComponentPropsWithRef<'div'>>;
  /** Replaces the bar that groups the tab list and pagination buttons; renders `div` by default. */
  controls?: ComponentType<ComponentPropsWithRef<'div'>>;
  /** Replaces the roving tab list containing the slide indicator buttons; renders `div` by default. */
  tabList?: ComponentType<ComponentPropsWithRef<'div'>>;
  /** Replaces the tab button that selects and indicates a specific slide; renders `button` by default. */
  indicator?: ComponentType<ComponentPropsWithRef<'button'>>;
  /** Replaces the button that advances to the previous slide; renders `Button` by default. */
  previousButton?: ComponentType<ButtonProps>;
  /** Replaces the button that advances to the next slide; renders `Button` by default. */
  nextButton?: ComponentType<ButtonProps>;
  /** Replaces the live region that announces the current slide to assistive technologies; renders `div` by default. */
  status?: ComponentType<ComponentPropsWithRef<'div'>>;
  /** Replaces the empty state container displayed when no slides are provided; renders `div` by default. */
  empty?: ComponentType<ComponentPropsWithRef<'div'>>;
}

export interface CarouselSlotProps {
  /** Button that toggles auto-rotation on and off. */
  rotationButton?: ButtonSlot;
  /** Scrollable clipping container that holds the track. */
  viewport?: PartSlot;
  /** Flex row that aligns and lays out the slides. */
  track?: PartSlot;
  /** Individual slide container holding one item of content. */
  slide?: SlideSlot;
  /** Bar that groups the tab list and pagination buttons. */
  controls?: PartSlot;
  /** Roving tab list containing the slide indicator buttons. */
  tabList?: PartSlot;
  /** Tab button that selects and indicates a specific slide. */
  indicator?: IndicatorSlot;
  /** Button that advances to the previous slide. */
  previousButton?: ButtonSlot;
  /** Button that advances to the next slide. */
  nextButton?: ButtonSlot;
  /** Live region that announces the current slide to assistive technologies. */
  status?: PartSlot;
  /** Empty state container displayed when no slides are provided. */
  empty?: PartSlot;
}

export interface CarouselProps extends Omit<ComponentPropsWithRef<'section'>, 'defaultValue' | 'onChange'>, SxProps {
  /** One renderable child per slide; give each a stable key. */
  children: ReactNode;
  /** Active slide index (controlled). */
  value?: number;
  /** Set the initial zero-based slide index when uncontrolled. Defaults to 0. */
  defaultValue?: number;
  /** Receive the requested zero-based slide index after navigation or rotation. */
  onValueChange?: (index: number) => void;
  /** Inline size of each slide, clamped to the carousel's width. */
  slideSize?: CSSProperties['inlineSize'];
  /** Accessible slide name; `index` is zero-based. Defaults to `labels.slideCount`. */
  getSlideLabel?: (index: number, count: number) => string;
  /** Select picker tabs on focus with `auto`, or on Enter/Space with `manual`. Defaults to `auto`. */
  activation?: CarouselActivation;
  /** Rotation delay in milliseconds. Without a positive finite value there is no rotation. */
  interval?: number;
  /** Seeds the uncontrolled playing state on mount. */
  autoPlay?: boolean;
  /** Requested rotation state (controlled). Safety pauses apply on top of it. */
  playingValue?: boolean;
  /** Seeds the uncontrolled playing state; takes precedence over `autoPlay`. */
  defaultPlayingValue?: boolean;
  /** Receive requested rotation-state changes, including latched safety stops. */
  onPlayingValueChange?: (playing: boolean) => void;
  /** Format slide numbers in default labels with this locale. */
  locale?: Intl.LocalesArgument;
  /** Override the default English control names, empty message, and slide-count formatter. */
  labels?: Partial<CarouselLabels>;
  /** Blocks navigation and rotation; the active slide's content stays operable. */
  disabled?: boolean;
  /** Replacement components for interior parts. */
  slots?: CarouselSlots;
  /** Pass props and `sx` to the generated slides, controls, and status regions. */
  slotProps?: CarouselSlotProps;
}

/** Fits two peeking neighbours on wide containers and the full width on narrow ones. */
const DEFAULT_SLIDE_SIZE = 'min(80cqw, 21rem)';
const SLIDE_SIZE = 'min(var(--carousel-slide-size), 100cqw)';
/** Mouse travel before a press on the viewport becomes a drag. */
const DRAG_THRESHOLD_PX = 6;
/** Settling delay where the browser has no `scrollend` event. */
const SCROLL_SETTLE_FALLBACK_MS = 120;
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
const INTERACTIVE_SELECTOR =
  'a[href], button, input, select, textarea, label, summary, [contenteditable]:not([contenteditable="false"]), [tabindex], [role="slider"]';
const TAB_QUERY: OwnedItemsQuery = { itemSelector: '[role="tab"]', ownerSelector: '[role="tablist"]' };

const noop = () => {};

function subscribeReducedMotion(onChange: () => void) {
  if (typeof window === 'undefined' || !window.matchMedia) return noop;
  const query = window.matchMedia(REDUCED_MOTION_QUERY);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}
const readReducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.(REDUCED_MOTION_QUERY).matches === true;

function subscribeVisibility(onChange: () => void) {
  if (typeof document === 'undefined') return noop;
  document.addEventListener('visibilitychange', onChange);
  return () => document.removeEventListener('visibilitychange', onChange);
}
const readPageHidden = () => typeof document !== 'undefined' && document.hidden;
const serverFalse = () => false;

function normalizeIndex(value: number, count: number) {
  if (count === 0) return 0;
  const index = Number.isFinite(value) ? Math.trunc(value) : 0;
  return Math.min(Math.max(index, 0), count - 1);
}

/** Runs the consumer handler first; `preventDefault()` there skips the component's own. */
function chain<E extends SyntheticEvent>(theirs: ((event: E) => void) | undefined, ours: (event: E) => void) {
  return (event: E) => {
    theirs?.(event);
    if (!event.defaultPrevented) ours(event);
  };
}

const joinIds = (...ids: (string | undefined)[]) => ids.filter(Boolean).join(' ') || undefined;

const slideKey = (slide: ReactNode, index: number) =>
  isValidElement(slide) && slide.key !== null ? slide.key : `slide-${index}`;

const rootStyle = css({
  label: 'carousel',
  containerType: 'inline-size',
  boxSizing: 'border-box',
  inlineSize: '100%',
  minInlineSize: 0,
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr)',
  gap: vars.space[3],
  fontFamily: vars.font.sans,
  color: vars.color.text,
  overflowWrap: 'anywhere',
  '&:focus-visible': focusRingOutset,
});

const rotationButtonStyle = css({ justifySelf: 'start' });

const viewportStyle = css({
  overflowX: 'auto',
  overflowY: 'hidden',
  scrollSnapType: 'inline mandatory',
  overscrollBehaviorInline: 'contain',
  scrollbarWidth: 'none',
  borderRadius: vars.radius.lg,
  '&:focus-visible': focusRingOutset,
  '&[data-disabled]': { overflowX: 'hidden' },
  '&[data-dragging]': { cursor: 'grabbing', userSelect: 'none' },
});

const trackStyle = css({
  display: 'flex',
  gap: vars.space[3],
  inlineSize: 'max-content',
  paddingInline: `calc((100cqw - ${SLIDE_SIZE}) / 2)`,
});

const slideStyle = css({
  flex: 'none',
  boxSizing: 'border-box',
  inlineSize: SLIDE_SIZE,
  minInlineSize: 0,
  scrollSnapAlign: 'center',
  scrollSnapStop: 'always',
});

const controlsStyle = css({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: vars.space[2],
});

const tabListStyle = css({
  display: 'flex',
  flex: '1 1 auto',
  minInlineSize: 0,
  overflowX: 'auto',
  scrollbarWidth: 'none',
});

const indicatorStyle = css({
  appearance: 'none',
  display: 'inline-grid',
  placeItems: 'center',
  flex: 'none',
  minInlineSize: vars.space[8],
  blockSize: vars.space[8],
  padding: 0,
  border: 0,
  borderRadius: vars.radius.full,
  background: 'transparent',
  cursor: 'pointer',
  '&:hover:not([aria-disabled="true"]):not([aria-selected="true"]) > span': {
    backgroundColor: vars.color.textMuted,
  },
  '&[aria-selected="true"] > span': {
    inlineSize: vars.space[6],
    backgroundColor: vars.color.accent,
  },
  '&[aria-disabled="true"]': { cursor: 'not-allowed', opacity: 0.55 },
  '&:focus-visible': focusRingInset,
  [FORCED_COLORS]: {
    '& > span': { forcedColorAdjust: 'none', backgroundColor: 'CanvasText' },
    '&[aria-selected="true"] > span': { backgroundColor: 'Highlight' },
  },
});

const pillStyle = css({
  display: 'block',
  inlineSize: vars.space[2],
  blockSize: vars.space[2],
  borderRadius: vars.radius.full,
  backgroundColor: vars.color.borderControl,
  transitionProperty: 'inline-size, background-color',
  transitionDuration: vars.motion.duration.fast,
  transitionTimingFunction: vars.motion.easeStandard,
  [REDUCED_MOTION]: { transitionDuration: '0s' },
});

const stepButtonStyle = css({ inlineSize: vars.space[8], paddingInline: 0 });

const glyphStyle = css({
  inlineSize: vars.space[4],
  blockSize: vars.space[4],
  '&:dir(rtl)': { transform: 'scaleX(-1)' },
});

const statusStyle = css({
  margin: 0,
  textAlign: 'center',
  fontSize: vars.textSize.sm,
  lineHeight: vars.lineHeight.base,
  color: vars.color.textMuted,
  fontVariantNumeric: 'tabular-nums',
});

const emptyStyle = css({
  display: 'grid',
  placeItems: 'center',
  padding: vars.space[8],
  border: `1px dashed ${vars.color.borderControl}`,
  borderRadius: vars.radius.lg,
  fontSize: vars.textSize.sm,
  lineHeight: vars.lineHeight.base,
  color: vars.color.textMuted,
});

function Chevron({ direction }: { direction: 'previous' | 'next' }) {
  const Icon = direction === 'previous' ? ChevronLeft : ChevronRight;
  return <Icon size={16} css={glyphStyle} decorative />;
}

interface DragSession {
  pointerId: number;
  startX: number;
  startY: number;
  startScroll: number;
  active: boolean;
}

export function Carousel({
  ref,
  children,
  value: valueProp,
  defaultValue = 0,
  onValueChange,
  slideSize = DEFAULT_SLIDE_SIZE,
  getSlideLabel: getSlideLabelProp,
  activation = 'auto',
  interval,
  autoPlay = false,
  playingValue,
  defaultPlayingValue,
  onPlayingValueChange,
  locale,
  labels: labelProps,
  disabled = false,
  slots,
  slotProps,
  className,
  sx,
  style,
  role = 'region',
  'aria-roledescription': roleDescription,
  onFocus,
  onBlur,
  onPointerEnter,
  onPointerLeave,
  ...rest
}: CarouselProps) {
  const RotationButton = slots?.rotationButton ?? Button;
  const Viewport = slots?.viewport ?? 'div';
  const Track = slots?.track ?? 'div';
  const Slide = slots?.slide ?? 'div';
  const Controls = slots?.controls ?? 'div';
  const TabList = slots?.tabList ?? 'div';
  const Indicator = slots?.indicator ?? 'button';
  const PreviousButton = slots?.previousButton ?? Button;
  const NextButton = slots?.nextButton ?? Button;
  const Status = slots?.status ?? 'div';
  const Empty = slots?.empty ?? 'div';
  const baseId = useId();
  const numberFormat = useMemo(() => numberFormatter(locale), [locale]);
  const labels: CarouselLabels = {
    slides: 'Slides',
    chooseSlide: 'Choose slide',
    previous: 'Previous slide',
    next: 'Next slide',
    startRotation: 'Start slide rotation',
    stopRotation: 'Stop slide rotation',
    empty: 'No slides',
    carouselRole: 'carousel',
    slideCount: (index, count) => `Slide ${numberFormat.format(index + 1)} of ${numberFormat.format(count)}`,
    ...labelProps,
  };
  const getSlideLabel = getSlideLabelProp ?? labels.slideCount;

  const slides = Children.toArray(children);
  const count = slides.length;
  // Changes when slides are added, removed, replaced or reordered.
  const slideIdentity = JSON.stringify(slides.map(slideKey));
  const tabbed = count > 1;
  const [requestedIndex, requestRawIndex] = useControlledState<number>(valueProp, defaultValue, onValueChange);
  const rawIndex = requestedIndex ?? 0;
  const active = normalizeIndex(rawIndex, count);
  const navigable = tabbed && !disabled;

  const rotationInterval =
    typeof interval === 'number' && Number.isFinite(interval) && interval > 0 ? interval : undefined;
  const hasRotation = rotationInterval !== undefined && tabbed;
  const [playing, requestPlaying] = useControlledState<boolean>(
    playingValue,
    defaultPlayingValue ?? autoPlay,
    onPlayingValueChange,
  );
  // Set by focus, Stop, reduced motion and a declined rotation request; only an explicit Start
  // clears it.
  const [stopped, setStopped] = useState(false);
  // The slide a rotation request left from, until the update it was issued in has rendered.
  const [rotationFrom, setRotationFrom] = useState<number | null>(null);
  const reducedMotion = useSyncExternalStore(subscribeReducedMotion, readReducedMotion, serverFalse);
  const pageHidden = useSyncExternalStore(subscribeVisibility, readPageHidden, serverFalse);
  const [hovered, setHovered] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [offscreen, setOffscreen] = useState(false);
  const rotationOn = hasRotation && playing && !stopped && !reducedMotion && !disabled;
  const rotating = rotationOn && !hovered && !dragging && !pageHidden && !offscreen;

  const [focusedIndicator, setFocusedIndicator] = useState<number | null>(null);
  const tabStop = focusedIndicator !== null && focusedIndicator < count ? focusedIndicator : active;
  const [syncTick, setSyncTick] = useState(0);

  const rootRef = useRef<HTMLElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const tabListRef = useRef<HTMLDivElement>(null);
  const rootRefs = useMergeRefs([ref, rootRef]);
  const viewportRefs = useMergeRefs([slotProps?.viewport?.ref, viewportRef]);
  const tabListRefs = useMergeRefs([slotProps?.tabList?.ref, tabListRef]);
  const lastFocusRef = useRef<Element | null>(null);
  const dragRef = useRef<DragSession | null>(null);
  const releaseRef = useRef<(() => void) | null>(null);
  // The slide a gesture already requested, so its trailing scrollend does not request it again.
  const gestureRequestRef = useRef<number | null>(null);
  // Indicator focus that already issued the auto-activation request for the click that follows.
  const focusRequestRef = useRef<number | null>(null);
  // What the rotation button showed when pressed: focusing it latches rotation off first.
  const pressIntentRef = useRef<'start' | 'stop' | null>(null);
  // scrollLeft our own scroll is heading to; its scrollend events are not gestures.
  const programmaticTargetRef = useRef<number | null>(null);
  const firstSyncRef = useRef(true);
  const activeRef = useRef(0);
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const panelId = (index: number) => `${baseId}-panel-${index}`;
  const indicatorId = (index: number) => `${baseId}-tab-${index}`;

  useEffect(() => {
    if (!Number.isFinite(rawIndex)) console.warn(`Carousel: value ${rawIndex} is not a finite index; showing the first slide.`);
  }, [rawIndex]);

  useEffect(() => {
    if (reducedMotion) setStopped(true);
  }, [reducedMotion]);

  useEffect(() => {
    const root = rootRef.current;
    if (!hasRotation || !root || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(([entry]) => setOffscreen(entry ? !entry.isIntersecting : false));
    observer.observe(root);
    return () => observer.disconnect();
  }, [hasRotation]);

  // One timer per accepted slide.
  useEffect(() => {
    if (!rotating || rotationInterval === undefined) return;
    const timer = setTimeout(() => {
      setRotationFrom(active);
      requestRawIndex((active + 1) % count);
    }, rotationInterval);
    return () => clearTimeout(timer);
  }, [rotating, rotationInterval, active, count, requestRawIndex]);

  // A rotation request the parent did not accept in the same update latches rotation off, so
  // pause/resume cycles cannot repeat it and the control shows Start.
  useEffect(() => {
    if (rotationFrom === null) return;
    setRotationFrom(null);
    if (rotationFrom === active) setStopped(true);
  }, [rotationFrom, active]);

  useEffect(() => () => clearTimeout(settleTimerRef.current), []);

  const slideAt = (index: number) => trackRef.current?.children[index] as HTMLElement | undefined;

  const scrollToSlide = (index: number, behavior: ScrollBehavior) => {
    const viewport = viewportRef.current;
    const slide = slideAt(index);
    if (!viewport || !slide) return;
    const frame = viewport.getBoundingClientRect();
    const box = slide.getBoundingClientRect();
    const delta = box.left + box.width / 2 - (frame.left + frame.width / 2);
    if (Math.abs(delta) < 1) return;
    programmaticTargetRef.current = viewport.scrollLeft + delta;
    viewport.scrollTo({ left: programmaticTargetRef.current, behavior });
  };

  const nearestIndex = () => {
    const viewport = viewportRef.current;
    const track = trackRef.current;
    if (!viewport || !track) return active;
    const frame = viewport.getBoundingClientRect();
    const center = frame.left + frame.width / 2;
    let nearest = active;
    let distance = Infinity;
    Array.from(track.children).forEach((slide, index) => {
      const box = slide.getBoundingClientRect();
      const offset = Math.abs(box.left + box.width / 2 - center);
      if (offset < distance) {
        distance = offset;
        nearest = index;
      }
    });
    return nearest;
  };

  // Accepted index changes, rejected gestures (syncTick) and slide changes (added, removed,
  // replaced, reordered) re-centre the accepted slide. Focus stranded by the change — inside a
  // slide that became inert, or dropped to the body with a removed or moved slide — moves to
  // the viewport; focus elsewhere on the page stays put.
  useLayoutEffect(() => {
    activeRef.current = active;
    const viewport = viewportRef.current;
    const focusTarget = viewport ?? rootRef.current;
    if (!focusTarget) return;
    const { activeElement: focused, body } = focusTarget.ownerDocument;
    const lastFocus = lastFocusRef.current;
    const inInertSlide = (element: Element) => viewport?.contains(element) && element.closest('[inert]') !== null;
    const focusInInertSlide = focused !== null && inInertSlide(focused);
    const focusLostWithSlide =
      focused === body && lastFocus !== null && (!lastFocus.isConnected || inInertSlide(lastFocus));
    if (focusInInertSlide || focusLostWithSlide) focusTarget.focus({ preventScroll: true });
    if (!tabListRef.current?.contains(focused)) setFocusedIndicator(null);
    if (dragRef.current?.active) return;
    scrollToSlide(active, firstSyncRef.current || reducedMotion ? 'instant' : 'smooth');
    firstSyncRef.current = false;
  }, [active, slideIdentity, syncTick]);

  // Re-centre on resize; reads the accepted index through a ref so the observer stays put.
  const hasSlides = count > 0;
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      if (!dragRef.current?.active) scrollToSlide(activeRef.current, 'instant');
    });
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [hasSlides]);

  const requestIndex = (next: number) => {
    if (!navigable) return;
    const target = normalizeIndex(next, count);
    if (target !== active) requestRawIndex(target);
  };

  /** Requests the slide a gesture settled on and re-centres whatever the parent accepts. */
  const requestFromGesture = (index: number) => {
    gestureRequestRef.current = index;
    requestIndex(index);
    setSyncTick((tick) => tick + 1);
  };

  const settle = () => {
    const viewport = viewportRef.current;
    const target = programmaticTargetRef.current;
    if (viewport && target !== null) {
      // A late scrollend from an earlier programmatic scroll must not request its slide.
      if (Math.abs(viewport.scrollLeft - target) < 2) programmaticTargetRef.current = null;
      return;
    }
    if (!navigable || dragRef.current) return;
    const nearest = nearestIndex();
    if (nearest === active || nearest === gestureRequestRef.current) return;
    requestFromGesture(nearest);
  };

  const scrollFallback = () => {
    clearTimeout(settleTimerRef.current);
    settleTimerRef.current = setTimeout(settle, SCROLL_SETTLE_FALLBACK_MS);
  };
  const supportsScrollEnd = typeof window !== 'undefined' && 'onscrollend' in window;

  const stopRotationForFocus = () => {
    if (!hasRotation || stopped) return;
    setStopped(true);
    requestPlaying(false);
  };

  const handleRootFocus = chain(onFocus, (event: FocusEvent<HTMLElement>) => {
    lastFocusRef.current = event.target;
    stopRotationForFocus();
  });

  // Focus moving to another element outside forgets the slide focus; focus falling to the body
  // (a removed slide) keeps it so the layout effect can recover.
  const handleRootBlur = chain(onBlur, (event: FocusEvent<HTMLElement>) => {
    const next = event.relatedTarget;
    if (next !== null && !event.currentTarget.contains(next)) lastFocusRef.current = null;
  });

  const handleRotationClick = () => {
    const intent = pressIntentRef.current ?? (rotationOn ? 'stop' : 'start');
    pressIntentRef.current = null;
    setStopped(intent === 'stop');
    requestPlaying(intent === 'start');
  };

  // User input starts a new gesture: forget the previous request and any programmatic scroll.
  const resetGesture = () => {
    gestureRequestRef.current = null;
    programmaticTargetRef.current = null;
  };

  const handleViewportKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    resetGesture();
    if (event.target !== event.currentTarget || !navigable) return;
    const rtl = getComputedStyle(event.currentTarget).direction === 'rtl';
    const targets: Partial<Record<string, number>> = {
      ArrowRight: active + (rtl ? -1 : 1),
      ArrowLeft: active + (rtl ? 1 : -1),
      Home: 0,
      End: count - 1,
    };
    const target = targets[event.key];
    if (target === undefined) return;
    event.preventDefault();
    requestIndex(target);
  };

  useEffect(() => () => releaseRef.current?.(), []);

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    resetGesture();
    if (!navigable || event.pointerType !== 'mouse' || event.button !== 0) return;
    const viewport = event.currentTarget;
    const interactive = (event.target as Element).closest(INTERACTIVE_SELECTOR);
    if (interactive && interactive !== viewport && viewport.contains(interactive)) return;
    const session = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startScroll: viewport.scrollLeft,
      active: false,
    };
    dragRef.current = session;
    // Before capture starts, a release outside the viewport never reaches the viewport handler.
    // Keep a document-level release for that window; once the drag is active the viewport owns
    // the pointer through capture, so the listener only has to remove itself.
    const ownerDocument = viewport.ownerDocument;
    const release = (releaseEvent: globalThis.PointerEvent) => {
      if (releaseEvent.pointerId !== session.pointerId) return;
      if (dragRef.current === session && !session.active) dragRef.current = null;
      detach();
    };
    const detach = () => {
      ownerDocument.removeEventListener('pointerup', release);
      ownerDocument.removeEventListener('pointercancel', release);
      if (releaseRef.current === detach) releaseRef.current = null;
    };
    releaseRef.current?.();
    releaseRef.current = detach;
    ownerDocument.addEventListener('pointerup', release);
    ownerDocument.addEventListener('pointercancel', release);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const session = dragRef.current;
    if (!session || session.pointerId !== event.pointerId) return;
    const viewport = event.currentTarget;
    const dx = event.clientX - session.startX;
    const dy = event.clientY - session.startY;
    if (!session.active) {
      if (Math.abs(dy) >= DRAG_THRESHOLD_PX && Math.abs(dy) > Math.abs(dx)) {
        dragRef.current = null;
        return;
      }
      if (Math.abs(dx) < DRAG_THRESHOLD_PX) return;
      session.active = true;
      viewport.setPointerCapture(event.pointerId);
      // Snapping would fight each scroll write; it comes back on release.
      viewport.style.scrollSnapType = 'none';
      viewport.ownerDocument.getSelection()?.removeAllRanges();
      setDragging(true);
    }
    viewport.scrollLeft = session.startScroll - dx;
  };

  const endDrag = (event: PointerEvent<HTMLDivElement>, commit: boolean) => {
    releaseRef.current?.();
    const session = dragRef.current;
    if (!session || session.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (!session.active) return;
    const viewport = event.currentTarget;
    viewport.style.scrollSnapType = '';
    setDragging(false);
    if (!commit) {
      setSyncTick((tick) => tick + 1);
      return;
    }
    // The release ends in a click on the viewport; it belongs to the drag, not to a slide.
    const swallowClick = (click: Event) => {
      click.preventDefault();
      click.stopPropagation();
    };
    viewport.addEventListener('click', swallowClick, { capture: true, once: true });
    setTimeout(() => viewport.removeEventListener('click', swallowClick, { capture: true }));
    requestFromGesture(nearestIndex());
  };

  const handleIndicatorFocus = (index: number) => {
    setFocusedIndicator(index);
    if (activation !== 'auto') return;
    focusRequestRef.current = index;
    requestIndex(index);
  };

  const handleIndicatorClick = (index: number) => {
    const requestedOnFocus = focusRequestRef.current === index;
    focusRequestRef.current = null;
    if (activation === 'auto' && requestedOnFocus) return;
    requestIndex(index);
  };

  const handleTabListKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    focusRequestRef.current = null;
    moveRovingFocus(event, event.currentTarget, 'horizontal', TAB_QUERY);
  };

  const rootStyleVars = {
    ...style,
    '--carousel-slide-size': typeof slideSize === 'number' ? `${slideSize}px` : slideSize,
  } as CSSProperties;

  const {
    viewport: viewportSlot,
    track: trackSlot,
    slide: slideSlot,
    controls: controlsSlot,
    tabList: tabListSlot,
    indicator: indicatorSlot,
    rotationButton: rotationSlot,
    previousButton: previousSlot,
    nextButton: nextSlot,
    status: statusSlot,
    empty: emptySlot,
  } = slotProps ?? {};

  return (
    <WithSx className={className} styles={rootStyle} sx={sx}>
      {(rootClassName) => (
        <section
          {...rest}
          ref={rootRefs}
          tabIndex={rest.tabIndex ?? -1}
          role={role}
          aria-roledescription={roleDescription ?? labels.carouselRole}
          data-ui="carousel"
          data-disabled={disabled || undefined}
          data-rotating={rotating || undefined}
          className={rootClassName}
          style={rootStyleVars}
          onFocus={handleRootFocus}
          onBlur={handleRootBlur}
          onPointerEnter={chain(onPointerEnter, (event) => {
            if (event.pointerType !== 'touch') setHovered(true);
          })}
          onPointerLeave={chain(onPointerLeave, () => setHovered(false))}
        >
          {hasRotation && (
            <RotationButton
              size="sm"
              variant="outline"
              {...withoutSx(rotationSlot)}
              css={[rotationButtonStyle, rotationSlot?.sx]}
              data-ui="carousel-rotation"
              aria-disabled={disabled || reducedMotion || undefined}
              onPointerDown={chain(rotationSlot?.onPointerDown, () => {
                pressIntentRef.current = rotationOn ? 'stop' : 'start';
              })}
              onClick={chain(rotationSlot?.onClick, handleRotationClick)}
            >
              {rotationOn ? labels.stopRotation : labels.startRotation}
            </RotationButton>
          )}

          {count === 0 ? (
            <Empty {...withoutSx(emptySlot)} data-ui="carousel-empty" css={[emptyStyle, emptySlot?.sx]}>
              {labels.empty}
            </Empty>
          ) : (
            <Viewport
              {...withoutSx(viewportSlot)}
              ref={viewportRefs}
              role="group"
              aria-label={viewportSlot?.['aria-label'] ?? (viewportSlot?.['aria-labelledby'] ? undefined : labels.slides)}
              tabIndex={navigable ? 0 : -1}
              data-ui="carousel-viewport"
              data-disabled={disabled || undefined}
              data-dragging={dragging || undefined}
              css={[viewportStyle, viewportSlot?.sx]}
              onKeyDown={chain(viewportSlot?.onKeyDown, handleViewportKeyDown)}
              onWheel={chain(viewportSlot?.onWheel, resetGesture)}
              onPointerDown={chain(viewportSlot?.onPointerDown, handlePointerDown)}
              onPointerMove={chain(viewportSlot?.onPointerMove, handlePointerMove)}
              onPointerUp={chain(viewportSlot?.onPointerUp, (event) => endDrag(event, true))}
              onPointerCancel={chain(viewportSlot?.onPointerCancel, (event) => endDrag(event, false))}
              onLostPointerCapture={chain(viewportSlot?.onLostPointerCapture, (event) => endDrag(event, false))}
              onScroll={chain(viewportSlot?.onScroll, supportsScrollEnd ? noop : scrollFallback)}
              onScrollEnd={chain(viewportSlot?.onScrollEnd, settle)}
            >
              <Track {...withoutSx(trackSlot)} ref={trackRef} data-ui="carousel-track" css={[trackStyle, trackSlot?.sx]}>
                {slides.map((slide, index) => {
                  const isActive = index === active;
                  return (
                    <Slide
                      {...withoutSx(slideSlot)}
                      key={slideKey(slide, index)}
                      role={tabbed ? 'tabpanel' : undefined}
                      id={panelId(index)}
                      aria-labelledby={joinIds(slideSlot?.['aria-labelledby'], tabbed ? indicatorId(index) : undefined)}
                      aria-hidden={isActive ? undefined : true}
                      inert={!isActive}
                      data-ui="carousel-slide"
                      data-state={isActive ? 'active' : 'inactive'}
                      css={[slideStyle, slideSlot?.sx]}
                    >
                      {slide}
                    </Slide>
                  );
                })}
              </Track>
            </Viewport>
          )}

          {tabbed && (
            <Controls {...withoutSx(controlsSlot)} data-ui="carousel-controls" css={[controlsStyle, controlsSlot?.sx]}>
              <TabList
                {...withoutSx(tabListSlot)}
                ref={tabListRefs}
                role="tablist"
                aria-label={
                  tabListSlot?.['aria-label'] ?? (tabListSlot?.['aria-labelledby'] ? undefined : labels.chooseSlide)
                }
                aria-orientation="horizontal"
                data-ui="carousel-tablist"
                css={[tabListStyle, tabListSlot?.sx]}
                onKeyDown={chain(tabListSlot?.onKeyDown, handleTabListKeyDown)}
              >
                {slides.map((slide, index) => (
                  <Indicator
                    {...withoutSx(indicatorSlot)}
                    key={slideKey(slide, index)}
                    type="button"
                    role="tab"
                    id={indicatorId(index)}
                    aria-label={getSlideLabel(index, count)}
                    aria-selected={index === active}
                    aria-controls={panelId(index)}
                    aria-disabled={disabled || undefined}
                    tabIndex={index === tabStop ? 0 : -1}
                    data-ui="carousel-indicator"
                    css={[indicatorStyle, indicatorSlot?.sx]}
                    onPointerDown={chain(indicatorSlot?.onPointerDown, () => {
                      focusRequestRef.current = null;
                    })}
                    onFocus={chain(indicatorSlot?.onFocus, () => handleIndicatorFocus(index))}
                    onClick={chain(indicatorSlot?.onClick, () => handleIndicatorClick(index))}
                  >
                    <span css={pillStyle} />
                  </Indicator>
                ))}
              </TabList>
              <PreviousButton
                size="sm"
                variant="outline"
                {...withoutSx(previousSlot)}
                css={[stepButtonStyle, previousSlot?.sx]}
                data-ui="carousel-previous"
                aria-label={previousSlot?.['aria-label'] ?? labels.previous}
                aria-disabled={!navigable || active === 0 || undefined}
                onClick={chain(previousSlot?.onClick, () => requestIndex(active - 1))}
              >
                <Chevron direction="previous" />
              </PreviousButton>
              <NextButton
                size="sm"
                variant="outline"
                {...withoutSx(nextSlot)}
                css={[stepButtonStyle, nextSlot?.sx]}
                data-ui="carousel-next"
                aria-label={nextSlot?.['aria-label'] ?? labels.next}
                aria-disabled={!navigable || active === count - 1 || undefined}
                onClick={chain(nextSlot?.onClick, () => requestIndex(active + 1))}
              >
                <Chevron direction="next" />
              </NextButton>
            </Controls>
          )}

          {tabbed && (
            <Status
              {...withoutSx(statusSlot)}
              role="status"
              aria-live={rotating ? 'off' : 'polite'}
              aria-atomic="true"
              data-ui="carousel-status"
              css={[statusStyle, statusSlot?.sx]}
            >
              {getSlideLabel(active, count)}
            </Status>
          )}
        </section>
      )}
    </WithSx>
  );
}

Carousel.displayName = 'Carousel';
