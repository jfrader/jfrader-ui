import { useState, type ComponentPropsWithRef } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, within } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { css } from '../../styling/css';
import { withLightTheme } from '../../testing/story-decorators';
import { Button } from '../button';
import { MetricCard, type MetricCardProps } from './index';

const frameStyle = css({ display: 'grid', gap: vars.space[4], maxInlineSize: '28rem', minInlineSize: 0 });
const consumerStyle = css({ fontStyle: 'italic' });
const finalStyle = css({ fontStyle: 'normal' });
const slotStyle = css({ textTransform: 'uppercase' });
const slotValueStyle = css({ fontWeight: vars.fontWeight.medium });

function ReplacementDescription(props: ComponentPropsWithRef<'p'>) {
  return <p {...props} data-slot="metric-card-description" />;
}

export const DescriptionReplacement: Story = {
  render: (args) => <MetricCard {...args} slots={{ description: ReplacementDescription }} />,
  play: async ({ canvasElement }) => {
    const description = canvasElement.querySelector('[data-slot="metric-card-description"]');
    await expect(description).toBeInTheDocument();
    await expect(description).toHaveAttribute('data-ui', 'metric-card-description');
    await expect(canvasElement.querySelector('[data-ui="metric-card"]')).toHaveAttribute('aria-describedby', description!.id);
    await expect(getComputedStyle(description!).marginTop).toBe('0px');
    await expect(canvasElement.querySelector('[data-ui="metric-card-description"]:not([data-slot])')).toBeNull();
  },
};
const meta = {
  title: 'Data display/MetricCard',
  component: MetricCard,
  tags: ['autodocs'],
  args: { label: 'Revenue', value: 42000, locale: 'en-GB', description: 'Last 30 days' },
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
          'Show a number with a heading and a change from a previous value.',
      },
      usage: `- The card is read-only, not an APG widget. Tab and Shift+Tab skip it.
- Values update without animation or live announcements.
- Percent inputs are fractions. Currency formatting requires a currency code; invalid Intl options throw.
- Nonzero deltas always show a sign, even with signDisplay="never".
- Set locale to match server and client output.`,
      source: {
        code: '<MetricCard label="Revenue" value={42000} locale="en-GB" formatOptions={{ style: "currency", currency: "GBP" }} delta={0.12} deltaFormatOptions={{ style: "percent" }} deltaTone="success" description="Last 30 days" />',
      },
    },
  },
} satisfies Meta<typeof MetricCard>;
export default meta;
type Story = StoryObj<typeof meta>;

function roots(element: HTMLElement) {
  return Array.from(element.querySelectorAll<HTMLElement>('[data-ui="metric-card"]'));
}
function part(root: HTMLElement, name: string) {
  const element = root.querySelector<HTMLElement>(`[data-ui="metric-card-${name}"]`);
  if (!element) throw new Error(`Missing metric ${name}`);
  return element;
}
const formattingPlay: Story['play'] = async ({ canvasElement, args }) => {
  await expect(part(roots(canvasElement)[0]!, 'value').textContent).toBe(
    new Intl.NumberFormat(args.locale, args.formatOptions).format(args.value!),
  );
};
async function expectFits(root: HTMLElement) {
  for (const element of [
    root,
    part(root, 'value'),
    root.querySelector<HTMLElement>('[data-ui="pill"]'),
  ].filter((el): el is HTMLElement => el !== null)) {
    await expect(element.scrollWidth).toBeLessThanOrEqual(element.clientWidth + 1);
  }
  const range = root.ownerDocument.createRange();
  range.selectNodeContents(part(root, 'value'));
  const bounds = root.getBoundingClientRect();
  for (const rect of Array.from(range.getClientRects())) {
    await expect(rect.left).toBeGreaterThanOrEqual(bounds.left - 1);
    await expect(rect.right).toBeLessThanOrEqual(bounds.right + 1);
  }
}

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const root = roots(canvasElement)[0]!;
    await expect(root).not.toHaveAttribute('role');
    await expect(root).not.toHaveAttribute('aria-live');
    await expect(within(root).getByRole('heading', { level: 3, name: 'Revenue' })).toBeVisible();
    await expect(part(root, 'value')).toHaveTextContent(/^42,000$/);
    await expect(root).toHaveAttribute('aria-describedby', part(root, 'description').id);
  },
};
export const Flat: Story = {
  args: { variant: 'flat' },
  play: async ({ canvasElement }) => {
    await expect(
      getComputedStyle(roots(canvasElement)[0]!.querySelector('[data-ui="card"]')!).boxShadow,
    ).toBe('none');
  },
};
export const Raised: Story = {
  args: { variant: 'raised' },
  play: async ({ canvasElement }) => {
    await expect(
      getComputedStyle(roots(canvasElement)[0]!.querySelector('[data-ui="card"]')!).boxShadow,
    ).not.toBe('none');
  },
};
export const Decimal: Story = {
  args: { value: 1234.567, formatOptions: { maximumFractionDigits: 2 } },
  play: formattingPlay,
};
export const Compact: Story = {
  args: { value: 1234000, formatOptions: { notation: 'compact' } },
  play: formattingPlay,
};
export const Percent: Story = {
  args: { value: 0.125, formatOptions: { style: 'percent', maximumFractionDigits: 1 } },
  play: formattingPlay,
};
export const Currency: Story = {
  args: { value: 42000, formatOptions: { style: 'currency', currency: 'GBP' } },
  play: formattingPlay,
};
export const LiteralUnit: Story = {
  args: { label: 'Active projects', value: 0, unitLabel: 'projects' },
  play: async ({ canvasElement }) => {
    await expect(part(roots(canvasElement)[0]!, 'value')).toHaveTextContent(/^0 projects$/);
  },
};
const deltaPlay: Story['play'] = async ({ canvasElement, args }) => {
  const pill = roots(canvasElement)[0]!.querySelector('[data-ui="pill"]')!;
  await expect(pill).toHaveAttribute(
    'data-direction',
    args.delta === 0 ? 'unchanged' : args.delta! > 0 ? 'up' : 'down',
  );
  await expect(pill).toHaveAttribute('data-tone', args.deltaTone ?? 'neutral');
  await expect(pill.querySelector('[aria-hidden="true"]')).toHaveTextContent(
    args.delta === 0 ? '↔' : args.delta! > 0 ? '↑' : '↓',
  );
  await expect(pill.lastElementChild!.textContent).toBe(
    new Intl.NumberFormat(args.locale, {
      ...args.deltaFormatOptions,
      signDisplay: args.delta === 0 ? 'exceptZero' : 'always',
    }).format(args.delta === 0 ? 0 : args.delta!),
  );
};
export const PositiveDelta: Story = {
  args: { delta: 0.12, deltaTone: 'success', deltaFormatOptions: { style: 'percent' } },
  play: deltaPlay,
};
export const NegativeDelta: Story = {
  args: { delta: -0.12, deltaTone: 'danger', deltaFormatOptions: { style: 'percent', signDisplay: 'never' } },
  play: deltaPlay,
};
export const ZeroDelta: Story = { args: { delta: 0 }, play: deltaPlay };
export const NegativeZero: Story = { args: { delta: -0 }, play: deltaPlay };
export const RoundedNonzeroDelta: Story = {
  args: { delta: 0.0001, deltaFormatOptions: { maximumFractionDigits: 0, signDisplay: 'never' } },
  play: deltaPlay,
};
export const DecreasingIsGood: Story = {
  args: { label: 'Incidents', value: 4, delta: -8, deltaTone: 'success' },
  play: deltaPlay,
};
export const Comparison: Story = {
  args: { delta: 0.12, deltaFormatOptions: { style: 'percent' }, deltaDescription: 'vs last month' },
  play: async ({ canvasElement }) => {
    await expect(roots(canvasElement)[0]!.querySelector('[data-ui="pill"]')).toHaveTextContent(
      '+12% vs last month',
    );
  },
};
export const Loading: Story = {
  args: { loading: true },
  play: async ({ canvasElement }) => {
    const root = roots(canvasElement)[0]!;
    await expect(root).toHaveAttribute('aria-busy', 'true');
    await expect(part(root, 'value')).toHaveTextContent('42,000');
    await expect(root.querySelector('[role="status"], [aria-live]')).toBeNull();
  },
};
export const MissingValue: Story = {
  args: { value: null, missingValueLabel: 'Not reported' },
  play: async ({ canvasElement }) => {
    await expect(part(roots(canvasElement)[0]!, 'value')).toHaveTextContent('Not reported');
  },
};
export const Nonfinite: Story = {
  render: (args) => (
    <>
      {[NaN, Infinity, -Infinity].map((value, index) => (
        <MetricCard {...args} key={index} value={value} delta={value} />
      ))}
    </>
  ),
  play: async ({ canvasElement }) => {
    for (const root of roots(canvasElement)) {
      await expect(part(root, 'value')).toHaveTextContent('Unavailable');
      await expect(root.querySelector('[data-ui="pill"]')).toBeNull();
    }
  },
};
export const LongCopy: Story = {
  args: {
    label: 'Total revenue across all active international subscriptions',
    description: 'Reported across all billing regions during the current financial reporting period.',
    delta: 1234000,
    deltaDescription: 'compared with the previous financial reporting period',
    deltaFormatOptions: { notation: 'compact' },
  },
  render: (args) => (
    <div style={{ maxInlineSize: '16rem' }}>
      <MetricCard {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    await expectFits(roots(canvasElement)[0]!);
  },
};
export const HugeAndNegativeValues: Story = {
  render: (args) => (
    <>
      {[1e30, -123456789012345].map((value) => (
        <MetricCard
          {...args}
          key={value}
          value={value}
          formatOptions={{ style: 'currency', currency: 'EUR' }}
        />
      ))}
    </>
  ),
  play: async ({ canvasElement }) => {
    for (const root of roots(canvasElement)) await expectFits(root);
  },
};
export const FalsySlots: Story = {
  render: (args) => (
    <>
      {[false, null, 0, ''].map((content, index) => (
        <MetricCard
          {...args}
          key={index}
          label={content}
          description={content}
          role={content === 0 ? 'region' : undefined}
          aria-describedby="unresolved-context"
          aria-labelledby="unresolved-label"
        />
      ))}
    </>
  ),
  play: async ({ canvasElement }) => {
    for (const [index, root] of roots(canvasElement).entries()) {
      await expect(root.querySelector('[data-ui="metric-card-label"]') !== null).toBe(index === 2);
      await expect(root.querySelector('[data-ui="metric-card-description"]') !== null).toBe(index === 2);
      await expect(root.getAttribute('aria-describedby')?.split(' ')).toEqual(
        index === 2 ? ['unresolved-context', part(root, 'description').id] : ['unresolved-context'],
      );
      await expect(root.getAttribute('aria-labelledby')?.split(' ')).toEqual(
        index === 2 ? ['unresolved-label', part(root, 'label').id] : ['unresolved-label'],
      );
      if (index === 2) {
        await expect(part(root, 'label')).toHaveTextContent(/^0$/);
        await expect(part(root, 'description')).toHaveTextContent(/^0$/);
      }
    }
  },
};
export const ExternalAria: Story = {
  render: (args) => (
    <>
      <span id="metric-external-label">Billing summary</span>
      <span id="metric-external-description">Audited</span>
      <MetricCard
        {...args}
        role="region"
        headingLevel={2}
        aria-label="Retained label"
        aria-labelledby="metric-external-label"
        aria-describedby="metric-external-description"
      />
      <MetricCard
        {...args}
        role="region"
        aria-label="Fallback label"
        aria-labelledby="unresolved-reference"
      />
    </>
  ),
  play: async ({ canvasElement }) => {
    const [first, second] = roots(canvasElement);
    await expect(first).toHaveAttribute('aria-label', 'Retained label');
    await expect(first).toHaveAttribute(
      'aria-labelledby',
      `metric-external-label ${part(first!, 'label').id}`,
    );
    await expect(first).toHaveAttribute(
      'aria-describedby',
      `metric-external-description ${part(first!, 'description').id}`,
    );
    await expect(within(first!).getByRole('heading', { level: 2 })).toBeVisible();
    await expect(second).toHaveAttribute('aria-label', 'Fallback label');
    await expect(second).toHaveAttribute(
      'aria-labelledby',
      `unresolved-reference ${part(second!, 'label').id}`,
    );
    await expect(part(first!, 'label').id).not.toBe(part(second!, 'label').id);
    await expect(part(first!, 'description').id).not.toBe(part(second!, 'description').id);
  },
};
export const RefTarget: Story = {
  args: { ref: fn() },
  play: async ({ canvasElement, args }) => {
    await expect(args.ref).toHaveBeenCalledWith(roots(canvasElement)[0]);
    await expect(roots(canvasElement)[0]!.tagName).toBe('DIV');
  },
};
export const ConsumerStylePrecedence: Story = {
  render: (args) => (
    <MetricCard
      {...args}
      delta={12}
      css={consumerStyle}
      sx={finalStyle}
      slotProps={{
        surface: { css: consumerStyle },
        header: { css: slotStyle },
        label: { css: slotStyle },
        value: { css: slotValueStyle },
        delta: { css: slotStyle },
        description: { css: slotStyle },
      }}
    />
  ),
  play: async ({ canvasElement }) => {
    const root = roots(canvasElement)[0]!;
    await expect(getComputedStyle(root).fontStyle).toBe('normal');
    await expect(getComputedStyle(root.querySelector('[data-ui="card"]')!).fontStyle).toBe('italic');
    for (const name of ['header', 'label', 'description'])
      await expect(getComputedStyle(part(root, name)).textTransform).toBe('uppercase');
    await expect(getComputedStyle(part(root, 'value')).fontWeight).toBe('500');
    await expect(getComputedStyle(root.querySelector('[data-ui="pill"]')!).textTransform).toBe('uppercase');
  },
};
export const LightTheme: Story = {
  decorators: [withLightTheme],
  globals: { theme: 'light' },
  render: (args) => (
    <>
      {(['neutral', 'success', 'danger'] as const).map((deltaTone) => (
        <MetricCard
          {...args}
          key={deltaTone}
          delta={-0.12}
          deltaTone={deltaTone}
          deltaFormatOptions={{ style: 'percent' }}
        />
      ))}
    </>
  ),
};
export const RTL: Story = {
  args: {
    dir: 'rtl',
    locale: 'ar-EG',
    value: 1234567.89,
    formatOptions: { style: 'currency', currency: 'EGP' },
    delta: -0.12,
    deltaFormatOptions: { style: 'percent' },
  },
  play: async (context) => {
    await formattingPlay!(context);
    await expect(getComputedStyle(roots(context.canvasElement)[0]!).direction).toBe('rtl');
    await expectFits(roots(context.canvasElement)[0]!);
  },
};
export const ReducedMotion: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Checks the card without animation. This story does not emulate a media preference.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    await expect(getComputedStyle(part(roots(canvasElement)[0]!, 'value')).animationName).toBe('none');
  },
};
export const ForcedColors: Story = {
  args: { delta: -12 },
  parameters: {
    docs: {
      description: {
        story:
          'Checks the sign, direction glyph and border. Enable forced colors in a browser to check their rendering.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const pill = roots(canvasElement)[0]!.querySelector('[data-ui="pill"]')!;
    await expect(getComputedStyle(pill).borderTopStyle).toBe('solid');
    await expect(parseFloat(getComputedStyle(pill).borderTopWidth)).toBeGreaterThan(0);
    await expect(pill).toHaveTextContent('↓-12');
  },
};
export const KeyboardSkipsCard: Story = {
  args: { onClick: fn() },
  render: (args) => (
    <>
      <Button>Before metric</Button>
      <MetricCard {...args} />
      <Button>After metric</Button>
    </>
  ),
  play: async ({ canvasElement, userEvent, args }) => {
    const canvas = within(canvasElement);
    const before = canvas.getByRole('button', { name: 'Before metric' });
    const after = canvas.getByRole('button', { name: 'After metric' });
    await userEvent.tab();
    await expect(canvasElement.ownerDocument.activeElement).toBe(before);
    await expect(getComputedStyle(before).outlineStyle).not.toBe('none');
    await userEvent.tab();
    await expect(canvasElement.ownerDocument.activeElement).toBe(after);
    await expect(getComputedStyle(after).outlineStyle).not.toBe('none');
    await userEvent.tab({ shift: true });
    await expect(canvasElement.ownerDocument.activeElement).toBe(before);
    await expect(args.onClick).toHaveBeenCalledTimes(0);
  },
};
function UpdatingMetric(props: MetricCardProps) {
  const [updated, setUpdated] = useState(false);
  return (
    <>
      <Button onClick={() => setUpdated(true)}>Refresh metric</Button>
      <MetricCard {...props} value={updated ? 999 : props.value} loading={!updated} />
    </>
  );
}
UpdatingMetric.displayName = 'UpdatingMetric';
export const PropUpdates: Story = {
  render: (args) => <UpdatingMetric {...args} />,
  play: async ({ canvasElement, userEvent }) => {
    const button = within(canvasElement).getByRole('button', { name: 'Refresh metric' });
    await userEvent.tab();
    await userEvent.keyboard('{Enter}');
    const root = roots(canvasElement)[0]!;
    await expect(canvasElement.ownerDocument.activeElement).toBe(button);
    await expect(part(root, 'value')).toHaveTextContent(/^999$/);
    await expect(root.querySelectorAll('[data-ui="metric-card-value"]')).toHaveLength(1);
    await expect(root).not.toHaveAttribute('aria-busy');
    await expect(root.querySelector('[aria-live], [role="status"]')).toBeNull();
  },
};
