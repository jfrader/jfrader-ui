import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, waitFor } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { css } from '../../styling/css';
import { withLightTheme } from '../../testing/story-decorators';
import { FlipGameCard } from '../flip-game-card';
import { GameCard } from '../game-card';
import { Pattern, type PatternVariant } from './index';

const variants: PatternVariant[] = ['stripes', 'diagonal', 'checks', 'dots', 'waves', 'chevron'];
const sampleStyle = css({ inlineSize: vars.size.gameCardLg, blockSize: vars.size.gameCardLg });
const smallSampleStyle = css({ inlineSize: vars.size.gameCardSm, blockSize: vars.size.gameCardSm });
const galleryStyle = css({ display: 'grid', gap: vars.space[6], gridTemplateColumns: 'repeat(2, max-content)' });
const rowStyle = css({ display: 'flex', alignItems: 'center', gap: vars.space[3] });
const labelStyle = css({ marginBlock: vars.space[2], color: vars.color.text, fontSize: vars.textSize.sm });

const meta = {
  title: 'Foundations/Pattern',
  component: Pattern,
  tags: ['autodocs'],
  args: { variant: 'diagonal', size: 'md', scale: 1, tone: 'accent' },
  argTypes: {
    variant: { control: 'select', options: variants },
    size: { control: 'radio', options: ['sm', 'md', 'lg'] },
    tone: { control: 'radio', options: ['neutral', 'accent', 'card'] },
  },
  parameters: {
    docs: {
      description: { component: 'Fill a surface with a repeating SVG pattern.' },
      usage: `### Tiles and inks
- Give the SVG a width and height through its parent or \`sx\`. It fills its parent by default.
- \`size\` sets the tile side to 8, 16 or 24 CSS pixels. \`scale\` multiplies that side; nonpositive or nonfinite values fall back to 1.
- \`tone\` selects token pairs: \`neutral\` uses surfaceRaised/borderStrong, \`accent\` uses accentSoft/accent, and \`card\` uses cardRed/cardFace.
- Use \`@jfrader/ui/pattern\` or the main package export. The React 19 \`ref\` reaches the SVG; \`sx\` styles that root.

### Accessibility and environments
- Patterns are always decorative (\`aria-hidden="true"\`, not focusable). Give the enclosing card or surface its own name when needed. There is no APG widget, state or keyboard command.
- Inherited direction and a root \`dir\` prop mirror diagonal and chevron patterns in RTL; other variants keep their orientation.
- Forced colors replaces the painted tile with a flat \`Canvas\` fill. Do not use patterns to convey information.
- Patterns have no motion. IDs come from React \`useId\`; give separate SSR roots distinct \`identifierPrefix\` values and reuse them during hydration.

### Card artwork
- Pass a Pattern as consumer artwork to a \`GameCard\` face, then pass that named face as \`FlipGameCard back\`. Custom artwork needs a value to select the art path; never put secret card data in a flipped wrapper, whose two faces stay mounted.`,
    },
  },
} satisfies Meta<typeof Pattern>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => <Pattern {...args} css={sampleStyle} />,
  play: async ({ canvasElement }) => {
    const root = canvasElement.querySelector('[data-ui="pattern"]');
    await expect(root).toHaveAttribute('aria-hidden', 'true');
    await expect(root).toHaveAttribute('focusable', 'false');
    await expect(root).not.toHaveAttribute('tabindex');
  },
};

export const Gallery: Story = {
  render: (args) => <div css={galleryStyle}>
    {variants.map((variant) => <section key={variant}>
      <h3 css={labelStyle}>{variant}</h3>
      <div css={rowStyle}>
        <Pattern {...args} variant={variant} size="sm" css={smallSampleStyle} />
        <Pattern {...args} variant={variant} size="sm" css={sampleStyle} />
        <Pattern {...args} variant={variant} size="lg" css={sampleStyle} />
      </div>
    </section>)}
  </div>,
  play: async ({ canvasElement }) => {
    const roots = canvasElement.querySelectorAll('[data-ui="pattern"]');
    const ids = Array.from(canvasElement.querySelectorAll('pattern'), (tile) => tile.id);
    await expect(new Set(ids).size).toBe(variants.length * 3);
    for (const [index, root] of Array.from(roots).entries()) {
      const tile = root.querySelector('pattern');
      await expect(tile).toHaveAttribute('width', index % 3 === 2 ? '24' : '8');
      await expect(tile).toHaveAttribute('height', index % 3 === 2 ? '24' : '8');
      await expect(root.querySelector(':scope > rect')).toHaveAttribute('fill', `url(#${tile?.id})`);
      await expect(root).toHaveAttribute('aria-hidden', 'true');
    }
  },
};

export const GalleryLight: Story = { ...Gallery, decorators: [withLightTheme] };

export const Tones: Story = {
  render: (args) => <div css={rowStyle}>{(['neutral', 'accent', 'card'] as const).map((tone) =>
    <Pattern {...args} key={tone} tone={tone} css={sampleStyle} />)}</div>,
};
export const TonesLight: Story = { ...Tones, decorators: [withLightTheme] };

export const TileScale: Story = {
  render: (args) => <div css={rowStyle}>{[0.5, 1, 2, 0, -1, Infinity].map((scale) =>
    <Pattern {...args} key={scale} scale={scale} css={sampleStyle} />)}</div>,
  play: async ({ canvasElement }) => {
    const tiles = canvasElement.querySelectorAll('pattern');
    for (const [index, side] of [8, 16, 32, 16, 16, 16].entries()) {
      await expect(tiles[index]).toHaveAttribute('width', String(side));
      await expect(tiles[index]).toHaveAttribute('height', String(side));
    }
  },
};

export const Direction: Story = {
  render: (args) => <div css={galleryStyle}>{variants.map((variant) => <div css={rowStyle} key={variant}>
    <div dir="rtl"><Pattern {...args} variant={variant} dir="ltr" css={sampleStyle} /></div>
    <div dir="rtl"><Pattern {...args} variant={variant} css={sampleStyle} /></div>
    <Pattern {...args} variant={variant} dir="rtl" css={sampleStyle} />
  </div>)}</div>,
  play: async ({ canvasElement }) => {
    for (const [index, root] of Array.from(canvasElement.querySelectorAll('[data-ui="pattern"]')).entries()) {
      const mirrored = index % 3 !== 0 && ['diagonal', 'chevron'].includes(root.getAttribute('data-variant') ?? '');
      await expect(getComputedStyle(root).transform).toBe(mirrored ? 'matrix(-1, 0, 0, 1, 0, 0)' : 'none');
    }
  },
};

export const FlippedCard: Story = {
  render: (args) => <div css={rowStyle}>{(['sm', 'md', 'lg'] as const).map((size) =>
    <FlipGameCard key={size} size={size} flipped
      front={<GameCard label="Ace of spades" value={{ deck: 'french', suit: 'spades', rank: 'A' }} />}
      back={<GameCard label="Patterned card back" value={{ deck: 'french', suit: 'spades', rank: 'A' }}>
        <Pattern {...args} tone="card" size="sm" />
      </GameCard>} />)}</div>,
  play: async ({ canvas }) => {
    await expect(canvas.getAllByRole('img', { name: 'Patterned card back' })).toHaveLength(3);
    await expect(canvas.queryByRole('img', { name: 'Ace of spades' })).toBeNull();
  },
};

export const HydrationRoots: Story = {
  render: (args) => <Pattern {...args} css={sampleStyle} />,
  play: async ({ canvasElement }) => {
    const errors = fn();
    const roots: ReturnType<typeof hydrateRoot>[] = [];
    const hosts: HTMLElement[] = [];
    try {
      for (const identifierPrefix of ['pattern-first-', 'pattern-second-']) {
        const host = canvasElement.ownerDocument.createElement('div');
        const element = <Pattern ref={fn()} css={sampleStyle} />;
        host.innerHTML = renderToString(element, { identifierPrefix });
        canvasElement.append(host);
        hosts.push(host);
        const before = host.querySelector('pattern')?.id;
        const attached = fn();
        roots.push(hydrateRoot(host, <Pattern ref={attached} css={sampleStyle} />, { identifierPrefix, onRecoverableError: errors }));
        await waitFor(() => expect(attached).toHaveBeenCalled());
        await expect(host.querySelector('pattern')?.id).toBe(before);
      }
      const ids = Array.from(canvasElement.querySelectorAll('pattern'), (tile) => tile.id);
      await expect(new Set(ids).size).toBe(3);
      await expect(errors).not.toHaveBeenCalled();
    } finally {
      for (const root of roots) root.unmount();
      for (const host of hosts) host.remove();
    }
  },
};
