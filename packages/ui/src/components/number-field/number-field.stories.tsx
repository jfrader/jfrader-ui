import { act, StrictMode, useRef, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, fireEvent, spyOn, within } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { styled } from '../../styling/styled';
import { Button } from '../button';
import { NumberField, NumberFieldConfigError, type NumberFieldProps } from './index';
import { createNumberFieldValue } from './number-field-value';

const Frame = styled.div({ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: vars.space[4], maxInlineSize: '100%' });
const IntrinsicFrame = styled(Frame)({ inlineSize: 'max-content' });
const NarrowFrame = styled(Frame)({ inlineSize: `calc(${vars.space[8]} * 4)` });
const Affix = styled.span({ color: vars.color.textMuted });

const meta = {
  title: 'Inputs/NumberField',
  component: NumberField,
  tags: ['autodocs'],
  args: { label: 'Seats', defaultValue: 5, min: 1, max: 500, locale: 'en-US', onValueChange: fn() },
  parameters: {
    docs: {
      description: { component: 'Enter an exact quantity or measurement with step controls.' },
      sections: [
        { title: 'Quantities', stories: ['Default', 'DecimalStep', 'Unit', 'PrefixSuffix'] },
        { title: 'State and forms', stories: ['Controlled', 'FormReset'] },
      ],
      usage: `### Values
- Typing edits a draft. Press Enter, leave the input, or step to commit it. Invalid or incomplete drafts stay visible with an error; press Escape to discard them.
- A rejected controlled request never changes the committed display, ARIA value, form data, or the next repeat step. Empty values differ from zero.
- Commits clamp to \`min\`/\`max\` and snap to the \`step\` grid anchored at \`min\`. Ties round toward positive infinity. An off-grid committed amount steps to the next grid line in the requested direction.
- Stepping from empty starts at zero clamped to the range, then moves one step. Externally supplied out-of-range amounts are shown invalid without changing them.
- Bounds and values must be finite, within Number.MAX_SAFE_INTEGER, and use at most 12 fraction digits. Steps must be positive. Invalid configuration throws \`NumberFieldConfigError\`.

### Keyboard
- ArrowUp/ArrowDown step once. Shift+Arrow or PageUp/PageDown uses \`largeStep\` (ten steps by default).
- Home/End jumps to the bounds outside draft editing; during editing it retains native caret movement. Enter commits a draft without submitting; otherwise it selects the text. Escape restores the latest committed value.
- Tab and Shift+Tab move normally. Enter and Space activate a focused stepper once. Holding a pointer repeats after 400ms, accelerating from 150ms to a 40ms floor. Set \`repeat={false}\` to disable holding.

### Forms
- Forms submit one canonical number (\`1.5\`, not locale-formatted text). Empty submits an empty string; disabled fields are omitted. The visible input owns required/custom validation.
- Reset restores the initial uncontrolled value without callbacks. Controlled values remain parent-owned.

### Locale and units
- Set \`locale\` identically on the server and client. Grouping, digits, separators and units use Intl; parsing accepts locale digits without removing arbitrary characters.
- Use localized units for measurements. Decorative affixes are not announced; provide custom spoken unit wording when needed.
- This field is for quantities, not money, phone numbers, postal codes or numeric identifiers. Currency, percent, compact and significant-digit formatting are not supported.
- Translate complete phrases. Non-text labels need named increment and decrement actions. Without a visible label, supply an ARIA name. Direction changes layout, not ArrowUp meaning.`,
    },
  },
} satisfies Meta<typeof NumberField>;
export default meta;
type Story = StoryObj<typeof meta>;

function ControlledField(props: NumberFieldProps) {
  const [value, setValue] = useState(props.defaultValue ?? null);
  return <NumberField {...props} value={value} onValueChange={(next) => { setValue(next); props.onValueChange?.(next); }} />;
}

export const Default: Story = {
  name: 'Choose a quantity',
  parameters: { docs: {
    description: { story: 'Type a seat count or use the step controls within the allowed range.' },
    source: { language: 'tsx', code: `import { NumberField } from '@jfrader/ui';

<NumberField label="Seats" defaultValue={5} min={1} max={500} locale="en-US" />` },
  } },
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByRole('spinbutton', { name: 'Seats' });
    await expect(input).toHaveValue('5');
    await expect(input).toHaveAttribute('aria-valuenow', '5');
    await expect(input).toHaveAttribute('aria-valuemin', '1');
    await expect(input).toHaveAttribute('aria-valuemax', '500');
    await expect(input).toHaveAttribute('aria-valuetext', '5');
    await expect(input).toHaveAccessibleDescription('Range: 1 to 500');
  },
};

export const Sizes: Story = {
  render: (args) => <IntrinsicFrame>{(['sm', 'md', 'lg'] as const).map((size) => <NumberField {...args} key={size} size={size} label={size} />)}</IntrinsicFrame>,
  play: async ({ canvasElement }) => {
    for (const [size, height, width] of [['sm', 32, 160], ['md', 40, 192], ['lg', 48, 224]] as const) {
      const input = within(canvasElement).getByRole('spinbutton', { name: size });
      await expect(input.parentElement!.getBoundingClientRect().height).toBe(height);
      await expect(input.closest('[data-ui="number-field"]')!.getBoundingClientRect().width).toBe(width);
    }
    for (const button of within(canvasElement).getAllByRole('button')) {
      await expect(button.getBoundingClientRect().width).toBeGreaterThanOrEqual(32);
      await expect(button.getBoundingClientRect().height).toBeGreaterThanOrEqual(24);
    }
  },
};
export const DecimalStep: Story = {
  name: 'Exact decimal steps',
  parameters: { docs: {
    description: { story: 'Step from zero to one in exact tenths.' },
    source: { language: 'tsx', code: `import { NumberField } from '@jfrader/ui';

<NumberField label="Seats" defaultValue={0} min={0} max={1} step={0.1} locale="en-US" />` },
  } },
  args: { min: 0, max: 1, step: 0.1, defaultValue: 0 },
  play: async ({ canvasElement, userEvent, args }) => {
    const input = within(canvasElement).getByRole('spinbutton');
    await userEvent.click(input);
    await userEvent.keyboard('{ArrowUp}{ArrowUp}{ArrowUp}');
    await expect(input).toHaveValue('0.3');
    await expect(args.onValueChange).toHaveBeenLastCalledWith(0.3);
    await expect(args.onValueChange).toHaveBeenCalledTimes(3);
  },
};
export const ScientificStep: Story = {
  args: { min: 0, max: 0.00001, step: 1e-7, defaultValue: 0 },
  play: async ({ canvasElement, userEvent }) => {
    const input = within(canvasElement).getByRole('spinbutton');
    await userEvent.click(input);
    await userEvent.keyboard('{ArrowUp}{ArrowUp}{ArrowUp}');
    await expect(input).toHaveAttribute('aria-valuenow', '0.0000003');
    await expect(input).toHaveValue('0.0000003');
  },
};
export const Negative: Story = {
  args: { min: -1, max: 1, step: 0.1, defaultValue: -0.3 },
  play: async ({ canvasElement, userEvent }) => {
    const input = within(canvasElement).getByRole('spinbutton');
    await userEvent.click(input);
    await userEvent.keyboard('{ArrowDown}{ArrowDown}');
    await expect(input).toHaveValue('-0.5');
  },
};
export const Unit: Story = {
  name: 'Localized measurement',
  parameters: { docs: {
    description: { story: 'Format a volume in liters while retaining exact decimal stepping.' },
    source: { language: 'tsx', code: `import { NumberField } from '@jfrader/ui';

<NumberField label="Volume" defaultValue={1.5} min={0} max={10} step={0.1} locale="en-US"
  formatOptions={{ style: 'unit', unit: 'liter', unitDisplay: 'long' }} />` },
  } },
  args: { label: 'Volume', min: 0, max: 10, defaultValue: 1.5, step: 0.1, formatOptions: { style: 'unit', unit: 'liter', unitDisplay: 'long' } },
};
export const PrefixSuffix: Story = {
  name: 'Custom measurement affixes',
  args: { label: 'Length', prefix: <Affix>≈</Affix>, suffix: () => <Affix>m</Affix>, formatValueText: (value, formatted) => value === null ? 'No length' : `${formatted} meters` },
  parameters: { docs: { description: { story: 'Add visual affixes and an explicit spoken measurement.' }, source: { language: 'tsx', code: `import { NumberField, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const Affix = styled.span({ color: vars.color.textMuted });

export function LengthField() {
  return (
    <NumberField
      label="Length"
      defaultValue={5}
      min={1}
      max={500}
      locale="en-US"
      prefix={<Affix>≈</Affix>}
      suffix={() => <Affix>m</Affix>}
      formatValueText={(value, formatted) => value === null ? 'No length' : \`\${formatted} meters\`}
    />
  );
}` } } },
};
export const Empty: Story = {
  args: { defaultValue: null, min: 0 },
  play: async ({ canvasElement, userEvent }) => {
    const input = within(canvasElement).getByRole('spinbutton');
    await expect(input).toHaveValue('');
    await expect(input).not.toHaveAttribute('aria-valuenow');
    await expect(input).toHaveAttribute('aria-valuetext', 'Empty');
    await userEvent.click(input);
    await userEvent.keyboard('{ArrowUp}');
    await expect(input).toHaveValue('1');
  },
};
export const Required: Story = {
  args: { required: true, defaultValue: null },
  play: async ({ canvasElement, userEvent, args }) => {
    const input = within(canvasElement).getByRole('spinbutton');
    await userEvent.click(input);
    await userEvent.keyboard(' {Backspace}{Enter}');
    await expect(input).toBeInvalid();
    await expect(within(canvasElement).getByRole('alert')).toHaveTextContent('Enter a number.');
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await expect((input as HTMLInputElement).validationMessage).toBe('Enter a number.');
  },
};
export const Minimum: Story = {
  args: { defaultValue: 1 },
  play: async ({ canvasElement, userEvent, args }) => {
    const input = within(canvasElement).getByRole('spinbutton');
    await userEvent.click(input);
    await userEvent.keyboard('{ArrowDown}{ArrowDown}');
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await expect(within(canvasElement).getByRole('status')).toHaveTextContent('Minimum: 1');
    await expect(within(canvasElement).getByRole('button', { name: 'Decrease Seats' })).toHaveAttribute('aria-disabled', 'true');
  },
};
export const Maximum: Story = { args: { defaultValue: 500 } };
export const OffGrid: Story = {
  args: { defaultValue: 0.25, min: -0.1, max: 1, step: 0.2 },
  play: async ({ canvasElement, userEvent }) => {
    const input = within(canvasElement).getByRole('spinbutton');
    await userEvent.click(input);
    await userEvent.keyboard('{ArrowUp}');
    await expect(input).toHaveValue('0.3');
    await userEvent.keyboard('{ArrowDown}');
    await expect(input).toHaveValue('0.1');
  },
};
export const InvalidDraft: Story = {
  tags: ['!autodocs'],
  args: { min: -10 },
  play: async ({ canvasElement, userEvent, args }) => {
    const input = within(canvasElement).getByRole('spinbutton');
    await userEvent.clear(input);
    await userEvent.type(input, '-');
    await userEvent.keyboard('{Enter}');
    await expect(input).toHaveValue('-');
    await expect(input).toHaveAttribute('aria-valuenow', '5');
    await expect(input).toHaveAttribute('aria-invalid', 'true');
    await expect(within(canvasElement).getByRole('alert')).toHaveTextContent('The draft has not been accepted.');
    await expect(args.onValueChange).not.toHaveBeenCalled();
  },
};
export const OutOfBoundsProp: Story = {
  args: { value: 600 },
  play: async ({ canvasElement, args }) => {
    const input = within(canvasElement).getByRole('spinbutton');
    await expect(input).toHaveValue('600');
    await expect(input).toHaveAttribute('aria-valuenow', '600');
    await expect(input).toBeInvalid();
    await expect(args.onValueChange).not.toHaveBeenCalled();
  },
};
export const Disabled: Story = { args: { disabled: true } };
export const ReadOnly: Story = {
  args: { readOnly: true },
  play: async ({ canvasElement, userEvent, args }) => {
    const input = within(canvasElement).getByRole('spinbutton');
    await userEvent.click(input);
    await userEvent.keyboard('{ArrowUp}{PageDown}{Home}{End}{Enter}{Escape}');
    await expect(input).toHaveValue('5');
    await expect(args.onValueChange).not.toHaveBeenCalled();
  },
};
export const NoRepeat: Story = {
  args: { repeat: false },
  play: async ({ canvasElement, userEvent, args }) => {
    const button = within(canvasElement).getByRole('button', { name: 'Increase Seats' });
    await userEvent.click(button);
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith(6);
  },
};

function ResetForm(props: NumberFieldProps) {
  return <form><Frame><NumberField {...props} name="seats" /><Button type="reset">Reset</Button></Frame></form>;
}
export const FormReset: Story = {
  name: 'Submit and reset',
  parameters: { docs: {
    description: { story: 'Submit a canonical seat count and reset it to the initial value.' },
    source: { language: 'tsx', code: `import { Button, NumberField, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const Fields = styled.div({ display: 'grid', gap: vars.space[4], maxInlineSize: '100%' });

<form>
  <Fields>
    <NumberField name="seats" label="Seats" defaultValue={5} min={1} max={500} locale="en-US" />
    <Button type="reset">Reset</Button>
  </Fields>
</form>` },
  } },
  render: (args) => <ResetForm {...args} />,
  play: async ({ canvasElement, userEvent, args }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole('spinbutton');
    const form = canvasElement.querySelector('form')!;
    await expect(new FormData(form).getAll('seats')).toEqual(['5']);
    await userEvent.clear(input);
    await userEvent.type(input, '12');
    await userEvent.keyboard('{Enter}');
    await expect(new FormData(form).getAll('seats')).toEqual(['12']);
    await userEvent.click(canvas.getByRole('button', { name: 'Reset' }));
    await expect(input).toHaveValue('5');
    await expect(new FormData(form).getAll('seats')).toEqual(['5']);
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
  },
};
export const Controlled: Story = {
  name: 'Own the committed value',
  parameters: { docs: {
    description: { story: 'Store the committed decimal value in application state.' },
    source: { language: 'tsx', code: `import { useState } from 'react';
import { NumberField } from '@jfrader/ui';

export function QuantityField() {
  const [value, setValue] = useState<number | null>(0);
  return <NumberField label="Seats" value={value} onValueChange={setValue}
    min={0} max={1} step={0.1} locale="en-US" />;
}` },
  } },
  render: (args) => <ControlledField {...args} />, play: DecimalStep.play, args: DecimalStep.args,
};
export const Uncontrolled: Story = {
  play: async ({ canvasElement, userEvent, args }) => {
    const input = within(canvasElement).getByRole('spinbutton');
    await userEvent.clear(input);
    await userEvent.type(input, '12');
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await expect(input).toHaveAttribute('aria-valuenow', '5');
    await userEvent.keyboard('{ArrowUp}');
    await expect(input).toHaveValue('13');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith(13);
  },
};
export const RejectedTypedCommit: Story = {
  args: { value: 5, name: 'seats' },
  render: (args) => <form><NumberField {...args} /></form>,
  play: async ({ canvasElement, userEvent, args }) => {
    const input = within(canvasElement).getByRole('spinbutton');
    await userEvent.clear(input);
    await userEvent.type(input, '12');
    await userEvent.keyboard('{Enter}');
    await expect(input).toHaveValue('5');
    await expect(input).toHaveAttribute('aria-valuenow', '5');
    await expect(new FormData(canvasElement.querySelector('form')!).get('seats')).toBe('5');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith(12);
    await userEvent.keyboard('{ArrowUp}');
    await expect(args.onValueChange).toHaveBeenLastCalledWith(6);
    await expect(input).toHaveValue('5');
  },
};

async function exerciseHold(canvasElement: HTMLElement, onValueChange: NumberFieldProps['onValueChange'], rejected: boolean, lifecycle = false) {
  const canvas = within(canvasElement);
  const button = canvas.getByRole('button', { name: 'Increase Seats' });
  const ownerWindow: Window = button.ownerDocument.defaultView!;
  const pending = new Map<number, { callback: () => void; delay: number }>();
  let sequence = 0;
  const originalTimeout = ownerWindow.setTimeout.bind(ownerWindow);
  const originalClear = ownerWindow.clearTimeout.bind(ownerWindow);
  const capture = spyOn(button, 'setPointerCapture').mockImplementation(() => {});
  const captured = spyOn(button, 'hasPointerCapture').mockReturnValue(true);
  const release = spyOn(button, 'releasePointerCapture').mockImplementation(() => {});
  const timeout = spyOn(ownerWindow, 'setTimeout').mockImplementation((handler: TimerHandler, delay?: number) => {
    if (typeof handler === 'function' && delay !== undefined && [400, 150, 130, 110, 90, 70, 50, 40].includes(delay)) {
      const id = --sequence;
      pending.set(id, { callback: () => handler(), delay });
      return id;
    }
    return originalTimeout(handler, delay);
  });
  const clear = spyOn(ownerWindow, 'clearTimeout').mockImplementation((id?: number) => {
    if (id !== undefined && pending.has(id)) pending.delete(id); else originalClear(id);
  });
  try {
    await act(async () => { fireEvent.pointerDown(button, { button: 0, pointerId: 1 }); });
    await expect(onValueChange).toHaveBeenCalledTimes(1);
    await expect(onValueChange).toHaveBeenLastCalledWith(6);
    await expect(capture).toHaveBeenCalledWith(1);
    for (const delay of [400, 150, 130]) {
      const [id, task] = [...pending.entries()][0]!;
      await expect(task.delay).toBe(delay);
      pending.delete(id);
      await act(async () => { task.callback(); });
    }
    await expect(onValueChange).toHaveBeenCalledTimes(4);
    await expect(onValueChange).toHaveBeenLastCalledWith(rejected ? 6 : 9);
    await expect(canvas.getByRole('spinbutton')).toHaveValue(rejected ? '5' : '9');
    await act(async () => { fireEvent.pointerUp(button, { pointerId: 1 }); fireEvent.click(button); });
    await expect(pending.size).toBe(0);
    await expect(release).toHaveBeenCalledWith(1);
    await expect(onValueChange).toHaveBeenCalledTimes(4);
    await act(async () => { fireEvent.pointerDown(button, { button: 0, pointerId: 2 }); fireEvent.pointerCancel(button, { pointerId: 2 }); });
    await expect(pending.size).toBe(0);
    await act(async () => { fireEvent.pointerDown(button, { button: 0, pointerId: 3 }); fireEvent.focusOut(button); });
    await expect(pending.size).toBe(0);
    await act(async () => { fireEvent.pointerDown(button, { button: 0, pointerId: 4 }); ownerWindow.dispatchEvent(new Event('blur')); });
    await expect(pending.size).toBe(0);
    if (lifecycle) {
      await act(async () => { fireEvent.pointerDown(button, { button: 0, pointerId: 5 }); });
      await expect(pending.size).toBe(1);
      await act(async () => { fireEvent.click(canvas.getByRole('button', { name: 'Toggle availability' })); });
      await expect(pending.size).toBe(0);
      await act(async () => { fireEvent.click(canvas.getByRole('button', { name: 'Toggle availability' })); });
      await act(async () => { fireEvent.pointerDown(button, { button: 0, pointerId: 6 }); });
      await expect(pending.size).toBe(1);
      await act(async () => { fireEvent.click(canvas.getByRole('button', { name: 'Remove field' })); });
      await expect(pending.size).toBe(0);
    }
  } finally {
    clear.mockRestore(); timeout.mockRestore(); release.mockRestore(); captured.mockRestore(); capture.mockRestore();
  }
}
export const Hold: Story = {
  render: (args) => <ControlledField {...args} />,
  play: async ({ canvasElement, args }) => exerciseHold(canvasElement, args.onValueChange, false),
};
export const RejectedStepperHold: Story = {
  args: { value: 5 },
  play: async ({ canvasElement, args }) => exerciseHold(canvasElement, args.onValueChange, true),
};

function LifecycleField(props: NumberFieldProps) {
  const [disabled, setDisabled] = useState(false);
  const [mounted, setMounted] = useState(true);
  return <Frame>{mounted && <NumberField {...props} disabled={disabled} />}<Button onClick={() => setDisabled((value) => !value)}>Toggle availability</Button><Button onClick={() => setMounted(false)}>Remove field</Button></Frame>;
}
export const HoldLifecycle: Story = {
  render: (args) => <LifecycleField {...args} />,
  play: async ({ canvasElement, args }) => exerciseHold(canvasElement, args.onValueChange, false, true),
};

function ExternalUpdate(props: NumberFieldProps) {
  const [value, setValue] = useState(5);
  return <Frame><NumberField {...props} value={value} /><Button onClick={() => setValue(20)}>Update amount</Button></Frame>;
}
export const ExternalUpdates: Story = {
  render: (args) => <ExternalUpdate {...args} />,
  play: async ({ canvasElement, userEvent, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Update amount' }));
    const input = canvas.getByRole('spinbutton');
    await expect(input).toHaveValue('20');
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await userEvent.clear(input);
    await userEvent.type(input, '30');
    await userEvent.keyboard('{Escape}');
    await expect(input).toHaveValue('20');
    await expect(args.onValueChange).not.toHaveBeenCalled();
  },
};
export const ExternalAria: Story = {
  args: { 'aria-describedby': 'number-external-help', 'aria-labelledby': 'number-external-label', description: 'Available places', error: 'Check the seating plan', 'aria-invalid': 'grammar' },
  render: (args) => <Frame><span id="number-external-label">Booking</span><NumberField {...args} /><span id="number-external-help">External help</span></Frame>,
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByRole('spinbutton', { name: 'Booking Seats' });
    await expect(input.getAttribute('aria-describedby')).toContain('number-external-help');
    await expect(input.getAttribute('aria-describedby')).toContain('-range');
    await expect(input.getAttribute('aria-describedby')).toContain('-description');
    await expect(input.getAttribute('aria-describedby')).toContain('-error');
    await expect(input).toHaveAttribute('aria-invalid', 'true');
  },
};
export const FalsyNodes: Story = {
  render: (args) => <Frame><NumberField {...args} prefix={0} suffix={0} description={0} error={0} /><NumberField {...args} label="No helper" error={false} description={false} /></Frame>,
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('alert')).toHaveTextContent('0');
    await expect(within(canvasElement).getByRole('spinbutton', { name: 'No helper' })).not.toHaveAttribute('aria-invalid');
    const ids = Array.from(canvasElement.querySelectorAll('input[role]')).map((element) => element.id);
    await expect(new Set(ids).size).toBe(2);
  },
};
export const Locales: Story = {
  render: (args) => <Frame>{['en-US', 'de-DE', 'hi-IN', 'ar-EG'].map((locale) => <NumberField {...args} key={locale} label={locale} locale={locale} min={0} max={200000} defaultValue={12345.5} step={0.1} />)}</Frame>,
  play: async ({ canvasElement, userEvent }) => {
    for (const [locale, text] of [['en-US', '1,234.5'], ['de-DE', '1.234,5'], ['hi-IN', '1,23,456.5'], ['ar-EG', '١٬٢٣٤٫٥']] as const) {
      const input = within(canvasElement).getByRole('spinbutton', { name: locale });
      await userEvent.clear(input);
      await userEvent.type(input, text);
      await userEvent.keyboard('{Enter}');
      const expected = locale === 'hi-IN' ? 123456.5 : 1234.5;
      await expect(input).toHaveAttribute('aria-valuenow', String(expected));
      await expect(input).toHaveValue(new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(expected));
    }
  },
};
export const Narrow: Story = {
  render: (args) => <NarrowFrame><NumberField {...args} /></NarrowFrame>,
  play: async ({ canvasElement }) => {
    const root = canvasElement.querySelector<HTMLElement>('[data-ui="number-field"]')!;
    const frame = root.parentElement!;
    await expect(root.getBoundingClientRect().width).toBeLessThanOrEqual(frame.getBoundingClientRect().width);
    await expect(root.scrollWidth).toBeLessThanOrEqual(root.clientWidth);
    const input = within(root).getByRole('spinbutton').getBoundingClientRect();
    for (const button of within(root).getAllByRole('button')) {
      const rect = button.getBoundingClientRect();
      await expect(Math.abs((rect.top + rect.bottom) / 2 - (input.top + input.bottom) / 2)).toBeLessThan(1);
    }
  },
};
export const LongLabels: Story = {
  args: {
    label: 'Number of places available for the afternoon workshop',
    incrementLabel: 'Add one workshop place', decrementLabel: 'Remove one workshop place',
    description: 'workshop_reservations_for_the_afternoon_session',
    sx: { inlineSize: `calc(${vars.space[8]} * 4)` },
  },
  play: async ({ canvasElement }) => {
    const root = canvasElement.querySelector<HTMLElement>('[data-ui="number-field"]')!;
    await expect(root.scrollWidth).toBeLessThanOrEqual(root.clientWidth);
  },
};
export const LightTheme: Story = { globals: { theme: 'light' } };
export const RTL: Story = { args: { dir: 'rtl', locale: 'ar-EG', label: 'Seats' } };
export const ForcedColors: Story = { parameters: { docs: { description: { story: 'Enable your operating system’s forced-colors mode to inspect the control boundary and focus outlines.' } } } };
export const ReducedMotion: Story = { parameters: { docs: { description: { story: 'Enable reduced motion in your operating system. Stepping and hold timing remain unchanged.' } } } };

export const Keyboard: Story = {
  args: { min: 0, max: 50, defaultValue: 5 },
  play: async ({ canvasElement, userEvent, args }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole('spinbutton');
    const decrease = canvas.getByRole('button', { name: 'Decrease Seats' });
    const increase = canvas.getByRole('button', { name: 'Increase Seats' });
    await userEvent.tab();
    await expect(input.ownerDocument.activeElement).toBe(decrease);
    await expect(getComputedStyle(decrease).outlineStyle).not.toBe('none');
    await userEvent.tab();
    await expect(input.ownerDocument.activeElement).toBe(input);
    await expect(
      getComputedStyle(input.parentElement!).outlineStyle,
    ).not.toBe('none');
    await userEvent.keyboard('{ArrowUp}{ArrowDown}{Shift>}{ArrowUp}{/Shift}{PageDown}{PageUp}');
    await expect(input).toHaveValue('15');
    await userEvent.keyboard('{Home}');
    await expect(input).toHaveValue('0');
    await userEvent.keyboard('{End}');
    await expect(input).toHaveValue('50');
    await userEvent.keyboard('{ArrowUp}');
    await expect(args.onValueChange).toHaveBeenCalledTimes(7);
    await userEvent.clear(input);
    await userEvent.type(input, '23');
    await userEvent.keyboard('{Home}');
    await expect((input as HTMLInputElement).selectionStart).toBe(0);
    await expect(input).toHaveAttribute('aria-valuenow', '50');
    await userEvent.keyboard('{End}');
    await expect((input as HTMLInputElement).selectionStart).toBe(2);
    await userEvent.keyboard('{Escape}');
    await expect(input).toHaveValue('50');
    await userEvent.tab();
    await expect(input.ownerDocument.activeElement).toBe(increase);
    await userEvent.keyboard('{Enter} ');
    await expect(args.onValueChange).toHaveBeenCalledTimes(7);
    await userEvent.tab({ shift: true });
    await expect(input.ownerDocument.activeElement).toBe(input);
    await userEvent.tab({ shift: true });
    await expect(input.ownerDocument.activeElement).toBe(decrease);
    await userEvent.keyboard('{Enter} ');
    await expect(args.onValueChange).toHaveBeenCalledTimes(9);
    await expect(input).toHaveValue('48');
  },
};

export const CommitAndForms: Story = {
  args: { min: -1, max: 1, step: 0.1, defaultValue: 0, name: 'amount' },
  render: (args) => <form><Frame><NumberField {...args} /><Button type="button">Next field</Button></Frame></form>,
  play: async ({ canvasElement, userEvent, args }) => {
    const input = within(canvasElement).getByRole('spinbutton');
    const form = canvasElement.querySelector('form')!;
    await expect(new FormData(form).getAll('amount')).toEqual(['0']);
    await userEvent.clear(input);
    await userEvent.type(input, '-0.25');
    await userEvent.keyboard('{Enter}');
    await expect(input).toHaveValue('-0.2');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith(-0.2);
    await expect(new FormData(form).get('amount')).toBe('-0.2');
    await userEvent.clear(input);
    await userEvent.type(input, '100');
    await userEvent.tab();
    await expect(input).toHaveValue('1');
    await expect(args.onValueChange).toHaveBeenCalledTimes(2);
    await userEvent.clear(input);
    await userEvent.keyboard('{Enter}');
    await expect(input).not.toHaveAttribute('aria-valuenow');
    await expect(new FormData(form).get('amount')).toBe('');
  },
};

export const MalformedDraft: Story = {
  tags: ['!autodocs'],
  play: async ({ canvasElement, userEvent, args }) => {
    const input = within(canvasElement).getByRole('spinbutton');
    await userEvent.clear(input);
    await userEvent.type(input, '12cats');
    await userEvent.keyboard('{Enter}');
    await expect(input).toHaveValue('12cats');
    await expect(input).toBeInvalid();
    await expect(input).toHaveAttribute('aria-valuenow', '5');
    await expect(args.onValueChange).not.toHaveBeenCalled();
  },
};
export const Composition: Story = {
  play: async ({ canvasElement, userEvent, args }) => {
    const input = within(canvasElement).getByRole('spinbutton');
    await userEvent.click(input);
    await act(async () => { fireEvent.compositionStart(input); });
    await userEvent.keyboard('{ArrowUp}{Enter}{Home}{Escape}');
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await act(async () => { fireEvent.compositionEnd(input); });
    await userEvent.keyboard('{ArrowUp}');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith(6);
  },
};

function RefField(props: NumberFieldProps) {
  const input = useRef<HTMLInputElement>(null);
  return <StrictMode><Frame><NumberField {...props} ref={input} /><Button onClick={() => input.current?.focus()}>Focus amount</Button></Frame></StrictMode>;
}
export const NativeRef: Story = {
  render: (args) => <RefField {...args} />,
  play: async ({ canvasElement, userEvent }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Focus amount' }));
    await expect(canvasElement.ownerDocument.activeElement).toBe(canvas.getByRole('spinbutton'));
  },
};
export const Configuration: Story = {
  play: async () => {
    const valid = { min: 0, max: 10, step: 1, largeStep: 10, defaultValue: 0, value: 0, locale: 'en-US' };
    for (const invalid of [{ min: 11 }, { step: 0 }, { largeStep: -1 }, { max: Infinity }, { value: NaN }, { step: 1e-13 }, { max: Number.MAX_SAFE_INTEGER + 1 }, { formatOptions: { maximumFractionDigits: 13 } }]) {
      await expect(() => createNumberFieldValue({ ...valid, ...invalid })).toThrow(NumberFieldConfigError);
    }
    const fractional = createNumberFieldValue({ ...valid, step: 0.07, largeStep: undefined });
    await expect(fractional.largeStep).toBe(0.7);
  },
};

export const CanonicalForms: Story = {
  render: (args) => <form><Frame><NumberField {...args} name="zero" defaultValue={0} min={0} /><NumberField {...args} label="Empty amount" name="empty" defaultValue={null} /><NumberField {...args} label="Disabled amount" name="disabled" disabled /><NumberField {...args} label="Localized amount" name="localized" locale="de-DE" defaultValue={1234.5} max={5000} step={0.1} /></Frame></form>,
  play: async ({ canvasElement }) => {
    const form = canvasElement.querySelector('form')!;
    await expect([...new FormData(form).entries()]).toEqual([['zero', '0'], ['empty', ''], ['localized', '1234.5']]);
  },
};

export const ControlledReset: Story = {
  args: { value: 20 },
  render: (args) => <ResetForm {...args} />,
  play: async ({ canvasElement, userEvent, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Reset' }));
    await expect(canvas.getByRole('spinbutton')).toHaveValue('20');
    await expect(args.onValueChange).not.toHaveBeenCalled();
  },
};

export const NativeEvents: Story = {
  args: { onChange: fn() },
  play: async ({ canvasElement, userEvent, args }) => {
    const input = within(canvasElement).getByRole('spinbutton');
    await userEvent.clear(input);
    await userEvent.type(input, '8');
    await expect(args.onChange).toHaveBeenCalledTimes(2);
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await userEvent.keyboard('{Enter}');
    await expect(args.onValueChange).toHaveBeenLastCalledWith(8);
    await expect(args.onChange).toHaveBeenCalledTimes(2);
  },
};

export const RequiredUntouched: Story = {
  args: { defaultValue: null, required: true },
  tags: ['!autodocs'],
  play: async ({ canvasElement, userEvent, args }) => {
    const input = within(canvasElement).getByRole('spinbutton');
    await userEvent.click(input);
    await userEvent.tab();
    await expect(input).toBeInvalid();
    await expect(within(canvasElement).getByRole('alert')).toHaveTextContent('Enter a number.');
    await expect(args.onValueChange).not.toHaveBeenCalled();
  },
};

export const OffGridDown: Story = {
  args: OffGrid.args,
  play: async ({ canvasElement, userEvent }) => {
    const input = within(canvasElement).getByRole('spinbutton');
    await userEvent.click(input);
    await userEvent.keyboard('{ArrowDown}');
    await expect(input).toHaveValue('0.1');
  },
};

const StyledField = styled(NumberField)({ inlineSize: `calc(${vars.space[8]} * 7)` });
export const CustomizationOrder: Story = {
  args: { slotProps: { root: { sx: { inlineSize: `calc(${vars.space[10]} * 4)` } } }, sx: { inlineSize: `calc(${vars.space[12]} * 5)` } },
  render: (args) => <StyledField {...args} />,
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('[data-ui="number-field"]')!.getBoundingClientRect().width).toBe(240);
  },
};
