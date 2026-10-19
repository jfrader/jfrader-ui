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
import { OverlayPortal } from '../../overlay/overlay-portal';
import { useNativeDialog, useNativeDialogRoot } from '../../overlay/use-native-dialog';
import { Dialog, type DialogPanelProps, type DialogCompoundProps, type DialogEasyProps } from './index';

const TITLE = 'Edit profile';
const DESCRIPTION = 'Update your display name and avatar.';
const DELETE_LABEL = 'Delete account';
const composedTriggerClick = fn();
const composedTriggerRef = fn<(element: HTMLButtonElement | null) => void>();

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
    usage: `### Composition
Pass triggerLabel, title, content and closeLabel for a standard dialog; description is optional. Do not combine these props with children. Use slotProps.trigger/content/panel/header/title/description/close for part props. component aliases slots.root; slots.root wins. slots.root and slotProps.root customize the panel div; content targets the native shell. Use the compound parts for custom hierarchy.

### Panel and shell
Plain Dialog.Content children get one default Dialog.Panel. For contrast or custom material, supply one direct Dialog.Panel child; fragments and whitespace are allowed, other substantive siblings are not. Put providers inside Panel or outside Content. Panel outside Content throws.

Dialog.Content ref, css, sx and native callbacks target the real dialog shell, which owns the size limits. Dialog.Panel ref targets its div. Panel has inherited appearance by default; appearance="contrast" establishes fixed charcoal. Panel fills the shell and keeps padding and enter/exit motion.

### Root replacement
On Panel, component is sugar for slots.root; only root is adopted, and slots.root wins. slotProps.root accepts div props and css (no sx). Declare adapters outside render, render one div, and forward all supplied props and ref. Apply material before the supplied className. A changed component identity remounts children and loses focus and uncontrolled input state.

Root slot props win ordinary conflicts; className combines and style shallow-merges, slot values last. Styling order is adapter material → panel structure → slot css/classes → consumer css/classes → sx. Use [data-ui~="dialog-panel"] for composed roots.

### Keyboard
Tab and Shift+Tab stay inside. Escape and Close request closure through the shell; onCancel can veto cancelable requests. Accepted closure restores focus after exit motion. Reduced motion makes entry and exit instant.`,
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
  args: {
    triggerLabel: 'Open profile', title: TITLE, description: DESCRIPTION,
    content: <TextField label="Display name" defaultValue="Maya" />, closeLabel: 'Close',
    slots: { root: Surface },
    component: UnusedDialogRoot,
    slotProps: {
      root: { className: 'custom-dialog-panel', css: { borderRadius: vars.radius.sm } },
      header: { className: 'custom-dialog-header', css: { fontStyle: 'italic' } },
      title: { className: 'custom-dialog-title' },
      close: { css: { marginBlockStart: vars.space[4] } },
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
  name: 'Easy mode',
  args: {
    triggerLabel: 'Open profile',
    title: TITLE,
    description: DESCRIPTION,
    content: (
      <>
        <TextField label="Display name" defaultValue="Maya" />
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
  parameters: { docs: { source: { language: 'tsx', code: `<Dialog
  triggerLabel="Open profile"
  title="Profile"
  description="Update your display name and avatar."
  content={
    <>
      <TextField label="Display name" defaultValue="Maya" />
      <TextField label="Email" type="email" defaultValue="maya@example.com" />
    </>
  }
  closeLabel="Close"
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

const AdapterMaterial = styled.div({ backgroundColor: vars.color.surfaceRaised, color: vars.color.text, border: `1px dashed ${vars.color.border}`, boxShadow: 'none' });
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
          <input aria-label="Export draft" defaultValue="Keep me" />
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
        <Dialog.Panel slotProps={{ root: { css: panelSizeOverride } }} sx={{ inlineSize: '260px' }}>
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
  const panel = dialog.firstElementChild!;
  await expectEntranceMotion(panel);
  await expect(dialog).toHaveAttribute('data-state', 'open');

  await userEvent.click(canvas.getByRole('button', { name: 'Close' }));
  // Accepted close: still in the top layer while the exit runs; requests during it are absorbed.
  await expect(onOpenChange).toHaveBeenCalledTimes(2);
  await expect(dialog).toHaveAttribute('open');
  await expect(dialog).toHaveAttribute('data-state', 'closing');
  requestEscape(dialog);
  await expect(onOpenChange).toHaveBeenCalledTimes(2);

  await expectRetainedExit(panel, () => !dialog.hasAttribute('open'));
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
