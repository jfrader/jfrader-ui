import { useId, useState, type FormEvent } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button, Card, Dialog, Pill, Switch, TextField, ToggleGroup } from '@jfrader/ui';
import './showcase.css';

type Density = 'compact' | 'comfortable' | 'spacious';

interface Settings {
  workspace: string;
  weeklyDigest: boolean;
  desktopNotifications: boolean;
  density: Density;
}

const DEFAULTS: Settings = {
  workspace: 'Northwind',
  weeklyDigest: true,
  desktopNotifications: false,
  density: 'comfortable',
};

const DENSITIES: { value: Density; label: string }[] = [
  { value: 'compact', label: 'Compact' },
  { value: 'comfortable', label: 'Comfortable' },
  { value: 'spacious', label: 'Spacious' },
];

const isDensity = (value: string): value is Density => DENSITIES.some((density) => density.value === value);

const sameSettings = (a: Settings, b: Settings) =>
  (Object.keys(a) as (keyof Settings)[]).every((key) => a[key] === b[key]);

function SettingsScene() {
  const densityLabelId = useId();
  const [saved, setSaved] = useState(DEFAULTS);
  const [draft, setDraft] = useState(DEFAULTS);
  const [resetOpen, setResetOpen] = useState(false);

  const workspaceMissing = draft.workspace.trim() === '';
  const dirty = !sameSettings(draft, saved);

  const update = (patch: Partial<Settings>) => setDraft((current) => ({ ...current, ...patch }));

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (workspaceMissing) return;
    setSaved(draft);
  };

  const handleReset = () => {
    setDraft(DEFAULTS);
    setSaved(DEFAULTS);
    setResetOpen(false);
  };

  return (
    <main className="showcase-page">
      <h1 className="showcase-title">Settings</h1>

      <form onSubmit={handleSubmit}>
        <Card>
          <Card.Header>
            <Card.Title level={2}>Workspace</Card.Title>
            <Card.Description>Name, notifications and layout density.</Card.Description>
          </Card.Header>
          <Card.Content className="showcase-stack">
            <TextField
              label="Workspace name"
              description="Shown in the sidebar and in email subjects."
              required
              value={draft.workspace}
              error={workspaceMissing ? 'Enter a workspace name.' : undefined}
              onValueChange={(workspace) => update({ workspace })}
            />
            <Switch
              label="Weekly digest"
              description="Sent every Monday."
              checked={draft.weeklyDigest}
              onCheckedChange={(weeklyDigest) => update({ weeklyDigest })}
            />
            <Switch
              label="Desktop notifications"
              checked={draft.desktopNotifications}
              onCheckedChange={(desktopNotifications) => update({ desktopNotifications })}
            />
            <div>
              <span id={densityLabelId} className="showcase-field-label">
                Density
              </span>
              <ToggleGroup
                aria-labelledby={densityLabelId}
                value={draft.density}
                onValueChange={(density: string) => {
                  if (isDensity(density)) update({ density });
                }}
              >
                {DENSITIES.map((density) => (
                  <ToggleGroup.Item key={density.value} value={density.value}>
                    {density.label}
                  </ToggleGroup.Item>
                ))}
              </ToggleGroup>
            </div>
          </Card.Content>
          <Card.Footer>
            <Pill tone={dirty ? 'warning' : 'success'}>{dirty ? 'Unsaved changes' : 'Saved'}</Pill>
            <Button type="submit" tone="accent" disabled={!dirty}>
              Save changes
            </Button>
          </Card.Footer>
        </Card>
      </form>

      <Card>
        <Card.Header>
          <Card.Title level={2}>Reset</Card.Title>
          <Card.Description>Restores every setting on this page to its default.</Card.Description>
        </Card.Header>
        <Card.Footer>
          <Button variant="outline" tone="danger" onClick={() => setResetOpen(true)}>
            Reset to defaults
          </Button>
        </Card.Footer>
      </Card>

      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <Dialog.Content>
          <Dialog.Title>Reset all settings?</Dialog.Title>
          <Dialog.Description>Workspace name, notifications and density return to their defaults.</Dialog.Description>
          <div className="showcase-actions">
            <Dialog.Close>Cancel</Dialog.Close>
            <Button tone="danger" onClick={handleReset}>
              Reset
            </Button>
          </div>
        </Dialog.Content>
      </Dialog>
    </main>
  );
}

const meta = {
  title: 'Showcase/Settings',
  tags: ['!autodocs'],
  parameters: {
    layout: 'fullscreen',
    controls: { disable: true },
  },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <SettingsScene />,
};
