import { Component, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, spyOn, waitFor, within } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { withLightTheme } from '../../testing/story-decorators';
import { Button } from '../button';
import { ThemeRoot } from '../theme-root';
import { Toast, useToast, type ToastOptions } from '../toast';
import { ToastStack, type ToastStackProps } from './index';
// `styled` is the app-facing styling API; consumers import it from `@jfrader/ui`.
import { styled } from '../../index';

const ActionRow = styled.div({ display: 'flex', gap: vars.space[2], flexWrap: 'wrap' });

const FixtureInput = styled.input({ minBlockSize: vars.space[8] });

const messages: ToastOptions[] = [
  { title: 'Profile saved', description: 'Your changes are published.', duration: null },
  { title: 'Export ready', description: 'Download your report.', duration: null },
  { title: 'Message sent', duration: null },
  { title: 'Upload complete', duration: null },
  { title: 'Project created', duration: null },
];
const action = fn((event: { preventDefault: () => void }) => event.preventDefault());
const meta = {
  title: 'Feedback/ToastStack',
  component: ToastStack,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Show toast messages in a stack and dismiss them.',
      },
      sections: [
        { title: 'Basic', stories: ['Default'] },
        { title: 'Queue and stacking', stories: ['List', 'OverflowPromotion'] },
        { title: 'Placement', stories: ['Positions', 'Contained'] },
        { title: 'Pause and limits', stories: ['PauseOnHover'] },
        { title: 'Actions', stories: ['UndoPrevented'] },
        { title: 'Controlled updates', stories: ['LoadingUpdate'] },
      ],
      usage: `### When to use
Group non-blocking notifications in a compact pile, or use a list when several messages need to remain readable together. Keep timed information available elsewhere.

### Constraints
Mount one queue renderer per provider. A contained stack needs a positioned host with enough height for the expanded messages. The queue limit removes the oldest message; the visible limit only changes the collapsed pile.

Hovering or focusing the stack pauses dismissal. Messages hidden behind the newest card keep their remaining time until exposed.

### Keyboard and accessibility
Tab visits the toggle and controls from newest to oldest. Escape dismisses the focused toast, not a notification elsewhere on the page. Enter and Space activate buttons. The optional Alt+T shortcut focuses notifications but does not interrupt editing in a text field.

Only exposed messages announce. Use persistent notifications for actions readers must complete.`,
    },
  },
} satisfies Meta<typeof ToastStack>;
export default meta;
type Story = StoryObj<typeof meta>;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function stackSource(initial: ToastOptions[], props = '', max = 12, blockSize = '20rem') {
  return `import { useEffect, useRef } from 'react';
import { Button, Toast, ToastStack, styled, useToast } from '@jfrader/ui';

const Panel = styled.div({ position: 'relative', blockSize: '${blockSize}' });

function Notifications() {
  const { toast, update, dismiss } = useToast();
  const ids = useRef<string[]>([]);
  const initialized = useRef(false);
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    ids.current = ${JSON.stringify(initial, null, 2)}.map((message) => toast(message));
  }, [toast]);
  return <>
    <Button onClick={() => ids.current.push(toast({ title: 'New notification', duration: null }))}>Notify</Button>
    <Button onClick={() => {
      const id = ids.current.at(-1);
      if (id) update(id, { title: 'Saved successfully', loading: false, duration: null, action: undefined });
    }}>Complete</Button>
    <Button onClick={() => {
      const id = ids.current.at(-1);
      if (id) dismiss(id);
    }}>Dismiss newest</Button>
  </>;
}

<Toast max={${max}}>
  <Notifications />
  <Panel><ToastStack contained ${props}/></Panel>
</Toast>`;
}

function Controls({ initial, mode }: { initial: ToastOptions[]; mode?: 'update' | 'evict' }) {
  const api = useToast();
  const initialized = useRef(false);
  const ids = useRef<string[]>([]);
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    ids.current = initial.map((options) => {
      let id: string;
      id = api.toast({
        ...options,
        ...(mode
          ? {
              action: {
                label: mode === 'update' ? 'Save' : 'Create another',
                onClick: (event) => {
                  event.preventDefault();
                  if (mode === 'update')
                    api.update(id, { title: 'Saved successfully', loading: false, duration: null });
                  else api.toast({ title: 'New notification', duration: null });
                },
              },
            }
          : {}),
      });
      return id;
    });
  }, [api, initial, mode]);
  return (
    <ActionRow>
      <Button onClick={() => ids.current.push(api.toast({ title: 'New notification', duration: null }))}>
        Notify
      </Button>
      <Button
        onClick={() =>
          api.update(ids.current.at(-1)!, {
            title: 'Saved successfully',
            loading: false,
            duration: null,
            action: undefined,
          })
        }
      >
        Complete
      </Button>
      <Button onClick={() => api.dismiss(ids.current.at(-1)!)}>Dismiss newest</Button>
      <Button
        onClick={() => {
          api.update('missing', { title: 'Unreachable' });
          api.dismiss('missing');
        }}
      >
        Unknown id
      </Button>
      <Button>Outside</Button>
    </ActionRow>
  );
}
// Every example renders the stack inside its own surface, so a stack lands in that surface's
// corner. Without one, each example pins its toasts to the corner of the page and the whole docs
// page piles them on top of each other. `ViewportAnchored` keeps the page-level behavior.
const SurfaceFrame = styled.div({
  boxSizing: 'border-box',
  position: 'relative',
  inlineSize: '100%',
  border: `1px solid ${vars.color.borderControl}`,
  borderRadius: vars.radius.md,
});

function Surface({ blockSize = '20rem', children }: { blockSize?: string; children: ReactNode }) {
  return <SurfaceFrame style={{ blockSize }}>{children}</SurfaceFrame>;
}

function Harness({
  initial = messages.slice(0, 3),
  max = 12,
  mode,
  surface = true,
  blockSize = '20rem',
  ...args
}: ToastStackProps & {
  initial?: ToastOptions[];
  max?: number;
  mode?: 'update' | 'evict';
  surface?: boolean;
  blockSize?: string;
}) {
  return (
    <Toast max={max}>
      <Controls initial={initial} mode={mode} />
      {surface ? (
        <Surface blockSize={blockSize}>
          <ToastStack contained {...args} />
        </Surface>
      ) : (
        <ToastStack {...args} />
      )}
    </Toast>
  );
}
const bodyOf = (element: HTMLElement) => within(element.ownerDocument.body);
/** Declarations authored for `element` inside `@media` rules whose condition includes `feature`. */
function mediaDeclarations(element: Element, feature: string) {
  const sheets = Array.from(element.ownerDocument.styleSheets).flatMap((sheet) => {
    try {
      return Array.from(sheet.cssRules);
    } catch {
      return [];
    }
  });
  return sheets
    .filter((rule): rule is CSSMediaRule => rule instanceof CSSMediaRule && rule.conditionText.includes(feature))
    .flatMap((rule) => Array.from(rule.cssRules))
    .filter((rule): rule is CSSStyleRule => rule instanceof CSSStyleRule && element.matches(rule.selectorText))
    .map((rule) => rule.style);
}
async function settled(element: HTMLElement) {
  await sleep(280);
  await waitFor(async () => {
    await expect(element.querySelector('[data-populated="true"]')).not.toBeNull();
  });
}

export const Default: Story = {
  name: 'Notification stack',
  parameters: { docs: {
    description: { story: 'Expand the pile to read earlier messages or add another notification.' },
    source: { language: 'tsx', code: stackSource(messages.slice(0, 3), '', 12, '30rem') },
  } },
  render: (args) => <Surface blockSize="30rem"><Toast max={12} viewport="stack" viewportProps={{ contained: true, ...args }}>
    <Controls initial={messages.slice(0, 3)} />
  </Toast></Surface>,
  play: async ({ canvasElement, userEvent }) => {
    const region = await bodyOf(canvasElement).findByRole('region', { name: 'Notifications' });
    await settled(region);
    await expect(region).not.toHaveAttribute('aria-live');
    // The example renders its stack in place, inside its own surface.
    await expect(canvasElement.contains(region)).toBe(true);
    const cards = region.querySelectorAll('[data-ui="toast"]');
    await expect(cards).toHaveLength(3);
    // The collapsed pile casts one shadow; the cards inside it stay shadowless, so the cards behind
    // are not washed grey by the front card's shadow on light surfaces.
    await expect(getComputedStyle(region.querySelector('[data-ui="toast-stack-list"]')!).boxShadow).not.toBe('none');
    await expect(getComputedStyle(cards[0]!).boxShadow).toBe('none');
    await expect(cards[0]).toHaveTextContent('Message sent');
    await expect(cards[1]).toHaveAttribute('inert');
    await expect(cards[1]).toHaveAttribute('aria-hidden', 'true');
    await expect(cards[1]?.querySelector('[role="status"]')).toBeEmptyDOMElement();
    await expect(within(region).getAllByRole('status')).toHaveLength(1);
    await expect(within(region).getByRole('status').querySelector('button')).toBeNull();
    await userEvent.hover(region);
    await settled(region);
    const outside = within(canvasElement).getByRole('button', { name: 'Outside' });
    const toggle = within(region).getByRole('button', { name: 'Collapse notifications' });
    await expect(toggle.getBoundingClientRect().top).toBeGreaterThanOrEqual(outside.getBoundingClientRect().bottom);
  },
};

export const Compound: Story = { render: (args) => <Harness {...args} /> };

// This story tests the documented css/slot API and native style merging.
export const GeneratedPartCustomization: Story = {
  args: { slotProps: { root: { onKeyDown: fn() } } },
  render: (args) => <Surface><Toast viewport="stack" viewportProps={{
    contained: true,
    variant: 'list',
    slotProps: {
      root: { ...args.slotProps?.root, className: 'custom-stack', title: 'Notifications panel', sx: { gap: vars.space[3] } },
      list: { className: 'custom-stack-list' },
      item: { className: 'custom-stack-card', sx: { borderRadius: vars.radius.sm } },
    },
  }}><Controls initial={messages.slice(0, 2)} /><Toast.Viewport /><ToastStack /></Toast></Surface>,
  play: async ({ canvasElement, args, userEvent }) => {
    const region = await bodyOf(canvasElement).findByRole('region', { name: 'Notifications' });
    await settled(region);
    await expect(region).toHaveClass('custom-stack');
    await expect(region).toHaveAttribute('title', 'Notifications panel');
    await expect(region.querySelector('[data-ui="toast-stack-list"]')).toHaveClass('custom-stack-list');
    await expect(region.querySelectorAll('.custom-stack-card')).toHaveLength(2);
    await expect(canvasElement.ownerDocument.querySelectorAll('[data-ui="toast-stack"]')).toHaveLength(1);
    await expect(canvasElement.ownerDocument.querySelector('[data-ui="toast-viewport"]')).toBeNull();
    const dismiss = within(region).getAllByRole('button', { name: 'Dismiss' })[0]!;
    dismiss.focus();
    await userEvent.keyboard('{Escape}');
    await expect(args.slotProps?.root?.onKeyDown).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(region.querySelectorAll('[data-ui="toast"]')).toHaveLength(1));
  },
};
const viewportTriggers: { label: string; options: ToastOptions }[] = [
  { label: 'Save profile', options: { title: 'Profile saved', description: 'Your changes are published.' } },
  {
    label: 'Upload a large file',
    options: { title: 'Upload failed', description: 'The file is larger than 10 MB.', tone: 'danger', duration: null },
  },
  { label: 'Pause sync', options: { title: 'Sync paused', duration: null } },
];
function ViewportTriggers() {
  const api = useToast();
  return (
    <ActionRow>
      {viewportTriggers.map(({ label, options }) => (
        <Button key={label} onClick={() => api.toast(options)}>
          {label}
        </Button>
      ))}
    </ActionRow>
  );
}
/** Click a button: the stack pins to the corner of the page, over the documentation. */
export const ViewportAnchored: Story = {
  render: (args) => (
    <Toast>
      <ViewportTriggers />
      <ToastStack {...args} />
    </Toast>
  ),
  play: async ({ canvasElement, userEvent }) => {
    const region = await bodyOf(canvasElement).findByRole('region', { name: 'Notifications' });
    await expect(getComputedStyle(region).position).toBe('fixed');
    await expect(canvasElement.contains(region)).toBe(false);
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Save profile' }));
    await settled(region);
    await expect(await bodyOf(canvasElement).findByText('Profile saved')).toBeVisible();
  },
};
export const List: Story = {
  name: 'Expanded list',
  parameters: { docs: {
    description: { story: 'Keep all queued messages readable in a list instead of a collapsed pile.' },
    source: { language: 'tsx', code: stackSource(messages.slice(0, 3), 'variant="list" ') },
  } },
  args: { variant: 'list' },
  render: (args) => <Harness {...args} />,
  play: async ({ canvasElement }) => {
    const region = await bodyOf(canvasElement).findByRole('region', { name: 'Notifications' });
    await settled(region);
    await expect(within(region).getAllByRole('status')).toHaveLength(3);
    const cards = region.querySelectorAll<HTMLElement>('[data-ui="toast"]');
    await expect(
      cards[0]!.getBoundingClientRect().top - cards[1]!.getBoundingClientRect().bottom,
    ).toBeGreaterThan(6);
  },
};
export const PersistentStack: Story = { ...List, name: 'Persistent stack' };
export const Empty: Story = { render: (args) => <Harness {...args} initial={[]} /> };
export const AllTones: Story = {
  args: { variant: 'list' },
  render: (args) => (
    <Harness
      {...args}
      initial={(['neutral', 'info', 'warning', 'success', 'danger'] as const).map((tone) => ({
        title: `${tone} notification`,
        tone,
        duration: null,
      }))}
    />
  ),
};
export const OverflowPromotion: Story = {
  name: 'Queue and visible limits',
  parameters: { docs: {
    description: { story: 'Keep four messages in the queue while showing two cards in the collapsed pile.' },
    source: { language: 'tsx', code: stackSource(messages, 'maxVisible={2} ', 4) },
  } },
  args: { maxVisible: 2 },
  render: (args) => <Harness {...args} initial={messages} max={4} />,
  play: async ({ canvasElement, userEvent }) => {
    const region = await bodyOf(canvasElement).findByRole('region', { name: 'Notifications' });
    await settled(region);
    await expect(region.querySelectorAll('[data-ui="toast"]')).toHaveLength(4);
    await expect(region.querySelectorAll('[data-stack-visible="true"]')).toHaveLength(2);
    await expect(within(region).getByRole('button', { name: 'Expand notifications' })).toHaveTextContent(
      '(+2)',
    );
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Dismiss newest' }));
    await bodyOf(canvasElement).findByText('Upload complete');
    await expect(bodyOf(canvasElement).queryByText('Profile saved')).toBeNull();
    await settled(region);
    await expect(bodyOf(canvasElement).getByText('Upload complete')).toBeVisible();
  },
};
export const Keyboard: Story = {
  args: { hotkey: true },
  render: (args) => <Harness {...args} />,
  play: async ({ canvasElement, userEvent }) => {
    const region = await bodyOf(canvasElement).findByRole('region', { name: 'Notifications' });
    await settled(region);
    const outside = within(canvasElement).getByRole('button', { name: 'Outside' });
    outside.focus();
    await userEvent.keyboard('{Escape}');
    await expect(region.querySelectorAll('[data-ui="toast"]')).toHaveLength(3);
    await userEvent.tab();
    const toggle = within(region).getByRole('button', { name: 'Collapse notifications' });
    await expect(canvasElement.ownerDocument.activeElement).toBe(toggle);
    await expect(getComputedStyle(toggle).outlineStyle).not.toBe('none');
    await expect(toggle).toHaveAttribute(
      'aria-controls',
      region.querySelector('[data-ui="toast-stack-list"]')!.id,
    );
    await userEvent.tab({ shift: true });
    await expect(canvasElement.ownerDocument.activeElement).toBe(outside);
    await userEvent.keyboard('{Alt>}t{/Alt}');
    const dismiss = within(region).getAllByRole('button', { name: 'Dismiss' })[0]!;
    await expect(canvasElement.ownerDocument.activeElement).toBe(dismiss);
    await expect(getComputedStyle(dismiss).outlineStyle).not.toBe('none');
    await userEvent.keyboard('{Escape}');
    await waitFor(async () => {
      await expect(region.querySelectorAll('[data-state="open"]')).toHaveLength(2);
    });
    await expect(canvasElement.ownerDocument.activeElement).toBe(
      within(region).getAllByRole('button', { name: 'Dismiss' })[0],
    );
    await settled(region);
  },
};
export const HoverAndTouchExpansion: Story = {
  render: (args) => <Harness {...args} initial={messages} />,
  play: async ({ canvasElement, userEvent }) => {
    const region = await bodyOf(canvasElement).findByRole('region', { name: 'Notifications' });
    await settled(region);
    const list = region.querySelector<HTMLElement>('[data-ui="toast-stack-list"]')!;
    const collapsedHeight = list.getBoundingClientRect().height;
    await userEvent.hover(region);
    await expect(region).toHaveAttribute('data-expanded', 'true');
    // Unfolded, every card casts its own shadow again.
    await expect(getComputedStyle(region.querySelector('[data-ui="toast"]')!).boxShadow).not.toBe('none');
    // The list's block size animates between collapsed and expanded instead of snapping.
    await waitFor(async () => {
      await expect(list.getAnimations().length).toBeGreaterThan(0);
    });
    await within(region).findByText('Profile saved');
    await settled(region);
    await expect(within(region).getByText('Profile saved')).toBeVisible();
    await expect(list.getBoundingClientRect().height).toBeGreaterThan(collapsedHeight);
    await userEvent.unhover(region);
    await expect(region).toHaveAttribute('data-expanded', 'false');
    await userEvent.click(within(region).getByRole('button', { name: 'Expand notifications' }));
    await userEvent.unhover(region);
    await expect(region).toHaveAttribute('data-expanded', 'true');
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Outside' }));
    await expect(region).toHaveAttribute('data-expanded', 'false');
    await settled(region);
  },
};
export const PauseOnHover: Story = {
  name: 'Pause timed messages',
  parameters: { docs: {
    description: { story: 'Hover or focus the stack to pause its short dismissal countdown.' },
    source: { language: 'tsx', code: stackSource(messages.slice(0, 2).map((item) => ({ ...item, duration: 600 }))) },
  } },
  render: (args) => (
    <Harness {...args} initial={messages.slice(0, 2).map((item) => ({ ...item, duration: 600 }))} />
  ),
  play: async ({ canvasElement, userEvent }) => {
    const region = await bodyOf(canvasElement).findByRole('region', { name: 'Notifications' });
    await settled(region);
    await userEvent.hover(region);
    await sleep(750);
    await expect(region.querySelectorAll('[data-state="open"]')).toHaveLength(2);
    await userEvent.unhover(region);
    await waitFor(
      async () => {
        await expect(region.querySelectorAll('[data-state="open"]')).toHaveLength(0);
      },
      { timeout: 2500 },
    );
  },
};
export const LoadingUpdate: Story = {
  name: 'Complete a loading message',
  parameters: { docs: {
    description: { story: 'Select Complete to replace a loading message without adding another card.' },
    source: { language: 'tsx', code: stackSource([{ title: 'Saving project', loading: true }]) },
  } },
  render: (args) => <Harness {...args} initial={[{ title: 'Saving project', loading: true }]} />,
  play: async ({ canvasElement, userEvent }) => {
    const region = await bodyOf(canvasElement).findByRole('region', { name: 'Notifications' });
    await settled(region);
    const item = region.querySelector('[data-ui="toast"]');
    await expect(within(region).getAllByRole('status')).toHaveLength(1);
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Complete' }));
    await expect(await within(region).findByText('Saved successfully')).toBeVisible();
    await expect(region.querySelector('[data-ui="toast"]')).toBe(item);
    await expect(region.querySelector('[data-ui="spinner"]')).toBeNull();
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Unknown id' }));
    await expect(region.querySelector('[data-ui="toast"]')).toBe(item);
  },
};
export const UndoPrevented: Story = {
  name: 'Keep an action message open',
  parameters: { docs: {
    description: { story: 'Activate Undo without dismissing the notification.' },
    source: { language: 'tsx', code: `import { useEffect, useRef } from 'react';
import { Toast, ToastStack, styled, useToast } from '@jfrader/ui';

const Panel = styled.div({ position: 'relative', blockSize: '20rem' });

function ArchiveNotice() {
  const { toast } = useToast();
  const initialized = useRef(false);
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    toast({ title: 'Message archived', duration: null,
      action: { label: 'Undo', onClick: (event) => event.preventDefault() },
    });
  }, [toast]);
  return null;
}

<Toast max={12}>
  <ArchiveNotice />
  <Panel><ToastStack contained variant="list" /></Panel>
</Toast>` },
  } },
  args: { variant: 'list' },
  render: (args) => (
    <Harness
      {...args}
      initial={[{ title: 'Message archived', duration: null, action: { label: 'Undo', onClick: action } }]}
    />
  ),
  play: async ({ canvasElement, userEvent }) => {
    action.mockClear();
    const undo = await bodyOf(canvasElement).findByRole('button', { name: 'Undo' });
    undo.focus();
    await userEvent.keyboard('{Enter}');
    await expect(action).toHaveBeenCalledTimes(1);
    await expect(action.mock.calls[0]![0]).toEqual(expect.objectContaining({ defaultPrevented: true }));
    await userEvent.keyboard(' ');
    await expect(action).toHaveBeenCalledTimes(2);
    await expect(undo.closest('[data-ui="toast"]')).toHaveAttribute('data-state', 'open');
    await sleep(280);
  },
};
export const ControlledByImperativeQueue: Story = { ...LoadingUpdate, name: 'Controlled by imperative queue' };
export const UpdateFocusedAction: Story = {
  render: (args) => (
    <Harness {...args} mode="update" initial={[{ title: 'Saving project', loading: true }]} />
  ),
  play: async ({ canvasElement, userEvent }) => {
    const undo = await bodyOf(canvasElement).findByRole('button', { name: 'Save' });
    await sleep(280);
    undo.focus();
    const item = undo.closest('[data-ui="toast"]');
    await userEvent.keyboard('{Enter}');
    await expect(await bodyOf(canvasElement).findByText('Saved successfully')).toBeVisible();
    await expect(undo.closest('[data-ui="toast"]')).toBe(item);
    await expect(canvasElement.ownerDocument.activeElement).toBe(undo);
    await expect(item).toHaveAttribute('data-state', 'open');
    await sleep(280);
  },
};
export const ExternalAria: Story = {
  args: {
    'aria-label': 'Updates',
    'aria-labelledby': 'external-name missing-name',
    'aria-describedby': 'external-help missing-help',
  },
  render: (args) => (
    <>
      <span id="external-name">Inbox</span>
      <span id="external-help">Recent updates</span>
      <Harness {...args} />
    </>
  ),
  play: async ({ canvasElement }) => {
    const region = await bodyOf(canvasElement).findByRole('region', { name: 'Inbox' });
    await expect(region).toHaveAttribute('aria-label', 'Updates');
    await expect(region).toHaveAttribute('aria-labelledby', 'external-name missing-name');
    await expect(region).toHaveAttribute('aria-describedby', 'external-help missing-help');
    await settled(region);
  },
};
export const FalsyContent: Story = {
  args: { variant: 'list' },
  render: (args) => (
    <Harness
      {...args}
      initial={[false, null, 0, ''].map((value) => ({ title: value, description: value, duration: null }))}
    />
  ),
  play: async ({ canvasElement }) => {
    const region = await bodyOf(canvasElement).findByRole('region', { name: 'Notifications' });
    await settled(region);
    const regions = within(region).getAllByRole('status');
    await expect(regions[0]).toHaveTextContent('');
    await expect(regions[0]?.children).toHaveLength(2);
    await expect(regions[1]).toHaveTextContent('00');
    await expect(regions[2]).toBeEmptyDOMElement();
    await expect(regions[3]).toBeEmptyDOMElement();
  },
};
export const QueueEvictionFocus: Story = {
  args: { variant: 'list' },
  render: (args) => <Harness {...args} max={3} mode="evict" />,
  play: async ({ canvasElement, userEvent }) => {
    const region = await bodyOf(canvasElement).findByRole('region', { name: 'Notifications' });
    await settled(region);
    within(region).getAllByRole('button', { name: 'Create another' })[2]!.focus();
    await userEvent.keyboard('{Enter}');
    await expect(canvasElement.ownerDocument.activeElement).toBe(
      within(region).getAllByRole('button', { name: 'Dismiss' })[0],
    );
    await bodyOf(canvasElement).findByText('New notification');
    // Activation outside the queue must not drag unrelated page focus back into it.
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Unknown id' }));
    await expect(canvasElement.ownerDocument.activeElement).toBe(
      within(canvasElement).getByRole('button', { name: 'Unknown id' }),
    );
    await bodyOf(canvasElement).findByText('New notification');
    await expect(region.querySelectorAll('[data-ui="toast"]')).toHaveLength(3);
    await settled(region);
    await expect(bodyOf(canvasElement).getByText('New notification')).toBeVisible();
  },
};
export const Positions: Story = {
  name: 'Start-edge placement',
  parameters: { docs: {
    description: { story: 'Place the stack at the bottom start edge of its host.' },
    source: { language: 'tsx', code: stackSource(messages.slice(0, 3), 'position="bottom-start" ') },
  } },
  args: { position: 'bottom-start' },
  render: (args) => <Harness {...args} />,
};
/** The stack fills your own container; give it a positioned host and set `contained`. */
export const Contained: Story = {
  name: 'Contain notifications in a panel',
  parameters: { docs: {
    description: { story: 'Anchor the stack inside a taller positioned panel instead of the page viewport.' },
    source: { language: 'tsx', code: stackSource(messages.slice(0, 3), '', 12, '30rem') },
  } },
  args: { contained: true },
  render: (args) => <Harness {...args} blockSize="30rem" />,
};
export const RTL: Story = {
  args: { dir: 'rtl', position: 'bottom-start', variant: 'list' },
  render: (args) => <Harness {...args} />,
};
export const ReducedMotion: Story = {
  ...PersistentStack,
  name: 'Reduced motion',
  parameters: {
    docs: {
      description: {
        story:
          'Enable reduced motion to check that toasts settle immediately. This story checks CSS rules only.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const region = await bodyOf(canvasElement).findByRole('region', { name: 'Notifications' });
    await settled(region);
    const list = region.querySelector('[data-ui="toast-stack-list"]')!;
    await expect(mediaDeclarations(list, 'prefers-reduced-motion')).toContainEqual(
      expect.objectContaining({ transitionDuration: '0s' }),
    );
    await expect(mediaDeclarations(list.firstElementChild!, 'prefers-reduced-motion')).toContainEqual(
      expect.objectContaining({ transitionDuration: '0s' }),
    );
    const toast = region.querySelector('[data-ui="toast"]')!;
    const toastRules = mediaDeclarations(toast, 'prefers-reduced-motion');
    await expect(toastRules).toContainEqual(expect.objectContaining({ transitionDuration: '0s' }));
    // The open-state offsets keep their transform (the stack relies on it); only the closing slide is dropped.
    await expect(toastRules.every((rule) => rule.transform !== 'none')).toBe(true);
    const previousState = toast.getAttribute('data-state');
    toast.setAttribute('data-state', 'closing');
    await expect(mediaDeclarations(toast, 'prefers-reduced-motion')).toContainEqual(
      expect.objectContaining({ transform: 'none' }),
    );
    if (previousState === null) toast.removeAttribute('data-state');
    else toast.setAttribute('data-state', previousState);
  },
};
export const ForcedColors: Story = {
  ...PersistentStack,
  name: 'Forced colors',
  parameters: {
    docs: {
      description: {
        story:
          'Enable forced colors to check outlines in the browser. This story checks CSS rules only.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const region = await bodyOf(canvasElement).findByRole('region', { name: 'Notifications' });
    await settled(region);
    await expect(mediaDeclarations(region.querySelector('[data-ui="toast"]')!, 'forced-colors')).toContainEqual(
      expect.objectContaining({ backgroundColor: 'canvas', color: 'canvastext', borderColor: 'canvastext' }),
    );
  },
};
export const NarrowLongCopy: Story = {
  args: { variant: 'list', sx: { inlineSize: '18rem' } },
  render: (args) => (
    <Harness
      {...args}
      initial={[
        {
          title: 'Your international collaboration workspace is ready',
          description:
            'Invite teammates from workspace settings, choose their roles and send invitations by email.',
          duration: null,
        },
      ]}
    />
  ),
};
export const ScrollableQueue: Story = {
  args: { variant: 'list', contained: true },
  render: (args) => <Harness {...args} blockSize="12rem" initial={messages} />,
  play: async ({ canvasElement }) => {
    const region = await bodyOf(canvasElement).findByRole('region', { name: 'Notifications' });
    await settled(region);
    await expect(region.scrollHeight).toBeGreaterThan(region.clientHeight);
    const newest = region.querySelector<HTMLElement>('[data-ui="toast"]')!;
    await waitFor(async () => {
      await expect(newest.getBoundingClientRect().bottom).toBeLessThanOrEqual(
        region.getBoundingClientRect().bottom + 1,
      );
    });
    region.scrollTop = 0;
    await sleep(280);
    await expect(region.scrollTop).toBe(0);
  },
};
export const LightTheme: Story = {
  ...PersistentStack,
  name: 'Light theme',
  globals: { theme: 'light' },
  decorators: [withLightTheme],
};
function Scoped({ args }: { args: ToastStackProps }) {
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  return (
    <ThemeRoot theme="light" portalContainer={container}>
      <div ref={setContainer} />
      <Harness {...args} surface={false} initial={[]} />
    </ThemeRoot>
  );
}
/** Click Notify: the stack portals into the theme scope's container and keeps the light palette. */
export const ScopedPortal: Story = { args: { variant: 'list' }, render: (args) => <Scoped args={args} /> };

export const ConsumerEscapeVeto: Story = {
  args: {
    onKeyDown: fn((event) => {
      if (event.key === 'Escape') event.preventDefault();
    }),
  },
  render: (args) => <Harness {...args} initial={messages.slice(0, 1)} />,
  play: async ({ canvasElement, userEvent, args }) => {
    const region = await bodyOf(canvasElement).findByRole('region', { name: 'Notifications' });
    await settled(region);
    within(region).getByRole('button', { name: 'Dismiss' }).focus();
    await userEvent.keyboard('{Escape}');
    await expect(args.onKeyDown).toHaveBeenCalledTimes(1);
    await expect(args.onKeyDown).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'Escape', defaultPrevented: true }),
    );
    await expect(region.querySelector('[data-ui="toast"]')).toHaveAttribute('data-state', 'open');
  },
};

export const QueuedLifetime: Story = {
  render: (args) => (
    <Harness {...args} initial={messages.slice(0, 2).map((item) => ({ ...item, duration: 550 }))} />
  ),
  play: async ({ canvasElement }) => {
    const region = await bodyOf(canvasElement).findByRole('region', { name: 'Notifications' });
    await settled(region);
    await waitFor(
      async () => {
        await expect(region.querySelectorAll('[data-state="open"]')).toHaveLength(1);
      },
      { timeout: 1500 },
    );
    await expect(await within(region).findByText('Profile saved')).toBeInTheDocument();
    await sleep(180);
    await expect(region.querySelector('[data-state="open"]')).toHaveTextContent('Profile saved');
    await waitFor(
      async () => {
        await expect(region.querySelectorAll('[data-state="open"]')).toHaveLength(0);
      },
      { timeout: 1500 },
    );
  },
};

// This story tests the documented css/slot API and native style merging.
export const StylingAndRef: Story = {
  args: {
    variant: 'list',
    ref: fn(),
    sx: { paddingInlineStart: vars.space[8] },
    slotProps: { list: { sx: { borderBlockStart: `2px solid ${vars.color.borderControl}` } } },
  },
  render: (args) => <Harness {...args} />,
  play: async ({ canvasElement, args }) => {
    const region = await bodyOf(canvasElement).findByRole('region', { name: 'Notifications' });
    await settled(region);
    await expect(args.ref).toHaveBeenCalledWith(region);
    await expect(Math.abs(parseFloat(getComputedStyle(region).paddingInlineStart) - 32)).toBeLessThan(1.1);
    const list = region.querySelector<HTMLElement>('[data-ui="toast-stack-list"]')!;
    await expect(getComputedStyle(list).borderBlockStartStyle).toBe('solid');
    await expect(Math.abs(parseFloat(getComputedStyle(list).borderBlockStartWidth) - 2)).toBeLessThan(1.1);
  },
};

export const NativeDismissKeys: Story = {
  args: { variant: 'list' },
  render: (args) => <Harness {...args} initial={messages.slice(0, 2)} />,
  play: async ({ canvasElement, userEvent }) => {
    const region = await bodyOf(canvasElement).findByRole('region', { name: 'Notifications' });
    await settled(region);
    within(region).getAllByRole('button', { name: 'Dismiss' })[0]!.focus();
    await userEvent.keyboard('{Enter}');
    await expect(region.querySelectorAll('[data-state="open"]')).toHaveLength(1);
    await expect(canvasElement.ownerDocument.activeElement).toBe(
      within(region).getByRole('button', { name: 'Dismiss' }),
    );
    await userEvent.keyboard(' ');
    await expect(region.querySelectorAll('[data-state="open"]')).toHaveLength(0);
    await waitFor(async () => {
      await expect(region.querySelectorAll('[data-ui="toast"]')).toHaveLength(0);
    });
  },
};

export const EditableHotkey: Story = {
  args: { hotkey: true },
  render: (args) => (
    <>
      <label>
        Draft
        <FixtureInput />
      </label>
      <Harness {...args} />
    </>
  ),
  play: async ({ canvasElement, userEvent }) => {
    const region = await bodyOf(canvasElement).findByRole('region', { name: 'Notifications' });
    await settled(region);
    const input = within(canvasElement).getByRole('textbox', { name: 'Draft' });
    await userEvent.click(input);
    await userEvent.keyboard('{Alt>}t{/Alt}');
    await expect(canvasElement.ownerDocument.activeElement).toBe(input);
    await expect(region).toHaveAttribute('data-expanded', 'false');
  },
};

const LIFETIME_MS = 1000;
function LifetimeControls() {
  const api = useToast();
  const id = useRef('');
  return (
    <ActionRow>
      <Button onClick={() => (id.current = api.toast({ title: 'Syncing files', duration: LIFETIME_MS }))}>
        Notify timed
      </Button>
      <Button onClick={() => api.update(id.current, { title: 'Syncing 3 files' })}>Rename</Button>
      <Button onClick={() => api.update(id.current, { duration: LIFETIME_MS * 2 })}>Extend</Button>
    </ActionRow>
  );
}
export const UpdateLifetime: Story = {
  name: 'Update restarts the lifetime only when the duration changes',
  render: (args) => (
    <Toast>
      <LifetimeControls />
      <Surface>
        <ToastStack contained {...args} />
      </Surface>
    </Toast>
  ),
  play: async ({ canvasElement, userEvent }) => {
    const region = await bodyOf(canvasElement).findByRole('region', { name: 'Notifications' });
    const open = () => region.querySelectorAll('[data-state="open"]');
    // Title-only update: the countdown keeps its elapsed time.
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Notify timed' }));
    await settled(region);
    await sleep(500);
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Rename' }));
    await expect(await within(region).findByText('Syncing 3 files')).toBeVisible();
    await sleep(400);
    await waitFor(
      async () => {
        await expect(open()).toHaveLength(0);
      },
      { timeout: 300 },
    );
    // Duration update: the countdown restarts from the new duration.
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Notify timed' }));
    await settled(region);
    await sleep(500);
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Extend' }));
    await sleep(LIFETIME_MS - 500);
    await expect(open()).toHaveLength(1);
    await waitFor(
      async () => {
        await expect(open()).toHaveLength(0);
      },
      { timeout: LIFETIME_MS * 2 },
    );
  },
};

class ProviderBoundary extends Component<{ children: ReactNode }, { error: string | null }> {
  state: { error: string | null } = { error: null };
  static getDerivedStateFromError(error: Error) {
    return { error: error.message };
  }
  render() {
    return this.state.error ? <div role="alert">{this.state.error}</div> : this.props.children;
  }
}
export const MissingProvider: Story = {
  beforeEach: () => {
    const error = spyOn(console, 'error').mockImplementation(() => {});
    return () => error.mockRestore();
  },
  render: (args) => (
    <ProviderBoundary>
      <ToastStack {...args} />
    </ProviderBoundary>
  ),
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('alert')).toHaveTextContent(
      'Toast.Stack must be rendered inside <Toast.Provider>.',
    );
  },
};

export const SecondRendererWarning: Story = {
  tags: ['!autodocs'],
  beforeEach: () => {
    const warn = spyOn(console, 'warn').mockImplementation(() => {});
    return () => warn.mockRestore();
  },
  render: (args) => (
    <Toast>
      <ToastStack {...args} />
      <Toast.Viewport />
    </Toast>
  ),
  play: async ({ canvasElement }) => {
    await bodyOf(canvasElement).findByRole('region', { name: 'Notifications' });
    await waitFor(async () => {
      await expect(console.warn).toHaveBeenCalledTimes(1);
    });
    await expect(console.warn).toHaveBeenCalledWith('Mount only one Toast queue renderer per provider.');
  },
};
