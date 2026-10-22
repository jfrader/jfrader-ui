import { styled } from '../../index';
import { vars } from '@jfrader/tokens/vars';
import { defineDeck } from '../deck';
import { sceneSource, type SceneGrade, type SceneVariant } from '../scene';

/**
 * Story-only fixtures for the card family. A shipped game serves card faces as images, so the
 * artwork here is `<img>` art built from deterministic data URLs: no network, no binary assets.
 * The frame around the image is library composition, the same way a game layers its own chrome.
 */

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

const Face = styled.div({
  position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
  color: vars.color.cardInk, fontFamily: vars.font.sans,
});

const FaceArt = styled.div({
  position: 'relative',
  flex: '1 1 0',
  minBlockSize: 0,
  overflow: 'hidden',
  '& > img': { display: 'block', inlineSize: '100%', blockSize: '100%', objectFit: 'cover' },
});

const Plate = styled.div({
  flex: '0 0 auto',
  display: 'grid',
  gap: '1.2cqw',
  padding: '4cqw 5cqw 4.5cqw',
  backgroundColor: vars.color.cardFace,
  borderBlockStart: '1px solid rgba(0, 0, 0, 0.16)',
});

const Kicker = styled.span<{ $ink: string }>(({ $ink }) => ({
  fontSize: '4.6cqw', fontWeight: 600, letterSpacing: '0.15em', textTransform: 'uppercase',
  lineHeight: 1, color: $ink,
}));

const Title = styled.span({
  fontSize: '8cqw', fontWeight: 650, letterSpacing: '-0.015em', lineHeight: 1.08, textWrap: 'balance',
});

const IndexChip = styled.span({
  position: 'absolute', insetBlockStart: '4.5cqw', insetInlineStart: '4.5cqw',
  display: 'grid', placeItems: 'center', inlineSize: '16cqw', blockSize: '16cqw',
  borderRadius: '4cqw', backgroundColor: vars.color.cardFace, color: vars.color.cardInk,
  border: '1px solid rgba(0, 0, 0, 0.22)', boxShadow: '0 1px 4px rgba(0, 0, 0, 0.3)',
  fontSize: '8.6cqw', fontWeight: 650, lineHeight: 1, letterSpacing: '-0.02em',
});

const Back = styled.div({
  position: 'absolute', inset: 0, display: 'grid',
  gridTemplate: 'minmax(0, 1fr) / minmax(0, 1fr)',
  '& > img': { gridArea: '1 / 1', display: 'block', inlineSize: '100%', blockSize: '100%', objectFit: 'cover' },
});

const Wordmark = styled.span({
  gridArea: '1 / 1', alignSelf: 'end', justifySelf: 'center', marginBlockEnd: '8cqw',
  padding: '1.6cqw 3.6cqw', borderRadius: '1.6cqw', backgroundColor: vars.color.cardFace,
  fontSize: '5.4cqw', fontWeight: 650, letterSpacing: '0.2em', textTransform: 'uppercase',
  color: '#7a1024', textIndent: '0.2em',
});

/** A card face whose artwork is an image, framed by a printed index and a title plate. */
export function siteFace({ region, rank, name }: { region: Region; rank: string; name: string }) {
  const spec = REGIONS[region];
  return (
    <Face>
      <FaceArt>
        <img
          src={sceneSource(`northline-${region}-${rank}`, { variant: spec.variant, grade: spec.grade })}
          alt=""
          draggable={false}
          decoding="async"
        />
        <IndexChip>{rank}</IndexChip>
      </FaceArt>
      <Plate>
        <Kicker $ink={spec.ink}>{spec.label} · {rank} of 4</Kicker>
        <Title>{name}</Title>
      </Plate>
    </Face>
  );
}

/** A full-bleed image for one card, when the image already carries its own frame. */
export function siteImage(region: Region, rank: string) {
  const spec = REGIONS[region];
  return (
    <img
      src={sceneSource(`northline-${region}-${rank}`, { variant: spec.variant, grade: spec.grade })}
      alt=""
      draggable={false}
      decoding="async"
    />
  );
}

function siteBack() {
  return (
    <Back>
      <img
        src={sceneSource('northline-back', { variant: 'dusk', grade: 'warm' })}
        alt=""
        draggable={false}
        decoding="async"
      />
      <Wordmark>Northline</Wordmark>
    </Back>
  );
}

/** The image deck used by the GameCard, FlipGameCard, and GameHand examples. */
export const imageDeck = defineDeck({
  id: 'northline-images',
  suits: Object.fromEntries(Object.entries(REGIONS).map(([key, spec]) => [key, { label: spec.label }])),
  ranks: Object.fromEntries(SITES.map((site) => [site.rank, { label: site.rank, mark: site.rank }])),
  art: Object.fromEntries(SITES.map((site) => [`${site.region}-${site.rank}`, siteFace(site)])),
  back: siteBack(),
});

/** Hero row of image cards, one per region. */
export const heroSites = SITES.filter((site) => site.rank === '1');

/** Five cards for a hand, in fan order. */
export const imageHandCards = [SITES[0], SITES[4], SITES[8], SITES[12], SITES[5]].map((site) => ({
  id: `${site.region}-${site.rank}`,
  label: site.name,
  value: { deck: 'northline-images' as const, suit: site.region, rank: site.rank },
}));

export { SITES as IMAGE_SITES, REGIONS as IMAGE_REGIONS };
