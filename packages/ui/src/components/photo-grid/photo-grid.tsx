import { withoutSx } from '../../styling/sx';
'use client';

import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentPropsWithRef,
  type ComponentType,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { useMergeRefs } from '@floating-ui/react';
import { LayoutGroup, MotionConfig, motion, useMotionValue, useReducedMotion, useTransform } from 'motion/react';
import { vars } from '@jfrader/tokens/vars';
import {
  useNativeDialog,
  useNativeDialogRoot,
  omitNativeOpen,
  type NativeDialogController,
} from '../../overlay/use-native-dialog';
import { styledDialogTransition } from '../../overlay/exit-motion';
import { css, keyframes, type Interpolation, type Theme } from '../../styling/css';
import { focusRingInset, focusRingOutset } from '../../styling/focus-ring';
import { FORCED_COLORS, REDUCED_MOTION, REDUCED_TRANSPARENCY } from '../../styling/media';
import type { SxProps } from '../../styling/sx';
import { PresentationSlot, type PresentationProps } from '../../utils/presentation-slot';
import { numberFormatter } from '../../utils/intl';
import { isRenderable } from '../../utils/renderable';
import { useControlledState } from '../../utils/use-controlled-state';
import { GalleryPresentation, isPhotoGridOptionSoldOut, PRODUCT_ASPECT_RATIO } from './gallery-presentation';
import { PhotoImage, photoFallbackStyle } from './photo-image';
export { isPhotoGridOptionSoldOut } from './gallery-presentation';
import {
  ChromeAction,
  type ChromeActionProps,
  chromeIcons,
  filmstripStyle,
  Glyph,
  StarGlyph,
  thumbStyle,
} from '../viewer-chrome/viewer-chrome';

export interface PhotoGridPhoto {
  id: string;
  src: string;
  srcSet?: string;
  sizes?: string;
  alt: string;
  width: number;
  height: number;
  title: string;
  detail?: ReactNode;
}

export interface PhotoGridColor {
  value: string;
  label: string;
  photos: readonly PhotoGridPhoto[];
  soldOut?: boolean;
}

export interface PhotoGridOption {
  value: string;
  label: string;
  /** Disable everywhere, or for the listed color values. */
  soldOut?: boolean | readonly string[];
}

type Slot<Tag extends keyof React.JSX.IntrinsicElements> = ComponentPropsWithRef<Tag> & {
  sx?: Interpolation<Theme>;
};
type ActionSlot = Slot<'button'>;

export interface PhotoGridSlotProps {
  /** Outer gallery element. */
  root?: PresentationProps<'div'>;
  presentationStage?: Slot<'div'>;
  main?: ActionSlot;
  thumbnails?: Slot<'div'>;
  details?: Slot<'div'>;
  colors?: Slot<'fieldset'>;
  options?: Slot<'fieldset'>;
  caption?: Slot<'div'>;
  position?: ActionSlot;
  navigation?: Slot<'div'>;
  /** Header bar holding the title and density controls. */
  header?: Slot<'header'>;
  /** Heading element displaying the grid title. */
  title?: Slot<'h2'>;
  /** Container element wrapping column density controls. */
  density?: Slot<'div'>;
  /** Unordered list element rendering photo grid items. */
  list?: Slot<'ul'>;
  /** List item element wrapping an individual photo. */
  item?: Slot<'li'>;
  /** Button element opening the full photo viewer. */
  photo?: ActionSlot;
  /** Button element toggling the photo favorite state. */
  favorite?: ActionSlot;
  /** Favorite action in the full photo viewer. */
  viewerFavorite?: Partial<ChromeActionProps> & { sx?: Interpolation<Theme> };
  /** Dialog element for the full photo viewer modal. */
  viewer?: Omit<Slot<'dialog'>, 'open'>;
  /** Container element displaying the active photo in the viewer. */
  stage?: Slot<'div'>;
  /** Thumbnail strip container for browsing photos in the viewer. */
  filmstrip?: Slot<'div'>;
  /** Action container holding viewer close and navigation buttons. */
  controls?: Slot<'div'>;
  /** Status element displaying the photo index and total count. */
  status?: Slot<'div'>;
}

export interface PhotoGridSlots {
  /** Replaces the outer gallery element. */
  root?: ComponentType<ComponentPropsWithRef<'div'>>;
  presentationStage?: ComponentType<Slot<'div'>>;
  main?: ComponentType<ActionSlot>;
  thumbnails?: ComponentType<Slot<'div'>>;
  details?: ComponentType<Slot<'div'>>;
  colors?: ComponentType<Slot<'fieldset'>>;
  options?: ComponentType<Slot<'fieldset'>>;
  caption?: ComponentType<Slot<'div'>>;
  position?: ComponentType<ActionSlot>;
  navigation?: ComponentType<Slot<'div'>>;
  /** Header holding the title and density controls. */
  header?: ComponentType<Slot<'header'>>;
  /** Heading displaying the grid title. */
  title?: ComponentType<Slot<'h2'>>;
  /** Container holding density controls. */
  density?: ComponentType<Slot<'div'>>;
  /** List of photo tiles. */
  list?: ComponentType<Slot<'ul'>>;
  /** List item surrounding a photo. */
  item?: ComponentType<Slot<'li'>>;
  /** Button opening the photo viewer. */
  photo?: ComponentType<ActionSlot>;
  /** Button toggling a tile favorite. */
  favorite?: ComponentType<ActionSlot>;
  /** Favorite action in the full photo viewer. */
  viewerFavorite?: ComponentType<NonNullable<PhotoGridSlotProps['viewerFavorite']>>;
  /** Dialog displaying the full photo viewer. */
  viewer?: ComponentType<Omit<Slot<'dialog'>, 'open'>>;
  /** Container displaying the active photo. */
  stage?: ComponentType<Slot<'div'>>;
  /** Thumbnail strip for browsing photos. */
  filmstrip?: ComponentType<Slot<'div'>>;
  /** Container holding viewer navigation controls. */
  controls?: ComponentType<Slot<'div'>>;
  /** Live region announcing grid updates. */
  status?: ComponentType<Slot<'div'>>;
}

export interface PhotoGridLabels {
  carousel: string;
  slide: string;
  navigationHint: string;
  colors: string;
  options: string;
  clearOption: string;
  soldOut: string;
  inspect: string;
  /** @deprecated No longer rendered: each density step is a toggle named by `columns`. Removed in the next major. */
  larger: string;
  /** @deprecated No longer rendered: each density step is a toggle named by `columns`. Removed in the next major. */
  smaller: string;
  density: string;
  empty: string;
  unavailable: string;
  imageUnavailable: string;
  close: string;
  previous: string;
  next: string;
  filmstrip: string;
  zoomIn: string;
  zoomOut: string;
  resetZoom: string;
  panLeft: string;
  panRight: string;
  panUp: string;
  panDown: string;
  favorite: (title: string, favorite: boolean) => string;
  openPhoto: (title: string, alt: string, favorite: boolean) => string;
  position: (position: string, total: string, title: string) => string;
  /** Names a density step and the current density. `columns` is formatted; `count` selects the plural. */
  columns: (columns: string, count: number) => string;
  /** The album size under the title. `count` is formatted; `total` selects the plural. */
  photoCount: (count: string, total: number) => string;
}

export interface PhotoGridProps
  extends Omit<ComponentPropsWithRef<'div'>, 'children' | 'defaultValue'>, SxProps {
  /** Photo collection; product colors may supply their own collections instead. */
  photos?: readonly PhotoGridPhoto[];
  /** Shorthand for slots.root. */
  component?: PhotoGridSlots['root'];
  /** Name the gallery and display its heading. */
  title: string;
  /** Keep the grid, show a product detail, or browse a focused cover rail. */
  variant?: 'grid' | 'product' | 'cover-flow';
  /** Cover rail geometry; reduced motion and forced colors also flatten depth. */
  depth?: boolean;
  /** Show reflected images in the cover-flow rail. Defaults to `false`. */
  reflection?: boolean;
  /** Supply product color choices and their photo collections. */
  colors?: readonly PhotoGridColor[];
  /** Supply product options, including availability by color. */
  options?: readonly PhotoGridOption[];
  /** Control the selected product color by its `value`. */
  selectedColor?: string;
  /** Seed the uncontrolled color. Defaults to the first color that is not sold out. */
  defaultSelectedColor?: string;
  /** Receive requests to select a product color. */
  onSelectedColorChange?: (value: string) => void;
  /** Control the selected product option by its `value`, or `null` for none. */
  selectedOption?: string | null;
  /** Seed the uncontrolled product option. Defaults to `null`. */
  defaultSelectedOption?: string | null;
  /** Receive requests to select or clear a product option. */
  onSelectedOptionChange?: (value: string | null) => void;
  /** Content above the product or cover-flow presentation; ignored by `variant="grid"`. */
  header?: ReactNode;
  /** Content below the product or cover-flow presentation; ignored by `variant="grid"`. */
  footer?: ReactNode;
  /** Render the current product or cover-flow caption; ignored by `variant="grid"`. */
  renderCaption?: (photo: PhotoGridPhoto, index: number) => ReactNode;
  /** Fine-pointer inspection. The modal zoom controls remain available when false. */
  magnifier?: boolean;
  /** Positive product image ratio; defaults to 4 / 5. */
  aspectRatio?: number;
  /** Maximum modal magnification, finite and at least 1; defaults to 3. */
  zoomFactor?: number;
  /** Column counts offered as density steps. The container width never overrides them. */
  densitySteps?: readonly number[];
  /** Control the grid column count, snapped to the nearest `densitySteps` entry. */
  density?: number;
  /** Seed the uncontrolled column count. Defaults to the density step nearest 3. */
  defaultDensity?: number;
  /** Receive requests to change the grid column count. */
  onDensityChange?: (columns: number) => void;
  /** Control the collection of favorite photo ids. */
  favorites?: readonly string[];
  /** Seed the uncontrolled favorite photo ids. Defaults to an empty list. */
  defaultFavorites?: readonly string[];
  /** Receive the next favorite photo ids after a toggle. */
  onFavoritesChange?: (ids: string[]) => void;
  /** Receive the toggled photo id and its requested favorite state. */
  onFavoriteChange?: (id: string, favorite: boolean) => void;
  /** Control the active photo id, or `null` for no selection. */
  value?: string | null;
  /** Seed the uncontrolled active photo. Defaults to the first photo id, or `null` if empty. */
  defaultValue?: string | null;
  /** Receive requests to change the active photo id. */
  onValueChange?: (id: string | null) => void;
  /** Control whether the full-photo viewer is open. */
  open?: boolean;
  /** Open the uncontrolled full-photo viewer initially. Defaults to `false`. */
  defaultOpen?: boolean;
  /** Receive requests to open or close the full-photo viewer. */
  onOpenChange?: (open: boolean) => void;
  /** Override individual action labels, empty states, and announcement formatters. */
  labels?: Partial<PhotoGridLabels>;
  /** Choose the locale for photo counts, positions, and column counts. */
  locale?: Intl.LocalesArgument;
  /** Pass props to gallery, product, cover-flow, and viewer parts. */
  slotProps?: PhotoGridSlotProps;
  /** Replace gallery, product, cover-flow, and viewer elements. */
  slots?: PhotoGridSlots;
}

declare const process: { env: { NODE_ENV?: string } };

const DEFAULT_STEPS = [5, 3, 2] as const;
const DEFAULT_DENSITY = 3;
const EMPTY_IDS: readonly string[] = [];
const EMPTY_PHOTOS: readonly PhotoGridPhoto[] = [];
const EMPTY_COLORS: readonly PhotoGridColor[] = [];
const EMPTY_OPTIONS: readonly PhotoGridOption[] = [];
interface PhotoSelection {
  id: string | null;
  color: string | undefined;
  previous?: { id: string | null; color: string | undefined };
}
const PAGE_ROWS = 3;
const PINCH_THRESHOLD = 0.15;
/** Accumulated Ctrl-wheel distance, in px, that requests one density step. */
const WHEEL_STEP_PX = 50;
/** Pixels per wheel line, for wheels that report `DOM_DELTA_LINE`. */
const WHEEL_LINE_PX = 16;
const ZOOM_STEP = 0.5;
const MAX_ZOOM = 3;
const PAN_STEP = 40;
const DISMISS_DISTANCE = 100;
/** Density glyphs draw at most this many columns; denser steps share the densest glyph. */
const GLYPH_MAX_COLUMNS = 6;
/** Opacity of the chrome bars and tile favorites over the photo, before the blur. */
const CHROME_MIX = '85%';
/** Narrow or hoverless viewports: the viewer drops previous/next (swipe and the filmstrip remain) and shrinks. */
const COMPACT_CHROME = '@media (max-width: 40rem), (hover: none)';
/** Cells narrower than this show the favorite below the photo instead of over it. */
const COMPACT_CELL = '@container (max-width: 7rem)';
const SPRING = { type: 'spring', stiffness: 360, damping: 36 } as const;
const englishPlural = new Intl.PluralRules('en');
const favoritePop = keyframes({ from: { transform: 'scale(0.85)' }, to: { transform: 'scale(1)' } });
const captionFade = keyframes({ from: { opacity: 0 }, to: { opacity: 1 } });
const defaultLabels: PhotoGridLabels = {
  carousel: 'carousel',
  slide: 'slide',
  navigationHint: 'Use Left and Right arrows, Home or End to choose a photo.',
  colors: 'Color',
  options: 'Size',
  clearOption: 'Clear size',
  soldOut: 'Sold out',
  inspect: 'Inspect photo',
  larger: 'Larger thumbnails',
  smaller: 'Smaller thumbnails',
  density: 'Thumbnail size',
  empty: 'No photos',
  unavailable: 'Photo unavailable',
  imageUnavailable: 'Image unavailable',
  close: 'Close viewer',
  previous: 'Previous photo',
  next: 'Next photo',
  filmstrip: 'Choose photo',
  zoomIn: 'Zoom in',
  zoomOut: 'Zoom out',
  resetZoom: 'Reset zoom',
  panLeft: 'Pan left',
  panRight: 'Pan right',
  panUp: 'Pan up',
  panDown: 'Pan down',
  favorite: (title, favorite) =>
    `${favorite ? 'Remove' : 'Add'} ${title} ${favorite ? 'from' : 'to'} favorites`,
  openPhoto: (title, alt, favorite) =>
    `${title}${alt && alt !== title ? `, ${alt}` : ''}${favorite ? ', favorite' : ''}`,
  position: (position, total, title) => `${title}, ${position} / ${total}`,
  columns: (columns, count) => `${columns} ${englishPlural.select(count) === 'one' ? 'column' : 'columns'}`,
  photoCount: (count, total) => `${count} ${englishPlural.select(total) === 'one' ? 'photo' : 'photos'}`,
};

const translucentChrome = {
  background: `color-mix(in oklab, ${vars.color.bg} ${CHROME_MIX}, transparent)`,
  backdropFilter: `blur(${vars.space[3]})`,
  [REDUCED_TRANSPARENCY]: { background: vars.color.bg, backdropFilter: 'none' },
};

const rootStyle = css({
  label: 'photo-grid',
  display: 'grid',
  gap: vars.space[4],
  minInlineSize: 0,
  fontFamily: vars.font.sans,
  color: vars.color.text,
  lineHeight: vars.lineHeight.base,
  '&:focus-visible': focusRingOutset,
});
const headerStyle = css({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: vars.space[3],
});
const headingStyle = css({ display: 'grid', gap: vars.space[1], minInlineSize: 0 });
const titleStyle = css({
  margin: 0,
  fontSize: vars.textSize.lg,
  fontWeight: vars.fontWeight.semibold,
  overflowWrap: 'anywhere',
});
const summaryStyle = css({
  display: 'flex',
  flexWrap: 'wrap',
  gap: vars.space[3],
  margin: 0,
  fontSize: vars.textSize.sm,
  color: vars.color.textMuted,
  fontVariantNumeric: 'tabular-nums',
});
const densityStyle = css({
  display: 'flex',
  gap: vars.space[1],
  padding: vars.space[1],
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.full,
  background: vars.color.surfaceInset,
});
const segmentStyle = css({ borderRadius: vars.radius.full });
const listStyle = css({
  display: 'grid',
  gridTemplateColumns: 'repeat(var(--photo-grid-columns), minmax(0, 1fr))',
  gap: vars.space[1],
  padding: 0,
  margin: 0,
  listStyle: 'none',
  touchAction: 'pan-y',
});
const cellStyle = css({ containerType: 'inline-size' });
const itemStyle = css({ position: 'relative', display: 'grid', gap: vars.space[1], minInlineSize: 0 });
const photoStyle = css({
  appearance: 'none',
  boxSizing: 'border-box',
  position: 'relative',
  display: 'grid',
  placeItems: 'center',
  inlineSize: '100%',
  aspectRatio: '1',
  padding: 0,
  border: `1px solid ${vars.color.borderControl}`,
  borderRadius: vars.radius.sm,
  background: vars.color.surfaceInset,
  color: vars.color.text,
  font: 'inherit',
  fontSize: vars.textSize.sm,
  cursor: 'pointer',
  overflow: 'hidden',
  '&:focus-visible': focusRingOutset,
  [FORCED_COLORS]: { borderColor: 'ButtonText' },
});
// Over the photo, the favorite shows while pressed, focused or hovered, and always without hover.
const tileFavoriteStyle = css({
  font: 'inherit',
  appearance: 'none',
  boxSizing: 'border-box',
  position: 'absolute',
  insetBlockEnd: vars.space[2],
  insetInlineStart: vars.space[2],
  display: 'grid',
  placeItems: 'center',
  inlineSize: vars.space[8],
  blockSize: vars.space[8],
  padding: 0,
  border: `1px solid ${vars.color.borderControl}`,
  borderRadius: vars.radius.full,
  color: vars.color.text,
  cursor: 'pointer',
  ...translucentChrome,
  opacity: 0,
  transitionProperty: 'opacity',
  transitionDuration: vars.motion.duration.fast,
  transitionTimingFunction: vars.motion.easeStandard,
  '*:hover > &, &:focus-visible, &[aria-pressed="true"]': { opacity: 1 },
  '&:focus-visible': focusRingOutset,
  '&[aria-pressed="true"]': {
    color: vars.color.accentText,
    animation: `${favoritePop} ${vars.motion.duration.base} ${vars.motion.easeStandard}`,
  },
  '@media (hover: none)': { opacity: 1 },
  [COMPACT_CELL]: { position: 'static', justifySelf: 'start', opacity: 1, background: vars.color.surfaceRaised },
  [REDUCED_MOTION]: { transitionDuration: '0s', '&[aria-pressed="true"]': { animation: 'none' } },
  [FORCED_COLORS]: { borderColor: 'ButtonText', '&[aria-pressed="true"]': { borderColor: 'Highlight' } },
});
const imageBoxStyle = css({ inlineSize: '100%', blockSize: '100%', minInlineSize: 0, minBlockSize: 0, borderRadius: 'inherit' });
const viewerStyle = css({
  boxSizing: 'border-box',
  inlineSize: '100%',
  blockSize: '100dvh',
  maxInlineSize: '100%',
  maxBlockSize: '100dvh',
  overflow: 'hidden',
  border: 'none',
  borderRadius: 0,
  padding: 0,
  margin: 0,
  background: vars.color.bg,
  color: vars.color.text,
  fontFamily: vars.font.sans,
  position: 'fixed',
  inset: 0,
  '&[open]': { display: 'flex' },
  flexDirection: 'column',
  '&::backdrop': { background: vars.color.scrim },
});
// The stage spans every row; the chrome bars sit over its top and bottom edges.
const viewerContentStyle = css({
  display: 'grid',
  gridTemplateRows: 'auto minmax(0, 1fr) auto',
  gridTemplateColumns: 'minmax(0, 1fr)',
  flex: '1 1 0',
  minBlockSize: 0,
  transitionProperty: 'opacity, transform',
  transitionDuration: vars.motion.duration.slow,
  transitionTimingFunction: vars.motion.easeStandard,
  'dialog[data-state="closing"] &': { opacity: 0, transform: 'scale(0.98)' },
  [REDUCED_MOTION]: { transitionDuration: '0s' },
});
const barStyle = css({
  zIndex: 1,
  gridColumn: '1',
  display: 'grid',
  gap: vars.space[2],
  minInlineSize: 0,
  ...translucentChrome,
  [FORCED_COLORS]: { border: '1px solid CanvasText' },
});
const topBarStyle = css({
  gridRow: '1',
  gridTemplateColumns: 'minmax(0, 1fr) auto',
  alignItems: 'center',
  padding: `max(${vars.space[2]}, env(safe-area-inset-top)) max(${vars.space[4]}, env(safe-area-inset-right)) ${vars.space[2]} max(${vars.space[4]}, env(safe-area-inset-left))`,
});
const bottomBarStyle = css({
  gridRow: '3',
  padding: `${vars.space[2]} max(${vars.space[4]}, env(safe-area-inset-right)) max(${vars.space[2]}, env(safe-area-inset-bottom)) max(${vars.space[4]}, env(safe-area-inset-left))`,
});
const viewerTitleStyle = css({
  margin: 0,
  fontSize: vars.textSize.md,
  fontWeight: vars.fontWeight.semibold,
  overflowWrap: 'anywhere',
});
const toolbarStyle = css({
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) auto minmax(0, 1fr)',
  alignItems: 'center',
  gap: vars.space[2],
  [COMPACT_CHROME]: { gridTemplateColumns: 'minmax(0, 1fr) auto' },
});
const controlsStyle = css({ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: vars.space[1] });
const favoriteSlotStyle = css({ justifySelf: 'end' });
const compactHiddenStyle = css({ [COMPACT_CHROME]: { display: 'none' } });
const dividerStyle = css({
  alignSelf: 'stretch',
  marginBlock: vars.space[2],
  marginInline: vars.space[1],
  borderInlineStart: `1px solid ${vars.color.border}`,
});
const stageStyle = css({
  position: 'relative',
  gridRow: '1 / -1',
  gridColumn: '1',
  display: 'grid',
  placeItems: 'center',
  minBlockSize: 0,
  overflow: 'hidden',
  touchAction: 'none',
  '&:focus-visible': focusRingInset,
});
const viewerThumbStyle = css({
  scrollMarginInline: vars.space[1],
  [COMPACT_CHROME]: { inlineSize: vars.space[8], blockSize: vars.space[8] },
});
const statusStyle = css({
  fontSize: vars.textSize.sm,
  color: vars.color.textMuted,
  overflowWrap: 'anywhere',
});
const counterStyle = css({
  fontSize: vars.textSize.sm,
  fontVariantNumeric: 'tabular-nums',
  overflowWrap: 'anywhere',
  [COMPACT_CHROME]: { gridColumn: '1 / -1' },
});
const detailStyle = css({
  margin: 0,
  color: vars.color.textMuted,
  fontSize: vars.textSize.sm,
  overflowWrap: 'anywhere',
  animation: `${captionFade} ${vars.motion.duration.slow} ${vars.motion.easeStandard}`,
  [REDUCED_MOTION]: { animation: 'none' },
});
const viewerDetailStyle = css({ color: vars.color.text });

function ids(...parts: (string | undefined | false)[]) {
  return parts.filter(Boolean).join(' ') || undefined;
}
function normalizeSteps(steps: readonly number[]) {
  const valid = [...new Set(steps.filter((n) => Number.isInteger(n) && n > 0))].sort((a, b) => b - a);
  return valid.length ? valid : [...DEFAULT_STEPS];
}
function nearestDensity(density: number | undefined, steps: readonly number[]) {
  if (density === undefined || !Number.isFinite(density))
    return steps.includes(DEFAULT_DENSITY) ? DEFAULT_DENSITY : steps[0]!;
  return steps.reduce(
    (best, step) => (Math.abs(step - density) < Math.abs(best - density) ? step : best),
    steps[0]!,
  );
}
function scrollBy(element: HTMLElement, delta: number) {
  let parent: HTMLElement | null = element;
  while (parent) {
    if (
      /(auto|scroll)/.test(getComputedStyle(parent).overflowY) &&
      parent.scrollHeight > parent.clientHeight
    ) {
      parent.scrollTop += delta;
      return;
    }
    parent = parent.parentElement;
  }
  element.ownerDocument.defaultView?.scrollBy(0, delta);
}

/** An n×n grid of cells, one glyph per density step. */
function DensityGlyph({ columns }: { columns: number }) {
  const count = Math.min(columns, GLYPH_MAX_COLUMNS);
  const gap = 1;
  const cell = (14 - gap * (count - 1)) / count;
  const offsets = Array.from({ length: count }, (_, index) => 1 + index * (cell + gap));
  return (
    <Glyph>
      {offsets.flatMap((y) =>
        offsets.map((x) => (
          <rect key={`${x} ${y}`} x={x} y={y} width={cell} height={cell} rx={cell / 4} fill="currentColor" stroke="none" />
        )),
      )}
    </Glyph>
  );
}

function PhotoButton({
  component: Component = 'button',
  ref,
  register,
  ...props
}: ComponentPropsWithRef<'button'> & { component?: 'button' | PhotoGridSlots['photo']; register: (node: HTMLButtonElement | null) => (() => void) | void }) {
  const mergedRef = useMergeRefs([ref, register]);
  return <Component {...props} ref={mergedRef} />;
}

interface ViewerProps {
  product: boolean;
  maxZoom: number;
  photos: readonly PhotoGridPhoto[];
  selected: string | null | undefined;
  open: boolean;
  controller: NativeDialogController;
  select: (id: string) => void;
  favorites: ReadonlySet<string>;
  toggleFavorite: (id: string) => void;
  labels: PhotoGridLabels;
  format: Intl.NumberFormat;
  slots?: PhotoGridSlotProps;
  components?: PhotoGridSlots;
  restore: () => void;
}

function PhotoViewer({
  product,
  maxZoom,
  photos,
  selected,
  open,
  controller,
  select,
  favorites,
  toggleFavorite,
  labels,
  format,
  slots,
  components,
  restore,
}: ViewerProps) {
  const Viewer = components?.viewer ?? 'dialog';
  const Stage = components?.stage ?? 'div';
  const Controls = components?.controls ?? 'div';
  const Filmstrip = components?.filmstrip ?? 'div';
  const ViewerFavorite = components?.viewerFavorite ?? ChromeAction;
  const id = useId();
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const filmstripRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const mergedStageRef = useMergeRefs([stageRef, slots?.stage?.ref]);
  const mergedFilmstripRef = useMergeRefs([filmstripRef, slots?.filmstrip?.ref]);
  const lifecycle = controller;
  const viewerSlot = omitNativeOpen(slots?.viewer ?? {});
  const { label: favoriteLabel, sx: favoriteCss, ...favoriteSlot } = slots?.viewerFavorite ?? {};
  const native = useNativeDialog(
    { ...lifecycle, open: open && photos.length > 0 },
    {
      onCancel: (event) => {
        if (product && zoom > 1 && event.cancelable) {
          setZoom(1);
          event.preventDefault();
        }
        if (event.target === event.currentTarget) viewerSlot.onCancel?.(event);
      },
      onClick: viewerSlot.onClick,
      onClose: (event) => {
        if (event.target === event.currentTarget) {
          viewerSlot.onClose?.(event);
          restore();
        }
      },
    },
    viewerSlot.ref,
    dialogRef,
    styledDialogTransition,
  );
  const present = open || native['data-state'] === 'closing';
  const index = photos.findIndex((photo) => photo.id === selected);
  const photo = photos[index];
  const [zoomState, setZoomState] = useState({ id: selected, value: 1 });
  const zoom = zoomState.id === selected ? zoomState.value : 1;
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const scale = useMotionValue(1);
  const reduced = useReducedMotion();
  const position = photo
    ? labels.position(format.format(index + 1), format.format(photos.length), photo.title)
    : labels.unavailable;
  const hasDetail = photo && isRenderable(photo.detail) && photo.detail !== '';
  const favorite = !!photo && favorites.has(photo.id);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{
    originX: number;
    originY: number;
    x: number;
    y: number;
    distance?: number;
    zoom: number;
  } | null>(null);

  useEffect(() => {
    // Keep the last zoom/pan through the retained exit so the closing frame does not snap.
    if (!open && present) return;
    x.set(0);
    y.set(0);
    scale.set(1);
    if (!open) setZoomState({ id: selected, value: 1 });
    pointers.current.clear();
    gesture.current = null;
  }, [selected, open, present, x, y, scale]);
  useEffect(() => {
    if (dialogRef.current?.open) closeRef.current?.focus({ preventScroll: true });
  }, [open, lifecycle.repairToken]);
  useEffect(() => {
    if (!open) return;
    filmstripRef.current?.querySelector<HTMLElement>('[aria-current="true"]')?.scrollIntoView({
      block: 'nearest',
      inline: 'nearest',
      behavior: 'instant',
    });
  }, [open, selected, lifecycle.repairToken]);
  useEffect(() => {
    if (!open || !photo || dialogRef.current?.ownerDocument.visibilityState === 'hidden') return;
    const ImageConstructor = dialogRef.current?.ownerDocument.defaultView?.Image;
    if (!ImageConstructor) return;
    const neighbors = [photos[index - 1], photos[index + 1]].filter((item) => item !== undefined);
    const images = neighbors.map((item) => {
      const image = new ImageConstructor();
      if (item.sizes) image.sizes = item.sizes;
      if (item.srcSet) image.srcset = item.srcSet;
      image.src = item.src;
      return image;
    });
    return () => {
      for (const image of images) image.src = '';
    };
  }, [open, photo, index, photos]);

  const setZoom = (next: number) => {
    const value = Math.min(maxZoom, Math.max(1, next));
    setZoomState({ id: selected, value });
    scale.set(value);
    x.set(0);
    y.set(0);
  };
  const pan = (dx: number, dy: number) => {
    const box = stageRef.current?.getBoundingClientRect();
    const limitX = ((box?.width ?? 0) * (zoom - 1)) / 2;
    const limitY = ((box?.height ?? 0) * (zoom - 1)) / 2;
    x.set(Math.min(limitX, Math.max(-limitX, x.get() + dx)));
    y.set(Math.min(limitY, Math.max(-limitY, y.get() + dy)));
  };
  const navigate = (next: number) => {
    const item = photos[Math.min(photos.length - 1, Math.max(0, next))];
    if (item) select(item.id);
  };
  const handleKey = (event: KeyboardEvent<HTMLDialogElement>) => {
    if (
      event.defaultPrevented ||
      !photo ||
      (event.target as HTMLElement).closest('input, button, textarea, select')
    )
      return;
    const rtl = event.currentTarget.matches(':dir(rtl)') ? -1 : 1;
    if (zoom > 1 && event.target === stageRef.current) {
      const deltas: Record<string, [number, number]> = {
        ArrowLeft: [PAN_STEP, 0],
        ArrowRight: [-PAN_STEP, 0],
        ArrowUp: [0, PAN_STEP],
        ArrowDown: [0, -PAN_STEP],
      };
      const delta = deltas[event.key];
      if (delta) {
        event.preventDefault();
        pan(...delta);
        return;
      }
    }
    const targets: Record<string, number> = {
      ArrowLeft: index - rtl,
      ArrowRight: index + rtl,
      Home: 0,
      End: photos.length - 1,
    };
    if (zoom === 1 && targets[event.key] !== undefined) {
      event.preventDefault();
      navigate(targets[event.key]!);
    }
    if (event.key === '+' || event.key === '=') {
      event.preventDefault();
      setZoom(zoom + ZOOM_STEP);
    }
    if (event.key === '-') {
      event.preventDefault();
      setZoom(zoom - ZOOM_STEP);
    }
  };

  return (
    <Viewer
      {...withoutSx(viewerSlot)}
      ref={native.ref}
      data-ui="photo-grid-viewer"
      data-state={native['data-state']}
      aria-modal="true"
      aria-labelledby={ids(viewerSlot['aria-labelledby'], `${id}-title`)}
      aria-describedby={ids(viewerSlot['aria-describedby'], hasDetail && `${id}-detail`)}
      css={[viewerStyle, viewerSlot.sx]}
      onCancel={(event) => {
        if (event.target === event.currentTarget) native.onCancel(event);
      }}
      onClose={(event) => {
        if (event.target === event.currentTarget) native.onClose(event);
      }}
      onClick={native.onClick}
      onKeyDown={(event) => {
        viewerSlot.onKeyDown?.(event);
        handleKey(event);
      }}
    >
      <div css={viewerContentStyle}>
        <header role="presentation" css={[barStyle, topBarStyle]}>
          <h2 id={`${id}-title`} css={viewerTitleStyle}>
            {photo?.title ?? labels.unavailable}
          </h2>
          <ChromeAction
            ref={closeRef}
            label={labels.close}
            icon={chromeIcons.close}
            placement="bottom"
            onClick={lifecycle.requestClose}
          />
        </header>
        <Stage
          {...withoutSx(slots?.stage)}
          ref={mergedStageRef}
          data-ui="photo-grid-stage"
          tabIndex={photo ? 0 : undefined}
          role="group"
          aria-label={slots?.stage?.['aria-label'] ?? photo?.title ?? labels.unavailable}
          css={[stageStyle, slots?.stage?.sx]}
          data-zoom={zoom}
          onPointerDown={(event) => {
            slots?.stage?.onPointerDown?.(event);
            if (event.defaultPrevented || !photo || event.button !== 0) return;
            pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
            event.currentTarget.setPointerCapture(event.pointerId);
            const points = [...pointers.current.values()];
            gesture.current = {
              originX: event.clientX,
              originY: event.clientY,
              x: x.get(),
              y: y.get(),
              zoom,
              distance:
                points.length === 2
                  ? Math.hypot(points[1]!.x - points[0]!.x, points[1]!.y - points[0]!.y)
                  : undefined,
            };
          }}
          onPointerMove={(event) => {
            slots?.stage?.onPointerMove?.(event);
            const drag = gesture.current;
            if (event.defaultPrevented || !drag || !pointers.current.has(event.pointerId)) return;
            pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
            const points = [...pointers.current.values()];
            if (points.length === 2 && drag.distance) {
              const ratio =
                Math.hypot(points[1]!.x - points[0]!.x, points[1]!.y - points[0]!.y) / drag.distance;
              scale.set(Math.min(maxZoom, Math.max(1, drag.zoom * ratio)));
            } else if (zoom > 1) {
              pan(
                drag.x + event.clientX - drag.originX - x.get(),
                drag.y + event.clientY - drag.originY - y.get(),
              );
            } else if (!reduced) {
              // Only a downward drag dismisses, so the photo never follows an upward one.
              x.set(event.clientX - drag.originX);
              y.set(Math.max(0, event.clientY - drag.originY));
            }
          }}
          onPointerUp={(event) => {
            slots?.stage?.onPointerUp?.(event);
            const drag = gesture.current;
            pointers.current.delete(event.pointerId);
            if (!pointers.current.size) {
              gesture.current = null;
              if (drag?.distance) {
                if (!event.defaultPrevented) setZoom(scale.get());
                else scale.set(zoom);
                return;
              }
              if (zoom === 1) {
                if (
                  !event.defaultPrevented &&
                  drag &&
                  event.clientY - drag.originY > DISMISS_DISTANCE
                )
                  lifecycle.requestClose();
                else if (
                  !event.defaultPrevented &&
                  drag &&
                  Math.abs(event.clientX - drag.originX) > DISMISS_DISTANCE
                ) {
                  const rtl = event.currentTarget.matches(':dir(rtl)') ? -1 : 1;
                  navigate(index + (event.clientX < drag.originX ? 1 : -1) * rtl);
                }
                x.set(0);
                y.set(0);
              }
            }
          }}
          onPointerCancel={(event) => {
            slots?.stage?.onPointerCancel?.(event);
            pointers.current.clear();
            gesture.current = null;
            x.set(0);
            y.set(0);
            scale.set(zoom);
          }}
          onLostPointerCapture={(event) => {
            slots?.stage?.onLostPointerCapture?.(event);
            pointers.current.delete(event.pointerId);
            if (!pointers.current.size) gesture.current = null;
          }}
        >
          {photo ? (
            <motion.div
              key={photo.id}
              layoutId={present && !reduced ? photo.id : undefined}
              transition={SPRING}
              css={imageBoxStyle}
            >
              <motion.div style={{ x, y, scale }} css={imageBoxStyle}>
                {present && (
                  <PhotoImage
                    key={`${photo.src}\u0000${photo.srcSet ?? ''}`}
                    photo={photo}
                    full
                    unavailable={labels.imageUnavailable}
                  />
                )}
              </motion.div>
            </motion.div>
          ) : (
            <span css={photoFallbackStyle}>{labels.unavailable}</span>
          )}
        </Stage>
        <div css={[barStyle, bottomBarStyle]}>
          {hasDetail && (
            <p key={photo.id} id={`${id}-detail`} css={[detailStyle, viewerDetailStyle]}>
              {photo.detail}
            </p>
          )}
          <div css={toolbarStyle}>
            <div role="status" aria-live="polite" aria-atomic="true" css={counterStyle}>
              {position}
            </div>
            <Controls {...withoutSx(slots?.controls)} css={[controlsStyle, slots?.controls?.sx]}>
              <ChromeAction
                label={labels.previous}
                icon={chromeIcons.previous}
                disabled={index <= 0}
                styles={!product && compactHiddenStyle}
                onClick={() => navigate(index - 1)}
              />
              <ChromeAction
                label={labels.next}
                icon={chromeIcons.next}
                disabled={index < 0 || index >= photos.length - 1}
                styles={!product && compactHiddenStyle}
                onClick={() => navigate(index + 1)}
              />
              <span aria-hidden="true" css={[dividerStyle, compactHiddenStyle]} />
              <ChromeAction
                label={labels.zoomOut}
                icon={chromeIcons.zoomOut}
                disabled={!photo || zoom <= 1}
                onClick={() => setZoom(zoom - ZOOM_STEP)}
              />
              <ChromeAction
                label={labels.zoomIn}
                icon={chromeIcons.zoomIn}
                disabled={!photo || zoom >= maxZoom}
                onClick={() => setZoom(zoom + ZOOM_STEP)}
              />
              <ChromeAction
                label={labels.resetZoom}
                icon={chromeIcons.reset}
                disabled={!photo || zoom === 1}
                onClick={() => setZoom(1)}
              />
              {zoom > 1 && (
                <>
                  <span aria-hidden="true" css={dividerStyle} />
                  <ChromeAction label={labels.panLeft} icon={chromeIcons.panLeft} onClick={() => pan(PAN_STEP, 0)} />
                  <ChromeAction label={labels.panRight} icon={chromeIcons.panRight} onClick={() => pan(-PAN_STEP, 0)} />
                  <ChromeAction label={labels.panUp} icon={chromeIcons.panUp} onClick={() => pan(0, PAN_STEP)} />
                  <ChromeAction label={labels.panDown} icon={chromeIcons.panDown} onClick={() => pan(0, -PAN_STEP)} />
                </>
              )}
            </Controls>
            {photo && !product && (
              <ViewerFavorite
                {...favoriteSlot}
                label={favoriteLabel ?? labels.favorite(photo.title, favorite)}
                icon={<StarGlyph filled={favorite} />}
                pressed={favorite}
                styles={[favoriteSlotStyle, favoriteCss]}
                onClick={(event) => {
                  favoriteSlot.onClick?.(event);
                  if (!event.defaultPrevented) toggleFavorite(photo.id);
                }}
              />
            )}
          </div>
          {photos.length > 1 && (
            <Filmstrip
              {...withoutSx(slots?.filmstrip)}
              ref={mergedFilmstripRef}
              data-ui="photo-grid-filmstrip"
              role="group"
              aria-label={slots?.filmstrip?.['aria-label'] ?? labels.filmstrip}
              css={[filmstripStyle, slots?.filmstrip?.sx]}
            >
              {photos.map((item, itemIndex) => (
                <button
                  key={item.id}
                  type="button"
                  aria-current={item.id === selected ? 'true' : undefined}
                  aria-label={labels.position(
                    format.format(itemIndex + 1),
                    format.format(photos.length),
                    item.title,
                  )}
                  css={[thumbStyle, viewerThumbStyle]}
                  onClick={() => select(item.id)}
                >
                  <PhotoImage
                    key={`${item.src}\u0000${item.srcSet ?? ''}`}
                    photo={item}
                    unavailable={labels.imageUnavailable}
                  />
                </button>
              ))}
            </Filmstrip>
          )}
        </div>
      </div>
    </Viewer>
  );
}

export function PhotoGrid({
  ref,
  photos: photosProp = EMPTY_PHOTOS,
  title,
  variant = 'grid',
  depth = true,
  reflection = false,
  colors = EMPTY_COLORS,
  options = EMPTY_OPTIONS,
  selectedColor: colorProp,
  defaultSelectedColor,
  onSelectedColorChange,
  selectedOption: optionProp,
  defaultSelectedOption = null,
  onSelectedOptionChange,
  header,
  footer,
  renderCaption,
  magnifier = true,
  aspectRatio = PRODUCT_ASPECT_RATIO,
  zoomFactor = MAX_ZOOM,
  densitySteps = DEFAULT_STEPS,
  density: densityProp,
  defaultDensity,
  onDensityChange,
  favorites: favoritesProp,
  defaultFavorites = EMPTY_IDS,
  onFavoritesChange,
  onFavoriteChange,
  value: valueProp,
  defaultValue,
  onValueChange,
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  labels: labelOverrides,
  locale,
  slotProps,
  slots,
  component,
  className,
  sx,
  onKeyDown,
  ...rest
}: PhotoGridProps) {
  const [color, setColor] = useControlledState(
    colorProp,
    defaultSelectedColor ?? colors.find((item) => !item.soldOut)?.value,
    onSelectedColorChange,
  );
  const [option, setOption] = useControlledState(
    optionProp,
    defaultSelectedOption,
    onSelectedOptionChange,
  );
  const photos = variant === 'product' && colors.length
    ? colors.find((item) => item.value === color)?.photos ?? EMPTY_PHOTOS
    : photosProp;
  const Header = slots?.header ?? 'header';
  const Title = slots?.title ?? 'h2';
  const Density = slots?.density ?? 'div';
  const List = slots?.list ?? 'ul';
  const Item = slots?.item ?? 'li';
  const Favorite = slots?.favorite ?? 'button';
  const Status = slots?.status ?? 'div';
  const id = useId();
  const steps = normalizeSteps(densitySteps);
  const [densitySeed] = useState(() => nearestDensity(defaultDensity, steps));
  const [densityState, requestDensity] = useControlledState(densityProp, densitySeed, onDensityChange);
  const density = nearestDensity(densityState, steps);
  const [favoriteState, requestFavorites] = useControlledState<readonly string[]>(
    favoritesProp,
    defaultFavorites,
    (next) => onFavoritesChange?.([...next]),
  );
  const favorites = new Set(favoriteState ?? EMPTY_IDS);
  const [selection, requestSelection] = useControlledState<PhotoSelection>(
    valueProp === undefined ? undefined : { id: valueProp, color },
    { id: defaultValue === undefined ? (photos[0]?.id ?? null) : defaultValue, color },
    (next) => {
      if (next.id !== selected) onValueChange?.(next.id);
    },
  );
  let selectedState = selection?.id;
  if (variant === 'product' && selection?.color !== color) {
    selectedState = selection?.previous && selection.previous.color === color
      ? selection.previous.id
      : photos[0]?.id ?? null;
  }
  const selected = variant !== 'grid' && valueProp === undefined && selectedState !== null &&
    !photos.some((photo) => photo.id === selectedState)
      ? photos[0]?.id ?? null
      : selectedState;
  const select = (photoId: string | null) => {
    if (photoId !== selected) requestSelection({ id: photoId, color });
  };
  const [open, setOpen] = useControlledState(openProp, defaultOpen, onOpenChange);
  const lifecycle = useNativeDialogRoot((open ?? false) && photos.length > 0, setOpen);
  const labels = { ...defaultLabels, ...labelOverrides };
  const format = numberFormatter(locale);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);
  const rootMergedRef = useMergeRefs([rootRef, ref]);
  const listMergedRef = useMergeRefs([listRef, slotProps?.list?.ref]);
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const focused = useRef<{ id: string; index: number; kind: 'photo' | 'favorite' } | null>(null);
  const invoker = useRef<string | null>(null);
  // The focal photo's point at `clientY` (`fraction` of its height) stays put across the reflow.
  const anchor = useRef<{
    id: string;
    density: number;
    clientY: number;
    fraction: number;
    focus: boolean;
  } | null>(null);
  const columns = density;
  const reduced = useReducedMotion();
  const [visible, setVisible] = useState(true);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{
    distance: number;
    ratio: number;
    focalId: string | null;
    clientY?: number;
  } | null>(null);
  const wheelDelta = useRef(0);
  const preview = useMotionValue(1);
  const previewOriginX = useMotionValue('50%');
  const previewOriginY = useMotionValue('50%');
  const previewOrigin = useTransform([previewOriginX, previewOriginY], ([ox, oy]) => `${ox} ${oy}`);
  const densityIndex = steps.indexOf(density);
  const [status, setStatus] = useState('');
  const lastAccepted = useRef({ density, selected, favorites });

  if (process.env.NODE_ENV !== 'production') {
    const seen = new Set<string>();
    for (const photo of photos) {
      if (seen.has(photo.id)) throw new Error('PhotoGrid: photo IDs must be unique.');
      if (
        !Number.isFinite(photo.width) ||
        photo.width <= 0 ||
        !Number.isFinite(photo.height) ||
        photo.height <= 0
      )
        throw new Error('PhotoGrid: photo dimensions must be finite positive numbers.');
      seen.add(photo.id);
    }
  }

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const doc = root.ownerDocument;
    let intersecting = true;
    const update = () => setVisible(intersecting && doc.visibilityState !== 'hidden');
    const observer = new IntersectionObserver(([entry]) => {
      intersecting = entry?.isIntersecting ?? false;
      update();
    });
    observer.observe(root);
    doc.addEventListener('visibilitychange', update);
    return () => {
      observer.disconnect();
      doc.removeEventListener('visibilitychange', update);
    };
  }, []);

  const resetPreview = () => {
    preview.set(1);
    previewOriginX.set('50%');
    previewOriginY.set('50%');
  };

  useEffect(() => {
    const doc = rootRef.current?.ownerDocument;
    if (!doc) return;
    const abortOutside = (event: globalThis.PointerEvent) => {
      if (listRef.current?.contains(event.target as Node)) return;
      pointers.current.delete(event.pointerId);
      pinch.current = null;
      resetPreview();
    };
    doc.addEventListener('pointerup', abortOutside, true);
    doc.addEventListener('pointercancel', abortOutside, true);
    return () => {
      doc.removeEventListener('pointerup', abortOutside, true);
      doc.removeEventListener('pointercancel', abortOutside, true);
    };
  }, [preview]);

  useLayoutEffect(() => {
    const pending = anchor.current;
    if (!pending || pending.density !== density) return;
    anchor.current = null;
    const button = buttons.current.get(pending.id);
    if (button && rootRef.current) {
      if (pending.focus) button.focus({ preventScroll: true });
      const box = button.getBoundingClientRect();
      scrollBy(rootRef.current, box.top + pending.fraction * box.height - pending.clientY);
    }
  }, [density]);

  useLayoutEffect(() => {
    const current = focused.current;
    if (!current || photos.some((photo) => photo.id === current.id) || open) return;
    const next = photos[Math.min(current.index, photos.length - 1)];
    const active = rootRef.current?.ownerDocument.activeElement;
    if (active !== rootRef.current?.ownerDocument.body && active?.isConnected) return;
    if (next) buttons.current.get(next.id)?.focus();
    else rootRef.current?.focus();
  }, [photos, open]);

  useEffect(() => {
    const previous = lastAccepted.current;
    if (previous.density !== density) setStatus(labels.columns(format.format(density), density));
    else if (previous.selected !== selected && (open || variant !== 'grid')) {
      const index = photos.findIndex((photo) => photo.id === selected);
      setStatus(
        index >= 0
          ? labels.position(format.format(index + 1), format.format(photos.length), photos[index]!.title)
          : labels.unavailable,
      );
    } else if (
      previous.favorites.size !== favorites.size ||
      [...favorites].some((id) => !previous.favorites.has(id))
    ) {
      const changed = photos.find((photo) => favorites.has(photo.id) !== previous.favorites.has(photo.id));
      if (changed) setStatus(labels.favorite(changed.title, favorites.has(changed.id)));
    }
    lastAccepted.current = { density, selected, favorites };
  }, [density, selected, favoriteState, open]);

  const toggleFavorite = (photoId: string) => {
    const next = new Set(favorites);
    const favorite = !next.has(photoId);
    if (favorite) next.add(photoId);
    else next.delete(photoId);
    requestFavorites([...next]);
    onFavoriteChange?.(photoId, favorite);
  };
  /**
   * Requests `next` columns around a focal photo. With `clientY`, the point under it stays put;
   * otherwise the photo's top edge does. `focus` moves focus to the focal photo (grid gestures and keys).
   */
  const setDensity = (
    next: number,
    { focalId = focused.current?.id ?? photos[0]?.id, clientY, focus = true }: {
      focalId?: string;
      clientY?: number;
      focus?: boolean;
    } = {},
  ) => {
    if (next === density) return;
    const box = focalId ? buttons.current.get(focalId)?.getBoundingClientRect() : undefined;
    anchor.current =
      box && focalId
        ? {
            id: focalId,
            density: next,
            clientY: clientY ?? box.top,
            fraction: clientY === undefined || !box.height ? 0 : (clientY - box.top) / box.height,
            focus,
          }
        : null;
    requestDensity(next);
  };
  const stepDensity = (direction: number, focal?: { focalId?: string; clientY?: number }) =>
    setDensity(steps[Math.min(steps.length - 1, Math.max(0, densityIndex + direction))]!, focal);
  const focusIndex = (index: number) => {
    const photo = photos[Math.min(photos.length - 1, Math.max(0, index))];
    if (photo) buttons.current.get(photo.id)?.focus();
  };
  const handlePhotoKey = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.defaultPrevented) return;
    const rtl = event.currentTarget.matches(':dir(rtl)') ? -1 : 1;
    const targets: Record<string, number> = {
      ArrowLeft: index - rtl,
      ArrowRight: index + rtl,
      ArrowUp: index - columns,
      ArrowDown: index + columns,
      PageUp: index - PAGE_ROWS * columns,
      PageDown: index + PAGE_ROWS * columns,
      Home: 0,
      End: photos.length - 1,
    };
    if (targets[event.key] !== undefined) {
      event.preventDefault();
      focusIndex(targets[event.key]!);
    }
    if (event.key === '+' || event.key === '=') {
      event.preventDefault();
      stepDensity(1, { focalId: photos[index]!.id });
    }
    if (event.key === '-') {
      event.preventDefault();
      stepDensity(-1, { focalId: photos[index]!.id });
    }
  };
  const restore = () => {
    if (variant !== 'grid') {
      const main = rootRef.current?.querySelector<HTMLElement>(
        '[role="tabpanel"]:not([hidden]) [data-ui="photo-grid-main"]',
      );
      (main ?? rootRef.current)?.focus({ preventScroll: true });
      return;
    }
    const photo = photos[Math.min(focused.current?.index ?? 0, photos.length - 1)];
    (
      buttons.current.get(invoker.current ?? '') ??
      (photo ? buttons.current.get(photo.id) : null) ??
      rootRef.current
    )?.focus({ preventScroll: true });
  };

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const onWheel = (event: WheelEvent) => {
      if (variant !== 'grid') return;
      const target = event.target;
      if (!event.ctrlKey || event.defaultPrevented || !(target instanceof Element) || target.closest('dialog'))
        return;
      event.preventDefault();
      wheelDelta.current += event.deltaY * (event.deltaMode === WheelEvent.DOM_DELTA_LINE ? WHEEL_LINE_PX : 1);
      if (Math.abs(wheelDelta.current) < WHEEL_STEP_PX) return;
      // Wheel up (or a trackpad spread) enlarges thumbnails, like a pinch.
      const direction = wheelDelta.current < 0 ? 1 : -1;
      wheelDelta.current = 0;
      const item = target.closest<HTMLElement>('[data-photo-id]');
      stepDensity(direction, item ? { focalId: item.dataset.photoId, clientY: event.clientY } : undefined);
    };
    root.addEventListener('wheel', onWheel, { passive: false });
    return () => root.removeEventListener('wheel', onWheel);
  }, [stepDensity]);

  return (
    <MotionConfig reducedMotion="user">
      <LayoutGroup id={id}>
            <PresentationSlot
              element="div"
              component={slots?.root ?? component}
              slotProps={slotProps?.root}
              styles={rootStyle}
              sx={sx}
              {...rest}
              ref={rootMergedRef}
              className={className}
              marker="photo-grid"
              data-variant={variant}
              role="region"
              aria-roledescription={rest['aria-roledescription'] ?? (variant === 'cover-flow' ? labels.carousel : undefined)}
              tabIndex={rest.tabIndex ?? -1}
              aria-labelledby={ids(rest['aria-labelledby'], slotProps?.title?.id ?? `${id}-title`)}
              data-density={density}
              data-columns={columns}
              onKeyDown={onKeyDown}
            >
              <Header
                {...withoutSx(slotProps?.header)}
                role={slotProps?.header?.role ?? 'presentation'}
                css={[headerStyle, slotProps?.header?.sx]}
              >
                <div css={headingStyle}>
                  <Title
                    {...withoutSx(slotProps?.title)}
                    id={slotProps?.title?.id ?? `${id}-title`}
                    css={[titleStyle, slotProps?.title?.sx]}
                  >
                    {title}
                  </Title>
                  <p css={summaryStyle}>
                    <span>{labels.photoCount(format.format(photos.length), photos.length)}</span>
                    {variant === 'grid' && <span>{labels.columns(format.format(density), density)}</span>}
                  </p>
                </div>
                {variant === 'grid' && <Density
                  {...withoutSx(slotProps?.density)}
                  role="group"
                  aria-label={slotProps?.density?.['aria-label'] ?? labels.density}
                  css={[densityStyle, slotProps?.density?.sx]}
                >
                  {steps.map((step) => (
                    <ChromeAction
                      key={step}
                      label={labels.columns(format.format(step), step)}
                      icon={<DensityGlyph columns={step} />}
                      pressed={step === density}
                      disabled={!photos.length}
                      placement="bottom"
                      portaled
                      styles={segmentStyle}
                      onClick={() => setDensity(step, { focus: false })}
                    />
                  ))}
                </Density>}
              </Header>
              {variant !== 'grid' ? (
                <GalleryPresentation
                  photos={photos}
                  selected={selected}
                  select={select}
                  variant={variant}
                  depth={depth}
                  reflection={reflection}
                  aspectRatio={aspectRatio}
                  magnifier={magnifier}
                  labels={labels}
                  format={format}
                  slots={slots}
                  slotProps={slotProps}
                  colors={colors}
                  options={options}
                  color={color}
                  option={option}
                  onColorChange={(next) => {
                    setColor(next);
                    requestSelection({
                      id: colors.find((item) => item.value === next)?.photos[0]?.id ?? null,
                      color: next,
                      previous: { id: selected ?? null, color },
                    });
                    const current = options.find((item) => item.value === option);
                    if (current && isPhotoGridOptionSoldOut(current, next)) setOption(null);
                  }}
                  onOptionChange={setOption}
                  header={header}
                  footer={footer}
                  renderCaption={renderCaption}
                  onOpen={() => setOpen(true)}
                />
              ) : photos.length ? (
                <motion.div style={{ scale: preview, transformOrigin: previewOrigin }}>
                  <List
                    {...withoutSx(slotProps?.list)}
                    ref={listMergedRef}
                    css={[listStyle, slotProps?.list?.sx]}
                    data-ui="photo-grid-list"
                    aria-labelledby={ids(
                      slotProps?.list?.['aria-labelledby'],
                      slotProps?.title?.id ?? `${id}-title`,
                    )}
                    style={{ ...slotProps?.list?.style, '--photo-grid-columns': columns } as CSSProperties}
                    onPointerDown={(event) => {
                      slotProps?.list?.onPointerDown?.(event);
                      if (event.defaultPrevented || event.pointerType !== 'touch') return;
                      pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
                      if (pointers.current.size === 2) {
                        const points = [...pointers.current.values()];
                        const item = (event.target as HTMLElement).closest<HTMLLIElement>('[data-photo-id]');
                        const rect = event.currentTarget.getBoundingClientRect();
                        const cx = (points[0]!.x + points[1]!.x) / 2;
                        const cy = (points[0]!.y + points[1]!.y) / 2;
                        pinch.current = {
                          distance: Math.hypot(points[1]!.x - points[0]!.x, points[1]!.y - points[0]!.y),
                          ratio: 1,
                          focalId: item?.dataset.photoId ?? focused.current?.id ?? null,
                          clientY: item ? cy : undefined,
                        };
                        previewOriginX.set(((cx - rect.left) / rect.width * 100).toFixed(1) + '%');
                        previewOriginY.set(((cy - rect.top) / rect.height * 100).toFixed(1) + '%');
                        event.currentTarget.setPointerCapture(event.pointerId);
                      }
                    }}
                    onPointerMove={(event) => {
                      slotProps?.list?.onPointerMove?.(event);
                      if (event.defaultPrevented || !pointers.current.has(event.pointerId)) return;
                      pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
                      const drag = pinch.current;
                      const points = [...pointers.current.values()];
                      if (!drag || points.length !== 2 || !drag.distance) return;
                      drag.ratio =
                        Math.hypot(points[1]!.x - points[0]!.x, points[1]!.y - points[0]!.y) / drag.distance;
                      if (!reduced && visible)
                        preview.set(Math.min(1 + PINCH_THRESHOLD, Math.max(1 - PINCH_THRESHOLD, drag.ratio)));
                    }}
                    onPointerUp={(event) => {
                      slotProps?.list?.onPointerUp?.(event);
                      const drag = pinch.current;
                      pointers.current.delete(event.pointerId);
                      pinch.current = null;
                      resetPreview();
                      if (!event.defaultPrevented && drag && Math.abs(drag.ratio - 1) >= PINCH_THRESHOLD)
                        stepDensity(drag.ratio > 1 ? 1 : -1, {
                          focalId: drag.focalId ?? undefined,
                          clientY: drag.clientY,
                        });
                    }}
                    onPointerCancel={(event) => {
                      slotProps?.list?.onPointerCancel?.(event);
                      pointers.current.clear();
                      pinch.current = null;
                      resetPreview();
                    }}
                    onLostPointerCapture={(event) => {
                      slotProps?.list?.onLostPointerCapture?.(event);
                      pointers.current.clear();
                      pinch.current = null;
                      resetPreview();
                    }}
                  >
                    {photos.map((photo, index) => (
                      <Item
                        {...withoutSx(slotProps?.item)}
                        key={photo.id}
                        data-photo-id={photo.id}
                        css={[cellStyle, slotProps?.item?.sx]}
                      >
                        <motion.div
                          layout={
                            !reduced &&
                            visible &&
                            focused.current?.id !== photo.id &&
                            anchor.current?.id !== photo.id
                              ? 'position'
                              : false
                          }
                          transition={SPRING}
                          css={itemStyle}
                        >
                          <PhotoButton
                            component={slots?.photo}
                            {...withoutSx(slotProps?.photo)}
                            ref={slotProps?.photo?.ref}
                            register={(node) => {
                              if (node) buttons.current.set(photo.id, node);
                              return () => {
                                buttons.current.delete(photo.id);
                              };
                            }}
                            data-ui="photo-grid-photo"
                            type="button"
                            aria-label={
                              slotProps?.photo?.['aria-label'] ??
                              labels.openPhoto(photo.title, photo.alt, favorites.has(photo.id))
                            }
                            css={[photoStyle, slotProps?.photo?.sx]}
                            onFocus={(event) => {
                              slotProps?.photo?.onFocus?.(event);
                              buttons.current.set(photo.id, event.currentTarget);
                              focused.current = { id: photo.id, index, kind: 'photo' };
                            }}
                            onClick={(event) => {
                              slotProps?.photo?.onClick?.(event);
                              if (event.defaultPrevented) return;
                              invoker.current = photo.id;
                              select(photo.id);
                              lifecycle.setOpen(true);
                            }}
                            onKeyDown={(event) => {
                              slotProps?.photo?.onKeyDown?.(event);
                              if (!event.defaultPrevented) handlePhotoKey(event, index);
                            }}
                          >
                            <motion.div
                              layoutId={!reduced && visible ? photo.id : undefined}
                              transition={SPRING}
                              css={imageBoxStyle}
                            >
                              <PhotoImage
                                key={`${photo.src}\u0000${photo.srcSet ?? ''}`}
                                photo={photo}
                                unavailable={labels.imageUnavailable}
                              />
                            </motion.div>
                          </PhotoButton>
                          <Favorite
                            {...withoutSx(slotProps?.favorite)}
                            type="button"
                            data-ui="photo-grid-favorite"
                            aria-pressed={favorites.has(photo.id)}
                            aria-label={
                              slotProps?.favorite?.['aria-label'] ??
                              labels.favorite(photo.title, favorites.has(photo.id))
                            }
                            css={[tileFavoriteStyle, slotProps?.favorite?.sx]}
                            onFocus={(event) => {
                              slotProps?.favorite?.onFocus?.(event);
                              focused.current = { id: photo.id, index, kind: 'favorite' };
                            }}
                            onClick={(event) => {
                              slotProps?.favorite?.onClick?.(event);
                              if (!event.defaultPrevented) toggleFavorite(photo.id);
                            }}
                          >
                            <StarGlyph filled={favorites.has(photo.id)} />
                          </Favorite>
                        </motion.div>
                      </Item>
                    ))}
                  </List>
                </motion.div>
              ) : (
                <p css={detailStyle}>{labels.empty}</p>
              )}
              <Status
                {...withoutSx(slotProps?.status)}
                role="status"
                aria-live="polite"
                aria-atomic="true"
                css={[statusStyle, slotProps?.status?.sx]}
              >
                {status}
              </Status>
              <PhotoViewer
                product={variant === 'product'}
                maxZoom={Number.isFinite(zoomFactor) && zoomFactor >= 1 ? zoomFactor : MAX_ZOOM}
                photos={photos}
                selected={selected}
                open={open ?? false}
                controller={{ ...lifecycle, open: (open ?? false) && photos.length > 0 }}
                select={select}
                favorites={favorites}
                toggleFavorite={toggleFavorite}
                labels={labels}
                format={format}
                slots={slotProps}
                components={slots}
                restore={restore}
              />
            </PresentationSlot>
      </LayoutGroup>
    </MotionConfig>
  );
}

PhotoGrid.displayName = 'PhotoGrid';
