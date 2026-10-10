import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Badge, Button, Card, CommandPalette, Navigation, Pill } from '@jfrader/ui';
import './showcase.css';

interface Page {
  id: string;
  label: string;
}

interface PageGroup {
  label: string;
  collapsible?: boolean;
  pages: Page[];
}

const NAV_GROUPS: PageGroup[] = [
  {
    label: 'Workspace',
    pages: [
      { id: 'overview', label: 'Overview' },
      { id: 'projects', label: 'Projects' },
      { id: 'inbox', label: 'Inbox' },
      { id: 'reports', label: 'Reports' },
    ],
  },
  {
    label: 'Settings',
    collapsible: true,
    pages: [
      { id: 'general', label: 'General' },
      { id: 'members', label: 'Members' },
      { id: 'billing', label: 'Billing' },
    ],
  },
];

const ALL_PAGES = NAV_GROUPS.flatMap((group) => group.pages);

const ACTIVITY = [
  { id: 'deploy', text: 'Billing API deployed to production', time: '2 min ago' },
  { id: 'review', text: 'Ada requested review on #482', time: '18 min ago' },
  { id: 'issue', text: 'Login timeout reopened', time: '1 h ago' },
];

const UNREAD = 3;

function SearchIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="7" cy="7" r="4.5" />
      <path d="m10.5 10.5 3 3" strokeLinecap="round" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d="M4 11V7a4 4 0 0 1 8 0v4l1 1.5H3L4 11Z" strokeLinejoin="round" />
      <path d="M6.5 14a1.5 1.5 0 0 0 3 0" />
    </svg>
  );
}

function AppShellScene() {
  const [activeId, setActiveId] = useState('overview');
  const [searchOpen, setSearchOpen] = useState(false);
  const activePage = ALL_PAGES.find((page) => page.id === activeId);

  return (
    <div className="showcase-shell">
      <aside className="showcase-sidebar">
        <span className="showcase-brand">Northwind</span>
        <Navigation label="Main">
          {NAV_GROUPS.map((group) => (
            <Navigation.Group
              key={group.label}
              label={group.label}
              collapsible={group.collapsible}
              defaultOpen={group.collapsible}
            >
              {group.pages.map((page) => (
                <Navigation.Item
                  key={page.id}
                  href={`#${page.id}`}
                  active={page.id === activeId}
                  onClick={(event) => {
                    event.preventDefault();
                    setActiveId(page.id);
                  }}
                >
                  {page.label}
                </Navigation.Item>
              ))}
            </Navigation.Group>
          ))}
        </Navigation>
      </aside>

      <div className="showcase-column">
        <header className="showcase-topbar">
          <Button
            variant="outline"
            className="showcase-search"
            startIcon={<SearchIcon />}
            aria-haspopup="dialog"
            aria-expanded={searchOpen}
            onClick={() => setSearchOpen(true)}
          >
            Search pages
          </Button>
          <div className="showcase-topbar-end">
            <Pill tone="success">All systems operational</Pill>
            <Badge badgeContent={UNREAD} tone="danger">
              <Button variant="ghost" aria-label={`Notifications, ${UNREAD} unread`}>
                <BellIcon />
              </Button>
            </Badge>
          </div>
        </header>

        <main className="showcase-main">
          <h1 className="showcase-title">{activePage?.label}</h1>
          <div className="showcase-grid">
            <Card>
              <Card.Header>
                <Card.Title level={2}>Active projects</Card.Title>
                <Card.Description>Across all teams</Card.Description>
              </Card.Header>
              <Card.Content className="showcase-stat">
                12 <Pill tone="success">+3 this week</Pill>
              </Card.Content>
            </Card>
            <Card>
              <Card.Header>
                <Card.Title level={2}>Open issues</Card.Title>
                <Card.Description>Assigned to you</Card.Description>
              </Card.Header>
              <Card.Content className="showcase-stat">
                27 <Pill tone="warning">5 overdue</Pill>
              </Card.Content>
            </Card>
            <Card>
              <Card.Header>
                <Card.Title level={2}>Recent activity</Card.Title>
              </Card.Header>
              <Card.Content>
                <ul className="showcase-list">
                  {ACTIVITY.map((entry) => (
                    <li key={entry.id} className="showcase-list-item">
                      <span>{entry.text}</span>
                      <span className="showcase-muted">{entry.time}</span>
                    </li>
                  ))}
                </ul>
              </Card.Content>
            </Card>
          </div>
        </main>
      </div>

      <CommandPalette label="Search pages" open={searchOpen} onOpenChange={setSearchOpen}>
        <CommandPalette.Content>
          <CommandPalette.Input placeholder="Go to page" />
          <CommandPalette.List>
            {NAV_GROUPS.map((group) => (
              <CommandPalette.Group key={group.label} label={group.label}>
                {group.pages.map((page) => (
                  <CommandPalette.Item key={page.id} value={page.id} onSelect={() => setActiveId(page.id)}>
                    {page.label}
                  </CommandPalette.Item>
                ))}
              </CommandPalette.Group>
            ))}
          </CommandPalette.List>
          <CommandPalette.Empty />
        </CommandPalette.Content>
      </CommandPalette>
    </div>
  );
}

const meta = {
  title: 'Showcase/AppShell',
  tags: ['!autodocs'],
  parameters: {
    layout: 'fullscreen',
    controls: { disable: true },
  },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <AppShellScene />,
};
