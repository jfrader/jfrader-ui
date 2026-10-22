import { Fragment, useState, type ComponentPropsWithRef } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, waitFor } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
// `styled` is the app-facing styling API; consumers import it from `@jfrader/ui`.
import { styled } from '../../index';
import { expectInside, expectNoOverlap, expectMirroredDirection } from '../../testing/geometry-assertions';
import { settleMotion } from '../../testing/motion-assertions';
import { ThemeRoot } from '../theme-root';
import { CARD_BACK_PATTERNS } from '../game-card';
import { CARD_FRAME } from '../game-card/card-frame';
import { GameTable } from '../game-table';
import { GameSeat } from '../game-seat';
import { Button } from '../button';
import { GameCardStack, getPlayedCardKey, getPileOffset, getStableJitter, getStableRotation, getPlayerTableCards,
  type GameCardStackPile, type GameCardStackProps } from './index';

const StackStage = styled.div({ inlineSize: '100%', maxInlineSize: 640, blockSize: 360, marginInline: 'auto' });
const TableStage = styled.div({
  inlineSize: '100%', maxInlineSize: 640, blockSize: 640, marginInline: 'auto',
  // A two-seat table becomes a thin vertical sliver in a 640-tall phone stage.
  '@media (max-width: 30rem)': { blockSize: 360 },
});
// Contains PileFrame's block margins so an inspected fan stays inside the canvas.
const PileStage = styled.div({ display: 'flow-root', inlineSize: 'fit-content', marginInline: 'auto' });
// Stories pick a stage with `parameters.stage`; `none` is for stories that size themselves.
const STAGES = { stack: StackStage, table: TableStage, pile: PileStage, none: Fragment };
type StageName = keyof typeof STAGES;
// ThemeRoot takes the styling itself: `styled(ThemeRoot)` collides with Emotion's own theme prop.
const lightScopeStyle = { blockSize: '100%', backgroundColor: vars.color.bg } as const;
const PileFrame = styled.div({ inlineSize: vars.size.gameCardMd, blockSize: `calc(${vars.size.gameCardMd} * ${CARD_FRAME.ratio})`, marginInline: 'auto', marginBlock: vars.space[12] });
const NarrowFrame = styled.div({ inlineSize: 320, maxInlineSize: '100%' });

function ReplacedStackRoot(props: ComponentPropsWithRef<'div'>) {
  return <div {...props} data-replacement="stack-root" />;
}

/** Replace the stack container while retaining pile inspection. */
export const ReplacedRootKeepsInspection: Story = {
  tags: ['!autodocs'],
  args: {
    slots: { root: ReplacedStackRoot },
    slotProps: { root: { ref: fn(), onKeyDown: fn(), className: 'custom-stack', title: 'Played cards' } },
  },
  play: async ({ canvasElement, canvas, userEvent, args }) => {
    const root = canvasElement.querySelector('[data-replacement="stack-root"]')!;
    await expect(root).toHaveAttribute('data-ui', 'game-card-stack');
    await expect(root).toHaveClass('custom-stack');
    await expect(root).toHaveAttribute('title', 'Played cards');
    await expect(args.slotProps?.root?.ref).toHaveBeenCalledWith(root);
    await expect(getComputedStyle(root).position).toBe('relative');
    const trigger = canvas.getByRole('button', { name: "North's played cards" });
    await userEvent.click(trigger);
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await userEvent.keyboard('{Escape}');
    await expect(args.slotProps?.root?.onKeyDown).toHaveBeenCalledTimes(1);
    await expect(args.slotProps?.root?.onKeyDown).toHaveBeenCalledWith(expect.objectContaining({ key: 'Escape' }));
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(trigger).toHaveFocus();
    await expect(args.onValueChange).toHaveBeenNthCalledWith(1, 'North');
    await expect(args.onValueChange).toHaveBeenNthCalledWith(2, null);
  },
};

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
  decorators: [(Story, { parameters }) => {
    const stage: StageName = parameters.stage;
    const Stage = STAGES[stage];
    return <Stage><Story /></Stage>;
  }],
  parameters: { layout: 'fullscreen', stage: 'stack', a11y: { test: 'error' }, docs: {
    description: { component: 'Keep played cards grouped by player. Open a pile to read its cards.' },
    sections: [
      { title: 'Inspection', stories: ['PlayedPiles', 'Controlled', 'RevealedHands'] },
      { title: 'Placement', stories: ['Default', 'StandalonePile', 'FreePlacement'] },
    ],
    source: {
      language: 'tsx',
      code: `import { GameCardStack } from '@jfrader/ui/game-card-stack';

<GameCardStack piles={piles} onValueChange={handleInspectionChange} />`,
    },
    usage: `### Layout
Give the grid a definite width and height; fitting reserves room for inspected fans. Include empty piles to reserve positions. In free or mixed placement, your application must prevent collisions. Standalone piles fill their host and do not position themselves on a table.

### Cards

Give every pile and card a name in the page's language and every play a unique identity. All cards render by default. visible limits the pile to the newest N cards; finite values round down and clamp to zero, while non-finite values show all cards. The deprecated maxCards alias remains for one release; visible wins when both are supplied. Do not send secret face values for hidden cards.

### Inspection and keyboard

Tab reaches each pile's disclosure button. Enter or Space toggles inspection. Escape requests closure and returns focus after acceptance; a prevented key event cancels dismissal. Only one pile is inspected at a time. Revealed cards stay spread when inspection closes, and closed cards remain available to assistive technology. Reduced motion completes size and focus changes immediately.

Standalone Pile uses open, defaultOpen and onOpenChange for boolean disclosure. In a stack, the root maps its single inspected player key to each pile's open state. The standalone key-based inspection props remain compatible for one release; prefer the boolean disclosure props.`,
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
/** Two played card piles with keyboard inspection to expand and examine cards. */
export const PlayedPiles: Story = {
  name: 'Played piles',
  parameters: {
    docs: {
      description: { story: 'Open either pile to inspect its three played cards.' },
      source: {
        language: 'tsx',
        code: `import { styled } from '@jfrader/ui';
import { GameCardStack, type GameCardStackPile } from '@jfrader/ui/game-card-stack';

const faces = [{ rank: 'A', suit: 'spades' }, { rank: 'Q', suit: 'hearts' }, { rank: 'K', suit: 'clubs' }];
const piles: GameCardStackPile[] = ['North', 'East'].map((playerKey, index) => ({
  playerKey, label: playerKey + "'s played cards",
  cards: faces.map((face, round) => ({
    id: 'play-' + index + '-' + round, label: face.rank + ' of ' + face.suit,
    value: { deck: 'french', ...face },
  })),
}));

const StackFrame = styled.div({ inlineSize: '100%', maxInlineSize: 640, blockSize: 360, marginInline: 'auto' });

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

/** Four player piles arranged in a two-versus-two team layout. */
export const TwoVersusTwo: Story = {
  name: 'Two teams of two',
  args: counts(4, 3), play: async ({ canvasElement }) => noOverlap(canvasElement),
  parameters: { docs: { source: { language: 'tsx', code: `import { GameCardStack } from '@jfrader/ui/game-card-stack';

const faces = [{ rank: 'A', suit: 'spades' }, { rank: 'Q', suit: 'hearts' }, { rank: 'K', suit: 'clubs' }];
const piles = ['North', 'East', 'South', 'West'].map((playerKey, index) => ({
  playerKey, label: playerKey + "'s played cards",
  cards: faces.map((face, round) => ({ id: 'play-' + index + '-' + round,
    label: face.rank + ' of ' + face.suit, value: { deck: 'french', ...face } })),
}));

import { styled } from '@jfrader/ui';
const StackFrame = styled.div({ inlineSize: '100%', maxInlineSize: 640, blockSize: 360, marginInline: 'auto' });

<StackFrame>
  <GameCardStack piles={piles} />
</StackFrame>` } } },
};

/** Six player piles arranged in a three-versus-three team layout. */
export const ThreeVersusThree: Story = {
  name: 'Two teams of three',
  args: counts(6, 3), play: async ({ canvasElement }) => noOverlap(canvasElement),
  parameters: { docs: { source: { language: 'tsx', code: `import { GameCardStack } from '@jfrader/ui/game-card-stack';

const faces = [{ rank: 'A', suit: 'spades' }, { rank: 'Q', suit: 'hearts' }, { rank: 'K', suit: 'clubs' }];
const piles = ['North', 'East', 'South', 'West', 'Avery', 'Robin'].map((playerKey, index) => ({
  playerKey, label: playerKey + "'s played cards",
  cards: faces.map((face, round) => ({ id: 'play-' + index + '-' + round,
    label: face.rank + ' of ' + face.suit, value: { deck: 'french', ...face } })),
}));

import { styled } from '@jfrader/ui';
const StackFrame = styled.div({ inlineSize: '100%', maxInlineSize: 640, blockSize: 360, marginInline: 'auto' });

<StackFrame>
  <GameCardStack piles={piles} />
</StackFrame>` } } },
};
export const Open: Story = { tags: ['!autodocs'], args: { defaultValue: 'North' }, play: async ({ canvasElement }) => noOverlap(canvasElement) };

/** Played card piles rendered under the light theme palette. */
export const LightTheme: Story = {
  name: 'Light theme',
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
const StackFrame = styled.div({ inlineSize: '100%', maxInlineSize: 640, blockSize: 360, marginInline: 'auto' });

<ThemeRoot theme="light"><StackFrame>
  <GameCardStack piles={piles} />
</StackFrame></ThemeRoot>` } } },
};

/** An inspected pile open under the light theme palette. */
export const OpenLightTheme: Story = {
  ...Open,
  name: 'Open pile · light',
  tags: ['autodocs'], globals: { theme: 'light' },
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
const StackFrame = styled.div({ inlineSize: '100%', maxInlineSize: 640, blockSize: 360, marginInline: 'auto' });

<ThemeRoot theme="light"><StackFrame>
  <GameCardStack piles={piles} defaultValue="North" />
</StackFrame></ThemeRoot>` } } },
};

/** Played card piles fanning cards in right-to-left direction. */
export const RTL: Story = {
  name: 'RTL',
  parameters: { docs: { source: { language: 'tsx', code: `import { GameCardStack } from '@jfrader/ui/game-card-stack';

const faces = [{ rank: 'A', suit: 'spades' }, { rank: 'Q', suit: 'hearts' }, { rank: 'K', suit: 'clubs' }];
const piles = ['North', 'East', 'South', 'West', 'Avery', 'Robin'].map((playerKey, index) => ({
  playerKey, label: playerKey + "'s played cards",
  cards: faces.map((face, round) => ({ id: 'play-' + index + '-' + round,
    label: face.rank + ' of ' + face.suit, value: { deck: 'french', ...face } })),
}));

import { styled } from '@jfrader/ui';
const StackFrame = styled.div({ inlineSize: '100%', maxInlineSize: 640, blockSize: 360, marginInline: 'auto' });

<StackFrame>
  <GameCardStack dir="rtl" piles={piles} defaultValue="East" />
</StackFrame>` } } },
  args: { ...counts(6, 3), dir: 'rtl', defaultValue: 'East' },
  play: async ({ canvasElement }) => {
    await noOverlap(canvasElement);
    await expectMirroredDirection(canvasElement.querySelector<HTMLElement>('[data-ui="game-card-stack"]')!, '[data-played-key]');
  },
};

/** Automatically revealed cards remaining spread after pile inspection closes. */
export const RevealedHands: Story = {
  name: 'Revealed hands',
  args: { piles: players(6, 3).map((pile) => ({ ...pile, revealed: true })) },
  parameters: {
    docs: {
      description: { story: 'Keep cards spread even when no pile is inspected.' },
      source: {
        language: 'tsx',
        code: `import { styled } from '@jfrader/ui';
import { GameCardStack, type GameCardStackPile } from '@jfrader/ui/game-card-stack';

const faces = [{ rank: 'A', suit: 'spades' }, { rank: 'Q', suit: 'hearts' }, { rank: 'K', suit: 'clubs' }];
const piles: GameCardStackPile[] = ['North', 'East', 'South', 'West', 'Avery', 'Robin'].map((playerKey, index) => ({
  playerKey, label: playerKey + "'s played cards", revealed: true,
  cards: faces.map((face, round) => ({
    id: 'play-' + index + '-' + round, label: face.rank + ' of ' + face.suit,
    value: { deck: 'french', ...face },
  })),
}));

const StackFrame = styled.div({ inlineSize: '100%', maxInlineSize: 640, blockSize: 360, marginInline: 'auto' });

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

/** Pile inspection state controlled by the parent component. */
export const Controlled: Story = {
  name: 'Controlled open',
  render: (args) => <ControlledFixture {...args} />,
  parameters: {
    docs: {
      description: { story: 'Accept inspection changes in parent-owned state.' },
      source: {
        language: 'tsx',
        code: `import { useState } from 'react';
import { styled } from '@jfrader/ui';
import { GameCardStack, type GameCardStackPile } from '@jfrader/ui/game-card-stack';

const faces = [{ rank: 'A', suit: 'spades' }, { rank: 'Q', suit: 'hearts' }, { rank: 'K', suit: 'clubs' }];
const piles: GameCardStackPile[] = ['North', 'East'].map((playerKey, index) => ({
  playerKey, label: playerKey + "'s played cards",
  cards: faces.map((face, round) => ({
    id: 'play-' + index + '-' + round, label: face.rank + ' of ' + face.suit,
    value: { deck: 'french', ...face },
  })),
}));

const StackFrame = styled.div({ inlineSize: '100%', maxInlineSize: 640, blockSize: 360, marginInline: 'auto' });

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
export const AllCards: Story = {
  tags: ['!autodocs'],
  args: counts(2, 4),
  render: (args) => <GrowingFixture {...args} />,
  play: async ({ canvas, canvasElement, userEvent }) => {
    await noOverlap(canvasElement);
    await expect(canvas.getAllByRole('img')).toHaveLength(8);
    const pile = players(1, 5)[0]!;
    const grouped = getPlayerTableCards(pile.cards.map((card) => [{ ...card, player: { key: pile.playerKey } }]),
      { [pile.playerKey]: [pile.cards[0]!, { id: 'revealed-sixth', label: 'Sixth card' }] });
    await expect(grouped.cardsByPlayerKey[pile.playerKey]!.map((card) => card.id)).toEqual([
      ...pile.cards.map((card) => card.id), 'revealed-sixth',
    ]);
    const east = canvasElement.querySelector('[data-ui="game-card-stack-pile"][data-player-key="East"]')!;
    const original = east.getBoundingClientRect().toJSON();
    await userEvent.click(canvas.getByRole('button', { name: 'Toggle North cards' }));
    await expect(canvas.queryByRole('button', { name: "North's played cards" })).toBeNull();
    await expect(east.getBoundingClientRect().toJSON()).toEqual(original);
  },
};
export const MaximumThree: Story = {
  tags: ['!autodocs'],
  args: { ...counts(2, 4), visible: 3 },
  play: async ({ canvasElement }) => {
    await expect([...canvasElement.querySelectorAll<HTMLElement>('[data-played-key]')].map((card) => card.dataset.playedKey))
      .toEqual(['play-0-1', 'play-0-2', 'play-0-3', 'play-1-1', 'play-1-2', 'play-1-3']);
  },
};
export const MaximumOne: Story = {
  tags: ['!autodocs'],
  args: { visible: 1 },
  play: async ({ canvas }) => {
    await expect(canvas.getAllByRole('img')).toHaveLength(2);
  },
};

export const NewestCards: Story = {
  tags: ['!autodocs'], args: { ...counts(2, 5), visible: 2, maxCards: 1 },
  play: async ({ canvasElement, canvas, userEvent }) => {
    await expect([...canvasElement.querySelectorAll<HTMLElement>('[data-played-key]')].map((card) => card.dataset.playedKey))
      .toEqual(['play-0-3', 'play-0-4', 'play-1-3', 'play-1-4']);
    await userEvent.click(canvas.getByRole('button', { name: "North's played cards" }));
    await noOverlap(canvasElement);
  },
};
export const LegacyMaxCards: Story = {
  tags: ['!autodocs'], args: { ...counts(2, 5), maxCards: 1 },
  play: async ({ canvasElement }) => {
    await expect([...canvasElement.querySelectorAll<HTMLElement>('[data-played-key]')].map((card) => card.dataset.playedKey))
      .toEqual(['play-0-4', 'play-1-4']);
  },
};

function StandaloneDisclosureFixture({ controlled = false, reject = false, ...args }: GameCardStackProps & { controlled?: boolean; reject?: boolean }) {
  const [open, setOpen] = useState(true);
  const pile = args.piles[0]!;
  return <PileFrame><GameCardStack.Pile {...pile} defaultOpen={!controlled} open={controlled ? open : undefined}
    onOpenChange={(next) => { if (!reject) setOpen(next); args.onValueChange?.(next ? pile.playerKey : null); }} /></PileFrame>;
}

/** A standalone pile owns boolean disclosure state. */
export const StandaloneDisclosure: Story = {
  render: (args) => <StandaloneDisclosureFixture {...args} />,
  parameters: { stage: 'pile', docs: { source: { language: 'tsx', code: `import { GameCardStack } from '@jfrader/ui/game-card-stack';
import { styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const PileFrame = styled.div({ inlineSize: vars.size.gameCardMd, aspectRatio: '72 / 106', margin: vars.space[12] });

<PileFrame><GameCardStack.Pile playerKey="north" label="North's played cards"
  cards={[
    { id: 'ace', label: 'Ace of spades', value: { deck: 'french', suit: 'spades', rank: 'A' } },
    { id: 'queen', label: 'Queen of hearts', value: { deck: 'french', suit: 'hearts', rank: 'Q' } },
    { id: 'king', label: 'King of clubs', value: { deck: 'french', suit: 'clubs', rank: 'K' } },
  ]} defaultOpen onOpenChange={console.log} /></PileFrame>` } } },
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    const trigger = canvas.getByRole('button');
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await userEvent.tab();
    await expect(trigger).toHaveFocus();
    await expect(getComputedStyle(trigger).outlineStyle).not.toBe('none');
    await userEvent.keyboard('{Escape}');
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(trigger).toHaveFocus();
    await userEvent.keyboard(' ');
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await expect(args.onValueChange).toHaveBeenNthCalledWith(1, null);
    await expect(args.onValueChange).toHaveBeenNthCalledWith(2, 'North');
    await expect(args.onValueChange).toHaveBeenCalledTimes(2);
    await settleMotion(canvasElement);
    for (const card of canvasElement.querySelectorAll('[data-played-key]')) await expectInside(card, canvasElement);
  },
};
export const ControlledStandalone: Story = {
  ...StandaloneDisclosure, tags: ['!autodocs'], render: (args) => <StandaloneDisclosureFixture {...args} controlled />,
};
export const RejectedStandaloneClose: Story = {
  tags: ['!autodocs'], parameters: { stage: 'pile' }, render: (args) => <StandaloneDisclosureFixture {...args} controlled reject />,
  play: async ({ canvas, userEvent, args }) => {
    const trigger = canvas.getByRole('button');
    await userEvent.click(trigger);
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenCalledWith(null);
  },
};
// Grid dimensions are scenario data supplied by the geometry matrix.
function grid(count: number, width: number, height: number): Story {
  return {
    args: { ...counts(count, 3), style: { inlineSize: width, maxInlineSize: '100%', blockSize: height } },
    parameters: { stage: 'none' },
    play: async ({ canvasElement, canvas, userEvent }) => {
      await noOverlap(canvasElement);
      const root = canvasElement.querySelector('[data-ui="game-card-stack"]')!;
      await expectInside(root, root.parentElement!);
      for (const button of canvas.getAllByRole('button')) {
        await userEvent.click(button);
        await settleMotion(canvasElement);
        for (const card of root.querySelectorAll('[data-played-key]')) await expectInside(card, root);
        await noOverlap(canvasElement);
      }
    },
  };
}

export const NarrowContainer: Story = {
  ...grid(6, 900, 432),
  tags: ['!autodocs'],
  decorators: [(Story) => <NarrowFrame><Story /></NarrowFrame>],
};
/** Piles fitted automatically within a constrained container grid. */
export const Grid: Story = {
  name: 'Grid placement',
  ...grid(6, 320, 280),
  parameters: { stage: 'none', docs: { source: { language: 'tsx', code: `import { GameCardStack } from '@jfrader/ui/game-card-stack';

const faces = [{ rank: 'A', suit: 'spades' }, { rank: 'Q', suit: 'hearts' }, { rank: 'K', suit: 'clubs' }];
const piles = ['North', 'East', 'South', 'West', 'Avery', 'Robin'].map((playerKey, index) => ({
  playerKey, label: playerKey + "'s played cards",
  cards: faces.map((face, round) => ({ id: 'play-' + index + '-' + round,
    label: face.rank + ' of ' + face.suit, value: { deck: 'french', ...face } })),
}));

import { styled } from '@jfrader/ui';
const SizedStack = styled(GameCardStack)({ inlineSize: 320, maxInlineSize: '100%', blockSize: 280 });

<SizedStack piles={piles} />` } } },
};

/** Six player piles fitted within a medium grid container. */
export const GridSixMedium: Story = {
  name: 'Six cards · medium',
  ...grid(6, 640, 360),
  parameters: { stage: 'none', docs: { source: { language: 'tsx', code: `import { GameCardStack } from '@jfrader/ui/game-card-stack';

const faces = [{ rank: 'A', suit: 'spades' }, { rank: 'Q', suit: 'hearts' }, { rank: 'K', suit: 'clubs' }];
const piles = ['North', 'East', 'South', 'West', 'Avery', 'Robin'].map((playerKey, index) => ({
  playerKey, label: playerKey + "'s played cards",
  cards: faces.map((face, round) => ({ id: 'play-' + index + '-' + round,
    label: face.rank + ' of ' + face.suit, value: { deck: 'french', ...face } })),
}));

import { styled } from '@jfrader/ui';
const SizedStack = styled(GameCardStack)({ inlineSize: 640, maxInlineSize: '100%', blockSize: 360 });

<SizedStack piles={piles} />` } } },
};

/** Six player piles fitted within a large grid container. */
export const GridSixLarge: Story = {
  name: 'Six cards · large',
  ...grid(6, 900, 432),
  parameters: { stage: 'none', docs: { source: { language: 'tsx', code: `import { GameCardStack } from '@jfrader/ui/game-card-stack';

const faces = [{ rank: 'A', suit: 'spades' }, { rank: 'Q', suit: 'hearts' }, { rank: 'K', suit: 'clubs' }];
const piles = ['North', 'East', 'South', 'West', 'Avery', 'Robin'].map((playerKey, index) => ({
  playerKey, label: playerKey + "'s played cards",
  cards: faces.map((face, round) => ({ id: 'play-' + index + '-' + round,
    label: face.rank + ' of ' + face.suit, value: { deck: 'french', ...face } })),
}));

import { styled } from '@jfrader/ui';
const SizedStack = styled(GameCardStack)({ inlineSize: 900, maxInlineSize: '100%', blockSize: 432 });

<SizedStack piles={piles} />` } } },
};

/** Four player piles fitted within a compact grid container. */
export const GridFourCompact: Story = {
  name: 'Four cards · compact',
  ...grid(4, 320, 280),
  parameters: { stage: 'none', docs: { source: { language: 'tsx', code: `import { GameCardStack } from '@jfrader/ui/game-card-stack';

const faces = [{ rank: 'A', suit: 'spades' }, { rank: 'Q', suit: 'hearts' }, { rank: 'K', suit: 'clubs' }];
const piles = ['North', 'East', 'South', 'West'].map((playerKey, index) => ({
  playerKey, label: playerKey + "'s played cards",
  cards: faces.map((face, round) => ({ id: 'play-' + index + '-' + round,
    label: face.rank + ' of ' + face.suit, value: { deck: 'french', ...face } })),
}));

import { styled } from '@jfrader/ui';
const SizedStack = styled(GameCardStack)({ inlineSize: 320, maxInlineSize: '100%', blockSize: 280 });

<SizedStack piles={piles} />` } } },
};

/** Four player piles fitted within a medium grid container. */
export const GridFourMedium: Story = {
  name: 'Four cards · medium',
  ...grid(4, 640, 360),
  parameters: { stage: 'none', docs: { source: { language: 'tsx', code: `import { GameCardStack } from '@jfrader/ui/game-card-stack';

const faces = [{ rank: 'A', suit: 'spades' }, { rank: 'Q', suit: 'hearts' }, { rank: 'K', suit: 'clubs' }];
const piles = ['North', 'East', 'South', 'West'].map((playerKey, index) => ({
  playerKey, label: playerKey + "'s played cards",
  cards: faces.map((face, round) => ({ id: 'play-' + index + '-' + round,
    label: face.rank + ' of ' + face.suit, value: { deck: 'french', ...face } })),
}));

import { styled } from '@jfrader/ui';
const SizedStack = styled(GameCardStack)({ inlineSize: 640, maxInlineSize: '100%', blockSize: 360 });

<SizedStack piles={piles} />` } } },
};

/** Four player piles fitted within a large grid container. */
export const GridFourLarge: Story = {
  name: 'Four cards · large',
  ...grid(4, 900, 432),
  parameters: { stage: 'none', docs: { source: { language: 'tsx', code: `import { GameCardStack } from '@jfrader/ui/game-card-stack';

const faces = [{ rank: 'A', suit: 'spades' }, { rank: 'Q', suit: 'hearts' }, { rank: 'K', suit: 'clubs' }];
const piles = ['North', 'East', 'South', 'West'].map((playerKey, index) => ({
  playerKey, label: playerKey + "'s played cards",
  cards: faces.map((face, round) => ({ id: 'play-' + index + '-' + round,
    label: face.rank + ' of ' + face.suit, value: { deck: 'french', ...face } })),
}));

import { styled } from '@jfrader/ui';
const SizedStack = styled(GameCardStack)({ inlineSize: 900, maxInlineSize: '100%', blockSize: 432 });

<SizedStack piles={piles} />` } } },
};

/** Two player piles fitted within a compact grid container. */
export const GridTwoCompact: Story = {
  name: 'Two cards · compact',
  ...grid(2, 320, 280),
  parameters: { stage: 'none', docs: { source: { language: 'tsx', code: `import { GameCardStack } from '@jfrader/ui/game-card-stack';

const faces = [{ rank: 'A', suit: 'spades' }, { rank: 'Q', suit: 'hearts' }, { rank: 'K', suit: 'clubs' }];
const piles = ['North', 'East'].map((playerKey, index) => ({
  playerKey, label: playerKey + "'s played cards",
  cards: faces.map((face, round) => ({ id: 'play-' + index + '-' + round,
    label: face.rank + ' of ' + face.suit, value: { deck: 'french', ...face } })),
}));

import { styled } from '@jfrader/ui';
const SizedStack = styled(GameCardStack)({ inlineSize: 320, maxInlineSize: '100%', blockSize: 280 });

<SizedStack piles={piles} />` } } },
};

/** Two player piles fitted within a medium grid container. */
export const GridTwoMedium: Story = {
  name: 'Two cards · medium',
  ...grid(2, 640, 360),
  parameters: { stage: 'none', docs: { source: { language: 'tsx', code: `import { GameCardStack } from '@jfrader/ui/game-card-stack';

const faces = [{ rank: 'A', suit: 'spades' }, { rank: 'Q', suit: 'hearts' }, { rank: 'K', suit: 'clubs' }];
const piles = ['North', 'East'].map((playerKey, index) => ({
  playerKey, label: playerKey + "'s played cards",
  cards: faces.map((face, round) => ({ id: 'play-' + index + '-' + round,
    label: face.rank + ' of ' + face.suit, value: { deck: 'french', ...face } })),
}));

import { styled } from '@jfrader/ui';
const SizedStack = styled(GameCardStack)({ inlineSize: 640, maxInlineSize: '100%', blockSize: 360 });

<SizedStack piles={piles} />` } } },
};

/** Two player piles fitted within a large grid container. */
export const GridTwoLarge: Story = {
  name: 'Two cards · large',
  ...grid(2, 900, 432),
  parameters: { stage: 'none', docs: { source: { language: 'tsx', code: `import { GameCardStack } from '@jfrader/ui/game-card-stack';

const faces = [{ rank: 'A', suit: 'spades' }, { rank: 'Q', suit: 'hearts' }, { rank: 'K', suit: 'clubs' }];
const piles = ['North', 'East'].map((playerKey, index) => ({
  playerKey, label: playerKey + "'s played cards",
  cards: faces.map((face, round) => ({ id: 'play-' + index + '-' + round,
    label: face.rank + ' of ' + face.suit, value: { deck: 'french', ...face } })),
}));

import { styled } from '@jfrader/ui';
const SizedStack = styled(GameCardStack)({ inlineSize: 900, maxInlineSize: '100%', blockSize: 432 });

<SizedStack piles={piles} />` } } },
};

/** Piles positioned using caller-provided normalized coordinates. */
export const FreePlacement: Story = {
  name: 'Free placement',
  args: {
    placement: 'free',
    piles: players(2, 3).map((pile, index) => ({
      ...pile,
      geometry: { cos: index ? 0.5 : -0.5, sin: 0, sideStrength: 1 },
    })),
  },
  parameters: {
    docs: {
      description: { story: 'Place two piles with application-owned geometry.' },
      source: {
        language: 'tsx',
        code: `import { styled } from '@jfrader/ui';
import { GameCardStack, type GameCardStackPile } from '@jfrader/ui/game-card-stack';

const faces = [{ rank: 'A', suit: 'spades' }, { rank: 'Q', suit: 'hearts' }, { rank: 'K', suit: 'clubs' }];
const piles: GameCardStackPile[] = ['North', 'East'].map((playerKey, index) => ({
  playerKey, label: playerKey + "'s played cards",
  geometry: { cos: index ? 0.5 : -0.5, sin: 0, sideStrength: 1 },
  cards: faces.map((face, round) => ({
    id: 'play-' + index + '-' + round, label: face.rank + ' of ' + face.suit,
    value: { deck: 'french', ...face },
  })),
}));

const StackFrame = styled.div({ inlineSize: '100%', maxInlineSize: 640, blockSize: 360, marginInline: 'auto' });

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

/** An individual played card pile rendered outside a stack container. */
export const StandalonePile: Story = {
  name: 'Standalone pile',
  parameters: {
    stage: 'pile',
    docs: {
      description: { story: 'Inspect a single pile without a stack container.' },
      source: {
        language: 'tsx',
        code: `import { styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';
import { GameCardStack, type GameCardStackPile } from '@jfrader/ui/game-card-stack';

const pile: GameCardStackPile = {
  playerKey: 'North',
  label: "North's played cards",
  cards: [
    { id: 'play-0-0', label: 'A of spades', value: { deck: 'french', suit: 'spades', rank: 'A' } },
    { id: 'play-0-1', label: 'Q of hearts', value: { deck: 'french', suit: 'hearts', rank: 'Q' } },
    { id: 'play-0-2', label: 'K of clubs', value: { deck: 'french', suit: 'clubs', rank: 'K' } },
  ],
};

const PileFrame = styled.div({ inlineSize: vars.size.gameCardMd, aspectRatio: '72 / 106', marginInline: 'auto', marginBlock: vars.space[12] });

export function StandalonePileExample() {
  return <PileFrame>
    <GameCardStack.Pile {...pile} onOpenChange={(open) => console.log('Inspecting:', open)} />
  </PileFrame>;
}`,
      },
    },
  },
  render: (args) => (
    <PileFrame>
      <GameCardStack.Pile {...args.piles[0]!}
        onOpenChange={(open) => args.onValueChange?.(open ? args.piles[0]!.playerKey : null)} />
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
  tags: ['!autodocs'], parameters: { stage: 'pile' },
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

/** Two-player truco with Spanish-deck cards and a pile in front of each seat. */
export const Default: Story = {
  name: 'Piles at table seats',
  render: () => <GameTable places={2}
    seats={[{ key: 'Ana', teamIdx: 0, isMe: true }, { key: 'Luis', teamIdx: 1 }]}
  >
    {spanishPiles.map((pile) => <GameTable.Seat key={pile.playerKey} slotKey={pile.playerKey}>
      <GameSeat name={pile.playerKey} handCount={3} />
    </GameTable.Seat>)}
    {spanishPiles.map((pile) => <GameTable.Play key={pile.playerKey} slotKey={pile.playerKey}>
      <GameCardStack.Pile {...pile} backPattern={CARD_BACK_PATTERNS.spanish} />
    </GameTable.Play>)}
  </GameTable>,
  parameters: {
    stage: 'table',
    docs: {
      description: { story: 'Two-player truco with Spanish-deck cards and a pile in front of each seat.' },
      source: {
        language: 'tsx',
        code: `import { styled } from '@jfrader/ui';
import { CARD_BACK_PATTERNS } from '@jfrader/ui/game-card';
import { GameCardStack, type GameCardStackPile } from '@jfrader/ui/game-card-stack';
import { GameTable } from '@jfrader/ui/game-table';
import { GameSeat } from '@jfrader/ui/game-seat';

const TableFrame = styled.div({
  inlineSize: '100%', maxInlineSize: 640, blockSize: 640, marginInline: 'auto',
  '@media (max-width: 30rem)': { blockSize: 360 },
});

const spanishPiles: readonly GameCardStackPile[] = [
  { playerKey: 'Ana', label: 'Cartas jugadas de Ana', cards: [{ id: 'ana-play-1', label: 'as de oros', value: { deck: 'spanish', suit: 'oros', rank: 1 } }] },
  { playerKey: 'Luis', label: 'Cartas jugadas de Luis', cards: [{ id: 'luis-play-1', label: 'sota de copas', value: { deck: 'spanish', suit: 'copas', rank: 10 } }] },
];

export function TrucoTable() {
  return (
    <TableFrame>
      <GameTable
        places={2}
        seats={[{ key: 'Ana', teamIdx: 0, isMe: true }, { key: 'Luis', teamIdx: 1 }]}
      >
        {spanishPiles.map((pile) => (
          <GameTable.Seat key={pile.playerKey} slotKey={pile.playerKey}>
            <GameSeat name={pile.playerKey} handCount={3} />
          </GameTable.Seat>
        ))}
        {spanishPiles.map((pile) => (
          <GameTable.Play key={pile.playerKey} slotKey={pile.playerKey}>
            <GameCardStack.Pile {...pile} backPattern={CARD_BACK_PATTERNS.spanish} />
          </GameTable.Play>
        ))}
      </GameTable>
    </TableFrame>
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
