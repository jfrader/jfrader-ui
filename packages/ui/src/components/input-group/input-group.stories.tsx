import { useState, type ComponentPropsWithRef } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { withLightTheme } from '../../testing/story-decorators';
import { expectInside, expectNoOverlap } from '../../testing/geometry-assertions';
import { Button } from '../button';
import { TextField } from '../text-field';
import { InputGroup } from './index';
import { styled } from '../../index';

const Column = styled.div({ display: 'grid', gap: vars.space[4], inlineSize: 'min(100%, 20rem)' });
const NarrowFrame = styled.div({ display: 'grid', gap: vars.space[3], inlineSize: 'min(100%, 12rem)' });

function AmountField(args: ComponentPropsWithRef<typeof InputGroup>) {
  return (
    <InputGroup label="Amount" {...args}>
      <InputGroup.Addon placement="start">$</InputGroup.Addon>
      <InputGroup.Input inputMode="decimal" defaultValue="25.00" />
      <InputGroup.Addon placement="end">USD</InputGroup.Addon>
    </InputGroup>
  );
}

const amountSource = (props = '') => `import { InputGroup } from '@jfrader/ui';

<InputGroup label="Amount"${props}>
  <InputGroup.Addon placement="start">$</InputGroup.Addon>
  <InputGroup.Input inputMode="decimal" defaultValue="25.00" />
  <InputGroup.Addon placement="end">USD</InputGroup.Addon>
</InputGroup>`;

const frameOf = (control: HTMLElement) => control.closest<HTMLElement>('[data-ui~="input-group-frame"]')!;
const ringOf = (element: Element) => {
  const style = getComputedStyle(element);
  return [style.outlineStyle, style.outlineWidth, style.outlineOffset, style.outlineColor, style.borderTopColor];
};
const skinOf = (element: Element) => {
  const style = getComputedStyle(element);
  return [
    style.borderTopWidth,
    style.borderTopStyle,
    style.borderTopColor,
    style.borderTopLeftRadius,
    style.backgroundColor,
    style.paddingInlineStart,
    style.fontSize,
    style.fontFamily,
    style.opacity,
  ];
};
const typeOf = (element: Element) => {
  const style = getComputedStyle(element);
  return [style.fontSize, style.fontWeight, style.fontFamily, style.color];
};
const labelOf =(control: HTMLElement) => control.ownerDocument.querySelector<HTMLElement>(`label[for="${control.id}"]`)!;

const meta = {
  title: 'Inputs/InputGroup', component: InputGroup, tags: ['autodocs'],
  parameters: { docs: {
    description: { component: 'Label a text input or textarea and keep units, icons or actions inside its frame.' },
    sections: [
      { title: 'Basic', stories: ['Default'] },
      { title: 'Addons and actions', stories: ['AddonAction'] },
      { title: 'Sizes and states', stories: ['Small', 'Large', 'Invalid', 'Required', 'Disabled', 'ReadOnly'] },
      { title: 'Composition', stories: ['Multiline', 'Controlled'] },
    ],
    usage: `### When to use
Use an input group when a prefix, suffix or action belongs inside the boundary of a text control. Use TextField or Textarea when the control has no addons.

### Labels and errors

Pass \`label\`, \`description\` and \`error\` to the group, the same way as TextField. The group wires them to its one Input or Textarea and owns that control's id; set \`id\` on InputGroup, not on the control. Without a visible label, give the control \`aria-label\`. Disable addon actions explicitly when the group is disabled.

### Keyboard and accessibility

Tab and Shift+Tab follow DOM order. Addon placement changes visual order only; put start actions before the control and end actions after it. Focus anywhere in the frame draws the ring on the frame. Pressing addon text or the frame padding focuses the control. Text editing and form submission follow native browser behavior.`,
  } },
  args: { size: 'md' }, render: (args) => <AmountField {...args} />,
} satisfies Meta<typeof InputGroup>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Amount with prefix and suffix',
  parameters: {
    docs: {
      description: { story: 'Label an amount and keep its currency symbol and code inside the field.' },
      source: { language: 'tsx', code: amountSource() },
    },
  },
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByRole('textbox', { name: 'Amount' });
    const frame = frameOf(input);
    const addons = frame.querySelectorAll<HTMLElement>('[data-ui="input-group-addon"]');
    await expect(getComputedStyle(addons[0]!).order).toBe('0');
    await expect(getComputedStyle(input).order).toBe('1');
    await expect(getComputedStyle(addons[1]!).order).toBe('2');
    await expect(frame.getBoundingClientRect().height).toBeCloseTo(40, 0);
    await userEvent.click(addons[1]!);
    await expect(input).toHaveFocus();
    await userEvent.tab({ shift: true });
    await userEvent.tab();
    await expect(input).toHaveFocus();
    await expect(getComputedStyle(frame).outlineStyle).not.toBe('none');
    await userEvent.clear(input);
    await userEvent.type(input, '42');
    await expect(input).toHaveValue('42');
  },
};

export const TextFieldParity: Story = {
  tags: ['!autodocs'],
  render: () => (
    <Column>
      <TextField label="Reference" defaultValue="INV-2041" />
      <AmountField />
      <TextField label="Reference" defaultValue="INV-2041" error="Enter a reference." />
      <AmountField label="Total" error="Enter a positive amount." />
      <TextField label="Reference" defaultValue="INV-2041" disabled />
      <AmountField label="Deposit" disabled />
    </Column>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const [field, invalidField, disabledField] = canvas.getAllByRole('textbox', { name: /Reference/ });
    const amount = canvas.getByRole('textbox', { name: 'Amount' });
    const total = canvas.getByRole('textbox', { name: 'Total' });
    const deposit = canvas.getByRole('textbox', { name: 'Deposit' });
    const pairs = [[field!, amount], [invalidField!, total], [disabledField!, deposit]] as const;
    for (const [text, grouped] of pairs) {
      const frame = frameOf(grouped);
      const box = text.getBoundingClientRect();
      const frameBox = frame.getBoundingClientRect();
      await expect(frameBox.height).toBeCloseTo(box.height, 1);
      await expect(skinOf(frame)).toEqual(skinOf(text));
      await expect(typeOf(labelOf(grouped))).toEqual(typeOf(labelOf(text)));
      await expect(frameBox.top - labelOf(grouped).getBoundingClientRect().bottom).toBeCloseTo(
        box.top - labelOf(text).getBoundingClientRect().bottom,
        1,
      );
    }
    await expect(invalidField).toHaveAttribute('aria-invalid', 'true');
    await expect(total).toHaveAttribute('aria-invalid', 'true');
    await expect(total).toHaveAccessibleDescription('Enter a positive amount.');
    await expect(deposit).toBeDisabled();

    field!.focus();
    await userEvent.tab({ shift: true });
    await userEvent.tab();
    await expect(field).toHaveFocus();
    const textRing = ringOf(field!);
    await expect(textRing[0]).not.toBe('none');
    await userEvent.tab();
    await expect(amount).toHaveFocus();
    await expect(ringOf(frameOf(amount))).toEqual(textRing);
    await expect(getComputedStyle(amount).outlineStyle).toBe('none');

    await userEvent.tab();
    await expect(invalidField).toHaveFocus();
    const invalidRing = ringOf(invalidField!);
    await userEvent.tab();
    await expect(total).toHaveFocus();
    await expect(ringOf(frameOf(total))).toEqual(invalidRing);
  },
};

export const Invalid: Story = {
  name: 'Validation error',
  parameters: { docs: {
    description: { story: 'Show an error below the amount and mark its input invalid.' },
    source: { language: 'tsx', code: amountSource(' error="Enter a positive amount."') },
  } },
  args: { error: 'Enter a positive amount.' },
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByRole('textbox', { name: 'Amount' });
    const frame = frameOf(input);
    const probe = document.createElement('span');
    probe.style.color = 'var(--ui-color-danger-border)';
    frame.append(probe);
    await expect(getComputedStyle(frame).borderTopColor).toBe(getComputedStyle(probe).color);
    probe.remove();
    await expect(input).toHaveAttribute('aria-invalid', 'true');
    await expect(input).toHaveAccessibleDescription('Enter a positive amount.');
    await expect(within(canvasElement).getByRole('alert')).toHaveTextContent('Enter a positive amount.');
  },
};

export const Required: Story = {
  name: 'Required amount',
  parameters: { docs: {
    description: { story: 'Mark the amount required and describe the accepted range.' },
    source: { language: 'tsx', code: amountSource(' description="Between $1 and $500." required') },
  } },
  args: { description: 'Between $1 and $500.', required: true },
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByRole('textbox', { name: 'Amount' });
    await expect(input).toBeRequired();
    await expect(input).toHaveAccessibleDescription('Between $1 and $500.');
    await expect(labelOf(input)).toHaveTextContent('Amount *');
  },
};

export const Disabled: Story = {
  parameters: { docs: {
    description: { story: 'Disable the amount while keeping its currency visible.' },
    source: { language: 'tsx', code: amountSource(' disabled') },
  } },
  args: { disabled: true },
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByRole('textbox', { name: 'Amount' });
    await expect(input).toBeDisabled();
    await expect(getComputedStyle(frameOf(input)).cursor).toBe('not-allowed');
  },
};

export const ReadOnly: Story = {
  name: 'Read-only amount',
  parameters: { docs: {
    description: { story: 'Show a settled amount that can be focused and copied but not edited.' },
    source: { language: 'tsx', code: `import { InputGroup } from '@jfrader/ui';

<InputGroup label="Amount">
  <InputGroup.Addon placement="start">$</InputGroup.Addon>
  <InputGroup.Input defaultValue="25.00" readOnly />
  <InputGroup.Addon placement="end">USD</InputGroup.Addon>
</InputGroup>` },
  } },
  render: () => (
    <InputGroup label="Amount">
      <InputGroup.Addon placement="start">$</InputGroup.Addon>
      <InputGroup.Input defaultValue="25.00" readOnly />
      <InputGroup.Addon placement="end">USD</InputGroup.Addon>
    </InputGroup>
  ),
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByRole('textbox', { name: 'Amount' });
    await userEvent.tab();
    await expect(input).toHaveFocus();
    await expect(input).toHaveAttribute('readonly');
    await expect(getComputedStyle(frameOf(input)).outlineStyle).not.toBe('none');
    await userEvent.type(input, '9');
    await expect(input).toHaveValue('25.00');
  },
};

export const Multiline: Story = {
  name: 'Textarea with addon',
  parameters: { docs: {
    description: { story: 'Keep an optional marker inside the frame of a multi-line control.' },
    source: { language: 'tsx', code: `import { InputGroup } from '@jfrader/ui';

<InputGroup label="Notes">
  <InputGroup.Textarea rows={2} defaultValue="First line" />
  <InputGroup.Addon placement="end">Optional</InputGroup.Addon>
</InputGroup>` },
  } },
  render: () => (
    <InputGroup label="Notes">
      <InputGroup.Textarea rows={2} defaultValue="First line" />
      <InputGroup.Addon placement="end">Optional</InputGroup.Addon>
    </InputGroup>
  ),
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByRole('textbox', { name: 'Notes' });
    await userEvent.click(input);
    await userEvent.type(input, '{End}{Enter}Second line');
    await expect(input).toHaveValue('First line\nSecond line');
  },
};

function CouponField() {
  const [code, setCode] = useState('');
  const [applied, setApplied] = useState<string>();
  return (
    <InputGroup label="Coupon code" description={applied && `${applied} applied`}>
      <InputGroup.Input value={code} onChange={(event) => setCode(event.currentTarget.value)} />
      <InputGroup.Addon placement="end">
        <Button size="sm" variant="ghost" type="button" disabled={!code} onClick={() => setApplied(code)}>
          Apply
        </Button>
      </InputGroup.Addon>
    </InputGroup>
  );
}
export const AddonAction: Story = {
  name: 'Addon action',
  parameters: { docs: {
    description: { story: 'Put an action button in an end addon; it follows the input in tab order.' },
    source: { language: 'tsx', code: `import { useState } from 'react';
import { Button, InputGroup } from '@jfrader/ui';

export function CouponField() {
  const [code, setCode] = useState('');
  const [applied, setApplied] = useState<string>();
  return (
    <InputGroup label="Coupon code" description={applied && \`\${applied} applied\`}>
      <InputGroup.Input value={code} onChange={(event) => setCode(event.currentTarget.value)} />
      <InputGroup.Addon placement="end">
        <Button size="sm" variant="ghost" type="button" disabled={!code} onClick={() => setApplied(code)}>
          Apply
        </Button>
      </InputGroup.Addon>
    </InputGroup>
  );
}` },
  } },
  render: () => <CouponField />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole('textbox', { name: 'Coupon code' });
    const frame = frameOf(input);
    await expect(frame.getBoundingClientRect().height).toBeCloseTo(40, 0);
    await userEvent.tab();
    await expect(input).toHaveFocus();
    await userEvent.type(input, 'SPRING10');
    await userEvent.tab();
    const apply = canvas.getByRole('button', { name: 'Apply' });
    await expect(apply).toHaveFocus();
    await expect(getComputedStyle(frame).outlineStyle).not.toBe('none');
    await expectInside(apply, frame);
    await userEvent.keyboard('{Enter}');
    await expect(input).toHaveAccessibleDescription('SPRING10 applied');
  },
};

function ControlledExample() {
  const [value, setValue] = useState('');
  return (
    <InputGroup label="Handle">
      <InputGroup.Addon placement="start">@</InputGroup.Addon>
      <InputGroup.Input value={value} onChange={(event) => setValue(event.currentTarget.value)} />
    </InputGroup>
  );
}
export const Controlled: Story = {
  name: 'Controlled input',
  parameters: { docs: {
    description: { story: 'Keep the input value in React state.' },
    source: { language: 'tsx', code: `import { useState } from 'react';
import { InputGroup } from '@jfrader/ui';

export function HandleField() {
  const [value, setValue] = useState('');
  return (
    <InputGroup label="Handle">
      <InputGroup.Addon placement="start">@</InputGroup.Addon>
      <InputGroup.Input value={value} onChange={(event) => setValue(event.currentTarget.value)} />
    </InputGroup>
  );
}` },
  } },
  render: () => <ControlledExample />,
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByRole('textbox', { name: 'Handle' });
    await userEvent.type(input, 'ada');
    await expect(input).toHaveValue('ada');
  },
};

function ReplacementRoot(props: ComponentPropsWithRef<'div'>) {
  return <div {...props} data-replacement="root" />;
}
function ReplacementFrame(props: ComponentPropsWithRef<'div'>) {
  return <div {...props} data-replacement="frame" />;
}
export const Replacement: Story = {
  parameters: { docs: { source: { language: 'tsx', code: `import type { ComponentPropsWithRef } from 'react';
import { InputGroup } from '@jfrader/ui';

function AmountFrame(props: ComponentPropsWithRef<'div'>) {
  return <div {...props} data-replacement="frame" />;
}

<InputGroup label="Amount" slots={{ frame: AmountFrame }} slotProps={{ frame: { 'data-example': 'replacement' } }}>
  <InputGroup.Addon placement="start">$</InputGroup.Addon>
  <InputGroup.Input inputMode="decimal" defaultValue="25.00" />
  <InputGroup.Addon placement="end">USD</InputGroup.Addon>
</InputGroup>` } } },
  args: {
    slots: { root: ReplacementRoot, frame: ReplacementFrame },
    slotProps: { root: { 'data-example': 'root' }, frame: { 'data-example': 'frame' } },
  },
  play: async ({ canvasElement }) => {
    const root = canvasElement.querySelector('[data-replacement="root"]');
    const frame = canvasElement.querySelector('[data-replacement="frame"]');
    await expect(root).toHaveAttribute('data-ui', 'input-group');
    await expect(root).toHaveAttribute('data-example', 'root');
    await expect(frame).toHaveAttribute('data-ui', 'input-group-frame');
    await expect(frame).toHaveAttribute('data-example', 'frame');
    await expect(frame).toHaveClass(/css-/);
    await expect(root).toContainElement(within(canvasElement).getByRole('textbox', { name: 'Amount' }));
  },
};
export const Small: Story = {
  name: 'Small group',
  parameters: { docs: {
    description: { story: 'Use a compact frame for the amount and its addons.' },
    source: { language: 'tsx', code: amountSource(' size="sm"') },
  } },
  args: { size: 'sm' },
};
export const Large: Story = {
  name: 'Large group',
  parameters: { docs: {
    description: { story: 'Use a taller frame for the amount and its addons.' },
    source: { language: 'tsx', code: amountSource(' size="lg"') },
  } },
  args: { size: 'lg' },
};
export const LightTheme: Story = {
  parameters: { docs: { source: { language: 'tsx', code: amountSource() } } },
  decorators: [withLightTheme],
};

export const LongAddons: Story = {
  parameters: { docs: { source: { language: 'tsx', code: `import { InputGroup, styled } from '@jfrader/ui';

const NarrowFrame = styled.div({ inlineSize: 'min(100%, 12rem)' });

<NarrowFrame>
  <InputGroup label="Settlement amount">
    <InputGroup.Addon placement="start">$</InputGroup.Addon>
    <InputGroup.Input defaultValue="25" />
    <InputGroup.Addon placement="end">InternationalSettlementCurrency</InputGroup.Addon>
  </InputGroup>
</NarrowFrame>` } } },
  render: () => <NarrowFrame>
    <InputGroup label="Settlement amount">
      <InputGroup.Addon placement="start">$</InputGroup.Addon>
      <InputGroup.Input defaultValue="25" />
      <InputGroup.Addon placement="end">InternationalSettlementCurrency</InputGroup.Addon>
    </InputGroup>
    <InputGroup label="Settlement notes">
      <InputGroup.Addon placement="start">InternationalSettlementReference</InputGroup.Addon>
      <InputGroup.Textarea defaultValue="Notes" rows={2} />
    </InputGroup>
  </NarrowFrame>,
  play: async ({ canvasElement, userEvent }) => {
    for (const control of within(canvasElement).getAllByRole('textbox')) {
      const frame = frameOf(control);
      await expect(frame.scrollWidth).toBeLessThanOrEqual(frame.clientWidth + 1);
      await expect(control.getBoundingClientRect().width).toBeGreaterThanOrEqual(32);
      await expect(control.getBoundingClientRect().height).toBeGreaterThanOrEqual(32);
      await expectInside(control, frame);
      for (const addon of frame.querySelectorAll<HTMLElement>('[data-ui="input-group-addon"]')) {
        await expectInside(addon, frame);
        await expectNoOverlap(addon, control);
        await expect(addon.scrollWidth).toBeLessThanOrEqual(addon.clientWidth + 1);
      }
    }
    const input = within(canvasElement).getByRole('textbox', { name: 'Settlement amount' });
    await userEvent.click(input);
    await userEvent.keyboard('{End}0');
    await expect(input).toHaveValue('250');
  },
};

export const LongAddonsRTL: Story = {
  ...LongAddons,
  decorators: [(Story) => <div dir="rtl"><Story /></div>],
};
