import type { CSSProperties } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { withLightTheme } from '../../testing/story-decorators';
import { GameCard, SUIT_GLYPHS, type GameCardSize, type GameCardSuit, type GameCardValue } from './index';

const SIZES = ['sm', 'md', 'lg'] as const satisfies readonly GameCardSize[];
const SIZE_PX = { sm: 32, md: 72, lg: 112 } as const;
const FRAME_RATIO = 1.48;

const SPANISH_SUITS = ['oros', 'copas', 'espadas', 'bastos'] as const;
const SPANISH_RANKS = [1, 2, 3, 4, 5, 6, 7, 10, 11, 12] as const;
const FRENCH_RANKS = ['A', 2, 3, 4, 5, 6, 7, 8, 9, 10, 'J', 'Q', 'K'] as const;
const FRENCH_SUITS = ['hearts', 'diamonds', 'clubs', 'spades'] as const;

// Fixture copy: naming a card is the consumer's job, in the page's language.
const SPANISH_RANK_NAMES: Record<string, string> = {
  '1': 'as',
  '2': 'dos',
  '3': 'tres',
  '4': 'cuatro',
  '5': 'cinco',
  '6': 'seis',
  '7': 'siete',
  '10': 'sota',
  '11': 'caballo',
  '12': 'rey',
};
const SUIT_NAMES: Record<string, string> = {
  oros: 'oros',
  copas: 'copas',
  espadas: 'espadas',
  bastos: 'bastos',
  hearts: 'hearts',
  diamonds: 'diamonds',
  clubs: 'clubs',
  spades: 'spades',
};
const cardLabel = (value: GameCardValue) => `${SPANISH_RANK_NAMES[String(value.rank)] ?? value.rank} de ${SUIT_NAMES[value.suit]}`;

const ACE_OF_OROS: GameCardValue = { deck: 'spanish', suit: 'oros', rank: 1 };
const QUEEN_OF_HEARTS: GameCardValue = { deck: 'french', suit: 'hearts', rank: 'Q' };
const BACK_LABEL = 'Carta boca abajo';

const gridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(32px, max-content))',
  gap: vars.space[2],
  alignItems: 'center',
} satisfies CSSProperties;

const rowStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: vars.space[4],
} satisfies CSSProperties;

const meta = {
  title: 'Games/GameCard',
  component: GameCard,
  tags: ['autodocs'],
  args: { label: cardLabel(ACE_OF_OROS), value: ACE_OF_OROS },
  argTypes: {
    size: { control: 'radio', options: SIZES },
    face: { control: 'radio', options: ['emoji', 'back'] },
    value: { control: 'object' },
  },
  parameters: {
    docs: {
      description: {
        component: 'Draw a playing card, face up from a Spanish or French deck, or face down.',
      },
    },
  },
} satisfies Meta<typeof GameCard>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const card = within(canvasElement).getByRole('img', { name: 'as de oros' });
    await expect(card).toHaveAttribute('data-deck', 'spanish');
    await expect(card).toHaveTextContent('1');
    await expect(card).toHaveTextContent(SUIT_GLYPHS.oros);
    // The print is decorative: the card is announced once, by its name.
    await expect(within(card).queryByRole('img')).toBeNull();
  },
};

export const SpanishDeck: Story = {
  render: () => (
    <div style={gridStyle}>
      {SPANISH_SUITS.flatMap((suit) =>
        SPANISH_RANKS.map((rank) => {
          const value: GameCardValue = { deck: 'spanish', suit, rank };
          return <GameCard key={`${suit}-${rank}`} size="sm" label={cardLabel(value)} value={value} />;
        }),
      )}
    </div>
  ),
  play: async ({ canvasElement }) => {
    const cards = canvasElement.querySelectorAll('[data-ui="game-card"]');
    await expect(cards).toHaveLength(40);
    const prints = Array.from(canvasElement.querySelectorAll<HTMLElement>('[data-ui="game-card-print"]'));
    for (const suit of SPANISH_SUITS) {
      const ofSuit = prints.filter((print) => print.textContent?.includes(SUIT_GLYPHS[suit]));
      await expect(ofSuit).toHaveLength(SPANISH_RANKS.length);
    }
  },
};

export const FrenchDeck: Story = {
  render: () => (
    <div style={gridStyle}>
      {FRENCH_SUITS.flatMap((suit) =>
        FRENCH_RANKS.map((rank) => {
          const value: GameCardValue = { deck: 'french', suit, rank };
          return <GameCard key={`${suit}-${rank}`} size="sm" label={`${rank} of ${suit}`} value={value} />;
        }),
      )}
    </div>
  ),
  play: async ({ canvasElement }) => {
    const cards = canvasElement.querySelectorAll('[data-ui="game-card"]');
    await expect(cards).toHaveLength(52);
    // The French deck keeps its two-colour convention: red suits take the card's red, black suits the ink.
    const printWith = (suit: GameCardSuit) =>
      Array.from(canvasElement.querySelectorAll<HTMLElement>('[data-ui="game-card-print"]')).find((print) =>
        print.textContent?.includes(SUIT_GLYPHS[suit]),
      )!;
    await expect(getComputedStyle(printWith('hearts')).color).toBe('rgb(200, 16, 46)');
    await expect(getComputedStyle(printWith('diamonds')).color).toBe('rgb(200, 16, 46)');
    await expect(getComputedStyle(printWith('spades')).color).toBe('rgba(0, 0, 0, 0.87)');
    await expect(getComputedStyle(printWith('clubs')).color).toBe('rgba(0, 0, 0, 0.87)');
  },
};

export const FaceDown: Story = {
  args: { label: BACK_LABEL, value: undefined, face: 'back' },
  render: (args) => (
    <div style={rowStyle}>
      <GameCard {...args} />
      {/* A card with no value is face down: the caller cannot leak what it does not pass. */}
      <GameCard label={BACK_LABEL} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const backs = within(canvasElement).getAllByRole('img', { name: BACK_LABEL });
    await expect(backs).toHaveLength(2);
    for (const back of backs) {
      await expect(back).toHaveAttribute('data-face', 'back');
      await expect(back).not.toHaveAttribute('data-deck');
      await expect(back.textContent).toBe('');
    }
  },
};

export const Sizes: Story = {
  render: (args) => (
    <div style={rowStyle}>
      {SIZES.map((size) => (
        <GameCard {...args} key={size} size={size} label={`${size} card`} />
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    for (const size of SIZES) {
      const rect = within(canvasElement).getByRole('img', { name: `${size} card` }).getBoundingClientRect();
      await expect(Math.round(rect.width)).toBe(SIZE_PX[size]);
      await expect(Math.round(rect.height)).toBe(Math.round(SIZE_PX[size] * FRAME_RATIO));
    }
  },
};

export const CustomArt: Story = {
  args: {
    label: 'Carta con arte propio',
    value: QUEEN_OF_HEARTS,
  },
  render: (args) => (
    <GameCard {...args}>
      <svg viewBox="0 0 40 60" aria-hidden="true">
        <rect width="40" height="60" fill={vars.color.surfaceInset} />
        <circle cx="20" cy="30" r="12" fill={vars.color.accent} />
      </svg>
    </GameCard>
  ),
  play: async ({ canvasElement }) => {
    const card = within(canvasElement).getByRole('img', { name: 'Carta con arte propio' });
    await expect(card.querySelector('svg')).not.toBeNull();
    await expect(card).not.toHaveTextContent(SUIT_GLYPHS.hearts);
  },
};

export const RankLabelAndDimmed: Story = {
  render: (args) => (
    <div style={rowStyle}>
      <GameCard {...args} rankLabel="Sota" label="sota de copas" value={{ deck: 'spanish', suit: 'copas', rank: 10 }} />
      <GameCard {...args} dimmed label="as de espadas" value={{ deck: 'spanish', suit: 'espadas', rank: 1 }} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('img', { name: 'sota de copas' })).toHaveTextContent('Sota');
    const dimmed = within(canvasElement).getByRole('img', { name: 'as de espadas' });
    await expect(getComputedStyle(dimmed).opacity).toBe('0.55');
  },
};

export const LightTheme: Story = {
  decorators: [withLightTheme],
  render: () => (
    <div style={rowStyle}>
      <GameCard size="lg" label={cardLabel(ACE_OF_OROS)} value={ACE_OF_OROS} />
      <GameCard size="lg" label="Q of hearts" value={QUEEN_OF_HEARTS} />
      <GameCard size="lg" label={BACK_LABEL} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    // A card is its own material: the paper face reads the same in both themes.
    const card = within(canvasElement).getByRole('img', { name: 'as de oros' });
    await expect(getComputedStyle(card).backgroundColor).toBe('rgb(244, 244, 245)');
  },
};
