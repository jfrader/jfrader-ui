import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, within } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { css } from '../../styling/css';
import { withLightTheme } from '../../testing/story-decorators';
import { UsageMeter, type UsageMeterProps, type UsageMeterSelection } from './index';

const usage = [
  { id: 'files', label: 'Files', value: 24 },
  { id: 'photos', label: 'Photos', value: 16 },
  { id: 'backups', label: 'Backups', value: 8 },
];
const frameStyle = css({
  inlineSize: 'min(100%, 36rem)',
  display: 'grid',
  gap: vars.space[4],
});
const fixtureStyle = css({
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
      <div css={frameStyle}>
        <Story />
      </div>
    ),
  ],
  parameters: {
    docs: {
      description: {
        component:
          'A finite allowance meter, not task progress. The custom segmented track uses the APG meter contract: numeric ARIA saturates at the limit while value text reports actual usage and overage. Quota data belongs to the app. Translate status labels and relational copy with labels, getValueLabel and getItemLabel. The separate toggle-button legend has one Tab stop; arrows (RTL-aware), Home and End move focus, Enter/Space toggle a pin, and Escape clears it. Explicit locale is recommended for SSR.',
      },
      source: {
        code: '<UsageMeter label="Storage" segments={usage} limit={80} locale="en" unitLabel="GB" />',
      },
    },
  },
} satisfies Meta<typeof UsageMeter>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const meter = canvas.getByRole('meter', { name: 'Storage' });
    await expect(canvas.getByRole('group', { name: 'Storage' })).toHaveAttribute('data-state', 'normal');
    await expect(meter).toHaveAttribute('aria-valuemin', '0');
    await expect(meter).toHaveAttribute('aria-valuemax', '80');
    await expect(meter).toHaveAttribute('aria-valuenow', '48');
    await expect(meter).toHaveAttribute('aria-valuetext', '48 of 80, 60%. Within limit');
    await expect(meter).not.toHaveAttribute('tabindex');
    await expect(canvasElement.querySelector('[aria-live]')).toBeNull();
  },
};
export const OneSegment: Story = { args: { segments: usage.slice(0, 1) } };
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
    await expect(canvas.getByRole('button')).toHaveAccessibleName('— Remaining 80 100%');
  },
};
export const AtThreshold: Story = {
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
  args: { limit: 40 },
  play: async ({ canvasElement, userEvent }) => {
    const canvas = within(canvasElement);
    const meter = canvas.getByRole('meter');
    await expect(meter).toHaveAttribute('aria-valuenow', '40');
    await expect(meter).toHaveAttribute('aria-valuemax', '40');
    await expect(meter).toHaveAttribute('aria-valuetext', '48 of 40, 120%. Over limit: 8');
    await expect(canvasElement.querySelector('[data-ui="usage-meter-overage"]')).not.toBeNull();
    await expect(canvasElement.querySelector('[data-ui="usage-meter-limit"]')).not.toBeNull();
    await expect(canvasElement.querySelector('[data-ui="usage-meter-status"]')).toHaveTextContent(
      '! Over limit: 8',
    );
    await userEvent.hover(canvas.getAllByRole('button')[0]!);
    await expect(meter).toHaveAttribute('aria-valuenow', '40');
    await expect(meter).toHaveAttribute('aria-valuetext', '48 of 40, 120%. Over limit: 8');
    await userEvent.unhover(canvas.getAllByRole('button')[0]!);
  },
};
export const Static: Story = {
  args: { interactive: false },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryAllByRole('button')).toHaveLength(0);
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
      <button css={fixtureStyle}>Outside</button>
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
      <button css={fixtureStyle} onClick={() => setSeed({ kind: 'segment', id: 'photos' })}>
        Change default
      </button>
      <UsageMeter {...args} defaultValue={seed} />
    </>
  );
}
export const Sizes: Story = {
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
      <button css={fixtureStyle}>Before</button>
      <UsageMeter {...args} />
      <button css={fixtureStyle}>After</button>
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
  args: { announceChanges: true, defaultValue: { kind: 'remainder' } },
  render: (args) => <QuotaFixture {...args} />,
  play: async ({ canvasElement, userEvent, args }) => {
    const canvas = within(canvasElement);
    const live = canvasElement.querySelector('[aria-live]');
    await expect(live).toHaveTextContent('');
    await userEvent.click(canvas.getByRole('button', { name: 'Use more' }));
    await expect(canvas.getByRole('meter')).toHaveAttribute('aria-valuenow', '80');
    await expect(live).toHaveTextContent('Over limit');
    await expect(canvas.getByRole('button', { name: /Over limit 10 13%/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await userEvent.click(canvas.getByRole('button', { name: 'Use more' }));
    await expect(live).toHaveTextContent('Over limit');
    await expect(args.onValueChange).not.toHaveBeenCalled();
  },
};
function QuotaFixture(args: UsageMeterProps) {
  const [total, setTotal] = useState(48);
  return (
    <>
      <button css={fixtureStyle} onClick={() => setTotal(total + 42)}>
        Use more
      </button>
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
export const CustomUnit: Story = { args: { unitLabel: 'credits' } };
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
      '[data-ui="usage-meter-total"], [data-ui="usage-meter-item"]',
    )) {
      await expect(element.scrollWidth).toBeLessThanOrEqual(element.clientWidth + 1);
    }
  },
};
export const Narrow320: Story = {
  ...LongLabels,
  decorators: [
    (Story) => (
      <div style={{ inlineSize: 320, maxInlineSize: '100%' }}>
        <Story />
      </div>
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
export const SlotStyles: Story = {
  args: {
    sx: { padding: vars.space[4] },
    slotProps: {
      root: { css: { padding: vars.space[1] } },
      track: { css: { blockSize: vars.space[6] } },
      item: { css: { paddingBlock: vars.space[3] } },
    },
    ref: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const root = within(canvasElement).getByRole('group');
    const meter = within(canvasElement).getByRole('meter');
    const view = canvasElement.ownerDocument.defaultView!;
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
          'Structural over-limit fixture. Enable prefers-reduced-motion in browser QA to verify zero-duration geometry transitions.',
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
          'Structural pinned over-limit fixture. Enable forced colors in browser QA to check system-color boundaries, hatching and focus.',
      },
    },
  },
};
