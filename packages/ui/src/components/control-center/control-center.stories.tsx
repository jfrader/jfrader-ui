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
          'Adjust focus modes, notification channels, volume, and display scale from a central panel.',
      },
      sections: [
        { title: 'Basic', stories: ['Default'] },
        { title: 'Configuration', stories: ['People', 'NoChannels', 'ZeroVolume'] },
        { title: 'State', stories: ['Disabled'] },
      ],
      usage: `### When to use
Provide quick access to workspace preferences such as focus sessions, notification routing, alert volume, and display scaling.

### Values and constraints

Persist settings with \`value\` and \`onValueChange\`. The component manages preference state only; it does not change browser zoom, operating system volume, or platform notification permissions directly.

Focus session edits inside the details dialog are drafts. Close or Escape discards edits; Start and Update request one value and leave the dialog open. A rejected controlled request leaves the committed tile and status unchanged. Session expiry does not write settings.

### Keyboard and accessibility

Press Enter or Space to toggle tiles or open detail dialogs. Detail dialogs contain focus and restore focus to the trigger on close. Use arrows to choose focus modes and adjust sliders, including duration. Slider arrows, Home, End, Page Up and Page Down use the configured bounds; horizontal direction follows RTL.`,
      source: {
        language: 'tsx',
        code: `import { ControlCenter, Surface, styled, type ControlCenterLabels } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const SettingsPanel = styled(Surface)({
  boxSizing: 'border-box',
  inlineSize: \`calc(\${vars.space[8]} * 18)\`,
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
  minutes: (value) =>
    new Intl.NumberFormat('en', { style: 'unit', unit: 'minute' }).format(value),
};

const focusModes = [
  { value: 'work', label: 'Work', description: 'Allow priority contacts.', defaultMinutes: 25 },
  { value: 'reading', label: 'Reading', description: 'Silence distractions.', defaultMinutes: 45 },
];

const channels = [
  { value: 'chat', label: 'Chat', defaultChecked: true },
  { value: 'email', label: 'Email' },
];

export function QuickSettings() {
  return (
    <SettingsPanel>
      <PanelLabel>Workspace settings</PanelLabel>
      <ControlCenter
        label="Quick settings"
        labels={labels}
        focusModes={focusModes}
        channels={channels}
        locale="en"
        timeZone="UTC"
        slots={{ grid: SettingsRows }}
        slotProps={{ modes: { orientation: 'horizontal' } }}
        onValueChange={(value) => console.log(value)}
      />
    </SettingsPanel>
  );
}`,
      },
    },
  },
} satisfies Meta<typeof ControlCenter>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {
  name: 'Quick settings',
  parameters: {
    docs: {
      description: {
        story: 'Manage focus sessions, notification channels, volume, and text scale.',
      },
      source: {
        language: 'tsx',
        code: `import { ControlCenter, Surface, styled, type ControlCenterLabels } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const SettingsPanel = styled(Surface)({
  boxSizing: 'border-box',
  inlineSize: \`calc(\${vars.space[8]} * 18)\`,
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
  minutes: (value) =>
    new Intl.NumberFormat('en', { style: 'unit', unit: 'minute' }).format(value),
};

const focusModes = [
  { value: 'work', label: 'Work', description: 'Allow priority contacts.', defaultMinutes: 25 },
  { value: 'reading', label: 'Reading', description: 'Silence distractions.', defaultMinutes: 45 },
];

const channels = [
  { value: 'chat', label: 'Chat', defaultChecked: true },
  { value: 'email', label: 'Email' },
];

export function QuickSettings() {
  return (
    <SettingsPanel>
      <PanelLabel>Workspace settings</PanelLabel>
      <ControlCenter
        label="Quick settings"
        labels={labels}
        focusModes={focusModes}
        channels={channels}
        locale="en"
        timeZone="UTC"
        slots={{ grid: SettingsRows }}
        slotProps={{ modes: { orientation: 'horizontal' } }}
        onValueChange={(value) => console.log(value)}
      />
    </SettingsPanel>
  );
}`,
      },
    },
  },
};
export const Light: Story = { globals: { theme: 'light' } };
export const RTL: Story = { parameters: { docs: { source: { language: 'tsx', code: "import { ControlCenter, type ControlCenterLabels } from '@jfrader/ui';\n\nconst labels: ControlCenterLabels = {\n  focus: 'Focus',\n  notifications: 'Notifications',\n  presenting: 'Presenting',\n  focusDetails: 'Focus settings',\n  notificationDetails: 'Notification channels',\n  focusDescription: 'Choose a mode and duration.',\n  notificationDescription: 'Choose notification channels.',\n  modes: 'Mode',\n  duration: 'Duration',\n  volume: 'Alert volume',\n  textSize: 'Text scale',\n  start: 'Start',\n  update: 'Update',\n  close: 'Close',\n  inactive: 'No focus session',\n  until: (time) => `Focus until ${time}`,\n  minutes: (value) => new Intl.NumberFormat('en', { style: 'unit', unit: 'minute' }).format(value),\n};\n\nconst focusModes = [\n  { value: 'work', label: 'Work', description: 'Allow priority contacts.', defaultMinutes: 25 },\n  { value: 'reading', label: 'Reading', description: 'Silence distractions.', defaultMinutes: 45 },\n];\n\nconst channels = [\n  { value: 'chat', label: 'Chat', defaultChecked: true },\n  { value: 'email', label: 'Email' },\n];\n\n<ControlCenter\n  label=\"Quick settings\"\n  labels={labels}\n  focusModes={focusModes}\n  channels={channels}\n  locale=\"en\"\n  timeZone=\"UTC\"\n  dir=\"rtl\"\n/>" } } }, args: { dir: 'rtl' } };
export const Disabled: Story = {
  name: 'Disabled',
  parameters: {
    docs: {
      description: {
        story: 'Disable all tiles, detail triggers, and sliders.',
      },
      source: {
        language: 'tsx',
        code: `import { ControlCenter, Surface, styled, type ControlCenterLabels } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const SettingsPanel = styled(Surface)({
  boxSizing: 'border-box',
  inlineSize: \`calc(\${vars.space[8]} * 18)\`,
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

export function DisabledExample() {
  return (
    <SettingsPanel>
      <PanelLabel>Workspace settings</PanelLabel>
      <ControlCenter
        label="Quick settings"
        labels={labels}
        focusModes={focusModes}
        channels={channels}
        locale="en"
        timeZone="UTC"
        disabled
        slots={{ grid: SettingsRows }}
        slotProps={{ modes: { orientation: 'horizontal' } }}
      />
    </SettingsPanel>
  );
}`,
      },
    },
  },
  args: { disabled: true },
};
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
export const NoChannels: Story = {
  name: 'Without notification channels',
  parameters: {
    docs: {
      description: {
        story: 'Omit notification channels to show only mode tiles and sliders.',
      },
      source: {
        language: 'tsx',
        code: `import { ControlCenter, Surface, styled, type ControlCenterLabels } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const SettingsPanel = styled(Surface)({
  boxSizing: 'border-box',
  inlineSize: \`calc(\${vars.space[8]} * 18)\`,
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

export function NoChannelsExample() {
  return (
    <SettingsPanel>
      <PanelLabel>Workspace settings</PanelLabel>
      <ControlCenter
        label="Quick settings"
        labels={labels}
        focusModes={focusModes}
        channels={[]}
        locale="en"
        timeZone="UTC"
        slots={{ grid: SettingsRows }}
        slotProps={{ modes: { orientation: 'horizontal' } }}
      />
    </SettingsPanel>
  );
}`,
      },
    },
  },
  args: { channels: [] },
};
export const People: Story = {
  name: 'Allowed contacts',
  parameters: {
    docs: {
      description: {
        story: 'Include specific contacts who can break through an active focus session.',
      },
      source: {
        language: 'tsx',
        code: `import { ControlCenter, Surface, styled, type ControlCenterLabels } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const SettingsPanel = styled(Surface)({
  boxSizing: 'border-box',
  inlineSize: \`calc(\${vars.space[8]} * 18)\`,
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

export function AllowedContactsExample() {
  return (
    <SettingsPanel>
      <PanelLabel>Workspace settings</PanelLabel>
      <ControlCenter
        label="Quick settings"
        labels={labels}
        focusModes={focusModes}
        channels={channels}
        people={people}
        locale="en"
        timeZone="UTC"
        slots={{ grid: SettingsRows }}
        slotProps={{ modes: { orientation: 'horizontal' } }}
      />
    </SettingsPanel>
  );
}`,
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
  name: 'Initial levels',
  parameters: {
    docs: {
      description: {
        story: 'Set custom initial levels for alert volume and display text scale.',
      },
      source: {
        language: 'tsx',
        code: `import { ControlCenter, Surface, styled, type ControlCenterLabels } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const SettingsPanel = styled(Surface)({
  boxSizing: 'border-box',
  inlineSize: \`calc(\${vars.space[8]} * 18)\`,
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

export function InitialLevelsExample() {
  return (
    <SettingsPanel>
      <PanelLabel>Workspace settings</PanelLabel>
      <ControlCenter
        label="Quick settings"
        labels={labels}
        focusModes={focusModes}
        channels={channels}
        defaultValue={{ volume: 0, textSize: 130 }}
        locale="en"
        timeZone="UTC"
        slots={{ grid: SettingsRows }}
        slotProps={{ modes: { orientation: 'horizontal' } }}
      />
    </SettingsPanel>
  );
}`,
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
