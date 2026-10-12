'use client';

// UserMenu: the account entry point. A Trigger showing the person's avatar opens one surface with
// their identity, account commands, appearance and presence preferences and sign out. Built on
// the shared menu controller (state, list navigation, typeahead, dismissal, focus return); this
// file adds the identity header, the radio groups, the async sign out and the compact sheet.
// APG patterns: menu button with a menu (desktop) and a modal dialog holding that menu (compact).
// Desktop: the Trigger exposes aria-haspopup="menu", aria-expanded and (while open) aria-controls
// pointing at the menu; the menu is named by the Trigger. Identity sits outside the menu, so it is
// read as text, never as a fake command. Compact (`variant="sheet"`, or `"adaptive"` below
// `compactBreakpoint`): the surface is a bottom sheet with role="dialog" and aria-modal="true",
// named by the Identity name; the Trigger exposes aria-haspopup="dialog" and controls the sheet.
// Outside content is inert, focus is contained (Close included) and the page does not scroll.
// Keyboard map: on the Trigger, Enter/Space/ArrowDown open on the first enabled item and ArrowUp
// on the last. In the menu, ArrowDown/ArrowUp move and wrap over every command and every radio
// option, Home/End jump, printable characters jump to the next match (500ms buffer). On a radio
// option, ArrowLeft/ArrowRight move within its group (swapped in RTL) without selecting;
// Enter/Space request its value once and keep the menu open. Enter/Space on a command select it
// once; Sign out stays open while its action is pending. Escape closes and returns focus to the
// Trigger (a rejected controlled close keeps focus inside). Desktop Tab closes and lets focus move
// on (Menu policy); in the sheet Tab and Shift+Tab cycle inside it.
// Every accepted sheet close (Escape, Close, scrim, handle drag) returns focus to the Trigger.
// Sign out: a returned promise marks the item busy (aria-busy, aria-disabled, still focusable);
// fulfillment closes the menu, rejection keeps it open with an alert outside the menu and allows a
// retry. A settling action closes or reports only into the open surface that started it.
// Theme and status groups only report values; they never change the document theme or presence.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ComponentPropsWithRef,
  type HTMLProps,
  type KeyboardEvent,
  type MutableRefObject,
  type PointerEvent,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { FloatingFocusManager, useMergeRefs, type Placement } from '@floating-ui/react';
import { vars } from '@jfrader/tokens/vars';
import { css, keyframes, type Interpolation, type Theme } from '../../styling/css';
import { focusRingInset, focusRingOutset } from '../../styling/focus-ring';
import { iconWrapperStyle } from '../../styling/icon-wrapper';
import { listboxSurfaceStyle } from '../../styling/listbox-style';
import { FORCED_COLORS, REDUCED_MOTION } from '../../styling/media';
import { WithSx, type SxProps } from '../../styling/sx';
import { visuallyHiddenStyle } from '../../styling/visually-hidden';
import { OverlayPortal } from '../../overlay/overlay-portal';
import { useScrollLock } from '../../overlay/use-scroll-lock';
import { isRenderable } from '../../utils/renderable';
import { moveRovingFocus } from '../../utils/roving-focus';
import { useControlledState } from '../../utils/use-controlled-state';
import { Avatar, type AvatarStatus } from '../avatar';
import { Kbd } from '../kbd';
import {
  MenuCollection,
  MenuController,
  MenuItemPart,
  MenuSeparatorPart,
  consumerHandlersFirst,
  joinIds,
  menuItemStyles,
  menuItemToneStyles,
  menuSeparatorStyles,
  restoreTriggerFocus,
  useMenuContext,
  type MenuItemTone,
} from '../menu/menu';
import { Pill } from '../pill';
import { Spinner } from '../spinner';

const FAMILY = 'UserMenu';
/** Viewport width, in px, below which the adaptive presentation becomes a sheet. */
const DEFAULT_COMPACT_BREAKPOINT = 640;
/** Preferred inline size of the desktop menu; capped to the viewport by the surface style. */
const MENU_INLINE_SIZE = '17.5rem';
/** Tallest the sheet grows before its content scrolls. */
const SHEET_MAX_BLOCK_SIZE = '88dvh';
/** Downward handle drag, in px, past which releasing dismisses the sheet. */
const DISMISS_DRAG_PX = 80;
/** Minimum block size of commands and options: pointer-sized on desktop, touch-sized in the sheet. */
const MENU_TARGET_SIZE = '32px';
const SHEET_TARGET_SIZE = '48px';
const TARGET_SIZE_VAR = '--user-menu-target-size';
const DRAG_VAR = '--user-menu-drag';
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

const THEME_OPTIONS = ['light', 'dark', 'system'] as const;
const STATUS_OPTIONS = ['available', 'busy', 'away'] as const;
const OPTION_QUERY = { itemSelector: '[role="menuitemradio"]', ownerSelector: '[role="group"]' };

export type UserMenuTheme = (typeof THEME_OPTIONS)[number];
export type UserMenuStatus = (typeof STATUS_OPTIONS)[number];
export type UserMenuVariant = 'adaptive' | 'menu' | 'sheet';
export type UserMenuItemTone = MenuItemTone;

export interface UserMenuUser {
  name: string;
  email: string;
  /** Plan or role label shown next to the email; `0` renders. */
  plan?: ReactNode;
  avatarSrc?: string;
}

export interface UserMenuPartProps {
  className?: string;
  css?: Interpolation<Theme>;
}

export interface UserMenuProps {
  user: UserMenuUser;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Desktop placement next to the Trigger; flips when there is no room. */
  placement?: Placement;
  /** Viewport width in px below which `variant="adaptive"` content becomes a sheet. */
  compactBreakpoint?: number;
  children?: ReactNode;
}

export interface UserMenuTriggerProps extends Omit<ComponentPropsWithRef<'button'>, 'children'>, SxProps {
  /** Translated name of the button, e.g. "Account menu, Ada Lovelace". */
  'aria-label': string;
  /** Shows the user's name next to the avatar outside compact viewports. */
  showName?: boolean;
  status?: AvatarStatus;
  /** Translated status word, exposed as the Trigger's description. */
  statusLabel?: string;
}

interface UserMenuContentBaseProps extends ComponentPropsWithRef<'div'>, SxProps {
  slotProps?: {
    menu?: UserMenuPartProps;
    handle?: UserMenuPartProps;
    close?: UserMenuPartProps;
  };
}

export type UserMenuContentProps = UserMenuContentBaseProps &
  (
    | { variant: 'menu'; closeLabel?: string }
    | {
        variant?: 'adaptive' | 'sheet';
        /** Translated name of the sheet's Close button. */
        closeLabel: string;
      }
  );

export interface UserMenuIdentityProps extends ComponentPropsWithRef<'div'>, SxProps {}

export interface UserMenuItemProps extends Omit<ComponentPropsWithRef<'button'>, 'onSelect'>, SxProps {
  /** Called once when the item is activated. The menu then closes unless a click handler called
   * `event.preventDefault()`. */
  onSelect?: () => void;
  disabled?: boolean;
  tone?: UserMenuItemTone;
  /** Decorative icon before the label. */
  icon?: ReactNode;
  /** Shortcut hint keys, shown as decoration only; no shortcut is registered. */
  keys?: readonly string[];
}

export interface UserMenuGroupSlotProps {
  label?: UserMenuPartProps;
  option?: UserMenuPartProps;
}

interface ChoiceGroupProps<V extends string> extends Omit<ComponentPropsWithRef<'div'>, 'defaultValue'>, SxProps {
  value?: V;
  defaultValue?: V;
  onValueChange?: (value: V) => void;
  /** Translated group name and option labels. */
  labels: { group: string } & Record<V, string>;
  slotProps?: UserMenuGroupSlotProps;
}

export type UserMenuThemeGroupProps = ChoiceGroupProps<UserMenuTheme>;
export type UserMenuStatusGroupProps = ChoiceGroupProps<UserMenuStatus>;

export interface UserMenuSignOutProps extends Omit<UserMenuItemProps, 'onSelect' | 'disabled'> {
  /** Signs the user out. A returned promise keeps the item busy until it settles. */
  onSignOut: () => void | PromiseLike<unknown>;
  /** Translated label shown while the action is pending. */
  pendingLabel: string;
  /** Translated message announced when the action fails. */
  errorMessage: string;
  /** Receives the failure (a rejection or a synchronous throw). */
  onSignOutError?: (error: unknown) => void;
}

export interface UserMenuSeparatorProps extends ComponentPropsWithRef<'div'>, SxProps {}

type Presentation = 'menu' | 'sheet';
/** The menu attributes among the controller's floating props. */
type MenuSemantics = Pick<HTMLProps<HTMLDivElement>, 'role' | 'id' | 'aria-labelledby' | 'aria-orientation'>;
type Direction = 'ltr' | 'rtl';
/** One open surface; a settling sign out acts only on the surface that started it. */
type Session = object;

interface SignOutFailure {
  session: Session;
  message: string;
}

interface UserMenuContextValue {
  user: UserMenuUser;
  compact: boolean;
  /** The presentation of the registered Content, which the Trigger's popup semantics follow. */
  presentation: Presentation;
  registerContent: (variant: UserMenuVariant, id: string | undefined) => void;
  /** The surface's id (the sheet dialog) and the inner menu's id, kept distinct. */
  contentId: string;
  menuId: string;
  identityNameId: string | undefined;
  setIdentityNameId: (id: string | undefined) => void;
  sessionRef: MutableRefObject<Session | null>;
  signOutPending: boolean;
  signOutFailure: SignOutFailure | null;
  runSignOut: (action: UserMenuSignOutProps['onSignOut'], message: string, onError?: (error: unknown) => void) => void;
}

const UserMenuContext = createContext<UserMenuContextValue | null>(null);
// Set by Content: where Identity renders, outside the menu element.
const IdentitySlotContext = createContext<HTMLElement | null | undefined>(undefined);

function useUserMenu(part: string): UserMenuContextValue {
  const context = useContext(UserMenuContext);
  if (!context) throw new Error(`${FAMILY}.${part} must be rendered inside <${FAMILY}>.`);
  return context;
}

const isPromiseLike = (value: unknown): value is PromiseLike<unknown> =>
  typeof value === 'object' && value !== null && typeof (value as PromiseLike<unknown>).then === 'function';

const presentationOf = (variant: UserMenuVariant, compact: boolean): Presentation =>
  variant === 'adaptive' ? (compact ? 'sheet' : 'menu') : variant;

const noop = () => {};

/** True while `view` is narrower than `breakpoint`; the server and the first hydration pass say desktop. */
function useCompactViewport(view: Window | null | undefined, breakpoint: number) {
  const query = `(width < ${breakpoint}px)`;
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (!view) return noop;
      const list = view.matchMedia(query);
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    [view, query],
  );
  return useSyncExternalStore(
    subscribe,
    () => view?.matchMedia(query).matches ?? false,
    () => false,
  );
}

const menuEnter = keyframes({
  from: { opacity: 0, scale: '0.98' },
  to: { opacity: 1, scale: '1' },
});

const sheetEnter = keyframes({
  from: { transform: 'translateY(100%)' },
  to: { transform: 'translateY(0)' },
});

const scrimEnter = keyframes({
  from: { opacity: 0 },
  to: { opacity: 1 },
});

const triggerStyle = css({
  label: 'user-menu-trigger',
  appearance: 'none',
  boxSizing: 'border-box',
  display: 'inline-flex',
  alignItems: 'center',
  gap: vars.space[2],
  maxInlineSize: '100%',
  minBlockSize: vars.space[10],
  padding: vars.space[1],
  border: `1px solid ${vars.color.borderControl}`,
  borderRadius: vars.radius.full,
  backgroundColor: 'transparent',
  font: 'inherit',
  fontSize: vars.textSize.sm,
  fontWeight: vars.fontWeight.medium,
  color: vars.color.text,
  cursor: 'pointer',
  transitionProperty: 'background-color',
  transitionDuration: vars.motion.duration.fast,
  transitionTimingFunction: vars.motion.easeStandard,
  '&:hover:not(:disabled)': {
    backgroundColor: vars.color.surfaceHover,
  },
  '&:focus-visible': focusRingOutset,
  '&:disabled': {
    opacity: 0.55,
    cursor: 'not-allowed',
  },
  [REDUCED_MOTION]: {
    transitionDuration: '0s',
  },
  [FORCED_COLORS]: {
    borderColor: 'ButtonText',
  },
});

const triggerNameStyle = css({
  minInlineSize: 0,
  paddingInlineEnd: vars.space[2],
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

const scrimStyle = css({
  label: 'user-menu-scrim',
  position: 'fixed',
  inset: 0,
  backgroundColor: vars.color.scrim,
  animation: `${scrimEnter} ${vars.motion.duration.slow} ${vars.motion.easeStandard}`,
  [REDUCED_MOTION]: {
    animation: 'none',
  },
});

const shellStyle = css({
  label: 'user-menu',
  [TARGET_SIZE_VAR]: MENU_TARGET_SIZE,
  borderColor: vars.color.borderControl,
  inlineSize: MENU_INLINE_SIZE,
  minInlineSize: 0,
  maxBlockSize: `calc(100dvh - 2 * ${vars.space[4]})`,
  overflowY: 'auto',
  overscrollBehavior: 'contain',
  fontSize: vars.textSize.sm,
  animation: `${menuEnter} ${vars.motion.duration.base} ${vars.motion.easeStandard}`,
  '&:focus-visible': focusRingOutset,
  '&[data-presentation="sheet"]': {
    [TARGET_SIZE_VAR]: SHEET_TARGET_SIZE,
    position: 'fixed',
    insetInline: 0,
    insetBlockEnd: 0,
    inlineSize: 'auto',
    maxInlineSize: 'none',
    maxBlockSize: SHEET_MAX_BLOCK_SIZE,
    paddingInline: vars.space[3],
    paddingBlockEnd: `calc(${vars.space[3]} + env(safe-area-inset-bottom, 0px))`,
    borderEndStartRadius: 0,
    borderEndEndRadius: 0,
    borderStartStartRadius: vars.radius.lg,
    borderStartEndRadius: vars.radius.lg,
    borderBlockEndWidth: 0,
    translate: `0 var(${DRAG_VAR}, 0px)`,
    animation: `${sheetEnter} ${vars.motion.duration.slow} ${vars.motion.easeStandard}`,
  },
  [REDUCED_MOTION]: {
    animation: 'none',
    '&[data-presentation="sheet"]': {
      animation: 'none',
    },
  },
  [FORCED_COLORS]: {
    borderColor: 'ButtonText',
  },
});

const handleStyle = css({
  display: 'flex',
  justifyContent: 'center',
  paddingBlock: vars.space[2],
  touchAction: 'none',
  cursor: 'grab',
  '&::before': {
    content: '""',
    inlineSize: vars.space[10],
    blockSize: vars.space[1],
    borderRadius: vars.radius.full,
    backgroundColor: vars.color.borderControl,
  },
  [REDUCED_MOTION]: {
    cursor: 'auto',
  },
  [FORCED_COLORS]: {
    '&::before': {
      backgroundColor: 'CanvasText',
    },
  },
});

const headerStyle = css({
  display: 'flex',
  alignItems: 'flex-start',
  gap: vars.space[2],
});

const identitySlotStyle = css({
  flex: 1,
  minInlineSize: 0,
});

const closeStyle = css({
  appearance: 'none',
  boxSizing: 'border-box',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  inlineSize: SHEET_TARGET_SIZE,
  blockSize: SHEET_TARGET_SIZE,
  border: `1px solid ${vars.color.borderControl}`,
  borderRadius: vars.radius.full,
  backgroundColor: 'transparent',
  color: vars.color.text,
  cursor: 'pointer',
  transitionProperty: 'background-color',
  transitionDuration: vars.motion.duration.fast,
  transitionTimingFunction: vars.motion.easeStandard,
  '& svg': { inlineSize: vars.space[4], blockSize: vars.space[4] },
  '&:hover': { backgroundColor: vars.color.surfaceHover },
  '&:focus-visible': focusRingOutset,
  [REDUCED_MOTION]: { transitionDuration: '0s' },
  [FORCED_COLORS]: { borderColor: 'ButtonText' },
});

const menuStyle = css({
  display: 'flex',
  flexDirection: 'column',
  touchAction: 'pan-y',
  '&:focus-visible': focusRingInset,
});

const errorStyle = css({
  color: vars.color.dangerText,
  fontSize: vars.textSize.sm,
  '&:not(:empty)': {
    marginBlockStart: vars.space[1],
    paddingBlock: vars.space[2],
    paddingInline: vars.space[2],
    borderBlockStart: `1px solid ${vars.color.border}`,
  },
});

const identityStyle = css({
  label: 'user-menu-identity',
  display: 'flex',
  alignItems: 'center',
  gap: vars.space[3],
  paddingBlock: vars.space[2],
  paddingInline: vars.space[2],
});

const identityTextStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: vars.space[1],
  minInlineSize: 0,
});

const ellipsisStyle = css({
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

const identityNameStyle = css({
  fontWeight: vars.fontWeight.medium,
  color: vars.color.text,
});

const identityEmailStyle = css({
  fontSize: vars.textSize.xs,
  color: vars.color.textMuted,
});

const identityPlanStyle = css({
  alignSelf: 'flex-start',
});

const itemLayoutStyle = css({
  minBlockSize: `var(${TARGET_SIZE_VAR}, ${MENU_TARGET_SIZE})`,
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

const keysStyle = css({
  marginInlineStart: 'auto',
});

// Pending reads as busy, not as disabled: the label stays at full contrast.
const signOutStyle = css({
  '&[aria-busy="true"]': {
    opacity: 1,
    cursor: 'progress',
  },
});

const separatorStyle = css({
  [FORCED_COLORS]: {
    backgroundColor: 'CanvasText',
  },
});

const groupStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: vars.space[1],
  paddingBlock: vars.space[1],
});

const groupLabelStyle = css({
  paddingInline: vars.space[2],
  fontSize: vars.textSize.xs,
  fontWeight: vars.fontWeight.medium,
  color: vars.color.textMuted,
});

const optionsStyle = css({
  display: 'flex',
  gap: vars.space[1],
});

// Checked options carry a border and a heavier weight besides the fill, so the state never rests on color.
const optionStyle = css({
  flex: '1 1 0',
  minInlineSize: 0,
  minBlockSize: `var(${TARGET_SIZE_VAR}, ${MENU_TARGET_SIZE})`,
  justifyContent: 'center',
  textAlign: 'center',
  overflowWrap: 'anywhere',
  border: '1px solid transparent',
  '&[aria-checked="true"]': {
    borderColor: vars.color.borderControl,
    backgroundColor: vars.color.surfaceHover,
    fontWeight: vars.fontWeight.medium,
  },
  [FORCED_COLORS]: {
    '&[aria-checked="true"]': {
      borderColor: 'Highlight',
      borderWidth: '2px',
    },
    '&[data-active]': {
      outline: '2px solid Highlight',
      outlineOffset: '2px',
    },
  },
});

const closeGlyph = (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
    <path d="M4 4l8 8M12 4l-8 8" />
  </svg>
);

/** Inside the controller: compact detection, Content registration, sign-out state, sheet focus return. */
function UserMenuScope({
  user,
  compactBreakpoint,
  children,
}: {
  user: UserMenuUser;
  compactBreakpoint: number;
  children?: ReactNode;
}) {
  const { open, refs, floatingContext, requestClose } = useMenuContext(FAMILY, 'Root');
  const view = floatingContext.elements.domReference?.ownerDocument.defaultView;
  const compact = useCompactViewport(view, compactBreakpoint);
  const fallbackContentId = useId();
  const menuId = useId();
  const [content, setContent] = useState<{ variant: UserMenuVariant; id: string | undefined }>({
    variant: 'adaptive',
    id: undefined,
  });
  const [identityNameId, setIdentityNameId] = useState<string>();
  const [signOutPending, setSignOutPending] = useState(false);
  const [signOutFailure, setSignOutFailure] = useState<SignOutFailure | null>(null);
  const sessionRef = useRef<Session | null>(null);
  const pendingRef = useRef(false);
  const mountedRef = useRef(false);
  const sheetOpenRef = useRef(false);
  const presentation = presentationOf(content.variant, compact);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useLayoutEffect(() => {
    if (open) sheetOpenRef.current = presentation === 'sheet';
  }, [open, presentation]);

  // A modal sheet held focus, so any applied close (scrim, external prop) hands it back to the
  // Trigger rather than to the page body. Escape, Close and handle release take the same path.
  useEffect(() => {
    if (open || !sheetOpenRef.current) return;
    sheetOpenRef.current = false;
    restoreTriggerFocus(refs.domReference.current);
  }, [open, refs]);

  const registerContent = useCallback((variant: UserMenuVariant, id: string | undefined) => {
    setContent((previous) => (previous.variant === variant && previous.id === id ? previous : { variant, id }));
  }, []);

  const runSignOut = useCallback<UserMenuContextValue['runSignOut']>(
    (action, message, onError) => {
      if (pendingRef.current) return;
      const session = sessionRef.current;
      const isCurrent = () => mountedRef.current && session !== null && sessionRef.current === session;
      const succeed = () => {
        if (isCurrent()) requestClose(true);
      };
      const fail = (error: unknown) => {
        onError?.(error);
        if (isCurrent() && session) setSignOutFailure({ session, message });
      };
      setSignOutFailure(null);
      let result: void | PromiseLike<unknown>;
      try {
        result = action();
      } catch (error) {
        fail(error);
        return;
      }
      if (!isPromiseLike(result)) {
        succeed();
        return;
      }
      pendingRef.current = true;
      setSignOutPending(true);
      const settle = () => {
        pendingRef.current = false;
        if (mountedRef.current) setSignOutPending(false);
      };
      Promise.resolve(result).then(
        () => {
          settle();
          succeed();
        },
        (error: unknown) => {
          settle();
          fail(error);
        },
      );
    },
    [requestClose],
  );

  const value = useMemo<UserMenuContextValue>(
    () => ({
      user,
      compact,
      presentation,
      registerContent,
      contentId: content.id ?? fallbackContentId,
      menuId,
      identityNameId,
      setIdentityNameId,
      sessionRef,
      signOutPending,
      signOutFailure,
      runSignOut,
    }),
    [
      user,
      compact,
      presentation,
      registerContent,
      content.id,
      fallbackContentId,
      menuId,
      identityNameId,
      signOutPending,
      signOutFailure,
      runSignOut,
    ],
  );

  return <UserMenuContext.Provider value={value}>{children}</UserMenuContext.Provider>;
}

function UserMenuRoot({
  user,
  open,
  defaultOpen = false,
  onOpenChange,
  placement = 'bottom-end',
  compactBreakpoint = DEFAULT_COMPACT_BREAKPOINT,
  children,
}: UserMenuProps) {
  const breakpoint =
    Number.isFinite(compactBreakpoint) && compactBreakpoint > 0 ? compactBreakpoint : DEFAULT_COMPACT_BREAKPOINT;
  return (
    <MenuController open={open} defaultOpen={defaultOpen} onOpenChange={onOpenChange} placement={placement}>
      <UserMenuScope user={user} compactBreakpoint={breakpoint}>
        {children}
      </UserMenuScope>
    </MenuController>
  );
}

UserMenuRoot.displayName = 'UserMenu';

function UserMenuTrigger({
  ref,
  showName = false,
  status,
  statusLabel,
  'aria-describedby': ariaDescribedBy,
  className,
  sx,
  ...rest
}: UserMenuTriggerProps) {
  const { user, compact, presentation, contentId, menuId } = useUserMenu('Trigger');
  const { open, refs, getReferenceProps } = useMenuContext(FAMILY, 'Trigger');
  const statusId = useId();
  const mergedRef = useMergeRefs([refs.setReference, ref]);
  const hasStatus = status !== undefined;

  // The sheet is a modal dialog that holds the menu, so the Trigger announces and controls it.
  // The controller's own aria-controls would follow the surface's id, which is not the menu's.
  const getProps = (attributes: HTMLProps<Element>) => {
    const props = getReferenceProps(attributes);
    const sheet = presentation === 'sheet';
    return {
      ...props,
      'aria-haspopup': sheet ? 'dialog' : 'menu',
      'aria-controls': open ? (sheet ? contentId : menuId) : undefined,
    };
  };

  return (
    <WithSx className={className} styles={triggerStyle} sx={sx}>
      {(className) => (
        <button
          type="button"
          {...consumerHandlersFirst(rest as HTMLProps<Element>, getProps)}
          ref={mergedRef}
          aria-describedby={joinIds(ariaDescribedBy, hasStatus ? statusId : undefined)}
          data-ui="user-menu-trigger"
          className={className}
        >
          {/* Decorative: the Trigger's aria-label carries the name and the description the status. */}
          <Avatar aria-hidden name={user.name} src={user.avatarSrc} status={status} statusLabel={statusLabel} />
          {showName && !compact && <span css={triggerNameStyle}>{user.name}</span>}
          {hasStatus && (
            <span id={statusId} css={visuallyHiddenStyle}>
              {statusLabel ?? status}
            </span>
          )}
        </button>
      )}
    </WithSx>
  );
}

UserMenuTrigger.displayName = 'UserMenu.Trigger';

function UserMenuContent({ variant = 'adaptive', id, ...props }: UserMenuContentProps) {
  const { registerContent } = useUserMenu('Content');
  const { open } = useMenuContext(FAMILY, 'Content');

  useLayoutEffect(() => {
    registerContent(variant, id);
  }, [registerContent, variant, id]);

  if (!open) return null;
  return <UserMenuSurface {...props} variant={variant} />;
}

UserMenuContent.displayName = 'UserMenu.Content';

type SurfaceProps = Omit<UserMenuContentBaseProps, 'id'> & { variant: UserMenuVariant; closeLabel?: string };

/** The open surface: mounted per open, so its session ends when it closes. */
function UserMenuSurface({
  ref,
  variant,
  closeLabel,
  slotProps,
  style,
  dir,
  className,
  sx,
  children,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  'aria-describedby': ariaDescribedBy,
  ...rest
}: SurfaceProps) {
  const { compact, contentId, menuId, identityNameId, sessionRef, signOutFailure } = useUserMenu('Content');
  const { refs, floatingContext, floatingStyles, getFloatingProps, requestClose } = useMenuContext(FAMILY, 'Content');
  const sheet = presentationOf(variant, compact) === 'sheet';
  const [session] = useState<Session>(() => ({}));
  const [shell, setShell] = useState<HTMLDivElement | null>(null);
  const [identitySlot, setIdentitySlot] = useState<HTMLDivElement | null>(null);
  const [direction, setDirection] = useState<Direction>();
  const menuRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const dragRef = useRef<{ pointerId: number; startY: number; distance: number } | null>(null);
  const mergedRef = useMergeRefs([setShell, ref]);

  useLayoutEffect(() => {
    sessionRef.current = session;
    return () => {
      if (sessionRef.current === session) sessionRef.current = null;
    };
  }, [sessionRef, session]);

  // The portaled surface takes the Trigger's direction (radio arrows and logical layout follow it).
  useLayoutEffect(() => {
    const trigger = refs.domReference.current;
    if (trigger) setDirection(getComputedStyle(trigger).direction === 'rtl' ? 'rtl' : 'ltr');
  }, [refs]);

  useScrollLock(sheet, () => refs.floating.current?.ownerDocument);

  // Nothing enabled to land on: focus the sheet's Close button, or the menu itself on desktop.
  useEffect(() => {
    if (!shell || shell.querySelector('[role^="menuitem"]:not([aria-disabled="true"]), [aria-busy="true"]')) return;
    (sheet ? closeRef.current : menuRef.current)?.focus({ preventScroll: true });
    // Keyed on the shell only: a later presentation change keeps whatever holds focus.
  }, [shell]);

  // Interaction handlers go on the shell so keys work from the Close button too; the menu
  // semantics go on the inner element that owns the items. The controller's id follows the
  // floating layer, so the menu takes the scope's own id instead.
  const {
    role,
    id: _surfaceId,
    'aria-labelledby': triggerLabel,
    'aria-orientation': orientation,
    ...interactions
  } = getFloatingProps(rest) as MenuSemantics & Record<string, unknown>;

  const consumerName = (internal: string | undefined) =>
    ariaLabelledBy !== undefined ? joinIds(ariaLabelledBy, internal) : ariaLabel !== undefined ? undefined : internal;
  // Desktop: consumer naming routes to the menu. Sheet: it names the dialog; the menu keeps the Trigger.
  const shellNaming = sheet
    ? {
        role: 'dialog',
        'aria-modal': true,
        'aria-label': ariaLabel,
        'aria-labelledby': consumerName(identityNameId ?? triggerLabel),
        'aria-describedby': ariaDescribedBy,
      }
    : {};
  const menuNaming = sheet
    ? { 'aria-labelledby': triggerLabel }
    : { 'aria-label': ariaLabel, 'aria-labelledby': consumerName(triggerLabel), 'aria-describedby': ariaDescribedBy };

  const view = () => shell?.ownerDocument.defaultView;
  const setDrag = (distance: number | null) => {
    if (distance === null) shell?.style.removeProperty(DRAG_VAR);
    else shell?.style.setProperty(DRAG_VAR, `${distance}px`);
  };
  const endDrag = () => {
    dragRef.current = null;
    setDrag(null);
  };
  const handleGesture = {
    onPointerDown: (event: PointerEvent<HTMLDivElement>) => {
      if (!event.isPrimary || event.button !== 0 || view()?.matchMedia(REDUCED_MOTION_QUERY).matches) return;
      event.currentTarget.setPointerCapture?.(event.pointerId);
      dragRef.current = { pointerId: event.pointerId, startY: event.clientY, distance: 0 };
    },
    onPointerMove: (event: PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (drag?.pointerId !== event.pointerId) return;
      drag.distance = Math.max(0, event.clientY - drag.startY);
      setDrag(drag.distance);
    },
    onPointerUp: (event: PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (drag?.pointerId !== event.pointerId) return;
      endDrag();
      if (drag.distance >= DISMISS_DRAG_PX) requestClose(true);
    },
    onPointerCancel: endDrag,
    onLostPointerCapture: (event: PointerEvent<HTMLDivElement>) => {
      if (dragRef.current?.pointerId === event.pointerId) endDrag();
    },
  };

  const failure = signOutFailure?.session === session ? signOutFailure.message : null;

  return (
    <OverlayPortal>
      {/* The layer is the floating element and the focus manager's direct child. Desktop is
          non-modal (Tab closes, no trap, focus return is explicit); the sheet is modal with inert
          outside content. The sheet's scrim lives inside the layer, so a press on it is not an
          outside press: it dismisses on click, after the whole press, so nothing underneath
          receives the click and focus goes back to the Trigger. */}
      <FloatingFocusManager
        context={floatingContext}
        modal={sheet}
        outsideElementsInert={sheet}
        initialFocus={-1}
        returnFocus={false}
        restoreFocus
      >
        <div ref={refs.setFloating} data-ui="user-menu-layer" style={sheet ? undefined : floatingStyles}>
          {sheet && (
            <div
              aria-hidden="true"
              data-ui="user-menu-scrim"
              css={scrimStyle}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => requestClose(true)}
            />
          )}
          <WithSx className={className} styles={[listboxSurfaceStyle, shellStyle]} sx={sx}>
            {(className) => (
              <div
                {...interactions}
                {...shellNaming}
                ref={mergedRef}
                id={contentId}
                dir={dir ?? direction}
                data-ui="user-menu"
                data-presentation={sheet ? 'sheet' : 'menu'}
                style={style}
                className={className}
              >
                {sheet && (
                  <div
                    {...handleGesture}
                    aria-hidden="true"
                    data-ui="user-menu-handle"
                    className={slotProps?.handle?.className}
                    css={[handleStyle, slotProps?.handle?.css]}
                  />
                )}
                <div css={headerStyle}>
                  <div ref={setIdentitySlot} css={identitySlotStyle} />
                  {sheet && (
                    <button
                      type="button"
                      ref={closeRef}
                      aria-label={closeLabel}
                      data-ui="user-menu-close"
                      onClick={() => requestClose(true)}
                      className={slotProps?.close?.className}
                      css={[closeStyle, slotProps?.close?.css]}
                    >
                      {closeGlyph}
                    </button>
                  )}
                </div>
                <div
                  {...menuNaming}
                  ref={menuRef}
                  id={menuId}
                  role={role}
                  aria-orientation={orientation}
                  tabIndex={-1}
                  data-ui="user-menu-list"
                  className={slotProps?.menu?.className}
                  css={[menuStyle, slotProps?.menu?.css]}
                >
                  <IdentitySlotContext.Provider value={identitySlot}>
                    <MenuCollection family={FAMILY}>{children}</MenuCollection>
                  </IdentitySlotContext.Provider>
                </div>
                {/* Outside the menu, so it is announced and read as text, never navigated as a command. */}
                <div role="alert" data-ui="user-menu-error" css={errorStyle}>
                  {failure}
                </div>
              </div>
            )}
          </WithSx>
        </div>
      </FloatingFocusManager>
    </OverlayPortal>
  );
}

function UserMenuIdentity({ ref, className, sx, ...rest }: UserMenuIdentityProps) {
  const { user, setIdentityNameId } = useUserMenu('Identity');
  const slot = useContext(IdentitySlotContext);
  const nameId = useId();

  useLayoutEffect(() => {
    setIdentityNameId(nameId);
    return () => setIdentityNameId(undefined);
  }, [nameId, setIdentityNameId]);

  if (slot === undefined) throw new Error(`${FAMILY}.Identity must be rendered inside <${FAMILY}.Content>.`);
  if (slot === null) return null;

  return createPortal(
    <WithSx className={className} styles={identityStyle} sx={sx}>
      {(className) => (
        <div {...rest} ref={ref} data-ui="user-menu-identity" className={className}>
          {/* Decorative: the visible name below is the same text. */}
          <Avatar aria-hidden name={user.name} src={user.avatarSrc} size="lg" />
          <div css={identityTextStyle}>
            <span id={nameId} css={[ellipsisStyle, identityNameStyle]}>
              {user.name}
            </span>
            <span css={[ellipsisStyle, identityEmailStyle]}>{user.email}</span>
            {isRenderable(user.plan) && user.plan !== '' && (
              <Pill tone="accent" css={identityPlanStyle}>
                {user.plan}
              </Pill>
            )}
          </div>
        </div>
      )}
    </WithSx>,
    slot,
  );
}

UserMenuIdentity.displayName = 'UserMenu.Identity';

const hasContent = (node: ReactNode) => isRenderable(node) && node !== '';

function ItemBody({ leading, keys, children }: { leading?: ReactNode; keys?: readonly string[]; children?: ReactNode }) {
  return (
    <>
      {hasContent(leading) && (
        <span css={iconWrapperStyle} aria-hidden="true" data-ui="user-menu-item-icon">
          {leading}
        </span>
      )}
      {hasContent(children) && <span css={labelStyle}>{children}</span>}
      {keys !== undefined && keys.length > 0 && (
        <Kbd.Group aria-hidden="true" css={keysStyle}>
          {keys.map((key) => (
            <Kbd key={key}>{key}</Kbd>
          ))}
        </Kbd.Group>
      )}
    </>
  );
}

function UserMenuItem({ tone = 'neutral', icon, keys, children, ...props }: UserMenuItemProps) {
  useUserMenu('Item');
  return (
    <MenuItemPart
      {...props}
      part="Item"
      family={FAMILY}
      marker="user-menu-item"
      styles={[menuItemStyles, itemLayoutStyle, menuItemToneStyles[tone]]}
    >
      <ItemBody leading={icon} keys={keys}>
        {children}
      </ItemBody>
    </MenuItemPart>
  );
}

UserMenuItem.displayName = 'UserMenu.Item';

function ChoiceGroup<V extends string>({
  part,
  marker,
  options,
  fallback,
  value,
  defaultValue = fallback,
  onValueChange,
  labels,
  slotProps,
  ref,
  onKeyDown,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  className,
  sx,
  ...rest
}: ChoiceGroupProps<V> & { part: string; marker: string; options: readonly V[]; fallback: V }) {
  useUserMenu(part);
  const [current, requestValue] = useControlledState<V>(value, defaultValue, onValueChange);
  const labelId = useId();
  const labelledBy =
    ariaLabelledBy !== undefined ? joinIds(ariaLabelledBy, labelId) : ariaLabel !== undefined ? undefined : labelId;

  // Left/Right stay inside the group (swapped in RTL) and only move focus; Up/Down/Home/End and
  // typeahead belong to the shared menu navigation.
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(event);
    if (event.defaultPrevented || (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')) return;
    moveRovingFocus(event, event.currentTarget, 'horizontal', OPTION_QUERY);
  };

  return (
    <WithSx className={className} styles={groupStyle} sx={sx}>
      {(className) => (
        <div
          {...rest}
          ref={ref}
          role="group"
          aria-label={ariaLabel}
          aria-labelledby={labelledBy}
          onKeyDown={handleKeyDown}
          data-ui={marker}
          className={className}
        >
          <span
            id={labelId}
            data-ui="user-menu-group-label"
            className={slotProps?.label?.className}
            css={[groupLabelStyle, slotProps?.label?.css]}
          >
            {labels.group}
          </span>
          <div css={optionsStyle}>
            {options.map((option) => (
              <MenuItemPart
                key={option}
                aria-checked={current === option}
                data-value={option}
                onSelect={() => requestValue(option)}
                itemRole="menuitemradio"
                closeOnSelect={false}
                part={part}
                family={FAMILY}
                marker="user-menu-option"
                className={slotProps?.option?.className}
                styles={[menuItemStyles, optionStyle, slotProps?.option?.css]}
              >
                {labels[option]}
              </MenuItemPart>
            ))}
          </div>
        </div>
      )}
    </WithSx>
  );
}

function UserMenuThemeGroup(props: UserMenuThemeGroupProps) {
  return (
    <ChoiceGroup
      {...props}
      part="ThemeGroup"
      marker="user-menu-theme-group"
      options={THEME_OPTIONS}
      fallback="system"
    />
  );
}

UserMenuThemeGroup.displayName = 'UserMenu.ThemeGroup';

function UserMenuStatusGroup(props: UserMenuStatusGroupProps) {
  return (
    <ChoiceGroup
      {...props}
      part="StatusGroup"
      marker="user-menu-status-group"
      options={STATUS_OPTIONS}
      fallback="available"
    />
  );
}

UserMenuStatusGroup.displayName = 'UserMenu.StatusGroup';

function UserMenuSignOut({
  onSignOut,
  pendingLabel,
  errorMessage,
  onSignOutError,
  tone = 'neutral',
  icon,
  keys,
  children,
  ...props
}: UserMenuSignOutProps) {
  const { signOutPending, runSignOut } = useUserMenu('SignOut');
  return (
    <MenuItemPart
      {...props}
      onSelect={() => runSignOut(onSignOut, errorMessage, onSignOutError)}
      busy={signOutPending}
      closeOnSelect={false}
      part="SignOut"
      family={FAMILY}
      marker="user-menu-sign-out"
      styles={[menuItemStyles, itemLayoutStyle, menuItemToneStyles[tone], signOutStyle]}
    >
      <ItemBody leading={signOutPending ? <Spinner aria-hidden size="sm" /> : icon} keys={keys}>
        {signOutPending ? pendingLabel : children}
      </ItemBody>
    </MenuItemPart>
  );
}

UserMenuSignOut.displayName = 'UserMenu.SignOut';

function UserMenuSeparator(props: UserMenuSeparatorProps) {
  useUserMenu('Separator');
  return <MenuSeparatorPart {...props} marker="user-menu-separator" styles={[menuSeparatorStyles, separatorStyle]} />;
}

UserMenuSeparator.displayName = 'UserMenu.Separator';

export const UserMenu = Object.assign(UserMenuRoot, {
  Trigger: UserMenuTrigger,
  Content: UserMenuContent,
  Identity: UserMenuIdentity,
  Item: UserMenuItem,
  ThemeGroup: UserMenuThemeGroup,
  StatusGroup: UserMenuStatusGroup,
  SignOut: UserMenuSignOut,
  Separator: UserMenuSeparator,
});
