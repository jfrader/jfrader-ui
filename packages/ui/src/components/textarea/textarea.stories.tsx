import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { css } from '../../styling/css';
import { withLightTheme } from '../../testing/story-decorators';
import { Textarea, type TextareaProps, type TextareaResize, type TextareaSize } from './index';

const SIZES = ['sm', 'md', 'lg'] as const satisfies readonly TextareaSize[];
const MIN_HEIGHTS: Record<TextareaSize, number> = { sm: 64, md: 80, lg: 96 };
const RESIZES = ['none', 'vertical'] as const satisfies readonly TextareaResize[];

const stackStyle = css({
  display: 'grid',
  gap: vars.space[4],
  inlineSize: '320px',
});

const meta = {
  title: 'Inputs/Textarea',
  component: Textarea,
  args: { label: 'Message', placeholder: 'Write a message', size: 'md' },
  argTypes: {
    size: { control: 'radio', options: SIZES },
    resize: { control: 'radio', options: RESIZES },
    autoResize: { control: 'boolean' },
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
} satisfies Meta<typeof Textarea>;

export default meta;

type Story = StoryObj<typeof meta>;

function ControlledTextarea(props: TextareaProps) {
  const [value, setValue] = useState('');
  return (
    <Textarea
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
    const textarea = within(canvasElement).getByLabelText('Message');
    await expect(textarea).toHaveAttribute('rows', '3');
    await expect(textarea).not.toHaveAttribute('aria-invalid');
    await expect(textarea).not.toHaveAttribute('aria-describedby');
    await expect(getComputedStyle(textarea).resize).toBe('vertical');
  },
};

export const WithDescription: Story = {
  args: { description: 'Visible to the whole team.' },
  play: async ({ canvasElement }) => {
    const textarea = within(canvasElement).getByLabelText('Message');
    await expect(textarea).toHaveAccessibleDescription('Visible to the whole team.');
  },
};

export const WithError: Story = {
  args: {
    'aria-describedby': 'external-hint',
    description: 'Visible to the whole team.',
    error: 'Write at least 10 characters.',
  },
  render: (args) => (
    <>
      <Textarea {...args} />
      <span id="external-hint">External hint</span>
    </>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const textarea = canvas.getByLabelText('Message');
    const alert = canvas.getByRole('alert');
    const describedBy = textarea.getAttribute('aria-describedby') ?? '';
    await expect(textarea).toHaveAttribute('aria-invalid', 'true');
    await expect(describedBy).toContain('external-hint');
    await expect(describedBy).toContain('-description');
    await expect(describedBy).toContain(alert.id);
    await expect(alert).toHaveTextContent('Write at least 10 characters.');
  },
};

export const Controlled: Story = {
  args: { onChange: fn(), onValueChange: fn() },
  render: (args) => <ControlledTextarea {...args} />,
  play: async ({ args, canvasElement }) => {
    const order: string[] = [];
    (args.onChange as ReturnType<typeof fn>).mockImplementation(() => order.push('onChange'));
    (args.onValueChange as ReturnType<typeof fn>).mockImplementation(() => order.push('onValueChange'));
    const textarea = within(canvasElement).getByLabelText('Message');
    await userEvent.type(textarea, 'hi{Enter}there');
    await expect(textarea).toHaveValue('hi\nthere');
    await expect(args.onValueChange).toHaveBeenLastCalledWith('hi\nthere');
    await expect(args.onValueChange).toHaveBeenCalledTimes('hi\nthere'.length);
    await expect(args.onChange).toHaveBeenCalledTimes('hi\nthere'.length);
    await expect(order).toEqual(Array.from('hi\nthere').flatMap(() => ['onChange', 'onValueChange']));
  },
};

export const RejectedControlled: Story = {
  args: { value: '', onValueChange: fn() },
  play: async ({ args, canvasElement }) => {
    const textarea = within(canvasElement).getByLabelText('Message');
    await userEvent.type(textarea, 'a');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenNthCalledWith(1, 'a');
    await expect(textarea).toHaveValue('');
    await userEvent.type(textarea, 'b');
    await expect(args.onValueChange).toHaveBeenCalledTimes(2);
    await expect(args.onValueChange).toHaveBeenNthCalledWith(2, 'b');
    await expect(textarea).toHaveValue('');
  },
};

export const Sizes: Story = {
  render: (args) => (
    <>
      {SIZES.map((size) => (
        <Textarea {...args} key={size} size={size} rows={1} label={`Message ${size}`} />
      ))}
    </>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    for (const size of SIZES) {
      const textarea = canvas.getByLabelText(`Message ${size}`);
      await expect(textarea.getBoundingClientRect().height).toBeGreaterThanOrEqual(MIN_HEIGHTS[size]);
    }
  },
};

export const Required: Story = {
  args: { required: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const textarea = canvas.getByRole('textbox', { name: 'Message' });
    await expect(textarea).toHaveAttribute('required');
    await expect(textarea).toBeRequired();
    await expect(canvas.getByText('*')).toHaveAttribute('aria-hidden', 'true');
  },
};

export const FalsyReactNodes: Story = {
  args: { label: 0, error: false, description: false },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const textarea = canvas.getByRole('textbox', { name: '0' });
    await expect(canvas.getByText('0')).toBeVisible();
    await expect(canvas.queryByRole('alert')).not.toBeInTheDocument();
    await expect(canvasElement.querySelector('[id$="-description"]')).not.toBeInTheDocument();
    await expect(canvasElement.querySelector('[id$="-error"]')).not.toBeInTheDocument();
    await expect(textarea).not.toHaveAttribute('aria-describedby');
    await expect(textarea).not.toHaveAttribute('aria-invalid');
  },
};

export const ConsumerInvalid: Story = {
  args: { 'aria-invalid': 'true' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByLabelText('Message')).toHaveAttribute('aria-invalid', 'true');
    await expect(canvas.queryByRole('alert')).not.toBeInTheDocument();
  },
};

export const AutoResize: Story = {
  args: { autoResize: true, resize: 'none' },
  play: async ({ canvasElement }) => {
    const textarea = within(canvasElement).getByLabelText('Message');
    const initialHeight = textarea.getBoundingClientRect().height;
    await userEvent.type(textarea, 'one{Enter}two{Enter}three{Enter}four{Enter}five{Enter}six');
    const grownHeight = textarea.getBoundingClientRect().height;
    if (CSS.supports('field-sizing', 'content')) {
      await expect(grownHeight).toBeGreaterThan(initialHeight);
    } else {
      await expect(grownHeight).toBe(initialHeight);
    }
  },
};

export const Disabled: Story = {
  args: { disabled: true, defaultValue: 'Locked message', onValueChange: fn() },
  play: async ({ args, canvasElement }) => {
    const textarea = within(canvasElement).getByLabelText('Message');
    await expect(textarea).toBeDisabled();
    await userEvent.type(textarea, 'more');
    await expect(textarea).toHaveValue('Locked message');
    await expect(args.onValueChange).not.toHaveBeenCalled();
  },
};

export const Keyboard: Story = {
  play: async ({ canvasElement }) => {
    const textarea = within(canvasElement).getByLabelText('Message');
    await userEvent.tab();
    await expect(textarea).toHaveFocus();
    await expect(textarea.ownerDocument.activeElement).toBe(textarea);
    await expect(getComputedStyle(textarea).outlineStyle).not.toBe('none');
    await expect(getComputedStyle(textarea).outlineWidth).not.toBe('0px');
    await userEvent.keyboard('a{Enter}b');
    await expect(textarea).toHaveValue('a\nb');
  },
};

export const LightTheme: Story = {
  decorators: [withLightTheme],
  args: { description: 'Visible to the whole team.', error: 'Write at least 10 characters.' },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('textbox')).toHaveAttribute('aria-invalid', 'true');
  },
};
