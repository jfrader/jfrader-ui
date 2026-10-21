import type { ComponentPropsWithRef } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fireEvent, fn, userEvent, within } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
// `styled` is the app-facing styling API; consumers import it from `@jfrader/ui`.
import { styled } from '../../index';
import { withLightTheme } from '../../testing/story-decorators';
import {
  Navigation,
  type NavigationComposedProps,
  type NavigationShorthandProps,
  type NavigationGroupProps,
  type NavigationGroupRecord,
  type NavigationComposedProps as NavigationProps,
} from './index';

const WORKSPACE = [
  { label: 'Inbox', href: '/inbox' },
  { label: 'Projects', href: '/projects' },
  { label: 'Teams', href: '/teams' },
] as const;

const SETTINGS = [
  { label: 'Account', href: '/settings/account' },
  { label: 'Billing', href: '/settings/billing' },
] as const;

const ACTIVE_LABEL = 'Projects';
const TRANSPARENT = 'rgba(0, 0, 0, 0)';
const ITEM_MIN_BLOCK_SIZE_PX = 32;

const Frame = styled.div({
  inlineSize: '240px',
});

const Surface = styled.div({
  backgroundColor: vars.color.surface,
  padding: vars.space[4],
});

const disabledActivation = fn();

const Icon = styled.svg({
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
});

const meta = {
  title: 'Navigation/Navigation',
  component: Navigation,
  parameters: {
    docs: {
      description: { component: 'Group links into navigation sections and mark the current page.' },
      sections: [
        { title: 'Page links', stories: ['Default', 'Composed'] },
        { title: 'Floating navigation', stories: ['Morph'] },
      ],
      usage: `### Accessibility
Name the navigation landmark. The current destination is announced as the current page; a floating disclosure marks its active section as the current location. Leading icons are decorative. Collapsible groups use native disclosures; after their initial state, the browser owns toggling.

### Floating bar keyboard

Left/Right and Home/End move between top-level controls. Down opens a disclosure and focuses its first link; Up from its first link returns to the summary. Escape closes and returns focus; outside pointer or focus closes without restoring it. Tab keeps native link order. Enter/Space retain native anchor or disclosure behaviour.

### Layout and routing

Floating groups wrap at narrow widths. Below 420px, disclosure panels use one column. Supply routing, scroll thresholds and responsive navigation in your application; search can be composed separately with Combobox.`,
    },
  },
  decorators: [
    (Story) => (
      <Frame>
        <Story />
      </Frame>
    ),
  ],
} satisfies Meta<NavigationComposedProps>;

export default meta;

function NavigationHost(props: ComponentPropsWithRef<'nav'>) {
  return <nav {...props} data-testid="navigation-host" />;
}
function CustomGroup(props: NavigationGroupProps) {
  return <Navigation.Group {...props} data-testid="custom-navigation-group" />;
}

type Story = StoryObj<Omit<NavigationComposedProps, 'component'>>;

function SidebarExample(props: NavigationProps) {
  return (
    <Navigation {...props}>
      <Navigation.Group label="Workspace">
        {WORKSPACE.map((item) => (
          <Navigation.Item key={item.href} href={item.href} active={item.label === ACTIVE_LABEL}>
            {item.label}
          </Navigation.Item>
        ))}
      </Navigation.Group>
      <Navigation.Group label="Settings">
        {SETTINGS.map((item) => (
          <Navigation.Item key={item.href} href={item.href}>
            {item.label}
          </Navigation.Item>
        ))}
      </Navigation.Group>
    </Navigation>
  );
}
SidebarExample.displayName = 'SidebarExample';

function CircleIcon() {
  return (
    <Icon viewBox="0 0 16 16">
      <circle cx="8" cy="8" r="6" />
    </Icon>
  );
}
CircleIcon.displayName = 'CircleIcon';

const getSummaries = (nav: HTMLElement) =>
  Array.from(nav.querySelectorAll<HTMLElement>('[data-ui="navigation-group-summary"]'));

async function expectFocusRing(element: HTMLElement) {
  await expect(element.ownerDocument.activeElement).toBe(element);
  await expect(getComputedStyle(element).outlineStyle).not.toBe('none');
  await expect(getComputedStyle(element).outlineWidth).not.toBe('0px');
}

export const Default: StoryObj<Omit<NavigationShorthandProps, 'component'>> = {
  name: 'Workspace links',
  args: {
    label: 'Main',
    activeHref: '/projects',
    groups: [
      {
        label: 'Workspace',
        items: [
          { label: 'Inbox', href: '/inbox' },
          { label: 'Projects', href: '/projects' },
          { label: 'Teams', href: '/teams', disabled: true },
        ],
      },
      {
        label: 'Settings',
        items: [
          { label: 'Account', href: '/settings/account' },
          { label: 'Billing', href: '/settings/billing' },
        ],
      },
    ],
  },
  parameters: {
    docs: {
      description: { story: 'Group workspace and settings destinations and mark Projects as the current page.' },
      source: {
        language: 'tsx',
        code: `import { Navigation, type NavigationGroupRecord } from '@jfrader/ui';

const groups = [
  {
    label: 'Workspace',
    items: [
      { label: 'Inbox', href: '/inbox' },
      { label: 'Projects', href: '/projects' },
      { label: 'Teams', href: '/teams', disabled: true },
    ],
  },
  {
    label: 'Settings',
    items: [
      { label: 'Account', href: '/settings/account' },
      { label: 'Billing', href: '/settings/billing' },
    ],
  },
] satisfies readonly NavigationGroupRecord[];

<Navigation label="Main" groups={groups} activeHref="/projects" />`,
      },
    },
  },
  render: (args) => <Navigation {...args} />,
  play: async ({ canvasElement, userEvent }) => {
    const nav = within(canvasElement).getByRole('navigation', { name: 'Main' });
    const groups = within(nav);
    await expect(groups.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent)).toEqual([
      'Workspace',
      'Settings',
    ]);
    await expect(within(groups.getByRole('list', { name: 'Workspace' })).getAllByRole('listitem')).toHaveLength(3);
    await expect(within(groups.getByRole('list', { name: 'Settings' })).getAllByRole('listitem')).toHaveLength(2);

    const activeLink = groups.getByRole('link', { name: 'Projects' });
    const inactiveLink = groups.getByRole('link', { name: 'Inbox' });
    const disabledLink = groups.getByRole('link', { name: 'Teams' });

    await expect(activeLink).toHaveAttribute('aria-current', 'page');
    await expect(inactiveLink).not.toHaveAttribute('aria-current');
    await expect(disabledLink).toHaveAttribute('aria-disabled', 'true');
    await expect(disabledLink).toHaveAttribute('tabindex', '-1');

    await userEvent.tab();
    await expect(inactiveLink).toHaveFocus();
    await userEvent.tab();
    await expect(activeLink).toHaveFocus();
  },
};

export const Composed: Story = {
  name: 'Compose link groups',
  parameters: { docs: {
    description: { story: 'Compose workspace and settings links with a current-page marker.' },
    source: { language: 'tsx', code: `import { Navigation } from '@jfrader/ui';

<Navigation label="Main">
  <Navigation.Group label="Workspace">
    <Navigation.Item href="/inbox">Inbox</Navigation.Item>
    <Navigation.Item href="/projects" active>Projects</Navigation.Item>
    <Navigation.Item href="/teams">Teams</Navigation.Item>
  </Navigation.Group>
  <Navigation.Group label="Settings">
    <Navigation.Item href="/settings/account">Account</Navigation.Item>
    <Navigation.Item href="/settings/billing">Billing</Navigation.Item>
  </Navigation.Group>
</Navigation>` },
  } },
  render: (args) => <SidebarExample {...args} />,
  play: async ({ canvasElement }) => {
    const nav = within(canvasElement).getByRole('navigation', { name: 'Main' });
    const groups = within(nav);
    await expect(groups.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent)).toEqual([
      'Workspace',
      'Settings',
    ]);
    await expect(within(groups.getByRole('list', { name: 'Workspace' })).getAllByRole('listitem')).toHaveLength(
      WORKSPACE.length,
    );
    await expect(within(groups.getByRole('list', { name: 'Settings' })).getAllByRole('listitem')).toHaveLength(
      SETTINGS.length,
    );

    const current = nav.querySelectorAll('[aria-current]');
    await expect(current).toHaveLength(1);
    const active = groups.getByRole('link', { name: ACTIVE_LABEL });
    const inactive = groups.getByRole('link', { name: 'Inbox' });
    await expect(active).toHaveAttribute('aria-current', 'page');
    await expect(inactive).not.toHaveAttribute('aria-current');

    // Selection is carried by background, color and weight, never color alone.
    const activeStyle = getComputedStyle(active);
    const inactiveStyle = getComputedStyle(inactive);
    await expect(activeStyle.backgroundColor).not.toBe(TRANSPARENT);
    await expect(inactiveStyle.backgroundColor).toBe(TRANSPARENT);
    await expect(activeStyle.color).not.toBe(inactiveStyle.color);
    await expect(Number(activeStyle.fontWeight)).toBeGreaterThan(Number(inactiveStyle.fontWeight));

    for (const link of groups.getAllByRole('link')) {
      await expect(link.getBoundingClientRect().height).toBeGreaterThanOrEqual(ITEM_MIN_BLOCK_SIZE_PX);
    }
  },
};

export const GeneratedPartProps: StoryObj<Omit<NavigationShorthandProps, 'component'>> = {
  name: 'Generated part props',
  args: {
    label: 'Main',
    groups: [
      {
        label: 'Navigation links',
        items: [
          { label: 'Home', href: '/' },
        ],
      },
    ],
    slotProps: {
      root: { 'data-testid': 'custom-nav-root', className: 'custom-nav-class' },
      group: { className: 'custom-group-class' },
      item: { className: 'custom-item-class' },
    },
  },
  render: (args) => <Navigation {...args} />,
  parameters: { docs: { source: { code: `<Navigation label="Main" groups={groups}
  slotProps={{ group: { className: 'custom-group-class' }, item: { className: 'custom-item-class' } }} />` } } },
  play: async ({ canvasElement }) => {
    const root = within(canvasElement).getByTestId('custom-nav-root');
    await expect(root).toHaveClass('custom-nav-class');
    await expect(root).toHaveAttribute('data-ui', 'navigation');

    const group = root.querySelector('[data-ui="navigation-group"]');
    await expect(group).toHaveClass('custom-group-class');

    const item = within(root).getByRole('link', { name: 'Home' });
    await expect(item).toHaveClass('custom-item-class');
  },
};

export const ReplacedParts: StoryObj<Omit<NavigationShorthandProps, 'component'>> = {
  name: 'Replaced parts',
  args: {
    groups: [
      {
        label: 'Workspace',
        items: [
          { label: 'Inbox', href: '/inbox' },
          { label: 'Projects', href: '/projects' },
        ],
      },
    ],
    slots: { root: NavigationHost, group: CustomGroup },
    className: 'consumer-root',
    style: { fontStyle: 'normal' },
    sx: { fontStyle: 'normal' },
    slotProps: {
      root: { className: 'slot-root', style: { fontStyle: 'italic' }, sx: { fontStyle: 'italic' }, 'aria-label': 'App navigation' },
    },
  },
  render: (args) => <Navigation {...args} component={NavigationHost} />,
  parameters: {
    docs: {
      source: {
        code: `<Navigation groups={groups} component={NavigationHost} slots={{ group: CustomGroup }} slotProps={{ root: { 'aria-label': 'App navigation' } }} />`,
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const host = canvas.getByTestId('navigation-host');
    await expect(host).toHaveClass('consumer-root', 'slot-root');
    await expect(host).toHaveStyle({ fontStyle: 'italic' });
    await expect(host).toHaveAttribute('aria-label', 'App navigation');
    await expect(host).toHaveAttribute('data-ui', 'navigation');
    const group = canvas.getByTestId('custom-navigation-group');
    await expect(group).toBeVisible();
    await expect(within(host).getAllByRole('link')).toHaveLength(2);
  },
};

function shorthandModeTypeContracts() {
  const groups: readonly NavigationGroupRecord[] = [{ items: [{ label: 'Home', href: '/' }] }];
  // @ts-expect-error Shorthand mode rejects composed children.
  <Navigation groups={groups}>Child</Navigation>;
  // @ts-expect-error Composed mode rejects groups.
  <Navigation groups={groups}>Child</Navigation>;
  // @ts-expect-error Composed mode rejects activeHref.
  <Navigation activeHref="/">Child</Navigation>;
  // @ts-expect-error Composed mode rejects slotProps.
  <Navigation slotProps={{ root: {} }}>Child</Navigation>;
}
void shorthandModeTypeContracts;


export const Links: Story = {
  args: { label: 'Sidebar' },
  render: (args) => <SidebarExample {...args} />,
  play: async ({ canvasElement }) => {
    const nav = within(canvasElement).getByRole('navigation', { name: 'Sidebar' });
    const links = within(nav).getAllByRole('link');
    await expect(links.map((link) => link.getAttribute('href'))).toEqual(
      [...WORKSPACE, ...SETTINGS].map((item) => item.href),
    );
    links.forEach((link) => expect(link.tagName).toBe('A'));

    // Native link tab order, each with a visible focus ring.
    for (const link of links) {
      await userEvent.tab();
      await expectFocusRing(link);
    }
    await userEvent.tab();
    await expect(nav.contains(nav.ownerDocument.activeElement)).toBe(false);
  },
};

export const Collapsible: Story = {
  render: (args) => (
    <Navigation {...args}>
      <Navigation.Group label="Workspace" collapsible defaultOpen>
        {WORKSPACE.map((item) => (
          <Navigation.Item key={item.href} href={item.href} active={item.label === ACTIVE_LABEL}>
            {item.label}
          </Navigation.Item>
        ))}
      </Navigation.Group>
      <Navigation.Group label="Settings" collapsible>
        {SETTINGS.map((item) => (
          <Navigation.Item key={item.href} href={item.href}>
            {item.label}
          </Navigation.Item>
        ))}
      </Navigation.Group>
    </Navigation>
  ),
  play: async ({ canvasElement }) => {
    const nav = within(canvasElement).getByRole('navigation', { name: 'Main' });
    const [workspace, settings] = getSummaries(nav);
    const workspaceGroup = workspace!.parentElement!;
    const settingsGroup = settings!.parentElement!;
    await expect(workspaceGroup.tagName).toBe('DETAILS');
    await expect(workspaceGroup).toHaveAttribute('open');
    await expect(settingsGroup).not.toHaveAttribute('open');
    await expect(within(nav).getByRole('link', { name: 'Inbox' })).toBeVisible();
    await expect(within(settingsGroup).getByText('Account')).not.toBeVisible();

    await userEvent.tab();
    await expectFocusRing(workspace!);
    // Synthetic Enter/Space don't run <summary>'s native default action, so toggling is
    // asserted with clicks; real keyboard activation is browser behavior covered by the
    // manual QA gate (GURI-1977).
    await userEvent.click(workspace!);
    await expect(workspaceGroup).not.toHaveAttribute('open');
    await expect(within(workspaceGroup).getByText('Inbox')).not.toBeVisible();
    await userEvent.click(workspace!);
    await expect(workspaceGroup).toHaveAttribute('open');
    await expect(within(workspaceGroup).getByText('Inbox')).toBeVisible();
    await userEvent.click(workspace!);
    await expect(workspaceGroup).not.toHaveAttribute('open');

    // Closed groups hide their links; user-event's tab model doesn't emulate closed
    // <details> content-visibility (its walk stalls on the hidden link), so the
    // browser-level tab skip is covered by the manual QA gate.
    await userEvent.click(settings!);
    await expectFocusRing(settings!);
    await expect(settingsGroup).toHaveAttribute('open');
    await userEvent.tab();
    await expectFocusRing(within(nav).getByRole('link', { name: 'Account' }));

    // Leave both open so the axe gate checks every item.
    await userEvent.click(workspace!);
    await expect(workspaceGroup).toHaveAttribute('open');
    await expect(within(nav).getByRole('list', { name: 'Workspace' })).toBeVisible();
  },
};

export const Disabled: Story = {
  render: (args) => (
    <Navigation {...args}>
      <Navigation.Group label="Workspace">
        <Navigation.Item href={WORKSPACE[0].href}>{WORKSPACE[0].label}</Navigation.Item>
        <Navigation.Item href={WORKSPACE[1].href} disabled>
          {WORKSPACE[1].label}
        </Navigation.Item>
        <Navigation.Item href={WORKSPACE[2].href}>{WORKSPACE[2].label}</Navigation.Item>
        <Navigation.Item disabled>Archive</Navigation.Item>
      </Navigation.Group>
    </Navigation>
  ),
  play: async ({ canvasElement }) => {
    const nav = within(canvasElement).getByRole('navigation', { name: 'Main' });
    const disabled = within(nav).getByRole('link', { name: WORKSPACE[1].label });
    await expect(disabled).toHaveAttribute('aria-disabled', 'true');
    await expect(disabled).not.toHaveAttribute('href');
    await expect(getComputedStyle(disabled).pointerEvents).toBe('none');
    await expect(Number(getComputedStyle(disabled).opacity)).toBeLessThan(1);
    await expect(within(nav).getByText('Archive')).toHaveAttribute('aria-disabled', 'true');

    // Tab skips the disabled link.
    await userEvent.tab();
    await expectFocusRing(within(nav).getByRole('link', { name: WORKSPACE[0].label }));
    await userEvent.tab();
    await expectFocusRing(within(nav).getByRole('link', { name: WORKSPACE[2].label }));
  },
};

export const DisabledActivation: Story = {
  render: (args) => (
    <Navigation {...args}>
      <Navigation.Group label="Workspace">
        <Navigation.Item href={WORKSPACE[0].href}>{WORKSPACE[0].label}</Navigation.Item>
        <Navigation.Item href={WORKSPACE[1].href} disabled onClick={disabledActivation} tabIndex={0}>
          {WORKSPACE[1].label}
        </Navigation.Item>
        <Navigation.Item href={WORKSPACE[2].href}>{WORKSPACE[2].label}</Navigation.Item>
      </Navigation.Group>
    </Navigation>
  ),
  play: async ({ canvasElement }) => {
    disabledActivation.mockClear();
    const nav = within(canvasElement).getByRole('navigation', { name: 'Main' });
    const disabled = within(nav).getByRole('link', { name: WORKSPACE[1].label });
    await expect(disabled).toHaveAttribute('aria-disabled', 'true');
    await expect(disabled).toHaveAttribute('tabindex', '-1');
    await expect(disabled).not.toHaveAttribute('href');

    // Programmatic clicks bypass pointer-events, as accessibility activation can.
    await expect(fireEvent.click(disabled)).toBe(false);
    await expect(disabledActivation).not.toHaveBeenCalled();
    await userEvent.tab();
    await expectFocusRing(within(nav).getByRole('link', { name: WORKSPACE[0].label }));
    await userEvent.tab();
    await expectFocusRing(within(nav).getByRole('link', { name: WORKSPACE[2].label }));
    await userEvent.tab();
    await expect(nav.contains(nav.ownerDocument.activeElement)).toBe(false);
    disabled.focus();
    await expect(disabled).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    await expect(disabledActivation).not.toHaveBeenCalled();
  },
};

export const SurfaceBacked: Story = {
  render: (args) => (
    <Surface>
      <Navigation {...args}>
        <Navigation.Group label="Workspace" collapsible defaultOpen>
          {WORKSPACE.map((item) => (
            <Navigation.Item key={item.href} href={item.href} active={item.label === ACTIVE_LABEL}>
              {item.label}
            </Navigation.Item>
          ))}
        </Navigation.Group>
      </Navigation>
    </Surface>
  ),
  play: async ({ canvasElement }) => {
    const nav = within(canvasElement).getByRole('navigation', { name: 'Main' });
    const [summary] = getSummaries(nav);
    await expect(summary).toBeVisible();
    await expect(summary).toHaveTextContent('Workspace');
    await expect(summary!.parentElement).toHaveAttribute('open');
    for (const item of WORKSPACE) {
      await expect(within(nav).getByRole('link', { name: item.label })).toBeVisible();
    }
    // Leave the disclosure open so axe checks the surface-backed label and every item.
  },
};

export const IconItems: Story = {
  render: (args) => (
    <Navigation {...args}>
      <Navigation.Group label="Workspace">
        {WORKSPACE.map((item) => (
          <Navigation.Item
            key={item.href}
            href={item.href}
            active={item.label === ACTIVE_LABEL}
            icon={<CircleIcon />}
          >
            {item.label}
          </Navigation.Item>
        ))}
      </Navigation.Group>
    </Navigation>
  ),
  play: async ({ canvasElement }) => {
    const nav = within(canvasElement).getByRole('navigation', { name: 'Main' });
    const links = within(nav).getAllByRole('link');
    await expect(links.map((link) => link.textContent)).toEqual(WORKSPACE.map((item) => item.label));
    for (const link of links) {
      const icon = link.querySelector('[data-ui="navigation-item-icon"]');
      await expect(icon).toHaveAttribute('aria-hidden', 'true');
      await expect(icon?.querySelector('svg')).not.toBeNull();
    }
    await expect(within(nav).getByRole('link', { name: ACTIVE_LABEL })).toHaveAttribute('aria-current', 'page');
  },
};

export const LightTheme: Story = {
  decorators: [withLightTheme],
  render: (args) => <SidebarExample {...args} />,
  play: async ({ canvasElement }) => {
    const nav = within(canvasElement).getByRole('navigation', { name: 'Main' });
    await expect(within(nav).getByRole('link', { name: ACTIVE_LABEL })).toHaveAttribute('aria-current', 'page');
  },
};

export const NarrowLabels: Story = {
  args: { dir: 'rtl', 'aria-label': 'Sections' },
  render: (args) => (
    <Navigation {...args}>
      <Navigation.Group label="AnUnbrokenGroupLabelThatMustFitTheAvailableWidth" collapsible defaultOpen>
        <Navigation.Item href="/projects" aria-current="page">
          AnUnbrokenProjectLabelThatMustFitTheAvailableWidth
        </Navigation.Item>
        <Navigation.Item href="/settings" aria-disabled="true" onClick={disabledActivation}>Settings</Navigation.Item>
      </Navigation.Group>
    </Navigation>
  ),
  play: async ({ canvasElement }) => {
    const nav = within(canvasElement).getByRole('navigation', { name: 'Sections' });
    await expect(nav).toHaveAttribute('dir', 'rtl');
    await expect(nav.scrollWidth).toBeLessThanOrEqual(nav.clientWidth);
    await expect(within(nav).getAllByRole('link')[0]).toHaveAttribute('aria-current', 'page');
    disabledActivation.mockClear();
    const disabled = within(nav).getByRole('link', { name: 'Settings' });
    await expect(disabled).toHaveAttribute('aria-disabled', 'true');
    await expect(disabled).toHaveAttribute('tabindex', '-1');
    await expect(disabled).not.toHaveAttribute('href');
    await expect(fireEvent.click(disabled)).toBe(false);
    await expect(disabledActivation).not.toHaveBeenCalled();
  },
};

/** Open a grouped set of site links from a floating disclosure bar. */
export const Morph: StoryObj<Omit<NavigationShorthandProps, 'component'>> = {
  name: 'Floating site links',
  args: {
    variant: 'morph', label: 'Site', activeHref: '#overview',
    groups: [
      { label: 'Product', collapsible: true, items: [
        { label: 'Overview', href: '#overview', description: 'Projects and activity' },
        { label: 'Reports', href: '#reports', description: 'Usage and performance' },
      ] },
      { items: [{ label: 'About', href: '#about' }] },
    ],
  },
  render: (args) => <Navigation {...args} />,
  parameters: { docs: { description: { story: 'Open Product to browse destinations from a floating navigation bar.' }, source: { language: 'tsx', code: `import { Navigation } from '@jfrader/ui';

<Navigation variant="morph" label="Site" activeHref="#overview" groups={[
  { label: 'Product', collapsible: true, items: [
    { label: 'Overview', href: '#overview', description: 'Projects and activity' },
    { label: 'Reports', href: '#reports', description: 'Usage and performance' },
  ] },
  { items: [{ label: 'About', href: '#about' }] },
]} />` } } },
};
