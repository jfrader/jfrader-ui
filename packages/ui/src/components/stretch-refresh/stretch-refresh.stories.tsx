import { useRef, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fireEvent, fn, spyOn, waitFor } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { css } from '../../styling/css';
import { withLightTheme } from '../../testing/story-decorators';
import { Button } from '../button';
import { StretchRefresh, type StretchRefreshProps } from './index';

type Item = { id: string; title: string };
const ITEMS = [
  { id: 'review', title: 'Mira reviewed the launch checklist' },
  { id: 'draft', title: 'Owen saved a new draft' },
  { id: 'invite', title: 'A team invitation arrived' },
];
const frameStyle = css({
  inlineSize: '28rem',
  maxInlineSize: '100%',
  blockSize: '24rem',
  display: 'flex',
  flexDirection: 'column',
});
const narrowStyle = css({ inlineSize: '14rem', maxInlineSize: '100%' });
const overrideStyle = css({
  paddingInline: vars.space[8],
  background: vars.color.surfaceRaised,
});
const SOURCE = `<div style={{ height: '24rem', display: 'flex', flexDirection: 'column' }}>
  <StretchRefresh title="Activity" items={items} getKey={item => item.id}
    renderItem={item => item.title} onRefresh={reloadItems} sx={{ flex: 1 }} />
</div>`;
const meta = {
  title: 'Data display/StretchRefresh',
  component: StretchRefresh<Item>,
  tags: ['autodocs'],
  args: {
    title: 'Activity',
    items: ITEMS,
    getKey: (item: Item) => item.id,
    renderItem: (item: Item) => item.title,
    onRefresh: fn(async () => undefined),
    onRefreshingChange: fn(),
    sx: { flex: 1 },
  },
  decorators: [
    (Story) => (
      <div css={frameStyle}>
        <Story />
      </div>
    ),
  ],
  parameters: {
    docs: {
      source: { code: SOURCE },
      description: {
        component:
          'Refresh a sized, scrollable feed by pulling downward from its top or activating the persistent native Refresh button. Enter and Space activate once; Tab and Shift+Tab navigate the button, scroll region and item controls. Arrows and Page keys scroll normally; Escape cancels a pull. The button follows the APG button pattern; there is no special pull-to-refresh ARIA pattern. Wheel gestures are not intercepted. Consumers update items before resolving onRefresh and own fetching and cancellation. Controlled refreshing accepts requests in the interaction commit; later external true is display-only. Reduced motion keeps the threshold and status without displacement. Names and descriptions on slotProps.feed merge with the heading and subtitle. Nontext headings require a consumer accessible name. Real touch negotiation and screen-reader announcements require device QA.',
      },
    },
  },
} satisfies Meta<typeof StretchRefresh<Item>>;
export default meta;
type Story = StoryObj<typeof StretchRefresh<Item>>;
const part = (root: HTMLElement, name: string) =>
  root.querySelector<HTMLElement>(`[data-ui="stretch-refresh-${name}"]`)!;
const frame = () =>
  new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );
function deferred() {
  let resolve!: (message?: string) => void;
  let reject!: () => void;
  const promise = new Promise<string | void>((yes, no) => {
    resolve = yes;
    reject = () => no(new globalThis.Error('Offline'));
  });
  return { promise, resolve, reject };
}
function pointer(feed: HTMLElement) {
  const captured = new Set<number>();
  spyOn(feed, 'setPointerCapture').mockImplementation((id) => {
    captured.add(id);
  });
  spyOn(feed, 'hasPointerCapture').mockImplementation((id) => captured.has(id));
  spyOn(feed, 'releasePointerCapture').mockImplementation((id) => {
    captured.delete(id);
  });
  return (type: string, y: number, target: Element = feed, x = 0) =>
    fireEvent(
      target,
      new PointerEvent(type, {
        bubbles: true,
        cancelable: true,
        pointerId: 1,
        pointerType: 'mouse',
        isPrimary: true,
        button: 0,
        clientX: 40 + x,
        clientY: 80 + y,
      }),
    );
}

export const Default: Story = {};
export const FullHeightSidebar: Story = { args: { subtitle: 'Team updates' } };
export const Empty: Story = {
  args: { items: [], emptyContent: 'No activity yet' },
};
export const SubtitleZero: Story = {
  args: { title: 0, subtitle: 0, renderItem: () => 0 },
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.getByRole('heading')).toHaveTextContent('0');
    await expect(part(canvasElement, 'subtitle')).toHaveTextContent('0');
    await expect(canvas.getAllByRole('listitem')[0]).toHaveTextContent('0');
  },
};
export const LongItems: Story = {
  args: {
    items: [
      {
        id: 'long',
        title:
          'A detailed notification with a very long uninterrupted identifier: abcdefghijklmnopqrstuvwxyz'.repeat(
            4,
          ),
      },
    ],
    labels: { refresh: 'Actualizar las novedades del equipo' },
  },
  play: async ({ canvas, canvasElement }) => {
    const root = canvasElement.querySelector<HTMLElement>('[data-ui="stretch-refresh"]')!;
    await expect(canvas.getByRole('button').getBoundingClientRect().right).toBeLessThanOrEqual(
      root.getBoundingClientRect().right + 1,
    );
  },
};
export const Disabled: Story = {
  args: { disabled: true },
  play: async ({ canvas, args, userEvent }) => {
    await userEvent.click(canvas.getByRole('button'));
    await expect(args.onRefresh).not.toHaveBeenCalled();
  },
};
export const Busy: Story = {
  args: { defaultRefreshing: true },
  play: async ({ canvas, args, userEvent }) => {
    await expect(canvas.getByRole('list')).toHaveAttribute('aria-busy', 'true');
    await expect(canvas.getByRole('status')).toHaveTextContent('Refreshing');
    await userEvent.click(canvas.getByRole('button'));
    await expect(args.onRefresh).not.toHaveBeenCalled();
  },
};
export const Success: Story = {
  args: { onRefresh: fn(async () => 'All caught up') },
  play: async ({ canvas, args, userEvent }) => {
    await userEvent.click(canvas.getByRole('button'));
    await waitFor(async () => {
      await expect(canvas.getByRole('status')).toHaveTextContent('All caught up');
    });
    await expect(args.onRefresh).toHaveBeenCalledTimes(1);
    await expect(args.onRefreshingChange).toHaveBeenNthCalledWith(1, true);
    await expect(args.onRefreshingChange).toHaveBeenNthCalledWith(2, false);
    await expect(args.onRefreshingChange).toHaveBeenCalledTimes(2);
  },
};
export const Error: Story = {
  args: {
    onRefresh: fn(async () => {
      throw new globalThis.Error('Offline');
    }),
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button'));
    await waitFor(async () => {
      await expect(canvas.getByRole('status')).toHaveTextContent('Could not refresh. Try again.');
    });
  },
};
export const ErrorRetry: Story = {
  args: { onRefresh: fn() },
  render: (args) => {
    const attempts = useRef(0);
    return (
      <StretchRefresh
        {...args}
        onRefresh={async () => {
          args.onRefresh();
          attempts.current += 1;
          if (attempts.current === 1) throw new globalThis.Error('Offline');
        }}
      />
    );
  },
  play: async ({ canvas, args, userEvent }) => {
    await userEvent.click(canvas.getByRole('button'));
    await waitFor(async () => {
      await expect(canvas.getByRole('status')).toHaveTextContent('Could not refresh');
    });
    await userEvent.click(canvas.getByRole('button'));
    await waitFor(async () => {
      await expect(canvas.getByRole('status')).toHaveTextContent('Updated');
    });
    await expect(args.onRefresh).toHaveBeenCalledTimes(2);
  },
};
export const SyncThrow: Story = {
  ...Error,
  args: {
    onRefresh: fn(() => {
      throw new globalThis.Error('Offline');
    }),
  },
};
export const EmptyResult: Story = {
  args: { onRefresh: fn(async () => '') },
  play: async ({ canvas, canvasElement, userEvent }) => {
    await userEvent.click(canvas.getByRole('button'));
    await waitFor(async () => {
      await expect(canvasElement.querySelector('[data-ui="stretch-refresh"]')).toHaveAttribute(
        'data-state',
        'done',
      );
    });
    await expect(canvas.getByRole('status').textContent).toBe('');
  },
};
function Controlled(args: StretchRefreshProps<Item>) {
  const [busy, setBusy] = useState(false);
  return (
    <StretchRefresh
      {...args}
      refreshing={busy}
      onRefreshingChange={(next) => {
        args.onRefreshingChange?.(next);
        setBusy(next);
      }}
    />
  );
}
export const ControlledBusy: Story = {
  args: { onRefresh: fn(async () => 'All caught up') },
  render: (args) => <Controlled {...args} />,
  play: Success.play,
};
export const RejectedBusy: Story = {
  args: { refreshing: false },
  play: async ({ canvas, args, userEvent }) => {
    await userEvent.click(canvas.getByRole('button'));
    await frame();
    await expect(args.onRefresh).not.toHaveBeenCalled();
    await expect(canvas.getByRole('list')).toHaveAttribute('aria-busy', 'false');
    await userEvent.click(canvas.getByRole('button'));
    await frame();
    await expect(args.onRefreshingChange).toHaveBeenCalledTimes(2);
    await expect(args.onRefresh).not.toHaveBeenCalled();
  },
};
export const ExternalBusyDisplayOnly: Story = {
  args: { refreshing: true },
  play: Busy.play,
};
function ControlledOperation(args: StretchRefreshProps<Item>) {
  const [busy, setBusy] = useState(false);
  const [operation] = useState(deferred);
  return (
    <>
      <StretchRefresh
        {...args}
        refreshing={busy}
        onRefreshingChange={(next) => {
          args.onRefreshingChange?.(next);
          if (next) setBusy(true);
        }}
        onRefresh={() => {
          args.onRefresh();
          return operation.promise;
        }}
      />
      <Button onClick={() => setBusy(false)}>Clear busy</Button>
      <Button onClick={() => operation.resolve('Complete')}>Complete refresh</Button>
    </>
  );
}
export const HeldControlledBusy: Story = {
  render: (args) => <ControlledOperation {...args} />,
  play: async ({ canvas, args, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Refresh' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Complete refresh' }));
    await waitFor(async () => {
      await expect(canvas.getByRole('status')).toHaveTextContent('Complete');
    });
    await expect(canvas.getByRole('list')).toHaveAttribute('aria-busy', 'true');
    await userEvent.click(canvas.getByRole('button', { name: 'Refresh' }));
    await expect(args.onRefresh).toHaveBeenCalledTimes(1);
    await expect(args.onRefreshingChange).toHaveBeenCalledTimes(2);
    await expect(args.onRefreshingChange).toHaveBeenNthCalledWith(2, false);
  },
};
export const PrematureBusyFalse: Story = {
  render: (args) => <ControlledOperation {...args} />,
  play: async ({ canvas, args, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Refresh' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Clear busy' }));
    await expect(canvas.getByRole('list')).toHaveAttribute('aria-busy', 'false');
    await userEvent.click(canvas.getByRole('button', { name: 'Refresh' }));
    await expect(args.onRefresh).toHaveBeenCalledTimes(1);
    await userEvent.click(canvas.getByRole('button', { name: 'Complete refresh' }));
    await waitFor(async () => {
      await expect(args.onRefreshingChange).toHaveBeenCalledTimes(2);
    });
    await expect(args.onRefreshingChange).toHaveBeenNthCalledWith(2, false);
  },
};
export const PreventedActivation: Story = {
  args: {
    slotProps: {
      refreshButton: { onClick: (event) => event.preventDefault() },
      feed: { onPointerDown: (event) => event.preventDefault() },
    },
  },
  play: async ({ canvas, args, userEvent }) => {
    await userEvent.click(canvas.getByRole('button'));
    const fire = pointer(canvas.getByRole('region'));
    fire('pointerdown', 0);
    fire('pointermove', 200);
    fire('pointerup', 200);
    await expect(args.onRefresh).not.toHaveBeenCalled();
  },
};
export const DeferredPromise: Story = {
  render: (args) => {
    const [operation] = useState(deferred);
    return (
      <>
        <StretchRefresh
          {...args}
          onRefresh={() => {
            args.onRefresh();
            return operation.promise;
          }}
        />
        <Button onClick={() => operation.resolve()}>Complete refresh</Button>
      </>
    );
  },
  play: async ({ canvas, args, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Refresh' }));
    await expect(canvas.getByRole('list')).toHaveAttribute('aria-busy', 'true');
    await expect(canvas.getByRole('status')).toHaveTextContent('Refreshing');
    await userEvent.click(canvas.getByRole('button', { name: 'Refresh' }));
    await expect(args.onRefresh).toHaveBeenCalledTimes(1);
    await userEvent.click(canvas.getByRole('button', { name: 'Complete refresh' }));
    await waitFor(async () => {
      await expect(canvas.getByRole('list')).toHaveAttribute('aria-busy', 'false');
    });
    await expect(canvas.getByRole('status')).toHaveTextContent('Updated');
  },
};
export const KeyboardRefresh: Story = {
  play: async ({ canvas, args, userEvent }) => {
    const button = canvas.getByRole('button');
    await userEvent.tab();
    await expect(button.ownerDocument.activeElement).toBe(button);
    await expect(getComputedStyle(button).outlineStyle).not.toBe('none');
    await expect(button.getBoundingClientRect().height).toBeGreaterThanOrEqual(31);
    await userEvent.keyboard('{Enter}');
    await waitFor(async () => {
      await expect(canvas.getByRole('status')).toHaveTextContent('Updated');
    });
    await userEvent.keyboard(' ');
    await waitFor(async () => {
      await expect(args.onRefresh).toHaveBeenCalledTimes(2);
    });
    await userEvent.tab();
    const feed = canvas.getByRole('region');
    await expect(feed.ownerDocument.activeElement).toBe(feed);
    await expect(getComputedStyle(feed).outlineStyle).not.toBe('none');
    await userEvent.keyboard('{ArrowDown}{PageDown}');
    await expect(args.onRefresh).toHaveBeenCalledTimes(2);
    await userEvent.tab({ shift: true });
    await expect(button.ownerDocument.activeElement).toBe(button);
  },
};
export const Threshold: Story = {
  args: { threshold: 40 },
  play: async ({ canvas, canvasElement, args }) => {
    const feed = canvas.getByRole('region');
    const fire = pointer(feed);
    fire('pointerdown', 0);
    fire('pointermove', 20);
    fire('pointerup', 20);
    await expect(args.onRefresh).not.toHaveBeenCalled();
    fire('pointerdown', 0);
    fire('pointermove', 80);
    await expect(canvasElement.querySelector('[data-ui="stretch-refresh"]')).toHaveAttribute(
      'data-state',
      'armed',
    );
    await expect(args.onRefresh).not.toHaveBeenCalled();
    fire('pointerup', 80);
    await waitFor(async () => {
      await expect(args.onRefresh).toHaveBeenCalledTimes(1);
    });
  },
};
export const PointerCancel: Story = {
  play: async ({ canvas, canvasElement, args, userEvent }) => {
    const feed = canvas.getByRole('region');
    const fire = pointer(feed);
    for (const end of ['pointercancel', 'lostpointercapture']) {
      fire('pointerdown', 0);
      fire('pointermove', 200);
      fire(end, 200);
    }
    fire('pointerdown', 0);
    fire('pointermove', 200);
    fire('pointermove', 0);
    fire('pointerup', 0);
    fire('pointerdown', 0);
    fire('pointerup', 0, feed.ownerDocument.body);
    fire('pointermove', 200);
    fire('pointerup', 200);
    fire('pointerdown', 0);
    fire('pointermove', 200);
    feed.focus();
    await userEvent.keyboard('{Escape}');
    fire('pointerup', 200);
    await expect(canvasElement.querySelector('[data-ui="stretch-refresh"]')).toHaveAttribute(
      'data-state',
      'idle',
    );
    await expect(args.onRefresh).not.toHaveBeenCalled();
  },
};
export const ScrollAndInteractive: Story = {
  args: {
    items: Array.from({ length: 15 }, (_, index) => ({
      id: `${index}`,
      title: `Update ${index}`,
    })),
    renderItem: (item) => <Button>{item.title}</Button>,
  },
  play: async ({ canvas, args }) => {
    const feed = canvas.getByRole('region');
    const fire = pointer(feed);
    fire('pointerdown', 0, canvas.getByRole('button', { name: 'Update 0' }));
    fire('pointermove', 200);
    fire('pointerup', 200);
    feed.scrollTop = 20;
    fire('pointerdown', 0);
    fire('pointermove', 200);
    fire('pointerup', 200);
    const wheel = new WheelEvent('wheel', {
      bubbles: true,
      cancelable: true,
      deltaY: 40,
    });
    feed.dispatchEvent(wheel);
    await expect(wheel.defaultPrevented).toBe(false);
    await expect(args.onRefresh).not.toHaveBeenCalled();
  },
};
export const AriaMerge: Story = {
  args: {
    subtitle: 'Latest updates',
    slotProps: {
      feed: {
        'aria-label': 'Custom activity',
        'aria-labelledby': 'external-heading missing-heading',
        'aria-describedby': 'external-description missing-description',
        css: overrideStyle,
      },
    },
  },
  render: (args) => (
    <>
      <span id="external-heading">Team</span>
      <span id="external-description">External details</span>
      <StretchRefresh {...args} />
    </>
  ),
  play: async ({ canvas, canvasElement }) => {
    const feed = canvas.getByRole('region');
    await expect(feed).toHaveAttribute('aria-label', 'Custom activity');
    await expect(feed.getAttribute('aria-labelledby')).toContain(
      'external-heading missing-heading',
    );
    await expect(feed.getAttribute('aria-labelledby')).toContain(canvas.getByRole('heading').id);
    await expect(feed.getAttribute('aria-describedby')).toContain(
      'external-description missing-description',
    );
    await expect(feed.getAttribute('aria-describedby')).toContain(
      part(canvasElement, 'subtitle').id,
    );
    await expect(Math.abs(parseFloat(getComputedStyle(feed).paddingInlineStart) - 32)).toBeLessThan(
      1.1,
    );
  },
};
export const FalsySlots: Story = {
  render: (args) => (
    <>
      {[false, null, 0, ''].map((value, index) => (
        <StretchRefresh
          {...args}
          key={index}
          title={`Activity ${index}`}
          items={[]}
          subtitle={value}
          emptyContent={value}
        />
      ))}
    </>
  ),
  play: async ({ canvasElement }) => {
    await expect(
      canvasElement.querySelectorAll('[data-ui="stretch-refresh-subtitle"]'),
    ).toHaveLength(1);
    await expect(canvasElement.querySelectorAll('[data-ui="stretch-refresh-empty"]')).toHaveLength(
      1,
    );
  },
};
export const UnmountDuringRefresh: Story = {
  render: (args) => {
    const [operation] = useState(deferred);
    const [visible, setVisible] = useState(true);
    return (
      <>
        {visible && (
          <StretchRefresh
            {...args}
            onRefresh={() => {
              args.onRefresh();
              return operation.promise;
            }}
          />
        )}
        <Button onClick={() => setVisible(false)}>Remove feed</Button>
        <Button onClick={() => operation.resolve()}>Complete refresh</Button>
      </>
    );
  },
  play: async ({ canvas, args, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Refresh' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Remove feed' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Complete refresh' }));
    await frame();
    await expect(args.onRefresh).toHaveBeenCalledTimes(1);
    await expect(args.onRefreshingChange).toHaveBeenCalledTimes(1);
  },
};
export const LightTheme: Story = {
  decorators: [withLightTheme],
  globals: { theme: 'light' },
};
export const RTL: Story = {
  args: { dir: 'rtl', title: 'Actividad', labels: { refresh: 'Actualizar' } },
};
export const NarrowContainer: Story = {
  decorators: [
    (Story) => (
      <div css={narrowStyle}>
        <Story />
      </div>
    ),
  ],
};
export const ReducedMotion: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Enable reduced motion in the operating system or browser to inspect static pull feedback. This story checks structure; media emulation belongs to browser QA.',
      },
    },
  },
};
export const ForcedColors: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Enable forced colors in the operating system or browser to inspect the solid indicator and focus outline. This story does not emulate the environment.',
      },
    },
  },
};
