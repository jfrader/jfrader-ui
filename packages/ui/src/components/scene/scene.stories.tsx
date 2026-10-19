import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, waitFor, within } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { withLightTheme } from '../../testing/story-decorators';
import { Avatar } from '../avatar';
import { DeckProvider, defineDeck } from '../deck';
import { GameCard } from '../game-card';
import { Scene, sceneSource, type SceneGrade, type SceneSize, type SceneVariant } from './index';
import { generateSceneParts, generateSceneSvg, SCENE_PARAMETERS } from './scene-generator';
import { hashSeed, createPrng } from '../../utils/seeded';
import { SCENE_FIXTURES, HASH_FIXTURES, PRNG_FIXTURES } from './reference-fixtures';
// `styled` is the app-facing styling API; consumers import it from `@jfrader/ui`.
import { styled } from '../../index';

const WidePreview = styled.div({ maxInlineSize: '640px', borderRadius: vars.radius.md, overflow: 'hidden' });

const MutedLabel = styled.span({ fontSize: vars.textSize.sm, color: vars.color.textMuted });

const ScenePreview = styled.div({ blockSize: '180px', borderRadius: vars.radius.sm, overflow: 'hidden' });

const SceneColumn = styled.div({ display: 'flex', flexDirection: 'column', gap: vars.space[3] });

const SceneGrid = styled.div({ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: vars.space[3] });

const LandscapePreview = styled.div({ blockSize: '160px', borderRadius: vars.radius.md, overflow: 'hidden' });

const NarrowLandscapePreview = styled(LandscapePreview)({ maxInlineSize: '300px' });

const SeedLabel = styled.span({ fontSize: vars.textSize.sm, fontWeight: vars.fontWeight.medium });

const CropColumn = styled.div({ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: vars.space[1] });

const CropCaption = styled.span({ fontSize: vars.textSize.xs, color: vars.color.textMuted });

const AvatarRow = styled.div({ display: 'flex', alignItems: 'center', gap: vars.space[4] });

const SizeColumn = styled.div({ display: 'flex', flexDirection: 'column', gap: vars.space[4] });

const SizeRow = styled.div({ display: 'flex', alignItems: 'center', gap: vars.space[3] });

const SizeLabel = styled.span({ inlineSize: '40px', fontSize: vars.textSize.xs, color: vars.color.textMuted });

const ClippedScene = styled.div({ borderRadius: vars.radius.sm, overflow: 'hidden' });

const ComparisonRow = styled.div({ display: 'flex', gap: vars.space[4] });

const ComparisonPreview = styled.div({ inlineSize: '240px', borderRadius: vars.radius.sm, overflow: 'hidden' });

const VARIANTS = ['landscape', 'dunes', 'dusk', 'tide'] as const satisfies readonly SceneVariant[];
const GRADES = ['raw', 'warm'] as const satisfies readonly SceneGrade[];
const SIZES = ['sm', 'md', 'lg', 'full'] as const satisfies readonly SceneSize[];
const FRAME_PARTS = ['sky', 'light', 'ground', 'haze', 'wash', 'vignette', 'grain'] as const;

const idsOf = (markup: string) => new Set(Array.from(markup.matchAll(/ id="([^"]+)"/g), ([, id]) => id));
/** Markup with its generated colours removed; mask colours (`#fff`, `#000`) stay. */
const geometryOf = (markup: string) => markup.replace(/#[0-9a-f]{6}/g, '');

const Rail = styled.div({
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
  gap: vars.space[4],
});

const Card = styled.div({
  display: 'flex',
  flexDirection: 'column',
  gap: vars.space[2],
  padding: vars.space[3],
  borderRadius: vars.radius.md,
  border: `1px solid ${vars.color.border}`,
  backgroundColor: vars.color.surface,
});

const CropRow = styled.div({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: vars.space[4],
});

const CircleCrop = styled.div({
  inlineSize: '80px',
  blockSize: '80px',
  borderRadius: vars.radius.full,
  overflow: 'hidden',
  flexShrink: 0,
});

const WideCrop = styled.div({
  inlineSize: '320px',
  blockSize: '120px',
  borderRadius: vars.radius.md,
  overflow: 'hidden',
  flexShrink: 0,
});

const SquareCrop = styled.div({
  inlineSize: '120px',
  blockSize: '120px',
  borderRadius: vars.radius.md,
  overflow: 'hidden',
  flexShrink: 0,
});

const meta = {
  title: 'Media/Scene',
  component: Scene,
  parameters: {
    docs: {
      description: {
        component: 'Render procedural landscape artwork and avatars from deterministic seeds.',
      },
      source: {
        language: 'tsx',
        code: `import { Scene } from '@jfrader/ui/scene';

<Scene seed="north-dunes" variant="landscape" />`,
      },
      usage: `
### Setup
- Import from \`@jfrader/ui/scene\`. Scene is an opt-in subpath and is not re-exported by the package root.

### Seeds
Pass any string to \`seed\`. The same seed produces identical artwork across reloads and platforms.

### Variants
Choose \`landscape\`, \`dunes\`, \`dusk\`, or \`tide\` to change the terrain style and lighting.

### Grades
Set \`grade="warm"\` for a warmer final grade of the same scene. Only colours change, so a raw and a warm scene from one seed line up as a before/after pair.

### Image slots
Use \`sceneSource(seed, options)\` to generate a \`data:image/svg+xml\` URL for image-slot components such as \`Avatar\`.

### Accessibility
Provide \`alt\` or \`aria-label\` to describe the scene. Pass \`aria-hidden\` or an empty \`alt\` string when the scene is decorative.
`,
    },
  },
  args: {
    seed: 'north-dunes',
    variant: 'landscape',
    size: 'full',
  },
  argTypes: {
    variant: { control: 'radio', options: VARIANTS },
    size: { control: 'radio', options: SIZES },
  },
} satisfies Meta<typeof Scene>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Frozen terrain and color grades across four seeds. */
export const SeededCoreParity: Story = {
  render: (args) => <Scene {...args} />,
  play: async () => {
    for (const { seed, variant, grade, parts, svg, url } of SCENE_FIXTURES) {
      await expect(generateSceneParts(seed, variant, grade)).toEqual(parts);
      await expect(generateSceneSvg(seed, variant, grade)).toBe(svg);
      await expect(sceneSource(seed, { variant, grade })).toBe(url);
    }
    for (const [seed, hash] of HASH_FIXTURES) await expect(hashSeed(seed)).toBe(hash);
    for (const [seed, draws] of PRNG_FIXTURES) {
      const next = createPrng(seed);
      await expect(Array.from({ length: 16 }, next)).toEqual(draws);
    }
  },
};

/** Default scene rendered inline at full container width. */
export const Default: Story = {
  render: (args) => (
    <WidePreview>
      <Scene {...args} />
    </WidePreview>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const scene = canvas.getByRole('img', { name: 'north-dunes' });
    await expect(scene).toBeInTheDocument();
    await expect(scene).toHaveAttribute('data-ui', 'scene');
    await expect(scene).toHaveAttribute('viewBox', '0 0 1200 800');
    await expect(scene.querySelector('defs')).not.toBeNull();
    await expect(scene.querySelector('rect')).not.toBeNull();
  },
};

/** Rail of distinct seeds across different variants. */
export const SeedsRail: Story = {
  render: () => (
    <Rail>
      <Card>
        <MutedLabel>landscape — alpine-ridge</MutedLabel>
        <ScenePreview>
          <Scene seed="alpine-ridge" variant="landscape" />
        </ScenePreview>
      </Card>
      <Card>
        <MutedLabel>dunes — north-dunes</MutedLabel>
        <ScenePreview>
          <Scene seed="north-dunes" variant="dunes" />
        </ScenePreview>
      </Card>
      <Card>
        <MutedLabel>dusk — twilight-fjord</MutedLabel>
        <ScenePreview>
          <Scene seed="twilight-fjord" variant="dusk" />
        </ScenePreview>
      </Card>
      <Card>
        <MutedLabel>tide — coastal-swell</MutedLabel>
        <ScenePreview>
          <Scene seed="coastal-swell" variant="tide" />
        </ScenePreview>
      </Card>
      <Card>
        <MutedLabel>landscape — emerald-summit</MutedLabel>
        <ScenePreview>
          <Scene seed="emerald-summit" variant="landscape" />
        </ScenePreview>
      </Card>
      <Card>
        <MutedLabel>dunes — sahara-wind</MutedLabel>
        <ScenePreview>
          <Scene seed="sahara-wind" variant="dunes" />
        </ScenePreview>
      </Card>
    </Rail>
  ),
};

/** Determinism check verifying identical output for identical seeds. */
export const Determinism: Story = {
  render: () => (
    <SceneColumn>
      <SceneGrid>
        <LandscapePreview>
          <Scene seed="same-seed-target" variant="landscape" alt="Target A" />
        </LandscapePreview>
        <LandscapePreview>
          <Scene seed="same-seed-target" variant="landscape" alt="Target B" />
        </LandscapePreview>
      </SceneGrid>
      <NarrowLandscapePreview>
        <Scene seed="different-seed-sample" variant="landscape" alt="Different" />
      </NarrowLandscapePreview>
    </SceneColumn>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const sceneA = canvas.getByRole('img', { name: 'Target A' });
    const sceneB = canvas.getByRole('img', { name: 'Target B' });
    const sceneDiff = canvas.getByRole('img', { name: 'Different' });

    // Inner markup must match character-for-character for the same seed
    await expect(sceneA.innerHTML).toBe(sceneB.innerHTML);
    // Distinct seeds must produce distinct markup
    await expect(sceneA.innerHTML).not.toBe(sceneDiff.innerHTML);

    // sceneSource URL determinism
    const srcA = sceneSource('same-seed-target', { variant: 'landscape' });
    const srcB = sceneSource('same-seed-target', { variant: 'landscape' });
    const srcDiff = sceneSource('different-seed-sample', { variant: 'landscape' });
    await expect(srcA).toBe(srcB);
    await expect(srcA).not.toBe(srcDiff);

    // Every variant is byte-identical for one seed and differs across seeds.
    for (const variant of VARIANTS) {
      await expect(generateSceneSvg('same-seed-target', variant)).toBe(generateSceneSvg('same-seed-target', variant));
      await expect(generateSceneSvg('same-seed-target', variant)).not.toBe(
        generateSceneSvg('different-seed-sample', variant),
      );
    }
    // One seed in two variants shares no ids, so inline scenes never resolve each other's defs.
    const variantIds = VARIANTS.map((variant) => idsOf(generateSceneSvg('same-seed-target', variant)));
    for (const [index, ids] of variantIds.entries()) {
      for (const other of variantIds.slice(index + 1)) {
        await expect([...ids].filter((id) => other.has(id))).toEqual([]);
      }
    }
  },
};

/** One seed in its raw colours and with the warm grade. */
export const Grades: Story = {
  render: () => (
    <Rail>
      {GRADES.map((grade) => (
        <Card key={grade}>
          <SeedLabel>{grade}</SeedLabel>
          <ScenePreview>
            <Scene seed="grade-check" grade={grade} alt={`${grade} grade`} />
          </ScenePreview>
        </Card>
      ))}
    </Rail>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const raw = canvas.getByRole('img', { name: 'raw grade' });
    const warm = canvas.getByRole('img', { name: 'warm grade' });
    await expect(warm).toHaveAttribute('data-grade', 'warm');
    // The raw grade is the ungraded scene.
    await expect(generateSceneSvg('grade-check', 'landscape', 'raw')).toBe(generateSceneSvg('grade-check'));
    for (const variant of VARIANTS) {
      const rawSvg = generateSceneSvg('grade-check', variant, 'raw');
      const warmSvg = generateSceneSvg('grade-check', variant, 'warm');
      await expect(generateSceneSvg('grade-check', variant, 'warm')).toBe(warmSvg);
      await expect(warmSvg).not.toBe(rawSvg);
      // Same geometry and structure: only colours and id prefixes differ.
      await expect(geometryOf(warmSvg).replaceAll('-warm-', '-')).toBe(geometryOf(rawSvg));
      const rawIds = idsOf(rawSvg);
      await expect([...idsOf(warmSvg)].filter((id) => rawIds.has(id))).toEqual([]);
    }
    // Both grades render inline in one document; every reference resolves inside its own scene.
    for (const scene of [raw, warm]) {
      for (const [, id] of scene.innerHTML.matchAll(/url\(#([^)]+)\)/g)) {
        await expect(scene.querySelector(`[id="${id}"]`)).not.toBeNull();
      }
      await expect(scene.innerHTML).not.toMatch(/NaN|undefined|Infinity/);
    }
  },
};

/** One seed in every variant: clouds over landscape, dunes and tide, stars over dusk, water and shore on tide. */
export const ArtworkLayers: Story = {
  render: () => (
    <Rail>
      {VARIANTS.map((variant) => (
        <Card key={variant}>
          <SeedLabel>{variant}</SeedLabel>
          <ScenePreview>
            <Scene seed="layer-check" variant={variant} alt={`${variant} layers`} />
          </ScenePreview>
        </Card>
      ))}
    </Rail>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    for (const variant of VARIANTS) {
      const scene = canvas.getByRole('img', { name: `${variant} layers` });
      const params = SCENE_PARAMETERS[variant];
      const coast = params.ground.kind === 'coast';
      const count = (selector: string) => scene.querySelectorAll(selector).length;
      for (const name of FRAME_PARTS) await expect(count(`[data-part="${name}"]`)).toBe(1);
      await expect(count('[data-part="clouds"]')).toBe(params.clouds ? 1 : 0);
      await expect(count('[data-part="stars"]')).toBe(params.stars ? 1 : 0);
      await expect(count('[data-part="reflection"]')).toBe(coast ? 1 : 0);
      await expect(count('[data-part="shore"]')).toBe(coast ? 1 : 0);
      if (params.stars) {
        await expect(count('[data-part="stars"] circle')).toBeGreaterThanOrEqual(params.stars.count.min);
      }
      if (params.ground.kind === 'layers') {
        await expect(count('[data-part="ground"] > [data-layer]')).toBeGreaterThanOrEqual(params.ground.layerCount.min);
      }
      // Grain and vignette keep their table strength after rounding.
      const grain = scene.querySelector('[data-part="grain"] rect')!;
      await expect(Number(grain.getAttribute('opacity'))).toBeGreaterThanOrEqual(params.grainOpacity.min);
      const vignette = scene.querySelector('[id$="-vignette"] stop:last-child')!;
      await expect(Number(vignette.getAttribute('stop-opacity'))).toBeGreaterThanOrEqual(params.vignetteOpacity.min);
      // Every reference resolves inside the same scene.
      for (const [, id] of scene.innerHTML.matchAll(/url\(#([^)]+)\)/g)) {
        await expect(scene.querySelector(`[id="${id}"]`)).not.toBeNull();
      }
      // Procedural colours only, and every number formatted.
      await expect(scene.innerHTML).not.toMatch(/var\(|NaN|undefined|Infinity/);
    }
  },
};

/** Central safe-zone framing across circular avatar, wide banner, and square tile crops. */
export const AspectCrops: Story = {
  render: (args) => (
    <CropRow>
      <CropColumn>
        <CircleCrop>
          <Scene {...args} />
        </CircleCrop>
        <CropCaption>Circle (1:1)</CropCaption>
      </CropColumn>
      <CropColumn>
        <SquareCrop>
          <Scene {...args} />
        </SquareCrop>
        <CropCaption>Square (1:1)</CropCaption>
      </CropColumn>
      <CropColumn>
        <WideCrop>
          <Scene {...args} />
        </WideCrop>
        <CropCaption>Wide banner (8:3)</CropCaption>
      </CropColumn>
    </CropRow>
  ),
};

/** Using `sceneSource` data URLs inside Avatar image slots. */
export const AvatarContent: Story = {
  render: () => (
    <AvatarRow>
      <Avatar
        name="Dune Explorer"
        src={sceneSource('north-dunes', { variant: 'dunes' })}
        size="lg"
      />
      <Avatar
        name="Alpine Climber"
        src={sceneSource('alpine-ridge', { variant: 'landscape' })}
        size="lg"
      />
      <Avatar
        name="Night Watch"
        src={sceneSource('twilight-fjord', { variant: 'dusk' })}
        size="lg"
      />
      <Avatar
        name="Ocean Surfer"
        src={sceneSource('coastal-swell', { variant: 'tide' })}
        size="lg"
      />
    </AvatarRow>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const avatar = canvas.getByRole('img', { name: 'Dune Explorer' });
    const image = avatar.querySelector('img');
    await expect(image).not.toBeNull();
    await waitFor(async () => {
      await expect(image?.complete).toBe(true);
      await expect(image?.naturalWidth).toBeGreaterThan(0);
    });
  },
};

/** Four procedural variants: landscape, dunes, dusk, tide. */
export const Variants: Story = {
  render: () => (
    <Rail>
      {VARIANTS.map((variant) => (
        <Card key={variant}>
          <SeedLabel>{variant}</SeedLabel>
          <ScenePreview>
            <Scene seed={`preview-${variant}`} variant={variant} />
          </ScenePreview>
        </Card>
      ))}
    </Rail>
  ),
};

/** Sizing presets from sm (120px) to full (100%). */
export const Sizes: Story = {
  render: (args) => (
    <SizeColumn>
      {SIZES.map((size) => (
        <SizeRow key={size}>
          <SizeLabel>{size}</SizeLabel>
          <ClippedScene>
            <Scene {...args} size={size} />
          </ClippedScene>
        </SizeRow>
      ))}
    </SizeColumn>
  ),
};

/** Decorative scene marked with aria-hidden and empty alt text. */
export const Decorative: Story = {
  render: () => (
    <ComparisonRow>
      <ComparisonPreview>
        <Scene seed="decorative-sample" aria-hidden="true" />
      </ComparisonPreview>
      <ComparisonPreview>
        <Scene seed="decorative-sample-2" alt="" />
      </ComparisonPreview>
    </ComparisonRow>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Neither scene should appear in the accessibility tree as an img
    await expect(canvas.queryByRole('img')).toBeNull();
  },
};

/** Visual check ensuring procedural colors render identically under light theme. */
export const LightTheme: Story = {
  decorators: [withLightTheme],
  globals: { theme: 'light' },
  render: (args) => (
    <WidePreview>
      <Scene {...args} />
    </WidePreview>
  ),
};

/** Visual check under dark (default) theme. Colors are seed-derived, identical across themes. */
export const DarkTheme: Story = {
  render: (args) => (
    <WidePreview>
      <Scene {...args} />
    </WidePreview>
  ),
};

/** A deck back and a per-card back each contain a warm dusk scene. */
export const CardBack: Story = {
  name: 'Card backs',
  parameters: { docs: { source: { language: 'tsx', code: `import { styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';
import { DeckProvider, defineDeck } from '@jfrader/ui/deck';
import { GameCard } from '@jfrader/ui/game-card';
import { Scene } from '@jfrader/ui/scene';

const ComparisonRow = styled.div({ display: 'flex', gap: vars.space[4] });
const deck = defineDeck({ id: 'scene-backs', suits: {}, ranks: {},
  back: <Scene seed="northline" variant="dusk" grade="warm" alt="" />,
});

<DeckProvider decks={[deck]} default="scene-backs">
  <ComparisonRow>
    <GameCard label="Deck scene back" />
    <GameCard label="Per-card scene back">
      <Scene seed="southline" variant="dusk" grade="warm" alt="" />
    </GameCard>
  </ComparisonRow>
</DeckProvider>` } } },
  render: () => (
    <DeckProvider decks={[defineDeck({ id: 'scene-backs', suits: {}, ranks: {},
      back: <Scene seed="northline" variant="dusk" grade="warm" alt="" />,
    })]} default="scene-backs">
      <ComparisonRow>
        <GameCard label="Deck scene back" />
        <GameCard label="Per-card scene back">
          <Scene seed="southline" variant="dusk" grade="warm" alt="" />
        </GameCard>
      </ComparisonRow>
    </DeckProvider>
  ),
  play: async ({ canvas }) => {
    for (const name of ['Deck scene back', 'Per-card scene back']) {
      const card = canvas.getByRole('img', { name });
      await expect(card).toHaveAttribute('data-face', 'back');
      await expect(card.querySelector('[data-ui="scene"]')).not.toBeNull();
    }
  },
};
