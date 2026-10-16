import { StrictMode, useState, type ComponentPropsWithRef } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fireEvent, fn, spyOn, waitFor, within } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
// `styled` is the app-facing styling API; consumers import it from `@jfrader/ui`.
import { styled } from '../../index';
import { withLightTheme } from '../../testing/story-decorators';
import { PhotoGrid, type PhotoGridPhoto } from './index';
import { sceneSource } from '../scene';
import { ChromeAction, type ChromeActionProps } from '../viewer-chrome/viewer-chrome';

function ReplacementPhotoContainer(props: ComponentPropsWithRef<'div'>) {
  return <div {...props} data-replaced="container" />;
}
function ReplacementPhotoHeader(props: ComponentPropsWithRef<'header'>) {
  return <header {...props} data-replaced="header" />;
}
function ReplacementPhotoTitle(props: ComponentPropsWithRef<'h2'>) {
  return <h2 {...props} data-replaced="title" />;
}
function ReplacementPhotoList(props: ComponentPropsWithRef<'ul'>) {
  return <ul {...props} data-replaced="list" />;
}
function ReplacementPhotoItem(props: ComponentPropsWithRef<'li'>) {
  return <li {...props} data-replaced="item" />;
}
function ReplacementPhotoButton(props: ComponentPropsWithRef<'button'>) {
  return <button {...props} data-replaced="button" />;
}
function ReplacementPhotoViewer(props: ComponentPropsWithRef<'dialog'>) {
  return <dialog {...props} data-replaced="viewer" />;
}
function ReplacementViewerFavorite(props: Partial<ChromeActionProps>) {
  return <ChromeAction {...props} label={props.label ?? ''} icon={props.icon} data-replaced="viewer-favorite" />;
}

export const ReplacePhotoParts: Story = {
  tags: ['!autodocs'],
  args: {
    defaultOpen: true, defaultValue: 'p1',
    slots: {
      header: ReplacementPhotoHeader, title: ReplacementPhotoTitle, density: ReplacementPhotoContainer,
      list: ReplacementPhotoList, item: ReplacementPhotoItem, photo: ReplacementPhotoButton,
      favorite: ReplacementPhotoButton, viewer: ReplacementPhotoViewer, stage: ReplacementPhotoContainer,
      filmstrip: ReplacementPhotoContainer, controls: ReplacementPhotoContainer, status: ReplacementPhotoContainer,
      viewerFavorite: ReplacementViewerFavorite,
    },
    slotProps: { favorite: { title: 'Tile favorite' }, viewerFavorite: { title: 'Viewer favorite' } },
  },
  play: async ({ canvasElement, canvas, userEvent }) => {
    const viewer = canvasElement.querySelector<HTMLElement>('[data-ui="photo-grid-viewer"]');
    await expect(viewer).toHaveAttribute('data-replaced', 'viewer');
    await expect(viewer).toHaveAttribute('open');
    await expect(canvasElement.querySelectorAll('[data-ui="photo-grid-favorite"][title="Tile favorite"]')).toHaveLength(photos.length);
    const favorite = canvasElement.querySelector<HTMLElement>('[data-replaced="viewer-favorite"]');
    await expect(favorite).toHaveAttribute('title', 'Viewer favorite');
    await expect(favorite).toHaveAttribute('aria-pressed', 'false');
    for (const part of canvasElement.querySelectorAll<HTMLElement>('[data-replaced]')) {
      await expect(part.className).not.toBe('');
    }
    await userEvent.click(canvas.getByRole('button', { name: 'Close viewer' }));
  },
};

const photos: PhotoGridPhoto[] = [
  // landscape (wide)
  { id: 'p1', src: sceneSource('alps-dawn-01', { variant: 'landscape' }), alt: 'Ridge at First Light', width: 1200, height: 800, title: 'Ridge at First Light', detail: 'Alpine traverse, 2800 m' },
  { id: 'p2', src: sceneSource('valley-noon-02', { variant: 'landscape' }), alt: 'Valley Floor', width: 1200, height: 800, title: 'Valley Floor', detail: 'Midday light on moraine' },
  { id: 'p3', src: sceneSource('pass-sunset-03', { variant: 'dusk' }), alt: 'High Pass at Sunset', width: 1200, height: 800, title: 'High Pass at Sunset', detail: 'Col de la Meije' },
  // dunes
  { id: 'p4', src: sceneSource('dunes-crest-04', { variant: 'dunes' }), alt: 'Dune Crest', width: 1200, height: 800, title: 'Dune Crest', detail: 'Erg Chebbi, late afternoon' },
  { id: 'p5', src: sceneSource('dunes-wind-05', { variant: 'dunes' }), alt: 'Wind-Sculpted Dunes', width: 800, height: 1200, title: 'Wind-Sculpted Dunes', detail: 'Portrait orientation study' },
  // dusk / tide mix
  { id: 'p6', src: sceneSource('tide-pool-06', { variant: 'tide' }), alt: 'Tidal Pool', width: 1200, height: 800, title: 'Tidal Pool', detail: 'Low tide, Atlantic coast' },
  { id: 'p7', src: sceneSource('dusk-lagoon-07', { variant: 'dusk' }), alt: 'Lagoon at Dusk', width: 800, height: 1200, title: 'Lagoon at Dusk', detail: 'Portrait: reflections' },
  { id: 'p8', src: sceneSource('shore-mist-08', { variant: 'tide' }), alt: 'Misty Shore', width: 1200, height: 800, title: 'Misty Shore', detail: 'Morning fog on the flats' },
  { id: 'p9', src: sceneSource('ridge-storm-09', { variant: 'landscape' }), alt: 'Storm Light on Ridge', width: 1200, height: 800, title: 'Storm Light on Ridge', detail: 'Clearing after rain' },
  { id: 'p10', src: sceneSource('erg-shadow-10', { variant: 'dunes' }), alt: 'Erg in Shadow', width: 1200, height: 800, title: 'Erg in Shadow', detail: 'Lee faces at sundown' },
  { id: 'p11', src: sceneSource('cove-swell-11', { variant: 'tide' }), alt: 'Cove Swell', width: 1000, height: 1000, title: 'Cove Swell', detail: 'Square crop, incoming tide' },
  { id: 'p12', src: sceneSource('hills-night-12', { variant: 'dusk' }), alt: 'Night over the Hills', width: 800, height: 1200, title: 'Night over the Hills', detail: 'Portrait: first stars' },
];
const Frame = styled.div({
  inlineSize: '48rem',
  maxInlineSize: '100%',
  padding: vars.space[4],
  boxSizing: 'border-box',
});
const NarrowFrame = styled.div({ inlineSize: '14rem', maxInlineSize: '100%' });
const DensityStack = styled.div({ display: 'grid', gap: vars.space[8] });
const FixtureButton = styled.button({
  minBlockSize: vars.space[8],
  minInlineSize: vars.space[8],
  padding: vars.space[2],
});
const SOURCE =
  '<PhotoGrid title="September Traverse" photos={photos} defaultDensity={3} onFavoriteChange={saveFavorite} />';

const meta = {
  title: 'Media/PhotoGrid',
  component: PhotoGrid,
  tags: ['autodocs'],
  args: {
    title: 'September Traverse',
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
      <Frame>
        <Story />
      </Frame>
    ),
  ],
  parameters: {
    layout: 'fullscreen',
    docs: {
      source: { code: SOURCE },
      description: {
        component: 'Browse photos, change thumbnail size, mark favorites and open a photo to zoom or move through the collection.',
      },
      usage: `### Collection and density
- Density, favorites, current photo and viewer visibility have independent controlled state. Requests take effect only when accepted.
- The caller handles storage, pagination and formatted details. Use for moderate collections; thumbnails are square, with no virtualization or masonry layout.
- Density sets the column count from the configured steps; the container width never overrides it. Narrow containers produce smaller cells, and cells narrower than 7rem show the favorite below the photo.
- Steps become unique positive integers in descending order, one toggle each. Invalid values use the nearest configured step. If the default 3 is absent, the first step seeds density.
- Favorite IDs outside the current page are kept. Give each photo a stable, unique ID and finite positive intrinsic dimensions.
- Use labels to translate actions/status and locale for Intl-formatted counts.

### Keyboard and gestures
- The grid uses native lists and buttons. Tab reaches every open/favorite action.
- Arrows move one cell or row; Left/Right follow RTL. PageUp/PageDown move three rows; Home/End reach the ends.
- Plus/minus change thumbnail size around the focused photo. Ctrl+scroll and a two-finger pinch change it around the photo under the pointer; a pinch requests one step on release.
- The viewer fills the screen in a native modal dialog. Unzoomed stage arrows and Home/End select slides without wrapping; the thumbnail strip selects any photo.
- Zoomed stage arrows pan; plus/minus magnify the image instead of resizing the grid.
- Zoom/pan, previous/next, favorite and Close buttons provide alternatives to gestures. Drag down to close; Escape returns focus to the launch tile or nearest remaining tile.
- On narrow or touch screens the viewer hides previous/next; swipe or use the thumbnail strip.`,
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
const densityToggles = (canvas: ReturnType<typeof within>) =>
  within(canvas.getByRole('group', { name: 'Thumbnail size' })).getAllByRole('button');
/** Tabs past the density toggles onto the first tile. */
async function tabToFirstTile(canvas: ReturnType<typeof within>, userEvent: { tab: () => Promise<void> }) {
  for (const _toggle of densityToggles(canvas)) await userEvent.tab();
  await userEvent.tab();
}
async function focused(element: HTMLElement) {
  await expect(element.ownerDocument.activeElement).toBe(element);
  await expect(getComputedStyle(element).outlineStyle).not.toBe('none');
  await expect(Math.abs(Number.parseFloat(getComputedStyle(element).outlineWidth) - 2)).toBeLessThan(1.1);
}

export const Default: Story = {
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.getByRole('region', { name: 'September Traverse' })).toBeInTheDocument();
    await expect(canvas.getByRole('list', { name: 'September Traverse' })).toBeInTheDocument();
    await expect(tiles(canvasElement)).toHaveLength(12);
    const expectedTitles = ['Ridge at First Light', 'Valley Floor', 'High Pass at Sunset', 'Dune Crest', 'Wind-Sculpted Dunes', 'Tidal Pool', 'Lagoon at Dusk', 'Misty Shore', 'Storm Light on Ridge', 'Erg in Shadow', 'Cove Swell', 'Night over the Hills'];
    for (const [index, tile] of tiles(canvasElement).entries()) {
      const image = tile.querySelector('img')!;
      await expect(image).toHaveAttribute('loading', 'lazy');
      await expect(image).toHaveAttribute('alt', '');
      await expect(image).not.toHaveAttribute('aria-hidden');
      await expect(tile).toHaveAccessibleName(expectedTitles[index]);
      const box = tile.getBoundingClientRect();
      await expect(Math.abs(box.width - box.height)).toBeLessThan(1.1);
      await expect(box.width).toBeGreaterThanOrEqual(32);
    }
  },
};
export const EachDensity: Story = {
  render: (args) => (
    <DensityStack>
      {[5, 3, 2].map((density) => (
        <PhotoGrid {...args} key={density} title={`${density} columns`} density={density} />
      ))}
    </DensityStack>
  ),
};
export const ViewerVisibility: Story = {
  play: async ({ canvas, canvasElement, userEvent }) => {
    const viewer = canvasElement.querySelector<HTMLDialogElement>('[data-ui="photo-grid-viewer"]')!;
    const expectClosed = async () => {
      await expect(viewer).not.toHaveAttribute('open');
      await expect(getComputedStyle(viewer).display).toBe('none');
      await expect(viewer.getBoundingClientRect().width).toBe(0);
      await expect(viewer.getBoundingClientRect().height).toBe(0);
    };
    await expectClosed();
    const album = canvas.getByRole('list', { name: 'September Traverse' });
    await expect(album).toBeVisible();
    const tile = tiles(canvasElement)[0]!;
    await expect(tile).toBeVisible();
    const tileBox = tile.getBoundingClientRect();
    await expect(tile.contains(tile.ownerDocument.elementFromPoint(
      tileBox.x + tileBox.width / 2,
      tileBox.y + tileBox.height / 2,
    ))).toBe(true);
    await userEvent.click(tile);
    await expect(await canvas.findByRole('dialog', { name: 'Ridge at First Light' })).toBeVisible();
    await expect(getComputedStyle(viewer).display).toBe('flex');
    const viewport = viewer.ownerDocument.defaultView!;
    const viewerBox = viewer.getBoundingClientRect();
    await expect(viewerBox.x).toBe(0);
    await expect(viewerBox.y).toBe(0);
    await expect(viewerBox.width).toBe(viewport.innerWidth);
    await expect(viewerBox.height).toBe(viewport.innerHeight);
    const stage = viewer.querySelector<HTMLElement>('[data-ui="photo-grid-stage"]')!;
    await expect(stage).toBeVisible();
    await expect(stage.getBoundingClientRect().height).toBeGreaterThan(0);
    const image = stage.querySelector('img')!;
    await expect(image).toBeVisible();
    await expect(image).toHaveAttribute('src', photos[0]!.src);
    await waitFor(async () => {
      await expect(image.complete).toBe(true);
      await expect(image.naturalWidth).toBeGreaterThan(0);
    });
    await userEvent.click(canvas.getByRole('button', { name: 'Close viewer' }));
    await waitFor(expectClosed);
    await expect(album).toBeVisible();
  },
};
export const CustomSteps: Story = {
  args: { densitySteps: [4, 2, 1] },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('region')).toHaveAttribute('data-density', '4');
  },
};
export const Favorites: Story = {
  args: { defaultFavorites: ['p2', 'p4', 'unseen'] },
  play: async ({ canvasElement, args, userEvent }) => {
    await userEvent.click(favorites(canvasElement)[0]!);
    await expect(args.onFavoritesChange).toHaveBeenCalledTimes(1);
    await expect(args.onFavoritesChange).toHaveBeenLastCalledWith([
      'p2',
      'p4',
      'unseen',
      'p1',
    ]);
    await expect(args.onFavoriteChange).toHaveBeenCalledTimes(1);
    await expect(args.onFavoriteChange).toHaveBeenLastCalledWith('p1', true);
    await expect(args.onOpenChange).not.toHaveBeenCalled();
    await expect(favorites(canvasElement)[0]).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(favorites(canvasElement)[0]!);
    await expect(args.onFavoritesChange).toHaveBeenCalledTimes(2);
    await expect(args.onFavoritesChange).toHaveBeenLastCalledWith(['p2', 'p4', 'unseen']);
    await expect(args.onFavoriteChange).toHaveBeenLastCalledWith('p1', false);
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
    await expect(args.onFavoritesChange).toHaveBeenLastCalledWith(['p1']);
  },
};
export const Empty: Story = {
  tags: ['!autodocs'],
  args: { photos: [], defaultOpen: true },
  play: async ({ canvas, canvasElement, args }) => {
    await expect(canvas.getByText('No photos')).toBeInTheDocument();
    for (const toggle of densityToggles(canvas)) await expect(toggle).toBeDisabled();
    await expect(canvasElement.querySelector('dialog')).not.toHaveAttribute('open');
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await expect(args.onOpenChange).not.toHaveBeenCalled();
  },
};
export const SinglePhoto: Story = {
  // Excluded from the docs page: its open overlay (modal/backdrop) covers the documentation.
  tags: ['!autodocs'],
  args: { photos: photos.slice(0, 1), defaultOpen: true },
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('dialog', { name: 'Ridge at First Light' })).toBeVisible();
    await expect(canvas.queryByRole('group', { name: 'Choose photo' })).not.toBeInTheDocument();
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
        <FixtureButton onClick={() => setPage(1 - page)}>
          Change page
        </FixtureButton>
        <PhotoGrid
          {...args}
          photos={args.photos.slice(page * 4, page * 4 + 4)}
          defaultFavorites={['p1', 'saved-page']}
        />
      </>
    );
  },
  play: async ({ canvas, canvasElement, args, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Change page' }));
    await userEvent.click(favorites(canvasElement)[0]!);
    await expect(args.onFavoritesChange).toHaveBeenCalledTimes(1);
    await expect(args.onFavoritesChange).toHaveBeenLastCalledWith(['p1', 'saved-page', 'p5']);
  },
};
export const Light: Story = { decorators: [withLightTheme], globals: { theme: 'light' } };
export const Narrow: Story = {
  render: (args) => (
    <NarrowFrame>
      <PhotoGrid {...args} density={5} />
    </NarrowFrame>
  ),
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.getByRole('region')).toHaveAttribute('data-density', '5');
    await expect(canvas.getByRole('region')).toHaveAttribute('data-columns', '5');
    for (const button of [...tiles(canvasElement), ...favorites(canvasElement)]) {
      await expect(button.getBoundingClientRect().width).toBeGreaterThanOrEqual(32 - 1.1);
      await expect(button.getBoundingClientRect().height).toBeGreaterThanOrEqual(32 - 1.1);
    }
  },
};
export const RTL: Story = {
  args: { dir: 'rtl' },
  play: async ({ canvas, canvasElement, userEvent }) => {
    const buttons = tiles(canvasElement);
    await tabToFirstTile(canvas, userEvent);
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
          'Checks interactions. Enable reduced motion in the browser to check the animation behavior.',
      },
    },
  },
  play: async ({ canvas, args, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: '2 columns' }));
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
          'Checks favorites and focus. Enable forced colors in the browser to check computed styles.',
      },
    },
  },
  args: { defaultFavorites: ['p1'] },
};
export const ControlledRejected: Story = {
  args: { density: 3, favorites: [], value: null, open: false },
  play: async ({ canvas, canvasElement, args, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: '2 columns' }));
    await expect(canvas.getByRole('region')).toHaveAttribute('data-density', '3');
    await expect(canvas.getByRole('button', { name: '3 columns' })).toHaveAttribute('aria-pressed', 'true');
    await expect(canvas.getByRole('button', { name: '2 columns' })).toHaveAttribute('aria-pressed', 'false');
    await expect(args.onDensityChange).toHaveBeenCalledTimes(1);
    await expect(args.onDensityChange).toHaveBeenLastCalledWith(2);
    await userEvent.click(favorites(canvasElement)[0]!);
    await expect(favorites(canvasElement)[0]).toHaveAttribute('aria-pressed', 'false');
    await expect(args.onFavoritesChange).toHaveBeenCalledTimes(1);
    await expect(args.onFavoritesChange).toHaveBeenLastCalledWith(['p1']);
    await userEvent.click(tiles(canvasElement)[1]!);
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith('p2');
    await expect(args.onOpenChange).toHaveBeenCalledTimes(1);
    await expect(args.onOpenChange).toHaveBeenLastCalledWith(true);
    await waitFor(() => {
      const d = canvas.queryByRole('dialog');
      if (d) expect(d).not.toHaveAttribute('open');
    });
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
      await userEvent.click(canvas.getByRole('button', { name: '5 columns' }));
      await userEvent.click(favorites(canvasElement)[0]!);
      await userEvent.click(tiles(canvasElement)[1]!);
      await userEvent.click(canvas.getByRole('button', { name: 'Zoom in' }));
      await userEvent.click(canvas.getByRole('button', { name: 'Reset zoom' }));
      await userEvent.click(canvas.getByRole('button', { name: 'Next photo' }));
      await expect(announced).toEqual([
        '5 columns',
        'Remove Ridge at First Light from favorites',
        'Valley Floor, 2 / 12',
        'High Pass at Sunset, 3 / 12',
      ]);
    } finally {
      observer.disconnect();
    }
  },
};
export const ControlledValueRejected: Story = {
  // Excluded from the docs page: its open overlay (modal/backdrop) covers the documentation.
  tags: ['!autodocs'],
  args: { open: true, value: 'p1' },
  play: async ({ canvas, args, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Next photo' }));
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith('p2');
    await expect(canvas.getByRole('dialog')).toHaveAccessibleName('Ridge at First Light');
    await expect(canvas.getByRole('button', { name: 'Ridge at First Light, 1 / 12' })).toHaveAttribute(
      'aria-current',
      'true',
    );
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
    const root = canvas.getByRole('region', { name: 'Library September Traverse' });
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
  // Excluded from the docs page: its open overlay (modal/backdrop) covers the documentation.
  tags: ['!autodocs'],
  args: {
    defaultOpen: true,
    defaultValue: 'p3',
    photos: photos.map((photo) => ({ ...photo, alt: `Mountain view: ${photo.title}` })),
  },
  play: async ({ canvas }) => {
    const dialog = canvas.getByRole('dialog');
    await expect(dialog).toHaveAccessibleName('High Pass at Sunset');
    await expect(dialog.querySelector('[data-ui="photo-grid-stage"] img')).toHaveAttribute(
      'alt',
      'Mountain view: High Pass at Sunset',
    );
  },
};
export const PersistentFavorite: Story = { 
  // Excluded from the docs page: its open overlay (modal/backdrop) covers the documentation.
  tags: ['!autodocs'],
args: { defaultOpen: true, defaultFavorites: ['p1'] } };
export const PersistentImageZoom: Story = {
  // Excluded from the docs page: its open overlay (modal/backdrop) covers the documentation.
  tags: ['!autodocs'],
  args: { defaultOpen: true },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Zoom in' }));
    await waitFor(() => {
      expect(canvas.getByRole('group', { name: 'Ridge at First Light' })).toHaveAttribute('data-zoom', '1.5');
    });
    await expect(canvas.getByRole('button', { name: 'Pan left' })).toBeVisible();
  },
};
export const PersistentUnavailable: Story = { 
  // Excluded from the docs page: its open overlay (modal/backdrop) covers the documentation.
  tags: ['!autodocs'],
args: { defaultOpen: true, value: 'missing' } };
export const KeyboardPlay: Story = {
  play: async ({ canvas, canvasElement, args, userEvent }) => {
    const buttons = tiles(canvasElement);
    await tabToFirstTile(canvas, userEvent);
    await focused(buttons[0]!);
    const route: [string, number][] = [
      ['{ArrowRight}', 1],
      ['{ArrowLeft}', 0],
      ['{ArrowDown}', 3],
      ['{ArrowUp}', 0],
      ['{PageDown}', 9],
      ['{PageUp}', 0],
      ['{End}', 11],
      ['{ArrowDown}', 11],
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
    await expect(args.onFavoriteChange).toHaveBeenLastCalledWith('p1', true);
    await expect(args.onOpenChange).not.toHaveBeenCalled();
    await userEvent.tab({ shift: true });
    await userEvent.keyboard('{Enter}');
    const dialog = await canvas.findByRole('dialog');
    const viewer = within(dialog);
    await focused(viewer.getByRole('button', { name: 'Close viewer' }));
    await expect(args.onOpenChange).toHaveBeenCalledTimes(1);
    await expect(args.onOpenChange).toHaveBeenLastCalledWith(true);
    const stage = viewer.getByRole('group', { name: 'Ridge at First Light' });
    await userEvent.tab();
    await focused(stage);
    await userEvent.keyboard('{ArrowRight}');
    await expect(dialog).toHaveAccessibleName('Valley Floor');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith('p2');
    await userEvent.keyboard('{End}');
    await expect(dialog).toHaveAccessibleName('Night over the Hills');
    await userEvent.keyboard('{Home}');
    await expect(dialog).toHaveAccessibleName('Ridge at First Light');
    const thumbnails = within(viewer.getByRole('group', { name: 'Choose photo' })).getAllByRole('button');
    await expect(thumbnails).toHaveLength(12);
    await expect(thumbnails[0]).toHaveAttribute('aria-current', 'true');
    thumbnails[1]!.focus();
    await expect(fireEvent.keyDown(thumbnails[1]!, { key: 'ArrowRight' })).toBe(true);
    await expect(dialog).toHaveAccessibleName('Ridge at First Light');
    await userEvent.keyboard('{Enter}');
    await expect(dialog).toHaveAccessibleName('Valley Floor');
    await expect(thumbnails[1]).toHaveAccessibleName('Valley Floor, 2 / 12');
    await expect(thumbnails[1]).toHaveAttribute('aria-current', 'true');
    await expect(thumbnails[0]).not.toHaveAttribute('aria-current');
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
  // Excluded from the docs page: its open overlay (modal/backdrop) covers the documentation.
  tags: ['!autodocs'],
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
  // Excluded from the docs page: its open overlay (modal/backdrop) covers the documentation.
  tags: ['!autodocs'],
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

export const DensityControls: Story = {
  play: async ({ canvas, args, userEvent }) => {
    await expect(canvas.getByText('12 photos')).toBeVisible();
    await expect(canvas.getByText('3 columns')).toBeVisible();
    const toggles = densityToggles(canvas);
    await expect(toggles.map((toggle) => toggle.getAttribute('aria-label'))).toEqual([
      '5 columns',
      '3 columns',
      '2 columns',
    ]);
    await expect(toggles.map((toggle) => toggle.getAttribute('aria-pressed'))).toEqual(['false', 'true', 'false']);
    await userEvent.tab();
    await focused(toggles[0]!);
    await userEvent.tab();
    await userEvent.tab();
    await userEvent.keyboard(' ');
    await expect(args.onDensityChange).toHaveBeenCalledTimes(1);
    await expect(args.onDensityChange).toHaveBeenLastCalledWith(2);
    await expect(canvas.getByRole('region')).toHaveAttribute('data-density', '2');
    await expect(toggles.map((toggle) => toggle.getAttribute('aria-pressed'))).toEqual(['false', 'false', 'true']);
    await focused(toggles[2]!);
    await userEvent.keyboard(' ');
    await expect(args.onDensityChange).toHaveBeenCalledTimes(1);
    await new Promise((resolve) => setTimeout(resolve, 500));
  },
};

export const CtrlScrollDensity: Story = {
  args: { sx: { maxBlockSize: '22rem', overflowY: 'auto' } },
  play: async ({ canvasElement, args }) => {
    const target = tiles(canvasElement)[4]!;
    const before = target.getBoundingClientRect();
    const pointer = { clientX: before.left + before.width / 2, clientY: before.top + before.height / 2 };
    await expect(fireEvent.wheel(target, { ...pointer, deltaY: -20 })).toBe(true);
    await expect(fireEvent.wheel(target, { ...pointer, deltaY: -20, ctrlKey: true })).toBe(false);
    await expect(args.onDensityChange).not.toHaveBeenCalled();
    fireEvent.wheel(target, { ...pointer, deltaY: -40, ctrlKey: true });
    await expect(args.onDensityChange).toHaveBeenCalledTimes(1);
    await expect(args.onDensityChange).toHaveBeenLastCalledWith(2);
    await new Promise((resolve) => setTimeout(resolve, 500));
    const after = target.getBoundingClientRect();
    await expect(Math.abs(after.top + after.height / 2 - pointer.clientY)).toBeLessThan(1.1);
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
    await userEvent.click(canvas.getByRole('button', { name: '5 columns' }));
    await new Promise((resolve) => setTimeout(resolve, 500));
    await expect(canvas.getByRole('region')).toHaveAttribute('data-density', '5');
    await userEvent.click(favorites(canvasElement)[1]!);
    await expect(favorites(canvasElement)[1]).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(tiles(canvasElement)[1]!);
    await expect(canvas.getByRole('dialog')).toHaveAccessibleName('Valley Floor');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith('p2');
    await userEvent.click(canvas.getByRole('button', { name: 'Close viewer' }));
    await waitFor(() => {
      const d = canvas.queryByRole('dialog');
      if (d) expect(d).not.toHaveAttribute('open');
    });
    await expect(args.onOpenChange).toHaveBeenCalledTimes(2);
  },
};

export const RejectedNativeCloseRepair: Story = {
  // Excluded from the docs page: its open overlay (modal/backdrop) covers the documentation.
  tags: ['!autodocs'],
  args: { open: true, value: 'p1' },
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
        <FixtureButton onClick={() => setMounted(!mounted)}>
          Toggle collection
        </FixtureButton>
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

// These `css`, `sx` and inline values exercise the documented slot styling API.
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
  // Excluded from the docs page: its open overlay (modal/backdrop) covers the documentation.
  tags: ['!autodocs'],
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
    await expect(tiles(canvasElement)[0]).toHaveAccessibleName('Valley Floor');
    await waitFor(() => expect(canvasElement.ownerDocument.activeElement).toBe(tiles(canvasElement)[0]));
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
    await userEvent.click(canvas.getByRole('button', { name: '2 columns' }));
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
  // Excluded from the docs page: its open overlay (modal/backdrop) covers the documentation.
  tags: ['!autodocs'],
  args: { defaultOpen: true },
  play: async ({ canvas, args, userEvent }) => {
    let stage = canvas.getByRole('group', { name: 'Ridge at First Light' });
    spyOn(stage, 'setPointerCapture').mockImplementation(() => {});
    const pointer = { pointerId: 1, pointerType: 'touch', button: 0, clientX: 200, clientY: 200 };
    fireEvent.pointerDown(stage, pointer);
    fireEvent.pointerUp(stage, { ...pointer, clientX: 50 });
    await expect(canvas.getByRole('dialog')).toHaveAccessibleName('Valley Floor');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith('p2');
    stage = canvas.getByRole('group', { name: 'Valley Floor' });
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
    fireEvent.pointerMove(stage, { ...pointer, clientY: 20 });
    fireEvent.pointerUp(stage, { ...pointer, clientY: 20 });
    await expect(args.onOpenChange).not.toHaveBeenCalled();
    await expect(canvas.getByRole('dialog')).toHaveAttribute('open');
    fireEvent.pointerDown(stage, pointer);
    fireEvent.pointerUp(stage, { ...pointer, clientY: 350 });
    await waitFor(async () => {
      const d = canvas.queryByRole('dialog');
      if (d) expect(d).not.toHaveAttribute('open');
    });
    await expect(args.onOpenChange).toHaveBeenCalledTimes(1);
    await expect(args.onOpenChange).toHaveBeenLastCalledWith(false);
    await new Promise((resolve) => setTimeout(resolve, 500));
  },
};

export const RTLViewerGesture: Story = {
  tags: ['!autodocs'],
  args: { dir: 'rtl', defaultOpen: true, defaultValue: 'p2' },
  play: async ({ canvas, args }) => {
    const stage = canvas.getByRole('group', { name: 'Valley Floor' });
    spyOn(stage, 'setPointerCapture').mockImplementation(() => {});
    const pointer = { pointerId: 1, pointerType: 'touch', button: 0, clientX: 200, clientY: 200 };
    fireEvent.pointerDown(stage, pointer);
    fireEvent.pointerUp(stage, { ...pointer, clientX: 350 });
    await expect(canvas.getByRole('dialog')).toHaveAccessibleName('High Pass at Sunset');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith('p3');
    await new Promise((resolve) => setTimeout(resolve, 500));
  },
};

export const ViewerExternalAria: Story = {
  // Excluded from the docs page: its open overlay (modal/backdrop) covers the documentation.
  tags: ['!autodocs'],
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
    const dialog = canvas.getByRole('dialog', { name: 'Field collection Ridge at First Light' });
    await expect(dialog).toHaveAttribute('aria-label', 'Viewer label');
    await expect(dialog.getAttribute('aria-labelledby')).toContain('unresolved-viewer');
    await expect(dialog).toHaveAccessibleDescription('Large view Alpine traverse, 2800 m');
  },
};
