'use client';

// APG pattern: tooltip with rich, read-only content (a preview of a person, mention or
// reference). The trigger is described by the card (`aria-describedby`, merged with consumer
// ids) while it is open.
// Keyboard map: Tab / Shift+Tab onto the trigger opens immediately (focus-visible); Enter /
// Space activate the trigger natively and open the card once, without blocking the trigger's
// own action (links still navigate); Escape closes, keeps focus where it was and does not
// reopen until the pointer leaves or focus moves; Tab away closes without moving focus.
// Arrows, Home and End are never intercepted. Inside another overlay layer (e.g. a Popover),
// the open card is topmost: the first Escape or outside press closes only the card.
// Pointer: hover opens after `openDelay`; the card is hoverable per WCAG 1.4.13 (a safe
// polygon and the close delay bridge the gap, never `pointer-events: none`). A touch tap on a
// button trigger toggles the card; touch never opens it through emulated hover.
// Contract: the card is never focusable and holds no interactive content — use Popover for
// actions or forms. A preview is supplemental: never put information in it that is
// unavailable elsewhere. No focus manager; closing never moves focus.
// Group: `HoverCard.Group` owns which member is open, so moving between triggers swaps cards
// after the short `intentDelay` while the group is warm (a card is open or closed less than
// `skipDelay` ago). Group state lives in the mounted provider, never in module scope.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentPropsWithRef,
  type ComponentType,
  type CSSProperties,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
  type HTMLAttributes,
  type RefCallback,
} from 'react';
import {
  useFocus,
  useHover,
  useInteractions,
  useMergeRefs,
  useRole,
  safePolygon,
  type ElementProps,
  type Placement,
  type UseInteractionsReturn,
} from '@floating-ui/react';
import { vars } from '@jfrader/tokens/vars';
import { css, keyframes, type Interpolation, type Theme } from '../../styling/css';
import { REDUCED_MOTION } from '../../styling/media';
import { raisedSurface } from '../../styling/surface';
import { withoutSx, WithSx, type SxProps } from '../../styling/sx';
import { triggerStyle } from '../../styling/trigger-style';
import { OverlayLayer, useLayerDismiss } from '../../overlay/overlay-layer';
import { OverlayPortal } from '../../overlay/overlay-portal';
import { useOverlayFloating } from '../../overlay/use-overlay-floating';
import { numberFormatter } from '../../utils/intl';
import { isRenderable } from '../../utils/renderable';
import { useControlledState } from '../../utils/use-controlled-state';
import { Avatar } from '../avatar';

const DEFAULT_OPEN_DELAY_MS = 500;
const DEFAULT_CLOSE_DELAY_MS = 140;
const DEFAULT_SKIP_DELAY_MS = 300;
const DEFAULT_INTENT_DELAY_MS = 80;
/** Preferred card width; narrower viewports keep a `space[4]` gutter on each side. */
const CARD_INLINE_SIZE = '18.5rem';

export interface HoverCardBaseProps {
  /** Standalone only: controlled open state. Not allowed inside `HoverCard.Group`. */
  open?: boolean;
  /** Standalone only: initial open state when uncontrolled. Not allowed inside `HoverCard.Group`. */
  defaultOpen?: boolean;
  /** Standalone only: open/close requests. Not allowed inside `HoverCard.Group`. */
  onOpenChange?: (open: boolean) => void;
  /** Required inside `HoverCard.Group`: this member's unique id. Ignored when standalone. */
  value?: string;
  placement?: Placement;
  /** Hover delay before opening, in ms. Keyboard focus and activation open immediately. */
  openDelay?: number;
  /** Delay before closing after the pointer leaves trigger and card, in ms. */
  closeDelay?: number;
}

export interface HoverCardCompoundProps extends HoverCardBaseProps {
  children?: ReactNode;
  triggerLabel?: never;
  profile?: never;
  slotProps?: never;
  slots?: never;
}

export interface HoverCardSlotProps {
  /** Button that opens the hover card on pointer enter or focus. */
  trigger?: Omit<HoverCardTriggerProps, 'children'>;
  /** Floating overlay panel holding the hover card content. */
  content?: Omit<HoverCardContentProps, 'children'>;
  /** Built-in profile card rendered inside the overlay. */
  profile?: Partial<HoverCardProfileProps>;
}

export interface HoverCardEasyProps extends HoverCardBaseProps {
  /** Label or element that triggers the hover card. */
  triggerLabel: ReactNode;
  /** Profile attributes to render inside the card. */
  profile: HoverCardProfileProps;
  children?: never;
  slotProps?: HoverCardSlotProps;
  slots?: {
    /** Opens the hover card. */
    trigger?: ComponentType<NonNullable<HoverCardSlotProps['trigger']>>;
    /** Holds the hover card content. */
    content?: ComponentType<NonNullable<HoverCardSlotProps['content']>>;
    /** Displays the profile. */
    profile?: ComponentType<NonNullable<HoverCardSlotProps['profile']>>;
  };
}

export type HoverCardProps = HoverCardCompoundProps | HoverCardEasyProps;

export interface HoverCardGroupProps {
  /** The open member's `value`, or `null` when none is open. */
  value?: string | null;
  defaultValue?: string | null;
  onValueChange?: (value: string | null) => void;
  /** How long the group stays warm after its last card closes, in ms. */
  skipDelay?: number;
  /** Hover delay before opening while the group is warm, in ms. */
  intentDelay?: number;
  children?: ReactNode;
}

/** Props a Trigger `render` callback spreads onto the element it returns (e.g. a link). */
export interface HoverCardTriggerRenderProps extends HTMLAttributes<HTMLElement> {
  ref: RefCallback<HTMLElement>;
  'data-ui': string;
}

export interface HoverCardTriggerProps extends ComponentPropsWithRef<'button'>, SxProps {
  /**
   * Replace the button, e.g. with a profile link. Spread all supplied props onto the element
   * and attach the supplied ref. The ref points to that element, even when it is not a button;
   * its public type remains HTMLButtonElement for compatibility.
   * Links still navigate on click, Enter or tap; native activation is not prevented.
   * Inline links rely on the WCAG 2.5.8 inline exception for target size.
   */
  render?: (props: HoverCardTriggerRenderProps) => ReactNode;
}

export interface HoverCardContentProps extends Omit<ComponentPropsWithRef<'div'>, 'tabIndex'>, SxProps {}

export interface HoverCardStat {
  /** Stable key for the stat. */
  id: string;
  label: ReactNode;
  /** Numbers are formatted with `Intl.NumberFormat`; strings render as given (preformatted). */
  value: string | number;
}

/**
 * Native attributes for an internal Profile slot element (e.g. `id`, `aria-describedby`,
 * `title`), plus `css` applied after the slot's own styles.
 */
export type HoverCardProfilePartProps<Element extends 'div' | 'dl' | 'span' = 'div'> = Omit<
  ComponentPropsWithRef<Element>,
  'children'
> & { sx?: Interpolation<Theme> };

export interface HoverCardProfileProps extends Omit<ComponentPropsWithRef<'div'>, 'children'>, SxProps {
  /** Visible full identity; also the avatar's initials source. */
  name: string;
  subtitle?: ReactNode;
  bio?: ReactNode;
  /** Image URL for the default Avatar. */
  src?: string;
  /** Custom decorative avatar; replaces the default Avatar when it renders content. */
  avatar?: ReactNode;
  stats?: readonly HoverCardStat[];
  /** Footer line, e.g. a consumer-formatted join date. */
  meta?: ReactNode;
  /** Locale for numeric stats; defaults to the runtime locale. */
  locale?: Intl.LocalesArgument;
  slots?: HoverCardProfileSlots;
  slotProps?: {
    /** Decorative avatar element; `aria-hidden` is not configurable. */
    avatar?: Omit<HoverCardProfilePartProps<'span'>, 'aria-hidden'>;
    /** Container element holding the user name and subtitle. */
    identity?: HoverCardProfilePartProps;
    /** Biography text container element. */
    bio?: HoverCardProfilePartProps;
    /** Definition list element (`dl`) rendering user stats. */
    stats?: HoverCardProfilePartProps<'dl'>;
    /** Footer metadata element displaying additional details. */
    meta?: HoverCardProfilePartProps;
  };
}

export interface HoverCardProfileSlots {
  /** Displays the decorative avatar. */
  avatar?: ComponentType<Omit<HoverCardProfilePartProps<'span'>, 'aria-hidden'>>;
  /** Groups the name and subtitle. */
  identity?: ComponentType<HoverCardProfilePartProps>;
  /** Displays the biography. */
  bio?: ComponentType<HoverCardProfilePartProps>;
  /** Displays the profile statistics. */
  stats?: ComponentType<HoverCardProfilePartProps<'dl'>>;
  /** Displays profile metadata. */
  meta?: ComponentType<HoverCardProfilePartProps>;
}

type OverlayFloating = ReturnType<typeof useOverlayFloating>;
type Side = 'top' | 'right' | 'bottom' | 'left';

interface HoverCardContextValue {
  open: boolean;
  side: Side;
  refs: OverlayFloating['refs'];
  floatingStyles: CSSProperties;
  getReferenceProps: UseInteractionsReturn['getReferenceProps'];
  getFloatingProps: UseInteractionsReturn['getFloatingProps'];
  /** The card opened while its group was warm (fade-only, faster entry). */
  warmEntry: boolean;
}

/** The group's last accepted change of active member. */
interface GroupTransition {
  active: string | null;
  /** The change happened while the group was warm. */
  warm: boolean;
  /** When the group last went from a member to none, from `performance.now()`. */
  closedAt: number;
}

interface HoverCardGroupContextValue {
  active: string | null;
  requestActive: (value: string | null) => void;
  /** Read at hover time: a card is open, or one closed less than `skipDelay` ago. */
  isWarm: () => boolean;
  /** The current member opened while the group was warm. */
  warmEntry: boolean;
  intentDelay: number;
  register: (value: string) => () => void;
}

const HoverCardContext = createContext<HoverCardContextValue | null>(null);
const HoverCardGroupContext = createContext<HoverCardGroupContextValue | null>(null);

function useHoverCardContext(part: string): HoverCardContextValue {
  const context = useContext(HoverCardContext);
  if (!context) throw new Error(`HoverCard.${part} must be rendered inside <HoverCard>.`);
  return context;
}

/** Finite, nonnegative timings only; anything else falls back to the default. */
const toDelay = (value: number, fallback: number) => (Number.isFinite(value) && value >= 0 ? value : fallback);

// Keyboard focus on the trigger keeps the card open when the pointer leaves.
const hasVisibleFocus = (element: Element | null | undefined) =>
  element != null && element.ownerDocument.activeElement === element && element.matches(':focus-visible');

/**
 * Touch taps toggle; mouse clicks and keyboard activation only open. Never prevents default.
 * A tap toggles from the state at pointerdown, so a card the tap's own focus opened stays open.
 */
function usePressToOpen(open: boolean, requestOpenChange: (open: boolean) => void): ElementProps {
  const touchPressRef = useRef<{ wasOpen: boolean } | null>(null);
  return useMemo(
    () => ({
      reference: {
        onPointerDown: (event: PointerEvent<Element>) => {
          touchPressRef.current = event.pointerType === 'touch' ? { wasOpen: open } : null;
        },
        onClick: (event: MouseEvent<Element>) => {
          const touchPress = touchPressRef.current;
          touchPressRef.current = null;
          if (event.defaultPrevented) return;
          if (touchPress) requestOpenChange(!touchPress.wasOpen);
          else if (!open) requestOpenChange(true);
        },
      },
    }),
    [open, requestOpenChange],
  );
}

const enterOffset = vars.space[1];

const enter = keyframes({
  from: { opacity: 0, transform: 'translate(var(--hover-card-enter-x, 0), var(--hover-card-enter-y, 0))' },
  to: { opacity: 1, transform: 'none' },
});

const fadeIn = keyframes({ from: { opacity: 0 }, to: { opacity: 1 } });

const contentStyle = css({
  ...raisedSurface,
  borderRadius: vars.radius.lg,
  boxShadow: vars.shadow.floating,
  padding: vars.space[4],
  inlineSize: `min(${CARD_INLINE_SIZE}, calc(100vw - 2 * ${vars.space[4]}))`,
  fontSize: vars.textSize.sm,
  textAlign: 'start',
  overflowWrap: 'anywhere',
  animation: `${enter} ${vars.motion.duration.base} ${vars.motion.easeStandard}`,
  '&[data-side="bottom"]': { '--hover-card-enter-y': `calc(-1 * ${enterOffset})` },
  '&[data-side="top"]': { '--hover-card-enter-y': enterOffset },
  '&[data-side="left"]': { '--hover-card-enter-x': enterOffset },
  '&[data-side="right"]': { '--hover-card-enter-x': `calc(-1 * ${enterOffset})` },
  '&[data-entry="warm"]': {
    animation: `${fadeIn} ${vars.motion.duration.fast} ${vars.motion.easeStandard}`,
  },
  [REDUCED_MOTION]: {
    '&, &[data-entry="warm"]': { animation: 'none' },
  },
});

function HoverCardGroup({
  value: valueProp,
  defaultValue = null,
  onValueChange,
  skipDelay = DEFAULT_SKIP_DELAY_MS,
  intentDelay = DEFAULT_INTENT_DELAY_MS,
  children,
}: HoverCardGroupProps) {
  const [active = null, requestActive] = useControlledState<string | null>(valueProp, defaultValue, onValueChange);
  const skip = toDelay(skipDelay, DEFAULT_SKIP_DELAY_MS);
  const membersRef = useRef(new Map<string, number>());

  // Warmth follows accepted changes only, so it is derived when `active` actually changes
  // (a rejected request never changes it).
  const [transition, setTransition] = useState<GroupTransition>(() => ({
    active,
    warm: false,
    closedAt: Number.NEGATIVE_INFINITY,
  }));
  if (transition.active !== active) {
    const now = performance.now();
    setTransition({
      active,
      warm: transition.active !== null || now - transition.closedAt < skip,
      closedAt: active === null ? now : transition.closedAt,
    });
  }

  const transitionRef = useRef(transition);
  useEffect(() => {
    transitionRef.current = transition;
  }, [transition]);

  const isWarm = useCallback(() => {
    const { active: current, closedAt } = transitionRef.current;
    return current !== null || performance.now() - closedAt < skip;
  }, [skip]);

  // A member that unmounts while open requests `null` once. The check is deferred so a
  // StrictMode remount (same value, registered again synchronously) is not mistaken for one.
  const register = useCallback(
    (member: string) => {
      const members = membersRef.current;
      members.set(member, (members.get(member) ?? 0) + 1);
      return () => {
        const count = (members.get(member) ?? 1) - 1;
        if (count > 0) members.set(member, count);
        else members.delete(member);
        queueMicrotask(() => {
          if (!members.has(member) && transitionRef.current.active === member) requestActive(null);
        });
      };
    },
    [requestActive],
  );

  const context = useMemo(
    () => ({
      active,
      requestActive,
      isWarm,
      warmEntry: transition.warm,
      intentDelay: toDelay(intentDelay, DEFAULT_INTENT_DELAY_MS),
      register,
    }),
    [active, requestActive, isWarm, transition.warm, intentDelay, register],
  );

  return <HoverCardGroupContext.Provider value={context}>{children}</HoverCardGroupContext.Provider>;
}

HoverCardGroup.displayName = 'HoverCard.Group';

function HoverCardLayer({
  nodeId,
  open: openProp,
  defaultOpen,
  onOpenChange,
  value,
  placement = 'bottom-start',
  openDelay = DEFAULT_OPEN_DELAY_MS,
  closeDelay = DEFAULT_CLOSE_DELAY_MS,
  children,
}: HoverCardBaseProps & { children?: ReactNode; nodeId: string | undefined }) {
  const group = useContext(HoverCardGroupContext);
  if (group) {
    if (openProp !== undefined || defaultOpen !== undefined || onOpenChange !== undefined) {
      throw new Error('HoverCard inside <HoverCard.Group> takes no open/defaultOpen/onOpenChange; the group owns state.');
    }
    if (value === undefined) throw new Error('HoverCard inside <HoverCard.Group> requires a `value`.');
  }

  const [standaloneOpen = false, requestStandalone] = useControlledState<boolean>(
    group ? undefined : openProp,
    group ? false : (defaultOpen ?? false),
    group ? undefined : onOpenChange,
  );
  const memberValue = group ? (value as string) : undefined;
  const open = group ? group.active === memberValue : standaloneOpen;

  const requestOpenChange = useCallback(
    (next: boolean) => {
      if (!group) requestStandalone(next);
      else if (next) group.requestActive(memberValue as string);
      else if (group.active === memberValue) group.requestActive(null);
    },
    [group, memberValue, requestStandalone],
  );

  const register = group?.register;
  useEffect(() => {
    if (register && memberValue !== undefined) return register(memberValue);
  }, [register, memberValue]);

  const floating = useOverlayFloating({
    open,
    placement,
    nodeId,
    onOpenChange: (next, event, reason) => {
      if (!next && (reason === 'hover' || reason === 'safe-polygon')) {
        if (hasVisibleFocus(floating.refs.domReference.current)) return;
      }
      // The card is the topmost layer: its Escape must not also close an enclosing native dialog.
      if (!next && reason === 'escape-key') event?.preventDefault();
      requestOpenChange(next);
    },
  });
  const { refs, floatingStyles, context, placement: resolvedPlacement } = floating;

  const warmEntry = open && group?.warmEntry === true;
  const opening = toDelay(openDelay, DEFAULT_OPEN_DELAY_MS);
  const closing = toDelay(closeDelay, DEFAULT_CLOSE_DELAY_MS);

  // `move: false` means only a real pointer entry opens the card, so an Escape-dismissed card
  // stays closed while the pointer rests on the trigger.
  const hover = useHover(context, {
    delay: () => ({ open: group?.isWarm() ? group.intentDelay : opening, close: closing }),
    mouseOnly: true,
    move: false,
    handleClose: safePolygon(),
  });
  const focus = useFocus(context, { visibleOnly: true });
  const dismiss = useLayerDismiss(context, 'leaf');
  const role = useRole(context, { role: 'tooltip' });
  const press = usePressToOpen(open, requestOpenChange);
  const { getReferenceProps, getFloatingProps } = useInteractions([hover, focus, ...dismiss, role, press]);

  const side = resolvedPlacement.split('-')[0] as Side;
  const contextValue = useMemo(
    () => ({ open, side, refs, floatingStyles, getReferenceProps, getFloatingProps, warmEntry }),
    [open, side, refs, floatingStyles, getReferenceProps, getFloatingProps, warmEntry],
  );

  return <HoverCardContext.Provider value={contextValue}>{children}</HoverCardContext.Provider>;
}

function HoverCardRoot(props: HoverCardProps) {
  const { open, defaultOpen, onOpenChange, value, placement, openDelay, closeDelay } = props;
  const easyProps = props.profile !== undefined ? props : undefined;
  const Trigger = easyProps?.slots?.trigger ?? HoverCardTrigger;
  const Content = easyProps?.slots?.content ?? HoverCardContent;
  const Profile = easyProps?.slots?.profile ?? HoverCardProfile;

  return (
    <OverlayLayer>
      {(nodeId) => (
        <HoverCardLayer
          open={open}
          defaultOpen={defaultOpen}
          onOpenChange={onOpenChange}
          value={value}
          placement={placement}
          openDelay={openDelay}
          closeDelay={closeDelay}
          nodeId={nodeId}
        >
          {easyProps ? (
            <>
              <Trigger {...easyProps.slotProps?.trigger}>{easyProps.triggerLabel}</Trigger>
              <Content {...easyProps.slotProps?.content}>
                <Profile
                  {...easyProps.profile}
                  {...easyProps.slotProps?.profile}
                  slotProps={{
                    ...easyProps.profile.slotProps,
                    ...easyProps.slotProps?.profile?.slotProps,
                  }}
                />
              </Content>
            </>
          ) : (
            props.children
          )}
        </HoverCardLayer>
      )}
    </OverlayLayer>
  );
}

HoverCardRoot.displayName = 'HoverCard';

function HoverCardTrigger({
  ref = null,
  render,
  'aria-describedby': ariaDescribedByProp,
  className,
  sx,
  ...rest
}: HoverCardTriggerProps) {
  const { refs, getReferenceProps } = useHoverCardContext('Trigger');
  // The merged ref is a callback; typing it for any element lets `render` return e.g. a link.
  const mergedRef = useMergeRefs<HTMLButtonElement>([refs.setReference, ref]) as RefCallback<HTMLElement>;
  const { 'data-ui': partMarker, ...attributes } = rest as typeof rest & { 'data-ui'?: string };
  const referenceProps = getReferenceProps(attributes);
  // useRole sets aria-describedby while open; merge it with the consumer's ids.
  const describedBy =
    [ariaDescribedByProp, referenceProps['aria-describedby'] as string | undefined].filter(Boolean).join(' ') ||
    undefined;

  const triggerProps: HoverCardTriggerRenderProps = {
    ...(referenceProps as HTMLAttributes<HTMLElement>),
    ref: mergedRef,
    'aria-describedby': describedBy,
    'data-ui': render && partMarker !== undefined ? `${partMarker} hover-card-trigger` : 'hover-card-trigger',
  };

  // The render path has no own styles: the rendered element supplies them.
  return (
    <WithSx className={className} styles={render ? undefined : triggerStyle} sx={sx}>
      {(className) =>
        render ? render({ ...triggerProps, className }) : <button type="button" {...triggerProps} className={className} />
      }
    </WithSx>
  );
}

HoverCardTrigger.displayName = 'HoverCard.Trigger';

function HoverCardSurface({ ref, style, className, sx, ...rest }: HoverCardContentProps) {
  const { side, refs, floatingStyles, getFloatingProps, warmEntry } = useHoverCardContext('Content');
  // Read once when the surface mounts: the trigger's effective direction, which the portal
  // would otherwise lose (start/end placements and the card's text follow it).
  const [direction] = useState(() => {
    const reference = refs.domReference.current;
    return reference?.ownerDocument.defaultView?.getComputedStyle(reference).direction;
  });

  // getFloatingProps may add tabIndex; drop it so the card is never focusable. Do NOT set
  // pointer-events: none — hoverability is part of the WCAG 1.4.13 contract.
  const { tabIndex: ignoredTabIndex, ...floatingProps } = getFloatingProps(rest);
  void ignoredTabIndex;

  // The wrapper owns the positioning transform, so the entry animation on the card cannot
  // overwrite it.
  return (
    <div ref={refs.setFloating} dir={direction} style={floatingStyles}>
      <WithSx className={className} styles={contentStyle} sx={sx}>
        {(className) => (
          <div
            {...floatingProps}
            ref={ref}
            data-ui="hover-card"
            data-side={side}
            data-entry={warmEntry ? 'warm' : 'cold'}
            style={style}
            className={className}
          />
        )}
      </WithSx>
    </div>
  );
}

function HoverCardContent(props: HoverCardContentProps) {
  const { open } = useHoverCardContext('Content');
  if (!open) return null;
  return (
    <OverlayPortal>
      <HoverCardSurface {...props} />
    </OverlayPortal>
  );
}

HoverCardContent.displayName = 'HoverCard.Content';

const profileStyle = css({
  display: 'grid',
  gap: vars.space[3],
  fontFamily: vars.font.sans,
  lineHeight: vars.lineHeight.base,
  color: vars.color.text,
});

const headerStyle = css({
  display: 'flex',
  alignItems: 'center',
  gap: vars.space[3],
  minInlineSize: 0,
});

const avatarStyle = css({ display: 'inline-flex', flexShrink: 0 });

const identityStyle = css({ display: 'grid', minInlineSize: 0 });

const nameStyle = css({
  fontSize: vars.textSize.md,
  fontWeight: vars.fontWeight.medium,
});

const mutedStyle = css({
  fontSize: vars.textSize.sm,
  color: vars.color.textMuted,
});

const statsStyle = css({
  display: 'flex',
  flexWrap: 'wrap',
  columnGap: vars.space[6],
  rowGap: vars.space[2],
  margin: 0,
});

const statStyle = css({ display: 'grid' });

const statLabelStyle = css({
  fontSize: vars.textSize.xs,
  color: vars.color.textMuted,
});

const statValueStyle = css({
  margin: 0,
  fontSize: vars.textSize.md,
  fontWeight: vars.fontWeight.medium,
  fontVariantNumeric: 'tabular-nums',
});

const metaStyle = css({
  paddingBlockStart: vars.space[3],
  borderBlockStart: `1px solid ${vars.color.borderSubtle}`,
  fontSize: vars.textSize.xs,
  color: vars.color.textMuted,
});

function HoverCardProfile({
  ref,
  name,
  subtitle,
  bio,
  src,
  avatar,
  stats = [],
  meta,
  locale,
  slotProps,
  slots,
  className,
  sx,
  ...rest
}: HoverCardProfileProps) {
  const Bio = slots?.bio ?? 'div';
  const AvatarPart = slots?.avatar ?? 'span';
  const Identity = slots?.identity ?? 'div';
  const Stats = slots?.stats ?? 'dl';
  const Meta = slots?.meta ?? 'div';
  const numberFormat = stats.some((stat) => typeof stat.value === 'number')
    ? numberFormatter(locale)
    : undefined;

  return (
    <WithSx className={className} styles={profileStyle} sx={sx}>
      {(className) => (
        <div {...rest} ref={ref} data-ui="hover-card-profile" className={className}>
          <div css={headerStyle}>
            {/* Decorative: the visible name beside it is the one identity announcement. */}
            <AvatarPart {...withoutSx(slotProps?.avatar)} aria-hidden="true" css={[avatarStyle, slotProps?.avatar?.sx]}>
              {isRenderable(avatar) ? avatar : <Avatar name={name} src={src} size="lg" />}
            </AvatarPart>
            <Identity {...withoutSx(slotProps?.identity)} css={[identityStyle, slotProps?.identity?.sx]}>
              <div css={nameStyle}>{name}</div>
              {isRenderable(subtitle) && <div css={mutedStyle}>{subtitle}</div>}
            </Identity>
          </div>
          {isRenderable(bio) && (
            <Bio {...withoutSx(slotProps?.bio)} css={[mutedStyle, slotProps?.bio?.sx]}>
              {bio}
            </Bio>
          )}
          {stats.length > 0 && (
            <Stats {...withoutSx(slotProps?.stats)} css={[statsStyle, slotProps?.stats?.sx]}>
              {stats.map((stat) => (
                <div key={stat.id} css={statStyle}>
                  <dt css={statLabelStyle}>{stat.label}</dt>
                  <dd css={statValueStyle}>
                    {typeof stat.value === 'number' ? numberFormat?.format(stat.value) : stat.value}
                  </dd>
                </div>
              ))}
            </Stats>
          )}
          {isRenderable(meta) && (
            <Meta {...withoutSx(slotProps?.meta)} css={[metaStyle, slotProps?.meta?.sx]}>
              {meta}
            </Meta>
          )}
        </div>
      )}
    </WithSx>
  );
}

HoverCardProfile.displayName = 'HoverCard.Profile';

export const HoverCard = Object.assign(HoverCardRoot, {
  Trigger: HoverCardTrigger,
  Content: HoverCardContent,
  Profile: HoverCardProfile,
  Group: HoverCardGroup,
});
