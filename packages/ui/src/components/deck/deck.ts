import type { ReactNode } from 'react';
import type { PatternTone, PatternVariant } from '../pattern';

export interface DeckSuit {
  label: string;
  glyph?: ReactNode;
  ink?: 'red' | 'ink';
}

export interface DeckRank {
  label: string;
  mark?: ReactNode;
}

/**
 * A client-side deck definition containing suits, ranks, card art sets, and backs.
 *
 * A deck does not need suits or printed ranks. Omit `suits` and give each card its own rank:
 * art keys then default to the rank alone, and a card without a suit prints only its rank mark.
 *
 * `Deck` may carry non-serializable `ReactNode` artwork. Because card props
 * stay serializable across server/client boundaries, `<GameCard>` takes only a string deck id
 * (`value.deck`), which resolves against `<DeckProvider>` or the built-in decks (`spanish`, `french`).
 */
export interface Deck {
  id: string;
  /** Suits by key. Omit them for a suitless deck. */
  suits?: Readonly<Record<string, DeckSuit>>;
  /** Ranks by key. Omit them when every card carries its own artwork and label. */
  ranks?: Readonly<Record<string, DeckRank>>;
  /** The art key for a card. Defaults to `${suit}-${rank}`, or the rank alone for a card without a suit. */
  cardId?: (suit: string | undefined, rank: string) => string;
  /** Art for every card, before any named set. */
  art?: DeckArtSet;
  /** Named sets of card art. A set may cover only some cards. */
  artSets?: Readonly<Record<string, DeckArtSet>>;
  /** The set used when the consumer names none. */
  defaultArtSet?: string;
  /** The deck's back: a pattern with a tone, or consumer artwork. */
  back?: DeckBack;
  /** Backs by named set. A matching entry wins over `back`. */
  backs?: Readonly<Record<string, DeckBack>>;
}

export type DeckArt = ReactNode;
export type DeckArtSet = Readonly<Record<string, DeckArt>>;
export type DeckBack = ReactNode | { pattern: PatternVariant; tone?: PatternTone };

export interface CardArtRequest {
  /** Omitted for a deck of unique cards. */
  suit?: string;
  rank: string;
  /** The set the consumer asked this card to use. */
  artSet?: string;
  /** This one card's set, which wins over `artSet`. */
  cardArtSet?: string;
  /** Use `print` for the printed face instead of art. */
  mode?: 'art' | 'print';
}

/** The art key of a card, honouring the deck's `cardId`. */
export function cardArtId(deck: Deck, suit: string | undefined, rank: string): string {
  return deck.cardId?.(suit, rank) ?? (suit === undefined || suit === '' ? rank : `${suit}-${rank}`);
}

/** The art for a card, or undefined when it should render its printed face. */
export function resolveCardArt(deck: Deck, request: CardArtRequest): DeckArt | undefined {
  if (request.mode === 'print') return undefined;

  const id = cardArtId(deck, request.suit, request.rank);
  const set = request.cardArtSet ?? request.artSet ?? deck.defaultArtSet;
  const setArt = set === undefined ? undefined : deck.artSets?.[set]?.[id];
  return setArt === undefined ? deck.art?.[id] : setArt;
}

/** The back for a set, or the deck's default back. */
export function resolveDeckBack(deck: Deck, artSet?: string): DeckBack | undefined {
  const set = artSet ?? deck.defaultArtSet;
  const setBack = set === undefined ? undefined : deck.backs?.[set];
  return setBack === undefined ? deck.back : setBack;
}

/**
 * Identity helper for defining a typed `Deck` with autocomplete and type validation.
 */
export function defineDeck(deck: Deck): Deck {
  return deck;
}

/**
 * Built-in Spanish deck: oros, copas, espadas, bastos × 1–7, 10, 11, 12 (sota, caballo, rey).
 * Uses conventional diagonal back pattern in card tone.
 */
export const spanishDeck: Deck = defineDeck({
  id: 'spanish',
  suits: {
    oros: { label: 'oros', glyph: '💰' },
    copas: { label: 'copas', glyph: '🍷' },
    espadas: { label: 'espadas', glyph: '🗡️' },
    bastos: { label: 'bastos', glyph: '🌵' },
  },
  ranks: {
    '1': { label: '1', mark: '1' },
    '2': { label: '2', mark: '2' },
    '3': { label: '3', mark: '3' },
    '4': { label: '4', mark: '4' },
    '5': { label: '5', mark: '5' },
    '6': { label: '6', mark: '6' },
    '7': { label: '7', mark: '7' },
    '10': { label: '10', mark: '10' },
    '11': { label: '11', mark: '11' },
    '12': { label: '12', mark: '12' },
  },
  back: { pattern: 'diagonal', tone: 'card' },
});

/**
 * Built-in French deck: hearts, diamonds, clubs, spades × A, 2–10, J, Q, K.
 * Uses text-presentation glyphs (U+FE0E) with red/ink color split and conventional checks back pattern.
 */
export const frenchDeck: Deck = defineDeck({
  id: 'french',
  suits: {
    hearts: { label: 'hearts', glyph: '\u2665\uFE0E', ink: 'red' },
    diamonds: { label: 'diamonds', glyph: '\u2666\uFE0E', ink: 'red' },
    clubs: { label: 'clubs', glyph: '\u2663\uFE0E', ink: 'ink' },
    spades: { label: 'spades', glyph: '\u2660\uFE0E', ink: 'ink' },
  },
  ranks: {
    A: { label: 'A', mark: 'A' },
    '2': { label: '2', mark: '2' },
    '3': { label: '3', mark: '3' },
    '4': { label: '4', mark: '4' },
    '5': { label: '5', mark: '5' },
    '6': { label: '6', mark: '6' },
    '7': { label: '7', mark: '7' },
    '8': { label: '8', mark: '8' },
    '9': { label: '9', mark: '9' },
    '10': { label: '10', mark: '10' },
    J: { label: 'J', mark: 'J' },
    Q: { label: 'Q', mark: 'Q' },
    K: { label: 'K', mark: 'K' },
  },
  back: { pattern: 'checks', tone: 'card' },
});

export const BUILTIN_DECKS: Readonly<Record<string, Deck>> = {
  spanish: spanishDeck,
  french: frenchDeck,
};
