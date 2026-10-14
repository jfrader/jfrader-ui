// What each card is. Plain data on purpose: the library knows nothing about a game's rules, and no
// private protocol type crosses over.
export type SpanishSuit = 'oros' | 'copas' | 'espadas' | 'bastos';
export type FrenchSuit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
export type GameCardSuit = SpanishSuit | FrenchSuit;
/** Spanish cards print 1–7 and then 10, 11 and 12 for sota, caballo and rey. */
export type SpanishRank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 10 | 11 | 12;
export type FrenchRank = 'A' | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 'J' | 'Q' | 'K';
export type GameCardRank = SpanishRank | FrenchRank;

/**
 * Plain serializable representation of a playing card's identity.
 * `deck` names a registered deck id; omitting it resolves the deck from `<DeckProvider>`.
 */
export interface GameCardValue {
  deck?: string;
  suit: string;
  rank: string | number;
}

/**
 * Suit glyphs, keyed by suit (the two decks never share a suit name). The Spanish set is the one in
 * use today — oros 💰, copas 🍷, espadas 🗡️, bastos 🌵. The French set asks for text presentation
 * (U+FE0E) so the ink stays ours and the deck keeps its two-colour convention, which an
 * emoji-presentation glyph would take over.
 */
export const SUIT_GLYPHS: Record<GameCardSuit, string> = {
  oros: '💰',
  copas: '🍷',
  espadas: '🗡️',
  bastos: '🌵',
  hearts: '\u2665\uFE0E',
  diamonds: '\u2666\uFE0E',
  clubs: '\u2663\uFE0E',
  spades: '\u2660\uFE0E',
};

/** The French deck's red/black split. Spanish glyphs carry their own colour. */
export const SUIT_INK: Partial<Record<GameCardSuit, 'red' | 'ink'>> = {
  hearts: 'red',
  diamonds: 'red',
  clubs: 'ink',
  spades: 'ink',
};

/** Visible rank marks, shared by number. `rankLabel` on the card replaces the mark. */
export const RANK_MARKS: Record<GameCardRank, string> = {
  1: '1',
  2: '2',
  3: '3',
  4: '4',
  5: '5',
  6: '6',
  7: '7',
  8: '8',
  9: '9',
  10: '10',
  11: '11',
  12: '12',
  A: 'A',
  J: 'J',
  Q: 'Q',
  K: 'K',
};
