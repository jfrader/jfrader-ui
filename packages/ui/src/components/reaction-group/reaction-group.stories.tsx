import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, within } from 'storybook/test';
import { Card } from '../card';
import { ReactionGroup, type ReactionCount } from './index';

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
      sections: [
        { title: 'Basic', stories: ['Reactions'] },
        { title: 'Reactions and counts', stories: ['Localized'] },
        { title: 'Your reactions', stories: ['ControlledCounts'] },
        { title: 'Add and remove', stories: ['AddRemove'] },
        { title: 'States', stories: ['Disabled', 'ReadOnly'] },
        { title: 'Composition', stories: ['MessageCard'] },
        { title: 'Keyboard', stories: ['PickerKeyboard'] },
      ],
      usage: `### When to use
Attach lightweight feedback to a message or other shared content. Use a separate action for decisions that require confirmation.

### Constraints
The application owns counts and each person's selected reactions. A request does not change a count until the application supplies updated data. Translate control names and count text as well as formatting numbers for your audience.

Read-only groups show text instead of controls. Disabled groups prevent changes, but an already open picker can still close.

### Keyboard and accessibility
Tab and Shift+Tab visit reaction buttons in document order. Enter and Space toggle a reaction; the pressed state identifies your reactions.

The inline picker is a named group, not a menu. Left and Right arrows wrap between emoji, reversed in RTL; Home and End jump to the ends. Enter or Space selects. Escape or the close button requests closure; an accepted close returns focus to the add button.`,
    },
  },
} satisfies Meta<typeof ReactionGroup>;
export default meta;
type Story = StoryObj<typeof meta>;

function reactionSource(props = '', counts = "[{ emoji: '👍', count: 3, mine: true }, { emoji: '🎉', count: 1 }]") {
  return `import { ReactionGroup, type ReactionGroupProps } from '@jfrader/ui';

export function MessageReactions({ onToggle, onSelect }: Pick<ReactionGroupProps, 'onToggle' | 'onSelect'>) {
  return <ReactionGroup counts={${counts}}
    offeredReactions={['👍', '🎉', '👀']} locale="en-US"
    onToggle={onToggle} onSelect={onSelect} ${props}/>;
}`;
}

async function expectFocus(element: HTMLElement) {
  await expect(element.ownerDocument.activeElement).toBe(element);
  await expect(getComputedStyle(element).outlineStyle).not.toBe('none');
}

export const Reactions: Story = {
  name: 'Message reactions',
  parameters: { docs: {
    description: { story: 'Show existing reactions and open the picker to request another emoji.' },
    source: { language: 'tsx', code: reactionSource() },
  } },
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
  name: 'Navigate the emoji picker',
  parameters: { docs: {
    description: { story: 'Open Add reaction, move with the arrow keys, and select with Enter or close with Escape.' },
    source: { language: 'tsx', code: reactionSource('', '[]') },
  } },
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
  name: 'Toggle your reaction',
  parameters: { docs: {
    description: { story: 'Add or remove your thumbs-up and update its count in application state.' },
    source: { language: 'tsx', code: `import { useState } from 'react';
import { ReactionGroup } from '@jfrader/ui';

export function LikeButton() {
  const [mine, setMine] = useState(false);
  return <ReactionGroup counts={[{ emoji: '👍', count: mine ? 1 : 0, mine }]}
    offeredReactions={[]} locale="en-US" onToggle={() => setMine((value) => !value)} />;
}` },
  } },
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
  name: 'Disabled reactions',
  parameters: { docs: {
    description: { story: 'Keep counts visible while preventing reaction changes and picker opening.' },
    source: { language: 'tsx', code: reactionSource('disabled ') },
  } },
  args: { disabled: true },
  play: async ({ canvas, args, userEvent }) => {
    for (const button of canvas.getAllByRole('button')) await expect(button).toBeDisabled();
    await userEvent.click(canvas.getByRole('button', { name: '👍 3 reactions, including you' }));
    await expect(args.onToggle).not.toHaveBeenCalled();
    await expect(args.onSelect).not.toHaveBeenCalled();
  },
};

export const ReadOnly: Story = {
  name: 'Read-only counts',
  parameters: { docs: {
    description: { story: 'Present reaction counts as text without interactive controls.' },
    source: { language: 'tsx', code: reactionSource('readOnly ') },
  } },
  args: { readOnly: true },
  play: async ({ canvas }) => {
    await expect(canvas.queryByRole('button')).not.toBeInTheDocument();
    await expect(canvas.getByText('👍 3 reactions, including you')).toBeInTheDocument();
  },
};

export const WithoutPicker: Story = { args: { offeredReactions: [] } };
export const Light: Story = { globals: { theme: 'light' } };
export const Empty: Story = { args: { counts: [], offeredReactions: [] } };
export const Localized: Story = {
  name: 'Localized count formatting',
  parameters: { docs: {
    description: { story: 'Format a four-digit count with German number separators; control names remain English.' },
    source: { language: 'tsx', code: `import { ReactionGroup } from '@jfrader/ui';

<ReactionGroup locale="de-DE" counts={[{ emoji: '👍', count: 1234 }]}
  offeredReactions={['👍', '🎉', '👀']} />` },
  } },
  args: { locale: 'de-DE', counts: [{ emoji: '👍', count: 1234 }] },
};

function EditableReactions() {
  const [counts, setCounts] = useState<ReactionCount[]>([
    { emoji: '👍', count: 3, mine: true },
    { emoji: '🎉', count: 1 },
  ]);
  function toggle(emoji: string) {
    setCounts((current) => {
      const existing = current.find((reaction) => reaction.emoji === emoji);
      if (!existing) return [...current, { emoji, count: 1, mine: true }];
      return current.map((reaction) => reaction.emoji === emoji
        ? { ...reaction, count: reaction.count + (reaction.mine ? -1 : 1), mine: !reaction.mine }
        : reaction).filter((reaction) => reaction.count > 0);
    });
  }
  return <ReactionGroup counts={counts} offeredReactions={['👍', '🎉', '👀']}
    locale="en-US" onToggle={toggle} onSelect={toggle} />;
}

const editableSource = `import { useState } from 'react';
import { ReactionGroup, type ReactionCount } from '@jfrader/ui';

function EditableReactions() {
  const [counts, setCounts] = useState<ReactionCount[]>([
    { emoji: '👍', count: 3, mine: true },
    { emoji: '🎉', count: 1 },
  ]);
  function toggle(emoji: string) {
    setCounts((current) => {
      const existing = current.find((reaction) => reaction.emoji === emoji);
      if (!existing) return [...current, { emoji, count: 1, mine: true }];
      return current.map((reaction) => reaction.emoji === emoji
        ? { ...reaction, count: reaction.count + (reaction.mine ? -1 : 1), mine: !reaction.mine }
        : reaction).filter((reaction) => reaction.count > 0);
    });
  }
  return <ReactionGroup counts={counts} offeredReactions={['👍', '🎉', '👀']}
    locale="en-US" onToggle={toggle} onSelect={toggle} />;
}`;

export const AddRemove: Story = {
  name: 'Add and remove reactions',
  parameters: { docs: {
    description: { story: 'Choose an emoji to add your reaction and toggle it off to remove your contribution.' },
    source: { language: 'tsx', code: `${editableSource}\n\n<EditableReactions />` },
  } },
  render: () => <EditableReactions />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Add reaction' }));
    await userEvent.click(canvas.getByRole('button', { name: 'React with 👀' }));
    const added = canvas.getByRole('button', { name: '👀 1 reaction, including you' });
    await expect(added).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(added);
    await expect(canvas.queryByRole('button', { name: /👀 .*reactions?/ })).not.toBeInTheDocument();
  },
};

export const MessageCard: Story = {
  name: 'Reactions on a message',
  parameters: { docs: {
    description: { story: 'Place editable reactions beneath a message inside a card.' },
    source: { language: 'tsx', code: `import { Card } from '@jfrader/ui';
${editableSource}

<Card title="Release update" content="The new workspace is ready."
  footer={<EditableReactions />} />` },
  } },
  render: () => <Card title="Release update" content="The new workspace is ready."
    footer={<EditableReactions />} />,
};
