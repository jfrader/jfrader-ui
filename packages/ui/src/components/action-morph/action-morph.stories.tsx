import { StrictMode, useState, type ComponentPropsWithRef } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, mocked, waitFor, within } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { styled } from '../../styling/styled';
import { expectNativeScrollbar } from '../../testing/theme-assertions';
import { settleMotion } from '../../testing/motion-assertions';
import { ActionMorph, type ActionMorphAction } from './index';
import { Button } from '../button';
import { TextField } from '../text-field';
import { Stack } from '../stack';

const Stage = styled.div({
  minBlockSize: '30rem',
  paddingBlockStart: '24rem',
  display: 'flex',
  justifyContent: 'end',
  gap: vars.space[4],
});
const TopLane = styled.div({
  position: 'fixed',
  insetBlockStart: vars.space[4],
  insetInlineEnd: vars.space[4],
});

async function expectOrigin(surface: HTMLElement, side: 'top' | 'bottom', edge: 'left' | 'right') {
  await waitFor(() => expect(surface.getAttribute('data-placement')).toMatch(new RegExp(`^${side}`)));
  await settleMotion(surface);
  await waitFor(() => {
    const [x, y] = getComputedStyle(surface).transformOrigin.split(' ').map(Number.parseFloat);
    expect(x).toBeCloseTo(edge === 'left' ? 0 : surface.offsetWidth, 0);
    expect(y).toBeCloseTo(side === 'top' ? surface.offsetHeight : 0, 0);
  });
}
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
        component: 'Open a create menu from a button, then turn the menu into a short form for the selected action. Use it to add a note or send a message without leaving the page; the form shows the result of your submission.',
      },
      sections: [
        { title: 'Create and compose', stories: ['Default'] },
        { title: 'Placement', stories: ['CornerStart'] },
        { title: 'Consumer forms', stories: ['ContentComposer'] },
        { title: 'Action groups', stories: ['GroupedActions'] },
      ],
      usage: `### Drafts and submission
Use this for short drafts, Menu for immediate commands, and Dialog for longer forms. Drafts and choices stay in memory while mounted, including after Back or a failed request. Return the real promise from \`onSubmit\`; omitting it disables submission. Empty trimmed text is rejected, but the original text is submitted. Closing or going Back invalidates UI updates, not the app's request; cancellation belongs to the consumer. Give actions unique ids and shortcuts.

### Consumer forms

Content composers host your form without wrapping it in another form. Handle validation and submission in the consumer, then call \`close()\` when done or \`back()\` to return to the menu. Keep form values outside the content when they must survive navigation. Use Morph for steps without an action menu or for a bottom sheet.

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
export const GroupedActions: Story = {
  args: { label: 'Transfer', actions: [
    { id: 'send-money', label: 'Send money', group: 'Send', composer: { title: 'Send money', submitLabel: 'Send', successLabel: 'Sent' } },
    { id: 'send-request', label: 'Send request', group: 'Send', composer: { title: 'Send request', submitLabel: 'Send', successLabel: 'Sent' } },
    { id: 'receive-bank', label: 'Bank transfer', group: 'Receive', composer: { title: 'Bank transfer', submitLabel: 'Save', successLabel: 'Saved' } },
    { id: 'receive-link', label: 'Payment link', group: 'Receive', composer: { title: 'Payment link', submitLabel: 'Save', successLabel: 'Saved' } },
  ] },
  play: async ({ canvas, canvasElement, userEvent }) => {
    const doc = within(canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByRole('button', { name: 'Transfer' }));
    const menu = await doc.findByRole('menu', { name: 'Transfer' });
    await settleMotion(menu);
    const send = within(menu).getByRole('group', { name: 'Send' });
    const receive = within(menu).getByRole('group', { name: 'Receive' });
    await expect(within(send).getByText('Send', { exact: true })).toBeVisible();
    await expect(within(receive).getByText('Receive', { exact: true })).toBeVisible();
    await expect(within(send).getAllByRole('menuitem')).toHaveLength(2);
    await expect(within(receive).getAllByRole('menuitem')).toHaveLength(2);
    await waitFor(() => expect(within(send).getByRole('menuitem', { name: 'Send money' })).toHaveFocus());
    await userEvent.keyboard('{ArrowDown}{ArrowDown}');
    await expect(within(receive).getByRole('menuitem', { name: 'Bank transfer' })).toHaveFocus();
    await userEvent.keyboard('{ArrowUp}');
    await expect(within(send).getByRole('menuitem', { name: 'Send request' })).toHaveFocus();
  },
};
export const CornerStart: Story = {
  name: 'Grow from the start corner',
  args: { corner: 'start' },
  parameters: { docs: {
    description: { story: 'Open the same create actions from the logical start corner.' },
    source: { language: 'tsx', code: actionExample('start') },
  } },
};
export const EmptyActions: Story = { args: { actions: [] } };
export const MenuNamedAction: Story = {
  args: { actions: actions.slice(0, 1).map((action) => ({ ...action, id: 'menu' })) },
  tags: ['!autodocs'],
  play: async ({ args, canvas, canvasElement, userEvent }) => {
    const doc = within(canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByRole('button', { name: 'Create' }));
    await userEvent.click(await doc.findByRole('menuitem', { name: 'Note' }));
    const field = await doc.findByRole('textbox', { name: 'Note text' });
    await userEvent.type(field, 'Menu is a valid action id');
    await userEvent.keyboard('{Enter}');
    await waitFor(() => expect(args.onSubmit).toHaveBeenCalledWith({ action: 'menu', text: 'Menu is a valid action id', choice: undefined }));
  },
};
export const ContentComposer: Story = {
  name: 'Create a contact',
  args: {
    width: { menu: '16rem', composer: '24rem' },
    actions: [{ id: 'contact', label: 'Contact', composer: {
      kind: 'content', title: 'New contact',
      content: ({ close, back }) => <form onSubmit={(event) => { event.preventDefault(); close(); }}>
        <Stack gap="sm">
          <TextField label="Full name" name="name" required data-autofocus />
          <TextField label="Email" name="email" type="email" required />
          <TextField label="Company" name="company" required />
          <Button type="button" variant="ghost" onClick={back}>Back</Button>
          <Button type="submit">Create contact</Button>
        </Stack>
      </form>,
    } }],
  },
  parameters: { docs: {
    description: { story: 'Enter a name, email, and company, then create the contact.' },
    source: { language: 'tsx', code: `import { ActionMorph, Button, Stack, TextField } from '@jfrader/ui';

export function CreateContact() {
  return <ActionMorph label="Create" width={{ menu: '16rem', composer: '24rem' }} actions={[{
    id: 'contact', label: 'Contact', composer: {
      kind: 'content', title: 'New contact',
      content: ({ close, back }) => <form onSubmit={(event) => { event.preventDefault(); close(); }}>
        <Stack gap="sm">
          <TextField label="Full name" name="name" required data-autofocus />
          <TextField label="Email" name="email" type="email" required />
          <TextField label="Company" name="company" required />
          <Button type="button" variant="ghost" onClick={back}>Back</Button>
          <Button type="submit">Create contact</Button>
        </Stack>
      </form>,
    },
  }]} />;
}` },
  } },
  play: async ({ args, canvas, canvasElement, userEvent }) => {
    const doc = within(canvasElement.ownerDocument.body);
    const trigger = canvas.getByRole('button', { name: 'Create' });
    await userEvent.click(trigger);
    await userEvent.click(await doc.findByRole('menuitem', { name: 'Contact' }));
    const name = await doc.findByRole('textbox', { name: 'Full name' });
    await waitFor(() => expect(name.ownerDocument.activeElement).toBe(name));
    await expect(doc.getAllByRole('textbox')).toHaveLength(3);
    const surface = doc.getByRole('dialog', { name: 'New contact' });
    await expect(surface.querySelectorAll('form')).toHaveLength(1);
    await settleMotion(surface);
    await expect(surface.getBoundingClientRect().width).toBeCloseTo(384, 0);
    await userEvent.type(name, 'Sam Rivera');
    await userEvent.type(doc.getByRole('textbox', { name: 'Email' }), 'sam@example.com');
    await userEvent.type(doc.getByRole('textbox', { name: 'Company' }), 'Northline');
    await userEvent.click(doc.getByRole('button', { name: 'Create contact' }));
    await waitFor(() => expect(doc.queryByRole('dialog')).toBeNull());
    await expect(trigger.ownerDocument.activeElement).toBe(trigger);
    await expect(args.onSubmit).not.toHaveBeenCalled();
  },
};
export const PersistentMenu: Story = {
  args: { defaultOpen: true },
  tags: ['!autodocs'],
  play: async ({ canvasElement }) => {
    const menu = await within(canvasElement.ownerDocument.body).findByRole('menu');
    await expectNativeScrollbar(menu);
    await expectOrigin(menu, 'top', 'right');
  },
};

export const FlippedBelow: Story = {
  name: 'Grow below a trigger near the top edge',
  render: (args) => <TopLane><ActionMorph {...args} /></TopLane>,
  play: async ({ canvas, canvasElement, userEvent }) => {
    const document = within(canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByRole('button', { name: 'Create' }));
    const menu = await document.findByRole('menu');
    await expectOrigin(menu, 'bottom', 'right');
    await userEvent.click(document.getByRole('menuitem', { name: 'Note' }));
    const composer = await document.findByRole('dialog');
    await expectOrigin(composer, 'bottom', 'right');
    await userEvent.keyboard('{Escape}{Escape}');
    await expect(composer).toHaveAttribute('inert');
    await expect(composer).toHaveAttribute('aria-hidden', 'true');
    await expectOrigin(composer, 'bottom', 'right');
    await waitFor(() => expect(composer.isConnected).toBe(false));
  },
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
    await waitFor(() => expect(canvasElement.ownerDocument.querySelector('[data-ui="action-morph-surface"]')).toBeNull());
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
  args: { corner: 'end' },
  parameters: {
    docs: {
      description: {
        story: 'Enable reduced motion in your system preferences, then open Create and choose an action.',
      },
    },
  },
  play: async ({ canvas, canvasElement, userEvent }) => {
    const document = within(canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByRole('button', { name: 'Create' }));
    const menu = await document.findByRole('menu');
    await expectOrigin(menu, 'top', 'right');
    await expect(getComputedStyle(menu).scale).toBe('none');
    await expect(getComputedStyle(menu).transitionDuration).toBe('0s');
    await userEvent.click(document.getByRole('menuitem', { name: 'Note' }));
    const composer = await document.findByRole('dialog');
    await expect(getComputedStyle(composer).scale).toBe('none');
    await expect(getComputedStyle(composer).transitionDuration).toBe('0s');
    await userEvent.keyboard('{Escape}{Escape}');
    await waitFor(() => expect(composer.isConnected).toBe(false));
  },
};
export const RTL: Story = {
  args: { dir: 'rtl', corner: 'start' },
  play: async ({ canvas, canvasElement, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Create' }));
    const menu = await within(canvasElement.ownerDocument.body).findByRole('menu');
    await expect(getComputedStyle(menu).direction).toBe('rtl');
    await expectOrigin(menu, 'top', 'right');
  },
};
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
