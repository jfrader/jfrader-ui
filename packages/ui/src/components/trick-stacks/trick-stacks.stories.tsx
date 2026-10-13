import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, spyOn, waitFor } from 'storybook/test';
import { base } from '@jfrader/tokens';
import { expectInside, expectNoOverlap, expectMirroredDirection } from '../../testing/geometry-assertions';
import { motionDurationMs } from '../../styling/motion-timings';
import { settleMotion } from '../../testing/motion-assertions';
import { CARD_FRAME } from '../game-card/card-frame';
import { Button } from '../button';
import { TrickStacks, getTrickCardKey, type TrickPlayerStack, type TrickStacksProps } from './index';
import { getStackOffset, getStableRotation, getStableJitter, getPlayerStackPosition,
  buildTrickPlayOrder, getPlayerTableCards, TRICK_STACK } from './trick-layout';
import parity from './trick-layout.parity.json';
import referenceBoard from './reference-board.parity.json';

const names = ['North', 'East', 'South', 'West', 'Avery', 'Robin'];
const suits = ['spades', 'hearts', 'clubs'] as const;
const ranks = ['A', 'Q', 'K'] as const;
function players(count: number, cards: number): TrickPlayerStack[] {
  return Array.from({ length: count }, (_, index) => {
    return { playerKey: names[index]!,
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
  args: { stacks: defaultStacks, labels: labels(defaultStacks), viewport: { width: 1440, height: 900 }, onInspect: fn() },
  decorators: [(Story) => <div style={{ inlineSize: 'min(900px, 100%)', marginInline: 'auto', blockSize: 432 }}><Story /></div>],
  beforeEach: () => mockPreference(),
  parameters: { layout: 'fullscreen', docs: {
    description: { component: 'Keep played cards on the table, grouped by player. Open a stack to read its cards.' },
    usage: `### Cards and placement
- Pass \`stacks\` in GameTable's visual seat order. The first three cards per player stay mounted. Include empty stacks to reserve each player's position while cards arrive.
- Supply translated \`labels.stacks\` by player key and \`labels.cards\` by \`getTrickCardKey\`. Poker faces are the default examples; GameCard also accepts Spanish values.
- \`getPlayerTableCards\` groups round data and appends explicit revealed cards without duplicates. It reads no session or game state.
- \`revealedKeys\` keeps those players' cards spread at normal width. Inspection enlarges width by 1.45 and spreads by 0.52 card widths.
- The default \`placement="reference"\` preserves the original board's fixed seat positions, center presets and played-card widths. Pass the same \`viewport\` as GameTable; it selects the original device profile without measuring or rearranging the table.
- The root fills its parent. Give the parent a definite width and height. Reference card widths use CSS viewport units, so \`viewport\` should describe that same browser viewport.
- Opt into \`placement="auto-fit"\` to measure the table, choose rows and columns, and shrink cards when necessary. Every cell reserves space for a three-card inspected fan, including rotation and jitter; opening a stack does not move its neighbours. This changes the original arrangement.
- \`cardWidth\` overrides the original width; in \`auto-fit\` mode it is a preferred width, not a minimum. Buttons have a minimum 32px hit area; extremely small fitted tables can overlap those targets, so give the table more space.
- \`geometry\` and \`layout\` explicitly override reference placement. A supplied geometry opts that stack out of automatic fitting. Mixing fixed and fitted stacks can overlap; the caller owns those positions.
- \`data-ui="trick-stack"\` and \`data-trick-key\` mark stack and card destinations for caller-owned flights. Pass \`playOrder\` from \`buildTrickPlayOrder\` for global closed-card layering.

### Inspection and keyboard
- [APG disclosure](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/) trigger with \`aria-expanded\` and \`aria-controls\`; no grid or application role. Tab reaches each stack. Enter or Space opens or closes inspection; Escape closes and returns focus to the stack button after acceptance.
- Use \`defaultValue\` for uncontrolled inspection or \`value\` and \`onInspect\` for controlled inspection. A key opens that player; \`null\` closes. Only one player is inspected at a time.
- Automatically revealed cards stay spread after inspection closes; \`aria-expanded\` tracks inspection, not automatic revelation. Closed cards remain visible and available to assistive technology.
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
      await expectNoOverlap(stacks[first]!.querySelector('button')!, stacks[second]!.querySelector('button')!);
    for (const a of stacks[first]!.querySelectorAll('[data-trick-key]')) {
        for (const b of stacks[second]!.querySelectorAll('[data-trick-key]')) await expectNoOverlap(a, b);
      }
    }
  }
}

async function fittedViewports(root: HTMLElement, inspect: (button: HTMLElement) => Promise<void>) {
  const table = root.querySelector<HTMLElement>('[data-ui="trick-stacks"]')!;
  const original = table.getAttribute('style');
  const stackBoxes = () => {
    const frame = table.getBoundingClientRect();
    return [...table.querySelectorAll('[data-ui="trick-stack"]')].map((stack) => {
      const box = stack.getBoundingClientRect();
      return { x: box.left - frame.left, y: box.top - frame.top, width: box.width, height: box.height };
    });
  };
  try {
    for (const [width, height] of [[320, 280], [640, 360], [900, 432]]) {
      table.style.inlineSize = `${width}px`;
      table.style.blockSize = `${height}px`;
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      for (const button of table.querySelectorAll<HTMLButtonElement>('button')) {
        const before = stackBoxes();
        await inspect(button);
        await settleMotion(table);
        await waitFor(async () => {
          for (const card of table.querySelectorAll('[data-trick-key]')) await expectInside(card, table);
        });
        await expect(stackBoxes()).toEqual(before);
        await noOverlap(table);
      }
    }
  } finally {
    if (original === null) table.removeAttribute('style');
    else table.setAttribute('style', original);
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
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await expect(args.onInspect).toHaveBeenNthCalledWith(1, 'North');
    const cards = trigger.ownerDocument.getElementById(trigger.getAttribute('aria-controls')!)!;
    await expect(cards.querySelectorAll('[data-trick-key]')).toHaveLength(3);
    cards.tabIndex = -1;
    cards.focus();
    await userEvent.keyboard('{Escape}');
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(trigger.ownerDocument.activeElement).toBe(trigger);
    await expect(args.onInspect).toHaveBeenNthCalledWith(2, null);
    await userEvent.keyboard(' ');
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await userEvent.keyboard(' ');
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
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
export const TwoVersusTwo: Story = {
  args: counts(4, 3),
  play: async ({ canvasElement }) => noOverlap(canvasElement),
};
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
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(stack).toHaveAttribute('data-spread', 'true');
    await noOverlap(canvasElement);
  },
};
export const LightTheme: Story = { globals: { theme: 'light' } };
export const OpenLightTheme: Story = { args: { defaultValue: 'North' }, globals: { theme: 'light' } };
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
  parameters: { docs: { source: { code: `<TrickStacks viewport={viewport} stacks={stacks} labels={labels}
  value={inspectedPlayer} onInspect={setInspectedPlayer}
  revealedKeys={revealedPlayerKeys} />` } } },
  play: async ({ canvas, userEvent, args }) => {
    const trigger = canvas.getByRole('button', { name: "North's played cards" });
    await userEvent.click(trigger);
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await userEvent.keyboard('{Escape}');
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
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
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
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
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
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
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await expect(getComputedStyle(card).transitionDuration).toBe('0s');
    await expect(Number.parseFloat(getComputedStyle(card).width)).toBeCloseTo(cssWidth * parity.constants.openScale, 1);
    await expect(card.getBoundingClientRect().width).not.toBe(width);
    await userEvent.keyboard('{Escape}');
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
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

function ReferenceBoardCases(args: TrickStacksProps) {
  return <>
    {referenceBoard.cases.map((reference) => {
      const stacks = players(reference.players, 3);
      return (
        <div key={`${reference.profile}-${reference.players}`} data-reference-profile={reference.profile}
          data-reference-players={reference.players}
          style={{ position: 'relative', inlineSize: 900, maxInlineSize: '100%', blockSize: 432 }}>
          <TrickStacks {...args} viewport={reference.viewport} stacks={stacks} labels={labels(stacks)} />
          <div aria-hidden="true" data-reference-size="" style={{ position: 'absolute', visibility: 'hidden',
            inlineSize: reference.cardWidth, blockSize: `calc(${reference.cardWidth} * ${CARD_FRAME.ratio})` }} />
        </div>
      );
    })}
  </>;
}

export const DefaultReferenceParity: Story = {
  render: (args) => <ReferenceBoardCases {...args} />,
  parameters: { docs: { source: { code: '<TrickStacks viewport={viewport} stacks={stacks} labels={labels} />' } } },
  play: async ({ canvasElement }) => {
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    const measurements = referenceBoard.cases.map((reference) => {
      const container = canvasElement.querySelector<HTMLElement>(`[data-reference-profile="${reference.profile}"][data-reference-players="${reference.players}"]`)!;
      const root = container.querySelector<HTMLElement>('[data-ui="trick-stacks"]')!;
      const frame = container.getBoundingClientRect();
      const expectedSize = container.querySelector('[data-reference-size]')!.getBoundingClientRect();
      return { reference, root, frame, expectedSize, measured: reference.positions.map((expected) => {
        const stack = root.querySelector<HTMLElement>(`[data-ui="trick-stack"][data-player-key="${expected.playerKey}"]`)!;
        const box = stack.getBoundingClientRect();
        return { playerKey: expected.playerKey, x: (box.left + box.width / 2 - frame.left) / frame.width * 100,
          y: (box.top + box.height / 2 - frame.top) / frame.height * 100, width: box.width, height: box.height };
      }) };
    });
    console.info('DEFAULT_RENDERED_VS_REFERENCE', JSON.stringify({ browserViewport: { width: window.innerWidth, height: window.innerHeight },
      cases: measurements.filter(({ reference }) => reference.profile === 'desktop').map(({ reference, expectedSize, measured }) => ({
        players: reference.players, reference: reference.positions.map(({ playerKey, x, y }) => ({ playerKey, x, y })),
        referenceSize: { width: expectedSize.width, height: expectedSize.height }, measured,
      })) }));
    for (const { reference, root, frame, expectedSize, measured } of measurements) {
      await expect(root.getBoundingClientRect().width).toBe(frame.width);
      await expect(root.getBoundingClientRect().height).toBe(frame.height);
      for (const [index, expected] of reference.positions.entries()) {
        const actual = measured[index]!;
        await expect(Math.abs(actual.x - expected.x) * frame.width / 100, `${reference.profile}/${reference.players}/${expected.playerKey}: x`).toBeLessThanOrEqual(1);
        await expect(Math.abs(actual.y - expected.y) * frame.height / 100, `${reference.profile}/${reference.players}/${expected.playerKey}: y`).toBeLessThanOrEqual(1);
        await expect(actual.width).toBeCloseTo(expectedSize.width, 1);
        await expect(actual.height).toBeCloseTo(expectedSize.height, 1);
        const trigger = root.querySelector<HTMLButtonElement>(`[data-player-key="${expected.playerKey}"] button`)!;
        await expect(trigger.getBoundingClientRect().width).toBeGreaterThanOrEqual(Number.parseFloat(base.size.gameCardSm));
        await expect(trigger.getBoundingClientRect().height).toBeGreaterThanOrEqual(Number.parseFloat(base.size.gameCardSm));
        for (const card of expected.cards) {
          const element = root.querySelector<HTMLElement>(`[data-trick-key="${card.key}"]`)!;
          const style = getComputedStyle(element);
          const width = Number.parseFloat(style.width);
          const height = Number.parseFloat(style.height);
          const matrix = new DOMMatrixReadOnly(style.transform);
          await expect(width).toBeCloseTo(expectedSize.width, 1);
          await expect(height).toBeCloseTo(expectedSize.height, 1);
          await expect(matrix.m41).toBeCloseTo(-width / 2 + card.xOffset, 1);
          await expect(matrix.m42).toBeCloseTo(-height / 2 + card.yOffset, 1);
          await expect(Math.atan2(matrix.m12, matrix.m11) * 180 / Math.PI).toBeCloseTo(card.rotation, 2);
          const box = element.getBoundingClientRect();
          const radians = card.rotation * Math.PI / 180;
          await expect(box.left + box.width / 2).toBeCloseTo(frame.left + frame.width * expected.x / 100 + card.xOffset, 1);
          await expect(box.top + box.height / 2).toBeCloseTo(frame.top + frame.height * expected.y / 100 + card.yOffset, 1);
          await expect(box.width).toBeCloseTo(expectedSize.width * Math.abs(Math.cos(radians)) + expectedSize.height * Math.abs(Math.sin(radians)), 1);
          await expect(box.height).toBeCloseTo(expectedSize.height * Math.abs(Math.cos(radians)) + expectedSize.width * Math.abs(Math.sin(radians)), 1);
        }
      }
    }
  },
};

export const RenderedGeometry: Story = {
  beforeEach: () => mockPreference(false),
  play: async ({ canvas, canvasElement, userEvent }) => {
    const trigger = canvas.getByRole('button', { name: "North's played cards" });
    const stack = trigger.parentElement!;
    const cards = [...stack.querySelectorAll<HTMLElement>('[data-trick-key]')];
    const reference = referenceBoard.cases.find((entry) => entry.profile === 'desktop' && entry.players === 2)!;
    const probe = canvasElement.ownerDocument.createElement('div');
    probe.style.position = 'absolute';
    probe.style.visibility = 'hidden';
    probe.style.inlineSize = reference.cardWidth;
    canvasElement.append(probe);
    const referenceWidth = probe.getBoundingClientRect().width;
    probe.remove();
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
        await expect(width).toBeCloseTo(referenceWidth * (open ? parity.constants.openScale : 1), 1);
        await expect(Number.parseFloat(style.height)).toBeCloseTo(width * CARD_FRAME.ratio, 1);
        await expect(style.transitionProperty).toBe('transform, width, height, box-shadow');
        await expect(style.transitionDuration).toBe(Array(4).fill(`${motionDurationMs.trickStack / 1000}s`).join(', '));
        await expect(style.transitionTimingFunction).toBe([
          ...Array(3).fill(base.motion.easeTrickStack), base.motion.easeTrickStackShadow,
        ].join(', '));
        const transform = new DOMMatrixReadOnly(style.transform);
        await expect(transform.m41).toBeCloseTo(-width / 2 + jitter.jitter.x + offset.xPx + width * offset.xCardWidths, 1);
        await expect(transform.m42).toBeCloseTo(-Number.parseFloat(style.height) / 2 + jitter.jitter.y + offset.y, 1);
        await expect(Math.atan2(transform.m12, transform.m11) * 180 / Math.PI).toBeCloseTo(rotation.rotation, 2);
      }
    }
    await noOverlap(canvasElement);
  },
};
function GrowingHandFixture(args: TrickStacksProps) {
  const [showFirst, setShowFirst] = useState(true);
  return <>
    <TrickStacks {...args} stacks={args.stacks.map((stack, index) => index === 0 && !showFirst ? { ...stack, cards: [] } : stack)} />
    <Button onClick={() => setShowFirst(!showFirst)}>{showFirst ? 'Remove North cards' : 'Restore North cards'}</Button>
  </>;
}

export const MaximumThree: Story = {
  args: counts(2, 4),
  render: (args) => <GrowingHandFixture {...args} />,
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    if (args.placement === 'auto-fit') {
      await waitFor(() => expect(canvasElement.querySelector('[data-ui="trick-stacks-stage"]')).toHaveAttribute('data-measured', 'true'));
    }
    for (const stack of canvasElement.querySelectorAll('[data-ui="trick-stack"]')) {
      await expect(stack.querySelectorAll('[data-trick-key]')).toHaveLength(3);
    }
    const east = canvasElement.querySelector('[data-ui="trick-stack"][data-player-key="East"]')!;
    const original = east.getBoundingClientRect().toJSON();
    await userEvent.click(canvas.getByRole('button', { name: 'Remove North cards' }));
    await expect(canvas.queryByRole('button', { name: "North's played cards" })).toBeNull();
    await expect(east.getBoundingClientRect().toJSON()).toEqual(original);
    await userEvent.click(canvas.getByRole('button', { name: 'Restore North cards' }));
    await expect(canvas.getAllByRole('img')).toHaveLength(6);
    await expect(east.getBoundingClientRect().toJSON()).toEqual(original);
  },
};

function AutoFitCases(args: TrickStacksProps) {
  return <>
    {[2, 4, 6].map((count) => {
      const stacks = players(count, 3);
      return <div key={count} data-auto-players={count} style={{ blockSize: 432 }}>
        <TrickStacks {...args} placement="auto-fit" stacks={stacks} labels={labels(stacks)} />
      </div>;
    })}
  </>;
}

export const AutoFit: Story = {
  render: (args) => <AutoFitCases {...args} />,
  parameters: { docs: {
    description: { story: 'Opt into measured grid placement. Cards shrink to leave room for inspected fans; this is not the reference arrangement.' },
    source: { code: '<TrickStacks viewport={viewport} placement="auto-fit" stacks={stacks} labels={labels} />' },
  } },
  play: async ({ canvasElement, userEvent }) => {
    for (const container of canvasElement.querySelectorAll<HTMLElement>('[data-auto-players]')) {
      await fittedViewports(container, (button) => userEvent.click(button));
    }
  },
};

export const AutoFitEmptySlots: Story = { ...MaximumThree, args: { ...counts(2, 4), placement: 'auto-fit' } };
export const AutoFitReducedMotion: Story = { ...ReducedMotion, args: { ...counts(6, 3), placement: 'auto-fit' } };
