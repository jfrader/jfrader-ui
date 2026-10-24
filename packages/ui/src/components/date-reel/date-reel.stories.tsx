import { useRef, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { DateReel, type DateReelProps, type DateReelValue } from './index';
import { styled } from '../../styling/styled';
import { expectAligned, expectInside, expectNoOverlap } from '../../testing/geometry-assertions';

const Frame = styled.div({
  inlineSize: `min(420px, calc(100vw - ${vars.space[4]} * 2))`,
  maxInlineSize: '100%',
});

const meta = {
  title: 'Inputs/DateReel',
  component: DateReel,
  decorators: [
    (Story) => (
      <Frame>
        <Story />
      </Frame>
    ),
  ],
  parameters: {
    docs: {
      sections: [
        { title: 'Choose a date or time', stories: ['Default', 'DateMode', 'TimeMode'] },
        { title: 'Time entry', stories: ['TwelveHour', 'MinuteSteps'] },
        { title: 'Shortcuts and confirmation', stories: ['Presets', 'WithConfirm'] },
      ],
      description: {
        component:
          'Choose a date, time, or appointment with scrolling reels.',
      },
      usage: `### Values
- Return Gregorian civil string values: \`YYYY-MM-DDTHH:mm\` for datetime mode, \`YYYY-MM-DD\` for date mode, and \`HH:mm\` for time mode.
- Both \`min\` and \`max\` are required bounds in the same mode-specific wire format.
- Month and year edits clamp the day to the month's end before committing.

### Keyboard and accessibility

- Tab moves between the date and time reels.
- Press ArrowUp or ArrowDown to step to the previous or next selectable entry without wrapping.
- Press PageUp or PageDown for larger jumps: 10 years, 3 months, 7 days, 3 hours, or minute jumps (step = ceil(15 / minuteStep)).
- Press Home or End to jump to the first or last valid entry of the focused reel.
- Press ArrowLeft or ArrowRight to move focus between neighboring reels; the order follows the text direction.
- Type numbers or letters to search within the focused reel with a 500ms typeahead buffer. Modifier combinations and IME composition are guarded and ignored.

### Values and constraints

- Invalid configuration or values outside \`[min, max]\` display an accessible alert and disable interactions.
- Touch gestures use inertial momentum and spring-settle to valid candidates only after release. Drag cancellation resets position.
- Scroll the wheel over a focused reel to change its value instead of scrolling the page.
- Intro motion runs once on mount while the document is visible, unless paused or reduced motion is enabled.`,
    },
  },
  args: {
    mode: 'datetime',
    defaultValue: '2026-10-17T15:30',
    min: '2026-01-01T00:00',
    max: '2026-12-31T23:55',
    minuteStep: 5,
    locale: 'en-US',
    onValueChange: fn(),
  },
} satisfies Meta<typeof DateReel>;

export default meta;
type Story = StoryObj<typeof meta>;

async function expectCenteredRow(reel: HTMLElement, label: string) {
  await waitFor(() => {
    const selected = reel.querySelector<HTMLElement>('[data-selected="true"]')!;
    expect(selected).toHaveTextContent(label);
    const matrix = new DOMMatrix(getComputedStyle(selected).transform);
    expect(matrix.m42).toBeCloseTo(0, 2);
    expect(matrix.m43).toBeCloseTo(0, 2);
    expect(matrix.m22).toBeCloseTo(1, 3);
  }, { timeout: 3000 });
  await expectInside(reel.querySelector('[data-selected="true"]')!, reel);
}

export const ClickRowRegression: Story = {
  tags: ['!autodocs'],
  args: {
    mode: 'time', hourCycle: 'h23', defaultValue: '12:00',
    min: '08:00', max: '18:00', intro: false, onValueChange: fn(),
  },
  play: async ({ canvas, args, userEvent }) => {
    const reel = canvas.getByRole('spinbutton', { name: 'Hour' });
    const target = within(reel).getByText('14');
    await userEvent.click(target);
    await expect(reel).toHaveAttribute('aria-valuenow', '14');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith('14:00');
    await expectCenteredRow(reel, '14');
    await userEvent.click(target);
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expectCenteredRow(reel, '14');
  },
};

export const ClickInterruptsWheel: Story = {
  ...ClickRowRegression,
  play: async ({ canvas, args, userEvent }) => {
    const reel = canvas.getByRole('spinbutton', { name: 'Hour' });
    reel.focus();
    reel.dispatchEvent(new WheelEvent('wheel', {
      bubbles: true, cancelable: true, deltaY: 50,
    }));
    await waitFor(() => expect(reel).toHaveAttribute('aria-valuenow', '13'));
    await userEvent.click(within(reel).getByText('15'));
    await expect(args.onValueChange).toHaveBeenCalledTimes(2);
    await expect(args.onValueChange).toHaveBeenLastCalledWith('15:00');
    await expectCenteredRow(reel, '15');
  },
};

export const ClickDisabledRow: Story = {
  ...ClickRowRegression,
  args: { ...ClickRowRegression.args, defaultValue: '08:00' },
  play: async ({ canvas, args, userEvent }) => {
    const reel = canvas.getByRole('spinbutton', { name: 'Hour' });
    const target = within(reel).getByText('07');
    await expect(target).toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(target);
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await expectCenteredRow(reel, '08');
  },
};

export const ClickReducedMotion: Story = {
  ...ClickRowRegression,
  beforeEach: () => {
    const descriptor = Object.getOwnPropertyDescriptor(MediaQueryList.prototype, 'matches')!;
    Object.defineProperty(MediaQueryList.prototype, 'matches', {
      ...descriptor,
      get() {
        return this.media === '(prefers-reduced-motion: reduce)'
          ? true : descriptor.get!.call(this);
      },
    });
    return () => Object.defineProperty(MediaQueryList.prototype, 'matches', descriptor);
  },
  play: async ({ canvas, args, userEvent }) => {
    const reel = canvas.getByRole('spinbutton', { name: 'Hour' });
    await expect(matchMedia('(prefers-reduced-motion: reduce)').matches).toBe(true);
    await userEvent.click(within(reel).getByText('14'));
    await expect(reel).toHaveAttribute('aria-valuenow', '14');
    const selected = reel.querySelector<HTMLElement>('[data-selected="true"]')!;
    await expect(new DOMMatrix(getComputedStyle(selected).transform).isIdentity).toBe(true);
    await expect(selected.style.transform).not.toContain('rotateX');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expectCenteredRow(reel, '14');
  },
};

export const KeyboardRowAlignment: Story = {
  ...ClickRowRegression,
  play: async ({ canvas, canvasElement, args, userEvent }) => {
    const reel = canvas.getByRole('spinbutton', { name: 'Hour' });
    reel.focus();
    for (const [key, value] of [
      ['{ArrowDown}', '13'], ['{ArrowUp}', '12'], ['{PageDown}', '15'],
      ['{PageUp}', '12'], ['{Home}', '08'], ['{End}', '18'],
    ]) {
      await userEvent.keyboard(key!);
      await expectCenteredRow(reel, value!);
      await expect(canvasElement.ownerDocument.activeElement).toBe(reel);
    }
    await expect(args.onValueChange).toHaveBeenCalledTimes(6);
    await expect(getComputedStyle(reel).outlineStyle).not.toBe('none');
  },
};

export const Default: Story = {
  name: 'Schedule an appointment',
  parameters: { docs: {
    description: { story: 'Choose an appointment date and time in five-minute steps.' },
    source: { language: 'tsx', code: `import { DateReel } from '@jfrader/ui';

<DateReel title="Schedule Appointment" mode="datetime" locale="en-US"
  defaultValue="2026-10-17T15:30" min="2026-01-01T00:00" max="2026-12-31T23:55"
  minuteStep={5} />` },
  } },
  args: {
    mode: 'datetime',
    defaultValue: '2026-10-17T15:30',
    min: '2026-01-01T00:00',
    max: '2026-12-31T23:55',
    title: 'Schedule Appointment',
  },
  play: async ({ canvas, canvasElement }) => {
    const card = canvasElement.querySelector('[data-ui="date-reel"]')!;
    await expect(card.getBoundingClientRect().width).toBeGreaterThanOrEqual(360);
    const columns = canvas.getAllByRole('spinbutton');
    await expectAligned(columns, 'top');
    await expectAligned(columns, 'bottom');
    for (let index = 1; index < columns.length; index += 1) {
      await expectNoOverlap(columns[index - 1]!, columns[index]!);
      await expect(columns[index]!.getBoundingClientRect().width).toBeCloseTo(
        columns[0]!.getBoundingClientRect().width, 1,
      );
    }
    const selected = canvasElement.querySelectorAll('[data-selected="true"]');
    for (const row of selected) {
      await expectInside(row, row.closest('[role="spinbutton"]')!);
      await expect(row.scrollWidth).toBeLessThanOrEqual(row.clientWidth);
    }
  },
};

export const InvalidLocale: Story = {
  args: { locale: 'not_a_locale' },
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    const expected = new Intl.DateTimeFormat(undefined, {
      dateStyle: 'full',
      timeStyle: 'short',
      calendar: 'gregory',
      timeZone: 'UTC',
    }).format(new Date('2026-10-17T15:30:00Z'));
    await expect(
      canvasElement.querySelector('[data-ui="date-reel-summary"]'),
    ).toHaveTextContent(expected);
    const day = canvas.getByRole('spinbutton', { name: 'Day' });
    day.focus();
    await userEvent.keyboard('{ArrowDown}');
    await expect(args.onValueChange).toHaveBeenLastCalledWith('2026-10-18T15:30');
    await expect(canvas.queryByRole('alert')).not.toBeInTheDocument();
  },
};

export const DateMode: Story = {
  name: 'Date of birth',
  parameters: { docs: {
    description: { story: 'Choose a date without a time, using British date formatting.' },
    source: { language: 'tsx', code: `import { DateReel } from '@jfrader/ui';

<DateReel title="Date of Birth" mode="date" locale="en-GB"
  defaultValue="1996-02-29" min="1900-01-01" max="2026-12-31" minuteStep={5} />` },
  } },
  args: {
    mode: 'date',
    defaultValue: '1996-02-29',
    min: '1900-01-01',
    max: '2026-12-31',
    locale: 'en-GB',
    title: 'Date of Birth',
  },
};

export const TimeMode: Story = {
  name: 'Meeting time',
  parameters: { docs: {
    description: { story: 'Choose a meeting time within working hours.' },
    source: { language: 'tsx', code: `import { DateReel } from '@jfrader/ui';

<DateReel title="Meeting Time" mode="time" locale="en-US"
  defaultValue="14:30" min="08:00" max="18:00" minuteStep={5} />` },
  } },
  args: {
    mode: 'time',
    defaultValue: '14:30',
    min: '08:00',
    max: '18:00',
    minuteStep: 5,
    title: 'Meeting Time',
  },
};

export const TwelveHour: Story = {
  name: 'Twelve-hour clock',
  parameters: { docs: {
    description: { story: 'Choose a time with a separate AM or PM reel.' },
    source: { language: 'tsx', code: `import { DateReel } from '@jfrader/ui';

<DateReel title="12-Hour Clock" mode="time" locale="en-US" hourCycle="h12"
  defaultValue="09:15" min="00:00" max="23:45" minuteStep={15} />` },
  } },
  args: {
    mode: 'time',
    hourCycle: 'h12',
    defaultValue: '09:15',
    min: '00:00',
    max: '23:45',
    minuteStep: 15,
    title: '12-Hour Clock',
  },
};

export const MinuteSteps: Story = {
  name: 'Quarter-hour steps',
  parameters: { docs: {
    description: { story: 'Limit the minute reel to quarter-hour appointment slots.' },
    source: { language: 'tsx', code: `import { DateReel } from '@jfrader/ui';

<DateReel title="Quarter-Hour Steps" mode="time" locale="en-US"
  defaultValue="12:00" min="09:00" max="17:00" minuteStep={15} />` },
  } },
  args: {
    mode: 'time',
    defaultValue: '12:00',
    min: '09:00',
    max: '17:00',
    minuteStep: 15,
    title: 'Quarter-Hour Steps',
  },
};

export const Presets: Story = {
  name: 'Suggested slots',
  parameters: { docs: {
    description: { story: 'Pick a morning, noon, or evening shortcut, then adjust the reels.' },
    source: { language: 'tsx', code: `import { DateReel } from '@jfrader/ui';

<DateReel title="Select Slot" mode="datetime" locale="en-US" minuteStep={5}
  defaultValue="2026-10-17T09:00" min="2026-10-01T00:00" max="2026-10-31T23:55"
  presets={[
    { id: 'morning', label: 'Morning (9:00)', value: '2026-10-17T09:00' },
    { id: 'noon', label: 'Noon (12:00)', value: '2026-10-17T12:00' },
    { id: 'evening', label: 'Evening (18:00)', value: '2026-10-17T18:00' },
  ]} />` },
  } },
  args: {
    mode: 'datetime',
    defaultValue: '2026-10-17T09:00',
    min: '2026-10-01T00:00',
    max: '2026-10-31T23:55',
    title: 'Select Slot',
    presets: [
      { id: 'morning', label: 'Morning (9:00)', value: '2026-10-17T09:00' },
      { id: 'noon', label: 'Noon (12:00)', value: '2026-10-17T12:00' },
      { id: 'evening', label: 'Evening (18:00)', value: '2026-10-17T18:00' },
    ],
  },
};

export const WithConfirm: Story = {
  name: 'Confirm a booking',
  parameters: { docs: {
    description: { story: 'Choose a time and confirm it with a separate booking action.' },
    source: { language: 'tsx', code: `import { DateReel, type DateReelProps } from '@jfrader/ui';

export function BookingTime({ book }: { book: DateReelProps['onConfirm'] }) {
  return <DateReel title="Confirm Booking" mode="time" locale="en-US" minuteStep={5}
    defaultValue="10:00" min="08:00" max="18:00" onConfirm={book} />;
}` },
  } },
  args: {
    mode: 'time',
    defaultValue: '10:00',
    min: '08:00',
    max: '18:00',
    title: 'Confirm Booking',
    onConfirm: fn(
      () => new Promise<void>((resolve) => setTimeout(resolve, 300)),
    ),
  },
};

export const LightTheme: Story = {
  globals: { theme: 'light' },
  args: {
    mode: 'datetime',
    defaultValue: '2026-10-17T15:30',
    min: '2026-01-01T00:00',
    max: '2026-12-31T23:55',
    title: 'Light Theme',
  },
};

export const ArabicLocale: Story = {
  args: {
    mode: 'date',
    defaultValue: '2026-10-17',
    min: '2020-01-01',
    max: '2030-12-31',
    locale: 'ar',
    title: 'التاريخ',
  },
};

export const RightToLeft: Story = {
  parameters: { direction: 'rtl' },
  render: (args) => (
    <div dir="rtl">
      <DateReel {...args} />
    </div>
  ),
  args: {
    mode: 'date',
    defaultValue: '2026-10-17',
    min: '2020-01-01',
    max: '2030-12-31',
    locale: 'ar',
    title: 'من اليمين إلى اليسار',
  },
};

export const KeyboardAllReels: Story = {
  tags: ['!autodocs'],
  args: {
    mode: 'datetime',
    defaultValue: '2026-10-17T12:00',
    min: '2020-01-01T00:00',
    max: '2030-12-31T23:55',
    minuteStep: 5,
    onValueChange: fn(),
    presets: [{ id: 'noon', label: 'Noon', value: '2026-10-17T12:00' }],
    onConfirm: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const reels = canvas.getAllByRole('spinbutton');
    expect(reels.length).toBeGreaterThan(0);

    const firstReel = reels[0];
    firstReel?.focus();
    expect(canvasElement.ownerDocument.activeElement).toBe(firstReel);

    await userEvent.keyboard('{ArrowDown}');
    expect(args.onValueChange).toHaveBeenCalled();

    if (reels.length > 1) {
      await userEvent.keyboard('{ArrowRight}');
      expect(canvasElement.ownerDocument.activeElement).toBe(reels[1]);
    }

    await userEvent.tab();
  },
};

export const ControlledRejects: Story = {
  tags: ['!autodocs'],
  render: function ControlledRejectsComponent(props) {
    return (
      <DateReel
        {...props}
        mode="date"
        value="2026-10-17"
        min="2020-01-01"
        max="2030-12-31"
      />
    );
  },
  args: {
    onValueChange: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const reels = canvas.getAllByRole('spinbutton');
    const dayReel =
      reels.find((r) => r.getAttribute('data-part') === 'day') ?? reels[0];
    dayReel?.focus();
    await userEvent.keyboard('{ArrowDown}');
    expect(args.onValueChange).toHaveBeenCalled();
    expect(dayReel).toHaveAttribute('aria-valuenow', '17');
  },
};

export const LeapYearClamp: Story = {
  tags: ['!autodocs'],
  args: {
    mode: 'date',
    defaultValue: '2024-02-29',
    min: '2020-01-01',
    max: '2028-12-31',
    onValueChange: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const yearReel = canvas
      .getAllByRole('spinbutton')
      .find((r) => r.getAttribute('data-part') === 'year');
    expect(yearReel).toBeDefined();
    yearReel!.focus();
    await userEvent.keyboard('{ArrowDown}');
    expect(args.onValueChange).toHaveBeenLastCalledWith('2025-02-28');
  },
};

export const MonthEndClamp: Story = {
  tags: ['!autodocs'],
  args: {
    mode: 'date',
    defaultValue: '2026-01-31',
    min: '2026-01-01',
    max: '2026-12-31',
    onValueChange: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const monthReel = canvas
      .getAllByRole('spinbutton')
      .find((r) => r.getAttribute('data-part') === 'month');
    expect(monthReel).toBeDefined();
    monthReel!.focus();
    await userEvent.keyboard('{ArrowDown}');
    expect(args.onValueChange).toHaveBeenLastCalledWith('2026-02-28');
  },
};

export const MinMaxBoundary: Story = {
  tags: ['!autodocs'],
  args: {
    mode: 'date',
    defaultValue: '2026-10-15',
    min: '2026-10-15',
    max: '2026-10-20',
    onValueChange: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const dayReel = canvas
      .getAllByRole('spinbutton')
      .find((r) => r.getAttribute('data-part') === 'day');
    expect(dayReel).toBeDefined();
    dayReel!.focus();
    await userEvent.keyboard('{ArrowUp}');
    expect(args.onValueChange).not.toHaveBeenCalled();

    await userEvent.keyboard('{End}');
    expect(args.onValueChange).toHaveBeenLastCalledWith('2026-10-20');
  },
};

export const InvalidConfig: Story = {
  tags: ['!autodocs'],
  args: {
    mode: 'time',
    defaultValue: '25:99',
    min: '08:00',
    max: '18:00',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const alert = canvas.getByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(canvas.getByRole('group')).toHaveAttribute('aria-invalid', 'true');
    const reels = canvas.getAllByRole('spinbutton');
    for (const reel of reels) {
      expect(reel).toHaveAttribute('aria-disabled', 'true');
    }
  },
};

export const Disabled: Story = {
  tags: ['!autodocs'],
  args: {
    mode: 'date',
    defaultValue: '2026-10-17',
    min: '2020-01-01',
    max: '2030-12-31',
    disabled: true,
    onValueChange: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const reels = canvas.getAllByRole('spinbutton');
    for (const reel of reels) {
      expect(reel).toHaveAttribute('aria-disabled', 'true');
    }
    reels[0]?.focus();
    await userEvent.keyboard('{ArrowDown}');
    expect(args.onValueChange).not.toHaveBeenCalled();
  },
};

export const ConfirmPending: Story = {
  tags: ['!autodocs'],
  render: function ConfirmPendingStory(props) {
    return (
      <DateReel
        {...props}
        mode="time"
        defaultValue="10:00"
        min="08:00"
        max="18:00"
        onConfirm={() => new Promise(() => {})}
      />
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const confirmButton = canvas.getByRole('button', { name: /confirm/i });
    await userEvent.click(confirmButton);
    expect(confirmButton).toHaveAttribute('aria-busy', 'true');
    expect(confirmButton).toHaveAttribute('aria-disabled', 'true');
  },
};

export const ConfirmError: Story = {
  tags: ['!autodocs'],
  render: function ConfirmErrorStory(props) {
    return (
      <DateReel
        {...props}
        mode="time"
        defaultValue="10:00"
        min="08:00"
        max="18:00"
        onConfirm={() => Promise.reject(new Error('Network submission failed'))}
      />
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const confirmButton = canvas.getByRole('button', { name: /confirm/i });
    await userEvent.click(confirmButton);
    await waitFor(() => {
      expect(canvas.getByRole('alert')).toHaveTextContent(
        'Network submission failed',
      );
    });
  },
};

export const TitleFalsy: Story = {
  tags: ['!autodocs'],
  render: function TitleFalsyStory() {
    return (
      <div style={{ display: 'grid', gap: '16px' }}>
        <DateReel
          mode="date"
          defaultValue="2026-10-17"
          min="2020-01-01"
          max="2030-12-31"
          title={0}
          data-testid="reel-zero"
        />
        <DateReel
          mode="date"
          defaultValue="2026-10-17"
          min="2020-01-01"
          max="2030-12-31"
          title={false}
          data-testid="reel-false"
        />
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const zeroReel = canvasElement.querySelector('[data-testid="reel-zero"]');
    const falseReel = canvasElement.querySelector('[data-testid="reel-false"]');
    expect(
      zeroReel?.querySelector('[data-ui="date-reel-title"]'),
    ).toHaveTextContent('0');
    expect(falseReel?.querySelector('[data-ui="date-reel-title"]')).toBeNull();
  },
};

export const MidnightBoundaryRegression: Story = {
  tags: ['!autodocs'],
  args: {
    mode: 'time',
    hourCycle: 'h23',
    defaultValue: '00:00',
    min: '00:00',
    max: '00:00',
    minuteStep: 5,
    onValueChange: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const hourReel = canvas
      .getAllByRole('spinbutton')
      .find((r) => r.getAttribute('data-part') === 'hour');
    const minuteReel = canvas
      .getAllByRole('spinbutton')
      .find((r) => r.getAttribute('data-part') === 'minute');
    expect(hourReel).toBeDefined();
    expect(minuteReel).toBeDefined();

    expect(hourReel).toHaveAttribute('aria-valuenow', '0');
    expect(hourReel).toHaveAttribute('aria-valuemin', '0');
    expect(hourReel).toHaveAttribute('aria-valuemax', '0');

    expect(minuteReel).toHaveAttribute('aria-valuenow', '0');
    expect(minuteReel).toHaveAttribute('aria-valuemin', '0');
    expect(minuteReel).toHaveAttribute('aria-valuemax', '0');

    hourReel!.focus();
    await userEvent.keyboard('{ArrowDown}');
    await userEvent.keyboard('{ArrowUp}');
    expect(args.onValueChange).not.toHaveBeenCalled();
  },
};

export const PointerCancelRegression: Story = {
  tags: ['!autodocs'],
  args: {
    mode: 'time',
    hourCycle: 'h23',
    defaultValue: '12:00',
    min: '08:00',
    max: '18:00',
    minuteStep: 5,
    onValueChange: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const hourReel = canvas
      .getAllByRole('spinbutton')
      .find((r) => r.getAttribute('data-part') === 'hour');
    expect(hourReel).toBeDefined();

    hourReel!.dispatchEvent(
      new PointerEvent('pointerdown', {
        bubbles: true,
        clientY: 100,
        pointerId: 1,
      }),
    );
    hourReel!.dispatchEvent(
      new PointerEvent('pointermove', {
        bubbles: true,
        clientY: 20,
        pointerId: 1,
      }),
    );
    hourReel!.dispatchEvent(
      new PointerEvent('pointercancel', { bubbles: true, pointerId: 1 }),
    );

    expect(args.onValueChange).not.toHaveBeenCalled();
    expect(hourReel).toHaveAttribute('aria-valuenow', '12');

    hourReel!.dispatchEvent(
      new PointerEvent('pointerdown', {
        bubbles: true,
        clientY: 100,
        pointerId: 2,
      }),
    );
    hourReel!.dispatchEvent(
      new PointerEvent('pointermove', {
        bubbles: true,
        clientY: 20,
        pointerId: 2,
      }),
    );
    hourReel!.dispatchEvent(
      new PointerEvent('lostpointercapture', { bubbles: true }),
    );

    expect(args.onValueChange).not.toHaveBeenCalled();
    expect(hourReel).toHaveAttribute('aria-valuenow', '12');
  },
};

export const ExternalValueCancelsDrag: Story = {
  tags: ['!autodocs'],
  render: function ExternalValueComponent() {
    const [val, setVal] = useState('12:00');
    return (
      <div>
        <button onClick={() => setVal('14:00')}>Change Value</button>
        <DateReel
          mode="time"
          hourCycle="h23"
          value={val}
          min="08:00"
          max="18:00"
          minuteStep={5}
        />
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const hourReel = canvas
      .getAllByRole('spinbutton')
      .find((r) => r.getAttribute('data-part') === 'hour');
    expect(hourReel).toHaveAttribute('aria-valuenow', '12');

    hourReel!.dispatchEvent(
      new PointerEvent('pointerdown', {
        bubbles: true,
        clientY: 100,
        pointerId: 1,
      }),
    );
    hourReel!.dispatchEvent(
      new PointerEvent('pointermove', {
        bubbles: true,
        clientY: 20,
        pointerId: 1,
      }),
    );

    const button = canvas.getByRole('button', { name: 'Change Value' });
    await userEvent.click(button);

    expect(hourReel).toHaveAttribute('aria-valuenow', '14');

    hourReel!.dispatchEvent(
      new PointerEvent('pointerup', {
        bubbles: true,
        clientY: 20,
        pointerId: 1,
      }),
    );
    expect(hourReel).toHaveAttribute('aria-valuenow', '14');
  },
};

export const SlotNativeHandlersRegression: Story = {
  tags: ['!autodocs'],
  render: function SlotNativeHandlersStory() {
    const onKeyDownSpy = fn((e: React.KeyboardEvent) => {
      e.preventDefault();
    });
    const onPresetClickSpy = fn((e: React.MouseEvent) => {
      e.preventDefault();
    });
    const onConfirmClickSpy = fn((e: React.MouseEvent) => {
      e.preventDefault();
    });
    const onValueChangeSpy = fn();
    const onConfirmSpy = fn();

    return (
      <DateReel
        mode="time"
        defaultValue="12:00"
        min="08:00"
        max="18:00"
        minuteStep={5}
        presets={[{ id: 'morning', label: 'Morning', value: '09:00' }]}
        onValueChange={onValueChangeSpy}
        onConfirm={onConfirmSpy}
        slotProps={{
          reel: {
            onKeyDown: onKeyDownSpy,
          },
          preset: {
            onClick: onPresetClickSpy,
          },
          confirm: {
            onClick: onConfirmClickSpy,
          },
        }}
        data-testid="handlers-reel"
      />
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const hourReel = canvas
      .getAllByRole('spinbutton')
      .find((r) => r.getAttribute('data-part') === 'hour');
    expect(hourReel).toBeDefined();

    hourReel!.focus();
    await userEvent.keyboard('{ArrowDown}');

    const presetBtn = canvas.getByRole('button', { name: 'Morning' });
    await userEvent.click(presetBtn);

    const confirmBtn = canvas.getByRole('button', { name: 'Confirm' });
    await userEvent.click(confirmBtn);

    expect(hourReel).toHaveAttribute('aria-valuenow', '12');
  },
};

export const PresetValidationRegression: Story = {
  tags: ['!autodocs'],
  render: function PresetValidationStory() {
    const onValueChangeSpy = fn();
    return (
      <DateReel
        mode="time"
        defaultValue="12:00"
        min="08:00"
        max="18:00"
        minuteStep={5}
        onValueChange={onValueChangeSpy}
        presets={[
          { id: 'valid', label: 'Valid Slot', value: '10:00' },
          { id: 'out-of-range', label: 'Out of range', value: '20:00' },
          { id: 'bad-step', label: 'Bad step', value: '10:03' },
        ]}
      />
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const validBtn = canvas.getByRole('button', { name: 'Valid Slot' });
    const outOfRangeBtn = canvas.getByRole('button', { name: 'Out of range' });
    const badStepBtn = canvas.getByRole('button', { name: 'Bad step' });

    expect(validBtn).not.toHaveAttribute('aria-disabled', 'true');
    expect(outOfRangeBtn).toHaveAttribute('aria-disabled', 'true');
    expect(badStepBtn).toHaveAttribute('aria-disabled', 'true');

    await userEvent.click(outOfRangeBtn);
    await userEvent.click(badStepBtn);

    const hourReel = canvas
      .getAllByRole('spinbutton')
      .find((r) => r.getAttribute('data-part') === 'hour');
    expect(hourReel).toHaveAttribute('aria-valuenow', '12');

    await userEvent.click(validBtn);
    expect(hourReel).toHaveAttribute('aria-valuenow', '10');
  },
};

export const ConfirmationGuardRegression: Story = {
  tags: ['!autodocs'],
  render: function ConfirmationGuardStory() {
    const [resolveFn, setResolveFn] = useState<(() => void) | null>(null);
    const onConfirmSpy = fn(
      () =>
        new Promise<void>((resolve) => {
          setResolveFn(() => resolve);
        }),
    );

    return (
      <div>
        {resolveFn && (
          <button data-testid="resolve-btn" onClick={() => resolveFn()}>
            Resolve Inflight
          </button>
        )}
        <DateReel
          mode="time"
          defaultValue="12:00"
          min="08:00"
          max="18:00"
          minuteStep={5}
          onConfirm={onConfirmSpy}
          presets={[{ id: 'ten', label: '10:00', value: '10:00' }]}
        />
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const confirmBtn = canvas.getByRole('button', { name: 'Confirm' });

    confirmBtn.click();
    confirmBtn.click();
    confirmBtn.click();

    const presetBtn = canvas.getByRole('button', { name: '10:00' });
    await userEvent.click(presetBtn);

    const resolveBtn = canvasElement.querySelector(
      '[data-testid="resolve-btn"]',
    ) as HTMLButtonElement | null;
    resolveBtn?.click();

    const status = canvas.getByRole('status');
    expect(status).toHaveTextContent('');
  },
};

export const WheelInteractionRegression: Story = {
  tags: ['!autodocs'],
  args: {
    mode: 'time',
    hourCycle: 'h23',
    defaultValue: '12:00',
    min: '08:00',
    max: '18:00',
    minuteStep: 5,
    onValueChange: fn(),
    slotProps: {
      reel: {
        onWheel: fn(),
      },
    },
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const hourReel = canvas
      .getAllByRole('spinbutton')
      .find((r) => r.getAttribute('data-part') === 'hour');
    expect(hourReel).toBeDefined();

    const unfocusedEvent = new WheelEvent('wheel', {
      bubbles: true,
      cancelable: true,
      deltaY: 50,
    });
    hourReel!.dispatchEvent(unfocusedEvent);
    expect(unfocusedEvent.defaultPrevented).toBe(false);

    hourReel!.focus();
    expect(canvasElement.ownerDocument.activeElement).toBe(hourReel);

    const focusedEvent = new WheelEvent('wheel', {
      bubbles: true,
      cancelable: true,
      deltaY: 50,
    });
    hourReel!.dispatchEvent(focusedEvent);
    expect(focusedEvent.defaultPrevented).toBe(true);

    await waitFor(() => {
      expect(hourReel).toHaveAttribute('aria-valuenow', '13');
    });
    expect(args.onValueChange).toHaveBeenCalledWith('13:00');
    expect(args.slotProps?.reel?.onWheel).toHaveBeenCalled();
  },
};

export const PreventedWheel: Story = {
  tags: ['!autodocs'],
  args: {
    mode: 'time',
    hourCycle: 'h23',
    defaultValue: '12:00',
    min: '08:00',
    max: '18:00',
    onValueChange: fn(),
    slotProps: { reel: { onWheel: (event) => event.preventDefault() } },
  },
  play: async ({ canvas, args }) => {
    const reel = canvas.getByRole('spinbutton', { name: 'Hour' });
    reel.focus();
    reel.dispatchEvent(
      new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: 60 }),
    );
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await expect(reel).toHaveAttribute('aria-valuenow', '12');
  },
};

export const EarlyGregorianYear: Story = {
  tags: ['!autodocs'],
  args: {
    mode: 'date',
    defaultValue: '0001-01-01',
    min: '0001-01-01',
    max: '0099-12-31',
    locale: 'en-GB',
  },
  play: async ({ canvasElement }) => {
    const expected = new Intl.DateTimeFormat('en-GB', {
      dateStyle: 'full',
      calendar: 'gregory',
      timeZone: 'UTC',
    }).format(new Date('0001-01-01T00:00:00Z'));
    await expect(
      canvasElement.querySelector('[data-ui="date-reel-summary"]'),
    ).toHaveTextContent(expected);
  },
};

export const ConfirmRetryClearsError: Story = {
  tags: ['!autodocs'],
  render: function RetryFixture(args) {
    const attempts = useRef(0);
    return <DateReel {...args} onConfirm={() => { if (attempts.current++ === 0) throw new Error('Try again'); }} />;
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Confirm' }));
    await expect(canvas.getByRole('alert')).toHaveTextContent('Try again');
    await userEvent.click(canvas.getByRole('button', { name: 'Confirm' }));
    await expect(canvas.queryByRole('alert')).not.toBeInTheDocument();
    await expect(canvas.getByRole('status')).toHaveTextContent('Confirmed');
  },
};

export const PageStepMinuteRegression: Story = {
  tags: ['!autodocs'],
  args: {
    mode: 'time',
    defaultValue: '12:00',
    min: '08:00',
    max: '18:00',
    minuteStep: 15,
    onValueChange: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const minuteReel = canvas
      .getAllByRole('spinbutton')
      .find((r) => r.getAttribute('data-part') === 'minute');
    expect(minuteReel).toBeDefined();

    minuteReel!.focus();
    await userEvent.keyboard('{PageDown}');
    expect(args.onValueChange).toHaveBeenLastCalledWith('12:15');

    await userEvent.keyboard('{PageUp}');
    expect(args.onValueChange).toHaveBeenLastCalledWith('12:00');
  },
};

export const KeyboardModifiersGuardRegression: Story = {
  tags: ['!autodocs'],
  args: {
    mode: 'time',
    hourCycle: 'h23',
    defaultValue: '12:00',
    min: '08:00',
    max: '18:00',
    minuteStep: 5,
    onValueChange: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const hourReel = canvas
      .getAllByRole('spinbutton')
      .find((r) => r.getAttribute('data-part') === 'hour');
    expect(hourReel).toBeDefined();

    hourReel!.focus();
    hourReel!.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'ArrowDown',
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      }),
    );
    expect(args.onValueChange).not.toHaveBeenCalled();

    hourReel!.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'ArrowDown',
        altKey: true,
        bubbles: true,
        cancelable: true,
      }),
    );
    expect(args.onValueChange).not.toHaveBeenCalled();

    hourReel!.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'ArrowDown',
        metaKey: true,
        bubbles: true,
        cancelable: true,
      }),
    );
    expect(args.onValueChange).not.toHaveBeenCalled();

    hourReel!.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'ArrowDown',
        isComposing: true,
        bubbles: true,
        cancelable: true,
      }),
    );
    expect(args.onValueChange).not.toHaveBeenCalled();

    await userEvent.keyboard('{ArrowDown}');
    expect(args.onValueChange).toHaveBeenCalledTimes(1);
    expect(hourReel).toHaveAttribute('aria-valuenow', '13');
  },
};

export const MaxRenderedRowsRegression: Story = {
  tags: ['!autodocs'],
  args: {
    mode: 'time',
    defaultValue: '12:00',
    min: '00:00',
    max: '23:59',
    minuteStep: 1,
  },
  play: async ({ canvasElement }) => {
    const reels = canvasElement.querySelectorAll('[data-ui="date-reel-reel"]');
    for (const reel of reels) {
      const rows = reel.querySelectorAll('[data-selected]');
      expect(rows.length).toBeLessThanOrEqual(11);
      expect(rows.length).toBeGreaterThan(0);
    }
  },
};
