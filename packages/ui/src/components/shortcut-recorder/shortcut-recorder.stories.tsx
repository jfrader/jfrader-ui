import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, fireEvent } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { css } from '../../styling/css';
import { withLightTheme } from '../../testing/story-decorators';
import { Button } from '../button';
import {
  ShortcutRecorder,
  normalizeShortcut,
  matchesShortcut,
  formatShortcut,
  defaultShortcutMessages,
  type ShortcutRecorderProps,
  type ShortcutListGroup,
} from './index';

const stackStyle = css({
  display: 'grid',
  gap: vars.space[4],
  maxInlineSize: '36rem',
});
const bindings = [{ shortcut: 'mod+p', label: 'Print' }];
const groups: readonly ShortcutListGroup[] = [
  {
    label: 'Navigation',
    items: [
      { label: 'Open search', shortcut: 'mod+k', keywords: 'find' },
      { label: 'Go back', shortcut: 'alt+arrowleft' },
    ],
  },
  {
    label: 'Editing',
    items: [
      { label: 'Print', shortcut: 'mod+p' },
      { label: 'Éditer', shortcut: 'mod+e' },
    ],
  },
];
const meta = {
  title: 'Inputs/ShortcutRecorder',
  component: ShortcutRecorder,
  tags: ['autodocs'],
  args: {
    label: 'Open search',
    defaultValue: 'mod+k',
    platform: 'other',
    onValueChange: fn(),
    onRecordingChange: fn(),
  },
  decorators: [
    (Story) => (
      <div css={stackStyle}>
        <Story />
      </div>
    ),
  ],
  parameters: {
    docs: {
      description: {
        component:
          'Records physical keyboard codes while the button is focused. Tab and Shift+Tab exit recording; Escape cancels; bare Backspace/Delete clear. Modified control keys remain valid chords. Platform detection uses an other-platform server snapshot: provide platform for exact first-paint caps. Key terminology and action messages are caller-localizable. Read-only controls remain focusable. Reserved bindings are caller-supplied advisories; browser and OS shortcuts may never reach the page. Confirming an application conflict reports the replaced binding; the caller owns unbinding it.',
      },
      source: {
        code: '<ShortcutRecorder label="Open search" defaultValue="mod+k" resetValue="mod+k" onValueChange={saveShortcut} />',
      },
    },
  },
} satisfies Meta<typeof ShortcutRecorder>;
export default meta;
type Story = StoryObj<typeof meta>;

function ControlledRecorder(args: ShortcutRecorderProps) {
  const [value, setValue] = useState<string | null>(args.defaultValue ?? null);
  const [recording, setRecording] = useState(false);
  return (
    <ShortcutRecorder
      {...args}
      value={value}
      recording={recording}
      onValueChange={(next, details) => {
        args.onValueChange?.(next, details);
        setValue(next);
      }}
      onRecordingChange={(next) => {
        args.onRecordingChange?.(next);
        setRecording(next);
      }}
    />
  );
}
export const Default: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('button', { name: 'Open search Control + K' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  },
};
export const Controlled: Story = {
  render: (args) => <ControlledRecorder {...args} />,
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: /Open search/ }));
    await userEvent.keyboard('{Control>}[KeyP]{/Control}');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenCalledWith('mod+p', {});
    await expect(args.onRecordingChange).toHaveBeenNthCalledWith(1, true);
    await expect(args.onRecordingChange).toHaveBeenNthCalledWith(2, false);
    await expect(args.onRecordingChange).toHaveBeenCalledTimes(2);
    await expect(args.onRecordingChange!.mock.invocationCallOrder[1]).toBeLessThan(
      args.onValueChange!.mock.invocationCallOrder[0]!,
    );
    await expect(canvas.getByRole('button', { name: /Open search/ })).toHaveAccessibleName(
      'Open search Control + P',
    );
  },
};
export const RecordingControlled: Story = {
  args: { recording: true },
  play: async ({ canvas, userEvent, args }) => {
    const recorder = canvas.getByRole('button', { name: /Open search/ });
    await userEvent.tab();
    await userEvent.keyboard('{Escape}');
    await expect(args.onRecordingChange).toHaveBeenCalledTimes(1);
    await expect(args.onRecordingChange).toHaveBeenCalledWith(false);
    await expect(recorder).toHaveAttribute('aria-pressed', 'true');
    await userEvent.keyboard('{Control>}[KeyP]{/Control}');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenCalledWith('mod+p', {});
    await expect(recorder).toHaveAttribute('aria-pressed', 'true');
  },
};
export const Sizes: Story = {
  render: (args) => (
    <>
      {(['sm', 'md', 'lg'] as const).map((size) => (
        <ShortcutRecorder {...args} key={size} label={size} size={size} />
      ))}
    </>
  ),
  play: async ({ canvas }) => {
    for (const [size, height] of [
      ['sm', 32],
      ['md', 40],
      ['lg', 48],
    ] as const) {
      await expect(
        canvas.getByRole('button', { name: new RegExp(`^${size} `) }).getBoundingClientRect()
          .height,
      ).toBeGreaterThanOrEqual(height - 1);
    }
  },
};
export const Mac: Story = {
  args: { platform: 'mac', defaultValue: 'mod+ctrl+alt+shift+k' },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('kbd')).toHaveTextContent('⌘');
  },
};
export const Other: Story = {};
export const Cleared: Story = { args: { defaultValue: null } };
export const Reset: Story = {
  args: { resetValue: null },
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Reset to No shortcut' }));
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenCalledWith(null, {});
    await userEvent.click(canvas.getByRole('button', { name: 'Reset to No shortcut' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Clear shortcut' }));
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
  },
};
export const ModifierRequired: Story = {
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: /Open search/ }));
    await userEvent.keyboard('a{Enter} ');
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await expect(canvas.getByRole('status')).toHaveTextContent(
      'Use Control, Meta or Alt, or a function key',
    );
    await expect(canvas.getByRole('button', { name: /Open search/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    fireEvent.keyDown(canvas.getByRole('button', { name: /Open search/ }), {
      code: 'F24',
      key: 'F24',
    });
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenCalledWith('f24', {});
  },
};
export const ModifierFree: Story = {
  args: { requireModifier: false },
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: /Open search/ }));
    await userEvent.keyboard(' ');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenCalledWith('space', {});
    await expect(canvas.getByRole('button', { name: /Open search/ })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  },
};
export const Conflict: Story = {
  args: { bindings },
  play: async ({ canvas, userEvent, args }) => {
    const recorder = canvas.getByRole('button', { name: /Open search/ });
    await userEvent.click(recorder);
    await userEvent.keyboard('{Control>}[KeyP]{/Control}');
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await expect(
      canvas.getByRole('button', { name: 'Use anyway' }).closest('[role="status"]'),
    ).toBeNull();
    await userEvent.click(canvas.getByRole('button', { name: 'Cancel' }));
    await expect(recorder.ownerDocument.activeElement).toBe(recorder);
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await userEvent.click(recorder);
    await userEvent.keyboard('{Control>}[KeyP]{/Control}');
    await userEvent.click(canvas.getByRole('button', { name: 'Use anyway' }));
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenCalledWith('mod+p', {
      replaced: bindings[0],
    });
    await expect(recorder.ownerDocument.activeElement).toBe(recorder);
  },
};
export const ReservedAdvisory: Story = {
  args: {
    reservedBindings: [{ shortcut: 'mod+p', label: 'Browser print (advisory)' }],
  },
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: /Open search/ }));
    await userEvent.keyboard('{Control>}[KeyP]{/Control}');
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await userEvent.click(canvas.getByRole('button', { name: 'Use anyway' }));
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenCalledWith('mod+p', {});
  },
};
export const PersistentRecording: Story = { args: { recording: true } };
export const PersistentConflict: Story = {
  args: { bindings },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: /Open search/ }));
    await userEvent.keyboard('{Control>}[KeyP]{/Control}');
    await expect(canvas.getByRole('button', { name: 'Use anyway' })).toBeVisible();
  },
};
export const Disabled: Story = {
  args: { disabled: true },
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: /Open search/ }));
    await expect(args.onRecordingChange).not.toHaveBeenCalled();
    await expect(canvas.getByRole('button', { name: 'Clear shortcut' })).toBeDisabled();
  },
};
export const ReadOnly: Story = {
  args: { readOnly: true },
  play: async ({ canvas, userEvent, args }) => {
    const recorder = canvas.getByRole('button', { name: /Open search/ });
    await userEvent.tab();
    await expect(recorder.ownerDocument.activeElement).toBe(recorder);
    await userEvent.keyboard('{Enter}{Backspace}');
    await userEvent.click(canvas.getByRole('button', { name: 'Clear shortcut' }));
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await expect(args.onRecordingChange).not.toHaveBeenCalled();
    await expect(recorder).not.toHaveAttribute('aria-readonly');
  },
};
export const Error: Story = {
  args: {
    error: 'Choose a different shortcut',
    description: 'Press a modifier and a key',
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('button', { name: /Open search/ })).toHaveAttribute(
      'aria-invalid',
      'true',
    );
  },
};
export const ExternalAria: Story = {
  args: {
    'aria-label': 'Custom',
    'aria-labelledby': 'external-name missing-name',
    'aria-describedby': 'external-description missing-description',
    description: 'Internal help',
    error: 'Internal error',
  },
  render: (args) => (
    <>
      <span id="external-name">External</span>
      <span id="external-description">Extra help</span>
      <ShortcutRecorder {...args} />
    </>
  ),
  play: async ({ canvas }) => {
    const recorder = canvas.getByRole('button', {
      name: /External Open search/,
    });
    await expect(recorder).toHaveAttribute('aria-label', 'Custom');
    await expect(recorder.getAttribute('aria-labelledby')).toContain('missing-name');
    await expect(recorder.getAttribute('aria-describedby')).toContain('missing-description');
    await expect(recorder).toHaveAccessibleDescription('Extra help Internal help Internal error');
  },
};
export const BooleanAndZeroNodes: Story = {
  render: (args) => (
    <>
      {[false, null, 0, ''].map((node, index) => (
        <ShortcutRecorder
          {...args}
          key={index}
          label={node}
          description={node}
          error={node}
          aria-label={`Recorder ${index} Control + K`}
        />
      ))}
    </>
  ),
  play: async ({ canvas }) => {
    for (const index of [0, 1, 3]) {
      await expect(
        canvas.getByRole('button', { name: `Recorder ${index} Control + K` }),
      ).not.toHaveAttribute('aria-describedby');
      await expect(
        canvas.getByRole('button', { name: `Recorder ${index} Control + K` }),
      ).not.toHaveAttribute('aria-invalid');
    }
    await expect(canvas.getByRole('button', { name: '0 Control + K' })).toHaveAttribute(
      'aria-invalid',
      'true',
    );
  },
};
export const ControlledReject: Story = {
  args: { value: null, recording: false },
  play: async ({ canvas, userEvent, args }) => {
    const recorder = canvas.getByRole('button', { name: /Open search/ });
    await userEvent.click(recorder);
    await userEvent.keyboard('{Control>}[KeyP]{/Control}');
    await expect(recorder).toHaveAttribute('aria-pressed', 'false');
    await expect(args.onRecordingChange).toHaveBeenCalledTimes(1);
    await expect(args.onRecordingChange).toHaveBeenCalledWith(true);
    await expect(args.onValueChange).not.toHaveBeenCalled();
  },
};
export const ValueRejected: Story = {
  args: { value: 'mod+k', name: 'shortcut' },
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    const recorder = canvas.getByRole('button', { name: /Open search/ });
    await userEvent.click(recorder);
    await userEvent.keyboard('{Control>}[KeyP]{/Control}');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenCalledWith('mod+p', {});
    await expect(recorder).toHaveAccessibleName('Open search Control + K');
    await expect(canvasElement.querySelector('input[type="hidden"]')).toHaveValue('mod+k');
    await expect(canvas.getByRole('status')).not.toHaveTextContent('Shortcut set to Control + P');
  },
};
export const KeysSizes: Story = {
  render: () => (
    <>
      <ShortcutRecorder.Keys shortcut="mod+shift+k" size="sm" platform="mac" />
      <ShortcutRecorder.Keys shortcut="mod+shift+k" platform="other" />
    </>
  ),
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.getAllByRole('img')).toHaveLength(2);
    await expect(canvasElement.querySelectorAll('[data-ui="kbd"]')).toHaveLength(6);
  },
};
export const PressedKeys: Story = {
  render: () => (
    <ShortcutRecorder.Keys shortcut="mod+k" platform="other" pressed={new Set(['mod', 'k'])} />
  ),
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelectorAll('[data-pressed="true"]')).toHaveLength(2);
  },
};
export const GroupedList: Story = {
  render: () => <ShortcutRecorder.List groups={groups} platform="other" />,
};
export const ListSearch: Story = {
  render: () => <ShortcutRecorder.List groups={groups} platform="other" />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(canvas.getByRole('textbox'), 'editer');
    await expect(canvas.getAllByRole('listitem')).toHaveLength(1);
    await expect(canvas.getByText('Éditer')).toBeVisible();
    await userEvent.keyboard('{Escape}');
    await expect(canvas.getAllByRole('listitem')).toHaveLength(4);
    await expect(canvas.getByRole('textbox').ownerDocument.activeElement).toBe(
      canvas.getByRole('textbox'),
    );
  },
};
export const ListQueryControlled: Story = {
  render: (args) => (
    <ShortcutRecorder.List
      groups={groups}
      inputValue="Print"
      onInputChange={(next) => args.onValueChange?.(next, {})}
    />
  ),
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(canvas.getByRole('textbox'));
    await userEvent.keyboard('{Escape}');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenCalledWith('', {});
    await expect(canvas.getByRole('textbox')).toHaveValue('Print');
    await expect(canvas.getAllByRole('listitem')).toHaveLength(1);
  },
};
export const ListSearchSlot: Story = {
  render: () => (
    <ShortcutRecorder.List
      groups={groups}
      slotProps={{ search: { className: 'shortcut-search', css: css({ borderRadius: 0 }) } }}
    />
  ),
  play: async ({ canvas }) => {
    const search = canvas.getByRole('textbox');
    await expect(search).toHaveClass('shortcut-search');
    await expect(getComputedStyle(search).borderStartStartRadius).toBe('0px');
  },
};
export const ListLocaleResults: Story = {
  render: () => (
    <ShortcutRecorder.List
      groups={groups}
      locale="ar-EG"
      messages={{ ...defaultShortcutMessages, empty: 'Nothing here' }}
    />
  ),
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('status')).toHaveTextContent('٤ shortcuts');
  },
};
export const ListHighlightOff: Story = {
  render: () => <ShortcutRecorder.List groups={groups} highlightPressed={false} />,
};
export const EmptyResults: Story = {
  render: () => <ShortcutRecorder.List groups={groups} defaultInputValue="zzz" />,
};
export const LongChord: Story = {
  args: { defaultValue: 'mod+meta+alt+shift+pagedown', size: 'sm' },
  decorators: [
    (Story) => (
      <div style={{ maxInlineSize: '18rem' }}>
        <Story />
      </div>
    ),
  ],
  play: async ({ canvas }) => {
    const recorder = canvas.getByRole('button', { name: /Open search/ });
    for (const cap of recorder.querySelectorAll('kbd')) {
      await expect(cap.getBoundingClientRect().right).toBeLessThanOrEqual(
        recorder.getBoundingClientRect().right + 1,
      );
    }
    const reset = canvas.getByRole('button', { name: /^Reset to/ });
    await expect(reset.getBoundingClientRect().right).toBeLessThanOrEqual(
      recorder.closest('[data-ui="shortcut-recorder"]')!.getBoundingClientRect().right + 1,
    );
    await expect(reset.getBoundingClientRect().height).toBeGreaterThanOrEqual(31);
  },
};
export const FormReset: Story = {
  render: (args) => (
    <form aria-label="Shortcuts">
      <ShortcutRecorder {...args} name="shortcut" />
      <Button type="reset">Reset form</Button>
    </form>
  ),
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: /Open search/ }));
    await userEvent.keyboard('{Control>}[KeyP]{/Control}');
    await expect(new FormData(canvas.getByRole('form') as HTMLFormElement).get('shortcut')).toBe(
      'mod+p',
    );
    await userEvent.click(canvas.getByRole('button', { name: 'Reset form' }));
    await expect(new FormData(canvas.getByRole('form') as HTMLFormElement).get('shortcut')).toBe(
      'mod+k',
    );
    await expect(args.onValueChange).toHaveBeenCalledTimes(2);
  },
};
export const Keyboard: Story = {
  play: async ({ canvas, userEvent, args }) => {
    const recorder = canvas.getByRole('button', { name: /Open search/ });
    await userEvent.tab();
    await expect(recorder.ownerDocument.activeElement).toBe(recorder);
    await expect(getComputedStyle(recorder).outlineStyle).not.toBe('none');
    await userEvent.keyboard('{Enter}');
    await expect(args.onRecordingChange).toHaveBeenCalledTimes(1);
    await expect(args.onRecordingChange).toHaveBeenCalledWith(true);
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await userEvent.keyboard('{Escape}');
    await expect(args.onRecordingChange).toHaveBeenNthCalledWith(2, false);
    await userEvent.keyboard(' ');
    await expect(recorder).toHaveAttribute('aria-pressed', 'true');
    await userEvent.keyboard('{Control>}[Comma]{/Control}');
    await expect(args.onValueChange).toHaveBeenNthCalledWith(1, 'mod+,', {});
    await userEvent.keyboard('{Backspace}');
    await expect(args.onValueChange).toHaveBeenNthCalledWith(2, null, {});
    await userEvent.keyboard('{Delete}');
    await expect(args.onValueChange).toHaveBeenCalledTimes(2);
  },
};
export const ShiftTabRegression: Story = {
  render: (args) => (
    <>
      <Button>Before</Button>
      <ShortcutRecorder {...args} />
      <Button>After</Button>
    </>
  ),
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.tab();
    await userEvent.tab();
    await userEvent.keyboard('{Enter}');
    await userEvent.tab({ shift: true });
    await expect(canvas.getByRole('button', { name: 'Before' }).ownerDocument.activeElement).toBe(
      canvas.getByRole('button', { name: 'Before' }),
    );
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await userEvent.tab();
    await userEvent.keyboard('{Enter}');
    await userEvent.tab();
    await expect(
      canvas.getByRole('button', { name: /^Reset to/ }).ownerDocument.activeElement,
    ).toBe(canvas.getByRole('button', { name: /^Reset to/ }));
  },
};
export const CompositionRegression: Story = {
  args: { recording: true },
  play: async ({ canvas, userEvent, args }) => {
    const recorder = canvas.getByRole('button', { name: /Open search/ });
    await userEvent.tab();
    for (const data of [
      { isComposing: true },
      { repeat: true },
      { key: 'Dead' },
      { key: 'Process' },
      { key: 'Unidentified' },
      { key: 'AltGraph' },
    ]) {
      fireEvent.keyDown(recorder, {
        code: 'KeyP',
        key: 'p',
        ctrlKey: true,
        ...data,
      });
    }
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await userEvent.keyboard('{Control>}[KeyP>2][/KeyP]{/Control}');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenCalledWith('mod+p', {});
  },
};
export const PhysicalKeys: Story = {
  play: async ({ canvas, userEvent, args }) => {
    const recorder = canvas.getByRole('button', { name: /Open search/ });
    for (const [sequence, chord] of [
      ['{Control>}{Shift>}[Equal]{/Shift}{/Control}', 'mod+shift+='],
      ['{Control>}{Meta>}[KeyP]{/Meta}{/Control}', 'mod+meta+p'],
      ['{Control>}{Escape}{/Control}', 'mod+escape'],
      ['{Control>}{Backspace}{/Control}', 'mod+backspace'],
      ['{Control>}{Delete}{/Control}', 'mod+delete'],
    ] as const) {
      await userEvent.click(recorder);
      await userEvent.keyboard(sequence);
      await expect(args.onValueChange).toHaveBeenLastCalledWith(chord, {});
    }
    await expect(args.onValueChange).toHaveBeenCalledTimes(5);
    for (const invalid of ['ctrl+k+p', 'mod++', 'capslock', 'fn', 'dead', 'f25', 'mod+ctrl+k'])
      await expect(normalizeShortcut(invalid, 'other')).toBeNull();
    await expect(normalizeShortcut('meta+ctrl+k', 'other')).toBe('mod+meta+k');
    await expect(normalizeShortcut('ctrl+meta+k', 'mac')).toBe('mod+ctrl+k');
    await expect(formatShortcut('mod+shift+k', 'mac').spoken).toBe('Command + Shift + K');
    await expect(
      matchesShortcut(
        {
          code: 'KeyK',
          key: 'q',
          ctrlKey: true,
          altKey: false,
          shiftKey: false,
          metaKey: false,
        },
        'mod+k',
        'other',
      ),
    ).toBe(true);
  },
};
export const TwoRecorders: Story = {
  render: (args) => (
    <>
      <ShortcutRecorder {...args} recording label="First" />
      <ShortcutRecorder {...args} recording label="Second" />
    </>
  ),
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: /Second/ }));
    await userEvent.keyboard('{Control>}[KeyP]{/Control}');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenCalledWith('mod+p', {});
    await expect(canvas.getByRole('button', { name: /First/ })).toHaveAccessibleName(
      'First Recording Control + K',
    );
  },
};
export const LightTheme: Story = {
  decorators: [withLightTheme],
  globals: { theme: 'light' },
};
export const RTL: Story = {
  args: { dir: 'rtl' },
  play: async ({ canvasElement }) => {
    await expect(
      getComputedStyle(canvasElement.querySelector('[data-ui="shortcut-recorder"]')!).direction,
    ).toBe('rtl');
    await expect(
      getComputedStyle(canvasElement.querySelector('[data-ui="shortcut-recorder-keys"]')!)
        .direction,
    ).toBe('ltr');
  },
};
export const ForcedColors: Story = {
  args: { recording: true },
  parameters: {
    docs: {
      description: {
        story:
          'Persistent recording fixture for external forced-colors browser QA. This play does not emulate the media feature.',
      },
    },
  },
};
export const ReducedMotion: Story = {
  args: { recording: true },
  parameters: {
    docs: {
      description: {
        story:
          'Persistent recording fixture for external reduced-motion browser QA. This play does not emulate the media feature.',
      },
    },
  },
};

export const NormalizedNoop: Story = {
  args: { value: 'ctrl+k' },
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: /Open search/ }));
    await userEvent.keyboard('{Control>}[KeyK]{/Control}');
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await userEvent.click(canvas.getByRole('button', { name: 'Reset to Control + K' }));
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await expect(args.onRecordingChange).toHaveBeenCalledTimes(2);
  },
};

export const BlurRejected: Story = {
  args: { recording: true },
  play: async ({ canvas, userEvent, args }) => {
    const recorder = canvas.getByRole('button', { name: /Open search/ });
    await userEvent.tab();
    await userEvent.tab();
    await userEvent.keyboard('{Control>}[KeyP]{/Control}');
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await expect(recorder).toHaveAttribute('aria-pressed', 'true');
    await expect(recorder.ownerDocument.activeElement).not.toBe(recorder);
    await expect(args.onRecordingChange).toHaveBeenCalledWith(false);
    await expect(args.onRecordingChange).toHaveBeenCalledTimes(1);
  },
};

export const HeldKeys: Story = {
  render: () => (
    <>
      <Button>Hold keys</Button>
      <ShortcutRecorder.List groups={groups} platform="mac" searchable={false} />
    </>
  ),
  play: async ({ canvas, canvasElement, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Hold keys' }));
    await userEvent.keyboard('{Meta>}');
    await expect(canvasElement.querySelectorAll('[data-pressed="true"]')).toHaveLength(3);
    await userEvent.keyboard('[KeyK>]');
    await expect(canvasElement.querySelectorAll('[data-pressed="true"]')).toHaveLength(4);
    await userEvent.keyboard('{/Meta}');
    await expect(canvasElement.querySelectorAll('[data-pressed="true"]')).toHaveLength(0);
    await userEvent.keyboard('[/KeyK]');
    await userEvent.keyboard('{Control>}');
    fireEvent.blur(canvasElement.ownerDocument.defaultView!);
    await expect(canvasElement.querySelectorAll('[data-pressed="true"]')).toHaveLength(0);
    await userEvent.keyboard('{/Control}');
  },
};

export const RefAndCustomization: Story = {
  args: {
    ref: fn(),
    slotProps: {
      root: { css: css({ padding: vars.space[2] }) },
      recorder: { css: css({ borderRadius: 0 }) },
      key: { css: css({ fontWeight: vars.fontWeight.semibold }) },
    },
    sx: css({ padding: vars.space[4] }),
  },
  render: (args) => <ShortcutRecorder {...args} css={css({ padding: vars.space[3] })} />,
  play: async ({ canvas, canvasElement, args }) => {
    const recorder = canvas.getByRole('button', { name: /Open search/ });
    await expect(args.ref).toHaveBeenLastCalledWith(recorder);
    await expect(getComputedStyle(recorder).borderRadius).toBe('0px');
    await expect(getComputedStyle(recorder.querySelector('kbd')!).fontWeight).toBe('600');
    await expect(
      Math.abs(
        parseFloat(
          getComputedStyle(canvasElement.querySelector('[data-ui="shortcut-recorder"]')!)
            .paddingInlineStart,
        ) - 16,
      ),
    ).toBeLessThan(1);
  },
};

function UpdatedRecorder(args: ShortcutRecorderProps) {
  const [value, setValue] = useState<string | null>('mod+k');
  const [recording, setRecording] = useState(false);
  return (
    <>
      <ShortcutRecorder {...args} value={value} recording={recording} />
      <Button
        onClick={() => {
          setValue(null);
          setRecording(true);
        }}
      >
        Update props
      </Button>
    </>
  );
}
export const ExternalUpdates: Story = {
  render: (args) => <UpdatedRecorder {...args} />,
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Update props' }));
    await expect(canvas.getByRole('button', { name: /Open search/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await expect(args.onRecordingChange).not.toHaveBeenCalled();
    await userEvent.keyboard('{Control>}[KeyP]{/Control}');
    await expect(args.onValueChange).not.toHaveBeenCalled();
  },
};
