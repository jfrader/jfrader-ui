import type { Meta, StoryObj } from '@storybook/react-vite';
import { useId, useRef, useState, type ComponentPropsWithRef } from 'react';
import { expect, fn, within } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { GameScore, type GameScorePartProps } from './index';

import { GameMarks } from '../game-marks';
import { GameRounds } from '../game-rounds';
import { Button } from '../button';
import type { GameCardRootProps } from '../game-card/game-card-root';
import { FORCED_COLORS } from '../../styling/media';
// `styled` is the app-facing styling API; consumers import it from `@jfrader/ui`.
import { styled } from '../../index';

const forcedColorStyle = { [FORCED_COLORS]: { color: 'CanvasText', backgroundColor: 'Canvas' } };
const Summary = styled.div({ display: 'grid', gap: vars.space[4] });
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
    description: { component: 'Show named scores and stage labels for players or teams.' },
    usage: `### Values
Pass rows with stable keys, labels, numeric values and optional stage text. Values use Intl.NumberFormat with locale; omitting locale uses the runtime default. Pass the same locale on server and client for hydration. Stages are displayed verbatim and exposed as data-stage. No scoring rules or count-up animation run here.

### Accessibility
The named group contains a native description list. It adds no focus target or keyboard bindings and does not announce updates. Choose a live region in your application when needed. No motion is used.

### Customization
Use slotProps for root, label, list, row, name, value and stage. Repeated slots apply to every row. component is sugar for slots.root; slots.root wins. Replacements forward props and ref to one div. Root slot conflicts win; className and style merge. css and sx apply after slot styles.`,
    source: { language: 'tsx', code: source },
  } },
} satisfies Meta<typeof GameScore>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
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
export const LightRtl: Story = {
  globals: { theme: 'light' }, args: { dir: 'rtl', locale: 'ar-EG', rows: [{ key: 'east', label: 'East', value: -1234.5 }] },
  parameters: { docs: { source: { language: 'tsx', code: `<GameScore label="Score" dir="rtl" locale="ar-EG"
  rows={[{ key: 'east', label: 'East', value: -1234.5 }]} />` } } },
  play: async ({ canvasElement }) => {
    const group = within(canvasElement).getByRole('group', { name: 'Score' });
    await expect(getComputedStyle(group).direction).toBe('rtl');
    await expect(within(group).getByRole('definition').textContent).toBe(new Intl.NumberFormat('ar-EG').format(-1234.5));
    await expect(group.querySelector('[data-stage]')).toBeNull();
  },
};
export const Empty: Story = {
  args: { rows: [] },
  parameters: { docs: { source: { language: 'tsx', code: '<GameScore label="Score" rows={[]} />' } } },
  play: async ({ canvasElement }) => {
    const group = within(canvasElement).getByRole('group', { name: 'Score' });
    await expect(within(group).queryAllByRole('term')).toHaveLength(0);
    await expect(within(group).queryAllByRole('definition')).toHaveLength(0);
  },
};
/** Keep a team's score, awards and round history together. */
export const MatchSummary: Story = {
  render: (args) => <Summary>
    <GameScore {...args} />
    <GameMarks label="North awards" count={3} mark={<span>◆</span>} />
    <GameRounds label="North rounds" rounds={[{ key: 'opening', label: 'Opening', outcome: 'won' }]}
      outcomeLabels={{ won: 'Won', lost: 'Lost', pending: 'Pending' }} />
  </Summary>,
  parameters: { docs: { source: { language: 'tsx', code: `import { GameMarks } from '@jfrader/ui/game-marks';
import { GameRounds } from '@jfrader/ui/game-rounds';
${source}
<GameMarks label="North awards" count={3} mark={<span>◆</span>} />
<GameRounds label="North rounds"
  rounds={[{ key: 'opening', label: 'Opening', outcome: 'won' }]}
  outcomeLabels={{ won: 'Won', lost: 'Lost', pending: 'Pending' }} />` } } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(within(canvas.getByRole('group', { name: 'Score' })).getAllByRole('term')).toHaveLength(2);
    await expect(canvas.getByRole('group', { name: 'North awards' }).querySelectorAll('[data-ui="game-marks-mark"]')).toHaveLength(3);
    await expect(within(canvas.getByRole('group', { name: 'North rounds' })).getByRole('listitem')).toHaveTextContent('OpeningWon');
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
    css: { padding: vars.space[4] }, sx: { padding: vars.space[6] },
  };
  const rootSlot = { className: 'slot-root', style: { margin: vars.space[2] }, 'data-lane': 'slot', css: { padding: vars.space[2] } };
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
    await expect(marks.querySelectorAll('.award')).toHaveLength(6);
    await expect(roundsGroup.querySelector('.round')).toHaveAttribute('data-outcome', 'pending');
    const art = marks.querySelectorAll('[data-ui="game-marks-mark"]');
    await expect(art[0]).toHaveTextContent('0');
    await expect(art[0]!.getBoundingClientRect().top).toBe(art[4]!.getBoundingClientRect().top);
    await expect(art[5]!.getBoundingClientRect().top).toBeGreaterThan(art[0]!.getBoundingClientRect().top);
    await userEvent.tab();
    const button = canvas.getByRole('button', { name: 'Update summary' });
    await expect(button).toBe(canvasElement.ownerDocument.activeElement);
    await expect(getComputedStyle(button).outlineStyle).not.toBe('none');
    await userEvent.keyboard('{Enter}');
    await expect(canvas.getByText('Refs connected')).toBeVisible();
    await expect(within(score).getAllByRole('term')).toHaveLength(1);
    await expect(within(score).getByRole('term')).toHaveTextContent('0');
    await expect(within(score).getByRole('definition')).toHaveTextContent('42');
    await expect(marks.querySelectorAll('.award')).toHaveLength(2);
    await expect(roundsGroup.querySelector('.round')).toHaveAttribute('data-outcome', 'won');
    await expect(within(roundsGroup).getByText('Victory')).toBeVisible();
  },
};

function ReplacementRow(props: ComponentPropsWithRef<'div'> & GameScorePartProps<'div'>) {
  return <div {...props} data-replacement="custom-row" />;
}

/** Supply a custom score row for each player. */
export const RowReplacement: Story = {
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
