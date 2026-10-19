import { StrictMode, createRef, type ComponentPropsWithRef } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { renderToString, renderToStaticMarkup } from 'react-dom/server';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, waitFor, within } from 'storybook/test';
import { PERSON_ART_COLORS } from '@jfrader/tokens';
import { vars } from '@jfrader/tokens/vars';
import { css } from '../../styling/css';
import { styled } from '../../styling/styled';
import { withLightTheme } from '../../testing/story-decorators';
import { ThemeRoot } from '../theme-root';
import {
  PersonAvatar, resolvePersonKit, PERSON_SHIRT_PATTERNS, PERSON_SHORTS_PATTERNS, PERSON_SOCKS_PATTERNS,
  type PersonAvatarKit,
} from './index';
import {
  PERSON_SKIN_TONES, PERSON_HAIR_COLORS, PERSON_EYE_COLORS,
  PERSON_HAIR_STYLES, PERSON_FACIAL_HAIR_STYLES, PERSON_FACE_SHAPES, PERSON_BROW_STYLES,
  PERSON_EYE_STYLES, PERSON_NOSE_STYLES, PERSON_MOUTH_STYLES, PERSON_ACCESSORIES, PERSON_MARKINGS,
  resolveAppearanceId, resolvePersonAppearance, personAppearanceSignature,
} from './appearance';
import { ARTWORK_FIXTURES, ARTWORK_KIT, PALETTE_FIXTURES, RECIPE_FIXTURES } from './reference-fixtures';

const Row = styled.div({ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: vars.space[4] });
const CustomAvatar = styled(PersonAvatar)({ outline: `1px solid ${vars.color.border}` });
const FullSizeFrame = styled.div({ inlineSize: vars.space[10], blockSize: vars.space[10] });
const slotCss = css({ inlineSize: vars.space[8] });
const kitSource = `import { PersonAvatar, type PersonAvatarKit } from '@jfrader/ui';
import { PERSON_ART_COLORS } from '@jfrader/tokens';

const kit = {
  shirt: PERSON_ART_COLORS.staffJacket,
  shorts: PERSON_ART_COLORS.staffShirt,
  socks: PERSON_ART_COLORS.staffJacket,
  accent: PERSON_ART_COLORS.staffShirt,
  shortsAccent: PERSON_ART_COLORS.staffJacket,
  socksAccent: PERSON_ART_COLORS.staffShirt,
  shirtPattern: 'solid', shortsPattern: 'solid', socksPattern: 'solid',
} satisfies PersonAvatarKit;

`;
function RootAdapter(props: ComponentPropsWithRef<'svg'>) { return <svg {...props} data-adapter="root" />; }
function ComponentAdapter(props: ComponentPropsWithRef<'svg'>) { return <svg {...props} data-adapter="component" />; }

function normalizeArtwork(svg: Element) {
  const clone = svg.cloneNode(true) as Element;
  for (const element of clone.querySelectorAll('*')) {
    const attributes = Array.from(element.attributes)
      .filter(({ name }) => !name.startsWith('data-'))
      .sort((a, b) => a.name.localeCompare(b.name, 'en'));
    for (const attribute of Array.from(element.attributes)) element.removeAttribute(attribute.name);
    for (const { name, value } of attributes) element.setAttribute(name, value);
  }
  return clone.innerHTML;
}

function renderedSvg(markup: string, document: Document) {
  const container = document.createElement('div');
  container.innerHTML = markup;
  return container.querySelector('svg')!;
}

const meta = {
  title: 'Media/PersonAvatar',
  component: PersonAvatar,
  tags: ['autodocs'],
  args: { seed: 'stable-visual-seed', alt: 'Alex' },
  parameters: {
    docs: {
      description: { component: 'Show a pixel-art person from a seed.' },
      usage: `
### Identity
Pass a durable string as \`seed\`. A nonblank \`appearanceId\` takes precedence after trimming;
blank overrides use the original, untrimmed seed. Empty seeds are valid. Appearance signatures are not IDs.

### Clothing
Pass a resolved \`kit\` with all garment colors and patterns, or use \`primary\` and \`secondary\` for solid clothing.
Kit inputs win over simple colors. Staff uses the same identity with a jacket and tie.

### Naming
Omit \`alt\` for decorative artwork. Use \`alt\` for a name or \`aria-labelledby\` for an external label.
An empty \`alt\` or explicit \`aria-hidden\` makes the artwork decorative, even with other name inputs.
The SVG is not a keyboard target; wrap decorative artwork in a named button or link for actions.

### Size and crop
Sizes are square: \`sm\` 32px, \`md\` 48px, \`lg\` 72px. Set custom dimensions with \`sx\`.
Portrait \`crop="circle"\` clips peripheral hair and clothing without zooming. Full kits remain square letterboxed viewports.
Artwork fills stay fixed across themes and forced colors; the forced-colors boundary uses a CanvasText outline.
`,
    },
  },
} satisfies Meta<typeof PersonAvatar>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const avatar = within(canvasElement).getByRole('img', { name: 'Alex' });
    await expect(avatar).toHaveAttribute('data-ui', 'person-avatar');
    await expect(avatar).toHaveAttribute('viewBox', '0 0 48 48');
    await expect(avatar).toHaveAttribute('data-avatar-appearance-signature',
      '3:amber:black:messy:moustache:oval:soft:wide:slate:straight:smile:none:none');
    await expect(avatar).not.toHaveAttribute('tabindex');
    await expect(avatar).toHaveAttribute('focusable', 'false');
  },
};
export const LightTheme: Story = { ...Default, decorators: [withLightTheme], globals: { theme: 'light' } };
export const DarkTheme: Story = { ...Default, globals: { theme: 'dark' } };

export const ThemeParity: Story = {
  parameters: { docs: { source: { language: 'tsx', code: `import { PersonAvatar, ThemeRoot } from '@jfrader/ui';

<>
  <ThemeRoot theme="light"><PersonAvatar seed="stable-visual-seed" alt="Alex" crop="circle" /></ThemeRoot>
  <ThemeRoot theme="dark"><PersonAvatar seed="stable-visual-seed" alt="Alex" crop="circle" /></ThemeRoot>
</>` } } },
  render: (args) => <Row><ThemeRoot theme="light"><PersonAvatar {...args} crop="circle" fullKit={false} /></ThemeRoot>
    <ThemeRoot theme="dark"><PersonAvatar {...args} crop="circle" fullKit={false} /></ThemeRoot></Row>,
  play: async ({ canvasElement }) => {
    const [light, dark] = Array.from(canvasElement.querySelectorAll('svg'));
    await expect(light!.innerHTML).toBe(dark!.innerHTML);
    await expect(light!.getAttribute('data-avatar-appearance-signature')).toBe(dark!.getAttribute('data-avatar-appearance-signature'));
  },
};

export const Sizes: Story = {
  parameters: { docs: { source: { language: 'tsx', code: `import { PersonAvatar, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const LargePortrait = styled(PersonAvatar)({
  outline: \`1px solid \${vars.color.border}\`,
  inlineSize: \`calc(\${vars.space[12]} * 2)\`,
  blockSize: \`calc(\${vars.space[12]} * 2)\`,
});

<>
  <PersonAvatar seed="stable-visual-seed" alt="Alex" size="sm" />
  <PersonAvatar seed="stable-visual-seed" alt="Alex" size="md" />
  <PersonAvatar seed="stable-visual-seed" alt="Alex" size="lg" />
  <LargePortrait seed="stable-visual-seed" alt="Alex" />
</>` } } },
  render: (args) => <Row>
    <PersonAvatar {...args} size="sm" /><PersonAvatar {...args} size="md" /><PersonAvatar {...args} size="lg" />
    <CustomAvatar {...args} sx={{ inlineSize: `calc(${vars.space[12]} * 2)`, blockSize: `calc(${vars.space[12]} * 2)` }} />
  </Row>,
  play: async ({ canvasElement }) => {
    const avatars = canvasElement.querySelectorAll('svg');
    for (const [index, size] of [32, 48, 72, 96].entries()) {
      await expect(avatars[index]!.getBoundingClientRect().width).toBe(size);
      await expect(avatars[index]!.getBoundingClientRect().height).toBe(size);
      await expect(getComputedStyle(avatars[index]!).overflow).toBe('visible');
      await expect(avatars[index]!.innerHTML).toBe(avatars[0]!.innerHTML);
    }
  },
};

export const Crops: Story = {
  parameters: { docs: { source: { language: 'tsx', code: `import { PersonAvatar } from '@jfrader/ui';

<>
  <PersonAvatar seed="stable-visual-seed" alt="Alex" size="lg" />
  <PersonAvatar seed="stable-visual-seed" alt="Alex" size="lg" crop="circle" />
</>` } } },
  render: (args) => <Row><PersonAvatar {...args} size="lg" /><PersonAvatar {...args} size="lg" fullKit={false} crop="circle" /></Row>,
  play: async ({ canvasElement }) => {
    const plain = canvasElement.querySelectorAll('svg')[0]!;
    const circle = canvasElement.querySelectorAll('svg')[1]!;
    await expect(circle.innerHTML).toBe(plain.innerHTML);
    await expect(getComputedStyle(circle).overflow).toBe('hidden');
    await expect(getComputedStyle(circle).borderRadius).not.toBe('0px');
    await expect(circle).toHaveAttribute('viewBox', '0 0 48 48');
  },
};

export const FullKit: Story = {
  parameters: { docs: { source: { language: 'tsx', code: `${kitSource}<PersonAvatar seed="stable-visual-seed" alt="Alex" fullKit kit={kit} size="lg" />` } } },
  args: { fullKit: true, kit: ARTWORK_KIT, size: 'lg' },
  play: async ({ canvasElement }) => {
    const avatar = canvasElement.querySelector('svg')!;
    await expect(avatar).toHaveAttribute('viewBox', '0 0 48 61');
    await expect(avatar).toHaveAttribute('preserveAspectRatio', 'xMidYMid meet');
    await expect(avatar.getBoundingClientRect().width).toBe(72);
    await expect(avatar.getBoundingClientRect().height).toBe(72);
  },
};
export const Staff: Story = {
  args: { attire: 'staff', fullKit: true, size: 'lg' },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('svg')).toHaveAttribute('viewBox', '0 0 48 48');
    await expect(canvasElement.querySelector(`path[fill="${PERSON_ART_COLORS.staffJacket}"]`)).not.toBeNull();
  },
};

const paletteSeeds = [...new Set([
  ...Object.keys(PERSON_SKIN_TONES).map(id => RECIPE_FIXTURES.find(([, r]) => r.skinTone === id)![0]),
  ...Object.keys(PERSON_HAIR_COLORS).map(id => RECIPE_FIXTURES.find(([, r]) => r.hairColor === id)![0]),
  ...Object.keys(PERSON_EYE_COLORS).map(id => RECIPE_FIXTURES.find(([, r]) => r.eyeColor === id)![0]),
])];
export const PaletteCoverage: Story = {
  parameters: { docs: { source: { language: 'tsx', code: `import { PersonAvatar } from '@jfrader/ui';

const seeds = ${JSON.stringify(paletteSeeds)};

<>{seeds.map((seed) => <PersonAvatar key={seed} seed={seed} />)}</>` } } },
  render: () => <Row>{paletteSeeds.map(seed => <PersonAvatar key={seed} seed={seed} />)}</Row>,
  play: async ({ canvasElement }) => {
    await expect(PERSON_SKIN_TONES).toEqual(PALETTE_FIXTURES.skin);
    await expect(PERSON_HAIR_COLORS).toEqual(PALETTE_FIXTURES.hair);
    await expect(PERSON_EYE_COLORS).toEqual(PALETTE_FIXTURES.eyes);
    for (const [index, seed] of paletteSeeds.entries()) {
      const recipe = RECIPE_FIXTURES.find(([id]) => id === seed)![1];
      const svg = canvasElement.querySelectorAll('svg')[index]!;
      for (const fill of [PALETTE_FIXTURES.skin[recipe.skinTone].base, PALETTE_FIXTURES.hair[recipe.hairColor].base]) {
        await expect(svg.querySelector(`[fill="${fill}"]`)).not.toBeNull();
      }
      const eyes = svg.querySelector('[data-avatar-feature="eyes"]')!;
      const eye = PALETTE_FIXTURES.eyes[recipe.eyeColor];
      await expect(eyes.querySelector(`[fill="${eye.iris}"], [fill="${eye.light}"]`)).not.toBeNull();
    }
  },
};

export const Determinism: Story = {
  parameters: { docs: { source: { language: 'tsx', code: `import { PersonAvatar } from '@jfrader/ui';

<>
  <PersonAvatar seed="stable-visual-seed" alt="Alex" />
  <PersonAvatar seed="stable-visual-seed" alt="Alex" />
</>` } } },
  render: (args) => <Row><PersonAvatar {...args} /><PersonAvatar {...args} /></Row>,
  play: async ({ canvasElement }) => {
    const first = canvasElement.querySelectorAll('svg')[0]!;
    const second = canvasElement.querySelectorAll('svg')[1]!;
    await expect(first.innerHTML).toBe(second.innerHTML);
    const corpus = RECIPE_FIXTURES.slice(8);
    const signatures = corpus.map(([seed]) => personAppearanceSignature(resolvePersonAppearance(seed)));
    await expect(new Set(signatures).size).toBe(10000);
    await expect(signatures).toEqual(corpus.map(([, , signature]) => signature));
  },
};

export const AppearanceParity: Story = {
  play: async ({ canvasElement }) => {
    const recipeFailures = RECIPE_FIXTURES.filter(([seed, recipe, signature]) => {
      const actual = resolvePersonAppearance(seed);
      return JSON.stringify(actual) !== JSON.stringify(recipe) || personAppearanceSignature(actual) !== signature;
    }).map(([seed]) => seed);
    await expect(recipeFailures).toEqual([]);
    const artFailures = ARTWORK_FIXTURES.filter(({ seed, props, artwork }) => {
      const svg = renderedSvg(renderToStaticMarkup(<PersonAvatar seed={seed}
        primary={ARTWORK_KIT.shirt} secondary={ARTWORK_KIT.accent} kit={ARTWORK_KIT} {...props} />), canvasElement.ownerDocument);
      return normalizeArtwork(svg) !== artwork;
    }).map(({ seed, props }) => ({ seed, props }));
    await expect(artFailures).toEqual([]);
    for (const override of [undefined, '', '   ']) await expect(resolveAppearanceId(' raw seed ', override)).toBe(' raw seed ');
    await expect(resolveAppearanceId('', undefined)).toBe('');
    await expect(resolveAppearanceId('entity-a', ' face-42 ')).toBe('face-42');
    const a = renderedSvg(renderToStaticMarkup(<PersonAvatar seed="entity-a" appearanceId=" face-42 " />), canvasElement.ownerDocument);
    const b = renderedSvg(renderToStaticMarkup(<PersonAvatar seed="entity-b" appearanceId="face-42" />), canvasElement.ownerDocument);
    await expect(a.innerHTML).toBe(b.innerHTML);
  },
};

export const TraitCoverage: Story = {
  parameters: { docs: { source: { language: 'tsx', code: `import { PersonAvatar } from '@jfrader/ui';

const seeds = ${JSON.stringify(PERSON_HAIR_STYLES.map(hair => RECIPE_FIXTURES.find(([, recipe]) => recipe.hairStyle === hair)![0]))};

<>{seeds.map((seed) => <PersonAvatar key={seed} seed={seed} />)}</>` } } },
  render: () => <Row>{PERSON_HAIR_STYLES.map(hair => {
    const seed = RECIPE_FIXTURES.find(([, recipe]) => recipe.hairStyle === hair)![0];
    return <PersonAvatar key={hair} seed={seed} />;
  })}</Row>,
  play: async () => {
    const recipes = RECIPE_FIXTURES.slice(8).map(([seed]) => resolvePersonAppearance(seed));
    const options = {
      skinTone: Object.keys(PERSON_SKIN_TONES), hairColor: Object.keys(PERSON_HAIR_COLORS), eyeColor: Object.keys(PERSON_EYE_COLORS),
      hairStyle: PERSON_HAIR_STYLES, facialHair: PERSON_FACIAL_HAIR_STYLES, faceShape: PERSON_FACE_SHAPES,
      browStyle: PERSON_BROW_STYLES, eyeStyle: PERSON_EYE_STYLES, noseStyle: PERSON_NOSE_STYLES,
      mouthStyle: PERSON_MOUTH_STYLES, accessory: PERSON_ACCESSORIES, marking: PERSON_MARKINGS,
    };
    for (const key of Object.keys(options) as (keyof typeof options)[]) {
      await expect([...new Set(recipes.map(recipe => recipe[key]))].sort()).toEqual([...options[key]].sort());
    }
    const pairs = new Set(recipes.map(r => `${r.hairStyle}:${r.facialHair}`));
    for (const hair of PERSON_HAIR_STYLES) for (const beard of PERSON_FACIAL_HAIR_STYLES) {
      await expect(pairs.has(`${hair}:${beard}`)).toBe(true);
    }
  },
};

const patternKits: PersonAvatarKit[] = ['solid', 'centerStripe', 'split', 'hoops', 'shoulders'].map((shirtPattern, index) => ({
  ...ARTWORK_KIT,
  shirt: PERSON_ART_COLORS.staffJacket, shorts: PERSON_ART_COLORS.staffShirt,
  socks: PERSON_ART_COLORS.headband, accent: PERSON_ART_COLORS.earring,
  shortsAccent: PERSON_ART_COLORS.mouth, socksAccent: PERSON_ART_COLORS.shadow,
  shirtPattern: shirtPattern as PersonAvatarKit['shirtPattern'],
  shortsPattern: (['solid', 'sideStripe', 'split', 'waistBand'] as const)[index % 4]!,
  socksPattern: index % 2 ? 'turnover' : 'solid',
}));
export const KitVariants: Story = {
  parameters: { docs: { source: { language: 'tsx', code: `${kitSource}const shirts = ['solid', 'centerStripe', 'split', 'hoops', 'shoulders'] as const;
const shorts = ['solid', 'sideStripe', 'split', 'waistBand'] as const;
const kits: PersonAvatarKit[] = shirts.map((shirtPattern, index) => ({
  ...kit,
  socks: PERSON_ART_COLORS.headband,
  accent: PERSON_ART_COLORS.earring,
  shortsAccent: PERSON_ART_COLORS.mouth,
  socksAccent: PERSON_ART_COLORS.shadow,
  shirtPattern, shortsPattern: shorts[index % shorts.length]!,
  socksPattern: index % 2 ? 'turnover' : 'solid',
}));

<>{kits.map((kit, index) => (
  <PersonAvatar key={index} seed="stable-visual-seed" alt="Alex" kit={kit} size="lg" fullKit />
))}</>` } } },
  render: (args) => <Row>{patternKits.map((kit, index) => <PersonAvatar {...args} key={index} kit={kit} size="lg" fullKit crop="none"
    primary="currentColor" secondary="currentColor" />)}</Row>,
  play: async ({ canvasElement }) => {
    for (const [index, svg] of Array.from(canvasElement.querySelectorAll('svg')).entries()) {
      const kit = patternKits[index]!;
      await expect(svg.querySelector('[fill="currentColor"]')).toBeNull();
      for (const fill of [kit.shirt, kit.shorts, kit.socks, kit.accent]) {
        await expect(svg.querySelector(`[fill="${fill}"]`)).not.toBeNull();
      }
      await expect(svg.querySelector('[x="15"][y="49"][width="18"]')).toHaveAttribute('fill', kit.shorts);
      await expect(svg.querySelector('[x="17"][y="54"][height="4"]')).toHaveAttribute('fill', kit.socks);
      if (kit.shortsPattern !== 'solid') await expect(svg.querySelector(`[fill="${kit.shortsAccent}"]`)).not.toBeNull();
      if (kit.socksPattern === 'turnover') await expect(svg.querySelector('[x="17"][y="54"][height="2"]')).toHaveAttribute('fill', kit.socksAccent);
    }
  },
};

const glassesSeed = RECIPE_FIXTURES.find(([, r]) => r.accessory === 'glasses')![0];
export const IdentityVsAttire: Story = {
  parameters: { docs: { source: { language: 'tsx', code: `${kitSource}const homeKit: PersonAvatarKit = {
  ...kit, socks: PERSON_ART_COLORS.headband, accent: PERSON_ART_COLORS.earring,
  shortsAccent: PERSON_ART_COLORS.mouth, socksAccent: PERSON_ART_COLORS.shadow,
};
const awayKit: PersonAvatarKit = {
  ...homeKit, shirtPattern: 'hoops', shortsPattern: 'waistBand', socksPattern: 'turnover',
};

<>
  <PersonAvatar seed="${glassesSeed}" kit={homeKit} />
  <PersonAvatar seed="${glassesSeed}" kit={awayKit} size="lg" fullKit />
  <PersonAvatar seed="${glassesSeed}" attire="staff" kit={awayKit} />
</>` } } },
  render: () => <Row>
    <PersonAvatar seed={glassesSeed} kit={patternKits[0]} />
    <PersonAvatar seed={glassesSeed} kit={patternKits[3]} size="lg" fullKit />
    <PersonAvatar seed={glassesSeed} attire="staff" kit={patternKits[3]} />
  </Row>,
  play: async ({ canvasElement }) => {
    const avatars = Array.from(canvasElement.querySelectorAll('svg'));
    await expect(new Set(avatars.map(svg => svg.getAttribute('data-avatar-appearance-signature'))).size).toBe(1);
    for (const layer of ['face', 'hair', 'features', 'facial-hair', 'marking']) {
      await expect(new Set(avatars.map(svg => svg.querySelector(`[data-avatar-layer="${layer}"]`)!.outerHTML)).size).toBe(1);
    }
    await expect(avatars[0]!.querySelector('[data-glasses-suppressed]')).not.toBeNull();
    await expect(avatars[1]!.querySelector('[data-glasses-suppressed]')).not.toBeNull();
    await expect(avatars[2]!.querySelector('[data-glasses-suppressed]')).toBeNull();
  },
};

export const SimpleColors: Story = {
  parameters: { docs: { source: { language: 'tsx', code: `${kitSource}import { vars } from '@jfrader/tokens/vars';

<>
  <PersonAvatar seed="simple-colors" primary={vars.color.accent} secondary="currentColor" fullKit />
  <PersonAvatar seed="simple-colors" primary={vars.color.accent} secondary="currentColor" attire="staff" kit={kit} />
  <PersonAvatar seed="simple-colors" primary={vars.color.accent} secondary="currentColor" attire="staff" />
</>` } } },
  render: () => <Row>
    <PersonAvatar seed="simple-colors" primary={vars.color.accent} secondary="currentColor" fullKit />
    <PersonAvatar seed="simple-colors" primary={vars.color.accent} secondary="currentColor" attire="staff" kit={patternKits[2]} />
    <PersonAvatar seed="simple-colors" primary={vars.color.accent} secondary="currentColor" attire="staff" />
  </Row>,
  play: async ({ canvasElement }) => {
    const [kit, staffWithKit, staff] = Array.from(canvasElement.querySelectorAll('svg'));
    await expect(PERSON_SHIRT_PATTERNS).toEqual(['solid', 'centerStripe', 'split', 'hoops', 'shoulders']);
    await expect(PERSON_SHORTS_PATTERNS).toEqual(['solid', 'sideStripe', 'split', 'waistBand']);
    await expect(PERSON_SOCKS_PATTERNS).toEqual(['solid', 'turnover']);
    await expect(resolvePersonKit()).toEqual({
      shirt: PERSON_ART_COLORS.staffJacket, shorts: PERSON_ART_COLORS.staffShirt,
      socks: PERSON_ART_COLORS.staffJacket, accent: PERSON_ART_COLORS.staffShirt,
      shortsAccent: PERSON_ART_COLORS.staffJacket, socksAccent: PERSON_ART_COLORS.staffShirt,
      shirtPattern: 'solid', shortsPattern: 'solid', socksPattern: 'solid',
    });
    await expect(resolvePersonKit({ primary: vars.color.accent, secondary: 'currentColor' })).toEqual({
      shirt: vars.color.accent, shorts: 'currentColor', socks: vars.color.accent,
      accent: 'currentColor', shortsAccent: vars.color.accent, socksAccent: 'currentColor',
      shirtPattern: 'solid', shortsPattern: 'solid', socksPattern: 'solid',
    });
    await expect(resolvePersonKit({ primary: 'currentColor' }).shorts).toBe(PERSON_ART_COLORS.staffShirt);
    await expect(resolvePersonKit({ secondary: 'currentColor' }).shirt).toBe(PERSON_ART_COLORS.staffJacket);
    await expect(resolvePersonKit({ primary: '', secondary: '' }).shirt).toBe('');
    await expect(resolvePersonKit({ kit: ARTWORK_KIT, primary: vars.color.accent, secondary: 'currentColor' })).toBe(ARTWORK_KIT);
    await expect(kit!.querySelector('path[fill] + rect')).toHaveAttribute('fill', 'currentColor');
    await expect(kit!.querySelector('[x="15"][y="49"][width="18"]')).toHaveAttribute('fill', 'currentColor');
    await expect(kit!.querySelector('[x="17"][y="54"][height="4"]')).toHaveAttribute('fill', vars.color.accent);
    await expect(staff!.querySelector('[x="23"][y="37"]')).toHaveAttribute('fill', vars.color.accent);
    await expect(staffWithKit!.innerHTML).toBe(staff!.innerHTML);
  },
};

export const Decorative: Story = {
  parameters: { docs: { source: { language: 'tsx', code: `import { PersonAvatar } from '@jfrader/ui';

<>
  <PersonAvatar seed="unannounced-seed" />
  <PersonAvatar seed="unannounced-seed" alt="" />
  <PersonAvatar seed="unannounced-seed" alt="Hidden" aria-hidden />
  <PersonAvatar seed="unannounced-seed" alt="   " />
  <PersonAvatar seed="unannounced-seed" aria-label="   " />
</>` } } },
  render: () => <Row>
    <PersonAvatar seed="unannounced-seed" />
    <PersonAvatar seed="unannounced-seed" alt="" aria-label="Hidden" aria-labelledby="hidden-label" />
    <PersonAvatar seed="unannounced-seed" alt="Hidden" aria-hidden />
    <PersonAvatar seed="unannounced-seed" alt="   " aria-hidden={false} />
    <PersonAvatar seed="unannounced-seed" aria-label="   " aria-hidden={false} />
  </Row>,
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole('img')).toBeNull();
    for (const svg of canvasElement.querySelectorAll('svg')) {
      await expect(svg).toHaveAttribute('aria-hidden', 'true');
      await expect(svg).not.toHaveAttribute('role');
      await expect(svg).not.toHaveAttribute('aria-label');
      await expect(svg).not.toHaveAttribute('aria-labelledby');
    }
  },
};
export const Named: Story = {
  parameters: { docs: { source: { language: 'tsx', code: `import { PersonAvatar } from '@jfrader/ui';

<>
  <PersonAvatar seed="unannounced-seed" alt="Alex" aria-label="Blair" />
  <PersonAvatar seed="unannounced-seed" aria-label="Blair" />
</>` } } },
  render: () => <Row><PersonAvatar seed="unannounced-seed" alt="Alex" aria-label="Blair" />
    <PersonAvatar seed="unannounced-seed" aria-label="Blair" /></Row>,
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('img', { name: 'Alex' })).toBeInTheDocument();
    await expect(within(canvasElement).getByRole('img', { name: 'Blair' })).toBeInTheDocument();
    await expect(within(canvasElement).queryByRole('img', { name: /unannounced-seed/ })).toBeNull();
  },
};
export const ExternalAria: Story = {
  parameters: { docs: { source: { language: 'tsx', code: `import { useId } from 'react';
import { PersonAvatar } from '@jfrader/ui';

function CaptainPortrait() {
  const nameId = useId();
  const descriptionId = useId();
  return (
    <>
      <span id={nameId}>Blair</span>
      <span id={descriptionId}>Captain</span>
      <PersonAvatar seed="external" slotProps={{ root: {
        'aria-labelledby': nameId, 'aria-describedby': descriptionId,
      } }} />
    </>
  );
}` } } },
  render: () => <Row><span id="person-name">Blair</span><span id="person-description">Captain</span>
    <PersonAvatar seed="external" alt="Alex" aria-label="Casey"
      slotProps={{ root: { 'aria-labelledby': 'person-name', 'aria-describedby': 'person-description' } }} /></Row>,
  play: async ({ canvasElement }) => {
    const svg = within(canvasElement).getByRole('img', { name: 'Blair' });
    await expect(svg).not.toHaveAttribute('aria-label');
    await expect(svg).toHaveAttribute('aria-labelledby', 'person-name');
    await expect(svg).toHaveAccessibleDescription('Captain');
  },
};
export const Keyboard: Story = {
  parameters: { docs: { source: { language: 'tsx', code: `import { PersonAvatar } from '@jfrader/ui';

<>
  <button type="button">Before</button>
  <PersonAvatar seed="keyboard" alt="Alex" />
  <PersonAvatar seed="keyboard" />
  <button type="button">After</button>
</>` } } },
  render: () => <Row><button type="button">Before</button><PersonAvatar seed="keyboard" alt="Alex" />
    <PersonAvatar seed="keyboard" /><button type="button">After</button></Row>,
  play: async ({ canvasElement, userEvent }) => {
    const canvas = within(canvasElement);
    canvas.getByRole('button', { name: 'Before' }).focus();
    await userEvent.tab();
    await expect(canvas.getByRole('button', { name: 'After' })).toHaveFocus();
    await userEvent.tab({ shift: true });
    await expect(canvas.getByRole('button', { name: 'Before' })).toHaveFocus();
    for (const svg of canvasElement.querySelectorAll('svg')) await expect(svg).not.toHaveAttribute('tabindex');
  },
};

export const Customization: Story = {
  parameters: { docs: { source: { language: 'tsx', code: `import type { ComponentPropsWithRef } from 'react';
import { PersonAvatar, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

function PortraitRoot(props: ComponentPropsWithRef<'svg'>) {
  return <svg {...props} data-profile-portrait />;
}
const ProfilePortrait = styled(PersonAvatar)({
  inlineSize: vars.size.personAvatarLg, verticalAlign: 'top',
});

<ProfilePortrait seed="stable-visual-seed" slots={{ root: PortraitRoot }}
  className="consumer" slotProps={{ root: { className: 'slot', 'aria-label': 'Blair' } }} />` } } },
  args: { onClick: fn(), slotProps: { root: { onClick: fn() } } },
  render: (args) => <PersonAvatar {...args} component={ComponentAdapter} slots={{ root: RootAdapter }}
    className="consumer" data-test="consumer"
    style={{ opacity: 0.5, verticalAlign: 'top' }}
    slotProps={{ root: { ...args.slotProps?.root, className: 'slot', css: slotCss, style: { opacity: 1 }, 'aria-label': 'Blair',
      'data-test': 'slot' } }}
    alt={undefined} sx={{ inlineSize: vars.size.personAvatarLg }} />,
  play: async ({ canvasElement, userEvent, args }) => {
    const svg = within(canvasElement).getByRole('img', { name: 'Blair' });
    await expect(canvasElement.querySelectorAll('svg')).toHaveLength(1);
    await expect(svg).toHaveAttribute('data-adapter', 'root');
    await expect(svg).toHaveAttribute('data-test', 'slot');
    await expect(svg).toHaveClass('consumer', 'slot');
    await expect(svg).toHaveAttribute('viewBox', '0 0 48 48');
    await expect(svg).not.toHaveAttribute('tabindex');
    await expect(getComputedStyle(svg).opacity).toBe('1');
    await expect(getComputedStyle(svg).verticalAlign).toBe('top');
    await expect(svg.getBoundingClientRect().width).toBe(72);
    await userEvent.click(svg);
    await expect(args.slotProps?.root?.onClick).toHaveBeenCalledTimes(1);
    await expect(args.onClick).not.toHaveBeenCalled();
  },
};

export const ComponentReplacement: Story = {
  parameters: { docs: { source: { language: 'tsx', code: `import type { ComponentPropsWithRef } from 'react';
import { PersonAvatar } from '@jfrader/ui';

function PortraitRoot(props: ComponentPropsWithRef<'svg'>) {
  return <svg {...props} data-profile-portrait />;
}

<PersonAvatar seed="stable-visual-seed" alt="Alex" component={PortraitRoot} />` } } },
  args: { component: ComponentAdapter },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelectorAll('svg')).toHaveLength(1);
    await expect(canvasElement.querySelector('svg')).toHaveAttribute('data-adapter', 'component');
  },
};

export const Refs: Story = {
  play: async ({ canvasElement }) => {
    const host = canvasElement.ownerDocument.createElement('div');
    canvasElement.append(host);
    const root = createRoot(host);
    const object = createRef<SVGSVGElement>();
    const slotObject = createRef<SVGSVGElement>();
    const attached = fn();
    const cleaned = fn();
    const slotAttached = fn();
    const slotCleaned = fn();
    try {
      flushSync(() => root.render(<PersonAvatar seed="refs" ref={object} slots={{ root: RootAdapter }} slotProps={{ root: { ref: slotObject } }} />));
      await expect(object.current).toBe(host.querySelector('svg'));
      await expect(slotObject.current).toBe(object.current);
      flushSync(() => root.render(<StrictMode><PersonAvatar seed="refs" ref={node => {
        attached(node); return () => cleaned(node);
      }} slotProps={{ root: { ref: node => {
        slotAttached(node); return () => slotCleaned(node);
      } } }} /></StrictMode>));
      await expect(object.current).toBeNull();
      await expect(slotObject.current).toBeNull();
      await expect(attached).toHaveBeenCalled();
      await expect(cleaned).toHaveBeenCalled();
    } finally {
      flushSync(() => root.unmount());
      host.remove();
    }
    await expect(cleaned.mock.calls.length).toBe(attached.mock.calls.length);
    await expect(slotCleaned.mock.calls.length).toBe(slotAttached.mock.calls.length);
    await expect(slotAttached.mock.calls).toEqual(attached.mock.calls);
    await expect(attached.mock.calls.every(([node]) => node instanceof SVGSVGElement)).toBe(true);
  },
};

export const FullSize: Story = {
  render: args => <Row>
    <FullSizeFrame><PersonAvatar {...args} size="full" alt="Portrait" /></FullSizeFrame>
    <FullSizeFrame><PersonAvatar {...args} size="full" fullKit crop="none" alt="Full kit" /></FullSizeFrame>
  </Row>,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    for (const name of ['Portrait', 'Full kit']) {
      const svg = canvas.getByRole('img', { name });
      await expect(svg.getBoundingClientRect().width).toBe(40);
      await expect(svg.getBoundingClientRect().height).toBe(40);
      await expect(svg).toHaveAttribute('viewBox', name === 'Full kit' ? '0 0 48 61' : '0 0 48 48');
      await expect(svg).toHaveAttribute('preserveAspectRatio', 'xMidYMid meet');
    }
  },
};

export const SSRHydration: Story = {
  play: async ({ canvasElement }) => {
    const host = canvasElement.ownerDocument.createElement('div');
    const element = <PersonAvatar seed="é⚽" alt="Alex" kit={ARTWORK_KIT} fullKit />;
    host.innerHTML = renderToString(element);
    const before = host.querySelector('svg')!.outerHTML;
    canvasElement.append(host);
    const errors = fn();
    const ref = createRef<SVGSVGElement>();
    const root = hydrateRoot(host, <PersonAvatar seed="é⚽" alt="Alex" kit={ARTWORK_KIT} fullKit ref={ref} />, { onRecoverableError: errors });
    try {
      await waitFor(() => expect(ref.current).toBe(host.querySelector('svg')));
      await expect(errors).not.toHaveBeenCalled();
      await expect(host.querySelector('svg')!.outerHTML).toBe(before);
    } finally { flushSync(() => root.unmount()); host.remove(); }
  },
};

function TypeContract() {
  // @ts-expect-error Full kits cannot be circle cropped.
  const crop = <PersonAvatar seed="type" fullKit crop="circle" />;
  // @ts-expect-error Geometry is generated, not consumer children.
  const children = <PersonAvatar seed="type"><rect /></PersonAvatar>;
  // @ts-expect-error Public styling uses sx, not css.
  const publicCss = { seed: 'type', css: {} } satisfies import('./person-avatar').PersonAvatarProps;
  // @ts-expect-error Domain adapters belong in the app.
  const domain = <PersonAvatar seed="type" playerId="type" />;
  // @ts-expect-error Patterns are a closed vocabulary.
  const kit = { ...ARTWORK_KIT, shirtPattern: 'checks' } satisfies PersonAvatarKit;
  // @ts-expect-error The root slot cannot replace generated geometry.
  const rootViewBox = <PersonAvatar seed="type" slotProps={{ root: { viewBox: '0 0 1 1' } }} />;
  // @ts-expect-error The root slot cannot replace generated semantics.
  const rootRole = <PersonAvatar seed="type" slotProps={{ root: { role: 'button' } }} />;
  return [crop, children, publicCss, domain, kit, rootViewBox, rootRole];
}
void TypeContract;
