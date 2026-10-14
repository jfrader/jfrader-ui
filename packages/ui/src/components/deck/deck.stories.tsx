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
    stars: {
      I: customArtSvg('STAR I'),
      II: customArtSvg('STAR II'),
    },
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

const solarDeck: Deck = defineDeck({
  id: 'solar',
  suits: {
    sun: { label: 'sun', glyph: '☀️', ink: 'red' },
    fire: { label: 'fire', glyph: '🔥', ink: 'red' },
  },
  ranks: {
    '1': { label: '1', mark: '1' },
    '2': { label: '2', mark: '2' },
  },
  faces: {
    sun: {
      '1': customArtSvg('SUN 1'),
      '2': customArtSvg('SUN 2'),
    },
    fire: {
      '1': customArtSvg('FIRE 1'),
      '2': customArtSvg('FIRE 2'),
    },
  },
  back: customBackArtSvg,
});

const crownedFrenchDeck: Deck = defineDeck({
  ...frenchDeck,
  id: 'crowned-french',
  faces: {
    hearts: {
      Q: customArtSvg('CROWNED Q'),
    },
  },
});

const meta = {
  title: 'Games/Deck',
  component: DeckProvider,
  tags: ['autodocs'],
  args: { children: null },
  parameters: {
    docs: {
      source: { language: 'tsx', code: `import { DeckProvider, defineDeck } from '@jfrader/ui/deck';
import { GameCard } from '@jfrader/ui/game-card';

export function BuiltInCards() {
  return (
    <>
      <GameCard label="Queen of hearts" value={{ deck: 'french', suit: 'hearts', rank: 'Q' }} />
      <DeckProvider default="spanish">
        <GameCard label="As de oros" value={{ suit: 'oros', rank: 1 }} />
      </DeckProvider>
    </>
  );
}

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
      usage: `## Defining decks
Use \`defineDeck\` to declare suits, ranks, per-card face art, and backs:
- \`id\`: Unique string identifier referenced by serializable card props (\`value.deck\`).
- \`suits\`: Suit definitions with a visual fallback \`label\`, optional \`glyph\` (\`ReactNode\`), and optional \`ink\` (\`'red' | 'ink'\`).
- \`ranks\`: Rank definitions with a visual fallback \`label\` and optional \`mark\` (\`ReactNode\`). \`GameCard label\` names the whole card for assistive technology.
- \`faces\`: Optional nested map of per-card artwork \`faces[suit][rank]\`. Partial or complete artwork sets are supported.
- \`back\`: A patterned back (\`{ pattern, tone? }\`) or consumer \`ReactNode\` artwork.

## Factory deck overrides
To override individual card artwork on a built-in deck, spread \`frenchDeck\` or \`spanishDeck\` and provide nested \`faces\` for specific suits and ranks:
\`\`\`tsx
const customFrench = defineDeck({
  ...frenchDeck,
  id: 'custom-french',
  faces: {
    hearts: {
      Q: <CustomQueenArtwork />,
    },
  },
});
\`\`\`

## Built-in decks
Two standard decks are registered automatically:
- \`spanishDeck\` (\`id: 'spanish'\`): oros, copas, espadas, bastos × 1–7, 10, 11, 12, with diagonal backs.
- \`frenchDeck\` (\`id: 'french'\`): hearts, diamonds, clubs, spades × A, 2–10, J, Q, K, with checks backs.

## Serialization and client boundary
\`Deck\` is a client-side definition that may hold non-serializable \`ReactNode\` elements (custom SVG art, icons).
Card props stay serializable: \`<GameCard label="One of stars" value={{ deck: 'my-deck', suit: 'stars', rank: 'I' }} />\` passes only string ids.
The definitions are supplied via \`<DeckProvider decks={[myDeck]}>\`. Set \`backLabel\` on the provider to name backs for \`FlipGameCard\` shorthand. \`GameCard\` still requires its own \`label\`.

## Import
- Import from \`@jfrader/ui/deck\`. Decks are an opt-in subpath and are not re-exported by the package root.

## Resolution order
1. **Deck identity**: Explicit \`value.deck\` → provider's \`default\` → built-in French deck. Unknown ids throw \`UnknownDeckError\` naming the missing deck.
2. **Card face**: Consumer \`children\` → per-card \`faces[suit][rank]\` art → printed face (suit glyph + rank mark) → raw rank/suit ids as text. It never produces an empty card.
3. **Card back**: Explicit \`backPattern\` prop → deck \`back\` (pattern or artwork) → checks pattern.`,
    },
  },
} satisfies Meta<typeof DeckProvider>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * Show Spanish and French cards beside a French card back. Built-in decks need no provider.
 */
export const Default: Story = {
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { GameCard } from '@jfrader/ui/game-card';

export function BuiltInCards() {
  return (
    <>
      <GameCard label="as de oros" value={{ deck: 'spanish', suit: 'oros', rank: 1 }} />
      <GameCard label="Q of hearts" value={{ deck: 'french', suit: 'hearts', rank: 'Q' }} />
      <GameCard label="Card back" />
    </>
  );
}`,
      },
    },
  },
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
 * Show custom face artwork beside a printed card and a dots back.
 * Cards without face artwork use the deck's rank mark, suit glyph and ink.
 */
export const CustomDeck: Story = {
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { DeckProvider, defineDeck } from '@jfrader/ui/deck';
import { GameCard } from '@jfrader/ui/game-card';

const celestialDeck = defineDeck({
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
    stars: {
      I: <FaceArt text="STAR I" />,
      II: <FaceArt text="STAR II" />,
    },
  },
  back: { pattern: 'dots', tone: 'accent' },
});

function FaceArt({ text }: { text: string }) {
  return <svg viewBox="0 0 72 106" width="100%" height="100%" aria-hidden="true">
    <rect width="100%" height="100%" fill="var(--ui-color-surfaceInset)" />
    <circle cx="36" cy="53" r="22" fill="var(--ui-color-cardRed)" />
    <text x="36" y="58" textAnchor="middle" fill="var(--ui-color-cardFace)" fontSize="11" fontWeight="bold">{text}</text>
  </svg>;
}

export function CustomDeckExample() {
  return (
    <DeckProvider decks={[celestialDeck]} default="celestial">
      <GameCard label="One of stars" value={{ suit: 'stars', rank: 'I' }} />
      <GameCard label="Two of stars" value={{ suit: 'stars', rank: 'II' }} />
      <GameCard label="Three of stars" value={{ suit: 'stars', rank: 'III' }} />
      <GameCard label="Face down celestial" />
    </DeckProvider>
  );
}`,
      },
    },
  },
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
 * A complete custom deck with suits, ranks, all artwork, and custom back artwork.
 */
export const CompleteOwnDeck: Story = {
  name: 'Complete own deck',
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { DeckProvider, defineDeck } from '@jfrader/ui/deck';
import { GameCard } from '@jfrader/ui/game-card';

const solarDeck = defineDeck({
  id: 'solar',
  suits: {
    sun: { label: 'sun', glyph: '☀️', ink: 'red' },
    fire: { label: 'fire', glyph: '🔥', ink: 'red' },
  },
  ranks: {
    '1': { label: '1', mark: '1' },
    '2': { label: '2', mark: '2' },
  },
  faces: {
    sun: {
      '1': <FaceArt text="SUN 1" />,
      '2': <FaceArt text="SUN 2" />,
    },
    fire: {
      '1': <FaceArt text="FIRE 1" />,
      '2': <FaceArt text="FIRE 2" />,
    },
  },
  back: <svg viewBox="0 0 72 106" width="100%" height="100%" aria-hidden="true">
    <rect width="100%" height="100%" fill="var(--ui-color-surfaceInset)" />
    <polygon points="36,20 54,76 18,76" fill="var(--ui-color-accent)" />
  </svg>,
});

function FaceArt({ text }: { text: string }) {
  return <svg viewBox="0 0 72 106" width="100%" height="100%" aria-hidden="true">
    <rect width="100%" height="100%" fill="var(--ui-color-surfaceInset)" />
    <circle cx="36" cy="53" r="22" fill="var(--ui-color-cardRed)" />
    <text x="36" y="58" textAnchor="middle" fill="var(--ui-color-cardFace)" fontSize="11" fontWeight="bold">{text}</text>
  </svg>;
}

export function CompleteDeckExample() {
  return (
    <DeckProvider decks={[solarDeck]} default="solar">
      <GameCard label="One of sun" value={{ suit: 'sun', rank: '1' }} />
      <GameCard label="Two of sun" value={{ suit: 'sun', rank: '2' }} />
      <GameCard label="One of fire" value={{ suit: 'fire', rank: '1' }} />
      <GameCard label="Two of fire" value={{ suit: 'fire', rank: '2' }} />
      <GameCard label="Hidden solar card" />
    </DeckProvider>
  );
}`,
      },
    },
  },
  render: () => (
    <DeckProvider decks={[solarDeck]} default="solar">
      <div style={rowStyle}>
        <GameCard label="One of sun" value={{ suit: 'sun', rank: '1' }} />
        <GameCard label="Two of sun" value={{ suit: 'sun', rank: '2' }} />
        <GameCard label="One of fire" value={{ suit: 'fire', rank: '1' }} />
        <GameCard label="Two of fire" value={{ suit: 'fire', rank: '2' }} />
        <GameCard label="Hidden solar card" />
      </div>
    </DeckProvider>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const sun1 = canvas.getByRole('img', { name: 'One of sun' });
    const sun2 = canvas.getByRole('img', { name: 'Two of sun' });
    const fire1 = canvas.getByRole('img', { name: 'One of fire' });
    const fire2 = canvas.getByRole('img', { name: 'Two of fire' });
    const back = canvas.getByRole('img', { name: 'Hidden solar card' });

    for (const card of [sun1, sun2, fire1, fire2]) {
      await expect(card.querySelector('[data-ui="game-card-art"]')).not.toBeNull();
      await expect(card.querySelector('[data-ui="game-card-print"]')).toBeNull();
    }
    await expect(sun1).toHaveTextContent('SUN 1');
    await expect(sun2).toHaveTextContent('SUN 2');
    await expect(fire1).toHaveTextContent('FIRE 1');
    await expect(fire2).toHaveTextContent('FIRE 2');

    await expect(back).toHaveAttribute('data-face', 'back');
    await expect(back.querySelector('polygon')).not.toBeNull();
  },
};

/**
 * Override a single face on a built-in factory deck while preserving other printed cards.
 */
export const FactoryDeckOverride: Story = {
  name: 'Factory deck override',
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { DeckProvider, defineDeck, frenchDeck } from '@jfrader/ui/deck';
import { GameCard } from '@jfrader/ui/game-card';

const crownedFrench = defineDeck({
  ...frenchDeck,
  id: 'crowned-french',
  faces: {
    hearts: {
      Q: <svg viewBox="0 0 72 106" width="100%" height="100%" aria-hidden="true">
        <rect width="100%" height="100%" fill="var(--ui-color-surfaceInset)" />
        <circle cx="36" cy="53" r="22" fill="var(--ui-color-cardRed)" />
        <text x="36" y="58" textAnchor="middle" fill="var(--ui-color-cardFace)" fontSize="11" fontWeight="bold">CROWNED Q</text>
      </svg>,
    },
  },
});

export function FactoryOverrideExample() {
  return (
    <DeckProvider decks={[crownedFrench]} default="crowned-french">
      <GameCard label="Crowned queen" value={{ suit: 'hearts', rank: 'Q' }} />
      <GameCard label="King of hearts" value={{ suit: 'hearts', rank: 'K' }} />
      <GameCard label="Ace of spades" value={{ suit: 'spades', rank: 'A' }} />
      <GameCard label="Face down card" />
    </DeckProvider>
  );
}`,
      },
    },
  },
  render: () => (
    <DeckProvider decks={[crownedFrenchDeck]} default="crowned-french">
      <div style={rowStyle}>
        <GameCard label="Crowned queen" value={{ suit: 'hearts', rank: 'Q' }} />
        <GameCard label="King of hearts" value={{ suit: 'hearts', rank: 'K' }} />
        <GameCard label="Ace of spades" value={{ suit: 'spades', rank: 'A' }} />
        <GameCard label="Face down card" />
      </div>
    </DeckProvider>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const queen = canvas.getByRole('img', { name: 'Crowned queen' });
    await expect(queen.querySelector('[data-ui="game-card-art"]')).not.toBeNull();
    await expect(queen).toHaveTextContent('CROWNED Q');

    const king = canvas.getByRole('img', { name: 'King of hearts' });
    await expect(king.querySelector('[data-ui="game-card-print"]')).not.toBeNull();
    await expect(king.querySelector('[data-ui="game-card-art"]')).toBeNull();
    await expect(king).toHaveTextContent('K');
    await expect(king).toHaveTextContent('\u2665\uFE0E');

    const ace = canvas.getByRole('img', { name: 'Ace of spades' });
    await expect(ace.querySelector('[data-ui="game-card-print"]')).not.toBeNull();
    await expect(ace).toHaveTextContent('A');
    await expect(ace).toHaveTextContent('\u2660\uFE0E');

    const back = canvas.getByRole('img', { name: 'Face down card' });
    await expect(back).toHaveAttribute('data-face', 'back');
    await expect(back.querySelector('[data-ui="pattern"]')).toHaveAttribute('data-variant', 'checks');
  },
};

/**
 * A face-down card inside `<DeckProvider default="spanish">` inherits the Spanish diagonal back
 * beside a face-up Spanish card.
 */
export const SpanishBackInheritance: Story = {
  name: 'Spanish faces and backs',
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { DeckProvider } from '@jfrader/ui/deck';
import { GameCard } from '@jfrader/ui/game-card';

export function SpanishBackInheritance() {
  return (
    <DeckProvider default="spanish">
      <GameCard label="as de oros" value={{ suit: 'oros', rank: 1 }} />
      <GameCard label="carta boca abajo" />
    </DeckProvider>
  );
}`,
      },
    },
  },
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
 * Use your own artwork for a deck's card backs.
 */
export const CustomBackArtwork: Story = {
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { DeckProvider, defineDeck } from '@jfrader/ui/deck';
import { GameCard } from '@jfrader/ui/game-card';

const fantasyDeck = defineDeck({
  id: 'fantasy',
  suits: { runes: { label: 'runes', glyph: 'ᚱ', ink: 'ink' } },
  ranks: { '1': { label: '1', mark: '1' } },
  back: <svg viewBox="0 0 72 106" width="100%" height="100%" aria-hidden="true">
    <rect width="100%" height="100%" fill="var(--ui-color-surfaceInset)" />
    <polygon points="36,20 54,76 18,76" fill="var(--ui-color-accent)" />
  </svg>,
});

export function CustomBackExample() {
  return (
    <DeckProvider decks={[fantasyDeck]} default="fantasy">
      <GameCard label="one of runes" value={{ suit: 'runes', rank: '1' }} />
      <GameCard label="hidden fantasy card" />
    </DeckProvider>
  );
}`,
      },
    },
  },
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
 * Show rank and suit ids as text when the deck has no matching marks.
 */
export const DegradationToRawText: Story = {
  name: 'Unlisted rank and suit',
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { GameCard } from '@jfrader/ui/game-card';

<GameCard label="unknown card" value={{ suit: 'comets', rank: '99' }} />`,
      },
    },
  },
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
  parameters: { docs: { source: { language: 'tsx', code: `import { DeckProvider, defineDeck } from '@jfrader/ui/deck';
import { GameCard } from '@jfrader/ui/game-card';
import { ThemeRoot } from '@jfrader/ui/theme-root';
import { vars } from '@jfrader/tokens/vars';

function FaceArt({ text }: { text: string }) {
  return <svg viewBox="0 0 72 106" width="100%" height="100%" aria-hidden="true">
    <rect width="100%" height="100%" fill={vars.color.surfaceInset} />
    <circle cx="36" cy="53" r="22" fill={vars.color.cardRed} />
    <text x="36" y="58" textAnchor="middle" fill={vars.color.cardFace} fontSize="11" fontWeight="bold">{text}</text>
  </svg>;
}
const celestialDeck = defineDeck({
  id: 'celestial',
  suits: { stars: { label: 'stars', glyph: '⭐', ink: 'red' }, moons: { label: 'moons', glyph: '🌙', ink: 'ink' } },
  ranks: { I: { label: 'I', mark: 'I' }, II: { label: 'II', mark: 'II' }, III: { label: 'III', mark: 'III' } },
  faces: { stars: { I: <FaceArt text="STAR I" />, II: <FaceArt text="STAR II" /> } },
  back: { pattern: 'dots', tone: 'accent' },
});

<ThemeRoot theme="light"><DeckProvider decks={[celestialDeck]} default="celestial">
  <div style={{ display: 'flex', alignItems: 'center', gap: vars.space[4] }}>
    <GameCard label="One of stars" value={{ suit: 'stars', rank: 'I' }} />
    <GameCard label="Two of stars" value={{ suit: 'stars', rank: 'II' }} />
    <GameCard label="Three of stars" value={{ suit: 'stars', rank: 'III' }} />
    <GameCard label="Face down celestial" />
  </div>
</DeckProvider></ThemeRoot>` } } },
  decorators: [withLightTheme],
};

/**
 * An unregistered deck id throws `UnknownDeckError` naming the missing deck.
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

export const HyphenatedFaceKeys: Story = {
  tags: ['!autodocs'],
  render: () => (
    <DeckProvider default="hyphens" decks={[defineDeck({
      id: 'hyphens',
      suits: { 'a-b': { label: 'First suit', glyph: '★' }, a: { label: 'Second suit', glyph: '☆' } },
      ranks: { c: { label: 'First rank', mark: 'I' }, 'b-c': { label: 'Second rank', mark: 'II' } },
      faces: { 'a-b': { c: customArtSvg('FIRST') }, a: { 'b-c': customArtSvg('SECOND') } },
      back: { pattern: 'dots' },
    })]}>
      <div style={rowStyle}>
        <GameCard label="First artwork" value={{ suit: 'a-b', rank: 'c' }} />
        <GameCard label="Second artwork" value={{ suit: 'a', rank: 'b-c' }} />
        <GameCard label="Printed fallback" value={{ suit: 'a', rank: 'c' }} />
        <GameCard label="Raw fallback" value={{ suit: 'unknown', rank: 'missing' }} />
      </div>
    </DeckProvider>
  ),
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('img', { name: 'First artwork' })).toHaveTextContent('FIRST');
    await expect(canvas.getByRole('img', { name: 'Second artwork' })).toHaveTextContent('SECOND');
    const printed = canvas.getByRole('img', { name: 'Printed fallback' });
    await expect(printed.querySelector('[data-ui="game-card-print"]')).not.toBeNull();
    await expect(printed).toHaveTextContent('I');
    await expect(printed).toHaveTextContent('☆');
    const raw = canvas.getByRole('img', { name: 'Raw fallback' });
    await expect(raw).toHaveTextContent('missing');
    await expect(raw).toHaveTextContent('unknown');
  },
};
