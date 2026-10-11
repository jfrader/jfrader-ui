import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { withLightTheme } from '../../testing/story-decorators';
import { Calendar, type CalendarProps } from './index';

const LOCALE = 'en-US';
// Rejected by the controlled parent in the Controlled story.
const REJECTED_DATE = '2026-10-17';

const meta = {
  title: 'Pickers/Calendar',
  component: Calendar,
  args: { locale: LOCALE },
} satisfies Meta<typeof Calendar>;

export default meta;

type Story = StoryObj<typeof meta>;

function CalendarExample(props: CalendarProps) {
  return (
    <Calendar {...props}>
      <Calendar.Header />
      <Calendar.Grid />
    </Calendar>
  );
}
CalendarExample.displayName = 'CalendarExample';

function ControlledCalendar({ onValueChange, onVisibleMonthChange, ...props }: CalendarProps) {
  const [value, setValue] = useState('2026-10-14');
  const [visibleMonth, setVisibleMonth] = useState('2026-10');
  return (
    <CalendarExample
      {...props}
      value={value}
      visibleMonth={visibleMonth}
      onValueChange={(next) => {
        onValueChange?.(next);
        if (next !== REJECTED_DATE) setValue(next);
      }}
      onVisibleMonthChange={(next) => {
        onVisibleMonthChange?.(next);
        setVisibleMonth(next);
      }}
    />
  );
}
ControlledCalendar.displayName = 'ControlledCalendar';

const day = (canvasElement: HTMLElement, name: string) => within(canvasElement).getByRole('button', { name });

async function expectMonth(canvasElement: HTMLElement, name: string) {
  await expect(within(canvasElement).getByRole('grid', { name })).toBeInTheDocument();
}

/** Exactly one gridcell is selected and it holds the named day. */
async function expectSelected(canvasElement: HTMLElement, name: string) {
  const selected = within(canvasElement)
    .getAllByRole('gridcell')
    .filter((cell) => cell.getAttribute('aria-selected') === 'true');
  await expect(selected).toHaveLength(1);
  await expect(selected[0]).toContainElement(day(canvasElement, name));
}

export const Default: Story = {
  args: { defaultValue: '2026-10-12' },
  render: (args) => <CalendarExample {...args} />,
  parameters: {
    docs: {
      source: {
        code: `<Calendar locale="en-US" defaultValue="2026-10-12">
  <Calendar.Header />
  <Calendar.Grid />
</Calendar>`,
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expectMonth(canvasElement, 'October 2026');
    await expect(canvasElement.querySelector('[data-ui="calendar-label"]')).toHaveAttribute('aria-live', 'polite');
    await expect(canvas.getAllByRole('columnheader')[0]).toHaveAttribute('abbr', 'Sunday');
    await expectSelected(canvasElement, 'October 12, 2026');

    await userEvent.click(day(canvasElement, 'October 30, 2026'));
    await expect(day(canvasElement, 'October 30, 2026')).toHaveFocus();
    await expectSelected(canvasElement, 'October 30, 2026');

    // ArrowDown crosses into November: the header label and grid name follow.
    await userEvent.keyboard('{ArrowDown}');
    await expectMonth(canvasElement, 'November 2026');
    await expect(canvas.getByText('November 2026')).toHaveAttribute('data-ui', 'calendar-label');
    await expect(day(canvasElement, 'November 6, 2026')).toHaveFocus();
    await expect(canvasElement.querySelector('[aria-selected="true"]')).toBeNull();
    await userEvent.keyboard('{Enter}');
    await expectSelected(canvasElement, 'November 6, 2026');

    await userEvent.keyboard('{ArrowUp}');
    await expectMonth(canvasElement, 'October 2026');
    await expect(day(canvasElement, 'October 30, 2026')).toHaveFocus();
    await userEvent.keyboard('[Space]');
    await expectSelected(canvasElement, 'October 30, 2026');
  },
};

export const Today: Story = {
  render: (args) => <CalendarExample {...args} />,
  play: async ({ canvasElement }) => {
    const today = canvasElement.querySelectorAll<HTMLButtonElement>('[data-today]');
    await expect(today).toHaveLength(1);
    await expect(today[0]).toHaveAttribute('aria-current', 'date');
    await expect(canvasElement.querySelectorAll('[aria-current]')).toHaveLength(1);
    // With nothing selected, today is the grid's tab stop.
    await expect(today[0]!.tabIndex).toBe(0);
  },
};

export const MinMax: Story = {
  args: {
    defaultValue: '2026-10-05',
    min: '2026-10-05',
    max: '2026-10-20',
    onVisibleMonthChange: fn(),
  },
  render: (args) => <CalendarExample {...args} />,
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(day(canvasElement, 'October 4, 2026')).toBeDisabled();
    await expect(day(canvasElement, 'October 21, 2026')).toBeDisabled();
    await expect(day(canvasElement, 'October 5, 2026')).toBeEnabled();
    await expect(day(canvasElement, 'October 20, 2026')).toBeEnabled();
    const previous = canvas.getByRole('button', { name: 'September 2026' });
    const next = canvas.getByRole('button', { name: 'November 2026' });
    await expect(previous).toHaveAttribute('aria-disabled', 'true');
    await expect(next).toHaveAttribute('aria-disabled', 'true');

    // Both month buttons stay in the tab order; the third stop is the selected day.
    await userEvent.tab();
    await userEvent.tab();
    await userEvent.tab();
    await expect(day(canvasElement, 'October 5, 2026')).toHaveFocus();

    // Moves before min stay on the first enabled day.
    await userEvent.keyboard('{ArrowLeft}');
    await expect(day(canvasElement, 'October 5, 2026')).toHaveFocus();
    await userEvent.keyboard('{ArrowUp}');
    await expect(day(canvasElement, 'October 5, 2026')).toHaveFocus();

    // Moves past max land on the last enabled day, skipping the disabled ones.
    await userEvent.keyboard('{ArrowDown}{ArrowDown}');
    await expect(day(canvasElement, 'October 19, 2026')).toHaveFocus();
    await userEvent.keyboard('{ArrowDown}');
    await expect(day(canvasElement, 'October 20, 2026')).toHaveFocus();
    await userEvent.keyboard('{ArrowRight}{PageDown}');
    await expect(day(canvasElement, 'October 20, 2026')).toHaveFocus();
    await expectMonth(canvasElement, 'October 2026');

    await userEvent.click(next);
    await userEvent.click(previous);
    await expectMonth(canvasElement, 'October 2026');
    await expect(args.onVisibleMonthChange).not.toHaveBeenCalled();
  },
};

export const Keyboard: Story = {
  args: { defaultValue: '2026-10-14' },
  render: (args) => <CalendarExample {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.tab();
    await expect(canvas.getByRole('button', { name: 'September 2026' })).toHaveFocus();
    await userEvent.tab();
    await expect(canvas.getByRole('button', { name: 'November 2026' })).toHaveFocus();
    await userEvent.tab();
    const selected = day(canvasElement, 'October 14, 2026');
    await expect(selected).toHaveFocus();
    await expect(getComputedStyle(selected).outlineStyle).not.toBe('none');

    // Home/End: first and last day of the week (en-US weeks start on Sunday).
    await userEvent.keyboard('{Home}');
    await expect(day(canvasElement, 'October 11, 2026')).toHaveFocus();
    await userEvent.keyboard('{End}');
    const saturday = day(canvasElement, 'October 17, 2026');
    await expect(saturday).toHaveFocus();

    // ArrowRight at the end of a row wraps to the first day of the next row.
    await userEvent.keyboard('{ArrowRight}');
    const sunday = day(canvasElement, 'October 18, 2026');
    await expect(sunday).toHaveFocus();
    await expect(sunday.closest('tr')).not.toBe(saturday.closest('tr'));
    await expect((sunday.closest('td') as HTMLTableCellElement).cellIndex).toBe(0);
    await userEvent.keyboard('{ArrowLeft}');
    await expect(day(canvasElement, 'October 17, 2026')).toHaveFocus();

    await userEvent.keyboard('{PageDown}');
    await expectMonth(canvasElement, 'November 2026');
    await expect(day(canvasElement, 'November 17, 2026')).toHaveFocus();
    await userEvent.keyboard('{PageUp}');
    await expectMonth(canvasElement, 'October 2026');
    await expect(day(canvasElement, 'October 17, 2026')).toHaveFocus();

    await userEvent.keyboard('{Shift>}{PageDown}{/Shift}');
    await expectMonth(canvasElement, 'October 2027');
    await expect(day(canvasElement, 'October 17, 2027')).toHaveFocus();
    await userEvent.keyboard('{Shift>}{PageUp}{/Shift}');
    await expectMonth(canvasElement, 'October 2026');
    await expect(day(canvasElement, 'October 17, 2026')).toHaveFocus();

    // A month move keeps the day number, clamped to the shorter month's last day.
    await userEvent.keyboard('{ArrowDown}{ArrowDown}');
    await expect(day(canvasElement, 'October 31, 2026')).toHaveFocus();
    await userEvent.keyboard('{PageDown}');
    await expect(day(canvasElement, 'November 30, 2026')).toHaveFocus();

    // Moving never selects, and the grid stays a single tab stop.
    await expect(canvasElement.querySelectorAll('[data-ui="calendar-day"][tabindex="0"]')).toHaveLength(1);
    await userEvent.tab({ shift: true });
    await expect(canvas.getByRole('button', { name: 'December 2026' })).toHaveFocus();
    await userEvent.tab();
    await expect(day(canvasElement, 'November 30, 2026')).toHaveFocus();
  },
};

export const FirstDayMonday: Story = {
  args: { locale: 'de-DE', defaultVisibleMonth: '2026-10' },
  render: (args) => <CalendarExample {...args} />,
  play: async ({ canvasElement }) => {
    const headers = within(canvasElement).getAllByRole('columnheader');
    await expectMonth(canvasElement, 'Oktober 2026');
    await expect(headers[0]).toHaveAttribute('abbr', 'Montag');
    await expect(headers[6]).toHaveAttribute('abbr', 'Sonntag');
    // 1 October 2026 is a Thursday: the fourth column of a Monday-first week.
    const first = canvasElement.querySelector('[data-date="2026-10-01"]')?.closest('td') as HTMLTableCellElement;
    await expect(first.cellIndex).toBe(3);
  },
};

export const PersianLocaleGregorianDates: Story = {
  args: { locale: 'fa-IR', defaultValue: '2026-10-01' },
  render: (args) => <CalendarExample {...args} />,
  play: async ({ canvasElement }) => {
    const date = new Date(Date.UTC(2026, 9, 1));
    const expectedMonth = new Intl.DateTimeFormat('fa-IR', {
      month: 'long',
      year: 'numeric',
      calendar: 'gregory',
      timeZone: 'UTC',
    }).format(date);
    const expectedDate = new Intl.DateTimeFormat('fa-IR', {
      dateStyle: 'long',
      calendar: 'gregory',
      timeZone: 'UTC',
    }).format(date);
    const expectedDay = new Intl.DateTimeFormat('fa-IR', {
      day: 'numeric',
      calendar: 'gregory',
      timeZone: 'UTC',
    }).format(date);
    await expect(canvasElement.querySelector('[data-ui="calendar-label"]')?.textContent).toBe(expectedMonth);
    await expectMonth(canvasElement, expectedMonth);
    const first = canvasElement.querySelector('[data-date="2026-10-01"]');
    await expect(first).toHaveAccessibleName(expectedDate);
    await expect(first?.textContent).toBe(expectedDay);
  },
};

export const CivilDateRoundTrip: Story = {
  args: { defaultValue: '2011-12-29', min: '2011-12-29', max: '2011-12-31' },
  render: (args) => (
    <div>
      <div data-testid="civil-navigation">
        <CalendarExample {...args} />
      </div>
      <div data-testid="civil-single-day">
        <CalendarExample {...args} defaultValue="2011-12-30" min="2011-12-30" max="2011-12-30" />
      </div>
      <div data-testid="civil-excluded-day">
        <CalendarExample {...args} defaultValue="2011-12-31" min="2011-12-31" max="2011-12-31" />
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const navigation = canvas.getByTestId('civil-navigation');
    const singleDay = canvas.getByTestId('civil-single-day');
    const excludedDay = canvas.getByTestId('civil-excluded-day');
    // Also run with the browser time zone set to Pacific/Apia, which skipped this civil day.
    for (const calendar of [navigation, singleDay, excludedDay]) {
      await expect(calendar.querySelectorAll('[data-date="2011-12-30"]')).toHaveLength(1);
      await expect(calendar.querySelectorAll('[data-date="2011-12-31"]')).toHaveLength(1);
      await expect(calendar.querySelectorAll('[data-ui="calendar-day"]')).toHaveLength(31);
      await expect(day(calendar, 'December 30, 2011')).toHaveAttribute('data-date', '2011-12-30');
    }
    await expect(day(singleDay, 'December 29, 2011')).toBeDisabled();
    await expect(day(singleDay, 'December 30, 2011')).toBeEnabled();
    await expect(day(singleDay, 'December 31, 2011')).toBeDisabled();
    await expect(day(excludedDay, 'December 30, 2011')).toBeDisabled();
    await expect(day(excludedDay, 'December 31, 2011')).toBeEnabled();

    await userEvent.click(day(navigation, 'December 29, 2011'));
    await userEvent.keyboard('{ArrowRight}');
    await expect(day(navigation, 'December 30, 2011')).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    await expectSelected(navigation, 'December 30, 2011');
  },
};

export const LeapFebruary: Story = {
  args: { defaultValue: '2028-01-31' },
  render: (args) => <CalendarExample {...args} />,
  play: async ({ canvasElement }) => {
    await userEvent.click(day(canvasElement, 'January 31, 2028'));
    await userEvent.keyboard('{PageDown}');
    await expectMonth(canvasElement, 'February 2028');
    await expect(canvasElement.querySelectorAll('[data-date="2028-02-29"]')).toHaveLength(1);
    await expect(canvasElement.querySelectorAll('[data-ui="calendar-day"]')).toHaveLength(29);
    await expect(day(canvasElement, 'February 29, 2028')).toHaveFocus();

    await userEvent.keyboard('{Shift>}{PageDown}{/Shift}');
    await expectMonth(canvasElement, 'February 2029');
    await expect(day(canvasElement, 'February 28, 2029')).toHaveFocus();
    await expect(canvasElement.querySelector('[data-date="2029-02-29"]')).toBeNull();
    await userEvent.keyboard('{Shift>}{PageUp}{/Shift}');
    await expectMonth(canvasElement, 'February 2028');
    await expect(day(canvasElement, 'February 28, 2028')).toHaveFocus();
  },
};

export const YearBoundary: Story = {
  args: { defaultValue: '2027-12-31' },
  render: (args) => <CalendarExample {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(day(canvasElement, 'December 31, 2027'));
    await userEvent.keyboard('{ArrowRight}');
    await expectMonth(canvasElement, 'January 2028');
    await expect(day(canvasElement, 'January 1, 2028')).toHaveFocus();
    await userEvent.keyboard('{ArrowLeft}');
    await expectMonth(canvasElement, 'December 2027');
    await expect(day(canvasElement, 'December 31, 2027')).toHaveFocus();

    await userEvent.click(canvas.getByRole('button', { name: 'January 2028' }));
    await expectMonth(canvasElement, 'January 2028');
    await userEvent.click(canvas.getByRole('button', { name: 'December 2027' }));
    await expectMonth(canvasElement, 'December 2027');
  },
};

export const Controlled: Story = {
  args: { onValueChange: fn(), onVisibleMonthChange: fn() },
  render: (args) => <ControlledCalendar {...args} />,
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await expectSelected(canvasElement, 'October 14, 2026');

    await userEvent.click(day(canvasElement, 'October 20, 2026'));
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith('2026-10-20');
    await expectSelected(canvasElement, 'October 20, 2026');

    // Re-selecting the selected day issues no request.
    await userEvent.click(day(canvasElement, 'October 20, 2026'));
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);

    // The parent rejects this day: one request per activation, selection stays put.
    await userEvent.click(day(canvasElement, 'October 17, 2026'));
    await expect(args.onValueChange).toHaveBeenCalledTimes(2);
    await expect(args.onValueChange).toHaveBeenLastCalledWith(REJECTED_DATE);
    await expectSelected(canvasElement, 'October 20, 2026');
    await userEvent.keyboard('{Enter}');
    await expect(args.onValueChange).toHaveBeenCalledTimes(3);
    await expectSelected(canvasElement, 'October 20, 2026');

    await userEvent.click(canvas.getByRole('button', { name: 'November 2026' }));
    await expect(args.onVisibleMonthChange).toHaveBeenCalledTimes(1);
    await expect(args.onVisibleMonthChange).toHaveBeenLastCalledWith('2026-11');
    await expectMonth(canvasElement, 'November 2026');

    await userEvent.click(day(canvasElement, 'November 2, 2026'));
    await expect(args.onValueChange).toHaveBeenCalledTimes(4);
    await expect(args.onValueChange).toHaveBeenLastCalledWith('2026-11-02');
    await userEvent.keyboard('{ArrowLeft}');
    await expect(args.onVisibleMonthChange).toHaveBeenCalledTimes(1);
    await userEvent.keyboard('{ArrowLeft}');
    await expect(args.onVisibleMonthChange).toHaveBeenCalledTimes(2);
    await expect(args.onVisibleMonthChange).toHaveBeenLastCalledWith('2026-10');
    await expectMonth(canvasElement, 'October 2026');
    await expect(day(canvasElement, 'October 31, 2026')).toHaveFocus();
    // Moving focus never selects.
    await expect(args.onValueChange).toHaveBeenCalledTimes(4);
  },
};

export const RejectedControlledVisibleMonth: Story = {
  args: { visibleMonth: '2026-10', defaultValue: '2026-10-31', onVisibleMonthChange: fn() },
  render: (args) => <CalendarExample {...args} />,
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const last = day(canvasElement, 'October 31, 2026');
    await userEvent.tab();
    await userEvent.tab();
    await userEvent.tab();
    await expect(last).toHaveFocus();

    // The parent never honors the month request: focus stays on the current day.
    await userEvent.keyboard('{ArrowRight}');
    await expect(args.onVisibleMonthChange).toHaveBeenCalledTimes(1);
    await expect(args.onVisibleMonthChange).toHaveBeenLastCalledWith('2026-11');
    await expectMonth(canvasElement, 'October 2026');
    await expect(last).toHaveFocus();
    await expect(last.tabIndex).toBe(0);

    await userEvent.keyboard('{PageDown}');
    await expect(args.onVisibleMonthChange).toHaveBeenCalledTimes(2);
    await expect(last).toHaveFocus();

    await userEvent.click(canvas.getByRole('button', { name: 'November 2026' }));
    await expect(args.onVisibleMonthChange).toHaveBeenCalledTimes(3);
    await expectMonth(canvasElement, 'October 2026');

    // The tab stop survived the rejected requests; in-month moves issue no request.
    await userEvent.tab();
    await expect(last).toHaveFocus();
    await userEvent.keyboard('{Home}');
    await expect(day(canvasElement, 'October 25, 2026')).toHaveFocus();
    await expect(args.onVisibleMonthChange).toHaveBeenCalledTimes(3);
  },
};

export const LightTheme: Story = {
  decorators: [withLightTheme],
  args: { defaultValue: '2026-10-12' },
  render: (args) => <CalendarExample {...args} />,
  play: async ({ canvasElement }) => {
    await expectSelected(canvasElement, 'October 12, 2026');
  },
};

/** Range mode: multi-selection semantics, endpoint descriptions, preview without selection. */
export const RangeSelection: Story = {
  args: {
    visibleMonth: '2026-10',
    today: '2026-10-11',
    selectionRange: { start: '2026-10-12', end: '2026-10-14' },
    previewRange: { start: '2026-10-14', end: '2026-10-16' },
    rangeLabels: { start: 'Start date', end: 'End date' },
    onDayActivate: fn(),
    onValueChange: fn(),
  },
  render: (args) => <CalendarExample {...args} />,
  play: async ({ args, canvasElement, userEvent }) => {
    const grid = within(canvasElement).getByRole('grid', { name: 'October 2026' });
    await expect(grid).toHaveAttribute('aria-multiselectable', 'true');
    const selected = within(canvasElement)
      .getAllByRole('gridcell')
      .filter((cell) => cell.getAttribute('aria-selected') === 'true');
    await expect(selected).toHaveLength(3);
    // Every other selectable day reports aria-selected="false"; the preview never selects.
    await expect(day(canvasElement, 'October 16, 2026').closest('td')).toHaveAttribute('aria-selected', 'false');
    await expect(day(canvasElement, 'October 16, 2026')).toHaveAttribute('data-preview-end');
    await expect(day(canvasElement, 'October 12, 2026')).toHaveAccessibleDescription('Start date');
    await expect(day(canvasElement, 'October 14, 2026')).toHaveAccessibleDescription('End date');
    await expect(day(canvasElement, 'October 11, 2026')).toHaveAttribute('aria-current', 'date');

    // Activation only reports; the selection stays with the parent.
    await userEvent.click(day(canvasElement, 'October 20, 2026'));
    await expect(args.onDayActivate).toHaveBeenCalledTimes(1);
    await expect(args.onDayActivate).toHaveBeenLastCalledWith('2026-10-20');
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await expect(day(canvasElement, 'October 20, 2026').closest('td')).toHaveAttribute('aria-selected', 'false');
  },
};

/** A parent-owned tab stop is exact: null leaves no day tab stop; moves only report. */
export const ParentTabStop: Story = {
  args: { visibleMonth: '2026-10', tabStopDate: '2026-10-30', onFocusedDateChange: fn(), onVisibleMonthChange: fn() },
  render: (args) => (
    <>
      <CalendarExample {...args} />
      <CalendarExample {...args} visibleMonth="2026-11" tabStopDate={null} aria-label="Second" />
    </>
  ),
  play: async ({ args, canvasElement, userEvent }) => {
    const tabStops = canvasElement.querySelectorAll('[data-ui="calendar-day"][tabindex="0"]');
    await expect(Array.from(tabStops)).toEqual([day(canvasElement, 'October 30, 2026')]);
    await userEvent.click(day(canvasElement, 'October 30, 2026'));
    await expect(args.onFocusedDateChange).toHaveBeenLastCalledWith('2026-10-30');
    await userEvent.keyboard('{ArrowDown}');
    // The destination lies in the next month: reported, no month request, focus unchanged.
    await expect(args.onFocusedDateChange).toHaveBeenLastCalledWith('2026-11-06');
    await expect(args.onVisibleMonthChange).not.toHaveBeenCalled();
    await expect(day(canvasElement, 'October 30, 2026')).toHaveFocus();
  },
};
