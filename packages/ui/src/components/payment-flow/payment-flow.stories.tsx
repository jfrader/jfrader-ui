import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { styled } from '../../styling/styled';
import { expectMirroredDirection } from '../../testing/geometry-assertions';
import { mockReducedMotion } from '../../testing/reduced-motion';
import { findWordBreaks } from '../../testing/text-wrap-assertions';
import { Surface } from '../surface';
import { PaymentFlow, type PaymentFlowProps } from './payment-flow';
import { paymentFlowDensities } from './payment-flow-density';
import { paymentAmounts } from './payment-flow-model';

const PaymentPanel = styled(Surface)({
  boxSizing: 'border-box',
  inlineSize: '100%',
  maxInlineSize: `calc(${vars.space[8]} * 30)`,
  marginInline: 'auto',
  padding: vars.space[6],
});
const MediumPanel = styled(PaymentPanel)({ maxInlineSize: `calc(${vars.space[8]} * 20)` });
const NarrowPanel = styled(PaymentPanel)({ maxInlineSize: `calc(${vars.space[8]} * 11)` });
const PanelStack = styled.div({ display: 'grid', gap: vars.space[6] });

function narrative({ nodes, amount, fee, balance, currency, locale, authorizationMs, labels }: PaymentFlowProps) {
  const money = new Intl.NumberFormat(locale, { style: 'currency', currency });
  const duration = new Intl.NumberFormat(locale, { style: 'unit', unit: 'millisecond' }).format(authorizationMs);
  const [gross, deduction, net, initial, final] = [amount, fee, amount - fee, balance, balance + amount - fee].map(
    (value) => money.format(value),
  );
  return [
    { id: 'authorize', content: `${nodes.terminal.label} sends ${gross} through ${nodes.processor.label} and ${nodes.network.label} to ${nodes.issuer.label}.` },
    { id: 'approve', content: `${nodes.issuer.label} returns approval in an illustrative ${duration}.` },
    { id: 'clear', content: `${nodes.processor.label} clears ${gross}.` },
    { id: 'fee', content: `A ${deduction} fee leaves ${net} net.` },
    { id: 'payout', content: `${nodes.merchant.label} balance changes from ${initial} to ${final}. ${labels.settlementTime}.` },
  ];
}
function summaryFor(args: PaymentFlowProps) {
  try {
    return narrative(args);
  } catch {
    return args.summary;
  }
}

const exampleSetup = `import { PaymentFlow, Surface, styled, type PaymentFlowProps } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const PaymentPanel = styled(Surface)({
  boxSizing: 'border-box', inlineSize: '100%',
  maxInlineSize: \`calc(\${vars.space[8]} * 30)\`, marginInline: 'auto', padding: vars.space[6],
});
const nodes = {
  terminal: { label: 'Terminal' }, processor: { label: 'Processor' },
  network: { label: 'Network' }, issuer: { label: 'Issuer' }, merchant: { label: 'Merchant' },
};
const labels = {
  authorize: 'Authorize', approve: 'Approve', clear: 'Clear', fee: 'Deduct fee', payout: 'Payout',
  approval: 'Approved', settlementTime: 'Illustrative settlement: two days',
};
const controlLabels = { group: 'Playback', pause: 'Pause', resume: 'Resume', step: 'Next phase', replay: 'Replay' };

// One narrative entry per phase, kept in step with the amounts the figure shows.
function narrative({ amount, fee, balance, currency, locale, authorizationMs }: Pick<PaymentFlowProps,
  'amount' | 'fee' | 'balance' | 'currency' | 'locale' | 'authorizationMs'>) {
  const money = new Intl.NumberFormat(locale, { style: 'currency', currency });
  const duration = new Intl.NumberFormat(locale, { style: 'unit', unit: 'millisecond' }).format(authorizationMs);
  const [gross, deduction, net, initial, final] = [amount, fee, amount - fee, balance, balance + amount - fee]
    .map((value) => money.format(value));
  return [
    { id: 'authorize', content: \`Terminal sends \${gross} through Processor and Network to Issuer.\` },
    { id: 'approve', content: \`Issuer returns approval in an illustrative \${duration}.\` },
    { id: 'clear', content: \`Processor clears \${gross}.\` },
    { id: 'fee', content: \`A \${deduction} fee leaves \${net} net.\` },
    { id: 'payout', content: \`Merchant balance changes from \${initial} to \${final}. \${labels.settlementTime}.\` },
  ];
}
`;

const defaultValues: Record<string, string> = {
  amount: '{100}',
  fee: '{3}',
  balance: '{20}',
  currency: '"USD"',
  locale: '"en-US"',
  authorizationMs: '{240}',
};

/** Authored usage for one example: the default values with `overrides` applied. */
function exampleSource(overrides: Record<string, string> = {}, wrap = (flow: string) => `<PaymentPanel>\n${flow}\n</PaymentPanel>`) {
  const values = { ...defaultValues, ...overrides };
  const value = (key: string) => values[key]!.replace(/^\{|\}$/g, '').replace(/^"(.*)"$/, "'$1'");
  const extra = Object.entries(values)
    .filter(([key]) => !(key in defaultValues))
    .map(([key, raw]) => (raw === 'true' ? key : `${key}=${raw}`));
  const flow = [
    `  <PaymentFlow${extra.length ? ` ${extra.join(' ')}` : ''}`,
    `    nodes={nodes} amount=${values.amount} fee=${values.fee} balance=${values.balance}`,
    `    currency=${values.currency} locale=${values.locale} authorizationMs=${values.authorizationMs} labels={labels}`,
    `    summary={narrative({ amount: ${value('amount')}, fee: ${value('fee')}, balance: ${value('balance')}, currency: ${value('currency')}, locale: ${value('locale')}, authorizationMs: ${value('authorizationMs')} })}`,
    `    label="Illustrative card payment" controlLabels={controlLabels}`,
    `    emptyContent="Add all five actors." invalidContent="Check amounts, currency and steps." />`,
  ].join('\n');
  return { language: 'tsx', code: `${exampleSetup}\n${wrap(flow)}` };
}

const germanNodes = {
  terminal: { label: 'Terminal' },
  processor: { label: 'Zahlungsabwickler' },
  network: { label: 'Kartennetzwerk' },
  issuer: { label: 'Kartenaussteller' },
  merchant: { label: 'Händler' },
};
const germanLabels = {
  authorize: 'Autorisieren',
  approve: 'Genehmigen',
  clear: 'Verrechnen',
  fee: 'Gebühr abziehen',
  payout: 'Auszahlung',
  approval: 'Genehmigt',
  settlementTime: 'Illustrative Abrechnung: zwei Tage',
};
const germanControls = {
  group: 'Wiedergabe',
  pause: 'Anhalten',
  resume: 'Fortsetzen',
  step: 'Nächste Phase',
  replay: 'Wiederholen',
};
const germanSummary = [
  { id: 'authorize', content: 'Das Terminal sendet 100,00 € über Zahlungsabwickler und Kartennetzwerk an den Kartenaussteller.' },
  { id: 'approve', content: 'Der Kartenaussteller genehmigt in illustrativen 240 ms.' },
  { id: 'clear', content: 'Der Zahlungsabwickler verrechnet 100,00 €.' },
  { id: 'fee', content: 'Eine Gebühr von 3,00 € lässt 97,00 € netto.' },
  { id: 'payout', content: 'Das Händlerguthaben steigt von 20,00 € auf 117,00 €. Illustrative Abrechnung: zwei Tage.' },
];

const SweepHost = styled.div({ display: 'grid', gap: vars.space[6], inlineSize: '100%' });
const SWEEP = { from: 320, to: 1440, step: 8 };
// A connector shorter than this reads as collapsed; the tightest density keeps 16px.
const MIN_CONNECTOR_PX = 16;
const nextFrame = (view: Window) => new Promise<void>((resolve) => view.requestAnimationFrame(() => resolve()));
const axisOf = (elements: Element[]) => {
  const first = elements[0]!.getBoundingClientRect();
  const last = elements.at(-1)!.getBoundingClientRect();
  return Math.abs(first.top - last.top) < 1 ? 'horizontal' : 'vertical';
};

/** Lists what is wrong with one figure at its current width: orientation, breaks, clipping, connectors. */
function layoutProblems(figure: HTMLElement, context: string) {
  const problems: string[] = [];
  const scene = figure.querySelector<HTMLElement>('[data-ui="payment-flow-scene"]')!;
  const nodes = [...figure.querySelectorAll('[data-ui~="payment-flow-node"]')];
  const phases = [...figure.querySelectorAll('[data-ui~="payment-flow-phase"]')];
  const orientation = scene.dataset.orientation;
  if (axisOf(nodes) !== orientation || axisOf(phases) !== orientation)
    problems.push(`${context}: actors ${axisOf(nodes)}, phases ${axisOf(phases)}, scene ${orientation}`);
  for (const pair of findWordBreaks(figure)) problems.push(`${context}: word break ${pair}`);
  if (scene.scrollWidth > scene.clientWidth) problems.push(`${context}: scene overflows ${scene.scrollWidth}/${scene.clientWidth}`);
  for (const part of figure.querySelectorAll<HTMLElement>('[data-ui="payment-flow-node-label"], [data-ui="payment-flow-amount"], [data-ui="payment-flow-phase-label"]')) {
    const box = part.getBoundingClientRect();
    const owner = part.closest('[data-ui~="payment-flow-node"], [data-ui~="payment-flow-phase"]')!.getBoundingClientRect();
    if (part.scrollWidth > part.clientWidth + 1 || box.left < owner.left - 1 || box.right > owner.right + 1)
      problems.push(`${context}: ${part.textContent} clipped or outside its box`);
  }
  const horizontal = orientation === 'horizontal';
  for (const group of [nodes, phases]) {
    for (let index = 1; index < group.length; index += 1) {
      const before = group[index - 1]!.getBoundingClientRect();
      const after = group[index]!.getBoundingClientRect();
      const space = horizontal ? Math.max(after.left - before.right, before.left - after.right) : after.top - before.bottom;
      if (space < MIN_CONNECTOR_PX) problems.push(`${context}: connector ${index} is ${space}px`);
    }
  }
  const frame = figure.getBoundingClientRect();
  for (const button of figure.querySelectorAll('button')) {
    const box = button.getBoundingClientRect();
    if (box.left < frame.left - 1 || box.right > frame.right + 1) problems.push(`${context}: ${button.textContent} outside the figure`);
  }
  return problems;
}

/** Checks one figure at its current width: one orientation, nothing broken, clipped or collapsed. */
async function expectReadableLayout(figure: HTMLElement, context: string) {
  await expect(layoutProblems(figure, context)).toEqual([]);
}

const meta = {
  title: 'Showcase/PaymentFlow',
  component: PaymentFlow,
  tags: ['autodocs'],
  render: (args) => (
    <PaymentPanel>
      <PaymentFlow {...args} summary={summaryFor(args)} />
    </PaymentPanel>
  ),
  beforeEach: () => mockReducedMotion(false),
  args: {
    orientation: 'auto',
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
      { id: 'authorize', content: 'Terminal sends the charge through Processor and Network to Issuer.' },
      { id: 'approve', content: 'Issuer returns approval.' },
      { id: 'clear', content: 'Processor clears the charge.' },
      { id: 'fee', content: 'A fee leaves the net amount.' },
      { id: 'payout', content: 'Merchant balance grows by the net amount.' },
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
    layout: 'padded',
    docs: {
      description: {
        component: 'Explain how a card payment moves from authorization to merchant payout.',
      },
      sections: [
        { title: 'Layout', stories: ['Default', 'ContainerWidths', 'Vertical', 'Light', 'RTL'] },
        { title: 'Playback', stories: ['Paused', 'LongAuthorization', 'KeyboardReplay', 'SpeedZero', 'ControlledPauseRejects'] },
        { title: 'Currency and locale', stories: ['JPY', 'KWD', 'LocaleDe', 'IntlAndMinorUnits'] },
        { title: 'Amounts and fees', stories: ['ZeroAmountFee', 'FeeEqualsAmount'] },
        { title: 'Accessible narrative and caption', stories: ['SummarySrOnly', 'CaptionZero'] },
        { title: 'Invalid and missing values', stories: ['InvalidCurrency', 'UnsafeAmount', 'MissingNode'] },
      ],
      usage: `### Layout
The figure takes the roomiest density whose actor and phase labels fit on one line: actors above phases, the same rows tighter, actors beside phases, then actors above phases in one column. Both groups always share one orientation. Labels never wrap inside a word; only the one-column layout wraps them, at spaces. Set \`orientation="vertical"\` to keep the two vertical layouts.

### Values and constraints
This is an illustration, not checkout, a payment API, a ledger or actual settlement status. Supply one narrative entry per phase, five in total, covering actors, gross amount, fee, net, balance and timing. Keep the narrative in step with the numbers and labels, including when it is visually hidden.

Currency precision comes from Intl. Amount, fee and balance round independently to minor units; net is rounded amount minus rounded fee. Values must be finite, nonnegative safe integers after conversion, and fee cannot exceed amount. Invalid currency or unsafe totals show the invalid fallback; missing actors show the empty fallback. Use the same explicit locale for server and client rendering.

### Playback
Replay resets the illustration and initial balance, never pause state. Reduced motion starts at payout; Next phase and Replay select static snapshots. Hidden, offscreen and zero-size figures stop scheduling and resume without catch-up. Each phase takes one fifth of a 15-second cycle at speed 1. Stage changes are discrete; no money moves between actors and no balance counts up.

### Keyboard and accessibility
Tab and Shift+Tab reach Pause, Next phase and Replay. Enter and Space activate once. Next phase is disabled while playback runs. Next phase and Replay announce the selected phase and its narrative entry politely; automatic playback announces nothing. Focus never moves on its own.`,
      source: exampleSource(),
    },
  },
} satisfies Meta<typeof PaymentFlow>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Card payment journey',
  parameters: { docs: { description: { story: 'Follow authorization, approval, clearing, fees and payout with a readable narrative.' } } },
  play: async ({ canvasElement }) => {
    const figure = canvasElement.querySelector<HTMLElement>('figure')!;
    await expectReadableLayout(figure, `${Math.round(figure.getBoundingClientRect().width)}px`);
    await expect(figure).toHaveAttribute('data-density', figure.querySelector('[data-ui="payment-flow-scene"]')!.getAttribute('data-density'));
    const scene = figure.querySelector('[data-ui="payment-flow-scene"]')!.getBoundingClientRect();
    const readout = figure.querySelector('[data-ui="payment-flow-readout"]')!.getBoundingClientRect();
    const stage = figure.querySelector('[data-ui~="card"]')!.getBoundingClientRect();
    const summary = figure.querySelector('[data-ui="payment-flow-summary"]')!.getBoundingClientRect();
    const controls = figure.querySelector('[data-ui="payment-flow-controls"]')!.getBoundingClientRect();
    const innerGap = readout.top - scene.bottom;
    const groupGap = summary.top - stage.bottom;
    await expect(innerGap).toBeGreaterThan(0);
    await expect(controls.top - summary.bottom).toBeCloseTo(groupGap);
    await expect(groupGap).toBeGreaterThan(innerGap);
  },
};

export const ContainerWidths: Story = {
  name: 'Density follows the container',
  parameters: {
    docs: {
      description: { story: 'Place the same figure in a wide, a medium and a narrow panel to see each density.' },
      source: exampleSource({}, (flow) => {
        const panel = (tag: string) => `<${tag}>\n${flow.replace(/^/gm, '  ')}\n</${tag}>`;
        return `const MediumPanel = styled(PaymentPanel)({ maxInlineSize: \`calc(\${vars.space[8]} * 20)\` });
const NarrowPanel = styled(PaymentPanel)({ maxInlineSize: \`calc(\${vars.space[8]} * 11)\` });

<>
${[panel('PaymentPanel'), panel('MediumPanel'), panel('NarrowPanel')].join('\n').replace(/^/gm, '  ')}
</>`;
      }),
    },
  },
  args: { defaultPaused: true },
  render: (args) => (
    <PanelStack>
      <PaymentPanel>
        <PaymentFlow {...args} summary={summaryFor(args)} />
      </PaymentPanel>
      <MediumPanel>
        <PaymentFlow {...args} summary={summaryFor(args)} />
      </MediumPanel>
      <NarrowPanel>
        <PaymentFlow {...args} summary={summaryFor(args)} />
      </NarrowPanel>
    </PanelStack>
  ),
  play: async ({ canvasElement }) => {
    const figures = [...canvasElement.querySelectorAll<HTMLElement>('figure')];
    const ranks = figures.map((figure) => paymentFlowDensities.indexOf(figure.dataset.density as never));
    await expect(ranks.every((rank) => rank >= 0)).toBe(true);
    await expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    for (const [index, figure] of figures.entries()) await expectReadableLayout(figure, `panel ${index}`);
  },
};

export const Vertical: Story = {
  name: 'Vertical payment journey',
  parameters: {
    docs: {
      description: { story: 'Keep actors and phases vertical at every width.' },
      source: exampleSource({ orientation: '"vertical"' }),
    },
  },
  args: { orientation: 'vertical' },
  play: async ({ canvasElement }) => {
    const figure = canvasElement.querySelector<HTMLElement>('figure')!;
    await expect(figure.querySelector('[data-ui="payment-flow-scene"]')).toHaveAttribute('data-orientation', 'vertical');
    await expectReadableLayout(figure, 'vertical');
  },
};

export const Light: Story = {
  name: 'Light theme',
  globals: { theme: 'light' },
  parameters: { docs: { description: { story: 'Show the journey on the light theme.' }, source: exampleSource() } },
};

export const RTL: Story = {
  name: 'Right-to-left',
  parameters: {
    docs: {
      description: { story: 'Run the journey from the inline start in a right-to-left document.' },
      source: exampleSource({ dir: '"rtl"', locale: '"ar"' }),
    },
  },
  args: { dir: 'rtl', locale: 'ar', defaultPaused: true },
  play: async ({ canvasElement }) => {
    const figure = canvasElement.querySelector<HTMLElement>('figure')!;
    await expectReadableLayout(figure, 'rtl');
    await expectMirroredDirection(figure, '[data-ui~="payment-flow-node"], [data-ui~="payment-flow-phase"]');
  },
};

export const Paused: Story = {
  name: 'Explore payment phases',
  parameters: {
    docs: {
      description: { story: 'Start paused and advance one payment phase at a time.' },
      source: exampleSource({ defaultPaused: 'true' }),
    },
  },
  args: { defaultPaused: true },
};

export const LongAuthorization: Story = {
  name: 'Long authorization time',
  parameters: {
    docs: {
      description: { story: 'Show a slower illustrative authorization in the readout and the narrative.' },
      source: exampleSource({ authorizationMs: '{5000}', defaultPaused: 'true' }),
    },
  },
  args: { defaultPaused: true, authorizationMs: 5_000 },
  play: async ({ canvasElement, args }) => {
    const duration = new Intl.NumberFormat(args.locale, { style: 'unit', unit: 'millisecond' }).format(args.authorizationMs);
    await expect(canvasElement.querySelector('[data-ui="payment-flow-summary"]')).toHaveTextContent(duration);
    await expect(canvasElement.querySelector('[data-ui="payment-flow-readout"]')).toHaveTextContent(duration);
  },
};

export const KeyboardReplay: Story = {
  name: 'Step with the keyboard',
  parameters: {
    docs: {
      description: { story: 'Tab to Next phase and press Enter or Space; Replay returns to authorization.' },
      source: exampleSource({ defaultPaused: 'true' }),
    },
  },
  args: { defaultPaused: true },
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    const figure = canvasElement.querySelector('figure')!;
    const live = figure.querySelector('[data-ui="payment-flow-live"]')!;
    await expect(live).toHaveAttribute('aria-live', 'polite');
    await expect(live).toBeEmptyDOMElement();
    const pause = canvas.getByRole('button', { name: 'Resume' });
    pause.focus();
    await userEvent.tab();
    const step = canvas.getByRole('button', { name: 'Next phase' });
    await expect(step.ownerDocument.activeElement).toBe(step);
    await userEvent.keyboard('{Enter}');
    await expect(figure).toHaveAttribute('data-phase', 'approve');
    await expect(figure.querySelector('[data-ui~="payment-flow-node"][data-active="true"]')).toHaveTextContent('Issuer');
    await expect(live).toHaveTextContent('Approve: Issuer returns approval');
    await userEvent.keyboard(' ');
    await expect(figure).toHaveAttribute('data-phase', 'clear');
    await expect(live).toHaveTextContent('Clear: Processor clears');
    await expect(figure.querySelectorAll('[data-ui~="payment-flow-phase"][data-state="complete"]')).toHaveLength(2);
    await userEvent.tab();
    const replay = canvas.getByRole('button', { name: 'Replay' });
    await expect(replay.ownerDocument.activeElement).toBe(replay);
    await expect(replay.ownerDocument.defaultView!.getComputedStyle(replay).outlineStyle).not.toBe('none');
    await userEvent.keyboard('{Enter}');
    await expect(figure).toHaveAttribute('data-phase', 'authorize');
    await expect(live).toHaveTextContent('Authorize: Terminal sends');
    await expect(canvas.getByRole('button', { name: 'Resume' })).toBeVisible();
    await expect(args.onPausedChange).not.toHaveBeenCalled();
    await userEvent.tab({ shift: true });
    await expect(step.ownerDocument.activeElement).toBe(step);
  },
};

export const SpeedZero: Story = {
  name: 'Static at speed 0',
  parameters: {
    docs: {
      description: { story: 'Hold the first phase until you press Next phase.' },
      source: exampleSource({ speed: '{0}' }),
    },
  },
  args: { speed: 0 },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('button', { name: 'Next phase' })).toBeEnabled();
  },
};

export const ControlledPauseRejects: Story = {
  name: 'Controlled pause',
  parameters: {
    docs: {
      description: { story: 'Keep playback running until the parent accepts the pause request.' },
      source: (() => {
        const { language, code } = exampleSource({ paused: '{paused}', onPausedChange: '{setPaused}' }, (flow) =>
          `export function ControlledPayment() {\n  const [paused, setPaused] = useState(false);\n  return (\n    <PaymentPanel>\n${flow.replace(/^/gm, '    ')}\n    </PaymentPanel>\n  );\n}`);
        return { language, code: `import { useState } from 'react';\n${code}` };
      })(),
    },
  },
  args: { paused: false },
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Pause' }));
    await expect(args.onPausedChange).toHaveBeenCalledTimes(1);
    await expect(args.onPausedChange).toHaveBeenCalledWith(true);
    await expect(canvas.getByRole('button', { name: 'Pause' })).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'Next phase' })).toBeDisabled();
  },
};

export const JPY: Story = {
  name: 'Japanese yen',
  parameters: {
    docs: {
      description: { story: 'Round to whole yen, the currency\'s minor unit.' },
      source: exampleSource({ currency: '"JPY"', amount: '{100.4}', fee: '{3.4}' }),
    },
  },
  args: { currency: 'JPY', amount: 100.4, fee: 3.4 },
};

export const KWD: Story = {
  name: 'Kuwaiti dinar',
  parameters: {
    docs: {
      description: { story: 'Keep three decimal places for a three-digit minor unit.' },
      source: exampleSource({ currency: '"KWD"', amount: '{100.123}', fee: '{3.111}' }),
    },
  },
  args: { currency: 'KWD', amount: 100.123, fee: 3.111 },
};

export const LocaleDe: Story = {
  name: 'German labels and euros',
  parameters: {
    docs: {
      description: { story: 'Format euros for Germany with longer translated labels; the density adapts to them.' },
      source: {
        language: 'tsx',
        code: `import { PaymentFlow, Surface, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const PaymentPanel = styled(Surface)({
  boxSizing: 'border-box', inlineSize: '100%',
  maxInlineSize: \`calc(\${vars.space[8]} * 30)\`, marginInline: 'auto', padding: vars.space[6],
});
const nodes = {
  terminal: { label: 'Terminal' }, processor: { label: 'Zahlungsabwickler' },
  network: { label: 'Kartennetzwerk' }, issuer: { label: 'Kartenaussteller' }, merchant: { label: 'Händler' },
};
const labels = {
  authorize: 'Autorisieren', approve: 'Genehmigen', clear: 'Verrechnen', fee: 'Gebühr abziehen',
  payout: 'Auszahlung', approval: 'Genehmigt', settlementTime: 'Illustrative Abrechnung: zwei Tage',
};
const summary = [
${germanSummary.map((step) => `  { id: '${step.id}', content: '${step.content}' },`).join('\n')}
];
const controlLabels = { group: 'Wiedergabe', pause: 'Anhalten', resume: 'Fortsetzen', step: 'Nächste Phase', replay: 'Wiederholen' };

<PaymentPanel>
  <PaymentFlow nodes={nodes} amount={100} fee={3} balance={20} currency="EUR" locale="de-DE"
    authorizationMs={240} labels={labels} summary={summary} label="Illustrative Kartenzahlung"
    controlLabels={controlLabels} emptyContent="Alle fünf Beteiligten angeben."
    invalidContent="Beträge, Währung und Schritte prüfen." lang="de" />
</PaymentPanel>`,
      },
    },
  },
  args: {
    lang: 'de',
    locale: 'de-DE',
    currency: 'EUR',
    label: 'Illustrative Kartenzahlung',
    nodes: germanNodes,
    labels: germanLabels,
    controlLabels: germanControls,
    emptyContent: 'Alle fünf Beteiligten angeben.',
    invalidContent: 'Beträge, Währung und Schritte prüfen.',
  },
  render: (args) => (
    <PaymentPanel>
      <PaymentFlow {...args} summary={germanSummary} />
    </PaymentPanel>
  ),
  play: async ({ canvasElement }) => {
    await expectReadableLayout(canvasElement.querySelector<HTMLElement>('figure')!, 'de');
  },
};

export const IntlAndMinorUnits: Story = {
  name: 'Minor units',
  parameters: {
    docs: {
      description: { story: 'Step to payout to see the rounded net added to the starting balance.' },
      source: exampleSource({ currency: '"KWD"', amount: '{12.345}', fee: '{1.111}', defaultPaused: 'true' }),
    },
  },
  args: { defaultPaused: true, currency: 'KWD', amount: 12.345, fee: 1.111 },
  play: async ({ canvas, canvasElement, userEvent }) => {
    const expected = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'KWD' });
    const merchant = () =>
      canvasElement.querySelector('[data-node="merchant"] [data-ui="payment-flow-amount"] [data-shown="true"]')?.textContent;
    await expect(
      canvasElement.querySelector('[data-node="terminal"] [data-ui="payment-flow-amount"] [data-shown="true"]')?.textContent,
    ).toBe(expected.format(12.345));
    for (let i = 0; i < 4; i++) await userEvent.click(canvas.getByRole('button', { name: 'Next phase' }));
    await expect(merchant()).toBe(expected.format(31.234));
    await userEvent.click(canvas.getByRole('button', { name: 'Replay' }));
    await expect(merchant()).toBe(expected.format(20));
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

export const ZeroAmountFee: Story = {
  name: 'Zero amounts',
  parameters: {
    docs: {
      description: { story: 'Show a zero charge, fee and balance.' },
      source: exampleSource({ amount: '{0}', fee: '{0}', balance: '{0}' }),
    },
  },
  args: { amount: 0, fee: 0, balance: 0 },
};

export const FeeEqualsAmount: Story = {
  name: 'Fee equals amount',
  parameters: {
    docs: {
      description: { story: 'Show a fee that consumes the whole charge, leaving zero net.' },
      source: exampleSource({ fee: '{100}' }),
    },
  },
  args: { fee: 100 },
};

export const SummarySrOnly: Story = {
  name: 'Narrative for assistive technology',
  parameters: {
    docs: {
      description: { story: 'Hide the narrative visually and keep it as the figure description.' },
      source: exampleSource({ summaryVisibility: '"sr-only"' }),
    },
  },
  args: { summaryVisibility: 'sr-only' },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('list')).toBeInTheDocument();
    await expect(canvas.getByRole('list')).not.toHaveAttribute('aria-hidden');
  },
};

export const CaptionZero: Story = {
  name: 'Caption',
  parameters: {
    docs: {
      description: { story: 'Add a caption; `0` renders as text.' },
      source: exampleSource({ caption: '{0}' }),
    },
  },
  args: { caption: 0 },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('figcaption')).toHaveTextContent('0');
  },
};

export const InvalidCurrency: Story = {
  name: 'Invalid currency',
  parameters: {
    docs: {
      description: { story: 'Show the invalid fallback for an unknown currency code.' },
      source: exampleSource({ currency: '"invalid"' }),
    },
  },
  args: { currency: 'invalid' },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Check amounts, currency and steps.')).toBeVisible();
    await expect(canvas.queryByRole('button')).not.toBeInTheDocument();
  },
};

export const UnsafeAmount: Story = {
  name: 'Unsafe amount',
  parameters: {
    docs: {
      description: { story: 'Show the invalid fallback when minor units exceed a safe integer.' },
      source: exampleSource({ amount: '{Number.MAX_SAFE_INTEGER}' }),
    },
  },
  args: { amount: Number.MAX_SAFE_INTEGER },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Check amounts, currency and steps.')).toBeVisible();
  },
};

export const MissingNode: Story = {
  name: 'Missing actor',
  parameters: {
    docs: {
      description: { story: 'Show the empty fallback when an actor has no label.' },
      source: {
        language: 'tsx',
        code: exampleSource().code.replace("merchant: { label: 'Merchant' }", "merchant: { label: '' }"),
      },
    },
  },
  args: { nodes: { ...meta.args.nodes, merchant: { label: '' } } },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Add all five actors.')).toBeVisible();
    await expect(canvas.queryByRole('button')).not.toBeInTheDocument();
  },
};

/** Reduced motion opens on payout and steps through static snapshots. */
export const ReducedMotion: Story = {
  tags: ['!autodocs'],
  beforeEach: () => mockReducedMotion(true),
  play: async ({ canvas, canvasElement, userEvent }) => {
    const figure = canvasElement.querySelector('figure')!;
    await expect(figure).toHaveAttribute('data-phase', 'payout');
    await expect(figure.querySelectorAll('[data-ui~="payment-flow-phase"][data-state="complete"]')).toHaveLength(4);
    const step = canvas.getByRole('button', { name: 'Next phase' });
    await expect(step).toBeEnabled();
    await userEvent.click(step);
    await expect(figure).toHaveAttribute('data-phase', 'authorize');
    await expect(figure.querySelector('[data-ui="payment-flow-live"]')).toHaveTextContent('Authorize:');
    await userEvent.click(step);
    await expect(figure).toHaveAttribute('data-phase', 'approve');
    await userEvent.click(canvas.getByRole('button', { name: 'Replay' }));
    await expect(figure).toHaveAttribute('data-phase', 'authorize');
  },
};

/**
 * Resizes English, German and right-to-left figures from 320px to 1440px. At every width the
 * actors and phases share one orientation, no text wraps inside a word, nothing is clipped, every
 * connector keeps its length, and more than two densities appear in order.
 */
export const WidthSweep: Story = {
  tags: ['!autodocs'],
  args: { defaultPaused: true },
  render: (args) => (
    <SweepHost data-sweep-host="">
      <PaymentFlow {...args} summary={summaryFor(args)} />
      <PaymentFlow
        {...args}
        lang="de"
        locale="de-DE"
        currency="EUR"
        nodes={germanNodes}
        labels={germanLabels}
        controlLabels={germanControls}
        summary={germanSummary}
      />
      <PaymentFlow {...args} dir="rtl" locale="ar" summary={summaryFor({ ...args, locale: 'ar' })} />
    </SweepHost>
  ),
  play: async ({ canvasElement }) => {
    const host = canvasElement.querySelector<HTMLElement>('[data-sweep-host]')!;
    const view = canvasElement.ownerDocument.defaultView!;
    const figures = [...host.querySelectorAll<HTMLElement>('figure')];
    const seen = figures.map(() => [] as string[]);
    const problems: string[] = [];
    try {
      for (let width = SWEEP.from; width <= SWEEP.to; width += SWEEP.step) {
        host.style.inlineSize = `${width}px`;
        await nextFrame(view);
        await nextFrame(view);
        for (const [index, figure] of figures.entries()) {
          seen[index]!.push(figure.dataset.density ?? 'none');
          problems.push(...layoutProblems(figure, `${figure.lang || figure.dir || 'en'} ${width}px`));
        }
      }
    } finally {
      host.style.removeProperty('inline-size');
    }
    await expect(problems).toEqual([]);
    for (const densities of seen) {
      const ranks = densities.map((density) => paymentFlowDensities.indexOf(density as never));
      await expect(ranks.every((rank) => rank >= 0)).toBe(true);
      await expect(ranks).toEqual([...ranks].sort((a, b) => b - a));
      await expect(new Set(densities).size).toBeGreaterThan(2);
    }
  },
};
