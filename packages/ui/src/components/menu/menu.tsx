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
// never move focus (returnFocus is off, so no transient trigger focus either). Every open or
// close request decides restoration afresh, so a rejected Escape never leaks into a later close.
// Restoration is skipped when the trigger left the document or became inert (its owner is being
// removed) or when the command already moved focus elsewhere, so a neighbor or opened surface
// keeps it.
// Disabled items stay in the list with aria-disabled="true"; arrows and typeahead skip them.
// Families may render an item as another element (a link): Enter activates it natively and
// Space clicks it, so the keyboard map above holds.
// The menu is an overlay layer: opened inside another layer (Popover, …) it is that layer's child,
// so Escape and outside presses dismiss the menu alone.
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
  type ComponentType,
  type CSSProperties,
  type HTMLAttributes,
  type HTMLProps,
  type KeyboardEvent,
  type KeyboardEventHandler,
  type MouseEvent,
  type MouseEventHandler,
  type MutableRefObject,
  type ReactNode,
  type RefCallback,
} from 'react';
import { GeneratedRoot, type GeneratedRootProps, type GeneratedRootSlotProps } from '../../utils/generated-root';
import {
  FloatingFocusManager,
  FloatingList,
  useClick,
  useInteractions,
  useListNavigation,
  useMergeRefs,
  useRole,
  useTypeahead,
  type Placement,
  type UseInteractionsReturn,
} from '@floating-ui/react';
import { vars } from '@jfrader/tokens/vars';
import { css, type Interpolation, type SerializedStyles, type Theme } from '../../styling/css';
import { focusRingInset } from '../../styling/focus-ring';
import { listboxItemStateStyle, listboxScrollStyle, listboxSurfaceStyle } from '../../styling/listbox-style';
import { FORCED_COLORS, REDUCED_MOTION } from '../../styling/media';
import { translucentSurfaceStyle } from '../../styling/surface';
import { WithSx, type SxProps } from '../../styling/sx';
import { triggerStyle } from '../../styling/trigger-style';
import { LayerContent, MenuLayer, useLayerDismiss } from '../../overlay/overlay-layer';
import { OverlayPortal } from '../../overlay/overlay-portal';
import { useOverlayFloating, type OverlayFloatingOptions } from '../../overlay/use-overlay-floating';
import { useCollectionIndexRegistration, useCollectionListItem } from '../../utils/collection-registry';
import { useControlledState } from '../../utils/use-controlled-state';

const TYPEAHEAD_RESET_MS = 500;

interface MenuStateProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  placement?: Placement;
}

interface MenuAppearanceProps {
  /** Set the popup material. Defaults to `default`. */
  appearance?: 'default' | 'glass';
}

export type MenuAction = {
  type: 'item';
  key?: string;
  label: ReactNode;
  onSelect?: () => void;
  disabled?: boolean;
} | {
  type: 'separator';
  key?: string;
  label?: never;
  onSelect?: never;
  disabled?: never;
};

export interface MenuCompoundProps extends MenuStateProps, MenuAppearanceProps {
  children?: ReactNode;
  items?: never;
  triggerLabel?: never;
  slotProps?: never;
  slots?: never;
  component?: never;
}

export interface MenuEasyProps extends MenuStateProps, MenuAppearanceProps, Omit<GeneratedRootProps, 'children'> {
  /** Name the button that opens the menu. */
  triggerLabel: ReactNode;
  /** Render actions and separators in order. */
  items: readonly MenuAction[];
  children?: never;
  slotProps?: MenuSlotProps;
  slots?: MenuSlots;
  component?: MenuSlots['root'];
}

export interface MenuSlots {
  /** Replaces the outer wrapper element; renders a `div` by default. */
  root?: ComponentType<ComponentPropsWithRef<'div'>>;
  /** Replaces the button that opens the menu. */
  trigger?: ComponentType<MenuTriggerProps>;
  /** Replaces the popup menu overlay container. */
  content?: ComponentType<MenuContentProps>;
  /** Replaces an action item button inside the menu. */
  item?: ComponentType<MenuItemProps>;
  /** Replaces the separator element dividing menu items. */
  separator?: ComponentType<MenuSeparatorProps>;
}

export interface MenuSlotProps {
  /** Outer wrapper element around the trigger and content. */
  root?: GeneratedRootSlotProps;
  /** Button element that opens the menu. */
  trigger?: Omit<MenuTriggerProps, 'children'>;
  /** Popup menu overlay container element holding menu items. */
  content?: Omit<MenuContentProps, 'children'>;
  /** Action item button element inside the menu. */
  item?: Omit<MenuItemProps, 'children' | 'onSelect' | 'disabled'>;
  /** Separator element dividing menu items. */
  separator?: MenuSeparatorProps;
}

export type MenuProps = MenuCompoundProps | MenuEasyProps;

export interface MenuTriggerProps extends ComponentPropsWithRef<'button'>, SxProps {}
export interface MenuContentProps extends ComponentPropsWithRef<'div'>, SxProps {}
export interface MenuItemProps extends Omit<ComponentPropsWithRef<'button'>, 'onSelect'>, SxProps {
  /** Called when the item is activated. The menu then closes unless a click handler called
   * `event.preventDefault()`. */
  onSelect?: () => void;
  disabled?: boolean;
}
export interface MenuSeparatorProps extends ComponentPropsWithRef<'div'>, SxProps {}

export type MenuItemTone = 'neutral' | 'danger';

/** Positioning options a family may set on the shared controller; Menu keeps the defaults. */
export type MenuPositioning = Pick<OverlayFloatingOptions, 'strategy' | 'gap' | 'transform' | 'onAvailableSize' | 'collision'>;

export interface MenuControllerProps extends MenuStateProps {
  children?: ReactNode;
  positioning?: MenuPositioning;
}

type OverlayFloating = ReturnType<typeof useOverlayFloating>;

interface MenuContextValue {
  open: boolean;
  nodeId: string | undefined;
  requestOpen: () => void;
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

/** Props a menu item's `render` callback spreads onto the element it returns. */
export interface MenuItemRenderProps extends HTMLAttributes<HTMLElement> {
  ref: RefCallback<HTMLElement> | null;
  'data-ui': string;
}

/** Item behavior a family may change: the part name in usage errors, the item role, whether
 * selection closes the menu, `busy` (an item that stays focusable and navigable but ignores
 * activation, exposed as aria-busy and aria-disabled) and `render`, which replaces the native
 * button (e.g. with an <a href>). */
export interface MenuItemPartBehavior {
  part?: string;
  itemRole?: 'menuitem' | 'menuitemcheckbox' | 'menuitemradio';
  closeOnSelect?: boolean;
  busy?: boolean;
  render?: (props: MenuItemRenderProps) => ReactNode;
}

const MenuContext = createContext<MenuContextValue | null>(null);
const MenuAppearanceContext = createContext<NonNullable<MenuAppearanceProps['appearance']>>('default');
// Set by the content part: items may only render inside it (they register with its FloatingList).
const MenuContentContext = createContext(false);

export function useMenuContext(family: string, part: string): MenuContextValue {
  const context = useContext(MenuContext);
  if (!context) throw new Error(`${family}.${part} must be rendered inside <${family}>.`);
  return context;
}

function useMenuItemContext(family: string, part: string): MenuContextValue {
  const context = useMenuContext(family, part);
  if (!useContext(MenuContentContext)) throw new Error(`${family}.${part} must be rendered inside <${family}.Content>.`);
  return context;
}

type EventHandler = (event: { defaultPrevented: boolean }) => unknown;

const isHandlerKey = (key: string) => /^on[A-Z]/.test(key);

/**
 * Runs each consumer handler before the matching interaction handler; a consumer
 * `preventDefault()` vetoes the internal request (open, toggle, navigation).
 */
export function consumerHandlersFirst<T extends Element>(
  props: HTMLProps<T>,
  getProps: (userProps: HTMLProps<T>) => Record<string, unknown>,
) {
  const consumer: Record<string, EventHandler> = {};
  const attributes: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(props)) {
    if (isHandlerKey(key) && typeof value === 'function') consumer[key] = value as EventHandler;
    else attributes[key] = value;
  }
  const merged = getProps(attributes as HTMLProps<T>);
  for (const [key, handler] of Object.entries(consumer)) {
    const internal = merged[key] as EventHandler | undefined;
    merged[key] = (event: { defaultPrevented: boolean }) => {
      handler(event);
      if (!event.defaultPrevented) internal?.(event);
    };
  }
  return merged;
}

export const joinIds = (...ids: Array<string | undefined>) => ids.filter(Boolean).join(' ') || undefined;

const itemStyle = css({
  appearance: 'none',
  boxSizing: 'border-box',
  display: 'flex',
  alignItems: 'center',
  inlineSize: '100%',
  minBlockSize: '32px',
  flexShrink: 0,
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
  [FORCED_COLORS]: {
    forcedColorAdjust: 'none',
    backgroundColor: 'CanvasText',
  },
});

const menuMaterialStyles = {
  default: undefined,
  glass: css([{
    backgroundImage: `linear-gradient(135deg, ${vars.color.surfaceSheen}, transparent)`,
  }, translucentSurfaceStyle, {
    '--ui-translucent-shadow': `inset 0 1px 0 ${vars.color.surfaceHighlight}, ${vars.shadow.overlay}`,
  }]),
};

/** Own styles of a menu item, for families that layer their own item styles on top. */
export const menuItemStyles = [itemStyle, listboxItemStateStyle];
/** Own styles of a menu separator. */
export const menuSeparatorStyles = separatorStyle;
/** Command tones for families whose items carry one (SplitButton, ContextMenu). */
export const menuItemToneStyles: Record<MenuItemTone, SerializedStyles> = {
  neutral: css({}),
  danger: css({
    color: vars.color.dangerText,
    '&:hover:not([aria-disabled="true"]), &[data-active]:not([aria-disabled="true"])': {
      backgroundColor: vars.color.dangerSoft,
    },
  }),
};

/**
 * Returns focus to a closed overlay's trigger, unless the trigger left the document or became
 * inert (its owner is being removed) or something else already holds focus.
 */
export function restoreTriggerFocus(trigger: HTMLElement | null) {
  if (!trigger?.isConnected || trigger.closest('[inert]')) return;
  const active = trigger.ownerDocument.activeElement;
  if (active && active !== trigger.ownerDocument.body) return;
  trigger.focus();
}

function MenuOverlay({
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  placement = 'bottom-start',
  positioning,
  nodeId,
  children,
}: MenuControllerProps & { nodeId: string | undefined }) {
  const [open = false, requestOpenChange] = useControlledState<boolean>(openProp, defaultOpen, onOpenChange);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const elementsRef = useRef<Array<HTMLElement | null>>([]);
  const labelsRef = useRef<Array<string | null>>([]);
  // Items report their disabled state here by list index (see Menu.Item).
  const disabledIndicesRef = useRef(new Set<number>());
  const pendingFocusRestoreRef = useRef(false);

  const { refs, floatingStyles, context } = useOverlayFloating({
    ...positioning,
    open,
    placement,
    nodeId,
    onOpenChange: (next, _event, reason) => {
      // Escape requests a close; focus is restored only once the close is actually applied.
      pendingFocusRestoreRef.current = !next && reason === 'escape-key';
      requestOpenChange(next);
    },
  });

  // A rejected controlled dismissal keeps the menu open, so focus stays inside it.
  useEffect(() => {
    if (open || !pendingFocusRestoreRef.current) return;
    pendingFocusRestoreRef.current = false;
    restoreTriggerFocus(refs.domReference.current);
  }, [open, refs]);

  const click = useClick(context);
  const role = useRole(context, { role: 'menu' });
  const dismiss = useLayerDismiss(context, 'container');
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
    ...dismiss,
    listNavigation,
    typeahead,
  ]);

  const value = useMemo(
    () => ({
      open,
      nodeId,
      requestOpen: () => {
        pendingFocusRestoreRef.current = false;
        requestOpenChange(true);
      },
      requestClose: (restoreFocus = false) => {
        pendingFocusRestoreRef.current = restoreFocus;
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
      nodeId,
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

/** The shared menu controller (state, positioning, navigation, dismissal, focus return). */
export function MenuController(props: MenuControllerProps) {
  return <MenuLayer>{(nodeId) => <MenuOverlay {...props} nodeId={nodeId} />}</MenuLayer>;
}

function MenuRoot({ items, triggerLabel, slotProps, slots, component, children, open, defaultOpen, onOpenChange, placement, appearance = 'default', ...rootProps }: MenuProps) {
  const generated = items !== undefined ? (
    <>
      <MenuTriggerPart {...slotProps?.trigger} slots={slots} family="Menu" marker="menu-trigger" styles={triggerStyle}>
        {triggerLabel}
      </MenuTriggerPart>
      <MenuMaterialContent
        {...slotProps?.content}
        slots={slots}
      >
        {items.map((item, index) => item.type === 'separator' ? (
          <MenuSeparatorPart
            {...slotProps?.separator}
            slots={slots}
            marker="menu-separator"
            styles={separatorStyle}
            key={item.key ?? index}
          />
        ) : (
          <MenuItemPart
            {...slotProps?.item}
            slots={slots}
            family="Menu"
            marker="menu-item"
            styles={menuItemStyles}
            key={item.key ?? index}
            onSelect={item.onSelect}
            disabled={item.disabled}
          >
            {item.label}
          </MenuItemPart>
        ))}
      </MenuMaterialContent>
    </>
  ) : children;
  return (
    <MenuAppearanceContext.Provider value={appearance}>
      <MenuController open={open} defaultOpen={defaultOpen} onOpenChange={onOpenChange} placement={placement}>
        {items !== undefined ? (
          <GeneratedRoot {...rootProps} component={slots?.root ?? component} rootSlot={slotProps?.root} marker="menu">
            {generated}
          </GeneratedRoot>
        ) : generated}
      </MenuController>
    </MenuAppearanceContext.Provider>
  );
}

MenuRoot.displayName = 'Menu';

export function MenuTriggerPart({
  slots,
  family,
  marker,
  styles,
  ref,
  className,
  sx,
  ...props
}: MenuTriggerProps & MenuPartIdentity & { slots?: Pick<MenuSlots, 'trigger'> }) {
  const Trigger = slots?.trigger ?? 'button';
  const { refs, getReferenceProps } = useMenuContext(family, 'Trigger');
  const mergedRef = useMergeRefs([refs.setReference, ref]);

  return (
    <WithSx className={className} styles={styles} sx={sx}>
      {(className) => (
        <Trigger
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
  slots,
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
  defaultLabelledBy,
  ...rest
}: MenuContentProps & MenuPartIdentity & { defaultLabelledBy?: string; slots?: Pick<MenuSlots, 'content'> }) {
  const Content = slots?.content ?? 'div';
  const { open, refs, floatingContext, floatingStyles, getFloatingProps } = useMenuContext(family, 'Content');
  const mergedRef = useMergeRefs([refs.setFloating, ref]);

  if (!open) return null;

  const floatingProps = getFloatingProps(rest);
  // The trigger (or the family's own default) names the menu; consumer ids join it, and a
  // consumer aria-label replaces it.
  const triggerLabel = defaultLabelledBy ?? (floatingProps['aria-labelledby'] as string | undefined);
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
            <Content
              {...floatingProps}
              aria-label={ariaLabel}
              aria-labelledby={labelledBy}
              ref={mergedRef}
              data-ui={marker}
              style={{ ...style, ...floatingStyles }}
              className={className}
            >
              <MenuCollection family={family}>{children}</MenuCollection>
            </Content>
          )}
        </WithSx>
      </FloatingFocusManager>
    </OverlayPortal>
  );
}

/**
 * The menu's item collection: items rendered inside register with its list navigation and
 * typeahead, and layers opened inside nest under the menu. Families that build their own surface
 * around the menu element (UserMenu) render it inside the element carrying the floating props.
 */
export function MenuCollection({ family, children }: { family: string; children?: ReactNode }) {
  const { nodeId, elementsRef, labelsRef } = useMenuContext(family, 'Content');
  return (
    <FloatingList elementsRef={elementsRef} labelsRef={labelsRef}>
      <MenuContentContext.Provider value>
        <LayerContent nodeId={nodeId}>{children}</LayerContent>
      </MenuContentContext.Provider>
    </FloatingList>
  );
}

function MenuMaterialContent(props: MenuContentProps & { slots?: Pick<MenuSlots, 'content'> }) {
  const appearance = useContext(MenuAppearanceContext);
  return <MenuContentPart {...props} family="Menu" marker="menu" styles={[listboxSurfaceStyle, listboxScrollStyle, menuMaterialStyles[appearance]]} />;
}

function MenuContent(props: MenuContentProps) {
  return <MenuMaterialContent {...props} />;
}

MenuContent.displayName = 'Menu.Content';

export function MenuItemPart({
  slots,
  family,
  marker,
  styles,
  ref,
  onSelect,
  disabled = false,
  part = 'Item',
  itemRole = 'menuitem',
  closeOnSelect = true,
  busy = false,
  render,
  onClick,
  onKeyDown,
  className,
  sx,
  ...rest
}: MenuItemProps & MenuPartIdentity & MenuItemPartBehavior & { slots?: Pick<MenuSlots, 'item'> }) {
  const Item = slots?.item ?? 'button';
  const { activeIndex, requestClose, disabledIndices, getItemProps } = useMenuItemContext(family, part);
  // A null label removes disabled items from typeahead; undefined falls back to textContent.
  const { ref: listItemRef, index } = useCollectionListItem({ label: disabled ? null : undefined });
  const mergedRef = useMergeRefs<HTMLElement>([listItemRef, ref]);
  const isActive = index !== -1 && activeIndex === index;

  // Layout effect so the registry is current before list navigation picks the initial item.
  useCollectionIndexRegistration(index, disabled, disabledIndices);

  const consumerClick: MouseEventHandler<HTMLElement> | undefined = onClick;
  const handleClick = (event: MouseEvent<HTMLElement>) => {
    // A rendered link would still navigate without preventDefault().
    if (disabled || busy) {
      event.preventDefault();
      return;
    }
    consumerClick?.(event);
    onSelect?.();
    if (closeOnSelect && !event.defaultPrevented) requestClose(true);
  };

  // Native buttons click on Space; a rendered element (a link) does not.
  const consumerKeyDown: KeyboardEventHandler<HTMLElement> | undefined = onKeyDown;
  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    consumerKeyDown?.(event);
    if (render === undefined || event.defaultPrevented || event.key !== ' ') return;
    event.preventDefault();
    event.currentTarget.click();
  };

  return (
    <WithSx className={className} styles={styles} sx={sx}>
      {(className) => {
        const itemProps = {
          ...getItemProps({ ...rest, onClick: handleClick, onKeyDown: handleKeyDown }),
          ref: mergedRef,
          role: itemRole,
          tabIndex: isActive ? 0 : -1,
          'aria-disabled': disabled || busy || undefined,
          'aria-busy': busy || undefined,
          'data-active': isActive || undefined,
          'data-ui': marker,
          className,
        };
        return render ? render(itemProps as MenuItemRenderProps) : <Item type="button" {...itemProps} />;
      }}
    </WithSx>
  );
}

function MenuItem(props: MenuItemProps) {
  return <MenuItemPart {...props} family="Menu" marker="menu-item" styles={menuItemStyles} />;
}

MenuItem.displayName = 'Menu.Item';

export function MenuSeparatorPart({
  slots,
  marker,
  styles,
  ref,
  className,
  sx,
  ...props
}: MenuSeparatorProps & Omit<MenuPartIdentity, 'family'> & { slots?: Pick<MenuSlots, 'separator'> }) {
  const Separator = slots?.separator ?? 'div';
  return (
    <WithSx className={className} styles={styles} sx={sx}>
      {(className) => <Separator {...props} ref={ref} role="separator" data-ui={marker} className={className} />}
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
