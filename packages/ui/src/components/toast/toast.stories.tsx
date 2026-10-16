import type { CSSProperties, ComponentPropsWithRef } from 'react';
import { StrictMode, useEffect, useRef, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { withLightTheme } from '../../testing/story-decorators';
import { expectThemedSurface } from '../../testing/theme-assertions';
import { Button } from '../button';
import { ThemeRoot } from '../theme-root';
import { Toast, useToast, type ToastApi, type ToastOptions, type ToastProviderProps } from './index';

const TITLE = 'Changes saved';
const DESCRIPTION = 'Your profile is up to date.';
const DANGER_TITLE = 'Upload failed';
const PERSISTENT_TITLE = 'Sync paused';
/** Generous ceiling for timers + the exit transition (tokens: 160ms). */
const REMOVAL_TIMEOUT = { timeout: 3000 };

const rowStyle = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: vars.space[3],
} satisfies CSSProperties;

const meta = {
  title: 'Feedback/Toast',
  component: Toast,
  parameters: {
    docs: {
      description: { component: 'Show messages when actions succeed, fail or need attention.' },
      usage: `### Queue
- Set \`viewport="default"\` to mount the queue renderer, or \`viewport="stack"\` for \`ToastStack\`. Without \`viewport\`, mount one explicit \`Toast.Viewport\` or \`ToastStack\` inside the provider. Automatic rendering suppresses explicit renderer descendants.
- Call \`useToast()\` inside \`Toast\` or \`Toast.Provider\`. \`toast(options)\` returns an id; retain it to call \`update(id, patch)\` or \`dismiss(id)\`. Unknown or closing ids cannot be updated.
- \`max\` defaults to \`4\`. Adding beyond the limit removes the oldest toast immediately. The limit is floored and clamped to at least \`1\`; non-finite limits fall back to \`4\`.

### Timing
- \`duration\` defaults to 5000 milliseconds. Set a toast's \`duration\` to \`null\` to keep it open until dismissal. Provider duration changes affect new toasts, not existing ones.
- Timers pause while the toast is hovered, focused or the document is hidden, then resume with the remaining time. Keep timed information accessible elsewhere, or use \`duration: null\` when readers need to act on it.
- A \`loading\` toast persists when you omit its duration. Updating \`loading\` without a duration sets persistence when \`true\` and the provider delay when \`false\`. A changed duration restarts the timer; a text-only update does not.

### Actions and keyboard
- Pass an \`action\` with \`label\` and \`onClick\` to add a button. Its handler runs before dismissal; call \`event.preventDefault()\` to keep the toast open.
- Appearing toasts do not move focus. Press Tab to reach action and dismiss buttons, then Enter or Space to activate. Removing a toast with focus inside it moves focus to the first surviving open toast's dismiss button when one exists.

### Announcements
- \`tone\` defaults to \`neutral\`. Use \`danger\` for an assertive \`alert\`; other tones announce politely through \`status\`. Keep message content in \`title\` and \`description\`, with actions in \`action\` rather than inside the live-region text.
- Translate the dismiss name with \`messages.dismiss\` or \`dismissLabel\`; \`messages.dismiss\` wins and the fallback is "Dismiss".

### Customization
- The provider renders no DOM. Use \`slotProps.viewport\` or \`viewportProps\` for renderer props, then the renderer's \`slotProps.root\` and \`slotProps.item\` for root and card styling.
- Use \`slots.viewport\` to replace the renderer, forwarding received props to \`Toast.Viewport\` or \`ToastStack\`. For the default viewport's div, use \`component\` or \`slots.root\` on its props and forward received props and ref. Declare replacements outside render.`,
    },
  },
} satisfies Meta<typeof Toast>;

export default meta;

type Story = StoryObj<typeof meta>;

type CheckedToast<Props extends ToastProviderProps> = Props;
export type ToastTypeRegression = {
  // @ts-expect-error Renderer props require an explicit renderer selection.
  propsWithoutViewport: CheckedToast<{ viewportProps: { className: string } }>;
  // @ts-expect-error The default viewport does not accept stack options.
  stackPropsOnDefault: CheckedToast<{ viewport: 'default'; viewportProps: { maxVisible: number } }>;
};

function Triggers({ options }: { options?: ToastOptions }) {
  const { toast } = useToast();
  return (
    <div style={rowStyle}>
      <Button onClick={() => toast({ title: TITLE, description: DESCRIPTION, ...options })}>Show toast</Button>
      <Button
        onClick={() =>
          toast({ title: DANGER_TITLE, description: 'The file is larger than 10 MB.', ...options, tone: 'danger' })
        }
      >
        Show danger
      </Button>
      <Button onClick={() => toast({ title: PERSISTENT_TITLE, ...options, duration: null })}>Show persistent</Button>
    </div>
  );
}
Triggers.displayName = 'Triggers';

function ActionTriggers() {
  const { toast } = useToast();
  const [runs, setRuns] = useState(0);
  return (
    <div style={rowStyle}>
      <Button
        onClick={() =>
          toast({
            title: 'Message archived',
            duration: null,
            action: { label: 'Undo', onClick: () => setRuns((count) => count + 1) },
          })
        }
      >
        Archive
      </Button>
      <Button
        onClick={() =>
          toast({
            title: DANGER_TITLE,
            tone: 'danger',
            duration: null,
            action: {
              label: 'Retry',
              onClick: (event) => {
                event.preventDefault();
                setRuns((count) => count + 1);
              },
            },
          })
        }
      >
        Upload
      </Button>
      <p>{`Action runs: ${runs}`}</p>
    </div>
  );
}
ActionTriggers.displayName = 'ActionTriggers';

function ToastHarness({ options, children, ...providerProps }: ToastProviderProps & { options?: ToastOptions }) {
  return (
    <Toast {...providerProps}>
      {children ?? <Triggers options={options} />}
      <Toast.Viewport />
    </Toast>
  );
}
ToastHarness.displayName = 'ToastHarness';

/** Toasts are portaled into the story document's body, outside the canvas. */
function bodyOf(canvasElement: HTMLElement) {
  return within(canvasElement.ownerDocument.body);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Clicks a trigger and returns the toast once its live region has filled. */
async function showToast(canvasElement: HTMLElement, trigger: string, title: string) {
  await userEvent.click(within(canvasElement).getByRole('button', { name: trigger }));
  const text = await bodyOf(canvasElement).findByText(title);
  const toast = text.closest<HTMLElement>('[data-ui="toast"]');
  if (!toast) throw new Error(`"${title}" is not inside a toast.`);
  return toast;
}

/** Waits out the fade-in so computed styles (and the axe contrast check) see the final state. */
async function expectSettled(toast: HTMLElement) {
  await waitFor(() => expect(getComputedStyle(toast).opacity).toBe('1'));
}

async function expectRemoved(toast: HTMLElement) {
  await waitFor(() => expect(toast.isConnected).toBe(false), REMOVAL_TIMEOUT);
}

export const Default: Story = {
  args: { viewport: 'default', messages: { dismiss: 'Close notification' } },
  parameters: { docs: { source: { language: 'tsx', code: `function Notifications() {
  const { toast } = useToast();
  return <>
    <Button onClick={() => toast({ title: 'Changes saved', description: 'Your profile is up to date.' })}>Show toast</Button>
    <Button onClick={() => toast({ title: 'Upload failed', description: 'The file is larger than 10 MB.', tone: 'danger' })}>Show danger</Button>
    <Button onClick={() => toast({ title: 'Sync paused', duration: null })}>Show persistent</Button>
  </>;
}

<Toast viewport="default" messages={{ dismiss: 'Close notification' }}>
  <Notifications />
</Toast>` } } },
  render: (args) => <Toast {...args}><Triggers /></Toast>,
  play: async ({ canvasElement }) => {
    const toast = await showToast(canvasElement, 'Show toast', TITLE);
    await expect(toast).not.toHaveAttribute('role');
    await expect(within(toast).getByRole('status')).toHaveAttribute('aria-atomic', 'true');
    await expect(within(toast).getByRole('status').querySelector('button')).toBeNull();
    await expect(toast).toHaveAttribute('data-tone', 'neutral');
    await expect(toast).toHaveAttribute('data-state', 'open');
    await expect(toast).toHaveTextContent(DESCRIPTION);
    await expect(canvasElement.contains(toast)).toBe(false);
    // Appearing never steals focus from the invoker.
    await expect(canvasElement.ownerDocument.activeElement).toBe(
      within(canvasElement).getByRole('button', { name: 'Show toast' }),
    );

    await userEvent.click(within(toast).getByRole('button', { name: 'Close notification' }));
    await expectRemoved(toast);
  },
};

export const Compound: Story = {
  render: () => <Toast.Provider><Triggers /><Toast.Viewport /></Toast.Provider>,
};

function NotificationViewport(props: ComponentPropsWithRef<'div'>) {
  return <div {...props} data-custom-viewport="true" />;
}
function NotificationItem(props: ComponentPropsWithRef<'div'>) {
  return <div {...props} data-custom-notification="true" />;
}

export const GeneratedPartCustomization: Story = {
  render: () => <Toast viewport="default" viewportProps={{
    component: NotificationViewport,
    slots: { item: NotificationItem },
    className: 'consumer-viewport',
    title: 'Consumer title',
    style: { paddingInlineEnd: '8px' },
    css: { marginBlockEnd: vars.space[3] },
    sx: { marginBlockEnd: vars.space[4] },
    slotProps: {
      root: { className: 'custom-viewport', title: 'Slot title', style: { paddingInlineEnd: '24px' },
        css: { marginBlockEnd: vars.space[2] } },
      item: { className: 'custom-notification', css: { borderRadius: vars.radius.sm } },
    },
  }}><Triggers options={{ duration: null }} /></Toast>,
  play: async ({ canvasElement }) => {
    const toast = await showToast(canvasElement, 'Show toast', TITLE);
    const viewport = toast.closest('[data-ui="toast-viewport"]');
    await expect(viewport).toHaveClass('consumer-viewport', 'custom-viewport');
    await expect(viewport).toHaveAttribute('data-custom-viewport', 'true');
    await expect(viewport).toHaveAttribute('title', 'Slot title');
    await expect(viewport).toHaveStyle({ paddingInlineEnd: '24px' });
    if (!viewport) throw new Error('Missing customized viewport.');
    await expect(getComputedStyle(viewport).marginBlockEnd).toBe('16px');
    await expect(toast).toHaveClass('custom-notification');
    await expect(toast).toHaveAttribute('data-custom-notification', 'true');
    const dismiss = within(toast).getByRole('button', { name: 'Dismiss' });
    dismiss.focus();
    await userEvent.keyboard('{Enter}');
    await expectRemoved(toast);
  },
};

export const OneAutomaticRenderer: Story = {
  render: () => <StrictMode><Toast viewport="default"><Triggers options={{ duration: null }} />
    <Toast.Viewport />
  </Toast></StrictMode>,
  play: async ({ canvasElement }) => {
    const toast = await showToast(canvasElement, 'Show toast', TITLE);
    await expect(canvasElement.ownerDocument.querySelectorAll('[data-ui="toast-viewport"]')).toHaveLength(1);
    await expect(bodyOf(canvasElement).getAllByText(TITLE)).toHaveLength(1);
    await userEvent.click(within(toast).getByRole('button', { name: 'Dismiss' }));
    await expectRemoved(toast);
  },
};

function RendererSwitcher() {
  const [stack, setStack] = useState(false);
  return <>
    <Button onClick={() => setStack((value) => !value)}>Switch renderer</Button>
    <Toast viewport={stack ? 'stack' : 'default'}>
      <Triggers options={{ duration: null }} />
    </Toast>
  </>;
}

export const SharedQueue: Story = {
  render: () => <RendererSwitcher />,
  play: async ({ canvasElement }) => {
    const toast = await showToast(canvasElement, 'Show toast', TITLE);
    const id = toast.dataset.toastId;
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Switch renderer' }));
    const text = await bodyOf(canvasElement).findByText(TITLE);
    const card = text.closest<HTMLElement>('[data-ui="toast"]');
    if (!card) throw new Error('The shared queue lost its toast after switching renderer.');
    await expect(card).toHaveAttribute('data-toast-id', id);
    await expect(card?.closest('[data-ui="toast-stack"]')).not.toBeNull();
    await expect(canvasElement.ownerDocument.querySelectorAll('[data-ui="toast"]')).toHaveLength(1);
    await userEvent.click(within(card).getByRole('button', { name: 'Dismiss' }));
    await waitFor(() => expect(card?.isConnected).toBe(false));
  },
};

export const AutoDismiss: Story = {
  render: (args) => <ToastHarness {...args} options={{ duration: 300 }} />,
  play: async ({ canvasElement }) => {
    const toast = await showToast(canvasElement, 'Show toast', TITLE);
    await expectRemoved(toast);
  },
};

export const PauseOnHover: Story = {
  render: (args) => <ToastHarness {...args} options={{ duration: 400 }} />,
  play: async ({ canvasElement }) => {
    const toast = await showToast(canvasElement, 'Show toast', TITLE);
    await sleep(200);
    await userEvent.hover(toast);
    await sleep(500);
    await expect(toast.isConnected).toBe(true);
    await expect(toast).toHaveAttribute('data-state', 'open');

    await userEvent.unhover(toast);
    await expectRemoved(toast);
  },
};

export const PauseOnFocus: Story = {
  render: (args) => <ToastHarness {...args} options={{ duration: 400 }} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const toast = await showToast(canvasElement, 'Show toast', TITLE);
    await sleep(150);

    // The viewport follows the page in DOM order: Tab from the last trigger reaches the toast.
    const lastTrigger = canvas.getByRole('button', { name: 'Show persistent' });
    lastTrigger.focus();
    await userEvent.tab();
    const dismiss = within(toast).getByRole('button', { name: 'Dismiss' });
    await expect(canvasElement.ownerDocument.activeElement).toBe(dismiss);
    await expect(getComputedStyle(dismiss).outlineStyle).not.toBe('none');

    await sleep(500);
    await expect(toast.isConnected).toBe(true);
    await expect(toast).toHaveAttribute('data-state', 'open');

    await userEvent.tab({ shift: true });
    await expect(canvasElement.ownerDocument.activeElement).toBe(lastTrigger);
    await expectRemoved(toast);
  },
};

export const DangerRole: Story = {
  render: (args) => <ToastHarness {...args} options={{ duration: null }} />,
  play: async ({ canvasElement }) => {
    // Left open so the axe gate sees the danger toast.
    const toast = await showToast(canvasElement, 'Show danger', DANGER_TITLE);
    const message = within(toast).getByRole('alert');
    await expect(message).toHaveAttribute('aria-atomic', 'true');
    await expect(toast).toHaveAttribute('data-tone', 'danger');
    await expect(bodyOf(canvasElement).getByRole('alert')).toBe(message);
    await expectSettled(toast);
  },
};

export const MaxStack: Story = {
  args: { max: 2 },
  render: (args) => <ToastHarness {...args} options={{ duration: null }} />,
  play: async ({ canvasElement }) => {
    const body = bodyOf(canvasElement);
    const first = await showToast(canvasElement, 'Show toast', TITLE);
    await showToast(canvasElement, 'Show danger', DANGER_TITLE);
    const third = await showToast(canvasElement, 'Show persistent', PERSISTENT_TITLE);

    // The oldest is removed immediately, without an exit transition.
    await expect(first.isConnected).toBe(false);
    await expect(body.queryByText(TITLE)).toBeNull();
    const toasts = canvasElement.ownerDocument.querySelectorAll('[data-ui="toast"]');
    await expect(toasts).toHaveLength(2);
    // Newest sits last, nearest the viewport's bottom edge.
    await expect(toasts[1]).toBe(third);
  },
};

export const Persistent: Story = {
  render: (args) => <ToastHarness {...args} duration={300} />,
  play: async ({ canvasElement }) => {
    const toast = await showToast(canvasElement, 'Show persistent', PERSISTENT_TITLE);
    await sleep(600);
    await expect(toast.isConnected).toBe(true);
    await expect(toast).toHaveAttribute('data-state', 'open');

    await userEvent.click(within(toast).getByRole('button', { name: 'Dismiss' }));
    await expectRemoved(toast);
  },
};

export const FocusContinuation: Story = {
  render: (args) => <ToastHarness {...args} options={{ duration: null }} />,
  play: async ({ canvasElement }) => {
    const first = await showToast(canvasElement, 'Show toast', TITLE);
    const second = await showToast(canvasElement, 'Show danger', DANGER_TITLE);
    const firstDismiss = within(first).getByRole('button', { name: 'Dismiss' });
    const secondDismiss = within(second).getByRole('button', { name: 'Dismiss' });
    const document = canvasElement.ownerDocument;
    firstDismiss.focus();
    await expect(document.activeElement).toBe(firstDismiss);

    // Hold the exit open even with reduced motion, so inert is tested before removal.
    const exitHold = first.animate({ transform: ['none', 'none'] }, { duration: 10000 });
    try {
      await userEvent.click(firstDismiss);
      await expect(first).toHaveAttribute('data-state', 'closing');
      await expect(first).toHaveAttribute('inert');
      await expect(document.activeElement).toBe(secondDismiss);

      // Inert rejects direct focus (and, natively, removes the closing controls from the
      // keyboard order). user-event's tab simulation does not model inert in this
      // environment, so assert the rejection and the inert attribute rather than simulating Tab.
      firstDismiss.focus();
      await expect(document.activeElement).toBe(secondDismiss);
    } finally {
      exitHold.cancel();
    }
    await expectRemoved(first);
    await expect(document.activeElement).toBe(secondDismiss);
    await userEvent.click(secondDismiss);
    await expectRemoved(second);
  },
};

export const Action: Story = {
  render: (args) => (
    <ToastHarness {...args}>
      <ActionTriggers />
    </ToastHarness>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const archived = await showToast(canvasElement, 'Archive', 'Message archived');
    await userEvent.click(within(archived).getByRole('button', { name: 'Undo' }));
    await expect(canvas.getByText('Action runs: 1')).toBeInTheDocument();
    await expectRemoved(archived);

    // A handler that calls preventDefault keeps the toast open.
    const failed = await showToast(canvasElement, 'Upload', DANGER_TITLE);
    await userEvent.click(within(failed).getByRole('button', { name: 'Retry' }));
    await expect(canvas.getByText('Action runs: 2')).toBeInTheDocument();
    await expect(failed).toHaveAttribute('data-state', 'open');

    await userEvent.click(within(failed).getByRole('button', { name: 'Dismiss' }));
    await expectRemoved(failed);
  },
};

export const LightTheme: Story = {
  decorators: [withLightTheme],
  render: (args) => <ToastHarness {...args} />,
  play: async ({ canvasElement }) => {
    // Left open so the axe gate checks light-theme contrast.
    const toast = await showToast(canvasElement, 'Show persistent', PERSISTENT_TITLE);
    await expect(within(toast).getByRole('status')).toHaveAttribute('aria-atomic', 'true');
    await expectSettled(toast);
    await expect(toast).toBeVisible();
    await expectThemedSurface(toast, 'light');
  },
};

export const LongContent: Story = {
  render: (args) => (
    <ToastHarness
      {...args}
      options={{
        duration: null,
        title: 'A notification with a long title that wraps across multiple lines',
        description: 'https://example.com/'.padEnd(180, 'a'),
        action: {
          label: 'Retry uploading the original document from your device',
          onClick: (event) => event.preventDefault(),
        },
      }}
    />
  ),
  play: async ({ canvasElement }) => {
    const toast = await showToast(
      canvasElement,
      'Show toast',
      'A notification with a long title that wraps across multiple lines',
    );
    await expectSettled(toast);
    for (const element of [toast, ...toast.querySelectorAll<HTMLElement>('[role="status"], button')]) {
      await expect(element.scrollWidth).toBeLessThanOrEqual(element.clientWidth);
    }
  },
};

export const PauseOnHoverAndFocus: Story = {
  render: (args) => <ToastHarness {...args} options={{ duration: 400 }} />,
  play: async ({ canvasElement }) => {
    const toast = await showToast(canvasElement, 'Show toast', TITLE);
    const dismiss = within(toast).getByRole('button', { name: 'Dismiss' });
    await userEvent.hover(toast);
    dismiss.focus();
    await userEvent.unhover(toast);
    await sleep(500);
    await expect(toast).toHaveAttribute('data-state', 'open');
    await userEvent.hover(toast);
    within(canvasElement).getByRole('button', { name: 'Show toast' }).focus();
    await sleep(500);
    await expect(toast).toHaveAttribute('data-state', 'open');
    await userEvent.unhover(toast);
    await expectRemoved(toast);
  },
};

function UpdateTriggers() {
  const { toast, update } = useToast();
  const [id, setId] = useState('');
  return (
    <div style={rowStyle}>
      <Button onClick={() => setId(toast({ title: TITLE, duration: 800 }))}>Start countdown</Button>
      <Button onClick={() => update(id, { duration: null, title: PERSISTENT_TITLE })}>Persist</Button>
      <Button onClick={() => update(id, { duration: 300 })}>Resume countdown</Button>
    </div>
  );
}

export const UpdateCountdown: Story = {
  render: (args) => (
    <StrictMode>
      <ToastHarness {...args}>
        <UpdateTriggers />
      </ToastHarness>
    </StrictMode>
  ),
  play: async ({ canvasElement }) => {
    const toast = await showToast(canvasElement, 'Start countdown', TITLE);
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Persist' }));
    await sleep(1000);
    await expect(toast).toHaveAttribute('data-state', 'open');
    await expect(toast).toHaveTextContent(PERSISTENT_TITLE);
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Resume countdown' }));
    await expectRemoved(toast);
  },
};

function ScopedHarness(args: ToastProviderProps) {
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  return (
    <>
      <div ref={setContainer} data-testid="toast-host" />
      <ThemeRoot theme="light" portalContainer={container}>
        <ToastHarness {...args} options={{ duration: null }} />
      </ThemeRoot>
    </>
  );
}

export const ScopedPortal: Story = {
  render: (args) => <ScopedHarness {...args} />,
  play: async ({ canvasElement }) => {
    const toast = await showToast(canvasElement, 'Show toast', TITLE);
    await expect(within(canvasElement).getByTestId('toast-host').contains(toast)).toBe(true);
    await expect(toast.closest('[data-ui="theme-boundary"]')).toHaveAttribute('data-theme', 'light');
    await expectSettled(toast);
    await expectThemedSurface(toast, 'light');
  },
};

function CaptureApi({ capture }: { capture: (api: ToastApi) => void }) {
  const api = useToast();
  useEffect(() => capture(api), [api, capture]);
  return null;
}

function UnmountHarness(args: ToastProviderProps) {
  const [mounted, setMounted] = useState(true);
  const [reads, setReads] = useState<number | null>(null);
  const apiRef = useRef<ToastApi | null>(null);
  return (
    <>
      <Button onClick={() => setMounted(false)}>Unmount provider</Button>
      <Button
        onClick={() => {
          let optionReads = 0;
          apiRef.current?.toast({
            get title() {
              optionReads += 1;
              return TITLE;
            },
          });
          apiRef.current?.dismiss('missing');
          apiRef.current?.update('missing', { duration: 100 });
          setReads(optionReads);
        }}
      >
        Call retained API
      </Button>
      {reads !== null && <p>Options reads: {reads}</p>}
      {mounted && (
        <ToastHarness {...args}>
          <CaptureApi
            capture={(api) => {
              apiRef.current = api;
            }}
          />
          <Triggers />
        </ToastHarness>
      )}
    </>
  );
}

export const UnmountCleanup: Story = {
  render: (args) => <UnmountHarness {...args} />,
  play: async ({ canvasElement }) => {
    const toast = await showToast(canvasElement, 'Show toast', TITLE);
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Unmount provider' }));
    await expect(toast.isConnected).toBe(false);
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Call retained API' }));
    await expect(within(canvasElement).getByText('Options reads: 0')).toBeInTheDocument();
    await expect(canvasElement.ownerDocument.querySelector('[data-ui="toast"]')).toBeNull();
  },
};
