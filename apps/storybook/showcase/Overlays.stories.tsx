import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { Button, Card, CommandPalette, DatePicker, Dialog, Menu, TextField } from '@jfrader/ui';
import './showcase.css';

function OverlaysScene() {
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');

  const handleInviteOpenChange = (open: boolean) => {
    setInviteOpen(open);
    if (open) setInviteEmail('');
  };

  return (
    <main className="showcase-page">
      <h1 className="showcase-title">Overlays</h1>
      <div className="showcase-grid">
        <Card>
          <Card.Header>
            <Card.Title level={2}>Command palette</Card.Title>
            <Card.Description>Modal search over commands.</Card.Description>
          </Card.Header>
          <Card.Content>
            <CommandPalette>
              <CommandPalette.Trigger>Open command palette</CommandPalette.Trigger>
              <CommandPalette.Content>
                <CommandPalette.Input placeholder="Type a command" />
                <CommandPalette.List>
                  <CommandPalette.Group label="Projects">
                    <CommandPalette.Item value="new-project">New project</CommandPalette.Item>
                    <CommandPalette.Item value="open-project" keywords="switch">
                      Open project
                    </CommandPalette.Item>
                  </CommandPalette.Group>
                  <CommandPalette.Group label="Account">
                    <CommandPalette.Item value="invite-member">Invite member</CommandPalette.Item>
                    <CommandPalette.Item value="sign-out" keywords="log out">
                      Sign out
                    </CommandPalette.Item>
                  </CommandPalette.Group>
                </CommandPalette.List>
                <CommandPalette.Empty />
              </CommandPalette.Content>
            </CommandPalette>
          </Card.Content>
        </Card>

        <Card>
          <Card.Header>
            <Card.Title level={2}>Menu</Card.Title>
            <Card.Description>Actions for the current project.</Card.Description>
          </Card.Header>
          <Card.Content>
            <Menu>
              <Menu.Trigger>Project actions</Menu.Trigger>
              <Menu.Content>
                <Menu.Item>Rename</Menu.Item>
                <Menu.Item>Duplicate</Menu.Item>
                <Menu.Item disabled>Transfer</Menu.Item>
                <Menu.Separator />
                <Menu.Item>Archive</Menu.Item>
              </Menu.Content>
            </Menu>
          </Card.Content>
        </Card>

        <Card>
          <Card.Header>
            <Card.Title level={2}>Dialog</Card.Title>
            <Card.Description>Modal form with a confirmation.</Card.Description>
          </Card.Header>
          <Card.Content>
            <Dialog open={inviteOpen} onOpenChange={handleInviteOpenChange}>
              <Dialog.Trigger>Invite member</Dialog.Trigger>
              <Dialog.Content>
                <Dialog.Title>Invite a member</Dialog.Title>
                <Dialog.Description>They get an email with a link to join Northwind.</Dialog.Description>
                <div className="showcase-stack">
                  <TextField label="Email" type="email" value={inviteEmail} onValueChange={setInviteEmail} />
                  <div className="showcase-actions">
                    <Dialog.Close>Cancel</Dialog.Close>
                    <Button tone="accent" disabled={inviteEmail.trim() === ''} onClick={() => setInviteOpen(false)}>
                      Send invite
                    </Button>
                  </div>
                </div>
              </Dialog.Content>
            </Dialog>
          </Card.Content>
        </Card>

        <Card>
          <Card.Header>
            <Card.Title level={2}>Date picker</Card.Title>
            <Card.Description>Calendar popup anchored to the field.</Card.Description>
          </Card.Header>
          <Card.Content>
            <DatePicker defaultValue="2026-10-16">
              <DatePicker.Input label="Due date" />
              <DatePicker.Popup />
            </DatePicker>
          </Card.Content>
        </Card>
      </div>
    </main>
  );
}

const meta = {
  title: 'Showcase/Overlays',
  tags: ['!autodocs', 'dev'],
  parameters: {
    layout: 'fullscreen',
    controls: { disable: true },
    // Floating UI's focus guards are aria-hidden spans with tabindex=0 that forward focus
    // immediately; axe flags them as aria-hidden-focus (known false positive). Every other
    // aria-hidden element is still checked.
    a11y: {
      config: {
        rules: [{ id: 'aria-hidden-focus', selector: '[aria-hidden="true"]:not([data-floating-ui-focus-guard])' }],
      },
    },
  },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <OverlaysScene />,
  play: async ({ canvasElement }) => {
    // Open the command palette so the axe run covers its visible state too.
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Open command palette' }));
    await waitFor(() => expect(canvas.getAllByRole('option').length).toBeGreaterThan(0));
    // The palette fades in: wait for the settled entrance before visibility and axe read it.
    const panel = canvas.getByRole('dialog').firstElementChild!;
    await waitFor(() => expect(getComputedStyle(panel).opacity).toBe('1'));
    await expect(canvas.getByRole('option', { name: 'New project' })).toBeVisible();
  },
};
