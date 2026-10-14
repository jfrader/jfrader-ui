import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, within } from 'storybook/test';
import { ReactionGroup } from './index';

const meta = {
  title: 'Data display/ReactionGroup',
  component: ReactionGroup,
  tags: ['autodocs'],
  args: {
    counts: [{ emoji: '👍', count: 3, mine: true }, { emoji: '🎉', count: 1 }],
    offeredReactions: ['👍', '🎉', '👀'],
    locale: 'en-US',
    onToggle: fn(),
    onSelect: fn(),
    onPickerOpenChange: fn(),
  },
  parameters: {
    docs: {
      description: { component: 'Show reaction counts and let people toggle a reaction or choose an emoji.' },
      source: { code: `<ReactionGroup
  counts={[{ emoji: '👍', count: 3, mine: true }]}
  offeredReactions={['👍', '🎉', '👀']}
  onToggle={toggleReaction}
  onSelect={addReaction}
/>` },
      usage: `### Values
- Counts and mine are caller-owned. Update counts after onToggle or onSelect. No count changes until you supply new props.
- onSelect falls back to onToggle. Omit offeredReactions to hide the add button.
- Control the picker with pickerOpen, or seed it with defaultPickerOpen. Use labels to translate English control names; locale formats numbers.

### Keyboard
- Pills are native toggle buttons with aria-pressed. Tab and Shift+Tab follow document order; Enter and Space activate once.
- The inline picker is a named group, not a menu. ArrowLeft and ArrowRight wrap between emoji (reversed in RTL); Home and End jump to the first and last emoji.
- Enter or Space selects; Escape or the close button closes and returns focus to the add button after an accepted close.
- readOnly shows text instead of buttons. disabled removes reaction controls from the tab order; an open picker can still close.`,
    },
  },
} satisfies Meta<typeof ReactionGroup>;
export default meta;
type Story = StoryObj<typeof meta>;

async function expectFocus(element: HTMLElement) {
  await expect(element.ownerDocument.activeElement).toBe(element);
  await expect(getComputedStyle(element).outlineStyle).not.toBe('none');
}

export const Reactions: Story = {
  play: async ({ canvas, args, userEvent }) => {
    const mine = canvas.getByRole('button', { name: '👍 3 reactions, including you' });
    await expect(mine).toHaveAttribute('aria-pressed', 'true');
    await userEvent.tab();
    await expectFocus(mine);
    await userEvent.keyboard('{Enter}');
    await expect(args.onToggle).toHaveBeenCalledTimes(1);
    await expect(args.onToggle).toHaveBeenCalledWith('👍');
    await expect(mine).toHaveAttribute('aria-pressed', 'true');
    await userEvent.tab();
    const other = canvas.getByRole('button', { name: '🎉 1 reaction' });
    await expectFocus(other);
    await userEvent.keyboard(' ');
    await expect(args.onToggle).toHaveBeenCalledTimes(2);
    await expect(args.onToggle).toHaveBeenLastCalledWith('🎉');
    await expect(other).toHaveAttribute('aria-pressed', 'false');
  },
};

export const PickerKeyboard: Story = {
  args: { counts: [] },
  play: async ({ canvas, args, userEvent }) => {
    const add = canvas.getByRole('button', { name: 'Add reaction' });
    await userEvent.tab();
    await expectFocus(add);
    await userEvent.keyboard('{Enter}');
    const group = canvas.getByRole('group', { name: 'Reactions' });
    await expect(add).toHaveAttribute('aria-controls', group.id);
    const emoji = within(group);
    const first = emoji.getByRole('button', { name: 'React with 👍' });
    const last = emoji.getByRole('button', { name: 'React with 👀' });
    await expectFocus(first);
    await userEvent.keyboard('{ArrowLeft}');
    await expectFocus(last);
    await userEvent.keyboard('{ArrowRight}');
    await expectFocus(first);
    await userEvent.keyboard('{End}');
    await expectFocus(last);
    await userEvent.keyboard('{Home}');
    await expectFocus(first);
    await userEvent.keyboard('{Escape}');
    await expectFocus(add);
    await expect(canvas.queryByRole('group')).not.toBeInTheDocument();
    await userEvent.keyboard(' ');
    await userEvent.keyboard('{ArrowRight}{Enter}');
    await expect(args.onSelect).toHaveBeenCalledTimes(1);
    await expect(args.onSelect).toHaveBeenCalledWith('🎉');
    await expect(args.onToggle).not.toHaveBeenCalled();
    await expectFocus(add);
    await expect(args.onPickerOpenChange).toHaveBeenCalledTimes(4);
  },
};

export const RTL: Story = {
  args: { counts: [], dir: 'rtl' },
  play: async ({ canvas, userEvent }) => {
    await userEvent.tab();
    await userEvent.keyboard('{Enter}');
    const first = canvas.getByRole('button', { name: 'React with 👍' });
    await expectFocus(first);
    await userEvent.keyboard('{ArrowRight}');
    await expectFocus(canvas.getByRole('button', { name: 'React with 👀' }));
    await userEvent.keyboard('{ArrowLeft}');
    await expectFocus(first);
    await userEvent.keyboard('{Escape}');
  },
};

export const ControlledPicker: Story = {
  args: { pickerOpen: false },
  play: async ({ canvas, args, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Add reaction' }));
    await expect(args.onPickerOpenChange).toHaveBeenCalledTimes(1);
    await expect(args.onPickerOpenChange).toHaveBeenCalledWith(true);
    await expect(canvas.queryByRole('group')).not.toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Add reaction' })).toHaveAttribute('aria-expanded', 'false');
  },
};

export const ControlledCounts: Story = {
  args: { offeredReactions: [] },
  render: (args) => {
    const [mine, setMine] = useState(false);
    return <ReactionGroup {...args} counts={[{ emoji: '👍', count: mine ? 1 : 0, mine }]}
      onToggle={(emoji) => { args.onToggle?.(emoji); setMine(!mine); }} />;
  },
  play: async ({ canvas, args, userEvent }) => {
    await userEvent.tab();
    await userEvent.keyboard('{Enter}');
    await expect(canvas.getByRole('button', { name: '👍 1 reaction, including you' })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.keyboard(' ');
    await expect(canvas.getByRole('button', { name: '👍 0 reactions' })).toHaveAttribute('aria-pressed', 'false');
    await expect(args.onToggle).toHaveBeenCalledTimes(2);
  },
};

export const Disabled: Story = {
  args: { disabled: true },
  play: async ({ canvas, args, userEvent }) => {
    for (const button of canvas.getAllByRole('button')) await expect(button).toBeDisabled();
    await userEvent.click(canvas.getByRole('button', { name: '👍 3 reactions, including you' }));
    await expect(args.onToggle).not.toHaveBeenCalled();
    await expect(args.onSelect).not.toHaveBeenCalled();
  },
};

export const ReadOnly: Story = {
  args: { readOnly: true },
  play: async ({ canvas }) => {
    await expect(canvas.queryByRole('button')).not.toBeInTheDocument();
    await expect(canvas.getByText('👍 3 reactions, including you')).toBeInTheDocument();
  },
};

export const WithoutPicker: Story = { args: { offeredReactions: [] } };
export const Light: Story = { globals: { theme: 'light' } };
export const Empty: Story = { args: { counts: [], offeredReactions: [] } };
export const Localized: Story = { args: { locale: 'de-DE', counts: [{ emoji: '👍', count: 1234 }] } };
