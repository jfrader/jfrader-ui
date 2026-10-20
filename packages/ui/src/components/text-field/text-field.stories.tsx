import {
  FieldReplacementRoot,
  FieldSugarRoot,
  FieldReplacementLabel,
  fieldRootStyles,
  expectFieldSlotCustomization,
} from '../../testing/field-slot-fixtures';
import { StrictMode, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { withLightTheme } from '../../testing/story-decorators';
import { TextField, type TextFieldProps, type TextFieldSize } from './index';
import { Button } from '../button';
// `styled` is the app-facing styling API; consumers import it from `@jfrader/ui`.
import { styled } from '../../index';

const SIZES = ['sm', 'md', 'lg'] as const satisfies readonly TextFieldSize[];
const HEIGHTS = { sm: 32, md: 40, lg: 48 } as const;

const StackFrame = styled.div({
  display: 'grid',
  gap: vars.space[4],
  inlineSize: '320px',
});

const meta = {
  title: 'Inputs/TextField',
  component: TextField,
  parameters: {
    docs: {
      description: { component: 'Enter text in a field with a label, description and error message.' },
      sections: [
        { title: 'Basic', stories: ['Default'] },
        { title: 'Sizes', stories: ['Sizes'] },
        { title: 'States', stories: ['Disabled', 'ReadOnly', 'Required'] },
        { title: 'Labels and feedback', stories: ['HiddenLabel', 'WithDescription', 'WithError'] },
        { title: 'Forms', stories: ['Controlled', 'Form'] },
        { title: 'Long content', stories: ['LongContent'] },
      ],
      usage: `### When to use
Use a text field for a single line of text. Use Textarea for a message, SearchField for a query, or PasswordField for a secret. For prefixes, suffixes or icons inside the frame, use InputGroup instead.

### Forms and accessibility
Give each input an accessible name, even when its label is hidden. Keep a visible label unless the surrounding context makes the purpose clear. Placeholders are not labels.

Validate in your form and provide a specific error message. Disabled fields are skipped by keyboard navigation and omitted from form data; read-only fields remain focusable and are submitted.

Tab and Shift+Tab move between controls. Text editing and Enter submission follow the browser's native behavior.`,
    },
  },
  args: { label: 'Email', placeholder: 'you@example.com', size: 'md' },
  argTypes: {
    size: { control: 'radio', options: SIZES },
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
ControlledTextField.displayName = 'ControlledTextField';

export const Default: Story = {
  name: 'Email field',
  parameters: { docs: { description: { story: 'Enter an email address in a labeled, single-line field.' }, source: { language: 'tsx', code: `import { TextField } from '@jfrader/ui';

<TextField label="Email" placeholder="you@example.com" />` } } },
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByLabelText('Email');
    await expect(input).not.toHaveAttribute('aria-invalid');
    await expect(input).not.toHaveAttribute('aria-describedby');
  },
};

export const HiddenLabel: Story = {
  name: 'Hidden label',
  parameters: { docs: { description: { story: 'Keep the accessible name when the surrounding context already identifies the field.' }, source: { language: 'tsx', code: `import { TextField } from '@jfrader/ui';

<TextField label="Search" labelPlacement="hidden" placeholder="you@example.com" />` } } },
  args: { label: 'Search', labelPlacement: 'hidden' },
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByLabelText('Search');
    await expect(input).toBeVisible();
    await expect(input.getBoundingClientRect().height).toBe(40);
    const label = canvasElement.querySelector('label')!;
    await expect(label.getBoundingClientRect().width).toBeLessThanOrEqual(1);
  },
};

export const WithDescription: Story = {
  name: 'Description',
  parameters: { docs: { description: { story: 'Explain how the email address will be used below the input.' }, source: { language: 'tsx', code: `import { TextField } from '@jfrader/ui';

<TextField label="Email" placeholder="you@example.com" description="We only use it to send receipts." />` } } },
  args: { description: 'We only use it to send receipts.' },
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByLabelText('Email');
    await expect(input).toHaveAccessibleDescription('We only use it to send receipts.');
  },
};

export const WithError: Story = {
  name: 'Validation error',
  parameters: { docs: { description: { story: 'Show an error alongside the description and mark the input invalid.' }, source: { language: 'tsx', code: `import { TextField } from '@jfrader/ui';

<TextField label="Email" placeholder="you@example.com" description="We only use it to send receipts." error="Enter a valid email address." />` } } },
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
  name: 'Controlled value',
  parameters: { docs: { description: { story: 'Store the email value in React state as you type.' }, source: { language: 'tsx', code: `import { useState } from 'react';
import { TextField } from '@jfrader/ui';

export function EmailField() {
  const [email, setEmail] = useState('');

  return (
    <TextField
      label="Email"
      placeholder="you@example.com"
      value={email}
      onValueChange={setEmail}
    />
  );
}` } } },
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
  parameters: { docs: { description: { story: 'Compare small, medium and large fields.' }, source: { language: 'tsx', code: `import { TextField } from '@jfrader/ui';

<>
  <TextField size="sm" label="Size sm" placeholder="you@example.com" />
  <TextField size="md" label="Size md" placeholder="you@example.com" />
  <TextField size="lg" label="Size lg" placeholder="you@example.com" />
</>` } } },
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
  parameters: { docs: { description: { story: 'Prevent editing and remove the field from keyboard navigation.' }, source: { language: 'tsx', code: `import { TextField } from '@jfrader/ui';

<TextField label="Email" placeholder="you@example.com" disabled defaultValue="locked@example.com" />` } } },
  args: { disabled: true, defaultValue: 'locked@example.com' },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByLabelText('Email')).toBeDisabled();
  },
};

export const Required: Story = {
  parameters: { docs: { description: { story: 'Require an email value before native form submission.' }, source: { language: 'tsx', code: `import { TextField } from '@jfrader/ui';

<TextField label="Email" placeholder="you@example.com" required />` } } },
  args: { required: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('textbox')).toHaveAttribute('required');
    await expect(canvas.getByText('*')).toHaveAttribute('aria-hidden', 'true');
  },
};

export const ReadOnly: Story = {
  name: 'Read-only value',
  args: { readOnly: true, defaultValue: 'billing@example.com' },
  parameters: { docs: { description: { story: 'Keep an email selectable and submittable without allowing edits.' }, source: { language: 'tsx', code: `import { TextField } from '@jfrader/ui';

<TextField label="Email" placeholder="you@example.com" readOnly defaultValue="billing@example.com" />` } } },
};

function EmailForm() {
  const [submittedEmail, setSubmittedEmail] = useState('');
  return <form action={(data) => setSubmittedEmail(String(data.get('email') ?? ''))}>
    <TextField label="Email" name="email" type="email" autoComplete="email" required />
    <Button type="submit">Submit email</Button>
    <output aria-live="polite">{submittedEmail}</output>
  </form>;
}

export const Form: Story = {
  name: 'Native form',
  render: () => <EmailForm />,
  parameters: { docs: { description: { story: 'Submit a named email input with native validation and read its value from FormData.' }, source: { language: 'tsx', code: `import { useState } from 'react';
import { Button, TextField } from '@jfrader/ui';

export function EmailForm() {
  const [submittedEmail, setSubmittedEmail] = useState('');
  return <form action={(data) => setSubmittedEmail(String(data.get('email') ?? ''))}>
    <TextField label="Email" name="email" type="email" autoComplete="email" required />
    <Button type="submit">Submit email</Button>
    <output aria-live="polite">{submittedEmail}</output>
  </form>;
}` } } },
};

export const LongContent: Story = {
  name: 'Long value',
  args: { label: 'Billing contact email address', defaultValue: 'accounts-payable@international-example.com' },
  parameters: { docs: { description: { story: 'Keep a long email on one line and move the caret to read the rest.' }, source: { language: 'tsx', code: `import { TextField } from '@jfrader/ui';

<TextField label="Billing contact email address" placeholder="you@example.com" defaultValue="accounts-payable@international-example.com" />` } } },
};

export const LightTheme: Story = {
  decorators: [withLightTheme],
  args: { error: 'Enter a valid email address.' },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('textbox')).toHaveAttribute('aria-invalid', 'true');
  },
};

export const Rtl: Story = {
  args: { dir: 'rtl', description: 'We only use it to send receipts.' },
  play: async ({ canvasElement }) => {
    const root = canvasElement.querySelector('[data-ui="text-field"]');
    const input = within(canvasElement).getByLabelText('Email');
    await expect(root).toHaveAttribute('dir', 'rtl');
    await expect(input).toHaveAttribute('dir', 'rtl');
  },
};

/** Replace the wrapper and generated label; pass native props through slotProps. */
// This story tests the documented css/slot API and native style merging.
const StyledTextField = styled(TextField)({ borderRadius: '9px' });
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
        sx: { borderRadius: '8px' },
      },
      label: { ref: fn(), title: 'generated part' },
    },
  },
  render: (args) => <StyledTextField {...args} />,
  parameters: {
    docs: {
      source: {
        code: "function MyRoot(props) { return <div {...props} />; }\nfunction MyLabel(props) { return <label {...props} />; }\n\n<TextField label=\"Name\"\n  component={MyRoot}\n  slots={{ label: MyLabel }}\n  slotProps={{ root: { className: 'custom-field' }, label: { title: 'Name' } }}\n/>",
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
      'input',
    );
  },
};

/** Use component as shorthand for the wrapper's root slot. */
export const ComponentRoot: Story = {
  parameters: { docs: { source: { language: 'tsx', code: `import type { ComponentPropsWithRef } from 'react';
import { TextField } from '@jfrader/ui';

function EmailRoot(props: ComponentPropsWithRef<'div'>) {
  return <div {...props} />;
}

<TextField component={EmailRoot} label="Email" placeholder="you@example.com" size="md" />` } } },
  args: { component: FieldSugarRoot },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('[data-slot-root="component"]')).not.toBeNull();
  },
};

export type TextFieldSlotTypeRegression = {
  // @ts-expect-error Unknown structural keys are rejected.
  unknownSlot: NonNullable<import('./index').TextFieldProps['slots']>['notASlot'];
  // @ts-expect-error Unknown prop keys are rejected.
  unknownSlotProps: NonNullable<import('./index').TextFieldProps['slotProps']>['notASlot'];
};

const rootCleanup = fn();
const controlCleanup = fn();
const consumerCleanup = fn();
const rootAttach = fn((node: HTMLDivElement | null) => (node ? rootCleanup : undefined));
const controlAttach = fn((node: HTMLInputElement | null) => (node ? controlCleanup : undefined));
const consumerAttach = fn((node: HTMLInputElement | null) => (node ? consumerCleanup : undefined));

function RefLifecycleField(args: TextFieldProps) {
  const [mounted, setMounted] = useState(true);
  return (
    <>
      <StrictMode>{mounted && <TextField {...args} />}</StrictMode>
      <Button onClick={() => setMounted(false)}>Unmount field</Button>
    </>
  );
}

/** Unmount the field to run each ref cleanup. */
export const SlotRefCleanup: Story = {
  tags: ['!autodocs'],
  args: {
    ref: consumerAttach,
    slots: { root: FieldReplacementRoot },
    slotProps: { root: { ref: rootAttach }, control: { ref: controlAttach } },
  },
  beforeEach: () => {
    for (const spy of [rootAttach, controlAttach, consumerAttach, rootCleanup, controlCleanup, consumerCleanup])
      spy.mockClear();
  },
  render: (args) => <RefLifecycleField {...args} />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Unmount field' }));
    await expect(rootAttach.mock.calls.length).toBeGreaterThan(0);
    await expect(rootCleanup).toHaveBeenCalledTimes(rootAttach.mock.calls.length);
    await expect(controlCleanup).toHaveBeenCalledTimes(controlAttach.mock.calls.length);
    await expect(consumerCleanup).toHaveBeenCalledTimes(consumerAttach.mock.calls.length);
  },
};

const stableRootRef = fn();
const stableLabelRef = fn();

function StableSlotField(args: TextFieldProps) {
  const [customized, setCustomized] = useState(false);
  return (
    <>
      <TextField {...args} sx={customized ? { borderRadius: '0px' } : undefined} />
      <Button onClick={() => setCustomized(true)}>Change skin</Button>
    </>
  );
}

/** Change the wrapper styling without replacing the field or its contents. */
export const StableSlotIdentity: Story = {
  tags: ['!autodocs'],
  args: {
    slots: { root: FieldReplacementRoot, label: FieldReplacementLabel },
    slotProps: { root: { ref: stableRootRef }, label: { ref: stableLabelRef } },
  },
  beforeEach: () => {
    stableRootRef.mockClear();
    stableLabelRef.mockClear();
  },
  render: (args) => <StableSlotField {...args} />,
  play: async ({ canvas, canvasElement, userEvent }) => {
    const input = canvas.getByRole('textbox');
    const root = canvasElement.querySelector('[data-slot-root]');
    const label = canvasElement.querySelector('[data-slot-part]');
    await userEvent.type(input, 'draft@example.com');
    const rootCalls = stableRootRef.mock.calls.length;
    const labelCalls = stableLabelRef.mock.calls.length;
    await userEvent.click(canvas.getByRole('button', { name: 'Change skin' }));
    await expect(canvasElement.querySelector('[data-slot-root]')).toBe(root);
    await expect(canvasElement.querySelector('[data-slot-part]')).toBe(label);
    await expect(canvas.getByRole('textbox')).toBe(input);
    await expect(input).toHaveValue('draft@example.com');
    await expect(stableRootRef).toHaveBeenCalledTimes(rootCalls);
    await expect(stableLabelRef).toHaveBeenCalledTimes(labelCalls);
  },
};
