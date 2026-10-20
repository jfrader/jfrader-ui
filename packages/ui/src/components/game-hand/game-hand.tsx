'use client';

import type { ComponentPropsWithRef, ComponentType, CSSProperties } from 'react';
import { vars } from '@jfrader/tokens/vars';
import { css } from '../../styling/css';
import { focusRingOutset } from '../../styling/focus-ring';
import { withoutSx, WithSx, type SxProps } from '../../styling/sx';
import { useControlledState } from '../../utils/use-controlled-state';
import { Button } from '../button';
import { useDeckArt } from '../deck/art-context';
import { GameCard, type GameCardPartProps, type GameCardSize, type GameCardValue } from '../game-card';
import { gameCardSizeStyles } from '../game-card/game-card';
import { CARD_FRAME } from '../game-card/card-frame';
import { cardPartIdentity, useCardRegistrationRefs } from '../game-card/card-parts';
import { CardRoot, type GameCardRootProps, type GameCardRootSlotProps } from '../game-card/game-card-root';
import type { PlayingCard } from '../card-flights/flight-registry';
import { useFlightRegistry, warnFlight } from '../card-flights/flight-registry';
import { useCardFlightStatus, useOptionalCardFlights } from '../card-flights/flight-context';
import { useOptionalGameTableSeat } from '../game-table/game-table';
import {
  buildOpponentHiddenHandLayout, DEFAULT_HIDDEN_HAND_RULES, getHandFanRotations,
   HAND_CARD_OVERLAP_SPACING, HAND_FAN_DROP_PX, HAND_FAN_MAX_ROTATION_DEG, HAND_SELECTION_TARGET_PX, OPPONENT_SEAT_METRICS,
  type HandPolarVector, type HiddenHandRules,
} from './hand-layout';

export interface GameHandCard extends PlayingCard {
  value: GameCardValue;
}

export interface GameHandSlots {
  root?: ComponentType<GameCardRootProps>;
  fan?: ComponentType<ComponentPropsWithRef<'div'> & GameCardPartProps>;
  card?: ComponentType<ComponentPropsWithRef<'button'> & GameCardPartProps>;
  confirm?: ComponentType<ComponentPropsWithRef<'button'> & GameCardPartProps>;
}

export interface GameHandHiddenSlots {
  card?: ComponentType<ComponentPropsWithRef<'div'> & GameCardPartProps>;
}

export interface GameHandProps extends Omit<ComponentPropsWithRef<'div'>, 'children' | 'defaultValue'>, SxProps {
  /** Replace the root; slots.root takes precedence. */
  component?: ComponentType<GameCardRootProps>;
  /** Choose the card artwork set, overriding the enclosing deck's selection. */
  artSet?: string;
  /** Override artwork sets by card art id, merging with the enclosing deck's overrides. */
  cardArtSets?: Readonly<Record<string, string>>;
  /** Replace the root, fan, card buttons or confirmation button. */
  slots?: GameHandSlots;
  /** Adds root identity tokens alongside `game-hand`. */
  'data-ui'?: string;
  /** Render these cards in fan order. */
  cards: readonly GameHandCard[];
  /** Set the card dimensions. Defaults to `md`. */
  size?: GameCardSize;
  /** Selected card id. `null` clears selection. */
  value?: string | null;
  /** Initial selected card id for uncontrolled selection. */
  defaultValue?: string | null;
  /** Receive the selected card id, or `null` when the selected card is clicked again. */
  onValueChange?: (cardId: string | null) => void;
  /** Runs only when the confirmation button is activated, never on selection. */
  onPlayIntent?: (card: GameHandCard) => void;
  /** Text for the explicit confirmation action, in your page's language. */
  playLabel: string;
  /** Block selection and confirmation. Card flights also disable the hand while busy. */
  disabled?: boolean;
  /** Pass props and styles to the root, fan, card buttons and confirmation button. */
  slotProps?: {
    root?: GameCardRootSlotProps;
    /** Fan container holding the interactive hand cards. */
    fan?: GameCardPartProps;
    /** Interactive card button element inside the fan. */
    card?: GameCardPartProps;
    /** Confirmation button triggering play intent for the selected card. */
    confirm?: GameCardPartProps;
  };
}

const rootStyle = css({
  label: 'game-hand',
  display: 'inline-flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: vars.space[4],
});
const fanInlineReserveRatio = CARD_FRAME.ratio * Math.sin(HAND_FAN_MAX_ROTATION_DEG * Math.PI / 180);
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
  '&[aria-disabled="true"]': { cursor: 'default' },
});

export function GameHand({
  ref,
  cards,
  size = 'md',
  value,
  defaultValue = null,
  onValueChange,
  onPlayIntent,
  playLabel,
  disabled = false,
  slotProps,
  slots,
  component,
  artSet: explicitArtSet,
  cardArtSets: explicitCardArtSets,
  className,
  sx,
  ...rest
}: GameHandProps) {
  const { artSet, cardArtSets } = useDeckArt({ artSet: explicitArtSet, cardArtSets: explicitCardArtSets });
  const seat = useOptionalGameTableSeat();
  const flights = useOptionalCardFlights();
  const registry = useFlightRegistry();
  const { busy } = useCardFlightStatus();
  disabled = disabled || busy;
  const artwork = (card: PlayingCard, face: 'front' | 'back') => <GameCard value={card.value} label={card.label} face={face === 'back' ? 'back' : undefined}
    size={size} dimmed={disabled} artSet={artSet} cardArtSets={cardArtSets} />;
  const registrationRef = useCardRegistrationRefs('hand', cards, seat?.player?.key, artwork);
  const Fan = slots?.fan ?? 'div';
  const Card = slots?.card ?? 'button';
  const Confirm = slots?.confirm ?? 'button';
  const [selectedId, select] = useControlledState<string | null>(value, defaultValue, onValueChange);
  const selectedCard = cards.find((card) => card.id === selectedId);
  const rotations = getHandFanRotations(cards.length);
  return (
    <CardRoot {...rest} ref={ref} marker="game-hand" component={component} slots={slots}
      rootSlot={slotProps?.root} className={className} structure={[rootStyle, gameCardSizeStyles[size]]} sx={sx}>
      <Fan {...withoutSx(slotProps?.fan)} data-ui={cardPartIdentity('game-hand-fan', slotProps?.fan?.['data-ui'])} className={slotProps?.fan?.className} css={[fanStyle, slotProps?.fan?.sx]}>
        {cards.map((card, index) => {
          const angle = rotations[index] ?? 0;
          return (
            // CardFlights measures this wrapper using the shared card id.
            <Card {...withoutSx(slotProps?.card)} key={card.id} type="button" data-ui={cardPartIdentity('game-hand-card', slotProps?.card?.['data-ui'])} data-hand-card={card.id}
              ref={registrationRef(card.id)}
              aria-pressed={selectedId === card.id} aria-disabled={disabled || undefined}
              onClick={(event) => { slotProps?.card?.onClick?.(event); if (!event.defaultPrevented && !disabled) select(selectedId === card.id ? null : card.id); }}
              className={slotProps?.card?.className} css={[cardStyle, slotProps?.card?.sx]}
              style={{ '--hand-angle': `${angle}deg`, '--hand-drop': `${angle ? HAND_FAN_DROP_PX : 0}px`, ...slotProps?.card?.style } as CSSProperties}>
              {artwork(card, 'front')}
            </Card>
          );
        })}
      </Fan>
      <Button {...slotProps?.confirm} type="button" data-ui={cardPartIdentity('game-hand-confirm', slotProps?.confirm?.['data-ui'])} aria-disabled={disabled || !selectedCard || !onPlayIntent}
        render={(props) => <Confirm {...props} />}
        className={slotProps?.confirm?.className} sx={slotProps?.confirm?.sx}
        onClick={(event) => { slotProps?.confirm?.onClick?.(event); if (!event.defaultPrevented && !disabled && selectedCard) {
          const node = registry?.hand.get(selectedCard.id)?.node;
          if (node) flights?.rememberPlayOrigin(selectedCard.id, node);
          onPlayIntent?.(selectedCard);
        } }}>
        {playLabel}
      </Button>
    </CardRoot>
  );
}
GameHand.displayName = 'GameHand';

export interface GameHandHiddenProps extends Omit<ComponentPropsWithRef<'div'>, 'children'>, SxProps {
  /** Choose the card-back artwork set, overriding the enclosing deck's selection. */
  artSet?: string;
  /** Pass per-card artwork overrides to card rendering. Hidden backs use `artSet` instead. */
  cardArtSets?: Readonly<Record<string, string>>;
  /** Replace the wrapper around each hidden card. */
  slots?: GameHandHiddenSlots;
  /** Adds root identity tokens alongside `game-hand-hidden`. */
  'data-ui'?: string;
  /** Number of backs, rounded down and clamped to zero. */
  count: number;
  /** Name the hidden hand for assistive technology. */
  label: string;
  /** Stable player key for CardFlights' hidden-hand origins and deal destinations. */
  playerKey?: string;
  /** Set the card-back dimensions. Defaults to `md`. */
  size?: GameCardSize;
  /** Seat vector for radial placement. Omit for a standalone fan. */
  polar?: HandPolarVector;
  /** Scale fan spacing and layout-rule distances, not card dimensions. Defaults to `1`. */
  scale?: number;
  /** Set hidden-hand placement and fan geometry. Defaults to `DEFAULT_HIDDEN_HAND_RULES`. */
  rules?: HiddenHandRules;
  /** Styles each hidden-card wrapper. */
  slotProps?: {
    /** Position wrapper element for an individual hidden card. */
    card?: GameCardPartProps;
  };
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
  className, sx, style, slotProps, slots, artSet: explicitArtSet, cardArtSets: explicitCardArtSets, ...rest
}: GameHandHiddenProps) {
  const seat = useOptionalGameTableSeat();
  const registry = useFlightRegistry();
  playerKey ??= seat?.player?.key ?? seat?.slot.key;
  if (registry?.treeOwned && playerKey === undefined) warnFlight('GameHand.Hidden needs playerKey outside GameTable.Seat.');
  const { artSet, cardArtSets } = useDeckArt({ artSet: explicitArtSet, cardArtSets: explicitCardArtSets });
  const layout = buildOpponentHiddenHandLayout({
    geometry: polar ?? STANDALONE_POLAR,
    rules,
    hiddenCardCount: count,
    ...OPPONENT_SEAT_METRICS,
    scale,
  });
  const anchor = polar ? layout.anchor : null;
  const artwork = () => <GameCard label={label} size={size} artSet={artSet} cardArtSets={cardArtSets} />;
  const registrationRef = useCardRegistrationRefs('hidden', layout.cards.map((_, index) => ({ id: String(index), label })), playerKey, artwork);
  const Card = slots?.card ?? 'div';
  return (
    <WithSx className={className} styles={[hiddenStyle, gameCardSizeStyles[size]]} sx={sx}>
      {(rootClass) => (
        <div {...rest} ref={ref} data-ui={[...new Set(`game-hand-hidden ${rest['data-ui'] ?? ''}`.split(/\s+/).filter(Boolean))].join(' ')} role="img" aria-label={label} className={rootClass}
          style={{ transform: anchor ? `translate(${anchor.x}px, ${anchor.y}px) rotate(${anchor.rotateDeg}deg)` : undefined,
            transformOrigin: anchor?.origin, ...style }}>
          {layout.cards.map((card, index) => (
            // CardFlights pairs the player key and zero-based index on the measured wrapper.
            <Card {...withoutSx(slotProps?.card)} key={`hidden-${index}`} data-ui={cardPartIdentity('game-hand-hidden-card', slotProps?.card?.['data-ui'])} data-seat-hidden-card={playerKey}
               ref={registrationRef(String(index))}
              data-seat-hidden-card-index={playerKey === undefined ? undefined : index} aria-hidden="true"
              className={slotProps?.card?.className} css={[hiddenCardStyle, slotProps?.card?.sx]}
               style={{ '--hidden-x': `${card.x}px`, '--hidden-y': `${card.y}px`, '--hidden-angle': `${card.rotateDeg}deg`, zIndex: card.zIndex, ...slotProps?.card?.style } as CSSProperties}>
               {artwork()}
             </Card>
          ))}
        </div>
      )}
    </WithSx>
  );
}
GameHandHidden.displayName = 'GameHand.Hidden';
GameHand.Hidden = GameHandHidden;
