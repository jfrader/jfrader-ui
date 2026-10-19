import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { expect, fn, waitFor, within } from 'storybook/test';
import { expectAligned } from '../../testing/geometry-assertions';
import { vars } from '@jfrader/tokens/vars';
import { styled } from '../../styling/styled';
import { Button } from '../button';
import { Surface } from '../surface';
import { ShareAccess, type ShareAccessMember } from './index';

const members: ShareAccessMember[] = [
  {
    id: 'owner',
    email: 'alex@example.com',
    name: 'Alex Rivera',
    role: 'owner',
  },
  { id: 'editor', email: 'sam@example.com', name: 'Sam Lee', role: 'editor' },
];
const directory = [
  { email: 'jo@example.com', name: 'Jo Morgan' },
  { email: 'jamie@example.com', name: 'Jamie Bell' },
];
const SharePanel = styled(Surface)({
  boxSizing: 'border-box',
  inlineSize: `calc(${vars.space[8]} * 18)`,
  maxInlineSize: '100%',
  padding: vars.space[6],
});
const snippet = `<ShareAccess
  title="Roadmap"
  link="https://example.com/roadmap"
  defaultValue={[
    { id: 'alex', name: 'Alex Rivera', email: 'alex@example.com', role: 'owner' },
  ]}
  onInvite={async (people, role) => { await invitePeople(people, role); }}
/>`;
const meta = {
  title: 'Actions/ShareAccess',
  component: ShareAccess,
  tags: ['autodocs'],
  render: (args) => <SharePanel><ShareAccess {...args} /></SharePanel>,
  parameters: {
    docs: {
      description: {
        component:
          'Invite people to a document, change their roles, and choose who can use its link.',
      },
      usage: `### Values
- Members, general access, invitation role and link role each support controlled and uncontrolled use. Owners cannot be changed or removed.
- Return a promise from \`onInvite\` to persist invitations. A rejection preserves the draft. In controlled mode, reflect invited email addresses in \`value\` to clear submitted chips.
- Undo remains available until dismissed and inserts the removed person around their surviving neighbours.

### Keyboard
- Type an email and press Enter, comma or semicolon to add it. Tab adds the draft and advances focus. Enter on an empty field sends existing chips.
- Up/Down navigate directory suggestions; Home/End select the edges while open. Escape closes suggestions before the host overlay. Focus stays in the field.
- Empty Backspace selects the final chip; press again to remove it. Buttons use Enter/Space; role and access pickers use Select's keyboard map.

### Composition
- ShareAccess uses ShareSheet's inline presentation for its heading, link copying and general-access picker. Role pickers use Select's combobox/listbox semantics, not menu roles.
- Put it inside a Dialog or Popover; the host owns opening and focus containment. Inside a native modal, scope nested portals to the modal subtree with ThemeRoot's portalContainer.
- No network calls or permission enforcement are included. Labels and announcements are supplied through \`messages\`.`,
      source: { code: snippet, language: 'tsx' },
    },
  },
  args: {
    title: 'Roadmap',
    link: 'https://example.com/roadmap',
    defaultValue: members,
    directory,
    selfId: 'owner',
  },
} satisfies Meta<typeof ShareAccess>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const invite = canvas.getByRole('button', { name: 'Invite' });
    const inviteControl = invite.parentElement!.querySelector<HTMLElement>(
      '[data-ui="select-trigger"]',
    )!;
    await expectAligned([invite, inviteControl], 'bottom');

    const rows = canvasElement.querySelectorAll<HTMLElement>(
      '[data-ui="share-access-member-list"] > li',
    );
    const ownerRow = rows[0]!;
    const memberRow = rows[1]!;
    const memberControl = memberRow.querySelector<HTMLElement>('[data-ui="select-trigger"]')!;
    await expectAligned([memberRow, memberControl], 'center-y');
    await expect(
      Math.abs(ownerRow.getBoundingClientRect().height - memberRow.getBoundingClientRect().height),
    ).toBeLessThanOrEqual(1);

    const role = within(memberRow).getByRole('combobox', { name: 'Role for Sam Lee' });
    await expect(role).toBeVisible();
    await expect(role.getBoundingClientRect().height).toBe(40);
    const roleLabel = memberRow.querySelector<HTMLElement>('[data-ui="select-label"]')!;
    await expect(roleLabel.parentElement!.getBoundingClientRect().width).toBeLessThanOrEqual(1);

    const access = canvasElement.querySelector<HTMLElement>(
      '[data-ui="select-trigger"][data-share-control="access"]',
    )!;
    await expectAligned([access, access.parentElement!], 'right');
  },
};
export const Light: Story = { globals: { theme: 'light' } };
export const LinkAccess: Story = { args: { defaultAccess: 'link' } };
export const EmptyMembers: Story = { args: { defaultValue: [] } };
export const PendingInvite: Story = {
  args: {
    defaultValue: [
      ...members,
      {
        id: 'pending',
        email: 'jo@example.com',
        name: 'Jo Morgan',
        role: 'viewer',
        pending: true,
      },
    ],
  },
};
export const RTL: Story = { args: { dir: 'rtl', defaultAccess: 'link' } };
const NarrowFrame = styled('div')({
  inlineSize: '320px',
  maxInlineSize: '100%',
  padding: vars.space[2],
});
export const Narrow: Story = {
  render: (args) => (
    <NarrowFrame>
      <ShareAccess {...args} />
    </NarrowFrame>
  ),
  parameters: {
    docs: {
      source: {
        code: '<ShareAccess title="Roadmap" link={url} defaultValue={members} />',
        language: 'tsx',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const root = canvasElement.querySelector<HTMLElement>('[data-ui="share-access"]')!;
    const bounds = root.getBoundingClientRect();
    await expect(bounds.width).toBeLessThanOrEqual(320);
    for (const control of root.querySelectorAll<HTMLElement>('button, input')) {
      const rect = control.getBoundingClientRect();
      await expect(rect.left).toBeGreaterThanOrEqual(bounds.left - 1);
      await expect(rect.right).toBeLessThanOrEqual(bounds.right + 1);
    }
  },
};

export const KeyboardInvites: Story = {
  tags: ['!autodocs'],
  args: { onValueChange: fn(), onInvite: fn() },
  play: async ({ canvasElement, userEvent, args }) => {
    const canvas = within(canvasElement);
    const field = canvas.getByRole('combobox', { name: 'Name or email' });
    await userEvent.tab();
    await expect(canvasElement.ownerDocument.activeElement).toBe(field);
    await expect(getComputedStyle(field).outlineStyle).not.toBe('none');
    await userEvent.type(field, 'new@example.com');
    await userEvent.keyboard('{Enter}');
    await expect(
      within(canvas.getByRole('list', { name: 'Invitations' })).getByText('new@example.com'),
    ).toBeVisible();
    await userEvent.keyboard('{Enter}');
    await expect(args.onInvite).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(
      within(canvas.getByRole('list', { name: 'People with access' })).getByRole('button', {
        name: 'Remove new@example.com',
      }),
    ).toBeVisible();
    await expect(canvas.getByRole('list', { name: 'Invitations' })).toBeEmptyDOMElement();
  },
};

export const InviteWithoutRandomUUID: Story = {
  tags: ['!autodocs'],
  args: { onValueChange: fn() },
  beforeEach: () => {
    const descriptor = Object.getOwnPropertyDescriptor(crypto, 'randomUUID');
    Object.defineProperty(crypto, 'randomUUID', { configurable: true, value: undefined });
    return () => {
      if (descriptor) Object.defineProperty(crypto, 'randomUUID', descriptor);
      else Reflect.deleteProperty(crypto, 'randomUUID');
    };
  },
  play: async ({ canvasElement, userEvent, args }) => {
    const canvas = within(canvasElement);
    await expect(crypto.randomUUID).toBeUndefined();
    await userEvent.type(
      canvas.getByRole('combobox', { name: 'Name or email' }),
      'new@example.com{Enter}',
    );
    await userEvent.click(canvas.getByRole('button', { name: 'Invite' }));
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenCalledWith([
      ...members,
      expect.objectContaining({
        id: expect.stringMatching(/^member-\d+-[a-z0-9]+$/),
        email: 'new@example.com',
        role: 'editor',
        pending: true,
      }),
    ]);
    await expect(
      within(canvas.getByRole('list', { name: 'People with access' })).getByRole('button', {
        name: 'Remove new@example.com',
      }),
    ).toBeVisible();
    await expect(canvas.getByRole('list', { name: 'Invitations' })).toBeEmptyDOMElement();
  },
};

export const InvalidChip: Story = {
  tags: ['!autodocs'],
  play: async ({ canvasElement, userEvent }) => {
    const canvas = within(canvasElement);
    await userEvent.type(
      canvas.getByRole('combobox', { name: 'Name or email' }),
      'not-an-email{Enter}',
    );
    await userEvent.click(canvas.getByRole('button', { name: 'Invite' }));
    await expect(canvas.getByText('Enter a valid email address.')).toBeVisible();
    await expect(canvas.getByRole('combobox', { name: 'Name or email' })).toHaveAttribute(
      'aria-invalid',
      'true',
    );
  },
};

export const InviteFailure: Story = {
  tags: ['!autodocs'],
  args: {
    onInvite: fn(async () => {
      throw new Error('Offline');
    }),
  },
  play: async ({ canvasElement, userEvent }) => {
    const canvas = within(canvasElement);
    await userEvent.type(
      canvas.getByRole('combobox', { name: 'Name or email' }),
      'new@example.com{Enter}',
    );
    await userEvent.click(canvas.getByRole('button', { name: 'Invite' }));
    await expect(canvas.getByText('Could not invite. Try again.')).toBeVisible();
    await expect(
      within(canvas.getByRole('list', { name: 'Invitations' })).getByText('new@example.com'),
    ).toBeVisible();
  },
};

export const RemoveAndUndo: Story = {
  tags: ['!autodocs'],
  play: async ({ canvasElement, userEvent }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.queryByRole('button', { name: 'Remove Alex Rivera' }),
    ).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole('button', { name: 'Remove Sam Lee' }));
    const undo = canvas.getByRole('button', { name: 'Undo' });
    await expect(canvasElement.ownerDocument.activeElement).toBe(undo);
    await userEvent.keyboard('{Enter}');
    await expect(canvas.getByRole('button', { name: 'Remove Sam Lee' })).toBeVisible();
    await expect(canvas.queryByRole('button', { name: 'Undo' })).not.toBeInTheDocument();
  },
};

export const ControlledRejects: Story = {
  tags: ['!autodocs'],
  args: {
    value: members,
    access: 'restricted',
    inviteRole: 'editor',
    linkRole: 'viewer',
    onValueChange: fn(),
    onAccessChange: fn(),
    onInviteRoleChange: fn(),
  },
  play: async ({ canvasElement, userEvent, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Remove Sam Lee' }));
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(canvas.getByRole('button', { name: 'Remove Sam Lee' })).toBeVisible();
    await expect(canvas.queryByRole('button', { name: 'Undo' })).not.toBeInTheDocument();
    const access = canvas.getByRole('combobox', { name: 'General access' });
    await userEvent.click(access);
    await userEvent.keyboard('{End}{Enter}');
    await expect(args.onAccessChange).toHaveBeenCalledWith('link');
    await expect(access).toHaveTextContent('Restricted');
    await expect(canvas.queryByRole('combobox', { name: 'Link role' })).not.toBeInTheDocument();
  },
};

function ConcurrentFixture() {
  const [value, setValue] = useState(members);
  return (
    <>
      <ShareAccess
        title="Roadmap"
        link="https://example.com/roadmap"
        value={value}
        onValueChange={setValue}
      />
      <Button
        onClick={() =>
          setValue((list) => [...list, { id: 'new', email: 'new@example.com', role: 'viewer' }])
        }
      >
        Add collaborator
      </Button>
    </>
  );
}
async function expectRowsSettled(canvasElement: HTMLElement) {
  const boxes = () =>
    [...canvasElement.querySelectorAll<HTMLElement>('[data-ui="share-access-member-list"] > li')].map(
      (row) => row.getBoundingClientRect(),
    );
  const targetsClear = () =>
    [...canvasElement.querySelectorAll<HTMLElement>('[data-ui="select-trigger"], button[aria-label^="Remove "]')].every(
      (target) => {
        const box = target.getBoundingClientRect();
        // A row mid-layout can scale the control below the 24px target-size floor while the
        // hit-test still lands inside it; require the settled size as well.
        if (box.width < 24 || box.height < 24) return false;
        return [box.top + 2, box.top + box.height / 2, box.bottom - 2].every((y) => {
          const hit = target.ownerDocument.elementFromPoint(box.left + box.width / 2, y);
          return !!hit && target.contains(hit);
        });
      },
    );
  await waitFor(
    async () => {
      const current = boxes();
      const separated = current.every(
        (box, index) => index === 0 || box.top >= current[index - 1]!.bottom - 1,
      );
      if (!separated || !targetsClear()) return false;
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );
      const next = boxes();
      return (
        targetsClear() &&
        next.every((box, index) => Math.abs(box.top - current[index]!.top) <= 0.5)
      );
    },
    { timeout: 3000 },
  );
}

export const ConcurrentUndo: Story = {
  tags: ['!autodocs'],
  render: () => (
    <SharePanel>
      <ConcurrentFixture />
    </SharePanel>
  ),
  parameters: {
    docs: {
      source: {
        code: '<ShareAccess title="Roadmap" link={url} value={members} onValueChange={setMembers} />',
        language: 'tsx',
      },
    },
  },
  play: async ({ canvasElement, userEvent }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Remove Sam Lee' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Add collaborator' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Undo' }));
    await expect(canvas.getByRole('button', { name: 'Remove Sam Lee' })).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'Remove new@example.com' })).toBeVisible();
    await expectRowsSettled(canvasElement);
    // Motion's layout spring has no DOM completion event; two stable frames can land on a
    // momentary plateau. Wait out the ~500ms settle before Storybook's a11y afterEach.
    await new Promise((resolve) => setTimeout(resolve, 600));
    await expectRowsSettled(canvasElement);
  },
};

export const DirectoryKeyboard: Story = {
  tags: ['!autodocs'],
  play: async ({ canvasElement, userEvent }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole('combobox', { name: 'Name or email' });
    await userEvent.type(input, 'Jo');
    await userEvent.keyboard('{ArrowDown}{Home}');
    await expect(canvasElement.ownerDocument.activeElement).toBe(input);
    await expect(input).toHaveAttribute('aria-activedescendant');
    await userEvent.keyboard('{Enter}');
    await expect(input).toHaveValue('');
    await expect(
      within(canvas.getByRole('list', { name: 'Invitations' })).getByText('jo@example.com'),
    ).toBeVisible();
    await userEvent.keyboard('{Backspace}{Backspace}');
    await expect(canvas.getByRole('list', { name: 'Invitations' })).toBeEmptyDOMElement();
  },
};
