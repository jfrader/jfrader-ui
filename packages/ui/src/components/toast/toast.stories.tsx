import type { CSSProperties } from 'react';
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
} satisfies Meta<typeof Toast>;

export default meta;

type Story = StoryObj<typeof meta>;

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
  args: { dismissLabel: 'Close notification' },
  render: (args) => <ToastHarness {...args} />,
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
