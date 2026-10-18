import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState, type ComponentPropsWithRef } from 'react';
import { expect, fn, waitFor, within } from 'storybook/test';
import { Button } from '../button';
import { Popover } from '../popover';
import { Dialog } from '../dialog';
import { ThemeRoot } from '../theme-root';
import { ShareAccess, type ShareAccessMember } from './index';

const meta = {
  title: 'Actions/ShareAccess',
  component: ShareAccess,
  tags: ['!autodocs'],
  parameters: {
    docs: {
      description: { component: 'Invite people and manage roles inside a sharing surface.' },
      source: {
        code: '<ShareAccess title="Roadmap" link={url} value={members} onValueChange={setMembers} />',
        language: 'tsx',
      },
    },
  },
  args: { title: 'Roadmap', link: 'https://example.com/roadmap' },
} satisfies Meta<typeof ShareAccess>;
export default meta;
type Story = StoryObj<typeof meta>;

function Root(props: ComponentPropsWithRef<'section'>) {
  return <section {...props} data-testid="replaced-root" />;
}
export const RootCustomization: Story = {
  args: {
    component: Root,
    'aria-describedby': 'outer-description',
    sx: { paddingInline: 'var(--ui-space-4)' },
    slotProps: {
      root: {
        className: 'custom-access',
        'aria-describedby': 'inner-description',
        style: { opacity: 0.9 },
      },
      heading: { className: 'custom-heading' },
    },
  },
  render: (args) => (
    <>
      <span id="inner-description">Collaborators</span>
      <ShareAccess {...args} />
    </>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const root = canvas.getByTestId('replaced-root');
    await expect(root).toHaveClass('custom-access');
    await expect(root).toHaveAttribute('data-ui', 'share-access');
    await expect(root).toHaveAttribute('aria-describedby', 'inner-description');
    await expect(canvas.getByRole('heading')).toHaveClass('custom-heading');
  },
};

function PendingFixture() {
  const [complete, setComplete] = useState<(() => void) | null>(null);
  return (
    <>
      <ShareAccess
        title="Roadmap"
        link="https://example.com/roadmap"
        onInvite={() => new Promise<void>((resolve) => setComplete(() => resolve))}
      />
      <Button onClick={() => complete?.()}>Complete invitation</Button>
    </>
  );
}
export const DeferredInvite: Story = {
  render: () => <PendingFixture />,
  play: async ({ canvasElement, userEvent }) => {
    const canvas = within(canvasElement);
    await userEvent.type(
      canvas.getByRole('combobox', { name: 'Name or email' }),
      'jo@example.com{Enter}',
    );
    await userEvent.click(canvas.getByRole('button', { name: 'Invite' }));
    await expect(canvas.getByRole('combobox', { name: 'Name or email' })).toBeDisabled();
    await expect(canvas.getByRole('button', { name: 'Sending…' })).toHaveAttribute(
      'aria-busy',
      'true',
    );
    await userEvent.click(canvas.getByRole('button', { name: 'Complete invitation' }));
    await expect(canvas.getByRole('button', { name: 'Remove jo@example.com' })).toBeVisible();
    await expect(canvas.getByRole('list', { name: 'Invitations' })).toBeEmptyDOMElement();
  },
};

function ReflectionFixture() {
  const [members, setMembers] = useState<ShareAccessMember[]>([]);
  const [requested, setRequested] = useState<ShareAccessMember[]>([]);
  return (
    <>
      <ShareAccess
        title="Roadmap"
        link="https://example.com/roadmap"
        value={members}
        onValueChange={setRequested}
      />
      <Button onClick={() => setMembers(requested)}>Accept changes</Button>
    </>
  );
}
export const ReflectedInvite: Story = {
  render: () => <ReflectionFixture />,
  play: async ({ canvasElement, userEvent }) => {
    const canvas = within(canvasElement);
    await userEvent.type(
      canvas.getByRole('combobox', { name: 'Name or email' }),
      'jo@example.com{Enter}',
    );
    await userEvent.click(canvas.getByRole('button', { name: 'Invite' }));
    await expect(
      within(canvas.getByRole('list', { name: 'Invitations' })).getByText('jo@example.com'),
    ).toBeVisible();
    await expect(canvas.queryByText('Invitations sent')).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole('button', { name: 'Accept changes' }));
    await expect(canvas.getByRole('list', { name: 'Invitations' })).toBeEmptyDOMElement();
    await expect(canvas.getByText('Invitations sent')).toBeInTheDocument();
  },
};

export const CopyFailure: Story = {
  args: { onCopyLink: fn() },
  beforeEach: () => {
    const descriptor = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async () => {
          throw new Error('Denied');
        },
      },
    });
    return () => {
      if (descriptor) Object.defineProperty(navigator, 'clipboard', descriptor);
      else Reflect.deleteProperty(navigator, 'clipboard');
    };
  },
  play: async ({ canvasElement, userEvent, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Copy link' }));
    await expect(
      canvas.getByText('Could not copy link. Try again.', { selector: 'p' }),
    ).toBeVisible();
    await expect(args.onCopyLink).not.toHaveBeenCalled();
  },
};

export const HostPopover: Story = {
  render: (args) => (
    <Popover>
      <Popover.Trigger>Share document</Popover.Trigger>
      <Popover.Content aria-label="Sharing">
        <ShareAccess {...args} />
      </Popover.Content>
    </Popover>
  ),
  play: async ({ canvasElement, userEvent }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Share document' }));
    const body = within(canvasElement.ownerDocument.body);
    await expect(body.getByRole('heading', { name: 'Share Roadmap' })).toBeVisible();
    await userEvent.click(body.getByRole('combobox', { name: 'Invitation role' }));
    await userEvent.keyboard('{End}{Enter}');
    await expect(body.getByRole('combobox', { name: 'Invitation role' })).toHaveTextContent(
      'Viewer',
    );
    await userEvent.keyboard('{Escape}');
    await expect(body.queryByRole('heading', { name: 'Share Roadmap' })).not.toBeInTheDocument();
    await expect(canvasElement.ownerDocument.activeElement).toBe(
      canvas.getByRole('button', { name: 'Share document' }),
    );
  },
};

function DialogFixture() {
  const [panel, setPanel] = useState<HTMLDivElement | null>(null);
  return (
    <ThemeRoot theme="dark" portalContainer={panel}>
      <Dialog defaultOpen>
        <Dialog.Content>
          <Dialog.Panel ref={setPanel}>
            <Dialog.Title>Document sharing</Dialog.Title>
            <ShareAccess title="Roadmap" link="https://example.com/roadmap" />
            <Dialog.Close>Close sharing</Dialog.Close>
          </Dialog.Panel>
        </Dialog.Content>
      </Dialog>
    </ThemeRoot>
  );
}
export const HostDialog: Story = {
  render: () => <DialogFixture />,
  play: async ({ canvasElement, userEvent }) => {
    const dialog = within(canvasElement).getByRole('dialog', { name: 'Document sharing' });
    const modal = within(dialog);
    await userEvent.click(modal.getByRole('combobox', { name: 'Invitation role' }));
    await waitFor(() => expect(modal.getByRole('option', { name: 'Viewer' })).toBeVisible());
    await userEvent.keyboard('{End}{Enter}');
    await expect(modal.getByRole('combobox', { name: 'Invitation role' })).toHaveTextContent(
      'Viewer',
    );
  },
};

export const IndependentInstances: Story = {
  render: () => (
    <>
      <ShareAccess title="Roadmap" link="https://example.com/roadmap" />
      <ShareAccess title="Budget" link="https://example.com/budget" />
    </>
  ),
  play: async ({ canvasElement, userEvent }) => {
    const canvas = within(canvasElement);
    const headings = canvas.getAllByRole('heading');
    await expect(new Set(headings.map((heading) => heading.id)).size).toBe(2);
    const fields = canvas.getAllByRole('combobox', { name: 'Name or email' });
    await userEvent.type(fields[0]!, 'jo@example.com{Enter}');
    const chipLists = canvas.getAllByRole('list', { name: 'Invitations' });
    await expect(chipLists[0]).not.toBeEmptyDOMElement();
    await expect(chipLists[1]).toBeEmptyDOMElement();
  },
};
