'use client';

// Semantics: one `role="img"` root per card, named by `label`; the rank mark, the suit glyph and the
// suit watermarks are presentational children, so a screen reader hears the playing card once, in the
// consumer's own words. A face-down card renders no rank or suit data at all, and carries none in its
// attributes either: hiding a face visually does not keep information out of the DOM.
import type { ComponentPropsWithRef, ReactNode } from 'react';
import { vars } from '@jfrader/tokens/vars';
import { css, type Interpolation, type SerializedStyles, type Theme } from '../../styling/css';
import { WithSx, type SxProps } from '../../styling/sx';
import { isRenderable } from '../../utils/renderable';
import { CARD_FACE, CARD_FRAME } from './card-frame';
import { RANK_MARKS, SUIT_GLYPHS, SUIT_INK, type GameCardValue } from './decks';

export type GameCardSize = 'sm' | 'md' | 'lg';
export type GameCardFace = 'emoji' | 'back';

export interface GameCardPartProps {
  className?: string;
  css?: Interpolation<Theme>;
}

export interface GameCardProps
  extends Omit<ComponentPropsWithRef<'div'>, 'children' | 'color'>,
    SxProps {
  /**
   * Accessible name, in the page's language and the consumer's grammar: "as de oros", "king of
   * hearts". A face-down card names the back, never the value.
   */
  label: string;
  /** What the card is. Omit it, or set `face="back"`, for a card that stays hidden. */
  value?: GameCardValue;
  /** Defaults to `emoji` with a value and `back` without one. */
  face?: GameCardFace;
  /** Card width: `sm` 32px, `md` 72px, `lg` 112px. */
  size?: GameCardSize;
  /** Replaces the printed rank mark; the suit glyph stays. */
  rankLabel?: string;
  /** Draws the card as worn: out of play, or waiting. */
  dimmed?: boolean;
  /** Your own art for the face — an image, an SVG, anything. Replaces the emoji print. */
  children?: ReactNode;
  slotProps?: {
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

const backStyle = css({
  backgroundImage: `repeating-linear-gradient(135deg, ${vars.color.cardRed} 0 12%, ${vars.color.cardFace} 12% 24%)`,
});

const sizeStyles: Record<GameCardSize, SerializedStyles> = {
  sm: css({ '--game-card-width': vars.size.gameCardSm }),
  md: css({ '--game-card-width': vars.size.gameCardMd }),
  lg: css({ '--game-card-width': vars.size.gameCardLg }),
};

export function GameCard({
  ref,
  label,
  value,
  face,
  size = 'md',
  rankLabel,
  dimmed = false,
  children,
  slotProps,
  className,
  sx,
  ...rest
}: GameCardProps) {
  const resolvedFace: GameCardFace = face ?? (value === undefined ? 'back' : 'emoji');
  const hidden = resolvedFace === 'back' || value === undefined;

  return (
    <WithSx
      className={className}
      styles={[rootStyle, paperStyle, hidden && backMaterialStyle, sizeStyles[size], dimmed && dimmedStyle]}
      sx={sx}
    >
      {(rootClass) => (
        <div
          {...rest}
          ref={ref}
          role="img"
          aria-label={label}
          data-ui="game-card"
          data-face={resolvedFace}
          data-deck={hidden ? undefined : value.deck}
          className={rootClass}
        >
          {hidden ? (
            <span
              data-ui="game-card-back"
              aria-hidden="true"
              className={slotProps?.back?.className}
              css={[layerStyle, backMaterialStyle, backStyle, slotProps?.back?.css]}
            />
          ) : isRenderable(children) ? (
            <span
              data-ui="game-card-art"
              aria-hidden="true"
              className={slotProps?.face?.className}
              css={[layerStyle, artStyle, slotProps?.face?.css]}
            >
              {children}
            </span>
          ) : (
            <PrintedFace value={value} rankLabel={rankLabel} slotProps={slotProps} />
          )}
        </div>
      )}
    </WithSx>
  );
}

GameCard.displayName = 'GameCard';

interface PrintedFaceProps {
  value: GameCardValue;
  rankLabel?: string;
  slotProps?: GameCardProps['slotProps'];
}

function PrintedFace({ value, rankLabel, slotProps }: PrintedFaceProps) {
  const suit = SUIT_GLYPHS[value.suit];
  const mark = rankLabel ?? RANK_MARKS[value.rank];
  const ink = SUIT_INK[value.suit];

  return (
    <span
      data-ui="game-card-print"
      aria-hidden="true"
      className={slotProps?.face?.className}
      css={[layerStyle, printStyle, ink !== undefined && suitInkStyles[ink], slotProps?.face?.css]}
    >
      <span css={[watermarkStyle, watermarkTopStyle]}>{suit}</span>
      <span css={markStyle}>
        <span>{mark}</span>
        <span>{suit}</span>
      </span>
      <span css={[watermarkStyle, watermarkBottomStyle]}>{suit}</span>
    </span>
  );
}
