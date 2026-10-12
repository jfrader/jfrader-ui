import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, spyOn, within } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { css } from '../../styling/css';
import { motionDurationMs } from '../../styling/motion-timings';
import { withLightTheme } from '../../testing/story-decorators';
import { Button } from '../button';
import { GameCard } from '../game-card';
import { FlipGameCard, type FlipGameCardProps } from './index';

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
  args: { flipped: false, front, back },
  argTypes: {
    size: { control: 'radio', options: ['sm', 'md', 'lg'] },
    front: { control: false },
    back: { control: false },
  },
  beforeEach: () => mockPreference(),
  parameters: {
    docs: {
      description: { component: 'Turn a playing card over to show its other face.' },
      usage: `### Faces and state
- Pass two named faces with \`front\` and \`back\`; there is no \`children\` alias.
- Set \`flipped\` to show the back. Clicking the card does not change it.
- Both faces stay mounted. Hidden content remains in the DOM: do not pass secret card values.
- Place a \`GameCard\` directly in each face; the wrapper sizes both to its \`size\` (default \`md\`). Custom content must fit the frame.

### Keyboard
- This wrapper has no APG widget role or keyboard commands. Give each face its own accessible name.
- The inactive face is inert and hidden from assistive technology immediately, even during a flip.
- Keep the flip control outside the faces so it retains focus when the accepted state changes.

### Motion and layout
- The outer root (and its React 19 \`ref\`) stays still; only the inner rotator moves. Use root \`sx\` for placement and \`slotProps\` for part styles.
- Perspective uses \`size.gameCardPerspective\` (600px). The flip uses the slow duration token (240ms), rather than the original 300ms.
- Reduced motion switches faces immediately without rotation. No render-time measurements are needed.`,
    },
  },
} satisfies Meta<typeof FlipGameCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('img', { name: FRONT_LABEL })).toBeVisible();
    await expect(canvas.queryByRole('img', { name: BACK_LABEL })).toBeNull();
  },
};

export const Flipped: Story = {
  args: { flipped: true },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('img', { name: BACK_LABEL })).toBeVisible();
    await expect(canvas.queryByRole('img', { name: FRONT_LABEL })).toBeNull();
  },
};

export const LightTheme: Story = { decorators: [withLightTheme] };
export const FlippedLightTheme: Story = { decorators: [withLightTheme], args: { flipped: true } };

export const Sizes: Story = {
  render: (args) => (
    <div style={{ display: 'flex', gap: vars.space[4] }}>
      {(['sm', 'md', 'lg'] as const).map((size) => (
        <FlipGameCard {...args} key={size} size={size} />
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    const widths = { sm: 32, md: 72, lg: 112 };
    for (const size of ['sm', 'md', 'lg'] as const) {
      const root = canvasElement.querySelector<HTMLElement>(`[data-ui="flip-game-card"][data-size="${size}"]`);
      if (!root) throw new Error('Missing card wrapper');
      await expect(root.getBoundingClientRect().width).toBe(widths[size]);
      for (const card of root.querySelectorAll('[data-ui="game-card"]')) {
        await expect(card.getBoundingClientRect().width).toBe(widths[size]);
        await expect(card.getBoundingClientRect().height).toBeCloseTo(widths[size] * 1.48, 1);
      }
    }
  },
};

function ControlledFixture(args: FlipGameCardProps) {
  const [flipped, setFlipped] = useState(args.flipped);
  return (
    <div style={{ display: 'grid', gap: vars.space[4], justifyItems: 'start' }}>
      <Button onClick={() => setFlipped(!flipped)}>Flip card</Button>
      <FlipGameCard
        {...args}
        flipped={flipped}
        size="lg"
        front={<>{args.front}<Button size="sm" css={faceActionStyle}>Front action</Button></>}
        back={<>{args.back}<Button size="sm" css={faceActionStyle}>Back action</Button></>}
      />
      <Button>Continue</Button>
    </div>
  );
}

export const Controlled: Story = {
  render: (args) => <ControlledFixture {...args} />,
  parameters: { docs: { source: { code: `<Button onClick={() => setFlipped(!flipped)}>Flip card</Button>
<FlipGameCard flipped={flipped}
  front={<GameCard label="Ace of spades" value={{ deck: 'french', suit: 'spades', rank: 'A' }} />}
  back={<GameCard label="Card back" />} />` } } },
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
    await userEvent.tab();
    await expect(canvas.getByRole('button', { name: 'Continue' })).toHaveFocus();
    backAction.focus();
    await expect(backAction).not.toHaveFocus();
    await userEvent.tab({ shift: true });
    await userEvent.tab({ shift: true });
    await userEvent.keyboard('{Enter}');
    await expect(trigger).toHaveFocus();
    await expect(root).toHaveAttribute('data-state', 'back');
    await expect(frontFace).toHaveAttribute('inert');
    await expect(frontFace).toHaveAttribute('aria-hidden', 'true');
    await expect(canvas.queryByRole('img', { name: FRONT_LABEL })).toBeNull();
    await expect(canvas.queryByRole('button', { name: 'Front action' })).toBeNull();
    await expect(canvas.getByRole('img', { name: BACK_LABEL })).toBeInTheDocument();
    await userEvent.tab();
    await expect(backAction).toHaveFocus();
    frontAction.focus();
    await expect(frontAction).not.toHaveFocus();
    await userEvent.tab({ shift: true });
    await userEvent.keyboard(' ');
    await expect(trigger).toHaveFocus();
    await expect(root).toHaveAttribute('data-state', 'front');
    await expect(backFace).toHaveAttribute('inert');
    await expect(canvas.queryByRole('img', { name: BACK_LABEL })).toBeNull();
    await expect(within(frontFace).getByRole('button')).toBe(frontAction);
  },
};

export const ReducedMotion: Story = {
  beforeEach: () => mockPreference(true),
  render: (args) => <ControlledFixture {...args} />,
  parameters: { docs: { description: { story: 'Flip the card without rotation. This play test stubs the reduced-motion media preference.' } } },
  play: async ({ canvas, canvasElement, userEvent }) => {
    const rotator = canvasElement.querySelector<HTMLElement>('[data-ui="flip-game-card-rotator"]');
    if (!rotator) throw new Error('Missing rotator');
    await expect(getComputedStyle(rotator).transform).toBe('none');
    await userEvent.click(canvas.getByRole('button', { name: 'Flip card' }));
    await expect(rotator).toHaveAttribute('data-state', 'back');
    await expect(getComputedStyle(rotator).transitionDuration).toBe('0s');
    await expect(getComputedStyle(rotator).transform).toBe('none');
    await expect(canvas.getByRole('img', { name: BACK_LABEL })).toBeVisible();
    await expect(canvas.queryByRole('img', { name: FRONT_LABEL })).toBeNull();
  },
};

export const ControlledWithoutAcceptance: Story = {
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
  args: { front: <GameCard label="As de oros" value={{ deck: 'spanish', suit: 'oros', rank: 1 }} /> },
};

export const StationaryRoot: Story = {
  render: (args) => <ControlledFixture {...args} />,
  play: async ({ canvas, canvasElement, userEvent }) => {
    const root = canvasElement.querySelector<HTMLElement>('[data-ui="flip-game-card"]');
    const rotator = canvasElement.querySelector<HTMLElement>('[data-ui="flip-game-card-rotator"]');
    if (!root || !rotator) throw new Error('Missing flip anatomy');
    const before = root.getBoundingClientRect();
    await userEvent.click(canvas.getByRole('button', { name: 'Flip card' }));
    await new Promise((resolve) => setTimeout(resolve, motionDurationMs.slow));
    await Promise.all(rotator.getAnimations().map((animation) => animation.finished));
    await expect(getComputedStyle(root).transform).toBe('none');
    await expect(getComputedStyle(root).perspective).toBe('600px');
    await expect(root.getBoundingClientRect().toJSON()).toEqual(before.toJSON());
    await expect(getComputedStyle(rotator).transform).toBe('matrix3d(-1, 0, 0, 0, 0, 1, 0, 0, 0, 0, -1, 0, 0, 0, 0, 1)');
  },
};
