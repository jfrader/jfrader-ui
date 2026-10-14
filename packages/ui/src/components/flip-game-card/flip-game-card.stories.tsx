import { StrictMode, useCallback, useRef, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, spyOn, within } from 'storybook/test';
import { renderToString } from 'react-dom/server';
import { vars } from '@jfrader/tokens/vars';
import { base } from '@jfrader/tokens';
import { css } from '../../styling/css';
import { motionDurationMs } from '../../styling/motion-timings';
import { withLightTheme } from '../../testing/story-decorators';
import { Button } from '../button';
import { CARD_BACK_PATTERNS, GameCard } from '../game-card';
import { CARD_FRAME } from '../game-card/card-frame';
import { DeckProvider, defineDeck } from '../deck';
import { WithSx } from '../../styling/sx';
import type { GameCardRootProps } from '../game-card';
import { FlipGameCard, MissingBackLabelError, type FlipGameCardProps } from './index';

const FRONT_LABEL = 'Ace of spades';
const BACK_LABEL = 'Card back';
const front = <GameCard label={FRONT_LABEL} value={{ deck: 'french', suit: 'spades', rank: 'A' }} />;
const back = <GameCard label={BACK_LABEL} />;
const faceActionStyle = css({
  position: 'absolute',
  insetBlockEnd: vars.space[2],
  insetInline: vars.space[1],
});

const preference = {
  matches: false,
  media: null as MediaQueryList | null,
};

function mockPreference(reduced?: boolean) {
  const matchMedia = window.matchMedia.bind(window);
  preference.matches = reduced ?? matchMedia('(prefers-reduced-motion)').matches;
  if (!preference.media) {
    preference.media = matchMedia('(prefers-reduced-motion)');
    Object.defineProperty(preference.media, 'matches', { get: () => preference.matches });
  }
  preference.media.dispatchEvent(new MediaQueryListEvent('change', { matches: preference.matches }));
  const spy = spyOn(window, 'matchMedia').mockImplementation((query) => {
    if (query !== '(prefers-reduced-motion)' && query !== '(prefers-reduced-motion: reduce)') return matchMedia(query);
    if (!preference.media) throw new Error('Missing reduced-motion preference');
    return preference.media;
  });
  return () => spy.mockRestore();
}

const meta = {
  title: 'Games/FlipGameCard',
  component: FlipGameCard,
  tags: ['autodocs'],
  args: { value: { deck: 'french', suit: 'spades', rank: 'A' }, label: FRONT_LABEL, backLabel: BACK_LABEL },
  argTypes: {
    size: { control: 'radio', options: ['sm', 'md', 'lg'] },
    front: { control: false },
    back: { control: false },
  },
  parameters: {
    docs: {
      description: { component: 'Turn a playing card over to show its other face.' },
      source: {
        language: 'tsx',
        code: `import { FlipGameCard } from '@jfrader/ui/flip-game-card';

<FlipGameCard
  value={{ deck: 'french', suit: 'spades', rank: 'A' }}
  label="Ace of spades"
  backLabel="Card back"
/>`,
      },
      usage: `## Setup
- Import from \`@jfrader/ui/flip-game-card\`. FlipGameCard is an opt-in subpath and is not re-exported by the package root.

## Faces and state
- Pass \`value\`, \`label\` and \`backLabel\` to render both faces from one deck. Set \`DeckProvider backLabel\` to name backs once in your language.
- For custom content, pass two named faces with \`front\` and \`back\` instead of the shorthand; there is no \`children\` alias.
- Set \`flipped\` to show the back (default \`false\`). Clicking the card does not change it. Shorthand without a nonempty back name throws \`MissingBackLabelError\`, even when initially face up.
- Both faces stay mounted. Hidden content remains in the DOM: do not pass secret card values.
- Place a \`GameCard\` directly in each face; the wrapper sizes both to its \`size\` (default \`md\`). Custom content must fit the frame.

## Keyboard
- This wrapper has no APG widget role or keyboard commands. Give each face its own accessible name.
- The inactive face is inert and hidden from assistive technology immediately, even during a flip.
- Keep the flip control outside the faces so it retains focus when the accepted state changes.

## Motion and layout
- The outer root (and its React 19 \`ref\`) stays still; only the inner rotator moves. Use root \`sx\` for placement and \`slotProps\` for part styles.
- Replace the root with \`component\` or \`slots.root\`. Declare replacements outside render, forward all props and ref to one div, and apply your material before the supplied \`className\`. \`slotProps.root\` overrides root props; className and style merge.
- Perspective uses \`size.gameCardPerspective\` (28rem). The flip uses \`motion.duration.cardFlip\` (300ms) and \`motion.easeCardFlip\` (ease).
- Reduced motion switches faces immediately without rotation. No render-time measurements are needed.`,
    },
  },
} satisfies Meta<typeof FlipGameCard>;

export default meta;
type Story = StoryObj<typeof meta>;

async function expectRealPerspective(root: HTMLElement) {
  const perspective = getComputedStyle(root).perspective;
  const rootFontSize = Number.parseFloat(getComputedStyle(root.ownerDocument.documentElement).fontSize);
  const expectedPixels = Number.parseFloat(base.size.gameCardPerspective) * rootFontSize;
  await expect(perspective).not.toBe('none');
  await expect(perspective).toMatch(/^\d+(?:\.\d+)?px$/);
  await expect(Number.parseFloat(perspective)).toBeGreaterThan(0);
  await expect(Number.parseFloat(perspective)).toBeCloseTo(expectedPixels, 2);
}

export const FaceUp: Story = {
  name: 'Face up',
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { FlipGameCard } from '@jfrader/ui/flip-game-card';

<FlipGameCard
  flipped={false}
  value={{ deck: 'french', suit: 'spades', rank: 'A' }}
  label="Ace of spades"
  backLabel="Card back"
/>`,
      },
    },
  },
  play: async ({ canvas, canvasElement }) => {
    const root = canvasElement.querySelector<HTMLElement>('[data-ui="flip-game-card"]');
    if (!root) throw new Error('Missing flip root');
    await expectRealPerspective(root);
    await expect(canvas.getByRole('img', { name: FRONT_LABEL })).toBeVisible();
    await expect(canvas.queryByRole('img', { name: BACK_LABEL })).toBeNull();
  },
};

export const FaceDown: Story = {
  name: 'Face down',
  args: { flipped: true },
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { FlipGameCard } from '@jfrader/ui/flip-game-card';

<FlipGameCard
  flipped={true}
  value={{ deck: 'french', suit: 'spades', rank: 'A' }}
  label="Ace of spades"
  backLabel="Card back"
/>`,
      },
    },
  },
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.getByRole('img', { name: BACK_LABEL })).toBeVisible();
    await expect(canvas.queryByRole('img', { name: FRONT_LABEL })).toBeNull();
    await expect(canvasElement.querySelector('[data-ui="flip-game-card-front"]')).toHaveAttribute('inert');
  },
};

export const LightTheme: Story = {
  parameters: { docs: { source: { language: 'tsx', code: `import { FlipGameCard } from '@jfrader/ui/flip-game-card';
import { ThemeRoot } from '@jfrader/ui/theme-root';

<ThemeRoot theme="light">
  <FlipGameCard value={{ deck: 'french', suit: 'spades', rank: 'A' }} label="Ace of spades" backLabel="Card back" />
</ThemeRoot>` } } },
  decorators: [withLightTheme],
};

const patternFaces: Story['render'] = (args) => (
  <div style={{ display: 'flex', gap: vars.space[4] }}>
    {Object.entries(CARD_BACK_PATTERNS).map(([deck, pattern]) => (
      <FlipGameCard flipped={args.flipped} size={args.size} key={deck} data-test-pattern={pattern}
        value={deck === 'spanish' ? { deck: 'spanish', suit: 'oros', rank: 1 } : { deck: 'french', suit: 'spades', rank: 'A' }}
        label={`${deck} face`} backLabel={`${deck} back`} />
    ))}
  </div>
);

/** French and Spanish cards face up. */
export const PatternFronts: Story = {
  render: patternFaces,
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { FlipGameCard } from '@jfrader/ui/flip-game-card';
import { CARD_BACK_PATTERNS } from '@jfrader/ui/game-card';

export function PatternFronts() {
  return (
    <>
      <FlipGameCard
        flipped={false}
        value={{ deck: 'spanish', suit: 'oros', rank: 1 }}
        label="Spanish face"
        backLabel="Spanish back"
      />
      <FlipGameCard
        flipped={false}
        value={{ deck: 'french', suit: 'spades', rank: 'A' }}
        label="French face"
        backLabel="French back"
      />
    </>
  );
}`,
      },
    },
  },
};
/** Spanish diagonal backs and poker checks. */
export const PatternBacks: Story = {
  name: 'Deck backs',
  render: patternFaces,
  args: { flipped: true },
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { FlipGameCard } from '@jfrader/ui/flip-game-card';

export function PatternBacks() {
  return (
    <>
      <FlipGameCard
        flipped={true}
        value={{ deck: 'spanish', suit: 'oros', rank: 1 }}
        label="Spanish face"
        backLabel="Spanish back"
      />
      <FlipGameCard
        flipped={true}
        value={{ deck: 'french', suit: 'spades', rank: 'A' }}
        label="French face"
        backLabel="French back"
      />
    </>
  );
}`,
      },
    },
  },
};
export const PatternFrontsLightTheme: Story = {
  ...PatternFronts,
  parameters: { docs: { source: { language: 'tsx', code: `import { FlipGameCard } from '@jfrader/ui/flip-game-card';
import { ThemeRoot } from '@jfrader/ui/theme-root';
import { vars } from '@jfrader/tokens/vars';

<ThemeRoot theme="light"><div style={{ display: 'flex', gap: vars.space[4] }}>
  <FlipGameCard value={{ deck: 'spanish', suit: 'oros', rank: 1 }} label="spanish face" backLabel="spanish back" />
  <FlipGameCard value={{ deck: 'french', suit: 'spades', rank: 'A' }} label="french face" backLabel="french back" />
</div></ThemeRoot>` } } },
  decorators: [withLightTheme],
};
export const PatternBacksLightTheme: Story = {
  ...PatternBacks,
  name: 'Deck backs light theme',
  parameters: { docs: { source: { language: 'tsx', code: `import { FlipGameCard } from '@jfrader/ui/flip-game-card';
import { ThemeRoot } from '@jfrader/ui/theme-root';
import { vars } from '@jfrader/tokens/vars';

<ThemeRoot theme="light"><div style={{ display: 'flex', gap: vars.space[4] }}>
  <FlipGameCard flipped value={{ deck: 'spanish', suit: 'oros', rank: 1 }} label="spanish face" backLabel="spanish back" />
  <FlipGameCard flipped value={{ deck: 'french', suit: 'spades', rank: 'A' }} label="french face" backLabel="french back" />
</div></ThemeRoot>` } } },
  decorators: [withLightTheme],
};

export const Sizes: Story = {
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { FlipGameCard } from '@jfrader/ui/flip-game-card';

export function FlipCardSizes() {
  return (
    <>
      <FlipGameCard size="sm" value={{ deck: 'french', suit: 'spades', rank: 'A' }} label="Small card" backLabel="Back" />
      <FlipGameCard size="md" value={{ deck: 'french', suit: 'spades', rank: 'A' }} label="Medium card" backLabel="Back" />
      <FlipGameCard size="lg" value={{ deck: 'french', suit: 'spades', rank: 'A' }} label="Large card" backLabel="Back" />
    </>
  );
}`,
      },
    },
  },
  render: (args) => (
    <div style={{ display: 'flex', gap: vars.space[4] }}>
      {(['sm', 'md', 'lg'] as const).map((size) => (
        <FlipGameCard {...args} key={size} size={size} />
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    const widths = {
      sm: Number.parseFloat(base.size.gameCardSm),
      md: Number.parseFloat(base.size.gameCardMd),
      lg: Number.parseFloat(base.size.gameCardLg),
    };
    for (const size of ['sm', 'md', 'lg'] as const) {
      const root = canvasElement.querySelector<HTMLElement>(`[data-ui="flip-game-card"][data-size="${size}"]`);
      if (!root) throw new Error('Missing card wrapper');
      await expect(root.getBoundingClientRect().width).toBe(widths[size]);
      for (const card of root.querySelectorAll('[data-ui="game-card"]')) {
        await expect(card.getBoundingClientRect().width).toBe(widths[size]);
        await expect(card.getBoundingClientRect().height).toBeCloseTo(widths[size] * CARD_FRAME.ratio, 1);
        await expect(Number.parseFloat(getComputedStyle(card).borderRadius)).toBeCloseTo(widths[size] / CARD_FRAME.cornerDivisor, 2);
        await expect(getComputedStyle(card).getPropertyValue('--game-card-width')).toBe(getComputedStyle(root).getPropertyValue('--game-card-width'));
      }
    }
  },
};

function ControlledFixture(args: Pick<FlipGameCardProps, 'flipped'>) {
  const [flipped, setFlipped] = useState(args.flipped);
  return (
    <div style={{ display: 'grid', gap: vars.space[4], justifyItems: 'start' }}>
      <Button onClick={() => setFlipped(!flipped)}>Flip card</Button>
      <FlipGameCard
        flipped={flipped}
        size="lg"
        front={<>{front}<Button size="sm" css={faceActionStyle}>Front action</Button></>}
        back={<>{back}<Button size="sm" css={faceActionStyle}>Back action</Button></>}
      />
      <Button>Continue</Button>
    </div>
  );
}

const flipToFinalState: NonNullable<Story['play']> = async ({ args, canvas, canvasElement, userEvent }) => {
  const root = canvasElement.querySelector('[data-ui="flip-game-card"]');
  const rotator = canvasElement.querySelector<HTMLElement>('[data-ui="flip-game-card-rotator"]');
  if (!root || !rotator) throw new Error('Missing flip anatomy');
  await userEvent.click(canvas.getByRole('button', { name: 'Flip card' }));
  await new Promise((resolve) => setTimeout(resolve, motionDurationMs.slow));
  await Promise.all(rotator.getAnimations().map((animation) => animation.finished));
  await expect(root).toHaveAttribute('data-state', args.flipped ? 'front' : 'back');
  await expect(canvas.getByRole('img', { name: args.flipped ? FRONT_LABEL : BACK_LABEL })).toBeVisible();
};

export const BackFinalState: Story = {
  tags: ['!autodocs'],
  render: (args) => <ControlledFixture {...args} />,
  play: flipToFinalState,
};

export const FrontFinalState: Story = {
  tags: ['!autodocs'],
  args: { flipped: true },
  render: (args) => <ControlledFixture {...args} />,
  play: flipToFinalState,
};

export const BackFinalStateLightTheme: Story = {
  ...BackFinalState,
  tags: ['!autodocs'],
  decorators: [withLightTheme],
};

export const ContentKeyboard: Story = {
  tags: ['!autodocs'],
  render: (args) => <ControlledFixture {...args} />,
  parameters: { docs: { source: { code: `<>
<FlipGameCard value={{ deck: 'french', suit: 'spades', rank: 'A' }}
  label="Ace of spades" backLabel="Card back" flipped={flipped} />

<Button onClick={() => setFlipped(!flipped)}>Flip card</Button>
<FlipGameCard flipped={flipped}
  front={<GameCard label="Ace of spades" value={{ deck: 'french', suit: 'spades', rank: 'A' }} />}
  back={<GameCard label="Card back" />} />
</>` } } },
  play: async ({ canvas, canvasElement, userEvent }) => {
    const trigger = canvas.getByRole('button', { name: 'Flip card' });
    const root = canvasElement.querySelector('[data-ui="flip-game-card"]');
    const frontFace = canvasElement.querySelector<HTMLElement>('[data-ui="flip-game-card-front"]');
    const backFace = canvasElement.querySelector<HTMLElement>('[data-ui="flip-game-card-back"]');
    if (!frontFace || !backFace || !root) throw new Error('Missing flip anatomy');
    const frontAction = within(frontFace).getByRole('button', { hidden: true });
    const backAction = within(backFace).getByRole('button', { hidden: true });
    await userEvent.tab();
    await expect(trigger.ownerDocument.activeElement).toBe(trigger);
    await expect(getComputedStyle(trigger).outlineStyle).not.toBe('none');
    await userEvent.tab();
    await expect(frontAction.ownerDocument.activeElement).toBe(frontAction);
    canvas.getByRole('button', { name: 'Continue' }).focus();
    backAction.focus();
    await expect(backAction).not.toHaveFocus();
    trigger.focus();
    await userEvent.keyboard('{Enter}');
    await expect(trigger).toHaveFocus();
    await expect(root).toHaveAttribute('data-state', 'back');
    await expect(frontFace).toHaveAttribute('inert');
    await expect(frontFace).toHaveAttribute('aria-hidden', 'true');
    await expect(canvas.queryByRole('img', { name: FRONT_LABEL })).toBeNull();
    await expect(canvas.queryByRole('button', { name: 'Front action' })).toBeNull();
    await expect(canvas.getByRole('img', { name: BACK_LABEL })).toBeInTheDocument();
    backAction.focus();
    await expect(backAction).toHaveFocus();
    frontAction.focus();
    await expect(frontAction).not.toHaveFocus();
    trigger.focus();
    await userEvent.keyboard(' ');
    await expect(trigger).toHaveFocus();
    await expect(root).toHaveAttribute('data-state', 'front');
    await expect(backFace).toHaveAttribute('inert');
    await expect(canvas.queryByRole('img', { name: BACK_LABEL })).toBeNull();
    await expect(within(frontFace).getByRole('button')).toBe(frontAction);
  },
};

function ControlledShorthand(args: FlipGameCardProps) {
  const [flipped, setFlipped] = useState(args.flipped ?? false);
  return <div style={{ display: 'grid', gap: vars.space[4], justifyItems: 'start' }}>
    <Button onClick={() => setFlipped(!flipped)}>Flip card</Button>
    <FlipGameCard {...args} flipped={flipped} />
  </div>;
}

export const Default: Story = {
  name: 'Default',
  render: (args) => <ControlledShorthand {...args} />,
  parameters: { docs: { source: { code: `import { useState } from 'react';
import { Button } from '@jfrader/ui';
import { FlipGameCard } from '@jfrader/ui/flip-game-card';

export function FlippableCard() {
  const [flipped, setFlipped] = useState(false);
  return (
    <>
      <Button onClick={() => setFlipped(!flipped)}>Flip card</Button>
      <FlipGameCard value={{ deck: 'french', suit: 'spades', rank: 'A' }}
        label="Ace of spades" backLabel="Card back" flipped={flipped} />
    </>
  );
}` } } },
  play: async ({ canvas, canvasElement, userEvent }) => {
    const trigger = canvas.getByRole('button', { name: 'Flip card' });
    const printed = canvasElement.querySelector('[data-ui="flip-game-card-front"] [data-ui="game-card"]');
    const back = canvasElement.querySelector('[data-ui="flip-game-card-back"] [data-ui="game-card"]');
    await userEvent.tab();
    await expect(trigger).toHaveFocus();
    await expect(getComputedStyle(trigger).outlineStyle).not.toBe('none');
    await userEvent.keyboard('{Enter}');
    await expect(canvas.getByRole('img', { name: BACK_LABEL })).toBe(back);
    await expect(canvas.queryByRole('img', { name: FRONT_LABEL })).toBeNull();
    await expect(printed?.parentElement).toHaveAttribute('inert');
    await expect(printed?.parentElement).toHaveAttribute('aria-hidden', 'true');
    await userEvent.keyboard(' ');
    await expect(canvas.getByRole('img', { name: FRONT_LABEL })).toBe(printed);
    await expect(back?.parentElement).toHaveAttribute('inert');
    await expect(back?.parentElement).toHaveAttribute('aria-hidden', 'true');
    await expect(trigger).toHaveFocus();
  },
};

export const ControlledWithoutAcceptance: Story = {
  tags: ['!autodocs'],
  render: (args) => (
    <div style={{ display: 'grid', gap: vars.space[4], justifyItems: 'start' }}>
      <Button>Request flip</Button>
      <FlipGameCard {...args} />
    </div>
  ),
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Request flip' }));
    await expect(canvas.getByRole('img', { name: FRONT_LABEL })).toBeVisible();
    await expect(canvas.queryByRole('img', { name: BACK_LABEL })).toBeNull();
  },
};

export const SpanishDeck: Story = {
  render: () => <FlipGameCard size="lg" value={{ deck: 'spanish', suit: 'oros', rank: 1 }} label="As de oros" backLabel="Carta boca abajo" flipped />,
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { FlipGameCard } from '@jfrader/ui/flip-game-card';

export function SpanishCard() {
  return (
    <FlipGameCard
      value={{ deck: 'spanish', suit: 'oros', rank: 1 }}
      label="As de oros"
      backLabel="Carta boca abajo"
      flipped
    />
  );
}`,
      },
    },
  },
  play: async ({ canvas, canvasElement }) => {
    const back = canvas.getByRole('img', { name: 'Carta boca abajo' });
    await expect(back.querySelector('[data-ui="pattern"]')).toHaveAttribute('data-variant', 'diagonal');
    await expect(back).not.toHaveAttribute('data-deck');
    await expect(canvas.queryByRole('img', { name: 'As de oros' })).toBeNull();
    const frontFace = canvasElement.querySelector('[data-ui="flip-game-card-front"]');
    await expect(frontFace).toHaveAttribute('inert');
    await expect(frontFace).toHaveAttribute('aria-hidden', 'true');
    await expect(frontFace?.querySelector('[data-ui="game-card"]')).toHaveAttribute('data-deck', 'spanish');
    await expect(canvasElement.querySelectorAll('[data-ui="game-card"]')).toHaveLength(2);
  },
};

export const ProviderBackLabel: Story = {
  render: () => <DeckProvider default="spanish" backLabel="Carta boca abajo">
    <FlipGameCard value={{ suit: 'copas', rank: 10 }} label="Sota de copas" flipped />
  </DeckProvider>,
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { DeckProvider } from '@jfrader/ui/deck';
import { FlipGameCard } from '@jfrader/ui/flip-game-card';

export function SpanishDeckProvider() {
  return (
    <DeckProvider default="spanish" backLabel="Carta boca abajo">
      <FlipGameCard value={{ suit: 'copas', rank: 10 }} label="Sota de copas" flipped />
    </DeckProvider>
  );
}`,
      },
    },
  },
  play: async ({ canvas }) => {
    const card = canvas.getByRole('img', { name: 'Carta boca abajo' });
    await expect(card.querySelector('[data-ui="pattern"]')).toHaveAttribute('data-variant', 'diagonal');
    await expect(canvas.queryByRole('img', { name: 'Sota de copas' })).toBeNull();
  },
};

export const MissingBackName: Story = {
  tags: ['!autodocs'],
  play: async () => {
    for (const flipped of [false, true]) {
      await expect(() => renderToString(<FlipGameCard value={{ suit: 'spades', rank: 'A' }} label={FRONT_LABEL} flipped={flipped} />)).toThrow(MissingBackLabelError);
    }
    await expect(() => renderToString(<FlipGameCard value={{ suit: 'spades', rank: 'A' }} label={FRONT_LABEL} backLabel="  " />)).toThrow('provide a nonempty backLabel');
  },
};

const artworkDeck = defineDeck({ id: 'artwork', suits: {}, ranks: {},
  back: <svg viewBox="0 0 40 60" aria-hidden="true"><circle cx="20" cy="30" r="12" fill={vars.color.cardFace} /></svg> });

export const CustomArtwork: Story = {
  name: 'Custom artwork',
  render: () => <DeckProvider decks={[artworkDeck]} backLabel={BACK_LABEL}>
    <FlipGameCard value={{ deck: 'artwork', suit: 'star', rank: 1 }} label="One star" flipped />
  </DeckProvider>,
  parameters: {
    docs: {
      description: { story: 'Register custom back artwork on the deck.' },
      source: {
        language: 'tsx',
        code: `import { defineDeck, DeckProvider } from '@jfrader/ui/deck';
import { FlipGameCard } from '@jfrader/ui/flip-game-card';

const artworkDeck = defineDeck({
  id: 'artwork',
  suits: {},
  ranks: {},
  back: (
    <svg viewBox="0 0 40 60" aria-hidden="true">
      <circle cx="20" cy="30" r="12" />
    </svg>
  ),
});

export function CustomArtworkBack() {
  return (
    <DeckProvider decks={[artworkDeck]} backLabel="Card back">
      <FlipGameCard value={{ deck: 'artwork', suit: 'star', rank: 1 }} label="One star" flipped />
    </DeckProvider>
  );
}`,
      },
    },
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('img', { name: BACK_LABEL }).querySelector('circle')).not.toBeNull();
  },
};

const replacementMaterial = css({ backgroundColor: vars.color.cardFace, border: `1px solid ${vars.color.cardInk}`, opacity: 0.9 });
function ReplacementRoot({ className, ...props }: GameCardRootProps) {
  return <WithSx styles={replacementMaterial} className={className}>
    {(classes) => <div {...props} className={classes} data-replacement="true" />}
  </WithSx>;
}

export const RootCustomization: Story = {
  tags: ['!autodocs'],
  args: { ref: fn(), component: ReplacementRoot, 'data-ui': 'consumer flip-game-card consumer',
    title: 'Host title', className: 'host-class', style: { marginInlineStart: 1, marginBlockStart: 2 },
    slotProps: { root: { 'data-ui': 'slot consumer', title: 'Slot title', className: 'slot-class',
      style: { marginInlineStart: 3 }, css: css({ opacity: 0.8 }) } },
    css: css({ opacity: 0.7 }), sx: { opacity: 0.6 } },
  play: async ({ args, canvasElement }) => {
    const root = canvasElement.querySelector('[data-ui~="flip-game-card"]');
    await expect(root).toHaveAttribute('data-ui', 'flip-game-card consumer slot');
    await expect(root).toHaveAttribute('data-replacement', 'true');
    await expect(root).toHaveAttribute('title', 'Slot title');
    await expect(root).toHaveClass('host-class', 'slot-class');
    if (!(root instanceof HTMLElement)) throw new Error('Missing replacement root');
    await expect(args.ref).toHaveBeenCalledWith(root);
    await expect(root.style.marginInlineStart).toBe('3px');
    await expect(root.style.marginBlockStart).toBe('2px');
    await expect(getComputedStyle(root).opacity).toBe('0.6');
    await expectRealPerspective(root);
    await expect(root.querySelectorAll('[data-ui="game-card"]')).toHaveLength(2);
  },
};

function UnusedRoot(): never {
  throw new Error('slots.root must take precedence over component');
}

function RefCleanupFixture() {
  const [visible, setVisible] = useState(true);
  const counts = useRef({ attaches: 0, cleanups: 0 });
  const [result, setResult] = useState('');
  const ref = useCallback((node: HTMLDivElement | null) => {
    if (!node) return;
    counts.current.attaches++;
    return () => { counts.current.cleanups++; };
  }, []);
  return <>
    <StrictMode>{visible && <>
      <GameCard label="Named back" component={UnusedRoot} slots={{ root: ReplacementRoot }} ref={ref} />
      <FlipGameCard value={{ suit: 'spades', rank: 'A' }} label={FRONT_LABEL} backLabel={BACK_LABEL}
        component={UnusedRoot} slots={{ root: ReplacementRoot }} ref={ref} />
    </>}</StrictMode>
    <Button onClick={() => setVisible(false)}>Unmount roots</Button>
    <Button onClick={() => setVisible(true)}>Mount roots</Button>
    <Button onClick={() => setResult(JSON.stringify(counts.current))}>Read refs</Button>
    <output data-testid="ref-result">{result}</output>
  </>;
}

export const RootRefCleanup: Story = {
  tags: ['!autodocs'],
  render: () => <RefCleanupFixture />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Unmount roots' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Mount roots' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Unmount roots' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Read refs' }));
    const counts = JSON.parse(canvas.getByTestId('ref-result').textContent ?? '{}');
    await expect(counts.attaches).toBeGreaterThan(2);
    await expect(counts.cleanups).toBe(counts.attaches);
  },
};

export const StationaryRoot: Story = {
  tags: ['!autodocs'],
  render: (args) => <ControlledFixture {...args} />,
  play: async ({ canvas, canvasElement, userEvent }) => {
    const root = canvasElement.querySelector<HTMLElement>('[data-ui="flip-game-card"]');
    const rotator = canvasElement.querySelector<HTMLElement>('[data-ui="flip-game-card-rotator"]');
    if (!root || !rotator) throw new Error('Missing flip anatomy');
    const before = root.getBoundingClientRect();
    await userEvent.click(canvas.getByRole('button', { name: 'Flip card' }));
    await new Promise((resolve) => setTimeout(resolve, motionDurationMs.cardFlip));
    await Promise.all(rotator.getAnimations().map((animation) => animation.finished));
    await expect(getComputedStyle(root).transform).toBe('none');
    await expectRealPerspective(root);
    await expect(root.getBoundingClientRect().toJSON()).toEqual(before.toJSON());
    await expect(getComputedStyle(rotator).transform).toBe('matrix3d(-1, 0, 0, 0, 0, 1, 0, 0, 0, 0, -1, 0, 0, 0, 0, 1)');
  },
};

async function sampleFlip(
  rotator: HTMLElement,
  frontFace: HTMLElement,
  backFace: HTMLElement,
  targets: readonly [number, number, number],
) {
  const animation = rotator.getAnimations().find(
    (candidate) => candidate instanceof CSSTransition && candidate.transitionProperty === 'transform',
  );
  if (!animation?.effect) throw new Error('Missing flip transition');
  animation.pause();
  await animation.ready;
  const duration = Number(animation.effect.getComputedTiming().duration);
  await expect(duration).toBe(motionDurationMs.cardFlip);
  await expect(getComputedStyle(rotator).transitionTimingFunction).toBe(base.motion.easeCardFlip);
  const degrees = () => {
    const matrix = new DOMMatrixReadOnly(getComputedStyle(rotator).transform);
    return Math.acos(Math.max(-1, Math.min(1, matrix.m11))) * 180 / Math.PI;
  };
  const increasing = targets[0] < targets[2];
  for (const target of targets) {
    let low = 0;
    let high = duration;
    for (let sample = 0; sample < 24; sample++) {
      animation.currentTime = (low + high) / 2;
      if ((degrees() < target) === increasing) low = Number(animation.currentTime);
      else high = Number(animation.currentTime);
    }
    animation.currentTime = target === 0 || target === 180 ? duration : (low + high) / 2;
    await expect(degrees()).toBeCloseTo(target, 1);
    const transform = getComputedStyle(rotator).transform;
    if (target > 0 && target < 180) await expect(transform).toMatch(/^matrix3d\(/);
    const rotation = new DOMMatrixReadOnly(transform);
    for (const [face, facesViewer] of [[frontFace, target < 90], [backFace, target > 90]] as const) {
      const style = getComputedStyle(face);
      await expect(style.visibility).toBe('visible');
      await expect(style.backfaceVisibility).toBe('hidden');
      const faceRotation = rotation.multiply(new DOMMatrixReadOnly(style.transform));
      await expect(faceRotation.m33 > 0).toBe(facesViewer);
    }
  }
  animation.finish();
}

export const FlipFrames: Story = {
  tags: ['!autodocs'],
  beforeEach: () => mockPreference(false),
  render: (args) => <ControlledFixture {...args} />,
  play: async ({ canvas, canvasElement, userEvent }) => {
    const root = canvasElement.querySelector<HTMLElement>('[data-ui="flip-game-card"]');
    const rotator = canvasElement.querySelector<HTMLElement>('[data-ui="flip-game-card-rotator"]');
    const frontFace = canvasElement.querySelector<HTMLElement>('[data-ui="flip-game-card-front"]');
    const backFace = canvasElement.querySelector<HTMLElement>('[data-ui="flip-game-card-back"]');
    if (!root || !rotator || !frontFace || !backFace) throw new Error('Missing flip anatomy');
    await expectRealPerspective(root);
    const trigger = canvas.getByRole('button', { name: 'Flip card' });
    await userEvent.click(trigger);
    await expect(frontFace).toHaveAttribute('inert');
    await expect(frontFace).toHaveAttribute('aria-hidden', 'true');
    await sampleFlip(rotator, frontFace, backFace, [45, 135, 180]);
    await expect(new DOMMatrixReadOnly(getComputedStyle(rotator).transform).m11).toBe(-1);
    await userEvent.click(trigger);
    await expect(backFace).toHaveAttribute('inert');
    await expect(backFace).toHaveAttribute('aria-hidden', 'true');
    await sampleFlip(rotator, frontFace, backFace, [135, 45, 0]);
    await expect(new DOMMatrixReadOnly(getComputedStyle(rotator).transform).m11).toBe(1);
  },
};
