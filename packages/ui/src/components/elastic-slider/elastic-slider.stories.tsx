import { Component, useState, type ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fireEvent, fn, waitFor } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { css } from '../../styling/css';
import { withLightTheme } from '../../testing/story-decorators';
import { ThemeRoot } from '../theme-root';
import { ElasticSlider, type ElasticSliderProps } from './index';

const frameStyle = css({
  inlineSize: '30rem',
  maxInlineSize: '100%',
  display: 'grid',
  gap: vars.space[8],
  padding: vars.space[4],
});
const buttonStyle = css({
  minBlockSize: vars.space[8],
  minInlineSize: vars.space[8],
  padding: vars.space[2],
});
const iconStyle = css({ display: 'inline-flex', inlineSize: '1.25em', blockSize: '1.25em' });
const percentFormat = new Intl.NumberFormat('en-GB', { style: 'percent' });
const usage = `const midpointText = new Intl.NumberFormat('en-GB', { style: 'percent' }).format(0.5);

<ElasticSlider label="Volume" defaultValue={0.6} min={0} max={1} step={0.01}
  marks={[0, { value: 0.5, label: midpointText }, 1]} locale="en-GB"
  formatOptions={{ style: 'percent' }} onValueCommit={saveVolume} />`;
const SPRING_SETTLE_MS = 1200;

const meta = {
  title: 'Forms/ElasticSlider',
  component: ElasticSlider,
  tags: ['autodocs'],
  args: { label: 'Volume', defaultValue: 40, locale: 'en-GB', onValueChange: fn(), onValueCommit: fn() },
  decorators: [
    (Story) => (
      <div css={frameStyle}>
        <Story />
      </div>
    ),
  ],
  parameters: {
    docs: {
      source: { code: usage },
      description: {
        component:
          'Adjust a value by dragging a slider that stretches at its ends and snaps to marks.',
      },
      usage: '- Use Slider for ranges. Pass thumb ARIA through `slotProps.thumb`. Hidden form inputs do not provide native required validation.\n- Arrows move one step; horizontal arrows mirror in RTL. Shift+arrows and PageUp/Down move a large step. Home/End move to min/max. Enter and Space on the thumb do nothing.\n- Marks latch within 7px and release beyond 10px while dragging. Labelled marks are buttons that set their value.\n- Dragging past an end stretches the track up to 26px; the value stays within min/max.\n- `haptics` enables touch vibration where supported. Reduced motion disables stretch, swell, tilt, tick pop and vibration; marks still latch.\n- Test touch screen-reader operation on a device.',
    },
  },
} satisfies Meta<typeof ElasticSlider>;
export default meta;
type Story = StoryObj<typeof ElasticSlider>;

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
  return {
    rect,
    send: (
      type: string,
      ratio: number,
      { px = 0, pointerId = 1, isPrimary = true, pointerType = 'mouse' } = {},
    ) =>
      fireEvent(
        control,
        new PointerEvent(type, {
          bubbles: true,
          pointerId,
          isPrimary,
          pointerType,
          button: 0,
          clientX: rect.left + rect.width * ratio + px,
          clientY: rect.top + rect.height / 2,
        }),
      ),
  };
}
const controlOf = (root: HTMLElement) =>
  root.querySelector<HTMLElement>('[data-ui="elastic-slider-control"]')!;
const part = (root: HTMLElement, name: string) => root.querySelector<HTMLElement>(`[data-ui="${name}"]`)!;
const prefersReducedMotion = (root: HTMLElement) =>
  root.ownerDocument.defaultView!.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const Default: Story = {
  play: async ({ canvas, canvasElement }) => {
    const thumb = canvas.getByRole('slider', { name: 'Volume' });
    await expect(thumb).toHaveAttribute('aria-valuenow', '40');
    await expect(thumb).toHaveAttribute('aria-valuemin', '0');
    await expect(thumb).toHaveAttribute('aria-valuemax', '100');
    await expect(thumb).toHaveAttribute('aria-valuetext', '40');
    await expect(thumb).toHaveAttribute('aria-orientation', 'horizontal');
    await expect(thumb.getBoundingClientRect().width).toBeGreaterThanOrEqual(31);
    await expect(thumb.getBoundingClientRect().height).toBeGreaterThanOrEqual(31);
    await expect(part(canvasElement, 'elastic-slider-readout')).toHaveAttribute('aria-hidden', 'true');
    await expect(part(canvasElement, 'elastic-slider-bubble')).toHaveAttribute('aria-hidden', 'true');
  },
};
export const Sizes: Story = {
  render: (args) => (
    <>
      <ElasticSlider {...args} size="sm" label="Small" />
      <ElasticSlider {...args} size="md" label="Medium" />
    </>
  ),
  play: async ({ canvasElement }) => {
    const [small, medium] = canvasElement.querySelectorAll<HTMLElement>('[data-ui="elastic-slider-control"]');
    await expect(Math.abs(small!.getBoundingClientRect().height - 32)).toBeLessThan(1.1);
    await expect(Math.abs(medium!.getBoundingClientRect().height - 40)).toBeLessThan(1.1);
  },
};
export const Detents: Story = {
  args: { defaultValue: 10, marks: [25, 50, 75, 50.4, 101, NaN] },
  play: async ({ canvasElement, args }) => {
    await expect(canvasElement.querySelectorAll('[data-ui="elastic-slider-tick"]')).toHaveLength(3);
    const thumb = canvasElement.querySelector('[role="slider"]')!;
    const pointer = pointerHarness(controlOf(canvasElement));
    pointer.send('pointerdown', 0.5, { px: 6 });
    await expect(thumb).toHaveAttribute('aria-valuenow', '50');
    await expect(canvasElement.querySelector('[data-latched]')).not.toBeNull();
    pointer.send('pointerup', 0.5, { px: 6 });
    await expect(canvasElement.querySelector('[data-latched]')).toBeNull();
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenCalledWith(50);
    await expect(args.onValueCommit).toHaveBeenCalledTimes(1);
    await expect(args.onValueCommit).toHaveBeenCalledWith(50);
  },
};
export const DetentHysteresis: Story = {
  args: { defaultValue: 10, marks: [50] },
  play: async ({ canvasElement }) => {
    const thumb = canvasElement.querySelector('[role="slider"]')!;
    const pointer = pointerHarness(controlOf(canvasElement));
    const tick = part(canvasElement, 'elastic-slider-tick');
    // Approaching from outside: just beyond the 7px entry radius does not latch.
    pointer.send('pointerdown', 0.5, { px: 20 });
    pointer.send('pointermove', 0.5, { px: 9 });
    pointer.send('pointermove', 0.5, { px: 7.1 });
    await expect(thumb).not.toHaveAttribute('aria-valuenow', '50');
    await expect(tick).not.toHaveAttribute('data-latched');
    // Entry within 7px, then held until the pointer is more than 10px away on either side.
    pointer.send('pointermove', 0.5, { px: 6.9 });
    await expect(thumb).toHaveAttribute('aria-valuenow', '50');
    await expect(tick).toHaveAttribute('data-latched');
    pointer.send('pointermove', 0.5, { px: 9.9 });
    await expect(thumb).toHaveAttribute('aria-valuenow', '50');
    pointer.send('pointermove', 0.5, { px: -9.9 });
    await expect(thumb).toHaveAttribute('aria-valuenow', '50');
    pointer.send('pointermove', 0.5, { px: 10.1 });
    await expect(thumb).not.toHaveAttribute('aria-valuenow', '50');
    await expect(tick).not.toHaveAttribute('data-latched');
    pointer.send('pointerup', 0.5, { px: 10.1 });
  },
};
export const DetentTie: Story = {
  args: { defaultValue: 10, marks: [51, 49] },
  play: async ({ canvasElement }) => {
    const pointer = pointerHarness(controlOf(canvasElement));
    const unitPx = pointer.rect.width / 100;
    await expect(unitPx).toBeLessThan(7);
    pointer.send('pointerdown', 0.5);
    await expect(canvasElement.querySelector('[role="slider"]')).toHaveAttribute('aria-valuenow', '49');
    pointer.send('pointerup', 0.5);
  },
};
export const LabelledMarks: Story = {
  args: {
    defaultValue: 50,
    marks: [{ value: 0, label: 'Silent' }, 25, { value: 50, label: 'Half' }, { value: 100, label: 'Full' }],
  },
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.tab();
    await userEvent.tab();
    const silent = canvas.getByRole('button', { name: 'Silent' });
    await expect(silent.ownerDocument.activeElement).toBe(silent);
    await expect(getComputedStyle(silent).outlineStyle).not.toBe('none');
    await userEvent.keyboard('{Enter}');
    await expect(canvas.getByRole('slider')).toHaveAttribute('aria-valuenow', '0');
    await userEvent.keyboard(' ');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueCommit).toHaveBeenCalledTimes(1);
    await userEvent.tab();
    await userEvent.keyboard(' ');
    await expect(args.onValueChange).toHaveBeenLastCalledWith(50);
    await expect(args.onValueCommit).toHaveBeenLastCalledWith(50);
    await userEvent.click(canvas.getByRole('button', { name: 'Half' }));
    await expect(args.onValueChange).toHaveBeenCalledTimes(2);
    await expect(args.onValueCommit).toHaveBeenCalledTimes(2);
  },
};
export const FractionalStep: Story = {
  args: { min: 0, max: 1, step: 0.1, defaultValue: 0.2, marks: [0.30000000000000004] },
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    const thumb = canvas.getByRole('slider');
    await userEvent.tab();
    await userEvent.keyboard('{ArrowRight}');
    await expect(thumb).toHaveAttribute('aria-valuenow', '0.3');
    await userEvent.keyboard('{ArrowLeft}');
    await expect(thumb).toHaveAttribute('aria-valuenow', '0.2');
    const pointer = pointerHarness(controlOf(canvasElement));
    pointer.send('pointerdown', 0.3, { px: 3 });
    await expect(thumb).toHaveAttribute('aria-valuenow', '0.3');
    pointer.send('pointerup', 0.3, { px: 3 });
    await expect(args.onValueCommit).toHaveBeenLastCalledWith(0.3);
  },
};
export const NegativeDomain: Story = {
  args: { label: 'Balance', min: -10, max: 10, step: 0.5, defaultValue: -2, marks: [0] },
  play: async ({ canvas, userEvent }) => {
    await userEvent.tab();
    await userEvent.keyboard('{Shift>}{ArrowRight}{/Shift}');
    await expect(canvas.getByRole('slider')).toHaveAttribute('aria-valuenow', '0');
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
export const HiddenReadout: Story = {
  args: { showValue: false },
  play: async ({ canvas, canvasElement, userEvent }) => {
    await expect(canvasElement.querySelector('[data-ui="elastic-slider-readout"]')).toBeNull();
    await userEvent.tab();
    const bubble = part(canvasElement, 'elastic-slider-bubble');
    await expect(bubble).toHaveTextContent('40');
    await waitFor(async () => {
      await expect(Number(getComputedStyle(bubble).opacity)).toBeGreaterThan(0.99);
    });
    await expect(canvas.getByRole('slider')).toHaveAccessibleName('Volume');
  },
};
export const Adornments: Story = {
  args: {
    start: (
      <button type="button" css={buttonStyle} aria-label="Mute">
        <svg css={iconStyle} viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 9h4l5-4v14l-5-4H5z" fill="currentColor" />
        </svg>
      </button>
    ),
    end: (
      <svg css={iconStyle} viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 9h4l5-4v14l-5-4H5zm11-1a5 5 0 0 1 0 8" fill="none" stroke="currentColor" />
      </svg>
    ),
  },
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Mute' }));
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await expect(canvas.getByRole('slider')).toHaveAttribute('aria-valuenow', '40');
  },
};
export const Stretch: Story = {
  args: { defaultValue: 90 },
  play: async ({ canvasElement, args }) => {
    const control = controlOf(canvasElement);
    const track = part(canvasElement, 'elastic-slider-track');
    const thumb = canvasElement.querySelector('[role="slider"]')!;
    const pointer = pointerHarness(control);
    const reduced = prefersReducedMotion(canvasElement);
    pointer.send('pointerdown', 0.9);
    pointer.send('pointermove', 1.5);
    await expect(thumb).toHaveAttribute('aria-valuenow', '100');
    await expect(control.hasPointerCapture(1)).toBe(true);
    await waitFor(
      async () => {
        const reach = track.getBoundingClientRect().right - pointer.rect.right;
        if (reduced) await expect(Math.abs(reach)).toBeLessThan(1.1);
        else {
          await expect(reach).toBeGreaterThan(20);
          await expect(reach).toBeLessThan(26 + 1.1);
        }
        const thumbBox = thumb.getBoundingClientRect();
        const trackEnd = track.getBoundingClientRect().right;
        await expect(Math.abs(thumbBox.left + thumbBox.width / 2 - trackEnd)).toBeLessThan(1.1);
      },
      { timeout: SPRING_SETTLE_MS },
    );
    await expect(Math.abs(track.getBoundingClientRect().left - pointer.rect.left)).toBeLessThan(1.1);
    pointer.send('pointerup', 1.5);
    await waitFor(
      async () => {
        await expect(Math.abs(track.getBoundingClientRect().right - pointer.rect.right)).toBeLessThan(1.1);
      },
      { timeout: SPRING_SETTLE_MS },
    );
    const tilt = parseFloat(control.style.getPropertyValue('--elastic-slider-tilt') || '0');
    await expect(Math.abs(tilt)).toBeLessThanOrEqual(10);
    await expect(args.onValueCommit).toHaveBeenCalledTimes(1);
    await expect(args.onValueCommit).toHaveBeenCalledWith(100);
  },
};
export const HapticsOptIn: Story = {
  args: { defaultValue: 10, marks: [50], haptics: true },
  parameters: {
    docs: {
      description: {
        story: 'Vibration support is mocked in the test. Physical device feedback needs manual testing.',
      },
    },
  },
  render: (args) => (
    <>
      <ElasticSlider {...args} />
      <ElasticSlider {...args} label="Without haptics" haptics={false} />
    </>
  ),
  play: async ({ canvasElement }) => {
    const navigator = canvasElement.ownerDocument.defaultView!.navigator;
    const original = Object.getOwnPropertyDescriptor(navigator, 'vibrate');
    const vibrate = fn(() => {
      throw new Error('Vibration refused');
    });
    Object.defineProperty(navigator, 'vibrate', { configurable: true, value: vibrate });
    try {
      const [withHaptics, withoutHaptics] = canvasElement.querySelectorAll<HTMLElement>(
        '[data-ui="elastic-slider-control"]',
      );
      const touch = pointerHarness(withHaptics!);
      touch.send('pointerdown', 0.5, { px: 20, pointerType: 'touch' });
      touch.send('pointermove', 0.5, { px: 3, pointerType: 'touch' });
      touch.send('pointermove', 0.5, { px: -3, pointerType: 'touch' });
      touch.send('pointerup', 0.5, { px: -3, pointerType: 'touch' });
      const expected = prefersReducedMotion(canvasElement) ? 0 : 1;
      await expect(vibrate).toHaveBeenCalledTimes(expected);
      if (expected) await expect(vibrate).toHaveBeenCalledWith(6);
      touch.send('pointerdown', 0.5, { px: 20 });
      touch.send('pointermove', 0.5, { px: 3 });
      touch.send('pointerup', 0.5, { px: 3 });
      const quiet = pointerHarness(withoutHaptics!);
      quiet.send('pointerdown', 0.5, { px: 20, pointerType: 'touch' });
      quiet.send('pointermove', 0.5, { px: 3, pointerType: 'touch' });
      quiet.send('pointercancel', 0.5, { px: 3, pointerType: 'touch' });
      await expect(vibrate).toHaveBeenCalledTimes(expected);
    } finally {
      if (original) Object.defineProperty(navigator, 'vibrate', original);
      else Reflect.deleteProperty(navigator, 'vibrate');
    }
  },
};
export const Disabled: Story = {
  args: { disabled: true, name: 'volume', marks: [{ value: 0, label: 'Silent' }] },
  render: (args) => (
    <form>
      <ElasticSlider {...args} />
    </form>
  ),
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    const thumb = canvas.getByRole('slider');
    await expect(thumb).toHaveAttribute('tabindex', '-1');
    await expect(thumb).toHaveAttribute('aria-disabled', 'true');
    await expect(canvas.getByRole('button', { name: 'Silent' })).toBeDisabled();
    await userEvent.click(thumb);
    const pointer = pointerHarness(controlOf(canvasElement));
    pointer.send('pointerdown', 0.8);
    pointer.send('pointerup', 0.8);
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await expect(args.onValueCommit).not.toHaveBeenCalled();
    await expect(new FormData(canvasElement.querySelector('form')!).has('volume')).toBe(false);
  },
};
export const InvalidError: Story = {
  args: { error: 'Choose a lower volume', description: 'Output level' },
  play: async ({ canvas }) => {
    const thumb = canvas.getByRole('slider');
    await expect(thumb).toHaveAttribute('aria-invalid', 'true');
    await expect(thumb).toHaveAccessibleDescription('Output level Choose a lower volume');
    await expect(canvas.getByRole('alert')).toHaveTextContent('Choose a lower volume');
  },
};
export const ZeroValue: Story = {
  args: { value: 0, defaultValue: undefined, min: -5, max: 5 },
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.getByRole('slider')).toHaveAttribute('aria-valuenow', '0');
    await expect(part(canvasElement, 'elastic-slider-readout')).toHaveTextContent('0');
  },
};
export const ControlledRejects: Story = {
  args: { value: 40, defaultValue: undefined, name: 'volume' },
  render: (args) => (
    <form>
      <ElasticSlider {...args} />
    </form>
  ),
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    const thumb = canvas.getByRole('slider');
    await userEvent.tab();
    await userEvent.keyboard('{ArrowRight}{ArrowRight}{Home}');
    await expect(thumb).toHaveAttribute('aria-valuenow', '40');
    await expect(args.onValueChange).toHaveBeenCalledTimes(3);
    await expect(args.onValueChange).toHaveBeenNthCalledWith(1, 41);
    await expect(args.onValueChange).toHaveBeenNthCalledWith(2, 41);
    await expect(args.onValueCommit).toHaveBeenLastCalledWith(0);
    const pointer = pointerHarness(controlOf(canvasElement));
    pointer.send('pointerdown', 0.7);
    pointer.send('pointerup', 0.7);
    await expect(args.onValueCommit).toHaveBeenLastCalledWith(70);
    await expect(args.onValueCommit).toHaveBeenCalledTimes(4);
    await expect(thumb).toHaveAttribute('aria-valuenow', '40');
    const fill = part(canvasElement, 'elastic-slider-fill');
    await expect(fill.style.inlineSize).toBe('40%');
    await expect(new FormData(canvasElement.querySelector('form')!).get('volume')).toBe('40');
  },
};
export const Controlled: Story = {
  render: (args) => {
    const [value, setValue] = useState(40);
    return (
      <ElasticSlider
        {...args}
        defaultValue={undefined}
        value={value}
        onValueChange={(next) => {
          args.onValueChange?.(next);
          setValue(next);
        }}
      />
    );
  },
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.tab();
    await userEvent.keyboard('{ArrowRight}');
    await expect(canvas.getByRole('slider')).toHaveAttribute('aria-valuenow', '41');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueCommit).toHaveBeenCalledTimes(1);
  },
};
export const FormReset: Story = {
  args: { defaultValue: 30, name: 'volume' },
  render: (args) => (
    <form>
      <ElasticSlider {...args} />
      <button css={buttonStyle} type="reset">
        Reset
      </button>
    </form>
  ),
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    const form = canvasElement.querySelector('form')!;
    await expect(new FormData(form).get('volume')).toBe('30');
    await userEvent.tab();
    await userEvent.keyboard('{ArrowRight}');
    await expect(new FormData(form).get('volume')).toBe('31');
    await userEvent.click(canvas.getByRole('button', { name: 'Reset' }));
    await waitFor(async () => {
      await expect(canvas.getByRole('slider')).toHaveAttribute('aria-valuenow', '30');
    });
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
  },
};
export const IntlPercent: Story = {
  args: { min: 0, max: 1, step: 0.01, defaultValue: 0.4, formatOptions: { style: 'percent' } },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('slider')).toHaveAttribute('aria-valuetext', percentFormat.format(0.4));
  },
};
export const IntlCurrency: Story = {
  args: { label: 'Budget', defaultValue: 20, formatOptions: { style: 'currency', currency: 'GBP' } },
  play: async ({ canvas }) => {
    const text = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(20);
    await expect(canvas.getByRole('slider')).toHaveAttribute('aria-valuetext', text);
  },
};
export const IntlArabicNumerals: Story = {
  args: { locale: 'ar-EG', defaultValue: 40 },
  play: async ({ canvas, canvasElement }) => {
    const text = new Intl.NumberFormat('ar-EG').format(40);
    await expect(canvas.getByRole('slider')).toHaveAttribute('aria-valuetext', text);
    await expect(canvas.getByRole('slider')).toHaveAttribute('aria-valuenow', '40');
    await expect(part(canvasElement, 'elastic-slider-readout')).toHaveTextContent(text);
    await expect(part(canvasElement, 'elastic-slider-bubble')).toHaveTextContent(text);
  },
};
export const NarrowTag: Story = {
  args: {
    label: 'Budget',
    min: 1000000000000000,
    max: 1000000000000100,
    defaultValue: 1000000000000100,
    formatOptions: { style: 'currency', currency: 'EUR' },
    locale: 'de-DE',
  },
  render: (args) => (
    <div style={{ inlineSize: '14rem', maxInlineSize: '100%' }}>
      <ElasticSlider {...args} />
    </div>
  ),
  play: async ({ canvasElement, userEvent }) => {
    const root = part(canvasElement, 'elastic-slider');
    const bubble = part(canvasElement, 'elastic-slider-bubble');
    await userEvent.tab();
    for (const key of ['{End}', '{Home}']) {
      await userEvent.keyboard(key);
      await waitFor(async () => {
        await expect(Number(getComputedStyle(bubble).opacity)).toBeGreaterThan(0.99);
      });
      const inner = bubble.getBoundingClientRect();
      const outer = root.getBoundingClientRect();
      await expect(inner.left).toBeGreaterThan(outer.left - 1.1);
      await expect(inner.right).toBeLessThan(outer.right + 1.1);
    }
    await expect(root.scrollWidth - root.clientWidth).toBeLessThan(1.1);
  },
};
export const RTL: Story = {
  args: { dir: 'rtl', defaultValue: 50 },
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    const thumb = canvas.getByRole('slider');
    await userEvent.tab();
    await userEvent.keyboard('{ArrowRight}');
    await expect(thumb).toHaveAttribute('aria-valuenow', '49');
    await userEvent.keyboard('{ArrowLeft}{ArrowUp}{PageUp}');
    await expect(thumb).toHaveAttribute('aria-valuenow', '61');
    await userEvent.keyboard('{ArrowDown}');
    await expect(thumb).toHaveAttribute('aria-valuenow', '60');
    const pointer = pointerHarness(controlOf(canvasElement));
    pointer.send('pointerdown', 0.2);
    pointer.send('pointerup', 0.2);
    await expect(thumb).toHaveAttribute('aria-valuenow', '80');
    await expect(args.onValueCommit).toHaveBeenLastCalledWith(80);
  },
};
export const Dark: Story = {};
export const LightTheme: Story = { decorators: [withLightTheme] };
export const ScopedTheme: Story = {
  render: (args) => (
    <ThemeRoot theme="light" sx={{ background: vars.color.bg, padding: vars.space[4] }}>
      <ElasticSlider {...args} />
    </ThemeRoot>
  ),
};
export const ReducedMotion: Story = {
  args: { marks: [50] },
  parameters: {
    docs: {
      description: {
        story:
          'Structural fixture. Enable reduced motion in browser QA to verify that stretch, swell, tilt and tick pop are off while detents still latch.',
      },
    },
  },
};
export const ForcedColors: Story = {
  args: { marks: [{ value: 50, label: 'Half' }] },
  parameters: {
    docs: {
      description: {
        story:
          'Structural fixture. Enable forced colors in browser QA to verify system-color rail, track, thumb, ticks and focus.',
      },
    },
  },
};
export const Keyboard: Story = {
  args: { defaultValue: 50 },
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    const thumb = canvas.getByRole('slider');
    await userEvent.tab();
    await expect(thumb.ownerDocument.activeElement).toBe(thumb);
    await expect(getComputedStyle(thumb).outlineStyle).not.toBe('none');
    await expect(Math.abs(parseFloat(getComputedStyle(thumb).outlineWidth) - 2)).toBeLessThan(1.1);
    const bubble = part(canvasElement, 'elastic-slider-bubble');
    await waitFor(async () => {
      await expect(Number(getComputedStyle(bubble).opacity)).toBeGreaterThan(0.99);
    });
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
    await userEvent.keyboard('{End}{ArrowRight}{PageUp}{Enter} ');
    await expect(args.onValueChange).toHaveBeenCalledTimes(moves.length);
    await expect(args.onValueCommit).toHaveBeenCalledTimes(moves.length);
    for (let index = 0; index < moves.length; index++) {
      await expect(args.onValueChange).toHaveBeenNthCalledWith(index + 1, moves[index]![1]);
      await expect(args.onValueCommit).toHaveBeenNthCalledWith(index + 1, moves[index]![1]);
    }
  },
};
export const PointerCancel: Story = {
  args: { defaultValue: 40 },
  play: async ({ canvas, canvasElement, args }) => {
    const control = controlOf(canvasElement);
    const pointer = pointerHarness(control);
    pointer.send('pointerdown', 0.5);
    await expect(control.hasPointerCapture(1)).toBe(true);
    await expect(canvas.getByRole('slider').ownerDocument.activeElement).toBe(canvas.getByRole('slider'));
    pointer.send('pointermove', 0.8, { pointerId: 2 });
    pointer.send('pointermove', 0.9, { pointerId: 3, isPrimary: false });
    await expect(canvas.getByRole('slider')).toHaveAttribute('aria-valuenow', '50');
    pointer.send('pointermove', 1.2);
    await expect(canvas.getByRole('slider')).toHaveAttribute('aria-valuenow', '100');
    pointer.send('pointercancel', 1.2);
    pointer.send('pointerup', 1.2);
    await expect(args.onValueChange).toHaveBeenCalledTimes(2);
    await expect(args.onValueCommit).not.toHaveBeenCalled();
    await expect(control.hasPointerCapture(1)).toBe(false);
  },
};
export const LostCapture: Story = {
  args: { defaultValue: 40 },
  play: async ({ canvasElement, args }) => {
    const control = controlOf(canvasElement);
    const pointer = pointerHarness(control);
    pointer.send('pointerdown', 0.6);
    pointer.send('lostpointercapture', 0.6);
    pointer.send('pointerup', 0.6);
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueCommit).not.toHaveBeenCalled();
    pointer.send('pointerdown', 0.7);
    pointer.send('pointerup', 0.7);
    pointer.send('lostpointercapture', 0.7);
    await expect(args.onValueCommit).toHaveBeenCalledTimes(1);
    await expect(args.onValueCommit).toHaveBeenCalledWith(70);
  },
};
export const RapidRegrab: Story = {
  args: { defaultValue: 40 },
  play: async ({ canvas, canvasElement, args }) => {
    const pointer = pointerHarness(controlOf(canvasElement));
    pointer.send('pointerdown', 0.2);
    pointer.send('pointerdown', 0.9, { pointerId: 2 });
    pointer.send('pointerup', 0.2);
    pointer.send('pointerdown', 0.6, { pointerId: 2 });
    pointer.send('pointermove', 0.65, { pointerId: 2 });
    pointer.send('pointerup', 0.65, { pointerId: 2 });
    await expect(canvas.getByRole('slider')).toHaveAttribute('aria-valuenow', '65');
    await expect(args.onValueChange).toHaveBeenCalledTimes(3);
    await expect(args.onValueCommit).toHaveBeenCalledTimes(2);
    await expect(args.onValueCommit).toHaveBeenNthCalledWith(1, 20);
    await expect(args.onValueCommit).toHaveBeenNthCalledWith(2, 65);
  },
};
export const ExternalDomainChange: Story = {
  args: { defaultValue: 10 },
  render: (args) => {
    const [marks, setMarks] = useState<readonly number[]>([50]);
    return (
      <>
        <ElasticSlider {...args} marks={marks} />
        <button css={buttonStyle} type="button" onClick={() => setMarks([75])}>
          Move detent
        </button>
      </>
    );
  },
  play: async ({ canvas, canvasElement, args }) => {
    const pointer = pointerHarness(controlOf(canvasElement));
    pointer.send('pointerdown', 0.5, { px: 3 });
    await expect(canvasElement.querySelector('[data-latched]')).not.toBeNull();
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    fireEvent.click(canvas.getByRole('button', { name: 'Move detent' }));
    await waitFor(async () => {
      await expect(canvasElement.querySelector('[data-latched]')).toBeNull();
    });
    await expect(canvas.getByRole('slider')).toHaveAttribute('aria-valuenow', '50');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    pointer.send('pointerup', 0.5, { px: 3 });
    await expect(args.onValueCommit).toHaveBeenCalledTimes(1);
    await expect(args.onValueCommit).toHaveBeenCalledWith(50);
  },
};
export const DisableDuringDrag: Story = {
  render: (args) => {
    const [disabled, setDisabled] = useState(false);
    return (
      <ElasticSlider
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
    const control = controlOf(canvasElement);
    const pointer = pointerHarness(control);
    pointer.send('pointerdown', 0.5);
    await expect(control.hasPointerCapture(1)).toBe(false);
    pointer.send('pointerup', 0.5);
    await expect(args.onValueCommit).not.toHaveBeenCalled();
  },
};
export const AriaMerge: Story = {
  args: {
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
      <ElasticSlider {...args} />
    </>
  ),
  play: async ({ canvas, canvasElement }) => {
    const thumb = canvas.getByRole('slider');
    await expect(thumb).toHaveAttribute('aria-label', 'Thumb name');
    await expect(thumb.getAttribute('aria-labelledby')).toContain('external-label missing-reference');
    await expect(thumb).toHaveAccessibleName('Audio Volume');
    await expect(thumb).toHaveAccessibleDescription('External help Thumb help Internal help Internal error');
    await expect(thumb).toHaveAttribute('aria-invalid', 'true');
    const root = part(canvasElement, 'elastic-slider');
    await expect(root).not.toHaveAttribute('aria-label');
    await expect(root).not.toHaveAttribute('aria-labelledby');
  },
};
export const InvalidPreserved: Story = {
  args: { slotProps: { thumb: { 'aria-invalid': 'grammar' } } },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('slider')).toHaveAttribute('aria-invalid', 'grammar');
  },
};
const falsyNodes: ReactNode[] = [false, null, 0, ''];
export const FalsyContent: Story = {
  args: { defaultValue: 0 },
  render: (args) => (
    <>
      {falsyNodes.map((node, index) => (
        <ElasticSlider
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
  play: async ({ canvas, canvasElement }) => {
    const thumbs = canvas.getAllByRole('slider');
    for (const [index, thumb] of thumbs.entries()) {
      await expect(thumb).toHaveAttribute('aria-valuenow', '0');
      if (falsyNodes[index] !== 0) await expect(thumb.getAttribute('aria-describedby')).toBeNull();
    }
    await expect(thumbs[2]).toHaveAccessibleDescription('0 0');
    await expect(thumbs[2]).toHaveAccessibleName('0');
    await expect(thumbs[0]!.getAttribute('aria-labelledby')).toBeNull();
    await expect(canvas.queryAllByRole('button')).toHaveLength(1);
    await expect(canvas.queryAllByRole('alert')).toHaveLength(1);
    await expect(canvasElement.querySelectorAll('[data-ui="elastic-slider-tick"]')).toHaveLength(4);
  },
};
export const SlotStylingAndRefs: Story = {
  args: {
    ref: fn(),
    marks: [25, 75],
    slotProps: {
      thumb: { ref: fn(), css: css({ borderRadius: vars.radius.md }) },
      track: { css: css({ borderRadius: vars.radius.sm }) },
      tick: (index) => ({ id: `tick-${index}` }),
      label: { css: css({ fontWeight: vars.fontWeight.semibold }) },
    },
  },
  play: async ({ canvas, canvasElement, args }) => {
    const root = part(canvasElement, 'elastic-slider');
    const thumb = canvas.getByRole('slider');
    await expect(args.ref).toHaveBeenCalledWith(root);
    await expect(args.slotProps?.thumb?.ref).toHaveBeenCalledWith(thumb);
    await expect(Math.abs(parseFloat(getComputedStyle(thumb).borderRadius) - 12)).toBeLessThan(1.1);
    const track = part(canvasElement, 'elastic-slider-track');
    await expect(Math.abs(parseFloat(getComputedStyle(track).borderTopLeftRadius) - 8)).toBeLessThan(1.1);
    const ticks = canvasElement.querySelectorAll('[data-ui="elastic-slider-tick"]');
    await expect(ticks[1]).toHaveAttribute('id', 'tick-1');
    await expect(getComputedStyle(canvasElement.querySelector('[id$="-label"]')!).fontWeight).toBe('600');
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

class ConfigurationBoundary extends Component<{ children: ReactNode }, { error: string | null }> {
  state: { error: string | null } = { error: null };
  static getDerivedStateFromError(error: Error) {
    return { error: error.message };
  }
  render() {
    return this.state.error ? <div role="alert">{this.state.error}</div> : this.props.children;
  }
}
const invalidConfigurations: ElasticSliderProps[] = [
  { label: 'Unaligned', min: 0, max: 1, step: 0.3 },
  { label: 'Zero step', step: 0 },
  { label: 'Infinite value', value: Infinity },
  { label: 'Large step', largeStep: -1 },
];
export const ConfigurationErrors: Story = {
  render: () => (
    <>
      {invalidConfigurations.map((props, index) => (
        <ConfigurationBoundary key={index}>
          <ElasticSlider {...props} />
        </ConfigurationBoundary>
      ))}
    </>
  ),
  play: async ({ canvas }) => {
    const errors = canvas.getAllByRole('alert');
    await expect(errors).toHaveLength(invalidConfigurations.length);
    await expect(errors[0]).toHaveTextContent('ElasticSlider requires finite min < max');
    await expect(errors[1]).toHaveTextContent('a positive step');
    await expect(errors[2]).toHaveTextContent('ElasticSlider values must be finite');
    await expect(errors[3]).toHaveTextContent('ElasticSlider largeStep must be finite and positive');
  },
};
