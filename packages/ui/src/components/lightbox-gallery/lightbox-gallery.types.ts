import {
  type ComponentPropsWithRef,
  type ComponentType,
  type ReactNode,
} from 'react';
import type { vars } from '@jfrader/tokens/vars';
import type { NativeDialogController } from '../../overlay/use-native-dialog';
import type { Interpolation, Theme } from '../../styling/css';
import type { SxProps } from '../../styling/sx';

export interface LightboxGalleryImage {
  id: string;
  src: string;
  width: number;
  height: number;
  alt: string;
  title?: string;
  caption?: ReactNode;
  srcSet?: string;
  sizes?: string;
}

type Slot<Tag extends keyof React.JSX.IntrinsicElements> = Omit<ComponentPropsWithRef<Tag>, 'children'> & {
  sx?: Interpolation<Theme>;
};

export interface LightboxGallerySlotProps {
  /** Grid list container element (`ul`) holding thumbnail tiles. */
  grid?: Slot<'ul'>;
  /** Thumbnail button element opening the lightbox viewer. */
  tile?: Omit<Slot<'button'>, 'type'>;
  /** Image element displaying the thumbnail or zoomed photo. */
  image?: Omit<Slot<'img'>, 'src' | 'srcSet' | 'sizes' | 'alt' | 'width' | 'height'>;
  /** Native `<dialog>` element hosting the fullscreen lightbox viewer. */
  viewer?: Omit<Slot<'dialog'>, 'open'> & { withDescription?: boolean };
  /** Viewport stage container element panning and zooming the active image. */
  stage?: Slot<'div'>;
  /** Heading element naming the currently active image. Renders an `h2` by default. */
  title?: Slot<'h2'>;
  /** Caption paragraph element (`p`) describing the active image. */
  caption?: Slot<'p'>;
  /** Thumbnail strip container element at the bottom of the viewer. */
  thumbnails?: Slot<'div'>;
  /** Toolbar container element holding zoom and dismiss action buttons. */
  controls?: Slot<'div'>;
  /** Live region container element announcing active image position and zoom. */
  status?: Slot<'div'>;
}

export interface LightboxGallerySlots {
  /** Lists the gallery thumbnails. */
  grid?: ComponentType<NonNullable<LightboxGallerySlotProps['grid']>>;
  /** Opens an image in the viewer. */
  tile?: ComponentType<NonNullable<LightboxGallerySlotProps['tile']>>;
  /** Displays a gallery image. */
  image?: ComponentType<NonNullable<LightboxGallerySlotProps['image']>>;
  /** Hosts the image viewer dialog. */
  viewer?: ComponentType<NonNullable<LightboxGallerySlotProps['viewer']>>;
  /** Holds the pannable image. */
  stage?: ComponentType<NonNullable<LightboxGallerySlotProps['stage']>>;
  /** Displays the image title. Renders an `h2` by default. */
  title?: ComponentType<NonNullable<LightboxGallerySlotProps['title']>>;
  /** Displays the image caption. */
  caption?: ComponentType<NonNullable<LightboxGallerySlotProps['caption']>>;
  /** Holds the image thumbnail strip. */
  thumbnails?: ComponentType<NonNullable<LightboxGallerySlotProps['thumbnails']>>;
  /** Holds the viewer controls. */
  controls?: ComponentType<NonNullable<LightboxGallerySlotProps['controls']>>;
  /** Announces image position. */
  status?: ComponentType<NonNullable<LightboxGallerySlotProps['status']>>;
}

export interface LightboxGalleryLabels {
  open: string;
  close: string;
  previous: string;
  next: string;
  /** @deprecated No longer rendered: double-click the image, or use `zoomIn` and `reset`. Removed in the next major. */
  zoom: string;
  zoomIn: string;
  zoomOut: string;
  reset: string;
  /** @deprecated No longer rendered: drag the zoomed image or press the arrow keys. Removed in the next major. */
  panLeft: string;
  /** @deprecated No longer rendered: drag the zoomed image or press the arrow keys. Removed in the next major. */
  panRight: string;
  /** @deprecated No longer rendered: drag the zoomed image or press the arrow keys. Removed in the next major. */
  panUp: string;
  /** @deprecated No longer rendered: drag the zoomed image or press the arrow keys. Removed in the next major. */
  panDown: string;
  empty: string;
  unavailable: string;
  imageUnavailable: string;
  loading: string;
  thumbnails: string;
  position: (position: string, total: string) => string;
  zoomPercent: (percent: string) => string;
}

export interface LightboxGalleryProps
  extends Omit<ComponentPropsWithRef<'div'>, 'children' | 'defaultValue'>,
    SxProps {
  /** Supplies images in thumbnail and viewer navigation order, keyed by stable ids. */
  images: readonly LightboxGalleryImage[];
  /** Names the gallery region and viewer and prefixes the active image title. */
  label: string;
  /** Sets the target minimum column width in pixels; at least two columns remain. Defaults to 150 for omitted, non-positive or non-finite values. */
  minColumnWidth?: number;
  /** Selects the spacing token between thumbnail tiles. Defaults to `2`. */
  gap?: keyof typeof vars.space;
  /** Controls the selected image id; an unknown or `null` id prevents the viewer opening. */
  value?: string | null;
  /** Selects the initial image when uncontrolled. Defaults to the first image id, or `null` for an empty gallery. */
  defaultValue?: string | null;
  /** Called with the requested image id when opening a tile or navigating. */
  onValueChange?: (id: string | null) => void;
  /** Controls viewer visibility; the selected id must exist in `images`. */
  open?: boolean;
  /** Opens the uncontrolled viewer initially when the selected image exists. Defaults to `false`. */
  defaultOpen?: boolean;
  /** Called when the viewer requests opening or closing. */
  onOpenChange?: (open: boolean) => void;
  /** Caps magnification as a multiplier, with a minimum of 1. Defaults to 4 for omitted, non-positive or non-finite values. */
  maxZoom?: number;
  /** Overrides English control labels, fallback text and position/zoom formatters. */
  labels?: Partial<LightboxGalleryLabels>;
  /** Sets number and zoom-percentage formatting locales; omitted uses the runtime locale. */
  locale?: Intl.LocalesArgument;
  /** Passes props to thumbnail and viewer parts. */
  slotProps?: LightboxGallerySlotProps;
  /** Replaces thumbnail and viewer parts. */
  slots?: LightboxGallerySlots;
}

export interface LightboxViewerProps {
  images: readonly LightboxGalleryImage[];
  selected: string | null | undefined;
  label: string;
  controller: NativeDialogController;
  select: (id: string | null) => void;
  restore: () => void;
  /** The element that opened the viewer; its `data-image-id` names the image it launched. */
  launch: React.RefObject<HTMLElement | null>;
  /** The element the current image returns to when the viewer closes. */
  home: () => HTMLElement | undefined;
  labels: LightboxGalleryLabels;
  locale?: Intl.LocalesArgument;
  maxZoom: number;
  slotProps?: LightboxGallerySlotProps;
  slots?: LightboxGallerySlots;
  reduced: boolean;
}
