import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fireEvent, fn, waitFor, within } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { settleMotion } from '../../testing/motion-assertions';
import { expectInside } from '../../testing/geometry-assertions';
import { sceneSource } from '../scene';
import { GalleryEditor, type GalleryEditorPhoto, type GalleryEditorProps } from './index';
// `styled` is the app-facing styling API; consumers import it from `@jfrader/ui`.
import { styled } from '../../index';

const photos: GalleryEditorPhoto[] = [
  { id: 'hills', src: sceneSource('listing-highland-pass', { variant: 'landscape' }), width: 800, height: 500, alt: 'Layered hills beneath a low sun', caption: 'Highland pass' },
  { id: 'dunes', src: sceneSource('listing-dune-walk', { variant: 'dunes' }), width: 500, height: 750, alt: 'Sun above warm sand dunes', caption: 'Dune walk' },
  { id: 'dusk', src: sceneSource('listing-last-light', { variant: 'dusk' }), width: 600, height: 600, alt: 'Moon above violet hills at dusk', caption: 'Blue hour' },
  { id: 'tide', src: sceneSource('listing-tidal-bay', { variant: 'tide' }), width: 900, height: 400, alt: 'Sun over tidal water', caption: 'Tidal bay' },
  { id: 'ridge', src: sceneSource('listing-ridge-walk', { variant: 'landscape' }), width: 600, height: 900, alt: 'Mountain ridges under a cloudy sky', caption: 'Ridge walk' },
  { id: 'shore', src: sceneSource('listing-north-shore', { variant: 'tide' }), width: 800, height: 800, alt: 'Foam along a sandy shoreline', caption: 'North shore' },
];

const Frame = styled.div({
  inlineSize: '52rem',
  maxInlineSize: '100%',
  boxSizing: 'border-box',
  padding: vars.space[4],
});
const NarrowFrame = styled.div({ inlineSize: '20rem', maxInlineSize: '100%' });

const photosSource = `const photos = [
  { id: 'hills', src: sceneSource('listing-highland-pass', { variant: 'landscape' }), width: 800, height: 500, alt: 'Layered hills beneath a low sun', caption: 'Highland pass' },
  { id: 'dunes', src: sceneSource('listing-dune-walk', { variant: 'dunes' }), width: 500, height: 750, alt: 'Sun above warm sand dunes', caption: 'Dune walk' },
  { id: 'dusk', src: sceneSource('listing-last-light', { variant: 'dusk' }), width: 600, height: 600, alt: 'Moon above violet hills at dusk', caption: 'Blue hour' },
  { id: 'tide', src: sceneSource('listing-tidal-bay', { variant: 'tide' }), width: 900, height: 400, alt: 'Sun over tidal water', caption: 'Tidal bay' },
  { id: 'ridge', src: sceneSource('listing-ridge-walk', { variant: 'landscape' }), width: 600, height: 900, alt: 'Mountain ridges under a cloudy sky', caption: 'Ridge walk' },
  { id: 'shore', src: sceneSource('listing-north-shore', { variant: 'tide' }), width: 800, height: 800, alt: 'Foam along a sandy shoreline', caption: 'North shore' },
];`;
const editorSource = `import { useState } from 'react';
import { GalleryEditor } from '@jfrader/ui/gallery-editor';
import { sceneSource } from '@jfrader/ui/scene';

${photosSource}

export function ListingPhotos() {
  const [items, setItems] = useState(photos);
  const [coverId, setCoverId] = useState('hills');
  return (
    <GalleryEditor
      label="Listing photos"
      photos={items}
      primaryId={coverId}
      onSetPrimary={(photo) => setCoverId(photo.id)}
      onDelete={(removed) => setItems((current) => current.filter((photo) => !removed.includes(photo)))}
      onUpload={(files) =>
        setItems((current) => [
          ...current,
          ...files.map((file) => ({ id: crypto.randomUUID(), src: URL.createObjectURL(file), alt: file.name })),
        ])
      }
    />
  );
}`;
const snippet = (element: string) => `import { GalleryEditor } from '@jfrader/ui/gallery-editor';
import { sceneSource } from '@jfrader/ui/scene';

${photosSource}

${element}`;

/** App-owned state around the editor, so covers, deletes, and uploads show on the canvas. */
function EditableGallery(props: GalleryEditorProps) {
  const [items, setItems] = useState(props.photos);
  const [coverId, setCoverId] = useState(props.primaryId);
  return (
    <GalleryEditor
      {...props}
      photos={items}
      primaryId={coverId}
      onSetPrimary={(photo) => {
        setCoverId(photo.id);
        return props.onSetPrimary?.(photo);
      }}
      onDelete={(removed) => {
        setItems((current) => current.filter((photo) => !removed.includes(photo)));
        return props.onDelete?.(removed);
      }}
      onUpload={(files) => {
        setItems((current) => [
          ...current,
          ...files.map((file) => ({ id: crypto.randomUUID(), src: URL.createObjectURL(file), alt: file.name })),
        ]);
        return props.onUpload?.(files);
      }}
    />
  );
}
EditableGallery.displayName = 'GalleryEditorStory.EditableGallery';

const meta = {
  title: 'Media/GalleryEditor',
  component: GalleryEditor,
  tags: ['autodocs'],
  args: {
    photos,
    label: 'Listing photos',
    primaryId: 'hills',
    locale: 'en-US',
    onUpload: fn(),
    onDelete: fn(),
    onSetPrimary: fn(),
    onValueChange: fn(),
    onSelectionChange: fn(),
  },
  render: (args) => <EditableGallery {...args} />,
  decorators: [
    (Story) => (
      <Frame>
        <Story />
      </Frame>
    ),
  ],
  parameters: {
    layout: 'padded',
    docs: {
      sections: [
        { title: 'Basic', stories: ['Default', 'Empty', 'NoHeading'] },
        { title: 'Cover', stories: ['SetPrimary'] },
        { title: 'Selection', stories: ['BulkDelete', 'SingleDelete'] },
        { title: 'Upload', stories: ['EmptyUpload', 'UploadError'] },
        { title: 'Keyboard', stories: ['Keyboard'] },
        { title: 'States', stories: ['ReadOnly', 'Busy'] },
        { title: 'Layout', stories: ['CompactNarrow'] },
      ],
      description: {
        component: 'Upload, order, preview, and delete the photos of a record, and choose its cover.',
      },
      usage: `### When to use
Use GalleryEditor where a record owns an ordered photo collection with one cover, such as a listing or a product. Choose PhotoGrid or LightboxGallery to browse photos without editing them.

### Values and constraints

\`photos\` and \`primaryId\` are yours: update them from \`onUpload\`, \`onDelete\`, and \`onSetPrimary\`. Each callback may return a promise; mutating controls stay disabled until it settles, and a rejection shows an inline error. \`onDelete\` runs once per confirmation with every confirmed photo. \`maxFiles\` caps each pick or drop, and extra files are rejected with \`labels.rejection\`. Supply \`width\` and \`height\` for an uncropped preview.

### Selection

Check a tile, Ctrl or Cmd click to toggle it, and Shift click to add the range from the last checked tile. While a selection exists, a click picks one tile alone, and the toolbar offers select all, clear, and delete.

### Keyboard and accessibility

The grid is one Tab stop. Arrow keys move between tiles, Home and End jump to the ends, and Enter or Space opens the preview. Tab reaches the focused tile's checkbox and actions. P sets the focused photo as the cover, Delete asks to delete it, and Escape clears the selection. Escape closes the preview and returns focus to the tile.

Drop files anywhere on the gallery to upload them. The cover carries a text badge, so it never depends on color alone.`,
    },
  },
} satisfies Meta<typeof GalleryEditor>;
export default meta;
type Story = StoryObj<typeof meta>;

const tiles = (element: HTMLElement) => Array.from(element.querySelectorAll<HTMLLIElement>('[data-ui~="gallery-editor-tile"]'));
const photoButtons = (element: HTMLElement) =>
  Array.from(element.querySelectorAll<HTMLButtonElement>('[data-ui="gallery-editor-photo"]'));
const fileInput = (element: HTMLElement) => element.querySelector<HTMLInputElement>('input[type="file"]')!;
const viewer = (element: HTMLElement) => element.querySelector<HTMLDialogElement>('[data-ui="lightbox-gallery-viewer"]')!;
const status = (element: HTMLElement) => element.querySelector<HTMLElement>('[data-ui="gallery-editor-status"]')!;
/** A real scene image, so an uploaded file renders as a photo tile. */
const image = async (name: string) =>
  new File([await (await fetch(sceneSource(name, { variant: 'landscape' }))).blob()], name, { type: 'image/svg+xml' });
const list = (element: HTMLElement) => element.querySelector<HTMLUListElement>('[data-ui~="gallery-editor-list"]')!;
const uploadTarget = (element: HTMLElement) => element.querySelector<HTMLElement>('[data-ui="file-dropzone"] [data-dragging]')!;
/** Shows a tile's overlays through focus inside it, as hover does, so its controls take pointer events. */
function reveal<T extends HTMLElement>(control: T) {
  control.closest('li')!.querySelector<HTMLButtonElement>('[data-ui="gallery-editor-photo"]')!.focus();
  return control;
}
/** Dispatches a file drag event; fireEvent copies a DataTransfer into an empty one. */
function drag(target: Element, type: string, ...files: File[]) {
  const transfer = new DataTransfer();
  for (const file of files) transfer.items.add(file);
  const event = new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: transfer });
  target.dispatchEvent(event);
  return event;
}
/** A native dialog closes on a real Escape through `cancel`; synthetic key events do not reach it. */
function cancel(dialog: HTMLDialogElement) {
  fireEvent(dialog, new Event('cancel', { cancelable: true }));
}
async function focusVisible(element: HTMLElement) {
  await expect(element.ownerDocument.activeElement).toBe(element);
  await expect(getComputedStyle(element).outlineStyle).not.toBe('none');
}

export const Default: Story = {
  name: 'Gallery with a cover',
  parameters: {
    docs: {
      description: { story: 'Hover a tile to reveal its actions, set another cover, or drop files on the gallery.' },
      source: { language: 'tsx', code: editorSource },
    },
  },
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.getByRole('region', { name: 'Listing photos' })).toBeInTheDocument();
    await expect(canvas.getByText('6 photos')).toBeInTheDocument();
    await expect(tiles(canvasElement)).toHaveLength(photos.length);
    const [cover] = tiles(canvasElement);
    await expect(within(cover!).getByText('Cover')).toBeVisible();
    await expect(within(cover!).getByRole('button', { name: 'Layered hills beneath a low sun, cover' })).toBeInTheDocument();
    await expect(within(cover!).queryByRole('button', { name: /as cover/ })).not.toBeInTheDocument();
    for (const button of photoButtons(canvasElement)) {
      const box = button.getBoundingClientRect();
      await expect(Math.abs(box.width / box.height - 4 / 3)).toBeLessThan(0.02);
      const img = button.querySelector('img')!;
      await expect(img).toHaveAttribute('loading', 'lazy');
      await expect(img).toHaveAttribute('decoding', 'async');
      await expect(img).toHaveAttribute('alt', '');
    }
    await expect(photoButtons(canvasElement).filter((button) => button.tabIndex === 0)).toHaveLength(1);
  },
};

export const Empty: Story = {
  name: 'Empty',
  args: { photos: [], primaryId: null },
  parameters: {
    docs: {
      description: { story: 'With no photos, the whole gallery is the drop target.' },
      source: { language: 'tsx', code: snippet('<GalleryEditor label="Listing photos" photos={[]} onUpload={(files) => uploadPhotos(files)} />') },
    },
  },
};

export const NoHeading: Story = {
  name: 'Without a heading',
  args: { title: null },
  parameters: {
    docs: {
      description: { story: 'Pass `title={null}` when the surrounding tab or panel already names the photos.' },
      source: { language: 'tsx', code: snippet('<GalleryEditor label="Listing photos" title={null} photos={photos} primaryId="hills" />') },
    },
  },
  play: async ({ canvas }) => {
    await expect(canvas.queryByRole('heading')).not.toBeInTheDocument();
    await expect(canvas.getByRole('region', { name: 'Listing photos' })).toBeInTheDocument();
    await expect(canvas.getByRole('list', { name: 'Listing photos' })).toBeInTheDocument();
    await expect(canvas.getByText('6 photos')).toBeInTheDocument();
  },
};

export const HiddenOverlayClick: Story = {
  tags: ['!autodocs'],
  play: async ({ args, canvas, canvasElement, userEvent }) => {
    const button = photoButtons(canvasElement)[1]!;
    (canvasElement.ownerDocument.activeElement as HTMLElement | null)?.blur();
    await userEvent.hover(canvas.getByRole('heading'));
    const overlay = canvas.getByRole('checkbox', { name: 'Select Sun above warm sand dunes' }).closest('[data-ui="checkbox"]')!.parentElement!;
    // Computed style, not an elementFromPoint hit test: viewport coordinates depend on scroll position.
    // Pointerless environments (headless CI, touch) keep the overlay interactive by design; hover-capable ones keep it inert until hover or focus.
    const hoverCapable = canvasElement.ownerDocument.defaultView!.matchMedia('(hover: hover)').matches;
    await expect(getComputedStyle(overlay).pointerEvents).toBe(hoverCapable ? 'none' : 'auto');
    await userEvent.click(button);
    await waitFor(() => expect(viewer(canvasElement).open).toBe(true));
    await expect(args.onValueChange).toHaveBeenLastCalledWith('dunes');
    await expect(args.onSelectionChange).not.toHaveBeenCalled();
  },
};

export const SetPrimary: Story = {
  name: 'Choose the cover',
  parameters: {
    docs: {
      description: { story: 'Use the crown on any tile to make it the cover; the badge moves with it.' },
      source: { language: 'tsx', code: editorSource },
    },
  },
  play: async ({ args, canvas, canvasElement, userEvent }) => {
    await userEvent.click(reveal(canvas.getByRole('button', { name: 'Set Sun above warm sand dunes as cover' })));
    await expect(args.onSetPrimary).toHaveBeenCalledTimes(1);
    await expect(args.onSetPrimary).toHaveBeenCalledWith(photos[1]);
    const [first, second] = tiles(canvasElement);
    await expect(within(second!).getByText('Cover')).toBeVisible();
    await expect(within(first!).queryByText('Cover')).not.toBeInTheDocument();
    await expect(within(first!).getByRole('button', { name: 'Set Layered hills beneath a low sun as cover' })).toBeInTheDocument();
    await expect(status(canvasElement)).toHaveTextContent('Sun above warm sand dunes is the cover');
  },
};

export const SingleDelete: Story = {
  name: 'Delete one photo',
  parameters: {
    docs: {
      description: { story: 'Delete a photo from its tile, then confirm.' },
      source: { language: 'tsx', code: editorSource },
    },
  },
  play: async ({ args, canvas, canvasElement, userEvent }) => {
    await userEvent.click(reveal(canvas.getByRole('button', { name: 'Delete Moon above violet hills at dusk' })));
    const dialog = await canvas.findByRole('dialog', { name: 'Delete 1 photo?' });
    await expect(args.onDelete).not.toHaveBeenCalled();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
    await expect(args.onDelete).toHaveBeenCalledTimes(1);
    await expect(args.onDelete).toHaveBeenCalledWith([photos[2]]);
    await waitFor(() => expect(tiles(canvasElement)).toHaveLength(photos.length - 1));
    await waitFor(() => expect(canvasElement.ownerDocument.activeElement).toHaveAccessibleName('Sun over tidal water'));
  },
};

export const BulkDelete: Story = {
  name: 'Select and delete several',
  parameters: {
    docs: {
      description: { story: 'Check a tile, Shift click another checkbox to add the range, then delete them together.' },
      source: { language: 'tsx', code: editorSource },
    },
  },
  play: async ({ args, canvas, canvasElement, userEvent }) => {
    await userEvent.click(reveal(canvas.getByRole('checkbox', { name: 'Select Layered hills beneath a low sun' })));
    await userEvent.keyboard('{Shift>}');
    await userEvent.click(canvas.getByRole('checkbox', { name: 'Select Moon above violet hills at dusk' }));
    await userEvent.keyboard('{/Shift}');
    const toolbar = canvas.getByRole('group', { name: '3 selected' });
    await expect(args.onSelectionChange).toHaveBeenLastCalledWith(['hills', 'dunes', 'dusk']);
    await expect(status(canvasElement)).toHaveTextContent('3 selected');
    const calls = (args.onSelectionChange as ReturnType<typeof fn>).mock.calls.length;
    await userEvent.keyboard('{Shift>}');
    await userEvent.click(canvas.getByRole('checkbox', { name: 'Select Moon above violet hills at dusk' }));
    await userEvent.keyboard('{/Shift}');
    await expect(args.onSelectionChange).toHaveBeenCalledTimes(calls);
    await userEvent.click(within(toolbar).getByRole('button', { name: 'Delete' }));
    const dialog = await canvas.findByRole('dialog', { name: 'Delete 3 photos?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
    await expect(args.onDelete).toHaveBeenCalledTimes(1);
    await expect(args.onDelete).toHaveBeenCalledWith(photos.slice(0, 3));
    await waitFor(() => expect(canvas.queryByRole('group', { name: /selected/ })).not.toBeInTheDocument());
    await expect(args.onSelectionChange).toHaveBeenLastCalledWith([]);
    await expect(tiles(canvasElement)).toHaveLength(3);
    await expect(status(canvasElement)).toHaveTextContent('3 photos deleted');
  },
};

export const ModifierSelection: Story = {
  tags: ['!autodocs'],
  play: async ({ args, canvas, canvasElement, userEvent }) => {
    const [first, second, third] = photoButtons(canvasElement);
    await userEvent.keyboard('{Control>}');
    await userEvent.click(first!);
    await userEvent.click(third!);
    await userEvent.keyboard('{/Control}');
    await expect(args.onSelectionChange).toHaveBeenLastCalledWith(['hills', 'dusk']);
    await expect(status(canvasElement)).toHaveTextContent('2 selected');
    await expect(viewer(canvasElement).open).toBe(false);
    await userEvent.click(second!);
    await expect(args.onSelectionChange).toHaveBeenLastCalledWith(['dunes']);
    await expect(canvas.getByRole('group', { name: '1 selected' })).toBeInTheDocument();
    await expect(status(canvasElement)).toHaveTextContent('1 selected');
    await expect(viewer(canvasElement).open).toBe(false);
    await userEvent.click(canvas.getByRole('button', { name: 'Select all' }));
    await expect(args.onSelectionChange).toHaveBeenLastCalledWith(photos.map((photo) => photo.id));
    await expect(status(canvasElement)).toHaveTextContent('6 selected');
    await userEvent.click(canvas.getByRole('button', { name: 'Clear' }));
    await expect(args.onSelectionChange).toHaveBeenLastCalledWith([]);
    await expect(status(canvasElement)).toHaveTextContent('Selection cleared');
    await expect(canvasElement.ownerDocument.activeElement).toBe(photoButtons(canvasElement).find((button) => button.tabIndex === 0));
  },
};

export const EmptyUpload: Story = {
  name: 'First upload',
  args: { photos: [], primaryId: null },
  parameters: {
    docs: {
      description: { story: 'Browse for photos or drop them on the empty gallery.' },
      source: { language: 'tsx', code: snippet('<GalleryEditor label="Listing photos" photos={[]} onUpload={(files) => uploadPhotos(files)} />') },
    },
  },
  play: async ({ args, canvas, canvasElement, userEvent }) => {
    await expect(canvas.getByRole('heading', { name: 'No photos yet' })).toBeInTheDocument();
    await expect(canvas.queryByText('0 photos')).not.toBeInTheDocument();
    const region = canvasElement.querySelector<HTMLElement>('[data-ui~="gallery-editor"]')!;
    const target = uploadTarget(canvasElement);
    await expect(target.closest('[data-ui="empty-state"]')).toBeNull();
    await expect(Math.abs(target.getBoundingClientRect().width - region.clientWidth)).toBeLessThanOrEqual(1);
    await expect(target.getBoundingClientRect().height).toBeGreaterThanOrEqual(159);
    const files = [await image('porch.svg'), await image('kitchen.svg')];
    await userEvent.upload(fileInput(canvasElement), files);
    await expect(args.onUpload).toHaveBeenCalledTimes(1);
    await expect(args.onUpload).toHaveBeenCalledWith(files);
    await waitFor(() => expect(tiles(canvasElement)).toHaveLength(2));
    for (const img of canvasElement.querySelectorAll<HTMLImageElement>('[data-ui="gallery-editor-photo"] img')) {
      await waitFor(() => expect(img.complete && img.naturalWidth > 0).toBe(true));
    }
  },
};

export const EmptyDrop: Story = {
  tags: ['!autodocs'],
  args: { photos: [], primaryId: null },
  play: async ({ args, canvasElement }) => {
    const file = await image('garden.svg');
    drag(uploadTarget(canvasElement), 'drop', file);
    await expect(args.onUpload).toHaveBeenCalledTimes(1);
    await expect(args.onUpload).toHaveBeenCalledWith([file]);
    await waitFor(() => expect(tiles(canvasElement)).toHaveLength(1));
  },
};

export const GridDrop: Story = {
  tags: ['!autodocs'],
  play: async ({ args, canvasElement }) => {
    const file = await image('garden.svg');
    const region = canvasElement.querySelector('[data-ui~="gallery-editor"]')!;
    drag(list(canvasElement), 'dragenter', file);
    await waitFor(() => expect(region).toHaveAttribute('data-dragging', 'true'));
    drag(list(canvasElement), 'drop', file);
    await expect(args.onUpload).toHaveBeenCalledTimes(1);
    await expect(args.onUpload).toHaveBeenCalledWith([file]);
    await waitFor(() => expect(region).not.toHaveAttribute('data-dragging'));
  },
};

export const FileLimit: Story = {
  tags: ['!autodocs'],
  args: { maxFiles: 1 },
  render: (args) => <GalleryEditor {...args} />,
  play: async ({ args, canvas, canvasElement, userEvent }) => {
    const files = [await image('porch.svg'), await image('kitchen.svg')];
    await userEvent.upload(fileInput(canvasElement), files);
    await expect(args.onUpload).toHaveBeenCalledTimes(1);
    await expect(args.onUpload).toHaveBeenCalledWith([files[0]]);
    await expect(await canvas.findByRole('alert')).toHaveTextContent('Too many files.');
  },
};

export const UploadError: Story = {
  name: 'Failed upload',
  args: { onUpload: fn(() => Promise.reject(new Error('Network unavailable'))) },
  render: (args) => <GalleryEditor {...args} />,
  parameters: {
    docs: {
      description: { story: 'A rejected `onUpload` shows an inline error; the gallery stays usable.' },
      source: { language: 'tsx', code: snippet('<GalleryEditor label="Listing photos" photos={photos} primaryId="hills" onUpload={(files) => uploadPhotos(files)} />') },
    },
  },
  play: async ({ args, canvas, canvasElement, userEvent }) => {
    await userEvent.upload(fileInput(canvasElement), [await image('porch.svg')]);
    await expect(args.onUpload).toHaveBeenCalledTimes(1);
    await expect(await canvas.findByRole('alert')).toHaveTextContent('Upload failed.');
    await waitFor(() => expect(canvas.getByRole('region', { name: 'Listing photos' })).not.toHaveAttribute('aria-busy'));
    await expect(fileInput(canvasElement)).toBeEnabled();
    await expect(canvas.getByRole('button', { name: 'Delete Sun over tidal water' })).toBeEnabled();
  },
};

export const PendingDelete: Story = {
  tags: ['!autodocs'],
  args: { onDelete: fn(() => new Promise<void>(() => {})) },
  render: (args) => <GalleryEditor {...args} />,
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(reveal(canvas.getByRole('button', { name: 'Delete Sun over tidal water' })));
    const dialog = await canvas.findByRole('dialog', { name: 'Delete 1 photo?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
    await expect(args.onDelete).toHaveBeenCalledTimes(1);
    await expect(canvas.getByRole('region', { name: 'Listing photos', hidden: true })).toHaveAttribute('aria-busy', 'true');
    await expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeDisabled();
    await expect(within(dialog).getByRole('button', { name: 'Delete' })).toHaveAttribute('aria-busy', 'true');
  },
};

export const Keyboard: Story = {
  name: 'Keyboard',
  parameters: {
    docs: {
      description: { story: 'Tab into the grid, move with the arrow keys, and press Enter to preview.' },
      source: { language: 'tsx', code: editorSource },
    },
  },
  play: async ({ args, canvasElement, userEvent }) => {
    const buttons = photoButtons(canvasElement);
    await userEvent.tab();
    await focusVisible(buttons[0]!);
    await userEvent.keyboard('{ArrowRight}');
    await focusVisible(buttons[1]!);
    await userEvent.keyboard('{End}');
    await focusVisible(buttons[5]!);
    await userEvent.keyboard('{ArrowUp}');
    const columns = getComputedStyle(buttons[0]!.closest('ul')!).gridTemplateColumns.split(' ').length;
    await focusVisible(buttons[5 - columns]!);
    await userEvent.keyboard('{Home}');
    await userEvent.keyboard('{ArrowRight}');
    await expect(buttons.filter((button) => button.tabIndex === 0)).toEqual([buttons[1]]);
    await userEvent.keyboard('{Enter}');
    const dialog = viewer(canvasElement);
    await waitFor(() => expect(dialog.open).toBe(true));
    await expect(args.onValueChange).toHaveBeenLastCalledWith('dunes');
    await expect(dialog).toHaveAccessibleName('Listing photos — Sun above warm sand dunes');
    await settleMotion(dialog);
    await userEvent.keyboard('{ArrowRight}');
    await expect(args.onValueChange).toHaveBeenLastCalledWith('dusk');
    await waitFor(() => expect(dialog).toHaveAccessibleName('Listing photos — Moon above violet hills at dusk'));
    cancel(dialog);
    await waitFor(() => expect(dialog.open).toBe(false));
    await waitFor(() => expect(canvasElement.ownerDocument.activeElement).toBe(buttons[2]));
    await userEvent.keyboard('p');
    await expect(args.onSetPrimary).toHaveBeenCalledWith(photos[2]);
    await userEvent.keyboard('{Delete}');
    const confirm = canvasElement.querySelector<HTMLDialogElement>('[data-ui="dialog"]')!;
    await waitFor(() => expect(confirm.open).toBe(true));
    cancel(confirm);
    await waitFor(() => expect(confirm.open).toBe(false));
    await expect(args.onDelete).not.toHaveBeenCalled();
    await waitFor(() => expect(canvasElement.ownerDocument.activeElement).toBe(buttons[2]));
  },
};

export const ReadOnly: Story = {
  name: 'Read-only',
  args: { readOnly: true },
  parameters: {
    docs: {
      description: { story: 'Browse and preview the photos without editing them.' },
      source: { language: 'tsx', code: snippet('<GalleryEditor label="Listing photos" photos={photos} primaryId="hills" readOnly />') },
    },
  },
  play: async ({ canvas, canvasElement, userEvent }) => {
    await expect(canvas.queryAllByRole('checkbox')).toHaveLength(0);
    await expect(canvas.queryByRole('button', { name: /^Delete|as cover$/ })).not.toBeInTheDocument();
    await expect(canvasElement.querySelector('input[type="file"]')).toBeNull();
    await expect(canvas.getByText('Cover')).toBeVisible();
    await userEvent.click(photoButtons(canvasElement)[3]!);
    const dialog = viewer(canvasElement);
    await waitFor(() => expect(dialog.open).toBe(true));
    await settleMotion(dialog);
    cancel(dialog);
    await waitFor(() => expect(dialog.open).toBe(false));
    await waitFor(() => expect(canvasElement.ownerDocument.activeElement).toBe(photoButtons(canvasElement)[3]));
  },
};

export const Busy: Story = {
  name: 'Busy',
  args: { busy: true },
  parameters: {
    docs: {
      description: { story: 'Set `busy` while another change to the photos is saving.' },
      source: { language: 'tsx', code: snippet('<GalleryEditor label="Listing photos" photos={photos} primaryId="hills" busy onUpload={uploadPhotos} onDelete={deletePhotos} onSetPrimary={setCover} />') },
    },
  },
  play: async ({ args, canvas, canvasElement }) => {
    await expect(canvas.getByRole('region', { name: 'Listing photos' })).toHaveAttribute('aria-busy', 'true');
    const drop = drag(list(canvasElement), 'drop', await image('garden.svg'));
    await expect(drop.defaultPrevented).toBe(true);
    await expect(args.onUpload).not.toHaveBeenCalled();
    await expect(canvas.getByRole('button', { name: 'Delete Sun over tidal water' })).toBeDisabled();
    await expect(canvas.getByRole('button', { name: 'Set Sun over tidal water as cover' })).toBeDisabled();
    await expect(fileInput(canvasElement)).toBeDisabled();
    await expect(photoButtons(canvasElement)[0]).toBeEnabled();
  },
};

export const CompactNarrow: Story = {
  name: 'Compact in a narrow column',
  args: { density: 'compact' },
  decorators: [
    (Story) => (
      <NarrowFrame>
        <Story />
      </NarrowFrame>
    ),
  ],
  parameters: {
    docs: {
      description: { story: 'Compact density fits more, smaller tiles into a narrow column.' },
      source: { language: 'tsx', code: snippet('<GalleryEditor label="Listing photos" photos={photos} primaryId="hills" density="compact" />') },
    },
  },
  play: async ({ canvasElement }) => {
    const grid = list(canvasElement);
    await expect(getComputedStyle(grid).gridTemplateColumns.split(' ').length).toBeGreaterThanOrEqual(2);
    for (const tile of tiles(canvasElement)) await expectInside(tile, grid);
    const region = canvasElement.querySelector<HTMLElement>('[data-ui~="gallery-editor"]')!;
    await expect(region.scrollWidth).toBeLessThanOrEqual(region.clientWidth + 1);
  },
};
