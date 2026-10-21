import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, waitFor } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
// `styled` is the app-facing styling API; consumers import it from `@jfrader/ui`.
import { styled } from '../../index';
import { withLightTheme } from '../../testing/story-decorators';
import { CARD_BACK_PATTERNS, GameCard } from '../game-card';
import { GameTable } from '../game-table';
import { GameHand } from '../game-hand';
import { FlipGameCard } from '../flip-game-card';
import { Scene } from '../scene';
import {
  cardArtId, defineDeck, DeckProvider, frenchDeck, resolveCardArt, resolveDeckBack,
  spanishDeck, UnknownDeckError, useDeck, type Deck,
} from './index';

const Row = styled('div')({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: vars.space[4],
});

const BoardFrame = styled.div({ inlineSize: `calc(${vars.space[4]} * 75)`, blockSize: `calc(${vars.space[4]} * 50)` });

const ArtLabel = styled.text({ fontSize: vars.textSize.xs, fontWeight: vars.fontWeight.semibold });

function FaceArt({ text }: { text: string }) {
  return (
    <svg viewBox="0 0 72 106" width="100%" height="100%" aria-hidden="true">
      <rect width="100%" height="100%" fill={vars.color.surfaceInset} />
      <circle cx="36" cy="53" r="22" fill={vars.color.cardRed} />
      <ArtLabel x="36" y="58" textAnchor="middle" fill={vars.color.cardFace}>
        {text}
      </ArtLabel>
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
      sections: [
        { title: 'Basic', stories: ['Default', 'SuitsAndRanks'] },
        { title: 'Faces and backs', stories: ['PatternBacks', 'ArtworkBacks', 'SetBacks'] },
        { title: 'Sizes', stories: ['SceneBacks'] },
        { title: 'States', stories: ['UnlistedRankAndSuit'] },
        { title: 'Custom art', stories: ['CardArt', 'NamedArtSets', 'CardArtSet', 'BuiltInOverride'] },
        { title: 'Composition', stories: ['BoardInheritance'] },
      ],
      source: {
        language: 'tsx',
        code: `import { DeckProvider } from '@jfrader/ui/deck';
import { GameCard } from '@jfrader/ui/game-card';

<DeckProvider default="spanish">
  <GameCard label="As de oros" value={{ suit: 'oros', rank: 1 }} />
</DeckProvider>`,
      },
      usage: `### When to use
Share printed suits, ranks and artwork across cards in a game. A deck definition is a visual catalog, not a shuffled pile or a card-count manager; keep dealing and game rules in your application.

### Values and constraints

Keep artwork in client modules and reference decks by string id in card values. Definitions are not runtime-validated. Register custom decks before rendering their cards; an unknown deck id throws. Missing artwork falls back to a printed face, so provide readable rank and suit labels even for illustrated decks.

### Keyboard and accessibility

Name each visible card in the player's language and give hidden cards a neutral back label that does not reveal their value. The provider adds no focus target or keyboard behavior.`,
    },
  },
} satisfies Meta<typeof DeckProvider>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Built-in decks print their rank marks and suit glyphs without artwork. */
export const Default: Story = {
  name: 'Built-in decks',
  parameters: { docs: { description: { story: 'Show Spanish and French printed faces beside their deck backs.' }, source: { language: 'tsx', code: `import { styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';
import { GameCard, CARD_BACK_PATTERNS } from '@jfrader/ui/game-card';

const Row = styled.div({ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: vars.space[4] });

<Row>
  <GameCard label="As de oros" value={{ deck: 'spanish', suit: 'oros', rank: 1 }} />
  <GameCard label="Spanish back" backPattern={CARD_BACK_PATTERNS.spanish} />
  <GameCard label="Queen of hearts" value={{ deck: 'french', suit: 'hearts', rank: 'Q' }} />
  <GameCard label="French back" backPattern={CARD_BACK_PATTERNS.french} />
</Row>` } } },
  render: () => (
    <Row>
      <GameCard label="As de oros" value={{ deck: 'spanish', suit: 'oros', rank: 1 }} />
      <GameCard label="Spanish back" backPattern={CARD_BACK_PATTERNS.spanish} />
      <GameCard label="Queen of hearts" value={{ deck: 'french', suit: 'hearts', rank: 'Q' }} />
      <GameCard label="French back" backPattern={CARD_BACK_PATTERNS.french} />
    </Row>
  ),
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('img', { name: 'As de oros' })).toHaveTextContent('💰');
    await expect(canvas.getByRole('img', { name: 'As de oros' })).toHaveTextContent('1');
    await expect(canvas.getByRole('img', { name: 'Queen of hearts' })).toHaveTextContent('Q');
    await expect(canvas.getByRole('img', { name: 'Queen of hearts' })).toHaveTextContent('♥');
    const spanishBack = canvas.getByRole('img', { name: 'Spanish back' });
    await expect(spanishBack).toHaveAttribute('data-face', 'back');
    await expect(spanishBack).not.toHaveAttribute('data-deck');
    await expect(spanishBack.querySelector('[data-ui="pattern"]')).toHaveAttribute('data-variant', 'diagonal');
    await expect(canvas.getByRole('img', { name: 'French back' }).querySelector('[data-ui="pattern"]'))
      .toHaveAttribute('data-variant', 'checks');
    await expect(resolveCardArt(spanishDeck, { suit: 'oros', rank: '1' })).toBeUndefined();
    await expect(resolveCardArt(frenchDeck, { suit: 'hearts', rank: 'Q' })).toBeUndefined();
  },
};

/** Stars and moons print their own glyphs and rank marks. */
export const SuitsAndRanks: Story = {
  name: 'Suits and ranks',
  parameters: { docs: { description: { story: 'Define stars and moons with their own glyphs and rank marks.' }, source: { language: 'tsx', code: `import { styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';
import { DeckProvider, defineDeck } from '@jfrader/ui/deck';
import { GameCard } from '@jfrader/ui/game-card';

const Row = styled.div({ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: vars.space[4] });
const deck = defineDeck({
  id: 'printed-celestial',
  suits: { stars: { label: 'stars', glyph: '⭐', ink: 'red' }, moons: { label: 'moons', glyph: '🌙', ink: 'ink' } },
  ranks: { I: { label: 'one', mark: 'I' }, II: { label: 'two', mark: 'II' } },
});

<DeckProvider decks={[deck]} default="printed-celestial">
  <Row>
    <GameCard label="One of stars" value={{ suit: 'stars', rank: 'I' }} />
    <GameCard label="Two of moons" value={{ suit: 'moons', rank: 'II' }} />
  </Row>
</DeckProvider>` } } },
  render: () => (
    <DeckProvider decks={[defineDeck({
      id: 'printed-celestial',
      suits: { stars: { label: 'stars', glyph: '⭐', ink: 'red' }, moons: { label: 'moons', glyph: '🌙', ink: 'ink' } },
      ranks: { I: { label: 'one', mark: 'I' }, II: { label: 'two', mark: 'II' } },
    })]} default="printed-celestial">
      <Row>
        <GameCard label="One of stars" value={{ suit: 'stars', rank: 'I' }} />
        <GameCard label="Two of moons" value={{ suit: 'moons', rank: 'II' }} />
      </Row>
    </DeckProvider>
  ),
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('img', { name: 'One of stars' })).toHaveTextContent('⭐');
    await expect(canvas.getByRole('img', { name: 'One of stars' })).toHaveTextContent('I');
    await expect(canvas.getByRole('img', { name: 'Two of moons' })).toHaveTextContent('🌙');
    await expect(canvas.getByRole('img', { name: 'Two of moons' })).toHaveTextContent('II');
  },
};

/** One star has card art; the other prints its glyph and mark. */
export const CardArt: Story = {
  name: 'Card art',
  parameters: { docs: { description: { story: 'Use artwork for one card and printed marks for another.' }, source: { language: 'tsx', code: `import { styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';
import { DeckProvider, defineDeck } from '@jfrader/ui/deck';
import { GameCard } from '@jfrader/ui/game-card';

const Row = styled.div({ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: vars.space[4] });
const ArtLabel = styled.text({ fontSize: vars.textSize.xs, fontWeight: vars.fontWeight.semibold });
function FaceArt({ text }: { text: string }) {
  return <svg viewBox="0 0 72 106" width="100%" height="100%" aria-hidden="true">
    <rect width="100%" height="100%" fill={vars.color.surfaceInset} />
    <circle cx="36" cy="53" r="22" fill={vars.color.cardRed} />
    <ArtLabel x="36" y="58" textAnchor="middle" fill={vars.color.cardFace}>{text}</ArtLabel>
  </svg>;
}
const deck = defineDeck({ id: 'card-art',
  suits: { stars: { label: 'stars', glyph: '⭐', ink: 'red' } },
  ranks: { II: { label: 'II', mark: 'II' }, III: { label: 'III', mark: 'III' } },
  art: { 'stars-II': <FaceArt text="BASE II" /> },
});

<DeckProvider decks={[deck]} default="card-art">
  <Row>
    <GameCard label="Base star" value={{ suit: 'stars', rank: 'II' }} />
    <GameCard label="Three of stars" value={{ suit: 'stars', rank: 'III' }} />
  </Row>
</DeckProvider>` } } },
  render: () => (
    <DeckProvider decks={[defineDeck({ id: 'card-art',
      suits: { stars: { label: 'stars', glyph: '⭐', ink: 'red' } },
      ranks: { II: { label: 'II', mark: 'II' }, III: { label: 'III', mark: 'III' } },
      art: { 'stars-II': <FaceArt text="BASE II" /> },
    })]} default="card-art">
      <Row>
        <GameCard label="Base star" value={{ suit: 'stars', rank: 'II' }} />
        <GameCard label="Three of stars" value={{ suit: 'stars', rank: 'III' }} />
      </Row>
    </DeckProvider>
  ),
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('img', { name: 'Base star' })).toHaveTextContent('BASE II');
    const missing = canvas.getByRole('img', { name: 'Three of stars' });
    await expect(missing.querySelector('[data-ui="game-card-print"]')).not.toBeNull();
    await expect(missing).toHaveTextContent('III');
    await expect(missing).toHaveTextContent('⭐');
  },
};

/** The default set supplies one face and leaves the other to base art. */
export const NamedArtSets: Story = {
  name: 'Named art sets',
  parameters: {
    docs: {
      description: { story: 'Choose a default art set while keeping base artwork as a fallback.' },
      source: {
        language: 'tsx',
        code: `import { styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';
import { DeckProvider, defineDeck } from '@jfrader/ui/deck';
import { GameCard } from '@jfrader/ui/game-card';

const Row = styled.div({ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: vars.space[4] });
const ArtLabel = styled.text({ fontSize: vars.textSize.xs, fontWeight: vars.fontWeight.semibold });
function FaceArt({ text }: { text: string }) {
  return <svg viewBox="0 0 72 106" width="100%" height="100%" aria-hidden="true">
    <rect width="100%" height="100%" fill={vars.color.surfaceInset} />
    <circle cx="36" cy="53" r="22" fill={vars.color.cardRed} />
    <ArtLabel x="36" y="58" textAnchor="middle" fill={vars.color.cardFace}>{text}</ArtLabel>
  </svg>;
}
const deck = defineDeck({
  id: 'named-art',
  suits: { stars: { label: 'stars', glyph: '⭐', ink: 'red' } },
  ranks: { I: { label: 'I', mark: 'I' }, II: { label: 'II', mark: 'II' } },
  art: { 'stars-II': <FaceArt text="BASE II" /> },
  artSets: { 'release-2/spooky': { 'stars-I': <FaceArt text="SPOOKY I" /> } },
  defaultArtSet: 'release-2/spooky',
});

<DeckProvider decks={[deck]} default="named-art">
  <Row>
    <GameCard label="Spooky star" value={{ suit: 'stars', rank: 'I' }} />
    <GameCard label="Base star" value={{ suit: 'stars', rank: 'II' }} />
  </Row>
</DeckProvider>`,
      },
    },
  },
  render: () => (
    <DeckProvider decks={[defineDeck({
      id: 'named-art',
      suits: { stars: { label: 'stars', glyph: '⭐', ink: 'red' } },
      ranks: { I: { label: 'I', mark: 'I' }, II: { label: 'II', mark: 'II' } },
      art: { 'stars-II': <FaceArt text="BASE II" /> },
      artSets: { 'release-2/spooky': { 'stars-I': <FaceArt text="SPOOKY I" /> } },
      defaultArtSet: 'release-2/spooky',
    })]} default="named-art">
      <Row>
        <GameCard label="Spooky star" value={{ suit: 'stars', rank: 'I' }} />
        <GameCard label="Base star" value={{ suit: 'stars', rank: 'II' }} />
      </Row>
    </DeckProvider>
  ),
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('img', { name: 'Spooky star' })).toHaveTextContent('SPOOKY I');
    await expect(canvas.getByRole('img', { name: 'Base star' })).toHaveTextContent('BASE II');
  },
};

/** The same star wears a different face from each named set. */
export const CardArtSet: Story = {
  name: 'Choosing a set for a card',
  parameters: { docs: { description: { story: 'Give two copies of the same card different named artwork.' }, source: { language: 'tsx', code: `import { styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';
import { DeckProvider, defineDeck } from '@jfrader/ui/deck';
import { GameCard } from '@jfrader/ui/game-card';

const Row = styled.div({ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: vars.space[4] });
const ArtLabel = styled.text({ fontSize: vars.textSize.xs, fontWeight: vars.fontWeight.semibold });
function FaceArt({ text }: { text: string }) {
  return <svg viewBox="0 0 72 106" width="100%" height="100%" aria-hidden="true">
    <rect width="100%" height="100%" fill={vars.color.surfaceInset} />
    <circle cx="36" cy="53" r="22" fill={vars.color.cardRed} />
    <ArtLabel x="36" y="58" textAnchor="middle" fill={vars.color.cardFace}>{text}</ArtLabel>
  </svg>;
}
const deck = defineDeck({ id: 'card-sets',
  suits: { stars: { label: 'stars', glyph: '⭐', ink: 'red' } }, ranks: { I: { label: 'I', mark: 'I' } },
  artSets: { 'release-2/spooky': { 'stars-I': <FaceArt text="SPOOKY I" /> }, rare: { 'stars-I': <FaceArt text="RARE I" /> } },
});

<DeckProvider decks={[deck]} default="card-sets">
  <Row>
    <GameCard label="Spooky star" value={{ suit: 'stars', rank: 'I' }} artSet="release-2/spooky" />
    <GameCard label="Rare star" value={{ suit: 'stars', rank: 'I' }} artSet="rare" />
  </Row>
</DeckProvider>` } } },
  render: () => (
    <DeckProvider decks={[defineDeck({ id: 'card-sets',
      suits: { stars: { label: 'stars', glyph: '⭐', ink: 'red' } }, ranks: { I: { label: 'I', mark: 'I' } },
      artSets: { 'release-2/spooky': { 'stars-I': <FaceArt text="SPOOKY I" /> }, rare: { 'stars-I': <FaceArt text="RARE I" /> } },
    })]} default="card-sets">
      <Row>
        <GameCard label="Spooky star" value={{ suit: 'stars', rank: 'I' }} artSet="release-2/spooky" />
        <GameCard label="Rare star" value={{ suit: 'stars', rank: 'I' }} artSet="rare" />
      </Row>
    </DeckProvider>
  ),
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('img', { name: 'Spooky star' })).toHaveTextContent('SPOOKY I');
    const rare = canvas.getByRole('img', { name: 'Rare star' });
    await expect(rare).toHaveTextContent('RARE I');
    await expect(rare).not.toHaveTextContent('SPOOKY I');
  },
};

/** A printed rune and a dotted back share one deck. */
export const PatternBacks: Story = {
  name: 'Pattern backs',
  parameters: { docs: { description: { story: 'Pair a printed rune with a dotted deck back.' }, source: { language: 'tsx', code: `import { styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';
import { DeckProvider, defineDeck } from '@jfrader/ui/deck';
import { GameCard } from '@jfrader/ui/game-card';

const Row = styled.div({ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: vars.space[4] });
const deck = defineDeck({ id: 'pattern-backs',
  suits: { runes: { label: 'runes', glyph: 'ᚱ' } }, ranks: { '1': { label: 'one', mark: '1' } },
  back: { pattern: 'dots', tone: 'accent' },
});

<DeckProvider decks={[deck]} default="pattern-backs">
  <Row>
    <GameCard label="One of runes" value={{ suit: 'runes', rank: '1' }} />
    <GameCard label="Hidden rune" />
  </Row>
</DeckProvider>` } } },
  render: () => (
    <DeckProvider decks={[defineDeck({ id: 'pattern-backs',
      suits: { runes: { label: 'runes', glyph: 'ᚱ' } }, ranks: { '1': { label: 'one', mark: '1' } },
      back: { pattern: 'dots', tone: 'accent' },
    })]} default="pattern-backs">
      <Row>
        <GameCard label="One of runes" value={{ suit: 'runes', rank: '1' }} />
        <GameCard label="Hidden rune" />
      </Row>
    </DeckProvider>
  ),
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('img', { name: 'One of runes' })).toHaveTextContent('ᚱ');
    await expect(canvas.getByRole('img', { name: 'One of runes' })).toHaveTextContent('1');
    await expect(canvas.getByRole('img', { name: 'Hidden rune' }).querySelector('[data-ui="pattern"]'))
      .toHaveAttribute('data-variant', 'dots');
  },
};

/** Rune artwork fills the hidden card's back. */
export const ArtworkBacks: Story = {
  name: 'Artwork backs',
  parameters: { docs: { description: { story: 'Replace a hidden card pattern with deck-wide rune artwork.' }, source: { language: 'tsx', code: `import { styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';
import { DeckProvider, defineDeck } from '@jfrader/ui/deck';
import { GameCard } from '@jfrader/ui/game-card';

const Row = styled.div({ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: vars.space[4] });
const ArtLabel = styled.text({ fontSize: vars.textSize.xs, fontWeight: vars.fontWeight.semibold });
function FaceArt({ text }: { text: string }) {
  return <svg viewBox="0 0 72 106" width="100%" height="100%" aria-hidden="true">
    <rect width="100%" height="100%" fill={vars.color.surfaceInset} />
    <circle cx="36" cy="53" r="22" fill={vars.color.cardRed} />
    <ArtLabel x="36" y="58" textAnchor="middle" fill={vars.color.cardFace}>{text}</ArtLabel>
  </svg>;
}
const deck = defineDeck({
  id: 'fantasy',
  suits: { runes: { label: 'runes', glyph: 'ᚱ' } },
  ranks: { '1': { label: 'one', mark: '1' } },
  back: <FaceArt text="RUNES" />,
});

<DeckProvider decks={[deck]} default="fantasy">
  <Row>
    <GameCard label="Hidden rune" />
  </Row>
</DeckProvider>` } } },
  render: () => (
    <DeckProvider default="fantasy" decks={[defineDeck({
      id: 'fantasy',
      suits: { runes: { label: 'runes', glyph: 'ᚱ' } },
      ranks: { '1': { label: 'one', mark: '1' } },
      back: <FaceArt text="RUNES" />,
    })]}>
      <Row>
        <GameCard label="Hidden rune" />
      </Row>
    </DeckProvider>
  ),
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('img', { name: 'Hidden rune' })).toHaveTextContent('RUNES');
  },
};

/** The rare set replaces the deck's default back with its own artwork. */
export const SetBacks: Story = {
  name: 'Back per art set',
  parameters: { docs: { description: { story: 'Give the rare art set its own back while retaining the default pattern.' }, source: { language: 'tsx', code: `import { styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';
import { DeckProvider, defineDeck } from '@jfrader/ui/deck';
import { GameCard } from '@jfrader/ui/game-card';

const Row = styled.div({ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: vars.space[4] });
const ArtLabel = styled.text({ fontSize: vars.textSize.xs, fontWeight: vars.fontWeight.semibold });
function FaceArt({ text }: { text: string }) {
  return <svg viewBox="0 0 72 106" width="100%" height="100%" aria-hidden="true">
    <rect width="100%" height="100%" fill={vars.color.surfaceInset} />
    <circle cx="36" cy="53" r="22" fill={vars.color.cardRed} />
    <ArtLabel x="36" y="58" textAnchor="middle" fill={vars.color.cardFace}>{text}</ArtLabel>
  </svg>;
}
const deck = defineDeck({ id: 'set-backs', suits: {}, ranks: {},
  back: { pattern: 'dots', tone: 'accent' }, backs: { rare: <FaceArt text="RARE" /> },
});

<DeckProvider decks={[deck]} default="set-backs">
  <Row>
    <GameCard label="Default back" />
    <GameCard label="Rare back" artSet="rare" />
  </Row>
</DeckProvider>` } } },
  render: () => (
    <DeckProvider decks={[defineDeck({ id: 'set-backs', suits: {}, ranks: {},
      back: { pattern: 'dots', tone: 'accent' }, backs: { rare: <FaceArt text="RARE" /> },
    })]} default="set-backs">
      <Row>
        <GameCard label="Default back" />
        <GameCard label="Rare back" artSet="rare" />
      </Row>
    </DeckProvider>
  ),
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('img', { name: 'Default back' }).querySelector('[data-ui="pattern"]'))
      .toHaveAttribute('data-variant', 'dots');
    await expect(canvas.getByRole('img', { name: 'Rare back' })).toHaveTextContent('RARE');
    await expect(canvas.getByRole('img', { name: 'Rare back' }).querySelector('[data-ui="pattern"]')).toBeNull();
  },
};

/** A warm dusk scene fills the back at three card sizes. */
export const SceneBacks: Story = {
  name: 'Scene backs',
  parameters: { docs: { description: { story: 'Fill small, medium and large card backs with a dusk scene.' }, source: { language: 'tsx', code: `import { styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';
import { DeckProvider, defineDeck } from '@jfrader/ui/deck';
import { GameCard } from '@jfrader/ui/game-card';
import { Scene } from '@jfrader/ui/scene';

const Row = styled.div({ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: vars.space[4] });
const deck = defineDeck({ id: 'scene-backs', suits: {}, ranks: {},
  back: <Scene seed="northline" variant="dusk" grade="warm" alt="" />,
});

<DeckProvider decks={[deck]} default="scene-backs">
  <Row>
    <GameCard label="Small scene back" size="sm" />
    <GameCard label="Medium scene back" size="md" />
    <GameCard label="Large scene back" size="lg" />
  </Row>
</DeckProvider>` } } },
  render: () => (
    <DeckProvider decks={[defineDeck({ id: 'scene-backs', suits: {}, ranks: {},
      back: <Scene seed="northline" variant="dusk" grade="warm" alt="" />,
    })]} default="scene-backs">
      <Row>
        <GameCard label="Small scene back" size="sm" />
        <GameCard label="Medium scene back" size="md" />
        <GameCard label="Large scene back" size="lg" />
      </Row>
    </DeckProvider>
  ),
  play: async ({ canvas }) => {
    for (const name of ['Small scene back', 'Medium scene back', 'Large scene back']) {
      const card = canvas.getByRole('img', { name });
      await expect(card).toHaveAttribute('data-face', 'back');
      const scene = card.querySelector('[data-ui="scene"]');
      await expect(scene).not.toBeNull();
      if (!scene) throw new Error(`Missing scene in ${name}`);
      const cardBox = card.getBoundingClientRect();
      const sceneBox = scene.getBoundingClientRect();
      await expect(Math.abs(Math.round(sceneBox.width) - Math.round(cardBox.width - 2))).toBeLessThanOrEqual(1);
      await expect(Math.abs(Math.round(sceneBox.height) - Math.round(cardBox.height - 2))).toBeLessThanOrEqual(1);
    }
  },
};

/** Unlisted ranks and suits print their ids as text. */
export const UnlistedRankAndSuit: Story = {
  name: 'Unlisted rank and suit',
  parameters: { docs: { description: { story: 'Print unknown rank and suit ids when a deck has no matching labels.' }, source: { language: 'tsx', code: `import { GameCard } from '@jfrader/ui/game-card';

<GameCard label="Unknown card" value={{ suit: 'comets', rank: '99' }} />` } } },
  render: () => <GameCard label="Unknown card" value={{ suit: 'comets', rank: '99' }} />,
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('img', { name: 'Unknown card' })).toHaveTextContent('comets');
    await expect(canvas.getByRole('img', { name: 'Unknown card' })).toHaveTextContent('99');
  },
};

/** One queen uses custom artwork while the king keeps its printed face. */
export const BuiltInOverride: Story = {
  name: 'Override a built-in card',
  parameters: { docs: { description: { story: 'Illustrate a French queen without changing the printed king.' }, source: { language: 'tsx', code: `import { styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';
import { DeckProvider, defineDeck, frenchDeck } from '@jfrader/ui/deck';
import { GameCard } from '@jfrader/ui/game-card';

const Row = styled.div({ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: vars.space[4] });
const ArtLabel = styled.text({ fontSize: vars.textSize.xs, fontWeight: vars.fontWeight.semibold });
function FaceArt({ text }: { text: string }) {
  return <svg viewBox="0 0 72 106" width="100%" height="100%" aria-hidden="true">
    <rect width="100%" height="100%" fill={vars.color.surfaceInset} />
    <circle cx="36" cy="53" r="22" fill={vars.color.cardRed} />
    <ArtLabel x="36" y="58" textAnchor="middle" fill={vars.color.cardFace}>{text}</ArtLabel>
  </svg>;
}
const deck = defineDeck({ ...frenchDeck, id: 'crowned-french', art: { 'hearts-Q': <FaceArt text="CROWNED Q" /> } });

<DeckProvider decks={[deck]} default="crowned-french">
  <Row>
    <GameCard label="Crowned queen" value={{ suit: 'hearts', rank: 'Q' }} />
    <GameCard label="King of hearts" value={{ suit: 'hearts', rank: 'K' }} />
  </Row>
</DeckProvider>` } } },
  render: () => (
    <DeckProvider default="crowned-french" decks={[defineDeck({
      ...frenchDeck,
      id: 'crowned-french',
      art: { 'hearts-Q': <FaceArt text="CROWNED Q" /> },
    })]}>
      <Row>
        <GameCard label="Crowned queen" value={{ suit: 'hearts', rank: 'Q' }} />
        <GameCard label="King of hearts" value={{ suit: 'hearts', rank: 'K' }} />
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

export const ResolverContract: Story = {
  tags: ['!autodocs'],
  decorators: [withLightTheme],
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

/** Cards, a hand and a flip card inherit the board's art choices. */
export const BoardInheritance: Story = {
  name: 'Board art inheritance',
  parameters: { docs: { description: { story: 'Share board artwork across cards, a hand and a flip card with a per-card override.' }, source: { language: 'tsx', code: `import { styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';
import { DeckProvider, defineDeck } from '@jfrader/ui/deck';
import { GameCard } from '@jfrader/ui/game-card';
import { GameTable } from '@jfrader/ui/game-table';
import { GameHand } from '@jfrader/ui/game-hand';
import { FlipGameCard } from '@jfrader/ui/flip-game-card';

const Row = styled.div({ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: vars.space[4] });
const BoardFrame = styled.div({ inlineSize: \`calc(\${vars.space[4]} * 75)\`, blockSize: \`calc(\${vars.space[4]} * 50)\` });
const ArtLabel = styled.text({ fontSize: vars.textSize.xs, fontWeight: vars.fontWeight.semibold });
function FaceArt({ text }: { text: string }) {
  return <svg viewBox="0 0 72 106" width="100%" height="100%" aria-hidden="true">
    <rect width="100%" height="100%" fill={vars.color.surfaceInset} />
    <circle cx="36" cy="53" r="22" fill={vars.color.cardRed} />
    <ArtLabel x="36" y="58" textAnchor="middle" fill={vars.color.cardFace}>{text}</ArtLabel>
  </svg>;
}
const deck = defineDeck({ id: 'celestial',
  suits: { stars: { label: 'stars', glyph: '⭐', ink: 'red' }, moons: { label: 'moons', glyph: '🌙', ink: 'ink' } },
  ranks: { I: { label: 'I', mark: 'I' }, II: { label: 'II', mark: 'II' }, III: { label: 'III', mark: 'III' } },
  art: { 'stars-II': <FaceArt text="BASE II" /> },
  artSets: { 'release-2/spooky': { 'stars-I': <FaceArt text="SPOOKY I" />, 'moons-I': <FaceArt text="SPOOKY MOON" /> }, rare: { 'stars-I': <FaceArt text="RARE I" /> } },
  defaultArtSet: 'release-2/spooky', back: { pattern: 'dots', tone: 'accent' }, backs: { rare: { pattern: 'waves', tone: 'card' } },
});

<DeckProvider decks={[deck]} default="celestial" backLabel="Card back">
  <BoardFrame><GameTable places={2} seats={[]} artSet="rare">
    <GameTable.Center><Row>
      <GameCard label="Inherited board art" value={{ suit: 'stars', rank: 'I' }} />
      <GameCard label="Card override" value={{ suit: 'stars', rank: 'I' }} cardArtSets={{ 'stars-I': 'release-2/spooky' }} />
      <GameCard label="Printed fallback" value={{ suit: 'moons', rank: 'III' }} />
      <GameHand playLabel="Play" cards={[{ id: 'inherited', label: 'Inherited hand art', value: { suit: 'stars', rank: 'I' } }]} />
      <FlipGameCard label="Inherited flip art" value={{ suit: 'stars', rank: 'I' }} />
    </Row></GameTable.Center>
  </GameTable></BoardFrame>
</DeckProvider>` } } },
  render: () => (
    <DeckProvider decks={[celestialDeck]} default="celestial" backLabel="Card back">
      <BoardFrame><GameTable places={2} seats={[]} artSet="rare">
        <GameTable.Center>
          <Row>
            <GameCard label="Inherited board art" value={{ suit: 'stars', rank: 'I' }} />
            <GameCard label="Card override" value={{ suit: 'stars', rank: 'I' }} cardArtSets={{ 'stars-I': 'release-2/spooky' }} />
            <GameCard label="Printed fallback" value={{ suit: 'moons', rank: 'III' }} />
            <GameHand playLabel="Play" cards={[{ id: 'inherited', label: 'Inherited hand art', value: { suit: 'stars', rank: 'I' } }]} />
            <FlipGameCard label="Inherited flip art" value={{ suit: 'stars', rank: 'I' }} />
          </Row>
        </GameTable.Center>
      </GameTable></BoardFrame>
    </DeckProvider>
  ),
  play: async ({ canvas, canvasElement }) => {
    const table = canvasElement.querySelector('[data-ui="game-table"]');
    await waitFor(() => expect(table).toHaveAttribute('data-layout-fit', 'fitted'));
    await expect(canvas.getByRole('img', { name: 'Inherited board art' })).toHaveTextContent('RARE I');
    await expect(canvas.getByRole('img', { name: 'Card override' })).toHaveTextContent('SPOOKY I');
    await expect(canvas.getByRole('img', { name: 'Printed fallback' })).toHaveTextContent('III');
    await expect(canvas.getByRole('img', { name: 'Inherited hand art' })).toHaveTextContent('RARE I');
    await expect(canvas.getByRole('img', { name: 'Inherited flip art' })).toHaveTextContent('RARE I');
  },
};

/** Spanish and French faces and backs sit on a light surface. */
export const BuiltInDecksLight: Story = {
  ...Default,
  name: 'Built-in decks · light',
  decorators: [withLightTheme],
  parameters: { docs: { source: { language: 'tsx', code: `import { styled, ThemeRoot } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';
import { GameCard, CARD_BACK_PATTERNS } from '@jfrader/ui/game-card';

const Row = styled.div({ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: vars.space[4] });

<ThemeRoot theme="light">
  <Row>
    <GameCard label="As de oros" value={{ deck: 'spanish', suit: 'oros', rank: 1 }} />
    <GameCard label="Spanish back" backPattern={CARD_BACK_PATTERNS.spanish} />
    <GameCard label="Queen of hearts" value={{ deck: 'french', suit: 'hearts', rank: 'Q' }} />
    <GameCard label="French back" backPattern={CARD_BACK_PATTERNS.french} />
  </Row>
</ThemeRoot>` } } },
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
