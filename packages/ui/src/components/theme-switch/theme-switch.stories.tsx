import { useEffect, useState } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, waitFor } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { withLightTheme } from '../../testing/story-decorators';
import { ThemeRoot } from '../theme-root';
import { ThemeSwitch, type ThemeSwitchProps, type ThemeSwitchValue } from './index';

const meta = {
  title: 'Inputs/ThemeSwitch',
  component: ThemeSwitch,
  tags: ['autodocs'],
  args: { label: 'Dark appearance' },
  parameters: {
    docs: {
      description: {
        component:
          'A binary appearance preference composed with Switch. Space toggles; Enter does not. The accessible name stays stable. The ref reaches the native input. The application applies the theme; system preference and page transitions are not managed here.',
      },
    },
  },
} satisfies Meta<typeof ThemeSwitch>;
export default meta;
type Story = StoryObj<typeof meta>;
const settle = () => new Promise((resolve) => setTimeout(resolve, 300));
const stack = { display: 'grid', gap: vars.space[4] };
const iconFrameOf = (input: HTMLElement) =>
  input.closest('[data-ui="theme-switch"]')!.querySelector<HTMLElement>('[data-ui="theme-switch-icon-frame"]')!;

function ControlledExample(args: ThemeSwitchProps) {
  const [value, setValue] = useState<ThemeSwitchValue>('light');
  return (
    <ThemeSwitch
      {...args}
      value={value}
      onValueChange={(next, details) => {
        setValue(next);
        args.onValueChange?.(next, details);
      }}
    />
  );
}
function ExternalExample(args: ThemeSwitchProps) {
  const [value, setValue] = useState<ThemeSwitchValue>('light');
  return (
    <div style={stack}>
      <button type="button" style={{ minHeight: vars.space[8] }} onClick={() => setValue('dark')}>
        Apply dark preference
      </button>
      <ThemeSwitch {...args} value={value} />
    </div>
  );
}
/** Server and first client render agree on light; a stored dark preference is applied after mount. */
function HydrationExample(args: ThemeSwitchProps) {
  const [value, setValue] = useState<ThemeSwitchValue>('light');
  useEffect(() => setValue('dark'), []);
  return <ThemeSwitch {...args} value={value} />;
}
function ScopedExample(args: ThemeSwitchProps) {
  const [value, setValue] = useState<ThemeSwitchValue>('light');
  return (
    <ThemeRoot theme={value} sx={{ backgroundColor: vars.color.bg, padding: vars.space[4] }}>
      <ThemeSwitch {...args} value={value} onValueChange={setValue} />
    </ThemeRoot>
  );
}
export const DefaultReveal: Story = {};
export const Eclipse: Story = { args: { transition: 'eclipse' } };
export const Split: Story = { args: { transition: 'split' } };
export const Rise: Story = { args: { transition: 'rise' } };
export const TransitionCues: Story = {
  render: (args) => (
    <div style={stack}>
      {(['reveal', 'eclipse', 'split', 'rise'] as const).map((transition) => (
        <ThemeSwitch {...args} key={transition} transition={transition} />
      ))}
    </div>
  ),
  play: async ({ canvas, userEvent }) => {
    const inputs = canvas.getAllByRole('switch');
    for (const input of inputs) await userEvent.click(input);
    await settle();
    const reduced = inputs[0]!.ownerDocument.defaultView!.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const expected = [
      { scale: 1.08, x: 0, y: 0 },
      { scale: 1, x: -2, y: 0 },
      { scale: 1, x: 1, y: 0 },
      { scale: 1, x: 0, y: -2 },
    ];
    for (const [index, input] of inputs.entries()) {
      const root = input.closest('[data-ui="theme-switch"]')!;
      const frame = root.querySelector('[data-ui="theme-switch-icon-frame"]')!;
      const matrix = new DOMMatrixReadOnly(getComputedStyle(frame).transform);
      await expect(matrix.a).toBeCloseTo(reduced ? 1 : expected[index]!.scale, 1);
      await expect(matrix.m41).toBeCloseTo(reduced ? 0 : expected[index]!.x, 0);
      await expect(matrix.m42).toBeCloseTo(reduced ? 0 : expected[index]!.y, 0);
      await expect(getComputedStyle(root.querySelector('[data-ui="theme-switch-dark-icon"]')!).opacity).toBe('1');
      await expect(getComputedStyle(root.querySelector('[data-ui="theme-switch-light-icon"]')!).opacity).toBe('0');
    }
  },
};
export const IconClick: Story = {
  args: { onValueChange: fn() },
  play: async ({ canvas, args, userEvent }) => {
    const input = canvas.getByRole('switch');
    const frame = iconFrameOf(input);
    await expect(frame.tagName).toBe('LABEL');
    await expect(frame).toHaveAttribute('aria-hidden', 'true');
    await expect(frame).toHaveAttribute('for', input.id);
    await expect(frame.compareDocumentPosition(input) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    await userEvent.click(frame.querySelector('[data-ui="theme-switch-light-icon"]')!);
    await expect(input).toBeChecked();
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenCalledWith('dark', expect.objectContaining({ trigger: input }));
    await userEvent.click(frame);
    await expect(input).not.toBeChecked();
    await expect(args.onValueChange).toHaveBeenCalledTimes(2);
    await expect(input).toHaveAccessibleName('Dark appearance');
  },
};
export const LightValue: Story = { args: { value: 'light' } };
export const DarkValue: Story = { args: { value: 'dark' } };
export const IconOnly: Story = {
  args: { iconOnly: true },
  render: (args) => (
    <div style={stack}>
      {(['reveal', 'eclipse', 'split', 'rise'] as const).map((transition) => (
        <ThemeSwitch {...args} key={transition} transition={transition} />
      ))}
    </div>
  ),
  play: async ({ canvas }) => {
    for (const input of canvas.getAllByRole('switch'))
      await expect(input).toHaveAccessibleName('Dark appearance');
  },
};
export const AllSizes: Story = {
  render: (args) => (
    <div style={stack}>
      {(['sm', 'md'] as const).map((size) => (
        <ThemeSwitch {...args} key={size} size={size} />
      ))}
    </div>
  ),
  play: async ({ canvas }) => {
    for (const input of canvas.getAllByRole('switch')) {
      const root = input.closest('[data-ui="switch"]')!;
      await expect(root.getBoundingClientRect().height).toBeGreaterThanOrEqual(31);
    }
  },
};
export const Uncontrolled: Story = {
  args: { defaultValue: 'dark', onValueChange: fn() },
  play: async ({ canvas, args, userEvent }) => {
    const input = canvas.getByRole('switch');
    await expect(input).toBeChecked();
    await userEvent.click(input);
    await expect(input).not.toBeChecked();
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenCalledWith('light', {
      transition: 'reveal',
      trigger: input,
      reducedMotion: input.ownerDocument.defaultView!.matchMedia('(prefers-reduced-motion: reduce)').matches,
    });
  },
};
export const ControlledAccept: Story = {
  args: { onValueChange: fn() },
  render: (args) => <ControlledExample {...args} />,
  parameters: {
    docs: {
      source: {
        code: '<ThemeSwitch label="Dark appearance" value={appearance} onValueChange={setAppearance} />',
      },
    },
  },
  play: async ({ canvas, args, userEvent }) => {
    const input = canvas.getByRole('switch');
    await userEvent.click(input);
    await expect(input).toBeChecked();
    await userEvent.keyboard('[Space]');
    await expect(input).not.toBeChecked();
    await expect(args.onValueChange).toHaveBeenCalledTimes(2);
    await expect(args.onValueChange).toHaveBeenNthCalledWith(
      2,
      'light',
      expect.objectContaining({ trigger: input }),
    );
  },
};
export const ControlledReject: Story = {
  args: { value: 'light', onValueChange: fn() },
  play: async ({ canvas, args, userEvent }) => {
    const input = canvas.getByRole('switch');
    await userEvent.click(input);
    await expect(input).not.toBeChecked();
    await expect(input.closest('[data-ui="theme-switch"]')).toHaveAttribute('data-value', 'light');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenCalledWith(
      'dark',
      expect.objectContaining({ trigger: input }),
    );
    await expect(canvas.getByRole('switch', { name: 'Dark appearance' })).toBe(input);
  },
};
export const ExternalUpdate: Story = {
  args: { onValueChange: fn() },
  render: (args) => <ExternalExample {...args} />,
  play: async ({ canvas, args, userEvent }) => {
    await userEvent.click(canvas.getByRole('button'));
    const input = canvas.getByRole('switch');
    await expect(input).toBeChecked();
    await expect(args.onValueChange).not.toHaveBeenCalled();
    const frame = input
      .closest('[data-ui="theme-switch"]')!
      .querySelector('[data-ui="theme-switch-icon-frame"]')!;
    await expect(getComputedStyle(frame).transitionDuration).toBe('0s');
  },
};
export const Keyboard: Story = {
  args: { onValueChange: fn(), onClick: fn(), ref: fn() },
  play: async ({ canvas, args, userEvent }) => {
    const input = canvas.getByRole('switch');
    await expect(args.ref).toHaveBeenCalledWith(input);
    await userEvent.tab();
    await expect(input.ownerDocument.activeElement).toBe(input);
    await expect(getComputedStyle(input.nextElementSibling!).outlineStyle).not.toBe('none');
    await userEvent.keyboard('[Enter]');
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await userEvent.keyboard('[Space]');
    await expect(input).toBeChecked();
    await expect(args.onClick).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(input).toHaveAccessibleName('Dark appearance');
    await userEvent.keyboard('[Space]');
    await expect(input).not.toBeChecked();
    await expect(args.onValueChange).toHaveBeenCalledTimes(2);
    await userEvent.tab({ shift: true });
    await expect(input.ownerDocument.activeElement).not.toBe(input);
  },
};
export const Disabled: Story = {
  args: { disabled: true, onValueChange: fn() },
  play: async ({ canvas, args, userEvent }) => {
    const input = canvas.getByRole('switch');
    await userEvent.click(input);
    await userEvent.click(iconFrameOf(input));
    await expect(input).toBeDisabled();
    await expect(input).not.toBeChecked();
    await expect(args.onValueChange).not.toHaveBeenCalled();
  },
};
export const Loading: Story = {
  args: { loading: true, value: 'dark', onValueChange: fn() },
  play: async ({ canvas, args, userEvent }) => {
    const input = canvas.getByRole('switch');
    await userEvent.tab();
    await expect(input.ownerDocument.activeElement).toBe(input);
    await userEvent.keyboard('[Space]');
    await userEvent.click(input);
    await userEvent.click(iconFrameOf(input));
    await expect(input).toBeChecked();
    await expect(input).toHaveAttribute('aria-busy', 'true');
    await expect(args.onValueChange).not.toHaveBeenCalled();
  },
};
export const AriaDisabled: Story = {
  args: { 'aria-disabled': true, onValueChange: fn(), value: 'dark' },
  play: async ({ canvas, args, userEvent }) => {
    const input = canvas.getByRole('switch');
    await userEvent.click(input);
    await userEvent.keyboard('[Space]');
    await expect(input).toBeChecked();
    await expect(args.onValueChange).not.toHaveBeenCalled();
  },
};
export const PreventedClick: Story = {
  args: { onClick: (event) => event.preventDefault(), onValueChange: fn() },
  play: async ({ canvas, args, userEvent }) => {
    const input = canvas.getByRole('switch');
    await userEvent.click(input);
    await expect(input).not.toBeChecked();
    await expect(args.onValueChange).not.toHaveBeenCalled();
  },
};
export const HydrationCorrection: Story = {
  args: { onValueChange: fn() },
  render: (args) => <HydrationExample {...args} />,
  parameters: {
    docs: {
      source: {
        code: '<ThemeSwitch label="Dark appearance" value={appearance} onValueChange={setAppearance} />',
      },
    },
  },
  play: async ({ canvas, canvasElement, args }) => {
    const input = canvas.getByRole('switch');
    await expect(input).toBeChecked();
    await expect(input).toHaveAccessibleName('Dark appearance');
    await expect(iconFrameOf(input)).toHaveAttribute('data-animated', 'false');
    await expect(getComputedStyle(iconFrameOf(input)).transitionDuration).toBe('0s');
    await expect(args.onValueChange).not.toHaveBeenCalled();

    const markup = renderToString(<HydrationExample {...args} />);
    await expect(markup).toContain('data-value="light"');
    await expect(markup).not.toContain('checked=""');
    const host = canvasElement.ownerDocument.createElement('div');
    host.innerHTML = markup;
    canvasElement.append(host);
    const onRecoverableError = fn();
    const root = hydrateRoot(host, <HydrationExample {...args} />, { onRecoverableError });
    try {
      const hydrated = host.querySelector<HTMLInputElement>('[role="switch"]')!;
      await waitFor(() => expect(hydrated).toBeChecked());
      await expect(host.querySelector('[role="switch"]')).toBe(hydrated);
      await expect(hydrated).toHaveAccessibleName('Dark appearance');
      await expect(iconFrameOf(hydrated)).toHaveAttribute('data-animated', 'false');
      await expect(onRecoverableError).not.toHaveBeenCalled();
      await expect(args.onValueChange).not.toHaveBeenCalled();
    } finally {
      root.unmount();
      host.remove();
    }
  },
};
export const ExternalAria: Story = {
  args: {
    'aria-label': 'Explicit name',
    'aria-labelledby': 'external-name missing-name',
    'aria-describedby': 'external-description missing-description',
    description: 'Local description',
  },
  render: (args) => (
    <>
      <span id="external-name">Appearance</span>
      <span id="external-description">External description</span>
      <ThemeSwitch {...args} />
    </>
  ),
  play: async ({ canvas }) => {
    const input = canvas.getByRole('switch');
    await expect(input).toHaveAttribute('aria-label', 'Explicit name');
    await expect(input.getAttribute('aria-labelledby')).toContain('external-name missing-name');
    await expect(input.getAttribute('aria-describedby')).toContain(
      'external-description missing-description',
    );
    await expect(input).toHaveAccessibleName('Appearance Dark appearance');
    await expect(input).toHaveAccessibleDescription('External description Local description');
  },
};
export const FalsySlots: Story = {
  render: (args) => (
    <div style={stack}>
      {[false, null, 0, ''].map((node, index) => (
        <ThemeSwitch
          {...args}
          key={index}
          label={node}
          lightIcon={node}
          darkIcon={node}
          description={node}
          aria-label="Appearance"
        />
      ))}
    </div>
  ),
  play: async ({ canvas }) => {
    for (const [index, input] of canvas.getAllByRole('switch').entries()) {
      const root = input.closest('[data-ui="theme-switch"]')!;
      if (index === 2) {
        await expect(root.querySelector('[data-ui="theme-switch-light-icon"]')).toHaveTextContent('0');
        await expect(input).toHaveAttribute('aria-labelledby');
      } else {
        await expect(root.querySelector('[data-ui="theme-switch-icon-frame"]')).toBeNull();
        await expect(input).not.toHaveAttribute('aria-labelledby');
        await expect(input).not.toHaveAttribute('aria-describedby');
      }
    }
  },
};
export const SlotStyling: Story = {
  args: {
    sx: { paddingInline: vars.space[4] },
    slotProps: {
      iconFrame: { css: { inlineSize: vars.space[8] } },
      lightIcon: { css: { outline: `2px solid ${vars.color.text}` } },
    },
  },
  play: async ({ canvas }) => {
    const root = canvas.getByRole('switch').closest('[data-ui="theme-switch"]')!;
    await expect(parseFloat(getComputedStyle(root).paddingInlineStart)).toBeCloseTo(16, 0);
    await expect(
      root.querySelector('[data-ui="theme-switch-icon-frame"]')!.getBoundingClientRect().width,
    ).toBeCloseTo(32, 0);
    await expect(
      getComputedStyle(root.querySelector('[data-ui="theme-switch-light-icon"]')!).outlineStyle,
    ).toBe('solid');
  },
};
export const RTL: Story = {
  args: { dir: 'rtl', transition: 'eclipse' },
  play: async ({ canvas, userEvent }) => {
    const input = canvas.getByRole('switch');
    await userEvent.click(input);
    await settle();
    const frame = input
      .closest('[data-ui="theme-switch"]')!
      .querySelector('[data-ui="theme-switch-icon-frame"]')!;
    const reduced = input.ownerDocument.defaultView!.matchMedia('(prefers-reduced-motion: reduce)').matches;
    await expect(new DOMMatrixReadOnly(getComputedStyle(frame).transform).m41).toBeCloseTo(
      reduced ? 0 : 2,
      0,
    );
  },
};
export const ReducedMotion: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Use an OS or browser reduced-motion preference to inspect the instant icon swap. This story does not emulate media preferences.',
      },
    },
  },
  args: { transition: 'rise' },
};
export const ForcedColors: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Inspect with forced colors enabled. This story does not emulate forced colors.',
      },
    },
  },
  args: { defaultValue: 'dark' },
};
export const LightTheme: Story = {
  decorators: [withLightTheme],
  globals: { theme: 'light' },
  args: { defaultValue: 'dark' },
};
export const ScopedThemeRoot: Story = {
  render: (args) => <ScopedExample {...args} />,
  parameters: {
    docs: {
      source: {
        code: '<ThemeRoot theme={appearance}><ThemeSwitch label="Dark appearance" value={appearance} onValueChange={setAppearance} /></ThemeRoot>',
      },
    },
  },
};
