import { useId, useState, type ReactNode, type ComponentPropsWithRef } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, spyOn, waitFor } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { withLightTheme } from '../../testing/story-decorators';
import { ThemeRoot } from '../theme-root';
import { ToggleSubscription, type ToggleSubscriptionCompoundProps as ToggleSubscriptionProps, type ToggleSubscriptionEasyProps } from './index';
// `styled` is the app-facing styling API; consumers import it from `@jfrader/ui`.
import { styled } from '../../index';

const LightThemeFrame = styled.div({ backgroundColor: vars.color.bg, padding: vars.space[4] });

const ExampleGrid = styled.div({ display: 'grid', gap: vars.space[4] });

const NarrowFrame = styled.div({ width: 180 });

const FixedSubscription = styled(ToggleSubscription)({ width: 280 });

const saving = `Save ${new Intl.NumberFormat('en', { style: 'percent' }).format(0.2)}`;
const usage = `import { ToggleSubscription } from '@jfrader/ui';

const saving = 'Save ' + new Intl.NumberFormat('en', { style: 'percent' }).format(0.2);

<ToggleSubscription defaultValue="monthly" locale="en-US">
  <ToggleSubscription.Label>Billing period</ToggleSubscription.Label>
  <ToggleSubscription.List>
    <ToggleSubscription.Item value="monthly">Monthly</ToggleSubscription.Item>
    <ToggleSubscription.Item value="annual" badge={saving} activeBadge="Annual saving applied">Annual</ToggleSubscription.Item>
  </ToggleSubscription.List>
  <ToggleSubscription.Price amount={24} currency="USD" period="/ month" />
</ToggleSubscription>`;
const FixtureButton = styled.button({ minHeight: vars.space[8], minWidth: vars.space[8] });
function Example({
  third = false,
  badge = saving,
  activeBadge = 'Annual saving applied',
  ...args
}: ToggleSubscriptionProps & {
  third?: boolean;
  badge?: ReactNode;
  activeBadge?: ReactNode;
}) {
  return (
    <ToggleSubscription {...args}>
      <ToggleSubscription.Label>Billing period</ToggleSubscription.Label>
      <ToggleSubscription.List>
        <ToggleSubscription.Item value="monthly">Monthly</ToggleSubscription.Item>
        <ToggleSubscription.Item value="annual" badge={badge} activeBadge={activeBadge}>
          Annual
        </ToggleSubscription.Item>
        {third && <ToggleSubscription.Item value="lifetime">Lifetime</ToggleSubscription.Item>}
      </ToggleSubscription.List>
      <ToggleSubscription.Price amount={24} currency="USD" period="/ month" />
    </ToggleSubscription>
  );
}
const meta = {
  title: 'Inputs/ToggleSubscription',
  component: ToggleSubscription,
  tags: ['autodocs'],
  args: { defaultValue: 'monthly', locale: 'en-US', onValueChange: fn() },
  render: (args) => <Example {...args} />,
  parameters: {
    docs: {
      sections: [
        { title: 'Choose a billing period', stories: ['Easy', 'MonthlyYearly'] },
        { title: 'Price displays', stories: ['SeveralPrices', 'IntlCurrencies'] },
      ],
      description: {
        component:
          'Choose a billing period and show its price, savings, or a previous price.',
      },
      usage: `### Prices and forms
- Supply the billing amounts and savings; the component does not calculate them or create a form field.
- With mapped prices, no selection displays no price; a selected period without a mapped price throws.
- In a compound composition, keep displayed prices in sync with the selected period yourself.
- Use finite amounts and ISO currencies. Give a previous price an accessible label and set an explicit locale for server rendering.
- Keep badges free of interactive controls.

### Keyboard and accessibility

- Arrow keys select and wrap, skipping disabled periods. Horizontal arrows reverse in RTL.
- Home/End select the first/last enabled period. Enter/Space activate once.
- Tab enters the focused enabled item, then leaves the group.`,
    },
  },
} satisfies Meta<ToggleSubscriptionProps>;
export default meta;
type Story = StoryObj<Omit<ToggleSubscriptionProps, 'component'>>;
type EasyStory = StoryObj<Omit<ToggleSubscriptionEasyProps, 'component'>>;
const periods = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly', disabled: true },
  { value: 'annual', label: 'Annual', badge: saving },
] as const;
const prices = {
  monthly: { amount: 24, currency: 'USD', period: '/ month' },
  quarterly: { amount: 60, currency: 'USD', period: '/ quarter' },
  annual: { amount: 230, currency: 'USD', period: '/ year' },
} as const;
async function expectSettledPrice(root: HTMLElement, formatted: string) {
  await waitFor(async () => {
    const visual = root.querySelector('[data-ui="toggle-subscription-amount"] [aria-hidden="true"]');
    await expect(visual?.children).toHaveLength(1);
    await expect(visual?.firstElementChild?.textContent).toBe(formatted);
    await expect(getComputedStyle(visual!.firstElementChild!).opacity).toBe('1');
  });
}
export const Easy: EasyStory = {
  name: 'Mapped billing prices',
  parameters: { docs: {
    description: { story: 'Choose Monthly or Annual to update the price; Quarterly is unavailable.' },
    source: { language: 'tsx', code: `import { ToggleSubscription } from '@jfrader/ui';

const saving = 'Save ' + new Intl.NumberFormat('en', { style: 'percent' }).format(0.2);
const periods = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly', disabled: true },
  { value: 'annual', label: 'Annual', badge: saving },
] as const;
const prices = {
  monthly: { amount: 24, currency: 'USD', period: '/ month' },
  quarterly: { amount: 60, currency: 'USD', period: '/ quarter' },
  annual: { amount: 230, currency: 'USD', period: '/ year' },
} as const;

<ToggleSubscription label="Billing period" options={periods} prices={prices} defaultValue="monthly" locale="en-US" />` },
  } },
  args: { label: 'Billing period', options: periods, prices, defaultValue: 'monthly', locale: 'en-US', onValueChange: fn() },
  render: (args) => <ToggleSubscription {...args} />,
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    await expect(canvas.getByRole('radiogroup', { name: 'Billing period' })).toBeInTheDocument();
    await expect(canvas.getAllByText('$24.00').length).toBeGreaterThan(0);
    await expect(canvas.getByRole('radio', { name: 'Quarterly' })).toBeDisabled();
    const annual = canvas.getByRole('radio', { name: 'Annual' });
    await userEvent.click(annual);
    await expect(annual).toHaveAttribute('aria-checked', 'true');
    await expect(canvas.getByText('/ year')).toBeInTheDocument();
    await expect(canvas.getAllByText('$230.00').length).toBeGreaterThan(0);
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith('annual');
    await expectSettledPrice(canvasElement, '$230.00');
  },
};
function EasyControlledExample(args: ToggleSubscriptionEasyProps) {
  const [value, setValue] = useState('monthly');
  return (
    <ToggleSubscription {...args} value={value} onValueChange={(next) => {
      setValue(next);
      args.onValueChange?.(next);
    }} />
  );
}
export const EasyControlled: EasyStory = { ...Easy, render: (args) => <EasyControlledExample {...args} /> };
export const EasyNoSelection: EasyStory = {
  ...Easy,
  args: { ...Easy.args, defaultValue: undefined },
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    await expect(canvas.queryByText('/ month')).not.toBeInTheDocument();
    await expect(canvasElement.querySelector('[data-ui="toggle-subscription-price"]')).not.toBeInTheDocument();
    for (const radio of canvas.getAllByRole('radio')) {
      await expect(radio).toHaveAttribute('aria-checked', 'false');
    }
    await userEvent.click(canvas.getByRole('radio', { name: 'Annual' }));
    await expect(canvas.getByText('/ year')).toBeInTheDocument();
    await expectSettledPrice(canvasElement, '$230.00');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
  },
};
export const EasyRejected: EasyStory = {
  ...Easy, args: { ...Easy.args, value: 'monthly' },
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(canvas.getByRole('radio', { name: 'Annual' }));
    await expect(canvas.getByRole('radio', { name: 'Monthly' })).toHaveAttribute('aria-checked', 'true');
    await expect(canvas.getByRole('radio', { name: 'Annual' })).toHaveAttribute('aria-checked', 'false');
    await expect(canvas.getByText('/ month')).toBeInTheDocument();
    await expect(canvas.queryByText('/ year')).not.toBeInTheDocument();
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith('annual');
  },
};
export const EasyKeyboard: EasyStory = {
  ...Easy,
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    await userEvent.tab();
    await assertFocus(canvas.getByRole('radio', { name: 'Monthly' }));
    await userEvent.keyboard('{ArrowRight}');
    const annual = canvas.getByRole('radio', { name: 'Annual' });
    await assertFocus(annual);
    await expect(annual).toHaveAttribute('aria-checked', 'true');
    await expect(canvas.getByText('/ year')).toBeInTheDocument();
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith('annual');
    await expectSettledPrice(canvasElement, '$230.00');
  },
};
export const EasyRTL: EasyStory = {
  ...Easy, args: { ...Easy.args, dir: 'rtl', locale: 'de-DE' },
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    await userEvent.tab();
    await userEvent.keyboard('{ArrowLeft}');
    await assertFocus(canvas.getByRole('radio', { name: 'Annual' }));
    const formatted = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'USD' }).format(230);
    await expectSettledPrice(canvasElement, formatted);
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith('annual');
  },
};
function EasyRoot(props: ComponentPropsWithRef<'div'>) {
  return <div {...props} data-replacement="toggle-subscription" />;
}
// This story tests the documented css/slot API and native style merging.
export const EasyCustomization: EasyStory = {
  ...Easy,
  parameters: { docs: { source: { code: `<ToggleSubscription label="Billing period" options={periods} prices={prices} defaultValue="monthly" locale="en-US"
  slotProps={{ label: { title: 'Billing label' }, item: { slotProps: { badge: { style: { borderRadius: 0 } } } } }}
/>` } } },
  args: {
    ...Easy.args,
    ref: fn(),
    slotProps: {
      root: { title: 'Billing selector' },
      label: { title: 'Billing label' },
      item: { slotProps: { badge: { style: { borderRadius: 0 } } } },
      price: { slotProps: { amount: { style: { fontSize: vars.textSize.xl } } } },
    },
  },
  render: (args) => <ToggleSubscription {...args} component={EasyRoot} />,
  play: async (context) => {
    await Easy.play?.(context);
    await expect(context.canvas.getByTitle('Billing selector')).toHaveAttribute('data-replacement', 'toggle-subscription');
    await expect(context.args.ref).toHaveBeenCalledWith(context.canvas.getByTitle('Billing selector'));
    await expect(context.canvas.getByTitle('Billing label')).toHaveTextContent('Billing period');
  },
};
type AssertToggleSubscriptionProps<T extends import('./index').ToggleSubscriptionProps> = T;
export type ToggleSubscriptionEasyTypeRegression = {
  // @ts-expect-error Options and children are mutually exclusive.
  mixed: AssertToggleSubscriptionProps<{ options: typeof periods; prices: typeof prices; children: string }>;
  // @ts-expect-error Easy mode requires an explicit price mapping.
  missingPrices: AssertToggleSubscriptionProps<{ options: typeof periods }>;
};
function contrastRatio(document: Document, foreground: string, ...layers: string[]) {
  const context = document.createElement('canvas').getContext('2d')!;
  const luminance = (...colors: string[]) => {
    context.clearRect(0, 0, 1, 1);
    for (const color of colors) {
      context.fillStyle = color;
      context.fillRect(0, 0, 1, 1);
    }
    return Array.from(context.getImageData(0, 0, 1, 1).data)
      .slice(0, 3)
      .map((channel) => {
        const value = channel / 255;
        return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
      })
      .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index]!, 0);
  };
  const a = luminance(...layers, foreground);
  const b = luminance(...layers);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
async function expectPx(value: string, expected: number) {
  await expect(Math.abs(parseFloat(value) - expected)).toBeLessThan(1.1);
}
async function assertFocus(item: HTMLElement) {
  await expect(item.ownerDocument.activeElement).toBe(item);
  await expect(getComputedStyle(item).outlineStyle).not.toBe('none');
  await expect(Math.abs(parseFloat(getComputedStyle(item).outlineWidth) - 2)).toBeLessThan(1.1);
}
export const MonthlyYearly: Story = {
  name: 'Compose the billing selector',
  parameters: { docs: {
    description: { story: 'Choose Annual to swap the savings badge; this composition keeps its monthly price unchanged.' },
    source: { language: 'tsx', code: usage },
  } },
  play: async ({ canvas, userEvent, args }) => {
    const monthly = canvas.getByRole('radio', { name: 'Monthly' });
    const annual = canvas.getByRole('radio', { name: 'Annual' });
    await expect(canvas.getByRole('radiogroup', { name: 'Billing period' })).toBeInTheDocument();
    for (const item of [monthly, annual]) {
      const wrapper = item.parentElement!;
      await expect(wrapper).toHaveAttribute('data-ui', 'toggle-subscription-item');
      await expect(getComputedStyle(wrapper).display).toBe('contents');
      await expect(item).toHaveAttribute('data-ui', 'segmented-control-item');
    }
    await expect(annual).toHaveAccessibleDescription(saving);
    await userEvent.click(annual);
    await expect(annual).toHaveAttribute('aria-checked', 'true');
    await expect(annual).toHaveAccessibleDescription('Annual saving applied');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith('annual');
    await userEvent.click(annual);
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await userEvent.click(monthly);
    await expect(args.onValueChange).toHaveBeenCalledTimes(2);
    await expect(args.onValueChange).toHaveBeenLastCalledWith('monthly');
  },
};
export const ThreePeriods: Story = {
  render: (args) => <Example {...args} third />,
};
export const Dark: Story = {};
export const LightTheme: Story = { decorators: [withLightTheme] };
export const ScopedTheme: Story = {
  render: (args) => (
    <ThemeRoot theme="light"><LightThemeFrame>
      <Example {...args} />
    </LightThemeFrame></ThemeRoot>
  ),
};
export const Sizes: Story = {
  render: (args) => (
    <ExampleGrid>
      {(['md', 'lg'] as const).map((size) => (
        <Example key={size} {...args} size={size} />
      ))}
    </ExampleGrid>
  ),
  play: async ({ canvas }) => {
    for (const [index, group] of canvas.getAllByRole('radiogroup').entries())
      await expect(
        group.querySelector('button')!.getBoundingClientRect().height,
      ).toBeGreaterThanOrEqual([40, 48][index]! - 0.5);
  },
};
export const Tones: Story = {
  render: (args) => (
    <ExampleGrid>
      {(['neutral', 'accent', 'success'] as const).map((tone) => (
        <Example key={tone} {...args} tone={tone} />
      ))}
    </ExampleGrid>
  ),
  play: async ({ canvas }) => {
    for (const group of canvas.getAllByRole('radiogroup')) {
      const selected = group.querySelector<HTMLElement>('[aria-checked="true"]')!;
      const pill = selected.querySelector('[data-ui="segmented-control-selection"]')!;
      const badge = group.querySelector('[data-ui="toggle-subscription-badge"]')!;
      const document = group.ownerDocument;
      const track = getComputedStyle(group).backgroundColor;
      await expect(
        contrastRatio(
          document,
          getComputedStyle(selected).color,
          track,
          getComputedStyle(pill).backgroundColor,
        ),
      ).toBeGreaterThanOrEqual(4.5);
      await expect(
        contrastRatio(
          document,
          getComputedStyle(badge).color,
          track,
          getComputedStyle(badge).backgroundColor,
        ),
      ).toBeGreaterThanOrEqual(4.5);
    }
  },
};
export const LightTones: Story = { ...Tones, decorators: [withLightTheme] };
export const NoSavings: Story = {
  render: (args) => <Example {...args} badge={null} activeBadge={null} />,
};
export const BadgeActiveSwap: Story = {
  play: async ({ canvas, userEvent }) => {
    const annual = canvas.getByRole('radio', { name: 'Annual' });
    const width = annual.getBoundingClientRect().width;
    await userEvent.click(annual);
    await expect(annual).toHaveAccessibleName('Annual');
    await expect(annual).toHaveAccessibleDescription('Annual saving applied');
    await expect(Math.abs(annual.getBoundingClientRect().width - width)).toBeLessThan(1);
  },
};
export const Keyboard: Story = {
  render: (args) => (
    <>
      <FixtureButton>Before</FixtureButton>
      <ToggleSubscription {...args}>
        <ToggleSubscription.Label>Billing period</ToggleSubscription.Label>
        <ToggleSubscription.List>
          <ToggleSubscription.Item value="monthly">Monthly</ToggleSubscription.Item>
          <ToggleSubscription.Item value="paused" disabled>
            Paused
          </ToggleSubscription.Item>
          <ToggleSubscription.Item value="annual">Annual</ToggleSubscription.Item>
          <ToggleSubscription.Item value="lifetime">Lifetime</ToggleSubscription.Item>
        </ToggleSubscription.List>
        <ToggleSubscription.Price amount={0} currency="USD" />
      </ToggleSubscription>
      <FixtureButton>After</FixtureButton>
    </>
  ),
  play: async ({ canvas, userEvent, args }) => {
    const monthly = canvas.getByRole('radio', { name: 'Monthly' });
    const annual = canvas.getByRole('radio', { name: 'Annual' });
    const lifetime = canvas.getByRole('radio', { name: 'Lifetime' });
    await userEvent.tab();
    await userEvent.tab();
    await assertFocus(monthly);
    for (const [key, target] of [
      ['{ArrowRight}', annual],
      ['{ArrowDown}', lifetime],
      ['{ArrowRight}', monthly],
      ['{ArrowLeft}', lifetime],
      ['{ArrowUp}', annual],
      ['{Home}', monthly],
      ['{End}', lifetime],
    ] as const) {
      await userEvent.keyboard(key);
      await assertFocus(target);
      await expect(target).toHaveAttribute('aria-checked', 'true');
    }
    await expect(args.onValueChange).toHaveBeenCalledTimes(7);
    await expect(args.onValueChange).toHaveBeenNthCalledWith(1, 'annual');
    await userEvent.keyboard('{Enter} ');
    await expect(args.onValueChange).toHaveBeenCalledTimes(7);
    await userEvent.tab();
    await expect(canvas.getByRole('button', { name: 'After' })).toHaveFocus();
    await userEvent.tab({ shift: true });
    await assertFocus(lifetime);
    await userEvent.tab({ shift: true });
    await expect(canvas.getByRole('button', { name: 'Before' })).toHaveFocus();
  },
};
export const Uncontrolled: Story = {
  parameters: { docs: { source: { language: 'tsx', code: `import { ToggleSubscription } from '@jfrader/ui';

const saving = 'Save ' + new Intl.NumberFormat('en', { style: 'percent' }).format(0.2);

<ToggleSubscription locale="en-US">
  <ToggleSubscription.Label>Billing period</ToggleSubscription.Label>
  <ToggleSubscription.List>
    <ToggleSubscription.Item value="monthly">Monthly</ToggleSubscription.Item>
    <ToggleSubscription.Item value="annual" badge={saving} activeBadge="Annual saving applied">Annual</ToggleSubscription.Item>
  </ToggleSubscription.List>
  <ToggleSubscription.Price amount={24} currency="USD" period="/ month" />
</ToggleSubscription>` } } },
  args: { defaultValue: undefined },
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.tab();
    await userEvent.keyboard('{Enter}');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith('monthly');
    await userEvent.click(canvas.getByRole('radio', { name: 'Annual' }));
    await expect(args.onValueChange).toHaveBeenCalledTimes(2);
    await expect(args.onValueChange).toHaveBeenLastCalledWith('annual');
    await expect(canvas.getByRole('radio', { name: 'Annual' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  },
};
export const NativeActivation: Story = {
  ...Uncontrolled,
  parameters: { docs: { source: { language: 'tsx', code: `import { ToggleSubscription } from '@jfrader/ui';

const saving = 'Save ' + new Intl.NumberFormat('en', { style: 'percent' }).format(0.2);

<ToggleSubscription locale="en-US">
  <ToggleSubscription.Label>Billing period</ToggleSubscription.Label>
  <ToggleSubscription.List>
    <ToggleSubscription.Item value="monthly">Monthly</ToggleSubscription.Item>
    <ToggleSubscription.Item value="annual" badge={saving} activeBadge="Annual saving applied">Annual</ToggleSubscription.Item>
  </ToggleSubscription.List>
  <ToggleSubscription.Price amount={24} currency="USD" period="/ month" />
</ToggleSubscription>` } } },
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.tab();
    await userEvent.keyboard(' ');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith('monthly');
    await userEvent.keyboard(' ');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await userEvent.click(canvas.getByRole('radio', { name: 'Annual' }));
    await userEvent.keyboard('{Enter}');
    await expect(args.onValueChange).toHaveBeenCalledTimes(2);
  },
};
function PricesExample({ reject = false, ...args }: ToggleSubscriptionProps & { reject?: boolean }) {
  const [period, setPeriod] = useState('monthly');
  const annual = period === 'annual';
  return (
    <>
      <ToggleSubscription
        {...args}
        value={period}
        onValueChange={(next) => {
          args.onValueChange?.(next);
          if (!reject) setPeriod(next);
        }}
      >
        <ToggleSubscription.Label>Billing period</ToggleSubscription.Label>
        <ToggleSubscription.List>
          <ToggleSubscription.Item value="monthly">Monthly</ToggleSubscription.Item>
          <ToggleSubscription.Item value="annual" badge={saving} activeBadge="Annual saving applied">
            Annual
          </ToggleSubscription.Item>
        </ToggleSubscription.List>
        <ToggleSubscription.Price
          amount={annual ? 240 : 24}
          currency="USD"
          period={annual ? '/ year' : '/ month'}
        />
        <ToggleSubscription.Price
          amount={annual ? 480 : 48}
          currency="USD"
          period={annual ? '/ year' : '/ month'}
        />
      </ToggleSubscription>
      <FixtureButton onClick={() => setPeriod('annual')}>
        Set annual externally
      </FixtureButton>
    </>
  );
}
export const SeveralPrices: Story = {
  name: 'Update several prices',
  parameters: { docs: {
    description: { story: 'Choose a period to update two prices, or apply Annual from the external button.' },
    source: { language: 'tsx', code: `import { useState } from 'react';
import { ToggleSubscription, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const ApplyButton = styled.button({ minHeight: vars.space[8], minWidth: vars.space[8] });
const saving = 'Save ' + new Intl.NumberFormat('en', { style: 'percent' }).format(0.2);

export function PlanPrices() {
  const [period, setPeriod] = useState('monthly');
  const annual = period === 'annual';
  return (
    <>
      <ToggleSubscription value={period} onValueChange={setPeriod} locale="en-US">
        <ToggleSubscription.Label>Billing period</ToggleSubscription.Label>
        <ToggleSubscription.List>
          <ToggleSubscription.Item value="monthly">Monthly</ToggleSubscription.Item>
          <ToggleSubscription.Item value="annual" badge={saving} activeBadge="Annual saving applied">Annual</ToggleSubscription.Item>
        </ToggleSubscription.List>
        <ToggleSubscription.Price amount={annual ? 240 : 24} currency="USD" period={annual ? '/ year' : '/ month'} />
        <ToggleSubscription.Price amount={annual ? 480 : 48} currency="USD" period={annual ? '/ year' : '/ month'} />
      </ToggleSubscription>
      <ApplyButton onClick={() => setPeriod('annual')}>Set annual externally</ApplyButton>
    </>
  );
}` },
  } },
  render: (args) => <PricesExample {...args} />,
  play: async ({ canvas, userEvent, args }) => {
    const construct = spyOn(Intl, 'NumberFormat');
    await userEvent.click(canvas.getByRole('radio', { name: 'Annual' }));
    await expect(construct).not.toHaveBeenCalled();
    construct.mockRestore();
    await expect(canvas.getAllByText('/ year')).toHaveLength(2);
    await expect(canvas.getAllByText('$240.00')).toHaveLength(2);
    await expect(canvas.getAllByText('$480.00')).toHaveLength(2);
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await userEvent.click(canvas.getByRole('radio', { name: 'Monthly' }));
    await expect(canvas.getAllByText('/ month')).toHaveLength(2);
    await expect(args.onValueChange).toHaveBeenCalledTimes(2);
    await userEvent.click(canvas.getByRole('button', { name: 'Set annual externally' }));
    await expect(canvas.getByRole('radio', { name: 'Annual' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await expect(args.onValueChange).toHaveBeenCalledTimes(2);
    await waitFor(async () => {
      for (const price of canvas.getAllByText('$240.00')) {
        const visual = price.closest('[aria-hidden="true"]');
        if (visual) {
          await expect(visual.children).toHaveLength(1);
          await expect(getComputedStyle(price).opacity).toBe('1');
        }
      }
    });
  },
};
export const ControlledRejects: Story = {
  render: (args) => <PricesExample {...args} reject />,
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.tab();
    await userEvent.keyboard('{ArrowRight}');
    const annual = canvas.getByRole('radio', { name: 'Annual' });
    const monthly = canvas.getByRole('radio', { name: 'Monthly' });
    await assertFocus(annual);
    await expect(monthly).toHaveAttribute('aria-checked', 'true');
    await expect(monthly.querySelector('[data-ui="segmented-control-selection"]')).not.toBeNull();
    await expect(annual).toHaveAccessibleDescription(saving);
    await expect(canvas.getAllByText('/ month')).toHaveLength(2);
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith('annual');
    await userEvent.keyboard('{ArrowLeft}');
    await assertFocus(monthly);
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await userEvent.keyboard('{End}{Enter} ');
    await expect(args.onValueChange).toHaveBeenCalledTimes(4);
  },
};
export const Disabled: Story = {
  parameters: { docs: { source: { language: 'tsx', code: `import { ToggleSubscription } from '@jfrader/ui';

const saving = 'Save ' + new Intl.NumberFormat('en', { style: 'percent' }).format(0.2);

<ToggleSubscription defaultValue="monthly" locale="en-US" disabled>
  <ToggleSubscription.Label>Billing period</ToggleSubscription.Label>
  <ToggleSubscription.List>
    <ToggleSubscription.Item value="monthly">Monthly</ToggleSubscription.Item>
    <ToggleSubscription.Item value="annual" badge={saving} activeBadge="Annual saving applied">Annual</ToggleSubscription.Item>
  </ToggleSubscription.List>
  <ToggleSubscription.Price amount={24} currency="USD" period="/ month" />
</ToggleSubscription>` } } },
  args: { disabled: true },
  play: async ({ canvas, userEvent, args }) => {
    for (const item of canvas.getAllByRole('radio')) {
      await expect(item).toBeDisabled();
      await expect(item.tabIndex).toBe(-1);
      await userEvent.click(item);
    }
    await expect(args.onValueChange).not.toHaveBeenCalled();
  },
};
export const UnknownPeriod: Story = {
  parameters: { docs: { source: { language: 'tsx', code: `import { ToggleSubscription } from '@jfrader/ui';

const saving = 'Save ' + new Intl.NumberFormat('en', { style: 'percent' }).format(0.2);

<ToggleSubscription value="unknown" locale="en-US" onValueChange={() => {}}>
  <ToggleSubscription.Label>Billing period</ToggleSubscription.Label>
  <ToggleSubscription.List>
    <ToggleSubscription.Item value="monthly">Monthly</ToggleSubscription.Item>
    <ToggleSubscription.Item value="annual" badge={saving} activeBadge="Annual saving applied">Annual</ToggleSubscription.Item>
  </ToggleSubscription.List>
  <ToggleSubscription.Price amount={24} currency="USD" period="/ month" />
</ToggleSubscription>` } } },
  args: { value: 'unknown' },
  play: async ({ canvas, userEvent, args }) => {
    await expect(canvas.getAllByRole('radio', { checked: false })).toHaveLength(2);
    await userEvent.tab();
    await assertFocus(canvas.getByRole('radio', { name: 'Monthly' }));
    await expect(args.onValueChange).not.toHaveBeenCalled();
  },
};
export const EmptyList: Story = {
  render: (args) => (
    <ToggleSubscription {...args}>
      <ToggleSubscription.Label>Billing period</ToggleSubscription.Label>
      <ToggleSubscription.List />
    </ToggleSubscription>
  ),
};
export const PreviousPrice: Story = {
  render: (args) => (
    <ToggleSubscription {...args}>
      <ToggleSubscription.Price
        amount={19.5}
        was={24}
        currency="USD"
        previousLabel="Previous price"
        period="/ month"
      />
      <ToggleSubscription.Price amount={24} was={24} currency="USD" />
      <ToggleSubscription.Price amount={24} was={Number.NaN} currency="USD" />
    </ToggleSubscription>
  ),
  play: async ({ canvasElement }) => {
    const previous = canvasElement.querySelector('del')!;
    const price = previous.closest('[data-ui="toggle-subscription-price"]')!;
    await expect(canvasElement.querySelectorAll('del')).toHaveLength(1);
    await expect(previous).not.toHaveAttribute('aria-describedby');
    await expect(previous.textContent).toBe('Previous price$24.00');
    await expect(price.textContent!.split('Previous price')).toHaveLength(2);
  },
};
export const ZeroAmount: Story = {
  render: (args) => (
    <ToggleSubscription {...args}>
      <ToggleSubscription.Price amount={0} currency="JPY" period={0} />
    </ToggleSubscription>
  ),
  play: async ({ canvasElement }) => {
    await expect(
      canvasElement.querySelector('[data-ui="toggle-subscription-amount"]')!.textContent,
    ).toContain('¥0');
    await expect(
      canvasElement.querySelector('[data-ui="toggle-subscription-period"]'),
    ).toHaveTextContent('0');
  },
};
const currencies = [
  { locale: 'en-US', currency: 'USD', amount: 1234.56 },
  { locale: 'de-DE', currency: 'EUR', amount: 1234.56 },
  { locale: 'ja-JP', currency: 'JPY', amount: 1234.56 },
  { locale: 'ar-EG', currency: 'USD', amount: 1234.56 },
  { locale: new Intl.Locale('fr-CH'), currency: 'CHF', amount: 1234.56 },
];
export const IntlCurrencies: Story = {
  name: 'Localized currencies',
  parameters: { docs: {
    description: { story: 'Compare currency formatting for US, German, Japanese, Egyptian and Swiss locales.' },
    source: { language: 'tsx', code: `import { ToggleSubscription } from '@jfrader/ui';

<ToggleSubscription defaultValue="monthly" locale="en-US">
  <ToggleSubscription.Price amount={1234.56} currency="USD" locale="en-US" />
  <ToggleSubscription.Price amount={1234.56} currency="EUR" locale="de-DE" />
  <ToggleSubscription.Price amount={1234.56} currency="JPY" locale="ja-JP" />
  <ToggleSubscription.Price amount={1234.56} currency="USD" locale="ar-EG" />
  <ToggleSubscription.Price amount={1234.56} currency="CHF" locale={new Intl.Locale('fr-CH')} />
</ToggleSubscription>` },
  } },
  render: (args) => (
    <ToggleSubscription {...args}>
      {currencies.map((props) => (
        <ToggleSubscription.Price key={String(props.locale)} {...props} />
      ))}
    </ToggleSubscription>
  ),
  play: async ({ canvasElement }) => {
    for (const [index, node] of canvasElement
      .querySelectorAll('[data-ui="toggle-subscription-amount"]')
      .entries()) {
      const props = currencies[index]!;
      const formatted = new Intl.NumberFormat(props.locale, {
        style: 'currency',
        currency: props.currency,
      }).format(props.amount);
      await expect(node.firstElementChild!.textContent).toBe(formatted);
      await expect(node.lastElementChild).toHaveAttribute('aria-hidden', 'true');
    }
  },
};
export const NarrowPrices: Story = {
  render: (args) => (
    <NarrowFrame>
      <ToggleSubscription {...args}>
        <ToggleSubscription.Price
          amount={123456789.12}
          currency="EUR"
          locale="de-DE"
          period="por cada período de facturación anual"
        />
      </ToggleSubscription>
    </NarrowFrame>
  ),
  play: async ({ canvasElement }) => {
    const price = canvasElement.querySelector<HTMLElement>('[data-ui="toggle-subscription-price"]')!;
    await expect(price.scrollWidth).toBeLessThanOrEqual(price.clientWidth + 1);
    await expect(getComputedStyle(price).overflowWrap).toBe('anywhere');
  },
};
export const LongTranslatedLabels: Story = {
  render: (args) => (
    <FixedSubscription {...args}>
      <ToggleSubscription.Label>Período de facturación</ToggleSubscription.Label>
      <ToggleSubscription.List>
        <ToggleSubscription.Item value="monthly">Facturación mensual flexible</ToggleSubscription.Item>
        <ToggleSubscription.Item value="annual" badge="Ahorro durante todo el año">
          Facturación anual anticipada
        </ToggleSubscription.Item>
      </ToggleSubscription.List>
    </FixedSubscription>
  ),
  play: async ({ canvas, userEvent }) => {
    await userEvent.tab();
    await userEvent.keyboard('{End}');
    const annual = canvas.getByRole('radio', {
      name: 'Facturación anual anticipada',
    });
    await assertFocus(annual);
    await expect(annual.getBoundingClientRect().width).toBeGreaterThan(280);
  },
};
function AriaExample(args: ToggleSubscriptionProps) {
  const id = useId();
  return (
    <>
      <span id={`${id}-name`}>Plan</span>
      <span id={`${id}-description`}>Prices before tax</span>
      <ToggleSubscription {...args}>
        <ToggleSubscription.Label>Billing period</ToggleSubscription.Label>
        <ToggleSubscription.List
          aria-label="Fallback"
          aria-labelledby={`${id}-name missing-reference`}
          aria-describedby={`${id}-description`}
          aria-invalid="true"
        >
          <ToggleSubscription.Item
            value="monthly"
            aria-label="Fallback item"
            aria-labelledby={`${id}-name`}
            aria-describedby={`${id}-description`}
            badge={0}
          >
            Monthly
          </ToggleSubscription.Item>
          <ToggleSubscription.Item value="annual">Annual</ToggleSubscription.Item>
        </ToggleSubscription.List>
      </ToggleSubscription>
    </>
  );
}
export const AriaMerge: Story = {
  render: (args) => <AriaExample {...args} />,
  play: async ({ canvas }) => {
    const group = canvas.getByRole('radiogroup', {
      name: 'Plan Billing period',
    });
    await expect(group).toHaveAttribute('aria-label', 'Fallback');
    await expect(group).toHaveAttribute('aria-invalid', 'true');
    await expect(group.getAttribute('aria-labelledby')).toContain('missing-reference');
    await expect(group).toHaveAccessibleDescription('Prices before tax');
    const item = canvas.getByRole('radio', { name: 'Plan Monthly' });
    await expect(item).toHaveAttribute('aria-label', 'Fallback item');
    await expect(item).toHaveAccessibleDescription('Prices before tax 0');
  },
};
export const FalsyBadge: Story = {
  render: (args) => (
    <div>
      {[false, null, 0, ''].map((content, index) => (
        <ToggleSubscription {...args} key={index} defaultValue="annual">
          <ToggleSubscription.Label>{`Period ${index}`}</ToggleSubscription.Label>
          <ToggleSubscription.List>
            <ToggleSubscription.Item value="annual" badge={content} activeBadge={content}>
              Annual
            </ToggleSubscription.Item>
          </ToggleSubscription.List>
          <ToggleSubscription.Price amount={0} currency="USD" period={content} />
        </ToggleSubscription>
      ))}
    </div>
  ),
  play: async ({ canvasElement, canvas }) => {
    const items = canvas.getAllByRole('radio');
    for (const [index, item] of items.entries()) {
      await expect(item.hasAttribute('aria-describedby')).toBe(index === 2);
      await expect(item.querySelectorAll('[data-ui="toggle-subscription-badge"]')).toHaveLength(
        index === 2 ? 1 : 0,
      );
    }
    await expect(canvasElement.querySelectorAll('[data-ui="toggle-subscription-period"]')).toHaveLength(
      1,
    );
    await expect(items[2]).toHaveAccessibleDescription('0');
  },
};
export const RTL: Story = {
  parameters: { docs: { source: { language: 'tsx', code: `import { ToggleSubscription } from '@jfrader/ui';

const saving = 'Save ' + new Intl.NumberFormat('en', { style: 'percent' }).format(0.2);

<ToggleSubscription defaultValue="monthly" locale="en-US" dir="rtl">
  <ToggleSubscription.Label>Billing period</ToggleSubscription.Label>
  <ToggleSubscription.List>
    <ToggleSubscription.Item value="monthly">Monthly</ToggleSubscription.Item>
    <ToggleSubscription.Item value="annual" badge={saving} activeBadge="Annual saving applied">Annual</ToggleSubscription.Item>
  </ToggleSubscription.List>
  <ToggleSubscription.Price amount={24} currency="USD" period="/ month" />
</ToggleSubscription>` } } },
  args: { dir: 'rtl' },
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.tab();
    await userEvent.keyboard('{ArrowLeft}');
    await assertFocus(canvas.getByRole('radio', { name: 'Annual' }));
    await expect(args.onValueChange).toHaveBeenLastCalledWith('annual');
    await userEvent.keyboard('{ArrowRight}');
    await assertFocus(canvas.getByRole('radio', { name: 'Monthly' }));
    await expect(args.onValueChange).toHaveBeenCalledTimes(2);
  },
};
export const ReducedMotion: Story = {
  ...SeveralPrices,
  parameters: {
    docs: {
      description: {
        story:
          'Enable reduced motion in the browser to check that selection and prices change without animation. This play does not set the preference.',
      },
    },
  },
};
export const ForcedColors: Story = {
  args: { defaultValue: 'annual' },
  parameters: {
    docs: {
      source: { language: 'tsx', code: `import { ToggleSubscription } from '@jfrader/ui';

const saving = 'Save ' + new Intl.NumberFormat('en', { style: 'percent' }).format(0.2);

<ToggleSubscription defaultValue="annual" locale="en-US">
  <ToggleSubscription.Label>Billing period</ToggleSubscription.Label>
  <ToggleSubscription.List>
    <ToggleSubscription.Item value="monthly">Monthly</ToggleSubscription.Item>
    <ToggleSubscription.Item value="annual" badge={saving} activeBadge="Annual saving applied">Annual</ToggleSubscription.Item>
  </ToggleSubscription.List>
  <ToggleSubscription.Price amount={24} currency="USD" period="/ month" />
</ToggleSubscription>` },
      description: {
        story:
          'Enable forced colors in the browser to check selection borders, savings borders, and the focus outline. This story does not set the preference.',
      },
    },
  },
};
export const ConsumerVeto: Story = {
  render: (args) => (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        throw new Error('Unexpected submit');
      }}
    >
      <ToggleSubscription {...args}>
        <ToggleSubscription.List aria-label="Billing period">
          <ToggleSubscription.Item value="monthly">Monthly</ToggleSubscription.Item>
          <ToggleSubscription.Item value="annual" onClick={(event) => event.preventDefault()}>
            Annual
          </ToggleSubscription.Item>
        </ToggleSubscription.List>
      </ToggleSubscription>
    </form>
  ),
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(canvas.getByRole('radio', { name: 'Annual' }));
    await userEvent.keyboard('{Enter} ');
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await expect(canvas.getByRole('radio', { name: 'Annual' })).toHaveAttribute('type', 'button');
  },
};
// This story tests the documented css/slot API and native style merging.
export const SlotsAndStyling: Story = {
  render: (args) => (
    <ToggleSubscription {...args} sx={{ gap: vars.space[4] }}>
      <ToggleSubscription.Label sx={{ fontWeight: vars.fontWeight.semibold }}>
        Billing period
      </ToggleSubscription.Label>
      <ToggleSubscription.List sx={{ padding: vars.space[2] }}>
        <ToggleSubscription.Item
          value="monthly"
          sx={{ paddingInline: vars.space[4] }}
          slotProps={{
            label: { sx: { fontStyle: 'italic' } },
            badge: { sx: { borderRadius: vars.radius.sm } },
            selection: {
              className: 'billing-selection',
              title: 'Selected period',
              sx: { borderRadius: vars.radius.full },
            },
          }}
          badge={0}
        >
          Monthly
        </ToggleSubscription.Item>
      </ToggleSubscription.List>
      <ToggleSubscription.Price
        amount={24}
        was={30}
        currency="USD"
        previousLabel="Previous price"
        period="/ month"
        sx={{ gap: vars.space[4] }}
        slotProps={{
          amount: { sx: { fontSize: vars.textSize.xl } },
          previous: { sx: { fontStyle: 'italic' } },
          period: { sx: { fontWeight: vars.fontWeight.semibold } },
        }}
      />
    </ToggleSubscription>
  ),
  play: async ({ canvasElement, canvas }) => {
    const item = canvas.getByRole('radio');
    await expect(
      getComputedStyle(item.querySelector('[data-ui="toggle-subscription-item-label"]')!).fontStyle,
    ).toBe('italic');
    await expectPx(
      getComputedStyle(item.querySelector('[data-ui="toggle-subscription-badge"]')!).borderRadius,
      8,
    );
    await expect(getComputedStyle(canvasElement.querySelector('del')!).fontStyle).toBe('italic');
    await expect(
      Math.abs(
        parseFloat(
          getComputedStyle(canvasElement.querySelector('[data-ui="toggle-subscription-period"]')!)
            .fontWeight,
        ) - 600,
      ),
    ).toBeLessThan(1);
    await expectPx(
      getComputedStyle(item.querySelector('[data-ui="segmented-control-selection"]')!).borderRadius,
      999,
    );
    await expect(item.querySelector('[data-ui="segmented-control-selection"]')).toHaveAttribute(
      'title',
      'Selected period',
    );
  },
};

export const RootRef: Story = {
  parameters: { docs: { source: { language: 'tsx', code: `import { useRef } from 'react';
import { ToggleSubscription } from '@jfrader/ui';

const saving = 'Save ' + new Intl.NumberFormat('en', { style: 'percent' }).format(0.2);

export function BillingPeriod() {
  const rootRef = useRef<HTMLDivElement>(null);
  return (
    <ToggleSubscription ref={rootRef} defaultValue="monthly" locale="en-US">
      <ToggleSubscription.Label>Billing period</ToggleSubscription.Label>
      <ToggleSubscription.List>
        <ToggleSubscription.Item value="monthly">Monthly</ToggleSubscription.Item>
        <ToggleSubscription.Item value="annual" badge={saving} activeBadge="Annual saving applied">Annual</ToggleSubscription.Item>
      </ToggleSubscription.List>
      <ToggleSubscription.Price amount={24} currency="USD" period="/ month" />
    </ToggleSubscription>
  );
}` } } },
  args: { ref: fn() },
  play: async ({ canvasElement, args }) => {
    await expect(args.ref).toHaveBeenCalledWith(
      canvasElement.querySelector('[data-ui="toggle-subscription"]'),
    );
  },
};
export const ListRef: Story = {
  args: { ref: fn() },
  render: ({ ref, ...args }) => (
    <ToggleSubscription {...args}>
      <ToggleSubscription.List ref={ref} aria-label="Billing period">
        <ToggleSubscription.Item value="monthly">Monthly</ToggleSubscription.Item>
      </ToggleSubscription.List>
    </ToggleSubscription>
  ),
  play: async ({ canvas, args }) => {
    await expect(args.ref).toHaveBeenCalledWith(canvas.getByRole('radiogroup'));
  },
};
export const FalsyLabels: Story = {
  render: (args) => (
    <div>
      {[false, null, 0, ''].map((content, index) => (
        <ToggleSubscription {...args} key={index}>
          <ToggleSubscription.Label>{content}</ToggleSubscription.Label>
          <ToggleSubscription.List aria-label={`Billing period ${index}`}>
            <ToggleSubscription.Item value="monthly" aria-label={`Monthly ${index}`}>
              {content}
            </ToggleSubscription.Item>
          </ToggleSubscription.List>
        </ToggleSubscription>
      ))}
    </div>
  ),
  play: async ({ canvasElement, canvas }) => {
    await expect(canvasElement.querySelectorAll('[data-ui="toggle-subscription-label"]')).toHaveLength(
      1,
    );
    await expect(
      canvasElement.querySelectorAll('[data-ui="toggle-subscription-item-label"]'),
    ).toHaveLength(1);
    for (const [index, item] of canvas.getAllByRole('radio').entries()) {
      await expect(item.hasAttribute('aria-labelledby')).toBe(index === 2);
    }
  },
};
