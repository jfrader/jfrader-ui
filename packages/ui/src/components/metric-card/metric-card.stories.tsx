import { useState, type ComponentPropsWithRef } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, within } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { css } from '../../styling/css';
import { withLightTheme } from '../../testing/story-decorators';
import { requireElement, requireNonEmpty } from '../../testing/assertion-preconditions';
import { Button } from '../button';
import { MetricCard, type MetricCardProps } from './index';
// `styled` is the app-facing styling API; consumers import it from `@jfrader/ui`.
import { styled } from '../../index';

const NarrowFrame = styled.div({ maxInlineSize: '16rem' });
function ReplacementRoot(props: ComponentPropsWithRef<'div'>) {
  return <div {...props} data-testid="replacement-root" />;
}

function SugarRoot(props: ComponentPropsWithRef<'div'>) {
  return <div {...props} data-testid="sugar-root" />;
}

/** Replace the outer container while keeping the metric and its description. */
export const RootReplacement: Story = {
  tags: ['!autodocs'],
  args: {
    component: SugarRoot,
    slots: { root: ReplacementRoot },
    ref: fn(),
    className: 'consumer-root',
    title: 'consumer title',
    role: 'region',
    slotProps: { root: { ref: fn(), className: 'slot-root', title: 'slot title', 'data-ui': 'custom consumer' } },
  },
  render: (args) => <MetricCard {...args} data-ui="consumer" />,
  play: async ({ canvasElement, args }) => {
    const root = within(canvasElement).getByTestId('replacement-root');
    await expect(within(canvasElement).queryByTestId('sugar-root')).toBeNull();
    await expect(root.tagName).toBe('DIV');
    await expect(root).toHaveClass('consumer-root', 'slot-root');
    await expect(root).toHaveAttribute('title', 'slot title');
    await expect(root).toHaveAttribute('data-ui', 'metric-card consumer custom');
    await expect(args.ref).toHaveBeenCalledWith(root);
    await expect(args.slotProps?.root?.ref).toHaveBeenCalledWith(root);
    await expect(root).toHaveAccessibleName('Revenue');
    await expect(root).toHaveAccessibleDescription('Last 30 days');
    await expect(root.querySelector('[data-ui="metric-card-value"]')).toHaveTextContent('42,000');
  },
};

/** Use component as shorthand for the root slot. */
export const RootComponent: Story = {
  tags: ['!autodocs'],
  args: { component: SugarRoot },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByTestId('sugar-root')).toHaveAttribute('data-ui', 'metric-card');
  },
};

const Frame = styled.div({ display: 'grid', gap: vars.space[4], maxInlineSize: '28rem', minInlineSize: 0 });
const consumerStyle = css({ fontStyle: 'italic' });
const StyledMetricCard = styled(MetricCard)(consumerStyle);
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
      <Frame>
        <Story />
      </Frame>
    ),
  ],
  parameters: {
    docs: {
      description: {
        component:
          'Show a number with a heading and a change from a previous value.',
      },
      sections: [
        { title: 'Basic', stories: ['Default', 'Flat'] },
        { title: 'Formatting', stories: ['Currency', 'Compact', 'LiteralUnit'] },
        { title: 'Trends and deltas', stories: ['PositiveDelta', 'Comparison', 'DecreasingIsGood'] },
        { title: 'States', stories: ['Loading', 'MissingValue'] },
      ],
      usage: `### Values and formatting
- Values and deltas are formatted via \`Intl.NumberFormat\`. Pass percentage values as decimal fractions (0.12 for 12%).
- Currency formatting requires a valid ISO 4217 currency code; invalid Intl options throw.
- Nonzero deltas display an explicit sign and directional arrow. Non-finite or missing numbers render fallback text.
- Specify an explicit locale to guarantee consistent formatting across server rendering and client hydration.

### Keyboard and accessibility

- Cards display read-only values and are skipped during tab navigation; place interactive actions outside.
- Value updates apply immediately without live region announcements. Wrap in an external live region if updates require screen-reader announcements.
- Loading states indicate background fetching with \`aria-busy="true"\`.`,
    },
  },
} satisfies Meta<typeof MetricCard>;
export default meta;
type Story = StoryObj<typeof meta>;

function roots(element: HTMLElement) {
  return requireNonEmpty(element.querySelectorAll<HTMLElement>('[data-ui="metric-card"]'), 'Metric cards');
}
function part(root: HTMLElement, name: string) {
  return requireElement(root.querySelector<HTMLElement>(`[data-ui="metric-card-${name}"]`), `Metric ${name}`);
}
const formattingPlay: Story['play'] = async ({ canvasElement, args }) => {
  await expect(part(roots(canvasElement)[0]!, 'value').textContent).toBe(
    new Intl.NumberFormat(args.locale, args.formatOptions).format(args.value!),
  );
};
async function expectFits(root: HTMLElement, expectedText: string) {
  await expect(part(root, 'value').textContent).toBe(expectedText);
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
  for (const rect of requireNonEmpty(range.getClientRects(), 'Metric value text rectangles')) {
    await expect(rect.left).toBeGreaterThanOrEqual(bounds.left - 1);
    await expect(rect.right).toBeLessThanOrEqual(bounds.right + 1);
  }
}

export const Default: Story = {
  name: 'Metric overview',
  parameters: {
    docs: {
      description: { story: 'Display a primary metric with a label, formatted value, and time period.' },
      source: {
        language: 'tsx',
        code: `import { MetricCard } from '@jfrader/ui';

<MetricCard
  label="Revenue"
  value={42000}
  locale="en-GB"
  description="Last 30 days"
/>`,
      },
    },
  },
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
  name: 'Flat variant',
  parameters: {
    docs: {
      description: { story: 'Render with a flat border and transparent surface without elevation shadow.' },
      source: {
        language: 'tsx',
        code: `import { MetricCard } from '@jfrader/ui';

<MetricCard
  label="Revenue"
  value={42000}
  locale="en-GB"
  description="Last 30 days"
  variant="flat"
/>`,
      },
    },
  },
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
  name: 'Compact notation',
  parameters: {
    docs: {
      description: { story: 'Abbreviate large numbers with metric suffixes to conserve horizontal space.' },
      source: {
        language: 'tsx',
        code: `import { MetricCard } from '@jfrader/ui';

<MetricCard
  label="Revenue"
  value={1234000}
  locale="en-GB"
  formatOptions={{ notation: 'compact' }}
  description="Last 30 days"
/>`,
      },
    },
  },
  args: { value: 1234000, formatOptions: { notation: 'compact' } },
  play: formattingPlay,
};
export const Percent: Story = {
  args: { value: 0.125, formatOptions: { style: 'percent', maximumFractionDigits: 1 } },
  play: formattingPlay,
};
export const Currency: Story = {
  name: 'Currency formatting',
  parameters: {
    docs: {
      description: { story: 'Format amounts with currency symbols according to the specified locale.' },
      source: {
        language: 'tsx',
        code: `import { MetricCard } from '@jfrader/ui';

<MetricCard
  label="Revenue"
  value={42000}
  locale="en-GB"
  formatOptions={{ style: 'currency', currency: 'GBP' }}
  description="Last 30 days"
/>`,
      },
    },
  },
  args: { value: 42000, formatOptions: { style: 'currency', currency: 'GBP' } },
  play: formattingPlay,
};
export const LiteralUnit: Story = {
  name: 'Literal unit label',
  parameters: {
    docs: {
      description: { story: 'Append a custom text unit suffix directly after the formatted count.' },
      source: {
        language: 'tsx',
        code: `import { MetricCard } from '@jfrader/ui';

<MetricCard
  label="Active projects"
  value={0}
  unitLabel="projects"
  locale="en-GB"
  description="Last 30 days"
/>`,
      },
    },
  },
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
  name: 'Positive trend',
  parameters: {
    docs: {
      description: { story: 'Display an upward percentage delta with an arrow and success color tone.' },
      source: {
        language: 'tsx',
        code: `import { MetricCard } from '@jfrader/ui';

<MetricCard
  label="Revenue"
  value={42000}
  locale="en-GB"
  description="Last 30 days"
  delta={0.12}
  deltaTone="success"
  deltaFormatOptions={{ style: 'percent' }}
/>`,
      },
    },
  },
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
  name: 'Inverse delta tone',
  parameters: {
    docs: {
      description: { story: 'Apply a success tone to negative changes when a reduction represents a positive outcome.' },
      source: {
        language: 'tsx',
        code: `import { MetricCard } from '@jfrader/ui';

<MetricCard
  label="Incidents"
  value={4}
  locale="en-GB"
  description="Last 30 days"
  delta={-8}
  deltaTone="success"
/>`,
      },
    },
  },
  args: { label: 'Incidents', value: 4, delta: -8, deltaTone: 'success' },
  play: deltaPlay,
};
export const Comparison: Story = {
  name: 'Comparison baseline',
  parameters: {
    docs: {
      description: { story: 'Provide comparison text alongside the delta pill to clarify the measurement window.' },
      source: {
        language: 'tsx',
        code: `import { MetricCard } from '@jfrader/ui';

<MetricCard
  label="Revenue"
  value={42000}
  locale="en-GB"
  description="Last 30 days"
  delta={0.12}
  deltaFormatOptions={{ style: 'percent' }}
  deltaDescription="vs last month"
/>`,
      },
    },
  },
  args: { delta: 0.12, deltaFormatOptions: { style: 'percent' }, deltaDescription: 'vs last month' },
  play: async ({ canvasElement }) => {
    await expect(roots(canvasElement)[0]!.querySelector('[data-ui="pill"]')).toHaveTextContent(
      '+12% vs last month',
    );
  },
};
export const Loading: Story = {
  name: 'Loading state',
  parameters: {
    docs: {
      description: { story: 'Show an animated shimmer across the metric value while data is being fetched.' },
      source: {
        language: 'tsx',
        code: `import { MetricCard } from '@jfrader/ui';

<MetricCard
  label="Revenue"
  value={42000}
  locale="en-GB"
  description="Last 30 days"
  loading
/>`,
      },
    },
  },
  args: { loading: true },
  play: async ({ canvasElement }) => {
    const root = roots(canvasElement)[0]!;
    await expect(root).toHaveAttribute('aria-busy', 'true');
    await expect(part(root, 'value')).toHaveTextContent('42,000');
    await expect(root.querySelector('[role="status"], [aria-live]')).toBeNull();
  },
};
export const MissingValue: Story = {
  name: 'Missing value fallback',
  parameters: {
    docs: {
      description: { story: 'Render custom placeholder text when the metric value is null or unrecorded.' },
      source: {
        language: 'tsx',
        code: `import { MetricCard } from '@jfrader/ui';

<MetricCard
  label="Revenue"
  value={null}
  missingValueLabel="Not reported"
  locale="en-GB"
  description="Last 30 days"
/>`,
      },
    },
  },
  args: { value: null, missingValueLabel: 'Not reported' },
  play: async ({ canvasElement }) => {
    await expect(part(roots(canvasElement)[0]!, 'value')).toHaveTextContent('Not reported');
  },
};
export const Nonfinite: Story = {
  render: (args) => (
    <>
      {[NaN, Infinity, -Infinity].map((value, index) => (
        <MetricCard {...args} key={index} data-testid={`nonfinite-${index}`} value={value} delta={value} />
      ))}
    </>
  ),
  play: async ({ canvasElement }) => {
    const cards = roots(canvasElement);
    await expect(cards).toHaveLength(3);
    for (const [index, root] of cards.entries()) {
      await expect(root).toHaveAttribute('data-testid', `nonfinite-${index}`);
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
    <NarrowFrame>
      <MetricCard {...args} />
    </NarrowFrame>
  ),
  play: async ({ canvasElement, args }) => {
    await expectFits(roots(canvasElement)[0]!, new Intl.NumberFormat(args.locale, args.formatOptions).format(args.value!));
  },
};
export const HugeAndNegativeValues: Story = {
  render: (args) => (
    <>
      {[1e30, -123456789012345].map((value) => (
        <MetricCard
          {...args}
          key={value}
          data-testid={`huge-${value}`}
          value={value}
          formatOptions={{ style: 'currency', currency: 'EUR' }}
        />
      ))}
    </>
  ),
  play: async ({ canvasElement, args }) => {
    const cards = roots(canvasElement);
    const values = [1e30, -123456789012345];
    await expect(cards).toHaveLength(values.length);
    for (const [index, root] of cards.entries()) {
      await expect(root).toHaveAttribute('data-testid', `huge-${values[index]}`);
      await expectFits(root, new Intl.NumberFormat(args.locale, { style: 'currency', currency: 'EUR' }).format(values[index]!));
    }
  },
};
export const FalsySlots: Story = {
  render: (args) => (
    <>
      {[false, null, 0, ''].map((content, index) => (
        <MetricCard
          {...args}
           key={index}
          data-testid={`falsy-${index}`}
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
    const cards = roots(canvasElement);
    await expect(cards).toHaveLength(4);
    for (const [index, root] of cards.entries()) {
      await expect(root).toHaveAttribute('data-testid', `falsy-${index}`);
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
  name: 'DOM reference',
  parameters: {
    docs: {
      description: { story: 'Attach a React ref to access the root card element directly.' },
      source: {
        language: 'tsx',
        code: `import { useRef } from 'react';
import { MetricCard } from '@jfrader/ui';

export function MetricCardRefExample() {
  const cardRef = useRef<HTMLDivElement>(null);

  return (
    <MetricCard
      ref={cardRef}
      label="Revenue"
      value={42000}
      locale="en-GB"
      description="Last 30 days"
    />
  );
}`,
      },
    },
  },
  args: { ref: fn() },
  play: async ({ canvasElement, args }) => {
    await expect(args.ref).toHaveBeenCalledWith(roots(canvasElement)[0]);
    await expect(roots(canvasElement)[0]!.tagName).toBe('DIV');
  },
};
export const ConsumerStylePrecedence: Story = {
  render: (args) => (
    <StyledMetricCard
      {...args}
      delta={12}
      sx={finalStyle}
      slotProps={{
        surface: { sx: consumerStyle },
        header: { sx: slotStyle },
        label: { sx: slotStyle },
        value: { sx: slotValueStyle },
        delta: { sx: slotStyle },
        description: { sx: slotStyle },
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
    await expectFits(roots(context.canvasElement)[0]!, new Intl.NumberFormat(context.args.locale, context.args.formatOptions).format(context.args.value!));
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
