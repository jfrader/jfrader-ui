// `styled` is the app-facing styling API; consumers import it from `@jfrader/ui`.
import { styled } from '../../index';
import { StrictMode, useState, type CSSProperties, type ReactNode } from 'react';
import type { Meta, StoryContext, StoryObj } from '@storybook/react-vite';
import { expect, fireEvent, fn, spyOn, waitFor, within } from 'storybook/test';
import type { Mock } from 'storybook/test';
import { base } from '@jfrader/tokens';
import { vars } from '@jfrader/tokens/vars';
import { withLightTheme } from '../../testing/story-decorators';
import { expectThemedSurface } from '../../testing/theme-assertions';
import { Button as FixtureButton } from '../button';
import { Dialog } from '../dialog';
import { Popover } from '../popover';
import { TextField } from '../text-field';
import { ThemeRoot } from '../theme-root';
import { Surface, type SurfacePartProps } from '../surface';
import { Card } from '../card';
import {
  DialogStack,
  useDialogStack,
  type DialogStackCompoundProps,
  type DialogStackContentProps,
  type DialogStackEasyProps,
  type DialogStackPageRecord,
} from './index';

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
const SHEET_PEEK = Number.parseFloat(base.size.dialogStackSheetPeek);
const DIALOG_PEEK = Number.parseFloat(base.size.dialogStackDialogPeek);
const BREAKPOINT = Number.parseFloat(base.size.dialogStackBreakpoint);
const STORY_INLINE_CAP = `calc(100vw - 2 * ${vars.space[4]})`;

const Container = styled.div({
  position: 'relative',
  inlineSize: `min(480px, ${STORY_INLINE_CAP})`,
  blockSize: '440px',
  maxInlineSize: '100%',
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.lg,
  padding: vars.space[4],
  boxSizing: 'border-box',
});

const Header = styled.div({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: vars.space[2],
});

const CompactContainer = styled(Container)({ blockSize: '160px', inlineSize: '200px' });

const Stack = styled.div({ display: 'grid', gap: vars.space[3] });

const Prose = styled.p({ margin: 0 });

const WrappingRow = styled.div({ display: 'flex', flexWrap: 'wrap', gap: vars.space[2] });

const Row = styled.div({ display: 'flex', gap: vars.space[2] });

const meta = {
  title: 'Surfaces/DialogStack',
  component: DialogStack,
  tags: ['autodocs'],
  args: { onValueChange: fn() },
  argTypes: { pages: { control: false } },
  parameters: {
    docs: {
      description: {
        component:
          'Open settings or pickers in stacked panels, then go back one panel at a time.',
      },
      usage: `### Composition
Pass \`triggerLabel\` and \`pages\` (with optional \`initialPage\`) for a stacked multi-page dialog flow. Each page record provides \`value\`, \`title\`, \`content\`, and optional \`description\`, \`footer\`, \`back\`, and \`close\`. Navigation is handled automatically by the existing parts and controller: \`triggerLabel\` opens the initial page, triggers inside page content push child panels, Back pops to the parent, Close clears the stack, and Escape dismisses the topmost panel.

Do not combine \`pages\` with \`children\`. Use \`slotProps.trigger\`, \`slotProps.content\`, \`slotProps.title\`, \`slotProps.back\`, \`slotProps.close\`, and \`slotProps.footer\` for part props, or \`slots\` to replace generated parts. For custom anatomy, use the compound parts (\`DialogStack.Trigger\`, \`DialogStack.Content\`, \`DialogStack.Title\`, etc.).

### Values
- Each \`Trigger\` pushes its matching \`Content\` onto the stack. Pushing an open key returns to that panel and removes the panels above it.
- \`value\` lists open keys from bottom to top. Control it with \`onValueChange\`, or use \`defaultValue\` (empty by default). Rejected requests keep the committed stack.
- Unknown and duplicate keys are ignored with a development warning. Requests that leave the ordered stack unchanged do not call \`onValueChange\`.
- Parents stay mounted behind the top panel, keeping form state. They peek above it but are inert and hidden from assistive technology. Popped panels unmount.
- \`useDialogStack\` exposes \`push\`, \`pop\`, \`popTo\`, and \`close\`. Call it inside \`DialogStack\`.

### Keyboard and focus
- Enter or Space on Trigger opens its panel. Tab and Shift+Tab stay inside the top panel.
- Back pops one panel. Close clears the stack. Give both a localized \`label\`.
- Escape closes an open child overlay first. Otherwise, Escape or a backdrop click requests one pop.
- New panels focus an \`autoFocus\` element, then the heading, then Back, then the panel. Popping returns focus to the exact control that opened the child. If that control is gone, focus falls back to the parent's heading, Back, or panel. Closing the stack returns focus to the outer invoker.

### Layout
- \`variant="auto"\` is the default. It uses a bottom sheet below \`breakpoint\` and a centered dialog at or above it. The breakpoint measures the layer's inline size in CSS pixels. Resizing changes layout without replacing the DOM or changing focus or value.
- By default, one native modal dialog covers the viewport, makes the page inert, and locks page scroll after \`showModal()\` succeeds.
- \`contained\` draws the layer inside the nearest positioned ancestor. It remains document-wide modal: everything outside it is inert until close, and focus stays in the layer. Page scroll is not locked.

### Dismissal and limits
- In sheet layout, drag the top panel's handle downward to dismiss it. This is pointer-only. Body content never starts a drag. Add \`data-sheet-no-drag\` to \`Content\` to disable dragging. There are no snap points.
- Reduced motion disables dragging, entry animation, and depth motion. Back and Close still work. Closing is immediate, with no top-panel exit animation.
- \`dismissible={false}\` refuses Escape, backdrop, and drag dismissal. \`onCancel\` can veto those requests with \`preventDefault()\`. Back and Close still work.
- A platform close that cannot be canceled closes the native shell and requests an empty stack. If a controlled parent rejects it, the closed shell releases its scroll lock. The next explicit open request reopens it.
- Floating overlays inside a panel need a \`ThemeRoot portalContainer\` host inside that panel.

### Panel material
Content inherits appearance; appearance="contrast" uses fixed charcoal. Declaration-site theme and tokens cross the internal stage portal, which remains inside the modal layer.

component is sugar for slots.root; only root is adopted, and slots.root wins. slotProps.root accepts div props and sx. Declare adapters outside render, render one div, forward every supplied prop/ref, and apply material before className. Changing the adapter type remounts the panel and resets focus and uncontrolled input state.

Root slot props win ordinary conflicts; className combines and style shallow-merges, slot values last. Styling order is adapter material → host geometry/motion → slot sx/classes → consumer classes → consumer sx. Generated handle/body, IDs, active/parent state, inertness, native dismissal and depth variables stay authoritative. Select composed panels with [data-ui~="dialog-stack"].`,
      source: {
        language: 'tsx',
        code: `const pages = [
  {
    value: 'settings',
    title: 'Settings',
    description: 'Manage your workspace preferences.',
    content: <DialogStack.Trigger value="account">Account</DialogStack.Trigger>,
    close: 'Close settings',
  },
  {
    value: 'account',
    title: 'Account',
    description: 'Sign-in details for this workspace.',
    content: <TextField label="Display name" defaultValue="Alex" />,
    back: 'Back to Settings',
    footer: <DialogStack.Close label="Done">Done</DialogStack.Close>,
  },
];

<DialogStack triggerLabel="Open settings" pages={pages} />`,
      },
    },
  },
} satisfies Meta<typeof DialogStack>;

export default meta;

type Story = Omit<StoryObj<DialogStackCompoundProps>, 'render' | 'play'> & {
  render?: (args: DialogStackCompoundProps) => ReactNode;
  play?: (context: StoryContext<DialogStackCompoundProps>) => Promise<void>;
};

function DeclarationScopeFixture({ contained = false, ...props }: DialogStackCompoundProps) {
  return <Container>
    <DialogStack {...props} contained={contained} defaultValue={['scope']} variant="dialog">
      <ThemeRoot theme="light" tokens={{ radius: { lg: '3rem' } }}>
        <DialogStack.Content value="scope" data-testid="declaration-panel">
          <DialogStack.Title>Account settings</DialogStack.Title>
          <DialogStack.Close label="Close settings" />
        </DialogStack.Content>
      </ThemeRoot>
    </DialogStack>
  </Container>;
}

export const StackDeclarationScopePortal: Story = {
  tags: ['!autodocs'],
  render: (args) => <DeclarationScopeFixture {...args} />,
  play: async ({ canvasElement }) => {
    const panel = await within(canvasElement.ownerDocument.body).findByTestId('declaration-panel');
    await expect(panel.closest('[data-ui="theme-boundary"]')).toHaveAttribute('data-theme', 'light');
    await expectThemedSurface(panel, 'light');
    await expect(getComputedStyle(panel).borderRadius).toBe('48px');
    await expect(panel.closest('[data-ui="dialog-stack-stage"]')).not.toBeNull();
  },
};

export const StackDeclarationScopeContained: Story = {
  ...StackDeclarationScopePortal,
  args: { contained: true, children: null },
};

const AdapterMaterial = styled.div({ backgroundColor: vars.color.surfaceRaised, color: vars.color.text, border: `1px dashed ${vars.color.border}`, boxShadow: 'none' });
function StackPaper({ className, ...props }: SurfacePartProps) {
  return <AdapterMaterial {...props} className={className} />;
}

function rootAdapterStory(component: DialogStackContentProps['component']): Story {
  // The slot style deliberately challenges the host-owned depth custom property API.
  const customization: Partial<DialogStackContentProps> = {
    component,
    slotProps: { root: {
      'data-state': 'wrong', inert: true, className: 'panel-slot',
      ref: (node) => { if (node) node.dataset.rootRef = 'slot'; },
      style: { '--dialog-stack-depth': 99 } as CSSProperties,
    } },
  };
  return {
    tags: ['!autodocs'],
    render: (args) => <Levels {...args} defaultValue={['settings']} contentProps={{ settings: customization, account: customization }} />,
    play: async ({ canvasElement, userEvent }) => {
      const body = within(canvasElement.ownerDocument.body);
      const shell = canvasElement.querySelector('dialog')!;
      const panel = shell.querySelector<HTMLElement>('[data-ui~="dialog-stack"]')!;
      await settle(shell);
      await expect(rect(panel).width).toBeCloseTo(Number.parseFloat(getComputedStyle(panel).inlineSize), 0);
      await expect(panel).toHaveAttribute('data-root-ref', 'slot');
      await expect(panel).toHaveAttribute('data-state', 'active');
      await expect(panel).not.toHaveAttribute('inert');
      await expect(panel.style.getPropertyValue('--dialog-stack-depth')).toBe('0');
      await expect(panel.querySelectorAll('[data-ui="dialog-stack-handle"]')).toHaveLength(1);
      await expect(panel.querySelectorAll('[data-ui="dialog-stack-body"]')).toHaveLength(1);
      const trigger = body.getByRole('button', { name: 'Account' });
      await userEvent.click(trigger);
      await waitFor(() => expect(panel).toHaveAttribute('inert'));
      await expect(panel).toHaveAttribute('aria-hidden', 'true');
      await userEvent.click(body.getByRole('button', { name: 'Back to Settings' }));
      await waitFor(() => expect(panel).not.toHaveAttribute('inert'));
      await expect(trigger).toHaveFocus();
      await expect(shell.querySelector('[data-ui~="dialog-stack"]')).toBe(panel);
      if (component === StackPaper) await expect(getComputedStyle(panel).borderTopStyle).toBe('dashed');
    },
  };
}

export const SurfaceAdapter = rootAdapterStory(Surface);
export const CardAdapter = rootAdapterStory(Card);
export const IndependentMaterialAdapter = rootAdapterStory(StackPaper);
export const SurfaceAdapterLight: Story = { ...SurfaceAdapter, decorators: [withLightTheme], globals: { theme: 'light' } };

interface LevelsProps extends Omit<DialogStackCompoundProps, 'children'> {
  contentProps?: Partial<Record<string, Partial<DialogStackContentProps>>>;
  body?: ReactNode;
  footer?: boolean;
}

/** Three levels: Settings → Account → Password. */
function Levels({ contentProps = {}, body, footer = false, ...props }: LevelsProps) {
  return (
    <DialogStack {...props}>
      <DialogStack.Trigger value="settings">Settings</DialogStack.Trigger>
      <DialogStack.Content value="settings" {...contentProps.settings}>
        <Header>
          <DialogStack.Title>Settings</DialogStack.Title>
          <DialogStack.Close label="Close all" />
        </Header>
        <DialogStack.Description>Manage your workspace preferences.</DialogStack.Description>
        <TextField label="Workspace name" />
        <DialogStack.Trigger value="account">Account</DialogStack.Trigger>
        {body}
      </DialogStack.Content>
      <DialogStack.Content value="account" {...contentProps.account}>
        <Header>
          <DialogStack.Back label="Back to Settings" />
          <DialogStack.Close label="Close all" />
        </Header>
        <DialogStack.Title>Account</DialogStack.Title>
        <DialogStack.Description>Sign-in details for this workspace.</DialogStack.Description>
        <DialogStack.Trigger value="password">Change password</DialogStack.Trigger>
        {footer && (
          <DialogStack.Footer>
            <DialogStack.Close label="Done">Done</DialogStack.Close>
          </DialogStack.Footer>
        )}
      </DialogStack.Content>
      <DialogStack.Content value="password" {...contentProps.password}>
        <Header>
          <DialogStack.Back label="Back to Account" />
          <DialogStack.Close label="Close all" />
        </Header>
        <DialogStack.Title>Change password</DialogStack.Title>
        <TextField label="New password" type="password" />
      </DialogStack.Content>
    </DialogStack>
  );
}
Levels.displayName = 'Levels';

function ControlledLevels({ value: initial = [], ...props }: LevelsProps) {
  const [value, setValue] = useState<readonly string[]>(initial);
  return (
    <Levels
      {...props}
      value={value}
      onValueChange={(next) => {
        props.onValueChange?.(next);
        setValue(next);
      }}
    />
  );
}
ControlledLevels.displayName = 'ControlledLevels';

function layer(canvasElement: HTMLElement) {
  return canvasElement.querySelector<HTMLElement>('[data-ui="dialog-stack-layer"]')!;
}

function panels(canvasElement: HTMLElement) {
  return Array.from(layer(canvasElement).querySelectorAll<HTMLElement>('[data-ui="dialog-stack"]'));
}

function activePanel(canvasElement: HTMLElement) {
  return layer(canvasElement).querySelector<HTMLElement>('[data-ui="dialog-stack"][data-state="active"]');
}

function panelTitled(canvasElement: HTMLElement, title: string) {
  return panels(canvasElement).find((panel) => panel.querySelector('[data-ui="dialog-stack-title"]')?.textContent === title)!;
}

function rect(element: Element) {
  return element.getBoundingClientRect();
}

/** Waits for running animations; one replaced mid-flight (a layout switch) counts as settled. */
async function settle(element: HTMLElement) {
  await Promise.all(
    element.getAnimations({ subtree: true }).map((animation) => animation.finished.catch(() => animation)),
  );
}

/** Synthetic key events never trigger the browser's native cancel; dispatch the cancel a real Escape produces. */
function requestEscape(shell: HTMLElement) {
  fireEvent(shell, new Event('cancel', { cancelable: true }));
}

async function expectFocusRing(element: HTMLElement) {
  await expect(element.ownerDocument.activeElement).toBe(element);
  const style = getComputedStyle(element);
  await expect(style.outlineStyle).not.toBe('none');
  // Fractional device pixel ratios compute the authored 2px as e.g. 1.48837px.
  await expect(Math.abs(Number.parseFloat(style.outlineWidth) - 2)).toBeLessThan(1.1);
}

async function expectActive(canvasElement: HTMLElement, title: string) {
  await waitFor(() =>
    expect(activePanel(canvasElement)?.querySelector('[data-ui="dialog-stack-title"]')).toHaveTextContent(title),
  );
}

async function expectStackClosed(canvasElement: HTMLElement, trigger: HTMLElement) {
  await waitFor(() => expect(panels(canvasElement)).toHaveLength(0));
  await waitFor(() => expect(layer(canvasElement)).not.toHaveAttribute('open'));
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await waitFor(() => expect(trigger).toHaveFocus());
  await expect(canvasElement.ownerDocument.documentElement.style.overflow).toBe('');
}

/** The authored rule inside `condition` that targets one of `element`'s classes. */
function findConditionalRule(element: HTMLElement, condition: string, suffix = '') {
  for (const sheet of Array.from(element.ownerDocument.styleSheets)) {
    for (const rule of Array.from(sheet.cssRules)) {
      if (!(rule instanceof CSSMediaRule) || !rule.conditionText.includes(condition)) continue;
      for (const inner of Array.from(rule.cssRules)) {
        if (!(inner instanceof CSSStyleRule)) continue;
        const matches = Array.from(element.classList).some((name) =>
          inner.selectorText.split(',').some((selector) => selector.trim() === `.${name}${suffix}`),
        );
        if (matches) return inner;
      }
    }
  }
  return undefined;
}

const EASY_PAGES: readonly DialogStackPageRecord[] = [
  {
    value: 'settings',
    title: 'Settings',
    description: 'Manage your workspace preferences.',
    close: 'Close settings',
    content: (
      <Stack>
        <TextField label="Workspace name" defaultValue="Apollo" />
        <DialogStack.Trigger value="account">Account settings</DialogStack.Trigger>
      </Stack>
    ),
  },
  {
    value: 'account',
    title: 'Account',
    description: 'Sign-in details for this workspace.',
    back: 'Back to Settings',
    close: 'Close all',
    content: <TextField label="Display name" defaultValue="Maya" />,
    footer: <DialogStack.Close label="Done">Done</DialogStack.Close>,
  },
];

export const Default: StoryObj<(props: DialogStackEasyProps) => ReactNode> = {
  name: 'Easy mode',
  args: {
    triggerLabel: 'Open settings',
    pages: EASY_PAGES,
    onValueChange: fn(),
  },
  render: (args) => <DialogStack {...args} />,
  play: async ({ args, canvasElement, userEvent }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button', { name: 'Open settings' });
    await expect(canvas.queryByRole('dialog')).toBeNull();

    await userEvent.click(trigger);
    const shell = await canvas.findByRole('dialog');
    await expect(shell).toBe(layer(canvasElement));
    await expect(shell).toHaveAccessibleName('Settings');
    await expect(shell).toHaveAccessibleDescription('Manage your workspace preferences.');
    await waitFor(() => expect(within(shell).getByRole('heading', { name: 'Settings' })).toHaveFocus());
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith(['settings']);

    // Navigation: click trigger to push account page
    const accountTrigger = within(shell).getByRole('button', { name: 'Account settings' });
    await userEvent.click(accountTrigger);
    await waitFor(() => expect(within(shell).getByRole('heading', { name: 'Account' })).toHaveFocus());
    await expect(args.onValueChange).toHaveBeenCalledTimes(2);
    await expect(args.onValueChange).toHaveBeenLastCalledWith(['settings', 'account']);

    // Back and Close share one top bar: same row, Back at the start, Close at the end.
    const rowBack = within(shell).getByRole('button', { name: 'Back to Settings' }).getBoundingClientRect();
    const rowClose = within(shell).getByRole('button', { name: 'Close all' }).getBoundingClientRect();
    const rowBarElement = shell.querySelector<HTMLElement>('[data-ui="dialog-stack-top-bar"]');
    if (!rowBarElement) throw new Error('Missing dialog-stack top bar');
    const rowBar = rowBarElement.getBoundingClientRect();
    await expect(Math.abs((rowBack.top + rowBack.height / 2) - (rowClose.top + rowClose.height / 2))).toBeLessThan(1);
    await expect(rowClose.left).toBeGreaterThan(rowBack.right);
    await expect(rowBack.left).toBeLessThan(rowBar.left + rowBar.width / 3);
    await expect(rowClose.right).toBeGreaterThan(rowBar.left + rowBar.width * 2 / 3);

    // Back button: click Back to pop to settings
    const backButton = within(shell).getByRole('button', { name: 'Back to Settings' });
    await userEvent.click(backButton);
    await waitFor(() => expect(within(shell).getByRole('heading', { name: 'Settings' })).toBeVisible());
    await expect(within(shell).getByRole('button', { name: 'Account settings' })).toHaveFocus();
    await expect(args.onValueChange).toHaveBeenCalledTimes(3);
    await expect(args.onValueChange).toHaveBeenLastCalledWith(['settings']);

    // Push again and test keyboard dismiss (Escape)
    await userEvent.click(within(shell).getByRole('button', { name: 'Account settings' }));
    await waitFor(() => expect(within(shell).getByRole('heading', { name: 'Account' })).toHaveFocus());
    requestEscape(shell);
    await waitFor(() => expect(within(shell).getByRole('heading', { name: 'Settings' })).toBeVisible());
    await expect(args.onValueChange).toHaveBeenCalledTimes(5);
    await expect(args.onValueChange).toHaveBeenLastCalledWith(['settings']);

    // Close entire stack via Close button
    const closeButton = within(shell).getByRole('button', { name: 'Close settings' });
    await userEvent.click(closeButton);
    await expectStackClosed(canvasElement, trigger);
    await expect(trigger).toHaveFocus();
    await expect(args.onValueChange).toHaveBeenCalledTimes(6);
    await expect(args.onValueChange).toHaveBeenLastCalledWith([]);
  },
};

function ControlledEasyStackFixture() {
  const [value, setValue] = useState<string[]>([]);
  return (
    <div>
      <DialogStack
        triggerLabel="Open controlled"
        value={value}
        onValueChange={setValue}
        pages={EASY_PAGES}
      />
    </div>
  );
}

export const EasyModeControlled: StoryObj = {
  name: 'Easy mode controlled',
  render: () => <ControlledEasyStackFixture />,
  play: async ({ canvasElement, userEvent }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button', { name: 'Open controlled' });
    await userEvent.click(trigger);
    const shell = await canvas.findByRole('dialog');
    await waitFor(() => expect(within(shell).getByRole('heading', { name: 'Settings' })).toBeVisible());

    const accountBtn = within(shell).getByRole('button', { name: 'Account settings' });
    await userEvent.click(accountBtn);
    await waitFor(() => expect(within(shell).getByRole('heading', { name: 'Account' })).toBeVisible());

    const backBtn = within(shell).getByRole('button', { name: 'Back to Settings' });
    await userEvent.click(backBtn);
    await waitFor(() => expect(within(shell).getByRole('heading', { name: 'Settings' })).toBeVisible());

    const closeBtn = within(shell).getByRole('button', { name: 'Close settings' });
    await userEvent.click(closeBtn);
    await expectStackClosed(canvasElement, trigger);
  },
};

export const EasyModeSlotPropsOverrides: StoryObj<(props: DialogStackEasyProps) => ReactNode> = {
  name: 'Easy mode slotProps overrides',
  args: {
    triggerLabel: 'Open settings',
    pages: EASY_PAGES,
    slotProps: {
      trigger: { className: 'easy-trigger-class' },
      content: { className: 'easy-content-class' },
      title: { className: 'easy-title-class' },
      back: { className: 'easy-back-class' },
      close: { className: 'easy-close-class' },
      footer: { className: 'easy-footer-class' },
    },
  },
  render: (args) => <DialogStack {...args} />,
  play: async ({ canvasElement, userEvent }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button', { name: 'Open settings' });
    await expect(trigger).toHaveClass('easy-trigger-class');
    await userEvent.click(trigger);
    const shell = await canvas.findByRole('dialog');
    const panel = activePanel(canvasElement);
    await expect(panel).toHaveClass('easy-content-class');
    await expect(within(shell).getByRole('heading', { name: 'Settings' })).toHaveClass('easy-title-class');
    await expect(within(shell).getByRole('button', { name: 'Close settings' })).toHaveClass('easy-close-class');

    // Go to account page to verify back and footer
    await userEvent.click(within(shell).getByRole('button', { name: 'Account settings' }));
    await waitFor(() => expect(within(shell).getByRole('button', { name: 'Back to Settings' })).toHaveClass('easy-back-class'));
    const footer = canvasElement.ownerDocument.querySelector('[data-ui="dialog-stack-footer"]');
    await expect(footer).toHaveClass('easy-footer-class');

    // Clean up modal by closing
    requestEscape(shell);
    await waitFor(() => expect(within(shell).getByRole('heading', { name: 'Settings' })).toBeVisible());
    const closeBtn = within(shell).getByRole('button', { name: 'Close settings' });
    await userEvent.click(closeBtn);
    await expectStackClosed(canvasElement, trigger);
  },
};

function easyModeTypeContracts() {
  // @ts-expect-error Presentation mode rejects compound children.
  <DialogStack triggerLabel="Open" pages={EASY_PAGES}>Compound</DialogStack>;
  // @ts-expect-error Presentation mode requires pages.
  <DialogStack triggerLabel="Open" />;
  // @ts-expect-error Page record requires value, title, and content.
  <DialogStack triggerLabel="Open" pages={[{ value: 'settings' }]} />;
  // @ts-expect-error Named presentation props cannot leak into compound mode.
  <DialogStack pages={EASY_PAGES}><DialogStack.Content value="s" /></DialogStack>;
}
void easyModeTypeContracts;

export const Compound: Story = {
  name: 'Compound anatomy',
  render: (args) => <Levels {...args} />,
  play: async ({ args, canvasElement, userEvent }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button', { name: 'Settings' });
    await expect(canvas.queryByRole('dialog')).toBeNull();
    await expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');

    await userEvent.click(trigger);
    const shell = await canvas.findByRole('dialog');
    await expect(shell).toBe(layer(canvasElement));
    await expect(shell).toHaveAttribute('aria-modal', 'true');
    await expect(shell).toHaveAccessibleName('Settings');
    await expect(shell).toHaveAccessibleDescription('Manage your workspace preferences.');
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    // The active panel is a plain region of the one modal dialog, never a nested dialog.
    await expect(activePanel(canvasElement)).not.toHaveAttribute('role');
    await waitFor(() => expect(within(shell).getByRole('heading', { name: 'Settings' })).toHaveFocus());
    await waitFor(() => expect(canvasElement.ownerDocument.documentElement.style.overflow).toBe('hidden'));
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith(['settings']);

    requestEscape(shell);
    await expectStackClosed(canvasElement, trigger);
    await expect(args.onValueChange).toHaveBeenCalledTimes(2);
    await expect(args.onValueChange).toHaveBeenLastCalledWith([]);
  },
};

export const TwoLevels: Story = {
  render: (args) => <Levels {...args} />,
  play: async ({ args, canvasElement, userEvent }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Settings' }));
    const shell = await canvas.findByRole('dialog');
    const settings = panelTitled(canvasElement, 'Settings');
    await userEvent.type(within(shell).getByRole('textbox', { name: 'Workspace name' }), 'Northwind');
    const accountTrigger = within(shell).getByRole('button', { name: 'Account' });
    await userEvent.click(accountTrigger);
    await expectActive(canvasElement, 'Account');
    await expect(args.onValueChange).toHaveBeenLastCalledWith(['settings', 'account']);

    // One dialog, named by the top sheet; the parent stays mounted, inert and hidden.
    await expect(shell).toHaveAccessibleName('Account');
    await expect(shell).toHaveAccessibleDescription('Sign-in details for this workspace.');
    await expect(settings).toHaveAttribute('data-state', 'parent');
    await expect(settings).toHaveAttribute('aria-hidden', 'true');
    await expect(settings.inert).toBe(true);
    await expect(canvas.queryAllByRole('dialog')).toHaveLength(1);
    await expect(within(shell).queryByRole('textbox', { name: 'Workspace name' })).toBeNull();
    await waitFor(() => expect(within(shell).getByRole('heading', { name: 'Account' })).toHaveFocus());

    // Back pops once and returns focus to the exact control that opened the sheet; parent state survives.
    await userEvent.click(within(shell).getByRole('button', { name: 'Back to Settings' }));
    await expectActive(canvasElement, 'Settings');
    await waitFor(() => expect(accountTrigger).toHaveFocus());
    await expect(settings.inert).toBe(false);
    await expect(settings).not.toHaveAttribute('aria-hidden');
    await expect(within(shell).getByRole('textbox', { name: 'Workspace name' })).toHaveValue('Northwind');
    await expect(args.onValueChange).toHaveBeenCalledTimes(3);
    await expect(args.onValueChange).toHaveBeenLastCalledWith(['settings']);
  },
};

export const ThreeLevels: Story = {
  render: (args) => <Levels {...args} />,
  play: async ({ args, canvasElement, userEvent }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button', { name: 'Settings' });
    await userEvent.click(trigger);
    const shell = await canvas.findByRole('dialog');
    await userEvent.click(within(shell).getByRole('button', { name: 'Account' }));
    await expectActive(canvasElement, 'Account');
    const passwordTrigger = within(shell).getByRole('button', { name: 'Change password' });
    await userEvent.click(passwordTrigger);
    await expectActive(canvasElement, 'Change password');
    await expect(panels(canvasElement).map((panel) => panel.dataset.depth)).toEqual(['2', '1', '0']);

    // Escape pops the top sheet only.
    requestEscape(shell);
    await expectActive(canvasElement, 'Account');
    await waitFor(() => expect(passwordTrigger).toHaveFocus());
    await expect(shell).toHaveAttribute('open');
    await expect(args.onValueChange).toHaveBeenLastCalledWith(['settings', 'account']);

    // Close clears every level at once and returns to the outer invoker.
    await userEvent.click(within(activePanel(canvasElement)!).getByRole('button', { name: 'Close all' }));
    await expectStackClosed(canvasElement, trigger);
    await expect((args.onValueChange as Mock).mock.calls).toEqual([
      [['settings']],
      [['settings', 'account']],
      [['settings', 'account', 'password']],
      [['settings', 'account']],
      [[]],
    ]);
  },
};

/** Parents peek above the active sheet by at least one peek per level. */
async function expectPeeks(canvasElement: HTMLElement, peek: number) {
  const [settings, account, password] = panels(canvasElement);
  await settle(layer(canvasElement));
  await waitFor(() => expect(rect(account!).top).toBeLessThanOrEqual(rect(password!).top - peek + 1));
  await expect(rect(settings!).top).toBeLessThanOrEqual(rect(account!).top - peek + 1);
}

export const Sheet: Story = {
  tags: ['!autodocs'],
  args: { variant: 'sheet', defaultValue: ['settings', 'account', 'password'] },
  render: (args) => <Levels {...args} />,
  play: async ({ args, canvasElement }) => {
    const shell = layer(canvasElement);
    await waitFor(() => expect(shell).toHaveAttribute('open'));
    const active = activePanel(canvasElement)!;
    await settle(shell);
    await expect(active).toHaveAttribute('data-variant', 'sheet');
    // Anchored to the bottom edge, at most the breakpoint wide, centered.
    await expect(Math.abs(rect(active).bottom - rect(shell).bottom)).toBeLessThan(1);
    await expect(rect(active).width).toBeLessThanOrEqual(Math.min(BREAKPOINT, rect(shell).width) + 1);
    await expect(Math.abs((rect(active).left + rect(active).right) / 2 - rect(shell).width / 2)).toBeLessThan(1);
    await expectPeeks(canvasElement, SHEET_PEEK);
    await expect(args.onValueChange).not.toHaveBeenCalled();
  },
};

export const DialogLayout: Story = {
  name: 'Dialog',
  tags: ['!autodocs'],
  args: { variant: 'dialog', defaultValue: ['settings', 'account', 'password'] },
  render: (args) => <Levels {...args} />,
  play: async ({ canvasElement }) => {
    const shell = layer(canvasElement);
    await waitFor(() => expect(shell).toHaveAttribute('open'));
    const active = activePanel(canvasElement)!;
    await settle(shell);
    await expect(active).toHaveAttribute('data-variant', 'dialog');
    // Centered on both axes, with the handle hidden.
    await expect(Math.abs((rect(active).top + rect(active).bottom) / 2 - rect(shell).height / 2)).toBeLessThan(1);
    await expect(Math.abs((rect(active).left + rect(active).right) / 2 - rect(shell).width / 2)).toBeLessThan(1);
    await expect(getComputedStyle(active.querySelector('[data-ui="dialog-stack-handle"]')!).display).toBe('none');
    await expectPeeks(canvasElement, DIALOG_PEEK);
  },
};

function ResizableContainer({ children }: { children: (setWidth: (width: number) => void) => ReactNode }) {
  const [width, setWidth] = useState(400);
  return <Container style={{ inlineSize: `min(${width}px, ${STORY_INLINE_CAP})` }}>{children(setWidth)}</Container>;
}
ResizableContainer.displayName = 'ResizableContainer';

export const AutoResize: Story = {
  render: (args) => (
    <ResizableContainer>
      {(setWidth) => (
        <>
          <FixtureButton type="button" onClick={() => setWidth(400)}>
            Narrow
          </FixtureButton>
          <Levels
            {...args}
            contained
            body={
              <FixtureButton type="button" onClick={() => setWidth(BREAKPOINT + 80)}>
                Widen
              </FixtureButton>
            }
          />
        </>
      )}
    </ResizableContainer>
  ),
  play: async ({ args, canvasElement, userEvent }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Settings' }));
    const panel = await canvas.findByRole('dialog', { name: 'Settings' });
    await waitFor(() => expect(panel).toHaveAttribute('data-variant', 'sheet'));
    await expect(rect(layer(canvasElement)).right).toBeLessThanOrEqual(canvasElement.ownerDocument.documentElement.clientWidth);
    const widen = within(panel).getByRole('button', { name: 'Widen' });
    await userEvent.click(widen);
    // Layout follows the measured layer width; DOM, focus and value stay put.
    await waitFor(() => expect(panel).toHaveAttribute('data-variant', rect(layer(canvasElement)).width >= BREAKPOINT ? 'dialog' : 'sheet'));
    await expect(rect(layer(canvasElement)).right).toBeLessThanOrEqual(canvasElement.ownerDocument.documentElement.clientWidth);
    await expect(canvas.getByRole('dialog', { name: 'Settings' })).toBe(panel);
    await expect(widen).toHaveFocus();
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
  },
};

function ContainedFixture(args: LevelsProps) {
  return (
    <Stack>
      <FixtureButton type="button" >
        Page action
      </FixtureButton>
      <Container>
        <Levels {...args} contained />
      </Container>
    </Stack>
  );
}
ContainedFixture.displayName = 'ContainedFixture';

export const Contained: Story = {
  render: (args) => <ContainedFixture {...args} />,
  play: async ({ args, canvasElement, userEvent }) => {
    const canvas = within(canvasElement);
    const doc = canvasElement.ownerDocument;
    const pageAction = canvas.getByRole('button', { name: 'Page action' });
    pageAction.setAttribute('data-inert-probe', '');
    const trigger = canvas.getByRole('button', { name: 'Settings' });
    await userEvent.click(trigger);
    const panel = await canvas.findByRole('dialog', { name: 'Settings' });
    await expect(panel).toHaveAttribute('aria-modal', 'true');
    await expect(panel).toHaveAccessibleDescription('Manage your workspace preferences.');
    await waitFor(() => expect(within(panel).getByRole('heading', { name: 'Settings' })).toHaveFocus());

    // Drawn inside the container, modal for the whole document, without locking page scroll.
    const container = layer(canvasElement).parentElement!;
    await expect(rect(layer(canvasElement)).top).toBeCloseTo(rect(container).top + 1, 0);
    await expect(rect(layer(canvasElement)).width).toBeLessThanOrEqual(rect(container).width);
    await expect(rect(layer(canvasElement)).right).toBeLessThanOrEqual(doc.documentElement.clientWidth);
    await waitFor(() => expect(pageAction.closest('[inert]')).not.toBeNull());
    await expect(doc.documentElement.style.overflow).toBe('');

    await userEvent.click(within(panel).getByRole('button', { name: 'Account' }));
    const account = await canvas.findByRole('dialog', { name: 'Account' });
    await expect(canvas.queryAllByRole('dialog')).toHaveLength(1);
    // Lower panels give up the dialog role, not just visibility.
    await expect(panelTitled(canvasElement, 'Settings')).not.toHaveAttribute('role');

    // Escape (keydown here; there is no native cancel) pops the top sheet only.
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(account.isConnected).toBe(false));
    await expectActive(canvasElement, 'Settings');
    await waitFor(() => expect(within(panel).getByRole('button', { name: 'Account' })).toHaveFocus());

    // The scrim is the backdrop: a press there pops too.
    fireEvent.click(canvasElement.querySelector('[data-ui="dialog-stack-scrim"]')!);
    await waitFor(() => expect(panels(canvasElement)).toHaveLength(0));
    await expect(layer(canvasElement)).toHaveAttribute('hidden');
    await waitFor(() => expect(trigger).toHaveFocus());
    await waitFor(() => expect(pageAction.closest('[inert]')).toBeNull());
    await expect(args.onValueChange).toHaveBeenCalledTimes(4);
    await expect(args.onValueChange).toHaveBeenLastCalledWith([]);
  },
};

export const Nondismissible: Story = {
  render: (args) => <Levels {...args} contentProps={{ account: { dismissible: false } }} />,
  play: async ({ args, canvasElement, userEvent }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Settings' }));
    const shell = await canvas.findByRole('dialog');
    await userEvent.click(within(shell).getByRole('button', { name: 'Account' }));
    await expectActive(canvasElement, 'Account');
    const active = activePanel(canvasElement)!;
    const heading = within(shell).getByRole('heading', { name: 'Account' });
    await waitFor(() => expect(heading).toHaveFocus());

    // Escape and backdrop requests are refused; focus stays; no drag affordance.
    requestEscape(shell);
    fireEvent.click(shell);
    await expect(shell).toHaveAttribute('open');
    await expect(activePanel(canvasElement)).toBe(active);
    await expect(heading).toHaveFocus();
    await expect(active.querySelector('[data-ui="dialog-stack-handle"]')).not.toHaveAttribute('data-draggable');
    await expect(args.onValueChange).toHaveBeenCalledTimes(2);

    // Back stays explicit.
    await userEvent.click(within(shell).getByRole('button', { name: 'Back to Settings' }));
    await expectActive(canvasElement, 'Settings');
    await expect(args.onValueChange).toHaveBeenLastCalledWith(['settings']);
  },
};

function LongCopy() {
  return (
    <>
      {Array.from({ length: 80 }, (_, index) => (
        <Prose key={index} >
          Notification rule {index + 1}: mentions and assigned issues.
        </Prose>
      ))}
    </>
  );
}
LongCopy.displayName = 'LongCopy';

export const Footer: Story = {
  tags: ['!autodocs'],
  args: { defaultValue: ['settings', 'account'] },
  render: (args) => <Levels {...args} footer />,
  play: async ({ canvasElement }) => {
    const shell = layer(canvasElement);
    await waitFor(() => expect(shell).toHaveAttribute('open'));
    const active = activePanel(canvasElement)!;
    const footer = active.querySelector<HTMLElement>('[data-ui="dialog-stack-footer"]')!;
    await settle(shell);
    // Pinned to the panel's bottom edge.
    await expect(Math.abs(rect(footer).bottom - rect(active.querySelector('[data-ui="dialog-stack-body"]')!).bottom)).toBeLessThan(1);
    await expect(within(footer).getByRole('button', { name: 'Done' })).toBeVisible();
  },
};

export const LongBody: Story = {
  tags: ['!autodocs'],
  args: { defaultValue: ['settings', 'account'] },
  render: (args) => <Levels {...args} footer body={<LongCopy />} contentProps={{ account: { children: undefined } }} />,
  play: async ({ canvasElement, userEvent }) => {
    const shell = layer(canvasElement);
    await waitFor(() => expect(shell).toHaveAttribute('open'));
    await settle(shell);
    // The parent's long body is capped by the layer and scrolls inside.
    const settings = panelTitled(canvasElement, 'Settings');
    const body = settings.querySelector<HTMLElement>('[data-ui="dialog-stack-body"]')!;
    await expect(rect(settings).height).toBeLessThanOrEqual(rect(shell).height);
    await expect(body.scrollHeight).toBeGreaterThan(body.clientHeight);
    await userEvent.click(within(activePanel(canvasElement)!).getByRole('button', { name: 'Change password' }));
    await expectActive(canvasElement, 'Change password');
    await settle(shell);
    const active = activePanel(canvasElement)!;
    for (const panel of panels(canvasElement)) {
      await expect(rect(panel).top).toBeGreaterThanOrEqual(rect(shell).top);
      await expect(rect(panel).bottom).toBeLessThanOrEqual(rect(shell).bottom + 1);
      if (panel.dataset.variant === 'dialog') await expect(panel.offsetHeight).toBe(active.offsetHeight);
    }
  },
};

export const LongBodyFooter: Story = {
  tags: ['!autodocs'],
  args: { defaultValue: ['settings'] },
  render: (args) => (
    <DialogStack {...args}>
      <DialogStack.Content value="settings">
        <DialogStack.Title>Notifications</DialogStack.Title>
        <LongCopy />
        <DialogStack.Footer>
          <DialogStack.Close label="Save notifications">Save</DialogStack.Close>
        </DialogStack.Footer>
      </DialogStack.Content>
    </DialogStack>
  ),
  play: async ({ canvasElement }) => {
    const shell = layer(canvasElement);
    await waitFor(() => expect(shell).toHaveAttribute('open'));
    await settle(shell);
    const active = activePanel(canvasElement)!;
    const body = active.querySelector<HTMLElement>('[data-ui="dialog-stack-body"]')!;
    const footer = active.querySelector<HTMLElement>('[data-ui="dialog-stack-footer"]')!;
    // The body scrolls; the footer and the heading's container stay inside the panel.
    await expect(body.scrollHeight).toBeGreaterThan(body.clientHeight);
    await expect(rect(footer).bottom).toBeLessThanOrEqual(rect(active).bottom + 1);
    body.scrollTop = body.scrollHeight;
    await waitFor(() => expect(rect(footer).bottom).toBeLessThanOrEqual(rect(active).bottom + 1));
    await expect(rect(active).top).toBeGreaterThanOrEqual(rect(shell).top);
  },
};

export const EmptyBody: Story = {
  render: (args) => (
    <DialogStack {...args}>
      <DialogStack.Trigger value="empty">Open empty</DialogStack.Trigger>
      <DialogStack.Content value="empty" aria-label="Empty sheet" />
    </DialogStack>
  ),
  play: async ({ canvasElement, userEvent }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button', { name: 'Open empty' });
    await userEvent.click(trigger);
    const shell = await canvas.findByRole('dialog', { name: 'Empty sheet' });
    // No heading or control: the panel itself takes focus.
    await waitFor(() => expect(activePanel(canvasElement)).toHaveFocus());
    requestEscape(shell);
    await expectStackClosed(canvasElement, trigger);
  },
};

export const Light: Story = {
  tags: ['!autodocs'],
  args: { defaultValue: ['settings', 'account'] },
  globals: { theme: 'light' },
  decorators: [withLightTheme],
  render: (args) => <Levels {...args} footer />,
  play: async ({ canvasElement }) => {
    await waitFor(() => expect(layer(canvasElement)).toHaveAttribute('open'));
    await expectThemedSurface(activePanel(canvasElement)!, 'light');
    await expectThemedSurface(panelTitled(canvasElement, 'Settings'), 'light');
  },
};

export const PersistentTwoLevels: Story = {
  tags: ['!autodocs'],
  args: { defaultValue: ['settings', 'account'] },
  render: (args) => <Levels {...args} footer />,
  play: async ({ canvasElement }) => {
    await waitFor(() => expect(layer(canvasElement)).toHaveAttribute('open'));
    await expectActive(canvasElement, 'Account');
    await expectThemedSurface(activePanel(canvasElement)!, 'dark');
  },
};

export const PersistentContained: Story = {
  tags: ['!autodocs'],
  args: { defaultValue: ['settings', 'account'] },
  render: (args) => <ContainedFixture {...args} />,
  play: async ({ canvasElement }) => {
    const panel = await within(canvasElement).findByRole('dialog', { name: 'Account' });
    await expect(panel).toHaveAttribute('aria-modal', 'true');
    await waitFor(() => expect(within(canvasElement).getByRole('button', { name: 'Page action', hidden: true }).closest('[inert]')).not.toBeNull());
  },
};

export const ControlledReject: Story = {
  tags: ['!autodocs'],
  args: { value: ['settings'] },
  render: (args) => <Levels {...args} />,
  play: async ({ args, canvasElement, userEvent }) => {
    const shell = layer(canvasElement);
    await waitFor(() => expect(shell).toHaveAttribute('open'));
    const settings = activePanel(canvasElement)!;
    const accountTrigger = within(settings).getByRole('button', { name: 'Account' });

    // The parent never applies requests: push, Escape, backdrop and Close each ask once and change nothing.
    await userEvent.click(accountTrigger);
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith(['settings', 'account']);
    await expect(panels(canvasElement)).toEqual([settings]);
    await expect(accountTrigger).toHaveFocus();

    requestEscape(shell);
    await expect(args.onValueChange).toHaveBeenCalledTimes(2);
    await expect(args.onValueChange).toHaveBeenLastCalledWith([]);
    fireEvent.click(shell);
    await expect(args.onValueChange).toHaveBeenCalledTimes(3);
    await userEvent.click(within(settings).getByRole('button', { name: 'Close all' }));
    await expect(args.onValueChange).toHaveBeenCalledTimes(4);
    await expect(args.onValueChange).toHaveBeenLastCalledWith([]);
    await expect(shell).toHaveAttribute('open');
    await expect(activePanel(canvasElement)).toBe(settings);
    await expect(canvasElement.ownerDocument.documentElement.style.overflow).toBe('hidden');
  },
};

export const NativeFormClose: Story = {
  tags: ['!autodocs'],
  args: { value: ['settings'] },
  render: (args) => (
    <Levels
      {...args}
      body={
        <form method="dialog">
          <FixtureButton type="submit" >
            Apply
          </FixtureButton>
        </form>
      }
    />
  ),
  play: async ({ args, canvasElement, userEvent }) => {
    const canvas = within(canvasElement);
    const { documentElement } = canvasElement.ownerDocument;
    const shell = layer(canvasElement);
    await waitFor(() => expect(documentElement.style.overflow).toBe('hidden'));
    // A native form close cannot be vetoed: it requests a clear; the rejecting parent keeps the
    // stack, and the closed shell still releases the scroll lock.
    await userEvent.click(within(shell).getByRole('button', { name: 'Apply' }));
    await waitFor(() => expect(shell).not.toHaveAttribute('open'));
    await waitFor(() => expect(args.onValueChange).toHaveBeenCalledTimes(1));
    await expect(args.onValueChange).toHaveBeenLastCalledWith([]);
    await waitFor(() => expect(documentElement.style.overflow).toBe(''));

    // The next explicit open request repairs the native modal without echoing a callback.
    await userEvent.click(canvas.getByRole('button', { name: 'Settings' }));
    await waitFor(() => expect(shell).toHaveAttribute('open'));
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(documentElement.style.overflow).toBe('hidden'));
  },
};

export const ShellClose: Story = {
  render: (args) => <Levels {...args} />,
  play: async ({ args, canvasElement, userEvent }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button', { name: 'Settings' });
    await userEvent.click(trigger);
    const shell = (await canvas.findByRole('dialog')) as HTMLDialogElement;
    await userEvent.click(within(shell).getByRole('button', { name: 'Account' }));
    await expectActive(canvasElement, 'Account');
    // Internal path: a direct close of the shell reconciles to one clear request.
    shell.close();
    await expectStackClosed(canvasElement, trigger);
    await expect(args.onValueChange).toHaveBeenCalledTimes(3);
    await expect(args.onValueChange).toHaveBeenLastCalledWith([]);
  },
};

const cancelSpy = fn<(event: Event) => void>();

export const CancelVeto: Story = {
  render: (args) => (
    <Levels
      {...args}
      contentProps={{
        settings: {
          onCancel: (event) => {
            cancelSpy(event);
            event.preventDefault();
          },
        },
      }}
    />
  ),
  play: async ({ args, canvasElement, userEvent }) => {
    cancelSpy.mockClear();
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Settings' }));
    const shell = await canvas.findByRole('dialog');
    requestEscape(shell);
    fireEvent.click(shell);
    await expect(cancelSpy).toHaveBeenCalledTimes(2);
    await expect(cancelSpy.mock.calls[0]![0].cancelable).toBe(true);
    await expect(shell).toHaveAttribute('open');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);

    // Close is explicit, not a dismissal request: the veto does not apply.
    await userEvent.click(within(shell).getByRole('button', { name: 'Close all' }));
    await waitFor(() => expect(shell).not.toHaveAttribute('open'));
    await expect(cancelSpy).toHaveBeenCalledTimes(2);
    await expect(args.onValueChange).toHaveBeenLastCalledWith([]);
  },
};

export const ExternalARIA: Story = {
  tags: ['!autodocs'],
  args: { defaultValue: ['settings'] },
  render: (args) => (
    <>
      <span id="sheet-external-label">Workspace</span>
      <span id="sheet-external-description">Changes apply to every member.</span>
      <Levels
        {...args}
        contentProps={{
          settings: {
            'aria-labelledby': 'sheet-external-label sheet-unresolved',
            'aria-describedby': 'sheet-external-description sheet-unresolved',
          },
        }}
      />
    </>
  ),
  play: async ({ canvasElement }) => {
    const shell = layer(canvasElement);
    await waitFor(() => expect(shell).toHaveAttribute('open'));
    const title = within(shell).getByRole('heading', { name: 'Settings' });
    const description = within(shell).getByText('Manage your workspace preferences.');
    // Consumer IDREFs stay, unresolved ones included; the internal ids are appended on the shell.
    await waitFor(() =>
      expect(shell).toHaveAttribute('aria-labelledby', `sheet-external-label sheet-unresolved ${title.id}`),
    );
    await expect(shell).toHaveAttribute('aria-describedby', `sheet-external-description sheet-unresolved ${description.id}`);
    await expect(shell).toHaveAccessibleName('Workspace Settings');
    await expect(shell).toHaveAccessibleDescription('Changes apply to every member. Manage your workspace preferences.');
    // The panel is a plain div: the relationship is not duplicated on it.
    await expect(activePanel(canvasElement)).not.toHaveAttribute('aria-labelledby');
  },
};

export const WithoutDescription: Story = {
  tags: ['!autodocs'],
  args: { defaultValue: ['settings'] },
  render: (args) => <Levels {...args} contentProps={{ settings: { withDescription: false } }} />,
  play: async ({ canvasElement }) => {
    const shell = layer(canvasElement);
    await waitFor(() => expect(shell).toHaveAccessibleName('Settings'));
    await settle(shell);
    await expect(shell).not.toHaveAttribute('aria-describedby');
    await expect(within(shell).getByText('Manage your workspace preferences.')).toBeVisible();
  },
};

const FALSY_CONTENT = [0, false, null, ''] as const;

export const FalsyContent: Story = {
  // Excluded from the docs page: open contained stacks make the rest of the document inert.
  tags: ['!autodocs'],
  render: (args) => (
    <>
      {FALSY_CONTENT.map((value) => (
        <DialogStack key={String(value)} {...args} contained defaultValue={['sheet']}>
          <CompactContainer data-value={JSON.stringify(value)}>
            <DialogStack.Content value="sheet" aria-label={`Sheet ${JSON.stringify(value)}`}>
              <DialogStack.Title>{value}</DialogStack.Title>
              <DialogStack.Description>{value}</DialogStack.Description>
              <DialogStack.Footer>{value}</DialogStack.Footer>
            </DialogStack.Content>
          </CompactContainer>
        </DialogStack>
      ))}
    </>
  ),
  play: async ({ canvasElement }) => {
    const all = await waitFor(() => {
      const found = Array.from(canvasElement.querySelectorAll<HTMLElement>('[data-ui="dialog-stack"]'));
      expect(found).toHaveLength(FALSY_CONTENT.length);
      return found;
    });
    const byLabel = (label: string) => all.find((panel) => panel.getAttribute('aria-label') === label)!;
    // 0 is content: Title and Description render and wire up; the Footer keeps it.
    const zeroPanel = byLabel('Sheet 0');
    const title = zeroPanel.querySelector('[data-ui="dialog-stack-title"]')!;
    const description = zeroPanel.querySelector('[data-ui="dialog-stack-description"]')!;
    await expect(title).toHaveTextContent('0');
    await expect(description).toHaveTextContent('0');
    await expect(zeroPanel.querySelector('[data-ui="dialog-stack-footer"]')).toHaveTextContent('0');
    await waitFor(() => expect(zeroPanel).toHaveAttribute('aria-labelledby', title.id));
    await expect(zeroPanel).toHaveAttribute('aria-describedby', description.id);
    // false, null and '' render no Title/Description and leave no relationship behind.
    for (const label of ['Sheet false', 'Sheet null', 'Sheet ""']) {
      const panel = byLabel(label);
      await expect(panel.querySelector('[data-ui="dialog-stack-title"], [data-ui="dialog-stack-description"]')).toBeNull();
      await expect(panel).not.toHaveAttribute('aria-labelledby');
      await expect(panel).not.toHaveAttribute('aria-describedby');
    }
  },
};

/** Exercises the hook actions; buttons sit inside the sheet so they stay operable. */
function HookControls() {
  const { value, push, pop, popTo, close } = useDialogStack();
  return (
    <WrappingRow>
      <output>{value.join(' > ')}</output>
      <FixtureButton type="button" onClick={() => push('account')}>
        push account
      </FixtureButton>
      <FixtureButton type="button" onClick={() => push('password')}>
        push password
      </FixtureButton>
      <FixtureButton type="button" onClick={() => push('missing')}>
        push missing
      </FixtureButton>
      <FixtureButton type="button" onClick={() => push('settings')}>
        push settings
      </FixtureButton>
      <FixtureButton type="button" onClick={() => popTo('account')}>
        popTo account
      </FixtureButton>
      <FixtureButton type="button" onClick={() => popTo('missing')}>
        popTo missing
      </FixtureButton>
      <FixtureButton type="button" onClick={pop}>
        pop
      </FixtureButton>
      <FixtureButton type="button" onClick={close}>
        close
      </FixtureButton>
    </WrappingRow>
  );
}
HookControls.displayName = 'HookControls';

function HookFixture(props: Omit<DialogStackCompoundProps, 'children'>) {
  return (
    <DialogStack {...props}>
      {['settings', 'account', 'password'].map((key) => (
        <DialogStack.Content key={key} value={key}>
          <DialogStack.Title>{key}</DialogStack.Title>
          <HookControls />
        </DialogStack.Content>
      ))}
      <HookOutside />
    </DialogStack>
  );
}
HookFixture.displayName = 'HookFixture';

function HookOutside() {
  const { pop, push } = useDialogStack();
  return (
    <Row>
      <FixtureButton type="button" onClick={() => push('settings')}>
        Open settings
      </FixtureButton>
      <FixtureButton type="button" onClick={pop}>
        Pop empty
      </FixtureButton>
    </Row>
  );
}
HookOutside.displayName = 'HookOutside';

export const HookActions: Story = {
  render: (args) => <HookFixture {...args} />,
  play: async ({ args, canvasElement, userEvent }) => {
    const warn = spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const canvas = within(canvasElement);
      const button = (name: string) => within(activePanel(canvasElement)!).getByRole('button', { name });
      // Pop on an empty stack: no request.
      await userEvent.click(canvas.getByRole('button', { name: 'Pop empty' }));
      await expect(args.onValueChange).not.toHaveBeenCalled();

      await userEvent.click(canvas.getByRole('button', { name: 'Open settings' }));
      await expectActive(canvasElement, 'settings');
      for (const control of within(activePanel(canvasElement)!).getAllByRole('button')) {
        await expect(rect(control).height).toBeGreaterThanOrEqual(Number.parseFloat(base.space[8]));
        await expect(rect(control).width).toBeGreaterThanOrEqual(Number.parseFloat(base.space[6]));
      }
      await userEvent.click(button('push account'));
      await expectActive(canvasElement, 'account');
      await userEvent.click(button('push password'));
      await expectActive(canvasElement, 'password');

      // Unknown keys: no-op with a development warning.
      await userEvent.click(button('push missing'));
      await userEvent.click(button('popTo missing'));
      await expect(warn).toHaveBeenCalledTimes(2);
      await expect(args.onValueChange).toHaveBeenCalledTimes(3);

      // popTo truncates; pushing an open key truncates back to it.
      await userEvent.click(button('popTo account'));
      await expectActive(canvasElement, 'account');
      // Pushing the top key again is no change: no callback.
      await userEvent.click(button('push account'));
      await expect(args.onValueChange).toHaveBeenCalledTimes(4);
      await userEvent.click(button('push settings'));
      await expectActive(canvasElement, 'settings');
      await userEvent.click(button('pop'));
      await waitFor(() => expect(panels(canvasElement)).toHaveLength(0));
      await expect((args.onValueChange as Mock).mock.calls).toEqual([
        [['settings']],
        [['settings', 'account']],
        [['settings', 'account', 'password']],
        [['settings', 'account']],
        [['settings']],
        [[]],
      ]);
    } finally {
      warn.mockRestore();
    }
  },
};

export const NormalizedDefault: Story = {
  tags: ['!autodocs'],
  render: (args) => (
    <HookFixture {...args} defaultValue={['settings', 'missing', 'settings', 'account']} />
  ),
  play: async ({ args, canvasElement, userEvent }) => {
    // Rendered with the warning already issued; the stack shows the known unique keys in order.
    await expectActive(canvasElement, 'account');
    await expect(panels(canvasElement).map((panel) => panel.dataset.depth)).toEqual(['1', '0']);
    await expect(args.onValueChange).not.toHaveBeenCalled();
    // The next request carries the normalized stack.
    await userEvent.click(within(activePanel(canvasElement)!).getByRole('button', { name: 'pop' }));
    await expectActive(canvasElement, 'settings');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith(['settings']);
  },
};

function RemovableFixture(props: Omit<DialogStackCompoundProps, 'children'>) {
  const [mounted, setMounted] = useState(true);
  return (
    <DialogStack {...props}>
      <DialogStack.Trigger value="settings">Settings</DialogStack.Trigger>
      <DialogStack.Content value="settings">
        <DialogStack.Title>Settings</DialogStack.Title>
        <DialogStack.Trigger value="account">Account</DialogStack.Trigger>
      </DialogStack.Content>
      {mounted && (
        <DialogStack.Content value="account">
          <DialogStack.Title>Account</DialogStack.Title>
          <FixtureButton type="button" onClick={() => setMounted(false)}>
            Remove sheet
          </FixtureButton>
        </DialogStack.Content>
      )}
    </DialogStack>
  );
}
RemovableFixture.displayName = 'RemovableFixture';

export const RemovedActiveSheet: Story = {
  render: (args) => <RemovableFixture {...args} />,
  play: async ({ args, canvasElement, userEvent }) => {
    const warn = spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const canvas = within(canvasElement);
      await userEvent.click(canvas.getByRole('button', { name: 'Settings' }));
      const shell = await canvas.findByRole('dialog');
      const accountTrigger = within(shell).getByRole('button', { name: 'Account' });
      await userEvent.click(accountTrigger);
      await expectActive(canvasElement, 'Account');
      // Removing the active declaration falls back to the last retained sheet, without a callback.
      await userEvent.click(within(shell).getByRole('button', { name: 'Remove sheet' }));
      await expectActive(canvasElement, 'Settings');
      await waitFor(() => expect(accountTrigger).toHaveFocus());
      await expect(args.onValueChange).toHaveBeenCalledTimes(2);
      await expect(shell).toHaveAttribute('open');
    } finally {
      warn.mockRestore();
    }
  },
};

export const KeyboardNavigation: Story = {
  render: (args) => (
    <>
      <FixtureButton type="button" >
        Before
      </FixtureButton>
      <Levels {...args} />
    </>
  ),
  play: async ({ args, canvasElement, userEvent }) => {
    const canvas = within(canvasElement);
    const doc = canvasElement.ownerDocument;
    const trigger = canvas.getByRole('button', { name: 'Settings' });
    await userEvent.click(canvas.getByRole('button', { name: 'Before' }));
    await userEvent.tab();
    await expectFocusRing(trigger);

    await userEvent.keyboard('{Enter}');
    const shell = await canvas.findByRole('dialog');
    await waitFor(() => expect(within(shell).getByRole('heading', { name: 'Settings' })).toHaveFocus());
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);

    // Tab and Shift+Tab move through the top sheet only.
    await userEvent.tab();
    await expect(doc.activeElement).toBe(within(shell).getByRole('button', { name: 'Close all' }));
    await expectFocusRing(doc.activeElement as HTMLElement);
    await userEvent.tab();
    await expect(doc.activeElement).toBe(within(shell).getByRole('textbox', { name: 'Workspace name' }));
    await userEvent.tab();
    const accountTrigger = within(shell).getByRole('button', { name: 'Account' });
    await expectFocusRing(accountTrigger);
    await userEvent.tab({ shift: true });
    await expect(doc.activeElement).toBe(within(shell).getByRole('textbox', { name: 'Workspace name' }));
    await userEvent.tab();

    // Space pushes once; the parent leaves the tab sequence.
    await userEvent.keyboard(' ');
    await expectActive(canvasElement, 'Account');
    await expect(args.onValueChange).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(within(shell).getByRole('heading', { name: 'Account' })).toHaveFocus());
    await expect(shell.matches(':modal')).toBe(true);
    const back = within(shell).getByRole('button', { name: 'Back to Settings' });
    await userEvent.tab();
    await expectFocusRing(within(shell).getByRole('button', { name: 'Change password' }));
    within(shell).getByRole('heading', { name: 'Account' }).focus();
    await userEvent.tab({ shift: true });
    await userEvent.tab({ shift: true });
    await expectFocusRing(back);
    // The synthetic tab() does not model the top layer; the platform's modal state and the inert
    // parent do: neither the page nor the parent sheet can take focus. Real Tab wrapping is browser QA.
    accountTrigger.focus();
    await expect(doc.activeElement).toBe(back);
    canvas.getByRole('button', { name: 'Before', hidden: true }).focus();
    await expect(doc.activeElement).toBe(back);

    // Enter on Back pops once and returns to the invoker.
    back.focus();
    await userEvent.keyboard('{Enter}');
    await expectActive(canvasElement, 'Settings');
    await waitFor(() => expect(accountTrigger).toHaveFocus());
    await expectFocusRing(accountTrigger);
    await expect(args.onValueChange).toHaveBeenCalledTimes(3);

    // Space on Close clears once.
    within(shell).getByRole('button', { name: 'Close all' }).focus();
    await userEvent.keyboard(' ');
    await expectStackClosed(canvasElement, trigger);
    await expect(args.onValueChange).toHaveBeenCalledTimes(4);
    await expect(args.onValueChange).toHaveBeenLastCalledWith([]);
  },
};

export const TriggerDefaultPrevented: Story = {
  render: (args) => (
    <DialogStack {...args}>
      <DialogStack.Trigger value="settings" onClick={(event) => event.preventDefault()}>
        Settings
      </DialogStack.Trigger>
      <DialogStack.Content value="settings">
        <DialogStack.Title>Settings</DialogStack.Title>
      </DialogStack.Content>
    </DialogStack>
  ),
  play: async ({ args, canvasElement, userEvent }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Settings' }));
    await expect(layer(canvasElement)).not.toHaveAttribute('open');
    await expect(args.onValueChange).not.toHaveBeenCalled();
  },
};

export const ActionsDefaultPrevented: Story = {
  tags: ['!autodocs'],
  args: { defaultValue: ['settings', 'account'] },
  render: (args) => (
    <DialogStack {...args}>
      <DialogStack.Content value="settings">
        <DialogStack.Title>Settings</DialogStack.Title>
      </DialogStack.Content>
      <DialogStack.Content value="account">
        <DialogStack.Back label="Back to Settings" onClick={(event) => event.preventDefault()} />
        <DialogStack.Title>Account</DialogStack.Title>
        <DialogStack.Close label="Close all" onClick={(event) => event.preventDefault()} />
      </DialogStack.Content>
    </DialogStack>
  ),
  play: async ({ args, canvasElement, userEvent }) => {
    const shell = layer(canvasElement);
    await waitFor(() => expect(shell).toHaveAttribute('open'));
    const active = activePanel(canvasElement)!;
    // Consumer handlers run first; preventDefault skips the request.
    await userEvent.click(within(active).getByRole('button', { name: 'Back to Settings' }));
    await userEvent.click(within(active).getByRole('button', { name: 'Close all' }));
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await expect(activePanel(canvasElement)).toBe(active);
  },
};

/** Drag the handle: one pointer, explicit client Y values, `pause` ms between moves. */
async function drag(handle: HTMLElement, points: number[], pause = 0, end: 'up' | 'cancel' = 'up') {
  const x = rect(handle).left + rect(handle).width / 2;
  const init = { pointerId: 1, pointerType: 'mouse', isPrimary: true, button: 0 } as const;
  const [first, ...rest] = points;
  fireEvent.pointerDown(handle, { ...init, clientX: x, clientY: first! });
  for (const y of rest) {
    if (pause) await new Promise((resolve) => setTimeout(resolve, pause));
    fireEvent.pointerMove(handle, { ...init, clientX: x, clientY: y });
  }
  const last = points.at(-1)!;
  if (end === 'up') fireEvent.pointerUp(handle, { ...init, clientX: x, clientY: last });
  else fireEvent.pointerCancel(handle, { ...init, clientX: x, clientY: last });
}

async function expectHome(panel: HTMLElement) {
  await waitFor(() => expect(panel.style.translate).toBe(''), { timeout: 2000 });
}

export const Drag: Story = {
  tags: ['!autodocs'],
  args: { variant: 'sheet', defaultValue: ['settings', 'account'] },
  render: (args) => <Levels {...args} />,
  play: async ({ args, canvasElement }) => {
    const shell = layer(canvasElement);
    await waitFor(() => expect(shell).toHaveAttribute('open'));
    await settle(shell);
    const account = activePanel(canvasElement)!;
    const handle = account.querySelector<HTMLElement>('[data-ui="dialog-stack-handle"]')!;
    await expect(handle).toHaveAttribute('data-draggable');
    await expect(rect(handle).height).toBeGreaterThanOrEqual(32 - 0.5);
    const top = rect(handle).top + 4;
    const height = rect(account).height;

    // Body content never starts a drag.
    const body = account.querySelector<HTMLElement>('[data-ui="dialog-stack-body"]')!;
    fireEvent.pointerDown(body, { pointerId: 1, isPrimary: true, button: 0, clientY: top + 40 });
    fireEvent.pointerMove(body, { pointerId: 1, isPrimary: true, clientY: top + 200 });
    fireEvent.pointerUp(body, { pointerId: 1, isPrimary: true, clientY: top + 200 });
    await expect(account.style.translate).toBe('');

    // Short, slow drag: springs home, no request.
    await drag(handle, [top, top + height * 0.1, top + height * 0.2], 150);
    await expectHome(account);
    // Upward travel is resisted and never changes state.
    await drag(handle, [top, top - 100], 0, 'cancel');
    await expectHome(account);
    // pointercancel past the threshold restores the stack.
    await drag(handle, [top, top + height * 0.6], 0, 'cancel');
    await expectHome(account);
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await expect(account.isConnected).toBe(true);

    // Past the distance threshold: one pop.
    await drag(handle, [top, top + height * 0.2, top + height * 0.5], 150);
    await expectActive(canvasElement, 'Settings');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith(['settings']);

    // A short fling pops too.
    const settings = activePanel(canvasElement)!;
    const settingsHandle = settings.querySelector<HTMLElement>('[data-ui="dialog-stack-handle"]')!;
    const start = rect(settingsHandle).top + 4;
    await drag(settingsHandle, [start, start + 10, start + 40]);
    await waitFor(() => expect(panels(canvasElement)).toHaveLength(0));
    await expect(args.onValueChange).toHaveBeenCalledTimes(2);
    await expect(args.onValueChange).toHaveBeenLastCalledWith([]);
  },
};

export const NoDrag: Story = {
  tags: ['!autodocs'],
  args: { variant: 'sheet', defaultValue: ['settings'] },
  render: (args) => <Levels {...args} contentProps={{ settings: { 'data-sheet-no-drag': '' } as Partial<DialogStackContentProps> }} />,
  play: async ({ args, canvasElement }) => {
    const shell = layer(canvasElement);
    await waitFor(() => expect(shell).toHaveAttribute('open'));
    const panel = activePanel(canvasElement)!;
    const handle = panel.querySelector<HTMLElement>('[data-ui="dialog-stack-handle"]')!;
    await expect(handle).not.toHaveAttribute('data-draggable');
    const top = rect(handle).top + 4;
    await drag(handle, [top, top + 200, top + 400]);
    await expect(panel.style.translate).toBe('');
    await expect(args.onValueChange).not.toHaveBeenCalled();
    // Back/Close stay functional without physics.
    await expect(within(panel).getByRole('button', { name: 'Close all' })).toBeEnabled();
  },
};

function NestedPopoverBody() {
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  return (
    <ThemeRoot portalContainer={host}>
      <Popover>
        <Popover.Trigger>Member options</Popover.Trigger>
        <Popover.Content aria-label="Member options">
          <FixtureButton type="button" >
            Make admin
          </FixtureButton>
        </Popover.Content>
      </Popover>
      <div ref={setHost} />
    </ThemeRoot>
  );
}
NestedPopoverBody.displayName = 'NestedPopoverBody';

export const NestedPopover: Story = {
  render: (args) => <Levels {...args} body={<NestedPopoverBody />} />,
  play: async ({ args, canvasElement, userEvent }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Settings' }));
    const shell = await canvas.findByRole('dialog', { name: 'Settings' });
    await userEvent.click(within(shell).getByRole('button', { name: 'Member options' }));
    const popover = await within(shell).findByRole('dialog', { name: 'Member options' });
    await expect(shell.contains(popover)).toBe(true);

    // Escape held down: the popover closes; the native cancel for that keystroke keeps the sheet.
    await userEvent.keyboard('{Escape>}');
    await waitFor(() => expect(within(shell).queryByRole('dialog', { name: 'Member options' })).toBeNull());
    requestEscape(shell);
    await userEvent.keyboard('{/Escape}');
    await expect(shell).toHaveAttribute('open');
    await expect(panels(canvasElement)).toHaveLength(1);
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);

    // The next Escape pops the sheet.
    await userEvent.keyboard('{Escape>}');
    requestEscape(shell);
    await userEvent.keyboard('{/Escape}');
    await waitFor(() => expect(panels(canvasElement)).toHaveLength(0));
    await expect(args.onValueChange).toHaveBeenCalledTimes(2);
  },
};

function NestedDialogBody() {
  return (
    <Dialog>
      <Dialog.Trigger>Reset workspace</Dialog.Trigger>
      <Dialog.Content>
        <Dialog.Title>Reset workspace?</Dialog.Title>
        <Dialog.Close>Cancel</Dialog.Close>
      </Dialog.Content>
    </Dialog>
  );
}
NestedDialogBody.displayName = 'NestedDialogBody';

export const NestedDialog: Story = {
  render: (args) => <Levels {...args} body={<NestedDialogBody />} />,
  play: async ({ args, canvasElement, userEvent }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Settings' }));
    const shell = await canvas.findByRole('dialog', { name: 'Settings' });
    const nestedTrigger = within(shell).getByRole('button', { name: 'Reset workspace' });
    await userEvent.click(nestedTrigger);
    const nested = await within(shell).findByRole('dialog', { name: 'Reset workspace?' });
    // The nested dialog's cancel and close are its own; the stack keeps its sheet.
    await userEvent.keyboard('{Escape>}');
    requestEscape(nested);
    await userEvent.keyboard('{/Escape}');
    await waitFor(() => expect(nested).not.toHaveAttribute('open'));
    await expect(shell).toHaveAttribute('open');
    await expect(panels(canvasElement)).toHaveLength(1);
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(nestedTrigger).toHaveFocus());
  },
};

export const RTL: Story = {
  tags: ['!autodocs'],
  args: { variant: 'sheet', defaultValue: ['settings', 'account'] },
  render: (args) => (
    <div dir="rtl">
      <Levels {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const shell = layer(canvasElement);
    await waitFor(() => expect(shell).toHaveAttribute('open'));
    const active = activePanel(canvasElement)!;
    await expect(getComputedStyle(active).direction).toBe('rtl');
    // Back sits at the inline start (right) and its chevron points that way.
    const back = within(active).getByRole('button', { name: 'Back to Settings' });
    const close = within(active).getByRole('button', { name: 'Close all' });
    await expect(rect(back).left).toBeGreaterThan(rect(close).left);
    await expect(getComputedStyle(back.querySelector('svg')!).transform).toBe('matrix(-1, 0, 0, 1, 0, 0)');
  },
};

export const ReducedMotion: Story = {
  // Play checks authored rules and stubs matchMedia for dragging. Real media emulation needs browser QA.
  tags: ['!autodocs'],
  args: { variant: 'sheet', defaultValue: ['settings', 'account'] },
  render: (args) => <Levels {...args} />,
  parameters: {
    docs: {
      description: {
        story:
          'Enable reduced motion to remove entry and depth animation and disable handle dragging. Back and Close still work. Try the setting with browser media emulation.',
      },
    },
  },
  play: async ({ args, canvasElement, userEvent }) => {
    const shell = layer(canvasElement);
    await waitFor(() => expect(shell).toHaveAttribute('open'));
    const panel = activePanel(canvasElement)!;
    const handle = panel.querySelector<HTMLElement>('[data-ui="dialog-stack-handle"]')!;
    const rule = findConditionalRule(panel, 'prefers-reduced-motion: reduce');
    await expect(rule?.style.animationName).toBe('none');
    await expect(rule?.style.transitionDuration).toBe('0s');

    const win = handle.ownerDocument.defaultView!;
    const realMatchMedia = win.matchMedia.bind(win);
    const matchMedia = spyOn(win, 'matchMedia').mockImplementation((query) =>
      query === REDUCED_MOTION_QUERY
        ? Object.defineProperty(realMatchMedia(query), 'matches', { value: true })
        : realMatchMedia(query),
    );
    try {
      const top = rect(handle).top + 4;
      await drag(handle, [top, top + 200, top + 400]);
      await expect(matchMedia).toHaveBeenCalledWith(REDUCED_MOTION_QUERY);
      await expect(panel.style.translate).toBe('');
      await expect(args.onValueChange).not.toHaveBeenCalled();
    } finally {
      matchMedia.mockRestore();
    }
    await userEvent.click(within(panel).getByRole('button', { name: 'Back to Settings' }));
    await expectActive(canvasElement, 'Settings');
  },
};

export const ForcedColors: Story = {
  // Play checks authored rules only. The runner does not emulate forced colors.
  tags: ['!autodocs'],
  args: { defaultValue: ['settings', 'account'] },
  render: (args) => <Levels {...args} />,
  parameters: {
    docs: {
      description: {
        story:
          'Emulate forced colors in the browser to see system-color panel borders instead of shadows and borders around actions.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    await waitFor(() => expect(layer(canvasElement)).toHaveAttribute('open'));
    const panel = activePanel(canvasElement)!;
    const panelRule = findConditionalRule(panel, 'forced-colors: active');
    await expect(panelRule?.style.boxShadow).toBe('none');
    await expect(panelRule?.style.borderColor.toLowerCase()).toBe('canvastext');
    const back = within(panel).getByRole('button', { name: 'Back to Settings' });
    await expect(findConditionalRule(back, 'forced-colors: active')?.style.borderColor.toLowerCase()).toBe('buttonborder');
  },
};

function UnmountFixture(props: Omit<DialogStackCompoundProps, 'children'>) {
  const [mounted, setMounted] = useState(true);
  return (
    <>
      <FixtureButton type="button" onClick={() => setMounted(true)}>
        Mount
      </FixtureButton>
      {mounted && (
        <DialogStack {...props}>
          <DialogStack.Trigger value="settings">Settings</DialogStack.Trigger>
          <DialogStack.Content value="settings">
            <DialogStack.Title>Settings</DialogStack.Title>
            <FixtureButton type="button" onClick={() => setMounted(false)}>
              Remove stack
            </FixtureButton>
          </DialogStack.Content>
        </DialogStack>
      )}
    </>
  );
}
UnmountFixture.displayName = 'UnmountFixture';

export const UnmountOpen: Story = {
  render: (args) => <UnmountFixture {...args} />,
  play: async ({ args, canvasElement, userEvent }) => {
    const canvas = within(canvasElement);
    const { documentElement } = canvasElement.ownerDocument;
    await userEvent.click(canvas.getByRole('button', { name: 'Settings' }));
    const shell = await canvas.findByRole('dialog');
    await waitFor(() => expect(documentElement.style.overflow).toBe('hidden'));
    // Removal is not a close: no callback, the lock is released and focus leaves the removed DOM.
    await userEvent.click(within(shell).getByRole('button', { name: 'Remove stack' }));
    await waitFor(() => expect(canvas.queryByRole('dialog')).toBeNull());
    await expect(documentElement.style.overflow).toBe('');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
  },
};

export const FailedShowModal: Story = {
  render: (args) => <Levels {...args} />,
  play: async ({ canvasElement, userEvent }) => {
    const canvas = within(canvasElement);
    const { documentElement } = canvasElement.ownerDocument;
    const shell = layer(canvasElement) as HTMLDialogElement;
    shell.showModal = () => {
      throw new DOMException('showModal failed', 'InvalidStateError');
    };
    await userEvent.click(canvas.getByRole('button', { name: 'Settings' }));
    // No phantom modal and no scroll lock when the platform refuses to open.
    await expect(shell).not.toHaveAttribute('open');
    await expect(canvas.queryByRole('dialog')).toBeNull();
    await expect(documentElement.style.overflow).toBe('');
  },
};

export const StrictModeCleanup: Story = {
  render: (args) => (
    <StrictMode>
      <ContainedFixture {...args} />
      <Levels {...args} />
    </StrictMode>
  ),
  play: async ({ canvasElement, userEvent }) => {
    const canvas = within(canvasElement);
    const { documentElement } = canvasElement.ownerDocument;
    const [containedTrigger, viewportTrigger] = canvas.getAllByRole('button', { name: 'Settings' });
    const pageAction = canvas.getByRole('button', { name: 'Page action' });

    // Contained: inert applied once and fully restored; no scroll lock.
    await userEvent.click(containedTrigger!);
    await canvas.findByRole('dialog', { name: 'Settings' });
    await waitFor(() => expect(pageAction.closest('[inert]')).not.toBeNull());
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(pageAction.closest('[inert]')).toBeNull());
    await expect(canvasElement.querySelector('[data-floating-ui-inert]')).toBeNull();
    await expect(documentElement.style.overflow).toBe('');

    // Viewport: the double-invoked lock releases exactly once.
    await userEvent.click(viewportTrigger!);
    const shell = await canvas.findByRole('dialog');
    await waitFor(() => expect(documentElement.style.overflow).toBe('hidden'));
    requestEscape(shell);
    await waitFor(() => expect(shell).not.toHaveAttribute('open'));
    await waitFor(() => expect(documentElement.style.overflow).toBe(''));
    await expect(viewportTrigger).toHaveFocus();
  },
};

const panelRef = fn<(element: HTMLDivElement | null) => void>();

export const PartStyling: Story = {
  tags: ['!autodocs'],
  args: { defaultValue: ['settings'] },
  render: (args) => (
    <DialogStack {...args}>
      <DialogStack.Trigger value="settings" sx={{ minInlineSize: '11rem' }}>
        Settings
      </DialogStack.Trigger>
      <DialogStack.Content value="settings" ref={panelRef} sx={{ borderStartStartRadius: 0 }}>
        <DialogStack.Back label="Back" sx={{ minInlineSize: vars.space[12] }} />
        <DialogStack.Title level={3} sx={{ fontSize: vars.textSize.xl }}>
          Settings
        </DialogStack.Title>
        <DialogStack.Description sx={{ fontStyle: 'italic' }}>Workspace preferences.</DialogStack.Description>
        <DialogStack.Footer sx={{ justifyContent: 'flex-start' }}>
          <DialogStack.Close label="Close settings" sx={{ minInlineSize: vars.space[10] }} />
        </DialogStack.Footer>
      </DialogStack.Content>
    </DialogStack>
  ),
  play: async ({ canvasElement }) => {
    const shell = layer(canvasElement);
    await waitFor(() => expect(shell).toHaveAttribute('open'));
    await settle(shell);
    const panel = activePanel(canvasElement)!;
    const attached = panelRef.mock.calls.findLast(([element]) => element !== null)?.[0];
    await expect(attached).toBe(panel);
    await expect(getComputedStyle(panel).borderTopLeftRadius).toBe('0px');
    const heading = within(panel).getByRole('heading', { level: 3, name: 'Settings' });
    const remPx = Number.parseFloat(getComputedStyle(canvasElement.ownerDocument.documentElement).fontSize);
    await expect(Number.parseFloat(getComputedStyle(heading).fontSize)).toBeCloseTo(Number.parseFloat(base.textSize.xl) * remPx, 1);
    await expect(getComputedStyle(within(panel).getByText('Workspace preferences.')).fontStyle).toBe('italic');
    await expect(getComputedStyle(panel.querySelector('[data-ui="dialog-stack-footer"]')!).justifyContent).toBe('flex-start');
    const back = within(panel).getByRole('button', { name: 'Back' });
    const close = within(panel).getByRole('button', { name: 'Close settings' });
    await expect(rect(back).width).toBeGreaterThanOrEqual(Number.parseFloat(base.space[12]) - 0.5);
    await expect(rect(close).width).toBeGreaterThanOrEqual(Number.parseFloat(base.space[10]) - 0.5);
    // Controls keep the 32px main-axis target.
    await expect(rect(back).height).toBeGreaterThanOrEqual(Number.parseFloat(base.space[8]) - 0.5);
    await expect(rect(close).height).toBeGreaterThanOrEqual(Number.parseFloat(base.space[8]) - 0.5);
    await expect(DialogStack.Content.displayName).toBe('DialogStack.Content');
    await expect(DialogStack.Back.displayName).toBe('DialogStack.Back');
  },
};

function DisconnectedInvokerFixture(props: Omit<DialogStackCompoundProps, 'children'>) {
  const [linked, setLinked] = useState(true);
  return (
    <DialogStack {...props}>
      <DialogStack.Trigger value="settings">Settings</DialogStack.Trigger>
      <DialogStack.Content value="settings">
        <DialogStack.Title>Settings</DialogStack.Title>
        {linked && <DialogStack.Trigger value="account">Account</DialogStack.Trigger>}
      </DialogStack.Content>
      <DialogStack.Content value="account">
        <DialogStack.Back label="Back to Settings" />
        <DialogStack.Title>Account</DialogStack.Title>
        <FixtureButton type="button" onClick={() => setLinked(false)}>
          Unlink account
        </FixtureButton>
      </DialogStack.Content>
    </DialogStack>
  );
}
DisconnectedInvokerFixture.displayName = 'DisconnectedInvokerFixture';

export const DisconnectedInvoker: Story = {
  render: (args) => <DisconnectedInvokerFixture {...args} />,
  play: async ({ canvasElement, userEvent }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Settings' }));
    const shell = await canvas.findByRole('dialog');
    const accountTrigger = within(shell).getByRole('button', { name: 'Account' });
    await userEvent.click(accountTrigger);
    await expectActive(canvasElement, 'Account');
    await userEvent.click(within(shell).getByRole('button', { name: 'Unlink account' }));
    await waitFor(() => expect(accountTrigger.isConnected).toBe(false));
    // The invoker is gone: focus falls back to the parent's heading.
    await userEvent.click(within(shell).getByRole('button', { name: 'Back to Settings' }));
    await expectActive(canvasElement, 'Settings');
    await waitFor(() => expect(within(shell).getByRole('heading', { name: 'Settings' })).toHaveFocus());
  },
};

export const ControlledRejectDrag: Story = {
  tags: ['!autodocs'],
  args: { variant: 'sheet', value: ['settings', 'account'] },
  render: (args) => <Levels {...args} />,
  play: async ({ args, canvasElement }) => {
    const shell = layer(canvasElement);
    await waitFor(() => expect(shell).toHaveAttribute('open'));
    await settle(shell);
    const account = activePanel(canvasElement)!;
    const handle = account.querySelector<HTMLElement>('[data-ui="dialog-stack-handle"]')!;
    const top = rect(handle).top + 4;
    const height = rect(account).height;
    // A dismissing drag asks once; the parent keeps the stack, so the panel springs home.
    await drag(handle, [top, top + height * 0.2, top + height * 0.5], 150);
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith(['settings']);
    await expectHome(account);
    await expect(activePanel(canvasElement)).toBe(account);
    await expect(panelTitled(canvasElement, 'Settings').inert).toBe(true);
  },
};

export const AdapterDrag: Story = { ...Drag, render: (args) => <Levels {...args} contentProps={{ settings: { component: StackPaper }, account: { component: StackPaper } }} /> };
export const AdapterRejectedDrag: Story = { ...ControlledRejectDrag, render: (args) => <Levels {...args} contentProps={{ settings: { component: StackPaper }, account: { component: StackPaper } }} /> };
export const AdapterReducedMotion: Story = { ...ReducedMotion, render: (args) => <Levels {...args} contentProps={{ settings: { component: StackPaper }, account: { component: StackPaper } }} /> };
