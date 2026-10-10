import { useState, type ReactNode } from 'react';
import type { Meta, StoryContext, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { css } from '../../styling/css';
import { withLightTheme } from '../../testing/story-decorators';
import { ToggleGroup, type ToggleGroupProps, type ToggleGroupSingleProps } from './index';

interface Option {
  value: string;
  label: string;
}

const VIEWS: readonly Option[] = [
  { value: 'list', label: 'List' },
  { value: 'grid', label: 'Grid' },
  { value: 'board', label: 'Board' },
  { value: 'table', label: 'Table' },
];

const FORMATS: readonly Option[] = [
  { value: 'bold', label: 'Bold' },
  { value: 'italic', label: 'Italic' },
  { value: 'underline', label: 'Underline' },
];

const ARRAY_OPTIONS: readonly Option[] = [
  { value: 'a', label: 'A' },
  { value: 'b', label: 'B' },
];

const frameStyle = css({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  gap: vars.space[3],
  fontSize: vars.textSize.sm,
});

const meta = {
  title: 'Inputs/ToggleGroup',
  component: ToggleGroup,
  argTypes: {
    type: { control: 'radio', options: ['single', 'multiple'] },
    orientation: { control: 'radio', options: ['horizontal', 'vertical'] },
  },
  decorators: [
    (Story) => (
      <div css={frameStyle}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ToggleGroup>;

export default meta;

type Story = Omit<StoryObj<ToggleGroupProps>, 'render' | 'play'> & {
  render?: (args: ToggleGroupProps) => ReactNode;
  play?: (context: StoryContext<ToggleGroupProps>) => Promise<void>;
};

type CheckedToggleGroupArgs<Args extends NonNullable<Story['args']>> = Args;

export type ToggleGroupTypeRegression = {
  // @ts-expect-error An array value in single mode is a type error.
  singleArrayValue: CheckedToggleGroupArgs<{ type: 'single'; value: string[] }>;
  // @ts-expect-error An array callback in single mode is a type error.
  singleArrayCallback: CheckedToggleGroupArgs<{ type: 'single'; onValueChange: (value: string[]) => void }>;
  // @ts-expect-error A string value in multiple mode is a type error.
  multipleStringValue: CheckedToggleGroupArgs<{ type: 'multiple'; value: string }>;
  // @ts-expect-error A string callback in multiple mode is a type error.
  multipleStringCallback: CheckedToggleGroupArgs<{ type: 'multiple'; onValueChange: (value: string) => void }>;
  narrowing: typeof narrowToggleGroupProps;
};

function narrowToggleGroupProps(props: ToggleGroupProps) {
  if (props.type === 'multiple') {
    const value: string[] | undefined = props.value;
    const onValueChange: ((value: string[]) => void) | undefined = props.onValueChange;
    return { value, onValueChange };
  }
  const value: string | undefined = props.value;
  const onValueChange: ((value: string) => void) | undefined = props.onValueChange;
  return { value, onValueChange };
}

function ToggleGroupExample({
  options = VIEWS,
  disabledValue,
  label = 'View',
  ...props
}: ToggleGroupProps & { options?: readonly Option[]; disabledValue?: string }) {
  return (
    <ToggleGroup label={label} {...props}>
      {options.map((option) => (
        <ToggleGroup.Item key={option.value} value={option.value} disabled={option.value === disabledValue}>
          {option.label}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup>
  );
}
ToggleGroupExample.displayName = 'ToggleGroupExample';

function ControlledToggleGroup(props: ToggleGroupSingleProps) {
  const [value, setValue] = useState('list');
  return (
    <ToggleGroupExample
      {...props}
      value={value}
      onValueChange={(next: string) => {
        setValue(next);
        props.onValueChange?.(next);
      }}
    />
  );
}
ControlledToggleGroup.displayName = 'ControlledToggleGroup';

function expectPressed(canvasElement: HTMLElement, pressed: readonly boolean[]) {
  const items = within(canvasElement).getAllByRole('button').filter((item) => item.hasAttribute('aria-pressed'));
  expect(items.map((item) => item.getAttribute('aria-pressed') === 'true')).toEqual(pressed);
}

export const Single: Story = {
  args: { defaultValue: 'list', onValueChange: fn() },
  render: (args) => <ToggleGroupExample {...args} />,
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('group', { name: 'View' })).toBeInTheDocument();
    expectPressed(canvasElement, [true, false, false, false]);
    const grid = canvas.getByRole('button', { name: 'Grid' });
    await userEvent.click(grid);
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenCalledWith('grid');
    expectPressed(canvasElement, [false, true, false, false]);
    // Single mode is radio-like: activating the pressed item leaves it pressed.
    await userEvent.click(grid);
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    expectPressed(canvasElement, [false, true, false, false]);
  },
};

export const SingleArrayDefaultValue: Story = {
  // @ts-expect-error An array in single mode is a type error; at runtime its first element wins.
  args: { type: 'single', defaultValue: ['a', 'b'], onValueChange: fn() },
  render: (args) => <ToggleGroupExample {...args} options={ARRAY_OPTIONS} />,
  play: async ({ args, canvasElement }) => {
    expectPressed(canvasElement, [true, false]);
    await expect(args.onValueChange).not.toHaveBeenCalled();
  },
};

export const SingleArrayControlledValue: Story = {
  // @ts-expect-error An array in single mode is a type error; at runtime its first element wins.
  args: { type: 'single', value: ['a', 'b'], onValueChange: fn() },
  render: (args) => <ToggleGroupExample {...args} options={ARRAY_OPTIONS} />,
  play: async ({ args, canvasElement }) => {
    expectPressed(canvasElement, [true, false]);
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'B' }));
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenCalledWith('b');
    expectPressed(canvasElement, [true, false]);
  },
};

export const SingleAllowEmpty: Story = {
  args: { defaultValue: 'list', allowEmpty: true, onValueChange: fn() },
  render: (args) => <ToggleGroupExample {...args} />,
  play: async ({ args, canvasElement }) => {
    const list = within(canvasElement).getByRole('button', { name: 'List' });
    await userEvent.click(list);
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenCalledWith('');
    expectPressed(canvasElement, [false, false, false, false]);
    // The unpressed item keeps the tab stop because it holds focus.
    await expect(list).toHaveFocus();
    expect(list.tabIndex).toBe(0);
    await userEvent.click(list);
    await expect(args.onValueChange).toHaveBeenCalledTimes(2);
    await expect(args.onValueChange).toHaveBeenLastCalledWith('list');
    expectPressed(canvasElement, [true, false, false, false]);
  },
};

export const Multiple: Story = {
  args: { type: 'multiple', defaultValue: ['bold'], onValueChange: fn() },
  render: (args) => <ToggleGroupExample {...args} options={FORMATS} label="Text style" />,
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    expectPressed(canvasElement, [true, false, false]);
    await userEvent.click(canvas.getByRole('button', { name: 'Underline' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Italic' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Bold' }));
    await expect(args.onValueChange).toHaveBeenCalledTimes(3);
    // Values are reported in the order they were pressed.
    await expect(args.onValueChange).toHaveBeenNthCalledWith(1, ['bold', 'underline']);
    await expect(args.onValueChange).toHaveBeenNthCalledWith(2, ['bold', 'underline', 'italic']);
    await expect(args.onValueChange).toHaveBeenNthCalledWith(3, ['underline', 'italic']);
    expectPressed(canvasElement, [false, true, true]);
  },
};

export const Keyboard: Story = {
  args: { defaultValue: 'list', onValueChange: fn() },
  render: (args) => (
    <>
      <ToggleGroupExample {...args} disabledValue="grid" />
      <button type="button">After</button>
    </>
  ),
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const [list, grid, board, table] = canvas.getAllByRole('button').filter((item) => item.hasAttribute('aria-pressed'));
    await expect(grid).toBeDisabled();
    await userEvent.tab();
    await expect(list).toHaveFocus();
    await expect(getComputedStyle(list!).outlineWidth).not.toBe('0px');
    await expect(getComputedStyle(list!).outlineStyle).not.toBe('none');
    // Arrows skip the disabled item, and focus never toggles.
    await userEvent.keyboard('{ArrowRight}');
    await expect(board).toHaveFocus();
    expectPressed(canvasElement, [true, false, false, false]);
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await userEvent.tab();
    await expect(canvas.getByRole('button', { name: 'After' })).toHaveFocus();
    expectPressed(canvasElement, [true, false, false, false]);
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await userEvent.tab({ shift: true });
    await expect(board).toHaveFocus();
    expectPressed(canvasElement, [true, false, false, false]);
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await userEvent.keyboard('{End}');
    await expect(table).toHaveFocus();
    await userEvent.keyboard('{ArrowRight}');
    await expect(list).toHaveFocus();
    await userEvent.keyboard('{ArrowLeft}');
    await expect(table).toHaveFocus();
    await userEvent.keyboard('{Home}');
    await expect(list).toHaveFocus();
    await expect(args.onValueChange).not.toHaveBeenCalled();
    // Space toggles once; Enter on the pressed item is a no-op in single mode.
    await userEvent.keyboard('{ArrowRight} ');
    await expect(board).toHaveFocus();
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenCalledWith('board');
    expectPressed(canvasElement, [false, false, true, false]);
    await userEvent.keyboard('{Enter}');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    // One tab stop: Tab leaves the group, Shift+Tab returns to the last focused item.
    expect(board!.tabIndex).toBe(0);
    expect(list!.tabIndex).toBe(-1);
    await userEvent.tab();
    await expect(canvas.getByRole('button', { name: 'After' })).toHaveFocus();
    await userEvent.tab({ shift: true });
    await expect(board).toHaveFocus();
    await userEvent.keyboard('{ArrowRight}');
    await expect(table).toHaveFocus();
    expectPressed(canvasElement, [false, false, true, false]);
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await userEvent.keyboard('{Enter}');
    await expect(args.onValueChange).toHaveBeenCalledTimes(2);
    await expect(args.onValueChange).toHaveBeenLastCalledWith('table');
    expectPressed(canvasElement, [false, false, false, true]);
  },
};

export const KeyboardRtl: Story = {
  args: { defaultValue: 'list' },
  render: (args) => (
    <div dir="rtl">
      <ToggleGroupExample {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const items = within(canvasElement).getAllByRole('button');
    await userEvent.tab();
    await expect(items[0]).toHaveFocus();
    // Under RTL the horizontal arrows swap: ArrowLeft moves to the next item.
    await userEvent.keyboard('{ArrowLeft}');
    await expect(items[1]).toHaveFocus();
    await userEvent.keyboard('{ArrowRight}{ArrowRight}');
    await expect(items[3]).toHaveFocus();
  },
};

export const Vertical: Story = {
  args: { defaultValue: 'grid', orientation: 'vertical' },
  render: (args) => <ToggleGroupExample {...args} />,
  play: async ({ canvasElement }) => {
    const items = within(canvasElement).getAllByRole('button');
    await userEvent.tab();
    await expect(items[1]).toHaveFocus();
    await userEvent.keyboard('{ArrowDown}');
    await expect(items[2]).toHaveFocus();
    await userEvent.keyboard('{ArrowRight}');
    await expect(items[2]).toHaveFocus();
    await userEvent.keyboard('{ArrowUp}{ArrowUp}{ArrowUp}');
    await expect(items[3]).toHaveFocus();
  },
};

export const DisabledGroup: Story = {
  args: { defaultValue: 'list', disabled: true },
  render: (args) => <ToggleGroupExample {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('group', { name: 'View' })).toHaveAttribute('aria-disabled', 'true');
    const items = canvas.getAllByRole('button');
    for (const item of items) {
      await expect(item).toBeDisabled();
      expect(item.tabIndex).toBe(-1);
    }
    expectPressed(canvasElement, [true, false, false, false]);
    await userEvent.tab();
    expect(items).not.toContain(canvasElement.ownerDocument.activeElement);
  },
};

export const Controlled: StoryObj<ToggleGroupSingleProps> = {
  args: { onValueChange: fn() },
  render: (args) => <ControlledToggleGroup {...args} />,
  play: async ({ args, canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Table' }));
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenCalledWith('table');
    expectPressed(canvasElement, [false, false, false, true]);
  },
};

export const ControlledRejected: Story = {
  args: { value: 'list', onValueChange: fn() },
  render: (args) => <ToggleGroupExample {...args} />,
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const grid = canvas.getByRole('button', { name: 'Grid' });
    // The parent never honors the request: each activation issues exactly one request and
    // the pressed state stays on "list".
    await userEvent.click(grid);
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenCalledWith('grid');
    expectPressed(canvasElement, [true, false, false, false]);
    await userEvent.click(grid);
    await expect(args.onValueChange).toHaveBeenCalledTimes(2);
    await userEvent.keyboard(' ');
    await expect(args.onValueChange).toHaveBeenCalledTimes(3);
    // Activating the pressed item requests nothing.
    await userEvent.click(canvas.getByRole('button', { name: 'List' }));
    await expect(args.onValueChange).toHaveBeenCalledTimes(3);
    expectPressed(canvasElement, [true, false, false, false]);
  },
};

export const ControlledRejectedMultiple: Story = {
  args: { type: 'multiple', value: ['bold'], onValueChange: fn() },
  render: (args) => <ToggleGroupExample {...args} options={FORMATS} label="Text style" />,
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Italic' }));
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith(['bold', 'italic']);
    await userEvent.click(canvas.getByRole('button', { name: 'Bold' }));
    await expect(args.onValueChange).toHaveBeenCalledTimes(2);
    await expect(args.onValueChange).toHaveBeenLastCalledWith([]);
    expectPressed(canvasElement, [true, false, false]);
  },
};

export const LightTheme: Story = {
  decorators: [withLightTheme],
  args: { defaultValue: 'grid' },
  render: (args) => <ToggleGroupExample {...args} />,
  play: async ({ canvasElement }) => {
    expectPressed(canvasElement, [false, true, false, false]);
  },
};
