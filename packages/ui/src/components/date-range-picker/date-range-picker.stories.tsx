import { useId, useState, type ComponentPropsWithRef, type ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, waitFor, within } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
// `styled` is the app-facing styling API; consumers import it from `@jfrader/ui`.
import { styled } from '../../index';
import { ANCHOR_GAP } from '../../overlay/use-overlay-floating';
import { expectAligned } from '../../testing/geometry-assertions';
import { expectEntranceMotion, expectRetainedExit, settleMotion } from '../../testing/motion-assertions';
import { withLightTheme } from '../../testing/story-decorators';
import { expectThemedSurface } from '../../testing/theme-assertions';
import { Button } from '../button';
import { firstOfMonth, lastOfMonth, monthOf, shiftDays, shiftMonth } from '../calendar/calendar.utils';
import { Popover } from '../popover';
import { ThemeRoot } from '../theme-root';
import {
  DateRangePicker,
  type DateRangePickerContentProps,
  type DateRangePickerMessages,
  type DateRangePickerCompoundProps as DateRangePickerProps,
  type DateRangePickerEasyProps,
  type DateRangePickerTriggerProps,
  type DateRangePreset,
  type DateRangeValue,
} from './index';

const LOCALE = 'en-GB';
const LABEL = 'Report period';
const PLACEHOLDER = 'Choose dates';
const OUTSIDE = 'After';
const TODAY = '2026-10-11';
const START_FIELD = 'from';
const END_FIELD = 'to';
const WEEK: DateRangeValue = { start: '2026-10-05', end: '2026-10-09' };
// Tolerance for computed geometry (fractional device pixel ratios round borders and boxes).
const PX_TOLERANCE = 1.1;

const RANGE_FORMAT = new Intl.DateTimeFormat(LOCALE, { dateStyle: 'medium', calendar: 'gregory', timeZone: 'UTC' });
const DAY_FORMAT = new Intl.DateTimeFormat(LOCALE, { dateStyle: 'long', calendar: 'gregory', timeZone: 'UTC' });
const MONTH_FORMAT = new Intl.DateTimeFormat(LOCALE, {
  month: 'long',
  year: 'numeric',
  calendar: 'gregory',
  timeZone: 'UTC',
});
const PLURAL = new Intl.PluralRules(LOCALE);
const DAY_UNITS: Partial<Record<Intl.LDMLPluralRule, string>> & { other: string } = { one: 'day', other: 'days' };

const rangeMessages: DateRangePickerMessages = {
  apply: 'Apply',
  cancel: 'Cancel',
  empty: 'No dates selected',
  start: 'Start date',
  end: 'End date',
  presets: 'Quick ranges',
  error: 'Choose a valid period',
  required: 'required',
  summary: ({ range, days, formattedDays }) =>
    `${range} · ${formattedDays} ${DAY_UNITS[PLURAL.select(days)] ?? DAY_UNITS.other}`,
};

// ---- Preset recipes: date-only arithmetic on 'YYYY-MM-DD' strings.

const lastDays =
  (count: number) =>
  (today: string): DateRangeValue => ({ start: shiftDays(today, 1 - count), end: today });

const wholeMonth = (month: string): DateRangeValue => ({ start: firstOfMonth(month), end: lastOfMonth(month) });

function quarterOf(today: string): DateRangeValue {
  const monthIndex = Number(today.slice(5, 7)) - 1;
  const first = shiftMonth(monthOf(today), -(monthIndex % 3));
  return { start: firstOfMonth(first), end: lastOfMonth(shiftMonth(first, 2)) };
}

const PRESETS: DateRangePreset[] = [
  { id: 'today', label: 'Today', range: (today) => ({ start: today, end: today }) },
  { id: 'yesterday', label: 'Yesterday', range: (today) => lastDays(1)(shiftDays(today, -1)) },
  { id: 'last-7', label: 'Last 7 days', range: lastDays(7) },
  { id: 'last-30', label: 'Last 30 days', range: lastDays(30) },
  { id: 'this-month', label: 'This month', range: (today) => wholeMonth(monthOf(today)) },
  { id: 'last-month', label: 'Last month', range: (today) => wholeMonth(shiftMonth(monthOf(today), -1)) },
  { id: 'this-quarter', label: 'This quarter', range: quarterOf },
  { id: 'year-to-date', label: 'Year to date', range: (today) => ({ start: `${today.slice(0, 4)}-01-01`, end: today }) },
];

const FALSY_NODES = [0, '', false, null] as const;

// Ref spies: the plays compare the received argument with the rendered element.
const triggerRef = fn();
const contentRef = fn();

const Stack = styled.div({
  display: 'grid',
  justifyItems: 'start',
  gap: vars.space[4],
});

const USAGE = `const rangeMessages = {
  apply: 'Apply',
  cancel: 'Cancel',
  empty: 'No dates selected',
  start: 'Start date',
  end: 'End date',
  summary: ({ range, days, formattedDays }) =>
    \`\${range} · \${formattedDays} \${new Intl.PluralRules('en-GB').select(days) === 'one' ? 'day' : 'days'}\`,
};

<DateRangePicker label="Report period" placeholder="Choose dates" locale="en-GB" messages={rangeMessages} />`;

function LightThemeRoot(props: Omit<ComponentPropsWithRef<typeof ThemeRoot>, 'theme'>) {
  return <ThemeRoot {...props} theme="light" />;
}
const LightScope = styled(LightThemeRoot)({ padding: vars.space[4], backgroundColor: vars.color.bg });

const meta: Meta<DateRangePickerProps> = {
  title: 'Inputs/DateRangePicker',
  component: DateRangePicker,
  tags: ['autodocs'],
  args: { locale: LOCALE, today: TODAY, messages: rangeMessages },
  parameters: {
    // Floating UI's focus guards are aria-hidden spans with tabindex=0 that forward focus
    // immediately; axe flags them as aria-hidden-focus (known false positive). Every other
    // aria-hidden element is still checked.
    a11y: {
      config: {
        rules: [{ id: 'aria-hidden-focus', selector: '[aria-hidden="true"]:not([data-floating-ui-focus-guard])' }],
      },
    },
    docs: {
      description: {
        component:
          'Choose a date range or a preset, then apply it.',
      },
      usage: '- Values are inclusive `{ start, end }` ranges of `YYYY-MM-DD` dates, without time or time zone.\n- The first day starts a draft; hovering or focusing a day previews it; the second day finishes it. Apply calls `onValueChange`, then `onOpenChange(false)`. Cancel, Escape, outside presses and Tab-out discard the draft.\n- Supply preset labels and `range(today)`. Out-of-bounds presets stay visible but disabled.\n- `months="auto"` shows two months when the boundary leaves at least 712px.\n- Supply copy through `messages`, including a plural-aware `summary`. Dates and numbers use Intl with `locale`. Pass `today` and `locale` for repeatable server rendering.\n- `messages.required` adds the required state to the trigger name. Hidden fields do not enforce native validation.\n- Screen-reader, forced-colors and reduced-motion checks require manual testing.',
      source: { code: USAGE },
    },
  },
};

export default meta;

type Story = StoryObj<typeof meta>;

type CheckedDateRangePicker<Props extends import('./index').DateRangePickerProps> = Props;
export type DateRangePickerTypeRegression = {
  // @ts-expect-error The non-DOM provider root has no component sugar.
  providerComponent: DateRangePickerEasyProps['component'];
  // @ts-expect-error The semantic button and portaled panel have separate replacement seams.
  providerRootSlot: NonNullable<DateRangePickerEasyProps['slots']>['root'];
  // @ts-expect-error The provider has no root element to receive native props.
  providerRootProps: NonNullable<DateRangePickerEasyProps['slotProps']>['root'];
  // @ts-expect-error Easy label and compound children are mutually exclusive.
  mixed: CheckedDateRangePicker<{ label: string; messages: DateRangePickerMessages; children: string }>;
  // @ts-expect-error Easy placeholder requires a label.
  incomplete: CheckedDateRangePicker<{ placeholder: string; messages: DateRangePickerMessages }>;
  // @ts-expect-error Compound mode rejects generated-part props.
  compoundSlots: CheckedDateRangePicker<{ children: string; messages: DateRangePickerMessages; slotProps: { trigger: { className: string } } }>;
};

function EasyControlledRange(props: DateRangePickerEasyProps) {
  const [value, setValue] = useState<DateRangeValue | null>(WEEK);
  const [open, setOpen] = useState(false);
  return <DateRangePicker {...props} value={value} open={open}
    onValueChange={(next) => { setValue(next); props.onValueChange?.(next); }}
    onOpenChange={(next) => { setOpen(next); props.onOpenChange?.(next); }} />;
}
EasyControlledRange.displayName = 'EasyControlledRange';

function RangeButtonRoot(props: ComponentPropsWithRef<'button'>) {
  return <button {...props} data-generated-trigger="" />;
}
RangeButtonRoot.displayName = 'RangeButtonRoot';

function RangePanelRoot(props: ComponentPropsWithRef<'div'>) {
  return <div {...props} data-generated-panel="" />;
}
RangePanelRoot.displayName = 'RangePanelRoot';

type ExampleProps = DateRangePickerProps & {
  trigger?: Partial<DateRangePickerTriggerProps>;
  content?: DateRangePickerContentProps;
};

function RangeExample({ trigger, content, ...props }: ExampleProps) {
  return (
    <Stack>
      <DateRangePicker {...props}>
        <DateRangePicker.Trigger aria-label={LABEL} placeholder={PLACEHOLDER} {...trigger} />
        <DateRangePicker.Content {...content} />
      </DateRangePicker>
      <Button>{OUTSIDE}</Button>
    </Stack>
  );
}
RangeExample.displayName = 'RangeExample';

// ---- Helpers.

function civil(iso: string) {
  const [year = 0, month = 1, day = 1] = iso.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

const formattedRange = ({ start, end }: DateRangeValue) => RANGE_FORMAT.formatRange(civil(start), civil(end));
const dayName = (iso: string) => DAY_FORMAT.format(civil(iso));
const monthName = (month: string) => MONTH_FORMAT.format(civil(`${month}-01`));

/** Portaled content lives in the story document's body, outside the canvas. */
const bodyOf = (canvasElement: HTMLElement) => within(canvasElement.ownerDocument.body);

const getTrigger = (canvasElement: HTMLElement, name: string | RegExp = new RegExp(`^${LABEL}`)) =>
  within(canvasElement).getByRole('button', { name });

/** Resolves with the open dialog once its entrance settled (visibility checks read opacity). */
async function findDialog(canvasElement: HTMLElement, name = LABEL) {
  const dialog = await bodyOf(canvasElement).findByRole('dialog', { name });
  await settleMotion(dialog);
  return dialog;
}

const day = (canvasElement: HTMLElement, iso: string) => bodyOf(canvasElement).getByRole('button', { name: dayName(iso) });

const dialogButton = (canvasElement: HTMLElement, name: string) => bodyOf(canvasElement).getByRole('button', { name });

async function expectFocused(canvasElement: HTMLElement, element: () => HTMLElement) {
  await waitFor(() => expect(canvasElement.ownerDocument.activeElement).toBe(element()));
}

async function expectDayFocused(canvasElement: HTMLElement, iso: string) {
  await expectFocused(canvasElement, () => day(canvasElement, iso));
}

async function expectClosed(canvasElement: HTMLElement) {
  await waitFor(() => expect(bodyOf(canvasElement).queryByRole('dialog')).toBeNull());
  await expect(getTrigger(canvasElement)).toHaveAttribute('aria-expanded', 'false');
  await expect(getTrigger(canvasElement)).not.toHaveAttribute('aria-controls');
}

/** The selected gridcells hold exactly the days from `start` to `end`. */
async function expectSelected(canvasElement: HTMLElement, range: DateRangeValue | null) {
  const selected = bodyOf(canvasElement)
    .getAllByRole('gridcell')
    .filter((cell) => cell.getAttribute('aria-selected') === 'true')
    .map((cell) => cell.querySelector<HTMLElement>('[data-date]')?.dataset.date);
  const expected: string[] = [];
  for (let date = range?.start; range && date !== undefined && date <= range.end; date = shiftDays(date, 1)) {
    expected.push(date);
  }
  await expect(selected).toEqual(expected);
}

const tabStopDays = (canvasElement: HTMLElement) =>
  bodyOf(canvasElement)
    .getAllByRole('gridcell')
    .flatMap((cell) => Array.from(cell.querySelectorAll<HTMLElement>('[data-date][tabindex="0"]')));

async function expectFocusRing(element: HTMLElement) {
  await waitFor(() => expect(getComputedStyle(element).outlineStyle).not.toBe('none'));
  const width = parseFloat(getComputedStyle(element).outlineWidth);
  await expect(Math.abs(width - 2)).toBeLessThan(PX_TOLERANCE);
}

async function expectTargetSize(element: HTMLElement) {
  const { width, height } = element.getBoundingClientRect();
  await expect(height).toBeGreaterThanOrEqual(32 - PX_TOLERANCE);
  await expect(width).toBeGreaterThanOrEqual(32 - PX_TOLERANCE);
}

const callValues = (spy: unknown) => (spy as ReturnType<typeof fn>).mock.calls.map(([value]) => value);

const summary = (canvasElement: HTMLElement) => bodyOf(canvasElement).getByRole('status');

const summaryText = ({ start, end }: DateRangeValue, days: number) =>
  `${formattedRange({ start, end })} · ${days} ${days === 1 ? 'day' : 'days'}`;

// ---- Stories.

export const Default: StoryObj<DateRangePickerEasyProps> = {
  args: { label: LABEL, placeholder: PLACEHOLDER, locale: LOCALE, today: TODAY, messages: rangeMessages, defaultValue: WEEK, months: 1, onValueChange: fn() },
  render: (args) => <DateRangePicker {...args} />,
  parameters: { docs: { source: { code: USAGE } } },
  play: async ({ args, canvasElement, userEvent }) => {
    const trigger = getTrigger(canvasElement);
    await expect(trigger).toHaveAccessibleName(`${LABEL} ${formattedRange(WEEK)}`);
    await userEvent.tab();
    await userEvent.keyboard('{ArrowDown}');
    await findDialog(canvasElement);
    await expectDayFocused(canvasElement, WEEK.start);
    await userEvent.keyboard('{ArrowRight}{Enter}{ArrowDown}{Enter}');
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await userEvent.click(dialogButton(canvasElement, 'Apply'));
    await expectClosed(canvasElement);
    const draft = { start: '2026-10-06', end: '2026-10-13' };
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith(draft);
    await expect(getTrigger(canvasElement)).toHaveAccessibleName(`${LABEL} ${formattedRange(draft)}`);
    await expectFocused(canvasElement, () => getTrigger(canvasElement));
    await userEvent.keyboard('{Enter}');
    await findDialog(canvasElement);
    await userEvent.click(day(canvasElement, '2026-10-20'));
    await userEvent.click(dialogButton(canvasElement, 'Cancel'));
    await expectClosed(canvasElement);
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
  },
};

/** Assemble the range trigger and dialog for a custom layout. */
export const Compound: Story = {
  args: { defaultValue: WEEK, onValueChange: fn(), onOpenChange: fn() },
  render: (args) => <RangeExample {...args} />,
  parameters: { docs: { source: { code: `<DateRangePicker locale="en-GB" messages={rangeMessages}>
  <DateRangePicker.Trigger aria-label="Report period" placeholder="Choose dates" />
  <DateRangePicker.Content />
</DateRangePicker>` } } },
  play: async ({ args, canvasElement, userEvent }) => {
    const trigger = getTrigger(canvasElement);
    await expect(trigger.tagName).toBe('BUTTON');
    await expect(trigger).toHaveAccessibleName(`${LABEL} ${formattedRange(WEEK)}`);
    await expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(trigger).not.toHaveAttribute('aria-controls');

    await userEvent.tab();
    await expect(canvasElement.ownerDocument.activeElement).toBe(trigger);
    await expectFocusRing(trigger);

    // ArrowDown opens and focuses the committed start.
    await userEvent.keyboard('{ArrowDown}');
    const dialog = await findDialog(canvasElement);
    await expect(canvasElement.contains(dialog)).toBe(false);
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await expect(trigger).toHaveAttribute('aria-controls', dialog.id);
    await expectDayFocused(canvasElement, WEEK.start);
    await expectFocusRing(day(canvasElement, WEEK.start));
    await expectSelected(canvasElement, WEEK);
    await expect(args.onOpenChange).toHaveBeenCalledTimes(1);
    await expect(args.onOpenChange).toHaveBeenLastCalledWith(true);

    // First activation anchors; the focused day previews without being selected.
    await userEvent.keyboard('{ArrowRight}{Enter}');
    await expectSelected(canvasElement, { start: '2026-10-06', end: '2026-10-06' });
    await userEvent.keyboard('{ArrowDown}');
    await expectDayFocused(canvasElement, '2026-10-13');
    await expect(day(canvasElement, '2026-10-13')).toHaveAttribute('data-preview');
    await expect(day(canvasElement, '2026-10-13').closest('td')).toHaveAttribute('aria-selected', 'false');
    await expect(summary(canvasElement)).toHaveTextContent(summaryText({ start: '2026-10-06', end: '2026-10-13' }, 8));

    // Second activation finishes the draft; nothing is committed before Apply.
    await userEvent.keyboard('{Enter}');
    const draft = { start: '2026-10-06', end: '2026-10-13' };
    await expectSelected(canvasElement, draft);
    await expect(day(canvasElement, draft.start)).toHaveAccessibleDescription(rangeMessages.start);
    await expect(day(canvasElement, draft.end)).toHaveAccessibleDescription(rangeMessages.end);
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await expect(trigger).toHaveAccessibleName(`${LABEL} ${formattedRange(WEEK)}`);

    await userEvent.click(dialogButton(canvasElement, 'Apply'));
    await expectClosed(canvasElement);
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith(draft);
    await expect(args.onOpenChange).toHaveBeenCalledTimes(2);
    await expect(args.onOpenChange).toHaveBeenLastCalledWith(false);
    // Value request first, then the close request.
    const valueOrder = (args.onValueChange as ReturnType<typeof fn>).mock.invocationCallOrder[0] ?? 0;
    const closeOrder = (args.onOpenChange as ReturnType<typeof fn>).mock.invocationCallOrder[1] ?? 0;
    await expect(valueOrder).toBeLessThan(closeOrder);
    await expectFocused(canvasElement, () => getTrigger(canvasElement));
    await expect(getTrigger(canvasElement)).toHaveAccessibleName(`${LABEL} ${formattedRange(draft)}`);

    // Applying the unchanged range closes without a value request.
    await userEvent.keyboard('{Enter}');
    await findDialog(canvasElement);
    await expectDayFocused(canvasElement, draft.start);
    await userEvent.click(dialogButton(canvasElement, 'Apply'));
    await expectClosed(canvasElement);
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onOpenChange).toHaveBeenCalledTimes(4);
  },
};

/** Set props on the generated trigger and dialog, including its interior slots. */
export const CustomParts: StoryObj<DateRangePickerEasyProps> = {
  args: {
    label: LABEL, placeholder: PLACEHOLDER, locale: LOCALE, today: TODAY, messages: rangeMessages, defaultValue: WEEK, months: 1,
    slots: { trigger: RangeButtonRoot, content: RangePanelRoot },
    slotProps: { trigger: { className: 'report-trigger', ref: fn() }, content: { className: 'report-dialog', ref: fn(), slotProps: { summary: { className: 'report-summary' } } } },
  },
  render: (args) => <DateRangePicker {...args} />,
  parameters: { docs: { source: { code: `<DateRangePicker label="Report period" placeholder="Choose dates" messages={rangeMessages}
  slotProps={{ content: { slotProps: { summary: { className: 'report-summary' } } } }} />` } } },
  play: async ({ args, canvasElement, userEvent }) => {
    const trigger = getTrigger(canvasElement);
    await expect(trigger).toHaveClass('report-trigger');
    await expect(trigger).toHaveAttribute('data-generated-trigger');
    await expect(args.slotProps?.trigger?.ref).toHaveBeenLastCalledWith(trigger);
    await userEvent.click(trigger);
    const dialog = await findDialog(canvasElement);
    await expect(dialog).toHaveClass('report-dialog');
    await expect(dialog).toHaveAttribute('data-generated-panel');
    await expect(args.slotProps?.content?.ref).toHaveBeenLastCalledWith(dialog);
    await expect(summary(canvasElement)).toHaveClass('report-summary');
    await userEvent.keyboard('{Escape}');
    await expectClosed(canvasElement);
  },
};

export const EasyDisabled: StoryObj<DateRangePickerEasyProps> = {
  tags: ['!autodocs'],
  args: { label: LABEL, placeholder: PLACEHOLDER, messages: rangeMessages, disabled: true, open: true },
  render: (args) => <DateRangePicker {...args} />,
  play: async ({ canvasElement, userEvent }) => {
    await expect(getTrigger(canvasElement)).toBeDisabled();
    await userEvent.click(getTrigger(canvasElement));
    await expect(bodyOf(canvasElement).queryByRole('dialog')).toBeNull();
  },
};

export const EasyControlled: StoryObj<DateRangePickerEasyProps> = {
  args: { label: LABEL, placeholder: PLACEHOLDER, locale: LOCALE, today: TODAY, messages: rangeMessages, months: 1, onValueChange: fn(), onOpenChange: fn() },
  render: (args) => <EasyControlledRange {...args} />,
  play: async ({ args, canvasElement, userEvent }) => {
    await userEvent.click(getTrigger(canvasElement));
    await findDialog(canvasElement);
    await userEvent.click(day(canvasElement, '2026-10-20'));
    await userEvent.click(day(canvasElement, '2026-10-22'));
    await userEvent.click(dialogButton(canvasElement, 'Apply'));
    await expectClosed(canvasElement);
    const selected = { start: '2026-10-20', end: '2026-10-22' };
    await expect(getTrigger(canvasElement)).toHaveAccessibleName(`${LABEL} ${formattedRange(selected)}`);
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith(selected);
    await expect(args.onOpenChange).toHaveBeenCalledTimes(2);
  },
};

/** Date text follows the selected locale; action copy comes from messages. */
export const EasyLocale: StoryObj<DateRangePickerEasyProps> = {
  args: {
    label: LABEL, locale: 'es-ES', today: TODAY, defaultValue: WEEK, months: 1,
    messages: { ...rangeMessages, apply: 'Aplicar', cancel: 'Cancelar', empty: 'Sin fechas', start: 'Fecha inicial', end: 'Fecha final', summary: ({ range }) => range },
  },
  render: (args) => <DateRangePicker {...args} />,
  play: async ({ canvasElement, userEvent }) => {
    const expected = new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', calendar: 'gregory', timeZone: 'UTC' }).formatRange(civil(WEEK.start), civil(WEEK.end));
    await expect(getTrigger(canvasElement)).toHaveAccessibleName(`${LABEL} ${expected}`);
    await userEvent.click(getTrigger(canvasElement));
    const dialog = await findDialog(canvasElement);
    await expect(within(dialog).getByRole('button', { name: 'Aplicar' })).toBeVisible();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    await expectClosed(canvasElement);
  },
};

export const SameDay: Story = {
  args: { defaultValue: { start: '2026-10-14', end: '2026-10-14' }, onValueChange: fn() },
  render: (args) => <RangeExample {...args} />,
  play: async ({ args, canvasElement, userEvent }) => {
    const trigger = getTrigger(canvasElement);
    // Equal endpoints format as one date.
    await expect(trigger).toHaveAccessibleName(`${LABEL} ${RANGE_FORMAT.format(civil('2026-10-14'))}`);

    await userEvent.click(trigger);
    await findDialog(canvasElement);
    await expectSelected(canvasElement, { start: '2026-10-14', end: '2026-10-14' });
    await expect(summary(canvasElement)).toHaveTextContent(summaryText({ start: '2026-10-14', end: '2026-10-14' }, 1));

    // An anchor alone applies as a same-day range.
    await userEvent.click(day(canvasElement, '2026-10-20'));
    await userEvent.click(dialogButton(canvasElement, 'Apply'));
    await expectClosed(canvasElement);
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith({ start: '2026-10-20', end: '2026-10-20' });

    // Activating the same day twice finishes a same-day range too.
    await userEvent.click(getTrigger(canvasElement));
    await findDialog(canvasElement);
    await userEvent.click(day(canvasElement, '2026-10-22'));
    await userEvent.click(day(canvasElement, '2026-10-22'));
    await expectSelected(canvasElement, { start: '2026-10-22', end: '2026-10-22' });
    await userEvent.click(day(canvasElement, '2026-10-23'));
    // The finished range was replaced by a new anchor.
    await expectSelected(canvasElement, { start: '2026-10-23', end: '2026-10-23' });
    await userEvent.keyboard('{Escape}');
    await expectClosed(canvasElement);
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
  },
};

export const BackwardSelection: Story = {
  args: { onValueChange: fn() },
  render: (args) => <RangeExample {...args} />,
  play: async ({ args, canvasElement, userEvent }) => {
    await userEvent.click(getTrigger(canvasElement));
    await findDialog(canvasElement);
    // Nothing committed: today is focused.
    await expectDayFocused(canvasElement, TODAY);
    await userEvent.click(day(canvasElement, '2026-10-20'));
    await userEvent.hover(day(canvasElement, '2026-10-15'));
    await expect(day(canvasElement, '2026-10-15')).toHaveAttribute('data-preview-start');
    await expect(day(canvasElement, '2026-10-20')).toHaveAttribute('data-preview-end');
    await userEvent.click(day(canvasElement, '2026-10-15'));
    // The endpoints are ordered; the consumer never sees a reversed range.
    await expectSelected(canvasElement, { start: '2026-10-15', end: '2026-10-20' });
    await userEvent.click(dialogButton(canvasElement, 'Apply'));
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith({ start: '2026-10-15', end: '2026-10-20' });
  },
};

/** After a pointer anchor, arrows drive the preview from the focused day. */
export const PointerAnchorThenKeyboard: Story = {
  args: { months: 1 },
  render: (args) => <RangeExample {...args} />,
  play: async ({ canvasElement, userEvent }) => {
    await userEvent.click(getTrigger(canvasElement));
    await findDialog(canvasElement);
    // The pointer stays on the anchored day while the keyboard moves on.
    await userEvent.click(day(canvasElement, '2026-10-20'));
    await userEvent.keyboard('{ArrowRight}');
    await expectDayFocused(canvasElement, '2026-10-21');
    await expect(day(canvasElement, '2026-10-21')).toHaveAttribute('data-preview-end');
    await expect(day(canvasElement, '2026-10-20')).toHaveAttribute('data-preview-start');
    await expect(summary(canvasElement)).toHaveTextContent(summaryText({ start: '2026-10-20', end: '2026-10-21' }, 2));
    await userEvent.keyboard('{ArrowDown}');
    await expect(day(canvasElement, '2026-10-28')).toHaveAttribute('data-preview-end');
    await expect(summary(canvasElement)).toHaveTextContent(summaryText({ start: '2026-10-20', end: '2026-10-28' }, 9));
  },
};

/** A hover preview gives way to the keyboard, and a new pointer move takes it back. */
export const HoverThenKeyboard: Story = {
  args: { months: 1 },
  render: (args) => <RangeExample {...args} />,
  play: async ({ canvasElement, userEvent }) => {
    await userEvent.click(getTrigger(canvasElement));
    await findDialog(canvasElement);
    await userEvent.click(day(canvasElement, '2026-10-20'));
    await userEvent.hover(day(canvasElement, '2026-10-15'));
    await expect(day(canvasElement, '2026-10-15')).toHaveAttribute('data-preview-start');

    await userEvent.keyboard('{ArrowLeft}');
    await expectDayFocused(canvasElement, '2026-10-19');
    await expect(day(canvasElement, '2026-10-15')).not.toHaveAttribute('data-preview');
    await expect(day(canvasElement, '2026-10-19')).toHaveAttribute('data-preview-start');
    await expect(summary(canvasElement)).toHaveTextContent(summaryText({ start: '2026-10-19', end: '2026-10-20' }, 2));

    await userEvent.hover(day(canvasElement, '2026-10-24'));
    await expect(day(canvasElement, '2026-10-24')).toHaveAttribute('data-preview-end');
    await expect(day(canvasElement, '2026-10-19')).not.toHaveAttribute('data-preview');
    await expect(summary(canvasElement)).toHaveTextContent(summaryText({ start: '2026-10-20', end: '2026-10-24' }, 5));
  },
};

/** A navigation key clamped at a bound still hands the preview to the keyboard. */
export const HoverThenClampedKey: Story = {
  args: { months: 1, min: '2026-10-05' },
  render: (args) => <RangeExample {...args} />,
  play: async ({ canvasElement, userEvent }) => {
    await userEvent.click(getTrigger(canvasElement));
    await findDialog(canvasElement);
    await userEvent.click(day(canvasElement, '2026-10-05'));
    await userEvent.hover(day(canvasElement, '2026-10-12'));
    await expect(day(canvasElement, '2026-10-12')).toHaveAttribute('data-preview-end');

    await userEvent.keyboard('{ArrowLeft}');
    await expectDayFocused(canvasElement, '2026-10-05');
    await expect(day(canvasElement, '2026-10-12')).not.toHaveAttribute('data-preview');
    await expect(day(canvasElement, '2026-10-05')).toHaveAttribute('data-preview-end');
    await expect(summary(canvasElement)).toHaveTextContent(summaryText({ start: '2026-10-05', end: '2026-10-05' }, 1));
  },
};

export const Empty: Story = {
  args: { value: null, onValueChange: fn() },
  render: (args) => <RangeExample {...args} />,
  play: async ({ args, canvasElement, userEvent }) => {
    const trigger = getTrigger(canvasElement);
    await expect(trigger).toHaveAccessibleName(`${LABEL} ${PLACEHOLDER}`);
    await userEvent.click(trigger);
    await findDialog(canvasElement);
    await expectSelected(canvasElement, null);
    await expect(summary(canvasElement)).toHaveTextContent(String(rangeMessages.empty));
    // No draft: Apply is unavailable.
    await expect(dialogButton(canvasElement, 'Apply')).toBeDisabled();
    await userEvent.click(dialogButton(canvasElement, 'Cancel'));
    await expectClosed(canvasElement);
    await expectFocused(canvasElement, () => getTrigger(canvasElement));
    await expect(args.onValueChange).not.toHaveBeenCalled();
  },
};

function ControlledExample({ onValueChange, onOpenChange, ...props }: ExampleProps) {
  const [value, setValue] = useState<DateRangeValue | null>(WEEK);
  const [open, setOpen] = useState(false);
  return (
    <Stack>
      <RangeExample
        {...props}
        value={value}
        open={open}
        onValueChange={(next) => {
          onValueChange?.(next);
          setValue(next);
        }}
        onOpenChange={(next) => {
          onOpenChange?.(next);
          setOpen(next);
        }}
      />
      <Button onClick={() => setValue({ start: '2026-11-02', end: '2026-11-06' })}>Next month week</Button>
    </Stack>
  );
}
ControlledExample.displayName = 'ControlledExample';

export const Controlled: Story = {
  args: { onValueChange: fn(), onOpenChange: fn(), months: 1 },
  render: (args) => <ControlledExample {...args} />,
  play: async ({ args, canvasElement, userEvent }) => {
    await userEvent.click(getTrigger(canvasElement));
    await findDialog(canvasElement);
    await userEvent.click(day(canvasElement, '2026-10-12'));
    await userEvent.click(day(canvasElement, '2026-10-16'));
    await userEvent.click(dialogButton(canvasElement, 'Apply'));
    await expectClosed(canvasElement);
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith({ start: '2026-10-12', end: '2026-10-16' });
    await expect(getTrigger(canvasElement)).toHaveAccessibleName(
      `${LABEL} ${formattedRange({ start: '2026-10-12', end: '2026-10-16' })}`,
    );

    // An external value update never notifies.
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Next month week' }));
    await expect(getTrigger(canvasElement)).toHaveAccessibleName(
      `${LABEL} ${formattedRange({ start: '2026-11-02', end: '2026-11-06' })}`,
    );
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onOpenChange).toHaveBeenCalledTimes(2);
  },
};

function RebaseExample(props: ExampleProps) {
  const [value, setValue] = useState<DateRangeValue | null>(WEEK);
  return (
    <Stack>
      <RangeExample {...props} value={value} />
      <Button onClick={() => setValue({ start: '2026-10-19', end: '2026-10-23' })}>Next week</Button>
    </Stack>
  );
}
RebaseExample.displayName = 'RebaseExample';

/** A fixed `open` keeps the dialog while the parent replaces the value: the draft rebases silently. */
export const ExternalRebase: Story = {
  tags: ['!autodocs'],
  args: { open: true, months: 1, onValueChange: fn(), onOpenChange: fn() },
  render: (args) => <RebaseExample {...args} />,
  play: async ({ args, canvasElement, userEvent }) => {
    await findDialog(canvasElement);
    await userEvent.click(day(canvasElement, '2026-10-27'));
    await expectSelected(canvasElement, { start: '2026-10-27', end: '2026-10-27' });

    // The outside press requests a close that the fixed `open` rejects.
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Next week' }));
    await expect(args.onOpenChange).toHaveBeenCalledTimes(1);
    await expect(args.onOpenChange).toHaveBeenLastCalledWith(false);
    await expect(bodyOf(canvasElement).getByRole('dialog', { name: LABEL })).toBeVisible();
    // The new value replaced the draft and cleared the anchor, without a value request.
    await expectSelected(canvasElement, { start: '2026-10-19', end: '2026-10-23' });
    await userEvent.hover(day(canvasElement, '2026-10-29'));
    await expect(day(canvasElement, '2026-10-29')).not.toHaveAttribute('data-preview');
    await expect(args.onValueChange).not.toHaveBeenCalled();
  },
};

/** Fixed `value` and `open` reject Apply and every close: label, draft and focus stay. */
export const ControlledRejects: Story = {
  tags: ['!autodocs'],
  args: { value: WEEK, open: true, months: 1, onValueChange: fn(), onOpenChange: fn() },
  render: (args) => <RangeExample {...args} />,
  play: async ({ args, canvasElement, userEvent }) => {
    await findDialog(canvasElement);
    await expectDayFocused(canvasElement, WEEK.start);
    await userEvent.keyboard('{ArrowDown}{Enter}{ArrowDown}{Enter}');
    const draft = { start: '2026-10-12', end: '2026-10-19' };
    await expectSelected(canvasElement, draft);

    const apply = dialogButton(canvasElement, 'Apply');
    await userEvent.click(apply);
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith(draft);
    await expect(args.onOpenChange).toHaveBeenCalledTimes(1);
    await expect(args.onOpenChange).toHaveBeenLastCalledWith(false);
    await expect(bodyOf(canvasElement).getByRole('dialog', { name: LABEL })).toBeVisible();
    await expect(getTrigger(canvasElement)).toHaveAccessibleName(`${LABEL} ${formattedRange(WEEK)}`);
    await expectSelected(canvasElement, draft);
    await expect(canvasElement.ownerDocument.activeElement).toBe(apply);

    // A rejected Escape keeps the draft and the focus.
    await userEvent.keyboard('{Escape}');
    await expect(args.onOpenChange).toHaveBeenCalledTimes(2);
    await expectSelected(canvasElement, draft);
    await expect(canvasElement.ownerDocument.activeElement).toBe(apply);
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
  },
};

export const EscapeDiscards: Story = {
  args: { defaultValue: WEEK, months: 1, onValueChange: fn(), onOpenChange: fn() },
  render: (args) => <RangeExample {...args} />,
  play: async ({ args, canvasElement, userEvent }) => {
    await userEvent.tab();
    await userEvent.keyboard('{Enter}');
    await findDialog(canvasElement);
    await expectDayFocused(canvasElement, WEEK.start);
    await userEvent.keyboard('{PageDown}{Enter}{ArrowRight}{Enter}');
    await expectSelected(canvasElement, { start: '2026-11-05', end: '2026-11-06' });
    await userEvent.keyboard('{Escape}');
    await expectClosed(canvasElement);
    await expectFocused(canvasElement, () => getTrigger(canvasElement));
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await expect(args.onOpenChange).toHaveBeenCalledTimes(2);

    // The next open starts from the committed value again.
    await userEvent.keyboard('{ArrowDown}');
    await findDialog(canvasElement);
    await expectDayFocused(canvasElement, WEEK.start);
    await expectSelected(canvasElement, WEEK);
  },
};

export const SpaceAndEnter: Story = {
  args: { defaultValue: WEEK, months: 1, onValueChange: fn() },
  render: (args) => <RangeExample {...args} />,
  play: async ({ args, canvasElement, userEvent }) => {
    await userEvent.tab();
    // Space opens on keyup, so the keyup never activates the focused day.
    await userEvent.keyboard('[Space]');
    await findDialog(canvasElement);
    await expectDayFocused(canvasElement, WEEK.start);
    await expectSelected(canvasElement, WEEK);

    // Enter activates exactly once: the day is anchored, so the next focus previews.
    await userEvent.keyboard('{ArrowRight}{Enter}{ArrowRight}');
    await expectSelected(canvasElement, { start: '2026-10-06', end: '2026-10-06' });
    await expect(day(canvasElement, '2026-10-07')).toHaveAttribute('data-preview');
    // Space activates exactly once too: it finishes the range.
    await userEvent.keyboard('[Space]');
    await expectSelected(canvasElement, { start: '2026-10-06', end: '2026-10-07' });
    await expect(day(canvasElement, '2026-10-08')).not.toHaveAttribute('data-preview');
    await expect(args.onValueChange).not.toHaveBeenCalled();
  },
};

export const OutsideAndTabOut: Story = {
  args: { defaultValue: WEEK, months: 1, onValueChange: fn() },
  render: (args) => <RangeExample {...args} />,
  play: async ({ args, canvasElement, userEvent }) => {
    const { ownerDocument } = canvasElement;
    const outside = within(canvasElement).getByRole('button', { name: OUTSIDE });

    await userEvent.click(getTrigger(canvasElement));
    await findDialog(canvasElement);
    await userEvent.click(day(canvasElement, '2026-10-20'));
    await userEvent.click(outside);
    await expectClosed(canvasElement);
    // The press lands on its own target; the trigger is never focused.
    await expect(ownerDocument.activeElement).toBe(outside);

    // Tab walks the day, the actions, then leaves and closes without moving focus back.
    await userEvent.tab({ shift: true });
    await userEvent.keyboard('{ArrowDown}');
    await findDialog(canvasElement);
    await expectDayFocused(canvasElement, WEEK.start);
    await userEvent.tab();
    await expectFocused(canvasElement, () => dialogButton(canvasElement, 'Cancel'));
    await userEvent.tab();
    await expectFocused(canvasElement, () => dialogButton(canvasElement, 'Apply'));
    await expectFocusRing(dialogButton(canvasElement, 'Apply'));
    await userEvent.tab();
    await expectClosed(canvasElement);
    await expectFocused(canvasElement, () => outside);
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await expect(getTrigger(canvasElement)).toHaveAccessibleName(`${LABEL} ${formattedRange(WEEK)}`);
  },
};

export const CustomPresets: Story = {
  args: { presets: PRESETS, months: 1, onValueChange: fn() },
  render: (args) => <RangeExample {...args} />,
  play: async ({ args, canvasElement, userEvent }) => {
    await userEvent.click(getTrigger(canvasElement));
    const dialog = await findDialog(canvasElement);
    const group = within(dialog).getByRole('group', { name: rangeMessages.presets });
    const preset = (name: string) => within(group).getByRole('button', { name });
    const tabStops = within(group)
      .getAllByRole('button')
      .filter((button) => button.tabIndex === 0);
    await expect(tabStops).toEqual([preset('Today')]);

    // Shift+Tab from the day walks the month buttons back to the single preset tab stop.
    await expectDayFocused(canvasElement, TODAY);
    await userEvent.tab({ shift: true });
    await userEvent.tab({ shift: true });
    await userEvent.tab({ shift: true });
    await expectFocused(canvasElement, () => preset('Today'));
    await expectFocusRing(preset('Today'));

    // The one-month row moves with inline arrows, wraps, and supports Home/End.
    await userEvent.keyboard('{ArrowRight}');
    await expectFocused(canvasElement, () => preset('Yesterday'));
    await userEvent.keyboard('{ArrowLeft}{ArrowLeft}');
    await expectFocused(canvasElement, () => preset('Year to date'));
    await userEvent.keyboard('{Home}');
    await expectFocused(canvasElement, () => preset('Today'));
    await userEvent.keyboard('{End}');
    await expectFocused(canvasElement, () => preset('Year to date'));

    // Activation picks the draft only and reveals its start month.
    await userEvent.keyboard('{Home}{ArrowRight}{ArrowRight}{ArrowRight}{ArrowRight}{ArrowRight}{Enter}');
    await expectFocused(canvasElement, () => preset('Last month'));
    await expect(bodyOf(canvasElement).getByRole('grid', { name: monthName('2026-09') })).toBeVisible();
    await expectSelected(canvasElement, { start: '2026-09-01', end: '2026-09-30' });
    await expect(preset('Last month')).toHaveAttribute('aria-pressed', 'true');
    await expect(preset('This month')).toHaveAttribute('aria-pressed', 'false');
    await expect(args.onValueChange).not.toHaveBeenCalled();

    await userEvent.click(preset('Last 7 days'));
    await expect(bodyOf(canvasElement).getByRole('grid', { name: monthName('2026-10') })).toBeVisible();
    await expectSelected(canvasElement, { start: '2026-10-05', end: TODAY });
    await userEvent.click(dialogButton(canvasElement, 'Apply'));
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith({ start: '2026-10-05', end: TODAY });
  },
};

export const Bounds: Story = {
  args: { presets: PRESETS, months: 1, min: '2026-10-03', max: '2026-10-24', onValueChange: fn() },
  render: (args) => <RangeExample {...args} />,
  play: async ({ args, canvasElement, userEvent }) => {
    await userEvent.click(getTrigger(canvasElement));
    const dialog = await findDialog(canvasElement);
    const group = within(dialog).getByRole('group', { name: rangeMessages.presets });
    const preset = (name: string) => within(group).getByRole('button', { name });

    await expect(day(canvasElement, '2026-10-02')).toBeDisabled();
    await expect(day(canvasElement, '2026-10-25')).toBeDisabled();
    await expect(day(canvasElement, '2026-10-02').closest('td')).not.toHaveAttribute('aria-selected');

    // Moves clamp into min/max.
    await expectDayFocused(canvasElement, TODAY);
    await userEvent.keyboard('{PageDown}');
    await expectDayFocused(canvasElement, '2026-10-24');
    await userEvent.keyboard('{Shift>}{PageUp}{/Shift}');
    await expectDayFocused(canvasElement, '2026-10-03');

    // Out-of-bounds presets stay visible but unavailable; nothing is clamped into a partial range.
    await expect(preset('Last 30 days')).toHaveAttribute('aria-disabled', 'true');
    await expect(preset('This month')).toHaveAttribute('aria-disabled', 'true');
    await expect(preset('Last 7 days')).not.toHaveAttribute('aria-disabled');
    await userEvent.click(preset('Last 30 days'));
    await expectSelected(canvasElement, null);
    await userEvent.click(day(canvasElement, '2026-10-02'));
    await expectSelected(canvasElement, null);
    await expect(args.onValueChange).not.toHaveBeenCalled();
  },
};

export const ReversedBounds: Story = {
  args: { months: 1, min: '2026-10-20', max: '2026-10-10', defaultValue: WEEK, onValueChange: fn(), onOpenChange: fn() },
  render: (args) => <RangeExample {...args} />,
  play: async ({ args, canvasElement, userEvent }) => {
    const trigger = getTrigger(canvasElement);
    await expect(trigger).toHaveAttribute('aria-invalid', 'true');
    await expect(trigger).toHaveAccessibleDescription(String(rangeMessages.error));
    await userEvent.click(trigger);
    await findDialog(canvasElement);
    // No day is available: no day tab stop and no Apply.
    await expect(tabStopDays(canvasElement)).toHaveLength(0);
    await expect(day(canvasElement, '2026-10-15')).toBeDisabled();
    // The seeded draft lies outside the empty bounds.
    await expectSelected(canvasElement, WEEK);
    await expect(dialogButton(canvasElement, 'Apply')).toBeDisabled();
    await userEvent.click(dialogButton(canvasElement, 'Apply'));
    await expect(bodyOf(canvasElement).getByRole('dialog', { name: LABEL })).toBeVisible();
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await expect(args.onOpenChange).toHaveBeenCalledTimes(1);
    await userEvent.click(dialogButton(canvasElement, 'Cancel'));
    await expectClosed(canvasElement);
  },
};

function DynamicBoundsExample(props: ExampleProps) {
  const [min, setMin] = useState<string | undefined>(undefined);
  return (
    <Stack>
      <RangeExample {...props} min={min} />
      <Button onClick={() => setMin('2026-10-08')}>Restrict start</Button>
    </Stack>
  );
}
DynamicBoundsExample.displayName = 'DynamicBoundsExample';

/** Bounds that change under an open draft make it unavailable: Apply cannot commit it. */
export const DynamicBounds: Story = {
  tags: ['!autodocs'],
  args: { open: true, months: 1, onValueChange: fn(), onOpenChange: fn() },
  render: (args) => <DynamicBoundsExample {...args} />,
  play: async ({ args, canvasElement, userEvent }) => {
    await findDialog(canvasElement);
    await userEvent.click(day(canvasElement, '2026-10-05'));
    await userEvent.click(day(canvasElement, '2026-10-09'));
    await expectSelected(canvasElement, WEEK);
    await expect(dialogButton(canvasElement, 'Apply')).toBeEnabled();

    // The press outside is a rejected close; the new min excludes the draft's start.
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Restrict start' }));
    await expect(day(canvasElement, '2026-10-05')).toBeDisabled();
    await expect(dialogButton(canvasElement, 'Apply')).toBeDisabled();
    await userEvent.click(dialogButton(canvasElement, 'Apply'));
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await expect(args.onOpenChange).toHaveBeenCalledTimes(1);
    await expect(args.onOpenChange).toHaveBeenLastCalledWith(false);

    // A draft inside the new bounds applies.
    await userEvent.click(day(canvasElement, '2026-10-08'));
    await userEvent.click(day(canvasElement, '2026-10-09'));
    await userEvent.click(dialogButton(canvasElement, 'Apply'));
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith({ start: '2026-10-08', end: '2026-10-09' });
  },
};

export const InvalidValue: Story = {
  // Reversed endpoints are shown as empty and invalid, never swapped.
  args: { value: { start: '2026-10-09', end: '2026-10-05' }, months: 1, onValueChange: fn() },
  render: (args) => <RangeExample {...args} />,
  play: async ({ args, canvasElement, userEvent }) => {
    const trigger = getTrigger(canvasElement);
    await expect(trigger).toHaveAccessibleName(`${LABEL} ${PLACEHOLDER}`);
    await expect(trigger).toHaveAttribute('aria-invalid', 'true');
    const alert = within(canvasElement).getByRole('alert');
    await expect(alert).toHaveTextContent(String(rangeMessages.error));
    await expect(trigger.getAttribute('aria-describedby')).toBe(alert.id);
    await userEvent.click(trigger);
    await findDialog(canvasElement);
    await expectSelected(canvasElement, null);
    await expect(args.onValueChange).not.toHaveBeenCalled();
  },
};

export const Invalid: Story = {
  args: { months: 1 },
  render: (args) => <RangeExample {...args} trigger={{ 'aria-invalid': true }} />,
  play: async ({ canvasElement }) => {
    const trigger = getTrigger(canvasElement);
    await expect(trigger).toHaveAttribute('aria-invalid', 'true');
    await expect(trigger).toHaveAccessibleDescription(String(rangeMessages.error));
  },
};

export const OpenInvalid: Story = {
  ...Invalid,
  tags: ['!autodocs'],
  args: { ...Invalid.args, defaultOpen: true, presets: PRESETS },
  play: async ({ canvasElement }) => {
    // Persistent open error state for the axe gate.
    await findDialog(canvasElement);
    await expect(getTrigger(canvasElement)).toHaveAttribute('aria-invalid', 'true');
    await expect(within(canvasElement).getByRole('alert')).toHaveTextContent(String(rangeMessages.error));
  },
};

export const KeyboardTwoMonths: Story = {
  args: { months: 2, defaultValue: { start: '2026-10-28', end: '2026-10-30' } },
  render: (args) => <RangeExample {...args} />,
  play: async ({ canvasElement, userEvent }) => {
    const grid = (month: string) => bodyOf(canvasElement).getByRole('grid', { name: monthName(month) });
    await userEvent.click(getTrigger(canvasElement));
    await findDialog(canvasElement);
    await expect(grid('2026-10')).toHaveAttribute('aria-multiselectable', 'true');
    await expect(grid('2026-11')).toHaveAttribute('aria-multiselectable', 'true');
    await expectDayFocused(canvasElement, '2026-10-28');
    // One day tab stop across both months.
    await expect(tabStopDays(canvasElement)).toEqual([day(canvasElement, '2026-10-28')]);

    // A move into the other shown month focuses it there without sliding the months.
    await userEvent.keyboard('{ArrowDown}');
    await expectDayFocused(canvasElement, '2026-11-04');
    await expect(grid('2026-10')).toBeVisible();
    await expect(tabStopDays(canvasElement)).toEqual([day(canvasElement, '2026-11-04')]);
    await userEvent.keyboard('{ArrowUp}{ArrowRight}{ArrowRight}{ArrowRight}{ArrowRight}');
    await expectDayFocused(canvasElement, '2026-11-01');

    // Home/End: the en-GB week runs Monday to Sunday.
    await userEvent.keyboard('{Home}');
    await expectDayFocused(canvasElement, '2026-10-26');
    await userEvent.keyboard('{End}');
    await expectDayFocused(canvasElement, '2026-11-01');

    // Past the shown months the target is revealed.
    await userEvent.keyboard('{PageDown}{PageDown}');
    await expectDayFocused(canvasElement, '2027-01-01');
    await expect(grid('2026-12')).toBeVisible();
    await expect(grid('2027-01')).toBeVisible();
    await userEvent.keyboard('{Shift>}{PageUp}{/Shift}');
    await expectDayFocused(canvasElement, '2026-01-01');
    await expect(grid('2026-01')).toBeVisible();
    await expect(grid('2026-02')).toBeVisible();
    await expect(tabStopDays(canvasElement)).toHaveLength(1);

    // Header buttons move both months together.
    await userEvent.click(bodyOf(canvasElement).getAllByRole('button', { name: monthName('2026-03') })[0]!);
    await expect(grid('2026-02')).toBeVisible();
    await expect(grid('2026-03')).toBeVisible();
  },
};

export const LeapDay: Story = {
  args: { months: 1, defaultValue: { start: '2028-02-29', end: '2028-02-29' } },
  render: (args) => <RangeExample {...args} />,
  play: async ({ canvasElement, userEvent }) => {
    await userEvent.click(getTrigger(canvasElement));
    await findDialog(canvasElement);
    await expectDayFocused(canvasElement, '2028-02-29');
    await userEvent.keyboard('{Shift>}{PageDown}{/Shift}');
    await expectDayFocused(canvasElement, '2029-02-28');
    await userEvent.keyboard('{Shift>}{PageUp}{/Shift}');
    await expectDayFocused(canvasElement, '2028-02-28');
    await userEvent.keyboard('{ArrowRight}');
    await expectDayFocused(canvasElement, '2028-02-29');
    await userEvent.keyboard('{ArrowRight}');
    await expectDayFocused(canvasElement, '2028-03-01');
  },
};

export const TwoMonthsWithoutPresets: Story = {
  tags: ['!autodocs'],
  args: { months: 2, defaultOpen: true },
  render: (args) => <RangeExample {...args} />,
  play: async ({ canvasElement }) => {
    const dialog = await findDialog(canvasElement);
    await expect(within(dialog).getAllByRole('grid')).toHaveLength(2);
    const calendars = dialog.querySelector<HTMLElement>('[data-ui="date-range-picker-calendars"]')!;
    const footer = dialog.querySelector<HTMLElement>('[data-ui="date-range-picker-footer"]')!;
    await expect(footer.getBoundingClientRect().top).toBeGreaterThanOrEqual(
      calendars.getBoundingClientRect().bottom - PX_TOLERANCE,
    );
  },
};

export const MonthsOne: Story = {
  tags: ['!autodocs'],
  args: { months: 1, presets: PRESETS, defaultValue: WEEK, defaultOpen: true },
  render: (args) => <RangeExample {...args} />,
  play: async ({ canvasElement }) => {
    const dialog = await findDialog(canvasElement);
    await expect(within(dialog).getAllByRole('grid')).toHaveLength(1);
    await expect(dialog).toHaveAttribute('data-layout', 'row');
    const presets = within(dialog).getByRole('group', { name: rangeMessages.presets });
    await expect(presets.scrollWidth).toBeGreaterThan(presets.clientWidth);
  },
};

export const MonthsTwo: Story = {
  tags: ['!autodocs'],
  args: { months: 2, presets: PRESETS, defaultValue: WEEK, defaultOpen: true },
  render: (args) => <RangeExample {...args} />,
  play: async ({ canvasElement }) => {
    const dialog = await findDialog(canvasElement);
    await expect(within(dialog).getAllByRole('grid')).toHaveLength(2);
    await expect(dialog.scrollWidth).toBeLessThanOrEqual(dialog.clientWidth + PX_TOLERANCE);
    await expect(bodyOf(canvasElement).getByRole('grid', { name: monthName('2026-10') })).toBeVisible();
    await expect(bodyOf(canvasElement).getByRole('grid', { name: monthName('2026-11') })).toBeVisible();
  },
};

const BoundaryBox = styled.div({
  boxSizing: 'border-box',
  maxInlineSize: `calc(100vw - ${vars.space[8]})`,
  overflow: 'hidden',
  padding: vars.space[2],
  border: `1px dashed ${vars.color.borderControl}`,
});

function BoundaryExample({ inlineSize, blockSize = '640px', ...props }: ExampleProps & { inlineSize: string; blockSize?: string }) {
  const [boundary, setBoundary] = useState<HTMLDivElement | null>(null);
  return (
    <BoundaryBox ref={setBoundary} data-boundary="" style={{ inlineSize, blockSize }}>
      {boundary && <RangeExample {...props} boundary={boundary} />}
    </BoundaryBox>
  );
}
BoundaryExample.displayName = 'BoundaryExample';

/**
 * `months="auto"` reads the width Floating UI leaves inside the boundary. This story checks
 * the rule against the measured width; a wide viewport shows two months, a narrow one one.
 */
export const MonthsAuto: Story = {
  tags: ['!autodocs'],
  args: { defaultValue: WEEK, presets: PRESETS, defaultOpen: true },
  render: (args) => <BoundaryExample {...args} inlineSize="900px" />,
  play: async ({ canvasElement }) => {
    const dialog = await findDialog(canvasElement);
    const boundary = canvasElement.querySelector<HTMLElement>('[data-boundary]')!;
    const viewportWidth = canvasElement.ownerDocument.documentElement.clientWidth;
    const width = Math.min(boundary.getBoundingClientRect().width, viewportWidth);
    // Floating UI subtracts its 8px padding from both edges.
    const expected = width - 16 >= 712 ? 2 : 1;
    await waitFor(() => expect(within(dialog).getAllByRole('grid')).toHaveLength(expected));
  },
};

export const Narrow: Story = {
  tags: ['!autodocs'],
  args: { defaultValue: WEEK, presets: PRESETS, defaultOpen: true },
  render: (args) => <BoundaryExample {...args} inlineSize="360px" />,
  play: async ({ canvasElement }) => {
    const dialog = await findDialog(canvasElement);
    await waitFor(() => expect(within(dialog).getAllByRole('grid')).toHaveLength(1));
    await expect(dialog).toHaveAttribute('data-layout', 'row');
    // Presets scroll in their row; days keep their 32px minimum.
    await expect(day(canvasElement, WEEK.start).getBoundingClientRect().width).toBeGreaterThanOrEqual(32 - PX_TOLERANCE);
  },
};

/** Two forced months in a narrow boundary stack instead of shrinking the days. */
export const NarrowForcedTwoMonths: Story = {
  tags: ['!autodocs'],
  args: { defaultValue: WEEK, months: 2, defaultOpen: true },
  render: (args) => <BoundaryExample {...args} inlineSize="360px" />,
  play: async ({ canvasElement }) => {
    const dialog = await findDialog(canvasElement);
    const [first, second] = within(dialog).getAllByRole('grid');
    await waitFor(() =>
      expect(second!.getBoundingClientRect().top).toBeGreaterThanOrEqual(
        first!.getBoundingClientRect().bottom - PX_TOLERANCE,
      ),
    );
    await expect(day(canvasElement, WEEK.start).getBoundingClientRect().width).toBeGreaterThanOrEqual(32 - PX_TOLERANCE);
  },
};

export const NarrowTwoMonthsWithPresets: Story = {
  tags: ['!autodocs'],
  args: { defaultValue: WEEK, months: 2, presets: PRESETS, defaultOpen: true },
  render: (args) => <BoundaryExample {...args} inlineSize="360px" />,
  play: async ({ canvasElement, userEvent }) => {
    const dialog = await findDialog(canvasElement);
    await waitFor(() => expect(dialog).toHaveAttribute('data-layout', 'row'));
    await expect(dialog.scrollWidth).toBeLessThanOrEqual(dialog.clientWidth + PX_TOLERANCE);
    const [first, second] = within(dialog).getAllByRole('grid');
    await expect(second!.getBoundingClientRect().top).toBeGreaterThan(first!.getBoundingClientRect().bottom);
    const presets = within(dialog).getByRole('group', { name: rangeMessages.presets });
    await userEvent.click(within(presets).getByRole('button', { name: 'Today' }));
    await userEvent.keyboard('{End}');
    await expectFocused(canvasElement, () => within(presets).getByRole('button', { name: 'Year to date' }));
    await userEvent.keyboard('{Enter}');
    await userEvent.click(dialogButton(canvasElement, 'Apply'));
    await expect(getTrigger(canvasElement)).toHaveTextContent('1 Jan – 11 Oct 2026');
  },
};

export const LongLabels: Story = {
  tags: ['!autodocs'],
  args: {
    defaultValue: WEEK, months: 2, defaultOpen: true,
    presets: PRESETS.map((preset) => ({ ...preset, label: `${preset.label} — consolidated reporting period for all departments` })),
    messages: { ...rangeMessages, apply: 'Apply reporting period', cancel: 'Discard selected dates' },
  },
  render: (args) => <BoundaryExample {...args} inlineSize="900px" />,
  play: async ({ canvasElement }) => {
    const dialog = await findDialog(canvasElement);
    await waitFor(() => expect(dialog.scrollWidth).toBeLessThanOrEqual(dialog.clientWidth + PX_TOLERANCE));
    const group = within(dialog).getByRole('group', { name: rangeMessages.presets });
    for (const preset of within(group).getAllByRole('button')) {
      await expect(preset.getBoundingClientRect().width).toBeLessThanOrEqual(group.clientWidth + PX_TOLERANCE);
    }
    if (dialog.dataset.layout === 'rail') {
      await expect(group.scrollHeight).toBeGreaterThan(group.clientHeight);
    }
    for (const action of ['Apply reporting period', 'Discard selected dates']) {
      const button = dialogButton(canvasElement, action);
      await expect(button.scrollWidth).toBeLessThanOrEqual(button.clientWidth + PX_TOLERANCE);
      await expectTargetSize(button);
    }
  },
};

/** A short boundary caps the dialog height; the dialog scrolls internally. */
export const ShortViewport: Story = {
  tags: ['!autodocs'],
  args: { defaultValue: WEEK, months: 1, presets: PRESETS, defaultOpen: true },
  render: (args) => <BoundaryExample {...args} inlineSize="420px" blockSize="320px" />,
  play: async ({ canvasElement }) => {
    const dialog = await findDialog(canvasElement);
    const boundary = canvasElement.querySelector<HTMLElement>('[data-boundary]')!.getBoundingClientRect();
    await waitFor(() => expect(dialog.getBoundingClientRect().height).toBeLessThanOrEqual(boundary.height + PX_TOLERANCE));
    await settleMotion(dialog);
    await expect(getComputedStyle(dialog).overflowY).toBe('auto');
    await expect(dialog.scrollHeight).toBeGreaterThan(dialog.clientHeight);
    const trigger = getTrigger(canvasElement).getBoundingClientRect();
    const panel = dialog.getBoundingClientRect();
    const gap = dialog.dataset.side === 'bottom' ? panel.top - trigger.bottom : trigger.top - panel.bottom;
    await expect(gap).toBeCloseTo(ANCHOR_GAP, 0);
  },
};

export const Sizes: Story = {
  args: { defaultValue: WEEK },
  render: (args) => (
    <Stack>
      {(['sm', 'md', 'lg'] as const).map((size) => (
        <DateRangePicker key={size} {...args}>
          <DateRangePicker.Trigger aria-label={`${LABEL} ${size}`} size={size} />
          <DateRangePicker.Content />
        </DateRangePicker>
      ))}
    </Stack>
  ),
  play: async ({ canvasElement }) => {
    const minimums = { sm: 32, md: 40, lg: 48 };
    for (const [size, minimum] of Object.entries(minimums)) {
      const trigger = getTrigger(canvasElement, new RegExp(`^${LABEL} ${size}`));
      await expect(trigger).toHaveAttribute('data-size', size);
      await expect(trigger.getBoundingClientRect().height).toBeGreaterThanOrEqual(minimum - PX_TOLERANCE);
    }
  },
};

export const LongLocaleValue: Story = {
  // The trigger grows with the formatted text; no fixed width truncates it.
  args: { locale: 'ta-IN', defaultValue: { start: '2026-09-28', end: '2027-01-30' } },
  render: (args) => (
    <DateRangePicker {...args}>
      <DateRangePicker.Trigger aria-label={LABEL} />
      <DateRangePicker.Content />
    </DateRangePicker>
  ),
  play: async ({ canvasElement, userEvent }) => {
    const trigger = getTrigger(canvasElement);
    const text = trigger.querySelector<HTMLElement>('span')!;
    await expect(trigger.scrollWidth).toBeLessThanOrEqual(trigger.clientWidth + PX_TOLERANCE);
    await expect(text.getBoundingClientRect().right).toBeLessThanOrEqual(trigger.getBoundingClientRect().right + PX_TOLERANCE);
    await userEvent.click(trigger);
    const dialog = await findDialog(canvasElement);
    for (const grid of within(dialog).getAllByRole('grid')) {
      const columns = within(grid).getAllByRole('columnheader');
      for (const row of within(grid).getAllByRole('row')) {
        const cells = within(row).queryAllByRole('gridcell');
        for (const [index, cell] of cells.entries()) {
          const button = within(cell).queryByRole('button');
          if (button) await expectAligned([button, columns[index]!], 'center-x');
        }
      }
    }
  },
};

export const TargetSizes: Story = {
  tags: ['!autodocs'],
  args: { defaultValue: WEEK, months: 1, presets: PRESETS, defaultOpen: true },
  render: (args) => <RangeExample {...args} />,
  play: async ({ canvasElement }) => {
    const dialog = await findDialog(canvasElement);
    const targets = [
      day(canvasElement, WEEK.start),
      within(dialog).getByRole('button', { name: 'Today' }),
      dialogButton(canvasElement, 'Apply'),
      dialogButton(canvasElement, 'Cancel'),
      dialogButton(canvasElement, monthName('2026-11')),
    ];
    for (const target of targets) await expectTargetSize(target);
  },
};

export const ReadOnly: Story = {
  args: { defaultValue: WEEK, months: 1, readOnly: true, presets: PRESETS, onValueChange: fn() },
  render: (args) => <RangeExample {...args} />,
  play: async ({ args, canvasElement, userEvent }) => {
    const trigger = getTrigger(canvasElement);
    await expect(trigger).toHaveAttribute('data-readonly');
    await userEvent.click(trigger);
    const dialog = await findDialog(canvasElement);
    // Inspectable: navigation works, nothing changes.
    await expectDayFocused(canvasElement, WEEK.start);
    await userEvent.keyboard('{ArrowRight}');
    await expectDayFocused(canvasElement, '2026-10-06');
    await userEvent.keyboard('{Enter}');
    await expectSelected(canvasElement, WEEK);
    await expect(within(dialog).getByRole('button', { name: 'Today' })).toHaveAttribute('aria-disabled', 'true');
    await expect(dialogButton(canvasElement, 'Apply')).toBeDisabled();
    await userEvent.keyboard('{Escape}');
    await expectClosed(canvasElement);
    await expect(args.onValueChange).not.toHaveBeenCalled();
  },
};

export const Disabled: Story = {
  args: { defaultValue: WEEK, disabled: true, startName: START_FIELD, endName: END_FIELD, onOpenChange: fn() },
  render: (args) => (
    <form aria-label="Report" onSubmit={(event) => event.preventDefault()}>
      <RangeExample {...args} />
    </form>
  ),
  play: async ({ args, canvasElement, userEvent }) => {
    const form = within(canvasElement).getByRole('form', { name: 'Report' }) as HTMLFormElement;
    const trigger = getTrigger(canvasElement);
    await expect(trigger).toBeDisabled();
    await expect(new FormData(form).has(START_FIELD)).toBe(false);
    await expect(new FormData(form).has(END_FIELD)).toBe(false);
    await userEvent.click(trigger);
    await expect(bodyOf(canvasElement).queryByRole('dialog')).toBeNull();
    await expect(args.onOpenChange).not.toHaveBeenCalled();
  },
};

export const DisabledControlledOpen: Story = {
  tags: ['!autodocs'],
  args: { defaultValue: WEEK, disabled: true, open: true, onOpenChange: fn() },
  render: (args) => <RangeExample {...args} />,
  play: async ({ args, canvasElement, userEvent }) => {
    await expectClosed(canvasElement);
    // Disabled only hides the dialog: no open change is requested on the parent's behalf.
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    await expect(args.onOpenChange).not.toHaveBeenCalled();
    await userEvent.click(getTrigger(canvasElement));
    await expect(bodyOf(canvasElement).queryByRole('dialog')).toBeNull();
    await expect(args.onOpenChange).not.toHaveBeenCalled();
  },
};

const popoverOpenChange = fn<(open: boolean) => void>();

/** Inside a Popover the open picker is the topmost layer: outside presses and Escape reach it first. */
export const NestedInPopover: Story = {
  args: { defaultValue: WEEK, months: 1, onOpenChange: fn() },
  render: (args) => (
    <Stack>
      <Popover onOpenChange={popoverOpenChange}>
        <Popover.Trigger>Filters</Popover.Trigger>
        <Popover.Content aria-label="Filters">
          <DateRangePicker {...args}>
            <DateRangePicker.Trigger aria-label={LABEL} />
            <DateRangePicker.Content />
          </DateRangePicker>
        </Popover.Content>
      </Popover>
      <Button>{OUTSIDE}</Button>
    </Stack>
  ),
  play: async ({ args, canvasElement, userEvent }) => {
    popoverOpenChange.mockClear();
    const body = bodyOf(canvasElement);
    const outside = within(canvasElement).getByRole('button', { name: OUTSIDE });
    const openBoth = async () => {
      await userEvent.click(within(canvasElement).getByRole('button', { name: 'Filters' }));
      const popover = await body.findByRole('dialog', { name: 'Filters' });
      await userEvent.click(within(popover).getByRole('button', { name: new RegExp(`^${LABEL}`) }));
      await findDialog(canvasElement);
      return popover;
    };

    const popover = await openBoth();
    // A press inside the picker is not outside the popover.
    await userEvent.click(day(canvasElement, '2026-10-20'));
    await expect(popover).toBeVisible();

    await userEvent.click(outside);
    await waitFor(() => expect(body.queryByRole('dialog', { name: LABEL })).toBeNull());
    await expect(popover).toBeVisible();
    await expect(callValues(args.onOpenChange)).toEqual([true, false]);
    await expect(callValues(popoverOpenChange)).toEqual([true]);
    await userEvent.click(outside);
    await waitFor(() => expect(body.queryByRole('dialog', { name: 'Filters' })).toBeNull());
    await expect(callValues(popoverOpenChange)).toEqual([true, false]);

    // Escape from the picker's grid closes only the picker.
    const reopened = await openBoth();
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(body.queryByRole('dialog', { name: LABEL })).toBeNull());
    await expect(reopened).toBeVisible();
    await expectFocused(canvasElement, () => within(reopened).getByRole('button', { name: new RegExp(`^${LABEL}`) }));
    await expect(callValues(popoverOpenChange)).toEqual([true, false, true]);

    // An exiting picker is no longer a layer: the next Escape already reaches the popover.
    await userEvent.click(within(reopened).getByRole('button', { name: new RegExp(`^${LABEL}`) }));
    const exiting = await findDialog(canvasElement);
    await userEvent.keyboard('{Escape}');
    await expect(exiting).toHaveAttribute('data-state', 'closing');
    await userEvent.keyboard('{Escape}');
    await expect(callValues(popoverOpenChange)).toEqual([true, false, true, false]);
    await waitFor(() => expect(body.queryByRole('dialog', { name: 'Filters' })).toBeNull());
  },
};

export const Required: Story = {
  args: { required: true, months: 1 },
  render: (args) => <RangeExample {...args} />,
  play: async ({ canvasElement }) => {
    const trigger = getTrigger(canvasElement);
    await expect(trigger).toHaveAccessibleName(`${LABEL} ${PLACEHOLDER} ${rangeMessages.required}`);
    await expect(trigger).toHaveAttribute('data-required');
    await expect(trigger).not.toHaveAttribute('aria-required');
  },
};

export const FormFields: Story = {
  args: { defaultValue: WEEK, months: 1, startName: START_FIELD, endName: END_FIELD, onValueChange: fn() },
  render: (args) => (
    <form aria-label="Report" onSubmit={(event) => event.preventDefault()}>
      <RangeExample {...args} />
      <Button type="reset">Reset</Button>
    </form>
  ),
  play: async ({ args, canvasElement, userEvent }) => {
    const form = within(canvasElement).getByRole('form', { name: 'Report' }) as HTMLFormElement;
    await expect(new FormData(form).get(START_FIELD)).toBe(WEEK.start);
    await expect(new FormData(form).get(END_FIELD)).toBe(WEEK.end);

    await userEvent.click(getTrigger(canvasElement));
    await findDialog(canvasElement);
    await userEvent.click(day(canvasElement, '2026-10-19'));
    await userEvent.click(day(canvasElement, '2026-10-23'));
    await userEvent.click(dialogButton(canvasElement, 'Apply'));
    await expectClosed(canvasElement);
    await expect(new FormData(form).get(START_FIELD)).toBe('2026-10-19');
    await expect(new FormData(form).get(END_FIELD)).toBe('2026-10-23');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);

    // Native reset restores the uncontrolled default without a value request.
    const reset = within(canvasElement).getByRole('button', { name: 'Reset' });
    await expectTargetSize(reset);
    await userEvent.click(reset);
    await waitFor(() => expect(new FormData(form).get(START_FIELD)).toBe(WEEK.start));
    await expect(new FormData(form).get(END_FIELD)).toBe(WEEK.end);
    await expect(getTrigger(canvasElement)).toHaveAccessibleName(`${LABEL} ${formattedRange(WEEK)}`);
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
  },
};

function ExternalFormExample(props: ExampleProps) {
  const formId = useId();
  return (
    <Stack>
      <form id={formId} aria-label="Report" onSubmit={(event) => event.preventDefault()}>
        <Button type="reset">Reset</Button>
      </form>
      <RangeExample {...props} trigger={{ form: formId }} />
    </Stack>
  );
}
ExternalFormExample.displayName = 'ExternalFormExample';

export const ExternalFormFields: Story = {
  ...FormFields,
  render: (args) => <ExternalFormExample {...args} />,
};

export const ControlledFormReset: Story = {
  // A controlled reset only requests the default; the parent decides.
  args: { value: WEEK, defaultValue: null, startName: START_FIELD, onValueChange: fn() },
  render: (args) => (
    <form aria-label="Report" onSubmit={(event) => event.preventDefault()}>
      <RangeExample {...args} />
      <Button type="reset">Reset</Button>
    </form>
  ),
  play: async ({ args, canvasElement, userEvent }) => {
    const form = within(canvasElement).getByRole('form', { name: 'Report' }) as HTMLFormElement;
    const reset = within(canvasElement).getByRole('button', { name: 'Reset' });
    await expectTargetSize(reset);
    await userEvent.click(reset);
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith(null);
    await expect(new FormData(form).get(START_FIELD)).toBe(WEEK.start);
  },
};

/** Day and preset arrows run right to left: ArrowLeft moves forward. */
async function expectRtlArrows(canvasElement: HTMLElement, userEvent: { keyboard: (text: string) => Promise<void> }) {
  const dialog = await findDialog(canvasElement);
  await expect(getComputedStyle(within(dialog).getByRole('grid')).direction).toBe('rtl');
  await expectDayFocused(canvasElement, WEEK.start);
  await userEvent.keyboard('{ArrowLeft}');
  await expectDayFocused(canvasElement, '2026-10-06');
  await userEvent.keyboard('{ArrowRight}');
  await expectDayFocused(canvasElement, WEEK.start);

  const group = within(dialog).getByRole('group', { name: rangeMessages.presets });
  within(group).getByRole('button', { name: 'Today' }).focus();
  await userEvent.keyboard('{ArrowLeft}');
  await expectFocused(canvasElement, () => within(group).getByRole('button', { name: 'Yesterday' }));
  await userEvent.keyboard('{ArrowRight}');
  await expectFocused(canvasElement, () => within(group).getByRole('button', { name: 'Today' }));
}

/** Real RTL: the document direction reaches the trigger and the portaled dialog. */
export const RTL: Story = {
  tags: ['!autodocs'],
  args: { defaultValue: WEEK, months: 1, presets: PRESETS, defaultOpen: true },
  beforeEach: ({ canvasElement }) => {
    const { documentElement } = canvasElement.ownerDocument;
    const previous = documentElement.dir;
    documentElement.dir = 'rtl';
    return () => {
      documentElement.dir = previous;
    };
  },
  render: (args) => <RangeExample {...args} />,
  play: async ({ canvasElement, userEvent }) => {
    await expectRtlArrows(canvasElement, userEvent);
    const value = getTrigger(canvasElement).querySelector<HTMLElement>('span')!;
    await expect(getComputedStyle(value).direction).toBe('ltr');
    await expect(getComputedStyle(summary(canvasElement)).direction).toBe('ltr');
  },
};

/** An RTL subtree of an LTR document: the portaled dialog keeps the trigger's direction. */
export const SubtreeRTL: Story = {
  args: { defaultValue: WEEK, months: 1, presets: PRESETS },
  render: (args) => (
    <div dir="rtl">
      <RangeExample {...args} />
    </div>
  ),
  play: async ({ canvasElement, userEvent }) => {
    await expect(getComputedStyle(canvasElement.ownerDocument.documentElement).direction).toBe('ltr');
    await userEvent.click(getTrigger(canvasElement));
    await expect(await findDialog(canvasElement)).toHaveAttribute('dir', 'rtl');
    await expectRtlArrows(canvasElement, userEvent);
  },
};

/** `dir` on the trigger alone is carried into the dialog. */
export const TriggerDirRTL: Story = {
  args: { defaultValue: WEEK, months: 1, presets: PRESETS },
  render: (args) => <RangeExample {...args} trigger={{ dir: 'rtl' }} />,
  play: async ({ canvasElement, userEvent }) => {
    await userEvent.click(getTrigger(canvasElement));
    await expect(await findDialog(canvasElement)).toHaveAttribute('dir', 'rtl');
    await expectRtlArrows(canvasElement, userEvent);
  },
};

/** Initially open in an RTL subtree: the direction is read once the trigger is attached. */
export const SubtreeRTLInitiallyOpen: Story = {
  tags: ['!autodocs'],
  args: { defaultValue: WEEK, months: 1, presets: PRESETS, defaultOpen: true },
  render: (args) => (
    <div dir="rtl">
      <RangeExample {...args} />
    </div>
  ),
  play: async ({ canvasElement, userEvent }) => {
    await expect(getComputedStyle(canvasElement.ownerDocument.documentElement).direction).toBe('ltr');
    await expect(await findDialog(canvasElement)).toHaveAttribute('dir', 'rtl');
    await expectRtlArrows(canvasElement, userEvent);
  },
};

/** Controlled open on mount with `dir` on the trigger alone. */
export const TriggerDirRTLInitiallyOpen: Story = {
  tags: ['!autodocs'],
  args: { defaultValue: WEEK, months: 1, presets: PRESETS, open: true, onOpenChange: fn() },
  render: (args) => <RangeExample {...args} trigger={{ dir: 'rtl' }} />,
  play: async ({ args, canvasElement, userEvent }) => {
    await expect(await findDialog(canvasElement)).toHaveAttribute('dir', 'rtl');
    await expectRtlArrows(canvasElement, userEvent);
    await expect(args.onOpenChange).not.toHaveBeenCalled();
  },
};

/** An explicit `dir` on Content wins over the trigger's direction. */
export const ContentDirOverride: Story = {
  tags: ['!autodocs'],
  args: { defaultValue: WEEK, months: 1, defaultOpen: true },
  render: (args) => (
    <div dir="rtl">
      <RangeExample {...args} content={{ dir: 'ltr' }} />
    </div>
  ),
  play: async ({ canvasElement, userEvent }) => {
    const dialog = await findDialog(canvasElement);
    await expect(dialog).toHaveAttribute('dir', 'ltr');
    await expect(getComputedStyle(within(dialog).getByRole('grid')).direction).toBe('ltr');
    await expectDayFocused(canvasElement, WEEK.start);
    await userEvent.keyboard('{ArrowRight}');
    await expectDayFocused(canvasElement, '2026-10-06');
  },
};

export const LocaleWeekStart: Story = {
  tags: ['!autodocs'],
  args: { defaultValue: WEEK, months: 1, defaultOpen: true },
  render: (args) => <RangeExample {...args} />,
  play: async ({ canvasElement }) => {
    await findDialog(canvasElement);
    const headers = bodyOf(canvasElement).getAllByRole('columnheader');
    // en-GB weeks start on Monday.
    await expect(headers[0]).toHaveAttribute('abbr', 'Monday');
  },
};

export const SundayWeekStart: Story = {
  tags: ['!autodocs'],
  args: { defaultValue: WEEK, months: 1, defaultOpen: true, locale: 'en-US' },
  render: (args) => <RangeExample {...args} />,
  play: async ({ canvasElement, userEvent }) => {
    await findDialog(canvasElement);
    await expect(bodyOf(canvasElement).getAllByRole('columnheader')[0]).toHaveAttribute('abbr', 'Sunday');
    await userEvent.keyboard('{Home}');
    await expectFocused(canvasElement, () =>
      bodyOf(canvasElement).getByRole('button', { name: 'October 4, 2026' }),
    );
  },
};

export const SaturdayWeekStart: Story = {
  tags: ['!autodocs'],
  args: { defaultValue: WEEK, months: 1, defaultOpen: true, firstDayOfWeek: 6 },
  render: (args) => <RangeExample {...args} />,
  play: async ({ canvasElement, userEvent }) => {
    await findDialog(canvasElement);
    await expect(bodyOf(canvasElement).getAllByRole('columnheader')[0]).toHaveAttribute('abbr', 'Saturday');
    await userEvent.keyboard('{End}');
    await expectDayFocused(canvasElement, '2026-10-09');
  },
};

export const DraftPreview: Story = {
  tags: ['!autodocs'],
  args: { defaultValue: WEEK, months: 1, defaultOpen: true },
  render: (args) => <RangeExample {...args} />,
  play: async ({ canvasElement, userEvent }) => {
    // Ends anchored with a live preview so the axe gate sees the preview state.
    await findDialog(canvasElement);
    await expectDayFocused(canvasElement, WEEK.start);
    await userEvent.keyboard('{ArrowDown}{Enter}{ArrowDown}{ArrowRight}');
    await expectSelected(canvasElement, { start: '2026-10-12', end: '2026-10-12' });
    await expect(day(canvasElement, '2026-10-20')).toHaveAttribute('data-preview-end');
    await expect(summary(canvasElement)).toHaveTextContent(summaryText({ start: '2026-10-12', end: '2026-10-20' }, 9));
  },
};

export const PersistentOpen: Story = {
  tags: ['!autodocs'],
  args: { defaultValue: WEEK, months: 2, presets: PRESETS, defaultOpen: true },
  render: (args) => <RangeExample {...args} />,
  play: async ({ canvasElement }) => {
    const dialog = await findDialog(canvasElement);
    await settleMotion(dialog);
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute('aria-label', LABEL);
    await expect(dialog.getAttribute('aria-describedby')).toBe(summary(canvasElement).id);
    await expectDayFocused(canvasElement, WEEK.start);
  },
};

export const LightTheme: Story = {
  tags: ['!autodocs'],
  decorators: [withLightTheme],
  globals: { theme: 'light' },
  args: { defaultValue: WEEK, months: 1, presets: PRESETS, defaultOpen: true },
  render: (args) => <RangeExample {...args} />,
  play: async ({ canvasElement }) => {
    const dialog = await findDialog(canvasElement);
    await expectThemedSurface(dialog, 'light');
    await settleMotion(dialog);
  },
};

async function playMotion({ args, canvasElement, userEvent }: Parameters<NonNullable<Story['play']>>[0]) {
  await userEvent.click(getTrigger(canvasElement));
  const dialog = await bodyOf(canvasElement).findByRole('dialog', { name: LABEL });
  // Below the trigger: it slides down from it.
  await expect(dialog).toHaveAttribute('data-side', 'bottom');
  await expectEntranceMotion(dialog);
  await expect(getComputedStyle(dialog).translate).toBe('none');
  await expectDayFocused(canvasElement, WEEK.start);

  await userEvent.keyboard('{Escape}');
  // Accepted close: focus is back on the trigger at once while the inert surface fades out.
  await expectFocused(canvasElement, () => getTrigger(canvasElement));
  await expect(dialog).toHaveAttribute('data-state', 'closing');
  await expect(dialog).toHaveAttribute('inert');
  await expect(bodyOf(canvasElement).queryByRole('dialog')).toBeNull();
  await expectRetainedExit(dialog, () => !dialog.isConnected);
  await expect(callValues(args.onOpenChange)).toEqual([true, false]);
}

export const Motion: Story = {
  tags: ['!autodocs'],
  args: { defaultValue: WEEK, months: 1, onOpenChange: fn() },
  render: (args) => <RangeExample {...args} />,
  play: playMotion,
};

export const MotionLight: Story = {
  tags: ['!autodocs'],
  decorators: [withLightTheme],
  globals: { theme: 'light' },
  args: { defaultValue: WEEK, months: 1, onOpenChange: fn() },
  render: (args) => <RangeExample {...args} />,
  play: playMotion,
};

function ScopedHost({ children }: { children: ReactNode }) {
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  return (
    <LightScope portalContainer={host}>
      {children}
      <div ref={setHost} data-overlay-host="" />
    </LightScope>
  );
}
ScopedHost.displayName = 'ScopedHost';

export const ThemeRootPortal: Story = {
  tags: ['!autodocs'],
  args: { defaultValue: WEEK, months: 1, defaultOpen: true },
  render: (args) => (
    <ScopedHost>
      <RangeExample {...args} />
    </ScopedHost>
  ),
  play: async ({ canvasElement }) => {
    const dialog = await findDialog(canvasElement);
    // Portaled into the scope's host, keeping the nearest ThemeRoot's theme.
    await expect(canvasElement.querySelector('[data-overlay-host]')!.contains(dialog)).toBe(true);
    await expectThemedSurface(dialog, 'light');
  },
};

export const AriaMerge: Story = {
  tags: ['!autodocs'],
  args: { defaultValue: WEEK, months: 1, defaultOpen: true },
  render: (args) => (
    <Stack>
      <span id="period-label">Billing period</span>
      <span id="period-help">Invoices use UTC dates</span>
      <DateRangePicker {...args}>
        <DateRangePicker.Trigger
          aria-labelledby="period-label"
          aria-describedby="period-help missing-id"
          aria-invalid
        />
        <DateRangePicker.Content aria-describedby="period-help" />
      </DateRangePicker>
    </Stack>
  ),
  play: async ({ canvasElement }) => {
    const trigger = within(canvasElement).getByRole('button', { name: /^Billing period/ });
    const valueId = trigger.querySelector('span')!.id;
    const alert = within(canvasElement).getByRole('alert');
    await expect(trigger).toHaveAttribute('aria-labelledby', `period-label ${valueId}`);
    // Consumer ids (resolved or not) are kept; the error id is appended.
    await expect(trigger).toHaveAttribute('aria-describedby', `period-help missing-id ${alert.id}`);
    await expect(trigger).toHaveAccessibleName(`Billing period ${formattedRange(WEEK)}`);

    // The dialog inherits the trigger's label and merges its description with the summary.
    const dialog = await findDialog(canvasElement, 'Billing period');
    await expect(dialog).toHaveAttribute('aria-labelledby', 'period-label');
    await expect(dialog).not.toHaveAttribute('aria-label');
    await expect(dialog).toHaveAttribute('aria-describedby', `period-help ${summary(canvasElement).id}`);
  },
};

export const ContentLabel: Story = {
  tags: ['!autodocs'],
  args: { defaultValue: WEEK, months: 1, defaultOpen: true },
  render: (args) => (
    <DateRangePicker {...args}>
      <DateRangePicker.Trigger aria-label={LABEL} />
      <DateRangePicker.Content aria-label="Pick the billing period" />
    </DateRangePicker>
  ),
  play: async ({ canvasElement }) => {
    const dialog = await findDialog(canvasElement, 'Pick the billing period');
    await expect(dialog).not.toHaveAttribute('aria-labelledby');
  },
};

export const FalsyContent: Story = {
  args: { messages: { ...rangeMessages, error: 0, required: '' }, required: true },
  render: (args) => (
    <Stack>
      {FALSY_NODES.map((node, index) => (
        <DateRangePicker key={`placeholder-${index}`} {...args}>
          <DateRangePicker.Trigger aria-label={`Placeholder ${index}`} placeholder={node} />
          <DateRangePicker.Content />
        </DateRangePicker>
      ))}
      {FALSY_NODES.map((node, index) => (
        <DateRangePicker key={`icon-${index}`} {...args}>
          <DateRangePicker.Trigger aria-label={`Icon ${index}`} placeholder="" icon={node} />
          <DateRangePicker.Content />
        </DateRangePicker>
      ))}
      <DateRangePicker {...args} messages={{ ...rangeMessages, error: false }}>
        <DateRangePicker.Trigger aria-label="No error" aria-invalid />
        <DateRangePicker.Content />
      </DateRangePicker>
    </Stack>
  ),
  play: async ({ canvasElement }) => {
    const triggers = (prefix: string) =>
      FALSY_NODES.map((_, index) => getTrigger(canvasElement, new RegExp(`^${prefix} ${index}`)));
    const placeholders = triggers('Placeholder');
    const icons = triggers('Icon');
    // 0 renders; '', false and null render no text.
    await expect(placeholders[0]!.querySelector('[data-placeholder]')).toHaveTextContent('0');
    for (const trigger of placeholders.slice(1)) {
      await expect(trigger.querySelector('[data-placeholder]')).toHaveTextContent('');
    }
    // The icon wrapper exists for renderable nodes (0 and '') only.
    await expect(icons[0]!.querySelector('[aria-hidden="true"]')).toHaveTextContent('0');
    await expect(icons[1]!.querySelector('[aria-hidden="true"]')).not.toBeNull();
    for (const trigger of icons.slice(2)) {
      await expect(trigger.querySelector('[aria-hidden="true"]')).toBeNull();
    }
    // Every name reference resolves, whatever the content.
    for (const trigger of [...placeholders, ...icons]) {
      const ids = trigger.getAttribute('aria-labelledby')!.split(' ');
      for (const id of ids) await expect(canvasElement.ownerDocument.getElementById(id)).not.toBeNull();
    }
    // A falsy error renders no alert and no description.
    const noError = getTrigger(canvasElement, /^No error/);
    await expect(noError).toHaveAttribute('aria-invalid', 'true');
    await expect(noError).not.toHaveAttribute('aria-describedby');
    // error: 0 is renderable, but none of the other triggers is invalid.
    await expect(within(canvasElement).queryAllByRole('alert')).toHaveLength(0);
  },
};

export const UniqueIds: Story = {
  args: { defaultValue: WEEK, months: 1 },
  render: (args) => (
    <Stack>
      <DateRangePicker {...args}>
        <DateRangePicker.Trigger aria-label="First period" />
        <DateRangePicker.Content />
      </DateRangePicker>
      <DateRangePicker {...args}>
        <DateRangePicker.Trigger aria-label="Second period" />
        <DateRangePicker.Content />
      </DateRangePicker>
    </Stack>
  ),
  play: async ({ canvasElement }) => {
    const first = getTrigger(canvasElement, /^First period/);
    const second = getTrigger(canvasElement, /^Second period/);
    await expect(first.id).not.toBe(second.id);
    await expect(first.getAttribute('aria-labelledby')).not.toBe(second.getAttribute('aria-labelledby'));
    const ids = Array.from(canvasElement.querySelectorAll('[id]'), (element) => element.id);
    await expect(new Set(ids).size).toBe(ids.length);
  },
};

function CustomRangePart(props: ComponentPropsWithRef<'div'>) {
  return <div {...props} data-replaced="range-part" />;
}

function CustomRangeSummary(props: ComponentPropsWithRef<'span'>) {
  return <span {...props} data-replaced="range-summary" />;
}

const StyledRangeTrigger = styled(DateRangePicker.Trigger)({ textTransform: 'lowercase', letterSpacing: '1px' });

export const RefsAndStyling: Story = {
  tags: ['!autodocs'],
  args: { defaultValue: WEEK, months: 1, defaultOpen: true },
  render: (args) => (
    <DateRangePicker {...args}>
      <StyledRangeTrigger
        aria-label={LABEL}
        ref={triggerRef}
        sx={{ textTransform: 'uppercase' }}
      />
      <DateRangePicker.Content
        ref={contentRef}
        slots={{ presets: CustomRangePart, calendars: CustomRangePart, summary: CustomRangeSummary, actions: CustomRangePart }}
        sx={{ letterSpacing: '1px' }}
        slotProps={{ summary: { className: 'summary-slot', css: { textTransform: 'uppercase' } } }}
      />
    </DateRangePicker>
  ),
  play: async ({ canvasElement }) => {
    const trigger = getTrigger(canvasElement);
    const dialog = await findDialog(canvasElement);
    await expect(triggerRef).toHaveBeenCalledWith(trigger);
    await expect(contentRef).toHaveBeenCalledWith(dialog);
    await expect(DateRangePicker.Trigger.displayName).toBe('DateRangePicker.Trigger');
    await expect(DateRangePicker.Content.displayName).toBe('DateRangePicker.Content');
    await expect(DateRangePicker.displayName).toBe('DateRangePicker');
    await expect(getComputedStyle(trigger).textTransform).toBe('uppercase');
    await expect(parseFloat(getComputedStyle(trigger).letterSpacing)).toBeCloseTo(1, 1);
    await expect(parseFloat(getComputedStyle(dialog).letterSpacing)).toBeCloseTo(1, 1);
    const status = summary(canvasElement);
    await expect(status).toHaveAttribute('data-replaced', 'range-summary');
    for (const part of ['calendars', 'actions']) {
      const element = dialog.querySelector(`[data-ui="date-range-picker-${part}"]`)!;
      await expect(element).toHaveAttribute('data-replaced', 'range-part');
      await expect(element.className).not.toBe('');
    }
    await expect(status).toHaveClass('summary-slot');
    await expect(getComputedStyle(status).textTransform).toBe('uppercase');
  },
};
