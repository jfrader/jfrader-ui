import { createElement, type ComponentPropsWithRef } from 'react';
import { renderToString } from 'react-dom/server';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn } from 'storybook/test';
import { GameMarks } from './index';

const meta = {
  title: 'Games/GameMarks', component: GameMarks, tags: ['autodocs'],
  args: { label: 'Tricks won', count: 3, max: 5, locale: 'en-US' },
  parameters: { docs: {
    description: { component: 'Track tricks won or round marks against a fixed goal.' },
    sections: [{ title: 'Round progress', stories: ['Default'] }],
    usage: `### Limits
Count is a nonnegative safe integer; max and maxPerRow are positive safe integers. Invalid values throw RangeError. The track always renders max slots and shows +N for marks beyond the goal. Keep max small enough to render one element per slot.

The track uses a raised panel. Set surface="transparent" when composing inside an existing surface.

### Keyboard and accessibility

The named group exposes the localized count. Repeated artwork is hidden from assistive technology. Supply a label in your game's language and the same locale on server and client. There are no keyboard commands, motion, or live announcements.`,
    source: { language: 'tsx', code: `import { GameMarks } from '@jfrader/ui/game-marks';

<GameMarks label="Tricks won" count={3} max={5} locale="en-US" />` },
  } },
} satisfies Meta<typeof GameMarks>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Three tricks won with two slots still open. */
export const Default: Story = {
  name: 'Tricks this round',
  play: async ({ canvas }) => {
    const group = canvas.getByRole('group', { name: 'Tricks won' });
    await expect(group).toHaveAttribute('data-game-material', 'panel');
    await expect(getComputedStyle(group).backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
    await expect(getComputedStyle(group).borderTopWidth).toBe('1px');
    await expect(group.querySelectorAll('[data-ui="game-marks-mark"]')).toHaveLength(5);
    await expect(group.querySelectorAll('[data-filled="true"]')).toHaveLength(3);
    await expect(group.querySelectorAll('[data-filled="false"]')).toHaveLength(2);
    await expect(group.querySelector('[data-ui="game-marks-count"]')).toHaveTextContent('3');
    await expect(group.querySelector('[data-ui="game-marks-marks"]')).toHaveAttribute('aria-hidden', 'true');
  },
};
export const Empty: Story = {
  tags: ['!autodocs'], args: { count: 0 },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelectorAll('[data-filled="false"]')).toHaveLength(5);
    await expect(canvasElement.querySelectorAll('[data-filled="true"]')).toHaveLength(0);
  },
};
export const Overflow: Story = {
  tags: ['!autodocs'], args: { count: 1234, locale: 'ar-EG', dir: 'rtl' }, globals: { theme: 'light' },
  play: async ({ canvasElement, canvas }) => {
    await expect(canvasElement.querySelectorAll('[data-ui="game-marks-mark"]')).toHaveLength(5);
    const group = canvas.getByRole('group', { name: 'Tricks won' });
    const overflow = group.querySelector('[data-ui="game-marks-overflow"]')!;
    await expect(overflow).toHaveTextContent(new Intl.NumberFormat('ar-EG', { signDisplay: 'always' }).format(1229));
    await expect(overflow).toBeVisible();
    await expect(overflow.tagName).toBe('BDI');
    await expect(overflow).toHaveAttribute('dir', 'auto');
    await expect(getComputedStyle(overflow).unicodeBidi).toBe('isolate');
    await expect(getComputedStyle(group).direction).toBe('rtl');
    const count = group.querySelector('[data-ui="game-marks-count"]')!;
    await expect(count).toHaveTextContent(new Intl.NumberFormat('ar-EG').format(1234));
    await expect(count.closest('[aria-hidden="true"]')).toBeNull();
  },
};
export const OverflowLtr: Story = {
  tags: ['!autodocs'], args: { count: 7 },
  play: async ({ canvas }) => {
    const group = canvas.getByRole('group', { name: 'Tricks won' });
    await expect(group.querySelector('[data-ui="game-marks-overflow"]')).toHaveTextContent('+2');
    await expect(group.querySelector('[data-ui="game-marks-count"]')).toHaveTextContent('7');
  },
};
export const ForcedColors: Story = {
  name: 'Game Marks Forced Colors', tags: ['!autodocs'],
  play: async ({ canvas }) => {
    await expect(window.matchMedia('(forced-colors: active)').matches).toBe(true);
    const group = canvas.getByRole('group', { name: 'Tricks won' });
    await expect(group.querySelectorAll('[data-filled="true"]')).toHaveLength(3);
    await expect(group.querySelectorAll('[data-filled="false"]')).toHaveLength(2);
    for (const mark of group.querySelectorAll('[data-ui="game-marks-mark"]')) {
      await expect(getComputedStyle(mark).borderTopWidth).toBe('1px');
      await expect(getComputedStyle(mark).borderTopStyle).toBe('solid');
      await expect(getComputedStyle(mark).borderTopColor).toBe(getComputedStyle(group).color);
    }
    await expect(group.querySelector('[data-filled="true"]')).toHaveTextContent('●');
    await expect(group.querySelector('[data-filled="false"]')).toHaveTextContent('');
  },
};
export const ReducedMotion: Story = {
  name: 'Game Marks Reduced Motion', tags: ['!autodocs'], args: { count: 7 },
  play: async ({ canvas, canvasElement }) => {
    await expect(window.matchMedia('(prefers-reduced-motion: reduce)').matches).toBe(true);
    const group = canvas.getByRole('group', { name: 'Tricks won' });
    await expect(group.querySelectorAll('[data-filled="true"]')).toHaveLength(5);
    await expect(group.querySelector('[data-ui="game-marks-count"]')).toHaveTextContent('7');
    await expect(group.querySelector('[data-ui="game-marks-overflow"]')).toHaveTextContent('+2');
    await expect(getComputedStyle(group).transitionDuration).toBe('0s');
    await expect(canvasElement.getAnimations({ subtree: true })).toHaveLength(0);
  },
};
export const Limits: Story = {
  tags: ['!autodocs'],
  play: async () => {
    for (const count of [-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
      await expect(() => renderToString(<GameMarks label="Invalid" count={count} />)).toThrow('GameMarks count must be a nonnegative safe integer');
    }
    for (const max of [0, -1, 0.5, NaN, Infinity]) {
      await expect(() => renderToString(<GameMarks label="Invalid" count={0} max={max} />)).toThrow('GameMarks max must be a positive safe integer');
      await expect(() => renderToString(<GameMarks label="Invalid" count={0} maxPerRow={max} />)).toThrow('GameMarks maxPerRow must be a positive safe integer');
    }
  },
};
function ReplacementMark(props: ComponentPropsWithRef<'span'>) {
  return createElement('span', { ...props, 'data-replacement': 'mark', 'data-received-css': String(Object.hasOwn(props, 'css')) });
}
export const MarkReplacement: Story = {
  tags: ['!autodocs'], args: { mark: 0, slots: { mark: ReplacementMark }, slotProps: { mark: { ref: fn(), 'data-ui': 'custom-mark' } } },
  play: async ({ canvasElement, args }) => {
    const marks = canvasElement.querySelectorAll('[data-replacement="mark"]');
    await expect(marks).toHaveLength(5);
    await expect(marks[0]).toHaveTextContent('0');
    await expect(marks[0]).toHaveAttribute('data-received-css', 'false');
    await expect(marks[0]!.className).not.toBe('');
    await expect(getComputedStyle(marks[0]!).display).toBe('grid');
    await expect(marks[0]).toHaveAttribute('data-ui', 'game-marks-mark custom-mark');
    await expect(args.slotProps?.mark?.ref).toHaveBeenCalledWith(marks[0]);
    await expect(marks[4]).toHaveTextContent('');
  },
};
