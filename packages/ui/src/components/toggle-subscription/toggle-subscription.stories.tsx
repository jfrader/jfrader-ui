import { useId, useState, type ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, spyOn, waitFor } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { withLightTheme } from '../../testing/story-decorators';
import { ThemeRoot } from '../theme-root';
import { ToggleSubscription, type ToggleSubscriptionProps } from './index';

const saving = `Save ${new Intl.NumberFormat('en', { style: 'percent' }).format(0.2)}`;
const usage = `<ToggleSubscription value={period} onValueChange={setPeriod} locale="en-US">
  <ToggleSubscription.Label>Billing period</ToggleSubscription.Label>
  <ToggleSubscription.List>
    <ToggleSubscription.Item value="monthly">Monthly</ToggleSubscription.Item>
    <ToggleSubscription.Item value="annual" badge={savingText}>Annual</ToggleSubscription.Item>
  </ToggleSubscription.List>
  <ToggleSubscription.Price amount={price.amount} currency="USD" period={price.periodText} />
</ToggleSubscription>`;
const fixtureButton = { minHeight: 32, minWidth: 32 };
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
      source: { code: usage },
      description: {
        component:
          'Choose a billing period and show its price, savings, or a previous price.',
      },
      usage: `- Supply labels, savings, and prices. The component does not calculate prices or create a form field.
- Controlled changes take effect when the parent updates \`value\`.
- Price needs a finite amount and an ISO currency. Supply \`previousLabel\` when showing a previous price. Set \`locale\` for SSR.
- Badges must not contain controls.
- The selector keeps SegmentedControl data-ui markers. Each Item has a wrapper with \`data-ui="toggle-subscription-item"\`.
- List ref targets the radiogroup; Item ref targets its button.

### Keyboard
- Arrow keys select and wrap, skipping disabled periods. Horizontal arrows reverse in RTL.
- Home/End select the first/last enabled period. Enter/Space activate once.
- Tab enters the focused enabled item, then leaves the group.`,
    },
  },
} satisfies Meta<typeof ToggleSubscription>;
export default meta;
type Story = StoryObj<typeof meta>;
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
      <button style={fixtureButton}>Before</button>
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
      <button style={fixtureButton} onClick={() => setPeriod('annual')}>
        Set annual externally
      </button>
    </>
  );
}
export const SeveralPrices: Story = {
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
    <div style={{ width: 180 }}>
      <ToggleSubscription {...args}>
        <ToggleSubscription.Price
          amount={123456789.12}
          currency="EUR"
          locale="de-DE"
          period="por cada período de facturación anual"
        />
      </ToggleSubscription>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const price = canvasElement.querySelector<HTMLElement>('[data-ui="toggle-subscription-price"]')!;
    await expect(price.scrollWidth).toBeLessThanOrEqual(price.clientWidth + 1);
    await expect(getComputedStyle(price).overflowWrap).toBe('anywhere');
  },
};
export const LongTranslatedLabels: Story = {
  render: (args) => (
    <ToggleSubscription {...args} style={{ width: 280 }}>
      <ToggleSubscription.Label>Período de facturación</ToggleSubscription.Label>
      <ToggleSubscription.List>
        <ToggleSubscription.Item value="monthly">Facturación mensual flexible</ToggleSubscription.Item>
        <ToggleSubscription.Item value="annual" badge="Ahorro durante todo el año">
          Facturación anual anticipada
        </ToggleSubscription.Item>
      </ToggleSubscription.List>
    </ToggleSubscription>
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
          amount: { css: { fontSize: vars.textSize.xl } },
          previous: { css: { fontStyle: 'italic' } },
          period: { css: { fontWeight: vars.fontWeight.semibold } },
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
