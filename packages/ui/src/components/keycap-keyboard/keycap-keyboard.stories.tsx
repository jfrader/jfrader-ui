import { StrictMode, useEffect, useState, type ComponentPropsWithRef } from 'react';
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
const CompactStack = styled(Stack)({ maxInlineSize: '14rem' });
const meta = {
  title: 'Data display/KeycapKeyboard',
  component: KeycapKeyboard,
  tags: ['autodocs'],
  args: { onValueChange: fn() },
  parameters: {
    layout: 'padded',
    docs: { sections: [
      { title: 'Typing feedback', stories: ['Default', 'Letters'] },
      { title: 'On-screen keyboard', stories: ['Interactive', 'InteractiveNote'] },
      { title: 'Shortcut illustrations', stories: ['CustomMacro', 'MacShortcut'] },
    ], source: { language: 'tsx', code: snippet }, description: { component:
      'Show a keyboard that lights up as you type, or type by pressing its keys.' },
      usage: `### When to use
- Use the default \`visualizer\` mode to light keys typed in a field. The board is decorative, hidden from assistive technology, with no tab stops.
- Use \`mode="interactive"\` for an on-screen keyboard that types into \`eventTarget\`.
- Supply shortcut text or Kbd.Group outside the board. Built-in rows follow ANSI geometry; they do not map an OS keyboard.

### Typing
- Character keys insert at the field's caret and replace a selection. Backspace deletes the selection or the previous character.
- Enter adds a line in a textarea and submits an input's form. Tab, Ctrl, Alt, Meta and Menu do not type.
- Shift applies to the next key; press it again to release. Caps Lock toggles letter case until you press it again.
- Keys do not type while an input method is composing text, or into a disabled or read-only field. \`maxLength\` and a canceled \`beforeinput\` are respected.
- Password inputs, composition and modifier shortcuts are not observed for pressed keys.

### Keyboard and accessibility
- Pressing a key with a pointer keeps focus and the caret in the field.
- The board is one tab stop. Left and Right move along a row, Up and Down move to the nearest key in the next row, and Home and End move to the row's ends. Enter or Space presses the focused key.
- Give keys with non-text legends a \`label\`. Shift and Caps Lock report their pressed state; the field announces its own text.` },
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
  const key = container.querySelector<HTMLElement>(`[data-code="${code}"]:not(button)`);
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
    const rows = board(canvasElement).querySelectorAll('[data-ui="keycap-keyboard-row"]');
    const firstRow = rows[0]!.getBoundingClientRect();
    for (const row of rows) {
      await expect(Math.abs(row.getBoundingClientRect().width - firstRow.width)).toBeLessThan(1);
    }
    const unit = cap(canvasElement, 'Digit1').getBoundingClientRect().width;
    for (const code of ['KeyQ', 'KeyA', 'KeyZ']) {
      await expect(Math.abs(cap(canvasElement, code).getBoundingClientRect().width - unit)).toBeLessThan(1);
    }
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

function key(container: HTMLElement, code: string) {
  const button = container.querySelector<HTMLButtonElement>(`button[data-code="${code}"]`);
  if (!button) throw new Error(`Missing key button ${code}`);
  return button;
}

export const Interactive: Story = {
  name: 'On-screen keyboard',
  args: { mode: 'interactive' },
  parameters: { docs: { description: { story: 'Press the keys to type into the field.' }, source: { language: 'tsx', code: `import { useState } from 'react';
import { Button, KeycapKeyboard, TextField, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const Stack = styled.div({ display: 'grid', gap: vars.space[4], inlineSize: '100%', maxInlineSize: '48rem' });

export function OnScreenKeyboard() {
  const [input, setInput] = useState<HTMLInputElement | null>(null);
  return (
    <Stack>
      <TextField label="Try the keyboard" ref={setInput} />
      <KeycapKeyboard mode="interactive" eventTarget={input} />
      <Button>Continue</Button>
    </Stack>
  );
}` } } },
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    const input = canvas.getByRole('textbox', { name: 'Try the keyboard' }) as HTMLInputElement;
    const group = canvas.getByRole('group', { name: 'Keyboard' });
    await expect(board(canvasElement)).not.toHaveAttribute('aria-hidden');
    await expect(group).toBe(board(canvasElement));
    await expect(canvas.getByRole('button', { name: 'Backspace' })).toBeInTheDocument();
    await expect(canvas.getAllByRole('button', { name: 'Shift' })).toHaveLength(2);
    await expect(cap(canvasElement, 'ControlLeft')).toHaveAttribute('aria-hidden', 'true');
    await expect(canvasElement.querySelector('button[data-code="Tab"]')).toBeNull();
    await userEvent.click(input);
    await userEvent.click(key(canvasElement, 'KeyH'));
    await userEvent.click(key(canvasElement, 'KeyI'));
    await expect(input).toHaveValue('hi');
    await expect(input.ownerDocument.activeElement).toBe(input);
    const shift = key(canvasElement, 'ShiftLeft');
    await userEvent.click(shift);
    await expect(shift).toHaveAttribute('aria-pressed', 'true');
    await expect(cap(canvasElement, 'ShiftLeft')).toHaveAttribute('data-state', 'pressed');
    await expect(key(canvasElement, 'ShiftRight')).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(key(canvasElement, 'Digit1'));
    await expect(input).toHaveValue('hi!');
    await expect(shift).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(key(canvasElement, 'Space'));
    await userEvent.click(key(canvasElement, 'Digit1'));
    await expect(input).toHaveValue('hi! 1');
    await userEvent.click(key(canvasElement, 'Backspace'));
    await userEvent.click(key(canvasElement, 'Backspace'));
    await expect(input).toHaveValue('hi!');
    input.setSelectionRange(0, 2);
    await userEvent.click(key(canvasElement, 'KeyY'));
    await expect(input).toHaveValue('y!');
    await expect([input.selectionStart, input.selectionEnd]).toEqual([1, 1]);
    // Board presses are visual only; the pressed-key value tracks physical keys.
    await expect(args.onValueChange).not.toHaveBeenCalled();
  },
};

export const InteractiveCapsLock: Story = {
  args: { mode: 'interactive' },
  play: async ({ canvas, canvasElement, userEvent }) => {
    const input = canvas.getByRole('textbox') as HTMLInputElement;
    const caps = canvas.getByRole('button', { name: 'Caps Lock' });
    await userEvent.click(caps);
    await expect(caps).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(key(canvasElement, 'KeyA'));
    await userEvent.click(key(canvasElement, 'Digit2'));
    await userEvent.click(key(canvasElement, 'ShiftLeft'));
    await userEvent.click(key(canvasElement, 'KeyB'));
    await expect(input).toHaveValue('A2b');
    await expect(caps).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(caps);
    await userEvent.click(key(canvasElement, 'KeyC'));
    await expect(input).toHaveValue('A2bc');
    await expect(caps).toHaveAttribute('aria-pressed', 'false');
  },
};

export const InteractiveKeyboard: Story = {
  args: { mode: 'interactive' },
  play: async ({ canvas, canvasElement, userEvent }) => {
    const input = canvas.getByRole('textbox') as HTMLInputElement;
    const doc = canvasElement.ownerDocument;
    await userEvent.tab();
    await expect(doc.activeElement).toBe(input);
    await userEvent.tab();
    const first = key(canvasElement, 'Backquote');
    await expect(doc.activeElement).toBe(first);
    await expect(getComputedStyle(first).outlineStyle).not.toBe('none');
    await expect(first.getBoundingClientRect().height).toBeGreaterThanOrEqual(31.5);
    await expect(board(canvasElement).querySelectorAll('button[tabindex="0"]')).toHaveLength(1);
    await userEvent.keyboard('{ArrowRight}');
    await expect(doc.activeElement).toBe(key(canvasElement, 'Digit1'));
    await userEvent.keyboard('{ArrowDown}');
    await expect(doc.activeElement).toBe(key(canvasElement, 'KeyQ'));
    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard(' ');
    await expect(input).toHaveValue('qq');
    await expect(doc.activeElement).toBe(key(canvasElement, 'KeyQ'));
    await userEvent.keyboard('{End}');
    await expect(doc.activeElement).toBe(key(canvasElement, 'Backslash'));
    await userEvent.keyboard('{ArrowRight}');
    await expect(doc.activeElement).toBe(key(canvasElement, 'KeyQ'));
    await userEvent.keyboard('{ArrowDown}');
    await expect(doc.activeElement).toBe(key(canvasElement, 'KeyA'));
    await userEvent.keyboard('{ArrowUp}');
    await expect(doc.activeElement).toBe(key(canvasElement, 'KeyQ'));
    await userEvent.keyboard('{ArrowDown}{ArrowDown}');
    await expect(doc.activeElement).toBe(key(canvasElement, 'KeyZ'));
    await userEvent.keyboard('{ArrowDown}{ArrowDown}');
    await expect(doc.activeElement).toBe(key(canvasElement, 'Space'));
    await userEvent.keyboard('[Enter>]');
    await expect(cap(canvasElement, 'Space')).toHaveAttribute('data-state', 'pressed');
    await userEvent.keyboard('[/Enter]');
    await expect(cap(canvasElement, 'Space')).toHaveAttribute('data-state', 'idle');
    await expect(input).toHaveValue('qq ');
    await userEvent.tab();
    await expect(doc.activeElement).toBe(canvas.getByRole('button', { name: 'Continue' }));
    await userEvent.tab({ shift: true });
    await expect(doc.activeElement).toBe(key(canvasElement, 'Space'));
  },
};

export const InteractivePointerAndPhysical: Story = {
  args: { mode: 'interactive' },
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    const input = canvas.getByRole('textbox');
    await userEvent.pointer({ keys: '[MouseLeft>]', target: key(canvasElement, 'KeyK') });
    await expect(cap(canvasElement, 'KeyK')).toHaveAttribute('data-state', 'pressed');
    await expect(input).toHaveValue('');
    await userEvent.pointer({ keys: '[/MouseLeft]', target: key(canvasElement, 'KeyK') });
    await expect(cap(canvasElement, 'KeyK')).toHaveAttribute('data-state', 'idle');
    await expect(input).toHaveValue('k');
    await userEvent.click(input);
    await userEvent.keyboard('[KeyJ>]');
    await expect(cap(canvasElement, 'KeyJ')).toHaveAttribute('data-state', 'pressed');
    await expect(args.onValueChange).toHaveBeenLastCalledWith(['KeyJ']);
    await userEvent.keyboard('[/KeyJ]');
    await expect(cap(canvasElement, 'KeyJ')).toHaveAttribute('data-state', 'idle');
    await expect(input).toHaveValue('kj');
  },
};

export const InteractiveComposition: Story = {
  args: { mode: 'interactive' },
  play: async ({ canvas, canvasElement, userEvent }) => {
    const input = canvas.getByRole('textbox');
    await userEvent.click(input);
    fireEvent.compositionStart(input);
    await userEvent.click(key(canvasElement, 'KeyA'));
    await userEvent.click(key(canvasElement, 'Backspace'));
    await expect(input).toHaveValue('');
    fireEvent.compositionEnd(input);
    await userEvent.click(key(canvasElement, 'KeyA'));
    await expect(input).toHaveValue('a');
  },
};

export const InteractiveControlled: Story = {
  args: { mode: 'interactive' },
  render: (args) => <ControlledFieldExample {...args} />,
  play: async ({ canvas, canvasElement, userEvent }) => {
    await userEvent.click(key(canvasElement, 'KeyO'));
    await userEvent.click(key(canvasElement, 'KeyK'));
    await expect(canvas.getByRole('textbox')).toHaveValue('OK');
    await expect(canvas.getByText('Saved: OK')).toBeInTheDocument();
    await userEvent.click(key(canvasElement, 'KeyZ'));
    await expect(canvas.getByRole('textbox')).toHaveValue('OK');
    await userEvent.click(key(canvasElement, 'Backspace'));
    await expect(canvas.getByText('Saved: O')).toBeInTheDocument();
  },
};
const MAX_CODE_LENGTH = 2;
function ControlledFieldExample(args: KeycapKeyboardProps) {
  const [input, setInput] = useState<HTMLInputElement | null>(null);
  const [text, setText] = useState('');
  return <Stack>
    <TextField label="Code" ref={setInput} value={text} maxLength={MAX_CODE_LENGTH} onChange={(event) => setText(event.currentTarget.value.toUpperCase())} />
    <p>Saved: {text}</p>
    <KeycapKeyboard {...args} eventTarget={input} />
  </Stack>;
}

export const InteractiveBoundaries: Story = {
  args: { mode: 'interactive' },
  render: (args) => <BoundariesExample {...args} />,
  play: async ({ canvas, canvasElement, userEvent }) => {
    const [vetoed, readOnly] = canvas.getAllByRole('textbox');
    const boards = canvasElement.querySelectorAll<HTMLElement>('[data-ui="keycap-keyboard"]');
    await userEvent.click(key(boards[0]!, 'KeyA'));
    await userEvent.click(key(boards[0]!, 'Digit1'));
    await expect(vetoed).toHaveValue('1');
    await userEvent.click(key(boards[1]!, 'KeyA'));
    await userEvent.click(key(boards[1]!, 'Backspace'));
    await expect(readOnly).toHaveValue('fixed');
  },
};
function BoundariesExample(args: KeycapKeyboardProps) {
  const [digits, setDigits] = useState<HTMLInputElement | null>(null);
  const [fixed, setFixed] = useState<HTMLInputElement | null>(null);
  // React's onBeforeInput is not the native event; a native listener can veto the edit.
  useEffect(() => {
    if (!digits) return;
    const veto = (event: InputEvent) => { if (event.data !== null && /\D/.test(event.data)) event.preventDefault(); };
    digits.addEventListener('beforeinput', veto);
    return () => digits.removeEventListener('beforeinput', veto);
  }, [digits]);
  return <Stack>
    <TextField label="Digits" ref={setDigits} />
    <KeycapKeyboard {...args} eventTarget={digits} />
    <TextField label="Fixed" ref={setFixed} readOnly defaultValue="fixed" />
    <KeycapKeyboard {...args} eventTarget={fixed} aria-label="Fixed keyboard" />
  </Stack>;
}

export const InteractiveNote: Story = {
  name: 'On-screen note keyboard',
  args: { mode: 'interactive', layout: 'letters', tone: 'neutral' },
  render: (args) => <LettersExample {...args} />,
  parameters: { docs: { description: { story: 'Press letter keys to write into a note.' }, source: { language: 'tsx', code: `import { useState } from 'react';
import { KeycapKeyboard, Textarea, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const Stack = styled.div({ display: 'grid', gap: vars.space[4], inlineSize: '100%', maxInlineSize: '48rem' });

export function NoteKeyboard() {
  const [input, setInput] = useState<HTMLTextAreaElement | null>(null);
  return (
    <Stack>
      <Textarea label="Write a note" ref={setInput} />
      <KeycapKeyboard mode="interactive" eventTarget={input} layout="letters" tone="neutral" />
    </Stack>
  );
}` } } },
  play: async ({ canvas, canvasElement, userEvent }) => {
    await expect(board(canvasElement).querySelectorAll('button')).toHaveLength(26);
    await userEvent.click(key(canvasElement, 'KeyN'));
    await userEvent.click(key(canvasElement, 'KeyO'));
    await expect(canvas.getByRole('textbox', { name: 'Write a note' })).toHaveValue('no');
  },
};

export const InteractiveTextarea: Story = {
  args: { mode: 'interactive' },
  render: (args) => <TextareaExample {...args} />,
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    const textarea = canvas.getByRole('textbox') as HTMLTextAreaElement;
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    await userEvent.click(key(canvasElement, 'Backspace'));
    await expect(textarea).toHaveValue('ok');
    await userEvent.click(key(canvasElement, 'Enter'));
    await userEvent.click(key(canvasElement, 'KeyA'));
    await expect(textarea).toHaveValue('ok\na');
    await expect(args.onValueChange).not.toHaveBeenCalled();
  },
};
const THUMBS_UP_MEDIUM = 'ok\u{1F44D}\u{1F3FD}';
function TextareaExample(args: KeycapKeyboardProps) {
  const [input, setInput] = useState<HTMLTextAreaElement | null>(null);
  return <Stack><Textarea label="Write a note" ref={setInput} defaultValue={THUMBS_UP_MEDIUM} /><KeycapKeyboard {...args} eventTarget={input} /></Stack>;
}

export const InteractiveFormSubmit: Story = {
  args: { mode: 'interactive' },
  render: (args) => <FormExample {...args} />,
  play: async ({ canvas, canvasElement, userEvent }) => {
    await userEvent.click(key(canvasElement, 'KeyX'));
    await userEvent.click(key(canvasElement, 'Enter'));
    await expect(canvas.getByText('Searched: x')).toBeInTheDocument();
    await expect(canvas.getByRole('textbox')).toHaveValue('x');
  },
};
function FormExample(args: KeycapKeyboardProps) {
  const [input, setInput] = useState<HTMLInputElement | null>(null);
  const [searched, setSearched] = useState<string | null>(null);
  return <form aria-label="Search" onSubmit={(event) => { event.preventDefault(); setSearched(String(new FormData(event.currentTarget).get('q'))); }}>
    <Stack><TextField label="Search" name="q" ref={setInput} /><KeycapKeyboard {...args} eventTarget={input} />
      {searched !== null && <p>Searched: {searched}</p>}</Stack>
  </form>;
}

export const VisualizerDoesNotType: Story = {
  play: async ({ canvas, canvasElement, userEvent }) => {
    const input = canvas.getByRole('textbox');
    await userEvent.click(input);
    fireEvent.click(cap(canvasElement, 'KeyA'));
    fireEvent.pointerDown(cap(canvasElement, 'KeyA'));
    await expect(input).toHaveValue('');
    await expect(cap(canvasElement, 'KeyA')).toHaveAttribute('data-state', 'idle');
    await expect(board(canvasElement).querySelectorAll('button')).toHaveLength(0);
    await expect(canvas.queryByRole('group')).toBeNull();
  },
};

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
export const CompactPreview: Story = {
  name: 'Compact preview',
  render: (args) => <CompactStack><KeycapKeyboard {...args} /></CompactStack>,
  play: async ({ canvasElement }) => {
    const root = board(canvasElement);
    await expect(root.scrollWidth).toBeLessThanOrEqual(root.clientWidth + 1);
    for (const legend of root.querySelectorAll('[data-ui="keycap-keyboard-legend"]')) {
      await expect(legend.scrollWidth).toBeLessThanOrEqual(legend.clientWidth + 1);
    }
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
