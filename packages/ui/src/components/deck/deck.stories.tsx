import type { ComponentProps } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { styled } from '../../styling/styled';
import { withLightTheme } from '../../testing/story-decorators';
import { GameCard } from '../game-card';
import { GameTable } from '../game-table';
import { GameHand } from '../game-hand';
import { FlipGameCard } from '../flip-game-card';
import {
  cardArtId, defineDeck, DeckProvider, frenchDeck, resolveCardArt, resolveDeckBack,
  spanishDeck, UnknownDeckError, useDeck, type CardArtRequest, type Deck,
} from './index';

const Row = styled('div')({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: vars.space[4],
});

function FaceArt({ text }: { text: string }) {
  return (
    <svg viewBox="0 0 72 106" width="100%" height="100%" aria-hidden="true">
      <rect width="100%" height="100%" fill={vars.color.surfaceInset} />
      <circle cx="36" cy="53" r="22" fill={vars.color.cardRed} />
      <text x="36" y="58" textAnchor="middle" fill={vars.color.cardFace} fontSize="11" fontWeight="bold">
        {text}
      </text>
    </svg>
  );
}

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
  art: { 'stars-II': <FaceArt text="BASE II" /> },
  artSets: {
    'release-2/spooky': {
      'stars-I': <FaceArt text="SPOOKY I" />,
      'moons-I': <FaceArt text="SPOOKY MOON" />,
    },
    rare: { 'stars-I': <FaceArt text="RARE I" /> },
  },
  defaultArtSet: 'release-2/spooky',
  back: { pattern: 'dots', tone: 'accent' },
  backs: { rare: { pattern: 'waves', tone: 'card' } },
});

const meta = {
  title: 'Games/Deck',
  component: DeckProvider,
  tags: ['autodocs'],
  args: { children: null },
  parameters: {
    docs: {
      description: { component: 'Declare card decks with suits, ranks, card art sets and backs.' },
      source: {
        language: 'tsx',
        code: `import { DeckProvider } from '@jfrader/ui/deck';
import { GameCard } from '@jfrader/ui/game-card';

<DeckProvider default="spanish">
  <GameCard label="As de oros" value={{ suit: 'oros', rank: 1 }} />
</DeckProvider>`,
      },
      usage: `## Card art
Declare a deck with \`defineDeck\`. It returns the same object without runtime validation.
- \`suits\` provide labels, optional glyphs and optional \`red\` or \`ink\` ink.
- \`ranks\` provide labels and optional printed marks.
- \`art\` maps card ids to artwork. The default id is \`suit-rank\`; supply \`cardId(suit, rank)\` for another scheme.
- \`artSets\` holds named, partial art maps, such as \`release-2/spooky\` or \`rare\`.
- \`defaultArtSet\` selects a set when a request names none.

Call \`resolveCardArt(deck, { suit, rank, artSet, cardArtSet, mode })\`.
The selected set is \`cardArtSet ?? artSet ?? deck.defaultArtSet\`.
A missing set or card falls back to \`art\`, then returns \`undefined\` for a printed face.
\`mode: 'print'\` skips all artwork. Pass resolved artwork as \`GameCard\` children; omit children for the printed face.

## Backs
\`back\` accepts artwork or \`{ pattern, tone? }\`. \`backs\` maps set names to backs.
\`resolveDeckBack(deck, artSet)\` uses the requested set (or \`defaultArtSet\`), then falls back to \`back\`.

## Built-in decks and registration
Spanish and French decks contain no art and print their faces. Spanish uses diagonal backs; French uses checks.
Register custom definitions with \`DeckProvider decks={[deck]}\` and set \`default\` to their id.
Explicit \`value.deck\` wins over the provider default, then the built-in French deck. Unknown ids throw \`UnknownDeckError\`.
Keep artwork in client modules; card values reference decks by string id.
Set \`backLabel\` on the provider to name hidden cards for \`FlipGameCard\` shorthand.

## Import
Import decks and resolvers from \`@jfrader/ui/deck\`. They are not re-exported from the package root.`,
    },
  },
} satisfies Meta<typeof DeckProvider>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Built-in decks print their rank marks and suit glyphs without artwork. */
export const Default: Story = {
  render: () => (
    <Row>
      <GameCard label="As de oros" value={{ deck: 'spanish', suit: 'oros', rank: 1 }} />
      <GameCard label="Queen of hearts" value={{ deck: 'french', suit: 'hearts', rank: 'Q' }} />
      <GameCard label="Card back" />
    </Row>
  ),
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('img', { name: 'As de oros' })).toHaveTextContent('💰');
    await expect(canvas.getByRole('img', { name: 'As de oros' })).toHaveTextContent('1');
    await expect(canvas.getByRole('img', { name: 'Queen of hearts' })).toHaveTextContent('Q');
    await expect(canvas.getByRole('img', { name: 'Queen of hearts' })).toHaveTextContent('♥');
    await expect(canvas.getByRole('img', { name: 'Card back' }).querySelector('[data-ui="pattern"]'))
      .toHaveAttribute('data-variant', 'checks');
    await expect(resolveCardArt(spanishDeck, { suit: 'oros', rank: '1' })).toBeUndefined();
    await expect(resolveCardArt(frenchDeck, { suit: 'hearts', rank: 'Q' })).toBeUndefined();
  },
};

/** A named set, one rare card, base art, a printed fallback and an explicit printed face. */
export const CustomDeck: Story = {
  name: 'Named art sets',
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { DeckProvider, defineDeck, resolveCardArt } from '@jfrader/ui/deck';
import { GameCard } from '@jfrader/ui/game-card';

const deck = defineDeck({
  id: 'stars',
  suits: { stars: { label: 'stars', glyph: '★' } },
  ranks: { I: { label: 'one', mark: 'I' }, II: { label: 'two', mark: 'II' } },
  artSets: {
    'release-2/spooky': { 'stars-I': <span>Spooky star</span> },
    rare: { 'stars-I': <span>Rare star</span> },
  },
  defaultArtSet: 'release-2/spooky',
});

export function Stars() {
  return <DeckProvider decks={[deck]} default="stars">
    <GameCard label="Rare star" value={{ suit: 'stars', rank: 'I' }}>
      {resolveCardArt(deck, { suit: 'stars', rank: 'I', artSet: 'release-2/spooky', cardArtSet: 'rare' })}
    </GameCard>
    <GameCard label="Two of stars" value={{ suit: 'stars', rank: 'II' }}>
      {resolveCardArt(deck, { suit: 'stars', rank: 'II' })}
    </GameCard>
  </DeckProvider>;
}`,
      },
    },
  },
  render: () => (
    <DeckProvider decks={[celestialDeck]} default="celestial">
      <Row>
        <GameCard label="Spooky star" value={{ suit: 'stars', rank: 'I' }} artSet="release-2/spooky" />
        <GameCard label="Rare star" value={{ suit: 'stars', rank: 'I' }} artSet="release-2/spooky" cardArtSets={{ 'stars-I': 'rare' }} />
        <GameCard label="Base star" value={{ suit: 'stars', rank: 'II' }} />
        <GameCard label="Three of stars" value={{ suit: 'stars', rank: 'III' }} />
        <GameCard label="Printed star" value={{ suit: 'stars', rank: 'I' }} artSet="release-2/spooky" face="print" />
      </Row>
    </DeckProvider>
  ),
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('img', { name: 'Spooky star' })).toHaveTextContent('SPOOKY I');
    const rare = canvas.getByRole('img', { name: 'Rare star' });
    await expect(rare).toHaveTextContent('RARE I');
    await expect(rare).not.toHaveTextContent('SPOOKY I');
    await expect(canvas.getByRole('img', { name: 'Base star' })).toHaveTextContent('BASE II');
    const missing = canvas.getByRole('img', { name: 'Three of stars' });
    await expect(missing.querySelector('[data-ui="game-card-print"]')).not.toBeNull();
    await expect(missing).toHaveTextContent('III');
    await expect(missing).toHaveTextContent('⭐');
    const printed = canvas.getByRole('img', { name: 'Printed star' });
    await expect(printed).not.toHaveTextContent('SPOOKY');
    await expect(printed.querySelector('[data-ui="game-card-print"]')).not.toBeNull();
  },
};

export const CustomDeckLightTheme: Story = {
  ...CustomDeck,
  name: 'Named art sets · light',
  decorators: [withLightTheme],
};

/** Use the Spanish deck's diagonal back without declaring any artwork. */
export const SpanishBackInheritance: Story = {
  name: 'Spanish faces and backs',
  parameters: { docs: { source: { code: `import { DeckProvider } from '@jfrader/ui/deck';
import { GameCard } from '@jfrader/ui/game-card';

<DeckProvider default="spanish">
  <GameCard label="As de oros" value={{ suit: 'oros', rank: 1 }} />
  <GameCard label="Carta boca abajo" />
</DeckProvider>` } } },
  render: () => (
    <DeckProvider default="spanish">
      <Row>
        <GameCard label="As de oros" value={{ suit: 'oros', rank: 1 }} />
        <GameCard label="Carta boca abajo" />
      </Row>
    </DeckProvider>
  ),
  play: async ({ canvas }) => {
    const back = canvas.getByRole('img', { name: 'Carta boca abajo' });
    await expect(back).toHaveAttribute('data-face', 'back');
    await expect(back).not.toHaveAttribute('data-deck');
    await expect(back.querySelector('[data-ui="pattern"]')).toHaveAttribute('data-variant', 'diagonal');
  },
};

/** Override one built-in card while keeping the other printed faces. */
export const FactoryDeckOverride: Story = {
  parameters: { docs: { source: { code: `import { DeckProvider, defineDeck, frenchDeck, resolveCardArt } from '@jfrader/ui/deck';
import { GameCard } from '@jfrader/ui/game-card';

const deck = defineDeck({ ...frenchDeck, id: 'crowned-french', art: { 'hearts-Q': <span>CROWNED Q</span> } });

<DeckProvider decks={[deck]} default="crowned-french">
  <GameCard label="Crowned queen" value={{ suit: 'hearts', rank: 'Q' }}>
    {resolveCardArt(deck, { suit: 'hearts', rank: 'Q' })}
  </GameCard>
  <GameCard label="King of hearts" value={{ suit: 'hearts', rank: 'K' }} />
</DeckProvider>` } } },
  render: () => (
    <DeckProvider default="crowned-french" decks={[defineDeck({
      ...frenchDeck,
      id: 'crowned-french',
      art: { 'hearts-Q': <FaceArt text="CROWNED Q" /> },
    })]}>
      <Row>
        <GameCard label="Crowned queen" value={{ suit: 'hearts', rank: 'Q' }} artSet="crowns" />
        <GameCard label="King of hearts" value={{ suit: 'hearts', rank: 'K' }} artSet="crowns" />
      </Row>
    </DeckProvider>
  ),
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('img', { name: 'Crowned queen' })).toHaveTextContent('CROWNED Q');
    const king = canvas.getByRole('img', { name: 'King of hearts' });
    await expect(king.querySelector('[data-ui="game-card-print"]')).not.toBeNull();
    await expect(king).toHaveTextContent('K');
  },
};

/** Supply artwork for a back without adding any card-face art. */
export const CustomBackArtwork: Story = {
  parameters: { docs: { source: { code: `import { DeckProvider, defineDeck } from '@jfrader/ui/deck';
import { GameCard } from '@jfrader/ui/game-card';

const deck = defineDeck({
  id: 'fantasy',
  suits: { runes: { label: 'runes', glyph: 'ᚱ' } },
  ranks: { '1': { label: 'one', mark: '1' } },
  back: <span>RUNES</span>,
});

<DeckProvider decks={[deck]} default="fantasy">
  <GameCard label="One of runes" value={{ suit: 'runes', rank: '1' }} />
  <GameCard label="Hidden rune" />
</DeckProvider>` } } },
  render: () => (
    <DeckProvider default="fantasy" decks={[defineDeck({
      id: 'fantasy',
      suits: { runes: { label: 'runes', glyph: 'ᚱ' } },
      ranks: { '1': { label: 'one', mark: '1' } },
      back: <FaceArt text="RUNES" />,
    })]}>
      <Row>
        <GameCard label="One of runes" value={{ suit: 'runes', rank: '1' }} />
        <GameCard label="Hidden rune" />
      </Row>
    </DeckProvider>
  ),
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('img', { name: 'One of runes' })).toHaveTextContent('ᚱ');
    await expect(canvas.getByRole('img', { name: 'One of runes' })).toHaveTextContent('1');
    await expect(canvas.getByRole('img', { name: 'Hidden rune' })).toHaveTextContent('RUNES');
  },
};

/** Unlisted ranks and suits print their ids as text. */
export const DegradationToRawText: Story = {
  name: 'Unlisted rank and suit',
  parameters: { docs: { source: { code: `import { GameCard } from '@jfrader/ui/game-card';

<GameCard label="Unknown card" value={{ suit: 'comets', rank: '99' }} />` } } },
  render: () => <GameCard label="Unknown card" value={{ suit: 'comets', rank: '99' }} />,
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('img', { name: 'Unknown card' })).toHaveTextContent('comets');
    await expect(canvas.getByRole('img', { name: 'Unknown card' })).toHaveTextContent('99');
  },
};

export const ResolverContract: Story = {
  tags: ['!autodocs'],
  render: Default.render,
  play: async () => {
    const request = { suit: 'stars', rank: 'I' };
    await expect(defineDeck(celestialDeck)).toBe(celestialDeck);
    await expect(cardArtId(celestialDeck, 'stars', 'I')).toBe('stars-I');
    await expect(resolveCardArt(celestialDeck, request)).toBe(celestialDeck.artSets?.['release-2/spooky']?.['stars-I']);
    await expect(resolveCardArt(celestialDeck, { ...request, artSet: 'rare' })).toBe(celestialDeck.artSets?.rare?.['stars-I']);
    await expect(resolveCardArt(celestialDeck, { ...request, artSet: 'rare', cardArtSet: 'missing' })).toBeUndefined();
    await expect(resolveCardArt(celestialDeck, { suit: 'stars', rank: 'II', artSet: 'missing' })).toBe(celestialDeck.art?.['stars-II']);
    await expect(resolveCardArt(celestialDeck, { ...request, mode: 'print', cardArtSet: 'rare' })).toBeUndefined();
    await expect(resolveDeckBack(celestialDeck, 'rare')).toBe(celestialDeck.backs?.rare);
    await expect(resolveDeckBack(celestialDeck, 'missing')).toBe(celestialDeck.back);
    await expect(resolveDeckBack(celestialDeck)).toBe(celestialDeck.back);
    await expect(resolveDeckBack({ ...celestialDeck, defaultArtSet: 'rare' })).toBe(celestialDeck.backs?.rare);

    const custom = defineDeck({
      ...celestialDeck,
      cardId: (suit: string, rank: string) => JSON.stringify([suit, rank]),
      art: { '["a-b","c"]': 'FIRST', '["a","b-c"]': 'SECOND' },
    });
    await expect(cardArtId(custom, 'a-b', 'c')).toBe('["a-b","c"]');
    await expect(resolveCardArt(custom, { suit: 'a-b', rank: 'c' })).toBe('FIRST');
    await expect(resolveCardArt(custom, { suit: 'a', rank: 'b-c' })).toBe('SECOND');

    const falsy = defineDeck({
      ...celestialDeck,
      art: { 'stars-I': 'BASE' },
      artSets: { zero: { 'stars-I': 0 }, empty: { 'stars-I': '' }, null: { 'stars-I': null }, false: { 'stars-I': false } },
      backs: { zero: 0, null: null },
    });
    await expect(resolveCardArt(falsy, { ...request, artSet: 'zero' })).toBe(0);
    await expect(resolveCardArt(falsy, { ...request, artSet: 'empty' })).toBe('');
    await expect(resolveCardArt(falsy, { ...request, artSet: 'null' })).toBeNull();
    await expect(resolveCardArt(falsy, { ...request, artSet: 'false' })).toBe(false);
    await expect(resolveDeckBack(falsy, 'zero')).toBe(0);
    await expect(resolveDeckBack(falsy, 'null')).toBeNull();
    const noArt: Deck = { id: 'plain', suits: {}, ranks: {} };
    await expect(resolveCardArt(noArt, request)).toBeUndefined();
    await expect(resolveDeckBack(noArt)).toBeUndefined();
  },
};

export const BoardArtInheritance: Story = {
  render: () => (
    <DeckProvider decks={[celestialDeck]} default="celestial" backLabel="Card back">
      <GameTable players={2} seats={[]} viewport={{ width: 1200, height: 800 }} artSet="rare"
        cardArtSets={{ 'moons-I': 'release-2/spooky' }}>
        <GameTable.Center>
          <Row>
            <GameCard label="Inherited board art" value={{ suit: 'stars', rank: 'I' }} />
            <GameCard label="Card override" value={{ suit: 'stars', rank: 'I' }} cardArtSets={{ 'stars-I': 'release-2/spooky' }} />
            <GameCard label="Merged board entry" value={{ suit: 'moons', rank: 'I' }} cardArtSets={{ 'stars-I': 'rare' }} />
            <GameCard label="Explicit card set" value={{ suit: 'stars', rank: 'I' }} artSet="release-2/spooky" />
            <GameCard label="Printed fallback" value={{ suit: 'moons', rank: 'III' }} />
            <GameHand playLabel="Play" cards={[{ id: 'inherited', label: 'Inherited hand art', value: { suit: 'stars', rank: 'I' } }]} />
            <FlipGameCard label="Inherited flip art" value={{ suit: 'stars', rank: 'I' }} />
          </Row>
        </GameTable.Center>
      </GameTable>
    </DeckProvider>
  ),
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('img', { name: 'Inherited board art' })).toHaveTextContent('RARE I');
    await expect(canvas.getByRole('img', { name: 'Card override' })).toHaveTextContent('SPOOKY I');
    await expect(canvas.getByRole('img', { name: 'Merged board entry' })).toHaveTextContent('SPOOKY MOON');
    await expect(canvas.getByRole('img', { name: 'Explicit card set' })).toHaveTextContent('SPOOKY I');
    await expect(canvas.getByRole('img', { name: 'Printed fallback' })).toHaveTextContent('III');
    await expect(canvas.getByRole('img', { name: 'Inherited hand art' })).toHaveTextContent('RARE I');
    await expect(canvas.getByRole('img', { name: 'Inherited flip art' })).toHaveTextContent('RARE I');
  },
};

/** An unregistered deck id throws an error naming the missing deck. */
export const UnknownDeckThrows: Story = {
  tags: ['!autodocs'],
  render: () => {
    let message = '';
    try {
      useDeck('atlantis');
    } catch (error) {
      if (error instanceof UnknownDeckError) message = error.message;
    }
    return <Row>{message}</Row>;
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText(/Unknown deck: "atlantis"/)).toBeVisible();
  },
};
