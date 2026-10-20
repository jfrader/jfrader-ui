import { withoutSx } from '../../styling/sx';
import {
  useEffect,
  useId,
  useRef,
  useState,
  type ComponentPropsWithRef,
  type ReactNode,
  type Ref,
  type KeyboardEvent,
} from 'react';
import { useMergeRefs } from '@floating-ui/react';
import { vars } from '@jfrader/tokens/vars';
import { css, type SerializedStyles } from '../../styling/css';
import { FORCED_COLORS, REDUCED_MOTION } from '../../styling/media';
import { focusRingOutset } from '../../styling/focus-ring';
import type { SxProps } from '../../styling/sx';
import { visuallyHiddenStyle } from '../../styling/visually-hidden';
import { numberFormatter } from '../../utils/intl';
import { isRenderable } from '../../utils/renderable';
import { useControlledState } from '../../utils/use-controlled-state';
import { useLatestCallback } from '../../utils/use-latest-callback';
import { Button, type ButtonProps } from '../button';
import { Progress, type ProgressProps } from '../progress';
import type { ComponentType } from 'react';
import { FieldSlot, type FieldSlots, type FieldParts } from '../field/field-slot';

export type FileDropzoneSize = 'sm' | 'md' | 'lg';
export type FileDropzoneUploadStatus = 'idle' | 'uploading' | 'uploaded' | 'failed';
export interface FileDropzoneItem {
  id: string;
  name: string;
  size: number;
  file?: File;
  preview?: string;
  uploaded?: boolean;
}
export interface FileRejection {
  file: File;
  code: 'type' | 'size' | 'count' | 'custom';
  message: string;
}
export type FileDropzoneUpload = (
  item: FileDropzoneItem,
  context: { signal: AbortSignal; onProgress: (percent: number) => void },
) => Promise<void>;
export interface FileDropzoneMessages {
  browse: string;
  files: string;
  remove: (name: string) => string;
  retry: (name: string) => string;
  rejection: (code: Exclude<FileRejection['code'], 'custom'>, file: File) => string;
  status: (status: FileDropzoneUploadStatus, name: string) => string;
  added: (count: number) => string;
  removed: (name: string) => string;
  count: (count: number) => string;
  uploadError: string;
}
export type FileDropzoneSlotProps = FieldParts<FileDropzoneAnatomy> & {
  /** Action button for removing a file item. Default: `Button`. */
  action?: ButtonProps & SxProps;
  /** Action button for retrying a failed upload. Default: `Button`. */
  retry?: ButtonProps & SxProps;
  /** Progress bar indicating upload completion. Default: `Progress`. */
  progress?: Omit<ProgressProps, 'value' | 'max'>;
};
type FileDropzoneAnatomy = {
  /** Outer container wrapping the drop target and file list. */
  root: 'div';
  /** Hidden native file input element. */
  input: 'input';
  /** Interactive drop zone receiving drag and drop events. */
  target: 'div';
  /** Label element prompting file selection. */
  label: 'label';
  /** Interactive text trigger opening the native file dialog. */
  browse: 'span';
  /** Helper text describing accepted file types or size limits. */
  description: 'div';
  /** Supplementary note text displayed within the drop zone. */
  note: 'div';
  /** Unordered list containing uploaded file items. */
  list: 'ul';
  /** List item displaying an uploaded file and its details. */
  item: 'li';
  /** Thumbnail preview image for uploaded media files. */
  preview: 'img';
  /** Progress bar indicating upload completion. Default: `Progress`. */
  progress: 'div';
  /** Action button for removing a file item. Default: `Button`. */
  action: 'button';
  /** Error message banner displayed on validation or upload failure. */
  error: 'div';
  /** Screen-reader live region announcing upload and validation status. */
  status: 'div';
};
export type FileDropzoneSlots = Omit<FieldSlots<FileDropzoneAnatomy>, 'action' | 'progress'> & {
  /** Action button for removing a file item. Default: `Button`. */
  action?: ComponentType<ButtonProps>;
  /** Retries a failed upload. */
  retry?: ComponentType<ButtonProps>;
  /** Progress bar indicating upload completion. Default: `Progress`. */
  progress?: ComponentType<ProgressProps>;
};

export interface FileDropzoneProps
  extends Omit<ComponentPropsWithRef<'div'>, 'defaultValue' | 'onChange' | 'children'>, SxProps {
  /** Control the displayed file list. */
  value?: FileDropzoneItem[];
  /** Seed the uncontrolled file list. Defaults to an empty list. */
  defaultValue?: FileDropzoneItem[];
  /** Receive the next file list after additions or removals. */
  onValueChange?: (items: FileDropzoneItem[]) => void;
  /** Receive rejected files with their validation codes and messages. */
  onReject?: (rejections: FileRejection[]) => void;
  /** Filter picked, dropped, and pasted files by comma-separated extensions or MIME types. */
  accept?: string;
  /** Allow adding several files at once. Defaults to `true`. */
  multiple?: boolean;
  /** Limit the total file count. Defaults to 5 for omitted or invalid values. */
  maxFiles?: number;
  /** Reject files larger than this many bytes. Omit for no size limit. */
  maxSize?: number;
  /** Return a rejection message for a file, or `null` to accept it. */
  validate?: (file: File) => string | null;
  /** Upload accepted files with an abort signal and progress reporting from 0 to 100. */
  onUpload?: FileDropzoneUpload;
  /** Place the file list below or inside the drop target. Defaults to `below`. */
  listPlacement?: 'below' | 'inside';
  /** Hide the description and show a file count at this positive threshold, except during dragging. */
  compactAt?: number;
  /** Label the file input and display the selection prompt. */
  label?: ReactNode;
  /** Show supporting text beneath the selection prompt. */
  description?: ReactNode;
  /** Show an additional note within the drop target. */
  note?: ReactNode;
  /** Show and announce this prompt while files are dragged over the target. */
  dropLabel?: ReactNode;
  /** Show an error and mark the file input invalid. */
  error?: ReactNode;
  /** Supply action labels, validation messages, and status announcements. */
  messages: FileDropzoneMessages;
  /** Choose the locale used to format file sizes. */
  locale?: string;
  /** Prevent file selection, removal, and retries. Defaults to `false`. */
  disabled?: boolean;
  /** Keep files visible but prevent selection, removal, and retries. Defaults to `false`. */
  readOnly?: boolean;
  /** Mark the native file input as required. Defaults to `false`. */
  required?: boolean;
  /** Set the drop target's padding. Defaults to `md`. */
  size?: FileDropzoneSize;
  /** Accept files pasted into the dropzone. Defaults to `true`. */
  paste?: boolean;
  /** Render the fallback file icon when no usable preview is available. */
  renderFileIcon?: (item: FileDropzoneItem) => ReactNode;
  /** Name the native file input for form submission. */
  name?: string;
  /** Access the hidden native file input. */
  inputRef?: Ref<HTMLInputElement>;
  /** Replace the wrapper div; `slots.root` takes precedence. */
  component?: FileDropzoneSlots['root'];
  /** Replace generated parts with components that forward props and ref. */
  slots?: FileDropzoneSlots;
  /** Pass props to the drop target, file rows, upload controls, and field parts. */
  slotProps?: FileDropzoneSlotProps;
}

const rootStyle = css({
  label: 'file-dropzone',
  display: 'grid',
  gap: vars.space[3],
  minInlineSize: 0,
  color: vars.color.text,
  fontFamily: vars.font.sans,
  fontSize: vars.textSize.sm,
  lineHeight: vars.lineHeight.base,
});
const targetStyle = css({
  position: 'relative',
  display: 'grid',
  border: `1px dashed ${vars.color.borderControl}`,
  borderRadius: vars.radius.lg,
  backgroundColor: vars.color.surface,
  cursor: 'pointer',
  transitionProperty: 'background-color, border-color',
  transitionDuration: vars.motion.duration.fast,
  transitionTimingFunction: vars.motion.easeStandard,
  '&:has(input:focus-visible)': focusRingOutset,
  '&[data-dragging="true"]': {
    borderStyle: 'solid',
    backgroundColor: vars.color.surfaceHover,
  },
  [REDUCED_MOTION]: { transitionDuration: '0s' },
  [FORCED_COLORS]: { borderColor: 'ButtonText' },
});
const surfaceStyle = css({
  display: 'grid',
  justifyItems: 'center',
  gap: vars.space[3],
  textAlign: 'center',
});
const inactiveSurfaceStyle = css({ cursor: 'not-allowed' });
const surfaceDensity: Record<FileDropzoneSize, SerializedStyles> = {
  sm: css({ padding: vars.space[4] }),
  md: css({ padding: vars.space[6] }),
  lg: css({ padding: vars.space[8] }),
};
const insideListDensity: Record<FileDropzoneSize, SerializedStyles> = {
  sm: css({ paddingInline: vars.space[4], paddingBlockEnd: vars.space[4] }),
  md: css({ paddingInline: vars.space[6], paddingBlockEnd: vars.space[6] }),
  lg: css({ paddingInline: vars.space[8], paddingBlockEnd: vars.space[8] }),
};
const browseStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  minBlockSize: vars.space[8],
  paddingInline: vars.space[3],
  border: `1px solid ${vars.color.borderControl}`,
  borderRadius: vars.radius.md,
  fontWeight: vars.fontWeight.medium,
  overflowWrap: 'anywhere',
});
const inputStyle = css({
  position: 'absolute',
  opacity: 0,
  inlineSize: '1px',
  blockSize: '1px',
});
const mutedStyle = css({ color: vars.color.textMuted });
const listStyle = css({
  boxSizing: 'border-box',
  display: 'grid',
  gap: vars.space[2],
  margin: 0,
  padding: 0,
  listStyle: 'none',
  inlineSize: '100%',
  textAlign: 'start',
});
const itemStyle = css({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: vars.space[3],
  padding: vars.space[3],
  border: `1px solid ${vars.color.borderControl}`,
  borderRadius: vars.radius.md,
  backgroundColor: vars.color.surfaceRaised,
  cursor: 'default',
});
const detailsStyle = css({
  flex: '1 1 10rem',
  minInlineSize: 0,
  display: 'grid',
  gap: vars.space[2],
  overflowWrap: 'anywhere',
});
const previewStyle = css({
  inlineSize: vars.space[12],
  blockSize: vars.space[12],
  objectFit: 'cover',
  borderRadius: vars.radius.sm,
});
const actionsStyle = css({
  display: 'flex',
  flexWrap: 'wrap',
  gap: vars.space[2],
});
const actionStyle = css({
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
  minBlockSize: vars.space[8],
  blockSize: 'auto',
  paddingBlock: vars.space[2],
  maxInlineSize: '100%',
});
const errorStyle = css({
  color: vars.color.dangerText,
  overflowWrap: 'anywhere',
});
const instantProgressStyle = css({
  '& > [data-ui="progress-indicator"]': { transitionDuration: '0s' },
});
const SURFACE_EXCLUDED = 'label, [data-file-row], a, button, input, select, textarea, [role="button"]';
const EMPTY: FileDropzoneItem[] = [];
const DEFAULT_MAX_FILES = 5;
const MAX_PERCENT = 100;
const DECIMAL_UNIT = 1000;
const byteUnits = ['byte', 'kilobyte', 'megabyte', 'gigabyte'] as const;
const sameItems = (a: FileDropzoneItem[], b: FileDropzoneItem[]) =>
  a.length === b.length && a.every((item, index) => item.id === b[index]?.id && item.file === b[index]?.file);
const carriesFiles = (data: DataTransfer) => Array.from(data.types).includes('Files');
const duplicate = (a: File, b: File) => a.name === b.name && a.size === b.size && a.lastModified === b.lastModified;
function matchesAccept(file: File, accept?: string) {
  const tokens =
    accept
      ?.split(',')
      .map((token) => token.trim().toLowerCase())
      .filter(Boolean) ?? [];
  return (
    !tokens.length ||
    tokens.some((token) =>
      token.startsWith('.')
        ? file.name.toLowerCase().endsWith(token)
        : Boolean(file.type) &&
          (token.endsWith('/*')
            ? file.type.toLowerCase().startsWith(token.slice(0, -1))
            : file.type.toLowerCase() === token),
    )
  );
}
function formatSize(bytes: number, locale?: string) {
  const exponent = bytes > 0 ? Math.min(Math.floor(Math.log(bytes) / Math.log(DECIMAL_UNIT)), byteUnits.length - 1) : 0;
  return numberFormatter(locale, {
    style: 'unit',
    unit: byteUnits[Math.max(0, exponent)],
    unitDisplay: 'short',
    maximumFractionDigits: 1,
  }).format(bytes / DECIMAL_UNIT ** Math.max(0, exponent));
}
interface Attempt {
  file: File;
  controller: AbortController;
  status: FileDropzoneUploadStatus;
  progress?: number;
  error?: string;
}

/** Choose or drop files through a labelled native file input; there is no custom dropzone role.
 * Submit value items, not input.files. Drops and accumulated batches are absent from native
 * FormData and native required validation. Validate uploads on the server too. */
export function FileDropzone({
  ref,
  value,
  defaultValue = EMPTY,
  onValueChange,
  onReject,
  accept,
  multiple = true,
  maxFiles = DEFAULT_MAX_FILES,
  maxSize,
  validate,
  onUpload,
  listPlacement = 'below',
  compactAt,
  label,
  description,
  note,
  dropLabel,
  error,
  messages,
  locale,
  disabled = false,
  readOnly = false,
  required = false,
  size = 'md',
  paste = true,
  renderFileIcon,
  name,
  inputRef,
  component,
  slots,
  slotProps,
  className,
  sx,
  onDragEnter,
  onDragOver,
  onDragLeave,
  onDrop,
  onPaste,
  ...rest
}: FileDropzoneProps) {
  const Action = slots?.action ?? Button;
  const Retry = slots?.retry ?? Button;
  const UploadProgress = slots?.progress ?? Progress;
  const id = useId();
  const seed = useRef(defaultValue);
  const [items = EMPTY, requestChange, resetToDefault] = useControlledState(value, seed.current, onValueChange);
  const input = useRef<HTMLInputElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const mergedRoot = useMergeRefs([root, ref]);
  const mergedInput = useMergeRefs([input, inputRef]);
  const attempts = useRef(new Map<string, Attempt>());
  const intents = useRef(new Map<string, FileDropzoneItem>());
  const previews = useRef(new Map<string, { file: File; url: string }>());
  const focusRequest = useRef<{
    item: FileDropzoneItem;
    index: number;
    active: Element | null;
  } | null>(null);
  const [, refresh] = useState(0);
  const update = () => refresh((n) => n + 1);
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);
  const [rejections, setRejections] = useState<FileRejection[]>([]);
  const [announcement, setAnnouncement] = useState('');
  const [brokenPreviews, setBrokenPreviews] = useState(new Set<string>());
  const inactive = disabled || readOnly;
  const hasLabel = isRenderable(label) && label !== '';
  const hasDescription = isRenderable(description);
  const hasNote = isRenderable(note);
  const hasError = isRenderable(error) || rejections.length > 0;
  const inputProps = slotProps?.input;
  const inputId = inputProps?.id ?? `${id}-input`;
  const describedBy =
    [
      inputProps?.['aria-describedby'],
      hasDescription && `${id}-description`,
      hasNote && `${id}-note`,
      hasError && `${id}-error`,
    ]
      .filter(Boolean)
      .join(' ') || undefined;
  const labelledBy =
    [inputProps?.['aria-labelledby'], hasLabel && `${id}-label`].filter(Boolean).join(' ') || undefined;
  const invalid = hasError ? true : inputProps?.['aria-invalid'];
  const request = (next: FileDropzoneItem[]) => {
    if (!sameItems(items, next)) requestChange(next);
  };
  const capacity = Number.isInteger(maxFiles) && maxFiles > 0 ? maxFiles : DEFAULT_MAX_FILES;

  const startUpload = useLatestCallback((item: FileDropzoneItem) => {
    if (!item.file || !onUpload) return;
    attempts.current.get(item.id)?.controller.abort();
    const attempt: Attempt = {
      file: item.file,
      controller: new AbortController(),
      status: 'uploading',
    };
    attempts.current.set(item.id, attempt);
    update();
    const isCurrent = () => !attempt.controller.signal.aborted && attempts.current.get(item.id) === attempt;
    const report = (percent: number) => {
      if (!isCurrent() || attempt.status !== 'uploading' || !Number.isFinite(percent)) return;
      attempt.progress = Math.max(attempt.progress ?? 0, Math.min(MAX_PERCENT, Math.max(0, percent)));
      update();
    };
    Promise.resolve()
      .then(() => {
        if (!isCurrent()) return;
        return onUpload(item, {
          signal: attempt.controller.signal,
          onProgress: report,
        });
      })
      .then(
        () => {
          if (!isCurrent()) return;
          attempt.status = 'uploaded';
          setAnnouncement(messages.status('uploaded', item.name));
          update();
        },
        (reason: unknown) => {
          if (!isCurrent()) return;
          if (reason instanceof Error && reason.name === 'AbortError') {
            attempt.status = 'idle';
            update();
            return;
          }
          attempt.status = 'failed';
          attempt.error = reason instanceof Error && reason.message.trim() ? reason.message : messages.uploadError;
          setAnnouncement(messages.status('failed', item.name));
          update();
        },
      );
  });

  useEffect(() => {
    let changed = false;
    let added = 0;
    for (const [key, attempt] of attempts.current) {
      if (!items.some((item) => item.id === key && item.file === attempt.file)) {
        attempt.controller.abort();
        attempts.current.delete(key);
        changed = true;
      }
    }
    for (const [key, preview] of previews.current) {
      if (!items.some((item) => item.id === key && item.file === preview.file && item.preview === undefined)) {
        URL.revokeObjectURL(preview.url);
        previews.current.delete(key);
        changed = true;
      }
    }
    for (const item of items) {
      const intent = intents.current.get(item.id);
      if (!intent || intent.file !== item.file) continue;
      intents.current.delete(item.id);
      if (item.file?.type.startsWith('image/') && item.preview === undefined && !previews.current.has(item.id)) {
        previews.current.set(item.id, {
          file: item.file,
          url: URL.createObjectURL(item.file),
        });
        changed = true;
      }
      added++;
      startUpload(item);
    }
    if (added) setAnnouncement(messages.added(added));
    const pending = focusRequest.current;
    if (pending && !items.some((item) => item.id === pending.item.id && item.file === pending.item.file)) {
      focusRequest.current = null;
      setAnnouncement(messages.removed(pending.item.name));
      if (
        pending.active &&
        (root.current?.ownerDocument.activeElement === pending.active ||
          root.current?.ownerDocument.activeElement === root.current?.ownerDocument.body)
      ) {
        const rows = root.current?.querySelectorAll<HTMLElement>('[data-file-row]');
        const row = rows?.[Math.min(pending.index, items.length - 1)];
        (row?.querySelector<HTMLButtonElement>('[data-action="remove"]') ?? input.current)?.focus();
      }
    }
    if (changed) update();
  }, [items, messages, startUpload]);
  useEffect(
    () => () => {
      for (const attempt of attempts.current.values()) attempt.controller.abort();
      attempts.current.clear();
      for (const preview of previews.current.values()) URL.revokeObjectURL(preview.url);
      previews.current.clear();
      intents.current.clear();
    },
    [],
  );
  const reset = useLatestCallback(() => {
    intents.current.clear();
    setRejections([]);
    setAnnouncement('');
    if (value === undefined) resetToDefault();
    else request(seed.current);
  });
  useEffect(() => {
    const form = input.current?.form;
    const listener = (event: Event) => {
      queueMicrotask(() => {
        if (!event.defaultPrevented) reset();
      });
    };
    form?.addEventListener('reset', listener);
    return () => form?.removeEventListener('reset', listener);
  }, [reset]);

  function intake(files: File[]) {
    if (inactive) return;
    const rejected: FileRejection[] = [];
    const accepted: File[] = [];
    const retained = multiple ? items : items.filter((item) => !item.file);
    for (const file of files) {
      let code: FileRejection['code'] | undefined;
      let custom: string | null = null;
      if (!matchesAccept(file, accept)) code = 'type';
      else if (maxSize !== undefined && Number.isFinite(maxSize) && maxSize >= 0 && file.size > maxSize) code = 'size';
      else {
        custom = validate?.(file) ?? null;
        if (custom !== null) code = 'custom';
      }
      if (
        !code &&
        (items.some((item) => item.file && duplicate(item.file, file)) ||
          accepted.some((previous) => duplicate(previous, file)))
      )
        continue;
      if (!code && (retained.length + accepted.length >= capacity || (!multiple && accepted.length >= 1)))
        code = 'count';
      if (code)
        rejected.push({
          file,
          code,
          message: code === 'custom' ? custom! : messages.rejection(code, file),
        });
      else accepted.push(file);
    }
    setRejections(rejected);
    if (rejected.length) onReject?.(rejected);
    if (!accepted.length) return;
    const additions = accepted.map((file) => ({
      id: crypto.randomUUID(),
      file,
      name: file.name,
      size: file.size,
    }));
    intents.current.clear();
    for (const item of additions) intents.current.set(item.id, item);
    request([...retained, ...additions]);
  }
  function remove(item: FileDropzoneItem, index: number) {
    if (inactive) return;
    const row = root.current?.querySelectorAll<HTMLElement>('[data-file-row]')[index];
    const active = root.current?.ownerDocument.activeElement ?? null;
    focusRequest.current = {
      item,
      index,
      active: row?.contains(active) ? active : null,
    };
    request(items.filter((candidate) => candidate.id !== item.id));
  }
  function rowKeyboard(event: KeyboardEvent<HTMLLIElement>, item: FileDropzoneItem, index: number) {
    if (inactive || !(event.target instanceof HTMLButtonElement)) return;
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      remove(item, index);
    }
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault();
      const adjacent = index + (event.key === 'ArrowUp' ? -1 : 1);
      const row = root.current?.querySelectorAll<HTMLElement>('[data-file-row]')[adjacent];
      const action = event.target.dataset.action;
      (
        row?.querySelector<HTMLButtonElement>(`[data-action="${action}"]`) ??
        row?.querySelector<HTMLButtonElement>('[data-action="remove"]')
      )?.focus();
    }
  }
  const fileList = items.length > 0 && (
    <FieldSlot
      element="ul"
      component={slots?.list}
      slotProps={slotProps?.list}
      aria-label={slotProps?.list?.['aria-label'] ?? messages.files}
      styles={[listStyle, listPlacement === 'inside' && insideListDensity[size]]}
    >
      {items.map((item, index) => {
        const attempt = attempts.current.get(item.id);
        const status = attempt?.status ?? (item.uploaded ? 'uploaded' : 'idle');
        const preview = item.preview ?? previews.current.get(item.id)?.url;
        const icon = renderFileIcon?.(item);
        return (
          <FieldSlot
            element="li"
            component={slots?.item}
            slotProps={slotProps?.item}
            key={item.id}
            data-file-row
            data-state={status}
            onKeyDown={(event) => {
              if (!event.defaultPrevented) rowKeyboard(event, item, index);
            }}
            styles={[itemStyle]}
          >
            {preview && !brokenPreviews.has(preview) ? (
              <FieldSlot
                element="img"
                component={slots?.preview}
                slotProps={slotProps?.preview}
                src={preview}
                alt=""
                styles={[previewStyle]}
                onError={(event) => {
                  setBrokenPreviews((previous) => new Set([...previous, preview]));
                }}
              />
            ) : (
              isRenderable(icon) && <span aria-hidden>{icon}</span>
            )}
            <div css={detailsStyle}>
              <bdi>{item.name}</bdi>
              <span css={mutedStyle}>{formatSize(item.size, locale)}</span>
              <span>{messages.status(status, item.name)}</span>
              {status === 'uploading' && (
                <UploadProgress
                  {...withoutSx(slotProps?.progress)}
                  value={attempt?.progress}
                  max={MAX_PERCENT}
                  aria-label={slotProps?.progress?.['aria-label'] ?? item.name}
                  getValueLabel={
                    slotProps?.progress?.getValueLabel ??
                    ((percent) => numberFormatter(locale, { style: 'percent' }).format(percent / MAX_PERCENT))
                  }
                  css={[instantProgressStyle, slotProps?.progress?.sx]}
                />
              )}
              {attempt?.error && <span css={errorStyle}>{attempt.error}</span>}
            </div>
            <div css={actionsStyle}>
              {status === 'failed' && item.file && onUpload && (
                <Retry
                  variant="outline"
                  size="sm"
                  {...withoutSx(slotProps?.retry)}
                  css={[actionStyle, slotProps?.retry?.sx]}
                  disabled={disabled}
                  aria-disabled={readOnly || slotProps?.retry?.['aria-disabled']}
                  data-action="retry"
                  aria-label={slotProps?.retry?.['aria-label'] ?? messages.retry(item.name)}
                  onClick={(event) => {
                    slotProps?.retry?.onClick?.(event);
                    if (!event.defaultPrevented && !inactive) {
                      startUpload(item);
                      event.currentTarget.parentElement
                        ?.querySelector<HTMLButtonElement>('[data-action="remove"]')
                        ?.focus();
                    }
                  }}
                >
                  {messages.retry(item.name)}
                </Retry>
              )}
              <Action
                variant="outline"
                size="sm"
                {...withoutSx(slotProps?.action)}
                css={[actionStyle, slotProps?.action?.sx]}
                disabled={disabled}
                aria-disabled={readOnly || slotProps?.action?.['aria-disabled']}
                data-action="remove"
                aria-label={slotProps?.action?.['aria-label'] ?? messages.remove(item.name)}
                onClick={(event) => {
                  slotProps?.action?.onClick?.(event);
                  if (!event.defaultPrevented) remove(item, index);
                }}
              >
                {messages.remove(item.name)}
              </Action>
            </div>
          </FieldSlot>
        );
      })}
    </FieldSlot>
  );
  const folded = compactAt !== undefined && compactAt > 0 && items.length >= compactAt && !dragging;
  return (
    <FieldSlot
      behavior={{
        onDragEnter: (event) => {
          if (!event.defaultPrevented && !inactive && carriesFiles(event.dataTransfer)) {
            event.preventDefault();
            dragDepth.current++;
            setDragging(true);
          }
        },
        onDragOver: (event) => {
          if (!event.defaultPrevented && !inactive && carriesFiles(event.dataTransfer)) {
            event.preventDefault();
            event.dataTransfer.dropEffect = 'copy';
          }
        },
        onDragLeave: (event) => {
          if (!event.defaultPrevented && carriesFiles(event.dataTransfer)) {
            dragDepth.current = Math.max(0, dragDepth.current - 1);
            if (!dragDepth.current) setDragging(false);
          }
        },
        onDrop: (event) => {
          dragDepth.current = 0;
          setDragging(false);
          if (!event.defaultPrevented && carriesFiles(event.dataTransfer)) {
            event.preventDefault();
            intake(Array.from(event.dataTransfer.files));
          }
        },
        onPaste: (event) => {
          const target = event.target as HTMLElement;
          if (
            !event.defaultPrevented &&
            paste &&
            !inactive &&
            root.current?.contains(root.current.ownerDocument.activeElement) &&
            !target.closest('input, textarea, [contenteditable]:not([contenteditable="false"])') &&
            event.clipboardData.files.length
          ) {
            event.preventDefault();
            intake(Array.from(event.clipboardData.files));
          }
        },
      }}
      element="div"
      component={slots?.root ?? component}
      slotProps={slotProps?.root}
      root
      styles={rootStyle}
      sx={sx}
      {...rest}
      ref={mergedRoot}
      className={className}
      data-ui="file-dropzone"
      data-state={dragging ? 'dragging' : items.length ? 'selected' : 'empty'}
      stateProps={{ 'aria-disabled': inactive || (slotProps?.root?.['aria-disabled'] ?? rest['aria-disabled']) }}
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onPaste={onPaste}
    >
      {required && (
        <input
          type="text"
          form={inputProps?.form}
          required={required}
          disabled={disabled}
          value={items.length ? 'selected' : ''}
          tabIndex={-1}
          aria-label={inputProps?.['aria-label'] ?? messages.browse}
          aria-labelledby={labelledBy}
          aria-describedby={describedBy}
          css={visuallyHiddenStyle}
          onChange={(event) => {
            event.currentTarget.value = items.length ? 'selected' : '';
          }}
          onInvalid={(event) => {
            inputProps?.onInvalid?.(event);
            event.preventDefault();
            input.current?.focus();
          }}
        />
      )}
      <FieldSlot
        element="div"
        component={slots?.target}
        slotProps={slotProps?.target}
        data-dragging={dragging}
        data-compact={folded}
        styles={[targetStyle, inactive && inactiveSurfaceStyle]}
        onClick={(event) => {
          const excluded = (event.target as Element).closest(SURFACE_EXCLUDED);
          if (!event.defaultPrevented && !inactive && !event.currentTarget.contains(excluded)) input.current?.click();
        }}
      >
        <FieldSlot
          element="label"
          component={slots?.label}
          slotProps={slotProps?.label}
          htmlFor={inputId}
          styles={[surfaceStyle, surfaceDensity[size]]}
        >
          <FieldSlot
            element="input"
            component={slots?.input}
            slotProps={inputProps}
            ref={mergedInput}
            id={inputId}
            type="file"
            name={name}
            accept={accept}
            multiple={multiple}
            aria-required={required || inputProps?.['aria-required']}
            required={false}
            disabled={disabled}
            aria-disabled={readOnly || inputProps?.['aria-disabled']}
            aria-labelledby={labelledBy}
            aria-label={
              inputProps?.['aria-label'] ??
              (!hasLabel && !inputProps?.['aria-labelledby'] ? messages.browse : undefined)
            }
            aria-describedby={describedBy}
            aria-invalid={invalid}
            styles={inputStyle}
            onClick={(event) => {
              if (inactive) event.preventDefault();
            }}
            onChange={(event) => {
              if (!event.defaultPrevented) intake(Array.from(event.currentTarget.files ?? []));
              event.currentTarget.value = '';
            }}
          />
          {hasLabel && <span id={`${id}-label`}>{label}</span>}
          {hasDescription && (
            <FieldSlot
              element="div"
              component={slots?.description}
              slotProps={slotProps?.description}
              id={`${id}-description`}
              styles={[folded ? visuallyHiddenStyle : mutedStyle]}
            >
              {description}
            </FieldSlot>
          )}
          {dragging && isRenderable(dropLabel) && <div>{dropLabel}</div>}
          {folded && <span>{messages.count(items.length)}</span>}
          <FieldSlot
            element="span"
            component={slots?.browse}
            slotProps={slotProps?.browse}
            aria-hidden
            styles={[browseStyle]}
          >
            {messages.browse}
          </FieldSlot>
          {hasNote && (
            <FieldSlot
              element="div"
              component={slots?.note}
              slotProps={slotProps?.note}
              id={`${id}-note`}
              styles={[mutedStyle]}
            >
              {note}
            </FieldSlot>
          )}
        </FieldSlot>
        {listPlacement === 'inside' && fileList}
      </FieldSlot>
      {hasError && (
        <FieldSlot
          element="div"
          component={slots?.error}
          slotProps={slotProps?.error}
          id={`${id}-error`}
          role="alert"
          styles={[errorStyle]}
        >
          {isRenderable(error) && error}
          {rejections.length > 0 && (
            <ul>
              {rejections.map((rejection, index) => (
                <li key={index}>
                  <bdi>{rejection.file.name}</bdi>: {rejection.message}
                </li>
              ))}
            </ul>
          )}
        </FieldSlot>
      )}
      {listPlacement === 'below' && fileList}
      <FieldSlot
        element="div"
        component={slots?.status}
        slotProps={slotProps?.status}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        styles={[visuallyHiddenStyle]}
      >
        {dragging && isRenderable(dropLabel) ? dropLabel : announcement}
      </FieldSlot>
    </FieldSlot>
  );
}
FileDropzone.displayName = 'FileDropzone';
