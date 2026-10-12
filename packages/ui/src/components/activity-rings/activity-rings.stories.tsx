import { StrictMode, useState, type ComponentType, type MouseEvent } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, waitFor, within } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { css } from '../../styling/css';
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
  ['2026-10-05', 6.1, 41, 12],
  ['2026-10-06', 3.2, 12, 8],
  ['2026-10-07', 5.4, 30, 11],
  ['2026-10-08', 7, 52, 13],
  ['2026-10-09', 1.5, 0, 5],
  ['2026-10-10', 5.9, 28, 12],
  ['2026-10-11', 4.5, 34, 9],
].map(([date, distance, exercise, stand]) => ({
  id: `day-${date}`,
  date: date as string,
  values: { distance: distance as number, exercise: exercise as number, stand: stand as number },
}));
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
    new Intl.NumberFormat(locale, { style: 'unit', unit, unitDisplay: 'short', maximumFractionDigits: 1 }).format(
      value,
    ),
  );

const frameStyle = css({
  inlineSize: 'min(100%, 40rem)',
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

const ringParts = (root: Element, part = 'fill') => [...root.querySelectorAll(`[data-ui="activity-rings-${part}"]`)];
const drawnLaps = (stroke: Element) => Number.parseFloat(stroke.getAttribute('stroke-dasharray') ?? 'NaN');
/** Waits for the sweep to settle on its target; tolerant of easing and sub-pixel rounding. */
async function expectDrawn(stroke: Element, laps: number) {
  await waitFor(() => expect(Math.abs(drawnLaps(stroke) - laps)).toBeLessThan(0.005));
}

const meta = {
  title: 'Data Display/ActivityRings',
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
          'Concentric goal rings that present the UsageMeter model: each ring is one metric value against its goal (shared validity, over-goal and Intl percent formatting). The SVG is decorative; the legend states each exact amount, goal and percentage, and an unknown value reads as "No data", never zero. Above 100% an inset second lap is drawn; from 200% the second lap stays full while the text keeps the exact total. Optional native radio day picker (one Tab stop, browser arrow keys, Home/End to the first/last day) and opt-in toggle-button legend (Enter/Space isolate one ring). `days` wins over `values`. `onRingClose` reports a same-day value that rises to its goal; mount, remount and day switches never report.',
      },
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
    await expect(canvas.queryAllByRole('button')).toHaveLength(0);
    await expect(canvas.queryAllByRole('radio')).toHaveLength(0);
    await expect(canvasElement.querySelector('[aria-live]')).toBeNull();
    const items = within(canvas.getByRole('list', { name: 'Goals' })).getAllByRole('listitem');
    await expect(items).toHaveLength(3);
    await expect(items[0]).toHaveTextContent(`${amount(4.5, 'kilometer')} of ${amount(6, 'kilometer')}`);
    await expect(items[0]).toHaveTextContent(percent(0.75));
    await expect(items[1]).toHaveTextContent('Goal met');
    await expect(canvasElement.querySelector('[data-ui="activity-rings-summary"]')).toHaveTextContent(
      '1 of 3 goals met',
    );
    await expect(args.onRingClose).not.toHaveBeenCalled();
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

const lapMetrics: ActivityMetric[] = [0, 1, 1.5, 2, 3.2].map((ratio) => ({
  id: `ratio-${ratio}`,
  label: `Ratio ${ratio}`,
  goal: 100,
}));
export const Laps: Story = {
  args: {
    metrics: lapMetrics,
    values: Object.fromEntries([0, 1, 1.5, 2, 3.2].map((ratio) => [`ratio-${ratio}`, ratio * 100])),
  },
  play: async ({ canvasElement }) => {
    const rings = ringParts(canvasElement, 'ring');
    const expected = [
      [0, null],
      [1, null],
      [1, 0.5],
      [1, 1],
      [1, 1],
    ] as const;
    for (const [index, [first, second]] of expected.entries()) {
      const fill = rings[index]!.querySelector('[data-ui="activity-rings-fill"]')!;
      await expectDrawn(fill, first);
      const lap = rings[index]!.querySelector('[data-ui="activity-rings-lap"]');
      if (second === null) await expect(lap).toBeNull();
      else await expectDrawn(lap!, second);
    }
    const items = within(canvasElement).getAllByRole('listitem');
    await expect(items[0]).toHaveTextContent(percent(0));
    await expect(items[0]).not.toHaveTextContent('Goal met');
    await expect(items[1]).toHaveTextContent('Goal met');
    await expect(items[4]).toHaveTextContent(`320 of 100${percent(3.2)}`);
    await expect(items[4]).toHaveTextContent(percent(3.2));
    await expect(rings[4]).toHaveAttribute('data-status', 'closed');
  },
};

export const UnknownAndInvalid: Story = {
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
    await expect(items[4]).toHaveTextContent(`0 of 10${percent(0)}`);
    await expect(items[5]).toHaveTextContent(`0 of 10${percent(0)}`);
    for (const index of [6, 7]) {
      await expect(items[index]).toHaveTextContent('5Goal unavailable');
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
    await expect(
      rings.map((ring) => ring.querySelector('[data-ui="activity-rings-tick"]') !== null),
    ).toEqual([false, false, false, false, true, true, false, false]);
    await expect(canvasElement.querySelector('[data-ui="activity-rings-summary"]')).toHaveTextContent(
      '0 of 8 goals met',
    );
  },
};

export const EmptyMetrics: Story = {
  args: { metrics: [] },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole('list')).toBeNull();
    await expect(canvasElement.querySelector('[data-ui="activity-rings-summary"]')).toHaveTextContent('No goals');
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
    await expect(doc.activeElement).toBe(toggles[0]);
    await expect(doc.defaultView!.getComputedStyle(toggles[0]!).outlineStyle).not.toBe('none');
    await expect(toggles[0]!.getBoundingClientRect().height).toBeGreaterThanOrEqual(31);
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
    await expect(doc.activeElement).toBe(canvas.getByRole('button', { name: 'After' }));
    await userEvent.tab({ shift: true });
    await userEvent.tab({ shift: true });
    await userEvent.tab({ shift: true });
    await userEvent.tab({ shift: true });
    await expect(doc.activeElement).toBe(radios[6]);
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
    for (const toggle of canvas.getAllByRole('button', { pressed: false })) await expect(toggle).toBeVisible();
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
    await set('5.94');
    await set('6.12');
    await expect(args.onRingClose).toHaveBeenCalledTimes(2);
    await set('unknown');
    await set('6.12');
    await expect(args.onRingClose).toHaveBeenCalledTimes(2);
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await expect(args.onFocusedMetricChange).not.toHaveBeenCalled();
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
const MID_SWEEP_MS = 60;
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
    await userEvent.click(canvas.getByRole('button', { name: 'Interrupt' }));
    await waitFor(() => expect(canvas.getByRole('listitem')).toHaveTextContent(percent(0.5)));
    await expectDrawn(ringParts(canvasElement)[0]!, 0.5);
    await expect(ringParts(canvasElement, 'lap')).toHaveLength(0);
    await expect(args.onRingClose).toHaveBeenCalledTimes(0);
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
      await expect(within(region).getAllByRole('radio')[0]).toHaveAccessibleName(fullDate('2026-10-05', locale));
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
      { id: 'distance', label: 'Zurückgelegte Strecke im Wochenvergleich', goal: 123456.7, unit: 'kilometer' },
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

export const Narrow: Story = {
  ...LongIntlUnits,
  args: { ...LongIntlUnits.args, days: week, values: undefined, interactiveLegend: true },
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
export const Wide: Story = {
  decorators: [
    (Story) => (
      <div style={{ inlineSize: '40rem', maxInlineSize: '100%' }}>
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
    const plain = (value: number) => new Intl.NumberFormat('en-GB', { maximumFractionDigits: 1 }).format(value);
    const items = within(canvasElement).getAllByRole('listitem');
    await expect(items[0]).toHaveTextContent(`${plain(320.25)} of ${plain(500)}${percent(0.6405)}`);
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
    <ActivityRings key="runtime" metrics={goals} interactiveLegend={flag} slotProps={{ metric: { onClick: onButtonClick } }} />,
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
    await expect(radios[0]!.getBoundingClientRect().left).toBeGreaterThan(radios[6]!.getBoundingClientRect().left);
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
          'Structural fixture with a second lap. Enable prefers-reduced-motion in browser QA to verify ring fills draw at their final length without a sweep and isolation dimming has no transition.',
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
          'Structural isolated fixture. Enable forced colors in browser QA to check CanvasText ring fills, alternating dashed tracks, the numbered legend and Highlight selection borders.',
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
