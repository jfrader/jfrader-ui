import type { CSSProperties } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, within } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { withLightTheme } from '../../testing/story-decorators';
import { CARD_BACK_PATTERNS, GameCard, type GameCardRootProps, type GameCardSize, type GameCardSuit, type GameCardValue } from './index';
import { css } from '../../styling/css';
import { WithSx } from '../../styling/sx';

const SIZES = ['sm', 'md', 'lg'] as const satisfies readonly GameCardSize[];
const SIZE_PX = { sm: 32, md: 72, lg: 112 } as const;
const FRAME_RATIO = 1.48;

const SPANISH_SUITS = ['oros', 'copas', 'espadas', 'bastos'] as const;
const SPANISH_RANKS = [1, 2, 3, 4, 5, 6, 7, 10, 11, 12] as const;
const FRENCH_RANKS = ['A', 2, 3, 4, 5, 6, 7, 8, 9, 10, 'J', 'Q', 'K'] as const;
const FRENCH_SUITS = ['hearts', 'diamonds', 'clubs', 'spades'] as const;
const EXPECTED_SUITS: Record<GameCardSuit, string> = {
  oros: '💰',
  copas: '🍷',
  espadas: '🗡️',
  bastos: '🌵',
  hearts: '\u2665\uFE0E',
  diamonds: '\u2666\uFE0E',
  clubs: '\u2663\uFE0E',
  spades: '\u2660\uFE0E',
};

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
  inlineSize: `calc(${vars.size.gameCardSm} * ${FRENCH_RANKS.length} + ${vars.space[2]} * ${FRENCH_RANKS.length - 1})`,
  maxInlineSize: '100%',
  marginInline: 'auto',
  gridTemplateColumns: `repeat(auto-fit, minmax(${vars.size.gameCardSm}, max-content))`,
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
  args: { label: 'Q of hearts', value: QUEEN_OF_HEARTS },
  argTypes: {
    size: { control: 'radio', options: SIZES },
    face: { control: 'radio', options: ['print', 'back'] },
    value: { control: 'object' },
  },
  parameters: {
    docs: {
      description: {
        component: 'Show a French or Spanish playing card with a red-and-paper back or your own artwork.',
      },
      source: {
        language: 'tsx',
        code: `import { GameCard } from '@jfrader/ui/game-card';

<GameCard
  label="Queen of hearts"
  value={{ deck: 'french', suit: 'hearts', rank: 'Q' }}
/>`,
      },
      usage: `### Setup
- Import from \`@jfrader/ui/game-card\`. GameCard is an opt-in subpath and is not re-exported by the package root.

### Faces and artwork
- Omit \`value\` or set \`face="back"\` to hide built-in rank and suit data. Back patterns come from the deck (e.g. Spanish diagonal, poker checks) or explicit \`backPattern\`, and \`children\` replaces either face’s artwork.

### Root customization
Use \`component\` or \`slots.root\` to replace the root. Declare replacements outside render, forward all props and ref to one div, and apply your material before the supplied \`className\`. \`slots.root\` wins when both are supplied. \`slotProps.root\` overrides root props; className and style merge. Style order is material → slot → consumer css → consumer sx.`,
    },
  },
} satisfies Meta<typeof GameCard>;

export default meta;

type Story = StoryObj<typeof meta>;

async function expectDeckGrid(cards: NodeListOf<Element>) {
  const firstCard = cards[0];
  const grid = firstCard?.parentElement;
  if (!firstCard || !grid) throw new Error('Missing deck grid');
  const bounds = grid.getBoundingClientRect();
  const cardWidth = firstCard.getBoundingClientRect().width;
  const gap = Number.parseFloat(getComputedStyle(grid).columnGap);
  const columns = Math.floor((bounds.width + gap) / (cardWidth + gap));
  const actualColumns = new Set(Array.from(cards, (card) => card.getBoundingClientRect().x)).size;
  await expect(actualColumns).toBe(columns);
  await expect(actualColumns).toBeGreaterThan(1);
  await expect(actualColumns).toBeLessThanOrEqual(FRENCH_RANKS.length);
  for (const card of cards) {
    const rect = card.getBoundingClientRect();
    await expect(rect.left).toBeGreaterThanOrEqual(bounds.left);
    await expect(rect.right).toBeLessThanOrEqual(bounds.right + 1);
  }
}

/** Spanish diagonal backs and poker checks beside their faces. */
export const BackPatterns: Story = {
  name: 'Deck backs',
  render: () => (
    <div style={rowStyle}>
      {Object.entries(CARD_BACK_PATTERNS).map(([deck, pattern]) => (
        <div key={deck} style={rowStyle}>
          <GameCard data-test-pattern={pattern} value={deck === 'spanish' ? ACE_OF_OROS : QUEEN_OF_HEARTS} label={`${deck} face`} backPattern={pattern} />
          <GameCard data-test-pattern={pattern} label={`${deck} back`} backPattern={pattern} />
        </div>
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    for (const pattern of Object.values(CARD_BACK_PATTERNS)) {
      const card = canvasElement.querySelector(`[data-face="back"][data-test-pattern="${pattern}"]`);
      if (!card) throw new Error('Missing patterned back');
      await expect(card.querySelector('[data-ui="pattern"]')).toHaveAttribute('data-variant', pattern);
      await expect(card).not.toHaveAttribute('data-deck');
    }
  },
};

export const BackPatternsLightTheme: Story = { ...BackPatterns, name: 'Deck backs light theme', decorators: [withLightTheme] };

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const card = within(canvasElement).getByRole('img', { name: 'Q of hearts' });
    await expect(card).toHaveAttribute('data-deck', 'french');
    await expect(card).toHaveTextContent('Q');
    await expect(card).toHaveTextContent(EXPECTED_SUITS.hearts);
    // The print is decorative: the card is announced once, by its name.
    await expect(within(card).queryByRole('img')).toBeNull();
  },
};

const customMaterial = css({ backgroundColor: vars.color.cardFace, border: `1px solid ${vars.color.cardInk}`, opacity: 0.9 });
function CardMaterial({ className, ...props }: GameCardRootProps) {
  return <WithSx styles={customMaterial} className={className}>
    {(classes) => <div {...props} className={classes} data-custom-material="true" />}
  </WithSx>;
}

export const RootCustomization: Story = {
  args: { ref: fn(), component: CardMaterial, slots: { root: CardMaterial }, 'data-ui': 'consumer game-card consumer',
    title: 'Host title', className: 'host-class', style: { marginInlineStart: 1, marginBlockStart: 2 },
    slotProps: { root: { 'data-ui': 'slot consumer', title: 'Slot title', className: 'slot-class',
      style: { marginInlineStart: 3 }, css: css({ opacity: 0.8 }) } },
    css: css({ opacity: 0.7 }), sx: { opacity: 0.6 } },
  play: async ({ args, canvas }) => {
    const card = canvas.getByRole('img', { name: 'Q of hearts' });
    await expect(card).toHaveAttribute('data-ui', 'game-card consumer slot');
    await expect(card).toHaveAttribute('data-custom-material', 'true');
    await expect(card).toHaveAttribute('title', 'Slot title');
    await expect(card).toHaveClass('host-class', 'slot-class');
    await expect(args.ref).toHaveBeenCalledWith(card);
    await expect(card.style.marginInlineStart).toBe('3px');
    await expect(card.style.marginBlockStart).toBe('2px');
    await expect(getComputedStyle(card).opacity).toBe('0.6');
    await expect(card.getBoundingClientRect().width).toBe(72);
    await expect(card.querySelector('[data-ui="game-card-print"]')).not.toBeNull();
  },
};

export const FrenchDeck: Story = {
  parameters: { layout: 'padded' },
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
    await expectDeckGrid(cards);
    for (const suit of FRENCH_SUITS) {
      for (const rank of FRENCH_RANKS) {
        const card = within(canvasElement).getByRole('img', { name: `${rank} of ${suit}` });
        const print = card.querySelector<HTMLElement>('[data-ui="game-card-print"]');
        await expect(print).toHaveTextContent(`${EXPECTED_SUITS[suit]}${rank}${EXPECTED_SUITS[suit]}${EXPECTED_SUITS[suit]}`);
        if (print === null) throw new Error('Missing printed face');
        await expect(getComputedStyle(print).color).toBe(
          suit === 'hearts' || suit === 'diamonds' ? 'rgb(200, 16, 46)' : 'rgba(0, 0, 0, 0.87)',
        );
      }
    }
  },
};

export const SpanishDeck: Story = {
  parameters: { layout: 'padded' },
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
    await expectDeckGrid(cards);
    for (const suit of SPANISH_SUITS) {
      for (const rank of SPANISH_RANKS) {
        const card = within(canvasElement).getByRole('img', { name: cardLabel({ deck: 'spanish', suit, rank }) });
        await expect(card.querySelector('[data-ui="game-card-print"]')).toHaveTextContent(
          `${EXPECTED_SUITS[suit]}${rank}${EXPECTED_SUITS[suit]}${EXPECTED_SUITS[suit]}`,
        );
      }
    }
  },
};

export const FaceDown: Story = {
  name: 'Face down',
  args: { label: BACK_LABEL, value: QUEEN_OF_HEARTS, face: 'back', rankLabel: 'SECRET-RANK' },
  render: (args) => (
    <div style={rowStyle}>
      <GameCard {...args} />
      {/* A card with no value is face down: the caller cannot leak what it does not pass. */}
      <GameCard label={BACK_LABEL} />
      <GameCard label={BACK_LABEL} face="back" value={ACE_OF_OROS} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const backs = within(canvasElement).getAllByRole('img', { name: BACK_LABEL });
    await expect(backs).toHaveLength(3);
    for (const back of backs) {
      await expect(back).toHaveAttribute('data-face', 'back');
      await expect(back).not.toHaveAttribute('data-deck');
      await expect(back.textContent).toBe('');
      const paint = back.querySelector('[data-ui="game-card-back"]');
      if (paint === null) throw new Error('Missing back paint');
      await expect(getComputedStyle(back).backgroundColor).toBe(getComputedStyle(paint).backgroundColor);
      await expect(getComputedStyle(paint).backgroundColor).toBe('rgb(200, 16, 46)');
      await expect(getComputedStyle(paint, '::after').content).toBe('none');
      const attributes = [back, ...back.querySelectorAll('*')]
        .flatMap((element) => Array.from(element.attributes, (attribute) => attribute.value))
        .join(' ');
      for (const secret of ['french', 'hearts', 'spanish', 'oros', 'Q', EXPECTED_SUITS.hearts, 'SECRET-RANK']) {
        await expect(attributes).not.toContain(secret);
      }
    }
    // Queen of hearts (French deck) and card with no value (defaults to French) inherit checks
    await expect(backs[0]!.querySelector('[data-ui="pattern"]')).toHaveAttribute('data-variant', CARD_BACK_PATTERNS.french);
    await expect(backs[1]!.querySelector('[data-ui="pattern"]')).toHaveAttribute('data-variant', CARD_BACK_PATTERNS.french);
    // Ace of oros (Spanish deck) inherits Spanish diagonal back from its deck
    await expect(backs[2]!.querySelector('[data-ui="pattern"]')).toHaveAttribute('data-variant', CARD_BACK_PATTERNS.spanish);
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
      const card = within(canvasElement).getByRole('img', { name: `${size} card` });
      const rect = card.getBoundingClientRect();
      await expect(Math.round(rect.width)).toBe(SIZE_PX[size]);
      await expect(Math.round(rect.height)).toBe(Math.round(SIZE_PX[size] * FRAME_RATIO));
      const print = card.querySelector<HTMLElement>('[data-ui="game-card-print"]');
      if (print === null) throw new Error('Missing printed face');
      await expect(Number.parseFloat(getComputedStyle(print).fontSize)).toBeCloseTo((SIZE_PX[size] - 2) * 0.35, 2);
    }
  },
};

export const NarrowFlexRow: Story = {
  tags: ['!autodocs'],
  render: (args) => (
    <div style={{ ...rowStyle, inlineSize: vars.size.gameCardLg }}>
      <GameCard {...args} size="md" label="First card" />
      <GameCard {...args} size="md" label="Second card" />
    </div>
  ),
  play: async ({ canvasElement }) => {
    for (const card of within(canvasElement).getAllByRole('img')) {
      const rect = card.getBoundingClientRect();
      await expect(rect.width).toBe(72);
      await expect(rect.height).toBeCloseTo(106.56, 1);
    }
  },
};

export const OptionalArt: Story = {
  tags: ['!autodocs'],
  render: (args) => (
    <div style={rowStyle}>
      <GameCard {...args} label="Null art" children={null} />
      <GameCard {...args} label="False art" children={false} />
      <GameCard {...args} label="True art" children={true} />
      <GameCard {...args} label="Zero art" children={0} />
      <GameCard label="Zero back art" face="back" children={0} />
      <GameCard label="False back art" face="back" children={false} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    for (const name of ['Null art', 'False art', 'True art']) {
      const card = canvas.getByRole('img', { name });
      await expect(card.querySelector('[data-ui="game-card-print"]')).not.toBeNull();
      await expect(card).toHaveTextContent(`Q${EXPECTED_SUITS.hearts}`);
    }
    const zero = canvas.getByRole('img', { name: 'Zero art' });
    await expect(zero.querySelector('[data-ui="game-card-art"]')).toHaveTextContent('0');
    await expect(zero.querySelector('[data-ui="game-card-print"]')).toBeNull();
    const zeroBack = canvas.getByRole('img', { name: 'Zero back art' });
    await expect(zeroBack.querySelector('[data-ui="game-card-art"]')).toHaveTextContent('0');
    await expect(zeroBack.querySelector('[data-ui="pattern"]')).toBeNull();
    await expect(canvas.getByRole('img', { name: 'False back art' }).querySelector('[data-ui="pattern"]')).toHaveAttribute('data-variant', CARD_BACK_PATTERNS.french);
  },
};

export const CustomArt: Story = {
  name: 'Custom artwork',
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
    await expect(card).not.toHaveTextContent(EXPECTED_SUITS.hearts);
  },
};

/** Custom artwork replaces the pattern even when the card is face down. */
export const CustomBackArt: Story = {
  args: { label: BACK_LABEL, face: 'back', backPattern: CARD_BACK_PATTERNS.spanish },
  render: (args) => (
    <GameCard {...args}>
      <svg viewBox="0 0 40 60" aria-hidden="true">
        <rect width="40" height="60" fill={vars.color.cardRed} />
        <circle cx="20" cy="30" r="12" fill={vars.color.cardFace} />
      </svg>
    </GameCard>
  ),
  play: async ({ canvasElement }) => {
    const card = within(canvasElement).getByRole('img', { name: BACK_LABEL });
    await expect(card.querySelector('[data-ui="game-card-art"] svg')).not.toBeNull();
    await expect(card.querySelector('[data-ui="pattern"]')).toBeNull();
    await expect(card).not.toHaveAttribute('data-deck');
  },
};

export const CustomBackArtLightTheme: Story = { ...CustomBackArt, decorators: [withLightTheme] };

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
      <GameCard size="lg" label="Q of hearts" value={QUEEN_OF_HEARTS} />
      <GameCard size="lg" label={cardLabel(ACE_OF_OROS)} value={ACE_OF_OROS} />
      <GameCard size="lg" label={BACK_LABEL} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    // A card is its own material: the paper face reads the same in both themes.
    const card = within(canvasElement).getByRole('img', { name: 'Q of hearts' });
    await expect(getComputedStyle(card).backgroundColor).toBe('rgb(244, 244, 245)');
    const back = within(canvasElement).getByRole('img', { name: BACK_LABEL });
    const paint = back.querySelector('[data-ui="game-card-back"]');
    if (paint === null) throw new Error('Missing back paint');
    await expect(getComputedStyle(back).backgroundColor).toBe(getComputedStyle(paint).backgroundColor);
  },
};
