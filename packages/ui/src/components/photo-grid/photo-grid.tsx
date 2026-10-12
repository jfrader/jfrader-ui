'use client';

import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentPropsWithRef,
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
import { css, keyframes, type Interpolation, type Theme } from '../../styling/css';
import { focusRingOutset } from '../../styling/focus-ring';
import { FORCED_COLORS, REDUCED_MOTION } from '../../styling/media';
import { WithSx, type SxProps } from '../../styling/sx';
import { isRenderable } from '../../utils/renderable';
import { useControlledState } from '../../utils/use-controlled-state';

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

type Slot<Tag extends keyof React.JSX.IntrinsicElements> = Omit<ComponentPropsWithRef<Tag>, 'children'> & {
  css?: Interpolation<Theme>;
};
type ActionSlot = Omit<Slot<'button'>, 'type' | 'disabled' | 'aria-pressed'>;

export interface PhotoGridSlotProps {
  header?: Slot<'header'>;
  title?: Slot<'h2'>;
  density?: Slot<'div'>;
  list?: Slot<'ul'>;
  item?: Slot<'li'>;
  photo?: ActionSlot;
  favorite?: ActionSlot;
  viewer?: Omit<Slot<'dialog'>, 'open'>;
  stage?: Slot<'div'>;
  filmstrip?: Omit<Slot<'input'>, 'type' | 'value' | 'defaultValue' | 'min' | 'max' | 'step' | 'disabled'>;
  controls?: Slot<'div'>;
  status?: Slot<'div'>;
}

export interface PhotoGridLabels {
  larger: string;
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
  columns: (columns: string) => string;
}

export interface PhotoGridProps
  extends Omit<ComponentPropsWithRef<'div'>, 'children' | 'defaultValue'>, SxProps {
  photos: readonly PhotoGridPhoto[];
  title: string;
  /** Preferred columns. Narrow containers reduce effective columns without changing this axis. */
  densitySteps?: readonly number[];
  density?: number;
  defaultDensity?: number;
  onDensityChange?: (columns: number) => void;
  favorites?: readonly string[];
  defaultFavorites?: readonly string[];
  onFavoritesChange?: (ids: string[]) => void;
  onFavoriteChange?: (id: string, favorite: boolean) => void;
  value?: string | null;
  defaultValue?: string | null;
  onValueChange?: (id: string | null) => void;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  labels?: Partial<PhotoGridLabels>;
  locale?: Intl.LocalesArgument;
  slotProps?: PhotoGridSlotProps;
}

declare const process: { env: { NODE_ENV?: string } };

const DEFAULT_STEPS = [5, 3, 2] as const;
const DEFAULT_DENSITY = 3;
const EMPTY_IDS: readonly string[] = [];
const PAGE_ROWS = 3;
const PINCH_THRESHOLD = 0.15;
const ZOOM_STEP = 0.5;
const MAX_ZOOM = 3;
const PAN_STEP = 40;
const DISMISS_DISTANCE = 100;
/**
 * Narrowest tile, in `space[12]` units, before narrow containers drop effective columns. The unit is
 * read back as px: space tokens are authored in px, and a custom property resolves var() but not calc().
 */
const MIN_CELL_VAR = '--photo-grid-min-cell-unit';
const MIN_CELL_UNITS = 2;
const SPRING = { type: 'spring', stiffness: 360, damping: 36 } as const;
const favoritePop = keyframes({ from: { transform: 'scale(0.85)' }, to: { transform: 'scale(1)' } });
const captionFade = keyframes({ from: { opacity: 0 }, to: { opacity: 1 } });
const defaultLabels: PhotoGridLabels = {
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
  columns: (columns) => `${columns} columns`,
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
const titleStyle = css({ margin: 0, fontSize: vars.textSize.lg, overflowWrap: 'anywhere' });
const controlsStyle = css({ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: vars.space[2] });
const actionStyle = css({
  appearance: 'none',
  boxSizing: 'border-box',
  minBlockSize: vars.space[8],
  minInlineSize: vars.space[8],
  paddingBlock: vars.space[1],
  paddingInline: vars.space[3],
  border: `1px solid ${vars.color.borderControl}`,
  borderRadius: vars.radius.sm,
  background: vars.color.surfaceRaised,
  color: vars.color.text,
  font: 'inherit',
  fontSize: vars.textSize.sm,
  cursor: 'pointer',
  overflowWrap: 'anywhere',
  '&:disabled': { cursor: 'default', color: vars.color.textMuted },
  '&:focus-visible': focusRingOutset,
  '&[aria-pressed="true"]': { color: vars.color.accentText, borderColor: vars.color.accentText },
  transitionProperty: 'background-color, border-color',
  transitionDuration: vars.motion.duration.fast,
  [REDUCED_MOTION]: { transitionDuration: '0s' },
  [FORCED_COLORS]: {
    borderColor: 'ButtonText',
    '&[aria-pressed="true"]': { borderColor: 'Highlight', outline: '1px solid Highlight' },
  },
});
const responsiveNavStyle = css({
  [ '@media (max-width: 640px), (hover: none)' ]: {
    display: 'none',
  },
});
const listStyle = css({
  display: 'grid',
  gridTemplateColumns: 'repeat(var(--photo-grid-columns), minmax(0, 1fr))',
  gap: vars.space[3],
  padding: 0,
  margin: 0,
  listStyle: 'none',
  [MIN_CELL_VAR]: vars.space[12],
  touchAction: 'pan-y',
});
const itemStyle = css({ display: 'grid', gap: vars.space[2], minInlineSize: 0 });
const photoStyle = css({
  position: 'relative',
  display: 'grid',
  placeItems: 'center',
  inlineSize: '100%',
  aspectRatio: '1',
  padding: 0,
  borderRadius: vars.radius.md,
  background: vars.color.surfaceInset,
});
const imageStyle = css({
  display: 'block',
  inlineSize: '100%',
  blockSize: '100%',
  objectFit: 'cover',
  borderRadius: 'inherit',
});
const fallbackStyle = css({
  padding: vars.space[3],
  boxSizing: 'border-box',
  textAlign: 'center',
  color: vars.color.textMuted,
});
const favoriteStyle = css({
  justifySelf: 'start',
  maxInlineSize: '100%',
  '&[aria-pressed="true"]': {
    animation: `${favoritePop} ${vars.motion.duration.base} ${vars.motion.easeStandard}`,
  },
  [REDUCED_MOTION]: { '&[aria-pressed="true"]': { animation: 'none' } },
});
const imageBoxStyle = css({ inlineSize: '100%', blockSize: '100%', borderRadius: 'inherit' });
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
  background: vars.color.surfaceRaised,
  color: vars.color.text,
  fontFamily: vars.font.sans,
  position: 'fixed',
  inset: 0,
  display: 'flex',
  flexDirection: 'column',
  '&::backdrop': {
    background: vars.color.scrim,
    backdropFilter: 'blur(12px)',
    [ '@media (prefers-reduced-transparency: reduce)' ]: {
      backdropFilter: 'none',
    },
  },
});
const viewerContentStyle = css({
  display: 'flex',
  flexDirection: 'column',
  flex: '1 1 0',
  minBlockSize: 0,
  gap: vars.space[3],
  padding: vars.space[4],
  overflow: 'hidden',
});
const stageStyle = css({
  position: 'relative',
  display: 'grid',
  placeItems: 'center',
  flex: '1 1 0',
  minBlockSize: 0,
  overflow: 'hidden',
  background: vars.color.surfaceInset,
  touchAction: 'none',
  '&:focus-visible': focusRingOutset,
});
const fullImageStyle = css({
  display: 'block',
  inlineSize: '100%',
  blockSize: '100%',
  objectFit: 'contain',
  userSelect: 'none',
  pointerEvents: 'none',
});
const filmstripStyle = css({
  inlineSize: '100%',
  minBlockSize: vars.space[8],
  accentColor: vars.color.accent,
  '&:focus-visible': focusRingOutset,
  [ '@media (max-width: 640px), (hover: none)' ]: {
    minBlockSize: vars.space[4],
  },
});
const statusStyle = css({
  fontSize: vars.textSize.sm,
  color: vars.color.textMuted,
  overflowWrap: 'anywhere',
});
const countStyle = css({
  fontSize: vars.textSize.sm,
  color: vars.color.textMuted,
  whiteSpace: 'nowrap',
});
const densityReadoutStyle = css({
  fontSize: vars.textSize.sm,
  color: vars.color.textMuted,
  paddingInline: vars.space[2],
  border: `1px solid ${vars.color.borderControl}`,
  borderRadius: vars.radius.sm,
  [FORCED_COLORS]: {
    borderColor: 'ButtonText',
  },
});
const filmstripWrapperStyle = css({
  display: 'grid',
  gap: vars.space[1],
});
const headerLeftStyle = css({
  display: 'flex',
  alignItems: 'baseline',
  gap: vars.space[2],
});
const detailStyle = css({
  margin: 0,
  color: vars.color.textMuted,
  fontSize: vars.textSize.sm,
  overflowWrap: 'anywhere',
  animation: `${captionFade} ${vars.motion.duration.slow} ${vars.motion.easeStandard}`,
  [REDUCED_MOTION]: { animation: 'none' },
});

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

function PhotoImage({
  photo,
  full,
  unavailable,
}: {
  photo: PhotoGridPhoto;
  full?: boolean;
  unavailable: string;
}) {
  const [failed, setFailed] = useState(false);
  if (failed || !photo.src)
    return (
      <span data-image-state="error" aria-hidden={!full || undefined} title={unavailable} css={fallbackStyle}>
        {full ? unavailable : <>▧ {photo.title}</>}
      </span>
    );
  return (
    <img
      src={photo.src}
      srcSet={photo.srcSet}
      sizes={photo.sizes}
      alt=""
      width={photo.width}
      height={photo.height}
      loading={full ? 'eager' : 'lazy'}
      decoding="async"
      draggable={false}
      css={full ? fullImageStyle : imageStyle}
      onError={() => setFailed(true)}
    />
  );
}

function PhotoButton({
  ref,
  register,
  ...props
}: ComponentPropsWithRef<'button'> & { register: (node: HTMLButtonElement | null) => (() => void) | void }) {
  const mergedRef = useMergeRefs([ref, register]);
  return <button {...props} ref={mergedRef} />;
}

interface ViewerProps {
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
  restore: () => void;
}

function PhotoViewer({
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
  restore,
}: ViewerProps) {
  const id = useId();
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const mergedStageRef = useMergeRefs([stageRef, slots?.stage?.ref]);
  const lifecycle = controller;
  const viewerSlot = omitNativeOpen(slots?.viewer ?? {});
  const native = useNativeDialog(
    { ...lifecycle, open: open && photos.length > 0 },
    {
      onCancel: (event) => {
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
  );
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
    x.set(0);
    y.set(0);
    scale.set(1);
    if (!open) setZoomState({ id: selected, value: 1 });
    pointers.current.clear();
    gesture.current = null;
  }, [selected, open, x, y, scale]);
  useEffect(() => {
    if (dialogRef.current?.open) closeRef.current?.focus({ preventScroll: true });
  }, [open, lifecycle.repairToken]);
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
    const value = Math.min(MAX_ZOOM, Math.max(1, next));
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
  const renderAction = (label: string, action: () => void, disabled = false, pressed = false, extraCss?: Interpolation<Theme>) => (
    <button type="button" css={[actionStyle, extraCss]} disabled={disabled} aria-pressed={pressed || undefined} onClick={action}>
      {label}
    </button>
  );

  return (
    <dialog
      {...viewerSlot}
      ref={native.ref}
      data-ui="photo-grid-viewer"
      aria-modal="true"
      aria-labelledby={ids(viewerSlot['aria-labelledby'], `${id}-title`)}
      aria-describedby={ids(viewerSlot['aria-describedby'], hasDetail && `${id}-detail`)}
      css={[viewerStyle, viewerSlot.css]}
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
        <header role="presentation" css={headerStyle}>
          <h2 id={`${id}-title`} css={titleStyle}>
            {photo?.title ?? labels.unavailable}
          </h2>
          <button ref={closeRef} type="button" css={actionStyle} onClick={lifecycle.requestClose}>
            {labels.close}
          </button>
        </header>
        <div
          {...slots?.stage}
          ref={mergedStageRef}
          data-ui="photo-grid-stage"
          tabIndex={photo ? 0 : undefined}
          role="group"
          aria-label={slots?.stage?.['aria-label'] ?? photo?.title ?? labels.unavailable}
          css={[stageStyle, slots?.stage?.css]}
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
              scale.set(Math.min(MAX_ZOOM, Math.max(1, drag.zoom * ratio)));
            } else if (zoom > 1) {
              pan(
                drag.x + event.clientX - drag.originX - x.get(),
                drag.y + event.clientY - drag.originY - y.get(),
              );
            } else if (!reduced) {
              x.set(event.clientX - drag.originX);
              y.set(event.clientY - drag.originY);
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
                )
                  navigate(index + (event.clientX < drag.originX ? 1 : -1));
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
              layoutId={open && !reduced ? photo.id : undefined}
              transition={SPRING}
              css={imageBoxStyle}
            >
              <motion.div style={{ x, y, scale }} css={imageBoxStyle}>
                {open && (
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
            <span css={fallbackStyle}>{labels.unavailable}</span>
          )}
        </div>
        <div {...slots?.controls} css={[controlsStyle, slots?.controls?.css]}>
          {renderAction(labels.previous, () => navigate(index - 1), index <= 0, false, responsiveNavStyle)}
          {renderAction(labels.next, () => navigate(index + 1), index < 0 || index >= photos.length - 1, false, responsiveNavStyle)}
          {renderAction(labels.zoomIn, () => setZoom(zoom + ZOOM_STEP), !photo || zoom >= MAX_ZOOM, zoom >= MAX_ZOOM)}
          {renderAction(labels.zoomOut, () => setZoom(zoom - ZOOM_STEP), !photo || zoom <= 1, zoom <= 1)}
          {renderAction(labels.resetZoom, () => setZoom(1), !photo || zoom === 1, zoom === 1)}
          {zoom > 1 && (
            <>
              {renderAction(labels.panLeft, () => pan(PAN_STEP, 0))}
              {renderAction(labels.panRight, () => pan(-PAN_STEP, 0))}
              {renderAction(labels.panUp, () => pan(0, PAN_STEP))}
              {renderAction(labels.panDown, () => pan(0, -PAN_STEP))}
            </>
          )}
        </div>
        <div css={filmstripWrapperStyle}>
          <input
            {...slots?.filmstrip}
            type="range"
            data-ui="photo-grid-filmstrip"
            min={0}
            max={Math.max(0, photos.length - 1)}
            step={1}
            value={Math.max(0, index)}
            disabled={photos.length < 2 || !photo}
            aria-label={slots?.filmstrip?.['aria-label'] ?? labels.filmstrip}
            aria-valuetext={position}
            css={[filmstripStyle, slots?.filmstrip?.css]}
            onChange={(event) => {
              slots?.filmstrip?.onChange?.(event);
              if (!event.defaultPrevented) navigate(event.currentTarget.valueAsNumber);
            }}
          />
        </div>
        {photo && (
          <button
            {...slots?.favorite}
            type="button"
            aria-pressed={favorites.has(photo.id)}
            css={[actionStyle, favoriteStyle, slots?.favorite?.css]}
            onClick={(event) => {
              slots?.favorite?.onClick?.(event);
              if (!event.defaultPrevented) toggleFavorite(photo.id);
            }}
          >
            {favorites.has(photo.id) ? '★' : '☆'} {labels.favorite(photo.title, favorites.has(photo.id))}
          </button>
        )}
        {hasDetail && (
          <p key={photo.id} id={`${id}-detail`} css={detailStyle}>
            {photo.detail}
          </p>
        )}
        <div role="status" aria-live="polite" aria-atomic="true" css={statusStyle}>
          {position}
        </div>
      </div>
    </dialog>
  );
}

export function PhotoGrid({
  ref,
  photos,
  title,
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
  className,
  sx,
  onKeyDown,
  ...rest
}: PhotoGridProps) {
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
  const [selected, select] = useControlledState<string | null>(
    valueProp,
    defaultValue === undefined ? (photos[0]?.id ?? null) : defaultValue,
    onValueChange,
  );
  const [open, setOpen] = useControlledState(openProp, defaultOpen, onOpenChange);
  const lifecycle = useNativeDialogRoot((open ?? false) && photos.length > 0, setOpen);
  const labels = { ...defaultLabels, ...labelOverrides };
  const format = new Intl.NumberFormat(locale);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);
  const rootMergedRef = useMergeRefs([rootRef, ref]);
  const listMergedRef = useMergeRefs([listRef, slotProps?.list?.ref]);
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const focused = useRef<{ id: string; index: number; kind: 'photo' | 'favorite' } | null>(null);
  const invoker = useRef<string | null>(null);
  const anchor = useRef<{ id: string; top: number; density: number } | null>(null);
  const columns = density;
  const reduced = useReducedMotion();
  const [visible, setVisible] = useState(true);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ distance: number; ratio: number; focalId: string | null } | null>(null);
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

  useEffect(() => {
    const doc = rootRef.current?.ownerDocument;
    if (!doc) return;
    const abortOutside = (event: globalThis.PointerEvent) => {
      if (listRef.current?.contains(event.target as Node)) return;
      pointers.current.delete(event.pointerId);
      pinch.current = null;
      preview.set(1);
      previewOriginX.set('50%');
      previewOriginY.set('50%');
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
      button.focus({ preventScroll: true });
      scrollBy(rootRef.current, button.getBoundingClientRect().top - pending.top);
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
    if (previous.density !== density) setStatus(labels.columns(format.format(density)));
    else if (previous.selected !== selected && open) {
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
  const changeDensity = (direction: number, focalId = focused.current?.id ?? photos[0]?.id) => {
    const next = steps[Math.min(steps.length - 1, Math.max(0, densityIndex + direction))]!;
    if (next === density) return;
    const button = focalId ? buttons.current.get(focalId) : undefined;
    anchor.current =
      button && focalId ? { id: focalId, top: button.getBoundingClientRect().top, density: next } : null;
    requestDensity(next);
  };
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
      changeDensity(1, photos[index]!.id);
    }
    if (event.key === '-') {
      event.preventDefault();
      changeDensity(-1, photos[index]!.id);
    }
  };
  const restore = () => {
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
      if (!event.ctrlKey) return;
      event.preventDefault();
      const dir = event.deltaY < 0 ? 1 : -1; // wheel up -> larger thumbnails (lower column count, matching pinch)
      changeDensity(dir);
    };
    root.addEventListener('wheel', onWheel, { passive: false });
    return () => root.removeEventListener('wheel', onWheel);
  }, [changeDensity]);

  return (
    <MotionConfig reducedMotion="user">
      <LayoutGroup id={id}>
        <WithSx className={className} styles={rootStyle} sx={sx}>
          {(rootClass) => (
            <div
              {...rest}
              ref={rootMergedRef}
              className={rootClass}
              data-ui="photo-grid"
              role="region"
              tabIndex={rest.tabIndex ?? -1}
              aria-labelledby={ids(rest['aria-labelledby'], slotProps?.title?.id ?? `${id}-title`)}
              data-density={density}
              data-columns={columns}
              onKeyDown={onKeyDown}
            >
              <header
                {...slotProps?.header}
                role={slotProps?.header?.role ?? 'presentation'}
                css={[headerStyle, slotProps?.header?.css]}
              >
                <div css={headerLeftStyle}>
                  <h2
                    {...slotProps?.title}
                    id={slotProps?.title?.id ?? `${id}-title`}
                    css={[titleStyle, slotProps?.title?.css]}
                  >
                    {title}
                  </h2>
                  <span css={countStyle} aria-label={`${photos.length} photos`}>
                    {format.format(photos.length)} photos
                  </span>
                </div>
                <div
                  {...slotProps?.density}
                  role="group"
                  aria-label={slotProps?.density?.['aria-label'] ?? labels.density}
                  css={[controlsStyle, slotProps?.density?.css]}
                >
                  <button
                    type="button"
                    css={actionStyle}
                    disabled={!photos.length || densityIndex === steps.length - 1}
                    onClick={() => changeDensity(1)}
                  >
                    {labels.larger}
                  </button>
                  <button
                    type="button"
                    css={actionStyle}
                    disabled={!photos.length || densityIndex === 0}
                    onClick={() => changeDensity(-1)}
                  >
                    {labels.smaller}
                  </button>
                  <span css={densityReadoutStyle} aria-label={labels.columns(format.format(density))}>
                    {density}
                  </span>
                </div>
              </header>
              {photos.length ? (
                <motion.div style={{ scale: preview, transformOrigin: previewOrigin }}>
                  <ul
                    {...slotProps?.list}
                    ref={listMergedRef}
                    css={[listStyle, slotProps?.list?.css]}
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
                        pinch.current = {
                          distance: Math.hypot(points[1]!.x - points[0]!.x, points[1]!.y - points[0]!.y),
                          ratio: 1,
                          focalId: item?.dataset.photoId ?? focused.current?.id ?? null,
                        };
                        const rect = event.currentTarget.getBoundingClientRect();
                        const cx = (points[0]!.x + points[1]!.x) / 2;
                        const cy = (points[0]!.y + points[1]!.y) / 2;
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
                      preview.set(1);
                      previewOriginX.set('50%');
                      previewOriginY.set('50%');
                      if (!event.defaultPrevented && drag && Math.abs(drag.ratio - 1) >= PINCH_THRESHOLD)
                        changeDensity(drag.ratio > 1 ? 1 : -1, drag.focalId ?? undefined);
                    }}
                    onPointerCancel={(event) => {
                      slotProps?.list?.onPointerCancel?.(event);
                      pointers.current.clear();
                      pinch.current = null;
                      preview.set(1);
                      previewOriginX.set('50%');
                      previewOriginY.set('50%');
                    }}
                    onLostPointerCapture={(event) => {
                      slotProps?.list?.onLostPointerCapture?.(event);
                      pointers.current.clear();
                      pinch.current = null;
                      preview.set(1);
                      previewOriginX.set('50%');
                      previewOriginY.set('50%');
                    }}
                  >
                    {photos.map((photo, index) => (
                      <li
                        {...slotProps?.item}
                        key={photo.id}
                        data-photo-id={photo.id}
                        css={slotProps?.item?.css}
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
                            {...slotProps?.photo}
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
                            css={[actionStyle, photoStyle, slotProps?.photo?.css]}
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
                          <button
                            {...slotProps?.favorite}
                            type="button"
                            data-ui="photo-grid-favorite"
                            aria-pressed={favorites.has(photo.id)}
                            aria-label={
                              slotProps?.favorite?.['aria-label'] ??
                              labels.favorite(photo.title, favorites.has(photo.id))
                            }
                            css={[actionStyle, favoriteStyle, slotProps?.favorite?.css]}
                            onFocus={(event) => {
                              slotProps?.favorite?.onFocus?.(event);
                              focused.current = { id: photo.id, index, kind: 'favorite' };
                            }}
                            onClick={(event) => {
                              slotProps?.favorite?.onClick?.(event);
                              if (!event.defaultPrevented) toggleFavorite(photo.id);
                            }}
                          >
                            {favorites.has(photo.id) ? '★' : '☆'}
                          </button>
                        </motion.div>
                      </li>
                    ))}
                  </ul>
                </motion.div>
              ) : (
                <p css={detailStyle}>{labels.empty}</p>
              )}
              <div
                {...slotProps?.status}
                role="status"
                aria-live="polite"
                aria-atomic="true"
                css={[statusStyle, slotProps?.status?.css]}
              >
                {status}
              </div>
              <PhotoViewer
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
                restore={restore}
              />
            </div>
          )}
        </WithSx>
      </LayoutGroup>
    </MotionConfig>
  );
}

PhotoGrid.displayName = 'PhotoGrid';
