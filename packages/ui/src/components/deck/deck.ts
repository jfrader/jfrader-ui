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
 * A client-side deck definition containing suits, ranks, optional per-card face art, and back configuration.
 *
 * `Deck` may carry non-serializable `ReactNode` artwork (in `faces` or `back`). Because card props
 * stay serializable across server/client boundaries, `<GameCard>` takes only a string deck id
 * (`value.deck`), which resolves against `<DeckProvider>` or the built-in decks (`spanish`, `french`).
 */
export interface Deck {
  id: string;
  suits: Readonly<Record<string, DeckSuit>>;
  ranks: Readonly<Record<string, DeckRank>>;
  /** Per-card artwork, partial, nested suit -> rank -> ReactNode. */
  faces?: Readonly<Record<string, Readonly<Record<string, ReactNode>>>>;
  /** The deck's back: a Pattern with a tone, or consumer artwork. */
  back?: { pattern: PatternVariant; tone?: PatternTone } | ReactNode;
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
