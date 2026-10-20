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
import { expectInside, expectNoOverlap } from '../../testing/geometry-assertions';
import { Button } from '../button';
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
  maxInlineSize: '100%',
  minInlineSize: 0,
  marginInline: 'auto',
});

const meta = {
  title: 'Inputs/Textarea',
  component: Textarea,
  parameters: {
    layout: 'padded',
    docs: {
      description: { component: 'Write text across multiple lines in a field with a label and error message.' },
      sections: [
        { title: 'Basic', stories: ['Default'] },
        { title: 'Sizes', stories: ['Sizes'] },
        { title: 'States', stories: ['Disabled', 'ReadOnly', 'Required'] },
        { title: 'Labels and feedback', stories: ['HiddenLabel', 'WithDescription', 'WithError'] },
        { title: 'Forms', stories: ['Controlled', 'Form'] },
        { title: 'Long content', stories: ['LongContent', 'AutoResize'] },
      ],
      usage: `### When to use
Use a textarea for messages, notes and other multi-line text. Use TextField for a single line. Use InputGroup.Textarea when text needs an addon inside the frame.

### Limits
Automatic growth depends on browser support for CSS field-sizing. Supporting browsers size to the text and ignore the row count; other browsers keep the row-based height. Keep a usable fallback height and enough space for long content.

### Forms and accessibility
Give the control an accessible name even when its label is hidden. Placeholders are not labels. Validate in your form and provide a specific error message; displaying an error does not validate the text.

Tab and Shift+Tab move between controls; Enter inserts a line break. Disabled textareas are omitted from form data; read-only textareas remain focusable and are submitted.`,
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
  name: 'Message field',
  parameters: { docs: { description: { story: 'Write a multi-line message in a labeled field.' }, source: { language: 'tsx', code: `import { Textarea } from '@jfrader/ui';

<Textarea label="Message" placeholder="Write a message" />` } } },
  play: async ({ canvasElement }) => {
    const textarea = within(canvasElement).getByLabelText('Message');
    await expect(textarea).toHaveAttribute('rows', '3');
    await expect(textarea).not.toHaveAttribute('aria-invalid');
    await expect(textarea).not.toHaveAttribute('aria-describedby');
    await expect(getComputedStyle(textarea).resize).toBe('vertical');
  },
};

export const WithDescription: Story = {
  name: 'Description',
  parameters: { docs: { description: { story: 'Tell the writer who can read the message.' }, source: { language: 'tsx', code: `import { Textarea } from '@jfrader/ui';

<Textarea label="Message" placeholder="Write a message" description="Visible to the whole team." />` } } },
  args: { description: 'Visible to the whole team.' },
  play: async ({ canvasElement }) => {
    const textarea = within(canvasElement).getByLabelText('Message');
    await expect(textarea).toHaveAccessibleDescription('Visible to the whole team.');
  },
};

export const WithError: Story = {
  name: 'Validation error',
  parameters: { docs: { description: { story: 'Combine a validation error with the description and an external hint.' }, source: { language: 'tsx', code: `import { useId } from 'react';
import { Textarea } from '@jfrader/ui';

export function MessageField() {
  const hintId = useId();
  return <>
    <Textarea label="Message" placeholder="Write a message" aria-describedby={hintId} description="Visible to the whole team." error="Write at least 10 characters." />
    <span id={hintId}>External hint</span>
  </>;
}` } } },
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
  name: 'Controlled value',
  parameters: { docs: { description: { story: 'Store the message in React state, including its line breaks.' }, source: { language: 'tsx', code: `import { useState } from 'react';
import { Textarea } from '@jfrader/ui';

function MessageField() {
  const [value, setValue] = useState('');
  return (
    <Textarea label="Message" placeholder="Write a message" value={value} onValueChange={setValue} />
  );
}` } } },
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
  parameters: { docs: { description: { story: 'Compare minimum heights for small, medium and large textareas.' }, source: { language: 'tsx', code: `import { Textarea } from '@jfrader/ui';

<>
  <Textarea label="Message sm" size="sm" rows={1} placeholder="Write a message" />
  <Textarea label="Message md" size="md" rows={1} placeholder="Write a message" />
  <Textarea label="Message lg" size="lg" rows={1} placeholder="Write a message" />
</>` } } },
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
  parameters: { docs: { description: { story: 'Require a message before native form submission.' }, source: { language: 'tsx', code: `import { Textarea } from '@jfrader/ui';

<Textarea label="Message" placeholder="Write a message" required />` } } },
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
  name: 'Grow with content',
  parameters: { docs: { description: { story: 'Type several lines to grow the field in browsers that support CSS field-sizing.' }, source: { language: 'tsx', code: `import { Textarea } from '@jfrader/ui';

<Textarea label="Message" placeholder="Write a message" autoResize resize="none" />` } } },
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
  parameters: { docs: { description: { story: 'Prevent editing and skip the message in keyboard navigation.' }, source: { language: 'tsx', code: `import { Textarea } from '@jfrader/ui';

<Textarea label="Message" placeholder="Write a message" disabled defaultValue="Locked message" />` } } },
  args: { disabled: true, defaultValue: 'Locked message', onValueChange: fn() },
  play: async ({ args, canvasElement }) => {
    const textarea = within(canvasElement).getByLabelText('Message');
    await expect(textarea).toBeDisabled();
    await userEvent.type(textarea, 'more');
    await expect(textarea).toHaveValue('Locked message');
    await expect(args.onValueChange).not.toHaveBeenCalled();
  },
};

export const ReadOnly: Story = {
  name: 'Read-only message',
  args: { readOnly: true, defaultValue: 'The release is scheduled for Friday.' },
  parameters: { docs: { description: { story: 'Keep a message selectable and submittable without allowing edits.' }, source: { language: 'tsx', code: `import { Textarea } from '@jfrader/ui';

<Textarea label="Message" placeholder="Write a message" readOnly defaultValue="The release is scheduled for Friday." />` } } },
};

export const HiddenLabel: Story = {
  name: 'Hidden label',
  args: { labelPlacement: 'hidden' },
  parameters: { docs: { description: { story: 'Keep an accessible name when the surrounding context identifies the message field.' }, source: { language: 'tsx', code: `import { Textarea } from '@jfrader/ui';

<Textarea label="Message" labelPlacement="hidden" placeholder="Write a message" />` } } },
};

function MessageForm() {
  const [submittedMessage, setSubmittedMessage] = useState('');
  return <form action={(data) => setSubmittedMessage(String(data.get('message') ?? ''))}>
    <Textarea label="Message" name="message" required />
    <Button type="submit">Submit message</Button>
    <output aria-live="polite">{submittedMessage}</output>
  </form>;
}

export const Form: Story = {
  name: 'Native form',
  render: () => <MessageForm />,
  parameters: { docs: { description: { story: 'Submit a required message and read its value from FormData.' }, source: { language: 'tsx', code: `import { useState } from 'react';
import { Button, Textarea } from '@jfrader/ui';

export function MessageForm() {
  const [submittedMessage, setSubmittedMessage] = useState('');
  return <form action={(data) => setSubmittedMessage(String(data.get('message') ?? ''))}>
    <Textarea label="Message" name="message" required />
    <Button type="submit">Submit message</Button>
    <output aria-live="polite">{submittedMessage}</output>
  </form>;
}` } } },
};

export const LongContent: Story = {
  name: 'Long message',
  args: { defaultValue: 'Release checklist:\nReview the migration guide and confirm the deployment window.\nNotify the team before starting the rollout.\nCheck the service after deployment.\nRecord any follow-up work.', rows: 4 },
  parameters: { docs: { description: { story: 'Scroll or resize a multi-line message that exceeds the initial height.' }, source: { language: 'tsx', code: `import { Textarea } from '@jfrader/ui';

<Textarea label="Message" placeholder="Write a message" rows={4} defaultValue={'Release checklist:\\nReview the migration guide and confirm the deployment window.\\nNotify the team before starting the rollout.\\nCheck the service after deployment.\\nRecord any follow-up work.'} />` } } },
};

export const NarrowLayout: Story = {
  args: {
    label: 'Message for the release coordinator',
    description: 'Include the planned deployment window.',
    error: 'Write at least 10 characters.',
    required: true,
    defaultValue: 'Review the migration guide and confirm the deployment window.',
    slotProps: { root: { sx: { maxInlineSize: '10rem' } } },
  },
  play: async ({ canvas, canvasElement, userEvent }) => {
    const root = canvasElement.querySelector('[data-ui="textarea"]')!;
    const textarea = canvas.getByRole('textbox');
    const inlineSize = canvasElement.style.inlineSize;
    canvasElement.style.inlineSize = '15rem';
    try {
      await expectInside(root.parentElement!, canvasElement);
    } finally {
      canvasElement.style.inlineSize = inlineSize;
    }
    await expectInside(textarea, root);
    await expectNoOverlap(canvas.getByText('Message for the release coordinator'), textarea);
    await expect(textarea.scrollWidth).toBeLessThanOrEqual(textarea.clientWidth);
    await userEvent.tab();
    await expect(textarea.ownerDocument.activeElement).toBe(textarea);
    await expect(getComputedStyle(textarea).outlineStyle).not.toBe('none');
    await userEvent.keyboard('{Control>}{End}{/Control}{Enter}Notify the team.');
    await expect(textarea).toHaveValue('Review the migration guide and confirm the deployment window.\nNotify the team.');
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
const StyledTextarea = styled(Textarea)({ borderRadius: '9px' });
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
  render: (args) => <StyledTextarea {...args} />,
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
  parameters: { docs: { source: { language: 'tsx', code: `import type { ComponentPropsWithRef } from 'react';
import { Textarea } from '@jfrader/ui';

function MessageRoot(props: ComponentPropsWithRef<'div'>) {
  return <div {...props} />;
}

<Textarea component={MessageRoot} label="Message" placeholder="Write a message" size="md" />` } } },
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
