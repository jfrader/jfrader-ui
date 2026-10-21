import type { ComponentPropsWithRef, CSSProperties } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, waitFor, within } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { withLightTheme } from '../../testing/story-decorators';
import { expectAligned, expectInside, expectNoOverlap } from '../../testing/geometry-assertions';
import { Emblem, type EmblemPattern, type EmblemShape, type EmblemSize } from './index';

// Club palettes are consumer data, not tokens: an app passes its own colors in.
const CLUB = { color: '#12306b', secondaryColor: '#f0c33c' };
const PALE_CLUB = { color: '#ffd400' };
const DEEP_CLUB = { color: '#101a3d' };
const LOCKED_INK = '#7a3b00';
// Bands stay near the fill's lightness, or the monogram loses contrast over them.
const BANDED_CLUB = { color: '#12306b', secondaryColor: '#3a67b5' };

const SHAPES = ['shield', 'circle', 'squircle', 'hexagon'] as const satisfies readonly EmblemShape[];
const SIZES = ['sm', 'md', 'lg', 'xl'] as const satisfies readonly EmblemSize[];
const PATTERNS = ['none', 'stripes', 'hoops', 'sash'] as const satisfies readonly EmblemPattern[];
const SIZE_PX = { sm: 24, md: 32, lg: 40, xl: 56 } as const;
const SHIELD_RATIO = 8 / 7;
const NAME = 'Racing Club';

function SlotMonogram(props: ComponentPropsWithRef<'span'>) {
  return <span {...props} data-slot="emblem-monogram" />;
}

export const MonogramReplacement: Story = {
  render: (args) => <Emblem {...args} src={undefined} slots={{ monogram: SlotMonogram }} />,
  play: async ({ canvasElement }) => {
    const monogram = canvasElement.querySelector('[data-slot="emblem-monogram"]');
    await expect(monogram).toBeInTheDocument();
    await expect(monogram).toHaveAttribute('data-ui', 'emblem-ink');
    await expect(getComputedStyle(monogram!).fontWeight).toBe('600');
    await expect(monogram).toHaveAttribute('aria-hidden', 'true');
    await expect(canvasElement.querySelector('[data-ui="emblem-ink"]:not([data-slot])')).toBeNull();
  },
};

// A crest image is consumer content, so the fixture draws its own colors.
const CREST_SRC = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">' +
    '<rect width="64" height="64" fill="#12306b"/>' +
    '<circle cx="32" cy="28" r="13" fill="#f0c33c"/>' +
    '<rect x="8" y="48" width="48" height="7" fill="#f0c33c"/></svg>',
)}`;
const BROKEN_SRC = 'data:image/png;base64,broken';

const rowStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: vars.space[4],
} satisfies CSSProperties;

const plateOf = (canvas: HTMLElement, name: string) =>
  within(canvas)
    .getByRole('img', { name })
    .querySelector<HTMLElement>('[data-ui="emblem-plate"]')!;

const backgroundOf = (canvas: HTMLElement, name: string) => getComputedStyle(plateOf(canvas, name)).backgroundImage;

const meta = {
  title: 'Data display/Emblem',
  component: Emblem,
  tags: ['autodocs'],
  args: { name: NAME, ...CLUB },
  argTypes: {
    shape: { control: 'radio', options: SHAPES },
    size: { control: 'radio', options: SIZES },
    pattern: { control: 'select', options: PATTERNS },
  },
  parameters: {
    docs: {
      description: {
        component: 'Show a club, team or brand as a shaped mark built from its own colors and name.',
      },
      sections: [
        { title: 'Basic', stories: ['Default'] },
        { title: 'Appearance', stories: ['Shapes', 'Sizes', 'Patterns'] },
        { title: 'Images', stories: ['CrestImage'] },
        { title: 'Navigation', stories: ['Linked'] },
      ],
      usage: `### Contrast
Check the initials against both the fill and pattern colors. A contrasting fill alone is not enough when a band crosses the letters. Shield marks are taller than they are wide; leave room for the full shape.

### Accessibility
A mark is not a control unless you make it a link. Keep visible initials in a linked mark's accessible name. Failed images fall back to initials, so keep a useful name even when supplying artwork.`,
    },
  },
} satisfies Meta<typeof Emblem>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Club initials',
  parameters: { docs: { description: { story: 'Build a shield from a club name and its colors.' }, source: { language: 'tsx', code: `import { Emblem } from '@jfrader/ui';

<Emblem name="Racing Club" color="#12306b" secondaryColor="#f0c33c" />` } } },
  play: async ({ canvasElement }) => {
    const emblem = within(canvasElement).getByRole('img', { name: NAME });
    await expect(emblem).toHaveTextContent('RC');
    await expect(getComputedStyle(plateOf(canvasElement, NAME)).clipPath).toContain('polygon');
    // A real border carries the shape once the shadow is gone.
    const ring = getComputedStyle(plateOf(canvasElement, NAME), '::after');
    await expect(ring.borderTopStyle).toBe('solid');
    await expect(ring.borderTopWidth).toBe('1px');
  },
};

export const Shapes: Story = {
  name: 'Mark shapes',
  parameters: { docs: { description: { story: 'Compare shield, circle, squircle and hexagon silhouettes.' }, source: { language: 'tsx', code: `import { Emblem, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const Marks = styled.div({ display: 'flex', alignItems: 'center', gap: vars.space[4] });

<Marks>
  <Emblem name="shield club" shape="shield" color="#12306b" secondaryColor="#f0c33c" />
  <Emblem name="circle club" shape="circle" color="#12306b" secondaryColor="#f0c33c" />
  <Emblem name="squircle club" shape="squircle" color="#12306b" secondaryColor="#f0c33c" />
  <Emblem name="hexagon club" shape="hexagon" color="#12306b" secondaryColor="#f0c33c" />
</Marks>` } } },
  render: (args) => (
    <div style={rowStyle}>
      {SHAPES.map((shape) => (
        <Emblem {...args} key={shape} shape={shape} name={`${shape} club`} />
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    const emblems = within(canvasElement).getAllByRole('img');
    await expectAligned(emblems, 'center-y');
    for (const [index, emblem] of emblems.entries()) {
      await expectInside(plateOf(canvasElement, `${SHAPES[index]} club`), emblem);
      for (const other of emblems.slice(index + 1)) await expectNoOverlap(emblem, other);
    }
    for (const shape of SHAPES) {
      const style = getComputedStyle(plateOf(canvasElement, `${shape} club`));
      const clipped = shape === 'shield' || shape === 'hexagon';
      await expect(style.clipPath.startsWith('polygon(')).toBe(clipped);
      await expect(style.borderRadius === '0px').toBe(clipped);
    }
  },
};

export const Sizes: Story = {
  name: 'Mark sizes',
  parameters: { docs: { description: { story: 'Compare the four sizes with the same shield silhouette.' }, source: { language: 'tsx', code: `import { Emblem, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const Marks = styled.div({ display: 'flex', alignItems: 'center', gap: vars.space[4] });

<Marks>
  <Emblem name="Size sm" size="sm" color="#12306b" secondaryColor="#f0c33c" />
  <Emblem name="Size md" size="md" color="#12306b" secondaryColor="#f0c33c" />
  <Emblem name="Size lg" size="lg" color="#12306b" secondaryColor="#f0c33c" />
  <Emblem name="Size xl" size="xl" color="#12306b" secondaryColor="#f0c33c" />
</Marks>` } } },
  render: (args) => (
    <div style={rowStyle}>
      {SIZES.map((size) => (
        <Emblem {...args} key={size} size={size} name={`Size ${size}`} />
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    for (const size of SIZES) {
      const rect = within(canvasElement).getByRole('img', { name: `Size ${size}` }).getBoundingClientRect();
      await expect(Math.round(rect.width)).toBe(SIZE_PX[size]);
      await expect(Math.round(rect.height)).toBe(Math.round(SIZE_PX[size] * SHIELD_RATIO));
    }
  },
};

export const Patterns: Story = {
  name: 'Club patterns',
  parameters: { docs: { description: { story: 'Add stripes, hoops or a sash while keeping the initials readable.' }, source: { language: 'tsx', code: `import { Emblem, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const Marks = styled.div({ display: 'flex', alignItems: 'center', gap: vars.space[4] });

<Marks>
  <Emblem name="Pattern none" pattern="none" color="#12306b" secondaryColor="#3a67b5" />
  <Emblem name="Pattern stripes" pattern="stripes" color="#12306b" secondaryColor="#3a67b5" />
  <Emblem name="Pattern hoops" pattern="hoops" color="#12306b" secondaryColor="#3a67b5" />
  <Emblem name="Pattern sash" pattern="sash" color="#12306b" secondaryColor="#3a67b5" />
</Marks>` } } },
  render: (args) => (
    <div style={rowStyle}>
      {PATTERNS.map((pattern) => (
        <Emblem {...args} {...BANDED_CLUB} key={pattern} pattern={pattern} name={`Pattern ${pattern}`} />
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    await expect(backgroundOf(canvasElement, 'Pattern none')).not.toContain('repeating');
    await expect(backgroundOf(canvasElement, 'Pattern stripes')).toContain('repeating-linear-gradient');
    await expect(backgroundOf(canvasElement, 'Pattern hoops')).toContain('repeating-linear-gradient');
    await expect(backgroundOf(canvasElement, 'Pattern stripes')).not.toBe(
      backgroundOf(canvasElement, 'Pattern hoops'),
    );
    await expect(backgroundOf(canvasElement, 'Pattern sash')).toContain('linear-gradient(135deg');
  },
};

export const ContrastInk: Story = {
  render: () => (
    <div style={rowStyle}>
      <Emblem name="Pale club" {...PALE_CLUB} />
      <Emblem name="Deep club" {...DEEP_CLUB} />
      <Emblem name="Locked club" {...PALE_CLUB} inkColor={LOCKED_INK} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const inkOf = (name: string) => {
      const ink = within(canvasElement)
        .getByRole('img', { name })
        .querySelector<HTMLElement>('[data-ui="emblem-ink"]')!;
      return getComputedStyle(ink).color;
    };
    // Resolved against the gradient's light end: black on a pale fill, white on a deep one.
    await expect(inkOf('Pale club')).toBe('rgb(0, 0, 0)');
    await expect(inkOf('Deep club')).toBe('rgb(255, 255, 255)');
    await expect(inkOf('Locked club')).toBe('rgb(122, 59, 0)');
  },
};

export const CrestImage: Story = {
  name: 'Crest artwork',
  parameters: { docs: { description: { story: 'Use crest artwork in place of the generated initials.' }, source: { language: 'tsx', code: `import { Emblem } from '@jfrader/ui';

const crest = 'data:image/svg+xml,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">' +
  '<rect width="64" height="64" fill="#12306b"/>' +
  '<circle cx="32" cy="28" r="13" fill="#f0c33c"/>' +
  '<rect x="8" y="48" width="48" height="7" fill="#f0c33c"/></svg>',
);

<Emblem name="Racing Club" color="#12306b" secondaryColor="#f0c33c" src={crest} />` } } },
  args: { src: CREST_SRC },
  play: async ({ canvasElement }) => {
    const emblem = within(canvasElement).getByRole('img', { name: NAME });
    const image = emblem.querySelector('img');
    await expect(image).toHaveAttribute('alt', '');
    await waitFor(async () => {
      await expect(image?.complete).toBe(true);
      await expect(image?.naturalWidth).toBeGreaterThan(0);
    });
    await expect(emblem).not.toHaveTextContent('RC');
  },
};

export const BrokenImage: Story = {
  args: { src: BROKEN_SRC },
  play: async ({ canvasElement }) => {
    const emblem = within(canvasElement).getByRole('img', { name: NAME });
    await waitFor(() => expect(emblem).toHaveTextContent('RC'));
    await expect(emblem.querySelector('img')).toBeNull();
  },
};

export const Linked: Story = {
  name: 'Linked club',
  parameters: {
    docs: {
      description: { story: 'Make the club mark a keyboard-accessible link.' },
      source: {
        language: 'tsx',
        code: `import { Emblem } from '@jfrader/ui';

<Emblem
  name="Racing Club"
  color="#12306b"
  secondaryColor="#f0c33c"
  render={(props) => <a href="#racing-club" {...props} />}
/>`,
      },
    },
  },
  args: {
    render: (props) => <a href="#racing-club" {...props} />,
  },
  play: async ({ canvasElement, userEvent }) => {
    // The visible monogram stays part of the link's name.
    const link = within(canvasElement).getByRole('link', { name: `${NAME} — RC` });
    await expect(link).toHaveTextContent('RC');
    await expect(link).toHaveAttribute('href', '#racing-club');
    await expect(link).toHaveAttribute('data-ui', 'emblem');
    await userEvent.tab();
    await expect(link.ownerDocument.activeElement).toBe(link);
    const style = getComputedStyle(link);
    await expect(style.outlineStyle).not.toBe('none');
    await expect(style.outlineWidth).toBe('2px');
    await expect(style.outlineOffset).toBe('2px');
  },
};

export const LightTheme: Story = {
  decorators: [withLightTheme],
  render: (args) => (
    <div style={rowStyle}>
      <Emblem {...args} />
      <Emblem {...args} {...PALE_CLUB} name="Pale club" pattern="stripes" />
      <Emblem {...args} name="Crest club" shape="circle" src={CREST_SRC} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('img', { name: NAME })).toHaveTextContent('RC');
  },
};

export const Rtl: Story = {
  args: { pattern: 'sash' },
  render: (args) => (
    <div style={rowStyle}>
      <Emblem {...args} dir="ltr" name="Left sash" />
      <Emblem {...args} dir="rtl" name="Right sash" />
    </div>
  ),
  play: async ({ canvasElement }) => {
    await expect(backgroundOf(canvasElement, 'Right sash')).not.toBe(backgroundOf(canvasElement, 'Left sash'));
  },
};

export const NarrowRow: Story = {
  render: (args) => (
    <div style={{ ...rowStyle, inlineSize: '8rem', maxInlineSize: '100%' }}>
      <Emblem {...args} size="xl" />
      <span style={{ minInlineSize: 0, overflowWrap: 'anywhere' }}>InternationalRacingClub</span>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const emblem = within(canvasElement).getByRole('img', { name: NAME });
    await expect(emblem.getBoundingClientRect().width).toBe(SIZE_PX.xl);
    await expectInside(emblem, emblem.parentElement!);
    await expectNoOverlap(emblem, emblem.nextElementSibling!);
  },
};

export const LongName: Story = {
  args: { name: 'World Wide Wanderers' },
  render: (args) => <div style={rowStyle}>{SHAPES.map((shape) => <Emblem {...args} key={shape} shape={shape} />)}</div>,
  play: async ({ canvasElement }) => {
    for (const ink of canvasElement.querySelectorAll<HTMLElement>('[data-ui="emblem-ink"]')) {
      await expect(ink).toHaveTextContent('WWW');
      await expect(ink.scrollWidth).toBeLessThanOrEqual(ink.clientWidth);
      await expectInside(ink, ink.parentElement!);
      await expect(ink.getBoundingClientRect().width).toBeLessThanOrEqual(ink.parentElement!.getBoundingClientRect().width * 0.7);
    }
  },
};

export const ForcedColors: Story = {
  render: (args) => <div style={rowStyle}>{SHAPES.map((shape) => <Emblem {...args} key={shape} shape={shape} />)}</div>,
  play: async ({ canvasElement }) => {
    const plate = canvasElement.querySelector<HTMLElement>('[data-ui="emblem-plate"]')!;
    const rules = Array.from(plate.ownerDocument.styleSheets).flatMap((sheet) => Array.from(sheet.cssRules))
      .filter((rule): rule is CSSMediaRule => rule instanceof CSSMediaRule && rule.conditionText.includes('forced-colors: active'))
      .flatMap((rule) => Array.from(rule.cssRules))
      .filter((rule): rule is CSSStyleRule => rule instanceof CSSStyleRule && plate.matches(rule.selectorText));
    await expect(rules.some((rule) => rule.style.forcedColorAdjust === 'none' && rule.style.backgroundColor.toLowerCase() === 'canvastext')).toBe(true);
    await expect(rules.some((rule) => rule.style.backgroundImage === 'none')).toBe(true);
  },
};
