import type { CSSProperties } from 'react';
import { useId, useState } from 'react';
import { run as runAxe } from 'axe-core';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { withLightTheme } from '../../testing/story-decorators';
import { expectThemedSurface } from '../../testing/theme-assertions';
import { settleMotion } from '../../testing/motion-assertions';
import { styled } from '../../styling/styled';
import { useThemeScope } from '../../styling/theme-scope';
import { Button } from '../button';
import { Menu } from '../menu';
import { Popover, type PopoverBaseProps } from '../popover';
import { TextField } from '../text-field';
import { ThemeProvider, useTheme } from '../theme-provider/theme-provider';
import { ThemeRoot, type ThemeName, type ThemeRootProps } from './index';

const THEMES = ['dark', 'light'] as const satisfies readonly ThemeName[];

const surfaceStyle = {
  display: 'grid',
  gap: vars.space[4],
  padding: vars.space[6],
  borderRadius: vars.radius.lg,
  backgroundColor: vars.color.surface,
} satisfies CSSProperties;

const rowStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: vars.space[3],
} satisfies CSSProperties;

const headingStyle = {
  margin: 0,
  marginBlockEnd: vars.space[2],
  fontSize: vars.textSize.md,
} satisfies CSSProperties;

function ThemedPopover({ label, ...props }: PopoverBaseProps & { label: string }) {
  const headingId = useId();
  return (
    <Popover {...props}>
      <Popover.Trigger>{label}</Popover.Trigger>
      <Popover.Content aria-labelledby={headingId}>
        <h2 id={headingId} style={headingStyle}>
          {`${label} details`}
        </h2>
        <Button size="sm">{`${label} action`}</Button>
      </Popover.Content>
    </Popover>
  );
}
ThemedPopover.displayName = 'ThemedPopover';

/** Overlays inside the root portal into a host element it owns (set through a state ref). */
function PortalContainerExample({ theme, children }: ThemeRootProps) {
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  return (
    <ThemeRoot theme={theme} portalContainer={host} style={surfaceStyle}>
      {children}
      <div ref={setHost} data-overlay-host="" />
    </ThemeRoot>
  );
}
PortalContainerExample.displayName = 'PortalContainerExample';

function LiveThemeExample() {
  const [theme, setTheme] = useState<ThemeName>('dark');
  return (
    <ThemeRoot theme={theme} style={surfaceStyle}>
      <div style={rowStyle}>
        {/* Held open: the theme switch click would otherwise dismiss it as an outside press. */}
        <ThemedPopover label="Share" open />
        <Button onClick={() => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))}>Switch theme</Button>
      </div>
    </ThemeRoot>
  );
}
LiveThemeExample.displayName = 'LiveThemeExample';

const meta = {
  title: 'Theme/ThemeRoot',
  component: ThemeRoot,
  parameters: {
    docs: {
      source: { language: 'tsx', code: `import { Button, ThemeRoot } from '@jfrader/ui';

export function ThemedSection() {
  return (
    <ThemeRoot theme="light">
      <Button tone="accent">Save</Button>
    </ThemeRoot>
  );
}` },
      description: { component: 'Apply a theme to part of a page and its overlays.' },
      usage: `Nested scopes and their overlays use the nearest theme. For app setup and custom palettes, start with the [Theming guide](./?path=/docs/foundations-theming--docs).

\`tokens\` takes any token path; [Token overrides](./?path=/docs/theme-token-overrides--docs) lists every path and the value it keeps.`,
      sections: [
        {
          title: 'Theme scopes',
          stories: ['Default', 'Light', 'Inherited', 'LightTheme', 'NestedThemeRoots', 'AttributePrecedence', 'ThemeIdentity'],
        },
        { title: 'Overlays', stories: ['PortalContainer', 'NestedOverlayKeyboard', 'LiveThemeChange'] },
        { title: 'Provider', stories: ['ThemeProviderStandalone'] },
      ],
    },
  },
  args: { onClick: fn() },
  argTypes: {
    theme: { control: 'radio', options: THEMES, table: { defaultValue: { summary: 'dark' } } },
    appearance: { control: 'radio', options: ['inherit'] },
  },
  render: (args) => (
    <ThemeRoot {...args} style={surfaceStyle}>
      <div style={rowStyle}>
        <Button tone="accent">Save</Button>
        <Button variant="outline">Cancel</Button>
      </div>
      <TextField label="Project name" placeholder="Untitled" />
    </ThemeRoot>
  ),
} satisfies Meta<typeof ThemeRoot>;

export default meta;

type Story = StoryObj<typeof meta>;

function getRoot(canvasElement: HTMLElement) {
  return canvasElement.querySelector<HTMLElement>('[data-ui="theme-root"]:not([data-story-theme-scope])');
}

export const Default: Story = {
  name: 'Dark section',
  parameters: { docs: {
    description: { story: 'Group project controls in a dark theme scope.' },
    source: { language: 'tsx', code: `import { Button, TextField, ThemeRoot, styled } from '@jfrader/ui';
import { base } from '@jfrader/tokens';
import { vars } from '@jfrader/tokens/vars';

const Section = styled(ThemeRoot)({ display: 'grid', gap: vars.space[4], padding: vars.space[6], borderRadius: vars.radius.lg, backgroundColor: vars.color.surface });
const Actions = styled.div({ display: 'flex', alignItems: 'center', gap: vars.space[3] });

<Section theme="dark">
  <Actions><Button tone="accent">Save</Button><Button variant="outline">Cancel</Button></Actions>
  <TextField label="Project name" placeholder="Untitled" />
</Section>` },
  } },
  play: async ({ args, canvasElement }) => {
    await expect(getRoot(canvasElement)).toHaveAttribute('data-theme', 'dark');
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Save' }));
    await expect(args.onClick).toHaveBeenCalledTimes(1);
  },
};

export const Light: Story = {
  name: 'Light section',
  parameters: { docs: {
    description: { story: 'Use a light theme for the same project controls.' },
    source: { language: 'tsx', code: `import { Button, TextField, ThemeRoot, styled } from '@jfrader/ui';
import { base } from '@jfrader/tokens';
import { vars } from '@jfrader/tokens/vars';

const Section = styled(ThemeRoot)({ display: 'grid', gap: vars.space[4], padding: vars.space[6], borderRadius: vars.radius.lg, backgroundColor: vars.color.surface });
const Actions = styled.div({ display: 'flex', alignItems: 'center', gap: vars.space[3] });

<Section theme="light">
  <Actions><Button tone="accent">Save</Button><Button variant="outline">Cancel</Button></Actions>
  <TextField label="Project name" placeholder="Untitled" />
</Section>` },
  } },
  args: { theme: 'light' },
  play: async ({ canvasElement }) => {
    await expect(getRoot(canvasElement)).toHaveAttribute('data-theme', 'light');
  },
};

export const LightTheme: Story = {
  decorators: [withLightTheme],
  args: { theme: 'light' },
  play: async ({ canvasElement }) => {
    await expect(getRoot(canvasElement)).toHaveAttribute('data-theme', 'light');
  },
};

function getHost(canvasElement: HTMLElement) {
  const host = canvasElement.querySelector<HTMLElement>('[data-overlay-host]');
  if (!host) throw new Error('The overlay host is not rendered.');
  return host;
}

export const PortalContainer: Story = {
  name: 'Local overlay host',
  parameters: { docs: {
    description: { story: 'Open Share to place its popover inside a local host with the section’s light theme.' },
    source: { language: 'tsx', code: `import { useId, useState } from 'react';
import { Button, Popover, ThemeRoot, styled } from '@jfrader/ui';
import { base } from '@jfrader/tokens';
import { vars } from '@jfrader/tokens/vars';

const Section = styled(ThemeRoot)({ display: 'grid', gap: vars.space[4], padding: vars.space[6], borderRadius: vars.radius.lg, backgroundColor: vars.color.surface });
const Actions = styled.div({ display: 'flex', alignItems: 'center', gap: vars.space[3] });
const Heading = styled.h2({ margin: 0, marginBlockEnd: vars.space[2], fontSize: vars.textSize.md });

export function ShareSection() {
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  const headingId = useId();
  return (
    <Section theme="light" portalContainer={host}>
      <Actions>
        <Popover>
          <Popover.Trigger>Share</Popover.Trigger>
          <Popover.Content aria-labelledby={headingId}>
            <Heading id={headingId}>Share details</Heading>
            <Button size="sm">Share action</Button>
          </Popover.Content>
        </Popover>
        <Button>After</Button>
      </Actions>
      <div ref={setHost} />
    </Section>
  );
}` },
  } },
  args: { theme: 'light' },
  render: (args) => (
    <PortalContainerExample {...args}>
      <div style={rowStyle}>
        <ThemedPopover label="Share" />
        <Button>After</Button>
      </div>
    </PortalContainerExample>
  ),
  play: async ({ canvasElement }) => {
    const { ownerDocument } = canvasElement;
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button', { name: 'Share' });

    await userEvent.tab();
    await expect(ownerDocument.activeElement).toBe(trigger);
    await userEvent.keyboard('{Enter}');
    const popover = await canvas.findByRole('dialog', { name: 'Share details' });
    // The overlay lands in the root's container, not the body, and keeps the root's theme.
    await expect(getHost(canvasElement).contains(popover)).toBe(true);
    await expectThemedSurface(popover, 'light');

    // Keyboard order is untouched: trigger → portaled content → the next page control.
    await expect(ownerDocument.activeElement).toBe(trigger);
    await userEvent.tab();
    await expect(ownerDocument.activeElement).toBe(within(popover).getByRole('button', { name: 'Share action' }));
    await userEvent.tab();
    await expect(ownerDocument.activeElement).toBe(canvas.getByRole('button', { name: 'After' }));
    await expect(popover).toBeVisible();
  },
};

export const NestedOverlayKeyboard: Story = {
  args: { theme: 'light' },
  render: (args) => (
    <PortalContainerExample {...args}>
      <div style={rowStyle}>
        <Popover>
          <Popover.Trigger>Outer</Popover.Trigger>
          <Popover.Content aria-label="Outer details">
            <ThemedPopover label="Inner" />
            <Button>After inner</Button>
          </Popover.Content>
        </Popover>
        <Button>After outer</Button>
      </div>
    </PortalContainerExample>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const outerTrigger = canvas.getByRole('button', { name: 'Outer' });
    await userEvent.tab();
    await expect(outerTrigger).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    const outer = await canvas.findByRole('dialog', { name: 'Outer details' });
    const innerTrigger = within(outer).getByRole('button', { name: 'Inner' });
    await expect(getHost(canvasElement).contains(outer)).toBe(true);
    await expect(outerTrigger).toHaveAttribute('aria-controls', outer.id);

    await userEvent.tab();
    await expect(innerTrigger).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    const inner = await canvas.findByRole('dialog', { name: 'Inner details' });
    await expect(getHost(canvasElement).contains(inner)).toBe(true);
    await expect(innerTrigger).toHaveAttribute('aria-controls', inner.id);
    await expect(innerTrigger).toHaveFocus();
    const innerAction = within(inner).getByRole('button', { name: 'Inner action' });
    const afterInner = within(outer).getByRole('button', { name: 'After inner' });
    const afterOuter = canvas.getByRole('button', { name: 'After outer' });

    // Both portals share a DOM host; Tab must still follow their nested React order.
    for (const control of [innerAction, afterInner, afterOuter]) {
      await userEvent.tab();
      await waitFor(() => expect(control).toHaveFocus());
    }
    for (const control of [afterInner, innerAction, innerTrigger, outerTrigger]) {
      await userEvent.tab({ shift: true });
      await waitFor(() => expect(control).toHaveFocus());
    }
    await expect(outer).toBeVisible();
    await expect(inner).toBeVisible();

    await userEvent.tab();
    await expect(innerTrigger).toHaveFocus();
    await userEvent.tab();
    await expect(innerAction).toHaveFocus();
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(canvas.queryByRole('dialog', { name: 'Inner details' })).toBeNull());
    await expect(innerTrigger).toHaveAttribute('aria-expanded', 'false');
    await expect(outerTrigger).toHaveAttribute('aria-expanded', 'true');
    await expect(outer).toBeVisible();
    await waitFor(() => expect(innerTrigger).toHaveFocus());
  },
};

export const NestedThemeRoots: Story = {
  tags: ['!autodocs'],
  args: { theme: 'dark' },
  render: (args) => (
    <PortalContainerExample {...args}>
      <div style={rowStyle}>
        <ThemedPopover label="Outer" defaultOpen placement="bottom-start" />
        <ThemeRoot theme="light" style={surfaceStyle}>
          <ThemedPopover label="Inner" defaultOpen placement="top-start" />
        </ThemeRoot>
      </div>
    </PortalContainerExample>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const outer = await canvas.findByRole('dialog', { name: 'Outer details' });
    const inner = await canvas.findByRole('dialog', { name: 'Inner details' });
    // The nearest ThemeRoot names the theme; the inner root keeps the outer root's container.
    await expect(getHost(canvasElement).contains(outer)).toBe(true);
    await expect(getHost(canvasElement).contains(inner)).toBe(true);
    await expectThemedSurface(outer, 'dark');
    await expectThemedSurface(inner, 'light');
  },
};

export const LiveThemeChange: Story = {
  tags: ['!autodocs'],
  render: () => <LiveThemeExample />,
  parameters: {
    docs: {
      // No-args render: keep an authored usage snippet instead of the stringified tree.
      source: {
        code: `function LiveTheme() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  return (
    <ThemeRoot theme={theme}>
      <Popover open>…</Popover>
      <Button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>Switch theme</Button>
    </ThemeRoot>
  );
}`,
      },
    },
  },
  play: async ({ canvasElement }) => {
    const popover = await within(canvasElement.ownerDocument.body).findByRole('dialog', { name: 'Share details' });
    await expectThemedSurface(popover, 'dark');
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Switch theme' }));
    // The open overlay follows the root's new theme in place, without remounting.
    await expectThemedSurface(popover, 'light');
    await expect(popover.isConnected).toBe(true);
  },
};

function ThemeProbe() {
  const currentTheme = useTheme();
  const scope = useThemeScope();
  return (
    <span data-ui="theme-probe" data-color-text={currentTheme?.color?.text} data-scope-theme={scope?.theme ?? 'inherited'} data-has-scope={Boolean(scope)}>
      Probe
    </span>
  );
}
ThemeProbe.displayName = 'ThemeProbe';

export const ThemeProviderStandalone: Story = {
  render: () => (
    <div data-testid="provider-host">
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const host = within(canvasElement).getByTestId('provider-host');
    const probe = within(canvasElement).getByText('Probe');
    // ThemeProvider renders no DOM node of its own: child is the direct child of the host element
    await expect(probe.parentElement).toBe(host);
    await expect(probe).toHaveAttribute('data-color-text', vars.color.text);
  },
};

export const AttributePrecedence: Story = {
  render: () => (
    <ThemeRoot
      theme="dark"
      data-ui="custom-ui"
      data-theme="light"
      data-testid="precedence-root"
      style={surfaceStyle}
    >
      <ThemeProbe />
    </ThemeRoot>
  ),
  play: async ({ canvasElement }) => {
    const root = within(canvasElement).getByTestId('precedence-root');
    // Own markers win over consumer rest props
    await expect(root).toHaveAttribute('data-ui', 'theme-root');
    await expect(root).toHaveAttribute('data-theme', 'dark');
  },
};

export const ThemeIdentity: Story = {
  render: () => (
    <div style={rowStyle}>
      <ThemeRoot theme="dark" data-testid="dark-root" style={surfaceStyle}>
        <ThemeProbe />
      </ThemeRoot>
      <ThemeRoot theme="light" data-testid="light-root" style={surfaceStyle}>
        <ThemeProbe />
      </ThemeRoot>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const probes = within(canvasElement).getAllByText('Probe');
    await expect(probes).toHaveLength(2);
    // Both dark and light roots supply token var references (values never change between dark and light)
    await expect(probes[0]).toHaveAttribute('data-color-text', vars.color.text);
    await expect(probes[1]).toHaveAttribute('data-color-text', vars.color.text);
  },
};

const InheritanceHost = styled.div({
  '--ui-color-accent': vars.color.success,
  color: vars.color.textMuted,
  '&[data-theme="dark"]': { colorScheme: 'dark' },
  '&[data-theme="light"]': { colorScheme: 'light' },
});

const inheritedSectionStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: vars.space[3],
  padding: vars.space[4],
  backgroundColor: vars.color.surface,
} satisfies CSSProperties;

const inheritedTokens = { color: { accent: vars.color.danger }, radius: { md: vars.radius.lg } };

function InheritedMenuExample({
  theme,
  withContext,
  live = false,
  localHost = true,
  rootProps,
}: {
  theme: ThemeName;
  withContext: boolean;
  live?: boolean;
  localHost?: boolean;
  rootProps?: ThemeRootProps;
}) {
  const [palette, setPalette] = useState(theme);
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  const content = (
    <InheritanceHost data-theme={withContext ? undefined : palette} data-testid="inherit-host">
      <ThemeRoot {...rootProps} appearance="inherit" portalContainer={localHost ? host : undefined} data-testid="inherit-root" sx={inheritedSectionStyle}>
        <ThemeProbe />
        <Menu triggerLabel="Actions" items={[{ type: 'item', label: 'Inspect' }, { type: 'item', label: 'Rename' }]} open={live ? true : undefined} />
        <Button>After</Button>
        {live && <Button onClick={() => setPalette(current => current === 'dark' ? 'light' : 'dark')}>Switch theme</Button>}
        <div ref={setHost} data-testid="inherit-portal-host" />
      </ThemeRoot>
    </InheritanceHost>
  );
  return withContext ? <ThemeRoot theme={palette} tokens={inheritedTokens} data-testid="inherit-context-root">{content}</ThemeRoot> : content;
}

function inheritedMenuStory(theme: ThemeName, withContext: boolean): Story {
  return {
    args: { appearance: 'inherit', ref: fn() },
    render: args => <InheritedMenuExample theme={theme} withContext={withContext} rootProps={args} />,
    play: async ({ args, canvasElement, userEvent }) => {
      const canvas = within(canvasElement);
      const root = canvas.getByTestId('inherit-root');
      const host = canvas.getByTestId('inherit-host');
      const probe = root.querySelector('[data-ui="theme-probe"]');
      await expect(root).not.toHaveAttribute('data-theme');
      await expect(root).not.toHaveAttribute('appearance');
      await expect(args.ref).toHaveBeenCalledWith(root);
      await expect(getComputedStyle(root).color).toBe(getComputedStyle(host).color);
      await expect(getComputedStyle(root).colorScheme).toBe(getComputedStyle(host).colorScheme);
      await expect(probe).toHaveAttribute('data-has-scope', 'true');
      await expect(probe).toHaveAttribute('data-scope-theme', withContext ? theme : 'inherited');
      await expect(probe).toHaveAttribute('data-color-text', vars.color.text);
      const trigger = canvas.getByRole('button', { name: 'Actions' });
      await userEvent.click(trigger);
      const menu = await canvas.findByRole('menu', { name: 'Actions' });
      const boundary = menu.closest('[data-ui="theme-boundary"]');
      await expect(canvas.getByTestId('inherit-portal-host').contains(menu)).toBe(true);
      await expect(getComputedStyle(menu).colorScheme).toBe(theme);
      for (const property of ['--ui-color-accent', '--ui-radius-md', '--ui-color-surface']) {
        await expect(getComputedStyle(menu).getPropertyValue(property)).toBe(getComputedStyle(host).getPropertyValue(property));
      }
      await expect(boundary).not.toHaveAttribute('data-theme');
      await waitFor(() => expect(canvas.getByRole('menuitem', { name: 'Inspect' })).toHaveFocus());
      await userEvent.tab({ shift: true });
      await expect(trigger).toHaveFocus();
      await userEvent.tab();
      await waitFor(() => expect(canvas.getByRole('menuitem', { name: 'Inspect' })).toHaveFocus());
      await userEvent.tab();
      await expect(canvas.queryByRole('menu')).toBeNull();
      await expect(canvas.getByRole('button', { name: 'After' })).toHaveFocus();
      await userEvent.click(trigger);
      await userEvent.keyboard('{Escape}');
      await expect(trigger).toHaveFocus();
      await expect(canvas.queryByRole('menu')).toBeNull();
      await userEvent.click(trigger);
      await waitFor(() => expect(canvas.getByRole('menuitem', { name: 'Inspect' })).toHaveFocus());
      await settleMotion(canvasElement.ownerDocument.body);
      const { violations } = await runAxe(canvasElement.ownerDocument.body);
      await expect(violations.find(({ id }) => id === 'aria-hidden-focus')).toBeUndefined();
      await expect(violations.filter(({ impact }) => impact === 'serious' || impact === 'critical')).toEqual([]);
    },
  };
}

function LocalMenuHost() {
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  return (
    <ThemeRoot appearance="inherit" portalContainer={host} data-testid="inherit-root">
      <Menu triggerLabel="Actions" items={[{ type: 'item', label: 'Inspect' }]} />
      <div ref={setHost} />
    </ThemeRoot>
  );
}

export const Inherited: Story = {
  name: 'Inherited palette',
  render: () => <ThemeRoot theme="light" data-testid="inherit-host"><LocalMenuHost /></ThemeRoot>,
  play: async ({ canvasElement, userEvent }) => {
    const canvas = within(canvasElement);
    const root = canvas.getByTestId('inherit-root');
    await expect(root).not.toHaveAttribute('data-theme');
    await userEvent.click(canvas.getByRole('button', { name: 'Actions' }));
    const menu = await canvas.findByRole('menu', { name: 'Actions' });
    await waitFor(() => expect(within(menu).getByRole('menuitem', { name: 'Inspect' })).toHaveFocus());
    await expect(root.contains(menu)).toBe(true);
    await expect(getComputedStyle(menu).colorScheme).toBe('light');
    await settleMotion(canvasElement.ownerDocument.body);
    const { violations } = await runAxe(canvasElement.ownerDocument.body);
    await expect(violations.filter(({ impact }) => impact === 'serious' || impact === 'critical')).toEqual([]);
  },
  parameters: { docs: {
    description: { story: 'Keep the enclosing light palette and route menu overlays to a local host.' },
    source: { language: 'tsx', code: `import { useState } from 'react';
import { Menu, ThemeRoot } from '@jfrader/ui';

function LocalMenuHost() {
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  return (
    <ThemeRoot appearance="inherit" portalContainer={host}>
      <Menu triggerLabel="Actions" items={[{ type: 'item', label: 'Inspect' }]} />
      <div ref={setHost} />
    </ThemeRoot>
  );
}

<ThemeRoot theme="light"><LocalMenuHost /></ThemeRoot>` },
  } },
};

export const InheritedDark: Story = { ...inheritedMenuStory('dark', true), tags: ['!autodocs'] };
export const InheritedDomLight: Story = { ...inheritedMenuStory('light', false), tags: ['!autodocs'] };
export const InheritedDomDark: Story = { ...inheritedMenuStory('dark', false), tags: ['!autodocs'] };

export const InheritedExternalPortal: Story = {
  tags: ['!autodocs'],
  render: () => <InheritedMenuExample theme="light" withContext localHost={false} />,
  play: async ({ canvasElement, userEvent }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    const root = canvas.getByTestId('inherit-root');
    const parent = canvas.getByTestId('inherit-context-root');
    const trigger = canvas.getByRole('button', { name: 'Actions' });
    await expect(root).not.toHaveAttribute('data-theme');
    await userEvent.click(trigger);
    const menu = await body.findByRole('menu', { name: 'Actions' });
    await waitFor(() => expect(within(menu).getByRole('menuitem', { name: 'Inspect' })).toHaveFocus());
    await expect(root.contains(menu)).toBe(false);
    await expect(menu.closest('[data-ui="theme-boundary"]')).toHaveAttribute('data-theme', 'light');
    await expect(getComputedStyle(menu).getPropertyValue('--ui-color-accent')).toBe(getComputedStyle(parent).getPropertyValue('--ui-color-accent'));
    await settleMotion(canvasElement.ownerDocument.body);
    const { violations } = await runAxe(canvasElement.ownerDocument.body);
    await expect(violations.filter(({ impact }) => impact === 'serious' || impact === 'critical')).toEqual([]);
    await userEvent.keyboard('{Escape}');
    await expect(trigger).toHaveFocus();
  },
};

function inheritedLiveStory(withContext: boolean): Story {
  return {
    tags: ['!autodocs'],
    render: () => <InheritedMenuExample theme="dark" withContext={withContext} live />,
    play: async ({ canvasElement, userEvent }) => {
      const canvas = within(canvasElement);
      const root = canvas.getByTestId('inherit-root');
      const menu = await canvas.findByRole('menu', { name: 'Actions' });
      await expect(getComputedStyle(menu).colorScheme).toBe('dark');
      await userEvent.click(canvas.getByRole('button', { name: 'Switch theme' }));
      await expect(root).not.toHaveAttribute('data-theme');
      await expect(getComputedStyle(menu).colorScheme).toBe('light');
      await expect(root.querySelector('[data-ui="theme-probe"]')).toHaveAttribute('data-scope-theme', withContext ? 'light' : 'inherited');
      await expect(getComputedStyle(menu).getPropertyValue('--ui-color-accent')).toBe(getComputedStyle(root).getPropertyValue('--ui-color-accent'));
      await expect(canvas.getByRole('menu')).toBe(menu);
      await expect(canvas.getByTestId('inherit-root')).toBe(root);
      await settleMotion(canvasElement.ownerDocument.body);
      const { violations } = await runAxe(canvasElement.ownerDocument.body);
      await expect(violations.filter(({ impact }) => impact === 'serious' || impact === 'critical')).toEqual([]);
    },
  };
}

export const InheritedLiveContext: Story = inheritedLiveStory(true);
export const InheritedLiveDom: Story = inheritedLiveStory(false);

export const DefaultOnLight: Story = {
  tags: ['!autodocs'],
  render: () => <InheritanceHost data-theme="light"><ThemeRoot data-testid="default-on-light"><ThemeProbe /></ThemeRoot></InheritanceHost>,
  play: async ({ canvasElement }) => {
    const root = within(canvasElement).getByTestId('default-on-light');
    await expect(root).toHaveAttribute('data-theme', 'dark');
    await expect(meta.argTypes.theme.table.defaultValue.summary).toBe(root.getAttribute('data-theme'));
    await expect(getComputedStyle(root).colorScheme).toBe('dark');
    await expect(root.querySelector('[data-ui="theme-probe"]')).toHaveAttribute('data-scope-theme', 'dark');
  },
};

export const InheritWithExplicitTheme: Story = {
  tags: ['!autodocs'],
  render: () => <InheritanceHost data-theme="dark"><ThemeRoot appearance="inherit" theme="light" data-testid="explicit-theme" sx={inheritedSectionStyle}><ThemeProbe /></ThemeRoot></InheritanceHost>,
  play: async ({ canvasElement }) => {
    const root = within(canvasElement).getByTestId('explicit-theme');
    await expect(root).toHaveAttribute('data-theme', 'light');
    await expect(getComputedStyle(root).colorScheme).toBe('light');
  },
};

function inheritedTypeContract() {
  <ThemeRoot appearance="inherit" theme="light" />;
  // @ts-expect-error ThemeRoot's appearance mode does not accept surface appearances.
  <ThemeRoot appearance="contrast" />;
}
void inheritedTypeContract;
