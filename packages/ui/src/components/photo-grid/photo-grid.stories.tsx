import { StrictMode, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fireEvent, fn, spyOn, waitFor, within } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { css } from '../../styling/css';
import { withLightTheme } from '../../testing/story-decorators';
import { PhotoGrid, type PhotoGridPhoto } from './index';

const photoSource = (seed: number) =>
  `data:image/svg+xml,${encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 400">' +
      `<filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.008" numOctaves="3" seed="${seed}"/></filter>` +
      '<rect width="600" height="400" filter="url(#n)"/></svg>',
  )}`;
const photos: PhotoGridPhoto[] = Array.from({ length: 8 }, (_, index) => ({
  id: `photo-${index}`,
  src: photoSource(index + 1),
  alt: `Landscape ${index + 1}`,
  width: 600,
  height: 400,
  title: `Landscape ${index + 1}`,
  detail: `Field study ${index + 1}`,
}));
const frameStyle = css({
  inlineSize: '48rem',
  maxInlineSize: '100%',
  padding: vars.space[4],
  boxSizing: 'border-box',
});
const narrowStyle = css({ inlineSize: '14rem', maxInlineSize: '100%' });
const fixtureStyle = css({
  minBlockSize: vars.space[8],
  minInlineSize: vars.space[8],
  padding: vars.space[2],
});
const SOURCE =
  '<PhotoGrid title="September" photos={photos} defaultDensity={3} onFavoriteChange={saveFavorite} />';

const meta = {
  title: 'Data display/PhotoGrid',
  component: PhotoGrid,
  tags: ['autodocs'],
  args: {
    title: 'September',
    photos,
    locale: 'en-GB',
    onDensityChange: fn(),
    onFavoritesChange: fn(),
    onFavoriteChange: fn(),
    onValueChange: fn(),
    onOpenChange: fn(),
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
        component: [
          'A fixed square-thumbnail media browsing core with independent controlled density, favorites, current photo and viewer visibility. Storage, pagination and formatted details belong to the consumer. This is a moderate collection, not a virtualized library or a masonry layout.',
          'Density is the preferred column count. A narrow container reduces effective columns to keep cells usable without requesting a different density. Steps are normalized to unique descending positive integers; invalid values use the nearest configured step. If the default 3 is absent, the first step seeds density.',
          'Native list and button semantics: Tab reaches every open/favorite action. Arrows move one cell or row (Left/Right follow RTL), PageUp/PageDown move three rows, Home/End reach the ends. Plus/minus change thumbnail size around the focused photo. A two-finger pinch requests a discrete density step on release.',
          'The native dialog uses the shared modal lifecycle. Unzoomed stage arrows/Home/End select slides without wrapping; the filmstrip remains a native range. Zoom/pan, previous/next, favorite and Close buttons provide gesture equivalents. Escape returns focus to the launch tile or nearest surviving tile. Zoomed stage arrows pan; plus/minus magnify the image, not the grid.',
          'Favorite IDs outside the current page are retained. Controlled requests do not visually commit until accepted. Use labels for translated action/status text and locale for Intl-formatted counts. Give every photo a unique stable ID and finite positive intrinsic dimensions.',
        ].join('\n\n'),
      },
    },
  },
} satisfies Meta<typeof PhotoGrid>;
export default meta;
type Story = StoryObj<typeof PhotoGrid>;

const tiles = (root: HTMLElement) =>
  Array.from(root.querySelectorAll<HTMLButtonElement>('[data-ui="photo-grid-photo"]'));
const favorites = (root: HTMLElement) =>
  Array.from(root.querySelectorAll<HTMLButtonElement>('[data-ui="photo-grid-favorite"]'));
const status = (root: HTMLElement) =>
  root.querySelector<HTMLElement>('[data-ui="photo-grid"] > [role="status"]')!;
async function focused(element: HTMLElement) {
  await expect(element.ownerDocument.activeElement).toBe(element);
  await expect(getComputedStyle(element).outlineStyle).not.toBe('none');
  await expect(Math.abs(Number.parseFloat(getComputedStyle(element).outlineWidth) - 2)).toBeLessThan(1.1);
}

export const Default: Story = {
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.getByRole('region', { name: 'September' })).toBeInTheDocument();
    await expect(canvas.getByRole('list', { name: 'September' })).toBeInTheDocument();
    await expect(tiles(canvasElement)).toHaveLength(8);
    for (const [index, tile] of tiles(canvasElement).entries()) {
      const image = tile.querySelector('img')!;
      await expect(image).toHaveAttribute('loading', 'lazy');
      await expect(image).toHaveAttribute('alt', '');
      await expect(image).not.toHaveAttribute('aria-hidden');
      await expect(tile).toHaveAccessibleName(`Landscape ${index + 1}`);
      const box = tile.getBoundingClientRect();
      await expect(Math.abs(box.width - box.height)).toBeLessThan(1.1);
      await expect(box.width).toBeGreaterThanOrEqual(32);
    }
  },
};
export const EachDensity: Story = {
  render: (args) => (
    <div css={css({ display: 'grid', gap: vars.space[8] })}>
      {[5, 3, 2].map((density) => (
        <PhotoGrid {...args} key={density} title={`${density} columns`} density={density} />
      ))}
    </div>
  ),
};
export const CustomSteps: Story = {
  args: { densitySteps: [4, 2, 1] },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('region')).toHaveAttribute('data-density', '4');
  },
};
export const Favorites: Story = {
  args: { defaultFavorites: ['photo-1', 'photo-3', 'unseen'] },
  play: async ({ canvasElement, args, userEvent }) => {
    await userEvent.click(favorites(canvasElement)[0]!);
    await expect(args.onFavoritesChange).toHaveBeenCalledTimes(1);
    await expect(args.onFavoritesChange).toHaveBeenLastCalledWith([
      'photo-1',
      'photo-3',
      'unseen',
      'photo-0',
    ]);
    await expect(args.onFavoriteChange).toHaveBeenCalledTimes(1);
    await expect(args.onFavoriteChange).toHaveBeenLastCalledWith('photo-0', true);
    await expect(args.onOpenChange).not.toHaveBeenCalled();
    await expect(favorites(canvasElement)[0]).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(favorites(canvasElement)[0]!);
    await expect(args.onFavoritesChange).toHaveBeenCalledTimes(2);
    await expect(args.onFavoritesChange).toHaveBeenLastCalledWith(['photo-1', 'photo-3', 'unseen']);
    await expect(args.onFavoriteChange).toHaveBeenLastCalledWith('photo-0', false);
  },
};
export const ControlledFavorites: Story = {
  render: (args) => {
    const [ids, setIds] = useState<string[]>([]);
    return (
      <PhotoGrid
        {...args}
        favorites={ids}
        onFavoritesChange={(next) => {
          args.onFavoritesChange?.(next);
          setIds(next);
        }}
      />
    );
  },
  play: async ({ canvasElement, args, userEvent }) => {
    await userEvent.click(favorites(canvasElement)[0]!);
    await expect(favorites(canvasElement)[0]).toHaveAttribute('aria-pressed', 'true');
    await expect(args.onFavoritesChange).toHaveBeenCalledTimes(1);
    await expect(args.onFavoritesChange).toHaveBeenLastCalledWith(['photo-0']);
  },
};
export const Empty: Story = {
  args: { photos: [], defaultOpen: true },
  play: async ({ canvas, canvasElement, args }) => {
    await expect(canvas.getByText('No photos')).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Larger thumbnails' })).toBeDisabled();
    await expect(canvas.getByRole('button', { name: 'Smaller thumbnails' })).toBeDisabled();
    await expect(canvasElement.querySelector('dialog')).not.toHaveAttribute('open');
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await expect(args.onOpenChange).not.toHaveBeenCalled();
  },
};
export const SinglePhoto: Story = {
  args: { photos: photos.slice(0, 1), defaultOpen: true },
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('dialog', { name: 'Landscape 1' })).toBeVisible();
    await expect(canvas.getByRole('slider')).toBeDisabled();
    await expect(canvas.getByRole('button', { name: 'Previous photo' })).toBeDisabled();
    await expect(canvas.getByRole('button', { name: 'Next photo' })).toBeDisabled();
  },
};
export const FailedImage: Story = {
  args: { photos: [{ ...photos[0]!, src: 'data:image/png;base64,broken' }] },
  play: async ({ canvasElement }) => {
    await waitFor(async () => {
      await expect(tiles(canvasElement)[0]!.querySelector('[data-image-state="error"]')).toBeInTheDocument();
    });
  },
};
export const PaginatedSet: Story = {
  render: (args) => {
    const [page, setPage] = useState(0);
    return (
      <>
        <button css={fixtureStyle} onClick={() => setPage(1 - page)}>
          Change page
        </button>
        <PhotoGrid
          {...args}
          photos={args.photos.slice(page * 4, page * 4 + 4)}
          defaultFavorites={['photo-0', 'saved-page']}
        />
      </>
    );
  },
  play: async ({ canvas, canvasElement, args, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Change page' }));
    await userEvent.click(favorites(canvasElement)[0]!);
    await expect(args.onFavoritesChange).toHaveBeenCalledTimes(1);
    await expect(args.onFavoritesChange).toHaveBeenLastCalledWith(['photo-0', 'saved-page', 'photo-4']);
  },
};
export const Light: Story = { decorators: [withLightTheme], globals: { theme: 'light' } };
export const Narrow: Story = {
  render: (args) => (
    <div css={narrowStyle}>
      <PhotoGrid {...args} density={5} />
    </div>
  ),
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.getByRole('region')).toHaveAttribute('data-density', '5');
    await expect(canvas.getByRole('region')).toHaveAttribute('data-columns', '2');
    for (const button of [...tiles(canvasElement), ...favorites(canvasElement)]) {
      await expect(button.getBoundingClientRect().width).toBeGreaterThanOrEqual(32 - 1.1);
      await expect(button.getBoundingClientRect().height).toBeGreaterThanOrEqual(32 - 1.1);
    }
  },
};
export const RTL: Story = {
  args: { dir: 'rtl' },
  play: async ({ canvasElement, userEvent }) => {
    const buttons = tiles(canvasElement);
    await userEvent.tab();
    await userEvent.tab();
    await userEvent.tab();
    await focused(buttons[0]!);
    await userEvent.keyboard('{ArrowLeft}');
    await focused(buttons[1]!);
    await userEvent.keyboard('{ArrowRight}');
    await focused(buttons[0]!);
  },
};
export const ReducedMotion: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Structural interaction check. Use browser reduced-motion emulation to verify the environment-specific animation branch.',
      },
    },
  },
  play: async ({ canvas, args, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Larger thumbnails' }));
    await expect(args.onDensityChange).toHaveBeenCalledTimes(1);
    await expect(args.onDensityChange).toHaveBeenLastCalledWith(2);
    await new Promise((resolve) => setTimeout(resolve, 500));
  },
};
export const ForcedColors: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Structural favorite and focus check. Forced-colors computed styles require browser media emulation.',
      },
    },
  },
  args: { defaultFavorites: ['photo-0'] },
};
export const ControlledRejected: Story = {
  args: { density: 3, favorites: [], value: null, open: false },
  play: async ({ canvas, canvasElement, args, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Larger thumbnails' }));
    await expect(canvas.getByRole('region')).toHaveAttribute('data-density', '3');
    await expect(args.onDensityChange).toHaveBeenCalledTimes(1);
    await expect(args.onDensityChange).toHaveBeenLastCalledWith(2);
    await userEvent.click(favorites(canvasElement)[0]!);
    await expect(favorites(canvasElement)[0]).toHaveAttribute('aria-pressed', 'false');
    await expect(args.onFavoritesChange).toHaveBeenCalledTimes(1);
    await expect(args.onFavoritesChange).toHaveBeenLastCalledWith(['photo-0']);
    await userEvent.click(tiles(canvasElement)[1]!);
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith('photo-1');
    await expect(args.onOpenChange).toHaveBeenCalledTimes(1);
    await expect(args.onOpenChange).toHaveBeenLastCalledWith(true);
    await expect(canvas.queryByRole('dialog')).not.toBeInTheDocument();
    await expect(status(canvasElement)).toHaveTextContent('');
  },
};
export const LiveStatus: Story = {
  play: async ({ canvas, canvasElement, userEvent }) => {
    const region = status(canvasElement);
    const announced: string[] = [];
    const observer = new MutationObserver(() => announced.push(region.textContent ?? ''));
    observer.observe(region, { childList: true, characterData: true, subtree: true });
    try {
      await userEvent.click(canvas.getByRole('button', { name: 'Smaller thumbnails' }));
      await userEvent.click(favorites(canvasElement)[0]!);
      await userEvent.click(tiles(canvasElement)[1]!);
      await userEvent.click(canvas.getByRole('button', { name: 'Zoom in' }));
      await userEvent.click(canvas.getByRole('button', { name: 'Reset zoom' }));
      await userEvent.click(canvas.getByRole('button', { name: 'Next photo' }));
      await expect(announced).toEqual([
        '5 columns',
        'Remove Landscape 1 from favorites',
        'Landscape 2, 2 / 8',
        'Landscape 3, 3 / 8',
      ]);
    } finally {
      observer.disconnect();
    }
  },
};
export const ControlledValueRejected: Story = {
  args: { open: true, value: 'photo-0' },
  play: async ({ canvas, args, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Next photo' }));
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith('photo-1');
    await expect(canvas.getByRole('dialog')).toHaveAccessibleName('Landscape 1');
    await expect(canvas.getByRole('slider')).toHaveValue('0');
    await userEvent.click(canvas.getByRole('button', { name: 'Close viewer' }));
    await expect(args.onOpenChange).toHaveBeenCalledTimes(1);
    await expect(args.onOpenChange).toHaveBeenLastCalledWith(false);
    await expect(canvas.getByRole('dialog')).toBeVisible();
  },
};
export const ExternalAria: Story = {
  args: {
    'aria-label': 'External label',
    'aria-labelledby': 'photo-grid-external missing-reference',
    'aria-describedby': 'photo-grid-description',
    slotProps: { title: { id: 'photo-grid-custom-title' } },
  },
  render: (args) => (
    <>
      <h2 id="photo-grid-external">Library</h2>
      <p id="photo-grid-description">Field studies</p>
      <PhotoGrid {...args} />
    </>
  ),
  play: async ({ canvas }) => {
    const root = canvas.getByRole('region', { name: 'Library September' });
    await expect(root).toHaveAttribute('aria-label', 'External label');
    await expect(root).toHaveAttribute(
      'aria-labelledby',
      'photo-grid-external missing-reference photo-grid-custom-title',
    );
    await expect(root).toHaveAccessibleDescription('Field studies');
  },
};
export const MultipleInstances: Story = {
  render: (args) => (
    <>
      <PhotoGrid {...args} />
      <PhotoGrid {...args} title="October" />
    </>
  ),
  play: async ({ canvas }) => {
    const regions = canvas.getAllByRole('region');
    await expect(regions[0]!.getAttribute('aria-labelledby')).not.toBe(
      regions[1]!.getAttribute('aria-labelledby'),
    );
  },
};
export const PersistentViewer: Story = {
  args: { defaultOpen: true, defaultValue: 'photo-2' },
  play: async ({ canvas }) => {
    const dialog = canvas.getByRole('dialog');
    await expect(dialog).toHaveAccessibleName('Landscape 3');
    await expect(dialog.querySelector('[data-ui="photo-grid-stage"] img')).toHaveAttribute('alt', '');
  },
};
export const PersistentFavorite: Story = { args: { defaultOpen: true, defaultFavorites: ['photo-0'] } };
export const PersistentImageZoom: Story = {
  args: { defaultOpen: true },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Zoom in' }));
    await expect(canvas.getByRole('group', { name: 'Landscape 1' })).toHaveAttribute('data-zoom', '1.5');
    await expect(canvas.getByRole('button', { name: 'Pan left' })).toBeVisible();
  },
};
export const PersistentUnavailable: Story = { args: { defaultOpen: true, value: 'missing' } };
export const KeyboardPlay: Story = {
  play: async ({ canvas, canvasElement, args, userEvent }) => {
    const buttons = tiles(canvasElement);
    await userEvent.tab();
    await userEvent.tab();
    await userEvent.tab();
    await focused(buttons[0]!);
    const route: [string, number][] = [
      ['{ArrowRight}', 1],
      ['{ArrowLeft}', 0],
      ['{ArrowDown}', 3],
      ['{ArrowUp}', 0],
      ['{PageDown}', 7],
      ['{PageUp}', 0],
      ['{End}', 7],
      ['{ArrowDown}', 7],
      ['{Home}', 0],
    ];
    for (const [key, index] of route) {
      await userEvent.keyboard(key);
      await focused(buttons[index]!);
    }
    await userEvent.keyboard('+');
    await expect(args.onDensityChange).toHaveBeenCalledTimes(1);
    await expect(args.onDensityChange).toHaveBeenLastCalledWith(2);
    await focused(buttons[0]!);
    await userEvent.keyboard('-');
    await expect(args.onDensityChange).toHaveBeenCalledTimes(2);
    await expect(args.onDensityChange).toHaveBeenLastCalledWith(3);
    await userEvent.tab();
    await focused(favorites(canvasElement)[0]!);
    await userEvent.keyboard(' ');
    await expect(args.onFavoriteChange).toHaveBeenCalledTimes(1);
    await expect(args.onFavoriteChange).toHaveBeenLastCalledWith('photo-0', true);
    await expect(args.onOpenChange).not.toHaveBeenCalled();
    await userEvent.tab({ shift: true });
    await userEvent.keyboard('{Enter}');
    const dialog = await canvas.findByRole('dialog');
    const viewer = within(dialog);
    await focused(viewer.getByRole('button', { name: 'Close viewer' }));
    await expect(args.onOpenChange).toHaveBeenCalledTimes(1);
    await expect(args.onOpenChange).toHaveBeenLastCalledWith(true);
    const stage = viewer.getByRole('group', { name: 'Landscape 1' });
    await userEvent.tab();
    await focused(stage);
    await userEvent.keyboard('{ArrowRight}');
    await expect(dialog).toHaveAccessibleName('Landscape 2');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith('photo-1');
    await userEvent.keyboard('{End}');
    await expect(dialog).toHaveAccessibleName('Landscape 8');
    await userEvent.keyboard('{Home}');
    await expect(dialog).toHaveAccessibleName('Landscape 1');
    const slider = viewer.getByRole('slider');
    await expect(slider).toHaveAttribute('min', '0');
    await expect(slider).toHaveAttribute('max', '7');
    await expect(slider).toHaveAttribute('step', '1');
    slider.focus();
    await userEvent.keyboard('{ArrowRight}');
    await expect(fireEvent.keyDown(slider, { key: 'ArrowRight' })).toBe(true);
    fireEvent.change(slider, { target: { value: '1' } });
    await expect(slider).toHaveValue('1');
    await expect(slider).toHaveAttribute('aria-valuetext', 'Landscape 2, 2 / 8');
    await userEvent.keyboard('{Escape}');
    fireEvent(dialog, new Event('cancel', { cancelable: true }));
    await waitFor(async () => {
      await expect(dialog).not.toHaveAttribute('open');
    });
    await focused(buttons[0]!);
    await expect(args.onOpenChange).toHaveBeenCalledTimes(2);
    await expect(args.onOpenChange).toHaveBeenLastCalledWith(false);
  },
};
export const FalsyDetails: Story = {
  args: {
    defaultOpen: true,
    photos: photos.slice(0, 4).map((photo, index) => ({ ...photo, detail: [false, null, 0, ''][index] })),
  },
  play: async ({ canvas, userEvent }) => {
    const dialog = canvas.getByRole('dialog');
    await expect(dialog).not.toHaveAttribute('aria-describedby');
    await userEvent.click(canvas.getByRole('button', { name: 'Next photo' }));
    await expect(dialog).not.toHaveAttribute('aria-describedby');
    await userEvent.click(canvas.getByRole('button', { name: 'Next photo' }));
    await expect(dialog).toHaveAccessibleDescription('0');
    await userEvent.click(canvas.getByRole('button', { name: 'Next photo' }));
    await expect(dialog).not.toHaveAttribute('aria-describedby');
  },
};
export const NativeLifecycle: Story = {
  args: { slotProps: { viewer: { ref: fn(), onCancel: fn(), onClose: fn() } } },
  render: (args) => (
    <StrictMode>
      <PhotoGrid {...args} />
    </StrictMode>
  ),
  play: async ({ canvas, canvasElement, args, userEvent }) => {
    const button = tiles(canvasElement)[0]!;
    await userEvent.click(button);
    const dialog = canvas.getByRole('dialog') as HTMLDialogElement;
    await expect(args.slotProps?.viewer?.ref).toHaveBeenCalledWith(dialog);
    await expect(dialog.ownerDocument.documentElement.style.overflow).toBe('hidden');
    const child = dialog.ownerDocument.createElement('dialog');
    dialog.append(child);
    fireEvent(child, new Event('cancel', { bubbles: true, cancelable: true }));
    fireEvent(child, new Event('close', { bubbles: true }));
    await expect(args.slotProps?.viewer?.onCancel).not.toHaveBeenCalled();
    await expect(args.slotProps?.viewer?.onClose).not.toHaveBeenCalled();
    await expect(dialog).toHaveAttribute('open');
    child.remove();
    dialog.close();
    await waitFor(async () => {
      await expect(args.onOpenChange).toHaveBeenCalledTimes(2);
    });
    await expect(args.onOpenChange).toHaveBeenLastCalledWith(false);
    await focused(button);
    await expect(dialog.ownerDocument.documentElement.style.overflow).not.toBe('hidden');
  },
};
export const CancelVeto: Story = {
  args: { defaultOpen: true, slotProps: { viewer: { onCancel: fn((event) => event.preventDefault()) } } },
  play: async ({ canvas, args, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Close viewer' }));
    await expect(args.slotProps?.viewer?.onCancel).toHaveBeenCalledTimes(1);
    await expect(args.onOpenChange).not.toHaveBeenCalled();
    await expect(canvas.getByRole('dialog')).toBeVisible();
  },
};

export const DensityAnchor: Story = {
  args: { sx: { maxBlockSize: '22rem', overflowY: 'auto' } },
  play: async ({ canvasElement, args, userEvent }) => {
    const buttons = tiles(canvasElement);
    buttons[4]!.focus();
    await userEvent.keyboard('{ArrowLeft}{ArrowRight}');
    const before = buttons[4]!.getBoundingClientRect().top;
    await userEvent.keyboard('+');
    await new Promise((resolve) => setTimeout(resolve, 500));
    await focused(buttons[4]!);
    await expect(Math.abs(buttons[4]!.getBoundingClientRect().top - before)).toBeLessThan(1.1);
    await expect(args.onDensityChange).toHaveBeenCalledTimes(1);
    await userEvent.keyboard('+');
    await expect(args.onDensityChange).toHaveBeenCalledTimes(1);
  },
};

export const ControlledAxes: Story = {
  render: (args) => {
    const [density, setDensity] = useState(3);
    const [favorites, setFavorites] = useState<string[]>([]);
    const [value, setValue] = useState<string | null>(null);
    const [open, setOpen] = useState(false);
    return (
      <PhotoGrid
        {...args}
        density={density}
        favorites={favorites}
        value={value}
        open={open}
        onDensityChange={(next) => {
          args.onDensityChange?.(next);
          setDensity(next);
        }}
        onFavoritesChange={(next) => {
          args.onFavoritesChange?.(next);
          setFavorites(next);
        }}
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
    await userEvent.click(canvas.getByRole('button', { name: 'Smaller thumbnails' }));
    await new Promise((resolve) => setTimeout(resolve, 500));
    await expect(canvas.getByRole('region')).toHaveAttribute('data-density', '5');
    await userEvent.click(favorites(canvasElement)[1]!);
    await expect(favorites(canvasElement)[1]).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(tiles(canvasElement)[1]!);
    await expect(canvas.getByRole('dialog')).toHaveAccessibleName('Landscape 2');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith('photo-1');
    await userEvent.click(canvas.getByRole('button', { name: 'Close viewer' }));
    await expect(canvas.queryByRole('dialog')).not.toBeInTheDocument();
    await expect(args.onOpenChange).toHaveBeenCalledTimes(2);
  },
};

export const RejectedNativeCloseRepair: Story = {
  args: { open: true, value: 'photo-0' },
  play: async ({ canvas, canvasElement, args, userEvent }) => {
    const dialog = canvas.getByRole('dialog') as HTMLDialogElement;
    dialog.close();
    await waitFor(async () => {
      await expect(args.onOpenChange).toHaveBeenCalledTimes(1);
    });
    await expect(args.onOpenChange).toHaveBeenLastCalledWith(false);
    await expect(dialog.ownerDocument.documentElement.style.overflow).not.toBe('hidden');
    await userEvent.click(tiles(canvasElement)[0]!);
    await expect(canvas.getByRole('dialog')).toBeVisible();
    await expect(args.onOpenChange).toHaveBeenCalledTimes(1);
    await expect(dialog.ownerDocument.documentElement.style.overflow).toBe('hidden');
  },
};

const rootRef = fn();
const rootCleanup = fn();
export const RootRefCleanup: Story = {
  args: {
    ref: (node) => {
      rootRef(node);
      return rootCleanup;
    },
  },
  render: (args) => {
    const [mounted, setMounted] = useState(true);
    return (
      <StrictMode>
        <button css={fixtureStyle} onClick={() => setMounted(!mounted)}>
          Toggle collection
        </button>
        {mounted && <PhotoGrid {...args} />}
      </StrictMode>
    );
  },
  play: async ({ canvas, userEvent }) => {
    const root = canvas.getByRole('region');
    await expect(rootRef).toHaveBeenCalledWith(root);
    const before = rootCleanup.mock.calls.length;
    await userEvent.click(canvas.getByRole('button', { name: 'Toggle collection' }));
    await expect(rootCleanup.mock.calls.length).toBe(before + 1);
    await expect(canvas.queryByRole('region')).not.toBeInTheDocument();
  },
};

export const SlotStyling: Story = {
  args: {
    slotProps: {
      header: { style: { padding: '12px' } },
      item: { css: { padding: '8px' } },
      photo: { css: { borderWidth: '3px' } },
    },
    sx: { padding: '24px' },
  },
  play: async ({ canvas, canvasElement }) => {
    await expect(getComputedStyle(canvas.getByRole('region')).paddingTop).toBe('24px');
    await expect(getComputedStyle(canvasElement.querySelector('header')!).paddingTop).toBe('12px');
    await expect(getComputedStyle(canvas.getAllByRole('listitem')[0]!).paddingTop).toBe('8px');
    await expect(
      Math.abs(parseFloat(getComputedStyle(tiles(canvasElement)[0]!).borderTopWidth) - 3),
    ).toBeLessThan(1.1);
  },
};

const favoriteSetRequest = fn();
const favoriteRequest = fn();
const valueRequest = fn();
const openRequest = fn();
export const CallbackOrder: Story = {
  args: {
    onFavoritesChange: favoriteSetRequest,
    onFavoriteChange: favoriteRequest,
    onValueChange: valueRequest,
    onOpenChange: openRequest,
  },
  play: async ({ canvasElement, userEvent }) => {
    await userEvent.click(favorites(canvasElement)[1]!);
    await expect(favoriteSetRequest).toHaveBeenCalledTimes(1);
    await expect(favoriteRequest).toHaveBeenCalledTimes(1);
    await expect(favoriteSetRequest.mock.invocationCallOrder[0]!).toBeLessThan(
      favoriteRequest.mock.invocationCallOrder[0]!,
    );
    await userEvent.click(tiles(canvasElement)[1]!);
    await expect(valueRequest).toHaveBeenCalledTimes(1);
    await expect(openRequest).toHaveBeenCalledTimes(1);
    await expect(valueRequest.mock.invocationCallOrder[0]!).toBeLessThan(
      openRequest.mock.invocationCallOrder[0]!,
    );
  },
};

export const FormClosure: Story = {
  args: { defaultOpen: true, slotProps: { viewer: { onClose: fn() } } },
  play: async ({ canvas, args, userEvent }) => {
    const dialog = canvas.getByRole('dialog') as HTMLDialogElement;
    const form = dialog.ownerDocument.createElement('form');
    form.method = 'dialog';
    const button = dialog.ownerDocument.createElement('button');
    button.type = 'submit';
    button.textContent = 'Done';
    button.style.minHeight = '32px';
    button.style.minWidth = '32px';
    form.append(button);
    dialog.append(form);
    await userEvent.click(button);
    await waitFor(async () => {
      await expect(dialog).not.toHaveAttribute('open');
    });
    await waitFor(async () => {
      await expect(args.onOpenChange).toHaveBeenCalledTimes(1);
    });
    await expect(args.onOpenChange).toHaveBeenLastCalledWith(false);
    await expect(args.slotProps?.viewer?.onClose).toHaveBeenCalledTimes(1);
    await expect(dialog.ownerDocument.documentElement.style.overflow).not.toBe('hidden');
    form.remove();
  },
};

export const InvokerRemoval: Story = {
  render: (args) => {
    const [collection, setCollection] = useState(args.photos);
    return (
      <PhotoGrid
        {...args}
        photos={collection}
        onOpenChange={(open) => {
          args.onOpenChange?.(open);
          if (open) setCollection(args.photos.slice(1));
        }}
      />
    );
  },
  play: async ({ canvas, canvasElement, userEvent }) => {
    await userEvent.click(tiles(canvasElement)[0]!);
    await expect(canvas.getByRole('dialog')).toHaveAccessibleName('Photo unavailable');
    await userEvent.click(canvas.getByRole('button', { name: 'Close viewer' }));
    await expect(tiles(canvasElement)[0]).toHaveAccessibleName('Landscape 2');
    await expect(canvasElement.ownerDocument.activeElement).toBe(tiles(canvasElement)[0]);
    await new Promise((resolve) => setTimeout(resolve, 500));
  },
};

export const FailedImageRetry: Story = {
  render: (args) => {
    const [failed, setFailed] = useState(true);
    return (
      <PhotoGrid
        {...args}
        photos={[{ ...photos[0]!, src: failed ? 'data:image/png;base64,broken' : photos[0]!.src }]}
        onDensityChange={(next) => {
          args.onDensityChange?.(next);
          setFailed(false);
        }}
      />
    );
  },
  play: async ({ canvas, canvasElement, userEvent }) => {
    await waitFor(async () => {
      await expect(tiles(canvasElement)[0]!.querySelector('[data-image-state="error"]')).toBeInTheDocument();
    });
    await userEvent.click(canvas.getByRole('button', { name: 'Larger thumbnails' }));
    await waitFor(async () => {
      await expect(tiles(canvasElement)[0]!.querySelector('img')?.naturalWidth).toBeGreaterThan(0);
    });
    await expect(
      tiles(canvasElement)[0]!.querySelector('[data-image-state="error"]'),
    ).not.toBeInTheDocument();
    await new Promise((resolve) => setTimeout(resolve, 500));
  },
};

export const PinchDensity: Story = {
  play: async ({ canvasElement, args }) => {
    const list = canvasElement.querySelector<HTMLUListElement>('[data-ui="photo-grid-list"]')!;
    spyOn(list, 'setPointerCapture').mockImplementation(() => {});
    const target = tiles(canvasElement)[4]!;
    const first = { pointerId: 1, pointerType: 'touch', button: 0, clientX: 100, clientY: 100 };
    const second = { ...first, pointerId: 2, clientX: 200 };
    fireEvent.pointerDown(target, first);
    fireEvent.pointerDown(target, second);
    fireEvent.pointerMove(list, { ...second, clientX: 240 });
    await expect(args.onDensityChange).not.toHaveBeenCalled();
    fireEvent.pointerUp(list, { ...second, clientX: 240 });
    fireEvent.pointerUp(list, first);
    await expect(args.onDensityChange).toHaveBeenCalledTimes(1);
    await expect(args.onDensityChange).toHaveBeenLastCalledWith(2);
    fireEvent.pointerDown(target, first);
    fireEvent.pointerDown(target, second);
    fireEvent.pointerMove(list, { ...second, clientX: 160 });
    fireEvent.pointerCancel(list, second);
    fireEvent.pointerUp(list, first);
    await expect(args.onDensityChange).toHaveBeenCalledTimes(1);
    await new Promise((resolve) => setTimeout(resolve, 500));
  },
};

export const ViewerGestures: Story = {
  args: { defaultOpen: true },
  play: async ({ canvas, args, userEvent }) => {
    let stage = canvas.getByRole('group', { name: 'Landscape 1' });
    spyOn(stage, 'setPointerCapture').mockImplementation(() => {});
    const pointer = { pointerId: 1, pointerType: 'touch', button: 0, clientX: 200, clientY: 200 };
    fireEvent.pointerDown(stage, pointer);
    fireEvent.pointerUp(stage, { ...pointer, clientX: 50 });
    await expect(canvas.getByRole('dialog')).toHaveAccessibleName('Landscape 2');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith('photo-1');
    stage = canvas.getByRole('group', { name: 'Landscape 2' });
    fireEvent.pointerDown(stage, pointer);
    fireEvent.pointerDown(stage, { ...pointer, pointerId: 2, clientX: 300 });
    fireEvent.pointerMove(stage, { ...pointer, pointerId: 2, clientX: 400 });
    fireEvent.pointerUp(stage, { ...pointer, pointerId: 2, clientX: 400 });
    fireEvent.pointerUp(stage, pointer);
    await expect(stage).toHaveAttribute('data-zoom', '2');
    stage.focus();
    await userEvent.keyboard('{ArrowRight}{ArrowDown}{ArrowLeft}{ArrowUp}');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await userEvent.click(canvas.getByRole('button', { name: 'Reset zoom' }));
    await expect(stage).toHaveAttribute('data-zoom', '1');
    fireEvent.pointerDown(stage, pointer);
    fireEvent.pointerUp(stage, { ...pointer, clientY: 350 });
    await waitFor(async () => {
      await expect(canvas.queryByRole('dialog')).not.toBeInTheDocument();
    });
    await expect(args.onOpenChange).toHaveBeenCalledTimes(1);
    await expect(args.onOpenChange).toHaveBeenLastCalledWith(false);
    await new Promise((resolve) => setTimeout(resolve, 500));
  },
};

export const ViewerExternalAria: Story = {
  args: {
    defaultOpen: true,
    slotProps: {
      viewer: {
        'aria-label': 'Viewer label',
        'aria-labelledby': 'viewer-external unresolved-viewer',
        'aria-describedby': 'viewer-description',
      },
    },
  },
  render: (args) => (
    <>
      <h2 id="viewer-external">Field collection</h2>
      <p id="viewer-description">Large view</p>
      <PhotoGrid {...args} />
    </>
  ),
  play: async ({ canvas }) => {
    const dialog = canvas.getByRole('dialog', { name: 'Field collection Landscape 1' });
    await expect(dialog).toHaveAttribute('aria-label', 'Viewer label');
    await expect(dialog.getAttribute('aria-labelledby')).toContain('unresolved-viewer');
    await expect(dialog).toHaveAccessibleDescription('Large view Field study 1');
  },
};
