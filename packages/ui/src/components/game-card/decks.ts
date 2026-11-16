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
  /** Omit for a deck of unique cards. */
  suit?: string;
  rank: string | number;
}
