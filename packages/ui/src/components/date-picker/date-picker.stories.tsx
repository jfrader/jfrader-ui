import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { css } from '../../styling/css';
import { withLightTheme } from '../../testing/story-decorators';
import { Button } from '../button';
import { DatePicker, type DatePickerProps } from './index';

const LABEL = 'Departure';
const LOCALE = 'en-US';
const OUTSIDE = 'After';
const FIELD_NAME = 'departure';
const DISPLAY_FORMAT = new Intl.DateTimeFormat(LOCALE, { dateStyle: 'medium', calendar: 'gregory', timeZone: 'UTC' });

const stackStyle = css({
  display: 'grid',
  gap: vars.space[4],
  inlineSize: '320px',
});

const meta = {
  title: 'Pickers/DatePicker',
  component: DatePicker,
  args: { locale: LOCALE },
  parameters: {
    // Floating UI's focus guards are aria-hidden spans with tabindex=0 that forward focus
    // immediately; axe flags them as aria-hidden-focus (known false positive). Every other
    // aria-hidden element is still checked.
    a11y: {
      config: {
        rules: [{ id: 'aria-hidden-focus', selector: '[aria-hidden="true"]:not([data-floating-ui-focus-guard])' }],
      },
    },
  },
} satisfies Meta<typeof DatePicker>;

export default meta;

type Story = StoryObj<typeof meta>;

function DatePickerExample(props: DatePickerProps) {
  return (
    <div css={stackStyle}>
      <DatePicker {...props}>
        <DatePicker.Input label={LABEL} />
        <DatePicker.Popup />
      </DatePicker>
      <Button>{OUTSIDE}</Button>
    </div>
  );
}

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

export const Default: Story = {
  args: { defaultValue: '2026-10-12', onValueChange: fn(), onOpenChange: fn() },
  render: (args) => <DatePickerExample {...args} />,
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

export const OpenControlled: Story = {
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
  args: { ...DisabledDefaultOpen.args, defaultOpen: undefined, open: true },
};

export const LightTheme: Story = {
  decorators: [withLightTheme],
  args: { defaultOpen: true, defaultValue: '2026-10-12' },
  render: (args) => <DatePickerExample {...args} />,
  play: async ({ canvasElement }) => {
    await expect(await bodyOf(canvasElement).findByRole('dialog', { name: LABEL })).toBeVisible();
    await expectDayFocused(canvasElement, 'October 12, 2026');
  },
};
