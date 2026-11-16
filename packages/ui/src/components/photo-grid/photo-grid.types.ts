import type { ComponentPropsWithRef, ComponentType, ReactNode } from 'react';
import type { Interpolation, Theme } from '../../styling/css';
import type { SxProps } from '../../styling/sx';
import type { PresentationProps } from '../../utils/presentation-slot';
import type { ChromeActionProps } from '../viewer-chrome/viewer-chrome';

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

export interface PhotoGridColor<P extends PhotoGridPhoto = PhotoGridPhoto> {
  value: string;
  label: string;
  photos: readonly P[];
  soldOut?: boolean;
}

export interface PhotoGridOption {
  value: string;
  label: string;
  /** Disable everywhere, or for the listed color values. */
  soldOut?: boolean | readonly string[];
}

export type Slot<Tag extends keyof React.JSX.IntrinsicElements> = ComponentPropsWithRef<Tag> & {
  sx?: Interpolation<Theme>;
};
export type ActionSlot = Slot<'button'>;

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

export interface PhotoGridProps<P extends PhotoGridPhoto = PhotoGridPhoto>
  extends Omit<ComponentPropsWithRef<'div'>, 'children' | 'defaultValue'>, SxProps {
  /** Photo collection; product colors may supply their own collections instead. */
  photos?: readonly P[];
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
  colors?: readonly PhotoGridColor<P>[];
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
  renderCaption?: (photo: P, index: number) => ReactNode;
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
