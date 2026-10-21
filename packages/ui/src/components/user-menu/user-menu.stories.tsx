import { Component, useState, type ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fireEvent, fn, spyOn, waitFor, within, type Mock } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { ClassNames, css } from '../../styling/css';
import { expectThemedSurface } from '../../testing/theme-assertions';
import { expectAligned, expectInside, expectMirroredDirection } from '../../testing/geometry-assertions';
import { withLightTheme } from '../../testing/story-decorators';
import { Button } from '../button';
import { ThemeRoot } from '../theme-root';
import {
  UserMenu,
  type UserMenuEasyProps,
  type UserMenuBaseProps,
  type UserMenuStatus,
  type UserMenuTheme,
  type UserMenuUser,
  type UserMenuVariant,
} from './index';
// `styled` is the app-facing styling API; consumers import it from `@jfrader/ui`.
import { styled } from '../../index';

const LightThemeFrame = styled.div({ padding: vars.space[4], backgroundColor: vars.color.bg });

const USER: UserMenuUser = { name: 'Ada Lovelace', email: 'ada@example.com', plan: 'Pro' };
const LONG_USER: UserMenuUser = {
  name: 'Maximiliana Alexandra Fernández de la Peña y Montenegro',
  email: 'maximiliana.alexandra.fernandez.de.la.pena@a-very-long-company-domain.example.com',
  plan: 0,
};
const LONG_PLAN = 'Enterprise workspace administrator with billing access';
const TRIGGER_LABEL = 'Account menu, Ada Lovelace';
const CLOSE_LABEL = 'Close account menu';
const PENDING_LABEL = 'Signing out';
const ERROR_MESSAGE = 'Sign out failed. Try again.';
const THEME_LABELS = { group: 'Appearance', light: 'Light', dark: 'Dark', system: 'System' };
const STATUS_LABELS = { group: 'Status', available: 'Available', busy: 'Busy', away: 'Away' };
// Sub-pixel layout and fractional devicePixelRatios: geometry is compared with a tolerance.
const TOLERANCE_PX = 1.5;
// Covers the 240ms sheet entry (the longest) with margin.
const SETTLE_MS = 320;
// Longer than the menu's 500ms typeahead buffer.
const TYPEAHEAD_RESET_WAIT_MS = 600;
// Handle drag past which release dismisses the sheet, in px.
const DISMISS_DRAG_PX = 80;
// Breakpoints that put any test viewport on one side: never compact, always compact.
const NEVER_COMPACT = 1;
const ALWAYS_COMPACT = 100_000;

const Row = styled.div({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: vars.space[3],
});

const Frame = styled.div({
  padding: vars.space[6],
  minBlockSize: '32rem',
});

// These values exercise registered classes and sx precedence.
const consumerCss = css({ marginInlineStart: vars.space[1], letterSpacing: '0.05em' });
const consumerSx = css({ marginInlineStart: vars.space[2] });

interface StoryArgs extends UserMenuBaseProps {
  variant: UserMenuVariant;
  showName?: boolean;
  onProfile: () => void;
  onSettings: () => void;
  onThemeChange: (value: UserMenuTheme) => void;
  onStatusChange: (value: UserMenuStatus) => void;
  onSignOut: () => void | Promise<unknown>;
  onSignOutError: (error: unknown) => void;
}

function EasyExample({
  onProfile: _onProfile,
  onSettings: _onSettings,
  onThemeChange: _onThemeChange,
  onStatusChange: _onStatusChange,
  showName: _showName,
  ...args
}: UserMenuEasyProps & Partial<Pick<StoryArgs, 'onProfile' | 'onSettings' | 'onThemeChange' | 'onStatusChange' | 'showName'>>) {
  return (
    <Row>
      <UserMenu {...args} />
      <Button>After</Button>
    </Row>
  );
}

function ProfileIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <circle cx="8" cy="5.5" r="2.5" />
      <path d="M3 13.5c.8-2.4 2.7-3.5 5-3.5s4.2 1.1 5 3.5" />
    </svg>
  );
}
ProfileIcon.displayName = 'ProfileIcon';

function AccountMenu({
  variant,
  showName,
  onProfile,
  onSettings,
  onThemeChange,
  onStatusChange,
  onSignOut,
  onSignOutError,
  ...props
}: StoryArgs) {
  return (
    <Row>
      <UserMenu {...props}>
        <UserMenu.Trigger aria-label={TRIGGER_LABEL} showName={showName} />
        <UserMenu.Content variant={variant} closeLabel={CLOSE_LABEL}>
          <UserMenu.Identity />
          <UserMenu.Item icon={<ProfileIcon />} onSelect={onProfile}>
            Profile
          </UserMenu.Item>
          <UserMenu.Item keys={['Ctrl', ',']} onSelect={onSettings}>
            Settings
          </UserMenu.Item>
          <UserMenu.Item disabled>Billing</UserMenu.Item>
          <UserMenu.Separator />
          <UserMenu.ThemeGroup labels={THEME_LABELS} onValueChange={onThemeChange} />
          <UserMenu.StatusGroup labels={STATUS_LABELS} onValueChange={onStatusChange} />
          <UserMenu.Separator />
          <UserMenu.SignOut
            onSignOut={onSignOut}
            onSignOutError={onSignOutError}
            pendingLabel={PENDING_LABEL}
            errorMessage={ERROR_MESSAGE}
          >
            Sign out
          </UserMenu.SignOut>
        </UserMenu.Content>
      </UserMenu>
      <Button>After</Button>
    </Row>
  );
}
AccountMenu.displayName = 'AccountMenu';

/** Portaled content lives in the story document's body, outside the canvas. */
const bodyOf = (canvasElement: HTMLElement) => within(canvasElement.ownerDocument.body);
const callValues = (spy: unknown) => (spy as Mock).mock.calls.map(([value]) => value);
const getTrigger = (canvasElement: HTMLElement, name = TRIGGER_LABEL) =>
  within(canvasElement).getByRole('button', { name });
const getAfter = (canvasElement: HTMLElement) => within(canvasElement).getByRole('button', { name: 'After' });
const findMenu = (canvasElement: HTMLElement, name = TRIGGER_LABEL) => bodyOf(canvasElement).findByRole('menu', { name });
const findSheet = (canvasElement: HTMLElement, name = USER.name) => bodyOf(canvasElement).findByRole('dialog', { name });
const shellOf = (canvasElement: HTMLElement) =>
  canvasElement.ownerDocument.querySelector<HTMLElement>('[data-ui="user-menu"]');
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function expectActive(canvasElement: HTMLElement, element: Element) {
  await waitFor(() => expect(canvasElement.ownerDocument.activeElement).toBe(element));
}

async function expectFocused(canvasElement: HTMLElement, name: string, role = 'menuitem') {
  await waitFor(() =>
    expect(canvasElement.ownerDocument.activeElement).toBe(bodyOf(canvasElement).getByRole(role, { name })),
  );
}

async function expectClosed(canvasElement: HTMLElement, trigger = getTrigger(canvasElement)) {
  await waitFor(() => expect(shellOf(canvasElement)).toBeNull());
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
}

async function expectFocusRing(element: Element) {
  const style = getComputedStyle(element);
  await expect(style.outlineStyle).not.toBe('none');
  // Fractional devicePixelRatios compute the authored 2px ring as e.g. 1.48837px.
  await expect(Math.abs(parseFloat(style.outlineWidth) - 2)).toBeLessThan(1.1);
}

const near = (actual: number, expected: number) => Math.abs(actual - expected) < TOLERANCE_PX;

/** A length (e.g. a token reference) resolved to px in `element`'s document, on a throwaway probe. */
function resolvedPx(element: Element, length: string) {
  const probe = element.ownerDocument.createElement('div');
  probe.style.inlineSize = length;
  element.ownerDocument.body.append(probe);
  const px = probe.getBoundingClientRect().width;
  probe.remove();
  return px;
}

/** True when a stylesheet rule under `query` matching `element` sets `property` to `expected`. */
function mediaRuleSets(element: Element, query: string, property: string, expected: string) {
  return Array.from(element.ownerDocument.styleSheets).some((sheet) =>
    Array.from(sheet.cssRules).some(
      (rule) =>
        rule instanceof CSSMediaRule &&
        rule.conditionText.includes(query) &&
        Array.from(rule.cssRules).some(
          (inner) =>
            inner instanceof CSSStyleRule &&
            element.matches(inner.selectorText) &&
            inner.style.getPropertyValue(property).toLowerCase() === expected,
        ),
    ),
  );
}

function deferred() {
  let resolve!: () => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<void>((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  return { promise, resolve, reject };
}

function pointer(element: Element, type: string, clientY: number, pointerId = 1, isPrimary = true) {
  const win = element.ownerDocument.defaultView!;
  fireEvent(
    element,
    new win.PointerEvent(type, { bubbles: true, cancelable: true, pointerId, isPrimary, button: 0, clientX: 10, clientY }),
  );
}

const meta = {
  title: 'Navigation/UserMenu',
  component: UserMenu,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Open account actions, change appearance or presence, and sign out from an avatar button.',
      },
      sections: [
        { title: 'Basic', stories: ['Default', 'Compound'] },
        { title: 'Customization', stories: ['CustomSlots'] },
        { title: 'Identity', stories: ['ShowName', 'CompactHidesName', 'PhotoFallback'] },
        { title: 'Preferences and state', stories: ['ThemeGroup', 'ControlledAccept'] },
        { title: 'Sign out', stories: ['SignOutSuccess', 'SignOutErrorRetry', 'SignOutPendingAcrossReopen'] },
        { title: 'Sheet', stories: ['Sheet', 'SheetHandle'] },
        { title: 'Identity only', stories: ['NoCommands'] },
      ],
      usage: `### When to use
Offer account actions, appearance and presence choices, and sign out from an avatar button. Connect preference changes to your application's services; choosing a theme or status does not update them automatically. Shortcut hints do not register keyboard shortcuts.

### Presentation and async actions

The adaptive presentation opens beside the avatar on wider screens and as a modal bottom sheet below 640px by default. The sheet contains focus, makes the rest of the page inert, and locks page scrolling.

A sign-out promise keeps the action busy until it settles. Success closes the surface that started it; failure keeps that surface open and announces an alert for retry. A pending action cannot be started again, and settling it does not close a newly reopened surface.

### Keyboard and accessibility

Give the avatar button an accessible name that identifies the account. The sheet is named by the displayed identity.

Enter, Space, or ArrowDown opens the first enabled command; ArrowUp opens the last. Arrows wrap over commands and radio options, Home/End jump, and typeahead resets after 500ms. Disabled commands stay visible but are skipped. Left/Right moves within a choice group without selecting; Enter/Space selects and keeps it open.

Accepted Escape or command selection returns focus to the avatar unless the command already moved focus. Desktop Tab out and outside press close without restoring focus; Shift+Tab from the first command returns to the avatar while leaving the menu open. In the sheet, Tab and Shift+Tab cycle inside; Escape, Close, scrim press, or a downward handle drag requests closure and returns focus after acceptance. With no commands, the menu itself receives focus so Escape still works.`,
    },
    // Floating UI's focus guards are aria-hidden spans with tabindex=0 that forward focus
    // immediately; axe flags them as aria-hidden-focus (known false positive). Every other
    // aria-hidden element is still checked.
    // axe reads the Trigger's aria-hidden avatar initials ("AL") as visible label text. They are
    // the avatar picture, not a label; the Trigger's aria-label carries the person's name. Every
    // other element is still checked for label-content-name-mismatch.
    a11y: {
      config: {
        rules: [
          { id: 'aria-hidden-focus', selector: '[aria-hidden="true"]:not([data-floating-ui-focus-guard])' },
          { id: 'label-content-name-mismatch', selector: ':not([data-ui="user-menu-trigger"])' },
        ],
      },
    },
  },
  args: {
    user: USER,
    variant: 'menu',
    onOpenChange: fn(),
    onProfile: fn(),
    onSettings: fn(),
    onThemeChange: fn(),
    onStatusChange: fn(),
    onSignOut: fn(),
    onSignOutError: fn(),
  },
  argTypes: {
    variant: { control: 'inline-radio', options: ['adaptive', 'menu', 'sheet'] },
  },
  decorators: [
    (Story) => (
      <Frame>
        <Story />
      </Frame>
    ),
  ],
  render: (args) => <AccountMenu {...args} />,
} satisfies Omit<Meta<StoryArgs>, 'component'> & { component: typeof UserMenu };

export default meta;

type Story = StoryObj<Omit<typeof meta, 'component'>>;

function easyModeTypeContracts() {
  const messages = { trigger: 'Account', close: 'Close', signOut: 'Sign out', pending: 'Signing out', error: 'Try again' };
  // @ts-expect-error Easy mode rejects compound children.
  <UserMenu user={USER} messages={messages}>Children</UserMenu>;
  // @ts-expect-error Easy mode requires messages.
  <UserMenu user={USER} items={[]} />;
  // @ts-expect-error Easy mode requires user.
  <UserMenu messages={messages} />;
}
void easyModeTypeContracts;

export const Default: StoryObj<(props: UserMenuEasyProps) => ReactNode> = {
  beforeEach: () => {
    const error = spyOn(console, 'error');
    return () => error.mockRestore();
  },
  name: 'Account actions',
  args: {
    user: USER,
    variant: 'menu',
    messages: {
      trigger: TRIGGER_LABEL,
      close: CLOSE_LABEL,
      signOut: 'Sign out',
      pending: PENDING_LABEL,
      error: ERROR_MESSAGE,
    },
    items: [
      { type: 'item', label: 'Profile', icon: <ProfileIcon />, onSelect: fn() },
      { type: 'item', label: 'Settings', keys: ['Ctrl', ','], onSelect: fn() },
      { type: 'item', label: 'Billing', disabled: true },
    ],
    theme: { labels: THEME_LABELS, onValueChange: fn() },
    status: { labels: STATUS_LABELS, onValueChange: fn() },
    onSignOut: fn(),
    onOpenChange: fn(),
  },
  parameters: {
    docs: {
      description: { story: 'Open the account menu for profile actions, appearance, presence, and sign out.' },
      source: {
        language: 'tsx',
        code: `import { Button, UserMenu, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const Row = styled.div({ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: vars.space[3] });
function ProfileIcon() {
  return <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <circle cx="8" cy="5.5" r="2.5" />
    <path d="M3 13.5c.8-2.4 2.7-3.5 5-3.5s4.2 1.1 5 3.5" />
  </svg>;
}

<Row>
<UserMenu
  variant="menu"
  user={{ name: 'Ada Lovelace', email: 'ada@example.com', plan: 'Pro' }}
  messages={{
    trigger: 'Account menu, Ada Lovelace',
    close: 'Close account menu',
    signOut: 'Sign out',
    pending: 'Signing out',
    error: 'Sign out failed. Try again.',
  }}
  items={[
    { label: 'Profile', icon: <ProfileIcon />, onSelect: openProfile },
    { label: 'Settings', keys: ['Ctrl', ','], onSelect: openSettings },
    { label: 'Billing', disabled: true },
  ]}
  theme={{ labels: { group: 'Appearance', light: 'Light', dark: 'Dark', system: 'System' }, onValueChange: setTheme }}
  status={{ labels: { group: 'Status', available: 'Available', busy: 'Busy', away: 'Away' }, onValueChange: setStatus }}
  onSignOut={signOut}
/>
<Button>After</Button>
</Row>`,
      },
    },
  },
  render: (args) => <EasyExample {...args} />,
  play: async ({ args, canvasElement, userEvent }) => {
    await expect(console.error).not.toHaveBeenCalled();
    const trigger = getTrigger(canvasElement);
    await expect(trigger).toHaveAttribute('data-ui', 'user-menu-trigger');
    await expect(trigger).toHaveAttribute('type', 'button');
    await expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');

    await userEvent.click(trigger);
    const menu = await findMenu(canvasElement);
    const shell = shellOf(canvasElement)!;
    await expect(canvasElement.contains(shell)).toBe(false);
    await expect(shell).toHaveAttribute('data-presentation', 'menu');
    await expect(menu).toHaveAttribute('data-ui', 'user-menu-list');
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');

    // Identity
    const identity = shell.querySelector('[data-ui="user-menu-identity"]')!;
    await expect(identity).toHaveTextContent(`${USER.name}${USER.email}Pro`);

    await expectFocused(canvasElement, 'Profile');
    await userEvent.click(within(menu).getByRole('menuitem', { name: 'Profile' }));
    await expect(args.items?.[0]?.onSelect).toHaveBeenCalledTimes(1);
    await expectClosed(canvasElement);
    await expectActive(canvasElement, trigger);
  },
};

export const EasyKeyboard: StoryObj<(props: UserMenuEasyProps) => ReactNode> = {
  ...Default,
  name: 'Easy mode keyboard',
  play: async ({ canvasElement, userEvent }) => {
    const trigger = getTrigger(canvasElement);
    await userEvent.tab();
    await expectActive(canvasElement, trigger);
    await userEvent.keyboard('{Enter}');
    const menu = await findMenu(canvasElement);
    await expect(menu).toHaveAttribute('data-ui', 'user-menu-list');
    await expectFocused(canvasElement, 'Profile');

    await userEvent.keyboard('{ArrowDown}');
    await expectFocused(canvasElement, 'Settings');
    // Skips disabled 'Billing' and moves to Light radio
    await userEvent.keyboard('{ArrowDown}');
    await expectFocused(canvasElement, 'Light', 'menuitemradio');

    await userEvent.keyboard('{Escape}');
    await expectClosed(canvasElement);
    await expectActive(canvasElement, trigger);

    await userEvent.tab();
    await expectActive(canvasElement, getAfter(canvasElement));
  },
};

export const EasyDismissal: StoryObj<(props: UserMenuEasyProps) => ReactNode> = {
  ...Default,
  name: 'Easy mode dismissal',
  play: async ({ canvasElement, userEvent }) => {
    const trigger = getTrigger(canvasElement);
    await userEvent.click(trigger);
    await findMenu(canvasElement);

    await userEvent.click(getAfter(canvasElement));
    await expectClosed(canvasElement);
  },
};

export const EasyControlled: StoryObj<(props: UserMenuEasyProps) => ReactNode> = {
  ...Default,
  tags: ['!autodocs'],
  name: 'Easy mode controlled',
  args: {
    ...Default.args,
    open: true,
  },
  play: async ({ canvasElement, args, userEvent }) => {
    const menu = await findMenu(canvasElement);
    await expectFocused(canvasElement, 'Profile');

    await userEvent.keyboard('{Escape}');
    await expect(args.onOpenChange).toHaveBeenCalledWith(false);
    await expect(bodyOf(canvasElement).getByRole('menu', { name: TRIGGER_LABEL })).toBe(menu);
    await expectFocused(canvasElement, 'Profile');
  },
};

export const EasyDisabled: StoryObj<(props: UserMenuEasyProps) => ReactNode> = {
  ...Default,
  name: 'Easy mode disabled',
  play: async ({ canvasElement, userEvent }) => {
    const trigger = getTrigger(canvasElement);
    await userEvent.click(trigger);
    const menu = await findMenu(canvasElement);

    const disabledItem = within(menu).getByRole('menuitem', { name: 'Billing' });
    await expect(disabledItem).toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(disabledItem);
    await expect(bodyOf(canvasElement).getByRole('menu', { name: TRIGGER_LABEL })).toBe(menu);

    await userEvent.keyboard('{Escape}');
    await expectClosed(canvasElement);
  },
};

export const EasyAsyncSignOut: StoryObj<(props: UserMenuEasyProps) => ReactNode> = {
  ...Default,
  name: 'Easy mode async sign out',
  play: async ({ args, canvasElement, userEvent }) => {
    const pending = deferred();
    (args.onSignOut as Mock).mockImplementation(() => pending.promise);
    const trigger = getTrigger(canvasElement);
    await userEvent.tab();
    await userEvent.keyboard('{ArrowUp}');
    await expectFocused(canvasElement, 'Sign out');
    await userEvent.keyboard('{Enter}');
    await expect(args.onSignOut).toHaveBeenCalledTimes(1);

    const busy = await bodyOf(canvasElement).findByRole('menuitem', { name: PENDING_LABEL });
    await expect(busy).toHaveAttribute('aria-busy', 'true');
    await expect(busy).toHaveAttribute('aria-disabled', 'true');

    pending.resolve();
    await expectClosed(canvasElement);
    await expectActive(canvasElement, trigger);
  },
};

export const CustomSlots: StoryObj<(props: UserMenuEasyProps) => ReactNode> = {
  ...Default,
  name: 'Part props',
  parameters: { docs: {
    description: { story: 'Apply classes to generated account controls, identity, preferences, and sign out.' },
    source: { language: 'tsx', code: `import { Button, UserMenu, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const Row = styled.div({ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: vars.space[3] });
function ProfileIcon() {
  return <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <circle cx="8" cy="5.5" r="2.5" />
    <path d="M3 13.5c.8-2.4 2.7-3.5 5-3.5s4.2 1.1 5 3.5" />
  </svg>;
}

<Row>
  <UserMenu
    variant="menu"
    user={{ name: 'Ada Lovelace', email: 'ada@example.com', plan: 'Pro' }}
    messages={{
      trigger: 'Account menu, Ada Lovelace', close: 'Close account menu',
      signOut: 'Sign out', pending: 'Signing out', error: 'Sign out failed. Try again.',
    }}
    items={[
      { label: 'Profile', icon: <ProfileIcon />, onSelect: openProfile },
      { label: 'Settings', keys: ['Ctrl', ','], onSelect: openSettings },
      { label: 'Billing', disabled: true },
    ]}
    theme={{ labels: { group: 'Appearance', light: 'Light', dark: 'Dark', system: 'System' }, onValueChange: setTheme }}
    status={{ labels: { group: 'Status', available: 'Available', busy: 'Busy', away: 'Away' }, onValueChange: setStatus }}
    onSignOut={signOut}
    slotProps={{
      trigger: { className: 'custom-trigger' },
      content: { className: 'custom-content' },
      identity: { className: 'custom-identity' },
      item: { className: 'custom-item' },
      separator: { className: 'custom-separator' },
      themeGroup: { className: 'custom-theme-group' },
      statusGroup: { className: 'custom-status-group' },
      signOut: { className: 'custom-sign-out' },
    }}
  />
  <Button>After</Button>
</Row>` },
  } },
  args: {
    ...Default.args,
    slotProps: {
      trigger: { className: 'custom-trigger' },
      content: { className: 'custom-content' },
      identity: { className: 'custom-identity' },
      item: { className: 'custom-item' },
      separator: { className: 'custom-separator' },
      themeGroup: { className: 'custom-theme-group' },
      statusGroup: { className: 'custom-status-group' },
      signOut: { className: 'custom-sign-out' },
    },
  },
  play: async ({ canvasElement, userEvent }) => {
    const trigger = getTrigger(canvasElement);
    await expect(trigger).toHaveClass('custom-trigger');

    await userEvent.click(trigger);
    const menu = await findMenu(canvasElement);
    const shell = shellOf(canvasElement)!;
    await expect(shell).toHaveClass('custom-content');

    const identity = shell.querySelector('[data-ui="user-menu-identity"]')!;
    await expect(identity).toHaveClass('custom-identity');

    const items = within(menu).getAllByRole('menuitem');
    await expect(items[0]).toHaveClass('custom-item');
    await expect(items[1]).toHaveClass('custom-item');
    await expect(items[2]).toHaveClass('custom-item');

    const signOut = within(menu).getByRole('menuitem', { name: 'Sign out' });
    await expect(signOut).toHaveClass('custom-sign-out');

    for (const separator of within(shell).getAllByRole('separator')) {
      await expect(separator).toHaveClass('custom-separator');
    }

    const themeGroup = shell.querySelector('[data-ui="user-menu-theme-group"]');
    await expect(themeGroup).toHaveClass('custom-theme-group');

    const statusGroup = shell.querySelector('[data-ui="user-menu-status-group"]');
    await expect(statusGroup).toHaveClass('custom-status-group');

    await userEvent.keyboard('{Escape}');
    await expectClosed(canvasElement);
  },
};

export const Compound: Story = {
  name: 'Compound anatomy',
  parameters: {
    docs: {
      description: { story: 'Compose identity, commands, theme and status choices, and sign out explicitly.' },
      source: {
        language: 'tsx',
        code: `import { Button, UserMenu, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const Row = styled.div({ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: vars.space[3] });
function ProfileIcon() {
  return <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <circle cx="8" cy="5.5" r="2.5" />
    <path d="M3 13.5c.8-2.4 2.7-3.5 5-3.5s4.2 1.1 5 3.5" />
  </svg>;
}

<Row>
<UserMenu user={{ name: 'Ada Lovelace', email: 'ada@example.com', plan: 'Pro' }}>
  <UserMenu.Trigger aria-label="Account menu, Ada Lovelace" />
  <UserMenu.Content variant="menu" closeLabel="Close account menu">
    <UserMenu.Identity />
    <UserMenu.Item icon={<ProfileIcon />} onSelect={openProfile}>Profile</UserMenu.Item>
    <UserMenu.Item keys={['Ctrl', ',']} onSelect={openSettings}>Settings</UserMenu.Item>
    <UserMenu.Item disabled>Billing</UserMenu.Item>
    <UserMenu.Separator />
    <UserMenu.ThemeGroup labels={{ group: 'Appearance', light: 'Light', dark: 'Dark', system: 'System' }} onValueChange={setTheme} />
    <UserMenu.StatusGroup labels={{ group: 'Status', available: 'Available', busy: 'Busy', away: 'Away' }} onValueChange={setStatus} />
    <UserMenu.Separator />
    <UserMenu.SignOut onSignOut={signOut} onSignOutError={reportError} pendingLabel="Signing out" errorMessage="Sign out failed. Try again.">
      Sign out
    </UserMenu.SignOut>
  </UserMenu.Content>
</UserMenu>
<Button>After</Button>
</Row>`,
      },
    },
  },
  play: async ({ args, canvasElement, userEvent }) => {
    const trigger = getTrigger(canvasElement);
    await expect(trigger).toHaveAttribute('data-ui', 'user-menu-trigger');
    await expect(trigger).toHaveAttribute('type', 'button');
    await expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(trigger).not.toHaveAttribute('aria-controls');
    // The decorative avatar does not double the name.
    await expect(trigger.querySelector('[data-ui="avatar"]')).toHaveAttribute('aria-hidden', 'true');

    await userEvent.click(trigger);
    const menu = await findMenu(canvasElement);
    const shell = shellOf(canvasElement)!;
    await expect(canvasElement.contains(shell)).toBe(false);
    await expect(shell).toHaveAttribute('data-presentation', 'menu');
    await expect(shell).not.toHaveAttribute('role');
    await expect(menu).toHaveAttribute('data-ui', 'user-menu-list');
    await expect(menu).toHaveAttribute('aria-labelledby', trigger.id);
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await expect(trigger).toHaveAttribute('aria-controls', menu.id);
    await expectFocused(canvasElement, 'Profile');

    // Identity is outside the menu: readable text, not a command.
    const identity = shell.querySelector('[data-ui="user-menu-identity"]')!;
    await expect(identity).toHaveTextContent(`${USER.name}${USER.email}Pro`);
    await expect(menu.contains(identity)).toBe(false);
    await expect(identity.querySelector('[tabindex]')).toBeNull();
    await expect(within(menu).getAllByRole('menuitem')).toHaveLength(4);
    await expect(within(menu).getAllByRole('menuitemradio')).toHaveLength(6);

    await userEvent.click(within(menu).getByRole('menuitem', { name: 'Profile' }));
    await expect(args.onProfile).toHaveBeenCalledTimes(1);
    await expect(args.onSettings).not.toHaveBeenCalled();
    await expectClosed(canvasElement);
    // An accepted selection returns focus to the Trigger.
    await expectActive(canvasElement, trigger);
    await expect(callValues(args.onOpenChange)).toEqual([true, false]);
  },
};

export const Keyboard: Story = {
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { Button, styled, UserMenu } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const Row = styled.div({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: vars.space[3],
});

function ProfileIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <circle cx="8" cy="5.5" r="2.5" />
      <path d="M3 13.5c.8-2.4 2.7-3.5 5-3.5s4.2 1.1 5 3.5" />
    </svg>
  );
}

<Row>
  <UserMenu user={{ name: 'Ada Lovelace', email: 'ada@example.com', plan: 'Pro' }}>
    <UserMenu.Trigger aria-label="Account menu, Ada Lovelace" />
    <UserMenu.Content variant="menu" closeLabel="Close account menu">
      <UserMenu.Identity />
      <UserMenu.Item icon={<ProfileIcon />} onSelect={() => {}}>
        Profile
      </UserMenu.Item>
      <UserMenu.Item keys={['Ctrl', ',']} onSelect={() => {}}>
        Settings
      </UserMenu.Item>
      <UserMenu.Item disabled>Billing</UserMenu.Item>
      <UserMenu.Separator />
      <UserMenu.ThemeGroup
        labels={{ group: 'Appearance', light: 'Light', dark: 'Dark', system: 'System' }}
        onValueChange={(theme) => {}}
      />
      <UserMenu.StatusGroup
        labels={{ group: 'Status', available: 'Available', busy: 'Busy', away: 'Away' }}
        onValueChange={(status) => {}}
      />
      <UserMenu.Separator />
      <UserMenu.SignOut
        pendingLabel="Signing out"
        errorMessage="Sign out failed. Try again."
        onSignOut={async () => {
          const res = await fetch('/api/auth/sign-out', { method: 'POST' });
          if (!res.ok) throw new Error('Sign out failed');
        }}
      >
        Sign out
      </UserMenu.SignOut>
    </UserMenu.Content>
  </UserMenu>
  <Button>After</Button>
</Row>`,
      },
    },
  },
  play: async ({ args, canvasElement, userEvent }) => {
    const trigger = getTrigger(canvasElement);
    await userEvent.tab();
    await expectActive(canvasElement, trigger);
    await expectFocusRing(trigger);

    // Enter opens on the first item; arrows wrap and skip the disabled item; every radio is a stop.
    await userEvent.keyboard('{Enter}');
    await findMenu(canvasElement);
    await expectFocused(canvasElement, 'Profile');
    await expectFocusRing(canvasElement.ownerDocument.activeElement!);
    await userEvent.keyboard('{ArrowDown}');
    await expectFocused(canvasElement, 'Settings');
    await userEvent.keyboard('{ArrowDown}');
    await expectFocused(canvasElement, 'Light', 'menuitemradio');
    await userEvent.keyboard('{ArrowDown}');
    await expectFocused(canvasElement, 'Dark', 'menuitemradio');
    await userEvent.keyboard('{End}');
    await expectFocused(canvasElement, 'Sign out');
    await userEvent.keyboard('{ArrowUp}');
    await expectFocused(canvasElement, 'Away', 'menuitemradio');
    await userEvent.keyboard('{ArrowDown}{ArrowDown}');
    await expectFocused(canvasElement, 'Profile');
    await userEvent.keyboard('{ArrowUp}');
    await expectFocused(canvasElement, 'Sign out');
    await userEvent.keyboard('{Home}');
    await expectFocused(canvasElement, 'Profile');

    // Typeahead over translated labels skips the disabled item; the buffer resets after 500ms.
    await userEvent.keyboard('s');
    await expectFocused(canvasElement, 'Settings');
    await wait(TYPEAHEAD_RESET_WAIT_MS);
    await userEvent.keyboard('b');
    await expectFocused(canvasElement, 'Busy', 'menuitemradio');
    await wait(TYPEAHEAD_RESET_WAIT_MS);

    // Escape closes and returns focus to the Trigger.
    await userEvent.keyboard('{Escape}');
    await expectClosed(canvasElement);
    await expectActive(canvasElement, trigger);

    // ArrowUp opens on the last item; ArrowDown and Space open on the first.
    await userEvent.keyboard('{ArrowUp}');
    await expectFocused(canvasElement, 'Sign out');
    await userEvent.keyboard('{Escape}');
    await expectClosed(canvasElement);
    await userEvent.keyboard('{ArrowDown}');
    await expectFocused(canvasElement, 'Profile');
    await userEvent.keyboard('{Escape}');
    await expectClosed(canvasElement);
    await userEvent.keyboard(' ');
    await expectFocused(canvasElement, 'Profile');

    // Space and Enter activate a command exactly once.
    await userEvent.keyboard('{ArrowDown} ');
    await expect(args.onSettings).toHaveBeenCalledTimes(1);
    await expectClosed(canvasElement);
    await expectActive(canvasElement, trigger);
    await userEvent.keyboard('{Enter}');
    await expectFocused(canvasElement, 'Profile');
    await userEvent.keyboard('{Enter}');
    await expect(args.onProfile).toHaveBeenCalledTimes(1);
    await expectClosed(canvasElement);
    await expectActive(canvasElement, trigger);
    await expect(callValues(args.onOpenChange)).toEqual([true, false, true, false, true, false, true, false, true, false]);
  },
};

export const TabAndOutsidePress: Story = {
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { Button, styled, UserMenu } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const Row = styled.div({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: vars.space[3],
});

function ProfileIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <circle cx="8" cy="5.5" r="2.5" />
      <path d="M3 13.5c.8-2.4 2.7-3.5 5-3.5s4.2 1.1 5 3.5" />
    </svg>
  );
}

<Row>
  <UserMenu user={{ name: 'Ada Lovelace', email: 'ada@example.com', plan: 'Pro' }}>
    <UserMenu.Trigger aria-label="Account menu, Ada Lovelace" />
    <UserMenu.Content variant="menu" closeLabel="Close account menu">
      <UserMenu.Identity />
      <UserMenu.Item icon={<ProfileIcon />} onSelect={() => {}}>
        Profile
      </UserMenu.Item>
      <UserMenu.Item keys={['Ctrl', ',']} onSelect={() => {}}>
        Settings
      </UserMenu.Item>
      <UserMenu.Item disabled>Billing</UserMenu.Item>
      <UserMenu.Separator />
      <UserMenu.ThemeGroup
        labels={{ group: 'Appearance', light: 'Light', dark: 'Dark', system: 'System' }}
        onValueChange={(theme) => {}}
      />
      <UserMenu.StatusGroup
        labels={{ group: 'Status', available: 'Available', busy: 'Busy', away: 'Away' }}
        onValueChange={(status) => {}}
      />
      <UserMenu.Separator />
      <UserMenu.SignOut
        pendingLabel="Signing out"
        errorMessage="Sign out failed. Try again."
        onSignOut={async () => {
          const res = await fetch('/api/auth/sign-out', { method: 'POST' });
          if (!res.ok) throw new Error('Sign out failed');
        }}
      >
        Sign out
      </UserMenu.SignOut>
    </UserMenu.Content>
  </UserMenu>
  <Button>After</Button>
</Row>`,
      },
    },
  },
  play: async ({ args, canvasElement, userEvent }) => {
    const trigger = getTrigger(canvasElement);
    const after = getAfter(canvasElement);
    const triggerFocus = fn();

    // Shift+Tab from the first item returns to the Trigger with the menu open (Menu policy).
    await userEvent.tab();
    await userEvent.keyboard('{Enter}');
    await expectFocused(canvasElement, 'Profile');
    await userEvent.tab({ shift: true });
    await expectActive(canvasElement, trigger);
    await expect(await findMenu(canvasElement)).toBeVisible();
    await userEvent.keyboard('{Escape}');
    await expectClosed(canvasElement);

    // Tab out closes and lets focus move on, without a transient Trigger focus.
    await userEvent.keyboard('{Enter}');
    await expectFocused(canvasElement, 'Profile');
    trigger.addEventListener('focus', triggerFocus);
    await userEvent.keyboard('{End}');
    await userEvent.tab();
    await expectClosed(canvasElement);
    const active = canvasElement.ownerDocument.activeElement!;
    await expect(active).not.toBe(canvasElement.ownerDocument.body);
    await expect(active.closest('[data-ui="user-menu"]')).toBeNull();
    await wait(SETTLE_MS);
    trigger.removeEventListener('focus', triggerFocus);
    await expect(triggerFocus).not.toHaveBeenCalled();

    // An outside press dismisses without focusing the Trigger.
    await userEvent.click(trigger);
    await expectFocused(canvasElement, 'Profile');
    trigger.addEventListener('focus', triggerFocus);
    await userEvent.click(after);
    await expectClosed(canvasElement);
    await expectActive(canvasElement, after);
    trigger.removeEventListener('focus', triggerFocus);
    await expect(triggerFocus).not.toHaveBeenCalled();
    await expect(callValues(args.onOpenChange)).toEqual([true, false, true, false, true, false]);
  },
};

export const ShowName: Story = {
  name: 'Name beside avatar',
  parameters: {
    docs: {
      description: { story: 'Show Ada Lovelace beside the avatar outside compact viewports.' },
      source: {
        language: 'tsx',
        code: `import { Button, styled, UserMenu } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const Row = styled.div({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: vars.space[3],
});

function ProfileIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <circle cx="8" cy="5.5" r="2.5" />
      <path d="M3 13.5c.8-2.4 2.7-3.5 5-3.5s4.2 1.1 5 3.5" />
    </svg>
  );
}

<Row>
  <UserMenu
    compactBreakpoint={1}
    user={{ name: 'Ada Lovelace', email: 'ada@example.com', plan: 'Pro' }}
  >
    <UserMenu.Trigger aria-label="Account menu, Ada Lovelace" showName />
    <UserMenu.Content variant="menu" closeLabel="Close account menu">
      <UserMenu.Identity />
      <UserMenu.Item icon={<ProfileIcon />} onSelect={() => {}}>
        Profile
      </UserMenu.Item>
      <UserMenu.Item keys={['Ctrl', ',']} onSelect={() => {}}>
        Settings
      </UserMenu.Item>
      <UserMenu.Item disabled>Billing</UserMenu.Item>
      <UserMenu.Separator />
      <UserMenu.ThemeGroup
        labels={{ group: 'Appearance', light: 'Light', dark: 'Dark', system: 'System' }}
        onValueChange={(theme) => {}}
      />
      <UserMenu.StatusGroup
        labels={{ group: 'Status', available: 'Available', busy: 'Busy', away: 'Away' }}
        onValueChange={(status) => {}}
      />
      <UserMenu.Separator />
      <UserMenu.SignOut
        pendingLabel="Signing out"
        errorMessage="Sign out failed. Try again."
        onSignOut={async () => {
          const res = await fetch('/api/auth/sign-out', { method: 'POST' });
          if (!res.ok) throw new Error('Sign out failed');
        }}
      >
        Sign out
      </UserMenu.SignOut>
    </UserMenu.Content>
  </UserMenu>
  <Button>After</Button>
</Row>`,
      },
    },
  },
  args: { showName: true, compactBreakpoint: NEVER_COMPACT },
  play: async ({ canvasElement }) => {
    const trigger = getTrigger(canvasElement);
    // The visible name sits beside the avatar; the aria-label still names the button.
    await expect(trigger).toHaveTextContent(USER.name);
    await expect(trigger).toHaveAccessibleName(TRIGGER_LABEL);
    await expect(trigger.getBoundingClientRect().height).toBeGreaterThanOrEqual(32 - TOLERANCE_PX);
  },
};

export const CompactHidesName: Story = {
  name: 'Compact avatar',
  parameters: {
    docs: {
      description: { story: 'Keep the account name accessible while showing only the avatar in compact mode.' },
      source: {
        language: 'tsx',
        code: `import { Button, styled, UserMenu } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const Row = styled.div({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: vars.space[3],
});

function ProfileIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <circle cx="8" cy="5.5" r="2.5" />
      <path d="M3 13.5c.8-2.4 2.7-3.5 5-3.5s4.2 1.1 5 3.5" />
    </svg>
  );
}

<Row>
  <UserMenu
    compactBreakpoint={100_000}
    user={{ name: 'Ada Lovelace', email: 'ada@example.com', plan: 'Pro' }}
  >
    <UserMenu.Trigger aria-label="Account menu, Ada Lovelace" showName />
    <UserMenu.Content variant="adaptive" closeLabel="Close account menu">
      <UserMenu.Identity />
      <UserMenu.Item icon={<ProfileIcon />} onSelect={() => {}}>
        Profile
      </UserMenu.Item>
      <UserMenu.Item keys={['Ctrl', ',']} onSelect={() => {}}>
        Settings
      </UserMenu.Item>
      <UserMenu.Item disabled>Billing</UserMenu.Item>
      <UserMenu.Separator />
      <UserMenu.ThemeGroup
        labels={{ group: 'Appearance', light: 'Light', dark: 'Dark', system: 'System' }}
        onValueChange={(theme) => {}}
      />
      <UserMenu.StatusGroup
        labels={{ group: 'Status', available: 'Available', busy: 'Busy', away: 'Away' }}
        onValueChange={(status) => {}}
      />
      <UserMenu.Separator />
      <UserMenu.SignOut
        pendingLabel="Signing out"
        errorMessage="Sign out failed. Try again."
        onSignOut={async () => {
          const res = await fetch('/api/auth/sign-out', { method: 'POST' });
          if (!res.ok) throw new Error('Sign out failed');
        }}
      >
        Sign out
      </UserMenu.SignOut>
    </UserMenu.Content>
  </UserMenu>
  <Button>After</Button>
</Row>`,
      },
    },
  },
  args: { showName: true, compactBreakpoint: ALWAYS_COMPACT, variant: 'adaptive' },
  play: async ({ canvasElement }) => {
    const trigger = getTrigger(canvasElement);
    // Below the breakpoint only the avatar shows; the name stays in the accessible name.
    await expect(trigger).not.toHaveTextContent(USER.name);
    await expect(trigger).toHaveAccessibleName(TRIGGER_LABEL);
    await expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
  },
};

function PhotoMenu(args: StoryArgs) {
  const [src, setSrc] = useState('data:image/png;base64,broken');
  return (
    <Row>
      <AccountMenu {...args} user={{ ...USER, avatarSrc: src }} />
      <Button onClick={() => setSrc('data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22/%3E')}>
        New photo
      </Button>
    </Row>
  );
}
PhotoMenu.displayName = 'PhotoMenu';

export const PhotoFallback: Story = {
  name: 'Photo fallback and retry',
  parameters: { docs: {
    description: { story: 'A failed photo shows initials; choose New photo to retry with a different image.' },
    source: { language: 'tsx', code: `import { useState } from 'react';
import { Button, UserMenu, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const Row = styled.div({ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: vars.space[3] });
function ProfileIcon() {
  return <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <circle cx="8" cy="5.5" r="2.5" />
    <path d="M3 13.5c.8-2.4 2.7-3.5 5-3.5s4.2 1.1 5 3.5" />
  </svg>;
}

function AccountPhoto() {
  const [src, setSrc] = useState('data:image/png;base64,broken');
  return (
    <Row>
      <Row>
        <UserMenu user={{ name: 'Ada Lovelace', email: 'ada@example.com', plan: 'Pro', avatarSrc: src }}>
          <UserMenu.Trigger aria-label="Account menu, Ada Lovelace" />
          <UserMenu.Content variant="menu" closeLabel="Close account menu">
            <UserMenu.Identity />
            <UserMenu.Item icon={<ProfileIcon />} onSelect={openProfile}>Profile</UserMenu.Item>
            <UserMenu.Item keys={['Ctrl', ',']} onSelect={openSettings}>Settings</UserMenu.Item>
            <UserMenu.Item disabled>Billing</UserMenu.Item>
            <UserMenu.Separator />
            <UserMenu.ThemeGroup labels={{ group: 'Appearance', light: 'Light', dark: 'Dark', system: 'System' }} onValueChange={setTheme} />
            <UserMenu.StatusGroup labels={{ group: 'Status', available: 'Available', busy: 'Busy', away: 'Away' }} onValueChange={setStatus} />
            <UserMenu.Separator />
            <UserMenu.SignOut onSignOut={signOut} onSignOutError={reportError} pendingLabel="Signing out" errorMessage="Sign out failed. Try again.">Sign out</UserMenu.SignOut>
          </UserMenu.Content>
        </UserMenu>
        <Button>After</Button>
      </Row>
      <Button onClick={() => setSrc('data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22/%3E')}>New photo</Button>
    </Row>
  );
}` },
  } },
  render: (args) => <PhotoMenu {...args} />,
  play: async ({ canvasElement }) => {
    const trigger = getTrigger(canvasElement);
    // A broken photo falls back to the Avatar's grapheme-aware initials.
    await waitFor(() => expect(trigger.querySelector('img')).toBeNull());
    await expect(trigger.querySelector('[data-ui="avatar"]')).toHaveTextContent('AL');
    // A new photo gets a fresh attempt.
    fireEvent.click(within(canvasElement).getByRole('button', { name: 'New photo' }));
    await waitFor(() => expect(trigger.querySelector('img')).not.toBeNull());
    await expect(trigger.querySelector('img')).toHaveAttribute('alt', '');
  },
};

export const GraphemeInitials: Story = {
  tags: ['!autodocs'],
  args: { user: { name: '👩‍💻 Élodie', email: 'elodie@example.com' } },
  render: ({ user, open, defaultOpen, onOpenChange }) => (
    <UserMenu user={user} open={open} defaultOpen={defaultOpen} onOpenChange={onOpenChange}>
      <UserMenu.Trigger aria-label="Account menu, Élodie" />
      <UserMenu.Content variant="menu">
        <UserMenu.Item>Profile</UserMenu.Item>
      </UserMenu.Content>
    </UserMenu>
  ),
  play: async ({ canvasElement }) => {
    const trigger = getTrigger(canvasElement, 'Account menu, Élodie');
    await expect(trigger.querySelector('[data-ui="avatar"]')).toHaveTextContent('👩‍💻É');
  },
};

export const PlanZeroAndLongIdentity: Story = {
  tags: ['!autodocs'],
  args: {
    defaultOpen: true,
    user: LONG_USER,
  },
  play: async ({ canvasElement }) => {
    const shell = shellOf(canvasElement)!;
    await findMenu(canvasElement);
    const identity = shell.querySelector<HTMLElement>('[data-ui="user-menu-identity"]')!;
    // 0 is a plan: it renders.
    await expect(identity.querySelector('[data-ui="pill"]')).toHaveTextContent('0');
    // Long text ellipsizes inside the surface (measured after the entry scale settles); the full
    // text stays in the DOM for AT.
    await wait(SETTLE_MS);
    const box = shell.getBoundingClientRect();
    const leaves = Array.from(identity.querySelectorAll('span')).filter((node) => node.childElementCount === 0);
    for (const text of leaves) {
      const rect = text.getBoundingClientRect();
      await expect(rect.right).toBeLessThanOrEqual(box.right + TOLERANCE_PX);
      await expect(rect.left).toBeGreaterThanOrEqual(box.left - TOLERANCE_PX);
    }
    await expect(identity).toHaveTextContent('a-very-long-company-domain.example.com');
    // The preferred 17.5rem width holds; long identities never widen the menu.
    await expect(near(box.width, resolvedPx(shell, '17.5rem'))).toBe(true);
  },
};

export const LongPlan: Story = {
  tags: ['!autodocs'],
  args: {
    defaultOpen: true,
    user: { ...LONG_USER, plan: LONG_PLAN },
  },
  play: async ({ canvasElement }) => {
    await findMenu(canvasElement);
    await wait(SETTLE_MS);
    const shell = shellOf(canvasElement)!;
    const plan = shell.querySelector<HTMLElement>('[data-ui="pill"]')!;
    const text = plan.parentElement!;
    await expectInside(plan, text);
    await expect(shell.scrollWidth).toBeLessThanOrEqual(shell.clientWidth);
    await expect(plan).toHaveTextContent(LONG_PLAN);
    await expectMirroredDirection(shell, '[data-ui="pill"]');
  },
};

export const LongPlanSheet: Story = {
  ...LongPlan,
  args: { ...LongPlan.args, variant: 'sheet' },
};

export const AccountCommands: Story = {
  tags: ['!autodocs'],
  args: { defaultOpen: true },
  render: (args) => (
    <UserMenu user={args.user} defaultOpen={args.defaultOpen} onOpenChange={args.onOpenChange}>
      <UserMenu.Trigger aria-label={TRIGGER_LABEL} />
      <UserMenu.Content variant="menu">
        <UserMenu.Identity />
        <UserMenu.Item icon={<ProfileIcon />} keys={['Ctrl', 'P']} onSelect={args.onProfile}>
          Profile
        </UserMenu.Item>
        <UserMenu.Item keys={['Ctrl', ',']} onSelect={args.onSettings}>
          Settings
        </UserMenu.Item>
        <UserMenu.Item disabled>Billing</UserMenu.Item>
        <UserMenu.Separator />
        <UserMenu.Item tone="danger">Delete account</UserMenu.Item>
      </UserMenu.Content>
    </UserMenu>
  ),
  play: async ({ canvasElement }) => {
    const menu = await findMenu(canvasElement);
    const profile = within(menu).getByRole('menuitem', { name: 'Profile' });
    // Shortcut hints are decoration: hidden from AT, no aria-keyshortcuts set for the caller.
    const keys = profile.querySelector('[data-ui="kbd-group"]')!;
    await expect(keys).toHaveAttribute('aria-hidden', 'true');
    await expect(keys.querySelectorAll('kbd')).toHaveLength(2);
    await expect(profile).not.toHaveAttribute('aria-keyshortcuts');
    await expect(profile.querySelector('[data-ui="user-menu-item-icon"]')).toHaveAttribute('aria-hidden', 'true');
    await expect(within(menu).getByRole('menuitem', { name: 'Billing' })).toHaveAttribute('aria-disabled', 'true');
    const separator = within(menu).getByRole('separator');
    await expect(separator).toHaveAttribute('data-ui', 'user-menu-separator');
    await expect(separator).not.toHaveAttribute('tabindex');
    for (const item of within(menu).getAllByRole('menuitem')) {
      await expect(item.getBoundingClientRect().height).toBeGreaterThanOrEqual(32 - TOLERANCE_PX);
    }
  },
};

export const ThemeGroup: Story = {
  name: 'Theme choices',
  parameters: {
    docs: {
      description: { story: 'Move between appearance choices with Left/Right, then select with Enter or Space.' },
      source: {
        language: 'tsx',
        code: `import { Button, styled, UserMenu } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const Row = styled.div({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: vars.space[3],
});

function ProfileIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <circle cx="8" cy="5.5" r="2.5" />
      <path d="M3 13.5c.8-2.4 2.7-3.5 5-3.5s4.2 1.1 5 3.5" />
    </svg>
  );
}

<Row>
  <UserMenu user={{ name: 'Ada Lovelace', email: 'ada@example.com', plan: 'Pro' }}>
    <UserMenu.Trigger aria-label="Account menu, Ada Lovelace" />
    <UserMenu.Content variant="menu" closeLabel="Close account menu">
      <UserMenu.Identity />
      <UserMenu.Item icon={<ProfileIcon />} onSelect={() => {}}>
        Profile
      </UserMenu.Item>
      <UserMenu.Item keys={['Ctrl', ',']} onSelect={() => {}}>
        Settings
      </UserMenu.Item>
      <UserMenu.Item disabled>Billing</UserMenu.Item>
      <UserMenu.Separator />
      <UserMenu.ThemeGroup
        labels={{ group: 'Appearance', light: 'Light', dark: 'Dark', system: 'System' }}
        onValueChange={(theme) => {}}
      />
      <UserMenu.StatusGroup
        labels={{ group: 'Status', available: 'Available', busy: 'Busy', away: 'Away' }}
        onValueChange={(status) => {}}
      />
      <UserMenu.Separator />
      <UserMenu.SignOut
        pendingLabel="Signing out"
        errorMessage="Sign out failed. Try again."
        onSignOut={async () => {
          const res = await fetch('/api/auth/sign-out', { method: 'POST' });
          if (!res.ok) throw new Error('Sign out failed');
        }}
      >
        Sign out
      </UserMenu.SignOut>
    </UserMenu.Content>
  </UserMenu>
  <Button>After</Button>
</Row>`,
      },
    },
  },
  play: async ({ args, canvasElement, userEvent }) => {
    await userEvent.tab();
    await userEvent.keyboard('{Enter}');
    const menu = await findMenu(canvasElement);
    const group = within(menu).getByRole('group', { name: 'Appearance' });
    await expect(group).toHaveAttribute('data-ui', 'user-menu-theme-group');
    const option = (name: string) => within(group).getByRole('menuitemradio', { name });
    // System is the uncontrolled default; exactly one option is checked.
    await expect(option('System')).toHaveAttribute('aria-checked', 'true');
    await expect(within(group).getAllByRole('menuitemradio', { checked: true })).toHaveLength(1);

    await expectFocused(canvasElement, 'Profile');
    await userEvent.keyboard('{ArrowDown}{ArrowDown}');
    await expectFocused(canvasElement, 'Light', 'menuitemradio');
    await expectFocusRing(option('Light'));
    // Left/Right only move focus inside the group, wrapping; nothing is selected.
    await userEvent.keyboard('{ArrowRight}');
    await expectFocused(canvasElement, 'Dark', 'menuitemradio');
    await userEvent.keyboard('{ArrowRight}{ArrowRight}');
    await expectFocused(canvasElement, 'Light', 'menuitemradio');
    await userEvent.keyboard('{ArrowLeft}');
    await expectFocused(canvasElement, 'System', 'menuitemradio');
    await userEvent.keyboard('{ArrowLeft}');
    await expectFocused(canvasElement, 'Dark', 'menuitemradio');
    await expect(args.onThemeChange).not.toHaveBeenCalled();
    await expect(option('System')).toHaveAttribute('aria-checked', 'true');

    // Enter requests the value once and keeps the menu open with focus in place.
    await userEvent.keyboard('{Enter}');
    await expect(callValues(args.onThemeChange)).toEqual(['dark']);
    await expect(option('Dark')).toHaveAttribute('aria-checked', 'true');
    await expect(option('System')).toHaveAttribute('aria-checked', 'false');
    await expectFocused(canvasElement, 'Dark', 'menuitemradio');
    await expect(shellOf(canvasElement)).not.toBeNull();
    // The unchanged value does not notify again.
    await userEvent.keyboard(' ');
    await userEvent.click(option('Dark'));
    await expect(callValues(args.onThemeChange)).toEqual(['dark']);
    // Space picks another value once; a pointer pick too.
    await userEvent.keyboard('{ArrowLeft} ');
    await userEvent.click(option('System'));
    await expect(callValues(args.onThemeChange)).toEqual(['dark', 'light', 'system']);
    await expect(callValues(args.onOpenChange)).toEqual([true]);
    // Checked is shown by a border and weight as well as the fill.
    const checked = getComputedStyle(option('System'));
    const unchecked = getComputedStyle(option('Light'));
    await expect(checked.borderTopColor).not.toBe(unchecked.borderTopColor);
    await expect(checked.fontWeight).not.toBe(unchecked.fontWeight);
  },
};

export const StatusGroup: Story = {
  tags: ['!autodocs'],
  args: { defaultOpen: true },
  play: async ({ args, canvasElement, userEvent }) => {
    const menu = await findMenu(canvasElement);
    const group = within(menu).getByRole('group', { name: 'Status' });
    await expect(group).toHaveAttribute('data-ui', 'user-menu-status-group');
    await expect(within(group).getByRole('menuitemradio', { name: 'Available' })).toHaveAttribute('aria-checked', 'true');
    await expectFocused(canvasElement, 'Profile');
    await userEvent.keyboard('b');
    await expectFocused(canvasElement, 'Busy', 'menuitemradio');
    await userEvent.keyboard('{Enter}');
    await expect(callValues(args.onStatusChange)).toEqual(['busy']);
    await expect(within(group).getByRole('menuitemradio', { name: 'Busy' })).toHaveAttribute('aria-checked', 'true');
    // Presence is only reported: the theme axis is independent.
    await expect(args.onThemeChange).not.toHaveBeenCalled();
    for (const option of within(group).getAllByRole('menuitemradio')) {
      await expect(option.getBoundingClientRect().height).toBeGreaterThanOrEqual(32 - TOLERANCE_PX);
    }
  },
};

const externalThemeChange = fn();
const externalStatusChange = fn();

/** Owns all three axes; it never accepts a request, and its buttons change values externally. */
function RejectingMenu(args: StoryArgs) {
  const [open, setOpen] = useState(true);
  const [theme, setTheme] = useState<UserMenuTheme>('light');
  const [status, setStatus] = useState<UserMenuStatus>('away');
  return (
    <Row>
      <UserMenu user={args.user} open={open} onOpenChange={args.onOpenChange}>
        <UserMenu.Trigger aria-label={TRIGGER_LABEL} status="away" statusLabel="Away" />
        <UserMenu.Content variant="menu">
          <UserMenu.Identity />
          <UserMenu.ThemeGroup labels={THEME_LABELS} value={theme} onValueChange={externalThemeChange} />
          <UserMenu.StatusGroup labels={STATUS_LABELS} value={status} onValueChange={externalStatusChange} />
        </UserMenu.Content>
      </UserMenu>
      <Button onClick={() => setOpen((current) => !current)}>Toggle menu</Button>
      <Button onClick={() => setTheme('dark')}>Use dark</Button>
      <Button onClick={() => setStatus('busy')}>Set busy</Button>
    </Row>
  );
}
RejectingMenu.displayName = 'RejectingMenu';

export const ControlledAxesReject: Story = {
  tags: ['!autodocs'],
  render: (args) => <RejectingMenu {...args} />,
  play: async ({ args, canvasElement, userEvent }) => {
    externalThemeChange.mockClear();
    externalStatusChange.mockClear();
    const canvas = within(canvasElement);
    const trigger = getTrigger(canvasElement);
    const menu = await findMenu(canvasElement);
    const option = (name: string) => within(menu).getByRole('menuitemradio', { name });
    await expectFocused(canvasElement, 'Light', 'menuitemradio');

    // Rejected theme and status requests notify once and keep the committed values.
    await userEvent.keyboard('{ArrowRight}{Enter}');
    await expect(callValues(externalThemeChange)).toEqual(['dark']);
    await expect(option('Light')).toHaveAttribute('aria-checked', 'true');
    await expect(option('Dark')).toHaveAttribute('aria-checked', 'false');
    await expectFocused(canvasElement, 'Dark', 'menuitemradio');
    await userEvent.keyboard('{End}{ArrowUp}{Enter}');
    await expect(callValues(externalStatusChange)).toEqual(['busy']);
    await expect(option('Away')).toHaveAttribute('aria-checked', 'true');

    // External updates commit without any callback.
    fireEvent.click(canvas.getByRole('button', { name: 'Use dark' }));
    fireEvent.click(canvas.getByRole('button', { name: 'Set busy' }));
    await waitFor(() => expect(option('Dark')).toHaveAttribute('aria-checked', 'true'));
    await expect(option('Busy')).toHaveAttribute('aria-checked', 'true');
    await expect(externalThemeChange).toHaveBeenCalledTimes(1);
    await expect(externalStatusChange).toHaveBeenCalledTimes(1);

    // An external close never focuses the Trigger and does not notify.
    const triggerFocus = fn();
    trigger.addEventListener('focus', triggerFocus);
    fireEvent.click(canvas.getByRole('button', { name: 'Toggle menu' }));
    await expectClosed(canvasElement);
    await wait(SETTLE_MS);
    trigger.removeEventListener('focus', triggerFocus);
    await expect(triggerFocus).not.toHaveBeenCalled();
    await expect(args.onOpenChange).not.toHaveBeenCalled();

    // Reopened externally with the committed values; a rejected Escape keeps it open with focus inside.
    fireEvent.click(canvas.getByRole('button', { name: 'Toggle menu' }));
    const reopened = await findMenu(canvasElement);
    await expect(within(reopened).getByRole('menuitemradio', { name: 'Dark' })).toHaveAttribute('aria-checked', 'true');
    await expectFocused(canvasElement, 'Light', 'menuitemradio');
    await userEvent.keyboard('{Escape}');
    await expect(callValues(args.onOpenChange)).toEqual([false]);
    await expect(shellOf(canvasElement)).not.toBeNull();
    await expectFocused(canvasElement, 'Light', 'menuitemradio');
    // The Trigger's status is described for AT.
    await expect(trigger).toHaveAccessibleDescription('Away');
  },
};

export const ControlledAccept: Story = {
  name: 'Controlled opening',
  parameters: { docs: {
    description: { story: 'Accept account-menu opening and dismissal in application state.' },
    source: { language: 'tsx', code: `import { useState } from 'react';
import { Button, UserMenu, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const Row = styled.div({ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: vars.space[3] });
function ProfileIcon() {
  return <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <circle cx="8" cy="5.5" r="2.5" />
    <path d="M3 13.5c.8-2.4 2.7-3.5 5-3.5s4.2 1.1 5 3.5" />
  </svg>;
}

function AccountActions() {
  const [open, setOpen] = useState(false);
  return (
    <Row>
      <UserMenu user={{ name: 'Ada Lovelace', email: 'ada@example.com', plan: 'Pro' }} open={open} onOpenChange={setOpen}>
        <UserMenu.Trigger aria-label="Account menu, Ada Lovelace" />
        <UserMenu.Content variant="menu" closeLabel="Close account menu">
          <UserMenu.Identity />
          <UserMenu.Item icon={<ProfileIcon />} onSelect={openProfile}>Profile</UserMenu.Item>
          <UserMenu.Item keys={['Ctrl', ',']} onSelect={openSettings}>Settings</UserMenu.Item>
          <UserMenu.Item disabled>Billing</UserMenu.Item>
          <UserMenu.Separator />
          <UserMenu.ThemeGroup labels={{ group: 'Appearance', light: 'Light', dark: 'Dark', system: 'System' }} onValueChange={setTheme} />
          <UserMenu.StatusGroup labels={{ group: 'Status', available: 'Available', busy: 'Busy', away: 'Away' }} onValueChange={setStatus} />
          <UserMenu.Separator />
          <UserMenu.SignOut onSignOut={signOut} onSignOutError={reportError} pendingLabel="Signing out" errorMessage="Sign out failed. Try again.">Sign out</UserMenu.SignOut>
        </UserMenu.Content>
      </UserMenu>
      <Button>After</Button>
    </Row>
  );
}` },
  } },
  render: function Render(args) {
    const [open, setOpen] = useState(false);
    return (
      <AccountMenu
        {...args}
        open={open}
        onOpenChange={(next) => {
          args.onOpenChange?.(next);
          setOpen(next);
        }}
      />
    );
  },
  play: async ({ args, canvasElement, userEvent }) => {
    const trigger = getTrigger(canvasElement);
    await userEvent.click(trigger);
    await expectFocused(canvasElement, 'Profile');
    await userEvent.keyboard('{Escape}');
    await expectClosed(canvasElement);
    await expectActive(canvasElement, trigger);
    await expect(callValues(args.onOpenChange)).toEqual([true, false]);
  },
};

export const RejectedOpen: Story = {
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { Button, styled, UserMenu } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const Row = styled.div({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: vars.space[3],
});

function ProfileIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <circle cx="8" cy="5.5" r="2.5" />
      <path d="M3 13.5c.8-2.4 2.7-3.5 5-3.5s4.2 1.1 5 3.5" />
    </svg>
  );
}

<Row>
  <UserMenu
    open={false}
    onOpenChange={() => {}}
    user={{ name: 'Ada Lovelace', email: 'ada@example.com', plan: 'Pro' }}
  >
    <UserMenu.Trigger aria-label="Account menu, Ada Lovelace" />
    <UserMenu.Content variant="menu" closeLabel="Close account menu">
      <UserMenu.Identity />
      <UserMenu.Item icon={<ProfileIcon />} onSelect={() => {}}>
        Profile
      </UserMenu.Item>
      <UserMenu.Item keys={['Ctrl', ',']} onSelect={() => {}}>
        Settings
      </UserMenu.Item>
      <UserMenu.Item disabled>Billing</UserMenu.Item>
      <UserMenu.Separator />
      <UserMenu.ThemeGroup
        labels={{ group: 'Appearance', light: 'Light', dark: 'Dark', system: 'System' }}
        onValueChange={(theme) => {}}
      />
      <UserMenu.StatusGroup
        labels={{ group: 'Status', available: 'Available', busy: 'Busy', away: 'Away' }}
        onValueChange={(status) => {}}
      />
      <UserMenu.Separator />
      <UserMenu.SignOut
        pendingLabel="Signing out"
        errorMessage="Sign out failed. Try again."
        onSignOut={async () => {
          const res = await fetch('/api/auth/sign-out', { method: 'POST' });
          if (!res.ok) throw new Error('Sign out failed');
        }}
      >
        Sign out
      </UserMenu.SignOut>
    </UserMenu.Content>
  </UserMenu>
  <Button>After</Button>
</Row>`,
      },
    },
  },
  args: { open: false },
  play: async ({ args, canvasElement, userEvent }) => {
    const trigger = getTrigger(canvasElement);
    await userEvent.tab();
    await userEvent.keyboard('{Enter}');
    await expect(callValues(args.onOpenChange)).toEqual([true]);
    await expect(shellOf(canvasElement)).toBeNull();
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expectActive(canvasElement, trigger);
  },
};

export const SignOutSuccess: Story = {
  name: 'Sign out success',
  parameters: {
    docs: {
      description: { story: 'Choose Sign out and let the action finish to close the account menu.' },
      source: {
        language: 'tsx',
        code: `import { Button, styled, UserMenu } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const Row = styled.div({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: vars.space[3],
});

function ProfileIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <circle cx="8" cy="5.5" r="2.5" />
      <path d="M3 13.5c.8-2.4 2.7-3.5 5-3.5s4.2 1.1 5 3.5" />
    </svg>
  );
}

<Row>
  <UserMenu user={{ name: 'Ada Lovelace', email: 'ada@example.com', plan: 'Pro' }}>
    <UserMenu.Trigger aria-label="Account menu, Ada Lovelace" />
    <UserMenu.Content variant="menu" closeLabel="Close account menu">
      <UserMenu.Identity />
      <UserMenu.Item icon={<ProfileIcon />} onSelect={() => {}}>
        Profile
      </UserMenu.Item>
      <UserMenu.Item keys={['Ctrl', ',']} onSelect={() => {}}>
        Settings
      </UserMenu.Item>
      <UserMenu.Item disabled>Billing</UserMenu.Item>
      <UserMenu.Separator />
      <UserMenu.ThemeGroup
        labels={{ group: 'Appearance', light: 'Light', dark: 'Dark', system: 'System' }}
        onValueChange={(theme) => {}}
      />
      <UserMenu.StatusGroup
        labels={{ group: 'Status', available: 'Available', busy: 'Busy', away: 'Away' }}
        onValueChange={(status) => {}}
      />
      <UserMenu.Separator />
      <UserMenu.SignOut
        pendingLabel="Signing out"
        errorMessage="Sign out failed. Try again."
        onSignOut={async () => {
          const res = await fetch('/api/auth/sign-out', { method: 'POST' });
          if (!res.ok) throw new Error('Sign out failed');
        }}
      >
        Sign out
      </UserMenu.SignOut>
    </UserMenu.Content>
  </UserMenu>
  <Button>After</Button>
</Row>`,
      },
    },
  },
  play: async ({ args, canvasElement, userEvent }) => {
    const pending = deferred();
    (args.onSignOut as Mock).mockImplementation(() => pending.promise);
    const trigger = getTrigger(canvasElement);
    await userEvent.tab();
    await userEvent.keyboard('{ArrowUp}');
    await expectFocused(canvasElement, 'Sign out');
    await userEvent.keyboard('{Enter}');
    await expect(args.onSignOut).toHaveBeenCalledTimes(1);

    // Pending: busy, still focusable, the pending label is read; repeats do nothing.
    const busy = await bodyOf(canvasElement).findByRole('menuitem', { name: PENDING_LABEL });
    await expect(busy).toHaveAttribute('aria-busy', 'true');
    await expect(busy).toHaveAttribute('aria-disabled', 'true');
    await expectActive(canvasElement, busy);
    await expect(busy.querySelector('[data-ui="spinner"]')).toHaveAttribute('aria-hidden', 'true');
    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard(' ');
    await userEvent.click(busy);
    await expect(args.onSignOut).toHaveBeenCalledTimes(1);
    await expect(callValues(args.onOpenChange)).toEqual([true]);

    // Fulfillment closes and returns focus to the Trigger.
    pending.resolve();
    await expectClosed(canvasElement);
    await expectActive(canvasElement, trigger);
    await expect(callValues(args.onOpenChange)).toEqual([true, false]);
    await expect(args.onSignOutError).not.toHaveBeenCalled();
  },
};

export const SignOutErrorRetry: Story = {
  name: 'Sign out error and retry',
  parameters: {
    docs: {
      description: { story: 'A failed sign out announces an error and leaves the action available for retry.' },
      source: {
        language: 'tsx',
        code: `import { Button, styled, UserMenu } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const Row = styled.div({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: vars.space[3],
});

function ProfileIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <circle cx="8" cy="5.5" r="2.5" />
      <path d="M3 13.5c.8-2.4 2.7-3.5 5-3.5s4.2 1.1 5 3.5" />
    </svg>
  );
}

<Row>
  <UserMenu user={{ name: 'Ada Lovelace', email: 'ada@example.com', plan: 'Pro' }}>
    <UserMenu.Trigger aria-label="Account menu, Ada Lovelace" />
    <UserMenu.Content variant="menu" closeLabel="Close account menu">
      <UserMenu.Identity />
      <UserMenu.Item icon={<ProfileIcon />} onSelect={() => {}}>
        Profile
      </UserMenu.Item>
      <UserMenu.Item keys={['Ctrl', ',']} onSelect={() => {}}>
        Settings
      </UserMenu.Item>
      <UserMenu.Item disabled>Billing</UserMenu.Item>
      <UserMenu.Separator />
      <UserMenu.ThemeGroup
        labels={{ group: 'Appearance', light: 'Light', dark: 'Dark', system: 'System' }}
        onValueChange={(theme) => {}}
      />
      <UserMenu.StatusGroup
        labels={{ group: 'Status', available: 'Available', busy: 'Busy', away: 'Away' }}
        onValueChange={(status) => {}}
      />
      <UserMenu.Separator />
      <UserMenu.SignOut
        pendingLabel="Signing out"
        errorMessage="Sign out failed. Try again."
        onSignOut={async () => {
          const res = await fetch('/api/auth/sign-out', { method: 'POST' });
          if (!res.ok) throw new Error('Sign out failed');
        }}
        onSignOutError={(error) => {
          console.error('Sign out error:', error);
        }}
      >
        Sign out
      </UserMenu.SignOut>
    </UserMenu.Content>
  </UserMenu>
  <Button>After</Button>
</Row>`,
      },
    },
  },
  play: async ({ args, canvasElement, userEvent }) => {
    const failed = deferred();
    const retried = deferred();
    const failure = new Error('network down');
    (args.onSignOut as Mock).mockImplementationOnce(() => failed.promise).mockImplementationOnce(() => retried.promise);
    const trigger = getTrigger(canvasElement);
    await userEvent.click(trigger);
    await findMenu(canvasElement);
    await expectFocused(canvasElement, 'Profile');
    await userEvent.keyboard('{End}{Enter}');
    await bodyOf(canvasElement).findByRole('menuitem', { name: PENDING_LABEL });

    // Rejection keeps the menu open and announces the message outside the menu.
    failed.reject(failure);
    const alert = await bodyOf(canvasElement).findByRole('alert');
    await waitFor(() => expect(alert).toHaveTextContent(ERROR_MESSAGE));
    await expect(alert.closest('[role="menu"]')).toBeNull();
    await expect(alert).not.toHaveTextContent('network down');
    await expect(callValues(args.onSignOutError)).toEqual([failure]);
    const signOut = bodyOf(canvasElement).getByRole('menuitem', { name: 'Sign out' });
    await expect(signOut).not.toHaveAttribute('aria-busy');
    await expectActive(canvasElement, signOut);

    // Retry clears the message, then a fulfillment closes.
    await userEvent.keyboard('{Enter}');
    await expect(args.onSignOut).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(alert).toBeEmptyDOMElement());
    retried.resolve();
    await expectClosed(canvasElement);
    await expectActive(canvasElement, trigger);
    await expect(callValues(args.onOpenChange)).toEqual([true, false]);
    await expect(args.onSignOutError).toHaveBeenCalledTimes(1);
  },
};

export const SignOutSyncOutcomes: Story = {
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { Button, styled, UserMenu } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const Row = styled.div({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: vars.space[3],
});

function ProfileIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <circle cx="8" cy="5.5" r="2.5" />
      <path d="M3 13.5c.8-2.4 2.7-3.5 5-3.5s4.2 1.1 5 3.5" />
    </svg>
  );
}

let attempt = 0;

<Row>
  <UserMenu user={{ name: 'Ada Lovelace', email: 'ada@example.com', plan: 'Pro' }}>
    <UserMenu.Trigger aria-label="Account menu, Ada Lovelace" />
    <UserMenu.Content variant="menu" closeLabel="Close account menu">
      <UserMenu.Identity />
      <UserMenu.Item icon={<ProfileIcon />} onSelect={() => {}}>
        Profile
      </UserMenu.Item>
      <UserMenu.Item keys={['Ctrl', ',']} onSelect={() => {}}>
        Settings
      </UserMenu.Item>
      <UserMenu.Item disabled>Billing</UserMenu.Item>
      <UserMenu.Separator />
      <UserMenu.ThemeGroup
        labels={{ group: 'Appearance', light: 'Light', dark: 'Dark', system: 'System' }}
        onValueChange={(theme) => {}}
      />
      <UserMenu.StatusGroup
        labels={{ group: 'Status', available: 'Available', busy: 'Busy', away: 'Away' }}
        onValueChange={(status) => {}}
      />
      <UserMenu.Separator />
      <UserMenu.SignOut
        pendingLabel="Signing out"
        errorMessage="Sign out failed. Try again."
        onSignOut={() => {
          if (attempt === 0) {
            attempt += 1;
            throw new Error('Sync sign out failed');
          }
          sessionStorage.clear();
        }}
        onSignOutError={(error) => {
          console.error('Sign out error:', error);
        }}
      >
        Sign out
      </UserMenu.SignOut>
    </UserMenu.Content>
  </UserMenu>
  <Button>After</Button>
</Row>`,
      },
    },
  },
  play: async ({ args, canvasElement, userEvent }) => {
    const failure = new Error('blocked');
    (args.onSignOut as Mock).mockImplementationOnce(() => {
      throw failure;
    });
    const trigger = getTrigger(canvasElement);
    await userEvent.click(trigger);
    await findMenu(canvasElement);
    await expectFocused(canvasElement, 'Profile');
    await userEvent.keyboard('{End}{Enter}');
    // A synchronous throw is handled like a rejection.
    await waitFor(() => expect(bodyOf(canvasElement).getByRole('alert')).toHaveTextContent(ERROR_MESSAGE));
    await expect(callValues(args.onSignOutError)).toEqual([failure]);
    await expectFocused(canvasElement, 'Sign out');
    // A synchronous success closes at once.
    await userEvent.keyboard('{Enter}');
    await expectClosed(canvasElement);
    await expectActive(canvasElement, trigger);
    await expect(args.onSignOut).toHaveBeenCalledTimes(2);
    await expect(callValues(args.onOpenChange)).toEqual([true, false]);
  },
};

export const SignOutPendingAcrossReopen: Story = {
  name: 'Pending sign out across reopen',
  parameters: {
    docs: {
      description: { story: 'Reopen during sign out: the action stays busy and its completion does not dismiss the new surface.' },
      source: {
        language: 'tsx',
        code: `import { Button, styled, UserMenu } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const Row = styled.div({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: vars.space[3],
});

function ProfileIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <circle cx="8" cy="5.5" r="2.5" />
      <path d="M3 13.5c.8-2.4 2.7-3.5 5-3.5s4.2 1.1 5 3.5" />
    </svg>
  );
}

<Row>
  <UserMenu user={{ name: 'Ada Lovelace', email: 'ada@example.com', plan: 'Pro' }}>
    <UserMenu.Trigger aria-label="Account menu, Ada Lovelace" />
    <UserMenu.Content variant="menu" closeLabel="Close account menu">
      <UserMenu.Identity />
      <UserMenu.Item icon={<ProfileIcon />} onSelect={() => {}}>
        Profile
      </UserMenu.Item>
      <UserMenu.Item keys={['Ctrl', ',']} onSelect={() => {}}>
        Settings
      </UserMenu.Item>
      <UserMenu.Item disabled>Billing</UserMenu.Item>
      <UserMenu.Separator />
      <UserMenu.ThemeGroup
        labels={{ group: 'Appearance', light: 'Light', dark: 'Dark', system: 'System' }}
        onValueChange={(theme) => {}}
      />
      <UserMenu.StatusGroup
        labels={{ group: 'Status', available: 'Available', busy: 'Busy', away: 'Away' }}
        onValueChange={(status) => {}}
      />
      <UserMenu.Separator />
      <UserMenu.SignOut
        pendingLabel="Signing out"
        errorMessage="Sign out failed. Try again."
        onSignOut={async () => {
          const res = await fetch('/api/auth/sign-out', { method: 'POST' });
          if (!res.ok) throw new Error('Sign out failed');
        }}
      >
        Sign out
      </UserMenu.SignOut>
    </UserMenu.Content>
  </UserMenu>
  <Button>After</Button>
</Row>`,
      },
    },
  },
  play: async ({ args, canvasElement, userEvent }) => {
    const pending = deferred();
    (args.onSignOut as Mock).mockImplementation(() => pending.promise);
    const trigger = getTrigger(canvasElement);
    await userEvent.click(trigger);
    await findMenu(canvasElement);
    await expectFocused(canvasElement, 'Profile');
    await userEvent.keyboard('{End}{Enter}');
    await bodyOf(canvasElement).findByRole('menuitem', { name: PENDING_LABEL });

    // Dismissed while pending, then reopened: still busy, still guarded.
    await userEvent.keyboard('{Escape}');
    await expectClosed(canvasElement);
    await userEvent.keyboard('{ArrowUp}');
    const busy = await bodyOf(canvasElement).findByRole('menuitem', { name: PENDING_LABEL });
    await expectActive(canvasElement, busy);
    await userEvent.keyboard('{Enter}');
    await expect(args.onSignOut).toHaveBeenCalledTimes(1);

    // Settling never closes the newer surface it did not start.
    pending.resolve();
    await bodyOf(canvasElement).findByRole('menuitem', { name: 'Sign out' });
    await wait(SETTLE_MS);
    await expect(shellOf(canvasElement)).not.toBeNull();
    await expect(callValues(args.onOpenChange)).toEqual([true, false, true]);
  },
};

function RemovableMenu(args: StoryArgs) {
  const [mounted, setMounted] = useState(true);
  return (
    <Row>
      {mounted && <AccountMenu {...args} />}
      <Button onClick={() => setMounted(false)}>Remove menu</Button>
    </Row>
  );
}
RemovableMenu.displayName = 'RemovableMenu';

export const SignOutSettlesAfterUnmount: Story = {
  render: (args) => <RemovableMenu {...args} />,
  play: async ({ args, canvasElement, userEvent }) => {
    const pending = deferred();
    (args.onSignOut as Mock).mockImplementation(() => pending.promise);
    const errors = spyOn(console, 'error');
    try {
      await userEvent.click(getTrigger(canvasElement));
      await findMenu(canvasElement);
      await expectFocused(canvasElement, 'Profile');
      await userEvent.keyboard('{End}{Enter}');
      await bodyOf(canvasElement).findByRole('menuitem', { name: PENDING_LABEL });
      const remove = within(canvasElement).getByRole('button', { name: 'Remove menu' });
      remove.focus();
      fireEvent.click(remove);
      await waitFor(() => expect(within(canvasElement).queryByRole('button', { name: TRIGGER_LABEL })).toBeNull());
      await expect(shellOf(canvasElement)).toBeNull();
      // Settling after unmount neither updates state nor moves focus.
      pending.resolve();
      await wait(SETTLE_MS);
      await expect(canvasElement.ownerDocument.activeElement).toBe(remove);
      await expect(errors).not.toHaveBeenCalled();
    } finally {
      errors.mockRestore();
    }
  },
};

export const SignOutPendingOpen: Story = {
  tags: ['!autodocs'],
  args: { defaultOpen: true },
  play: async ({ args, canvasElement, userEvent }) => {
    // Persistent busy state for the axe gate.
    (args.onSignOut as Mock).mockImplementation(() => new Promise(() => {}));
    await findMenu(canvasElement);
    await expectFocused(canvasElement, 'Profile');
    await userEvent.keyboard('{End}{Enter}');
    const busy = await bodyOf(canvasElement).findByRole('menuitem', { name: PENDING_LABEL });
    await expect(busy).toHaveAttribute('aria-busy', 'true');
    // Busy, not disabled: the label keeps full opacity.
    await expect(getComputedStyle(busy).opacity).toBe('1');
  },
};

export const SignOutErrorOpen: Story = {
  tags: ['!autodocs'],
  args: { defaultOpen: true },
  play: async ({ args, canvasElement, userEvent }) => {
    // Persistent error state for the axe gate.
    (args.onSignOut as Mock).mockImplementation(() => Promise.reject(new Error('offline')));
    await findMenu(canvasElement);
    await expectFocused(canvasElement, 'Profile');
    await userEvent.keyboard('{End}{Enter}');
    await waitFor(() => expect(bodyOf(canvasElement).getByRole('alert')).toHaveTextContent(ERROR_MESSAGE));
  },
};

export const NoCommands: Story = {
  name: 'Identity without commands',
  parameters: { docs: {
    description: { story: 'Open an identity-only menu; focus lands on the menu and Escape returns to the avatar.' },
    source: { language: 'tsx', code: `import { UserMenu } from '@jfrader/ui';

<UserMenu user={{ name: 'Ada Lovelace', email: 'ada@example.com', plan: 'Pro' }}>
  <UserMenu.Trigger aria-label="Account menu, Ada Lovelace" />
  <UserMenu.Content variant="menu">
    <UserMenu.Identity />
  </UserMenu.Content>
</UserMenu>` },
  } },
  render: (args) => (
    <UserMenu user={args.user} onOpenChange={args.onOpenChange}>
      <UserMenu.Trigger aria-label={TRIGGER_LABEL} />
      <UserMenu.Content variant="menu">
        <UserMenu.Identity />
      </UserMenu.Content>
    </UserMenu>
  ),
  play: async ({ args, canvasElement, userEvent }) => {
    const trigger = getTrigger(canvasElement);
    await userEvent.click(trigger);
    // Nothing to land on: the menu takes focus so Escape still works.
    const menu = await findMenu(canvasElement);
    await expectActive(canvasElement, menu);
    await userEvent.keyboard('{Escape}');
    await expectClosed(canvasElement);
    await expectActive(canvasElement, trigger);
    await expect(callValues(args.onOpenChange)).toEqual([true, false]);
  },
};

export const OpenDesktop: Story = {
  tags: ['!autodocs'],
  args: { defaultOpen: true },
  play: async ({ canvasElement }) => {
    // Persistent desktop state for the axe gate.
    const menu = await findMenu(canvasElement);
    const shell = shellOf(canvasElement)!;
    await expect(shell).toHaveAttribute('data-presentation', 'menu');
    await wait(SETTLE_MS);
    await expect(near(shell.getBoundingClientRect().width, resolvedPx(shell, '17.5rem'))).toBe(true);
    await expectFocused(canvasElement, 'Profile');
    await expect(menu).toBeVisible();
  },
};

export const OpenSheet: Story = {
  // Excluded from the docs page: its open overlay (modal/backdrop) covers the documentation.
  tags: ['!autodocs'],
  args: { defaultOpen: true, variant: 'sheet' },
  play: async ({ canvasElement }) => {
    // Persistent sheet state for the axe gate.
    const sheet = await findSheet(canvasElement);
    const view = canvasElement.ownerDocument.defaultView!;
    await expect(sheet).toHaveAttribute('aria-modal', 'true');
    await expect(sheet).toHaveAttribute('data-presentation', 'sheet');
    await expectFocused(canvasElement, 'Profile');
    await wait(SETTLE_MS);
    // Docked to the bottom edge, full width, at most 88% of the viewport tall.
    const box = sheet.getBoundingClientRect();
    await expect(near(box.bottom, view.innerHeight)).toBe(true);
    await expect(near(box.left, 0)).toBe(true);
    await expect(near(box.right, view.innerWidth)).toBe(true);
    await expect(box.height).toBeLessThanOrEqual(view.innerHeight * 0.88 + TOLERANCE_PX);
    // Touch-sized targets in the sheet.
    for (const target of [
      ...within(sheet).getAllByRole('menuitem'),
      ...within(sheet).getAllByRole('menuitemradio'),
      within(sheet).getByRole('button', { name: CLOSE_LABEL }),
    ]) {
      await expect(target.getBoundingClientRect().height).toBeGreaterThanOrEqual(48 - TOLERANCE_PX);
    }
  },
};

export const Sheet: Story = {
  name: 'Modal sheet',
  parameters: {
    docs: {
      description: { story: 'Open account actions in a bottom sheet with contained focus and a Close button.' },
      source: {
        language: 'tsx',
        code: `import { Button, styled, UserMenu } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const Row = styled.div({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: vars.space[3],
});

function ProfileIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <circle cx="8" cy="5.5" r="2.5" />
      <path d="M3 13.5c.8-2.4 2.7-3.5 5-3.5s4.2 1.1 5 3.5" />
    </svg>
  );
}

<Row>
  <UserMenu user={{ name: 'Ada Lovelace', email: 'ada@example.com', plan: 'Pro' }}>
    <UserMenu.Trigger aria-label="Account menu, Ada Lovelace" />
    <UserMenu.Content variant="sheet" closeLabel="Close account menu">
      <UserMenu.Identity />
      <UserMenu.Item icon={<ProfileIcon />} onSelect={() => {}}>
        Profile
      </UserMenu.Item>
      <UserMenu.Item keys={['Ctrl', ',']} onSelect={() => {}}>
        Settings
      </UserMenu.Item>
      <UserMenu.Item disabled>Billing</UserMenu.Item>
      <UserMenu.Separator />
      <UserMenu.ThemeGroup
        labels={{ group: 'Appearance', light: 'Light', dark: 'Dark', system: 'System' }}
        onValueChange={(theme) => {}}
      />
      <UserMenu.StatusGroup
        labels={{ group: 'Status', available: 'Available', busy: 'Busy', away: 'Away' }}
        onValueChange={(status) => {}}
      />
      <UserMenu.Separator />
      <UserMenu.SignOut
        pendingLabel="Signing out"
        errorMessage="Sign out failed. Try again."
        onSignOut={async () => {
          const res = await fetch('/api/auth/sign-out', { method: 'POST' });
          if (!res.ok) throw new Error('Sign out failed');
        }}
      >
        Sign out
      </UserMenu.SignOut>
    </UserMenu.Content>
  </UserMenu>
  <Button>After</Button>
</Row>`,
      },
    },
  },
  args: { variant: 'sheet' },
  play: async ({ args, canvasElement, userEvent }) => {
    const doc = canvasElement.ownerDocument;
    const trigger = getTrigger(canvasElement);
    const after = getAfter(canvasElement);
    await expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
    await userEvent.click(trigger);
    const sheet = await findSheet(canvasElement);
    const menu = await findMenu(canvasElement);
    const close = within(sheet).getByRole('button', { name: CLOSE_LABEL });

    // A modal dialog named by the Identity, holding a menu named by the Trigger.
    await expect(trigger).toHaveAttribute('aria-controls', sheet.id);
    await expect(sheet.contains(menu)).toBe(true);
    await expect(menu).not.toHaveAttribute('aria-modal');
    await expect(menu.id).not.toBe(sheet.id);
    await expectFocused(canvasElement, 'Profile');
    // The page behind is inert and does not scroll.
    await expect(after.closest('[inert]')).not.toBeNull();
    await expect(doc.documentElement.style.overflow).toBe('hidden');

    // Tab and Shift+Tab stay inside the sheet, Close included.
    await userEvent.tab({ shift: true });
    await expectActive(canvasElement, close);
    await expectFocusRing(close);
    await userEvent.tab();
    await expectFocused(canvasElement, 'Profile');
    await userEvent.keyboard('{End}');
    await userEvent.tab();
    await waitFor(() => expect(sheet.contains(doc.activeElement)).toBe(true));
    await userEvent.tab();
    await waitFor(() => expect(sheet.contains(doc.activeElement)).toBe(true));
    await userEvent.tab({ shift: true });
    await userEvent.tab({ shift: true });
    await waitFor(() => expect(sheet.contains(doc.activeElement)).toBe(true));
    await expect(shellOf(canvasElement)).not.toBeNull();

    // Close returns focus to the Trigger and releases the lock and the inert background.
    await userEvent.click(close);
    await expectClosed(canvasElement);
    await expectActive(canvasElement, trigger);
    await expect(after.closest('[inert]')).toBeNull();
    await expect(doc.documentElement.style.overflow).toBe('');

    // Escape too.
    await userEvent.keyboard('{Enter}');
    await findSheet(canvasElement);
    await userEvent.keyboard('{Escape}');
    await expectClosed(canvasElement);
    await expectActive(canvasElement, trigger);

    // And a press on the scrim.
    await userEvent.keyboard('{Enter}');
    await findSheet(canvasElement);
    await userEvent.click(doc.querySelector('[data-ui="user-menu-scrim"]')!);
    await expectClosed(canvasElement);
    await expectActive(canvasElement, trigger);
    await expect(callValues(args.onOpenChange)).toEqual([true, false, true, false, true, false]);
  },
};

export const SheetRejectedClose: Story = {
  // Excluded from the docs page: its open overlay (modal/backdrop) covers the documentation.
  tags: ['!autodocs'],
  args: { open: true, variant: 'sheet' },
  play: async ({ args, canvasElement, userEvent }) => {
    const doc = canvasElement.ownerDocument;
    const sheet = await findSheet(canvasElement);
    await expectFocused(canvasElement, 'Profile');
    await userEvent.keyboard('{Escape}');
    await userEvent.click(within(sheet).getByRole('button', { name: CLOSE_LABEL }));
    await expect(callValues(args.onOpenChange)).toEqual([false, false]);
    // Still modal: focus, lock and inert background stay.
    await expect(shellOf(canvasElement)).toBe(sheet);
    await waitFor(() => expect(sheet.contains(doc.activeElement)).toBe(true));
    await expect(doc.documentElement.style.overflow).toBe('hidden');
    await expect(getAfter(canvasElement).closest('[inert]')).not.toBeNull();
  },
};

export const SheetHandle: Story = {
  name: 'Drag the sheet handle',
  parameters: {
    docs: {
      description: { story: 'Drag the handle downward and release past 80px to request dismissal, or use Close.' },
      source: {
        language: 'tsx',
        code: `import { Button, styled, UserMenu } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const Row = styled.div({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: vars.space[3],
});

function ProfileIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <circle cx="8" cy="5.5" r="2.5" />
      <path d="M3 13.5c.8-2.4 2.7-3.5 5-3.5s4.2 1.1 5 3.5" />
    </svg>
  );
}

<Row>
  <UserMenu user={{ name: 'Ada Lovelace', email: 'ada@example.com', plan: 'Pro' }}>
    <UserMenu.Trigger aria-label="Account menu, Ada Lovelace" />
    <UserMenu.Content variant="sheet" closeLabel="Close account menu">
      <UserMenu.Identity />
      <UserMenu.Item icon={<ProfileIcon />} onSelect={() => {}}>
        Profile
      </UserMenu.Item>
      <UserMenu.Item keys={['Ctrl', ',']} onSelect={() => {}}>
        Settings
      </UserMenu.Item>
      <UserMenu.Item disabled>Billing</UserMenu.Item>
      <UserMenu.Separator />
      <UserMenu.ThemeGroup
        labels={{ group: 'Appearance', light: 'Light', dark: 'Dark', system: 'System' }}
        onValueChange={(theme) => {}}
      />
      <UserMenu.StatusGroup
        labels={{ group: 'Status', available: 'Available', busy: 'Busy', away: 'Away' }}
        onValueChange={(status) => {}}
      />
      <UserMenu.Separator />
      <UserMenu.SignOut
        pendingLabel="Signing out"
        errorMessage="Sign out failed. Try again."
        onSignOut={async () => {
          const res = await fetch('/api/auth/sign-out', { method: 'POST' });
          if (!res.ok) throw new Error('Sign out failed');
        }}
      >
        Sign out
      </UserMenu.SignOut>
    </UserMenu.Content>
  </UserMenu>
  <Button>After</Button>
</Row>`,
      },
    },
  },
  args: { variant: 'sheet' },
  play: async ({ args, canvasElement, userEvent }) => {
    const view = canvasElement.ownerDocument.defaultView!;
    const trigger = getTrigger(canvasElement);
    const realMatchMedia = view.matchMedia.bind(view);
    const reduced = (matches: boolean) =>
      spyOn(view, 'matchMedia').mockImplementation((query) =>
        query === '(prefers-reduced-motion: reduce)' ? ({ ...realMatchMedia(query), matches } as MediaQueryList) : realMatchMedia(query),
      );
    await userEvent.click(trigger);
    const sheet = await findSheet(canvasElement);
    const handle = sheet.querySelector('[data-ui="user-menu-handle"]')!;
    const menu = await findMenu(canvasElement);
    await expect(handle).toHaveAttribute('aria-hidden', 'true');
    await expect(getComputedStyle(handle).touchAction).toBe('none');
    await expect(getComputedStyle(menu).touchAction).toBe('pan-y');
    const motion = reduced(false);
    try {
      // Short of the threshold, upward, cancelled or lost capture: it snaps home.
      pointer(handle, 'pointerdown', 100);
      pointer(handle, 'pointermove', 100 + DISMISS_DRAG_PX / 2);
      await expect(sheet.style.getPropertyValue('--user-menu-drag')).toBe(`${DISMISS_DRAG_PX / 2}px`);
      pointer(handle, 'pointerup', 100 + DISMISS_DRAG_PX / 2);
      // A rejected drag springs home instead of jumping in one frame.
      await expect(Number.parseFloat(sheet.style.getPropertyValue('--user-menu-drag'))).toBeGreaterThan(0);
      await waitFor(() => expect(sheet.style.getPropertyValue('--user-menu-drag')).toBe(''), {
        timeout: 600,
      });
      pointer(handle, 'pointerdown', 100);
      pointer(handle, 'pointermove', 20);
      await expect(sheet.style.getPropertyValue('--user-menu-drag')).toBe('0px');
      pointer(handle, 'pointerup', 20);
      pointer(handle, 'pointerdown', 100);
      pointer(handle, 'pointermove', 100 + DISMISS_DRAG_PX * 2);
      pointer(handle, 'pointercancel', 100 + DISMISS_DRAG_PX * 2);
      await expect(sheet.style.getPropertyValue('--user-menu-drag')).toBe('');
      pointer(handle, 'pointerup', 100 + DISMISS_DRAG_PX * 2);
      // A pointer on the menu body never drags the sheet.
      pointer(menu, 'pointerdown', 100);
      pointer(menu, 'pointermove', 100 + DISMISS_DRAG_PX * 2);
      pointer(menu, 'pointerup', 100 + DISMISS_DRAG_PX * 2);
      await expect(shellOf(canvasElement)).toBe(sheet);
      await expect(args.onOpenChange).toHaveBeenCalledTimes(1);
      motion.mockRestore();

      // Reduced motion disables the gesture only; Close still works.
      const still = reduced(true);
      pointer(handle, 'pointerdown', 100);
      pointer(handle, 'pointermove', 100 + DISMISS_DRAG_PX * 2);
      pointer(handle, 'pointerup', 100 + DISMISS_DRAG_PX * 2);
      await expect(shellOf(canvasElement)).toBe(sheet);
      await expect(sheet.style.getPropertyValue('--user-menu-drag')).toBe('');
      still.mockRestore();

      // Past the threshold, release dismisses once and returns focus to the Trigger.
      reduced(false);
      pointer(handle, 'pointerdown', 100);
      pointer(handle, 'pointermove', 100 + DISMISS_DRAG_PX + 10);
      pointer(handle, 'pointerup', 100 + DISMISS_DRAG_PX + 10);
      await expectClosed(canvasElement);
      await expectActive(canvasElement, trigger);
      await expect(callValues(args.onOpenChange)).toEqual([true, false]);
    } finally {
      (view.matchMedia as Mock).mockRestore?.();
    }
  },
};

function BreakpointMenu(args: StoryArgs) {
  const [breakpoint, setBreakpoint] = useState(NEVER_COMPACT);
  return (
    <Row>
      <AccountMenu {...args} compactBreakpoint={breakpoint} />
      <Button onClick={() => setBreakpoint((current) => (current === NEVER_COMPACT ? ALWAYS_COMPACT : NEVER_COMPACT))}>
        Toggle compact
      </Button>
    </Row>
  );
}
BreakpointMenu.displayName = 'BreakpointMenu';

export const CompactBreakpointChange: Story = {
  args: { variant: 'adaptive' },
  render: (args) => <BreakpointMenu {...args} />,
  play: async ({ args, canvasElement, userEvent }) => {
    const doc = canvasElement.ownerDocument;
    const trigger = getTrigger(canvasElement);
    const toggle = () => fireEvent.click(within(canvasElement).getByRole('button', { name: 'Toggle compact' }));
    await expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    await userEvent.click(trigger);
    await findMenu(canvasElement);
    await expectFocused(canvasElement, 'Profile');
    await userEvent.keyboard('{ArrowDown}');
    await expectFocused(canvasElement, 'Settings');
    const settings = doc.activeElement;

    // Crossing the breakpoint while open turns the menu into a modal sheet, keeping the focused command.
    toggle();
    const sheet = await findSheet(canvasElement);
    await expect(sheet).toBe(shellOf(canvasElement));
    await expect(doc.activeElement).toBe(settings);
    await expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
    await expect(trigger).toHaveAttribute('aria-controls', sheet.id);
    await waitFor(() => expect(getAfter(canvasElement).closest('[inert]')).not.toBeNull());
    await expect(doc.documentElement.style.overflow).toBe('hidden');

    // And back: no modal lock left behind, no extra open request.
    toggle();
    await waitFor(() => expect(shellOf(canvasElement)).toHaveAttribute('data-presentation', 'menu'));
    await expect(doc.activeElement).toBe(settings);
    await expect(shellOf(canvasElement)).not.toHaveAttribute('role');
    await waitFor(() => expect(getAfter(canvasElement).closest('[inert]')).toBeNull());
    await expect(doc.documentElement.style.overflow).toBe('');
    await expect(callValues(args.onOpenChange)).toEqual([true]);
    await userEvent.keyboard('{Escape}');
    await expectClosed(canvasElement);
    await expectActive(canvasElement, trigger);
  },
};

function ScopedHost({ children }: { children: ReactNode }) {
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  return (
    <ThemeRoot theme="light" portalContainer={host}><LightThemeFrame>
      {children}
      <div ref={setHost} data-overlay-host="" />
    </LightThemeFrame></ThemeRoot>
  );
}
ScopedHost.displayName = 'ScopedHost';

export const ScopePortal: Story = {
  tags: ['!autodocs'],
  args: { defaultOpen: true },
  render: (args) => (
    <ScopedHost>
      <AccountMenu {...args} />
    </ScopedHost>
  ),
  play: async ({ canvasElement }) => {
    await findMenu(canvasElement);
    const shell = shellOf(canvasElement)!;
    // Portaled into the scope's host, keeping its light theme.
    await expect(canvasElement.querySelector('[data-overlay-host]')!.contains(shell)).toBe(true);
    await expectThemedSurface(shell, 'light');
  },
};

export const LightTheme: Story = {
  tags: ['!autodocs'],
  globals: { theme: 'light' },
  args: { defaultOpen: true },
  play: async ({ canvasElement }) => {
    await findMenu(canvasElement);
    await expectThemedSurface(shellOf(canvasElement)!, 'light');
  },
};

export const LightThemeSheet: Story = {
  // Excluded from the docs page: its open overlay (modal/backdrop) covers the documentation.
  tags: ['!autodocs'],
  decorators: [withLightTheme],
  args: { defaultOpen: true, variant: 'sheet' },
  play: async ({ canvasElement }) => {
    const sheet = await findSheet(canvasElement);
    await expectThemedSurface(sheet, 'light');
  },
};

export const ExternalAria: Story = {
  tags: ['!autodocs'],
  args: { defaultOpen: true },
  render: (args) => (
    <Row>
      <span id="account-label">Workspace account</span>
      <span id="account-help">Signed in on this device</span>
      <UserMenu user={args.user} defaultOpen={args.defaultOpen}>
        <UserMenu.Trigger aria-label={TRIGGER_LABEL} aria-describedby="account-help missing-id" status="busy" statusLabel="Busy" />
        <UserMenu.Content variant="menu" aria-labelledby="account-label missing-id" aria-describedby="account-help">
          <UserMenu.Identity />
          <UserMenu.ThemeGroup labels={THEME_LABELS} aria-labelledby="account-label" />
          <UserMenu.StatusGroup labels={STATUS_LABELS} aria-label="Presence" />
        </UserMenu.Content>
      </UserMenu>
    </Row>
  ),
  play: async ({ canvasElement }) => {
    const trigger = getTrigger(canvasElement);
    // Consumer descriptions join the internal status description, unresolved ids kept.
    const describedBy = trigger.getAttribute('aria-describedby')!.split(' ');
    await expect(describedBy.slice(0, 2)).toEqual(['account-help', 'missing-id']);
    await expect(describedBy).toHaveLength(3);
    await expect(trigger).toHaveAccessibleDescription('Signed in on this device Busy');

    // Desktop: consumer naming routes to the menu and joins the Trigger's id.
    const menu = await findMenu(canvasElement, `Workspace account ${TRIGGER_LABEL}`);
    await expect(menu).toHaveAttribute('aria-labelledby', `account-label missing-id ${trigger.id}`);
    await expect(menu).toHaveAttribute('aria-describedby', 'account-help');
    await expect(shellOf(canvasElement)).not.toHaveAttribute('aria-labelledby');
    // Group naming: consumer ids join the visible label; a consumer aria-label replaces it.
    await expect(within(menu).getByRole('group', { name: 'Workspace account Appearance' })).toHaveAttribute(
      'data-ui',
      'user-menu-theme-group',
    );
    const presence = within(menu).getByRole('group', { name: 'Presence' });
    await expect(presence).not.toHaveAttribute('aria-labelledby');
  },
};

export const ExternalAriaSheet: Story = {
  // Excluded from the docs page: its open overlay (modal/backdrop) covers the documentation.
  tags: ['!autodocs'],
  args: { defaultOpen: true },
  render: (args) => (
    <Row>
      <span id="sheet-label">Workspace account</span>
      <UserMenu user={args.user} defaultOpen={args.defaultOpen}>
        <UserMenu.Trigger aria-label={TRIGGER_LABEL} />
        <UserMenu.Content variant="sheet" closeLabel={CLOSE_LABEL} aria-labelledby="sheet-label">
          <UserMenu.Identity />
          <UserMenu.Item>Profile</UserMenu.Item>
        </UserMenu.Content>
      </UserMenu>
      <UserMenu user={{ name: 'Grace Hopper', email: 'grace@example.com' }}>
        <UserMenu.Trigger aria-label="Account menu, Grace Hopper" />
        <UserMenu.Content variant="sheet" closeLabel={CLOSE_LABEL} aria-label="Grace's account">
          <UserMenu.Item>Profile</UserMenu.Item>
        </UserMenu.Content>
      </UserMenu>
    </Row>
  ),
  play: async ({ canvasElement, userEvent }) => {
    // Consumer ids join the Identity name on the dialog; the menu inside keeps the Trigger's name.
    const sheet = await findSheet(canvasElement, `Workspace account ${USER.name}`);
    const menu = await findMenu(canvasElement);
    await expect(sheet.contains(menu)).toBe(true);
    await userEvent.keyboard('{Escape}');
    await expectClosed(canvasElement);

    // Without an Identity, a consumer aria-label names the dialog alone; ids stay unique.
    await userEvent.click(getTrigger(canvasElement, 'Account menu, Grace Hopper'));
    const graceSheet = await findSheet(canvasElement, "Grace's account");
    await expect(graceSheet).not.toHaveAttribute('aria-labelledby');
    const graceMenu = await findMenu(canvasElement, 'Account menu, Grace Hopper');
    await expect(graceSheet.contains(graceMenu)).toBe(true);
    await expect(graceSheet.id).not.toBe(sheet.id);
    await expect(graceMenu.id).not.toBe(menu.id);
  },
};

export const FalsyContent: Story = {
  tags: ['!autodocs'],
  args: { defaultOpen: true },
  render: (args) => (
    <UserMenu user={{ ...USER, plan: '' }} defaultOpen={args.defaultOpen}>
      <UserMenu.Trigger aria-label={TRIGGER_LABEL} />
      <UserMenu.Content variant="menu">
        <UserMenu.Identity />
        <UserMenu.Item icon={false}>No icon false</UserMenu.Item>
        <UserMenu.Item icon={null}>No icon null</UserMenu.Item>
        <UserMenu.Item icon="">No icon empty</UserMenu.Item>
        <UserMenu.Item icon={0}>Zero icon</UserMenu.Item>
        <UserMenu.Item keys={[]}>No keys</UserMenu.Item>
        <UserMenu.Item>{0}</UserMenu.Item>
        <UserMenu.Item aria-label="Unlabelled">{false}</UserMenu.Item>
        {false}
        {null}
      </UserMenu.Content>
    </UserMenu>
  ),
  play: async ({ canvasElement }) => {
    const menu = await findMenu(canvasElement);
    const iconOf = (name: string) =>
      within(menu).getByRole('menuitem', { name }).querySelector('[data-ui="user-menu-item-icon"]');
    await expect(iconOf('No icon false')).toBeNull();
    await expect(iconOf('No icon null')).toBeNull();
    await expect(iconOf('No icon empty')).toBeNull();
    await expect(iconOf('Zero icon')).toHaveTextContent('0');
    await expect(within(menu).getByRole('menuitem', { name: 'No keys' }).querySelector('[data-ui="kbd-group"]')).toBeNull();
    await expect(within(menu).getByRole('menuitem', { name: '0' })).toHaveTextContent('0');
    await expect(within(menu).getByRole('menuitem', { name: 'Unlabelled' }).childElementCount).toBe(0);
    await expect(within(menu).getAllByRole('menuitem')).toHaveLength(7);
    // An empty plan renders no chip.
    await expect(shellOf(canvasElement)!.querySelector('[data-ui="pill"]')).toBeNull();
  },
};

export const RTL: Story = {
  render: (args) => (
    <div dir="rtl" lang="he">
      <AccountMenu {...args} />
    </div>
  ),
  play: async ({ args, canvasElement, userEvent }) => {
    await userEvent.tab();
    await userEvent.keyboard('{Enter}');
    await findMenu(canvasElement);
    // The portaled surface takes the Trigger's direction.
    await expect(shellOf(canvasElement)).toHaveAttribute('dir', 'rtl');
    const shell = shellOf(canvasElement)!;
    await expect(getComputedStyle(shell.parentElement!).direction).toBe('rtl');
    await wait(SETTLE_MS);
    const trigger = getTrigger(canvasElement);
    const viewport = canvasElement.ownerDocument.defaultView!;
    if (trigger.getBoundingClientRect().left + shell.getBoundingClientRect().width < viewport.innerWidth) {
      await expectAligned([shell, trigger], 'left');
    }
    await expectFocused(canvasElement, 'Profile');
    await userEvent.keyboard('{ArrowDown}{ArrowDown}');
    await expectFocused(canvasElement, 'Light', 'menuitemradio');
    // ArrowLeft moves forward in RTL, ArrowRight back; no selection.
    await userEvent.keyboard('{ArrowLeft}');
    await expectFocused(canvasElement, 'Dark', 'menuitemradio');
    await userEvent.keyboard('{ArrowRight}{ArrowRight}');
    await expectFocused(canvasElement, 'System', 'menuitemradio');
    await expect(args.onThemeChange).not.toHaveBeenCalled();
    // The first option sits at the inline start, on the right.
    const light = bodyOf(canvasElement).getByRole('menuitemradio', { name: 'Light' });
    const system = bodyOf(canvasElement).getByRole('menuitemradio', { name: 'System' });
    await expect(light.getBoundingClientRect().left).toBeGreaterThan(system.getBoundingClientRect().left);
  },
};

const triggerRef = fn();
const contentRef = fn();
const identityRef = fn();
const itemRef = fn();
const groupRef = fn();
const signOutRef = fn();
const separatorRef = fn();

export const RefTargets: Story = {
  tags: ['!autodocs'],
  args: { defaultOpen: true },
  render: (args) => (
    <UserMenu user={args.user} defaultOpen={args.defaultOpen}>
      <UserMenu.Trigger ref={triggerRef} aria-label={TRIGGER_LABEL} />
      <UserMenu.Content ref={contentRef} variant="menu">
        <UserMenu.Identity ref={identityRef} />
        <UserMenu.Item ref={itemRef}>Profile</UserMenu.Item>
        <UserMenu.Separator ref={separatorRef} />
        <UserMenu.ThemeGroup ref={groupRef} labels={THEME_LABELS} />
        <UserMenu.SignOut ref={signOutRef} onSignOut={() => {}} pendingLabel={PENDING_LABEL} errorMessage={ERROR_MESSAGE}>
          Sign out
        </UserMenu.SignOut>
      </UserMenu.Content>
    </UserMenu>
  ),
  play: async ({ canvasElement }) => {
    const view = canvasElement.ownerDocument.defaultView!;
    const menu = await findMenu(canvasElement);
    const shell = shellOf(canvasElement)!;
    const trigger = getTrigger(canvasElement);
    await expect(triggerRef).toHaveBeenLastCalledWith(trigger);
    await expect(trigger).toBeInstanceOf(view.HTMLButtonElement);
    await expect(contentRef).toHaveBeenLastCalledWith(shell);
    await expect(identityRef).toHaveBeenLastCalledWith(shell.querySelector('[data-ui="user-menu-identity"]'));
    await expect(itemRef).toHaveBeenLastCalledWith(within(menu).getByRole('menuitem', { name: 'Profile' }));
    await expect(separatorRef).toHaveBeenLastCalledWith(within(menu).getByRole('separator'));
    await expect(groupRef).toHaveBeenLastCalledWith(within(menu).getByRole('group', { name: 'Appearance' }));
    await expect(signOutRef).toHaveBeenLastCalledWith(within(menu).getByRole('menuitem', { name: 'Sign out' }));
    await expect(signOutRef.mock.lastCall?.[0]).toBeInstanceOf(view.HTMLButtonElement);

    await expect(UserMenu.displayName).toBe('UserMenu');
    await expect(
      [
        UserMenu.Trigger,
        UserMenu.Content,
        UserMenu.Identity,
        UserMenu.Item,
        UserMenu.ThemeGroup,
        UserMenu.StatusGroup,
        UserMenu.SignOut,
        UserMenu.Separator,
      ].map((part) => part.displayName),
    ).toEqual([
      'UserMenu.Trigger',
      'UserMenu.Content',
      'UserMenu.Identity',
      'UserMenu.Item',
      'UserMenu.ThemeGroup',
      'UserMenu.StatusGroup',
      'UserMenu.SignOut',
      'UserMenu.Separator',
    ]);
  },
};

// These values exercise the slot styling API.
const slotOverride = css({ outline: `3px dashed ${vars.color.accentText}` });

// This story tests the documented css/slot API and native style merging.
export const SxAndSlots: Story = {
  tags: ['!autodocs'],
  args: { defaultOpen: true },
  render: (args) => (
    <ClassNames>{({ css: register }) => <UserMenu user={args.user} defaultOpen={args.defaultOpen}>
      <UserMenu.Trigger className={`consumer-trigger ${register(consumerCss)}`} sx={consumerSx} aria-label={TRIGGER_LABEL} />
      <UserMenu.Content
        variant="menu"
        className={`consumer-content ${register(consumerCss)}`}
        sx={consumerSx}
        slotProps={{ menu: { className: 'consumer-menu', sx: slotOverride } }}
      >
        <UserMenu.Identity className={`consumer-identity ${register(consumerCss)}`} sx={consumerSx} />
        <UserMenu.Item className={`consumer-item ${register(consumerCss)}`} sx={consumerSx}>
          Profile
        </UserMenu.Item>
        <UserMenu.Separator className={`consumer-separator ${register(consumerCss)}`} sx={consumerSx} />
        <UserMenu.ThemeGroup
          className={`consumer-group ${register(consumerCss)}`}
          sx={consumerSx}
          labels={THEME_LABELS}
          slotProps={{ option: { className: 'consumer-option', sx: slotOverride } }}
        />
        <UserMenu.SignOut
          className={`consumer-sign-out ${register(consumerCss)}`}
          sx={consumerSx}
          onSignOut={() => {}}
          pendingLabel={PENDING_LABEL}
          errorMessage={ERROR_MESSAGE}
        >
          Sign out
        </UserMenu.SignOut>
      </UserMenu.Content>
    </UserMenu>}</ClassNames>
  ),
  play: async ({ canvasElement }) => {
    const menu = await findMenu(canvasElement);
    const shell = shellOf(canvasElement)!;
    const parts: Array<[string, HTMLElement]> = [
      ['consumer-trigger', getTrigger(canvasElement)],
      ['consumer-content', shell],
      ['consumer-identity', shell.querySelector<HTMLElement>('[data-ui="user-menu-identity"]')!],
      ['consumer-item', within(menu).getByRole('menuitem', { name: 'Profile' })],
      ['consumer-separator', within(menu).getByRole('separator')],
      ['consumer-group', within(menu).getByRole('group', { name: 'Appearance' })],
      ['consumer-sign-out', within(menu).getByRole('menuitem', { name: 'Sign out' })],
    ];
    for (const [className, element] of parts) {
      await expect(element).toHaveClass(className);
      // Registered classes (including stray Emotion css) land before sx.
      const margin = parseFloat(getComputedStyle(element).marginInlineStart);
      await expect(near(margin, resolvedPx(element, vars.space[2]))).toBe(true);
      await expect(getComputedStyle(element).letterSpacing).not.toBe('normal');
    }
    // Slot overrides reach the inner menu and every option.
    await expect(menu).toHaveClass('consumer-menu');
    await expect(getComputedStyle(menu).outlineStyle).toBe('dashed');
    for (const option of within(menu).getAllByRole('menuitemradio')) {
      await expect(option).toHaveClass('consumer-option');
      await expect(getComputedStyle(option).outlineStyle).toBe('dashed');
    }
    await wait(SETTLE_MS);
    for (const item of within(menu).getAllByRole('menuitem')) {
      await expectInside(item, menu);
    }
  },
};

class UsageErrorBoundary extends Component<{ children: ReactNode }, { message: string | null }> {
  state = { message: null as string | null };
  static getDerivedStateFromError(error: Error) {
    return { message: error.message };
  }
  render() {
    return this.state.message === null ? this.props.children : <p data-usage-error="">{this.state.message}</p>;
  }
}

export const UsageErrors: Story = {
  tags: ['!autodocs'],
  render: () => (
    <Row>
      <UsageErrorBoundary>
        <UserMenu.Trigger aria-label={TRIGGER_LABEL} />
      </UsageErrorBoundary>
      <UsageErrorBoundary>
        <UserMenu user={USER}>
          <UserMenu.Identity />
        </UserMenu>
      </UsageErrorBoundary>
      <UsageErrorBoundary>
        <UserMenu user={USER} defaultOpen>
          <UserMenu.ThemeGroup labels={THEME_LABELS} />
        </UserMenu>
      </UsageErrorBoundary>
    </Row>
  ),
  play: async ({ canvasElement }) => {
    const messages = Array.from(canvasElement.querySelectorAll('[data-usage-error]'), (node) => node.textContent);
    await expect(messages).toEqual([
      'UserMenu.Trigger must be rendered inside <UserMenu>.',
      'UserMenu.Identity must be rendered inside <UserMenu.Content>.',
      'UserMenu.ThemeGroup must be rendered inside <UserMenu.Content>.',
    ]);
  },
};

export const ReducedMotion: Story = {
  // Excluded from the docs page: its open overlay (modal/backdrop) covers the documentation.
  tags: ['!autodocs'],
  parameters: {
    docs: {
      description: {
        story:
          'Enable reduced motion to check behavior in the browser. This story checks CSS rules only. SheetHandle checks handle gestures with a stubbed media query.',
      },
    },
  },
  args: { defaultOpen: true, variant: 'sheet' },
  play: async ({ canvasElement }) => {
    const sheet = await findSheet(canvasElement);
    const item = within(sheet).getByRole('menuitem', { name: 'Profile' });
    const scrim = canvasElement.ownerDocument.querySelector('[data-ui="user-menu-scrim"]')!;
    await expect(getComputedStyle(sheet).animationDuration).toBe('0.24s');
    await expect(mediaRuleSets(sheet, 'prefers-reduced-motion: reduce', 'animation-name', 'none')).toBe(true);
    await expect(mediaRuleSets(scrim, 'prefers-reduced-motion: reduce', 'animation-name', 'none')).toBe(true);
    await expect(getComputedStyle(item).transitionDuration).toBe('0.12s');
    await expect(mediaRuleSets(item, 'prefers-reduced-motion: reduce', 'transition-duration', '0s')).toBe(true);
    // The entry settles in place.
    await wait(SETTLE_MS);
    await expect(getComputedStyle(sheet).transform).toBe('none');
  },
};

export const ForcedColors: Story = {
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { Button, styled, UserMenu } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const Row = styled.div({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: vars.space[3],
});

function ProfileIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <circle cx="8" cy="5.5" r="2.5" />
      <path d="M3 13.5c.8-2.4 2.7-3.5 5-3.5s4.2 1.1 5 3.5" />
    </svg>
  );
}

<Row>
  <UserMenu user={{ name: 'Ada Lovelace', email: 'ada@example.com', plan: 'Pro' }}>
    <UserMenu.Trigger aria-label="Account menu, Ada Lovelace" />
    <UserMenu.Content variant="menu" closeLabel="Close account menu">
      <UserMenu.Identity />
      <UserMenu.Item icon={<ProfileIcon />} onSelect={() => {}}>
        Profile
      </UserMenu.Item>
      <UserMenu.Item keys={['Ctrl', ',']} onSelect={() => {}}>
        Settings
      </UserMenu.Item>
      <UserMenu.Item disabled>Billing</UserMenu.Item>
      <UserMenu.Separator />
      <UserMenu.ThemeGroup
        labels={{ group: 'Appearance', light: 'Light', dark: 'Dark', system: 'System' }}
        onValueChange={(theme) => {}}
      />
      <UserMenu.StatusGroup
        labels={{ group: 'Status', available: 'Available', busy: 'Busy', away: 'Away' }}
        onValueChange={(status) => {}}
      />
      <UserMenu.Separator />
      <UserMenu.SignOut
        pendingLabel="Signing out"
        errorMessage="Sign out failed. Try again."
        onSignOut={async () => {
          const res = await fetch('/api/auth/sign-out', { method: 'POST' });
          if (!res.ok) throw new Error('Sign out failed');
        }}
      >
        Sign out
      </UserMenu.SignOut>
    </UserMenu.Content>
  </UserMenu>
  <Button>After</Button>
</Row>`,
      },
      description: {
        story:
          'Enable forced colors to check rendering in the browser. This story checks CSS rules only.',
      },
    },
  },
  play: async ({ canvasElement, userEvent }) => {
    await userEvent.tab();
    await userEvent.keyboard('{Enter}');
    await findMenu(canvasElement);
    await expectFocused(canvasElement, 'Profile');
    await userEvent.keyboard('{ArrowDown}{ArrowDown}');
    await expectFocused(canvasElement, 'Light', 'menuitemradio');
    const shell = shellOf(canvasElement)!;
    const option = canvasElement.ownerDocument.activeElement!;
    const checked = bodyOf(canvasElement).getByRole('menuitemradio', { name: 'System' });
    await expect(mediaRuleSets(shell, 'forced-colors: active', 'border-color', 'buttontext')).toBe(true);
    for (const separator of within(shell).getAllByRole('separator')) {
      await expect(mediaRuleSets(separator, 'forced-colors: active', 'background-color', 'canvastext')).toBe(true);
    }
    await expect(mediaRuleSets(getTrigger(canvasElement), 'forced-colors: active', 'border-color', 'buttontext')).toBe(true);
    await expect(mediaRuleSets(checked, 'forced-colors: active', 'border-color', 'highlight')).toBe(true);
    await expect(mediaRuleSets(option, 'forced-colors: active', 'outline-color', 'highlight')).toBe(true);
    // Real borders and outlines, not fills, carry the boundaries, the checked option and the focus.
    await expect(getComputedStyle(shell).borderTopStyle).toBe('solid');
    await expect(getComputedStyle(checked).borderTopStyle).toBe('solid');
    await expectFocusRing(option);
  },
};
