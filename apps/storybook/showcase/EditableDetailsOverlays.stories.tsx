import { useRef, useState, type RefObject } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fireEvent, waitFor, within } from 'storybook/test';
import {
  Button,
  Dialog,
  EditableDetails,
  Flex,
  Popover,
  Stack,
  TextField,
  type EditableDetailsEditorProps,
} from '@jfrader/ui';
import { EditableDetails as SubpathDetails } from '@jfrader/ui/editable-details';
import './showcase.css';

type Surface = 'popover' | 'modal';

interface TitleEditorProps extends EditableDetailsEditorProps {
  value: string;
  onSave: (value: string) => void;
  surface: Surface;
  overlayOpen: boolean;
  onOverlayOpenChange: (open: boolean) => void;
  onCollapse: () => void;
  popoverRef: RefObject<HTMLDivElement | null>;
  dialogRef: RefObject<HTMLDialogElement | null>;
}

function TitleEditor({
  initialFocusRef, complete, cancel, visible, value, onSave, surface,
  overlayOpen, onOverlayOpenChange, onCollapse, popoverRef, dialogRef,
}: TitleEditorProps) {
  const [draft, setDraft] = useState(value);
  const suggestions = (
    <Stack>
      <TextField label="Title suggestion" value={draft} onValueChange={setDraft} />
      <Button onClick={onCollapse}>Collapse section</Button>
    </Stack>
  );

  return (
    <Stack>
      <TextField ref={initialFocusRef} label="Project title" value={draft} onValueChange={setDraft} />
      {surface === 'popover' ? (
        <Popover open={visible && overlayOpen} onOpenChange={onOverlayOpenChange}>
          <Popover.Trigger>Choose a title</Popover.Trigger>
          <Popover.Content ref={popoverRef} aria-label="Title picker">{suggestions}</Popover.Content>
        </Popover>
      ) : (
        <Dialog open={visible && overlayOpen} onOpenChange={onOverlayOpenChange}>
          <Dialog.Trigger>Choose a title</Dialog.Trigger>
          <Dialog.Content ref={dialogRef}>
            <Dialog.Title>Title picker</Dialog.Title>
            <Dialog.Description>Choose the title for this project.</Dialog.Description>
            {suggestions}
            <Dialog.Close>Close picker</Dialog.Close>
          </Dialog.Content>
        </Dialog>
      )}
      <Flex gap="sm" wrap>
        <Button tone="accent" onClick={() => { onSave(draft); complete(); }}>Save title</Button>
        <Button onClick={cancel}>Cancel</Button>
      </Flex>
    </Stack>
  );
}

function OverlayDetails({ surface = 'popover' }: { surface?: Surface }) {
  const [open, setOpen] = useState(true);
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [title, setTitle] = useState('Observatory');
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  const changeSection = (next: boolean) => {
    if (!next) {
      const overlay = surface === 'modal' ? dialogRef.current : popoverRef.current;
      const ownsFocus = overlay?.contains(overlay.ownerDocument.activeElement) ?? false;
      // Close the native top layer before hiding its invoker or moving focus outside it.
      if (dialogRef.current?.open) dialogRef.current.close();
      setOverlayOpen(false);
      if (ownsFocus) triggerRef.current?.focus();
    }
    setOpen(next);
  };

  return (
    <main className="showcase-page">
      <h1 className="showcase-title">Project settings</h1>
      <Stack>
        <EditableDetails>
          <EditableDetails.Section title="Identity" headingLevel={2} open={open} onOpenChange={changeSection} triggerRef={triggerRef}>
            <EditableDetails.List>
              <EditableDetails.Item label="Title" renderEditor={(editor) => (
                <TitleEditor {...editor} value={title} onSave={setTitle} surface={surface}
                  overlayOpen={overlayOpen} onOverlayOpenChange={setOverlayOpen}
                  onCollapse={() => changeSection(false)} popoverRef={popoverRef} dialogRef={dialogRef} />
              )}>
                {title}
              </EditableDetails.Item>
            </EditableDetails.List>
          </EditableDetails.Section>
        </EditableDetails>
        <Button onClick={() => changeSection(false)}>Apply remote collapse</Button>
      </Stack>
    </main>
  );
}

const meta = {
  title: 'Showcase/EditableDetails',
  component: OverlayDetails,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'Choose a project title in a picker, then collapse the section without losing your draft.',
      },
      usage: `### Collapse and focus
- Control the Section and overlay state together. Use \`visible\` to hide portaled or top-layer surfaces when the section is collapsed.
- Before collapse, check whether the overlay owns focus. Close a native dialog before hiding its invoker, then focus the Section trigger only if the overlay owned focus.
- The editor stays mounted and retains its draft. Popover does not automatically return focus on unmount.
- Keep this coordination in the application rather than a document-global overlay registry.`,
      source: { code: '<EditableDetails.Section open={open} onOpenChange={changeSection} triggerRef={triggerRef}>\n  <EditableDetails.List>\n    <EditableDetails.Item label="Title" renderEditor={(editor) => <TitleEditor {...editor} />}>\n      {title}\n    </EditableDetails.Item>\n  </EditableDetails.List>\n</EditableDetails.Section>' },
    },
    a11y: {
      config: {
        rules: [{ id: 'aria-hidden-focus', selector: '[aria-hidden="true"]:not([data-floating-ui-focus-guard])' }],
      },
    },
  },
} satisfies Meta<typeof OverlayDetails>;
export default meta;
type Story = StoryObj<typeof meta>;

export const PortaledPicker: Story = {
  args: { surface: 'popover' },
  play: async ({ canvas, canvasElement, userEvent }) => {
    await expect(SubpathDetails).toBe(EditableDetails);
    const page = within(canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByRole('button', { name: 'Edit Title' }));
    const draftField = canvas.getByRole('textbox', { name: 'Project title' });
    await userEvent.click(canvas.getByRole('button', { name: 'Choose a title' }));
    const picker = await page.findByRole('dialog', { name: 'Title picker' });
    await expect(canvasElement.contains(picker)).toBe(false);
    const field = within(picker).getByRole('textbox', { name: 'Title suggestion' });
    await userEvent.clear(field);
    await userEvent.type(field, 'North observatory');
    await userEvent.click(within(picker).getByRole('button', { name: 'Collapse section' }));
    const trigger = canvas.getByRole('button', { name: 'Identity' });
    await waitFor(() => expect(page.queryByRole('dialog', { name: 'Title picker' })).toBeNull());
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(trigger).toHaveFocus();
    await expect(draftField).not.toBeVisible();
    await userEvent.keyboard('{Enter}');
    await expect(canvas.getByRole('textbox', { name: 'Project title' })).toBe(draftField);
    await expect(draftField).toHaveValue('North observatory');
    await expect(trigger).toHaveFocus();
    await userEvent.click(canvas.getByRole('button', { name: 'Choose a title' }));
    const reopened = await page.findByRole('dialog', { name: 'Title picker' });
    await userEvent.click(within(reopened).getByRole('textbox', { name: 'Title suggestion' }));
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(page.queryByRole('dialog', { name: 'Title picker' })).toBeNull());
    await expect(canvas.getByRole('button', { name: 'Choose a title' })).toHaveFocus();
    await expect(canvas.getByRole('textbox', { name: 'Project title' })).toHaveValue('North observatory');
  },
};

export const PickerFocusMovedAway: Story = {
  args: { surface: 'popover' },
  play: async ({ canvas, canvasElement, userEvent }) => {
    const page = within(canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByRole('button', { name: 'Edit Title' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Choose a title' }));
    const picker = await page.findByRole('dialog', { name: 'Title picker' });
    await userEvent.click(within(picker).getByRole('textbox', { name: 'Title suggestion' }));
    await userEvent.tab();
    await userEvent.tab();
    await userEvent.tab();
    await userEvent.tab();
    const remote = canvas.getByRole('button', { name: 'Apply remote collapse' });
    await expect(remote).toHaveFocus();
    await expect(picker).toBeVisible();
    await userEvent.keyboard('{Enter}');
    await waitFor(() => expect(page.queryByRole('dialog', { name: 'Title picker' })).toBeNull());
    await expect(remote).toHaveFocus();
    await expect(canvas.getByRole('button', { name: 'Identity' })).toHaveAttribute('aria-expanded', 'false');
  },
};

export const ModalPicker: Story = {
  args: { surface: 'modal' },
  play: async ({ canvas, canvasElement, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Edit Title' }));
    const draftField = canvas.getByRole('textbox', { name: 'Project title' });
    await userEvent.click(canvas.getByRole('button', { name: 'Choose a title' }));
    const picker = await canvas.findByRole('dialog', { name: 'Title picker' });
    const field = within(picker).getByRole('textbox', { name: 'Title suggestion' });
    await userEvent.clear(field);
    await userEvent.type(field, 'Southern observatory');
    await userEvent.tab();
    await expect(within(picker).getByRole('button', { name: 'Collapse section' })).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    await waitFor(() => expect(picker).not.toHaveAttribute('open'));
    const trigger = canvas.getByRole('button', { name: 'Identity' });
    await expect(trigger).toHaveFocus();
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(canvasElement.ownerDocument.querySelector(':modal')).toBeNull();
    await expect(draftField).not.toBeVisible();
    await userEvent.keyboard('{Enter}');
    await expect(canvas.getByRole('textbox', { name: 'Project title' })).toBe(draftField);
    await expect(draftField).toHaveValue('Southern observatory');
    await userEvent.click(canvas.getByRole('button', { name: 'Choose a title' }));
    await waitFor(() => expect(picker).toHaveAttribute('open'));
    fireEvent(picker, new Event('cancel', { cancelable: true }));
    await waitFor(() => expect(picker).not.toHaveAttribute('open'));
    const remote = canvas.getByRole('button', { name: 'Apply remote collapse' });
    await userEvent.click(remote);
    await expect(remote).toHaveFocus();
  },
};

export const OpenPicker: Story = {
  args: { surface: 'popover' },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Edit Title' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Choose a title' }));
  },
};

export const OpenModal: Story = {
  ...OpenPicker,
  args: { surface: 'modal' },
};
