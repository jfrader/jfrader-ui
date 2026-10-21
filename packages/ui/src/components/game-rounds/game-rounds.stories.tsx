import { createElement, type ComponentPropsWithRef } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, within } from 'storybook/test';
import { GameRounds, type GameRoundsPartProps } from './index';
import { styled } from '../../index';
import { vars } from '@jfrader/tokens/vars';
import { expectAligned, expectInside } from '../../testing/geometry-assertions';

const RoundDemo = styled.div({ inlineSize: `calc(12 * ${vars.space[12]})`, maxInlineSize: '100%', marginInline: 'auto' });
const PhoneRoundDemo = styled.div({ inlineSize: `calc(7 * ${vars.space[12]} + ${vars.space[4]})`, maxInlineSize: '100%', marginInline: 'auto' });

const rounds = [
  { key: 'first', label: 'Opening', outcome: 'won' },
  { key: 'second', label: 'Middle', outcome: 'lost' },
  { key: 'third', label: 'Lead', outcome: 'pending', current: true, trump: '♠' },
  { key: 'fourth', label: 'Next', outcome: 'pending' },
  { key: 'fifth', label: 'Final', outcome: 'pending' },
] as const;
const outcomeLabels = { won: 'Ganada', lost: 'Perdida', pending: 'Pendiente' };
const source = `import { GameRounds } from '@jfrader/ui/game-rounds';

<GameRounds label="Rounds" rounds={[
  { key: 'first', label: 'Opening', outcome: 'won' },
  { key: 'second', label: 'Middle', outcome: 'lost' },
  { key: 'third', label: 'Lead', outcome: 'pending', current: true, trump: '♠' },
  { key: 'fourth', label: 'Next', outcome: 'pending' },
  { key: 'fifth', label: 'Final', outcome: 'pending' },
]} outcomeLabels={{ won: 'Won', lost: 'Lost', pending: 'Pending' }} />`;
const meta = {
  title: 'Games/GameRounds', component: GameRounds, tags: ['autodocs'],
  args: { label: 'Rounds', rounds, outcomeLabels },
  parameters: { docs: {
    description: { component: 'Show each round and its result in play order.' },
    sections: [
      { title: 'Round leads', stories: ['Default'] },
    ],
    usage: `### Results
Keep rounds in play order and give every result a nonempty name in your game's language. Result text and a shape accompany each result on one baseline: won rounds show a filled disc, lost rounds an open diamond and pending rounds a thin ring. The current round is underlined. Your application owns game rules and result transitions.

The strip uses a raised panel. Set surface="transparent" when composing inside an existing surface.

### Keyboard and accessibility

The named group contains an ordered list and preserves input order in RTL. It adds no keyboard commands, animation or live announcements. Announce result changes in your application when needed.`,
    source: { language: 'tsx', code: source },
  } },
} satisfies Meta<typeof GameRounds>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Display round history in play order with outcome tags. */
export const Default: Story = {
  name: 'Five-round lead strip',
  args: { outcomeLabels: { won: 'Won', lost: 'Lost', pending: 'Pending' } },
  render: (args) => <RoundDemo><GameRounds {...args} /></RoundDemo>,
  parameters: { layout: 'padded', docs: { description: { story: 'Read won, lost and pending rounds in play order.' } } },
  play: async ({ canvasElement }) => {
    const group = within(canvasElement).getByRole('group', { name: 'Rounds' });
    const items = within(group).getAllByRole('listitem');
    await expect(items.map((item) => item.getAttribute('data-outcome'))).toEqual(['won', 'lost', 'pending', 'pending', 'pending']);
    await expect(group).toHaveAttribute('data-game-material', 'panel');
    await expect(getComputedStyle(group).backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
    await expect(getComputedStyle(group).borderTopWidth).toBe('1px');
    await expect(items[0]).toHaveTextContent('1OpeningWon');
    await expect(items[2]).toHaveAttribute('aria-current', 'step');
    await expect(items[2]).toHaveTextContent('3Lead♠Pending');
    const pip = (item: Element) => getComputedStyle(item.querySelector('[data-ui="game-rounds-outcome"]')!, '::before');
    await expect(pip(items[0]!).backgroundColor).toBe(pip(items[0]!).borderTopColor);
    await expect(pip(items[1]!).transform).not.toBe('none');
    await expect(pip(items[3]!).backgroundColor).not.toBe(pip(items[3]!).borderTopColor);
    await expect(pip(items[3]!).transform).toBe('none');
    for (const item of items) await expect(getComputedStyle(item).borderTopWidth).toBe('0px');
    await expect(getComputedStyle(items[2]!.querySelector('[data-ui="game-rounds-head"]')!).borderBottomColor).not.toBe('rgba(0, 0, 0, 0)');
    await expect(getComputedStyle(items[2]!).backgroundColor).toBe('rgba(0, 0, 0, 0)');
    const list = within(group).getByRole('list');
    await expect(list).toBeVisible();
    await expect(list.tagName).toBe('OL');
    await expect(list).not.toHaveAttribute('role');
  },
};

export const ForcedColors: Story = {
  name: 'Game Rounds Forced Colors', tags: ['!autodocs'],
  play: async ({ canvas }) => {
    await expect(window.matchMedia('(forced-colors: active)').matches).toBe(true);
    const group = canvas.getByRole('group', { name: 'Rounds' });
    const items = within(group).getAllByRole('listitem');
    await expect(items).toHaveLength(5);
    await expect(items[2]).toHaveAttribute('aria-current', 'step');
    const head = getComputedStyle(items[2]!.querySelector('[data-ui="game-rounds-head"]')!);
    await expect(head.borderBottomStyle).toBe('solid');
    await expect(head.borderBottomWidth).toBe('2px');
    const inactiveHead = getComputedStyle(items[0]!.querySelector('[data-ui="game-rounds-head"]')!);
    const systemColor = group.ownerDocument.createElement('span');
    group.append(systemColor);
    try {
      systemColor.style.color = 'Canvas';
      await expect(inactiveHead.borderBottomColor).toBe(getComputedStyle(systemColor).color);
      systemColor.style.color = 'Highlight';
      await expect(head.borderBottomColor).toBe(getComputedStyle(systemColor).color);
    } finally {
      systemColor.remove();
    }
    for (const item of items) {
      const pip = getComputedStyle(item.querySelector('[data-ui="game-rounds-outcome"]')!, '::before');
      await expect(pip.borderTopStyle).toBe('solid');
      await expect(pip.borderTopColor).toBe(getComputedStyle(group).color);
    }
    await expect(items[0]).toHaveTextContent('Ganada');
    await expect(items[1]).toHaveTextContent('Perdida');
    await expect(items[2]).toHaveTextContent('Pendiente');
  },
};
export const CompactStrip: Story = {
  tags: ['!autodocs'], args: Default.args,
  parameters: { layout: 'padded' },
  render: (args) => <PhoneRoundDemo><GameRounds {...args} /></PhoneRoundDemo>,
  play: async ({ canvas, canvasElement }) => {
    const items = canvas.getAllByRole('listitem');
    const outcomes = items.map(item => item.querySelector('[data-ui="game-rounds-outcome"]')!);
    for (const item of items) {
      const label = item.querySelector('[data-ui="game-rounds-round-label"]')!;
      const range = canvasElement.ownerDocument.createRange();
      range.selectNodeContents(label);
      const rects = Array.from(range.getClientRects());
      await expect(rects.length).toBeGreaterThan(0);
      for (const rect of rects) await expect(rect.top).toBe(rects[0]!.top);
    }
    for (const outcome of outcomes) await expect(outcome.getBoundingClientRect().top).toBe(outcomes[0]!.getBoundingClientRect().top);
    const panel = canvas.getByRole('group', { name: 'Rounds' });
    await expect(panel.scrollWidth).toBeLessThanOrEqual(panel.clientWidth);
  },
};
export const LongContent: Story = {
  tags: ['!autodocs'],
  args: {
    rounds: rounds.map(round => ({ ...round, label: 'InternationalChampionshipFinalists' })),
    outcomeLabels: { won: 'ChampionshipVictory', lost: 'ChampionshipDefeat', pending: 'AwaitingChampionshipResult' },
  },
  render: (args) => <div style={{ inlineSize: 280, maxInlineSize: '100%' }}><GameRounds {...args} /></div>,
  play: async ({ canvas }) => {
    const panel = canvas.getByRole('group', { name: 'Rounds' });
    await expect(panel.scrollWidth).toBeLessThanOrEqual(panel.clientWidth);
    const items = canvas.getAllByRole('listitem');
    for (const item of items) {
      const outcome = item.querySelector<HTMLElement>('[data-ui="game-rounds-outcome"]')!;
      await expect(item.scrollWidth).toBeLessThanOrEqual(item.clientWidth + 1);
      await expectInside(outcome, item);
    }
    await expectAligned(items.map(item => item.querySelector('[data-ui="game-rounds-outcome"]')!), 'top');
  },
};

export const Boxes: Story = {
  tags: ['!autodocs'],
  args: { variant: 'boxes' },
  render: (args) => <div style={{ inlineSize: 280, maxInlineSize: '100%' }}><GameRounds {...args} /></div>,
  play: async ({ canvas }) => {
    const panel = canvas.getByRole('group', { name: 'Rounds' });
    await expect(panel.scrollWidth).toBeLessThanOrEqual(panel.clientWidth);
    for (const item of canvas.getAllByRole('listitem')) await expectInside(item, panel);
    await expect(canvas.getByText('Lead').closest('li')).toHaveAttribute('aria-current', 'step');
  },
};
export const ReducedMotion: Story = {
  name: 'Game Rounds Reduced Motion', tags: ['!autodocs'],
  play: async ({ canvas, canvasElement }) => {
    await expect(window.matchMedia('(prefers-reduced-motion: reduce)').matches).toBe(true);
    const list = canvas.getByRole('list');
    await expect(within(list).getAllByRole('listitem')).toHaveLength(5);
    await expect(list.querySelector('[aria-current="step"]')).toHaveTextContent('3Lead♠Pendiente');
    await expect(getComputedStyle(list).transitionDuration).toBe('0s');
    await expect(canvasElement.getAnimations({ subtree: true })).toHaveLength(0);
  },
};

/** Display round history in right-to-left reading order. */
export const LightRtl: Story = {
  tags: ['!autodocs'],
  name: 'Light and RTL',
  globals: { theme: 'light' }, args: { dir: 'rtl' },
  parameters: { docs: { source: { language: 'tsx', code: `import { GameRounds } from '@jfrader/ui/game-rounds';

<GameRounds label="Rounds" dir="rtl" rounds={[
  { key: 'first', label: 'Opening', outcome: 'won' },
  { key: 'second', label: 'Middle', outcome: 'lost' },
  { key: 'third', label: 'Final', outcome: 'pending' },
]} outcomeLabels={{ won: 'Ganada', lost: 'Perdida', pending: 'Pendiente' }} />` } } },
  play: async ({ canvasElement }) => {
    const group = within(canvasElement).getByRole('group', { name: 'Rounds' });
    await expect(getComputedStyle(group).direction).toBe('rtl');
    const items = within(group).getAllByRole('listitem');
    await expect(items[0]!.getBoundingClientRect().left).toBeGreaterThan(items[1]!.getBoundingClientRect().left);
    await expect(items.map((item) => item.getAttribute('data-outcome'))).toEqual(['won', 'lost', 'pending', 'pending', 'pending']);
  },
};

/** An empty round list without played rounds. */
export const Empty: Story = {
  tags: ['!autodocs'],
  name: 'No rounds',
  args: { rounds: [] },
  parameters: { docs: { description: { story: 'Keep the named round history before the first round is played.' }, source: { language: 'tsx', code: `import { GameRounds } from '@jfrader/ui/game-rounds';

<GameRounds label="Rounds" rounds={[]} outcomeLabels={{ won: 'Won', lost: 'Lost', pending: 'Pending' }} />` } } },
  play: async ({ canvasElement }) => {
    const group = within(canvasElement).getByRole('group', { name: 'Rounds' });
    await expect(within(group).queryAllByRole('listitem')).toHaveLength(0);
    await expect(within(group).getByRole('list')).toBeVisible();
  },
};

function ReplacementRound(props: ComponentPropsWithRef<'li'> & GameRoundsPartProps<'li'>) {
  return createElement('li', { ...props, 'data-replacement': 'custom-round', 'data-received-css': String(Object.hasOwn(props, 'css')) });
}

/** Supply a custom round element for won and lost rounds. */
export const RoundReplacement: Story = {
  tags: ['!autodocs'],
  name: 'Custom round',
  parameters: { docs: { description: { story: 'Render each result through a custom round element.' }, source: { language: 'tsx', code: `import type { ComponentPropsWithRef } from 'react';
import { GameRounds, type GameRoundsPartProps } from '@jfrader/ui/game-rounds';

function ReplacementRound(props: ComponentPropsWithRef<'li'> & GameRoundsPartProps<'li'>) {
  return <li {...props} data-replacement="custom-round" />;
}

<GameRounds
  label="Rounds"
  rounds={[
    { key: 'first', label: 'Opening', outcome: 'won' },
    { key: 'second', label: 'Middle', outcome: 'lost' },
  ]}
  outcomeLabels={{ won: 'Ganada', lost: 'Perdida', pending: 'Pendiente' }}
  slots={{ round: ReplacementRound }}
  slotProps={{
    round: {
      'data-ui': 'custom-round-ui',
    },
  }}
/>` } } },
  args: {
    label: 'Rounds',
    rounds: [
      { key: 'first', label: 'Opening', outcome: 'won' },
      { key: 'second', label: 'Middle', outcome: 'lost' },
    ],
    outcomeLabels: { won: 'Ganada', lost: 'Perdida', pending: 'Pendiente' },
    slots: { round: ReplacementRound },
    slotProps: {
      round: {
        ref: fn(),
        'data-ui': 'custom-round-ui',
      },
    },
  },
  play: async ({ canvasElement, args }) => {
    const group = within(canvasElement).getByRole('group', { name: 'Rounds' });
    const roundElements = group.querySelectorAll<HTMLElement>('[data-replacement="custom-round"]');
    await expect(roundElements).toHaveLength(2);
    const firstRound = roundElements[0]!;
    await expect(firstRound).toHaveAttribute('data-replacement', 'custom-round');
    await expect(firstRound.className).not.toBe('');
    await expect(firstRound).toHaveAttribute('data-received-css', 'false');
    await expect(getComputedStyle(firstRound).display).toBe('grid');
    await expect(firstRound).toHaveAttribute('data-ui', 'game-rounds-round custom-round-ui');
    await expect(args.slotProps?.round?.ref).toHaveBeenCalledWith(firstRound);
    await expect(firstRound).toHaveAttribute('data-outcome', 'won');
    await expect(roundElements[1]).toHaveAttribute('data-outcome', 'lost');
  },
};
