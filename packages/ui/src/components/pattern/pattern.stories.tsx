import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, waitFor } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { base } from '@jfrader/tokens';
import { css } from '../../styling/css';
import { withLightTheme } from '../../testing/story-decorators';
import { FlipGameCard } from '../flip-game-card';
import { GameCard } from '../game-card';
import { Pattern, type PatternVariant, type PatternSize } from './index';

const variants: PatternVariant[] = ['stripes', 'diagonal', 'checks', 'dots', 'waves', 'chevron'];
const sizes: PatternSize[] = ['sm', 'md', 'lg'];
const tileSides: Record<PatternSize, number> = {
  sm: Number.parseFloat(base.space[2]),
  md: Number.parseFloat(base.space[4]),
  lg: Number.parseFloat(base.space[6]),
};
const sampleStyle = css({ inlineSize: vars.size.gameCardLg, blockSize: vars.size.gameCardLg });
const smallSampleStyle = css({ inlineSize: vars.size.gameCardSm, blockSize: vars.size.gameCardSm });
const galleryStyle = css({ display: 'grid', gap: vars.space[6], gridTemplateColumns: 'repeat(2, max-content)' });
const rowStyle = css({ display: 'flex', alignItems: 'center', gap: vars.space[3] });
const labelStyle = css({ marginBlock: vars.space[2], color: vars.color.text, fontSize: vars.textSize.sm });

const meta = {
  title: 'Media/Pattern',
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
      source: { language: 'tsx', code: `import { Pattern } from '@jfrader/ui/pattern';
import { GameCard } from '@jfrader/ui/game-card';
import { vars } from '@jfrader/tokens/vars';

export function PatternExamples() {
  return (
    <>
      <Pattern variant="diagonal" tone="accent" sx={{ inlineSize: vars.size.gameCardLg, blockSize: vars.size.gameCardLg }} />
      <GameCard label="Card back">
        <Pattern variant="diagonal" tone="card" size="sm" />
      </GameCard>
    </>
  );
}` },
      usage: `## Tiles and inks
- Give the SVG a width and height through its parent or \`sx\`. It fills its parent by default.
- \`size\` sets the tile side to 8, 16 or 24 CSS pixels. \`scale\` multiplies that side; nonpositive or nonfinite values fall back to 1.
- For general surfaces, use \`neutral\` (surfaceRaised/borderStrong), \`accent\` (accentSoft/accent), or style the root with \`sx\`. Reserve \`card\` (cardRed/cardFace) for card backs.
- Use \`@jfrader/ui/pattern\` or the main package export. The React 19 \`ref\` reaches the SVG; \`sx\` styles that root.

## Accessibility and environments
- Patterns are always decorative (\`aria-hidden="true"\`, not focusable). Give the enclosing card or surface its own name when needed. There is no APG widget, state or keyboard command.
- Inherited direction and a root \`dir\` prop mirror diagonal and chevron patterns in RTL; other variants keep their orientation.
- Forced colors suppresses the pattern with a transparent fill; the enclosing surface and its border remain visible. Do not use patterns to convey information.
- Patterns have no motion. IDs come from React \`useId\`; give separate SSR roots distinct \`identifierPrefix\` values and reuse them during hydration.

## Card artwork
- Pass a Pattern as \`GameCard children\`, then pass that named card as \`FlipGameCard back\`. Artwork replaces either face without requiring a \`value\`. Never put secret card data in a flipped wrapper, whose two faces stay mounted.`,
    },
  },
} satisfies Meta<typeof Pattern>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Diagonal: Story = {
  name: 'Diagonal',
  parameters: { docs: { source: { language: 'tsx', code: `import { Pattern } from '@jfrader/ui/pattern';
import { vars } from '@jfrader/tokens/vars';

<Pattern variant="diagonal" size="md" tone="accent"
  sx={{ inlineSize: vars.size.gameCardLg, blockSize: vars.size.gameCardLg }} />` } } },
  render: (args) => <Pattern {...args} css={sampleStyle} />,
  play: async ({ canvasElement }) => {
    const root = canvasElement.querySelector('[data-ui="pattern"]');
    await expect(root).toHaveAttribute('aria-hidden', 'true');
    await expect(root).toHaveAttribute('focusable', 'false');
    await expect(root).not.toHaveAttribute('tabindex');
  },
};

export const Default: Story = {
  name: 'Default',
  parameters: { docs: { source: { language: 'tsx', code: `import { Pattern, type PatternVariant } from '@jfrader/ui/pattern';
import { vars } from '@jfrader/tokens/vars';

const variants: PatternVariant[] = ['stripes', 'diagonal', 'checks', 'dots', 'waves', 'chevron'];
const sample = { inlineSize: vars.size.gameCardLg, blockSize: vars.size.gameCardLg };

export function PatternGallery() {
  return <div style={{ display: 'grid', gap: vars.space[6], gridTemplateColumns: 'repeat(2, max-content)' }}>
    {variants.map((variant) => <section key={variant}>
      <h2 style={{ marginBlock: vars.space[2], color: vars.color.text, fontSize: vars.textSize.sm }}>{variant}</h2>
      <div style={{ display: 'flex', alignItems: 'center', gap: vars.space[3] }}>
        <Pattern variant={variant} size="sm" tone="accent" sx={{ inlineSize: vars.size.gameCardSm, blockSize: vars.size.gameCardSm }} />
        <Pattern variant={variant} size="sm" tone="accent" sx={sample} />
        <Pattern variant={variant} size="lg" tone="accent" sx={sample} />
      </div>
    </section>)}
  </div>;
}` } } },
  render: (args) => <div css={galleryStyle}>
    {variants.map((variant) => <section key={variant}>
      <h2 css={labelStyle}>{variant}</h2>
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
    for (const root of roots) {
      const tile = root.querySelector('pattern');
      const size = sizes.find((size) => size === root.getAttribute('data-size'));
      if (!size) throw new Error('Missing pattern size');
      await expect(tile).toHaveAttribute('width', String(tileSides[size]));
      await expect(tile).toHaveAttribute('height', String(tileSides[size]));
      await expect(root.querySelector(':scope > rect')).toHaveAttribute('fill', `url(#${tile?.id})`);
      await expect(root).toHaveAttribute('aria-hidden', 'true');
    }
  },
};

export const GalleryLight: Story = { ...Default, name: 'Gallery light theme', decorators: [withLightTheme] };

export const Tones: Story = {
  parameters: { docs: { source: { language: 'tsx', code: `import { Pattern } from '@jfrader/ui/pattern';
import { vars } from '@jfrader/tokens/vars';

<div style={{ display: 'flex', alignItems: 'center', gap: vars.space[3] }}>
  {(['neutral', 'accent', 'card'] as const).map((tone) =>
    <Pattern key={tone} variant="diagonal" size="md" tone={tone}
      sx={{ inlineSize: vars.size.gameCardLg, blockSize: vars.size.gameCardLg }} />)}
</div>` } } },
  render: (args) => <div css={rowStyle}>{(['neutral', 'accent', 'card'] as const).map((tone) =>
    <Pattern {...args} key={tone} tone={tone} css={sampleStyle} />)}</div>,
};
export const TonesLight: Story = { ...Tones, decorators: [withLightTheme] };

export const TileScale: Story = {
  parameters: { docs: { source: { language: 'tsx', code: `import { Pattern } from '@jfrader/ui/pattern';
import { vars } from '@jfrader/tokens/vars';

<div style={{ display: 'flex', alignItems: 'center', gap: vars.space[3] }}>
  {[0.5, 1, 2, 0, -1, Infinity].map((scale) =>
    <Pattern key={scale} variant="diagonal" size="md" tone="accent" scale={scale}
      sx={{ inlineSize: vars.size.gameCardLg, blockSize: vars.size.gameCardLg }} />)}
</div>` } } },
  render: (args) => <div css={rowStyle}>{[0.5, 1, 2, 0, -1, Infinity].map((scale) =>
    <Pattern {...args} key={scale} scale={scale} css={sampleStyle} />)}</div>,
  play: async ({ canvasElement }) => {
    for (const root of canvasElement.querySelectorAll('[data-ui="pattern"]')) {
      const scale = Number(root.getAttribute('data-scale'));
      const size = sizes.find((size) => size === root.getAttribute('data-size'));
      if (!size) throw new Error('Missing pattern size');
      const side = tileSides[size] * (Number.isFinite(scale) && scale > 0 ? scale : 1);
      await expect(root.querySelector('pattern')).toHaveAttribute('width', String(side));
      await expect(root.querySelector('pattern')).toHaveAttribute('height', String(side));
    }
  },
};

export const Direction: Story = {
  parameters: { docs: { source: { language: 'tsx', code: `import { Pattern, type PatternVariant } from '@jfrader/ui/pattern';
import { vars } from '@jfrader/tokens/vars';

const variants: PatternVariant[] = ['stripes', 'diagonal', 'checks', 'dots', 'waves', 'chevron'];
const sample = { inlineSize: vars.size.gameCardLg, blockSize: vars.size.gameCardLg };

<div style={{ display: 'grid', gap: vars.space[6], gridTemplateColumns: 'repeat(2, max-content)' }}>
  {variants.map((variant) => <div key={variant} style={{ display: 'flex', alignItems: 'center', gap: vars.space[3] }}>
    <div dir="rtl"><Pattern variant={variant} tone="accent" dir="ltr" sx={sample} /></div>
    <div dir="rtl"><Pattern variant={variant} tone="accent" sx={sample} /></div>
    <Pattern variant={variant} tone="accent" dir="rtl" sx={sample} />
  </div>)}
</div>` } } },
  render: (args) => <div css={galleryStyle}>{variants.map((variant) => <div css={rowStyle} key={variant}>
    <div dir="rtl"><Pattern {...args} variant={variant} dir="ltr" css={sampleStyle} /></div>
    <div dir="rtl"><Pattern {...args} variant={variant} css={sampleStyle} /></div>
    <Pattern {...args} variant={variant} dir="rtl" css={sampleStyle} />
  </div>)}</div>,
  play: async ({ canvasElement }) => {
    for (const root of canvasElement.querySelectorAll('[data-ui="pattern"]')) {
      const direction = root.getAttribute('dir') ?? root.parentElement?.closest('[dir]')?.getAttribute('dir');
      const mirrored = direction === 'rtl' && ['diagonal', 'chevron'].includes(root.getAttribute('data-variant') ?? '');
      await expect(getComputedStyle(root).transform).toBe(mirrored ? 'matrix(-1, 0, 0, 1, 0, 0)' : 'none');
    }
  },
};

export const FlippedCard: Story = {
  parameters: { docs: { source: { language: 'tsx', code: `import { Pattern } from '@jfrader/ui/pattern';
import { GameCard } from '@jfrader/ui/game-card';
import { FlipGameCard } from '@jfrader/ui/flip-game-card';
import { vars } from '@jfrader/tokens/vars';

<div style={{ display: 'flex', alignItems: 'center', gap: vars.space[3] }}>
  {(['sm', 'md', 'lg'] as const).map((size) =>
    <FlipGameCard key={size} size={size} flipped
      front={<GameCard label="Ace of spades" value={{ deck: 'french', suit: 'spades', rank: 'A' }} />}
      back={<GameCard label="Patterned card back"><Pattern variant="diagonal" tone="card" size="sm" /></GameCard>} />)}
</div>` } } },
  render: (args) => <div css={rowStyle}>{(['sm', 'md', 'lg'] as const).map((size) =>
    <FlipGameCard key={size} size={size} flipped
      front={<GameCard label="Ace of spades" value={{ deck: 'french', suit: 'spades', rank: 'A' }} />}
      back={<GameCard label="Patterned card back">
        <Pattern {...args} tone="card" size="sm" />
      </GameCard>} />)}</div>,
  play: async ({ canvas }) => {
    await expect(canvas.getAllByRole('img', { name: 'Patterned card back' })).toHaveLength(3);
    await expect(canvas.queryByRole('img', { name: 'Ace of spades' })).toBeNull();
  },
};

export const ForcedColors: Story = {
  ...FlippedCard,
  tags: ['!autodocs'],
  parameters: { docs: { description: { story: 'Forced colors hides the decorative ink; the card supplies its surface and border.' } } },
  play: async ({ canvasElement }) => {
    const media = Array.from(canvasElement.ownerDocument.styleSheets)
      .flatMap((sheet) => Array.from(sheet.cssRules))
      .filter((rule): rule is CSSMediaRule => rule instanceof CSSMediaRule && rule.conditionText.includes('forced-colors: active'));
    await expect(media.length).toBeGreaterThan(0);
    const conditions = new Map(media.map((rule) => [rule, rule.media.mediaText]));
    const patterns = canvasElement.querySelectorAll('[data-ui="pattern"]');
    const cards = canvasElement.querySelectorAll('[data-ui="flip-game-card-back"] [data-ui="game-card"]');
    await expect(patterns).toHaveLength(3);
    await expect(cards).toHaveLength(3);
    try {
      for (const rule of media) rule.media.mediaText = 'all';
      for (const root of patterns) {
        const painted = root.querySelector(':scope > rect');
        if (!painted) throw new Error('Missing painted rect');
        await expect(getComputedStyle(painted).fill).toBe('rgba(0, 0, 0, 0)');
      }
      for (const card of cards) {
        await expect(getComputedStyle(card).borderTopStyle).toBe('solid');
        await expect(getComputedStyle(card).borderTopWidth).toBe('1px');
        await expect(getComputedStyle(card).backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
      }
    } finally {
      for (const [rule, condition] of conditions) rule.media.mediaText = condition;
    }
  },
};

const seamContracts = {
  diagonal: { verticalInk: [0, 4], horizontalInk: [12, 16], inkProbe: 2, paperProbe: 6 },
  waves: { verticalInk: [7, 9], horizontalInk: null, inkProbe: 8, paperProbe: 2 },
  chevron: { verticalInk: [10, 14], horizontalInk: null, inkProbe: 12, paperProbe: 4 },
} as const;
const seamVariants = ['diagonal', 'waves', 'chevron'] as const satisfies readonly PatternVariant[];
const repeatSide = 192;
const rasterZoom = 4;
const repeatedStyle = css({ inlineSize: repeatSide, blockSize: repeatSide });

async function rasterize(root: SVGSVGElement) {
  const clone = root.cloneNode(true) as SVGSVGElement;
  const originalParts = [root, ...root.querySelectorAll('*')];
  const clonedParts = [clone, ...clone.querySelectorAll('*')];
  originalParts.forEach((part, index) => {
    const target = clonedParts[index];
    if (!target) throw new Error('Missing cloned SVG part');
    target.removeAttribute('class');
    target.removeAttribute('style');
    for (const property of ['fill', 'stroke', 'color']) {
      const value = getComputedStyle(part).getPropertyValue(property);
      if (!value.includes('url(')) target.setAttribute(property, value);
    }
  });
  clone.setAttribute('width', String(repeatSide * rasterZoom));
  clone.setAttribute('height', String(repeatSide * rasterZoom));
  const tile = clone.querySelector('pattern');
  if (!tile) throw new Error('Missing tile');
  tile.setAttribute('width', String(Number(tile.getAttribute('width')) * rasterZoom));
  tile.setAttribute('height', String(Number(tile.getAttribute('height')) * rasterZoom));
  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml' }));
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = root.ownerDocument.createElement('canvas');
    canvas.width = canvas.height = repeatSide * rasterZoom;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Missing raster context');
    context.drawImage(image, 0, 0);
    return context;
  } finally { URL.revokeObjectURL(url); }
}

export const SeamContinuity: Story = {
  tags: ['!autodocs'],
  render: (args) => <div style={{ display: 'grid', gap: vars.space[6] }}>
    {seamVariants.map((variant) => <section key={variant}>
      <h2 css={labelStyle}>{variant} — 8 / 16 / 24 px</h2>
      <div css={rowStyle}>{sizes.map((size) =>
        <Pattern {...args} key={size} variant={variant} size={size}
          scale={1} tone="card" css={repeatedStyle} />)}</div>
    </section>)}
  </div>,
  parameters: { docs: { description: { story: 'Repeated surfaces at all three tile sizes.' } } },
  play: async ({ canvasElement }) => {
    for (const root of canvasElement.querySelectorAll<SVGSVGElement>('[data-ui="pattern"]')) {
      const variant = seamVariants.find((variant) => variant === root.getAttribute('data-variant'));
      const path = root.querySelector<SVGPathElement>('pattern path');
      const size = sizes.find((size) => size === root.getAttribute('data-size'));
      if (!variant || !path || !size) throw new Error('Missing seam fixture');
      const contract = seamContracts[variant];
      const bounds = path.getBBox();
      await expect(bounds.x).toBeGreaterThanOrEqual(0);
      await expect(bounds.y).toBeGreaterThanOrEqual(0);
      await expect(bounds.x + bounds.width).toBeLessThanOrEqual(16);
      await expect(bounds.y + bounds.height).toBeLessThanOrEqual(16);
      const failures: string[] = [];
      for (let sample = 0.125; sample < 16; sample += 0.25) {
        const verticalInk = sample > contract.verticalInk[0] && sample < contract.verticalInk[1];
        const horizontalInk = contract.horizontalInk !== null && sample > contract.horizontalInk[0] && sample < contract.horizontalInk[1];
        for (const [x, y, expected] of [[0, sample, verticalInk], [16, sample, verticalInk],
          [sample, 0, horizontalInk], [sample, 16, horizontalInk]] as const) {
          if (path.isPointInFill(new DOMPoint(x, y)) !== expected) failures.push(`geometry ${variant}: ${x},${y}`);
        }
      }
      const context = await rasterize(root);
      const tileSide = tileSides[size];
      for (let seam = tileSide; seam < repeatSide; seam += tileSide) {
        for (let row = 0; row < repeatSide / tileSide; row++) {
          for (const [offset, expectedInk] of [[contract.inkProbe, true], [contract.paperProbe, false]] as const) {
            const y = Math.floor((row * tileSide + offset / 16 * tileSide) * rasterZoom);
            for (const x of [seam * rasterZoom - 1, seam * rasterZoom]) {
              const [red, green, blue, alpha] = context.getImageData(x, y, 1, 1).data;
              if (red === undefined || green === undefined || blue === undefined || alpha === undefined) throw new Error('Missing raster pixel');
              const isInk = green > red / 2 && blue > red / 2;
              if (alpha !== 255 || isInk !== expectedInk) failures.push(`pixel ${variant}/${size}: ${x},${y} (${red},${green},${blue},${alpha})`);
            }
          }
        }
      }
      await expect(failures).toEqual([]);
    }
  },
};

export const HydrationRoots: Story = {
  tags: ['!autodocs'],
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
