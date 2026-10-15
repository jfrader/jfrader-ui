import { Profiler, useState, type ComponentPropsWithRef, type ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fireEvent, fn, spyOn, waitFor } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { css } from '../../styling/css';
import { motionDurationMs } from '../../styling/motion-timings';
import { withLightTheme } from '../../testing/story-decorators';
import { ImageCompare } from './index';
import { sceneSource } from '../scene';

const RAW_SRC = sceneSource('image-compare-alpine', { variant: 'landscape' });
const GRADED_SRC = sceneSource('image-compare-alpine', { variant: 'landscape', grade: 'warm' });
const BROKEN_SRC = 'data:image/png;base64,broken';

const beforeImage = <img src={RAW_SRC} alt="Mountain landscape before grading" width={1200} height={800} />;
const afterImage = <img src={GRADED_SRC} alt="Mountain landscape with a warm grade" width={1200} height={800} />;

/** Outline and its offset (2px + 2px) drawn outside the handle. */
const FOCUS_RING_EXTENT = 4;
const HANDLE_SIZE = 40;
const RESET_MIN_SIZE = 32;
/** Matches motion.duration.fast plus a frame. */
const TRANSITION_MS = 140;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
/** Computed lengths can carry sub-pixel rounding; half a pixel still tells 1px/2px/3px overrides apart. */
const PX_TOLERANCE = 0.5;
const expectPx = (value: string, px: number) =>
  expect(Math.abs(Number.parseFloat(value) - px)).toBeLessThan(PX_TOLERANCE);

const frameStyle = css({
  inlineSize: '36rem',
  maxInlineSize: '100%',
  display: 'grid',
  gap: vars.space[6],
  padding: vars.space[4],
});
const narrowStyle = css({ inlineSize: '14rem', maxInlineSize: '100%' });
const statusStyle = css({
  display: 'grid',
  placeItems: 'center',
  blockSize: '100%',
  padding: vars.space[4],
  boxSizing: 'border-box',
  color: vars.color.text,
  background: vars.color.surface,
  fontSize: vars.textSize.sm,
});
const fixtureButtonStyle = css({
  minBlockSize: vars.space[8],
  minInlineSize: vars.space[8],
  paddingInline: vars.space[3],
});

const SOURCE = `const raw = sceneSource('image-compare-alpine', { variant: 'landscape' });
const graded = sceneSource('image-compare-alpine', { variant: 'landscape', grade: 'warm' });

<ImageCompare
  before={<img src={raw} alt="Mountain landscape before grading" width={1200} height={800} />}
  after={<img src={graded} alt="Mountain landscape with a warm grade" width={1200} height={800} />}
  label="Landscape grading comparison"
/>`;

const meta = {
  title: 'Media/ImageCompare',
  component: ImageCompare,
  tags: ['autodocs'],
  args: {
    before: beforeImage,
    after: afterImage,
    label: 'Landscape grading comparison',
    locale: 'en-GB',
    onValueChange: fn(),
    onValueCommit: fn(),
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
      source: { code: SOURCE },
      description: {
        component: 'Compare two images by dragging a divider to reveal more of either image.',
      },
      usage: `Images share the same alignment and crop. The divider follows the APG slider pattern.

\`value\` is the percentage of the Before image that is visible. Horizontal comparisons reveal from inline-start; vertical comparisons reveal from the top. At 0, only After is visible. At 100, only Before is visible.

The slider reports the accepted value. After a drag, the divider settles back to that value.

- Arrows move one \`step\`; horizontal Left/Right follow physical direction in RTL, and Up always increases. Shift+arrows and PageUp/PageDown move \`largeStep\`; Home/End go to 0/100. Center divider and double-clicking the handle request 50.
- Tap the frame to jump or drag anywhere on it. Touch dragging starts along the reveal axis, so a vertical swipe over a horizontal comparison scrolls the page.
- Both images stay mounted. Give each a meaningful, different \`alt\`; do not put interactive content inside them. Captions are decorative and describe the slider.
- Name the slider with \`label\` or \`slotProps.handle\` ARIA. A root \`aria-label\` names only the wrapper.
- Localize captions, \`label\`, \`valueText\` and \`resetLabel\`. Percentages use \`Intl.NumberFormat\`.
- Test touch screen-reader operation on a device.`,
    },
  },
} satisfies Meta<typeof ImageCompare>;
export default meta;
type Story = StoryObj<typeof ImageCompare>;

const part = (root: Element, name: string) => root.querySelector<HTMLElement>(`[data-ui="${name}"]`)!;

/** Which layer is visible (hit-testable through the clip) at `ratio` along the reveal axis. */
function layerAt(root: Element, ratio: number, vertical = false) {
  const box = part(root, 'image-compare-frame').getBoundingClientRect();
  const x = vertical ? box.left + box.width * 0.8 : box.left + box.width * ratio;
  const y = vertical ? box.top + box.height * ratio : box.top + box.height * 0.8;
  const hit = root.ownerDocument.elementFromPoint(x, y);
  return hit?.closest('[data-ui="image-compare-before"]')
    ? 'before'
    : hit?.closest('[data-ui="image-compare-after"]')
      ? 'after'
      : null;
}

/** Divider center as a fraction of the frame along the reveal axis (physical left/top origin). */
function dividerRatio(root: Element, vertical = false) {
  const frame = part(root, 'image-compare-frame').getBoundingClientRect();
  const divider = part(root, 'image-compare-divider').getBoundingClientRect();
  return vertical
    ? (divider.top + divider.height / 2 - frame.top) / frame.height
    : (divider.left + divider.width / 2 - frame.left) / frame.width;
}

async function expectFocusRing(element: HTMLElement) {
  await expect(element.ownerDocument.activeElement).toBe(element);
  const style = getComputedStyle(element);
  await expect(style.outlineStyle).not.toBe('none');
  await expect(Math.abs(Number.parseFloat(style.outlineWidth) - 2)).toBeLessThan(1.1);
}

const POINTER_ID = 1;

/**
 * Synthetic pointer on the frame. Synthetic pointers are not active, so the browser would reject
 * a real capture; the stubs record it instead. Real capture and touch panning are browser QA.
 */
function pointerOn(frame: HTMLElement, pointerType = 'mouse') {
  const captured = new Set<number>();
  spyOn(frame, 'setPointerCapture').mockImplementation((pointerId) => void captured.add(pointerId));
  spyOn(frame, 'hasPointerCapture').mockImplementation((pointerId) => captured.has(pointerId));
  spyOn(frame, 'releasePointerCapture').mockImplementation((pointerId) => void captured.delete(pointerId));
  const fire = (
    type: string,
    x: number,
    y = 0.8,
    options: {
      pointerId?: number;
      isPrimary?: boolean;
      button?: number;
      target?: Element;
    } = {},
  ) => {
    const box = frame.getBoundingClientRect();
    return fireEvent(
      options.target ?? frame,
      new PointerEvent(type, {
        bubbles: true,
        cancelable: true,
        pointerId: options.pointerId ?? POINTER_ID,
        pointerType,
        isPrimary: options.isPrimary ?? true,
        button: options.button ?? 0,
        clientX: box.left + box.width * x,
        clientY: box.top + box.height * y,
      }),
    );
  };
  return { fire, captured };
}

export const Default: Story = {
  play: async ({ canvas, canvasElement }) => {
    const slider = canvas.getByRole('slider', { name: 'Landscape grading comparison' });
    await expect(slider).toHaveAttribute('aria-valuemin', '0');
    await expect(slider).toHaveAttribute('aria-valuemax', '100');
    await expect(slider).toHaveAttribute('aria-valuenow', '50');
    await expect(slider).toHaveAttribute('aria-valuetext', '50% Before visible');
    await expect(slider).toHaveAttribute('aria-orientation', 'horizontal');
    await expect(slider).toHaveAccessibleDescription('Before After');
    const before = canvas.getByRole<HTMLImageElement>('img', { name: 'Mountain landscape before grading' });
    const after = canvas.getByRole<HTMLImageElement>('img', { name: 'Mountain landscape with a warm grade' });
    // One photograph in two grades: the generator recolours the same scene, no CSS filter.
    await expect(before).toHaveAttribute('src', RAW_SRC);
    await expect(after).toHaveAttribute('src', GRADED_SRC);
    await expect(GRADED_SRC).not.toBe(RAW_SRC);
    await expect(getComputedStyle(before).filter).toBe('none');
    await expect(getComputedStyle(after).filter).toBe('none');
    await waitFor(() => {
      expect(before.naturalWidth).toBeGreaterThan(0);
      expect(after.naturalWidth).toBe(before.naturalWidth);
      expect(after.naturalHeight).toBe(before.naturalHeight);
    });
    await expect(after.getBoundingClientRect().toJSON()).toEqual(before.getBoundingClientRect().toJSON());
    await expect(canvas.queryByText('Before')?.closest('[aria-hidden="true"]')).not.toBeNull();
    await expect(canvas.queryByText('After')?.closest('[aria-hidden="true"]')).not.toBeNull();
    // Captions are chips sized by their text, not stretched like the images.
    const frameBox = part(canvasElement, 'image-compare-frame').getBoundingClientRect();
    for (const name of ['image-compare-before-label', 'image-compare-after-label']) {
      const caption = part(canvasElement, name).getBoundingClientRect();
      await expect(caption.height).toBeLessThan(frameBox.height / 4);
      await expect(caption.width).toBeLessThan(frameBox.width / 4);
    }
    const frame = part(canvasElement, 'image-compare-frame').getBoundingClientRect();
    await expect(Math.abs(frame.width / frame.height - 3 / 2)).toBeLessThan(0.02);
    await expect(Math.abs(dividerRatio(canvasElement) - 0.5)).toBeLessThan(0.01);
    await expect(layerAt(canvasElement, 0.25)).toBe('before');
    await expect(layerAt(canvasElement, 0.75)).toBe('after');
  },
};

export const Horizontal: Story = {
  args: { orientation: 'horizontal', defaultValue: 35 },
};

const dragRender = fn();
export const MotionValueDrag: Story = {
  render: (args) => (
    <Profiler id="image-compare-drag" onRender={dragRender}>
      <ImageCompare {...args} />
    </Profiler>
  ),
  play: async ({ canvas, canvasElement, args }) => {
    const slider = canvas.getByRole('slider');
    const pointer = pointerOn(part(canvasElement, 'image-compare-frame'));
    pointer.fire('pointerdown', 0.5);
    pointer.fire('pointermove', 0.6);
    await expect(slider).toHaveAttribute('data-dragging');
    const renders = dragRender.mock.calls.length;
    pointer.fire('pointermove', 0.65);
    pointer.fire('pointermove', 0.7);
    await expect(slider).toHaveAttribute('aria-valuenow', '70');
    await expect(slider).toHaveAttribute('aria-valuetext', '70% Before visible');
    await expect(Math.abs(dividerRatio(canvasElement) - 0.7)).toBeLessThan(0.01);
    await expect(dragRender.mock.calls.length).toBe(renders);
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
      await expect(getComputedStyle(slider).transform).not.toBe('matrix(1, 0, 0, 1, 0, 0)');
    }
    pointer.fire('pointerup', 0.7);
    await expect(args.onValueCommit).toHaveBeenLastCalledWith(70);
    await sleep(motionDurationMs.slow * 2);
    await expect(Math.abs(dividerRatio(canvasElement) - 0.7)).toBeLessThan(0.01);
    await expect(getComputedStyle(slider).transform).toBe('matrix(1, 0, 0, 1, 0, 0)');
    await expect(args.onValueChange).toHaveBeenCalledTimes(3);
  },
};

export const FadingCaptions: Story = {
  render: (args) => (
    <>
      <ImageCompare {...args} label="Horizontal captions" />
      <ImageCompare {...args} orientation="vertical" label="Vertical captions" />
      <ImageCompare {...args} dir="rtl" label="RTL captions" />
    </>
  ),
  play: async ({ canvasElement, userEvent }) => {
    for (const root of canvasElement.querySelectorAll('[data-ui="image-compare"]')) {
      const slider = part(root, 'image-compare-handle');
      const before = part(root, 'image-compare-before-label');
      const after = part(root, 'image-compare-after-label');
      await expect(before.parentElement).toBe(part(root, 'image-compare-frame'));
      await expect(getComputedStyle(before).opacity).toBe('1');
      await expect(getComputedStyle(after).opacity).toBe('1');
      slider.focus();
      await userEvent.keyboard('{Home}');
      await expect(getComputedStyle(before).opacity).toBe('0');
      await expect(getComputedStyle(after).opacity).toBe('1');
      await userEvent.keyboard('{End}');
      await expect(getComputedStyle(before).opacity).toBe('1');
      await expect(getComputedStyle(after).opacity).toBe('0');
      const frame = part(root, 'image-compare-frame').getBoundingClientRect();
      const caption = before.getBoundingClientRect();
      const vertical = slider.getAttribute('aria-orientation') === 'vertical';
      const reversed = root.matches(':dir(rtl)');
      const farEdge = vertical
        ? caption.bottom - frame.top
        : reversed
          ? frame.right - caption.left
          : caption.right - frame.left;
      const size = vertical ? caption.height : caption.width;
      const axisSize = vertical ? frame.height : frame.width;
      const partial = Math.round(((farEdge + size / 2) / axisSize) * 100);
      await userEvent.keyboard(`{Home}${'{ArrowUp}'.repeat(partial)}`);
      const opacity = Number(getComputedStyle(before).opacity);
      await expect(opacity).toBeGreaterThan(0);
      await expect(opacity).toBeLessThan(1);
    }
  },
};

export const Vertical: Story = {
  args: { orientation: 'vertical', defaultValue: 30 },
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    const slider = canvas.getByRole('slider');
    await expect(slider).toHaveAttribute('aria-orientation', 'vertical');
    await expect(Math.abs(dividerRatio(canvasElement, true) - 0.3)).toBeLessThan(0.01);
    await expect(layerAt(canvasElement, 0.15, true)).toBe('before');
    await expect(layerAt(canvasElement, 0.6, true)).toBe('after');
    await userEvent.tab();
    await userEvent.keyboard('{ArrowUp}');
    await expect(slider).toHaveAttribute('aria-valuenow', '31');
    await userEvent.keyboard('{ArrowDown}{ArrowDown}');
    await expect(slider).toHaveAttribute('aria-valuenow', '29');
    await expect(args.onValueChange).toHaveBeenCalledTimes(3);
    const frame = part(canvasElement, 'image-compare-frame');
    await expect(getComputedStyle(frame).touchAction).toBe('pan-x');
  },
};

export const LabelsHidden: Story = {
  args: { labels: false },
  play: async ({ canvas, canvasElement }) => {
    const slider = canvas.getByRole('slider');
    await expect(slider).not.toHaveAttribute('aria-describedby');
    await expect(canvasElement.querySelector('[data-ui$="-label"]')).toBeNull();
  },
};

export const CustomLabels: Story = {
  args: {
    labels: ['Original', 'Graded'],
    valueText: (_value, percent) => `${percent} original visible`,
    defaultValue: 40,
  },
  play: async ({ canvas }) => {
    const slider = canvas.getByRole('slider');
    await expect(slider).toHaveAccessibleDescription('Original Graded');
    await expect(slider).toHaveAttribute('aria-valuetext', '40% original visible');
  },
};

export const LocalizedPercent: Story = {
  args: {
    locale: 'ar-EG',
    labels: ['قبل', 'بعد'],
    label: 'مقارنة الصور',
    resetLabel: 'توسيط الفاصل',
    valueText: (_value, percent) => `${percent} من الصورة الأصلية`,
    defaultValue: 25,
    dir: 'rtl',
    lang: 'ar',
  },
  play: async ({ canvas }) => {
    const percent = new Intl.NumberFormat('ar-EG', { style: 'percent' }).format(0.25);
    await expect(canvas.getByRole('slider', { name: 'مقارنة الصور' })).toHaveAttribute(
      'aria-valuetext',
      `${percent} من الصورة الأصلية`,
    );
    await expect(canvas.getByRole('button', { name: 'توسيط الفاصل' })).toBeInTheDocument();
  },
};

export const CustomAspectRatio: Story = {
  args: { aspectRatio: '1 / 1' },
  play: async ({ canvasElement }) => {
    const frame = part(canvasElement, 'image-compare-frame').getBoundingClientRect();
    await expect(Math.abs(frame.width - frame.height)).toBeLessThan(1.1);
  },
};

export const Controlled: Story = {
  render: (args) => {
    const [value, setValue] = useState(20);
    return (
      <>
        <ImageCompare
          {...args}
          value={value}
          onValueChange={(next) => {
            args.onValueChange?.(next);
            setValue(next);
          }}
        />
        <output>{value}</output>
      </>
    );
  },
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    const slider = canvas.getByRole('slider');
    await userEvent.tab();
    await userEvent.keyboard('{End}');
    await expect(slider).toHaveAttribute('aria-valuenow', '100');
    await expect(layerAt(canvasElement, 0.95)).toBe('before');
    await userEvent.keyboard('{Home}');
    await expect(slider).toHaveAttribute('aria-valuenow', '0');
    await expect(layerAt(canvasElement, 0.05)).toBe('after');
    await expect(args.onValueChange).toHaveBeenCalledTimes(2);
    await expect(args.onValueCommit).toHaveBeenCalledTimes(2);
    await expect(canvasElement.querySelector('output')).toHaveTextContent('0');
  },
};

export const RejectedControlled: Story = {
  args: { value: 40 },
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    const slider = canvas.getByRole('slider');
    await userEvent.tab();
    await userEvent.keyboard('{ArrowRight}{ArrowRight}{End}');
    await expect(slider).toHaveAttribute('aria-valuenow', '40');
    await expect(slider).toHaveAttribute('aria-valuetext', '40% Before visible');
    await expect(Math.abs(dividerRatio(canvasElement) - 0.4)).toBeLessThan(0.01);
    await expect(args.onValueChange).toHaveBeenCalledTimes(3);
    await expect(args.onValueChange).toHaveBeenNthCalledWith(1, 41);
    await expect(args.onValueChange).toHaveBeenNthCalledWith(2, 41);
    await expect(args.onValueChange).toHaveBeenNthCalledWith(3, 100);
    await expect(args.onValueCommit).toHaveBeenCalledTimes(3);
    const pointer = pointerOn(part(canvasElement, 'image-compare-frame'));
    pointer.fire('pointerdown', 0.4);
    pointer.fire('pointermove', 0.7);
    pointer.fire('pointerup', 0.7);
    await expect(args.onValueChange).toHaveBeenLastCalledWith(70);
    await expect(args.onValueCommit).toHaveBeenLastCalledWith(70);
    await expect(slider).toHaveAttribute('aria-valuenow', '40');
    await expect(Math.abs(dividerRatio(canvasElement) - 0.4)).toBeLessThan(0.01);
    await sleep(motionDurationMs.fast);
    await expect(Math.abs(dividerRatio(canvasElement) - 0.4)).toBeLessThan(0.01);
  },
};

export const Endpoints: Story = {
  render: (args) => (
    <>
      <ImageCompare {...args} defaultValue={0} label="All After" />
      <ImageCompare {...args} defaultValue={100} label="All Before" />
    </>
  ),
  play: async ({ canvas, canvasElement }) => {
    const [none, all] = canvasElement.querySelectorAll('[data-ui="image-compare"]');
    await expect(canvas.getByRole('slider', { name: 'All After' })).toHaveAttribute('aria-valuenow', '0');
    await expect(canvas.getByRole('slider', { name: 'All Before' })).toHaveAttribute('aria-valuenow', '100');
    await expect(layerAt(none!, 0.02)).toBe('after');
    await expect(layerAt(all!, 0.98)).toBe('before');
    // The handle stays reachable and its focus ring stays inside the frame at both ends.
    for (const root of [none!, all!]) {
      const frame = part(root, 'image-compare-frame').getBoundingClientRect();
      const handle = part(root, 'image-compare-handle').getBoundingClientRect();
      await expect(handle.left - FOCUS_RING_EXTENT).toBeGreaterThanOrEqual(frame.left - 1.1);
      await expect(handle.right + FOCUS_RING_EXTENT).toBeLessThanOrEqual(frame.right + 1.1);
    }
  },
};

export const Steps: Story = {
  args: { step: 5, largeStep: 25, defaultValue: 50 },
  play: async ({ canvas, userEvent, args }) => {
    const slider = canvas.getByRole('slider');
    await userEvent.tab();
    await userEvent.keyboard('{ArrowRight}');
    await expect(slider).toHaveAttribute('aria-valuenow', '55');
    await userEvent.keyboard('{PageDown}');
    await expect(slider).toHaveAttribute('aria-valuenow', '30');
    await userEvent.keyboard('{Shift>}{ArrowUp}{/Shift}');
    await expect(slider).toHaveAttribute('aria-valuenow', '55');
    await expect(args.onValueCommit).toHaveBeenCalledTimes(3);
  },
};

export const FractionalStep: Story = {
  args: { step: 0.1, defaultValue: 0 },
  play: async ({ canvas, userEvent }) => {
    const slider = canvas.getByRole('slider');
    await userEvent.tab();
    await userEvent.keyboard('{ArrowRight}{ArrowRight}{ArrowRight}');
    await expect(slider).toHaveAttribute('aria-valuenow', '0.3');
    await expect(slider).toHaveAttribute('aria-valuetext', '0.3% Before visible');
  },
};

export const InvalidSteps: Story = {
  args: { step: 0, largeStep: Number.NaN, defaultValue: 50 },
  play: async ({ canvas, userEvent }) => {
    const slider = canvas.getByRole('slider');
    await userEvent.tab();
    await userEvent.keyboard('{ArrowRight}');
    await expect(slider).toHaveAttribute('aria-valuenow', '51');
    await userEvent.keyboard('{PageUp}');
    await expect(slider).toHaveAttribute('aria-valuenow', '61');
  },
};

export const Disabled: Story = {
  args: { disabled: true, defaultValue: 30 },
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    const slider = canvas.getByRole('slider');
    await expect(slider).toHaveAttribute('aria-disabled', 'true');
    await expect(slider).toHaveAttribute('tabindex', '0');
    await expect(canvas.getByRole('button', { name: 'Center divider' })).toBeDisabled();
    await userEvent.tab();
    await expect(slider.ownerDocument.activeElement).toBe(slider);
    await userEvent.keyboard('{ArrowRight}{Home}{End}{PageUp}');
    await userEvent.dblClick(slider);
    const pointer = pointerOn(part(canvasElement, 'image-compare-frame'));
    pointer.fire('pointerdown', 0.8);
    pointer.fire('pointermove', 0.9);
    pointer.fire('pointerup', 0.9);
    await expect(pointer.captured.size).toBe(0);
    await expect(slider).toHaveAttribute('aria-valuenow', '30');
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await expect(args.onValueCommit).not.toHaveBeenCalled();
  },
};

export const KeyboardAdjustment: Story = {
  args: { defaultValue: 50 },
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    const slider = canvas.getByRole('slider');
    const reset = canvas.getByRole('button', { name: 'Center divider' });
    await userEvent.tab();
    await expectFocusRing(slider);
    const moves = [
      ['{ArrowRight}', 51],
      ['{ArrowLeft}', 50],
      ['{ArrowUp}', 51],
      ['{ArrowDown}', 50],
      ['{Shift>}{ArrowRight}{/Shift}', 60],
      ['{Shift>}{ArrowLeft}{/Shift}', 50],
      ['{Shift>}{ArrowUp}{/Shift}', 60],
      ['{Shift>}{ArrowDown}{/Shift}', 50],
      ['{PageUp}', 60],
      ['{PageDown}', 50],
      ['{Home}', 0],
      ['{End}', 100],
    ] as const;
    for (const [key, n] of moves) {
      await userEvent.keyboard(key);
      await expect(slider).toHaveAttribute('aria-valuenow', String(n));
      await expect(slider).toHaveAttribute('aria-valuetext', `${n}% Before visible`);
      await expect(Math.abs(dividerRatio(canvasElement) - n / 100)).toBeLessThan(0.02);
    }
    // Bounds and unrelated keys request nothing.
    await userEvent.keyboard('{End}{ArrowRight}{PageUp}{Enter} ');
    await expect(args.onValueChange).toHaveBeenCalledTimes(moves.length);
    await expect(args.onValueCommit).toHaveBeenCalledTimes(moves.length);
    for (let index = 0; index < moves.length; index++) {
      await expect(args.onValueChange).toHaveBeenNthCalledWith(index + 1, moves[index]![1]);
      await expect(args.onValueCommit).toHaveBeenNthCalledWith(index + 1, moves[index]![1]);
    }
    await userEvent.tab();
    await expectFocusRing(reset);
    await userEvent.keyboard('{Enter}');
    await expect(slider).toHaveAttribute('aria-valuenow', '50');
    await userEvent.keyboard(' ');
    await expect(reset.ownerDocument.activeElement).toBe(reset);
    await expect(args.onValueChange).toHaveBeenCalledTimes(moves.length + 1);
    await expect(args.onValueCommit).toHaveBeenLastCalledWith(50);
    await expect(args.onValueCommit).toHaveBeenCalledTimes(moves.length + 1);
    await userEvent.tab({ shift: true });
    await expect(slider.ownerDocument.activeElement).toBe(slider);
    await userEvent.tab({ shift: true });
    await expect(slider.ownerDocument.activeElement).not.toBe(slider);
  },
};

export const DoubleClickReset: Story = {
  args: { defaultValue: 20 },
  play: async ({ canvas, userEvent, args }) => {
    const slider = canvas.getByRole('slider');
    await userEvent.dblClick(slider);
    await expect(slider).toHaveAttribute('aria-valuenow', '50');
    await expect(slider.ownerDocument.activeElement).toBe(slider);
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueCommit).toHaveBeenCalledTimes(1);
    await expect(args.onValueCommit).toHaveBeenCalledWith(50);
  },
};

export const PointerInteraction: Story = {
  args: { defaultValue: 50 },
  play: async ({ canvas, canvasElement, args }) => {
    const slider = canvas.getByRole('slider');
    const frame = part(canvasElement, 'image-compare-frame');
    const pointer = pointerOn(frame);
    // Frame tap jumps to the pointer and focuses the handle.
    pointer.fire('pointerdown', 0.2);
    await expect(slider.ownerDocument.activeElement).toBe(slider);
    pointer.fire('pointerup', 0.2);
    await expect(slider).toHaveAttribute('aria-valuenow', '20');
    await expect(layerAt(canvasElement, 0.1)).toBe('before');
    await expect(layerAt(canvasElement, 0.3)).toBe('after');
    await expect(args.onValueCommit).toHaveBeenCalledTimes(1);
    await expect(args.onValueCommit).toHaveBeenLastCalledWith(20);
    // Non-primary and secondary-button presses are ignored.
    pointer.fire('pointerdown', 0.9, 0.8, { pointerId: 2, isPrimary: false });
    pointer.fire('pointerup', 0.9, 0.8, { pointerId: 2, isPrimary: false });
    pointer.fire('pointerdown', 0.9, 0.8, { button: 2 });
    pointer.fire('pointerup', 0.9, 0.8, { button: 2 });
    await expect(slider).toHaveAttribute('aria-valuenow', '20');
    // Handle drag keeps the grab offset: pressing 2% right of the divider does not jump.
    const handle = part(canvasElement, 'image-compare-handle');
    pointer.fire('pointerdown', 0.22, 0.5, { target: handle });
    pointer.fire('pointermove', 0.22, 0.5);
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    pointer.fire('pointermove', 0.52, 0.5);
    await expect(pointer.captured.has(POINTER_ID)).toBe(true);
    await expect(handle).toHaveAttribute('data-dragging');
    await expect(slider).toHaveAttribute('aria-valuenow', '50');
    pointer.fire('pointermove', 1.4, 0.5);
    await expect(slider).toHaveAttribute('aria-valuenow', '100');
    pointer.fire('pointermove', 1.5, 0.5);
    pointer.fire('pointerup', 1.5, 0.5);
    pointer.fire('lostpointercapture', 1.5, 0.5);
    await expect(pointer.captured.size).toBe(0);
    await expect(handle).not.toHaveAttribute('data-dragging');
    await expect(args.onValueChange).toHaveBeenCalledTimes(3);
    await expect(args.onValueChange).toHaveBeenNthCalledWith(2, 50);
    await expect(args.onValueChange).toHaveBeenNthCalledWith(3, 100);
    await expect(args.onValueCommit).toHaveBeenCalledTimes(2);
    await expect(args.onValueCommit).toHaveBeenLastCalledWith(100);
    // A tap on the handle itself requests nothing.
    pointer.fire('pointerdown', 0.98, 0.5, { target: handle });
    pointer.fire('pointerup', 0.98, 0.5, { target: handle });
    await expect(args.onValueCommit).toHaveBeenCalledTimes(2);
  },
};

export const TouchAxisLock: Story = {
  args: { defaultValue: 50 },
  play: async ({ canvas, canvasElement, args }) => {
    const slider = canvas.getByRole('slider');
    const frame = part(canvasElement, 'image-compare-frame');
    await expect(getComputedStyle(frame).touchAction).toBe('pan-y');
    const pointer = pointerOn(frame, 'touch');
    // A mostly vertical swipe belongs to page scrolling: no capture, no request, no commit.
    pointer.fire('pointerdown', 0.3, 0.3);
    pointer.fire('pointermove', 0.31, 0.6);
    pointer.fire('pointermove', 0.6, 0.6);
    pointer.fire('pointerup', 0.6, 0.6);
    await expect(pointer.captured.size).toBe(0);
    await expect(slider).toHaveAttribute('aria-valuenow', '50');
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await expect(args.onValueCommit).not.toHaveBeenCalled();
    // Main-axis intent captures, then a cancel ends it without a commit.
    pointer.fire('pointerdown', 0.3, 0.3);
    pointer.fire('pointermove', 0.4, 0.31);
    await expect(pointer.captured.has(POINTER_ID)).toBe(true);
    await expect(slider).toHaveAttribute('aria-valuenow', '40');
    pointer.fire('pointercancel', 0.4, 0.31);
    await expect(pointer.captured.size).toBe(0);
    pointer.fire('pointermove', 0.9, 0.31);
    pointer.fire('pointerup', 0.9, 0.31);
    await expect(slider).toHaveAttribute('aria-valuenow', '40');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueCommit).not.toHaveBeenCalled();
  },
};

export const LostCaptureEndsDrag: Story = {
  args: { defaultValue: 50 },
  play: async ({ canvasElement, args }) => {
    const pointer = pointerOn(part(canvasElement, 'image-compare-frame'));
    pointer.fire('pointerdown', 0.5);
    pointer.fire('pointermove', 0.6);
    pointer.fire('lostpointercapture', 0.6);
    pointer.fire('pointermove', 0.9);
    pointer.fire('pointerup', 0.9);
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenCalledWith(60);
    await expect(args.onValueCommit).not.toHaveBeenCalled();
    await expect(part(canvasElement, 'image-compare-handle')).not.toHaveAttribute('data-dragging');
  },
};

export const ReleaseOutsideFrame: Story = {
  args: { defaultValue: 50 },
  play: async ({ canvas, canvasElement, args }) => {
    const slider = canvas.getByRole('slider');
    const frame = part(canvasElement, 'image-compare-frame');
    const outside = frame.ownerDocument.body;
    const pointer = pointerOn(frame);
    // Press near the edge, leave before the drag threshold, release outside: the gesture ends there.
    pointer.fire('pointerdown', 0.99);
    pointer.fire('pointerup', 1.2, 0.8, { target: outside });
    // Re-entering with the button up is hover, not a drag.
    pointer.fire('pointermove', 0.5);
    pointer.fire('pointermove', 0.3);
    await expect(pointer.captured.size).toBe(0);
    await expect(part(canvasElement, 'image-compare-handle')).not.toHaveAttribute('data-dragging');
    await expect(slider).toHaveAttribute('aria-valuenow', '50');
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await expect(args.onValueCommit).not.toHaveBeenCalled();
    // A fresh press is accepted.
    pointer.fire('pointerdown', 0.3);
    pointer.fire('pointerup', 0.3);
    await expect(slider).toHaveAttribute('aria-valuenow', '30');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueCommit).toHaveBeenCalledTimes(1);
    await expect(args.onValueCommit).toHaveBeenCalledWith(30);
    // An outside cancel ends a pending gesture the same way.
    pointer.fire('pointerdown', 0.99);
    pointer.fire('pointercancel', 1.2, 0.8, { target: outside });
    pointer.fire('pointermove', 0.6);
    pointer.fire('pointerup', 0.6);
    await expect(slider).toHaveAttribute('aria-valuenow', '30');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
  },
};

const preventPointerUp = fn((event: { preventDefault: () => void }) => event.preventDefault());
export const PreventedPointerUp: Story = {
  args: {
    defaultValue: 50,
    slotProps: { frame: { onPointerUp: preventPointerUp } },
  },
  play: async ({ canvas, canvasElement, args }) => {
    const slider = canvas.getByRole('slider');
    const handle = part(canvasElement, 'image-compare-handle');
    const pointer = pointerOn(part(canvasElement, 'image-compare-frame'));
    const vetoes = preventPointerUp.mock.calls.length;
    // A prevented tap requests and commits nothing.
    pointer.fire('pointerdown', 0.2);
    pointer.fire('pointerup', 0.2);
    await expect(slider).toHaveAttribute('aria-valuenow', '50');
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await expect(args.onValueCommit).not.toHaveBeenCalled();
    // A prevented drag release keeps the requests already made but does not commit.
    pointer.fire('pointerdown', 0.5);
    pointer.fire('pointermove', 0.7);
    await expect(pointer.captured.has(POINTER_ID)).toBe(true);
    pointer.fire('pointerup', 0.7);
    await expect(preventPointerUp).toHaveBeenCalledTimes(vetoes + 2);
    await expect(slider).toHaveAttribute('aria-valuenow', '70');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenCalledWith(70);
    await expect(args.onValueCommit).not.toHaveBeenCalled();
    // Ownership is released either way.
    await expect(pointer.captured.size).toBe(0);
    await expect(handle).not.toHaveAttribute('data-dragging');
    pointer.fire('pointermove', 0.9);
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
  },
};

export const ParentAcceptsDuringDrag: Story = {
  render: (args) => {
    const [value, setValue] = useState(40);
    return (
      <ImageCompare
        {...args}
        value={value}
        onValueChange={(next) => {
          args.onValueChange?.(next);
          // The parent accepts a different value than requested.
          setValue(Math.min(next, 60));
        }}
      />
    );
  },
  play: async ({ canvas, canvasElement, args }) => {
    const slider = canvas.getByRole('slider');
    const pointer = pointerOn(part(canvasElement, 'image-compare-frame'));
    pointer.fire('pointerdown', 0.4);
    pointer.fire('pointermove', 0.8);
    await expect(slider).toHaveAttribute('aria-valuenow', '60');
    await expect(Math.abs(dividerRatio(canvasElement) - 0.6)).toBeLessThan(0.01);
    pointer.fire('pointermove', 0.5);
    await expect(slider).toHaveAttribute('aria-valuenow', '50');
    pointer.fire('pointerup', 0.5);
    await expect(args.onValueChange).toHaveBeenCalledTimes(2);
    await expect(args.onValueCommit).toHaveBeenCalledTimes(1);
    await expect(args.onValueCommit).toHaveBeenCalledWith(50);
  },
};

export const ResizeDuringDrag: Story = {
  render: (args) => {
    const [wide, setWide] = useState(true);
    return (
      <>
        <button type="button" css={fixtureButtonStyle} onClick={() => setWide(false)}>
          Shrink
        </button>
        <div style={{ inlineSize: wide ? '32rem' : '16rem' }}>
          <ImageCompare {...args} />
        </div>
      </>
    );
  },
  play: async ({ canvas, canvasElement, args }) => {
    const frame = part(canvasElement, 'image-compare-frame');
    const pointer = pointerOn(frame);
    pointer.fire('pointerdown', 0.5);
    pointer.fire('pointermove', 0.25);
    await expect(canvas.getByRole('slider')).toHaveAttribute('aria-valuenow', '25');
    // A click event alone: the mouse is mid-drag, so no second press can happen.
    fireEvent.click(canvas.getByRole('button', { name: 'Shrink' }));
    await waitFor(() => expect(frame.getBoundingClientRect().width).toBeLessThan(300));
    // The same ratio of the new rect maps to the same value.
    pointer.fire('pointermove', 0.75);
    await expect(canvas.getByRole('slider')).toHaveAttribute('aria-valuenow', '75');
    await expect(Math.abs(dividerRatio(canvasElement) - 0.75)).toBeLessThan(0.02);
    pointer.fire('pointerup', 0.75);
    await expect(args.onValueCommit).toHaveBeenCalledWith(75);
  },
};

export const OrientationChangeDuringDrag: Story = {
  render: (args) => {
    const [vertical, setVertical] = useState(false);
    return (
      <ImageCompare
        {...args}
        orientation={vertical ? 'vertical' : 'horizontal'}
        onValueChange={(next) => {
          args.onValueChange?.(next);
          setVertical(true);
        }}
      />
    );
  },
  play: async ({ canvas, canvasElement, args }) => {
    const pointer = pointerOn(part(canvasElement, 'image-compare-frame'));
    pointer.fire('pointerdown', 0.5);
    pointer.fire('pointermove', 0.7);
    await expect(canvas.getByRole('slider')).toHaveAttribute('aria-orientation', 'vertical');
    await expect(pointer.captured.size).toBe(0);
    pointer.fire('pointermove', 0.9, 0.9);
    pointer.fire('pointerup', 0.9, 0.9);
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueCommit).not.toHaveBeenCalled();
    await expect(part(canvasElement, 'image-compare-handle')).not.toHaveAttribute('data-dragging');
  },
};

export const DisableDuringDrag: Story = {
  render: (args) => {
    const [disabled, setDisabled] = useState(false);
    return (
      <ImageCompare
        {...args}
        disabled={disabled}
        onValueChange={(next) => {
          args.onValueChange?.(next);
          setDisabled(true);
        }}
      />
    );
  },
  play: async ({ canvasElement, args }) => {
    const pointer = pointerOn(part(canvasElement, 'image-compare-frame'));
    pointer.fire('pointerdown', 0.5);
    pointer.fire('pointermove', 0.7);
    await expect(pointer.captured.size).toBe(0);
    pointer.fire('pointerup', 0.7);
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueCommit).not.toHaveBeenCalled();
  },
};

export const InteractiveDescendantIgnored: Story = {
  args: {
    after: (
      <div css={statusStyle}>
        <button type="button" css={fixtureButtonStyle}>
          Retry
        </button>
      </div>
    ),
  },
  play: async ({ canvas, canvasElement, args }) => {
    const pointer = pointerOn(part(canvasElement, 'image-compare-frame'));
    const retry = canvas.getByRole('button', { name: 'Retry' });
    const box = retry.getBoundingClientRect();
    const frame = part(canvasElement, 'image-compare-frame').getBoundingClientRect();
    const x = (box.left + box.width / 2 - frame.left) / frame.width;
    const y = (box.top + box.height / 2 - frame.top) / frame.height;
    pointer.fire('pointerdown', x, y, { target: retry });
    pointer.fire('pointerup', x, y, { target: retry });
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await expect(args.onValueCommit).not.toHaveBeenCalled();
  },
};

export const ImageLoading: Story = {
  args: {
    after: (
      <div role="status" css={statusStyle}>
        Loading graded landscape…
      </div>
    ),
  },
  play: async ({ canvas, userEvent }) => {
    await expect(canvas.getByRole('status')).toHaveTextContent('Loading graded landscape…');
    await userEvent.tab();
    await userEvent.keyboard('{ArrowLeft}');
    await expect(canvas.getByRole('slider')).toHaveAttribute('aria-valuenow', '49');
  },
};

function BrokenAfter() {
  const [failed, setFailed] = useState(false);
  return failed ? (
    <div role="alert" css={statusStyle}>
      Graded landscape failed to load
    </div>
  ) : (
    <img src={BROKEN_SRC} alt="Mountain landscape with a warm grade" onError={() => setFailed(true)} />
  );
}
export const ImageError: Story = {
  args: { after: <BrokenAfter /> },
  play: async ({ canvas, userEvent }) => {
    await expect(await canvas.findByRole('alert')).toHaveTextContent('Graded landscape failed to load');
    await userEvent.tab();
    await userEvent.keyboard('{End}');
    await expect(canvas.getByRole('slider')).toHaveAttribute('aria-valuenow', '100');
  },
};

export const Narrow: Story = {
  args: {
    labels: ['Original landscape before grading', 'Graded with warmer highlights'],
    resetLabel: 'Center the comparison divider between both images',
  },
  render: (args) => (
    <div css={narrowStyle}>
      <ImageCompare {...args} />
    </div>
  ),
  play: async ({ canvas, canvasElement }) => {
    const root = part(canvasElement, 'image-compare');
    const frame = part(canvasElement, 'image-compare-frame').getBoundingClientRect();
    await expect(root.scrollWidth - root.clientWidth).toBeLessThan(1.1);
    const reset = canvas.getByRole('button').getBoundingClientRect();
    await expect(reset.right).toBeLessThanOrEqual(root.getBoundingClientRect().right + 1.1);
    await expect(reset.height).toBeGreaterThanOrEqual(RESET_MIN_SIZE - 0.5);
    for (const name of ['image-compare-before-label', 'image-compare-after-label']) {
      const caption = part(canvasElement, name).getBoundingClientRect();
      await expect(caption.left).toBeGreaterThanOrEqual(frame.left - 1.1);
      await expect(caption.right).toBeLessThanOrEqual(frame.right + 1.1);
    }
  },
};

export const Dimensions: Story = {
  play: async ({ canvas }) => {
    const handle = canvas.getByRole('slider').getBoundingClientRect();
    await expect(Math.abs(handle.width - HANDLE_SIZE)).toBeLessThan(1.1);
    await expect(Math.abs(handle.height - HANDLE_SIZE)).toBeLessThan(1.1);
    const reset = canvas.getByRole('button', { name: 'Center divider' }).getBoundingClientRect();
    await expect(reset.height).toBeGreaterThanOrEqual(RESET_MIN_SIZE - 0.5);
  },
};

export const RTL: Story = {
  args: { dir: 'rtl', defaultValue: 30 },
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    const slider = canvas.getByRole('slider');
    // Before sits at inline-start, which is the right edge in RTL.
    await expect(Math.abs(dividerRatio(canvasElement) - 0.7)).toBeLessThan(0.01);
    await expect(layerAt(canvasElement, 0.9)).toBe('before');
    await expect(layerAt(canvasElement, 0.4)).toBe('after');
    await userEvent.tab();
    await userEvent.keyboard('{ArrowLeft}');
    await expect(slider).toHaveAttribute('aria-valuenow', '31');
    await userEvent.keyboard('{ArrowRight}{ArrowRight}');
    await expect(slider).toHaveAttribute('aria-valuenow', '29');
    await userEvent.keyboard('{ArrowUp}');
    await expect(slider).toHaveAttribute('aria-valuenow', '30');
    await userEvent.keyboard('{Home}');
    await expect(layerAt(canvasElement, 0.98)).toBe('after');
    const pointer = pointerOn(part(canvasElement, 'image-compare-frame'));
    pointer.fire('pointerdown', 0.25);
    pointer.fire('pointerup', 0.25);
    await expect(slider).toHaveAttribute('aria-valuenow', '75');
    await expect(args.onValueCommit).toHaveBeenLastCalledWith(75);
  },
};

export const Dark: Story = {};
export const LightTheme: Story = { decorators: [withLightTheme] };

export const ReducedMotion: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Structural check of the authored reduced-motion rule; it does not emulate the preference. Browser QA verifies the rendered handle.',
      },
    },
  },
  play: async ({ canvas }) => {
    const handle = canvas.getByRole('slider');
    await expect(mediaDeclarations(handle, 'prefers-reduced-motion')).toContainEqual(
      expect.objectContaining({ transitionDuration: '0s' }),
    );
  },
};

export const ForcedColors: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Structural check of the authored forced-colors rules; it does not emulate forced colors. Browser QA verifies the rendered frame and handle.',
      },
    },
  },
  play: async ({ canvas, canvasElement }) => {
    await expect(mediaDeclarations(canvas.getByRole('slider'), 'forced-colors')).toContainEqual(
      expect.objectContaining({ borderColor: 'canvastext', boxShadow: 'none' }),
    );
    await expect(mediaDeclarations(part(canvasElement, 'image-compare-divider'), 'forced-colors')).toContainEqual(
      expect.objectContaining({ backgroundColor: 'canvastext' }),
    );
  },
};

/** Declarations authored for `element` inside `@media` rules whose condition includes `feature`. */
function mediaDeclarations(element: Element, feature: string) {
  return Array.from(element.ownerDocument.styleSheets)
    .flatMap((sheet) => {
      try {
        return Array.from(sheet.cssRules);
      } catch {
        return [];
      }
    })
    .filter((rule): rule is CSSMediaRule => rule instanceof CSSMediaRule && rule.conditionText.includes(feature))
    .flatMap((rule) => Array.from(rule.cssRules))
    .filter((rule): rule is CSSStyleRule => rule instanceof CSSStyleRule && element.matches(rule.selectorText))
    .map((rule) => rule.style);
}

export const AriaMerge: Story = {
  args: {
    'aria-label': 'Wrapper name',
    slotProps: {
      handle: {
        'aria-labelledby': 'compare-heading missing-reference',
        'aria-describedby': 'compare-hint',
      },
    },
  },
  render: (args) => (
    <>
      <h2 id="compare-heading">Grading review</h2>
      <p id="compare-hint">Drag to compare</p>
      <ImageCompare {...args} role="group" />
    </>
  ),
  play: async ({ canvas, canvasElement }) => {
    const slider = canvas.getByRole('slider');
    await expect(slider).toHaveAttribute('aria-labelledby', 'compare-heading missing-reference');
    await expect(slider).toHaveAttribute('aria-label', 'Landscape grading comparison');
    await expect(slider).toHaveAccessibleName('Grading review');
    await expect(slider).toHaveAccessibleDescription('Drag to compare Before After');
    await expect(part(canvasElement, 'image-compare')).toHaveAttribute('aria-label', 'Wrapper name');
  },
};

export const UnresolvedLabelledBy: Story = {
  args: {
    slotProps: {
      handle: {
        'aria-labelledby': 'missing-reference',
        'aria-label': 'Handle name',
      },
    },
  },
  play: async ({ canvas }) => {
    const slider = canvas.getByRole('slider');
    await expect(slider).toHaveAttribute('aria-labelledby', 'missing-reference');
    await expect(slider).toHaveAccessibleName('Handle name');
  },
};

const falsyNodes: ReactNode[] = [false, null, 0, ''];
export const FalsyContent: Story = {
  render: (args) => (
    <>
      {falsyNodes.map((node, index) => (
        <ImageCompare
          {...args}
          key={index}
          before={node}
          after={node}
          labels={index % 2 === 0 ? false : ['', '']}
          label={`Comparison ${index}`}
        />
      ))}
    </>
  ),
  play: async ({ canvas, canvasElement }) => {
    const sliders = canvas.getAllByRole('slider');
    await expect(sliders).toHaveLength(falsyNodes.length);
    for (const slider of sliders) await expect(slider).not.toHaveAttribute('aria-describedby');
    await expect(canvasElement.querySelector('[data-ui$="-label"]')).toBeNull();
    const befores = canvasElement.querySelectorAll('[data-ui="image-compare-before"]');
    await expect(befores[0]).toBeEmptyDOMElement();
    await expect(befores[1]).toBeEmptyDOMElement();
    await expect(befores[2]).toHaveTextContent('0');
    await expect(befores[3]).toBeEmptyDOMElement();
  },
};

export const OutOfRangeValues: Story = {
  render: (args) => (
    <>
      <ImageCompare {...args} defaultValue={-20} label="Negative" />
      <ImageCompare {...args} value={140} label="Over" />
      <ImageCompare {...args} defaultValue={Number.NaN} label="Not a number" />
      <ImageCompare {...args} value={Number.POSITIVE_INFINITY} label="Infinite" />
    </>
  ),
  play: async ({ canvas, userEvent, args }) => {
    await expect(canvas.getByRole('slider', { name: 'Negative' })).toHaveAttribute('aria-valuenow', '0');
    await expect(canvas.getByRole('slider', { name: 'Over' })).toHaveAttribute('aria-valuenow', '100');
    await expect(canvas.getByRole('slider', { name: 'Not a number' })).toHaveAttribute('aria-valuenow', '50');
    await expect(canvas.getByRole('slider', { name: 'Infinite' })).toHaveAttribute('aria-valuenow', '50');
    // The clamped value is the accepted value: End on 100 is a no-op.
    canvas.getByRole('slider', { name: 'Over' }).focus();
    await userEvent.keyboard('{End}{ArrowUp}');
    await expect(args.onValueChange).not.toHaveBeenCalled();
  },
};

const rootRef = fn();
const handleRef = fn();
const frameRef = fn();
function ReplacementHandle(props: ComponentPropsWithRef<'div'>) {
  return <div {...props} data-slot="image-compare-handle" />;
}

export const SlotStylingAndRefs: Story = {
  render: (args) => <ImageCompare {...args} slots={{ handle: ReplacementHandle }} />,
  args: {
    ref: rootRef,
    sx: { paddingBlock: '7px' },
    slotProps: {
      frame: { ref: frameRef, css: { borderRadius: '3px' } },
      handle: { ref: handleRef, css: { borderRadius: vars.radius.sm } },
      divider: { css: { inlineSize: '6px' } },
      beforeLabel: { css: { letterSpacing: '2px' } },
      afterLabel: { css: { letterSpacing: '3px' } },
      resetButton: { variant: 'ghost', css: { letterSpacing: '1px' } },
    },
  },
  play: async ({ canvas, canvasElement }) => {
    const root = part(canvasElement, 'image-compare');
    const frame = part(canvasElement, 'image-compare-frame');
    const handle = canvas.getByRole('slider');
    await expect(handle).toHaveAttribute('data-slot', 'image-compare-handle');
    await expect(handle).toHaveAttribute('data-ui', 'image-compare-handle');
    await expect(handle).toHaveAttribute('aria-valuemin', '0');
    await expect(getComputedStyle(handle).display).toBe('grid');
    await expect(canvasElement.querySelector('[data-ui="image-compare-handle"]:not([data-slot])')).toBeNull();
    await expect(rootRef.mock.calls.at(-1)?.[0]).toBe(root);
    await expect(frameRef.mock.calls.at(-1)?.[0]).toBe(frame);
    await expect(handleRef.mock.calls.at(-1)?.[0]).toBe(handle);
    await expectPx(getComputedStyle(root).paddingBlockStart, 7);
    await expect(Math.abs(Number.parseFloat(getComputedStyle(frame).borderTopLeftRadius) - 3)).toBeLessThan(1.1);
    await expect(Math.abs(Number.parseFloat(getComputedStyle(handle).borderTopLeftRadius) - 8)).toBeLessThan(1.1);
    await expect(Math.abs(part(canvasElement, 'image-compare-divider').getBoundingClientRect().width - 6)).toBeLessThan(
      1.1,
    );
    await expectPx(getComputedStyle(part(canvasElement, 'image-compare-before-label')).letterSpacing, 2);
    await expectPx(getComputedStyle(part(canvasElement, 'image-compare-after-label')).letterSpacing, 3);
    await expectPx(getComputedStyle(canvas.getByRole('button')).letterSpacing, 1);
  },
};

export const PreventedHandlers: Story = {
  args: {
    defaultValue: 30,
    onKeyDown: (event) => {
      if (event.key === 'Home') event.preventDefault();
    },
    slotProps: {
      handle: {
        onKeyDown: (event) => {
          if (event.key === 'End') event.preventDefault();
        },
        onDoubleClick: (event) => event.preventDefault(),
      },
      frame: { onPointerDown: (event) => event.preventDefault() },
      resetButton: { onClick: (event) => event.preventDefault() },
    },
  },
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    const slider = canvas.getByRole('slider');
    await userEvent.tab();
    await userEvent.keyboard('{Home}{End}');
    await userEvent.dblClick(slider);
    await userEvent.click(canvas.getByRole('button', { name: 'Center divider' }));
    const pointer = pointerOn(part(canvasElement, 'image-compare-frame'));
    pointer.fire('pointerdown', 0.8);
    pointer.fire('pointerup', 0.8);
    await expect(slider).toHaveAttribute('aria-valuenow', '30');
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await expect(args.onValueCommit).not.toHaveBeenCalled();
    slider.focus();
    await userEvent.keyboard('{ArrowRight}');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
  },
};

export const WithoutReset: Story = {
  args: { showReset: false },
  play: async ({ canvas }) => {
    await expect(canvas.queryByRole('button')).toBeNull();
  },
};
