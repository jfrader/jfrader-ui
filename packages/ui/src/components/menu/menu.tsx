// APG pattern: menu button. The trigger exposes aria-haspopup="menu", aria-expanded and (while
// open) aria-controls; the menu is labelled by the trigger. Items use real DOM focus with a
// roving tabindex.
// Keyboard map: on the trigger, Enter/Space/ArrowDown open on the first enabled item and
// ArrowUp opens on the last. In the menu, ArrowDown/ArrowUp move and wrap, Home/End jump,
// printable characters jump to the next matching enabled item (buffer resets after 500ms),
// Enter/Space activate, Escape closes and returns focus to the trigger, and Tab closes and
// lets focus move on.
// Pointer open also focuses the first enabled item (one initial-focus authority:
// useListNavigation with focusItemOnOpen; FloatingFocusManager's own initial focus is off).
// Focus return is explicit: only an ACCEPTED Escape or item selection restores focus to the
// trigger (a rejected controlled dismissal keeps focus inside); Tab-out and outside presses
// never move focus (returnFocus is off, so no transient trigger focus either).
// Disabled items stay in the list with aria-disabled="true"; arrows and typeahead skip them.
// Consumer trigger handlers run before the menu's own; preventDefault() vetoes the open request.
// The menu is labelled by the trigger; consumer aria-labelledby ids join it and a consumer
// aria-label replaces it.
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentPropsWithRef,
  type CSSProperties,
  type HTMLProps,
  type MouseEvent,
  type MutableRefObject,
  type ReactNode,
} from 'react';
import {
  FloatingFocusManager,
  FloatingList,
  useClick,
  useDismiss,
  useInteractions,
  useListNavigation,
  useMergeRefs,
  useRole,
  useTypeahead,
  type Placement,
  type UseInteractionsReturn,
} from '@floating-ui/react';
import { vars } from '@jfrader/tokens/vars';
import { css, type Interpolation, type Theme } from '../../styling/css';
import { focusRingInset } from '../../styling/focus-ring';
import { listboxItemStateStyle, listboxSurfaceStyle } from '../../styling/listbox-style';
import { REDUCED_MOTION } from '../../styling/media';
import { WithSx, type SxProps } from '../../styling/sx';
import { triggerStyle } from '../../styling/trigger-style';
import { IsolatedOverlay } from '../../overlay/overlay-layer';
import { OverlayPortal } from '../../overlay/overlay-portal';
import { useOverlayFloating } from '../../overlay/use-overlay-floating';
import { useCollectionIndexRegistration, useCollectionListItem } from '../../utils/collection-registry';
import { useControlledState } from '../../utils/use-controlled-state';

const TYPEAHEAD_RESET_MS = 500;

export interface MenuProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  placement?: Placement;
  children?: ReactNode;
}

export interface MenuTriggerProps extends ComponentPropsWithRef<'button'>, SxProps {}
export interface MenuContentProps extends ComponentPropsWithRef<'div'>, SxProps {}
export interface MenuItemProps extends Omit<ComponentPropsWithRef<'button'>, 'onSelect'>, SxProps {
  /** Called when the item is activated. The menu then closes unless a click handler called
   * `event.preventDefault()`. */
  onSelect?: () => void;
  disabled?: boolean;
}
export interface MenuSeparatorProps extends ComponentPropsWithRef<'div'>, SxProps {}

type OverlayFloating = ReturnType<typeof useOverlayFloating>;

interface MenuContextValue {
  open: boolean;
  requestClose: (restoreFocus?: boolean) => void;
  activeIndex: number | null;
  refs: OverlayFloating['refs'];
  floatingContext: OverlayFloating['context'];
  floatingStyles: CSSProperties;
  elementsRef: MutableRefObject<Array<HTMLElement | null>>;
  labelsRef: MutableRefObject<Array<string | null>>;
  disabledIndices: Set<number>;
  getReferenceProps: UseInteractionsReturn['getReferenceProps'];
  getFloatingProps: UseInteractionsReturn['getFloatingProps'];
  getItemProps: UseInteractionsReturn['getItemProps'];
}

/**
 * Private seam for component families built on the menu controller (Menu, SplitButton): the
 * family names usage errors, `marker` is the part's data-ui and `styles` its own styles.
 */
export interface MenuPartIdentity {
  family: string;
  marker: string;
  styles?: Interpolation<Theme>;
}

const MenuContext = createContext<MenuContextValue | null>(null);
// Set by the content part: items may only render inside it (they register with its FloatingList).
const MenuContentContext = createContext(false);

function useMenuContext(family: string, part: string): MenuContextValue {
  const context = useContext(MenuContext);
  if (!context) throw new Error(`${family}.${part} must be rendered inside <${family}>.`);
  return context;
}

function useMenuItemContext(family: string): MenuContextValue {
  const context = useMenuContext(family, 'Item');
  if (!useContext(MenuContentContext)) throw new Error(`${family}.Item must be rendered inside <${family}.Content>.`);
  return context;
}

type EventHandler = (event: { defaultPrevented: boolean }) => unknown;

const isHandlerKey = (key: string) => /^on[A-Z]/.test(key);

/**
 * Runs each consumer handler before the matching interaction handler; a consumer
 * `preventDefault()` vetoes the internal request (open, toggle, navigation).
 */
function consumerHandlersFirst(
  props: HTMLProps<Element>,
  getProps: (userProps: HTMLProps<Element>) => Record<string, unknown>,
) {
  const consumer: Record<string, EventHandler> = {};
  const attributes: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(props)) {
    if (isHandlerKey(key) && typeof value === 'function') consumer[key] = value as EventHandler;
    else attributes[key] = value;
  }
  const merged = getProps(attributes as HTMLProps<Element>);
  for (const [key, handler] of Object.entries(consumer)) {
    const internal = merged[key] as EventHandler | undefined;
    merged[key] = (event: { defaultPrevented: boolean }) => {
      handler(event);
      if (!event.defaultPrevented) internal?.(event);
    };
  }
  return merged;
}

const joinIds = (...ids: Array<string | undefined>) => ids.filter(Boolean).join(' ') || undefined;

const itemStyle = css({
  appearance: 'none',
  boxSizing: 'border-box',
  display: 'flex',
  alignItems: 'center',
  inlineSize: '100%',
  minBlockSize: '32px',
  border: 0,
  borderRadius: vars.radius.sm,
  backgroundColor: 'transparent',
  paddingBlock: vars.space[1],
  paddingInline: vars.space[2],
  font: 'inherit',
  fontSize: vars.textSize.sm,
  color: vars.color.text,
  textAlign: 'start',
  cursor: 'pointer',
  transitionProperty: 'background-color',
  transitionDuration: vars.motion.duration.fast,
  transitionTimingFunction: vars.motion.easeStandard,
  '&:focus-visible': {
    ...focusRingInset,
  },
  [REDUCED_MOTION]: {
    transitionDuration: '0s',
  },
});

const separatorStyle = css({
  blockSize: '1px',
  marginBlock: vars.space[1],
  backgroundColor: vars.color.border,
});

/** Own styles of a menu item, for families that layer their own item styles on top. */
export const menuItemStyles = [itemStyle, listboxItemStateStyle];
/** Own styles of a menu separator. */
export const menuSeparatorStyles = separatorStyle;

function MenuOverlay({
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  placement = 'bottom-start',
  children,
}: MenuProps) {
  const [open = false, requestOpenChange] = useControlledState<boolean>(openProp, defaultOpen, onOpenChange);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const elementsRef = useRef<Array<HTMLElement | null>>([]);
  const labelsRef = useRef<Array<string | null>>([]);
  // Items report their disabled state here by list index (see Menu.Item).
  const disabledIndicesRef = useRef(new Set<number>());
  const pendingFocusRestoreRef = useRef(false);

  const { refs, floatingStyles, context } = useOverlayFloating({
    open,
    placement,
    onOpenChange: (next, _event, reason) => {
      // Escape requests a close; focus is restored only once the close is actually applied.
      if (!next) pendingFocusRestoreRef.current = reason === 'escape-key';
      requestOpenChange(next);
    },
  });

  // A rejected controlled dismissal keeps the menu open, so focus stays inside it.
  useEffect(() => {
    if (!open && pendingFocusRestoreRef.current) {
      pendingFocusRestoreRef.current = false;
      refs.domReference.current?.focus();
    }
  }, [open, refs]);

  const click = useClick(context);
  const role = useRole(context, { role: 'menu' });
  const dismiss = useDismiss(context, { escapeKey: true, outsidePress: true });
  const listNavigation = useListNavigation(context, {
    listRef: elementsRef,
    activeIndex,
    onNavigate: setActiveIndex,
    loop: true,
    orientation: 'vertical',
    disabledIndices: (index) => disabledIndicesRef.current.has(index),
    focusItemOnOpen: true,
  });
  const typeahead = useTypeahead(context, {
    listRef: labelsRef,
    activeIndex,
    onMatch: open ? setActiveIndex : undefined,
    resetMs: TYPEAHEAD_RESET_MS,
  });
  const { getReferenceProps, getFloatingProps, getItemProps } = useInteractions([
    click,
    role,
    dismiss,
    listNavigation,
    typeahead,
  ]);

  const value = useMemo(
    () => ({
      open,
      requestClose: (restoreFocus = false) => {
        if (restoreFocus) pendingFocusRestoreRef.current = true;
        requestOpenChange(false);
      },
      activeIndex,
      refs,
      floatingContext: context,
      floatingStyles,
      elementsRef,
      labelsRef,
      disabledIndices: disabledIndicesRef.current,
      getReferenceProps,
      getFloatingProps,
      getItemProps,
    }),
    [
      open,
      requestOpenChange,
      activeIndex,
      refs,
      context,
      floatingStyles,
      getReferenceProps,
      getFloatingProps,
      getItemProps,
    ],
  );

  return <MenuContext.Provider value={value}>{children}</MenuContext.Provider>;
}

function MenuRoot(props: MenuProps) {
  return (
    <IsolatedOverlay>
      <MenuOverlay {...props} />
    </IsolatedOverlay>
  );
}

MenuRoot.displayName = 'Menu';

export function MenuTriggerPart({
  family,
  marker,
  styles,
  ref,
  className,
  sx,
  ...props
}: MenuTriggerProps & MenuPartIdentity) {
  const { refs, getReferenceProps } = useMenuContext(family, 'Trigger');
  const mergedRef = useMergeRefs([refs.setReference, ref]);

  return (
    <WithSx className={className} styles={styles} sx={sx}>
      {(className) => (
        <button
          type="button"
          {...consumerHandlersFirst(props, getReferenceProps)}
          ref={mergedRef}
          data-ui={marker}
          className={className}
        />
      )}
    </WithSx>
  );
}

function MenuTrigger(props: MenuTriggerProps) {
  return <MenuTriggerPart {...props} family="Menu" marker="menu-trigger" styles={triggerStyle} />;
}

MenuTrigger.displayName = 'Menu.Trigger';

export function MenuContentPart({
  family,
  marker,
  styles,
  ref,
  style,
  children,
  className,
  sx,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  ...rest
}: MenuContentProps & MenuPartIdentity) {
  const { open, refs, floatingContext, floatingStyles, elementsRef, labelsRef, getFloatingProps } =
    useMenuContext(family, 'Content');
  const mergedRef = useMergeRefs([refs.setFloating, ref]);

  if (!open) return null;

  const floatingProps = getFloatingProps(rest);
  // The trigger names the menu; consumer ids join it, and a consumer aria-label replaces it.
  const triggerLabel = floatingProps['aria-labelledby'] as string | undefined;
  const labelledBy =
    ariaLabelledBy !== undefined ? joinIds(ariaLabelledBy, triggerLabel) : ariaLabel !== undefined ? undefined : triggerLabel;

  return (
    <OverlayPortal>
      {/* Non-modal: no trap; Tab closes via focus-out. Focus return is explicit (see
          requestClose) — returnFocus is off so an outside press never transiently focuses
          the trigger. */}
      <FloatingFocusManager
        context={floatingContext}
        modal={false}
        initialFocus={-1}
        returnFocus={false}
        restoreFocus
      >
        <WithSx className={className} styles={styles} sx={sx}>
          {(className) => (
            <div
              {...floatingProps}
              aria-label={ariaLabel}
              aria-labelledby={labelledBy}
              ref={mergedRef}
              data-ui={marker}
              style={{ ...style, ...floatingStyles }}
              className={className}
            >
              <FloatingList elementsRef={elementsRef} labelsRef={labelsRef}>
                <MenuContentContext.Provider value>{children}</MenuContentContext.Provider>
              </FloatingList>
            </div>
          )}
        </WithSx>
      </FloatingFocusManager>
    </OverlayPortal>
  );
}

function MenuContent(props: MenuContentProps) {
  return <MenuContentPart {...props} family="Menu" marker="menu" styles={listboxSurfaceStyle} />;
}

MenuContent.displayName = 'Menu.Content';

export function MenuItemPart({
  family,
  marker,
  styles,
  ref,
  onSelect,
  disabled = false,
  onClick,
  className,
  sx,
  ...rest
}: MenuItemProps & MenuPartIdentity) {
  const { activeIndex, requestClose, disabledIndices, getItemProps } = useMenuItemContext(family);
  // A null label removes disabled items from typeahead; undefined falls back to textContent.
  const { ref: listItemRef, index } = useCollectionListItem({ label: disabled ? null : undefined });
  const mergedRef = useMergeRefs([listItemRef, ref]);
  const isActive = index !== -1 && activeIndex === index;

  // Layout effect so the registry is current before list navigation picks the initial item.
  useCollectionIndexRegistration(index, disabled, disabledIndices);

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (disabled) return;
    onClick?.(event);
    onSelect?.();
    if (!event.defaultPrevented) requestClose(true);
  };

  return (
    <WithSx className={className} styles={styles} sx={sx}>
      {(className) => (
        <button
          type="button"
          {...getItemProps({ ...rest, onClick: handleClick })}
          ref={mergedRef}
          role="menuitem"
          tabIndex={isActive ? 0 : -1}
          aria-disabled={disabled || undefined}
          data-active={isActive || undefined}
          data-ui={marker}
          className={className}
        />
      )}
    </WithSx>
  );
}

function MenuItem(props: MenuItemProps) {
  return <MenuItemPart {...props} family="Menu" marker="menu-item" styles={menuItemStyles} />;
}

MenuItem.displayName = 'Menu.Item';

export function MenuSeparatorPart({
  marker,
  styles,
  ref,
  className,
  sx,
  ...props
}: MenuSeparatorProps & Omit<MenuPartIdentity, 'family'>) {
  return (
    <WithSx className={className} styles={styles} sx={sx}>
      {(className) => <div {...props} ref={ref} role="separator" data-ui={marker} className={className} />}
    </WithSx>
  );
}

function MenuSeparator(props: MenuSeparatorProps) {
  return <MenuSeparatorPart {...props} marker="menu-separator" styles={separatorStyle} />;
}

MenuSeparator.displayName = 'Menu.Separator';

export const Menu = Object.assign(MenuRoot, {
  Trigger: MenuTrigger,
  Content: MenuContent,
  Item: MenuItem,
  Separator: MenuSeparator,
});
