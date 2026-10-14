import type { CSSProperties } from 'react';
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { withLightTheme } from '../../testing/story-decorators';
import { Switch, type SwitchProps, type SwitchSize } from './index';

const SIZES = ['sm', 'md'] as const satisfies readonly SwitchSize[];
const TRACK_WIDTHS = { sm: 36, md: 44 } as const;

const stackStyle = {
  display: 'grid',
  gap: vars.space[3],
} satisfies CSSProperties;

const meta = {
  title: 'Inputs/Switch',
  component: Switch,
  parameters: {
    docs: {
      description: { component: 'Turn a setting on or off.' },
      usage: `### Values
- Use \`defaultChecked\` for an uncontrolled initial state. If you pass \`checked\`, update it from \`onCheckedChange\`; the callback receives a boolean after \`onChange\`.

### Forms
- Pass \`name\` and \`value\` to submit the native checkbox input's value when on. An off or disabled switch contributes no value.
- If you omit \`label\`, supply \`aria-label\` or \`aria-labelledby\` to name the setting.

### Keyboard
- Tab to the switch and press Space to toggle it. Set \`disabled\` to prevent changes and remove it from the tab order.`,
    },
  },
  args: { label: 'Airplane mode', size: 'md' },
  argTypes: {
    size: { control: 'radio', options: SIZES },
    disabled: { control: 'boolean' },
  },
} satisfies Meta<typeof Switch>;

export default meta;

type Story = StoryObj<typeof meta>;

function ControlledSwitch(props: SwitchProps) {
  const [checked, setChecked] = useState(false);
  return (
    <Switch
      {...props}
      checked={checked}
      onCheckedChange={(next) => {
        setChecked(next);
        props.onCheckedChange?.(next);
      }}
    />
  );
}
ControlledSwitch.displayName = 'ControlledSwitch';

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const control = within(canvasElement).getByRole('switch', { name: 'Airplane mode' });
    await expect(control).not.toBeChecked();
  },
};

export const On: Story = {
  args: { defaultChecked: true },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('switch')).toBeChecked();
  },
};

export const WithDescription: Story = {
  args: { description: 'Turns off Wi-Fi and Bluetooth.' },
  play: async ({ canvasElement }) => {
    const control = within(canvasElement).getByRole('switch', { name: 'Airplane mode' });
    await expect(control).toHaveAccessibleDescription('Turns off Wi-Fi and Bluetooth.');
  },
};

export const ExternalAria: Story = {
  args: { 'aria-describedby': 'external-hint', description: 'Turns off Wi-Fi and Bluetooth.' },
  render: (args) => (
    <>
      <Switch {...args} />
      <span id="external-hint">External hint</span>
    </>
  ),
  play: async ({ canvasElement }) => {
    const control = within(canvasElement).getByRole('switch');
    const describedBy = control.getAttribute('aria-describedby') ?? '';
    await expect(describedBy).toContain('external-hint');
    await expect(describedBy).toContain('-description');
  },
};

export const BooleanNodes: Story = {
  args: { description: false },
  play: async ({ canvasElement }) => {
    const control = within(canvasElement).getByRole('switch');
    await expect(control).not.toHaveAttribute('aria-describedby');
  },
};

export const Controlled: Story = {
  args: { onCheckedChange: fn() },
  render: (args) => <ControlledSwitch {...args} />,
  play: async ({ args, canvasElement }) => {
    const control = within(canvasElement).getByRole('switch');
    await userEvent.click(control);
    await expect(control).toBeChecked();
    await expect(control).toHaveFocus();
    await userEvent.keyboard('[Space]');
    await expect(control).not.toBeChecked();
    await expect(args.onCheckedChange).toHaveBeenCalledTimes(2);
    await expect(args.onCheckedChange).toHaveBeenNthCalledWith(1, true);
    await expect(args.onCheckedChange).toHaveBeenNthCalledWith(2, false);
  },
};

export const Keyboard: Story = {
  args: { onCheckedChange: fn() },
  play: async ({ args, canvasElement }) => {
    const control = within(canvasElement).getByRole('switch');
    await userEvent.tab();
    await expect(control).toHaveFocus();
    const track = control.nextElementSibling as HTMLElement;
    await expect(getComputedStyle(track).outlineWidth).not.toBe('0px');
    await userEvent.keyboard('[Space]');
    await expect(control).toBeChecked();
    // Wait out the thumb transition (120ms) before measuring the computed transform.
    await new Promise((resolve) => setTimeout(resolve, 250));
    await expect(getComputedStyle(track, '::after').transform).toContain('20');
    await expect(args.onCheckedChange).toHaveBeenCalledWith(true);
  },
};

export const Disabled: Story = {
  args: { disabled: true, onCheckedChange: fn() },
  play: async ({ args, canvasElement }) => {
    const control = within(canvasElement).getByRole('switch');
    await expect(control).toBeDisabled();
    await userEvent.click(control);
    await expect(args.onCheckedChange).not.toHaveBeenCalled();
  },
};

export const Sizes: Story = {
  render: (args) => (
    <div style={stackStyle}>
      {SIZES.map((size) => (
        <Switch {...args} key={size} size={size} label={`Size ${size}`} description="Supporting text" />
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getAllByRole('switch')).toHaveLength(SIZES.length);
    const tracks = canvasElement.querySelectorAll('[data-ui="switch"] span[aria-hidden="true"]');
    await expect(tracks.length).toBe(SIZES.length);
    SIZES.forEach((size, index) => {
      const track = tracks[index] as HTMLElement;
      expect(Math.round(track.getBoundingClientRect().width)).toBe(TRACK_WIDTHS[size]);
    });
  },
};

export const LightTheme: Story = {
  decorators: [withLightTheme],
  args: { defaultChecked: true, description: 'Turns off Wi-Fi and Bluetooth.' },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('switch')).toBeChecked();
  },
};

export const Rtl: Story = {
  args: { dir: 'rtl', defaultChecked: true, label: 'מצב טיסה', description: 'מכבה Wi-Fi ו-Bluetooth.' },
  play: async ({ canvasElement }) => {
    const root = canvasElement.querySelector('[data-ui="switch"]') as HTMLElement;
    await expect(root).toHaveAttribute('dir', 'rtl');
    const desc = canvasElement.querySelector('[id$="-description"]') as HTMLElement;
    const computed = getComputedStyle(desc);
    await expect(computed.direction).toBe('rtl');
    await expect(computed.marginRight).not.toBe('0px');
    await expect(computed.marginLeft).toBe('0px');
    const control = within(canvasElement).getByRole('switch');
    await expect(control).toBeChecked();
    const track = control.nextElementSibling as HTMLElement;
    await expect(getComputedStyle(track, '::after').transform).toContain('-20');
  },
};
