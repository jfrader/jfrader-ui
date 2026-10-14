import type { CSSProperties } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, waitFor, within } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { withLightTheme } from '../../testing/story-decorators';
import { Avatar } from '../avatar';
import { Scene, sceneSource, type SceneGrade, type SceneSize, type SceneVariant } from './index';
import { generateSceneSvg, SCENE_PARAMETERS } from './scene-generator';

const VARIANTS = ['landscape', 'dunes', 'dusk', 'tide'] as const satisfies readonly SceneVariant[];
const GRADES = ['raw', 'warm'] as const satisfies readonly SceneGrade[];
const SIZES = ['sm', 'md', 'lg', 'full'] as const satisfies readonly SceneSize[];
const FRAME_PARTS = ['sky', 'light', 'ground', 'haze', 'wash', 'vignette', 'grain'] as const;

const idsOf = (markup: string) => new Set(Array.from(markup.matchAll(/ id="([^"]+)"/g), ([, id]) => id));
/** Markup with its generated colours removed; mask colours (`#fff`, `#000`) stay. */
const geometryOf = (markup: string) => markup.replace(/#[0-9a-f]{6}/g, '');

const railStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
  gap: vars.space[4],
};

const cardStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: vars.space[2],
  padding: vars.space[3],
  borderRadius: vars.radius.md,
  border: `1px solid ${vars.color.border}`,
  backgroundColor: vars.color.surface,
};

const cropRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: vars.space[4],
};

const circleCropStyle: CSSProperties = {
  inlineSize: '80px',
  blockSize: '80px',
  borderRadius: vars.radius.full,
  overflow: 'hidden',
  flexShrink: 0,
};

const wideCropStyle: CSSProperties = {
  inlineSize: '320px',
  blockSize: '120px',
  borderRadius: vars.radius.md,
  overflow: 'hidden',
  flexShrink: 0,
};

const squareCropStyle: CSSProperties = {
  inlineSize: '120px',
  blockSize: '120px',
  borderRadius: vars.radius.md,
  overflow: 'hidden',
  flexShrink: 0,
};

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

/** Default scene rendered inline at full container width. */
export const Default: Story = {
  render: (args) => (
    <div style={{ maxInlineSize: '640px', borderRadius: vars.radius.md, overflow: 'hidden' }}>
      <Scene {...args} />
    </div>
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
    <div style={railStyle}>
      <div style={cardStyle}>
        <span style={{ fontSize: vars.textSize.sm, color: vars.color.textMuted }}>landscape — alpine-ridge</span>
        <div style={{ blockSize: '180px', borderRadius: vars.radius.sm, overflow: 'hidden' }}>
          <Scene seed="alpine-ridge" variant="landscape" />
        </div>
      </div>
      <div style={cardStyle}>
        <span style={{ fontSize: vars.textSize.sm, color: vars.color.textMuted }}>dunes — north-dunes</span>
        <div style={{ blockSize: '180px', borderRadius: vars.radius.sm, overflow: 'hidden' }}>
          <Scene seed="north-dunes" variant="dunes" />
        </div>
      </div>
      <div style={cardStyle}>
        <span style={{ fontSize: vars.textSize.sm, color: vars.color.textMuted }}>dusk — twilight-fjord</span>
        <div style={{ blockSize: '180px', borderRadius: vars.radius.sm, overflow: 'hidden' }}>
          <Scene seed="twilight-fjord" variant="dusk" />
        </div>
      </div>
      <div style={cardStyle}>
        <span style={{ fontSize: vars.textSize.sm, color: vars.color.textMuted }}>tide — coastal-swell</span>
        <div style={{ blockSize: '180px', borderRadius: vars.radius.sm, overflow: 'hidden' }}>
          <Scene seed="coastal-swell" variant="tide" />
        </div>
      </div>
      <div style={cardStyle}>
        <span style={{ fontSize: vars.textSize.sm, color: vars.color.textMuted }}>landscape — emerald-summit</span>
        <div style={{ blockSize: '180px', borderRadius: vars.radius.sm, overflow: 'hidden' }}>
          <Scene seed="emerald-summit" variant="landscape" />
        </div>
      </div>
      <div style={cardStyle}>
        <span style={{ fontSize: vars.textSize.sm, color: vars.color.textMuted }}>dunes — sahara-wind</span>
        <div style={{ blockSize: '180px', borderRadius: vars.radius.sm, overflow: 'hidden' }}>
          <Scene seed="sahara-wind" variant="dunes" />
        </div>
      </div>
    </div>
  ),
};

/** Determinism check verifying identical output for identical seeds. */
export const Determinism: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: vars.space[3] }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: vars.space[3] }}>
        <div style={{ blockSize: '160px', borderRadius: vars.radius.md, overflow: 'hidden' }}>
          <Scene seed="same-seed-target" variant="landscape" alt="Target A" />
        </div>
        <div style={{ blockSize: '160px', borderRadius: vars.radius.md, overflow: 'hidden' }}>
          <Scene seed="same-seed-target" variant="landscape" alt="Target B" />
        </div>
      </div>
      <div style={{ blockSize: '160px', borderRadius: vars.radius.md, overflow: 'hidden', maxInlineSize: '300px' }}>
        <Scene seed="different-seed-sample" variant="landscape" alt="Different" />
      </div>
    </div>
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
    <div style={railStyle}>
      {GRADES.map((grade) => (
        <div key={grade} style={cardStyle}>
          <span style={{ fontSize: vars.textSize.sm, fontWeight: vars.fontWeight.medium }}>{grade}</span>
          <div style={{ blockSize: '180px', borderRadius: vars.radius.sm, overflow: 'hidden' }}>
            <Scene seed="grade-check" grade={grade} alt={`${grade} grade`} />
          </div>
        </div>
      ))}
    </div>
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
    <div style={railStyle}>
      {VARIANTS.map((variant) => (
        <div key={variant} style={cardStyle}>
          <span style={{ fontSize: vars.textSize.sm, fontWeight: vars.fontWeight.medium }}>{variant}</span>
          <div style={{ blockSize: '180px', borderRadius: vars.radius.sm, overflow: 'hidden' }}>
            <Scene seed="layer-check" variant={variant} alt={`${variant} layers`} />
          </div>
        </div>
      ))}
    </div>
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
    <div style={cropRowStyle}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: vars.space[1] }}>
        <div style={circleCropStyle}>
          <Scene {...args} />
        </div>
        <span style={{ fontSize: vars.textSize.xs, color: vars.color.textMuted }}>Circle (1:1)</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: vars.space[1] }}>
        <div style={squareCropStyle}>
          <Scene {...args} />
        </div>
        <span style={{ fontSize: vars.textSize.xs, color: vars.color.textMuted }}>Square (1:1)</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: vars.space[1] }}>
        <div style={wideCropStyle}>
          <Scene {...args} />
        </div>
        <span style={{ fontSize: vars.textSize.xs, color: vars.color.textMuted }}>Wide banner (8:3)</span>
      </div>
    </div>
  ),
};

/** Using `sceneSource` data URLs inside Avatar image slots. */
export const AvatarContent: Story = {
  render: () => (
    <div style={{ display: 'flex', alignItems: 'center', gap: vars.space[4] }}>
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
    </div>
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
    <div style={railStyle}>
      {VARIANTS.map((variant) => (
        <div key={variant} style={cardStyle}>
          <span style={{ fontSize: vars.textSize.sm, fontWeight: vars.fontWeight.medium }}>{variant}</span>
          <div style={{ blockSize: '180px', borderRadius: vars.radius.sm, overflow: 'hidden' }}>
            <Scene seed={`preview-${variant}`} variant={variant} />
          </div>
        </div>
      ))}
    </div>
  ),
};

/** Sizing presets from sm (120px) to full (100%). */
export const Sizes: Story = {
  render: (args) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: vars.space[4] }}>
      {SIZES.map((size) => (
        <div key={size} style={{ display: 'flex', alignItems: 'center', gap: vars.space[3] }}>
          <span style={{ inlineSize: '40px', fontSize: vars.textSize.xs, color: vars.color.textMuted }}>{size}</span>
          <div style={{ borderRadius: vars.radius.sm, overflow: 'hidden' }}>
            <Scene {...args} size={size} />
          </div>
        </div>
      ))}
    </div>
  ),
};

/** Decorative scene marked with aria-hidden and empty alt text. */
export const Decorative: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: vars.space[4] }}>
      <div style={{ inlineSize: '240px', borderRadius: vars.radius.sm, overflow: 'hidden' }}>
        <Scene seed="decorative-sample" aria-hidden="true" />
      </div>
      <div style={{ inlineSize: '240px', borderRadius: vars.radius.sm, overflow: 'hidden' }}>
        <Scene seed="decorative-sample-2" alt="" />
      </div>
    </div>
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
    <div style={{ maxInlineSize: '640px', borderRadius: vars.radius.md, overflow: 'hidden' }}>
      <Scene {...args} />
    </div>
  ),
};

/** Visual check under dark (default) theme. Colors are seed-derived, identical across themes. */
export const DarkTheme: Story = {
  render: (args) => (
    <div style={{ maxInlineSize: '640px', borderRadius: vars.radius.md, overflow: 'hidden' }}>
      <Scene {...args} />
    </div>
  ),
};
