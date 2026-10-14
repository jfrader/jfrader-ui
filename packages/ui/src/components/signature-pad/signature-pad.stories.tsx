import { act, createRef, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, spyOn, within, waitFor } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { css } from '../../styling/css';
import { withLightTheme } from '../../testing/story-decorators';
import { Button } from '../button';
import { Dialog } from '../dialog';
import { TextField } from '../text-field';
import {
  SignaturePad,
  SignatureExportError,
  signatureToPng,
  signatureToSvg,
  type SignatureStroke,
  type SignaturePadMessages,
  type SignaturePadHandle,
} from './index';

const messages: SignaturePadMessages = {
  ink: 'Ink color',
  nib: 'Pen width',
  colors: { black: 'Black', blue: 'Blue', violet: 'Violet' },
  widths: { fine: 'Fine', medium: 'Medium', bold: 'Bold' },
  actions: {
    undo: 'Undo',
    redo: 'Redo',
    clear: 'Clear',
    replay: 'Replay',
    stop: 'Stop replay',
    png: 'Download PNG',
    svg: 'Download SVG',
  },
  empty: 'Empty drawing',
  signed: 'Signature drawing',
  roleDescription: 'Signature pad',
  fallback: 'Draw with a pointer, or enter your name in the alternative field.',
  shortcuts:
    'Control or Command Z to undo, Shift Z or Y to redo. Delete to clear. Escape to stop replay or cancel a stroke.',
  required: 'Signature required',
  added: 'Stroke added',
  undone: 'Stroke undone',
  redone: 'Stroke restored',
  cleared: 'Signature cleared',
  reset: 'Signature reset',
  replayComplete: 'Replay complete',
  exported: 'Signature exported',
  exportFailed: 'Export failed',
};
const seeded: SignatureStroke[] = [
  {
    id: 'seed',
    color: 'black',
    width: 'medium',
    startTime: 0,
    points: [
      { x: 100, y: 180, pressure: null, time: 0 },
      { x: 170, y: 65, pressure: null, time: 40 },
      { x: 145, y: 205, pressure: null, time: 80 },
      { x: 230, y: 155, pressure: null, time: 120 },
      { x: 290, y: 170, pressure: null, time: 160 },
      { x: 360, y: 130, pressure: null, time: 200 },
      { x: 445, y: 160, pressure: null, time: 240 },
    ],
  },
];
const frameStyle = css({
  inlineSize: 'min(100%, 42rem)',
  display: 'grid',
  gap: vars.space[4],
});
const narrowStyle = css({ inlineSize: 'min(100%, 18rem)' });
const meta = {
  title: 'Inputs/SignaturePad',
  component: SignaturePad,
  tags: ['autodocs'],
  args: {
    label: 'Signature',
    messages,
    hint: 'Sign here',
    onValueChange: fn(),
    onColorChange: fn(),
    onWidthChange: fn(),
  },
  decorators: [
    (Story) => (
      <div css={frameStyle}>
        <Story />
      </div>
    ),
  ],
  parameters: {
    docs: {
      description: {
        component:
          'Draw a signature with a pointer, undo strokes and export the drawing as PNG or SVG.',
      },
      usage: `### Input and keyboard
- Forms must offer a typed-name or upload alternative. A drawing does not verify identity or establish legal consent.
- Samples use normalized 600×260 coordinates, midpoint-quadratic segments and round caps. Pressure changes width; speed does not taper strokes. Cancelled gestures are discarded.
- On the canvas: Mod+Z undoes; Shift+Mod+Z or Mod+Y redoes; Delete/Backspace clears; Escape cancels or stops.
- Native radios and buttons also work with the keyboard. Form reset requests the initial strokes.

### Exports and checks
- PNG and SVG have transparent backgrounds, optional cropping and fixed print ink. Guides and signer text are excluded.
- ref reaches the canvas; apiRef exposes actions and exports.
- Forced colors, reduced motion, pen hardware and screen-reader behavior need separate manual checks.`,
      source: {
        code: '<SignaturePad label="Signature" messages={messages} value={strokes} onValueChange={setStrokes} apiRef={signatureApi} />',
      },
    },
  },
} satisfies Meta<typeof SignaturePad>;
export default meta;
type Story = StoryObj<typeof meta>;

function pad(element: HTMLElement) {
  return within(element).getByRole('img') as HTMLCanvasElement;
}
async function assertInkContrast(canvas: HTMLCanvasElement) {
  const probe = canvas.ownerDocument.createElement('canvas');
  probe.width = probe.height = 1;
  const context = probe.getContext('2d')!;
  const styles = getComputedStyle(canvas);
  function luminance(color: string) {
    context.clearRect(0, 0, 1, 1);
    context.fillStyle = color;
    context.fillRect(0, 0, 1, 1);
    const channels = Array.from(context.getImageData(0, 0, 1, 1).data)
      .slice(0, 3)
      .map((channel) => {
        const value = channel / 255;
        return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
      });
    return channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722;
  }
  const contrast = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  const surface = luminance(styles.backgroundColor);
  for (const token of ['text', 'info', 'accent']) {
    await expect(
      contrast(surface, luminance(styles.getPropertyValue(`--ui-color-${token}`))),
    ).toBeGreaterThanOrEqual(3);
  }
  const PAPER_LUMINANCE = 1;
  for (const token of ['black', 'blue', 'violet']) {
    await expect(
      contrast(PAPER_LUMINANCE, luminance(styles.getPropertyValue(`--ui-color-signature-ink-${token}`))),
    ).toBeGreaterThanOrEqual(3);
  }
}
async function gesture(
  canvas: HTMLCanvasElement,
  events: {
    type: string;
    x?: number;
    y?: number;
    pointerId?: number;
    isPrimary?: boolean;
    pointerType?: string;
    pressure?: number;
  }[],
) {
  const original = {
    set: canvas.setPointerCapture,
    has: canvas.hasPointerCapture,
    release: canvas.releasePointerCapture,
  };
  const captured = new Set<number>();
  const setCapture = fn((id: number) => {
    captured.add(id);
  });
  canvas.setPointerCapture = setCapture;
  canvas.hasPointerCapture = (id) => captured.has(id);
  canvas.releasePointerCapture = (id) => {
    captured.delete(id);
  };
  try {
    for (const { type, x = 120, y = 120, ...properties } of events) {
      const rect = canvas.getBoundingClientRect();
      await act(async () => {
        canvas.dispatchEvent(
          new PointerEvent(type, {
            bubbles: true,
            cancelable: true,
            pointerId: 1,
            isPrimary: true,
            pointerType: 'mouse',
            button: 0,
            clientX: rect.left + canvas.clientLeft + (x / 600) * canvas.clientWidth,
            clientY: rect.top + canvas.clientTop + (y / 260) * canvas.clientHeight,
            ...properties,
          }),
        );
      });
    }
    return setCapture;
  } finally {
    canvas.setPointerCapture = original.set;
    canvas.hasPointerCapture = original.has;
    canvas.releasePointerCapture = original.release;
  }
}
const strokeEvents = [
  { type: 'pointerdown', x: 100, y: 100 },
  { type: 'pointermove', x: 150, y: 120 },
  { type: 'pointerup', x: 200, y: 150 },
];

export const Default: Story = {
  render: (args) => (
    <>
      <SignaturePad {...args} />
      <TextField label="Type your name instead" />
    </>
  ),
  play: async ({ canvasElement, args, userEvent }) => {
    const canvas = pad(canvasElement);
    const scope = within(canvasElement);
    await expect(getComputedStyle(canvas).touchAction).toBe('none');
    await expect(args.onValueChange).toHaveBeenCalledTimes(0);
    const capture = await gesture(canvas, strokeEvents);
    await expect(capture).toHaveBeenCalledTimes(1);
    await expect(capture).toHaveBeenCalledWith(1);
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    const value = (args.onValueChange as ReturnType<typeof fn>).mock.calls[0]![0] as SignatureStroke[];
    await expect(value).toHaveLength(1);
    await expect(value[0]!.points).toHaveLength(3);
    await expect(value[0]!.points.at(-1)!.x).toBeCloseTo(200, 1);
    await expect(value[0]!.points.at(-1)!.y).toBeCloseTo(150, 1);
    await expect(scope.getByRole('status')).toHaveTextContent('Stroke added');
    await userEvent.click(scope.getByRole('button', { name: 'Undo' }));
    await expect(args.onValueChange).toHaveBeenNthCalledWith(2, []);
    await userEvent.click(scope.getByRole('button', { name: 'Redo' }));
    await expect(args.onValueChange).toHaveBeenNthCalledWith(3, value);
    await userEvent.click(scope.getByRole('button', { name: 'Clear' }));
    await expect(args.onValueChange).toHaveBeenNthCalledWith(4, []);
    await expect(scope.getByRole('button', { name: 'Clear' })).toBeDisabled();
  },
};
export const Signed: Story = {
  args: { defaultValue: seeded },
  play: async ({ canvasElement }) => {
    await assertInkContrast(pad(canvasElement));
  },
};
export const SeededSignature: Story = { ...Signed };
export const Signer: Story = { args: { defaultValue: seeded, signer: 'Ada' } };
export const EachInk: Story = {
  render: (args) => (
    <>
      {(['black', 'blue', 'violet'] as const).map((color) => (
        <SignaturePad
          {...args}
          key={color}
          label={messages.colors[color]}
          defaultValue={seeded.map((s) => ({ ...s, color }))}
          defaultColor={color}
        />
      ))}
    </>
  ),
};
export const EachNib: Story = {
  render: (args) => (
    <>
      {(['fine', 'medium', 'bold'] as const).map((width) => (
        <SignaturePad
          {...args}
          key={width}
          label={messages.widths[width]}
          defaultValue={seeded.map((s) => ({ ...s, width }))}
          defaultWidth={width}
        />
      ))}
    </>
  ),
};
export const Narrow: Story = {
  args: { signer: 'Alexandra with a long surname' },
  decorators: [
    (Story) => (
      <div css={narrowStyle}>
        <Story />
      </div>
    ),
  ],
};
export const TapDot: Story = {
  play: async ({ canvasElement, args }) => {
    await gesture(pad(canvasElement), [{ type: 'pointerdown' }, { type: 'pointerup' }]);
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    const value = (args.onValueChange as ReturnType<typeof fn>).mock.calls[0]![0] as SignatureStroke[];
    await expect(value[0]!.points).toHaveLength(1);
    await expect(signatureToSvg(value)).toContain('<circle');
  },
};
export const PenPressure: Story = {
  play: async ({ canvasElement, args }) => {
    await gesture(
      pad(canvasElement),
      strokeEvents.map((e, i) => ({
        ...e,
        pointerType: 'pen',
        pressure: (i + 1) / 3,
      })),
    );
    const value = (args.onValueChange as ReturnType<typeof fn>).mock.calls[0]![0] as SignatureStroke[];
    await expect(value[0]!.points[0]!.pressure).toBeCloseTo(1 / 3);
    await expect(value[0]!.points.at(-1)!.pressure).toBe(1);
  },
};
export const NoPressure: Story = {
  play: async ({ canvasElement, args }) => {
    await gesture(pad(canvasElement), strokeEvents);
    const value = (args.onValueChange as ReturnType<typeof fn>).mock.calls[0]![0] as SignatureStroke[];
    await expect(value[0]!.points.every((p) => p.pressure === null)).toBe(true);
  },
};
export const CancelledGestures: Story = {
  args: { defaultValue: seeded },
  play: async ({ canvasElement, args }) => {
    const canvas = pad(canvasElement);
    const before = canvas.toDataURL();
    await gesture(canvas, [
      { type: 'pointerdown', isPrimary: false },
      { type: 'pointerup', isPrimary: false },
    ]);
    await gesture(canvas, [
      { type: 'pointerdown' },
      { type: 'pointermove', pointerId: 2 },
      { type: 'pointerup', pointerId: 2 },
      { type: 'pointercancel' },
    ]);
    await gesture(canvas, [{ type: 'pointerdown' }, { type: 'lostpointercapture' }]);
    await expect(args.onValueChange).toHaveBeenCalledTimes(0);
    await expect(canvas.toDataURL()).toBe(before);
    await gesture(canvas, strokeEvents);
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
  },
};
export const Controlled: Story = {
  render: function ControlledDemo(args) {
    const [value, setValue] = useState(seeded);
    return (
      <SignaturePad
        {...args}
        value={value}
        onValueChange={(next) => {
          args.onValueChange?.(next);
          setValue(next);
        }}
      />
    );
  },
  play: async ({ canvasElement, args, userEvent }) => {
    const scope = within(canvasElement);
    await userEvent.click(scope.getByRole('button', { name: 'Clear' }));
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenCalledWith([]);
    await userEvent.click(scope.getByRole('button', { name: 'Undo' }));
    await expect(args.onValueChange).toHaveBeenNthCalledWith(2, seeded);
  },
};
export const ControlledRejects: Story = {
  args: { value: seeded, color: 'black', width: 'medium' },
  play: async ({ canvasElement, args, userEvent }) => {
    const scope = within(canvasElement);
    const canvas = pad(canvasElement);
    const before = canvas.toDataURL();
    await gesture(canvas, strokeEvents);
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(canvas.toDataURL()).toBe(before);
    await expect(scope.getByRole('button', { name: 'Undo' })).toBeDisabled();
    await userEvent.click(scope.getByRole('button', { name: 'Clear' }));
    await expect(args.onValueChange).toHaveBeenNthCalledWith(2, []);
    await expect(canvas.toDataURL()).toBe(before);
    await expect(scope.getByRole('status')).toBeEmptyDOMElement();
    await userEvent.click(scope.getByRole('radio', { name: 'Blue' }));
    await expect(args.onColorChange).toHaveBeenCalledTimes(1);
    await expect(args.onColorChange).toHaveBeenCalledWith('blue');
    await expect(scope.getByRole('radio', { name: 'Black' })).toBeChecked();
    await userEvent.click(scope.getByRole('radio', { name: 'Bold' }));
    await expect(args.onWidthChange).toHaveBeenCalledTimes(1);
    await expect(args.onWidthChange).toHaveBeenCalledWith('bold');
    await expect(scope.getByRole('radio', { name: 'Medium' })).toBeChecked();
  },
};
export const RejectedHistory: Story = {
  render: function RejectedHistoryDemo(args) {
    const [value, setValue] = useState<SignatureStroke[]>([]);
    const [accept, setAccept] = useState(true);
    return (
      <>
        <Button onClick={() => setAccept(!accept)}>{accept ? 'Reject requests' : 'Accept requests'}</Button>
        <SignaturePad
          {...args}
          value={value}
          onValueChange={(next) => {
            args.onValueChange?.(next);
            if (accept) setValue(next);
          }}
        />
      </>
    );
  },
  play: async ({ canvasElement, args, userEvent }) => {
    const scope = within(canvasElement);
    const canvas = pad(canvasElement);
    await gesture(canvas, strokeEvents);
    const signed = canvas.toDataURL();
    await userEvent.click(scope.getByRole('button', { name: 'Reject requests' }));
    await userEvent.click(scope.getByRole('button', { name: 'Undo' }));
    await expect(canvas.toDataURL()).toBe(signed);
    await expect(scope.getByRole('button', { name: 'Undo' })).toBeEnabled();
    await expect(scope.getByRole('button', { name: 'Redo' })).toBeDisabled();
    await userEvent.click(scope.getByRole('button', { name: 'Accept requests' }));
    await userEvent.click(scope.getByRole('button', { name: 'Undo' }));
    const empty = canvas.toDataURL();
    await userEvent.click(scope.getByRole('button', { name: 'Reject requests' }));
    await userEvent.click(scope.getByRole('button', { name: 'Redo' }));
    await expect(canvas.toDataURL()).toBe(empty);
    await expect(scope.getByRole('button', { name: 'Redo' })).toBeEnabled();
    await expect(args.onValueChange).toHaveBeenCalledTimes(4);
  },
};
export const ReadOnly: Story = {
  args: { defaultValue: seeded, readOnly: true, download: true },
  play: async ({ canvasElement, args }) => {
    await gesture(pad(canvasElement), strokeEvents);
    await expect(args.onValueChange).toHaveBeenCalledTimes(0);
    await expect(within(canvasElement).getByRole('button', { name: 'Clear' })).toBeDisabled();
    await expect(within(canvasElement).getByRole('button', { name: 'Download PNG' })).toBeEnabled();
    await expect(getComputedStyle(pad(canvasElement)).touchAction).toBe('auto');
  },
};
export const Disabled: Story = {
  args: { defaultValue: seeded, disabled: true },
  play: async ({ canvasElement, args }) => {
    await gesture(pad(canvasElement), strokeEvents);
    await expect(args.onValueChange).toHaveBeenCalledTimes(0);
    await expect(pad(canvasElement)).toHaveAttribute('aria-disabled', 'true');
    await expect(getComputedStyle(pad(canvasElement)).touchAction).toBe('auto');
  },
};
export const Required: Story = {
  args: { required: true },
  play: async ({ canvasElement }) => {
    const canvas = pad(canvasElement);
    const ids = canvas.getAttribute('aria-describedby')!.split(' ');
    await expect(
      ids.some((id) => canvas.ownerDocument.getElementById(id)?.textContent === 'Signature required'),
    ).toBe(true);
  },
};
export const Error: Story = {
  args: {
    error: 'Enter your name or draw a signature.',
    description: 'Choose either method.',
  },
  play: async ({ canvasElement }) => {
    await expect(pad(canvasElement)).toHaveAttribute('aria-invalid', 'true');
  },
};
export const HistoryBoundary: Story = {
  args: { historyLimit: 1 },
  play: async ({ canvasElement, args, userEvent }) => {
    const scope = within(canvasElement);
    await gesture(pad(canvasElement), strokeEvents);
    await gesture(pad(canvasElement), strokeEvents);
    await userEvent.click(scope.getByRole('button', { name: 'Undo' }));
    await expect(args.onValueChange).toHaveBeenCalledTimes(3);
    await expect(scope.getByRole('button', { name: 'Undo' })).toBeDisabled();
    await userEvent.click(scope.getByRole('button', { name: 'Redo' }));
    await expect(args.onValueChange).toHaveBeenCalledTimes(4);
    await expect(scope.getByRole('button', { name: 'Redo' })).toBeDisabled();
  },
};
export const RepeatedAnnouncements: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = pad(canvasElement);
    const status = within(canvasElement).getByRole('status');
    await gesture(canvas, strokeEvents);
    const first = status.firstChild;
    await gesture(canvas, strokeEvents);
    await expect(status.firstChild).not.toBe(first);
    await expect(status).toHaveTextContent('Stroke added');
    await expect(args.onValueChange).toHaveBeenCalledTimes(2);
    const calls = (args.onValueChange as ReturnType<typeof fn>).mock.calls;
    await expect(calls[1]![0]).toHaveLength(2);
    await expect(calls[1]![0][0]).toEqual(calls[0]![0][0]);
  },
};
export const Keyboard: Story = {
  play: async ({ canvasElement, args, userEvent }) => {
    const scope = within(canvasElement);
    const canvas = pad(canvasElement);
    await userEvent.tab();
    await expect(canvas.ownerDocument.activeElement).toBe(canvas);
    const outline = getComputedStyle(canvas);
    await expect(outline.outlineStyle).not.toBe('none');
    await expect(parseFloat(outline.outlineWidth)).toBeGreaterThan(0);
    await userEvent.keyboard('{Control>}z{/Control}');
    await userEvent.keyboard('{Delete}');
    await expect(args.onValueChange).toHaveBeenCalledTimes(0);
    await gesture(canvas, strokeEvents);
    await userEvent.keyboard('{Control>}z{/Control}');
    await expect(args.onValueChange).toHaveBeenNthCalledWith(2, []);
    await userEvent.keyboard('{Control>}{Shift>}z{/Shift}{/Control}');
    await expect(args.onValueChange).toHaveBeenCalledTimes(3);
    await userEvent.keyboard('{Control>}z{/Control}');
    await userEvent.keyboard('{Control>}y{/Control}');
    await expect(args.onValueChange).toHaveBeenCalledTimes(5);
    await userEvent.keyboard('{Backspace}');
    await expect(args.onValueChange).toHaveBeenNthCalledWith(6, []);
    await userEvent.tab();
    await expect(canvas.ownerDocument.activeElement).toBe(scope.getByRole('radio', { name: 'Black' }));
    await userEvent.keyboard('{ArrowLeft}');
    await expect(scope.getByRole('radio', { name: 'Violet' })).toBeChecked();
    await userEvent.keyboard('{ArrowRight}');
    await expect(scope.getByRole('radio', { name: 'Black' })).toBeChecked();
    await userEvent.keyboard('{End}');
    await expect(scope.getByRole('radio', { name: 'Violet' })).toBeChecked();
    await userEvent.keyboard('{Home}');
    await expect(scope.getByRole('radio', { name: 'Black' })).toBeChecked();
    await userEvent.tab();
    await expect(canvas.ownerDocument.activeElement).toBe(scope.getByRole('radio', { name: 'Medium' }));
    await userEvent.tab({ shift: true });
    await expect(canvas.ownerDocument.activeElement).toBe(scope.getByRole('radio', { name: 'Black' }));
    await userEvent.tab({ shift: true });
    await expect(canvas.ownerDocument.activeElement).toBe(canvas);
    await gesture(canvas, strokeEvents);
    await userEvent.tab();
    await userEvent.tab();
    await userEvent.tab();
    const undo = scope.getByRole('button', { name: 'Undo' });
    await expect(canvas.ownerDocument.activeElement).toBe(undo);
    await expect(getComputedStyle(undo).outlineStyle).not.toBe('none');
    await expect(undo.getBoundingClientRect().height).toBeGreaterThanOrEqual(31.5);
    await userEvent.keyboard('{Enter}');
    await expect(args.onValueChange).toHaveBeenCalledTimes(8);
    await userEvent.tab();
    await expect(canvas.ownerDocument.activeElement).toBe(scope.getByRole('button', { name: 'Redo' }));
    await userEvent.keyboard(' ');
    await expect(args.onValueChange).toHaveBeenCalledTimes(9);
  },
};
export const Replay: Story = {
  args: { defaultValue: seeded },
  play: async ({ canvasElement, args, userEvent }) => {
    const scope = within(canvasElement);
    const canvas = pad(canvasElement);
    await userEvent.click(scope.getByRole('button', { name: 'Replay' }));
    await waitFor(async () => {
      await expect(scope.getByRole('status')).toHaveTextContent('Replay complete');
    });
    await expect(args.onValueChange).toHaveBeenCalledTimes(0);
    await userEvent.click(scope.getByRole('button', { name: 'Replay' }));
    await act(async () => canvas.focus());
    await userEvent.keyboard('{Escape}');
    await expect(scope.getByRole('button', { name: 'Replay' })).toBeEnabled();
  },
};
const replayApi = createRef<SignaturePadHandle>();
export const ReplayIgnoresObservers: Story = {
  args: { defaultValue: seeded, apiRef: replayApi },
  parameters: {
    docs: {
      description: {
        story:
          'Resize the pad or change its styles during replay, then press Escape to cancel. This fixture advances frames manually and checks pixels after resize and style observers run; check normal browser replay separately.',
      },
    },
  },
  play: async ({ canvasElement, userEvent }) => {
    const canvas = pad(canvasElement);
    const view = canvas.ownerDocument.defaultView!;
    const root = canvas.closest<HTMLElement>('[data-ui="signature-pad"]')!;
    const fullArtifact = canvas.toDataURL();
    const requestFrame = view.requestAnimationFrame.bind(view);
    const cancelFrame = view.cancelAnimationFrame.bind(view);
    const owned: FrameRequestCallback[] = [];
    const cancelled: number[] = [];
    let attributing = false;
    const request = spyOn(view, 'requestAnimationFrame').mockImplementation((callback) => {
      if (!attributing) return requestFrame(callback);
      owned.push(callback);
      return -owned.length;
    });
    const cancel = spyOn(view, 'cancelAnimationFrame').mockImplementation((id) => {
      if (id < 0) cancelled.push(id);
      else cancelFrame(id);
    });
    const attribute = (run: () => void) => {
      attributing = true;
      try {
        run();
      } finally {
        attributing = false;
      }
    };
    const settled = (observe: (done: () => void) => () => void) =>
      new Promise<void>((resolve) => {
        const stop = observe(() => {
          stop();
          resolve();
        });
      });
    try {
      let replayStart = 0;
      await act(async () =>
        attribute(() => {
          replayStart = view.performance.now();
          replayApi.current!.replay();
        }),
      );
      // Count only frames requested synchronously by replay() or a replay frame;
      // host-page frames run in the browser without being counted.
      await expect(owned).toHaveLength(1);
      const MID_REPLAY_MS = 120;
      await act(async () => attribute(() => owned[0]!(replayStart + MID_REPLAY_MS)));
      await expect(owned).toHaveLength(2);
      const midReplay = canvas.toDataURL();
      const context = canvas.getContext('2d')!;
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      await expect(pixels.some((value, i) => i % 4 === 3 && value > 0)).toBe(true);
      await expect(midReplay).not.toBe(fullArtifact);
      const width = canvas.clientWidth;
      const resized = settled((done) => {
        const observer = new ResizeObserver(() => {
          if (canvas.clientWidth !== width) done();
        });
        observer.observe(canvas);
        return () => observer.disconnect();
      });
      const mutated = settled((done) => {
        const observer = new MutationObserver(done);
        observer.observe(root, { attributes: true, attributeFilter: ['style'] });
        return () => observer.disconnect();
      });
      root.style.setProperty('--signature-probe', '1');
      root.style.inlineSize = '90%';
      await act(async () => {
        await Promise.all([resized, mutated]);
      });
      await expect(canvas.toDataURL()).toBe(midReplay);
      await expect(cancelled).toEqual([]);
      await act(async () => canvas.focus());
      await userEvent.keyboard('{Escape}');
      await expect(cancelled).toEqual([-2]);
      await expect(owned).toHaveLength(2);
    } finally {
      root.style.removeProperty('--signature-probe');
      root.style.inlineSize = '';
      request.mockRestore();
      cancel.mockRestore();
    }
    await expect(within(canvasElement).getByRole('button', { name: 'Replay' })).toBeEnabled();
  },
};
const exportApi = createRef<SignaturePadHandle>();
export const CroppedExport: Story = {
  args: { defaultValue: seeded, apiRef: exportApi },
  play: async ({ canvasElement }) => {
    const api = exportApi.current!;
    let data = '';
    await act(async () => {
      data = api.toDataURL();
    });
    await expect(data).toMatch(/^data:image\/png;base64,/);
    let blob!: Blob;
    await act(async () => {
      blob = await api.toBlob();
    });
    await expect(blob.type).toBe('image/png');
    await expect(blob.size).toBeGreaterThan(0);
    const bitmap = await createImageBitmap(blob);
    await expect(bitmap.width).toBeLessThan(1800);
    await expect(bitmap.height).toBeLessThan(780);
    bitmap.close();
    let svg = '';
    await act(async () => {
      svg = api.toSvg();
    });
    await expect(svg).toContain('<path');
    await expect(svg).toContain('viewBox=');
    await expect(svg).not.toContain('Sign here');
    const canvas = pad(canvasElement);
    await expect(Math.abs(canvas.width - canvas.clientWidth * devicePixelRatio)).toBeLessThan(1.1);
    const context = canvas.getContext('2d')!;
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    await expect(pixels.some((value, i) => i % 4 === 3 && value > 0)).toBe(true);
    await expect(within(canvasElement).getByRole('status')).toHaveTextContent('Signature exported');
  },
};
export const ExportFailure: Story = {
  play: async () => {
    await expect(signatureToPng([])).rejects.toMatchObject({ code: 'empty' });
    await expect(() => signatureToSvg(seeded, { scale: Infinity })).toThrow(SignatureExportError);
    await expect(() =>
      signatureToSvg([{ ...seeded[0]!, points: [{ x: NaN, y: 0, time: 0, pressure: null }] }]),
    ).toThrow(SignatureExportError);
    const original = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = (callback) => {
      callback(null);
    };
    try {
      await expect(signatureToPng(seeded)).rejects.toMatchObject({
        code: 'encoder',
      });
    } finally {
      HTMLCanvasElement.prototype.toBlob = original;
    }
  },
};
export const InsecureOrigin: Story = {
  beforeEach: () => {
    const uuid = spyOn(crypto, 'randomUUID').mockImplementation(() => {
      throw new DOMException('randomUUID requires a secure context', 'SecurityError');
    });
    return () => uuid.mockRestore();
  },
  play: async ({ canvasElement, args }) => {
    const canvas = pad(canvasElement);
    await gesture(canvas, strokeEvents);
    await gesture(canvas, strokeEvents);
    await expect(args.onValueChange).toHaveBeenCalledTimes(2);
    const value = (args.onValueChange as ReturnType<typeof fn>).mock.calls[1]![0] as SignatureStroke[];
    await expect(value).toHaveLength(2);
    await expect(value[0]!.id).not.toBe(value[1]!.id);
    await expect(crypto.randomUUID).toHaveBeenCalledTimes(0);
  },
};
const malformed: SignatureStroke[] = [
  ...seeded,
  { id: 'empty', color: 'blue', width: 'fine', startTime: NaN, points: [] },
  {
    id: 'untrusted',
    color: 'violet',
    width: 'bold',
    startTime: 400,
    points: [
      { x: NaN, y: 20, pressure: null, time: 0 },
      { x: 900, y: -10, pressure: 5, time: Infinity },
      { x: 300, y: Infinity, pressure: null, time: 30 },
      { x: 320, y: 60, pressure: null, time: 20 },
    ],
  },
];
const malformedApi = createRef<SignaturePadHandle>();
export const MalformedValue: Story = {
  args: { value: malformed, apiRef: malformedApi, download: true },
  beforeEach: () => {
    const warn = spyOn(console, 'warn').mockImplementation(() => {});
    return () => warn.mockRestore();
  },
  play: async ({ canvasElement, args, userEvent }) => {
    const scope = within(canvasElement);
    const canvas = pad(canvasElement);
    await expect(console.warn).toHaveBeenCalledTimes(1);
    await expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('malformed strokes'));
    const pixels = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
    await expect(pixels.some((value, i) => i % 4 === 3 && value > 0)).toBe(true);
    await expect(() => malformedApi.current!.toSvg()).toThrow(
      expect.objectContaining({ name: 'SignatureExportError', code: 'invalid' }),
    );
    await expect(malformedApi.current!.toBlob()).rejects.toMatchObject({ code: 'invalid' });
    await userEvent.click(scope.getByRole('button', { name: 'Download PNG' }));
    await waitFor(async () => {
      await expect(scope.getByRole('status')).toHaveTextContent('Export failed');
    });
    await userEvent.click(scope.getByRole('button', { name: 'Replay' }));
    await waitFor(async () => {
      await expect(scope.getByRole('status')).toHaveTextContent('Replay complete');
    });
    await gesture(canvas, strokeEvents);
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    const value = (args.onValueChange as ReturnType<typeof fn>).mock.calls[0]![0] as SignatureStroke[];
    await expect(value).toHaveLength(malformed.length + 1);
    await expect(console.warn).toHaveBeenCalledTimes(1);
  },
};
export const MalformedPointBudget: Story = {
  args: {
    value: [
      {
        ...seeded[0]!,
        points: [
          ...Array.from({ length: 100000 }, () => ({ x: NaN, y: 0, pressure: null, time: 0 })),
          { x: 120, y: 120, pressure: null, time: 0 },
        ],
      },
    ],
  },
  beforeEach: () => {
    const warn = spyOn(console, 'warn').mockImplementation(() => {});
    return () => warn.mockRestore();
  },
  play: async ({ canvasElement }) => {
    const canvas = pad(canvasElement);
    const pixels = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
    await expect(pixels.some((value, i) => i % 4 === 3 && value > 0)).toBe(false);
  },
};
export const FalsyGuide: Story = {
  render: (args) => (
    <>
      {[false, null, 0, ''].map((node, i) => (
        <SignaturePad
          {...args}
          key={i}
          label={node}
          hint={node}
          signer={node}
          description={node}
          error={node}
          icons={{ clear: node }}
        />
      ))}
    </>
  ),
  play: async ({ canvasElement }) => {
    const guides = canvasElement.querySelectorAll('[data-ui="signature-pad-guide"]');
    await expect(guides).toHaveLength(1);
    await expect(guides[0]).toHaveTextContent('00');
    await expect(within(canvasElement).getAllByRole('alert')).toHaveLength(1);
    await expect(
      canvasElement.querySelectorAll('[data-ui="signature-pad"] > span[id$="-label"]'),
    ).toHaveLength(1);
  },
};
export const ExternalAria: Story = {
  args: {
    'aria-label': 'Personal autograph',
    'aria-labelledby': 'outside-name missing-name',
    'aria-describedby': 'outside-help missing-help',
    description: 'Optional drawing',
    error: 'Try again',
  },
  render: (args) => (
    <>
      <span id="outside-name">Autograph</span>
      <span id="outside-help">Or type your name.</span>
      <SignaturePad {...args} />
    </>
  ),
  play: async ({ canvasElement }) => {
    const canvas = pad(canvasElement);
    await expect(canvas).toHaveAttribute('aria-label', 'Personal autograph');
    await expect(canvas.getAttribute('aria-labelledby')).toContain('outside-name missing-name');
    await expect(canvas.getAttribute('aria-labelledby')).toContain('-label');
    await expect(canvas.getAttribute('aria-describedby')).toContain('outside-help missing-help');
    await expect(canvas.getAttribute('aria-describedby')).toContain('-error');
    const state = canvas.ownerDocument.getElementById(
      canvas.getAttribute('aria-describedby')!.split(' ').find((id) => id.endsWith('-state'))!,
    );
    await expect(state).toHaveTextContent(messages.empty);
    await gesture(canvas, strokeEvents);
    await expect(state).toHaveTextContent(messages.signed);
  },
};
export const NativeReset: Story = {
  args: { defaultValue: seeded },
  render: (args) => (
    <form>
      <SignaturePad {...args} />
      <Button type="reset">Reset</Button>
    </form>
  ),
  play: async ({ canvasElement, args, userEvent }) => {
    const scope = within(canvasElement);
    await userEvent.click(scope.getByRole('button', { name: 'Clear' }));
    await userEvent.click(scope.getByRole('button', { name: 'Reset' }));
    await waitFor(async () => {
      await expect(args.onValueChange).toHaveBeenNthCalledWith(2, seeded);
    });
    await expect(scope.getByRole('status')).toHaveTextContent('Signature reset');
  },
};
export const ExternalReplacement: Story = {
  render: function ReplacementDemo(args) {
    const [value, setValue] = useState(seeded);
    return (
      <>
        <Button onClick={() => setValue([])}>Replace value</Button>
        <SignaturePad
          {...args}
          value={value}
          onValueChange={(next) => {
            args.onValueChange?.(next);
            setValue(next);
          }}
        />
      </>
    );
  },
  play: async ({ canvasElement, args, userEvent }) => {
    await gesture(pad(canvasElement), strokeEvents);
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Replace value' }));
    await expect(within(canvasElement).getByRole('button', { name: 'Undo' })).toBeDisabled();
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
  },
};
const hiddenApi = createRef<SignaturePadHandle>();
export const HiddenCanvas: Story = {
  args: {
    defaultValue: seeded,
    apiRef: hiddenApi,
    slotProps: { canvas: { css: css({ display: 'none' }) } },
  },
  play: async ({ canvasElement, args }) => {
    let data = '';
    await act(async () => {
      data = hiddenApi.current!.toDataURL();
    });
    await expect(data).toMatch(/^data:image\/png/);
    await gesture(canvasElement.querySelector('canvas')!, strokeEvents);
    await expect(args.onValueChange).toHaveBeenCalledTimes(0);
  },
};
export const LightTheme: Story = {
  args: { defaultValue: seeded },
  decorators: [withLightTheme],
  play: async ({ canvasElement }) => {
    await assertInkContrast(pad(canvasElement));
  },
};
const refSpy = fn<(element: HTMLCanvasElement | null) => void>();
export const RefAndSlots: Story = {
  args: {
    ref: refSpy,
    slotProps: {
      canvas: { css: css({ borderRadius: vars.radius.sm }) },
      toolbar: { css: css({ gap: vars.space[8] }) },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = pad(canvasElement);
    await expect(refSpy.mock.calls.some(([element]) => element === canvas)).toBe(true);
    await expect(Math.abs(parseFloat(getComputedStyle(canvas).borderTopLeftRadius) - 8)).toBeLessThan(1.1);
    const toolbar = canvasElement.querySelector<HTMLElement>('[data-ui="signature-pad-toolbar"]')!;
    await expect(Math.abs(parseFloat(getComputedStyle(toolbar).gap) - 32)).toBeLessThan(1.1);
  },
};
export const Resize: Story = {
  args: { defaultValue: seeded },
  play: async ({ canvasElement, args }) => {
    const canvas = pad(canvasElement);
    const root = canvas.closest<HTMLElement>('[data-ui="signature-pad"]')!;
    const before = canvas.width;
    root.style.inlineSize = '50%';
    await waitFor(async () => {
      await expect(canvas.width).toBeLessThan(before);
    });
    await expect(Math.abs(canvas.width - canvas.clientWidth * devicePixelRatio)).toBeLessThan(1.1);
    const pixels = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
    await expect(pixels.some((value, i) => i % 4 === 3 && value > 0)).toBe(true);
    await expect(args.onValueChange).toHaveBeenCalledTimes(0);
    root.style.inlineSize = '';
  },
};
export const DisabledMidStroke: Story = {
  render: function DisabledDuringStroke(args) {
    const [disabled, setDisabled] = useState(false);
    return (
      <>
        <Button onClick={() => setDisabled(!disabled)}>
          {disabled ? 'Enable drawing' : 'Disable drawing'}
        </Button>
        <SignaturePad {...args} disabled={disabled} defaultValue={seeded} />
      </>
    );
  },
  play: async ({ canvasElement, args, userEvent }) => {
    const canvas = pad(canvasElement);
    const scope = within(canvasElement);
    const before = canvas.toDataURL();
    await gesture(canvas, strokeEvents.slice(0, 2));
    await expect(canvas.toDataURL()).not.toBe(before);
    await userEvent.click(scope.getByRole('button', { name: 'Disable drawing' }));
    await gesture(canvas, [{ type: 'pointerup' }]);
    await expect(canvas.toDataURL()).toBe(before);
    await expect(args.onValueChange).toHaveBeenCalledTimes(0);
    await userEvent.click(scope.getByRole('button', { name: 'Enable drawing' }));
    await gesture(canvas, strokeEvents);
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
  },
};
const unmountApi = createRef<SignaturePadHandle>();
export const UnmountDuringReplay: Story = {
  render: function UnmountDemo(args) {
    const [mounted, setMounted] = useState(true);
    return (
      <>
        <Button onClick={() => setMounted(false)}>Remove pad</Button>
        {mounted && <SignaturePad {...args} defaultValue={seeded} apiRef={unmountApi} />}
      </>
    );
  },
  play: async ({ canvasElement, args, userEvent }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Replay' }));
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Remove pad' }));
    await expect(unmountApi.current).toBeNull();
    await expect(within(canvasElement).queryByRole('img')).not.toBeInTheDocument();
    await expect(args.onValueChange).toHaveBeenCalledTimes(0);
  },
};
export const RTL: Story = {
  args: { dir: 'rtl', defaultValue: seeded },
  play: async ({ canvasElement }) => {
    await expect(getComputedStyle(pad(canvasElement)).direction).toBe('rtl');
    await expect(signatureToSvg(seeded)).toContain('M 100 180');
  },
};
export const ForcedColors: Story = {
  args: { defaultValue: seeded },
  parameters: {
    docs: {
      description: {
        story:
          'Enable forced colors in a browser to check this story. This test does not emulate system colors.',
      },
    },
  },
};
export const ReducedMotion: Story = {
  ...Replay,
  parameters: {
    docs: {
      description: {
        story:
          'Enable reduced motion in a browser to check replay. The test uses the runner’s media preference.',
      },
    },
  },
};
export const InsideDialog: Story = {
  // Excluded from the docs page: its open overlay (modal/backdrop) covers the documentation.
  tags: ['!autodocs'],
  render: (args) => (
    <Dialog defaultOpen>
      <Dialog.Content>
        <Dialog.Title>Sign document</Dialog.Title>
        <Dialog.Description>Draw or type your name.</Dialog.Description>
        <SignaturePad {...args} />
        <TextField label="Type your name instead" />
        <Dialog.Close>Close</Dialog.Close>
      </Dialog.Content>
    </Dialog>
  ),
};
