import { withoutSx } from '../../styling/sx';
'use client';

// Semantics: one `role="img"` root per card, named by `label`; the rank mark, the suit glyph and the
// suit watermarks are presentational children, so a screen reader hears the playing card once, in the
// consumer's own words. A face-down card omits built-in rank, suit and deck data; consumer artwork
// remains visible, so consumers must keep private values out of their own art.
import { useLayoutEffect, useRef, type ComponentPropsWithRef, type ComponentType, type HTMLAttributes, type ReactNode } from 'react';
import { vars } from '@jfrader/tokens/vars';
import { css, type Interpolation, type SerializedStyles, type Theme } from '../../styling/css';
import type { SxProps } from '../../styling/sx';
import { isRenderable } from '../../utils/renderable';
import { useDeck, type Deck } from '../deck';
import { useDeckArt } from '../deck/art-context';
import { cardArtId, resolveCardArt, resolveDeckBack } from '../deck/deck';
import { cardPartIdentity } from './card-parts';
import { Pattern, type PatternTone, type PatternVariant } from '../pattern';
import { CARD_FACE, CARD_FRAME } from './card-frame';
import type { GameCardValue } from './decks';
import { CardRoot, type GameCardRootCustomization, type GameCardRootProps, type GameCardRootSlotProps } from './game-card-root';

export type GameCardSize = 'sm' | 'md' | 'lg';
/**
 * Face to display. Defaults to `print` when `value` is present, or `back` when omitted.
 */
export type GameCardFace = 'print' | 'back';

/** Conventional backs by deck. Pass the matching value as `backPattern` to explicitly override the deck's back. */
export const CARD_BACK_PATTERNS = {
  spanish: 'diagonal',
  french: 'checks',
} as const;

export interface GameCardPartProps extends HTMLAttributes<HTMLElement> {
  'data-ui'?: string;
  sx?: Interpolation<Theme>;
}

export interface GameCardSlots {
  /** Renders a `div` by default. */
  root?: ComponentType<GameCardRootProps>;
  face?: ComponentType<ComponentPropsWithRef<'span'> & GameCardPartProps>;
  back?: ComponentType<ComponentPropsWithRef<'span'> & GameCardPartProps>;
}

export interface GameCardProps
  extends Omit<GameCardRootProps, 'children' | 'color'>,
    SxProps, GameCardRootCustomization {
  /**
   * Accessible name, in the page's language and the consumer's grammar: "as de oros", "king of
   * hearts". A face-down card names the back, never the value.
   */
  label: string;
  /** What the card is. Omit it, or set `face="back"`, for a card that stays hidden. */
  value?: GameCardValue;
  /** Selects a named art set, overriding `DeckArtProvider`. `face="print"` bypasses face artwork. */
  artSet?: string;
  /** Selects art sets by card art id, overriding inherited entries and `artSet`. */
  cardArtSets?: Readonly<Record<string, string>>;
  slots?: GameCardSlots;
  /** Defaults to `print` with a value and `back` without one. */
  face?: GameCardFace;
  /** Explicit back tile override. When omitted, the back is determined by the card's deck. */
  backPattern?: PatternVariant;
  /** Card width: `sm` 32px, `md` 72px, `lg` 112px. */
  size?: GameCardSize;
  /** Replaces the printed rank mark; the suit glyph stays. */
  rankLabel?: string;
  /** Draws the card as worn: out of play, or waiting. */
  dimmed?: boolean;
  /** Your own art — an image, an SVG, anything. Replaces the emoji print or back pattern. */
  children?: ReactNode;
  /** Passes props and styles to the card root, face and back layers. */
  slotProps?: {
    /** Outer card container wrapping the card face or back. Renders a `div` by default. */
    root?: GameCardRootSlotProps;
    /** Face layer displaying the card rank and suit print. */
    face?: GameCardPartProps;
    /** Back layer displaying the deck pattern. */
    back?: GameCardPartProps;
  };
}

const rootStyle = css({
  '--game-card-width': vars.size.gameCardMd,
  position: 'relative',
  display: 'block',
  flexShrink: 0,
  boxSizing: 'border-box',
  inlineSize: 'var(--game-card-width)',
  blockSize: `calc(var(--game-card-width) * ${CARD_FRAME.ratio})`,
  borderRadius: `calc(var(--game-card-width) / ${CARD_FRAME.cornerDivisor})`,
  overflow: 'hidden',
  containerType: 'inline-size',
  userSelect: 'none',
  verticalAlign: 'middle',
});

// The card is its own material: paper and ink do not follow the page theme.
const paperStyle = css({
  backgroundColor: vars.color.cardFace,
  color: vars.color.cardInk,
  border: `1px solid ${vars.color.cardInk}`,
});

const dimmedStyle = css({ opacity: 0.55 });

const backMaterialStyle = css({ backgroundColor: vars.color.cardRed });

const layerStyle = css({
  position: 'absolute',
  inset: 0,
});

const printStyle = css({
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr)',
  placeItems: 'center',
  paddingInline: `${CARD_FACE.contentPaddingPercent}%`,
  fontSize: `${CARD_FACE.markWidthRatio * 100}cqw`,
  fontWeight: vars.fontWeight.semibold,
  lineHeight: 1,
  whiteSpace: 'nowrap',
});

const artStyle = css({
  display: 'grid',
  placeItems: 'center',
  '& > img, & > svg': {
    inlineSize: '100%',
    blockSize: '100%',
    objectFit: 'cover',
  },
});

const markStyle = css({
  display: 'grid',
  gridAutoFlow: 'column',
  alignItems: 'center',
  gap: '0.1em',
  inlineSize: 'max-content',
  transform: 'scale(var(--game-card-mark-scale, 1))',
});

const watermarkStyle = css({
  position: 'absolute',
  fontSize: `${CARD_FACE.markWidthRatio * 100}cqw`,
  lineHeight: 1,
  opacity: CARD_FACE.watermarkOpacity,
});

const watermarkTopStyle = css({
  insetBlockStart: `${CARD_FACE.watermarkInsetPercent}%`,
  insetInlineEnd: 0,
});

const watermarkBottomStyle = css({
  insetBlockEnd: `${CARD_FACE.watermarkInsetPercent}%`,
  insetInlineStart: 0,
});

const suitInkStyles: Record<'red' | 'ink', SerializedStyles> = {
  red: css({ color: vars.color.cardRed }),
  ink: css({ color: vars.color.cardInk }),
};

export const gameCardSizeStyles: Record<GameCardSize, SerializedStyles> = {
  sm: css({ '--game-card-width': vars.size.gameCardSm }),
  md: css({ '--game-card-width': vars.size.gameCardMd }),
  lg: css({ '--game-card-width': vars.size.gameCardLg }),
};

export function GameCard(props: GameCardProps) {
  const deck = useDeck(props.value?.deck);
  return <ResolvedGameCard {...props} deck={deck} />;
}

export function ResolvedGameCard({
  deck,
  ref,
  label,
  value,
  face,
  artSet: explicitArtSet,
  cardArtSets: explicitCardArtSets,
  slots,
  backPattern,
  size = 'md',
  rankLabel,
  dimmed = false,
  children,
  slotProps,
  className,
  sx,
  ...rest
}: GameCardProps & { deck: Deck }) {
  const { artSet, cardArtSets } = useDeckArt({ artSet: explicitArtSet, cardArtSets: explicitCardArtSets });
  // Asking for `print` is a request for the printed face, so art stands aside for that card.
  const requestedPrint = face === 'print';
  const resolvedFace: 'print' | 'back' =
    face === 'back'
      ? 'back'
      : requestedPrint || value !== undefined
        ? 'print'
        : 'back';
  const hidden = resolvedFace === 'back' || value === undefined;
  const artProps = hidden ? slotProps?.back : slotProps?.face;
  const Art = hidden ? slots?.back ?? 'span' : slots?.face ?? 'span';
  const selectedSet = value ? cardArtSets?.[cardArtId(deck, value.suit, String(value.rank))] ?? artSet : artSet;

  return (
    <CardRoot
      {...rest}
      slots={slots}
      ref={ref}
      marker="game-card"
      rootSlot={slotProps?.root}
      className={className}
      structure={[rootStyle, gameCardSizeStyles[size], dimmed && dimmedStyle]}
      material={[paperStyle, hidden && backMaterialStyle]}
      attributes={{ role: 'img', 'aria-label': label, 'data-face': resolvedFace, 'data-deck': hidden ? undefined : deck.id }}
      sx={sx}
    >
      {isRenderable(children) ? (
        <Art
          {...withoutSx(artProps)}
          data-ui={cardPartIdentity('game-card-art', artProps?.['data-ui'])}
          aria-hidden="true"
          className={artProps?.className}
          css={[layerStyle, artStyle, hidden && backMaterialStyle, artProps?.sx]}
        >
          {children}
        </Art>
      ) : hidden ? (
        <CardBack deck={deck} backPattern={backPattern} artSet={selectedSet} slots={slots} slotProps={slotProps} />
      ) : (
        <CardFront deck={deck} value={value!} rankLabel={rankLabel} artSet={selectedSet} printed={requestedPrint} slots={slots} slotProps={slotProps} />
      )}
    </CardRoot>
  );
}

GameCard.displayName = 'GameCard';

interface CardBackProps {
  deck: Deck;
  artSet?: string;
  slots?: GameCardSlots;
  backPattern?: PatternVariant;
  slotProps?: GameCardProps['slotProps'];
}

function CardBack({ deck, backPattern, artSet, slots, slotProps }: CardBackProps) {
  const Back = slots?.back ?? 'span';
  if (backPattern !== undefined) {
    return (
      <Back
        {...withoutSx(slotProps?.back)}
        data-ui={cardPartIdentity('game-card-back', slotProps?.back?.['data-ui'])}
        aria-hidden="true"
        className={slotProps?.back?.className}
        css={[layerStyle, backMaterialStyle, slotProps?.back?.sx]}
      >
        <Pattern variant={backPattern} tone="card" />
      </Back>
    );
  }

  const deckBack = resolveDeckBack(deck, artSet);
  const isPatternObj =
    typeof deckBack === 'object' && deckBack !== null && 'pattern' in deckBack;

  if (isPatternObj) {
    const patternVariant = (deckBack as { pattern: PatternVariant; tone?: PatternTone }).pattern;
    const patternTone = (deckBack as { pattern: PatternVariant; tone?: PatternTone }).tone ?? 'card';
    return (
      <Back
        {...withoutSx(slotProps?.back)}
        data-ui={cardPartIdentity('game-card-back', slotProps?.back?.['data-ui'])}
        aria-hidden="true"
        className={slotProps?.back?.className}
        css={[layerStyle, backMaterialStyle, slotProps?.back?.sx]}
      >
        <Pattern variant={patternVariant} tone={patternTone} />
      </Back>
    );
  }

  if (isRenderable(deckBack)) {
    return (
      <Back
        {...withoutSx(slotProps?.back)}
        data-ui={cardPartIdentity('game-card-back', slotProps?.back?.['data-ui'])}
        aria-hidden="true"
        className={slotProps?.back?.className}
        css={[layerStyle, artStyle, backMaterialStyle, slotProps?.back?.sx]}
      >
        {deckBack}
      </Back>
    );
  }

  return (
    <Back
      {...withoutSx(slotProps?.back)}
      data-ui={cardPartIdentity('game-card-back', slotProps?.back?.['data-ui'])}
      aria-hidden="true"
      className={slotProps?.back?.className}
      css={[layerStyle, backMaterialStyle, slotProps?.back?.sx]}
    >
      <Pattern variant="checks" tone="card" />
    </Back>
  );
}

interface CardFrontProps {
  deck: Deck;
  artSet?: string;
  slots?: GameCardSlots;
  value: GameCardValue;
  rankLabel?: string;
  /** The consumer asked for the printed face, so deck art stands aside. */
  printed?: boolean;
  slotProps?: GameCardProps['slotProps'];
}

function CardFront({ deck, value, rankLabel, artSet, printed = false, slots, slotProps }: CardFrontProps) {
  const Face = slots?.face ?? 'span';
  const customFace = resolveCardArt(deck, { suit: value.suit, rank: String(value.rank), artSet, mode: printed ? 'print' : 'art' });

  if (isRenderable(customFace)) {
    return (
      <Face
        {...withoutSx(slotProps?.face)}
        data-ui={cardPartIdentity('game-card-art', slotProps?.face?.['data-ui'])}
        aria-hidden="true"
        className={slotProps?.face?.className}
        css={[layerStyle, artStyle, slotProps?.face?.sx]}
      >
        {customFace}
      </Face>
    );
  }

  return <PrintedFace deck={deck} value={value} rankLabel={rankLabel} slots={slots} slotProps={slotProps} />;
}

interface PrintedFaceProps {
  deck: Deck;
  slots?: GameCardSlots;
  value: GameCardValue;
  rankLabel?: string;
  slotProps?: GameCardProps['slotProps'];
}

function PrintedFace({ deck, value, rankLabel, slots, slotProps }: PrintedFaceProps) {
  const markRef = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const mark = markRef.current;
    const face = mark?.parentElement;
    const view = mark?.ownerDocument.defaultView;
    if (!mark || !face || !view) return;
    const fit = () => {
      const style = view.getComputedStyle(face);
      const width = face.clientWidth - parseFloat(style.paddingInlineStart) - parseFloat(style.paddingInlineEnd);
      const height = face.clientHeight - parseFloat(style.paddingBlockStart) - parseFloat(style.paddingBlockEnd);
      const scale = Math.min(1, width / mark.offsetWidth, height / mark.offsetHeight);
      mark.style.setProperty('--game-card-mark-scale', String(Math.max(0, scale)));
    };
    fit();
    const observer = new view.ResizeObserver(fit);
    observer.observe(face);
    observer.observe(mark);
    mark.ownerDocument.fonts.addEventListener('loadingdone', fit);
    return () => {
      observer.disconnect();
      mark.ownerDocument.fonts.removeEventListener('loadingdone', fit);
    };
  }, [deck, value.suit, value.rank, rankLabel, slots?.face]);
  const Face = slots?.face ?? 'span';
  const suitConfig = deck.suits[value.suit];
  const rankConfig = deck.ranks[String(value.rank)];

  const hasGlyph =
    suitConfig?.glyph !== undefined && isRenderable(suitConfig.glyph) && suitConfig.glyph !== '';
  const suitGlyph = hasGlyph
    ? suitConfig.glyph
    : suitConfig?.label && suitConfig.label.length > 0
      ? suitConfig.label
      : value.suit;

  const rawRank = String(value.rank);
  const mark =
    rankLabel ??
    (rankConfig?.mark !== undefined && isRenderable(rankConfig.mark) && rankConfig.mark !== ''
      ? rankConfig.mark
      : rankConfig?.label && rankConfig.label.length > 0
        ? rankConfig.label
        : rawRank);

  const ink = suitConfig?.ink;

  return (
    <Face
      {...withoutSx(slotProps?.face)}
      data-ui={cardPartIdentity('game-card-print', slotProps?.face?.['data-ui'])}
      aria-hidden="true"
      className={slotProps?.face?.className}
      css={[layerStyle, printStyle, ink !== undefined && suitInkStyles[ink], slotProps?.face?.sx]}
    >
      {hasGlyph && <span css={[watermarkStyle, watermarkTopStyle]}>{suitGlyph}</span>}
      <span ref={markRef} data-card-mark="" css={markStyle}>
        <span>{mark}</span>
        <span>{suitGlyph}</span>
      </span>
      {hasGlyph && <span css={[watermarkStyle, watermarkBottomStyle]}>{suitGlyph}</span>}
    </Face>
  );
}
