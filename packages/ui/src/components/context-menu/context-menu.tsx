'use client';

// ContextMenu: secondary actions for one object, opened where the user asked for them. Built on
// the shared menu controller (state, list navigation, typeahead, dismissal, focus return); this
// file adds the Target (a context area) and the anchoring around it.
// APG pattern: menu. The Target is a labelled group carrying aria-haspopup="menu", aria-expanded
// and (while open) aria-controls; it keeps its own children interactive and is never a button.
// An optional visible Trigger is a menu button with the same relationships, for touch and
// discoverability. The menu is named by the Target. Items use real DOM focus with a roving tabindex.
// Keyboard map: on the Target, Shift+F10 or the ContextMenu key opens below the Target at its
// inline start (Enter/Space too, only with openOnClick and only on the Target itself). On the
// Trigger, Enter/Space/ArrowDown open on the first enabled item and ArrowUp on the last. In the
// menu, ArrowDown/ArrowUp move and wrap, Home/End jump, printable characters jump to the next
// matching enabled item (500ms buffer), Enter/Space activate once, Escape closes and returns focus
// to the invoker (Target or Trigger), and Tab closes and lets focus move on. Left/Right do nothing:
// there are no submenus.
// Pointer: a context click opens at the pointer; a plain click on the Target is left alone unless
// openOnClick is set. A plain press on the Target while its menu is open closes the menu.
// Disabled items stay visible with aria-disabled="true" and are skipped by arrows and typeahead
// (deliberate deviation from APG's focusable-disabled recommendation, shared with Menu). A menu
// without enabled items focuses its own container, so Escape and Tab still work.
// Scrolling outside the menu or resizing the window asks once to close it (the anchor is a fixed
// point); scrolling inside the menu does not.
import {
  type ComponentType,
  createContext,
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
  type HTMLProps,
  type KeyboardEvent,
  type MouseEvent,
  type MutableRefObject,
  type PointerEvent,
  type ReactNode,
  type SyntheticEvent,
} from 'react';
import { GeneratedRoot, type GeneratedRootProps, type GeneratedRootSlotProps } from '../../utils/generated-root';
import { useMergeRefs } from '@floating-ui/react';
import { isEventTargetWithin } from '@floating-ui/react/utils';
import { vars } from '@jfrader/tokens/vars';
import { css, keyframes } from '../../styling/css';
import { iconWrapperStyle } from '../../styling/icon-wrapper';
import { listboxSurfaceStyle } from '../../styling/listbox-style';
import { FORCED_COLORS, REDUCED_MOTION } from '../../styling/media';
import { WithSx, type SxProps } from '../../styling/sx';
import { triggerStyle } from '../../styling/trigger-style';
import type { OverlayAvailableSize } from '../../overlay/use-overlay-floating';
import { isRenderable } from '../../utils/renderable';
import { useControlledState } from '../../utils/use-controlled-state';
import { useLatestCallback } from '../../utils/use-latest-callback';
import {
  MenuContentPart,
  MenuController,
  MenuItemPart,
  MenuSeparatorPart,
  consumerHandlersFirst,
  menuItemStyles,
  menuItemToneStyles,
  menuSeparatorStyles,
  useMenuContext,
  type MenuItemTone,
  type MenuPositioning,
} from '../menu/menu';

const FAMILY = 'ContextMenu';
/** Preferred inline size of the menu; long labels wrap inside it. */
const CONTENT_INLINE_SIZE = '13rem';
/** Block size past which the menu scrolls. */
const CONTENT_MAX_BLOCK_SIZE = '300px';
/** Gap between the anchor (pointer, Target edge or Trigger) and the menu, in px (`space[1]`). */
const ANCHOR_GAP = 4;
const ORIGIN_VAR = '--context-menu-origin';
const AVAILABLE_INLINE_VAR = '--context-menu-available-inline';
const AVAILABLE_BLOCK_VAR = '--context-menu-available-block';

export type ContextMenuItemTone = MenuItemTone;

export type ContextMenuItemAction = {
  type?: 'item';
  key?: string;
  label: ReactNode;
  onSelect?: () => void;
  disabled?: boolean;
  tone?: ContextMenuItemTone;
  icon?: ReactNode;
};

export type ContextMenuSeparatorAction = {
  type: 'separator';
  key?: string;
  label?: never;
  onSelect?: never;
  disabled?: never;
  tone?: never;
  icon?: never;
};

export type ContextMenuAction = ContextMenuItemAction | ContextMenuSeparatorAction;

export interface ContextMenuStateProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export interface ContextMenuCompoundProps extends ContextMenuStateProps {
  children?: ReactNode;
  targetLabel?: never;
  items?: never;
  content?: never;
  disabled?: never;
  openOnClick?: never;
  slotProps?: never;
  slots?: never;
  component?: never;
}

export interface ContextMenuSlotProps {
  /** Generated wrapper element rendered around the target area. */
  root?: GeneratedRootSlotProps;
  /** Interactive area that listens for right-click or long-press gestures. */
  target?: Omit<ContextMenuTargetProps, 'children' | 'aria-label'>;
  /** Floating menu overlay that displays actions and separators. */
  content?: Omit<ContextMenuContentProps, 'children'>;
  /** Each selectable action item in the menu list. */
  item?: Omit<ContextMenuItemProps, 'children' | 'onSelect' | 'disabled'>;
  /** Decorative dividing line between menu items. */
  separator?: ContextMenuSeparatorProps;
}

export interface ContextMenuEasyProps extends ContextMenuStateProps, Omit<GeneratedRootProps, 'children' | 'content'> {
  /** Name the context target for assistive technologies. */
  targetLabel: string;
  /** Actions and separators displayed in the menu. */
  items: readonly ContextMenuAction[];
  /** Content rendered inside the target area. */
  content: ReactNode;
  /** Also open on a plain click or tap (and Enter/Space on the Target). */
  openOnClick?: boolean;
  /** Leave the browser's native context menu alone. */
  disabled?: boolean;
  children?: never;
  slotProps?: ContextMenuSlotProps;
  slots?: ContextMenuSlots;
  component?: ContextMenuSlots['root'];
}

export interface ContextMenuSlots {
  /** Replaces the generated wrapper element; renders a `div` by default. */
  root?: ComponentType<ComponentPropsWithRef<'div'>>;
  /** Replaces the interactive area that listens for right-click gestures. */
  target?: ComponentType<ContextMenuTargetProps>;
  /** Replaces the floating menu overlay that displays actions. */
  content?: ComponentType<ContextMenuContentProps>;
  /** Replaces each selectable action item in the menu list. */
  item?: ComponentType<ContextMenuItemProps>;
  /** Replaces the decorative dividing line between menu items. */
  separator?: ComponentType<ContextMenuSeparatorProps>;
}

export type ContextMenuProps = ContextMenuCompoundProps | ContextMenuEasyProps;

export interface ContextMenuTargetProps extends ComponentPropsWithRef<'div'>, SxProps {
  /** Also open on a plain click or tap (and Enter/Space on the Target). Only for inert objects:
   * interactive children would lose their own click. */
  openOnClick?: boolean;
  /** Leave the browser's native context menu alone. */
  disabled?: boolean;
}

export interface ContextMenuTriggerProps extends ComponentPropsWithRef<'button'>, SxProps {}

export interface ContextMenuContentProps extends ComponentPropsWithRef<'div'>, SxProps {}

export interface ContextMenuItemProps extends Omit<ComponentPropsWithRef<'button'>, 'onSelect'>, SxProps {
  /** Called once when the item is activated. The menu then closes unless a click handler called
   * `event.preventDefault()`. */
  onSelect?: () => void;
  disabled?: boolean;
  tone?: ContextMenuItemTone;
  /** Decorative icon before the label. */
  icon?: ReactNode;
}

export interface ContextMenuCheckboxItemProps extends Omit<ContextMenuItemProps, 'value' | 'defaultValue'> {
  value?: boolean;
  defaultValue?: boolean;
  onValueChange?: (checked: boolean) => void;
  /** Close the menu after toggling. Off by default so several options can be toggled in a row. */
  closeOnSelect?: boolean;
}

export interface ContextMenuSeparatorProps extends ComponentPropsWithRef<'div'>, SxProps {}

type Direction = 'ltr' | 'rtl';

interface AnchorRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ContextMenuContextValue {
  targetRef: MutableRefObject<HTMLDivElement | null>;
  triggerRef: MutableRefObject<HTMLButtonElement | null>;
  /** Anchors the menu to `rect`, with `invoker` as the element focus returns to. */
  anchorTo: (invoker: HTMLElement, rect: AnchorRect) => void;
  /** Anchors the menu and requests it open. */
  invoke: (invoker: HTMLElement, rect: AnchorRect) => void;
  anchor: AnchorRect | null;
  available: OverlayAvailableSize | undefined;
  direction: Direction | undefined;
  /** Ids naming the menu: the Target's consumer aria-labelledby, else the Target itself. */
  targetLabel: string | undefined;
  setTargetLabel: (ids: string | undefined) => void;
}

const ContextMenuContext = createContext<ContextMenuContextValue | null>(null);

function useContextMenuContext(part: string): ContextMenuContextValue {
  const context = useContext(ContextMenuContext);
  if (!context) throw new Error(`${FAMILY}.${part} must be rendered inside <${FAMILY}>.`);
  return context;
}

const rectOf = (element: Element): AnchorRect => {
  const { x, y, width, height } = element.getBoundingClientRect();
  return { x, y, width, height };
};

const isRtl = (element: Element) => getComputedStyle(element).direction === 'rtl';

/** A zero-width edge at the Target's inline start, so the menu opens below (or above) it. */
const inlineStartEdge = (element: Element): AnchorRect => {
  const rect = rectOf(element);
  return { ...rect, x: isRtl(element) ? rect.x + rect.width : rect.x, width: 0 };
};

const pointAt = (x: number, y: number): AnchorRect => ({ x, y, width: 0, height: 0 });

// The ContextMenu key and Shift+F10 also fire a contextmenu event with no pointer position.
const isKeyboardContextMenu = (event: MouseEvent) =>
  (event.nativeEvent as globalThis.PointerEvent).pointerType === '' || (event.clientX === 0 && event.clientY === 0);

const isContextMenuKey = (event: KeyboardEvent) =>
  event.key === 'ContextMenu' || (event.key === 'F10' && event.shiftKey);

const isActivationKey = (event: KeyboardEvent) => event.key === 'Enter' || event.key === ' ';

const pickAria = (props: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(props).filter(([key]) => key.startsWith('aria-')));

const enter = keyframes({
  from: { opacity: 0, scale: '0.98' },
  to: { opacity: 1, scale: '1' },
});

const targetStyle = css({
  label: 'context-menu-target',
  '&:focus-visible': {
    outline: `2px solid ${vars.color.focusRing}`,
    outlineOffset: '2px',
  },
});

const contentStyle = css({
  label: 'context-menu',
  borderColor: vars.color.borderControl,
  inlineSize: CONTENT_INLINE_SIZE,
  minInlineSize: 0,
  maxInlineSize: `var(${AVAILABLE_INLINE_VAR}, ${CONTENT_INLINE_SIZE})`,
  maxBlockSize: `min(${CONTENT_MAX_BLOCK_SIZE}, var(${AVAILABLE_BLOCK_VAR}, ${CONTENT_MAX_BLOCK_SIZE}))`,
  overflowY: 'auto',
  overscrollBehavior: 'contain',
  fontSize: vars.textSize.sm,
  transformOrigin: `var(${ORIGIN_VAR}, top left)`,
  animation: `${enter} ${vars.motion.duration.base} ${vars.motion.easeStandard}`,
  '&:focus-visible': {
    outline: `2px solid ${vars.color.focusRing}`,
    outlineOffset: '2px',
  },
  [REDUCED_MOTION]: {
    animation: 'none',
  },
  [FORCED_COLORS]: {
    borderColor: 'ButtonText',
  },
});

const itemLayoutStyle = css({
  gap: vars.space[2],
  lineHeight: vars.lineHeight.base,
  [FORCED_COLORS]: {
    '&[data-active]': {
      outline: '2px solid Highlight',
      outlineOffset: '-2px',
    },
  },
});

const labelStyle = css({
  flex: 1,
  minInlineSize: 0,
  overflowWrap: 'anywhere',
});

const separatorStyle = css({
  flexShrink: 0,
});

const checkStyle = css({
  boxSizing: 'border-box',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  inlineSize: '1rem',
  blockSize: '1rem',
  border: `1px solid ${vars.color.borderControl}`,
  borderRadius: vars.radius.sm,
  '& svg': { inlineSize: '0.75rem', blockSize: '0.75rem', visibility: 'hidden' },
  '&[data-state="checked"] svg': { visibility: 'visible' },
  [FORCED_COLORS]: {
    borderColor: 'ButtonText',
  },
});

const checkGlyph = (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3.5 8.5l3 3 6-7" />
  </svg>
);

function ContextMenuScope({
  available,
  children,
}: {
  available: OverlayAvailableSize | undefined;
  children?: ReactNode;
}) {
  const { open, refs, requestOpen, requestClose } = useMenuContext(FAMILY, 'Root');
  const targetRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const anchoredRef = useRef(false);
  const [anchor, setAnchor] = useState<AnchorRect | null>(null);
  const [direction, setDirection] = useState<Direction>();
  const [targetLabel, setTargetLabel] = useState<string>();
  const dismissOnViewportChange = useLatestCallback(() => requestClose(false));

  const anchorTo = useCallback(
    (invoker: HTMLElement, rect: AnchorRect) => {
      refs.setReference(invoker);
      refs.setPositionReference({
        getBoundingClientRect: () => DOMRect.fromRect(rect),
        contextElement: invoker,
      });
      setAnchor(rect);
      // Marks this event's open as anchored. An accepted open commits (and reads the mark)
      // within the event; a rejected one must not anchor a later programmatic open.
      anchoredRef.current = true;
      queueMicrotask(() => (anchoredRef.current = false));
    },
    [refs],
  );

  // A programmatic open (defaultOpen, a controlled prop) anchors below the Target. The portaled
  // menu takes the Target's direction.
  useLayoutEffect(() => {
    if (!open) return;
    const target = targetRef.current;
    if (!target) return;
    setDirection(isRtl(target) ? 'rtl' : 'ltr');
    if (!anchoredRef.current) anchorTo(target, inlineStartEdge(target));
  }, [open, anchorTo]);

  useEffect(() => {
    const reference = refs.domReference.current;
    if (!open || !reference) return;
    const document = reference.ownerDocument;
    const view = document.defaultView;
    let requested = false;
    const handleChange = (event: Event) => {
      if (requested) return;
      // Event-path containment, so menu nodes from another realm (a same-origin iframe) still count.
      if (event.type === 'scroll' && isEventTargetWithin(event, refs.floating.current)) return;
      requested = true;
      dismissOnViewportChange();
    };
    document.addEventListener('scroll', handleChange, { capture: true, passive: true });
    view?.addEventListener('resize', handleChange);
    return () => {
      document.removeEventListener('scroll', handleChange, { capture: true });
      view?.removeEventListener('resize', handleChange);
    };
  }, [open, refs, dismissOnViewportChange]);

  const value = useMemo<ContextMenuContextValue>(
    () => ({
      targetRef,
      triggerRef,
      anchorTo,
      invoke: (invoker, rect) => {
        anchorTo(invoker, rect);
        requestOpen();
      },
      anchor,
      available,
      direction,
      targetLabel,
      setTargetLabel,
    }),
    [anchorTo, requestOpen, anchor, available, direction, targetLabel],
  );

  return <ContextMenuContext.Provider value={value}>{children}</ContextMenuContext.Provider>;
}

function ContextMenuRoot(props: ContextMenuProps) {
  const Target = props.slots?.target ?? ContextMenuTarget;
  const Content = props.slots?.content ?? ContextMenuContent;
  const Item = props.slots?.item ?? ContextMenuItem;
  const Separator = props.slots?.separator ?? ContextMenuSeparator;
  const { open: _open, defaultOpen: _defaultOpen, onOpenChange: _onOpenChange,
    children: _children, targetLabel: _targetLabel, items: _items, content: _content,
    openOnClick: _openOnClick, disabled: _disabled, slotProps: _slotProps, slots: _slots,
    component: _component, ...rootProps } = props;
  const [available, setAvailable] = useState<OverlayAvailableSize>();
  const positioning: MenuPositioning = {
    strategy: 'fixed',
    gap: ANCHOR_GAP,
    // left/top positioning leaves `scale` free for the entry animation.
    transform: false,
    onAvailableSize: (size) =>
      setAvailable((previous) =>
        previous?.width === size.width && previous.height === size.height ? previous : size,
      ),
  };

  const { open, defaultOpen = false, onOpenChange } = props;

  return (
    <MenuController
      open={open}
      defaultOpen={defaultOpen}
      onOpenChange={onOpenChange}
      placement="bottom-start"
      positioning={positioning}
    >
      <ContextMenuScope available={available}>
        {props.items !== undefined ? (
          <GeneratedRoot {...rootProps} component={props.slots?.root ?? props.component} rootSlot={props.slotProps?.root} marker="context-menu-root">
            <Target
              {...props.slotProps?.target}
              {...(props.openOnClick !== undefined && { openOnClick: props.openOnClick })}
              {...(props.disabled !== undefined && { disabled: props.disabled })}
              aria-label={props.targetLabel}
            >
              {props.content}
            </Target>
            <Content {...props.slotProps?.content}>
              {props.items.map((item, index) =>
                item.type === 'separator' ? (
                  <Separator {...props.slotProps?.separator} key={item.key ?? index} />
                ) : (
                  <Item
                    {...props.slotProps?.item}
                    key={item.key ?? index}
                    onSelect={item.onSelect}
                    disabled={item.disabled}
                    tone={item.tone ?? props.slotProps?.item?.tone}
                    icon={item.icon !== undefined ? item.icon : props.slotProps?.item?.icon}
                  >
                    {item.label}
                  </Item>
                ),
              )}
            </Content>
          </GeneratedRoot>
        ) : (
          props.children
        )}
      </ContextMenuScope>
    </MenuController>
  );
}

ContextMenuRoot.displayName = 'ContextMenu';

function ContextMenuTarget({
  ref,
  id,
  openOnClick = false,
  disabled = false,
  'aria-labelledby': ariaLabelledBy,
  className,
  sx,
  ...rest
}: ContextMenuTargetProps) {
  const context = useContextMenuContext('Target');
  const { open, refs, requestClose, getReferenceProps } = useMenuContext(FAMILY, 'Target');
  const fallbackId = useId();
  const targetId = id ?? fallbackId;
  const mergedRef = useMergeRefs([context.targetRef, ref]);
  const { setTargetLabel, triggerRef } = context;

  useLayoutEffect(() => {
    setTargetLabel(ariaLabelledBy ?? targetId);
    return () => setTargetLabel(undefined);
  }, [ariaLabelledBy, targetId, setTargetLabel]);

  const fromTrigger = (event: { target: EventTarget }) => triggerRef.current?.contains(event.target as Node) ?? false;

  const internal = disabled
    ? {}
    : {
        // Only the relationship attributes: the Target is not a button, so the controller's
        // click, arrow and typeahead handlers stay off it.
        ...pickAria(getReferenceProps()),
        onContextMenu: (event: MouseEvent<HTMLDivElement>) => {
          event.preventDefault();
          const target = event.currentTarget;
          context.invoke(target, isKeyboardContextMenu(event) ? inlineStartEdge(target) : pointAt(event.clientX, event.clientY));
        },
        onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => {
          const ownActivation = openOnClick && isActivationKey(event) && event.target === event.currentTarget;
          if (!isContextMenuKey(event) && !ownActivation) return;
          event.preventDefault();
          context.invoke(event.currentTarget, inlineStartEdge(event.currentTarget));
        },
        // A context press keeps focus in an open menu while it moves to the new point.
        onMouseDown: (event: MouseEvent<HTMLDivElement>) => {
          if (open && event.button === 2) event.preventDefault();
        },
        // The Target is the menu's reference, so the shared outside-press dismissal ignores it.
        onPointerDown: (event: PointerEvent<HTMLDivElement>) => {
          if (!open || openOnClick || event.button !== 0 || event.ctrlKey) return;
          // Only a menu the Target opened: one the Trigger opened already treats the Target as outside.
          const reference: Element | null = refs.domReference.current;
          if (reference !== event.currentTarget || fromTrigger(event)) return;
          requestClose(false);
        },
        onClick: openOnClick
          ? (event: MouseEvent<HTMLDivElement>) => {
              // Keyboard clicks (detail 0) come from children or from Enter/Space handled above.
              if (event.detail === 0 || fromTrigger(event)) return;
              context.invoke(event.currentTarget, pointAt(event.clientX, event.clientY));
            }
          : undefined,
      };

  return (
    <WithSx className={className} styles={targetStyle} sx={sx}>
      {(className) => (
        <div
          role="group"
          tabIndex={0}
          {...consumerHandlersFirst(rest as HTMLProps<Element>, (attributes) => ({ ...attributes, ...internal }))}
          ref={mergedRef}
          id={targetId}
          aria-labelledby={ariaLabelledBy}
          data-ui="context-menu-target"
          data-disabled={disabled || undefined}
          className={className}
        />
      )}
    </WithSx>
  );
}

ContextMenuTarget.displayName = 'ContextMenu.Target';

function ContextMenuTrigger({ ref, id, className, sx, ...rest }: ContextMenuTriggerProps) {
  const context = useContextMenuContext('Trigger');
  const { open, getReferenceProps } = useMenuContext(FAMILY, 'Trigger');
  const fallbackId = useId();
  const mergedRef = useMergeRefs([context.triggerRef, ref]);

  // The controller's own handlers open the menu; the Trigger becomes its anchor first.
  const anchorFirst = (handler: unknown) => (event: SyntheticEvent<HTMLButtonElement>) => {
    if (!open) context.anchorTo(event.currentTarget, rectOf(event.currentTarget));
    if (typeof handler === 'function') handler(event);
  };

  const getProps = (attributes: HTMLProps<Element>) => {
    const props = getReferenceProps(attributes);
    return { ...props, onClick: anchorFirst(props.onClick), onKeyDown: anchorFirst(props.onKeyDown) };
  };

  return (
    <WithSx className={className} styles={triggerStyle} sx={sx}>
      {(className) => (
        <button
          type="button"
          {...consumerHandlersFirst(rest as HTMLProps<Element>, getProps)}
          ref={mergedRef}
          id={id ?? fallbackId}
          data-ui="context-menu-trigger"
          className={className}
        />
      )}
    </WithSx>
  );
}

ContextMenuTrigger.displayName = 'ContextMenu.Trigger';

function ContextMenuContent({ ref, style, dir, onKeyDown, ...props }: ContextMenuContentProps) {
  const { anchor, available, direction, targetLabel } = useContextMenuContext('Content');
  const { floatingContext, refs } = useMenuContext(FAMILY, 'Content');
  const [content, setContent] = useState<HTMLDivElement | null>(null);
  const mergedRef = useMergeRefs([setContent, ref]);

  // No enabled item to land on: the menu itself takes focus so Escape, Tab and typeahead work.
  useEffect(() => {
    if (!content || content.querySelector('[role^="menuitem"]:not([aria-disabled="true"])')) return;
    content.focus({ preventScroll: true });
  }, [content]);

  // The entry scale grows from the anchor, wherever collision handling placed the menu.
  const { x, y, placement } = floatingContext;
  const resolvedDir = dir ?? direction;
  const origin =
    anchor &&
    `${(resolvedDir === 'rtl' ? anchor.x + anchor.width : anchor.x) - x}px ${
      (placement.startsWith('top') ? anchor.y : anchor.y + anchor.height) - y
    }px`;
  const cssVars = {
    [ORIGIN_VAR]: origin || undefined,
    [AVAILABLE_INLINE_VAR]: available ? `${available.width}px` : undefined,
    [AVAILABLE_BLOCK_VAR]: available ? `${available.height}px` : undefined,
  } as CSSProperties;

  return (
    <MenuContentPart
      {...props}
      ref={mergedRef}
      dir={resolvedDir}
      style={{ ...style, ...cssVars }}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        // Shift+Tab leaves the menu for its invoker and keeps it open (Menu policy). The portal's
        // own tab order would land on whatever precedes the menu, often a child of the Target.
        const invoker = refs.domReference.current;
        if (event.defaultPrevented || event.key !== 'Tab' || !event.shiftKey || !invoker) return;
        event.preventDefault();
        invoker.focus();
      }}
      defaultLabelledBy={targetLabel}
      family={FAMILY}
      marker="context-menu"
      styles={[listboxSurfaceStyle, contentStyle]}
    />
  );
}

ContextMenuContent.displayName = 'ContextMenu.Content';

const hasContent = (node: ReactNode) => isRenderable(node) && node !== '';

function ItemBody({ icon, children }: { icon?: ReactNode; children?: ReactNode }) {
  return (
    <>
      {hasContent(icon) && (
        <span css={iconWrapperStyle} aria-hidden data-ui="context-menu-item-icon">
          {icon}
        </span>
      )}
      {hasContent(children) && <span css={labelStyle}>{children}</span>}
    </>
  );
}

function ContextMenuItem({ tone = 'neutral', icon, children, ...props }: ContextMenuItemProps) {
  useContextMenuContext('Item');
  return (
    <MenuItemPart
      {...props}
      part="Item"
      family={FAMILY}
      marker="context-menu-item"
      styles={[menuItemStyles, itemLayoutStyle, menuItemToneStyles[tone]]}
    >
      <ItemBody icon={icon}>{children}</ItemBody>
    </MenuItemPart>
  );
}

ContextMenuItem.displayName = 'ContextMenu.Item';

function ContextMenuCheckboxItem({
  value,
  defaultValue = false,
  onValueChange,
  onSelect,
  closeOnSelect = false,
  tone = 'neutral',
  icon,
  children,
  ...props
}: ContextMenuCheckboxItemProps) {
  useContextMenuContext('CheckboxItem');
  const [checked = false, requestChecked] = useControlledState<boolean>(value, defaultValue, onValueChange);

  return (
    <MenuItemPart
      {...props}
      aria-checked={checked}
      onSelect={() => {
        requestChecked(!checked);
        onSelect?.();
      }}
      itemRole="menuitemcheckbox"
      closeOnSelect={closeOnSelect}
      part="CheckboxItem"
      family={FAMILY}
      marker="context-menu-checkbox-item"
      styles={[menuItemStyles, itemLayoutStyle, menuItemToneStyles[tone]]}
    >
      <span css={checkStyle} aria-hidden data-state={checked ? 'checked' : 'unchecked'} data-ui="context-menu-check">
        {checkGlyph}
      </span>
      <ItemBody icon={icon}>{children}</ItemBody>
    </MenuItemPart>
  );
}

ContextMenuCheckboxItem.displayName = 'ContextMenu.CheckboxItem';

function ContextMenuSeparator(props: ContextMenuSeparatorProps) {
  useContextMenuContext('Separator');
  return <MenuSeparatorPart {...props} marker="context-menu-separator" styles={[menuSeparatorStyles, separatorStyle]} />;
}

ContextMenuSeparator.displayName = 'ContextMenu.Separator';

export const ContextMenu = Object.assign(ContextMenuRoot, {
  Target: ContextMenuTarget,
  Trigger: ContextMenuTrigger,
  Content: ContextMenuContent,
  Item: ContextMenuItem,
  CheckboxItem: ContextMenuCheckboxItem,
  Separator: ContextMenuSeparator,
});
