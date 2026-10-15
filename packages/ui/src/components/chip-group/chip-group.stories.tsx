import { StrictMode, useState, type ComponentPropsWithRef, type ReactNode } from 'react';
import type { Meta, StoryContext, StoryObj } from '@storybook/react-vite';
import { expect, fn, within, waitFor } from 'storybook/test';
import { base } from '@jfrader/tokens';
import { vars } from '@jfrader/tokens/vars';
import { css } from '../../styling/css';
import { withLightTheme } from '../../testing/story-decorators';
// `styled` is the app-facing styling API; consumers import it from `@jfrader/ui`.
import { styled } from '../../index';
import { ThemeRoot } from '../theme-root';
import { ChipGroup, type ChipGroupProps, type ChipGroupMultipleProps } from './index';

const Stack = styled.div({ display: 'grid', gap: vars.space[4] });
const ConstrainedFrame = styled.div({ maxInlineSize: '22rem' });
const FixtureButton = styled.button({
  minBlockSize: vars.space[8],
  minInlineSize: vars.space[8],
});
const ResizeContainer = styled.div({ inlineSize: '24rem' });

// The slot API takes `css` values, so this story keeps the documented spelling.
const slotChipGroupStyle = css({ paddingBlockStart: vars.space[1] });
const slotFrameStyle = css({ paddingBlockEnd: vars.space[1] });
const slotRowStyle = css({ gap: vars.space[3] });
const slotChipStyle = css({ borderRadius: vars.radius.sm });
const slotLabelStyle = css({ fontWeight: vars.fontWeight.semibold });
const slotCheckStyle = css({ alignSelf: 'flex-start' });
const slotOverflowStyle = css({ borderRadius: vars.radius.md });

const OPTIONS = [
  { value: 'design', label: 'Design' },
  { value: 'code', label: 'Code' },
  { value: 'research', label: 'Research' },
  { value: 'writing', label: 'Writing' },
  { value: 'testing', label: 'Testing' },
  { value: 'delivery', label: 'Delivery' },
];
const SIZE_PX = { sm: Number.parseFloat(base.space[8]), md: Number.parseFloat(base.space[10]) };

function SlotChip(props: ComponentPropsWithRef<'button'>) {
  return <button {...props} data-slot="chip-group-chip" />;
}

export const ChipReplacement: Story = {
  render: (args) => <ChipGroup {...args} slots={{ chip: SlotChip }} />,
  play: async ({ canvasElement, userEvent }) => {
    const chip = within(canvasElement).getByRole('button', { name: 'Design' });
    await expect(chip).toHaveAttribute('data-slot', 'chip-group-chip');
    await expect(chip).toHaveAttribute('data-ui', 'chip-group-chip');
    await expect(getComputedStyle(chip).alignItems).toBe('center');
    await expect(chip).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(chip);
    await expect(chip).toHaveAttribute('aria-pressed', 'true');
    await expect(canvasElement.querySelector('[data-ui="chip-group-chip"]:not([data-slot])')).toBeNull();
  },
};
const OVERFLOW = { maxVisible: 2, moreLabel: (count: string) => `+${count} more`, lessLabel: 'Show less' };
const meta = {
  title: 'Inputs/ChipGroup',
  component: ChipGroup,
  tags: ['autodocs'],
  args: { options: OPTIONS, label: 'Topics' },
  parameters: {
    docs: {
      description: {
        component:
          'Choose filters and clear them when they are no longer needed.',
      },
      usage: `- Multiple values are reported in option order.
- Selected filters stay visible when the group is collapsed.

### Keyboard
- Arrows move focus without changing selection; horizontal arrows follow text direction.
- Home/End move to the first/last enabled item. Enter/Space toggle selection.`,
      source: {
        code: '<ChipGroup label="Topics" options={[{ value: "design", label: "Design" }, { value: "code", label: "Code" }]} />',
      },
    },
  },
} satisfies Meta<typeof ChipGroup>;
export default meta;
type Story = Omit<StoryObj<ChipGroupProps>, 'render' | 'play'> & {
  render?: (args: ChipGroupProps) => ReactNode;
  play?: (context: StoryContext<ChipGroupProps>) => Promise<void>;
};

export const Default: Story = { render: (args) => <ChipGroup {...args} /> };
export const SingleClearable: Story = {
  args: { type: 'single', defaultValue: 'design', onValueChange: fn() },
  play: async ({ canvasElement, args, userEvent }) => {
    const canvas = within(canvasElement);
    const design = canvas.getByRole('button', { name: 'Design' });
    await expect(canvas.queryByRole('radiogroup')).not.toBeInTheDocument();
    await userEvent.click(design);
    await expect(design).toHaveAttribute('aria-pressed', 'false');
    await expect(args.onValueChange).toHaveBeenNthCalledWith(1, '');
    await userEvent.keyboard('{Enter}');
    await expect(design).toHaveAttribute('aria-pressed', 'true');
    await expect(args.onValueChange).toHaveBeenNthCalledWith(2, 'design');
    await userEvent.keyboard(' ');
    await expect(args.onValueChange).toHaveBeenNthCalledWith(3, '');
    await expect(args.onValueChange).toHaveBeenCalledTimes(3);
  },
};
export const SingleNonclearable: Story = {
  args: { type: 'single', defaultValue: 'design', allowEmpty: false, onValueChange: fn() },
  play: async ({ canvasElement, args, userEvent }) => {
    const design = within(canvasElement).getByRole('button', { name: 'Design' });
    await userEvent.click(design);
    await userEvent.keyboard('{Enter} ');
    await expect(design).toHaveAttribute('aria-pressed', 'true');
    await expect(args.onValueChange).not.toHaveBeenCalled();
  },
};
export const Multiple: Story = {
  args: { type: 'multiple', defaultValue: ['research'], onValueChange: fn() },
  play: async ({ canvasElement, args, userEvent }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Delivery' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Design' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Research' }));
    await expect(args.onValueChange).toHaveBeenNthCalledWith(1, ['research', 'delivery']);
    await expect(args.onValueChange).toHaveBeenNthCalledWith(2, ['design', 'research', 'delivery']);
    await expect(args.onValueChange).toHaveBeenNthCalledWith(3, ['design', 'delivery']);
    await expect(args.onValueChange).toHaveBeenCalledTimes(3);
  },
};
export const Sizes: Story = {
  render: (args) => (
    <Stack>
      <ChipGroup {...args} size="sm" />
      <ChipGroup {...args} size="md" />
    </Stack>
  ),
  play: async ({ canvasElement }) => {
    const heights = [SIZE_PX.sm, SIZE_PX.md];
    for (const [index, group] of within(canvasElement).getAllByRole('group').entries()) {
      for (const button of within(group).getAllByRole('button'))
        await expect(button.getBoundingClientRect().height).toBeCloseTo(heights[index]!, 1);
    }
  },
};
export const Overflow: Story = {
  args: { ...OVERFLOW, onExpandedChange: fn() },
  play: async ({ canvasElement, args, userEvent }) => {
    const canvas = within(canvasElement);
    const more = canvas.getByRole('button', { name: '+4 more' });
    const row = canvasElement.ownerDocument.getElementById(more.getAttribute('aria-controls')!);
    await expect(row).toContainElement(more);
    await userEvent.click(more);
    await expect(more).toHaveAttribute('aria-expanded', 'true');
    await expect(canvas.getByRole('button', { name: 'Delivery' })).toBeInTheDocument();
    await userEvent.click(canvas.getByRole('button', { name: 'Show less' }));
    await expect(canvas.queryByRole('button', { name: 'Delivery' })).not.toBeInTheDocument();
    await expect(args.onExpandedChange).toHaveBeenNthCalledWith(1, true);
    await expect(args.onExpandedChange).toHaveBeenNthCalledWith(2, false);
    await expect(args.onExpandedChange).toHaveBeenCalledTimes(2);
  },
};
export const Expanded: Story = { args: { ...OVERFLOW, defaultExpanded: true, defaultValue: ['delivery'] } };
export const SelectedBeyondCutoff: Story = {
  args: { ...OVERFLOW, defaultValue: ['delivery'], onValueChange: fn() },
  play: async ({ canvasElement, args, userEvent }) => {
    const canvas = within(canvasElement);
    const delivery = canvas.getByRole('button', { name: 'Delivery' });
    await expect(delivery).toHaveAttribute('aria-pressed', 'true');
    await expect(canvas.getByRole('button', { name: '+3 more' })).toBeInTheDocument();
    await userEvent.click(delivery);
    await expect(delivery).toHaveAttribute('aria-pressed', 'false');
    await expect(canvasElement.ownerDocument.activeElement).toBe(delivery);
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenCalledWith([]);
    await userEvent.click(canvas.getByRole('button', { name: '+3 more' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Show less' }));
    await expect(canvas.queryByRole('button', { name: 'Delivery' })).not.toBeInTheDocument();
  },
};
export const AllPinnedNoOverflow: Story = {
  args: { ...OVERFLOW, defaultValue: OPTIONS.slice(OVERFLOW.maxVisible).map((option) => option.value) },
  play: async ({ canvasElement, userEvent }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getAllByRole('button')).toHaveLength(OPTIONS.length);
    await expect(canvas.queryByRole('button', { expanded: false })).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole('button', { name: 'Delivery' }));
    await expect(canvas.getByRole('button', { name: 'Delivery' })).toHaveAttribute('aria-pressed', 'false');
    await expect(canvas.queryByRole('button', { expanded: false })).not.toBeInTheDocument();
  },
};
export const WrappedLongLabels: Story = {
  args: {
    options: [...OPTIONS, { value: 'long', label: 'Internationalization and accessibility engineering' }],
    defaultValue: ['long'],
  },
  render: (args) => (
    <ConstrainedFrame>
      <ChipGroup {...args} />
    </ConstrainedFrame>
  ),
  play: async ({ canvasElement }) => {
    const group = within(canvasElement).getByRole('group');
    for (const button of within(group).getAllByRole('button')) {
      await expect(button.getBoundingClientRect().width).toBeLessThanOrEqual(group.getBoundingClientRect().width + 1);
    }
    await expect(
      within(canvasElement).getByRole('button', { name: 'Internationalization and accessibility engineering' }),
    ).toBeInTheDocument();
  },
};
export const DisabledGroup: Story = {
  args: { ...OVERFLOW, disabled: true, defaultValue: ['design'], onValueChange: fn(), onExpandedChange: fn() },
  play: async ({ canvasElement, args, userEvent }) => {
    for (const button of within(canvasElement).getAllByRole('button')) {
      await expect(button).toBeDisabled();
      await expect(button.tabIndex).toBe(-1);
      await userEvent.click(button);
    }
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await expect(args.onExpandedChange).not.toHaveBeenCalled();
  },
};
export const DisabledOption: Story = {
  args: {
    options: OPTIONS.map((option) => ({ ...option, disabled: option.value === 'code' })),
    defaultValue: ['code'],
  },
  play: async ({ canvasElement }) => {
    const disabled = within(canvasElement).getByRole('button', { name: 'Code' });
    await expect(disabled).toBeDisabled();
    await expect(getComputedStyle(disabled).borderTopStyle).toBe('dashed');
  },
};
export const EmptyOptions: Story = {
  args: { options: [] },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('group', { name: 'Topics' })).toBeInTheDocument();
    await expect(within(canvasElement).queryAllByRole('button')).toHaveLength(0);
  },
};
function Controlled(props: ChipGroupMultipleProps) {
  const [value, setValue] = useState<readonly string[]>([]);
  const [expanded, setExpanded] = useState(false);
  return (
    <ChipGroup
      {...props}
      value={value}
      expanded={expanded}
      onValueChange={(next) => {
        setValue(next);
        props.onValueChange?.(next);
      }}
      onExpandedChange={(next) => {
        setExpanded(next);
        props.onExpandedChange?.(next);
      }}
    />
  );
}
export const ControlledSelection: Story = {
  args: { type: 'multiple', onValueChange: fn() },
  render: (args) => <Controlled {...(args as ChipGroupMultipleProps)} />,
  play: async ({ canvasElement, args, userEvent }) => {
    const button = within(canvasElement).getByRole('button', { name: 'Code' });
    await userEvent.click(button);
    await expect(button).toHaveAttribute('aria-pressed', 'true');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenCalledWith(['code']);
  },
};
export const ControlledExpansion: Story = {
  args: { type: 'multiple', ...OVERFLOW, onExpandedChange: fn() },
  render: (args) => <Controlled {...(args as ChipGroupMultipleProps)} />,
  play: async ({ canvasElement, args, userEvent }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: '+4 more' }));
    await expect(within(canvasElement).getByRole('button', { name: 'Show less' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    await expect(args.onExpandedChange).toHaveBeenCalledTimes(1);
    await expect(args.onExpandedChange).toHaveBeenCalledWith(true);
  },
};
export const ControlledRejected: Story = {
  args: { ...OVERFLOW, value: [], expanded: false, onValueChange: fn(), onExpandedChange: fn() },
  play: async ({ canvasElement, args, userEvent }) => {
    const canvas = within(canvasElement);
    const code = canvas.getByRole('button', { name: 'Code' });
    await userEvent.click(code);
    await userEvent.keyboard('{Enter} ');
    await expect(code).toHaveAttribute('aria-pressed', 'false');
    await expect(code.tabIndex).toBe(0);
    await expect(args.onValueChange).toHaveBeenCalledTimes(3);
    for (let call = 1; call <= 3; call++) await expect(args.onValueChange).toHaveBeenNthCalledWith(call, ['code']);
    await userEvent.click(canvas.getByRole('button', { name: '+4 more' }));
    await expect(canvas.getByRole('button', { name: '+4 more' })).toHaveAttribute('aria-expanded', 'false');
    await expect(canvas.queryByRole('button', { name: 'Delivery' })).not.toBeInTheDocument();
    await expect(args.onExpandedChange).toHaveBeenCalledTimes(1);
    await expect(args.onExpandedChange).toHaveBeenCalledWith(true);
  },
};
export const ControlledSingleEmpty: Story = {
  args: { type: 'single', value: '', defaultValue: 'design', onValueChange: fn() },
  play: async ({ canvasElement, args, userEvent }) => {
    const design = within(canvasElement).getByRole('button', { name: 'Design' });
    await expect(design).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(design);
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenCalledWith('design');
    await expect(design).toHaveAttribute('aria-pressed', 'false');
  },
};
export const AllDisabled: Story = {
  args: { options: OPTIONS.map((option) => ({ ...option, disabled: true })) },
  play: async ({ canvasElement, userEvent }) => {
    const buttons = within(canvasElement).getAllByRole('button');
    await userEvent.tab();
    await expect(buttons).not.toContain(canvasElement.ownerDocument.activeElement);
    for (const button of buttons) await expect(button.tabIndex).toBe(-1);
  },
};
export const NativeCancellation: Story = {
  args: {
    ...OVERFLOW,
    onValueChange: fn(),
    onExpandedChange: fn(),
    slotProps: {
      chip: { onClick: (event) => event.preventDefault() },
      overflow: { onClick: (event) => event.preventDefault() },
    },
    onKeyDown: (event) => event.preventDefault(),
  },
  play: async ({ canvasElement, args, userEvent }) => {
    const canvas = within(canvasElement);
    const design = canvas.getByRole('button', { name: 'Design' });
    await userEvent.click(design);
    await userEvent.keyboard('{ArrowRight}');
    await expect(canvasElement.ownerDocument.activeElement).toBe(design);
    await expect(design).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(canvas.getByRole('button', { name: '+4 more' }));
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await expect(args.onExpandedChange).not.toHaveBeenCalled();
  },
};
const rootCleanupSpy = fn();
const chipCleanupSpy = fn();
const rootRefSpy = fn((node: HTMLDivElement | null) => (node ? rootCleanupSpy : undefined));
const chipRefSpy = fn((node: HTMLButtonElement | null) => (node ? chipCleanupSpy : undefined));
function RefFixture(props: ChipGroupProps) {
  const [mounted, setMounted] = useState(true);
  return (
    <StrictMode>
      {mounted && <ChipGroup {...props} css={slotChipGroupStyle} />}
      <FixtureButton type="button" onClick={() => setMounted(!mounted)}>
        {mounted ? 'Hide filters' : 'Show filters'}
      </FixtureButton>
    </StrictMode>
  );
}
export const StylingAndRefs: Story = {
  args: {
    ...OVERFLOW,
    ref: rootRefSpy,
    sx: { paddingBlockStart: vars.space[2] },
    slotProps: {
      frame: { css: slotFrameStyle },
      row: { css: slotRowStyle },
      chip: (option) => ({
        ref: option.value === 'design' ? chipRefSpy : undefined,
        css: slotChipStyle,
      }),
      label: { css: slotLabelStyle },
      check: { css: slotCheckStyle },
      overflow: { css: slotOverflowStyle },
    },
  },
  render: (args) => <RefFixture {...args} />,
  play: async ({ canvasElement, userEvent }) => {
    const canvas = within(canvasElement);
    const root = canvas.getByRole('group');
    const design = canvas.getByRole('button', { name: 'Design' });
    await expect(rootRefSpy).toHaveBeenCalledWith(root);
    await expect(chipRefSpy).toHaveBeenCalledWith(design);
    await expect(getComputedStyle(root).paddingBlockStart).toBe('8px');
    await expect(getComputedStyle(root.firstElementChild!).paddingBlockEnd).toBe('4px');
    await expect(getComputedStyle(root.firstElementChild!.firstElementChild!).gap).toBe('12px');
    await expect(getComputedStyle(design).borderRadius).toBe('8px');
    await expect(getComputedStyle(design.lastElementChild!).fontWeight).toBe('600');
    await expect(getComputedStyle(design.firstElementChild!).alignSelf).toBe('flex-start');
    await expect(getComputedStyle(canvas.getByRole('button', { name: '+4 more' })).borderRadius).toBe('12px');
    await userEvent.click(canvas.getByRole('button', { name: 'Hide filters' }));
    await expect(rootCleanupSpy).toHaveBeenCalled();
    await expect(chipCleanupSpy).toHaveBeenCalled();
    await userEvent.click(canvas.getByRole('button', { name: 'Show filters' }));
    await expect(rootRefSpy).toHaveBeenCalledWith(canvas.getByRole('group'));
    await expect(chipRefSpy).toHaveBeenCalledWith(canvas.getByRole('button', { name: 'Design' }));
  },
};
function ExternalUpdatesFixture(props: ChipGroupMultipleProps) {
  const [options, setOptions] = useState(props.options);
  const [value, setValue] = useState<readonly string[]>(['unknown']);
  return (
    <>
      <ChipGroup
        {...props}
        options={options}
        value={value}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setOptions(options.filter((option) => option.value !== 'code'));
        }}
      />
      <FixtureButton type="button" onClick={() => setValue(['delivery'])}>
        Set Delivery
      </FixtureButton>
    </>
  );
}
export const ExternalUpdatesAndRemoval: Story = {
  args: { type: 'multiple', onValueChange: fn() },
  render: (args) => <ExternalUpdatesFixture {...(args as ChipGroupMultipleProps)} />,
  play: async ({ canvasElement, args, userEvent }) => {
    const canvas = within(canvasElement);
    await userEvent.tab();
    await userEvent.keyboard('{ArrowRight}{Escape}');
    await expect(canvas.queryByRole('button', { name: 'Code' })).not.toBeInTheDocument();
    await expect(canvasElement.ownerDocument.activeElement).toBe(canvas.getByRole('button', { name: 'Design' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Set Delivery' }));
    await expect(canvas.getByRole('button', { name: 'Delivery' })).toHaveAttribute('aria-pressed', 'true');
    await expect(args.onValueChange).not.toHaveBeenCalled();
  },
};
export const Keyboard: Story = {
  args: {
    ...OVERFLOW,
    options: OPTIONS.map((option) => ({ ...option, disabled: option.value === 'code' })),
    onValueChange: fn(),
  },
  render: (args) => (
    <>
      <ChipGroup {...args} />
      <FixtureButton type="button">
        After
      </FixtureButton>
    </>
  ),
  play: async ({ canvasElement, args, userEvent }) => {
    const canvas = within(canvasElement);
    const design = canvas.getByRole('button', { name: 'Design' });
    const more = canvas.getByRole('button', { name: '+4 more' });
    await userEvent.tab();
    await expect(canvasElement.ownerDocument.activeElement).toBe(design);
    await expect(getComputedStyle(design).outlineStyle).not.toBe('none');
    await userEvent.keyboard('{ArrowRight}');
    await expect(canvasElement.ownerDocument.activeElement).toBe(more);
    await userEvent.keyboard('{ArrowDown}');
    await expect(canvasElement.ownerDocument.activeElement).toBe(design);
    await userEvent.keyboard('{ArrowLeft}');
    await expect(canvasElement.ownerDocument.activeElement).toBe(more);
    await userEvent.keyboard('{ArrowUp}');
    await expect(canvasElement.ownerDocument.activeElement).toBe(design);
    await userEvent.keyboard('{End}');
    await expect(canvasElement.ownerDocument.activeElement).toBe(more);
    await userEvent.keyboard('{Home}');
    await expect(canvasElement.ownerDocument.activeElement).toBe(design);
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await userEvent.keyboard(' ');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenCalledWith(['design']);
    await userEvent.tab();
    await expect(canvas.getByRole('button', { name: 'After' })).toHaveFocus();
    await userEvent.tab({ shift: true });
    await expect(canvasElement.ownerDocument.activeElement).toBe(design);
  },
};
export const RTL: Story = {
  args: { dir: 'rtl' },
  play: async ({ canvasElement, userEvent }) => {
    const canvas = within(canvasElement);
    await userEvent.tab();
    await userEvent.keyboard('{ArrowLeft}');
    await expect(canvas.getByRole('button', { name: 'Code' })).toHaveFocus();
    await userEvent.keyboard('{ArrowRight}{ArrowRight}');
    await expect(canvas.getByRole('button', { name: 'Delivery' })).toHaveFocus();
    await userEvent.keyboard('{ArrowDown}');
    await expect(canvas.getByRole('button', { name: 'Design' })).toHaveFocus();
  },
};
export const AriaMerge: Story = {
  args: {
    'aria-label': 'Explicit topics',
    'aria-labelledby': 'topic-title unresolved',
    'aria-describedby': 'topic-help unresolved',
  },
  render: (args) => (
    <>
      <span id="topic-title">Filter topics</span>
      <span id="topic-help">Choose topics</span>
      <ChipGroup {...args} />
    </>
  ),
  play: async ({ canvasElement }) => {
    const group = within(canvasElement).getByRole('group', { name: 'Filter topics' });
    await expect(group).toHaveAttribute('aria-label', 'Explicit topics');
    await expect(group).toHaveAttribute('aria-labelledby', 'topic-title unresolved');
    await expect(group).toHaveAttribute('aria-describedby', 'topic-help unresolved');
  },
};
export const FalsyLabel: Story = {
  args: {
    options: [false, null, 0, ''].map((label, index) => ({ value: String(index), label })),
    slotProps: { chip: (option) => ({ 'aria-label': option.label === 0 ? 'Option 0' : `Option ${option.value}` }) },
  },
  play: async ({ canvasElement }) => {
    const buttons = within(canvasElement).getAllByRole('button');
    for (const [index, button] of buttons.entries())
      await expect(button.querySelectorAll(':scope > span:not([aria-hidden])')).toHaveLength(index >= 2 ? 1 : 0);
    await expect(buttons[2]).toHaveTextContent('0');
  },
};
function CollapseFixture(props: ChipGroupProps) {
  const [expanded, setExpanded] = useState(true);
  return (
    <ChipGroup
      {...props}
      expanded={expanded}
      onExpandedChange={setExpanded}
      onKeyDown={(event) => {
        if (event.key === 'Escape') setExpanded(false);
      }}
    />
  );
}
export const CollapseFocusRecovery: Story = {
  args: { ...OVERFLOW },
  render: (args) => <CollapseFixture {...args} />,
  play: async ({ canvasElement, userEvent }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Delivery' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Delivery' }));
    await userEvent.keyboard('{Escape}');
    await expect(canvas.queryByRole('button', { name: 'Delivery' })).not.toBeInTheDocument();
    await expect(canvasElement.ownerDocument.activeElement).toBe(canvas.getByRole('button', { name: '+4 more' }));
  },
};
export const RapidToggle: Story = {
  args: { ...OVERFLOW, onExpandedChange: fn() },
  play: async ({ canvasElement, args, userEvent }) => {
    const canvas = within(canvasElement);
    for (let index = 0; index < 4; index++) {
      await userEvent.click(canvas.getByRole('button', { name: '+4 more' }));
      await userEvent.click(canvas.getByRole('button', { name: 'Show less' }));
    }
    await expect(args.onExpandedChange).toHaveBeenCalledTimes(8);
    await waitFor(async () => {
      await expect((canvas.getByRole('group').firstElementChild as HTMLElement).style.height).toBe('auto');
    });
    await expect(canvas.getAllByRole('button').filter((button) => button.tabIndex === 0)).toHaveLength(1);
  },
};
function heightFrameParts(group: HTMLElement) {
  const frame = group.firstElementChild as HTMLElement;
  return { frame, row: frame.firstElementChild as HTMLElement };
}
async function expectFrameReleased(frame: HTMLElement, row: HTMLElement) {
  await new Promise(requestAnimationFrame);
  await waitFor(async () => {
    await expect(frame.style.height).toBe('auto');
    await expect(frame.getBoundingClientRect().height).toBeCloseTo(row.getBoundingClientRect().height, 1);
  });
}
export const ResizeRelease: Story = {
  args: { ...OVERFLOW },
  render: (args) => (
    <ResizeContainer>
      <ChipGroup {...args} />
    </ResizeContainer>
  ),
  play: async ({ canvasElement, userEvent }) => {
    const canvas = within(canvasElement);
    const group = canvas.getByRole('group');
    const container = group.parentElement!;
    const { frame, row } = heightFrameParts(group);
    await userEvent.click(canvas.getByRole('button', { name: '+4 more' }));
    await new Promise(requestAnimationFrame);
    await expect(frame.style.height).toMatch(/px$/);
    const expandedHeight = row.getBoundingClientRect().height;
    container.style.inlineSize = '10rem';
    await expectFrameReleased(frame, row);
    await expect(row.getBoundingClientRect().height).toBeGreaterThan(expandedHeight);
    const narrowHeight = row.getBoundingClientRect().height;
    for (const button of within(group).getAllByRole('button')) button.style.fontSize = `calc(${vars.textSize.md} * 2)`;
    await waitFor(async () => {
      await expect(row.getBoundingClientRect().height).toBeGreaterThan(narrowHeight);
    });
    await expectFrameReleased(frame, row);
    await userEvent.click(canvas.getByRole('button', { name: 'Show less' }));
    await expectFrameReleased(frame, row);
  },
};
export const LightTheme: Story = {
  decorators: [withLightTheme],
  globals: { theme: 'light' },
  args: { defaultValue: ['design'] },
};
export const ScopedTheme: Story = {
  args: { defaultValue: ['code'] },
  render: (args) => (
    <ThemeRoot theme="light" sx={{ backgroundColor: vars.color.bg, padding: vars.space[4] }}>
      <ChipGroup {...args} />
    </ThemeRoot>
  ),
};
export const ReducedMotion: Story = {
  args: { ...OVERFLOW, defaultValue: ['design'] },
  parameters: {
    docs: {
      description: {
        story: 'Enable reduced motion in the browser to check this example. The play does not set media preferences.',
      },
    },
  },
};
export const ForcedColors: Story = {
  args: { defaultValue: ['design'] },
  parameters: {
    docs: {
      description: {
        story: 'Enable forced colors in the browser to check this example. The play does not set the preference.',
      },
    },
  },
};
