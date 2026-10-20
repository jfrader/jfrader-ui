import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fireEvent, fn, waitFor, within } from 'storybook/test';
import { ControlCenter } from './control-center';
import { vars } from '@jfrader/tokens/vars';
import { styled } from '../../styling/styled';
import { Surface } from '../surface';

const SettingsPanel = styled(Surface)({
  boxSizing: 'border-box',
  inlineSize: `calc(${vars.space[8]} * 18)`,
  maxInlineSize: '100%',
  padding: vars.space[6],
  display: 'grid',
  gap: vars.space[5],
});
const PanelLabel = styled.p({
  margin: 0,
  fontFamily: vars.font.sans,
  fontSize: vars.textSize.lg,
  fontWeight: vars.fontWeight.semibold,
  color: vars.color.text,
});
const SettingsRows = styled.div({
  '&&': {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) auto',
    gap: vars.space[3],
  },
  '& > :last-child': { gridColumn: '1 / -1' },
});

const labels = {
  focus: 'Focus',
  notifications: 'Notifications',
  presenting: 'Presenting',
  focusDetails: 'Focus settings',
  notificationDetails: 'Notification channels',
  focusDescription: 'Choose a mode and duration.',
  notificationDescription: 'Choose notification channels.',
  modes: 'Mode',
  duration: 'Duration',
  volume: 'Alert volume',
  textSize: 'Text scale',
  start: 'Start',
  update: 'Update',
  close: 'Close',
  inactive: 'No focus session',
  until: (time: string) => `Focus until ${time}`,
  minutes: (value: number) =>
    new Intl.NumberFormat('en', { style: 'unit', unit: 'minute' }).format(value),
};
const meta = {
  title: 'Showcase/ControlCenter',
  component: ControlCenter,
  tags: ['autodocs'],
  render: (args) => (
    <SettingsPanel>
      <PanelLabel>Workspace settings</PanelLabel>
      <ControlCenter
        {...args}
        slots={{ grid: SettingsRows, ...args.slots }}
        slotProps={{ ...args.slotProps, modes: { orientation: 'horizontal', ...args.slotProps?.modes } }}
      />
    </SettingsPanel>
  ),
  args: {
    label: 'Quick settings',
    labels,
    focusModes: [
      { value: 'work', label: 'Work', description: 'Allow priority contacts.', defaultMinutes: 25 },
      {
        value: 'reading',
        label: 'Reading',
        description: 'Silence distractions.',
        defaultMinutes: 45,
      },
    ],
    channels: [
      { value: 'chat', label: 'Chat', defaultChecked: true },
      { value: 'email', label: 'Email' },
    ],
    locale: 'en',
    timeZone: 'UTC',
    onValueChange: fn(),
    onOpenChange: fn(),
  },
  parameters: {
    docs: {
      description: {
        component:
          'Change focus, notification, presenting, volume and text-scale settings. Open Focus settings to draft a session, then press Start or Update.',
      },
      usage:
        '### State\nUse `value` and `onValueChange` to persist the complete settings object. These are settings only: the component does not change system volume, fonts, notification permissions or browser presentation.\n\nFocus details are drafts. Close or Escape discards edits; Start and Update request one value and leave the dialog open. A rejected controlled request leaves the committed tile and status unchanged. Session expiry does not write settings.\n\n### Keyboard\nTiles use Enter and Space. Details use Dialog focus containment, Escape and focus return. Modes use RadioGroup arrows. Slider arrows, PageUp/PageDown and Home/End use the configured bounds; horizontal direction follows RTL. Duration uses Slider rather than a circular gesture dial.\n\n### Customization\n`component` aliases `slots.root`. Native parts: root, grid, status, actions. Adopted parts: tile/detailTrigger ([Button](?path=/docs/actions-button--docs)), meter/dial ([Slider](?path=/docs/inputs-slider--docs)), modes ([RadioGroup](?path=/docs/inputs-radiogroup--docs)), channel/person ([Switch](?path=/docs/inputs-switch--docs)), detail ([Dialog.Content](?path=/docs/surfaces-dialog--docs)). Replacements for adopted parts forward props/ref to the original primitive; replacing them with bare elements loses behavior. Slot props retain primitive APIs without `sx`; use their `css` lane, and root `sx` for final styling.',
      source: {
        language: 'tsx',
        code: '<ControlCenter label="Quick settings" labels={labels} focusModes={focusModes} channels={channels} locale="en" timeZone="UTC" onValueChange={saveSettings} />',
      },
    },
  },
} satisfies Meta<typeof ControlCenter>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Light: Story = { globals: { theme: 'light' } };
export const RTL: Story = { parameters: { docs: { source: { language: 'tsx', code: "import { ControlCenter, type ControlCenterLabels } from '@jfrader/ui';\n\nconst labels: ControlCenterLabels = {\n  focus: 'Focus',\n  notifications: 'Notifications',\n  presenting: 'Presenting',\n  focusDetails: 'Focus settings',\n  notificationDetails: 'Notification channels',\n  focusDescription: 'Choose a mode and duration.',\n  notificationDescription: 'Choose notification channels.',\n  modes: 'Mode',\n  duration: 'Duration',\n  volume: 'Alert volume',\n  textSize: 'Text scale',\n  start: 'Start',\n  update: 'Update',\n  close: 'Close',\n  inactive: 'No focus session',\n  until: (time) => `Focus until ${time}`,\n  minutes: (value) => new Intl.NumberFormat('en', { style: 'unit', unit: 'minute' }).format(value),\n};\n\nconst focusModes = [\n  { value: 'work', label: 'Work', description: 'Allow priority contacts.', defaultMinutes: 25 },\n  { value: 'reading', label: 'Reading', description: 'Silence distractions.', defaultMinutes: 45 },\n];\n\nconst channels = [\n  { value: 'chat', label: 'Chat', defaultChecked: true },\n  { value: 'email', label: 'Email' },\n];\n\n<ControlCenter\n  label=\"Quick settings\"\n  labels={labels}\n  focusModes={focusModes}\n  channels={channels}\n  locale=\"en\"\n  timeZone=\"UTC\"\n  dir=\"rtl\"\n/>" } } }, args: { dir: 'rtl' } };
export const Disabled: Story = { parameters: { docs: { source: { language: 'tsx', code: "import { ControlCenter, type ControlCenterLabels } from '@jfrader/ui';\n\nconst labels: ControlCenterLabels = {\n  focus: 'Focus',\n  notifications: 'Notifications',\n  presenting: 'Presenting',\n  focusDetails: 'Focus settings',\n  notificationDetails: 'Notification channels',\n  focusDescription: 'Choose a mode and duration.',\n  notificationDescription: 'Choose notification channels.',\n  modes: 'Mode',\n  duration: 'Duration',\n  volume: 'Alert volume',\n  textSize: 'Text scale',\n  start: 'Start',\n  update: 'Update',\n  close: 'Close',\n  inactive: 'No focus session',\n  until: (time) => `Focus until ${time}`,\n  minutes: (value) => new Intl.NumberFormat('en', { style: 'unit', unit: 'minute' }).format(value),\n};\n\nconst focusModes = [\n  { value: 'work', label: 'Work', description: 'Allow priority contacts.', defaultMinutes: 25 },\n  { value: 'reading', label: 'Reading', description: 'Silence distractions.', defaultMinutes: 45 },\n];\n\nconst channels = [\n  { value: 'chat', label: 'Chat', defaultChecked: true },\n  { value: 'email', label: 'Email' },\n];\n\n<ControlCenter\n  label=\"Quick settings\"\n  labels={labels}\n  focusModes={focusModes}\n  channels={channels}\n  locale=\"en\"\n  timeZone=\"UTC\"\n  disabled\n/>" } } }, args: { disabled: true } };
export const NoModes: Story = {
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { ControlCenter, type ControlCenterLabels } from '@jfrader/ui';

const labels: ControlCenterLabels = {
  focus: 'Focus',
  notifications: 'Notifications',
  presenting: 'Presenting',
  focusDetails: 'Focus settings',
  notificationDetails: 'Notification channels',
  focusDescription: 'Choose a mode and duration.',
  notificationDescription: 'Choose notification channels.',
  modes: 'Mode',
  duration: 'Duration',
  volume: 'Alert volume',
  textSize: 'Text scale',
  start: 'Start',
  update: 'Update',
  close: 'Close',
  inactive: 'No focus session',
  until: (time) => \`Focus until \${time}\`,
  minutes: (value) => new Intl.NumberFormat('en', { style: 'unit', unit: 'minute' }).format(value),
};

const channels = [
  { value: 'chat', label: 'Chat', defaultChecked: true },
  { value: 'email', label: 'Email' },
];

<ControlCenter
  label="Quick settings"
  labels={labels}
  focusModes={[]}
  channels={channels}
  locale="en"
  timeZone="UTC"
/>`,
      },
    },
  },
  args: { focusModes: [] },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('button', { name: 'Focus' })).toBeDisabled();
  },
};
export const NoChannels: Story = { parameters: { docs: { source: { language: 'tsx', code: "import { ControlCenter, type ControlCenterLabels } from '@jfrader/ui';\n\nconst labels: ControlCenterLabels = {\n  focus: 'Focus',\n  notifications: 'Notifications',\n  presenting: 'Presenting',\n  focusDetails: 'Focus settings',\n  notificationDetails: 'Notification channels',\n  focusDescription: 'Choose a mode and duration.',\n  notificationDescription: 'Choose notification channels.',\n  modes: 'Mode',\n  duration: 'Duration',\n  volume: 'Alert volume',\n  textSize: 'Text scale',\n  start: 'Start',\n  update: 'Update',\n  close: 'Close',\n  inactive: 'No focus session',\n  until: (time) => `Focus until ${time}`,\n  minutes: (value) => new Intl.NumberFormat('en', { style: 'unit', unit: 'minute' }).format(value),\n};\n\nconst focusModes = [\n  { value: 'work', label: 'Work', description: 'Allow priority contacts.', defaultMinutes: 25 },\n  { value: 'reading', label: 'Reading', description: 'Silence distractions.', defaultMinutes: 45 },\n];\n\n<ControlCenter\n  label=\"Quick settings\"\n  labels={labels}\n  focusModes={focusModes}\n  channels={[]}\n  locale=\"en\"\n  timeZone=\"UTC\"\n/>" } } }, args: { channels: [] } };
export const People: Story = {
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { ControlCenter, type ControlCenterLabels } from '@jfrader/ui';

const labels: ControlCenterLabels = {
  focus: 'Focus',
  notifications: 'Notifications',
  presenting: 'Presenting',
  focusDetails: 'Focus settings',
  notificationDetails: 'Notification channels',
  focusDescription: 'Choose a mode and duration.',
  notificationDescription: 'Choose notification channels.',
  modes: 'Mode',
  duration: 'Duration',
  volume: 'Alert volume',
  textSize: 'Text scale',
  start: 'Start',
  update: 'Update',
  close: 'Close',
  inactive: 'No focus session',
  until: (time) => \`Focus until \${time}\`,
  minutes: (value) => new Intl.NumberFormat('en', { style: 'unit', unit: 'minute' }).format(value),
};

const focusModes = [
  { value: 'work', label: 'Work', description: 'Allow priority contacts.', defaultMinutes: 25 },
  { value: 'reading', label: 'Reading', description: 'Silence distractions.', defaultMinutes: 45 },
];

const channels = [
  { value: 'chat', label: 'Chat', defaultChecked: true },
  { value: 'email', label: 'Email' },
];

const people = [
  { value: 'alex', name: 'Alex' },
  { value: 'sam', name: 'Sam' },
];

<ControlCenter
  label="Quick settings"
  labels={labels}
  focusModes={focusModes}
  channels={channels}
  people={people}
  locale="en"
  timeZone="UTC"
/>`,
      },
    },
  },
  args: {
    people: [
      { value: 'alex', name: 'Alex' },
      { value: 'sam', name: 'Sam' },
    ],
  },
};
export const PeopleDetail: Story = {
  tags: ['!autodocs'],
  args: { defaultOpen: true, people: [{ value: 'alex', name: 'Alex' }] },
  play: async ({ canvas, userEvent, args }) => {
    const dialog = await canvas.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('switch', { name: 'Alex' }));
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Start' }));
    await expect(args.onValueChange).toHaveBeenCalledWith(
      expect.objectContaining({ focus: expect.objectContaining({ allowedPeople: ['alex'] }) }),
    );
  },
};
export const ZeroVolume: Story = {
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { ControlCenter, type ControlCenterLabels } from '@jfrader/ui';

const labels: ControlCenterLabels = {
  focus: 'Focus',
  notifications: 'Notifications',
  presenting: 'Presenting',
  focusDetails: 'Focus settings',
  notificationDetails: 'Notification channels',
  focusDescription: 'Choose a mode and duration.',
  notificationDescription: 'Choose notification channels.',
  modes: 'Mode',
  duration: 'Duration',
  volume: 'Alert volume',
  textSize: 'Text scale',
  start: 'Start',
  update: 'Update',
  close: 'Close',
  inactive: 'No focus session',
  until: (time) => \`Focus until \${time}\`,
  minutes: (value) => new Intl.NumberFormat('en', { style: 'unit', unit: 'minute' }).format(value),
};

const focusModes = [
  { value: 'work', label: 'Work', description: 'Allow priority contacts.', defaultMinutes: 25 },
  { value: 'reading', label: 'Reading', description: 'Silence distractions.', defaultMinutes: 45 },
];

const channels = [
  { value: 'chat', label: 'Chat', defaultChecked: true },
  { value: 'email', label: 'Email' },
];

<ControlCenter
  label="Quick settings"
  labels={labels}
  focusModes={focusModes}
  channels={channels}
  defaultValue={{ volume: 0, textSize: 130 }}
  locale="en"
  timeZone="UTC"
/>`,
      },
    },
  },
  args: { defaultValue: { volume: 0, textSize: 130 } },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('slider', { name: 'Alert volume' })).toHaveAttribute(
      'aria-valuenow',
      '0',
    );
  },
};
export const FocusDetail: Story = { tags: ['!autodocs'], args: { defaultOpen: true } };
export const NotificationsDetail: Story = {
  tags: ['!autodocs'],
  args: { defaultOpen: true, defaultDetail: 'notifications' },
};
export const Keyboard: Story = {
  play: async ({ canvas, userEvent, args }) => {
    const focus = canvas.getByRole('button', { name: 'Focus' });
    focus.focus();
    await userEvent.keyboard('{Enter}');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(focus).toHaveAttribute('aria-pressed', 'true');
    await userEvent.keyboard(' ');
    await expect(args.onValueChange).toHaveBeenCalledTimes(2);
    await expect(focus).toHaveAttribute('aria-pressed', 'false');
    const slider = canvas.getByRole('slider', { name: 'Alert volume' });
    slider.focus();
    await userEvent.keyboard('{Home}{ArrowRight}{PageUp}');
    await expect(slider).toHaveAttribute('aria-valuenow', '5');
    await userEvent.keyboard('{End}');
    await expect(slider).toHaveAttribute('aria-valuenow', '100');
    await expect(slider.ownerDocument.activeElement).toBe(slider);
    await expect(slider.ownerDocument.defaultView!.getComputedStyle(slider).outlineStyle).not.toBe(
      'none',
    );
  },
};
export const DraftApplyAndDiscard: Story = {
  tags: ['!autodocs'],
  play: async ({ canvas, userEvent, args }) => {
    const trigger = canvas.getByRole('button', { name: 'Focus settings' });
    await userEvent.click(trigger);
    const dialog = await within(trigger.ownerDocument.body).findByRole('dialog', {
      name: 'Focus settings',
    });
    await userEvent.click(within(dialog).getByRole('radio', { name: /Reading/ }));
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Start' }));
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ focus: expect.objectContaining({ mode: 'reading', minutes: 45 }) }),
    );
    await expect(dialog).toBeVisible();
    fireEvent(dialog, new Event('cancel', { cancelable: true }));
    await waitFor(async () => {
      await expect(dialog).not.toBeVisible();
      await expect(trigger.ownerDocument.activeElement).toBe(trigger);
    });
  },
};
export const ControlledRejects: Story = {
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { useState } from 'react';
import { ControlCenter, type ControlCenterLabels, type ControlCenterValue } from '@jfrader/ui';

const labels: ControlCenterLabels = {
  focus: 'Focus',
  notifications: 'Notifications',
  presenting: 'Presenting',
  focusDetails: 'Focus settings',
  notificationDetails: 'Notification channels',
  focusDescription: 'Choose a mode and duration.',
  notificationDescription: 'Choose notification channels.',
  modes: 'Mode',
  duration: 'Duration',
  volume: 'Alert volume',
  textSize: 'Text scale',
  start: 'Start',
  update: 'Update',
  close: 'Close',
  inactive: 'No focus session',
  until: (time) => \`Focus until \${time}\`,
  minutes: (value) => new Intl.NumberFormat('en', { style: 'unit', unit: 'minute' }).format(value),
};

const focusModes = [
  { value: 'work', label: 'Work', description: 'Allow priority contacts.', defaultMinutes: 25 },
  { value: 'reading', label: 'Reading', description: 'Silence distractions.', defaultMinutes: 45 },
];

const channels = [
  { value: 'chat', label: 'Chat', defaultChecked: true },
  { value: 'email', label: 'Email' },
];

export function ControlledControlCenter() {
  const [value] = useState<ControlCenterValue>({
    focus: null,
    notifications: false,
    presenting: false,
    channels: { chat: false, email: false },
    volume: 0,
    textSize: 100,
  });
  const [open] = useState(false);

  return (
    <ControlCenter
      label="Quick settings"
      labels={labels}
      focusModes={focusModes}
      channels={channels}
      locale="en"
      timeZone="UTC"
      value={value}
      open={open}
      onValueChange={() => {}}
      onOpenChange={() => {}}
    />
  );
}`,
      },
    },
  },
  args: {
    value: {
      focus: null,
      notifications: false,
      presenting: false,
      channels: { chat: false, email: false },
      volume: 0,
      textSize: 100,
    },
    open: false,
  },
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Notifications' }));
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(canvas.getByRole('button', { name: 'Notifications' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    await userEvent.click(canvas.getByRole('button', { name: 'Focus settings' }));
    await expect(args.onOpenChange).toHaveBeenCalledTimes(1);
    await expect(canvas.queryByRole('dialog')).not.toBeInTheDocument();
  },
};

export const ControlledDraftRejects: Story = {
  tags: ['!autodocs'],
  args: {
    defaultOpen: true,
    value: {
      focus: null,
      notifications: true,
      presenting: false,
      channels: {},
      volume: 60,
      textSize: 100,
    },
  },
  play: async ({ canvas, userEvent, args }) => {
    const dialog = await canvas.findByRole('dialog', { name: 'Focus settings' });
    await userEvent.click(within(dialog).getByRole('radio', { name: /Reading/ }));
    const before = Date.now();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Start' }));
    const after = Date.now();
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    const requested = args.onValueChange!.mock.calls[0]![0].focus!;
    await expect(Date.parse(requested.until)).toBeGreaterThanOrEqual(before + 45 * 60_000);
    await expect(Date.parse(requested.until)).toBeLessThanOrEqual(after + 45 * 60_000);
    // The rejected draft keeps the dialog open through its enter transition: settle before asserting.
    await waitFor(async () => {
      await expect(within(dialog).getByRole('radio', { name: /Reading/ })).toBeChecked();
      await expect(within(dialog).getByRole('button', { name: 'Start' })).toBeVisible();
    });
    await expect(canvas.getByText('No focus session')).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
    await waitFor(async () => {
      await expect(dialog).not.toBeVisible();
    });
    await userEvent.click(canvas.getByRole('button', { name: 'Focus settings' }));
    await expect(
      within(await canvas.findByRole('dialog')).getByRole('radio', { name: /Work/ }),
    ).toBeChecked();
  },
};

export const ControlledMeterRejects: Story = {
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { useState } from 'react';
import { ControlCenter, type ControlCenterLabels, type ControlCenterValue } from '@jfrader/ui';

const labels: ControlCenterLabels = {
  focus: 'Focus',
  notifications: 'Notifications',
  presenting: 'Presenting',
  focusDetails: 'Focus settings',
  notificationDetails: 'Notification channels',
  focusDescription: 'Choose a mode and duration.',
  notificationDescription: 'Choose notification channels.',
  modes: 'Mode',
  duration: 'Duration',
  volume: 'Alert volume',
  textSize: 'Text scale',
  start: 'Start',
  update: 'Update',
  close: 'Close',
  inactive: 'No focus session',
  until: (time) => \`Focus until \${time}\`,
  minutes: (value) => new Intl.NumberFormat('en', { style: 'unit', unit: 'minute' }).format(value),
};

const focusModes = [
  { value: 'work', label: 'Work', description: 'Allow priority contacts.', defaultMinutes: 25 },
  { value: 'reading', label: 'Reading', description: 'Silence distractions.', defaultMinutes: 45 },
];

const channels = [
  { value: 'chat', label: 'Chat', defaultChecked: true },
  { value: 'email', label: 'Email' },
];

export function ControlledMeterControlCenter() {
  const [value] = useState<ControlCenterValue>({
    focus: null,
    notifications: true,
    presenting: false,
    channels: {},
    volume: 0,
    textSize: 100,
  });

  return (
    <ControlCenter
      label="Quick settings"
      labels={labels}
      focusModes={focusModes}
      channels={channels}
      locale="en"
      timeZone="UTC"
      value={value}
      onValueChange={() => {}}
    />
  );
}`,
      },
    },
  },
  args: {
    value: {
      focus: null,
      notifications: true,
      presenting: false,
      channels: {},
      volume: 0,
      textSize: 100,
    },
  },
  play: async ({ canvas, userEvent, args }) => {
    const slider = canvas.getByRole('slider', { name: 'Alert volume' });
    slider.focus();
    await userEvent.keyboard('{End}');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenCalledWith(expect.objectContaining({ volume: 100 }));
    await expect(slider).toHaveAttribute('aria-valuenow', '0');
  },
};

export const ChannelsKeyboard: Story = {
  tags: ['!autodocs'],
  args: { defaultOpen: true, defaultDetail: 'notifications' },
  play: async ({ canvas, userEvent, args }) => {
    const dialog = await canvas.findByRole('dialog');
    const chat = within(dialog).getByRole('switch', { name: 'Chat' });
    await expect(chat).toBeChecked();
    chat.focus();
    await userEvent.keyboard(' ');
    await expect(chat).not.toBeChecked();
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenCalledWith(
      expect.objectContaining({ channels: { chat: false, email: false } }),
    );
  },
};
