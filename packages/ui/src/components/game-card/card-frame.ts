// The card frame and the face's paint, taken from the reference implementation (Trucoshi's
// cardFlipPaint and emojiCardPaint). Constants, not tokens: they describe one object's proportions
// rather than a scale the whole system shares.
import { vars } from '@jfrader/tokens/vars';

export const CARD_FRAME = {
  /** height = width × ratio */
  ratio: 1.48,
  /** border-radius = width / cornerDivisor */
  cornerDivisor: 13,
} as const;

export const CARD_PERSPECTIVE = {
  flip: vars.size.gameCardPerspective,
  flightPx: 600,
} as const;

export const CARD_FACE = {
  /** The centre mark is this share of the card's width, in container query units. */
  markWidthRatio: 0.35,
  /** The suit watermarks sit this far from the top and bottom edges. */
  watermarkInsetPercent: 3,
  /** Watermarks are a texture, not a second reading of the suit. */
  watermarkOpacity: 0.15,
  /** Horizontal breathing room around the centre mark. */
  contentPaddingPercent: 4,
} as const;
