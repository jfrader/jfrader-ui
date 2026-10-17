import { useState, type ComponentPropsWithRef } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fireEvent, fn, waitFor, within } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { styled } from '../../styling/styled';
import { withLightTheme } from '../../testing/story-decorators';
import { sceneSource } from '../scene';
import { PhotoGrid, type PhotoGridPhoto } from './index';

const prints: PhotoGridPhoto[] = [
  { id: 'ridge', title: 'Alpine ridge', alt: 'Mountain ridgeline at dawn', src: sceneSource('gallery-ridge'), width: 1200, height: 800, detail: 'Archival landscape print' },
  { id: 'valley', title: 'Valley floor', alt: 'Light over an alpine valley', src: sceneSource('gallery-valley'), width: 1200, height: 800 },
  { id: 'pass', title: 'High pass', alt: 'A high mountain pass', src: sceneSource('gallery-pass'), width: 1200, height: 800 },
];
const dusk: PhotoGridPhoto[] = [{ ...prints[0]!, id: 'dusk', title: 'Evening ridge', alt: 'Mountain ridge in evening light', src: sceneSource('gallery-dusk', { variant: 'dusk' }) }];
const colors = [{ value: 'dawn', label: 'Dawn', photos: prints }, { value: 'dusk', label: 'Dusk', photos: dusk }, { value: 'night', label: 'Night', photos: [], soldOut: true }];
const options = [{ value: 'small', label: 'A4' }, { value: 'large', label: 'A2', soldOut: ['dusk'] }];
const Frame = styled.div({ inlineSize: '60rem', maxInlineSize: '100%', boxSizing: 'border-box', padding: vars.space[6] });
const NarrowFrame = styled.div({ inlineSize: '18rem', maxInlineSize: '100%' });
const PRODUCT_SOURCE = `<PhotoGrid
  variant="product"
  title="Alpine prints"
  colors={[
    { value: 'dawn', label: 'Dawn', photos: dawnPhotos },
    { value: 'dusk', label: 'Dusk', photos: duskPhotos },
  ]}
  options={[
    { value: 'small', label: 'A4' },
    { value: 'large', label: 'A2', soldOut: ['dusk'] },
  ]}
  onSelectedOptionChange={setPrintSize}
/>`;
const COVER_SOURCE = `<PhotoGrid variant="cover-flow" title="Alpine collection" photos={photos} onValueChange={setPhotoId} />`;
const preference: { matches: boolean; media?: MediaQueryList } = { matches: false };
function mockPreference(reduced: boolean) {
  const original = window.matchMedia.bind(window);
  preference.matches = reduced;
  if (!preference.media) {
    preference.media = original('(prefers-reduced-motion)');
    Object.defineProperty(preference.media, 'matches', { get: () => preference.matches });
  }
  preference.media.dispatchEvent(new MediaQueryListEvent('change', { matches: reduced }));
  window.matchMedia = (query) => query.includes('prefers-reduced-motion') ? preference.media! : original(query);
  return () => {
    preference.matches = false;
    preference.media!.dispatchEvent(new MediaQueryListEvent('change', { matches: false }));
    window.matchMedia = original;
  };
}
const meta = {
  title: 'Media/PhotoGrid', component: PhotoGrid, tags: ['autodocs'], globals: { theme: 'dark' },
  args: { variant: 'product', title: 'Alpine prints', colors, options, onValueChange: fn(), onOpenChange: fn(), onSelectedColorChange: fn(), onSelectedOptionChange: fn() },
  decorators: [(Story) => <Frame><Story /></Frame>],
  beforeEach: () => mockPreference(false),
  parameters: { layout: 'fullscreen', docs: {
    source: { code: PRODUCT_SOURCE, language: 'tsx' },
    description: { component: 'Browse a photo collection, inspect product images or select a cover from a depth rail.' },
    usage: `### Presentations
- Use variant="product" for a main image, thumbnail tabs and optional native color/size choices. Keep purchase actions in header/footer; the caller owns inventory and pricing.
- Use variant="cover-flow" for a short collection with one current cover and caption. Set depth={false} for a flat rail; reflection is optional decoration. No autoplay or modal opens on cover selection.
- All presentations keep PhotoGrid's string photo-ID value/defaultValue/onValueChange axis. Product colors supply collections using the same PhotoGridPhoto data, including required alt text and intrinsic dimensions.
- Color requests precede photo reset and unavailable-size clearing. Controlled axes only change when the caller accepts them. Keep controlled photo IDs valid for the accepted color. Unknown controlled IDs show unavailable content.
- Translate labels, including color/size group names and unavailable text. locale formats counts through Intl.

### Keyboard and gestures
- Product stage and thumbnail tabs use Left/Right (RTL-aware) and Home/End to select; Enter/Space on the main image opens the native modal. Native radio arrows skip disabled choices; unavailable options remain visible.
- Cover rail arrows, Home/End, previous/next and position buttons select without wrapping. Caption actions keep native keyboard behavior. Escape does not reset a cover.
- Swipe horizontally at least 40px to select one photo. The cover rail also accepts horizontal wheel movement; vertical page scroll and Ctrl+wheel are unchanged. Selection is discrete; there is no inertial throw.
- Fine-pointer hover magnifies product details. Inspect opens the shared modal with keyboard/touch zoom and pan controls. At product modal zoom > 1, Escape resets zoom; a second Escape closes and returns focus to the main image.
- Reduced motion and forced colors flatten the cover rail. Reduced motion disables hover magnification and transform transitions.`,
  } },
} satisfies Meta<typeof PhotoGrid>;
export default meta;
type Story = StoryObj<typeof PhotoGrid>;

export const Product: Story = {
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    const tabs = canvas.getAllByRole('tab');
    await expect(tabs).toHaveLength(3);
    await userEvent.click(tabs[0]!);
    await userEvent.keyboard('{ArrowRight}');
    await expect(tabs[1]).toHaveAttribute('aria-selected', 'true');
    await expect(canvasElement.ownerDocument.activeElement).toBe(tabs[1]);
    await expect(getComputedStyle(tabs[1]!).outlineStyle).not.toBe('none');
    await userEvent.keyboard('{End}{ArrowRight}');
    await expect(args.onValueChange).toHaveBeenCalledTimes(2);
    await expect(canvas.getByRole('tabpanel')).toHaveAccessibleName('High pass, 3 / 3');
    await userEvent.keyboard('{Home}');
    await expect(canvas.getByRole('tabpanel').querySelector('img')).toHaveAttribute('alt', prints[0]!.alt);
    await userEvent.click(canvas.getByRole('radio', { name: 'A2' }));
    await userEvent.click(canvas.getByRole('radio', { name: 'Dusk' }));
    await expect(args.onSelectedColorChange).toHaveBeenCalledTimes(1);
    await expect(args.onSelectedColorChange).toHaveBeenLastCalledWith('dusk');
    await expect(args.onSelectedOptionChange).toHaveBeenLastCalledWith(null);
    await expect(canvas.getByRole('radio', { name: 'A2 — Sold out' })).toBeDisabled();
    await expect(canvas.getByRole('tabpanel').querySelector('img')).toHaveAttribute('alt', dusk[0]!.alt);
  },
};
export const ProductLight: Story = { decorators: [withLightTheme], globals: { theme: 'light' } };
export const ProductNarrow: Story = { render: (args) => <NarrowFrame><PhotoGrid {...args} /></NarrowFrame> };
export const ProductRTL: Story = {
  args: { dir: 'rtl' },
  play: async ({ canvas, userEvent }) => {
    const tabs = canvas.getAllByRole('tab');
    await userEvent.click(tabs[0]!);
    await userEvent.keyboard('{ArrowLeft}');
    await expect(tabs[1]).toHaveAttribute('aria-selected', 'true');
    await userEvent.keyboard('{ArrowRight}');
    await expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
  },
};
export const ProductReducedMotion: Story = {
  args: { magnifier: false },
  parameters: { docs: { description: { story: 'Inspect with buttons instead of hover. Enable reduced motion in the browser to disable image travel.' } } },
};
export const ProductControlledRejected: Story = {
  args: { selectedColor: 'dawn', selectedOption: 'large', value: 'valley', open: false },
  play: async ({ canvas, args, userEvent }) => {
    await userEvent.click(canvas.getByRole('radio', { name: 'Dusk' }));
    await expect(canvas.getByRole('radio', { name: 'Dawn' })).toBeChecked();
    await expect(canvas.getByRole('radio', { name: 'A2' })).toBeChecked();
    await expect(canvas.getByRole('tabpanel').querySelector('img')).toHaveAttribute('alt', prints[1]!.alt);
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith('dusk');
    await expect(args.onSelectedOptionChange).toHaveBeenCalledTimes(1);
    await expect(args.onSelectedOptionChange).toHaveBeenLastCalledWith(null);
  },
};
export const ProductControlled: Story = {
  render: (args) => {
    const [color, setColor] = useState('dawn');
    const [value, setValue] = useState<string | null>('ridge');
    const [option, setOption] = useState<string | null>('large');
    return <PhotoGrid {...args} selectedColor={color} onSelectedColorChange={setColor} value={value} onValueChange={setValue} selectedOption={option} onSelectedOptionChange={setOption} />;
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('radio', { name: 'Dusk' }));
    await expect(canvas.getByRole('radio', { name: 'Dusk' })).toBeChecked();
    await expect(canvas.getByRole('radio', { name: 'A2 — Sold out' })).not.toBeChecked();
    await expect(canvas.getByRole('tabpanel').querySelector('img')).toHaveAttribute('alt', dusk[0]!.alt);
  },
};
export const ProductMixedRejected: Story = {
  args: { selectedColor: 'dawn', defaultValue: 'valley' },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('radio', { name: 'Dusk' }));
    await expect(canvas.getByRole('tabpanel').querySelector('img')).toHaveAttribute('alt', prints[1]!.alt);
    await userEvent.click(canvas.getByRole('tab', { name: 'High pass, 3 / 3' }));
    await expect(canvas.getByRole('tabpanel').querySelector('img')).toHaveAttribute('alt', prints[2]!.alt);
  },
};
export const ProductNativeChoices: Story = {
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(canvas.getByRole('radio', { name: 'A4' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Clear size' }));
    await expect(args.onSelectedOptionChange).toHaveBeenCalledTimes(2);
    await expect(args.onSelectedOptionChange).toHaveBeenLastCalledWith(null);
    await expect(canvas.getByRole('button', { name: 'Clear size' })).toBeDisabled();
    await userEvent.click(canvas.getByRole('radio', { name: 'Dawn' }));
    await userEvent.keyboard('{ArrowRight}');
    await expect(canvas.getByRole('radio', { name: 'Dusk' })).toBeChecked();
    await userEvent.keyboard('{ArrowRight}');
    await expect(canvas.getByRole('radio', { name: 'Dawn' })).toBeChecked();
    await expect(canvas.getByRole('radio', { name: 'Night — Sold out' })).toBeDisabled();
  },
};

function GalleryContainer(props: ComponentPropsWithRef<'div'>) {
  return <div {...props} data-gallery-replacement="container" />;
}
function GalleryChoices(props: ComponentPropsWithRef<'fieldset'>) {
  return <fieldset {...props} data-gallery-replacement="choices" />;
}
function GalleryButton(props: ComponentPropsWithRef<'button'>) {
  return <button {...props} data-gallery-replacement="button" />;
}
export const ProductReplacedParts: Story = {
  args: {
    slots: {
      presentationStage: GalleryContainer, main: GalleryButton, thumbnails: GalleryContainer,
      details: GalleryContainer, colors: GalleryChoices, options: GalleryChoices,
      caption: GalleryContainer, position: GalleryButton, navigation: GalleryContainer,
    },
    slotProps: { position: { onClick: fn((event) => event.preventDefault()) } },
  },
  play: async ({ canvas, canvasElement, args, userEvent }) => {
    const singletonParts = ['stage', 'thumbnails', 'details', 'colors', 'options', 'caption', 'navigation'];
    await expect(canvasElement.querySelectorAll('[data-gallery-replacement]')).toHaveLength(singletonParts.length + prints.length * 2);
    for (const part of canvasElement.querySelectorAll<HTMLElement>('[data-gallery-replacement]')) {
      await expect(part.className).not.toBe('');
    }
    await userEvent.click(canvas.getByRole('tab', { name: 'Valley floor, 2 / 3' }));
    await expect(args.slotProps?.position?.onClick).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await expect(canvas.getByRole('tab', { name: 'Alpine ridge, 1 / 3' })).toHaveAttribute('aria-selected', 'true');
  },
};
export const ProductViewer: Story = {
  tags: ['!autodocs'], args: { defaultOpen: true },
  play: async ({ canvas, canvasElement, userEvent }) => {
    const dialog = canvas.getByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Zoom in' }));
    const stage = dialog.querySelector('[data-ui="photo-grid-stage"]')!;
    await expect(stage).toHaveAttribute('data-zoom', '1.5');
    fireEvent(dialog, new Event('cancel', { cancelable: true }));
    await expect(stage).toHaveAttribute('data-zoom', '1');
    await expect(dialog).toHaveAttribute('open');
    fireEvent(dialog, new Event('cancel', { cancelable: true }));
    await waitFor(() => expect(dialog).not.toHaveAttribute('open'));
    await expect(canvasElement.ownerDocument.activeElement).toBe(canvasElement.querySelector('[data-ui="photo-grid-main"]'));
  },
};
export const ProductEmpty: Story = { args: { colors: [], photos: [] } };
export const ProductUnavailable: Story = { args: { value: 'missing' } };
export const ProductInvalidColor: Story = {
  args: { selectedColor: 'missing' },
  play: async ({ canvas, canvasElement }) => {
    const stage = canvasElement.querySelector<HTMLElement>('[data-ui="photo-grid-presentation-stage"]')!;
    await expect(within(stage).getByText('Photo unavailable')).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'Next photo' })).toBeDisabled();
  },
};
export const ProductStageKeyboard: Story = {
  play: async ({ canvas, canvasElement, userEvent }) => {
    const stage = canvasElement.querySelector<HTMLElement>('[data-ui="photo-grid-presentation-stage"]')!;
    await userEvent.tab();
    await expect(stage.ownerDocument.activeElement).toBe(stage);
    await userEvent.keyboard('{End}{ArrowRight}');
    await expect(canvas.getByRole('tabpanel')).toHaveAccessibleName('High pass, 3 / 3');
    await expect(stage.ownerDocument.activeElement).toBe(stage);
    await userEvent.keyboard('{Home}');
    await userEvent.tab();
    await userEvent.keyboard('{Enter}');
    const dialog = await canvas.findByRole('dialog');
    await expect(dialog.ownerDocument.activeElement).toBe(within(dialog).getByRole('button', { name: 'Close viewer' }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Close viewer' }));
  },
};
export const ProductFailedImage: Story = { args: { colors: [], photos: [{ ...prints[0]!, src: 'data:image/png;base64,broken' }] } };
export const ProductFalsyContent: Story = { args: { header: 0, footer: false, renderCaption: () => 0 } };

const coverArgs = { variant: 'cover-flow', photos: prints, colors: [], options: [], title: 'Alpine collection' } as const;
const coverParameters = { docs: { source: { code: COVER_SOURCE, language: 'tsx' } } };
export const CoverFlow: Story = { args: coverArgs, parameters: coverParameters };
export const CoverFlowLight: Story = { args: coverArgs, parameters: coverParameters, decorators: [withLightTheme], globals: { theme: 'light' } };
export const CoverFlowFlat: Story = { args: { ...coverArgs, depth: false }, parameters: { docs: { source: { code: '<PhotoGrid variant="cover-flow" depth={false} title="Alpine collection" photos={photos} />', language: 'tsx' } } } };
export const CoverFlowReflection: Story = { args: { ...coverArgs, reflection: true }, parameters: { docs: { source: { code: '<PhotoGrid variant="cover-flow" reflection title="Alpine collection" photos={photos} />', language: 'tsx' } } } };
export const CoverFlowReducedMotion: Story = {
  tags: ['!autodocs'],
  args: { ...coverArgs, depth: true },
  beforeEach: () => mockPreference(true),
  parameters: coverParameters,
  play: async ({ canvas, canvasElement, userEvent }) => {
    const rail = canvasElement.querySelector<HTMLElement>('[data-ui="photo-grid-presentation-stage"]')!;
    const covers = rail.querySelectorAll<HTMLElement>('[data-current]');
    await expect(covers).toHaveLength(prints.length);
    const expectFlat = async () => {
      for (const cover of covers) {
        await expect(cover).toHaveAttribute('data-flat', 'true');
        await expect(getComputedStyle(cover).transform).toBe('none');
        await expect(getComputedStyle(cover).transitionDuration).toBe('0s');
        await expect(getComputedStyle(cover).visibility).toBe(cover.dataset.current === 'true' ? 'visible' : 'hidden');
      }
    };
    await expectFlat();
    await userEvent.click(canvas.getByRole('button', { name: 'Next photo' }));
    await expect(covers[1]).toHaveAttribute('data-current', 'true');
    await expectFlat();
  },
};
export const CoverFlowKeyboard: Story = {
  args: coverArgs,
  parameters: coverParameters,
  play: async ({ canvas, canvasElement, args, userEvent }) => {
    const rail = canvasElement.querySelector<HTMLElement>('[data-ui="photo-grid-presentation-stage"]')!;
    await userEvent.tab();
    await expect(rail.ownerDocument.activeElement).toBe(rail);
    await expect(getComputedStyle(rail).outlineStyle).not.toBe('none');
    await userEvent.keyboard('{ArrowLeft}{Home}');
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await userEvent.keyboard('{ArrowRight}{End}{ArrowRight}');
    await expect(args.onValueChange).toHaveBeenCalledTimes(2);
    await expect(within(rail).getByRole('group')).toHaveAccessibleName('High pass, 3 / 3');
    await userEvent.keyboard('{Home}');
    await userEvent.click(canvas.getByRole('button', { name: 'Valley floor, 2 / 3' }));
    await expect(canvas.getByRole('button', { name: 'Valley floor, 2 / 3' })).toHaveAttribute('aria-current', 'true');
    await expect(canvas.queryByRole('dialog')).not.toBeInTheDocument();
  },
};
export const CoverFlowRTL: Story = {
  args: { ...coverArgs, dir: 'rtl' },
  parameters: coverParameters,
  play: async ({ canvasElement, userEvent }) => {
    await userEvent.tab();
    await userEvent.keyboard('{ArrowLeft}');
    await expect(within(canvasElement).getByRole('button', { name: 'Valley floor, 2 / 3' })).toHaveAttribute('aria-current', 'true');
  },
};
export const CoverFlowControlledRejected: Story = {
  args: { ...coverArgs, value: 'ridge' },
  parameters: coverParameters,
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Next photo' }));
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith('valley');
    await expect(canvas.getByRole('button', { name: 'Alpine ridge, 1 / 3' })).toHaveAttribute('aria-current', 'true');
  },
};
export const CoverFlowGestures: Story = {
  args: coverArgs,
  parameters: coverParameters,
  play: async ({ canvasElement, args }) => {
    const rail = canvasElement.querySelector<HTMLElement>('[data-ui="photo-grid-presentation-stage"]')!;
    const pointer = { pointerId: 1, button: 0, clientX: 200, clientY: 100 };
    fireEvent.pointerDown(rail, pointer);
    fireEvent.pointerCancel(rail, pointer);
    fireEvent.pointerUp(rail, { ...pointer, clientX: 100 });
    await expect(args.onValueChange).not.toHaveBeenCalled();
    fireEvent.pointerDown(rail, pointer);
    fireEvent.pointerUp(rail, { ...pointer, clientX: 100 });
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith('valley');
    fireEvent.wheel(rail, { deltaX: 100, deltaY: 0 });
    await expect(args.onValueChange).toHaveBeenLastCalledWith('pass');
    await expect(fireEvent.wheel(rail, { deltaX: 0, deltaY: 100 })).toBe(true);
    await expect(fireEvent.wheel(rail, { deltaX: 100, deltaY: 0, ctrlKey: true })).toBe(true);
    await expect(args.onValueChange).toHaveBeenCalledTimes(2);
    fireEvent.pointerDown(rail, pointer);
    fireEvent.pointerUp(rail, { ...pointer, clientY: 250 });
    await expect(args.onValueChange).toHaveBeenCalledTimes(2);
  },
};
export const CoverFlowEmpty: Story = { args: { ...coverArgs, photos: [] }, parameters: coverParameters };
export const CoverFlowSingle: Story = { args: { ...coverArgs, photos: prints.slice(0, 1) }, parameters: coverParameters };
export const CoverFlowCustomCaption: Story = {
  args: { ...coverArgs, renderCaption: (photo) => `${photo.title} — limited print` },
  parameters: { docs: { source: { code: '<PhotoGrid variant="cover-flow" title="Prints" photos={photos} renderCaption={(photo) => `${photo.title} — limited print`} />', language: 'tsx' } } },
};
