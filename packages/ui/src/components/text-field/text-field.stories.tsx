import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { css } from '../../styling/css';
import { TextField, type TextFieldProps, type TextFieldSize } from './index';

const SIZES = ['sm', 'md', 'lg'] as const satisfies readonly TextFieldSize[];
const HEIGHTS = { sm: 32, md: 40, lg: 48 } as const;

const stackStyle = css({
  display: 'grid',
  gap: vars.space[4],
  inlineSize: '320px',
});

const meta = {
  title: 'Inputs/TextField',
  component: TextField,
  args: { label: 'Email', placeholder: 'you@example.com', size: 'md' },
  argTypes: {
    size: { control: 'radio', options: SIZES },
    disabled: { control: 'boolean' },
    required: { control: 'boolean' },
  },
  decorators: [
    (Story) => (
      <div css={stackStyle}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof TextField>;

export default meta;

type Story = StoryObj<typeof meta>;

function ControlledTextField(props: TextFieldProps) {
  const [value, setValue] = useState('');
  return (
    <TextField
      {...props}
      value={value}
      onValueChange={(next) => {
        setValue(next);
        props.onValueChange?.(next);
      }}
    />
  );
}

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByLabelText('Email');
    await expect(input).not.toHaveAttribute('aria-invalid');
    await expect(input).not.toHaveAttribute('aria-describedby');
  },
};

export const WithDescription: Story = {
  args: { description: 'We only use it to send receipts.' },
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByLabelText('Email');
    await expect(input).toHaveAccessibleDescription('We only use it to send receipts.');
  },
};

export const WithError: Story = {
  args: { description: 'We only use it to send receipts.', error: 'Enter a valid email address.' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByLabelText('Email');
    const alert = canvas.getByRole('alert');
    await expect(input).toHaveAttribute('aria-invalid', 'true');
    await expect(input.getAttribute('aria-describedby')).toContain(alert.id);
    await expect(alert).toHaveTextContent('Enter a valid email address.');
  },
};

export const ExternalAria: Story = {
  args: {
    'aria-describedby': 'external-hint',
    description: 'We only use it to send receipts.',
    error: 'Enter a valid email address.',
  },
  render: (args) => (
    <>
      <TextField {...args} />
      <span id="external-hint">External hint</span>
    </>
  ),
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByLabelText('Email');
    const describedBy = input.getAttribute('aria-describedby') ?? '';
    await expect(describedBy).toContain('external-hint');
    await expect(describedBy).toContain('-description');
    await expect(describedBy).toContain('-error');
  },
};

export const BooleanNodes: Story = {
  args: { error: false, description: false },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByLabelText('Email');
    await expect(input).not.toHaveAttribute('aria-invalid');
    await expect(input).not.toHaveAttribute('aria-describedby');
    await expect(canvas.queryByRole('alert')).toBeNull();
  },
};

export const Controlled: Story = {
  args: { onChange: fn(), onValueChange: fn() },
  render: (args) => <ControlledTextField {...args} />,
  play: async ({ args, canvasElement }) => {
    const input = within(canvasElement).getByLabelText('Email');
    await userEvent.type(input, 'hello');
    await expect(input).toHaveValue('hello');
    await expect(args.onValueChange).toHaveBeenLastCalledWith('hello');
    await expect(args.onChange).toHaveBeenCalledTimes('hello'.length);
  },
};

export const Keyboard: Story = {
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByLabelText('Email');
    await userEvent.tab();
    await expect(input).toHaveFocus();
    await expect(getComputedStyle(input).outlineWidth).not.toBe('0px');
    await userEvent.keyboard('a');
    await expect(input).toHaveValue('a');
  },
};

export const Sizes: Story = {
  render: (args) => (
    <>
      {SIZES.map((size) => (
        <TextField {...args} key={size} size={size} label={`Size ${size}`} />
      ))}
    </>
  ),
  play: async ({ canvasElement }) => {
    const inputs = within(canvasElement).getAllByRole('textbox');
    await expect(inputs).toHaveLength(SIZES.length);
    SIZES.forEach((size, index) => {
      const height = Math.round(inputs[index]!.getBoundingClientRect().height);
      expect(height).toBe(HEIGHTS[size]);
    });
  },
};

export const Disabled: Story = {
  args: { disabled: true, defaultValue: 'locked@example.com' },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByLabelText('Email')).toBeDisabled();
  },
};

export const Required: Story = {
  args: { required: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('textbox')).toHaveAttribute('required');
    await expect(canvas.getByText('*')).toHaveAttribute('aria-hidden', 'true');
  },
};

export const LightTheme: Story = {
  globals: { theme: 'light' },
  args: { error: 'Enter a valid email address.' },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('textbox')).toHaveAttribute('aria-invalid', 'true');
  },
};
