import type { CSSProperties } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { withLightTheme } from '../../testing/story-decorators';
import { GameCard } from '../game-card';
import { defineDeck, DeckProvider, frenchDeck, spanishDeck, UnknownDeckError, useDeck, type Deck } from './index';

const rowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: vars.space[4],
};

const customArtSvg = (text: string) => (
  <svg viewBox="0 0 72 106" width="100%" height="100%" aria-hidden="true">
    <rect width="100%" height="100%" fill={vars.color.surfaceInset} />
    <circle cx="36" cy="53" r="22" fill={vars.color.cardRed} />
    <text x="36" y="58" textAnchor="middle" fill={vars.color.cardFace} fontSize="11" fontWeight="bold">
      {text}
    </text>
  </svg>
);

const customBackArtSvg = (
  <svg viewBox="0 0 72 106" width="100%" height="100%" aria-hidden="true">
    <rect width="100%" height="100%" fill={vars.color.surfaceInset} />
    <polygon points="36,20 54,76 18,76" fill={vars.color.accent} />
  </svg>
);

const celestialDeck: Deck = defineDeck({
  id: 'celestial',
  suits: {
    stars: { label: 'stars', glyph: '⭐', ink: 'red' },
    moons: { label: 'moons', glyph: '🌙', ink: 'ink' },
  },
  ranks: {
    I: { label: 'I', mark: 'I' },
    II: { label: 'II', mark: 'II' },
    III: { label: 'III', mark: 'III' },
  },
  faces: {
    'stars-I': customArtSvg('STAR I'),
    'stars-II': customArtSvg('STAR II'),
    // Note: 'stars-III' art is intentionally omitted to test honest degradation
  },
  back: { pattern: 'dots', tone: 'accent' },
});

const fantasyDeck: Deck = defineDeck({
  id: 'fantasy',
  suits: {
    runes: { label: 'runes', glyph: 'ᚱ', ink: 'ink' },
  },
  ranks: {
    '1': { label: '1', mark: '1' },
  },
  back: customBackArtSvg,
});

const meta = {
  title: 'Games/Deck',
  component: DeckProvider,
  tags: ['autodocs'],
  args: { children: null },
  parameters: {
    docs: {
      source: { language: 'tsx', code: `import { DeckProvider, defineDeck, GameCard } from '@jfrader/ui';

const stars = defineDeck({
  id: 'stars',
  suits: { stars: { label: 'stars', glyph: '★', ink: 'red' } },
  ranks: { I: { label: 'one', mark: 'I' } },
  back: { pattern: 'dots', tone: 'accent' },
});

export function StarCard() {
  return (
    <DeckProvider decks={[stars]} default="stars">
      <GameCard label="One of stars" value={{ suit: 'stars', rank: 'I' }} />
    </DeckProvider>
  );
}` },
      description: {
        component: 'Declare card decks with suits, ranks, custom artwork, and backs.',
      },
      usage: `### Defining decks with defineDeck
Use \`defineDeck\` to declare suits, ranks, per-card face art, and back configuration with full type safety:
- \`id\`: Unique string identifier referenced by serializable card props (\`value.deck\`).
- \`suits\`: Suit definitions with a visual fallback \`label\`, optional \`glyph\` (\`ReactNode\`), and optional \`ink\` (\`'red' | 'ink'\`).
- \`ranks\`: Rank definitions with a visual fallback \`label\` and optional \`mark\` (\`ReactNode\`). \`GameCard label\` names the whole card for assistive technology.
- \`faces\`: Optional map of per-card artwork keyed \`\${suit}-\${rank}\`. Partial artwork sets are supported.
- \`back\`: A patterned back (\`{ pattern, tone? }\`) or consumer \`ReactNode\` artwork.

### Built-in decks
Two standard decks are registered automatically:
- \`spanishDeck\` (\`id: 'spanish'\`): oros, copas, espadas, bastos × 1–7, 10, 11, 12, with diagonal backs.
- \`frenchDeck\` (\`id: 'french'\`): hearts, diamonds, clubs, spades × A, 2–10, J, Q, K, with checks backs.

### Serialization and client boundary
\`Deck\` is a client-side definition that may hold non-serializable \`ReactNode\` elements (custom SVG art, icons).
Card props stay serializable: \`<GameCard label="One of stars" value={{ deck: 'my-deck', suit: 'stars', rank: 'I' }} />\` passes only string ids.
The definitions are supplied via \`<DeckProvider decks={[myDeck]}>\`. Set \`backLabel\` on the provider to name backs for \`FlipGameCard\` shorthand. \`GameCard\` still requires its own \`label\`.

### Resolution order
1. **Deck identity**: Explicit \`value.deck\` → provider's \`default\` → built-in French deck. Unknown ids throw a clear error naming the missing deck.
2. **Card face**: Consumer \`children\` → per-card \`faces[\`\${suit}-\${rank}\`]\` art → printed face (suit glyph + rank mark) → raw rank/suit ids as text. It never produces an empty card.
3. **Card back**: Explicit \`backPattern\` prop → deck \`back\` (pattern or artwork) → checks pattern.`,
    },
  },
} satisfies Meta<typeof DeckProvider>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * Built-in Spanish and French decks resolve without any explicit provider configuration.
 * Setting `default="spanish"` makes cards without an explicit `deck` use the Spanish deck and its diagonal back.
 */
export const Default: Story = {
  render: () => (
    <div style={rowStyle}>
      <GameCard label="as de oros" value={{ deck: 'spanish', suit: 'oros', rank: 1 }} />
      <GameCard label="Q of hearts" value={{ deck: 'french', suit: 'hearts', rank: 'Q' }} />
      <GameCard label="Card back" />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const spanishCard = canvas.getByRole('img', { name: 'as de oros' });
    await expect(spanishCard).toHaveAttribute('data-deck', 'spanish');
    await expect(spanishCard).toHaveTextContent('1');
    await expect(spanishCard).toHaveTextContent('💰');

    const frenchCard = canvas.getByRole('img', { name: 'Q of hearts' });
    await expect(frenchCard).toHaveAttribute('data-deck', 'french');
    await expect(frenchCard).toHaveTextContent('Q');
    await expect(frenchCard).toHaveTextContent('\u2665\uFE0E');

    const backCard = canvas.getByRole('img', { name: 'Card back' });
    await expect(backCard).toHaveAttribute('data-face', 'back');
    await expect(backCard.querySelector('[data-ui="pattern"]')).toHaveAttribute('data-variant', 'checks');
  },
};

/**
 * A custom deck with invented suits, ranks, inks, and a custom back pattern.
 * The card with missing face art degrades honestly to the printed face (mark + glyph + ink) rather than a blank card.
 */
export const CustomDeck: Story = {
  render: () => (
    <DeckProvider decks={[celestialDeck]} default="celestial">
      <div style={rowStyle}>
        {/* Has custom face artwork */}
        <GameCard label="One of stars" value={{ suit: 'stars', rank: 'I' }} />
        {/* Has custom face artwork */}
        <GameCard label="Two of stars" value={{ suit: 'stars', rank: 'II' }} />
        {/* Art is missing in deck.faces: degrades to printed mark 'III' and glyph '⭐' */}
        <GameCard label="Three of stars" value={{ suit: 'stars', rank: 'III' }} />
        {/* Face-down card inherits celestial deck's dots back in accent tone */}
        <GameCard label="Face down celestial" />
      </div>
    </DeckProvider>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Cards with custom artwork
    const cardOne = canvas.getByRole('img', { name: 'One of stars' });
    await expect(cardOne).toHaveAttribute('data-deck', 'celestial');
    await expect(cardOne.querySelector('[data-ui="game-card-art"]')).not.toBeNull();
    await expect(cardOne).toHaveTextContent('STAR I');

    const cardTwo = canvas.getByRole('img', { name: 'Two of stars' });
    await expect(cardTwo).toHaveAttribute('data-deck', 'celestial');
    await expect(cardTwo.querySelector('[data-ui="game-card-art"]')).not.toBeNull();
    await expect(cardTwo).toHaveTextContent('STAR II');

    // Card with missing face art: degrades to printed face, not blank
    const cardThree = canvas.getByRole('img', { name: 'Three of stars' });
    await expect(cardThree).toHaveAttribute('data-deck', 'celestial');
    const print = cardThree.querySelector('[data-ui="game-card-print"]');
    await expect(print).not.toBeNull();
    await expect(cardThree.querySelector('[data-ui="game-card-art"]')).toBeNull();
    await expect(cardThree).toHaveTextContent('III');
    await expect(cardThree).toHaveTextContent('⭐');
    if (print) {
      await expect(getComputedStyle(print).color).toBe('rgb(200, 16, 46)');
    }

    // Face-down card inherits celestial dots back with accent tone
    const backCard = canvas.getByRole('img', { name: 'Face down celestial' });
    await expect(backCard).toHaveAttribute('data-face', 'back');
    await expect(backCard).not.toHaveAttribute('data-deck');
    const pattern = backCard.querySelector('[data-ui="pattern"]');
    await expect(pattern).toHaveAttribute('data-variant', 'dots');
  },
};

/**
 * A face-down card inside `<DeckProvider default="spanish">` inherits the Spanish diagonal back
 * beside a face-up Spanish card.
 */
export const SpanishBackInheritance: Story = {
  render: () => (
    <DeckProvider default="spanish">
      <div style={rowStyle}>
        <GameCard label="as de oros" value={{ suit: 'oros', rank: 1 }} />
        <GameCard label="carta boca abajo" />
      </div>
    </DeckProvider>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const faceUp = canvas.getByRole('img', { name: 'as de oros' });
    await expect(faceUp).toHaveAttribute('data-deck', 'spanish');
    await expect(faceUp).toHaveTextContent('1');
    await expect(faceUp).toHaveTextContent('💰');

    const faceDown = canvas.getByRole('img', { name: 'carta boca abajo' });
    await expect(faceDown).toHaveAttribute('data-face', 'back');
    await expect(faceDown).not.toHaveAttribute('data-deck');
    await expect(faceDown.textContent).toBe('');
    const pattern = faceDown.querySelector('[data-ui="pattern"]');
    await expect(pattern).toHaveAttribute('data-variant', 'diagonal');
  },
};

/**
 * A custom deck whose back is arbitrary consumer artwork rather than an SVG pattern.
 */
export const CustomBackArtwork: Story = {
  render: () => (
    <DeckProvider decks={[fantasyDeck]} default="fantasy">
      <div style={rowStyle}>
        <GameCard label="one of runes" value={{ suit: 'runes', rank: '1' }} />
        <GameCard label="hidden fantasy card" />
      </div>
    </DeckProvider>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const faceUp = canvas.getByRole('img', { name: 'one of runes' });
    await expect(faceUp).toHaveTextContent('1');
    await expect(faceUp).toHaveTextContent('ᚱ');

    const faceDown = canvas.getByRole('img', { name: 'hidden fantasy card' });
    await expect(faceDown).toHaveAttribute('data-face', 'back');
    await expect(faceDown.querySelector('polygon')).not.toBeNull();
  },
};

/**
 * When suit and rank marks are entirely absent from the deck, rendering degrades honestly
 * to raw text ids instead of rendering a blank card.
 */
export const DegradationToRawText: Story = {
  render: () => (
    <div style={rowStyle}>
      <GameCard label="unknown card" value={{ suit: 'comets', rank: '99' }} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const card = within(canvasElement).getByRole('img', { name: 'unknown card' });
    await expect(card).toHaveTextContent('99');
    await expect(card).toHaveTextContent('comets');
  },
};

export const CustomDeckLightTheme: Story = {
  ...CustomDeck,
  decorators: [withLightTheme],
};

/**
 * Resolving an unregistered deck id throws a clear UnknownDeckError naming the missing deck.
 */
export const UnknownDeckThrows: Story = {
  tags: ['!autodocs'],
  render: () => {
    let errorName = '';
    let errorMessage = '';
    try {
      useDeck('atlantis');
    } catch (err) {
      if (err instanceof UnknownDeckError) {
        errorName = err.name;
        errorMessage = err.message;
      }
    }
    return (
      <div data-ui="unknown-deck-error" data-error-name={errorName}>
        {errorMessage}
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const errorEl = canvasElement.querySelector('[data-ui="unknown-deck-error"]');
    await expect(errorEl).not.toBeNull();
    await expect(errorEl).toHaveAttribute('data-error-name', 'UnknownDeckError');
    await expect(errorEl).toHaveTextContent('Unknown deck: "atlantis"');
  },
};
