import type { ComponentPropsWithRef, ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { expectEntranceMotion, expectRetainedExit, settleMotion } from '../../testing/motion-assertions';
import { withLightTheme } from '../../testing/story-decorators';
import { Button } from '../button';
import {
  CommandPalette,
  type CommandPaletteCompoundProps,
  type CommandPaletteEasyProps,
  type CommandPaletteItemRecord,
  type CommandPaletteProps,
} from './index';

const LABEL = 'Command palette';
const TRIGGER = 'Open commands';

interface CommandItem extends CommandPaletteItemRecord {
  id: string;
}

const COMMANDS: readonly CommandItem[] = [
  { value: 'open-file', label: 'Open file', group: 'Files', id: 'cmd-1' },
  { value: 'save-file', label: 'Save file', keywords: 'write disk', group: 'Files', id: 'cmd-2' },
  { value: 'toggle-theme', label: 'Toggle theme', keywords: 'dark light', group: 'View', id: 'cmd-3' },
  { value: 'zoom-in', label: 'Zoom in', group: 'View', id: 'cmd-4' },
];

const snippet = `import { CommandPalette } from '@jfrader/ui';

function Commands({ runCommand }: { runCommand: (value: string) => void }) {
  return <CommandPalette
  triggerLabel="Open commands"
  label="Command palette"
  items={[
    { value: 'open-file', label: 'Open file', group: 'Files', id: 'cmd-1' },
    { value: 'save-file', label: 'Save file', keywords: 'write disk', group: 'Files', id: 'cmd-2' },
    { value: 'toggle-theme', label: 'Toggle theme', keywords: 'dark light', group: 'View', id: 'cmd-3' },
    { value: 'zoom-in', label: 'Zoom in', group: 'View', id: 'cmd-4' },
  ]}
  onSelect={(item) => runCommand(item.value)}
/>;
}`;

const compoundSnippet = `import { useState } from 'react';
import { CommandPalette } from '@jfrader/ui';

function Commands() {
  const [selections, setSelections] = useState<string[]>([]);
  const select = (value: string) => () => setSelections((previous) => [...previous, value]);
  return <>
    <CommandPalette>
      <CommandPalette.Trigger>Open commands</CommandPalette.Trigger>
      <CommandPalette.Content>
        <CommandPalette.Input placeholder="Type a command" />
        <CommandPalette.List>
          <CommandPalette.Group label="Files">
            <CommandPalette.Item value="open-file" onSelect={select('open-file')}>Open file</CommandPalette.Item>
            <CommandPalette.Item value="save-file" keywords="write disk" onSelect={select('save-file')}>Save file</CommandPalette.Item>
          </CommandPalette.Group>
          <CommandPalette.Group label="View">
            <CommandPalette.Item value="toggle-theme" keywords="dark light" onSelect={select('toggle-theme')}>Toggle theme</CommandPalette.Item>
            <CommandPalette.Item value="zoom-in" onSelect={select('zoom-in')}>Zoom in</CommandPalette.Item>
          </CommandPalette.Group>
        </CommandPalette.List>
        <CommandPalette.Empty />
      </CommandPalette.Content>
    </CommandPalette>
    <output aria-label="Selections">{selections.join(',')}</output>
  </>;
}`;

const meta: Meta<CommandPaletteCompoundProps> = {
  title: 'Surfaces/CommandPalette',
  component: CommandPalette,
  parameters: {
    docs: {
      description: {
        component: 'Search for a command and run it from a modal dialog.',
      },
      sections: [
        { title: 'Basic', stories: ['Default'] },
        { title: 'Items and groups', stories: ['EasyModeAppAndItemSelect'] },
        { title: 'Filtering and empty results', stories: ['Filter'] },
        { title: 'Shortcuts', stories: ['Shortcut'] },
        { title: 'Controlled', stories: ['EasyModeControlled'] },
        { title: 'Composition', stories: ['Compound'] },
        { title: 'Keyboard', stories: ['KeyboardWrap'] },
      ],
      usage: `### When to use
Use a command palette for searchable application actions. Use a menu for a short list that does not need search.

### Values and constraints

Command values must be unique. Choose generated items or compound content, not both. Register application shortcuts yourself; the palette does not install a global shortcut.

Selection requests closure immediately, without waiting for asynchronous command work. Disabled commands stay visible but cannot run. If application state controls opening, accept close requests to dismiss the palette.

### Filtering

Matching is case-insensitive and includes keywords. Each query change highlights the first enabled match; reopening resets the query. Disabled matches count toward the result total. Translate the accessible dialog name, empty message and result announcement for your application.

### Keyboard and accessibility

- Opening focuses the input; DOM focus stays there while you navigate options. Use ArrowDown and ArrowUp to move with wrapping, or unmodified Home and End to reach the first and last enabled matches.
- Press Enter to select the highlighted command. With no enabled match, Enter leaves the palette open. Press Escape to request closure; accepted closure returns focus to the invoker after the exit finishes.
- Tab and Shift+Tab stay inside the modal while it is open.`,
    },
  },
};

export default meta;

type Story = StoryObj<(props: CommandPaletteCompoundProps) => ReactNode>;
type EasyStory = StoryObj<(props: CommandPaletteEasyProps<CommandItem>) => ReactNode>;

type CheckedCommandPalette<Props extends CommandPaletteProps> = Props;
export type CommandPaletteTypeRegression = {
  // @ts-expect-error Items and children are mutually exclusive.
  itemsWithChildren: CheckedCommandPalette<{ items: typeof COMMANDS; children: ReactNode }>;
  // @ts-expect-error Compound mode rejects triggerLabel.
  childrenWithTriggerLabel: CheckedCommandPalette<{ triggerLabel: string; children: ReactNode }>;
  // @ts-expect-error Compound mode rejects onSelect.
  childrenWithOnSelect: CheckedCommandPalette<{ onSelect: (item: unknown) => void; children: ReactNode }>;
  // @ts-expect-error Compound mode rejects slots.
  childrenWithSlots: CheckedCommandPalette<{ slots: { root?: () => null }; children: ReactNode }>;
  // @ts-expect-error Compound mode rejects slotProps.
  childrenWithSlotProps: CheckedCommandPalette<{ slotProps: { root?: {} }; children: ReactNode }>;
  // @ts-expect-error Compound mode rejects component.
  childrenWithComponent: CheckedCommandPalette<{ component: () => null; children: ReactNode }>;
  // @ts-expect-error Compound mode rejects placeholder.
  childrenWithPlaceholder: CheckedCommandPalette<{ placeholder: string; children: ReactNode }>;
  // @ts-expect-error Compound mode rejects empty.
  childrenWithEmpty: CheckedCommandPalette<{ empty: ReactNode; children: ReactNode }>;
};

function CommandPaletteExample(props: CommandPaletteCompoundProps) {
  const [selections, setSelections] = useState<string[]>([]);
  const select = (value: string) => () => setSelections((previous) => [...previous, value]);
  return (
    <>
      <CommandPalette {...props}>
        <CommandPalette.Trigger>{TRIGGER}</CommandPalette.Trigger>
        <CommandPalette.Content>
          <CommandPalette.Input placeholder="Type a command" />
          <CommandPalette.List>
            <CommandPalette.Group label="Files">
              <CommandPalette.Item value="open-file" onSelect={select('open-file')}>
                Open file
              </CommandPalette.Item>
              <CommandPalette.Item value="save-file" keywords="write disk" onSelect={select('save-file')}>
                Save file
              </CommandPalette.Item>
            </CommandPalette.Group>
            <CommandPalette.Group label="View">
              <CommandPalette.Item value="toggle-theme" keywords="dark light" onSelect={select('toggle-theme')}>
                Toggle theme
              </CommandPalette.Item>
              <CommandPalette.Item value="zoom-in" onSelect={select('zoom-in')}>
                Zoom in
              </CommandPalette.Item>
            </CommandPalette.Group>
          </CommandPalette.List>
          <CommandPalette.Empty />
        </CommandPalette.Content>
      </CommandPalette>
      <output aria-label="Selections">{selections.join(',')}</output>
    </>
  );
}
CommandPaletteExample.displayName = 'CommandPaletteExample';

function getInput(canvasElement: HTMLElement) {
  return within(canvasElement).getByRole('combobox', { name: LABEL });
}

function getOption(canvasElement: HTMLElement, name: string) {
  return within(canvasElement).getByRole('option', { name });
}

async function openPalette(canvasElement: HTMLElement) {
  const canvas = within(canvasElement);
  const trigger = canvas.getByRole('button', { name: TRIGGER });
  await userEvent.click(trigger);
  const dialog = await canvas.findByRole('dialog', { name: LABEL });
  const input = getInput(canvasElement);
  await waitFor(() => expect(canvasElement.ownerDocument.activeElement).toBe(input));
  // Visibility assertions read opacity: let the entrance finish first.
  await settleMotion(dialog);
  return { canvas, trigger, dialog, input };
}

/** Virtual focus: the option is referenced by aria-activedescendant while DOM focus stays on the input. */
async function expectActive(canvasElement: HTMLElement, name: string) {
  const input = getInput(canvasElement);
  await waitFor(() => expect(input).toHaveAttribute('aria-activedescendant', getOption(canvasElement, name).id));
  await expect(getOption(canvasElement, name)).toHaveAttribute('data-active');
  await expect(getOption(canvasElement, name)).toHaveAttribute('aria-selected', 'true');
  await expect(canvasElement.ownerDocument.activeElement).toBe(input);
}

async function expectClosed(canvasElement: HTMLElement, trigger: HTMLElement) {
  await waitFor(() => expect(within(canvasElement).queryByRole('dialog')).toBeNull());
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await expect(trigger).toHaveFocus();
}

export const Default: EasyStory = {
  name: 'Search application commands',
  args: {
    triggerLabel: TRIGGER,
    label: LABEL,
    items: COMMANDS,
    onSelect: fn(),
  },
  parameters: {
    docs: {
      description: { story: 'Open a searchable command list grouped into Files and View.' },
      source: { language: 'tsx', code: snippet },
    },
  },
  render: (args) => <CommandPalette {...args} />,
  play: async ({ args, canvasElement }) => {
    const { canvas, trigger, dialog, input } = await openPalette(canvasElement);
    await expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await expect(dialog).toHaveAttribute('aria-modal', 'true');
    await expect(getComputedStyle(input).outlineStyle).not.toBe('none');

    const listbox = canvas.getByRole('listbox', { name: LABEL });
    await expect(input).toHaveAttribute('aria-controls', listbox.id);
    await expect(input).toHaveAttribute('aria-autocomplete', 'list');
    await expect(input).toHaveAttribute('aria-expanded', 'true');
    await expect(within(listbox).getAllByRole('option')).toHaveLength(4);
    await expect(canvas.getByRole('group', { name: 'Files' })).toBeVisible();
    await expect(canvas.getByRole('group', { name: 'View' })).toBeVisible();

    await expectActive(canvasElement, 'Open file');
    await userEvent.keyboard('{ArrowDown}');
    await expectActive(canvasElement, 'Save file');

    await userEvent.keyboard('{Enter}');
    await expectClosed(canvasElement, trigger);
    await expect(args.onSelect).toHaveBeenCalledTimes(1);
    await expect(args.onSelect).toHaveBeenLastCalledWith(COMMANDS[1]);
  },
};

export const EasyModeFilterAndDismiss: EasyStory = {
  name: 'Easy mode filter and dismiss',
  args: {
    triggerLabel: TRIGGER,
    label: LABEL,
    items: COMMANDS,
    onSelect: fn(),
  },
  render: (args) => <CommandPalette {...args} />,
  play: async ({ canvasElement }) => {
    const { canvas, trigger, input } = await openPalette(canvasElement);
    await userEvent.type(input, 'theme');
    await waitFor(() => expect(canvas.getAllByRole('option')).toHaveLength(1));
    await expectActive(canvasElement, 'Toggle theme');

    await userEvent.keyboard('{Escape}');
    await expectClosed(canvasElement, trigger);
  },
};

function ShortcutCommands() {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState('none');
  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== 'k' || !(event.metaKey || event.ctrlKey)) return;
      event.preventDefault();
      setOpen(true);
    };
    document.addEventListener('keydown', handleShortcut);
    return () => document.removeEventListener('keydown', handleShortcut);
  }, []);
  return <>
    <CommandPalette triggerLabel="Open commands" label="Command palette" open={open}
      onOpenChange={setOpen} items={[{ value: 'open-file', label: 'Open file' }]}
      onSelect={(item) => setSelected(item.value)} />
    <output aria-label="Selected command">{selected}</output>
  </>;
}

export const Shortcut: StoryObj = {
  name: 'Application keyboard shortcut',
  render: () => <ShortcutCommands />,
  parameters: { docs: {
    description: { story: 'Press Ctrl+K or Command+K inside the example to open the palette.' },
    source: { language: 'tsx', code: `import { useEffect, useState } from 'react';
import { CommandPalette } from '@jfrader/ui';

function Commands() {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState('none');
  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== 'k' || !(event.metaKey || event.ctrlKey)) return;
      event.preventDefault();
      setOpen(true);
    };
    document.addEventListener('keydown', handleShortcut);
    return () => document.removeEventListener('keydown', handleShortcut);
  }, []);
  return <>
    <CommandPalette triggerLabel="Open commands" label="Command palette" open={open}
      onOpenChange={setOpen} items={[{ value: 'open-file', label: 'Open file' }]}
      onSelect={(item) => setSelected(item.value)} />
    <output aria-label="Selected command">{selected}</output>
  </>;
}` },
  } },
  play: async ({ canvasElement }) => {
    const trigger = within(canvasElement).getByRole('button', { name: TRIGGER });
    trigger.focus();
    await userEvent.keyboard('{Control>}k{/Control}');
    const dialog = await within(canvasElement).findByRole('dialog', { name: LABEL });
    await settleMotion(dialog);
    await expect(getInput(canvasElement)).toHaveFocus();
    await userEvent.keyboard('{Escape}');
    await expectClosed(canvasElement, trigger);
  },
};

function ControlledEasyFixture() {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string>('none');
  return (
    <>
      <Button onClick={() => setOpen(true)}>External open</Button>
      <CommandPalette
        open={open}
        onOpenChange={setOpen}
        label={LABEL}
        items={COMMANDS}
        onSelect={(item) => setSelected(item.value)}
      />
      <output aria-label="Selected command">{selected}</output>
    </>
  );
}

export const EasyModeControlled: StoryObj = {
  name: 'Open from application state',
  parameters: { docs: {
    description: { story: 'Open the palette from an external button and keep the selected command in state.' },
    source: { language: 'tsx', code: `import { useState } from 'react';
import { Button, CommandPalette } from '@jfrader/ui';

const commands = [
  { value: 'open-file', label: 'Open file', group: 'Files', id: 'cmd-1' },
  { value: 'save-file', label: 'Save file', keywords: 'write disk', group: 'Files', id: 'cmd-2' },
  { value: 'toggle-theme', label: 'Toggle theme', keywords: 'dark light', group: 'View', id: 'cmd-3' },
  { value: 'zoom-in', label: 'Zoom in', group: 'View', id: 'cmd-4' },
];

function Commands() {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState('none');
  return <>
    <Button onClick={() => setOpen(true)}>External open</Button>
    <CommandPalette label="Command palette" items={commands} open={open}
      onOpenChange={setOpen} onSelect={(item) => setSelected(item.value)} />
    <output aria-label="Selected command">{selected}</output>
  </>;
}` },
  } },
  render: () => <ControlledEasyFixture />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const opener = canvas.getByRole('button', { name: 'External open' });
    await expect(opener.getBoundingClientRect().height).toBeGreaterThanOrEqual(32);
    await userEvent.click(opener);
    const dialog = await canvas.findByRole('dialog', { name: LABEL });
    await expect(dialog).toHaveAttribute('open');
    await expectActive(canvasElement, 'Open file');

    await userEvent.keyboard('{Enter}');
    await waitFor(() => expect(canvas.queryByRole('dialog')).toBeNull());
    await expect(canvas.getByLabelText('Selected command')).toHaveTextContent('open-file');
  },
};

export const EasyModeSlots: EasyStory = {
  name: 'Easy mode slots',
  args: {
    triggerLabel: TRIGGER,
    label: LABEL,
    items: COMMANDS,
    placeholder: 'Find an action...',
    slotProps: {
      trigger: { className: 'custom-palette-trigger' },
      input: { 'aria-describedby': 'helper-note' },
    },
  },
  render: (args) => (
    <>
      <span id="helper-note">Keyboard shortcuts active</span>
      <CommandPalette {...args} />
    </>
  ),
  play: async ({ canvasElement }) => {
    const trigger = within(canvasElement).getByRole('button', { name: TRIGGER });
    await expect(trigger).toHaveClass('custom-palette-trigger');
    const { input } = await openPalette(canvasElement);
    await expect(input).toHaveAttribute('placeholder', 'Find an action...');
    await expect(input).toHaveAttribute('aria-describedby', 'helper-note');
    await userEvent.keyboard('{Escape}');
  },
};

function CustomRootBox({ children, ...props }: ComponentPropsWithRef<'div'>) {
  return (
    <div {...props} data-custom-root="true">
      {children}
    </div>
  );
}

export const EasyModeOverrides: EasyStory = {
  // Inline styles exercise the documented root/slot style-merging API.
  name: 'Easy mode overrides',
  render: () => {
    return (
      <CommandPalette
        triggerLabel={TRIGGER}
        label={LABEL}
        items={COMMANDS}
        component={CustomRootBox}
        className="host-root-class"
        data-testid="host-root"
        style={{ opacity: 0.85, zIndex: 1 }}
        slotProps={{
          root: {
            className: 'slot-root-class',
            'data-testid': 'slot-root-wins',
            style: { zIndex: 2 },
          },
          trigger: { 'data-testid': 'slot-trigger' },
          content: { 'data-testid': 'slot-content' },
          input: { 'data-testid': 'slot-input' },
          list: { 'data-testid': 'slot-list' },
          group: { 'data-testid': 'slot-group' },
          item: { 'data-testid': 'slot-item' },
        }}
      />
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const root = canvasElement.querySelector('[data-custom-root="true"]') as HTMLElement;
    await expect(root).not.toBeNull();
    // slotProps.root wins on conflict except merged className and style
    await expect(root).toHaveAttribute('data-testid', 'slot-root-wins');
    await expect(root).toHaveClass('host-root-class');
    await expect(root).toHaveClass('slot-root-class');
    await expect(root.style.opacity).toBe('0.85');
    await expect(root.style.zIndex).toBe('2');

    const trigger = canvas.getByTestId('slot-trigger');
    await expect(trigger).toBeVisible();
    await userEvent.click(trigger);

    const dialog = await canvas.findByTestId('slot-content');
    await expect(dialog).toBeVisible();
    await settleMotion(dialog);

    const input = canvas.getByTestId('slot-input');
    await expect(input).toBeVisible();

    const list = canvas.getByTestId('slot-list');
    await expect(list).toBeVisible();

    const groups = canvas.getAllByTestId('slot-group');
    await expect(groups.length).toBeGreaterThan(0);

    const items = canvas.getAllByTestId('slot-item');
    await expect(items.length).toBe(4);

    await userEvent.keyboard('{Escape}');
    await expectClosed(canvasElement, trigger);
  },
};

const itemSelectSpy = fn();

export const EasyModeAppAndItemSelect: EasyStory = {
  name: 'Item actions and unavailable commands',
  parameters: { docs: {
    description: { story: 'Run an item action while keeping an unavailable command visible but inactive.' },
    source: { language: 'tsx', code: `import { CommandPalette } from '@jfrader/ui';

function AuditCommands({ runAudit, recordCommand }: {
  runAudit: () => void;
  recordCommand: (value: string) => void;
}) {
  return <CommandPalette triggerLabel="Open commands" label="Command palette"
    items={[
      { value: 'run-audit', label: 'Run audit', id: 'cmd-audit', onSelect: runAudit },
      { value: 'delete-all', label: 'Delete all', id: 'cmd-del', disabled: true },
    ]}
    onSelect={(item) => recordCommand(item.value)} />;
}` },
  } },
  args: {
    triggerLabel: TRIGGER,
    label: LABEL,
    items: [
      { value: 'run-audit', label: 'Run audit', id: 'cmd-audit', onSelect: itemSelectSpy },
      { value: 'delete-all', label: 'Delete all', id: 'cmd-del', disabled: true },
    ],
    onSelect: fn(),
  },
  render: (args) => <CommandPalette {...args} />,
  play: async ({ args, canvasElement }) => {
    itemSelectSpy.mockClear();
    const { trigger, dialog } = await openPalette(canvasElement);
    const disabledOption = within(dialog).getByRole('option', { name: 'Delete all' });
    await expect(disabledOption).toHaveAttribute('aria-disabled', 'true');

    // Clicking disabled option does not select and does not close
    await userEvent.click(disabledOption);
    await expect(dialog).toHaveAttribute('open');
    await expect(itemSelectSpy).toHaveBeenCalledTimes(0);
    await expect(args.onSelect).toHaveBeenCalledTimes(0);

    // Selecting enabled option calls both item.onSelect and app onSelect
    const enabledOption = within(dialog).getByRole('option', { name: 'Run audit' });
    await userEvent.click(enabledOption);
    await expectClosed(canvasElement, trigger);

    await expect(itemSelectSpy).toHaveBeenCalledTimes(1);
    await expect(args.onSelect).toHaveBeenCalledTimes(1);
    await expect(args.onSelect).toHaveBeenLastCalledWith(args.items[0]);
  },
};

export const EasyModeUncontrolledDismiss: EasyStory = {
  name: 'Easy mode uncontrolled dismiss',
  tags: ['!autodocs'],
  args: {
    defaultOpen: true,
    label: LABEL,
    items: COMMANDS,
  },
  render: (args) => <CommandPalette {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const dialog = await canvas.findByRole('dialog', { name: LABEL });
    await settleMotion(dialog);
    await expect(dialog).toHaveAttribute('open');

    const input = getInput(canvasElement);
    await expect(canvasElement.ownerDocument.activeElement).toBe(input);

    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(canvas.queryByRole('dialog')).toBeNull());
  },
};

export const Compound: Story = {
  name: 'Compose grouped commands',
  parameters: { docs: {
    description: { story: 'Compose the input, groups, items and empty state, then record selections.' },
    source: { language: 'tsx', code: compoundSnippet },
  } },
  render: (args) => <CommandPaletteExample {...args} />,
  play: async ({ canvasElement }) => {
    const { canvas, trigger, dialog, input } = await openPalette(canvasElement);
    await expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await expect(dialog).toHaveAttribute('aria-modal', 'true');
    await expect(getComputedStyle(input).outlineStyle).not.toBe('none');

    const listbox = canvas.getByRole('listbox', { name: LABEL });
    await expect(input).toHaveAttribute('aria-controls', listbox.id);
    await expect(input).toHaveAttribute('aria-autocomplete', 'list');
    await expect(input).toHaveAttribute('aria-expanded', 'true');
    await expect(within(listbox).getAllByRole('option')).toHaveLength(4);
    await expect(canvas.getByRole('group', { name: 'Files' })).toBeVisible();
    await expect(canvas.getByRole('group', { name: 'View' })).toBeVisible();
    await expect(getOption(canvasElement, 'Open file').id).toMatch(/-opt-open-file-item$/);

    await expectActive(canvasElement, 'Open file');
    await expect(getComputedStyle(getOption(canvasElement, 'Open file')).outlineStyle).not.toBe('none');
    await userEvent.keyboard('{ArrowDown}');
    await expectActive(canvasElement, 'Save file');

    await userEvent.keyboard('{Enter}');
    await expectClosed(canvasElement, trigger);
    await expect(canvas.getByLabelText('Selections')).toHaveTextContent(/^save-file$/);
  },
};

export const Filter: Story = {
  name: 'Search text, keywords and empty results',
  parameters: { docs: {
    description: { story: 'Search for disk to match Save file, or enter zzz to show the empty state.' },
    source: { language: 'tsx', code: compoundSnippet },
  } },
  render: (args) => <CommandPaletteExample {...args} />,
  play: async ({ canvasElement }) => {
    const { canvas, dialog, input } = await openPalette(canvasElement);
    const status = within(dialog).getByRole('status');
    await expect(status).toHaveTextContent(/^$/);

    await userEvent.type(input, 'file');
    await waitFor(() => expect(canvas.getAllByRole('option')).toHaveLength(2));
    await expect(canvas.queryByRole('group', { name: 'View' })).toBeNull();
    await expect(status).toHaveTextContent(/^2 results$/);
    await expectActive(canvasElement, 'Open file');

    // A query change resets the highlight to the first match even if the old one still matches.
    await userEvent.keyboard('{ArrowDown}');
    await expectActive(canvasElement, 'Save file');
    await userEvent.keyboard('{Backspace}');
    await expectActive(canvasElement, 'Open file');

    // Keywords match too.
    await userEvent.clear(input);
    await userEvent.type(input, 'DISK');
    await waitFor(() => expect(canvas.getAllByRole('option')).toHaveLength(1));
    await expect(status).toHaveTextContent(/^1 result$/);
    await expectActive(canvasElement, 'Save file');

    await userEvent.clear(input);
    await userEvent.type(input, 'zzz');
    await waitFor(() => expect(canvas.queryByRole('listbox')).toBeNull());
    await expect(canvas.queryAllByRole('option')).toHaveLength(0);
    await expect(canvas.getByText('No results')).toBeVisible();
    await expect(status).toHaveTextContent(/^0 results$/);
    await expect(input).toHaveAttribute('aria-expanded', 'false');
    await expect(input).not.toHaveAttribute('aria-activedescendant');

    // Enter with nothing to select keeps the palette open.
    await userEvent.keyboard('{Enter}');
    await expect(canvas.getByRole('dialog', { name: LABEL })).toBeVisible();
    await expect(canvas.getByLabelText('Selections')).toHaveTextContent(/^$/);
  },
};

export const KeyboardWrap: Story = {
  name: 'Navigate across groups',
  parameters: { docs: {
    description: { story: 'Use arrows, Home and End to move the highlight while focus stays in the search input.' },
    source: { language: 'tsx', code: compoundSnippet },
  } },
  render: (args) => <CommandPaletteExample {...args} />,
  play: async ({ canvasElement }) => {
    const { input } = await openPalette(canvasElement);
    await expectActive(canvasElement, 'Open file');
    await userEvent.keyboard('{End}');
    await expectActive(canvasElement, 'Zoom in');
    await userEvent.keyboard('{ArrowDown}');
    await expectActive(canvasElement, 'Open file');
    await userEvent.keyboard('{ArrowUp}');
    await expectActive(canvasElement, 'Zoom in');
    await userEvent.keyboard('{Home}');
    await expectActive(canvasElement, 'Open file');
    // Arrows cross group boundaries.
    await userEvent.keyboard('{ArrowDown}{ArrowDown}');
    await expectActive(canvasElement, 'Toggle theme');

    const modifiedHome = new KeyboardEvent('keydown', { key: 'Home', shiftKey: true, bubbles: true, cancelable: true });
    input.dispatchEvent(modifiedHome);
    await expect(modifiedHome.defaultPrevented).toBe(false);
    await expectActive(canvasElement, 'Toggle theme');
  },
};

export const DisabledAndScrollable: Story = {
  render: (args) => (
    <CommandPalette {...args}>
      <CommandPalette.Trigger>{TRIGGER}</CommandPalette.Trigger>
      <CommandPalette.Content dir="rtl">
        <CommandPalette.Input />
        <CommandPalette.List>
          <CommandPalette.Item value="disabled" aria-disabled="true">
            Unavailable command
          </CommandPalette.Item>
          {Array.from({ length: 24 }, (_, index) => (
            <CommandPalette.Item key={index} value={`command-${index}`}>
              {`Command ${index}: ${'LongCommandDescription'.repeat(8)}`}
            </CommandPalette.Item>
          ))}
        </CommandPalette.List>
      </CommandPalette.Content>
    </CommandPalette>
  ),
  args: { onOpenChange: fn() },
  play: async ({ args, canvasElement }) => {
    const { dialog, input } = await openPalette(canvasElement);
    const disabled = within(dialog).getByRole('option', { name: 'Unavailable command' });
    await expect(disabled).not.toHaveAttribute('data-active');
    await userEvent.click(disabled);
    await expect(args.onOpenChange).toHaveBeenCalledTimes(1);
    await expect(dialog).toHaveAttribute('open');
    await userEvent.keyboard('{End}');
    const last = within(dialog).getAllByRole('option').at(-1)!;
    await waitFor(() => expect(input).toHaveAttribute('aria-activedescendant', last.id));
    const list = within(dialog).getByRole('listbox');
    await waitFor(() => expect(list.scrollTop).toBeGreaterThan(0));
    await expect(list.scrollWidth).toBeLessThanOrEqual(list.clientWidth);
    input.focus();
    await userEvent.keyboard('{Home}');
    await expect(input).toHaveAttribute('aria-activedescendant', within(dialog).getAllByRole('option')[1]!.id);
  },
};

function NativeCloseExample(props: CommandPaletteCompoundProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  return (
    <CommandPalette {...props}>
      <CommandPalette.Trigger>{TRIGGER}</CommandPalette.Trigger>
      <CommandPalette.Content ref={dialogRef}>
        <CommandPalette.Input />
        <CommandPalette.List>
          <CommandPalette.Item value="open-file">Open file</CommandPalette.Item>
        </CommandPalette.List>
        <Button onClick={() => dialogRef.current?.close()}>
          Close natively
        </Button>
      </CommandPalette.Content>
    </CommandPalette>
  );
}
NativeCloseExample.displayName = 'NativeCloseExample';

export const RepairNativeClose: Story = {
  // Excluded from the docs page: its open modal would cover (or iframe-fragment) the docs preview.
  tags: ['!autodocs'],
  args: { open: true, onOpenChange: fn() },
  render: (args) => <NativeCloseExample {...args} />,
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const dialog = await canvas.findByRole('dialog', { name: LABEL });
    await expect(args.onOpenChange).toHaveBeenCalledTimes(0);
    const close = within(dialog).getByRole('button', { name: 'Close natively' });
    await expect(close.getBoundingClientRect().height).toBeGreaterThanOrEqual(32);
    await userEvent.click(close);
    await waitFor(() => expect(dialog).not.toHaveAttribute('open'));
    await waitFor(() => expect(args.onOpenChange).toHaveBeenCalledTimes(1));
    await expect(args.onOpenChange).toHaveBeenLastCalledWith(false);

    await userEvent.click(canvas.getByRole('button', { name: TRIGGER }));
    await waitFor(() => expect(dialog).toHaveAttribute('open'));
    await expectActive(canvasElement, 'Open file');
    await expect(args.onOpenChange).toHaveBeenCalledTimes(1);
    await expect(args.onOpenChange).not.toHaveBeenCalledWith(true);
  },
};

export const GroupLabelledBy: Story = {
  render: (args) => (
    <CommandPalette {...args}>
      <CommandPalette.Trigger>{TRIGGER}</CommandPalette.Trigger>
      <CommandPalette.Content>
        <span id="command-palette-external-label">Project</span>
        <CommandPalette.Input />
        <CommandPalette.List>
          <CommandPalette.Group label="Files" aria-labelledby="command-palette-external-label">
            <CommandPalette.Item value="open-file">Open file</CommandPalette.Item>
          </CommandPalette.Group>
        </CommandPalette.List>
      </CommandPalette.Content>
    </CommandPalette>
  ),
  play: async ({ canvasElement }) => {
    const { dialog } = await openPalette(canvasElement);
    const group = within(dialog).getByRole('group', { name: 'Project Files' });
    const heading = within(group).getByText('Files');
    await expect(group).toHaveAttribute('aria-labelledby', `command-palette-external-label ${heading.id}`);
  },
};

export const Escape: Story = {
  args: { onOpenChange: fn() },
  render: (args) => <CommandPaletteExample {...args} />,
  play: async ({ args, canvasElement }) => {
    const { canvas, trigger } = await openPalette(canvasElement);
    await expect(args.onOpenChange).toHaveBeenCalledTimes(1);
    await expect(args.onOpenChange).toHaveBeenLastCalledWith(true);

    await userEvent.keyboard('{Escape}');
    await expectClosed(canvasElement, trigger);
    await expect(args.onOpenChange).toHaveBeenCalledTimes(2);
    await expect(args.onOpenChange).toHaveBeenLastCalledWith(false);
    await expect(canvas.getByLabelText('Selections')).toHaveTextContent(/^$/);

    // Reopening starts from an empty query.
    await userEvent.click(trigger);
    await canvas.findByRole('dialog', { name: LABEL });
    await expect(getInput(canvasElement)).toHaveValue('');
  },
};

async function playMotion(canvasElement: HTMLElement, onOpenChange: CommandPaletteProps['onOpenChange']) {
  const canvas = within(canvasElement);
  const trigger = canvas.getByRole('button', { name: TRIGGER });
  await userEvent.click(trigger);
  const dialog = await canvas.findByRole('dialog', { name: LABEL });
  const panel = dialog.firstElementChild!;
  await expectEntranceMotion(panel);
  await expect(canvasElement.ownerDocument.activeElement).toBe(getInput(canvasElement));

  await userEvent.keyboard('{Escape}');
  // Accepted close: the palette stays in the top layer while it fades; Escape again is absorbed.
  await expect(onOpenChange).toHaveBeenCalledTimes(2);
  await expect(dialog).toHaveAttribute('data-state', 'closing');
  await expect(dialog).toHaveAttribute('open');
  await userEvent.keyboard('{Escape}');
  await expect(onOpenChange).toHaveBeenCalledTimes(2);

  await expectRetainedExit(panel, () => !dialog.hasAttribute('open'));
  await expectClosed(canvasElement, trigger);
}

export const Motion: Story = {
  tags: ['!autodocs'],
  args: { onOpenChange: fn() },
  render: (args) => <CommandPaletteExample {...args} />,
  play: async ({ args, canvasElement }) => playMotion(canvasElement, args.onOpenChange),
};

export const MotionLight: Story = {
  tags: ['!autodocs'],
  decorators: [withLightTheme],
  args: { onOpenChange: fn() },
  render: (args) => <CommandPaletteExample {...args} />,
  play: async ({ args, canvasElement }) => playMotion(canvasElement, args.onOpenChange),
};

export const RejectedControlled: Story = {
  // Excluded from the docs page: its open modal would cover (or iframe-fragment) the docs preview.
  tags: ['!autodocs'],
  args: { open: true, onOpenChange: fn() },
  render: (args) => <CommandPaletteExample {...args} />,
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const dialog = await canvas.findByRole('dialog', { name: LABEL });
    const input = getInput(canvasElement);
    await waitFor(() => expect(canvasElement.ownerDocument.activeElement).toBe(input));
    await settleMotion(dialog);

    await userEvent.keyboard('{Escape}');
    // The parent never honored the request: exactly one callback, and the palette stays open.
    await expect(args.onOpenChange).toHaveBeenCalledTimes(1);
    await expect(args.onOpenChange).toHaveBeenLastCalledWith(false);
    await expect(dialog).toHaveAttribute('open');
    await expect(canvasElement.ownerDocument.activeElement).toBe(input);
  },
};

export const LightTheme: Story = {
  decorators: [withLightTheme],
  render: (args) => <CommandPaletteExample {...args} />,
  play: async ({ canvasElement }) => {
    const { trigger } = await openPalette(canvasElement);
    await expectActive(canvasElement, 'Open file');
    await userEvent.keyboard('{Escape}');
    await expectClosed(canvasElement, trigger);
  },
};

export const Open: Story = {
  // Excluded from the docs page: its open modal would cover (or iframe-fragment) the docs preview.
  tags: ['!autodocs'],
  args: { defaultOpen: true },
  render: (args) => <CommandPaletteExample {...args} />,
  play: async ({ canvasElement }) => {
    // Persistent open state so the axe gate sees the palette content (entrance settled).
    const canvas = within(canvasElement);
    const dialog = await canvas.findByRole('dialog', { name: LABEL });
    await settleMotion(dialog);
    await expect(dialog).toHaveAttribute('open');
    const listbox = canvas.getByRole('listbox', { name: LABEL });
    await expect(within(listbox).getAllByRole('option')).toHaveLength(4);
    await expectActive(canvasElement, 'Open file');
  },
};
