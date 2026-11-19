'use client';

import { withoutSx } from '../../styling/sx';
import {
  memo,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentPropsWithRef,
  type CSSProperties,
  type KeyboardEvent,
} from 'react';
import { useMergeRefs } from '@floating-ui/react';
import { LayoutGroup, MotionConfig, motion, useMotionValue, useReducedMotion, useTransform } from 'motion/react';
import {
  useNativeDialog,
  useNativeDialogRoot,
  omitNativeOpen,
  type NativeDialogController,
} from '../../overlay/use-native-dialog';
import { styledDialogTransition } from '../../overlay/exit-motion';
import { isDev } from '../../utils/dev';
import { PresentationSlot } from '../../utils/presentation-slot';
import { numberFormatter } from '../../utils/intl';
import { isRenderable } from '../../utils/renderable';
import { useControlledState } from '../../utils/use-controlled-state';
import { useLatestCallback } from '../../utils/use-latest-callback';
import { LayoutLayer } from '../../utils/layout-layer';
import { GalleryPresentation, isPhotoGridOptionSoldOut, PRODUCT_ASPECT_RATIO } from './gallery-presentation';
import { PhotoImage, photoFallbackStyle } from './photo-image';
export { isPhotoGridOptionSoldOut } from './gallery-presentation';
import {
  ChromeAction,
  chromeIcons,
  filmstripStyle,
  Glyph,
  StarGlyph,
  thumbStyle,
} from '../viewer-chrome/viewer-chrome';

import {
  rootStyle,
  headerStyle,
  headingStyle,
  titleStyle,
  summaryStyle,
  densityStyle,
  segmentStyle,
  listStyle,
  cellStyle,
  itemStyle,
  photoStyle,
  tileFavoriteStyle,
  imageBoxStyle,
  viewerStyle,
  viewerContentStyle,
  barStyle,
  topBarStyle,
  bottomBarStyle,
  viewerTitleStyle,
  toolbarStyle,
  controlsStyle,
  favoriteSlotStyle,
  compactHiddenStyle,
  dividerStyle,
  stageStyle,
  viewerThumbStyle,
  statusStyle,
  counterStyle,
  detailStyle,
  viewerDetailStyle,
} from './photo-grid.styles';
import type {
  ActionSlot,
  PhotoGridLabels,
  PhotoGridOption,
  PhotoGridPhoto,
  PhotoGridProps,
  PhotoGridSlotProps,
  PhotoGridSlots,
  Slot,
} from './photo-grid.types';
export type {
  PhotoGridColor,
  PhotoGridLabels,
  PhotoGridOption,
  PhotoGridPhoto,
  PhotoGridProps,
  PhotoGridSlotProps,
  PhotoGridSlots,
} from './photo-grid.types';

const DEFAULT_STEPS = [5, 3, 2] as const;
const DEFAULT_DENSITY = 3;
const EMPTY_IDS: readonly string[] = [];
const EMPTY_PHOTOS: readonly never[] = [];
const EMPTY_COLORS: readonly never[] = [];
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
const SPRING = { type: 'spring', stiffness: 360, damping: 36 } as const;
const englishPlural = new Intl.PluralRules('en');
const defaultLabels: PhotoGridLabels = {
  carousel: 'carousel',
  slide: 'slide',
  navigationHint: 'Use Left and Right arrows, Home or End to choose a photo.',
  colors: 'Color',
  options: 'Size',
  clearOption: 'Clear size',
  soldOut: 'Sold out',
  inspect: 'Inspect photo',
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

interface PhotoTileProps {
  photo: PhotoGridPhoto;
  index: number;
  favorite: boolean;
  /** Shares the image box with the viewer through `layoutId`. */
  shared: boolean;
  photoLabel: string;
  favoriteLabel: string;
  unavailable: string;
  photoComponent?: PhotoGridSlots['photo'];
  photoSlot?: ActionSlot;
  favoriteComponent: 'button' | NonNullable<PhotoGridSlots['favorite']>;
  favoriteSlot?: ActionSlot;
  buttons: Map<string, HTMLButtonElement>;
  onPhotoFocus: (button: HTMLButtonElement, photoId: string, index: number) => void;
  onPhotoOpen: (photoId: string) => void;
  onPhotoKeyDown: (event: KeyboardEvent<HTMLButtonElement>, index: number) => void;
  onFavoriteFocus: (photoId: string, index: number) => void;
  onFavoriteToggle: (photoId: string) => void;
}

/**
 * One tile's photo and favorite buttons. Memoized with stable handlers, so a density change
 * re-renders only the layout boxes Motion has to measure, not every tile's subtree.
 */
const PhotoTile = memo(function PhotoTile({
  photo,
  index,
  favorite,
  shared,
  photoLabel,
  favoriteLabel,
  unavailable,
  photoComponent,
  photoSlot,
  favoriteComponent: Favorite,
  favoriteSlot,
  buttons,
  onPhotoFocus,
  onPhotoOpen,
  onPhotoKeyDown,
  onFavoriteFocus,
  onFavoriteToggle,
}: PhotoTileProps) {
  const register = useCallback(
    (node: HTMLButtonElement | null) => {
      if (node) buttons.set(photo.id, node);
      return () => {
        buttons.delete(photo.id);
      };
    },
    [buttons, photo.id],
  );
  return (
    <>
      <PhotoButton
        component={photoComponent}
        {...withoutSx(photoSlot)}
        ref={photoSlot?.ref}
        register={register}
        data-ui="photo-grid-photo"
        type="button"
        aria-label={photoSlot?.['aria-label'] ?? photoLabel}
        css={[photoStyle, photoSlot?.sx]}
        onFocus={(event) => {
          photoSlot?.onFocus?.(event);
          onPhotoFocus(event.currentTarget, photo.id, index);
        }}
        onClick={(event) => {
          photoSlot?.onClick?.(event);
          if (!event.defaultPrevented) onPhotoOpen(photo.id);
        }}
        onKeyDown={(event) => {
          photoSlot?.onKeyDown?.(event);
          if (!event.defaultPrevented) onPhotoKeyDown(event, index);
        }}
      >
        <LayoutLayer layoutId={shared ? photo.id : undefined} transition={SPRING} css={imageBoxStyle}>
          <PhotoImage key={`${photo.src}\u0000${photo.srcSet ?? ''}`} photo={photo} unavailable={unavailable} />
        </LayoutLayer>
      </PhotoButton>
      <Favorite
        {...withoutSx(favoriteSlot)}
        type="button"
        data-ui="photo-grid-favorite"
        aria-pressed={favorite}
        aria-label={favoriteSlot?.['aria-label'] ?? favoriteLabel}
        css={[tileFavoriteStyle, favoriteSlot?.sx]}
        onFocus={(event) => {
          favoriteSlot?.onFocus?.(event);
          onFavoriteFocus(photo.id, index);
        }}
        onClick={(event) => {
          favoriteSlot?.onClick?.(event);
          if (!event.defaultPrevented) onFavoriteToggle(photo.id);
        }}
      >
        <StarGlyph filled={favorite} />
      </Favorite>
    </>
  );
});

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
      {/* A closed viewer renders only its dialog shell, so grid updates skip its chrome and filmstrip. */}
      {present && <div css={viewerContentStyle}>
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
      </div>}
    </Viewer>
  );
}

/**
 * The grid's live region. It owns the announcement state, so announcing a density, selection,
 * or favorite change re-renders only this element instead of the whole grid mid-animation.
 */
function PhotoGridStatus({
  component: Status,
  slot,
  density,
  selected,
  favorites,
  favoriteState,
  open,
  variant,
  photos,
  labels,
  format,
}: {
  component: 'div' | NonNullable<PhotoGridSlots['status']>;
  slot?: Slot<'div'>;
  density: number;
  selected: string | null | undefined;
  favorites: ReadonlySet<string>;
  favoriteState: readonly string[] | undefined;
  open: boolean | undefined;
  variant: NonNullable<PhotoGridProps['variant']>;
  photos: readonly PhotoGridPhoto[];
  labels: PhotoGridLabels;
  format: Intl.NumberFormat;
}) {
  const [status, setStatus] = useState('');
  const lastAccepted = useRef({ density, selected, favorites });
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
  return (
    <Status
      {...withoutSx(slot)}
      role="status"
      aria-live="polite"
      aria-atomic="true"
      css={[statusStyle, slot?.sx]}
    >
      {status}
    </Status>
  );
}

export function PhotoGrid<P extends PhotoGridPhoto = PhotoGridPhoto>({
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
}: PhotoGridProps<P>) {
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

  if (isDev) {
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

  // Stable tile handlers keep `PhotoTile` memoized across density and focus changes.
  const onPhotoFocus = useLatestCallback((button: HTMLButtonElement, photoId: string, index: number) => {
    buttons.current.set(photoId, button);
    focused.current = { id: photoId, index, kind: 'photo' };
  });
  const onPhotoOpen = useLatestCallback((photoId: string) => {
    invoker.current = photoId;
    select(photoId);
    lifecycle.setOpen(true);
  });
  const onPhotoKeyDown = useLatestCallback(handlePhotoKey);
  const onFavoriteFocus = useLatestCallback((photoId: string, index: number) => {
    focused.current = { id: photoId, index, kind: 'favorite' };
  });
  const onFavoriteToggle = useLatestCallback(toggleFavorite);

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
                        <LayoutLayer
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
                          <PhotoTile
                            photo={photo}
                            index={index}
                            favorite={favorites.has(photo.id)}
                            shared={!reduced && visible}
                            photoLabel={labels.openPhoto(photo.title, photo.alt, favorites.has(photo.id))}
                            favoriteLabel={labels.favorite(photo.title, favorites.has(photo.id))}
                            unavailable={labels.imageUnavailable}
                            photoComponent={slots?.photo}
                            photoSlot={slotProps?.photo}
                            favoriteComponent={Favorite}
                            favoriteSlot={slotProps?.favorite}
                            buttons={buttons.current}
                            onPhotoFocus={onPhotoFocus}
                            onPhotoOpen={onPhotoOpen}
                            onPhotoKeyDown={onPhotoKeyDown}
                            onFavoriteFocus={onFavoriteFocus}
                            onFavoriteToggle={onFavoriteToggle}
                          />
                        </LayoutLayer>
                      </Item>
                    ))}
                  </List>
                </motion.div>
              ) : (
                <p css={detailStyle}>{labels.empty}</p>
              )}
              <PhotoGridStatus
                component={Status}
                slot={slotProps?.status}
                density={density}
                selected={selected}
                favorites={favorites}
                favoriteState={favoriteState}
                open={open}
                variant={variant}
                photos={photos}
                labels={labels}
                format={format}
              />
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
