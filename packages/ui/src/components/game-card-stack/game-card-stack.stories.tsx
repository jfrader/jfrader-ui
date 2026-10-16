import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, waitFor } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
// `styled` is the app-facing styling API; consumers import it from `@jfrader/ui`.
import { styled } from '../../index';
import { expectInside, expectNoOverlap, expectMirroredDirection } from '../../testing/geometry-assertions';
import { settleMotion } from '../../testing/motion-assertions';
import { ThemeRoot } from '../theme-root';
import { GameCard, CARD_BACK_PATTERNS } from '../game-card';
import { CARD_FRAME } from '../game-card/card-frame';
import { GameTable } from '../game-table';
import { Button } from '../button';
import { GameCardStack, getPlayedCardKey, getPileOffset, getStableJitter, getStableRotation,
  type GameCardStackPile, type GameCardStackProps } from './index';

const StackFrame = styled.div({ inlineSize: 'min(900px, 100%)', blockSize: 432 });
const CenteredStackFrame = styled(StackFrame)({ marginInline: 'auto' });
// ThemeRoot takes the styling itself: `styled(ThemeRoot)` collides with Emotion's own theme prop.
const lightScopeStyle = { blockSize: '100%', backgroundColor: vars.color.bg } as const;
const PileFrame = styled.div({ inlineSize: vars.size.gameCardMd, blockSize: `calc(${vars.size.gameCardMd} * ${CARD_FRAME.ratio})` });

const names = ['North', 'East', 'South', 'West', 'Avery', 'Robin'];
const suits = ['spades', 'hearts', 'clubs'] as const;
const ranks = ['A', 'Q', 'K'] as const;
function players(count: number, cards: number): GameCardStackPile[] {
  return Array.from({ length: count }, (_, index) => ({ playerKey: names[index]!,
    label: `${names[index]}'s played cards`,
    cards: Array.from({ length: cards }, (_, roundIdx) => ({
      id: `play-${index}-${roundIdx}`,
      label: `${ranks[roundIdx % ranks.length]} of ${suits[roundIdx % suits.length]}`,
      value: { deck: 'french', suit: suits[roundIdx % suits.length]!, rank: ranks[roundIdx % ranks.length]! },
    })) }));
}
function counts(count: number, cards: number) {
  const piles = players(count, cards);
  return { piles };
}
const meta = {
  title: 'Games/GameCardStack', component: GameCardStack, tags: ['autodocs'],
  args: { ...counts(2, 3), onValueChange: fn() },
  decorators: [(Story) => <CenteredStackFrame><Story /></CenteredStackFrame>],
  parameters: { layout: 'fullscreen', a11y: { test: 'error' }, docs: {
    description: { component: 'Keep played cards grouped by player. Open a pile to read its cards.' },
    source: {
      language: 'tsx',
      code: `import { GameCardStack } from '@jfrader/ui/game-card-stack';

<GameCardStack piles={piles} onValueChange={handleInspectionChange} />`,
    },
    usage: `## Setup
- Import from \`@jfrader/ui/game-card-stack\`. GameCardStack is an opt-in subpath and is not re-exported by the package root.

## Placement and cards
- Render \`GameCardStack.Pile\` inside \`GameTable.Play\` to put each player's cards in front of their seat. The part fills its host in normal flow; it owns no table placement.
- The root defaults to \`placement="grid"\`: give it a definite width and height. Measurement chooses rows and columns and shrinks cards to reserve inspected fans. Include empty piles to reserve positions.
- \`placement="free"\` and a pile's \`geometry\` use caller-owned normalized vectors. A supplied geometry always opts a pile out of fitting. The caller owns collisions in mixed or free placement.
- \`cardWidth\` overrides inherited \`--game-card-width\`, falling back to the medium card token. Grid fitting treats it as a preferred width. \`maxCards\` defaults to three; non-finite values use that default and finite values are rounded down and clamped to zero.
- Supply a \`label\` on every pile and card, in your page's language. Each card has a unique play \`id\` and an optional face \`value\`. Supply \`backPattern\` for hidden Spanish-deck cards, which carry no face value.
- \`data-played-key\` uses the card's \`id\` for flight destinations. Cards stack in array order; a card's optional \`order\` sets its closed-pile layer. Each pile's \`revealed\` keeps its cards spread without enlargement.

## Card spacing
- Closed cards use offsets of delta × 4px horizontally and |delta| × 1.5px vertically.
- Open cards use offsets of delta × 0.52 card widths horizontally and −|delta| × 4px vertically.
- Inspection enlarges cards by 1.45. Each card has stable jitter of at most 4px and a rotation offset of at most 6 degrees.

## Inspection and keyboard
- Each pile has a native disclosure button with \`aria-expanded\` and \`aria-controls\`.
- Tab reaches each pile. Enter or Space toggles it.
- Escape closes and returns focus after acceptance. A root \`onKeyDown\` can prevent dismissal.
- \`defaultValue\` seeds uncontrolled inspection. \`value\` and \`onValueChange\` control it.
- A player key opens that pile. \`null\` closes it. The root shares one inspected key. Standalone parts can share the same controlled state.
- Automatically revealed cards stay spread after inspection closes.
- Closed cards remain visible to assistive technology.
- Reduced motion completes size changes and focus without waiting for animation.`,
  } },
} satisfies Meta<typeof GameCardStack>;
export default meta;
type Story = StoryObj<typeof meta>;

async function noOverlap(root: HTMLElement) {
  await waitFor(() => expect(root.querySelector('[data-ui="game-card-stack-stage"]')).toHaveAttribute('data-measured', 'true'));
  await settleMotion(root);
  const piles = [...root.querySelectorAll('[data-ui="game-card-stack-pile"]')];
  for (let first = 0; first < piles.length; first++) {
    for (let second = first + 1; second < piles.length; second++) {
      for (const a of piles[first]!.querySelectorAll('[data-played-key]')) {
        for (const b of piles[second]!.querySelectorAll('[data-played-key]')) await expectNoOverlap(a, b);
      }
    }
  }
}
export const PlayedPiles: Story = {
  name: 'Played piles',
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { GameCardStack, type GameCardStackPile } from '@jfrader/ui/game-card-stack';

const faces = [{ rank: 'A', suit: 'spades' }, { rank: 'Q', suit: 'hearts' }, { rank: 'K', suit: 'clubs' }];
const piles: GameCardStackPile[] = ['North', 'East'].map((playerKey, index) => ({
  playerKey, label: playerKey + "'s played cards",
  cards: faces.map((face, round) => ({
    id: 'play-' + index + '-' + round, label: face.rank + ' of ' + face.suit,
    value: { deck: 'french', ...face },
  })),
}));

import { styled } from '@jfrader/ui';
const StackFrame = styled.div({ inlineSize: 'min(900px, 100%)', blockSize: 432 });

export function PlayedPilesExample() {
  return <StackFrame>
    <GameCardStack piles={piles} onValueChange={(key) => console.log('Inspecting:', key)} />
  </StackFrame>;
}`,
      },
    },
  },
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    const trigger = canvas.getByRole('button', { name: "North's played cards" });
    await expect(canvas.getAllByRole('img')).toHaveLength(6);
    await userEvent.tab();
    await expect(trigger).toHaveFocus();
    await expect(getComputedStyle(trigger).outlineStyle).not.toBe('none');
    await userEvent.keyboard('{Enter}');
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    const cards = trigger.ownerDocument.getElementById(trigger.getAttribute('aria-controls')!)!;
    cards.tabIndex = -1;
    cards.focus();
    await userEvent.keyboard('{Escape}');
    await expect(trigger).toHaveFocus();
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await userEvent.keyboard(' ');
    await userEvent.keyboard(' ');
    await expect(args.onValueChange).toHaveBeenCalledTimes(4);
    await expect(args.onValueChange).toHaveBeenNthCalledWith(1, 'North');
    await expect(args.onValueChange).toHaveBeenNthCalledWith(2, null);
    await noOverlap(canvasElement);
  },
};
export const OneCard: Story = { tags: ['!autodocs'], args: counts(2, 1) };
export const TwoCards: Story = { tags: ['!autodocs'], args: counts(2, 2) };
export const TwoVersusTwo: Story = {
  args: counts(4, 3), play: async ({ canvasElement }) => noOverlap(canvasElement),
  parameters: { docs: { source: { language: 'tsx', code: `import { GameCardStack } from '@jfrader/ui/game-card-stack';

const faces = [{ rank: 'A', suit: 'spades' }, { rank: 'Q', suit: 'hearts' }, { rank: 'K', suit: 'clubs' }];
const piles = ['North', 'East', 'South', 'West'].map((playerKey, index) => ({
  playerKey, label: playerKey + "'s played cards",
  cards: faces.map((face, round) => ({ id: 'play-' + index + '-' + round,
    label: face.rank + ' of ' + face.suit, value: { deck: 'french', ...face } })),
}));

import { styled } from '@jfrader/ui';
const StackFrame = styled.div({ inlineSize: 'min(900px, 100%)', marginInline: 'auto', blockSize: 432 });

<StackFrame>
  <GameCardStack piles={piles} />
</StackFrame>` } } },
};
export const ThreeVersusThree: Story = {
  args: counts(6, 3), play: async ({ canvasElement }) => noOverlap(canvasElement),
  parameters: { docs: { source: { language: 'tsx', code: `import { GameCardStack } from '@jfrader/ui/game-card-stack';

const faces = [{ rank: 'A', suit: 'spades' }, { rank: 'Q', suit: 'hearts' }, { rank: 'K', suit: 'clubs' }];
const piles = ['North', 'East', 'South', 'West', 'Avery', 'Robin'].map((playerKey, index) => ({
  playerKey, label: playerKey + "'s played cards",
  cards: faces.map((face, round) => ({ id: 'play-' + index + '-' + round,
    label: face.rank + ' of ' + face.suit, value: { deck: 'french', ...face } })),
}));

import { styled } from '@jfrader/ui';
const StackFrame = styled.div({ inlineSize: 'min(900px, 100%)', marginInline: 'auto', blockSize: 432 });

<StackFrame>
  <GameCardStack piles={piles} />
</StackFrame>` } } },
};
export const Open: Story = { tags: ['!autodocs'], args: { defaultValue: 'North' }, play: async ({ canvasElement }) => noOverlap(canvasElement) };
export const LightTheme: Story = {
  globals: { theme: 'light' },
  decorators: [(Story) => <ThemeRoot theme="light" sx={lightScopeStyle}><Story /></ThemeRoot>],
  parameters: { docs: { source: { language: 'tsx', code: `import { GameCardStack } from '@jfrader/ui/game-card-stack';
import { ThemeRoot } from '@jfrader/ui/theme-root';

const faces = [{ rank: 'A', suit: 'spades' }, { rank: 'Q', suit: 'hearts' }, { rank: 'K', suit: 'clubs' }];
const piles = ['North', 'East'].map((playerKey, index) => ({
  playerKey, label: playerKey + "'s played cards",
  cards: faces.map((face, round) => ({ id: 'play-' + index + '-' + round,
    label: face.rank + ' of ' + face.suit, value: { deck: 'french', ...face } })),
}));

import { styled } from '@jfrader/ui';
const StackFrame = styled.div({ inlineSize: 'min(900px, 100%)', marginInline: 'auto', blockSize: 432 });

<ThemeRoot theme="light"><StackFrame>
  <GameCardStack piles={piles} />
</StackFrame></ThemeRoot>` } } },
};
export const OpenLightTheme: Story = {
  ...Open, tags: ['autodocs'], globals: { theme: 'light' },
  decorators: [(Story) => <ThemeRoot theme="light" sx={lightScopeStyle}><Story /></ThemeRoot>],
  parameters: { docs: { source: { language: 'tsx', code: `import { GameCardStack } from '@jfrader/ui/game-card-stack';
import { ThemeRoot } from '@jfrader/ui/theme-root';

const faces = [{ rank: 'A', suit: 'spades' }, { rank: 'Q', suit: 'hearts' }, { rank: 'K', suit: 'clubs' }];
const piles = ['North', 'East'].map((playerKey, index) => ({
  playerKey, label: playerKey + "'s played cards",
  cards: faces.map((face, round) => ({ id: 'play-' + index + '-' + round,
    label: face.rank + ' of ' + face.suit, value: { deck: 'french', ...face } })),
}));

import { styled } from '@jfrader/ui';
const StackFrame = styled.div({ inlineSize: 'min(900px, 100%)', marginInline: 'auto', blockSize: 432 });

<ThemeRoot theme="light"><StackFrame>
  <GameCardStack piles={piles} defaultValue="North" />
</StackFrame></ThemeRoot>` } } },
};
export const RTL: Story = {
  parameters: { docs: { source: { language: 'tsx', code: `import { GameCardStack } from '@jfrader/ui/game-card-stack';

const faces = [{ rank: 'A', suit: 'spades' }, { rank: 'Q', suit: 'hearts' }, { rank: 'K', suit: 'clubs' }];
const piles = ['North', 'East', 'South', 'West', 'Avery', 'Robin'].map((playerKey, index) => ({
  playerKey, label: playerKey + "'s played cards",
  cards: faces.map((face, round) => ({ id: 'play-' + index + '-' + round,
    label: face.rank + ' of ' + face.suit, value: { deck: 'french', ...face } })),
}));

import { styled } from '@jfrader/ui';
const StackFrame = styled.div({ inlineSize: 'min(900px, 100%)', marginInline: 'auto', blockSize: 432 });

<StackFrame>
  <GameCardStack dir="rtl" piles={piles} defaultValue="East" />
</StackFrame>` } } },
  args: { ...counts(6, 3), dir: 'rtl', defaultValue: 'East' },
  play: async ({ canvasElement }) => {
    await noOverlap(canvasElement);
    await expectMirroredDirection(canvasElement.querySelector<HTMLElement>('[data-ui="game-card-stack"]')!, '[data-played-key]');
  },
};
export const RevealedHands: Story = {
  args: { piles: players(6, 3).map((pile) => ({ ...pile, revealed: true })) },
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { GameCardStack, type GameCardStackPile } from '@jfrader/ui/game-card-stack';

const faces = [{ rank: 'A', suit: 'spades' }, { rank: 'Q', suit: 'hearts' }, { rank: 'K', suit: 'clubs' }];
const piles: GameCardStackPile[] = ['North', 'East', 'South', 'West', 'Avery', 'Robin'].map((playerKey, index) => ({
  playerKey, label: playerKey + "'s played cards", revealed: true,
  cards: faces.map((face, round) => ({
    id: 'play-' + index + '-' + round, label: face.rank + ' of ' + face.suit,
    value: { deck: 'french', ...face },
  })),
}));

import { styled } from '@jfrader/ui';
const StackFrame = styled.div({ inlineSize: 'min(900px, 100%)', blockSize: 432 });

export function RevealedPilesExample() {
  return <StackFrame><GameCardStack piles={piles} /></StackFrame>;
}`,
      },
    },
  },
  play: async ({ canvas, canvasElement, userEvent }) => {
    const trigger = canvas.getByRole('button', { name: "North's played cards" });
    await userEvent.click(trigger);
    await userEvent.keyboard('{Escape}');
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(trigger.parentElement).toHaveAttribute('data-spread', 'true');
    await noOverlap(canvasElement);
  },
};
function ControlledFixture(args: GameCardStackProps) {
  const [value, setValue] = useState<string | null>(null);
  return <GameCardStack {...args} value={value} onValueChange={(next) => { args.onValueChange?.(next); setValue(next); }} />;
}
export const Controlled: Story = {
  render: (args) => <ControlledFixture {...args} />,
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { useState } from 'react';
import { GameCardStack, type GameCardStackPile } from '@jfrader/ui/game-card-stack';

const faces = [{ rank: 'A', suit: 'spades' }, { rank: 'Q', suit: 'hearts' }, { rank: 'K', suit: 'clubs' }];
const piles: GameCardStackPile[] = ['North', 'East'].map((playerKey, index) => ({
  playerKey, label: playerKey + "'s played cards",
  cards: faces.map((face, round) => ({
    id: 'play-' + index + '-' + round, label: face.rank + ' of ' + face.suit,
    value: { deck: 'french', ...face },
  })),
}));

import { styled } from '@jfrader/ui';
const StackFrame = styled.div({ inlineSize: 'min(900px, 100%)', blockSize: 432 });

export function ControlledStack() {
  const [inspectedKey, setInspectedKey] = useState<string | null>(null);
  return (
    <StackFrame><GameCardStack
      piles={piles}
      value={inspectedKey}
      onValueChange={setInspectedKey}
    /></StackFrame>
  );
}`,
      },
    },
  },
  play: async ({ canvas, userEvent, args }) => {
    const trigger = canvas.getByRole('button', { name: "North's played cards" });
    await userEvent.click(trigger);
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await userEvent.keyboard('{Escape}');
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(trigger).toHaveFocus();
    await expect(args.onValueChange).toHaveBeenCalledTimes(2);
  },
};
export const RejectedControlledClose: Story = { tags: ['!autodocs'], args: { value: 'North' },
  play: async ({ canvas, userEvent, args }) => {
    const other = canvas.getByRole('button', { name: "East's played cards" });
    other.focus();
    await userEvent.keyboard('{Escape}');
    await expect(other).toHaveFocus();
    await expect(canvas.getByRole('button', { name: "North's played cards" })).toHaveAttribute('aria-expanded', 'true');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenCalledWith(null);
  } };
export const RejectedControlledOpen: Story = { tags: ['!autodocs'], args: { value: null },
  play: async ({ canvas, userEvent, args }) => {
    const trigger = canvas.getByRole('button', { name: "North's played cards" });
    await userEvent.click(trigger);
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenCalledWith('North');
  } };
export const PreventEscape: Story = { tags: ['!autodocs'], args: { defaultValue: 'North', onKeyDown: (event) => event.preventDefault() },
  play: async ({ canvas, userEvent, args }) => {
    const trigger = canvas.getByRole('button', { name: "North's played cards" });
    trigger.focus();
    await userEvent.keyboard('{Escape}');
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await expect(args.onValueChange).not.toHaveBeenCalled();
  } };
export const RenderedGeometry: Story = { tags: ['!autodocs'], play: async ({ canvas, canvasElement, userEvent }) => {
  await expect(getPileOffset({ index: 0, total: 3, open: false, openSpreadRatio: 0.52 }))
    .toEqual({ xCardWidths: 0, xPx: -4, y: 1.5 });
  await expect(getPileOffset({ index: 2, total: 3, open: true, openSpreadRatio: 0.52 }))
    .toEqual({ xCardWidths: 0.52, xPx: 0, y: -4 });
  await noOverlap(canvasElement);
  const trigger = canvas.getByRole('button', { name: "North's played cards" });
  const cards = [...trigger.parentElement!.querySelectorAll<HTMLElement>('[data-played-key]')];
  const closedWidth = Number.parseFloat(getComputedStyle(cards[0]!).width);
  for (const open of [false, true]) {
    if (open) await userEvent.click(trigger);
    await settleMotion(canvasElement);
    for (const [index, card] of cards.entries()) {
      const key = card.dataset.playedKey!;
      const offset = getPileOffset({ index, total: 3, open, openSpreadRatio: 0.52 });
      const jitter = getStableJitter({ seed: key, spread: 4 });
      const rotation = getStableRotation({ seed: open ? `${key}:inspected` : key, maxRotationOffsetDeg: 6 });
      const style = getComputedStyle(card);
      const width = Number.parseFloat(style.width);
      await expect(width).toBeCloseTo(closedWidth * (open ? 1.45 : 1), 1);
      await expect(Number.parseFloat(style.height)).toBeCloseTo(width * CARD_FRAME.ratio, 1);
      const transform = new DOMMatrixReadOnly(style.transform);
      await expect(transform.m41).toBeCloseTo(-width / 2 + jitter.x + offset.xPx + width * offset.xCardWidths, 1);
      await expect(transform.m42).toBeCloseTo(-width * CARD_FRAME.ratio / 2 + jitter.y + offset.y, 1);
      await expect(Math.atan2(transform.m12, transform.m11) * 180 / Math.PI).toBeCloseTo(rotation, 2);
    }
  }
} };
function GrowingFixture(args: GameCardStackProps) {
  const [show, setShow] = useState(true);
  return <><GameCardStack {...args} piles={args.piles.map((pile, index) => index === 0 && !show ? { ...pile, cards: [] } : pile)} />
    <Button onClick={() => setShow(!show)}>Toggle North cards</Button></>;
}
export const MaximumThree: Story = {
  tags: ['!autodocs'],
  args: counts(2, 4),
  render: (args) => <GrowingFixture {...args} />,
  play: async ({ canvas, canvasElement, userEvent }) => {
    await noOverlap(canvasElement);
    await expect(canvas.getAllByRole('img')).toHaveLength(6);
    const east = canvasElement.querySelector('[data-ui="game-card-stack-pile"][data-player-key="East"]')!;
    const original = east.getBoundingClientRect().toJSON();
    await userEvent.click(canvas.getByRole('button', { name: 'Toggle North cards' }));
    await expect(canvas.queryByRole('button', { name: "North's played cards" })).toBeNull();
    await expect(east.getBoundingClientRect().toJSON()).toEqual(original);
  },
};
export const MaximumOne: Story = {
  tags: ['!autodocs'],
  args: { maxCards: 1 },
  play: async ({ canvas }) => {
    await expect(canvas.getAllByRole('img')).toHaveLength(2);
  },
};
// Grid dimensions are scenario data supplied by the geometry matrix.
function grid(count: number, width: number, height: number): Story {
  return {
    args: { ...counts(count, 3), style: { inlineSize: width, blockSize: height } },
    play: async ({ canvasElement, canvas, userEvent }) => {
      await noOverlap(canvasElement);
      const root = canvasElement.querySelector('[data-ui="game-card-stack"]')!;
      for (const button of canvas.getAllByRole('button')) {
        await userEvent.click(button);
        await settleMotion(canvasElement);
        for (const card of root.querySelectorAll('[data-played-key]')) await expectInside(card, root);
        await noOverlap(canvasElement);
      }
    },
  };
}
export const Grid: Story = {
  ...grid(6, 320, 280),
  parameters: { docs: { source: { language: 'tsx', code: `import { GameCardStack } from '@jfrader/ui/game-card-stack';

const faces = [{ rank: 'A', suit: 'spades' }, { rank: 'Q', suit: 'hearts' }, { rank: 'K', suit: 'clubs' }];
const piles = ['North', 'East', 'South', 'West', 'Avery', 'Robin'].map((playerKey, index) => ({
  playerKey, label: playerKey + "'s played cards",
  cards: faces.map((face, round) => ({ id: 'play-' + index + '-' + round,
    label: face.rank + ' of ' + face.suit, value: { deck: 'french', ...face } })),
}));

import { styled } from '@jfrader/ui';
const SizedStack = styled(GameCardStack)({ inlineSize: 320, blockSize: 280 });

<SizedStack piles={piles} />` } } },
};
export const GridSixMedium: Story = {
  ...grid(6, 640, 360),
  parameters: { docs: { source: { language: 'tsx', code: `import { GameCardStack } from '@jfrader/ui/game-card-stack';

const faces = [{ rank: 'A', suit: 'spades' }, { rank: 'Q', suit: 'hearts' }, { rank: 'K', suit: 'clubs' }];
const piles = ['North', 'East', 'South', 'West', 'Avery', 'Robin'].map((playerKey, index) => ({
  playerKey, label: playerKey + "'s played cards",
  cards: faces.map((face, round) => ({ id: 'play-' + index + '-' + round,
    label: face.rank + ' of ' + face.suit, value: { deck: 'french', ...face } })),
}));

import { styled } from '@jfrader/ui';
const SizedStack = styled(GameCardStack)({ inlineSize: 640, blockSize: 360 });

<SizedStack piles={piles} />` } } },
};
export const GridSixLarge: Story = {
  ...grid(6, 900, 432),
  parameters: { docs: { source: { language: 'tsx', code: `import { GameCardStack } from '@jfrader/ui/game-card-stack';

const faces = [{ rank: 'A', suit: 'spades' }, { rank: 'Q', suit: 'hearts' }, { rank: 'K', suit: 'clubs' }];
const piles = ['North', 'East', 'South', 'West', 'Avery', 'Robin'].map((playerKey, index) => ({
  playerKey, label: playerKey + "'s played cards",
  cards: faces.map((face, round) => ({ id: 'play-' + index + '-' + round,
    label: face.rank + ' of ' + face.suit, value: { deck: 'french', ...face } })),
}));

import { styled } from '@jfrader/ui';
const SizedStack = styled(GameCardStack)({ inlineSize: 900, blockSize: 432 });

<SizedStack piles={piles} />` } } },
};
export const GridFourCompact: Story = {
  ...grid(4, 320, 280),
  parameters: { docs: { source: { language: 'tsx', code: `import { GameCardStack } from '@jfrader/ui/game-card-stack';

const faces = [{ rank: 'A', suit: 'spades' }, { rank: 'Q', suit: 'hearts' }, { rank: 'K', suit: 'clubs' }];
const piles = ['North', 'East', 'South', 'West'].map((playerKey, index) => ({
  playerKey, label: playerKey + "'s played cards",
  cards: faces.map((face, round) => ({ id: 'play-' + index + '-' + round,
    label: face.rank + ' of ' + face.suit, value: { deck: 'french', ...face } })),
}));

import { styled } from '@jfrader/ui';
const SizedStack = styled(GameCardStack)({ inlineSize: 320, blockSize: 280 });

<SizedStack piles={piles} />` } } },
};
export const GridFourMedium: Story = {
  ...grid(4, 640, 360),
  parameters: { docs: { source: { language: 'tsx', code: `import { GameCardStack } from '@jfrader/ui/game-card-stack';

const faces = [{ rank: 'A', suit: 'spades' }, { rank: 'Q', suit: 'hearts' }, { rank: 'K', suit: 'clubs' }];
const piles = ['North', 'East', 'South', 'West'].map((playerKey, index) => ({
  playerKey, label: playerKey + "'s played cards",
  cards: faces.map((face, round) => ({ id: 'play-' + index + '-' + round,
    label: face.rank + ' of ' + face.suit, value: { deck: 'french', ...face } })),
}));

import { styled } from '@jfrader/ui';
const SizedStack = styled(GameCardStack)({ inlineSize: 640, blockSize: 360 });

<SizedStack piles={piles} />` } } },
};
export const GridFourLarge: Story = {
  ...grid(4, 900, 432),
  parameters: { docs: { source: { language: 'tsx', code: `import { GameCardStack } from '@jfrader/ui/game-card-stack';

const faces = [{ rank: 'A', suit: 'spades' }, { rank: 'Q', suit: 'hearts' }, { rank: 'K', suit: 'clubs' }];
const piles = ['North', 'East', 'South', 'West'].map((playerKey, index) => ({
  playerKey, label: playerKey + "'s played cards",
  cards: faces.map((face, round) => ({ id: 'play-' + index + '-' + round,
    label: face.rank + ' of ' + face.suit, value: { deck: 'french', ...face } })),
}));

import { styled } from '@jfrader/ui';
const SizedStack = styled(GameCardStack)({ inlineSize: 900, blockSize: 432 });

<SizedStack piles={piles} />` } } },
};
export const GridTwoCompact: Story = {
  ...grid(2, 320, 280),
  parameters: { docs: { source: { language: 'tsx', code: `import { GameCardStack } from '@jfrader/ui/game-card-stack';

const faces = [{ rank: 'A', suit: 'spades' }, { rank: 'Q', suit: 'hearts' }, { rank: 'K', suit: 'clubs' }];
const piles = ['North', 'East'].map((playerKey, index) => ({
  playerKey, label: playerKey + "'s played cards",
  cards: faces.map((face, round) => ({ id: 'play-' + index + '-' + round,
    label: face.rank + ' of ' + face.suit, value: { deck: 'french', ...face } })),
}));

import { styled } from '@jfrader/ui';
const SizedStack = styled(GameCardStack)({ inlineSize: 320, blockSize: 280 });

<SizedStack piles={piles} />` } } },
};
export const GridTwoMedium: Story = {
  ...grid(2, 640, 360),
  parameters: { docs: { source: { language: 'tsx', code: `import { GameCardStack } from '@jfrader/ui/game-card-stack';

const faces = [{ rank: 'A', suit: 'spades' }, { rank: 'Q', suit: 'hearts' }, { rank: 'K', suit: 'clubs' }];
const piles = ['North', 'East'].map((playerKey, index) => ({
  playerKey, label: playerKey + "'s played cards",
  cards: faces.map((face, round) => ({ id: 'play-' + index + '-' + round,
    label: face.rank + ' of ' + face.suit, value: { deck: 'french', ...face } })),
}));

import { styled } from '@jfrader/ui';
const SizedStack = styled(GameCardStack)({ inlineSize: 640, blockSize: 360 });

<SizedStack piles={piles} />` } } },
};
export const GridTwoLarge: Story = {
  ...grid(2, 900, 432),
  parameters: { docs: { source: { language: 'tsx', code: `import { GameCardStack } from '@jfrader/ui/game-card-stack';

const faces = [{ rank: 'A', suit: 'spades' }, { rank: 'Q', suit: 'hearts' }, { rank: 'K', suit: 'clubs' }];
const piles = ['North', 'East'].map((playerKey, index) => ({
  playerKey, label: playerKey + "'s played cards",
  cards: faces.map((face, round) => ({ id: 'play-' + index + '-' + round,
    label: face.rank + ' of ' + face.suit, value: { deck: 'french', ...face } })),
}));

import { styled } from '@jfrader/ui';
const SizedStack = styled(GameCardStack)({ inlineSize: 900, blockSize: 432 });

<SizedStack piles={piles} />` } } },
};
export const FreePlacement: Story = {
  args: {
    placement: 'free',
    piles: players(2, 3).map((pile, index) => ({
      ...pile,
      geometry: { cos: index ? 0.5 : -0.5, sin: 0, sideStrength: 1 },
    })),
  },
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { GameCardStack, type GameCardStackPile } from '@jfrader/ui/game-card-stack';

const faces = [{ rank: 'A', suit: 'spades' }, { rank: 'Q', suit: 'hearts' }, { rank: 'K', suit: 'clubs' }];
const piles: GameCardStackPile[] = ['North', 'East'].map((playerKey, index) => ({
  playerKey, label: playerKey + "'s played cards",
  geometry: { cos: index ? 0.5 : -0.5, sin: 0, sideStrength: 1 },
  cards: faces.map((face, round) => ({
    id: 'play-' + index + '-' + round, label: face.rank + ' of ' + face.suit,
    value: { deck: 'french', ...face },
  })),
}));

import { styled } from '@jfrader/ui';
const StackFrame = styled.div({ inlineSize: 'min(900px, 100%)', blockSize: 432 });

export function FreePlacementStack() {
  return <StackFrame><GameCardStack placement="free" piles={piles} /></StackFrame>;
}`,
      },
    },
  },
  play: async ({ canvasElement }) => {
    const root = canvasElement.querySelector('[data-ui="game-card-stack"]')!.getBoundingClientRect();
    const piles = canvasElement.querySelectorAll('[data-ui="game-card-stack-pile"]');
    for (const [index, pile] of [...piles].entries()) {
      const box = pile.getBoundingClientRect();
      await expect(box.x + box.width / 2).toBeCloseTo(root.x + root.width * (index ? 0.75 : 0.25), 1);
    }
  },
};
export const StandalonePile: Story = {
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { GameCardStack, type GameCardStackPile } from '@jfrader/ui/game-card-stack';

const pile: GameCardStackPile = {
  playerKey: 'North',
  label: "North's played cards",
  cards: [
    { id: 'play-0-0', label: 'A of spades', value: { deck: 'french', suit: 'spades', rank: 'A' } },
    { id: 'play-0-1', label: 'Q of hearts', value: { deck: 'french', suit: 'hearts', rank: 'Q' } },
    { id: 'play-0-2', label: 'K of clubs', value: { deck: 'french', suit: 'clubs', rank: 'K' } },
  ],
};

import { styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';
const PileFrame = styled.div({ inlineSize: vars.size.gameCardMd, aspectRatio: '72 / 106' });

export function StandalonePileExample() {
  return <PileFrame>
    <GameCardStack.Pile {...pile} onValueChange={(key) => console.log('Inspecting:', key)} />
  </PileFrame>;
}`,
      },
    },
  },
  render: (args) => (
    <PileFrame>
      <GameCardStack.Pile {...args.piles[0]!} onValueChange={args.onValueChange} />
    </PileFrame>
  ),
  play: async ({ canvas, userEvent, args }) => {
    const trigger = canvas.getByRole('button', { name: "North's played cards" });
    await userEvent.tab();
    await userEvent.keyboard('{Enter}');
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    const cards = trigger.ownerDocument.getElementById(trigger.getAttribute('aria-controls')!)!;
    cards.tabIndex = -1;
    cards.focus();
    await userEvent.keyboard('{Escape}');
    await expect(trigger).toHaveFocus();
    await expect(args.onValueChange).toHaveBeenCalledTimes(2);
  },
};
export const StandaloneControlled: Story = {
  tags: ['!autodocs'],
  render: (args) => <PileFrame>
    <GameCardStack.Pile {...args.piles[0]!}
      value="North" onValueChange={args.onValueChange} />
  </PileFrame>,
  play: async ({ canvas, userEvent, args }) => {
    const trigger = canvas.getByRole('button', { name: "North's played cards" });
    const cards = trigger.ownerDocument.getElementById(trigger.getAttribute('aria-controls')!)!;
    cards.tabIndex = -1;
    cards.focus();
    await userEvent.keyboard('{Escape}');
    await expect(cards).toHaveFocus();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenCalledWith(null);
  },
};
const spanishPiles: readonly GameCardStackPile[] = [
  { playerKey: 'Ana', label: 'Cartas jugadas de Ana', cards: [{ id: 'ana-play-1', label: 'as de oros', value: { deck: 'spanish', suit: 'oros', rank: 1 } }] },
  { playerKey: 'Luis', label: 'Cartas jugadas de Luis', cards: [{ id: 'luis-play-1', label: 'sota de copas', value: { deck: 'spanish', suit: 'copas', rank: 10 } }] },
];
export const Default: Story = {
  name: 'Default',
  render: () => <GameTable players={2}
    seats={[{ key: 'Ana', teamIdx: 0, isMe: true }, { key: 'Luis', teamIdx: 1 }]}
  >
    {spanishPiles.map((pile) => <GameTable.Seat key={pile.playerKey} slotKey={pile.playerKey}>
      <GameTable.SeatChrome>{pile.playerKey}</GameTable.SeatChrome>
      {pile.playerKey === 'Luis' && <GameCard label="Carta oculta de Luis" backPattern={CARD_BACK_PATTERNS.spanish} />}
    </GameTable.Seat>)}
    {spanishPiles.map((pile) => <GameTable.Play key={pile.playerKey} slotKey={pile.playerKey}>
      <GameCardStack.Pile {...pile} backPattern={CARD_BACK_PATTERNS.spanish} />
    </GameTable.Play>)}
  </GameTable>,
  parameters: {
    docs: {
      description: { story: 'Two-player truco with Spanish-deck cards and a pile in front of each seat.' },
      source: {
        language: 'tsx',
        code: `import { GameCard, CARD_BACK_PATTERNS } from '@jfrader/ui/game-card';
import { GameCardStack, type GameCardStackPile } from '@jfrader/ui/game-card-stack';
import { GameTable } from '@jfrader/ui/game-table';

const spanishPiles: readonly GameCardStackPile[] = [
  { playerKey: 'Ana', label: 'Cartas jugadas de Ana', cards: [{ id: 'ana-play-1', label: 'as de oros', value: { deck: 'spanish', suit: 'oros', rank: 1 } }] },
  { playerKey: 'Luis', label: 'Cartas jugadas de Luis', cards: [{ id: 'luis-play-1', label: 'sota de copas', value: { deck: 'spanish', suit: 'copas', rank: 10 } }] },
];

export function TrucoTable() {
  return (
    <GameTable
      players={2}
      seats={[{ key: 'Ana', teamIdx: 0, isMe: true }, { key: 'Luis', teamIdx: 1 }]}
    >
      {spanishPiles.map((pile) => (
        <GameTable.Seat key={pile.playerKey} slotKey={pile.playerKey}>
          <GameTable.SeatChrome>{pile.playerKey}</GameTable.SeatChrome>
          {pile.playerKey === 'Luis' && <GameCard label="Carta oculta de Luis" backPattern={CARD_BACK_PATTERNS.spanish} />}
        </GameTable.Seat>
      ))}
      {spanishPiles.map((pile) => (
        <GameTable.Play key={pile.playerKey} slotKey={pile.playerKey}>
          <GameCardStack.Pile {...pile} backPattern={CARD_BACK_PATTERNS.spanish} />
        </GameTable.Play>
      ))}
    </GameTable>
  );
}`,
      },
    },
  },
  play: async ({ canvasElement, canvas, userEvent }) => {
    await waitFor(() => expect(canvasElement.querySelector('[data-game-surface]')).not.toHaveAttribute('data-layout-fit', 'measuring'));
    await expect(canvasElement.querySelectorAll('[data-ui="game-table-play"] [data-ui="game-card-stack-pile"]')).toHaveLength(2);
    await expect(canvas.getByRole('img', { name: 'as de oros' })).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'Cartas jugadas de Luis' }));
    await userEvent.keyboard('{Escape}');
  },
};

export const ExplicitPlayIdentity: Story = {
  tags: ['!autodocs'],
  args: { piles: [
    { playerKey: 'north-east', label: 'North-east pile', cards: [{ id: 'play-north-east-1', label: 'First play' }] },
    { playerKey: 'north', label: 'North pile', cards: [{ id: 'play-north-2', label: 'Second play' }] },
  ] },
  play: async ({ canvasElement, canvas }) => {
    const first = { player: { key: 'north-east' }, card: 'ace' };
    const second = { player: { key: 'north' }, card: 'east-ace' };
    await expect(`0-${first.player.key}-${first.card}`).toBe(`0-${second.player.key}-${second.card}`);
    await expect(getPlayedCardKey(0, first)).not.toBe(getPlayedCardKey(0, second));
    const destinations = [...canvasElement.querySelectorAll<HTMLElement>('[data-played-key]')];
    await expect(destinations.map((node) => node.dataset.playedKey)).toEqual(['play-north-east-1', 'play-north-2']);
    await expect(canvas.getByRole('img', { name: 'First play' })).toBeVisible();
    await expect(canvas.getByRole('img', { name: 'Second play' })).toBeVisible();
  },
};
