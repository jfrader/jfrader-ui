import { StrictMode, useState, type ComponentPropsWithRef } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fireEvent, fn, waitFor } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { withLightTheme } from '../../testing/story-decorators';
import { Button } from '../button';
import { Kbd } from '../kbd';
import { TextField } from '../text-field';
import { Textarea } from '../textarea';
import { KeycapKeyboard, type KeycapKeyboardProps, type KeycapSpec } from './index';
// `styled` is the app-facing styling API; consumers import it from `@jfrader/ui`.
import { styled } from '../../index';

const Stack = styled.div({ display: 'grid', gap: vars.space[4], inlineSize: '100%', maxInlineSize: '48rem' });
const snippet = `import { useState } from 'react';
import { Button, KeycapKeyboard, TextField, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const Stack = styled.div({ display: 'grid', gap: vars.space[4], inlineSize: '100%', maxInlineSize: '48rem' });

export function TypingKeyboard() {
  const [input, setInput] = useState<HTMLInputElement | null>(null);
  return (
    <Stack>
      <TextField label="Try the keyboard" ref={setInput} />
      <KeycapKeyboard eventTarget={input} />
      <Button>Continue</Button>
    </Stack>
  );
}`;

const NarrowStack = styled(Stack)({ maxInlineSize: '320px' });
const meta = {
  title: 'Data display/KeycapKeyboard',
  component: KeycapKeyboard,
  tags: ['autodocs'],
  args: { onValueChange: fn() },
  parameters: {
    docs: { sections: [
      { title: 'Typing feedback', stories: ['Default', 'Letters'] },
      { title: 'Shortcut illustrations', stories: ['CustomMacro', 'MacShortcut'] },
    ], source: { language: 'tsx', code: snippet }, description: { component:
      'Show a keyboard illustration with keys that respond to input.' },
      usage: '- The board uses Kbd caps and is decorative, hidden from assistive technology, with no tab stops or keyboard role.\n- Supply a native input for text and focus. Password inputs, composition and modifier shortcuts are not observed.\n- Supply shortcut text or Kbd.Group outside the board. Built-in rows illustrate ANSI geometry; they do not map an OS keyboard.' },
  },
  render: (args) => <TypingExample {...args} />,
} satisfies Meta<typeof KeycapKeyboard>;
export default meta;
type Story = StoryObj<typeof meta>;

function TypingExample(args: KeycapKeyboardProps) {
  const [input, setInput] = useState<HTMLInputElement | null>(null);
  return <Stack>
    <TextField label="Try the keyboard" ref={setInput} />
    <KeycapKeyboard {...args} eventTarget={input} />
    <Button>Continue</Button>
  </Stack>;
}

function board(container: HTMLElement) {
  const root = container.querySelector<HTMLElement>('[data-ui="keycap-keyboard"]');
  if (!root) throw new Error('Missing board');
  return root;
}
function cap(container: HTMLElement, code: string) {
  const key = container.querySelector<HTMLElement>(`[data-code="${code}"]`);
  if (!key) throw new Error(`Missing cap ${code}`);
  return key;
}

const REDUCED_MOTION_QUERY = 'prefers-reduced-motion: reduce';
const FORCED_COLORS_QUERY = 'forced-colors: active';
/** True when a stylesheet rule under `query` matching `element` sets `property` to `expected`. */
function mediaRuleSets(element: Element, query: string, property: string, expected: string) {
  return Array.from(element.ownerDocument.styleSheets).some((sheet) =>
    Array.from(sheet.cssRules).some((rule) => rule instanceof CSSMediaRule && rule.conditionText.includes(query) &&
      Array.from(rule.cssRules).some((inner) => inner instanceof CSSStyleRule && element.matches(inner.selectorText) &&
        inner.style.getPropertyValue(property).toLowerCase() === expected)));
}
function mediaActive(element: Element, query: string) {
  return element.ownerDocument.defaultView!.matchMedia(`(${query})`).matches;
}
/** The computed value of a system color, measured on a throwaway probe. */
function systemColor(container: HTMLElement, color: string) {
  const probe = container.ownerDocument.createElement('span');
  probe.style.color = color;
  container.append(probe);
  const value = getComputedStyle(probe).color;
  probe.remove();
  return value;
}

export const Default: Story = {
  name: 'Typing keyboard',
  parameters: { docs: { description: { story: 'Focus the text field and type to light up its keys.' } } },
  play: async ({ canvasElement, canvas }) => {
    await expect(board(canvasElement)).toHaveAttribute('aria-hidden', 'true');
    await expect(board(canvasElement).querySelectorAll('kbd')).toHaveLength(61);
    await expect(board(canvasElement).querySelectorAll('button,input,[tabindex]')).toHaveLength(0);
    await expect(canvas.getAllByRole('textbox')).toHaveLength(1);
    await expect(board(canvasElement).querySelectorAll('[data-ui="keycap-keyboard-row"]')).toHaveLength(5);
  },
};

export const KeyboardNoTrap: Story = {
  play: async ({ canvasElement, canvas, userEvent, args }) => {
    const input = canvas.getByRole('textbox', { name: 'Try the keyboard' });
    await userEvent.tab();
    await expect(input.ownerDocument.activeElement).toBe(input);
    await expect(getComputedStyle(input).outlineStyle).not.toBe('none');
    await expect(input.getBoundingClientRect().height).toBeGreaterThanOrEqual(31.5);
    await userEvent.keyboard('[KeyA>]');
    await expect(input).toHaveValue('a');
    await expect(cap(canvasElement, 'KeyA')).toHaveAttribute('data-state', 'pressed');
    fireEvent.keyDown(input, { code: 'KeyA', repeat: true });
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenNthCalledWith(1, ['KeyA']);
    await userEvent.keyboard('[/KeyA]');
    await expect(cap(canvasElement, 'KeyA')).toHaveAttribute('data-state', 'idle');
    await expect(args.onValueChange).toHaveBeenNthCalledWith(2, []);
    await userEvent.keyboard('[Backspace]');
    await expect(input).toHaveValue('');
    await userEvent.type(input, 'abc');
    await userEvent.keyboard('{Control>}a{/Control}');
    await expect((input as HTMLInputElement).selectionStart).toBe(0);
    await expect((input as HTMLInputElement).selectionEnd).toBe(3);
    await userEvent.keyboard('[Delete]');
    await expect(input).toHaveValue('');
    await userEvent.tab();
    const next = canvas.getByRole('button', { name: 'Continue' });
    await expect(input.ownerDocument.activeElement).toBe(next);
    await userEvent.tab({ shift: true });
    await expect(input.ownerDocument.activeElement).toBe(input);
  },
};

export const Letters: Story = {
  name: 'Letters only',
  args: { layout: 'letters', tone: 'neutral' },
  render: (args) => <LettersExample {...args} />,
  parameters: { docs: { description: { story: 'Show letter keys while writing a multiline note.' }, source: { language: 'tsx', code: `import { useState } from 'react';
import { KeycapKeyboard, Textarea, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const Stack = styled.div({ display: 'grid', gap: vars.space[4], inlineSize: '100%', maxInlineSize: '48rem' });

export function NoteKeyboard() {
  const [input, setInput] = useState<HTMLTextAreaElement | null>(null);
  return (
    <Stack>
      <Textarea label="Write a note" ref={setInput} />
      <KeycapKeyboard eventTarget={input} layout="letters" tone="neutral" />
    </Stack>
  );
}` } } },
  play: async ({ canvas, canvasElement, userEvent }) => {
    await userEvent.click(canvas.getByRole('textbox', { name: 'Write a note' }));
    await userEvent.keyboard('a[Enter]b');
    await expect(canvas.getByRole('textbox')).toHaveValue('a\nb');
    await expect(board(canvasElement).querySelectorAll('kbd')).toHaveLength(26);
  },
};
function LettersExample(args: KeycapKeyboardProps) {
  const [input, setInput] = useState<HTMLTextAreaElement | null>(null);
  return <Stack><Textarea label="Write a note" ref={setInput} /><KeycapKeyboard {...args} eventTarget={input} /></Stack>;
}

const macroRows: readonly (readonly KeycapSpec[])[] = [[
  { code: 'ControlLeft', legend: 'Ctrl', units: 1.5 }, { code: 'ShiftLeft', legend: '⇧' },
  { code: 'KeyK', legend: 'K' }, { code: 'Enter', legend: '↵', units: 1.5 },
]];
export const CustomMacro: Story = {
  name: 'Custom shortcut row',
  args: { rows: macroRows, value: ['ControlLeft', 'ShiftLeft', 'KeyK'] },
  render: (args) => <Stack><p>Search: <Kbd.Group><Kbd>Ctrl</Kbd><Kbd>Shift</Kbd><Kbd>K</Kbd></Kbd.Group></p><KeycapKeyboard {...args} /></Stack>,
  parameters: { docs: { description: { story: 'Pair a highlighted chord with a readable shortcut hint.' }, source: { language: 'tsx', code: `import { Kbd, KeycapKeyboard, styled, type KeycapSpec } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const Stack = styled.div({ display: 'grid', gap: vars.space[4], inlineSize: '100%', maxInlineSize: '48rem' });
const rows: readonly (readonly KeycapSpec[])[] = [[
  { code: 'ControlLeft', legend: 'Ctrl', units: 1.5 },
  { code: 'ShiftLeft', legend: '⇧' },
  { code: 'KeyK', legend: 'K' },
  { code: 'Enter', legend: '↵', units: 1.5 },
]];

<Stack>
  <p>Search: <Kbd.Group><Kbd>Ctrl</Kbd><Kbd>Shift</Kbd><Kbd>K</Kbd></Kbd.Group></p>
  <KeycapKeyboard rows={rows} value={['ControlLeft', 'ShiftLeft', 'KeyK']} />
</Stack>` } } },
};
export const MacShortcut: Story = {
  name: 'Command shortcut',
  args: { rows: [[{ code: 'MetaLeft', legend: '⌘', units: 1.5 }, { code: 'KeyK', legend: 'K' }]], value: ['MetaLeft', 'KeyK'] },
  render: (args) => <Stack><p>Search: <Kbd.Group><Kbd>Command</Kbd><Kbd>K</Kbd></Kbd.Group></p><KeycapKeyboard {...args} /></Stack>,
  parameters: { docs: { description: { story: 'Use a Command legend with a full-text shortcut hint.' }, source: { language: 'tsx', code: `import { Kbd, KeycapKeyboard, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const Stack = styled.div({ display: 'grid', gap: vars.space[4], inlineSize: '100%', maxInlineSize: '48rem' });

<Stack>
  <p>Search: <Kbd.Group><Kbd>Command</Kbd><Kbd>K</Kbd></Kbd.Group></p>
  <KeycapKeyboard
    rows={[[{ code: 'MetaLeft', legend: '⌘', units: 1.5 }, { code: 'KeyK', legend: 'K' }]]}
    value={['MetaLeft', 'KeyK']}
  />
</Stack>` } } },
};

export const NoTarget: Story = {
  render: (args) => <KeycapKeyboard {...args} />,
  play: async ({ canvasElement, args }) => {
    fireEvent.keyDown(canvasElement.ownerDocument.defaultView!, { code: 'KeyA' });
    await expect(cap(canvasElement, 'KeyA')).toHaveAttribute('data-state', 'idle');
    await expect(args.onValueChange).not.toHaveBeenCalled();
  },
};
export const Paused: Story = {
  args: { paused: true, value: ['KeyK'] },
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    await userEvent.type(canvas.getByRole('textbox'), 'a');
    await expect(cap(canvasElement, 'KeyA')).toHaveAttribute('data-state', 'idle');
    await expect(cap(canvasElement, 'KeyK')).toHaveAttribute('data-state', 'pressed');
    await expect(args.onValueChange).not.toHaveBeenCalled();
  },
};

export const ControlledRejects: Story = {
  args: { value: [] },
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    await userEvent.click(canvas.getByRole('textbox'));
    await userEvent.keyboard('[KeyB>][KeyA>]');
    await expect(cap(canvasElement, 'KeyA')).toHaveAttribute('data-state', 'idle');
    await expect(args.onValueChange).toHaveBeenCalledTimes(2);
    await expect(args.onValueChange).toHaveBeenNthCalledWith(1, ['KeyB']);
    await expect(args.onValueChange).toHaveBeenNthCalledWith(2, ['KeyA', 'KeyB']);
    fireEvent.keyDown(canvas.getByRole('textbox'), { code: 'KeyA', repeat: true });
    await expect(args.onValueChange).toHaveBeenCalledTimes(2);
    await userEvent.tab();
    await expect(canvasElement.ownerDocument.activeElement).toBe(canvas.getByRole('button', { name: 'Continue' }));
    await expect(args.onValueChange).toHaveBeenCalledTimes(2);
    await userEvent.keyboard('[/KeyA][/KeyB]');
  },
};
export const ControlledAccepted: Story = {
  render: (args) => <AcceptedExample {...args} />,
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    await userEvent.click(canvas.getByRole('textbox'));
    await userEvent.keyboard('[KeyA>]');
    await expect(cap(canvasElement, 'KeyA')).toHaveAttribute('data-state', 'pressed');
    await userEvent.keyboard('[/KeyA]');
    await expect(cap(canvasElement, 'KeyA')).toHaveAttribute('data-state', 'idle');
    await expect(args.onValueChange).toHaveBeenCalledTimes(2);
    await userEvent.click(canvas.getByRole('button', { name: 'Show chord' }));
    await expect(cap(canvasElement, 'KeyK')).toHaveAttribute('data-state', 'pressed');
    await expect(args.onValueChange).toHaveBeenCalledTimes(2);
  },
};
function AcceptedExample(args: KeycapKeyboardProps) {
  const [value, setValue] = useState<readonly string[]>([]);
  return <Stack><TypingExample {...args} value={value} onValueChange={(codes) => { args.onValueChange?.(codes); setValue(codes); }} />
    <Button onClick={() => setValue(['KeyK', 'ControlLeft', 'KeyK'])}>Show chord</Button></Stack>;
}

export const BlurClears: Story = {
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    await userEvent.click(canvas.getByRole('textbox'));
    await userEvent.keyboard('[KeyA>]');
    await userEvent.tab();
    await expect(cap(canvasElement, 'KeyA')).toHaveAttribute('data-state', 'idle');
    await expect(args.onValueChange).toHaveBeenCalledTimes(2);
    fireEvent.blur(canvasElement.ownerDocument.defaultView!);
    await expect(args.onValueChange).toHaveBeenCalledTimes(2);
    await userEvent.keyboard('[/KeyA]');
  },
};
export const WindowBlur: Story = {
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    await userEvent.click(canvas.getByRole('textbox'));
    await userEvent.keyboard('[KeyA>]');
    fireEvent.blur(canvasElement.ownerDocument.defaultView!);
    await waitFor(async () => { await expect(cap(canvasElement, 'KeyA')).toHaveAttribute('data-state', 'idle'); });
    fireEvent.blur(canvasElement.ownerDocument.defaultView!);
    await expect(args.onValueChange).toHaveBeenCalledTimes(2);
    await userEvent.keyboard('[/KeyA]');
  },
};
export const PrivacyBoundaries: Story = {
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    const input = canvas.getByRole('textbox');
    await userEvent.click(input);
    await userEvent.keyboard('{Control>}k{/Control}{Alt>}a{/Alt}{Meta>}b{/Meta}');
    fireEvent.compositionStart(input);
    fireEvent.keyDown(input, { code: 'KeyA', isComposing: true });
    fireEvent.keyUp(input, { code: 'KeyA', isComposing: true });
    fireEvent.compositionEnd(input);
    fireEvent.keyDown(input, { code: '' });
    await expect(cap(canvasElement, 'KeyA')).toHaveAttribute('data-state', 'idle');
    await expect(args.onValueChange).not.toHaveBeenCalled();
  },
};
export const PasswordIgnored: Story = {
  render: (args) => <PasswordExample {...args} />,
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    await userEvent.type(canvas.getByLabelText('Password'), 'secret');
    await expect(board(canvasElement).querySelectorAll('[data-state="pressed"]')).toHaveLength(0);
    await expect(args.onValueChange).not.toHaveBeenCalled();
  },
};
function PasswordExample(args: KeycapKeyboardProps) {
  const [input, setInput] = useState<HTMLInputElement | null>(null);
  return <Stack><TextField label="Password" type="password" ref={setInput} /><KeycapKeyboard {...args} eventTarget={input} /></Stack>;
}

export const IndependentTargets: Story = {
  render: (args) => <Stack><TypingExample {...args} /><TypingExample {...args} /></Stack>,
  play: async ({ canvas, canvasElement, userEvent }) => {
    const inputs = canvas.getAllByRole('textbox');
    const boards = canvasElement.querySelectorAll<HTMLElement>('[data-ui="keycap-keyboard"]');
    await userEvent.click(inputs[0]!);
    await userEvent.keyboard('[KeyA>]');
    await expect(cap(boards[0]!, 'KeyA')).toHaveAttribute('data-state', 'pressed');
    await expect(cap(boards[1]!, 'KeyA')).toHaveAttribute('data-state', 'idle');
    await userEvent.click(inputs[1]!);
    await userEvent.keyboard('[/KeyA][KeyB>]');
    await expect(cap(boards[0]!, 'KeyA')).toHaveAttribute('data-state', 'idle');
    await expect(cap(boards[1]!, 'KeyB')).toHaveAttribute('data-state', 'pressed');
    await userEvent.keyboard('[/KeyB]');
  },
};
export const TargetUnmount: Story = {
  render: (args) => <StrictMode><UnmountExample {...args} /></StrictMode>,
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    const input = canvas.getByRole('textbox');
    await userEvent.click(input);
    await userEvent.keyboard('[KeyA>]');
    await userEvent.click(canvas.getByRole('button', { name: 'Remove input' }));
    await expect(cap(canvasElement, 'KeyA')).toHaveAttribute('data-state', 'idle');
    const calls = (args.onValueChange as ReturnType<typeof fn>).mock.calls.length;
    fireEvent.keyDown(input, { code: 'KeyB' });
    await expect(args.onValueChange).toHaveBeenCalledTimes(calls);
    await expect(cap(canvasElement, 'KeyB')).toHaveAttribute('data-state', 'idle');
    await userEvent.keyboard('[/KeyA]');
  },
};
function UnmountExample(args: KeycapKeyboardProps) {
  const [input, setInput] = useState<HTMLInputElement | null>(null);
  const [visible, setVisible] = useState(true);
  return <Stack>{visible && <TextField label="Try the keyboard" ref={setInput} />}
    <KeycapKeyboard {...args} eventTarget={input} /><Button onClick={() => setVisible(false)}>Remove input</Button></Stack>;
}

export const FalsyAndLongLegends: Story = {
  args: { rows: [[{ code: 'Digit0', legend: 0, units: 0 }, { code: 'KeyA', legend: false, units: NaN },
    { code: 'KeyB', legend: null, units: -1 }, { code: 'KeyC', legend: '', units: Infinity },
    { code: 'KeyD', legend: 'A very long custom legend', units: 3 }]] },
  render: (args) => <NarrowStack><KeycapKeyboard {...args} /></NarrowStack>,
  play: async ({ canvasElement }) => {
    await expect(cap(canvasElement, 'Digit0')).toHaveTextContent('0');
    for (const code of ['KeyA', 'KeyB', 'KeyC']) await expect(cap(canvasElement, code).children).toHaveLength(0);
    const long = cap(canvasElement, 'KeyD');
    const legend = long.firstElementChild!;
    await expect(legend.getBoundingClientRect().width).toBeLessThanOrEqual(long.getBoundingClientRect().width + 1);
    await expect(legend.getBoundingClientRect().height).toBeLessThanOrEqual(long.getBoundingClientRect().height + 1);
  },
};
export const NarrowContainer: Story = {
  render: (args) => <NarrowStack><TypingExample {...args} /></NarrowStack>,
  play: async ({ canvasElement }) => {
    const root = board(canvasElement);
    await expect(root.scrollWidth).toBeLessThanOrEqual(root.clientWidth + 1);
    await expect(root.getBoundingClientRect().width).toBeLessThanOrEqual(321);
  },
};
export const LightTheme: Story = { decorators: [withLightTheme], globals: { theme: 'light' }, args: { value: ['KeyK'] } };
export const RTL: Story = {
  args: { dir: 'rtl', rows: [[{ code: 'KeyA', legend: 'א' }, { code: 'KeyB', legend: 'ב' }]] },
  play: async ({ canvasElement }) => {
    await expect(getComputedStyle(board(canvasElement)).direction).toBe('rtl');
    await expect(cap(canvasElement, 'KeyA').getBoundingClientRect().left).toBeLessThan(cap(canvasElement, 'KeyB').getBoundingClientRect().left);
  },
};
export const ReducedMotion: Story = {
  args: { value: ['KeyA'] },
  parameters: { docs: { description: { story: 'Checks the authored reduced-motion rules. Computed transform and transition values are asserted only when the browser reports reduced motion.' } } },
  play: async ({ canvasElement }) => {
    const pressed = cap(canvasElement, 'KeyA');
    const idle = cap(canvasElement, 'KeyB');
    await expect(pressed).toHaveAttribute('data-state', 'pressed');
    await expect(mediaRuleSets(pressed, REDUCED_MOTION_QUERY, 'transform', 'none')).toBe(true);
    for (const key of [pressed, idle]) {
      await expect(mediaRuleSets(key, REDUCED_MOTION_QUERY, 'transition-duration', '0s')).toBe(true);
      await expect(getComputedStyle(key).animationName).toBe('none');
    }
    if (!mediaActive(canvasElement, REDUCED_MOTION_QUERY)) {
      await expect(getComputedStyle(pressed).transform).not.toBe('none');
      return;
    }
    for (const key of [pressed, idle]) {
      await expect(getComputedStyle(key).transform).toBe('none');
      await expect(getComputedStyle(key).transitionDuration).toBe('0s');
      await expect(getComputedStyle(key).animationDuration).toBe('0s');
    }
  },
};
export const ForcedColors: Story = {
  args: { value: ['KeyA'] },
  parameters: { docs: { description: { story: 'Checks the authored forced-colors rules. Computed system colors are asserted only when the browser reports forced colors.' } } },
  play: async ({ canvasElement }) => {
    const root = board(canvasElement);
    const pressed = cap(canvasElement, 'KeyA');
    const idle = cap(canvasElement, 'KeyB');
    await expect(mediaRuleSets(root, FORCED_COLORS_QUERY, 'background-color', 'canvas')).toBe(true);
    await expect(mediaRuleSets(root, FORCED_COLORS_QUERY, 'border-color', 'canvastext')).toBe(true);
    await expect(mediaRuleSets(idle, FORCED_COLORS_QUERY, 'background-color', 'buttonface')).toBe(true);
    await expect(mediaRuleSets(idle, FORCED_COLORS_QUERY, 'border-color', 'canvastext')).toBe(true);
    await expect(mediaRuleSets(pressed, FORCED_COLORS_QUERY, 'background-color', 'highlight')).toBe(true);
    await expect(mediaRuleSets(pressed, FORCED_COLORS_QUERY, 'color', 'highlighttext')).toBe(true);
    for (const key of [pressed, idle]) {
      await expect(getComputedStyle(key).borderBottomStyle).toBe('solid');
      // Fractional devicePixelRatios compute authored px borders as e.g. 2.23256px; assert a drawn edge.
      await expect(parseFloat(getComputedStyle(key).borderBottomWidth)).toBeGreaterThan(0);
    }
    if (!mediaActive(canvasElement, FORCED_COLORS_QUERY)) return;
    await expect(getComputedStyle(idle).backgroundColor).toBe(systemColor(canvasElement, 'ButtonFace'));
    await expect(getComputedStyle(idle).borderBottomColor).toBe(systemColor(canvasElement, 'CanvasText'));
    await expect(getComputedStyle(pressed).backgroundColor).toBe(systemColor(canvasElement, 'Highlight'));
    await expect(getComputedStyle(pressed).color).toBe(systemColor(canvasElement, 'HighlightText'));
  },
};
function SlotKey(props: ComponentPropsWithRef<'kbd'>) {
  return <kbd {...props} data-slot="keycap-keyboard-key" />;
}
function SlotLegend(props: ComponentPropsWithRef<'span'>) {
  return <span {...props} data-slot="keycap-keyboard-legend" />;
}
// This story tests styles and refs forwarded through the slot API.
export const StylingAndRef: Story = {
  args: {
    slots: { key: SlotKey, legend: SlotLegend },
    ref: fn(), 'aria-label': 'Consumer label', 'aria-labelledby': 'external-label missing-label', 'aria-describedby': 'external-description',
    sx: { padding: vars.space[4] },
    slotProps: { row: { sx: { rowGap: vars.space[3] } }, key: { sx: { borderRadius: 0 } }, legend: { sx: { fontWeight: vars.fontWeight.semibold } } },
  },
  render: (args) => <Stack><p id="external-label">Keyboard illustration</p><p id="external-description">Physical keys</p><KeycapKeyboard {...args} /></Stack>,
  play: async ({ canvasElement, args }) => {
    const root = board(canvasElement);
    await expect(args.ref).toHaveBeenCalledWith(root);
    const replacement = root.querySelector('[data-slot="keycap-keyboard-key"][data-code="KeyA"]')!;
    await expect(replacement).toBeInTheDocument();
    await expect(replacement).toHaveAttribute('data-state', 'idle');
    await expect(getComputedStyle(replacement).justifyContent).toBe('center');
    await expect(root.querySelector('kbd:not([data-slot])')).toBeNull();
    const legend = replacement.querySelector('[data-slot="keycap-keyboard-legend"]')!;
    await expect(legend).toBeInTheDocument();
    await expect(legend).toHaveAttribute('data-ui', 'keycap-keyboard-legend');
    await expect(getComputedStyle(legend).overflowWrap).toBe('anywhere');
    await expect(root.querySelector('[data-ui="keycap-keyboard-legend"]:not([data-slot])')).toBeNull();
    await expect(root).toHaveAttribute('aria-label', 'Consumer label');
    await expect(root).toHaveAttribute('aria-labelledby', 'external-label missing-label');
    await expect(root).toHaveAttribute('aria-describedby', 'external-description');
    await expect(getComputedStyle(root).paddingTop).toBe('16px');
    await expect(getComputedStyle(cap(root, 'KeyA')).borderRadius).toBe('0px');
    await expect(getComputedStyle(cap(root, 'KeyA').firstElementChild!).fontWeight).toBe('600');
    await expect(getComputedStyle(root.querySelector('[data-ui="keycap-keyboard-row"]')!).rowGap).toBe('12px');
  },
};

export const TargetSwitchAndPause: Story = {
  render: (args) => <StrictMode><ScopeExample {...args} /></StrictMode>,
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    const first = canvas.getByRole('textbox', { name: 'First input' });
    const second = canvas.getByRole('textbox', { name: 'Second input' });
    await userEvent.click(first);
    await userEvent.keyboard('[KeyA>]');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await userEvent.click(canvas.getByRole('button', { name: 'Observe second' }));
    await expect(cap(canvasElement, 'KeyA')).toHaveAttribute('data-state', 'idle');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(first, { code: 'KeyB' });
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await userEvent.keyboard('[/KeyA]');
    await userEvent.click(second);
    await userEvent.keyboard('[KeyB>]');
    await expect(cap(canvasElement, 'KeyB')).toHaveAttribute('data-state', 'pressed');
    await userEvent.click(canvas.getByRole('button', { name: 'Pause' }));
    await expect(cap(canvasElement, 'KeyB')).toHaveAttribute('data-state', 'idle');
    await expect(args.onValueChange).toHaveBeenCalledTimes(2);
    fireEvent.keyDown(second, { code: 'KeyC' });
    await expect(args.onValueChange).toHaveBeenCalledTimes(2);
    await userEvent.keyboard('[/KeyB]');
  },
};
function ScopeExample(args: KeycapKeyboardProps) {
  const [first, setFirst] = useState<HTMLInputElement | null>(null);
  const [second, setSecond] = useState<HTMLInputElement | null>(null);
  const [observeSecond, setObserveSecond] = useState(false);
  const [paused, setPaused] = useState(false);
  return <Stack>
    <TextField label="First input" ref={setFirst} /><TextField label="Second input" ref={setSecond} />
    <KeycapKeyboard {...args} eventTarget={observeSecond ? second : first} paused={paused} />
    <Button onMouseDown={(event) => event.preventDefault()} onClick={() => setObserveSecond(true)}>Observe second</Button>
    <Button onMouseDown={(event) => event.preventDefault()} onClick={() => setPaused(true)}>Pause</Button>
  </Stack>;
}

export const ControlledBlurOnce: Story = {
  args: { value: ['KeyA'] },
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    await userEvent.click(canvas.getByRole('textbox'));
    await userEvent.tab();
    fireEvent.blur(canvasElement.ownerDocument.defaultView!);
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenCalledWith([]);
    await expect(cap(canvasElement, 'KeyA')).toHaveAttribute('data-state', 'pressed');
  },
};

export const DocumentHidden: Story = {
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    const doc = canvasElement.ownerDocument;
    const descriptor = Object.getOwnPropertyDescriptor(doc, 'visibilityState');
    await userEvent.click(canvas.getByRole('textbox'));
    await userEvent.keyboard('[KeyA>]');
    try {
      Object.defineProperty(doc, 'visibilityState', { configurable: true, value: 'hidden' });
      fireEvent(doc, new Event('visibilitychange'));
      await waitFor(async () => { await expect(cap(canvasElement, 'KeyA')).toHaveAttribute('data-state', 'idle'); });
      fireEvent(doc, new Event('visibilitychange'));
      await expect(args.onValueChange).toHaveBeenCalledTimes(2);
    } finally {
      if (descriptor) Object.defineProperty(doc, 'visibilityState', descriptor);
      else Reflect.deleteProperty(doc, 'visibilityState');
    }
    await userEvent.keyboard('[/KeyA]');
  },
};

export const DefaultActiveSet: Story = {
  args: { defaultValue: ['KeyK', 'KeyA', 'KeyK'] },
  render: (args) => <StrictMode><KeycapKeyboard {...args} /></StrictMode>,
  play: async ({ canvasElement, args }) => {
    await expect(board(canvasElement).querySelectorAll('[data-state="pressed"]')).toHaveLength(2);
    await expect(args.onValueChange).not.toHaveBeenCalled();
  },
};

export const RefCleanup: Story = {
  args: { ref: fn(() => fn()) },
  render: (args) => <StrictMode><RefExample {...args} /></StrictMode>,
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    const spy = args.ref as ReturnType<typeof fn>;
    await expect(spy.mock.calls.at(-1)?.[0]).toBe(board(canvasElement));
    const cleanup = spy.mock.results.at(-1)?.value;
    await expect(cleanup).not.toHaveBeenCalled();
    await userEvent.click(canvas.getByRole('button', { name: 'Remove board' }));
    await expect(cleanup).toHaveBeenCalledTimes(1);
  },
};
function RefExample(args: KeycapKeyboardProps) {
  const [visible, setVisible] = useState(true);
  return <Stack>{visible && <KeycapKeyboard {...args} />}<Button onClick={() => setVisible(false)}>Remove board</Button></Stack>;
}

function KeyboardRow(props: ComponentPropsWithRef<'div'>) {
  return <div {...props} data-slot="keyboard-row" />;
}

export const RowSlot: Story = {
  parameters: { docs: { source: { language: 'tsx', code: `import { useState, type ComponentPropsWithRef } from 'react';
import { Button, KeycapKeyboard, TextField, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const Stack = styled.div({ display: 'grid', gap: vars.space[4], inlineSize: '100%', maxInlineSize: '48rem' });

function KeyboardRow(props: ComponentPropsWithRef<'div'>) {
  return <div {...props} data-slot="keyboard-row" />;
}

export function Typing() {
  const [input, setInput] = useState<HTMLInputElement | null>(null);
  return (
    <Stack>
      <TextField label="Try the keyboard" ref={setInput} />
      <KeycapKeyboard eventTarget={input} slots={{ row: KeyboardRow }} slotProps={{ row: { className: 'custom-row' } }} />
      <Button>Continue</Button>
    </Stack>
  );
}` } } },
  args: { slots: { row: KeyboardRow }, slotProps: { row: { className: 'custom-row' } } },
  play: async ({ canvasElement }) => {
    const rows = board(canvasElement).querySelectorAll<HTMLElement>('[data-ui="keycap-keyboard-row"]');
    await expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      await expect(row).toHaveAttribute('data-slot', 'keyboard-row');
      await expect(row).toHaveClass('custom-row');
      await expect(getComputedStyle(row).display).toBe('grid');
      await expect(row.style.gridTemplateColumns).not.toBe('');
    }
  },
};
