import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import { base } from '@jfrader/tokens';
import { vars } from '@jfrader/tokens/vars';
// `styled` is the app-facing styling API; consumers import it from `@jfrader/ui`.
import { Flex, Stack, styled } from '../../index';
import { CARD_BACK_PATTERNS, GameCard } from '../game-card';
import { GameHand } from '../game-hand';
import { FlipGameCard } from '../flip-game-card';
import { Emblem } from '../emblem';
import { Pattern } from '../pattern';
import { PersonAvatar } from '../person-avatar';
import { Scene, type SceneGrade, type SceneVariant } from '../scene';
import {
  cardArtId, defineDeck, DeckArtProvider, DeckProvider, frenchDeck, resolveCardArt, resolveDeckBack,
  spanishDeck, UnknownDeckError, useDeck, type Deck,
} from './index';

/* Story-only card designs. Every face composes library pieces (Scene, PersonAvatar, Emblem,
   Pattern) and card-relative type, so one design holds from 72px to 160px. */

const CardCaption = styled.span({ fontSize: vars.textSize.xs, color: vars.color.textMuted });

/** The face fills the card, so a card design is a positioning context, not a rectangle. */
const FaceRoot = styled.div({
  position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
  backgroundColor: vars.color.cardFace, color: vars.color.cardInk, fontFamily: vars.font.sans,
});

const FaceArt = styled.div({ position: 'relative', flex: '1 1 auto', minBlockSize: 0, overflow: 'hidden' });

const FacePlate = styled.div({
  flex: '0 0 auto', display: 'grid', gap: '1.2cqw',
  padding: '4cqw 5cqw 4.5cqw', borderBlockStart: '1px solid rgba(0, 0, 0, 0.16)',
});

const PlateKicker = styled.span<{ $ink?: string }>(({ $ink }) => ({
  fontSize: '4.6cqw', fontWeight: 600, letterSpacing: '0.15em', textTransform: 'uppercase', lineHeight: 1,
  color: $ink ?? 'rgba(0, 0, 0, 0.64)',
}));

const PlateTitle = styled.span({
  fontSize: '8cqw', fontWeight: 650, letterSpacing: '-0.015em', lineHeight: 1.08, textWrap: 'balance',
});

const SuitChip = styled.span({
  position: 'absolute', insetBlockStart: '4.5cqw', insetInlineEnd: '4.5cqw',
  display: 'grid', placeItems: 'center', inlineSize: '16cqw', blockSize: '16cqw',
  borderRadius: '50%', backgroundColor: vars.color.cardFace,
  border: '1px solid rgba(0, 0, 0, 0.22)', boxShadow: '0 1px 4px rgba(0, 0, 0, 0.3)',
  fontSize: '8cqw', lineHeight: 1,
});

const IndexChip = styled.span({
  position: 'absolute', insetBlockStart: '4.5cqw', insetInlineStart: '4.5cqw',
  display: 'grid', placeItems: 'center', inlineSize: '16cqw', blockSize: '16cqw',
  borderRadius: '4cqw', backgroundColor: vars.color.cardFace, color: vars.color.cardInk,
  border: '1px solid rgba(0, 0, 0, 0.22)', boxShadow: '0 1px 4px rgba(0, 0, 0, 0.3)',
  fontSize: '8.6cqw', fontWeight: 650, lineHeight: 1, letterSpacing: '-0.02em',
});

/* The Northline deck: an expedition board of places. Each suit is a region, each rank a site. */

const REGIONS = {
  ridge: { label: 'Ridge', variant: 'landscape', grade: 'raw', ink: '#33564a' },
  dunes: { label: 'Dunes', variant: 'dunes', grade: 'warm', ink: '#8a5a1e' },
  coast: { label: 'Coast', variant: 'tide', grade: 'raw', ink: '#1f4b63' },
  delta: { label: 'Delta', variant: 'dusk', grade: 'warm', ink: '#5c2a38' },
} as const satisfies Record<string, { label: string; variant: SceneVariant; grade: SceneGrade; ink: string }>;

type Region = keyof typeof REGIONS;

const SITES = [
  { region: 'ridge', rank: '1', name: 'Sable Ridge' },
  { region: 'ridge', rank: '2', name: 'Old Cairn' },
  { region: 'ridge', rank: '3', name: 'Windward Pass' },
  { region: 'ridge', rank: '4', name: 'The Narrows' },
  { region: 'dunes', rank: '1', name: 'Ember Dunes' },
  { region: 'dunes', rank: '2', name: 'Glass Waste' },
  { region: 'dunes', rank: '3', name: 'Salt Flats' },
  { region: 'dunes', rank: '4', name: 'Dry Well' },
  { region: 'coast', rank: '1', name: 'Long Shoal' },
  { region: 'coast', rank: '2', name: 'Black Harbour' },
  { region: 'coast', rank: '3', name: 'Tide Gate' },
  { region: 'coast', rank: '4', name: 'Gannet Rock' },
  { region: 'delta', rank: '1', name: 'River Fork' },
  { region: 'delta', rank: '2', name: 'Reed Hallow' },
  { region: 'delta', rank: '3', name: 'Ferry Landing' },
  { region: 'delta', rank: '4', name: 'Sunken Chapel' },
] as const satisfies readonly { region: Region; rank: string; name: string }[];

function SiteFace({ region, rank, name }: { region: Region; rank: string; name: string }) {
  const spec = REGIONS[region];
  return (
    <FaceRoot>
      <FaceArt>
        <Scene seed={`northline-${region}-${rank}`} variant={spec.variant} grade={spec.grade} alt="" />
        <IndexChip>{rank}</IndexChip>
      </FaceArt>
      <FacePlate>
        <PlateKicker $ink={spec.ink}>{spec.label} · {rank} of 4</PlateKicker>
        <PlateTitle>{name}</PlateTitle>
      </FacePlate>
    </FaceRoot>
  );
}

const northlineArt = Object.fromEntries(
  SITES.map((site) => [`${site.region}-${site.rank}`, <SiteFace key={site.name} {...site} />]),
);

/* A back is the other half of the deck: a crest the table reads at a glance. */

const BackStack = styled.div({ position: 'absolute', inset: 0, display: 'grid', gridTemplate: 'minmax(0, 1fr) / minmax(0, 1fr)' });

const BackPattern = styled(Pattern)({ gridArea: '1 / 1' });

const BackCrest = styled.div({ gridArea: '1 / 1', display: 'grid', placeItems: 'center', paddingBlockEnd: '12cqw' });

const BackWordmark = styled.span<{ $ink: string }>(({ $ink }) => ({
  gridArea: '1 / 1', alignSelf: 'end', justifySelf: 'center', marginBlockEnd: '8cqw',
  padding: '1.6cqw 3.6cqw', borderRadius: '1.6cqw', backgroundColor: vars.color.cardFace,
  fontSize: '5.4cqw', fontWeight: 650, letterSpacing: '0.2em', textTransform: 'uppercase',
  color: $ink, textIndent: '0.2em',
}));

function CrestBack({ name, initials, crest = vars.color.cardFace, ink = '#7a1024' }: {
  name: string; initials: string; crest?: string; ink?: string;
}) {
  return (
    <BackStack>
      <BackPattern variant="waves" tone="card" />
      <BackCrest>
        <Emblem name={name} initials={initials} shape="squircle" size="xl" pattern="sash"
          color={crest} inkColor={ink} />
      </BackCrest>
      <BackWordmark $ink={ink}>{name}</BackWordmark>
    </BackStack>
  );
}

const northlineDeck = defineDeck({
  id: 'northline',
  suits: Object.fromEntries(Object.entries(REGIONS).map(([key, spec]) => [key, { label: spec.label }])),
  ranks: Object.fromEntries(SITES.map((site) => [site.rank, { label: site.rank, mark: site.rank }])),
  art: northlineArt,
  back: <CrestBack name="Northline" initials="N" />,
});

/* A printed deck: its own suit glyphs, rank marks, and a pattern back. */

const housesDeck = defineDeck({
  id: 'houses',
  suits: {
    sun: { label: 'sun', glyph: '✶', ink: 'red' },
    moon: { label: 'moon', glyph: '☾', ink: 'ink' },
    star: { label: 'star', glyph: '✦', ink: 'red' },
  },
  ranks: {
    I: { label: 'one', mark: 'I' },
    II: { label: 'two', mark: 'II' },
    III: { label: 'three', mark: 'III' },
  },
  back: { pattern: 'chevron', tone: 'accent' },
});

/* The crew deck: a portrait card for a heist game. Suits are factions, ranks are hire costs. */

const FACTIONS = {
  ash: { label: 'Ash', field: '#31363b', glow: 'rgba(216, 199, 160, 0.22)', plate: '#d8c7a0', ink: '#2b2a25' },
  tide: { label: 'Tide', field: '#1d3a4d', glow: 'rgba(169, 214, 229, 0.24)', plate: '#a9d6e5', ink: '#123040' },
  wine: { label: 'Copas', field: '#5c1a24', glow: 'rgba(240, 214, 160, 0.26)', plate: '#f0d6a0', ink: '#3a0d14' },
} as const satisfies Record<string, { label: string; field: string; glow: string; plate: string; ink: string }>;

type Faction = keyof typeof FACTIONS;

const CREW = [
  { key: 'mara-voss', faction: 'ash', rank: '1', name: 'Mara Voss', role: 'Fixer', power: 2 },
  { key: 'otto-krane', faction: 'ash', rank: '2', name: 'Otto Krane', role: 'Muscle', power: 3 },
  { key: 'jun-sable', faction: 'tide', rank: '1', name: 'Jun Sable', role: 'Wheelman', power: 1 },
  { key: 'iris-vale', faction: 'tide', rank: '2', name: 'Iris Vale', role: 'Netrunner', power: 2 },
] as const satisfies readonly { key: string; faction: Faction; rank: string; name: string; role: string; power: number }[];

const CrewField = styled.div<{ $field: string; $glow: string }>(({ $field, $glow }) => ({
  flex: '1 1 0', minBlockSize: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column',
  backgroundColor: $field,
  backgroundImage: `radial-gradient(120% 76% at 50% 32%, ${$glow}, transparent 64%), linear-gradient(to top, rgba(0, 0, 0, 0.3), transparent 30%)`,
}));

const CrewPortrait = styled.div({
  flex: '1 1 0', minBlockSize: 0, overflow: 'hidden',
  display: 'grid', gridTemplateRows: 'minmax(0, 1fr)', placeItems: 'end center', paddingBlockStart: '9cqw',
  '& > svg': { blockSize: '100%' },
});

const CrewPlate = styled(FacePlate)({ position: 'relative', gridTemplateColumns: '1fr auto', alignItems: 'end', columnGap: '2cqw' });

const CrewName = styled(PlateTitle)({ fontSize: '7.4cqw' });

const CrewRole = styled(PlateKicker)({ gridColumn: '1 / -1' });

const CrewPower = styled.span({
  display: 'grid', placeItems: 'center', inlineSize: '11cqw', blockSize: '11cqw',
  borderRadius: '50%', border: '1px solid rgba(0, 0, 0, 0.35)',
  fontSize: '6.4cqw', fontWeight: 700, lineHeight: 1,
});

function CrewFace({ faction, rank, name, role, power, seed, suitGlyph }: {
  faction: Faction; rank: string; name: string; role: string; power?: number; seed: string; suitGlyph?: string;
}) {
  const spec = FACTIONS[faction];
  return (
    <FaceRoot>
      <CrewField $field={spec.field} $glow={spec.glow}>
        <CrewPortrait>
          <PersonAvatar seed={seed} fullKit size="full" primary={spec.plate} secondary={spec.ink} alt="" />
        </CrewPortrait>
        <IndexChip>{rank}</IndexChip>
        {suitGlyph !== undefined && <SuitChip>{suitGlyph}</SuitChip>}
      </CrewField>
      <CrewPlate>
        <CrewRole $ink={spec.ink}>{role}</CrewRole>
        <CrewName>{name}</CrewName>
        {power !== undefined && <CrewPower>{power}</CrewPower>}
      </CrewPlate>
    </FaceRoot>
  );
}

const crewArt = Object.fromEntries(CREW.map((member) => [
  `${member.faction}-${member.rank}`,
  <CrewFace key={member.name} faction={member.faction} rank={member.rank} name={member.name}
    role={member.role} power={member.power} seed={member.key} />,
]));

const crewDeck = defineDeck({
  id: 'crew',
  suits: Object.fromEntries(Object.entries(FACTIONS).map(([key, spec]) => [key, { label: spec.label }])),
  ranks: Object.fromEntries(CREW.map((member) => [member.rank, { label: member.rank, mark: member.rank }])),
  art: crewArt,
  back: <CrestBack name="The Crew" initials="C" />,
});

/* The relic deck: one card with three printings. Art sets carry rarity, backs follow the set. */

const PRINTINGS = {
  standard: { label: 'Standard', field: '#3f4a52', crest: '#dbe2e6', ink: '#1c252b', pattern: 'hoops' },
  gilded: { label: 'Gilded', field: '#7a5a1e', crest: '#f2dfae', ink: '#3a2a08', pattern: 'sash' },
  relic: { label: 'Relic', field: '#3b1d4a', crest: '#e6d5ff', ink: '#241030', pattern: 'stripes' },
} as const satisfies Record<string, { label: string; field: string; crest: string; ink: string; pattern: 'none' | 'stripes' | 'hoops' | 'sash' }>;

type Printing = keyof typeof PRINTINGS;

const RELICS = [
  { rank: '1', mark: 'I', name: 'Ember Sigil', initials: 'ES' },
  { rank: '2', mark: 'II', name: 'Tideglass', initials: 'TG' },
] as const;

const RelicField = styled.div<{ $field: string }>(({ $field }) => ({
  position: 'absolute', inset: 0, display: 'grid', gridTemplateRows: '1fr auto',
  backgroundColor: $field,
  backgroundImage: 'radial-gradient(90% 60% at 50% 42%, rgba(255, 255, 255, 0.16), transparent 70%)',
}));

const RelicCrest = styled.div({ display: 'grid', placeItems: 'center' });

const RelicFrame = styled.div<{ $crest: string }>(({ $crest }) => ({
  position: 'absolute', inset: '4cqw', border: `1px solid ${$crest}`, opacity: 0.55, pointerEvents: 'none',
}));

const RelicPlate = styled(FacePlate)({
  position: 'relative', gridTemplateColumns: '1fr auto', alignItems: 'end', borderBlockStart: 'none',
  backgroundColor: 'transparent', color: vars.color.cardFace,
});

const RelicName = styled(PlateTitle)({ fontSize: '7.4cqw', color: vars.color.cardFace });

const RelicTier = styled(PlateKicker)({ gridColumn: '1 / -1', color: 'rgba(255, 255, 255, 0.92)' });

const RelicIndex = styled.span({ fontSize: '7cqw', fontWeight: 700, lineHeight: 1, color: 'rgba(255, 255, 255, 0.92)' });

function RelicFace({ printing, name, mark, initials }: { printing: Printing; name: string; mark: string; initials: string }) {
  const spec = PRINTINGS[printing];
  return (
    <FaceRoot>
      <RelicField $field={spec.field}>
        <RelicCrest>
          <Emblem name={name} initials={initials} shape="hexagon" size="xl"
            color={spec.crest} inkColor={spec.ink} pattern={spec.pattern} />
        </RelicCrest>
        <RelicPlate>
          <RelicTier>{spec.label}</RelicTier>
          <RelicName>{name}</RelicName>
          <RelicIndex>{mark}</RelicIndex>
        </RelicPlate>
        <RelicFrame $crest={spec.crest} />
      </RelicField>
    </FaceRoot>
  );
}

const relicArtSets = Object.fromEntries(Object.keys(PRINTINGS).map((printing) => [printing,
  Object.fromEntries(RELICS.map((relic) => [`sigils-${relic.rank}`,
    <RelicFace key={relic.name} printing={printing as Printing} name={relic.name} mark={relic.mark} initials={relic.initials} />])),
]));

const relicDeck = defineDeck({
  id: 'sigils',
  suits: { sigils: { label: 'sigils' } },
  ranks: Object.fromEntries(RELICS.map((relic) => [relic.rank, { label: relic.name, mark: relic.mark }])),
  artSets: relicArtSets,
  defaultArtSet: 'standard',
  back: { pattern: 'checks', tone: 'card' },
  backs: {
    standard: { pattern: 'checks', tone: 'card' },
    gilded: <CrestBack name="Sigils" initials="S" crest="#f2dfae" ink="#3a2a08" />,
    relic: <CrestBack name="Sigils" initials="S" crest="#e6d5ff" ink="#241030" />,
  },
});

/* The crossroads deck: cards without suits. Each rank is the whole identity of a card. */

const PROMPTS = [
  { rank: 'the-stranger', mark: '07', title: 'The Road Not Taken', accent: '#6b4bd6', category: 'Encounter',
    body: 'A stranger knows your name and a door you never opened.' },
  { rank: 'the-debt', mark: '12', title: 'The Debt', accent: '#b4452f', category: 'Bargain',
    body: 'Someone paid for your passage. They will collect before the last light.' },
  { rank: 'the-door', mark: '03', title: 'The Door', accent: '#2f6f63', category: 'Place',
    body: 'It was not here this morning. It is open.' },
] as const;

const PromptFace = styled.div({
  position: 'absolute', inset: 0, display: 'grid', gridTemplateRows: 'auto 1fr',
  padding: '6cqw 5.5cqw 16cqw', backgroundColor: vars.color.cardFace, color: vars.color.cardInk,
  fontFamily: vars.font.sans,
});

const PromptTop = styled.div({ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' });

const PromptMark = styled.span<{ $accent: string }>(({ $accent }) => ({
  fontSize: '7cqw', fontWeight: 700, letterSpacing: '0.04em', lineHeight: 1, color: $accent,
}));

const PromptDeck = styled.span({
  fontSize: '4.4cqw', fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase',
  color: 'rgba(0, 0, 0, 0.66)',
});

const PromptBody = styled.div({ display: 'grid', alignContent: 'start', gap: '3.4cqw', paddingBlockStart: '12cqw' });

const PromptTitle = styled.span({ fontSize: '9.6cqw', fontWeight: 650, letterSpacing: '-0.02em', lineHeight: 1.06 });

const PromptRule = styled.span<{ $accent: string }>(({ $accent }) => ({
  inlineSize: '26%', blockSize: '1px', backgroundColor: $accent,
}));

const PromptText = styled.span({ fontSize: '5.4cqw', lineHeight: 1.45, color: 'rgba(0, 0, 0, 0.72)' });

const PromptBand = styled.span<{ $accent: string }>(({ $accent }) => ({
  position: 'absolute', insetInline: 0, insetBlockEnd: 0, blockSize: '10.4cqw',
  display: 'flex', alignItems: 'center', paddingInline: '5.5cqw',
  backgroundColor: $accent, color: vars.color.cardFace,
  fontSize: '4.4cqw', fontWeight: 600, letterSpacing: '0.22em', textTransform: 'uppercase',
}));

function PromptCardFace({ mark, title, body, accent, category }: {
  mark: string; title: string; body: string; accent: string; category: string;
}) {
  return (
    <PromptFace>
      <PromptTop>
        <PromptMark $accent={accent}>{mark}</PromptMark>
        <PromptDeck>{category}</PromptDeck>
      </PromptTop>
      <PromptBody>
        <PromptTitle>{title}</PromptTitle>
        <PromptRule $accent={accent} />
        <PromptText>{body}</PromptText>
      </PromptBody>
      <PromptBand $accent={accent}>Crossroads</PromptBand>
    </PromptFace>
  );
}

const crossroadsDeck = defineDeck({
  id: 'crossroads',
  ranks: Object.fromEntries(PROMPTS.map((prompt) => [prompt.rank, { label: prompt.title, mark: prompt.mark }])),
  art: Object.fromEntries(PROMPTS.map((prompt) => [prompt.rank,
    <PromptCardFace key={prompt.rank} mark={prompt.mark} title={prompt.title} body={prompt.body}
      accent={prompt.accent} category={prompt.category} />])),
  back: { pattern: 'dots', tone: 'card' },
});

const sparseDeck = defineDeck({
  ...crossroadsDeck,
  id: 'sparse',
  art: { 'the-stranger': crossroadsDeck.art?.['the-stranger'] },
});

/* Illustrated court cards: a built-in deck keeps its printed index and gains portraits. */

const copasCourtDeck = defineDeck({
  ...spanishDeck,
  id: 'copas-court',
  art: {
    'copas-10': <CrewFace faction="wine" rank="10" name="Sota de copas" role="Sota" seed="sota-copas" suitGlyph="🍷" />,
    'copas-11': <CrewFace faction="wine" rank="11" name="Caballo de copas" role="Caballo" seed="caballo-copas" suitGlyph="🍷" />,
    'copas-12': <CrewFace faction="wine" rank="12" name="Rey de copas" role="Rey" seed="rey-copas" suitGlyph="🍷" />,
  },
  back: <CrestBack name="Copas" initials="C" />,
});

const meta = {
  title: 'Games/Deck',
  component: DeckProvider,
  tags: ['autodocs'],
  args: { children: null },
  parameters: {
    docs: {
      description: { component: 'Declare a card deck once and give its cards illustrated faces and backs.' },
      sections: [
        { title: 'Illustrated cards', stories: ['IllustratedFaces', 'IllustratedBacks'] },
        { title: 'Portrait cards', stories: ['PortraitFaces'] },
        { title: 'Printed cards', stories: ['PrintedSuits', 'BuiltInDecks'] },
        { title: 'Art sets', stories: ['RaritySets', 'CardOverride'] },
        { title: 'Suitless decks', stories: ['StoryDeck'] },
        { title: 'Built-in artwork', stories: ['BuiltInOverride'] },
        { title: 'In play', stories: ['InPlay'] },
        { title: 'States', stories: ['MissingArt', 'UnlistedRankAndSuit'] },
      ],
      source: {
        language: 'tsx',
        code: `import { DeckProvider, defineDeck, spanishDeck } from '@jfrader/ui/deck';
import { GameCard } from '@jfrader/ui/game-card';

const deck = defineDeck({ ...spanishDeck, id: 'house-spanish' });

<DeckProvider decks={[deck]} default="house-spanish">
  <GameCard label="As de oros" value={{ suit: 'oros', rank: 1 }} />
</DeckProvider>`,
      },
      usage: `### When to use
Declare a deck when several cards share suits, ranks, artwork, or a back. A deck is a visual catalog: it does not shuffle, deal, or count cards, and it does not carry game rules.

### Values and constraints

Keep artwork in client modules and reference the deck by string id in card values. Definitions are not validated at runtime; register a deck before rendering its cards, because an unknown deck id throws. Card values stay serializable: \`deck\`, \`suit\`, and \`rank\`.

Artwork replaces the whole face. Compose it as a fill-height design, for example artwork above a title plate. A card is an inline-size container, so size the art's type and spacing in \`cqw\` units, and keep the card's \`label\` as the accessible name.

Resolution order is the card's \`cardArtSets\` entry, the card's \`artSet\`, the deck's \`defaultArtSet\`, the deck's \`art\`, then the printed face. Backs resolve from the same set, then the deck's \`back\`.

A suitless deck omits \`suits\`, and its art keys default to the rank. Named art sets carry a second printing, a promo, or a rarity tier. Illustrated faces use \`size="xl"\`; the printed face and the smaller sizes stay available for hands and seats.

### Keyboard and accessibility

Each card is one image named by \`label\` in the player's language; artwork and printed marks stay out of the accessibility tree. Name a face-down card after its back, never after its value. The provider adds no focus target or key handling.`,
    },
  },
} satisfies Meta<typeof DeckProvider>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Four sites, one per region, each with a printed index. */
export const IllustratedFaces: Story = {
  name: 'Illustrated faces',
  parameters: {
    layout: 'centered',
    docs: {
      description: { story: 'Build a deck whose faces are scenes, one site per card, with a printed index and a title plate.' },
      source: {
        language: 'tsx',
        code: `import { styled } from '@jfrader/ui';
import { base } from '@jfrader/tokens';
import { vars } from '@jfrader/tokens/vars';
import { DeckProvider, defineDeck } from '@jfrader/ui/deck';
import { GameCard } from '@jfrader/ui/game-card';
import { Scene } from '@jfrader/ui/scene';

const REGIONS = {
  ridge: { label: 'Ridge', variant: 'landscape', grade: 'raw', ink: '#33564a' },
  dunes: { label: 'Dunes', variant: 'dunes', grade: 'warm', ink: '#8a5a1e' },
  coast: { label: 'Coast', variant: 'tide', grade: 'raw', ink: '#1f4b63' },
  delta: { label: 'Delta', variant: 'dusk', grade: 'warm', ink: '#5c2a38' },
} as const;
const SITES = [
  { region: 'ridge', rank: '1', name: 'Sable Ridge' },
  { region: 'dunes', rank: '2', name: 'Glass Waste' },
  { region: 'coast', rank: '3', name: 'Tide Gate' },
  { region: 'delta', rank: '4', name: 'Sunken Chapel' },
] as const;

const Face = styled.div({
  position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
  backgroundColor: vars.color.cardFace, color: vars.color.cardInk,
});
const Art = styled.div({ position: 'relative', flex: 1, minBlockSize: 0, overflow: 'hidden' });
const Plate = styled.div({
  display: 'grid', gap: '1.2cqw', padding: '4cqw 5cqw 4.5cqw',
  borderBlockStart: '1px solid rgba(0, 0, 0, 0.16)',
});
const Kicker = styled.span<{ $ink: string }>(({ $ink }) => ({
  fontSize: '4.6cqw', fontWeight: 600, letterSpacing: '0.15em', textTransform: 'uppercase',
  lineHeight: 1, color: $ink,
}));
const Title = styled.span({ fontSize: '8cqw', fontWeight: 650, letterSpacing: '-0.015em', lineHeight: 1.08 });
const Index = styled.span({
  position: 'absolute', insetBlockStart: '4.5cqw', insetInlineStart: '4.5cqw',
  display: 'grid', placeItems: 'center', inlineSize: '16cqw', blockSize: '16cqw', borderRadius: '4cqw',
  backgroundColor: vars.color.cardFace, color: vars.color.cardInk,
  border: '1px solid rgba(0, 0, 0, 0.22)', fontSize: '8.6cqw', fontWeight: 650, lineHeight: 1,
});

function SiteFace({ region, rank, name }: { region: keyof typeof REGIONS; rank: string; name: string }) {
  const spec = REGIONS[region];
  return (
    <Face>
      <Art>
        <Scene seed={'northline-' + region + '-' + rank} variant={spec.variant} grade={spec.grade} alt="" />
        <Index>{rank}</Index>
      </Art>
      <Plate>
        <Kicker $ink={spec.ink}>{spec.label} · {rank} of 4</Kicker>
        <Title>{name}</Title>
      </Plate>
    </Face>
  );
}

const deck = defineDeck({
  id: 'northline',
  suits: { ridge: { label: 'Ridge' }, dunes: { label: 'Dunes' }, coast: { label: 'Coast' }, delta: { label: 'Delta' } },
  ranks: { '1': { label: '1' }, '2': { label: '2' }, '3': { label: '3' }, '4': { label: '4' } },
  art: Object.fromEntries(SITES.map((site) => [site.region + '-' + site.rank, <SiteFace key={site.name} {...site} />])),
});

<DeckProvider decks={[deck]} default="northline">
  {SITES.map((site) => (
    <GameCard key={site.name} size="xl" label={site.name} value={{ suit: site.region, rank: site.rank }} />
  ))}
</DeckProvider>`,
      },
    },
  },
  render: () => (
    <DeckProvider decks={[northlineDeck]} default="northline">
      <Flex wrap align="start" justify="center" gap="md">
        <GameCard size="xl" label="Sable Ridge" value={{ suit: 'ridge', rank: 1 }} />
        <GameCard size="xl" label="Glass Waste" value={{ suit: 'dunes', rank: 2 }} />
        <GameCard size="xl" label="Tide Gate" value={{ suit: 'coast', rank: 3 }} />
        <GameCard size="xl" label="Sunken Chapel" value={{ suit: 'delta', rank: 4 }} />
      </Flex>
    </DeckProvider>
  ),
  play: async ({ canvas }) => {
    const ridge = canvas.getByRole('img', { name: 'Sable Ridge' });
    await expect(ridge).toHaveTextContent('Sable Ridge');
    await expect(ridge).toHaveTextContent('Ridge · 1 of 4');
    await expect(ridge.querySelector('[data-ui="scene"]')).not.toBeNull();
    await expect(Math.round(ridge.getBoundingClientRect().width)).toBe(Number.parseFloat(base.size.gameCardXl));
    await expect(canvas.getByRole('img', { name: 'Sunken Chapel' })).toHaveTextContent('Sunken Chapel');
    await expect(canvas.getByRole('img', { name: 'Tide Gate' })).toHaveTextContent('Tide Gate');
  },
};

/** A back carries the deck crest at three card sizes. */
export const IllustratedBacks: Story = {
  name: 'Illustrated backs',
  parameters: {
    layout: 'centered',
    docs: {
      description: { story: 'Fill a card back with a crest over a patterned field and scale it from 72px to 160px.' },
      source: {
        language: 'tsx',
        code: `import { styled } from '@jfrader/ui';
import { base } from '@jfrader/tokens';
import { vars } from '@jfrader/tokens/vars';
import { DeckProvider, defineDeck } from '@jfrader/ui/deck';
import { Emblem } from '@jfrader/ui/emblem';
import { GameCard } from '@jfrader/ui/game-card';
import { Pattern } from '@jfrader/ui/pattern';

const Back = styled.div({
  position: 'absolute', inset: 0, display: 'grid',
  gridTemplate: 'minmax(0, 1fr) / minmax(0, 1fr)',
});
const Waves = styled(Pattern)({ gridArea: '1 / 1' });
const Crest = styled.div({ gridArea: '1 / 1', display: 'grid', placeItems: 'center', paddingBlockEnd: '12cqw' });
const Wordmark = styled.span<{ $ink: string }>(({ $ink }) => ({
  gridArea: '1 / 1', alignSelf: 'end', justifySelf: 'center', marginBlockEnd: '8cqw',
  padding: '1.6cqw 3.6cqw', borderRadius: '1.6cqw', backgroundColor: vars.color.cardFace,
  fontSize: '5.4cqw', fontWeight: 650, letterSpacing: '0.2em', textTransform: 'uppercase',
  color: $ink, textIndent: '0.2em',
}));

const deck = defineDeck({
  id: 'northline',
  back: (
    <Back>
      <Waves variant="waves" tone="card" />
      <Crest>
        <Emblem name="Northline" initials="N" shape="squircle" size="xl" pattern="sash"
          color={vars.color.cardFace} inkColor="#7a1024" />
      </Crest>
      <Wordmark $ink="#7a1024">Northline</Wordmark>
    </Back>
  ),
});

<DeckProvider decks={[deck]} default="northline">
  <GameCard size="md" label="md card back" face="back" />
  <GameCard size="lg" label="lg card back" face="back" />
  <GameCard size="xl" label="xl card back" face="back" />
</DeckProvider>`,
      },
    },
  },
  render: () => (
    <DeckProvider decks={[northlineDeck]} default="northline">
      <Flex wrap align="start" justify="center" gap="md">
        {(['md', 'lg', 'xl'] as const).map((size) => (
          <Stack key={size} gap="sm" align="center">
            <GameCard size={size} label={`${size} card back`} face="back" />
            <CardCaption>{size}</CardCaption>
          </Stack>
        ))}
      </Flex>
    </DeckProvider>
  ),
  play: async ({ canvas }) => {
    for (const size of ['md', 'lg', 'xl'] as const) {
      const back = canvas.getByRole('img', { name: `${size} card back` });
      await expect(back).toHaveAttribute('data-face', 'back');
      const emblem = back.querySelector('[data-ui="emblem"]');
      await expect(emblem).not.toBeNull();
      if (emblem === null) throw new Error(`Missing crest in ${size} back`);
      const cardBox = back.getBoundingClientRect();
      const crestBox = emblem.getBoundingClientRect();
      await expect(crestBox.width).toBeLessThan(cardBox.width);
      await expect(crestBox.left).toBeGreaterThan(cardBox.left);
    }
  },
};

/** Four crew cards with faction fields and hire ranks. */
export const PortraitFaces: Story = {
  name: 'Portrait faces',
  parameters: {
    layout: 'centered',
    docs: {
      description: { story: 'Use PersonAvatar portraits for a crew deck, with a faction field, hire cost, role, and power.' },
      source: {
        language: 'tsx',
        code: `import { styled } from '@jfrader/ui';
import { base } from '@jfrader/tokens';
import { vars } from '@jfrader/tokens/vars';
import { DeckProvider, defineDeck } from '@jfrader/ui/deck';
import { GameCard } from '@jfrader/ui/game-card';
import { PersonAvatar } from '@jfrader/ui/person-avatar';

const FACTIONS = {
  ash: { field: '#31363b', glow: 'rgba(216, 199, 160, 0.22)', plate: '#d8c7a0', ink: '#2b2a25' },
  tide: { field: '#1d3a4d', glow: 'rgba(169, 214, 229, 0.24)', plate: '#a9d6e5', ink: '#123040' },
} as const;
const CREW = [
  { seed: 'mara-voss', faction: 'ash', rank: '1', name: 'Mara Voss', role: 'Fixer', power: 2 },
  { seed: 'otto-krane', faction: 'ash', rank: '2', name: 'Otto Krane', role: 'Muscle', power: 3 },
  { seed: 'jun-sable', faction: 'tide', rank: '1', name: 'Jun Sable', role: 'Wheelman', power: 1 },
  { seed: 'iris-vale', faction: 'tide', rank: '2', name: 'Iris Vale', role: 'Netrunner', power: 2 },
] as const;

const Face = styled.div({ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' });
const Field = styled.div<{ $field: string; $glow: string }>(({ $field, $glow }) => ({
  flex: '1 1 0', minBlockSize: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column',
  backgroundColor: $field,
  backgroundImage: 'radial-gradient(120% 76% at 50% 32%, ' + $glow + ', transparent 64%), linear-gradient(to top, rgba(0, 0, 0, 0.3), transparent 30%)',
}));
const Portrait = styled.div({
  flex: '1 1 0', minBlockSize: 0, overflow: 'hidden', display: 'grid',
  gridTemplateRows: 'minmax(0, 1fr)', placeItems: 'end center', paddingBlockStart: '9cqw',
  '& > svg': { blockSize: '100%' },
});
const Plate = styled.div({
  position: 'relative', display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'end',
  gap: '1.2cqw', padding: '4cqw 5cqw 4.5cqw', backgroundColor: vars.color.cardFace,
  borderBlockStart: '1px solid rgba(0, 0, 0, 0.16)', columnGap: '2cqw',
});
const Role = styled.span<{ $ink: string }>(({ $ink }) => ({
  gridColumn: '1 / -1', fontSize: '4.6cqw', fontWeight: 600, letterSpacing: '0.15em',
  textTransform: 'uppercase', lineHeight: 1, color: $ink,
}));
const Name = styled.span({ fontSize: '7.4cqw', fontWeight: 650, letterSpacing: '-0.015em', lineHeight: 1.08 });
const Power = styled.span({
  display: 'grid', placeItems: 'center', inlineSize: '11cqw', blockSize: '11cqw',
  borderRadius: '50%', border: '1px solid rgba(0, 0, 0, 0.35)', fontSize: '6.4cqw', fontWeight: 700, lineHeight: 1,
});
const Cost = styled.span({
  position: 'absolute', insetBlockStart: '4.5cqw', insetInlineStart: '4.5cqw',
  display: 'grid', placeItems: 'center', inlineSize: '16cqw', blockSize: '16cqw', borderRadius: '4cqw',
  backgroundColor: vars.color.cardFace, color: vars.color.cardInk,
  border: '1px solid rgba(0, 0, 0, 0.22)', fontSize: '8.6cqw', fontWeight: 650, lineHeight: 1,
});

function PortraitFace({ faction, cost, name, role, power, seed }: {
  faction: keyof typeof FACTIONS; cost: string; name: string; role: string; power: number; seed: string;
}) {
  const spec = FACTIONS[faction];
  return (
    <Face>
      <Field $field={spec.field} $glow={spec.glow}>
        <Portrait>
          <PersonAvatar seed={seed} fullKit size="full" primary={spec.plate} secondary={spec.ink} alt="" />
        </Portrait>
        <Cost>{cost}</Cost>
      </Field>
      <Plate>
        <Role $ink={spec.ink}>{role}</Role>
        <Name>{name}</Name>
        <Power>{power}</Power>
      </Plate>
    </Face>
  );
}

const deck = defineDeck({
  id: 'crew',
  suits: { ash: { label: 'Ash' }, tide: { label: 'Tide' } },
  ranks: { '1': { label: '1' }, '2': { label: '2' } },
  art: Object.fromEntries(CREW.map((member) => [
    member.faction + '-' + member.rank,
    <PortraitFace key={member.name} {...member} cost={member.rank} />,
  ])),
});

<DeckProvider decks={[deck]} default="crew">
  {CREW.map((member) => (
    <GameCard key={member.name} size="xl" label={member.name + ', ' + member.role.toLowerCase()}
      value={{ suit: member.faction, rank: member.rank }} />
  ))}
</DeckProvider>`,
      },
    },
  },
  render: () => (
    <DeckProvider decks={[crewDeck]} default="crew">
      <Flex wrap align="start" justify="center" gap="md">
        <GameCard size="xl" label="Mara Voss, fixer" value={{ suit: 'ash', rank: 1 }} />
        <GameCard size="xl" label="Otto Krane, muscle" value={{ suit: 'ash', rank: 2 }} />
        <GameCard size="xl" label="Jun Sable, wheelman" value={{ suit: 'tide', rank: 1 }} />
        <GameCard size="xl" label="Iris Vale, netrunner" value={{ suit: 'tide', rank: 2 }} />
      </Flex>
    </DeckProvider>
  ),
  play: async ({ canvas }) => {
    const mara = canvas.getByRole('img', { name: 'Mara Voss, fixer' });
    await expect(mara).toHaveTextContent('Mara Voss');
    await expect(mara).toHaveTextContent('Fixer');
    await expect(mara.querySelector('[data-ui="person-avatar"]')).not.toBeNull();
    await expect(canvas.getByRole('img', { name: 'Iris Vale, netrunner' }))
      .toHaveTextContent('Iris Vale');
  },
};


/** A deck can print its own suit glyphs and rank marks, with a pattern back. */
export const PrintedSuits: Story = {
  name: 'Printed suits and ranks',
  parameters: {
    layout: 'centered',
    docs: {
      description: { story: 'Print custom suit glyphs and rank marks without artwork, and give the deck a pattern back.' },
      source: {
        language: 'tsx',
        code: `import { styled } from '@jfrader/ui';
import { base } from '@jfrader/tokens';
import { vars } from '@jfrader/tokens/vars';
import { DeckProvider, defineDeck } from '@jfrader/ui/deck';
import { GameCard } from '@jfrader/ui/game-card';

const Row = styled.div({ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: vars.space[4] });

const deck = defineDeck({
  id: 'houses',
  suits: {
    sun: { label: 'sun', glyph: '✶', ink: 'red' },
    moon: { label: 'moon', glyph: '☾', ink: 'ink' },
    star: { label: 'star', glyph: '✦', ink: 'red' },
  },
  ranks: {
    I: { label: 'one', mark: 'I' },
    II: { label: 'two', mark: 'II' },
    III: { label: 'three', mark: 'III' },
  },
  back: { pattern: 'chevron', tone: 'accent' },
});

<DeckProvider decks={[deck]} default="houses">
  <Row>
    <GameCard size="lg" label="Three of suns" value={{ suit: 'sun', rank: 'III' }} />
    <GameCard size="lg" label="One of moons" value={{ suit: 'moon', rank: 'I' }} />
    <GameCard size="lg" label="Two of stars" value={{ suit: 'star', rank: 'II' }} />
    <GameCard size="lg" label="Houses back" face="back" />
  </Row>
</DeckProvider>`,
      },
    },
  },
  render: () => (
    <DeckProvider decks={[housesDeck]} default="houses">
      <Flex wrap align="start" justify="center" gap="md">
        <GameCard size="lg" label="Three of suns" value={{ suit: 'sun', rank: 'III' }} />
        <GameCard size="lg" label="One of moons" value={{ suit: 'moon', rank: 'I' }} />
        <GameCard size="lg" label="Two of stars" value={{ suit: 'star', rank: 'II' }} />
        <GameCard size="lg" label="Houses back" face="back" />
      </Flex>
    </DeckProvider>
  ),
  play: async ({ canvas }) => {
    const sun = canvas.getByRole('img', { name: 'Three of suns' });
    await expect(sun).toHaveTextContent('III');
    await expect(sun).toHaveTextContent('✶');
    const moon = canvas.getByRole('img', { name: 'One of moons' });
    await expect(moon).toHaveTextContent('I');
    await expect(moon).toHaveTextContent('☾');
    await expect(canvas.getByRole('img', { name: 'Two of stars' })).toHaveTextContent('✦');
    await expect(canvas.getByRole('img', { name: 'Houses back' }).querySelector('[data-ui="pattern"]'))
      .toHaveAttribute('data-variant', 'chevron');
  },
};

/** Printed faces still work when a deck has no artwork. */
export const BuiltInDecks: Story = {
  name: 'Built-in decks',
  parameters: {
    layout: 'centered',
    docs: {
      description: { story: 'Show the Spanish and French printed faces beside their conventional backs.' },
      source: {
        language: 'tsx',
        code: `import { styled } from '@jfrader/ui';
import { base } from '@jfrader/tokens';
import { vars } from '@jfrader/tokens/vars';
import { CARD_BACK_PATTERNS, GameCard } from '@jfrader/ui/game-card';

const Row = styled.div({ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: vars.space[4] });

<Row>
  <GameCard size="lg" label="As de oros" value={{ deck: 'spanish', suit: 'oros', rank: 1 }} />
  <GameCard size="lg" label="Spanish back" backPattern={CARD_BACK_PATTERNS.spanish} />
  <GameCard size="lg" label="Queen of hearts" value={{ deck: 'french', suit: 'hearts', rank: 'Q' }} />
  <GameCard size="lg" label="French back" backPattern={CARD_BACK_PATTERNS.french} />
</Row>`,
      },
    },
  },
  render: () => (
    <Flex wrap align="start" justify="center" gap="md">
      <GameCard size="lg" label="As de oros" value={{ deck: 'spanish', suit: 'oros', rank: 1 }} />
      <GameCard size="lg" label="Spanish back" backPattern={CARD_BACK_PATTERNS.spanish} />
      <GameCard size="lg" label="Queen of hearts" value={{ deck: 'french', suit: 'hearts', rank: 'Q' }} />
      <GameCard size="lg" label="French back" backPattern={CARD_BACK_PATTERNS.french} />
    </Flex>
  ),
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('img', { name: 'As de oros' })).toHaveTextContent('💰');
    await expect(canvas.getByRole('img', { name: 'As de oros' })).toHaveTextContent('1');
    await expect(canvas.getByRole('img', { name: 'Queen of hearts' })).toHaveTextContent('Q');
    await expect(canvas.getByRole('img', { name: 'Queen of hearts' })).toHaveTextContent('♥');
    await expect(canvas.getByRole('img', { name: 'Spanish back' }).querySelector('[data-ui="pattern"]'))
      .toHaveAttribute('data-variant', 'diagonal');
    await expect(canvas.getByRole('img', { name: 'French back' }).querySelector('[data-ui="pattern"]'))
      .toHaveAttribute('data-variant', 'checks');
    await expect(resolveCardArt(spanishDeck, { suit: 'oros', rank: '1' })).toBeUndefined();
    await expect(resolveCardArt(frenchDeck, { suit: 'hearts', rank: 'Q' })).toBeUndefined();
  },
};

/** The same card in three printings, each with its own field, crest palette, and back. */
export const RaritySets: Story = {
  name: 'Printings and rarity',
  parameters: {
    layout: 'centered',
    docs: {
      description: { story: 'Carry alternate printings in named art sets and read them side by side.' },
      source: {
        language: 'tsx',
        code: `import { styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';
import { DeckProvider, defineDeck } from '@jfrader/ui/deck';
import { Emblem } from '@jfrader/ui/emblem';
import { GameCard } from '@jfrader/ui/game-card';

const PRINTINGS = {
  standard: { label: 'Standard', field: '#3f4a52', crest: '#dbe2e6', ink: '#1c252b', pattern: 'hoops' },
  gilded: { label: 'Gilded', field: '#7a5a1e', crest: '#f2dfae', ink: '#3a2a08', pattern: 'sash' },
  relic: { label: 'Relic', field: '#3b1d4a', crest: '#e6d5ff', ink: '#241030', pattern: 'stripes' },
} as const;

const Face = styled.div<{ $field: string }>(({ $field }) => ({
  position: 'absolute', inset: 0, display: 'grid', gridTemplateRows: 'minmax(0, 1fr) auto',
  backgroundColor: $field,
  backgroundImage: 'radial-gradient(90% 60% at 50% 42%, rgba(255, 255, 255, 0.16), transparent 70%)',
}));
const Crest = styled.div({ display: 'grid', placeItems: 'center' });
const Plate = styled.div({
  position: 'relative', display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'end',
  gap: '1.2cqw', padding: '4cqw 5cqw', color: vars.color.cardFace,
});
const Tier = styled.span({ gridColumn: '1 / -1', fontSize: '4.6cqw', letterSpacing: '0.15em', textTransform: 'uppercase' });
const Name = styled.span({ fontSize: '7.4cqw', fontWeight: 650, lineHeight: 1.08 });
const Mark = styled.span({ fontSize: '7cqw', fontWeight: 700, lineHeight: 1 });
const Frame = styled.div<{ $crest: string }>(({ $crest }) => ({
  position: 'absolute', inset: '4cqw', border: '1px solid ' + $crest, opacity: 0.55, pointerEvents: 'none',
}));

function RelicFace({ printing, name, mark, initials }: {
  printing: keyof typeof PRINTINGS; name: string; mark: string; initials: string;
}) {
  const spec = PRINTINGS[printing];
  return (
    <Face $field={spec.field}>
      <Crest>
        <Emblem name={name} initials={initials} shape="hexagon" size="xl"
          color={spec.crest} inkColor={spec.ink} pattern={spec.pattern} />
      </Crest>
      <Plate>
        <Tier>{spec.label}</Tier>
        <Name>{name}</Name>
        <Mark>{mark}</Mark>
      </Plate>
      <Frame $crest={spec.crest} />
    </Face>
  );
}

const deck = defineDeck({
  id: 'sigils',
  suits: { sigils: { label: 'sigils' } },
  ranks: { '1': { label: 'Ember Sigil', mark: 'I' } },
  artSets: {
    standard: { 'sigils-1': <RelicFace printing="standard" name="Ember Sigil" mark="I" initials="ES" /> },
    gilded: { 'sigils-1': <RelicFace printing="gilded" name="Ember Sigil" mark="I" initials="ES" /> },
    relic: { 'sigils-1': <RelicFace printing="relic" name="Ember Sigil" mark="I" initials="ES" /> },
  },
  defaultArtSet: 'standard',
  back: { pattern: 'checks', tone: 'card' },
});

<DeckProvider decks={[deck]} default="sigils">
  <GameCard size="xl" label="Ember Sigil, standard" value={{ suit: 'sigils', rank: 1 }} />
  <GameCard size="xl" label="Ember Sigil, gilded" value={{ suit: 'sigils', rank: 1 }} artSet="gilded" />
  <GameCard size="xl" label="Ember Sigil, relic" value={{ suit: 'sigils', rank: 1 }} artSet="relic" />
</DeckProvider>`,
      },
    },
  },
  render: () => (
    <DeckProvider decks={[relicDeck]} default="sigils">
      <Flex wrap align="start" justify="center" gap="md">
        {(['standard', 'gilded', 'relic'] as const).map((printing) => (
          <Stack key={printing} gap="sm" align="center">
            <GameCard size="xl" label={`Ember Sigil, ${printing}`} value={{ suit: 'sigils', rank: 1 }} artSet={printing} />
            <CardCaption>{printing}</CardCaption>
          </Stack>
        ))}
      </Flex>
    </DeckProvider>
  ),
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('img', { name: 'Ember Sigil, standard' })).toHaveTextContent('Standard');
    await expect(canvas.getByRole('img', { name: 'Ember Sigil, gilded' })).toHaveTextContent('Gilded');
    const relic = canvas.getByRole('img', { name: 'Ember Sigil, relic' });
    await expect(relic).toHaveTextContent('Relic');
    await expect(relic.querySelector('[data-ui="emblem"]')).not.toBeNull();
  },
};

/** One card can name its own printing while the rest of the deck keeps the default. */
export const CardOverride: Story = {
  name: 'One card, another printing',
  parameters: {
    layout: 'centered',
    docs: {
      description: { story: 'Override one card in a region of the board and leave its neighbor on the deck default.' },
      source: {
        language: 'tsx',
        code: `import { DeckArtProvider, DeckProvider } from '@jfrader/ui/deck';
import { GameCard } from '@jfrader/ui/game-card';
// Your decks live in one client module.
import { relicDeck } from './decks';

<DeckProvider decks={[relicDeck]} default="sigils">
  <DeckArtProvider cardArtSets={{ 'sigils-1': 'gilded' }}>
    <GameCard size="xl" label="Ember Sigil" value={{ suit: 'sigils', rank: 1 }} />
    <GameCard size="xl" label="Tideglass" value={{ suit: 'sigils', rank: 2 }} />
  </DeckArtProvider>
</DeckProvider>`,
      },
    },
  },
  render: () => (
    <DeckProvider decks={[relicDeck]} default="sigils">
      <DeckArtProvider cardArtSets={{ 'sigils-1': 'gilded' }}>
        <Flex wrap align="start" justify="center" gap="md">
          <GameCard size="xl" label="Ember Sigil" value={{ suit: 'sigils', rank: 1 }} />
          <GameCard size="xl" label="Tideglass" value={{ suit: 'sigils', rank: 2 }} />
        </Flex>
      </DeckArtProvider>
    </DeckProvider>
  ),
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('img', { name: 'Ember Sigil' })).toHaveTextContent('Gilded');
    const neighbor = canvas.getByRole('img', { name: 'Tideglass' });
    await expect(neighbor).toHaveTextContent('Standard');
    await expect(neighbor).not.toHaveTextContent('Gilded');
  },
};

/** Cards without suits: each rank is the card, and the face is plain typography. */
export const StoryDeck: Story = {
  name: 'Suitless deck',
  parameters: {
    layout: 'centered',
    docs: {
      description: { story: 'Declare a suitless deck: one rank per card, and art keyed by that rank.' },
      source: {
        language: 'tsx',
        code: `import { styled } from '@jfrader/ui';
import { base } from '@jfrader/tokens';
import { vars } from '@jfrader/tokens/vars';
import { DeckProvider, defineDeck } from '@jfrader/ui/deck';
import { GameCard } from '@jfrader/ui/game-card';

const Face = styled.div({
  position: 'absolute', inset: 0, display: 'grid', gridTemplateRows: 'auto minmax(0, 1fr)',
  padding: '6cqw 5.5cqw 16cqw', backgroundColor: vars.color.cardFace, color: vars.color.cardInk,
});
const Top = styled.div({ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' });
const Mark = styled.span<{ $accent: string }>(({ $accent }) => ({
  fontSize: '7cqw', fontWeight: 700, letterSpacing: '0.04em', lineHeight: 1, color: $accent,
}));
const Category = styled.span({ fontSize: '4.4cqw', fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase' });
const Body = styled.div({ display: 'grid', alignContent: 'start', gap: '3.4cqw', paddingBlockStart: '12cqw' });
const Title = styled.span({ fontSize: '9.6cqw', fontWeight: 650, letterSpacing: '-0.02em', lineHeight: 1.06 });
const Rule = styled.span<{ $accent: string }>(({ $accent }) => ({
  inlineSize: '26%', blockSize: '1px', backgroundColor: $accent,
}));
const Text = styled.span({ fontSize: '5.4cqw', lineHeight: 1.45 });
const Band = styled.span<{ $accent: string }>(({ $accent }) => ({
  position: 'absolute', insetInline: 0, insetBlockEnd: 0, blockSize: '10.4cqw',
  display: 'flex', alignItems: 'center', paddingInline: '5.5cqw',
  backgroundColor: $accent, color: vars.color.cardFace,
  fontSize: '4.4cqw', fontWeight: 600, letterSpacing: '0.22em', textTransform: 'uppercase',
}));

function PromptFace({ mark, category, title, body, accent }: {
  mark: string; category: string; title: string; body: string; accent: string;
}) {
  return (
    <Face>
      <Top><Mark $accent={accent}>{mark}</Mark><Category>{category}</Category></Top>
      <Body>
        <Title>{title}</Title>
        <Rule $accent={accent} />
        <Text>{body}</Text>
      </Body>
      <Band $accent={accent}>Crossroads</Band>
    </Face>
  );
}

const PROMPTS = [
  { rank: 'the-stranger', mark: '07', category: 'Encounter', title: 'The Road Not Taken', accent: '#6b4bd6',
    body: 'A stranger knows your name and a door you never opened.' },
  { rank: 'the-debt', mark: '12', category: 'Bargain', title: 'The Debt', accent: '#b4452f',
    body: 'Someone paid for your passage. They will collect before the last light.' },
  { rank: 'the-door', mark: '03', category: 'Place', title: 'The Door', accent: '#2f6f63',
    body: 'It was not here this morning. It is open.' },
] as const;

const deck = defineDeck({
  id: 'crossroads',
  ranks: Object.fromEntries(PROMPTS.map((prompt) => [prompt.rank, { label: prompt.title, mark: prompt.mark }])),
  art: Object.fromEntries(PROMPTS.map((prompt) => [prompt.rank, <PromptFace key={prompt.rank} {...prompt} />])),
  back: { pattern: 'dots', tone: 'card' },
});

<DeckProvider decks={[deck]} default="crossroads">
  {PROMPTS.map((prompt) => (
    <GameCard key={prompt.rank} size="xl" label={prompt.title} value={{ rank: prompt.rank }} />
  ))}
</DeckProvider>`,
      },
    },
  },
  render: () => (
    <DeckProvider decks={[crossroadsDeck]} default="crossroads">
      <Flex wrap align="start" justify="center" gap="md">
        <GameCard size="xl" label="The Road Not Taken" value={{ rank: 'the-stranger' }} />
        <GameCard size="xl" label="The Debt" value={{ rank: 'the-debt' }} />
        <GameCard size="xl" label="The Door" value={{ rank: 'the-door' }} />
      </Flex>
    </DeckProvider>
  ),
  play: async ({ canvas }) => {
    const card = canvas.getByRole('img', { name: 'The Road Not Taken' });
    await expect(card).toHaveTextContent('The Road Not Taken');
    await expect(card).toHaveTextContent('07');
    await expect(card).not.toHaveTextContent('undefined');
    await expect(card.getAttribute('data-deck')).toBe('crossroads');
    await expect(card.querySelector('[data-ui="game-card-print"]')).toBeNull();
  },
};

/** A built-in deck keeps its printed index while its court cards gain portraits. */
export const BuiltInOverride: Story = {
  name: 'Illustrate a built-in court',
  parameters: {
    layout: 'centered',
    docs: {
      description: { story: 'Add artwork to three court cards of the Spanish deck and leave the rest printed.' },
      source: {
        language: 'tsx',
        code: `import { styled } from '@jfrader/ui';
import { base } from '@jfrader/tokens';
import { vars } from '@jfrader/tokens/vars';
import { DeckProvider, defineDeck, spanishDeck } from '@jfrader/ui/deck';
import { GameCard } from '@jfrader/ui/game-card';
import { PersonAvatar } from '@jfrader/ui/person-avatar';

const Face = styled.div({ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' });
const Field = styled.div({
  flex: '1 1 0', minBlockSize: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column',
  backgroundColor: '#5c1a24',
  backgroundImage: 'radial-gradient(120% 76% at 50% 32%, rgba(240, 214, 160, 0.26), transparent 64%)',
});
const Portrait = styled.div({
  flex: '1 1 0', minBlockSize: 0, overflow: 'hidden', display: 'grid',
  gridTemplateRows: 'minmax(0, 1fr)', placeItems: 'end center', paddingBlockStart: '9cqw',
  '& > svg': { blockSize: '100%' },
});
const Chip = styled.span({
  position: 'absolute', insetBlockStart: '4.5cqw', display: 'grid', placeItems: 'center',
  inlineSize: '16cqw', blockSize: '16cqw', backgroundColor: vars.color.cardFace,
  border: '1px solid rgba(0, 0, 0, 0.22)', fontSize: '8.6cqw', fontWeight: 650, lineHeight: 1,
});
const Cost = styled(Chip)({ insetInlineStart: '4.5cqw', borderRadius: '4cqw', color: vars.color.cardInk });
const Suit = styled(Chip)({ insetInlineEnd: '4.5cqw', borderRadius: '50%', fontSize: '8cqw' });
const Plate = styled.div({
  position: 'relative', display: 'grid', gap: '1.2cqw', padding: '4cqw 5cqw 4.5cqw',
  backgroundColor: vars.color.cardFace, borderBlockStart: '1px solid rgba(0, 0, 0, 0.16)',
});
const Role = styled.span({ fontSize: '4.6cqw', fontWeight: 600, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#3a0d14' });
const Name = styled.span({ fontSize: '7.4cqw', fontWeight: 650, lineHeight: 1.08 });

function CourtFace({ seed, cost, role, name }: { seed: string; cost: string; role: string; name: string }) {
  return (
    <Face>
      <Field>
        <Portrait>
          <PersonAvatar seed={seed} fullKit size="full" primary="#f0d6a0" secondary="#3a0d14" alt="" />
        </Portrait>
        <Cost>{cost}</Cost>
        <Suit>🍷</Suit>
      </Field>
      <Plate><Role>{role}</Role><Name>{name}</Name></Plate>
    </Face>
  );
}

const deck = defineDeck({
  ...spanishDeck,
  id: 'copas-court',
  art: {
    'copas-10': <CourtFace seed="sota-copas" cost="10" role="Sota" name="Sota de copas" />,
    'copas-11': <CourtFace seed="caballo-copas" cost="11" role="Caballo" name="Caballo de copas" />,
    'copas-12': <CourtFace seed="rey-copas" cost="12" role="Rey" name="Rey de copas" />,
  },
});

<DeckProvider decks={[deck]} default="copas-court">
  <GameCard size="xl" label="Rey de copas" value={{ suit: 'copas', rank: 12 }} />
  <GameCard size="xl" label="As de copas" value={{ suit: 'copas', rank: 1 }} />
</DeckProvider>`,
      },
    },
  },
  render: () => (
    <DeckProvider decks={[copasCourtDeck]} default="copas-court">
      <Flex wrap align="start" justify="center" gap="md">
        <GameCard size="xl" label="Sota de copas" value={{ suit: 'copas', rank: 10 }} />
        <GameCard size="xl" label="Caballo de copas" value={{ suit: 'copas', rank: 11 }} />
        <GameCard size="xl" label="Rey de copas" value={{ suit: 'copas', rank: 12 }} />
        <GameCard size="xl" label="As de copas" value={{ suit: 'copas', rank: 1 }} />
      </Flex>
    </DeckProvider>
  ),
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('img', { name: 'Rey de copas' })).toHaveTextContent('Rey de copas');
    await expect(canvas.getByRole('img', { name: 'Rey de copas' })
      .querySelector('[data-ui="person-avatar"]')).not.toBeNull();
    const ace = canvas.getByRole('img', { name: 'As de copas' });
    await expect(ace.querySelector('[data-ui="game-card-print"]')).not.toBeNull();
    await expect(ace).toHaveTextContent('🍷');
  },
};

/** The same deck definition reaches a hand, a flip card, and a single card. */
export const InPlay: Story = {
  name: 'Deck in play',
  parameters: {
    layout: 'centered',
    docs: {
      description: { story: 'Share one deck across a hand, a flip card, and a single card, with a per-card printing.' },
      source: {
        language: 'tsx',
        code: `import { DeckProvider } from '@jfrader/ui/deck';
import { FlipGameCard } from '@jfrader/ui/flip-game-card';
import { GameCard } from '@jfrader/ui/game-card';
import { GameHand } from '@jfrader/ui/game-hand';
// Your decks live in one client module.
import { northlineDeck, relicDeck } from './decks';

<DeckProvider decks={[northlineDeck, relicDeck]} default="northline" backLabel="Card back">
  <GameHand size="md" cards={[
    { id: 'ridge-1', label: 'Sable Ridge', value: { suit: 'ridge', rank: 1 } },
    { id: 'dunes-2', label: 'Glass Waste', value: { suit: 'dunes', rank: 2 } },
    { id: 'coast-3', label: 'Tide Gate', value: { suit: 'coast', rank: 3 } },
  ]}>
    <GameHand.Confirm>Play card</GameHand.Confirm>
  </GameHand>
  <FlipGameCard size="md" label="Tide Gate, flip card" value={{ suit: 'coast', rank: 3 }} />
  <GameCard size="md" label="Promo Sigil" value={{ deck: 'sigils', suit: 'sigils', rank: 1 }}
    cardArtSets={{ 'sigils-1': 'gilded' }} />
  <GameCard size="md" label="Sigils relic back" face="back"
    artSet="relic" value={{ deck: 'sigils', suit: 'sigils', rank: 1 }} />
</DeckProvider>`,
      },
    },
  },
  render: () => (
    <DeckProvider decks={[northlineDeck, relicDeck]} default="northline" backLabel="Card back">
      <Stack gap="md" align="center">
        <GameHand size="md" cards={[
          { id: 'ridge-1', label: 'Sable Ridge', value: { suit: 'ridge', rank: 1 } },
          { id: 'dunes-2', label: 'Glass Waste', value: { suit: 'dunes', rank: 2 } },
          { id: 'coast-3', label: 'Tide Gate', value: { suit: 'coast', rank: 3 } },
        ]}>
          <GameHand.Confirm>Play card</GameHand.Confirm>
        </GameHand>
        <Flex wrap align="end" justify="center" gap="md">
          <FlipGameCard size="md" label="Tide Gate, flip card" value={{ suit: 'coast', rank: 3 }} />
          <GameCard size="md" label="Promo Sigil" value={{ deck: 'sigils', suit: 'sigils', rank: 1 }} cardArtSets={{ 'sigils-1': 'gilded' }} />
          <GameCard size="md" label="Sigils relic back" face="back" artSet="relic" value={{ deck: 'sigils', suit: 'sigils', rank: 1 }} />
        </Flex>
      </Stack>
    </DeckProvider>
  ),
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('button', { name: 'Sable Ridge' })).toBeVisible();
    await expect(canvas.getByRole('img', { name: 'Tide Gate, flip card' })).toBeVisible();
    await expect(canvas.getByRole('img', { name: 'Promo Sigil' })).toHaveTextContent('Gilded');
    const hidden = canvas.getByRole('img', { name: 'Sigils relic back' });
    await expect(hidden).toHaveAttribute('data-face', 'back');
    await expect(hidden.querySelector('[data-ui="emblem"]')).not.toBeNull();
  },
};

/** A card without art prints its rank mark. */
export const MissingArt: Story = {
  name: 'Missing artwork',
  parameters: {
    layout: 'centered',
    docs: {
      description: { story: 'Fall back to the printed face when a deck has no artwork for a card.' },
      source: {
        language: 'tsx',
        code: `import { DeckProvider, defineDeck } from '@jfrader/ui/deck';
import { GameCard } from '@jfrader/ui/game-card';
import { crossroadsDeck } from './decks';

// Remove one face from an illustrated deck; the card it covered prints instead.
const deck = defineDeck({
  ...crossroadsDeck,
  id: 'sparse',
  art: { 'the-stranger': crossroadsDeck.art?.['the-stranger'] },
});

<DeckProvider decks={[deck]} default="sparse">
  <GameCard size="xl" label="The Road Not Taken" value={{ rank: 'the-stranger' }} />
  <GameCard size="xl" label="The Debt" value={{ rank: 'the-debt' }} />
</DeckProvider>`,
      },
    },
  },
  render: () => (
    <DeckProvider decks={[sparseDeck]} default="sparse">
      <Flex wrap align="start" justify="center" gap="md">
        <GameCard size="xl" label="The Road Not Taken" value={{ rank: 'the-stranger' }} />
        <GameCard size="xl" label="The Debt" value={{ rank: 'the-debt' }} />
      </Flex>
    </DeckProvider>
  ),
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('img', { name: 'The Road Not Taken' })).toHaveTextContent('The Road Not Taken');
    const debt = canvas.getByRole('img', { name: 'The Debt' });
    await expect(debt.querySelector('[data-ui="game-card-print"]')).not.toBeNull();
    await expect(debt).toHaveTextContent('12');
    await expect(debt).not.toHaveTextContent('undefined');
    const mark = debt.querySelector('[data-card-mark]');
    await expect(mark?.children.length).toBe(1);
  },
};

/** Unlisted ranks and suits print their ids instead of failing. */
export const UnlistedRankAndSuit: Story = {
  name: 'Unlisted rank and suit',
  parameters: {
    layout: 'centered',
    docs: {
      description: { story: 'Print unknown rank and suit ids when a deck has no matching labels.' },
      source: {
        language: 'tsx',
        code: `import { GameCard } from '@jfrader/ui/game-card';

<GameCard label="Unknown card" value={{ suit: 'comets', rank: '99' }} />`,
      },
    },
  },
  render: () => <GameCard label="Unknown card" value={{ suit: 'comets', rank: '99' }} />,
  play: async ({ canvas }) => {
    const card = canvas.getByRole('img', { name: 'Unknown card' });
    await expect(card).toHaveTextContent('comets');
    await expect(card).toHaveTextContent('99');
  },
};

const resolverDeck = defineDeck({
  id: 'resolver',
  suits: { stars: { label: 'stars', glyph: '⭐', ink: 'red' }, moons: { label: 'moons', glyph: '🌙', ink: 'ink' } },
  ranks: { I: { label: 'I', mark: 'I' }, II: { label: 'II', mark: 'II' }, III: { label: 'III', mark: 'III' } },
  art: { 'stars-II': 'BASE II' },
  artSets: {
    spooky: { 'stars-I': 'SPOOKY I', 'moons-I': 'SPOOKY MOON' },
    rare: { 'stars-I': 'RARE I' },
  },
  defaultArtSet: 'spooky',
  back: { pattern: 'dots', tone: 'accent' },
  backs: { rare: { pattern: 'waves', tone: 'card' } },
});

export const ResolverContract: Story = {
  tags: ['!autodocs'],
  render: () => (
    <DeckProvider decks={[resolverDeck]} default="resolver">
      <Flex wrap align="start" justify="center" gap="md">
        <GameCard size="lg" label="Spooky star" value={{ suit: 'stars', rank: 'I' }} artSet="spooky" />
        <GameCard size="lg" label="Rare star" value={{ suit: 'stars', rank: 'I' }} artSet="spooky" cardArtSets={{ 'stars-I': 'rare' }} />
        <GameCard size="lg" label="Base star" value={{ suit: 'stars', rank: 'II' }} />
        <GameCard size="lg" label="Printed star" value={{ suit: 'stars', rank: 'I' }} artSet="spooky" face="print" />
        <GameCard size="lg" label="Empty suit" value={{ suit: '', rank: 'I' }} />
      </Flex>
    </DeckProvider>
  ),
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('img', { name: 'Spooky star' })).toHaveTextContent('SPOOKY I');
    const rare = canvas.getByRole('img', { name: 'Rare star' });
    await expect(rare).toHaveTextContent('RARE I');
    await expect(rare).not.toHaveTextContent('SPOOKY I');
    await expect(canvas.getByRole('img', { name: 'Base star' })).toHaveTextContent('BASE II');
    const printed = canvas.getByRole('img', { name: 'Printed star' });
    await expect(printed).not.toHaveTextContent('SPOOKY');
    await expect(printed.querySelector('[data-ui="game-card-print"]')).not.toBeNull();
    const emptySuit = canvas.getByRole('img', { name: 'Empty suit' }).querySelector('[data-card-mark]');
    await expect(emptySuit?.children.length).toBe(1);

    const request = { suit: 'stars', rank: 'I' };
    await expect(defineDeck(resolverDeck)).toBe(resolverDeck);
    await expect(cardArtId(resolverDeck, 'stars', 'I')).toBe('stars-I');
    await expect(cardArtId(resolverDeck, undefined, 'I')).toBe('I');
    await expect(cardArtId(resolverDeck, '', 'I')).toBe('I');
    await expect(resolveCardArt(resolverDeck, request)).toBe(resolverDeck.artSets?.spooky?.['stars-I']);
    await expect(resolveCardArt(resolverDeck, { ...request, artSet: 'rare' })).toBe(resolverDeck.artSets?.rare?.['stars-I']);
    await expect(resolveCardArt(resolverDeck, { ...request, artSet: 'rare', cardArtSet: 'missing' })).toBeUndefined();
    await expect(resolveCardArt(resolverDeck, { suit: 'stars', rank: 'II', artSet: 'missing' })).toBe(resolverDeck.art?.['stars-II']);
    await expect(resolveCardArt(resolverDeck, { ...request, mode: 'print', cardArtSet: 'rare' })).toBeUndefined();
    await expect(resolveDeckBack(resolverDeck, 'rare')).toBe(resolverDeck.backs?.rare);
    await expect(resolveDeckBack(resolverDeck, 'missing')).toBe(resolverDeck.back);
    await expect(resolveDeckBack(resolverDeck)).toBe(resolverDeck.back);

    const custom = defineDeck({
      ...resolverDeck,
      cardId: (suit: string | undefined, rank: string) => JSON.stringify([suit, rank]),
      art: { '["a-b","c"]': 'FIRST', '["a","b-c"]': 'SECOND' },
    });
    await expect(cardArtId(custom, 'a-b', 'c')).toBe('["a-b","c"]');
    await expect(resolveCardArt(custom, { suit: 'a-b', rank: 'c' })).toBe('FIRST');
    await expect(resolveCardArt(custom, { suit: 'a', rank: 'b-c' })).toBe('SECOND');

    const falsy = defineDeck({
      ...resolverDeck,
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

    const noArt: Deck = { id: 'plain' };
    await expect(resolveCardArt(noArt, request)).toBeUndefined();
    await expect(resolveDeckBack(noArt)).toBeUndefined();

    const bare = defineDeck({ id: 'bare', art: { I: 'BARE' } });
    await expect(cardArtId(bare, undefined, 'I')).toBe('I');
    await expect(resolveCardArt(bare, { rank: 'I' })).toBe('BARE');
  },
};

export const UnknownDeckThrows: Story = {
  tags: ['!autodocs'],
  render: () => {
    let message = '';
    try {
      useDeck('atlantis');
    } catch (error) {
      if (error instanceof UnknownDeckError) message = error.message;
    }
    return <Flex wrap align="start" justify="center" gap="md">{message}</Flex>;
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText(/Unknown deck: "atlantis"/)).toBeVisible();
  },
};
