'use client';

import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ComponentPropsWithRef,
  type ComponentType,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from 'react';
import { useMergeRefs } from '@floating-ui/react';
import { animate, MotionConfig, motion, useMotionValue, useReducedMotion } from 'motion/react';
import { vars } from '@jfrader/tokens/vars';
import { styledDialogTransition } from '../../overlay/exit-motion';
import {
  omitNativeOpen,
  useNativeDialog,
  useNativeDialogRoot,
  type NativeDialogController,
} from '../../overlay/use-native-dialog';
import { css, type Interpolation, type Theme } from '../../styling/css';
import { focusRingOutset } from '../../styling/focus-ring';
import { FORCED_COLORS, REDUCED_MOTION } from '../../styling/media';
import { motionDurationMs } from '../../styling/motion-timings';
import {
  enterTransition as enter,
  exitTransition as exit,
  MODAL_ENTER_SCALE,
  modalBackdropMotion,
} from '../../styling/overlay-motion';
import { withoutSx, WithSx, type SxProps } from '../../styling/sx';
import { numberFormatter } from '../../utils/intl';
import { isRenderable } from '../../utils/renderable';
import { useControlledState } from '../../utils/use-controlled-state';
import { useImageStatus } from '../../utils/use-image-status';
import { Filmstrip, ViewerHeader, ViewerToolbar } from './lightbox-gallery-chrome';

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

const MIN_COLUMN_WIDTH = 150;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.5;
const PAN_PROGRESS = 0.1;
const DISMISS_PROGRESS = 0.25;
const SWIPE_PROGRESS = 0.2;
const DISMISS_VELOCITY = 800;
const DOUBLE_TAP_DISTANCE = 24;
const DOUBLE_TAP_MS = motionDurationMs.slow * 1.5;
const DRAG_SLOP = 8;
const WHEEL_ZOOM_RATE = 0.002;
const FLIGHT_SPRING = { type: 'spring', stiffness: 360, damping: 36 } as const;
export const lightboxLabelDefaults: LightboxGalleryLabels = {
  open: 'Open image',
  close: 'Close viewer',
  previous: 'Previous image',
  next: 'Next image',
  zoom: 'Toggle zoom',
  zoomIn: 'Zoom in',
  zoomOut: 'Zoom out',
  reset: 'Reset zoom',
  panLeft: 'Pan left',
  panRight: 'Pan right',
  panUp: 'Pan up',
  panDown: 'Pan down',
  empty: 'No images',
  unavailable: 'Image unavailable',
  imageUnavailable: 'Image unavailable',
  loading: 'Loading image',
  thumbnails: 'Choose image',
  position: (position, total) => `${position} / ${total}`,
  zoomPercent: (percent) => percent,
};
const rootStyle = css({
  label: 'lightbox-gallery',
  minInlineSize: 0,
  color: vars.color.text,
  fontFamily: vars.font.sans,
  '&:focus-visible': focusRingOutset,
});
const gridStyle = css({
  display: 'grid',
  gridTemplateColumns: 'repeat(var(--lightbox-columns, 2), minmax(0, 1fr))',
  gridAutoRows: '1px',
  gap: 'var(--lightbox-gap)',
  padding: 0,
  margin: 0,
  listStyle: 'none',
});
const tileStyle = css({
  position: 'relative',
  display: 'block',
  inlineSize: '100%',
  minBlockSize: vars.space[8],
  padding: 0,
  border: `1px solid ${vars.color.borderControl}`,
  borderRadius: vars.radius.md,
  background: 'transparent',
  cursor: 'pointer',
  overflow: 'hidden',
  '&:focus-visible': focusRingOutset,
});
const imageStyle = css({
  position: 'relative',
  display: 'block',
  inlineSize: '100%',
  blockSize: '100%',
  objectFit: 'cover',
  userSelect: 'none',
});
// Motion: the viewer's own surface (background, border) and its chrome fade over the fading scrim;
// the image fades and scales in (during its flight from the tile, when it has one). On close an
// image that flies home stays put for the hand-off to the return flight; otherwise it fades with
// the chrome.
const hiddenSurface = { backgroundColor: 'transparent', borderColor: 'transparent' };
const hiddenImage = { opacity: 0, scale: String(MODAL_ENTER_SCALE) };
const viewerStyle = css(
  {
    boxSizing: 'border-box',
    inlineSize: '100%',
    maxInlineSize: '100%',
    blockSize: '100dvh',
    maxBlockSize: '100dvh',
    margin: 0,
    border: `1px solid ${vars.color.borderControl}`,
    background: vars.color.bg,
    color: vars.color.text,
    padding: `max(${vars.space[4]}, env(safe-area-inset-top)) max(${vars.space[4]}, env(safe-area-inset-right)) max(${vars.space[4]}, env(safe-area-inset-bottom)) max(${vars.space[4]}, env(safe-area-inset-left))`,
    overflow: 'auto',
    fontFamily: vars.font.sans,
    '&::backdrop': { background: vars.color.scrim },
    transitionProperty: 'background-color, border-color',
    ...enter,
    '@starting-style': hiddenSurface,
    '&[data-state="closing"]': { ...hiddenSurface, ...exit },
    [REDUCED_MOTION]: { '&, &[data-state="closing"]': { transitionDuration: '0s' } },
    [FORCED_COLORS]: { boxShadow: 'none' },
  },
  modalBackdropMotion,
);
const CHROME = ':not([data-ui="lightbox-gallery-stage"])';
const contentStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: vars.space[3],
  blockSize: '100%',
  minBlockSize: 0,
  '& > *': { flexShrink: 0 },
  [`& > ${CHROME}`]: { transitionProperty: 'opacity', ...enter, '@starting-style': { opacity: 0 } },
  [`&[data-state="closing"] > ${CHROME}`]: { opacity: 0, ...exit },
  [REDUCED_MOTION]: { [`& > ${CHROME}, &[data-state="closing"] > ${CHROME}`]: { transitionDuration: '0s' } },
});
const stageStyle = css({
  position: 'relative',
  display: 'grid',
  placeItems: 'center',
  flex: '1 1 auto',
  blockSize: '50dvh',
  minBlockSize: vars.space[12],
  overflow: 'hidden',
  touchAction: 'none',
  borderRadius: vars.radius.md,
  '&:focus-visible': focusRingOutset,
});
// Motion values own `transform` here (flight); the entrance moves the separate `scale` property.
const viewerImageStyle = css({
  position: 'absolute',
  pointerEvents: 'none',
  display: 'grid',
  placeItems: 'center',
  transitionProperty: 'opacity, scale',
  ...enter,
  '@starting-style': hiddenImage,
  '&[data-exit="fade"]': { ...hiddenImage, ...exit },
  [REDUCED_MOTION]: { '&, &[data-exit="fade"]': { transitionDuration: '0s' } },
});
const captionStyle = css({
  margin: 0,
  fontSize: vars.textSize.sm,
  color: vars.color.textMuted,
  overflowWrap: 'anywhere',
  maxBlockSize: '25%',
  overflow: 'auto',
  '&:focus-visible': focusRingOutset,
});
const fallbackStyle = css({
  position: 'absolute',
  inset: 0,
  display: 'grid',
  placeItems: 'center',
  padding: vars.space[3],
  color: vars.color.textMuted,
  textAlign: 'center',
  overflowWrap: 'anywhere',
});
const statusStyle = css({
  fontSize: vars.textSize.sm,
  color: vars.color.textMuted,
  overflowWrap: 'anywhere',
});
// Hidden only while the client knows the image is loading (server markup never carries the
// state); only the reveal fades.
const loadingStyle = css({
  transitionProperty: 'opacity',
  transitionDuration: vars.motion.duration.base,
  '&[data-image-state="loading"]': { opacity: 0, transitionDuration: '0s' },
  [REDUCED_MOTION]: { transitionDuration: '0s' },
});
const returnFlightStyle = css({
  position: 'fixed',
  pointerEvents: 'none',
  transformOrigin: 'top left',
  zIndex: 1,
  overflow: 'hidden',
  borderRadius: vars.radius.md,
});

interface ReturnFlight {
  image: LightboxGalleryImage;
  from: { left: number; top: number; width: number; height: number };
  to: { left: number; top: number; width: number; height: number };
}

function joinIds(...ids: (string | undefined | false)[]) {
  return ids.filter(Boolean).join(' ') || undefined;
}
function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
function validPositive(value: number, fallback: number) {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}
/** The viewer's magnification cap: `maxZoom` when positive and finite, else the default, never below 1. */
export function lightboxZoomLimit(maxZoom = MAX_ZOOM) {
  return Math.max(1, validPositive(maxZoom, MAX_ZOOM));
}

function GalleryImage({
  image,
  decorative = false,
  labels,
  slot,
  component,
}: {
  image: LightboxGalleryImage;
  decorative?: boolean;
  labels: LightboxGalleryLabels;
  slot?: LightboxGallerySlotProps['image'];
  component?: LightboxGallerySlots['image'];
}) {
  const Image = component ?? 'img';
  const status = useImageStatus(image.src);
  const { ref, onLoad, onError, ...rest } = slot ?? {};
  const mergedRef = useMergeRefs([status.ref, ref]);
  const state = image.src ? status.status : 'error';
  return (
    <>
      {(state === 'loading' || state === 'error') && (
        <span css={fallbackStyle} aria-hidden={decorative || undefined} data-image-state={state}>
          {decorative ? '▧' : state === 'error' ? labels.imageUnavailable : labels.loading}
        </span>
      )}
      {state !== 'error' && (
        <Image
          {...withoutSx(rest)}
          ref={mergedRef}
          css={[imageStyle, loadingStyle, slot?.sx]}
          src={image.src}
          srcSet={image.srcSet}
          sizes={image.sizes}
          alt={decorative ? '' : image.alt}
          aria-hidden={decorative || rest['aria-hidden']}
          width={image.width}
          height={image.height}
          loading={decorative ? 'lazy' : 'eager'}
          decoding="async"
          draggable={false}
          data-image-state={state}
          onLoad={(event) => {
            onLoad?.(event);
            status.onLoad();
          }}
          onError={(event) => {
            onError?.(event);
            status.onError();
          }}
        />
      )}
    </>
  );
}

function Tile({
  ref,
  register,
  component,
  ...props
}: ComponentPropsWithRef<'button'> & {
  register: (element: HTMLButtonElement | null) => void | (() => void);
  component?: LightboxGallerySlots['tile'];
}) {
  const Root = component ?? 'button';
  const merged = useMergeRefs([ref, register]);
  return <Root {...props} ref={merged} />;
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

interface ViewerProps extends LightboxViewerProps {
  returnFlight: (flight: ReturnFlight) => void;
}

function Viewer({
  images,
  selected,
  label,
  controller,
  select,
  restore,
  launch,
  home,
  labels,
  locale,
  maxZoom,
  slotProps,
  slots,
  returnFlight,
  reduced,
}: ViewerProps) {
  const ViewerDialog = slots?.viewer ?? 'dialog';
  const Stage = slots?.stage ?? 'div';
  const Caption = slots?.caption ?? 'p';
  const id = useId();
  const format = useMemo(() => numberFormatter(locale), [locale]);
  const percentFormat = useMemo(
    () => numberFormatter(locale, { style: 'percent', maximumFractionDigits: 0 }),
    [locale],
  );
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const stageMerged = useMergeRefs([stageRef, slotProps?.stage?.ref]);
  const { withDescription = true, ...viewerSlot } = omitNativeOpen(slotProps?.viewer ?? {});
  const lastStageBox = useRef<DOMRect | null>(null);
  const completeClose = () => {
    const target = home();
    const box = lastStageBox.current;
    if (!reduced && image && target?.isConnected && box?.width && bounds.width && bounds.height) {
      const to = target.getBoundingClientRect();
      if (to.width && to.height)
        returnFlight({
          image,
          from: {
            left: box.left + (box.width - bounds.width) / 2,
            top: box.top + (box.height - bounds.height) / 2,
            ...bounds,
          },
          to,
        });
    }
    restore();
  };
  const native = useNativeDialog(
    controller,
    {
      onCancel: viewerSlot.onCancel,
      onClick: viewerSlot.onClick,
      onClose: (event) => {
        viewerSlot.onClose?.(event);
        completeClose();
      },
    },
    viewerSlot.ref,
    dialogRef,
    styledDialogTransition,
  );
  const phase = native['data-state'];
  // Decided when the viewer opens, so the exit styles never flip mid-transition.
  const [homeward, setHomeward] = useState(false);
  const index = images.findIndex((image) => image.id === selected);
  const image = images[index];
  const [zoom, setZoomState] = useState(1);
  const [bounds, setBounds] = useState({ width: 0, height: 0 });
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const scale = useMotionValue(1);
  const flightX = useMotionValue(0);
  const flightY = useMotionValue(0);
  const flightScale = useMotionValue(1);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{
    originX: number;
    originY: number;
    x: number;
    y: number;
    zoom: number;
    distance?: number;
    focalX: number;
    focalY: number;
    pinched: boolean;
    lastX: number;
    lastY: number;
    lastTime: number;
    velocityX: number;
    velocityY: number;
  } | null>(null);
  const lastTap = useRef<{ x: number; y: number; time: number } | null>(null);
  const touchZoomTime = useRef(-Infinity);
  const suppressClick = useRef(false);
  const titleId = slotProps?.title?.id ?? `${id}-title`;
  const captionId = slotProps?.caption?.id ?? `${id}-caption`;
  const hasCaption = image && isRenderable(image.caption) && image.caption !== '';
  const position = image
    ? labels.position(format.format(index + 1), format.format(images.length))
    : labels.unavailable;
  const zoomText = labels.zoomPercent(percentFormat.format(zoom));
  const limits = (value = scale.get()) => ({
    x: Math.max(0, (bounds.width * value - (stageRef.current?.clientWidth ?? 0)) / 2),
    y: Math.max(0, (bounds.height * value - (stageRef.current?.clientHeight ?? 0)) / 2),
  });
  const pan = (nextX: number, nextY: number, value = scale.get()) => {
    x.stop();
    y.stop();
    const limit = limits(value);
    x.set(clamp(nextX, -limit.x, limit.x));
    y.set(clamp(nextY, -limit.y, limit.y));
  };
  const setZoom = (next: number, focalX = 0, focalY = 0) => {
    x.stop();
    y.stop();
    const value = clamp(next, 1, maxZoom);
    const ratio = value / scale.get();
    const nextX = focalX - (focalX - x.get()) * ratio;
    const nextY = focalY - (focalY - y.get()) * ratio;
    scale.set(value);
    setZoomState(value);
    pan(nextX, nextY, value);
  };
  const toggleZoomAt = (clientX: number, clientY: number) => {
    const box = stageRef.current?.getBoundingClientRect();
    if (box)
      setZoom(
        scale.get() > 1 ? 1 : 2,
        clientX - box.left - box.width / 2,
        clientY - box.top - box.height / 2,
      );
  };
  const settlePan = (velocityX = 0, velocityY = 0) => {
    const limit = limits();
    const horizon = motionDurationMs.base / 1000;
    const targetX = clamp(x.get() + velocityX * horizon, -limit.x, limit.x);
    const targetY = clamp(y.get() + velocityY * horizon, -limit.y, limit.y);
    if (reduced) {
      x.jump(targetX);
      y.jump(targetY);
    } else {
      animate(x, targetX, { ...FLIGHT_SPRING, velocity: velocityX });
      animate(y, targetY, { ...FLIGHT_SPRING, velocity: velocityY });
    }
  };
  const navigate = (next: number) => {
    const target = images[next];
    if (target) select(target.id);
  };

  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage || !image || !controller.open) return;
    const measure = () => {
      if (stage.clientWidth && stage.clientHeight) lastStageBox.current = stage.getBoundingClientRect();
      const ratio = Math.min(stage.clientWidth / image.width, stage.clientHeight / image.height);
      const width = image.width * ratio;
      const height = image.height * ratio;
      setBounds({ width, height });
      x.set(
        clamp(
          x.get(),
          -Math.max(0, (width * scale.get() - stage.clientWidth) / 2),
          Math.max(0, (width * scale.get() - stage.clientWidth) / 2),
        ),
      );
      y.set(
        clamp(
          y.get(),
          -Math.max(0, (height * scale.get() - stage.clientHeight) / 2),
          Math.max(0, (height * scale.get() - stage.clientHeight) / 2),
        ),
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(stage);
    const dialog = dialogRef.current;
    const rememberPosition = () => {
      lastStageBox.current = stage.getBoundingClientRect();
    };
    dialog?.addEventListener('scroll', rememberPosition);
    const viewport = stage.ownerDocument.defaultView?.visualViewport;
    viewport?.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      dialog?.removeEventListener('scroll', rememberPosition);
      viewport?.removeEventListener('resize', measure);
    };
  }, [controller.open, image, x, y, scale]);

  useEffect(() => {
    setZoomState(1);
    x.jump(0);
    y.jump(0);
    scale.jump(1);
    pointers.current.clear();
    gesture.current = null;
    lastTap.current = null;
  }, [selected, controller.open, x, y, scale]);

  useEffect(() => {
    if (scale.get() > maxZoom) setZoom(maxZoom);
  }, [maxZoom]);

  useEffect(() => {
    flightX.jump(0);
    flightY.jump(0);
    flightScale.jump(1);
    if (
      !controller.open ||
      reduced ||
      !launch.current?.isConnected ||
      launch.current.dataset.imageId !== selected
    )
      return;
    const stage = stageRef.current;
    const box = stage?.getBoundingClientRect();
    const start = launch.current.getBoundingClientRect();
    if (!box?.width || !box.height || !start.width || !image) return;
    const ratio = Math.min(box.width / image.width, box.height / image.height);
    flightX.set(start.left + start.width / 2 - box.left - box.width / 2);
    flightY.set(start.top + start.height / 2 - box.top - box.height / 2);
    flightScale.set(start.width / (image.width * ratio));
    const animations = [
      animate(flightX, 0, FLIGHT_SPRING),
      animate(flightY, 0, FLIGHT_SPRING),
      animate(flightScale, 1, FLIGHT_SPRING),
    ];
    return () => animations.forEach((animation) => animation.stop());
  }, [controller.open, controller.repairToken, reduced, flightX, flightY, flightScale]);

  useEffect(() => {
    if (controller.open) setHomeward(!reduced && !!home()?.isConnected);
  }, [controller.open, reduced, selected, images]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || !controller.open || !image) return;
    const wheel = (event: WheelEvent) => {
      if (!event.ctrlKey || event.defaultPrevented) return;
      event.preventDefault();
      const box = stage.getBoundingClientRect();
      setZoom(
        scale.get() * Math.exp(-event.deltaY * WHEEL_ZOOM_RATE),
        event.clientX - box.left - box.width / 2,
        event.clientY - box.top - box.height / 2,
      );
    };
    stage.addEventListener('wheel', wheel, { passive: false });
    return () => stage.removeEventListener('wheel', wheel);
  }, [controller.open, image, maxZoom]);

  const keyDown = (event: KeyboardEvent<HTMLDialogElement>) => {
    const target = event.target;
    if (event.defaultPrevented || !controller.open || !image || !(target instanceof Element)) return;
    if (
      target.closest('dialog') !== event.currentTarget ||
      target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])')
    )
      return;
    const rtl = event.currentTarget.matches(':dir(rtl)') ? -1 : 1;
    const deltas: Record<string, [number, number]> = {
      ArrowLeft: [1, 0],
      ArrowRight: [-1, 0],
      ArrowUp: [0, 1],
      ArrowDown: [0, -1],
    };
    const delta = deltas[event.key];
    if (zoom > 1 && delta) {
      event.preventDefault();
      pan(
        x.get() + delta[0] * (stageRef.current?.clientWidth ?? 0) * PAN_PROGRESS,
        y.get() + delta[1] * (stageRef.current?.clientHeight ?? 0) * PAN_PROGRESS,
      );
      return;
    }
    const targets: Record<string, number> = {
      ArrowLeft: index - rtl,
      ArrowRight: index + rtl,
      Home: 0,
      End: images.length - 1,
    };
    if (targets[event.key] !== undefined && (zoom === 1 || event.key === 'Home' || event.key === 'End')) {
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
    if (event.key === '0') {
      event.preventDefault();
      setZoom(1);
    }
  };
  const cancelGesture = () => {
    pointers.current.clear();
    gesture.current = null;
    scale.set(zoom);
    lastTap.current = null;
    settlePan();
  };
  const pointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.defaultPrevented || !image || event.button !== 0) return;
    if (!pointers.current.size) suppressClick.current = false;
    x.stop();
    y.stop();
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    event.currentTarget.setPointerCapture(event.pointerId);
    const points = [...pointers.current.values()];
    const box = event.currentTarget.getBoundingClientRect();
    gesture.current = {
      originX: event.clientX,
      originY: event.clientY,
      x: x.get(),
      y: y.get(),
      lastX: event.clientX,
      lastY: event.clientY,
      lastTime: event.timeStamp,
      velocityX: 0,
      velocityY: 0,
      zoom: scale.get(),
      pinched: points.length > 1,
      distance:
        points.length === 2
          ? Math.hypot(points[1]!.x - points[0]!.x, points[1]!.y - points[0]!.y)
          : undefined,
      focalX: points.reduce((sum, point) => sum + point.x, 0) / points.length - box.left - box.width / 2,
      focalY: points.reduce((sum, point) => sum + point.y, 0) / points.length - box.top - box.height / 2,
    };
  };
  const pointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = gesture.current;
    if (event.defaultPrevented || !drag || !pointers.current.has(event.pointerId)) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const points = [...pointers.current.values()];
    const dx = event.clientX - drag.originX;
    const dy = event.clientY - drag.originY;
    const elapsed = Math.max(1, event.timeStamp - drag.lastTime);
    drag.velocityX = ((event.clientX - drag.lastX) / elapsed) * 1000;
    drag.velocityY = ((event.clientY - drag.lastY) / elapsed) * 1000;
    drag.lastX = event.clientX;
    drag.lastY = event.clientY;
    drag.lastTime = event.timeStamp;
    if (Math.hypot(dx, dy) > DRAG_SLOP || points.length > 1) suppressClick.current = true;
    if (points.length === 2 && drag.distance) {
      const next = clamp(
        (drag.zoom * Math.hypot(points[1]!.x - points[0]!.x, points[1]!.y - points[0]!.y)) / drag.distance,
        1,
        maxZoom,
      );
      scale.set(next);
      pan(
        drag.focalX - ((drag.focalX - drag.x) * next) / drag.zoom,
        drag.focalY - ((drag.focalY - drag.y) * next) / drag.zoom,
        next,
      );
    } else if (drag.zoom > 1) pan(drag.x + dx, drag.y + dy);
    else if (!reduced && !drag.pinched) {
      const horizontal = Math.abs(dx) > Math.abs(dy);
      const extent = Math.max(1, event.currentTarget.clientHeight);
      x.set(horizontal ? dx : 0);
      y.set(horizontal ? 0 : dy > 0 ? dy / (1 + dy / extent) : dy / (1 + Math.abs(dy) / DRAG_SLOP));
    }
  };
  const pointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const drag = gesture.current;
    pointers.current.delete(event.pointerId);
    if (!drag) return;
    if (drag.pinched) {
      setZoomState(scale.get());
      if (!pointers.current.size) gesture.current = null;
      return;
    }
    gesture.current = null;
    const idle = event.timeStamp - drag.lastTime > motionDurationMs.fast;
    const velocityX = idle ? 0 : drag.velocityX;
    const velocityY = idle ? 0 : drag.velocityY;
    if (!event.defaultPrevented && !suppressClick.current && event.pointerType === 'touch') {
      const previous = lastTap.current;
      if (
        previous &&
        event.timeStamp - previous.time <= DOUBLE_TAP_MS &&
        Math.hypot(event.clientX - previous.x, event.clientY - previous.y) <= DOUBLE_TAP_DISTANCE
      ) {
        event.preventDefault();
        touchZoomTime.current = event.timeStamp;
        lastTap.current = null;
        toggleZoomAt(event.clientX, event.clientY);
        return;
      }
      lastTap.current = { x: event.clientX, y: event.clientY, time: event.timeStamp };
    } else lastTap.current = null;
    if (!event.defaultPrevented && drag.zoom === 1) {
      const dx = event.clientX - drag.originX;
      const dy = event.clientY - drag.originY;
      if (
        dy > 0 &&
        Math.abs(dy) > Math.abs(dx) &&
        (dy > event.currentTarget.clientHeight * DISMISS_PROGRESS ||
          (dy > DRAG_SLOP && velocityY > DISMISS_VELOCITY))
      )
        controller.requestClose();
      else if (Math.abs(dx) > DRAG_SLOP && Math.abs(dx) > Math.abs(dy)) {
        const projected = dx + (velocityX * motionDurationMs.base) / 1000;
        if (Math.abs(projected) > event.currentTarget.clientWidth * SWIPE_PROGRESS)
          navigate(index + (projected < 0 ? 1 : -1) * (event.currentTarget.matches(':dir(rtl)') ? -1 : 1));
      }
    }
    settlePan(drag.zoom > 1 ? velocityX : 0, drag.zoom > 1 ? velocityY : 0);
  };
  return (
    <ViewerDialog
      {...withoutSx(viewerSlot)}
      {...native}
      data-ui="lightbox-gallery-viewer"
      aria-modal="true"
      aria-label={viewerSlot['aria-label'] ?? label}
      aria-labelledby={joinIds(viewerSlot['aria-labelledby'], titleId)}
      aria-describedby={joinIds(viewerSlot['aria-describedby'], withDescription && !!hasCaption && captionId)}
      css={[viewerStyle, viewerSlot.sx]}
      onKeyDown={(event) => {
        viewerSlot.onKeyDown?.(event);
        keyDown(event);
      }}
      onCancel={(event) => {
        if (event.target === event.currentTarget) native.onCancel(event);
      }}
      onClose={(event) => {
        if (event.target === event.currentTarget) native.onClose(event);
      }}
    >
      <div css={contentStyle} data-state={phase}>
        <ViewerHeader
          title={image?.title ? `${label} — ${image.title}` : label}
          titleId={titleId}
          labels={labels}
          slot={slotProps?.title}
          component={slots?.title}
          onClose={controller.requestClose}
        />
        <Stage
          {...withoutSx(slotProps?.stage)}
          ref={stageMerged}
          role="group"
          aria-label={slotProps?.stage?.['aria-label'] ?? image?.alt ?? labels.unavailable}
          tabIndex={0}
          data-ui="lightbox-gallery-stage"
          data-zoom={zoom}
          data-reduced-motion={reduced}
          css={[stageStyle, slotProps?.stage?.sx]}
          onKeyDown={(event) => {
            slotProps?.stage?.onKeyDown?.(event);
          }}
          onPointerDown={(event) => {
            slotProps?.stage?.onPointerDown?.(event);
            pointerDown(event);
          }}
          onPointerMove={(event) => {
            slotProps?.stage?.onPointerMove?.(event);
            pointerMove(event);
          }}
          onPointerUp={(event) => {
            slotProps?.stage?.onPointerUp?.(event);
            pointerUp(event);
          }}
          onPointerCancel={(event) => {
            slotProps?.stage?.onPointerCancel?.(event);
            cancelGesture();
          }}
          onLostPointerCapture={(event) => {
            slotProps?.stage?.onLostPointerCapture?.(event);
            if (pointers.current.has(event.pointerId)) cancelGesture();
          }}
          onClick={(event) => {
            if (suppressClick.current) {
              event.preventDefault();
              event.stopPropagation();
              suppressClick.current = false;
            } else slotProps?.stage?.onClick?.(event);
          }}
          onDoubleClick={(event) => {
            slotProps?.stage?.onDoubleClick?.(event);
            if (
              !event.defaultPrevented &&
              !suppressClick.current &&
              event.timeStamp - touchZoomTime.current > DOUBLE_TAP_MS
            )
              toggleZoomAt(event.clientX, event.clientY);
          }}
        >
          {phase !== 'closed' && image && (
            <motion.div
              css={viewerImageStyle}
              data-exit={phase === 'closing' ? (homeward ? 'home' : 'fade') : undefined}
              style={{
                width: bounds.width,
                height: bounds.height,
                x: flightX,
                y: flightY,
                scale: flightScale,
              }}
            >
              <motion.div css={imageStyle} style={{ x, y, scale }}>
                <GalleryImage
                  key={`${image.id}\u0000${image.src}\u0000${image.srcSet ?? ''}`}
                  image={image}
                  labels={labels}
                  slot={slotProps?.image}
                  component={slots?.image}
                />
              </motion.div>
            </motion.div>
          )}
        </Stage>
        {hasCaption && (
          <Caption {...withoutSx(slotProps?.caption)} id={captionId} tabIndex={slotProps?.caption?.tabIndex ?? 0} css={[captionStyle, slotProps?.caption?.sx]}>
            {image.caption}
          </Caption>
        )}
        <ViewerToolbar
          position={position}
          zoomText={zoomText}
          labels={labels}
          slotProps={slotProps}
          slots={slots}
          canPrevious={index > 0}
          canNext={index < images.length - 1}
          canZoomIn={zoom < maxZoom}
          zoomed={zoom > 1}
          onPrevious={() => navigate(index - 1)}
          onNext={() => navigate(index + 1)}
          onZoomIn={() => setZoom(zoom + ZOOM_STEP)}
          onZoomOut={() => setZoom(zoom - ZOOM_STEP)}
          onReset={() => setZoom(1)}
        />
        <Filmstrip
          images={images}
          selected={selected}
          labels={labels}
          format={format}
          slot={slotProps?.thumbnails}
          component={slots?.thumbnails}
          onSelect={select}
          thumbnail={(item) => (
            <GalleryImage key={`${item.id}\u0000${item.src}`} image={item} decorative labels={labels} />
          )}
        />
      </div>
    </ViewerDialog>
  );
}

/** Tracks `prefers-reduced-motion` in the document that owns `ref`. */
export function useReducedMotionPreference(ref: React.RefObject<HTMLElement | null>) {
  const initialReduced = useReducedMotion();
  const [reduced, setReduced] = useState(initialReduced ?? false);
  useEffect(() => {
    const query = ref.current?.ownerDocument.defaultView?.matchMedia(REDUCED_MOTION.replace('@media ', ''));
    if (!query) return;
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, [ref]);
  return reduced;
}

/** The viewer dialog and the flight back to the launching element; LightboxGallery and GalleryEditor render it. */
export function LightboxViewer(props: LightboxViewerProps) {
  const [returnFlight, setReturnFlight] = useState<ReturnFlight | null>(null);
  return (
    <>
      <Viewer {...props} returnFlight={setReturnFlight} />
      {returnFlight && !props.reduced && !props.controller.open && (
        <motion.div
          key={returnFlight.image.id}
          aria-hidden="true"
          inert
          css={returnFlightStyle}
          style={{
            left: returnFlight.from.left,
            top: returnFlight.from.top,
            width: returnFlight.from.width,
            height: returnFlight.from.height,
          }}
          initial={{ x: 0, y: 0, scaleX: 1, scaleY: 1, opacity: 1 }}
          animate={{
            x: returnFlight.to.left - returnFlight.from.left,
            y: returnFlight.to.top - returnFlight.from.top,
            scaleX: returnFlight.to.width / returnFlight.from.width,
            scaleY: returnFlight.to.height / returnFlight.from.height,
            opacity: 0,
          }}
          transition={FLIGHT_SPRING}
          onAnimationComplete={() => setReturnFlight(null)}
        >
          <img
            src={returnFlight.image.src}
            srcSet={returnFlight.image.srcSet}
            sizes={returnFlight.image.sizes}
            alt=""
            css={imageStyle}
          />
        </motion.div>
      )}
    </>
  );
}

export function LightboxGallery({
  ref,
  images,
  label,
  minColumnWidth = MIN_COLUMN_WIDTH,
  gap = '2',
  value,
  defaultValue,
  onValueChange,
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  maxZoom = MAX_ZOOM,
  labels: labelOverrides,
  locale,
  slotProps,
  slots,
  className,
  sx,
  ...rest
}: LightboxGalleryProps) {
  const Grid = slots?.grid ?? 'ul';
  const [selected, select] = useControlledState<string | null>(
    value,
    defaultValue === undefined ? (images[0]?.id ?? null) : defaultValue,
    onValueChange,
  );
  const [open, requestOpen] = useControlledState(openProp, defaultOpen, onOpenChange);
  const [pendingLaunch, setPendingLaunch] = useState<string | null>(null);
  const validSelection = images.some((image) => image.id === selected);
  const effectiveOpen = !!open && validSelection && (pendingLaunch === null || pendingLaunch === selected);
  const lifecycle = useNativeDialogRoot(effectiveOpen, requestOpen);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const gridRef = useRef<HTMLUListElement | null>(null);
  const mergedRoot = useMergeRefs([ref, rootRef]);
  const reduced = useReducedMotionPreference(rootRef);
  const mergedGrid = useMergeRefs([slotProps?.grid?.ref, gridRef]);
  const tiles = useRef(new Map<string, HTMLButtonElement>());
  const invoker = useRef<HTMLButtonElement | null>(null);
  const labels = { ...lightboxLabelDefaults, ...labelOverrides };
  const [geometry, setGeometry] = useState({ columns: 2, width: MIN_COLUMN_WIDTH, gap: 0 });
  const width = validPositive(minColumnWidth, MIN_COLUMN_WIDTH);
  const zoomLimit = lightboxZoomLimit(maxZoom);
  const format = useMemo(() => numberFormatter(locale), [locale]);

  useEffect(() => {
    if (pendingLaunch === selected) setPendingLaunch(null);
  }, [pendingLaunch, selected]);

  useLayoutEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    const measure = () => {
      const spacing = Number.parseFloat(getComputedStyle(grid).columnGap) || 0;
      const columns = Math.max(2, Math.floor((grid.clientWidth + spacing) / (width + spacing)));
      setGeometry({
        columns,
        width: Math.max(0, (grid.clientWidth - spacing * (columns - 1)) / columns),
        gap: spacing,
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(grid);
    return () => observer.disconnect();
  }, [width, gap, images.length === 0]);

  const restore = () => {
    const target = tiles.current.get(selected ?? '') ?? rootRef.current;
    target?.focus({ preventScroll: true });
  };

  return (
    <MotionConfig reducedMotion="user">
      <WithSx className={className} styles={rootStyle} sx={sx}>
        {(rootClass) => (
          <div
            {...rest}
            ref={mergedRoot}
            data-ui="lightbox-gallery"
            className={rootClass}
            role="region"
            tabIndex={rest.tabIndex ?? -1}
            aria-label={rest['aria-label'] ?? label}
            data-columns={geometry.columns}
          >
            {images.length ? (
              <Grid
                {...withoutSx(slotProps?.grid)}
                ref={mergedGrid}
                css={[gridStyle, slotProps?.grid?.sx]}
                style={
                  {
                    ...slotProps?.grid?.style,
                    '--lightbox-columns': geometry.columns,
                    '--lightbox-gap': vars.space[gap],
                  } as CSSProperties
                }
              >
                {images.map((image, index) => {
                  const height = (geometry.width * image.height) / image.width;
                  const span = Math.max(1, Math.ceil((height + geometry.gap) / (1 + geometry.gap)));
                  return (
                    <li key={image.id} style={{ gridRowEnd: `span ${span}`, minInlineSize: 0 }}>
                      <Tile
                        {...withoutSx(slotProps?.tile)}
                        component={slots?.tile}
                        register={(node) => {
                          if (node) tiles.current.set(image.id, node);
                          return () => {
                            tiles.current.delete(image.id);
                          };
                        }}
                        data-ui="lightbox-gallery-tile"
                        data-image-id={image.id}
                        type="button"
                        aria-haspopup="dialog"
                        aria-expanded={effectiveOpen && image.id === selected}
                        aria-label={
                          slotProps?.tile?.['aria-label'] ??
                          `${image.title || image.alt}, ${labels.position(format.format(index + 1), format.format(images.length))}, ${labels.open}`
                        }
                        css={[tileStyle, slotProps?.tile?.sx]}
                        style={{
                          ...slotProps?.tile?.style,
                          aspectRatio: `${image.width} / ${image.height}`,
                          blockSize: '100%',
                        }}
                        onClick={(event) => {
                          slotProps?.tile?.onClick?.(event);
                          if (!event.defaultPrevented) {
                            invoker.current = event.currentTarget;
                            setPendingLaunch(image.id);
                            select(image.id);
                            lifecycle.setOpen(true);
                          }
                        }}
                      >
                        <GalleryImage
                          key={`${image.id}\u0000${image.src}\u0000${image.srcSet ?? ''}`}
                          image={image}
                          decorative
                          labels={labels}
                          slot={slotProps?.image}
                          component={slots?.image}
                        />
                      </Tile>
                    </li>
                  );
                })}
              </Grid>
            ) : (
              <p css={captionStyle}>{labels.empty}</p>
            )}
            {!!open && images.length > 0 && !validSelection && (
              <p role="status" css={statusStyle}>
                {labels.unavailable}
              </p>
            )}
            <LightboxViewer
              images={images}
              selected={selected}
              label={label}
              controller={{ ...lifecycle, open: effectiveOpen }}
              select={select}
              restore={restore}
              launch={invoker}
              home={() => tiles.current.get(selected ?? '')}
              labels={labels}
              locale={locale}
              maxZoom={zoomLimit}
              slotProps={slotProps}
              slots={slots}
              reduced={reduced}
            />
          </div>
        )}
      </WithSx>
    </MotionConfig>
  );
}

LightboxGallery.displayName = 'LightboxGallery';
