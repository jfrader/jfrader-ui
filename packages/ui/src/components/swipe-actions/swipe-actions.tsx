'use client';

import {
  Children,
  createContext,
  isValidElement,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ComponentPropsWithRef,
  type ReactNode,
  type RefObject,
} from 'react';
import { useMergeRefs } from '@floating-ui/react';
import {
  AnimatePresence,
  MotionConfig,
  animate,
  motion,
  useIsPresent,
  useMotionValue,
  useReducedMotion,
} from 'motion/react';
import { base } from '@jfrader/tokens';
import { vars } from '@jfrader/tokens/vars';
import { css, type Interpolation, type Theme } from '../../styling/css';
import { focusRingInset } from '../../styling/focus-ring';
import { FORCED_COLORS } from '../../styling/media';
import { WithSx, type SxProps } from '../../styling/sx';
import { isRenderable } from '../../utils/renderable';
import { useControlledState } from '../../utils/use-controlled-state';
import { Menu } from '../menu';

export type SwipeActionsSide = 'leading' | 'trailing';
export type SwipeActionsValue = { id: string; side: SwipeActionsSide } | null;
export interface SwipeAction {
  id: string;
  label: string;
  icon?: ReactNode;
  tone?: 'neutral' | 'accent' | 'danger';
  disabled?: boolean;
  onSelect: () => void;
  /** Caller metadata indicating the row should stay. Commands close the rail but never delete data. */
  keepRow?: boolean;
}
type Slot = { className?: string; css?: Interpolation<Theme> };
interface SwipeActionsBaseProps
  extends Omit<ComponentPropsWithRef<'ul'>, 'value' | 'defaultValue' | 'children'>, SxProps {
  value?: SwipeActionsValue;
  defaultValue?: SwipeActionsValue;
  onValueChange?: (value: SwipeActionsValue) => void;
}
export interface SwipeActionsRecord extends Omit<SwipeActionsRowProps, 'children' | 'content'> {
  /** Render the row's body. */
  content: ReactNode;
}
export interface SwipeActionsCompoundProps extends SwipeActionsBaseProps {
  children?: ReactNode;
  rows?: never;
  slotProps?: never;
}
export interface SwipeActionsEasyProps extends SwipeActionsBaseProps {
  /** Render rows in order using their stable ids. */
  rows: readonly SwipeActionsRecord[];
  children?: never;
  slotProps?: SwipeActionsSlotProps;
}
export interface SwipeActionsSlotProps {
  root?: Omit<ComponentPropsWithRef<'ul'>, 'children' | 'value' | 'defaultValue'> &
    SxProps & {
      css?: Interpolation<Theme>;
      [attribute: `data-${string}`]: unknown;
    };
  row?: Omit<SwipeActionsRowProps, 'id' | 'label' | 'actionsLabel' | 'leading' | 'trailing' | 'children' | 'content'>;
}
export type SwipeActionsProps = SwipeActionsCompoundProps | SwipeActionsEasyProps;
export interface SwipeActionsRowProps extends ComponentPropsWithRef<'li'>, SxProps {
  id: string;
  label: string;
  actionsLabel: string;
  leading?: readonly SwipeAction[];
  trailing?: readonly SwipeAction[];
  fullSwipe?: boolean;
  disabled?: boolean;
  slotProps?: Partial<
    Record<
      | 'content'
      | 'body'
      | 'action'
      | 'actionIcon'
      | 'actionLabel'
      | 'trigger'
      | 'menu'
      | 'menuItem',
      Slot
    >
  >;
}

const SLOP = 8;
const COMMIT_MARGIN = 48;
const COMMIT_RATIO = 0.56;
const FLICK_SPEED = 900;
const PROJECTION_SECONDS = 0.1;
const OVERDRAG_RESISTANCE = 0.2;
const SPRING = {
  type: 'spring',
  stiffness: 420,
  damping: 40,
  mass: 1,
} as const;
const FADE_SECONDS = Number.parseFloat(base.motion.duration.fast) / 1000;
const SLIDE_SECONDS = Number.parseFloat(base.motion.duration.slow) / 1000;
const EMPTY_ACTIONS: readonly SwipeAction[] = [];
const INTERACTIVE =
  'button,a,input,select,textarea,[contenteditable]:not([contenteditable="false"]),[role="button"]';
const listStyle = css({
  label: 'swipe-actions',
  listStyle: 'none',
  padding: 0,
  margin: 0,
  display: 'grid',
  gap: vars.space[2],
  fontFamily: vars.font.sans,
  color: vars.color.text,
  '&:focus': focusRingInset,
});
const rowStyle = css({
  label: 'swipe-actions-row',
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr)',
  position: 'relative',
  overflow: 'hidden',
  minInlineSize: 0,
  border: `1px solid ${vars.color.borderControl}`,
  borderRadius: vars.radius.md,
});
const contentStyle = css({
  gridArea: '1 / 1',
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
  gap: vars.space[2],
  padding: vars.space[4],
  minBlockSize: `calc(${vars.space[8]} * 2)`,
  boxSizing: 'border-box',
  background: vars.color.surface,
  touchAction: 'pan-y',
});
const bodyStyle = css({
  flex: '1 1 0',
  minInlineSize: 0,
  overflowWrap: 'anywhere',
});
const railStyle = css({
  position: 'relative',
  gridArea: '1 / 1',
  display: 'flex',
  maxInlineSize: '100%',
  '&[data-side="leading"]': { justifySelf: 'start' },
  '&[data-side="trailing"]': { justifySelf: 'end' },
});
const actionStyle = css({
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  alignItems: 'center',
  gap: vars.space[1],
  inlineSize: `calc(${vars.space[10]} * 2)`,
  minInlineSize: vars.space[8],
  minBlockSize: vars.space[12],
  padding: vars.space[2],
  boxSizing: 'border-box',
  border: `1px solid ${vars.color.borderControl}`,
  font: 'inherit',
  fontSize: vars.textSize.sm,
  overflowWrap: 'anywhere',
  cursor: 'pointer',
  '&:disabled': { cursor: 'not-allowed' },
  [FORCED_COLORS]: { borderColor: 'ButtonText' },
});
const tones = {
  neutral: css({ background: vars.color.surfaceHover, color: vars.color.text }),
  accent: css({
    background: vars.color.accent,
    color: vars.color.accentContrast,
  }),
  danger: css({
    background: vars.color.danger,
    color: vars.color.dangerContrast,
  }),
};
const iconStyle = css({
  display: 'inline-flex',
  inlineSize: '1em',
  blockSize: '1em',
});
const triggerStyle = css({
  minInlineSize: vars.space[8],
  minBlockSize: vars.space[8],
  flexShrink: 0,
});

function RowElement({
  nativeProps,
  ...props
}: ComponentPropsWithRef<'li'> & { nativeProps: ComponentPropsWithRef<'li'> }) {
  return <li {...nativeProps} {...props} style={{ ...nativeProps.style, ...props.style }} />;
}
const MotionRow = motion.create(RowElement);

type RegisteredRow = {
  element: HTMLLIElement;
  trigger: HTMLButtonElement | null;
  menu: HTMLDivElement | null;
};
type Context = {
  value: SwipeActionsValue;
  request: (value: SwipeActionsValue) => void;
  rows: Map<string, RegisteredRow>;
  list: RefObject<HTMLUListElement | null>;
  ids: readonly string[];
};
const SwipeContext = createContext<Context | null>(null);

function SwipeActionsRoot({ rows: records, slotProps, children, ...props }: SwipeActionsProps) {
  const { css: slotCss, sx: slotSx, ...rootProps } = slotProps?.root ?? {};
  return (
    <SwipeActionsList
      {...props}
      {...rootProps}
      slotCss={[slotCss, slotSx]}
      sx={props.sx}
      className={[props.className, rootProps.className].filter(Boolean).join(' ') || undefined}
      style={{ ...props.style, ...rootProps.style }}
    >
      {records !== undefined
        ? records.map(({ content, ...row }) => (
          <SwipeActionsRow {...slotProps?.row} {...row} key={row.id}>{content}</SwipeActionsRow>
        ))
        : children}
    </SwipeActionsList>
  );
}

function SwipeActionsList({
  ref,
  className,
  sx,
  value: valueProp,
  defaultValue = null,
  onValueChange,
  children,
  onKeyDown,
  slotCss,
  ...props
}: SwipeActionsBaseProps & { children?: ReactNode; slotCss?: Interpolation<Theme> }) {
  const [value = null, change] = useControlledState(valueProp, defaultValue, onValueChange);
  const list = useRef<HTMLUListElement>(null);
  const rows = useRef(new Map<string, RegisteredRow>()).current;
  const mergedRef = useMergeRefs([list, ref]);
  const ids = Children.toArray(children).flatMap((child) =>
    isValidElement<SwipeActionsRowProps>(child) ? [child.props.id] : [],
  );
  const context = useMemo<Context>(
    () => ({
      value,
      rows,
      list,
      ids,
      request: (next) => {
        if (value?.id === next?.id && value?.side === next?.side) return;
        change(next);
      },
    }),
    [value, rows, change, ids.join('\0')],
  );
  useEffect(() => {
    const element = list.current;
    if (!element || !value) return;
    const outside = (event: globalThis.PointerEvent) => {
      const row = rows.get(value.id);
      const target = event.target as Node | null;
      if (target && !row?.element.contains(target) && !row?.menu?.contains(target))
        context.request(null);
    };
    const escape = (event: globalThis.KeyboardEvent) => {
      if (
        event.key !== 'Escape' ||
        event.defaultPrevented ||
        event.isComposing ||
        elementMenuOpen(element)
      )
        return;
      if (
        element.ownerDocument.querySelector(
          '[role="menu"], [role="listbox"], [role="dialog"], dialog[open]',
        )
      )
        return;
      event.preventDefault();
      context.request(null);
    };
    element.ownerDocument.addEventListener('pointerdown', outside);
    element.ownerDocument.addEventListener('keydown', escape);
    return () => {
      element.ownerDocument.removeEventListener('pointerdown', outside);
      element.ownerDocument.removeEventListener('keydown', escape);
    };
  }, [value, rows, context]);
  return (
    <MotionConfig reducedMotion="user">
      <SwipeContext.Provider value={context}>
        <WithSx className={className} styles={[listStyle, slotCss]} sx={sx}>
          {(className) => (
            <ul
              {...props}
              ref={mergedRef}
              className={className}
              data-ui="swipe-actions"
              tabIndex={props.tabIndex ?? -1}
              onKeyDown={(event) => {
                onKeyDown?.(event);
                if (
                  !event.defaultPrevented &&
                  value !== null &&
                  event.key === 'Escape' &&
                  !event.nativeEvent.isComposing &&
                  !(event.target as Element).closest('[role="menu"]') &&
                  !elementMenuOpen(list.current)
                ) {
                  event.stopPropagation();
                  event.preventDefault();
                  context.request(null);
                }
              }}
            >
              <AnimatePresence initial={false}>{children}</AnimatePresence>
            </ul>
          )}
        </WithSx>
      </SwipeContext.Provider>
    </MotionConfig>
  );
}
function elementMenuOpen(list: HTMLUListElement | null) {
  return !!list?.querySelector('[aria-expanded="true"]');
}
SwipeActionsRoot.displayName = 'SwipeActions';

type Drag = {
  pointer: number;
  startX: number;
  startY: number;
  origin: number;
  lastX: number;
  lastTime: number;
  velocity: number;
  locked: boolean;
  vertical: boolean;
  direction: number;
  unlisten: () => void;
};

function SwipeActionsRow({
  id,
  label,
  actionsLabel,
  leading = EMPTY_ACTIONS,
  trailing = EMPTY_ACTIONS,
  fullSwipe = true,
  disabled = false,
  ref,
  className,
  sx,
  children,
  slotProps,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onLostPointerCapture,
  onClickCapture,
  ...props
}: SwipeActionsRowProps) {
  const context = useContext(SwipeContext);
  if (!context) throw new Error('SwipeActions.Row must be rendered inside SwipeActions.');
  const { value, request, rows, list } = context;
  const element = useRef<HTMLLIElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const menuFocus = useRef(false);
  const orderRef = useRef(context.ids);
  const leadingRail = useRef<HTMLDivElement>(null);
  const trailingRail = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const releaseVelocity = useRef(0);
  const swallowClick = useRef(false);
  const swallowTimer = useRef<number | undefined>(undefined);
  const x = useMotionValue(0);
  const reduced = useReducedMotion();
  const present = useIsPresent();
  const [menuOpen, setMenuOpen] = useState(false);
  const [settleVersion, setSettleVersion] = useState(0);
  const mergedRef = useMergeRefs([element, ref]);
  const actions = { leading, trailing };
  const enabled = (side: SwipeActionsSide) =>
    !disabled && actions[side].some((action) => !action.disabled);
  const railWidth = (side: SwipeActionsSide) =>
    Math.min(
      element.current?.getBoundingClientRect().width ?? 0,
      (side === 'leading' ? leadingRail : trailingRail).current?.getBoundingClientRect().width ?? 0,
    );
  const direction = () => (element.current?.matches(':dir(rtl)') ? -1 : 1);
  const accepted = () =>
    value?.id === id && enabled(value.side)
      ? railWidth(value.side) * (value.side === 'leading' ? 1 : -1) * direction()
      : 0;
  const settle = () => {
    const target = accepted();
    const delta = target - x.get();
    const velocity =
      target !== 0 && Math.sign(delta) === Math.sign(releaseVelocity.current)
        ? Math.max(-FLICK_SPEED, Math.min(FLICK_SPEED, releaseVelocity.current))
        : 0;
    releaseVelocity.current = 0;
    if (reduced) {
      x.jump(target);
      return;
    }
    return animate(x, target, { ...SPRING, velocity });
  };
  const latestSettle = useRef(settle);
  latestSettle.current = settle;
  useEffect(() => {
    if (drag.current?.locked) return;
    const animation = settle();
    return () => animation?.stop();
  }, [value, disabled, leading, trailing, reduced, settleVersion]);
  useEffect(() => {
    const node = element.current;
    const Observer = node?.ownerDocument.defaultView?.ResizeObserver;
    if (!node || !Observer) return;
    const observer = new Observer(() => {
      if (!drag.current?.locked) latestSettle.current();
    });
    observer.observe(node);
    if (leadingRail.current) observer.observe(leadingRail.current);
    if (trailingRail.current) observer.observe(trailingRail.current);
    return () => observer.disconnect();
  }, []);
  // Last order that still contained this row, so an exiting row knows its neighbors.
  useLayoutEffect(() => {
    if (context.ids.includes(id)) orderRef.current = context.ids;
  }, [context.ids, id]);
  useLayoutEffect(() => {
    if (!present) return;
    const node = element.current;
    if (!node) return;
    const record = {
      element: node,
      trigger: trigger.current,
      menu: menu.current,
    };
    rows.set(id, record);
    return () => {
      const active = node.ownerDocument.activeElement;
      const focused =
        node.contains(active) ||
        menu.current?.contains(active) ||
        (menuFocus.current && (!active || active === node.ownerDocument.body));
      const order = orderRef.current;
      const index = order.indexOf(id);
      rows.delete(id);
      if (!focused) return;
      node.ownerDocument.defaultView?.queueMicrotask(() => {
        if (rows.has(id) || !list.current?.isConnected) return;
        const next = order
          .slice(index + 1)
          .concat(order.slice(0, index).reverse())
          .map((key) => rows.get(key)?.trigger)
          .find((button) => button?.isConnected && !button.disabled);
        (next ?? list.current)?.focus();
      });
    };
  }, [id, rows, present, list]);
  useEffect(() => {
    const view = element.current?.ownerDocument.defaultView;
    return () => {
      drag.current?.unlisten();
      drag.current = null;
      x.stop();
      if (swallowTimer.current !== undefined) view?.clearTimeout(swallowTimer.current);
    };
  }, [x]);
  const dispatch = (action: SwipeAction) => {
    if (disabled || action.disabled || !present) return;
    request(null);
    setMenuOpen(false);
    // A menu command that removes the row unmounts the menu, dropping its focus to the body
    // before the row exits; remember that focus belonged here. Menu itself restores the trigger
    // when the row stays.
    menuFocus.current = !!menu.current?.contains(menu.current.ownerDocument.activeElement);
    action.onSelect();
    setSettleVersion((version) => version + 1);
  };
  const finish = (pointerId: number, cancel: boolean) => {
    const current = drag.current;
    if (!current || current.pointer !== pointerId) return;
    drag.current = null;
    current.unlisten();
    releaseVelocity.current = cancel ? 0 : current.velocity;
    const node = element.current;
    if (current.locked) {
      swallowClick.current = true;
      const view = node?.ownerDocument.defaultView;
      if (swallowTimer.current !== undefined) view?.clearTimeout(swallowTimer.current);
      swallowTimer.current = view?.setTimeout(() => {
        swallowClick.current = false;
      }, 0);
      const logicalX = x.get() * current.direction;
      const side = logicalX >= 0 ? 'leading' : 'trailing';
      const width = railWidth(side);
      const outwardVelocity = current.velocity * (side === 'leading' ? 1 : -1) * current.direction;
      const threshold = Math.max(
        width + COMMIT_MARGIN,
        (node?.getBoundingClientRect().width ?? 0) * COMMIT_RATIO,
      );
      const distance = Math.abs(logicalX);
      const armed =
        distance >= threshold ||
        (outwardVelocity >= FLICK_SPEED &&
          distance + outwardVelocity * PROJECTION_SECONDS >= threshold);
      if (!cancel && fullSwipe && enabled(side) && armed && outwardVelocity > -FLICK_SPEED) {
        const candidates = actions[side].filter((action) => !action.disabled);
        const action = side === 'leading' ? candidates[0] : candidates.at(-1);
        if (action) dispatch(action);
      } else if (!cancel) request(enabled(side) && distance >= width / 2 ? { id, side } : null);
      if (node?.hasPointerCapture(pointerId)) node.releasePointerCapture(pointerId);
    }
    setSettleVersion((version) => version + 1);
  };
  const openSide = value?.id === id && enabled(value.side) ? value.side : undefined;
  const renderLabel = (action: SwipeAction) => (
    <>
      {isRenderable(action.icon) && action.icon !== '' && (
        <span
          aria-hidden
          data-ui="swipe-actions-action-icon"
          className={slotProps?.actionIcon?.className}
          css={[iconStyle, slotProps?.actionIcon?.css]}
        >
          {action.icon}
        </span>
      )}
      <span
        data-ui="swipe-actions-action-label"
        className={slotProps?.actionLabel?.className}
        css={slotProps?.actionLabel?.css}
      >
        {action.label}
      </span>
    </>
  );
  return (
    <WithSx className={className} styles={rowStyle} sx={sx}>
      {(className) => (
        <MotionRow
          nativeProps={props}
          id={id}
          ref={mergedRef}
          className={className}
          data-ui="swipe-actions-row"
          data-state={openSide ?? 'closed'}
          inert={!present || props.inert || undefined}
          initial={reduced ? false : { height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={reduced ? undefined : { height: 0, opacity: 0, minHeight: 0 }}
          transition={{
            duration: reduced ? 0 : SLIDE_SECONDS,
            opacity: { duration: reduced ? 0 : FADE_SECONDS },
          }}
          onPointerDown={(event) => {
            onPointerDown?.(event);
            if (
              event.defaultPrevented ||
              disabled ||
              !present ||
              drag.current ||
              !event.isPrimary ||
              event.button !== 0 ||
              (event.target as Element).closest(INTERACTIVE)
            )
              return;
            const node = event.currentTarget;
            const doc = node.ownerDocument;
            if (event.pointerType === 'mouse') event.preventDefault();
            // Capture starts only after the horizontal lock, so a release or cancel outside the row
            // before then never reaches it; abandon the gesture there.
            const endOutside = (outside: globalThis.PointerEvent) => {
              if (!node.contains(outside.target as Node)) finish(outside.pointerId, true);
            };
            doc.addEventListener('pointerup', endOutside, true);
            doc.addEventListener('pointercancel', endOutside, true);
            drag.current = {
              pointer: event.pointerId,
              startX: event.clientX,
              startY: event.clientY,
              origin: x.get(),
              lastX: event.clientX,
              lastTime: event.timeStamp,
              velocity: 0,
              locked: false,
              vertical: false,
              direction: direction(),
              unlisten: () => {
                doc.removeEventListener('pointerup', endOutside, true);
                doc.removeEventListener('pointercancel', endOutside, true);
              },
            };
          }}
          onPointerMove={(event) => {
            onPointerMove?.(event);
            const current = drag.current;
            if (!current || current.pointer !== event.pointerId || current.vertical) return;
            const dx = event.clientX - current.startX;
            const dy = event.clientY - current.startY;
            if (!current.locked) {
              if (Math.max(Math.abs(dx), Math.abs(dy)) < SLOP) return;
              if (Math.abs(dy) >= Math.abs(dx)) {
                current.vertical = true;
                return;
              }
              current.locked = true;
              x.stop();
              setMenuOpen(false);
              event.currentTarget.setPointerCapture(event.pointerId);
            }
            event.preventDefault();
            const elapsed = event.timeStamp - current.lastTime;
            if (elapsed > 0) current.velocity = ((event.clientX - current.lastX) / elapsed) * 1000;
            current.lastX = event.clientX;
            current.lastTime = event.timeStamp;
            const next = current.origin + dx;
            const side = next * current.direction >= 0 ? 'leading' : 'trailing';
            const rowWidth = element.current?.getBoundingClientRect().width ?? 0;
            const stop = fullSwipe
              ? Math.max(railWidth(side) + COMMIT_MARGIN, rowWidth * COMMIT_RATIO)
              : railWidth(side);
            const distance = Math.abs(next);
            const resisted =
              distance > stop ? stop + (distance - stop) * OVERDRAG_RESISTANCE : distance;
            x.set(enabled(side) ? Math.sign(next) * Math.min(resisted, rowWidth) : 0);
          }}
          onPointerUp={(event) => {
            onPointerUp?.(event);
            finish(event.pointerId, false);
          }}
          onPointerCancel={(event) => {
            onPointerCancel?.(event);
            finish(event.pointerId, true);
          }}
          onLostPointerCapture={(event) => {
            onLostPointerCapture?.(event);
            // Touch implicitly captures to the pressed descendant; taking capture on the row makes
            // that descendant's lostpointercapture bubble here. Only the row losing its own capture
            // ends the gesture.
            if (event.target === event.currentTarget) finish(event.pointerId, true);
          }}
          onClickCapture={(event) => {
            onClickCapture?.(event);
            if (swallowClick.current) {
              swallowClick.current = false;
              event.preventDefault();
              event.stopPropagation();
            }
          }}
        >
          {(['leading', 'trailing'] as const).map(
            (side) =>
              actions[side].length > 0 && (
                <div
                  key={side}
                  ref={side === 'leading' ? leadingRail : trailingRail}
                  data-side={side}
                  data-ui="swipe-actions-rail"
                  css={railStyle}
                  aria-hidden
                >
                  {actions[side].map((action) => (
                    <button
                      key={action.id}
                      type="button"
                      tabIndex={-1}
                      disabled={disabled || action.disabled || openSide !== side || !present}
                      data-ui="swipe-actions-action"
                      className={slotProps?.action?.className}
                      css={[actionStyle, tones[action.tone ?? 'neutral'], slotProps?.action?.css]}
                      onPointerDown={(event) => event.preventDefault()}
                      onClick={() => dispatch(action)}
                    >
                      {renderLabel(action)}
                    </button>
                  ))}
                </div>
              ),
          )}
          <motion.div
            data-ui="swipe-actions-content"
            className={slotProps?.content?.className}
            css={[contentStyle, slotProps?.content?.css]}
            style={{ x }}
          >
            <div
              data-ui="swipe-actions-body"
              className={slotProps?.body?.className}
              css={[bodyStyle, slotProps?.body?.css]}
            >
              {children}
            </div>
            <Menu
              open={menuOpen && present}
              onOpenChange={(open) => {
                if (open) request(null);
                setMenuOpen(open);
              }}
            >
              <Menu.Trigger
                ref={trigger}
                disabled={disabled || (!leading.length && !trailing.length)}
                aria-label={actionsLabel}
                title={label}
                className={slotProps?.trigger?.className}
                css={[triggerStyle, slotProps?.trigger?.css]}
              >
                ⋯
              </Menu.Trigger>
              <Menu.Content
                ref={(node) => {
                  menu.current = node;
                  const row = rows.get(id);
                  if (row) row.menu = node;
                }}
                className={slotProps?.menu?.className}
                css={slotProps?.menu?.css}
              >
                {[...leading, ...trailing].map((action) => (
                  <Menu.Item
                    key={action.id}
                    disabled={disabled || action.disabled}
                    className={slotProps?.menuItem?.className}
                    css={slotProps?.menuItem?.css}
                    onSelect={() => dispatch(action)}
                  >
                    {renderLabel(action)}
                  </Menu.Item>
                ))}
              </Menu.Content>
            </Menu>
          </motion.div>
        </MotionRow>
      )}
    </WithSx>
  );
}
SwipeActionsRow.displayName = 'SwipeActions.Row';
export const SwipeActions = Object.assign(SwipeActionsRoot, {
  Row: SwipeActionsRow,
});
