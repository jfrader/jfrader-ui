import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { expect, fn, waitFor, within } from 'storybook/test';
import { expectAligned } from '../../testing/geometry-assertions';
import { vars } from '@jfrader/tokens/vars';
import { styled } from '../../styling/styled';
import { Button } from '../button';
import { ShareSheet } from '../share-sheet';
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
const sharePanelSource = `import { ShareAccess, Surface, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const SharePanel = styled(Surface)({ boxSizing: 'border-box',
  inlineSize: \`calc(\${vars.space[8]} * 18)\`, maxInlineSize: '100%', padding: vars.space[6] });`;
const meta = {
  title: 'Actions/ShareAccess',
  component: ShareAccess,
  tags: ['autodocs'],
  render: (args) => <SharePanel><ShareAccess {...args} /></SharePanel>,
  parameters: {
    layout: 'padded',
    docs: {
      sections: [
        { title: 'People and permissions', stories: ['Default', 'PendingInvite', 'EmptyMembers'] },
        { title: 'Link sharing', stories: ['LinkAccess'] },
        { title: 'Choosing a sharing surface', stories: ['ShareAccessOrShareSheet'] },
      ],
      description: {
        component:
          'Invite people to a document, change their roles, and choose who can use its link.',
      },
      usage: `### When to use
- Use ShareAccess where people manage a document's access over time: who has it, with which role, and whether the link works for anyone.
- Use ShareSheet to send a link once to a few people or channels. It keeps no member list and no roles.

### Invitations
- Owners cannot be changed or removed. Persist invitations in your app; no network calls or permission enforcement are included. A rejected invitation preserves the draft. When controlling members, reflect invited email addresses in the member list to clear submitted chips.
- Undo remains available until dismissed and inserts the removed person around their surviving neighbors.

### Keyboard and accessibility

- Type an email and press Enter, comma or semicolon to add it. Tab adds the draft and advances focus. Enter on an empty field sends existing chips.
- Up/Down navigate directory suggestions; Home/End select the edges while open. Escape closes suggestions before the host overlay. Focus stays in the field.
- Empty Backspace selects the final chip; press again to remove it. Buttons use Enter/Space; role and access pickers use Select's keyboard map.

### Hosting

- Put it inside a Dialog or Popover; the host owns opening and focus containment. Inside a native modal, scope nested portals to the modal subtree with ThemeRoot's portalContainer.
- Translate labels and announcements for your audience.`,
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
  name: 'Manage collaborators',
  parameters: { docs: {
    description: { story: 'Invite people, change a collaborator’s role, or remove someone and undo it.' },
    source: { language: 'tsx', code: `${sharePanelSource}

<SharePanel>
<ShareAccess
  title="Roadmap"
  link="https://example.com/roadmap"
  selfId="owner"
  defaultValue={[
    { id: 'owner', name: 'Alex Rivera', email: 'alex@example.com', role: 'owner' },
    { id: 'editor', name: 'Sam Lee', email: 'sam@example.com', role: 'editor' },
  ]}
  directory={[
    { email: 'jo@example.com', name: 'Jo Morgan' },
    { email: 'jamie@example.com', name: 'Jamie Bell' },
  ]}
/>
</SharePanel>` },
  } },
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

    // Rows share one grid: names, the role column and the remove column line up across rows.
    const part = (row: HTMLElement, name: string) =>
      row.querySelector<HTMLElement>(`:scope > [data-part="${name}"]`)!;
    await expectAligned([part(ownerRow, 'role'), part(memberRow, 'role')], 'left');
    await expectAligned(
      [...rows].map((row) => row.querySelector<HTMLElement>(':scope > span:nth-child(2)')!),
      'left',
    );
    const owner = within(ownerRow).getByText('Owner');
    await expect(within(ownerRow).queryByRole('button')).not.toBeInTheDocument();
    await expect(within(ownerRow).queryByRole('combobox')).not.toBeInTheDocument();
    await expect(owner).toBeVisible();

    const role = within(memberRow).getByRole('combobox', { name: 'Role for Sam Lee' });
    const remove = within(memberRow).getByRole('button', { name: 'Remove Sam Lee' });
    await expect(role).toBeVisible();
    await expect(role.getBoundingClientRect().right).toBeLessThan(remove.getBoundingClientRect().left);
    await expect(remove.getBoundingClientRect().width).toBe(32);
    await expect(remove.getBoundingClientRect().height).toBe(32);
    await expect(remove.getBoundingClientRect().right).toBeCloseTo(memberRow.getBoundingClientRect().right, 0);
    // The invitation shares the member columns: role controls and trailing actions line up even
    // though Invite is wider than a remove button.
    await expectAligned([inviteControl, memberControl], 'right');
    await expectAligned([invite, remove], 'right');
    const roleLabel = memberRow.querySelector<HTMLElement>('[data-ui="select-label"]')!;
    await expect(roleLabel.parentElement!.getBoundingClientRect().width).toBeLessThanOrEqual(1);
    await expect(within(memberRow).getByText('sam@example.com')).toBeVisible();

    // The link controls sit after the people, under their own heading and rule.
    const people = canvas.getByRole('heading', { name: 'People with access', level: 3 });
    const general = canvas.getByRole('heading', { name: 'General access', level: 3 });
    await expect(people.compareDocumentPosition(general) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const access = canvasElement.querySelector<HTMLElement>(
      '[data-ui="select-trigger"][data-share-control="access"]',
    )!;
    await expect(general.compareDocumentPosition(access) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    await expectAligned([access, access.parentElement!], 'right');
  },
};
export const Light: Story = { globals: { theme: 'light' } };
export const LinkAccess: Story = {
  name: 'Anyone with the link',
  parameters: { docs: {
    description: { story: 'Choose the role granted to people who open the shared link.' },
    source: { language: 'tsx', code: `${sharePanelSource}

<SharePanel>
<ShareAccess title="Roadmap" link="https://example.com/roadmap" selfId="owner"
  defaultAccess="link"
  defaultValue={[
    { id: 'owner', name: 'Alex Rivera', email: 'alex@example.com', role: 'owner' },
    { id: 'editor', name: 'Sam Lee', email: 'sam@example.com', role: 'editor' },
  ]}
  directory={[
    { email: 'jo@example.com', name: 'Jo Morgan' },
    { email: 'jamie@example.com', name: 'Jamie Bell' },
  ]}
/>
</SharePanel>` },
  } },
  args: { defaultAccess: 'link' },
};
export const EmptyMembers: Story = {
  name: 'First invitation',
  parameters: { docs: {
    description: { story: 'Add the first collaborator to an empty access list.' },
    source: { language: 'tsx', code: `${sharePanelSource}

<SharePanel>
<ShareAccess title="Roadmap" link="https://example.com/roadmap" selfId="owner"
  defaultValue={[]}
  directory={[
    { email: 'jo@example.com', name: 'Jo Morgan' },
    { email: 'jamie@example.com', name: 'Jamie Bell' },
  ]}
/>
</SharePanel>` },
  } },
  args: { defaultValue: [] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('heading', { name: 'No people added', level: 4 })).toBeVisible();
    await expect(canvas.getByText('Invite people by name or email.')).toBeVisible();
    await expect(canvas.queryByRole('list', { name: 'People with access' })).not.toBeInTheDocument();
  },
};
export const PendingInvite: Story = {
  name: 'Pending invitation',
  parameters: { docs: {
    description: { story: 'Show an invited person alongside existing collaborators.' },
    source: { language: 'tsx', code: `${sharePanelSource}

<SharePanel>
<ShareAccess title="Roadmap" link="https://example.com/roadmap" selfId="owner"
  defaultValue={[
    { id: 'owner', name: 'Alex Rivera', email: 'alex@example.com', role: 'owner' },
    { id: 'editor', name: 'Sam Lee', email: 'sam@example.com', role: 'editor' },
    { id: 'pending', name: 'Jo Morgan', email: 'jo@example.com', role: 'viewer', pending: true },
  ]}
  directory={[
    { email: 'jo@example.com', name: 'Jo Morgan' },
    { email: 'jamie@example.com', name: 'Jamie Bell' },
  ]}
/>
</SharePanel>` },
  } },
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
const SurfaceChoice = styled('div')({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'flex-start',
  gap: vars.space[6],
});
export const ShareAccessOrShareSheet: Story = {
  name: 'ShareAccess or ShareSheet',
  parameters: { docs: {
    description: {
      story:
        'Use ShareAccess to manage who keeps access and with which role. Use ShareSheet, behind its Share button, to send the link once.',
    },
    source: { language: 'tsx', code: `${sharePanelSource}

<SharePanel>
  <ShareAccess
    title="Roadmap"
    link="https://example.com/roadmap"
    selfId="owner"
    defaultValue={[
      { id: 'owner', name: 'Alex Rivera', email: 'alex@example.com', role: 'owner' },
      { id: 'editor', name: 'Sam Lee', email: 'sam@example.com', role: 'editor' },
    ]}
  />
</SharePanel>
<ShareSheet
  title="Roadmap"
  link="https://example.com/roadmap"
  people={[
    { id: 'jo', name: 'Jo Morgan' },
    { id: 'jamie', name: 'Jamie Bell' },
  ]}
  accessOptions={[
    { value: 'view', label: 'Can view' },
    { value: 'comment', label: 'Can comment' },
  ]}
/>` },
  } },
  render: (args) => (
    <SurfaceChoice>
      <SharePanel><ShareAccess {...args} /></SharePanel>
      <ShareSheet
        title="Roadmap"
        link="https://example.com/roadmap"
        people={[
          { id: 'jo', name: 'Jo Morgan' },
          { id: 'jamie', name: 'Jamie Bell' },
        ]}
        accessOptions={[
          { value: 'view', label: 'Can view' },
          { value: 'comment', label: 'Can comment' },
        ]}
      />
    </SurfaceChoice>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('list', { name: 'People with access' })).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'Share' })).toHaveAttribute('aria-expanded', 'false');
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
    const canvas = within(canvasElement);
    await expectAligned(
      [canvas.getByRole('button', { name: 'Invite' }), canvas.getByRole('button', { name: 'Remove Sam Lee' })],
      'right',
    );
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
    await expectRowsSettled(canvasElement);
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
    // Clearing the chips shifts the member list up. Rows spring only when membership changes,
    // so they move with the list instead of sliding over the link section below.
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
    for (const row of canvasElement.querySelectorAll<HTMLElement>('[data-ui="share-access-member"]')) {
      await expect(getComputedStyle(row).transform).toBe('none');
    }
    await expectRowsSettled(canvasElement);
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
    const chip = within(canvas.getByRole('list', { name: 'Invitations' })).getByRole('listitem');
    // The chip names its own problem in text, not only with its danger border.
    await expect(within(chip).getByText('Enter a valid email address.')).toBeVisible();
    await expect(chip).toHaveAttribute('data-invalid', 'true');
    await userEvent.click(canvas.getByRole('button', { name: 'Invite' }));
    await expect(canvas.getByRole('alert')).toHaveTextContent('Enter a valid email address.');
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
  args: {
    defaultValue: [...members, { id: 'viewer', email: 'jo@example.com', name: 'Jo Morgan', role: 'viewer' }],
    onValueChange: fn(),
  },
  play: async ({ canvasElement, userEvent, args }) => {
    const canvas = within(canvasElement);
    const order = () =>
      [...canvasElement.querySelectorAll<HTMLElement>('[data-ui="share-access-member"]')].map(
        (row) => row.dataset.memberId,
      );
    await expect(
      canvas.queryByRole('button', { name: 'Remove Alex Rivera' }),
    ).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole('button', { name: 'Remove Sam Lee' }));
    await expect(order()).toEqual(['owner', 'viewer']);
    const undoList = canvas.getByRole('list', { name: 'Removed' });
    await expect(within(undoList).getByText('Sam Lee')).toBeVisible();
    const undo = canvas.getByRole('button', { name: 'Undo' });
    await expect(canvasElement.ownerDocument.activeElement).toBe(undo);
    await expect(getComputedStyle(undo).outlineStyle).not.toBe('none');
    await userEvent.keyboard('{Enter}');
    // Undo puts the person back between their old neighbors, with focus on their row.
    await expect(order()).toEqual(['owner', 'editor', 'viewer']);
    await expect(canvasElement.ownerDocument.activeElement).toBe(
      canvas.getByRole('combobox', { name: 'Role for Sam Lee' }),
    );
    await expect(canvas.queryByRole('button', { name: 'Undo' })).not.toBeInTheDocument();
    await expect(args.onValueChange).toHaveBeenCalledTimes(2);
    await expect(args.onValueChange).toHaveBeenLastCalledWith([
      members[0],
      members[1],
      expect.objectContaining({ id: 'viewer' }),
    ]);
  },
};

export const ChangeRole: Story = {
  tags: ['!autodocs'],
  args: { onValueChange: fn() },
  play: async ({ canvasElement, userEvent, args }) => {
    const canvas = within(canvasElement);
    const role = canvas.getByRole('combobox', { name: 'Role for Sam Lee' });
    await expect(role).toHaveTextContent('Editor');
    await userEvent.click(role);
    await userEvent.keyboard('{End}{Enter}');
    await expect(role).toHaveTextContent('Viewer');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenCalledWith([
      members[0],
      { ...members[1], role: 'viewer' },
    ]);
    await expect(canvasElement.querySelector('[data-ui="share-access-status"]')).toHaveTextContent(
      'Updated role for Sam Lee',
    );
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
      await expect(separated, 'member rows do not overlap').toBe(true);
      await expect(targetsClear(), 'row controls meet target size and hit-test bounds').toBe(true);
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );
      const next = boxes();
      await expect(targetsClear(), 'row controls remain usable after layout').toBe(true);
      await expect(next, 'row count remains stable').toHaveLength(current.length);
      await expect(
        next.every((box, index) => Math.abs(box.top - current[index]!.top) <= 0.5),
        'member rows stop moving',
      ).toBe(true);
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
