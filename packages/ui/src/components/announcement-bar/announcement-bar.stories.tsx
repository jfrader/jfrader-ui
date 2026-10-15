import { act, useRef, useState, type ComponentPropsWithRef } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, waitFor, within } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { withLightTheme } from '../../testing/story-decorators';
import { Button } from '../button';
import { AnnouncementBar, type AnnouncementBarProps, type AnnouncementBarTone } from './index';

const messages = [
  {
    id: 'release',
    message: 'The new workspace is ready.',
    action: { label: 'Explore workspace', onClick: fn() },
  },
  { id: 'maintenance', message: 'Scheduled maintenance on Sunday.' },
  { id: 'export', message: 'Export your projects in one click.' },
];
const NOW = Date.parse('2026-12-01T12:00:00Z');
function SlotNext(props: ComponentPropsWithRef<'button'>) {
  return <button {...props} data-slot="announcement-bar-next" />;
}
function SlotPrevious(props: ComponentPropsWithRef<'button'>) {
  return <button {...props} data-slot="announcement-bar-previous" />;
}
const clock = () => NOW;
const part = (root: HTMLElement, name: string) =>
  root.querySelector<HTMLElement>(`[data-ui="announcement-bar-${name}"]`);
const meta = {
  title: 'Data/AnnouncementBar',
  component: AnnouncementBar,
  tags: ['autodocs'],
  args: {
    messages,
    onOpenChange: fn(),
    onValueChange: fn(),
    onPausedChange: fn(),
    onAction: fn(),
    onCountdownEnd: fn(),
  },
  parameters: {
    docs: {
      description: {
        component:
          'Show an announcement that people can dismiss. Rotate through messages when autoplay is enabled.',
      },
      usage: `- The announcement is a named region. Rotation follows the APG basic carousel pattern.
- Control \`open\`, \`value\`, and \`paused\`, or initialize each with its default prop. Do not switch modes while mounted. Rejected requests leave that state unchanged.
- Your app stores dismissal state. Set \`dismissFocusRef\` to choose where focus goes after keyboard dismissal.
- Focus stops rotation until Resume. Hover and a hidden document pause it temporarily. Reduced motion disables autoplay.
- Live announcements are off by default. When enabled, polite announcements exclude the Countdown timer.

### Keyboard
- Tab visits controls. Enter/Space activate buttons; Enter activates links.
- Arrow keys and Escape keep their native behavior.`,
    },
  },
} satisfies Meta<typeof AnnouncementBar>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('region', { name: 'Announcements' })).toBeVisible();
    await expect(part(canvasElement, 'content')).toHaveAttribute('aria-live', 'off');
    await expect(part(canvasElement, 'message')).toHaveAttribute('aria-live', 'off');
    const next = canvas.getByRole('button', { name: 'Next announcement' });
    await expect(next.getAttribute('aria-controls')).toBe(part(canvasElement, 'content')?.id);
    await expect(canvas.getByRole('group', { name: '1 of 3' })).toHaveAttribute(
      'aria-roledescription',
      'slide',
    );
  },
};
export const Inverted: Story = { args: { variant: 'inverted' } };
export const AllTones: Story = {
  render: (args) => (
    <div style={{ display: 'grid', gap: vars.space[4] }}>
      {(['neutral', 'info', 'warning', 'danger'] as const).map((tone: AnnouncementBarTone) => (
        <AnnouncementBar {...args} key={tone} tone={tone} label={`${tone} announcements`} />
      ))}
    </div>
  ),
};
export const Single: Story = {
  args: { messages: [messages[0]!], autoPlay: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.queryByRole('button', { name: 'Next announcement' }),
    ).not.toBeInTheDocument();
    await expect(canvas.queryByRole('button', { name: /announcements$/ })).not.toBeInTheDocument();
  },
};
export const MultipleManual: Story = {
  play: async ({ canvasElement, args, userEvent }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Previous announcement' }));
    await waitFor(async () => {
      await expect(canvas.getByText(messages[2]!.message)).toBeVisible();
    });
    await expect(args.onValueChange).toHaveBeenNthCalledWith(1, 2);
    await userEvent.click(canvas.getByRole('button', { name: 'Next announcement' }));
    await waitFor(async () => {
      await expect(canvas.getByText(messages[0]!.message)).toBeVisible();
    });
    await expect(args.onValueChange).toHaveBeenNthCalledWith(2, 0);
    await expect(args.onValueChange).toHaveBeenCalledTimes(2);
  },
};
export const AutoPlayWithPause: Story = {
  args: { autoPlay: true, controls: false, interval: 60000 },
  parameters: {
    docs: {
      description: {
        story:
          'Reduced motion disables rotation, so this play skips when that preference is set. See Reduced Motion for that case.',
      },
    },
  },
  play: async ({ canvasElement, userEvent }) => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', { name: 'Previous announcement' })).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'Next announcement' })).toBeVisible();
    await userEvent.tab();
    const resume = canvas.getByRole('button', { name: 'Resume announcements' });
    await expect(canvasElement.ownerDocument.activeElement).toBe(resume);
    await expect(resume).not.toHaveAttribute('aria-pressed');
    await userEvent.keyboard('{Enter}');
    await expect(canvas.getByRole('button', { name: 'Pause announcements' })).toBe(resume);
    await userEvent.keyboard(' ');
    await expect(canvas.getByRole('button', { name: 'Resume announcements' })).toBe(resume);
    await expect(canvasElement.querySelector('section')).toHaveAttribute('data-running', 'false');
    // The focus-into-content safety stop (rotation must never move focus) is exercised through
    // the data-running attribute in browser QA: the vitest page reports itself as hidden, so
    // rotation cannot run here.
  },
};

function DismissFixture(args: AnnouncementBarProps) {
  const destination = useRef<HTMLButtonElement>(null);
  return (
    <>
      <AnnouncementBar {...args} dismissFocusRef={destination} />
      <Button ref={destination}>Continue to workspace</Button>
    </>
  );
}
export const Dismissible: Story = {
  args: {
    messages: [{ id: 'notice', message: 'A new release is available.' }],
  },
  render: (args) => <DismissFixture {...args} />,
  play: async ({ canvasElement, userEvent, args }) => {
    const canvas = within(canvasElement);
    await userEvent.tab();
    const dismiss = canvas.getByRole('button', {
      name: 'Dismiss announcement',
    });
    await expect(canvasElement.ownerDocument.activeElement).toBe(dismiss);
    await userEvent.keyboard('{Enter}');
    await expect(args.onOpenChange).toHaveBeenCalledTimes(1);
    await expect(args.onOpenChange).toHaveBeenCalledWith(false);
    const root = canvasElement.querySelector('section');
    if (root) await expect(root).toHaveAttribute('inert');
    await expect(canvasElement.ownerDocument.activeElement).toBe(
      canvas.getByRole('button', { name: 'Continue to workspace' }),
    );
    await waitFor(async () => {
      await expect(canvasElement.querySelector('section')).toBeNull();
    });
  },
};
export const NonDismissible: Story = { args: { dismissible: false } };
export const PersistentOpen: Story = { args: { open: true } };
export const Countdown: Story = {
  args: {
    live: 'polite',
    messages: [
      {
        id: 'deadline',
        message: 'Registration closes soon.',
        countdown: {
          target: NOW + 60000,
          clock,
          label: 'Registration deadline',
          units: ['minutes', 'seconds'],
        },
      },
    ],
  },
  play: async ({ canvasElement }) => {
    const timer = within(canvasElement).getByRole('timer', {
      name: 'Registration deadline',
    });
    await expect(timer).toHaveAttribute('aria-live', 'off');
    await expect(part(canvasElement, 'message')).toHaveAttribute('aria-live', 'polite');
    await expect(part(canvasElement, 'message')?.contains(timer)).toBe(false);
  },
};
export const LightTheme: Story = {
  decorators: [withLightTheme],
  globals: { theme: 'light' },
};
export const InvertedLight: Story = {
  ...LightTheme,
  args: { variant: 'inverted' },
};
export const NarrowLongContent: Story = {
  args: {
    messages: [
      {
        id: 'long',
        message:
          'A detailed announcement that wraps naturally across several lines without hiding any of the information needed to prepare for the next scheduled maintenance window.',
        action: { label: 'Read the maintenance schedule' },
      },
    ],
  },
  render: (args) => (
    <div style={{ inlineSize: '320px', maxInlineSize: '100%' }}>
      <AnnouncementBar {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const root = within(canvasElement).getByRole('region');
    await expect(root.scrollWidth).toBeLessThanOrEqual(root.clientWidth + 1);
    for (const button of within(root).getAllByRole('button'))
      await expect(button.getBoundingClientRect().height).toBeGreaterThanOrEqual(31);
  },
};
export const CenteredFlexParent: Story = {
  render: (args) => (
    <div style={{ display: 'flex', justifyContent: 'center' }}>
      <AnnouncementBar {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const { width, height } = within(canvasElement).getByRole('region').getBoundingClientRect();
    await expect(width).toBeGreaterThanOrEqual(239);
    await expect(height).toBeLessThan(200);
  },
};
export const Empty: Story = {
  args: { messages: [] },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('section')).toBeNull();
  },
};
export const RTL: Story = {
  args: {
    dir: 'rtl',
    locale: 'ar',
    label: 'Announcements',
    getMessageLabel: (index, total) =>
      `${new Intl.NumberFormat('ar').format(index + 1)} / ${new Intl.NumberFormat('ar').format(total)}`,
  },
  play: async ({ canvasElement }) => {
    await expect(getComputedStyle(within(canvasElement).getByRole('region')).direction).toBe('rtl');
  },
};
export const ReducedMotion: Story = {
  args: { autoPlay: true, defaultPaused: true },
  parameters: {
    docs: {
      description: {
        story:
          'Enable reduced motion in the browser. Autoplay should stop and collapse should happen without animation. This example shows the paused state.',
      },
    },
  },
};
export const ForcedColors: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Enable forced colors in the browser to check system colors on controls and borders.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    for (const button of within(canvasElement).getAllByRole('button'))
      await expect(getComputedStyle(button).borderStyle).not.toBe('none');
  },
};

export const Keyboard: Story = {
  args: { autoPlay: true, interval: 60000 },
  play: async ({ canvasElement, userEvent, args }) => {
    const canvas = within(canvasElement);
    await userEvent.tab();
    const rotation = canvas.getByRole('button', {
      name: 'Resume announcements',
    });
    await expect(canvasElement.ownerDocument.activeElement).toBe(rotation);
    await expect(getComputedStyle(rotation).outlineStyle).not.toBe('none');
    await expect(args.onPausedChange).toHaveBeenCalledTimes(1);
    await expect(args.onPausedChange).toHaveBeenCalledWith(true);
    await userEvent.tab();
    const action = canvas.getByRole('button', { name: 'Explore workspace' });
    await expect(canvasElement.ownerDocument.activeElement).toBe(action);
    await userEvent.keyboard('{Enter}');
    await expect(args.onAction).toHaveBeenCalledTimes(1);
    await expect(args.onAction).toHaveBeenCalledWith(messages[0]);
    await userEvent.tab();
    const previous = canvas.getByRole('button', {
      name: 'Previous announcement',
    });
    await expect(canvasElement.ownerDocument.activeElement).toBe(previous);
    await userEvent.keyboard(' ');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenCalledWith(2);
    await expect(canvasElement.ownerDocument.activeElement).toBe(previous);
    await userEvent.keyboard('{ArrowRight}{Escape}');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await userEvent.tab({ shift: true });
    await expect(canvasElement.ownerDocument.activeElement).toBe(rotation);
    await userEvent.keyboard('{Enter}');
    await expect(args.onPausedChange).toHaveBeenNthCalledWith(2, false);
    await userEvent.keyboard(' ');
    await expect(args.onPausedChange).toHaveBeenNthCalledWith(3, true);
    await expect(args.onPausedChange).toHaveBeenCalledTimes(3);
  },
};
export const ControlledRejects: Story = {
  args: { open: true, value: 0, paused: true, autoPlay: true },
  play: async ({ canvasElement, args, userEvent }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Resume announcements' }));
    await expect(args.onPausedChange).toHaveBeenCalledTimes(1);
    await expect(args.onPausedChange).toHaveBeenCalledWith(false);
    await expect(canvas.getByRole('button', { name: 'Resume announcements' })).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'Previous announcement' }));
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenCalledWith(2);
    await expect(canvas.getByText(messages[0]!.message)).toBeVisible();
    const dismiss = canvas.getByRole('button', {
      name: 'Dismiss announcement',
    });
    await userEvent.click(dismiss);
    await expect(args.onOpenChange).toHaveBeenCalledTimes(1);
    await expect(args.onOpenChange).toHaveBeenCalledWith(false);
    await expect(canvas.getByRole('region')).not.toHaveAttribute('inert');
    await expect(canvasElement.ownerDocument.activeElement).toBe(dismiss);
  },
};
export const ExternalAria: Story = {
  args: {
    'aria-label': 'Fallback name',
    'aria-labelledby': 'external-name missing-name',
    'aria-describedby': 'external-description missing-description',
  },
  render: (args) => (
    <>
      <p id="external-name">Campaign news</p>
      <p id="external-description">Workspace announcements</p>
      <AnnouncementBar {...args} />
    </>
  ),
  play: async ({ canvasElement }) => {
    const root = within(canvasElement).getByRole('region', {
      name: 'Campaign news',
    });
    await expect(root).toHaveAttribute('aria-label', 'Fallback name');
    await expect(root).toHaveAttribute('aria-labelledby', 'external-name missing-name');
    await expect(root).toHaveAttribute(
      'aria-describedby',
      'external-description missing-description',
    );
  },
};
export const FalsyMessage: Story = {
  render: (args) => (
    <div style={{ display: 'grid', gap: vars.space[4] }}>
      {[false, null, 0, ''].map((node, index) => (
        <AnnouncementBar
          {...args}
          key={index}
          label={`Falsy ${index}`}
          messages={[{ id: String(index), message: node, action: { label: node } }]}
        />
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    const roots = within(canvasElement).getAllByRole('region');
    for (const index of [0, 1, 3]) {
      await expect(part(roots[index]!, 'message')).toBeNull();
      await expect(within(roots[index]!).queryByRole('button', { name: '0' })).toBeNull();
    }
    await expect(part(roots[2]!, 'message')).toHaveTextContent('0');
    await waitFor(async () => {
      await expect(within(roots[2]!).getByRole('button', { name: '0' })).toBeVisible();
    });
  },
};
function StorageRecipe(args: AnnouncementBarProps) {
  const [open, setOpen] = useState(true);
  return (
    <>
      <AnnouncementBar
        {...args}
        id="campaign"
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          args.onOpenChange?.(next);
        }}
      />
      <Button onClick={() => setOpen(true)}>Show campaign</Button>
    </>
  );
}
export const StorageDelegation: Story = {
  render: (args) => <StorageRecipe {...args} />,
  parameters: {
    docs: {
      source: {
        code: '<AnnouncementBar messages={announcements} open={campaignOpen} onOpenChange={setCampaignOpen} dismissFocusRef={headerLinkRef} />',
      },
      description: {
        story:
          'Your app decides when to show a campaign and whether to store that choice. This example keeps it in memory.',
      },
    },
  },
};
function Replacement(args: AnnouncementBarProps) {
  const [target, setTarget] = useState(NOW - 1);
  return (
    <>
      <AnnouncementBar
        {...args}
        messages={[
          {
            id: 'campaign',
            message: 'Registration deadline',
            countdown: { target, clock, completeLabel: 'Closed' },
          },
          messages[1]!,
        ]}
      />
      <Button onClick={() => setTarget(NOW - 2)}>Replace target</Button>
    </>
  );
}
export const TargetReplacement: Story = {
  render: (args) => <Replacement {...args} />,
  play: async ({ canvasElement, args, userEvent }) => {
    const canvas = within(canvasElement);
    await waitFor(async () => {
      await expect(args.onCountdownEnd).toHaveBeenCalledTimes(1);
    });
    await userEvent.click(canvas.getByRole('button', { name: 'Next announcement' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Previous announcement' }));
    await expect(args.onCountdownEnd).toHaveBeenCalledTimes(1);
    await userEvent.click(canvas.getByRole('button', { name: 'Replace target' }));
    await waitFor(async () => {
      await expect(args.onCountdownEnd).toHaveBeenCalledTimes(2);
    });
  },
};
export const Slots: Story = {
  args: {
    slots: { next: SlotNext, previous: SlotPrevious },
    slotProps: {
      root: { css: { paddingInline: vars.space[2] } },
      message: { css: { fontWeight: vars.fontWeight.semibold } },
      next: { css: { borderRadius: 0 } },
    },
    sx: { paddingInline: vars.space[4] },
  },
  play: async ({ canvasElement }) => {
    for (const name of ['next', 'previous']) {
      const replacement = canvasElement.querySelector(`[data-slot="announcement-bar-${name}"]`)!;
      await expect(replacement).toBeInTheDocument();
      await expect(replacement).toHaveAttribute('data-ui', `announcement-bar-${name}`);
      await expect(replacement).toHaveAttribute('aria-controls', part(canvasElement, 'content')!.id);
      await expect(getComputedStyle(replacement).whiteSpace).toBe('normal');
      await expect(canvasElement.querySelector(`[data-ui="announcement-bar-${name}"]:not([data-slot])`)).toBeNull();
    }
    await expect(getComputedStyle(part(canvasElement, 'message')!).fontWeight).toBe('600');
    await expect(
      getComputedStyle(
        within(canvasElement).getByRole('button', {
          name: 'Next announcement',
        }),
      ).borderRadius,
    ).toBe('0px');
    await expect(
      Math.abs(
        parseFloat(getComputedStyle(within(canvasElement).getByRole('region')).paddingInlineStart) -
          16,
      ),
    ).toBeLessThan(1.1);
  },
};
export const NativeLink: Story = {
  args: {
    messages: [
      {
        id: 'link',
        message: 'Read the release notes.',
        action: {
          label: 'Release notes',
          href: '#release-notes',
          onClick: (event) => event.preventDefault(),
        },
      },
    ],
  },
  play: async ({ canvasElement, args, userEvent }) => {
    const link = within(canvasElement).getByRole('link', {
      name: 'Release notes',
    });
    await userEvent.tab();
    await expect(canvasElement.ownerDocument.activeElement).toBe(link);
    await expect(getComputedStyle(link).outlineStyle).not.toBe('none');
    await userEvent.keyboard(' ');
    await expect(args.onAction).not.toHaveBeenCalled();
    await userEvent.keyboard('{Enter}');
    await expect(args.onAction).not.toHaveBeenCalled();
  },
};
export const InvalidInputs: Story = {
  args: { value: Infinity, interval: NaN, autoPlay: true, paused: true },
  play: async ({ canvasElement }) => {
    await waitFor(async () => {
      await expect(within(canvasElement).getByRole('group', { name: '1 of 3' })).toBeVisible();
    });
  },
};

const TEST_INTERVAL = 4321;
function TimingFixture(args: AnnouncementBarProps) {
  const [mounted, setMounted] = useState(false);
  return (
    <>
      <Button onClick={() => setMounted((value) => !value)}>
        {mounted ? 'Unmount banner' : 'Mount banner'}
      </Button>
      {mounted && <AnnouncementBar {...args} autoPlay interval={TEST_INTERVAL} />}
    </>
  );
}
export const RotationTiming: Story = {
  render: (args) => <TimingFixture {...args} />,
  play: async ({ canvasElement, args, userEvent }) => {
    const canvas = within(canvasElement);
    const original = window.setTimeout.bind(window);
    const timers = new Map<number, () => void>();
    const delays = new Map<number, number>();
    let timerId = -1;
    let now = NOW;
    const originalNow = Date.now;
    Date.now = () => now;
    window.setTimeout = ((handler: TimerHandler, delay?: number, ...params: unknown[]) => {
      if (
        (delay === TEST_INTERVAL || delay === TEST_INTERVAL - 1000) &&
        typeof handler === 'function'
      ) {
        const id = timerId--;
        timers.set(id, () => handler(...params));
        delays.set(id, delay);
        return id;
      }
      return original(handler, delay, ...params);
    }) as typeof window.setTimeout;
    const originalClear = window.clearTimeout.bind(window);
    window.clearTimeout = (id) => {
      if (typeof id === 'number') timers.delete(id);
      originalClear(id);
    };
    try {
      await userEvent.click(canvas.getByRole('button', { name: 'Mount banner' }));
      await userEvent.unhover(canvas.getByRole('button', { name: 'Unmount banner' }));
      await waitFor(async () => {
        await expect(timers.size).toBe(1);
      });
      const tick = async () => {
        const [id, callback] = [...timers.entries()][0]!;
        timers.delete(id);
        now += TEST_INTERVAL;
        await act(async () => callback());
      };
      await tick();
      await expect(args.onValueChange).toHaveBeenCalledTimes(1);
      await expect(args.onValueChange).toHaveBeenCalledWith(1);
      await waitFor(async () => {
        await expect(canvas.getByText(messages[1]!.message)).toBeVisible();
      });
      now += 1000;
      await userEvent.hover(canvas.getByRole('region'));
      await expect(timers.size).toBe(0);
      await expect(args.onPausedChange).not.toHaveBeenCalled();
      await userEvent.unhover(canvas.getByRole('region'));
      await expect(timers.size).toBe(1);
      await expect(delays.get([...timers.keys()][0]!)).toBe(TEST_INTERVAL - 1000);
      const doc = canvasElement.ownerDocument;
      const visibility = Object.getOwnPropertyDescriptor(doc, 'visibilityState');
      try {
        Object.defineProperty(doc, 'visibilityState', {
          configurable: true,
          value: 'hidden',
        });
        await act(async () => doc.dispatchEvent(new Event('visibilitychange')));
        await expect(timers.size).toBe(0);
        Object.defineProperty(doc, 'visibilityState', {
          configurable: true,
          value: 'visible',
        });
        await act(async () => doc.dispatchEvent(new Event('visibilitychange')));
        await expect(timers.size).toBe(1);
        await expect(delays.get([...timers.keys()][0]!)).toBe(TEST_INTERVAL - 1000);
      } finally {
        if (visibility) Object.defineProperty(doc, 'visibilityState', visibility);
        else Reflect.deleteProperty(doc, 'visibilityState');
      }
      await userEvent.tab();
      await expect(canvas.getByRole('button', { name: 'Resume announcements' })).toBe(
        canvasElement.ownerDocument.activeElement,
      );
      await expect(timers.size).toBe(0);
      await userEvent.tab();
      await expect(timers.size).toBe(0);
      await userEvent.tab({ shift: true });
      await userEvent.keyboard('{Enter}');
      await waitFor(async () => {
        await expect(timers.size).toBe(1);
      });
      await tick();
      await expect(args.onValueChange).toHaveBeenNthCalledWith(2, 2);
      await userEvent.click(canvas.getByRole('button', { name: 'Unmount banner' }));
      await expect(timers.size).toBe(0);
    } finally {
      window.setTimeout = original;
      window.clearTimeout = originalClear;
      Date.now = originalNow;
    }
  },
};

export const RefAttachment: Story = {
  args: { ref: fn() },
  play: async ({ canvasElement, args }) => {
    await expect(args.ref).toHaveBeenCalled();
    const spy = args.ref as ReturnType<typeof fn>;
    await expect(
      spy.mock.calls.some(([element]) => element === canvasElement.querySelector('section')),
    ).toBe(true);
  },
};
export const ActionVeto: Story = {
  args: {
    slotProps: { action: { onClick: (event) => event.preventDefault() } },
  },
  play: async ({ canvasElement, args, userEvent }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Explore workspace' }));
    await expect(args.onAction).not.toHaveBeenCalled();
  },
};
export const InvalidCountdown: Story = {
  args: {
    messages: [
      {
        id: 'invalid',
        message: 'Deadline unavailable.',
        countdown: { target: 'invalid', clock },
      },
    ],
  },
  play: async ({ canvasElement, args }) => {
    await expect(within(canvasElement).getByRole('timer')).toHaveAttribute('data-state', 'invalid');
    await expect(args.onCountdownEnd).not.toHaveBeenCalled();
  },
};

export const FocusSafetyRejects: Story = {
  args: { paused: false, autoPlay: true, interval: 60000 },
  render: (args) => (
    <>
      <Button>Before announcements</Button>
      <AnnouncementBar {...args} />
      <Button>After announcements</Button>
    </>
  ),
  play: async ({ canvasElement, userEvent, args }) => {
    const canvas = within(canvasElement);
    await userEvent.tab();
    await userEvent.tab();
    await expect(args.onPausedChange).toHaveBeenCalledTimes(1);
    await expect(args.onPausedChange).toHaveBeenCalledWith(true);
    await expect(canvas.getByRole('button', { name: 'Resume announcements' })).toBe(
      canvasElement.ownerDocument.activeElement,
    );
    await userEvent.click(canvas.getByRole('button', { name: 'After announcements' }));
    await expect(canvas.getByRole('region')).toHaveAttribute('data-running', 'false');
    await userEvent.click(canvas.getByRole('button', { name: 'Next announcement' }));
    await expect(args.onPausedChange).toHaveBeenCalledTimes(1);
    await expect(canvas.getByRole('region')).toHaveAttribute('data-running', 'false');
  },
};

function ExternalStateFixture(args: AnnouncementBarProps) {
  const [value, setValue] = useState(0);
  const [open, setOpen] = useState(true);
  const [paused, setPaused] = useState(false);
  return (
    <>
      <AnnouncementBar {...args} value={value} open={open} paused={paused} />
      <Button
        onClick={() => {
          setValue(2);
          setPaused(true);
        }}
      >
        Update announcement
      </Button>
      <Button onClick={() => setOpen(!open)}>Toggle visibility</Button>
    </>
  );
}
export const ExternalStateUpdates: Story = {
  render: (args) => <ExternalStateFixture {...args} />,
  play: async ({ canvasElement, args, userEvent }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Update announcement' }));
    await waitFor(async () => {
      await expect(canvas.getByText(messages[2]!.message)).toBeVisible();
    });
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await expect(args.onPausedChange).not.toHaveBeenCalled();
    await userEvent.click(canvas.getByRole('button', { name: 'Toggle visibility' }));
    await waitFor(async () => {
      await expect(canvasElement.querySelector('section')).toBeNull();
    });
    await expect(args.onOpenChange).not.toHaveBeenCalled();
    await userEvent.click(canvas.getByRole('button', { name: 'Toggle visibility' }));
    await expect(canvas.getByRole('region')).toHaveAttribute('data-state', 'open');
  },
};
