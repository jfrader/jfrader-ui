'use client';

import { useEffect, useId, useRef, useState, type ComponentPropsWithRef, type ComponentType, type CSSProperties, type KeyboardEvent } from 'react';
import { MotionConfig, useReducedMotion } from 'motion/react';
import { useDeckArt } from '../deck/art-context';
import { vars } from '@jfrader/tokens/vars';
import { css } from '../../styling/css';
import { focusRingOutset } from '../../styling/focus-ring';
import { REDUCED_MOTION } from '../../styling/media';
import { WithSx, type SxProps } from '../../styling/sx';
import { useControlledState } from '../../utils/use-controlled-state';
import { GameCard, type GameCardPartProps, type GameCardProps } from '../game-card';
import { CARD_FRAME } from '../game-card/card-frame';
import { DEFAULT_PILE_LAYOUT, PLAYED_PILE, getPilePosition, getPileOffset, getStableJitter,
  getStableRotation, type PlayedCard, type PileLayout, type SeatVector } from './pile-layout';
import { getAutoLayout } from './auto-layout';
import { cardPartIdentity, useCardRegistrationRefs } from '../game-card/card-parts';
import { CardRoot, type GameCardRootProps, type GameCardRootSlotProps } from '../game-card/game-card-root';

export interface GameCardStackSlots {
  root?: ComponentType<GameCardRootProps>;
  pile?: ComponentType<ComponentPropsWithRef<'div'> & GameCardPartProps>;
  trigger?: ComponentType<ComponentPropsWithRef<'button'> & GameCardPartProps>;
  card?: ComponentType<ComponentPropsWithRef<'div'> & GameCardPartProps>;
}

export interface GameCardStackPile {
  playerKey: string;
  label: string;
  revealed?: boolean;
  /** Caller-owned normalized position; opts this pile out of grid fitting. */
  geometry?: SeatVector;
  cards: readonly PlayedCard[];
}

interface InspectionProps {
  artSet?: string;
  cardArtSets?: Readonly<Record<string, string>>;
  slots?: Omit<GameCardStackSlots, 'root'>;
  'data-ui'?: string;
  /** Inspected player key; `null` closes inspection. */
  value?: string | null;
  defaultValue?: string | null;
  /** Controlled inspection waits for the caller to accept the request. */
  onValueChange?: (playerKey: string | null) => void;
  /** Jitter and rotation only; GameTable owns placement of composed piles. */
  layout?: Partial<PileLayout>;
  /** First cards to render, rounded down and clamped to zero; defaults to three. */
  maxCards?: number;
  /** Preferred card width; defaults to the inherited width or the medium card token. */
  cardWidth?: string;
  backPattern?: GameCardProps['backPattern'];
  slotProps?: {
    /** Stack pile container holding cards played by a player. */
    pile?: GameCardPartProps;
    /** Transparent button overlay triggering pile inspection. */
    trigger?: GameCardPartProps;
    /** Card position wrapper applying jitter, offset, and rotation. */
    card?: GameCardPartProps;
  };
}

export interface GameCardStackProps extends Omit<ComponentPropsWithRef<'div'>, 'children' | 'defaultValue'>, SxProps, InspectionProps {
  slots?: GameCardStackSlots;
  /** Replace the root; slots.root takes precedence. */
  component?: ComponentType<GameCardRootProps>;
  slotProps?: InspectionProps['slotProps'] & { root?: GameCardRootSlotProps };
  /** Include empty piles to reserve grid positions while cards arrive. */
  piles: readonly GameCardStackPile[];
  /** Measured grid fitting by default; free placement uses each pile's geometry. */
  placement?: 'grid' | 'free';
}

export interface GameCardStackPileProps extends Omit<ComponentPropsWithRef<'div'>, 'children' | 'defaultValue'>, SxProps, InspectionProps {
  playerKey: string;
  cards: readonly PlayedCard[];
  label: string;
  revealed?: boolean;
}

const rootStyle = css({ label: 'game-card-stack', position: 'relative', inlineSize: '100%', blockSize: '100%' });
const stageStyle = css({
  position: 'absolute', inset: 0, display: 'grid',
  gridTemplateColumns: 'repeat(var(--pile-columns), minmax(0, 1fr))',
  gridTemplateRows: 'repeat(var(--pile-rows), minmax(0, 1fr))',
  gap: vars.space[4], boxSizing: 'border-box', placeItems: 'center',
  '&[data-placement="grid"]': { padding: vars.space[2] },
});
const probeStyle = css({ position: 'absolute', inlineSize: 'var(--pile-preferred-width)', blockSize: 0, visibility: 'hidden', pointerEvents: 'none' });
const slotStyle = css({
  position: 'relative', inlineSize: 'var(--game-card-width)', blockSize: `calc(var(--game-card-width) * ${CARD_FRAME.ratio})`,
  '&[data-placement="manual"]': {
    position: 'absolute', insetInlineStart: 'var(--pile-x)', insetBlockStart: 'var(--pile-y)',
    transform: 'translate(-50%, -50%)', '&:dir(rtl)': { transform: 'translate(50%, -50%)' },
  },
  '&:has([data-spread="true"])': { zIndex: PLAYED_PILE.zIndex.open },
});
const pileStyle = css({
  label: 'game-card-stack-pile', position: 'relative',
  inlineSize: '100%', blockSize: '100%', minInlineSize: 'var(--pile-width)',
  minBlockSize: `calc(var(--pile-width) * ${CARD_FRAME.ratio})`,
  zIndex: PLAYED_PILE.zIndex.closed,
  '&[data-spread="true"]': { zIndex: PLAYED_PILE.zIndex.open },
});
const triggerStyle = css({
  position: 'absolute', insetInlineStart: '50%', insetBlockStart: '50%',
  inlineSize: `max(var(--pile-width), ${vars.size.gameCardSm})`,
  blockSize: `max(calc(var(--pile-width) * ${CARD_FRAME.ratio}), ${vars.size.gameCardSm})`,
  transform: 'translate(-50%, -50%)', '&:dir(rtl)': { transform: 'translate(50%, -50%)' },
  border: 0, padding: 0, background: 'transparent', cursor: 'pointer', borderRadius: vars.radius.md,
  zIndex: PLAYED_PILE.zIndex.openCard + PLAYED_PILE.maxCards, '&:focus-visible': focusRingOutset,
});
const cardsStyle = css({ position: 'absolute', inset: 0, pointerEvents: 'none' });
const visibleCardWidth = 'calc(var(--pile-width) * var(--pile-card-scale))';
const visibleCardRadius = `calc(${visibleCardWidth} / ${CARD_FRAME.cornerDivisor})`;
const faceStyle = css({ '--game-card-width': 'inherit', borderRadius: visibleCardRadius });
const cardStyle = css({
  position: 'absolute', insetInlineStart: '50%', insetBlockStart: '50%',
  inlineSize: visibleCardWidth, blockSize: `calc(${visibleCardWidth} * ${CARD_FRAME.ratio})`,
  borderRadius: visibleCardRadius, boxShadow: 'var(--card-shadow)',
  transform: 'translate(calc(-50% + var(--card-x)), calc(-50% + var(--card-y))) rotate(var(--card-rotation))',
  '&:dir(rtl)': { transform: 'translate(calc(50% - var(--card-x)), calc(-50% + var(--card-y))) rotate(calc(-1 * var(--card-rotation)))' },
  transition: `transform ${vars.motion.duration.playedPile} ${vars.motion.easePlayedPile}, inline-size ${vars.motion.duration.playedPile} ${vars.motion.easePlayedPile}, block-size ${vars.motion.duration.playedPile} ${vars.motion.easePlayedPile}, box-shadow ${vars.motion.duration.playedPile} ${vars.motion.easePlayedPileShadow}`,
  '&[data-reduced-motion="true"]': { transition: 'none' }, [REDUCED_MOTION]: { transition: 'none' },
  '& > [data-ui~="game-card"]': { inlineSize: '100%', blockSize: '100%' },
});

function cardLimit(maxCards: number) {
  return Number.isFinite(maxCards) ? Math.max(0, Math.floor(maxCards)) : PLAYED_PILE.maxCards;
}

export function GameCardStack({
  ref, piles, placement = 'grid', value, defaultValue = null, onValueChange,
  layout, cardWidth = `var(--game-card-width, ${vars.size.gameCardMd})`, maxCards = PLAYED_PILE.maxCards,
  backPattern, artSet: explicitArtSet, cardArtSets: explicitCardArtSets, slots, component, className, sx, style, onKeyDown, slotProps, ...rest
}: GameCardStackProps) {
  const { artSet, cardArtSets } = useDeckArt({ artSet: explicitArtSet, cardArtSets: explicitCardArtSets });
  const [inspected, inspect] = useControlledState(value, defaultValue, onValueChange);
  const returnFocus = useRef<HTMLButtonElement | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const probeRef = useRef<HTMLDivElement>(null);
  const automaticCount = placement === 'grid' ? piles.filter((pile) => !pile.geometry).length : 0;
  const config = { ...DEFAULT_PILE_LAYOUT, ...layout };
  const limit = cardLimit(maxCards);
  const [fitted, setFitted] = useState<{ columns: number; rows: number; cardWidth: number } | null>(null);
  useEffect(() => {
    const stage = stageRef.current;
    const probe = probeRef.current;
    if (!stage || !probe || automaticCount === 0) return;
    const view = stage.ownerDocument.defaultView!;
    let width = 0;
    let height = 0;
    let preferredCardWidth = 0;
    const observer = new view.ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.target === stage) ({ width, height } = entry.contentRect);
        if (entry.target === probe) preferredCardWidth = entry.contentRect.width;
      }
      if (width <= 0 || height <= 0 || preferredCardWidth <= 0) return;
      const computed = view.getComputedStyle(stage);
      const next = getAutoLayout({ count: automaticCount, width, height, preferredCardWidth,
        columnGap: Number.parseFloat(computed.columnGap), rowGap: Number.parseFloat(computed.rowGap),
        maxJitterPx: config.maxJitterPx, maxRotationOffsetDeg: config.maxRotationOffsetDeg, maxCards: limit });
      setFitted((current) => current?.columns === next.columns && current.rows === next.rows && current.cardWidth === next.cardWidth ? current : next);
    });
    observer.observe(stage);
    observer.observe(probe);
    return () => observer.disconnect();
  }, [automaticCount, config.maxJitterPx, config.maxRotationOffsetDeg, limit]);
  useEffect(() => {
    if (inspected === null && returnFocus.current) returnFocus.current.focus();
    returnFocus.current = null;
  }, [inspected]);

  return <CardRoot {...rest} ref={ref} marker="game-card-stack" component={component} slots={slots}
    rootSlot={slotProps?.root} className={className} structure={rootStyle} sx={sx}
    style={{ '--pile-preferred-width': cardWidth, ...style } as CSSProperties}
    attributes={{ 'data-placement': placement,
      onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => {
        onKeyDown?.(event);
        slotProps?.root?.onKeyDown?.(event);
        if (event.defaultPrevented || event.key !== 'Escape' || inspected === null) return;
        event.preventDefault();
        returnFocus.current = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('[data-ui~="game-card-stack-pile"] > button')]
          .find((button) => button.parentElement?.dataset.playerKey === inspected) ?? null;
        inspect(null);
      } }}>
      <div ref={stageRef} data-ui="game-card-stack-stage" data-placement={placement}
        data-measured={automaticCount > 0 && fitted !== null || undefined} css={stageStyle}
        style={{ '--pile-columns': fitted?.columns ?? Math.ceil(Math.sqrt(Math.max(1, automaticCount))),
          '--pile-rows': fitted?.rows ?? Math.ceil(Math.sqrt(Math.max(1, automaticCount))),
          '--game-card-width': automaticCount && fitted ? `${fitted.cardWidth}px` : 'var(--pile-preferred-width)',
        } as CSSProperties}>
        <div ref={probeRef} aria-hidden="true" css={probeStyle} />
        {piles.map((pile) => {
          const position = pile.geometry ? getPilePosition({ geometry: pile.geometry }) : undefined;
          return <div key={pile.playerKey} data-ui="game-card-stack-slot" data-player-key={pile.playerKey}
            data-placement={position ? 'manual' : 'automatic'} css={slotStyle}
            style={{ '--pile-x': position ? `${position.x}%` : undefined, '--pile-y': position ? `${position.y}%` : undefined,
              '--game-card-width': position ? cardWidth : undefined } as CSSProperties}>
            <GameCardStack.Pile playerKey={pile.playerKey} cards={pile.cards} label={pile.label}
              value={inspected} onValueChange={inspect} revealed={pile.revealed}
              layout={layout} maxCards={limit} backPattern={backPattern} artSet={artSet} cardArtSets={cardArtSets} slots={slots} slotProps={slotProps}
              style={{ '--pile-base-rotation': config.facePlayerRotation && pile.geometry ? `${(pile.geometry.angleDeg ?? 90) - 90}deg` : undefined } as CSSProperties} />
          </div>;
        })}
      </div>
  </CardRoot>;
}
GameCardStack.displayName = 'GameCardStack';

function GameCardStackPilePart({ ref, playerKey, cards: allCards, label, value, defaultValue = null,
  onValueChange, revealed = false, maxCards = PLAYED_PILE.maxCards, cardWidth, layout, backPattern,
  className, sx, style, onKeyDown, slotProps, slots, artSet: explicitArtSet, cardArtSets: explicitCardArtSets, ...rest }: GameCardStackPileProps) {
  const { artSet, cardArtSets } = useDeckArt({ artSet: explicitArtSet, cardArtSets: explicitCardArtSets });
  const Pile = slots?.pile ?? 'div';
  const Trigger = slots?.trigger ?? 'button';
  const Card = slots?.card ?? 'div';
  const [inspected, inspect] = useControlledState(value, defaultValue, onValueChange);
  const inspecting = inspected === playerKey;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef(false);
  const cardsId = useId();
  const reducedMotion = useReducedMotion();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!inspecting && returnFocus.current) triggerRef.current?.focus();
    returnFocus.current = false;
  }, [inspecting]);
  const config = { ...DEFAULT_PILE_LAYOUT, ...layout };
  const cards = allCards.slice(0, cardLimit(maxCards));
  const registrationRef = useCardRegistrationRefs('played', cards.map((card) => card.id));
  const spread = inspecting || revealed;
  const { css: pileCss, className: pileClassName, style: pileInlineStyle, ...pileProps } = slotProps?.pile ?? {};
  return <MotionConfig reducedMotion="user"><WithSx className={[pileClassName, className].filter(Boolean).join(' ')}
    styles={[pileStyle, pileCss]} sx={sx}>{(rootClass) => (
    <Pile {...rest} {...pileProps} ref={ref} data-ui={cardPartIdentity('game-card-stack-pile', `${rest['data-ui'] ?? ''} ${pileProps['data-ui'] ?? ''}`)} data-player-key={playerKey}
      data-spread={spread} data-state={inspecting ? 'open' : 'closed'} data-revealed={revealed || undefined}
      className={rootClass}
      style={{ '--pile-width': cardWidth ?? `var(--game-card-width, ${vars.size.gameCardMd})`, '--pile-card-scale': inspecting ? PLAYED_PILE.openScale : 1, ...style, ...pileInlineStyle } as CSSProperties}
      onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
        onKeyDown?.(event);
        slotProps?.pile?.onKeyDown?.(event);
        if (event.defaultPrevented || event.key !== 'Escape' || !inspecting) return;
        // Root composition lets its own Escape handler retain native cancellation and focus ownership.
        if (event.currentTarget.closest('[data-ui~="game-card-stack"]')) return;
        event.preventDefault();
        returnFocus.current = true;
        inspect(null);
      }}>
      {cards.length > 0 && <>
        <Trigger {...slotProps?.trigger} type="button" data-ui={cardPartIdentity('game-card-stack-trigger', slotProps?.trigger?.['data-ui'])} className={slotProps?.trigger?.className} css={[triggerStyle, slotProps?.trigger?.css]}
          ref={triggerRef} onClick={(event) => { slotProps?.trigger?.onClick?.(event); if (!event.defaultPrevented) inspect(inspecting ? null : playerKey); }} aria-label={label}
          aria-expanded={inspecting} aria-controls={cardsId} />
        <div id={cardsId} css={cardsStyle}>
          {cards.map((card, index) => {
            const key = card.id;
            const jitter = getStableJitter({ seed: key, spread: config.maxJitterPx });
            const offset = getPileOffset({ index, total: cards.length, open: spread, openSpreadRatio: PLAYED_PILE.openSpreadRatio });
            const rotation = getStableRotation({ seed: inspecting ? `${key}:inspected` : key, maxRotationOffsetDeg: config.maxRotationOffsetDeg });
            return <Card {...slotProps?.card} key={key} data-ui={cardPartIdentity('game-card-stack-card', slotProps?.card?.['data-ui'])} data-played-key={key}
              ref={registrationRef(key)}
              data-reduced-motion={mounted && !!reducedMotion || undefined} className={slotProps?.card?.className}
              css={[cardStyle, slotProps?.card?.css]} style={{
                '--card-x': `calc(${jitter.x}px + ${spread ? `${visibleCardWidth} * ${offset.xCardWidths}` : `${offset.xPx}px`})`,
                '--card-y': `${jitter.y + offset.y}px`, '--card-rotation': `calc(${rotation}deg + var(--pile-base-rotation, 0deg))`,
                '--card-shadow': spread ? vars.shadow.floating : index === cards.length - 1 ? vars.shadow.raised : 'none',
                zIndex: spread ? PLAYED_PILE.zIndex.openCard + index : PLAYED_PILE.zIndex.card + (card.order ?? index),
                ...slotProps?.card?.style,
              } as CSSProperties}>
              <GameCard label={card.label} value={card.value} backPattern={backPattern} artSet={artSet} cardArtSets={cardArtSets} sx={faceStyle} />
            </Card>;
          })}
        </div>
      </>}
    </Pile>
  )}</WithSx></MotionConfig>;
}
GameCardStackPilePart.displayName = 'GameCardStack.Pile';
GameCardStack.Pile = GameCardStackPilePart;
