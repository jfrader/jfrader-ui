import {
  useRef,
  useState,
  type ComponentProps,
  type ComponentPropsWithRef,
} from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fireEvent, fn, spyOn, waitFor, within } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { styled } from '../../styling/styled';
import { ThemeRoot } from '../theme-root';
import { Button } from '../button';
import { ColorPicker, type ColorPickerMessages } from './index';
import {
  contrastColor,
  contrastGrade,
  fromChannels,
  parseColor,
  serializeColor,
} from './color-adapter';
import { EyeDropperCapability } from './eye-dropper-capability';

const messages: ColorPickerMessages = {
  dialog: 'Choose a color',
  saturation: 'Saturation',
  value: 'Value',
  hue: 'Hue',
  opacity: 'Opacity',
  format: 'Format',
  color: 'Color',
  invalid: 'Enter a HEX, RGB, HSL or OKLCH color.',
  gamutWarning:
    'Mapped to the sRGB gamut. The original OKLCH color is not preserved.',
  save: 'Save color',
  savedColors: 'Saved colors',
  movePrevious: 'Move previous',
  moveNext: 'Move next',
  remove: 'Remove color',
  eyeDropper: 'Pick from screen',
  eyeDropperError: 'Could not read the screen color.',
  done: 'Done',
  empty: 'No valid color',
  grades: {
    aaa: 'AAA normal text',
    aa: 'AA normal text',
    large: 'AA large text only',
    fail: 'Below AA text thresholds',
  },
  contrast: (ratio, grade) => `${ratio}:1 — ${grade}`,
  result: (hex, contrast) => contrast ? `Color: ${hex}. ${contrast}` : `Color: ${hex}`,
  swatch: (hex, label) => (label ? `${label} ${hex}` : hex),
};
const palette = [
  { id: 'violet', color: '#A78BFF', label: 'Violet' },
  { id: 'white', color: '#FFFFFF', label: 'White' },
  { id: 'black', color: '#000000', label: 'Black' },
];
const Grid = styled.div({ display: 'grid', gap: vars.space[4] });
const NarrowFrame = styled.div({ inlineSize: '15rem' });
const ThemeFrame = styled.div({
  backgroundColor: vars.color.bg,
  padding: vars.space[4],
});
const meta = {
  title: 'Inputs/ColorPicker',
  component: ColorPicker,
  tags: ['autodocs'],
  args: {
    label: 'Accent',
    defaultValue: '#A78BFF',
    messages,
    onValueChange: fn(),
    onOpenChange: fn(),
    onFormatChange: fn(),
    onSwatchesChange: fn(),
  },
  parameters: {
    docs: {
      description: {
        component:
          'Choose a color, adjust its channels and save colors for later.',
      },
      usage: `### Values
Pass a controlled \`value\` or an uncontrolled \`defaultValue\`. Accepts HEX, RGB, HSL and OKLCH syntax. Changes emit uppercase sRGB #RRGGBB or #RRGGBBAA; equivalent colors emit no change. Controlled requests do not update the committed color until accepted. Open, format and saved colors have independent controlled/default pairs. Do not switch modes.

Out-of-gamut colors use Culori perceptual sRGB mapping in OKLCH. The warning reports mapping, not preservation of the original color. Channel editing retains precision between hex emissions. Achromatic hue edits retain editing intent.

### Contrast
Supply an opaque \`background\` to show the WCAG luminance ratio after foreground alpha compositing. Missing, invalid or translucent backgrounds hide the result. Categories use the unrounded ratio: 7 AAA normal text, 4.5 AA normal text, 3 AA large text. This evaluates this color pair for text, not the accessibility of a whole interface.

### Keyboard
The picker is a modal dialog: focus moves inside on open, Tab stays in the dialog, Escape closes and focus returns to the trigger. Saturation and Value are separate native sliders, not a two-dimensional ARIA slider. Arrows step by one, Shift+arrows and PageUp/Down by ten, Home/End reach bounds. Inline arrows follow RTL; the visual pad remains left-to-right.

Enter or blur commits valid text. Invalid text remains visible. Escape first discards a dirty draft, then closes the dialog and restores trigger focus after acceptance. Done validates before closing. Format changes validate first.

Saved colors use a horizontal listbox: arrows, Home and End move focus without selecting; Enter/Space applies. Alt+inline arrows reorder; Delete/Backspace removes. Move and Remove buttons offer the same actions. Saving at capacity evicts the oldest. IDs must be unique.

### Forms and environments
\`name\` adds a canonical hidden field; disabled fields are omitted. Invalid external values serialize as an empty value, never invalid text. Reset restores uncontrolled seeds; controlled axes receive explicit reset requests when a default is supplied. Read-only allows inspection but blocks edits. Required is semantic and does not enforce color validation.

The optional eyedropper is feature-detected, preserves alpha and ignores stale results. Provide every message and formatter for your locale; CSS syntax always uses ASCII decimal points. Test sliders with touch assistive technology before production. Screen-reader, forced-colors and reduced-motion manual checks are not yet recorded for this component.`,
      source: {
        code: '<ColorPicker label="Accent" defaultValue="#A78BFF" background="#08090A" messages={colorMessages} onValueChange={saveAccent} />',
      },
    },
  },
} satisfies Meta<typeof ColorPicker>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const EveryFormat: Story = {
  render: (args) => (
    <Grid>
      {(['hex', 'rgb', 'hsl', 'oklch'] as const).map((format) => (
        <ColorPicker
          {...args}
          key={format}
          label={format.toUpperCase()}
          defaultFormat={format}
        />
      ))}
    </Grid>
  ),
};
export const Transparent: Story = {
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { ColorPicker, type ColorPickerMessages } from '@jfrader/ui';

const messages: ColorPickerMessages = {
  dialog: 'Choose a color',
  saturation: 'Saturation',
  value: 'Value',
  hue: 'Hue',
  opacity: 'Opacity',
  format: 'Format',
  color: 'Color',
  invalid: 'Enter a HEX, RGB, HSL or OKLCH color.',
  gamutWarning: 'Mapped to the sRGB gamut. The original OKLCH color is not preserved.',
  save: 'Save color',
  savedColors: 'Saved colors',
  movePrevious: 'Move previous',
  moveNext: 'Move next',
  remove: 'Remove color',
  eyeDropper: 'Pick from screen',
  eyeDropperError: 'Could not read the screen color.',
  done: 'Done',
  empty: 'No valid color',
  grades: {
    aaa: 'AAA normal text',
    aa: 'AA normal text',
    large: 'AA large text only',
    fail: 'Below AA text thresholds',
  },
  contrast: (ratio, grade) => \`\${ratio}:1 — \${grade}\`,
  result: (hex, contrast) => (contrast ? \`Color: \${hex}. \${contrast}\` : \`Color: \${hex}\`),
  swatch: (hex, label) => (label ? \`\${label} \${hex}\` : hex),
};

<ColorPicker label="Accent" defaultValue="#A78BFF80" background="#08090A" messages={messages} />`,
      },
    },
  },
  args: { defaultValue: '#A78BFF80', background: '#08090A' },
};
export const AchromaticHue: Story = { parameters: { docs: { source: { language: 'tsx', code: `import { ColorPicker, type ColorPickerMessages } from '@jfrader/ui';

const messages: ColorPickerMessages = {
  dialog: 'Choose a color',
  saturation: 'Saturation',
  value: 'Value',
  hue: 'Hue',
  opacity: 'Opacity',
  format: 'Format',
  color: 'Color',
  invalid: 'Enter a HEX, RGB, HSL or OKLCH color.',
  gamutWarning: 'Mapped to the sRGB gamut. The original OKLCH color is not preserved.',
  save: 'Save color',
  savedColors: 'Saved colors',
  movePrevious: 'Move previous',
  moveNext: 'Move next',
  remove: 'Remove color',
  eyeDropper: 'Pick from screen',
  eyeDropperError: 'Could not read the screen color.',
  done: 'Done',
  empty: 'No valid color',
  grades: {
    aaa: 'AAA normal text',
    aa: 'AA normal text',
    large: 'AA large text only',
    fail: 'Below AA text thresholds',
  },
  contrast: (ratio, grade) => \`\${ratio}:1 — \${grade}\`,
  result: (hex, contrast) => (contrast ? \`Color: \${hex}. \${contrast}\` : \`Color: \${hex}\`),
  swatch: (hex, label) => (label ? \`\${label} \${hex}\` : hex),
};

<ColorPicker label="Accent" defaultValue="#808080" messages={messages} />` } } }, args: { defaultValue: '#808080' } };
export const CustomBackground: Story = { parameters: { docs: { source: { language: 'tsx', code: `import { ColorPicker, type ColorPickerMessages } from '@jfrader/ui';

const messages: ColorPickerMessages = {
  dialog: 'Choose a color',
  saturation: 'Saturation',
  value: 'Value',
  hue: 'Hue',
  opacity: 'Opacity',
  format: 'Format',
  color: 'Color',
  invalid: 'Enter a HEX, RGB, HSL or OKLCH color.',
  gamutWarning: 'Mapped to the sRGB gamut. The original OKLCH color is not preserved.',
  save: 'Save color',
  savedColors: 'Saved colors',
  movePrevious: 'Move previous',
  moveNext: 'Move next',
  remove: 'Remove color',
  eyeDropper: 'Pick from screen',
  eyeDropperError: 'Could not read the screen color.',
  done: 'Done',
  empty: 'No valid color',
  grades: {
    aaa: 'AAA normal text',
    aa: 'AA normal text',
    large: 'AA large text only',
    fail: 'Below AA text thresholds',
  },
  contrast: (ratio, grade) => \`\${ratio}:1 — \${grade}\`,
  result: (hex, contrast) => (contrast ? \`Color: \${hex}. \${contrast}\` : \`Color: \${hex}\`),
  swatch: (hex, label) => (label ? \`\${label} \${hex}\` : hex),
};

<ColorPicker label="Accent" defaultValue="#A78BFF" background="#FFFFFF" messages={messages} />` } } }, args: { background: '#FFFFFF' } };
export const SavedColors: Story = { parameters: { docs: { source: { language: 'tsx', code: `import { ColorPicker, type ColorPickerMessages, type ColorSwatch } from '@jfrader/ui';

const messages: ColorPickerMessages = {
  dialog: 'Choose a color',
  saturation: 'Saturation',
  value: 'Value',
  hue: 'Hue',
  opacity: 'Opacity',
  format: 'Format',
  color: 'Color',
  invalid: 'Enter a HEX, RGB, HSL or OKLCH color.',
  gamutWarning: 'Mapped to the sRGB gamut. The original OKLCH color is not preserved.',
  save: 'Save color',
  savedColors: 'Saved colors',
  movePrevious: 'Move previous',
  moveNext: 'Move next',
  remove: 'Remove color',
  eyeDropper: 'Pick from screen',
  eyeDropperError: 'Could not read the screen color.',
  done: 'Done',
  empty: 'No valid color',
  grades: {
    aaa: 'AAA normal text',
    aa: 'AA normal text',
    large: 'AA large text only',
    fail: 'Below AA text thresholds',
  },
  contrast: (ratio, grade) => \`\${ratio}:1 — \${grade}\`,
  result: (hex, contrast) => (contrast ? \`Color: \${hex}. \${contrast}\` : \`Color: \${hex}\`),
  swatch: (hex, label) => (label ? \`\${label} \${hex}\` : hex),
};

const palette: ColorSwatch[] = [
  { id: 'violet', color: '#A78BFF', label: 'Violet' },
  { id: 'white', color: '#FFFFFF', label: 'White' },
  { id: 'black', color: '#000000', label: 'Black' },
];

<ColorPicker label="Accent" defaultValue="#A78BFF" defaultSwatches={palette} messages={messages} />` } } }, args: { defaultSwatches: palette } };
export const Capacity: Story = {
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { ColorPicker, type ColorPickerMessages, type ColorSwatch } from '@jfrader/ui';

const messages: ColorPickerMessages = {
  dialog: 'Choose a color',
  saturation: 'Saturation',
  value: 'Value',
  hue: 'Hue',
  opacity: 'Opacity',
  format: 'Format',
  color: 'Color',
  invalid: 'Enter a HEX, RGB, HSL or OKLCH color.',
  gamutWarning: 'Mapped to the sRGB gamut. The original OKLCH color is not preserved.',
  save: 'Save color',
  savedColors: 'Saved colors',
  movePrevious: 'Move previous',
  moveNext: 'Move next',
  remove: 'Remove color',
  eyeDropper: 'Pick from screen',
  eyeDropperError: 'Could not read the screen color.',
  done: 'Done',
  empty: 'No valid color',
  grades: {
    aaa: 'AAA normal text',
    aa: 'AA normal text',
    large: 'AA large text only',
    fail: 'Below AA text thresholds',
  },
  contrast: (ratio, grade) => \`\${ratio}:1 — \${grade}\`,
  result: (hex, contrast) => (contrast ? \`Color: \${hex}. \${contrast}\` : \`Color: \${hex}\`),
  swatch: (hex, label) => (label ? \`\${label} \${hex}\` : hex),
};

const palette: ColorSwatch[] = [
  { id: 'violet', color: '#A78BFF', label: 'Violet' },
  { id: 'white', color: '#FFFFFF', label: 'White' },
  { id: 'black', color: '#000000', label: 'Black' },
];

<ColorPicker label="Accent" defaultValue="#A78BFF" defaultSwatches={palette} maxSwatches={3} messages={messages} />`,
      },
    },
  },
  args: { defaultSwatches: palette, maxSwatches: 3 },
};
export const OutOfGamut: Story = {
  args: {
    defaultValue: 'oklch(70% 0.4 30)',
    defaultFormat: 'oklch',
    defaultOpen: true,
  },
  tags: ['!autodocs'],
};
export const UnsupportedInput: Story = {
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { ColorPicker, type ColorPickerMessages } from '@jfrader/ui';

const messages: ColorPickerMessages = {
  dialog: 'Choose a color',
  saturation: 'Saturation',
  value: 'Value',
  hue: 'Hue',
  opacity: 'Opacity',
  format: 'Format',
  color: 'Color',
  invalid: 'Enter a HEX, RGB, HSL or OKLCH color.',
  gamutWarning: 'Mapped to the sRGB gamut. The original OKLCH color is not preserved.',
  save: 'Save color',
  savedColors: 'Saved colors',
  movePrevious: 'Move previous',
  moveNext: 'Move next',
  remove: 'Remove color',
  eyeDropper: 'Pick from screen',
  eyeDropperError: 'Could not read the screen color.',
  done: 'Done',
  empty: 'No valid color',
  grades: {
    aaa: 'AAA normal text',
    aa: 'AA normal text',
    large: 'AA large text only',
    fail: 'Below AA text thresholds',
  },
  contrast: (ratio, grade) => \`\${ratio}:1 — \${grade}\`,
  result: (hex, contrast) => (contrast ? \`Color: \${hex}. \${contrast}\` : \`Color: \${hex}\`),
  swatch: (hex, label) => (label ? \`\${label} \${hex}\` : hex),
};

<ColorPicker label="Accent" defaultValue="currentColor" messages={messages} />`,
      },
    },
  },
  args: { defaultValue: 'currentColor' },
};
export const NoBackground: Story = {};
export const Disabled: Story = { parameters: { docs: { source: { language: 'tsx', code: `import { ColorPicker, type ColorPickerMessages } from '@jfrader/ui';

const messages: ColorPickerMessages = {
  dialog: 'Choose a color',
  saturation: 'Saturation',
  value: 'Value',
  hue: 'Hue',
  opacity: 'Opacity',
  format: 'Format',
  color: 'Color',
  invalid: 'Enter a HEX, RGB, HSL or OKLCH color.',
  gamutWarning: 'Mapped to the sRGB gamut. The original OKLCH color is not preserved.',
  save: 'Save color',
  savedColors: 'Saved colors',
  movePrevious: 'Move previous',
  moveNext: 'Move next',
  remove: 'Remove color',
  eyeDropper: 'Pick from screen',
  eyeDropperError: 'Could not read the screen color.',
  done: 'Done',
  empty: 'No valid color',
  grades: {
    aaa: 'AAA normal text',
    aa: 'AA normal text',
    large: 'AA large text only',
    fail: 'Below AA text thresholds',
  },
  contrast: (ratio, grade) => \`\${ratio}:1 — \${grade}\`,
  result: (hex, contrast) => (contrast ? \`Color: \${hex}. \${contrast}\` : \`Color: \${hex}\`),
  swatch: (hex, label) => (label ? \`\${label} \${hex}\` : hex),
};

<ColorPicker label="Accent" defaultValue="#A78BFF" messages={messages} disabled />` } } }, args: { disabled: true, defaultOpen: true } };
export const ReadOnly: Story = {
  args: { readOnly: true, defaultSwatches: palette, defaultOpen: true },
  tags: ['!autodocs'],
};
export const Required: Story = {
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { ColorPicker, type ColorPickerMessages } from '@jfrader/ui';

const messages: ColorPickerMessages = {
  dialog: 'Choose a color',
  saturation: 'Saturation',
  value: 'Value',
  hue: 'Hue',
  opacity: 'Opacity',
  format: 'Format',
  color: 'Color',
  invalid: 'Enter a HEX, RGB, HSL or OKLCH color.',
  gamutWarning: 'Mapped to the sRGB gamut. The original OKLCH color is not preserved.',
  save: 'Save color',
  savedColors: 'Saved colors',
  movePrevious: 'Move previous',
  moveNext: 'Move next',
  remove: 'Remove color',
  eyeDropper: 'Pick from screen',
  eyeDropperError: 'Could not read the screen color.',
  done: 'Done',
  empty: 'No valid color',
  grades: {
    aaa: 'AAA normal text',
    aa: 'AA normal text',
    large: 'AA large text only',
    fail: 'Below AA text thresholds',
  },
  contrast: (ratio, grade) => \`\${ratio}:1 — \${grade}\`,
  result: (hex, contrast) => (contrast ? \`Color: \${hex}. \${contrast}\` : \`Color: \${hex}\`),
  swatch: (hex, label) => (label ? \`\${label} \${hex}\` : hex),
};

<ColorPicker label="Accent" defaultValue="#A78BFF" description="Brand color" messages={messages} required />`,
      },
    },
  },
  args: { required: true, description: 'Brand color' },
};
export const Sizes: Story = {
  render: (args) => (
    <Grid>
      {(['sm', 'md', 'lg'] as const).map((size) => (
        <ColorPicker {...args} key={size} size={size} label={size} />
      ))}
    </Grid>
  ),
};
export const Narrow: Story = {
  render: (args) => (
    <NarrowFrame>
      <ColorPicker {...args} />
    </NarrowFrame>
  ),
};
export const RTL: Story = {
  args: { dir: 'rtl', defaultOpen: true, defaultSwatches: palette },
  tags: ['!autodocs'],
};
export const Light: Story = {
  globals: { theme: 'light' },
  args: { defaultOpen: true, background: '#FFFFFF', defaultSwatches: palette },
  tags: ['!autodocs'],
};
export const PersistentOpen: Story = {
  args: { defaultOpen: true, background: '#08090A', defaultSwatches: palette },
  tags: ['!autodocs'],
};
export const OpenGeometry: Story = {
  args: { defaultOpen: true, background: '#08090A', defaultSwatches: palette },
  tags: ['!autodocs'],
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);
    const dialog = await page.findByRole('dialog');
    // The panel fits its viewport; it must not fall back to an internal scroll.
    await expect(dialog.scrollHeight - dialog.clientHeight).toBeLessThanOrEqual(1);
    const wide = (canvasElement.ownerDocument.defaultView?.innerWidth ?? 0) >= 900;
    if (wide) await expect(dialog.getBoundingClientRect().width).toBeGreaterThan(420);
    // The checker wrapper is the swatch box, not a taller inline line box.
    const trigger = canvasElement.querySelector('[data-ui="color-picker"] button') as HTMLElement;
    const checker = trigger.querySelector('span[aria-hidden]') as HTMLElement;
    const swatch = checker.querySelector('span') as HTMLElement;
    const checkerBox = checker.getBoundingClientRect();
    const swatchBox = swatch.getBoundingClientRect();
    await expect(Math.abs(checkerBox.height - swatchBox.height)).toBeLessThan(1);
    await expect(Math.abs(checkerBox.width - swatchBox.width)).toBeLessThan(1);
  },
};
export const OpenInvalid: Story = {
  args: { value: '', open: true },
  tags: ['!autodocs'],
};
export const ContrastCategories: Story = {
  render: (args) => (
    <Grid>
      {['#FFFFFF', '#999999', '#777777', '#000000'].map((color) => (
        <ColorPicker
          {...args}
          key={color}
          label={color}
          defaultValue={color}
          background="#000000"
        />
      ))}
    </Grid>
  ),
};
export const ThemeRootPortal: Story = {
  render: (args) => (
    <ThemeRoot theme="light">
      <ThemeFrame>
        <ColorPicker {...args} defaultOpen />
      </ThemeFrame>
    </ThemeRoot>
  ),
  tags: ['!autodocs'],
};

export const AdapterFixtures: Story = {
  play: async () => {
    for (const text of [
      '#fff',
      'rgb(255 255 255)',
      'hsl(0 0% 100%)',
      'oklch(1 0 0)',
    ])
      await expect(parseColor(text)?.hex).toBe('#FFFFFF');
    for (const text of [
      '',
      'red',
      'var(--color)',
      'currentColor',
      'rgb(NaN 0 0)',
      'oklch(Infinity 0 0)',
      'color(display-p3 1 0 0)',
      '#FFFFF',
      'hsl(none 0% 0%)',
    ])
      await expect(parseColor(text)).toBeUndefined();
    await expect(parseColor('#1234')?.hex).toBe('#11223344');
    await expect(parseColor('hsl(-120 100% 50%)')?.hex).toBe('#0000FF');
    await expect(parseColor('hsl(720 100% 50%)')?.hex).toBe('#FF0000');
    for (const format of ['hex', 'rgb', 'hsl', 'oklch'] as const)
      await expect(
        parseColor(serializeColor(parseColor('#A78BFF80')!, format))?.hex,
      ).toBe('#A78BFF80');
    await expect(contrastColor('#FFFFFF', '#000000')?.ratio).toBe(21);
    await expect(contrastColor('#FFFFFF80', '#000000')?.ratio).toBeLessThan(6);
    await expect(contrastColor('#FFFFFF', '#00000080')).toBeUndefined();
    await expect(contrastGrade(6.999999)).toBe('aa');
    await expect(contrastGrade(4.499999)).toBe('large');
    await expect(contrastGrade(2.999999)).toBe('fail');
    await expect(fromChannels({ h: 120, s: 0, v: 0, a: 0 }).hex).toBe(
      '#00000000',
    );
    await expect(parseColor('oklch(70% 0.4 30)')?.mapped).toBe(true);
  },
};

export const Keyboard: Story = {
  tags: ['!autodocs'],
  args: { defaultValue: '#FF0000', defaultSwatches: palette },
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    const page = within(canvasElement.ownerDocument.body);
    const trigger = canvas.getByRole('button', { name: 'Accent #FF0000' });
    await userEvent.tab();
    await expect(canvasElement.ownerDocument.activeElement).toBe(trigger);
    await userEvent.keyboard('{Enter}');
    await expect(args.onOpenChange).toHaveBeenCalledTimes(1);
    const dialog = await page.findByRole('dialog', { name: messages.dialog });
    await expect(dialog.contains(canvasElement.ownerDocument.activeElement)).toBe(true);
    const value = within(dialog).getByRole('slider', { name: 'Value' });
    value.focus();
    await expect(getComputedStyle(value).outlineStyle).not.toBe('none');
    await userEvent.keyboard(
      '{Home}{End}{ArrowLeft}{ArrowRight}{PageDown}{PageUp}{Shift>}{ArrowDown}{/Shift}{Shift>}{ArrowUp}{/Shift}',
    );
    await expect(value).toHaveValue('100');
    const input = within(dialog).getByRole('textbox', { name: 'Color' });
    await userEvent.clear(input);
    await userEvent.type(input, 'invalid');
    await userEvent.keyboard('{Escape}');
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(input).toHaveValue('#FF0000');
    await userEvent.click(page.getByRole('button', { name: 'Done' }));
    await waitFor(() =>
      expect(
        canvasElement.ownerDocument.querySelector('dialog[data-ui="dialog"]'),
      ).not.toHaveAttribute('open'),
    );
    await waitFor(() =>
      expect(canvasElement.ownerDocument.activeElement).toBe(trigger),
    );
  },
};
export const EscapeCloses: Story = {
  args: { defaultOpen: true },
  tags: ['!autodocs'],
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);
    const dialog = await page.findByRole('dialog', { name: messages.dialog });
    // Synthetic key events do not trigger the native cancel; dispatch it directly.
    dialog.dispatchEvent(new Event('cancel', { bubbles: false, cancelable: true }));
    await waitFor(() =>
      expect(
        canvasElement.ownerDocument.querySelector('dialog[data-ui="dialog"]'),
      ).not.toHaveAttribute('open'),
    );
    await expect(dialog).not.toBeVisible();
  },
};
export const InvalidInput: Story = {
  args: { defaultOpen: true },
  tags: ['!autodocs'],
  play: async ({ canvasElement, userEvent }) => {
    const page = within(canvasElement.ownerDocument.body);
    const input = page.getByRole('textbox', { name: 'Color' });
    await userEvent.clear(input);
    await userEvent.type(input, '#bad-input');
    await userEvent.tab();
    await expect(input).toHaveValue('#bad-input');
    await expect(canvasElement.ownerDocument.activeElement).not.toBe(input);
    await expect(input).toHaveAttribute('aria-invalid', 'true');
    await userEvent.click(page.getByRole('button', { name: 'Done' }));
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(canvasElement.ownerDocument.activeElement).toBe(input);
  },
};
export const ControlledRejects: Story = {
  args: { value: '#FF0000', open: true, format: 'hex', swatches: palette },
  tags: ['!autodocs'],
  play: async ({ canvasElement, args, userEvent }) => {
    const page = within(canvasElement.ownerDocument.body);
    const value = page.getByRole('slider', { name: 'Value' });
    value.focus();
    await userEvent.keyboard('{Home}');
    await expect(args.onValueChange).toHaveBeenLastCalledWith('#000000');
    await expect(value).toHaveValue('100');
    const option = page.getByRole('option', { name: 'Violet #A78BFF' });
    option.focus();
    await userEvent.keyboard('{Alt>}{ArrowRight}{/Alt}');
    await expect(page.getAllByRole('option')[0]).toBe(option);
    await expect(canvasElement.ownerDocument.activeElement).toBe(option);
    await userEvent.keyboard('{Delete}');
    await expect(page.getAllByRole('option')).toHaveLength(3);
    await expect(canvasElement.ownerDocument.activeElement).toBe(option);
    await userEvent.keyboard('{Escape}');
    await expect(page.getByRole('dialog')).toBeVisible();
  },
};

function ResetFixture(args: ComponentProps<typeof ColorPicker>) {
  const [value, setValue] = useState('#A78BFF');
  return (
    <form>
      <ColorPicker
        {...args}
        value={value}
        onValueChange={setValue}
        defaultValue="#A78BFF"
        name="accent"
      />
      <Button type="reset">Reset</Button>
    </form>
  );
}
export const FormReset: Story = {
  render: (args) => <ResetFixture {...args} />,
};

function DropperFixture({
  mode,
  ...args
}: ComponentProps<typeof ColorPicker> & {
  mode: 'available' | 'unavailable' | 'cancelled' | 'error';
}) {
  const resolve = useRef<((value: { sRGBHex: string }) => void) | undefined>(
    undefined,
  );
  const [mounted, setMounted] = useState(true);
  const [Capability] = useState(
    () =>
      class {
        open() {
          if (mode === 'cancelled')
            return Promise.reject(new DOMException('Cancelled', 'AbortError'));
          if (mode === 'error')
            return Promise.reject(new Error('Screen unavailable'));
          return new Promise<{ sRGBHex: string }>((complete) => {
            resolve.current = complete;
          });
        }
      },
  );
  return (
    <Grid>
      <EyeDropperCapability value={mode === 'unavailable' ? null : Capability}>
        {mounted && <ColorPicker {...args} />}
      </EyeDropperCapability>
      <Button onClick={() => resolve.current?.({ sRGBHex: '#00FF00' })}>
        Resolve screen color
      </Button>
      <Button onClick={() => setMounted(false)}>Unmount picker</Button>
    </Grid>
  );
}
export const EyedropperAvailable: Story = {
  args: { defaultValue: '#FF000080', defaultOpen: true },
  tags: ['!autodocs'],
  render: (args) => <DropperFixture {...args} mode="available" />,
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    const page = within(canvasElement.ownerDocument.body);
    await userEvent.click(
      page.getByRole('button', { name: messages.eyeDropper }),
    );
    fireEvent.click(
      canvas.getByRole('button', { name: 'Resolve screen color' }),
    );
    await waitFor(() =>
      expect(args.onValueChange).toHaveBeenLastCalledWith('#00FF0080'),
    );
    await userEvent.click(
      page.getByRole('button', { name: messages.eyeDropper }),
    );
    await userEvent.click(
      canvas.getByRole('button', { name: 'Unmount picker' }),
    );
    await userEvent.click(
      canvas.getByRole('button', { name: 'Resolve screen color' }),
    );
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
  },
};
export const EyedropperUnavailable: Story = {
  render: (args) => <DropperFixture {...args} mode="unavailable" />,
};
export const EyedropperCancelled: Story = {
  args: { defaultOpen: true },
  tags: ['!autodocs'],
  render: (args) => <DropperFixture {...args} mode="cancelled" />,
  play: async ({ canvasElement, userEvent, args }) => {
    const page = within(canvasElement.ownerDocument.body);
    await userEvent.click(
      page.getByRole('button', { name: messages.eyeDropper }),
    );
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await expect(page.queryByRole('alert')).not.toBeInTheDocument();
  },
};
export const EyedropperFailure: Story = {
  args: { defaultOpen: true },
  tags: ['!autodocs'],
  render: (args) => <DropperFixture {...args} mode="error" />,
  play: async ({ canvasElement, userEvent }) => {
    const page = within(canvasElement.ownerDocument.body);
    await userEvent.click(
      page.getByRole('button', { name: messages.eyeDropper }),
    );
    await expect(await page.findByRole('alert')).toHaveTextContent(
      messages.eyeDropperError,
    );
  },
};

export const PointerLifecycle: Story = {
  args: { defaultValue: '#FF0000', defaultOpen: true },
  tags: ['!autodocs'],
  play: async ({ canvasElement, args }) => {
    const doc = canvasElement.ownerDocument;
    const pad = doc.querySelector('[data-ui="color-picker-pad"]')!;
    const rect = pad.getBoundingClientRect();
    const capture = spyOn(pad, 'setPointerCapture').mockImplementation(
      () => {},
    );
    const event = {
      pointerId: 21,
      button: 0,
      clientX: rect.left + rect.width / 2,
      clientY: rect.top + rect.height / 2,
    };
    fireEvent.pointerDown(pad, event);
    await expect(args.onValueChange).toHaveBeenLastCalledWith('#804040');
    await expect(capture).toHaveBeenCalledWith(21);
    const calls = args.onValueChange!.mock.calls.length;
    fireEvent.pointerCancel(pad, event);
    fireEvent.pointerMove(pad, { ...event, clientX: rect.right });
    await expect(args.onValueChange).toHaveBeenCalledTimes(calls);
    await expect(getComputedStyle(pad).touchAction).toBe('none');
    const geometry = spyOn(pad, 'getBoundingClientRect').mockReturnValue(
      new DOMRect(rect.x, rect.y, 0, 0),
    );
    fireEvent.pointerDown(pad, event);
    await expect(args.onValueChange).toHaveBeenCalledTimes(calls);
    fireEvent.lostPointerCapture(pad, event);
    geometry.mockReturnValue(new DOMRect(rect.x, rect.y, 0.25, 0.25));
    fireEvent.pointerMove(pad, event);
    await expect(args.onValueChange).toHaveBeenCalledTimes(calls);
    fireEvent.pointerDown(pad, {
      ...event,
      clientX: rect.x + 1,
      clientY: rect.y - 1,
    });
    await expect(args.onValueChange).toHaveBeenLastCalledWith('#FF0000');
    fireEvent.pointerCancel(pad, event);
    geometry.mockRestore();
    capture.mockRestore();
  },
};

export const SavedKeyboard: Story = {
  args: { defaultOpen: true, defaultSwatches: palette },
  tags: ['!autodocs'],
  play: async ({ canvasElement, userEvent, args }) => {
    const page = within(canvasElement.ownerDocument.body);
    const violet = page.getByRole('option', { name: 'Violet #A78BFF' });
    violet.focus();
    await userEvent.keyboard('{End}');
    const black = page.getByRole('option', { name: 'Black #000000' });
    await expect(canvasElement.ownerDocument.activeElement).toBe(black);
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await userEvent.keyboard('{Enter}');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await userEvent.keyboard('{Alt>}{ArrowLeft}{/Alt}');
    await expect(page.getAllByRole('option')[1]).toBe(black);
    await expect(canvasElement.ownerDocument.activeElement).toBe(black);
    await userEvent.keyboard('{Delete}');
    await expect(canvasElement.ownerDocument.activeElement).toBe(
      page.getByRole('option', { name: 'White #FFFFFF' }),
    );
    await userEvent.keyboard('{Delete}{Delete}');
    await expect(canvasElement.ownerDocument.activeElement).toBe(
      page.getByRole('button', { name: 'Save color' }),
    );
  },
};

export const SliderChannels: Story = {
  args: { defaultOpen: true, defaultValue: '#FF0000' },
  tags: ['!autodocs'],
  play: async ({ canvasElement, userEvent }) => {
    const page = within(canvasElement.ownerDocument.body);
    for (const name of ['Saturation', 'Value', 'Opacity', 'Hue']) {
      const slider = page.getByRole('slider', { name });
      const max = name === 'Hue' ? '359' : '100';
      slider.focus();
      await userEvent.keyboard('{Home}');
      await expect(slider).toHaveValue('0');
      await userEvent.keyboard('{ArrowUp}{Shift>}{ArrowUp}{/Shift}{PageUp}');
      await expect(slider).toHaveValue('21');
      await userEvent.keyboard(
        '{PageDown}{Shift>}{ArrowDown}{/Shift}{ArrowDown}',
      );
      await expect(slider).toHaveValue('0');
      await userEvent.keyboard('{ArrowLeft}');
      await expect(slider).toHaveValue('0');
      await userEvent.keyboard('{End}{ArrowRight}');
      await expect(slider).toHaveValue(max);
      // Authored 32px; fractional DPR reports ~31.99, so allow a sub-pixel tolerance.
      await expect(
        slider.getBoundingClientRect().height,
      ).toBeGreaterThanOrEqual(31.5);
    }
  },
};

export const FormatRejection: Story = {
  args: { defaultOpen: true, format: 'hex' },
  tags: ['!autodocs'],
  play: async ({ canvasElement, userEvent, args }) => {
    const page = within(canvasElement.ownerDocument.body);
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await expect(args.onFormatChange).not.toHaveBeenCalled();
    const format = page.getByRole('combobox', { name: 'Format' });
    await userEvent.click(format);
    await userEvent.keyboard('{Home}{ArrowDown}{Enter}');
    await expect(args.onFormatChange).toHaveBeenLastCalledWith('rgb');
    await expect(format).toHaveTextContent('HEX');
    await expect(page.getByRole('textbox', { name: 'Color' })).toHaveValue(
      '#A78BFF',
    );
    await expect(args.onValueChange).not.toHaveBeenCalled();
  },
};

export const SemanticEquality: Story = {
  args: { defaultOpen: true, value: 'rgb(255 0 0)' },
  tags: ['!autodocs'],
  play: async ({ canvasElement, userEvent, args }) => {
    const page = within(canvasElement.ownerDocument.body);
    const input = page.getByRole('textbox', { name: 'Color' });
    await userEvent.clear(input);
    await userEvent.type(input, 'hsl(360 100% 50%){Enter}');
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await expect(input).toHaveValue('#FF0000');
    const saturation = page.getByRole('slider', { name: 'Saturation' });
    saturation.focus();
    await userEvent.keyboard('{Home}');
    await expect(args.onValueChange).toHaveBeenLastCalledWith('#FFFFFF');
    await expect(saturation).toHaveValue('100');
  },
};

export const AchromaticIntent: Story = {
  args: { defaultOpen: true, defaultValue: '#808080' },
  tags: ['!autodocs'],
  play: async ({ canvasElement, userEvent, args }) => {
    const page = within(canvasElement.ownerDocument.body);
    const hue = page.getByRole('slider', { name: 'Hue' });
    hue.focus();
    await userEvent.keyboard('{Home}{PageUp}{PageUp}');
    await expect(hue).toHaveValue('20');
    await expect(args.onValueChange).not.toHaveBeenCalled();
    const saturation = page.getByRole('slider', { name: 'Saturation' });
    saturation.focus();
    await userEvent.keyboard('{End}');
    await expect(hue).toHaveValue('20');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
  },
};

function ReplacementTrigger(props: ComponentPropsWithRef<'button'>) {
  return <button {...props} data-replaced-trigger />;
}
function ReplacementContent(props: ComponentPropsWithRef<'div'>) {
  return <div {...props} data-replaced-content />;
}
export const SlotOverrides: Story = {
  args: {
    label: 0,
    slots: { trigger: ReplacementTrigger, content: ReplacementContent },
    description: 'A color',
    slotProps: { trigger: { 'aria-describedby': 'external-description' } },
  },
  render: (args) => (
    <>
      <span id="external-description">Additional description</span>
      <ColorPicker {...args} />
    </>
  ),
  play: async ({ canvas, canvasElement, userEvent }) => {
    const trigger = canvas.getByRole('button', { name: '0 #A78BFF' });
    await expect(trigger).toHaveAttribute('data-replaced-trigger');
    await expect(trigger.getAttribute('aria-describedby')).toContain(
      'external-description',
    );
    await expect(trigger.getAttribute('aria-describedby')).toContain(
      '-description',
    );
    await userEvent.click(trigger);
    const dialog = await within(canvasElement.ownerDocument.body).findByRole(
      'dialog',
    );
    const content = canvasElement.ownerDocument.querySelector(
      '[data-replaced-content]',
    );
    await expect(content).toBeInTheDocument();
    await expect(dialog).toContainElement(content as HTMLElement);
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  },
};

export const UncontrolledReset: Story = {
  args: {
    defaultOpen: true,
    defaultValue: '#FF0000',
    defaultSwatches: palette,
    name: 'accent',
  },
  tags: ['!autodocs'],
  render: (args) => (
    <form>
      <ColorPicker {...args} />
      <Button type="reset">Reset</Button>
    </form>
  ),
  play: async ({ canvas, canvasElement, userEvent }) => {
    const page = within(canvasElement.ownerDocument.body);
    await userEvent.click(page.getByRole('option', { name: 'Black #000000' }));
    await userEvent.click(page.getByRole('button', { name: 'Remove color' }));
    const form = canvasElement.querySelector('form')!;
    await expect(new FormData(form).get('accent')).toBe('#000000');
    await userEvent.click(canvas.getByRole('button', { name: 'Reset' }));
    await expect(new FormData(form).get('accent')).toBe('#FF0000');
    await userEvent.click(canvas.getByRole('button', { name: /^Accent/ }));
    await expect(page.getAllByRole('option')).toHaveLength(3);
  },
};
