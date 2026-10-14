import {
  FieldReplacementRoot,
  FieldSugarRoot,
  FieldReplacementLabel,
  fieldRootStyles,
  expectFieldSlotCustomization,
} from '../../testing/field-slot-fixtures';
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { withLightTheme } from '../../testing/story-decorators';
import { Textarea, type TextareaProps, type TextareaResize, type TextareaSize } from './index';
// `styled` is the app-facing styling API; consumers import it from `@jfrader/ui`.
import { styled } from '../../index';

const SIZES = ['sm', 'md', 'lg'] as const satisfies readonly TextareaSize[];
const MIN_HEIGHTS: Record<TextareaSize, number> = { sm: 64, md: 80, lg: 96 };
const RESIZES = ['none', 'vertical'] as const satisfies readonly TextareaResize[];

const StackFrame = styled.div({
  display: 'grid',
  gap: vars.space[4],
  inlineSize: '320px',
});

const meta = {
  title: 'Inputs/Textarea',
  component: Textarea,
  parameters: {
    docs: {
      description: { component: 'Write text across multiple lines in a field with a label and error message.' },
      usage: `### Values
- Use \`defaultValue\` for an uncontrolled initial value. If you pass \`value\`, update it from \`onValueChange\`; the callback receives a string after \`onChange\`.

### Forms
- Pass \`name\` to include the textarea in form data. Use \`required\` or \`maxLength\` for native constraints. Supplying \`error\` displays an alert and marks the field invalid, but does not validate its contents.
- If you omit \`label\`, supply \`aria-label\` or \`aria-labelledby\` to name the textarea.

### Limits
- The field defaults to \`rows={3}\` and \`resize="vertical"\`. Set \`resize="none"\` to turn off manual resizing.
- \`autoResize\` uses CSS \`field-sizing: content\`. Supporting browsers size to the text and ignore \`rows\`; other browsers keep the row-based height. Keep \`rows\` as a fallback when you enable it.

### Customization
- \`ref\` targets the textarea, while \`component\` replaces the wrapper. If you replace a part through \`slots\`, forward its supplied props and ref to preserve the field relationships.`,
    },
  },
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
      <StackFrame>
        <Story />
      </StackFrame>
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
ControlledTextarea.displayName = 'ControlledTextarea';

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

export const Rtl: Story = {
  args: { dir: 'rtl', label: 'الرسالة', description: 'مرئي لجميع أفراد الفريق.' },
  play: async ({ canvasElement }) => {
    const root = canvasElement.querySelector('[data-ui="textarea"]');
    const textarea = within(canvasElement).getByLabelText('الرسالة');
    await expect(root).toHaveAttribute('dir', 'rtl');
    await expect(textarea).toHaveAttribute('dir', 'rtl');
  },
};

/** Replace the wrapper and generated label; pass native props through slotProps. */
// This story tests the documented css/slot API and native style merging.
export const SlotCustomization: Story = {
  args: {
    ref: fn(),
    onClick: fn(),
    className: 'consumer-root',
    title: 'consumer title',
    style: fieldRootStyles.consumer,
    sx: { borderRadius: '11px' },
    component: FieldSugarRoot,
    slots: { root: FieldReplacementRoot, label: FieldReplacementLabel },
    slotProps: {
      root: {
        onClick: fn(),
        ref: fn(),
        className: 'slot-root',
        title: 'slot title',
        style: fieldRootStyles.slot,
        css: { borderRadius: '8px' },
      },
      label: { ref: fn(), title: 'generated part' },
    },
  },
  render: (args) => <Textarea {...args} css={{ borderRadius: '9px' }} />,
  parameters: {
    docs: {
      source: {
        code: "function MyRoot(props) { return <div {...props} />; }\nfunction MyLabel(props) { return <label {...props} />; }\n\n<Textarea label=\"Name\"\n  component={MyRoot}\n  slots={{ label: MyLabel }}\n  slotProps={{ root: { className: 'custom-field' }, label: { title: 'Name' } }}\n/>",
      },
    },
  },
  play: async ({ canvasElement, args }) => {
    await expectFieldSlotCustomization(
      canvasElement,
      {
        rootEvent: args.slotProps?.root?.onClick,
        consumerEvent: args.onClick,
        root: args.slotProps?.root?.ref,
        part: args.slotProps?.label?.ref,
        consumer: args.ref,
      },
      'textarea',
    );
  },
};

/** Use component as shorthand for the wrapper's root slot. */
export const ComponentRoot: Story = {
  args: { component: FieldSugarRoot },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('[data-slot-root="component"]')).not.toBeNull();
  },
};

export type TextareaSlotTypeRegression = {
  // @ts-expect-error Unknown structural keys are rejected.
  unknownSlot: NonNullable<import('./index').TextareaProps['slots']>['notASlot'];
  // @ts-expect-error Unknown prop keys are rejected.
  unknownSlotProps: NonNullable<import('./index').TextareaProps['slotProps']>['notASlot'];
};
