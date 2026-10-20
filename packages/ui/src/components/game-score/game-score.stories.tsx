import type { Meta, StoryObj } from '@storybook/react-vite';
import { useId, useRef, useState, type ComponentPropsWithRef } from 'react';
import { expect, fn, within } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { GameScore, type GameScorePartProps, type GameScoreTableSlotProps } from './index';

import { GameMarks } from '../game-marks';
import { GameRounds } from '../game-rounds';
import { Button } from '../button';
import type { GameCardRootProps } from '../game-card/game-card-root';
import { FORCED_COLORS } from '../../styling/media';
// `styled` is the app-facing styling API; consumers import it from `@jfrader/ui`.
import { styled } from '../../index';

const forcedColorStyle = { [FORCED_COLORS]: { color: 'CanvasText', backgroundColor: 'Canvas' } };
const Summary = styled.div({ display: 'grid', gap: vars.space[4] });
const ScoreboardDemo = styled.div({ inlineSize: `calc(12 * ${vars.space[12]})`, maxInlineSize: '100%', marginInline: 'auto' });
const ContractScope = styled.div(forcedColorStyle);
const ContractButton = styled(Button)(forcedColorStyle);

const rows = [
  { key: 'north', label: 'North', value: 1234.5, stage: 'Final' },
  { key: 'south', label: 'South', value: 0, stage: '' },
];
const source = `import { GameScore } from '@jfrader/ui/game-score';

<GameScore label="Score" locale="de-DE" rows={[
  { key: 'north', label: 'North', value: 1234.5, stage: 'Final' },
  { key: 'south', label: 'South', value: 0, stage: '' },
]} />`;
const meta = {
  title: 'Games/GameScore', component: GameScore, tags: ['autodocs'],
  args: { label: 'Score', rows, locale: 'de-DE' },
  parameters: { docs: {
    description: { component: 'Compare players across rounds and totals, or show a compact list of scores.' },
    sections: [
      { title: 'Scoreboard', stories: ['Scoreboard'] },
      { title: 'Compact totals', stories: ['Default'] },
    ],
    usage: `### Values
Use the same locale on server and client for number formatting. Stage text is displayed as written. Your application owns scoring rules; updates do not run a count-up animation.

GameScore.Table accepts players with scores keyed by round, explicit totals, and caller-owned leader flags. Supply localized column and state labels. Missing scores show the pending label; zero stays zero. Round labels may contain trump artwork. The table scrolls horizontally when its content exceeds the available width.

Both score layouts use a bordered panel. Set surface="transparent" when composing inside an existing surface.

### Keyboard and accessibility

The compact group contains a native description list. The scoreboard uses a caption, column headers, and player row headers. Neither adds keyboard commands or live announcements. Announce score changes in your application when needed.`,
    source: { language: 'tsx', code: source },
  } },
} satisfies Meta<typeof GameScore>;
export default meta;
type Story = StoryObj<typeof meta>;

const tableRounds = [
  { key: 'one', label: '1', state: 'complete' },
  { key: 'two', label: '2', state: 'complete' },
  { key: 'three', label: '3', state: 'current' },
  { key: 'four', label: '4', state: 'upcoming' },
  { key: 'five', label: '5', state: 'upcoming' },
] as const;
const tablePlayers = [
  { key: 'alex', label: 'Alex', scores: { one: 20, two: 15, three: 0 }, total: 35, isMe: true, leader: true },
  { key: 'sam', label: 'Sam', scores: { one: 10, two: 20 }, total: 30 },
];
const tableLabels = { player: 'Player', total: 'Total', me: 'You', leader: 'Leader', current: 'Current', upcoming: 'Next', pending: '—' };

/** Scores across five rounds with the current lead and local player. */
export const Scoreboard: Story = {
  name: 'Five-round scoreboard',
  render: () => <ScoreboardDemo><GameScore.Table caption="Evening match" players={tablePlayers} rounds={tableRounds} labels={tableLabels} locale="en-US" /></ScoreboardDemo>,
  parameters: { layout: 'padded', docs: { source: { language: 'tsx', code: `import { GameScore } from '@jfrader/ui/game-score';

<GameScore.Table caption="Evening match" locale="en-US"
  rounds={[
    { key: 'one', label: '1', state: 'complete' },
    { key: 'two', label: '2', state: 'current' },
    { key: 'three', label: '3', state: 'upcoming' },
    { key: 'four', label: '4', state: 'upcoming' },
    { key: 'five', label: '5', state: 'upcoming' },
  ]}
  players={[
    { key: 'alex', label: 'Alex', scores: { one: 20, two: 0 }, total: 20, isMe: true, leader: true },
    { key: 'sam', label: 'Sam', scores: { one: 10 }, total: 10 },
  ]}
  labels={{ player: 'Player', total: 'Total', me: 'You', leader: 'Leader', current: 'Current', upcoming: 'Next', pending: '—' }} />` } } },
  play: async ({ canvas }) => {
    const table = canvas.getByRole('table', { name: 'Evening match' });
    const panel = table.closest('[data-ui="game-score-table"]')!;
    await expect(panel).toHaveAttribute('data-game-material', 'panel');
    await expect(getComputedStyle(panel).backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
    await expect(getComputedStyle(panel).borderTopWidth).toBe('1px');
    await expect(within(table).getAllByRole('columnheader')).toHaveLength(7);
    await expect(within(table).getByRole('rowheader', { name: 'Alex You Leader' })).toBeVisible();
    await expect(table.querySelector('[data-state="current"][data-ui="game-score-table-cell"]')).toHaveTextContent('0');
    await expect(table.querySelectorAll('[data-ui="game-score-table-total"]')).toHaveLength(2);
  },
};

export const ScoreboardRtl: Story = {
  tags: ['!autodocs'], globals: { theme: 'light' },
  render: () => <GameScore.Table dir="rtl" caption="Evening match" players={tablePlayers} rounds={tableRounds} labels={tableLabels} locale="ar-EG" />,
  play: async ({ canvas }) => {
    const table = canvas.getByRole('table');
    await expect(getComputedStyle(table).direction).toBe('rtl');
    await expect(table.querySelector('[data-ui="game-score-table-total"]')).toHaveTextContent(new Intl.NumberFormat('ar-EG').format(35));
    const headers = within(table).getAllByRole('columnheader');
    await expect(headers[0]!.getBoundingClientRect().x).toBeGreaterThan(headers[1]!.getBoundingClientRect().x);
  },
};
function ReplacementTable(props: NonNullable<GameScoreTableSlotProps['table']>) { return <table {...props} data-replacement="table" />; }
function ReplacementHead(props: NonNullable<GameScoreTableSlotProps['round']>) { return <th {...props} data-replacement="round" />; }
function ReplacementCell(props: NonNullable<GameScoreTableSlotProps['cell']>) { return <td {...props} data-replacement="cell" />; }
function ReplacementLeader(props: NonNullable<GameScoreTableSlotProps['leader']>) { return <span {...props} data-replacement="leader" />; }
const tableRef = fn();
export const ScoreboardSlots: Story = {
  tags: ['!autodocs'],
  render: () => <GameScore.Table caption="Custom scoreboard" players={tablePlayers} rounds={tableRounds} labels={tableLabels}
    slots={{ root: Replacement, table: ReplacementTable, round: ReplacementHead, cell: ReplacementCell, total: ReplacementCell, leader: ReplacementLeader }}
    slotProps={{ table: { ref: tableRef, className: 'custom-table', sx: { fontWeight: vars.fontWeight.medium } }, total: { 'data-ui': 'custom-total' } }} />,
  play: async ({ canvas }) => {
    const table = canvas.getByRole('table', { name: 'Custom scoreboard' });
    await expect(table).toHaveAttribute('data-replacement', 'table');
    await expect(table).toHaveClass('custom-table');
    await expect(tableRef).toHaveBeenCalledWith(table);
    await expect(table.querySelectorAll('[data-replacement="round"]')).toHaveLength(5);
    await expect(table.querySelectorAll('[data-replacement="cell"]')).toHaveLength(12);
    await expect(table.querySelector('[data-replacement="leader"]')).toHaveTextContent('Leader');
    await expect(table.querySelector('[data-ui~="custom-total"]')).toHaveAttribute('data-ui', 'game-score-table-total custom-total');
  },
};

export const ScoreboardDegenerate: Story = {
  tags: ['!autodocs'],
  render: () => <Summary>
    <GameScore.Table caption="Empty scoreboard" players={[]} rounds={[]} labels={tableLabels} />
    <GameScore.Table caption="Awaiting players" players={[]} rounds={tableRounds} labels={tableLabels} />
    <GameScore.Table caption="Awaiting rounds" players={[{ key: 'sam', label: 'Sam', scores: {}, total: 0 }]} rounds={[]} labels={tableLabels} />
    <GameScore.Table caption="Awaiting scores" players={[{ key: 'sam', label: 'Sam', scores: {}, total: 0 }]} rounds={tableRounds} labels={tableLabels} />
  </Summary>,
  play: async ({ canvas }) => {
    for (const [name, columns, rows] of [
      ['Empty scoreboard', 2, 0], ['Awaiting players', 7, 0], ['Awaiting rounds', 2, 1], ['Awaiting scores', 7, 1],
    ] as const) {
      const table = canvas.getByRole('table', { name });
      await expect(table.tagName).toBe('TABLE');
      await expect(table).toHaveAccessibleName(name);
      await expect(table.querySelector('caption')).toHaveTextContent(name);
      const headers = within(table).getAllByRole('columnheader');
      await expect(headers).toHaveLength(columns);
      for (const header of headers) {
        await expect(header.tagName).toBe('TH');
        await expect(header).toHaveAttribute('scope', 'col');
      }
      await expect(headers[0]).toHaveTextContent('Player');
      await expect(headers.at(-1)).toHaveTextContent('Total');
      await expect(within(table).queryAllByRole('rowheader')).toHaveLength(rows);
      await expect(table.querySelector('tbody')!.children).toHaveLength(rows);
      await expect(table).not.toHaveTextContent(/NaN|undefined/);
    }
    for (const name of ['Awaiting rounds', 'Awaiting scores']) {
      const table = canvas.getByRole('table', { name });
      await expect(within(table).getByRole('rowheader', { name: 'Sam' })).toHaveAttribute('scope', 'row');
      await expect(table.querySelector('[data-ui="game-score-table-total"]')).toHaveTextContent('0');
    }
    const pending = canvas.getByRole('table', { name: 'Awaiting scores' }).querySelectorAll('[data-ui="game-score-table-cell"]');
    await expect(pending).toHaveLength(5);
    for (const cell of pending) await expect(cell).toHaveTextContent(tableLabels.pending);
  },
};

function ScoreMediaFixture() {
  return <Summary>
    <GameScore label="Score" rows={rows} locale="de-DE" />
    <GameScore.Table caption="Evening match" players={tablePlayers} rounds={tableRounds} labels={tableLabels} />
  </Summary>;
}
export const ForcedColors: Story = {
  name: 'Game Score Forced Colors', tags: ['!autodocs'], render: () => <ScoreMediaFixture />,
  play: async ({ canvas, canvasElement }) => {
    await expect(window.matchMedia('(forced-colors: active)').matches).toBe(true);
    const group = canvas.getByRole('group', { name: 'Score' });
    await expect(within(group).getAllByRole('definition')).toHaveLength(2);
    const table = canvas.getByRole('table', { name: 'Evening match' });
    await expect(within(table).getByRole('columnheader', { name: '3 Current' })).toBeVisible();
    await expect(within(table).getByRole('rowheader', { name: 'Alex You Leader' })).toBeVisible();
    for (const cell of table.querySelectorAll('[data-ui="game-score-table-cell"]')) {
      await expect(getComputedStyle(cell).borderBottomStyle).toBe('solid');
      await expect(getComputedStyle(cell).borderBottomWidth).toBe('1px');
      await expect(getComputedStyle(cell).borderBottomColor).toBe(getComputedStyle(group).color);
    }
    await expect(canvasElement.getAnimations({ subtree: true })).toHaveLength(0);
  },
};
export const ReducedMotion: Story = {
  name: 'Game Score Reduced Motion', tags: ['!autodocs'], render: () => <ScoreMediaFixture />,
  play: async ({ canvas, canvasElement }) => {
    await expect(window.matchMedia('(prefers-reduced-motion: reduce)').matches).toBe(true);
    await expect(canvas.getByRole('group', { name: 'Score' })).toBeVisible();
    const table = canvas.getByRole('table', { name: 'Evening match' });
    await expect(table.querySelector('[data-ui="game-score-table-total"]')).toHaveTextContent('35');
    await expect(getComputedStyle(table).transitionDuration).toBe('0s');
    await expect(canvasElement.getAnimations({ subtree: true })).toHaveLength(0);
  },
};

/** Default score table with formatted numbers and match stage badges. */
export const Default: Story = {
  name: 'Formatted scores',
  parameters: { docs: { description: { story: 'Format team scores in German and show the current stage.' } } },
  play: async ({ canvasElement }) => {
    const group = within(canvasElement).getByRole('group', { name: 'Score' });
    const terms = within(group).getAllByRole('term');
    const values = within(group).getAllByRole('definition');
    await expect(terms.map((node) => node.textContent)).toEqual(['North', 'South']);
    await expect(values.map((node) => node.textContent)).toEqual(['1.234,5Final', '0']);
    await expect(group.querySelectorAll('[data-stage]')).toHaveLength(2);
    await expect(group.querySelector('[data-stage="Final"]')).toBeVisible();
    await expect(group.querySelector('[data-stage=""]')).toBeVisible();
    await expect(group).toHaveAccessibleName('Score');
  },
};

/** Display scores in right-to-left layout with Arabic numeral formatting. */
export const LightRtl: Story = {
  tags: ['!autodocs'],
  name: 'Light and RTL',
  globals: { theme: 'light' }, args: { dir: 'rtl', locale: 'ar-EG', rows: [{ key: 'east', label: 'East', value: -1234.5 }] },
  parameters: { docs: { source: { language: 'tsx', code: `import { GameScore } from '@jfrader/ui/game-score';

<GameScore label="Score" dir="rtl" locale="ar-EG"
  rows={[{ key: 'east', label: 'East', value: -1234.5 }]} />` } } },
  play: async ({ canvasElement }) => {
    const group = within(canvasElement).getByRole('group', { name: 'Score' });
    await expect(getComputedStyle(group).direction).toBe('rtl');
    await expect(within(group).getByRole('definition').textContent).toBe(new Intl.NumberFormat('ar-EG').format(-1234.5));
    await expect(group.querySelector('[data-stage]')).toBeNull();
  },
};

/** An empty score table without rows. */
export const Empty: Story = {
  tags: ['!autodocs'],
  name: 'No rows',
  args: { rows: [] },
  parameters: { docs: { description: { story: 'Keep a named score group before any scores are available.' }, source: { language: 'tsx', code: `import { GameScore } from '@jfrader/ui/game-score';

<GameScore label="Score" rows={[]} />` } } },
  play: async ({ canvasElement }) => {
    const group = within(canvasElement).getByRole('group', { name: 'Score' });
    await expect(within(group).queryAllByRole('term')).toHaveLength(0);
    await expect(within(group).queryAllByRole('definition')).toHaveLength(0);
  },
};

/** Keep a team's score, awards and round history together. */
export const MatchSummary: Story = {
  tags: ['!autodocs'],
  name: 'Match summary',
  render: (args) => <Summary>
    <GameScore {...args} />
    <GameMarks label="North awards" count={3} mark={<span>◆</span>} />
    <GameRounds label="North rounds" rounds={[{ key: 'opening', label: 'Opening', outcome: 'won' }]}
      outcomeLabels={{ won: 'Won', lost: 'Lost', pending: 'Pending' }} />
  </Summary>,
  parameters: { docs: { description: { story: 'Combine team scores with awards and round history.' }, source: { language: 'tsx', code: `import { styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';
import { GameScore } from '@jfrader/ui/game-score';
import { GameMarks } from '@jfrader/ui/game-marks';
import { GameRounds } from '@jfrader/ui/game-rounds';

const Summary = styled.div({ display: 'grid', gap: vars.space[4] });

<Summary>
  <GameScore label="Score" locale="de-DE" rows={[
    { key: 'north', label: 'North', value: 1234.5, stage: 'Final' },
    { key: 'south', label: 'South', value: 0, stage: '' },
  ]} />
  <GameMarks label="North awards" count={3} mark={<span>◆</span>} />
  <GameRounds label="North rounds"
    rounds={[{ key: 'opening', label: 'Opening', outcome: 'won' }]}
    outcomeLabels={{ won: 'Won', lost: 'Lost', pending: 'Pending' }} />
</Summary>` } } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(within(canvas.getByRole('group', { name: 'Score' })).getAllByRole('term')).toHaveLength(2);
    await expect(canvas.getByRole('group', { name: 'North awards' }).querySelectorAll('[data-filled="true"]')).toHaveLength(3);
    await expect(within(canvas.getByRole('group', { name: 'North rounds' })).getByRole('listitem')).toHaveTextContent('1OpeningWon');
  },
};

function Replacement(props: GameCardRootProps) {
  return <div {...props} data-replacement="slot" />;
}
function UnusedReplacement(props: GameCardRootProps) {
  return <div {...props} data-replacement="component" />;
}
// This fixture exercises slot css, consumer css/style and sx precedence.
function ContractFixture() {
  const externalId = useId();
  const scoreRef = useRef<HTMLDivElement>(null);
  const marksRef = useRef<HTMLDivElement>(null);
  const roundsRef = useRef<HTMLDivElement>(null);
  const [updated, setUpdated] = useState(false);
  const [refs, setRefs] = useState(false);
  const customization = {
    component: UnusedReplacement,
    slots: { root: Replacement },
    className: 'consumer-root', style: { margin: vars.space[1], opacity: 1 },
    'data-ui': 'consumer', 'data-lane': 'consumer',
    'aria-labelledby': externalId, 'aria-describedby': externalId,
    sx: [{ padding: vars.space[4] }, { padding: vars.space[6] }],
  };
  const rootSlot = { className: 'slot-root', style: { margin: vars.space[2] }, 'data-lane': 'slot', sx: { padding: vars.space[2] } };
  return <ContractScope>
    <span id={externalId}>Match</span>
    <GameScore {...customization} ref={scoreRef} label="Score contract" rows={updated ? [{ key: 'south', label: 0, value: 42 }] : rows} locale="en-US"
      slotProps={{ root: rootSlot, name: { className: 'score-name' }, value: { className: 'score-value' } }} />
    <GameMarks {...customization} ref={marksRef} label="Marks contract" count={updated ? 2 : 6} mark={0}
      slotProps={{ root: rootSlot, mark: { className: 'award' } }} />
    <GameRounds {...customization} ref={roundsRef} label="Rounds contract"
      rounds={[{ key: 'same', label: 0, outcome: updated ? 'won' : 'pending' }]}
      outcomeLabels={{ won: 'Victory', lost: 'Defeat', pending: 'Waiting' }}
      slotProps={{ root: rootSlot, round: { className: 'round' } }} />
    <ContractButton onClick={() => {
      setUpdated(true);
      setRefs([scoreRef, marksRef, roundsRef].every((ref) => ref.current?.dataset.replacement === 'slot'));
    }}>Update summary</ContractButton>
    <span>{refs ? 'Refs connected' : 'Refs unchecked'}</span>
  </ContractScope>;
}

export const Contract: Story = {
  tags: ['!autodocs'], render: () => <ContractFixture />,
  play: async ({ canvasElement, userEvent }) => {
    const canvas = within(canvasElement);
    const groups = canvas.getAllByRole('group');
    const labelIds = groups.map((group) => group.getAttribute('aria-labelledby')!.split(' ')[0]);
    await expect(new Set(labelIds).size).toBe(3);
    for (const group of groups) {
      await expect(group).toHaveAttribute('data-replacement', 'slot');
      await expect(group).toHaveAttribute('data-lane', 'slot');
      await expect(group).toHaveClass('consumer-root', 'slot-root');
      await expect(group.getAttribute('data-ui')!.split(' ')).toContain('consumer');
      await expect(group.getAttribute('aria-labelledby')!.split(' ')).toHaveLength(2);
      await expect(canvasElement.ownerDocument.getElementById(group.getAttribute('aria-describedby')!)).toHaveTextContent('Match');
      await expect(getComputedStyle(group).paddingTop).toBe('24px');
      await expect(getComputedStyle(group).marginTop).toBe('8px');
      await expect(group.style.opacity).toBe('1');
      await expect(group.querySelectorAll('button, [tabindex]')).toHaveLength(0);
    }
    const score = canvas.getByRole('group', { name: 'Score contract Match' });
    const marks = canvas.getByRole('group', { name: 'Marks contract Match' });
    const roundsGroup = canvas.getByRole('group', { name: 'Rounds contract Match' });
    await expect(score.querySelectorAll('.score-name')).toHaveLength(2);
    await expect(marks.querySelectorAll('.award')).toHaveLength(5);
    await expect(roundsGroup.querySelector('.round')).toHaveAttribute('data-outcome', 'pending');
    const art = marks.querySelectorAll('[data-ui="game-marks-mark"]');
    await expect(art[0]).toHaveTextContent('0');
    await expect(art[0]!.getBoundingClientRect().top).toBe(art[4]!.getBoundingClientRect().top);
    await expect(marks.querySelector('[data-ui="game-marks-overflow"]')).toHaveTextContent('+1');
    await userEvent.tab();
    const button = canvas.getByRole('button', { name: 'Update summary' });
    await expect(button).toBe(canvasElement.ownerDocument.activeElement);
    await expect(getComputedStyle(button).outlineStyle).not.toBe('none');
    await userEvent.keyboard('{Enter}');
    await expect(canvas.getByText('Refs connected')).toBeVisible();
    await expect(within(score).getAllByRole('term')).toHaveLength(1);
    await expect(within(score).getByRole('term')).toHaveTextContent('0');
    await expect(within(score).getByRole('definition')).toHaveTextContent('42');
    await expect(marks.querySelectorAll('[data-filled="true"]')).toHaveLength(2);
    await expect(roundsGroup.querySelector('.round')).toHaveAttribute('data-outcome', 'won');
    await expect(within(roundsGroup).getByText('Victory')).toBeVisible();
  },
};

function AriaFixture() {
  const hostId = useId();
  const slotId = useId();
  return <Summary>
    <span id={hostId}>Match</span><span id={slotId}>North</span>
    <GameScore label="Score" rows={rows} aria-labelledby={hostId} aria-describedby={hostId}
      slotProps={{ root: { 'aria-labelledby': slotId, 'aria-describedby': slotId } }} />
  </Summary>;
}
export const AriaComposition: Story = {
  tags: ['!autodocs'], render: () => <AriaFixture />,
  play: async ({ canvas, canvasElement }) => {
    const group = canvas.getByRole('group', { name: 'Score North Match' });
    const ids = group.getAttribute('aria-labelledby')!.split(' ');
    await expect(ids).toHaveLength(3);
    await expect(new Set(ids).size).toBe(3);
    const descriptions = group.getAttribute('aria-describedby')!.split(' ');
    await expect(descriptions.map(id => canvasElement.ownerDocument.getElementById(id)?.textContent)).toEqual(['Match', 'North']);
  },
};

function ReplacementRow(props: ComponentPropsWithRef<'div'> & GameScorePartProps<'div'>) {
  return <div {...props} data-replacement="custom-row" />;
}

/** Supply a custom score row for each player. */
export const RowReplacement: Story = {
  tags: ['!autodocs'],
  name: 'Custom row',
  parameters: { docs: { description: { story: 'Render score rows through a custom element.' }, source: { language: 'tsx', code: `import type { ComponentPropsWithRef } from 'react';
import { GameScore, type GameScorePartProps } from '@jfrader/ui/game-score';

function ReplacementRow(props: ComponentPropsWithRef<'div'> & GameScorePartProps<'div'>) {
  return <div {...props} data-replacement="custom-row" />;
}

<GameScore
  label="Score"
  rows={[
    { key: 'north', label: 'North', value: 1234.5, stage: 'Final' },
    { key: 'south', label: 'South', value: 0, stage: 'Half' },
  ]}
  slots={{ row: ReplacementRow }}
  slotProps={{
    row: {
      'data-ui': 'custom-row-ui',
    },
  }}
/>` } } },
  args: {
    label: 'Score',
    rows: [
      { key: 'north', label: 'North', value: 1234.5, stage: 'Final' },
      { key: 'south', label: 'South', value: 0, stage: 'Half' },
    ],
    slots: { row: ReplacementRow },
    slotProps: {
      row: {
        ref: fn(),
        'data-ui': 'custom-row-ui',
      },
    },
  },
  play: async ({ canvasElement, args }) => {
    const group = within(canvasElement).getByRole('group', { name: 'Score' });
    const rowElements = group.querySelectorAll<HTMLElement>('[data-replacement="custom-row"]');
    await expect(rowElements).toHaveLength(2);
    const firstRow = rowElements[0]!;
    await expect(firstRow).toHaveAttribute('data-replacement', 'custom-row');
    await expect(firstRow.className).not.toBe('');
    await expect(firstRow).toHaveAttribute('data-ui', 'game-score-row custom-row-ui');
    await expect(args.slotProps?.row?.ref).toHaveBeenCalledWith(firstRow);
    await expect(firstRow).toHaveAttribute('data-stage', 'Final');
    await expect(rowElements[1]).toHaveAttribute('data-stage', 'Half');
  },
};
