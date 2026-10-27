'use client';

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ComponentPropsWithRef,
  type ComponentType,
  type CSSProperties,
  type DragEvent,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from 'react';
import { useMergeRefs } from '@floating-ui/react';
import { Crown, Image, Trash } from '@jfrader/icons';
import { vars } from '@jfrader/tokens/vars';
import { useNativeDialogRoot } from '../../overlay/use-native-dialog';
import { css, type SerializedStyles } from '../../styling/css';
import { focusRingOutset } from '../../styling/focus-ring';
import { FORCED_COLORS, REDUCED_MOTION } from '../../styling/media';
import type { SxProps } from '../../styling/sx';
import { visuallyHiddenStyle } from '../../styling/visually-hidden';
import { numberFormatter } from '../../utils/intl';
import { PresentationSlot, type PresentationProps } from '../../utils/presentation-slot';
import { isRenderable } from '../../utils/renderable';
import { useControlledState } from '../../utils/use-controlled-state';
import { useImageStatus } from '../../utils/use-image-status';
import { Button } from '../button';
import { Checkbox } from '../checkbox';
import { Dialog } from '../dialog';
import { EmptyState, type EmptyStateProps } from '../empty-state';
import { carriesFiles, FileDropzone, type FileDropzoneItem, type FileDropzoneMessages } from '../file-dropzone/file-dropzone';
import {
  LightboxViewer,
  lightboxLabelDefaults,
  lightboxZoomLimit,
  useReducedMotionPreference,
  type LightboxGalleryImage,
  type LightboxGalleryProps,
} from '../lightbox-gallery/lightbox-gallery';
import { joinIds } from '../menu/menu';
import { ChromeAction } from '../viewer-chrome/viewer-chrome';

export interface GalleryEditorPhoto {
  id: string | number;
  src: string;
  /** Smaller source for the tile; the preview uses `src`. */
  thumbnailSrc?: string | null;
  alt?: string;
  caption?: string;
  /** Intrinsic width; with `height`, keeps the preview uncropped. */
  width?: number | null;
  height?: number | null;
}

export type GalleryEditorDensity = 'comfortable' | 'compact';

export interface GalleryEditorLabels {
  /** Badge on the cover photo. */
  primary: string;
  /** Upload control and empty-state label. */
  upload: string;
  browse: string;
  /** Shown while files are dragged over the upload control. */
  drop: string;
  empty: string;
  selectAll: string;
  clearSelection: string;
  deleteSelected: string;
  cancel: string;
  confirmDelete: string;
  uploadFailed: string;
  deleteFailed: string;
  setPrimaryFailed: string;
  /** Names a photo without `alt` or `caption`. `position` and `total` are formatted. */
  photo: (position: string, total: string) => string;
  /** Names the tile button that opens the preview. */
  openPhoto: (name: string, primary: boolean) => string;
  setPrimary: (name: string) => string;
  delete: (name: string) => string;
  select: (name: string) => string;
  /** The gallery size under the title. `count` is formatted; `total` selects the plural. */
  photoCount: (count: string, total: number) => string;
  /** The selection toolbar count. `count` is formatted; `total` selects the plural. */
  selectionCount: (count: string, total: number) => string;
  /** The delete confirmation heading. `count` is formatted; `total` selects the plural. */
  deleteTitle: (count: string, total: number) => string;
  /** Announces a completed delete. `count` is formatted; `total` selects the plural. */
  deleted: (count: string, total: number) => string;
  /** Announces a new cover. */
  primarySet: (name: string) => string;
  /** Announces that the selection was cleared. */
  selectionCleared: string;
  /** Explains a file the upload control rejected. */
  rejection: FileDropzoneMessages['rejection'];
}

export interface GalleryEditorSlotProps {
  /** Outer region element. */
  root?: PresentationProps<'div'>;
  /** Header holding the title and photo count. */
  header?: PresentationProps<'header'>;
  /** Group holding the selection count and bulk actions. */
  toolbar?: PresentationProps<'div'>;
  /** List element holding the tiles. */
  list?: PresentationProps<'ul'>;
  /** List item holding one photo, its badge, checkbox, and actions. */
  tile?: PresentationProps<'li'>;
  /** Container holding a tile's set-cover and delete actions. */
  tileActions?: PresentationProps<'div'>;
  /** Props for the empty state shown before the first photo. */
  empty?: Partial<EmptyStateProps>;
}

export interface GalleryEditorSlots {
  /** Replaces the outer region element. */
  root?: ComponentType<ComponentPropsWithRef<'div'>>;
  /** Replaces the header holding the title and photo count. */
  header?: ComponentType<ComponentPropsWithRef<'header'>>;
  /** Replaces the group holding the selection count and bulk actions. */
  toolbar?: ComponentType<ComponentPropsWithRef<'div'>>;
  /** Replaces the list element holding the tiles. */
  list?: ComponentType<ComponentPropsWithRef<'ul'>>;
  /** Replaces each tile's list item. */
  tile?: ComponentType<ComponentPropsWithRef<'li'>>;
  /** Replaces the container holding a tile's actions. */
  tileActions?: ComponentType<ComponentPropsWithRef<'div'>>;
  /** Replaces the empty state; receives EmptyState props. */
  empty?: ComponentType<EmptyStateProps>;
}

/** LightboxGallery customization applied to the preview. */
export type GalleryEditorViewerProps = Pick<LightboxGalleryProps, 'labels' | 'slotProps' | 'slots' | 'maxZoom'>;

export interface GalleryEditorProps<P extends GalleryEditorPhoto = GalleryEditorPhoto>
  extends Omit<ComponentPropsWithRef<'div'>, 'children' | 'defaultValue' | 'title'>, SxProps {
  /** Photos in display order. */
  photos: readonly P[];
  /** Names the gallery region and the preview. */
  label: string;
  /** Visible heading. Defaults to `label`; pass `null` to hide it. */
  title?: ReactNode;
  /** Heading level for the visible title. Defaults to 2. */
  headingLevel?: 2 | 3 | 4;
  /** Marks the cover photo by id; `null` or an unknown id marks none. */
  primaryId?: P['id'] | null;
  /** Controls the previewed photo id. */
  value?: P['id'] | null;
  /** Seeds the uncontrolled previewed photo. Defaults to `primaryId`, else the first photo. */
  defaultValue?: P['id'] | null;
  /** Receives the requested previewed photo id when a tile opens or the preview navigates. */
  onValueChange?: (id: P['id'] | null) => void;
  /** Controls the selected photo ids. Unknown ids are ignored. */
  selectedIds?: readonly P['id'][];
  /** Seeds the uncontrolled selection. Defaults to none. */
  defaultSelectedIds?: readonly P['id'][];
  /** Receives the next selected ids, in gallery order. */
  onSelectionChange?: (ids: P['id'][]) => void;
  /** Receives accepted files in one call per pick or drop. Omit to hide the upload control. */
  onUpload?: (files: File[]) => void | Promise<void>;
  /** Receives the confirmed photos in one call. Omit to hide delete actions. */
  onDelete?: (photos: readonly P[]) => void | Promise<void>;
  /** Receives the photo to make the cover. Omit to hide the set-cover action. */
  onSetPrimary?: (photo: P) => void | Promise<void>;
  /** Accepted file types for upload. Defaults to `'image/*'`. */
  accept?: string;
  /** Allows several files per upload. Defaults to `true`. */
  multiple?: boolean;
  /** Caps the files accepted per pick or drop; extra files are rejected. Defaults to no limit. */
  maxFiles?: number;
  /** Removes upload, delete, set-cover, and selection; preview stays available. Defaults to `false`. */
  readOnly?: boolean;
  /** Disables mutating controls and marks the region busy. Defaults to `false`. */
  busy?: boolean;
  /** Sets tile size and overlay spacing. Defaults to `'comfortable'`. */
  density?: GalleryEditorDensity;
  /** Sets the minimum tile width: a number in pixels or a CSS length. Defaults to a density-based size. */
  minColumnWidth?: number | string;
  /** Selects the spacing token between tiles. Defaults to `3`, or `2` when compact. */
  gap?: keyof typeof vars.space;
  /** Replaces the empty state content; the upload control renders below it. */
  emptyState?: ReactNode;
  /** Overrides labels, announcements, and count formatters. */
  labels?: Partial<GalleryEditorLabels>;
  /** Sets the locale for counts and positions. */
  locale?: Intl.LocalesArgument;
  /** Customizes the preview's labels, parts, and zoom limit. */
  viewer?: GalleryEditorViewerProps;
  /** Shorthand for `slots.root`. */
  component?: GalleryEditorSlots['root'];
  /** Passes props to the generated parts. */
  slotProps?: GalleryEditorSlotProps;
  /** Replaces the generated parts. */
  slots?: GalleryEditorSlots;
}

type Task = 'upload' | 'delete' | 'primary';

const DEFAULT_ACCEPT = 'image/*';
/** FileDropzone needs a positive integer cap; this one never binds. */
const UNLIMITED_FILES = Number.MAX_SAFE_INTEGER;
/** Tile shape, and the preview shape for photos without intrinsic dimensions. */
const PHOTO_ASPECT = { width: 4, height: 3 };
const PHOTO_ASPECT_RATIO = `${PHOTO_ASPECT.width} / ${PHOTO_ASPECT.height}`;
/** Accent wash over a selected photo; translucent whatever surface the theme gives accentSoft. */
const SELECTION_WASH_OPACITY = 0.18;
const NO_FILES: FileDropzoneItem[] = [];
const EMPTY_IDS: readonly never[] = [];
const englishPlural = new Intl.PluralRules('en');
const plural = (total: number, one: string, other: string) => (englishPlural.select(total) === 'one' ? one : other);

const defaultLabels: GalleryEditorLabels = {
  primary: 'Cover',
  upload: 'Add photos',
  browse: 'Browse',
  drop: 'Drop photos to upload',
  empty: 'No photos yet',
  selectAll: 'Select all',
  clearSelection: 'Clear',
  deleteSelected: 'Delete',
  cancel: 'Cancel',
  confirmDelete: 'Delete',
  uploadFailed: 'Upload failed.',
  deleteFailed: 'Delete failed.',
  setPrimaryFailed: 'Cover change failed.',
  photo: (position, total) => `Photo ${position} of ${total}`,
  openPhoto: (name, primary) => (primary ? `${name}, cover` : name),
  setPrimary: (name) => `Set ${name} as cover`,
  delete: (name) => `Delete ${name}`,
  select: (name) => `Select ${name}`,
  photoCount: (count, total) => `${count} ${plural(total, 'photo', 'photos')}`,
  selectionCount: (count) => `${count} selected`,
  deleteTitle: (count, total) => `Delete ${count} ${plural(total, 'photo', 'photos')}?`,
  deleted: (count, total) => `${count} ${plural(total, 'photo', 'photos')} deleted`,
  primarySet: (name) => `${name} is the cover`,
  selectionCleared: 'Selection cleared',
  rejection: (code) =>
    ({
      type: 'Choose an image file.',
      size: 'File is too large.',
      count: 'Too many files.',
    })[code],
};

const rootStyle = css({
  label: 'gallery-editor',
  position: 'relative',
  display: 'grid',
  gap: vars.space[4],
  minInlineSize: 0,
  fontFamily: vars.font.sans,
  fontSize: vars.textSize.sm,
  lineHeight: vars.lineHeight.base,
  color: vars.color.text,
  borderRadius: vars.radius.lg,
  '&:focus-visible': focusRingOutset,
  '&[data-dragging="true"]': { outline: `2px dashed ${vars.color.accentText}`, outlineOffset: vars.space[1] },
  [FORCED_COLORS]: { '&[data-dragging="true"]': { outlineColor: 'Highlight' } },
});
const headerStyle = css({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'baseline',
  justifyContent: 'space-between',
  gap: vars.space[2],
});
const titleStyle = css({
  margin: 0,
  fontSize: vars.textSize.lg,
  fontWeight: vars.fontWeight.semibold,
  lineHeight: vars.lineHeight.tight,
  overflowWrap: 'anywhere',
});
const countStyle = css({ margin: 0, color: vars.color.textMuted, fontVariantNumeric: 'tabular-nums' });
const toolbarStyle = css({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: vars.space[2],
  padding: vars.space[2],
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.md,
  backgroundColor: vars.color.surfaceRaised,
});
const toolbarCountStyle = css({
  flex: '1 1 auto',
  paddingInline: vars.space[2],
  fontWeight: vars.fontWeight.medium,
  fontVariantNumeric: 'tabular-nums',
});
const errorStyle = css({ margin: 0, color: vars.color.dangerText, overflowWrap: 'anywhere' });
const listStyle = css({
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, var(--gallery-editor-column)), 1fr))',
  gap: 'var(--gallery-editor-gap)',
  margin: 0,
  padding: 0,
  listStyle: 'none',
});
const tileStyle = css({ position: 'relative', minInlineSize: 0 });
const photoStyle = css({
  appearance: 'none',
  boxSizing: 'border-box',
  position: 'relative',
  display: 'grid',
  placeItems: 'center',
  inlineSize: '100%',
  aspectRatio: PHOTO_ASPECT_RATIO,
  padding: 0,
  border: `1px solid ${vars.color.borderControl}`,
  borderRadius: vars.radius.md,
  background: vars.color.surfaceInset,
  color: vars.color.textMuted,
  font: 'inherit',
  cursor: 'pointer',
  overflow: 'hidden',
  '&:focus-visible': focusRingOutset,
  '&[data-primary]': { borderWidth: '2px', borderColor: vars.color.accent },
  '&[data-selected]::after': {
    content: '""',
    position: 'absolute',
    inset: 0,
    backgroundColor: vars.color.accent,
    opacity: SELECTION_WASH_OPACITY,
    pointerEvents: 'none',
  },
  [FORCED_COLORS]: {
    borderColor: 'ButtonText',
    '&[data-primary]': { borderColor: 'Highlight' },
    '&[data-selected]': { borderStyle: 'dashed', borderColor: 'Highlight' },
    '&[data-selected]::after': { display: 'none' },
  },
});
const imageStyle = css({ display: 'block', inlineSize: '100%', blockSize: '100%', objectFit: 'cover' });
// Overlays show on hover or focus inside the tile, while a selection exists, and always without hover.
const overlayStyle = css({
  position: 'absolute',
  display: 'flex',
  alignItems: 'center',
  gap: vars.space[1],
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.md,
  backgroundColor: vars.color.surfaceRaised,
  opacity: 0,
  scale: '0.96',
  pointerEvents: 'none',
  transitionProperty: 'opacity, scale',
  transitionDuration: vars.motion.duration.fast,
  transitionTimingFunction: vars.motion.easeStandard,
  '*:hover > &, *:focus-within > &, &[data-visible]': { opacity: 1, scale: '1', pointerEvents: 'auto' },
  '@media (hover: none)': { opacity: 1, scale: '1', pointerEvents: 'auto' },
  [REDUCED_MOTION]: { transitionDuration: '0s' },
  [FORCED_COLORS]: { borderColor: 'CanvasText' },
});
const densityInset: Record<GalleryEditorDensity, string> = {
  comfortable: vars.space[2],
  compact: vars.space[1],
};
const checkStyles = Object.fromEntries(
  Object.entries(densityInset).map(([density, inset]) => [
    density,
    css({ insetBlockStart: inset, insetInlineStart: inset, padding: vars.space[1] }),
  ]),
) as Record<GalleryEditorDensity, SerializedStyles>;
const actionsStyles = Object.fromEntries(
  Object.entries(densityInset).map(([density, inset]) => [
    density,
    css({ insetBlockStart: inset, insetInlineEnd: inset, padding: '1px' }),
  ]),
) as Record<GalleryEditorDensity, SerializedStyles>;
const badgeStyles = Object.fromEntries(
  Object.entries(densityInset).map(([density, inset]) => [
    density,
    css({
      position: 'absolute',
      insetBlockEnd: inset,
      insetInlineStart: inset,
      display: 'inline-flex',
      alignItems: 'center',
      gap: vars.space[1],
      paddingBlock: '2px',
      paddingInline: vars.space[2],
      border: '1px solid transparent',
      borderRadius: vars.radius.full,
      backgroundColor: vars.color.accent,
      color: vars.color.accentContrast,
      fontSize: vars.textSize.xs,
      fontWeight: vars.fontWeight.semibold,
      pointerEvents: 'none',
      [FORCED_COLORS]: { borderColor: 'CanvasText' },
    }),
  ]),
) as Record<GalleryEditorDensity, SerializedStyles>;
const badgeIconStyle = css({ inlineSize: vars.space[3], blockSize: vars.space[3] });
const dangerActionStyle = css({ color: vars.color.dangerText });
const uploadTargetStyle = css({ aspectRatio: PHOTO_ASPECT_RATIO, alignContent: 'center' });
const emptyUploadTargetStyle = css({ minBlockSize: vars.size.galleryEditorEmptyUpload, alignContent: 'center' });
const statusStyle = css(visuallyHiddenStyle);

const keyOf = (id: GalleryEditorPhoto['id']) => String(id);
const isThenable = (value: unknown): value is PromiseLike<unknown> =>
  typeof (value as PromiseLike<unknown> | undefined)?.then === 'function';

function cssLength(value: number | string | undefined, fallback: string) {
  if (typeof value === 'number') return Number.isFinite(value) && value > 0 ? `${value}px` : fallback;
  return value?.trim() ? value : fallback;
}

/** Columns the auto-filled grid resolved to, read from its computed track list. */
function columnCount(list: HTMLElement) {
  return Math.max(1, getComputedStyle(list).gridTemplateColumns.split(' ').filter(Boolean).length);
}

/** Hands dropped files to the upload control, so a drop over the grid shares its validation. */
function forwardFiles(input: HTMLInputElement, files: FileList) {
  input.files = files;
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

function TileImage({ photo }: { photo: GalleryEditorPhoto }) {
  const src = photo.thumbnailSrc || photo.src;
  const status = useImageStatus(src);
  if (!src || status.status === 'error')
    return <Image size={24} decorative data-image-state="error" />;
  return (
    <img
      ref={status.ref}
      src={src}
      alt=""
      width={photo.width ?? undefined}
      height={photo.height ?? undefined}
      loading="lazy"
      decoding="async"
      draggable={false}
      data-image-state={status.status}
      css={imageStyle}
      onLoad={status.onLoad}
      onError={status.onError}
    />
  );
}

/** Edit a photo collection: upload, preview, choose the cover, select, and delete. */
export function GalleryEditor<P extends GalleryEditorPhoto = GalleryEditorPhoto>({
  ref,
  photos,
  label,
  title,
  headingLevel = 2,
  primaryId = null,
  value: valueProp,
  defaultValue,
  onValueChange,
  selectedIds,
  defaultSelectedIds = EMPTY_IDS,
  onSelectionChange,
  onUpload,
  onDelete,
  onSetPrimary,
  accept = DEFAULT_ACCEPT,
  multiple = true,
  maxFiles,
  readOnly = false,
  busy = false,
  density = 'comfortable',
  minColumnWidth,
  gap = density === 'compact' ? '2' : '3',
  emptyState,
  labels: labelOverrides,
  locale,
  viewer,
  component,
  slotProps,
  slots,
  className,
  sx,
  style,
  onDragEnter,
  onDragOver,
  onDragLeave,
  onDrop,
  ...rest
}: GalleryEditorProps<P>) {
  const Toolbar = slots?.toolbar;
  const Empty = slots?.empty ?? EmptyState;
  const id = useId();
  const titleId = `${id}-title`;
  const countId = `${id}-selection`;
  const labels = { ...defaultLabels, ...labelOverrides };
  const format = useMemo(() => numberFormatter(locale), [locale]);
  const heading = title === undefined ? label : title;
  const hasHeading = isRenderable(heading);
  const Heading = `h${headingLevel}` as const;
  const rootRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);
  const mergedRoot = useMergeRefs([rootRef, ref]);
  const mergedList = useMergeRefs([listRef, slotProps?.list?.ref]);
  const uploadInput = useRef<HTMLInputElement | null>(null);
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const invoker = useRef<HTMLButtonElement | null>(null);
  const anchor = useRef<string | null>(null);
  const rangeIntent = useRef(false);
  const focusAfterDelete = useRef<number | null>(null);
  const dragDepth = useRef(0);
  const latestPhotos = useRef(photos);
  latestPhotos.current = photos;

  const [pending, setPending] = useState<Task | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const [dragging, setDragging] = useState(false);
  const [confirming, setConfirming] = useState<readonly P[] | null>(null);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [launchKey, setLaunchKey] = useState<string | null>(null);

  const [value, requestValue] = useControlledState<P['id'] | null>(
    valueProp,
    defaultValue !== undefined ? defaultValue : primaryId ?? photos[0]?.id ?? null,
    onValueChange,
  );
  const [selectionState, requestSelection] = useControlledState<readonly P['id'][]>(
    selectedIds,
    defaultSelectedIds,
    (next) => onSelectionChange?.([...next]),
  );
  const selectedKeys = new Set((selectionState ?? EMPTY_IDS).map(keyOf));
  const selection = photos.filter((photo) => selectedKeys.has(keyOf(photo.id)));
  const selecting = selection.length > 0;

  const keys = photos.map((photo) => keyOf(photo.id));
  const valueKey = value === null || value === undefined ? null : keyOf(value);
  const primaryKey = primaryId === null ? null : keyOf(primaryId);
  const tabKey = [activeKey, valueKey].find((key) => key !== null && keys.includes(key)) ?? keys[0];
  const inactive = busy || pending !== null;
  const canUpload = !readOnly && !!onUpload;
  const canDelete = !readOnly && !!onDelete;
  const canSetPrimary = !readOnly && !!onSetPrimary;

  const nameAt = (photo: P, index: number) =>
    photo.alt || photo.caption || labels.photo(format.format(index + 1), format.format(photos.length));
  const images = useMemo<LightboxGalleryImage[]>(
    () =>
      photos.map((photo, index) => {
        const name = nameAt(photo, index);
        return {
          id: keyOf(photo.id),
          src: photo.src,
          alt: name,
          title: name,
          caption: photo.caption,
          width: photo.width && photo.height ? photo.width : PHOTO_ASPECT.width,
          height: photo.width && photo.height ? photo.height : PHOTO_ASPECT.height,
        };
      }),
    [photos, labelOverrides?.photo, format],
  );
  const validValue = valueKey !== null && keys.includes(valueKey);
  const effectiveOpen = open && validValue && (launchKey === null || launchKey === valueKey);
  const lifecycle = useNativeDialogRoot(effectiveOpen, setOpen);
  const reduced = useReducedMotionPreference(rootRef);

  useEffect(() => {
    if (launchKey !== null && launchKey === valueKey) setLaunchKey(null);
  }, [launchKey, valueKey]);

  const nameOf = (photo: P) => nameAt(photo, photos.indexOf(photo));
  const focusTile = (key: string | undefined) => {
    const target = (key && buttons.current.get(key)) || rootRef.current;
    target?.focus({ preventScroll: true });
  };
  const setSelection = (next: readonly P[]) => {
    const nextKeys = new Set(next.map((photo) => keyOf(photo.id)));
    const ordered = photos.filter((photo) => nextKeys.has(keyOf(photo.id)));
    if (ordered.length === selection.length && ordered.every((photo, index) => photo === selection[index])) return;
    requestSelection(ordered.map((photo) => photo.id));
    setAnnouncement(
      ordered.length ? labels.selectionCount(format.format(ordered.length), ordered.length) : labels.selectionCleared,
    );
  };
  const selectTile = (photo: P, mode: 'toggle' | 'range' | 'only') => {
    const key = keyOf(photo.id);
    const index = keys.indexOf(key);
    if (mode === 'range') {
      const start = anchor.current === null ? -1 : keys.indexOf(anchor.current);
      const [from, to] = start < 0 ? [index, index] : [Math.min(start, index), Math.max(start, index)];
      setSelection([...selection, ...photos.slice(from, to + 1)]);
      return;
    }
    anchor.current = key;
    if (mode === 'only') setSelection([photo]);
    else setSelection(selectedKeys.has(key) ? selection.filter((item) => item !== photo) : [...selection, photo]);
  };
  const run = (task: Task, action: () => void | Promise<void>, failure: string) => {
    setError(null);
    let result: void | Promise<void>;
    try {
      result = action();
    } catch {
      setError(failure);
      return Promise.resolve(false);
    }
    if (!isThenable(result)) return Promise.resolve(true);
    setPending(task);
    return Promise.resolve(result)
      .then(
        () => true,
        () => {
          setError(failure);
          return false;
        },
      )
      .finally(() => setPending(null));
  };
  const preview = (photo: P, button: HTMLButtonElement) => {
    const key = keyOf(photo.id);
    invoker.current = button;
    setLaunchKey(key);
    requestValue(photo.id);
    lifecycle.setOpen(true);
  };
  const setPrimary = (photo: P) => {
    if (!onSetPrimary || inactive) return;
    void run('primary', () => onSetPrimary(photo), labels.setPrimaryFailed).then((done) => {
      if (done) setAnnouncement(labels.primarySet(nameOf(photo)));
    });
  };
  const upload = (files: File[]) => {
    if (!onUpload || !files.length || inactive) return;
    void run('upload', () => onUpload(files), labels.uploadFailed);
  };
  const requestDelete = (targets: readonly P[]) => {
    if (canDelete && !inactive && targets.length) setConfirming(targets);
  };
  const confirmDelete = () => {
    const targets = confirming;
    if (!onDelete || !targets) return;
    const first = Math.min(...targets.map((photo) => photos.indexOf(photo)));
    void run('delete', () => onDelete(targets), labels.deleteFailed).then((done) => {
      if (done) {
        focusAfterDelete.current = first;
        anchor.current = null;
        setSelection(selection.filter((photo) => !targets.includes(photo)));
        setAnnouncement(labels.deleted(format.format(targets.length), targets.length));
      }
      setConfirming(null);
    });
  };

  const onPhotoClick = (event: MouseEvent<HTMLButtonElement>, photo: P) => {
    if (!readOnly && (event.metaKey || event.ctrlKey)) selectTile(photo, 'toggle');
    else if (!readOnly && event.shiftKey) selectTile(photo, 'range');
    // A pointer click while a selection exists picks this tile alone; keyboard activation previews.
    else if (!readOnly && selecting && event.detail > 0) selectTile(photo, 'only');
    else preview(photo, event.currentTarget);
  };
  const onPhotoKeyDown = (event: KeyboardEvent<HTMLButtonElement>, photo: P, index: number) => {
    const list = listRef.current;
    if (!list || event.altKey || event.ctrlKey || event.metaKey) return;
    const columns = columnCount(list);
    const step = getComputedStyle(list).direction === 'rtl' ? -1 : 1;
    const targets: Record<string, number> = {
      ArrowRight: index + step,
      ArrowLeft: index - step,
      ArrowDown: index + columns,
      ArrowUp: index - columns,
      Home: 0,
      End: keys.length - 1,
    };
    const target = targets[event.key];
    if (target !== undefined) {
      event.preventDefault();
      if (target >= 0 && target < keys.length) buttons.current.get(keys[target]!)?.focus();
    } else if ((event.key === 'p' || event.key === 'P') && canSetPrimary && keyOf(photo.id) !== primaryKey) {
      event.preventDefault();
      setPrimary(photo);
    } else if (event.key === 'Delete' || event.key === 'Backspace') {
      if (!canDelete) return;
      event.preventDefault();
      requestDelete([photo]);
    } else if (event.key === 'Escape' && selecting) {
      event.preventDefault();
      setSelection([]);
    }
  };

  // While inactive, file drags are still claimed and refused, so a drop never opens the file.
  const dropHandlers = {
    onDragEnter: (event: DragEvent<HTMLDivElement>) => {
      onDragEnter?.(event);
      if (!canUpload || !carriesFiles(event.dataTransfer)) return;
      dragDepth.current++;
      setDragging(!inactive);
      if (!event.defaultPrevented) event.preventDefault();
    },
    onDragOver: (event: DragEvent<HTMLDivElement>) => {
      onDragOver?.(event);
      if (!canUpload || event.defaultPrevented || !carriesFiles(event.dataTransfer)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = inactive ? 'none' : 'copy';
    },
    onDragLeave: (event: DragEvent<HTMLDivElement>) => {
      onDragLeave?.(event);
      if (!carriesFiles(event.dataTransfer)) return;
      dragDepth.current = Math.max(0, dragDepth.current - 1);
      if (!dragDepth.current) setDragging(false);
    },
    onDrop: (event: DragEvent<HTMLDivElement>) => {
      onDrop?.(event);
      dragDepth.current = 0;
      setDragging(false);
      if (!canUpload || event.defaultPrevented || !carriesFiles(event.dataTransfer)) return;
      event.preventDefault();
      if (!inactive && uploadInput.current) forwardFiles(uploadInput.current, event.dataTransfer.files);
    },
  };

  const uploadMessages: FileDropzoneMessages = {
    browse: labels.browse,
    rejection: labels.rejection,
    uploadError: labels.uploadFailed,
    // The dropzone's own file list stays empty: GalleryEditor hands each pick to `onUpload`.
    files: labels.upload,
    remove: labels.delete,
    retry: () => labels.upload,
    status: () => '',
    added: () => '',
    removed: () => '',
    count: () => labels.upload,
  };
  const uploader = () =>
    canUpload && (
      <FileDropzone
        inputRef={uploadInput}
        value={NO_FILES}
        onValueChange={(items) => upload(items.flatMap((item) => (item.file ? [item.file] : [])))}
        accept={accept}
        multiple={multiple}
        maxFiles={maxFiles ?? UNLIMITED_FILES}
        label={labels.upload}
        dropLabel={labels.drop}
        messages={uploadMessages}
        disabled={inactive}
        size="sm"
        slotProps={{ target: { sx: photos.length ? uploadTargetStyle : emptyUploadTargetStyle } }}
      />
    );

  const tiles = photos.map((photo, index) => {
    const key = keyOf(photo.id);
    const primary = key === primaryKey;
    const selected = selectedKeys.has(key);
    const name = nameOf(photo);
    const tabIndex = key === tabKey ? 0 : -1;
    return (
      <PresentationSlot
        key={key}
        element="li"
        component={slots?.tile}
        slotProps={slotProps?.tile}
        styles={tileStyle}
        marker="gallery-editor-tile"
        data-photo-id={key}
        data-primary={primary || undefined}
        data-selected={selected || undefined}
      >
        <button
          ref={(node) => {
            if (node) buttons.current.set(key, node);
            return () => {
              buttons.current.delete(key);
            };
          }}
          type="button"
          data-ui="gallery-editor-photo"
          data-image-id={key}
          data-primary={primary || undefined}
          data-selected={selected || undefined}
          tabIndex={tabIndex}
          aria-haspopup="dialog"
          aria-expanded={effectiveOpen && key === valueKey}
          aria-label={labels.openPhoto(name, primary)}
          css={photoStyle}
          onFocus={() => setActiveKey(key)}
          onClick={(event) => onPhotoClick(event, photo)}
          onKeyDown={(event) => onPhotoKeyDown(event, photo, index)}
        >
          <TileImage photo={photo} />
        </button>
        {primary && (
          <span data-ui="gallery-editor-badge" css={badgeStyles[density]}>
            <Crown size={12} strokeWidth={2.25} sx={badgeIconStyle} decorative />
            {labels.primary}
          </span>
        )}
        {!readOnly && (
          <span css={[overlayStyle, checkStyles[density]]} data-visible={selecting || undefined}>
            <Checkbox
              aria-label={labels.select(name)}
              checked={selected}
              tabIndex={tabIndex}
              onClick={(event) => {
                rangeIntent.current = event.shiftKey;
              }}
              onCheckedChange={() => {
                selectTile(photo, rangeIntent.current ? 'range' : 'toggle');
                rangeIntent.current = false;
              }}
            />
          </span>
        )}
        {(canSetPrimary && !primary) || canDelete ? (
          <PresentationSlot
            element="div"
            component={slots?.tileActions}
            slotProps={slotProps?.tileActions}
            styles={[overlayStyle, actionsStyles[density]]}
            marker="gallery-editor-tile-actions"
          >
            {canSetPrimary && !primary && (
              <ChromeAction
                label={labels.setPrimary(name)}
                icon={<Crown size={16} strokeWidth={2.25} decorative />}
                disabled={inactive}
                tabIndex={tabIndex}
                placement="bottom"
                portaled
                onClick={() => setPrimary(photo)}
              />
            )}
            {canDelete && (
              <ChromeAction
                label={labels.delete(name)}
                icon={<Trash size={16} strokeWidth={2.25} decorative />}
                disabled={inactive}
                tabIndex={tabIndex}
                placement="bottom"
                portaled
                styles={dangerActionStyle}
                onClick={() => requestDelete([photo])}
              />
            )}
          </PresentationSlot>
        ) : null}
      </PresentationSlot>
    );
  });

  return (
    <PresentationSlot
      element="div"
      component={slots?.root ?? component}
      slotProps={slotProps?.root}
      styles={rootStyle}
      sx={sx}
      {...rest}
      {...dropHandlers}
      ref={mergedRoot}
      className={className}
      marker="gallery-editor"
      role="region"
      tabIndex={rest.tabIndex ?? -1}
      aria-label={hasHeading ? rest['aria-label'] : label}
      aria-labelledby={hasHeading ? joinIds(rest['aria-labelledby'], titleId) : rest['aria-labelledby']}
      aria-busy={inactive || undefined}
      data-density={density}
      data-read-only={readOnly || undefined}
      data-dragging={dragging || undefined}
      style={
        {
          ...style,
          '--gallery-editor-column': cssLength(
            minColumnWidth,
            density === 'compact' ? vars.size.galleryEditorTileCompact : vars.size.galleryEditorTile,
          ),
          '--gallery-editor-gap': vars.space[gap],
        } as CSSProperties
      }
    >
      <PresentationSlot
        element="header"
        component={slots?.header}
        slotProps={slotProps?.header}
        styles={headerStyle}
        marker="gallery-editor-header"
        role="presentation"
      >
        {hasHeading && (
          <Heading id={titleId} css={titleStyle}>
            {heading}
          </Heading>
        )}
        {photos.length > 0 && <p css={countStyle}>{labels.photoCount(format.format(photos.length), photos.length)}</p>}
      </PresentationSlot>
      {selecting && !readOnly && (
        <PresentationSlot
          element="div"
          component={Toolbar}
          slotProps={slotProps?.toolbar}
          styles={toolbarStyle}
          marker="gallery-editor-toolbar"
          role="group"
          aria-labelledby={countId}
        >
          <span id={countId} css={toolbarCountStyle}>
            {labels.selectionCount(format.format(selection.length), selection.length)}
          </span>
          <Button
            variant="ghost"
            size="sm"
            disabled={selection.length === photos.length}
            onClick={() => setSelection(photos)}
          >
            {labels.selectAll}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSelection([]);
              focusTile(tabKey);
            }}
          >
            {labels.clearSelection}
          </Button>
          {canDelete && (
            <Button
              variant="soft"
              tone="danger"
              size="sm"
              disabled={inactive}
              startIcon={<Trash size={16} strokeWidth={2.25} decorative />}
              onClick={() => requestDelete(selection)}
            >
              {labels.deleteSelected}
            </Button>
          )}
        </PresentationSlot>
      )}
      {error !== null && (
        <p role="alert" data-ui="gallery-editor-error" css={errorStyle}>
          {error}
        </p>
      )}
      {photos.length ? (
        <PresentationSlot
          element="ul"
          component={slots?.list}
          slotProps={slotProps?.list}
          ref={mergedList}
          styles={listStyle}
          marker="gallery-editor-list"
          aria-label={hasHeading ? undefined : label}
          aria-labelledby={hasHeading ? titleId : undefined}
        >
          {canUpload && (
            <li data-ui="gallery-editor-upload" css={tileStyle}>
              {uploader()}
            </li>
          )}
          {tiles}
        </PresentationSlot>
      ) : (
        <>
          {isRenderable(emptyState) ? (
            emptyState
          ) : (
            <Empty title={labels.empty} icon={<Image size={24} decorative />} {...slotProps?.empty} />
          )}
          {uploader()}
        </>
      )}
      <p role="status" aria-live="polite" aria-atomic="true" data-ui="gallery-editor-status" css={statusStyle}>
        {announcement}
      </p>
      <LightboxViewer
        images={images}
        selected={valueKey}
        label={label}
        controller={{ ...lifecycle, open: effectiveOpen }}
        select={(key) => requestValue(photos.find((photo) => keyOf(photo.id) === key)?.id ?? null)}
        restore={() => focusTile(valueKey ?? undefined)}
        launch={invoker}
        home={() => (valueKey === null ? undefined : buttons.current.get(valueKey))}
        labels={{ ...lightboxLabelDefaults, ...viewer?.labels }}
        locale={locale}
        maxZoom={lightboxZoomLimit(viewer?.maxZoom)}
        slotProps={viewer?.slotProps}
        slots={viewer?.slots}
        reduced={reduced}
      />
      <Dialog
        open={confirming !== null}
        onOpenChange={(next) => {
          if (!next && pending !== 'delete') setConfirming(null);
        }}
      >
        <Dialog.Content
          onClose={() => {
            const index = focusAfterDelete.current;
            if (index === null) return;
            focusAfterDelete.current = null;
            const remaining = latestPhotos.current;
            focusTile(remaining.length ? keyOf(remaining[Math.min(index, remaining.length - 1)]!.id) : undefined);
          }}
        >
          <Dialog.Title>
            {labels.deleteTitle(format.format(confirming?.length ?? 0), confirming?.length ?? 0)}
          </Dialog.Title>
          <Dialog.Footer>
            <Dialog.Close disabled={pending === 'delete'}>{labels.cancel}</Dialog.Close>
            <Button tone="danger" loading={pending === 'delete'} onClick={confirmDelete}>
              {labels.confirmDelete}
            </Button>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog>
    </PresentationSlot>
  );
}

GalleryEditor.displayName = 'GalleryEditor';
