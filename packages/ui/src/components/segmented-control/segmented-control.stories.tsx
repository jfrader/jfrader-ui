import { useId, useState, type ComponentPropsWithRef } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, waitFor } from 'storybook/test';
import { withLightTheme } from '../../testing/story-decorators';
import { vars } from '@jfrader/tokens/vars';
// `styled` is the app-facing styling API; consumers import it from `@jfrader/ui`.
import { styled } from '../../index';
import { ThemeRoot } from '../theme-root';
import { SegmentedControl, type SegmentedControlCompoundProps as SegmentedControlProps, type SegmentedControlEasyProps } from './index';

function ReplacementSegmentTrack(props: ComponentPropsWithRef<'div'>) {
  return <div {...props} data-replaced="track" />;
}
function ReplacementSelection(props: ComponentPropsWithRef<'span'>) {
  return <span {...props} data-replaced="selection" />;
}
export const ReplaceTrackAndSelection: Story = {
  name: 'Replace track and selection',
  parameters: { docs: {
    description: { story: 'Replace the track and selected background with elements that forward their props and ref.' },
    source: { language: 'tsx', code: `import type { ComponentPropsWithRef } from 'react';
import { SegmentedControl } from '@jfrader/ui';

function LayoutTrack(props: ComponentPropsWithRef<'div'>) {
  return <div {...props} data-replaced="track" />;
}

function LayoutSelection(props: ComponentPropsWithRef<'span'>) {
  return <span {...props} data-replaced="selection" />;
}

<SegmentedControl label="Layout" defaultValue="list" slots={{ track: LayoutTrack, selection: LayoutSelection }}>
  <SegmentedControl.Item value="list">List</SegmentedControl.Item>
  <SegmentedControl.Item value="grid">Grid</SegmentedControl.Item>
</SegmentedControl>` },
  } },
  render: () => (
    <SegmentedControl label="Layout" defaultValue="list" slots={{ track: ReplacementSegmentTrack, selection: ReplacementSelection }}>
      <SegmentedControl.Item value="list">List</SegmentedControl.Item>
      <SegmentedControl.Item value="grid">Grid</SegmentedControl.Item>
    </SegmentedControl>
  ),
  play: async ({ canvasElement }) => {
    const track = canvasElement.querySelector<HTMLElement>('[data-replaced="track"]');
    const selection = canvasElement.querySelector<HTMLElement>('[data-replaced="selection"]');
    await expect(track).toHaveAttribute('data-ui', 'segmented-control-track');
    await expect(selection).toHaveAttribute('data-ui', 'segmented-control-selection');
    await expect(track?.className).not.toBe('');
    await expect(selection?.className).not.toBe('');
    await expect(selection).toHaveAttribute('aria-hidden', 'true');
  },
};

const Stack = styled.div({ display: 'grid', gap: vars.space[4], justifyItems: 'start' });
const OPTIONS = ['List', 'Grid', 'Board', 'Table'];
const LONG_OPTIONS = ['Recent projects', 'Assigned to me', 'Shared with the team', 'Archived projects'];
const usage = `import { SegmentedControl } from '@jfrader/ui';

<SegmentedControl label="Layout" defaultValue="List">
  <SegmentedControl.Item value="List">List</SegmentedControl.Item>
  <SegmentedControl.Item value="Grid">Grid</SegmentedControl.Item>
  <SegmentedControl.Item value="Board" disabled>Board</SegmentedControl.Item>
  <SegmentedControl.Item value="Table">Table</SegmentedControl.Item>
</SegmentedControl>`;

function Example({
  options = OPTIONS,
  disabledOption = 'Board',
  allDisabled = false,
  ...args
}: Omit<SegmentedControlProps, 'options'> & { options?: string[]; disabledOption?: string; allDisabled?: boolean }) {
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
      sections: [
        { title: 'Basic', stories: ['Default', 'Easy'] },
        { title: 'Sizes', stories: ['Sizes'] },
        { title: 'Icons and labels', stories: ['Icons', 'Accessories'] },
        { title: 'Controlled', stories: ['Controlled'] },
        { title: 'States', stories: ['NoSelection', 'Disabled'] },
        { title: 'Composition', stories: ['ReplaceTrackAndSelection'] },
        { title: 'Keyboard', stories: ['Keyboard'] },
      ],
      description: {
        component:
          'Choose one option from a row of buttons.',
      },
      usage: `### When to use
Choose one view or display mode from a short row of options. Use Tabs for associated panels, RadioGroup for submitted form values, and ToggleGroup for toolbar actions or multiple selection.

### Content
- Values must be unique. Accessories must not be interactive.
- Give the group an accessible name and provide a name for icon-only choices.
- A selection cannot be cleared by activating it again. Long rows scroll to keep the focused choice visible.

### Keyboard
- Tab enters the last focused enabled option, then exits.
- Arrows select and wrap, skipping disabled options. Horizontal arrows reverse in RTL. Home/End select the first/last enabled option.
- Space and Enter select the focused option.`,
    },
  },
} satisfies Meta<SegmentedControlProps>;
export default meta;
type Story = StoryObj<Omit<SegmentedControlProps, 'component'>>;
type EasyStory = StoryObj<Omit<SegmentedControlEasyProps, 'component'>>;
const layouts = OPTIONS.map((value) => ({ value, label: value, disabled: value === 'Board' }));
export const Easy: EasyStory = {
  name: 'Options from data',
  parameters: { docs: {
    description: { story: 'Build a layout selector from a list of labeled options.' },
    source: { language: 'tsx', code: `import { SegmentedControl } from '@jfrader/ui';

const layouts = [
  { value: 'List', label: 'List' },
  { value: 'Grid', label: 'Grid' },
  { value: 'Board', label: 'Board', disabled: true },
  { value: 'Table', label: 'Table' },
] as const;

<SegmentedControl label="Layout" options={layouts} defaultValue="List" />` },
  } },
  args: { label: 'Layout', options: layouts, defaultValue: 'List', onValueChange: fn() },
  render: (args) => <SegmentedControl {...args} />,
  play: async ({ canvas, userEvent, args }) => {
    await expect(canvas.getByRole('radiogroup', { name: 'Layout' })).toBeInTheDocument();
    await expect(canvas.getByRole('radio', { name: 'List' })).toHaveAttribute('aria-checked', 'true');
    await expect(canvas.getByRole('radio', { name: 'Board' })).toBeDisabled();
    const grid = canvas.getByRole('radio', { name: 'Grid' });
    await userEvent.click(grid);
    await expect(grid).toHaveAttribute('aria-checked', 'true');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith('Grid');
  },
};
function EasyControlledExample(args: SegmentedControlEasyProps) {
  const [value, setValue] = useState('List');
  return (
    <SegmentedControl {...args} value={value} onValueChange={(next) => {
      setValue(next);
      args.onValueChange?.(next);
    }} />
  );
}
export const EasyControlled: EasyStory = { ...Easy, name: 'Easy controlled', render: (args) => <EasyControlledExample {...args} /> };
export const EasyRejected: EasyStory = {
  ...Easy, name: 'Easy rejected', args: { ...Easy.args, value: 'List' },
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(canvas.getByRole('radio', { name: 'Grid' }));
    await expect(canvas.getByRole('radio', { name: 'List' })).toHaveAttribute('aria-checked', 'true');
    await expect(canvas.getByRole('radio', { name: 'Grid' })).toHaveAttribute('aria-checked', 'false');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith('Grid');
  },
};
export const EasyKeyboard: EasyStory = {
  ...Easy,
  name: 'Easy keyboard',
  play: async ({ canvas, userEvent, args }) => {
    const list = canvas.getByRole('radio', { name: 'List' });
    const table = canvas.getByRole('radio', { name: 'Table' });
    await userEvent.tab();
    await assertFocus(list);
    await userEvent.keyboard('{ArrowRight}{ArrowRight}');
    await assertFocus(table);
    await expect(table).toHaveAttribute('aria-checked', 'true');
    await expect(args.onValueChange).toHaveBeenCalledTimes(2);
    await expect(args.onValueChange).toHaveBeenLastCalledWith('Table');
  },
};
export const EasyRTL: EasyStory = {
  ...Easy, name: 'Easy RTL', args: { ...Easy.args, dir: 'rtl' },
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.tab();
    await userEvent.keyboard('{ArrowLeft}');
    const grid = canvas.getByRole('radio', { name: 'Grid' });
    await assertFocus(grid);
    await expect(grid).toHaveAttribute('aria-checked', 'true');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith('Grid');
  },
};
function EasyRoot(props: ComponentPropsWithRef<'div'>) {
  return <div {...props} data-replacement="segmented-control" />;
}
export const EasyCustomization: EasyStory = {
  ...Easy,
  name: 'Easy customization',
  parameters: { docs: { source: { code: `<SegmentedControl label="Layout" options={layouts} defaultValue="List"
  slotProps={{ root: { title: 'Layout selector' }, item: { sx: { borderRadius: 0 } } }}
/>` } } },
  args: {
    ...Easy.args,
    ref: fn(),
    slotProps: {
      root: { title: 'Layout selector' },
      item: { sx: { borderRadius: 0 } },
      track: { style: { gap: 8 } },
    },
  },
  render: (args) => <SegmentedControl {...args} slots={{ root: EasyRoot }} />,
  play: async (context) => {
    await Easy.play?.(context);
    const group = context.canvas.getByRole('radiogroup', { name: 'Layout' });
    await expect(group).toHaveAttribute('data-replacement', 'segmented-control');
    await expect(context.args.ref).toHaveBeenCalledWith(group);
    await expect(group).toHaveAttribute('title', 'Layout selector');
    await expect(context.canvas.getByRole('radio', { name: 'Grid' })).toHaveStyle({ borderRadius: '0px' });
  },
};
type AssertSegmentedControlProps<T extends import('./index').SegmentedControlProps> = T;
export type SegmentedControlEasyTypeRegression = {
  // @ts-expect-error Options and children are mutually exclusive.
  mixed: AssertSegmentedControlProps<{ options: typeof layouts; children: string }>;
};

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
  name: 'Layout choices',
  parameters: { docs: { description: { story: 'Choose a layout from a row with one unavailable option.' }, source: { language: 'tsx', code: usage } } },
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
export const Soft: Story = { ...Default, name: 'Soft', args: { variant: 'soft' } };
export const Solid: Story = { ...Default, name: 'Solid', args: { variant: 'solid' } };
export const LightTheme: Story = { ...Default, name: 'Light theme', decorators: [withLightTheme] };
export const LightSolid: Story = { ...Default, name: 'Light solid', decorators: [withLightTheme], args: { variant: 'solid' } };
export const ScopedTheme: Story = {
  render: (args) => (
    <ThemeRoot theme="light">
      <Example {...args} />
    </ThemeRoot>
  ),
};
export const Sizes: Story = {
  name: 'Control sizes',
  parameters: { docs: {
    description: { story: 'Compare small, medium and large layout selectors.' },
    source: { language: 'tsx', code: `import { SegmentedControl, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const Stack = styled.div({ display: 'grid', gap: vars.space[4], justifyItems: 'start' });
const sizes = ['sm', 'md', 'lg'] as const;
const layouts = [
  { value: 'List', label: 'List' },
  { value: 'Grid', label: 'Grid' },
  { value: 'Board', label: 'Board', disabled: true },
  { value: 'Table', label: 'Table' },
] as const;

<Stack>
  {sizes.map((size) => (
    <SegmentedControl key={size} size={size} label={\`\${size} layout\`} options={layouts} defaultValue="List" />
  ))}
</Stack>` },
  } },
  render: (args) => (
    <Stack>
      {(['sm', 'md', 'lg'] as const).map((size) => (
        <Example {...args} key={size} size={size} label={`${size} layout`} />
      ))}
    </Stack>
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
  name: 'Keyboard navigation',
  parameters: { docs: {
    description: { story: 'Tab through the surrounding buttons and use arrows to change the focused layout.' },
    source: { language: 'tsx', code: `import { Button, SegmentedControl } from '@jfrader/ui';

<>
  <Button>Before</Button>
  <SegmentedControl label="Layout" defaultValue="List">
    <SegmentedControl.Item value="List">List</SegmentedControl.Item>
    <SegmentedControl.Item value="Grid">Grid</SegmentedControl.Item>
    <SegmentedControl.Item value="Board" disabled>Board</SegmentedControl.Item>
    <SegmentedControl.Item value="Table">Table</SegmentedControl.Item>
  </SegmentedControl>
  <Button>After</Button>
</>` },
  } },
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
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { SegmentedControl } from '@jfrader/ui';

<SegmentedControl label="Layout">
  <SegmentedControl.Item value="List">List</SegmentedControl.Item>
  <SegmentedControl.Item value="Grid">Grid</SegmentedControl.Item>
  <SegmentedControl.Item value="Board" disabled>
    Board
  </SegmentedControl.Item>
  <SegmentedControl.Item value="Table">Table</SegmentedControl.Item>
</SegmentedControl>`,
      },
    },
  },
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
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { useState } from 'react';
import { SegmentedControl } from '@jfrader/ui';

function Example() {
  const [value] = useState('List');

  return (
    <SegmentedControl
      label="Layout"
      value={value}
      onValueChange={(next) => {
        // Controlled value rejects updates
      }}
    >
      <SegmentedControl.Item value="List">List</SegmentedControl.Item>
      <SegmentedControl.Item value="Grid">Grid</SegmentedControl.Item>
      <SegmentedControl.Item value="Board" disabled>
        Board
      </SegmentedControl.Item>
      <SegmentedControl.Item value="Table">Table</SegmentedControl.Item>
    </SegmentedControl>
  );
}`,
      },
    },
  },
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
  name: 'Controlled layout',
  parameters: { docs: {
    description: { story: 'Keep the selected layout in state and change it from an external button.' },
    source: { language: 'tsx', code: `import { useState } from 'react';
import { Button, SegmentedControl } from '@jfrader/ui';

export function LayoutSwitcher() {
  const [value, setValue] = useState('List');
  return (
    <>
      <SegmentedControl label="Layout" value={value} onValueChange={setValue}>
        <SegmentedControl.Item value="List">List</SegmentedControl.Item>
        <SegmentedControl.Item value="Grid">Grid</SegmentedControl.Item>
        <SegmentedControl.Item value="Board" disabled>Board</SegmentedControl.Item>
        <SegmentedControl.Item value="Table">Table</SegmentedControl.Item>
      </SegmentedControl>
      <Button onClick={() => setValue('Table')}>Set table</Button>
    </>
  );
}` },
  } },
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
  name: 'Start without a selection',
  parameters: {
    docs: {
      description: { story: 'Leave the row unselected until a choice is activated.' },
      source: {
        language: 'tsx',
        code: `import { SegmentedControl } from '@jfrader/ui';

<SegmentedControl label="Layout">
  <SegmentedControl.Item value="List">List</SegmentedControl.Item>
  <SegmentedControl.Item value="Grid">Grid</SegmentedControl.Item>
  <SegmentedControl.Item value="Board" disabled>
    Board
  </SegmentedControl.Item>
  <SegmentedControl.Item value="Table">Table</SegmentedControl.Item>
</SegmentedControl>`,
      },
    },
  },
  args: { defaultValue: undefined },
  play: async ({ canvas }) => {
    await expect(canvas.getAllByRole('radio', { checked: false })).toHaveLength(4);
    await waitFor(() => expect(canvas.getByRole('radio', { name: 'List' }).tabIndex).toBe(0));
  },
};
export const UnknownValue: Story = {
  ...NoSelection,
  name: 'Unknown value',
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { SegmentedControl } from '@jfrader/ui';

<SegmentedControl label="Layout" value="unknown">
  <SegmentedControl.Item value="List">List</SegmentedControl.Item>
  <SegmentedControl.Item value="Grid">Grid</SegmentedControl.Item>
  <SegmentedControl.Item value="Board" disabled>
    Board
  </SegmentedControl.Item>
  <SegmentedControl.Item value="Table">Table</SegmentedControl.Item>
</SegmentedControl>`,
      },
    },
  },
  args: { value: 'unknown' },
};
export const Empty: Story = { render: (args) => <Example {...args} options={[]} /> };
export const Disabled: Story = {
  name: 'Disabled control',
  parameters: {
    docs: {
      description: { story: 'Keep the current layout visible while preventing changes to the row.' },
      source: {
        language: 'tsx',
        code: `import { SegmentedControl } from '@jfrader/ui';

<SegmentedControl label="Layout" defaultValue="List" disabled>
  <SegmentedControl.Item value="List">List</SegmentedControl.Item>
  <SegmentedControl.Item value="Grid">Grid</SegmentedControl.Item>
  <SegmentedControl.Item value="Board">Board</SegmentedControl.Item>
  <SegmentedControl.Item value="Table">Table</SegmentedControl.Item>
</SegmentedControl>`,
      },
    },
  },
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
  name: 'All disabled',
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
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { SegmentedControl } from '@jfrader/ui';

export function LayoutSwitcher({
  prefetchView,
}: {
  prefetchView: (value: string) => void;
}) {
  return (
    <SegmentedControl
      label="Layout"
      defaultValue="List"
      onOptionIntent={(value) => prefetchView(value)}
    >
      <SegmentedControl.Item value="List">List</SegmentedControl.Item>
      <SegmentedControl.Item value="Grid">Grid</SegmentedControl.Item>
      <SegmentedControl.Item value="Board" disabled>
        Board
      </SegmentedControl.Item>
      <SegmentedControl.Item value="Table">Table</SegmentedControl.Item>
    </SegmentedControl>
  );
}`,
      },
    },
  },
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
  name: 'Labels with counts',
  parameters: { docs: {
    description: { story: 'Show a formatted count beside each layout label, including a zero count.' },
    source: { language: 'tsx', code: `import { SegmentedControl } from '@jfrader/ui';

<SegmentedControl label="Layout" defaultValue="List">
  <SegmentedControl.Item value="List" accessory={new Intl.NumberFormat('en').format(120)}>List</SegmentedControl.Item>
  <SegmentedControl.Item value="Grid" accessory={0}>Grid</SegmentedControl.Item>
</SegmentedControl>` },
  } },
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

export const Icons: Story = {
  name: 'Icon-only labels',
  parameters: { docs: {
    description: { story: 'Name icon-only layout choices for assistive technology.' },
    source: { language: 'tsx', code: `import { SegmentedControl } from '@jfrader/ui';

<SegmentedControl label="Layout" defaultValue="List">
  <SegmentedControl.Item value="List" aria-label="List">
    <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  </SegmentedControl.Item>
  <SegmentedControl.Item value="Grid" aria-label="Grid">
    <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" />
    </svg>
  </SegmentedControl.Item>
</SegmentedControl>` },
  } },
  render: () => (
    <SegmentedControl label="Layout" defaultValue="List">
      <SegmentedControl.Item value="List" aria-label="List">
        <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </SegmentedControl.Item>
      <SegmentedControl.Item value="Grid" aria-label="Grid">
        <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" />
        </svg>
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

export const CompactChoices: Story = {
  args: { size: 'sm', defaultValue: 'I' },
  render: (args) => <Example {...args} options={['I', 'II', 'III']} />,
  play: async ({ canvas }) => {
    for (const item of canvas.getAllByRole('radio')) {
      await expect(item.getBoundingClientRect().width).toBeGreaterThanOrEqual(32);
      await expect(item.getBoundingClientRect().height).toBeGreaterThanOrEqual(32);
    }
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
          'Enable reduced motion in the browser to check selection and scrolling without animation.',
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
          'Enable forced colors in the browser to check the selection border and focus outline.',
      },
      source: {
        language: 'tsx',
        code: `import { SegmentedControl } from '@jfrader/ui';

<SegmentedControl label="Layout" defaultValue="List" variant="solid">
  <SegmentedControl.Item value="List">List</SegmentedControl.Item>
  <SegmentedControl.Item value="Grid">Grid</SegmentedControl.Item>
  <SegmentedControl.Item value="Board" disabled>
    Board
  </SegmentedControl.Item>
  <SegmentedControl.Item value="Table">Table</SegmentedControl.Item>
</SegmentedControl>`,
      },
    },
  },
};
export const MultipleInstances: Story = {
  render: (args) => (
    <Stack>
      <Example {...args} label="Primary layout" />
      <Example {...args} label="Secondary layout" />
    </Stack>
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
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { SegmentedControl } from '@jfrader/ui';

<SegmentedControl
  label="Layout"
  defaultValue="List"
  slotProps={{
    track: { className: 'custom-track', 'aria-hidden': true, role: 'presentation' },
    selection: {
      className: 'custom-selection',
      'aria-hidden': false,
      style: { position: 'fixed', inset: 100 },
    },
  }}
  sx={{ borderRadius: '20px' }}
>
  <SegmentedControl.Item value="List">List</SegmentedControl.Item>
  <SegmentedControl.Item value="Grid">Grid</SegmentedControl.Item>
  <SegmentedControl.Item value="Board" disabled>
    Board
  </SegmentedControl.Item>
  <SegmentedControl.Item value="Table">Table</SegmentedControl.Item>
</SegmentedControl>`,
      },
    },
  },
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
