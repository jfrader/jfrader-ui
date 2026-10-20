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
      sections: [
        { title: 'Tones', stories: ['Default'] },
        { title: 'Title and description', stories: ['Compound'] },
        { title: 'Actions', stories: ['Action'] },
        { title: 'Dismissal', stories: ['Persistent'] },
        { title: 'Stacking and placement', stories: ['MaxStack'] },
        { title: 'Controlled updates', stories: ['UpdateCountdown'] },
      ],
      usage: `### When to use
Show a non-blocking result after an action. Keep essential information available in the page after a timed notification disappears.

### Constraints
Mount one queue renderer per provider. Adding beyond the queue limit removes the oldest notification immediately. Updates to unknown or closing notifications have no effect.

Timers pause while a toast is hovered, focused or the document is hidden. A text-only update keeps the remaining time; changing the duration restarts it. Keep messages that require action open until dismissal.

### Accessibility
New notifications do not move focus. Tab reaches actions and dismiss buttons; Enter or Space activates them. Removing a focused notification moves focus to a surviving notification's dismiss button when available.

Danger messages announce assertively; other tones announce politely. Keep interactive controls outside the announcement text and translate dismiss names for your audience.`,
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
  name: 'Notification tones',
  args: { viewport: 'default', messages: { dismiss: 'Close notification' } },
  parameters: { docs: { description: { story: 'Show a neutral result, an upload error, or a persistent sync message.' }, source: { language: 'tsx', code: `import { Button, Toast, useToast } from '@jfrader/ui';

function Notifications() {
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
  name: 'Title and supporting text',
  parameters: { docs: {
    description: { story: 'Mount the viewport explicitly and show a title with supporting detail.' },
    source: { language: 'tsx', code: `import { Button, Toast, useToast } from '@jfrader/ui';

function Notifications() {
  const { toast } = useToast();
  return <>
    <Button onClick={() => toast({ title: 'Changes saved', description: 'Your profile is up to date.' })}>Show toast</Button>
    <Button onClick={() => toast({ title: 'Upload failed', description: 'The file is larger than 10 MB.', tone: 'danger' })}>Show danger</Button>
    <Button onClick={() => toast({ title: 'Sync paused', duration: null })}>Show persistent</Button>
  </>;
}

<Toast.Provider><Notifications /><Toast.Viewport /></Toast.Provider>` },
  } },
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
    sx: [{ marginBlockEnd: vars.space[3] }, { marginBlockEnd: vars.space[4] }],
    slotProps: {
      root: { className: 'custom-viewport', title: 'Slot title', style: { paddingInlineEnd: '24px' },
        sx: { marginBlockEnd: vars.space[2] } },
      item: { className: 'custom-notification', sx: { borderRadius: vars.radius.sm } },
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
  name: 'Limit the queue',
  parameters: { docs: {
    description: { story: 'Show three messages to replace the oldest in a two-message queue.' },
    source: { language: 'tsx', code: `import { Button, Toast, useToast } from '@jfrader/ui';

function Notifications() {
  const { toast } = useToast();
  return <>
    <Button onClick={() => toast({ title: 'Changes saved', description: 'Your profile is up to date.', duration: null })}>Show toast</Button>
    <Button onClick={() => toast({ title: 'Upload failed', description: 'The file is larger than 10 MB.', tone: 'danger', duration: null })}>Show danger</Button>
    <Button onClick={() => toast({ title: 'Sync paused', duration: null })}>Show persistent</Button>
  </>;
}

<Toast max={2}><Notifications /><Toast.Viewport /></Toast>` },
  } },
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
  name: 'Dismiss a persistent message',
  parameters: { docs: {
    description: { story: 'Keep the sync message open until its dismiss button is activated.' },
    source: { language: 'tsx', code: `import { Button, Toast, useToast } from '@jfrader/ui';

function Notifications() {
  const { toast } = useToast();
  return <>
    <Button onClick={() => toast({ title: 'Changes saved', description: 'Your profile is up to date.' })}>Show toast</Button>
    <Button onClick={() => toast({ title: 'Upload failed', description: 'The file is larger than 10 MB.', tone: 'danger' })}>Show danger</Button>
    <Button onClick={() => toast({ title: 'Sync paused', duration: null })}>Show persistent</Button>
  </>;
}

<Toast duration={300}><Notifications /><Toast.Viewport /></Toast>` },
  } },
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
  name: 'Undo and retry actions',
  parameters: { docs: {
    description: { story: 'Undo dismisses its message; Retry prevents dismissal and leaves the error visible.' },
    source: { language: 'tsx', code: `import { useState } from 'react';
import { Button, Toast, useToast } from '@jfrader/ui';

function ArchiveActions() {
  const { toast } = useToast();
  const [runs, setRuns] = useState(0);
  return <>
    <Button onClick={() => toast({ title: 'Message archived', duration: null,
      action: { label: 'Undo', onClick: () => setRuns((count) => count + 1) },
    })}>Archive</Button>
    <Button onClick={() => toast({ title: 'Upload failed', tone: 'danger', duration: null,
      action: { label: 'Retry', onClick: (event) => {
        event.preventDefault();
        setRuns((count) => count + 1);
      } },
    })}>Upload</Button>
    <p>Action runs: {runs}</p>
  </>;
}

<Toast><ArchiveActions /><Toast.Viewport /></Toast>` },
  } },
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

function TallQueue() {
  const { toast } = useToast();
  const initialized = useRef(false);
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    for (const title of ['First report', 'Second report', 'Third report', 'Latest report']) {
      toast({ title, description: 'The export includes all workspace documents. '.repeat(30), duration: null });
    }
  }, [toast]);
  return null;
}

export const ScrollableLongQueue: Story = {
  tags: ['!autodocs'],
  args: { viewport: 'default' },
  render: (args) => <Toast {...args}><TallQueue /></Toast>,
  play: async ({ canvasElement }) => {
    const document = canvasElement.ownerDocument;
    await bodyOf(canvasElement).findByText('Latest report');
    const viewport = document.querySelector<HTMLElement>('[data-ui="toast-viewport"]')!;
    const cards = viewport.querySelectorAll<HTMLElement>('[data-ui="toast"]');
    await waitFor(async () => {
      await expect(viewport.scrollHeight).toBeGreaterThan(viewport.clientHeight);
      await expect(cards[3]!.getBoundingClientRect().bottom).toBeLessThanOrEqual(viewport.getBoundingClientRect().bottom + 1);
    });
    await expect(viewport.getBoundingClientRect().top).toBeGreaterThanOrEqual(0);
    await expect(viewport.getBoundingClientRect().bottom).toBeLessThanOrEqual(document.documentElement.clientHeight);
    await expect(getComputedStyle(viewport).overscrollBehaviorY).toBe('contain');
    await expect(getComputedStyle(viewport).pointerEvents).toBe('auto');
    viewport.scrollTop = 0;
    await expect(cards[0]!.getBoundingClientRect().top).toBeGreaterThanOrEqual(viewport.getBoundingClientRect().top - 1);
    const dismiss = within(cards[0]!).getByRole('button', { name: 'Dismiss' });
    dismiss.focus();
    await expect(document.activeElement).toBe(dismiss);
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
  name: 'Update a notification',
  parameters: { docs: {
    description: { story: 'Start a countdown, make the message persistent, then resume timed dismissal.' },
    source: { language: 'tsx', code: `import { useState } from 'react';
import { Button, Toast, useToast } from '@jfrader/ui';

function Countdown() {
  const { toast, update } = useToast();
  const [id, setId] = useState('');
  return <>
    <Button onClick={() => setId(toast({ title: 'Changes saved', duration: 800 }))}>Start countdown</Button>
    <Button onClick={() => update(id, { duration: null, title: 'Sync paused' })}>Persist</Button>
    <Button onClick={() => update(id, { duration: 300 })}>Resume countdown</Button>
  </>;
}

<Toast><Countdown /><Toast.Viewport /></Toast>` },
  } },
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
