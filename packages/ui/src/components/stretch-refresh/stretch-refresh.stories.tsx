import { useRef, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fireEvent, fn, spyOn, waitFor } from 'storybook/test';
import { base } from '@jfrader/tokens';
import { vars } from '@jfrader/tokens/vars';
import { css } from '../../styling/css';
import { withLightTheme } from '../../testing/story-decorators';
import { expectInside, expectNoOverlap } from '../../testing/geometry-assertions';
import { Button } from '../button';
import { StretchRefresh, type StretchRefreshProps } from './index';
// `styled` is the app-facing styling API; consumers import it from `@jfrader/ui`.
import { styled } from '../../index';

type Item = { id: string; title: string };
const TARGET = Number.parseFloat(base.space[8]);
const ITEMS = [
  { id: 'review', title: 'Mira reviewed the launch checklist' },
  { id: 'draft', title: 'Owen saved a new draft' },
  { id: 'invite', title: 'A team invitation arrived' },
];
const Frame = styled.div({
  inlineSize: 'min(28rem, 100%)',
  marginInline: 'auto',
  blockSize: '24rem',
  display: 'flex',
  flexDirection: 'column',
});
const Narrow = styled.div({ inlineSize: '14rem', maxInlineSize: '100%' });
const Cases = styled.div({
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gridAutoRows: '16rem',
  gap: vars.space[2],
  blockSize: '100%',
  overflow: 'auto',
});
// These values exercise the documented css/sx and slot styling APIs.
const overrideStyle = css({
  paddingInline: vars.space[8],
  background: vars.color.surfaceRaised,
});
const SOURCE = `const FeedFrame = styled.div({ blockSize: '24rem', display: 'flex', flexDirection: 'column' });

<FeedFrame>
  <StretchRefresh title="Activity" items={items} getKey={item => item.id}
    renderItem={item => item.title} onRefresh={reloadItems} sx={{ flex: 1 }} />
</FeedFrame>`;
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
      <Frame>
        <Story />
      </Frame>
    ),
  ],
  parameters: {
    layout: 'padded',
    docs: {
      sections: [
        { title: 'Refresh a feed', stories: ['FullHeightSidebar', 'Empty'] },
        { title: 'App state', stories: ['ControlledBusy'] },
      ],
      source: { code: SOURCE },
      description: {
        component:
          'Refresh a feed by pulling down from the top or pressing Refresh.',
      },
      usage: `- Give the feed a size so it can scroll. Wheel gestures keep their browser behavior.
- Fetch and cancel requests in your app. Update items before resolving \`onRefresh\`.
- In controlled mode, accept refreshing requests during the interaction commit. Setting \`refreshing\` to true later only changes the display.
- The progress line returns with the sheet. Reduced motion keeps the pull threshold and status without moving the sheet.
- Supply an accessible name when the heading has no text.
- Check touch gestures and screen-reader announcements on a device.

### Keyboard
- Tab and Shift+Tab visit Refresh, the scroll region and item controls.
- Enter or Space activates Refresh once. Arrows and Page keys scroll. Escape cancels a pull.
- Refresh follows the APG button pattern; there is no pull-to-refresh ARIA pattern.`,
    },
  },
} satisfies Meta<typeof StretchRefresh<Item>>;
export default meta;
type Story = StoryObj<typeof StretchRefresh<Item>>;
const part = (root: HTMLElement, name: string) =>
  root.querySelector<HTMLElement>(`[data-ui="stretch-refresh-${name}"]`)!;
const scale = (element: HTMLElement) => new DOMMatrix(getComputedStyle(element).transform).a;
const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
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

export const Default: Story = {
  play: async ({ canvas, canvasElement }) => {
    const root = canvasElement.querySelector<HTMLElement>('[data-ui="stretch-refresh"]')!;
    await expect(root.getBoundingClientRect().right).toBeLessThanOrEqual(
      root.ownerDocument.documentElement.clientWidth,
    );
    await expectInside(canvas.getByRole('button'), root);
    await expectInside(canvas.getByRole('region'), root);
  },
};
export const FullHeightSidebar: Story = {
  name: 'Activity feed',
  parameters: {
    docs: {
      description: { story: 'Pull from the top of the feed or press Refresh to check for team updates.' },
      source: {
        language: 'tsx',
        code: `import { StretchRefresh, styled } from '@jfrader/ui';

const FeedFrame = styled.div({ blockSize: '24rem', display: 'flex', flexDirection: 'column' });
const items = [
  { id: 'review', title: 'Mira reviewed the launch checklist' },
  { id: 'draft', title: 'Owen saved a new draft' },
  { id: 'invite', title: 'A team invitation arrived' },
];

<FeedFrame>
  <StretchRefresh
    title="Activity"
    subtitle="Team updates"
    items={items}
    getKey={(item) => item.id}
    renderItem={(item) => item.title}
    onRefresh={async () => {}}
    sx={{ flex: 1 }}
  />
</FeedFrame>`,
      },
    },
  },
  args: { subtitle: 'Team updates' },
};
export const Empty: Story = {
  name: 'Empty feed',
  parameters: {
    docs: {
      description: { story: 'Keep Refresh available when there are no activity items.' },
      source: {
        language: 'tsx',
        code: `import { StretchRefresh, styled } from '@jfrader/ui';

const FeedFrame = styled.div({ blockSize: '24rem', display: 'flex', flexDirection: 'column' });

<FeedFrame>
  <StretchRefresh
    title="Activity"
    items={[]}
    emptyContent="No activity yet"
    getKey={(item: { id: string; title: string }) => item.id}
    renderItem={(item) => item.title}
    onRefresh={async () => {}}
    sx={{ flex: 1 }}
  />
</FeedFrame>`,
      },
    },
  },
  args: { items: [], emptyContent: 'No activity yet' },
};
export const SubtitleZero: Story = {
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { StretchRefresh, styled } from '@jfrader/ui';

const FeedFrame = styled.div({ blockSize: '24rem', display: 'flex', flexDirection: 'column' });
const items = [
  { id: 'review', title: 'Mira reviewed the launch checklist' },
  { id: 'draft', title: 'Owen saved a new draft' },
  { id: 'invite', title: 'A team invitation arrived' },
];

<FeedFrame>
  <StretchRefresh
    title={0}
    subtitle={0}
    items={items}
    getKey={(item) => item.id}
    renderItem={() => 0}
    onRefresh={async () => {}}
    sx={{ flex: 1 }}
  />
</FeedFrame>`,
      },
    },
  },
  args: { title: 0, subtitle: 0, renderItem: () => 0 },
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.getByRole('heading')).toHaveTextContent('0');
    await expect(part(canvasElement, 'subtitle')).toHaveTextContent('0');
    await expect(canvas.getAllByRole('listitem')[0]).toHaveTextContent('0');
  },
};
export const LongItems: Story = {
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { StretchRefresh, styled } from '@jfrader/ui';

const FeedFrame = styled.div({ blockSize: '24rem', display: 'flex', flexDirection: 'column' });
const items = [
  {
    id: 'long',
    title:
      'A detailed notification with a very long uninterrupted identifier: abcdefghijklmnopqrstuvwxyz'.repeat(
        4,
      ),
  },
];

<FeedFrame>
  <StretchRefresh
    title="Activity"
    items={items}
    labels={{ refresh: 'Actualizar las novedades del equipo' }}
    getKey={(item) => item.id}
    renderItem={(item) => item.title}
    onRefresh={async () => {}}
    sx={{ flex: 1 }}
  />
</FeedFrame>`,
      },
    },
  },
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
export const LongLabels: Story = {
  args: {
    title: 'Activity'.repeat(6),
    subtitle: 'Updates'.repeat(8),
    items: [],
    emptyContent: 'NoActivityYet'.repeat(8),
    labels: { pull: 'PullToRefresh'.repeat(6), refresh: 'Refresh'.repeat(6) },
  },
  decorators: [
    (Story) => (
      <Narrow>
        <Story />
      </Narrow>
    ),
  ],
  play: async ({ canvas, canvasElement }) => {
    const root = canvasElement.querySelector<HTMLElement>('[data-ui="stretch-refresh"]')!;
    const feed = canvas.getByRole('region');
    await expect(feed.scrollWidth).toBeLessThanOrEqual(feed.clientWidth + 1);
    await expect(root.scrollWidth).toBeLessThanOrEqual(root.clientWidth + 1);
    const button = canvas.getByRole('button').getBoundingClientRect();
    await expect(button.height).toBeGreaterThanOrEqual(TARGET);
    await expect(button.right).toBeLessThanOrEqual(root.getBoundingClientRect().right);
  },
};
export const Disabled: Story = {
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { StretchRefresh, styled } from '@jfrader/ui';

const FeedFrame = styled.div({ blockSize: '24rem', display: 'flex', flexDirection: 'column' });
const items = [
  { id: 'review', title: 'Mira reviewed the launch checklist' },
  { id: 'draft', title: 'Owen saved a new draft' },
  { id: 'invite', title: 'A team invitation arrived' },
];

<FeedFrame>
  <StretchRefresh
    title="Activity"
    items={items}
    disabled
    getKey={(item) => item.id}
    renderItem={(item) => item.title}
    onRefresh={async () => {}}
    sx={{ flex: 1 }}
  />
</FeedFrame>`,
      },
    },
  },
  args: { disabled: true },
  play: async ({ canvas, args, userEvent }) => {
    await userEvent.click(canvas.getByRole('button'));
    await expect(args.onRefresh).not.toHaveBeenCalled();
  },
};
export const Busy: Story = {
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { StretchRefresh, styled } from '@jfrader/ui';

const FeedFrame = styled.div({ blockSize: '24rem', display: 'flex', flexDirection: 'column' });
const items = [
  { id: 'review', title: 'Mira reviewed the launch checklist' },
  { id: 'draft', title: 'Owen saved a new draft' },
  { id: 'invite', title: 'A team invitation arrived' },
];

<FeedFrame>
  <StretchRefresh
    title="Activity"
    items={items}
    defaultRefreshing
    getKey={(item) => item.id}
    renderItem={(item) => item.title}
    onRefresh={async () => {}}
    sx={{ flex: 1 }}
  />
</FeedFrame>`,
      },
    },
  },
  args: { defaultRefreshing: true },
  play: async ({ canvas, args, userEvent }) => {
    await expect(canvas.getByRole('list')).toHaveAttribute('aria-busy', 'true');
    await expect(canvas.getByRole('status')).toHaveTextContent('Refreshing');
    await expect(scale(part(canvas.getByRole('region'), 'line'))).toBe(1);
    await userEvent.click(canvas.getByRole('button'));
    await expect(args.onRefresh).not.toHaveBeenCalled();
  },
};
export const Success: Story = {
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { StretchRefresh, styled } from '@jfrader/ui';

const FeedFrame = styled.div({ blockSize: '24rem', display: 'flex', flexDirection: 'column' });
const items = [
  { id: 'review', title: 'Mira reviewed the launch checklist' },
  { id: 'draft', title: 'Owen saved a new draft' },
  { id: 'invite', title: 'A team invitation arrived' },
];

<FeedFrame>
  <StretchRefresh
    title="Activity"
    items={items}
    getKey={(item) => item.id}
    renderItem={(item) => item.title}
    onRefresh={async () => 'All caught up'}
    sx={{ flex: 1 }}
  />
</FeedFrame>`,
      },
    },
  },
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
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { StretchRefresh, styled } from '@jfrader/ui';

const FeedFrame = styled.div({ blockSize: '24rem', display: 'flex', flexDirection: 'column' });
const items = [
  { id: 'review', title: 'Mira reviewed the launch checklist' },
  { id: 'draft', title: 'Owen saved a new draft' },
  { id: 'invite', title: 'A team invitation arrived' },
];

<FeedFrame>
  <StretchRefresh
    title="Activity"
    items={items}
    getKey={(item) => item.id}
    renderItem={(item) => item.title}
    onRefresh={async () => {
      throw new Error('Offline');
    }}
    sx={{ flex: 1 }}
  />
</FeedFrame>`,
      },
    },
  },
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
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { StretchRefresh, styled } from '@jfrader/ui';

const FeedFrame = styled.div({ blockSize: '24rem', display: 'flex', flexDirection: 'column' });
const items = [
  { id: 'review', title: 'Mira reviewed the launch checklist' },
  { id: 'draft', title: 'Owen saved a new draft' },
  { id: 'invite', title: 'A team invitation arrived' },
];

<FeedFrame>
  <StretchRefresh
    title="Activity"
    items={items}
    getKey={(item) => item.id}
    renderItem={(item) => item.title}
    onRefresh={() => {
      throw new Error('Offline');
    }}
    sx={{ flex: 1 }}
  />
</FeedFrame>`,
      },
    },
  },
  args: {
    onRefresh: fn(() => {
      throw new globalThis.Error('Offline');
    }),
  },
};
export const EmptyResult: Story = {
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { StretchRefresh, styled } from '@jfrader/ui';

const FeedFrame = styled.div({ blockSize: '24rem', display: 'flex', flexDirection: 'column' });
const items = [
  { id: 'review', title: 'Mira reviewed the launch checklist' },
  { id: 'draft', title: 'Owen saved a new draft' },
  { id: 'invite', title: 'A team invitation arrived' },
];

<FeedFrame>
  <StretchRefresh
    title="Activity"
    items={items}
    getKey={(item) => item.id}
    renderItem={(item) => item.title}
    onRefresh={async () => ''}
    sx={{ flex: 1 }}
  />
</FeedFrame>`,
      },
    },
  },
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
  name: 'Track refresh state',
  parameters: { docs: {
    description: { story: 'Accept refresh requests in React state and announce completion when the promise resolves.' },
    source: { language: 'tsx', code: `import { useState } from 'react';
import { StretchRefresh, styled } from '@jfrader/ui';

const FeedFrame = styled.div({ blockSize: '24rem', display: 'flex', flexDirection: 'column' });
const items = [
  { id: 'review', title: 'Mira reviewed the launch checklist' },
  { id: 'draft', title: 'Owen saved a new draft' },
  { id: 'invite', title: 'A team invitation arrived' },
];

export function Activity() {
  const [refreshing, setRefreshing] = useState(false);
  return <FeedFrame>
    <StretchRefresh title="Activity" items={items}
      getKey={(item) => item.id} renderItem={(item) => item.title}
      refreshing={refreshing} onRefreshingChange={setRefreshing}
      onRefresh={async () => 'All caught up'} sx={{ flex: 1 }} />
  </FeedFrame>;
}` },
  } },
  args: { onRefresh: fn(async () => 'All caught up') },
  render: (args) => <Controlled {...args} />,
  play: Success.play,
};
export const RejectedBusy: Story = {
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { StretchRefresh, styled } from '@jfrader/ui';

const FeedFrame = styled.div({ blockSize: '24rem', display: 'flex', flexDirection: 'column' });
const items = [
  { id: 'review', title: 'Mira reviewed the launch checklist' },
  { id: 'draft', title: 'Owen saved a new draft' },
  { id: 'invite', title: 'A team invitation arrived' },
];

<FeedFrame>
  <StretchRefresh
    title="Activity"
    items={items}
    refreshing={false}
    onRefreshingChange={() => {}}
    getKey={(item) => item.id}
    renderItem={(item) => item.title}
    onRefresh={async () => {}}
    sx={{ flex: 1 }}
  />
</FeedFrame>`,
      },
    },
  },
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
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { StretchRefresh, styled } from '@jfrader/ui';

const FeedFrame = styled.div({ blockSize: '24rem', display: 'flex', flexDirection: 'column' });
const items = [
  { id: 'review', title: 'Mira reviewed the launch checklist' },
  { id: 'draft', title: 'Owen saved a new draft' },
  { id: 'invite', title: 'A team invitation arrived' },
];

<FeedFrame>
  <StretchRefresh
    title="Activity"
    items={items}
    refreshing
    onRefreshingChange={() => {}}
    getKey={(item) => item.id}
    renderItem={(item) => item.title}
    onRefresh={async () => {}}
    sx={{ flex: 1 }}
  />
</FeedFrame>`,
      },
    },
  },
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
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { StretchRefresh, styled } from '@jfrader/ui';

const FeedFrame = styled.div({ blockSize: '24rem', display: 'flex', flexDirection: 'column' });
const items = [
  { id: 'review', title: 'Mira reviewed the launch checklist' },
  { id: 'draft', title: 'Owen saved a new draft' },
  { id: 'invite', title: 'A team invitation arrived' },
];

<FeedFrame>
  <StretchRefresh
    title="Activity"
    items={items}
    slotProps={{
      refreshButton: { onClick: (event) => event.preventDefault() },
      feed: { onPointerDown: (event) => event.preventDefault() },
    }}
    getKey={(item) => item.id}
    renderItem={(item) => item.title}
    onRefresh={async () => {}}
    sx={{ flex: 1 }}
  />
</FeedFrame>`,
      },
    },
  },
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
    await expect(button.getBoundingClientRect().height).toBeGreaterThanOrEqual(TARGET);
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
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { StretchRefresh, styled } from '@jfrader/ui';

const FeedFrame = styled.div({ blockSize: '24rem', display: 'flex', flexDirection: 'column' });
const items = [
  { id: 'review', title: 'Mira reviewed the launch checklist' },
  { id: 'draft', title: 'Owen saved a new draft' },
  { id: 'invite', title: 'A team invitation arrived' },
];

<FeedFrame>
  <StretchRefresh
    title="Activity"
    items={items}
    threshold={40}
    getKey={(item) => item.id}
    renderItem={(item) => item.title}
    onRefresh={async () => {}}
    sx={{ flex: 1 }}
  />
</FeedFrame>`,
      },
    },
  },
  args: { threshold: 40 },
  play: async ({ canvas, canvasElement, args }) => {
    const feed = canvas.getByRole('region');
    const line = part(feed, 'line');
    const list = canvas.getByRole('list');
    const restingTop = list.getBoundingClientRect().top;
    const fire = pointer(feed);
    await expect(scale(line)).toBe(0);
    fire('pointerdown', 0);
    fire('pointermove', 20);
    await nextFrame();
    const pulled = scale(line);
    await expect(pulled).toBeGreaterThan(0);
    await expect(pulled).toBeLessThan(1);
    fire('pointerup', 20);
    await nextFrame();
    await expect(scale(line)).toBeGreaterThan(0);
    await waitFor(async () => {
      await expect(scale(line)).toBe(0);
    });
    await expect(args.onRefresh).not.toHaveBeenCalled();
    fire('pointerdown', 0);
    fire('pointermove', 80);
    await nextFrame();
    await expect(scale(line)).toBe(1);
    await expectInside(line, feed);
    await expectNoOverlap(part(feed, 'indicator'), list);
    await expect(list.getBoundingClientRect().top - restingTop).toBeCloseTo(
      80 * (1 - Math.exp(-1)),
      1,
    );
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
export const PullSelection: Story = {
  play: async ({ canvas, args }) => {
    const feed = canvas.getByRole('region');
    const fire = pointer(feed);
    fire('pointerdown', 0);
    const selection = feed.ownerDocument.getSelection()!;
    const range = feed.ownerDocument.createRange();
    range.selectNodeContents(canvas.getAllByRole('listitem')[0]!);
    selection.addRange(range);
    fire('pointermove', 30);
    await nextFrame();
    await expect(selection.toString()).toBe('');
    await expect(getComputedStyle(feed).userSelect).toBe('none');
    fire('pointermove', 0);
    await nextFrame();
    await expect(getComputedStyle(feed).userSelect).toBe('none');
    fire('pointercancel', 30);
    await nextFrame();
    await expect(getComputedStyle(feed).userSelect).not.toBe('none');
    await expect(args.onRefresh).not.toHaveBeenCalled();
  },
};
export const ScrollAndInteractive: Story = {
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { Button, StretchRefresh, styled } from '@jfrader/ui';

const FeedFrame = styled.div({ blockSize: '24rem', display: 'flex', flexDirection: 'column' });
const items = Array.from({ length: 15 }, (_, index) => ({
  id: String(index),
  title: 'Update ' + index,
}));

<FeedFrame>
  <StretchRefresh
    title="Activity"
    items={items}
    getKey={(item) => item.id}
    renderItem={(item) => <Button>{item.title}</Button>}
    onRefresh={async () => {}}
    sx={{ flex: 1 }}
  />
</FeedFrame>`,
      },
    },
  },
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
// This story tests the documented css/slot API and native style merging.
export const AriaMerge: Story = {
  args: {
    subtitle: 'Latest updates',
    slotProps: {
      feed: {
        'aria-labelledby': 'external-heading missing-heading',
        'aria-describedby': 'external-description missing-description',
        sx: overrideStyle,
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
    await expect(feed).toHaveAccessibleName('Team Activity');
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
    await expect(
      Math.abs(parseFloat(getComputedStyle(feed).paddingInlineStart) - TARGET),
    ).toBeLessThan(1.1);
  },
};
export const FeedAriaLabel: Story = {
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { StretchRefresh, styled } from '@jfrader/ui';

const FeedFrame = styled.div({ blockSize: '24rem', display: 'flex', flexDirection: 'column' });
const items = [
  { id: 'review', title: 'Mira reviewed the launch checklist' },
  { id: 'draft', title: 'Owen saved a new draft' },
  { id: 'invite', title: 'A team invitation arrived' },
];

<FeedFrame>
  <StretchRefresh
    title="Activity"
    items={items}
    slotProps={{ feed: { 'aria-label': 'Custom activity' } }}
    getKey={(item) => item.id}
    renderItem={(item) => item.title}
    onRefresh={async () => {}}
    sx={{ flex: 1 }}
  />
</FeedFrame>`,
      },
    },
  },
  args: { slotProps: { feed: { 'aria-label': 'Custom activity' } } },
  play: async ({ canvas }) => {
    const feed = canvas.getByRole('region');
    await expect(feed).toHaveAttribute('aria-label', 'Custom activity');
    await expect(feed).not.toHaveAttribute('aria-labelledby');
    await expect(feed).toHaveAccessibleName('Custom activity');
  },
};
export const FeedAriaLabelWithLabelledBy: Story = {
  args: {
    slotProps: {
      feed: { 'aria-label': 'Custom activity', 'aria-labelledby': 'external-heading' },
    },
  },
  render: AriaMerge.render,
  play: async ({ canvas }) => {
    const feed = canvas.getByRole('region');
    await expect(feed).toHaveAttribute('aria-label', 'Custom activity');
    await expect(feed).toHaveAccessibleName('Team Activity');
  },
};
export const FalsySlots: Story = {
  render: (args) => (
    <Cases>
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
    </Cases>
  ),
  play: async ({ canvasElement }) => {
    await expect(
      canvasElement.querySelectorAll('[data-ui="stretch-refresh-subtitle"]'),
    ).toHaveLength(1);
    await expect(canvasElement.querySelectorAll('[data-ui="stretch-refresh-empty"]')).toHaveLength(
      1,
    );
    const empty = part(canvasElement, 'empty');
    empty.scrollIntoView({ block: 'nearest' });
    await expectInside(empty, empty.closest('[data-ui="stretch-refresh-feed"]')!);
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
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { StretchRefresh, styled } from '@jfrader/ui';

const FeedFrame = styled.div({ blockSize: '24rem', display: 'flex', flexDirection: 'column' });
const items = [
  { id: 'review', title: 'Mira reviewed the launch checklist' },
  { id: 'draft', title: 'Owen saved a new draft' },
  { id: 'invite', title: 'A team invitation arrived' },
];

<FeedFrame>
  <StretchRefresh
    dir="rtl"
    title="Actividad"
    labels={{ refresh: 'Actualizar' }}
    items={items}
    getKey={(item) => item.id}
    renderItem={(item) => item.title}
    onRefresh={async () => {}}
    sx={{ flex: 1 }}
  />
</FeedFrame>`,
      },
    },
  },
  args: { dir: 'rtl', title: 'Actividad', labels: { refresh: 'Actualizar' } },
};
export const NarrowContainer: Story = {
  decorators: [
    (Story) => (
      <Narrow>
        <Story />
      </Narrow>
    ),
  ],
};
export const ReducedMotion: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Enable reduced motion to check pull feedback without movement. This story checks structure only.',
      },
    },
  },
};
export const ForcedColors: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Enable forced colors to check the indicator and focus outline. This story does not enable forced colors.',
      },
    },
  },
};
