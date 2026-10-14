'use client';

// Semantics: one `role="img"` root per card, named by `label`; the rank mark, the suit glyph and the
// suit watermarks are presentational children, so a screen reader hears the playing card once, in the
// consumer's own words. A face-down card omits built-in rank, suit and deck data; consumer artwork
// remains visible, so consumers must keep private values out of their own art.
import type { ReactNode } from 'react';
import { vars } from '@jfrader/tokens/vars';
import { css, type Interpolation, type SerializedStyles, type Theme } from '../../styling/css';
import type { SxProps } from '../../styling/sx';
import { isRenderable } from '../../utils/renderable';
import { useDeck, type Deck } from '../deck';
import { Pattern, type PatternTone, type PatternVariant } from '../pattern';
import { CARD_FACE, CARD_FRAME } from './card-frame';
import type { GameCardValue } from './decks';
import { CardRoot, type GameCardRootCustomization, type GameCardRootProps, type GameCardRootSlotProps } from './game-card-root';

export type GameCardSize = 'sm' | 'md' | 'lg';
/**
 * Face to display. Defaults to `print` when `value` is present, or `back` when omitted.
 */
export type GameCardFace =
  | 'print'
  | 'back'
  /** @deprecated Use `'print'` instead. */
  | 'emoji';

/** Conventional backs by deck. Pass the matching value as `backPattern` to explicitly override the deck's back. */
export const CARD_BACK_PATTERNS = {
  spanish: 'diagonal',
  french: 'checks',
} as const;

export interface GameCardPartProps {
  className?: string;
  css?: Interpolation<Theme>;
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
  /** Defaults to `print` with a value and `back` without one. `'emoji'` is accepted as a deprecated alias for `'print'`. */
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
  slotProps?: {
    root?: GameCardRootSlotProps;
    face?: GameCardPartProps;
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
  const resolvedFace: 'print' | 'back' =
    face === 'back'
      ? 'back'
      : face === 'print' || face === 'emoji'
        ? 'print'
        : value === undefined
          ? 'back'
          : 'print';
  const hidden = resolvedFace === 'back' || value === undefined;
  const artProps = hidden ? slotProps?.back : slotProps?.face;

  return (
    <CardRoot
      {...rest}
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
        <span
          data-ui="game-card-art"
          aria-hidden="true"
          className={artProps?.className}
          css={[layerStyle, artStyle, hidden && backMaterialStyle, artProps?.css]}
        >
          {children}
        </span>
      ) : hidden ? (
        <CardBack deck={deck} backPattern={backPattern} slotProps={slotProps} />
      ) : (
        <CardFront deck={deck} value={value!} rankLabel={rankLabel} slotProps={slotProps} />
      )}
    </CardRoot>
  );
}

GameCard.displayName = 'GameCard';

interface CardBackProps {
  deck: Deck;
  backPattern?: PatternVariant;
  slotProps?: GameCardProps['slotProps'];
}

function CardBack({ deck, backPattern, slotProps }: CardBackProps) {
  if (backPattern !== undefined) {
    return (
      <span
        data-ui="game-card-back"
        aria-hidden="true"
        className={slotProps?.back?.className}
        css={[layerStyle, backMaterialStyle, slotProps?.back?.css]}
      >
        <Pattern variant={backPattern} tone="card" />
      </span>
    );
  }

  const deckBack = deck.back;
  const isPatternObj =
    typeof deckBack === 'object' && deckBack !== null && 'pattern' in deckBack;

  if (isPatternObj) {
    const patternVariant = (deckBack as { pattern: PatternVariant; tone?: PatternTone }).pattern;
    const patternTone = (deckBack as { pattern: PatternVariant; tone?: PatternTone }).tone ?? 'card';
    return (
      <span
        data-ui="game-card-back"
        aria-hidden="true"
        className={slotProps?.back?.className}
        css={[layerStyle, backMaterialStyle, slotProps?.back?.css]}
      >
        <Pattern variant={patternVariant} tone={patternTone} />
      </span>
    );
  }

  if (isRenderable(deckBack)) {
    return (
      <span
        data-ui="game-card-back"
        aria-hidden="true"
        className={slotProps?.back?.className}
        css={[layerStyle, artStyle, backMaterialStyle, slotProps?.back?.css]}
      >
        {deckBack}
      </span>
    );
  }

  return (
    <span
      data-ui="game-card-back"
      aria-hidden="true"
      className={slotProps?.back?.className}
      css={[layerStyle, backMaterialStyle, slotProps?.back?.css]}
    >
      <Pattern variant="checks" tone="card" />
    </span>
  );
}

interface CardFrontProps {
  deck: Deck;
  value: GameCardValue;
  rankLabel?: string;
  slotProps?: GameCardProps['slotProps'];
}

function CardFront({ deck, value, rankLabel, slotProps }: CardFrontProps) {
  const cardKey = `${value.suit}-${value.rank}`;
  const customFace = deck.faces?.[cardKey];

  if (isRenderable(customFace)) {
    return (
      <span
        data-ui="game-card-art"
        aria-hidden="true"
        className={slotProps?.face?.className}
        css={[layerStyle, artStyle, slotProps?.face?.css]}
      >
        {customFace}
      </span>
    );
  }

  return <PrintedFace deck={deck} value={value} rankLabel={rankLabel} slotProps={slotProps} />;
}

interface PrintedFaceProps {
  deck: Deck;
  value: GameCardValue;
  rankLabel?: string;
  slotProps?: GameCardProps['slotProps'];
}

function PrintedFace({ deck, value, rankLabel, slotProps }: PrintedFaceProps) {
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
    <span
      data-ui="game-card-print"
      aria-hidden="true"
      className={slotProps?.face?.className}
      css={[layerStyle, printStyle, ink !== undefined && suitInkStyles[ink], slotProps?.face?.css]}
    >
      {hasGlyph && <span css={[watermarkStyle, watermarkTopStyle]}>{suitGlyph}</span>}
      <span css={markStyle}>
        <span>{mark}</span>
        <span>{suitGlyph}</span>
      </span>
      {hasGlyph && <span css={[watermarkStyle, watermarkBottomStyle]}>{suitGlyph}</span>}
    </span>
  );
}
