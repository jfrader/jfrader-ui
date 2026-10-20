import { StrictMode, useLayoutEffect, useRef, useState, type ComponentPropsWithRef } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, fireEvent, waitFor, within } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
// `styled` is the app-facing styling API; consumers import it from `@jfrader/ui`.
import { styled } from '../../index';
import { withLightTheme } from '../../testing/story-decorators';
import { Button } from '../button';
import { NowPlaying, type NowPlayingProps, type NowPlayingTrack } from './index';

function ReplacementRoot(props: ComponentPropsWithRef<'section'>) {
  return <section {...props} data-testid="replacement-root" />;
}
function SugarRoot(props: ComponentPropsWithRef<'section'>) {
  return <section {...props} data-testid="sugar-root" />;
}

/** Replace the player section while keeping its card and playback controls. */
export const RootReplacement: Story = {
  tags: ['!autodocs'],
  args: {
    component: SugarRoot,
    slots: { root: ReplacementRoot },
    ref: fn(),
    className: 'consumer-root',
    'aria-label': 'Player',
    slotProps: { root: { ref: fn(), className: 'slot-root', title: 'Music', 'data-ui': 'custom' } },
  },
  play: async ({ canvasElement, args }) => {
    const root = within(canvasElement).getByTestId('replacement-root');
    await expect(within(canvasElement).queryByTestId('sugar-root')).toBeNull();
    await expect(root.tagName).toBe('SECTION');
    await expect(root).toHaveClass('consumer-root', 'slot-root');
    await expect(root).toHaveAttribute('data-ui', 'now-playing custom');
    await expect(root).toHaveAttribute('title', 'Music');
    await expect(root).toHaveAccessibleName('Player');
    await expect(args.ref).toHaveBeenCalledWith(root);
    await expect(args.slotProps?.root?.ref).toHaveBeenCalledWith(root);
    await expect(within(root).getAllByText('Night Signal').length).toBeGreaterThan(0);
  },
};

export const RootComponent: Story = {
  tags: ['!autodocs'],
  args: { component: SugarRoot },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByTestId('sugar-root')).toHaveAttribute('data-ui', 'now-playing');
  },
};

const cover = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300"><rect width="300" height="300" fill="currentColor"/><circle cx="150" cy="150" r="100" fill="none" stroke="white" stroke-width="2"/><circle cx="150" cy="150" r="60" fill="none" stroke="white" stroke-width="2"/><circle cx="150" cy="150" r="12" fill="white"/></svg>')}`;
const tracks: readonly NowPlayingTrack[] = [
  { id: 'first', title: 'Night Signal', artist: 'Studio Session', duration: 180, artwork: cover },
  {
    id: 'second',
    title: 'Open Water',
    artist: 'Field Notes',
    duration: 240,
    artwork: cover,
    artworkAlt: 'Concentric grooves on a record',
  },
];
const Frame = styled.div({
  inlineSize: '26rem',
  maxInlineSize: '100%',
  display: 'grid',
  gap: vars.space[4],
  padding: vars.space[4],
  boxSizing: 'border-box',
});
const meta = {
  title: 'Media/NowPlaying',
  component: NowPlaying,
  tags: ['autodocs'],
  args: {
    tracks,
    locale: 'en-GB',
    seekStep: 5,
    onValueChange: fn(),
    onPlayingChange: fn(),
    onOpenChange: fn(),
    onPositionChange: fn(),
  },
  decorators: [
    (Story) => (
      <Frame>
        <Story />
      </Frame>
    ),
  ],
  parameters: {
    docs: {
      source: {
        code: '<NowPlaying tracks={tracks} value={index} playing={playing} position={time} onPlayingChange={requestPlayback} onPositionChange={seek} onValueChange={loadTrack} />',
      },
      description: {
        component:
          'Play, pause, seek and switch tracks through controls connected to your media player.',
      },
      usage: `### Playback
- The caller handles media loading, timeupdate, ended and play() permission failures. Set playing=true only after play() succeeds.
- Uncontrolled playing records intent; it never advances time. Volume control and media-key capture are not included.
- Expand/Collapse are disclosure buttons. Escape closes only the expanded subtree; accepted keyboard disclosure changes restore focus as needed.

### Seeking and artwork
- Slider arrows move seekStep seconds. Shift+arrows and PageUp/Down use seekLargeStep (30 seconds); Home/End reach the bounds. Horizontal seeking stays left-to-right in RTL.
- The default seekStep is the largest step of at most one second that divides the duration. A supplied step that does not divide it is rounded to the nearest one that does.
- Artwork fills a reserved square with object-fit:cover. Set artworkAlt when the image conveys information.
- Pull artwork down 70px or flick downward to request collapse. Collapse and Escape provide the same action.`,
    },
  },
} satisfies Meta<typeof NowPlaying>;
export default meta;
type Story = StoryObj<typeof NowPlaying>;
async function expectOnce(callback: unknown, value: unknown) {
  await expect(callback).toHaveBeenCalledTimes(1);
  await expect(callback).toHaveBeenNthCalledWith(1, value);
}
const orderedIndex = fn();
const orderedPosition = fn();

export const DefaultMiniPaused: Story = {
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    await expect(canvas.getByRole('region', { name: 'Now playing' })).not.toHaveAttribute(
      'aria-busy',
    );
    await expect(canvas.queryByRole('slider')).not.toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Expand' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    await userEvent.tab();
    const play = canvas.getByRole('button', { name: 'Play' });
    await expect(play.ownerDocument.activeElement).toBe(play);
    await expect(getComputedStyle(play).outlineStyle).not.toBe('none');
    await expect(Math.abs(parseFloat(getComputedStyle(play).outlineWidth) - 2)).toBeLessThan(1.1);
    await userEvent.keyboard('{Enter}');
    await expectOnce(args.onPlayingChange, true);
    await userEvent.keyboard(' ');
    await expect(args.onPlayingChange).toHaveBeenNthCalledWith(2, false);
    await expect(args.onPlayingChange).toHaveBeenCalledTimes(2);
    await expect(args.onPositionChange).not.toHaveBeenCalled();
    await expect(canvasElement.querySelector('audio')).not.toBeInTheDocument();
  },
};
export const ExpandGeometry: Story = {
  tags: ['!autodocs'],
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Expand' }));
    const collapse = await waitFor(() => canvas.getByRole('button', { name: 'Collapse' }));
    // The card grows by clipping its settled face; the control must never be scaled with it.
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
    await expect(collapse.getBoundingClientRect().height).toBeGreaterThan(30);
    await waitFor(() => expect(collapse.getBoundingClientRect().height).toBeGreaterThan(39));
  },
};

export const CollapseGeometry: Story = {
  tags: ['!autodocs'],
  play: async ({ canvas, userEvent }) => {
    const section = canvas.getByRole('region', { name: 'Now playing' });
    await userEvent.click(canvas.getByRole('button', { name: 'Expand' }));
    const collapse = await waitFor(() => canvas.getByRole('button', { name: 'Collapse' }));
    await waitFor(() => expect(collapse.getBoundingClientRect().height).toBeGreaterThan(39));
    await userEvent.click(collapse);
    const expand = canvas.getByRole('button', { name: 'Expand' });
    await waitFor(() => expect(expand).toBeVisible());
    // The face must settle on the visible mini's height. A stale measurement leaves the card
    // hundreds of px tall (or clips the wrapped action row).
    await waitFor(() => {
      const card = section.querySelector('[data-ui="card"]') as HTMLElement;
      const face = card.firstElementChild as HTMLElement;
      const mini = expand.parentElement as HTMLElement;
      const faceBox = face.getBoundingClientRect();
      const miniBox = mini.getBoundingClientRect();
      expect(Math.abs(faceBox.height - (miniBox.height + 8))).toBeLessThan(3);
      expect(faceBox.height).toBeLessThan(200);
      expect(face.scrollHeight - face.clientHeight).toBeLessThanOrEqual(1);
      const lowest = Math.max(
        ...canvas
          .getAllByRole('button')
          .filter((button) => button.getBoundingClientRect().width > 0)
          .map((button) => button.getBoundingClientRect().bottom),
      );
      expect(lowest).toBeLessThanOrEqual(faceBox.bottom - 4 + 1);
    });
  },
};
export const Expanded: Story = {
  tags: ['!autodocs'],
  args: { defaultOpen: true, defaultPosition: 45 },
  play: async ({ canvas }) => {
    const seek = canvas.getByRole('slider', { name: 'Seek' });
    await expect(seek).toHaveAttribute('aria-valuenow', '45');
    await expect(seek).toHaveAttribute('aria-valuemin', '0');
    await expect(seek).toHaveAttribute('aria-valuemax', '180');
    await expect(seek.getAttribute('aria-valuetext')).toContain('/');
    await expect(seek.getBoundingClientRect().height).toBeGreaterThanOrEqual(31);
    for (const button of canvas.getAllByRole('button'))
      await expect(button.getBoundingClientRect().height).toBeGreaterThanOrEqual(31);
  },
};
export const PersistentExpanded: Story = { tags: ['!autodocs'], args: { open: true } };
export const PersistentPlaying: Story = { tags: ['!autodocs'], args: { open: true, playing: true, position: 75 } };
export const PersistentError: Story = { tags: ['!autodocs'], args: { open: true, error: 'Playback could not start.' } };
export const PlayingControlled: Story = {
  tags: ['!autodocs'],
  args: { open: true, playing: false, position: 20 },
  render: (args) => {
    const [playing, setPlaying] = useState(args.playing);
    return (
      <NowPlaying
        {...args}
        playing={playing}
        onPlayingChange={(next) => {
          args.onPlayingChange?.(next);
          setPlaying(next);
        }}
      />
    );
  },
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Play' }));
    await expect(canvas.getByRole('button', { name: 'Pause' })).toBeInTheDocument();
    await expectOnce(args.onPlayingChange, true);
    await new Promise((resolve) => setTimeout(resolve, 1100));
    await expect(canvas.getByRole('slider')).toHaveAttribute('aria-valuenow', '20');
    await expect(args.onPositionChange).not.toHaveBeenCalled();
  },
};
export const KeyboardPlay: Story = {
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.tab();
    await userEvent.tab();
    await userEvent.tab();
    const expand = canvas.getByRole('button', { name: 'Expand' });
    await expect(expand.ownerDocument.activeElement).toBe(expand);
    await userEvent.keyboard('{Enter}');
    const collapse = canvas.getByRole('button', { name: 'Collapse' });
    await expect(collapse.ownerDocument.activeElement).toBe(collapse);
    await expect(getComputedStyle(collapse).outlineStyle).not.toBe('none');
    await expectOnce(args.onOpenChange, true);
    await userEvent.tab();
    const seek = canvas.getByRole('slider', { name: 'Seek' });
    await expect(seek.ownerDocument.activeElement).toBe(seek);
    await expect(getComputedStyle(seek).outlineStyle).not.toBe('none');
    const moves = [
      ['{ArrowRight}', 5],
      ['{ArrowLeft}', 0],
      ['{ArrowUp}', 5],
      ['{ArrowDown}', 0],
      ['{PageUp}', 30],
      ['{PageDown}', 0],
      ['{End}', 180],
      ['{Home}', 0],
    ] as const;
    for (const [key, seconds] of moves) {
      await userEvent.keyboard(key);
      await expect(seek).toHaveAttribute('aria-valuenow', String(seconds));
    }
    await userEvent.keyboard('{Home}{ArrowLeft}');
    await expect(args.onPositionChange).toHaveBeenCalledTimes(moves.length);
    for (let i = 0; i < moves.length; i++)
      await expect(args.onPositionChange).toHaveBeenNthCalledWith(i + 1, moves[i]![1]);
    await userEvent.keyboard('{Escape}');
    await expect(expand.ownerDocument.activeElement).toBe(expand);
    await expect(canvas.queryByRole('slider')).not.toBeInTheDocument();
    await expect(args.onOpenChange).toHaveBeenNthCalledWith(2, false);
    await userEvent.keyboard('{Escape}');
    await expect(args.onOpenChange).toHaveBeenCalledTimes(2);
    await userEvent.keyboard(' ');
    await expect(collapse.ownerDocument.activeElement).toBe(collapse);
    await userEvent.keyboard('{Enter}');
    await expect(expand.ownerDocument.activeElement).toBe(expand);
    await expect(args.onOpenChange).toHaveBeenCalledTimes(4);
  },
};
export const SeekDrag: Story = {
  tags: ['!autodocs'],
  args: { defaultOpen: true },
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    const control = canvasElement.querySelector<HTMLElement>('[data-ui="slider-control"]')!;
    const rect = control.getBoundingClientRect();
    const y = rect.top + rect.height / 2;
    await userEvent.pointer([
      {
        target: control,
        keys: '[MouseLeft>]',
        coords: { clientX: rect.left + rect.width / 2, clientY: y },
      },
      { target: control, coords: { clientX: rect.right, clientY: y } },
      { target: control, keys: '[/MouseLeft]', coords: { clientX: rect.right, clientY: y } },
    ]);
    await expect(canvas.getByRole('slider')).toHaveAttribute('aria-valuenow', '180');
    await expect(args.onPositionChange).toHaveBeenCalledTimes(2);
    await expect(args.onPositionChange).toHaveBeenNthCalledWith(1, 90);
    await expect(args.onPositionChange).toHaveBeenNthCalledWith(2, 180);
  },
};
export const ArtworkDragCollapse: Story = {
  tags: ['!autodocs'],
  args: { defaultOpen: true },
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    const artwork = canvasElement.querySelector<HTMLElement>('[data-ui="now-playing-artwork"]')!;
    await waitFor(
      async () => await expect(artwork.getBoundingClientRect().height).toBeGreaterThan(100),
    );
    const rect = artwork.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    await userEvent.tab();
    const pointer = (type: string, clientY: number) =>
      fireEvent(
        artwork,
        new PointerEvent(type, {
          bubbles: true,
          pointerId: 1,
          pointerType: 'mouse',
          isPrimary: true,
          button: 0,
          buttons: type === 'pointerup' ? 0 : 1,
          clientX: x,
          clientY,
        }),
      );
    pointer('pointerdown', y);
    pointer('pointermove', y + 80);
    await new Promise((resolve) => setTimeout(resolve, 160));
    pointer('pointermove', y + 140);
    await new Promise((resolve) => setTimeout(resolve, 160));
    pointer('pointercancel', y + 140);
    await new Promise((resolve) => setTimeout(resolve, 240));
    await expect(args.onOpenChange).not.toHaveBeenCalled();
    pointer('pointerdown', y);
    pointer('pointermove', y - 80);
    await new Promise((resolve) => setTimeout(resolve, 160));
    pointer('pointerup', y - 80);
    await expect(args.onOpenChange).not.toHaveBeenCalled();
    pointer('pointerdown', y);
    pointer('pointermove', y + 80);
    await new Promise((resolve) => setTimeout(resolve, 160));
    pointer('pointermove', y + 140);
    await new Promise((resolve) => setTimeout(resolve, 160));
    pointer('pointerup', y + 140);
    await waitFor(async () => await expectOnce(args.onOpenChange, false));
    await expect(canvas.getByRole('button', { name: 'Expand' })).toBeVisible();
  },
};
export const ExternalFocusedClosure: Story = {
  tags: ['!autodocs'],
  render: (args) => {
    const [open, setOpen] = useState(true);
    return (
      <>
        <Button onMouseDown={(event) => event.preventDefault()} onClick={() => setOpen(false)}>
          External close
        </Button>
        <NowPlaying {...args} open={open} />
      </>
    );
  },
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.tab();
    await userEvent.tab();
    await userEvent.tab();
    const seek = canvas.getByRole('slider');
    await expect(seek.ownerDocument.activeElement).toBe(seek);
    await userEvent.click(canvas.getByRole('button', { name: 'External close' }));
    const expand = canvas.getByRole('button', { name: 'Expand' });
    await expect(expand.ownerDocument.activeElement).toBe(expand);
    await expect(args.onOpenChange).not.toHaveBeenCalled();
  },
};
function BlurOnHide({ open }: { open: boolean }) {
  useLayoutEffect(() => {
    if (!open && document.activeElement instanceof HTMLElement) document.activeElement.blur();
  }, [open]);
  return null;
}
export const HiddenPanelBlur: Story = {
  render: (args) => {
    const [open, setOpen] = useState(false);
    return (
      <NowPlaying
        {...args}
        open={open}
        onOpenChange={(next) => {
          args.onOpenChange?.(next);
          setOpen(next);
        }}
        error={<BlurOnHide open={open} />}
      />
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          'Blurs the focused control before the panel change commits, matching browser focus fixup. Focus returns to Expand.',
      },
    },
  },
  play: async ({ canvas, userEvent, args }) => {
    const expand = canvas.getByRole('button', { name: 'Expand' });
    expand.focus();
    await userEvent.keyboard('{Enter}');
    await userEvent.tab();
    const seek = canvas.getByRole('slider');
    await expect(seek.ownerDocument.activeElement).toBe(seek);
    await userEvent.keyboard('{Escape}');
    await expect(args.onOpenChange).toHaveBeenNthCalledWith(2, false);
    await expect(expand.ownerDocument.activeElement).toBe(expand);
  },
};
export const BoundedPosition: Story = {
  tags: ['!autodocs'],
  args: { defaultOpen: true, position: 900 },
  play: async ({ canvas, args }) => {
    await expect(canvas.getByRole('slider')).toHaveAttribute('aria-valuenow', '180');
    await expect(args.onPositionChange).not.toHaveBeenCalled();
  },
};
export const InvalidDurations: Story = {
  tags: ['!autodocs'],
  render: (args) => (
    <>
      {[0, -1, NaN, Infinity].map((duration, index) => (
        <NowPlaying
          key={index}
          {...args}
          label={`Unavailable player ${index + 1}`}
          tracks={[{ ...tracks[0]!, duration }]}
          defaultOpen
        />
      ))}
    </>
  ),
  play: async ({ canvas }) => {
    for (const seek of canvas.getAllByRole('slider'))
      await expect(seek).toHaveAttribute('aria-disabled', 'true');
  },
};
export const QueueWrap: Story = {
  tags: ['!autodocs'],
  args: { defaultOpen: true, defaultValue: 1, defaultPosition: 0 },
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Next' }));
    await expectOnce(args.onValueChange, 0);
    await expect(canvas.getByText('Night Signal')).toBeVisible();
    await expect(args.onPositionChange).not.toHaveBeenCalled();
    await userEvent.click(canvas.getByRole('button', { name: 'Previous' }));
    await expect(args.onValueChange).toHaveBeenNthCalledWith(2, 1);
    await expect(args.onValueChange).toHaveBeenCalledTimes(2);
  },
};
export const PreviousRestart: Story = {
  tags: ['!autodocs'],
  args: { defaultOpen: true, defaultPosition: 10 },
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Previous' }));
    await expectOnce(args.onPositionChange, 0);
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await userEvent.click(canvas.getByRole('button', { name: 'Previous' }));
    await expectOnce(args.onValueChange, 1);
  },
};
export const PreviousAtThreshold: Story = {
  tags: ['!autodocs'],
  args: {
    defaultOpen: true,
    defaultPosition: 3,
    onValueChange: orderedIndex,
    onPositionChange: orderedPosition,
  },
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Previous' }));
    await expectOnce(args.onValueChange, 1);
    await expectOnce(args.onPositionChange, 0);
    await expect(orderedIndex.mock.invocationCallOrder[0]).toBeLessThan(
      orderedPosition.mock.invocationCallOrder[0]!,
    );
  },
};
export const SingleTrack: Story = {
  tags: ['!autodocs'],
  args: { tracks: tracks.slice(0, 1), defaultOpen: true, defaultPosition: 10 },
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Next' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Previous' }));
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await expectOnce(args.onPositionChange, 0);
  },
};
export const Empty: Story = {
  tags: ['!autodocs'],
  args: { tracks: [], defaultOpen: true },
  play: async ({ canvas, userEvent, args }) => {
    const play = canvas.getByRole('button', { name: 'Play' });
    await expect(play).toBeDisabled();
    await userEvent.click(play);
    await expect(args.onPlayingChange).not.toHaveBeenCalled();
    await expect(canvas.getByRole('slider')).toHaveAttribute('aria-disabled', 'true');
  },
};
export const InvalidSelection: Story = { tags: ['!autodocs'], args: { value: -1, defaultOpen: true } };
export const UnknownDuration: Story = {
  tags: ['!autodocs'],
  args: { tracks: [{ ...tracks[0]!, duration: null }], defaultOpen: true },
  play: async ({ canvas, userEvent, args }) => {
    await expect(canvas.getByRole('slider')).toHaveAttribute('aria-disabled', 'true');
    await expect(
      canvas.getAllByText('Duration unavailable').find((element) => element.tagName === 'OUTPUT'),
    ).toBeVisible();
    await userEvent.tab();
    await userEvent.tab();
    await userEvent.keyboard('{ArrowRight}');
    await expect(args.onPositionChange).not.toHaveBeenCalled();
  },
};
export const Busy: Story = {
  tags: ['!autodocs'],
  args: { busy: true, open: true },
  play: async ({ canvas, userEvent, args }) => {
    await expect(canvas.getByRole('progressbar', { name: 'Loading' })).toBeInTheDocument();
    const play = canvas.getByRole('button', { name: 'Play' });
    await expect(play).toHaveAttribute('aria-busy', 'true');
    await userEvent.click(play);
    await userEvent.click(canvas.getByRole('button', { name: 'Next' }));
    await expect(args.onPlayingChange).not.toHaveBeenCalled();
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await expect(canvas.getByRole('slider')).toHaveAttribute('aria-disabled', 'true');
  },
};
export const PlaybackError: Story = {
  tags: ['!autodocs'],
  args: { error: 'Playback could not start.', defaultOpen: true },
};
export const FailedArtwork: Story = {
  tags: ['!autodocs'],
  render: (args) => <NowPlaying {...args} slots={{ artwork: ReplacementArtwork }} />,
  args: {
    tracks: [{ ...tracks[0]!, artwork: 'data:image/png;base64,broken', artworkAlt: 'Album cover' }],
    defaultOpen: true,
  },
  play: async ({ canvas }) => {
    await waitFor(
      async () =>
        await expect(canvas.getByRole('img', { name: 'Album cover' }).tagName).toBe('SPAN'),
    );
    await expect(canvas.getByRole('img', { name: 'Album cover' })).not.toHaveAttribute('data-slot');
    await expect(canvas.getByText('Night Signal')).toBeVisible();
  },
};
export const Light: Story = {
  ...Expanded,
  tags: ['!autodocs'],
  globals: { theme: 'light' },
  decorators: [withLightTheme],
};
const NarrowFrame = styled.div({ inlineSize: '15rem', maxInlineSize: '100%' });
export const Narrow: Story = {
  tags: ['!autodocs'],
  args: { defaultOpen: true },
  decorators: [
    (Story) => (
      <NarrowFrame>
        <Story />
      </NarrowFrame>
    ),
  ],
  play: async ({ canvas }) => {
    const root = canvas.getByRole('region');
    const next = canvas.getByRole('button', { name: 'Next' });
    await expect(next).toBeVisible();
    await expect(next.getBoundingClientRect().right).toBeLessThanOrEqual(
      root.getBoundingClientRect().right + 1.1,
    );
  },
};
export const RTL: Story = {
  tags: ['!autodocs'],
  args: { defaultOpen: true, dir: 'rtl' },
  play: async ({ canvas, userEvent }) => {
    await expect(getComputedStyle(canvas.getByRole('region')).direction).toBe('rtl');
    await expect(getComputedStyle(canvas.getByRole('slider')).direction).toBe('ltr');
    await userEvent.tab();
    await userEvent.tab();
    await userEvent.keyboard('{ArrowRight}');
    await expect(canvas.getByRole('slider')).toHaveAttribute('aria-valuenow', '5');
  },
};
export const ReducedMotion: Story = {
  tags: ['!autodocs'],
  args: { defaultOpen: true, playing: true },
  parameters: {
    docs: {
      description: {
        story:
          'Enable reduced motion in a browser to check this story. The test does not emulate the preference.',
      },
    },
  },
};
export const ForcedColors: Story = {
  tags: ['!autodocs'],
  args: { defaultOpen: true, playing: true },
  parameters: {
    docs: {
      description: {
        story:
          'Enable forced colors in a browser to check this story. The test does not emulate forced colors.',
      },
    },
  },
};
export const ControlledRejected: Story = {
  tags: ['!autodocs'],
  args: { value: 0, position: 10, playing: false, open: true },
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Play' }));
    await expectOnce(args.onPlayingChange, true);
    await expect(canvas.getByRole('button', { name: 'Play' })).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'Next' }));
    await expectOnce(args.onValueChange, 1);
    await expectOnce(args.onPositionChange, 0);
    await expect(canvas.getByText('Night Signal')).toBeVisible();
    await userEvent.tab({ shift: true });
    await userEvent.tab({ shift: true });
    await userEvent.tab({ shift: true });
    const seek = canvas.getByRole('slider');
    await expect(seek.ownerDocument.activeElement).toBe(seek);
    await userEvent.keyboard('{ArrowRight}');
    await expect(args.onPositionChange).toHaveBeenNthCalledWith(2, 15);
    await expect(seek).toHaveAttribute('aria-valuenow', '10');
    await userEvent.keyboard('{Escape}');
    await expectOnce(args.onOpenChange, false);
    await expect(seek.ownerDocument.activeElement).toBe(seek);
    await expect(canvas.getByRole('button', { name: 'Collapse' })).toBeVisible();
  },
};
export const RejectedExpansion: Story = {
  args: { open: false },
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.tab();
    await userEvent.tab();
    await userEvent.tab();
    await userEvent.keyboard('{Enter}');
    const expand = canvas.getByRole('button', { name: 'Expand' });
    await expectOnce(args.onOpenChange, true);
    await expect(expand.ownerDocument.activeElement).toBe(expand);
    await expect(canvas.queryByRole('slider')).not.toBeInTheDocument();
  },
};
export const ExternalAcceptedUpdates: Story = {
  tags: ['!autodocs'],
  render: (args) => {
    const [state, setState] = useState({ value: 0, position: 10, open: true });
    return (
      <>
        <Button onClick={() => setState({ value: 1, position: 30, open: true })}>
          Media update
        </Button>
        <Button onClick={() => setState((previous) => ({ ...previous, open: false }))}>
          External close
        </Button>
        <NowPlaying {...args} {...state} />
      </>
    );
  },
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Media update' }));
    await expect(canvas.getByText('Open Water')).toBeVisible();
    await expect(canvas.getByRole('slider')).toHaveAttribute('aria-valuenow', '30');
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await expect(args.onPositionChange).not.toHaveBeenCalled();
    for (const output of canvasElement.querySelectorAll('output'))
      await expect(output).toHaveAttribute('aria-live', 'off');
    await userEvent.click(canvas.getByRole('button', { name: 'External close' }));
    await expect(canvas.queryByRole('slider')).not.toBeInTheDocument();
    await expect(args.onOpenChange).not.toHaveBeenCalled();
  },
};
export const ExternalAria: Story = {
  tags: ['!autodocs'],
  args: {
    defaultOpen: true,
    'aria-label': 'Consumer label',
    'aria-labelledby': 'consumer-label unresolved',
    'aria-describedby': 'consumer-description',
    error: 'Not available',
    slotProps: {
      seek: {
        'aria-label': 'Consumer seek',
        'aria-labelledby': 'seek-label missing-seek',
        'aria-describedby': 'consumer-description',
      },
      collapse: { 'aria-label': 'Consumer collapse', 'aria-describedby': 'consumer-description' },
    },
  },
  render: (args) => (
    <>
      <span id="consumer-label">Listening</span>
      <span id="consumer-description">Local queue</span>
      <span id="seek-label">Position</span>
      <NowPlaying {...args} />
    </>
  ),
  play: async ({ canvas, canvasElement }) => {
    const root = canvasElement.querySelector('[data-ui="now-playing"]')!;
    await expect(root).toHaveAttribute('aria-label', 'Consumer label');
    await expect(root).toHaveAttribute('aria-labelledby', 'consumer-label unresolved');
    await expect(root.getAttribute('aria-describedby')).toContain('consumer-description');
    await expect(root.getAttribute('aria-describedby')).toContain(canvas.getByRole('alert').id);
    const seek = canvas.getByRole('slider', { name: 'Position' });
    await expect(seek).toHaveAttribute('aria-label', 'Consumer seek');
    await expect(seek).toHaveAttribute('aria-labelledby', 'seek-label missing-seek');
    await expect(seek).toHaveAttribute('aria-describedby', 'consumer-description');
  },
};
export const FalsyError: Story = {
  render: (args) => (
    <>
      {[false, null, 0, ''].map((error, index) => (
        <div key={index} data-case={index}>
          <NowPlaying {...args} label={`Player ${index + 1}`} error={error} />
        </div>
      ))}
    </>
  ),
  play: async ({ canvasElement }) => {
    for (let index = 0; index < 4; index++) {
      const frame = canvasElement.querySelector(`[data-case="${index}"]`)! as HTMLElement;
      const alert = within(frame).queryByRole('alert');
      if (index === 2) await expect(alert).toHaveTextContent('0');
      else {
        await expect(alert).not.toBeInTheDocument();
        await expect(frame.querySelector('section')).not.toHaveAttribute('aria-describedby');
      }
    }
  },
};
export const LevelsStandalone: Story = {
  render: () => (
    <>
      <NowPlaying.Levels playing />
      <NowPlaying.Levels playing={false} />
    </>
  ),
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelectorAll('[data-ui="now-playing-levels"]')).toHaveLength(2);
    for (const levels of canvasElement.querySelectorAll('[data-ui="now-playing-levels"]'))
      await expect(levels).toHaveAttribute('aria-hidden', 'true');
    const levels = canvasElement.querySelectorAll<HTMLElement>('[data-ui="now-playing-levels"]');
    await waitFor(async () => await expect(levels[0]).toHaveAttribute('data-playing'));
    await expect(getComputedStyle(levels[1]!.firstElementChild!).animationPlayState).toBe('paused');
  },
};
export const WaveformBounds: Story = {
  tags: ['!autodocs'],
  args: { defaultOpen: true, waveform: [-1, 0, 0.5, 2, NaN, Infinity] },
  play: async ({ canvasElement, args }) => {
    const bars = canvasElement.querySelector('[data-ui="now-playing-waveform"]')!.children;
    for (const [index, height] of ['0%', '0%', '50%', '100%', '0%', '0%'].entries())
      await expect((bars[index] as HTMLElement).style.blockSize).toBe(height);
    await expect(args.onPositionChange).not.toHaveBeenCalled();
  },
};
function ReplacementWaveform(props: ComponentPropsWithRef<'div'>) {
  return <div {...props} data-slot="now-playing-waveform" />;
}

function ReplacementArtwork(props: ComponentPropsWithRef<'img'>) {
  return <img {...props} data-slot="now-playing-artwork" />;
}

export const ArtworkPlaceholderReplacement: Story = {
  render: (args) => (
    <NowPlaying {...args} tracks={[{ ...tracks[0]!, artwork: undefined, artworkAlt: 'Album cover' }]} slots={{ artwork: ReplacementArtwork }} />
  ),
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.getByRole('img', { name: 'Album cover' }).tagName).toBe('SPAN');
    await expect(canvasElement.querySelector('[data-slot="now-playing-artwork"]')).toBeNull();
  },
};

export const NativeCustomization: Story = {
  tags: ['!autodocs'],
  render: (args) => <NowPlaying {...args} slots={{ waveform: ReplacementWaveform, artwork: ReplacementArtwork }} />,
  args: {
    defaultOpen: true,
    ref: fn(),
    sx: { paddingInline: vars.space[8] },
    slotProps: { seek: { ref: fn() }, title: { css: { fontWeight: vars.fontWeight.semibold } } },
  },
  play: async ({ canvasElement, args, canvas }) => {
    const waveform = canvasElement.querySelector('[data-slot="now-playing-waveform"]');
    await expect(waveform).toBeInTheDocument();
    await expect(waveform).toHaveAttribute('data-ui', 'now-playing-waveform');
    await expect(waveform).toHaveAttribute('aria-hidden', 'true');
    await expect(getComputedStyle(waveform!).display).toBe('flex');
    await expect(canvasElement.querySelector('[data-ui="now-playing-waveform"]:not([data-slot])')).toBeNull();
    const artwork = canvasElement.querySelector('[data-slot="now-playing-artwork"]');
    await expect(artwork).toBeInTheDocument();
    await expect(artwork).toHaveAttribute('alt', '');
    await expect(artwork).toHaveAttribute('src', cover);
    await expect(getComputedStyle(artwork!).objectFit).toBe('cover');
    await expect(canvasElement.querySelector('[data-ui="now-playing-artwork"] img:not([data-slot])')).toBeNull();
    const root = canvasElement.querySelector('[data-ui="now-playing"]')!;
    const seekRoot = canvasElement.querySelector('[data-ui="slider"]')!;
    await expect(args.ref).toHaveBeenCalledWith(root);
    await expect(args.slotProps!.seek!.ref).toHaveBeenCalledWith(seekRoot);
    await expect(Math.abs(parseFloat(getComputedStyle(root).paddingInlineStart) - 32)).toBeLessThan(
      1.1,
    );
    await expect(getComputedStyle(canvas.getByText('Night Signal')).fontWeight).toBe('600');
  },
};
export const LongDuration: Story = {
  tags: ['!autodocs'],
  args: { tracks: [{ ...tracks[0]!, duration: 360000 }], defaultOpen: true, locale: 'ar-EG' },
  play: async ({ canvas }) => {
    for (const output of canvas.getByRole('region').querySelectorAll('output'))
      await expect(output.getBoundingClientRect().width).toBeLessThanOrEqual(
        canvas.getByRole('region').getBoundingClientRect().width + 1.1,
      );
  },
};
export const FractionalDuration: Story = {
  tags: ['!autodocs'],
  args: {
    tracks: [{ ...tracks[0]!, duration: 180.5 }],
    seekStep: 0.5,
    defaultOpen: true,
    position: 180.5,
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('slider')).toHaveAttribute('aria-valuemax', '180.5');
    await expect(canvas.getByRole('slider')).toHaveAttribute('aria-valuenow', '180.5');
  },
};
export const AutomaticFractionalStep: Story = {
  tags: ['!autodocs'],
  args: { tracks: [{ ...tracks[0]!, duration: 180.5 }], seekStep: undefined, defaultOpen: true },
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.tab();
    await userEvent.tab();
    await userEvent.keyboard('{End}');
    await expect(canvas.getByRole('slider')).toHaveAttribute('aria-valuenow', '180.5');
    await expectOnce(args.onPositionChange, 180.5);
  },
};
export const MisalignedSeekStep: Story = {
  tags: ['!autodocs'],
  args: { seekStep: 7, defaultOpen: true },
  play: async ({ canvas, userEvent, args }) => {
    const seek = canvas.getByRole('slider');
    await userEvent.tab();
    await userEvent.tab();
    await expect(seek.ownerDocument.activeElement).toBe(seek);
    await userEvent.keyboard('{ArrowRight}');
    await expectOnce(args.onPositionChange, expect.closeTo(180 / 26, 10));
    await userEvent.keyboard('{End}');
    await expect(seek).toHaveAttribute('aria-valuenow', '180');
    await expect(args.onPositionChange).toHaveBeenNthCalledWith(2, 180);
  },
};
const rootCleanup = fn();
const seekCleanup = fn();
export const RefCleanup: Story = {
  tags: ['!autodocs'],
  args: {
    defaultOpen: true,
    ref: fn(() => rootCleanup),
    slotProps: { seek: { ref: fn(() => seekCleanup) } },
  },
  render: (args) => {
    const [mounted, setMounted] = useState(true);
    return (
      <>
        <Button onClick={() => setMounted(false)}>Unmount player</Button>
        <StrictMode>{mounted && <NowPlaying {...args} />}</StrictMode>
      </>
    );
  },
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    await expect(args.ref).toHaveBeenCalledWith(
      canvasElement.querySelector('[data-ui="now-playing"]'),
    );
    await expect(args.slotProps!.seek!.ref).toHaveBeenCalledWith(
      canvasElement.querySelector('[data-ui="slider"]'),
    );
    const rootCount = rootCleanup.mock.calls.length;
    const seekCount = seekCleanup.mock.calls.length;
    await userEvent.click(canvas.getByRole('button', { name: 'Unmount player' }));
    await expect(rootCleanup).toHaveBeenCalledTimes(rootCount + 1);
    await expect(seekCleanup).toHaveBeenCalledTimes(seekCount + 1);
  },
};

function localAudioFixture() {
  const sampleCount = 8000;
  const buffer = new ArrayBuffer(44 + sampleCount);
  const view = new DataView(buffer);
  const text = (offset: number, value: string) =>
    [...value].forEach((letter, i) => view.setUint8(offset + i, letter.charCodeAt(0)));
  text(0, 'RIFF');
  view.setUint32(4, 36 + sampleCount, true);
  text(8, 'WAVE');
  text(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleCount, true);
  view.setUint32(28, sampleCount, true);
  view.setUint16(32, 1, true);
  view.setUint16(34, 8, true);
  text(36, 'data');
  view.setUint32(40, sampleCount, true);
  new Uint8Array(buffer, 44).fill(128);
  return `data:audio/wav;base64,${btoa(String.fromCharCode(...new Uint8Array(buffer)))}`;
}
const audioFixture = localAudioFixture();
function MediaAdapter(args: NowPlayingProps) {
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [error, setError] = useState<string | undefined>();
  return (
    <>
      <audio
        ref={audio}
        src={audioFixture}
        preload="metadata"
        onTimeUpdate={() => setPosition(audio.current?.currentTime ?? 0)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
      />
      <NowPlaying
        {...args}
        tracks={[{ ...tracks[0]!, duration: 1 }]}
        seekStep={0.1}
        playing={playing}
        position={position}
        error={error}
        onPlayingChange={async (next) => {
          if (!audio.current) return;
          if (!next) {
            audio.current.pause();
            return;
          }
          try {
            await audio.current.play();
            setPlaying(true);
            setError(undefined);
          } catch {
            setPlaying(false);
            setError('Playback could not start.');
          }
        }}
        onPositionChange={(next) => {
          if (audio.current) {
            audio.current.currentTime = next;
            setPosition(next);
          }
        }}
      />
    </>
  );
}
export const RealMediaAdapterExample: Story = {
  tags: ['!autodocs'],
  args: { defaultOpen: true },
  render: (args) => <MediaAdapter {...args} />,
  parameters: {
    docs: {
      description: {
        story:
          'Uses a one-second local WAV without sound. Play starts playback; the media element handles time updates, seek acceptance, ended, pause and play() rejection.',
      },
    },
  },
  play: async ({ canvasElement, canvas }) => {
    const audio = canvasElement.querySelector('audio')!;
    await expect(audio.paused).toBe(true);
    await expect(audio.autoplay).toBe(false);
    await expect(canvas.getByRole('button', { name: 'Play' })).toBeVisible();
  },
};
