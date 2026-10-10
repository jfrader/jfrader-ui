import type { CSSProperties } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fireEvent, fn, userEvent, within } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { css } from '../../styling/css';
import { withLightTheme } from '../../testing/story-decorators';
import { Navigation, type NavigationProps } from './index';

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

const frameStyle = css({
  inlineSize: '240px',
});

const surfaceStyle = {
  backgroundColor: vars.color.surface,
  padding: vars.space[4],
} satisfies CSSProperties;

const disabledActivation = fn();

const iconStyle = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
} satisfies CSSProperties;

const meta = {
  title: 'Navigation/Navigation',
  component: Navigation,
  decorators: [
    (Story) => (
      <div css={frameStyle}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Navigation>;

export default meta;

type Story = StoryObj<typeof meta>;

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
    <svg viewBox="0 0 16 16" style={iconStyle}>
      <circle cx="8" cy="8" r="6" />
    </svg>
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

export const Default: Story = {
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
    <div style={surfaceStyle}>
      <Navigation {...args}>
        <Navigation.Group label="Workspace" collapsible defaultOpen>
          {WORKSPACE.map((item) => (
            <Navigation.Item key={item.href} href={item.href} active={item.label === ACTIVE_LABEL}>
              {item.label}
            </Navigation.Item>
          ))}
        </Navigation.Group>
      </Navigation>
    </div>
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
