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
    sections: [
      { title: 'Round history', stories: ['Default', 'Empty'] },
      { title: 'Composition', stories: ['RoundReplacement'] },
    ],
    usage: `### Results
Keep rounds in play order and give every result a nonempty name in your game's language. Result text accompanies each tone; pending rounds also have a dashed boundary. Your application owns game rules and result transitions.

### Accessibility
The named group contains an ordered list and preserves input order in RTL. It adds no keyboard commands, animation or live announcements. Announce result changes in your application when needed.`,
    source: { language: 'tsx', code: source },
  } },
} satisfies Meta<typeof GameRounds>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Display round history in play order with outcome tags. */
export const Default: Story = {
  name: 'Round outcomes',
  parameters: { docs: { description: { story: 'Read won, lost and pending rounds in play order.' } } },
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
  parameters: { docs: { description: { story: 'Keep the named round history before the first round is played.' }, source: { language: 'tsx', code: `import { GameRounds } from '@jfrader/ui/game-rounds';

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
    await expect(firstRound).toHaveAttribute('data-ui', 'game-rounds-round custom-round-ui');
    await expect(args.slotProps?.round?.ref).toHaveBeenCalledWith(firstRound);
    await expect(firstRound).toHaveAttribute('data-outcome', 'won');
    await expect(roundElements[1]).toHaveAttribute('data-outcome', 'lost');
  },
};
