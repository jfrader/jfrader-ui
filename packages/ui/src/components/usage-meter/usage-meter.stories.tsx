import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, waitFor, within } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { motionDurationMs } from '../../styling/motion-timings';
import { withLightTheme } from '../../testing/story-decorators';
import { UsageMeter, type UsageMeterProps, type UsageMeterSelection } from './index';
// `styled` is the app-facing styling API; consumers import it from `@jfrader/ui`.
import { styled } from '../../index';

const NarrowFrame = styled.div({ inlineSize: 320, maxInlineSize: '100%' });

const usage = [
  { id: 'files', label: 'Files', value: 24 },
  { id: 'photos', label: 'Photos', value: 16 },
  { id: 'backups', label: 'Backups', value: 8 },
];
const Frame = styled.div({
  inlineSize: `min(24rem, calc(100vw - ${vars.space[8]}))`,
  maxInlineSize: '100%',
  display: 'grid',
  gap: vars.space[4],
});
const FixtureButton = styled.button({
  minBlockSize: vars.space[8],
  padding: vars.space[2],
  color: vars.color.text,
  backgroundColor: vars.color.surfaceRaised,
  border: `1px solid ${vars.color.borderControl}`,
});
const meta = {
  title: 'Feedback/UsageMeter',
  component: UsageMeter,
  tags: ['autodocs'],
  args: {
    label: 'Storage',
    segments: usage,
    limit: 80,
    locale: 'en',
    onValueChange: fn(),
  },
  decorators: [
    (Story) => (
      <Frame>
        <Story />
      </Frame>
    ),
  ],
  parameters: {
    docs: {
      description: {
        component:
          'Show how much of an allowance is used, with its percentage and category amounts.',
      },
      sections: [
        { title: 'Basic', stories: ['Default'] },
        { title: 'Quotas and limits', stories: ['StorageQuota', 'AtThreshold', 'OverLimit'] },
        { title: 'Labels and formats', stories: ['StandardUnits', 'CustomUnit'] },
        { title: 'States', stories: ['ZeroUsage', 'Static'] },
        { title: 'Sizes', stories: ['Sizes'] },
        { title: 'Composition', stories: ['Controlled', 'QuotaUpdate'] },
      ],
      usage: `### When to use
Show consumption of an allowance, not progress through a task. Supply quota data from your app and reserve meaningful colors for categories that need them.

### Values and constraints

Use a finite positive limit. Provide a locale during server rendering so numbers match on hydration, and translate comparison and status text for your audience.

Hover a category to preview it; click or tap to pin it. Selection does not change the reported usage.

### Keyboard and accessibility

The legend has one Tab stop. Arrows follow text direction; Home and End move to the first and last item. Enter or Space toggles a pin; Escape clears it.

Numeric ARIA values stop at the limit; value text still reports overage. Status changes and growing overage are announced, with rapid updates coalesced. Avoid duplicate live announcements elsewhere in the page.`,
    },
  },
} satisfies Meta<typeof UsageMeter>;
export default meta;
type Story = StoryObj<typeof meta>;

function meterSource(props = '', segments = usage, limit = 80) {
  return `import { UsageMeter } from '@jfrader/ui';

const segments = ${JSON.stringify(segments, null, 2)};

<UsageMeter label="Storage" segments={segments} limit={${limit}} locale="en" ${props}/>`;
}

export const Default: Story = {
  name: 'Storage allowance',
  parameters: { docs: {
    description: { story: 'Compare category usage with the remaining storage allowance.' },
    source: { language: 'tsx', code: meterSource() },
  } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const meter = canvas.getByRole('meter', { name: 'Storage' });
    await expect(canvas.getByRole('group', { name: 'Storage' })).toHaveAttribute('data-state', 'normal');
    await expect(meter).toHaveAttribute('aria-valuemin', '0');
    await expect(meter).toHaveAttribute('aria-valuemax', '80');
    await expect(meter).toHaveAttribute('aria-valuenow', '48');
    await expect(meter).toHaveAttribute('aria-valuetext', '48 of 80 used, 60%. 32 free');
    await expect(meter).not.toHaveAttribute('tabindex');
    await expect(canvasElement.querySelector('[aria-live]')).toHaveTextContent('');
  },
};
export const OneSegment: Story = { args: { segments: usage.slice(0, 1) } };
export const StorageQuota: Story = {
  name: 'Storage quota in gigabytes',
  parameters: { docs: {
    description: { story: 'Format decimal storage amounts in gigabytes against a 15 GB quota.' },
    source: { language: 'tsx', code: meterSource('numberFormatOptions={{ style: "unit", unit: "gigabyte", maximumFractionDigits: 1 }} ', [
      { id: 'media', label: 'Media', value: 7.2 },
      { id: 'documents', label: 'Documents', value: 3.4 },
      { id: 'backups', label: 'Backups', value: 1.8 },
    ], 15) },
  } },
  args: {
    segments: [
      { id: 'media', label: 'Media', value: 7.2 },
      { id: 'documents', label: 'Documents', value: 3.4 },
      { id: 'backups', label: 'Backups', value: 1.8 },
    ],
    limit: 15,
    numberFormatOptions: { style: 'unit', unit: 'gigabyte', maximumFractionDigits: 1 },
  },
  play: async ({ canvasElement }) => {
    const total = canvasElement.querySelector<HTMLElement>('[data-ui="usage-meter-total"]')!;
    await expect(within(total).getByText('· 83%')).toBeVisible();
    const segments = canvasElement.querySelectorAll<HTMLElement>('[data-ui="usage-meter-segment"]');
    for (const segment of segments) await expect(segment).toBeEmptyDOMElement();
    const doc = canvasElement.ownerDocument;
    const root = canvasElement.querySelector('[data-ui="usage-meter"]')!;
    await expect(doc.defaultView!.getComputedStyle(segments[0]!).backgroundColor).toBe(
      doc.defaultView!.getComputedStyle(root).color,
    );
    const items = within(canvasElement).getAllByRole('button');
    for (let index = 1; index < items.length; index++) {
      await expect(items[index]!.getBoundingClientRect().top).toBeGreaterThanOrEqual(
        items[index - 1]!.getBoundingClientRect().bottom,
      );
    }
  },
};
export const SemanticTones: Story = {
  args: { segments: [{ id: 'requests', label: 'Requests', value: 48, tone: 'accent' }] },
  parameters: {
    docs: { description: { story: 'Set a segment’s tone when its color carries meaning in your app.' } },
  },
};
export const FourSegments: Story = {
  args: { segments: [...usage, { id: 'other', label: 'Other', value: 4 }] },
};
export const ManySegments: Story = {
  args: {
    segments: Array.from({ length: 9 }, (_, index) => ({
      id: `category-${index}`,
      label: `Category ${index + 1}`,
      value: index + 1,
    })),
  },
};
export const ZeroUsage: Story = {
  name: 'Unused allowance',
  parameters: { docs: {
    description: { story: 'Show an empty allowance while keeping the zero-value category selectable.' },
    source: { language: 'tsx', code: meterSource('', [{ id: 'zero', label: 'Files', value: 0 }]) },
  } },
  args: { segments: [{ id: 'zero', label: 'Files', value: 0 }] },
  play: async ({ canvasElement, userEvent, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('meter')).toHaveAttribute('aria-valuenow', '0');
    await userEvent.click(canvas.getByRole('button', { name: /Files 0 0%/ }));
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenCalledWith({
      kind: 'segment',
      id: 'zero',
    });
  },
};
export const EmptySegments: Story = {
  args: { segments: [] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('meter')).toHaveAttribute('aria-valuenow', '0');
    await expect(canvas.getAllByRole('button')).toHaveLength(1);
    await expect(canvas.getByRole('button')).toHaveAccessibleName('— Free 80 100%');
  },
};
export const AtThreshold: Story = {
  name: 'Near the limit',
  parameters: { docs: {
    description: { story: 'Show the near-limit status when usage reaches 90 percent of the allowance.' },
    source: { language: 'tsx', code: meterSource('', [{ id: 'a', label: 'Requests', value: 72 }]) },
  } },
  args: { segments: [{ id: 'a', label: 'Requests', value: 72 }] },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('group')).toHaveAttribute('data-state', 'near-limit');
  },
};
export const AtLimit: Story = {
  args: { limit: 48 },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('group')).toHaveAttribute('data-state', 'near-limit');
    await expect(canvasElement.querySelector('[data-ui="usage-meter-overage"]')).toBeNull();
  },
};
export const OverLimit: Story = {
  name: 'Over the allowance',
  parameters: { docs: {
    description: { story: 'Report the excess when category totals exceed the available allowance.' },
    source: { language: 'tsx', code: meterSource('', usage, 40) },
  } },
  args: { limit: 40 },
  play: async ({ canvasElement, userEvent }) => {
    const canvas = within(canvasElement);
    const meter = canvas.getByRole('meter');
    await expect(meter).toHaveAttribute('aria-valuenow', '40');
    await expect(meter).toHaveAttribute('aria-valuemax', '40');
    await expect(meter).toHaveAttribute('aria-valuetext', '48 of 40 used, 120%. Over limit: 8');
    await expect(canvasElement.querySelector('[data-ui="usage-meter-overage"]')).not.toBeNull();
    await expect(canvasElement.querySelector('[data-ui="usage-meter-limit"]')).not.toBeNull();
    await expect(canvasElement.querySelector('[data-ui="usage-meter-status"]')).toHaveTextContent(
      '! Over limit: 8',
    );
    await userEvent.hover(canvas.getAllByRole('button')[0]!);
    await expect(meter).toHaveAttribute('aria-valuenow', '40');
    await expect(meter).toHaveAttribute('aria-valuetext', '48 of 40 used, 120%. Over limit: 8');
    await userEvent.unhover(canvas.getAllByRole('button')[0]!);
  },
};
export const Static: Story = {
  name: 'Non-interactive summary',
  parameters: { docs: {
    description: { story: 'Read category totals without selectable legend buttons.' },
    source: { language: 'tsx', code: meterSource('interactive={false} ') },
  } },
  args: { interactive: false },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryAllByRole('button')).toHaveLength(0);
  },
};
export const BarInteraction: Story = {
  play: async ({ canvasElement, userEvent, args }) => {
    const segments = canvasElement.querySelectorAll<HTMLElement>('[data-ui="usage-meter-segment"]');
    const items = within(canvasElement).getAllByRole('button');
    await userEvent.hover(segments[1]!);
    await expect(segments[1]).toHaveAttribute('data-highlighted', 'true');
    await expect(items[1]).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(segments[1]!);
    await expect(items[1]).toHaveAttribute('aria-pressed', 'true');
    await userEvent.unhover(segments[1]!);
    await expect(segments[1]).toHaveAttribute('data-highlighted', 'true');
    await userEvent.click(segments[1]!);
    await expect(items[1]).toHaveAttribute('aria-pressed', 'false');
    const free = canvasElement.querySelector<HTMLElement>('[data-ui="usage-meter-remainder"]')!;
    await userEvent.click(free);
    await expect(items[3]).toHaveAttribute('aria-pressed', 'true');
    await expect(args.onValueChange).toHaveBeenCalledTimes(3);
    await userEvent.click(items[3]!);
    await userEvent.keyboard('{Home}{Enter}{Escape}');
    await expect(items[0]).toHaveAttribute('aria-pressed', 'false');
  },
};
export const AnnouncementsOff: Story = {
  args: { announceChanges: false },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('[aria-live]')).toBeNull();
  },
};
export const AnnouncementCoalescing: Story = {
  render: (args) => <AnnouncementFixture {...args} />,
  play: async ({ canvasElement, userEvent }) => {
    const canvas = within(canvasElement);
    const live = canvasElement.querySelector('[aria-live]');
    const options = { timeout: motionDurationMs.slow * 8 };
    await userEvent.click(canvas.getByRole('button', { name: 'Near limit' }));
    await waitFor(() => expect(live).toHaveTextContent('Near limit · 4 free'), options);
    await userEvent.click(canvas.getByRole('button', { name: 'Over limit' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Grow overage' }));
    await expect(live).toHaveTextContent('Near limit · 4 free');
    await waitFor(() => expect(live).toHaveTextContent('Over limit: 20'), options);
    await userEvent.click(canvas.getByRole('button', { name: 'Same rounded overage' }));
    await expect(live).toHaveTextContent('Over limit: 20');
    await userEvent.click(canvas.getByRole('button', { name: 'Reduce overage' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Regrow overage' }));
    await waitFor(() => expect(live).toHaveTextContent('Over limit: 10'), options);
    await userEvent.click(canvas.getByRole('button', { name: 'Reset usage' }));
    await waitFor(() => expect(live).toHaveTextContent('32 free'), options);
  },
};
function AnnouncementFixture(args: UsageMeterProps) {
  const [total, setTotal] = useState(48);
  return (
    <>
      {Object.entries({
        'Near limit': 76,
        'Over limit': 90,
        'Grow overage': 100,
        'Same rounded overage': 100.01,
        'Reduce overage': 85,
        'Regrow overage': 90,
        'Reset usage': 48,
      }).map(([label, value]) => (
        <FixtureButton key={label} onClick={() => setTotal(value)}>
          {label}
        </FixtureButton>
      ))}
      <UsageMeter {...args} segments={[{ id: 'files', label: 'Files', value: total }]} />
    </>
  );
}
export const BarControlledRejected: Story = {
  args: { value: { kind: 'segment', id: 'files' } },
  play: async ({ canvasElement, userEvent, args }) => {
    const segments = canvasElement.querySelectorAll<HTMLElement>('[data-ui="usage-meter-segment"]');
    await userEvent.click(segments[1]!);
    await userEvent.unhover(segments[1]!);
    await expect(within(canvasElement).getAllByRole('button')[0]).toHaveAttribute('aria-pressed', 'true');
    await expect(segments[0]).toHaveAttribute('data-highlighted', 'true');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenCalledWith({ kind: 'segment', id: 'photos' });
  },
};
export const InteractivePinned: Story = {
  args: { defaultValue: { kind: 'segment', id: 'photos' } },
};
export const RemainderPinned: Story = {
  args: { defaultValue: { kind: 'remainder' }, limit: 40 },
};
export const Preview: Story = {
  args: { defaultValue: { kind: 'segment', id: 'files' } },
  render: (args) => (
    <>
      <UsageMeter {...args} />
      <FixtureButton>Outside</FixtureButton>
    </>
  ),
  play: async ({ canvasElement, userEvent, args }) => {
    const canvas = within(canvasElement);
    const buttons = canvas.getAllByRole('button');
    const segments = canvasElement.querySelectorAll('[data-ui="usage-meter-segment"]');
    await expect(segments[0]).toHaveAttribute('data-highlighted', 'true');
    await userEvent.hover(buttons[1]!);
    await expect(segments[1]).toHaveAttribute('data-highlighted', 'true');
    await expect(buttons[1]).toHaveAttribute('aria-pressed', 'false');
    await userEvent.unhover(buttons[1]!);
    await expect(segments[0]).toHaveAttribute('data-highlighted', 'true');
    await userEvent.click(canvas.getByRole('button', { name: 'Outside' }));
    await userEvent.tab({ shift: true });
    await userEvent.keyboard('{ArrowRight}');
    await expect(segments[1]).toHaveAttribute('data-highlighted', 'true');
    await userEvent.tab();
    await expect(segments[0]).toHaveAttribute('data-highlighted', 'true');
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await expect(canvas.getByRole('meter')).toHaveAttribute('aria-valuenow', '48');
  },
};
export const DefaultSeed: Story = {
  args: { defaultValue: { kind: 'segment', id: 'files' } },
  render: (args) => <SeedFixture {...args} />,
  play: async ({ canvasElement, userEvent, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Change default' }));
    await expect(canvas.getAllByRole('button')[1]).toHaveAttribute('aria-pressed', 'true');
    await expect(canvas.getAllByRole('button')[2]).toHaveAttribute('aria-pressed', 'false');
    await expect(args.onValueChange).not.toHaveBeenCalled();
  },
};
function SeedFixture(args: UsageMeterProps) {
  const [seed, setSeed] = useState(args.defaultValue);
  return (
    <>
      <FixtureButton onClick={() => setSeed({ kind: 'segment', id: 'photos' })}>
        Change default
      </FixtureButton>
      <UsageMeter {...args} defaultValue={seed} />
    </>
  );
}
export const Sizes: Story = {
  name: 'Meter sizes',
  parameters: { docs: {
    description: { story: 'Compare small, medium, and large meters with the same allowance.' },
    source: { language: 'tsx', code: `import { UsageMeter } from '@jfrader/ui';

const segments = [
  { id: 'files', label: 'Files', value: 24 },
  { id: 'photos', label: 'Photos', value: 16 },
  { id: 'backups', label: 'Backups', value: 8 },
];

<>
  <UsageMeter label="sm allowance" size="sm" segments={segments} limit={80} locale="en" />
  <UsageMeter label="md allowance" size="md" segments={segments} limit={80} locale="en" />
  <UsageMeter label="lg allowance" size="lg" segments={segments} limit={80} locale="en" />
</>` },
  } },
  render: (args) => (
    <>
      {(['sm', 'md', 'lg'] as const).map((size) => (
        <UsageMeter {...args} key={size} size={size} label={`${size} allowance`} />
      ))}
    </>
  ),
};

export const Keyboard: Story = {
  render: (args) => (
    <>
      <FixtureButton>Before</FixtureButton>
      <UsageMeter {...args} />
      <FixtureButton>After</FixtureButton>
    </>
  ),
  play: async ({ canvasElement, userEvent, args }) => {
    const canvas = within(canvasElement);
    const items = canvas.getAllByRole('button').slice(1, -1);
    const doc = canvasElement.ownerDocument;
    await userEvent.click(canvas.getByRole('button', { name: 'Before' }));
    await userEvent.tab();
    await expect(doc.activeElement).toBe(items[0]);
    await expect(doc.defaultView!.getComputedStyle(items[0]!).outlineStyle).not.toBe('none');
    await expect(items[0]!.getBoundingClientRect().height).toBeGreaterThanOrEqual(31);
    for (const [key, index] of [
      ['{ArrowLeft}', 3],
      ['{ArrowRight}', 0],
      ['{ArrowDown}', 1],
      ['{ArrowUp}', 0],
      ['{End}', 3],
      ['{Home}', 0],
    ] as const) {
      await userEvent.keyboard(key);
      await expect(doc.activeElement).toBe(items[index]);
    }
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await userEvent.keyboard('{Escape}');
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await userEvent.keyboard('{Enter}');
    await expect(items[0]).toHaveAttribute('aria-pressed', 'true');
    await expect(args.onValueChange).toHaveBeenNthCalledWith(1, {
      kind: 'segment',
      id: 'files',
    });
    await userEvent.keyboard(' ');
    await expect(args.onValueChange).toHaveBeenNthCalledWith(2, null);
    await userEvent.keyboard(' ');
    await userEvent.keyboard('{Escape}');
    await expect(args.onValueChange).toHaveBeenNthCalledWith(4, null);
    await expect(args.onValueChange).toHaveBeenCalledTimes(4);
    await expect(doc.activeElement).toBe(items[0]);
    await userEvent.tab();
    await expect(doc.activeElement).toBe(canvas.getByRole('button', { name: 'After' }));
    await userEvent.tab({ shift: true });
    await expect(doc.activeElement).toBe(items[0]);
    await userEvent.tab({ shift: true });
    await expect(doc.activeElement).toBe(canvas.getByRole('button', { name: 'Before' }));
  },
};
export const ControlledRejected: Story = {
  args: { value: { kind: 'segment', id: 'files' } },
  play: async ({ canvasElement, userEvent, args }) => {
    const items = within(canvasElement).getAllByRole('button');
    await userEvent.click(items[1]!);
    await expect(args.onValueChange).toHaveBeenNthCalledWith(1, {
      kind: 'segment',
      id: 'photos',
    });
    await expect(items[0]).toHaveAttribute('aria-pressed', 'true');
    await expect(items[1]).toHaveAttribute('aria-pressed', 'false');
    await userEvent.keyboard('{Escape}');
    await expect(args.onValueChange).toHaveBeenNthCalledWith(2, null);
    await expect(args.onValueChange).toHaveBeenCalledTimes(2);
    await expect(items[0]).toHaveAttribute('aria-pressed', 'true');
  },
};
export const Controlled: Story = {
  name: 'Own the selected category',
  parameters: { docs: {
    description: { story: 'Keep the pinned category in application state and click it again to clear it.' },
    source: { language: 'tsx', code: `import { useState } from 'react';
import { UsageMeter, type UsageMeterSelection } from '@jfrader/ui';

const segments = [
  { id: 'files', label: 'Files', value: 24 },
  { id: 'photos', label: 'Photos', value: 16 },
  { id: 'backups', label: 'Backups', value: 8 },
];

export function StorageSelection() {
  const [pin, setPin] = useState<UsageMeterSelection | null>(null);
  return <UsageMeter label="Storage" segments={segments} limit={80} locale="en"
    value={pin} onValueChange={setPin} />;
}` },
  } },
  render: (args) => <ControlledFixture {...args} />,
  play: async ({ canvasElement, userEvent, args }) => {
    const items = within(canvasElement).getAllByRole('button');
    await userEvent.click(items[0]!);
    await expect(items[0]).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(items[0]!);
    await expect(items[0]).toHaveAttribute('aria-pressed', 'false');
    await expect(args.onValueChange).toHaveBeenCalledTimes(2);
    await expect(args.onValueChange).toHaveBeenLastCalledWith(null);
  },
};
function ControlledFixture(args: UsageMeterProps) {
  const [pin, setPin] = useState<UsageMeterSelection | null>(null);
  return (
    <UsageMeter
      {...args}
      value={pin}
      onValueChange={(next) => {
        setPin(next);
        args.onValueChange?.(next);
      }}
    />
  );
}
export const QuotaUpdate: Story = {
  name: 'Update usage from an action',
  parameters: { docs: {
    description: { story: 'Increase usage and keep the remainder selected as it becomes overage.' },
    source: { language: 'tsx', code: `import { useState } from 'react';
import { Button, UsageMeter } from '@jfrader/ui';

export function StorageUsage() {
  const [total, setTotal] = useState(48);
  return <>
    <Button onClick={() => setTotal((value) => value + 42)}>Use more</Button>
    <UsageMeter label="Storage" locale="en" limit={80} announceChanges
      defaultValue={{ kind: 'remainder' }}
      segments={[{ id: 'free', label: 'Files', value: total }]} />
  </>;
}` },
  } },
  args: { announceChanges: true, defaultValue: { kind: 'remainder' } },
  render: (args) => <QuotaFixture {...args} />,
  play: async ({ canvasElement, userEvent, args }) => {
    const canvas = within(canvasElement);
    const live = canvasElement.querySelector('[aria-live]');
    await expect(live).toHaveTextContent('');
    await userEvent.click(canvas.getByRole('button', { name: 'Use more' }));
    await expect(canvas.getByRole('meter')).toHaveAttribute('aria-valuenow', '80');
    await waitFor(() => expect(live).toHaveTextContent('Over limit: 10'), {
      timeout: motionDurationMs.slow * 8,
    });
    await expect(canvas.getByRole('button', { name: /Over limit 10 13%/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await userEvent.click(canvas.getByRole('button', { name: 'Use more' }));
    await waitFor(() => expect(live).toHaveTextContent('Over limit: 52'), {
      timeout: motionDurationMs.slow * 8,
    });
    await expect(args.onValueChange).not.toHaveBeenCalled();
  },
};
function QuotaFixture(args: UsageMeterProps) {
  const [total, setTotal] = useState(48);
  return (
    <>
      <FixtureButton onClick={() => setTotal(total + 42)}>
        Use more
      </FixtureButton>
      <UsageMeter {...args} segments={[{ id: 'free', label: 'Files', value: total }]} />
    </>
  );
}
export const Removal: Story = {
  render: (args) => <RemovalFixture {...args} />,
  play: async ({ canvasElement, userEvent, args }) => {
    const canvas = within(canvasElement);
    const items = canvas.getAllByRole('button');
    await userEvent.click(items[0]!);
    await userEvent.keyboard('{ArrowRight}{Delete}');
    await expect(canvasElement.ownerDocument.activeElement).toBe(
      canvas.getByRole('button', { name: /Backups 8 10%/ }),
    );
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await userEvent.keyboard('{Home}{Delete}');
    await expect(canvas.getByRole('button', { name: /Backups 8 10%/ })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
  },
};
function RemovalFixture(args: UsageMeterProps) {
  const [segments, setSegments] = useState(usage);
  return (
    <UsageMeter
      {...args}
      segments={segments}
      slotProps={{
        item: {
          onKeyDown: (event) => {
            if (event.key === 'Delete') {
              const text = event.currentTarget.textContent;
              setSegments(segments.filter((item) => !text?.includes(item.label)));
            }
          },
        },
      }}
    />
  );
}
export const IntlPercent: Story = {
  render: (args) => (
    <>
      {['en', 'es', 'ar'].map((locale) => (
        <UsageMeter {...args} key={locale} locale={locale} label={locale} limit={40} />
      ))}
    </>
  ),
  play: async ({ canvasElement }) => {
    for (const locale of ['en', 'es', 'ar']) {
      const meter = within(canvasElement).getByRole('meter', { name: locale });
      await expect(meter.getAttribute('aria-valuetext')).toContain(
        new Intl.NumberFormat(locale, {
          style: 'percent',
          maximumFractionDigits: 0,
        }).format(1.2),
      );
    }
  },
};
export const StandardUnits: Story = {
  name: 'Localized unit formatting',
  parameters: { docs: {
    description: { story: 'Use Intl unit formatting for category amounts and the total.' },
    source: { language: 'tsx', code: meterSource('numberFormatOptions={{ style: "unit", unit: "gigabyte", maximumFractionDigits: 1 }} ') },
  } },
  args: {
    numberFormatOptions: {
      style: 'unit',
      unit: 'gigabyte',
      maximumFractionDigits: 1,
    },
  },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('[data-ui="usage-meter-total"]')).toHaveTextContent(
      new Intl.NumberFormat('en', {
        style: 'unit',
        unit: 'gigabyte',
        maximumFractionDigits: 1,
      }).format(48),
    );
  },
};
export const CustomUnit: Story = {
  name: 'Custom allowance unit',
  parameters: { docs: {
    description: { story: 'Label an allowance with an application-specific unit such as credits.' },
    source: { language: 'tsx', code: meterSource('unitLabel="credits" ') },
  } },
  args: { unitLabel: 'credits' },
};
export const InvalidLimit: Story = {
  render: (args) => (
    <>
      {[0, -1, NaN, Infinity].map((limit, index) => (
        <UsageMeter {...args} key={index} limit={limit} label={`Unavailable ${index}`} />
      ))}
      <UsageMeter
        {...args}
        label="Overflow aggregate"
        segments={[
          { id: 'a', label: 'A', value: Number.MAX_VALUE },
          { id: 'b', label: 'B', value: Number.MAX_VALUE },
        ]}
      />
    </>
  ),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryAllByRole('meter')).toHaveLength(0);
    for (const track of canvasElement.querySelectorAll('[data-ui="usage-meter-track"]')) {
      await expect(track).not.toHaveAttribute('aria-valuenow');
      await expect(track).not.toHaveAttribute('aria-valuemax');
    }
  },
};
export const SanitizedValues: Story = {
  parameters: { docs: { source: { language: 'tsx', code: `import { UsageMeter } from '@jfrader/ui';

export function InvalidUsageValues() {
  return (
    <UsageMeter
      label="Storage"
      limit={80}
      locale="en"
      segments={[
        { id: 'negative', label: 'Negative', value: -1 },
        { id: 'nan', label: 'Not a number', value: NaN },
        { id: 'infinite', label: 'Infinite', value: Infinity },
      ]}
    />
  );
}` } } },
  args: {
    segments: [
      { id: 'negative', label: 'Negative', value: -1 },
      { id: 'nan', label: 'Not a number', value: NaN },
      { id: 'infinite', label: 'Infinite', value: Infinity },
    ],
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('meter')).toHaveAttribute('aria-valuenow', '0');
  },
};
export const LongLabels: Story = {
  args: {
    label: 'Usage allowance for archived customer account documents and shared project attachments',
    segments: [
      {
        id: 'long',
        label: 'Shared project attachments with a very long localized category label',
        value: 123456789.123,
      },
    ],
    limit: 987654321.123,
    locale: 'ar',
    unitLabel: 'business allowance units',
  },
  play: async ({ canvasElement }) => {
    for (const element of canvasElement.querySelectorAll<HTMLElement>(
      '[data-ui="usage-meter-title"], [data-ui="usage-meter-status"], [data-ui="usage-meter-total"], [data-ui="usage-meter-item"]',
    )) {
      await expect(element.scrollWidth).toBeLessThanOrEqual(element.clientWidth + 1);
    }
  },
};
export const Narrow320: Story = {
  ...LongLabels,
  decorators: [
    (Story) => (
      <NarrowFrame>
        <Story />
      </NarrowFrame>
    ),
  ],
};
export const ExternalAria: Story = {
  render: (args) => (
    <>
      <span id="external-name">Account</span>
      <span id="external-description">Monthly allowance</span>
      <UsageMeter
        {...args}
        aria-label="Root label"
        aria-labelledby="external-name missing-root"
        aria-describedby="external-description"
        slotProps={{
          track: {
            'aria-label': 'Track label',
            'aria-labelledby': 'external-name missing-track',
            'aria-describedby': 'external-description',
            'aria-valuetext': 'Custom usage text',
            'aria-valuemax': 999,
          },
        }}
      />
    </>
  ),
  play: async ({ canvasElement }) => {
    const meter = within(canvasElement).getByRole('meter', {
      name: 'Account Storage',
    });
    const group = within(canvasElement).getByRole('group', {
      name: 'Account Storage',
    });
    await expect(meter).toHaveAttribute('aria-label', 'Track label');
    await expect(group).toHaveAttribute('aria-label', 'Root label');
    await expect(meter.getAttribute('aria-labelledby')).toContain('missing-track');
    await expect(group.getAttribute('aria-labelledby')).toContain('missing-root');
    await expect(meter.getAttribute('aria-describedby')).toContain('external-description');
    await expect(meter.getAttribute('aria-describedby')).toContain(
      canvasElement.querySelector('[data-ui="usage-meter-status"]')!.id,
    );
    await expect(meter).toHaveAttribute('aria-valuetext', 'Custom usage text');
    await expect(meter).toHaveAttribute('aria-valuemax', '80');
  },
};
export const FalsyLabel: Story = {
  render: (args) => (
    <>
      {[false, null, 0, ''].map((label, index) => (
        <UsageMeter
          {...args}
          key={index}
          label={label}
          unitLabel={label}
          statusIcon={() => label}
          aria-label={`Allowance ${index}`}
        />
      ))}
    </>
  ),
  play: async ({ canvasElement }) => {
    const roots = within(canvasElement).getAllByRole('group');
    await expect(roots[0]!.querySelector('[data-ui="usage-meter-title"]')).toBeNull();
    await expect(roots[1]!.querySelector('[data-ui="usage-meter-title"]')).toBeNull();
    await expect(roots[2]!.querySelector('[data-ui="usage-meter-title"]')).toHaveTextContent('0');
    await expect(roots[3]!.querySelector('[data-ui="usage-meter-title"]')).toBeNull();
    for (const index of [0, 1, 3]) {
      await expect(
        within(roots[index]!).getByRole('meter', {
          name: `Allowance ${index}`,
        }),
      ).not.toHaveAttribute('aria-labelledby');
      await expect(roots[index]!.querySelector('[data-ui="usage-meter-unit"]')).toBeNull();
    }
  },
};
function ReplacementMeterSpan(props: import('react').ComponentPropsWithRef<'span'>) {
  return <span {...props} data-replacement="meter-span" />;
}
// This story tests the documented css/slot API and native style merging.
export const SlotStyles: Story = {
  parameters: { docs: { source: { language: 'tsx', code: `import { useRef, type ComponentPropsWithRef } from 'react';
import { UsageMeter } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const segments = [
  { id: 'files', label: 'Files', value: 24 },
  { id: 'photos', label: 'Photos', value: 16 },
  { id: 'backups', label: 'Backups', value: 8 },
];

function MeterSpan(props: ComponentPropsWithRef<'span'>) {
  return <span {...props} data-replacement="meter-span" />;
}

export function StyledStorageMeter() {
  const rootRef = useRef<HTMLDivElement>(null);
  return (
    <UsageMeter
      ref={rootRef}
      label="Storage"
      segments={segments}
      limit={80}
      locale="en"
      slots={{ segment: MeterSpan, status: MeterSpan }}
      sx={{ padding: vars.space[4] }}
      slotProps={{
        root: { sx: { padding: vars.space[1] } },
        track: { sx: { blockSize: vars.space[6] } },
        item: { sx: { paddingBlock: vars.space[3] } },
      }}
    />
  );
}` } } },
  args: {
    slots: { segment: ReplacementMeterSpan, status: ReplacementMeterSpan },
    sx: { padding: vars.space[4] },
    slotProps: {
      root: { sx: { padding: vars.space[1] } },
      track: { sx: { blockSize: vars.space[6] } },
      item: { sx: { paddingBlock: vars.space[3] } },
    },
    ref: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const root = within(canvasElement).getByRole('group');
    const meter = within(canvasElement).getByRole('meter');
    const view = canvasElement.ownerDocument.defaultView!;
    const segment = canvasElement.querySelector<HTMLElement>('[data-ui="usage-meter-segment"]')!;
    const status = canvasElement.querySelector<HTMLElement>('[data-ui="usage-meter-status"]')!;
    await expect(segment).toHaveAttribute('data-replacement', 'meter-span');
    await expect(status).toHaveAttribute('data-replacement', 'meter-span');
    await expect(segment.className).not.toBe('');
    await expect(args.ref).toHaveBeenCalledWith(root);
    await expect(Math.abs(parseFloat(view.getComputedStyle(root).paddingTop) - 16)).toBeLessThan(1.1);
    await expect(parseFloat(view.getComputedStyle(meter).height)).toBeGreaterThanOrEqual(23);
  },
};
export const LightTheme: Story = {
  decorators: [withLightTheme],
  globals: { theme: 'light' },
  args: { limit: 40, defaultValue: { kind: 'remainder' } },
};
export const RTL: Story = {
  args: { dir: 'rtl', locale: 'ar' },
  play: async ({ canvasElement, userEvent, args }) => {
    const items = within(canvasElement).getAllByRole('button');
    await userEvent.click(items[0]!);
    await userEvent.keyboard('{ArrowRight}');
    await expect(canvasElement.ownerDocument.activeElement).toBe(items[3]);
    await userEvent.keyboard('{ArrowLeft}');
    await expect(canvasElement.ownerDocument.activeElement).toBe(items[0]);
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
  },
};
export const ReducedMotion: Story = {
  args: { limit: 40 },
  parameters: {
    docs: {
      description: {
        story:
          'Enable reduced motion to jump segment widths and totals to their new values without rolling digits or layout springs.',
      },
    },
  },
};
export const ForcedColors: Story = {
  args: { limit: 40, defaultValue: { kind: 'segment', id: 'files' } },
  parameters: {
    docs: {
      description: {
        story:
          'Enable forced colors to check system-color borders, hatching and focus with an over-limit pin. This story checks structure only.',
      },
    },
  },
};
