import { StrictMode, useState, type ComponentType, type MouseEvent } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, waitFor, within } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { css } from '../../styling/css';
import { motionDurationMs } from '../../styling/motion-timings';
import { withLightTheme } from '../../testing/story-decorators';
import {
  ActivityRings,
  type ActivityDay,
  type ActivityMetric,
  type ActivityRingsMetricProps,
  type ActivityRingsProps,
  type ActivityValues,
} from './index';

/** Story args flatten the props' data-source and legend-mode unions, which Storybook's arg types cannot carry. */
type RingsArgs = Omit<ActivityRingsProps, 'values' | 'days' | 'interactiveLegend' | 'slotProps'> & {
  values?: ActivityValues;
  days?: readonly ActivityDay[];
  interactiveLegend?: boolean;
  slotProps?: Omit<NonNullable<ActivityRingsProps['slotProps']>, 'metric'> & {
    metric?: ActivityRingsMetricProps;
  };
};
function Rings({ values, days, ...props }: RingsArgs) {
  return days ? <ActivityRings {...props} days={days} /> : <ActivityRings {...props} values={values} />;
}

const goals: ActivityMetric[] = [
  { id: 'distance', label: 'Distance', goal: 6, unit: 'kilometer' },
  { id: 'exercise', label: 'Exercise', goal: 30, unit: 'minute' },
  { id: 'stand', label: 'Stand', goal: 12, unit: 'hour' },
];
const today = { distance: 4.5, exercise: 34, stand: 9 };
const week: ActivityDay[] = [
  { id: 'day-2026-10-05', date: '2026-10-05', values: { distance: 6.1, exercise: 41, stand: 12 } },
  { id: 'day-2026-10-06', date: '2026-10-06', values: { distance: 3.2, exercise: 12, stand: 8 } },
  { id: 'day-2026-10-07', date: '2026-10-07', values: { distance: 5.4, exercise: 30, stand: 11 } },
  { id: 'day-2026-10-08', date: '2026-10-08', values: { distance: 7, exercise: 52, stand: 13 } },
  { id: 'day-2026-10-09', date: '2026-10-09', values: { distance: 0, exercise: 0, stand: 0 } },
  { id: 'day-2026-10-10', date: '2026-10-10', values: { distance: null, exercise: null, stand: null } },
  { id: 'day-2026-10-11', date: '2026-10-11', values: today },
];
const lastDay = week.at(-1)!.id;
/** Text matchers collapse whitespace on the received side only; Intl output uses no-break spaces. */
const collapse = (text: string) => text.replace(/\s+/g, ' ');
const fullDate = (iso: string, locale = 'en-GB') =>
  new Intl.DateTimeFormat(locale, { dateStyle: 'full', calendar: 'gregory', timeZone: 'UTC' }).format(
    new Date(`${iso}T00:00:00Z`),
  );
const percent = (ratio: number, locale = 'en-GB') =>
  collapse(new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0 }).format(ratio));
const amount = (value: number, unit: string, locale = 'en-GB') =>
  collapse(
    new Intl.NumberFormat(locale, {
      style: 'unit',
      unit,
      unitDisplay: 'short',
      maximumFractionDigits: 1,
    }).format(value),
  );

const frameStyle = css({
  inlineSize: `min(24rem, calc(100vw - ${vars.space[8]}))`,
  maxInlineSize: '100%',
  display: 'grid',
  gap: vars.space[4],
});
const fixtureStyle = css({
  minBlockSize: vars.space[8],
  paddingInline: vars.space[3],
  color: vars.color.text,
  backgroundColor: vars.color.surfaceRaised,
  border: `1px solid ${vars.color.borderControl}`,
  borderRadius: vars.radius.sm,
});
const fixtureRowStyle = css({ display: 'flex', flexWrap: 'wrap', gap: vars.space[2] });

const ringParts = (root: Element, part = 'fill') => [
  ...root.querySelectorAll(`[data-ui="activity-rings-${part}"]`),
];
const drawnProgress = (stroke: Element) =>
  Number.parseFloat(stroke.getAttribute('stroke-dasharray') ?? 'NaN');
/** Waits for the sweep to settle on its target; tolerant of easing and sub-pixel rounding. */
async function expectDrawn(stroke: Element, progress: number) {
  await waitFor(() => expect(Math.abs(drawnProgress(stroke) - progress)).toBeLessThan(0.005));
}
async function expectTicksOnly(root: Element) {
  for (const ring of ringParts(root, 'ring')) {
    await expect(Array.from(ring.children, (child) => child.tagName)).toEqual(['defs', 'circle', 'circle']);
    const circles = ring.querySelectorAll(':scope > circle');
    await expect(circles).toHaveLength(2);
    for (const circle of circles) await expect(circle).toHaveAttribute('stroke-dasharray');
    await expect(ring.querySelectorAll('circle')).toHaveLength(3);
    await expect(ring.querySelector('line, path')).toBeNull();
  }
}

const meta = {
  title: 'Data display/ActivityRings',
  // The real component documents the props; stories render through the flattened adapter.
  component: ActivityRings as ComponentType<RingsArgs>,
  tags: ['autodocs'],
  render: (args) => <Rings {...args} />,
  args: {
    metrics: goals,
    values: today,
    locale: 'en-GB',
    onValueChange: fn(),
    onFocusedMetricChange: fn(),
    onRingClose: fn(),
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
          'Track daily activity against independent goals. Compare days with the week picker. Enable the interactive legend to preview or pin a metric.',
      },
      usage: `- Each ring compares a metric with its goal using the UsageMeter value rules and Intl percentage formatting.
- The SVG is decorative. The legend gives the amount, goal, and percentage; unknown values show "No data", not zero.
- All ticks at full tone mean the goal is complete. The dial stops at 100%; surplus appears only in the legend as the uncapped amount, percentage and amount over goal. Translate surplus text with \`labels.overGoal\`.
- The centre averages completion across goals, capping each at 100%. It shows a dash if any goal is unknown or unavailable. Mixed units are never added together. Translate the caption with \`labels.completion\`.
- Legend rows are static by default. With \`interactiveLegend\`, hover or focus previews a metric; activation toggles a pin. Preview does not call \`onFocusedMetricChange\`.
- Counts and sweeps retarget from their displayed values. Assistive technology receives committed values, not intermediate counts. Reduced motion shows the result immediately.
- \`days\` takes precedence over \`values\`.
- \`onRingClose\` fires when a value rises to its goal on the same day. Mounting, remounting, and changing days do not fire it.

### Keyboard
- The day picker has one Tab stop. Arrow keys move between days; Home/End choose the first/last day.
- With the legend toggle buttons enabled, Enter/Space isolate one ring.`,
      source: {
        code: [
          '<ActivityRings metrics={goals} days={week} locale="en-GB"',
          '  value={dayId} onValueChange={setDayId} interactiveLegend />',
        ].join('\n'),
      },
    },
  },
} satisfies Meta<RingsArgs>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const region = canvas.getByRole('region', { name: 'Activity' });
    const svg = region.querySelector('svg')!;
    await expect(svg).toHaveAttribute('aria-hidden', 'true');
    await expect(svg).toHaveAttribute('focusable', 'false');
    await expect(svg.querySelector('[tabindex]')).toBeNull();
    await expectTicksOnly(canvasElement);
    await expect(canvas.queryAllByRole('button')).toHaveLength(0);
    await expect(canvas.queryAllByRole('radio')).toHaveLength(0);
    await expect(canvasElement.querySelector('[aria-live]')).toBeNull();
    const items = within(canvas.getByRole('list', { name: 'Goals' })).getAllByRole('listitem');
    await expect(items).toHaveLength(3);
    await expect(items[0]).toHaveTextContent(`${amount(4.5, 'kilometer')} of ${amount(6, 'kilometer')}`);
    await expect(items[0]).toHaveTextContent(percent(0.75));
    await expect(items[1]).toHaveTextContent('+4 mins over goal');
    await expect(items[1]).not.toHaveTextContent('Goal met');
    await expect(svg.querySelector('line, [data-ui="activity-rings-endpoint"]')).toBeNull();
    await expect(canvasElement.querySelector('[data-ui="activity-rings-summary"]')).toHaveTextContent(
      '1 of 3 goals met',
    );
    await expect(args.onRingClose).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(canvasElement.querySelector('[data-ui="activity-rings-center"]')).toHaveTextContent('83%'),
    );
    await expect(canvasElement.querySelector('[data-ui="activity-rings-summary"]')).toHaveTextContent(
      '83% of goals',
    );
  },
};

export const WeekSelector: Story = {
  args: { values: undefined, days: week },
  play: async ({ canvasElement, userEvent, args }) => {
    const canvas = within(canvasElement);
    const group = canvas.getByRole('group', { name: 'Day' });
    const radios = within(group).getAllByRole('radio');
    await expect(radios).toHaveLength(7);
    await expect(radios[6]).toBeChecked();
    await expect(radios[0]).toHaveAccessibleName(fullDate('2026-10-05'));
    await expect(canvasElement.querySelector('[data-ui="activity-rings-summary"]')).toHaveTextContent(
      fullDate('2026-10-11'),
    );
    await userEvent.click(radios[3]!);
    await expect(radios[3]).toBeChecked();
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenCalledWith('day-2026-10-08');
    await expect(canvasElement.querySelector('[data-ui="activity-rings-summary"]')).toHaveTextContent(
      '3 of 3 goals met',
    );
    await userEvent.click(radios[3]!);
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onRingClose).not.toHaveBeenCalled();
  },
};

export const InteractiveLegend: Story = {
  args: { interactiveLegend: true },
  play: async ({ canvasElement, userEvent, args }) => {
    const canvas = within(canvasElement);
    const buttons = canvas.getAllByRole('button');
    const rings = ringParts(canvasElement, 'ring');
    await expect(buttons).toHaveLength(3);
    await expect(buttons[0]).toHaveAccessibleName(/Distance/);
    await expect(buttons[0]).toHaveAccessibleName(new RegExp(percent(0.75)));
    await userEvent.click(buttons[1]!);
    await expect(buttons[1]).toHaveAttribute('aria-pressed', 'true');
    await expect(rings[0]).toHaveAttribute('data-dimmed', 'true');
    await expect(rings[1]).toHaveAttribute('data-dimmed', 'false');
    await userEvent.click(buttons[1]!);
    await expect(buttons[1]).toHaveAttribute('aria-pressed', 'false');
    await expect(rings[0]).toHaveAttribute('data-dimmed', 'false');
    await expect(args.onFocusedMetricChange).toHaveBeenCalledTimes(2);
    await expect(args.onFocusedMetricChange).toHaveBeenNthCalledWith(1, 'exercise');
    await expect(args.onFocusedMetricChange).toHaveBeenNthCalledWith(2, null);
  },
};

/** Persistent isolated state for the axe gate. */
export const Isolated: Story = {
  args: { interactiveLegend: true, defaultFocusedMetric: 'stand' },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('button', { name: /Stand/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  },
};

/** Hover previews another metric without replacing a controlled pin. */
export const MetricPreview: Story = {
  args: { interactiveLegend: true, focusedMetric: 'stand' },
  play: async ({ canvasElement, userEvent, args }) => {
    const canvas = within(canvasElement);
    const center = canvasElement.querySelector('[data-ui="activity-rings-center"]')!;
    const distance = canvas.getByRole('button', { name: /Distance/ });
    await userEvent.hover(distance);
    await expect(center).toHaveAttribute('data-metric', 'distance');
    await expect(ringParts(canvasElement, 'ring')[2]).toHaveAttribute('data-dimmed', 'true');
    await expect(canvas.getByRole('button', { name: /Stand/ })).toHaveAttribute('aria-pressed', 'true');
    await expect(args.onFocusedMetricChange).not.toHaveBeenCalled();
    await userEvent.unhover(distance);
    await expect(center).toHaveAttribute('data-metric', 'stand');
    await userEvent.click(distance);
    await expect(args.onFocusedMetricChange).toHaveBeenCalledTimes(1);
    await expect(center).toHaveAttribute('data-metric', 'stand');
  },
};

export const CancelledPreview: Story = {
  args: {
    interactiveLegend: true,
    slotProps: {
      metric: {
        onMouseEnter: (event) => event.preventDefault(),
        onFocus: (event) => event.preventDefault(),
        onClick: (event) => event.preventDefault(),
      },
    },
  },
  play: async ({ canvasElement, userEvent, args }) => {
    const button = within(canvasElement).getByRole('button', { name: /Distance/ });
    await userEvent.hover(button);
    await userEvent.click(button);
    await expect(canvasElement.querySelector('[data-ui="activity-rings-center"]')).not.toHaveAttribute(
      'data-metric',
    );
    await expect(args.onFocusedMetricChange).not.toHaveBeenCalled();
  },
};

export const Sizes: Story = {
  render: (args) => (
    <>
      {(['sm', 'md', 'lg'] as const).map((size) => (
        <Rings {...args} key={size} size={size} aria-label={`${size} rings`} />
      ))}
    </>
  ),
  play: async ({ canvasElement }) => {
    const widths = ['sm', 'md', 'lg'].map((size) => {
      const region = within(canvasElement).getByRole('region', { name: `${size} rings` });
      return region.querySelector('svg')!.getBoundingClientRect().width;
    });
    await expect(widths[0]).toBeLessThan(widths[1]!);
    await expect(widths[1]).toBeLessThan(widths[2]!);
  },
};

export const OneMetric: Story = { args: { metrics: goals.slice(0, 1) } };
export const FiveMetrics: Story = {
  args: {
    metrics: [
      ...goals,
      { id: 'steps', label: 'Steps', goal: 8000, tone: 'warning' },
      { id: 'water', label: 'Water', goal: 2, unit: 'liter', tone: 'info' },
    ],
    values: { ...today, steps: 9100, water: 1.4 },
  },
};
const manyMetrics: ActivityMetric[] = Array.from({ length: 12 }, (_, index) => ({
  id: `metric-${index}`,
  label: `Goal ${index + 1}`,
  goal: 10,
}));
export const ManyMetrics: Story = {
  args: {
    metrics: manyMetrics,
    values: Object.fromEntries(manyMetrics.map((metric, index) => [metric.id, index * 2])),
  },
  play: async ({ canvasElement }) => {
    const tracks = ringParts(canvasElement, 'track');
    await expect(tracks).toHaveLength(12);
    for (const track of tracks) {
      const radius = Number(track.getAttribute('r'));
      const stroke = Number(track.getAttribute('stroke-width'));
      await expect(stroke).toBeGreaterThan(0);
      await expect(radius - stroke / 2).toBeGreaterThan(0);
    }
    const radii = tracks.map((track) => Number(track.getAttribute('r')));
    for (let index = 1; index < radii.length; index += 1) {
      const gap = radii[index - 1]! - radii[index]! - Number(tracks[index]!.getAttribute('stroke-width'));
      await expect(gap).toBeGreaterThan(-0.001);
    }
  },
};

const boundaryMetrics: ActivityMetric[] = [0, 1, 1.5, 2, 3.2].map((ratio) => ({
  id: `ratio-${ratio}`,
  label: `Ratio ${ratio}`,
  goal: 100,
}));
export const CompletionBoundaries: Story = {
  args: {
    metrics: boundaryMetrics,
    values: Object.fromEntries([0, 1, 1.5, 2, 3.2].map((ratio) => [`ratio-${ratio}`, ratio * 100])),
  },
  play: async ({ canvasElement }) => {
    const rings = ringParts(canvasElement, 'ring');
    const expected = [0, 1, 1, 1, 1];
    for (const [index, progress] of expected.entries()) {
      const fill = rings[index]!.querySelector('[data-ui="activity-rings-fill"]')!;
      await expectDrawn(fill, progress);
    }
    await expectTicksOnly(canvasElement);
    const items = within(canvasElement).getAllByRole('listitem');
    await expect(items[0]).toHaveTextContent(percent(0));
    await expect(items[0]).not.toHaveTextContent('Goal met');
    await expect(items[1]).toHaveTextContent('Goal met');
    await expect(items[4]).toHaveTextContent(`320 of 100 · ${percent(3.2)} · +220 over goal`);
    await expect(items[4]).toHaveTextContent(percent(3.2));
    await expect(rings[4]).toHaveAttribute('data-status', 'closed');
  },
};

export const OverGoal: Story = { args: { values: { distance: 9, exercise: 52, stand: 13 } } };
export const BelowGoals: Story = { args: { values: { ...today, exercise: 24 } } };
export const BeyondDoubleGoal: Story = {
  args: { values: { ...today, exercise: 67.5 }, interactiveLegend: true },
  play: async ({ canvasElement }) => {
    const exercise = within(canvasElement).getByRole('button', { name: /^Exercise/ });
    await expect(exercise).toHaveAccessibleName(
      /Exercise 67\.5\smins of 30\smins · 225% · \+37\.5\smins over goal/,
    );
    await expectDrawn(ringParts(canvasElement)[1]!, 1);
    await expectTicksOnly(canvasElement);
    await waitFor(() =>
      expect(canvasElement.querySelector('[data-ui="activity-rings-center"]')).toHaveTextContent('83%'),
    );
  },
};
export const SurplusWithMissingMetric: Story = {
  args: { values: { distance: null, exercise: 67.5, stand: 9 } },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('[data-ui="activity-rings-center"]')).toHaveTextContent('—');
    await expect(within(canvasElement).getAllByRole('listitem')[1]).toHaveTextContent(
      '225% · +37.5 mins over goal',
    );
  },
};

const surplusRatios = [0, 0.999, 1, 1.001, 1.13, 1.99, 2, 3.5];
const preciseMinutes = (value: number, locale: string | undefined) =>
  new Intl.NumberFormat(locale, {
    style: 'unit',
    unit: 'minute',
    unitDisplay: 'short',
    maximumFractionDigits: 2,
  }).format(value);
function SurplusStatesFixture(args: RingsArgs) {
  const [ratio, setRatio] = useState(0);
  return (
    <>
      <div css={fixtureRowStyle}>
        {surplusRatios.map((next) => (
          <button key={next} css={fixtureStyle} onClick={() => setRatio(next)}>
            {new Intl.NumberFormat(args.locale, { style: 'percent', maximumFractionDigits: 1 }).format(next)}
          </button>
        ))}
      </div>
      <Rings
        {...args}
        metrics={[{ ...goals[1]!, formatValue: preciseMinutes }]}
        values={{ exercise: ratio * 30 }}
        interactiveLegend
      />
    </>
  );
}
/** Rounded percentages do not decide completion; surplus text remains uncapped. */
export const SurplusStates: Story = {
  render: (args) => <SurplusStatesFixture {...args} />,
  play: async ({ canvasElement, userEvent }) => {
    const canvas = within(canvasElement);
    const fill = ringParts(canvasElement)[0]!;
    const row = canvas.getByRole('button', { name: /^Exercise/ });
    for (const ratio of surplusRatios) {
      const label = new Intl.NumberFormat('en-GB', { style: 'percent', maximumFractionDigits: 1 }).format(
        ratio,
      );
      await userEvent.click(canvas.getByRole('button', { name: label }));
      await expectDrawn(fill, Math.min(1, ratio));
      await expectTicksOnly(canvasElement);
      if (ratio > 1) {
        await expect(row).toHaveAccessibleName(
          new RegExp(
            `\\+${collapse(preciseMinutes(ratio * 30 - 30, 'en-GB')).replace('.', '\\.')} over goal`,
          ),
        );
        await expect(row).not.toHaveAccessibleName(/Goal met/);
      } else if (ratio === 1) {
        await expect(row).toHaveAccessibleName(/100% · Goal met/);
        await expect(row).not.toHaveAccessibleName(/over goal/);
      } else {
        await expect(row).not.toHaveAccessibleName(/Goal met|over goal/);
      }
    }
    await expect(row).toHaveAccessibleName(/105\smins of 30\smins · 350% · \+75\smins over goal/);
    await expect(canvasElement.querySelector('line, [data-ui="activity-rings-endpoint"]')).toBeNull();
  },
};

export const SurplusLabel: Story = {
  args: { interactiveLegend: true, labels: { overGoal: (amount) => `${amount} above target` } },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('button', { name: /^Exercise/ })).toHaveAccessibleName(
      /113% · 4\smins above target/,
    );
    await waitFor(() =>
      expect(canvasElement.querySelector('[data-ui="activity-rings-status"]')).toHaveTextContent(
        '4 mins above target',
      ),
    );
  },
};
export const ZeroDay: Story = {
  args: { days: week, values: undefined, defaultValue: week[4]!.id },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('[data-ui="activity-rings-center"]')).toHaveTextContent('0%');
    const days = [...canvasElement.querySelectorAll('[data-ui="activity-rings-day"]')];
    await expect(days[4]!.querySelector('text')).toBeNull();
    await expect(days[5]!.querySelector('text')).toHaveTextContent('—');
  },
};
export const UnknownAndInvalid: Story = {
  args: {
    metrics: [goals[0]!, goals[1]!, { ...goals[2]!, goal: 0 }],
    values: { distance: null, exercise: null, stand: 9 },
  },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('[data-ui="activity-rings-center"]')).toHaveTextContent('—');
    await expect(canvasElement.querySelector('[data-ui="activity-rings-summary"]')).toHaveTextContent(
      'No data',
    );
    await expect(canvasElement.querySelector('[data-ui="activity-rings-summary"]')).not.toHaveTextContent(
      '0 of',
    );
  },
};

export const ValueBoundaries: Story = {
  args: {
    metrics: [
      { id: 'missing', label: 'Missing', goal: 10 },
      { id: 'null', label: 'Null', goal: 10 },
      { id: 'nan', label: 'Not a number', goal: 10 },
      { id: 'infinite', label: 'Infinite', goal: 10 },
      { id: 'zero', label: 'Zero', goal: 10 },
      { id: 'negative', label: 'Negative', goal: 10 },
      { id: 'zero-goal', label: 'Zero goal', goal: 0 },
      { id: 'bad-goal', label: 'Bad goal', goal: Number.NaN },
    ],
    values: {
      null: null,
      nan: Number.NaN,
      infinite: Infinity,
      zero: 0,
      negative: -4,
      'zero-goal': 5,
      'bad-goal': 5,
    },
  },
  play: async ({ canvasElement }) => {
    const items = within(canvasElement).getAllByRole('listitem');
    for (const index of [0, 1, 2, 3]) {
      await expect(items[index]).toHaveTextContent('No data');
      await expect(items[index]).not.toHaveTextContent(percent(0));
    }
    await expect(items[4]).toHaveTextContent(`0 of 10 · ${percent(0)}`);
    await expect(items[5]).toHaveTextContent(`0 of 10 · ${percent(0)}`);
    for (const index of [6, 7]) {
      await expect(items[index]).toHaveTextContent('5 · Goal unavailable');
      await expect(items[index]).not.toHaveTextContent('Goal met');
    }
    const rings = ringParts(canvasElement, 'ring');
    await expect(rings.map((ring) => ring.getAttribute('data-status'))).toEqual([
      'unknown',
      'unknown',
      'unknown',
      'unknown',
      'open',
      'open',
      'unavailable',
      'unavailable',
    ]);
    for (const fill of ringParts(canvasElement)) await expectDrawn(fill, 0);
    await expect(canvasElement.querySelector('line, [data-ui="activity-rings-endpoint"]')).toBeNull();
    await expect(canvasElement.querySelector('[data-ui="activity-rings-summary"]')).toHaveTextContent(
      '0 of 8 goals met',
    );
  },
};

export const EmptyMetrics: Story = {
  args: { metrics: [] },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole('list')).toBeNull();
    await expect(canvasElement.querySelector('svg')).toBeNull();
    await expect(canvasElement.querySelector('[data-ui="activity-rings-summary"]')).toHaveTextContent(
      'No goals',
    );
  },
};
export const EmptyDays: Story = {
  args: { values: undefined, days: [] },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole('radio')).toBeNull();
    await expect(within(canvasElement).getAllByRole('listitem')[0]).toHaveTextContent('No data');
  },
};
export const MissingSelectedDay: Story = {
  args: { values: undefined, days: week, value: 'day-1999-01-01' },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    for (const radio of canvas.getAllByRole('radio')) await expect(radio).not.toBeChecked();
    await expect(canvasElement.querySelector('[data-ui="activity-rings-summary"]')).toHaveTextContent(
      'No day selected',
    );
    await expect(canvas.getAllByRole('listitem')[0]).toHaveTextContent('No data');
    await expect(args.onValueChange).not.toHaveBeenCalled();
  },
};
export const EmptyStringDay: Story = {
  args: { values: undefined, days: week, defaultValue: '' },
  play: async ({ canvasElement, userEvent, args }) => {
    const radios = within(canvasElement).getAllByRole('radio');
    for (const radio of radios) await expect(radio).not.toBeChecked();
    await userEvent.click(radios[0]!);
    await expect(radios[0]).toBeChecked();
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenCalledWith(week[0]!.id);
  },
};
export const InvalidDayDate: Story = {
  args: { values: undefined, days: [{ id: 'not-a-date', date: '2026-02-30', values: today }] },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('radio')).toHaveAccessibleName('not-a-date');
  },
};

export const KeyboardWeek: Story = {
  args: { values: undefined, days: week, interactiveLegend: true },
  render: (args) => (
    <>
      <button css={fixtureStyle}>Before</button>
      <Rings {...args} />
      <button css={fixtureStyle}>After</button>
    </>
  ),
  play: async ({ canvasElement, userEvent, args }) => {
    const canvas = within(canvasElement);
    const doc = canvasElement.ownerDocument;
    const radios = canvas.getAllByRole('radio');
    const toggles = canvas.getAllByRole('button').slice(1, -1);
    await userEvent.click(canvas.getByRole('button', { name: 'Before' }));
    await userEvent.tab();
    await expect(doc.activeElement).toBe(toggles[0]);
    await expect(doc.defaultView!.getComputedStyle(toggles[0]!).outlineStyle).not.toBe('none');
    await expect(toggles[0]!.getBoundingClientRect().height).toBeGreaterThanOrEqual(31);
    await expect(canvasElement.querySelector('[data-ui="activity-rings-center"]')).toHaveAttribute(
      'data-metric',
      'distance',
    );
    await expect(args.onFocusedMetricChange).not.toHaveBeenCalled();
    await userEvent.keyboard('{Enter}');
    await expect(toggles[0]).toHaveAttribute('aria-pressed', 'true');
    await userEvent.keyboard(' ');
    await expect(toggles[0]).toHaveAttribute('aria-pressed', 'false');
    await expect(args.onFocusedMetricChange).toHaveBeenCalledTimes(2);
    await expect(args.onFocusedMetricChange).toHaveBeenNthCalledWith(1, 'distance');
    await expect(args.onFocusedMetricChange).toHaveBeenNthCalledWith(2, null);
    await userEvent.keyboard('{Escape}');
    await expect(args.onFocusedMetricChange).toHaveBeenCalledTimes(2);
    await userEvent.tab();
    await userEvent.tab();
    await userEvent.tab();
    await expect(doc.activeElement).toBe(radios[6]);
    const label = radios[6]!.closest('label')!;
    await expect(doc.defaultView!.getComputedStyle(label).outlineStyle).not.toBe('none');
    await expect(label.getBoundingClientRect().height).toBeGreaterThanOrEqual(31);
    await userEvent.keyboard('{ArrowLeft}');
    await expect(doc.activeElement).toBe(radios[5]);
    await expect(radios[5]).toBeChecked();
    await expect(args.onValueChange).toHaveBeenNthCalledWith(1, week[5]!.id);
    await userEvent.keyboard('{Home}');
    await expect(doc.activeElement).toBe(radios[0]);
    await expect(radios[0]).toBeChecked();
    await expect(args.onValueChange).toHaveBeenNthCalledWith(2, week[0]!.id);
    await userEvent.keyboard('{Home}');
    await expect(args.onValueChange).toHaveBeenCalledTimes(2);
    await userEvent.keyboard('{End}');
    await expect(doc.activeElement).toBe(radios[6]);
    await expect(args.onValueChange).toHaveBeenNthCalledWith(3, week[6]!.id);
    await expect(args.onValueChange).toHaveBeenCalledTimes(3);
    await userEvent.tab();
    await expect(doc.activeElement).toBe(canvas.getByRole('button', { name: 'After' }));
    await userEvent.tab({ shift: true });
    await expect(doc.activeElement).toBe(radios[6]);
    await userEvent.tab({ shift: true });
    await userEvent.tab({ shift: true });
    await userEvent.tab({ shift: true });
    await expect(doc.activeElement).toBe(toggles[0]);
    await expect(args.onRingClose).not.toHaveBeenCalled();
  },
};

export const ControlledRejects: Story = {
  args: { values: undefined, days: week, value: lastDay, interactiveLegend: true, focusedMetric: null },
  play: async ({ canvasElement, userEvent, args }) => {
    const canvas = within(canvasElement);
    const radios = canvas.getAllByRole('radio');
    await userEvent.click(radios[2]!);
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenCalledWith(week[2]!.id);
    await expect(radios[6]).toBeChecked();
    await expect(radios[2]).not.toBeChecked();
    await expect(canvasElement.querySelector('[data-ui="activity-rings-summary"]')).toHaveTextContent(
      fullDate('2026-10-11'),
    );
    await userEvent.keyboard('{Home}');
    await expect(args.onValueChange).toHaveBeenCalledTimes(2);
    await expect(radios[6]).toBeChecked();
    const toggle = canvas.getByRole('button', { name: /Distance/ });
    await userEvent.click(toggle);
    await expect(args.onFocusedMetricChange).toHaveBeenCalledTimes(1);
    await expect(args.onFocusedMetricChange).toHaveBeenCalledWith('distance');
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await expect(ringParts(canvasElement, 'ring')[1]).toHaveAttribute('data-dimmed', 'false');
  },
};

function ControlledFixture(args: RingsArgs) {
  const [dayId, setDayId] = useState<string | null>(week[0]!.id);
  const [focused, setFocused] = useState<string | null>(null);
  return (
    <>
      <div css={fixtureRowStyle}>
        <button css={fixtureStyle} onClick={() => setDayId(lastDay)}>
          Show last day
        </button>
        <button css={fixtureStyle} onClick={() => setFocused('exercise')}>
          Isolate exercise
        </button>
        <button css={fixtureStyle} onClick={() => setFocused('')}>
          Isolate empty id
        </button>
      </div>
      <Rings
        {...args}
        values={undefined}
        days={week}
        value={dayId}
        onValueChange={(next) => {
          setDayId(next);
          args.onValueChange?.(next);
        }}
        focusedMetric={focused}
        onFocusedMetricChange={(next) => {
          setFocused(next);
          args.onFocusedMetricChange?.(next);
        }}
      />
    </>
  );
}
export const Controlled: Story = {
  args: { interactiveLegend: true },
  render: (args) => <ControlledFixture {...args} />,
  play: async ({ canvasElement, userEvent, args }) => {
    const canvas = within(canvasElement);
    const radios = canvas.getAllByRole('radio');
    await expect(radios[0]).toBeChecked();
    await userEvent.click(canvas.getByRole('button', { name: 'Show last day' }));
    await expect(radios[6]).toBeChecked();
    await userEvent.click(canvas.getByRole('button', { name: 'Isolate exercise' }));
    await expect(canvas.getByRole('button', { name: /Exercise/ })).toHaveAttribute('aria-pressed', 'true');
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await expect(args.onFocusedMetricChange).not.toHaveBeenCalled();
    await userEvent.click(canvas.getByRole('button', { name: 'Isolate empty id' }));
    for (const toggle of canvas.getAllByRole('button', { pressed: false }))
      await expect(toggle).toBeVisible();
    await expect(canvas.queryAllByRole('button', { pressed: true })).toHaveLength(0);
    await userEvent.click(canvas.getByRole('button', { name: /Stand/ }));
    await expect(args.onFocusedMetricChange).toHaveBeenCalledTimes(1);
    await expect(args.onFocusedMetricChange).toHaveBeenCalledWith('stand');
    await userEvent.click(radios[1]!);
    await expect(radios[1]).toBeChecked();
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenCalledWith(week[1]!.id);
  },
};

function SeedFixture(args: RingsArgs) {
  const [days, setDays] = useState<readonly ActivityDay[]>(week.slice(0, 3));
  return (
    <>
      <button css={fixtureStyle} onClick={() => setDays(week)}>
        Load full week
      </button>
      <Rings {...args} values={undefined} days={days} />
    </>
  );
}
export const SeededOnce: Story = {
  render: (args) => <SeedFixture {...args} />,
  play: async ({ canvasElement, userEvent, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getAllByRole('radio')[2]).toBeChecked();
    await userEvent.click(canvas.getByRole('button', { name: 'Load full week' }));
    const radios = canvas.getAllByRole('radio');
    await expect(radios).toHaveLength(7);
    await expect(radios[2]).toBeChecked();
    await expect(args.onValueChange).not.toHaveBeenCalled();
  },
};

function CrossingFixture(args: RingsArgs) {
  const [distance, setDistance] = useState<number | null>(5.94);
  return (
    <>
      <div css={fixtureRowStyle}>
        {([5.94, 6, 6.12, null] as const).map((next) => (
          <button key={String(next)} css={fixtureStyle} onClick={() => setDistance(next)}>
            {`Set ${next ?? 'unknown'}`}
          </button>
        ))}
      </div>
      <Rings {...args} values={{ ...today, distance }} />
    </>
  );
}
export const GoalCrossing: Story = {
  render: (args) => <CrossingFixture {...args} />,
  play: async ({ canvasElement, userEvent, args }) => {
    const canvas = within(canvasElement);
    const set = (label: string) => userEvent.click(canvas.getByRole('button', { name: `Set ${label}` }));
    await expect(args.onRingClose).not.toHaveBeenCalled();
    await expect(canvas.getAllByRole('listitem')[0]).toHaveTextContent(percent(0.99));
    await expect(canvas.getAllByRole('listitem')[0]).not.toHaveTextContent('Goal met');
    await set('6');
    await expect(args.onRingClose).toHaveBeenCalledTimes(1);
    await expect(args.onRingClose).toHaveBeenCalledWith('distance', null);
    await expect(canvas.getAllByRole('listitem')[0]).toHaveTextContent('Goal met');
    await set('6.12');
    await expect(args.onRingClose).toHaveBeenCalledTimes(1);
    await expect(canvas.getAllByRole('listitem')[0]).toHaveTextContent('102% · +0.1 km over goal');
    await expect(
      canvas.getAllByRole('listitem')[0]!.querySelector('[data-ui="activity-rings-status"]'),
    ).toBeVisible();
    await set('5.94');
    await set('6.12');
    await expect(args.onRingClose).toHaveBeenCalledTimes(2);
    await expect(canvas.getAllByRole('listitem')[0]).toHaveTextContent('102% · +0.1 km over goal');
    await expectTicksOnly(canvasElement);
    await set('unknown');
    await set('6.12');
    await expect(args.onRingClose).toHaveBeenCalledTimes(2);
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await expect(args.onFocusedMetricChange).not.toHaveBeenCalled();
  },
};

function GoalValidityFixture(args: RingsArgs) {
  const [state, setState] = useState({ goal: 6, distance: 0 });
  return (
    <>
      <div css={fixtureRowStyle}>
        <button css={fixtureStyle} onClick={() => setState({ goal: 0, distance: 0 })}>
          Remove goal
        </button>
        <button css={fixtureStyle} onClick={() => setState({ goal: 6, distance: 6 })}>
          Restore completed goal
        </button>
        <button css={fixtureStyle} onClick={() => setState({ goal: 6, distance: 3 })}>
          Walk 3 km
        </button>
      </div>
      <Rings {...args} metrics={[{ ...goals[0]!, goal: state.goal }]} values={{ distance: state.distance }} />
    </>
  );
}

/** Restoring a goal starts a new baseline, even when its previous ratio was zero. */
export const GoalValidityBaseline: Story = {
  render: (args) => <GoalValidityFixture {...args} />,
  play: async ({ canvasElement, userEvent, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Remove goal' }));
    await expect(canvas.getByRole('listitem')).toHaveTextContent('Goal unavailable');
    await userEvent.click(canvas.getByRole('button', { name: 'Restore completed goal' }));
    await expect(canvas.getByRole('listitem')).toHaveTextContent('Goal met');
    await expect(args.onRingClose).not.toHaveBeenCalled();
    await userEvent.click(canvas.getByRole('button', { name: 'Walk 3 km' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Restore completed goal' }));
    await expect(args.onRingClose).toHaveBeenCalledTimes(1);
  },
};

function DayCrossingFixture(args: RingsArgs) {
  const [mounted, setMounted] = useState(true);
  return (
    <>
      <button css={fixtureStyle} onClick={() => setMounted(!mounted)}>
        Remount
      </button>
      {mounted && <Rings {...args} values={undefined} days={week} defaultValue={week[1]!.id} />}
    </>
  );
}
export const DaySwitchNoCelebration: Story = {
  render: (args) => <DayCrossingFixture {...args} />,
  play: async ({ canvasElement, userEvent, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getAllByRole('radio')[3]!);
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await userEvent.click(canvas.getByRole('button', { name: 'Remount' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Remount' }));
    await expect(canvas.getAllByRole('radio')[1]).toBeChecked();
    await expect(args.onRingClose).not.toHaveBeenCalled();
  },
};

/** Inside the 240ms sweep, so the second update retargets a moving fill. */
const MID_SWEEP_MS = motionDurationMs.slow / 4;
function QuickUpdatesFixture(args: RingsArgs) {
  const [distance, setDistance] = useState(0);
  return (
    <>
      <button
        css={fixtureStyle}
        onClick={() => {
          setDistance(5);
          setTimeout(() => setDistance(3), MID_SWEEP_MS);
        }}
      >
        Interrupt
      </button>
      <Rings {...args} metrics={goals.slice(0, 1)} values={{ distance }} />
    </>
  );
}
export const QuickInterruptedUpdates: Story = {
  render: (args) => <QuickUpdatesFixture {...args} />,
  play: async ({ canvasElement, userEvent, args }) => {
    const canvas = within(canvasElement);
    const fill = ringParts(canvasElement)[0]!;
    const counter = canvas.getByRole('listitem').querySelector('[data-ui="activity-rings-count"]')!;
    const samples: { amount: number; sweep: number; target: number }[] = [];
    const view = canvasElement.ownerDocument.defaultView!;
    const sampling = new Promise<void>((resolve) => {
      const start = view.performance.now();
      const sample = () => {
        samples.push({
          amount: parseFloat(counter.textContent!),
          sweep: drawnProgress(fill),
          target: Number(fill.getAttribute('data-progress')),
        });
        if (view.performance.now() - start > motionDurationMs.slow * 3) resolve();
        else view.requestAnimationFrame(sample);
      };
      view.requestAnimationFrame(sample);
    });
    await userEvent.click(canvas.getByRole('button', { name: 'Interrupt' }));
    await sampling;
    await expect(
      samples.some((sample) => sample.target > 0.8 && sample.amount > 0 && sample.amount < 5),
    ).toBe(true);
    await expect(
      samples.some(
        (sample) => sample.target === 0.5 && sample.amount > 0 && Math.abs(sample.amount - 3) > 0.1,
      ),
    ).toBe(true);
    for (const sample of samples) {
      await expect(Math.abs(sample.sweep - sample.amount / 6)).toBeLessThan(0.04);
    }
    await waitFor(() => expect(canvas.getByRole('listitem')).toHaveTextContent(percent(0.5)));
    await expectDrawn(ringParts(canvasElement)[0]!, 0.5);
    await expectTicksOnly(canvasElement);
    await expect(args.onRingClose).toHaveBeenCalledTimes(0);
  },
};

function ReturnBelowGoalFixture(args: RingsArgs) {
  const [distance, setDistance] = useState(9);
  return (
    <>
      <button css={fixtureStyle} onClick={() => setDistance(3)}>
        Walk 3 km
      </button>
      <button css={fixtureStyle} onClick={() => setDistance(9)}>
        Walk 9 km
      </button>
      <Rings {...args} metrics={goals.slice(0, 1)} values={{ distance }} />
    </>
  );
}

/** The ticks stay full while the displayed amount exceeds the goal, then retract with the count. */
export const ReturningBelowGoal: Story = {
  render: (args) => <ReturnBelowGoalFixture {...args} />,
  play: async ({ canvasElement, userEvent }) => {
    const canvas = within(canvasElement);
    const fill = ringParts(canvasElement)[0]!;
    const counter = canvas.getByRole('listitem').querySelector('[data-ui="activity-rings-count"]')!;
    await waitFor(() => expect(counter).toHaveTextContent('9 km of 6 km'));
    await userEvent.click(canvas.getByRole('button', { name: 'Walk 3 km' }));
    const samples: { amount: number; fill: number }[] = [];
    const view = canvasElement.ownerDocument.defaultView!;
    await new Promise<void>((resolve) => {
      const start = view.performance.now();
      const sample = () => {
        samples.push({
          amount: parseFloat(counter.textContent!),
          fill: drawnProgress(fill),
        });
        if (view.performance.now() - start > motionDurationMs.slow * 2) resolve();
        else view.requestAnimationFrame(sample);
      };
      view.requestAnimationFrame(sample);
    });
    await expect(samples.some((sample) => sample.amount > 3 && sample.amount < 9)).toBe(true);
    for (const sample of samples) {
      await expect(Math.abs(sample.fill - Math.min(sample.amount / 6, 1))).toBeLessThan(0.04);
    }
    await expectTicksOnly(canvasElement);
    await expectDrawn(fill, 0.5);
    await expect(counter).toHaveTextContent('3 km of 6 km');
    await expect(canvas.getByRole('listitem')).toHaveTextContent('50%');
  },
};

export const IntlFormatting: Story = {
  render: (args) => (
    <>
      {['en-GB', 'de', 'ar-EG'].map((locale) => (
        <Rings {...args} key={locale} locale={locale} days={week} values={undefined} aria-label={locale} />
      ))}
    </>
  ),
  play: async ({ canvasElement }) => {
    for (const locale of ['en-GB', 'de', 'ar-EG']) {
      const region = within(canvasElement).getByRole('region', { name: locale });
      const first = within(region).getAllByRole('listitem')[0]!;
      await expect(first).toHaveTextContent(amount(4.5, 'kilometer', locale));
      await expect(first).toHaveTextContent(percent(0.75, locale));
      await expect(within(region).getAllByRole('radio')[0]).toHaveAccessibleName(
        fullDate('2026-10-05', locale),
      );
    }
  },
};

const formatSteps = (value: number, locale: string | undefined) =>
  new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value);
export const CustomFormatter: Story = {
  args: {
    metrics: [{ id: 'steps', label: 'Steps', goal: 10000, formatValue: formatSteps }],
    values: { steps: 12345 },
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('listitem')).toHaveTextContent(
      `${formatSteps(12345, 'en-GB')} of ${formatSteps(10000, 'en-GB')}`,
    );
  },
};

export const LongIntlUnits: Story = {
  args: {
    locale: 'de',
    metrics: [
      {
        id: 'distance',
        label: 'Zurückgelegte Strecke im Wochenvergleich',
        goal: 123456.7,
        unit: 'kilometer',
      },
      { id: 'speed', label: 'Durchschnittsgeschwindigkeit', goal: 98765.4, unit: 'kilometer-per-hour' },
      { id: 'volume', label: 'Wasseraufnahme', goal: 3, unit: 'liter' },
    ],
    values: { distance: 98765432.1, speed: 12345.6, volume: 2.25 },
  },
  play: async ({ canvasElement }) => {
    for (const element of canvasElement.querySelectorAll<HTMLElement>('[data-ui="activity-rings-metric"]')) {
      await expect(element.scrollWidth).toBeLessThanOrEqual(element.clientWidth + 1);
    }
  },
};

export const NarrowLongUnits: Story = {
  ...LongIntlUnits,
  args: { ...LongIntlUnits.args, interactiveLegend: true },
  decorators: [
    (Story) => (
      <div style={{ inlineSize: 320, maxInlineSize: '100%' }}>
        <Story />
      </div>
    ),
  ],
  play: async (context) => {
    await LongIntlUnits.play!(context);
    const { canvasElement } = context;
    const svg = canvasElement.querySelector('svg')!.getBoundingClientRect();
    const legend = within(canvasElement).getByRole('list').getBoundingClientRect();
    await expect(legend.top).toBeGreaterThanOrEqual(svg.bottom - 1);
    const region = within(canvasElement).getByRole('region');
    await expect(region.scrollWidth).toBeLessThanOrEqual(region.clientWidth + 1);
  },
};
export const Narrow: Story = {
  args: { days: week, values: undefined, interactiveLegend: true },
  decorators: [
    (Story) => (
      <div style={{ inlineSize: 320, maxInlineSize: '100%' }}>
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    const days = [...canvasElement.querySelectorAll('[data-ui="activity-rings-day"]')];
    await expect(new Set(days.map((day) => Math.round(day.getBoundingClientRect().top))).size).toBe(1);
    const root = canvasElement.querySelector<HTMLElement>('[data-ui="activity-rings"]')!;
    await expect(root.scrollWidth).toBeLessThanOrEqual(root.clientWidth + 1);
  },
};
export const Wide: Story = {
  decorators: [
    (Story) => (
      <div style={{ inlineSize: '40rem', maxInlineSize: 'calc(100vw - 2rem)' }}>
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    const svg = canvasElement.querySelector('svg')!.getBoundingClientRect();
    const legend = within(canvasElement).getByRole('list').getBoundingClientRect();
    await expect(legend.left).toBeGreaterThanOrEqual(svg.right - 1);
  },
};

export const HiddenLegend: Story = {
  args: { hideLegend: true },
  play: async ({ canvasElement }) => {
    const list = within(canvasElement).getByRole('list', { name: 'Goals' });
    await expect(list.getBoundingClientRect().width).toBeLessThanOrEqual(1);
    await expect(within(list).getAllByRole('listitem')[0]).toHaveTextContent(percent(0.75));
  },
};

export const ExternalAria: Story = {
  render: (args) => (
    <>
      <span id="rings-external-name">Weekly</span>
      <span id="rings-external-description">Goals reset at midnight</span>
      <Rings
        {...args}
        aria-labelledby="rings-external-name rings-missing-name"
        aria-describedby="rings-external-description rings-missing-description"
      />
      <Rings {...args} aria-label="Consumer name" />
    </>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const labelled = canvas.getByRole('region', { name: 'Weekly Activity' });
    await expect(labelled.getAttribute('aria-labelledby')).toContain('rings-missing-name');
    await expect(labelled).toHaveAttribute(
      'aria-describedby',
      'rings-external-description rings-missing-description',
    );
    await expect(labelled).toHaveAccessibleDescription('Goals reset at midnight');
    const named = canvas.getByRole('region', { name: 'Consumer name' });
    await expect(named).toHaveAttribute('aria-label', 'Consumer name');
    await expect(named).not.toHaveAttribute('aria-labelledby');
  },
};

export const MultipleInstances: Story = {
  args: { values: undefined, days: week },
  render: (args) => (
    <>
      <Rings {...args} aria-label="First" />
      <Rings {...args} aria-label="Second" />
    </>
  ),
  play: async ({ canvasElement, userEvent, args }) => {
    const canvas = within(canvasElement);
    const first = within(canvas.getByRole('region', { name: 'First' })).getAllByRole('radio');
    const second = within(canvas.getByRole('region', { name: 'Second' })).getAllByRole('radio');
    await expect(first[0]!.getAttribute('name')).not.toBe(second[0]!.getAttribute('name'));
    await userEvent.click(first[0]!);
    await expect(first[0]).toBeChecked();
    await expect(second[6]).toBeChecked();
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    const ids = [...canvasElement.querySelectorAll('[id]')].map((element) => element.id);
    await expect(new Set(ids).size).toBe(ids.length);
  },
};

function RefFixture(args: RingsArgs) {
  const [mounted, setMounted] = useState(true);
  return (
    <>
      <button css={fixtureStyle} onClick={() => setMounted(false)}>
        Unmount
      </button>
      {mounted && (
        <StrictMode>
          <Rings {...args} />
        </StrictMode>
      )}
    </>
  );
}
export const RootRef: Story = {
  args: { ref: fn((element: HTMLElement | null) => (element ? fn() : undefined)) },
  render: (args) => <RefFixture {...args} />,
  play: async ({ canvasElement, userEvent, args }) => {
    const canvas = within(canvasElement);
    const region = canvas.getByRole('region');
    const refSpy = args.ref as ReturnType<typeof fn>;
    await expect(refSpy.mock.calls.at(-1)?.[0]).toBe(region);
    await expect(region.tagName).toBe('SECTION');
    const cleanups = refSpy.mock.results.filter(
      (result) => result.type === 'return' && typeof result.value === 'function',
    );
    await expect(cleanups.length).toBeGreaterThanOrEqual(1);
    for (const cleanup of cleanups.slice(0, -1)) await expect(cleanup.value).toHaveBeenCalledTimes(1);
    await expect(cleanups.at(-1)!.value).not.toHaveBeenCalled();
    await userEvent.click(canvas.getByRole('button', { name: 'Unmount' }));
    for (const cleanup of cleanups) await expect(cleanup.value).toHaveBeenCalledTimes(1);
  },
};

export const UnsanctionedUnit: Story = {
  args: {
    metrics: [
      { id: 'energy', label: 'Energy', goal: 500, unit: 'kcal' },
      { id: 'distance', label: 'Distance', goal: 6, unit: 'kilometer' },
    ],
    values: { energy: 320.25, distance: 4.5 },
  },
  play: async ({ canvasElement }) => {
    const plain = (value: number) =>
      new Intl.NumberFormat('en-GB', { maximumFractionDigits: 1 }).format(value);
    const items = within(canvasElement).getAllByRole('listitem');
    await expect(items[0]).toHaveTextContent(`${plain(320.25)} of ${plain(500)} · ${percent(0.6405)}`);
    await expect(items[1]).toHaveTextContent(`${amount(4.5, 'kilometer')} of ${amount(6, 'kilometer')}`);
    await expect(ringParts(canvasElement, 'ring').map((ring) => ring.getAttribute('data-status'))).toEqual([
      'open',
      'open',
    ]);
  },
};

export const SlotStyles: Story = {
  args: {
    interactiveLegend: true,
    days: week,
    values: undefined,
    sx: { padding: vars.space[4] },
    slotProps: {
      metric: { css: { paddingBlock: vars.space[3] }, 'aria-describedby': 'rings-slot-hint' },
      summary: { css: { fontWeight: vars.fontWeight.regular } },
      dayLabel: { css: { minInlineSize: vars.space[12] } },
    },
  },
  render: (args) => (
    <>
      <span id="rings-slot-hint">Isolates one ring</span>
      <Rings {...args} />
    </>
  ),
  play: async ({ canvasElement }) => {
    const view = canvasElement.ownerDocument.defaultView!;
    const canvas = within(canvasElement);
    const style = (element: Element) => view.getComputedStyle(element);
    await expect(Math.abs(parseFloat(style(canvas.getByRole('region')).paddingTop) - 16)).toBeLessThan(1.1);
    const toggle = canvas.getAllByRole('button')[0]!;
    await expect(Math.abs(parseFloat(style(toggle).paddingTop) - 12)).toBeLessThan(1.1);
    await expect(toggle).toHaveAccessibleDescription('Isolates one ring');
    const summary = canvasElement.querySelector('[data-ui="activity-rings-summary"]')!;
    await expect(style(summary).fontWeight).toBe('400');
    const dayLabel = canvas.getAllByRole('radio')[0]!.closest('label')!;
    await expect(dayLabel.getBoundingClientRect().width).toBeGreaterThanOrEqual(47);
  },
};

export const StaticSlotProps: Story = {
  args: {
    slotProps: { metric: { 'aria-describedby': 'rings-static-hint', onMouseEnter: fn() } },
  },
  render: (args) => (
    <>
      <span id="rings-static-hint">Updated hourly</span>
      <Rings {...args} />
    </>
  ),
  play: async ({ canvasElement, userEvent, args }) => {
    const rows = [...canvasElement.querySelectorAll<HTMLElement>('[data-ui="activity-rings-metric"]')];
    await expect(rows.map((row) => row.tagName)).toEqual(['DIV', 'DIV', 'DIV']);
    for (const row of rows) await expect(row).toHaveAttribute('aria-describedby', 'rings-static-hint');
    await userEvent.hover(rows[0]!);
    await expect(args.slotProps!.metric!.onMouseEnter).toHaveBeenCalledTimes(1);
  },
};

function slotTypeRegressions(flag: boolean) {
  const onButtonClick = (event: MouseEvent<HTMLButtonElement>) => event;
  const toggle = { metric: { type: 'submit', onClick: onButtonClick } } as const;
  return [
    <ActivityRings key="toggle" metrics={goals} interactiveLegend slotProps={toggle} />,
    // @ts-expect-error A plain legend row rejects button-only attributes.
    <ActivityRings key="row" metrics={goals} slotProps={{ metric: { type: 'submit' } }} />,
    // @ts-expect-error A runtime-boolean legend accepts only props shared by both row elements.
    <ActivityRings
      key="runtime"
      metrics={goals}
      interactiveLegend={flag}
      slotProps={{ metric: { onClick: onButtonClick } }}
    />,
    <ActivityRings
      key="shared"
      metrics={goals}
      interactiveLegend={flag}
      slotProps={{ metric: { 'aria-describedby': 'hint' } }}
    />,
  ];
}
export type ActivityRingsTypeRegression = typeof slotTypeRegressions;

export const LightTheme: Story = {
  decorators: [withLightTheme],
  globals: { theme: 'light' },
  args: { days: week, values: undefined, interactiveLegend: true, defaultFocusedMetric: 'distance' },
};

export const RTL: Story = {
  args: { dir: 'rtl', locale: 'ar-EG', days: week, values: undefined },
  play: async ({ canvasElement, userEvent, args }) => {
    const radios = within(canvasElement).getAllByRole('radio');
    await expect(radios[0]!.getBoundingClientRect().left).toBeGreaterThan(
      radios[6]!.getBoundingClientRect().left,
    );
    await userEvent.click(radios[3]!);
    await userEvent.keyboard('{Home}');
    await expect(canvasElement.ownerDocument.activeElement).toBe(radios[0]);
    await userEvent.keyboard('{End}');
    await expect(canvasElement.ownerDocument.activeElement).toBe(radios[6]);
    await expect(args.onValueChange).toHaveBeenCalledTimes(3);
  },
};

export const ReducedMotion: Story = {
  args: { values: { distance: 9, exercise: 12, stand: 12 } },
  parameters: {
    docs: {
      description: {
        story:
          'Enable reduced motion in the browser. Ticks should show their final fill without a sweep, and isolation dimming should have no transition. Surplus remains in the legend.',
      },
    },
  },
};

export const ForcedColors: Story = {
  args: { interactiveLegend: true, defaultFocusedMetric: 'exercise', days: week, values: undefined },
  parameters: {
    docs: {
      description: {
        story:
          'Enable forced colors in the browser. Check CanvasText ring fills, alternating dashed tracks, the numbered legend, and Highlight borders on the isolated ring.',
      },
    },
  },
};
/** Shrink-to-fit parent: the rings keep their content width instead of collapsing. */
const centered = (Story: ComponentType) => (
  <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center' }}>
    <Story />
  </div>
);
export const CenteredFlexParent: Story = {
  decorators: [centered],
  play: async ({ canvasElement }) => {
    const region = within(canvasElement).getByRole('region');
    await expect(region.getBoundingClientRect().width).toBeGreaterThanOrEqual(199);
    await expect(region.querySelector('svg')!.getBoundingClientRect().width).toBeGreaterThanOrEqual(159);
    await expect(region.scrollWidth).toBeLessThanOrEqual(region.clientWidth + 1);
  },
};
export const CenteredSizes: Story = { ...Sizes, decorators: [centered] };
export const CenteredLongIntlUnits: Story = { ...LongIntlUnits, decorators: [centered] };
export const CenteredRTL: Story = { ...RTL, decorators: [centered] };
