'use client';

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentPropsWithRef,
  type ComponentType,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { useReducedMotionConfig } from 'motion/react';
import { base } from '@jfrader/tokens';
import { vars } from '@jfrader/tokens/vars';
import { css, type Interpolation, type Theme } from '../../styling/css';
import { WithSx, type SxProps } from '../../styling/sx';
import { focusRingOutset } from '../../styling/focus-ring';
import { iconWrapperStyle } from '../../styling/icon-wrapper';
import { listboxScrollStyle, listboxSurfaceStyle } from '../../styling/listbox-style';
import { FORCED_COLORS, REDUCED_MOTION } from '../../styling/media';
import {
  GeneratedRoot,
  type GeneratedRootSlotProps,
} from '../../utils/generated-root';
import { useControlledState } from '../../utils/use-controlled-state';
import { useReducedMotion } from '../../utils/use-reduced-motion';
import { moveRovingFocus } from '../../utils/roving-focus';
import { ANCHOR_GAP } from '../../overlay/use-overlay-floating';
import { Button } from '../button';
import {
  MenuController,
  MenuContentPart,
  MenuItemPart,
  MenuTriggerPart,
  menuItemStyles,
  menuItemToneStyles,
  useMenuContext,
  type MenuContentProps,
  type MenuItemProps,
  type MenuTriggerProps,
} from '../menu/menu';
import { Spinner } from '../spinner';
import { tooltipContentStyle } from '../tooltip/tooltip';

export interface RadialMenuAction {
  id: string;
  label: string;
  icon?: ReactNode;
  tone?: 'neutral' | 'danger';
  disabled?: boolean;
}
type Part<P> = P & { sx?: Interpolation<Theme> };
export interface RadialMenuSlots {
  root?: ComponentType<ComponentPropsWithRef<'div'>>;
  /** Renders a `button` by default. */
  trigger?: ComponentType<MenuTriggerProps>;
  /** Renders a `div` by default. */
  content?: ComponentType<MenuContentProps>;
  /** Renders a `button` by default. */
  item?: ComponentType<MenuItemProps>;
  status?: ComponentType<ComponentPropsWithRef<'div'>>;
}
export interface RadialMenuProps
  extends Omit<ComponentPropsWithRef<'div'>, 'children'>, SxProps {
  /** Names the round hub button that opens the menu. */
  label: string;
  /** Replaces the hub glyph. Defaults to a plus that turns into a close cross while open. */
  icon?: ReactNode;
  /** Supplies actions in arc order; more than eight actions use a vertical list. */
  actions: readonly RadialMenuAction[];
  /** Runs the selected action by id and requests closing on success in the same open cycle. Rejection keeps the menu open. */
  onAction?: (id: string) => void | Promise<void>;
  /** Controls whether the menu is open; `disabled` forces it closed. */
  open?: boolean;
  /** Opens the uncontrolled menu initially. Defaults to `false`. */
  defaultOpen?: boolean;
  /** Called when the menu requests opening or closing. */
  onOpenChange?: (open: boolean) => void;
  /** Sets the action arc radius in pixels, with a minimum of 48. Defaults to 104 for omitted or non-finite values. A radius too small to clear the hub uses a list. */
  radius?: number;
  /** Sets the arc span in degrees, clamped to 1–360. The arc widens, up to a full ring, when the actions need more room. Omitted or non-finite values space actions 45° apart. */
  spread?: number;
  /** Physical angle in degrees: up -90, right 0, down 90, left 180. */
  direction?: number;
  /** Prevents opening the menu and running actions. Defaults to `false`. */
  disabled?: boolean;
  /** Announces action status through a live region. Defaults to `true`; `false` retains visible status. */
  announce?: boolean;
  /** Shifts the menu within the viewport and uses a list when the arc cannot fit. Defaults to `shift`. */
  collision?: 'shift' | 'none';
  /** Overrides pending, success and failure text functions, each receiving the action label. */
  messages?: Partial<{
    pending: (label: string) => string;
    done: (label: string) => string;
    failed: (label: string) => string;
  }>;
  /** Replaces the root container; `slots.root` takes precedence. */
  component?: RadialMenuSlots['root'];
  /** Replaces the root, trigger, menu content, action items or status. */
  slots?: RadialMenuSlots;
  /** Passes props to the root, trigger, menu content, action items and status. */
  slotProps?: {
    root?: GeneratedRootSlotProps;
    /** Renders a `button` by default. */
    trigger?: Part<MenuTriggerProps>;
    /** Renders a `div` by default. */
    content?: Part<MenuContentProps>;
    /** Renders a `button` by default. */
    item?: Part<MenuItemProps>;
    status?: Part<ComponentPropsWithRef<'div'>>;
  };
}
// Hub and satellites share one round size: the large button height, above the touch target.
const ITEM = parseFloat(base.space[12]);
const DEFAULT_RADIUS = 104;
// One rhythm at every count: three actions fan across 90°, eight close into a ring.
const DEFAULT_STEP = 45;
const MAX_RADIAL_ACTIONS = 8;
const HOLD_MS = 250;
const HIT_RADIUS = ITEM;
const DEAD_ZONE = 34;
const MOVEMENT_THRESHOLD = 8;
const DEGREES = 180 / Math.PI;
const rootStyle = css({
  display: 'inline-block',
  color: vars.color.text,
  fontFamily: vars.font.sans,
});
const hubStyle = css({
  touchAction: 'none',
  inlineSize: vars.space[12],
  minInlineSize: vars.space[12],
  paddingInline: 0,
  borderRadius: vars.radius.full,
  boxShadow: vars.shadow.overlay,
  '& svg': {
    inlineSize: vars.space[5],
    blockSize: vars.space[5],
    transitionProperty: 'rotate',
    transitionDuration: vars.motion.duration.base,
    transitionTimingFunction: vars.motion.easeStandard,
  },
  '&[aria-expanded="true"] [data-hub-glyph] svg': { rotate: '45deg' },
  '&[data-reduced-motion] svg': { transitionDuration: '0s' },
  [REDUCED_MOTION]: { '& svg': { transitionDuration: '0s' } },
  [FORCED_COLORS]: { boxShadow: 'none', border: '1px solid ButtonText' },
});
const contentStyle = css({
  position: 'relative',
  outline: 'none',
  pointerEvents: 'none',
});
const linearContentStyle = css(listboxSurfaceStyle, listboxScrollStyle, {
  pointerEvents: 'auto',
});
const radialItemStyle = css({
  position: 'absolute',
  boxSizing: 'border-box',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  inlineSize: vars.space[12],
  blockSize: vars.space[12],
  padding: 0,
  border: `1px solid ${vars.color.borderControl}`,
  borderRadius: vars.radius.full,
  backgroundColor: vars.color.surfaceRaised,
  boxShadow: vars.shadow.overlay,
  color: vars.color.text,
  font: 'inherit',
  fontSize: vars.textSize.md,
  fontWeight: vars.fontWeight.medium,
  cursor: 'pointer',
  pointerEvents: 'auto',
  transitionProperty: 'opacity, scale, translate, background-color, border-color, color',
  transitionDuration: vars.motion.duration.base,
  transitionTimingFunction: vars.motion.easeStandard,
  '@starting-style': {
    opacity: 0,
    scale: '0.4',
    translate: 'var(--radial-from-x) var(--radial-from-y)',
  },
  '& svg': { inlineSize: vars.space[5], blockSize: vars.space[5] },
  '&:hover:not([aria-disabled="true"]), &[data-active]:not([aria-disabled="true"]), &[data-targeted="true"]': {
    scale: '1.08',
    borderColor: vars.color.accent,
    backgroundColor: vars.color.surfaceHover,
    color: vars.color.accentText,
  },
  '&:focus-visible': focusRingOutset,
  '&[data-tone="danger"]': { color: vars.color.dangerText },
  '&[data-tone="danger"]:hover:not([aria-disabled="true"]), &[data-tone="danger"][data-active]:not([aria-disabled="true"]), &[data-tone="danger"][data-targeted="true"]': {
    borderColor: vars.color.danger,
    color: vars.color.dangerText,
  },
  '&[aria-disabled="true"]': { opacity: 0.55, cursor: 'not-allowed' },
  '[data-reduced-motion] > &': { transitionDuration: '0s' },
  [REDUCED_MOTION]: { transitionDuration: '0s' },
  [FORCED_COLORS]: {
    boxShadow: 'none',
    borderColor: 'ButtonText',
    '&[data-targeted="true"], &[data-active]': { borderColor: 'Highlight' },
  },
});
const linearItemStyle = css({
  display: 'flex',
  alignItems: 'center',
  gap: vars.space[2],
});
const captionStyle = css(tooltipContentStyle, {
  position: 'absolute',
  translate: '-50% -50%',
  whiteSpace: 'nowrap',
  pointerEvents: 'none',
});
const statusStyle = css({
  fontSize: vars.textSize.sm,
  color: vars.color.textMuted,
  marginBlockStart: vars.space[2],
});
const plusGlyph = (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M10 4v12M4 10h12" />
  </svg>
);
const defaultMessages = {
  pending: (label: string) => `${label}: pending`,
  done: (label: string) => `${label}: done`,
  failed: (label: string) => `${label}: failed`,
};

export function RadialMenu({
  open,
  defaultOpen = false,
  onOpenChange,
  disabled = false,
  radius = DEFAULT_RADIUS,
  ...props
}: RadialMenuProps) {
  const clampedRadius = Number.isFinite(radius)
    ? Math.max(ITEM, radius)
    : DEFAULT_RADIUS;
  const [linear, setLinear] = useState(false);
  const [current = false, request] = useControlledState(
    open,
    defaultOpen,
    onOpenChange,
  );
  useEffect(() => {
    if (disabled && current) request(false);
  }, [disabled, current, request]);
  return (
    <MenuController
      open={current && !disabled}
      onOpenChange={request}
      placement="top"
      positioning={{
        gap: linear ? ANCHOR_GAP : -(clampedRadius + ITEM),
        transform: false,
        collision: props.collision,
      }}
    >
      <RadialMenuBody
        {...props}
        radius={clampedRadius}
        disabled={disabled}
        onLinearChange={setLinear}
      />
    </MenuController>
  );
}

function RadialMenuBody({
  label,
  icon,
  actions,
  onAction,
  radius: r,
  spread,
  direction = -90,
  disabled,
  announce = true,
  collision = 'shift',
  messages,
  component,
  slots,
  slotProps,
  sx,
  className,
  onLinearChange,
  ...props
}: Omit<RadialMenuProps, 'open' | 'defaultOpen' | 'onOpenChange' | 'radius'> & {
  radius: number;
  onLinearChange: (linear: boolean) => void;
}) {
  const context = useMenuContext('RadialMenu', 'Root');
  const deviceReduced = useReducedMotion();
  const forcedReduced = useReducedMotionConfig();
  const reduced = Boolean(deviceReduced) || forcedReduced === true;
  const [status, setStatus] = useState('');
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [target, setTarget] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [focused, setFocused] = useState<string | null>(null);
  const [rtl, setRtl] = useState(false);
  const operation = useRef<object | null>(null);
  const openCycle = useRef(0);
  useLayoutEffect(() => {
    openCycle.current += 1;
    setHovered(null);
    setFocused(null);
  }, [context.open]);
  const gesture = useRef<{
    id: number;
    start: number;
    x: number;
    y: number;
  } | null>(null);
  const suppressClick = useRef(false);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const [viewport, setViewport] = useState({
    width: Infinity,
    height: Infinity,
  });
  useLayoutEffect(() => {
    setRtl(context.refs.domReference.current?.matches(':dir(rtl)') ?? false);
  }, [
    context.open,
    props.dir,
    slotProps?.root?.dir,
    context.refs.domReference,
  ]);
  useEffect(() => {
    const win = context.refs.domReference.current?.ownerDocument.defaultView;
    if (!win) return;
    const measure = () =>
      setViewport({ width: win.innerWidth, height: win.innerHeight });
    measure();
    win.addEventListener('resize', measure);
    return () => win.removeEventListener('resize', measure);
  }, [context.refs.domReference]);
  useEffect(
    () => () => {
      operation.current = null;
      clearTimeout(holdTimer.current);
    },
    [],
  );
  useEffect(() => {
    if (disabled) {
      clearTimeout(holdTimer.current);
      gesture.current = null;
      setTarget(null);
    }
  }, [disabled]);
  const count = actions.length;
  const preferred = spread !== undefined && Number.isFinite(spread)
    ? Math.min(360, Math.max(1, spread))
    : undefined;
  const angle = Number.isFinite(direction)
    ? ((direction % 360) + 360) % 360
    : 270;
  const diameter = r * 2 + ITEM;
  // Smallest angle between neighbors that keeps a gap between their circles. The arc widens to
  // that spacing and closes into a full ring when the widened arc would wrap around the hub.
  const minStep = 2 * Math.asin(Math.min(1, (ITEM + ANCHOR_GAP) / (2 * r))) * DEGREES;
  const pitch = preferred === undefined ? Math.max(DEFAULT_STEP, minStep) : minStep;
  const span = count < 2 ? 0 : Math.max(preferred ?? 0, (count - 1) * pitch);
  const ring = preferred === 360 || (count > 1 && span + pitch >= 360);
  const sweep = ring ? 360 : span;
  const step = count < 2 ? 0 : ring ? 360 / count : span / (count - 1);
  const positions = actions.map((_, index) => {
    const degrees = angle + (index - (count - 1) / 2) * step * (rtl ? -1 : 1);
    return {
      x: Math.cos(degrees / DEGREES) * r,
      y: Math.sin(degrees / DEGREES) * r,
    };
  });
  const crowded = ring && count * minStep > 360;
  const linear =
    count > MAX_RADIAL_ACTIONS ||
    crowded ||
    r < ITEM + ANCHOR_GAP ||
    (collision === 'shift' &&
      (diameter + ITEM > viewport.width ||
        diameter + ITEM > viewport.height));
  useLayoutEffect(() => {
    onLinearChange(linear);
  }, [linear, onLinearChange]);
  const copy = { ...defaultMessages, ...messages };
  const select = async (action: RadialMenuAction) => {
    if (disabled || action.disabled || operation.current) return;
    const token = {};
    const cycle = openCycle.current;
    operation.current = token;
    setPendingId(action.id);
    setStatus(copy.pending(action.label));
    try {
      await onAction?.(action.id);
      if (operation.current !== token) return;
      setStatus(copy.done(action.label));
      if (openCycle.current === cycle) context.requestClose(true);
    } catch {
      if (operation.current === token) setStatus(copy.failed(action.label));
    } finally {
      if (operation.current === token) {
        operation.current = null;
        setPendingId(null);
      }
    }
  };
  const { sx: triggerCss, ...triggerProps } = slotProps?.trigger ?? {};
  const { sx: contentCss, ...contentProps } = slotProps?.content ?? {};
  const { sx: itemCss, ...itemProps } = slotProps?.item ?? {};
  const { sx: statusCss, ...statusProps } = slotProps?.status ?? {};
  const Status = slots?.status ?? 'div';
  const cancelGesture = () => {
    clearTimeout(holdTimer.current);
    gesture.current = null;
    setTarget(null);
  };
  const inactive = disabled || !count;
  const spotlight = actions.find((action) => action.id === (target ?? hovered ?? focused));
  const captionDistance = r / 2;
  return (
    <GeneratedRoot
      {...props}
      component={slots?.root ?? component}
      rootSlot={slotProps?.root}
      marker="radial-menu"
      className={className}
      css={rootStyle}
      sx={sx}
    >
      <Button
        {...triggerProps}
        variant="solid"
        tone="accent"
        size="lg"
        disabled={inactive}
        aria-label={triggerProps['aria-labelledby'] === undefined ? (triggerProps['aria-label'] ?? label) : triggerProps['aria-label']}
        data-ui="radial-menu-trigger"
        data-reduced-motion={reduced || undefined}
        css={hubStyle}
        sx={triggerCss}
        onKeyDown={(event) => {
          triggerProps.onKeyDown?.(event);
          if (
            !event.defaultPrevented &&
            ['ArrowLeft', 'ArrowRight'].includes(event.key)
          ) {
            event.preventDefault();
            context.requestOpen();
          }
        }}
        onClick={(event) => {
          triggerProps.onClick?.(event);
          if (suppressClick.current && event.detail > 0) event.preventDefault();
          suppressClick.current = false;
        }}
        onPointerDown={(event) => {
          triggerProps.onPointerDown?.(event);
          if (
            event.defaultPrevented ||
            event.button !== 0 ||
            disabled ||
            gesture.current
          )
            return;
          suppressClick.current = false;
          gesture.current = {
            id: event.pointerId,
            start: event.timeStamp,
            x: event.clientX,
            y: event.clientY,
          };
          event.currentTarget.setPointerCapture(event.pointerId);
          holdTimer.current = setTimeout(() => context.requestOpen(), HOLD_MS);
        }}
        onPointerMove={(event) => {
          triggerProps.onPointerMove?.(event);
          if (
            !gesture.current ||
            gesture.current.id !== event.pointerId ||
            !context.open ||
            linear
          )
            return;
          if (
            Math.hypot(
              event.clientX - gesture.current.x,
              event.clientY - gesture.current.y,
            ) < MOVEMENT_THRESHOLD
          )
            return;
          const rect = context.refs.floating.current?.getBoundingClientRect();
          if (!rect) return;
          const x = event.clientX - rect.x - diameter / 2;
          const y = event.clientY - rect.y - diameter / 2;
          const distance = Math.hypot(x, y);
          const pointerAngle = Math.atan2(y, x) * DEGREES;
          const delta = Math.abs(((pointerAngle - angle + 540) % 360) - 180);
          const allowance = count <= 1 ? 30 : step / 2;
          if (
            distance < DEAD_ZONE ||
            distance > r + HIT_RADIUS ||
            delta > Math.min(180, sweep / 2 + allowance)
          ) {
            setTarget(null);
            return;
          }
          const nearest = positions.reduce(
            (best, point, index) =>
              Math.hypot(point.x - x, point.y - y) <
              Math.hypot(positions[best]!.x - x, positions[best]!.y - y)
                ? index
                : best,
            0,
          );
          setTarget(
            actions[nearest]?.disabled ? null : (actions[nearest]?.id ?? null),
          );
        }}
        onPointerUp={(event) => {
          triggerProps.onPointerUp?.(event);
          const press = gesture.current;
          if (!press || press.id !== event.pointerId) return;
          const held = event.timeStamp - press.start >= HOLD_MS;
          cancelGesture();
          if (event.currentTarget.hasPointerCapture(event.pointerId))
            event.currentTarget.releasePointerCapture(event.pointerId);
          if (held) {
            suppressClick.current = true;
            const action = actions.find((action) => action.id === target);
            if (action && context.open && !linear) void select(action);
            else context.requestClose(false);
          }
        }}
        onPointerCancel={cancelGesture}
        onLostPointerCapture={cancelGesture}
        render={({ ref, 'data-ui': marker, ...rendered }) => (
          <MenuTriggerPart
            {...rendered}
            ref={ref}
            disabled={inactive}
            family="RadialMenu"
            marker={marker}
            slots={{ trigger: slots?.trigger }}
          />
        )}
      >
        <span css={iconWrapperStyle} aria-hidden data-hub-glyph>
          {icon ?? plusGlyph}
        </span>
      </Button>
      <MenuContentPart
        {...contentProps}
        dir={rtl ? 'rtl' : 'ltr'}
        family="RadialMenu"
        marker="radial-menu-content"
        styles={[contentStyle, linear && linearContentStyle, contentCss]}
        slots={{ content: slots?.content }}
        data-linear={linear}
        data-reduced-motion={reduced || undefined}
        aria-busy={pendingId !== null || undefined}
        style={{
          ...contentProps.style,
          width: linear ? undefined : diameter,
          height: linear ? undefined : diameter,
        }}
        onKeyDown={(event) => {
          contentProps.onKeyDown?.(event);
          if (
            event.defaultPrevented ||
            !['ArrowRight', 'ArrowLeft'].includes(event.key)
          )
            return;
          moveRovingFocus(event, event.currentTarget, 'horizontal', {
            itemSelector: '[role="menuitem"]:not([aria-disabled="true"])',
            ownerSelector: '[data-ui~="radial-menu-content"]',
          });
        }}
      >
        {actions.map((action, index) => {
          const glyph = pendingId === action.id
            ? <Spinner size="sm" decorative />
            : action.icon ?? action.label.slice(0, 1);
          const point = positions[index]!;
          return (
            <MenuItemPart
              {...itemProps}
              key={action.id}
              family="RadialMenu"
              marker="radial-menu-item"
              slots={{ item: slots?.item }}
              styles={linear
                ? [menuItemStyles, menuItemToneStyles[action.tone ?? 'neutral'], linearItemStyle, itemCss]
                : [radialItemStyle, itemCss]}
              closeOnSelect={false}
              busy={pendingId !== null}
              disabled={action.disabled}
              aria-label={action.label}
              data-tone={action.tone}
              data-targeted={target === action.id}
              data-radial={!linear}
              style={{
                ...itemProps.style,
                ...(linear ? undefined : {
                  left: r + point.x,
                  top: r + point.y,
                  '--radial-from-x': `${-point.x}px`,
                  '--radial-from-y': `${-point.y}px`,
                } as CSSProperties),
              }}
              onPointerEnter={(event) => {
                itemProps.onPointerEnter?.(event);
                setHovered(action.id);
              }}
              onPointerLeave={(event) => {
                itemProps.onPointerLeave?.(event);
                setHovered((current) => (current === action.id ? null : current));
              }}
              onFocus={(event) => {
                itemProps.onFocus?.(event);
                setFocused(action.id);
              }}
              onBlur={(event) => {
                itemProps.onBlur?.(event);
                setFocused((current) => (current === action.id ? null : current));
              }}
              onSelect={() => void select(action)}
            >
              {linear ? (
                <>
                  {(pendingId === action.id || action.icon !== undefined) && (
                    <span css={iconWrapperStyle} aria-hidden>{glyph}</span>
                  )}
                  {action.label}
                </>
              ) : (
                <span aria-hidden="true">{glyph}</span>
              )}
            </MenuItemPart>
          );
        })}
        {!linear && spotlight && (
          <span
            aria-hidden
            css={captionStyle}
            data-ui="radial-menu-caption"
            style={{
              left: r + ITEM / 2 + Math.cos(angle / DEGREES) * captionDistance,
              top: r + ITEM / 2 + Math.sin(angle / DEGREES) * captionDistance,
            }}
          >
            {spotlight.label}
          </span>
        )}
      </MenuContentPart>
      {status && (
        <WithSx styles={[statusStyle, statusCss]}>
          {(className) => (
            <Status
              {...statusProps}
              className={[className, statusProps.className]
                .filter(Boolean)
                .join(' ')}
              data-ui="radial-menu-status"
              role={announce ? 'status' : undefined}
              aria-atomic="true"
            >
              {status}
            </Status>
          )}
        </WithSx>
      )}
    </GeneratedRoot>
  );
}
RadialMenu.displayName = 'RadialMenu';
