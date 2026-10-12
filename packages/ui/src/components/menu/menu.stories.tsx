import type { CSSProperties } from 'react';
import { useRef, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within, type Mock } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { withLightTheme } from '../../testing/story-decorators';
import { expectThemedSurface } from '../../testing/theme-assertions';
import { Button } from '../button';
import { Popover } from '../popover';
import { Menu, type MenuProps } from './index';

const TRIGGER = 'Options';

const onEdit = fn();
const onDelete = fn();

const rowStyle = {
  display: 'flex',
  gap: vars.space[3],
} satisfies CSSProperties;

const meta = {
  title: 'Navigation/Menu',
  component: Menu,
  parameters: {
    // Floating UI's focus guards are aria-hidden spans with tabindex=0 that forward focus
    // immediately; axe flags them as aria-hidden-focus (known false positive). Every other
    // aria-hidden element is still checked.
    a11y: {
      config: {
        rules: [{ id: 'aria-hidden-focus', selector: '[aria-hidden="true"]:not([data-floating-ui-focus-guard])' }],
      },
    },
  },
} satisfies Meta<typeof Menu>;

export default meta;

type Story = StoryObj<typeof meta>;

function MenuExample(props: MenuProps) {
  return (
    <div style={rowStyle}>
      <Menu {...props}>
        <Menu.Trigger>{TRIGGER}</Menu.Trigger>
        <Menu.Content>
          <Menu.Item onSelect={onEdit}>Edit</Menu.Item>
          <Menu.Item disabled>Duplicate</Menu.Item>
          <Menu.Separator />
          <Menu.Item onSelect={onDelete}>Delete</Menu.Item>
        </Menu.Content>
      </Menu>
      <Button>After</Button>
    </div>
  );
}
MenuExample.displayName = 'MenuExample';

function ControlledMenu(props: MenuProps) {
  const [open, setOpen] = useState(false);
  return (
    <MenuExample
      {...props}
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        props.onOpenChange?.(next);
      }}
    />
  );
}
ControlledMenu.displayName = 'ControlledMenu';

/** Portaled content lives in the story document's body, outside the canvas. */
function bodyOf(canvasElement: HTMLElement) {
  return within(canvasElement.ownerDocument.body);
}

const callValues = (spy: unknown) => (spy as Mock).mock.calls.map(([value]) => value);

function getTrigger(canvasElement: HTMLElement) {
  return within(canvasElement).getByRole('button', { name: TRIGGER });
}

async function expectFocused(canvasElement: HTMLElement, name: string) {
  await waitFor(() =>
    expect(canvasElement.ownerDocument.activeElement).toBe(bodyOf(canvasElement).getByRole('menuitem', { name })),
  );
}

async function expectClosed(canvasElement: HTMLElement) {
  await waitFor(() => expect(bodyOf(canvasElement).queryByRole('menu')).toBeNull());
  await expect(getTrigger(canvasElement)).toHaveAttribute('aria-expanded', 'false');
}

async function focusTrigger(canvasElement: HTMLElement) {
  const trigger = getTrigger(canvasElement);
  await userEvent.tab();
  await expect(canvasElement.ownerDocument.activeElement).toBe(trigger);
  return trigger;
}

export const Default: Story = {
  render: (args) => <MenuExample {...args} />,
  play: async ({ canvasElement }) => {
    onEdit.mockClear();
    const trigger = getTrigger(canvasElement);
    await expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(trigger).not.toHaveAttribute('aria-controls');

    await userEvent.click(trigger);
    const menu = await bodyOf(canvasElement).findByRole('menu', { name: TRIGGER });
    await expect(canvasElement.contains(menu)).toBe(false);
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await expect(trigger).toHaveAttribute('aria-controls', menu.id);
    await expect(within(menu).getAllByRole('menuitem')).toHaveLength(3);
    await expect(within(menu).getByRole('separator')).toBeVisible();
    // Pointer open focuses the first enabled item.
    await expectFocused(canvasElement, 'Edit');

    await userEvent.click(within(menu).getByRole('menuitem', { name: 'Edit' }));
    await expect(onEdit).toHaveBeenCalledTimes(1);
    await expectClosed(canvasElement);
    await waitFor(() => expect(canvasElement.ownerDocument.activeElement).toBe(trigger));
  },
};

export const Open: Story = {
  args: { defaultOpen: true },
  render: (args) => <MenuExample {...args} />,
  play: async ({ canvasElement }) => {
    // Persistent open state so the axe gate sees the portaled menu.
    const menu = await bodyOf(canvasElement).findByRole('menu', { name: TRIGGER });
    await expect(within(menu).getByRole('menuitem', { name: 'Duplicate' })).toHaveAttribute('aria-disabled', 'true');
  },
};

export const Controlled: Story = {
  args: { onOpenChange: fn() },
  render: (args) => <ControlledMenu {...args} />,
  play: async ({ args, canvasElement }) => {
    const trigger = getTrigger(canvasElement);
    await userEvent.click(trigger);
    await bodyOf(canvasElement).findByRole('menu');
    await expect(args.onOpenChange).toHaveBeenCalledTimes(1);
    await expect(args.onOpenChange).toHaveBeenLastCalledWith(true);

    await userEvent.click(bodyOf(canvasElement).getByRole('menuitem', { name: 'Delete' }));
    await expectClosed(canvasElement);
    await expect(args.onOpenChange).toHaveBeenCalledTimes(2);
    await expect(args.onOpenChange).toHaveBeenLastCalledWith(false);

    await waitFor(() => expect(canvasElement.ownerDocument.activeElement).toBe(trigger));
    await userEvent.keyboard('{ArrowDown}');
    await expectFocused(canvasElement, 'Edit');
    await expect(args.onOpenChange).toHaveBeenCalledTimes(3);
    await expect(args.onOpenChange).toHaveBeenLastCalledWith(true);

    await userEvent.keyboard('{Escape}');
    await expectClosed(canvasElement);
    await expect(args.onOpenChange).toHaveBeenCalledTimes(4);
    await expect(args.onOpenChange).toHaveBeenLastCalledWith(false);
  },
};

export const Keyboard: Story = {
  render: (args) => <MenuExample {...args} />,
  play: async ({ canvasElement }) => {
    const { ownerDocument } = canvasElement;
    const trigger = await focusTrigger(canvasElement);

    // Enter, Space and ArrowDown each open on the first enabled item.
    for (const key of ['{Enter}', ' ', '{ArrowDown}']) {
      await userEvent.keyboard(key);
      await expectFocused(canvasElement, 'Edit');
      await userEvent.keyboard('{Escape}');
      await expectClosed(canvasElement);
      await waitFor(() => expect(ownerDocument.activeElement).toBe(trigger));
    }

    await userEvent.keyboard('{Enter}');
    await expectFocused(canvasElement, 'Edit');
    const edit = bodyOf(canvasElement).getByRole('menuitem', { name: 'Edit' });
    await expect(getComputedStyle(edit).outlineWidth).not.toBe('0px');

    // The disabled item stays in the menu but arrows skip it.
    const duplicate = bodyOf(canvasElement).getByRole('menuitem', { name: 'Duplicate' });
    await expect(duplicate).toBeVisible();
    await expect(duplicate).toHaveAttribute('aria-disabled', 'true');
    await userEvent.keyboard('{ArrowDown}');
    await expectFocused(canvasElement, 'Delete');

    // Arrows wrap in both directions.
    await userEvent.keyboard('{ArrowDown}');
    await expectFocused(canvasElement, 'Edit');
    await userEvent.keyboard('{ArrowUp}');
    await expectFocused(canvasElement, 'Delete');

    // The active highlight follows the roving focus.
    const deleteItem = bodyOf(canvasElement).getByRole('menuitem', { name: 'Delete' });
    expect(deleteItem.getAttribute('data-active')).not.toBeNull();
    expect(edit.getAttribute('data-active')).toBeNull();

    // Enter activates once, closes and returns focus to the trigger.
    onDelete.mockClear();
    await userEvent.keyboard('{Enter}');
    await expect(onDelete).toHaveBeenCalledTimes(1);
    await expectClosed(canvasElement);
    await waitFor(() => expect(ownerDocument.activeElement).toBe(trigger));

    // Space activates too (ArrowUp reopens on the last enabled item).
    onDelete.mockClear();
    await userEvent.keyboard('{ArrowUp}');
    await expectFocused(canvasElement, 'Delete');
    await userEvent.keyboard(' ');
    await expect(onDelete).toHaveBeenCalledTimes(1);
    await expectClosed(canvasElement);
    await waitFor(() => expect(ownerDocument.activeElement).toBe(trigger));
  },
};

export const ArrowUpOpensLast: Story = {
  render: (args) => <MenuExample {...args} />,
  play: async ({ canvasElement }) => {
    await focusTrigger(canvasElement);
    await userEvent.keyboard('{ArrowUp}');
    await bodyOf(canvasElement).findByRole('menu');
    await expectFocused(canvasElement, 'Delete');
  },
};

export const Typeahead: Story = {
  render: (args) => (
    <Menu {...args}>
      <Menu.Trigger>Settings</Menu.Trigger>
      <Menu.Content>
        <Menu.Item>Account</Menu.Item>
        <Menu.Item disabled>Backup</Menu.Item>
        <Menu.Item>Billing</Menu.Item>
        <Menu.Item>Security</Menu.Item>
      </Menu.Content>
    </Menu>
  ),
  play: async ({ canvasElement }) => {
    await userEvent.tab();
    await userEvent.keyboard('{Enter}');
    await expectFocused(canvasElement, 'Account');

    // Typeahead skips the disabled "Backup" and lands on "Billing".
    await userEvent.keyboard('b');
    await expectFocused(canvasElement, 'Billing');

    // After the 500ms reset a new buffer starts ("s", not "bs").
    await new Promise((resolve) => setTimeout(resolve, 600));
    await userEvent.keyboard('s');
    await expectFocused(canvasElement, 'Security');
  },
};

export const EscapeReturnsFocus: Story = {
  render: (args) => <MenuExample {...args} />,
  play: async ({ canvasElement }) => {
    const trigger = await focusTrigger(canvasElement);
    await userEvent.keyboard('{Enter}');
    await expectFocused(canvasElement, 'Edit');
    await userEvent.keyboard('{ArrowDown}');
    await expectFocused(canvasElement, 'Delete');

    await userEvent.keyboard('{Escape}');
    await expectClosed(canvasElement);
    await waitFor(() => expect(canvasElement.ownerDocument.activeElement).toBe(trigger));
  },
};

export const TabMovesOn: Story = {
  render: (args) => <MenuExample {...args} />,
  play: async ({ canvasElement }) => {
    const trigger = await focusTrigger(canvasElement);
    await userEvent.keyboard('{Enter}');
    await expectFocused(canvasElement, 'Edit');

    // Shift+Tab from the first item returns focus to the trigger; the menu stays open while
    // focus is on the reference, and Tab re-enters the menu at the first item.
    await userEvent.tab({ shift: true });
    await waitFor(() => expect(canvasElement.ownerDocument.activeElement).toBe(trigger));
    await expect(bodyOf(canvasElement).getByRole('menu')).toBeVisible();
    await userEvent.tab();
    await expectFocused(canvasElement, 'Edit');

    // Forward from the last item closes the menu and moves on to the next page control.
    await userEvent.keyboard('{ArrowUp}');
    await expectFocused(canvasElement, 'Delete');
    await userEvent.tab();
    await expectClosed(canvasElement);
    await waitFor(() =>
      expect(canvasElement.ownerDocument.activeElement).toBe(
        within(canvasElement).getByRole('button', { name: 'After' }),
      ),
    );
  },
};

export const OutsidePress: Story = {
  render: (args) => <MenuExample {...args} />,
  play: async ({ canvasElement }) => {
    const { ownerDocument } = canvasElement;
    await userEvent.click(getTrigger(canvasElement));
    await bodyOf(canvasElement).findByRole('menu');

    // Record every focus change: an outside press must not transiently focus the trigger.
    const seen: Element[] = [];
    const record = () => {
      if (ownerDocument.activeElement) seen.push(ownerDocument.activeElement);
    };
    ownerDocument.addEventListener('focusin', record);

    const after = within(canvasElement).getByRole('button', { name: 'After' });
    await userEvent.click(after);
    ownerDocument.removeEventListener('focusin', record);

    await expectClosed(canvasElement);
    await expect(ownerDocument.activeElement).toBe(after);
    await expect(seen).not.toContain(getTrigger(canvasElement));
  },
};

export const SelectPreventDefault: Story = {
  render: (args) => (
    <Menu {...args}>
      <Menu.Trigger>{TRIGGER}</Menu.Trigger>
      <Menu.Content>
        <Menu.Item onSelect={onEdit} onClick={(event) => event.preventDefault()}>
          Edit
        </Menu.Item>
        <Menu.Item>Delete</Menu.Item>
      </Menu.Content>
    </Menu>
  ),
  play: async ({ canvasElement }) => {
    onEdit.mockClear();
    await userEvent.click(getTrigger(canvasElement));
    await userEvent.click(await bodyOf(canvasElement).findByRole('menuitem', { name: 'Edit' }));
    // onSelect still runs; the consumer's preventDefault keeps the menu open.
    await expect(onEdit).toHaveBeenCalledTimes(1);
    await expect(bodyOf(canvasElement).getByRole('menu')).toBeVisible();
  },
};

function RenameExample(props: MenuProps) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <div style={rowStyle}>
      <Menu {...props}>
        <Menu.Trigger>{TRIGGER}</Menu.Trigger>
        <Menu.Content>
          <Menu.Item
            onSelect={() => {
              onEdit();
              input.current?.focus();
            }}
          >
            Rename
          </Menu.Item>
        </Menu.Content>
      </Menu>
      <input ref={input} aria-label="Name" />
    </div>
  );
}

export const SelectMovesFocus: Story = {
  render: (args) => <RenameExample {...args} />,
  play: async ({ canvasElement }) => {
    onEdit.mockClear();
    const input = within(canvasElement).getByRole('textbox', { name: 'Name' });
    await focusTrigger(canvasElement);
    await userEvent.keyboard('{Enter}');
    await expectFocused(canvasElement, 'Rename');
    await userEvent.keyboard('{Enter}');
    await expect(onEdit).toHaveBeenCalledTimes(1);
    await expectClosed(canvasElement);
    // The accepted close does not pull focus back from where the command sent it.
    await expect(canvasElement.ownerDocument.activeElement).toBe(input);
  },
};

export const LightThemeOpen: Story = {
  decorators: [withLightTheme],
  args: { defaultOpen: true },
  render: (args) => <MenuExample {...args} />,
  play: async ({ canvasElement }) => {
    const menu = await bodyOf(canvasElement).findByRole('menu', { name: TRIGGER });
    await expect(menu).toBeVisible();
    await expect(canvasElement.contains(menu)).toBe(false);
    await expectThemedSurface(menu, 'light');
  },
};

export const LightTheme: Story = {
  decorators: [withLightTheme],
  render: (args) => <MenuExample {...args} />,
  play: async ({ canvasElement }) => {
    await userEvent.click(getTrigger(canvasElement));
    const menu = await bodyOf(canvasElement).findByRole('menu');
    await expect(menu).toBeVisible();
    await expectThemedSurface(menu, 'light');
    await userEvent.keyboard('{Escape}');
    await expectClosed(canvasElement);
  },
};

export const TriggerRole: Story = {
  render: (args) => <MenuExample {...args} />,
  play: async ({ canvasElement, userEvent }) => {
    const trigger = getTrigger(canvasElement);
    // A native button: no explicit role overrides it, open or closed.
    await expect(trigger).not.toHaveAttribute('role');
    await userEvent.click(trigger);
    await bodyOf(canvasElement).findByRole('menu', { name: TRIGGER });
    await expect(trigger).not.toHaveAttribute('role');
    await expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
  },
};

const popoverOpenChange = fn<(open: boolean) => void>();

function PopoverHost(props: MenuProps) {
  return (
    <div style={rowStyle}>
      <Popover defaultOpen onOpenChange={popoverOpenChange}>
        <Popover.Trigger>Project</Popover.Trigger>
        <Popover.Content aria-label="Project">
          <MenuExample {...props} />
        </Popover.Content>
      </Popover>
      <Button>Outside</Button>
    </div>
  );
}
PopoverHost.displayName = 'PopoverHost';

/** The menu sits in an open popover's content; it is not inside any menu. */
async function findHostedMenuTrigger(canvasElement: HTMLElement) {
  popoverOpenChange.mockClear();
  const popover = await bodyOf(canvasElement).findByRole('dialog', { name: 'Project' });
  return { popover, trigger: within(popover).getByRole('button', { name: TRIGGER }) };
}

async function expectHostedMenuClosed(canvasElement: HTMLElement, trigger: HTMLElement) {
  await waitFor(() => expect(bodyOf(canvasElement).queryByRole('menu')).toBeNull());
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
}

export const InsidePopover: Story = {
  args: { onOpenChange: fn() },
  render: (args) => <PopoverHost {...args} />,
  play: async ({ args, canvasElement, userEvent }) => {
    onEdit.mockClear();
    const { popover, trigger } = await findHostedMenuTrigger(canvasElement);
    await expect(trigger).not.toHaveAttribute('role');
    await expect(within(popover).queryByRole('menuitem')).toBeNull();
    await expect(trigger).toHaveAttribute('aria-haspopup', 'menu');

    // Pointer open focuses the first item; selecting closes the menu only.
    await userEvent.click(trigger);
    const menu = await bodyOf(canvasElement).findByRole('menu', { name: TRIGGER });
    await expect(trigger).not.toHaveAttribute('role');
    await expect(trigger).toHaveAttribute('aria-controls', menu.id);
    await expectFocused(canvasElement, 'Edit');
    await userEvent.click(within(menu).getByRole('menuitem', { name: 'Edit' }));
    await expect(onEdit).toHaveBeenCalledTimes(1);
    await expectHostedMenuClosed(canvasElement, trigger);
    await waitFor(() => expect(canvasElement.ownerDocument.activeElement).toBe(trigger));

    // Keyboard open, arrows, then Escape: the menu closes and focus returns to its trigger.
    await userEvent.keyboard('{Enter}');
    await expectFocused(canvasElement, 'Edit');
    await userEvent.keyboard('{ArrowDown}');
    await expectFocused(canvasElement, 'Delete');
    await userEvent.keyboard('{Escape}');
    await expectHostedMenuClosed(canvasElement, trigger);
    await waitFor(() => expect(canvasElement.ownerDocument.activeElement).toBe(trigger));
    await expect(callValues(args.onOpenChange)).toEqual([true, false, true, false]);
    await expect(popoverOpenChange).not.toHaveBeenCalled();
    await expect(popover).toBeVisible();

    // Tab from the last item closes the menu and moves on inside the popover.
    await userEvent.keyboard('{Enter}');
    await expectFocused(canvasElement, 'Edit');
    await userEvent.keyboard('{ArrowUp}');
    await expectFocused(canvasElement, 'Delete');
    await userEvent.tab();
    await expectHostedMenuClosed(canvasElement, trigger);
    await waitFor(() =>
      expect(canvasElement.ownerDocument.activeElement).toBe(within(popover).getByRole('button', { name: 'After' })),
    );
    await expect(callValues(args.onOpenChange)).toEqual([true, false, true, false, true, false]);
    await expect(popoverOpenChange).not.toHaveBeenCalled();

    // A press outside both surfaces closes the menu, its topmost child layer, only.
    await userEvent.click(trigger);
    await expectFocused(canvasElement, 'Edit');
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Outside' }));
    await expectHostedMenuClosed(canvasElement, trigger);
    await expect(popoverOpenChange).not.toHaveBeenCalled();
    await expect(popover).toBeVisible();
    await expect(callValues(args.onOpenChange)).toEqual([true, false, true, false, true, false, true, false]);

    // With the menu closed, Escape reaches the popover.
    within(popover).getByRole('button', { name: 'After' }).focus();
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(bodyOf(canvasElement).queryByRole('dialog')).toBeNull());
    await expect(callValues(popoverOpenChange)).toEqual([false]);
  },
};
