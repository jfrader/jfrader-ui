'use client';

import type { ComponentPropsWithRef, CSSProperties } from 'react';
import { vars } from '@jfrader/tokens/vars';
import { css } from '../../styling/css';
import { focusRingOutset } from '../../styling/focus-ring';
import { WithSx, type SxProps } from '../../styling/sx';
import { useControlledState } from '../../utils/use-controlled-state';
import { Button } from '../button';
import { GameCard, type GameCardPartProps, type GameCardSize, type GameCardValue } from '../game-card';
import { gameCardSizeStyles } from '../game-card/game-card';
import { CARD_FRAME } from '../game-card/card-frame';
import {
  buildOpponentHiddenHandLayout, DEFAULT_HIDDEN_HAND_RULES, getHandFanRotations,
  HAND_CARD_OVERLAP_SPACING, HAND_FAN_DROP_PX, HAND_SELECTION_TARGET_PX, OPPONENT_SEAT_METRICS,
  type HandPolarVector, type HiddenHandRules,
} from './hand-layout';

export interface GameHandCard {
  /** Unique, stable identity; match FlightCard.key when using CardFlights. */
  id: string;
  value: GameCardValue;
  label: string;
}

export interface GameHandProps extends Omit<ComponentPropsWithRef<'div'>, 'children' | 'onSelect'>, SxProps {
  cards: readonly GameHandCard[];
  size?: GameCardSize;
  /** Controlled selection. `null` clears it. */
  selectedIndex?: number | null;
  defaultSelectedIndex?: number | null;
  onSelect?: (cardIdx: number | null) => void;
  /** Runs only when the confirmation button is activated, never on selection. */
  onPlayIntent?: (card: GameHandCard, cardIdx: number) => void;
  /** Text for the explicit confirmation action, in your page's language. */
  playLabel: string;
  disabled?: boolean;
  slotProps?: { fan?: GameCardPartProps; card?: GameCardPartProps; confirm?: GameCardPartProps };
}

const rootStyle = css({
  label: 'game-hand',
  display: 'inline-flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: vars.space[4],
});
const fanInlineReserveRatio = CARD_FRAME.ratio * Math.sin(Math.max(...getHandFanRotations(3).map(Math.abs)) * Math.PI / 180);
const fanStyle = css({
  display: 'flex',
  alignItems: 'center',
  inlineSize: 'max-content',
  isolation: 'isolate',
  paddingBlock: vars.space[4],
  paddingInline: `calc(var(--game-card-width) * ${fanInlineReserveRatio} + ${vars.space[2]})`,
  '--hand-direction': 1,
  '&:dir(rtl)': { '--hand-direction': -1 },
});
const cardStyle = css({
  appearance: 'none',
  padding: 0,
  border: 0,
  background: 'none',
  cursor: 'pointer',
  position: 'relative',
  flexShrink: 0,
  borderRadius: `calc(var(--game-card-width) / ${CARD_FRAME.cornerDivisor})`,
  transform: 'rotate(calc(var(--hand-angle) * var(--hand-direction))) translateY(var(--hand-drop))',
  transformOrigin: 'bottom center',
  '& + &': { marginInlineStart: `max(calc(${vars.space[2]} * ${HAND_CARD_OVERLAP_SPACING}), calc(${HAND_SELECTION_TARGET_PX}px - var(--game-card-width)))` },
  '&[aria-pressed="true"]': {
    translate: `0 calc(-1 * ${vars.space[2]})`,
    outline: `3px double ${vars.color.accent}`,
    outlineOffset: '2px',
  },
  '&:focus-visible': { ...focusRingOutset, zIndex: 1000 },
  '&:disabled': { cursor: 'default' },
});

export function GameHand({
  ref,
  cards,
  size = 'md',
  selectedIndex,
  defaultSelectedIndex = null,
  onSelect,
  onPlayIntent,
  playLabel,
  disabled = false,
  slotProps,
  className,
  sx,
  ...rest
}: GameHandProps) {
  const [selectedId, select] = useControlledState<string | null>(
    selectedIndex === undefined ? undefined : cards[selectedIndex ?? -1]?.id ?? null,
    cards[defaultSelectedIndex ?? -1]?.id ?? null,
    (id) => onSelect?.(id === null ? null : cards.findIndex((card) => card.id === id)),
  );
  const cardIdx = cards.findIndex((card) => card.id === selectedId);
  const rotations = getHandFanRotations(cards.length);
  return (
    <WithSx className={className} styles={[rootStyle, gameCardSizeStyles[size]]} sx={sx}>
      {(rootClass) => (
        <div {...rest} ref={ref} data-ui="game-hand" className={rootClass}>
          <div data-ui="game-hand-fan" className={slotProps?.fan?.className} css={[fanStyle, slotProps?.fan?.css]}>
            {cards.map((card, index) => {
              const angle = rotations[index] ?? 0;
              return (
                // CardFlights measures this wrapper; card.id must match FlightCard.key.
                <button key={card.id} type="button" data-ui="game-hand-card" data-hand-card={card.id}
                  aria-pressed={cardIdx === index} disabled={disabled}
                  onClick={() => select(cardIdx === index ? null : card.id)}
                  className={slotProps?.card?.className} css={[cardStyle, slotProps?.card?.css]}
                  style={{ '--hand-angle': `${angle}deg`, '--hand-drop': `${angle ? HAND_FAN_DROP_PX : 0}px` } as CSSProperties}>
                  <GameCard value={card.value} label={card.label} size={size} dimmed={disabled} />
                </button>
              );
            })}
          </div>
          <Button type="button" data-ui="game-hand-confirm" disabled={disabled || cardIdx < 0 || !onPlayIntent}
            render={(props) => <button {...props} data-ui="game-hand-confirm" disabled={disabled || cardIdx < 0 || !onPlayIntent} />}
            className={slotProps?.confirm?.className} css={slotProps?.confirm?.css}
            onClick={() => { if (!disabled && cardIdx >= 0) onPlayIntent?.(cards[cardIdx]!, cardIdx); }}>
            {playLabel}
          </Button>
        </div>
      )}
    </WithSx>
  );
}
GameHand.displayName = 'GameHand';

export interface GameHandHiddenProps extends Omit<ComponentPropsWithRef<'div'>, 'children'>, SxProps {
  /** Number of backs, clamped to 0–3 and rounded down. */
  count: number;
  label: string;
  /** Stable player key for CardFlights' hidden-hand origins and deal destinations. */
  playerKey?: string;
  size?: GameCardSize;
  /** Seat vector for radial placement. Omit for a standalone fan. */
  polar?: HandPolarVector;
  scale?: number;
  rules?: HiddenHandRules;
}

const hiddenStyle = css({
  label: 'game-hand-hidden',
  position: 'relative',
  inlineSize: 'var(--game-card-width)',
  blockSize: `calc(var(--game-card-width) * ${CARD_FRAME.ratio})`,
  isolation: 'isolate',
  '--hand-direction': 1,
  '&:dir(rtl)': { '--hand-direction': -1 },
});
const hiddenCardStyle = css({
  position: 'absolute',
  inset: 0,
  transformOrigin: '50% 86%',
  transform: 'translate(calc(var(--hidden-x) * var(--hand-direction)), var(--hidden-y)) rotate(calc(var(--hidden-angle) * var(--hand-direction)))',
});
const STANDALONE_POLAR: HandPolarVector = { cos: 0, sin: -1, sideStrength: 0 };

function GameHandHidden({
  ref, count, label, playerKey, size = 'md', polar, scale = 1, rules = DEFAULT_HIDDEN_HAND_RULES,
  className, sx, style, ...rest
}: GameHandHiddenProps) {
  const layout = buildOpponentHiddenHandLayout({
    geometry: polar ?? STANDALONE_POLAR,
    profileRules: rules,
    hiddenCardCount: count,
    ...OPPONENT_SEAT_METRICS,
    scale,
  });
  const anchor = polar ? layout.anchor : null;
  return (
    <WithSx className={className} styles={[hiddenStyle, gameCardSizeStyles[size]]} sx={sx}>
      {(rootClass) => (
        <div {...rest} ref={ref} data-ui="game-hand-hidden" role="img" aria-label={label} className={rootClass}
          style={{ transform: anchor ? `translate(${anchor.x}px, ${anchor.y}px) rotate(${anchor.rotateDeg}deg)` : undefined,
            transformOrigin: anchor?.origin, ...style }}>
          {layout.cards.map((card, index) => (
            // CardFlights pairs the player key and zero-based index on the measured wrapper.
            <div key={`hidden-${index}`} data-ui="game-hand-hidden-card" data-seat-hidden-card={playerKey}
              data-seat-hidden-card-index={playerKey === undefined ? undefined : index} aria-hidden="true" css={hiddenCardStyle}
              style={{ '--hidden-x': `${card.x}px`, '--hidden-y': `${card.y}px`, '--hidden-angle': `${card.rotateDeg}deg`, zIndex: card.zIndex } as CSSProperties}>
              <GameCard label={label} size={size} />
            </div>
          ))}
        </div>
      )}
    </WithSx>
  );
}
GameHandHidden.displayName = 'GameHand.Hidden';
GameHand.Hidden = GameHandHidden;
