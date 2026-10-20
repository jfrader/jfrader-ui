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
import { Avatar } from '../avatar';
import { AvatarGroup } from '../avatar-group';
import { Button } from '../button';
import { Flex } from '../flex';
import { Stack } from '../stack';
import { Surface } from '../surface';
import { Scene } from '../scene';
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

const ContextSurface = styled(Surface)({
  padding: vars.space[4], maxInlineSize: `calc(${vars.space[12]} * 8)`,
});
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
      sections: [
        { title: 'Basic', stories: ['Default'] },
        { title: 'Kits and artwork', stories: ['FullKit', 'KitVariants', 'Staff', 'Crops'] },
        { title: 'Fill a frame', stories: ['FullSize'] },
        { title: 'Fallback and group composition', stories: ['InAvatar', 'TeamPortraits'] },
      ],
      usage: `
### When to use
Generate person artwork when a photo is unavailable. Use Avatar for identity, initials and presence; PersonAvatar supplies only the artwork.

### Identity and layout
Keep the seed tied to a durable member id, not a display name or list position. Clothing changes do not change the person's identity. Appearance signatures are not identifiers.

A full-size portrait needs a parent with explicit dimensions. Circular portraits clip peripheral hair and clothing without zooming; full kits stay letterboxed in square frames. Artwork colors stay fixed across themes and forced colors.

### Accessibility
Name standalone artwork when it conveys a person's identity. Keep it decorative inside a named Avatar to avoid duplicate announcements. The SVG is not a keyboard target; put profile actions in named buttons or links.
`,
    },
  },
} satisfies Meta<typeof PersonAvatar>;
export default meta;
type Story = StoryObj<typeof meta>;

export const TeamPortraits: Story = {
  name: 'Portraits in a group',
  parameters: { docs: {
    description: { story: 'Give each group member a stable portrait without repeating accessible names.' },
    source: { language: 'tsx', code: `import { AvatarGroup, PersonAvatar } from '@jfrader/ui';

<AvatarGroup label="Project team" members={[
  { id: 'alex', name: 'Alex', avatarProps: {
    children: <PersonAvatar seed="alex" alt="" size="full" crop="circle" />,
  } },
  { id: 'blair', name: 'Blair', avatarProps: {
    children: <PersonAvatar seed="blair" alt="" size="full" crop="circle" />,
  } },
]} />` },
  } },
  render: () => <AvatarGroup label="Project team" members={[
    { id: 'alex', name: 'Alex', avatarProps: {
      children: <PersonAvatar seed="alex" alt="" size="full" crop="circle" />,
    } },
    { id: 'blair', name: 'Blair', avatarProps: {
      children: <PersonAvatar seed="blair" alt="" size="full" crop="circle" />,
    } },
  ]} />,
};

export const Default: Story = {
  name: 'Seeded portrait',
  parameters: { docs: {
    description: { story: 'Generate the same portrait whenever the member seed stays the same.' },
    source: { language: 'tsx', code: `import { PersonAvatar } from '@jfrader/ui';

<PersonAvatar seed="stable-visual-seed" alt="Alex" />` },
  } },
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
export const LightTheme: Story = { ...Default, name: 'Light theme', decorators: [withLightTheme], globals: { theme: 'light' } };
export const DarkTheme: Story = { ...Default, name: 'Dark theme', globals: { theme: 'dark' } };

/** A decorative portrait inside Avatar's named identity and presence frame. */
export const InAvatar: Story = {
  name: 'Portrait fallback',
  parameters: { docs: { description: { story: 'Use decorative artwork as the fallback inside a named Avatar with presence.' }, source: { language: 'tsx', code: `import { Avatar, PersonAvatar } from '@jfrader/ui';

<Avatar name="Alex" status="online">
  <PersonAvatar seed="member-alex" alt="" size="full" crop="circle" />
</Avatar>` } } },
  render: () => <Avatar name="Alex" status="online">
    <PersonAvatar seed="member-alex" alt="" size="full" crop="circle" />
  </Avatar>,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getAllByRole('img')).toHaveLength(1);
    const avatar = canvas.getByRole('img', { name: 'Alex, online' });
    const portrait = avatar.querySelector('svg')!;
    await expect(portrait).toHaveAttribute('aria-hidden', 'true');
    await expect(portrait.getBoundingClientRect().width).toBe(avatar.getBoundingClientRect().width);
    await expect(portrait.getBoundingClientRect().height).toBe(avatar.getBoundingClientRect().height);
  },
};

/** Procedural Scene artwork beside two independently named people. */
export const SceneContext: Story = {
  parameters: { docs: { source: { language: 'tsx', code: `import { Flex, PersonAvatar, Scene, Stack, Surface, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const MeetingSurface = styled(Surface)({
  padding: vars.space[4], maxInlineSize: \`calc(\${vars.space[12]} * 8)\`,
});

<MeetingSurface>
  <Stack gap="md">
    <Scene seed="studio-garden" alt="" />
    <Flex gap="md" align="center" wrap>
      <PersonAvatar seed="member-alex" alt="Alex" size="lg" />
      <PersonAvatar seed="member-blair" alt="Blair" size="lg" attire="staff" />
    </Flex>
  </Stack>
</MeetingSurface>` } } },
  render: () => <ContextSurface>
    <Stack gap="md">
      <Scene seed="studio-garden" alt="" />
      <Flex gap="md" align="center" wrap>
        <PersonAvatar seed="member-alex" alt="Alex" size="lg" />
        <PersonAvatar seed="member-blair" alt="Blair" size="lg" attire="staff" />
      </Flex>
    </Stack>
  </ContextSurface>,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getAllByRole('img')).toHaveLength(2);
    await expect(canvas.getByRole('img', { name: 'Alex' })).toBeInTheDocument();
    await expect(canvas.getByRole('img', { name: 'Blair' })).toBeInTheDocument();
    await expect(canvasElement.querySelector('[data-ui="scene"]')).toHaveAttribute('aria-hidden', 'true');
  },
};

export const ThemeParity: Story = {
  parameters: { docs: { source: { language: 'tsx', code: `import { PersonAvatar, ThemeRoot } from '@jfrader/ui';

<>
  <ThemeRoot theme="light"><PersonAvatar seed="stable-visual-seed" alt="Alex" crop="circle" /></ThemeRoot>
  <ThemeRoot theme="dark"><PersonAvatar seed="stable-visual-seed" alt="Alex" crop="circle" /></ThemeRoot>
</>` } } },
  render: (args) => <Flex wrap align="center" gap="md"><ThemeRoot theme="light"><PersonAvatar {...args} crop="circle" fullKit={false} /></ThemeRoot>
    <ThemeRoot theme="dark"><PersonAvatar {...args} crop="circle" fullKit={false} /></ThemeRoot></Flex>,
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
  render: (args) => <Flex wrap align="center" gap="md">
    <PersonAvatar {...args} size="sm" /><PersonAvatar {...args} size="md" /><PersonAvatar {...args} size="lg" />
    <CustomAvatar {...args} sx={{ inlineSize: `calc(${vars.space[12]} * 2)`, blockSize: `calc(${vars.space[12]} * 2)` }} />
  </Flex>,
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
  name: 'Square and circular portraits',
  parameters: { docs: { description: { story: 'Compare the square portrait with a circular crop of the same person.' }, source: { language: 'tsx', code: `import { Flex, PersonAvatar } from '@jfrader/ui';

<Flex wrap align="center" gap="md">
  <PersonAvatar seed="stable-visual-seed" alt="Alex" size="lg" />
  <PersonAvatar seed="stable-visual-seed" alt="Alex" size="lg" crop="circle" />
</Flex>` } } },
  render: (args) => <Flex wrap align="center" gap="md"><PersonAvatar {...args} size="lg" /><PersonAvatar {...args} size="lg" fullKit={false} crop="circle" /></Flex>,
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
  name: 'Full kit',
  parameters: { docs: { description: { story: 'Render a full-body kit with explicit garment colors and patterns.' }, source: { language: 'tsx', code: `${kitSource}<PersonAvatar seed="stable-visual-seed" alt="Alex" fullKit kit={kit} size="lg" />` } } },
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
  name: 'Staff attire',
  parameters: { docs: {
    description: { story: 'Dress the same person in a staff jacket and tie.' },
    source: { language: 'tsx', code: `import { PersonAvatar } from '@jfrader/ui';

<PersonAvatar seed="stable-visual-seed" alt="Alex" attire="staff" fullKit size="lg" />` },
  } },
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
  render: () => <Flex wrap align="center" gap="md">{paletteSeeds.map(seed => <PersonAvatar key={seed} seed={seed} />)}</Flex>,
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
  render: (args) => <Flex wrap align="center" gap="md"><PersonAvatar {...args} /><PersonAvatar {...args} /></Flex>,
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
  render: () => <Flex wrap align="center" gap="md">{PERSON_HAIR_STYLES.map(hair => {
    const seed = RECIPE_FIXTURES.find(([, recipe]) => recipe.hairStyle === hair)![0];
    return <PersonAvatar key={hair} seed={seed} />;
  })}</Flex>,
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

const patternKits: PersonAvatarKit[] = PERSON_SHIRT_PATTERNS.map((shirtPattern, index) => ({
  ...ARTWORK_KIT,
  shirt: PERSON_ART_COLORS.staffJacket, shorts: PERSON_ART_COLORS.staffShirt,
  socks: PERSON_ART_COLORS.headband, accent: PERSON_ART_COLORS.earring,
  shortsAccent: PERSON_ART_COLORS.mouth, socksAccent: PERSON_ART_COLORS.shadow,
  shirtPattern,
  shortsPattern: PERSON_SHORTS_PATTERNS[index % PERSON_SHORTS_PATTERNS.length]!,
  socksPattern: PERSON_SOCKS_PATTERNS[index % PERSON_SOCKS_PATTERNS.length]!,
}));
export const KitVariants: Story = {
  name: 'Garment patterns',
  parameters: { docs: { description: { story: 'Compare shirt, shorts and sock patterns while keeping the person unchanged.' }, source: { language: 'tsx', code: `${kitSource}import { Flex } from '@jfrader/ui';
import { PERSON_SHIRT_PATTERNS, PERSON_SHORTS_PATTERNS, PERSON_SOCKS_PATTERNS } from '@jfrader/ui/person-avatar/kit';

const kits: PersonAvatarKit[] = PERSON_SHIRT_PATTERNS.map((shirtPattern, index) => ({
  ...kit,
  socks: PERSON_ART_COLORS.headband,
  accent: PERSON_ART_COLORS.earring,
  shortsAccent: PERSON_ART_COLORS.mouth,
  socksAccent: PERSON_ART_COLORS.shadow,
  shirtPattern,
  shortsPattern: PERSON_SHORTS_PATTERNS[index % PERSON_SHORTS_PATTERNS.length]!,
  socksPattern: PERSON_SOCKS_PATTERNS[index % PERSON_SOCKS_PATTERNS.length]!,
}));

<Flex wrap align="center" gap="md">{kits.map((kit, index) => (
  <PersonAvatar key={index} seed="stable-visual-seed" alt="Alex" kit={kit} size="lg" fullKit crop="none" primary="currentColor" secondary="currentColor" />
))}</Flex>` } } },
  render: (args) => <Flex wrap align="center" gap="md">{patternKits.map((kit, index) => <PersonAvatar {...args} key={index} kit={kit} size="lg" fullKit crop="none"
    primary="currentColor" secondary="currentColor" />)}</Flex>,
  play: async ({ canvasElement }) => {
    for (const [key, patterns] of [
      ['shirtPattern', PERSON_SHIRT_PATTERNS],
      ['shortsPattern', PERSON_SHORTS_PATTERNS],
      ['socksPattern', PERSON_SOCKS_PATTERNS],
    ] as const) {
      await expect(new Set(patternKits.map(kit => kit[key]))).toEqual(new Set(patterns));
    }
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
  render: () => <Flex wrap align="center" gap="md">
    <PersonAvatar seed={glassesSeed} kit={patternKits[0]} />
    <PersonAvatar seed={glassesSeed} kit={patternKits[3]} size="lg" fullKit />
    <PersonAvatar seed={glassesSeed} attire="staff" kit={patternKits[3]} />
  </Flex>,
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
  render: () => <Flex wrap align="center" gap="md">
    <PersonAvatar seed="simple-colors" primary={vars.color.accent} secondary="currentColor" fullKit />
    <PersonAvatar seed="simple-colors" primary={vars.color.accent} secondary="currentColor" attire="staff" kit={patternKits[2]} />
    <PersonAvatar seed="simple-colors" primary={vars.color.accent} secondary="currentColor" attire="staff" />
  </Flex>,
  play: async ({ canvasElement }) => {
    const [kit, staffWithKit, staff] = Array.from(canvasElement.querySelectorAll('svg'));
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
  render: () => <Flex wrap align="center" gap="md">
    <PersonAvatar seed="unannounced-seed" />
    <PersonAvatar seed="unannounced-seed" alt="" aria-label="Hidden" aria-labelledby="hidden-label" />
    <PersonAvatar seed="unannounced-seed" alt="Hidden" aria-hidden />
    <PersonAvatar seed="unannounced-seed" alt="   " aria-hidden={false} />
    <PersonAvatar seed="unannounced-seed" aria-label="   " aria-hidden={false} />
  </Flex>,
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
  render: () => <Flex wrap align="center" gap="md"><PersonAvatar seed="unannounced-seed" alt="Alex" aria-label="Blair" />
    <PersonAvatar seed="unannounced-seed" aria-label="Blair" /></Flex>,
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
  render: () => <Flex wrap align="center" gap="md"><span id="person-name">Blair</span><span id="person-description">Captain</span>
    <PersonAvatar seed="external" alt="Alex" aria-label="Casey"
      slotProps={{ root: { 'aria-labelledby': 'person-name', 'aria-describedby': 'person-description' } }} /></Flex>,
  play: async ({ canvasElement }) => {
    const svg = within(canvasElement).getByRole('img', { name: 'Blair' });
    await expect(svg).not.toHaveAttribute('aria-label');
    await expect(svg).toHaveAttribute('aria-labelledby', 'person-name');
    await expect(svg).toHaveAccessibleDescription('Captain');
  },
};
export const Keyboard: Story = {
  parameters: { docs: { source: { language: 'tsx', code: `import { Button, PersonAvatar } from '@jfrader/ui';

<>
  <Button>Before</Button>
  <PersonAvatar seed="keyboard" alt="Alex" />
  <PersonAvatar seed="keyboard" />
  <Button>After</Button>
</>` } } },
  render: () => <Flex wrap align="center" gap="md"><Button>Before</Button><PersonAvatar seed="keyboard" alt="Alex" />
    <PersonAvatar seed="keyboard" /><Button>After</Button></Flex>,
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
    slotProps={{ root: { ...args.slotProps?.root, className: 'slot', sx: slotCss, style: { opacity: 1 }, 'aria-label': 'Blair',
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
  name: 'Fill a sized frame',
  parameters: { docs: {
    description: { story: 'Fill equal-sized parent frames with a portrait and a letterboxed full kit.' },
    source: { language: 'tsx', code: `import { Flex, PersonAvatar, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const PortraitFrame = styled.div({ inlineSize: vars.space[10], blockSize: vars.space[10] });

<Flex wrap align="center" gap="md">
  <PortraitFrame><PersonAvatar seed="stable-visual-seed" size="full" alt="Portrait" /></PortraitFrame>
  <PortraitFrame><PersonAvatar seed="stable-visual-seed" size="full" fullKit crop="none" alt="Full kit" /></PortraitFrame>
</Flex>` },
  } },
  render: args => <Flex wrap align="center" gap="md">
    <FullSizeFrame><PersonAvatar {...args} size="full" alt="Portrait" /></FullSizeFrame>
    <FullSizeFrame><PersonAvatar {...args} size="full" fullKit crop="none" alt="Full kit" /></FullSizeFrame>
  </Flex>,
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
