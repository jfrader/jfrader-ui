import { Component, useState, type ComponentPropsWithRef, type ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, fireEvent, waitFor, within } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { css } from '../../styling/css';
import { withLightTheme } from '../../testing/story-decorators';
import { ThemeRoot } from '../theme-root';
import { Slider, type SliderProps } from './index';
// `styled` is the app-facing styling API; consumers import it from `@jfrader/ui`.
import { styled } from '../../index';

function ReplacementRoot(props: ComponentPropsWithRef<'div'>) {
  return <div {...props} data-testid="replacement-root" />;
}
function SugarRoot(props: ComponentPropsWithRef<'div'>) {
  return <div {...props} data-testid="sugar-root" />;
}

/** Replace the field element while keeping the track and keyboard control. */
export const RootReplacement: Story = {
  tags: ['!autodocs'],
  args: {
    component: SugarRoot,
    slots: { root: ReplacementRoot },
    ref: fn(),
    className: 'consumer-root',
    slotProps: { root: { ref: fn(), className: 'slot-root', title: 'Volume field', 'data-ui': 'custom' } },
  },
  play: async ({ canvasElement, args }) => {
    const root = within(canvasElement).getByTestId('replacement-root');
    await expect(within(canvasElement).queryByTestId('sugar-root')).toBeNull();
    await expect(root.tagName).toBe('DIV');
    await expect(root).toHaveClass('consumer-root', 'slot-root');
    await expect(root).toHaveAttribute('data-ui', 'slider custom');
    await expect(root).toHaveAttribute('title', 'Volume field');
    await expect(args.ref).toHaveBeenCalledWith(root);
    await expect(args.slotProps?.root?.ref).toHaveBeenCalledWith(root);
    const thumb = within(root).getByRole('slider', { name: 'Volume' });
    await expect(thumb).toHaveAttribute('aria-valuenow', '40');
    thumb.focus();
    fireEvent.keyDown(thumb, { key: 'ArrowRight' });
    await expect(thumb).toHaveAttribute('aria-valuenow', '41');
  },
};

export const RootComponent: Story = {
  tags: ['!autodocs'],
  args: { component: SugarRoot },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByTestId('sugar-root')).toHaveAttribute('data-ui', 'slider');
  },
};

const LightThemeFrame = styled.div({ background: vars.color.bg, padding: vars.space[4] });

const NarrowFrame = styled.div({ inlineSize: '12rem', maxInlineSize: '100%' });

const Frame = styled.div({
  boxSizing: 'border-box',
  inlineSize: '100%',
  maxInlineSize: '30rem',
  display: 'grid',
  gap: vars.space[8],
  padding: vars.space[4],
});
const Button = styled.button({
  minBlockSize: vars.space[8],
  minInlineSize: vars.space[8],
  padding: vars.space[2],
});
const meta = {
  title: 'Inputs/Slider',
  component: Slider,
  tags: ['autodocs'],
  args: { label: 'Volume', defaultValue: 40, locale: 'en-GB', onValueChange: fn(), onValueCommit: fn() },
  decorators: [
    (Story) => (
      <Frame>
        <Story />
      </Frame>
    ),
  ],
  parameters: {
    layout: 'padded',
    docs: {
      sections: [
        { title: 'Basic', stories: ['DefaultSingle'] },
        { title: 'Ranges', stories: ['Range', 'RangeGap'] },
        { title: 'Steps and marks', stories: ['FractionalStep', 'Marks'] },
        { title: 'Formats and adornments', stories: ['IntlPercent', 'IntlCurrency', 'Adornments'] },
        { title: 'States', stories: ['Disabled', 'InvalidError'] },
        { title: 'Controlled', stories: ['ControlledRange'] },
        { title: 'Keyboard', stories: ['Keyboard'] },
      ],
      description: {
        component:
          'Drag a thumb to choose a number, or use two thumbs to choose a range.',
      },
      usage: `### When to use
Use a slider to adjust a bounded number or interval when dragging is useful. Prefer a number field when people need to enter an exact value directly.

### Constraints
- The interval must contain a whole number of steps. Values must be finite, range endpoints ordered, and any minimum gap achievable.
- Thumbs cannot cross and keep their tab order.
- Hidden form inputs do not provide native required validation.
- A completed interaction reports the requested value even if a controlled parent rejects it.

### Keyboard and accessibility
- Arrows move one step; horizontal arrows reverse in RTL. Shift+arrows and PageUp/Down move a large step. Home/End reach the permitted bounds.
- Give each thumb an accessible name that distinguishes its endpoint. Descriptions and errors are announced with the thumbs.
- Test touch screen-reader operation on devices.`,
    },
  },
} satisfies Meta<typeof Slider>;
export default meta;
type Story = StoryObj<typeof Slider>;

export const DefaultSingle: Story = {
  name: 'Volume',
  parameters: { docs: {
    description: { story: 'Drag the thumb to adjust a volume level between zero and one hundred.' },
    source: { language: 'tsx', code: `import { Slider } from '@jfrader/ui';

<Slider label="Volume" defaultValue={40} locale="en-GB" />` },
  } },
  play: async ({ canvas }) => {
    const thumb = canvas.getByRole('slider', { name: 'Volume' });
    await expect(thumb).toHaveAttribute('aria-valuenow', '40');
    await expect(thumb).toHaveAttribute('aria-valuemin', '0');
    await expect(thumb).toHaveAttribute('aria-valuemax', '100');
    await expect(thumb).toHaveAttribute('aria-valuetext', '40');
    await expect(thumb.getBoundingClientRect().width).toBeGreaterThanOrEqual(31);
    await expect(thumb.getBoundingClientRect().height).toBeGreaterThanOrEqual(31);
  },
};
export const Range: Story = {
  name: 'Price range',
  parameters: { docs: { description: { story: 'Adjust minimum and maximum prices with two separately named thumbs.' }, source: { language: 'tsx', code: `import { Slider } from '@jfrader/ui';

<Slider
  type="range"
  label="Price"
  defaultValue={[20, 80]}
  step={5}
  thumbLabels={['Minimum price', 'Maximum price']}
  locale="en-GB"
/>` } } },
  args: {
    type: 'range',
    label: 'Price',
    defaultValue: [20, 80],
    step: 5,
    thumbLabels: ['Minimum price', 'Maximum price'],
  },
  play: async ({ canvas, userEvent, args }) => {
    const lower = canvas.getByRole('slider', { name: 'Minimum price' });
    const upper = canvas.getByRole('slider', { name: 'Maximum price' });
    await userEvent.tab();
    await expect(lower.ownerDocument.activeElement).toBe(lower);
    await userEvent.keyboard('{End}');
    await expect(lower).toHaveAttribute('aria-valuenow', '80');
    await expect(upper).toHaveAttribute('aria-valuemin', '80');
    await userEvent.tab();
    await expect(upper.ownerDocument.activeElement).toBe(upper);
    await userEvent.keyboard('{Home}');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueCommit).toHaveBeenCalledTimes(1);
    await userEvent.tab({ shift: true });
    await expect(lower.ownerDocument.activeElement).toBe(lower);
  },
};
export const Sizes: Story = {
  render: (args) => (
    <>
      <Slider {...args} size="sm" label="Small" />
      <Slider {...args} size="md" label="Medium" />
    </>
  ),
};
export const FractionalStep: Story = {
  name: 'Fractional steps',
  parameters: { docs: {
    description: { story: 'Adjust a value from zero to one in tenths.' },
    source: { language: 'tsx', code: `import { Slider } from '@jfrader/ui';

<Slider label="Volume" min={0} max={1} step={0.1} defaultValue={0.2} locale="en-GB" />` },
  } },
  args: { min: 0, max: 1, step: 0.1, defaultValue: 0.2 },
  play: async ({ canvas, userEvent }) => {
    const thumb = canvas.getByRole('slider');
    await userEvent.tab();
    await userEvent.keyboard('{ArrowRight}');
    await expect(thumb).toHaveAttribute('aria-valuenow', '0.3');
    await userEvent.keyboard('{ArrowLeft}');
    await expect(thumb).toHaveAttribute('aria-valuenow', '0.2');
  },
};
export const NegativeDomain: Story = {
  args: { label: 'Balance', min: -10, max: 10, step: 0.5, defaultValue: -2 },
};
export const FractionalRangeGap: Story = {
  args: {
    type: 'range',
    min: 0,
    max: 1,
    step: 0.1,
    defaultValue: [0.2, 0.4],
    minStepsBetweenThumbs: 1,
    thumbLabels: ['Start', 'End'],
  },
  play: async ({ canvas, userEvent, args }) => {
    const lower = canvas.getByRole('slider', { name: 'Start' });
    const upper = canvas.getByRole('slider', { name: 'End' });
    await expect(lower).toHaveAttribute('aria-valuemax', '0.3');
    await expect(upper).toHaveAttribute('aria-valuemin', '0.3');
    await userEvent.tab();
    await userEvent.keyboard('{End}{End}');
    await expect(lower).toHaveAttribute('aria-valuenow', '0.3');
    await expect(upper).toHaveAttribute('aria-valuemin', '0.4');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
  },
};
export const ScientificStep: Story = {
  args: {
    label: 'Tolerance',
    min: 0,
    max: 1e-5,
    step: 1e-6,
    defaultValue: 2e-6,
    formatOptions: { notation: 'scientific' },
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.tab();
    await userEvent.keyboard('{ArrowRight}');
    await expect(canvas.getByRole('slider')).toHaveAttribute('aria-valuenow', '0.000003');
  },
};
export const LargeStep: Story = {
  args: { step: 5, largeStep: 17, defaultValue: 20 },
  play: async ({ canvas, userEvent }) => {
    await userEvent.tab();
    await userEvent.keyboard('{PageUp}');
    await expect(canvas.getByRole('slider')).toHaveAttribute('aria-valuenow', '35');
  },
};
export const Keyboard: Story = {
  name: 'Keyboard adjustment',
  parameters: { docs: {
    description: { story: 'Focus the thumb and try arrows, Shift+arrows, Page Up, Page Down, Home and End.' },
    source: { language: 'tsx', code: `import { Slider } from '@jfrader/ui';

<Slider label="Volume" defaultValue={50} locale="en-GB" />` },
  } },
  args: { defaultValue: 50 },
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    const thumb = canvas.getByRole('slider');
    await userEvent.tab();
    await expect(thumb.ownerDocument.activeElement).toBe(thumb);
    await expect(getComputedStyle(thumb).outlineStyle).not.toBe('none');
    await expect(Math.abs(parseFloat(getComputedStyle(thumb).outlineWidth) - 2)).toBeLessThan(1.1);
    const bubble = canvasElement.querySelector<HTMLElement>('[data-ui="slider-bubble"]')!;
    await waitFor(async () => {
      await expect(Number(getComputedStyle(bubble).opacity)).toBeGreaterThan(0.99);
    });
    const label = canvasElement.querySelector<HTMLElement>('[id$="-label"]')!;
    await expect(bubble.getBoundingClientRect().top - label.getBoundingClientRect().bottom).toBeGreaterThan(
      -1.1,
    );
    const moves = [
      ['{ArrowRight}', 51],
      ['{ArrowLeft}', 50],
      ['{ArrowUp}', 51],
      ['{ArrowDown}', 50],
      ['{Shift>}{ArrowRight}{/Shift}', 60],
      ['{Shift>}{ArrowLeft}{/Shift}', 50],
      ['{PageUp}', 60],
      ['{PageDown}', 50],
      ['{Home}', 0],
      ['{End}', 100],
    ] as const;
    for (const [key, n] of moves) {
      await userEvent.keyboard(key);
      await expect(thumb).toHaveAttribute('aria-valuenow', String(n));
    }
    await userEvent.keyboard('{End}{ArrowRight}{Enter} ');
    await expect(args.onValueChange).toHaveBeenCalledTimes(moves.length);
    await expect(args.onValueCommit).toHaveBeenCalledTimes(moves.length);
    for (let index = 0; index < moves.length; index++) {
      await expect(args.onValueChange).toHaveBeenNthCalledWith(index + 1, moves[index]![1]);
      await expect(args.onValueCommit).toHaveBeenNthCalledWith(index + 1, moves[index]![1]);
    }
  },
};
export const Marks: Story = {
  name: 'Labeled marks',
  parameters: { docs: { description: { story: 'Select a labeled mark to jump to a preset volume.' }, source: { language: 'tsx', code: `import { Slider } from '@jfrader/ui';

export function VolumePresets() {
  return (
    <Slider
      label="Volume"
      defaultValue={50}
      locale="en-GB"
      marks={[
        { value: 0, label: 'Silent' },
        25,
        { value: 50, label: 'Half' },
        { value: 100, label: 'Full' },
      ]}
    />
  );
}` } } },
  args: {
    defaultValue: 50,
    marks: [
      { value: 0, label: 'Silent' },
      25,
      { value: 50, label: 'Half' },
      { value: 100, label: 'Full' },
      101,
      NaN,
      50,
    ],
  },
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.tab();
    await userEvent.tab();
    await expect(canvas.getByRole('button', { name: 'Silent' }).ownerDocument.activeElement).toBe(
      canvas.getByRole('button', { name: 'Silent' }),
    );
    await userEvent.keyboard('{Enter}');
    await expect(canvas.getByRole('slider')).toHaveAttribute('aria-valuenow', '0');
    await userEvent.keyboard(' ');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueCommit).toHaveBeenCalledTimes(1);
    await userEvent.click(canvas.getByRole('button', { name: 'Full' }));
    await expect(args.onValueChange).toHaveBeenLastCalledWith(100);
    await expect(args.onValueCommit).toHaveBeenCalledTimes(2);
  },
};
export const RangeGap: Story = {
  name: 'Minimum range gap',
  parameters: { docs: {
    description: { story: 'Keep the window endpoints at least two five-unit steps apart.' },
    source: { language: 'tsx', code: `import { Slider } from '@jfrader/ui';

<Slider
  type="range"
  label="Window"
  defaultValue={[20, 80]}
  step={5}
  minStepsBetweenThumbs={2}
  thumbLabels={['Start', 'End']}
  locale="en-GB"
/>` },
  } },
  args: {
    type: 'range',
    label: 'Window',
    defaultValue: [20, 80],
    step: 5,
    minStepsBetweenThumbs: 2,
    thumbLabels: ['Start', 'End'],
  },
  play: async ({ canvas, userEvent }) => {
    const lower = canvas.getByRole('slider', { name: 'Start' });
    const upper = canvas.getByRole('slider', { name: 'End' });
    await expect(lower).toHaveAttribute('aria-valuemax', '70');
    await userEvent.tab();
    await userEvent.keyboard('{End}');
    await expect(lower).toHaveAttribute('aria-valuenow', '70');
    await expect(upper).toHaveAttribute('aria-valuemin', '80');
    await userEvent.tab();
    await userEvent.keyboard('{Home}');
    await expect(upper).toHaveAttribute('aria-valuenow', '80');
  },
};
export const CoincidentThumbs: Story = {
  args: { type: 'range', label: 'Window', defaultValue: [50, 50], thumbLabels: ['Start', 'End'] },
};
export const HiddenReadout: Story = { args: { showValue: false } };
export const Adornments: Story = {
  name: 'Start and end adornments',
  parameters: { docs: { description: { story: 'Place buttons beside the track; adornments do not change the value unless you wire their actions.' }, source: { language: 'tsx', code: `import { Slider, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const AdornmentButton = styled.button({
  minBlockSize: vars.space[8],
  minInlineSize: vars.space[8],
  padding: vars.space[2],
});

export function VolumeAdornments() {
  return (
    <Slider
      label="Volume"
      defaultValue={40}
      locale="en-GB"
      start={<AdornmentButton type="button" aria-label="Mute">−</AdornmentButton>}
      end={<AdornmentButton type="button" aria-label="Maximum volume">+</AdornmentButton>}
    />
  );
}` } } },
  args: {
    start: (
      <Button type="button" aria-label="Mute">
        −
      </Button>
    ),
    end: (
      <Button type="button" aria-label="Maximum volume">
        +
      </Button>
    ),
  },
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Mute' }));
    await expect(args.onValueChange).not.toHaveBeenCalled();
  },
};
export const Disabled: Story = {
  name: 'Disabled slider',
  parameters: { docs: {
    description: { story: 'Keep the volume visible while disabling the thumb and preset mark.' },
    source: { language: 'tsx', code: `import { Slider } from '@jfrader/ui';

<Slider label="Volume" defaultValue={40} locale="en-GB" disabled marks={[{ value: 0, label: 'Silent' }]} />` },
  } },
  args: { disabled: true, marks: [{ value: 0, label: 'Silent' }] },
  play: async ({ canvas, userEvent, args }) => {
    const thumb = canvas.getByRole('slider');
    await expect(thumb).toHaveAttribute('tabindex', '-1');
    await expect(canvas.getByRole('button')).toBeDisabled();
    await userEvent.click(thumb);
    await expect(args.onValueChange).not.toHaveBeenCalled();
  },
};
export const InvalidError: Story = {
  name: 'Validation message',
  parameters: { docs: {
    description: { story: 'Announce an output-level description and validation error with the thumb.' },
    source: { language: 'tsx', code: `import { Slider } from '@jfrader/ui';

<Slider label="Volume" defaultValue={40} locale="en-GB" description="Output level" error="Choose a lower volume" />` },
  } },
  args: { error: 'Choose a lower volume', description: 'Output level' },
  play: async ({ canvas }) => {
    const thumb = canvas.getByRole('slider');
    await expect(thumb).toHaveAttribute('aria-invalid', 'true');
    await expect(thumb).toHaveAccessibleDescription('Output level Choose a lower volume');
  },
};
export const ZeroValue: Story = { args: { value: 0 } };
export const ControlledRejects: Story = {
  args: { value: 40, name: 'volume' },
  render: (args) => (
    <form>
      <Slider {...args} />
    </form>
  ),
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    await userEvent.tab();
    await userEvent.keyboard('{ArrowRight}{ArrowRight}{Home}');
    await expect(canvas.getByRole('slider')).toHaveAttribute('aria-valuenow', '40');
    await expect(args.onValueChange).toHaveBeenCalledTimes(3);
    await expect(args.onValueChange).toHaveBeenNthCalledWith(1, 41);
    await expect(args.onValueChange).toHaveBeenNthCalledWith(2, 41);
    await expect(args.onValueCommit).toHaveBeenLastCalledWith(0);
    await expect(new FormData(canvasElement.querySelector('form')!).get('volume')).toBe('40');
  },
};
export const ControlledRange: Story = {
  name: 'Controlled range',
  parameters: { docs: {
    description: { story: 'Store the two endpoints in React state and accept each requested change.' },
    source: { language: 'tsx', code: `import { useState } from 'react';
import { Slider } from '@jfrader/ui';

export function VolumeRange() {
  const [value, setValue] = useState<readonly [number, number]>([20, 80]);
  return (
    <Slider type="range" label="Volume" value={value} onValueChange={setValue}
      thumbLabels={['Start', 'End']} locale="en-GB" />
  );
}` },
  } },
  args: { type: 'range', value: [20, 80], defaultValue: undefined, thumbLabels: ['Start', 'End'] },
  render: (args) => {
    const [value, setValue] = useState<readonly [number, number]>([20, 80]);
    if (args.type !== 'range') return <></>;
    return (
      <Slider
        {...args}
        value={value}
        onValueChange={(next: readonly [number, number]) => {
          args.onValueChange?.(next);
          setValue(next);
        }}
      />
    );
  },
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.tab();
    await userEvent.keyboard('{ArrowRight}');
    await expect(canvas.getAllByRole('slider')[0]).toHaveAttribute('aria-valuenow', '21');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
  },
};
export const FormNames: Story = {
  args: { defaultValue: 0, name: 'volume' },
  render: (args) => (
    <form>
      <Slider {...args} />
      <Slider
        type="range"
        label="Repeated"
        name="bounds"
        defaultValue={[20, 80]}
        thumbLabels={['Lower', 'Upper']}
      />
      <Slider
        type="range"
        label="Named"
        name={['from', 'to']}
        defaultValue={[10, 90]}
        thumbLabels={['From', 'To']}
      />
      <Slider label="Excluded" name="disabled" disabled />
      <Button type="reset">
        Reset
      </Button>
    </form>
  ),
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    const form = canvasElement.querySelector('form')!;
    const data = new FormData(form);
    await expect(data.get('volume')).toBe('0');
    await expect(data.getAll('bounds')).toEqual(['20', '80']);
    await expect(data.get('from')).toBe('10');
    await expect(data.get('to')).toBe('90');
    await expect(data.has('disabled')).toBe(false);
    await userEvent.tab();
    await userEvent.keyboard('{ArrowRight}');
    await userEvent.click(canvas.getByRole('button', { name: 'Reset' }));
    await expect(canvas.getByRole('slider', { name: 'Volume' })).toHaveAttribute('aria-valuenow', '0');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
  },
};
export const IntlPercent: Story = {
  name: 'Percentage format',
  parameters: { docs: {
    description: { story: 'Display and announce a fractional volume as a percentage.' },
    source: { language: 'tsx', code: `import { Slider } from '@jfrader/ui';

<Slider label="Volume" min={0} max={1} step={0.01} defaultValue={0.4}
  locale="en-GB" formatOptions={{ style: 'percent' }} />` },
  } },
  args: { min: 0, max: 1, step: 0.01, defaultValue: 0.4, formatOptions: { style: 'percent' } },
};
export const IntlCurrency: Story = {
  name: 'Currency format',
  parameters: { docs: {
    description: { story: 'Format both budget endpoints as British pounds.' },
    source: { language: 'tsx', code: `import { Slider } from '@jfrader/ui';

<Slider type="range" label="Budget" defaultValue={[20, 80]} thumbLabels={['Minimum', 'Maximum']}
  locale="en-GB" formatOptions={{ style: 'currency', currency: 'GBP' }} />` },
  } },
  args: {
    type: 'range',
    label: 'Budget',
    defaultValue: [20, 80],
    thumbLabels: ['Minimum', 'Maximum'],
    formatOptions: { style: 'currency', currency: 'GBP' },
  },
};
export const IntlArabicNumerals: Story = {
  args: { locale: 'ar-EG', defaultValue: 40 },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('slider')).toHaveAttribute(
      'aria-valuetext',
      new Intl.NumberFormat('ar-EG').format(40),
    );
  },
};
export const RTL: Story = {
  args: { dir: 'rtl', defaultValue: 50, marks: [0, 50, 100] },
  play: async ({ canvas, userEvent }) => {
    const control = canvas.getByRole('slider').parentElement!;
    const bounds = control.getBoundingClientRect();
    const ticks = control.querySelectorAll<HTMLElement>(':scope > span[aria-hidden="true"]');
    await expect(ticks).toHaveLength(3);
    for (const [index, tick] of Array.from(ticks).entries()) {
      const rect = tick.getBoundingClientRect();
      await expect(Math.abs(rect.left + rect.width / 2 - (bounds.right - bounds.width * index / 2))).toBeLessThan(1);
    }
    await userEvent.tab();
    await userEvent.keyboard('{ArrowRight}');
    await expect(canvas.getByRole('slider')).toHaveAttribute('aria-valuenow', '49');
    await userEvent.keyboard('{ArrowLeft}{ArrowUp}{PageUp}');
    await expect(canvas.getByRole('slider')).toHaveAttribute('aria-valuenow', '61');
  },
};
export const NarrowMarks: Story = {
  args: {
    marks: [
      { value: 0, label: 'Minimum output level' },
      { value: 50, label: 'A comfortable listening level' },
      { value: 100, label: 'Maximum output level' },
    ],
  },
  render: (args) => (
    <NarrowFrame>
      <Slider {...args} />
    </NarrowFrame>
  ),
  play: async ({ canvasElement }) => {
    const root = canvasElement.querySelector<HTMLElement>('[data-ui="slider"]')!;
    await expect(root.scrollWidth).toBeLessThanOrEqual(root.clientWidth);
    for (const button of root.querySelectorAll('button')) {
      await expect(button.scrollHeight).toBeLessThanOrEqual(button.clientHeight);
    }
  },
};
export const Dark: Story = {};
export const LightTheme: Story = { decorators: [withLightTheme] };
export const ScopedTheme: Story = {
  render: (args) => (
    <ThemeRoot theme="light"><LightThemeFrame>
      <Slider {...args} />
    </LightThemeFrame></ThemeRoot>
  ),
};
export const ReducedMotion: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Enable reduced motion in the browser to check that the thumb settles without animation.',
      },
    },
  },
};
export const ForcedColors: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Enable forced colors in the browser to check control boundaries and focus with system colors.',
      },
    },
  },
};
export const AriaMerge: Story = {
  args: {
    label: 'Volume',
    description: 'Internal help',
    error: 'Internal error',
    'aria-label': 'Root name',
    'aria-labelledby': 'external-label',
    'aria-describedby': 'external-help',
    slotProps: {
      thumb: {
        'aria-label': 'Thumb name',
        'aria-labelledby': 'missing-reference',
        'aria-describedby': 'thumb-help',
        'aria-invalid': 'grammar',
      },
    },
  },
  render: (args) => (
    <>
      <span id="external-label">Audio</span>
      <span id="external-help">External help</span>
      <span id="thumb-help">Thumb help</span>
      <Slider {...args} />
    </>
  ),
  play: async ({ canvas }) => {
    const thumb = canvas.getByRole('slider');
    await expect(thumb).toHaveAttribute('aria-label', 'Thumb name');
    await expect(thumb.getAttribute('aria-labelledby')).toContain('external-label missing-reference');
    await expect(thumb).toHaveAccessibleName('Audio Volume');
    await expect(thumb).toHaveAccessibleDescription('External help Thumb help Internal help Internal error');
    await expect(thumb).toHaveAttribute('aria-invalid', 'true');
  },
};
const falsyNodes: ReactNode[] = [false, null, 0, ''];
export const FalsyLabel: Story = {
  args: { defaultValue: 0 },
  render: (args) => (
    <>
      {falsyNodes.map((node, index) => (
        <Slider
          {...args}
          key={index}
          label={node}
          start={node}
          end={node}
          description={node}
          error={node}
          marks={[{ value: 0, label: node }]}
          slotProps={{ thumb: { 'aria-label': `Value ${index}` } }}
        />
      ))}
    </>
  ),
  play: async ({ canvas }) => {
    for (const thumb of canvas.getAllByRole('slider'))
      await expect(thumb).toHaveAttribute('aria-valuenow', '0');
    await expect(canvas.queryAllByRole('button')).toHaveLength(1);
  },
};
export const PreventedKeys: Story = {
  parameters: { docs: { source: { language: 'tsx', code: `import { Slider } from '@jfrader/ui';

export function PointerVolume() {
  return (
    <Slider
      label="Volume"
      defaultValue={40}
      locale="en-GB"
      slotProps={{
        thumb: {
          onKeyDown: (event) => event.preventDefault(),
          'aria-invalid': 'grammar',
        },
      }}
    />
  );
}` } } },
  args: { slotProps: { thumb: { onKeyDown: (event) => event.preventDefault(), 'aria-invalid': 'grammar' } } },
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.tab();
    await userEvent.keyboard('{ArrowRight}');
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await expect(canvas.getByRole('slider')).toHaveAttribute('aria-invalid', 'grammar');
  },
};

function pointerHarness(control: HTMLElement) {
  const captured = new Set<number>();
  control.setPointerCapture = (id) => {
    captured.add(id);
  };
  control.hasPointerCapture = (id) => captured.has(id);
  control.releasePointerCapture = (id) => {
    captured.delete(id);
  };
  const rect = control.getBoundingClientRect();
  return (type: string, ratio: number, pointerId = 1, isPrimary = true) =>
    fireEvent(
      control,
      new PointerEvent(type, {
        bubbles: true,
        pointerId,
        isPrimary,
        button: 0,
        clientX: rect.left + rect.width * ratio,
        clientY: rect.top + rect.height / 2,
      }),
    );
}
export const PointerCaptureCancellation: Story = {
  args: { defaultValue: 40 },
  play: async ({ canvas, canvasElement, args }) => {
    const control = canvasElement.querySelector<HTMLElement>('[data-ui="slider-control"]')!;
    const pointer = pointerHarness(control);
    pointer('pointerdown', 0.5);
    await expect(control.hasPointerCapture(1)).toBe(true);
    pointer('pointermove', 0.8, 2);
    pointer('pointermove', 0.9, 3, false);
    await expect(canvas.getByRole('slider')).toHaveAttribute('aria-valuenow', '50');
    pointer('pointermove', 1.2);
    await expect(canvas.getByRole('slider')).toHaveAttribute('aria-valuenow', '100');
    pointer('pointercancel', 1.2);
    pointer('lostpointercapture', 1.2);
    pointer('pointerup', 1.2);
    await expect(args.onValueChange).toHaveBeenCalledTimes(2);
    await expect(args.onValueCommit).not.toHaveBeenCalled();
    await expect(control.hasPointerCapture(1)).toBe(false);
  },
};
export const CommitCounts: Story = {
  args: { value: 40 },
  play: async ({ canvas, canvasElement, args }) => {
    const control = canvasElement.querySelector<HTMLElement>('[data-ui="slider-control"]')!;
    const pointer = pointerHarness(control);
    pointer('pointerdown', 0.5);
    pointer('pointermove', 0.5);
    pointer('pointermove', 0.7);
    pointer('pointermove', 0.7);
    pointer('pointerup', 0.7);
    pointer('lostpointercapture', 0.7);
    await expect(args.onValueChange).toHaveBeenCalledTimes(2);
    await expect(args.onValueChange).toHaveBeenNthCalledWith(1, 50);
    await expect(args.onValueChange).toHaveBeenNthCalledWith(2, 70);
    await expect(args.onValueCommit).toHaveBeenCalledTimes(1);
    await expect(args.onValueCommit).toHaveBeenCalledWith(70);
    await expect(canvas.getByRole('slider')).toHaveAttribute('aria-valuenow', '40');
  },
};
export const ExternalUpdateWhileDragging: Story = {
  args: { value: 40 },
  render: (args) => {
    const [value, setValue] = useState(40);
    if (args.type === 'range') return <></>;
    return (
      <>
        <Slider
          {...args}
          value={value}
          onValueChange={(next) => {
            args.onValueChange?.(next);
            setValue(20);
          }}
        />
        <Button onClick={() => setValue(80)}>
          Update
        </Button>
      </>
    );
  },
  play: async ({ canvas, canvasElement, args }) => {
    const control = canvasElement.querySelector<HTMLElement>('[data-ui="slider-control"]')!;
    const pointer = pointerHarness(control);
    pointer('pointerdown', 0.5);
    await expect(canvas.getByRole('slider')).toHaveAttribute('aria-valuenow', '20');
    pointer('pointermove', 0.7);
    pointer('pointerup', 0.7);
    await expect(args.onValueCommit).toHaveBeenCalledTimes(1);
    await expect(args.onValueCommit).toHaveBeenCalledWith(70);
    await expect(canvas.getByRole('slider')).toHaveAttribute('aria-valuenow', '20');
  },
};

function ReplacementSliderThumb(props: import('react').ComponentPropsWithRef<'div'>) {
  return <div {...props} data-replacement="thumb" />;
}
function ReplacementSliderTrack(props: import('react').ComponentPropsWithRef<'div'>) {
  return <div {...props} data-replacement="track" />;
}

// This story tests the documented css/slot API and native style merging.
export const SlotStylingAndRefs: Story = {
  parameters: { docs: { source: { language: 'tsx', code: `import { useRef, type ComponentPropsWithRef } from 'react';
import { Slider } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

function VolumeThumb(props: ComponentPropsWithRef<'div'>) {
  return <div {...props} data-replacement="thumb" />;
}

function VolumeTrack(props: ComponentPropsWithRef<'div'>) {
  return <div {...props} data-replacement="track" />;
}

export function StyledVolume() {
  const rootRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  return (
    <Slider
      ref={rootRef}
      label="Volume"
      defaultValue={40}
      locale="en-GB"
      slots={{ thumb: VolumeThumb, track: VolumeTrack }}
      slotProps={{
        thumb: { ref: thumbRef, sx: { borderRadius: vars.radius.md } },
        track: { sx: { blockSize: vars.space[2] } },
        label: { sx: { fontWeight: vars.fontWeight.semibold } },
      }}
    />
  );
}` } } },
  args: {
    slots: { thumb: ReplacementSliderThumb, track: ReplacementSliderTrack },
    ref: fn(),
    slotProps: {
      thumb: { ref: fn(), sx: css({ borderRadius: vars.radius.md }) },
      track: { sx: css({ blockSize: vars.space[2] }) },
      label: { sx: css({ fontWeight: vars.fontWeight.semibold }) },
    },
  },
  play: async ({ canvas, canvasElement, args }) => {
    const root = canvasElement.querySelector('[data-ui="slider"]');
    const thumb = canvas.getByRole('slider');
    await expect(thumb).toHaveAttribute('data-replacement', 'thumb');
    await expect(args.ref).toHaveBeenCalledWith(root);
    const part =
      typeof args.slotProps?.thumb === 'function' ? args.slotProps.thumb(0) : args.slotProps?.thumb;
    await expect(part?.ref).toHaveBeenCalledWith(thumb);
    await expect(Math.abs(parseFloat(getComputedStyle(thumb).borderRadius) - 12)).toBeLessThan(1.1);
    const track = canvasElement.querySelector<HTMLElement>('[data-ui="slider-track"]')!;
    await expect(track).toHaveAttribute('data-replacement', 'track');
    await expect(Math.abs(track.getBoundingClientRect().height - 8)).toBeLessThan(1.1);
    const label = canvasElement.querySelector<HTMLElement>('[id$="-label"]')!;
    await expect(getComputedStyle(label).fontWeight).toBe('600');
  },
};

export const RootPreventsKeys: Story = {
  args: { onKeyDown: (event) => event.preventDefault() },
  play: async ({ userEvent, args }) => {
    await userEvent.tab();
    await userEvent.keyboard('{ArrowRight}');
    await expect(args.onValueChange).not.toHaveBeenCalled();
  },
};

export const CoincidentPointerDirection: Story = {
  args: { type: 'range', defaultValue: [50, 50], thumbLabels: ['Start', 'End'] },
  play: async ({ canvas, canvasElement, args }) => {
    const control = canvasElement.querySelector<HTMLElement>('[data-ui="slider-control"]')!;
    const pointer = pointerHarness(control);
    pointer('pointerdown', 0.5);
    pointer('pointermove', 0.7);
    await expect(canvas.getByRole('slider', { name: 'Start' })).toHaveAttribute('aria-valuenow', '50');
    await expect(canvas.getByRole('slider', { name: 'End' })).toHaveAttribute('aria-valuenow', '70');
    pointer('pointerup', 0.7);
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueCommit).toHaveBeenCalledTimes(1);
    await expect(args.onValueCommit).toHaveBeenCalledWith([50, 70]);
  },
};

export const RangeMarks: Story = {
  args: {
    type: 'range',
    defaultValue: [20, 80],
    thumbLabels: ['Start', 'End'],
    marks: [
      { value: 50, label: 'Middle' },
      { value: 100, label: 'Maximum' },
    ],
  },
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.tab();
    await userEvent.tab();
    await userEvent.click(canvas.getByRole('button', { name: 'Middle' }));
    await expect(canvas.getByRole('slider', { name: 'End' })).toHaveAttribute('aria-valuenow', '50');
    await expect(args.onValueChange).toHaveBeenCalledWith([20, 50]);
    await userEvent.click(canvas.getByRole('button', { name: 'Maximum' }));
    await expect(args.onValueChange).toHaveBeenCalledTimes(2);
    await expect(args.onValueCommit).toHaveBeenCalledTimes(2);
  },
};

export const DisableDuringDrag: Story = {
  render: (args) => {
    const [disabled, setDisabled] = useState(false);
    if (args.type === 'range') return <></>;
    return (
      <Slider
        {...args}
        disabled={disabled}
        onValueChange={(next) => {
          args.onValueChange?.(next);
          setDisabled(true);
        }}
      />
    );
  },
  play: async ({ canvasElement, args }) => {
    const control = canvasElement.querySelector<HTMLElement>('[data-ui="slider-control"]')!;
    const pointer = pointerHarness(control);
    pointer('pointerdown', 0.5);
    await expect(control.hasPointerCapture(1)).toBe(false);
    pointer('pointerup', 0.5);
    await expect(args.onValueCommit).not.toHaveBeenCalled();
  },
};

export const LongFormattedValue: Story = {
  args: {
    min: 1000000000000000,
    max: 1000000000000100,
    step: 1,
    defaultValue: 1000000000000001,
    formatOptions: { style: 'currency', currency: 'EUR' },
    locale: 'de-DE',
  },
  play: async ({ canvas, canvasElement, userEvent }) => {
    const thumb = canvas.getByRole('slider');
    await expect(thumb).toHaveAttribute('aria-valuenow', '1000000000000001');
    await userEvent.tab();
    await userEvent.keyboard('{ArrowRight}');
    await expect(thumb).toHaveAttribute('aria-valuenow', '1000000000000002');
    const root = canvasElement.querySelector<HTMLElement>('[data-ui="slider"]')!;
    await expect(root.scrollWidth - root.clientWidth).toBeLessThan(1.1);
  },
};

class ConfigurationBoundary extends Component<{ children: ReactNode }, { error: string | null }> {
  state: { error: string | null } = { error: null };
  static getDerivedStateFromError(error: Error) {
    return { error: error.message };
  }
  render() {
    return this.state.error ? <div role="alert">{this.state.error}</div> : this.props.children;
  }
}

const invalidConfigurations: SliderProps[] = [
  { label: 'Unaligned', min: 0, max: 1, step: 0.3 },
  { label: 'Zero step', step: 0 },
  { label: 'Infinite value', value: Infinity },
  { label: 'Unordered', type: 'range', value: [80, 20], thumbLabels: ['Start', 'End'] },
  {
    label: 'Infeasible gap',
    type: 'range',
    value: [20, 30],
    minStepsBetweenThumbs: 20,
    thumbLabels: ['Start', 'End'],
  },
  { label: 'Negative gap', type: 'range', minStepsBetweenThumbs: -1, thumbLabels: ['Start', 'End'] },
];
export const ConfigurationErrors: Story = {
  // Verification, not an example: the canvas is six error alerts and the console carries the
  // component's own reports. The constraints are documented in the usage notes and the props.
  tags: ['!autodocs'],
  render: () => (
    <>
      {invalidConfigurations.map((props, index) => (
        <ConfigurationBoundary key={index}>
          <Slider {...props} />
        </ConfigurationBoundary>
      ))}
    </>
  ),
  play: async ({ canvas }) => {
    const errors = canvas.getAllByRole('alert');
    await expect(errors).toHaveLength(invalidConfigurations.length);
    await expect(errors[0]).toHaveTextContent('max aligned to min + n * step');
    await expect(errors[1]).toHaveTextContent('a positive step');
    await expect(errors[2]).toHaveTextContent('values must be finite');
    await expect(errors[3]).toHaveTextContent('ordered [lower, upper] tuple');
    await expect(errors[4]).toHaveTextContent('values must respect minStepsBetweenThumbs');
    await expect(errors[5]).toHaveTextContent('nonnegative integer');
  },
};
