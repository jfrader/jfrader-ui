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
import {
  createContext,
  forwardRef,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type HTMLAttributes,
  type MouseEvent,
  type MutableRefObject,
  type ReactNode,
} from 'react';
import {
  FloatingFocusManager,
  FloatingList,
  FloatingPortal,
  useClick,
  useDismiss,
  useInteractions,
  useListItem,
  useListNavigation,
  useMergeRefs,
  useRole,
  useTypeahead,
  type Placement,
  type UseInteractionsReturn,
} from '@floating-ui/react';
import { vars } from '@jfrader/tokens/vars';
import { css } from '../../styling/css';
import { triggerStyle } from '../../styling/trigger-style';
import { useOverlayFloating } from '../../overlay/use-overlay-floating';
import { useControlledState } from '../../utils/use-controlled-state';

const TYPEAHEAD_RESET_MS = 500;

export interface MenuProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  placement?: Placement;
  children?: ReactNode;
}

export interface MenuTriggerProps extends ButtonHTMLAttributes<HTMLButtonElement> {}
export interface MenuContentProps extends HTMLAttributes<HTMLDivElement> {}
export interface MenuItemProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onSelect'> {
  /** Called when the item is activated. The menu then closes unless a click handler called
   * `event.preventDefault()`. */
  onSelect?: () => void;
  disabled?: boolean;
}
export interface MenuSeparatorProps extends HTMLAttributes<HTMLDivElement> {}

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

const MenuContext = createContext<MenuContextValue | null>(null);
// Set by Menu.Content: items may only render inside it (they register with its FloatingList).
const MenuContentContext = createContext(false);

function useMenuContext(part: string): MenuContextValue {
  const context = useContext(MenuContext);
  if (!context) throw new Error(`Menu.${part} must be rendered inside <Menu>.`);
  return context;
}

function useMenuItemContext(): MenuContextValue {
  const context = useMenuContext('Item');
  if (!useContext(MenuContentContext)) throw new Error('Menu.Item must be rendered inside <Menu.Content>.');
  return context;
}

const REDUCED_MOTION = '@media (prefers-reduced-motion: reduce)';

const contentStyle = css({
  boxSizing: 'border-box',
  display: 'flex',
  flexDirection: 'column',
  backgroundColor: vars.color.surfaceRaised,
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.md,
  boxShadow: vars.shadow.overlay,
  padding: vars.space[1],
  minInlineSize: '180px',
  maxInlineSize: 'min(320px, calc(100vw - 32px))',
  color: vars.color.text,
  fontFamily: vars.font.sans,
  lineHeight: vars.lineHeight.base,
});

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
  '&:hover:not([aria-disabled="true"]), &[data-active]:not([aria-disabled="true"])': {
    backgroundColor: vars.color.surfaceHover,
  },
  '&:focus-visible': {
    outline: `2px solid ${vars.color.focusRing}`,
    outlineOffset: '-2px',
  },
  '&[aria-disabled="true"]': {
    opacity: 0.55,
    cursor: 'not-allowed',
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

function MenuRoot({
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
      if (!next && reason === 'escape-key') pendingFocusRestoreRef.current = true;
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

const Trigger = forwardRef<HTMLButtonElement, MenuTriggerProps>(function MenuTrigger(props, ref) {
  const { refs, getReferenceProps } = useMenuContext('Trigger');
  const mergedRef = useMergeRefs([refs.setReference, ref]);

  return (
    <button type="button" {...getReferenceProps(props)} ref={mergedRef} data-ui="menu-trigger" css={triggerStyle} />
  );
});

const Content = forwardRef<HTMLDivElement, MenuContentProps>(function MenuContent({ style, children, ...rest }, ref) {
  const { open, refs, floatingContext, floatingStyles, elementsRef, labelsRef, getFloatingProps } =
    useMenuContext('Content');
  const mergedRef = useMergeRefs([refs.setFloating, ref]);

  if (!open) return null;

  return (
    <FloatingPortal>
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
        <div
          {...getFloatingProps(rest)}
          ref={mergedRef}
          data-ui="menu"
          style={{ ...style, ...floatingStyles }}
          css={contentStyle}
        >
          <FloatingList elementsRef={elementsRef} labelsRef={labelsRef}>
            <MenuContentContext.Provider value>{children}</MenuContentContext.Provider>
          </FloatingList>
        </div>
      </FloatingFocusManager>
    </FloatingPortal>
  );
});

const Item = forwardRef<HTMLButtonElement, MenuItemProps>(function MenuItem(
  { onSelect, disabled = false, onClick, ...rest },
  ref,
) {
  const { activeIndex, requestClose, disabledIndices, getItemProps } = useMenuItemContext();
  // A null label removes disabled items from typeahead; undefined falls back to textContent.
  const { ref: listItemRef, index } = useListItem({ label: disabled ? null : undefined });
  const mergedRef = useMergeRefs([listItemRef, ref]);
  const isActive = index !== -1 && activeIndex === index;

  // Layout effect so the registry is current before list navigation picks the initial item.
  useLayoutEffect(() => {
    if (!disabled || index === -1) return;
    disabledIndices.add(index);
    return () => {
      disabledIndices.delete(index);
    };
  }, [disabled, index, disabledIndices]);

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (disabled) return;
    onClick?.(event);
    onSelect?.();
    if (!event.defaultPrevented) requestClose(true);
  };

  return (
    <button
      type="button"
      {...getItemProps({ ...rest, onClick: handleClick })}
      ref={mergedRef}
      role="menuitem"
      tabIndex={isActive ? 0 : -1}
      aria-disabled={disabled || undefined}
      data-active={isActive || undefined}
      data-ui="menu-item"
      css={itemStyle}
    />
  );
});

const Separator = forwardRef<HTMLDivElement, MenuSeparatorProps>(function MenuSeparator(props, ref) {
  return <div {...props} ref={ref} role="separator" data-ui="menu-separator" css={separatorStyle} />;
});

export const Menu = Object.assign(MenuRoot, { Trigger, Content, Item, Separator });
