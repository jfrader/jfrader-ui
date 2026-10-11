import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fireEvent, fn, waitFor } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { css } from '../../styling/css';
import { withLightTheme } from '../../testing/story-decorators';
import { InlineEdit, type InlineEditProps } from './index';

// Raw fixture buttons must pass the global target-size (WCAG 2.5.8) axe gate in every environment.
const FIXTURE_BUTTON = { minHeight: '24px', minWidth: '24px', padding: '4px 10px', boxSizing: 'border-box' } as const;

const sizes = ['sm', 'md', 'lg'] as const;
const minHeights = { sm: 32, md: 40, lg: 48 };
const actionSizes = { sm: 24, md: 32, lg: 40 };
const frameStyle = css({ display: 'grid', gap: vars.space[4], inlineSize: 'min(100%, 420px)' });
const narrowStyle = css({ inlineSize: '220px' });

const usage = `<InlineEdit
  label="Project name"
  value={name}
  onValueChange={setName}
  validate={(next) => (next.trim() ? null : 'Enter a name')}
  onSave={renameProject}
/>`;

const meta = {
  title: 'Inputs/InlineEdit',
  component: InlineEdit,
  tags: ['autodocs'],
  args: { label: 'Project name', defaultValue: 'Apollo', onSave: fn() },
  argTypes: {
    variant: { control: 'radio', options: ['title', 'body'] },
    size: { control: 'radio', options: sizes },
  },
  decorators: [(Story) => <div css={frameStyle}><Story /></div>],
  parameters: {
    docs: {
      description: {
        component: [
          'Renames one independently persisted value in place: a project name, a title, a one-field description. The resting value is a native button; editing swaps it for a native input (or a textarea with `multiline`). Use TextField or Textarea in multi-field forms, or wherever editing should always be visible.',
          '',
          '**Persistence before commitment.** Saving a changed draft calls `onSave(next)`. Only after it resolves does the widget request `onValueChange(next)` and then `onOpenChange(false)`. The trigger always shows the persisted value: a controlled `value` that the parent does not update keeps the old text, and there is no optimistic display. Apps that want optimism own it outside the widget. An unchanged draft closes without calling `onSave`.',
          '',
          '**Failure.** A rejected or throwing `onSave` keeps the editor open with the draft and a status message; Enter or Save tries again. If the parent closed the editor while the save was pending, a Retry button resaves the failed draft.',
          '',
          '**Stale saves.** While a save is pending the editor is read-only and Save/Cancel are inert. A `value` update from elsewhere, or unmounting, drops the pending save: its settlement requests nothing.',
          '',
          '**Validation.** `normalize` turns the draft into the saved value (nothing is trimmed by default). `validate` returns a message to block the save; an `error` prop also blocks it.',
          '',
          '**Keyboard.** Enter or Space on the value: open the editor with the text selected (a pointer click puts the caret at the end). Enter: save (never submits a surrounding form). Shift+Enter with `multiline`: newline. Escape: cancel. Tab and Shift+Tab move natively through the editor, Save, Cancel and the page. With `saveOnBlur` (default) focus leaving the whole widget saves; moving between the editor and its actions or switching windows does not. IME composition bypasses Enter, Escape and the leave save.',
          '',
          '**Focus.** A keyboard or button save/cancel returns focus to the value after the close is accepted. A leave save never moves focus, and neither does a close made by the parent.',
          '',
          '**Headings.** The root is a `div`; never place it inside `h1`–`h6`. Render the document heading separately (see HeadingContext) and use `variant="title"` for the typography.',
        ].join('\n'),
      },
      source: { code: usage },
    },
  },
} satisfies Meta<typeof InlineEdit>;
export default meta;
type Story = StoryObj<typeof meta>;

type Spy = ReturnType<typeof fn>;

function deferred() {
  let resolve!: () => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const rootOf = (element: HTMLElement) => element.querySelector<HTMLElement>('[data-ui="inline-edit"]')!;
const editorOf = (element: HTMLElement) =>
  element.querySelector<HTMLInputElement | HTMLTextAreaElement>('input, textarea')!;
const statusOf = (element: HTMLElement) => element.querySelector<HTMLElement>('[role="status"]')!;
const keepFocus = (event: { preventDefault: () => void }) => event.preventDefault();

async function expectRing(element: HTMLElement) {
  const style = getComputedStyle(element);
  await expect(style.outlineStyle).not.toBe('none');
  // Fractional devicePixelRatios device-snap outline widths (authored 2px computes ~1.49px).
  await expect(parseFloat(style.outlineWidth)).toBeGreaterThan(1);
}

async function expectFocus(element: HTMLElement) {
  await expect(element.ownerDocument.activeElement).toBe(element);
  await expectRing(element);
}

function ControlledField(props: InlineEditProps) {
  const [value, setValue] = useState(props.defaultValue ?? '');
  const [open, setOpen] = useState(false);
  return (
    <>
      <InlineEdit
        {...props}
        defaultValue={undefined}
        value={value}
        onValueChange={(next) => {
          props.onValueChange?.(next);
          setValue(next);
        }}
        open={open}
        onOpenChange={(next) => {
          props.onOpenChange?.(next);
          setOpen(next);
        }}
      />
      <output data-testid="value">{value}</output>
    </>
  );
}
ControlledField.displayName = 'ControlledInlineEdit';

/** The parent renames the value from elsewhere while the editor stays focused. */
function ExternalValueField(props: InlineEditProps) {
  const [value, setValue] = useState('Apollo');
  return (
    <>
      <InlineEdit
        {...props}
        defaultValue={undefined}
        value={value}
        onValueChange={(next) => {
          props.onValueChange?.(next);
          setValue(next);
        }}
      />
      <button style={FIXTURE_BUTTON} type="button" onMouseDown={keepFocus} onClick={() => setValue('Hermes')}>
        Rename to Hermes
      </button>
    </>
  );
}
ExternalValueField.displayName = 'ExternalValueInlineEdit';

/** The parent can close the editor or remove the widget while a save is pending. */
function ParentControls(props: InlineEditProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(true);
  return (
    <>
      {mounted && (
        <InlineEdit
          {...props}
          open={open}
          onOpenChange={(next) => {
            props.onOpenChange?.(next);
            setOpen(next);
          }}
        />
      )}
      <button style={FIXTURE_BUTTON} type="button" onClick={() => setOpen(false)}>
        Close editor
      </button>
      <button style={FIXTURE_BUTTON} type="button" onClick={() => setMounted(false)}>
        Remove widget
      </button>
    </>
  );
}
ParentControls.displayName = 'ParentControlledInlineEdit';

export const Default: Story = {
  play: async ({ canvas, canvasElement }) => {
    const trigger = canvas.getByRole('button', { name: 'Edit Project name: Apollo' });
    await expect(trigger).toHaveAttribute('type', 'button');
    await expect(trigger).toHaveTextContent('Apollo');
    await expect(canvas.queryByRole('textbox')).toBeNull();
    const root = rootOf(canvasElement);
    await expect(root).toHaveAttribute('data-state', 'closed');
    await expect(root).toHaveAttribute('data-phase', 'idle');
    await expect(statusOf(canvasElement)).toHaveAttribute('aria-live', 'polite');
    await expect(statusOf(canvasElement)).toHaveAttribute('aria-atomic', 'true');
    await expect(InlineEdit.displayName).toBe('InlineEdit');
  },
};

export const Keyboard: Story = {
  args: { onValueChange: fn(), onOpenChange: fn() },
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    const onSave = args.onSave as Spy;
    const root = rootOf(canvasElement);

    await userEvent.tab();
    const trigger = canvas.getByRole('button', { name: 'Edit Project name: Apollo' });
    await expectFocus(trigger);
    await userEvent.keyboard('{Enter}');
    await expect(args.onOpenChange).toHaveBeenCalledTimes(1);
    await expect(args.onOpenChange).toHaveBeenLastCalledWith(true);
    const editor = canvas.getByRole('textbox', { name: 'Project name' }) as HTMLInputElement;
    await expectFocus(editor);
    // Keyboard opening selects the whole value.
    await expect([editor.selectionStart, editor.selectionEnd]).toEqual([0, 6]);
    await expect(editor).toHaveAccessibleDescription('Press Enter to save, Escape to cancel.');

    await userEvent.keyboard('Zeus');
    await expect(editor).toHaveValue('Zeus');
    const save = deferred();
    onSave.mockImplementation(() => save.promise);
    await userEvent.keyboard('{Enter}');
    await expect(onSave).toHaveBeenCalledTimes(1);
    await expect(onSave).toHaveBeenLastCalledWith('Zeus');
    await expect(root).toHaveAttribute('aria-busy', 'true');
    await expect(root).toHaveAttribute('data-phase', 'saving');
    await expect(editor).toHaveAttribute('readonly');
    await expect(statusOf(canvasElement)).toHaveTextContent('Saving…');
    await expect(editor.ownerDocument.activeElement).toBe(editor);

    // Every activation path is inert while the save is pending.
    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard('{Escape}');
    const saveButton = canvas.getByRole('button', { name: 'Save' });
    const cancelButton = canvas.getByRole('button', { name: 'Cancel' });
    await expect(saveButton).toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(saveButton);
    await userEvent.click(cancelButton);
    await expect(onSave).toHaveBeenCalledTimes(1);
    await expect(args.onOpenChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).not.toHaveBeenCalled();
    // The trigger is gone and nothing has been committed yet.
    await expect(canvas.queryByRole('button', { name: /^Edit/ })).toBeNull();

    save.resolve();
    const saved = await canvas.findByRole('button', { name: 'Edit Project name: Zeus' });
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith('Zeus');
    await expect(args.onOpenChange).toHaveBeenCalledTimes(2);
    await expect(args.onOpenChange).toHaveBeenLastCalledWith(false);
    const valueOrder = (args.onValueChange as Spy).mock.invocationCallOrder[0]!;
    const closeOrder = (args.onOpenChange as Spy).mock.invocationCallOrder[1]!;
    await expect(valueOrder).toBeLessThan(closeOrder);
    await expectFocus(saved);
    await expect(root).not.toHaveAttribute('aria-busy');
    await expect(statusOf(canvasElement)).toHaveTextContent('Saved');

    // Space opens; Escape cancels without a value request and returns focus.
    await userEvent.keyboard(' ');
    await expect(args.onOpenChange).toHaveBeenCalledTimes(3);
    await userEvent.keyboard('Draft{Escape}');
    await expect(args.onOpenChange).toHaveBeenCalledTimes(4);
    await expect(args.onOpenChange).toHaveBeenLastCalledWith(false);
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(onSave).toHaveBeenCalledTimes(1);
    await expectFocus(canvas.getByRole('button', { name: 'Edit Project name: Zeus' }));

    // An unchanged draft closes without persisting.
    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard('{Enter}');
    await expect(args.onOpenChange).toHaveBeenCalledTimes(6);
    await expect(onSave).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expectFocus(canvas.getByRole('button', { name: 'Edit Project name: Zeus' }));
  },
};

export const ActionButtons: Story = {
  args: { onValueChange: fn(), onOpenChange: fn() },
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Edit Project name: Apollo' }));
    const editor = canvas.getByRole('textbox') as HTMLInputElement;
    // A pointer click puts the caret at the end.
    await expect([editor.selectionStart, editor.selectionEnd]).toEqual([6, 6]);
    await userEvent.keyboard(' 2');
    // Pressing Save keeps focus in the editor, so no leave save runs before the click.
    await userEvent.click(canvas.getByRole('button', { name: 'Save' }));
    await expect(args.onSave).toHaveBeenCalledTimes(1);
    await expect(args.onSave).toHaveBeenLastCalledWith('Apollo 2');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expectFocus(canvas.getByRole('button', { name: 'Edit Project name: Apollo 2' }));

    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard('Draft');
    await userEvent.tab();
    await expectFocus(canvas.getByRole('button', { name: 'Save' }));
    await userEvent.tab();
    const cancel = canvas.getByRole('button', { name: 'Cancel' });
    await expectFocus(cancel);
    await expect(args.onSave).toHaveBeenCalledTimes(1);
    await userEvent.keyboard('{Enter}');
    await expect(args.onOpenChange).toHaveBeenCalledTimes(4);
    await expect(args.onOpenChange).toHaveBeenLastCalledWith(false);
    await expect(args.onSave).toHaveBeenCalledTimes(1);
    await expectFocus(canvas.getByRole('button', { name: 'Edit Project name: Apollo 2' }));
  },
};

export const LeaveSaves: Story = {
  args: { onValueChange: fn() },
  render: (args) => (
    <>
      <button style={FIXTURE_BUTTON} type="button">Before</button>
      <InlineEdit {...args} />
      <button style={FIXTURE_BUTTON} type="button">After</button>
    </>
  ),
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    const before = canvas.getByRole('button', { name: 'Before' });
    const after = canvas.getByRole('button', { name: 'After' });

    // Tab forward through Save and Cancel, then out: one save, focus stays where it went.
    await userEvent.click(canvas.getByRole('button', { name: /^Edit/ }));
    await userEvent.keyboard(' 2');
    await userEvent.tab();
    await userEvent.tab();
    await expect(args.onSave).not.toHaveBeenCalled();
    await userEvent.tab();
    await expect(args.onSave).toHaveBeenCalledTimes(1);
    await expect(args.onSave).toHaveBeenLastCalledWith('Apollo 2');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(after.ownerDocument.activeElement).toBe(after);

    // Shift+Tab out of the editor saves the same way.
    await userEvent.tab({ shift: true });
    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard('Zeus');
    await userEvent.tab({ shift: true });
    await expect(args.onSave).toHaveBeenCalledTimes(2);
    await expect(args.onSave).toHaveBeenLastCalledWith('Zeus');
    await expect(before.ownerDocument.activeElement).toBe(before);

    // An outside press saves without moving focus back.
    await userEvent.click(canvas.getByRole('button', { name: /^Edit/ }));
    await userEvent.keyboard('!');
    await userEvent.click(canvasElement.ownerDocument.body);
    await expect(args.onSave).toHaveBeenCalledTimes(3);
    await expect(args.onSave).toHaveBeenLastCalledWith('Zeus!');
    await expect(canvas.getByRole('button', { name: 'Edit Project name: Zeus!' })).not.toBe(
      canvasElement.ownerDocument.activeElement,
    );

    // A window blur leaves the editor focused in its document: no save.
    await userEvent.click(canvas.getByRole('button', { name: /^Edit/ }));
    await userEvent.keyboard('?');
    const editor = editorOf(canvasElement);
    fireEvent.focusOut(editor);
    await expect(editor.ownerDocument.activeElement).toBe(editor);
    await expect(args.onSave).toHaveBeenCalledTimes(3);
    await expect(args.onValueChange).toHaveBeenCalledTimes(3);
  },
};

export const NoBlurSave: Story = {
  args: { saveOnBlur: false, onOpenChange: fn() },
  render: (args) => (
    <>
      <InlineEdit {...args} />
      <button style={FIXTURE_BUTTON} type="button">After</button>
    </>
  ),
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: /^Edit/ }));
    await userEvent.keyboard(' 2');
    await userEvent.tab();
    await userEvent.tab();
    await userEvent.tab();
    const after = canvas.getByRole('button', { name: 'After' });
    await expect(after.ownerDocument.activeElement).toBe(after);
    await expect(args.onSave).not.toHaveBeenCalled();
    await expect(args.onOpenChange).toHaveBeenCalledTimes(1);
    await expect(editorOf(canvasElement)).toHaveValue('Apollo 2');
  },
};

export const Multiline: Story = {
  args: { multiline: true, variant: 'body', label: 'Description', defaultValue: 'Line one', onValueChange: fn() },
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    await userEvent.tab();
    await userEvent.keyboard('{Enter}');
    const editor = canvas.getByRole('textbox', { name: 'Description' });
    await expect(editor.tagName).toBe('TEXTAREA');
    await expect(editor).toHaveAccessibleDescription(
      'Press Enter to save, Shift+Enter for a new line, Escape to cancel.',
    );
    await userEvent.keyboard('{End}{Shift>}{Enter}{/Shift}Line two');
    await expect(editor).toHaveValue('Line one\nLine two');
    await expect(args.onSave).not.toHaveBeenCalled();
    await userEvent.keyboard('{Enter}');
    await expect(args.onSave).toHaveBeenCalledTimes(1);
    await expect(args.onSave).toHaveBeenLastCalledWith('Line one\nLine two');
    await expect(args.onValueChange).toHaveBeenLastCalledWith('Line one\nLine two');
    // Resting text keeps the newline.
    const trigger = canvas.getByRole('button', { name: /^Edit Description/ });
    await expect(trigger.textContent).toBe('Line one\nLine two');
    await expect(rootOf(canvasElement)).toHaveAttribute('data-state', 'closed');
  },
};

export const Composition: Story = {
  args: { onOpenChange: fn() },
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    await userEvent.tab();
    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard('Zeus');
    const editor = editorOf(canvasElement);
    fireEvent.compositionStart(editor);
    fireEvent.keyDown(editor, { key: 'Enter' });
    fireEvent.keyDown(editor, { key: 'Escape' });
    fireEvent.focusOut(editor, { relatedTarget: canvasElement.ownerDocument.body });
    await expect(args.onSave).not.toHaveBeenCalled();
    await expect(args.onOpenChange).toHaveBeenCalledTimes(1);
    fireEvent.compositionEnd(editor);
    // A keydown reported as composing (isComposing / keyCode 229) is also ignored.
    fireEvent.keyDown(editor, { key: 'Enter', isComposing: true });
    fireEvent.keyDown(editor, { key: 'Enter', keyCode: 229 });
    await expect(args.onSave).not.toHaveBeenCalled();
    await userEvent.keyboard('{Enter}');
    await expect(args.onSave).toHaveBeenCalledTimes(1);
    await expect(args.onSave).toHaveBeenLastCalledWith('Zeus');
  },
};

export const Open: Story = {
  args: { defaultOpen: true, description: 'Shown in the sidebar.' },
  play: async ({ canvas, canvasElement }) => {
    const editor = canvas.getByRole('textbox', { name: 'Project name' });
    await expect(editor).toHaveValue('Apollo');
    // Mounting open never moves focus.
    await expect(editor.ownerDocument.activeElement).not.toBe(editor);
    await expect(editor).toHaveAccessibleDescription('Press Enter to save, Escape to cancel. Shown in the sidebar.');
    await expect(rootOf(canvasElement)).toHaveAttribute('data-state', 'open');
    for (const name of ['Save', 'Cancel']) {
      const action = canvas.getByRole('button', { name });
      await expect(action).toHaveAttribute('type', 'button');
      const box = action.getBoundingClientRect();
      await expect([box.width, box.height]).toEqual([32, 32]);
    }
  },
};

export const ValidationError: Story = {
  args: {
    validate: (next: string) => (next.trim() ? null : 'Enter a name'),
    onValueChange: fn(),
    onOpenChange: fn(),
  },
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.tab();
    await userEvent.keyboard('{Enter}');
    const editor = canvas.getByRole('textbox');
    await userEvent.keyboard('{Backspace}   {Enter}');
    await expect(args.onSave).not.toHaveBeenCalled();
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await expect(args.onOpenChange).toHaveBeenCalledTimes(1);
    const alert = canvas.getByRole('alert');
    await expect(alert).toHaveTextContent('Enter a name');
    await expect(editor).toHaveAttribute('aria-invalid', 'true');
    await expect(editor.getAttribute('aria-describedby')!.split(' ')).toContain(alert.id);
    await expectFocus(editor);
  },
};

export const ExternalError: Story = {
  args: { defaultOpen: true, error: 'That name is taken.', onValueChange: fn() },
  play: async ({ canvas, userEvent, args }) => {
    const editor = canvas.getByRole('textbox');
    await userEvent.click(editor);
    await userEvent.keyboard('{End} 2{Enter}');
    // The external error blocks the save until the parent clears it.
    await expect(args.onSave).not.toHaveBeenCalled();
    await expect(editor).toHaveAttribute('aria-invalid', 'true');
    await expect(canvas.getByRole('alert')).toHaveTextContent('That name is taken.');
  },
};

export const Saving: Story = {
  args: { onSave: fn(() => new Promise<void>(() => {})) },
  play: async ({ canvas, canvasElement, userEvent }) => {
    await userEvent.tab();
    await userEvent.keyboard('{Enter}Zeus{Enter}');
    await expect(rootOf(canvasElement)).toHaveAttribute('aria-busy', 'true');
    await expect(canvas.getByRole('textbox')).toHaveAttribute('readonly');
    await expect(canvas.getByRole('button', { name: 'Save' })).toHaveAttribute('aria-disabled', 'true');
    await expect(canvas.getByRole('button', { name: 'Cancel' })).toHaveAttribute('aria-disabled', 'true');
    await expect(canvas.getByRole('status')).toHaveTextContent('Saving…');
  },
};

export const Saved: Story = {
  play: async ({ canvas, canvasElement, userEvent }) => {
    await userEvent.tab();
    await userEvent.keyboard('{Enter}Zeus{Enter}');
    await expect(rootOf(canvasElement)).toHaveAttribute('data-phase', 'saved');
    await expect(canvas.getByRole('status')).toHaveTextContent('Saved');
    await expect(canvas.getByRole('button', { name: 'Edit Project name: Zeus' })).toBeVisible();
  },
};

export const Failed: Story = {
  args: { onSave: fn(() => Promise.reject(new Error('Offline'))), onValueChange: fn(), onOpenChange: fn() },
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    const onSave = args.onSave as Spy;
    await userEvent.tab();
    await userEvent.keyboard('{Enter}Zeus{Enter}');
    await waitFor(() => expect(canvas.getByRole('status')).toHaveTextContent('Could not save. Try again.'));
    const editor = canvas.getByRole('textbox');
    await expect(rootOf(canvasElement)).toHaveAttribute('data-phase', 'failed');
    await expect(editor).toHaveValue('Zeus');
    await expect(editor).not.toHaveAttribute('readonly');
    await expectFocus(editor);
    // A throwing save fails the same way; Enter tries again with the kept draft.
    onSave.mockImplementation(() => {
      throw new Error('Offline');
    });
    await userEvent.keyboard('{Enter}');
    await expect(onSave).toHaveBeenCalledTimes(2);
    await expect(onSave).toHaveBeenLastCalledWith('Zeus');
    await expect(rootOf(canvasElement)).toHaveAttribute('data-phase', 'failed');
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await expect(args.onOpenChange).toHaveBeenCalledTimes(1);
    await expect(canvas.queryByRole('button', { name: 'Retry save' })).toBeNull();
  },
};

export const Retry: Story = {
  args: { onSave: fn(() => Promise.reject(new Error('Offline'))), onValueChange: fn(), onOpenChange: fn() },
  render: (args) => <ParentControls {...args} />,
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    const onSave = args.onSave as Spy;
    const save = deferred();
    onSave.mockImplementationOnce(() => save.promise);
    await userEvent.tab();
    await userEvent.keyboard('{Enter}{Backspace}{Enter}');
    await expect(onSave).toHaveBeenLastCalledWith('');
    // The parent closes the editor mid-save; focus stays where the parent's control put it.
    const close = canvas.getByRole('button', { name: 'Close editor' });
    await userEvent.click(close);
    await expect(canvas.queryByRole('textbox')).toBeNull();
    save.reject(new Error('Offline'));
    const retry = await canvas.findByRole('button', { name: 'Retry save' });
    await expect(close.ownerDocument.activeElement).toBe(close);
    await expect(canvas.getByRole('button', { name: 'Edit Project name: Apollo' })).toBeVisible();
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await expect(args.onOpenChange).toHaveBeenCalledTimes(1);
    // Retry resaves the failed draft, even an empty one; this attempt fails again.
    await userEvent.click(retry);
    await expect(onSave).toHaveBeenCalledTimes(2);
    await expect(onSave).toHaveBeenLastCalledWith('');
    await waitFor(() => expect(rootOf(canvasElement)).toHaveAttribute('data-phase', 'failed'));
    await expect(canvas.getByRole('button', { name: 'Retry save' })).toBeVisible();
    await expect(canvas.getByRole('status')).toHaveTextContent('Could not save. Try again.');
    await expect(args.onValueChange).not.toHaveBeenCalled();
  },
};

export const RetryResolves: Story = {
  args: { onSave: fn(() => Promise.reject(new Error('Offline'))), onValueChange: fn(), onOpenChange: fn() },
  render: (args) => <ParentControls {...args} />,
  play: async ({ canvas, userEvent, args }) => {
    const onSave = args.onSave as Spy;
    const save = deferred();
    onSave.mockImplementationOnce(() => save.promise);
    await userEvent.tab();
    await userEvent.keyboard('{Enter}{Backspace}{Enter}');
    await userEvent.click(canvas.getByRole('button', { name: 'Close editor' }));
    save.reject(new Error('Offline'));
    const retry = await canvas.findByRole('button', { name: 'Retry save' });
    onSave.mockImplementation(() => Promise.resolve());
    await userEvent.click(retry);
    const trigger = await canvas.findByRole('button', { name: 'Edit Project name' });
    await expect(trigger).not.toHaveAttribute('aria-label');
    await expect(onSave).toHaveBeenCalledTimes(2);
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith('');
    // Retry leaves with its success; focus continues to the value instead of the page.
    await expect(canvas.queryByRole('button', { name: 'Retry save' })).toBeNull();
    await expectFocus(trigger);
    // Settling never reopens the editor.
    await expect(canvas.queryByRole('textbox')).toBeNull();
    await expect(args.onOpenChange).toHaveBeenCalledTimes(1);
  },
};

export const Controlled: Story = {
  args: { onValueChange: fn(), onOpenChange: fn() },
  render: (args) => <ControlledField {...args} />,
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.tab();
    await userEvent.keyboard('{Enter}');
    await expectFocus(canvas.getByRole('textbox'));
    await userEvent.keyboard('Zeus{Enter}');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onOpenChange).toHaveBeenCalledTimes(2);
    await expect(canvas.getByTestId('value')).toHaveTextContent('Zeus');
    await expectFocus(canvas.getByRole('button', { name: 'Edit Project name: Zeus' }));
  },
};

export const Uncontrolled: Story = {
  args: { onValueChange: fn() },
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Edit Project name: Apollo' }));
    await userEvent.keyboard(' 2{Enter}');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(canvas.getByRole('button', { name: 'Edit Project name: Apollo 2' })).toBeVisible();
    // Reopening starts from the new persisted value.
    await userEvent.keyboard('{Enter}');
    await expect(canvas.getByRole('textbox')).toHaveValue('Apollo 2');
  },
};

export const RejectedOpen: Story = {
  args: { open: false, onOpenChange: fn() },
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.tab();
    await userEvent.keyboard('{Enter}');
    await expect(args.onOpenChange).toHaveBeenCalledTimes(1);
    await expect(args.onOpenChange).toHaveBeenLastCalledWith(true);
    await expect(canvas.queryByRole('textbox')).toBeNull();
    await expectFocus(canvas.getByRole('button', { name: 'Edit Project name: Apollo' }));
  },
};

export const RejectedClose: Story = {
  args: { open: true, value: 'Apollo', defaultValue: undefined, onValueChange: fn(), onOpenChange: fn() },
  play: async ({ canvas, userEvent, args }) => {
    const editor = canvas.getByRole('textbox');
    await userEvent.click(editor);
    await userEvent.keyboard('{End} 2{Escape}');
    await expect(args.onOpenChange).toHaveBeenCalledTimes(1);
    await expect(args.onOpenChange).toHaveBeenLastCalledWith(false);
    // The rejected close keeps a focusable editor with the persisted value.
    await expect(editor).toHaveValue('Apollo');
    await expectFocus(editor);
    await userEvent.keyboard('{End} 2{Enter}');
    await expect(args.onSave).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith('Apollo 2');
    await expect(args.onOpenChange).toHaveBeenCalledTimes(2);
    // The parent kept "Apollo": the open editor shows what is persisted, not the rejected text.
    await expect(editor).toHaveValue('Apollo');
    await expectFocus(editor);
  },
};

export const RejectedValue: Story = {
  args: { value: 'Apollo', defaultValue: undefined, onValueChange: fn(), onOpenChange: fn() },
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.tab();
    await userEvent.keyboard('{Enter}Zeus{Enter}');
    await expect(args.onSave).toHaveBeenLastCalledWith('Zeus');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith('Zeus');
    // The parent did not accept the value: the trigger keeps the persisted text.
    await expectFocus(canvas.getByRole('button', { name: 'Edit Project name: Apollo' }));
    await expect(args.onOpenChange).toHaveBeenCalledTimes(2);
  },
};

export const ExternalUpdateWhileEditing: Story = {
  args: { onValueChange: fn() },
  render: (args) => <ExternalValueField {...args} />,
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.tab();
    await userEvent.keyboard('{Enter}Zeus');
    await userEvent.click(canvas.getByRole('button', { name: 'Rename to Hermes' }));
    // The draft is left alone; cancel then shows the latest persisted value.
    const editor = canvas.getByRole('textbox');
    await expect(editor).toHaveValue('Zeus');
    await expectFocus(editor);
    await userEvent.keyboard('{Escape}');
    await expectFocus(canvas.getByRole('button', { name: 'Edit Project name: Hermes' }));
    await userEvent.keyboard('{Enter}');
    await expect(canvas.getByRole('textbox')).toHaveValue('Hermes');
    await expect(args.onSave).not.toHaveBeenCalled();
    await expect(args.onValueChange).not.toHaveBeenCalled();
  },
};

export const StaleSave: Story = {
  args: { onValueChange: fn(), onOpenChange: fn() },
  render: (args) => <ExternalValueField {...args} />,
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    const save = deferred();
    (args.onSave as Spy).mockImplementation(() => save.promise);
    await userEvent.tab();
    await userEvent.keyboard('{Enter}Zeus{Enter}');
    await expect(rootOf(canvasElement)).toHaveAttribute('data-phase', 'saving');
    await userEvent.click(canvas.getByRole('button', { name: 'Rename to Hermes' }));
    // The external update drops the pending save: the editor is editable again.
    const editor = canvas.getByRole('textbox');
    await expect(rootOf(canvasElement)).toHaveAttribute('data-phase', 'idle');
    await expect(editor).not.toHaveAttribute('readonly');
    save.resolve();
    await save.promise;
    await new Promise((resolve) => setTimeout(resolve, 0));
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await expect(args.onOpenChange).toHaveBeenCalledTimes(1);
    await expect(editor).toHaveValue('Zeus');
    await expect(rootOf(canvasElement)).toHaveAttribute('data-phase', 'idle');
  },
};

export const UnmountWhileSaving: Story = {
  args: { onValueChange: fn(), onOpenChange: fn() },
  render: (args) => <ParentControls {...args} />,
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    const save = deferred();
    (args.onSave as Spy).mockImplementation(() => save.promise);
    await userEvent.tab();
    await userEvent.keyboard('{Enter}Zeus{Enter}');
    await userEvent.click(canvas.getByRole('button', { name: 'Remove widget' }));
    await expect(rootOf(canvasElement)).toBeNull();
    save.resolve();
    await save.promise;
    await new Promise((resolve) => setTimeout(resolve, 0));
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await expect(args.onOpenChange).toHaveBeenCalledTimes(1);
  },
};

export const Disabled: Story = {
  args: { disabled: true, onOpenChange: fn() },
  play: async ({ canvas, userEvent, args }) => {
    const trigger = canvas.getByRole('button', { name: 'Edit Project name: Apollo' });
    await expect(trigger).toBeDisabled();
    await userEvent.click(trigger);
    await expect(args.onOpenChange).not.toHaveBeenCalled();
    await expect(canvas.queryByRole('textbox')).toBeNull();
  },
};

export const ReadOnly: Story = {
  args: { readOnly: true, onOpenChange: fn() },
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.tab();
    const trigger = canvas.getByRole('button', { name: 'Edit Project name: Apollo' });
    await expectFocus(trigger);
    await expect(trigger).toHaveAttribute('aria-disabled', 'true');
    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard(' ');
    await userEvent.click(trigger);
    await expect(args.onOpenChange).not.toHaveBeenCalled();
    await expect(canvas.queryByRole('textbox')).toBeNull();
  },
};

export const Title: Story = { args: { variant: 'title' } };

export const Body: Story = {
  args: { variant: 'body', label: 'Summary', defaultValue: 'Ships the rename flow.' },
  render: (args) => (
    <>
      <InlineEdit {...args} />
      <InlineEdit {...args} label="Heading" variant="title" />
    </>
  ),
  play: async ({ canvas }) => {
    const body = canvas.getByRole('button', { name: /^Edit Summary/ });
    const title = canvas.getByRole('button', { name: /^Edit Heading/ });
    await expect(parseFloat(getComputedStyle(title).fontSize)).toBeGreaterThan(
      parseFloat(getComputedStyle(body).fontSize),
    );
    await expect(getComputedStyle(title).fontWeight).toBe('500');
    await expect(getComputedStyle(body).fontWeight).toBe('400');
  },
};

export const Sizes: Story = {
  args: { variant: 'body' },
  render: (args) => (
    <>
      {sizes.map((size) => (
        <InlineEdit key={size} {...args} size={size} label={`Name ${size}`} />
      ))}
      {sizes.map((size) => (
        <InlineEdit key={`open-${size}`} {...args} size={size} label={`Open ${size}`} defaultOpen />
      ))}
    </>
  ),
  play: async ({ canvas }) => {
    for (const size of sizes) {
      const trigger = canvas.getByRole('button', { name: new RegExp(`^Edit Name ${size}`) });
      await expect(trigger.getBoundingClientRect().height).toBeGreaterThanOrEqual(minHeights[size]);
      const editor = canvas.getByRole('textbox', { name: `Open ${size}` });
      await expect(editor.getBoundingClientRect().height).toBeGreaterThanOrEqual(minHeights[size]);
      const save = canvas.getAllByRole('button', { name: 'Save' })[sizes.indexOf(size)]!;
      const box = save.getBoundingClientRect();
      await expect([box.width, box.height]).toEqual([actionSizes[size], actionSizes[size]]);
    }
  },
};

export const Empty: Story = {
  args: { defaultValue: '', placeholder: 'Untitled project', inputPlaceholder: 'Name the project' },
  play: async ({ canvas, userEvent }) => {
    // The visible placeholder is part of the name.
    const trigger = canvas.getByRole('button', { name: 'Edit Project name Untitled project' });
    await expect(trigger).not.toHaveAttribute('aria-label');
    const box = trigger.getBoundingClientRect();
    await expect(box.width).toBeGreaterThanOrEqual(40);
    await expect(box.height).toBeGreaterThanOrEqual(40);
    await userEvent.click(trigger);
    await expect(canvas.getByRole('textbox')).toHaveAttribute('placeholder', 'Name the project');
  },
};

const LONG_VALUE =
  'Quarterly infrastructure migration and observability overhaul for the payments platform, phase two';
export const LongText: Story = {
  args: { defaultValue: LONG_VALUE },
  render: (args) => (
    <div css={narrowStyle}>
      <InlineEdit {...args} />
      <InlineEdit {...args} label="Open name" defaultOpen />
    </div>
  ),
  play: async ({ canvas, canvasElement }) => {
    const [resting, open] = Array.from(canvasElement.querySelectorAll<HTMLElement>('[data-ui="inline-edit"]'));
    const trigger = canvas.getByRole('button', { name: /^Edit Project name/ });
    // Long text wraps inside the widget instead of overflowing it.
    await expect(trigger.getBoundingClientRect().width).toBeLessThanOrEqual(resting!.getBoundingClientRect().width);
    await expect(trigger.getBoundingClientRect().height).toBeGreaterThan(60);
    await expect(resting!.scrollWidth).toBeLessThanOrEqual(resting!.clientWidth);
    // At this width the actions wrap onto their own row below the editor.
    const editor = canvas.getByRole('textbox');
    const save = canvas.getByRole('button', { name: 'Save' });
    await expect(save.getBoundingClientRect().top).toBeGreaterThanOrEqual(editor.getBoundingClientRect().bottom);
    await expect(open!.scrollWidth).toBeLessThanOrEqual(open!.clientWidth);
  },
};

export const HeadingContext: Story = {
  render: (args) => (
    <section aria-labelledby="project-heading">
      <h2 id="project-heading" style={{ margin: 0, fontSize: vars.textSize.sm, color: vars.color.textMuted }}>
        Project
      </h2>
      <InlineEdit {...args} />
    </section>
  ),
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.getByRole('heading', { level: 2, name: 'Project' })).toBeVisible();
    await expect(rootOf(canvasElement).closest('h1, h2, h3, h4, h5, h6')).toBeNull();
  },
};

export const ExternalAria: Story = {
  args: { defaultOpen: true, description: 'Shown in the sidebar.' },
  render: (args) => (
    <>
      <span id="inline-extra-name">for the launch</span>
      <span id="inline-extra-help">Visible to the team.</span>
      <InlineEdit
        {...args}
        error="That name is taken."
        controlProps={{
          'aria-labelledby': 'inline-extra-name',
          'aria-describedby': 'inline-extra-help inline-missing',
          'aria-invalid': 'grammar',
        }}
      />
      <InlineEdit
        {...args}
        label="Codename"
        controlProps={{ 'aria-label': 'Launch codename', 'aria-invalid': 'grammar' }}
      />
    </>
  ),
  play: async ({ canvas, canvasElement }) => {
    const [first, second] = Array.from(canvasElement.querySelectorAll<HTMLInputElement>('input'));
    const labelledBy = first!.getAttribute('aria-labelledby')!.split(' ');
    await expect(labelledBy).toContain('inline-extra-name');
    await expect(first).toHaveAccessibleName('Project name for the launch');
    const describedBy = first!.getAttribute('aria-describedby')!.split(' ');
    await expect(describedBy.slice(0, 2)).toEqual(['inline-extra-help', 'inline-missing']);
    await expect(describedBy).toHaveLength(5);
    // The unresolved reference stays in the attribute; the description uses the resolved ones.
    await expect(first).toHaveAccessibleDescription(
      'Visible to the team. Press Enter to save, Escape to cancel. Shown in the sidebar. That name is taken.',
    );
    // An error forces invalid; without one the consumer's value is kept.
    await expect(first).toHaveAttribute('aria-invalid', 'true');
    await expect(second).toHaveAttribute('aria-invalid', 'grammar');
    await expect(second).toHaveAccessibleName('Launch codename');
    await expect(second).toHaveAttribute('aria-label', 'Launch codename');
    await expect(second).not.toHaveAttribute('aria-labelledby');
    await expect(canvas.getAllByRole('alert')).toHaveLength(1);
  },
};

export const FalsyNodes: Story = {
  render: (args) => (
    <>
      <InlineEdit {...args} label="Zero" defaultValue="" placeholder={0} description={0} error={0} editIcon={0} />
      <InlineEdit {...args} label="False" placeholder={false} description={false} error={false} editIcon={false} />
      <InlineEdit {...args} label="Null" placeholder={null} description={null} error={null} editIcon={null} />
      <InlineEdit {...args} label="Empty" placeholder="" description="" error="" editIcon="" />
      {[false, null, ''].map((node, index) => (
        <InlineEdit key={index} {...args} label={`Blank ${index}`} defaultValue="" placeholder={node} />
      ))}
      <InlineEdit {...args} label="Icons" defaultOpen saveIcon={null} cancelIcon={false} />
    </>
  ),
  play: async ({ canvas, canvasElement }) => {
    const zero = canvas.getByRole('button', { name: 'Edit Zero 0' });
    await expect(zero.querySelector('[aria-hidden]')).toHaveTextContent('0');
    await expect(zero).toHaveAccessibleDescription('0 0');
    for (const name of ['False', 'Null']) {
      const trigger = canvas.getByRole('button', { name: `Edit ${name}: Apollo` });
      await expect(trigger).not.toHaveAttribute('aria-describedby');
      await expect(trigger.querySelector('[aria-hidden]')).toBeNull();
    }
    const empty = canvas.getByRole('button', { name: 'Edit Empty: Apollo' });
    for (const id of empty.getAttribute('aria-describedby')!.split(' ')) {
      await expect(canvasElement.ownerDocument.getElementById(id)).not.toBeNull();
    }
    await expect(canvas.getAllByRole('alert')).toHaveLength(2);
    // An empty value without a renderable placeholder is named by the edit text alone.
    for (const index of [0, 1, 2]) {
      await expect(canvas.getByRole('button', { name: `Edit Blank ${index}` })).not.toHaveAttribute('aria-label');
    }
    for (const name of ['Save', 'Cancel']) {
      const action = canvas.getByRole('button', { name });
      await expect(action).toBeEmptyDOMElement();
      await expect(action.getBoundingClientRect().width).toBe(32);
    }
    const ids = Array.from(canvasElement.querySelectorAll('[id]'), (node) => node.id);
    await expect(new Set(ids).size).toBe(ids.length);
  },
};

const triggerSlotStyle = css({ color: vars.color.accentText });
const rootCssStyle = css({ paddingInline: vars.space[2] });
const rootSxStyle = css({ paddingInline: vars.space[6] });
export const RefAndStyles: Story = {
  args: { ref: fn(), controlRef: fn() },
  render: (args) => (
    <InlineEdit
      {...args}
      css={rootCssStyle}
      sx={rootSxStyle}
      className="consumer-root"
      slotProps={{ trigger: { css: triggerSlotStyle, className: 'consumer-trigger' } }}
    />
  ),
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    const root = rootOf(canvasElement);
    const rootRef = args.ref as Spy;
    await expect(rootRef.mock.calls.at(-1)?.[0]).toBe(root);
    await expect(root).toHaveClass('consumer-root');
    // Own styles → slotProps → css → sx: sx wins over css.
    await expect(getComputedStyle(root).paddingInlineStart).toBe('24px');
    const trigger = canvas.getByRole('button', { name: /^Edit/ });
    await expect(trigger).toHaveClass('consumer-trigger');
    const probe = canvasElement.ownerDocument.createElement('span');
    probe.style.color = vars.color.accentText;
    root.append(probe);
    await expect(getComputedStyle(trigger).color).toBe(getComputedStyle(probe).color);
    probe.remove();

    const controlRef = args.controlRef as Spy;
    await expect(controlRef).not.toHaveBeenCalledWith(expect.anything());
    await userEvent.click(trigger);
    const editor = canvas.getByRole('textbox');
    await expect(controlRef.mock.calls.at(-1)?.[0]).toBe(editor);
    await userEvent.keyboard('{Escape}');
    await expect(controlRef.mock.calls.at(-1)?.[0]).toBeNull();
  },
};

export const FormReset: Story = {
  args: { defaultOpen: true, saveOnBlur: false, onValueChange: fn(), controlProps: { name: 'project' } },
  render: (args) => (
    <form onSubmit={(event) => event.preventDefault()} data-testid="form">
      <InlineEdit {...args} />
      <button style={FIXTURE_BUTTON} type="reset">Reset form</button>
    </form>
  ),
  play: async ({ canvas, userEvent, args }) => {
    const form = canvas.getByTestId('form') as HTMLFormElement;
    const submit = fn();
    form.addEventListener('submit', submit);
    const editor = canvas.getByRole('textbox');
    await userEvent.click(editor);
    await userEvent.keyboard('{End} 2');
    await expect(new FormData(form).get('project')).toBe('Apollo 2');
    await userEvent.click(canvas.getByRole('button', { name: 'Reset form' }));
    await waitFor(() => expect(editor).toHaveValue('Apollo'));
    await expect(args.onSave).not.toHaveBeenCalled();
    await expect(args.onValueChange).not.toHaveBeenCalled();
    // Enter saves instead of submitting the form.
    await userEvent.click(editor);
    await userEvent.keyboard('{End} 3{Enter}');
    await expect(args.onSave).toHaveBeenCalledTimes(1);
    await expect(submit).not.toHaveBeenCalled();
    form.removeEventListener('submit', submit);
  },
};

export const LightTheme: Story = {
  decorators: [withLightTheme],
  globals: { theme: 'light' },
  render: (args) => (
    <>
      <InlineEdit {...args} description="Shown in the sidebar." />
      <InlineEdit {...args} label="Open name" defaultOpen error="That name is taken." />
    </>
  ),
};

export const RTL: Story = {
  args: { dir: 'rtl', label: 'שם הפרויקט', defaultValue: 'אפולו', onValueChange: fn() },
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    const root = rootOf(canvasElement);
    await expect(root).toHaveAttribute('dir', 'rtl');
    await userEvent.tab();
    await userEvent.keyboard('{Enter}');
    const editor = canvas.getByRole('textbox');
    await expect(getComputedStyle(editor).direction).toBe('rtl');
    // Actions sit at the inline end, which is the left in RTL.
    const save = canvas.getByRole('button', { name: 'Save' });
    await expect(save.getBoundingClientRect().right).toBeLessThanOrEqual(editor.getBoundingClientRect().left);
    await userEvent.keyboard('זאוס{Enter}');
    await expect(args.onValueChange).toHaveBeenLastCalledWith('זאוס');
    await expectFocus(canvas.getByRole('button', { name: /זאוס/ }));
  },
};

export const ForcedColors: Story = {
  render: (args) => (
    <>
      <InlineEdit {...args} />
      <InlineEdit {...args} label="Open name" defaultOpen />
    </>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Manual check: enable the forced-colors setting in the browser (see docs/qa-gates.md). Not automated here.',
      },
    },
  },
};

export const ReducedMotion: Story = {
  args: { onSave: fn(() => new Promise<void>(() => {})) },
  parameters: {
    docs: {
      description: {
        story:
          'Manual check: enable prefers-reduced-motion: reduce in the browser (see docs/qa-gates.md), then save to see the static busy indicator. Not automated here.',
      },
    },
  },
};
