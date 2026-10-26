import { useEffect, useState, type FormEvent } from 'react';
import { Inbox, Trash } from '@jfrader/icons';
import { vars } from '@jfrader/tokens/vars';
import {
  Badge,
  Button,
  Card,
  Container,
  Dialog,
  Flex,
  Pill,
  Stack,
  Switch,
  TextField,
  styled,
  type ThemeName,
} from '@jfrader/ui';
import { GameCard } from '@jfrader/ui/game-card';
import { GameTable, useGameTableSeat } from '@jfrader/ui/game-table';
import { GameActions } from '@jfrader/ui/game-actions';
import { CallOverlay } from '@jfrader/ui/call-overlay';

interface Profile {
  name: string;
  email: string;
}

interface TablePlayer {
  key: string;
  name: string;
  isMe?: boolean;
}

const TABLE_SEATS: TablePlayer[] = [
  { key: 'ada', name: 'Ada', isMe: true },
  { key: 'charles', name: 'Charles' },
  { key: 'grace', name: 'Grace' },
  { key: 'alan', name: 'Alan' },
];

const TableContainer = styled.div({
  position: 'relative',
  inlineSize: '100%',
  blockSize: 420,
  borderRadius: vars.radius.md,
  border: `1px solid ${vars.color.borderSubtle}`,
  backgroundColor: vars.color.surfaceInset,
  overflow: 'hidden',
});

const CommunityCards = styled.div({
  display: 'flex',
  gap: vars.space[2],
});

const SeatBox = styled.div({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: vars.space[1],
});

const SeatName = styled.span({
  fontSize: vars.textSize.xs,
  color: vars.color.textSubtle,
  fontWeight: vars.fontWeight.medium,
});

function TableSeat() {
  const { player } = useGameTableSeat<TablePlayer>();
  return (
    <SeatBox>
      <GameCard size="sm" label={player ? `${player.name}'s card` : 'Open seat'} />
      <SeatName>{player?.name ?? 'Open seat'}</SeatName>
    </SeatBox>
  );
}

const INITIAL_PROFILE: Profile = { name: 'Ada Lovelace', email: 'ada@example.com' };
const INITIAL_UNREAD = 3;

const GAME_COMMANDS = [
  { key: 'envido', label: 'Envido' },
  { key: 'truco', label: 'Truco' },
  { key: 'quiero', label: 'Quiero' },
  { key: 'mazo', label: 'Mazo' },
] as const;
const GAME_SHORTCUTS = new Map(GAME_COMMANDS.map((command, index) => [String(index + 1), command]));

function GamesTable() {
  const [announcement, setAnnouncement] = useState({ label: '', sequence: 0 });
  const announce = (label: string) => setAnnouncement((previous) => ({ label, sequence: previous.sequence + 1 }));
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      if (event.target instanceof Element && event.target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"], dialog')) return;
      const command = GAME_SHORTCUTS.get(event.key);
      if (!command) return;
      event.preventDefault();
      announce(command.label);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
  return <TableContainer><GameTable places={4} seats={TABLE_SEATS}>
    <GameTable.Header><Pill tone="neutral">Casual Table</Pill></GameTable.Header>
    <GameTable.Center><CommunityCards>
      <GameCard size="sm" value={{ suit: 'spades', rank: 'A' }} label="Ace of spades" />
      <GameCard size="sm" value={{ suit: 'hearts', rank: 'K' }} label="King of hearts" />
    </CommunityCards></GameTable.Center>
    <GameTable.Seat><TableSeat /></GameTable.Seat>
    <GameTable.Floating sx={{ display: 'grid', placeItems: 'center', '& > *': { pointerEvents: 'none' } }}>
      <CallOverlay key={announcement.sequence} defaultOpen={announcement.sequence > 0} label={announcement.label} />
    </GameTable.Floating>
    <GameTable.Dock>
      <GameActions label="Turn actions" size="sm" actions={GAME_COMMANDS.map((command, index) => ({
        ...command, label: <>{command.label} <kbd>{index + 1}</kbd></>, onSelect: () => announce(command.label),
      }))} />
    </GameTable.Dock>
  </GameTable></TableContainer>;
}

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
    <main>
      <Container size="md" className="page">
        <Stack gap="lg">
          <header>
            <Flex wrap align="center" justify="between" gap="md">
              <h1 className="page-title">Settings</h1>
              <Badge badgeContent={unread} tone="danger">
                <Button
                  variant="ghost"
                  startIcon={<Inbox decorative />}
                  aria-label={`Inbox, ${unread} unread`}
                  onClick={() => setUnread(0)}
                >
                  Inbox
                </Button>
              </Badge>
            </Flex>
          </header>

          <form onSubmit={handleSubmit}>
            <Card>
              <Card.Header>
                <Card.Title level={2}>Profile</Card.Title>
                <Card.Description>Shown on your public page.</Card.Description>
              </Card.Header>
              <Card.Content>
                <Stack gap="md">
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
                </Stack>
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
            <Card.Content>
              <Stack gap="md">
                <Switch
                  label="Email alerts"
                  description="Sign-ins from new devices and billing receipts."
                  checked={emailAlerts}
                  onCheckedChange={setEmailAlerts}
                />
                <Switch label="Product updates" checked={productUpdates} onCheckedChange={setProductUpdates} />
              </Stack>
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
              <Card.Title level={2}>Games</Card.Title>
            </Card.Header>
            <Card.Content>
              <GamesTable />
            </Card.Content>
          </Card>

          <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
            <Card>
              <Card.Header>
                <Card.Title level={2}>Delete account</Card.Title>
                <Card.Description>Removes your profile and settings after 30 days.</Card.Description>
              </Card.Header>
              <Card.Footer>
                {deletionScheduled && <Pill tone="danger">Deletion scheduled</Pill>}
                <Dialog.Trigger
                  render={(props) => (
                    <Button
                      {...props}
                      variant="outline"
                      tone="danger"
                      startIcon={<Trash decorative />}
                      disabled={deletionScheduled}
                    >
                      Delete account
                    </Button>
                  )}
                />
              </Card.Footer>
            </Card>

            <Dialog.Content>
              <Dialog.Title>Delete your account?</Dialog.Title>
              <Dialog.Description>Your profile and settings are removed after 30 days.</Dialog.Description>
              <Flex justify="end" gap="sm">
                <Dialog.Close
                  render={(props) => (
                    <Button {...props} variant="outline">
                      Cancel
                    </Button>
                  )}
                />
                <Button tone="danger" onClick={handleConfirmDelete}>
                  Delete account
                </Button>
              </Flex>
            </Dialog.Content>
          </Dialog>
        </Stack>
      </Container>
    </main>
  );
}
