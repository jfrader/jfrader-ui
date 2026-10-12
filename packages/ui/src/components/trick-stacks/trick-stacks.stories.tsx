import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, spyOn } from 'storybook/test';
import { base } from '@jfrader/tokens';
import { withLightTheme } from '../../testing/story-decorators';
import { expectNoOverlap, expectMirroredDirection } from '../../testing/geometry-assertions';
import { settleMotion } from '../../testing/motion-assertions';
import { CARD_FRAME } from '../game-card/card-frame';
import { TrickStacks, getTrickCardKey, type TrickPlayerStack, type TrickStacksProps } from './index';
import { getStackOffset, getStableRotation, getStableJitter, getPlayerStackPosition,
  buildTrickPlayOrder, getPlayerTableCards, TRICK_STACK } from './trick-layout';
import parity from './trick-layout.parity.json';

const names = ['North', 'East', 'South', 'West', 'Avery', 'Robin'];
const suits = ['spades', 'hearts', 'clubs'] as const;
const ranks = ['A', 'Q', 'K'] as const;
function players(count: number, cards: number): TrickPlayerStack[] {
  return Array.from({ length: count }, (_, index) => {
    const angleDeg = 90 + index * 360 / count;
    const angle = angleDeg * Math.PI / 180;
    return { playerKey: names[index]!, geometry: { angleDeg, cos: Math.cos(angle), sin: Math.sin(angle), sideStrength: Math.abs(Math.cos(angle)) },
      cards: Array.from({ length: cards }, (_, roundIdx) => ({ roundIdx,
        card: `${suits[roundIdx % suits.length]}-${ranks[roundIdx % ranks.length]}`,
        value: { deck: 'french', suit: suits[roundIdx % suits.length]!, rank: ranks[roundIdx % ranks.length]! },
      })) };
  });
}
function labels(stacks: readonly TrickPlayerStack[]): TrickStacksProps['labels'] {
  return { stacks: Object.fromEntries(stacks.map(({ playerKey }) => [playerKey, `${playerKey}'s played cards`])),
    cards: Object.fromEntries(stacks.flatMap(({ playerKey, cards }) => cards.map((card) => [
      getTrickCardKey(card.roundIdx, { player: { key: playerKey }, card: card.card }),
      `${card.value?.rank} of ${card.value?.suit}`,
    ]))) };
}
const defaultStacks = players(2, 3);
const preference = { matches: false, media: null as MediaQueryList | null };
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
    if (!preference.media) throw new Error('Missing media preference');
    return preference.media;
  });
  return () => spy.mockRestore();
}

const meta = {
  title: 'Games/TrickStacks', component: TrickStacks, tags: ['autodocs'],
  args: { stacks: defaultStacks, labels: labels(defaultStacks), onInspect: fn() },
  decorators: [(Story) => <div style={{ inlineSize: 'min(900px, 100%)', marginInline: 'auto', paddingBlock: 24 }}><Story /></div>],
  beforeEach: () => mockPreference(),
  parameters: { layout: 'fullscreen', docs: {
    description: { component: 'Keep played cards on the table, grouped by player. Open a stack to read its cards.' },
    usage: `### Cards and placement
- Pass the current hand's cards in \`stacks\` with caller-owned seat geometry. The first three cards per player stay mounted; omit empty stacks.
- Supply translated \`labels.stacks\` by player key and \`labels.cards\` by \`getTrickCardKey\`. Poker faces are the default examples; GameCard also accepts Spanish values.
- \`getPlayerTableCards\` groups round data and appends explicit revealed cards without duplicates. It reads no session or game state.
- \`revealedKeys\` keeps those players' cards spread at normal width. Inspection enlarges width by 1.45 and spreads by 0.52 card widths.
- Use \`layout\` for placement, jitter and rotation; reserve enough table space for expanded cards. The root defaults to six card widths in height; override it with \`sx\`.
- \`data-ui="trick-stack"\` and \`data-trick-key\` mark stack and card destinations for caller-owned flights. Pass \`playOrder\` from \`buildTrickPlayOrder\` for global closed-card layering.

### Inspection and keyboard
- [APG toggle button](https://www.w3.org/WAI/ARIA/apg/patterns/button/) semantics; no grid or application role. Tab reaches each stack. Enter or Space toggles inspection; Escape closes and returns focus to the stack button after acceptance.
- Use \`defaultValue\` for uncontrolled inspection or \`value\` and \`onInspect\` for controlled inspection. A key opens that player; \`null\` closes. Only one player is inspected at a time.
- Automatically revealed cards stay spread after inspection closes; \`aria-pressed\` tracks inspection, not automatic revelation. Closed cards remain visible and available to assistive technology.
- Reduced motion changes size and placement immediately; opening, closing and focus never wait for an animation.`,
  } },
} satisfies Meta<typeof TrickStacks>;
export default meta;
type Story = StoryObj<typeof meta>;

async function noOverlap(root: HTMLElement) {
  await settleMotion(root);
  const table = root.matches('[data-ui="trick-stacks"]') ? root : root.querySelector('[data-ui="trick-stacks"]')!;
  await expect(table.getBoundingClientRect().width).toBeGreaterThan(0);
  const stacks = [...root.querySelectorAll('[data-ui="trick-stack"]')];
  for (let first = 0; first < stacks.length; first++) {
    for (let second = first + 1; second < stacks.length; second++) {
      await expectNoOverlap(stacks[first]!, stacks[second]!);
      for (const a of stacks[first]!.querySelectorAll('[data-trick-key]')) {
        for (const b of stacks[second]!.querySelectorAll('[data-trick-key]')) await expectNoOverlap(a, b);
      }
    }
  }
}

export const Default: Story = {
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    const trigger = canvas.getByRole('button', { name: "North's played cards" });
    await expect(canvas.getAllByRole('img')).toHaveLength(6);
    await userEvent.tab();
    await expect(trigger.ownerDocument.activeElement).toBe(trigger);
    await expect(getComputedStyle(trigger).outlineStyle).not.toBe('none');
    await userEvent.keyboard('{Enter}');
    await expect(trigger).toHaveAttribute('aria-pressed', 'true');
    await expect(args.onInspect).toHaveBeenNthCalledWith(1, 'North');
    const cards = trigger.ownerDocument.getElementById(trigger.getAttribute('aria-controls')!)!;
    await expect(cards.querySelectorAll('[data-trick-key]')).toHaveLength(3);
    cards.tabIndex = -1;
    cards.focus();
    await userEvent.keyboard('{Escape}');
    await expect(trigger).toHaveAttribute('aria-pressed', 'false');
    await expect(trigger.ownerDocument.activeElement).toBe(trigger);
    await expect(args.onInspect).toHaveBeenNthCalledWith(2, null);
    await userEvent.keyboard(' ');
    await expect(trigger).toHaveAttribute('aria-pressed', 'true');
    await userEvent.keyboard(' ');
    await expect(trigger).toHaveAttribute('aria-pressed', 'false');
    await expect(args.onInspect).toHaveBeenCalledTimes(4);
    await expect(canvas.getAllByRole('img')).toHaveLength(6);
    await noOverlap(canvasElement);
  },
};

function counts(count: number, cards: number) {
  const stacks = players(count, cards);
  return { stacks, labels: labels(stacks) };
}
export const OneCard: Story = { args: counts(2, 1), play: async ({ canvasElement }) => noOverlap(canvasElement) };
export const TwoCards: Story = { args: counts(2, 2), play: async ({ canvasElement }) => noOverlap(canvasElement) };
export const TwoVersusTwo: Story = { args: counts(4, 3), play: async ({ canvasElement }) => noOverlap(canvasElement) };
export const ThreeVersusThree: Story = {
  args: counts(6, 3),
  play: async ({ canvas, canvasElement, userEvent }) => {
    await noOverlap(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: "North's played cards" }));
    await noOverlap(canvasElement);
  },
};
export const Open: Story = { args: { defaultValue: 'North' }, play: async ({ canvasElement }) => noOverlap(canvasElement) };
export const RevealedHands: Story = {
  args: { ...counts(6, 3), revealedKeys: names },
  play: async ({ canvas, canvasElement, userEvent }) => {
    const trigger = canvas.getByRole('button', { name: "North's played cards" });
    const stack = trigger.parentElement!;
    await expect(stack).toHaveAttribute('data-spread', 'true');
    await userEvent.click(trigger);
    await userEvent.keyboard('{Escape}');
    await expect(trigger).toHaveAttribute('aria-pressed', 'false');
    await expect(stack).toHaveAttribute('data-spread', 'true');
    await noOverlap(canvasElement);
  },
};
export const LightTheme: Story = { decorators: [withLightTheme] };
export const OpenLightTheme: Story = { args: { defaultValue: 'North' }, decorators: [withLightTheme] };
export const RTL: Story = {
  args: { ...counts(6, 3), dir: 'rtl', defaultValue: 'East' },
  play: async ({ canvasElement }) => {
    const root = canvasElement.querySelector<HTMLElement>('[data-ui="trick-stacks"]')!;
    await expectMirroredDirection(root, '[data-trick-key]');
    await noOverlap(root);
  },
};

function ControlledFixture(args: TrickStacksProps) {
  const [value, setValue] = useState<string | null>(null);
  return <TrickStacks {...args} value={value} onInspect={(next) => { args.onInspect?.(next); setValue(next); }} />;
}
export const Controlled: Story = {
  render: (args) => <ControlledFixture {...args} />,
  parameters: { docs: { source: { code: `<TrickStacks stacks={stacks} labels={labels}
  value={inspectedPlayer} onInspect={setInspectedPlayer}
  revealedKeys={revealedPlayerKeys} />` } } },
  play: async ({ canvas, userEvent, args }) => {
    const trigger = canvas.getByRole('button', { name: "North's played cards" });
    await userEvent.click(trigger);
    await expect(trigger).toHaveAttribute('aria-pressed', 'true');
    await userEvent.keyboard('{Escape}');
    await expect(trigger).toHaveAttribute('aria-pressed', 'false');
    await expect(trigger).toHaveFocus();
    await expect(args.onInspect).toHaveBeenCalledTimes(2);
  },
};
export const RejectedControlledClose: Story = {
  args: { value: 'North' },
  play: async ({ canvas, userEvent, args }) => {
    const trigger = canvas.getByRole('button', { name: "North's played cards" });
    const other = canvas.getByRole('button', { name: "East's played cards" });
    other.focus();
    await userEvent.keyboard('{Escape}');
    await expect(trigger).toHaveAttribute('aria-pressed', 'true');
    await expect(other).toHaveFocus();
    await expect(args.onInspect).toHaveBeenCalledTimes(1);
    await expect(args.onInspect).toHaveBeenCalledWith(null);
  },
};
export const RejectedControlledOpen: Story = {
  args: { value: null },
  play: async ({ canvas, userEvent, args }) => {
    const trigger = canvas.getByRole('button', { name: "North's played cards" });
    await userEvent.click(trigger);
    await expect(trigger).toHaveAttribute('aria-pressed', 'false');
    await expect(args.onInspect).toHaveBeenCalledTimes(1);
    await expect(args.onInspect).toHaveBeenCalledWith('North');
  },
};
export const ReducedMotion: Story = {
  beforeEach: () => mockPreference(true),
  play: async ({ canvas, canvasElement, userEvent }) => {
    const trigger = canvas.getByRole('button', { name: "North's played cards" });
    const card = canvasElement.querySelector<HTMLElement>('[data-trick-key]')!;
    await expect(card).toHaveAttribute('data-reduced-motion', 'true');
    const width = card.getBoundingClientRect().width;
    const cssWidth = Number.parseFloat(getComputedStyle(card).width);
    await userEvent.click(trigger);
    await expect(trigger).toHaveAttribute('aria-pressed', 'true');
    await expect(getComputedStyle(card).transitionDuration).toBe('0s');
    await expect(Number.parseFloat(getComputedStyle(card).width)).toBeCloseTo(cssWidth * parity.constants.openScale, 1);
    await expect(card.getBoundingClientRect().width).not.toBe(width);
    await userEvent.keyboard('{Escape}');
    await expect(trigger).toHaveAttribute('aria-pressed', 'false');
    await expect(Number.parseFloat(getComputedStyle(card).width)).toBe(cssWidth);
    await expect(trigger).toHaveFocus();
  },
};

export const ReferenceParity: Story = {
  play: async () => {
    for (const { input, expected, yIsNegativeZero } of parity.offsets) {
      await expect(getStackOffset(input)).toEqual({ ...expected, y: yIsNegativeZero ? -0 : expected.y });
    }
    for (const { seed, rotation, jitter } of parity.stable) {
      await expect(getStableRotation({ seed, maxRotationOffsetDeg: 6 })).toBe(rotation);
      await expect(getStableRotation({ seed, maxRotationOffsetDeg: 6 })).toBe(rotation);
      await expect(getStableJitter({ seed, spread: 4 })).toEqual(jitter);
    }
    for (const { input, expected } of parity.positions) await expect(getPlayerStackPosition(input)).toEqual(expected);
    const rounds = parity.order.rounds;
    await expect(buildTrickPlayOrder(rounds)).toEqual(parity.order.expected);
    const reveal = Object.fromEntries(Object.entries(parity.grouping.revealed).map(([key, cards]) => [key, cards.map((card) => ({ card }))]));
    const grouped = getPlayerTableCards(rounds, reveal);
    const projected = Object.fromEntries(Object.entries(grouped.cardsByPlayerKey).map(([key, cards]) => [key,
      cards.map(({ roundIdx, card }) => ({ roundIdx, card }))]));
    await expect(projected).toEqual(parity.grouping.expectedCards);
    await expect([...grouped.revealedPlayerKeys]).toEqual(parity.grouping.expectedRevealedKeys);
    await expect(TRICK_STACK.openScale).toBe(parity.constants.openScale);
    await expect(TRICK_STACK.openSpreadRatio).toBe(parity.constants.openSpreadRatio);
  },
};

export const RenderedGeometry: Story = {
  beforeEach: () => mockPreference(false),
  play: async ({ canvas, canvasElement, userEvent }) => {
    const trigger = canvas.getByRole('button', { name: "North's played cards" });
    const stack = trigger.parentElement!;
    const cards = [...stack.querySelectorAll<HTMLElement>('[data-trick-key]')];
    for (const open of [false, true]) {
      if (open) await userEvent.click(trigger);
      await settleMotion(stack);
      for (const [index, card] of cards.entries()) {
        const key = card.dataset.trickKey!;
        const offset = parity.offsets.find((entry) => entry.input.total === 3 && entry.input.index === index && entry.input.open === open)!.expected;
        const rotation = parity.stable.find((entry) => entry.seed === (open ? `${key}:inspected` : key));
        const jitter = parity.stable.find((entry) => entry.seed === key);
        if (!rotation || !jitter) throw new Error(`Missing parity fixture for ${key}`);
        const style = getComputedStyle(card);
        const width = Number.parseFloat(style.width);
        await expect(width).toBeCloseTo(Number.parseFloat(base.size.gameCardMd) * (open ? parity.constants.openScale : 1), 1);
        await expect(Number.parseFloat(style.height)).toBeCloseTo(width * CARD_FRAME.ratio, 1);
        await expect(style.transitionProperty).toBe('transform, width, height, box-shadow');
        await expect(style.transitionDuration).toBe('0.19s, 0.19s, 0.19s, 0.19s');
        await expect(style.transitionTimingFunction).toBe('cubic-bezier(0.2, 0.8, 0.2, 1), cubic-bezier(0.2, 0.8, 0.2, 1), cubic-bezier(0.2, 0.8, 0.2, 1), ease');
        const transform = new DOMMatrixReadOnly(style.transform);
        await expect(transform.m41).toBeCloseTo(-width / 2 + jitter.jitter.x + offset.xPx + width * offset.xCardWidths, 1);
        await expect(transform.m42).toBeCloseTo(-Number.parseFloat(style.height) / 2 + jitter.jitter.y + offset.y, 1);
        await expect(Math.atan2(transform.m12, transform.m11) * 180 / Math.PI).toBeCloseTo(rotation.rotation, 2);
      }
    }
    await noOverlap(canvasElement);
  },
};
export const MaximumThree: Story = {
  args: counts(2, 4),
  play: async ({ canvasElement }) => {
    for (const stack of canvasElement.querySelectorAll('[data-ui="trick-stack"]')) {
      await expect(stack.querySelectorAll('[data-trick-key]')).toHaveLength(3);
    }
  },
};
