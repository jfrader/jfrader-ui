import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fireEvent, fn, userEvent, waitFor, within } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { css } from '../../styling/css';
import { withLightTheme } from '../../testing/story-decorators';
import { Button } from '../button';
import { Dialog, type DialogProps } from './index';

const TITLE = 'Edit profile';
const DESCRIPTION = 'Update your display name and avatar.';
const DELETE_LABEL = 'Delete account';
const composedTriggerClick = fn();
const composedTriggerRef = fn<(element: HTMLButtonElement | null) => void>();

const bodyStyle = css({
  margin: 0,
  fontSize: vars.textSize.sm,
});

const footerStyle = css({
  display: 'flex',
  justifyContent: 'flex-end',
  marginBlockStart: vars.space[5],
});

const meta = {
  title: 'Surfaces/Dialog',
  component: Dialog,
} satisfies Meta<typeof Dialog>;

export default meta;

type Story = StoryObj<typeof meta>;

function DialogExample(props: DialogProps) {
  return (
    <Dialog {...props}>
      <Dialog.Trigger>Open profile</Dialog.Trigger>
      <Dialog.Content>
        <Dialog.Title>{TITLE}</Dialog.Title>
        <Dialog.Description>{DESCRIPTION}</Dialog.Description>
        <p css={bodyStyle}>Your display name appears on comments and mentions.</p>
        <div css={footerStyle}>
          <Dialog.Close>Close</Dialog.Close>
        </div>
      </Dialog.Content>
    </Dialog>
  );
}

function FormDialog(props: DialogProps) {
  return (
    <Dialog {...props}>
      <Dialog.Trigger>Open form</Dialog.Trigger>
      <Dialog.Content>
        <Dialog.Title>Sign out</Dialog.Title>
        <form method="dialog">
          <button type="submit">Confirm</button>
        </form>
      </Dialog.Content>
    </Dialog>
  );
}

function ComposedDialog(props: DialogProps) {
  return (
    <Dialog {...props}>
      <Dialog.Trigger
        ref={composedTriggerRef}
        onClick={composedTriggerClick}
        render={(triggerProps) => (
          <Button {...triggerProps} tone="danger" render={(buttonProps) => <button {...buttonProps} />}>
            {DELETE_LABEL}
          </Button>
        )}
      />
      <Dialog.Content>
        <Dialog.Title>{DELETE_LABEL}</Dialog.Title>
        <Dialog.Description>Your profile and saved drafts are removed.</Dialog.Description>
        <div css={footerStyle}>
          <Dialog.Close
            render={(closeProps) => (
              <Button {...closeProps} variant="outline" render={(buttonProps) => <button {...buttonProps} />}>
                Cancel
              </Button>
            )}
          />
        </div>
      </Dialog.Content>
    </Dialog>
  );
}

function ControlledDialog(props: DialogProps) {
  const [open, setOpen] = useState(false);
  return (
    <DialogExample
      {...props}
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        props.onOpenChange?.(next);
      }}
    />
  );
}

async function openDialog(canvasElement: HTMLElement) {
  const canvas = within(canvasElement);
  const trigger = canvas.getByRole('button', { name: 'Open profile' });
  await userEvent.click(trigger);
  const dialog = await canvas.findByRole('dialog');
  return { canvas, trigger, dialog };
}

/** Synthetic key events never trigger the browser's native dialog cancel; dispatch the same
 * cancel event that a real Escape keypress produces (the single dismissal authority). */
function requestEscape(dialog: HTMLElement) {
  fireEvent(dialog, new Event('cancel', { cancelable: true }));
}

async function expectClosed(canvasElement: HTMLElement, trigger: HTMLElement) {
  await waitFor(() => expect(within(canvasElement).queryByRole('dialog')).toBeNull());
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await expect(trigger).toHaveFocus();
}

export const Default: Story = {
  render: (args) => <DialogExample {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole('dialog')).toBeNull();
    const closedDialog = canvasElement.querySelector('dialog');
    await expect(closedDialog).not.toHaveAttribute('open');

    const { trigger, dialog } = await openDialog(canvasElement);
    await expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute('open');
    await expect(dialog).toHaveAttribute('aria-modal', 'true');
    const title = canvas.getByRole('heading', { name: TITLE });
    await expect(dialog).toHaveAttribute('aria-labelledby', title.id);
    await expect(dialog).toHaveAccessibleName(TITLE);
    await expect(dialog).toHaveAccessibleDescription(DESCRIPTION);
    await expect(dialog.contains(canvasElement.ownerDocument.activeElement)).toBe(true);

    requestEscape(dialog);
    await expectClosed(canvasElement, trigger);
  },
};

export const Open: Story = {
  args: { defaultOpen: true },
  render: (args) => <DialogExample {...args} />,
  play: async ({ canvasElement }) => {
    // Persistent open state so the axe gate actually sees the modal content.
    const dialog = within(canvasElement).getByRole('dialog');
    await expect(dialog).toHaveAttribute('open');
    await expect(dialog).toHaveAccessibleName(TITLE);
  },
};

export const Controlled: Story = {
  args: { onOpenChange: fn() },
  render: (args) => <ControlledDialog {...args} />,
  play: async ({ args, canvasElement }) => {
    const { canvas, trigger, dialog } = await openDialog(canvasElement);
    await expect(args.onOpenChange).toHaveBeenCalledTimes(1);
    await expect(args.onOpenChange).toHaveBeenLastCalledWith(true);

    requestEscape(dialog);
    await expectClosed(canvasElement, trigger);
    await expect(args.onOpenChange).toHaveBeenCalledTimes(2);
    await expect(args.onOpenChange).toHaveBeenLastCalledWith(false);

    await userEvent.click(trigger);
    await userEvent.click(await canvas.findByRole('button', { name: 'Close' }));
    await expectClosed(canvasElement, trigger);
    await expect(args.onOpenChange).toHaveBeenCalledTimes(4);
    await expect(args.onOpenChange).toHaveBeenLastCalledWith(false);
  },
};

export const ControlledRejectedDismissal: Story = {
  args: { onOpenChange: fn() },
  render: (args) => <DialogExample {...args} open />,
  play: async ({ args, canvasElement }) => {
    const { dialog } = await openDialog(canvasElement);
    requestEscape(dialog);
    // The parent never honored the request: exactly one callback, and the dialog stays open
    // because cancel prevented the browser's own closure.
    await expect(args.onOpenChange).toHaveBeenCalledTimes(1);
    await expect(args.onOpenChange).toHaveBeenLastCalledWith(false);
    await expect(dialog).toHaveAttribute('open');
  },
};

export const BackdropClick: Story = {
  render: (args) => <DialogExample {...args} />,
  play: async ({ canvasElement }) => {
    const { canvas, trigger, dialog } = await openDialog(canvasElement);
    fireEvent.click(canvas.getByRole('heading', { name: TITLE }));
    await expect(dialog).toHaveAttribute('open');
    await expect(canvas.getByRole('dialog')).toBeVisible();

    fireEvent.click(dialog);
    await expectClosed(canvasElement, trigger);
  },
};

export const NativeClose: Story = {
  args: { onOpenChange: fn() },
  render: (args) => <FormDialog {...args} />,
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    // A <form method="dialog"> closes the native dialog without our click paths; the
    // close event must reconcile into a state request, not leave stale open state.
    await userEvent.click(canvas.getByRole('button', { name: 'Open form' }));
    await canvas.findByRole('dialog');
    await userEvent.click(canvas.getByRole('button', { name: 'Confirm' }));
    await waitFor(() => expect(canvas.queryByRole('dialog')).toBeNull());
    // Two legitimate requests: open(true) from the trigger, then false from the form close.
    // The close-event reconciliation is a React state update — wait for it, not just the DOM.
    await waitFor(() => expect(args.onOpenChange).toHaveBeenCalledTimes(2));
    await expect(args.onOpenChange).toHaveBeenLastCalledWith(false);
  },
};

export const ControlledRejectedNativeClose: Story = {
  args: { onOpenChange: fn() },
  render: (args) => <FormDialog {...args} open />,
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const { documentElement } = canvasElement.ownerDocument;
    // Native form closure cannot be prevented: the parent rejects the request, scroll must
    // still be released with the native state, and the next open request repairs natively.
    await userEvent.click(canvas.getByRole('button', { name: 'Open form' }));
    await canvas.findByRole('dialog');
    await userEvent.click(canvas.getByRole('button', { name: 'Confirm' }));
    await waitFor(() => expect(canvas.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(args.onOpenChange).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(documentElement.style.overflow).toBe(''));

    await userEvent.click(canvas.getByRole('button', { name: 'Open form' }));
    await canvas.findByRole('dialog');
    await expect(args.onOpenChange).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(documentElement.style.overflow).toBe('hidden'));
  },
};

export const CancelVeto: Story = {
  render: (args) => (
    <Dialog {...args}>
      <Dialog.Trigger>Open profile</Dialog.Trigger>
      <Dialog.Content onCancel={(event) => event.preventDefault()}>
        <Dialog.Title>{TITLE}</Dialog.Title>
        <Dialog.Close>Close</Dialog.Close>
      </Dialog.Content>
    </Dialog>
  ),
  play: async ({ canvasElement }) => {
    const { dialog } = await openDialog(canvasElement);
    requestEscape(dialog);
    await expect(dialog).toHaveAttribute('open');
  },
};

export const ScrollLock: Story = {
  render: (args) => <DialogExample {...args} />,
  play: async ({ canvasElement }) => {
    const { documentElement, body } = canvasElement.ownerDocument;
    await expect(documentElement.style.overflow).toBe('');

    const { trigger, dialog } = await openDialog(canvasElement);
    await waitFor(() => expect(documentElement.style.overflow).toBe('hidden'));
    await expect(body.style.overflow).toBe('hidden');

    requestEscape(dialog);
    await expectClosed(canvasElement, trigger);
    await expect(documentElement.style.overflow).toBe('');
    await expect(body.style.overflow).toBe('');
  },
};

export const TriggerAsButton: Story = {
  render: (args) => <ComposedDialog {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button', { name: DELETE_LABEL });
    // One element carries both the Button styles and the trigger behavior: no wrapper.
    await expect(trigger).toHaveAttribute('data-ui', 'dialog-trigger button');
    await expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(canvas.getAllByRole('button')).toHaveLength(1);
    await expect(composedTriggerRef).toHaveBeenLastCalledWith(trigger);
    await expect(composedTriggerRef.mock.calls.at(-1)?.[0]).toBeInstanceOf(HTMLButtonElement);

    composedTriggerClick.mockClear();
    canvasElement.tabIndex = -1;
    canvasElement.focus();
    await userEvent.tab();
    canvasElement.removeAttribute('tabindex');
    await expect(trigger).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    const dialog = await canvas.findByRole('dialog');
    await expect(composedTriggerClick).toHaveBeenCalledTimes(1);
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await expect(dialog).toHaveAccessibleName(DELETE_LABEL);
    await expect(dialog.contains(canvasElement.ownerDocument.activeElement)).toBe(true);

    const close = within(dialog).getByRole('button', { name: 'Cancel' });
    await expect(close).toHaveAttribute('data-ui', 'dialog-close button');
    await expect(close).toHaveAttribute('type', 'button');
    await userEvent.click(close);
    await expectClosed(canvasElement, trigger);
  },
};

export const TriggerAsButtonOpen: Story = {
  args: { defaultOpen: true },
  render: (args) => <ComposedDialog {...args} />,
  play: async ({ canvasElement }) => {
    // Persistent open state so the axe gate sees the composed Close button.
    const dialog = await within(canvasElement).findByRole('dialog');
    await expect(dialog).toHaveAttribute('open');
    await expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveAttribute(
      'data-ui',
      'dialog-close button',
    );
  },
};

export const LightTheme: Story = {
  decorators: [withLightTheme],
  render: (args) => <DialogExample {...args} />,
  play: async ({ canvasElement }) => {
    const { canvas, trigger, dialog } = await openDialog(canvasElement);
    await expect(dialog).toHaveAccessibleName(TITLE);
    await userEvent.click(canvas.getByRole('button', { name: 'Close' }));
    await expectClosed(canvasElement, trigger);
  },
};
