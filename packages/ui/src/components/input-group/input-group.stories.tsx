import { useId, useRef, useState, type ComponentPropsWithRef } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { withLightTheme } from '../../testing/story-decorators';
import { Button } from '../button';
import { InputGroup } from './index';

function Example(args: ComponentPropsWithRef<typeof InputGroup>) {
  const id = useId();
  return <>
    <label htmlFor={id}>Amount</label>
    <InputGroup {...args}>
      <InputGroup.Addon placement="start">$</InputGroup.Addon>
      <InputGroup.Input id={id} aria-describedby={args.invalid ? `${id}-error` : undefined} defaultValue="25" />
      <InputGroup.Addon placement="end">USD</InputGroup.Addon>
    </InputGroup>
    {args.invalid && <p id={`${id}-error`}>Enter a positive amount.</p>}
  </>;
}

const meta = {
  title: 'Inputs/InputGroup', component: InputGroup, tags: ['autodocs'],
  parameters: { docs: {
    description: { component: 'Group an input or textarea with units, icons or actions in one frame.' },
    usage: `### Labels and errors
Put labels, IDs, descriptions and native value handlers on \`InputGroup.Input\` or \`InputGroup.Textarea\`. Use React \`useId\` for label and error relationships. The frame creates no IDs or validation messages. Native \`value\`, \`defaultValue\` and \`onChange\` work unchanged.

### Keyboard
InputGroup composes native controls. \`Tab\` and \`Shift+Tab\` follow DOM order. Addon placement changes visual order only. Put start addons before the control and end addons after it when they contain buttons. Focus on the control or an addon action outlines the frame.

### Disabled
\`disabled\` disables the input or textarea. Disable addon actions explicitly. \`invalid\` marks the frame and sets the control's \`aria-invalid\` to \`true\`. Provide an error message as well. InputGroup does not submit or process text.

### Customization
\`component\`, \`slots.root\` and \`slotProps.root\` replace or configure the frame. Compound parts accept native props, refs and \`sx\`. \`size\` belongs to the frame. The native input \`size\` still controls the character width.`,
  } },
  args: { size: 'md' }, render: (args) => <Example {...args} />,
} satisfies Meta<typeof InputGroup>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `<InputGroup>
  <InputGroup.Addon placement="start">$</InputGroup.Addon>
  <InputGroup.Input aria-label="Amount" defaultValue="25" />
  <InputGroup.Addon placement="end">USD</InputGroup.Addon>
</InputGroup>`,
      },
    },
  },
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByRole('textbox', { name: 'Amount' });
    const frame = input.closest('[data-ui="input-group"]')!;
    const addons = frame.querySelectorAll<HTMLElement>('[data-ui="input-group-addon"]');
    await expect(getComputedStyle(addons[0]!).order).toBe('0');
    await expect(getComputedStyle(input).order).toBe('1');
    await expect(getComputedStyle(addons[1]!).order).toBe('2');
    await userEvent.click(input);
    await userEvent.tab({ shift: true });
    await userEvent.tab();
    await expect(input).toHaveFocus();
    await expect(getComputedStyle(frame).outlineStyle).not.toBe('none');
    await userEvent.clear(input);
    await userEvent.type(input, '42');
    await expect(input).toHaveValue('42');
  },
};
export const Invalid: Story = {
  parameters: { docs: { source: { language: 'tsx', code: `import { useId } from 'react';
import { InputGroup } from '@jfrader/ui';

export function AmountField() {
  const id = useId();
  return (
    <>
      <label htmlFor={id}>Amount</label>
      <InputGroup size="md" invalid>
        <InputGroup.Addon placement="start">$</InputGroup.Addon>
        <InputGroup.Input id={id} aria-describedby={id + '-error'} defaultValue="25" />
        <InputGroup.Addon placement="end">USD</InputGroup.Addon>
      </InputGroup>
      <p id={id + '-error'}>Enter a positive amount.</p>
    </>
  );
}` } } },
  args: { invalid: true },
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByRole('textbox');
    const frame = input.closest('[data-ui="input-group"]')!;
    const probe = document.createElement('span');
    probe.style.color = 'var(--ui-color-danger-border)';
    frame.append(probe);
    await expect(getComputedStyle(frame).borderTopColor).toBe(getComputedStyle(probe).color);
    probe.remove();
    await expect(input).toHaveAttribute('aria-invalid', 'true');
    await expect(input).toHaveAccessibleDescription('Enter a positive amount.');
  },
};
export const Disabled: Story = {
  parameters: { docs: { source: { language: 'tsx', code: `import { useId } from 'react';
import { InputGroup } from '@jfrader/ui';

export function AmountField() {
  const id = useId();
  return (
    <>
      <label htmlFor={id}>Amount</label>
      <InputGroup size="md" disabled>
        <InputGroup.Addon placement="start">$</InputGroup.Addon>
        <InputGroup.Input id={id} defaultValue="25" />
        <InputGroup.Addon placement="end">USD</InputGroup.Addon>
      </InputGroup>
    </>
  );
}` } } },
  args: { disabled: true },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('textbox')).toBeDisabled();
  },
};
export const Multiline: Story = {
  render: () => <InputGroup><InputGroup.Textarea aria-label="Notes" rows={2} defaultValue="First line" /><InputGroup.Addon placement="end">Optional</InputGroup.Addon></InputGroup>,
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByRole('textbox', { name: 'Notes' });
    await userEvent.click(input);
    await userEvent.type(input, '{End}{Enter}Second line');
    await expect(input).toHaveValue('First line\nSecond line');
  },
};

function ActionExample() {
  const inputRef = useRef<HTMLInputElement>(null);
  return <InputGroup>
    <InputGroup.Input ref={inputRef} aria-label="Reference" />
    <InputGroup.Addon placement="end">
      <Button size="sm" variant="ghost" type="button" onClick={() => inputRef.current?.focus()}>Focus input</Button>
    </InputGroup.Addon>
  </InputGroup>;
}
export const AddonAction: Story = {
  render: () => <ActionExample />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole('textbox');
    await userEvent.tab();
    await expect(input).toHaveFocus();
    await userEvent.tab();
    await expect(canvas.getByRole('button')).toHaveFocus();
    await expect(getComputedStyle(input.closest('[data-ui="input-group"]')!).outlineStyle).not.toBe('none');
    await userEvent.keyboard('{Enter}');
    await expect(input).toHaveFocus();
  },
};

function ControlledExample() {
  const [value, setValue] = useState('');
  return <InputGroup><InputGroup.Input aria-label="Name" value={value} onChange={(event) => setValue(event.currentTarget.value)} /></InputGroup>;
}
export const Controlled: Story = {
  render: () => <ControlledExample />,
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByRole('textbox');
    await userEvent.type(input, 'Ada');
    await expect(input).toHaveValue('Ada');
  },
};
function Replacement(props: ComponentPropsWithRef<'div'>) {
  return <div {...props} data-replacement="" />;
}
export const ReplacementRoot: Story = {
  parameters: { docs: { source: { language: 'tsx', code: `import { useId, type ComponentPropsWithRef } from 'react';
import { InputGroup } from '@jfrader/ui';

function AmountFrame(props: ComponentPropsWithRef<'div'>) {
  return <div {...props} data-replacement="" />;
}

export function AmountField() {
  const id = useId();
  return (
    <>
      <label htmlFor={id}>Amount</label>
      <InputGroup size="md" slots={{ root: AmountFrame }} slotProps={{ root: { 'data-example': 'replacement' } }}>
        <InputGroup.Addon placement="start">$</InputGroup.Addon>
        <InputGroup.Input id={id} defaultValue="25" />
        <InputGroup.Addon placement="end">USD</InputGroup.Addon>
      </InputGroup>
    </>
  );
}` } } },
  args: { slots: { root: Replacement }, slotProps: { root: { 'data-example': 'replacement' } } },
  play: async ({ canvasElement }) => {
    const root = canvasElement.querySelector('[data-replacement]');
    await expect(root).toHaveAttribute('data-ui', 'input-group');
    await expect(root).toHaveAttribute('data-example', 'replacement');
    await expect(root).toHaveClass(/css-/);
  },
};
export const Small: Story = {
  parameters: { docs: { source: { language: 'tsx', code: `import { useId } from 'react';
import { InputGroup } from '@jfrader/ui';

export function AmountField() {
  const id = useId();
  return (
    <>
      <label htmlFor={id}>Amount</label>
      <InputGroup size="sm">
        <InputGroup.Addon placement="start">$</InputGroup.Addon>
        <InputGroup.Input id={id} defaultValue="25" />
        <InputGroup.Addon placement="end">USD</InputGroup.Addon>
      </InputGroup>
    </>
  );
}` } } },
  args: { size: 'sm' },
};
export const Large: Story = {
  parameters: { docs: { source: { language: 'tsx', code: `import { useId } from 'react';
import { InputGroup } from '@jfrader/ui';

export function AmountField() {
  const id = useId();
  return (
    <>
      <label htmlFor={id}>Amount</label>
      <InputGroup size="lg">
        <InputGroup.Addon placement="start">$</InputGroup.Addon>
        <InputGroup.Input id={id} defaultValue="25" />
        <InputGroup.Addon placement="end">USD</InputGroup.Addon>
      </InputGroup>
    </>
  );
}` } } },
  args: { size: 'lg' },
};
export const LightTheme: Story = {
  parameters: { docs: { source: { language: 'tsx', code: `import { useId } from 'react';
import { InputGroup } from '@jfrader/ui';

export function AmountField() {
  const id = useId();
  return (
    <>
      <label htmlFor={id}>Amount</label>
      <InputGroup size="md">
        <InputGroup.Addon placement="start">$</InputGroup.Addon>
        <InputGroup.Input id={id} defaultValue="25" />
        <InputGroup.Addon placement="end">USD</InputGroup.Addon>
      </InputGroup>
    </>
  );
}` } } },
  decorators: [withLightTheme],
};
