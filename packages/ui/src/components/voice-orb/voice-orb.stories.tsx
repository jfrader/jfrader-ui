import { StrictMode, useState, type ComponentPropsWithRef } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, spyOn, waitFor, within } from 'storybook/test';
import { motionValue } from 'motion/react';
import { vars } from '@jfrader/tokens/vars';
import { ClassNames, css } from '../../styling/css';
import { withLightTheme } from '../../testing/story-decorators';
import { Button, type ButtonProps } from '../button';
import { VoiceOrb, type VoiceOrbState } from './index';

const STATES: Record<VoiceOrbState, string> = {
  idle: 'Ready',
  connecting: 'Connecting',
  listening: 'Listening',
  thinking: 'Thinking',
  speaking: 'Speaking',
  error: 'Voice session error',
};
const usage = `<VoiceOrb state={state} active={active} muted={muted} onActiveChange={requestSession} onMutedChange={requestMute}>
  <VoiceOrb.Visual />
  <VoiceOrb.Status />
  <VoiceOrb.Transcript text={text} complete={complete} />
  <VoiceOrb.Controls />
</VoiceOrb>`;
const meta = {
  title: 'Media/VoiceOrb',
  component: VoiceOrb,
  tags: ['autodocs'],
  args: { state: 'idle', onStart: fn(), onEnd: fn(), onActiveChange: fn(), onMutedChange: fn() },
  parameters: {
    docs: {
      source: { code: usage },
      description: {
        component:
          'Consumer-owned voice session visualization. Native Start, Mute and End buttons use normal Tab order and Enter/Space activation; Escape does not end the session. Active and muted requests support controlled rejection. The consumer owns permissions, getUserMedia, AudioContext, streams, speech, networking, elapsed time and cleanup. This component never opens a microphone.',
      },
    },
  },
  render: (args) => (
    <VoiceOrb {...args}>
      <VoiceOrb.Visual />
      <VoiceOrb.Status />
      <VoiceOrb.Controls />
    </VoiceOrb>
  ),
} satisfies Meta<typeof VoiceOrb>;
export default meta;
type Story = StoryObj<typeof meta>;
function ReplacementCanvas(props: ComponentPropsWithRef<'canvas'>) {
  return <canvas {...props} data-replacement="canvas" />;
}
function ReplacementControl(props: ButtonProps) {
  return <Button {...props} data-replacement="control" />;
}
function ReplacementTimer(props: ComponentPropsWithRef<'span'>) {
  return <span {...props} data-replacement="timer" />;
}
export const ReplacementSlots: Story = {
  render: (args) => (
    <VoiceOrb {...args}>
      <VoiceOrb.Visual slots={{ canvas: ReplacementCanvas }} />
      <VoiceOrb.Controls
        slots={{
          start: ReplacementControl,
          mute: ReplacementControl,
          end: ReplacementControl,
          timer: ReplacementTimer,
        }}
      />
    </VoiceOrb>
  ),
  play: async ({ canvasElement, userEvent, args }) => {
    const canvas = within(canvasElement);
    await expect(canvasElement.querySelector('canvas')).toHaveAttribute('data-replacement', 'canvas');
    const start = canvas.getByRole('button', { name: 'Start voice session' });
    await expect(start).toHaveAttribute('data-replacement', 'control');
    await userEvent.click(start);
    await expect(args.onStart).toHaveBeenCalledTimes(1);
    const mute = canvas.getByRole('button', { name: 'Mute microphone' });
    await expect(mute).toHaveFocus();
    await expect(mute).toHaveAttribute('data-replacement', 'control');
    await userEvent.click(mute);
    await expect(mute).toHaveAttribute('aria-pressed', 'true');
    await expect(canvas.getByRole('timer')).toHaveAttribute('data-replacement', 'timer');
    const end = canvas.getByRole('button', { name: 'End voice session' });
    await expect(end).toHaveAttribute('data-replacement', 'control');
    await userEvent.click(end);
    await expect(args.onEnd).toHaveBeenCalledTimes(1);
    await expect(canvas.getByRole('button', { name: 'Start voice session' })).toHaveFocus();
  },
};
const statePlay: Story['play'] = async ({ canvasElement, args }) => {
  const canvas = within(canvasElement);
  const label =
    args.state === 'listening' && (args.muted || args.defaultMuted) ? 'Microphone muted' : STATES[args.state];
  await expect(canvas.getByRole('img', { name: label })).toBeVisible();
  await expect(canvas.getByText(label)).toBeVisible();
  await expect(canvasElement.querySelector('canvas')).toHaveAttribute('aria-hidden', 'true');
};
export const DefaultIdle: Story = { play: statePlay };
export const Listening: Story = {
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { VoiceOrb } from '@jfrader/ui';

<VoiceOrb state="listening" defaultActive>
  <VoiceOrb.Visual />
  <VoiceOrb.Status />
  <VoiceOrb.Controls />
</VoiceOrb>`,
      },
    },
  },
  args: { state: 'listening', defaultActive: true },
  play: statePlay,
};
export const Thinking: Story = {
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { VoiceOrb } from '@jfrader/ui';

<VoiceOrb state="thinking" defaultActive>
  <VoiceOrb.Visual />
  <VoiceOrb.Status />
  <VoiceOrb.Controls />
</VoiceOrb>`,
      },
    },
  },
  args: { state: 'thinking', defaultActive: true },
  play: statePlay,
};
export const Speaking: Story = {
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { VoiceOrb } from '@jfrader/ui';

<VoiceOrb state="speaking" defaultActive outputLevel={0.65}>
  <VoiceOrb.Visual />
  <VoiceOrb.Status />
  <VoiceOrb.Controls />
</VoiceOrb>`,
      },
    },
  },
  args: { state: 'speaking', defaultActive: true, outputLevel: 0.65 },
  play: statePlay,
};
export const Muted: Story = {
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { VoiceOrb } from '@jfrader/ui';

<VoiceOrb state="listening" defaultActive defaultMuted inputLevel={1}>
  <VoiceOrb.Visual />
  <VoiceOrb.Status />
  <VoiceOrb.Controls />
</VoiceOrb>`,
      },
    },
  },
  args: { state: 'listening', defaultActive: true, defaultMuted: true, inputLevel: 1 },
  play: async (context) => {
    await statePlay?.(context);
    await expect(
      within(context.canvasElement).getByRole('button', { name: 'Mute microphone' }),
    ).toHaveAttribute('aria-pressed', 'true');
  },
};
export const Connecting: Story = {
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { VoiceOrb } from '@jfrader/ui';

<VoiceOrb state="connecting" defaultActive>
  <VoiceOrb.Visual />
  <VoiceOrb.Status />
  <VoiceOrb.Controls />
</VoiceOrb>`,
      },
    },
  },
  args: { state: 'connecting', defaultActive: true },
  play: async (context) => {
    await statePlay?.(context);
    const canvas = within(context.canvasElement);
    await expect(canvas.queryByRole('button', { name: 'Start voice session' })).not.toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Mute microphone' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    await expect(canvas.getByRole('button', { name: 'End voice session' })).not.toBeDisabled();
  },
};
export const PermissionError: Story = {
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { VoiceOrb } from '@jfrader/ui';

<VoiceOrb state="error" error="Microphone permission denied.">
  <VoiceOrb.Visual />
  <VoiceOrb.Status />
  <VoiceOrb.Controls />
</VoiceOrb>`,
      },
    },
  },
  args: { state: 'error', error: 'Microphone permission denied.' },
  play: async (context) => {
    await statePlay?.(context);
    await expect(within(context.canvasElement).getByRole('alert')).toHaveTextContent(
      'Microphone permission denied.',
    );
  },
};
export const LiveControls: Story = {
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { VoiceOrb } from '@jfrader/ui';

<VoiceOrb state="idle" defaultActive elapsed={3661} locale="en-US">
  <VoiceOrb.Visual />
  <VoiceOrb.Status />
  <VoiceOrb.Controls />
</VoiceOrb>`,
      },
    },
  },
  args: { defaultActive: true, elapsed: 3661, locale: 'en-US' },
  play: async ({ canvasElement }) => {
    const timer = within(canvasElement).getByRole('timer');
    await expect(timer).toHaveAttribute('aria-live', 'off');
    await expect(timer).toHaveTextContent('1:01:01');
    await expect(timer).toHaveAccessibleName('1 hour, 1 minute, 1 second');
  },
};
export const DurationFormatMissing: Story = {
  beforeEach: () => {
    const descriptor = Object.getOwnPropertyDescriptor(Intl, 'DurationFormat');
    Object.defineProperty(Intl, 'DurationFormat', {
      value: undefined,
      configurable: true,
    });
    return () => {
      if (descriptor) Object.defineProperty(Intl, 'DurationFormat', descriptor);
      else Reflect.deleteProperty(Intl, 'DurationFormat');
    };
  },
  render: (args) => (
    <>
      {[
        { locale: 'en-US', elapsed: 3661 },
        { locale: 'fi', elapsed: 3723 },
        { locale: 'en-US', elapsed: 108_065 },
        { locale: 'fr', elapsed: 0 },
      ].map(({ locale, elapsed }) => (
        <VoiceOrb {...args} key={`${locale}-${elapsed}`} locale={locale} elapsed={elapsed} defaultActive>
          <VoiceOrb.Controls aria-label={`${locale} ${elapsed}`} />
        </VoiceOrb>
      ))}
    </>
  ),
  play: async ({ canvasElement }) => {
    await expect(Reflect.get(Intl, 'DurationFormat')).toBeUndefined();
    const timer = (name: string) =>
      within(within(canvasElement).getByRole('group', { name })).getByRole('timer');
    await expect(timer('en-US 3661')).toHaveTextContent('1:01:01');
    await expect(timer('en-US 3661')).toHaveAccessibleName(
      new Intl.ListFormat('en-US', { style: 'long', type: 'conjunction' }).format(
        ['hour', 'minute', 'second'].map((unit) =>
          new Intl.NumberFormat('en-US', { style: 'unit', unit, unitDisplay: 'long' }).format(1),
        ),
      ),
    );
    await expect(timer('fi 3723')).toHaveTextContent('1.02.03');
    await expect(timer('en-US 108065')).toHaveTextContent('30:01:05');
    await expect(timer('en-US 108065')).toHaveAccessibleName('30 hours, 1 minute, and 5 seconds');
    await expect(timer('fr 0')).toHaveAccessibleName(new Intl.NumberFormat('fr', { style: 'unit', unit: 'second', unitDisplay: 'long' }).format(0));
  },
};
function InlineCallbacks({ onStart }: { onStart: (renders: number) => void }) {
  const [renders, setRenders] = useState(0);
  return (
    <>
      <Button onClick={() => setRenders(renders + 1)}>Rerender</Button>
      <VoiceOrb state="idle" onStart={() => onStart(renders)}>
        <VoiceOrb.Controls />
      </VoiceOrb>
    </>
  );
}
export const LatestStartCallback: Story = {
  render: (args) => <InlineCallbacks onStart={args.onStart as (renders: number) => void} />,
  play: async ({ canvasElement, args, userEvent }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Rerender' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Rerender' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Start voice session' }));
    await expect(args.onStart).toHaveBeenCalledTimes(1);
    await expect(args.onStart).toHaveBeenCalledWith(2);
  },
};
export const AllVisualSizes: Story = {
  render: (args) => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: vars.space[4] }}>
      {(['sm', 'md', 'lg'] as const).map((size) => (
        <VoiceOrb {...args} key={size}>
          <VoiceOrb.Visual size={size} label={size} />
          <VoiceOrb.Status />
        </VoiceOrb>
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    for (const [size, rem] of Object.entries({ sm: 9, md: 13, lg: 17 })) {
      const visual = canvas.getByRole('img', { name: size });
      const rootSize = parseFloat(getComputedStyle(visual.ownerDocument.documentElement).fontSize);
      await expect(Math.abs(visual.getBoundingClientRect().width - rem * rootSize)).toBeLessThan(1.1);
    }
  },
};
const transcript = (
  speaker: 'user' | 'assistant' | 'system',
  text: string,
  complete = false,
  maxLines?: number,
): Story => ({
  render: (args) => (
    <VoiceOrb {...args}>
      <VoiceOrb.Visual />
      <VoiceOrb.Status />
      <VoiceOrb.Transcript text={text} speaker={speaker} complete={complete} maxLines={maxLines} />
      <VoiceOrb.Controls />
    </VoiceOrb>
  ),
});
export const UserTranscript = transcript('user', 'What is on my calendar today?');
export const AssistantTranscript = transcript('assistant', 'Your first meeting starts at nine.');
export const SystemTranscript = transcript('system', 'Session connected.');
export const PartialTurn: Story = {
  ...transcript('assistant', 'Your first meeting'),
  play: async ({ canvasElement }) => {
    const region = canvasElement.querySelector('[aria-live="polite"]');
    await expect(region).toHaveTextContent('');
    await expect(canvasElement.querySelector('[data-ui="voice-orb-transcript"]')).toHaveAttribute(
      'data-turn',
      '0',
    );
  },
};
export const CompletedTurn: Story = {
  ...transcript('assistant', 'Your first meeting starts at nine.', true),
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('[aria-live="polite"]')).toHaveTextContent(
      'Assistant: Your first meeting starts at nine.',
    );
  },
};
export const LongTranscript = transcript(
  'assistant',
  'Your calendar includes a planning meeting, a design review, a project check-in, and time to prepare your notes. '.repeat(
    8,
  ),
  true,
  2,
);
export const FalsyErrorStartLabel: Story = {
  render: (args) => (
    <div style={{ display: 'grid', gap: vars.space[4] }}>
      {[false, null, 0, ''].map((value, index) => (
        <VoiceOrb {...args} key={index} error={value}>
          <VoiceOrb.Status />
          <VoiceOrb.Controls startLabel={value} />
        </VoiceOrb>
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    const roots = canvasElement.querySelectorAll('[data-ui="voice-orb"]');
    for (const [index, root] of Array.from(roots).entries()) {
      const button = within(root as HTMLElement).getByRole('button', {
        name: index === 2 ? '0' : 'Start voice session',
      });
      await expect(button.textContent).toBe(index === 2 ? '0' : '');
      await expect(root.querySelector('[role="alert"]')?.textContent ?? null).toBe(
        index === 2 ? '0' : index === 3 ? '' : null,
      );
      await expect(root.hasAttribute('aria-describedby')).toBe(index >= 2);
    }
  },
};
export const Light: Story = {
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { ThemeRoot, VoiceOrb } from '@jfrader/ui';

<ThemeRoot theme="light">
  <VoiceOrb state="speaking" defaultActive outputLevel={0.5}>
    <VoiceOrb.Visual />
    <VoiceOrb.Status />
    <VoiceOrb.Controls />
  </VoiceOrb>
</ThemeRoot>`,
      },
    },
  },
  args: { state: 'speaking', defaultActive: true, outputLevel: 0.5 },
  globals: { theme: 'light' },
  decorators: [withLightTheme],
  play: statePlay,
};
export const RTL: Story = {
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { VoiceOrb } from '@jfrader/ui';

<VoiceOrb state="idle" dir="rtl" defaultActive locale="ar">
  <VoiceOrb.Visual />
  <VoiceOrb.Status />
  <VoiceOrb.Controls />
</VoiceOrb>`,
      },
    },
  },
  args: { dir: 'rtl', defaultActive: true, locale: 'ar' },
  play: async ({ canvasElement }) => {
    await expect(getComputedStyle(within(canvasElement).getByRole('group')).direction).toBe('rtl');
  },
};
export const Narrow: Story = {
  decorators: [
    (Story) => (
      <div style={{ inlineSize: '7rem' }}>
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    const visual = within(canvasElement).getByRole('img');
    await expect(visual.getBoundingClientRect().width).toBeLessThanOrEqual(113);
    for (const button of within(canvasElement).getAllByRole('button')) {
      await expect(button.getBoundingClientRect().height).toBeGreaterThan(39);
    }
  },
};
export const ReducedMotion: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Structural example. Use the operating system reduced-motion setting to verify the still-frame renderer; this story does not emulate a media preference.',
      },
    },
  },
  play: statePlay,
};
export const ForcedColors: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Structural example. In forced-colors mode the canvas is hidden and a real sphere outline accompanies the visible status. This story does not emulate forced colors.',
      },
    },
  },
  play: statePlay,
};
export const ControlledRejected: Story = {
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { VoiceOrb } from '@jfrader/ui';

<VoiceOrb
  state="idle"
  active={false}
  muted={false}
  onActiveChange={() => {}}
>
  <VoiceOrb.Visual />
  <VoiceOrb.Status />
  <VoiceOrb.Controls />
</VoiceOrb>`,
      },
    },
  },
  args: { active: false, muted: false },
  play: async ({ canvasElement, userEvent, args }) => {
    const start = within(canvasElement).getByRole('button', { name: 'Start voice session' });
    await userEvent.tab();
    await expect(start.ownerDocument.activeElement).toBe(start);
    await userEvent.keyboard('{Enter}');
    await expect(start.ownerDocument.activeElement).toBe(start);
    await expect(args.onActiveChange).toHaveBeenCalledTimes(1);
    await expect(args.onActiveChange).toHaveBeenCalledWith(true);
    await expect(args.onStart).toHaveBeenCalledTimes(1);
    await expect(
      within(canvasElement).queryByRole('button', { name: 'Mute microphone' }),
    ).not.toBeInTheDocument();
  },
};
export const ControlledMuteRejected: Story = {
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { VoiceOrb } from '@jfrader/ui';

<VoiceOrb
  state="idle"
  active
  muted={false}
  onMutedChange={() => {}}
>
  <VoiceOrb.Visual />
  <VoiceOrb.Status />
  <VoiceOrb.Controls />
</VoiceOrb>`,
      },
    },
  },
  args: { active: true, muted: false },
  play: async ({ canvasElement, userEvent, args }) => {
    const mute = within(canvasElement).getByRole('button', { name: 'Mute microphone' });
    await userEvent.click(mute);
    await expect(mute).toHaveAttribute('aria-pressed', 'false');
    await expect(args.onMutedChange).toHaveBeenCalledTimes(1);
    await expect(args.onMutedChange).toHaveBeenCalledWith(true);
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'End voice session' }));
    await expect(args.onActiveChange).toHaveBeenCalledTimes(1);
    await expect(args.onActiveChange).toHaveBeenCalledWith(false);
    await expect(args.onEnd).toHaveBeenCalledTimes(1);
    await expect(mute).toBeInTheDocument();
  },
};
export const KeyboardPlay: Story = {
  play: async ({ canvasElement, userEvent, args }) => {
    const canvas = within(canvasElement);
    const document = canvasElement.ownerDocument;
    const media = navigator.mediaDevices ? spyOn(navigator.mediaDevices, 'getUserMedia') : undefined;
    const audio = spyOn(window, 'AudioContext');
    try {
      await userEvent.tab();
      const start = canvas.getByRole('button', { name: 'Start voice session' });
      await expect(document.activeElement).toBe(start);
      await expect(getComputedStyle(start).outlineStyle).not.toBe('none');
      await userEvent.keyboard('{Enter}');
      const mute = canvas.getByRole('button', { name: 'Mute microphone' });
      await expect(document.activeElement).toBe(mute);
      await expect(args.onActiveChange).toHaveBeenCalledTimes(1);
      await expect(args.onActiveChange).toHaveBeenCalledWith(true);
      await expect(args.onStart).toHaveBeenCalledTimes(1);
      await expect(args.onActiveChange!.mock.invocationCallOrder[0]).toBeLessThan(
        args.onStart!.mock.invocationCallOrder[0]!,
      );
      await userEvent.keyboard(' ');
      await expect(mute).toHaveAttribute('aria-pressed', 'true');
      await expect(mute).toHaveAccessibleName('Mute microphone');
      await expect(args.onMutedChange).toHaveBeenCalledTimes(1);
      await expect(args.onMutedChange).toHaveBeenCalledWith(true);
      await userEvent.keyboard('{Escape}{ArrowRight}');
      await expect(document.activeElement).toBe(mute);
      await expect(args.onEnd).toHaveBeenCalledTimes(0);
      await userEvent.tab();
      const end = canvas.getByRole('button', { name: 'End voice session' });
      await expect(document.activeElement).toBe(end);
      await userEvent.tab({ shift: true });
      await expect(document.activeElement).toBe(mute);
      await userEvent.tab();
      await userEvent.keyboard(' ');
      await expect(document.activeElement).toBe(canvas.getByRole('button', { name: 'Start voice session' }));
      await expect(args.onActiveChange).toHaveBeenCalledTimes(2);
      await expect(args.onActiveChange).toHaveBeenLastCalledWith(false);
      await expect(args.onEnd).toHaveBeenCalledTimes(1);
      await expect(args.onActiveChange!.mock.invocationCallOrder[1]).toBeLessThan(
        args.onEnd!.mock.invocationCallOrder[0]!,
      );
      if (media) await expect(media).toHaveBeenCalledTimes(0);
      await expect(audio).toHaveBeenCalledTimes(0);
      for (const button of canvas.getAllByRole('button')) {
        await expect(button.getBoundingClientRect().height).toBeGreaterThan(39);
        await expect(button.getBoundingClientRect().width).toBeGreaterThan(39);
      }
    } finally {
      media?.mockRestore();
      audio.mockRestore();
    }
  },
};
export const NumericLevels: Story = {
  render: (args) => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: vars.space[4] }}>
      {[undefined, NaN, Infinity, -1, 0, 0.5, 1, 2].map((level, index) => (
        <VoiceOrb {...args} key={index} state="listening" inputLevel={level}>
          <VoiceOrb.Visual size="sm" label={`Level ${index}`} />
          <VoiceOrb.Status />
        </VoiceOrb>
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getAllByRole('img')).toHaveLength(8);
    const surfaces = Array.from(canvasElement.querySelectorAll('canvas'));
    const arcs = surfaces.map((surface) => spyOn(surface.getContext('2d')!, 'arc'));
    try {
      await waitFor(async () => {
        for (const [index, level] of [0, 0, 0, 0, 0, 0.5, 1, 1].entries()) {
          const calls = arcs[index]!.mock.calls;
          const radius = calls[calls.length - 1]?.[2];
          await expect(radius).toBeDefined();
          await expect(Math.abs(radius! / surfaces[index]!.width - (0.28 + level * 0.06))).toBeLessThan(
            0.001,
          );
        }
      });
    } finally {
      arcs.forEach((arc) => arc.mockRestore());
    }
  },
};
const output = motionValue(0.25);
export const MotionValueLevels: Story = {
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { motionValue } from 'motion/react';
import { VoiceOrb } from '@jfrader/ui';

const outputLevel = motionValue(0.25);

<VoiceOrb state="speaking" defaultActive outputLevel={outputLevel}>
  <VoiceOrb.Visual />
  <VoiceOrb.Status />
  <VoiceOrb.Controls />
</VoiceOrb>`,
      },
    },
  },
  args: { state: 'speaking', defaultActive: true, outputLevel: output },
  play: async ({ canvasElement }) => {
    output.set(0.8);
    await expect(within(canvasElement).getByRole('img', { name: 'Speaking' })).toBeVisible();
    output.set(0.25);
  },
};
function TranscriptUpdates() {
  const [turn, setTurn] = useState(0);
  const [complete, setComplete] = useState(false);
  return (
    <>
      <Button onClick={() => setComplete(!complete)}>Toggle completion</Button>
      <Button onClick={() => setTurn(turn + 1)}>Next turn</Button>
      <VoiceOrb state="idle">
        <VoiceOrb.Transcript text="Hello" turn={turn} complete={complete} />
      </VoiceOrb>
    </>
  );
}
export const CompletionDeduplication: Story = {
  render: () => <TranscriptUpdates />,
  play: async ({ canvasElement, userEvent }) => {
    const canvas = within(canvasElement);
    const live = canvasElement.querySelector('[aria-live="polite"]')!;
    await expect(live).toHaveTextContent('');
    await userEvent.click(canvas.getByRole('button', { name: 'Toggle completion' }));
    await expect(live).toHaveTextContent('Assistant: Hello');
    const version = live.firstElementChild;
    await userEvent.click(canvas.getByRole('button', { name: 'Toggle completion' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Toggle completion' }));
    await expect(live.firstElementChild).toBe(version);
    await userEvent.click(canvas.getByRole('button', { name: 'Next turn' }));
    await expect(live.firstElementChild).not.toBe(version);
  },
};
export const ExternalAria: Story = {
  render: (args) => (
    <>
      <p id="orb-label">Assistant session</p>
      <p id="orb-description">Session details</p>
      {[0, 1].map((index) => (
        <VoiceOrb
          {...args}
          key={index}
          error="Disconnected"
          aria-labelledby="orb-label unresolved-label"
          aria-describedby="orb-description unresolved-description"
        >
          <VoiceOrb.Visual aria-labelledby="orb-label unresolved-label" aria-describedby="orb-description" />
          <VoiceOrb.Status />
          <VoiceOrb.Controls />
        </VoiceOrb>
      ))}
    </>
  ),
  play: async ({ canvasElement }) => {
    const roots = canvasElement.querySelectorAll('[data-ui="voice-orb"]');
    const ids = [];
    for (const root of roots) {
      await expect(root).toHaveAttribute('aria-labelledby', 'orb-label unresolved-label');
      const visual = root.querySelector('[data-ui="voice-orb-visual"]')!;
      await expect(visual).toHaveAttribute('aria-labelledby', 'orb-label unresolved-label');
      await expect(visual).not.toHaveAttribute('aria-label');
      await expect(visual).toHaveAccessibleName('Assistant session');
      const error = root.querySelector('[role="alert"]')!;
      ids.push(error.id);
      await expect(root.getAttribute('aria-describedby')).toBe(
        `orb-description unresolved-description ${error.id}`,
      );
    }
    await expect(new Set(ids).size).toBe(2);
  },
};
function Lifecycle() {
  const [shown, setShown] = useState(true);
  const [offscreen, setOffscreen] = useState(false);
  return (
    <>
      <Button onClick={() => setShown(!shown)}>Toggle orb</Button>
      <Button onClick={() => setOffscreen(!offscreen)}>Toggle visibility</Button>
      {shown && (
        <div style={{ display: offscreen ? 'none' : undefined }}>
          <StrictMode>
            <VoiceOrb state="thinking">
              <VoiceOrb.Visual />
              <VoiceOrb.Status />
            </VoiceOrb>
          </StrictMode>
        </div>
      )}
    </>
  );
}
export const OffscreenResume: Story = {
  render: () => <Lifecycle />,
  play: async ({ canvasElement, userEvent }) => {
    const canvas = within(canvasElement);
    const drawing = canvasElement.querySelector('canvas')!.getContext('2d')!;
    const clear = spyOn(drawing, 'clearRect');
    const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 80));
    try {
      await userEvent.click(canvas.getByRole('button', { name: 'Toggle visibility' }));
      await expect(canvas.getByRole('img', { hidden: true })).not.toBeVisible();
      await settle();
      const hiddenCalls = clear.mock.calls.length;
      await settle();
      await expect(clear).toHaveBeenCalledTimes(hiddenCalls);
      await userEvent.click(canvas.getByRole('button', { name: 'Toggle visibility' }));
      await waitFor(async () => {
        await expect(canvas.getByRole('img')).toBeVisible();
        await expect(canvasElement.querySelector('canvas')!.width).toBeGreaterThan(0);
      });
      await userEvent.click(canvas.getByRole('button', { name: 'Toggle orb' }));
      await expect(canvas.queryByRole('img')).not.toBeInTheDocument();
      const unmountedCalls = clear.mock.calls.length;
      await settle();
      await expect(clear).toHaveBeenCalledTimes(unmountedCalls);
      await userEvent.click(canvas.getByRole('button', { name: 'Toggle orb' }));
      await expect(canvas.getByRole('img')).toBeVisible();
    } finally {
      clear.mockRestore();
    }
  },
};

export const DisabledActions: Story = {
  render: (args) => (
    <VoiceOrb {...args}>
      <VoiceOrb.Controls slotProps={{ start: { disabled: true } }} />
    </VoiceOrb>
  ),
  play: async ({ canvasElement, userEvent, args }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Start voice session' }));
    await expect(args.onActiveChange).toHaveBeenCalledTimes(0);
    await expect(args.onStart).toHaveBeenCalledTimes(0);
  },
};
function installMediaSpies() {
  const unexpected = () => {
    throw new Error('VoiceOrb must not access media APIs');
  };
  return {
    microphone: navigator.mediaDevices
      ? spyOn(navigator.mediaDevices, 'getUserMedia').mockImplementation(unexpected)
      : undefined,
    audio: spyOn(window, 'AudioContext').mockImplementation(unexpected),
  };
}
let ownershipSpies: ReturnType<typeof installMediaSpies>;
export const MediaOwnership: Story = {
  beforeEach: () => {
    ownershipSpies = installMediaSpies();
    return () => {
      ownershipSpies.microphone?.mockRestore();
      ownershipSpies.audio.mockRestore();
    };
  },
  play: async ({ canvasElement, userEvent }) => {
    if (ownershipSpies.microphone) await expect(ownershipSpies.microphone).toHaveBeenCalledTimes(0);
    await expect(ownershipSpies.audio).toHaveBeenCalledTimes(0);
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Start voice session' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Mute microphone' }));
    await userEvent.click(canvas.getByRole('button', { name: 'End voice session' }));
    if (ownershipSpies.microphone) await expect(ownershipSpies.microphone).toHaveBeenCalledTimes(0);
    await expect(ownershipSpies.audio).toHaveBeenCalledTimes(0);
  },
};
const strayRootStyle = css({ opacity: 0.6 });
export const RefAndStyling: Story = {
  args: { ref: fn() },
  render: (args) => (
    <ClassNames>{({ css: register }) => <VoiceOrb {...args} className={register(strayRootStyle)} sx={{ opacity: 0.8 }}>
      <VoiceOrb.Visual sx={{ opacity: 0.7 }} slotProps={{ canvas: { css: { opacity: 0.5 } } }} />
      <VoiceOrb.Status sx={{ fontWeight: vars.fontWeight.semibold }} />
      <VoiceOrb.Transcript text="Hello" sx={{ opacity: 0.9 }} />
      <VoiceOrb.Controls
        sx={{ opacity: 0.75, gap: vars.space[6] }}
        slotProps={{ start: { css: { paddingInline: vars.space[8] } } }}
      />
    </VoiceOrb>}</ClassNames>
  ),
  play: async ({ canvasElement, args }) => {
    const root = canvasElement.querySelector('[data-ui="voice-orb"]')!;
    await expect(args.ref).toHaveBeenCalledWith(root);
    await expect(getComputedStyle(root).opacity).toBe('0.8');
    await expect(getComputedStyle(within(canvasElement).getByRole('img')).opacity).toBe('0.7');
    await expect(getComputedStyle(root.querySelector('canvas')!).opacity).toBe('0.5');
    await expect(getComputedStyle(root.querySelector('[data-ui="voice-orb-transcript"]')!).opacity).toBe(
      '0.9',
    );
    const group = within(canvasElement).getByRole('group');
    await expect(getComputedStyle(group).opacity).toBe('0.75');
    await expect(getComputedStyle(group.firstElementChild!).columnGap).toBe(getComputedStyle(group).columnGap);
    await expect(getComputedStyle(group.firstElementChild!).columnGap).not.toBe('normal');
    await expect(
      Math.abs(
        parseFloat(getComputedStyle(within(canvasElement).getByRole('button')).paddingInlineStart) - 32,
      ),
    ).toBeLessThan(1.1);
  },
};
