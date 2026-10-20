import { withoutSx } from '../../styling/sx';
'use client';

import { useEffect, useState, type ComponentPropsWithRef, type ComponentType, type ReactNode } from 'react';
import { MotionConfig, useReducedMotion } from 'motion/react';
import { vars } from '@jfrader/tokens/vars';
import { css } from '../../styling/css';
import { REDUCED_MOTION } from '../../styling/media';
import type { SxProps } from '../../styling/sx';
import type { GameCardPartProps, GameCardSize, GameCardValue } from '../game-card';
import { useDeck } from '../deck';
import { useDeckBackLabel } from '../deck/deck-context';
import { DeckArtProvider, useDeckArt } from '../deck/art-context';
import type { PatternVariant } from '../pattern';
import { CardRoot, type GameCardRootCustomization, type GameCardRootProps, type GameCardRootSlotProps } from '../game-card/game-card-root';
import { CARD_FRAME, CARD_PERSPECTIVE } from '../game-card/card-frame';
import { gameCardSizeStyles, ResolvedGameCard } from '../game-card/game-card';
import { cardPartIdentity } from '../game-card/card-parts';

export interface FlipGameCardSlots {
  root?: ComponentType<GameCardRootProps>;
  rotator?: ComponentType<ComponentPropsWithRef<'div'> & GameCardPartProps>;
  front?: ComponentType<ComponentPropsWithRef<'div'> & GameCardPartProps>;
  back?: ComponentType<ComponentPropsWithRef<'div'> & GameCardPartProps>;
}

interface FlipGameCardBaseProps extends Omit<GameCardRootProps, 'children'>, SxProps, GameCardRootCustomization {
  artSet?: string;
  cardArtSets?: Readonly<Record<string, string>>;
  slots?: FlipGameCardSlots;
  /** Shows the back when true. Defaults to false; no interaction changes this prop. */
  flipped?: boolean;
  /** Card width, using the GameCard scale. Defaults to `md`. */
  size?: GameCardSize;
  slotProps?: {
    /** Outer card shell container wrapping the card rotator and faces. */
    root?: GameCardRootSlotProps;
    /** Animated 3D rotator element holding the front and back card faces. */
    rotator?: GameCardPartProps;
    /** Container element displaying the face-up card content. */
    front?: GameCardPartProps;
    /** Container element displaying the face-down card back. */
    back?: GameCardPartProps;
  };
}

export type FlipGameCardProps = FlipGameCardBaseProps & (
  | {
    /** Card identity; one resolved deck supplies both faces. */
    value: GameCardValue;
    /** Accessible name of the printed face, in your language. */
    label: string;
    /** Accessible name of the back. Required here or on DeckProvider. */
    backLabel?: string;
    rankLabel?: string;
    dimmed?: boolean;
    backPattern?: PatternVariant;
    front?: never;
    back?: never;
  }
  | {
    /** Content shown when flipped is false. Both faces stay mounted. */
    front: ReactNode;
    /** Content shown when flipped is true. */
    back: ReactNode;
    value?: never;
    label?: never;
    backLabel?: never;
    rankLabel?: never;
    dimmed?: never;
    backPattern?: never;
  }
);

export class MissingBackLabelError extends Error {
  constructor() {
    super('FlipGameCard: provide a nonempty backLabel or DeckProvider backLabel to name the card back.');
    this.name = 'MissingBackLabelError';
  }
}

export function FlipGameCard(props: FlipGameCardProps) {
  const art = useDeckArt(props);
  return <DeckArtProvider {...art}>{props.value !== undefined ? <ShorthandCard {...props} {...art} /> : <FlipCardContent {...props} {...art} />}</DeckArtProvider>;
}

function ShorthandCard({ value, label, backLabel, rankLabel, dimmed, backPattern, artSet, cardArtSets, size = 'md', ...props }:
  FlipGameCardBaseProps & { value: GameCardValue; label: string; backLabel?: string; rankLabel?: string; dimmed?: boolean; backPattern?: PatternVariant }) {
  const deck = useDeck(value.deck);
  const inheritedBackLabel = useDeckBackLabel();
  const name = backLabel ?? inheritedBackLabel;
  if (name === undefined || name.trim() === '') throw new MissingBackLabelError();
  return <FlipCardContent {...props} size={size}
    front={<ResolvedGameCard deck={deck} size={size} value={value} label={label} rankLabel={rankLabel} dimmed={dimmed} artSet={artSet} cardArtSets={cardArtSets} />}
    back={<ResolvedGameCard deck={deck} size={size} value={value} face="back" label={name} dimmed={dimmed} backPattern={backPattern} artSet={artSet} cardArtSets={cardArtSets} />} />;
}

const rootStyle = css({
  label: 'flip-game-card',
  position: 'relative',
  flexShrink: 0,
  inlineSize: 'var(--game-card-width)',
  blockSize: `calc(var(--game-card-width) * ${CARD_FRAME.ratio})`,
  borderRadius: `calc(var(--game-card-width) / ${CARD_FRAME.cornerDivisor})`,
  perspective: CARD_PERSPECTIVE.flip,
});

const stillStyle = css({
  '& > [data-ui~="flip-game-card-rotator"]': {
    transform: 'none',
    transition: 'none',
    '& > [aria-hidden="true"]': { visibility: 'hidden' },
  },
});

const reducedStyle = css({
  '&[data-reduced-motion="true"]': stillStyle,
  [REDUCED_MOTION]: stillStyle,
});

const rotatorStyle = css({
  position: 'relative',
  inlineSize: '100%',
  blockSize: '100%',
  transformStyle: 'preserve-3d',
  transform: 'rotateY(0deg)',
  transition: `transform ${vars.motion.duration.cardFlip} ${vars.motion.easeCardFlip}`,
  '&[data-state="back"]': { transform: 'rotateY(180deg)' },
});

const faceStyle = css({
  position: 'absolute',
  inset: 0,
  backfaceVisibility: 'hidden',
  '& > [data-ui~="game-card"]': { '--game-card-width': 'inherit', inlineSize: '100%', blockSize: '100%' },
});

const backStyle = css({
  transform: 'rotateY(180deg)',
  '&[data-reduced-motion="true"]': { transform: 'none' },
  [REDUCED_MOTION]: { transform: 'none' },
});

function FlipCardContent({
  ref,
  flipped = false,
  front,
  back,
  size = 'md',
  slotProps,
  slots,
  artSet: _artSet,
  cardArtSets: _cardArtSets,
  className,
  sx,
  ...rest
}: FlipGameCardBaseProps & { front: ReactNode; back: ReactNode }) {
  const reducedMotion = useReducedMotion();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const state = flipped ? 'back' : 'front';
  const Rotator = slots?.rotator ?? 'div';
  const Front = slots?.front ?? 'div';
  const Back = slots?.back ?? 'div';

  return (
    <MotionConfig reducedMotion="user">
      <CardRoot
        {...rest}
        slots={slots}
        ref={ref}
        marker="flip-game-card"
        rootSlot={slotProps?.root}
        className={className}
        structure={[rootStyle, gameCardSizeStyles[size], reducedStyle]}
        sx={sx}
        attributes={{ 'data-state': state, 'data-size': size, 'data-reduced-motion': (mounted && reducedMotion) || undefined }}
      >
        <Rotator
          {...withoutSx(slotProps?.rotator)}
          data-ui={cardPartIdentity('flip-game-card-rotator', slotProps?.rotator?.['data-ui'])}
          data-state={state}
          className={slotProps?.rotator?.className}
          css={[rotatorStyle, slotProps?.rotator?.sx]}
        >
          <Front
            {...withoutSx(slotProps?.front)}
            data-ui={cardPartIdentity('flip-game-card-front', slotProps?.front?.['data-ui'])}
            inert={flipped}
            aria-hidden={flipped || undefined}
            className={slotProps?.front?.className}
            css={[faceStyle, slotProps?.front?.sx]}
          >
            {front}
          </Front>
          <Back
            {...withoutSx(slotProps?.back)}
            data-ui={cardPartIdentity('flip-game-card-back', slotProps?.back?.['data-ui'])}
            data-reduced-motion={(mounted && reducedMotion) || undefined}
            inert={!flipped}
            aria-hidden={!flipped || undefined}
            className={slotProps?.back?.className}
            css={[faceStyle, backStyle, slotProps?.back?.sx]}
          >
            {back}
          </Back>
        </Rotator>
      </CardRoot>
    </MotionConfig>
  );
}

FlipGameCard.displayName = 'FlipGameCard';
