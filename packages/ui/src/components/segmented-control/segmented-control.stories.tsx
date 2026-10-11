import { useId, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, waitFor } from 'storybook/test';
import { withLightTheme } from '../../testing/story-decorators';
import { ThemeRoot } from '../theme-root';
import { SegmentedControl, type SegmentedControlProps } from './index';

const OPTIONS = ['List', 'Grid', 'Board', 'Table'];
const LONG_OPTIONS = ['Recent projects', 'Assigned to me', 'Shared with the team', 'Archived projects'];
const usage = `<SegmentedControl label="Layout" defaultValue="List">
  <SegmentedControl.Item value="List">List</SegmentedControl.Item>
  <SegmentedControl.Item value="Grid">Grid</SegmentedControl.Item>
</SegmentedControl>`;

function Example({
  options = OPTIONS,
  disabledOption = 'Board',
  allDisabled = false,
  ...args
}: SegmentedControlProps & { options?: string[]; disabledOption?: string; allDisabled?: boolean }) {
  return (
    <SegmentedControl {...args}>
      {options.map((option) => (
        <SegmentedControl.Item
          key={option}
          value={option}
          disabled={allDisabled || option === disabledOption}
        >
          {option}
        </SegmentedControl.Item>
      ))}
    </SegmentedControl>
  );
}

const meta = {
  title: 'Inputs/SegmentedControl',
  component: SegmentedControl,
  tags: ['autodocs'],
  args: { label: 'Layout', defaultValue: 'List', onValueChange: fn() },
  render: (args) => <Example {...args} />,
  parameters: {
    docs: {
      source: { code: usage },
      description: {
        component:
          'An immediate, single-choice radio group. Unlike Tabs it owns no panels; unlike ToggleGroup it selects on arrow movement and cannot clear a selected choice. Tab enters the last focused enabled option, then exits. Arrow keys select and wrap, skipping disabled options; horizontal arrows reverse in RTL. Home/End select the first/last enabled option. Space/Enter select once through the native button click. Values must be unique; accessories must be noninteractive. Use RadioGroup for form values.',
      },
    },
  },
} satisfies Meta<typeof SegmentedControl>;
export default meta;
type Story = StoryObj<typeof meta>;

async function assertFocus(item: HTMLElement) {
  await expect(item.ownerDocument.activeElement).toBe(item);
  await expect(item.tabIndex).toBe(0);
  await expect(getComputedStyle(item).outlineStyle).not.toBe('none');
}

function contrastRatio(document: Document, first: string, second: string) {
  const context = document.createElement('canvas').getContext('2d')!;
  const luminance = (color: string) => {
    context.fillStyle = color;
    context.fillRect(0, 0, 1, 1);
    const channels = Array.from(context.getImageData(0, 0, 1, 1).data).slice(0, 3);
    return channels
      .map((channel) => {
        const value = channel / 255;
        return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
      })
      .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index]!, 0);
  };
  const a = luminance(first);
  const b = luminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

export const Default: Story = {
  play: async ({ canvas }) => {
    const group = canvas.getByRole('radiogroup');
    const selected = canvas.getByRole('radio', { checked: true });
    const pill = selected.querySelector<HTMLElement>('[data-ui="segmented-control-selection"]')!;
    const background = getComputedStyle(pill).backgroundColor;
    const document = group.ownerDocument;
    await expect(
      contrastRatio(document, getComputedStyle(selected).color, background),
    ).toBeGreaterThanOrEqual(4.5);
    await expect(
      contrastRatio(document, getComputedStyle(selected).borderColor, background),
    ).toBeGreaterThanOrEqual(3);
    await expect(
      contrastRatio(document, getComputedStyle(group).borderColor, getComputedStyle(group).backgroundColor),
    ).toBeGreaterThanOrEqual(3);
  },
};
export const Soft: Story = { ...Default, args: { variant: 'soft' } };
export const Solid: Story = { ...Default, args: { variant: 'solid' } };
export const LightTheme: Story = { ...Default, decorators: [withLightTheme] };
export const LightSolid: Story = { ...Default, decorators: [withLightTheme], args: { variant: 'solid' } };
export const ScopedTheme: Story = {
  render: (args) => (
    <ThemeRoot theme="light">
      <Example {...args} />
    </ThemeRoot>
  ),
};
export const Sizes: Story = {
  render: (args) => (
    <div style={{ display: 'grid', gap: 16, justifyItems: 'start' }}>
      {(['sm', 'md', 'lg'] as const).map((size) => (
        <Example {...args} key={size} size={size} label={`${size} layout`} />
      ))}
    </div>
  ),
  play: async ({ canvas }) => {
    for (const [index, group] of canvas.getAllByRole('radiogroup').entries()) {
      await expect(group.querySelector('button')!.getBoundingClientRect().height).toBeGreaterThanOrEqual(
        [32, 40, 48][index]!,
      );
    }
  },
};

export const Keyboard: Story = {
  render: (args) => (
    <>
      <button>Before</button>
      <Example {...args} />
      <button>After</button>
    </>
  ),
  play: async ({ canvas, userEvent, args }) => {
    const list = canvas.getByRole('radio', { name: 'List' });
    const grid = canvas.getByRole('radio', { name: 'Grid' });
    const table = canvas.getByRole('radio', { name: 'Table' });
    await userEvent.tab();
    await userEvent.tab();
    await assertFocus(list);
    const sequence = [
      ['{ArrowRight}', grid],
      ['{ArrowDown}', table],
      ['{ArrowRight}', list],
      ['{ArrowLeft}', table],
      ['{ArrowUp}', grid],
      ['{Home}', list],
      ['{End}', table],
    ] as const;
    for (const [key, target] of sequence) {
      await userEvent.keyboard(key);
      await assertFocus(target);
      await expect(target).toHaveAttribute('aria-checked', 'true');
    }
    await expect(args.onValueChange).toHaveBeenCalledTimes(7);
    await userEvent.keyboard('{Enter} ');
    await expect(args.onValueChange).toHaveBeenCalledTimes(7);
    await userEvent.tab();
    await expect(canvas.getByRole('button', { name: 'After' })).toHaveFocus();
    await userEvent.tab({ shift: true });
    await assertFocus(table);
    await userEvent.tab({ shift: true });
    await expect(canvas.getByRole('button', { name: 'Before' })).toHaveFocus();
  },
};

export const Uncontrolled: Story = {
  args: { defaultValue: undefined },
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.tab();
    await userEvent.keyboard('{Enter}');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith('List');
    await userEvent.click(canvas.getByRole('radio', { name: 'Grid' }));
    await expect(args.onValueChange).toHaveBeenCalledTimes(2);
    await expect(canvas.getByRole('radio', { name: 'Grid' })).toHaveAttribute('aria-checked', 'true');
  },
};

export const Rejects: Story = {
  args: { value: 'List' },
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.tab();
    await userEvent.keyboard('{ArrowRight}');
    await assertFocus(canvas.getByRole('radio', { name: 'Grid' }));
    await expect(canvas.getByRole('radio', { name: 'List' })).toHaveAttribute('aria-checked', 'true');
    await expect(
      canvas.getByRole('radio', { name: 'List' }).querySelector('[data-ui="segmented-control-selection"]'),
    ).not.toBeNull();
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await userEvent.keyboard('{ArrowLeft}');
    await assertFocus(canvas.getByRole('radio', { name: 'List' }));
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await userEvent.keyboard('{End}');
    await expect(args.onValueChange).toHaveBeenCalledTimes(2);
    await userEvent.keyboard('{Enter}');
    await expect(args.onValueChange).toHaveBeenCalledTimes(3);
    await userEvent.keyboard(' ');
    await expect(args.onValueChange).toHaveBeenCalledTimes(4);
    await userEvent.keyboard('{ArrowUp}');
    await assertFocus(canvas.getByRole('radio', { name: 'Grid' }));
    await expect(args.onValueChange).toHaveBeenCalledTimes(5);
  },
};

function ControlledExample(args: SegmentedControlProps) {
  const [value, setValue] = useState('List');
  return (
    <>
      <Example
        {...args}
        value={value}
        onValueChange={(next) => {
          args.onValueChange?.(next);
          setValue(next);
        }}
      />
      <button onClick={() => setValue('Table')}>Set table</button>
    </>
  );
}
export const Controlled: Story = {
  render: (args) => <ControlledExample {...args} />,
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(canvas.getByRole('radio', { name: 'Grid' }));
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(canvas.getByRole('radio', { name: 'Grid' })).toHaveAttribute('aria-checked', 'true');
    await userEvent.click(canvas.getByRole('button', { name: 'Set table' }));
    await expect(canvas.getByRole('radio', { name: 'Table' })).toHaveAttribute('aria-checked', 'true');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
  },
};

export const NoSelection: Story = {
  args: { defaultValue: undefined },
  play: async ({ canvas }) => {
    await expect(canvas.getAllByRole('radio', { checked: false })).toHaveLength(4);
    await waitFor(() => expect(canvas.getByRole('radio', { name: 'List' }).tabIndex).toBe(0));
  },
};
export const UnknownValue: Story = { ...NoSelection, args: { value: 'unknown' } };
export const Empty: Story = { render: (args) => <Example {...args} options={[]} /> };
export const Disabled: Story = {
  args: { disabled: true, onOptionIntent: fn() },
  play: async ({ canvas, userEvent, args }) => {
    await expect(canvas.getByRole('radiogroup')).toHaveAttribute('aria-disabled', 'true');
    for (const item of canvas.getAllByRole('radio')) {
      await expect(item).toBeDisabled();
      await expect(item.tabIndex).toBe(-1);
      await userEvent.hover(item);
    }
    await expect(args.onOptionIntent).not.toHaveBeenCalled();
    await expect(args.onValueChange).not.toHaveBeenCalled();
  },
};
export const AllDisabled: Story = {
  ...Disabled,
  args: { onOptionIntent: fn() },
  render: (args) => <Example {...args} allDisabled />,
  play: async ({ canvas }) => {
    for (const item of canvas.getAllByRole('radio')) {
      await expect(item).toBeDisabled();
      await expect(item.tabIndex).toBe(-1);
    }
  },
};

export const IntentPrefetch: Story = {
  args: { onOptionIntent: fn() },
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.hover(canvas.getByRole('radio', { name: 'Grid' }));
    await expect(args.onOptionIntent).toHaveBeenCalledTimes(1);
    await expect(args.onOptionIntent).toHaveBeenLastCalledWith('Grid');
    await userEvent.hover(canvas.getByRole('radio', { name: 'Board' }));
    await expect(args.onOptionIntent).toHaveBeenCalledTimes(1);
    await userEvent.tab();
    await expect(args.onOptionIntent).toHaveBeenCalledTimes(2);
    await expect(args.onOptionIntent).toHaveBeenLastCalledWith('List');
    await expect(args.onValueChange).not.toHaveBeenCalled();
  },
};

function AriaExample(args: SegmentedControlProps) {
  const id = useId();
  return (
    <>
      <span id={`${id}-group`}>Project views</span>
      <span id={`${id}-name`}>Unread</span>
      <span id={`${id}-description`}>Items waiting</span>
      <SegmentedControl
        {...args}
        aria-labelledby={`${id}-group`}
        aria-invalid="true"
        aria-describedby={`${id}-description`}
      >
        <SegmentedControl.Item
          value=""
          accessory={0}
          aria-labelledby={`${id}-name`}
          aria-describedby={`${id}-description`}
        >
          Inbox
        </SegmentedControl.Item>
        <SegmentedControl.Item value="archive" accessory={false}>
          Archive
        </SegmentedControl.Item>
        <SegmentedControl.Item value="icon" aria-label="Compact view" />
      </SegmentedControl>
    </>
  );
}
export const AriaMerge: Story = {
  args: { defaultValue: '' },
  render: (args) => <AriaExample {...args} />,
  play: async ({ canvas }) => {
    const group = canvas.getByRole('radiogroup', { name: 'Project views' });
    await expect(group).toHaveAttribute('aria-invalid', 'true');
    const item = canvas.getByRole('radio', { name: 'Unread Inbox' });
    await expect(item).toHaveAccessibleDescription('Items waiting 0');
    await expect(item).toHaveAttribute('aria-checked', 'true');
    await expect(item.getAttribute('aria-labelledby')!.split(' ')).toHaveLength(2);
    await expect(item.getAttribute('aria-describedby')!.split(' ')).toHaveLength(2);
    await expect(canvas.getByRole('radio', { name: 'Archive' }).children).toHaveLength(1);
    await expect(canvas.getByRole('radio', { name: 'Compact view' })).toBeInTheDocument();
  },
};
export const FalsyAccessory: Story = { ...AriaMerge };
export const Accessories: Story = {
  render: (args) => (
    <SegmentedControl {...args}>
      <SegmentedControl.Item value="List" accessory={new Intl.NumberFormat('en').format(120)}>
        List
      </SegmentedControl.Item>
      <SegmentedControl.Item value="Grid" accessory={0}>
        Grid
      </SegmentedControl.Item>
    </SegmentedControl>
  ),
};

export const ConsumerVeto: Story = {
  render: (args) => (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        throw new Error('Unexpected submit');
      }}
    >
      <SegmentedControl {...args} onKeyDown={(event) => event.preventDefault()}>
        <SegmentedControl.Item value="List">List</SegmentedControl.Item>
        <SegmentedControl.Item value="Grid" onClick={(event) => event.preventDefault()}>
          Grid
        </SegmentedControl.Item>
      </SegmentedControl>
    </form>
  ),
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.tab();
    await userEvent.keyboard('{ArrowRight}');
    await assertFocus(canvas.getByRole('radio', { name: 'List' }));
    await userEvent.click(canvas.getByRole('radio', { name: 'Grid' }));
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await expect(canvas.getByRole('radio', { name: 'Grid' })).toHaveAttribute('type', 'button');
  },
};

export const LongLabelsOverflow: Story = {
  args: { defaultValue: 'Recent projects', style: { width: 280 } },
  render: (args) => <Example {...args} options={LONG_OPTIONS} />,
  play: async ({ canvas, userEvent, args }) => {
    const group = canvas.getByRole('radiogroup');
    const track = group.querySelector<HTMLElement>('[data-ui="segmented-control-track"]')!;
    await expect(track.scrollWidth).toBeGreaterThan(track.clientWidth);
    await userEvent.tab();
    await userEvent.keyboard('{End}');
    const last = canvas.getByRole('radio', { name: 'Archived projects' });
    await assertFocus(last);
    await waitFor(() => {
      expect(last.getBoundingClientRect().right).toBeLessThanOrEqual(track.getBoundingClientRect().right - 3);
      expect(last.getBoundingClientRect().left).toBeGreaterThanOrEqual(
        track.getBoundingClientRect().left + 3,
      );
    });
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(track).toHaveAttribute('data-overflow-start', 'true');
    await userEvent.keyboard('{Home}');
    await waitFor(() =>
      expect(
        canvas.getByRole('radio', { name: 'Recent projects' }).getBoundingClientRect().left,
      ).toBeGreaterThanOrEqual(track.getBoundingClientRect().left + 3),
    );
    await expect(args.onValueChange).toHaveBeenCalledTimes(2);
  },
};
export const RTLOverflow: Story = {
  ...LongLabelsOverflow,
  args: { ...LongLabelsOverflow.args, dir: 'rtl' },
  render: (args) => (
    <div dir="ltr">
      <Example {...args} options={LONG_OPTIONS} />
    </div>
  ),
  play: async (context) => {
    await LongLabelsOverflow.play!(context);
    await context.userEvent.keyboard('{ArrowLeft}');
    await assertFocus(context.canvas.getByRole('radio', { name: 'Assigned to me' }));
    await context.userEvent.keyboard('{ArrowRight}');
    await assertFocus(context.canvas.getByRole('radio', { name: 'Recent projects' }));
    await expect(context.args.onValueChange).toHaveBeenCalledTimes(4);
  },
};
export const ReducedMotion: Story = {
  ...LongLabelsOverflow,
  parameters: {
    docs: {
      description: {
        story:
          'Enable reduced motion in browser rendering settings to inspect instant selection and scrolling.',
      },
    },
  },
};
export const ForcedColors: Story = {
  args: { variant: 'solid' },
  parameters: {
    docs: {
      description: {
        story:
          'Enable forced colors in browser rendering settings to inspect the selected border and focus outline.',
      },
    },
  },
};
export const MultipleInstances: Story = {
  render: (args) => (
    <div style={{ display: 'grid', gap: 16, justifyItems: 'start' }}>
      <Example {...args} label="Primary layout" />
      <Example {...args} label="Secondary layout" />
    </div>
  ),
  play: async ({ canvas, userEvent }) => {
    const radios = canvas.getAllByRole('radio');
    const ids = radios.map((item) => item.getAttribute('aria-labelledby'));
    await expect(new Set(ids).size).toBe(radios.length);
    await userEvent.click(radios[1]!);
    await expect(radios[1]).toHaveAttribute('aria-checked', 'true');
    await expect(radios[4]).toHaveAttribute('aria-checked', 'true');
  },
};

function RemovalExample(args: SegmentedControlProps) {
  const [removed, setRemoved] = useState(false);
  return (
    <>
      <Example {...args} options={removed ? ['Grid', 'Table'] : OPTIONS} />
      <button onClick={() => setRemoved(true)}>Remove list</button>
    </>
  );
}
export const OptionRemoval: Story = {
  render: (args) => <RemovalExample {...args} />,
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.tab();
    await userEvent.click(canvas.getByRole('button', { name: 'Remove list' }));
    await waitFor(() => expect(canvas.getByRole('radio', { name: 'Grid' }).tabIndex).toBe(0));
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await expect(canvas.getAllByRole('radio', { checked: false })).toHaveLength(2);
  },
};

export const SlotsAndStyling: Story = {
  args: {
    slotProps: {
      track: { className: 'custom-track', 'aria-hidden': true, role: 'presentation' },
      selection: {
        className: 'custom-selection',
        'aria-hidden': false,
        style: { position: 'fixed', inset: 100 },
      },
    },
    sx: { borderRadius: '20px' },
  },
  play: async ({ canvas }) => {
    const group = canvas.getByRole('radiogroup');
    const track = group.querySelector<HTMLElement>('[data-ui="segmented-control-track"]')!;
    const selection = group.querySelector<HTMLElement>('[data-ui="segmented-control-selection"]')!;
    await expect(canvas.getAllByRole('radio')).toHaveLength(4);
    await expect(track).toHaveClass('custom-track');
    await expect(selection).toHaveClass('custom-selection');
    await expect(selection).toHaveAttribute('aria-hidden', 'true');
    await expect(getComputedStyle(selection).position).toBe('absolute');
    await expect(getComputedStyle(selection).inset).toBe('0px');
    await expect(getComputedStyle(group).borderRadius).toBe('20px');
  },
};

function ResizeExample(args: SegmentedControlProps) {
  const [wide, setWide] = useState(false);
  return (
    <>
      <Example {...args} options={LONG_OPTIONS} style={{ width: wide ? 700 : 280 }} />
      <button onClick={() => setWide((value) => !value)}>Resize layout</button>
    </>
  );
}

export const Resize: Story = {
  args: { defaultValue: 'Recent projects' },
  render: (args) => <ResizeExample {...args} />,
  play: async ({ canvas, userEvent, args }) => {
    const track = canvas
      .getByRole('radiogroup')
      .querySelector<HTMLElement>('[data-ui="segmented-control-track"]')!;
    await waitFor(() => expect(track.dataset.overflowEnd).toBe('true'));
    await userEvent.click(canvas.getByRole('button', { name: 'Resize layout' }));
    await waitFor(() => expect(track.dataset.overflowEnd).toBe('false'));
    await expect(canvas.getByRole('radio', { name: 'Recent projects' }).tabIndex).toBe(0);
    await userEvent.click(canvas.getByRole('button', { name: 'Resize layout' }));
    await waitFor(() => expect(track.dataset.overflowEnd).toBe('true'));
    await expect(args.onValueChange).not.toHaveBeenCalled();
  },
};
