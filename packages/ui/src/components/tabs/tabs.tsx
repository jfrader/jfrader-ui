'use client';

// APG pattern: tabs. The tablist is a single tab stop: the roving tabindex sits on the
// focused tab, falling back to the selected tab and then to the first enabled tab, so Tab
// always enters and exits the tablist predictably.
// Keyboard map: ArrowRight/ArrowLeft (horizontal, swapped under RTL) or ArrowDown/ArrowUp
// (vertical) move focus to the next/previous enabled tab and wrap; Home/End jump to the
// first/last enabled tab. With activation="manual", Enter/Space selects the focused tab;
// with activation="auto", selection follows focus, and a click on an already-focused tab
// (a retry after a rejected controlled request) still issues exactly one request.
// Tab values are embedded in element ids percent-encoded, so arbitrary strings stay valid
// IDREF targets. Panels keep their state while hidden.
import {
  createContext,
  useContext,
  useEffect,
  useId,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ComponentPropsWithRef,
  type ComponentType,
  type FocusEvent,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import { LayoutGroup, MotionConfig, motion, useReducedMotion } from 'motion/react';
import { vars } from '@jfrader/tokens/vars';
import { useMergeRefs } from '@floating-ui/react';
import { css, type Interpolation, type SerializedStyles, type Theme } from '../../styling/css';
import { focusRingInset, focusRingOutset } from '../../styling/focus-ring';
import { FORCED_COLORS, REDUCED_MOTION, REDUCED_TRANSPARENCY } from '../../styling/media';
import { WithSx, type SxProps } from '../../styling/sx';
import { translucentControlStyle } from '../../styling/surface';
import { visuallyHiddenStyle } from '../../styling/visually-hidden';
import { isRenderable } from '../../utils/renderable';
import { partId } from '../../utils/part-id';
import { findByValue, moveRovingFocus, queryOwnedItems, type OwnedItemsQuery } from '../../utils/roving-focus';
import { useControlledState } from '../../utils/use-controlled-state';

export type TabsOrientation = 'horizontal' | 'vertical';
export type TabsActivation = 'auto' | 'manual';
export type TabsVariant = 'line' | 'glass' | 'liquid';
export type TabsIndicator = 'line' | 'pill' | 'lens';
export type TabsLabels = 'always' | 'active' | 'none';

interface TabsStateProps extends Omit<ComponentPropsWithRef<'div'>, 'onChange' | 'defaultValue' | 'children'>, SxProps {
  /** Control the selected tab and matching panel. */
  value?: string;
  /** Set the initial uncontrolled selection. Omit to start without a selected panel. */
  defaultValue?: string;
  /** Receive the requested selected tab value. */
  onValueChange?: (value: string) => void;
  /** Set the tab layout and arrow-key axis. Defaults to `horizontal`. */
  orientation?: TabsOrientation;
  /** Select on focus with `auto`, or on click, Enter or Space with `manual`. Defaults to `auto`. */
  activation?: TabsActivation;
  /** Material of the tab list. Defaults to `line`. */
  variant?: TabsVariant;
  /** Selection shape on material bars; defaults to pill for glass and lens for liquid. */
  indicator?: TabsIndicator;
  /** Visible labels; hidden labels retain their accessible names. Defaults to `always`. */
  labels?: TabsLabels;
  /** Hide labels without changing selection. Pair with `onCompactChange` for controlled use. */
  compact?: boolean;
  /** Set the initial uncontrolled compact mode. Defaults to `false`. */
  defaultCompact?: boolean;
  /** Receive compact-mode requests from scrolling or tab focus. */
  onCompactChange?: (compact: boolean) => void;
  /** Locale used to display numeric badges. */
  locale?: Intl.LocalesArgument;
  /** Drag the selected material indicator to another tab; click and keyboard remain available. */
  draggableIndicator?: boolean;
  /** Request compact mode when scrolling down. Disabled by default; material lists only. */
  collapseOnScroll?: boolean;
  /** Scroll container for `collapseOnScroll`; defaults to the owning window. */
  scrollRef?: RefObject<HTMLElement | null>;
}

export interface TabsSection {
  value: string;
  label: ReactNode;
  panel: ReactNode;
  disabled?: boolean;
  icon?: ReactNode;
  activeIcon?: ReactNode;
  badge?: number | string;
  badgeLabel?: string;
}

export interface TabsComposedProps extends TabsStateProps {
  /** Compose `Tabs.List`, `Tabs.Tab` and `Tabs.Panel` parts. */
  children?: ReactNode;
  items?: never;
  label?: never;
  slotProps?: never;
  slots?: never;
  component?: never;
}

export interface TabsShorthandProps extends TabsStateProps {
  /** Name the tab list. */
  label: string;
  /** Pair each tab with its panel by value. */
  items: readonly TabsSection[];
  children?: never;
  /** Pass props and styles to the generated root, list, tabs and panels. */
  slotProps?: TabsSlotProps;
  /** Replace generated root, list, tab and panel components. */
  slots?: TabsSlots;
  /** Replace the root container. `slots.root` takes precedence. */
  component?: TabsSlots['root'];
}

export interface TabsSlots {
  /** Replaces the outer tabs container; renders a `div` by default. */
  root?: ComponentType<ComponentPropsWithRef<'div'>>;
  /** Replaces the tablist container element. */
  list?: ComponentType<TabsListProps>;
  /** Replaces an individual tab button. */
  tab?: ComponentType<TabsTabProps>;
  /** Replaces the tabpanel container displaying the active tab content. */
  panel?: ComponentType<TabsPanelProps>;
}

export interface TabsSlotProps {
  /** Outer tabs container element wrapping the tab list and panels. */
  root?: Omit<ComponentPropsWithRef<'div'>, 'children'> & { sx?: Interpolation<Theme>; 'data-ui'?: string };
  /** Tab list container element holding tab buttons. */
  list?: Omit<TabsListProps, 'children' | 'aria-label'>;
  /** Tab button element selecting a panel. */
  tab?: Omit<TabsTabProps, 'children' | 'value' | 'disabled'>;
  /** Tab panel container element displaying the tab content. */
  panel?: Omit<TabsPanelProps, 'children' | 'value'>;
}

export type TabsProps = TabsComposedProps | TabsShorthandProps;

export type TabsListProps = ComponentPropsWithRef<'div'> & SxProps;

export interface TabsTabProps extends ComponentPropsWithRef<'button'>, SxProps {
  /** Identify this tab and its matching `Tabs.Panel`. */
  value: string;
  /** Decorative leading icon. Supply an icon when hiding visible labels. */
  icon?: ReactNode;
  /** Replace `icon` while this tab is selected. */
  activeIcon?: ReactNode;
  /** Zero and empty badges are omitted. Supply `badgeLabel` for a spoken description. */
  badge?: number | string;
  /** Replace the visible badge's spoken text with this description. */
  badgeLabel?: string;
  /** An action-shaped tab still selects a matching panel. */
  variant?: 'default' | 'action';
}

export interface TabsPanelProps extends ComponentPropsWithRef<'div'>, SxProps {
  /** Match the tab that reveals this panel. Inactive panels stay mounted but hidden. */
  value: string;
}

interface TabsContextValue {
  value: string | undefined;
  setValue: (value: string) => void;
  focused: string | null;
  setFocused: (value: string | null) => void;
  orientation: TabsOrientation;
  activation: TabsActivation;
  baseId: string;
  variant: TabsVariant;
  indicator: TabsIndicator;
  labels: TabsLabels;
  compact: boolean;
  setCompact: (compact: boolean) => void;
  locale: Intl.LocalesArgument | undefined;
  draggableIndicator: boolean;
  collapseOnScroll: boolean;
  scrollRef: RefObject<HTMLElement | null> | undefined;
}

const TabsContext = createContext<TabsContextValue | null>(null);

function useTabsContext(part: string): TabsContextValue {
  const context = useContext(TabsContext);
  if (!context) throw new Error(`Tabs.${part} must be rendered inside <Tabs>.`);
  return context;
}

const TAB_QUERY: OwnedItemsQuery = {
  itemSelector: '[role="tab"]:not([disabled])',
  ownerSelector: '[role="tablist"]',
};

const rootStyle = css({
  minInlineSize: 0,
  '&[data-orientation="vertical"]': {
    display: 'flex',
    alignItems: 'flex-start',
    gap: vars.space[4],
  },
});

const listStyles: Record<TabsOrientation, SerializedStyles> = {
  horizontal: css({
    display: 'inline-flex',
    boxSizing: 'border-box',
    maxInlineSize: '100%',
    overflowX: 'auto',
    gap: vars.space[1],
    borderBlockEnd: `1px solid ${vars.color.border}`,
  }),
  vertical: css({
    display: 'inline-flex',
    flexShrink: 0,
    maxInlineSize: '50%',
    overflowWrap: 'anywhere',
    flexDirection: 'column',
    alignItems: 'stretch',
    borderInlineEnd: `1px solid ${vars.color.border}`,
  }),
};

const tabStyle = css({
  appearance: 'none',
  display: 'inline-flex',
  alignItems: 'center',
  gap: vars.space[2],
  flexShrink: 0,
  minBlockSize: vars.space[8],
  border: 0,
  background: 'transparent',
  cursor: 'pointer',
  paddingBlock: vars.space[2],
  paddingInline: vars.space[3],
  font: 'inherit',
  fontSize: vars.textSize.sm,
  fontWeight: vars.fontWeight.medium,
  color: vars.color.textMuted,
  transitionProperty: 'color, border-color',
  transitionDuration: vars.motion.duration.fast,
  transitionTimingFunction: vars.motion.easeStandard,
  '&:hover:not(:disabled):not([aria-selected="true"])': {
    color: vars.color.text,
  },
  '&[aria-selected="true"]': {
    color: vars.color.text,
    borderColor: vars.color.accent,
  },
  '&:disabled': {
    opacity: 0.55,
    cursor: 'not-allowed',
  },
  '&:focus-visible': {
    ...focusRingInset,
  },
  [REDUCED_MOTION]: {
    transitionDuration: '0s',
  },
  [FORCED_COLORS]: {
    borderColor: 'Canvas',
    '&[aria-selected="true"]': { borderColor: 'Highlight' },
  },
});

const tabOrientationStyles: Record<TabsOrientation, SerializedStyles> = {
  horizontal: css({
    whiteSpace: 'nowrap',
    borderBlockEnd: '2px solid transparent',
    marginBlockEnd: '-1px',
  }),
  vertical: css({
    borderInlineEnd: '2px solid transparent',
    marginInlineEnd: '-1px',
    textAlign: 'start',
  }),
};

const panelStyle = css({
  minInlineSize: 0,
  overflowWrap: 'anywhere',
  color: vars.color.text,
  outline: 'none',
  '&:focus-visible': {
    ...focusRingOutset,
  },
  '&[hidden]': {
    display: 'none',
  },
});

const horizontalPanelStyle = css({ paddingBlockStart: vars.space[3] });

const materialListStyle = css({
  boxSizing: 'border-box',
  maxInlineSize: '100%',
  overflowX: 'auto',
  padding: vars.space[1],
  gap: vars.space[1],
  border: `1px solid ${vars.color.borderControl}`,
  borderRadius: vars.radius.full,
  backgroundColor: vars.color.surfaceRaised,
  boxShadow: vars.shadow.overlay,
  '&[data-draggable="true"]': { touchAction: 'pan-y' },
  [FORCED_COLORS]: { borderColor: 'CanvasText' },
});
const materialTabStyle = css({
  position: 'relative',
  isolation: 'isolate',
  justifyContent: 'center',
  boxSizing: 'border-box',
  minBlockSize: vars.space[12],
  minInlineSize: vars.space[12],
  maxInlineSize: '100%',
  margin: 0,
  border: '1px solid transparent',
  borderRadius: vars.radius.full,
  color: vars.color.text,
  whiteSpace: 'nowrap',
  '& > [data-ui="tabs-label"]': { minInlineSize: 0, overflow: 'hidden', textOverflow: 'ellipsis' },
  '&[aria-selected="true"]': { borderColor: vars.color.borderControl, fontWeight: vars.fontWeight.semibold },
  '&[data-tab-variant="action"]': { marginInlineStart: vars.space[2], borderColor: vars.color.borderControl },
  [FORCED_COLORS]: { '&[aria-selected="true"]': { borderColor: 'Highlight', textDecoration: 'underline' } },
});
const iconStyle = css({
  display: 'inline-flex',
  flexShrink: 0,
  inlineSize: vars.space[5],
  blockSize: vars.space[5],
  alignItems: 'center',
  justifyContent: 'center',
  '& > svg': { inlineSize: '100%', blockSize: '100%' },
});
const badgeStyle = css({
  borderRadius: vars.radius.full,
  paddingInline: vars.space[1],
  fontSize: vars.textSize.xs,
  backgroundColor: vars.color.surfaceRaised,
  color: vars.color.text,
});
const selectionStyle = css({
  position: 'absolute',
  inset: 0,
  zIndex: -1,
  pointerEvents: 'none',
  translate: 'var(--tabs-preview-x, 0px) 0',
  borderRadius: 'inherit',
  backgroundColor: vars.color.surfaceHover,
  [FORCED_COLORS]: { backgroundColor: 'Canvas', boxShadow: 'none' },
});
const indicatorStyles: Record<TabsIndicator, SerializedStyles> = {
  line: css({ insetBlockStart: 'auto', blockSize: vars.space[1], backgroundColor: vars.color.text, marginInline: vars.space[3] }),
  pill: css({ backgroundColor: vars.color.accentSoft }),
  lens: css({
    backgroundImage: `linear-gradient(${vars.color.surfaceHighlight}, ${vars.color.surfaceSheen})`,
    boxShadow: vars.shadow.raised,
  }),
};
const selectionFallbackStyle = css({
  [REDUCED_TRANSPARENCY]: {
    backgroundColor: vars.color.surfaceHover,
    backgroundImage: 'none',
  },
  [FORCED_COLORS]: {
    backgroundColor: 'Canvas',
    backgroundImage: 'none',
    boxShadow: 'none',
  },
});
const SELECTION_SPRING = { type: 'spring', stiffness: 420, damping: 38 } as const;
const GESTURE_THRESHOLD = 8;
const SCROLL_THRESHOLD = 8;

interface DragSnapshot {
  pointer: number;
  x: number;
  y: number;
  moved: boolean;
  items: Array<{ element: HTMLElement; value: string | undefined }>;
}

function Selection({ indicator }: { indicator: TabsIndicator }) {
  const reducedMotion = useReducedMotion();
  return (
    <motion.span
      aria-hidden="true"
      data-ui="tabs-selection"
      layoutId="selection"
      initial={false}
      transition={reducedMotion ? { duration: 0 } : SELECTION_SPRING}
      css={[selectionStyle, indicatorStyles[indicator], selectionFallbackStyle]}
    />
  );
}

function TabsRoot({
  ref,
  value: valueProp,
  defaultValue,
  onValueChange,
  orientation = 'horizontal',
  activation = 'auto',
  variant = 'line',
  indicator = variant === 'line' ? 'line' : variant === 'glass' ? 'pill' : 'lens',
  labels = 'always',
  compact: compactProp,
  defaultCompact = false,
  onCompactChange,
  locale,
  draggableIndicator = false,
  collapseOnScroll = false,
  scrollRef,
  className,
  sx,
  items,
  label,
  slotProps,
  slots,
  component,
  children,
  ...rest
}: TabsProps) {
  const baseId = useId();
  const [value, setValue] = useControlledState<string>(valueProp, defaultValue, onValueChange);
  const [focused, setFocused] = useState<string | null>(null);
  const [compact, setCompact] = useControlledState(compactProp, defaultCompact, onCompactChange);

  const context = useMemo(
    () => ({
      value, setValue, focused, setFocused, orientation, activation, baseId,
      variant, indicator, labels, compact: Boolean(compact), setCompact, locale,
      draggableIndicator, collapseOnScroll, scrollRef,
    }),
    [
      value, setValue, focused, orientation, activation, baseId, variant, indicator,
      labels, compact, setCompact, locale, draggableIndicator, collapseOnScroll, scrollRef,
    ],
  );
  const { sx: rootCss, className: rootClassName, style: rootStyleProp, ref: rootRef, 'data-ui': rootDataUi, ...rootProps } = slotProps?.root ?? {};
  const rootMarker = [...new Set(['tabs-root', ...(rootDataUi?.split(/\s+/).filter(Boolean) ?? [])])].join(' ');
  const mergedRef = useMergeRefs([ref, rootRef]);
  const RootPart = slots?.root ?? component ?? 'div';
  const ListPart = slots?.list ?? TabsList;
  const TabPart = slots?.tab ?? TabsTab;
  const PanelPart = slots?.panel ?? TabsPanel;

  return (
    <TabsContext.Provider value={context}>
      <MotionConfig reducedMotion="user">
        <LayoutGroup id={baseId}>
          <WithSx className={[rootClassName, className].filter(Boolean).join(' ')} styles={[rootStyle, rootCss]} sx={sx}>
            {(className) => (
              <RootPart
                {...rest}
                {...rootProps}
                style={{ ...rest.style, ...rootStyleProp }}
                ref={mergedRef}
                data-ui={rootMarker}
                data-orientation={orientation}
                data-variant={variant}
                data-compact={compact}
                className={className}
              >
                {items !== undefined ? (
                  <>
                    <ListPart {...slotProps?.list} aria-label={label}>
                      {items.map((item) => (
                        <TabPart
                          {...slotProps?.tab}
                          key={item.value}
                          value={item.value}
                          disabled={item.disabled}
                          icon={item.icon}
                          activeIcon={item.activeIcon}
                          badge={item.badge}
                          badgeLabel={item.badgeLabel}
                        >
                          {item.label}
                        </TabPart>
                      ))}
                    </ListPart>
                    {items.map((item) => (
                      <PanelPart {...slotProps?.panel} key={item.value} value={item.value}>
                        {item.panel}
                      </PanelPart>
                    ))}
                  </>
                ) : children}
              </RootPart>
            )}
          </WithSx>
        </LayoutGroup>
      </MotionConfig>
    </TabsContext.Provider>
  );
}

TabsRoot.displayName = 'Tabs';

function TabsList({
  ref, onKeyDown, onPointerDown, onPointerMove, onPointerUp, onPointerCancel,
  onLostPointerCapture, onClickCapture, className, sx, ...rest
}: TabsListProps) {
  const {
    orientation, value, setValue, focused, setFocused, variant,
    draggableIndicator, collapseOnScroll, scrollRef, setCompact,
  } = useTabsContext('List');
  const listRef = useRef<HTMLDivElement>(null);
  const gesture = useRef<DragSnapshot | null>(null);
  const suppressClick = useRef(false);
  const clickTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useImperativeHandle(ref, () => listRef.current as HTMLDivElement, []);

  const cancelGesture = () => {
    const current = gesture.current;
    gesture.current = null;
    const list = listRef.current;
    list?.style.removeProperty('--tabs-preview-x');
    if (current && list?.hasPointerCapture(current.pointer)) list.releasePointerCapture(current.pointer);
  };

  useEffect(() => {
    cancelGesture();
    return () => {
      cancelGesture();
      clearTimeout(clickTimer.current);
    };
  }, [value, draggableIndicator, variant]);

  useEffect(() => {
    const list = listRef.current;
    if (!list || !collapseOnScroll || variant === 'line') return;
    const view = list.ownerDocument.defaultView;
    const container = scrollRef?.current;
    const target = container ?? view;
    if (!target) return;
    const read = () => container ? container.scrollTop : view?.scrollY ?? 0;
    let last = read();
    const scroll = () => {
      const next = read();
      if (list.contains(list.ownerDocument.activeElement) || gesture.current) {
        last = next;
        return;
      }
      if (Math.abs(next - last) < SCROLL_THRESHOLD) return;
      setCompact(next > last);
      last = next;
    };
    target.addEventListener('scroll', scroll, { passive: true });
    return () => target.removeEventListener('scroll', scroll);
  });

  // Keep exactly one tab in the page tab order, preferring (in order): the focused tab, the
  // selected tab, the first enabled tab. This also recovers when the focused or selected tab
  // becomes disabled or is removed.
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const tabs = queryOwnedItems(list, TAB_QUERY);
    if (tabs.length === 0) return;
    if (tabs.some((tab) => tab.tabIndex === 0)) return;
    setFocused((findByValue(tabs, value) ?? findByValue(tabs, focused) ?? tabs[0])?.dataset.value ?? null);
  });

  useEffect(() => {
    const list = listRef.current;
    if (!list || orientation !== 'horizontal') return;
    const target = findByValue(queryOwnedItems(list, TAB_QUERY), focused ?? value);
    if (!target) return;
    const bounds = list.getBoundingClientRect();
    const item = target.getBoundingClientRect();
    const gutter = parseFloat(getComputedStyle(list).paddingInlineStart) || 0;
    const start = bounds.left + gutter;
    const end = bounds.right - gutter;
    const delta = item.left < start ? item.left - start : item.right > end ? item.right - end : 0;
    if (delta) list.scrollBy({ left: delta, behavior: 'instant' });
  }, [focused, value, orientation, variant]);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(event);
    const list = listRef.current;
    if (event.defaultPrevented || !list) return;
    if (event.key === 'Escape' && gesture.current) {
      event.preventDefault();
      cancelGesture();
      return;
    }
    moveRovingFocus(event, list, orientation, TAB_QUERY);
  };

  const startDrag = (event: PointerEvent<HTMLDivElement>) => {
    onPointerDown?.(event);
    if (event.defaultPrevented || !draggableIndicator || variant === 'line' || event.button !== 0 || !event.isPrimary) return;
    const target = (event.target as HTMLElement).closest<HTMLElement>('[role="tab"]');
    if (
      !target || target.closest('[role="tablist"]') !== event.currentTarget ||
      target.dataset.value !== value || target.hasAttribute('disabled') ||
      target.dataset.tabVariant === 'action'
    ) return;
    gesture.current = {
      pointer: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      moved: false,
      items: queryOwnedItems(event.currentTarget, TAB_QUERY).map((element) => ({ element, value: element.dataset.value })),
    };
  };

  const moveDrag = (event: PointerEvent<HTMLDivElement>) => {
    onPointerMove?.(event);
    const current = gesture.current;
    if (event.defaultPrevented || !current || current.pointer !== event.pointerId) return;
    const x = event.clientX - current.x;
    const y = event.clientY - current.y;
    if (!current.moved && Math.abs(y) > Math.abs(x) && Math.abs(y) >= GESTURE_THRESHOLD) {
      cancelGesture();
      return;
    }
    if (!current.moved && Math.abs(x) < GESTURE_THRESHOLD) return;
    current.moved = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    event.currentTarget.style.setProperty('--tabs-preview-x', `${x}px`);
  };

  const finishDrag = (event: PointerEvent<HTMLDivElement>) => {
    onPointerUp?.(event);
    const current = gesture.current;
    if (!current || current.pointer !== event.pointerId) return;
    if (current.moved) {
      suppressClick.current = true;
      clearTimeout(clickTimer.current);
      clickTimer.current = setTimeout(() => { suppressClick.current = false; }, 0);
      const items = queryOwnedItems(event.currentTarget, TAB_QUERY);
      const unchanged = items.length === current.items.length && items.every((item, index) =>
        item === current.items[index]?.element && item.dataset.value === current.items[index]?.value,
      );
      if (!event.defaultPrevented && unchanged) {
        const nearest = items.reduce<HTMLElement | undefined>((best, item) => {
          const rect = item.getBoundingClientRect();
          const previous = best?.getBoundingClientRect();
          const distance = Math.abs(event.clientX - (rect.left + rect.width / 2));
          const previousDistance = previous ? Math.abs(event.clientX - (previous.left + previous.width / 2)) : Infinity;
          return distance < previousDistance ? item : best;
        }, undefined);
        if (nearest?.dataset.value !== undefined) {
          setFocused(nearest.dataset.value);
          setValue(nearest.dataset.value);
        }
      }
    }
    cancelGesture();
  };

  return (
    <WithSx className={className} styles={[listStyles[orientation], variant !== 'line' && materialListStyle, variant !== 'line' && translucentControlStyle]} sx={sx}>
      {(className) => (
        <div
          {...rest}
          ref={listRef}
          role="tablist"
          aria-orientation={orientation}
          data-ui="tabs-list"
          data-orientation={orientation}
          data-draggable={draggableIndicator}
          data-roving={focused ?? ''}
          data-selected={value ?? ''}
          onKeyDown={handleKeyDown}
          onPointerDown={startDrag}
          onPointerMove={moveDrag}
          onPointerUp={finishDrag}
          onPointerCancel={(event) => { onPointerCancel?.(event); cancelGesture(); }}
          onLostPointerCapture={(event) => { onLostPointerCapture?.(event); cancelGesture(); }}
          onClickCapture={(event) => {
            onClickCapture?.(event);
            if (suppressClick.current && event.detail !== 0) {
              event.preventDefault();
              event.stopPropagation();
              suppressClick.current = false;
            }
          }}
          className={className}
        />
      )}
    </WithSx>
  );
}

TabsList.displayName = 'Tabs.List';

function TabsTab({ ref, value, disabled, onClick, onFocus, onPointerDown, className, sx, icon, activeIcon, badge, badgeLabel, variant: tabVariant = 'default', children, ...rest }: TabsTabProps) {
  const {
    value: selectedValue,
    setValue,
    focused,
    setFocused,
    activation,
    baseId,
    orientation,
    variant,
    indicator,
    labels,
    compact,
    setCompact,
    locale,
  } = useTabsContext('Tab');
  const isSelected = selectedValue === value;
  const isTabStop = !disabled && (focused !== null ? focused === value : isSelected);
  const shownIcon = isSelected ? activeIcon ?? icon : icon;
  const hasIcon = isRenderable(shownIcon);
  const hideLabel = hasIcon && (compact || labels === 'none' || (labels === 'active' && !isSelected));
  const visibleBadge = typeof badge === 'number'
    ? Number.isInteger(badge) && badge > 0 ? new Intl.NumberFormat(locale).format(badge) : undefined
    : badge || undefined;
  const badgeId = useId();
  // Tracks whether the focus event already issued the selection request for this activation,
  // so a click following that focus never notifies twice.
  const focusRequestRef = useRef(false);

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    onClick?.(event);
    if (event.defaultPrevented) return;
    const focusAlreadyRequested = focusRequestRef.current;
    focusRequestRef.current = false;
    // Auto activation normally requests selection from the focus event. A click on a tab
    // that was already focused (repeat click after a rejected controlled request, or Enter
    // on a focused tab) must still issue exactly one request.
    if (activation === 'auto' && focusAlreadyRequested && event.detail !== 0) return;
    setValue(value);
  };

  const handleFocus = (event: FocusEvent<HTMLButtonElement>) => {
    onFocus?.(event);
    if (event.defaultPrevented) return;
    focusRequestRef.current = true;
    setFocused(value);
    if (compact) setCompact(false);
    if (activation === 'auto') setValue(value);
  };

  return (
    <WithSx className={className} styles={[tabStyle, tabOrientationStyles[orientation], variant !== 'line' && materialTabStyle]} sx={sx}>
      {(className) => (
        <button
          {...rest}
          ref={ref}
          type="button"
          role="tab"
          id={partId(baseId, 'tab', value)}
          data-ui="tabs-tab"
          data-value={value}
          data-state={isSelected ? 'active' : 'inactive'}
          data-tab-variant={tabVariant}
          aria-describedby={[rest['aria-describedby'], visibleBadge && badgeLabel && badgeId].filter(Boolean).join(' ') || undefined}
          aria-selected={isSelected}
          aria-controls={partId(baseId, 'panel', value)}
          tabIndex={isTabStop ? 0 : -1}
          disabled={disabled}
          onClick={handleClick}
          onFocus={handleFocus}
          onPointerDown={(event) => {
            focusRequestRef.current = false;
            onPointerDown?.(event);
          }}
          className={className}
        >
          {isSelected && !disabled && variant !== 'line' && tabVariant !== 'action' && <Selection indicator={indicator} />}
          {hasIcon && <span aria-hidden="true" data-ui="tabs-icon" css={iconStyle}>{shownIcon}</span>}
          <span data-ui="tabs-label" css={hideLabel && visuallyHiddenStyle}>{children}</span>
          {visibleBadge && <span aria-hidden={Boolean(badgeLabel)} css={badgeStyle}>{visibleBadge}</span>}
          {visibleBadge && badgeLabel && <span id={badgeId} hidden>{badgeLabel}</span>}
        </button>
      )}
    </WithSx>
  );
}

TabsTab.displayName = 'Tabs.Tab';

/** Show the content associated with the selected tab. */
function TabsPanel({
  ref,
  value,
  tabIndex = 0,
  'aria-labelledby': ariaLabelledByProp,
  className,
  sx,
  ...rest
}: TabsPanelProps) {
  const { value: selectedValue, baseId, orientation } = useTabsContext('Panel');
  const isSelected = selectedValue === value;
  const ariaLabelledBy =
    [ariaLabelledByProp, partId(baseId, 'tab', value)].filter(Boolean).join(' ') || undefined;

  return (
    <WithSx
      className={className}
      styles={[panelStyle, orientation === 'horizontal' && horizontalPanelStyle]}
      sx={sx}
    >
      {(className) => (
        <div
          {...rest}
          ref={ref}
          role="tabpanel"
          id={partId(baseId, 'panel', value)}
          aria-labelledby={ariaLabelledBy}
          tabIndex={tabIndex}
          hidden={!isSelected}
          data-ui="tabs-panel"
          data-state={isSelected ? 'active' : 'inactive'}
          className={className}
        />
      )}
    </WithSx>
  );
}

TabsPanel.displayName = 'Tabs.Panel';

export const Tabs = Object.assign(TabsRoot, { List: TabsList, Tab: TabsTab, Panel: TabsPanel });
