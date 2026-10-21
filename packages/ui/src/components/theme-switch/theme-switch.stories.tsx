import { useEffect, useState, type ComponentPropsWithRef } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, waitFor } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { withLightTheme } from '../../testing/story-decorators';
import { ThemeRoot } from '../theme-root';
import { ThemeSwitch, type ThemeSwitchProps, type ThemeSwitchValue } from './index';
// `styled` is the app-facing styling API; consumers import it from `@jfrader/ui`.
import { styled } from '../../index';

const ThemeFrame = styled.div({ backgroundColor: vars.color.bg, padding: vars.space[4] });

const FixtureButton = styled.button({ minHeight: vars.space[8] });

const meta = {
  title: 'Inputs/ThemeSwitch',
  component: ThemeSwitch,
  tags: ['autodocs'],
  args: { label: 'Dark appearance' },
  parameters: {
    docs: {
      sections: [
        { title: 'Apply appearance', stories: ['ScopedThemeRoot', 'ControlledAccept'] },
        { title: 'Transition cues', stories: ['DefaultReveal', 'Eclipse', 'Split', 'Rise'] },
        { title: 'Compact controls', stories: ['IconOnly'] },
      ],
      description: {
        component:
          'Switch between light and dark appearance.',
      },
      usage: `- Apply the requested theme in your app. ThemeSwitch does not manage system preferences or page transitions.
- Keep the accessible name the same in both states, including when the visible label is hidden.
- Space toggles the switch; Enter does not.`,
    },
  },
} satisfies Meta<typeof ThemeSwitch>;
export default meta;
type Story = StoryObj<typeof meta>;
const settle = () => new Promise((resolve) => setTimeout(resolve, 300));
const StackFrame = styled.div({ display: 'grid', gap: vars.space[4] });
const iconFrameOf = (input: HTMLElement) =>
  input.closest('[data-ui="theme-switch"]')!.querySelector<HTMLElement>('[data-ui="theme-switch-icon-frame"]')!;

function ReplacementIconFrame(props: ComponentPropsWithRef<'label'>) {
  return <label {...props} data-testid="replacement-icon-frame" />;
}
function ReplacementLightIcon(props: ComponentPropsWithRef<'span'>) {
  return <i {...props} data-testid="replacement-light-icon" />;
}
function ReplacementDarkIcon(props: ComponentPropsWithRef<'span'>) {
  return <i {...props} data-testid="replacement-dark-icon" />;
}

export const IconSlots: Story = {
  parameters: { docs: { source: { language: 'tsx', code: `import { useRef, type ComponentPropsWithRef } from 'react';
import { ThemeSwitch } from '@jfrader/ui';

function IconFrame(props: ComponentPropsWithRef<'label'>) {
  return <label {...props} />;
}
function LightIcon(props: ComponentPropsWithRef<'span'>) {
  return <i {...props} />;
}
function DarkIcon(props: ComponentPropsWithRef<'span'>) {
  return <i {...props} />;
}

export function Appearance() {
  const frameRef = useRef<HTMLLabelElement>(null);
  const lightRef = useRef<HTMLSpanElement>(null);
  const darkRef = useRef<HTMLSpanElement>(null);
  return (
    <ThemeSwitch
      label="Dark appearance"
      slots={{ iconFrame: IconFrame, lightIcon: LightIcon, darkIcon: DarkIcon }}
      slotProps={{
        iconFrame: { className: 'custom-icon-frame', title: 'Theme icon', ref: frameRef },
        lightIcon: { className: 'custom-light-icon', title: 'Light icon', ref: lightRef },
        darkIcon: { className: 'custom-dark-icon', title: 'Dark icon', ref: darkRef },
      }}
    />
  );
}` } } },
  args: {
    slots: { iconFrame: ReplacementIconFrame, lightIcon: ReplacementLightIcon, darkIcon: ReplacementDarkIcon },
    slotProps: {
      iconFrame: { className: 'custom-icon-frame', title: 'Theme icon', ref: fn() },
      lightIcon: { className: 'custom-light-icon', title: 'Light icon', ref: fn() },
      darkIcon: { className: 'custom-dark-icon', title: 'Dark icon', ref: fn() },
    },
  },
  play: async ({ canvas, canvasElement, args, userEvent }) => {
    const input = canvas.getByRole('switch');
    const frame = canvas.getByTestId('replacement-icon-frame');
    const light = canvas.getByTestId('replacement-light-icon');
    const dark = canvas.getByTestId('replacement-dark-icon');
    for (const [key, element, marker, title] of [
      ['iconFrame', frame, 'icon-frame', 'Theme icon'],
      ['lightIcon', light, 'light-icon', 'Light icon'],
      ['darkIcon', dark, 'dark-icon', 'Dark icon'],
    ] as const) {
      await expect(element).toHaveAttribute('data-ui', `theme-switch-${marker}`);
      await expect(element).toHaveClass(`custom-${marker}`);
      await expect(element.className).toMatch(/css-/);
      await expect(element).toHaveAttribute('title', title);
      await expect(element).toHaveAttribute('data-animated', 'false');
      await expect(args.slotProps?.[key]?.ref).toHaveBeenCalledWith(element);
      await expect(canvasElement.querySelectorAll(`[data-ui="theme-switch-${marker}"]`)).toHaveLength(1);
    }
    await expect(frame).toHaveAttribute('for', input.id);
    await expect(frame).toHaveAttribute('aria-hidden', 'true');
    await expect(frame).toHaveAttribute('data-value', 'light');
    await expect(light.tagName).toBe('I');
    await expect(dark.tagName).toBe('I');
    await expect(frame.querySelectorAll('span')).toHaveLength(0);
    await expect(light).toHaveAttribute('data-active', 'true');
    await expect(dark).toHaveAttribute('data-active', 'false');
    await userEvent.click(frame);
    await expect(input).toBeChecked();
    await expect(frame).toHaveAttribute('data-value', 'dark');
    await expect(light).toHaveAttribute('data-active', 'false');
    await expect(dark).toHaveAttribute('data-active', 'true');
  },
};

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
    <StackFrame>
      <FixtureButton type="button" onClick={() => setValue('dark')}>
        Apply dark preference
      </FixtureButton>
      <ThemeSwitch {...args} value={value} />
    </StackFrame>
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
    <ThemeRoot theme={value}><ThemeFrame>
      <ThemeSwitch {...args} value={value} onValueChange={setValue} />
    </ThemeFrame></ThemeRoot>
  );
}
export const DefaultReveal: Story = {
  name: 'Reveal cue',
  parameters: { docs: {
    description: { story: 'Toggle the switch to reveal the active appearance icon.' },
    source: { language: 'tsx', code: `import { ThemeSwitch } from '@jfrader/ui';

<ThemeSwitch label="Dark appearance" />` },
  } },
};
export const Eclipse: Story = {
  name: 'Eclipse cue',
  parameters: { docs: {
    description: { story: 'Toggle the switch to move the icon sideways with an eclipse cue.' },
    source: { language: 'tsx', code: `import { ThemeSwitch } from '@jfrader/ui';

<ThemeSwitch label="Dark appearance" transition="eclipse" />` },
  } },
  args: { transition: 'eclipse' },
};
export const Split: Story = {
  name: 'Split cue',
  parameters: { docs: {
    description: { story: 'Toggle the switch to try the split icon cue.' },
    source: { language: 'tsx', code: `import { ThemeSwitch } from '@jfrader/ui';

<ThemeSwitch label="Dark appearance" transition="split" />` },
  } },
  args: { transition: 'split' },
};
export const Rise: Story = {
  name: 'Rise cue',
  parameters: { docs: {
    description: { story: 'Toggle the switch to lift the active appearance icon.' },
    source: { language: 'tsx', code: `import { ThemeSwitch } from '@jfrader/ui';

<ThemeSwitch label="Dark appearance" transition="rise" />` },
  } },
  args: { transition: 'rise' },
};
export const TransitionCues: Story = {
  render: (args) => (
    <StackFrame>
      {(['reveal', 'eclipse', 'split', 'rise'] as const).map((transition) => (
        <ThemeSwitch {...args} key={transition} transition={transition} />
      ))}
    </StackFrame>
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
    await expect(frame.getBoundingClientRect().width).toBeGreaterThanOrEqual(32);
    await expect(frame.getBoundingClientRect().height).toBeGreaterThanOrEqual(32);
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
  name: 'Icon-only controls',
  parameters: { docs: {
    description: { story: 'Compare all four cues with the visible label hidden and the accessible name retained.' },
    source: { language: 'tsx', code: `import { ThemeSwitch, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const Stack = styled.div({ display: 'grid', gap: vars.space[4] });

<Stack>
  <ThemeSwitch label="Dark appearance" iconOnly transition="reveal" />
  <ThemeSwitch label="Dark appearance" iconOnly transition="eclipse" />
  <ThemeSwitch label="Dark appearance" iconOnly transition="split" />
  <ThemeSwitch label="Dark appearance" iconOnly transition="rise" />
</Stack>` },
  } },
  args: { iconOnly: true },
  render: (args) => (
    <StackFrame>
      {(['reveal', 'eclipse', 'split', 'rise'] as const).map((transition) => (
        <ThemeSwitch {...args} key={transition} transition={transition} />
      ))}
    </StackFrame>
  ),
  play: async ({ canvas }) => {
    for (const input of canvas.getAllByRole('switch'))
      await expect(input).toHaveAccessibleName('Dark appearance');
  },
};
export const AllSizes: Story = {
  render: (args) => (
    <StackFrame>
      {(['sm', 'md'] as const).map((size) => (
        <ThemeSwitch {...args} key={size} size={size} />
      ))}
    </StackFrame>
  ),
  play: async ({ canvas }) => {
    for (const input of canvas.getAllByRole('switch')) {
      const root = input.closest('[data-ui="switch"]')!;
      await expect(root.getBoundingClientRect().height).toBeGreaterThanOrEqual(31);
      const frame = iconFrameOf(input);
      await expect(frame.getBoundingClientRect().width).toBeGreaterThanOrEqual(32);
      await expect(frame.getBoundingClientRect().height).toBeGreaterThanOrEqual(32);
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
  name: 'App-owned preference',
  args: { onValueChange: fn() },
  render: (args) => <ControlledExample {...args} />,
  parameters: {
    docs: {
      description: { story: 'Store the requested appearance in React state without applying it to the page.' },
      source: {
        language: 'tsx',
        code: `import { useState } from 'react';
import { ThemeSwitch, type ThemeSwitchValue } from '@jfrader/ui';

export function AppearancePreference() {
  const [appearance, setAppearance] = useState<ThemeSwitchValue>('light');
  return <ThemeSwitch label="Dark appearance" value={appearance} onValueChange={setAppearance} />;
}`,
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
  parameters: { docs: { source: { language: 'tsx', code: `import { useRef } from 'react';
import { ThemeSwitch } from '@jfrader/ui';

export function Appearance() {
  const inputRef = useRef<HTMLInputElement>(null);
  return <ThemeSwitch ref={inputRef} label="Dark appearance" />;
}` } } },
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
    <StackFrame>
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
    </StackFrame>
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
// This story tests the documented css/slot API and native style merging.
export const SlotStyling: Story = {
  args: {
    sx: { paddingInline: vars.space[4] },
    slotProps: {
      iconFrame: { sx: { inlineSize: vars.space[8] } },
      lightIcon: { sx: { outline: `2px solid ${vars.color.text}` } },
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
          'Enable reduced motion to check that the icon changes immediately. This story does not enable media preferences.',
      },
    },
  },
  args: { transition: 'rise' },
};
export const ForcedColors: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Enable forced colors to check rendering. This story does not enable forced colors.',
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
  name: 'Switch a themed section',
  render: (args) => <ScopedExample {...args} />,
  parameters: {
    docs: {
      description: { story: 'Toggle Dark appearance to update the surrounding section’s theme.' },
      source: {
        language: 'tsx',
        code: `import { useState } from 'react';
import { ThemeRoot, ThemeSwitch, styled, type ThemeSwitchValue } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const Frame = styled.div({ backgroundColor: vars.color.bg, padding: vars.space[4] });

export function AppearanceSection() {
  const [appearance, setAppearance] = useState<ThemeSwitchValue>('light');
  return (
    <ThemeRoot theme={appearance}>
      <Frame><ThemeSwitch label="Dark appearance" value={appearance} onValueChange={setAppearance} /></Frame>
    </ThemeRoot>
  );
}`,
      },
    },
  },
};
