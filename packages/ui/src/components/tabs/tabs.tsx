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
  type FocusEvent,
  type KeyboardEvent,
  type MouseEvent,
} from 'react';
import { vars } from '@jfrader/tokens/vars';
import { css, type SerializedStyles } from '../../styling/css';
import { focusRingInset, focusRingOutset } from '../../styling/focus-ring';
import { REDUCED_MOTION } from '../../styling/media';
import { partId } from '../../utils/part-id';
import { findByValue, moveRovingFocus, queryOwnedItems, type OwnedItemsQuery } from '../../utils/roving-focus';
import { useControlledState } from '../../utils/use-controlled-state';

export type TabsOrientation = 'horizontal' | 'vertical';
export type TabsActivation = 'auto' | 'manual';

export interface TabsProps extends Omit<ComponentPropsWithRef<'div'>, 'onChange' | 'defaultValue'> {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  orientation?: TabsOrientation;
  activation?: TabsActivation;
}

export type TabsListProps = ComponentPropsWithRef<'div'>;

export interface TabsTabProps extends ComponentPropsWithRef<'button'> {
  value: string;
}

export interface TabsPanelProps extends ComponentPropsWithRef<'div'> {
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
  '&[data-orientation="vertical"]': {
    display: 'flex',
    alignItems: 'flex-start',
    gap: vars.space[4],
  },
});

const listStyles: Record<TabsOrientation, SerializedStyles> = {
  horizontal: css({
    display: 'inline-flex',
    gap: vars.space[1],
    borderBlockEnd: `1px solid ${vars.color.border}`,
  }),
  vertical: css({
    display: 'inline-flex',
    flexDirection: 'column',
    alignItems: 'stretch',
    borderInlineEnd: `1px solid ${vars.color.border}`,
  }),
};

const tabStyle = css({
  appearance: 'none',
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
});

const tabOrientationStyles: Record<TabsOrientation, SerializedStyles> = {
  horizontal: css({
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

function TabsRoot({
  ref,
  value: valueProp,
  defaultValue,
  onValueChange,
  orientation = 'horizontal',
  activation = 'auto',
  ...rest
}: TabsProps) {
  const baseId = useId();
  const [value, setValue] = useControlledState<string>(valueProp, defaultValue, onValueChange);
  const [focused, setFocused] = useState<string | null>(null);

  const context = useMemo(
    () => ({ value, setValue, focused, setFocused, orientation, activation, baseId }),
    [value, setValue, focused, orientation, activation, baseId],
  );

  return (
    <TabsContext.Provider value={context}>
      <div {...rest} ref={ref} data-ui="tabs-root" data-orientation={orientation} css={rootStyle} />
    </TabsContext.Provider>
  );
}

TabsRoot.displayName = 'Tabs';

function TabsList({ ref, onKeyDown, ...rest }: TabsListProps) {
  const { orientation, value, focused, setFocused } = useTabsContext('List');
  const listRef = useRef<HTMLDivElement>(null);
  useImperativeHandle(ref, () => listRef.current as HTMLDivElement, []);

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

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(event);
    const list = listRef.current;
    if (event.defaultPrevented || !list) return;
    moveRovingFocus(event, list, orientation, TAB_QUERY);
  };

  return (
    <div
      {...rest}
      ref={listRef}
      role="tablist"
      aria-orientation={orientation}
      data-ui="tabs-list"
      data-orientation={orientation}
      data-roving={focused ?? ''}
      data-selected={value ?? ''}
      onKeyDown={handleKeyDown}
      css={listStyles[orientation]}
    />
  );
}

TabsList.displayName = 'Tabs.List';

function TabsTab({ ref, value, disabled, onClick, onFocus, ...rest }: TabsTabProps) {
  const {
    value: selectedValue,
    setValue,
    focused,
    setFocused,
    activation,
    baseId,
    orientation,
  } = useTabsContext('Tab');
  const isSelected = selectedValue === value;
  const isTabStop = !disabled && (focused !== null ? focused === value : isSelected);
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
    if (activation === 'auto' && focusAlreadyRequested) return;
    setValue(value);
  };

  const handleFocus = (event: FocusEvent<HTMLButtonElement>) => {
    onFocus?.(event);
    if (event.defaultPrevented) return;
    focusRequestRef.current = true;
    setFocused(value);
    if (activation === 'auto') setValue(value);
  };

  return (
    <button
      {...rest}
      ref={ref}
      type="button"
      role="tab"
      id={partId(baseId, 'tab', value)}
      data-ui="tabs-tab"
      data-value={value}
      data-state={isSelected ? 'active' : 'inactive'}
      aria-selected={isSelected}
      aria-controls={partId(baseId, 'panel', value)}
      tabIndex={isTabStop ? 0 : -1}
      disabled={disabled}
      onClick={handleClick}
      onFocus={handleFocus}
      css={[tabStyle, tabOrientationStyles[orientation]]}
    />
  );
}

TabsTab.displayName = 'Tabs.Tab';

function TabsPanel({ ref, value, tabIndex = 0, 'aria-labelledby': ariaLabelledByProp, ...rest }: TabsPanelProps) {
  const { value: selectedValue, baseId, orientation } = useTabsContext('Panel');
  const isSelected = selectedValue === value;
  const ariaLabelledBy =
    [ariaLabelledByProp, partId(baseId, 'tab', value)].filter(Boolean).join(' ') || undefined;

  return (
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
      css={[panelStyle, orientation === 'horizontal' && horizontalPanelStyle]}
    />
  );
}

TabsPanel.displayName = 'Tabs.Panel';

export const Tabs = Object.assign(TabsRoot, { List: TabsList, Tab: TabsTab, Panel: TabsPanel });
