import { useId, useState, type ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, waitFor } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { withLightTheme } from '../../testing/story-decorators';
import { ThemeRoot } from '../theme-root';
import { BillingToggle, type BillingToggleProps } from './index';

const saving = `Save ${new Intl.NumberFormat('en', { style: 'percent' }).format(0.2)}`;
const usage = `<BillingToggle value={period} onValueChange={setPeriod} locale="en-US">
  <BillingToggle.Label>Billing period</BillingToggle.Label>
  <BillingToggle.List>
    <BillingToggle.Item value="monthly">Monthly</BillingToggle.Item>
    <BillingToggle.Item value="annual" badge={savingText}>Annual</BillingToggle.Item>
  </BillingToggle.List>
  <BillingToggle.Price amount={price.amount} currency="USD" period={price.periodText} />
</BillingToggle>`;
const fixtureButton = { minHeight: 32, minWidth: 32 };
function Example({
  third = false,
  badge = saving,
  activeBadge = 'Annual saving applied',
  ...args
}: BillingToggleProps & {
  third?: boolean;
  badge?: ReactNode;
  activeBadge?: ReactNode;
}) {
  return (
    <BillingToggle {...args}>
      <BillingToggle.Label>Billing period</BillingToggle.Label>
      <BillingToggle.List>
        <BillingToggle.Item value="monthly">Monthly</BillingToggle.Item>
        <BillingToggle.Item value="annual" badge={badge} activeBadge={activeBadge}>
          Annual
        </BillingToggle.Item>
        {third && <BillingToggle.Item value="lifetime">Lifetime</BillingToggle.Item>}
      </BillingToggle.List>
      <BillingToggle.Price amount={24} currency="USD" period="/ month" />
    </BillingToggle>
  );
}
const meta = {
  title: 'Inputs/BillingToggle',
  component: BillingToggle,
  tags: ['autodocs'],
  args: { defaultValue: 'monthly', locale: 'en-US', onValueChange: fn() },
  render: (args) => <Example {...args} />,
  parameters: {
    docs: {
      source: { code: usage },
      description: {
        component:
          'A pricing composition over SegmentedControl: one named radiogroup, consumer-owned labels, savings and prices. Arrow keys select and wrap past disabled periods; horizontal arrows reverse in RTL. Home/End select endpoints; Enter/Space activate once. Tab enters the focused enabled item and exits to the page. Controlled requests commit only when the parent updates value. Price requires a finite amount and ISO currency; previousLabel is required for a visible previous price. Pin locale for SSR. No form field or automatic price calculation. The composed selector retains SegmentedControl data-ui markers; billing items also expose data-billing-part="item". List ref reaches the radiogroup; Item ref reaches its button. Badges must be noninteractive.',
      },
    },
  },
} satisfies Meta<typeof BillingToggle>;
export default meta;
type Story = StoryObj<typeof meta>;
async function assertFocus(item: HTMLElement) {
  await expect(item.ownerDocument.activeElement).toBe(item);
  await expect(getComputedStyle(item).outlineStyle).not.toBe('none');
  await expect(Math.abs(parseFloat(getComputedStyle(item).outlineWidth) - 2)).toBeLessThan(1.1);
}
export const MonthlyYearly: Story = {
  play: async ({ canvas, userEvent, args }) => {
    const monthly = canvas.getByRole('radio', { name: 'Monthly' });
    const annual = canvas.getByRole('radio', { name: 'Annual' });
    await expect(canvas.getByRole('radiogroup', { name: 'Billing period' })).toBeInTheDocument();
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
    <ThemeRoot theme="light" style={{ backgroundColor: vars.color.bg, padding: vars.space[4] }}>
      <Example {...args} />
    </ThemeRoot>
  ),
};
export const Sizes: Story = {
  render: (args) => (
    <div style={{ display: 'grid', gap: 16 }}>
      {(['md', 'lg'] as const).map((size) => (
        <Example key={size} {...args} size={size} />
      ))}
    </div>
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
    <div style={{ display: 'grid', gap: 16 }}>
      {(['neutral', 'accent', 'success'] as const).map((tone) => (
        <Example key={tone} {...args} tone={tone} />
      ))}
    </div>
  ),
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
      <button style={fixtureButton}>Before</button>
      <BillingToggle {...args}>
        <BillingToggle.Label>Billing period</BillingToggle.Label>
        <BillingToggle.List>
          <BillingToggle.Item value="monthly">Monthly</BillingToggle.Item>
          <BillingToggle.Item value="paused" disabled>
            Paused
          </BillingToggle.Item>
          <BillingToggle.Item value="annual">Annual</BillingToggle.Item>
          <BillingToggle.Item value="lifetime">Lifetime</BillingToggle.Item>
        </BillingToggle.List>
        <BillingToggle.Price amount={0} currency="USD" />
      </BillingToggle>
      <button style={fixtureButton}>After</button>
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
function PricesExample({ reject = false, ...args }: BillingToggleProps & { reject?: boolean }) {
  const [period, setPeriod] = useState('monthly');
  const annual = period === 'annual';
  return (
    <>
      <BillingToggle
        {...args}
        value={period}
        onValueChange={(next) => {
          args.onValueChange?.(next);
          if (!reject) setPeriod(next);
        }}
      >
        <BillingToggle.Label>Billing period</BillingToggle.Label>
        <BillingToggle.List>
          <BillingToggle.Item value="monthly">Monthly</BillingToggle.Item>
          <BillingToggle.Item value="annual" badge={saving} activeBadge="Annual saving applied">
            Annual
          </BillingToggle.Item>
        </BillingToggle.List>
        <BillingToggle.Price
          amount={annual ? 240 : 24}
          currency="USD"
          period={annual ? '/ year' : '/ month'}
        />
        <BillingToggle.Price
          amount={annual ? 480 : 48}
          currency="USD"
          period={annual ? '/ year' : '/ month'}
        />
      </BillingToggle>
      <button style={fixtureButton} onClick={() => setPeriod('annual')}>
        Set annual externally
      </button>
    </>
  );
}
export const SeveralPrices: Story = {
  render: (args) => <PricesExample {...args} />,
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(canvas.getByRole('radio', { name: 'Annual' }));
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
    <BillingToggle {...args}>
      <BillingToggle.Label>Billing period</BillingToggle.Label>
      <BillingToggle.List />
    </BillingToggle>
  ),
};
export const PreviousPrice: Story = {
  render: (args) => (
    <BillingToggle {...args}>
      <BillingToggle.Price
        amount={19.5}
        was={24}
        currency="USD"
        previousLabel="Previous price"
        period="/ month"
      />
      <BillingToggle.Price amount={24} was={24} currency="USD" />
      <BillingToggle.Price amount={24} was={Number.NaN} currency="USD" />
    </BillingToggle>
  ),
  play: async ({ canvasElement }) => {
    const previous = canvasElement.querySelector('del')!;
    await expect(canvasElement.querySelectorAll('del')).toHaveLength(1);
    await expect(previous).toHaveAccessibleDescription('Previous price');
    await expect(previous.textContent).toContain('$24.00');
  },
};
export const ZeroAmount: Story = {
  render: (args) => (
    <BillingToggle {...args}>
      <BillingToggle.Price amount={0} currency="JPY" period={0} />
    </BillingToggle>
  ),
  play: async ({ canvasElement }) => {
    await expect(
      canvasElement.querySelector('[data-ui="billing-toggle-amount"]')!.textContent,
    ).toContain('¥0');
    await expect(
      canvasElement.querySelector('[data-ui="billing-toggle-period"]'),
    ).toHaveTextContent('0');
  },
};
const currencies = [
  { locale: 'en-US', currency: 'USD', amount: 1234.56 },
  { locale: 'de-DE', currency: 'EUR', amount: 1234.56 },
  { locale: 'ja-JP', currency: 'JPY', amount: 1234.56 },
  { locale: 'ar-EG', currency: 'USD', amount: 1234.56 },
];
export const IntlCurrencies: Story = {
  render: (args) => (
    <BillingToggle {...args}>
      {currencies.map((props) => (
        <BillingToggle.Price key={props.locale} {...props} />
      ))}
    </BillingToggle>
  ),
  play: async ({ canvasElement }) => {
    for (const [index, node] of canvasElement
      .querySelectorAll('[data-ui="billing-toggle-amount"]')
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
    <div style={{ width: 180 }}>
      <BillingToggle {...args}>
        <BillingToggle.Price
          amount={123456789.12}
          currency="EUR"
          locale="de-DE"
          period="por cada período de facturación anual"
        />
      </BillingToggle>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const price = canvasElement.querySelector<HTMLElement>('[data-ui="billing-toggle-price"]')!;
    await expect(price.scrollWidth).toBeLessThanOrEqual(price.clientWidth + 1);
    await expect(getComputedStyle(price).overflowWrap).toBe('anywhere');
  },
};
export const LongTranslatedLabels: Story = {
  render: (args) => (
    <BillingToggle {...args} style={{ width: 280 }}>
      <BillingToggle.Label>Período de facturación</BillingToggle.Label>
      <BillingToggle.List>
        <BillingToggle.Item value="monthly">Facturación mensual flexible</BillingToggle.Item>
        <BillingToggle.Item value="annual" badge="Ahorro durante todo el año">
          Facturación anual anticipada
        </BillingToggle.Item>
      </BillingToggle.List>
    </BillingToggle>
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
function AriaExample(args: BillingToggleProps) {
  const id = useId();
  return (
    <>
      <span id={`${id}-name`}>Plan</span>
      <span id={`${id}-description`}>Prices before tax</span>
      <BillingToggle {...args}>
        <BillingToggle.Label>Billing period</BillingToggle.Label>
        <BillingToggle.List
          aria-label="Fallback"
          aria-labelledby={`${id}-name missing-reference`}
          aria-describedby={`${id}-description`}
          aria-invalid="true"
        >
          <BillingToggle.Item
            value="monthly"
            aria-label="Fallback item"
            aria-labelledby={`${id}-name`}
            aria-describedby={`${id}-description`}
            badge={0}
          >
            Monthly
          </BillingToggle.Item>
          <BillingToggle.Item value="annual">Annual</BillingToggle.Item>
        </BillingToggle.List>
      </BillingToggle>
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
        <BillingToggle {...args} key={index} defaultValue="annual">
          <BillingToggle.Label>{`Period ${index}`}</BillingToggle.Label>
          <BillingToggle.List>
            <BillingToggle.Item value="annual" badge={content} activeBadge={content}>
              Annual
            </BillingToggle.Item>
          </BillingToggle.List>
          <BillingToggle.Price amount={0} currency="USD" period={content} />
        </BillingToggle>
      ))}
    </div>
  ),
  play: async ({ canvasElement, canvas }) => {
    const items = canvas.getAllByRole('radio');
    for (const [index, item] of items.entries()) {
      await expect(item.hasAttribute('aria-describedby')).toBe(index === 2);
      await expect(item.querySelectorAll('[data-ui="billing-toggle-badge"]')).toHaveLength(
        index === 2 ? 1 : 0,
      );
    }
    await expect(canvasElement.querySelectorAll('[data-ui="billing-toggle-period"]')).toHaveLength(
      1,
    );
    await expect(items[2]).toHaveAccessibleDescription('0');
  },
};
export const RTL: Story = {
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
          'Structural interaction check. Enable reduced motion in browser rendering settings to inspect instant selection and price changes; this play does not emulate media.',
      },
    },
  },
};
export const ForcedColors: Story = {
  args: { defaultValue: 'annual' },
  parameters: {
    docs: {
      description: {
        story:
          'Structural selected-state check. Enable forced colors in browser rendering settings to inspect real selected borders, savings borders and the focus outline; this story does not emulate media.',
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
      <BillingToggle {...args}>
        <BillingToggle.List aria-label="Billing period">
          <BillingToggle.Item value="monthly">Monthly</BillingToggle.Item>
          <BillingToggle.Item value="annual" onClick={(event) => event.preventDefault()}>
            Annual
          </BillingToggle.Item>
        </BillingToggle.List>
      </BillingToggle>
    </form>
  ),
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(canvas.getByRole('radio', { name: 'Annual' }));
    await userEvent.keyboard('{Enter} ');
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await expect(canvas.getByRole('radio', { name: 'Annual' })).toHaveAttribute('type', 'button');
  },
};
export const SlotsAndStyling: Story = {
  render: (args) => (
    <BillingToggle {...args} sx={{ gap: vars.space[4] }}>
      <BillingToggle.Label sx={{ fontWeight: vars.fontWeight.semibold }}>
        Billing period
      </BillingToggle.Label>
      <BillingToggle.List sx={{ padding: vars.space[2] }}>
        <BillingToggle.Item
          value="monthly"
          sx={{ paddingInline: vars.space[4] }}
          slotProps={{
            label: { css: { fontStyle: 'italic' } },
            badge: { css: { borderRadius: vars.radius.sm } },
            selection: {
              className: 'billing-selection',
              title: 'Selected period',
              css: { borderRadius: vars.radius.full },
            },
          }}
          badge={0}
        >
          Monthly
        </BillingToggle.Item>
      </BillingToggle.List>
      <BillingToggle.Price
        amount={24}
        was={30}
        currency="USD"
        previousLabel="Previous price"
        period="/ month"
        sx={{ gap: vars.space[4] }}
        slotProps={{
          amount: { css: { fontSize: vars.textSize.xl } },
          previous: { css: { fontStyle: 'italic' } },
          period: { css: { fontWeight: vars.fontWeight.semibold } },
        }}
      />
    </BillingToggle>
  ),
  play: async ({ canvasElement, canvas }) => {
    const item = canvas.getByRole('radio');
    await expect(
      getComputedStyle(item.querySelector('[data-ui="billing-toggle-item-label"]')!).fontStyle,
    ).toBe('italic');
    await expect(
      getComputedStyle(item.querySelector('[data-ui="billing-toggle-badge"]')!).borderRadius,
    ).toBe('8px');
    await expect(getComputedStyle(canvasElement.querySelector('del')!).fontStyle).toBe('italic');
    await expect(
      getComputedStyle(canvasElement.querySelector('[data-ui="billing-toggle-period"]')!)
        .fontWeight,
    ).toBe('600');
    await expect(
      getComputedStyle(item.querySelector('[data-ui="segmented-control-selection"]')!).borderRadius,
    ).toBe('999px');
    await expect(item.querySelector('[data-ui="segmented-control-selection"]')).toHaveAttribute(
      'title',
      'Selected period',
    );
  },
};

export const RootRef: Story = {
  args: { ref: fn() },
  play: async ({ canvasElement, args }) => {
    await expect(args.ref).toHaveBeenCalledWith(
      canvasElement.querySelector('[data-ui="billing-toggle"]'),
    );
  },
};
export const ListRef: Story = {
  args: { ref: fn() },
  render: ({ ref, ...args }) => (
    <BillingToggle {...args}>
      <BillingToggle.List ref={ref} aria-label="Billing period">
        <BillingToggle.Item value="monthly">Monthly</BillingToggle.Item>
      </BillingToggle.List>
    </BillingToggle>
  ),
  play: async ({ canvas, args }) => {
    await expect(args.ref).toHaveBeenCalledWith(canvas.getByRole('radiogroup'));
  },
};
export const FalsyLabels: Story = {
  render: (args) => (
    <div>
      {[false, null, 0, ''].map((content, index) => (
        <BillingToggle {...args} key={index}>
          <BillingToggle.Label>{content}</BillingToggle.Label>
          <BillingToggle.List aria-label={`Billing period ${index}`}>
            <BillingToggle.Item value="monthly" aria-label={`Monthly ${index}`}>
              {content}
            </BillingToggle.Item>
          </BillingToggle.List>
        </BillingToggle>
      ))}
    </div>
  ),
  play: async ({ canvasElement, canvas }) => {
    await expect(canvasElement.querySelectorAll('[data-ui="billing-toggle-label"]')).toHaveLength(
      1,
    );
    await expect(
      canvasElement.querySelectorAll('[data-ui="billing-toggle-item-label"]'),
    ).toHaveLength(1);
    for (const [index, item] of canvas.getAllByRole('radio').entries()) {
      await expect(item.hasAttribute('aria-labelledby')).toBe(index === 2);
    }
  },
};
