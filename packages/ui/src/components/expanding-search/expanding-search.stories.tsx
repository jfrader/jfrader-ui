import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fireEvent, fn, waitFor } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { withLightTheme } from '../../testing/story-decorators';
import { ExpandingSearch, type ExpandingSearchProps } from './index';

const fixtureButton = { minWidth: 24, minHeight: 24 } as const;
const meta = {
  title: 'Inputs/ExpandingSearch', component: ExpandingSearch, tags: ['autodocs'],
  args: { triggerLabel: 'Search members', placeholder: 'Name or email' },
  decorators: [(Story) => <div style={{ inlineSize: 420, maxInlineSize: '100%' }}><Story /></div>],
  parameters: { docs: {
    source: { code: '<ExpandingSearch triggerLabel="Search members" value={query} onValueChange={setQuery} />' },
    description: { component: 'Compact disclosure built on SearchField. Enter or Space opens the field and focuses the native searchbox. Escape collapses without clearing the query; accepted closure returns focus to the button. Tab and Shift+Tab move naturally through the field and clear action; leaving closes without returning focus. Controlled open requests commit only when accepted. Query entry, clear, validation and form reset use SearchField. Reserve a growth lane in the toolbar; the lane keeps neighboring content in place. Filtering and results belong to the caller.' },
  } },
} satisfies Meta<typeof ExpandingSearch>;
export default meta;
type Story = StoryObj<typeof meta>;

function ControlledSearch(props: ExpandingSearchProps) {
  const [open, setOpen] = useState(props.defaultOpen ?? false);
  const [value, setValue] = useState(props.defaultValue ?? '');
  return <ExpandingSearch {...props} open={open} value={value} onOpenChange={(next) => { props.onOpenChange?.(next); setOpen(next); }} onValueChange={(next) => { props.onValueChange?.(next); setValue(next); }} />;
}
ControlledSearch.displayName = 'ControlledExpandingSearch';

async function expectFocus(element: HTMLElement, ring = element) {
  await expect(element.ownerDocument.activeElement).toBe(element);
  await expect(getComputedStyle(ring).outlineStyle).not.toBe('none');
  await expect(parseFloat(getComputedStyle(ring).outlineWidth)).toBeGreaterThan(1);
}

export const Default: Story = {
  play: async ({ canvas, userEvent }) => {
    await expect(canvas.queryByRole('searchbox')).toBeNull();
    const trigger = canvas.getByRole('button', { name: 'Search members' });
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(trigger);
    const input = canvas.getByRole('searchbox', { name: 'Search members' });
    await expect(input.ownerDocument.activeElement).toBe(input);
    await waitFor(async () => { await expect(Math.abs(input.closest('[data-ui="expanding-search"]')!.children[1]!.getBoundingClientRect().width - 384)).toBeLessThan(1.1); });
  },
};
export const PersistentOpen: Story = { args: { defaultOpen: true, defaultValue: 'Ada' } };
export const Description: Story = { args: { defaultOpen: true, label: 'Search members', description: 'Search by name or email.' } };
export const Error: Story = { args: { defaultOpen: true, error: 'Enter at least four characters.', defaultValue: 'Ada', required: true } };
export const Sizes: Story = {
  render: (args) => <div style={{ display: 'grid', gap: vars.space[4] }}>{(['sm', 'md', 'lg'] as const).map((size) => <ExpandingSearch {...args} key={size} size={size} triggerLabel={`Search ${size}`} />)}</div>,
  play: async ({ canvas }) => {
    for (const [index, size] of [32, 40, 48].entries()) {
      const rect = canvas.getAllByRole('button')[index]!.getBoundingClientRect();
      await expect(Math.abs(rect.width - size)).toBeLessThan(1.1);
      await expect(Math.abs(rect.height - size)).toBeLessThan(1.1);
    }
  },
};
export const Anchors: Story = {
  render: (args) => <div style={{ display: 'grid', gap: vars.space[4] }}><ExpandingSearch {...args} anchor="start" triggerLabel="Search from start" /><ExpandingSearch {...args} anchor="end" triggerLabel="Search from end" /></div>,
};
export const Uncontrolled: Story = {
  args: { defaultValue: 'Ada', onOpenChange: fn(), onValueChange: fn() },
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(canvas.getByRole('button'));
    const input = canvas.getByRole('searchbox');
    await expect(input).toHaveValue('Ada');
    await userEvent.keyboard('{Escape}');
    await expect(canvas.queryByRole('searchbox')).toBeNull();
    await expect(args.onOpenChange).toHaveBeenCalledTimes(2);
    await expect(args.onOpenChange).toHaveBeenNthCalledWith(1, true);
    await expect(args.onOpenChange).toHaveBeenNthCalledWith(2, false);
    await expect(args.onValueChange).toHaveBeenCalledTimes(0);
    await userEvent.keyboard('{Enter}');
    await expect(canvas.getByRole('searchbox')).toHaveValue('Ada');
    await expect(args.onOpenChange).toHaveBeenCalledTimes(3);
  },
};
export const Controlled: Story = { ...Uncontrolled, render: (args) => <ControlledSearch {...args} />, args: { defaultValue: 'Ada', onOpenChange: fn(), onValueChange: fn() } };
export const RejectedOpen: Story = {
  args: { open: false, onOpenChange: fn() },
  play: async ({ canvas, userEvent, args }) => {
    const trigger = canvas.getByRole('button');
    await userEvent.tab();
    await expectFocus(trigger);
    await userEvent.keyboard('{Enter}');
    await expect(canvas.queryByRole('searchbox')).toBeNull();
    await expectFocus(trigger);
    await expect(args.onOpenChange).toHaveBeenCalledTimes(1);
    await expect(args.onOpenChange).toHaveBeenLastCalledWith(true);
    await userEvent.keyboard(' ');
    await expect(args.onOpenChange).toHaveBeenCalledTimes(2);
  },
};
export const RejectedClose: Story = {
  args: { open: true, defaultValue: 'Ada', onOpenChange: fn(), onValueChange: fn() },
  play: async ({ canvas, userEvent, args }) => {
    const input = canvas.getByRole('searchbox');
    await userEvent.tab();
    await userEvent.keyboard('{Escape}');
    await expectFocus(input, input.parentElement!);
    await expect(input).toHaveValue('Ada');
    await expect(args.onOpenChange).toHaveBeenCalledTimes(1);
    await expect(args.onOpenChange).toHaveBeenLastCalledWith(false);
    await expect(args.onValueChange).toHaveBeenCalledTimes(0);
  },
};
export const RejectedQuery: Story = {
  args: { defaultOpen: true, value: 'Ada', onValueChange: fn() },
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Clear search' }));
    await expect(canvas.getByRole('searchbox')).toHaveValue('Ada');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith('');
  },
};
export const Keyboard: Story = {
  args: { onOpenChange: fn(), onValueChange: fn() },
  render: (args) => <><button style={fixtureButton}>Before</button><ExpandingSearch {...args} /><button style={fixtureButton}>After</button></>,
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.tab();
    await userEvent.tab();
    const trigger = canvas.getByRole('button', { name: 'Search members' });
    await expectFocus(trigger);
    await userEvent.keyboard(' ');
    const input = canvas.getByRole('searchbox');
    await expectFocus(input, input.parentElement!);
    await userEvent.keyboard('x');
    await expect(input).toHaveValue('x');
    await userEvent.tab();
    await expectFocus(canvas.getByRole('button', { name: 'Clear search' }));
    await userEvent.keyboard('{Enter}');
    await expectFocus(input, input.parentElement!);
    await expect(input).toHaveValue('');
    await userEvent.keyboard('y{Escape}');
    await expectFocus(trigger);
    await expect(args.onOpenChange).toHaveBeenCalledTimes(2);
    await expect(args.onValueChange).toHaveBeenCalledTimes(3);
    await userEvent.keyboard('{Enter}');
    await expect(canvas.getByRole('searchbox')).toHaveValue('y');
    await userEvent.tab();
    await userEvent.tab();
    await expect(input.ownerDocument.activeElement).toBe(canvas.getByRole('button', { name: 'After' }));
    await expect(canvas.queryByRole('searchbox')).toBeNull();
    await userEvent.tab({ shift: true });
    await expectFocus(trigger);
    await userEvent.keyboard('{Enter}');
    await userEvent.tab({ shift: true });
    await expect(input.ownerDocument.activeElement).toBe(canvas.getByRole('button', { name: 'Before' }));
    await expect(args.onOpenChange).toHaveBeenCalledTimes(6);
    await expect(canvas.queryByRole('searchbox')).toBeNull();
  },
};
export const CompositionAndVeto: Story = {
  args: { defaultOpen: true, defaultValue: 'Ada', onOpenChange: fn(), onValueChange: fn(), onKeyDown: (event) => { if (event.shiftKey) event.preventDefault(); } },
  play: async ({ canvas, userEvent, args }) => {
    const input = canvas.getByRole('searchbox');
    const event = new KeyboardEvent('keydown', { key: 'Escape', isComposing: true, bubbles: true, cancelable: true });
    fireEvent(input, event);
    await expect(event.defaultPrevented).toBe(false);
    await userEvent.click(input);
    await userEvent.keyboard('{Shift>}{Escape}{/Shift}');
    await expect(input).toHaveValue('Ada');
    await expect(args.onOpenChange).toHaveBeenCalledTimes(0);
    await expect(args.onValueChange).toHaveBeenCalledTimes(0);
  },
};
export const ExternalAria: Story = {
  args: { defaultOpen: true, 'aria-label': 'Fallback name', 'aria-labelledby': 'member-name missing-name', 'aria-describedby': 'member-help missing-help', description: 'Name or email.', error: 'No matches.' },
  render: (args) => <><span id="member-name">Find members</span><span id="member-help">Directory</span><ExpandingSearch {...args} /></>,
  play: async ({ canvas }) => {
    const input = canvas.getByRole('searchbox', { name: 'Find members' });
    await expect(input).toHaveAttribute('aria-label', 'Fallback name');
    await expect(input).toHaveAttribute('aria-labelledby', 'member-name missing-name');
    await expect(input.getAttribute('aria-describedby')).toContain('member-help missing-help');
    await expect(input).toHaveAccessibleDescription('Directory Name or email. No matches.');
  },
};
export const FalsyNodes: Story = {
  render: (args) => <div style={{ display: 'grid', gap: vars.space[4] }}>{([false, null, 0, ''] as const).map((node, index) => <ExpandingSearch {...args} key={index} defaultOpen triggerLabel={`Search ${index}`} label={node} description={node} error={node} searchIcon={node} clearIcon={node} messages={{ clear: node === 0 ? 'Clear search 0' : 'Clear search' }} aria-label={`Search ${index}`} defaultValue="x" />)}</div>,
  play: async ({ canvas }) => {
    const inputs = canvas.getAllByRole('searchbox');
    await expect(inputs).toHaveLength(4);
    for (const index of [0, 1]) await expect(inputs[index]).not.toHaveAttribute('aria-describedby');
    await expect(inputs[2]).toHaveAccessibleDescription('0 0');
    for (const input of [inputs[2]!, inputs[3]!]) {
      for (const id of input.getAttribute('aria-describedby')!.split(' ')) await expect(input.ownerDocument.getElementById(id)).not.toBeNull();
    }
    await expect(canvas.getAllByRole('alert')).toHaveLength(2);
  },
};
export const Disabled: Story = {
  args: { disabled: true, onOpenChange: fn() },
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(canvas.getByRole('button'));
    await expect(canvas.getByRole('button')).toBeDisabled();
    await expect(args.onOpenChange).toHaveBeenCalledTimes(0);
  },
};
export const DisabledOpen: Story = { args: { defaultOpen: true, disabled: true, defaultValue: 'Ada' } };
export const ReadOnly: Story = { args: { defaultOpen: true, readOnly: true, defaultValue: 'Ada' } };
export const ClearThenCollapse: Story = {
  args: { defaultOpen: true, defaultValue: 'Ada', onOpenChange: fn(), onValueChange: fn() },
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.tab();
    await userEvent.tab();
    await expectFocus(canvas.getByRole('button', { name: 'Clear search' }));
    await userEvent.keyboard('{Escape}');
    await expectFocus(canvas.getByRole('button', { name: 'Search members' }));
    await expect(args.onOpenChange).toHaveBeenCalledTimes(1);
    await expect(args.onOpenChange).toHaveBeenLastCalledWith(false);
    await expect(args.onValueChange).toHaveBeenCalledTimes(0);
  },
};
export const FormReset: Story = {
  args: { defaultValue: 'Ada', name: 'query', onValueChange: fn() },
  render: (args) => <form><ExpandingSearch {...args} /><button style={fixtureButton} type="reset">Reset query</button></form>,
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Search members' }));
    await userEvent.keyboard('x{Escape}');
    await userEvent.click(canvas.getByRole('button', { name: 'Reset query' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Search members' }));
    const input = canvas.getByRole('searchbox') as HTMLInputElement;
    await expect(input).toHaveValue('Ada');
    await expect(new FormData(input.form!).get('query')).toBe('Ada');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith('Adax');
  },
};
export const LightTheme: Story = { ...PersistentOpen, decorators: [withLightTheme], globals: { theme: 'light' } };
export const RTL: Story = {
  args: { defaultOpen: true, dir: 'rtl', defaultValue: 'Ada' },
  play: async ({ canvas }) => { await expect(getComputedStyle(canvas.getByRole('searchbox')).direction).toBe('rtl'); },
};
export const NarrowLane: Story = {
  render: (args) => <div style={{ inlineSize: 180 }}><ExpandingSearch {...args} /><button style={fixtureButton}>Neighbor</button></div>,
  play: async ({ canvas, userEvent, canvasElement }) => {
    const neighbor = canvas.getByRole('button', { name: 'Neighbor' });
    const before = neighbor.getBoundingClientRect();
    await userEvent.click(canvas.getByRole('button', { name: 'Search members' }));
    const root = canvasElement.querySelector('[data-ui="expanding-search"]')!;
    await waitFor(async () => { await expect(Math.abs(root.children[1]!.getBoundingClientRect().width - root.getBoundingClientRect().width)).toBeLessThan(1.1); });
    await expect(Math.abs(neighbor.getBoundingClientRect().top - before.top)).toBeLessThan(1.1);
    await expect(Math.abs(neighbor.getBoundingClientRect().left - before.left)).toBeLessThan(1.1);
  },
};
export const RefAndStyles: Story = {
  args: { defaultOpen: true, ref: fn(), inputRef: fn(), style: { letterSpacing: '0.1em' }, sx: { paddingBlock: vars.space[3] }, slotProps: { control: { css: { fontWeight: vars.fontWeight.medium } } } },
  play: async ({ canvas, canvasElement, args }) => {
    const root = canvasElement.querySelector('[data-ui="expanding-search"]')!;
    const input = canvas.getByRole('searchbox');
    await expect(args.ref).toHaveBeenLastCalledWith(root);
    await expect(args.inputRef).toHaveBeenLastCalledWith(input);
    await expect(parseFloat(getComputedStyle(root).paddingBlockStart)).toBeGreaterThan(10);
    await expect(getComputedStyle(input).fontWeight).toBe('500');
    await expect(input.style.letterSpacing).toBe('0.1em');
  },
};
export const ForcedColors: Story = { ...PersistentOpen, parameters: { docs: { description: { story: 'Structural example. Enable forced colors in the browser to check borders and focus; media emulation is not automated in this story.' } } } };
export const ReducedMotion: Story = { parameters: { docs: { description: { story: 'Structural example. Enable reduced motion in the browser to check instant expansion; media emulation is not automated in this story.' } } } };
