import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn } from 'storybook/test';
import { PaymentFlow, type PaymentFlowProps } from './payment-flow';
import { paymentAmounts } from './payment-flow-model';
import { vars } from '@jfrader/tokens/vars';
import { styled } from '../../styling/styled';
import { Surface } from '../surface';

const PaymentPanel = styled(Surface)({
  boxSizing: 'border-box',
  inlineSize: `calc(${vars.space[8]} * 30)`,
  maxInlineSize: '100%',
  padding: vars.space[6],
});

function narrative(args: PaymentFlowProps) {
  const amounts = paymentAmounts(args.amount, args.fee, args.balance, args.currency, args.locale);
  if (!amounts) return args.summary;
  const duration = new Intl.NumberFormat(args.locale, {
    style: 'unit',
    unit: 'millisecond',
  }).format(args.authorizationMs);
  return [
    {
      id: 'authorize',
      content: `${args.nodes.terminal.label} sends ${amounts.gross} through ${args.nodes.processor.label} and ${args.nodes.network.label} to ${args.nodes.issuer.label}.`,
    },
    {
      id: 'approve',
      content: `${args.nodes.issuer.label} returns approval in an illustrative ${duration}.`,
    },
    { id: 'clear', content: `${args.nodes.processor.label} clears ${amounts.gross}.` },
    { id: 'fee', content: `A ${amounts.fee} fee leaves ${amounts.net} net.` },
    {
      id: 'payout',
      content: `${args.nodes.merchant.label} balance changes from ${amounts.initial} to ${amounts.final}. ${args.labels.settlementTime}.`,
    },
  ];
}

const meta = {
  title: 'Showcase/PaymentFlow',
  component: PaymentFlow,
  tags: ['autodocs'],
  render: (args) => (
    <PaymentPanel>
      <PaymentFlow {...args} summary={narrative(args)} />
    </PaymentPanel>
  ),
  args: {
    orientation: 'horizontal',
    label: 'Illustrative card payment',
    nodes: {
      terminal: { label: 'Terminal' },
      processor: { label: 'Processor' },
      network: { label: 'Network' },
      issuer: { label: 'Issuer' },
      merchant: { label: 'Merchant' },
    },
    amount: 100,
    fee: 3,
    balance: 20,
    currency: 'USD',
    locale: 'en-US',
    authorizationMs: 240,
    labels: {
      authorize: 'Authorize',
      approve: 'Approve',
      clear: 'Clear',
      fee: 'Deduct fee',
      payout: 'Payout',
      approval: 'Approved',
      settlementTime: 'Illustrative settlement: two days',
    },
    summary: [
      {
        id: 'authorize',
        content: 'Terminal sends USD 100 through the processor and network to the issuer.',
      },
      {
        id: 'approve',
        content:
          'Issuer returns approval through the network and processor in an illustrative 240 milliseconds.',
      },
      { id: 'clear', content: 'Processor clears USD 100.' },
      { id: 'fee', content: 'A USD 3 fee leaves USD 97 net.' },
      {
        id: 'payout',
        content: 'Merchant balance changes from USD 20 to USD 117 after an illustrative two days.',
      },
    ],
    controlLabels: {
      group: 'Playback',
      pause: 'Pause',
      resume: 'Resume',
      step: 'Next phase',
      replay: 'Replay',
    },
    emptyContent: 'Add all five actors.',
    invalidContent: 'Check amounts, currency and steps.',
    onPausedChange: fn(),
  },
  parameters: {
    docs: {
      description: {
        component:
          'Explain authorization, approval, clearing, fees and merchant payout. The figure uses supplied actors, amounts and a mandatory ordered narrative.',
      },
      usage:
        '### Values\nThis is an illustration, not checkout, a payment API, a ledger or actual settlement status. Supply at least five summary steps covering actors, gross amount, fee, net, balance and timing. Keep the summary synchronized with the supplied numbers and labels. `summaryVisibility="sr-only"` keeps that narrative available to assistive technology.\n\nCurrency precision comes from Intl. Amount, fee and balance round independently to minor units; net is rounded amount minus rounded fee. Values must be finite, nonnegative safe integers after conversion; fee cannot exceed amount. Invalid currency or unsafe totals render `invalidContent`; missing actors render `emptyContent`. Use an explicit locale for SSR.\n\n### Playback\nPause is controlled or uncontrolled. Replay resets the illustration and supplied initial balance, never pause state. Reduced motion starts at payout; Next phase and Replay select static snapshots. Hidden, offscreen and zero-size figures stop scheduling and resume without catch-up. Each equal phase takes one fifth of a 15-second cycle at speed 1. Stage changes are discrete; no animated money transfer or continuous balance counter is shown.\n\n### Keyboard\nTab and Shift+Tab reach native Pause, Next phase and Replay buttons. Enter and Space activate once. Next phase is disabled while running. No scene shortcuts or focus movement.\n\n### Customization\n`component` aliases `slots.root`. Native slots: root, scene, node, summary, summaryItem, controls and caption. The scene is decorative. Adopted slots: journey ([Stepper](?path=/docs/navigation-stepper--docs)), pauseButton, stepButton and replayButton ([Button](?path=/docs/actions-button--docs)). Forward props/ref to the corresponding primitive when replacing it. [Card](?path=/docs/surfaces-card--docs) frames the visual composition. Slot props accept `css`; root accepts `sx`.',
      source: {
        language: 'tsx',
        code: '<PaymentFlow nodes={actors} amount={100} fee={3} balance={20} currency="USD" locale="en-US" authorizationMs={240} labels={labels} summary={steps} label="Illustrative card payment" controlLabels={playbackLabels} emptyContent="Add all five actors." invalidContent="Check payment illustration values." />',
      },
    },
  },
} satisfies Meta<typeof PaymentFlow>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const figure = canvasElement.querySelector('figure')!;
    await expect(figure.getBoundingClientRect().width).toBeGreaterThan(600);
    const journey = figure.querySelector('[data-ui~="stepper"]')!;
    await expect(journey.getBoundingClientRect().width).toBeGreaterThan(600);
    await expect(journey).toHaveAttribute('data-orientation', 'horizontal');
  },
};
export const Paused: Story = { args: { defaultPaused: true } };
export const LongAuthorization: Story = {
  args: { defaultPaused: true, authorizationMs: 5_000 },
  play: async ({ canvas, args }) => {
    const duration = new Intl.NumberFormat(args.locale, {
      style: 'unit',
      unit: 'millisecond',
    }).format(args.authorizationMs);
    await expect(canvas.getByRole('list')).toHaveTextContent(duration);
    await expect(canvas.getByText(duration, { exact: false, selector: 'div' })).toBeVisible();
  },
};
export const Horizontal: Story = { args: { orientation: 'horizontal' } };
export const Vertical: Story = { args: { orientation: 'vertical' } };
export const Light: Story = { globals: { theme: 'light' } };
export const RTL: Story = { args: { dir: 'rtl', locale: 'ar' } };
export const SummarySrOnly: Story = {
  args: { summaryVisibility: 'sr-only' },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('list')).toBeInTheDocument();
    await expect(canvas.getByRole('list')).not.toHaveAttribute('aria-hidden');
  },
};
export const CaptionZero: Story = {
  args: { caption: 0 },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('figcaption')).toHaveTextContent('0');
  },
};
export const ZeroAmountFee: Story = { args: { amount: 0, fee: 0, balance: 0 } };
export const FeeEqualsAmount: Story = { args: { fee: 100 } };
export const JPY: Story = { args: { currency: 'JPY', amount: 100.4, fee: 3.4 } };
export const KWD: Story = { args: { currency: 'KWD', amount: 100.123, fee: 3.111 } };
export const LocaleDe: Story = { args: { locale: 'de-DE', currency: 'EUR' } };
export const InvalidCurrency: Story = {
  args: { currency: 'invalid' },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Check amounts, currency and steps.')).toBeVisible();
    await expect(canvas.queryByRole('button')).not.toBeInTheDocument();
  },
};
export const UnsafeAmount: Story = { args: { amount: Number.MAX_SAFE_INTEGER } };
export const MissingNode: Story = {
  args: { nodes: { ...meta.args.nodes, merchant: { label: '' } } },
};
export const KeyboardReplay: Story = {
  args: { defaultPaused: true },
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    const pause = canvas.getByRole('button', { name: 'Resume' });
    pause.focus();
    await userEvent.tab();
    const step = canvas.getByRole('button', { name: 'Next phase' });
    await expect(step.ownerDocument.activeElement).toBe(step);
    await userEvent.keyboard('{Enter}');
    await expect(canvasElement.querySelector('figure')).toHaveAttribute('data-phase', 'approve');
    await expect(
      canvasElement.querySelector('[data-ui~="payment-flow-node"][data-active="true"]'),
    ).toHaveTextContent('Issuer');
    await userEvent.keyboard(' ');
    await expect(canvasElement.querySelector('figure')).toHaveAttribute('data-phase', 'clear');
    await userEvent.tab();
    const replay = canvas.getByRole('button', { name: 'Replay' });
    await expect(replay.ownerDocument.activeElement).toBe(replay);
    await expect(replay.ownerDocument.defaultView!.getComputedStyle(replay).outlineStyle).not.toBe(
      'none',
    );
    await userEvent.keyboard('{Enter}');
    await expect(canvasElement.querySelector('figure')).toHaveAttribute('data-phase', 'authorize');
    await expect(canvas.getByRole('button', { name: 'Resume' })).toBeVisible();
    await expect(args.onPausedChange).not.toHaveBeenCalled();
    await userEvent.tab({ shift: true });
    await expect(step.ownerDocument.activeElement).toBe(step);
  },
};
export const ControlledPauseRejects: Story = {
  args: { paused: false },
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Pause' }));
    await expect(args.onPausedChange).toHaveBeenCalledTimes(1);
    await expect(args.onPausedChange).toHaveBeenCalledWith(true);
    await expect(canvas.getByRole('button', { name: 'Pause' })).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'Next phase' })).toBeDisabled();
  },
};
export const SpeedZero: Story = {
  args: { speed: 0 },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('button', { name: 'Next phase' })).toBeEnabled();
  },
};

export const IntlAndMinorUnits: Story = {
  args: { defaultPaused: true, currency: 'KWD', amount: 12.345, fee: 1.111 },
  play: async ({ canvas, canvasElement, userEvent }) => {
    const expected = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'KWD' });
    await expect(
      canvasElement.querySelector('[data-ui~="payment-flow-node"] bdi')?.textContent,
    ).toBe(expected.format(12.345));
    for (let i = 0; i < 4; i++)
      await userEvent.click(canvas.getByRole('button', { name: 'Next phase' }));
    await expect(
      canvasElement.querySelector('[data-ui~="payment-flow-node"]:last-child bdi')?.textContent,
    ).toBe(expected.format(31.234));
    await userEvent.click(canvas.getByRole('button', { name: 'Replay' }));
    await expect(
      canvasElement.querySelector('[data-ui~="payment-flow-node"]:last-child bdi')?.textContent,
    ).toBe(expected.format(20));
    await expect(paymentAmounts(100.4, 3.4, 20, 'JPY', 'ja-JP')).toMatchObject({
      final: new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(117),
    });
    await expect(paymentAmounts(0, 0, 0, 'USD')).not.toBeNull();
    await expect(paymentAmounts(1, 2, 0, 'USD')).toBeNull();
    await expect(paymentAmounts(Number.POSITIVE_INFINITY, 0, 0, 'USD')).toBeNull();
    await expect(paymentAmounts(Number.MAX_SAFE_INTEGER, 0, 0, 'USD')).toBeNull();
    await expect(paymentAmounts(1, 0, 0, 'invalid')).toBeNull();
    await expect(paymentAmounts(1, 0, 0, 'ZZZ')).toBeNull();
  },
};
