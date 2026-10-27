import { act, StrictMode, useState, type ComponentPropsWithRef } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, spyOn, waitFor, within } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { withLightTheme } from '../../testing/story-decorators';
import { expectContrastSurface, expectThemedSurface } from '../../testing/theme-assertions';
import { expectInside } from '../../testing/geometry-assertions';
import { Button } from '../button';
import {
  TypewriterTerminal,
  type TypewriterTerminalProps,
  type TerminalStep,
  type TerminalTone,
} from './index';
// `styled` is the app-facing styling API; consumers import it from `@jfrader/ui`.
import { styled } from '../../index';

const NarrowFrame = styled.div({ inlineSize: '18em', maxInlineSize: '100%' });
const AppearanceStack = styled.div({ display: 'grid', gap: vars.space[4] });

/** Inherited light material and fixed charcoal with paused playback. */
export const PanelAppearance: StoryObj<typeof TypewriterTerminal> = {
  parameters: { layout: 'padded' },
  tags: ['!autodocs'],
  decorators: [withLightTheme],
  render: (args) => <AppearanceStack><TypewriterTerminal {...args} paused /><TypewriterTerminal {...args} paused appearance="contrast" /></AppearanceStack>,
  play: async ({ canvasElement }) => {
    const [light, contrast] = Array.from(canvasElement.querySelectorAll<HTMLElement>('[data-ui~="typewriter-terminal"]'));
    await expectThemedSurface(light!, 'light');
    await expectContrastSurface(contrast!, 'light');
    await expect(contrast!.tagName).toBe('FIGURE');
    await expect(contrast!.getBoundingClientRect().height).toBe(light!.getBoundingClientRect().height);
    await expectInside(contrast!.querySelector('[data-ui="typewriter-terminal-screen"]')!, contrast!);
  },
};

const SCRIPT: readonly TerminalStep[] = [
  {
    command: 'example init',
    output: ['Workspace created', '', { text: 'Ready', tone: 'success' }],
  },
  {
    command: 'example --help',
    output: ['Usage: example [command]', { text: 'Documentation', href: '/docs' }],
  },
];
function ReplacementRoot(props: ComponentPropsWithRef<'figure'>) {
  return <figure {...props} data-testid="replacement-root" />;
}
function SugarRoot(props: ComponentPropsWithRef<'figure'>) {
  return <figure {...props} data-testid="sugar-root" />;
}

/** Replace the outer figure while keeping playback and its transcript. */
export const RootReplacement: StoryObj<typeof TypewriterTerminal> = {
  tags: ['!autodocs'],
  args: {
    steps: SCRIPT,
    defaultPaused: true,
    component: SugarRoot,
    slots: { root: ReplacementRoot },
    ref: fn(),
    className: 'consumer-root',
    slotProps: { root: { ref: fn(), className: 'slot-root', title: 'slot title', 'data-ui': 'custom consumer' } },
  },
  render: (args) => <TypewriterTerminal {...args} data-ui="consumer" />,
  play: async ({ canvasElement, args }) => {
    const root = within(canvasElement).getByTestId('replacement-root');
    await expect(getComputedStyle(root).backgroundColor).toBe('rgba(0, 0, 0, 0)');
    await expect(getComputedStyle(root).boxShadow).toBe('none');
    await expect(within(canvasElement).queryByTestId('sugar-root')).toBeNull();
    await expect(root.tagName).toBe('FIGURE');
    await expect(root).toHaveClass('consumer-root', 'slot-root');
    await expect(root).toHaveAttribute('title', 'slot title');
    await expect(root).toHaveAttribute('data-ui', 'typewriter-terminal consumer custom');
    await expect(args.ref).toHaveBeenCalledWith(root);
    await expect(args.slotProps?.root?.ref).toHaveBeenCalledWith(root);
    await expect(root.querySelector('ol')).not.toBeNull();
    await expect(root).toHaveAccessibleName('Terminal session');
  },
};

/** Use component as shorthand for the root slot. */
export const RootComponent: StoryObj<typeof TypewriterTerminal> = {
  tags: ['!autodocs'],
  args: { steps: SCRIPT, defaultPaused: true, component: SugarRoot },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByTestId('sugar-root')).toHaveAttribute('data-ui', 'typewriter-terminal');
  },
};
const CLOCK_SCRIPT: readonly TerminalStep[] = [
  { command: 'A👩🏽‍💻', output: ['', 'Done'], pauseMs: 0 },
];
const FINISHED = Number.MAX_SAFE_INTEGER;
const meta = {
  title: 'Data display/TypewriterTerminal',
  component: TypewriterTerminal,
  tags: ['autodocs'],
  args: { steps: SCRIPT, onValueChange: fn(), onPausedChange: fn() },
  parameters: {
    docs: {
      sections: [
        { title: 'Scripted sessions', stories: ['Default', 'StaticSession', 'PlainOutput'] },
        { title: 'Output content', stories: ['EveryTone', 'ProgressAndTasks', 'CwdChanges'] },
        { title: 'Playback control', stories: ['ControlledTimeline'] },
      ],
      description: {
        component: 'Play a scripted terminal session, command by command. Commands are text and are never executed.',
      },
      usage: `**Keyboard**

- Tab reaches Copy, Play/Pause, Replay, the seek control, then the transcript links.
- On the seek control, arrows and Page keys jump command boundaries; Home and End jump to the start and the end.
- Space and K toggle playback.

**Limits**

- Copy writes the commands only, never the output. A clipboard failure appears below the controls.
- The complete transcript stays available throughout playback.
- Reduced motion shows the completed output and disables looping.`,
      source: {
        code: `<TypewriterTerminal steps={[{ command: 'example --help', output: ['Usage: example'] }]} loop={false} />`,
      },
    },
  },
} satisfies Meta<typeof TypewriterTerminal>;
export default meta;
type Story = StoryObj<typeof meta>;

function screen(canvasElement: HTMLElement) {
  return canvasElement.querySelector<HTMLElement>('[data-ui="typewriter-terminal-screen"]')!;
}
function transcript(canvasElement: HTMLElement) {
  return canvasElement.querySelector<HTMLElement>('[data-ui="typewriter-terminal-transcript"]')!;
}
async function focused(element: HTMLElement) {
  await expect(element.ownerDocument.activeElement).toBe(element);
  await expect(getComputedStyle(element).outlineStyle).not.toBe('none');
}
async function clipboard(
  canvasElement: HTMLElement,
  writeText: ((text: string) => Promise<void>) | undefined,
  run: () => Promise<void>,
) {
  const navigator = canvasElement.ownerDocument.defaultView!.navigator;
  const original = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: writeText ? { writeText } : undefined,
  });
  try {
    await run();
  } finally {
    if (original) Object.defineProperty(navigator, 'clipboard', original);
    else Reflect.deleteProperty(navigator, 'clipboard');
  }
}

const clock = new Map<number, () => void>();
let nextTimer = -1;
function controlledClock() {
  clock.clear();
  const browserTimers: {
    setTimeout: (handler: TimerHandler, timeout?: number, ...args: unknown[]) => number;
    clearTimeout: (id?: number) => void;
  } = window;
  const originalSet = browserTimers.setTimeout.bind(window);
  const originalClear = browserTimers.clearTimeout.bind(window);
  const set = spyOn(browserTimers, 'setTimeout').mockImplementation(
    (callback: TimerHandler, delay?: number, ...args: unknown[]) => {
      if (typeof callback === 'function' && callback.name === 'advancePlayback') {
        const id = nextTimer--;
        clock.set(id, () => callback());
        return id;
      }
      return originalSet(callback, delay, ...args);
    },
  );
  const clear = spyOn(browserTimers, 'clearTimeout').mockImplementation((id) => {
    if (id !== undefined && clock.has(id)) clock.delete(id);
    else originalClear(id);
  });
  return () => {
    set.mockRestore();
    clear.mockRestore();
    clock.clear();
  };
}
async function tick() {
  await waitFor(() => expect(clock.size).toBe(1));
  const [id, advance] = [...clock.entries()][0]!;
  clock.delete(id);
  await act(async () => advance());
}

export const Default: Story = {
  name: 'Play a terminal session',
  parameters: { docs: {
    description: { story: 'Watch two commands play, then seek or replay the session.' },
    source: { language: 'tsx', code: `import { TypewriterTerminal } from '@jfrader/ui';

<TypewriterTerminal steps={[
  { command: 'example init', output: ['Workspace created', '', { text: 'Ready', tone: 'success' }] },
  { command: 'example --help', output: ['Usage: example [command]', { text: 'Documentation', href: '/docs' }] },
]} />` },
  } },
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.getByRole('figure', { name: 'Terminal session' })).toBeVisible();
    await expect(transcript(canvasElement)).toHaveTextContent('example --help');
    await expect(screen(canvasElement)).toHaveAttribute('aria-hidden', 'true');
    await expect(screen(canvasElement)).toHaveAttribute('inert');
    await expect(canvas.getByRole('status')).toBeEmptyDOMElement();
  },
};
export const PlainOutput: Story = {
  name: 'Completed plain output',
  parameters: { docs: {
    description: { story: 'Show the full command output immediately and let the reader replay it.' },
    source: { language: 'tsx', code: `import { TypewriterTerminal } from '@jfrader/ui';

<TypewriterTerminal
  steps={[{ command: 'example list', output: ['alpha', 'beta'] }]}
  defaultValue={Number.MAX_SAFE_INTEGER}
  defaultPaused
/>` },
  } },
  args: {
    steps: [{ command: 'example list', output: ['alpha', 'beta'] }],
    defaultValue: FINISHED,
    defaultPaused: true,
  },
};
/** Show completed commands and output with a copy action. */
export const StaticSession: Story = {
  name: 'Static terminal',
  parameters: { docs: { source: { language: 'tsx', code: `import { TypewriterTerminal } from '@jfrader/ui';

<TypewriterTerminal
  playback={false}
  steps={[{ command: 'pnpm add @jfrader/ui @jfrader/icons' }]}
/>` } } },
  args: {
    playback: false,
    steps: [{ command: 'pnpm add @jfrader/ui @jfrader/icons' }],
  },
  play: async ({ canvas, canvasElement, userEvent }) => {
    await expect(canvas.queryByRole('button', { name: 'Play' })).not.toBeInTheDocument();
    await expect(canvas.queryByRole('button', { name: 'Replay' })).not.toBeInTheDocument();
    await expect(canvas.queryByRole('slider')).not.toBeInTheDocument();
    await expect(canvas.queryByRole('status')).not.toBeInTheDocument();
    await expect(screen(canvasElement)).toHaveTextContent('pnpm add @jfrader/ui @jfrader/icons');
    await expect(transcript(canvasElement)).toHaveTextContent('pnpm add @jfrader/ui @jfrader/icons');
    const copy = canvas.getByRole('button', { name: 'Copy commands' });
    await expect(copy).toBeVisible();
    await userEvent.tab();
    await focused(copy);
    const viewport = screen(canvasElement);
    const line = viewport.querySelector('pre')!;
    const styles = getComputedStyle(viewport);
    await expect(viewport.getBoundingClientRect().height).toBeCloseTo(
      line.getBoundingClientRect().height + parseFloat(styles.paddingBlockStart) + parseFloat(styles.paddingBlockEnd),
      0,
    );
    const write = fn(async () => {});
    await clipboard(canvasElement, write, async () => {
      await userEvent.click(copy);
      await expect(write).toHaveBeenCalledWith('pnpm add @jfrader/ui @jfrader/icons');
    });
  },
};

export const StaticPlaybackInert: Story = {
  tags: ['!autodocs'],
  args: {
    playback: false,
    value: 0,
    defaultValue: 0,
    paused: false,
    defaultPaused: false,
    speed: 100,
    loop: true,
    steps: SCRIPT,
  },
  beforeEach: controlledClock,
  play: async ({ canvas, canvasElement, args }) => {
    await expect(screen(canvasElement)).toHaveTextContent('example --help');
    await expect(screen(canvasElement)).toHaveTextContent('Documentation');
    await expect(clock.size).toBe(0);
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await expect(args.onPausedChange).not.toHaveBeenCalled();
    await expect(canvas.queryByRole('slider')).not.toBeInTheDocument();
  },
};
export const EveryTone: Story = {
  name: 'Output tones',
  parameters: { docs: {
    description: { story: 'Compare neutral, muted, success, warning, danger and accent output lines.' },
    source: { language: 'tsx', code: `import { TypewriterTerminal } from '@jfrader/ui';

<TypewriterTerminal
  defaultValue={Number.MAX_SAFE_INTEGER}
  defaultPaused
  steps={[{ command: 'example check', output: [
    { text: 'neutral result', tone: 'neutral' },
    { text: 'muted result', tone: 'muted' },
    { text: 'success result', tone: 'success' },
    { text: 'warning result', tone: 'warning' },
    { text: 'danger result', tone: 'danger' },
    { text: 'accent result', tone: 'accent' },
  ] }]}
/>` },
  } },
  args: {
    steps: [
      {
        command: 'example check',
        output: (
          ['neutral', 'muted', 'success', 'warning', 'danger', 'accent'] satisfies TerminalTone[]
        ).map((tone) => ({ text: `${tone} result`, tone })),
      },
    ],
    defaultValue: FINISHED,
    defaultPaused: true,
  },
};
export const ProgressAndTasks: Story = {
  name: 'Progress and task output',
  parameters: { docs: {
    description: { story: 'Play a build sequence with a progress line and a task that completes.' },
    source: { language: 'tsx', code: `import { TypewriterTerminal } from '@jfrader/ui';

<TypewriterTerminal steps={[{
  command: 'example build',
  output: [
    { kind: 'progress', label: 'Building' },
    { kind: 'task', label: 'Checking', doneLabel: 'Checks passed' },
  ],
}]} />` },
  } },
  args: {
    steps: [
      {
        command: 'example build',
        output: [
          { kind: 'progress', label: 'Building' },
          { kind: 'task', label: 'Checking', doneLabel: 'Checks passed' },
        ],
      },
    ],
  },
};
export const FinishedProgressAndTasks: Story = {
  ...ProgressAndTasks,
  args: {
    ...ProgressAndTasks.args,
    defaultValue: FINISHED,
    defaultPaused: true,
  },
};
export const BlankLines: Story = {
  args: {
    steps: [{ command: '', output: ['', 'After blank line', ''] }],
    defaultValue: FINISHED,
    defaultPaused: true,
  },
  play: async ({ canvasElement }) => {
    const lines = screen(canvasElement).querySelectorAll('pre');
    await expect(lines).toHaveLength(4);
    await expect(lines[1]).toHaveTextContent('');
    await expect(lines[1]!.getBoundingClientRect().height).toBeGreaterThan(0);
  },
};
export const CwdChanges: Story = {
  name: 'Working directory changes',
  parameters: { docs: {
    description: { story: 'Carry a command’s working directory into the next prompt.' },
    source: { language: 'tsx', code: `import { TypewriterTerminal } from '@jfrader/ui';

<TypewriterTerminal
  steps={[{ command: 'example enter', cwd: '~/demo' }, { command: 'example list' }]}
  defaultValue={Number.MAX_SAFE_INTEGER}
  defaultPaused
/>` },
  } },
  args: {
    steps: [{ command: 'example enter', cwd: '~/demo' }, { command: 'example list' }],
    defaultValue: FINISHED,
    defaultPaused: true,
  },
  play: async ({ canvasElement }) => {
    await expect(screen(canvasElement).textContent?.match(/~\/demo/g)).toHaveLength(2);
  },
};
export const CaptionZero: Story = {
  args: { caption: 0, defaultPaused: true },
  play: async ({ canvas, canvasElement }) => {
    await expect(canvasElement.querySelector('figcaption')).toHaveTextContent('0');
    await expect(canvas.getByRole('figure')).toHaveAttribute(
      'aria-describedby',
      canvasElement.querySelector('figcaption')!.id,
    );
  },
};
export const AbsentCaptions: Story = {
  parameters: { layout: 'padded' },
  render: (args) => (
    <div>
      {[false, null].map((caption, index) => (
        <TypewriterTerminal {...args} key={index} caption={caption} defaultPaused />
      ))}
    </div>
  ),
  play: async ({ canvasElement, canvas }) => {
    await expect(canvasElement.querySelectorAll('figcaption')).toHaveLength(0);
    for (const figure of canvas.getAllByRole('figure'))
      await expect(figure).not.toHaveAttribute('aria-describedby');
  },
};
export const EmptyCaption: Story = {
  ...CaptionZero,
  args: { caption: '', defaultPaused: true },
  play: async ({ canvas, canvasElement }) => {
    await expect(canvasElement.querySelector('figcaption')).toBeEmptyDOMElement();
    await expect(canvas.getByRole('figure')).toHaveAttribute(
      'aria-describedby',
      canvasElement.querySelector('figcaption')!.id,
    );
  },
};
export const LongUnicode: Story = {
  args: {
    steps: [
      {
        command: 'example "👩🏽‍💻 café é שלום"',
        output: ['<script>alert("text only")</script>', 'unbroken'.repeat(30)],
      },
    ],
    defaultValue: FINISHED,
    defaultPaused: true,
  },
  play: async ({ canvasElement }) => {
    await expect(screen(canvasElement)).toHaveTextContent('<script>alert("text only")</script>');
    await expect(screen(canvasElement).querySelector('script')).toBeNull();
    await expect(
      screen(canvasElement).scrollWidth - screen(canvasElement).clientWidth,
    ).toBeLessThan(2);
  },
};
export const EmptyScript: Story = {
  args: { steps: [] },
  play: async ({ canvas, args }) => {
    await expect(canvas.getByRole('slider')).toBeDisabled();
    await expect(canvas.getByRole('button', { name: 'Replay' })).toBeDisabled();
    await expect(canvas.getByRole('button', { name: 'Pause' })).toBeDisabled();
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await expect(args.onPausedChange).not.toHaveBeenCalled();
  },
};
export const ZeroDuration: Story = {
  ...EmptyScript,
  args: { steps: [{ command: '', pauseMs: 0 }] },
};

function ControlledTimelineExample(args: TypewriterTerminalProps) {
  const [value, setValue] = useState(0);
  return (
    <TypewriterTerminal
      {...args}
      value={value}
      paused
      onValueChange={(next) => {
        args.onValueChange?.(next);
        setValue(next);
      }}
    />
  );
}
export const ControlledTimeline: Story = {
  name: 'App-owned timeline',
  parameters: { docs: {
    description: { story: 'Seek through a paused session while React state owns its timeline position.' },
    source: { language: 'tsx', code: `import { useState } from 'react';
import { TypewriterTerminal } from '@jfrader/ui';

export function SessionTimeline() {
  const [position, setPosition] = useState(0);
  return (
    <TypewriterTerminal
      paused
      value={position}
      onValueChange={setPosition}
      steps={[
        { command: 'example init', output: ['Workspace created', '', { text: 'Ready', tone: 'success' }] },
        { command: 'example --help', output: ['Usage: example [command]', { text: 'Documentation', href: '/docs' }] },
      ]}
    />
  );
}` },
  } },
  render: (args) => <ControlledTimelineExample {...args} />,
  play: async ({ canvas, userEvent, args }) => {
    const slider = canvas.getByRole('slider');
    slider.focus();
    await userEvent.keyboard('{End}');
    await expect(slider).toHaveValue(slider.getAttribute('max'));
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(canvas.getByRole('status')).toHaveTextContent(/^Seek session: /);
    await userEvent.keyboard('{Home}');
    await expect(slider).toHaveValue('0');
    await expect(args.onValueChange).toHaveBeenCalledTimes(2);
  },
};
function ControlledPausedExample(args: TypewriterTerminalProps) {
  const [paused, setPaused] = useState(true);
  return (
    <TypewriterTerminal
      {...args}
      paused={paused}
      value={0}
      onPausedChange={(next) => {
        args.onPausedChange?.(next);
        setPaused(next);
      }}
    />
  );
}
export const ControlledPaused: Story = {
  render: (args) => <ControlledPausedExample {...args} />,
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Play' }));
    await expect(canvas.getByRole('button', { name: 'Pause' })).toBeVisible();
    await expect(canvas.getByRole('status')).toHaveTextContent('Playing');
    await userEvent.click(canvas.getByRole('button', { name: 'Pause' }));
    await expect(canvas.getByRole('status')).toHaveTextContent('Paused');
    await expect(args.onPausedChange).toHaveBeenNthCalledWith(1, false);
    await expect(args.onPausedChange).toHaveBeenNthCalledWith(2, true);
    await expect(args.onPausedChange).toHaveBeenCalledTimes(2);
  },
};
export const RejectedRequests: Story = {
  args: { value: 40, paused: true, steps: CLOCK_SCRIPT },
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    const before = screen(canvasElement).textContent;
    const status = canvas.getByRole('status');
    await userEvent.click(canvas.getByRole('button', { name: 'Play' }));
    await expect(canvas.getByRole('button', { name: 'Play' })).toBeVisible();
    await expect(status).toBeEmptyDOMElement();
    const slider = canvas.getByRole('slider');
    slider.focus();
    await userEvent.keyboard('{End}');
    await expect(slider).toHaveValue('40');
    await expect(screen(canvasElement).textContent).toBe(before);
    await expect(status).toBeEmptyDOMElement();
    await userEvent.click(canvas.getByRole('button', { name: 'Replay' }));
    await expect(status).toBeEmptyDOMElement();
    await expect(args.onValueChange).toHaveBeenNthCalledWith(1, 400);
    await expect(args.onValueChange).toHaveBeenNthCalledWith(2, 0);
    await expect(args.onValueChange).toHaveBeenCalledTimes(2);
    await expect(args.onPausedChange).toHaveBeenCalledTimes(2);
    await expect(args.onPausedChange).toHaveBeenNthCalledWith(1, false);
    await expect(args.onPausedChange).toHaveBeenNthCalledWith(2, false);
  },
};
export const KeyboardPlayback: Story = {
  args: {
    defaultPaused: true,
    steps: [
      { command: 'A', pauseMs: 0 },
      { command: 'B', pauseMs: 0 },
    ],
  },
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.tab();
    await focused(canvas.getByRole('button', { name: 'Copy commands' }));
    await userEvent.tab();
    await focused(canvas.getByRole('button', { name: 'Play' }));
    await userEvent.tab();
    await focused(canvas.getByRole('button', { name: 'Replay' }));
    await userEvent.tab();
    const slider = canvas.getByRole('slider');
    await focused(slider);
    for (const [key, value] of [
      ['ArrowRight', '40'],
      ['ArrowUp', '80'],
      ['PageUp', '80'],
      ['ArrowLeft', '40'],
      ['ArrowDown', '0'],
      ['PageDown', '0'],
      ['End', '80'],
      ['Home', '0'],
    ] as const) {
      await userEvent.keyboard(`{${key}}`);
      await expect(slider).toHaveValue(value);
    }
    await expect(args.onValueChange).toHaveBeenCalledTimes(6);
    await expect(slider).toHaveAttribute('aria-valuetext', 'Step 1: A; 0 / 0.1 s');
    await userEvent.tab({ shift: true });
    await focused(canvas.getByRole('button', { name: 'Replay' }));
    for (const control of canvas.getAllByRole('button'))
      await expect(control.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
    await expect(slider.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
  },
};
export const PlaybackSequence: Story = {
  parameters: { docs: { source: { language: 'tsx', code: `import { TypewriterTerminal } from '@jfrader/ui';

<TypewriterTerminal
  steps={[{ command: 'A👩🏽‍💻', output: ['', 'Done'], pauseMs: 0 }]}
  speed={Number.NaN}
/>` } } },
  args: { steps: CLOCK_SCRIPT, speed: Number.NaN },
  beforeEach: controlledClock,
  play: async ({ canvas, canvasElement, args }) => {
    await expect(screen(canvasElement)).not.toHaveTextContent('👩🏽‍💻');
    const height = screen(canvasElement).getBoundingClientRect().height;
    await tick();
    await expect(screen(canvasElement)).toHaveTextContent('A');
    await expect(screen(canvasElement)).not.toHaveTextContent('👩');
    await tick();
    await expect(screen(canvasElement)).toHaveTextContent('A👩🏽‍💻');
    await tick();
    await expect(screen(canvasElement).querySelectorAll('pre')).toHaveLength(2);
    await tick();
    await expect(screen(canvasElement)).toHaveTextContent('Done');
    await tick();
    await expect(canvas.getByRole('button', { name: 'Play' })).toBeVisible();
    await expect(args.onValueChange).toHaveBeenCalledTimes(4);
    await expect(args.onValueChange).toHaveBeenNthCalledWith(1, 40);
    await expect(args.onValueChange).toHaveBeenNthCalledWith(2, 80);
    await expect(args.onValueChange).toHaveBeenNthCalledWith(3, 240);
    await expect(args.onValueChange).toHaveBeenNthCalledWith(4, 400);
    await expect(args.onPausedChange).toHaveBeenCalledTimes(1);
    await expect(args.onPausedChange).toHaveBeenCalledWith(true);
    await expect(clock.size).toBe(0);
    await expect(canvas.getByRole('status')).toBeEmptyDOMElement();
    await expect(
      Math.abs(screen(canvasElement).getBoundingClientRect().height - height),
    ).toBeLessThan(1.1);
  },
};
export const StrictModePlayback: Story = {
  ...PlaybackSequence,
  parameters: { docs: { source: { language: 'tsx', code: `import { StrictMode } from 'react';
import { TypewriterTerminal } from '@jfrader/ui';

<StrictMode>
  <TypewriterTerminal
    steps={[{ command: 'A👩🏽‍💻', output: ['', 'Done'], pauseMs: 0 }]}
    speed={Number.NaN}
  />
</StrictMode>` } } },
  decorators: [
    (Story) => (
      <StrictMode>
        <Story />
      </StrictMode>
    ),
  ],
};
export const RejectedPlaybackTick: Story = {
  args: { steps: CLOCK_SCRIPT, value: 0, paused: false },
  beforeEach: controlledClock,
  play: async ({ canvas, canvasElement, args }) => {
    await tick();
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenCalledWith(40);
    await expect(canvas.getByRole('slider')).toHaveValue('0');
    await expect(screen(canvasElement)).not.toHaveTextContent('A');
    await expect(clock.size).toBe(0);
  },
};
export const LoopOptIn: Story = {
  args: { steps: [{ command: 'A', pauseMs: 0 }], loop: true },
  beforeEach: controlledClock,
  play: async ({ canvas, args, userEvent }) => {
    await tick();
    await tick();
    await expect(args.onValueChange).toHaveBeenNthCalledWith(1, 40);
    await expect(args.onValueChange).toHaveBeenNthCalledWith(2, 0);
    await expect(args.onPausedChange).not.toHaveBeenCalled();
    await userEvent.click(canvas.getByRole('button', { name: 'Pause' }));
    await expect(clock.size).toBe(0);
  },
};
export const ScrubberPlaybackKeys: Story = {
  args: { value: 0, defaultPaused: true },
  beforeEach: controlledClock,
  play: async ({ canvas, userEvent, args }) => {
    const slider = canvas.getByRole('slider');
    slider.focus();
    await userEvent.keyboard('k');
    await expect(canvas.getByRole('button', { name: 'Pause' })).toBeVisible();
    await userEvent.keyboard(' ');
    await expect(canvas.getByRole('button', { name: 'Play' })).toBeVisible();
    await expect(args.onPausedChange).toHaveBeenCalledTimes(2);
    await expect(clock.size).toBe(0);
  },
};
export const NativeButtonActivation: Story = {
  args: { value: 0, defaultPaused: true, copyable: false },
  beforeEach: controlledClock,
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.tab();
    await focused(canvas.getByRole('button', { name: 'Play' }));
    await userEvent.keyboard('{Enter}');
    await expect(args.onPausedChange).toHaveBeenCalledTimes(1);
    await expect(args.onPausedChange).toHaveBeenCalledWith(false);
    await userEvent.keyboard(' ');
    await expect(args.onPausedChange).toHaveBeenCalledTimes(2);
    await expect(args.onPausedChange).toHaveBeenNthCalledWith(2, true);
  },
};

export const CopyCommands: Story = {
  args: { defaultPaused: true },
  play: async ({ canvas, canvasElement, userEvent }) => {
    const write = fn().mockResolvedValue(undefined);
    await clipboard(canvasElement, write, async () => {
      await userEvent.click(canvas.getByRole('button', { name: 'Copy commands' }));
      await expect(write).toHaveBeenCalledTimes(1);
      await expect(write).toHaveBeenCalledWith('example init\nexample --help');
      await expect(canvas.getByRole('status')).toHaveTextContent('Commands copied');
    });
  },
};
export const CopyDenied: Story = {
  args: { defaultPaused: true },
  play: async ({ canvas, canvasElement, userEvent }) => {
    const write = fn().mockRejectedValue(new Error('Denied'));
    await clipboard(canvasElement, write, async () => {
      await userEvent.click(canvas.getByRole('button', { name: 'Copy commands' }));
      await expect(write).toHaveBeenCalledTimes(1);
      await expect(canvas.getByRole('status')).toHaveTextContent('Could not copy commands');
    });
  },
};
export const CopyUnavailable: Story = {
  args: { defaultPaused: true },
  play: async ({ canvas, canvasElement, userEvent }) => {
    await clipboard(canvasElement, undefined, async () => {
      await userEvent.click(canvas.getByRole('button', { name: 'Copy commands' }));
      await expect(canvas.getByRole('status')).toHaveTextContent('Could not copy commands');
    });
  },
};
export const ExternalRelationships: Story = {
  args: {
    caption: 'Script output',
    defaultPaused: true,
    'aria-label': 'Consumer session',
    'aria-labelledby': 'terminal-external-label',
    'aria-describedby': 'terminal-external-description missing-description',
  },
  render: (args) => (
    <div>
      <span id="terminal-external-label">Consumer name</span>
      <span id="terminal-external-description">Description</span>
      <TypewriterTerminal {...args} />
    </div>
  ),
  play: async ({ canvas, canvasElement }) => {
    const root = canvas.getByRole('figure', { name: 'Consumer name' });
    await expect(root).toHaveAttribute('aria-label', 'Consumer session');
    await expect(root).toHaveAttribute('aria-labelledby', 'terminal-external-label');
    await expect(root).toHaveAttribute(
      'aria-describedby',
      `terminal-external-description missing-description ${canvasElement.querySelector('figcaption')!.id}`,
    );
  },
};
export const MultipleInstances: Story = {
  parameters: { layout: 'padded' },
  args: { defaultPaused: true, caption: 'Session' },
  render: (args) => (
    <div>
      <TypewriterTerminal {...args} />
      <TypewriterTerminal {...args} />
    </div>
  ),
  play: async ({ canvasElement, canvas }) => {
    const captions = canvasElement.querySelectorAll('figcaption');
    await expect(captions[0]!.id).not.toBe(captions[1]!.id);
    for (const [index, figure] of canvas.getAllByRole('figure').entries())
      await expect(figure).toHaveAttribute('aria-describedby', captions[index]!.id);
  },
};
export const SafeLinks: Story = {
  args: {
    defaultPaused: true,
    steps: [
      {
        command: 'example docs',
        output: [
          { text: 'Website', href: 'https://example.com' },
          { text: 'Relative', href: '/docs' },
          { text: 'Unsafe', href: 'javascript:alert(1)' },
          { text: 'Data', href: 'data:text/html,test' },
        ],
      },
    ],
  },
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.getAllByRole('link')).toHaveLength(2);
    await expect(screen(canvasElement).querySelector('a')).toBeNull();
  },
};
export const LightTheme: Story = {
  args: { defaultValue: FINISHED, defaultPaused: true },
  globals: { theme: 'light' },
  decorators: [withLightTheme],
};
export const RTL: Story = {
  args: { dir: 'rtl', title: 'Sesión', defaultPaused: true },
  play: async ({ canvasElement, canvas }) => {
    await expect(getComputedStyle(canvas.getByRole('figure')).direction).toBe('rtl');
    await expect(getComputedStyle(screen(canvasElement)).direction).toBe('ltr');
  },
};
export const ForcedColors: Story = {
  args: { defaultValue: FINISHED, defaultPaused: true },
  parameters: {
    docs: {
      description: {
        story:
          'Structural fixture for forced-colors browser QA; this story does not emulate the preference.',
      },
    },
  },
};
export const ReducedMotionFinished: Story = {
  args: { defaultValue: FINISHED, defaultPaused: true, loop: true },
  parameters: {
    docs: {
      description: {
        story:
          'Completed fixture. Enable reduced motion in browser QA to verify instant output, static caret and disabled looping.',
      },
    },
  },
  play: async ({ canvasElement, args }) => {
    await expect(screen(canvasElement)).toHaveTextContent('example --help');
    await expect(args.onPausedChange).not.toHaveBeenCalled();
    await expect(args.onValueChange).not.toHaveBeenCalled();
  },
};
export const NarrowContainer: Story = {
  args: {
    defaultValue: FINISHED,
    defaultPaused: true,
    title: 'A long terminal title that wraps',
    rows: 4,
  },
  render: (args) => (
    <NarrowFrame>
      <TypewriterTerminal {...args} />
    </NarrowFrame>
  ),
  play: async ({ canvas }) => {
    const root = canvas.getByRole('figure');
    for (const button of canvas.getAllByRole('button'))
      await expect(button.getBoundingClientRect().right).toBeLessThanOrEqual(
        root.getBoundingClientRect().right + 1.1,
      );
  },
};
export const LongTranscript: Story = {
  parameters: { layout: 'padded' },
  args: {
    defaultValue: FINISHED,
    defaultPaused: true,
    steps: [{
      command: 'example inspect',
      output: [
        'unbroken'.repeat(30),
        { text: `https://example.com/${'documentation'.repeat(20)}`, href: 'https://example.com' },
      ],
    }],
  },
  render: (args) => <NarrowFrame><TypewriterTerminal {...args} /></NarrowFrame>,
  play: async ({ canvas, canvasElement, userEvent }) => {
    for (let index = 0; index < 5; index++) await userEvent.tab();
    const link = canvas.getByRole('link');
    await focused(link);
    const root = canvas.getByRole('figure');
    await expectInside(link, root);
    const content = transcript(canvasElement);
    await expect(getComputedStyle(content).position).toBe('static');
    await expect(getComputedStyle(content).clipPath).toBe('none');
    await expect(content.scrollWidth).toBeLessThanOrEqual(content.clientWidth + 1);
    await expect(root.scrollWidth).toBeLessThanOrEqual(root.clientWidth + 1);
  },
};
// This story tests the documented css/slot API and native style merging.
export const SlotStyles: Story = {
  args: {
    defaultPaused: true,
    caption: 'Caption',
    slotProps: {
      header: { sx: { paddingInline: vars.space[6] } },
      screen: { sx: { fontSize: vars.textSize.md } },
      controls: { sx: { gap: vars.space[4] } },
      caption: { sx: { fontWeight: vars.fontWeight.medium } },
      status: { sx: { fontFamily: vars.font.mono } },
    },
  },
  play: async ({ canvasElement }) => {
    await expect(
      parseFloat(getComputedStyle(canvasElement.querySelector('header')!).paddingInlineStart),
    ).toBeCloseTo(24, 0);
    const remPx = parseFloat(
      getComputedStyle(canvasElement.ownerDocument.documentElement).fontSize,
    );
    await expect(parseFloat(getComputedStyle(screen(canvasElement)).fontSize)).toBeCloseTo(
      remPx,
      0,
    );
    await expect(getComputedStyle(canvasElement.querySelector('figcaption')!).fontWeight).toBe(
      '500',
    );
  },
};

function ReplacementExample(args: TypewriterTerminalProps) {
  const [steps, setSteps] = useState(args.steps);
  return (
    <div>
      <Button onClick={() => setSteps([])}>Replace script</Button>
      <TypewriterTerminal {...args} steps={steps} />
    </div>
  );
}
export const ScriptReplacement: Story = {
  args: { steps: CLOCK_SCRIPT, defaultValue: 80, defaultPaused: true },
  render: (args) => <ReplacementExample {...args} />,
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Replace script' }));
    await expect(canvas.getByRole('slider')).toHaveValue('0');
    await expect(transcript(canvasElement)).toBeEmptyDOMElement();
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await expect(args.onPausedChange).not.toHaveBeenCalled();
  },
};
function UnmountExample(args: TypewriterTerminalProps) {
  const [mounted, setMounted] = useState(true);
  return (
    <div>
      <Button onClick={() => setMounted(false)}>Unmount player</Button>
      {mounted && <TypewriterTerminal {...args} />}
    </div>
  );
}
export const UnmountCleanup: Story = {
  args: { steps: CLOCK_SCRIPT },
  beforeEach: controlledClock,
  render: (args) => <UnmountExample {...args} />,
  play: async ({ canvas, userEvent, args }) => {
    await waitFor(() => expect(clock.size).toBe(1));
    await userEvent.click(canvas.getByRole('button', { name: 'Unmount player' }));
    await expect(clock.size).toBe(0);
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await expect(args.onPausedChange).not.toHaveBeenCalled();
  },
};
export const VisibilityFreeze: Story = {
  args: { steps: CLOCK_SCRIPT },
  beforeEach: controlledClock,
  play: async ({ canvasElement, args }) => {
    const document = canvasElement.ownerDocument;
    const visibility = spyOn(document, 'visibilityState', 'get');
    try {
      await waitFor(() => expect(clock.size).toBe(1));
      await act(async () => {
        visibility.mockReturnValue('hidden');
        document.dispatchEvent(new Event('visibilitychange'));
      });
      await expect(clock.size).toBe(0);
      await expect(args.onValueChange).not.toHaveBeenCalled();
      await act(async () => {
        visibility.mockReturnValue('visible');
        document.dispatchEvent(new Event('visibilitychange'));
      });
      await tick();
      await expect(args.onValueChange).toHaveBeenCalledTimes(1);
      await expect(args.onValueChange).toHaveBeenCalledWith(40);
    } finally {
      visibility.mockRestore();
    }
  },
};
export const PendingCopyReplacement: Story = {
  args: { defaultPaused: true },
  render: (args) => <ReplacementExample {...args} />,
  play: async ({ canvas, canvasElement, userEvent }) => {
    let resolve: () => void = () => {};
    const write = fn(
      () =>
        new Promise<void>((accept) => {
          resolve = accept;
        }),
    );
    await clipboard(canvasElement, write, async () => {
      await userEvent.click(canvas.getByRole('button', { name: 'Copy commands' }));
      await expect(canvas.getByRole('button', { name: 'Copy commands' })).toHaveAttribute(
        'aria-disabled',
        'true',
      );
      await userEvent.click(canvas.getByRole('button', { name: 'Replace script' }));
      await act(async () => resolve());
      await expect(canvas.getByRole('status')).toBeEmptyDOMElement();
      await expect(write).toHaveBeenCalledTimes(1);
    });
  },
};
export const RefAttachment: Story = {
  parameters: { docs: { source: { language: 'tsx', code: `import { useRef } from 'react';
import { TypewriterTerminal } from '@jfrader/ui';

export function Terminal() {
  const terminalRef = useRef<HTMLElement>(null);
  return (
    <TypewriterTerminal
      ref={terminalRef}
      defaultPaused
      steps={[
        { command: 'example init', output: ['Workspace created', '', { text: 'Ready', tone: 'success' }] },
        { command: 'example --help', output: ['Usage: example [command]', { text: 'Documentation', href: '/docs' }] },
      ]}
    />
  );
}` } } },
  args: { defaultPaused: true, ref: fn() },
  play: async ({ canvas, args }) => {
    const calls = (args.ref as ReturnType<typeof fn>).mock.calls;
    await expect(calls.some(([element]) => element === canvas.getByRole('figure'))).toBe(true);
  },
};

let reducedMedia: MediaQueryList;
let setReducedPreference: (matches: boolean) => void;
export const LiveReducedMotion: Story = {
  args: { steps: SCRIPT, loop: true },
  beforeEach: () => {
    const restoreClock = controlledClock();
    const original = window.matchMedia.bind(window);
    reducedMedia = original('(prefers-reduced-motion: reduce)');
    const matches = spyOn(reducedMedia, 'matches', 'get').mockReturnValue(false);
    const media = spyOn(window, 'matchMedia').mockImplementation((query) =>
      query === reducedMedia.media ? reducedMedia : original(query),
    );
    setReducedPreference = (value) => {
      matches.mockReturnValue(value);
      reducedMedia.dispatchEvent(
        new MediaQueryListEvent('change', { matches: value, media: reducedMedia.media }),
      );
    };
    return () => {
      matches.mockRestore();
      media.mockRestore();
      restoreClock();
    };
  },
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    await waitFor(() => expect(clock.size).toBe(1));
    await act(async () => setReducedPreference(true));
    await expect(screen(canvasElement)).toHaveTextContent('example --help');
    await expect(clock.size).toBe(0);
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await expect(args.onPausedChange).not.toHaveBeenCalled();
    const slider = canvas.getByRole('slider');
    slider.focus();
    await userEvent.keyboard('{Home}');
    await expect(screen(canvasElement)).toHaveTextContent('Ready');
    await expect(screen(canvasElement)).not.toHaveTextContent('example --help');
    await userEvent.click(canvas.getByRole('button', { name: 'Replay' }));
    await expect(screen(canvasElement)).toHaveTextContent('example --help');
    await expect(canvas.getByRole('status')).toHaveTextContent('Replayed');
    await expect(clock.size).toBe(0);
  },
};
export const OffscreenFreeze: Story = {
  args: { steps: CLOCK_SCRIPT },
  beforeEach: controlledClock,
  play: async ({ canvas, args }) => {
    const root = canvas.getByRole('figure');
    await waitFor(() => expect(clock.size).toBe(1));
    root.style.display = 'none';
    await waitFor(() => expect(clock.size).toBe(0));
    await expect(args.onValueChange).not.toHaveBeenCalled();
    root.style.display = '';
    await tick();
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenCalledWith(40);
  },
};
