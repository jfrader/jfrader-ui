import { useId, useRef, useState, type ComponentPropsWithRef } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { withLightTheme } from '../../testing/story-decorators';
import { expectInside, expectNoOverlap } from '../../testing/geometry-assertions';
import { Button } from '../button';
import { InputGroup } from './index';
import { styled } from '../../index';

const NarrowFrame = styled.div({ display: 'grid', gap: vars.space[3], inlineSize: 'min(100%, 12rem)' });

function Example(args: ComponentPropsWithRef<typeof InputGroup>) {
  const id = useId();
  return <>
    <label htmlFor={id}>Amount</label>
    <InputGroup {...args}>
      <InputGroup.Addon placement="start">$</InputGroup.Addon>
      <InputGroup.Input id={id} aria-describedby={args.invalid ? `${id}-error` : undefined} defaultValue="25" />
      <InputGroup.Addon placement="end">USD</InputGroup.Addon>
    </InputGroup>
    {args.invalid && <p id={`${id}-error`}>Enter a positive amount.</p>}
  </>;
}

const meta = {
  title: 'Inputs/InputGroup', component: InputGroup, tags: ['autodocs'],
  parameters: { docs: {
    description: { component: 'Group an input or textarea with units, icons or actions in one frame.' },
    sections: [
      { title: 'Basic', stories: ['Default'] },
      { title: 'Addons and actions', stories: ['AddonAction'] },
      { title: 'Sizes and states', stories: ['Small', 'Large', 'Invalid', 'Disabled'] },
      { title: 'Composition', stories: ['Multiline', 'Controlled'] },
    ],
    usage: `### When to use
Use an input group when units, prefixes, suffixes or actions need to share a frame with a native control. Use TextField or Textarea when you need a ready-made label, description and error message.

### Labels and errors
Give the control an accessible name and connect any help or error text to it. The frame creates no labels, IDs or validation messages. Validate and submit text in your application. Disable addon actions explicitly when the group is disabled.

### Keyboard
Tab and Shift+Tab follow DOM order. Addon placement changes visual order only; put start actions before the control and end actions after it. Focus on the control or an addon action outlines the frame. Text editing and form submission follow native browser behavior.`,
  } },
  args: { size: 'md' }, render: (args) => <Example {...args} />,
} satisfies Meta<typeof InputGroup>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Amount with prefix and suffix',
  parameters: {
    docs: {
      description: { story: 'Frame an amount with a currency prefix and a unit suffix.' },
      source: {
        language: 'tsx',
        code: `import { useId } from 'react';
import { InputGroup } from '@jfrader/ui';

export function AmountField() {
  const id = useId();
  return <>
    <label htmlFor={id}>Amount</label>
    <InputGroup>
      <InputGroup.Addon placement="start">$</InputGroup.Addon>
      <InputGroup.Input id={id} defaultValue="25" />
      <InputGroup.Addon placement="end">USD</InputGroup.Addon>
    </InputGroup>
  </>;
}`,
      },
    },
  },
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByRole('textbox', { name: 'Amount' });
    const frame = input.closest('[data-ui="input-group"]')!;
    const addons = frame.querySelectorAll<HTMLElement>('[data-ui="input-group-addon"]');
    await expect(getComputedStyle(addons[0]!).order).toBe('0');
    await expect(getComputedStyle(input).order).toBe('1');
    await expect(getComputedStyle(addons[1]!).order).toBe('2');
    await userEvent.click(input);
    await userEvent.tab({ shift: true });
    await userEvent.tab();
    await expect(input).toHaveFocus();
    await expect(getComputedStyle(frame).outlineStyle).not.toBe('none');
    await userEvent.clear(input);
    await userEvent.type(input, '42');
    await expect(input).toHaveValue('42');
  },
};
export const Invalid: Story = {
  name: 'Validation error',
  parameters: { docs: { description: { story: 'Connect an external error message to the invalid amount input.' }, source: { language: 'tsx', code: `import { useId } from 'react';
import { InputGroup } from '@jfrader/ui';

export function AmountField() {
  const id = useId();
  return (
    <>
      <label htmlFor={id}>Amount</label>
      <InputGroup size="md" invalid>
        <InputGroup.Addon placement="start">$</InputGroup.Addon>
        <InputGroup.Input id={id} aria-describedby={id + '-error'} defaultValue="25" />
        <InputGroup.Addon placement="end">USD</InputGroup.Addon>
      </InputGroup>
      <p id={id + '-error'}>Enter a positive amount.</p>
    </>
  );
}` } } },
  args: { invalid: true },
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByRole('textbox');
    const frame = input.closest('[data-ui="input-group"]')!;
    const probe = document.createElement('span');
    probe.style.color = 'var(--ui-color-danger-border)';
    frame.append(probe);
    await expect(getComputedStyle(frame).borderTopColor).toBe(getComputedStyle(probe).color);
    probe.remove();
    await expect(input).toHaveAttribute('aria-invalid', 'true');
    await expect(input).toHaveAccessibleDescription('Enter a positive amount.');
  },
};
export const Disabled: Story = {
  parameters: { docs: { description: { story: 'Disable the native input while keeping its currency context visible.' }, source: { language: 'tsx', code: `import { useId } from 'react';
import { InputGroup } from '@jfrader/ui';

export function AmountField() {
  const id = useId();
  return (
    <>
      <label htmlFor={id}>Amount</label>
      <InputGroup size="md" disabled>
        <InputGroup.Addon placement="start">$</InputGroup.Addon>
        <InputGroup.Input id={id} defaultValue="25" />
        <InputGroup.Addon placement="end">USD</InputGroup.Addon>
      </InputGroup>
    </>
  );
}` } } },
  args: { disabled: true },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('textbox')).toBeDisabled();
  },
};
export const Multiline: Story = {
  name: 'Textarea with addon',
  parameters: { docs: { description: { story: 'Keep an optional marker inside the frame of a multi-line control.' }, source: { language: 'tsx', code: `import { InputGroup } from '@jfrader/ui';

<InputGroup>
  <InputGroup.Textarea aria-label="Notes" rows={2} defaultValue="First line" />
  <InputGroup.Addon placement="end">Optional</InputGroup.Addon>
</InputGroup>` } } },
  render: () => <InputGroup><InputGroup.Textarea aria-label="Notes" rows={2} defaultValue="First line" /><InputGroup.Addon placement="end">Optional</InputGroup.Addon></InputGroup>,
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByRole('textbox', { name: 'Notes' });
    await userEvent.click(input);
    await userEvent.type(input, '{End}{Enter}Second line');
    await expect(input).toHaveValue('First line\nSecond line');
  },
};

function ActionExample() {
  const inputRef = useRef<HTMLInputElement>(null);
  return <InputGroup>
    <InputGroup.Input ref={inputRef} aria-label="Reference" />
    <InputGroup.Addon placement="end">
      <Button size="sm" variant="ghost" type="button" onClick={() => inputRef.current?.focus()}>Focus input</Button>
    </InputGroup.Addon>
  </InputGroup>;
}
export const AddonAction: Story = {
  name: 'Addon action',
  parameters: { docs: { description: { story: 'Tab to an addon button and activate it to focus the input.' }, source: { language: 'tsx', code: `import { useRef } from 'react';
import { Button, InputGroup } from '@jfrader/ui';

export function ReferenceField() {
  const inputRef = useRef<HTMLInputElement>(null);
  return <InputGroup>
    <InputGroup.Input ref={inputRef} aria-label="Reference" />
    <InputGroup.Addon placement="end">
      <Button size="sm" variant="ghost" type="button" onClick={() => inputRef.current?.focus()}>Focus input</Button>
    </InputGroup.Addon>
  </InputGroup>;
}` } } },
  render: () => <ActionExample />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole('textbox');
    await userEvent.tab();
    await expect(input).toHaveFocus();
    await userEvent.tab();
    await expect(canvas.getByRole('button')).toHaveFocus();
    await expect(getComputedStyle(input.closest('[data-ui="input-group"]')!).outlineStyle).not.toBe('none');
    await userEvent.keyboard('{Enter}');
    await expect(input).toHaveFocus();
  },
};

function ControlledExample() {
  const [value, setValue] = useState('');
  return <InputGroup><InputGroup.Input aria-label="Name" value={value} onChange={(event) => setValue(event.currentTarget.value)} /></InputGroup>;
}
export const Controlled: Story = {
  name: 'Controlled input',
  parameters: { docs: { description: { story: 'Update a native input value with React state inside the shared frame.' }, source: { language: 'tsx', code: `import { useState } from 'react';
import { InputGroup } from '@jfrader/ui';

export function NameField() {
  const [value, setValue] = useState('');
  return <InputGroup>
    <InputGroup.Input aria-label="Name" value={value} onChange={(event) => setValue(event.currentTarget.value)} />
  </InputGroup>;
}` } } },
  render: () => <ControlledExample />,
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByRole('textbox');
    await userEvent.type(input, 'Ada');
    await expect(input).toHaveValue('Ada');
  },
};
function Replacement(props: ComponentPropsWithRef<'div'>) {
  return <div {...props} data-replacement="" />;
}
export const ReplacementRoot: Story = {
  parameters: { docs: { source: { language: 'tsx', code: `import { useId, type ComponentPropsWithRef } from 'react';
import { InputGroup } from '@jfrader/ui';

function AmountFrame(props: ComponentPropsWithRef<'div'>) {
  return <div {...props} data-replacement="" />;
}

export function AmountField() {
  const id = useId();
  return (
    <>
      <label htmlFor={id}>Amount</label>
      <InputGroup size="md" slots={{ root: AmountFrame }} slotProps={{ root: { 'data-example': 'replacement' } }}>
        <InputGroup.Addon placement="start">$</InputGroup.Addon>
        <InputGroup.Input id={id} defaultValue="25" />
        <InputGroup.Addon placement="end">USD</InputGroup.Addon>
      </InputGroup>
    </>
  );
}` } } },
  args: { slots: { root: Replacement }, slotProps: { root: { 'data-example': 'replacement' } } },
  play: async ({ canvasElement }) => {
    const root = canvasElement.querySelector('[data-replacement]');
    await expect(root).toHaveAttribute('data-ui', 'input-group');
    await expect(root).toHaveAttribute('data-example', 'replacement');
    await expect(root).toHaveClass(/css-/);
  },
};
export const Small: Story = {
  name: 'Small group',
  parameters: { docs: { description: { story: 'Use a compact frame for the amount and its addons.' }, source: { language: 'tsx', code: `import { useId } from 'react';
import { InputGroup } from '@jfrader/ui';

export function AmountField() {
  const id = useId();
  return (
    <>
      <label htmlFor={id}>Amount</label>
      <InputGroup size="sm">
        <InputGroup.Addon placement="start">$</InputGroup.Addon>
        <InputGroup.Input id={id} defaultValue="25" />
        <InputGroup.Addon placement="end">USD</InputGroup.Addon>
      </InputGroup>
    </>
  );
}` } } },
  args: { size: 'sm' },
};
export const Large: Story = {
  name: 'Large group',
  parameters: { docs: { description: { story: 'Use a taller frame for the amount and its addons.' }, source: { language: 'tsx', code: `import { useId } from 'react';
import { InputGroup } from '@jfrader/ui';

export function AmountField() {
  const id = useId();
  return (
    <>
      <label htmlFor={id}>Amount</label>
      <InputGroup size="lg">
        <InputGroup.Addon placement="start">$</InputGroup.Addon>
        <InputGroup.Input id={id} defaultValue="25" />
        <InputGroup.Addon placement="end">USD</InputGroup.Addon>
      </InputGroup>
    </>
  );
}` } } },
  args: { size: 'lg' },
};
export const LightTheme: Story = {
  parameters: { docs: { source: { language: 'tsx', code: `import { useId } from 'react';
import { InputGroup } from '@jfrader/ui';

export function AmountField() {
  const id = useId();
  return (
    <>
      <label htmlFor={id}>Amount</label>
      <InputGroup size="md">
        <InputGroup.Addon placement="start">$</InputGroup.Addon>
        <InputGroup.Input id={id} defaultValue="25" />
        <InputGroup.Addon placement="end">USD</InputGroup.Addon>
      </InputGroup>
    </>
  );
}` } } },
  decorators: [withLightTheme],
};

export const LongAddons: Story = {
  parameters: { docs: { source: { language: 'tsx', code: `import { InputGroup, styled } from '@jfrader/ui';

const NarrowFrame = styled.div({ inlineSize: 'min(100%, 12rem)' });

<NarrowFrame>
  <InputGroup>
    <InputGroup.Addon placement="start">$</InputGroup.Addon>
    <InputGroup.Input aria-label="Settlement amount" defaultValue="25" />
    <InputGroup.Addon placement="end">InternationalSettlementCurrency</InputGroup.Addon>
  </InputGroup>
</NarrowFrame>` } } },
  render: () => <NarrowFrame>
    <InputGroup>
      <InputGroup.Addon placement="start">$</InputGroup.Addon>
      <InputGroup.Input aria-label="Settlement amount" defaultValue="25" />
      <InputGroup.Addon placement="end">InternationalSettlementCurrency</InputGroup.Addon>
    </InputGroup>
    <InputGroup>
      <InputGroup.Addon placement="start">InternationalSettlementReference</InputGroup.Addon>
      <InputGroup.Textarea aria-label="Settlement notes" defaultValue="Notes" rows={2} />
    </InputGroup>
  </NarrowFrame>,
  play: async ({ canvasElement, userEvent }) => {
    for (const control of within(canvasElement).getAllByRole('textbox')) {
      const frame = control.closest<HTMLElement>('[data-ui="input-group"]')!;
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
