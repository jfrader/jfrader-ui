import { StrictMode, useEffect, useRef, useState } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fireEvent, fn, spyOn, waitFor, within } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { css } from '../../styling/css';
import { REDUCED_MOTION } from '../../styling/media';
import { expectEntranceMotion, expectRetainedExit, settleMotion } from '../../testing/motion-assertions';
import { withLightTheme } from '../../testing/story-decorators';
import { Button } from '../button';
import { LightboxGallery, type LightboxGalleryImage } from './index';

const source = (width: number, height: number, seed: number) =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.006" numOctaves="3" seed="${seed}"/></filter><rect width="100%" height="100%" filter="url(#n)"/></svg>`,
  )}`;
const images: LightboxGalleryImage[] = [
  {
    id: 'coast',
    width: 800,
    height: 500,
    alt: 'Coastal cliffs',
    title: 'Coast',
    caption: 'The north shore.',
  },
  {
    id: 'forest',
    width: 500,
    height: 750,
    alt: 'Tall forest trees',
    title: 'Forest',
    caption: 'An afternoon walk.',
  },
  { id: 'lake', width: 600, height: 600, alt: 'Still lake water', title: 'Lake', caption: 'Before sunrise.' },
  { id: 'ridge', width: 900, height: 400, alt: 'Mountain ridge', title: 'Ridge' },
].map((image, index) => ({ ...image, src: source(image.width, image.height, index + 1) }));
const frameStyle = css({
  inlineSize: '48rem',
  maxInlineSize: '100%',
  boxSizing: 'border-box',
  padding: vars.space[4],
});
const narrowStyle = css({ inlineSize: '8rem', maxInlineSize: '100%' });
const meta = {
  title: 'Data display/LightboxGallery',
  component: LightboxGallery,
  tags: ['autodocs'],
  args: { images, label: 'Trip photos', locale: 'en-GB', onValueChange: fn(), onOpenChange: fn() },
  decorators: [
    (Story) => (
      <div css={frameStyle}>
        <Story />
      </div>
    ),
  ],
  parameters: {
    docs: {
      source: { code: '<LightboxGallery images={photos} label="Trip photos" minColumnWidth={180} />' },
      description: {
        component: 'Browse an image gallery, open a photo, and zoom or move through the collection.',
      },
      usage: `- Images appear in a row-major masonry list and open in a full-screen native dialog. Supply unique IDs, meaningful alt text and positive intrinsic dimensions. \`srcSet\` and \`sizes\` are supported. Paginate large collections; there is no virtualization or image-provider integration.
- Selection (\`value/defaultValue/onValueChange\`) and visibility (\`open/defaultOpen/onOpenChange\`) are independent. Controlled requests take effect only when accepted. \`null\` means no selection; an invalid ID shows an unavailable state without opening a modal. Navigation stops at each end.

### Keyboard and gestures
- Tab follows launcher reading order. Left/Right select in the effective direction; Home/End select endpoints. Plus/minus zoom; 0 resets. When zoomed, arrows pan.
- Swipe selects, downward drag closes, pinch and Ctrl+wheel zoom, double-click toggles zoom, and zoomed drag pans. Buttons provide alternatives to every gesture.
- Escape closes even when zoomed and returns focus to the original launcher.

### Dialog and accessibility
- Native \`showModal\` contains focus and locks scrolling. Close uses \`requestClose\` with cancel veto where supported. Older engines use a state-close fallback without dispatching cancel. Native close and form closure update visibility.
- Viewer ARIA merges external IDs with the title/caption. Set \`viewer.withDescription=false\` to exclude structured captions. Keep floating children inside the dialog subtree.
- Motion respects reduced motion. Forced-colors and ReducedMotion stories require browser media emulation to check rendering. Test screen readers and multi-touch devices manually.`,
    },
  },
} satisfies Meta<typeof LightboxGallery>;
export default meta;
type Story = StoryObj<typeof LightboxGallery>;

const tiles = (element: HTMLElement) =>
  Array.from(element.querySelectorAll<HTMLButtonElement>('[data-ui="lightbox-gallery-tile"]'));
const viewer = (element: HTMLElement) => element.querySelector<HTMLDialogElement>('dialog')!;
const stage = (element: HTMLElement) =>
  element.querySelector<HTMLDivElement>('[data-ui="lightbox-gallery-stage"]')!;
async function focusVisible(element: HTMLElement) {
  await expect(element.ownerDocument.activeElement).toBe(element);
  await expect(getComputedStyle(element).outlineStyle).not.toBe('none');
  await expect(Math.abs(Number.parseFloat(getComputedStyle(element).outlineWidth) - 2)).toBeLessThan(1.1);
}
async function current(element: HTMLElement, alt: string) {
  const dialog = viewer(element);
  const image = await within(dialog).findByRole('img', { name: alt });
  await waitFor(async () => {
    await expect(image).toBeVisible();
    await expect(image).toHaveAttribute('data-image-state', 'loaded');
  });
  await expect(within(dialog).getAllByRole('img')).toHaveLength(1);
}
const imageLayer = (element: HTMLElement) => stage(element).firstElementChild as HTMLElement;
/** Persistent-open fixtures: the axe gate and visibility checks read the settled entrance. */
const settled: Story['play'] = async ({ canvasElement }) => {
  await settleMotion(viewer(canvasElement));
};
function cancel(dialog: HTMLDialogElement) {
  fireEvent(dialog, new Event('cancel', { cancelable: true }));
}

export const DefaultMixedRatios: Story = {
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.getByRole('region', { name: 'Trip photos' })).toBeInTheDocument();
    await expect(canvas.getByRole('list')).toBeInTheDocument();
    await expect(tiles(canvasElement)).toHaveLength(4);
    await waitFor(async () => {
      await expect(canvasElement.querySelector('[data-ui="lightbox-gallery"]')).toHaveAttribute(
        'data-columns',
        '4',
      );
    });
    for (const [index, tile] of tiles(canvasElement).entries()) {
      await expect(tile).toHaveAccessibleName(`${images[index]!.title}, ${index + 1} / 4, Open image`);
      const box = tile.getBoundingClientRect();
      await expect(box.width).toBeGreaterThanOrEqual(32 - 1.1);
      await expect(box.height).toBeGreaterThanOrEqual(32 - 1.1);
      await expect(
        Math.abs(box.height - (box.width * images[index]!.height) / images[index]!.width),
      ).toBeLessThan(10);
    }
  },
};
export const TitlesCaptions: Story = {
  // Excluded from the docs page: its open overlay (modal/backdrop) covers the documentation.
  tags: ['!autodocs'],
  args: { defaultOpen: true },
  play: settled,
};
export const PersistentViewer: Story = {
  // Excluded from the docs page: its open overlay (modal/backdrop) covers the documentation.
  tags: ['!autodocs'],
  args: { defaultOpen: true, defaultValue: 'forest' },
  play: async ({ canvas, canvasElement }) => {
    await expect(await canvas.findByRole('dialog', { name: 'Trip photos — Forest' })).toBeVisible();
    await current(canvasElement, 'Tall forest trees');
    await expect(within(viewer(canvasElement)).getByRole('status')).toHaveTextContent('2 / 4');
    await expect(
      within(viewer(canvasElement)).getByRole('button', { name: 'Forest, 2 / 4' }),
    ).toHaveAttribute('aria-current', 'true');
  },
};
export const PersistentZoomed: Story = {
  // Excluded from the docs page: its open overlay (modal/backdrop) covers the documentation.
  tags: ['!autodocs'],
  args: { defaultOpen: true },
  play: async ({ canvas, canvasElement, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: 'Toggle zoom' }));
    await expect(stage(canvasElement)).toHaveAttribute('data-zoom', '2');
    await expect(canvas.getByRole('button', { name: 'Toggle zoom' })).toHaveAttribute('aria-pressed', 'true');
    for (const name of ['Pan left', 'Pan right', 'Pan up', 'Pan down'])
      await expect(canvas.getByRole('button', { name })).toBeEnabled();
  },
};
export const SingleImage: Story = {
  // Excluded from the docs page: its open overlay (modal/backdrop) covers the documentation.
  tags: ['!autodocs'],
  args: { images: images.slice(0, 1), defaultOpen: true },
  play: async ({ canvas, canvasElement, args, userEvent }) => {
    await expect(await canvas.findByRole('button', { name: 'Previous image' })).toBeDisabled();
    await expect(canvas.getByRole('button', { name: 'Next image' })).toBeDisabled();
    await userEvent.click(canvas.getByRole('button', { name: 'Coast, 1 / 1' }));
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await current(canvasElement, 'Coastal cliffs');
  },
};
export const Empty: Story = {
  args: { images: [], value: 'unseen', open: true },
  play: async ({ canvas, canvasElement, args }) => {
    await expect(canvas.getByText('No images')).toBeVisible();
    await expect(canvas.queryByRole('button')).not.toBeInTheDocument();
    await expect(viewer(canvasElement)).not.toHaveAttribute('open');
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await expect(args.onOpenChange).not.toHaveBeenCalled();
  },
};
export const MissingImage: Story = {
  args: { images: [{ ...images[0]!, src: 'data:image/png;base64,broken' }] },
  play: async ({ canvasElement }) => {
    await waitFor(async () => {
      await expect(tiles(canvasElement)[0]!.querySelector('[data-image-state="error"]')).toBeInTheDocument();
    });
  },
};
export const PersistentImageError: Story = {
  // Excluded from the docs page: its open overlay (modal/backdrop) covers the documentation.
  tags: ['!autodocs'],
  args: { images: [{ ...images[0]!, src: '' }], defaultOpen: true },
  play: async ({ canvas, canvasElement }) => {
    await expect(await canvas.findByRole('dialog')).toBeVisible();
    await settleMotion(viewer(canvasElement));
    await expect(within(stage(canvasElement)).getByText('Image unavailable')).toBeVisible();
  },
};
export const NarrowOneColumn: Story = {
  render: (args) => (
    <div css={narrowStyle}>
      <LightboxGallery {...args} />
    </div>
  ),
  play: async ({ canvas, canvasElement, userEvent }) => {
    await expect(canvas.getByRole('region')).toHaveAttribute('data-columns', '1');
    await userEvent.click(tiles(canvasElement)[1]!);
    const dialog = await canvas.findByRole('dialog');
    for (const button of within(dialog).getAllByRole('button')) {
      await expect(button.getBoundingClientRect().height).toBeGreaterThanOrEqual(32 - 1.1);
      await expect(button.getBoundingClientRect().width).toBeGreaterThanOrEqual(24 - 1.1);
    }
  },
};
export const ResponsiveSources: Story = {
  args: {
    images: images.map((image) => ({
      ...image,
      srcSet: `${image.src} 800w`,
      sizes: '(max-width: 600px) 100vw, 50vw',
    })),
  },
  play: async ({ canvasElement }) => {
    await expect(tiles(canvasElement)[0]!.querySelector('img')).toHaveAttribute(
      'sizes',
      '(max-width: 600px) 100vw, 50vw',
    );
  },
};
export const Light: Story = {
  // Excluded from the docs page: its open overlay (modal/backdrop) covers the documentation.
  tags: ['!autodocs'],
  decorators: [withLightTheme],
  globals: { theme: 'light' },
  args: { defaultOpen: true },
  play: settled,
};
export const ReducedMotion: Story = {
  // Excluded from the docs page: its open overlay (modal/backdrop) covers the documentation.
  tags: ['!autodocs'],
  args: { defaultOpen: true },
  parameters: {
    docs: {
      description: {
        story:
          'Structural fixture. Enable prefers-reduced-motion in the browser to inspect the instant motion path.',
      },
    },
  },
  play: settled,
};
export const ForcedColors: Story = {
  // Excluded from the docs page: its open overlay (modal/backdrop) covers the documentation.
  tags: ['!autodocs'],
  args: { defaultOpen: true },
  parameters: {
    docs: {
      description: {
        story:
          'Structural fixture. Enable forced colors in the browser to inspect borders and the current-thumbnail outline.',
      },
    },
  },
  play: settled,
};
async function playMotionFromTile({ canvas, canvasElement, userEvent }: Parameters<NonNullable<Story['play']>>[0]) {
  const invoker = tiles(canvasElement)[1]!;
  await userEvent.click(invoker);
  const dialog = viewer(canvasElement);
  const header = (await canvas.findByRole('heading', { name: 'Trip photos — Forest' })).parentElement!;
  await expectEntranceMotion(header);
  await current(canvasElement, 'Tall forest trees');

  await userEvent.click(within(dialog).getByRole('button', { name: 'Close viewer' }));
  await expect(dialog).toHaveAttribute('data-state', 'closing');
  // The image flies home after the native close, so it stays put while the chrome fades.
  await expect(imageLayer(canvasElement)).toHaveAttribute('data-exit', 'home');
  await expectRetainedExit(header, () => !dialog.hasAttribute('open'));
  await expect(invoker.ownerDocument.activeElement).toBe(invoker);
}
export const Motion: Story = { tags: ['!autodocs'], play: playMotionFromTile };
export const MotionLight: Story = {
  tags: ['!autodocs'],
  decorators: [withLightTheme],
  globals: { theme: 'light' },
  play: playMotionFromTile,
};
export const MotionWithoutLauncher: Story = {
  tags: ['!autodocs'],
  args: { defaultOpen: true },
  play: async ({ canvasElement, args, userEvent }) => {
    const dialog = viewer(canvasElement);
    await expectEntranceMotion(imageLayer(canvasElement));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Close viewer' }));
    // No launcher to fly home to: the image fades out with the viewer.
    const layer = imageLayer(canvasElement);
    await expect(layer).toHaveAttribute('data-exit', 'fade');
    await expectRetainedExit(layer, () => !dialog.hasAttribute('open'));
    await expect(args.onOpenChange).toHaveBeenCalledTimes(1);
  },
};
export const RTL: Story = {
  args: { dir: 'rtl', defaultValue: 'forest' },
  play: async ({ canvasElement, args, userEvent }) => {
    await userEvent.click(tiles(canvasElement)[1]!);
    await userEvent.tab();
    await focusVisible(stage(canvasElement));
    await userEvent.keyboard('{ArrowLeft}');
    await current(canvasElement, 'Still lake water');
    await expect(args.onValueChange).toHaveBeenLastCalledWith('lake');
    await userEvent.keyboard('{ArrowRight}');
    await current(canvasElement, 'Tall forest trees');
    await expect(args.onValueChange).toHaveBeenCalledTimes(2);
  },
};
export const KeyboardPlay: Story = {
  play: async ({ canvas, canvasElement, args, userEvent }) => {
    const invoker = tiles(canvasElement)[1]!;
    await userEvent.tab();
    await userEvent.tab();
    await focusVisible(invoker);
    await userEvent.keyboard('{Enter}');
    const dialog = await canvas.findByRole('dialog');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith('forest');
    await expect(args.onOpenChange).toHaveBeenCalledTimes(1);
    await expect(args.onOpenChange).toHaveBeenLastCalledWith(true);
    await expect((args.onValueChange as ReturnType<typeof fn>).mock.invocationCallOrder[0]).toBeLessThan(
      (args.onOpenChange as ReturnType<typeof fn>).mock.invocationCallOrder[0]!,
    );
    await focusVisible(canvas.getByRole('button', { name: 'Close viewer' }));
    await userEvent.tab();
    await focusVisible(stage(canvasElement));
    await userEvent.keyboard('{ArrowLeft}');
    await current(canvasElement, 'Coastal cliffs');
    await expect(canvas.getByRole('button', { name: 'Previous image' })).toBeDisabled();
    await userEvent.keyboard('{ArrowLeft}');
    await expect(args.onValueChange).toHaveBeenCalledTimes(2);
    await userEvent.keyboard('{End}');
    await current(canvasElement, 'Mountain ridge');
    await expect(canvas.getByRole('button', { name: 'Next image' })).toBeDisabled();
    await userEvent.keyboard('{ArrowRight}');
    await expect(args.onValueChange).toHaveBeenCalledTimes(3);
    await userEvent.keyboard('{Home}');
    await current(canvasElement, 'Coastal cliffs');
    await userEvent.keyboard('{ArrowRight}');
    await current(canvasElement, 'Tall forest trees');
    await userEvent.keyboard('+');
    await expect(stage(canvasElement)).toHaveAttribute('data-zoom', '1.5');
    await userEvent.keyboard('{ArrowLeft}{ArrowRight}{ArrowUp}{ArrowDown}');
    await expect(args.onValueChange).toHaveBeenCalledTimes(5);
    await userEvent.keyboard('-');
    await expect(stage(canvasElement)).toHaveAttribute('data-zoom', '1');
    await userEvent.keyboard('+0');
    await expect(stage(canvasElement)).toHaveAttribute('data-zoom', '1');
    await userEvent.click(canvas.getByRole('button', { name: 'Toggle zoom' }));
    await userEvent.keyboard(' ');
    await expect(stage(canvasElement)).toHaveAttribute('data-zoom', '1');
    await userEvent.click(canvas.getByRole('button', { name: 'Zoom in' }));
    await userEvent.keyboard('{Escape}');
    cancel(viewer(canvasElement));
    await waitFor(async () => {
      await expect(dialog).not.toHaveAttribute('open');
    });
    await expect(invoker.ownerDocument.activeElement).toBe(invoker);
    await expect(args.onOpenChange).toHaveBeenCalledTimes(2);
    await expect(args.onOpenChange).toHaveBeenLastCalledWith(false);
  },
};
export const Controlled: Story = {
  render: (args) => {
    const [value, setValue] = useState<string | null>('coast');
    const [open, setOpen] = useState(false);
    return (
      <LightboxGallery
        {...args}
        value={value}
        open={open}
        onValueChange={(next) => {
          args.onValueChange?.(next);
          setValue(next);
        }}
        onOpenChange={(next) => {
          args.onOpenChange?.(next);
          setOpen(next);
        }}
      />
    );
  },
  play: async ({ canvas, canvasElement, args, userEvent }) => {
    await userEvent.click(tiles(canvasElement)[1]!);
    await current(canvasElement, 'Tall forest trees');
    await userEvent.click(canvas.getByRole('button', { name: 'Next image' }));
    await current(canvasElement, 'Still lake water');
    await userEvent.click(canvas.getByRole('button', { name: 'Previous image' }));
    await current(canvasElement, 'Tall forest trees');
    await expect(args.onValueChange).toHaveBeenCalledTimes(3);
    await userEvent.click(canvas.getByRole('button', { name: 'Close viewer' }));
    await waitFor(async () => {
      await expect(viewer(canvasElement)).not.toHaveAttribute('open');
    });
    await expect(args.onOpenChange).toHaveBeenCalledTimes(2);
  },
};
export const ControlledRejected: Story = {
  args: { value: 'coast', open: false },
  play: async ({ canvasElement, args, userEvent }) => {
    await userEvent.click(tiles(canvasElement)[1]!);
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith('forest');
    await expect(args.onOpenChange).toHaveBeenCalledTimes(1);
    await expect(args.onOpenChange).toHaveBeenLastCalledWith(true);
    await expect(viewer(canvasElement)).not.toHaveAttribute('open');
    await expect(tiles(canvasElement)[1]).toHaveAttribute('aria-expanded', 'false');
  },
};
export const RejectedSelection: Story = {
  args: { value: 'coast' },
  play: async ({ canvasElement, args, userEvent }) => {
    await userEvent.click(tiles(canvasElement)[1]!);
    await expect(viewer(canvasElement)).not.toHaveAttribute('open');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onOpenChange).toHaveBeenCalledTimes(1);
    await userEvent.click(tiles(canvasElement)[0]!);
    await current(canvasElement, 'Coastal cliffs');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onOpenChange).toHaveBeenCalledTimes(1);
  },
};
export const RejectedNavigation: Story = {
  // Excluded from the docs page: its open overlay (modal/backdrop) covers the documentation.
  tags: ['!autodocs'],
  args: { value: 'forest', open: true },
  play: async ({ canvas, canvasElement, args, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: 'Next image' }));
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith('lake');
    await current(canvasElement, 'Tall forest trees');
    await userEvent.click(canvas.getByRole('button', { name: 'Previous image' }));
    await expect(args.onValueChange).toHaveBeenCalledTimes(2);
    await expect(args.onValueChange).toHaveBeenLastCalledWith('coast');
    await current(canvasElement, 'Tall forest trees');
  },
};
export const InvalidSelection: Story = {
  args: { value: 'unseen', open: true },
  play: async ({ canvas, canvasElement, args }) => {
    await expect(canvas.getByRole('status')).toHaveTextContent('Image unavailable');
    await expect(viewer(canvasElement)).not.toHaveAttribute('open');
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await expect(args.onOpenChange).not.toHaveBeenCalled();
  },
};
export const NullSelection: Story = { ...InvalidSelection, args: { value: null, open: true } };
export const ExternalAcceptedChanges: Story = {
  // Excluded from the docs page: its open overlay (modal/backdrop) covers the documentation.
  tags: ['!autodocs'],
  args: { defaultOpen: true },
  render: (args) => {
    const [value, setValue] = useState<string | null>('coast');
    return (
      <LightboxGallery
        {...args}
        value={value}
        slotProps={{ controls: { onClick: () => setValue('lake') } }}
      />
    );
  },
  play: async ({ canvas, canvasElement, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: 'Zoom in' }));
    await current(canvasElement, 'Still lake water');
    await expect(stage(canvasElement)).toHaveAttribute('data-zoom', '1');
  },
};
export const ExternalAria: Story = {
  // Excluded from the docs page: its open overlay (modal/backdrop) covers the documentation.
  tags: ['!autodocs'],
  args: {
    defaultOpen: true,
    'aria-label': 'Consumer region',
    'aria-labelledby': 'external-name',
    'aria-describedby': 'external-description',
    slotProps: {
      viewer: {
        'aria-label': 'Consumer viewer',
        'aria-labelledby': 'external-name unresolved',
        'aria-describedby': 'external-description',
      },
    },
  },
  render: (args) => (
    <>
      <p id="external-name">External gallery</p>
      <p id="external-description">External description</p>
      <LightboxGallery {...args} />
    </>
  ),
  play: async ({ canvasElement }) => {
    await waitFor(async () => {
      await expect(viewer(canvasElement)).toHaveAttribute('open');
    });
    const dialog = viewer(canvasElement);
    const title = dialog.querySelector('h2')!;
    const caption = within(dialog).getByText('The north shore.');
    await expect(dialog).toHaveAttribute('aria-label', 'Consumer viewer');
    await expect(dialog).toHaveAttribute('aria-labelledby', `external-name unresolved ${title.id}`);
    await expect(dialog).toHaveAttribute('aria-describedby', `external-description ${caption.id}`);
    const region = canvasElement.querySelector('[data-ui="lightbox-gallery"]')!;
    await expect(region).toHaveAttribute('aria-label', 'Consumer region');
    await expect(region).toHaveAttribute('aria-labelledby', 'external-name');
    await expect(region).toHaveAttribute('aria-describedby', 'external-description');
  },
};
export const DescriptionOptOut: Story = {
  // Excluded from the docs page: its open overlay (modal/backdrop) covers the documentation.
  tags: ['!autodocs'],
  args: {
    defaultOpen: true,
    slotProps: { viewer: { withDescription: false, 'aria-describedby': 'external-description' } },
  },
  render: (args) => (
    <>
      <p id="external-description">External description</p>
      <LightboxGallery {...args} />
    </>
  ),
  play: async ({ canvasElement }) => {
    await expect(viewer(canvasElement)).toHaveAttribute('aria-describedby', 'external-description');
  },
};
export const FalsyCaptions: Story = {
  // Excluded from the docs page: its open overlay (modal/backdrop) covers the documentation.
  tags: ['!autodocs'],
  args: {
    images: [false, null, 0, ''].map((caption, index) => ({ ...images[index]!, caption })),
    defaultOpen: true,
  },
  play: async ({ canvas, canvasElement, userEvent }) => {
    const dialog = await canvas.findByRole('dialog');
    await expect(dialog).not.toHaveAttribute('aria-describedby');
    await userEvent.click(canvas.getByRole('button', { name: 'Next image' }));
    await expect(dialog).not.toHaveAttribute('aria-describedby');
    await userEvent.click(canvas.getByRole('button', { name: 'Next image' }));
    // A caption that appears with a new image fades in with the rest of the chrome.
    await waitFor(() => expect(within(dialog).getByText('0', { selector: 'p' })).toBeVisible());
    await expect(dialog.getAttribute('aria-describedby')).toBeTruthy();
    await userEvent.click(canvas.getByRole('button', { name: 'Next image' }));
    await expect(dialog).not.toHaveAttribute('aria-describedby');
    await expect(stage(canvasElement)).toHaveAttribute('data-zoom', '1');
  },
};
export const MultipleInstances: Story = {
  render: (args) => (
    <>
      <LightboxGallery {...args} label="First gallery" />
      <LightboxGallery {...args} label="Second gallery" />
    </>
  ),
  play: async ({ canvasElement }) => {
    const ids = Array.from(canvasElement.querySelectorAll('dialog h2')).map((title) => title.id);
    await expect(new Set(ids).size).toBe(2);
  },
};
export const NativeLifecycle: Story = {
  args: { slotProps: { viewer: { onCancel: fn(), onClose: fn() } } },
  play: async ({ canvas, canvasElement, args, userEvent }) => {
    await userEvent.click(tiles(canvasElement)[1]!);
    const dialog = (await canvas.findByRole('dialog')) as HTMLDialogElement;
    const child = dialog.ownerDocument.createElement('dialog');
    dialog.append(child);
    fireEvent(child, new Event('cancel', { bubbles: true, cancelable: true }));
    fireEvent(child, new Event('close', { bubbles: true }));
    child.remove();
    await expect(args.onOpenChange).toHaveBeenCalledTimes(1);
    await expect(args.slotProps!.viewer!.onCancel).not.toHaveBeenCalled();
    dialog.close();
    await waitFor(async () => {
      await expect(args.onOpenChange).toHaveBeenCalledTimes(2);
    });
    await expect(args.slotProps!.viewer!.onClose).toHaveBeenCalledTimes(1);
    await expect(tiles(canvasElement)[1]!.ownerDocument.activeElement).toBe(tiles(canvasElement)[1]);
    await userEvent.click(tiles(canvasElement)[0]!);
    const form = dialog.ownerDocument.createElement('form');
    form.method = 'dialog';
    const submit = dialog.ownerDocument.createElement('button');
    submit.textContent = 'Finish';
    submit.style.minHeight = '32px';
    submit.style.minWidth = '32px';
    form.append(submit);
    dialog.append(form);
    await userEvent.click(submit);
    form.remove();
    await waitFor(async () => {
      await expect(args.onOpenChange).toHaveBeenCalledTimes(4);
    });
    await expect(dialog).not.toHaveAttribute('open');
  },
};
export const CancelVeto: Story = {
  // Excluded from the docs page: its open overlay (modal/backdrop) covers the documentation.
  tags: ['!autodocs'],
  args: { defaultOpen: true, slotProps: { viewer: { onCancel: fn((event) => event.preventDefault()) } } },
  play: async ({ canvas, canvasElement, args, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: 'Close viewer' }));
    await expect(viewer(canvasElement)).toHaveAttribute('open');
    await expect(args.onOpenChange).not.toHaveBeenCalled();
    await expect(args.slotProps!.viewer!.onCancel).toHaveBeenCalledTimes(1);
  },
};
export const RejectedNativeCloseRepair: Story = {
  // Excluded from the docs page: its open overlay (modal/backdrop) covers the documentation.
  tags: ['!autodocs'],
  args: { value: 'coast', open: true },
  play: async ({ canvas, canvasElement, args, userEvent }) => {
    const dialog = (await canvas.findByRole('dialog')) as HTMLDialogElement;
    dialog.close();
    await waitFor(async () => {
      await expect(args.onOpenChange).toHaveBeenCalledTimes(1);
    });
    await expect(args.onOpenChange).toHaveBeenLastCalledWith(false);
    await userEvent.click(tiles(canvasElement)[0]!);
    await waitFor(async () => {
      await expect(dialog).toHaveAttribute('open');
    });
    await expect(args.onOpenChange).toHaveBeenCalledTimes(1);
  },
};
export const StrictModeRefs: Story = {
  args: { ref: fn(), slotProps: { viewer: { ref: fn() } } },
  render: (args) => (
    <StrictMode>
      <LightboxGallery {...args} />
    </StrictMode>
  ),
  play: async ({ canvasElement, args }) => {
    const root = canvasElement.querySelector('[data-ui="lightbox-gallery"]');
    await expect(args.ref).toHaveBeenCalledWith(root);
    await expect(args.slotProps!.viewer!.ref).toHaveBeenCalledWith(viewer(canvasElement));
  },
};
export const UnmountReturn: Story = {
  render: (args) => {
    const [shown, setShown] = useState(true);
    return (
      <>
        <Button onClick={() => setShown(true)}>Restore gallery</Button>
        {shown && <LightboxGallery {...args} slotProps={{ controls: { onClick: () => setShown(false) } }} />}
      </>
    );
  },
  play: async ({ canvas, canvasElement, userEvent }) => {
    await userEvent.click(tiles(canvasElement)[0]!);
    await userEvent.click(await canvas.findByRole('button', { name: 'Zoom in' }));
    await expect(canvas.queryByRole('dialog')).not.toBeInTheDocument();
  },
};
export const SlotStyles: Story = {
  // Excluded from the docs page: its open overlay (modal/backdrop) covers the documentation.
  tags: ['!autodocs'],
  args: {
    defaultOpen: true,
    slotProps: {
      viewer: { css: css({ borderStyle: 'dashed' }) },
      controls: { css: css({ gap: vars.space[6] }) },
      title: { css: css({ fontStyle: 'italic' }) },
      caption: { css: css({ fontWeight: vars.fontWeight.semibold }) },
    },
  },
  play: async ({ canvas, canvasElement }) => {
    const dialog = await canvas.findByRole('dialog');
    await expect(getComputedStyle(dialog).borderStyle).toBe('dashed');
    await expect(getComputedStyle(dialog.querySelector('h2')!).fontStyle).toBe('italic');
    await expect(getComputedStyle(within(dialog).getByText('The north shore.')).fontWeight).toBe('600');
    await expect(getComputedStyle(stage(canvasElement)).outlineStyle).not.toBe('hidden');
  },
};
export const LocalizedContent: Story = {
  // Excluded from the docs page: its open overlay (modal/backdrop) covers the documentation.
  tags: ['!autodocs'],
  args: {
    defaultOpen: true,
    locale: 'ar-EG',
    labels: {
      next: 'Go to the next photograph in this collection',
      position: (position, total) => `Photograph ${position} from a collection of ${total}`,
    },
  },
  play: async ({ canvas }) => {
    const button = await canvas.findByRole('button', {
      name: 'Go to the next photograph in this collection',
    });
    await expect(button.scrollWidth).toBeLessThanOrEqual(button.clientWidth + 1.1);
    await expect(canvas.getByRole('status')).toHaveTextContent('Photograph ١ from a collection of ٤');
  },
};
export const GestureAlternatives: Story = {
  // Excluded from the docs page: its open overlay (modal/backdrop) covers the documentation.
  tags: ['!autodocs'],
  args: { defaultOpen: true, maxZoom: 2, slotProps: { stage: { onClick: fn() } } },
  play: async ({ canvas, canvasElement, args, userEvent }) => {
    await canvas.findByRole('dialog');
    const surface = stage(canvasElement);
    const capture = spyOn(surface, 'setPointerCapture').mockImplementation(() => {});
    const box = surface.getBoundingClientRect();
    fireEvent.pointerDown(surface, { pointerId: 1, button: 0, clientX: box.width * 0.8, clientY: 100 });
    fireEvent.pointerMove(surface, { pointerId: 1, clientX: box.width * 0.1, clientY: 100 });
    fireEvent.pointerUp(surface, { pointerId: 1, clientX: box.width * 0.1, clientY: 100 });
    fireEvent.click(surface);
    await expect(args.slotProps!.stage!.onClick).not.toHaveBeenCalled();
    await current(canvasElement, 'Tall forest trees');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await userEvent.click(canvas.getByRole('button', { name: 'Toggle zoom' }));
    await expect(surface).toHaveAttribute('data-zoom', '2');
    await expect(canvas.getByRole('button', { name: 'Zoom in' })).toBeDisabled();
    await userEvent.click(canvas.getByRole('button', { name: 'Pan right' }));
    fireEvent.pointerDown(surface, { pointerId: 2, button: 0, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(surface, { pointerId: 2, clientX: 2000, clientY: 2000 });
    fireEvent.pointerCancel(surface, { pointerId: 2 });
    await expect(surface).toHaveAttribute('data-zoom', '2');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await userEvent.click(canvas.getByRole('button', { name: 'Reset zoom' }));
    fireEvent.pointerDown(surface, { pointerId: 3, button: 0, clientX: 100, clientY: 100 });
    fireEvent.pointerDown(surface, { pointerId: 4, button: 0, clientX: 200, clientY: 100 });
    fireEvent.pointerMove(surface, { pointerId: 4, clientX: 400, clientY: 100 });
    fireEvent.pointerUp(surface, { pointerId: 4, clientX: 400, clientY: 100 });
    fireEvent.pointerUp(surface, { pointerId: 3, clientX: 100, clientY: 100 });
    await expect(surface).toHaveAttribute('data-zoom', '2');
    await userEvent.click(canvas.getByRole('button', { name: 'Reset zoom' }));
    const ordinary = new WheelEvent('wheel', { deltaY: 100, bubbles: true, cancelable: true });
    surface.dispatchEvent(ordinary);
    await expect(ordinary.defaultPrevented).toBe(false);
    fireEvent.wheel(surface, { deltaY: -1000, ctrlKey: true, cancelable: true });
    await expect(surface).toHaveAttribute('data-zoom', '2');
    await userEvent.dblClick(surface);
    await expect(surface).toHaveAttribute('data-zoom', '1');
    capture.mockRestore();
  },
};

export const FailedShowModal: Story = {
  play: async ({ canvasElement, args, userEvent }) => {
    const dialog = viewer(canvasElement);
    const doc = dialog.ownerDocument;
    const original = doc.documentElement.style.overflow;
    const show = spyOn(dialog, 'showModal').mockImplementation(() => {
      throw new DOMException('Unavailable', 'InvalidStateError');
    });
    await userEvent.click(tiles(canvasElement)[0]!);
    await expect(dialog).not.toHaveAttribute('open');
    await expect(doc.documentElement.style.overflow).toBe(original);
    show.mockRestore();
    await userEvent.click(tiles(canvasElement)[0]!);
    await waitFor(async () => {
      await expect(dialog).toHaveAttribute('open');
    });
    await expect(args.onOpenChange).toHaveBeenCalledTimes(1);
    cancel(dialog);
    await waitFor(async () => {
      await expect(doc.documentElement.style.overflow).toBe(original);
    });
    await expect(args.onOpenChange).toHaveBeenCalledTimes(2);
  },
};

export const MissingInvokerReturn: Story = {
  render: (args) => {
    const [items, setItems] = useState(args.images);
    return (
      <LightboxGallery
        {...args}
        images={items}
        slotProps={{
          controls: {
            onClick: () => setItems((current) => current.filter((image) => image.id !== 'coast')),
          },
        }}
      />
    );
  },
  play: async ({ canvas, canvasElement, userEvent }) => {
    await userEvent.click(tiles(canvasElement)[0]!);
    await userEvent.click(await canvas.findByRole('button', { name: 'Next image' }));
    await current(canvasElement, 'Tall forest trees');
    await userEvent.click(canvas.getByRole('button', { name: 'Close viewer' }));
    await waitFor(async () => {
      await expect(viewer(canvasElement)).not.toHaveAttribute('open');
    });
    await waitFor(async () => {
      await expect(tiles(canvasElement)[0]!.ownerDocument.activeElement).toBe(tiles(canvasElement)[0]);
    });
  },
};

export const RootReturnFallback: Story = {
  render: (args) => {
    const [items, setItems] = useState(args.images);
    return (
      <LightboxGallery {...args} images={items} slotProps={{ controls: { onClick: () => setItems([]) } }} />
    );
  },
  play: async ({ canvas, canvasElement, userEvent }) => {
    await userEvent.click(tiles(canvasElement)[0]!);
    await userEvent.click(await canvas.findByRole('button', { name: 'Zoom in' }));
    const region = canvas.getByRole('region');
    await waitFor(async () => {
      await expect(region.ownerDocument.activeElement).toBe(region);
    });
    await expect(viewer(canvasElement)).not.toHaveAttribute('open');
  },
};

export const DownwardDismiss: Story = {
  play: async ({ canvas, canvasElement, args, userEvent }) => {
    await userEvent.click(tiles(canvasElement)[1]!);
    await canvas.findByRole('dialog');
    const surface = stage(canvasElement);
    const capture = spyOn(surface, 'setPointerCapture').mockImplementation(() => {});
    fireEvent.pointerDown(surface, { pointerId: 1, button: 0, clientX: 100, clientY: 0 });
    fireEvent.pointerMove(surface, { pointerId: 1, clientX: 100, clientY: surface.clientHeight * 0.5 });
    fireEvent.pointerUp(surface, { pointerId: 1, clientX: 100, clientY: surface.clientHeight * 0.5 });
    await waitFor(async () => {
      await expect(viewer(canvasElement)).not.toHaveAttribute('open');
    });
    await expect(args.onOpenChange).toHaveBeenCalledTimes(2);
    await expect(tiles(canvasElement)[1]!.ownerDocument.activeElement).toBe(tiles(canvasElement)[1]);
    capture.mockRestore();
  },
};

export const ReplacedImageSource: Story = {
  // Excluded from the docs page: its open overlay (modal/backdrop) covers the documentation.
  tags: ['!autodocs'],
  args: { defaultOpen: true },
  render: (args) => {
    const [items, setItems] = useState(args.images);
    return (
      <LightboxGallery
        {...args}
        images={items}
        slotProps={{ controls: { onClick: () => setItems(items.map((image) => ({ ...image, src: '' }))) } }}
      />
    );
  },
  play: async ({ canvas, canvasElement, userEvent }) => {
    await current(canvasElement, 'Coastal cliffs');
    const old = within(viewer(canvasElement)).getByRole('img');
    await userEvent.click(canvas.getByRole('button', { name: 'Zoom in' }));
    await expect(within(stage(canvasElement)).getByText('Image unavailable')).toBeVisible();
    fireEvent.load(old);
    await expect(within(stage(canvasElement)).getByText('Image unavailable')).toBeVisible();
    await expect(within(viewer(canvasElement)).queryByRole('img')).not.toBeInTheDocument();
  },
};

function HydrationFixture({
  images: items,
  label,
}: {
  images: readonly LightboxGalleryImage[];
  label: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [markup] = useState(() =>
    renderToString(<LightboxGallery images={items} label={label} />, { identifierPrefix: 'gallery-ssr-' }),
  );
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const before = node.querySelector('h2')?.id;
    const root = hydrateRoot(node, <LightboxGallery images={items} label={label} />, {
      identifierPrefix: 'gallery-ssr-',
    });
    node.dataset.serverTitle = before;
    return () => root.unmount();
  }, [items, label]);
  return <div ref={ref} data-hydration-fixture dangerouslySetInnerHTML={{ __html: markup }} />;
}

export const SSRHydration: Story = {
  render: (args) => <HydrationFixture images={args.images} label={args.label} />,
  play: async ({ canvas, canvasElement, userEvent }) => {
    const fixture = canvasElement.querySelector<HTMLElement>('[data-hydration-fixture]')!;
    await expect(fixture.querySelector('h2')!.id).toBe(fixture.dataset.serverTitle);
    await userEvent.click(tiles(canvasElement)[0]!);
    await expect(await canvas.findByRole('dialog')).toBeVisible();
  },
};

export const LiveReducedMotionPreference: Story = {
  // Excluded from the docs page: its open overlay (modal/backdrop) covers the documentation.
  tags: ['!autodocs'],
  args: { defaultOpen: true },
  render: (args) => {
    const change = useRef<() => void>(() => {});
    return (
      <LightboxGallery
        {...args}
        ref={(element) => {
          const win = element?.ownerDocument.defaultView;
          if (!win) return;
          const query = win.matchMedia(REDUCED_MOTION.replace('@media ', ''));
          const original = win.matchMedia.bind(win);
          let matches = false;
          Object.defineProperty(query, 'matches', { configurable: true, get: () => matches });
          const matcher = spyOn(win, 'matchMedia').mockImplementation((media) =>
            media === query.media ? query : original(media),
          );
          change.current = () => {
            matches = true;
            query.dispatchEvent(new MediaQueryListEvent('change', { matches, media: query.media }));
          };
          return () => {
            matcher.mockRestore();
            Reflect.deleteProperty(query, 'matches');
          };
        }}
        slotProps={{ controls: { onClick: () => change.current() } }}
      />
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          'Mocks a media-preference change to test behavior. Browser media-query styles need a separate check.',
      },
    },
  },
  play: async ({ canvas, canvasElement, userEvent }) => {
    await expect(stage(canvasElement)).toHaveAttribute('data-reduced-motion', 'false');
    await userEvent.click(await canvas.findByRole('button', { name: 'Zoom in' }));
    await expect(stage(canvasElement)).toHaveAttribute('data-reduced-motion', 'true');
    await expect(stage(canvasElement)).toHaveAttribute('data-zoom', '1.5');
  },
};
