'use client';

import { useEffect, useId, useRef, useState, type ComponentPropsWithRef, type CSSProperties } from 'react';
import { MotionConfig, useReducedMotion } from 'motion/react';
import { vars } from '@jfrader/tokens/vars';
import { css } from '../../styling/css';
import { focusRingOutset } from '../../styling/focus-ring';
import { REDUCED_MOTION } from '../../styling/media';
import { WithSx, type SxProps } from '../../styling/sx';
import { useControlledState } from '../../utils/use-controlled-state';
import { GameCard, type GameCardPartProps } from '../game-card';
import { CARD_FRAME } from '../game-card/card-frame';
import {
  DEFAULT_TRICK_LAYOUT,
  TRICK_STACK,
  getPlayerStackPosition,
  getStackOffset,
  getStableJitter,
  getStableRotation,
  getTrickCardKey,
  type TrickCard,
  type TrickLayout,
  type TrickSeatGeometry,
} from './trick-layout';

export interface TrickPlayerStack {
  playerKey: string;
  geometry: TrickSeatGeometry;
  cards: readonly TrickCard[];
}

export interface TrickStacksProps extends Omit<ComponentPropsWithRef<'div'>, 'children' | 'defaultValue'>, SxProps {
  /** Cards for the current hand, grouped by player. At most three per stack are rendered. */
  stacks: readonly TrickPlayerStack[];
  /** Player keys whose cards stay spread, without inspection enlargement. */
  revealedKeys?: readonly string[];
  /** Names in your language, keyed by player and by `getTrickCardKey`. */
  labels: { stacks: Readonly<Record<string, string>>; cards: Readonly<Record<string, string>> };
  /** Inspected player key; `null` closes inspection. */
  value?: string | null;
  defaultValue?: string | null;
  /** Requests inspection open/close. Controlled state waits for the caller to accept. */
  onInspect?: (playerKey: string | null) => void;
  /** Center placement, jitter and rotation. Defaults to the reference's base center layout. */
  layout?: Partial<TrickLayout>;
  /** Closed card width in CSS units. Defaults to the medium GameCard token. */
  cardWidth?: string;
  /** Global play-order layers, keyed by `getTrickCardKey`. */
  playOrder?: Readonly<Record<string, number>>;
  slotProps?: { stack?: GameCardPartProps; trigger?: GameCardPartProps; card?: GameCardPartProps };
}

const rootStyle = css({
  label: 'trick-stacks', position: 'relative', inlineSize: '100%',
  blockSize: `calc(var(--trick-card-width) * 6)`,
});
const stackStyle = css({
  position: 'absolute', insetInlineStart: 'var(--stack-x)', insetBlockStart: 'var(--stack-y)',
  inlineSize: 'var(--trick-card-width)', blockSize: `calc(var(--trick-card-width) * ${CARD_FRAME.ratio})`,
  transform: 'translate(-50%, -50%)', zIndex: TRICK_STACK.zIndex.closed,
  '&:dir(rtl)': { transform: 'translate(50%, -50%)' },
  '&[data-spread="true"]': { zIndex: TRICK_STACK.zIndex.open },
});
const triggerStyle = css({
  position: 'absolute', inset: 0, inlineSize: '100%', blockSize: '100%',
  border: 0, padding: 0, background: 'transparent', cursor: 'pointer',
  borderRadius: vars.radius.md, zIndex: TRICK_STACK.zIndex.openCard + TRICK_STACK.maxCards,
  '&:focus-visible': focusRingOutset,
});
const cardsStyle = css({ position: 'absolute', inset: 0, pointerEvents: 'none' });
const faceStyle = css({ '--game-card-width': 'var(--visible-card-width)' });
const cardStyle = css({
  position: 'absolute', insetInlineStart: '50%', insetBlockStart: '50%',
  width: 'var(--visible-card-width)', height: `calc(var(--visible-card-width) * ${CARD_FRAME.ratio})`,
  borderRadius: `calc(var(--visible-card-width) / ${CARD_FRAME.cornerDivisor})`,
  boxShadow: 'var(--card-shadow)',
  transform: 'translate(calc(-50% + var(--card-x)), calc(-50% + var(--card-y))) rotate(var(--card-rotation))',
  '&:dir(rtl)': {
    transform: 'translate(calc(50% - var(--card-x)), calc(-50% + var(--card-y))) rotate(calc(-1 * var(--card-rotation)))',
  },
  transition: `transform ${vars.motion.duration.trickStack} ${vars.motion.easeTrickStack}, width ${vars.motion.duration.trickStack} ${vars.motion.easeTrickStack}, height ${vars.motion.duration.trickStack} ${vars.motion.easeTrickStack}, box-shadow ${vars.motion.duration.trickStack} ease`,
  '&[data-reduced-motion="true"]': { transition: 'none' },
  [REDUCED_MOTION]: { transition: 'none' },
  '& > [data-ui="game-card"]': { inlineSize: '100%', blockSize: '100%' },
});

export function TrickStacks({
  ref,
  stacks,
  labels,
  revealedKeys = [],
  value,
  defaultValue = null,
  onInspect,
  layout,
  cardWidth = vars.size.gameCardMd,
  playOrder = {},
  className,
  sx,
  style,
  onKeyDown,
  slotProps,
  ...rest
}: TrickStacksProps) {
  const [inspected, inspect] = useControlledState(value, defaultValue, onInspect);
  const returnFocus = useRef<HTMLButtonElement | null>(null);
  const triggers = useRef(new Map<string, HTMLButtonElement>());
  const reducedMotion = useReducedMotion();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const config = { ...DEFAULT_TRICK_LAYOUT, ...layout };
  useEffect(() => {
    if (inspected === null && returnFocus.current) {
      returnFocus.current.focus();
      returnFocus.current = null;
    }
    if (inspected !== null) returnFocus.current = null;
  }, [inspected]);

  return (
    <MotionConfig reducedMotion="user">
      <WithSx className={className} styles={rootStyle} sx={sx}>
        {(rootClass) => (
          <div
            {...rest}
            ref={ref}
            className={rootClass}
            data-ui="trick-stacks"
            style={{ '--trick-card-width': cardWidth, ...style } as CSSProperties}
            onKeyDown={(event) => {
              onKeyDown?.(event);
              if (event.defaultPrevented || event.key !== 'Escape' || inspected == null) return;
              event.preventDefault();
              returnFocus.current = triggers.current.get(inspected) ?? null;
              inspect(null);
            }}
          >
            {stacks.filter((stack) => stack.cards.length > 0).map((stack) => (
              <PlayerStack
                key={stack.playerKey}
                stack={stack}
                labels={labels}
                config={config}
                slotProps={slotProps}
                inspecting={inspected === stack.playerKey}
                revealed={revealedKeys.includes(stack.playerKey)}
                reducedMotion={mounted && !!reducedMotion}
                playOrder={playOrder}
                triggerRef={(node) => {
                  triggers.current.set(stack.playerKey, node);
                  return () => { triggers.current.delete(stack.playerKey); };
                }}
                onInspect={() => inspect(inspected === stack.playerKey ? null : stack.playerKey)}
              />
            ))}
          </div>
        )}
      </WithSx>
    </MotionConfig>
  );
}
TrickStacks.displayName = 'TrickStacks';

interface PlayerStackProps {
  stack: TrickPlayerStack;
  labels: TrickStacksProps['labels'];
  config: TrickLayout;
  inspecting: boolean;
  revealed: boolean;
  reducedMotion: boolean;
  playOrder: Readonly<Record<string, number>>;
  slotProps: TrickStacksProps['slotProps'];
  triggerRef: (node: HTMLButtonElement) => () => void;
  onInspect: () => void;
}

function PlayerStack({
  stack, labels, config, inspecting, revealed, reducedMotion, playOrder, slotProps, triggerRef, onInspect,
}: PlayerStackProps) {
  const cardsId = useId();
  const { x, y } = getPlayerStackPosition({ geometry: stack.geometry, ...config });
  const spread = inspecting || revealed;
  const cards = stack.cards.slice(0, TRICK_STACK.maxCards);
  const visibleWidth = inspecting ? `calc(var(--trick-card-width) * ${TRICK_STACK.openScale})` : 'var(--trick-card-width)';
  return (
    <div
      data-ui="trick-stack"
      data-player-key={stack.playerKey}
      data-spread={spread}
      data-state={inspecting ? 'open' : 'closed'}
      data-revealed={revealed || undefined}
      className={slotProps?.stack?.className}
      css={[stackStyle, slotProps?.stack?.css]}
      style={{ '--stack-x': `${x}%`, '--stack-y': `${y}%`, '--visible-card-width': visibleWidth } as CSSProperties}
    >
      <button
        type="button"
        className={slotProps?.trigger?.className}
        css={[triggerStyle, slotProps?.trigger?.css]}
        ref={triggerRef}
        onClick={onInspect}
        aria-label={labels.stacks[stack.playerKey]}
        aria-pressed={inspecting}
        aria-controls={cardsId}
      />
      <div id={cardsId} css={cardsStyle}>
        {cards.map((card, index) => {
          const key = getTrickCardKey(card.roundIdx, { player: { key: stack.playerKey }, card: card.card });
          const jitter = getStableJitter({ seed: key, spread: config.maxJitterPx });
          const offset = getStackOffset({ index, total: cards.length, open: spread, openSpreadRatio: TRICK_STACK.openSpreadRatio });
          const rotation = (config.facePlayerRotation ? stack.geometry.angleDeg - 90 : 0) +
            getStableRotation({ seed: inspecting ? `${key}:inspected` : key, maxRotationOffsetDeg: config.maxRotationOffsetDeg });
          return (
            <div
              key={key}
              data-ui="trick-stack-card"
              data-trick-key={key}
              data-reduced-motion={reducedMotion || undefined}
              className={slotProps?.card?.className}
              css={[cardStyle, slotProps?.card?.css]}
              style={{
                '--card-x': `calc(${jitter.x}px + ${spread ? `var(--visible-card-width) * ${offset.xCardWidths}` : `${offset.xPx}px`})`,
                '--card-y': `${jitter.y + offset.y}px`, '--card-rotation': `${rotation}deg`,
                '--card-shadow': spread ? vars.shadow.floating : index === cards.length - 1 ? vars.shadow.raised : 'none',
                zIndex: spread ? TRICK_STACK.zIndex.openCard + index : TRICK_STACK.zIndex.card + (playOrder[key] ?? 0),
              } as CSSProperties}
            >
              <GameCard label={labels.cards[key]!} value={card.value} sx={faceStyle} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
