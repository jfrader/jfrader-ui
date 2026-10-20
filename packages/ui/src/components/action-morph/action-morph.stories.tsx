import { StrictMode, useState, type ComponentPropsWithRef } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, mocked, waitFor, within } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { styled } from '../../styling/styled';
import { ActionMorph, type ActionMorphAction } from './index';
import { Button } from '../button';

const Stage = styled.div({
  minBlockSize: '30rem',
  paddingBlockStart: '24rem',
  display: 'flex',
  justifyContent: 'end',
  gap: vars.space[4],
});
const actions: readonly ActionMorphAction[] = [
  {
    id: 'note',
    label: 'Note',
    shortcut: 'n',
    composer: {
      title: 'New note',
      label: 'Note text',
      submitLabel: 'Save note',
      successLabel: 'Note saved',
    },
  },
  {
    id: 'locked',
    label: 'Locked action',
    disabled: true,
    composer: {
      title: 'Unavailable',
      submitLabel: 'Save',
      successLabel: 'Saved',
    },
  },
  {
    id: 'message',
    label: 'Message',
    shortcut: 'm',
    composer: {
      title: 'New message',
      label: 'Message text',
      multiline: true,
      submitLabel: 'Send message',
      successLabel: 'Message sent',
      choices: {
        label: 'Audience',
        options: [
          { value: 'team', label: 'Team' },
          { value: 'all', label: 'Everyone' },
        ],
      },
    },
  },
];
const actionExample = (corner: 'start' | 'end') => `import { ActionMorph, styled, type ActionMorphProps } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const Stage = styled.div({ minBlockSize: '30rem', paddingBlockStart: '24rem', display: 'flex', justifyContent: 'end', gap: vars.space[4] });

export function CreateAction({ save }: { save: NonNullable<ActionMorphProps['onSubmit']> }) {
  return <Stage>
    <ActionMorph label="Create" corner="${corner}" resetAfter={0} onSubmit={save} actions={[
      { id: 'note', label: 'Note', shortcut: 'n', composer: {
        title: 'New note', label: 'Note text', submitLabel: 'Save note', successLabel: 'Note saved',
      } },
      { id: 'locked', label: 'Locked action', disabled: true, composer: {
        title: 'Unavailable', submitLabel: 'Save', successLabel: 'Saved',
      } },
      { id: 'message', label: 'Message', shortcut: 'm', composer: {
        title: 'New message', label: 'Message text', multiline: true,
        submitLabel: 'Send message', successLabel: 'Message sent', choices: {
          label: 'Audience', options: [
            { value: 'team', label: 'Team' }, { value: 'all', label: 'Everyone' },
          ],
        },
      } },
    ]} />
  </Stage>;
}`;
const meta = {
  title: 'Actions/ActionMorph',
  component: ActionMorph,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <Stage>
        <Story />
      </Stage>
    ),
  ],
  parameters: {
    a11y: {
      config: {
        rules: [
          { id: 'aria-hidden-focus', selector: '[aria-hidden="true"]:not([data-floating-ui-focus-guard])' },
        ],
      },
    },
    docs: {
      description: {
        component: 'Choose a create action, write a short draft and submit it without leaving the page.',
      },
      sections: [
        { title: 'Create and compose', stories: ['Default'] },
        { title: 'Placement', stories: ['CornerStart'] },
      ],
      usage: `### Drafts and submission
Use this for short drafts, Menu for immediate commands, and Dialog for longer forms. Drafts and choices stay in memory while mounted, including after Back or a failed request. Return the real promise from \`onSubmit\`; omitting it disables submission. Empty trimmed text is rejected, but the original text is submitted. Closing or going Back invalidates UI updates, not the app's request; cancellation belongs to the consumer. Give actions unique ids and shortcuts.

### Keyboard and accessibility

Enter, Space or ArrowDown opens on the first enabled action; ArrowUp opens on the last. Up/Down wraps and Home/End jumps. Menu-local shortcuts take precedence over typeahead. Enter/Space chooses an action. Enter submits a single-line draft; Control/Meta+Enter submits multiline text. Escape returns from composer to menu, then closes the menu. Tab follows the nonmodal page order; leaving closes without moving focus back. Accepted Escape and success close return focus to the trigger.

### State and motion

Rejected close requests retain an accessible success face with a Close button. Only the active face is interactive. Motion changes layout without delaying submission or focus; reduced motion swaps faces immediately. Reserve space around the trigger for the menu and composer to grow.`,
    },
  },
  args: {
    actions,
    label: 'Create',
    onSubmit: fn(async () => {}),
    onOpenChange: fn(),
    resetAfter: 0,
  },
} satisfies Meta<typeof ActionMorph>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Create a note or message',
  parameters: { docs: {
    description: { story: 'Choose Note for a short draft or Message for multiline text and an audience.' },
    source: { language: 'tsx', code: actionExample('end') },
  } },
};
export const Light: Story = { globals: { theme: 'light' } };
export const CornerStart: Story = {
  name: 'Grow from the start corner',
  args: { corner: 'start' },
  parameters: { docs: {
    description: { story: 'Open the same create actions from the logical start corner.' },
    source: { language: 'tsx', code: actionExample('start') },
  } },
};
export const EmptyActions: Story = { args: { actions: [] } };
export const PersistentMenu: Story = {
  args: { defaultOpen: true },
  tags: ['!autodocs'],
};

export const KeyboardAndDrafts: Story = {
  play: async ({ args, canvas, canvasElement, userEvent }) => {
    const document = within(canvasElement.ownerDocument.body);
    const trigger = canvas.getByRole('button', { name: 'Create' });
    await userEvent.tab();
    await expect(trigger.ownerDocument.activeElement).toBe(trigger);
    await expect(getComputedStyle(trigger).outlineStyle).not.toBe('none');
    await userEvent.keyboard('{ArrowUp}');
    const message = await document.findByRole('menuitem', { name: 'Message' });
    await expect(message.ownerDocument.activeElement).toBe(message);
    await expect(getComputedStyle(message).appearance).toBe('none');
    await expect(getComputedStyle(message).outlineStyle).toBe('solid');
    await expect(getComputedStyle(message).outlineWidth).toBe('2px');
    await expect(getComputedStyle(message).outlineOffset).toBe('-2px');
    await userEvent.keyboard('{Home}');
    const note = document.getByRole('menuitem', { name: 'Note' });
    await expect(note.ownerDocument.activeElement).toBe(note);
    await userEvent.keyboard('{ArrowDown}');
    await expect(message.ownerDocument.activeElement).toBe(message);
    await userEvent.keyboard('{ArrowDown}');
    await expect(note.ownerDocument.activeElement).toBe(note);
    await userEvent.keyboard('{Enter}');
    const field = await document.findByRole('textbox', { name: 'Note text' });
    await waitFor(() => expect(field.ownerDocument.activeElement).toBe(field));
    await expect(document.getByRole('dialog')).toHaveAccessibleName('New note');
    await userEvent.type(field, 'Keep this draft');
    await userEvent.keyboard('{Escape}');
    await waitFor(() =>
      expect(document.getByRole('menuitem', { name: 'Note' }).ownerDocument.activeElement).toBe(
        document.getByRole('menuitem', { name: 'Note' }),
      ),
    );
    await userEvent.keyboard('n');
    await expect(await document.findByRole('textbox', { name: 'Note text' })).toHaveValue('Keep this draft');
    await userEvent.keyboard('{Enter}');
    await waitFor(() => expect(args.onSubmit).toHaveBeenCalledTimes(1));
    await expect(args.onSubmit).toHaveBeenCalledWith({
      action: 'note',
      text: 'Keep this draft',
      choice: undefined,
    });
    await waitFor(() => expect(document.queryByRole('dialog')).toBeNull());
    await expect(trigger.ownerDocument.activeElement).toBe(trigger);
    await expect(canvas.getByRole('status')).toHaveTextContent('Note saved');
  },
};
export const Composer: Story = {
  tags: ['!autodocs'],
  play: async ({ canvas, canvasElement, userEvent }) => {
    const document = within(canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByRole('button', { name: 'Create' }));
    await userEvent.click(await document.findByRole('menuitem', { name: 'Note' }));
    await expect(await document.findByRole('textbox', { name: 'Note text' })).toHaveFocus();
  },
};
export const EmptySubmission: Story = {
  tags: ['!autodocs'],
  play: async ({ args, canvas, canvasElement, userEvent }) => {
    const document = within(canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByRole('button', { name: 'Create' }));
    await userEvent.click(await document.findByRole('menuitem', { name: 'Note' }));
    const field = await document.findByRole('textbox', { name: 'Note text' });
    await userEvent.keyboard('{Enter}');
    await expect(field).toHaveAttribute('aria-invalid', 'true');
    await expect(args.onSubmit).not.toHaveBeenCalled();
    await expect(document.getByText('Enter some text.')).toHaveAttribute(
      'id',
      field.getAttribute('aria-describedby'),
    );
  },
};
export const SubmissionError: Story = {
  tags: ['!autodocs'],
  play: async ({ args, canvas, canvasElement, userEvent }) => {
    args.onSubmit?.mockRejectedValueOnce(new Error('Offline'));
    const document = within(canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByRole('button', { name: 'Create' }));
    await userEvent.click(await document.findByRole('menuitem', { name: 'Note' }));
    const field = await document.findByRole('textbox', { name: 'Note text' });
    await userEvent.type(field, 'Retained draft');
    await userEvent.keyboard('{Enter}');
    await waitFor(() => expect(field).toHaveAttribute('aria-invalid', 'true'));
    await expect(field).toHaveValue('Retained draft');
    await expect(field).toHaveFocus();
  },
};
export const MultilineChoices: Story = {
  tags: ['!autodocs'],
  play: async ({ args, canvas, canvasElement, userEvent }) => {
    const document = within(canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByRole('button', { name: 'Create' }));
    await userEvent.click(await document.findByRole('menuitem', { name: 'Message' }));
    const field = await document.findByRole('textbox', {
      name: 'Message text',
    });
    await userEvent.type(field, 'Hello{Enter}Team');
    await expect(args.onSubmit).not.toHaveBeenCalled();
    await userEvent.click(document.getByRole('radio', { name: 'Team' }));
    await userEvent.keyboard('{ArrowDown}');
    await expect(document.getByRole('radio', { name: 'Everyone' })).toBeChecked();
    await userEvent.click(field);
    await userEvent.keyboard('{Control>}{Enter}{/Control}');
    await waitFor(() =>
      expect(args.onSubmit).toHaveBeenCalledWith({
        action: 'message',
        text: 'Hello\nTeam',
        choice: 'all',
      }),
    );
  },
};
export const ControlledRejectOpen: Story = {
  args: { open: false },
  play: async ({ args, canvas, canvasElement, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Create' }));
    await expect(args.onOpenChange).toHaveBeenCalledWith(true);
    await expect(within(canvasElement.ownerDocument.body).queryByRole('menu')).toBeNull();
  },
};
export const ControlledRejectClose: Story = {
  args: { open: true, slotProps: { backButton: { ref: fn(() => fn()) } } },
  tags: ['!autodocs'],
  play: async ({ args, canvasElement, userEvent }) => {
    const document = within(canvasElement.ownerDocument.body);
    await userEvent.click(await document.findByRole('menuitem', { name: 'Note' }));
    await userEvent.type(await document.findByRole('textbox', { name: 'Note text' }), 'A note');
    await userEvent.keyboard('{Enter}');
    const close = await document.findByRole('button', { name: 'Close' });
    await expect(close).toBeVisible();
    await expect(close).toHaveFocus();
    await expect(args.slotProps?.backButton?.ref).toHaveBeenCalledWith(close);
    await expect(args.onOpenChange).toHaveBeenCalledWith(false);
    await expect(document.queryByRole('textbox')).toBeNull();
  },
};
export const PendingAndCanceled: Story = {
  play: async ({ args, canvas, canvasElement, userEvent }) => {
    let finish = () => {};
    args.onSubmit?.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const document = within(canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByRole('button', { name: 'Create' }));
    await userEvent.click(await document.findByRole('menuitem', { name: 'Note' }));
    const field = await document.findByRole('textbox', { name: 'Note text' });
    await userEvent.type(field, 'Keep me');
    await userEvent.keyboard('{Enter}');
    await expect(field).toBeDisabled();
    await userEvent.click(document.getByRole('button', { name: 'Save note' }));
    await expect(args.onSubmit).toHaveBeenCalledTimes(1);
    await userEvent.click(document.getByRole('button', { name: 'Back' }));
    finish();
    await expect(await document.findByRole('menuitem', { name: 'Note' })).toBeVisible();
    await userEvent.click(document.getByRole('menuitem', { name: 'Note' }));
    await expect(await document.findByRole('textbox', { name: 'Note text' })).toHaveValue('Keep me');
    await userEvent.keyboard('{Escape}{Escape}');
  },
};
function Root(props: ComponentPropsWithRef<'div'>) {
  return <div {...props} data-custom-root />;
}
function Title(props: ComponentPropsWithRef<'h3'>) {
  return <h3 {...props} data-custom-title />;
}
export const Customization: Story = {
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { type ComponentPropsWithRef } from 'react';
import { ActionMorph, type ActionMorphAction } from '@jfrader/ui';

const actions: readonly ActionMorphAction[] = [
  {
    id: 'note',
    label: 'Note',
    shortcut: 'n',
    composer: {
      title: 'New note',
      label: 'Note text',
      submitLabel: 'Save note',
      successLabel: 'Note saved',
    },
  },
  {
    id: 'locked',
    label: 'Locked action',
    disabled: true,
    composer: {
      title: 'Unavailable',
      submitLabel: 'Save',
      successLabel: 'Saved',
    },
  },
  {
    id: 'message',
    label: 'Message',
    shortcut: 'm',
    composer: {
      title: 'New message',
      label: 'Message text',
      multiline: true,
      submitLabel: 'Send message',
      successLabel: 'Message sent',
      choices: {
        label: 'Audience',
        options: [
          { value: 'team', label: 'Team' },
          { value: 'all', label: 'Everyone' },
        ],
      },
    },
  },
];

function Root(props: ComponentPropsWithRef<'div'>) {
  return <div {...props} data-custom-root />;
}

function Title(props: ComponentPropsWithRef<'h3'>) {
  return <h3 {...props} data-custom-title />;
}

export function Example() {
  return (
    <ActionMorph
      actions={actions}
      label="Create"
      onSubmit={async (submission) => {
        console.info(submission);
      }}
      resetAfter={0}
      component={Root}
      slots={{ title: Title }}
      slotProps={{
        root: { title: 'Root override' },
        trigger: { title: 'Trigger override' },
        title: { title: 'Title override' },
        item: { ref: () => () => {}, onFocus: () => {} },
      }}
    />
  );
}`,
      },
    },
  },
  decorators: [
    (Story) => (
      <StrictMode>
        <Story />
      </StrictMode>
    ),
  ],
  args: {
    component: Root,
    slots: { title: Title },
    slotProps: {
      root: { title: 'Root override' },
      trigger: { title: 'Trigger override' },
      title: { title: 'Title override' },
      item: { ref: fn(() => fn()), onFocus: fn() },
    },
  },
  play: async ({ args, canvas, canvasElement, userEvent }) => {
    await expect(canvas.getByTitle('Root override')).toHaveAttribute('data-custom-root');
    await userEvent.click(canvas.getByRole('button', { name: 'Create' }));
    await expect(
      await within(canvasElement.ownerDocument.body).findByTitle('Title override'),
    ).toHaveAttribute('data-custom-title');
    const itemRef = args.slotProps?.item?.ref;
    await expect(itemRef).toHaveBeenCalledWith(
      within(canvasElement.ownerDocument.body).getByRole('menuitem', { name: 'Note' }),
    );
    await expect(args.slotProps?.item?.onFocus).toHaveBeenCalled();
    await userEvent.keyboard('{Escape}');
    if (typeof itemRef === 'function') {
      for (const result of mocked(itemRef).mock.results) {
        if (result.type === 'return' && typeof result.value === 'function')
          await expect(result.value).toHaveBeenCalledTimes(1);
      }
    }
  },
};
export const ReducedMotion: Story = {
  name: 'Action Reduced Motion',
  args: { corner: 'start' },
  parameters: {
    docs: {
      description: {
        story: 'Enable reduced motion in your system preferences, then open Create and choose an action.',
      },
    },
  },
};
export const RTL: Story = { args: { dir: 'rtl', corner: 'start' } };
export const RemovedDuringSubmit: Story = {
  render: function Removed(args) {
    const [visible, setVisible] = useState(true);
    return (
      <>
        {visible && <ActionMorph {...args} />}
        <Button onClick={() => setVisible(false)}>Remove</Button>
      </>
    );
  },
  play: async ({ args, canvas, canvasElement, userEvent }) => {
    let finish = () => {};
    args.onSubmit?.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const document = within(canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByRole('button', { name: 'Create' }));
    await userEvent.click(await document.findByRole('menuitem', { name: 'Note' }));
    await userEvent.type(await document.findByRole('textbox'), 'Draft');
    await userEvent.keyboard('{Enter}');
    await userEvent.click(canvas.getByRole('button', { name: 'Remove' }));
    const calls = args.onOpenChange?.mock.calls.length;
    finish();
    await Promise.resolve();
    await expect(document.queryByRole('dialog')).toBeNull();
    await expect(args.onOpenChange).toHaveBeenCalledTimes(calls ?? 0);
  },
};
