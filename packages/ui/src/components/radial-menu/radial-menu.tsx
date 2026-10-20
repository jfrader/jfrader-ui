'use client';

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentPropsWithRef,
  type ComponentType,
  type ReactNode,
} from 'react';
import { MotionConfig, motion, useReducedMotion } from 'motion/react';
import { vars } from '@jfrader/tokens/vars';
import { css, type Interpolation, type Theme } from '../../styling/css';
import { WithSx, type SxProps } from '../../styling/sx';
import { motionDurationMs } from '../../styling/motion-timings';
import { focusRingOutset } from '../../styling/focus-ring';
import {
  GeneratedRoot,
  type GeneratedRootSlotProps,
} from '../../utils/generated-root';
import { useControlledState } from '../../utils/use-controlled-state';
import { moveRovingFocus } from '../../utils/roving-focus';
import { ANCHOR_GAP } from '../../overlay/use-overlay-floating';
import {
  MenuController,
  MenuContentPart,
  MenuItemPart,
  MenuTriggerPart,
  useMenuContext,
  type MenuContentProps,
  type MenuItemProps,
  type MenuTriggerProps,
} from '../menu/menu';

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
  /** Sets the text on the menu trigger. */
  label: string;
  /** Supplies actions in arc order; more than six actions use a vertical list. */
  actions: readonly RadialMenuAction[];
  /** Runs the selected action by id and requests closing on success in the same open cycle. Rejection keeps the menu open. */
  onAction?: (id: string) => void | Promise<void>;
  /** Controls whether the menu is open; `disabled` forces it closed. */
  open?: boolean;
  /** Opens the uncontrolled menu initially. Defaults to `false`. */
  defaultOpen?: boolean;
  /** Called when the menu requests opening or closing. */
  onOpenChange?: (open: boolean) => void;
  /** Sets the action arc radius in pixels, with a minimum of 40. Defaults to 104 for omitted or non-finite values. */
  radius?: number;
  /** Sets the arc span in degrees, clamped to 1–360. Defaults to 150 for omitted or non-finite values. */
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
const TARGET = 40;
const DEFAULT_RADIUS = 104;
const HOLD_MS = 250;
const HIT_RADIUS = 48;
const DEAD_ZONE = 34;
const MOVEMENT_THRESHOLD = 8;
const triggerGestureStyle = css({ touchAction: 'none' });
const rootStyle = css({
  display: 'inline-block',
  color: vars.color.text,
  fontFamily: vars.font.sans,
});
const controlStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: vars.space[2],
  minInlineSize: vars.space[10],
  minBlockSize: vars.space[10],
  padding: vars.space[2],
  border: `1px solid ${vars.color.borderControl}`,
  borderRadius: vars.radius.full,
  background: vars.color.surfaceRaised,
  color: vars.color.text,
  font: 'inherit',
  cursor: 'pointer',
  '&:focus-visible': focusRingOutset,
  '&:hover, &[data-targeted="true"]': {
    background: vars.color.accentSoft,
    color: vars.color.accentText,
  },
  '&[data-tone="danger"]': { color: vars.color.dangerText },
  '&[aria-disabled="true"], &:disabled': {
    cursor: 'not-allowed',
    color: vars.color.textMuted,
  },
});
const contentStyle = css({
  position: 'relative',
  outline: 'none',
  pointerEvents: 'none',
  '&[data-linear="true"]': {
    display: 'flex',
    flexDirection: 'column',
    gap: vars.space[2],
    padding: vars.space[2],
    background: vars.color.surfaceRaised,
    borderRadius: vars.radius.md,
    border: `1px solid ${vars.color.borderControl}`,
  },
});
const itemStyle = css({
  pointerEvents: 'auto',
  '&[data-radial="true"]': {
    position: 'absolute',
    inlineSize: vars.space[10],
    blockSize: vars.space[10],
    padding: 0,
  },
  '& svg': { inlineSize: vars.space[5], blockSize: vars.space[5] },
});
const statusStyle = css({
  fontSize: vars.textSize.sm,
  color: vars.color.textMuted,
  marginBlockStart: vars.space[2],
});
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
    ? Math.max(TARGET, radius)
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
    <MotionConfig reducedMotion="user">
      <MenuController
        open={current && !disabled}
        onOpenChange={request}
        placement="top"
        positioning={{
          gap: linear ? ANCHOR_GAP : -(clampedRadius + TARGET),
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
    </MotionConfig>
  );
}

function RadialMenuBody({
  label,
  actions,
  onAction,
  radius: r,
  spread = 150,
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
  const reduce = useReducedMotion();
  const [status, setStatus] = useState('');
  const [pending, setPending] = useState(false);
  const [target, setTarget] = useState<string | null>(null);
  const [rtl, setRtl] = useState(false);
  const operation = useRef<object | null>(null);
  const openCycle = useRef(0);
  useLayoutEffect(() => {
    openCycle.current += 1;
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
  const arc = Number.isFinite(spread)
    ? Math.min(360, Math.max(1, spread))
    : 150;
  const angle = Number.isFinite(direction)
    ? ((direction % 360) + 360) % 360
    : 270;
  const diameter = r * 2 + TARGET;
  const positions = actions.map((_, index) => {
    const step =
      arc === 360
        ? arc / actions.length
        : arc / Math.max(1, actions.length - 1);
    const degrees =
      angle +
      (actions.length === 1 ? 0 : (-arc / 2 + index * step) * (rtl ? -1 : 1));
    return {
      x: Math.cos((degrees * Math.PI) / 180) * r,
      y: Math.sin((degrees * Math.PI) / 180) * r,
    };
  });
  const overlap = positions.some((a, i) =>
    positions.some(
      (b, j) => i !== j && Math.hypot(a.x - b.x, a.y - b.y) < TARGET + ANCHOR_GAP,
    ),
  );
  const linear =
    actions.length > 6 ||
    overlap ||
    (collision === 'shift' &&
      (diameter + TARGET > viewport.width ||
        diameter + TARGET > viewport.height));
  useLayoutEffect(() => {
    onLinearChange(linear);
  }, [linear, onLinearChange]);
  const copy = { ...defaultMessages, ...messages };
  const select = async (action: RadialMenuAction) => {
    if (disabled || action.disabled || operation.current) return;
    const token = {};
    const cycle = openCycle.current;
    operation.current = token;
    setPending(true);
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
        setPending(false);
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
      <MenuTriggerPart
        {...triggerProps}
        family="RadialMenu"
        marker="radial-menu-trigger"
        styles={[controlStyle, triggerGestureStyle, triggerCss]}
        slots={{ trigger: slots?.trigger }}
        disabled={disabled || !actions.length}
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
          const pointerAngle = (Math.atan2(y, x) * 180) / Math.PI;
          const delta = Math.abs(((pointerAngle - angle + 540) % 360) - 180);
          const allowance =
            actions.length <= 1
              ? 30
              : arc / Math.max(1, actions.length - 1) / 2;
          if (
            distance < DEAD_ZONE ||
            distance > r + HIT_RADIUS ||
            delta > Math.min(180, arc / 2 + allowance)
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
      >
        {label}
      </MenuTriggerPart>
      <MenuContentPart
        {...contentProps}
        dir={rtl ? 'rtl' : 'ltr'}
        family="RadialMenu"
        marker="radial-menu-content"
        styles={[contentStyle, contentCss]}
        slots={{ content: slots?.content }}
        data-linear={linear}
        aria-busy={pending || undefined}
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
        {actions.map((action, index) => (
          <motion.div
            key={action.id}
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: reduce ? 0 : motionDurationMs.base / 1000 }}
          >
            <MenuItemPart
              {...itemProps}
              family="RadialMenu"
              marker="radial-menu-item"
              slots={{ item: slots?.item }}
              styles={[controlStyle, itemStyle, itemCss]}
              closeOnSelect={false}
              busy={pending}
              disabled={action.disabled}
              title={action.label}
              aria-label={action.label}
              data-tone={action.tone}
              data-targeted={target === action.id}
              data-radial={!linear}
              style={{
                ...itemProps.style,
                left: linear ? undefined : r + positions[index]!.x,
                top: linear ? undefined : r + positions[index]!.y,
              }}
              onSelect={() => void select(action)}
            >
              {linear ? (
                action.label
              ) : (
                <span aria-hidden="true">
                  {action.icon ?? action.label.slice(0, 1)}
                </span>
              )}
            </MenuItemPart>
          </motion.div>
        ))}
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
