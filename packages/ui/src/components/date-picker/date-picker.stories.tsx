import type { ComponentPropsWithRef, CSSProperties } from 'react';
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { withLightTheme } from '../../testing/story-decorators';
import { expectThemedSurface } from '../../testing/theme-assertions';
import { Button } from '../button';
import { Popover } from '../popover';
import { TextField, type TextFieldProps } from '../text-field';
import { DatePicker, type DatePickerCompoundProps as DatePickerProps, type DatePickerEasyProps } from './index';

const LABEL = 'Departure';
const LOCALE = 'en-US';
const OUTSIDE = 'After';
const FIELD_NAME = 'departure';

export const NestedDismissal: StoryObj = {
  tags: ['!autodocs'],
  render: () => (
    <>
      <Popover defaultOpen>
        <Popover.Trigger>Parent</Popover.Trigger>
        <Popover.Content aria-label="Parent">
          <DatePicker label="Nested date" defaultValue="2026-10-18" locale={LOCALE} />
        </Popover.Content>
      </Popover>
      <Button>Outside</Button>
    </>
  ),
  play: async ({ canvasElement, userEvent }) => {
    const body = within(canvasElement.ownerDocument.body);
    const parent = body.getByRole('dialog', { name: 'Parent' });
    const input = within(parent).getByRole('combobox', { name: 'Nested date' });
    input.focus();
    await userEvent.keyboard('{ArrowDown}');
    await body.findByRole('grid');
    await userEvent.keyboard('{ArrowRight}{Escape}');
    await waitFor(() => expect(body.queryByRole('grid')).toBeNull());
    await expect(parent).toBeVisible();
    await expect(input).toHaveFocus();
    await userEvent.keyboard('{ArrowDown}');
    await body.findByRole('grid');
    const outside = body.getByRole('button', { name: 'Outside' });
    await userEvent.click(outside);
    await waitFor(() => expect(body.queryByRole('grid')).toBeNull());
    await expect(parent).toBeVisible();
    await expect(outside).toHaveFocus();
  },
};
const DISPLAY_FORMAT = new Intl.DateTimeFormat(LOCALE, { dateStyle: 'medium', calendar: 'gregory', timeZone: 'UTC' });

const stackStyle = {
  display: 'grid',
  gap: vars.space[4],
  inlineSize: '320px',
} satisfies CSSProperties;

const meta: Meta<DatePickerProps> = {
  title: 'Inputs/DatePicker',
  component: DatePicker,
  args: { locale: LOCALE },
  parameters: {
    docs: {
      description: { component: 'Choose a date from a calendar.' },
      sections: [
        { title: 'Basic', stories: ['Default', 'Compound', 'EasyControlled'] },
        { title: 'Constraints', stories: ['MinMax'] },
        { title: 'States', stories: ['Disabled'] },
        { title: 'Forms', stories: ['FormValue'] },
        { title: 'Keyboard', stories: ['TabNavigation'] },
      ],
      usage: `### When to use
Choose a single calendar date, such as a departure or appointment day. The field is read-only; select from the calendar rather than typing.

### Values and limits
Dates are Gregorian date-only \`YYYY-MM-DD\` strings, without a time zone. Supply the same locale on the server and client. Bounds are inclusive and prevent new selections, but do not rewrite an initial or controlled date outside the interval.
Selecting a date requests a value change before requesting closure; rejecting one request does not reject the other.

### Keyboard
- Click the input or press Enter, Down or Space to open and focus a day. Use the Calendar arrow, Home, End and Page Up/Page Down keys to navigate, then Enter or Space to select.
- Selection or Escape returns focus to the input once the popup closes. Tabbing out or pressing outside closes without returning focus. Reopening discards month navigation and starts on the selected month, or the current month, within the bounds.

### Forms and accessibility
Empty fields submit an empty string; disabled fields are omitted. Native required validation does not validate a read-only input; validate selection in your form.
Give the field a text label. With a non-string compound label, supply an explicit accessible name so the open popup keeps its name.`,
    },
    // Floating UI's focus guards are aria-hidden spans with tabindex=0 that forward focus
    // immediately; axe flags them as aria-hidden-focus (known false positive). Every other
    // aria-hidden element is still checked.
    a11y: {
      config: {
        rules: [{ id: 'aria-hidden-focus', selector: '[aria-hidden="true"]:not([data-floating-ui-focus-guard])' }],
      },
    },
  },
};

export default meta;

type Story = StoryObj<typeof meta>;

export const EdgeGeometry: StoryObj<DatePickerEasyProps> = {
  tags: ['!autodocs'],
  args: {
    label: 'Departure date for the selected journey and all connecting flights',
    defaultValue: '2026-10-12',
    defaultOpen: true,
    locale: LOCALE,
  },
  render: (args) => (
    <div style={{ position: 'fixed', insetInlineEnd: vars.space[4], insetBlockEnd: vars.space[4], inlineSize: 'min(320px, calc(100% - 2rem))' }}>
      <DatePicker {...args} />
    </div>
  ),
  play: async ({ canvasElement, userEvent }) => {
    const page = bodyOf(canvasElement);
    const popup = await page.findByRole('dialog');
    const input = within(canvasElement).getByRole('combobox');
    await waitFor(() => {
      const box = popup.getBoundingClientRect();
      const anchor = input.getBoundingClientRect();
      expect(box.left).toBeGreaterThanOrEqual(0);
      expect(box.right).toBeLessThanOrEqual(canvasElement.ownerDocument.documentElement.clientWidth);
      expect(box.top).toBeGreaterThanOrEqual(0);
      expect(Math.abs(anchor.top - box.bottom - 8)).toBeLessThanOrEqual(1);
    });
    for (const day of popup.querySelectorAll('[data-ui="calendar-day"]')) {
      await expect(day.getBoundingClientRect().width).toBeGreaterThanOrEqual(24);
      await expect(day.getBoundingClientRect().height).toBeGreaterThanOrEqual(32);
    }
    await userEvent.keyboard('{ArrowRight}{Escape}');
    await waitFor(() => expect(page.queryByRole('dialog')).toBeNull());
    await expect(input).toHaveFocus();
  },
};

export const RTL: StoryObj<DatePickerEasyProps> = {
  tags: ['!autodocs'],
  args: { label: 'تاريخ المغادرة', locale: 'ar-EG', defaultValue: '2026-10-12' },
  render: (args) => <div dir="rtl"><DatePicker {...args} /></div>,
  play: async ({ canvasElement, userEvent }) => {
    const input = within(canvasElement).getByRole('combobox');
    await userEvent.click(input);
    const popup = await bodyOf(canvasElement).findByRole('dialog');
    await waitFor(() => expect(getComputedStyle(popup).direction).toBe('rtl'));
    const focused = canvasElement.ownerDocument.activeElement as HTMLElement;
    const date = focused.dataset.date!;
    await userEvent.keyboard('{ArrowLeft}');
    const next = canvasElement.ownerDocument.activeElement as HTMLElement;
    await expect(next.dataset.date! > date).toBe(true);
    await expect(next.getBoundingClientRect().left).toBeLessThan(focused.getBoundingClientRect().left);
  },
};

type CheckedDatePicker<Props extends import('./index').DatePickerProps> = Props;
export type DatePickerTypeRegression = {
  // @ts-expect-error The non-DOM provider root has no component sugar.
  providerComponent: DatePickerEasyProps['component'];
  // @ts-expect-error The field and portaled popup have separate replacement seams.
  providerRootSlot: NonNullable<DatePickerEasyProps['slots']>['root'];
  // @ts-expect-error The provider has no root element to receive native props.
  providerRootProps: NonNullable<DatePickerEasyProps['slotProps']>['root'];
  // @ts-expect-error Easy label and compound children are mutually exclusive.
  mixed: CheckedDatePicker<{ label: string; children: string }>;
  // @ts-expect-error Generated-part props require the easy label.
  incomplete: CheckedDatePicker<{ slotProps: { input: { description: string } } }>;
  // @ts-expect-error Compound mode rejects generated-part props.
  compoundSlots: CheckedDatePicker<{ children: string; slotProps: { popup: { className: string } } }>;
};

function EasyControlledDatePicker(props: DatePickerEasyProps) {
  const [value, setValue] = useState('2026-10-12');
  const [open, setOpen] = useState(false);
  return <DatePicker {...props} value={value} open={open}
    onValueChange={(next) => { setValue(next); props.onValueChange?.(next); }}
    onOpenChange={(next) => { setOpen(next); props.onOpenChange?.(next); }} />;
}
EasyControlledDatePicker.displayName = 'EasyControlledDatePicker';

function DateFieldReplacement(props: TextFieldProps) {
  return <TextField {...props} data-generated-field="" />;
}
DateFieldReplacement.displayName = 'DateFieldReplacement';

function DatePopupRoot(props: ComponentPropsWithRef<'div'>) {
  return <div {...props} data-generated-popup="" />;
}
DatePopupRoot.displayName = 'DatePopupRoot';

function DatePickerExample(props: DatePickerProps) {
  return (
    <div style={stackStyle}>
      <DatePicker {...props}>
        <DatePicker.Input label={LABEL} />
        <DatePicker.Popup />
      </DatePicker>
      <Button>{OUTSIDE}</Button>
    </div>
  );
}
DatePickerExample.displayName = 'DatePickerExample';

/** The input shows the date as Intl formats it, e.g. "Oct 13, 2026". */
function formatted(iso: string) {
  const [year = 0, month = 1, day = 1] = iso.split('-').map(Number);
  return DISPLAY_FORMAT.format(new Date(Date.UTC(year, month - 1, day)));
}

/** Portaled content lives in the story document's body, outside the canvas. */
function bodyOf(canvasElement: HTMLElement) {
  return within(canvasElement.ownerDocument.body);
}

function getInput(canvasElement: HTMLElement) {
  return within(canvasElement).getByRole('combobox', { name: LABEL }) as HTMLInputElement;
}

function day(canvasElement: HTMLElement, name: string) {
  return bodyOf(canvasElement).getByRole('button', { name });
}

async function expectFocused(canvasElement: HTMLElement, element: () => HTMLElement) {
  await waitFor(() => expect(canvasElement.ownerDocument.activeElement).toBe(element()));
}

async function expectDayFocused(canvasElement: HTMLElement, name: string) {
  await expectFocused(canvasElement, () => day(canvasElement, name));
}

async function expectMonth(canvasElement: HTMLElement, name: string) {
  await expect(bodyOf(canvasElement).getByRole('grid', { name })).toBeVisible();
}

async function expectClosed(canvasElement: HTMLElement) {
  await waitFor(() => expect(bodyOf(canvasElement).queryByRole('dialog')).toBeNull());
  const input = getInput(canvasElement);
  await expect(input).toHaveAttribute('aria-expanded', 'false');
  await expect(input).not.toHaveAttribute('aria-controls');
}

async function focusInput(canvasElement: HTMLElement) {
  const input = getInput(canvasElement);
  await userEvent.tab();
  await expect(canvasElement.ownerDocument.activeElement).toBe(input);
  return input;
}

export const Default: StoryObj<DatePickerEasyProps> = {
  name: 'Choose a date',
  args: { label: LABEL, locale: LOCALE, defaultValue: '2026-10-12', onValueChange: fn() },
  render: (args) => <DatePicker {...args} />,
  parameters: { docs: {
    description: { story: 'Open the calendar and choose a departure date.' },
    source: { language: 'tsx', code: `import { DatePicker } from '@jfrader/ui';

<DatePicker label="Departure" locale="en-US" defaultValue="2026-10-12" />` },
  } },
  play: async ({ args, canvasElement, userEvent }) => {
    const input = getInput(canvasElement);
    await expect(input).toHaveValue(formatted('2026-10-12'));
    await userEvent.tab();
    await userEvent.keyboard('{ArrowDown}');
    await bodyOf(canvasElement).findByRole('dialog', { name: LABEL });
    await expectDayFocused(canvasElement, 'October 12, 2026');
    await userEvent.keyboard('{ArrowRight}{Enter}');
    await expectClosed(canvasElement);
    await expect(input).toHaveValue(formatted('2026-10-13'));
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith('2026-10-13');
    await expect(canvasElement.ownerDocument.activeElement).toBe(input);
  },
};

/** Assemble the date field and popup for a custom layout. */
export const Compound: Story = {
  name: 'Compose the field and calendar',
  args: { defaultValue: '2026-10-12', onValueChange: fn(), onOpenChange: fn() },
  render: (args) => <DatePickerExample {...args} />,
  parameters: {
    docs: {
      description: { story: 'Place the input and popup explicitly when composing a date field.' },
      source: {
        language: 'tsx',
        code: `import { Button, DatePicker } from '@jfrader/ui';

<>
  <DatePicker locale="en-US" defaultValue="2026-10-12">
    <DatePicker.Input label="Departure" />
    <DatePicker.Popup />
  </DatePicker>
  <Button>After</Button>
</>`,
      },
    },
  },
  play: async ({ args, canvasElement }) => {
    const input = getInput(canvasElement);
    await expect(input.tagName).toBe('INPUT');
    await expect(input).toHaveAttribute('readonly');
    await expect(input).toHaveAttribute('aria-haspopup', 'dialog');
    await expect(input).toHaveAttribute('aria-expanded', 'false');
    await expect(input).not.toHaveAttribute('aria-controls');
    await expect(input).toHaveValue(formatted('2026-10-12'));

    await focusInput(canvasElement);
    await expect(getComputedStyle(input).outlineStyle).not.toBe('none');

    // ArrowDown opens the dialog, named by the input's label, and focuses the selected day.
    await userEvent.keyboard('{ArrowDown}');
    const dialog = await bodyOf(canvasElement).findByRole('dialog', { name: LABEL });
    await expect(canvasElement.contains(dialog)).toBe(false);
    await expect(input).toHaveAttribute('aria-expanded', 'true');
    await expect(input).toHaveAttribute('aria-controls', dialog.id);
    await expectMonth(canvasElement, 'October 2026');
    await expectDayFocused(canvasElement, 'October 12, 2026');
    await expect(args.onOpenChange).toHaveBeenLastCalledWith(true);

    // Arrows move within the grid; Enter commits once, closes and returns focus to the input.
    await userEvent.keyboard('{ArrowRight}');
    await expectDayFocused(canvasElement, 'October 13, 2026');
    await expect(getComputedStyle(day(canvasElement, 'October 13, 2026')).outlineStyle).not.toBe('none');
    await userEvent.keyboard('{Enter}');
    await expectClosed(canvasElement);
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith('2026-10-13');
    await waitFor(() => expect(input).toHaveValue(formatted('2026-10-13')));
    await expectFocused(canvasElement, () => getInput(canvasElement));

    // Space opens on keyup: its keyup never activates the newly focused day.
    await userEvent.keyboard('[Space]');
    await bodyOf(canvasElement).findByRole('dialog', { name: LABEL });
    await expectDayFocused(canvasElement, 'October 13, 2026');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);

    // Re-selecting the selected day closes without a value request.
    await userEvent.keyboard('{Enter}');
    await expectClosed(canvasElement);
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expectFocused(canvasElement, () => getInput(canvasElement));

    // Enter on the input opens too and focuses the selected day.
    await userEvent.keyboard('{Enter}');
    await bodyOf(canvasElement).findByRole('dialog', { name: LABEL });
    await expectDayFocused(canvasElement, 'October 13, 2026');
    await userEvent.keyboard('{Escape}');
    await expectClosed(canvasElement);
  },
};

/** Set props on the generated input and popup. */
export const CustomParts: StoryObj<DatePickerEasyProps> = {
  args: {
    label: LABEL, locale: LOCALE, defaultValue: '2026-10-12',
    slots: { input: DateFieldReplacement, popup: DatePopupRoot },
    slotProps: { input: { description: 'Travel date', className: 'departure-field', ref: fn() }, popup: { className: 'departure-calendar', ref: fn() } },
  },
  render: (args) => <DatePicker {...args} />,
  parameters: { docs: { source: { code: `<DatePicker label="Departure" locale="en-US"
  slotProps={{ input: { description: 'Travel date' }, popup: { className: 'departure-calendar' } }} />` } } },
  play: async ({ args, canvasElement, userEvent }) => {
    const input = getInput(canvasElement);
    await expect(input).toHaveAccessibleDescription('Travel date');
    await expect(input).toHaveAttribute('data-generated-field');
    await expect(args.slotProps?.input?.ref).toHaveBeenLastCalledWith(input);
    await userEvent.click(input);
    const dialog = await bodyOf(canvasElement).findByRole('dialog', { name: LABEL });
    await expect(dialog).toHaveClass('departure-calendar');
    await expect(dialog).toHaveAttribute('data-generated-popup');
    await expect(args.slotProps?.popup?.ref).toHaveBeenLastCalledWith(dialog);
    await userEvent.keyboard('{Escape}');
    await expectClosed(canvasElement);
  },
};

export const EasyDisabled: StoryObj<DatePickerEasyProps> = {
  tags: ['!autodocs'],
  args: { label: LABEL, locale: LOCALE, disabled: true, open: true },
  render: (args) => <DatePicker {...args} />,
  play: async ({ canvasElement, userEvent }) => {
    await expect(getInput(canvasElement)).toBeDisabled();
    await userEvent.click(getInput(canvasElement));
    await expect(bodyOf(canvasElement).queryByRole('dialog')).toBeNull();
  },
};

export const EasyControlled: StoryObj<DatePickerEasyProps> = {
  name: 'Control the selected date',
  parameters: { docs: {
    description: { story: 'Keep the date and popup visibility in React state.' },
    source: { language: 'tsx', code: `import { useState } from 'react';
import { DatePicker } from '@jfrader/ui';

export function DepartureDate() {
  const [value, setValue] = useState('2026-10-12');
  const [open, setOpen] = useState(false);
  return <DatePicker label="Departure" locale="en-US" value={value}
    onValueChange={setValue} open={open} onOpenChange={setOpen} />;
}` },
  } },
  args: { label: LABEL, locale: LOCALE, onValueChange: fn(), onOpenChange: fn() },
  render: (args) => <EasyControlledDatePicker {...args} />,
  play: async ({ args, canvasElement, userEvent }) => {
    await userEvent.click(getInput(canvasElement));
    await bodyOf(canvasElement).findByRole('dialog', { name: LABEL });
    await userEvent.keyboard('{ArrowRight}{Enter}');
    await expectClosed(canvasElement);
    await expect(getInput(canvasElement)).toHaveValue(formatted('2026-10-13'));
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith('2026-10-13');
    await expect(args.onOpenChange).toHaveBeenCalledTimes(2);
  },
};

/** Dates follow the field's locale. */
export const EasyLocale: StoryObj<DatePickerEasyProps> = {
  args: { label: 'Salida', locale: 'es-ES', defaultValue: '2026-10-12' },
  render: (args) => <DatePicker {...args} />,
  play: async ({ canvasElement, userEvent }) => {
    const input = within(canvasElement).getByRole('combobox', { name: 'Salida' });
    const expected = new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', calendar: 'gregory', timeZone: 'UTC' }).format(new Date('2026-10-12T00:00:00Z'));
    await expect(input).toHaveValue(expected);
    await userEvent.click(input);
    await expect(await bodyOf(canvasElement).findByRole('dialog', { name: 'Salida' })).toBeVisible();
    await userEvent.keyboard('{Escape}');
    await expect(input).toHaveAttribute('aria-expanded', 'false');
  },
};

export const OpenControlled: Story = {
  tags: ['!autodocs'],
  args: { defaultOpen: true, defaultValue: '2026-10-12' },
  render: (args) => <DatePickerExample {...args} />,
  play: async ({ canvasElement }) => {
    // Persistent open state so the axe gate sees the dialog and grid.
    const dialog = await bodyOf(canvasElement).findByRole('dialog', { name: LABEL });
    await expect(dialog).toBeVisible();
    await expectMonth(canvasElement, 'October 2026');
    await expect(getInput(canvasElement)).toHaveAttribute('aria-expanded', 'true');
    await expect(getInput(canvasElement)).toHaveAttribute('aria-label', LABEL);
    await expect(dialog).toHaveAttribute('aria-label', LABEL);
    await expect(dialog).not.toHaveAttribute('aria-labelledby');
    await expectDayFocused(canvasElement, 'October 12, 2026');
  },
};

export const MinMax: Story = {
  name: 'Limit available dates',
  parameters: { docs: {
    description: { story: 'Choose within March 5–20; the supplied June date stays visible until you replace it.' },
    source: { language: 'tsx', code: `import { Button, DatePicker } from '@jfrader/ui';

<>
  <DatePicker locale="en-US" defaultValue="2025-06-01" min="2025-03-05" max="2025-03-20">
    <DatePicker.Input label="Departure" />
    <DatePicker.Popup />
  </DatePicker>
  <Button>After</Button>
</>` },
  } },
  // The value lies past max: the popup opens on max's month, never beyond it.
  args: { defaultValue: '2025-06-01', min: '2025-03-05', max: '2025-03-20', onValueChange: fn() },
  render: (args) => <DatePickerExample {...args} />,
  play: async ({ args, canvasElement }) => {
    const input = getInput(canvasElement);
    await expect(input).toHaveValue(formatted('2025-06-01'));

    await userEvent.click(input);
    await bodyOf(canvasElement).findByRole('dialog', { name: LABEL });
    await expectMonth(canvasElement, 'March 2025');
    // Neither the value nor today is in range: Calendar's tab stop is the first enabled day.
    await expect(day(canvasElement, 'March 5, 2025')).toHaveAttribute('tabindex', '0');
    await expectDayFocused(canvasElement, 'March 5, 2025');
    await expect(day(canvasElement, 'March 4, 2025')).toBeDisabled();
    await expect(day(canvasElement, 'March 21, 2025')).toBeDisabled();
    await userEvent.click(day(canvasElement, 'March 4, 2025'));
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await expect(bodyOf(canvasElement).getByRole('dialog', { name: LABEL })).toBeVisible();
    await expect(input).toHaveValue(formatted('2025-06-01'));
    await expect(bodyOf(canvasElement).getByRole('button', { name: 'February 2025' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    await expect(bodyOf(canvasElement).getByRole('button', { name: 'April 2025' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    // Pressing a disabled day keeps focus on Calendar's enabled tab stop.
    await expectDayFocused(canvasElement, 'March 5, 2025');

    // Moves are clamped into min/max.
    await userEvent.keyboard('{ArrowLeft}');
    await expectDayFocused(canvasElement, 'March 5, 2025');
    await userEvent.keyboard('{PageDown}');
    await expectDayFocused(canvasElement, 'March 20, 2025');
    await expectMonth(canvasElement, 'March 2025');

    await userEvent.keyboard('{Enter}');
    await expectClosed(canvasElement);
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith('2025-03-20');
    await waitFor(() => expect(input).toHaveValue(formatted('2025-03-20')));
  },
};

export const EscapeReverts: Story = {
  args: { defaultValue: '2026-10-12', onValueChange: fn(), onOpenChange: fn() },
  render: (args) => <DatePickerExample {...args} />,
  play: async ({ args, canvasElement }) => {
    const input = await focusInput(canvasElement);
    await userEvent.keyboard('{ArrowDown}');
    await bodyOf(canvasElement).findByRole('dialog', { name: LABEL });
    await expectDayFocused(canvasElement, 'October 12, 2026');

    await userEvent.keyboard('{PageDown}');
    await expectMonth(canvasElement, 'November 2026');
    await expectDayFocused(canvasElement, 'November 12, 2026');
    await userEvent.keyboard('{Shift>}{PageDown}{/Shift}');
    await expectMonth(canvasElement, 'November 2027');

    await userEvent.keyboard('{Escape}');
    await expectClosed(canvasElement);
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await expect(args.onOpenChange).toHaveBeenLastCalledWith(false);
    await expect(input).toHaveValue(formatted('2026-10-12'));
    await expectFocused(canvasElement, () => getInput(canvasElement));

    // The next open shows the selected month again.
    await userEvent.keyboard('{ArrowDown}');
    await bodyOf(canvasElement).findByRole('dialog', { name: LABEL });
    await expectMonth(canvasElement, 'October 2026');
    await expectDayFocused(canvasElement, 'October 12, 2026');
    await userEvent.keyboard('{Escape}');
    await expectClosed(canvasElement);
  },
};

export const OutsideClick: Story = {
  args: { defaultValue: '2026-10-12', onValueChange: fn() },
  render: (args) => <DatePickerExample {...args} />,
  play: async ({ args, canvasElement }) => {
    const { ownerDocument } = canvasElement;
    const input = getInput(canvasElement);

    // Pointer open also focuses the grid; pressing the input again closes.
    await userEvent.click(input);
    await bodyOf(canvasElement).findByRole('dialog', { name: LABEL });
    await expectDayFocused(canvasElement, 'October 12, 2026');
    await userEvent.click(input);
    await expectClosed(canvasElement);

    await userEvent.click(input);
    await bodyOf(canvasElement).findByRole('dialog', { name: LABEL });
    await userEvent.click(bodyOf(canvasElement).getByRole('button', { name: 'November 2026' }));
    await expectMonth(canvasElement, 'November 2026');

    const outside = within(canvasElement).getByRole('button', { name: OUTSIDE });
    await userEvent.click(outside);
    await expectClosed(canvasElement);
    // The click lands on its own target; the input is never focused.
    await expect(ownerDocument.activeElement).toBe(outside);
    await expect(input).not.toHaveFocus();
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await expect(input).toHaveValue(formatted('2026-10-12'));
  },
};

/**
 * Value and open are independent axes. A fixed `value` rejects the selection (one request,
 * the input keeps showing the controlled date) while the uncontrolled popup still closes.
 */
export const RejectedControlled: Story = {
  args: { value: '2026-10-14', onValueChange: fn(), onOpenChange: fn() },
  render: (args) => <DatePickerExample {...args} />,
  play: async ({ args, canvasElement }) => {
    const input = getInput(canvasElement);
    await userEvent.click(input);
    await bodyOf(canvasElement).findByRole('dialog', { name: LABEL });

    await userEvent.click(day(canvasElement, 'October 20, 2026'));
    await expectClosed(canvasElement);
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith('2026-10-20');
    await expect(args.onOpenChange).toHaveBeenLastCalledWith(false);
    await expect(input).toHaveValue(formatted('2026-10-14'));
    await expectFocused(canvasElement, () => getInput(canvasElement));

    // The calendar still shows the controlled date as selected.
    await userEvent.keyboard('{ArrowDown}');
    await bodyOf(canvasElement).findByRole('dialog', { name: LABEL });
    await expectDayFocused(canvasElement, 'October 14, 2026');
    await expect(day(canvasElement, 'October 14, 2026').closest('td')).toHaveAttribute('aria-selected', 'true');
    await expect(day(canvasElement, 'October 20, 2026').closest('td')).not.toHaveAttribute('aria-selected');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onOpenChange).toHaveBeenCalledTimes(3);
    await expect(args.onOpenChange).toHaveBeenNthCalledWith(1, true);
    await expect(args.onOpenChange).toHaveBeenNthCalledWith(2, false);
    await expect(args.onOpenChange).toHaveBeenNthCalledWith(3, true);
  },
};

/** A fixed `open` rejects the close: the value commits, the popup stays and focus stays inside. */
export const RejectedControlledOpen: Story = {
  tags: ['!autodocs'],
  args: { open: true, defaultValue: '2026-10-14', onValueChange: fn(), onOpenChange: fn() },
  render: (args) => <DatePickerExample {...args} />,
  play: async ({ args, canvasElement }) => {
    await bodyOf(canvasElement).findByRole('dialog', { name: LABEL });
    await expectDayFocused(canvasElement, 'October 14, 2026');

    await userEvent.keyboard('{ArrowRight}{Enter}');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith('2026-10-15');
    await expect(args.onOpenChange).toHaveBeenCalledTimes(1);
    await expect(args.onOpenChange).toHaveBeenLastCalledWith(false);
    await expect(bodyOf(canvasElement).getByRole('dialog', { name: LABEL })).toBeVisible();
    await waitFor(() => expect(getInput(canvasElement)).toHaveValue(formatted('2026-10-15')));
    await expectDayFocused(canvasElement, 'October 15, 2026');

    await userEvent.keyboard('{Escape}');
    await expect(args.onOpenChange).toHaveBeenCalledTimes(2);
    await expect(bodyOf(canvasElement).getByRole('dialog', { name: LABEL })).toBeVisible();
    await expectDayFocused(canvasElement, 'October 15, 2026');
  },
};

export const FormValue: Story = {
  name: 'Submit a date',
  parameters: { docs: {
    description: { story: 'Submit the chosen departure as an ISO date through the named field.' },
    source: { language: 'tsx', code: `import { Button, DatePicker } from '@jfrader/ui';

<form aria-label="Trip" onSubmit={(event) => event.preventDefault()}>
  <DatePicker name="departure" locale="en-US" defaultValue="2026-10-12">
    <DatePicker.Input label="Departure" />
    <DatePicker.Popup />
  </DatePicker>
  <Button>After</Button>
</form>` },
  } },
  args: { defaultValue: '2026-10-12', name: FIELD_NAME },
  render: (args) => (
    <form aria-label="Trip" onSubmit={(event) => event.preventDefault()}>
      <DatePickerExample {...args} />
    </form>
  ),
  play: async ({ canvasElement }) => {
    const form = within(canvasElement).getByRole('form', { name: 'Trip' }) as HTMLFormElement;
    await expect(new FormData(form).get(FIELD_NAME)).toBe('2026-10-12');

    await focusInput(canvasElement);
    await userEvent.keyboard('{ArrowDown}');
    await expectDayFocused(canvasElement, 'October 12, 2026');
    await userEvent.keyboard('{ArrowDown}{Enter}');
    await expectClosed(canvasElement);
    await expect(new FormData(form).get(FIELD_NAME)).toBe('2026-10-19');
  },
};

export const EmptyFormValue: Story = {
  args: { name: FIELD_NAME, locale: LOCALE },
  render: (args) => (
    <form aria-label="Trip" onSubmit={(event) => event.preventDefault()}>
      <DatePickerExample {...args} />
    </form>
  ),
  play: async ({ canvasElement }) => {
    const form = within(canvasElement).getByRole('form', { name: 'Trip' }) as HTMLFormElement;
    await expect(new FormData(form).get(FIELD_NAME)).toBe('');
    const input = getInput(canvasElement);
    await expect(input).toHaveValue('');
    // The default placeholder names the locale's date fields in display order.
    await expect(input).toHaveAttribute('placeholder', 'month day, year');
  },
};

export const CustomPlaceholder: Story = {
  ...EmptyFormValue,
  args: { name: FIELD_NAME, locale: LOCALE, placeholder: 'Choose departure date' },
  play: async ({ args, canvasElement }) => {
    const form = within(canvasElement).getByRole('form', { name: 'Trip' }) as HTMLFormElement;
    await expect(new FormData(form).get(FIELD_NAME)).toBe('');
    await expect(getInput(canvasElement)).toHaveValue('');
    await expect(getInput(canvasElement)).toHaveAttribute('placeholder', args.placeholder);
  },
};

export const TabNavigation: Story = {
  name: 'Navigate with the keyboard',
  parameters: { docs: {
    description: { story: 'Press Down to open, use arrows to move, and Tab to leave without selecting.' },
    source: { language: 'tsx', code: `import { Button, DatePicker } from '@jfrader/ui';

<>
  <DatePicker locale="en-US" defaultValue="2026-10-12">
    <DatePicker.Input label="Departure" />
    <DatePicker.Popup />
  </DatePicker>
  <Button>After</Button>
</>` },
  } },
  args: { defaultValue: '2026-10-12', onValueChange: fn() },
  render: (args) => <DatePickerExample {...args} />,
  play: async ({ args, canvasElement }) => {
    const input = await focusInput(canvasElement);
    await userEvent.keyboard('{ArrowDown}');
    await expectDayFocused(canvasElement, 'October 12, 2026');
    await userEvent.tab();
    await expectClosed(canvasElement);
    await expectFocused(canvasElement, () => within(canvasElement).getByRole('button', { name: OUTSIDE }));

    await userEvent.tab({ shift: true });
    await expectFocused(canvasElement, () => input);
    await userEvent.keyboard('{ArrowDown}');
    await expectDayFocused(canvasElement, 'October 12, 2026');
    // Reverse Tab walks the month controls before returning to the input.
    await userEvent.tab({ shift: true });
    await expectFocused(canvasElement, () => bodyOf(canvasElement).getByRole('button', { name: 'November 2026' }));
    await userEvent.tab({ shift: true });
    await expectFocused(canvasElement, () => bodyOf(canvasElement).getByRole('button', { name: 'September 2026' }));
    await userEvent.tab({ shift: true });
    await expectFocused(canvasElement, () => input);
    await expect(args.onValueChange).not.toHaveBeenCalled();
    // Returning to the reference need not dismiss; Escape cleans up either way.
    await userEvent.keyboard('{Escape}');
    await expectClosed(canvasElement);
  },
};

export const SpaceSelection: Story = {
  args: { defaultValue: '2026-10-12', onValueChange: fn(), onOpenChange: fn() },
  render: (args) => <DatePickerExample {...args} />,
  play: async ({ args, canvasElement }) => {
    await focusInput(canvasElement);
    await userEvent.keyboard('{ArrowDown}');
    await expectDayFocused(canvasElement, 'October 12, 2026');
    await userEvent.keyboard('{ArrowRight}[Space]');
    await expectClosed(canvasElement);
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith('2026-10-13');
    await expect(args.onOpenChange).toHaveBeenCalledTimes(2);
    await expect(args.onOpenChange).toHaveBeenNthCalledWith(1, true);
    await expect(args.onOpenChange).toHaveBeenNthCalledWith(2, false);
    await expectFocused(canvasElement, () => getInput(canvasElement));
    await expect(getInput(canvasElement)).toHaveValue(formatted('2026-10-13'));
  },
};

export const ExplicitAccessibleName: Story = {
  args: { defaultValue: '2026-10-12' },
  render: (args) => (
    <DatePicker {...args}>
      <DatePicker.Input label={LABEL} aria-label="Travel date" />
      <DatePicker.Popup />
    </DatePicker>
  ),
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByRole('combobox', { name: 'Travel date' });
    await userEvent.click(input);
    const dialog = await bodyOf(canvasElement).findByRole('dialog', { name: 'Travel date' });
    await expect(dialog).toHaveAttribute('aria-label', 'Travel date');
    await expect(dialog).not.toHaveAttribute('aria-labelledby');
    await expectDayFocused(canvasElement, 'October 12, 2026');
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(bodyOf(canvasElement).queryByRole('dialog')).toBeNull());
  },
};

export const Disabled: Story = {
  name: 'Disabled date field',
  parameters: { docs: {
    description: { story: 'Keep the departure visible but unavailable and omit it from form data.' },
    source: { language: 'tsx', code: `import { Button, DatePicker } from '@jfrader/ui';

<form aria-label="Trip" onSubmit={(event) => event.preventDefault()}>
  <DatePicker disabled name="departure" locale="en-US" defaultValue="2026-10-12">
    <DatePicker.Input label="Departure" />
    <DatePicker.Popup />
  </DatePicker>
  <Button>After</Button>
</form>` },
  } },
  args: { defaultValue: '2026-10-12', name: FIELD_NAME, disabled: true, onOpenChange: fn() },
  render: (args) => (
    <form aria-label="Trip" onSubmit={(event) => event.preventDefault()}>
      <DatePickerExample {...args} />
    </form>
  ),
  play: async ({ args, canvasElement }) => {
    const form = within(canvasElement).getByRole('form', { name: 'Trip' }) as HTMLFormElement;
    const input = getInput(canvasElement);
    await expect(input).toBeDisabled();
    await expect(new FormData(form).has(FIELD_NAME)).toBe(false);
    await userEvent.click(input);
    await expect(bodyOf(canvasElement).queryByRole('dialog')).toBeNull();
    await expect(args.onOpenChange).not.toHaveBeenCalled();
  },
};

export const DisabledDefaultOpen: Story = {
  tags: ['!autodocs'],
  args: {
    disabled: true,
    defaultOpen: true,
    defaultValue: '2026-10-12',
    onValueChange: fn(),
    onOpenChange: fn(),
  },
  render: (args) => <DatePickerExample {...args} />,
  play: async ({ args, canvasElement }) => {
    const input = getInput(canvasElement);
    await expect(input).toBeDisabled();
    await expectClosed(canvasElement);
    await waitFor(() => expect(args.onOpenChange).toHaveBeenCalledWith(false));
    await userEvent.click(input);
    await userEvent.tab();
    await expectFocused(canvasElement, () => within(canvasElement).getByRole('button', { name: OUTSIDE }));
    await userEvent.keyboard('{ArrowDown}{Enter}[Space]');
    await expectClosed(canvasElement);
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await expect(input).toHaveValue(formatted('2026-10-12'));
    await expect(args.onOpenChange).not.toHaveBeenCalledWith(true);
  },
};

export const DisabledControlledOpen: Story = {
  ...DisabledDefaultOpen,
  tags: ['!autodocs'],
  args: { ...DisabledDefaultOpen.args, defaultOpen: undefined, open: true },
};

export const LightTheme: Story = {
  tags: ['!autodocs'],
  decorators: [withLightTheme],
  args: { defaultOpen: true, defaultValue: '2026-10-12' },
  render: (args) => <DatePickerExample {...args} />,
  play: async ({ canvasElement }) => {
    const popup = await bodyOf(canvasElement).findByRole('dialog', { name: LABEL });
    await expect(popup).toBeVisible();
    await expectThemedSurface(popup, 'light');
    await expectDayFocused(canvasElement, 'October 12, 2026');
  },
};
