import type { CSSProperties } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, waitFor, within } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { withLightTheme } from '../../testing/story-decorators';
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
    },
  },
} satisfies Meta<typeof Emblem>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
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
  render: (args) => (
    <div style={rowStyle}>
      {SHAPES.map((shape) => (
        <Emblem {...args} key={shape} shape={shape} name={`${shape} club`} />
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    for (const shape of SHAPES) {
      const style = getComputedStyle(plateOf(canvasElement, `${shape} club`));
      const clipped = shape === 'shield' || shape === 'hexagon';
      await expect(style.clipPath.startsWith('polygon(')).toBe(clipped);
      await expect(style.borderRadius === '0px').toBe(clipped);
    }
  },
};

export const Sizes: Story = {
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
