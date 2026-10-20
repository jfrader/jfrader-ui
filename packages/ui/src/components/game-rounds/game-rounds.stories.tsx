import type { ComponentPropsWithRef } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, within } from 'storybook/test';
import { GameRounds, type GameRoundsPartProps } from './index';


const rounds = [
  { key: 'first', label: 'Opening', outcome: 'won' },
  { key: 'second', label: 'Middle', outcome: 'lost' },
  { key: 'third', label: 'Final', outcome: 'pending' },
] as const;
const outcomeLabels = { won: 'Ganada', lost: 'Perdida', pending: 'Pendiente' };
const source = `import { GameRounds } from '@jfrader/ui/game-rounds';

<GameRounds label="Rounds" rounds={[
  { key: 'first', label: 'Opening', outcome: 'won' },
  { key: 'second', label: 'Middle', outcome: 'lost' },
  { key: 'third', label: 'Final', outcome: 'pending' },
]} outcomeLabels={{ won: 'Ganada', lost: 'Perdida', pending: 'Pendiente' }} />`;
const meta = {
  title: 'Games/GameRounds', component: GameRounds, tags: ['autodocs'],
  args: { label: 'Rounds', rounds, outcomeLabels },
  parameters: { docs: {
    description: { component: 'Show each round and its result in play order.' },
    usage: `### Results
Pass rounds in display order with stable keys, labels and won, lost or pending outcomes. Supply nonempty outcomeLabels in your game's language. Every result shows that text as well as its tone; pending also has a dashed boundary. No rules or automatic transitions run here.

### Accessibility
The named group contains an ordered list. There is no APG widget, focus target, keyboard binding, animation or live announcement. Choose announcements in your application. The list preserves input order in RTL.

### Customization
Use slotProps for root, label, list, round and outcome; each accepts sx. Repeated slots apply to every round; data-outcome remains authoritative. component is sugar for slots.root; slots.root wins. Replacements forward props and ref to one div. Root slot conflicts win; className and style merge. Consumer sx applies after slot sx.`,
    source: { language: 'tsx', code: source },
  } },
} satisfies Meta<typeof GameRounds>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Display round history in play order with outcome tags. */
export const Default: Story = {
  name: 'Default',
  play: async ({ canvasElement }) => {
    const group = within(canvasElement).getByRole('group', { name: 'Rounds' });
    const items = within(group).getAllByRole('listitem');
    await expect(items.map((item) => item.getAttribute('data-outcome'))).toEqual(['won', 'lost', 'pending']);
    await expect(items.map((item) => item.textContent)).toEqual(['OpeningGanada', 'MiddlePerdida', 'FinalPendiente']);
    await expect(getComputedStyle(items[2]!).borderTopStyle).toBe('dashed');
    await expect(within(group).getByRole('list')).toBeVisible();
  },
};

/** Display round history in right-to-left reading order. */
export const LightRtl: Story = {
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
    await expect(items.map((item) => item.getAttribute('data-outcome'))).toEqual(['won', 'lost', 'pending']);
  },
};

/** An empty round list without played rounds. */
export const Empty: Story = {
  name: 'No rounds',
  args: { rounds: [] },
  parameters: { docs: { source: { language: 'tsx', code: `import { GameRounds } from '@jfrader/ui/game-rounds';

<GameRounds label="Rounds" rounds={[]} outcomeLabels={{ won: 'Won', lost: 'Lost', pending: 'Pending' }} />` } } },
  play: async ({ canvasElement }) => {
    const group = within(canvasElement).getByRole('group', { name: 'Rounds' });
    await expect(within(group).queryAllByRole('listitem')).toHaveLength(0);
    await expect(within(group).getByRole('list')).toBeVisible();
  },
};

function ReplacementRound(props: ComponentPropsWithRef<'li'> & GameRoundsPartProps<'li'>) {
  return <li {...props} data-replacement="custom-round" />;
}

/** Supply a custom round element for won and lost rounds. */
export const RoundReplacement: Story = {
  name: 'Custom round',
  parameters: { docs: { source: { language: 'tsx', code: `import type { ComponentPropsWithRef } from 'react';
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
    await expect(firstRound).toHaveAttribute('data-ui', 'game-rounds-round custom-round-ui');
    await expect(args.slotProps?.round?.ref).toHaveBeenCalledWith(firstRound);
    await expect(firstRound).toHaveAttribute('data-outcome', 'won');
    await expect(roundElements[1]).toHaveAttribute('data-outcome', 'lost');
  },
};
