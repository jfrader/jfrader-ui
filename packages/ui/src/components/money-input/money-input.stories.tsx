import { useRef, useState } from 'react';
import { renderToString } from 'react-dom/server';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fireEvent, fn, userEvent, waitFor, within } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { doubleRootText, expectControlHeights } from '../../testing/control-size-assertions';
import { styled } from '../../styling/styled';
import { ThemeRoot } from '../theme-root';
import { Button } from '../button';
import { expectInside, expectNoOverlap } from '../../testing/geometry-assertions';
import { MoneyInput, type MoneyInputProps } from './money-input';
import { addMinor, assertMinor, currencyChoices, moneyFormat, MONEY_LIMIT } from './money-math';

/** Compile-time slot checks; never rendered. */
function MoneyInputSlotTypeChecks() {
  return (
    <MoneyInput
      label="Amount"
      currencies={['USD']}
      slotProps={{
        control: {
          inputMode: 'decimal',
          onChange: (event) => {
            const value: string = event.currentTarget.value;
            void value;
          },
        },
        quickAddButton: { onClick: () => {}, 'aria-label': 'Add' },
      }}
    />
  );
}

type Currency = 'USD' | 'EUR';

/** Compile-time currency checks; never rendered. */
function MoneyInputCurrencyChecks() {
  return (
    <>
      <MoneyInput<Currency>
        currencies={['USD', 'EUR']}
        onCurrencyChange={(currency) => {
          const narrowed: Currency = currency;
          void narrowed;
        }}
        onValueChange={(amount, details) => {
          const narrowed: Currency = details.currency;
          void amount;
          void narrowed;
        }}
      />
      <MoneyInput
        currencies={['USD', 'EUR'] as const}
        onCurrencyChange={(currency) => {
          const narrowed: 'USD' | 'EUR' = currency;
          void narrowed;
        }}
      />
      {/* @ts-expect-error currency must be in currencies */}
      <MoneyInput<Currency> currencies={['USD', 'EUR']} currency="GBP" />
    </>
  );
}

const Lane = styled.div({ inlineSize: '100%', maxInlineSize: '32rem', display: 'grid', gap: vars.space[4] });
const NarrowLane = styled(Lane)({ maxInlineSize: '16rem' });
const Form = styled.form({ display: 'grid', gap: vars.space[3] });
const Summary = styled.output({ color: vars.color.text, fontSize: vars.textSize.sm });
const ScopedSurface = styled.div({ backgroundColor: vars.color.bg, padding: vars.space[4] });

const meta = {
  title: 'Inputs/MoneyInput',
  component: MoneyInput,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <Lane>
        <Story />
      </Lane>
    ),
  ],
  args: { label: 'Amount', currencies: ['USD'], defaultValue: 1250, locale: 'en-US' },
  parameters: {
    docs: {
      description: { component: 'Enter a payment, tip or budget amount and choose its currency.' },
      sections: [
        { title: 'Currency', stories: ['Default', 'CurrencyPicker', 'Controlled'] },
        { title: 'Locale and format', stories: ['GermanLocale', 'JPYZeroDecimals', 'KWDThreeDecimals'] },
        { title: 'Crypto and decimals', stories: ['CryptoBitcoin'] },
        { title: 'Quick add', stories: ['QuickAddMinorUnits'] },
        { title: 'Form reset', stories: ['FormReset'] },
        { title: 'States', stories: ['Error', 'ReadOnly', 'Disabled'] },
        { title: 'Constraints', stories: ['Bounds', 'MinOnBlur', 'MaxRejected'] },
      ],
      usage: `### When to use
Enter a payment, tip, or budget in integer minor units, rather than a floating-point amount. Changing currency keeps the integer; it does not convert exchange rates.

### Values and constraints

USD 12.50 is 1250, JPY 12 is 12, and KWD 12.345 is 12345. Bounds, steps, and quick additions use the same units. ISO currencies support zero to three decimal places; non-ISO assets support an explicit scale of zero to eighteen decimals. The stored integer is limited to twelve digits even at higher scales.
Supply the same explicit locale on the server and client. ISO currency support requires Intl.supportedValuesOf('currency').

### Editing and keyboard

The focused field uses ungrouped decimal text. Blur or Enter settles to a full currency string; below-minimum drafts show an error without clamping. Sub-minor precision and over-maximum edits are rejected. Escape discards the draft. ArrowUp/Down changes by \`step\`; Shift+Arrow or PageUp/Down changes by ten steps. Add buttons commit the draft and add once, clamped to the range. The currency picker uses Select's arrows, Home/End, typeahead, Enter/Space, Escape and Tab; focus stays on its trigger.

### Forms

Empty fields submit an empty string; disabled fields are omitted. Native reset restores uncontrolled amount and currency defaults without callbacks. Amount, currency, and picker visibility are independent; rejected requests do not change the submitted amount.
Give the editor a visible label or accessible name and translate full messages for your locale. Read-only fields lock the editor, currency picker, and add buttons.`,
    },
  },
} satisfies Meta<typeof MoneyInput>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Enter bitcoin amounts stored as satoshis. */
export const CryptoBitcoin: Story = {
  name: 'Enter bitcoin in satoshis',
  args: { currencies: ['BTC'], currency: 'BTC', decimals: 8, symbol: '₿', defaultValue: 1, onValueChange: fn() },
  parameters: {
    docs: {
      description: { story: 'Enter eight-decimal bitcoin amounts, store integer satoshis, and reset to one satoshi.' },
      source: {
        language: 'tsx',
        code: `import { Button, MoneyInput } from '@jfrader/ui';

<form>
  <MoneyInput label="Amount" name="amount" currencies={['BTC']} currency="BTC"
    decimals={8} symbol="₿" defaultValue={1} locale="en-US" />
  <Button type="reset">Reset</Button>
</form>`,
      },
    },
  },
  render: (args) => (
    <Form>
      <MoneyInput {...args} name="amount" />
      <Button type="reset">Reset</Button>
    </Form>
  ),
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole('spinbutton');
    const form = canvasElement.querySelector('form')!;
    await expect(input).toHaveValue('₿0.00000001');
    await expect(input).toHaveAttribute('aria-valuenow', '0.00000001');
    await expect(input).toHaveAttribute('aria-valuetext', '₿0.00000001');
    await expect(new FormData(form).get('amount')).toBe('1');
    await expect(canvas.queryByRole('combobox')).not.toBeInTheDocument();
    await userEvent.click(input);
    await expect(input).toHaveValue('0.00000001');
    await userEvent.clear(input);
    await userEvent.type(input, '0.00000001');
    await userEvent.keyboard('{Enter}');
    await expect(input).toHaveValue('₿0.00000001');
    await expect(args.onValueChange).toHaveBeenLastCalledWith(1, {
      currency: 'BTC', major: 1e-8, formatted: '₿0.00000001',
    });
    await userEvent.keyboard('{ArrowUp}');
    await expect(new FormData(form).get('amount')).toBe('2');
    await userEvent.keyboard('{ArrowDown}');
    await expect(new FormData(form).get('amount')).toBe('1');
    await userEvent.keyboard('{PageUp}');
    await expect(new FormData(form).get('amount')).toBe('11');
    await expect(args.onValueChange).toHaveBeenCalledTimes(6);
    await userEvent.click(canvas.getByRole('button', { name: 'Reset' }));
    await waitFor(() => expect(input).toHaveValue('₿0.00000001'));
    await expect(new FormData(form).get('amount')).toBe('1');
    await expect(args.onValueChange).toHaveBeenCalledTimes(6);
  },
};

/** Type bitcoin amounts with a decimal comma. */
export const CryptoDecimalComma: Story = {
  args: { currencies: ['BTC'], decimals: 8, symbol: '₿', locale: 'es-AR', defaultValue: null, step: 1 },
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByRole('spinbutton');
    await userEvent.click(input);
    await userEvent.type(input, '0,00000001');
    await expect(input).toHaveValue('0,00000001');
    await userEvent.keyboard('{Enter}');
    await expect(input).toHaveValue('₿0,00000001');
    await expect(input).toHaveAttribute('aria-valuenow', '0.00000001');
  },
};

/** Reject amounts smaller than one base unit and invalid precision settings. */
export const CryptoContract: Story = {
  args: { currencies: ['BTC'], decimals: 8, symbol: '₿', defaultValue: 1, step: 1 },
  play: async () => {
    const btc = moneyFormat('en-US', 'BTC', 'symbol', 8, '₿');
    await expect(btc.parse(btc.format(1))).toEqual({ kind: 'value', value: 1 });
    await expect(btc.parse('₿1,234.00000001')).toEqual({ kind: 'value', value: 123400000001 });
    await expect(btc.parse(' ₿0.00000001 ')).toEqual({ kind: 'value', value: 1 });
    await expect(btc.parse('₿12,34.00000001').kind).toBe('invalid');
    await expect(btc.parse('0.000000001').kind).toBe('invalid');
    await expect(btc.parse('0.0000000100')).toEqual({ kind: 'value', value: 1 });
    await expect(btc.parse('9999.99999999')).toEqual({ kind: 'value', value: MONEY_LIMIT });
    await expect(btc.parse('10000').kind).toBe('invalid');
    await expect(moneyFormat('en-US', 'custom-asset', 'symbol', 0).format(1)).toBe('custom-asset1');
    const precise = moneyFormat('en-US', 'TOKEN', 'symbol', 18);
    await expect(precise.parse(precise.format(1))).toEqual({ kind: 'value', value: 1 });
    await expect(precise.draft(1)).toBe('0.000000000000000001');
    await expect(renderToString(
      <MoneyInput currencies={['custom-asset']} decimals={18} defaultValue={1} label="Amount" />,
    )).toContain('custom-asset0.000000000000000001');
    await expect(moneyFormat('en-US', 'USD', 'symbol').parse('$1,234.50')).toEqual({ kind: 'value', value: 123450 });
    for (const decimals of [-1, 1.5, 19, NaN, Infinity]) {
      await expect(() => renderToString(
        <MoneyInput currencies={['BTC']} decimals={decimals} label="Amount" />,
      )).toThrow(RangeError);
    }
  },
};

/** Enter an amount in US dollars. */
export const Default: Story = {
  name: 'Enter a dollar amount',
  parameters: { docs: {
    description: { story: 'Edit $12.50 as decimal text and keep the stored amount in cents.' },
    source: { language: 'tsx', code: `import { MoneyInput } from '@jfrader/ui';

<MoneyInput label="Amount" currencies={['USD']} defaultValue={1250} locale="en-US" />` },
  } },
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByRole('spinbutton');
    await expect(input).toHaveValue('$12.50');
    await expect(input).toHaveAttribute('aria-valuenow', '12.5');
    await userEvent.click(input);
    await userEvent.clear(input);
    await userEvent.type(input, '12.50');
    await userEvent.keyboard('{Enter}');
    await expect(input).toHaveValue('$12.50');
  },
};
/** Compare small, medium and large editor heights. */
export const Sizes: Story = {
  render: (args) => (
    <Lane>
      {(['sm', 'md', 'lg'] as const).map((size) => (
        <MoneyInput {...args} key={size} size={size} label={`${size} amount`} />
      ))}
    </Lane>
  ),
  play: async ({ canvasElement }) => {
    const inputs = within(canvasElement).getAllByRole('spinbutton');
    for (const [index, height] of [32, 40, 48].entries())
      await expect(
        inputs[index]!.parentElement!.getBoundingClientRect().height,
      ).toBeGreaterThanOrEqual(height);
  },
};
/** Use the standard single-line editor. */
export const Standard: Story = { args: { variant: 'standard' } };
export const ControlSizeContract: Story = {
  ...Sizes,
  name: 'Control size contract',
  play: async ({ canvas }) => { await expectControlHeights(canvas.getAllByRole('spinbutton').map(input => input.parentElement!)); },
};
export const RootRelativeSizes: Story = {
  ...ControlSizeContract,
  name: 'Root-relative control sizes',
  beforeEach: doubleRootText,
  play: async ({ canvas }) => { await expectControlHeights(canvas.getAllByRole('spinbutton').map(input => input.parentElement!), [64, 80, 96]); },
};
export const TouchSizes: Story = {
  ...ControlSizeContract,
  name: 'MoneyInput touch sizes',
  tags: ['touch'],
  play: async ({ canvas }) => { await expectControlHeights(canvas.getAllByRole('spinbutton').map(input => input.parentElement!), [44, 44, 48]); },
};
/** Give a checkout total a taller editor. */
export const Prominent: Story = {
  parameters: { docs: { description: { story: 'The prominent amount editor uses an 80px height and larger text instead of the single-line size scale. Use the standard variant in a row with other controls.' } } },
  args: { variant: 'prominent', currencies: ['USD', 'JPY'] },
  play: async ({ canvas, userEvent }) => {
    const input = canvas.getByRole('spinbutton');
    const shell = input.parentElement!;
    await expectInside(input, shell);
    await expectNoOverlap(input, canvas.getByText('Amount', { selector: 'label' }));
    await expectNoOverlap(input, canvas.getByText(/Amount from/));
    await expect(shell.getBoundingClientRect().height).toBeGreaterThanOrEqual(80);
    await userEvent.click(input);
    await userEvent.tab();
    const trigger = canvas.getByRole('combobox');
    await expectInside(trigger, shell);
    await expect(trigger.ownerDocument.activeElement).toBe(trigger);
    await expect(getComputedStyle(shell).outlineStyle).not.toBe('none');
  },
};

export const LongAssetCode: Story = {
  args: { currencies: ['LONG_CUSTOM_ASSET_DENOMINATION'], decimals: 18, defaultValue: 1, quickAdd: [1] },
  render: (args) => <NarrowLane><MoneyInput {...args} /></NarrowLane>,
  play: async ({ canvas }) => {
    const input = canvas.getByRole('spinbutton');
    const root = input.closest('[data-ui="money-input"]')!;
    const currency = canvas.getByText('LONG_CUSTOM_ASSET_DENOMINATION', { selector: 'span' });
    await expectInside(currency, input.parentElement!);
    await expect(currency.scrollWidth).toBeGreaterThan(currency.clientWidth);
    await expect(getComputedStyle(currency).textOverflow).toBe('ellipsis');
    const button = canvas.getByRole('button', { name: /Add/ });
    await expectInside(button, root);
    await expect(button.scrollWidth).toBeLessThanOrEqual(button.clientWidth);
  },
};
export const LongAssetPicker: Story = {
  args: { currencies: ['LONG_CUSTOM_ASSET_DENOMINATION', 'OTHER_CUSTOM_ASSET'], decimals: 18, defaultValue: 1 },
  render: (args) => <NarrowLane><MoneyInput {...args} /></NarrowLane>,
  play: async ({ canvas, canvasElement, userEvent }) => {
    const trigger = canvas.getByRole('combobox');
    const code = canvas.getByText('LONG_CUSTOM_ASSET_DENOMINATION', { selector: 'span' });
    await expectInside(code, trigger);
    await expect(trigger.scrollWidth).toBeLessThanOrEqual(trigger.clientWidth);
    await userEvent.click(trigger);
    await userEvent.keyboard('{End}{Enter}');
    await expect(trigger).toHaveTextContent('OTHER_CUSTOM_ASSET');
    await expect(canvasElement.ownerDocument.activeElement).toBe(trigger);
  },
};
/** Leave the amount empty. */
export const Empty: Story = { args: { defaultValue: null } };
/** Zero is an amount, not an empty value. */
export const Zero: Story = { args: { defaultValue: 0 } };
/** Allow negative amounts by setting a negative minimum. */
export const Negative: Story = { args: { defaultValue: -1250, min: -100000 } };
/** Hide the visible label while keeping its accessible name. */
export const HiddenLabel: Story = { args: { hideLabel: true } };
/** Require an amount before form submission. */
export const Required: Story = {
  args: { required: true, defaultValue: null },
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByRole('spinbutton') as HTMLInputElement;
    await expect(input.validity.valid).toBe(false);
    await expect(input).toHaveAttribute('aria-invalid', 'true');
  },
};
/** Add payment instructions below the editor. */
export const Description: Story = { args: { description: 'Enter the invoice total.' } };
/** Display a form-owned validation error. */
export const Error: Story = {
  name: 'Show an amount error',
  args: { error: 'The amount exceeds your remaining budget.' },
  parameters: { docs: {
    description: { story: 'Show a form-owned budget error below the amount.' },
    source: { language: 'tsx', code: `import { MoneyInput } from '@jfrader/ui';

<MoneyInput label="Amount" currencies={['USD']} defaultValue={1250} locale="en-US"
  error="The amount exceeds your remaining budget." />` },
  } },
};
/** Store US dollars as cents. */
export const USD: Story = { args: { currencies: ['USD'] } };
/** Store Japanese yen without fractional units. */
export const JPYZeroDecimals: Story = {
  name: 'Enter whole yen',
  parameters: { docs: {
    description: { story: 'Store and display Japanese yen without fractional units.' },
    source: { language: 'tsx', code: `import { MoneyInput } from '@jfrader/ui';

<MoneyInput label="Amount" currencies={['JPY']} defaultValue={12} locale="en-US" />` },
  } },
  args: { currencies: ['JPY'], defaultValue: 12 },
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByRole('spinbutton');
    await userEvent.click(input);
    await userEvent.clear(input);
    await userEvent.type(input, '12');
    await userEvent.keyboard('{Enter}');
    await expect(input).toHaveValue('¥12');
  },
};
/** Store Kuwaiti dinars with three fractional digits. */
export const KWDThreeDecimals: Story = {
  name: 'Enter three-decimal dinars',
  parameters: { docs: {
    description: { story: 'Display 12345 minor units as 12.345 Kuwaiti dinars.' },
    source: { language: 'tsx', code: `import { MoneyInput } from '@jfrader/ui';

<MoneyInput label="Amount" currencies={['KWD']} defaultValue={12345} locale="en-US" />` },
  } },
  args: { currencies: ['KWD'], defaultValue: 12345 },
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByRole('spinbutton');
    await userEvent.click(input);
    await userEvent.clear(input);
    await userEvent.type(input, '12.345');
    await userEvent.keyboard('{Enter}');
    await expect(input).toHaveAttribute('aria-valuenow', '12.345');
  },
};
/** Choose a denomination without converting the stored integer. */
export const CurrencyPicker: Story = {
  name: 'Choose a currency',
  parameters: { docs: {
    description: { story: 'Switch between dollars, yen, and dinars without converting the stored integer.' },
    source: { language: 'tsx', code: `import { MoneyInput } from '@jfrader/ui';

<MoneyInput label="Amount" currencies={['USD', 'JPY', 'KWD']} defaultValue={1250} locale="en-US" />` },
  } },
  args: { currencies: ['USD', 'JPY', 'KWD'] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('combobox');
    await userEvent.click(trigger);
    await userEvent.keyboard('{End}{Enter}');
    await expect(canvas.getByRole('spinbutton')).toHaveAttribute('aria-valuenow', '1.25');
    await expect(trigger.ownerDocument.activeElement).toBe(trigger);
    await userEvent.keyboard('{ArrowDown}{Home}{Enter}');
    await expect(canvas.getByRole('spinbutton')).toHaveAttribute('aria-valuenow', '12.5');
  },
};
/** A single code renders as text rather than a picker. */
export const LockedCurrency: Story = {
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole('combobox')).not.toBeInTheDocument();
  },
};
/** Add 500 or 1000 cents to the current amount. */
export const QuickAddMinorUnits: Story = {
  name: 'Add fixed amounts',
  parameters: { docs: {
    description: { story: 'Add $5 or $10 to the current amount with one press.' },
    source: { language: 'tsx', code: `import { MoneyInput } from '@jfrader/ui';

<MoneyInput label="Amount" currencies={['USD']} defaultValue={0}
  quickAdd={[500, 1000]} locale="en-US" />` },
  } },
  args: { quickAdd: [500, 1000], defaultValue: 0 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Add $5.00' }));
    await expect(canvas.getByRole('spinbutton')).toHaveValue('$5.00');
  },
};
/** Below-minimum drafts remain visible with an error on blur. */
export const MinOnBlur: Story = {
  name: 'Validate a minimum amount',
  parameters: { docs: {
    description: { story: 'Enter less than $10 and leave the field to see the minimum-amount error.' },
    source: { language: 'tsx', code: `import { MoneyInput } from '@jfrader/ui';

<MoneyInput label="Amount" currencies={['USD']} defaultValue={1250} min={1000} locale="en-US" />` },
  } },
  args: { min: 1000 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole('spinbutton');
    await userEvent.click(input);
    await userEvent.clear(input);
    await userEvent.type(input, '2');
    await userEvent.tab();
    await expect(input).toHaveValue('2');
    await expect(canvas.getByRole('alert')).toHaveTextContent('Enter at least $10.00.');
  },
};
/** Over-maximum edits leave the previous text and committed amount intact. */
export const MaxRejected: Story = {
  name: 'Reject amounts above a maximum',
  parameters: { docs: {
    description: { story: 'Try an amount above $20; the previous text remains and an error appears.' },
    source: { language: 'tsx', code: `import { MoneyInput } from '@jfrader/ui';

<MoneyInput label="Amount" currencies={['USD']} defaultValue={1250} max={2000} locale="en-US" />` },
  } },
  args: { max: 2000 },
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByRole('spinbutton');
    await userEvent.click(input);
    fireEvent.change(input, { target: { value: '21' } });
    await expect(input).toHaveValue('12.5');
    await expect(input).toHaveAttribute('aria-invalid', 'true');
  },
};
/** Reject fractions smaller than one minor unit. */
export const PrecisionRejected: Story = {
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByRole('spinbutton');
    await userEvent.click(input);
    fireEvent.change(input, { target: { value: '12.501' } });
    await expect(input).toHaveValue('12.5');
    await expect(input).toHaveAttribute('aria-invalid', 'true');
    fireEvent.change(input, { target: { value: '12.5000' } });
    await expect(input).not.toHaveAttribute('aria-invalid', 'true');
  },
};
/** Keep the currency options open until a close request is accepted. */
export const PersistentCurrencyOpen: Story = {
  tags: ['!autodocs'],
  args: { currencies: ['USD', 'JPY', 'KWD'], defaultCurrencyOpen: true },
};

function ControlledExample(args: MoneyInputProps) {
  const [value, setValue] = useState<number | null>(1250);
  const [currency, setCurrency] = useState('USD');
  return (
    <MoneyInput
      {...args}
      value={value}
      currency={currency}
      onValueChange={setValue}
      onCurrencyChange={setCurrency}
    />
  );
}
/** Let the parent own amount and currency independently. */
export const Controlled: Story = {
  name: 'Control amount and currency',
  parameters: { docs: {
    description: { story: 'Keep integer minor units and the selected currency in separate React state.' },
    source: { language: 'tsx', code: `import { useState } from 'react';
import { MoneyInput } from '@jfrader/ui';

export function PaymentAmount() {
  const [value, setValue] = useState<number | null>(1250);
  const [currency, setCurrency] = useState('USD');
  return <MoneyInput label="Amount" currencies={['USD', 'JPY']} locale="en-US"
    value={value} onValueChange={setValue} currency={currency} onCurrencyChange={setCurrency} />;
}` },
  } },
  args: { currencies: ['USD', 'JPY'] },
  render: (args) => <ControlledExample {...args} />,
};
/** Seed amount and currency once with defaults. */
export const Uncontrolled: Story = {
  args: { currencies: ['USD', 'JPY'], defaultCurrency: 'JPY', defaultValue: 100 },
};
/** Reject amount requests while keeping the submitted value unchanged. */
export const RejectedAmount: Story = {
  args: { value: 1250, onValueChange: fn(), quickAdd: [500] },
  render: (args) => (
    <Form>
      <MoneyInput {...args} name="amount" />
      <Button type="button">Continue</Button>
    </Form>
  ),
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole('spinbutton');
    await userEvent.click(input);
    fireEvent.change(input, { target: { value: '15' } });
    await userEvent.keyboard('{Enter}');
    await expect(input).toHaveValue('$12.50');
    await expect(input).toHaveAttribute('aria-valuenow', '12.5');
    await expect(new FormData(canvasElement.querySelector('form')!).get('amount')).toBe('1250');
    await expect(args.onValueChange).toHaveBeenLastCalledWith(1500, {
      currency: 'USD',
      major: 15,
      formatted: '$15.00',
    });
    await userEvent.keyboard('{ArrowUp}');
    await expect(args.onValueChange).toHaveBeenLastCalledWith(1350, expect.anything());
  },
};
/** Reject currency requests without changing precision or the amount callback. */
export const RejectedCurrency: Story = {
  args: { currencies: ['USD', 'JPY'], currency: 'USD', onCurrencyChange: fn(), onValueChange: fn() },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('combobox'));
    await userEvent.keyboard('{End}{Enter}');
    await expect(args.onCurrencyChange).toHaveBeenCalledWith('JPY');
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await expect(canvas.getByRole('spinbutton')).toHaveValue('$12.50');
  },
};
function PairExample(args: MoneyInputProps) {
  const [pair, setPair] = useState({ currency: 'USD', value: 1250 });
  return (
    <Lane>
      <MoneyInput {...args} {...pair} />
      <Button onClick={() => setPair({ currency: 'JPY', value: 800 })}>Set yen amount</Button>
    </Lane>
  );
}
/** Update currency and minor units together in the parent. */
export const ExternalPairUpdate: Story = {
  args: { currencies: ['USD', 'JPY'], onValueChange: fn(), onCurrencyChange: fn() },
  render: (args) => <PairExample {...args} />,
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Set yen amount' }));
    await expect(canvas.getByRole('spinbutton')).toHaveValue('¥800');
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await expect(args.onCurrencyChange).not.toHaveBeenCalled();
  },
};
/** Native reset restores both uncontrolled defaults without callbacks. */
export const FormReset: Story = {
  name: 'Submit and reset an amount',
  parameters: { docs: {
    description: { story: 'Submit integer minor units and reset both amount and currency to their defaults.' },
    source: { language: 'tsx', code: `import { Button, MoneyInput } from '@jfrader/ui';

<form>
  <MoneyInput label="Amount" name="amount" currencies={['USD', 'JPY']}
    defaultValue={1250} locale="en-US" />
  <Button type="reset">Reset</Button>
</form>` },
  } },
  args: { currencies: ['USD', 'JPY'], onValueChange: fn(), onCurrencyChange: fn() },
  render: (args) => (
    <Form>
      <MoneyInput {...args} name="amount" />
      <Button type="reset">Reset</Button>
    </Form>
  ),
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole('spinbutton');
    await userEvent.click(input);
    await userEvent.keyboard('{ArrowUp}');
    await userEvent.click(canvas.getByRole('combobox'));
    await userEvent.keyboard('{End}{Enter}');
    await userEvent.click(canvas.getByRole('button', { name: 'Reset' }));
    await waitFor(() => expect(input).toHaveValue('$12.50'));
    await expect(new FormData(canvasElement.querySelector('form')!).get('amount')).toBe('1250');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onCurrencyChange).toHaveBeenCalledTimes(1);
  },
};
/** Merge external descriptions with range and help text. */
export const ExternalAria: Story = {
  args: { description: 'Before tax.' },
  render: (args) => (
    <Lane>
      <Summary id="money-external-help">Invoice total</Summary>
      <MoneyInput {...args} aria-describedby="money-external-help" aria-labelledby="money-external-help" />
    </Lane>
  ),
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByRole('spinbutton');
    await expect(input.getAttribute('aria-describedby')?.split(' ')).toHaveLength(3);
    await expect(input).toHaveAccessibleName('Invoice total Amount');
  },
};
/** Render zero labels, descriptions and errors. */
export const FalsyNodes: Story = { args: { label: 0, description: 0, error: 0 } };
/** Use decimal commas and euro placement from German Intl formatting. */
export const GermanLocale: Story = {
  name: 'Use decimal commas',
  parameters: { docs: {
    description: { story: 'Enter euros with German decimal separators and currency placement.' },
    source: { language: 'tsx', code: `import { MoneyInput } from '@jfrader/ui';

<MoneyInput label="Amount" currencies={['EUR']} defaultValue={1250} locale="de-DE" />` },
  } },
  args: { currencies: ['EUR'], locale: 'de-DE' },
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByRole('spinbutton');
    await userEvent.click(input);
    fireEvent.change(input, { target: { value: '12,50' } });
    await userEvent.keyboard('{Enter}');
    await expect(input).toHaveValue('12,50 €');
  },
};
/** Group Indian rupee amounts with the locale's grouping pattern. */
export const IndianLocale: Story = {
  args: { currencies: ['INR'], locale: 'hi-IN', defaultValue: 123456789 },
};
/** Enter amounts using Arabic digits and decimal separators. */
export const ArabicLocale: Story = { args: { currencies: ['EGP'], locale: 'ar-EG', dir: 'rtl' } };
/** Keep the editor readable inside a narrow form. */
export const Narrow: Story = {
  render: (args) => (
    <NarrowLane>
      <MoneyInput<string> {...args} currencies={['USD', 'JPY']} quickAdd={[500, 1000]} />
    </NarrowLane>
  ),
};
/** Use translated currency names in the settled text. */
export const LongCurrencyNames: Story = {
  args: { currencyDisplay: 'name', currencies: ['USD', 'JPY', 'KWD'] },
};
/** Show the field on the light theme. */
export const LightTheme: Story = { globals: { theme: 'light' } };
/** Keep the portaled currency options inside a scoped light theme. */
export const ScopedLightPortal: Story = {
  args: { currencies: ['USD', 'JPY'] },
  render: (args) => (
    <ThemeRoot theme="light">
      <ScopedSurface>
        <MoneyInput {...args} />
      </ScopedSurface>
    </ThemeRoot>
  ),
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('combobox'));
    const popup = within(canvasElement.ownerDocument.body).getByRole('listbox');
    await expect(popup.closest('[data-theme="light"]')).not.toBeNull();
    await userEvent.keyboard('{Escape}');
  },
};
/** Follow the root's right-to-left direction. */
export const RTL: Story = { args: { dir: 'rtl', currencies: ['USD', 'JPY'], quickAdd: [500] } };
/** Retain native borders, text and focus outlines in forced colors. */
export const ForcedColors: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Enable forced colors in your browser or operating system to inspect native outlines and text.',
      },
    },
  },
};
/** Settle immediately when the system requests reduced motion. */
export const ReducedMotion: Story = {
  parameters: {
    docs: {
      description: { story: 'Enable reduced motion in your operating system to remove color transitions.' },
    },
  },
};
/** Lock all amount-changing actions while retaining readable values. */
export const ReadOnly: Story = {
  name: 'Read-only amount',
  parameters: { docs: {
    description: { story: 'Keep the amount readable while locking editing, currency changes, and quick additions.' },
    source: { language: 'tsx', code: `import { MoneyInput } from '@jfrader/ui';

<MoneyInput label="Amount" currencies={['USD', 'JPY']} defaultValue={1250}
  locale="en-US" readOnly quickAdd={[500]} />` },
  } },
  args: { readOnly: true, currencies: ['USD', 'JPY'], quickAdd: [500] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Add $5.00' }));
    await expect(canvas.getByRole('spinbutton')).toHaveValue('$12.50');
    await expect(canvas.getByRole('combobox')).toBeDisabled();
  },
};
/** Omit disabled amounts from form submission. */
export const Disabled: Story = {
  name: 'Disabled amount',
  parameters: { docs: {
    description: { story: 'Disable the amount and omit its named value from form submission.' },
    source: { language: 'tsx', code: `import { MoneyInput } from '@jfrader/ui';

<form>
  <MoneyInput label="Amount" name="amount" currencies={['USD', 'JPY']}
    defaultValue={1250} locale="en-US" disabled quickAdd={[500]} />
</form>` },
  } },
  args: { disabled: true, quickAdd: [500], currencies: ['USD', 'JPY'] },
  render: (args) => (
    <Form>
      <MoneyInput {...args} name="amount" />
    </Form>
  ),
  play: async ({ canvasElement }) => {
    await expect(new FormData(canvasElement.querySelector('form')!).has('amount')).toBe(false);
  },
};
/** Use the keyboard across the amount, picker and add buttons. */
export const Keyboard: Story = {
  args: {
    currencies: ['USD', 'JPY', 'KWD'],
    defaultValue: 0,
    quickAdd: [500],
    max: 5000,
    onValueChange: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole('spinbutton');
    const trigger = canvas.getByRole('combobox');
    const chip = canvas.getByRole('button', { name: 'Add $5.00' });
    await userEvent.click(input);
    await userEvent.keyboard('{ArrowUp}{Shift>}{ArrowUp}{/Shift}{PageUp}{PageDown}');
    await expect(input).toHaveAttribute('aria-valuenow', '11');
    await userEvent.tab();
    await expect(input.ownerDocument.activeElement).toBe(trigger);
    await userEvent.keyboard('{ArrowDown}{End}{Home}{Escape}');
    await expect(trigger.ownerDocument.activeElement).toBe(trigger);
    await userEvent.tab();
    await expect(chip.ownerDocument.activeElement).toBe(chip);
    await expect(getComputedStyle(chip).outlineStyle).not.toBe('none');
    await userEvent.keyboard('{Enter} ');
    await expect(input).toHaveAttribute('aria-valuenow', '21');
    await userEvent.tab({ shift: true });
    await expect(trigger.ownerDocument.activeElement).toBe(trigger);
    await userEvent.tab({ shift: true });
    await expect(input.ownerDocument.activeElement).toBe(input);
    await expect(getComputedStyle(input.parentElement!).outlineStyle).not.toBe('none');
    fireEvent.compositionStart(input);
    await userEvent.keyboard('{ArrowUp}{Enter}');
    fireEvent.compositionEnd(input);
    await expect(args.onValueChange).toHaveBeenCalledTimes(6);
    await userEvent.keyboard('{Escape}');
  },
};
/** Clamp button actions to inclusive bounds without repeated amount callbacks. */
export const Bounds: Story = {
  name: 'Clamp button actions to a range',
  parameters: { docs: {
    description: { story: 'Keep arrow and quick-add actions between $1 and $2, even when adding $5.' },
    source: { language: 'tsx', code: `import { MoneyInput } from '@jfrader/ui';

<MoneyInput label="Amount" currencies={['USD']} defaultValue={100} locale="en-US"
  min={100} max={200} quickAdd={[500]} />` },
  } },
  args: { defaultValue: 100, min: 100, max: 200, quickAdd: [500], onValueChange: fn() },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole('spinbutton');
    await userEvent.click(input);
    await userEvent.keyboard('{ArrowDown}');
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await userEvent.click(canvas.getByRole('button', { name: 'Add $5.00' }));
    await expect(input).toHaveValue('$2.00');
    await userEvent.click(canvas.getByRole('button', { name: 'Add $5.00' }));
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
  },
};
/** Attach the public ref to the native editor. */
export const NativeRef: Story = {
  render: (args) => {
    const ref = useRef<HTMLInputElement>(null);
    return (
      <Lane>
        <MoneyInput {...args} ref={ref} />
        <Button onClick={() => ref.current?.focus()}>Focus amount</Button>
      </Lane>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Focus amount' }));
    await expect(canvasElement.ownerDocument.activeElement).toBe(canvas.getByRole('spinbutton'));
  },
};
/** Parse local currency text without rounding sub-minor precision. */
export const FinancialContract: Story = {
  play: async () => {
    for (const [locale, code, text, minor] of [
      ['en-US', 'USD', '12.50', 1250],
      ['en-US', 'JPY', '12', 12],
      ['en-US', 'KWD', '12.345', 12345],
      ['de-DE', 'EUR', '12,50', 1250],
      ['hi-IN', 'INR', '12,34,567.89', 123456789],
      ['ar-EG', 'EGP', '١٢٫٥٠', 1250],
      ['en-US', 'USD', '-12.50', -1250],
      ['en-US', 'USD', '12.5000', 1250],
    ] as const)
      await expect(moneyFormat(locale, code, 'symbol').parse(text)).toEqual({ kind: 'value', value: minor });
    const usd = moneyFormat('en-US', 'USD', 'symbol');
    for (const text of ['12.501', '(12.50)', '12,50', '1.234,56', '10000000000.00'])
      await expect(usd.parse(text).kind).toBe('invalid');
    await expect(usd.parse('9999999999.99')).toEqual({ kind: 'value', value: MONEY_LIMIT });
    await expect(usd.parse('.').kind).toBe('partial');
    await expect(usd.parse('-').kind).toBe('partial');
    await expect(usd.parse('').kind).toBe('empty');
    const arabic = moneyFormat('ar-EG', 'EGP', 'symbol');
    await expect(arabic.parse(arabic.format(1250))).toEqual({ kind: 'value', value: 1250 });
    await expect(addMinor(10, 20, 0, 100)).toBe(30);
    for (const value of [1.5, Number.MAX_SAFE_INTEGER, MONEY_LIMIT + 1])
      await expect(() => assertMinor(value, 'value')).toThrow();
    await expect(() => assertMinor(0, 'step', true)).toThrow();
    for (const codes of [[], ['USD', 'USD'], ['ZZZ'], ['usd']])
      await expect(() => currencyChoices(codes)).toThrow();
  },
};

/** Keep a controlled picker open when the parent rejects a close request. */
export const RejectedCurrencyClose: Story = {
  tags: ['!autodocs'],
  args: { currencies: ['USD', 'JPY'], currencyOpen: true, onCurrencyOpenChange: fn() },
  play: async ({ canvasElement, args }) => {
    const trigger = within(canvasElement).getByRole('combobox');
    await userEvent.click(trigger);
    await userEvent.keyboard('{Escape}');
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await expect(trigger.ownerDocument.activeElement).toBe(trigger);
    await expect(args.onCurrencyOpenChange).toHaveBeenCalledWith(false);
  },
};

/** Search currencies by name and leave the picker with Tab. */
export const CurrencyKeyboard: Story = {
  args: { currencies: ['USD', 'JPY', 'KWD'], quickAdd: [500] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('combobox');
    await userEvent.click(canvas.getByRole('spinbutton'));
    await userEvent.tab();
    await expect(trigger.ownerDocument.activeElement).toBe(trigger);
    await expect(
      getComputedStyle(canvas.getByRole('spinbutton').parentElement!).outlineStyle,
    ).not.toBe('none');
    await userEvent.keyboard('j{Enter}');
    await expect(canvas.getByRole('spinbutton')).toHaveValue('¥1,250');
    await expect(trigger.ownerDocument.activeElement).toBe(trigger);
    await userEvent.keyboard('{ArrowDown}');
    await userEvent.tab();
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(trigger.ownerDocument.activeElement).toBe(canvas.getByRole('button', { name: 'Add ¥500' }));
  },
};

/** Submit zero and empty values without losing their distinction. */
export const CanonicalFormValues: Story = {
  args: { defaultValue: 0, onValueChange: fn() },
  render: (args) => (
    <Form>
      <MoneyInput {...args} name="amount" />
      <Button type="button">Continue</Button>
    </Form>
  ),
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const form = canvasElement.querySelector('form')!;
    const input = canvas.getByRole('spinbutton');
    await expect(new FormData(form).get('amount')).toBe('0');
    await userEvent.click(input);
    await userEvent.clear(input);
    await expect(new FormData(form).get('amount')).toBe('');
    fireEvent.change(input, { target: { value: '12.50' } });
    await userEvent.keyboard('{Enter}');
    await userEvent.tab();
    await expect(new FormData(form).get('amount')).toBe('1250');
    await expect(args.onValueChange).toHaveBeenCalledTimes(2);
    await expect(args.onValueChange).toHaveBeenLastCalledWith(1250, {
      currency: 'USD',
      major: 12.5,
      formatted: '$12.50',
    });
  },
};

/** Preserve negative signs and discard unresolved drafts with Escape. */
export const NegativeEditing: Story = {
  args: { min: -100000, defaultValue: -1250 },
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByRole('spinbutton');
    await userEvent.click(input);
    fireEvent.change(input, { target: { value: '-20.25' } });
    await userEvent.keyboard('{Enter}');
    await expect(input).toHaveValue('-$20.25');
    await userEvent.click(input);
    fireEvent.change(input, { target: { value: '-' } });
    await userEvent.keyboard('{Enter}');
    await expect(input).toHaveValue('-');
    await expect(input).toHaveAttribute('aria-valuenow', '-20.25');
    await expect(input).toHaveAttribute('aria-invalid', 'true');
    await userEvent.keyboard('{Escape}');
    await expect(input).toHaveValue('-$20.25');
  },
};
