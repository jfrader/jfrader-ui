'use client';

import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ComponentPropsWithRef,
  type ReactNode,
  type KeyboardEvent,
  type PointerEvent,
  type RefObject,
} from 'react';
import { useMergeRefs } from '@floating-ui/react';
import {
  MotionConfig,
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from 'motion/react';
import { base } from '@jfrader/tokens';
import { vars } from '@jfrader/tokens/vars';
import { css, type Interpolation, type Theme } from '../../styling/css';
import { focusRingOutset } from '../../styling/focus-ring';
import { FORCED_COLORS, REDUCED_MOTION } from '../../styling/media';
import { visuallyHiddenStyle } from '../../styling/visually-hidden';
import { WithSx, type SxProps } from '../../styling/sx';
import { isRenderable } from '../../utils/renderable';
import { useControlledState } from '../../utils/use-controlled-state';
import { Button } from '../button';
import { Card } from '../card';

export type CardDecision = 'left' | 'right';
export interface CardStackDecision {
  key: string;
  decision: CardDecision;
}
export type CardStackEvent<T> =
  | { type: 'decide'; item: T; key: string; decision: CardDecision }
  | { type: 'undo'; key: string; item: T | undefined; decision: CardDecision }
  | { type: 'reset' };
export interface CardStackLabels {
  left: string;
  right: string;
  undo: string;
  reset: string;
  empty: string;
  completed: string;
  cardStackRole: string;
  hint: (left: string, right: string) => string;
  position: (index: number, count: number) => string;
  decided: (name: string, outcome: string, remaining: number) => string;
  restored: (name: string) => string;
  resetComplete: (count: number) => string;
}
export interface CardStackGestureOptions {
  distanceRatio?: number;
  maxDistance?: number;
  minFlickDistance?: number;
  flickVelocity?: number;
  axisSlop?: number;
}
type Slot = Omit<
  ComponentPropsWithRef<'div'>,
  'children' | 'ref' | 'role' | 'tabIndex' | 'inert'
> & { css?: Interpolation<Theme> };
type ButtonSlot = Omit<
  ComponentPropsWithRef<'button'>,
  'children' | 'ref' | 'type' | 'disabled' | 'aria-disabled'
> & { css?: Interpolation<Theme> };
export interface CardStackSlotProps {
  stage?: Slot & Pick<ComponentPropsWithRef<'div'>, 'ref'>;
  card?: Slot;
  content?: Slot;
  leftStamp?: Slot;
  rightStamp?: Slot;
  controls?: Slot;
  leftButton?: ButtonSlot;
  undoButton?: ButtonSlot;
  rightButton?: ButtonSlot;
  resetButton?: ButtonSlot;
  empty?: Slot;
  hint?: Slot;
  status?: Slot;
}
export interface CardStackProps<T>
  extends Omit<ComponentPropsWithRef<'div'>, 'defaultValue' | 'onChange' | 'children'>, SxProps {
  items: readonly T[];
  getKey: (item: T) => string;
  getLabel: (item: T) => string;
  renderCard: (item: T) => ReactNode;
  value?: readonly CardStackDecision[];
  defaultValue?: readonly CardStackDecision[];
  onValueChange?: (history: CardStackDecision[], event: CardStackEvent<T>) => void;
  onDecide?: (item: T, decision: CardDecision) => void;
  onUndo?: (detail: { key: string; item: T | undefined; decision: CardDecision }) => void;
  onReset?: () => void;
  labels?: Partial<CardStackLabels>;
  outcomes?: { left: string; right: string };
  locale?: Intl.LocalesArgument;
  label?: string;
  renderEmpty?: (context: { reset: () => void; completed: boolean }) => ReactNode;
  disabled?: boolean;
  visibleCount?: number;
  gesture?: CardStackGestureOptions;
  size?: 'sm' | 'md';
  icons?: {
    left?: ReactNode;
    right?: ReactNode;
    undo?: ReactNode;
    reset?: ReactNode;
  };
  slotProps?: CardStackSlotProps;
}

declare const process: { env: { NODE_ENV?: string } };
const EMPTY_HISTORY: readonly CardStackDecision[] = [];
const DEFAULT_GESTURE = {
  distanceRatio: 0.35,
  maxDistance: 140,
  minFlickDistance: 12,
  flickVelocity: 500,
  axisSlop: 6,
};
const STACK_SPRING = {
  type: 'spring',
  stiffness: 260,
  damping: 30,
  mass: 1,
} as const;
const GEOMETRY = {
  stageWidth: '20rem',
  height: '19rem',
  narrowHeight: '17.5rem',
  tilt: 14,
  tiltDistance: 200,
  scaleStep: 0.025,
  peek: Number.parseFloat(base.space[3]),
  maxWindow: 8,
  defaultWindow: 4,
};
const INTERACTIVE =
  'a[href],button,input,select,textarea,label,summary,[contenteditable]:not([contenteditable="false"]),[tabindex],[role]';
const rootStyle = css({
  label: 'card-stack',
  display: 'grid',
  gap: vars.space[4],
  minInlineSize: 0,
  inlineSize: GEOMETRY.stageWidth,
  maxInlineSize: '100%',
  fontFamily: vars.font.sans,
  color: vars.color.text,
  lineHeight: vars.lineHeight.base,
  containerType: 'inline-size',
});
const stageStyle = css({
  position: 'relative',
  blockSize: `calc(${GEOMETRY.height} + var(--card-stack-peek))`,
  minInlineSize: 0,
  touchAction: 'pan-y',
  borderRadius: vars.radius.lg,
  '&:focus-visible': focusRingOutset,
  '@container (max-width: 18rem)': {
    blockSize: `calc(${GEOMETRY.narrowHeight} + var(--card-stack-peek))`,
  },
});
const layerStyle = css({
  position: 'absolute',
  insetInline: 0,
  insetBlockStart: 0,
  blockSize: 'calc(100% - var(--card-stack-peek))',
  minInlineSize: 0,
  [REDUCED_MOTION]: { transform: 'none !important' },
});
const cardStyle = css({
  boxSizing: 'border-box',
  blockSize: '100%',
  display: 'flex',
  flexDirection: 'column',
  border: `1px solid ${vars.color.borderControl}`,
  background: vars.color.surfaceRaised,
  boxShadow: vars.shadow.raised,
  [FORCED_COLORS]: { boxShadow: 'none', borderColor: 'CanvasText' },
});
const paddingStyles = {
  sm: css({ padding: vars.space[3] }),
  md: css({ padding: vars.space[5] }),
};
const contentStyle = css({
  overflow: 'auto',
  minBlockSize: 0,
  flex: '1 1 auto',
  overflowWrap: 'anywhere',
});
const controlsStyle = css({
  display: 'flex',
  flexWrap: 'wrap',
  gap: vars.space[2],
  alignItems: 'center',
  justifyContent: 'center',
});
const actionStyle = css({
  minInlineSize: vars.space[8],
  minBlockSize: vars.space[8],
  blockSize: 'auto',
  paddingBlock: vars.space[2],
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
  maxInlineSize: '100%',
});
const undoStyle = css({
  '@container (max-width: 18rem)': {
    '&[data-has-icon] > [data-ui="card-stack-action-text"]': {
      position: 'absolute',
      inlineSize: 1,
      blockSize: 1,
      overflow: 'hidden',
      clipPath: 'inset(50%)',
      whiteSpace: 'nowrap',
    },
  },
});
const hiddenStyle = visuallyHiddenStyle;
const stampStyle = css({
  position: 'absolute',
  insetBlockStart: vars.space[4],
  padding: vars.space[2],
  border: `2px solid ${vars.color.borderControl}`,
  borderRadius: vars.radius.md,
  color: vars.color.accentText,
  background: vars.color.surface,
  pointerEvents: 'none',
  maxInlineSize: `calc(100% - ${vars.space[8]})`,
  overflowWrap: 'anywhere',
  [FORCED_COLORS]: { color: 'CanvasText', borderColor: 'CanvasText' },
});
const stampSides = {
  left: css({ left: vars.space[4] }),
  right: css({ right: vars.space[4] }),
};
const emptyStyle = css({
  boxSizing: 'border-box',
  display: 'grid',
  alignContent: 'center',
  justifyItems: 'center',
  gap: vars.space[4],
  blockSize: '100%',
  border: `1px solid ${vars.color.borderControl}`,
  borderRadius: vars.radius.lg,
  padding: vars.space[5],
  textAlign: 'center',
  background: vars.color.surface,
});

function normalize(history: readonly CardStackDecision[]) {
  const seen = new Set<string>();
  return history.filter((entry) => {
    if (
      typeof entry.key !== 'string' ||
      !['left', 'right'].includes(entry.decision) ||
      seen.has(entry.key)
    )
      return false;
    seen.add(entry.key);
    return true;
  });
}
function equal(a: readonly CardStackDecision[], b: readonly CardStackDecision[]) {
  return (
    a.length === b.length &&
    a.every((entry, index) => entry.key === b[index]?.key && entry.decision === b[index]?.decision)
  );
}
const ids = (...values: (string | undefined)[]) => values.filter(Boolean).join(' ') || undefined;
function dictionary(locale: Intl.LocalesArgument | undefined): CardStackLabels {
  const numbers = new Intl.NumberFormat(locale);
  const plurals = new Intl.PluralRules(locale);
  const count = (n: number) =>
    `${numbers.format(n)} ${plurals.select(n) === 'one' ? 'card' : 'cards'}`;
  return {
    left: 'Pass',
    right: 'Keep',
    undo: 'Undo',
    reset: 'Reset',
    empty: 'No cards',
    completed: 'All cards reviewed',
    cardStackRole: 'card stack',
    hint: (left, right) =>
      `Left arrow: ${left}. Right arrow: ${right}. Backspace, Control+Z or Command+Z: Undo.`,
    position: (index, total) => `Card ${numbers.format(index + 1)} of ${numbers.format(total)}`,
    decided: (name, outcome, remaining) => `${name}: ${outcome}. ${count(remaining)} remaining.`,
    restored: (name) => `${name} restored.`,
    resetComplete: (n) => `${count(n)} reset.`,
  };
}
type Drag = {
  pointer: number;
  startX: number;
  startY: number;
  lastX: number;
  lastTime: number;
  velocity: number;
  distance: number;
  locked: boolean;
  node: HTMLDivElement;
  unlisten: () => void;
};
type Exit<T> = {
  key: string;
  item: T;
  from: number;
  target: number;
  velocity: number;
};

function NativeDiv({
  nativeProps,
  ...props
}: ComponentPropsWithRef<'div'> & {
  nativeProps: ComponentPropsWithRef<'div'>;
}) {
  return <div {...nativeProps} {...props} style={{ ...nativeProps.style, ...props.style }} />;
}
const MotionDiv = motion.create(NativeDiv);

function Layer<T>({
  item,
  index,
  active,
  outgoing,
  returning,
  returnVelocity,
  reduced,
  dragX,
  size,
  label,
  renderCard,
  slots,
  labels,
  stage,
  onComplete,
}: {
  item: T;
  index: number;
  active: boolean;
  outgoing?: Exit<T>;
  returning?: number;
  returnVelocity?: number;
  reduced: boolean;
  dragX: ReturnType<typeof useMotionValue<number>>;
  size: 'sm' | 'md';
  label: string;
  renderCard: (item: T) => ReactNode;
  slots: CardStackSlotProps;
  labels: CardStackLabels;
  stage: RefObject<HTMLDivElement | null>;
  onComplete: () => void;
}) {
  const element = useRef<HTMLDivElement>(null);
  const ownX = useMotionValue(outgoing?.from ?? returning ?? 0);
  const y = useMotionValue(reduced ? 0 : index * GEOMETRY.peek);
  const scale = useMotionValue(reduced ? 1 : 1 - index * GEOMETRY.scaleStep);
  const x = active && returning === undefined ? dragX : ownX;
  const rotate = useTransform(x, (value) =>
    reduced
      ? 0
      : Math.max(
          -GEOMETRY.tilt,
          Math.min(GEOMETRY.tilt, (value / GEOMETRY.tiltDistance) * GEOMETRY.tilt),
        ),
  );
  const leftOpacity = useTransform(x, (value) =>
    Math.min(1, Math.max(0, -value / DEFAULT_GESTURE.maxDistance)),
  );
  const rightOpacity = useTransform(x, (value) =>
    Math.min(1, Math.max(0, value / DEFAULT_GESTURE.maxDistance)),
  );
  useLayoutEffect(() => {
    y.stop();
    scale.stop();
    if (reduced) {
      y.jump(0);
      scale.jump(1);
      return;
    }
    const lift = animate(y, index * GEOMETRY.peek, STACK_SPRING);
    const resize = animate(scale, 1 - index * GEOMETRY.scaleStep, STACK_SPRING);
    return () => {
      lift.stop();
      resize.stop();
    };
  }, [index, reduced]);
  useLayoutEffect(() => {
    if (!outgoing && returning === undefined) return;
    if (reduced) {
      ownX.jump(0);
      onComplete();
      return;
    }
    ownX.jump(outgoing?.from ?? returning ?? 0);
    const control = animate(ownX, outgoing?.target ?? 0, {
      ...STACK_SPRING,
      velocity: outgoing?.velocity ?? returnVelocity ?? 0,
    });
    void control.then(onComplete);
    return () => control.stop();
  }, [outgoing, returning, returnVelocity, reduced]);
  const nameId = useId();
  const slot = slots.card;
  useLayoutEffect(() => {
    const node = element.current;
    return () => {
      if (active && node?.contains(node.ownerDocument.activeElement) && stage.current?.isConnected)
        stage.current.focus({ preventScroll: true });
    };
  }, [active]);
  return (
    <motion.div
      ref={element}
      data-ui="card-stack-card"
      data-state={outgoing ? 'outgoing' : active ? 'active' : 'inactive'}
      inert={!active}
      aria-hidden={!active || undefined}
      css={layerStyle}
      style={{
        x,
        y,
        scale,
        rotate,
        zIndex: outgoing ? GEOMETRY.maxWindow + 1 : GEOMETRY.maxWindow - index,
      }}
    >
      <Card
        {...slot}
        css={[cardStyle, paddingStyles[size], slot?.css]}
        role={active ? 'group' : undefined}
        aria-label={slot?.['aria-label']}
        aria-labelledby={ids(slot?.['aria-labelledby'], nameId)}
      >
        <span id={nameId} css={hiddenStyle}>
          {label}
        </span>
        <div
          {...slots.content}
          css={[contentStyle, slots.content?.css]}
          data-ui="card-stack-content"
        >
          {renderCard(item)}
        </div>
        {active &&
          (['left', 'right'] as const).map((side) => (
            <MotionDiv
              key={side}
              nativeProps={side === 'left' ? (slots.leftStamp ?? {}) : (slots.rightStamp ?? {})}
              aria-hidden
              className={(side === 'left' ? slots.leftStamp : slots.rightStamp)?.className}
              data-ui={`card-stack-${side}-stamp`}
              css={[
                stampStyle,
                stampSides[side],
                (side === 'left' ? slots.leftStamp : slots.rightStamp)?.css,
              ]}
              style={{ opacity: side === 'left' ? leftOpacity : rightOpacity }}
            >
              {labels[side]}
            </MotionDiv>
          ))}
      </Card>
    </motion.div>
  );
}

export function CardStack<T>({
  ref,
  className,
  sx,
  items,
  getKey,
  getLabel,
  renderCard,
  value,
  defaultValue = EMPTY_HISTORY,
  onValueChange,
  onDecide,
  onUndo,
  onReset,
  labels: customLabels,
  outcomes = { left: 'Passed', right: 'Kept' },
  locale,
  label = 'Cards',
  renderEmpty,
  disabled = false,
  visibleCount = GEOMETRY.defaultWindow,
  gesture,
  size = 'md',
  icons,
  slotProps = {},
  ...props
}: CardStackProps<T>) {
  const [rawHistory, change] = useControlledState<readonly CardStackDecision[]>(
    value,
    defaultValue,
  );
  const history = normalize(rawHistory ?? EMPTY_HISTORY);
  const entries = items.map((item) => ({ key: getKey(item), item }));
  const byKey = new Map<string, { key: string; item: T }>();
  for (const entry of entries) if (!byKey.has(entry.key)) byKey.set(entry.key, entry);
  const unique = [...byKey.values()];
  const decidedKeys = new Set(history.map((entry) => entry.key));
  const remaining = unique.filter((entry) => !decidedKeys.has(entry.key));
  const active = remaining[0];
  const windowSize = Number.isInteger(visibleCount)
    ? Math.min(GEOMETRY.maxWindow, Math.max(1, visibleCount))
    : GEOMETRY.defaultWindow;
  const options = { ...DEFAULT_GESTURE };
  for (const key of Object.keys(DEFAULT_GESTURE) as (keyof typeof DEFAULT_GESTURE)[]) {
    const candidate = gesture?.[key];
    if (candidate !== undefined && Number.isFinite(candidate) && candidate >= 0)
      options[key] = candidate;
  }
  const defaults = useMemo(() => dictionary(locale), [locale]);
  const labels = { ...defaults, ...customLabels };
  const stage = useRef<HTMLDivElement>(null);
  const stageRef = useMergeRefs([stage, slotProps.stage?.ref]);
  const drag = useRef<Drag | null>(null);
  const x = useMotionValue(0);
  const motionReduced = useReducedMotion();
  const [mediaReduced, setMediaReduced] = useState<boolean | null>(null);
  const reduced = mediaReduced ?? motionReduced === true;
  const [pending, setPending] = useState<{
    history: CardStackDecision[];
    event: CardStackEvent<T>;
    exit?: Exit<T>;
  } | null>(null);
  const pendingRef = useRef(false);
  const [outgoing, setOutgoing] = useState<Exit<T> | undefined>();
  const [returning, setReturning] = useState<
    { key: string; from: number; velocity: number } | undefined
  >();
  const exits = useRef(new Map<string, { target: number; velocity: number }>());
  const [status, setStatus] = useState('');
  const [homing, setHoming] = useState(false);
  const id = useId();
  const focus = useRef<Element | null>(null);
  const busy = pending !== null || outgoing !== undefined || returning !== undefined || homing;
  const completed = unique.length > 0 && remaining.length === 0;
  const settle = useRef<ReturnType<typeof animate> | undefined>(undefined);
  const home = () => {
    settle.current?.stop();
    if (reduced || x.get() === 0) {
      x.jump(0);
      setHoming(false);
      return;
    }
    setHoming(true);
    const control = animate(x, 0, STACK_SPRING);
    settle.current = control;
    void control.then(() => setHoming(false));
  };

  useEffect(() => {
    const query = stage.current?.ownerDocument.defaultView?.matchMedia(
      '(prefers-reduced-motion: reduce)',
    );
    if (!query) return;
    const update = () => setMediaReduced(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    if (unique.length !== entries.length)
      console.warn('CardStack: item keys must be unique; using the first occurrence.');
    if (history.length !== (rawHistory?.length ?? 0))
      console.warn('CardStack: invalid or duplicate history entries were ignored.');
    if (visibleCount !== windowSize)
      console.warn('CardStack: visibleCount must be an integer from 1 to 8.');
    for (const key of Object.keys(DEFAULT_GESTURE) as (keyof typeof DEFAULT_GESTURE)[]) {
      const n = gesture?.[key];
      if (n !== undefined && (!Number.isFinite(n) || n < 0))
        console.warn(
          `CardStack: gesture.${key} must be finite and nonnegative; using the default.`,
        );
    }
  }, [items, rawHistory, visibleCount, gesture]);
  const request = (next: CardStackDecision[], event: CardStackEvent<T>, exit?: Exit<T>) => {
    if (disabled || busy || pendingRef.current || equal(next, history)) return false;
    pendingRef.current = true;
    setPending({ history: next, event, exit });
    change(next);
    onValueChange?.(next, event);
    if (event.type === 'decide') onDecide?.(event.item, event.decision);
    if (event.type === 'undo')
      onUndo?.({ key: event.key, item: event.item, decision: event.decision });
    if (event.type === 'reset') onReset?.();
    return true;
  };
  const decide = (decision: CardDecision, velocity = 0) => {
    if (!active) return false;
    const width = stage.current?.getBoundingClientRect().width ?? 0;
    const target = (width * 2 + GEOMETRY.peek) * (decision === 'left' ? -1 : 1);
    return request(
      [...history, { key: active.key, decision }],
      { type: 'decide', ...active, decision },
      { ...active, from: x.get(), target, velocity },
    );
  };
  const undo = () => {
    const last = history.at(-1);
    if (!last) return false;
    return request(history.slice(0, -1), {
      type: 'undo',
      ...last,
      item: unique.find((entry) => entry.key === last.key)?.item,
    });
  };
  const reset = () => {
    request([], { type: 'reset' });
  };

  useLayoutEffect(() => {
    if (!pending) return;
    const accepted = equal(history, pending.history);
    if (accepted) {
      const event = pending.event;
      const focused = stage.current?.ownerDocument.activeElement;
      if (event.type === 'decide') {
        if (
          focused?.closest('[data-ui="card-stack-card"][data-state="inactive"]') ||
          (focus.current &&
            !focus.current.isConnected &&
            focused === stage.current?.ownerDocument.body)
        )
          stage.current?.focus({ preventScroll: true });
        if (pending.exit) {
          exits.current.set(pending.exit.key, {
            target: pending.exit.target,
            velocity: pending.exit.velocity,
          });
          if (!reduced) setOutgoing(pending.exit);
        }
        setStatus(
          `${labels.decided(getLabel(event.item), outcomes[event.decision], remaining.length)}${remaining.length === 0 ? ` ${labels.completed}` : ''}`,
        );
      }
      if (event.type === 'undo') {
        const item = unique.find((entry) => entry.key === event.key);
        if (item) setStatus(labels.restored(getLabel(item.item)));
        else setStatus(labels.restored(event.key));
        if (!reduced && active?.key === event.key)
          setReturning({
            key: event.key,
            from:
              exits.current.get(event.key)?.target ??
              (stage.current?.getBoundingClientRect().width ?? 0) *
                2 *
                (event.decision === 'left' ? -1 : 1),
            velocity: -(exits.current.get(event.key)?.velocity ?? 0),
          });
      }
      if (event.type === 'reset') {
        exits.current.clear();
        setStatus(labels.resetComplete(unique.length));
      }
      x.jump(0);
      pendingRef.current = false;
      setPending(null);
    } else {
      settle.current?.stop();
      if (reduced || x.get() === 0) {
        x.jump(0);
        pendingRef.current = false;
        setPending(null);
      } else {
        const control = animate(x, 0, STACK_SPRING);
        settle.current = control;
        void control.then(() => {
          pendingRef.current = false;
          setPending(null);
        });
      }
    }
  }, [pending, rawHistory, reduced]);

  const finish = (pointer: number, cancel: boolean) => {
    const session = drag.current;
    if (!session || session.pointer !== pointer) return;
    drag.current = null;
    session.unlisten();
    if (session.node.hasPointerCapture(pointer)) session.node.releasePointerCapture(pointer);
    const distance = Math.abs(session.distance);
    const outward = session.velocity * Math.sign(session.distance);
    const armed =
      distance >=
        Math.min(
          options.maxDistance,
          session.node.getBoundingClientRect().width * options.distanceRatio,
        ) ||
      (distance >= options.minFlickDistance && outward >= options.flickVelocity);
    if (
      cancel ||
      !session.locked ||
      !armed ||
      !decide(session.distance < 0 ? 'left' : 'right', session.velocity)
    )
      home();
  };
  const down = (event: PointerEvent<HTMLDivElement>) => {
    if (
      event.defaultPrevented ||
      disabled ||
      busy ||
      !active ||
      pendingRef.current ||
      drag.current ||
      !event.isPrimary ||
      event.button !== 0
    )
      return;
    const interactive = (event.target as Element).closest(INTERACTIVE);
    if (
      interactive &&
      interactive !== event.currentTarget &&
      !interactive.matches('[data-ui="card-stack-card"], [data-ui="card"]')
    )
      return;
    const node = event.currentTarget;
    const doc = node.ownerDocument;
    if (event.pointerType === 'mouse') event.preventDefault();
    const outside = (e: globalThis.PointerEvent) => {
      if (!node.contains(e.target as Node)) finish(e.pointerId, true);
    };
    doc.addEventListener('pointerup', outside, true);
    doc.addEventListener('pointercancel', outside, true);
    drag.current = {
      pointer: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastTime: event.timeStamp,
      velocity: 0,
      distance: 0,
      locked: false,
      node,
      unlisten: () => {
        doc.removeEventListener('pointerup', outside, true);
        doc.removeEventListener('pointercancel', outside, true);
      },
    };
  };
  const move = (event: PointerEvent<HTMLDivElement>) => {
    const session = drag.current;
    if (!session || session.pointer !== event.pointerId || event.defaultPrevented) return;
    const dx = event.clientX - session.startX;
    const dy = event.clientY - session.startY;
    if (!session.locked) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) < options.axisSlop) return;
      if (Math.abs(dy) >= Math.abs(dx)) {
        finish(event.pointerId, true);
        return;
      }
      session.locked = true;
      settle.current?.stop();
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    event.preventDefault();
    const elapsed = event.timeStamp - session.lastTime;
    if (elapsed > 0) session.velocity = ((event.clientX - session.lastX) / elapsed) * 1000;
    session.lastX = event.clientX;
    session.lastTime = event.timeStamp;
    session.distance = dx;
    x.set(reduced ? 0 : dx);
  };
  useLayoutEffect(() => {
    const focused = stage.current?.ownerDocument.activeElement;
    const last = focus.current;
    if (
      last &&
      (!last.isConnected || last.closest('[inert]')) &&
      (focused === stage.current?.ownerDocument.body || focused === last)
    )
      stage.current?.focus({ preventScroll: true });
    if (drag.current) finish(drag.current.pointer, true);
    x.jump(0);
    setHoming(false);
    if (reduced) {
      settle.current?.stop();
      setOutgoing(undefined);
      setReturning(undefined);
    }
  }, [active?.key, disabled, reduced]);
  useLayoutEffect(() => {
    if (outgoing && !history.some((entry) => entry.key === outgoing.key)) setOutgoing(undefined);
    if (returning && active?.key !== returning.key) setReturning(undefined);
  }, [rawHistory, active?.key]);
  useEffect(() => {
    const node = stage.current;
    const Observer = node?.ownerDocument.defaultView?.ResizeObserver;
    if (!node || !Observer) return;
    const observer = new Observer(() => {
      if (drag.current) finish(drag.current.pointer, true);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  useEffect(
    () => () => {
      const session = drag.current;
      drag.current = null;
      session?.unlisten();
      if (session?.node.hasPointerCapture(session.pointer))
        session.node.releasePointerCapture(session.pointer);
      settle.current?.stop();
      x.stop();
    },
    [],
  );
  const keyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (
      event.defaultPrevented ||
      event.target !== event.currentTarget ||
      event.repeat ||
      event.nativeEvent.isComposing ||
      event.altKey ||
      event.shiftKey ||
      disabled ||
      busy ||
      pendingRef.current
    )
      return;
    const modifier = event.ctrlKey || event.metaKey;
    if ((event.key === 'ArrowLeft' || event.key === 'ArrowRight') && !modifier && active) {
      event.preventDefault();
      decide(event.key === 'ArrowLeft' ? 'left' : 'right');
    }
    if (
      ((event.key === 'Backspace' && !modifier) || (event.key.toLowerCase() === 'z' && modifier)) &&
      history.length > 0
    ) {
      event.preventDefault();
      undo();
    }
  };
  const action = (kind: 'left' | 'undo' | 'right' | 'reset', empty = false) => {
    const slot = slotProps[`${kind}Button`];
    const blocked =
      disabled || busy || (kind === 'left' || kind === 'right' ? !active : history.length === 0);
    const icon = icons?.[kind];
    const handler = {
      left: () => decide('left'),
      right: () => decide('right'),
      undo,
      reset,
    }[kind];
    return (
      <Button
        {...slot}
        key={kind}
        type="button"
        variant="outline"
        size={size}
        startIcon={isRenderable(icon) && icon !== '' ? icon : undefined}
        data-has-icon={(isRenderable(icon) && icon !== '') || undefined}
        data-ui={empty ? 'card-stack-empty-reset' : `card-stack-${kind}-button`}
        render={(buttonProps) => <button {...buttonProps} />}
        css={[actionStyle, kind === 'undo' && undoStyle, slot?.css]}
        aria-disabled={blocked || undefined}
        onClick={(event) => {
          slot?.onClick?.(event);
          if (!event.defaultPrevented && !blocked) handler();
        }}
      >
        <span data-ui="card-stack-action-text">{labels[kind]}</span>
      </Button>
    );
  };
  const stageSlot = slotProps.stage;
  return (
    <MotionConfig reducedMotion="user">
      <WithSx className={className} styles={rootStyle} sx={sx}>
        {(rootClass) => (
          <div
            {...props}
            ref={ref}
            className={rootClass}
            data-ui="card-stack"
            data-state={
              disabled ? 'disabled' : completed ? 'completed' : active ? 'active' : 'empty'
            }
            onFocusCapture={(event) => {
              props.onFocusCapture?.(event);
              focus.current = event.target;
            }}
            onBlurCapture={(event) => {
              props.onBlurCapture?.(event);
              if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget))
                focus.current = null;
            }}
          >
            <div
              {...stageSlot}
              ref={stageRef}
              css={[stageStyle, stageSlot?.css]}
              style={
                {
                  '--card-stack-peek': `${reduced ? 0 : (windowSize - 1) * GEOMETRY.peek}px`,
                  ...stageSlot?.style,
                } as import('react').CSSProperties
              }
              data-ui="card-stack-stage"
              data-state={busy ? 'pending' : 'settled'}
              role="group"
              tabIndex={0}
              aria-roledescription={labels.cardStackRole}
              aria-label={
                stageSlot?.['aria-label'] ?? (stageSlot?.['aria-labelledby'] ? undefined : label)
              }
              aria-disabled={disabled || undefined}
              aria-describedby={ids(stageSlot?.['aria-describedby'], `${id}-hint`)}
              onKeyDown={(event) => {
                stageSlot?.onKeyDown?.(event);
                keyDown(event);
              }}
              onPointerDown={(event) => {
                stageSlot?.onPointerDown?.(event);
                down(event);
              }}
              onPointerMove={(event) => {
                stageSlot?.onPointerMove?.(event);
                move(event);
              }}
              onPointerUp={(event) => {
                stageSlot?.onPointerUp?.(event);
                finish(event.pointerId, event.defaultPrevented);
              }}
              onPointerCancel={(event) => {
                stageSlot?.onPointerCancel?.(event);
                finish(event.pointerId, true);
              }}
              onLostPointerCapture={(event) => {
                stageSlot?.onLostPointerCapture?.(event);
                finish(event.pointerId, true);
              }}
            >
              {remaining.slice(0, windowSize).map((entry, index) => (
                <Layer
                  key={entry.key}
                  item={entry.item}
                  index={index}
                  active={index === 0}
                  reduced={reduced}
                  dragX={x}
                  stage={stage}
                  size={size}
                  label={`${getLabel(entry.item)}, ${labels.position(
                    unique.findIndex((candidate) => candidate.key === entry.key),
                    unique.length,
                  )}`}
                  renderCard={renderCard}
                  slots={slotProps}
                  labels={labels}
                  returning={returning?.key === entry.key ? returning.from : undefined}
                  returnVelocity={returning?.key === entry.key ? returning.velocity : undefined}
                  onComplete={() => setReturning(undefined)}
                />
              ))}
              {outgoing && (
                <Layer
                  key={`outgoing-${outgoing.key}`}
                  item={outgoing.item}
                  index={0}
                  active={false}
                  outgoing={outgoing}
                  reduced={reduced}
                  dragX={x}
                  stage={stage}
                  size={size}
                  label={getLabel(outgoing.item)}
                  renderCard={renderCard}
                  slots={slotProps}
                  labels={labels}
                  onComplete={() => setOutgoing(undefined)}
                />
              )}
              {!active && (
                <div
                  {...slotProps.empty}
                  css={[emptyStyle, slotProps.empty?.css]}
                  data-ui="card-stack-empty"
                >
                  {renderEmpty ? (
                    renderEmpty({ reset, completed })
                  ) : (
                    <>
                      <span>{completed ? labels.completed : labels.empty}</span>
                      {completed && action('reset', true)}
                    </>
                  )}
                </div>
              )}
            </div>
            <div
              {...slotProps.controls}
              data-ui="card-stack-controls"
              css={[controlsStyle, slotProps.controls?.css]}
            >
              {(['left', 'undo', 'right', 'reset'] as const).map((kind) => action(kind))}
            </div>
            <div
              {...slotProps.hint}
              id={`${id}-hint`}
              data-ui="card-stack-hint"
              css={[hiddenStyle, slotProps.hint?.css]}
            >
              {labels.hint(labels.left, labels.right)}
            </div>
            <div
              {...slotProps.status}
              role="status"
              aria-live="polite"
              aria-atomic="true"
              data-ui="card-stack-status"
              css={[hiddenStyle, slotProps.status?.css]}
            >
              {status}
            </div>
          </div>
        )}
      </WithSx>
    </MotionConfig>
  );
}
CardStack.displayName = 'CardStack';
