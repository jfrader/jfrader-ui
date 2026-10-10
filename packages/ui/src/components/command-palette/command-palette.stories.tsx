import { useRef, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { withLightTheme } from '../../testing/story-decorators';
import { CommandPalette, type CommandPaletteProps } from './index';

const LABEL = 'Command palette';
const TRIGGER = 'Open commands';

const meta = {
  title: 'Surfaces/CommandPalette',
  component: CommandPalette,
} satisfies Meta<typeof CommandPalette>;

export default meta;

type Story = StoryObj<typeof meta>;

function CommandPaletteExample(props: CommandPaletteProps) {
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

export const Default: Story = {
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

function NativeCloseExample(props: CommandPaletteProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  return (
    <CommandPalette {...props}>
      <CommandPalette.Trigger>{TRIGGER}</CommandPalette.Trigger>
      <CommandPalette.Content ref={dialogRef}>
        <CommandPalette.Input />
        <CommandPalette.List>
          <CommandPalette.Item value="open-file">Open file</CommandPalette.Item>
        </CommandPalette.List>
        <button type="button" onClick={() => dialogRef.current?.close()}>
          Close natively
        </button>
      </CommandPalette.Content>
    </CommandPalette>
  );
}

export const RepairNativeClose: Story = {
  args: { open: true, onOpenChange: fn() },
  render: (args) => <NativeCloseExample {...args} />,
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const dialog = await canvas.findByRole('dialog', { name: LABEL });
    await expect(args.onOpenChange).toHaveBeenCalledTimes(0);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Close natively' }));
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

export const RejectedControlled: Story = {
  args: { open: true, onOpenChange: fn() },
  render: (args) => <CommandPaletteExample {...args} />,
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const dialog = await canvas.findByRole('dialog', { name: LABEL });
    const input = getInput(canvasElement);
    await waitFor(() => expect(canvasElement.ownerDocument.activeElement).toBe(input));

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
  args: { defaultOpen: true },
  render: (args) => <CommandPaletteExample {...args} />,
  play: async ({ canvasElement }) => {
    // Persistent open state so the axe gate sees the palette content.
    const canvas = within(canvasElement);
    const dialog = await canvas.findByRole('dialog', { name: LABEL });
    await expect(dialog).toHaveAttribute('open');
    const listbox = canvas.getByRole('listbox', { name: LABEL });
    await expect(within(listbox).getAllByRole('option')).toHaveLength(4);
    await expectActive(canvasElement, 'Open file');
  },
};
