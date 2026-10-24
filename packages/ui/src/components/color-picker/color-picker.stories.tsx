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
const messagesSource = `import { ColorPicker, type ColorPickerMessages } from '@jfrader/ui';

const messages: ColorPickerMessages = {
  dialog: 'Choose a color', saturation: 'Saturation', value: 'Value', hue: 'Hue',
  opacity: 'Opacity', format: 'Format', color: 'Color',
  invalid: 'Enter a HEX, RGB, HSL or OKLCH color.',
  gamutWarning: 'Mapped to the sRGB gamut. The original OKLCH color is not preserved.',
  save: 'Save color', savedColors: 'Saved colors', movePrevious: 'Move previous',
  moveNext: 'Move next', remove: 'Remove color', eyeDropper: 'Pick from screen',
  eyeDropperError: 'Could not read the screen color.', done: 'Done', empty: 'No valid color',
  grades: { aaa: 'AAA normal text', aa: 'AA normal text',
    large: 'AA large text only', fail: 'Below AA text thresholds' },
  contrast: (ratio, grade) => \`\${ratio}:1 — \${grade}\`,
  result: (hex, contrast) => contrast ? \`Color: \${hex}. \${contrast}\` : \`Color: \${hex}\`,
  swatch: (hex, label) => label ? \`\${label} \${hex}\` : hex,
};`;
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
      sections: [
        { title: 'Basic', stories: ['Default'] },
        { title: 'Formats', stories: ['EveryFormat'] },
        { title: 'Saved colors', stories: ['SavedColors', 'Capacity'] },
        { title: 'Transparency', stories: ['Transparent'] },
        { title: 'Contrast feedback', stories: ['CustomBackground'] },
        { title: 'Dialog', stories: ['ControlledDialog'] },
        { title: 'States', stories: ['Disabled', 'UnsupportedInput', 'Required'] },
        { title: 'Keyboard', stories: ['KeyboardNavigation'] },
      ],
      usage: `### When to use
Let people choose a custom color, adjust channels or reuse saved colors. Use a fixed set of choices instead when arbitrary colors are not allowed.

### Values and constraints

Color text must use HEX, RGB, HSL or OKLCH syntax with ASCII decimal points, not named colors or CSS variables. Out-of-gamut colors are mapped to sRGB; the original OKLCH color is not preserved. Required marks the field but does not enforce color validation.

Contrast feedback needs an opaque background and includes foreground transparency. It evaluates this color pair for text, not the accessibility of a whole interface. Missing, invalid or translucent backgrounds hide the result. Saved colors evict the oldest entry at capacity. Screen color picking depends on browser support.

### Keyboard and accessibility

Opening moves focus into a modal dialog. Tab and Shift+Tab stay inside; closing restores trigger focus. Enter or blur commits valid text; invalid text stays visible. Escape discards a dirty draft first, then closes. Done and format changes validate before proceeding.

Saturation and Value are separate sliders. Arrows step by one; Shift+arrows and PageUp/PageDown by ten; Home/End reach bounds. Inline arrows follow RTL while the visual pad remains left-to-right.

Saved-color arrows and Home/End move focus without selecting; Enter/Space applies a color. Alt+inline arrows reorder; Delete/Backspace removes. Move and Remove buttons offer the same actions. Provide localized messages and test sliders with touch assistive technology.`,
    },
  },
} satisfies Meta<typeof ColorPicker>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Choose an accent color',
  parameters: { docs: {
    description: { story: 'Open the picker to adjust an accent color or enter a color value.' },
    source: { language: 'tsx', code: `${messagesSource}

<ColorPicker label="Accent" defaultValue="#A78BFF" messages={messages} />` },
  } },
};
export const EveryFormat: Story = {
  name: 'Edit HEX, RGB, HSL and OKLCH',
  parameters: { docs: {
    description: { story: 'Open each picker to edit the same color in a different format.' },
    source: { language: 'tsx', code: `${messagesSource}

import { styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const Formats = styled.div({ display: 'grid', gap: vars.space[4] });

<Formats>
  {(['hex', 'rgb', 'hsl', 'oklch'] as const).map(format => (
    <ColorPicker key={format} label={format.toUpperCase()} defaultValue="#A78BFF"
      defaultFormat={format} messages={messages} />
  ))}
</Formats>` },
  } },
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
  name: 'Adjust opacity',
  parameters: {
    docs: {
      description: { story: 'Adjust a translucent accent and compare it against a dark background.' },
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
export const CustomBackground: Story = { name: 'Check text contrast', parameters: { docs: { description: { story: 'Compare the selected color with white to read its contrast ratio and text grade.' }, source: { language: 'tsx', code: `import { ColorPicker, type ColorPickerMessages } from '@jfrader/ui';

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
export const SavedColors: Story = { name: 'Reuse saved colors', parameters: { docs: { description: { story: 'Apply a saved swatch, save the current color or remove a swatch.' }, source: { language: 'tsx', code: `import { ColorPicker, type ColorPickerMessages, type ColorSwatch } from '@jfrader/ui';

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
  name: 'Limit saved colors',
  parameters: {
    docs: {
      description: { story: 'Save a fourth color to replace the oldest of three saved swatches.' },
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
  name: 'Unsupported color text',
  parameters: {
    docs: {
      description: { story: 'Open an invalid initial color and enter HEX, RGB, HSL or OKLCH text to replace it.' },
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
export const Disabled: Story = { name: 'Disabled picker', parameters: { docs: { description: { story: 'Keep the current accent visible without allowing the picker to open.' }, source: { language: 'tsx', code: `import { ColorPicker, type ColorPickerMessages } from '@jfrader/ui';

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
  name: 'Required accent',
  parameters: {
    docs: {
      description: { story: 'Mark an accent as required and give it a field description.' },
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
    await expect(dialog.scrollWidth - dialog.clientWidth).toBeLessThanOrEqual(1);
    const wide = (canvasElement.ownerDocument.defaultView?.innerWidth ?? 0) >= 900;
    if (wide) {
      await expect(dialog.scrollHeight - dialog.clientHeight).toBeLessThanOrEqual(1);
      await expect(dialog.getBoundingClientRect().width).toBeGreaterThan(420);
    }
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
export const SavingKeepsHeight: Story = {
  args: { defaultOpen: true, background: '#08090A' },
  tags: ['!autodocs'],
  play: async ({ canvasElement, userEvent }) => {
    const page = within(canvasElement.ownerDocument.body);
    const dialog = await page.findByRole('dialog');
    const content = dialog.querySelector<HTMLElement>('[data-ui~="color-picker-content"]')!;
    const listbox = page.getByRole('listbox', { name: messages.savedColors });
    // offsetHeight is layout height, so the dialog's entrance scale does not skew it.
    const heights = () => [dialog.offsetHeight, content.offsetHeight, listbox.offsetHeight];
    const before = heights();
    await expect(page.queryAllByRole('option')).toHaveLength(0);
    const save = page.getByRole('button', { name: messages.save });
    for (let saved = 1; saved <= 8; saved++) {
      await userEvent.click(save);
      await expect(page.getAllByRole('option')).toHaveLength(Math.min(saved, 7));
      await expect(heights()).toEqual(before);
    }
    await userEvent.click(page.getAllByRole('option')[0]!);
    await expect(heights()).toEqual(before);
    const input = page.getByRole('textbox', { name: messages.color });
    await userEvent.clear(input);
    await userEvent.type(input, 'oklch(70% 0.4 30){Enter}');
    await expect(page.getByText(messages.gamutWarning)).toBeVisible();
    await expect(heights()).toEqual(before);
    await expect(listbox.scrollWidth - listbox.clientWidth).toBeLessThanOrEqual(0);
    if ((canvasElement.ownerDocument.defaultView?.innerWidth ?? 0) >= 900)
      await expect(dialog.scrollHeight - dialog.clientHeight).toBeLessThanOrEqual(1);
  },
};
export const PanelLayout: Story = {
  args: { defaultValue: '#FF0000', defaultOpen: true, defaultSwatches: palette },
  tags: ['!autodocs'],
  render: (args) => <DropperFixture {...args} mode="available" />,
  play: async ({ canvasElement, userEvent }) => {
    const doc = canvasElement.ownerDocument;
    const page = within(doc.body);
    const dialog = await page.findByRole('dialog');
    const groups = dialog.querySelectorAll<HTMLElement>('[data-ui~="button-group"]');
    await expect(groups).toHaveLength(1);
    const group = groups[0]!;
    await expect(group).toHaveAttribute('role', 'group');
    await expect(group).toHaveAccessibleName(messages.savedColors);
    const actions = [messages.save, messages.movePrevious, messages.moveNext, messages.remove].map((name) =>
      within(group).getByRole('button', { name }),
    );
    await expect(within(group).getAllByRole('button')).toEqual(actions);
    const sample = page.getByRole('button', { name: messages.eyeDropper });
    const done = page.getByRole('button', { name: messages.done });
    for (const button of [...actions, sample, done]) await expect(button.offsetHeight).toBe(32);
    await expect(group).not.toContainElement(sample);
    await expect(group).not.toContainElement(done);

    const pad = dialog.querySelector<HTMLElement>('[data-ui="color-picker-pad"]')!;
    const listbox = page.getByRole('listbox', { name: messages.savedColors });
    const space = pad.closest<HTMLElement>('[data-ui~="color-picker-space"]')!;
    const saved = listbox.closest<HTMLElement>('[data-ui~="color-picker-values"]')!;
    await expect(space).toContainElement(sample);
    await expect(space).toContainElement(page.getByRole('slider', { name: messages.hue }));
    await expect(saved).toContainElement(page.getByRole('textbox', { name: messages.color }));
    await expect(saved).toContainElement(group);
    await expect(saved).toContainElement(done);
    await expect(group.scrollWidth - group.clientWidth).toBeLessThanOrEqual(1);
    await expect(group.getBoundingClientRect().right).toBeLessThanOrEqual(saved.getBoundingClientRect().right + 1);
    if (space.parentElement!.offsetWidth >= 416) {
      await expect(Math.abs(space.getBoundingClientRect().top - saved.getBoundingClientRect().top)).toBeLessThan(1);
      await expect(space.getBoundingClientRect().right).toBeLessThan(saved.getBoundingClientRect().left);
    }

    page.getByRole('slider', { name: messages.opacity }).focus();
    await userEvent.tab();
    await expect(doc.activeElement).toBe(sample);
    await userEvent.tab();
    await expect(doc.activeElement).toBe(page.getByRole('combobox', { name: messages.format }));
    await userEvent.tab();
    await expect(doc.activeElement).toBe(page.getByRole('textbox', { name: messages.color }));
    await userEvent.tab();
    await expect(doc.activeElement).toBe(page.getByRole('option', { name: 'Violet #A78BFF' }));
    await userEvent.tab();
    await expect(doc.activeElement).toBe(actions[0]);
    await expect(getComputedStyle(actions[0]!).outlineStyle).not.toBe('none');
    done.focus();
    await userEvent.tab({ shift: true });
    await expect(doc.activeElement).toBe(actions[3]);
  },
};
export const LongLabels: Story = {
  tags: ['!autodocs'],
  args: {
    label: 'Accent color for the selected workspace and its shared projects',
    messages: {
      ...messages,
      saturation: 'VeryLongTranslatedSaturationLabelWithoutSpaces',
      value: 'Brightness of the currently selected color',
      hue: 'VeryLongTranslatedHueLabelWithoutSpaces',
      opacity: 'Opacity of the currently selected color',
      save: 'Save the currently selected color for all shared workspaces',
      movePrevious: 'MoveSelectedColorToThePreviousPositionInThePalette',
      moveNext: 'Move the selected color to the next position in the palette',
    },
    defaultSwatches: palette,
  },
  play: async ({ canvasElement, userEvent }) => {
    const page = within(canvasElement.ownerDocument.body);
    await userEvent.click(within(canvasElement).getByRole('button', { name: /Accent color for the selected workspace/ }));
    const dialog = await page.findByRole('dialog');
    await expect(dialog.scrollWidth - dialog.clientWidth).toBeLessThanOrEqual(1);
    for (const slider of within(dialog).getAllByRole('slider')) {
      const label = slider.closest('label')!;
      const text = canvasElement.ownerDocument.createRange();
      text.selectNodeContents(label.firstChild!);
      await expect(text.getBoundingClientRect().right).toBeLessThanOrEqual(slider.getBoundingClientRect().left);
      await expect(label.scrollWidth - label.clientWidth).toBeLessThanOrEqual(1);
      await waitFor(() => expect(slider.getBoundingClientRect().height).toBeGreaterThanOrEqual(32));
    }
    const done = within(dialog).getByRole('button', { name: messages.done });
    done.focus();
    await waitFor(() => {
      const box = done.getBoundingClientRect();
      const panel = dialog.getBoundingClientRect();
      expect(box.top).toBeGreaterThanOrEqual(panel.top);
      expect(box.bottom).toBeLessThanOrEqual(panel.bottom);
    });
    await userEvent.click(done);
    await waitFor(() => expect(page.queryByRole('dialog')).toBeNull());
    await expect(page.getByRole('button', { name: /Accent color for the selected workspace/ })).toHaveFocus();
  },
};

export const ColorSurfaces: Story = {
  tags: ['!autodocs'],
  args: { defaultOpen: true, defaultSwatches: palette },
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);
    const dialog = await page.findByRole('dialog');
    const pad = dialog.querySelector('[data-ui="color-picker-pad"]')!;
    await expect(getComputedStyle(pad).forcedColorAdjust).toBe('none');
    await expect(getComputedStyle(pad).backgroundImage).not.toBe('none');
    const swatches = within(dialog).getAllByRole('option').map(option => option.querySelector('span')!);
    for (const swatch of swatches) await expect(getComputedStyle(swatch).forcedColorAdjust).toBe('none');
    await expect(new Set(swatches.map(swatch => getComputedStyle(swatch).backgroundColor)).size).toBe(palette.length);
  },
};
export const FormatOverlay: Story = {
  tags: ['!autodocs'],
  args: { defaultOpen: true },
  play: async ({ canvasElement, userEvent }) => {
    const page = within(canvasElement.ownerDocument.body);
    const dialog = await page.findByRole('dialog');
    const format = within(dialog).getByRole('combobox', { name: messages.format });
    await userEvent.click(format);
    const list = await page.findByRole('listbox', { name: messages.format });
    await expect(dialog).toContainElement(list);
    const rgb = within(list).getByRole('option', { name: 'RGB' });
    await waitFor(() => {
      const box = rgb.getBoundingClientRect();
      expect(rgb.contains(canvasElement.ownerDocument.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2))).toBe(true);
    });
    await userEvent.click(rgb);
    await expect(format).toHaveTextContent('RGB');
    await userEvent.click(format);
    await expect(await page.findByRole('listbox', { name: messages.format })).toBeVisible();
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

function AccentDialog() {
  const [open, setOpen] = useState(false);
  return <ColorPicker label="Accent" defaultValue="#A78BFF" messages={messages}
    open={open} onOpenChange={setOpen} />;
}

export const ControlledDialog: Story = {
  name: 'Control the color dialog',
  render: () => <AccentDialog />,
  parameters: { docs: {
    description: { story: 'Open and close the modal while keeping its open state in your application.' },
    source: { language: 'tsx', code: `${messagesSource}

import { useState } from 'react';

export function AccentDialog() {
  const [open, setOpen] = useState(false);
  return <ColorPicker label="Accent" defaultValue="#A78BFF" messages={messages}
    open={open} onOpenChange={setOpen} />;
}` },
  } },
};

export const KeyboardNavigation: Story = {
  name: 'Navigate sliders and saved colors',
  args: { defaultValue: '#FF0000', defaultSwatches: palette },
  parameters: { docs: {
    description: { story: 'Open with Enter, Tab to the sliders or swatches, and use arrow keys to adjust or navigate.' },
    source: { language: 'tsx', code: `${messagesSource}

<ColorPicker label="Accent" defaultValue="#FF0000" messages={messages}
  defaultSwatches={[
    { id: 'violet', color: '#A78BFF', label: 'Violet' },
    { id: 'white', color: '#FFFFFF', label: 'White' },
    { id: 'black', color: '#000000', label: 'Black' },
  ]} />` },
  } },
};
