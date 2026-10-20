import type { ComponentPropsWithRef } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { renderToString } from 'react-dom/server';
import { expect, fn, within } from 'storybook/test';
import { GameMarks, type GameMarksPartProps } from './index';


const meta = {
  title: 'Games/GameMarks', component: GameMarks, tags: ['autodocs'],
  args: { label: 'Awards', count: 7, maxPerRow: 3, mark: <span>◆</span>, locale: 'en-US' },
  parameters: { docs: {
    description: { component: 'Arrange your award marks in rows or overlapping piles.' },
    sections: [
      { title: 'Awards', stories: ['Default', 'Empty'] },
      { title: 'Composition', stories: ['MarkReplacement'] },
    ],
    usage: `### Art and layout
Supply decorative, noninteractive artwork without IDs: the same artwork is repeated for each award. Award counts must be nonnegative safe integers; row limits must be positive safe integers. Invalid values throw RangeError. Keep counts small enough to render one element per mark. Size the artwork in your application.

### Accessibility
Use the same locale on server and client for number formatting. Repeated art is hidden from assistive technology; the named group exposes the count. It adds no keyboard commands, motion or live announcements.`,
    source: { language: 'tsx', code: `import { GameMarks } from '@jfrader/ui/game-marks';

<GameMarks label="Awards" count={7} maxPerRow={3} locale="en-US" mark={<span>◆</span>} />` },
  } },
} satisfies Meta<typeof GameMarks>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Display award marks arranged in rows. */
export const Default: Story = {
  name: 'Award rows',
  parameters: { docs: { description: { story: 'Wrap seven awards into rows of three marks.' } } },
  play: async ({ canvasElement }) => {
    const group = within(canvasElement).getByRole('group', { name: 'Awards' });
    await expect(within(group).getByText('7')).toBeVisible();
    const marks = group.querySelectorAll('[data-ui="game-marks-mark"]');
    await expect(marks).toHaveLength(7);
    await expect(marks[0]).toHaveTextContent('◆');
    const art = group.querySelector('[data-ui="game-marks-marks"]')!;
    await expect(art).toHaveAttribute('aria-hidden', 'true');
    await expect(group).toHaveAttribute('data-layout', 'rows');
    await expect(marks[0]!.getBoundingClientRect().top).toBe(marks[2]!.getBoundingClientRect().top);
    await expect(marks[3]!.getBoundingClientRect().top).toBeGreaterThan(marks[0]!.getBoundingClientRect().top);
    await expect(marks[6]!.getBoundingClientRect().top).toBeGreaterThan(marks[3]!.getBoundingClientRect().top);
  },
};

/** Display overlapping award marks in right-to-left layout. */
export const LightRtlPile: Story = {
  name: 'Pile, light and RTL',
  globals: { theme: 'light' }, args: { dir: 'rtl', layout: 'pile', locale: 'ar-EG' },
  parameters: { docs: { source: { language: 'tsx', code: `import { GameMarks } from '@jfrader/ui/game-marks';

<GameMarks label="Awards" count={7} maxPerRow={3} dir="rtl" layout="pile" locale="ar-EG" mark={<span>◆</span>} />` } } },
  play: async ({ canvasElement }) => {
    const group = within(canvasElement).getByRole('group', { name: 'Awards' });
    await expect(getComputedStyle(group).direction).toBe('rtl');
    await expect(group).toHaveAttribute('data-layout', 'pile');
    await expect(within(group).getByText(new Intl.NumberFormat('ar-EG').format(7))).toBeVisible();
    const marks = group.querySelectorAll('[data-ui="game-marks-mark"]');
    const first = marks[0]!.getBoundingClientRect();
    await expect(marks).toHaveLength(7);
    const second = marks[1]!.getBoundingClientRect();
    await expect(second.right).toBeGreaterThan(first.left);
    await expect(second.right).toBeLessThan(first.right);
    await expect(marks[3]!.getBoundingClientRect().top).toBeGreaterThan(first.top);
  },
};

/** Display zero awards without mark icons. */
export const Empty: Story = {
  name: 'No awards',
  args: { count: 0 },
  parameters: { docs: { description: { story: 'Show a zero count without repeated artwork.' }, source: { language: 'tsx', code: `import { GameMarks } from '@jfrader/ui/game-marks';

<GameMarks label="Awards" count={0} mark={<span>◆</span>} />` } } },
  play: async ({ canvasElement }) => {
    const group = within(canvasElement).getByRole('group', { name: 'Awards' });
    await expect(within(group).getByText('0')).toBeVisible();
    await expect(group.querySelectorAll('[data-ui="game-marks-mark"]')).toHaveLength(0);
  },
};

export const Limits: Story = {
  tags: ['!autodocs'], args: { count: 1, maxPerRow: 1 },
  play: async ({ canvasElement }) => {
    const group = within(canvasElement).getByRole('group', { name: 'Awards' });
    await expect(group.querySelectorAll('[data-ui="game-marks-mark"]')).toHaveLength(1);
    for (const count of [-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
      await expect(() => renderToString(<GameMarks label="Invalid" count={count} mark={null} />)).toThrow('GameMarks count must be a nonnegative safe integer');
    }
    for (const maxPerRow of [0, -1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
      await expect(() => renderToString(<GameMarks label="Invalid" count={0} maxPerRow={maxPerRow} mark={null} />)).toThrow('GameMarks maxPerRow must be a positive safe integer');
    }
  },
};

function ReplacementMark(props: ComponentPropsWithRef<'span'> & GameMarksPartProps) {
  return <span {...props} data-replacement="custom-mark" />;
}

/** Use one custom mark element for every mark in the row. */
export const MarkReplacement: Story = {
  name: 'Custom mark',
  parameters: { docs: { description: { story: 'Render every award through a custom mark element.' }, source: { language: 'tsx', code: `import type { ComponentPropsWithRef } from 'react';
import { GameMarks, type GameMarksPartProps } from '@jfrader/ui/game-marks';

function ReplacementMark(props: ComponentPropsWithRef<'span'> & GameMarksPartProps) {
  return <span {...props} data-replacement="custom-mark" />;
}

<GameMarks
  label="Awards"
  count={3}
  maxPerRow={5}
  mark={<span>◆</span>}
  layout="rows"
  slots={{ mark: ReplacementMark }}
  slotProps={{
    mark: {
      'data-ui': 'custom-mark-ui',
    },
  }}
/>` } } },
  args: {
    label: 'Awards',
    count: 3,
    maxPerRow: 5,
    mark: <span>◆</span>,
    layout: 'rows',
    slots: { mark: ReplacementMark },
    slotProps: {
      mark: {
        ref: fn(),
        'data-ui': 'custom-mark-ui',
      },
    },
  },
  play: async ({ canvasElement, args }) => {
    const group = within(canvasElement).getByRole('group', { name: 'Awards' });
    const markElements = group.querySelectorAll<HTMLElement>('[data-replacement="custom-mark"]');
    await expect(markElements).toHaveLength(3);
    const firstMark = markElements[0]!;
    await expect(firstMark).toHaveAttribute('data-replacement', 'custom-mark');
    await expect(firstMark.className).not.toBe('');
    await expect(firstMark).toHaveAttribute('data-ui', 'game-marks-mark custom-mark-ui');
    await expect(args.slotProps?.mark?.ref).toHaveBeenCalledWith(firstMark);
    await expect(group).toHaveAttribute('data-layout', 'rows');
    await expect(firstMark).toHaveTextContent('◆');
  },
};
