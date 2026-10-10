import { useState, type FormEvent } from 'react';
import { Badge, Button, Card, Dialog, Pill, Switch, TextField, type ThemeName } from '@jfrader/ui';

interface Profile {
  name: string;
  email: string;
}

const INITIAL_PROFILE: Profile = { name: 'Ada Lovelace', email: 'ada@example.com' };
const INITIAL_UNREAD = 3;

export function App() {
  const [saved, setSaved] = useState<Profile>(INITIAL_PROFILE);
  const [draft, setDraft] = useState<Profile>(INITIAL_PROFILE);
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [productUpdates, setProductUpdates] = useState(false);
  const [theme, setTheme] = useState<ThemeName>('dark');
  const [unread, setUnread] = useState(INITIAL_UNREAD);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletionScheduled, setDeletionScheduled] = useState(false);

  const emailMissing = draft.email.trim() === '';
  const dirty = draft.name !== saved.name || draft.email !== saved.email;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (emailMissing) return;
    setSaved(draft);
  };

  const handleThemeChange = (light: boolean) => {
    const next: ThemeName = light ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    setTheme(next);
  };

  const handleConfirmDelete = () => {
    setDeletionScheduled(true);
    setDeleteOpen(false);
  };

  return (
    <main className="page">
      <header className="page-header">
        <h1 className="page-title">Settings</h1>
        <Badge badgeContent={unread} tone="danger">
          <Button variant="ghost" aria-label={`Inbox, ${unread} unread`} onClick={() => setUnread(0)}>
            Inbox
          </Button>
        </Badge>
      </header>

      <form onSubmit={handleSubmit}>
        <Card>
          <Card.Header>
            <Card.Title level={2}>Profile</Card.Title>
            <Card.Description>Shown on your public page.</Card.Description>
          </Card.Header>
          <Card.Content className="stack">
            <TextField
              label="Display name"
              value={draft.name}
              onValueChange={(name) => setDraft({ ...draft, name })}
            />
            <TextField
              label="Email"
              type="email"
              required
              value={draft.email}
              error={emailMissing ? 'Enter an email address.' : undefined}
              onValueChange={(email) => setDraft({ ...draft, email })}
            />
          </Card.Content>
          <Card.Footer>
            <Pill tone={dirty ? 'warning' : 'success'}>{dirty ? 'Unsaved changes' : 'Saved'}</Pill>
            <Button type="submit" tone="accent" disabled={!dirty}>
              Save profile
            </Button>
          </Card.Footer>
        </Card>
      </form>

      <Card>
        <Card.Header>
          <Card.Title level={2}>Notifications</Card.Title>
        </Card.Header>
        <Card.Content className="stack">
          <Switch
            label="Email alerts"
            description="Sign-ins from new devices and billing receipts."
            checked={emailAlerts}
            onCheckedChange={setEmailAlerts}
          />
          <Switch label="Product updates" checked={productUpdates} onCheckedChange={setProductUpdates} />
        </Card.Content>
      </Card>

      <Card>
        <Card.Header>
          <Card.Title level={2}>Appearance</Card.Title>
        </Card.Header>
        <Card.Content>
          <Switch label="Light theme" checked={theme === 'light'} onCheckedChange={handleThemeChange} />
        </Card.Content>
      </Card>

      <Card>
        <Card.Header>
          <Card.Title level={2}>Delete account</Card.Title>
          <Card.Description>Removes your profile and settings after 30 days.</Card.Description>
        </Card.Header>
        <Card.Footer>
          {deletionScheduled && <Pill tone="danger">Deletion scheduled</Pill>}
          <Button variant="outline" tone="danger" disabled={deletionScheduled} onClick={() => setDeleteOpen(true)}>
            Delete account
          </Button>
        </Card.Footer>
      </Card>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <Dialog.Content>
          <Dialog.Title>Delete your account?</Dialog.Title>
          <Dialog.Description>Your profile and settings are removed after 30 days.</Dialog.Description>
          <div className="dialog-actions">
            <Dialog.Close>Cancel</Dialog.Close>
            <Button tone="danger" onClick={handleConfirmDelete}>
              Delete account
            </Button>
          </div>
        </Dialog.Content>
      </Dialog>
    </main>
  );
}
