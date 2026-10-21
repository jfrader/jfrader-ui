import { StrictMode, useId, useState, type ReactNode, type ComponentPropsWithRef } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, waitFor } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { css } from '../../styling/css';
// `styled` is the app-facing styling API; consumers import it from `@jfrader/ui`.
import { styled } from '../../index';
import { withLightTheme } from '../../testing/story-decorators';
import { ThemeRoot } from '../theme-root';
import { RadioCards, type RadioCardsComposedProps as RadioCardsProps, type RadioCardsOption, type RadioCardsShorthandProps } from './index';

function ReplacementCardPart(props: ComponentPropsWithRef<'span'>) {
  return <span {...props} data-replaced="true" />;
}

export const ReplaceItemParts: Story = {
  render: () => (
    <RadioCards defaultValue="standard" aria-label="Delivery">
      <RadioCards.Item value="standard" label="Standard" description="Four days" icon="S" meta="Free"
        slots={{ control: ReplacementCardPart, indicator: ReplacementCardPart, icon: ReplacementCardPart, label: ReplacementCardPart, description: ReplacementCardPart, meta: ReplacementCardPart }}
        slotProps={{ control: { title: 'Delivery option' } }} />
    </RadioCards>
  ),
  play: async ({ canvasElement }) => {
    const parts = canvasElement.querySelectorAll<HTMLElement>('[data-replaced]');
    await expect(parts).toHaveLength(6);
    for (const part of parts) {
      await expect(part.className).not.toBe('');
      await expect(part).toHaveAttribute('data-ui');
    }
    await expect(canvasElement.querySelector('[data-ui="radio-cards-control"]')).toHaveAttribute('title', 'Delivery option');
  },
};

const usage = `import { RadioCards } from '@jfrader/ui';

<RadioCards defaultValue="standard">
  <RadioCards.Label>Shipping speed</RadioCards.Label>
  <RadioCards.Description>Choose a delivery option.</RadioCards.Description>
  <RadioCards.Item value="standard" label="Standard" description="4–6 business days" />
  <RadioCards.Item value="express" label="Express" description="1–2 business days" disabledReason="Unavailable at this address" />
  <RadioCards.Item value="pickup" label="Pickup" description="Collect at the store" />
</RadioCards>`;
const Fixture = styled.div({ display: 'grid', gap: vars.space[4], inlineSize: '100%', maxInlineSize: '44rem' });
const FixtureForm = Fixture.withComponent('form');
const NarrowFixture = styled(Fixture)({ maxWidth: '18rem' });
const FixtureButton = styled.button({
  minBlockSize: vars.space[8],
  minInlineSize: vars.space[8],
  padding: vars.space[2],
});
// These overrides exercise the documented slot sx API.
const overrides = {
  control: { sx: css({ borderRadius: vars.radius.sm }) },
  indicator: { sx: css({ inlineSize: vars.space[6], blockSize: vars.space[6] }) },
  icon: { sx: css({ fontSize: vars.textSize['2xl'] }) },
  label: { sx: css({ fontWeight: vars.fontWeight.semibold }) },
  description: { sx: css({ fontSize: vars.textSize.xs }) },
  meta: { sx: css({ fontWeight: vars.fontWeight.semibold }) },
};
function DeliveryIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 6h12v12H3zM15 10h3l3 4v4h-6M6 18v2m12-2v2" />
    </svg>
  );
}
type Delivery = 'standard' | 'express';
const DELIVERY_OPTIONS = [
  { value: 'standard', label: 'Standard' },
  { value: 'express', label: 'Express' },
] as const satisfies readonly RadioCardsOption<Delivery>[];

/** Compile-time consumer checks; never rendered. */
function RadioCardsGenericChecks() {
  const saveDelivery = (delivery: Delivery) => delivery;
  return (
    <>
      <RadioCards<Delivery> options={DELIVERY_OPTIONS} value="standard" onValueChange={saveDelivery} label="Delivery" />
      <RadioCards options={DELIVERY_OPTIONS} onValueChange={(next) => saveDelivery(next)} label="Delivery" />
      {/* @ts-expect-error value must be one of the options */}
      <RadioCards<Delivery> options={DELIVERY_OPTIONS} value="overnight" label="Delivery" />
    </>
  );
}

function Example({ disabledOption = false, ...args }: RadioCardsProps & { disabledOption?: boolean }) {
  return (
    <RadioCards {...args}>
      <RadioCards.Label>Shipping speed</RadioCards.Label>
      <RadioCards.Description>Choose a delivery option.</RadioCards.Description>
      <RadioCards.Item value="standard" label="Standard" description="4–6 business days" />
      <RadioCards.Item
        value="express"
        label="Express"
        description="1–2 business days"
        disabled={disabledOption}
        disabledReason="Unavailable at this address"
      />
      <RadioCards.Item value="pickup" label="Pickup" description="Collect at the store" />
    </RadioCards>
  );
}
const meta = {
  title: 'Inputs/RadioCards',
  component: RadioCards,
  tags: ['autodocs'],
  args: { defaultValue: 'standard', onValueChange: fn() },
  render: (args) => <Example {...args} />,
  parameters: {
    docs: {
      sections: [
        { title: 'Basic', stories: ['DefaultGrid', 'Shorthand'] },
        { title: 'Layouts', stories: ['List'] },
        { title: 'Descriptions and icons', stories: ['DescriptionsMeta', 'Icons'] },
        { title: 'States', stories: ['DisabledReason', 'Disabled'] },
        { title: 'Validation', stories: ['Required', 'InvalidError'] },
        { title: 'Forms', stories: ['NativeForm'] },
        { title: 'Keyboard', stories: ['Keyboard'] },
      ],
      description: {
        component:
          'Choose one option from cards that can include a description and supporting details.',
      },
      usage: `### When to use
Use cards when a single choice needs descriptions, icons or supporting details. Use a compact radio group for short labels alone.

### Content and forms

- Give every group a name and use unique values. Do not put links or buttons inside items.
- Native radios provide validation and form submission. Reset restores the initial uncontrolled selection without reporting a change.
- Format numeric metadata with Intl.

### Keyboard and accessibility

- Tab enters the checked enabled radio. Without a selection, Tab enters the first enabled radio and Shift+Tab the last.
- Arrows select in DOM order, wrap and skip disabled options. Horizontal arrows reverse in RTL.
- Home/End select the first/last option. Enter selects without submitting; Space follows native radio behavior.
- Reduced motion removes ring animation; the border and dot still show the selection.`,
    },
  },
} satisfies Meta<RadioCardsProps>;
export default meta;
type Story = StoryObj<Omit<RadioCardsProps, 'component'>>;
type ShorthandStory = StoryObj<Omit<RadioCardsShorthandProps, 'component'>>;
const shipping = [
  { value: 'standard', label: 'Standard', description: '4–6 business days' },
  { value: 'express', label: 'Express', disabled: true },
  { value: 'pickup', label: 'Pickup', description: 'Collect at the store' },
] as const;
export const Shorthand: ShorthandStory = {
  name: 'Options from data',
  parameters: { docs: {
    description: { story: 'Build a shipping field from options, including an unavailable delivery method.' },
    source: { language: 'tsx', code: `import { RadioCards } from '@jfrader/ui';

const shipping = [
  { value: 'standard', label: 'Standard', description: '4–6 business days' },
  { value: 'express', label: 'Express', disabled: true },
  { value: 'pickup', label: 'Pickup', description: 'Collect at the store' },
] as const;

<RadioCards label="Shipping speed" options={shipping} name="shipping" defaultValue="standard" layout="list" />` },
  } },
  args: { label: 'Shipping speed', options: shipping, name: 'shipping', defaultValue: 'standard', layout: 'list', onValueChange: fn() },
  render: (args) => <RadioCards {...args} />,
  play: async ({ canvas, userEvent, args }) => {
    await expect(canvas.getByRole('radiogroup', { name: 'Shipping speed' })).toBeInTheDocument();
    const standard = canvas.getByRole('radio', { name: 'Standard' });
    await expect(standard).toBeChecked();
    await expect(standard).toHaveAttribute('name', 'shipping');
    await expect(standard).toHaveAccessibleDescription('4–6 business days');
    await expect(canvas.getByRole('radio', { name: 'Express' })).toBeDisabled();
    const pickup = canvas.getByRole('radio', { name: 'Pickup' });
    await userEvent.click(pickup);
    await expect(pickup).toBeChecked();
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith('pickup');
  },
};
function ShorthandControlledExample(args: RadioCardsShorthandProps) {
  const [value, setValue] = useState('standard');
  return (
    <RadioCards {...args} value={value} onValueChange={(next) => {
      setValue(next);
      args.onValueChange?.(next);
    }} />
  );
}
export const ShorthandControlled: ShorthandStory = { ...Shorthand, name: 'Shorthand controlled', render: (args) => <ShorthandControlledExample {...args} /> };
export const ShorthandRejected: ShorthandStory = {
  ...Shorthand, name: 'Shorthand rejected', args: { ...Shorthand.args, value: 'standard' },
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(canvas.getByRole('radio', { name: 'Pickup' }));
    await expect(canvas.getByRole('radio', { name: 'Standard' })).toBeChecked();
    await expect(canvas.getByRole('radio', { name: 'Pickup' })).not.toBeChecked();
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith('pickup');
  },
};
export const ShorthandKeyboard: ShorthandStory = {
  ...Shorthand,
  name: 'Shorthand keyboard',
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.tab();
    await assertFocus(canvas.getByRole('radio', { name: 'Standard' }));
    await userEvent.keyboard('{ArrowRight}');
    const pickup = canvas.getByRole('radio', { name: 'Pickup' });
    await assertFocus(pickup);
    await expect(pickup).toBeChecked();
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith('pickup');
  },
};
export const ShorthandRTL: ShorthandStory = {
  ...ShorthandKeyboard, name: 'Shorthand RTL', args: { ...Shorthand.args, dir: 'rtl' },
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.tab();
    await userEvent.keyboard('{ArrowLeft}');
    const pickup = canvas.getByRole('radio', { name: 'Pickup' });
    await assertFocus(pickup);
    await expect(pickup).toBeChecked();
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith('pickup');
  },
};
function ShorthandRoot(props: ComponentPropsWithRef<'div'>) {
  return <div {...props} data-replacement="radio-cards" />;
}
export const ShorthandCustomization: ShorthandStory = {
  ...Shorthand,
  name: 'Shorthand customization',
  parameters: { docs: { source: { code: `<RadioCards label="Shipping speed" options={shipping} defaultValue="standard"
  slotProps={{ label: { title: 'Shipping label' }, item: { slotProps: { control: { sx: { borderRadius: 0 } } } } }}
/>` } } },
  args: {
    ...Shorthand.args,
    ref: fn(),
    slotProps: {
      root: { title: 'Shipping choices' },
      label: { title: 'Shipping label' },
      item: { slotProps: { control: { sx: { borderRadius: 0 } } } },
    },
  },
  render: (args) => <RadioCards {...args} component={ShorthandRoot} />,
  play: async (context) => {
    await Shorthand.play?.(context);
    await expect(context.canvas.getByRole('radiogroup', { name: 'Shipping speed' })).toHaveAttribute('data-replacement', 'radio-cards');
    await expect(context.args.ref).toHaveBeenCalledWith(context.canvas.getByRole('radiogroup', { name: 'Shipping speed' }));
    await expect(context.canvas.getByTitle('Shipping label')).toHaveTextContent('Shipping speed');
    const input = context.canvas.getByRole('radio', { name: 'Pickup' });
    await expect(input.nextElementSibling).toHaveStyle({ borderRadius: '0px' });
  },
};
type AssertRadioCardsProps<T extends import('./index').RadioCardsProps> = T;
export type RadioCardsShorthandTypeRegression = {
  // @ts-expect-error Options and children are mutually exclusive.
  mixed: AssertRadioCardsProps<{ options: typeof shipping; children: string }>;
};

async function assertFocus(input: HTMLElement) {
  await expect(input.ownerDocument.activeElement).toBe(input);
  const style = getComputedStyle(input.nextElementSibling!);
  await expect(style.outlineStyle).not.toBe('none');
  await expect(parseFloat(style.outlineWidth)).toBeGreaterThan(0);
}
async function assertContrast(group: HTMLElement) {
  const context = group.ownerDocument.createElement('canvas').getContext('2d')!;
  const channels = () => Array.from(context.getImageData(0, 0, 1, 1).data).slice(0, 3);
  const luminance = (rgb: number[]) =>
    rgb
      .map((channel) => {
        const value = channel / 255;
        return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
      })
      .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index]!, 0);
  for (const input of group.querySelectorAll('input')) {
    const card = input.nextElementSibling as HTMLElement;
    const layers: string[] = [];
    for (let element: HTMLElement | null = card; element; element = element.parentElement)
      layers.unshift(getComputedStyle(element).backgroundColor);
    context.clearRect(0, 0, 1, 1);
    for (const color of layers) {
      context.fillStyle = color;
      context.fillRect(0, 0, 1, 1);
    }
    const background = luminance(channels());
    const ratio = (color: string) => {
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = color;
      context.fillRect(0, 0, 1, 1);
      const foreground = luminance(channels());
      return (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05);
    };
    await expect(ratio(getComputedStyle(card).color)).toBeGreaterThanOrEqual(4.5);
    const description = card.querySelector('[data-ui="radio-cards-item-description"]');
    if (description) await expect(ratio(getComputedStyle(description).color)).toBeGreaterThanOrEqual(4.5);
    await expect(ratio(getComputedStyle(card).borderColor)).toBeGreaterThanOrEqual(3);
    const indicator = card.querySelector('[data-ui="radio-cards-indicator"]')!;
    await expect(ratio(getComputedStyle(indicator).borderColor)).toBeGreaterThanOrEqual(3);
    if (input.checked)
      await expect(ratio(getComputedStyle(indicator, '::after').backgroundColor)).toBeGreaterThanOrEqual(3);
  }
}
const RING_SETTLE_TIMEOUT = 2000;
async function assertRing(group: HTMLElement, input: HTMLElement) {
  await waitFor(
    async () => {
      const ring = group.querySelector<HTMLElement>('[data-ui="radio-cards-ring"]')!;
      const card = input.nextElementSibling!.getBoundingClientRect();
      const bounds = ring.getBoundingClientRect();
      await expect(ring.hidden).toBe(false);
      await expect(Math.abs(bounds.left - card.left)).toBeLessThan(1.1);
      await expect(Math.abs(bounds.top - card.top)).toBeLessThan(1.1);
      await expect(Math.abs(bounds.width - card.width)).toBeLessThan(1.1);
      await expect(Math.abs(bounds.height - card.height)).toBeLessThan(1.1);
    },
    { timeout: RING_SETTLE_TIMEOUT },
  );
}
export const DefaultGrid: Story = {
  name: 'Shipping choices',
  parameters: { docs: { description: { story: 'Choose one delivery method from a grid of cards.' }, source: { language: 'tsx', code: usage } } },
  play: async ({ canvas, args, userEvent }) => {
    const group = canvas.getByRole('radiogroup', { name: 'Shipping speed' });
    const radios = canvas.getAllByRole('radio') as HTMLInputElement[];
    await expect(radios[0]!.type).toBe('radio');
    await expect(new Set(radios.map((radio) => radio.name)).size).toBe(1);
    await expect(radios[0]).toBeChecked();
    await assertContrast(group);
    await expect(radios[0]!.getBoundingClientRect().height).toBeGreaterThanOrEqual(32);
    await userEvent.click(radios[1]!);
    await expect(radios[1]).toBeChecked();
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith('express');
    await assertRing(group, radios[1]!);
    await userEvent.click(radios[1]!);
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
  },
};
export const List: Story = {
  name: 'List layout',
  parameters: { docs: { description: { story: 'Stack delivery choices in a single column.' }, source: { language: 'tsx', code: `import { RadioCards } from '@jfrader/ui';

<RadioCards defaultValue="standard" layout="list">
  <RadioCards.Label>Shipping speed</RadioCards.Label>
  <RadioCards.Description>Choose a delivery option.</RadioCards.Description>
  <RadioCards.Item value="standard" label="Standard" description="4–6 business days" />
  <RadioCards.Item value="express" label="Express" description="1–2 business days" disabledReason="Unavailable at this address" />
  <RadioCards.Item value="pickup" label="Pickup" description="Collect at the store" />
</RadioCards>` } } },
  args: { layout: 'list' },
};
export const Sizes: Story = {
  render: (args) => (
    <Fixture>
      <Example {...args} size="sm" />
      <Example {...args} size="md" />
    </Fixture>
  ),
  play: async ({ canvas }) => {
    for (const radio of canvas.getAllByRole('radio'))
      await expect(radio.getBoundingClientRect().height).toBeGreaterThanOrEqual(32);
  },
};
export const DescriptionsMeta: Story = {
  name: 'Descriptions and prices',
  parameters: { docs: {
    description: { story: 'Compare delivery times and locale-formatted prices beside each choice.' },
    source: { language: 'tsx', code: `import { RadioCards } from '@jfrader/ui';

const price = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

<RadioCards defaultValue="standard" layout="list">
  <RadioCards.Label>Shipping speed</RadioCards.Label>
  <RadioCards.Item value="standard" label="Standard" description="4–6 business days" meta={price.format(0)} />
  <RadioCards.Item value="express" label="Express" description="1–2 business days" meta={price.format(12)} />
</RadioCards>` },
  } },
  render: (args) => (
    <RadioCards {...args} layout="list">
      <RadioCards.Label>Shipping speed</RadioCards.Label>
      <RadioCards.Item
        value="standard"
        label="Standard"
        description="4–6 business days"
        meta={new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(0)}
      />
      <RadioCards.Item
        value="express"
        label="Express"
        description="1–2 business days"
        meta={new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(12)}
      />
    </RadioCards>
  ),
};
export const Icons: Story = {
  name: 'Delivery icons',
  parameters: { docs: {
    description: { story: 'Pair a decorative delivery icon with each visible option label.' },
    source: { language: 'tsx', code: `import { RadioCards } from '@jfrader/ui';

function DeliveryIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 6h12v12H3zM15 10h3l3 4v4h-6M6 18v2m12-2v2" />
    </svg>
  );
}

<RadioCards defaultValue="standard" aria-label="Delivery">
  <RadioCards.Item value="standard" label="Standard" icon={<DeliveryIcon />} />
  <RadioCards.Item value="express" label="Express" icon={<DeliveryIcon />} />
</RadioCards>` },
  } },
  render: (args) => (
    <RadioCards {...args} aria-label="Delivery">
      <RadioCards.Item value="standard" label="Standard" icon={<DeliveryIcon />} />
      <RadioCards.Item value="express" label="Express" icon={<DeliveryIcon />} />
    </RadioCards>
  ),
};
export const DisabledReason: Story = {
  name: 'Unavailable option',
  parameters: { docs: {
    description: { story: 'Explain why Express delivery is unavailable while keeping other choices enabled.' },
    source: { language: 'tsx', code: `import { RadioCards } from '@jfrader/ui';

<RadioCards defaultValue="standard">
  <RadioCards.Label>Shipping speed</RadioCards.Label>
  <RadioCards.Description>Choose a delivery option.</RadioCards.Description>
  <RadioCards.Item value="standard" label="Standard" description="4–6 business days" />
  <RadioCards.Item value="express" label="Express" description="1–2 business days" disabled disabledReason="Unavailable at this address" />
  <RadioCards.Item value="pickup" label="Pickup" description="Collect at the store" />
</RadioCards>` },
  } },
  render: (args) => <Example {...args} disabledOption />,
  play: async ({ canvas, userEvent, args }) => {
    const disabled = canvas.getByRole('radio', { name: 'Express' });
    await expect(disabled).toBeDisabled();
    await expect(disabled).toHaveAccessibleDescription('Unavailable at this address');
    await userEvent.click(disabled);
    await expect(args.onValueChange).not.toHaveBeenCalled();
  },
};
export const Disabled: Story = {
  name: 'Disabled field',
  parameters: { docs: { description: { story: 'Keep the selected delivery visible when the whole field is unavailable.' }, source: { language: 'tsx', code: `import { RadioCards } from '@jfrader/ui';

<RadioCards defaultValue="standard" disabled>
  <RadioCards.Label>Shipping speed</RadioCards.Label>
  <RadioCards.Description>Choose a delivery option.</RadioCards.Description>
  <RadioCards.Item value="standard" label="Standard" description="4–6 business days" />
  <RadioCards.Item value="express" label="Express" description="1–2 business days" disabledReason="Unavailable at this address" />
  <RadioCards.Item value="pickup" label="Pickup" description="Collect at the store" />
</RadioCards>` } } },
  args: { disabled: true },
  play: async ({ canvas, userEvent, args }) => {
    for (const radio of canvas.getAllByRole('radio')) await expect(radio).toBeDisabled();
    await userEvent.click(canvas.getByRole('radio', { name: 'Pickup' }));
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await expect(canvas.getByRole('radio', { name: 'Standard' })).toBeChecked();
  },
};
export const Required: Story = {
  name: 'Required choice',
  parameters: { docs: { description: { story: 'Start with no selection and require a delivery choice.' }, source: { language: 'tsx', code: `import { RadioCards } from '@jfrader/ui';

<RadioCards required>
  <RadioCards.Label>Shipping speed</RadioCards.Label>
  <RadioCards.Description>Choose a delivery option.</RadioCards.Description>
  <RadioCards.Item value="standard" label="Standard" description="4–6 business days" />
  <RadioCards.Item value="express" label="Express" description="1–2 business days" disabledReason="Unavailable at this address" />
  <RadioCards.Item value="pickup" label="Pickup" description="Collect at the store" />
</RadioCards>` } } },
  args: { required: true, defaultValue: undefined },
};
export const InvalidError: Story = {
  name: 'Validation error',
  parameters: { docs: { description: { story: 'Associate an error message with an unselected delivery field.' }, source: { language: 'tsx', code: `import { RadioCards } from '@jfrader/ui';

<RadioCards invalid error="Choose a delivery option.">
  <RadioCards.Label>Shipping speed</RadioCards.Label>
  <RadioCards.Description>Choose a delivery option.</RadioCards.Description>
  <RadioCards.Item value="standard" label="Standard" description="4–6 business days" />
  <RadioCards.Item value="express" label="Express" description="1–2 business days" disabledReason="Unavailable at this address" />
  <RadioCards.Item value="pickup" label="Pickup" description="Collect at the store" />
</RadioCards>` } } },
  args: { invalid: true, error: 'Choose a delivery option.', defaultValue: undefined },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('radiogroup')).toHaveAttribute('aria-invalid', 'true');
    await expect(canvas.getByRole('alert')).toHaveTextContent('Choose a delivery option.');
    for (const radio of canvas.getAllByRole('radio'))
      await expect(radio).toHaveAttribute('aria-invalid', 'true');
  },
};
export const ConsumerInvalid: Story = {
  parameters: { docs: { source: { language: 'tsx', code: `import { RadioCards } from '@jfrader/ui';

<RadioCards defaultValue="standard" aria-invalid="grammar">
  <RadioCards.Label>Shipping speed</RadioCards.Label>
  <RadioCards.Description>Choose a delivery option.</RadioCards.Description>
  <RadioCards.Item value="standard" label="Standard" description="4–6 business days" />
  <RadioCards.Item value="express" label="Express" description="1–2 business days" disabledReason="Unavailable at this address" />
  <RadioCards.Item value="pickup" label="Pickup" description="Collect at the store" />
</RadioCards>` } } },
  args: { 'aria-invalid': 'grammar' },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('radiogroup')).toHaveAttribute('aria-invalid', 'grammar');
  },
};
export const LongError: Story = {
  args: { error: 'DeliveryDestinationRequiresAdditionalVerificationBeforeDispatch' },
  parameters: { docs: { source: { language: 'tsx', code: `import { RadioCards, styled } from '@jfrader/ui';

const NarrowFrame = styled.div({ inlineSize: 'min(100%, 18rem)' });

<NarrowFrame>
  <RadioCards error="DeliveryDestinationRequiresAdditionalVerificationBeforeDispatch">
    <RadioCards.Label>Shipping speed</RadioCards.Label>
    <RadioCards.Item value="standard" label="Standard" />
    <RadioCards.Item value="express" label="Express" />
  </RadioCards>
</NarrowFrame>` } } },
  render: (args) => <NarrowFixture><Example {...args} /></NarrowFixture>,
  play: async ({ canvas }) => {
    const root = canvas.getByRole('radiogroup');
    const error = canvas.getByRole('alert');
    await expect(root.scrollWidth).toBeLessThanOrEqual(root.clientWidth + 1);
    await expect(error.scrollWidth).toBeLessThanOrEqual(error.clientWidth + 1);
    await expect(root).toHaveAccessibleDescription('Choose a delivery option. DeliveryDestinationRequiresAdditionalVerificationBeforeDispatch');
  },
};
export const Empty: Story = { render: (args) => <RadioCards {...args} aria-label="Shipping speed" /> };
export const AllDisabled: Story = {
  render: (args) => (
    <RadioCards {...args} aria-label="Shipping speed">
      <RadioCards.Item value="standard" label="Standard" disabled />
      <RadioCards.Item value="express" label="Express" disabled />
    </RadioCards>
  ),
  play: async ({ canvas, userEvent }) => {
    await userEvent.tab();
    const group = canvas.getByRole('radiogroup');
    await expect(group.contains(group.ownerDocument.activeElement)).toBe(false);
  },
};
export const NoSelection: Story = {
  args: { defaultValue: undefined },
  render: (args) => (
    <Fixture>
      <FixtureButton>Before</FixtureButton>
      <Example {...args} />
      <FixtureButton>After</FixtureButton>
    </Fixture>
  ),
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.tab();
    await expect(canvas.getByRole('button', { name: 'Before' })).toHaveFocus();
    await userEvent.tab();
    await assertFocus(canvas.getByRole('radio', { name: 'Standard' }));
    await userEvent.tab();
    await expect(canvas.getByRole('button', { name: 'After' })).toHaveFocus();
    await userEvent.tab({ shift: true });
    await assertFocus(canvas.getByRole('radio', { name: 'Pickup' }));
    await userEvent.keyboard('[Space]');
    await expect(canvas.getByRole('radio', { name: 'Pickup' })).toBeChecked();
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith('pickup');
  },
};
export const Keyboard: Story = {
  name: 'Keyboard navigation',
  parameters: { docs: {
    description: { story: 'Tab into the choices, then use arrows or Home and End to skip the unavailable option.' },
    source: { language: 'tsx', code: `import { Button, RadioCards, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const Stack = styled.div({ display: 'grid', gap: vars.space[4], inlineSize: '100%', maxInlineSize: '44rem' });

<Stack>
  <RadioCards defaultValue="standard">
    <RadioCards.Label>Shipping speed</RadioCards.Label>
    <RadioCards.Description>Choose a delivery option.</RadioCards.Description>
    <RadioCards.Item value="standard" label="Standard" description="4–6 business days" />
    <RadioCards.Item value="express" label="Express" description="1–2 business days" disabled disabledReason="Unavailable at this address" />
    <RadioCards.Item value="pickup" label="Pickup" description="Collect at the store" />
  </RadioCards>
  <Button>After</Button>
</Stack>` },
  } },
  render: (args) => (
    <Fixture>
      <Example {...args} disabledOption />
      <FixtureButton>After</FixtureButton>
    </Fixture>
  ),
  play: async ({ canvas, userEvent, args }) => {
    const first = canvas.getByRole('radio', { name: 'Standard' });
    const last = canvas.getByRole('radio', { name: 'Pickup' });
    await userEvent.tab();
    await assertFocus(first);
    const steps = [
      ['{ArrowRight}', last, 'pickup'],
      ['{ArrowRight}', first, 'standard'],
      ['{ArrowLeft}', last, 'pickup'],
      ['{ArrowDown}', first, 'standard'],
      ['{ArrowUp}', last, 'pickup'],
      ['{Home}', first, 'standard'],
      ['{End}', last, 'pickup'],
    ] as const;
    for (const [index, [key, input, value]] of steps.entries()) {
      await userEvent.keyboard(key);
      await assertFocus(input);
      await expect(input).toBeChecked();
      await expect(args.onValueChange).toHaveBeenCalledTimes(index + 1);
      await expect(args.onValueChange).toHaveBeenNthCalledWith(index + 1, value);
    }
    await userEvent.keyboard('{Enter}[Space]');
    await expect(args.onValueChange).toHaveBeenCalledTimes(steps.length);
    await userEvent.tab();
    await expect(canvas.getByRole('button')).toHaveFocus();
    await userEvent.tab({ shift: true });
    await assertFocus(last);
  },
};
function RejectedExample(args: RadioCardsProps) {
  const [value, setValue] = useState('standard');
  return (
    <FixtureForm>
      <Example {...args} name="shipping" value={value} />
      <FixtureButton type="button" onClick={() => setValue('pickup')}>
        Update value
      </FixtureButton>
      <FixtureButton type="reset">
        Reset
      </FixtureButton>
    </FixtureForm>
  );
}
export const ControlledRejects: Story = {
  render: (args) => <RejectedExample {...args} />,
  play: async ({ canvas, userEvent, args }) => {
    const first = canvas.getByRole('radio', { name: 'Standard' }) as HTMLInputElement;
    const next = canvas.getByRole('radio', { name: 'Express' });
    const group = canvas.getByRole('radiogroup');
    await userEvent.tab();
    await userEvent.keyboard('{ArrowRight}');
    await assertFocus(next);
    await expect(next).not.toBeChecked();
    await expect(first.checked).toBe(true);
    await assertRing(group, first);
    await expect(new FormData(first.form!).get('shipping')).toBe('standard');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith('express');
    await userEvent.keyboard('{Enter}');
    await expect(args.onValueChange).toHaveBeenCalledTimes(2);
    await expect(args.onValueChange).toHaveBeenLastCalledWith('express');
    await userEvent.keyboard('[Space]');
    await expect(args.onValueChange).toHaveBeenCalledTimes(3);
    await expect(next).not.toBeChecked();
    await userEvent.click(canvas.getByRole('button', { name: 'Update value' }));
    await expect(canvas.getByRole('radio', { name: 'Pickup' })).toBeChecked();
    await expect(args.onValueChange).toHaveBeenCalledTimes(3);
    await userEvent.click(canvas.getByRole('button', { name: 'Reset' }));
    await expect(canvas.getByRole('radio', { name: 'Pickup' })).toBeChecked();
    await expect(new FormData(first.form!).get('shipping')).toBe('pickup');
    await expect(args.onValueChange).toHaveBeenCalledTimes(3);
  },
};
export const NativeForm: Story = {
  name: 'Native form and reset',
  parameters: { docs: {
    description: { story: 'Choose a required shipping value, then reset the form to its unselected state.' },
    source: { language: 'tsx', code: `import { Button, RadioCards, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const ShippingForm = styled.form({ display: 'grid', gap: vars.space[4], inlineSize: '100%', maxInlineSize: '44rem' });

<ShippingForm>
  <RadioCards name="shipping" aria-label="Shipping speed" required>
    <RadioCards.Item value="" label="Pickup" />
    <RadioCards.Item value="express" label="Express" />
    <RadioCards.Item value="disabled" label="Unavailable" disabled />
  </RadioCards>
  <Button type="reset">Reset</Button>
</ShippingForm>` },
  } },
  args: { defaultValue: undefined, required: true },
  render: (args) => (
    <FixtureForm>
      <RadioCards {...args} name="shipping" aria-label="Shipping speed">
        <RadioCards.Item value="" label="Pickup" />
        <RadioCards.Item value="express" label="Express" />
        <RadioCards.Item value="disabled" label="Unavailable" disabled />
      </RadioCards>
      <FixtureButton type="reset">
        Reset
      </FixtureButton>
    </FixtureForm>
  ),
  play: async ({ canvas, userEvent, args }) => {
    const pickup = canvas.getByRole('radio', { name: 'Pickup' }) as HTMLInputElement;
    const form = pickup.form!;
    await expect(form.checkValidity()).toBe(false);
    await expect(pickup.required).toBe(true);
    await expect(canvas.getByRole('radiogroup')).toHaveAttribute('aria-required', 'true');
    await userEvent.click(pickup);
    await expect(form.checkValidity()).toBe(true);
    await expect(new FormData(form).get('shipping')).toBe('');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith('');
    await userEvent.click(canvas.getByRole('button', { name: 'Reset' }));
    await expect(pickup).not.toBeChecked();
    await expect(form.checkValidity()).toBe(false);
    await expect(new FormData(form).has('shipping')).toBe(false);
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await userEvent.click(canvas.getByRole('radio', { name: 'Unavailable' }));
    await expect(new FormData(form).has('shipping')).toBe(false);
  },
};
export const ResetToDefault: Story = {
  render: (args) => (
    <FixtureForm>
      <Example {...args} name="shipping" />
      <FixtureButton type="reset">
        Reset
      </FixtureButton>
    </FixtureForm>
  ),
  play: async ({ canvas, args, userEvent }) => {
    await userEvent.click(canvas.getByRole('radio', { name: 'Pickup' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Reset' }));
    await expect(canvas.getByRole('radio', { name: 'Standard' })).toBeChecked();
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith('pickup');
  },
};
function AriaExample(args: RadioCardsProps) {
  const id = useId();
  return (
    <Fixture>
      <span id={`${id}-name`}>Delivery</span>
      <span id={`${id}-detail`}>External detail</span>
      <RadioCards
        {...args}
        aria-label="Fallback group"
        aria-labelledby={`${id}-name`}
        aria-describedby={`${id}-detail`}
        aria-invalid="grammar"
        error="Try again"
      >
        <RadioCards.Label>Shipping speed</RadioCards.Label>
        <RadioCards.Description>Internal detail</RadioCards.Description>
        <RadioCards.Item
          value="standard"
          label="Standard"
          description="4–6 business days"
          aria-label="Fallback item"
          aria-labelledby={`${id}-name`}
          aria-describedby={`${id}-detail`}
        />
        <RadioCards.Item
          value="express"
          label="Express"
          aria-label="Express fallback"
          aria-labelledby={`${id}-missing`}
        />
      </RadioCards>
    </Fixture>
  );
}
export const ExternalAria: Story = {
  render: (args) => <AriaExample {...args} />,
  play: async ({ canvas }) => {
    const group = canvas.getByRole('radiogroup', { name: 'Delivery Shipping speed' });
    await expect(group).toHaveAttribute('aria-label', 'Fallback group');
    await expect(group.getAttribute('aria-labelledby')!.split(' ')).toHaveLength(2);
    await expect(group).toHaveAccessibleDescription('External detail Internal detail Try again');
    const radio = canvas.getByRole('radio', { name: 'Delivery' });
    await expect(radio).toHaveAttribute('aria-label', 'Fallback item');
    await expect(radio).toHaveAccessibleDescription('External detail 4–6 business days');
    const unresolved = canvas.getByRole('radio', { name: 'Express fallback' });
    await expect(unresolved.getAttribute('aria-labelledby')).toContain('-missing');
    await expect(unresolved).toHaveAttribute('aria-label', 'Express fallback');
    await expect(group).toHaveAttribute('aria-invalid', 'true');
  },
};
const falsy: ReactNode[] = [false, null, 0, ''];
export const FalsyContent: Story = {
  render: (args) => (
    <Fixture>
      {falsy.map((content, index) => (
        <RadioCards {...args} key={index} aria-label={`Content ${index}`} error={content}>
          <RadioCards.Label>{content}</RadioCards.Label>
          <RadioCards.Description>{content}</RadioCards.Description>
          <RadioCards.Item
            value="standard"
            aria-label={`Option ${index}`}
            label={content}
            description={content}
            meta={content}
            icon={content}
          />
          <RadioCards.Item
            value="disabled"
            aria-label={`Disabled ${index}`}
            label="Unavailable"
            description="Description"
            disabled
            disabledReason={content}
          />
        </RadioCards>
      ))}
    </Fixture>
  ),
  play: async ({ canvas }) => {
    for (const [index, group] of canvas.getAllByRole('radiogroup').entries()) {
      const present = index >= 2;
      for (const part of ['label', 'description', 'error'])
        await expect(group.querySelector(`[data-ui="radio-cards-${part}"]`) !== null).toBe(present);
      const input = group.querySelector<HTMLInputElement>('input')!;
      for (const part of ['item-label', 'item-description', 'meta', 'icon'])
        await expect(input.parentElement!.querySelector(`[data-ui="radio-cards-${part}"]`) !== null).toBe(
          present,
        );
      await expect(input.hasAttribute('aria-describedby')).toBe(present);
      for (const element of [group, input]) {
        for (const id of element.getAttribute('aria-describedby')?.split(' ') ?? [])
          await expect(element.ownerDocument.getElementById(id)).not.toBeNull();
      }
      const reason = group.querySelectorAll('input')[1]!;
      await expect(reason).toHaveAccessibleDescription(index === 2 ? '0' : index === 3 ? '' : 'Description');
    }
  },
};
export const LongContent: Story = {
  render: (args) => (
    <NarrowFixture>
      <RadioCards {...args} layout="list" aria-label="Shipping speed">
        <RadioCards.Item
          value="standard"
          label="International tracked delivery with signature confirmation"
          description="Delivery times depend on customs processing and the destination address."
          meta={new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(1234567890.12)}
        />
      </RadioCards>
    </NarrowFixture>
  ),
  play: async ({ canvas }) => {
    const card = canvas.getByRole('radio').nextElementSibling as HTMLElement;
    await expect(card.scrollWidth).toBeLessThanOrEqual(card.clientWidth + 1);
    for (const part of ['item-label', 'item-description', 'meta']) {
      const rect = card.querySelector(`[data-ui="radio-cards-${part}"]`)!.getBoundingClientRect();
      const bounds = card.getBoundingClientRect();
      await expect(rect.right).toBeLessThanOrEqual(bounds.right + 1);
      await expect(rect.left).toBeGreaterThanOrEqual(bounds.left - 1);
    }
  },
};
function ResizeExample(args: RadioCardsProps) {
  const [expanded, setExpanded] = useState(false);
  return (
    <Fixture>
      <RadioCards {...args} aria-label="Shipping speed" layout="list">
        <RadioCards.Item
          value="standard"
          label="Standard"
          description={
            expanded
              ? 'Tracked delivery. Delivery times depend on customs processing and the destination address. Contact the store to arrange a delivery date.'
              : '4–6 days'
          }
        />
        <RadioCards.Item value="express" label="Express" />
      </RadioCards>
      <FixtureButton onClick={() => setExpanded((current) => !current)}>
        Change content
      </FixtureButton>
    </Fixture>
  );
}
export const ResizeSelectedCard: Story = {
  render: (args) => <ResizeExample {...args} />,
  play: async ({ canvas, userEvent, args }) => {
    const group = canvas.getByRole('radiogroup');
    const selected = canvas.getByRole('radio', { name: 'Standard' });
    await assertRing(group, selected);
    await userEvent.click(canvas.getByRole('button'));
    await expect(canvas.getByText(/^Tracked delivery\./)).toBeInTheDocument();
    await assertRing(group, selected);
    await expect(args.onValueChange).not.toHaveBeenCalled();
  },
};
export const MultipleInstances: Story = {
  render: (args) => (
    <Fixture>
      <Example {...args} />
      <Example {...args} />
    </Fixture>
  ),
  play: async ({ canvas, userEvent }) => {
    const radios = canvas.getAllByRole('radio') as HTMLInputElement[];
    await expect(radios[0]!.name).not.toBe(radios[3]!.name);
    await userEvent.click(radios[1]!);
    await expect(radios[1]).toBeChecked();
    await expect(radios[3]).toBeChecked();
    const ids = canvas
      .getAllByRole('radiogroup')
      .flatMap((group) => Array.from(group.querySelectorAll('[id]')).map((element) => element.id));
    await expect(new Set(ids).size).toBe(ids.length);
  },
};
export const RTL: Story = {
  parameters: { docs: { source: { language: 'tsx', code: `import { RadioCards } from '@jfrader/ui';

<RadioCards defaultValue="standard" dir="rtl">
  <RadioCards.Label>Shipping speed</RadioCards.Label>
  <RadioCards.Description>Choose a delivery option.</RadioCards.Description>
  <RadioCards.Item value="standard" label="Standard" description="4–6 business days" />
  <RadioCards.Item value="express" label="Express" description="1–2 business days" disabledReason="Unavailable at this address" />
  <RadioCards.Item value="pickup" label="Pickup" description="Collect at the store" />
</RadioCards>` } } },
  args: { dir: 'rtl' },
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.tab();
    await userEvent.keyboard('{ArrowRight}');
    const last = canvas.getByRole('radio', { name: 'Pickup' });
    await assertFocus(last);
    await expect(last).toBeChecked();
    await userEvent.keyboard('{ArrowLeft}');
    await expect(canvas.getByRole('radio', { name: 'Standard' })).toBeChecked();
    await expect(args.onValueChange).toHaveBeenCalledTimes(2);
    await expect(args.onValueChange).toHaveBeenNthCalledWith(1, 'pickup');
    await expect(args.onValueChange).toHaveBeenNthCalledWith(2, 'standard');
  },
};
export const ItemDirection: Story = {
  render: (args) => (
    <RadioCards {...args} aria-label="Shipping">
      <RadioCards.Item value="standard" label="Standard" description="4–6 business days" dir="rtl" />
      <RadioCards.Item value="express" label="Express" />
    </RadioCards>
  ),
  play: async ({ canvas }) => {
    const input = canvas.getByRole('radio', { name: 'Standard' });
    await expect(input.parentElement).toHaveAttribute('dir', 'rtl');
    await expect(getComputedStyle(input.nextElementSibling!).direction).toBe('rtl');
  },
};
export const LightTheme: Story = {
  decorators: [withLightTheme],
  play: async ({ canvas }) => {
    await assertContrast(canvas.getByRole('radiogroup'));
  },
};
export const ScopedTheme: Story = {
  render: (args) => (
    <ThemeRoot theme="light" sx={{ backgroundColor: vars.color.bg, padding: vars.space[4] }}>
      <Example {...args} />
    </ThemeRoot>
  ),
};
export const ReducedMotion: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Checks selection. Enable reduced motion in the browser to check that the ring and dot update without animation.',
      },
    },
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('radio', { name: 'Express' }));
    await assertRing(canvas.getByRole('radiogroup'), canvas.getByRole('radio', { name: 'Express' }));
  },
};
export const ForcedColors: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Checks the border and indicator. Check rendering with Windows high-contrast mode or browser forced-colors emulation.',
      },
    },
  },
  play: async ({ canvas }) => {
    const control = canvas.getByRole('radio', { name: 'Standard' }).nextElementSibling!;
    await expect(getComputedStyle(control).borderTopStyle).toBe('solid');
    await expect(parseFloat(getComputedStyle(control).borderTopWidth)).toBeGreaterThan(0);
    await expect(control.querySelector('[data-ui="radio-cards-indicator"]')).not.toBeNull();
  },
};
export const SlotStyling: Story = {
  render: (args) => (
    <RadioCards {...args} aria-label="Shipping">
      <RadioCards.Item
        value="standard"
        label="Standard"
        description="4–6 days"
        icon={<DeliveryIcon />}
        meta="Free"
        slotProps={overrides}
      />
    </RadioCards>
  ),
  play: async ({ canvas }) => {
    const control = canvas.getByRole('radio').nextElementSibling!;
    const style = getComputedStyle(control);
    await expect(Math.abs(parseFloat(style.borderTopLeftRadius) - 8)).toBeLessThan(1.1);
    await expect(
      Math.abs(
        control.querySelector('[data-ui="radio-cards-indicator"]')!.getBoundingClientRect().width - 26,
      ),
    ).toBeLessThan(1.1);
    await expect(
      getComputedStyle(control.querySelector('[data-ui="radio-cards-item-label"]')!).fontWeight,
    ).toBe('600');
    await expect(getComputedStyle(control.querySelector('[data-ui="radio-cards-meta"]')!).fontWeight).toBe(
      '600',
    );
    await expect(
      parseFloat(
        getComputedStyle(control.querySelector('[data-ui="radio-cards-item-description"]')!).fontSize,
      ),
    ).toBeLessThan(parseFloat(style.fontSize));
    await expect(
      parseFloat(getComputedStyle(control.querySelector('[data-ui="radio-cards-icon"]')!).fontSize),
    ).toBeGreaterThan(parseFloat(style.fontSize));
  },
};
const inputRef = fn();
const rootRef = fn();
const labelRef = fn();
const descriptionRef = fn();
export const Refs: Story = {
  render: (args) => (
    <StrictMode>
      <RadioCards {...args} ref={rootRef}>
        <RadioCards.Label ref={labelRef}>Shipping</RadioCards.Label>
        <RadioCards.Description ref={descriptionRef}>Delivery options</RadioCards.Description>
        <RadioCards.Item ref={inputRef} value="standard" label="Standard" />
      </RadioCards>
    </StrictMode>
  ),
  play: async ({ canvas }) => {
    await expect(inputRef).toHaveBeenCalledWith(canvas.getByRole('radio'));
    await expect(rootRef).toHaveBeenCalledWith(canvas.getByRole('radiogroup'));
    await expect(labelRef).toHaveBeenCalledWith(canvas.getByText('Shipping'));
    await expect(descriptionRef).toHaveBeenCalledWith(canvas.getByText('Delivery options'));
  },
};

const nativeChange = fn();
const nativeKey = fn();
const nativeSubmit = fn();
export const NativeEvents: Story = {
  args: { defaultValue: undefined },
  render: (args) => (
    <FixtureForm
      onSubmit={(event) => {
        event.preventDefault();
        nativeSubmit();
      }}
    >
      <RadioCards {...args} aria-label="Shipping">
        <RadioCards.Item value="standard" label="Standard" onChange={nativeChange} onKeyDown={nativeKey} />
        <RadioCards.Item value="express" label="Express" onKeyDown={(event) => event.preventDefault()} />
      </RadioCards>
    </FixtureForm>
  ),
  play: async ({ canvas, userEvent, args }) => {
    const first = canvas.getByRole('radio', { name: 'Standard' });
    await userEvent.tab();
    await userEvent.keyboard('{Enter}');
    await expect(first).toBeChecked();
    await expect(nativeChange).toHaveBeenCalledTimes(1);
    await expect(nativeChange.mock.calls[0]![0].target).toBe(first);
    await expect(nativeKey).toHaveBeenCalledTimes(1);
    await expect(nativeKey.mock.calls[0]![0].key).toBe('Enter');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith('standard');
    await expect(nativeSubmit).not.toHaveBeenCalled();
    await userEvent.keyboard('{ArrowRight}');
    const next = canvas.getByRole('radio', { name: 'Express' });
    await expect(next).toHaveFocus();
    await userEvent.keyboard('{Home}');
    await expect(next).toHaveFocus();
    await expect(next).toBeChecked();
    await expect(args.onValueChange).toHaveBeenCalledTimes(2);
    await expect(args.onValueChange).toHaveBeenLastCalledWith('express');
  },
};
function AcceptedExample(args: RadioCardsProps) {
  const [value, setValue] = useState('standard');
  return (
    <Example
      {...args}
      value={value}
      onValueChange={(next) => {
        args.onValueChange?.(next);
        setValue(next);
      }}
    />
  );
}
export const Controlled: Story = {
  render: (args) => <AcceptedExample {...args} />,
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(canvas.getByRole('radio', { name: 'Express' }));
    await expect(canvas.getByRole('radio', { name: 'Express' })).toBeChecked();
    await expect(canvas.getByRole('radio', { name: 'Standard' })).not.toBeChecked();
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith('express');
  },
};
function RemovedExample(args: RadioCardsProps) {
  const [state, setState] = useState<'enabled' | 'disabled' | 'removed'>('enabled');
  return (
    <Fixture>
      <FixtureButton onClick={() => setState('disabled')}>
        Disable selected
      </FixtureButton>
      <FixtureButton onClick={() => setState('removed')}>
        Remove selected
      </FixtureButton>
      <RadioCards {...args} aria-label="Shipping">
        {state !== 'removed' && (
          <RadioCards.Item value="standard" label="Standard" disabled={state === 'disabled'} />
        )}
        <RadioCards.Item value="express" label="Express" />
        <RadioCards.Item value="pickup" label="Pickup" />
      </RadioCards>
      <FixtureButton>After</FixtureButton>
    </Fixture>
  );
}
export const RemovedSelection: Story = {
  render: (args) => <RemovedExample {...args} />,
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Disable selected' }));
    await expect(canvas.getByRole('radio', { name: 'Standard' })).toBeDisabled();
    await userEvent.click(canvas.getByRole('button', { name: 'Remove selected' }));
    await expect(canvas.queryByRole('radio', { name: 'Standard' })).toBeNull();
    await userEvent.tab();
    await assertFocus(canvas.getByRole('radio', { name: 'Express' }));
    await userEvent.tab();
    await expect(canvas.getByRole('button', { name: 'After' })).toHaveFocus();
    await userEvent.tab({ shift: true });
    await assertFocus(canvas.getByRole('radio', { name: 'Pickup' }));
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await waitFor(
      () =>
        expect(
          canvas.getByRole('radiogroup').querySelector<HTMLElement>('[data-ui="radio-cards-ring"]')!.hidden,
        ).toBe(true),
      { timeout: RING_SETTLE_TIMEOUT },
    );
  },
};
