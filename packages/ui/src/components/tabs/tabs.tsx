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
  type ReactNode,
} from 'react';
import { vars } from '@jfrader/tokens/vars';
import { useMergeRefs } from '@floating-ui/react';
import { css, type Interpolation, type SerializedStyles, type Theme } from '../../styling/css';
import { focusRingInset, focusRingOutset } from '../../styling/focus-ring';
import { FORCED_COLORS, REDUCED_MOTION } from '../../styling/media';
import { WithSx, type SxProps } from '../../styling/sx';
import { partId } from '../../utils/part-id';
import { findByValue, moveRovingFocus, queryOwnedItems, type OwnedItemsQuery } from '../../utils/roving-focus';
import { useControlledState } from '../../utils/use-controlled-state';

export type TabsOrientation = 'horizontal' | 'vertical';
export type TabsActivation = 'auto' | 'manual';

interface TabsStateProps extends Omit<ComponentPropsWithRef<'div'>, 'onChange' | 'defaultValue' | 'children'>, SxProps {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  orientation?: TabsOrientation;
  activation?: TabsActivation;
}

export interface TabsSection {
  value: string;
  label: ReactNode;
  panel: ReactNode;
  disabled?: boolean;
}

export interface TabsCompoundProps extends TabsStateProps {
  children?: ReactNode;
  items?: never;
  label?: never;
  slotProps?: never;
  slots?: never;
  component?: never;
}

export interface TabsEasyProps extends TabsStateProps {
  /** Name the tab list. */
  label: string;
  /** Pair each tab with its panel by value. */
  items: readonly TabsSection[];
  children?: never;
  slotProps?: TabsSlotProps;
  slots?: TabsSlots;
  component?: TabsSlots['root'];
}

export interface TabsSlots {
  root?: ComponentType<ComponentPropsWithRef<'div'>>;
  list?: ComponentType<TabsListProps>;
  tab?: ComponentType<TabsTabProps>;
  panel?: ComponentType<TabsPanelProps>;
}

export interface TabsSlotProps {
  root?: Omit<ComponentPropsWithRef<'div'>, 'children'> & { css?: Interpolation<Theme>; 'data-ui'?: string };
  list?: Omit<TabsListProps, 'children' | 'aria-label'> & { css?: Interpolation<Theme> };
  tab?: Omit<TabsTabProps, 'children' | 'value' | 'disabled'> & { css?: Interpolation<Theme> };
  panel?: Omit<TabsPanelProps, 'children' | 'value'> & { css?: Interpolation<Theme> };
}

export type TabsProps = TabsCompoundProps | TabsEasyProps;

export type TabsListProps = ComponentPropsWithRef<'div'> & SxProps;

export interface TabsTabProps extends ComponentPropsWithRef<'button'>, SxProps {
  value: string;
}

export interface TabsPanelProps extends ComponentPropsWithRef<'div'>, SxProps {
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
  [FORCED_COLORS]: {
    borderColor: 'Canvas',
    '&[aria-selected="true"]': { borderColor: 'Highlight' },
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

  const context = useMemo(
    () => ({ value, setValue, focused, setFocused, orientation, activation, baseId }),
    [value, setValue, focused, orientation, activation, baseId],
  );
  const { css: rootCss, className: rootClassName, style: rootStyleProp, ref: rootRef, 'data-ui': rootDataUi, ...rootProps } = slotProps?.root ?? {};
  const rootMarker = [...new Set(['tabs-root', ...(rootDataUi?.split(/\s+/).filter(Boolean) ?? [])])].join(' ');
  const mergedRef = useMergeRefs([ref, rootRef]);
  const RootPart = slots?.root ?? component ?? 'div';
  const ListPart = slots?.list ?? TabsList;
  const TabPart = slots?.tab ?? TabsTab;
  const PanelPart = slots?.panel ?? TabsPanel;

  return (
    <TabsContext.Provider value={context}>
      <WithSx className={[rootClassName, className].filter(Boolean).join(' ')} styles={[rootStyle, rootCss]} sx={sx}>
        {(className) => (
          <RootPart {...rest} {...rootProps} style={{ ...rest.style, ...rootStyleProp }} ref={mergedRef} data-ui={rootMarker} data-orientation={orientation} className={className}>
            {items !== undefined ? (
              <>
                <ListPart {...slotProps?.list} aria-label={label}>
                  {items.map((item) => (
                    <TabPart {...slotProps?.tab} key={item.value} value={item.value} disabled={item.disabled}>
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
    </TabsContext.Provider>
  );
}

TabsRoot.displayName = 'Tabs';

function TabsList({ ref, onKeyDown, className, sx, ...rest }: TabsListProps) {
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
    <WithSx className={className} styles={listStyles[orientation]} sx={sx}>
      {(className) => (
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
          className={className}
        />
      )}
    </WithSx>
  );
}

TabsList.displayName = 'Tabs.List';

function TabsTab({ ref, value, disabled, onClick, onFocus, onPointerDown, className, sx, ...rest }: TabsTabProps) {
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
    if (activation === 'auto' && focusAlreadyRequested && event.detail !== 0) return;
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
    <WithSx className={className} styles={[tabStyle, tabOrientationStyles[orientation]]} sx={sx}>
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
        />
      )}
    </WithSx>
  );
}

TabsTab.displayName = 'Tabs.Tab';

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
