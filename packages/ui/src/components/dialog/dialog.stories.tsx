// `styled` is the app-facing styling API; consumers import it from `@jfrader/ui`.
import { styled } from '../../index';
import type { ComponentPropsWithRef, CSSProperties, ReactNode, SyntheticEvent } from 'react';
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fireEvent, fn, spyOn, userEvent, waitFor, within } from 'storybook/test';
import { renderToString } from 'react-dom/server';
import { vars } from '@jfrader/tokens/vars';
import { expectEntranceMotion, expectRetainedExit, settleMotion } from '../../testing/motion-assertions';
import { withLightTheme } from '../../testing/story-decorators';
import { expectThemedSurface } from '../../testing/theme-assertions';
import { Button } from '../button';
import { TextField } from '../text-field';
import { TextShimmer } from '../text-shimmer';
import { ThemeRoot } from '../theme-root';
import { Surface, type SurfacePartProps } from '../surface';
import { Card } from '../card';
import { css } from '../../styling/css';
import { motionDurationMs } from '../../styling/motion-timings';
import { OverlayPortal } from '../../overlay/overlay-portal';
import { useNativeDialog, useNativeDialogRoot } from '../../overlay/use-native-dialog';
import { Dialog, type DialogPanelProps, type DialogCompoundProps, type DialogEasyProps, type DialogScroll } from './index';

const TITLE = 'Edit profile';
const DESCRIPTION = 'Update your display name and avatar.';
const DELETE_LABEL = 'Delete account';
const composedTriggerClick = fn();
const composedTriggerRef = fn<(element: HTMLButtonElement | null) => void>();

function setNativeAutoFocus(input: HTMLInputElement | null) {
  input?.setAttribute('autofocus', '');
}

function ClosingParentFixture() {
  const [open, setOpen] = useState(true);
  const controller = useNativeDialogRoot(open, setOpen);
  const shell = useNativeDialog({ ...controller, open }, {}, undefined, undefined, {
    enter: () => {},
    exit: () => new Promise(() => {}),
  });
  return <dialog {...shell} aria-label="Closing parent">
    <button onClick={() => setOpen(false)}>Close parent</button>
    <dialog aria-label="Nested native dialog"><button>Nested action</button></dialog>
  </dialog>;
}

export const ClosingParentCancellation: Story = {
  tags: ['!autodocs'],
  render: () => <ClosingParentFixture />,
  play: async ({ canvasElement, userEvent }) => {
    const parent = canvasElement.querySelector<HTMLDialogElement>('dialog')!;
    const nested = parent.querySelector<HTMLDialogElement>('dialog')!;
    await waitFor(() => expect(parent).toHaveAttribute('open'));
    await userEvent.click(within(parent).getByRole('button', { name: 'Close parent' }));
    await waitFor(() => expect(parent).toHaveAttribute('data-state', 'closing'));
    const cancel = new Event('cancel', { cancelable: true });
    fireEvent(nested, cancel);
    await expect(cancel.defaultPrevented).toBe(false);
    fireEvent(nested, new Event('close'));
    await expect(parent).toHaveAttribute('open');
    await expect(parent).toHaveAttribute('data-state', 'closing');
    parent.close();
  },
};

const Body = styled.p({
  margin: 0,
  fontSize: vars.textSize.sm,
});

const Footer = styled.div({
  display: 'flex',
  justifyContent: 'flex-end',
  marginBlockStart: vars.space[5],
});

const meta = {
  title: 'Surfaces/Dialog',
  component: Dialog,
  parameters: { docs: {
    description: { component: 'Open a dialog to show content or ask for a decision.' },
    sections: [
      { title: 'Basic', stories: ['Default', 'Compound'] },
      { title: 'Composition', stories: ['SlotProps', 'CustomRoot', 'TriggerAsButton'] },
      { title: 'Behavior', stories: ['Controlled', 'CancelVeto', 'BackdropClick', 'NestedDialog', 'NativeClose'] },
      { title: 'Content', stories: ['ScrollModes', 'LongContent', 'NarrowLayout'] },
      { title: 'Appearance', stories: ['ContrastPanel'] },
    ],
    usage: `### When to use
Use a dialog for a task or decision that needs attention before returning to the page. Keep non-blocking information in the page instead.

### Keyboard and accessibility
Tab and Shift+Tab stay inside the open dialog; the rest of the page is inert. Escape, the close button, and a backdrop click request closure. An onCancel handler can prevent all three; provide another way to finish the task if you veto closure. Native form submission with \`method="dialog"\` cannot be vetoed this way.

Give every dialog an accessible name. For structured or long content, set withDescription={false} so assistive technology can read the content in order rather than as one description.

### Scrolling
The default scroll="paper" keeps Dialog.Body scrollable while sibling headings and Dialog.Footer stay in place. Easy mode generates these regions. With scroll="body", the whole panel scrolls inside the overlay viewport, not the document body; the page behind remains locked. Use an autoFocus heading with tabIndex={-1} to start long structured content at its beginning.

Accepted closure restores focus after exit motion. Reduced motion makes entry and exit instant.`,
  } },
} satisfies Meta<typeof Dialog>;

export default meta;

type Story = StoryObj<(props: DialogCompoundProps) => ReactNode>;
type EasyStory = StoryObj<(props: DialogEasyProps) => ReactNode>;
// @ts-expect-error Generated-part slot keys are closed.
type UnknownSlot = NonNullable<DialogEasyProps['slotProps']>['unknown'];
// @ts-expect-error Replacement keys are closed.
type UnknownReplacement = NonNullable<DialogEasyProps['slots']>['unknown'];

function UnusedDialogRoot() { return null; }

function ReplacementShell(props: ComponentPropsWithRef<'dialog'>) {
  return <dialog {...props} data-testid="replacement-shell"
    data-has-cancel={typeof props.onCancel === 'function'}
    data-has-close={typeof props.onClose === 'function'} />;
}

function ReplacementPanel(props: SurfacePartProps) {
  return <div {...props} data-testid="replacement-panel" />;
}

export const ShellAndPanelSlots: EasyStory = {
  tags: ['!autodocs'],
  args: {
    triggerLabel: 'Open profile', title: TITLE, description: DESCRIPTION,
    content: <TextField label="Display name" />, closeLabel: 'Close',
    slots: { content: ReplacementShell, panel: ReplacementPanel },
    onOpenChange: fn(),
    slotProps: {
      content: {
        className: 'replacement-shell-class',
        ref: (node) => { if (node) node.dataset.shellRef = node.tagName; },
        onCancel: fn(), onClose: fn(),
      },
      panel: { className: 'replacement-panel-class' },
      root: { ref: (node) => { if (node) node.dataset.panelRef = node.tagName; } },
    },
  },
  render: (args) => <Dialog {...args} />,
  play: async ({ canvas, canvasElement, args, userEvent }) => {
    const trigger = canvas.getByRole('button', { name: 'Open profile' });
    await userEvent.click(trigger);
    const shell = await canvas.findByRole('dialog', { name: TITLE });
    const panel = within(shell).getByTestId('replacement-panel');
    await settleMotion(shell);
    await expect(shell.scrollWidth).toBeLessThanOrEqual(shell.clientWidth);
    await expect(shell).toBe(canvas.getByTestId('replacement-shell'));
    await expect(shell).toHaveAttribute('data-ui', 'dialog');
    await expect(shell).toHaveClass('replacement-shell-class');
    await expect(shell.className).toMatch(/css-/);
    await expect(shell).toHaveAttribute('data-shell-ref', 'DIALOG');
    await expect(shell).toHaveAttribute('data-has-cancel', 'true');
    await expect(shell).toHaveAttribute('data-has-close', 'true');
    await expect(shell).toHaveAttribute('data-state', 'open');
    await expect(shell).toHaveAttribute('aria-modal', 'true');
    await expect(shell).toHaveAccessibleDescription(DESCRIPTION);
    await expect(canvasElement.querySelectorAll('dialog')).toHaveLength(1);
    await expect(panel).toHaveAttribute('data-ui', 'dialog-panel');
    await expect(panel).toHaveClass('replacement-panel-class');
    await expect(panel.className).toMatch(/css-/);
    await expect(panel).toHaveAttribute('data-panel-ref', 'DIV');
    await expect(shell.querySelectorAll('[data-ui~="dialog-panel"]')).toHaveLength(1);
    await expect(shell.firstElementChild).toBe(panel);
    requestEscape(shell);
    await expectClosed(canvasElement, trigger);
    await expect(args.slotProps?.content?.onCancel).toHaveBeenCalledTimes(1);
    await expect(args.slotProps?.content?.onClose).toHaveBeenCalledTimes(1);
    await userEvent.click(trigger);
    (shell as HTMLDialogElement).close();
    await expectClosed(canvasElement, trigger);
    await expect(args.onOpenChange).toHaveBeenLastCalledWith(false);
  },
};

/** Restyle the generated header and replace the panel's material root. */
export const SlotProps: EasyStory = {
  name: 'Part props',
  parameters: { docs: {
    description: { story: 'Set header, title, close button, and panel props in easy mode.' },
    source: { language: 'tsx', code: `import { Dialog, Surface, TextField } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

<Dialog
  triggerLabel="Open profile"
  title="Edit profile"
  description="Update your display name and avatar."
  content={<TextField label="Display name" defaultValue="Maya" />}
  closeLabel="Close"
  slots={{ root: Surface }}
  slotProps={{
    root: { className: 'custom-dialog-panel', sx: { borderRadius: vars.radius.sm } },
    header: { className: 'custom-dialog-header', sx: { fontStyle: 'italic' } },
    title: { className: 'custom-dialog-title' },
    close: { sx: { marginBlockStart: vars.space[4] } },
  }}
/>` },
  } },
  args: {
    triggerLabel: 'Open profile', title: TITLE, description: DESCRIPTION,
    content: <TextField label="Display name" defaultValue="Maya" />, closeLabel: 'Close',
    slots: { root: Surface },
    component: UnusedDialogRoot,
    slotProps: {
      root: { className: 'custom-dialog-panel', sx: { borderRadius: vars.radius.sm } },
      header: { className: 'custom-dialog-header', sx: { fontStyle: 'italic' } },
      title: { className: 'custom-dialog-title' },
      close: { sx: { marginBlockStart: vars.space[4] } },
    },
  },
  render: (args) => <Dialog {...args} />,
  play: async ({ canvasElement, userEvent }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Open profile' }));
    const dialog = await canvas.findByRole('dialog', { name: TITLE });
    const heading = within(dialog).getByRole('heading', { name: TITLE });
    await expect(heading).toHaveClass('custom-dialog-title');
    await expect(heading.parentElement).toHaveClass('custom-dialog-header');
    await expect(heading.parentElement).toHaveStyle({ fontStyle: 'italic' });
    await expect(dialog.querySelector('.custom-dialog-panel')).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(dialog).not.toHaveAttribute('open'));
  },
};

export const Default: EasyStory = {
  name: 'Profile editor',
  args: {
    triggerLabel: 'Open profile',
    title: TITLE,
    description: DESCRIPTION,
    content: (
      <>
        <TextField label="Display name" defaultValue="Maya" autoFocus ref={setNativeAutoFocus} />
        <TextField label="Email" type="email" defaultValue="maya@example.com" />
      </>
    ),
    closeLabel: 'Close',
    onOpenChange: fn(),
    slotProps: {
      content: { className: 'easy-dialog-shell' },
      title: { className: 'easy-dialog-title' },
      close: { style: { marginBlockStart: vars.space[4] } },
    },
  },
  parameters: { docs: {
    description: { story: 'Open a profile editor with generated title, description, and close button.' },
    source: { language: 'tsx', code: `import { Dialog, TextField } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

function setNativeAutoFocus(input: HTMLInputElement | null) {
  input?.setAttribute('autofocus', '');
}

<Dialog
  triggerLabel="Open profile"
  title="Edit profile"
  description="Update your display name and avatar."
  content={
    <>
      <TextField label="Display name" defaultValue="Maya" autoFocus ref={setNativeAutoFocus} />
      <TextField label="Email" type="email" defaultValue="maya@example.com" />
    </>
  }
  closeLabel="Close"
  slotProps={{
    content: { className: 'easy-dialog-shell' },
    title: { className: 'easy-dialog-title' },
    close: { style: { marginBlockStart: vars.space[4] } },
  }}
/>` } } },
  render: (args) => <Dialog {...args} />,
  play: async ({ canvasElement, canvas, args, userEvent }) => {
    const trigger = canvas.getByRole('button', { name: 'Open profile' });
    await userEvent.tab();
    await expect(trigger).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    const dialog = await canvas.findByRole('dialog', { name: TITLE });
    await expect(dialog).toHaveClass('easy-dialog-shell');
    await expect(dialog.querySelectorAll('[data-ui~="dialog-panel"]')).toHaveLength(1);
    const title = canvas.getByRole('heading', { name: TITLE });
    await expect(title).toHaveClass('easy-dialog-title');
    await expect(dialog).toHaveAttribute('aria-labelledby', title.id);
    await expect(dialog).toHaveAccessibleDescription(DESCRIPTION);
    await expect(dialog).toHaveAttribute('aria-describedby', dialog.querySelector('[data-ui="dialog-description"]')!.id);
    await expect(canvas.getByRole('textbox', { name: 'Display name' })).toHaveFocus();
    await userEvent.tab();
    await expect(canvas.getByRole('textbox', { name: 'Email' })).toHaveFocus();
    await userEvent.tab();
    const close = canvas.getByRole('button', { name: 'Close' });
    await expect(close).toHaveFocus();
    await expect(getComputedStyle(close).outlineStyle).not.toBe('none');
    await userEvent.tab({ shift: true });
    await expect(canvas.getByRole('textbox', { name: 'Email' })).toHaveFocus();
    await userEvent.click(close);
    await expectClosed(canvasElement, trigger);
    await userEvent.click(trigger);
    requestEscape(dialog);
    await expectClosed(canvasElement, trigger);
    await userEvent.click(trigger);
    fireEvent.click(dialog);
    await expectClosed(canvasElement, trigger);
    await userEvent.click(trigger);
    (dialog as HTMLDialogElement).close();
    await expectClosed(canvasElement, trigger);
    await expect(args.onOpenChange).toHaveBeenCalledTimes(8);
    await expect(args.onOpenChange).toHaveBeenLastCalledWith(false);
  },
};

export const EasyModeNativeForm: EasyStory = {
  ...Default,
  name: 'Easy mode native form',
  args: { ...Default.args, content: <form method="dialog"><button type="submit">Save profile</button></form> },
  play: async ({ canvasElement, canvas, args, userEvent }) => {
    const { trigger } = await openDialog(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Save profile' }));
    await expectClosed(canvasElement, trigger);
    await expect(args.onOpenChange).toHaveBeenCalledTimes(2);
    await expect(args.onOpenChange).toHaveBeenLastCalledWith(false);
  },
};
export const EasyModeOpen: EasyStory = {
  ...Default,
  name: 'Easy mode open',
  tags: ['!autodocs'],
  args: { ...Default.args, defaultOpen: true },
  play: async ({ canvas }) => { await settleMotion(canvas.getByRole('dialog')); },
};
export const EasyModeLight: EasyStory = { ...Default, name: 'Easy mode light', decorators: [withLightTheme], globals: { theme: 'light' } };

export const EasyModeVetoedClose: EasyStory = {
  ...Default,
  name: 'Easy mode vetoed close',
  args: { ...Default.args, slotProps: { content: { onCancel: (event) => event.preventDefault() } } },
  play: async ({ canvasElement, canvas, args, userEvent }) => {
    const { trigger, dialog } = await openDialog(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Close' }));
    requestEscape(dialog);
    fireEvent.click(dialog);
    await expect(dialog).toHaveAttribute('open');
    await expect(args.onOpenChange).toHaveBeenCalledTimes(1);
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    (dialog as HTMLDialogElement).close();
    await expectClosed(canvasElement, trigger);
  },
};
export const EasyModeWithoutDescription: EasyStory = {
  ...EasyModeOpen,
  name: 'Easy mode without description',
  args: { ...EasyModeOpen.args, description: undefined, content: 0 },
  play: async ({ canvas }) => {
    const dialog = canvas.getByRole('dialog', { name: TITLE });
    await expect(dialog).not.toHaveAttribute('aria-describedby');
    await expect(dialog).toHaveTextContent('0');
  },
};

function easyModeTypeContracts() {
  // @ts-expect-error Presentation mode rejects compound children.
  <Dialog triggerLabel="Open" title="Profile" content="Profile" closeLabel="Close">Compound</Dialog>;
  // @ts-expect-error Presentation mode requires a title and close label.
  <Dialog triggerLabel="Open" content="Profile" />;
  // @ts-expect-error Named presentation props cannot leak into compound mode.
  <Dialog description="Profile"><Dialog.Content /></Dialog>;
}
void easyModeTypeContracts;

const AdapterMaterial = styled.div({ boxSizing: 'border-box', backgroundColor: vars.color.surfaceRaised, color: vars.color.text, border: `1px dashed ${vars.color.border}`, boxShadow: 'none' });
// Shell and panel override stories exercise the documented slot css and sx APIs.
const shellStyleOverride = css({ outlineOffset: vars.space[3] });
const panelSizeOverride = css({ inlineSize: '240px' });
function DialogPaper({ className, ...props }: SurfacePartProps) {
  return <AdapterMaterial {...props} className={className} />;
}

function rootAdapterStory(component: DialogPanelProps['component']): Story {
  return {
    tags: ['!autodocs'],
    render: (args) => <Dialog {...args} defaultOpen>
      <Dialog.Trigger>Open adapter</Dialog.Trigger>
      <Dialog.Content sx={shellStyleOverride}
        ref={(node) => { if (node) node.dataset.shellRef = node.tagName; }}
        onCancel={(event) => { event.currentTarget.dataset.cancelReceived = 'true'; }}>
        <Dialog.Panel component={component} slotProps={{ root: {
          className: 'panel-slot',
          ref: (node) => { if (node) node.dataset.rootRef = node.tagName; },
        } }}>
          <Dialog.Title>Adapter export</Dialog.Title>
          <TextField label="Export draft" defaultValue="Keep me" />
          <Dialog.Close>Close adapter</Dialog.Close>
        </Dialog.Panel>
      </Dialog.Content>
    </Dialog>,
    play: async ({ canvas, canvasElement, userEvent }) => {
      const shell = canvasElement.querySelector('dialog')!;
      const panel = shell.querySelector<HTMLElement>('[data-ui~="dialog-panel"]')!;
      await expect(shell).toHaveAttribute('data-shell-ref', 'DIALOG');
      await expect(panel).toHaveAttribute('data-root-ref', 'DIV');
      await expect(panel).toHaveClass('panel-slot');
      await expect(shell.querySelectorAll('[data-ui~="dialog-panel"]')).toHaveLength(1);
      await expect(getComputedStyle(shell).outlineOffset).not.toBe(getComputedStyle(panel).outlineOffset);
      const input = canvas.getByRole('textbox', { name: 'Export draft' });
      await expect(input.getBoundingClientRect().height).toBeGreaterThanOrEqual(32);
      await userEvent.type(input, ' edited');
      fireEvent(shell, new Event('cancel', { cancelable: true }));
      await waitFor(() => expect(shell).not.toHaveAttribute('open'));
      await expect(shell).toHaveAttribute('data-cancel-received', 'true');
      await userEvent.click(canvas.getByRole('button', { name: 'Open adapter' }));
      await waitFor(() => expect(shell).toHaveAttribute('open'));
      await expect(canvas.getByRole('textbox', { name: 'Export draft' })).toBe(input);
      await expect(input).toHaveValue('Keep me edited');
      if (component === DialogPaper) await expect(getComputedStyle(panel).borderTopStyle).toBe('dashed');
    },
  };
}

export const SurfaceAdapter = rootAdapterStory(Surface);
export const CardAdapter = rootAdapterStory(Card);
export const IndependentMaterialAdapter = rootAdapterStory(DialogPaper);
export const SurfaceAdapterLight: Story = { ...SurfaceAdapter, decorators: [withLightTheme], globals: { theme: 'light' } };

export const PanelComposition: Story = {
  tags: ['!autodocs'],
  parameters: { docs: { source: { language: 'tsx', code: `import { Dialog } from '@jfrader/ui';

<Dialog>
  <Dialog.Trigger>Open profile</Dialog.Trigger>
  <Dialog.Content>
    <Dialog.Title>Edit profile</Dialog.Title>
    <Dialog.Description>
      Update your display name and avatar.
    </Dialog.Description>
    <p>Your display name appears on comments and mentions.</p>
    <Dialog.Close>Close</Dialog.Close>
  </Dialog.Content>
</Dialog>` } } },
  render: (args) => <DialogExample {...args} />,
  play: async ({ canvasElement }) => {
    const shell = canvasElement.querySelector('dialog')!;
    await expect(shell.querySelectorAll('[data-ui~="dialog-panel"]')).toHaveLength(1);
    await expect(() => renderToString(<Dialog.Panel />)).toThrow('Dialog.Panel must be rendered inside <Dialog.Content>.');
    const warning = spyOn(console, 'warn').mockImplementation(() => {});
    try {
      renderToString(<Dialog><Dialog.Content><Dialog.Panel>One</Dialog.Panel><Dialog.Panel>Two</Dialog.Panel></Dialog.Content></Dialog>);
      await expect(warning).toHaveBeenCalledWith(expect.stringContaining('one direct Dialog.Panel child'));
    } finally { warning.mockRestore(); }
  },
};

function ContrastPanelFixture({ theme = 'light', ...props }: DialogCompoundProps & { theme?: 'dark' | 'light' }) {
  const [panel, setPanel] = useState<HTMLDivElement | null>(null);
  return <ThemeRoot theme={theme} portalContainer={panel}>
    <Dialog {...props} defaultOpen>
      <Dialog.Content><><Dialog.Panel appearance="contrast" ref={setPanel}>
        <Dialog.Title>Export profile</Dialog.Title>
        <Surface appearance="default" data-testid="dialog-inherited">Profile details</Surface>
        <OverlayPortal><Surface data-testid="dialog-contrast-portal">Export details</Surface></OverlayPortal>
        <Dialog.Close>Close export</Dialog.Close>
      </Dialog.Panel></></Dialog.Content>
    </Dialog>
  </ThemeRoot>;
}

export const DialogContrastPanel: Story = {
  globals: { theme: 'light' },
  tags: ['!autodocs'],
  render: (args) => <ContrastPanelFixture {...args} />,
  play: async ({ canvasElement }) => {
    const shell = canvasElement.querySelector('dialog')!;
    const panels = shell.querySelectorAll('[data-ui~="dialog-panel"]');
    await expect(panels).toHaveLength(1);
    const panel = panels[0]!;
    await expect(panel).toHaveAttribute('data-appearance', 'contrast');
    const portal = await within(panel as HTMLElement).findByTestId('dialog-contrast-portal');
    await expect(portal.closest('[data-ui="theme-boundary"]')).toHaveAttribute('data-appearance', 'contrast');
    await expect(getComputedStyle(portal).backgroundColor).toBe(getComputedStyle(panel).backgroundColor);
  },
};
export const DialogContrastPanelDark: Story = {
  ...DialogContrastPanel,
  globals: { theme: 'dark' },
  render: (args) => <ContrastPanelFixture {...args} theme="dark" />,
};

function DialogExample(props: DialogCompoundProps) {
  return (
    <Dialog {...props}>
      <Dialog.Trigger>Open profile</Dialog.Trigger>
      <Dialog.Content>
        <Dialog.Title>{TITLE}</Dialog.Title>
        <Dialog.Description>{DESCRIPTION}</Dialog.Description>
        <Body>Your display name appears on comments and mentions.</Body>
        <Footer>
          <Dialog.Close>Close</Dialog.Close>
        </Footer>
      </Dialog.Content>
    </Dialog>
  );
}
DialogExample.displayName = 'DialogExample';

function FormDialog(props: DialogCompoundProps) {
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
FormDialog.displayName = 'FormDialog';

function ComposedDialog(props: DialogCompoundProps) {
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
        <Footer>
          <Dialog.Close
            render={(closeProps) => (
              <Button {...closeProps} variant="outline" render={(buttonProps) => <button {...buttonProps} />}>
                Cancel
              </Button>
            )}
          />
        </Footer>
      </Dialog.Content>
    </Dialog>
  );
}
ComposedDialog.displayName = 'ComposedDialog';

function ControlledDialog(props: DialogCompoundProps) {
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
ControlledDialog.displayName = 'ControlledDialog';

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
  await waitFor(() => {
    expect(within(canvasElement).queryByRole('dialog')).toBeNull();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).toHaveFocus();
  });
}

export const Compound: Story = {
  name: 'Compound anatomy',
  parameters: { docs: {
    description: { story: 'Arrange the trigger, title, description, body, and close button with compound parts.' },
    source: { language: 'tsx', code: `import { Dialog, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const Body = styled.p({ margin: 0, fontSize: vars.textSize.sm });
const Footer = styled.div({
  display: 'flex',
  justifyContent: 'flex-end',
  marginBlockStart: vars.space[5],
});

<Dialog>
  <Dialog.Trigger>Open profile</Dialog.Trigger>
  <Dialog.Content>
    <Dialog.Title>Edit profile</Dialog.Title>
    <Dialog.Description>Update your display name and avatar.</Dialog.Description>
    <Body>Your display name appears on comments and mentions.</Body>
    <Footer><Dialog.Close>Close</Dialog.Close></Footer>
  </Dialog.Content>
</Dialog>` },
  } },
  render: (args) => <DialogExample {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole('dialog')).toBeNull();
    const closedDialog = canvasElement.querySelector('dialog');
    await expect(closedDialog).not.toHaveAttribute('open');

    const { trigger, dialog } = await openDialog(canvasElement);
    await expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await waitFor(() => expect(dialog).toBeVisible());
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
  // Excluded from the docs page: its open modal would cover (or iframe-fragment) the docs preview.
  tags: ['!autodocs'],
  args: { defaultOpen: true },
  render: (args) => <DialogExample {...args} />,
  play: async ({ canvasElement }) => {
    // Persistent open state so the axe gate actually sees the modal content (entrance settled).
    const dialog = within(canvasElement).getByRole('dialog');
    await settleMotion(dialog);
    await expect(dialog).toHaveAttribute('open');
    await expect(dialog).toHaveAccessibleName(TITLE);
  },
};

export const ShortContent: Story = {
  tags: ['!autodocs'],
  args: { defaultOpen: true },
  render: (args) => (
    <Dialog {...args}>
      <Dialog.Content>
        <Dialog.Title>Saved</Dialog.Title>
        <Dialog.Description>Profile updated.</Dialog.Description>
        <Dialog.Close>Done</Dialog.Close>
      </Dialog.Content>
    </Dialog>
  ),
  play: async ({ canvasElement }) => {
    const dialog = within(canvasElement).getByRole('dialog');
    await settleMotion(dialog);
    const panel = dialog.querySelector('[data-ui~="dialog-panel"]')!;
    const viewportWidth = canvasElement.ownerDocument.defaultView!.innerWidth;
    const panelRect = panel.getBoundingClientRect();
    await expect(panelRect.width).toBeGreaterThanOrEqual(Math.min(320, viewportWidth - 32));
    await expect(panelRect.width).toBe(dialog.getBoundingClientRect().width);
    await expect(panelRect.left).toBeGreaterThanOrEqual(16);
    await expect(panelRect.right).toBeLessThanOrEqual(viewportWidth - 16);
    await expect(dialog.scrollWidth).toBeLessThanOrEqual(dialog.clientWidth);
  },
};

export const ShortContentLight: Story = {
  ...ShortContent,
  decorators: [withLightTheme],
  globals: { theme: 'light' },
};

export const ShortContentRTL: Story = {
  ...ShortContent,
  decorators: [(Story) => <div dir="rtl"><Story /></div>],
};

export const ShortContentNarrow: Story = {
  ...ShortContent,
  parameters: {
    viewport: { options: { narrow: { name: 'Narrow', styles: { width: '320px', height: '700px' } } } },
  },
  globals: { viewport: { value: 'narrow' } },
};

export const SizingOverrides: Story = {
  tags: ['!autodocs'],
  args: { defaultOpen: true },
  render: (args) => (
    <Dialog {...args}>
      <Dialog.Content sx={{ inlineSize: '280px', minInlineSize: 0 }}>
        <Dialog.Panel slotProps={{ root: { sx: panelSizeOverride } }} sx={{ inlineSize: '260px' }}>
          <Dialog.Title>Saved</Dialog.Title>
          <Dialog.Description>Profile updated.</Dialog.Description>
          <Dialog.Close>Done</Dialog.Close>
        </Dialog.Panel>
      </Dialog.Content>
    </Dialog>
  ),
  play: async ({ canvasElement }) => {
    const dialog = within(canvasElement).getByRole('dialog');
    await settleMotion(dialog);
    const panel = dialog.querySelector('[data-ui~="dialog-panel"]')!;
    await expect(dialog.getBoundingClientRect().width).toBe(280);
    await expect(panel.getBoundingClientRect().width).toBe(260);
  },
};

async function playMotion(canvasElement: HTMLElement, onOpenChange: DialogCompoundProps['onOpenChange']) {
  const { canvas, trigger, dialog } = await openDialog(canvasElement);
  const animated = dialog.dataset.scroll === 'body' ? dialog.querySelector<HTMLElement>('[data-ui~="dialog-panel"]')! : dialog;
  await expectEntranceMotion(animated);
  await expect(dialog).toHaveAttribute('data-state', 'open');

  await userEvent.click(canvas.getByRole('button', { name: 'Close' }));
  // Accepted close: still in the top layer while the exit runs; requests during it are absorbed.
  await expect(onOpenChange).toHaveBeenCalledTimes(2);
  await expect(dialog).toHaveAttribute('open');
  await expect(dialog).toHaveAttribute('data-state', 'closing');
  requestEscape(dialog);
  await expect(onOpenChange).toHaveBeenCalledTimes(2);

  await expectRetainedExit(animated, () => !dialog.hasAttribute('open'));
  await expect(dialog).toHaveAttribute('data-state', 'closed');
  await expectClosed(canvasElement, trigger);
  await expect(onOpenChange).toHaveBeenCalledTimes(2);
}

export const Motion: Story = {
  tags: ['!autodocs'],
  args: { onOpenChange: fn() },
  render: (args) => <DialogExample {...args} />,
  play: async ({ args, canvasElement }) => playMotion(canvasElement, args.onOpenChange),
};

export const MotionLight: Story = {
  tags: ['!autodocs'],
  decorators: [withLightTheme],
  args: { onOpenChange: fn() },
  render: (args) => <DialogExample {...args} />,
  play: async ({ args, canvasElement }) => playMotion(canvasElement, args.onOpenChange),
};

export const BodyMotion: Story = {
  ...Motion,
  args: { scroll: 'body', onOpenChange: fn() },
};

export const BodyProfileEditor: EasyStory = {
  ...Default,
  tags: ['!autodocs'],
  args: { ...Default.args, scroll: 'body' },
  play: async ({ canvas, canvasElement, userEvent }) => {
    const { dialog, trigger } = await openDialog(canvasElement);
    await expect(canvas.getByRole('textbox', { name: 'Display name' })).toHaveFocus();
    await userEvent.tab();
    await expect(canvas.getByRole('textbox', { name: 'Email' })).toHaveFocus();
    await userEvent.tab();
    const close = canvas.getByRole('button', { name: 'Close' });
    await expect(close).toHaveFocus();
    await settleMotion(dialog);
    const panel = dialog.querySelector('[data-ui~="dialog-panel"]')!.getBoundingClientRect();
    const viewportHeight = canvasElement.ownerDocument.defaultView!.innerHeight;
    await expect(Math.abs((panel.top + panel.bottom) / 2 - viewportHeight / 2)).toBeLessThanOrEqual(1);
    await expect(dialog.scrollHeight).toBe(dialog.clientHeight);
    await userEvent.click(close);
    await expectClosed(canvasElement, trigger);
  },
};

export const NarrowContent: Story = {
  tags: ['!autodocs'],
  render: (args) => (
    <Dialog {...args} defaultOpen>
      <Dialog.Trigger>Open profile</Dialog.Trigger>
      <Dialog.Content sx={{ inlineSize: '280px', minInlineSize: 0 }}>
        <Dialog.Title>{TITLE}</Dialog.Title>
        <Dialog.Description>{DESCRIPTION}</Dialog.Description>
        <Dialog.Close>Close</Dialog.Close>
      </Dialog.Content>
    </Dialog>
  ),
  play: async ({ canvasElement }) => {
    const dialog = within(canvasElement).getByRole('dialog');
    await settleMotion(dialog);
    await expect(dialog.getBoundingClientRect().width).toBe(280);
    await expect(dialog.scrollWidth).toBeLessThanOrEqual(dialog.clientWidth);
    await expect(dialog.firstElementChild!.getBoundingClientRect().width).toBeLessThanOrEqual(dialog.clientWidth);
    const close = within(dialog).getByRole('button', { name: 'Close' });
    await expect(close.getBoundingClientRect().height).toBeGreaterThanOrEqual(32);
  },
};

export const Controlled: Story = {
  name: 'Controlled open state',
  parameters: { docs: {
    description: { story: 'Keep open state in the parent with open and onOpenChange.' },
    source: { language: 'tsx', code: `import { useState } from 'react';
import { Dialog, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const Body = styled.p({ margin: 0, fontSize: vars.textSize.sm });
const Footer = styled.div({
  display: 'flex',
  justifyContent: 'flex-end',
  marginBlockStart: vars.space[5],
});

function ProfileDialog() {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Dialog.Trigger>Open profile</Dialog.Trigger>
      <Dialog.Content>
        <Dialog.Title>Edit profile</Dialog.Title>
        <Dialog.Description>Update your display name and avatar.</Dialog.Description>
        <Body>Your display name appears on comments and mentions.</Body>
        <Footer><Dialog.Close>Close</Dialog.Close></Footer>
      </Dialog.Content>
    </Dialog>
  );
}` },
  } },
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
  // Excluded from the docs page: its open modal would cover (or iframe-fragment) the docs preview.
  tags: ['!autodocs'],
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
  name: 'Backdrop dismissal',
  parameters: { docs: {
    description: { story: 'Click outside the panel to close; clicks inside the panel leave it open.' },
    source: { language: 'tsx', code: `import { Dialog, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const Body = styled.p({ margin: 0, fontSize: vars.textSize.sm });
const Footer = styled.div({
  display: 'flex',
  justifyContent: 'flex-end',
  marginBlockStart: vars.space[5],
});

<Dialog>
  <Dialog.Trigger>Open profile</Dialog.Trigger>
  <Dialog.Content>
    <Dialog.Title>Edit profile</Dialog.Title>
    <Dialog.Description>Update your display name and avatar.</Dialog.Description>
    <Body>Your display name appears on comments and mentions.</Body>
    <Footer><Dialog.Close>Close</Dialog.Close></Footer>
  </Dialog.Content>
</Dialog>` },
  } },
  render: (args) => <DialogExample {...args} />,
  play: async ({ canvasElement }) => {
    const { canvas, trigger, dialog } = await openDialog(canvasElement);
    fireEvent.click(canvas.getByRole('heading', { name: TITLE }));
    await expect(dialog).toHaveAttribute('open');
    await waitFor(() => expect(canvas.getByRole('dialog')).toBeVisible());

    fireEvent.click(dialog);
    await expectClosed(canvasElement, trigger);
  },
};

export const NativeClose: Story = {
  name: 'Native form submission',
  parameters: { docs: {
    description: { story: 'Submit a method="dialog" form to close the native dialog.' },
    source: { language: 'tsx', code: `import { Dialog } from '@jfrader/ui';

<Dialog>
  <Dialog.Trigger>Open form</Dialog.Trigger>
  <Dialog.Content>
    <Dialog.Title>Sign out</Dialog.Title>
    <form method="dialog">
      <button type="submit">Confirm</button>
    </form>
  </Dialog.Content>
</Dialog>` },
  } },
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
  // Excluded from the docs page: its open modal would cover (or iframe-fragment) the docs preview.
  tags: ['!autodocs'],
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
  name: 'Veto close requests',
  parameters: { docs: {
    description: { story: 'Veto Escape, backdrop, and close-button requests; submit Done to close.' },
    source: { language: 'tsx', code: `import { Dialog } from '@jfrader/ui';

<Dialog>
  <Dialog.Trigger>Open profile</Dialog.Trigger>
  <Dialog.Content onCancel={(event) => event.preventDefault()}>
    <Dialog.Title>Edit profile</Dialog.Title>
    <Dialog.Close>Close</Dialog.Close>
    <form method="dialog"><button type="submit">Done</button></form>
  </Dialog.Content>
</Dialog>` },
  } },
  render: (args) => (
    <Dialog {...args}>
      <Dialog.Trigger>Open profile</Dialog.Trigger>
      <Dialog.Content onCancel={(event) => event.preventDefault()}>
        <Dialog.Title>{TITLE}</Dialog.Title>
        <Dialog.Close>Close</Dialog.Close>
        <form method="dialog"><button type="submit">Done</button></form>
      </Dialog.Content>
    </Dialog>
  ),
  play: async ({ canvasElement }) => {
    const { canvas, trigger, dialog } = await openDialog(canvasElement);
    requestEscape(dialog);
    await expect(dialog).toHaveAttribute('open');
    fireEvent.click(dialog);
    await userEvent.click(canvas.getByRole('button', { name: 'Close' }));
    await expect(dialog).toHaveAttribute('open');
    await userEvent.click(canvas.getByRole('button', { name: 'Done' }));
    await expectClosed(canvasElement, trigger);
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
  name: 'Button trigger and close',
  parameters: { docs: {
    description: { story: 'Render the trigger and close control as Button components.' },
    source: { language: 'tsx', code: `import { Button, Dialog, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const Footer = styled.div({
  display: 'flex',
  justifyContent: 'flex-end',
  marginBlockStart: vars.space[5],
});

<Dialog>
  <Dialog.Trigger render={(props) => (
    <Button {...props} tone="danger">Delete account</Button>
  )} />
  <Dialog.Content>
    <Dialog.Title>Delete account</Dialog.Title>
    <Dialog.Description>Your profile and saved drafts are removed.</Dialog.Description>
    <Footer>
      <Dialog.Close render={(props) => (
        <Button {...props} variant="outline">Cancel</Button>
      )} />
    </Footer>
  </Dialog.Content>
</Dialog>` },
  } },
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
  // Excluded from the docs page: its open modal would cover (or iframe-fragment) the docs preview.
  tags: ['!autodocs'],
  args: { defaultOpen: true },
  render: (args) => <ComposedDialog {...args} />,
  play: async ({ canvasElement }) => {
    // Persistent open state so the axe gate sees the composed Close button.
    const dialog = await within(canvasElement).findByRole('dialog');
    await settleMotion(dialog);
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
    // Not portaled: the native <dialog> stays in the ThemeRoot's DOM (only rendered in the top
    // layer), so it inherits the scoped theme without a ThemeBoundary.
    await expect(canvasElement.contains(dialog)).toBe(true);
    await expectThemedSurface(dialog.firstElementChild as HTMLElement, 'light');
    await userEvent.click(canvas.getByRole('button', { name: 'Close' }));
    await expectClosed(canvasElement, trigger);
  },
};

const outerCancel = fn<(event: SyntheticEvent<HTMLDialogElement>) => void>();
const outerClose = fn<(event: SyntheticEvent<HTMLDialogElement>) => void>();

export const NestedDialog: Story = {
  name: 'Nested dialogs',
  parameters: { docs: {
    description: { story: 'Open a second dialog and return focus to its trigger when it closes.' },
    source: { language: 'tsx', code: `import { Dialog } from '@jfrader/ui';

<Dialog>
  <Dialog.Trigger>Open profile</Dialog.Trigger>
  <Dialog.Content>
    <Dialog.Title>Edit profile</Dialog.Title>
    <Dialog>
      <Dialog.Trigger>Discard changes</Dialog.Trigger>
      <Dialog.Content>
        <Dialog.Title>Discard changes?</Dialog.Title>
        <form method="dialog">
          <button type="submit">Keep editing</button>
        </form>
      </Dialog.Content>
    </Dialog>
  </Dialog.Content>
</Dialog>` },
  } },
  args: { onOpenChange: fn() },
  render: (args) => (
    <Dialog {...args}>
      <Dialog.Trigger>Open profile</Dialog.Trigger>
      <Dialog.Content onCancel={outerCancel} onClose={outerClose}>
        <Dialog.Title>{TITLE}</Dialog.Title>
        <Dialog>
          <Dialog.Trigger>Discard changes</Dialog.Trigger>
          <Dialog.Content>
            <Dialog.Title>Discard changes?</Dialog.Title>
            <form method="dialog">
              <button type="submit">Keep editing</button>
            </form>
          </Dialog.Content>
        </Dialog>
      </Dialog.Content>
    </Dialog>
  ),
  play: async ({ args, canvasElement, userEvent }) => {
    outerCancel.mockClear();
    outerClose.mockClear();
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Open profile' }));
    const outer = await canvas.findByRole('dialog', { name: TITLE });
    const nestedTrigger = within(outer).getByRole('button', { name: 'Discard changes' });

    // React bubbles the nested cancel/close here; the outer dialog forwards them to its consumer
    // handlers and otherwise ignores them.
    await userEvent.click(nestedTrigger);
    const nested = await within(outer).findByRole('dialog', { name: 'Discard changes?' });
    const cancel = new Event('cancel', { cancelable: true });
    fireEvent(nested, cancel);
    await waitFor(() => expect(nested).not.toHaveAttribute('open'));
    await expect(outerCancel).toHaveBeenCalledTimes(1);
    await expect(outerCancel.mock.calls[0]![0].target).toBe(nested);
    await waitFor(() => expect(outerClose).toHaveBeenCalledTimes(1));
    await expect(outer).toHaveAttribute('open');
    await expect(args.onOpenChange).toHaveBeenCalledTimes(1);
    await expect(nestedTrigger).toHaveFocus();

    // A native form close inside the nested dialog does not reconcile the outer one either.
    await userEvent.click(nestedTrigger);
    await within(outer).findByRole('dialog', { name: 'Discard changes?' });
    await userEvent.click(within(nested).getByRole('button', { name: 'Keep editing' }));
    await waitFor(() => expect(nested).not.toHaveAttribute('open'));
    await waitFor(() => expect(outerClose).toHaveBeenCalledTimes(2));
    await expect(outer).toHaveAttribute('open');
    await expect(args.onOpenChange).toHaveBeenCalledTimes(1);
    await expect(args.onOpenChange).toHaveBeenLastCalledWith(true);
    await expect(canvasElement.ownerDocument.documentElement.style.overflow).toBe('hidden');

    // The outer dialog's own Escape still closes it.
    fireEvent(outer, new Event('cancel', { cancelable: true }));
    await waitFor(() => expect(outer).not.toHaveAttribute('open'));
    await expect(args.onOpenChange).toHaveBeenCalledTimes(2);
    await expect(args.onOpenChange).toHaveBeenLastCalledWith(false);
  },
};

export const BodyNestedDialog: Story = {
  ...NestedDialog,
  tags: ['!autodocs'],
  args: { scroll: 'body', onOpenChange: fn() },
};

export const BodyVetoedClose: EasyStory = {
  ...EasyModeVetoedClose,
  tags: ['!autodocs'],
  args: { ...EasyModeVetoedClose.args, scroll: 'body' },
};


/**
 * Regression: `exitMotionFinished` must not wait for a paused child animation. A paused
 * TextShimmer's finite animation never resolves, so this dialog used to stay open forever.
 */
export const ClosingWithPausedChild: Story = {
  tags: ['!autodocs'],
  render: () => (
    <Dialog
      triggerLabel="Open audit dialog"
      title="Audit dialog"
      closeLabel="Close"
      content={
        <div>
          <p>Body</p>
          <TextShimmer paused>Generating summary</TextShimmer>
        </div>
      }
    />
  ),
  play: async ({ canvasElement, userEvent }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Open audit dialog' }));
    const dialog = await waitFor(() => {
      const element = canvasElement.querySelector<HTMLDialogElement>('dialog[open]');
      if (!element) throw new Error('dialog did not open');
      return element;
    });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(dialog).not.toHaveAttribute('open'), { timeout: 700 });
  },
};

export const CustomRoot: Story = {
  name: 'Custom panel root',
  parameters: { docs: {
    description: { story: 'Replace the panel root with a styled div that forwards its props and ref.' },
    source: { language: 'tsx', code: `import { Dialog, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const Paper = styled.div({
  boxSizing: 'border-box',
  backgroundColor: vars.color.surfaceRaised,
  color: vars.color.text,
  border: \`1px dashed \${vars.color.border}\`,
  boxShadow: 'none',
});

<Dialog>
  <Dialog.Trigger>Open export</Dialog.Trigger>
  <Dialog.Content>
    <Dialog.Panel component={Paper}>
      <Dialog.Title>Export profile</Dialog.Title>
      <Dialog.Description>Download your profile details.</Dialog.Description>
      <Dialog.Close>Close export</Dialog.Close>
    </Dialog.Panel>
  </Dialog.Content>
</Dialog>` },
  } },
  render: () => (
    <Dialog>
      <Dialog.Trigger>Open export</Dialog.Trigger>
      <Dialog.Content>
        <Dialog.Panel component={AdapterMaterial}>
          <Dialog.Title>Export profile</Dialog.Title>
          <Dialog.Description>Download your profile details.</Dialog.Description>
          <Dialog.Close>Close export</Dialog.Close>
        </Dialog.Panel>
      </Dialog.Content>
    </Dialog>
  ),
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Open export' }));
    const dialog = await canvas.findByRole('dialog', { name: 'Export profile' });
    await settleMotion(dialog);
    await expect(dialog.scrollWidth).toBeLessThanOrEqual(dialog.clientWidth);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Close export' }));
    await waitFor(() => expect(dialog).not.toHaveAttribute('open'));
  },
};

const ScrollableContent = styled(Dialog.Content)({ maxBlockSize: '240px' });
const NarrowDialogContent = styled(Dialog.Content)({ inlineSize: '280px', minInlineSize: 0 });
const exportNotes = [
  'Your export includes your display name, email address, and profile settings. Saved drafts are included in a separate file.',
  'Comments and mentions retain the display name used when they were posted. Downloaded files do not update when your profile changes.',
  'Keep the downloaded archive somewhere private. Anyone with access to the archive can read the profile details it contains.',
  'You can request another export after updating your profile. Each archive contains the details available at the time of the request.',
];

export const LongContent: Story = {
  name: 'Long content',
  parameters: { docs: {
    description: { story: 'Scroll long content inside a height-limited dialog without flattening it into an accessible description.' },
    source: { language: 'tsx', code: `import { Dialog, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const ScrollableContent = styled(Dialog.Content)({ maxBlockSize: '240px' });
const Body = styled.p({ margin: 0, fontSize: vars.textSize.sm });
const exportNotes = [
  'Your export includes your display name, email address, and profile settings. Saved drafts are included in a separate file.',
  'Comments and mentions retain the display name used when they were posted. Downloaded files do not update when your profile changes.',
  'Keep the downloaded archive somewhere private. Anyone with access to the archive can read the profile details it contains.',
  'You can request another export after updating your profile. Each archive contains the details available at the time of the request.',
];

<Dialog>
  <Dialog.Trigger>Read export notes</Dialog.Trigger>
  <ScrollableContent withDescription={false}>
    <Dialog.Title tabIndex={-1} autoFocus>Before you export</Dialog.Title>
    <Dialog.Body>{exportNotes.map((note) => <Body key={note}>{note}</Body>)}</Dialog.Body>
    <Dialog.Footer><Dialog.Close>Done</Dialog.Close></Dialog.Footer>
  </ScrollableContent>
</Dialog>` },
  } },
  render: () => (
    <Dialog>
      <Dialog.Trigger>Read export notes</Dialog.Trigger>
      <ScrollableContent withDescription={false}>
        <Dialog.Title tabIndex={-1} autoFocus>Before you export</Dialog.Title>
        <Dialog.Body>{exportNotes.map((note) => <Body key={note}>{note}</Body>)}</Dialog.Body>
        <Dialog.Footer><Dialog.Close>Done</Dialog.Close></Dialog.Footer>
      </ScrollableContent>
    </Dialog>
  ),
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Read export notes' }));
    const dialog = await canvas.findByRole('dialog', { name: 'Before you export' });
    await settleMotion(dialog);
    await expect(within(dialog).getByRole('heading', { name: 'Before you export' })).toHaveFocus();
    const body = dialog.querySelector<HTMLElement>('[data-ui="dialog-body"]')!;
    await expect(dialog.scrollTop).toBe(0);
    await expect(body.scrollHeight).toBeGreaterThan(body.clientHeight);
    body.scrollTop = body.scrollHeight;
    const done = within(dialog).getByRole('button', { name: 'Done' });
    await expect(body.scrollTop).toBeGreaterThan(0);
    await expect(done.getBoundingClientRect().bottom).toBeLessThanOrEqual(dialog.getBoundingClientRect().bottom);
    await userEvent.click(done);
    await waitFor(() => expect(dialog).not.toHaveAttribute('open'));
  },
};

export const PaperScrolling: EasyStory = {
  name: 'Scroll inside the panel',
  tags: ['!autodocs'],
  args: {
    triggerLabel: 'Read notes', title: 'Export notes', closeLabel: 'Done',
    content: Array.from({ length: 20 }, (_, index) => <Body key={index}>{exportNotes[index % exportNotes.length]}</Body>),
    slotProps: { content: { withDescription: false, sx: { maxBlockSize: '240px' } } },
  },
  render: (args) => <Dialog {...args} />,
  play: async ({ canvas, canvasElement, userEvent }) => {
    const trigger = canvas.getByRole('button', { name: 'Read notes' });
    await userEvent.click(trigger);
    const dialog = await canvas.findByRole('dialog', { name: 'Export notes' });
    await settleMotion(dialog);
    const body = dialog.querySelector<HTMLElement>('[data-ui="dialog-body"]')!;
    await expect(body).not.toBeNull();
    await expect(body).toHaveFocus();
    await expect(body).toHaveAttribute('tabindex', '0');
    await userEvent.keyboard('{ArrowDown}');
    await expect(getComputedStyle(body).outlineStyle).not.toBe('none');
    const bodyRect = body.getBoundingClientRect();
    const panelRect = dialog.querySelector('[data-ui~="dialog-panel"]')!.getBoundingClientRect();
    const bodyStyle = getComputedStyle(body);
    const ringExtent = Number.parseFloat(bodyStyle.outlineWidth) + Number.parseFloat(bodyStyle.outlineOffset);
    await expect(bodyStyle.outlineOffset).toBe('2px');
    await expect(bodyRect.left - ringExtent).toBeGreaterThanOrEqual(panelRect.left);
    await expect(bodyRect.right + ringExtent).toBeLessThanOrEqual(panelRect.right);
    const title = within(dialog).getByRole('heading');
    const close = within(dialog).getByRole('button', { name: 'Done' });
    await expect(bodyRect.top - ringExtent).toBeGreaterThanOrEqual(title.getBoundingClientRect().bottom);
    await expect(bodyRect.bottom + ringExtent).toBeLessThanOrEqual(close.getBoundingClientRect().top);
    const titleTop = title.getBoundingClientRect().top;
    const closeTop = close.getBoundingClientRect().top;
    await expect(dialog.getBoundingClientRect().height).toBeLessThanOrEqual(240);
    await expect(body.scrollHeight).toBeGreaterThan(body.clientHeight);
    body.scrollTop = body.scrollHeight;
    await expect(body.scrollTop).toBeGreaterThan(0);
    await expect(title.getBoundingClientRect().top).toBe(titleTop);
    await expect(close.getBoundingClientRect().top).toBe(closeTop);
    await expect(dialog.scrollTop).toBe(0);
    await expect(close.getBoundingClientRect().bottom).toBeLessThanOrEqual(dialog.getBoundingClientRect().bottom);
    await userEvent.click(close);
    await expectClosed(canvasElement, trigger);
  },
};

export const BodyScrolling: EasyStory = {
  ...PaperScrolling,
  name: 'Scroll the whole panel',
  args: { ...PaperScrolling.args, scroll: 'body', slotProps: { content: { withDescription: false } } },
  play: async ({ canvas, canvasElement, userEvent }) => {
    const trigger = canvas.getByRole('button', { name: 'Read notes' });
    await userEvent.click(trigger);
    const dialog = await canvas.findByRole('dialog', { name: 'Export notes' });
    await settleMotion(dialog);
    const title = within(dialog).getByRole('heading');
    const initialTop = title.getBoundingClientRect().top;
    await expect(initialTop).toBeGreaterThanOrEqual(0);
    await expect(dialog.scrollHeight).toBeGreaterThan(dialog.clientHeight);
    await expect(canvasElement.ownerDocument.documentElement.style.overflow).toBe('hidden');
    await expect(dialog).not.toHaveAttribute('scroll');
    const panel = dialog.querySelector('[data-ui~="dialog-panel"]')!;
    await expect(panel).not.toHaveAttribute('scroll');
    const viewport = dialog.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    const scrollbar = {
      clientX: dialog.clientLeft > 0
        ? viewport.left + dialog.clientLeft / 2
        : viewport.left + dialog.clientWidth + (viewport.width - dialog.clientWidth) / 2,
      clientY: viewport.top + dialog.clientTop + 40,
    };
    const backdrop = {
      clientX: viewport.left + dialog.clientLeft + 1,
      clientY: viewport.top + dialog.clientTop + 1,
    };
    fireEvent.pointerDown(dialog, scrollbar);
    fireEvent.click(dialog, scrollbar);
    await expect(dialog).toHaveAttribute('data-state', 'open');
    fireEvent.pointerDown(panel, { clientX: panelRect.left + 1, clientY: panelRect.top + 1 });
    fireEvent.click(dialog, backdrop);
    await expect(dialog).toHaveAttribute('data-state', 'open');
    const close = within(dialog).getByRole('button', { name: 'Done' });
    for (let cycle = 0; cycle < 3; cycle += 1) {
      await expect(dialog).toHaveAttribute('data-state', 'open');
      await expect(title.getBoundingClientRect().top).toBeGreaterThanOrEqual(0);
      await expect(dialog.scrollTop).toBe(0);
      dialog.scrollTop = dialog.scrollHeight;
      await expect(dialog.scrollTop).toBeGreaterThan(0);
      await expect(title.getBoundingClientRect().top).toBeLessThan(initialTop);
      await expect(close.getBoundingClientRect().bottom).toBeLessThanOrEqual(dialog.getBoundingClientRect().bottom);
      await userEvent.click(close);
      await expectClosed(canvasElement, trigger);
      await userEvent.click(trigger);
      await settleMotion(dialog);
    }
    await expect(title.getBoundingClientRect().top).toBeGreaterThanOrEqual(0);
    await expect(dialog.scrollTop).toBe(0);
    fireEvent.pointerDown(dialog, backdrop);
    fireEvent.click(dialog, backdrop);
    await expectClosed(canvasElement, trigger);
    await userEvent.click(trigger);
    requestEscape(dialog);
    await expectClosed(canvasElement, trigger);
  },
};

export const BodyScrollingRTL: EasyStory = {
  ...BodyScrolling,
  decorators: [(Story) => <div dir="rtl"><Story /></div>],
};

export const BodyScrollingLight: EasyStory = {
  ...BodyScrolling,
  decorators: [withLightTheme],
  globals: { theme: 'light' },
};

export const BodyScrollingMobile: EasyStory = {
  ...BodyScrolling,
  parameters: {
    viewport: { options: { phone: { name: 'Phone', styles: { width: '390px', height: '844px' } } } },
  },
  globals: { viewport: { value: 'phone' } },
  play: async (context) => {
    await expect(context.canvasElement.ownerDocument.defaultView!.innerWidth).toBe(390);
    await expect(context.canvasElement.ownerDocument.defaultView!.innerHeight).toBe(844);
    await BodyScrolling.play!(context);
  },
};

export const BodyScrollingMobileRTL: EasyStory = {
  ...BodyScrollingMobile,
  decorators: [(Story) => <div dir="rtl"><Story /></div>],
};

export const BodyExitResumePreservesScroll: EasyStory = {
  ...BodyScrollingMobile,
  args: { ...BodyScrolling.args, defaultOpen: true },
  play: async ({ canvas, canvasElement }) => {
    const dialog = await canvas.findByRole('dialog', { name: 'Export notes' });
    await settleMotion(dialog);
    const body = dialog.querySelector<HTMLElement>('[data-ui="dialog-body"]')!;
    await expect(body).toHaveFocus();
    dialog.scrollTop = Math.floor((dialog.scrollHeight - dialog.clientHeight) / 2);
    const scrollTop = dialog.scrollTop;
    await expect(scrollTop).toBeGreaterThan(0);
    const retention = dialog.animate({ opacity: [1, 1] }, { duration: motionDurationMs.slow });
    retention.playbackRate = 0;
    try {
      await expect(retention.playState).toBe('running');
      fireEvent.click(within(dialog).getByRole('button', { name: 'Done' }));
      await expect(dialog).toHaveAttribute('data-state', 'closing');
      await expect(dialog).toHaveAttribute('open');
      await expect(body).toHaveFocus();
      fireEvent.click(canvas.getByRole('button', { name: 'Read notes' }));
      await expect(dialog).toHaveAttribute('data-state', 'open');
      await expect(canvasElement.querySelector('dialog')).toBe(dialog);
      await expect(dialog.querySelector('[data-ui="dialog-body"]')).toBe(body);
      await expect(body).toHaveFocus();
      await expect(dialog.scrollTop).toBe(scrollTop);
    } finally {
      retention.cancel();
    }
    await settleMotion(dialog);
    await expect(dialog.scrollTop).toBe(scrollTop);
  },
};

export const BodyMobileExplicitFieldFocus: EasyStory = {
  ...BodyScrollingMobile,
  args: {
    ...BodyScrolling.args,
    defaultOpen: false,
    content: <>{PaperScrolling.args?.content}<TextField label="Archive filename" autoFocus ref={setNativeAutoFocus} /></>,
  },
  play: async ({ canvas, canvasElement, userEvent }) => {
    const trigger = canvas.getByRole('button', { name: 'Read notes' });
    await userEvent.click(trigger);
    const dialog = await canvas.findByRole('dialog', { name: 'Export notes' });
    await settleMotion(dialog);
    const input = within(dialog).getByRole('textbox', { name: 'Archive filename' });
    const view = canvasElement.ownerDocument.defaultView!;
    await expect(view.innerWidth).toBe(390);
    await expect(view.innerHeight).toBe(844);
    for (let cycle = 0; cycle < 3; cycle += 1) {
      await expect(input).toHaveFocus();
      await expect(input.getBoundingClientRect().top).toBeGreaterThanOrEqual(0);
      await expect(input.getBoundingClientRect().bottom).toBeLessThanOrEqual(view.innerHeight);
      await expect(dialog.scrollTop).toBeGreaterThan(0);
      await expect(within(dialog).getByRole('heading').getBoundingClientRect().top).toBeLessThan(0);
      await userEvent.click(within(dialog).getByRole('button', { name: 'Done' }));
      await expectClosed(canvasElement, trigger);
      await userEvent.click(trigger);
      await settleMotion(dialog);
    }
    await expect(input).toHaveFocus();
    await expect(input.getBoundingClientRect().top).toBeGreaterThanOrEqual(0);
    await expect(input.getBoundingClientRect().bottom).toBeLessThanOrEqual(view.innerHeight);
  },
};

export const BodyMobileExplicitHeadingFocus: EasyStory = {
  ...BodyScrollingMobile,
  args: {
    ...BodyScrolling.args,
    defaultOpen: true,
    slotProps: { content: { withDescription: false }, title: { autoFocus: true, tabIndex: -1 } },
  },
  play: async ({ canvas }) => {
    const dialog = await canvas.findByRole('dialog', { name: 'Export notes' });
    await settleMotion(dialog);
    const title = within(dialog).getByRole('heading');
    await expect(title).toHaveFocus();
    await expect(title.getBoundingClientRect().top).toBeGreaterThanOrEqual(0);
  },
};

export const BodyProfileEditorMobile: EasyStory = {
  ...BodyProfileEditor,
  parameters: BodyScrollingMobile.parameters,
  globals: BodyScrollingMobile.globals,
};

export const CrampedPaper: EasyStory = {
  ...PaperScrolling,
  args: { ...PaperScrolling.args, slotProps: { content: { withDescription: false, sx: { maxBlockSize: '96px' } } } },
  play: async ({ canvas, canvasElement, userEvent }) => {
    const trigger = canvas.getByRole('button', { name: 'Read notes' });
    await userEvent.click(trigger);
    const dialog = await canvas.findByRole('dialog', { name: 'Export notes' });
    await settleMotion(dialog);
    const close = within(dialog).getByRole('button', { name: 'Done' });
    close.focus();
    await expect(close).toHaveFocus();
    await expect(close.getBoundingClientRect().top).toBeGreaterThanOrEqual(dialog.getBoundingClientRect().top);
    await expect(close.getBoundingClientRect().bottom).toBeLessThanOrEqual(dialog.getBoundingClientRect().bottom);
    await userEvent.click(close);
    await expectClosed(canvasElement, trigger);
  },
};

const ScrollNote = styled.p({ marginBlock: vars.space[3], fontSize: vars.textSize.sm });
const scrollingNotes = Array.from({ length: 12 }, (_, index) => (
  <ScrollNote key={index}>Your export includes your profile settings and saved drafts. Keep the archive somewhere private.</ScrollNote>
));

export const ScrollModes: Story = {
  name: 'Scrolling modes',
  parameters: { docs: {
    description: { story: 'Keep headings and actions in place, or scroll the whole panel in the overlay.' },
    source: { language: 'tsx', code: `import { Dialog, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const ScrollNote = styled.p({ marginBlock: vars.space[3], fontSize: vars.textSize.sm });
const notes = Array.from({ length: 12 }, (_, index) => (
  <ScrollNote key={index}>Your export includes your profile settings and saved drafts. Keep the archive somewhere private.</ScrollNote>
));

<>
  <Dialog triggerLabel="Scroll inside" title="Export notes" content={notes} closeLabel="Done" />
  <Dialog scroll="body" triggerLabel="Scroll whole panel" title="Export notes" content={notes} closeLabel="Done" />
</>` },
  } },
  render: () => <>
    <Dialog triggerLabel="Scroll inside" title="Export notes" closeLabel="Done" content={scrollingNotes} />
    <Dialog scroll="body" triggerLabel="Scroll whole panel" title="Export notes" closeLabel="Done" content={scrollingNotes} />
  </>,
};

function ChangingScrollMode() {
  const [scroll, setScroll] = useState<DialogScroll>('paper');
  return <Dialog
    defaultOpen
    scroll={scroll}
    triggerLabel="Open draft"
    title="Export draft"
    closeLabel="Done"
    slotProps={{ content: { withDescription: false } }}
    content={<>
      <TextField label="Draft name" defaultValue="Profile" />
      <Button onClick={() => setScroll((current) => current === 'paper' ? 'body' : 'paper')}>Change scrolling</Button>
      {scrollingNotes}
    </>}
  />;
}

export const PreserveDraftAcrossScrollModes: Story = {
  tags: ['!autodocs'],
  render: () => <ChangingScrollMode />,
  play: async ({ canvas, userEvent }) => {
    const dialog = await canvas.findByRole('dialog', { name: 'Export draft' });
    await settleMotion(dialog);
    const panel = dialog.querySelector('[data-ui~="dialog-panel"]');
    const body = dialog.querySelector('[data-ui="dialog-body"]');
    const input = within(dialog).getByRole('textbox', { name: 'Draft name' });
    await expect(dialog.firstElementChild).toBe(panel);
    await userEvent.type(input, ' edited');
    const change = within(dialog).getByRole('button', { name: 'Change scrolling' });
    for (const mode of ['body', 'paper']) {
      await userEvent.click(change);
      await expect(dialog).toHaveAttribute('data-scroll', mode);
      await expect(dialog.querySelector('[data-ui~="dialog-panel"]')).toBe(panel);
      await expect(dialog.firstElementChild).toBe(panel);
      await expect(dialog.querySelector('[data-ui="dialog-body"]')).toBe(body);
      await expect(within(dialog).getByRole('textbox', { name: 'Draft name' })).toBe(input);
      await expect(input).toHaveValue('Profile edited');
    }
    await userEvent.click(within(dialog).getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(dialog).not.toHaveAttribute('open'));
  },
};

function RemovableBodyControl() {
  const [present, setPresent] = useState(true);
  return present ? <button onClick={() => setPresent(false)}>Remove action</button> : <p>Action removed.</p>;
}

function BodyKeyboardFixture({ children, tabIndex, autoFocus }: { children?: ReactNode; tabIndex?: number; autoFocus?: boolean }) {
  return <Dialog defaultOpen>
    <Dialog.Content>
      <Dialog.Title tabIndex={-1} autoFocus={!autoFocus}>Keyboard notes</Dialog.Title>
      <Dialog.Body tabIndex={tabIndex} autoFocus={autoFocus}>{children}<p>Read the export notes.</p></Dialog.Body>
      <Dialog.Footer><Dialog.Close>Done</Dialog.Close></Dialog.Footer>
    </Dialog.Content>
  </Dialog>;
}

async function expectBodyKeyboardEntry(canvasElement: HTMLElement, user: Pick<typeof userEvent, 'tab'>) {
  const dialog = within(canvasElement).getByRole('dialog');
  const title = within(dialog).getByRole('heading');
  const body = dialog.querySelector<HTMLElement>('[data-ui="dialog-body"]')!;
  title.focus();
  await user.tab();
  await expect(body).toHaveFocus();
  await expect(getComputedStyle(body).outlineStyle).not.toBe('none');
  for (const key of ['ArrowDown', 'PageDown', 'Home', 'End']) {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
    fireEvent(body, event);
    await expect(event.defaultPrevented).toBe(false);
  }
}

export const BodyWithHiddenControl: Story = {
  tags: ['!autodocs'],
  render: () => <BodyKeyboardFixture><button hidden>Hidden action</button></BodyKeyboardFixture>,
  play: async ({ canvasElement, userEvent }) => expectBodyKeyboardEntry(canvasElement, userEvent),
};

export const BodyWithInertControl: Story = {
  ...BodyWithHiddenControl,
  render: () => <BodyKeyboardFixture><div inert><button>Inert action</button></div></BodyKeyboardFixture>,
};

export const BodyWithNegativeTabIndex: Story = {
  ...BodyWithHiddenControl,
  render: () => <BodyKeyboardFixture><button tabIndex={-1}>Programmatic action</button></BodyKeyboardFixture>,
};

export const BodyAfterIndependentControlRemoval: Story = {
  tags: ['!autodocs'],
  render: () => <BodyKeyboardFixture><RemovableBodyControl /></BodyKeyboardFixture>,
  play: async ({ canvasElement, userEvent }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Remove action' }));
    await expect(canvas.queryByRole('button', { name: 'Remove action' })).toBeNull();
    await expectBodyKeyboardEntry(canvasElement, userEvent);
  },
};

export const BodyTabIndexOverride: Story = {
  tags: ['!autodocs'],
  render: () => <BodyKeyboardFixture tabIndex={-1} />,
  play: async ({ canvas, userEvent }) => {
    await expect(canvas.getByRole('heading')).toHaveFocus();
    await userEvent.tab();
    await expect(canvas.getByRole('button', { name: 'Done' })).toHaveFocus();
  },
};

export const BodyAutoFocusOverride: Story = {
  tags: ['!autodocs'],
  render: () => <BodyKeyboardFixture tabIndex={-1} autoFocus />,
  play: async ({ canvasElement }) => {
    const body = canvasElement.querySelector('[data-ui="dialog-body"]')!;
    await expect(body).toHaveFocus();
    await expect(body).toHaveAttribute('autofocus');
    await expect(body).toHaveAttribute('tabindex', '-1');
  },
};

export const NarrowLayout: Story = {
  name: 'Narrow content',
  parameters: { docs: {
    description: { story: 'Set a narrow shell width for a short confirmation.' },
    source: { language: 'tsx', code: `import { Dialog, styled } from '@jfrader/ui';

const NarrowContent = styled(Dialog.Content)({ inlineSize: '280px', minInlineSize: 0 });

<Dialog>
  <Dialog.Trigger>View confirmation</Dialog.Trigger>
  <NarrowContent>
    <Dialog.Title>Saved</Dialog.Title>
    <Dialog.Description>Profile updated.</Dialog.Description>
    <Dialog.Close>Done</Dialog.Close>
  </NarrowContent>
</Dialog>` },
  } },
  render: () => (
    <Dialog>
      <Dialog.Trigger>View confirmation</Dialog.Trigger>
      <NarrowDialogContent>
        <Dialog.Title>Saved</Dialog.Title>
        <Dialog.Description>Profile updated.</Dialog.Description>
        <Dialog.Close>Done</Dialog.Close>
      </NarrowDialogContent>
    </Dialog>
  ),
};

export const MotionWithoutScrollbars: Story = {
  ...NarrowLayout,
  tags: ['!autodocs'],
  play: async ({ canvas, canvasElement, userEvent }) => {
    const dialog = canvasElement.querySelector('dialog')!;
    const view = canvasElement.ownerDocument.defaultView!;
    const trigger = canvas.getByRole('button', { name: 'View confirmation' });
    let verticalOverflow = 0;
    let horizontalOverflow = 0;
    let frame = 0;
    const measure = () => {
      if (!dialog.open) return;
      const ports = [dialog, ...dialog.querySelectorAll<HTMLElement>('[data-ui~="dialog-panel"], [data-ui="dialog-body"]')];
      for (const port of ports) {
        verticalOverflow = Math.max(verticalOverflow, port.scrollHeight - port.clientHeight);
        horizontalOverflow = Math.max(horizontalOverflow, port.scrollWidth - port.clientWidth);
      }
    };
    const sample = () => {
      measure();
      frame = view.requestAnimationFrame(sample);
    };
    const observer = new MutationObserver(measure);
    observer.observe(dialog, { attributes: true, attributeFilter: ['open', 'data-state'] });
    sample();
    try {
      for (let cycle = 0; cycle < 2; cycle += 1) {
        await userEvent.click(trigger);
        await waitFor(() => expect(dialog).toHaveAttribute('open'));
        await settleMotion(dialog);
        measure();
        await userEvent.click(within(dialog).getByRole('button', { name: 'Done' }));
        await expectClosed(canvasElement, trigger);
      }
      await expect(verticalOverflow).toBe(0);
      await expect(horizontalOverflow).toBe(0);
    } finally {
      observer.disconnect();
      view.cancelAnimationFrame(frame);
    }
  },
};

export const MotionWithoutScrollbarsLight: Story = {
  ...MotionWithoutScrollbars,
  decorators: [withLightTheme],
  globals: { theme: 'light' },
};

export const MotionWithoutScrollbarsRTL: Story = {
  ...MotionWithoutScrollbars,
  decorators: [(Story) => <div dir="rtl"><Story /></div>],
};

export const BodyMotionWithoutScrollbars: Story = {
  ...MotionWithoutScrollbars,
  render: (args) => <Dialog {...args} scroll="body">
    <Dialog.Trigger>View confirmation</Dialog.Trigger>
    <Dialog.Content>
      <Dialog.Title>Saved</Dialog.Title>
      <Dialog.Body><Body>Profile updated.</Body></Dialog.Body>
      <Dialog.Footer><Dialog.Close>Done</Dialog.Close></Dialog.Footer>
    </Dialog.Content>
  </Dialog>,
};

export const NearlyFittingBodyMotion: Story = {
  ...BodyMotionWithoutScrollbars,
  render: (args) => <Dialog {...args} scroll="body">
    <Dialog.Trigger>View confirmation</Dialog.Trigger>
    <Dialog.Content>
      <Dialog.Panel sx={{ minBlockSize: 'calc(100dvh - 32px)' }}>
        <Dialog.Title>Saved</Dialog.Title>
        <Dialog.Body><Body>Profile updated.</Body></Dialog.Body>
        <Dialog.Footer><Dialog.Close>Done</Dialog.Close></Dialog.Footer>
      </Dialog.Panel>
    </Dialog.Content>
  </Dialog>,
};

export const ContrastPanel: Story = {
  name: 'Contrast panel',
  parameters: { docs: {
    description: { story: 'Use a contrast panel for fixed charcoal material inside either theme.' },
    source: { language: 'tsx', code: `import { Dialog } from '@jfrader/ui';

<Dialog>
  <Dialog.Trigger>Open export</Dialog.Trigger>
  <Dialog.Content>
    <Dialog.Panel appearance="contrast">
      <Dialog.Title>Export profile</Dialog.Title>
      <Dialog.Description>Download your profile details.</Dialog.Description>
      <Dialog.Close>Close export</Dialog.Close>
    </Dialog.Panel>
  </Dialog.Content>
</Dialog>` },
  } },
  render: () => (
    <Dialog>
      <Dialog.Trigger>Open export</Dialog.Trigger>
      <Dialog.Content>
        <Dialog.Panel appearance="contrast">
          <Dialog.Title>Export profile</Dialog.Title>
          <Dialog.Description>Download your profile details.</Dialog.Description>
          <Dialog.Close>Close export</Dialog.Close>
        </Dialog.Panel>
      </Dialog.Content>
    </Dialog>
  ),
};
