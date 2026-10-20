import type { ComponentPropsWithRef, CSSProperties } from 'react';
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { withLightTheme } from '../../testing/story-decorators';
import { Checkbox, type CheckboxProps, type CheckboxSize } from './index';

const SIZES = ['sm', 'md'] as const satisfies readonly CheckboxSize[];
const BOX_SIZES = { sm: 16, md: 20 } as const;
function SlotControl(props: ComponentPropsWithRef<'span'>) {
  return <span {...props} data-slot="checkbox-control" />;
}

const stackStyle = {
  display: 'grid',
  gap: vars.space[3],
} satisfies CSSProperties;

export const SlotReplacement: Story = {
  parameters: { docs: { source: { language: 'tsx', code: `import type { ComponentPropsWithRef } from 'react';
import { Checkbox } from '@jfrader/ui';

function CheckboxControl(props: ComponentPropsWithRef<'span'>) {
  return <span {...props} data-slot="checkbox-control" />;
}

<Checkbox label="Email me updates" size="md" slots={{ control: CheckboxControl }} />` } } },
  args: { slots: { control: SlotControl } },
  play: async ({ canvasElement }) => {
    const replacement = canvasElement.querySelector('[data-slot="checkbox-control"]')!;
    await expect(replacement).toBeInTheDocument();
    await expect(replacement).toHaveAttribute('aria-hidden', 'true');
    await expect(getComputedStyle(replacement).justifyContent).toBe('center');
    await expect(replacement.previousElementSibling).toBe(within(canvasElement).getByRole('checkbox'));
    await expect(canvasElement.querySelector('input + span:not([data-slot])')).toBeNull();
  },
};

const meta = {
  title: 'Inputs/Checkbox',
  component: Checkbox,
  parameters: {
    docs: {
      description: { component: 'Turn an option on or off, or show that only some items are selected.' },
      usage: `### Values
- Use \`defaultChecked\` for an uncontrolled initial state. If you pass \`checked\`, update it from \`onCheckedChange\`; the callback receives a boolean after \`onChange\`.
- Activation does not clear \`indeterminate\`. Clear that prop yourself when the selection should leave the mixed state.

### Forms
- Pass \`name\` and \`value\` to submit the native input's value when checked. An unchecked or disabled checkbox contributes no value.
- If you omit \`label\`, supply \`aria-label\` or \`aria-labelledby\` to name the input.

### Keyboard
- Tab to the checkbox and press Space to toggle it. Set \`disabled\` to prevent changes and remove it from the tab order.`,
    },
  },
  args: { label: 'Email me updates', size: 'md' },
  argTypes: {
    size: { control: 'radio', options: SIZES },
    indeterminate: { control: 'boolean' },
    disabled: { control: 'boolean' },
  },
} satisfies Meta<typeof Checkbox>;

export default meta;

type Story = StoryObj<typeof meta>;

function ControlledCheckbox(props: CheckboxProps) {
  const [checked, setChecked] = useState(false);
  return (
    <Checkbox
      {...props}
      checked={checked}
      onCheckedChange={(next) => {
        setChecked(next);
        props.onCheckedChange?.(next);
      }}
    />
  );
}
ControlledCheckbox.displayName = 'ControlledCheckbox';

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const checkbox = within(canvasElement).getByRole('checkbox', { name: 'Email me updates' });
    await expect(checkbox).not.toBeChecked();
  },
};

export const Checked: Story = {
  args: { defaultChecked: true },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('checkbox')).toBeChecked();
  },
};

export const Indeterminate: Story = {
  args: { indeterminate: true, label: 'Select all' },
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByRole('checkbox') as HTMLInputElement;
    await expect(input.indeterminate).toBe(true);
    await expect(input).toHaveAttribute('aria-checked', 'mixed');
    // `indeterminate` is controlled: activation does not clear it until the parent does.
    await userEvent.click(input);
    await expect(input.indeterminate).toBe(true);
    await expect(input).toHaveAttribute('aria-checked', 'mixed');
  },
};

export const WithDescription: Story = {
  args: { description: 'One email a month, no more.' },
  play: async ({ canvasElement }) => {
    const checkbox = within(canvasElement).getByRole('checkbox', { name: 'Email me updates' });
    await expect(checkbox).toHaveAccessibleDescription('One email a month, no more.');
  },
};

export const ExternalAria: Story = {
  args: { 'aria-describedby': 'external-hint', description: 'One email a month, no more.' },
  render: (args) => (
    <>
      <Checkbox {...args} />
      <span id="external-hint">External hint</span>
    </>
  ),
  play: async ({ canvasElement }) => {
    const checkbox = within(canvasElement).getByRole('checkbox');
    const describedBy = checkbox.getAttribute('aria-describedby') ?? '';
    await expect(describedBy).toContain('external-hint');
    await expect(describedBy).toContain('-description');
  },
};

export const BooleanNodes: Story = {
  args: { description: false },
  play: async ({ canvasElement }) => {
    const checkbox = within(canvasElement).getByRole('checkbox');
    await expect(checkbox).not.toHaveAttribute('aria-describedby');
  },
};

export const Controlled: Story = {
  parameters: { docs: { source: { language: 'tsx', code: `import { useState } from 'react';
import { Checkbox } from '@jfrader/ui';

function EmailUpdates() {
  const [checked, setChecked] = useState(false);
  return <Checkbox label="Email me updates" checked={checked} onCheckedChange={setChecked} />;
}` } } },
  args: { onCheckedChange: fn() },
  render: (args) => <ControlledCheckbox {...args} />,
  play: async ({ args, canvasElement }) => {
    const checkbox = within(canvasElement).getByRole('checkbox');
    await userEvent.click(checkbox);
    await expect(checkbox).toBeChecked();
    await expect(checkbox).toHaveFocus();
    await userEvent.keyboard('[Space]');
    await expect(checkbox).not.toBeChecked();
    await expect(args.onCheckedChange).toHaveBeenCalledTimes(2);
    await expect(args.onCheckedChange).toHaveBeenNthCalledWith(1, true);
    await expect(args.onCheckedChange).toHaveBeenNthCalledWith(2, false);
  },
};

export const Keyboard: Story = {
  args: { onCheckedChange: fn() },
  play: async ({ args, canvasElement }) => {
    const input = within(canvasElement).getByRole('checkbox');
    await userEvent.tab();
    await expect(input).toHaveFocus();
    const box = input.nextElementSibling as HTMLElement;
    await expect(getComputedStyle(box).outlineWidth).not.toBe('0px');
    await userEvent.keyboard('[Space]');
    await expect(input).toBeChecked();
    await expect(args.onCheckedChange).toHaveBeenCalledWith(true);
  },
};

export const Disabled: Story = {
  args: { disabled: true, onCheckedChange: fn() },
  play: async ({ args, canvasElement }) => {
    const checkbox = within(canvasElement).getByRole('checkbox');
    await expect(checkbox).toBeDisabled();
    await userEvent.click(checkbox);
    await expect(args.onCheckedChange).not.toHaveBeenCalled();
  },
};

export const Sizes: Story = {
  render: (args) => (
    <div style={stackStyle}>
      {SIZES.map((size) => (
        <Checkbox {...args} key={size} size={size} label={`Size ${size}`} description="Supporting text" />
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getAllByRole('checkbox')).toHaveLength(SIZES.length);
    const boxes = canvasElement.querySelectorAll('[data-ui="checkbox"] span[aria-hidden="true"]');
    await expect(boxes.length).toBe(SIZES.length);
    SIZES.forEach((size, index) => {
      const box = boxes[index] as HTMLElement;
      expect(Math.round(box.getBoundingClientRect().height)).toBe(BOX_SIZES[size]);
    });
  },
};

export const LightTheme: Story = {
  decorators: [withLightTheme],
  args: { defaultChecked: true, description: 'One email a month, no more.' },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('checkbox')).toBeChecked();
  },
};

export const Rtl: Story = {
  args: { dir: 'rtl', label: 'עדכן אותי באימייל', description: 'אימייל אחד בחודש, לא יותר.' },
  play: async ({ canvasElement }) => {
    const root = canvasElement.querySelector('[data-ui="checkbox"]') as HTMLElement;
    await expect(root).toHaveAttribute('dir', 'rtl');
    const desc = canvasElement.querySelector('[id$="-description"]') as HTMLElement;
    const computed = getComputedStyle(desc);
    await expect(computed.direction).toBe('rtl');
    await expect(computed.marginRight).not.toBe('0px');
    await expect(computed.marginLeft).toBe('0px');
  },
};
