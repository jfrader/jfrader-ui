import { StrictMode, useRef, useState, type ComponentPropsWithRef } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fireEvent, fn, spyOn, waitFor, within } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { withLightTheme } from '../../testing/story-decorators';
import { expectInside, expectNoOverlap } from '../../testing/geometry-assertions';
import { styled } from '../../styling/styled';
import { Button, type ButtonProps } from '../button';
import {
  VoiceRecorder,
  type VoiceRecorderProps,
  type VoiceRecorderValue,
  type VoiceMessage,
} from './index';

const SAMPLE_PEAKS = [
  0.1, 0.25, 0.5, 0.8, 0.9, 0.7, 0.4, 0.3,
  0.6, 0.85, 0.95, 0.6, 0.3, 0.15, 0.4, 0.75,
  0.8, 0.5, 0.35, 0.6, 0.7, 0.45, 0.2, 0.1,
  0.3, 0.65, 0.8, 0.6, 0.4, 0.25, 0.15, 0.05,
];

const SAMPLE_MESSAGES: VoiceMessage[] = [
  {
    id: 'msg-1',
    sender: 'Alex Morgan',
    duration: 14,
    peaks: SAMPLE_PEAKS.slice(0, 16),
    metadata: 'Yesterday at 4:15 PM',
  },
  {
    id: 'msg-2',
    sender: 'Jordan Lee',
    duration: 32,
    peaks: SAMPLE_PEAKS,
    metadata: 'Today at 9:30 AM',
  },
];

const StoryFrame = styled('div')({ inlineSize: '100%', maxInlineSize: '48rem' });
const NarrowFrame = styled(StoryFrame)({ maxInlineSize: '20rem' });

async function expectRecorderGeometry(canvasElement: HTMLElement) {
  const root = canvasElement.querySelector<HTMLElement>('[data-ui="voice-recorder"]')!;
  const composer = root.querySelector<HTMLElement>('[data-ui="voice-recorder-composer"]')!;
  await expectInside(composer, root);
  const controls = Array.from(composer.querySelectorAll('button, input'));
  for (const control of controls) {
    await expectInside(control, composer);
    await expect(control.getBoundingClientRect().height).toBeGreaterThanOrEqual(32);
    await expect(control.scrollWidth).toBeLessThanOrEqual(control.clientWidth + 1);
  }
  for (let i = 1; i < controls.length; i++) {
    await expectNoOverlap(controls[i - 1]!, controls[i]!);
  }
}

const meta = {
  title: 'Media/VoiceRecorder',
  component: VoiceRecorder,
  tags: ['autodocs'],
  decorators: [(Story) => <StoryFrame><Story /></StoryFrame>],
  args: {
    onRecordRequest: fn(async () => {}),
    onStopRequest: fn(async (sessionId: string) => ({ takeId: `take-${sessionId || '101'}` })),
    onSend: fn(async () => {}),
    onDiscard: fn(),
    onValueChange: fn(),
    onCurrentTimeChange: fn(),
    onPlayingChange: fn(),
    onMessagePlay: fn(),
    onMessageSeek: fn(),
  },
  parameters: {
    layout: 'padded',
    docs: {
      sections: [
        { title: 'Recorder', stories: ['DefaultIdle', 'Small'] },
        { title: 'Conversation', stories: ['WithMessages'] },
      ],
      usage: `### Audio ownership
Supply audio capture, MediaRecorder, playback, uploads, message persistence and cleanup in your application. VoiceRecorder does not call browser media APIs. These examples show the controls without capturing or playing audio.

### Keyboard and accessibility

Tab follows the controls in order; Enter and Space activate buttons. Escape discards while recording or reviewing. Use the review slider to scrub with the keyboard.`,
      description: {
        component:
          'Record, review and send voice notes with waveform feedback.',
      },
    },
  },
  render: (args) => <VoiceRecorder {...args} />,
} satisfies Meta<typeof VoiceRecorder>;

export default meta;
type Story = StoryObj<typeof meta>;

export const DefaultIdle: Story = {
  name: 'Voice note controls',
  parameters: { docs: {
    description: { story: 'Start a voice note from the idle recorder controls; audio capture is application-owned.' },
    source: { language: 'tsx', code: `import { VoiceRecorder, type VoiceRecorderProps } from '@jfrader/ui';

type AudioActions = Pick<VoiceRecorderProps, 'onRecordRequest' | 'onStopRequest' | 'onSend'>;

export function VoiceNote({ onRecordRequest, onStopRequest, onSend }: AudioActions) {
  return <VoiceRecorder onRecordRequest={onRecordRequest} onStopRequest={onStopRequest} onSend={onSend} />;
}` },
  } },
  play: async ({ canvasElement, args, userEvent }) => {
    const canvas = within(canvasElement);
    const root = canvasElement.querySelector('[data-ui="voice-recorder"]');
    await expect(root).toHaveAttribute('data-state', 'idle');

    const recordButton = canvas.getByRole('button', { name: 'Record voice note' });
    await expect(recordButton).toBeVisible();

    await userEvent.click(recordButton);
    await expect(args.onRecordRequest).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenCalledWith(
      expect.objectContaining({ state: 'recording' }),
    );
  },
};

export const Small: Story = {
  name: 'Compact recorder',
  parameters: { docs: {
    description: { story: 'Use smaller recorder controls in a message composer.' },
    source: { language: 'tsx', code: `import { VoiceRecorder, type VoiceRecorderProps } from '@jfrader/ui';

type AudioActions = Pick<VoiceRecorderProps, 'onRecordRequest' | 'onStopRequest' | 'onSend'>;

export function CompactVoiceNote({ onRecordRequest, onStopRequest, onSend }: AudioActions) {
  return <VoiceRecorder size="sm" onRecordRequest={onRecordRequest} onStopRequest={onStopRequest} onSend={onSend} />;
}` },
  } },
  args: { size: 'sm' },
};

export const Medium: Story = {
  args: { size: 'md' },
};

export const Recording: Story = {
  tags: ['!autodocs'],
  args: {
    value: { state: 'recording', sessionId: 'session-alpha' },
    elapsed: 14,
    peaks: SAMPLE_PEAKS,
  },
  play: async ({ canvasElement, args, userEvent }) => {
    const canvas = within(canvasElement);
    const stopButton = canvas.getByRole('button', { name: 'Stop recording' });
    const discardButton = canvas.getByRole('button', { name: 'Discard recording' });

    await expect(stopButton).toBeVisible();
    await expect(discardButton).toBeVisible();
    await expect(canvasElement.querySelector('[data-ui="voice-orb-visual"]')).toBeInTheDocument();

    const timer = canvasElement.querySelector('[data-ui="voice-recorder-timer"]');
    await expect(timer).toHaveTextContent(/14/);

    await userEvent.click(stopButton);
    await expect(args.onStopRequest).toHaveBeenCalledWith('session-alpha');
  },
};

export const ReviewPaused: Story = {
  tags: ['!autodocs'],
  args: {
    value: { state: 'review', takeId: 'take-101' },
    duration: 42,
    currentTime: 12,
    playing: false,
    peaks: SAMPLE_PEAKS,
  },
  play: async ({ canvasElement, args, userEvent }) => {
    const canvas = within(canvasElement);
    const playButton = canvas.getByRole('button', { name: 'Play recording' });
    const discardButton = canvas.getByRole('button', { name: 'Discard recording' });
    const sendButton = canvas.getByRole('button', { name: 'Send voice note' });
    const seekInput = canvas.getByRole('slider', { name: 'Review position' });

    await expect(playButton).toBeVisible();
    await expect(discardButton).toBeVisible();
    await expect(sendButton).toBeVisible();
    await expect(seekInput).toHaveValue('12');

    await userEvent.click(playButton);
    await expect(args.onPlayingChange).toHaveBeenCalledWith(true);

    await userEvent.click(sendButton);
    await expect(args.onSend).toHaveBeenCalledWith('take-101');
  },
};

export const ReviewPlaying: Story = {
  tags: ['!autodocs'],
  args: {
    value: { state: 'review', takeId: 'take-101' },
    duration: 42,
    currentTime: 18,
    playing: true,
    peaks: SAMPLE_PEAKS,
  },
  play: async ({ canvasElement, args, userEvent }) => {
    const canvas = within(canvasElement);
    const pauseButton = canvas.getByRole('button', { name: 'Pause playback' });
    await expect(pauseButton).toBeVisible();

    await userEvent.click(pauseButton);
    await expect(args.onPlayingChange).toHaveBeenCalledWith(false);
  },
};

export const PendingSending: Story = {
  tags: ['!autodocs'],
  args: {
    value: { state: 'pending', takeId: 'take-101' },
    duration: 42,
  },
  play: async ({ canvasElement, args, userEvent }) => {
    const canvas = within(canvasElement);
    const sendingButton = canvas.getByRole('button', { name: 'Sending voice note…' });
    await expect(sendingButton).toHaveAttribute('aria-busy', 'true');
    await expect(sendingButton).toHaveAttribute('aria-disabled', 'true');
    await expect(sendingButton).not.toBeDisabled();
    await userEvent.tab();
    await expect(sendingButton).toHaveFocus();
    await userEvent.keyboard('{Enter} ');
    await expect(args.onSend).not.toHaveBeenCalled();
  },
};

export const RecordingError: Story = {
  tags: ['!autodocs'],
  args: {
    value: { state: 'error', error: 'Microphone access denied.' },
  },
  play: async ({ canvasElement, args, userEvent }) => {
    const canvas = within(canvasElement);
    const alert = canvas.getByRole('alert');
    await expect(alert).toHaveTextContent('Microphone access denied.');

    const retryRecord = canvas.getByRole('button', { name: 'Record voice note' });
    await expect(retryRecord).toBeVisible();

    await userEvent.click(retryRecord);
    await expect(args.onRecordRequest).toHaveBeenCalledTimes(1);
  },
};

export const UploadError: Story = {
  tags: ['!autodocs'],
  args: {
    value: { state: 'error', takeId: 'take-101', error: 'Upload connection timed out.' },
  },
  play: async ({ canvasElement, args, userEvent }) => {
    const canvas = within(canvasElement);
    const alert = canvas.getByRole('alert');
    await expect(alert).toHaveTextContent('Upload connection timed out.');

    const retrySend = canvas.getByRole('button', { name: 'Send voice note' });
    const discard = canvas.getByRole('button', { name: 'Discard recording' });

    await expect(retrySend).toBeVisible();
    await expect(discard).toBeVisible();

    await userEvent.click(retrySend);
    await expect(args.onSend).toHaveBeenCalledWith('take-101');

    await userEvent.click(discard);
    await expect(args.onDiscard).toHaveBeenCalledWith('take-101');
  },
};

export const WithMessages: Story = {
  name: 'Voice message history',
  parameters: { docs: {
    description: { story: 'Show two previous voice notes with a playback position on the first message.' },
    source: { language: 'tsx', code: `import { VoiceRecorder, type VoiceMessage, type VoiceRecorderProps } from '@jfrader/ui';

const peaks = [
  0.1, 0.25, 0.5, 0.8, 0.9, 0.7, 0.4, 0.3,
  0.6, 0.85, 0.95, 0.6, 0.3, 0.15, 0.4, 0.75,
  0.8, 0.5, 0.35, 0.6, 0.7, 0.45, 0.2, 0.1,
  0.3, 0.65, 0.8, 0.6, 0.4, 0.25, 0.15, 0.05,
];
const messages: VoiceMessage[] = [
  { id: 'msg-1', sender: 'Alex Morgan', duration: 14, peaks: peaks.slice(0, 16), metadata: 'Yesterday at 4:15 PM' },
  { id: 'msg-2', sender: 'Jordan Lee', duration: 32, peaks, metadata: 'Today at 9:30 AM' },
];

type AudioActions = Pick<VoiceRecorderProps, 'onRecordRequest' | 'onStopRequest' | 'onSend' | 'onMessagePlay' | 'onMessageSeek'>;

export function VoiceConversation({ onRecordRequest, onStopRequest, onSend, onMessagePlay, onMessageSeek }: AudioActions) {
  return <VoiceRecorder messages={messages} messagePlayback={{ id: 'msg-1', playing: true, currentTime: 5 }}
    onRecordRequest={onRecordRequest} onStopRequest={onStopRequest} onSend={onSend}
    onMessagePlay={onMessagePlay} onMessageSeek={onMessageSeek} />;
}` },
  } },
  args: {
    messages: SAMPLE_MESSAGES,
    messagePlayback: { id: 'msg-1', playing: true, currentTime: 5 },
  },
  play: async ({ canvasElement, args, userEvent }) => {
    const canvas = within(canvasElement);
    const list = canvas.getByRole('list', { name: 'Voice messages' });
    await expect(list).toBeVisible();

    const items = canvasElement.querySelectorAll('[data-ui="voice-recorder-message"]');
    await expect(items.length).toBe(2);

    const pauseMsg = canvas.getByRole('button', { name: 'Pause playback' });
    await expect(pauseMsg).toBeVisible();

    await userEvent.click(pauseMsg);
    await expect(args.onMessagePlay).toHaveBeenCalledWith('msg-1', false);
  },
};

export const EmptyPeaks: Story = {
  tags: ['!autodocs'],
  args: {
    value: { state: 'review', takeId: 'take-empty' },
    duration: 10,
    peaks: [],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('slider')).toBeVisible();
  },
};

export const ZeroDuration: Story = {
  tags: ['!autodocs'],
  args: {
    value: { state: 'review', takeId: 'take-zero' },
    duration: 0,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const slider = canvas.getByRole('slider');
    await expect(slider).toBeDisabled();
  },
};

export const MaxDurationReached: Story = {
  tags: ['!autodocs'],
  args: {
    value: { state: 'recording', sessionId: 'session-limit' },
    elapsed: 60,
    maxDuration: 60,
  },
  play: async ({ args }) => {
    await waitFor(() => {
      expect(args.onStopRequest).toHaveBeenCalledWith('session-limit');
    });
  },
};

export const Disabled: Story = {
  args: { disabled: true },
  play: async ({ canvasElement }) => {
    const button = within(canvasElement).getByRole('button', { name: 'Record voice note' });
    await expect(button).toBeDisabled();
  },
};

export const LongLabels: Story = {
  render: (args) => <NarrowFrame><VoiceRecorder {...args} duration={42} peaks={SAMPLE_PEAKS} /></NarrowFrame>,
  args: {
    labels: {
      root: 'Encrypted High-Fidelity Audio Note Terminal',
      messages: 'Archived Transmission Records',
      record: 'Initiate High-Definition Audio Capture Sequence',
      stop: 'Finalize Recording and Enter Review Inspection',
      play: 'Begin Acoustic Playback Stream',
      pause: 'Halt Acoustic Playback Stream',
      discard: 'Permanently Erase Current Take',
      send: 'Transmit Finalized Audio Package',
      sending: 'Dispatching Encrypted Payload…',
      seek: 'Chronological Scrub Position',
      status: {
        idle: 'System ready for voice recording',
        recording: 'Capturing live microphone input stream',
        review: 'Inspection mode active',
        pending: 'Dispatching audio packet to destination',
        sent: 'Audio packet acknowledged by remote host',
        discarded: 'Audio buffer flushed and purged',
        error: 'System encountered a processing failure',
      },
    },
  },
  play: async ({ canvasElement, userEvent }) => {
    const button = within(canvasElement).getByRole('button', {
      name: 'Initiate High-Definition Audio Capture Sequence',
    });
    await expect(button).toBeVisible();
    await expectRecorderGeometry(canvasElement);
    await userEvent.click(button);
    await expectRecorderGeometry(canvasElement);
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Finalize Recording and Enter Review Inspection' }));
    await within(canvasElement).findByRole('slider');
    await expectRecorderGeometry(canvasElement);
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Begin Acoustic Playback Stream' }));
    await expect(within(canvasElement).getByRole('button', { name: 'Halt Acoustic Playback Stream' })).toBeVisible();
    await expectRecorderGeometry(canvasElement);
  },
};

export const LightTheme: Story = {
  globals: { theme: 'light' },
  decorators: [withLightTheme],
};

export const Rtl: Story = {
  args: { value: { state: 'review', takeId: 'rtl-take' }, duration: 42, currentTime: 12, peaks: SAMPLE_PEAKS },
  parameters: { direction: 'rtl' },
  render: (args) => (
    <div dir="rtl">
      <VoiceRecorder {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const root = canvasElement.querySelector('[data-ui="voice-recorder"]');
    await expect(root).toBeVisible();
    await expectRecorderGeometry(canvasElement);
    const bars = canvasElement.querySelectorAll('[data-ui="voice-recorder-waveform"] rect');
    await expect(bars[0]!.getBoundingClientRect().left).toBeGreaterThan(bars[bars.length - 1]!.getBoundingClientRect().right);
    const timer = canvasElement.querySelector('[data-ui="voice-recorder-timer"]')!;
    await expect(getComputedStyle(timer).direction).toBe('ltr');
  },
};

export const LongMessageMetadata: Story = {
  args: { messages: [{ ...SAMPLE_MESSAGES[0]!, metadata: 'https://example.test/recordings/averylongunbrokensharedrecordingidentifier' }] },
  render: (args) => <NarrowFrame><VoiceRecorder {...args} /></NarrowFrame>,
  play: async ({ canvasElement }) => {
    const message = canvasElement.querySelector('[data-ui="voice-recorder-message"]')!;
    const metadata = canvasElement.querySelector<HTMLElement>('[data-ui="voice-recorder-message-metadata"]')!;
    await expectInside(metadata, message);
    await expect(metadata.scrollWidth).toBeLessThanOrEqual(metadata.clientWidth + 1);
    for (const control of message.querySelectorAll('button, input')) await expectInside(control, message);
  },
};

export const TwoInstances: Story = {
  render: (args) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: vars.space[6] }}>
      <VoiceRecorder {...args} aria-label="First voice recorder" />
      <VoiceRecorder {...args} aria-label="Second voice recorder" />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const elements = canvasElement.querySelectorAll('[data-ui="voice-recorder"]');
    await expect(elements.length).toBe(2);
  },
};

function ReplacementRoot(props: ComponentPropsWithRef<'section'>) {
  return <section {...props} data-slot-test="root" />;
}
function ReplacementComposer(props: ComponentPropsWithRef<'div'>) {
  return <div {...props} data-slot-test="composer" />;
}
function ReplacementWaveform(props: ComponentPropsWithRef<'div'>) {
  return <div {...props} data-slot-test="waveform" />;
}
function ReplacementSeek(props: ComponentPropsWithRef<'input'>) {
  return <input {...props} data-slot-test="seek" />;
}
function ReplacementControl(props: ButtonProps) {
  return <Button {...props} data-slot-test="button" />;
}
function ReplacementStatus(props: ComponentPropsWithRef<'span'>) {
  return <span {...props} data-slot-test="status" />;
}
function ReplacementError(props: ComponentPropsWithRef<'p'>) {
  return <p {...props} data-slot-test="error" />;
}

export const ReplacementSlots: Story = {
  tags: ['!autodocs'],
  args: {
    value: { state: 'review', takeId: 'take-slots' },
    duration: 30,
    currentTime: 10,
    slots: {
      root: ReplacementRoot,
      composer: ReplacementComposer,
      waveform: ReplacementWaveform,
      seek: ReplacementSeek,
      record: ReplacementControl,
      stop: ReplacementControl,
      play: ReplacementControl,
      discard: ReplacementControl,
      send: ReplacementControl,
      status: ReplacementStatus,
      error: ReplacementError,
    },
  },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('[data-slot-test="root"]')).toBeInTheDocument();
    await expect(canvasElement.querySelector('[data-slot-test="composer"]')).toBeInTheDocument();
    await expect(canvasElement.querySelector('[data-slot-test="waveform"]')).toBeInTheDocument();
    await expect(canvasElement.querySelector('[data-slot-test="seek"]')).toBeInTheDocument();
    await expect(canvasElement.querySelector('[data-slot-test="status"]')).toBeInTheDocument();
  },
};

function ControlledRejectsFixture(args: VoiceRecorderProps) {
  const [value] = useState<VoiceRecorderValue>({ state: 'idle' });
  return <VoiceRecorder {...args} value={value} />;
}

export const ControlledRejects: Story = {
  render: (args) => <ControlledRejectsFixture {...args} />,
  play: async ({ canvasElement, args, userEvent }) => {
    const canvas = within(canvasElement);
    const recordButton = canvas.getByRole('button', { name: 'Record voice note' });
    await userEvent.click(recordButton);

    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    // Controlled value was not updated by parent, so screen stays on idle Record button!
    await expect(canvas.getByRole('button', { name: 'Record voice note' })).toBeVisible();
    await expect(canvas.queryByRole('button', { name: 'Stop recording' })).not.toBeInTheDocument();
    await expect(canvas.getByRole('status')).toBeEmptyDOMElement();
  },
};

function InteractiveLifecycleFixture(args: VoiceRecorderProps) {
  const [value, setValue] = useState<VoiceRecorderValue>({ state: 'idle' });
  const [currentTime, setCurrentTime] = useState(0);
  const [playing, setPlaying] = useState(false);

  return (
    <VoiceRecorder
      {...args}
      value={value}
      onValueChange={(next) => {
        args.onValueChange?.(next);
        setValue(next);
      }}
      duration={30}
      peaks={SAMPLE_PEAKS}
      currentTime={currentTime}
      onCurrentTimeChange={(time) => {
        args.onCurrentTimeChange?.(time);
        setCurrentTime(time);
      }}
      playing={playing}
      onPlayingChange={(next) => {
        args.onPlayingChange?.(next);
        setPlaying(next);
      }}
      onRecordRequest={async (sessionId) => {
        await args.onRecordRequest?.(sessionId);
      }}
      onStopRequest={async (sessionId) => {
        const res = await args.onStopRequest?.(sessionId);
        return res ?? { takeId: `take-${sessionId || '101'}` };
      }}
      onSend={async (takeId) => {
        await args.onSend?.(takeId);
      }}
      onDiscard={(id) => {
        args.onDiscard?.(id);
      }}
    />
  );
}

export const KeyboardFlow: Story = {
  render: (args) => <InteractiveLifecycleFixture {...args} />,
  play: async ({ canvasElement, userEvent, args }) => {
    const canvas = within(canvasElement);
    const recordButton = canvas.getByRole('button', { name: 'Record voice note' });

    // Focus starts outside; tab to record button
    await userEvent.tab();
    await expect(recordButton).toHaveFocus();

    // Activate Record button via Enter
    await userEvent.keyboard('{Enter}');
    await expect(args.onRecordRequest).toHaveBeenCalledTimes(1);

    // Stop button appears and inherits focus
    const stopButton = await canvas.findByRole('button', { name: 'Stop recording' });
    await expect(stopButton).toHaveFocus();
    await expect(stopButton.ownerDocument.activeElement).toBe(stopButton);
    await expect(getComputedStyle(stopButton).outlineStyle).not.toBe('none');

    // Tab to Discard button
    await userEvent.tab();
    const discardButton = canvas.getByRole('button', { name: 'Discard recording' });
    await expect(discardButton).toHaveFocus();

    // Tab back to Stop button
    await userEvent.tab({ shift: true });
    await expect(stopButton).toHaveFocus();

    // Activate Stop button via Space
    await userEvent.keyboard(' ');
    await expect(args.onStopRequest).toHaveBeenCalledTimes(1);

    // Review appears; focus transitions to Send button
    const sendButton = await canvas.findByRole('button', { name: 'Send voice note' });
    await expect(sendButton).toHaveFocus();

    // Tab backwards to reach seek range
    await userEvent.tab({ shift: true }); // discard
    await userEvent.tab({ shift: true }); // play
    await userEvent.tab({ shift: true }); // slider
    const seekSlider = canvas.getByRole('slider', { name: 'Review position' });
    await expect(seekSlider).toHaveFocus();
    await expect(getComputedStyle(seekSlider).outlineStyle).not.toBe('none');

    await fireEvent.change(seekSlider, { target: { value: '1' } });
    await expect(args.onCurrentTimeChange).toHaveBeenCalledWith(1);

    // Escape discards review and returns to idle
    await userEvent.keyboard('{Escape}');
    await expect(args.onDiscard).toHaveBeenCalledTimes(1);

    // State returns to idle; Record button receives preserved focus
    const restoredRecordButton = await canvas.findByRole('button', { name: 'Record voice note' });
    await expect(restoredRecordButton).toHaveFocus();
  },
};

function ExternalSessionFixture(args: VoiceRecorderProps) {
  const [value, setValue] = useState<VoiceRecorderValue>(args.value ?? { state: 'idle' });
  const settle = useRef<() => void>(() => {});
  return <>
    <VoiceRecorder {...args} value={value} onValueChange={(next) => {
      args.onValueChange?.(next);
      setValue(next);
    }} onRecordRequest={(sessionId) => {
      args.onRecordRequest(sessionId);
      return new Promise<void>((_resolve, reject) => {
        settle.current = () => reject(new Error('Stale microphone failure'));
      });
    }} onStopRequest={(sessionId) => {
      args.onStopRequest(sessionId);
      return new Promise<{ takeId: string }>((resolve) => {
        settle.current = () => resolve({ takeId: 'obsolete-take' });
      });
    }} onSend={(takeId) => {
      args.onSend(takeId);
      return new Promise<void>((resolve) => { settle.current = resolve; });
    }} />
    <Button onClick={() => setValue({ state: 'recording', sessionId: 'external-session' })}>Replace session</Button>
    <Button onClick={() => settle.current()}>Settle previous operation</Button>
  </>;
}

const staleSessionPlay: NonNullable<Story['play']> = async ({ canvasElement, args, userEvent }) => {
  const canvas = within(canvasElement);
  const action = args.value?.state === 'review' ? 'Send voice note'
    : args.value?.state === 'recording' ? 'Stop recording' : 'Record voice note';
  await userEvent.click(canvas.getByRole('button', { name: action }));
  await userEvent.click(canvas.getByRole('button', { name: 'Replace session' }));
  const calls = args.onValueChange?.mock.calls.length ?? 0;
  await userEvent.click(canvas.getByRole('button', { name: 'Settle previous operation' }));
  await expect(args.onValueChange).toHaveBeenCalledTimes(calls);
  await expect(canvasElement.querySelector('[data-ui="voice-recorder"]')).toHaveAttribute('data-state', 'recording');
  await expect(canvas.queryByRole('alert')).not.toBeInTheDocument();
};

export const StaleRecordFailure: Story = {
  tags: ['!autodocs'],
  render: (args) => <ExternalSessionFixture {...args} />,
  play: staleSessionPlay,
};

export const StaleStopResult: Story = {
  tags: ['!autodocs'],
  args: { value: { state: 'recording', sessionId: 'original-session' } },
  render: (args) => <ExternalSessionFixture {...args} />,
  play: staleSessionPlay,
};

export const StaleSendResult: Story = {
  tags: ['!autodocs'],
  args: { value: { state: 'review', takeId: 'original-take' } },
  render: (args) => <ExternalSessionFixture {...args} />,
  play: staleSessionPlay,
};

function RootContractFixture(args: VoiceRecorderProps) {
  const [shown, setShown] = useState(true);
  return <StrictMode>
    {shown && <VoiceRecorder {...args} />}
    <Button onClick={() => setShown(false)}>Unmount recorder</Button>
  </StrictMode>;
}

export const RootContract: Story = {
  tags: ['!autodocs'],
  args: {
    component: ReplacementRoot,
    slots: { root: (props) => <section {...props} data-slot-test="preferred-root" /> },
    ref: fn(),
    className: 'consumer-root',
    style: { maxInlineSize: '600px', minInlineSize: '100px' },
    'aria-label': 'Consumer label',
    slotProps: { root: {
      ref: fn(),
      className: 'slot-root',
      style: { maxInlineSize: '500px' },
      'aria-label': 'Slot label',
      onKeyDown: fn(),
    } },
    onKeyDown: fn(),
  },
  render: (args) => <RootContractFixture {...args} />,
  play: async ({ canvasElement, args, userEvent }) => {
    const canvas = within(canvasElement);
    const root = canvas.getByRole('region', { name: 'Slot label' });
    await expect(root).toHaveAttribute('data-slot-test', 'preferred-root');
    await expect(root).toHaveClass('consumer-root', 'slot-root');
    await expect(root).toHaveStyle({ maxInlineSize: '500px', minInlineSize: '100px' });
    await expect(args.ref).toHaveBeenCalledWith(root);
    await expect(args.slotProps?.root?.ref).toHaveBeenCalledWith(root);
    await userEvent.tab();
    await userEvent.keyboard('{Escape}');
    await expect(args.slotProps?.root?.onKeyDown).toHaveBeenCalledTimes(1);
    await expect(args.onKeyDown).not.toHaveBeenCalled();
    await userEvent.click(canvas.getByRole('button', { name: 'Unmount recorder' }));
    await expect(args.ref).toHaveBeenLastCalledWith(null);
    await expect(args.slotProps?.root?.ref).toHaveBeenLastCalledWith(null);
  },
};

function installMediaSpies() {
  const unexpected = () => {
    throw new Error('VoiceRecorder must not access browser media APIs directly');
  };
  return {
    microphone: navigator.mediaDevices
      ? spyOn(navigator.mediaDevices, 'getUserMedia').mockImplementation(unexpected)
      : undefined,
    audio: window.AudioContext ? spyOn(window, 'AudioContext').mockImplementation(unexpected) : undefined,
  };
}

let mediaSpies: ReturnType<typeof installMediaSpies>;

export const MediaOwnership: Story = {
  beforeEach: () => {
    mediaSpies = installMediaSpies();
    return () => {
      mediaSpies.microphone?.mockRestore();
      mediaSpies.audio?.mockRestore();
    };
  },
  render: (args) => <InteractiveLifecycleFixture {...args} />,
  play: async ({ canvasElement, userEvent }) => {
    const canvas = within(canvasElement);
    const record = canvas.getByRole('button', { name: 'Record voice note' });
    await userEvent.click(record);

    const stop = await canvas.findByRole('button', { name: 'Stop recording' });
    await userEvent.click(stop);

    const send = await canvas.findByRole('button', { name: 'Send voice note' });
    await userEvent.click(send);

    if (mediaSpies.microphone) await expect(mediaSpies.microphone).toHaveBeenCalledTimes(0);
    if (mediaSpies.audio) await expect(mediaSpies.audio).toHaveBeenCalledTimes(0);
  },
};
