import {
  FieldReplacementRoot,
  FieldSugarRoot,
  FieldReplacementLabel,
  fieldRootStyles,
  expectFieldSlotCustomization,
} from '../../testing/field-slot-fixtures';
import { useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fireEvent, fn, waitFor, within } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { base } from '@jfrader/tokens';
import { css } from '../../styling/css';
import { withLightTheme } from '../../testing/story-decorators';
import { InlineEdit, type InlineEditProps } from './index';
// `styled` is the app-facing styling API; consumers import it from `@jfrader/ui`.
import { styled } from '../../index';

// Raw fixture buttons must pass the global target-size (WCAG 2.5.8) axe gate in every environment.
const FixtureButton = styled.button({ minBlockSize: vars.space[6], minInlineSize: vars.space[6], paddingBlock: vars.space[1], paddingInline: `calc(${vars.space[5]} / 2)`, boxSizing: 'border-box' });

// The iframe sizing probe has neither the parent stylesheet nor its custom properties.
function sizeFrameTarget(button: HTMLButtonElement | null) {
  if (!button) return;
  button.style.minBlockSize = base.space[6];
  button.style.minInlineSize = base.space[6];
  button.style.paddingBlock = base.space[1];
  button.style.paddingInline = `calc(${base.space[5]} / 2)`;
  button.style.boxSizing = 'border-box';
}

const sizes = ['sm', 'md', 'lg'] as const;
const variants = ['title', 'body'] as const;
// Button's block size per size, in px: the one height the value, editor and actions share.
const blockSizes = { sm: parseFloat(base.space[8]), md: parseFloat(base.space[10]), lg: parseFloat(base.space[12]) };
const Frame = styled.div({ display: 'grid', gap: vars.space[4], inlineSize: 'min(100%, 420px)' });
const Narrow = styled.div({ inlineSize: '220px' });

const saveSource = `import { InlineEdit, type InlineEditProps } from '@jfrader/ui';

export function ProjectName({ save }: { save: InlineEditProps['onSave'] }) {
  return <InlineEdit label="Project name" defaultValue="Apollo" onSave={save} />;
}`;
const parentSource = `import { useState } from 'react';
import { Button, InlineEdit, type InlineEditProps } from '@jfrader/ui';

export function ProjectName({ save }: { save: InlineEditProps['onSave'] }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(true);
  return <>
    {mounted && <InlineEdit label="Project name" defaultValue="Apollo"
      open={open} onOpenChange={setOpen} onSave={save} />}
    <Button onClick={() => setOpen(false)}>Close editor</Button>
    <Button onClick={() => setMounted(false)}>Remove widget</Button>
  </>;
}`;
const deferredOpenSource = `import { useState } from 'react';
import { Button, InlineEdit, styled, theme, type InlineEditProps } from '@jfrader/ui';

const Notes = styled.p({ margin: 0, color: theme.color.text });

export function ProjectName({ save }: { save: InlineEditProps['onSave'] }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<boolean | null>(null);
  return <>
    <InlineEdit label="Project name" defaultValue="Apollo" open={open}
      onOpenChange={setPending} onSave={save} />
    <Button onMouseDown={event => event.preventDefault()} onClick={() => {
      if (pending !== null) setOpen(pending);
      setPending(null);
    }}>Apply request</Button>
    <Button>Elsewhere</Button>
    <Notes>Release notes</Notes>
  </>;
}`;
const externalValueSource = `import { useState } from 'react';
import { Button, InlineEdit, type InlineEditProps } from '@jfrader/ui';

export function ProjectName({ save }: { save: InlineEditProps['onSave'] }) {
  const [name, setName] = useState('Apollo');
  return <>
    <InlineEdit label="Project name" value={name} onValueChange={setName} onSave={save} />
    <Button onMouseDown={event => event.preventDefault()} onClick={() => setName('Hermes')}>
      Rename to Hermes
    </Button>
  </>;
}`;

const ProjectHeading = styled.h2({ margin: 0, fontSize: vars.textSize.sm, color: vars.color.textMuted });

const meta = {
  title: 'Inputs/InlineEdit',
  component: InlineEdit,
  tags: ['autodocs'],
  args: { label: 'Project name', defaultValue: 'Apollo', onSave: fn() },
  argTypes: {
    variant: { control: 'radio', options: ['title', 'body'] },
    size: { control: 'radio', options: sizes },
  },
  decorators: [(Story) => <Frame><Story /></Frame>],
  parameters: {
    docs: {
      sections: [
        { title: 'Edit in place', stories: ['Default', 'Multiline'] },
        { title: 'Save and validate', stories: ['Controlled', 'ValidationError'] },
      ],
      description: {
        component: 'Edit and save a value in place, such as a project name or title.',
      },
      usage: `- The value is a button; editing replaces it with an input or, with \`multiline\`, a textarea. Use TextField or Textarea for multi-field forms or fields that should stay editable.

### Saving

- A changed draft calls \`onSave(next)\`. After it resolves, the widget requests \`onValueChange(next)\`, then \`onOpenChange(false)\`. An unchanged draft closes without calling \`onSave\`.
- The trigger shows the persisted value. Controlled values keep their old text until the parent updates them. Implement optimistic updates outside the widget.
- While a returned promise is pending, Save shows a spinner and the status reads \`messages.saving\`.
- A thrown or rejected save keeps the draft open and shows \`messages.failed\` as the error: the editor is \`aria-invalid\` and described by it. Enter or Save retries; editing the draft clears it. If the parent closed the editor during the save, Retry resaves the failed draft.
- A parent that writes the saved value before the promise settles (an optimistic update) does not cancel the save.
- During a save, the editor is read-only and Save/Cancel are inert. An external \`value\` update or unmount discards the pending save; its result requests nothing.
- \`normalize\` converts the draft; nothing is trimmed by default. A message from \`validate\`, or an \`error\` prop, blocks saving.

### Keyboard and accessibility

- Enter or Space opens with the text selected. A pointer click places the caret at the end.
- Enter saves without submitting a surrounding form. Shift+Enter inserts a newline with \`multiline\`. Escape cancels. Tab/Shift+Tab follow the editor, Save, Cancel and page order.
- \`saveOnBlur\` defaults to saving when focus leaves the widget. Moving between its controls or switching windows does not save. IME composition bypasses Enter, Escape and leave-to-save.
- Keyboard or button save/cancel returns focus to the value after an accepted close. Leaving or a parent-driven close does not move focus.
- Do not nest the editor inside a heading. Render the heading separately from its edit control.`,
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
      <FixtureButton type="button" onMouseDown={keepFocus} onClick={() => setValue('Hermes')}>
        Rename to Hermes
      </FixtureButton>
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
      <FixtureButton type="button" onClick={() => setOpen(false)}>
        Close editor
      </FixtureButton>
      <FixtureButton type="button" onClick={() => setMounted(false)}>
        Remove widget
      </FixtureButton>
    </>
  );
}
ParentControls.displayName = 'ParentControlledInlineEdit';

/** The parent holds each open request and applies it only when Apply is pressed. */
function DeferredOpenField(props: InlineEditProps) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<boolean | null>(null);
  return (
    <>
      <InlineEdit
        {...props}
        open={open}
        onOpenChange={(next) => {
          props.onOpenChange?.(next);
          setPending(next);
        }}
      />
      <FixtureButton
        type="button"
        onMouseDown={keepFocus}
        onClick={() => {
          if (pending !== null) setOpen(pending);
          setPending(null);
        }}
      >
        Apply request
      </FixtureButton>
      <FixtureButton type="button">
        Elsewhere
      </FixtureButton>
      <p>Release notes</p>
    </>
  );
}
DeferredOpenField.displayName = 'DeferredOpenInlineEdit';

/** An enclosing layer that dismisses on Escape, counting the presses it receives. */
function EscapeLayer(props: InlineEditProps) {
  const [escapes, setEscapes] = useState(0);
  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') setEscapes((count) => count + 1);
  };
  return (
    <div onKeyDown={handleKeyDown}>
      <InlineEdit {...props} />
      <InlineEdit
        {...props}
        label="Vetoed"
        controlProps={{ onKeyDown: (event) => event.key === 'Escape' && event.preventDefault() }}
      />
      <output data-testid="layer-escapes">{escapes}</output>
    </div>
  );
}
EscapeLayer.displayName = 'EscapeLayerInlineEdit';

/** The parent can close the editor, report a conflict or tighten validation after a failed save. */
function RetryPolicyField(props: InlineEditProps) {
  const [open, setOpen] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [requireName, setRequireName] = useState(false);
  return (
    <>
      <InlineEdit
        {...props}
        open={open}
        onOpenChange={(next) => {
          props.onOpenChange?.(next);
          setOpen(next);
        }}
        error={conflict ? 'That name is taken.' : undefined}
        validate={requireName ? (next) => (next.trim() ? null : 'Enter a name') : undefined}
      />
      <FixtureButton type="button" onClick={() => setOpen(false)}>
        Close editor
      </FixtureButton>
      <FixtureButton type="button" aria-pressed={conflict} onClick={() => setConflict(!conflict)}>
        Report conflict
      </FixtureButton>
      <FixtureButton type="button" aria-pressed={requireName} onClick={() => setRequireName(true)}>
        Require a name
      </FixtureButton>
    </>
  );
}
RetryPolicyField.displayName = 'RetryPolicyInlineEdit';

/** Renders the widget into an iframe document, the other realm a focus target can come from. */
function FrameField(props: InlineEditProps) {
  const [body, setBody] = useState<HTMLElement | null>(null);
  return (
    <>
      <iframe title="Embedded editor" ref={(frame) => setBody(frame?.contentDocument?.body ?? null)} />
      {body &&
        createPortal(
          <>
            <InlineEdit {...props} />
            <button type="button" ref={sizeFrameTarget}>
              After
            </button>
          </>,
          body,
        )}
    </>
  );
}
FrameField.displayName = 'FrameInlineEdit';

export const Default: Story = {
  name: 'Project name',
  parameters: { docs: {
    description: { story: 'Select the project name to edit it, then save or cancel.' },
    source: { language: 'tsx', code: `import { InlineEdit, type InlineEditProps } from '@jfrader/ui';

export function ProjectName({ save }: { save: InlineEditProps['onSave'] }) {
  return <InlineEdit label="Project name" defaultValue="Apollo" onSave={save} />;
}` },
  } },
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
  parameters: {
    docs: {
      description: {
        story:
          'Enter or Space on the value opens the editor with the whole text selected. A pointer click opens it with the caret at the end instead (see Action Buttons).',
      },
    },
  },
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
    // Save is the pending indicator: Button's loading state, spinner and busy.
    await expect(saveButton).toHaveAttribute('aria-busy', 'true');
    await expect(cancelButton).toHaveAttribute('aria-disabled', 'true');
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
  parameters: {
    docs: {
      description: {
        story:
          'A pointer click on the value opens the editor with the caret at the end; Enter or Space selects the whole text instead (see Keyboard).',
      },
    },
  },
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
  parameters: { docs: { source: { language: 'tsx', code: `import { Button, InlineEdit, type InlineEditProps } from '@jfrader/ui';

export function ProjectName({ save }: { save: InlineEditProps['onSave'] }) {
  return <>
    <Button>Before</Button>
    <InlineEdit label="Project name" defaultValue="Apollo" onSave={save} />
    <Button>After</Button>
  </>;
}` } } },
  args: { onValueChange: fn() },
  render: (args) => (
    <>
      <FixtureButton type="button">Before</FixtureButton>
      <InlineEdit {...args} />
      <FixtureButton type="button">After</FixtureButton>
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

export const LeaveInFrame: Story = {
  parameters: { docs: { source: { language: 'tsx', code: `import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Button, InlineEdit, ThemeRoot, type InlineEditProps } from '@jfrader/ui';

export function EmbeddedProjectName({ save }: { save: InlineEditProps['onSave'] }) {
  const [body, setBody] = useState<HTMLElement | null>(null);
  return <>
    <iframe title="Embedded editor" ref={frame => setBody(frame?.contentDocument?.body ?? null)} />
    {body && createPortal(<ThemeRoot>
      <InlineEdit label="Project name" defaultValue="Apollo" onSave={save} />
      <Button>After</Button>
    </ThemeRoot>, body)}
  </>;
}` } } },
  args: { onValueChange: fn(), onOpenChange: fn() },
  render: (args) => <FrameField {...args} />,
  play: async ({ canvasElement, args }) => {
    const frame = canvasElement.querySelector('iframe')!;
    const frameDoc = frame.contentDocument!;
    const inFrame = within(frameDoc.body);
    await waitFor(() => expect(inFrame.getByRole('button', { name: 'Edit Project name: Apollo' })).toBeVisible());
    fireEvent.click(inFrame.getByRole('button', { name: 'Edit Project name: Apollo' }));
    const editor = inFrame.getByRole('textbox') as HTMLInputElement;
    await expect(frameDoc.activeElement).toBe(editor);
    fireEvent.change(editor, { target: { value: 'Zeus' } });

    // Focus moving to an action inside the frame is not a leave.
    inFrame.getByRole('button', { name: 'Save' }).focus();
    await expect(args.onSave).not.toHaveBeenCalled();
    await expect(args.onOpenChange).toHaveBeenCalledTimes(1);
    await expect(inFrame.getByRole('textbox')).toHaveValue('Zeus');

    // Focus moving past the widget in the frame is.
    const after = inFrame.getByRole('button', { name: 'After' });
    const box = after.getBoundingClientRect();
    await expect(box.width).toBeGreaterThanOrEqual(24);
    await expect(box.height).toBeGreaterThanOrEqual(24);
    after.focus();
    await expect(args.onSave).toHaveBeenCalledTimes(1);
    await expect(args.onSave).toHaveBeenLastCalledWith('Zeus');
    await expect(args.onValueChange).toHaveBeenLastCalledWith('Zeus');
    await expect(args.onOpenChange).toHaveBeenCalledTimes(2);
  },
};

export const NoBlurSave: Story = {
  parameters: { docs: { source: { language: 'tsx', code: `import { Button, InlineEdit, type InlineEditProps } from '@jfrader/ui';

export function ProjectName({ save }: { save: InlineEditProps['onSave'] }) {
  return <>
    <InlineEdit label="Project name" defaultValue="Apollo" saveOnBlur={false} onSave={save} />
    <Button>After</Button>
  </>;
}` } } },
  args: { saveOnBlur: false, onOpenChange: fn() },
  render: (args) => (
    <>
      <InlineEdit {...args} />
      <FixtureButton type="button">After</FixtureButton>
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
  name: 'Multiline description',
  parameters: {
    docs: {
      description: {
        story:
          'Edit a description and press Shift+Enter to add a line before saving.',
      },
      source: { language: 'tsx', code: `import { InlineEdit, type InlineEditProps } from '@jfrader/ui';

export function Description({ save }: { save: InlineEditProps['onSave'] }) {
  return <InlineEdit multiline variant="body" label="Description"
    defaultValue="Line one" onSave={save} />;
}` },
    },
  },
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
  tags: ['!autodocs'],
  parameters: {
    docs: {
      description: {
        story:
          'The value button uses "Edit Project name: Apollo" (`messages.edit({ label, value })`). The editor uses "Project name" (`label`).',
      },
    },
  },
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
      // Actions are the shared Button, square at the editor's block size.
      await expect(action).toHaveAttribute('data-ui', 'button');
      const box = action.getBoundingClientRect();
      await expect([box.width, box.height]).toEqual([blockSizes.md, blockSizes.md]);
    }
  },
};

export const ValidationError: Story = {
  name: 'Required name',
  parameters: { docs: {
    description: { story: 'Clear the name and try saving to see the validation message.' },
    source: { language: 'tsx', code: `import { InlineEdit, type InlineEditProps } from '@jfrader/ui';

export function ProjectName({ save }: { save: InlineEditProps['onSave'] }) {
  return <InlineEdit label="Project name" defaultValue="Apollo" onSave={save}
    validate={next => next.trim() ? null : 'Enter a name'} />;
}` } } },
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
  tags: ['!autodocs'],
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
  parameters: { docs: { source: { language: 'tsx', code: saveSource } } },
  args: { onSave: fn(() => new Promise<void>(() => {})), normalize: fn((next: string) => next) },
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    await userEvent.tab();
    await userEvent.keyboard('{Enter}Zeus{Enter}');
    await expect(args.normalize).toHaveBeenCalledTimes(1);
    // Blocked saves never reach normalize or onSave.
    await userEvent.keyboard('{Enter}');
    await userEvent.click(canvas.getByRole('button', { name: 'Save' }));
    await expect(args.normalize).toHaveBeenCalledTimes(1);
    await expect(args.onSave).toHaveBeenCalledTimes(1);
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
  parameters: { docs: { source: { language: 'tsx', code: saveSource } } },
  args: { onSave: fn(() => Promise.reject(new Error('Offline'))), onValueChange: fn(), onOpenChange: fn() },
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    const onSave = args.onSave as Spy;
    await userEvent.tab();
    await userEvent.keyboard('{Enter}Zeus{Enter}');
    // The failure is the editor's error: announced as an alert, wired to the still-open editor.
    const alert = await canvas.findByRole('alert');
    await expect(alert).toHaveTextContent('Could not save. Try again.');
    const editor = canvas.getByRole('textbox');
    await expect(rootOf(canvasElement)).toHaveAttribute('data-phase', 'failed');
    await expect(editor).toHaveValue('Zeus');
    await expect(editor).not.toHaveAttribute('readonly');
    await expect(editor).toHaveAttribute('aria-invalid', 'true');
    await expect(editor.getAttribute('aria-describedby')!.split(' ')).toContain(alert.id);
    await expect(statusOf(canvasElement)).toBeEmptyDOMElement();
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
    // Editing the draft starts over: the error and the invalid state clear.
    await userEvent.keyboard('!');
    await expect(canvas.queryByRole('alert')).toBeNull();
    await expect(editor).not.toHaveAttribute('aria-invalid');
    await expect(rootOf(canvasElement)).toHaveAttribute('data-phase', 'idle');
  },
};

export const Retry: Story = {
  parameters: { docs: { source: { language: 'tsx', code: parentSource } } },
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
    await expect(canvas.getByRole('alert')).toHaveTextContent('Could not save. Try again.');
    await expect(canvas.getByRole('button', { name: 'Edit Project name: Apollo' })).toHaveAccessibleDescription(
      'Could not save. Try again.',
    );
    await expect(args.onValueChange).not.toHaveBeenCalled();
  },
};

export const RetryResolves: Story = {
  parameters: { docs: { source: { language: 'tsx', code: parentSource } } },
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

export const RetryGuards: Story = {
  parameters: { docs: { source: { language: 'tsx', code: `import { useState } from 'react';
import { Button, InlineEdit, type InlineEditProps } from '@jfrader/ui';

export function ProjectName({ save }: { save: InlineEditProps['onSave'] }) {
  const [open, setOpen] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [requireName, setRequireName] = useState(false);
  return <>
    <InlineEdit label="Project name" defaultValue="Apollo" open={open} onOpenChange={setOpen}
      onSave={save} error={conflict ? 'That name is taken.' : undefined}
      validate={requireName ? next => next.trim() ? null : 'Enter a name' : undefined} />
    <Button onClick={() => setOpen(false)}>Close editor</Button>
    <Button aria-pressed={conflict} onClick={() => setConflict(!conflict)}>Report conflict</Button>
    <Button onClick={() => setRequireName(true)}>Require a name</Button>
  </>;
}` } } },
  args: { onSave: fn(() => Promise.reject(new Error('Offline'))), onValueChange: fn(), onOpenChange: fn() },
  render: (args) => <RetryPolicyField {...args} />,
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    const onSave = args.onSave as Spy;
    const save = deferred();
    onSave.mockImplementationOnce(() => save.promise);
    await userEvent.tab();
    await userEvent.keyboard('{Enter}{Backspace}{Enter}');
    await userEvent.click(canvas.getByRole('button', { name: 'Close editor' }));
    save.reject(new Error('Offline'));
    const retry = await canvas.findByRole('button', { name: 'Retry save' });
    onSave.mockImplementation(() => Promise.resolve());

    // An external error that arrived after the failure blocks Retry.
    const conflict = canvas.getByRole('button', { name: 'Report conflict' });
    await userEvent.click(conflict);
    await userEvent.click(retry);
    await expect(onSave).toHaveBeenCalledTimes(1);
    await expect(canvas.getByRole('alert')).toHaveTextContent('That name is taken.');
    await expect(rootOf(canvasElement)).toHaveAttribute('data-phase', 'failed');

    // So does validation that now rejects the failed draft.
    await userEvent.click(conflict);
    await userEvent.click(canvas.getByRole('button', { name: 'Require a name' }));
    await userEvent.click(retry);
    await expect(onSave).toHaveBeenCalledTimes(1);
    await expect(canvas.getByRole('alert')).toHaveTextContent('Enter a name');
    await expect(canvas.getByRole('button', { name: 'Edit Project name: Apollo' })).toHaveAccessibleDescription(
      'Enter a name',
    );
    await expect(canvas.getByRole('button', { name: 'Retry save' })).toBeVisible();
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await expect(args.onOpenChange).toHaveBeenCalledTimes(1);
  },
};

export const Controlled: Story = {
  name: 'Controlled save',
  parameters: { docs: {
    description: { story: 'Save a new name and read the committed value below the editor.' },
    source: { language: 'tsx', code: `import { useState } from 'react';
import { InlineEdit, type InlineEditProps } from '@jfrader/ui';

export function ProjectName({ save }: { save: InlineEditProps['onSave'] }) {
  const [name, setName] = useState('Apollo');
  const [open, setOpen] = useState(false);
  return <>
    <InlineEdit label="Project name" value={name} onValueChange={setName}
      open={open} onOpenChange={setOpen} onSave={save} />
    <output>{name}</output>
  </>;
}` } } },
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
  tags: ['!autodocs'],
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

export const DeferredOpen: Story = {
  parameters: { docs: { source: { language: 'tsx', code: deferredOpenSource } } },
  args: { onOpenChange: fn() },
  render: (args) => <DeferredOpenField {...args} />,
  play: async ({ canvas, userEvent, args }) => {
    const apply = canvas.getByRole('button', { name: 'Apply request' });
    await userEvent.tab();
    const trigger = canvas.getByRole('button', { name: 'Edit Project name: Apollo' });
    await userEvent.keyboard('{Enter}');
    await expect(args.onOpenChange).toHaveBeenCalledTimes(1);
    await expect(args.onOpenChange).toHaveBeenLastCalledWith(true);
    // Pending: nothing opens and focus stays on the value.
    await expect(canvas.queryByRole('textbox')).toBeNull();
    await expectFocus(trigger);
    // The parent accepts later: the editor still takes focus with the text selected.
    await userEvent.click(apply);
    const editor = canvas.getByRole('textbox') as HTMLInputElement;
    await expectFocus(editor);
    await expect([editor.selectionStart, editor.selectionEnd]).toEqual([0, 6]);
    await userEvent.keyboard('{Escape}');
    await userEvent.click(apply);

    // Accepted after focus went elsewhere: the editor opens without taking focus.
    await userEvent.click(canvas.getByRole('button', { name: 'Edit Project name: Apollo' }));
    await expect(args.onOpenChange).toHaveBeenCalledTimes(3);
    const elsewhere = canvas.getByRole('button', { name: 'Elsewhere' });
    await userEvent.click(elsewhere);
    await userEvent.click(apply);
    await expect(canvas.getByRole('textbox')).toBeVisible();
    await expect(elsewhere.ownerDocument.activeElement).toBe(elsewhere);
    await expect(args.onOpenChange).toHaveBeenCalledTimes(3);
  },
};

export const DeferredAfterOutsidePress: Story = {
  parameters: { docs: { source: { language: 'tsx', code: deferredOpenSource } } },
  args: { onOpenChange: fn() },
  render: (args) => <DeferredOpenField {...args} />,
  play: async ({ canvas, userEvent, args }) => {
    const apply = canvas.getByRole('button', { name: 'Apply request' });
    const outside = canvas.getByText('Release notes');
    const page = outside.ownerDocument;
    // A press on plain content outside drops focus to the page; a later open leaves it there.
    await userEvent.tab();
    await userEvent.keyboard('{Enter}');
    await userEvent.click(outside);
    await expect(page.activeElement).toBe(page.body);
    await userEvent.click(apply);
    const editor = canvas.getByRole('textbox');
    await expect(editor).toBeVisible();
    await expect(page.activeElement).toBe(page.body);

    // A later close leaves it there too.
    await userEvent.click(editor);
    await userEvent.keyboard('{Escape}');
    await expect(args.onOpenChange).toHaveBeenCalledTimes(2);
    await userEvent.click(outside);
    // Leaving with the unchanged draft repeats the close request.
    await expect(args.onOpenChange).toHaveBeenCalledTimes(3);
    await expect(args.onOpenChange).toHaveBeenLastCalledWith(false);
    await userEvent.click(apply);
    await expect(canvas.queryByRole('textbox')).toBeNull();
    await expect(page.activeElement).toBe(page.body);
    await expect(args.onSave).not.toHaveBeenCalled();
  },
};

export const DeferredAfterBlur: Story = {
  parameters: { docs: { source: { language: 'tsx', code: deferredOpenSource } } },
  args: { onOpenChange: fn() },
  render: (args) => <DeferredOpenField {...args} />,
  play: async ({ canvas, userEvent, args }) => {
    const apply = canvas.getByRole('button', { name: 'Apply request' });
    const trigger = canvas.getByRole('button', { name: 'Edit Project name: Apollo' });
    const page = trigger.ownerDocument;
    // A programmatic blur drops focus to the page with no press or focus elsewhere; a later open
    // leaves it there.
    await userEvent.tab();
    await userEvent.keyboard('{Enter}');
    await expect(args.onOpenChange).toHaveBeenCalledTimes(1);
    trigger.blur();
    await expect(page.activeElement).toBe(page.body);
    await userEvent.click(apply);
    const editor = canvas.getByRole('textbox');
    await expect(editor).toBeVisible();
    await expect(page.activeElement).toBe(page.body);

    // A later close leaves it there too.
    await userEvent.click(editor);
    await userEvent.keyboard('{Escape}');
    await expect(args.onOpenChange).toHaveBeenCalledTimes(2);
    editor.blur();
    // Leaving with the unchanged draft repeats the close request.
    await expect(args.onOpenChange).toHaveBeenCalledTimes(3);
    await expect(args.onOpenChange).toHaveBeenLastCalledWith(false);
    await expect(page.activeElement).toBe(page.body);
    await userEvent.click(apply);
    await expect(canvas.queryByRole('textbox')).toBeNull();
    await expect(page.activeElement).toBe(page.body);
    await expect(args.onSave).not.toHaveBeenCalled();
  },
};

export const DeferredClose: Story = {
  parameters: { docs: { source: { language: 'tsx', code: deferredOpenSource } } },
  args: { onOpenChange: fn(), onValueChange: fn() },
  render: (args) => <DeferredOpenField {...args} />,
  play: async ({ canvas, userEvent, args }) => {
    const apply = canvas.getByRole('button', { name: 'Apply request' });
    await userEvent.tab();
    await userEvent.keyboard('{Enter}');
    await userEvent.click(apply);
    const editor = canvas.getByRole('textbox');
    await userEvent.keyboard(' 2{Escape}');
    await expect(args.onOpenChange).toHaveBeenCalledTimes(2);
    await expect(args.onOpenChange).toHaveBeenLastCalledWith(false);
    // Pending: the editor stays, focused, with the persisted value.
    await expect(editor).toHaveValue('Apollo');
    await expectFocus(editor);
    // The parent accepts later: focus returns to the value.
    await userEvent.click(apply);
    await expect(canvas.queryByRole('textbox')).toBeNull();
    await expectFocus(canvas.getByRole('button', { name: 'Edit Project name: Apollo' }));

    // Accepted after focus went elsewhere: focus stays where the user put it.
    await userEvent.keyboard('{Enter}');
    await userEvent.click(apply);
    await userEvent.keyboard('{Escape}');
    await expect(args.onOpenChange).toHaveBeenCalledTimes(4);
    const elsewhere = canvas.getByRole('button', { name: 'Elsewhere' });
    // Leaving with the unchanged draft repeats the close request.
    await userEvent.click(elsewhere);
    await expect(args.onOpenChange).toHaveBeenCalledTimes(5);
    await expect(args.onOpenChange).toHaveBeenLastCalledWith(false);
    await userEvent.click(apply);
    await expect(canvas.queryByRole('textbox')).toBeNull();
    await expect(elsewhere.ownerDocument.activeElement).toBe(elsewhere);
    await expect(args.onSave).not.toHaveBeenCalled();
    await expect(args.onValueChange).not.toHaveBeenCalled();
  },
};

export const EscapeInsideLayer: Story = {
  tags: ['!autodocs'],
  // No leave saves, so moving between the two editors requests nothing.
  args: { defaultOpen: true, saveOnBlur: false, onOpenChange: fn() },
  render: (args) => <EscapeLayer {...args} />,
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    const documentEscape = fn();
    const onDocumentKeyDown = (event: globalThis.KeyboardEvent) => event.key === 'Escape' && documentEscape();
    const doc = canvasElement.ownerDocument;
    doc.addEventListener('keydown', onDocumentKeyDown);
    const layerEscapes = canvas.getByTestId('layer-escapes');
    try {
      // Composing: the editor leaves Escape to the layer.
      const editor = canvas.getByRole('textbox', { name: 'Project name' });
      await userEvent.click(editor);
      fireEvent.keyDown(editor, { key: 'Escape', isComposing: true });
      await expect(layerEscapes).toHaveTextContent('1');
      await expect(documentEscape).toHaveBeenCalledTimes(1);
      await expect(args.onOpenChange).not.toHaveBeenCalled();

      // A consumer veto leaves the editor open and Escape to the layer.
      await userEvent.click(canvas.getByRole('textbox', { name: 'Vetoed' }));
      await userEvent.keyboard('{Escape}');
      await expect(canvas.getByRole('textbox', { name: 'Vetoed' })).toBeVisible();
      await expect(layerEscapes).toHaveTextContent('2');
      await expect(documentEscape).toHaveBeenCalledTimes(2);
      await expect(args.onOpenChange).not.toHaveBeenCalled();

      // A handled cancel keeps Escape from the layer and the document.
      await userEvent.click(editor);
      await userEvent.keyboard('{Escape}');
      await expect(args.onOpenChange).toHaveBeenCalledTimes(1);
      await expect(args.onOpenChange).toHaveBeenLastCalledWith(false);
      await expect(canvas.queryByRole('textbox', { name: 'Project name' })).toBeNull();
      await expect(layerEscapes).toHaveTextContent('2');
      await expect(documentEscape).toHaveBeenCalledTimes(2);
    } finally {
      doc.removeEventListener('keydown', onDocumentKeyDown);
    }
  },
};

export const ExternalUpdateWhileEditing: Story = {
  parameters: { docs: { source: { language: 'tsx', code: externalValueSource } } },
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
  parameters: { docs: { source: { language: 'tsx', code: externalValueSource } } },
  args: { onValueChange: fn(), onOpenChange: fn() },
  render: (args) => <ExternalValueField {...args} />,
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    const onSave = args.onSave as Spy;
    const root = rootOf(canvasElement);
    const settled = async (promise: Promise<void>) => {
      await promise.catch(() => {});
      await new Promise((resolve) => setTimeout(resolve, 0));
    };
    const [staleA, saveB, staleC, saveD] = [deferred(), deferred(), deferred(), deferred()];
    for (const run of [staleA, saveB, staleC, saveD]) onSave.mockImplementationOnce(() => run.promise);
    const rename = canvas.getByRole('button', { name: 'Rename to Hermes' });

    // Save A goes stale when the value changes elsewhere; the editor is editable again.
    await userEvent.tab();
    await userEvent.keyboard('{Enter}Zeus{Enter}');
    await expect(root).toHaveAttribute('data-phase', 'saving');
    await userEvent.click(rename);
    const editor = canvas.getByRole('textbox');
    await expect(root).toHaveAttribute('data-phase', 'idle');
    await expect(editor).not.toHaveAttribute('readonly');
    await expect(editor).toHaveValue('Zeus');

    // Save B starts; A resolving during B changes nothing.
    await userEvent.clear(editor);
    await userEvent.keyboard('Athena{Enter}');
    await expect(onSave).toHaveBeenCalledTimes(2);
    await expect(onSave).toHaveBeenLastCalledWith('Athena');
    await expect(root).toHaveAttribute('data-phase', 'saving');
    staleA.resolve();
    await settled(staleA.promise);
    await expect(root).toHaveAttribute('data-phase', 'saving');
    await expect(editor).toHaveAttribute('readonly');
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await expect(args.onOpenChange).toHaveBeenCalledTimes(1);

    // B settles and commits its own value only.
    saveB.resolve();
    await settled(saveB.promise);
    await expect(root).toHaveAttribute('data-phase', 'saved');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith('Athena');
    await expect(args.onOpenChange).toHaveBeenCalledTimes(2);
    await expect(args.onOpenChange).toHaveBeenLastCalledWith(false);
    await expectFocus(canvas.getByRole('button', { name: 'Edit Project name: Athena' }));

    // C goes stale and fails only after D has saved: the failure is dropped.
    await userEvent.keyboard('{Enter}Zeus{Enter}');
    await expect(onSave).toHaveBeenCalledTimes(3);
    await userEvent.click(rename);
    await expect(root).toHaveAttribute('data-phase', 'idle');
    await userEvent.clear(canvas.getByRole('textbox'));
    await userEvent.keyboard('Ares{Enter}');
    await expect(onSave).toHaveBeenCalledTimes(4);
    await expect(onSave).toHaveBeenLastCalledWith('Ares');
    saveD.resolve();
    await settled(saveD.promise);
    await expect(args.onValueChange).toHaveBeenCalledTimes(2);
    await expect(args.onValueChange).toHaveBeenLastCalledWith('Ares');
    await expect(args.onOpenChange).toHaveBeenCalledTimes(4);
    staleC.reject(new Error('Offline'));
    await settled(staleC.promise);
    await expect(root).toHaveAttribute('data-phase', 'saved');
    await expect(statusOf(canvasElement)).toHaveTextContent('Saved');
    await expect(canvas.queryByRole('button', { name: 'Retry save' })).toBeNull();
    await expect(args.onValueChange).toHaveBeenCalledTimes(2);
    await expect(args.onOpenChange).toHaveBeenCalledTimes(4);
    await expect(canvas.getByRole('button', { name: 'Edit Project name: Ares' })).toBeVisible();
  },
};

export const UnmountWhileSaving: Story = {
  parameters: { docs: { source: { language: 'tsx', code: parentSource } } },
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
  parameters: { docs: { source: { language: 'tsx', code: `import { InlineEdit, type InlineEditProps } from '@jfrader/ui';

export function Summary({ save }: { save: InlineEditProps['onSave'] }) {
  return <>
    <InlineEdit label="Summary" defaultValue="Ships the rename flow." variant="body" onSave={save} />
    <InlineEdit label="Heading" defaultValue="Ships the rename flow." variant="title" onSave={save} />
  </>;
}` } } },
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
  parameters: { docs: {
    description: { story: 'Each size gives the value, the editor and its Save and Cancel Buttons one shared height.' },
    source: { language: 'tsx', code: `import { InlineEdit, type InlineEditProps } from '@jfrader/ui';

export function ProjectNames({ save }: { save: InlineEditProps['onSave'] }) {
  return <>
    <InlineEdit size="sm" label="Small" defaultValue="Apollo" onSave={save} />
    <InlineEdit size="md" label="Medium" defaultValue="Apollo" onSave={save} />
    <InlineEdit size="lg" label="Large" defaultValue="Apollo" onSave={save} />
  </>;
}` },
  } },
  render: (args) => (
    <>
      {variants.flatMap((variant) =>
        sizes.map((size) => (
          <InlineEdit key={`${variant}-${size}`} {...args} variant={variant} size={size} label={`Name ${variant} ${size}`} />
        )),
      )}
      {variants.flatMap((variant) =>
        sizes.map((size) => (
          <div key={`open-${variant}-${size}`} data-testid={`open-${variant}-${size}`}>
            <InlineEdit {...args} variant={variant} size={size} label={`Open ${variant} ${size}`} defaultOpen />
          </div>
        )),
      )}
      {sizes.map((size) => (
        <div key={`multiline-${size}`} data-testid={`multiline-${size}`}>
          <InlineEdit {...args} multiline variant="body" size={size} label={`Notes ${size}`} defaultOpen />
        </div>
      ))}
    </>
  ),
  play: async ({ canvas }) => {
    for (const variant of variants) {
      for (const size of sizes) {
        const height = blockSizes[size];
        // Resting and editing take the same block, so opening never shifts the row.
        const trigger = canvas.getByRole('button', { name: new RegExp(`^Edit Name ${variant} ${size}`) });
        await expect(trigger.getBoundingClientRect().height).toBe(height);
        // The idle status region adds nothing: the widget is its value's height.
        await expect(trigger.closest('[data-ui="inline-edit"]')!.getBoundingClientRect().height).toBe(height);
        const open = within(canvas.getByTestId(`open-${variant}-${size}`));
        const editor = open.getByRole('textbox').getBoundingClientRect();
        await expect(editor.height).toBe(height);
        for (const name of ['Save', 'Cancel']) {
          const action = open.getByRole('button', { name });
          await expect(action).toHaveAttribute('data-ui', 'button');
          const box = action.getBoundingClientRect();
          await expect([box.width, box.height]).toEqual([height, height]);
          await expect(box.top).toBe(editor.top);
        }
      }
    }
    // A multiline editor grows; its actions keep the size's block and sit on its first line.
    for (const size of sizes) {
      const open = within(canvas.getByTestId(`multiline-${size}`));
      const editor = open.getByRole('textbox').getBoundingClientRect();
      await expect(editor.height).toBeGreaterThanOrEqual(blockSizes[size]);
      const save = open.getByRole('button', { name: 'Save' }).getBoundingClientRect();
      await expect(save.height).toBe(blockSizes[size]);
      await expect(save.top).toBe(editor.top);
    }
  },
};

/** The parent writes the saved value before the save resolves, then the save settles. */
function OptimisticField(props: InlineEditProps & { persist: (next: string) => Promise<void> }) {
  const { persist, ...rest } = props;
  const [value, setValue] = useState('Apollo');
  return (
    <InlineEdit
      {...rest}
      defaultValue={undefined}
      value={value}
      onSave={async (next) => {
        setValue(next);
        await persist(next);
      }}
    />
  );
}
OptimisticField.displayName = 'OptimisticInlineEdit';

export const OptimisticSave: Story = {
  tags: ['!autodocs'],
  parameters: { docs: { source: { language: 'tsx', code: `import { useState } from 'react';
import { InlineEdit } from '@jfrader/ui';

export function ProjectName({ persist }: { persist: (next: string) => Promise<void> }) {
  const [name, setName] = useState('Apollo');
  return <InlineEdit label="Project name" value={name}
    onSave={async next => { setName(next); await persist(next); }} />;
}` } } },
  args: { onOpenChange: fn() },
  render: (args) => {
    const save = args.onSave as Spy;
    return <OptimisticField {...args} persist={(next) => save(next) as Promise<void>} />;
  },
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    const pending = deferred();
    (args.onSave as Spy).mockImplementation(() => pending.promise);
    await userEvent.tab();
    await userEvent.keyboard('{Enter}Zeus{Enter}');
    // The optimistic value lands while the save is pending; the save is still in flight.
    await expect(rootOf(canvasElement)).toHaveAttribute('data-phase', 'saving');
    pending.resolve();
    await expectFocus(await canvas.findByRole('button', { name: 'Edit Project name: Zeus' }));
    await expect(rootOf(canvasElement)).toHaveAttribute('data-phase', 'saved');
    await expect(args.onOpenChange).toHaveBeenLastCalledWith(false);
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
  tags: ['!autodocs'],
  args: { defaultValue: LONG_VALUE },
  render: (args) => (
    <Narrow>
      <InlineEdit {...args} />
      <InlineEdit {...args} label="Open name" defaultOpen />
    </Narrow>
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
  parameters: { docs: { source: { language: 'tsx', code: `import { InlineEdit, styled, theme, type InlineEditProps } from '@jfrader/ui';

const ProjectHeading = styled.h2({ margin: 0, fontSize: theme.textSize.sm, color: theme.color.textMuted });

export function Project({ save }: { save: InlineEditProps['onSave'] }) {
  return <section aria-labelledby="project-heading">
    <ProjectHeading id="project-heading">Project</ProjectHeading>
    <InlineEdit label="Project name" defaultValue="Apollo" onSave={save} />
  </section>;
}` } } },
  render: (args) => (
    <section aria-labelledby="project-heading">
      <ProjectHeading id="project-heading">
        Project
      </ProjectHeading>
      <InlineEdit {...args} />
    </section>
  ),
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.getByRole('heading', { level: 2, name: 'Project' })).toBeVisible();
    await expect(rootOf(canvasElement).closest('h1, h2, h3, h4, h5, h6')).toBeNull();
  },
};

export const ExternalAria: Story = {
  tags: ['!autodocs'],
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
  tags: ['!autodocs'],
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
      await expect(action.getBoundingClientRect().width).toBe(blockSizes.md);
    }
    const ids = Array.from(canvasElement.querySelectorAll('[id]'), (node) => node.id);
    await expect(new Set(ids).size).toBe(ids.length);
  },
};

const triggerSlotStyle = css({ color: vars.color.accentText });
const rootCssStyle = css({ paddingInline: vars.space[2] });
const StyledInlineEdit = styled(InlineEdit)(rootCssStyle);
const rootSxStyle = css({ paddingInline: vars.space[6] });
export const RefAndStyles: Story = {
  parameters: { docs: { source: { language: 'tsx', code: `import { useRef } from 'react';
import { InlineEdit, styled, theme, type InlineEditProps } from '@jfrader/ui';

const ProjectName = styled(InlineEdit)({ paddingInline: theme.space[6] });

export function Project({ save }: { save: InlineEditProps['onSave'] }) {
  const root = useRef<HTMLDivElement>(null);
  const control = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  return <ProjectName label="Project name" defaultValue="Apollo" onSave={save} ref={root} controlRef={control}
    className="consumer-root"
    slotProps={{ trigger: { sx: { color: theme.color.accentText }, className: 'consumer-trigger' } }} />;
}` } } },
  args: { ref: fn(), controlRef: fn() },
  render: (args) => (
    <StyledInlineEdit
      {...args}
      sx={rootSxStyle}
      className="consumer-root"
      slotProps={{ root: { sx: rootCssStyle }, trigger: { sx: triggerSlotStyle, className: 'consumer-trigger' } }}
    />
  ),
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    const root = rootOf(canvasElement);
    const rootRef = args.ref as Spy;
    await expect(rootRef.mock.calls.at(-1)?.[0]).toBe(root);
    await expect(root).toHaveClass('consumer-root');
    const trigger = canvas.getByRole('button', { name: /^Edit/ });
    await expect(trigger).toHaveClass('consumer-trigger');
    const probe = canvasElement.ownerDocument.createElement('span');
    probe.style.color = vars.color.accentText;
    probe.style.paddingInlineStart = vars.space[6];
    root.append(probe);
    await expect(getComputedStyle(root).paddingInlineStart).toBe(getComputedStyle(probe).paddingInlineStart);
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
  tags: ['!autodocs'],
  args: { defaultOpen: true, saveOnBlur: false, onValueChange: fn(), controlProps: { name: 'project' } },
  render: (args) => (
    <form onSubmit={(event) => event.preventDefault()} data-testid="form">
      <InlineEdit {...args} />
      <FixtureButton type="reset">Reset form</FixtureButton>
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
  tags: ['!autodocs'],
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
  tags: ['!autodocs'],
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
      source: { language: 'tsx', code: saveSource },
      description: {
        story:
          'Manual check: enable prefers-reduced-motion: reduce in the browser (see docs/qa-gates.md), then save to see the static busy indicator. Not automated here.',
      },
    },
  },
};

const StyledSlotInlineEdit = styled(InlineEdit)({ borderRadius: '9px' });
/** Replace the wrapper and generated label; pass native props through slotProps. */
export const SlotCustomization: Story = {
  tags: ['!autodocs'],
  args: {
    defaultOpen: true,
    ref: fn(),
    onClick: fn(),
    className: 'consumer-root',
    title: 'consumer title',
    style: fieldRootStyles.consumer,
    sx: { borderRadius: '11px' },
    component: FieldSugarRoot,
    slots: { root: FieldReplacementRoot, label: FieldReplacementLabel },
    slotProps: {
      root: {
        onClick: fn(),
        ref: fn(),
        className: 'slot-root',
        title: 'slot title',
        style: fieldRootStyles.slot,
        sx: { borderRadius: '8px' },
      },
      label: { ref: fn(), title: 'generated part' },
    },
  },
  render: (args) => <StyledSlotInlineEdit {...args} />,
  parameters: {
    docs: {
      source: {
        code: "function MyRoot(props) { return <div {...props} />; }\nfunction MyLabel(props) { return <label {...props} />; }\n\n<InlineEdit label=\"Project name\" onSave={saveName} defaultOpen\n  component={MyRoot}\n  slots={{ label: MyLabel }}\n  slotProps={{ root: { sx: { borderRadius: '8px' } }, label: { title: 'Name' } }}\n  sx={{ borderRadius: '11px' }}\n/>",
      },
    },
  },
  play: async ({ canvasElement, args }) => {
    await expectFieldSlotCustomization(
      canvasElement,
      {
        rootEvent: args.slotProps?.root?.onClick,
        consumerEvent: args.onClick,
        root: args.slotProps?.root?.ref,
        part: args.slotProps?.label?.ref,
        consumer: args.ref,
      },
      'root',
    );
  },
};

/** Use component as shorthand for the wrapper's root slot. */
export const ComponentRoot: Story = {
  parameters: { docs: { source: { language: 'tsx', code: `import type { ComponentPropsWithRef } from 'react';
import { InlineEdit, type InlineEditProps } from '@jfrader/ui';

function ProjectNameRoot(props: ComponentPropsWithRef<'div'>) { return <div {...props} />; }

export function ProjectName({ save }: { save: InlineEditProps['onSave'] }) {
  return <InlineEdit label="Project name" defaultValue="Apollo" onSave={save} component={ProjectNameRoot} />;
}` } } },
  args: { component: FieldSugarRoot },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('[data-slot-root="component"]')).not.toBeNull();
  },
};

export type InlineEditSlotTypeRegression = {
  // @ts-expect-error Unknown structural keys are rejected.
  unknownSlot: NonNullable<import('./index').InlineEditProps['slots']>['notASlot'];
  // @ts-expect-error Unknown prop keys are rejected.
  unknownSlotProps: NonNullable<import('./index').InlineEditProps['slotProps']>['notASlot'];
};
