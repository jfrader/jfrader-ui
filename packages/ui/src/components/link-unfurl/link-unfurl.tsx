'use client';

// A plain-text message composer that previews the HTTP(S) addresses in its draft. Semantics: a
// native labelled textarea (described by a keyboard hint, plus the send error while one shows);
// each detected address gets a preview item with a real title link and native buttons. A ready
// preview's toggle is a disclosure (`aria-expanded`/`aria-controls`) over a card body that stays
// mounted but `hidden` and inert while collapsed. A polite status region announces preview,
// collapse, removal and sent transitions; a failed send shows an alert.
// Keyboard map: Tab follows DOM order (field → preview actions → suggestions → Send); Enter in the
// field sends once (never during IME composition or a pending send); Shift+Enter is a native
// newline; Alt+Enter toggles the preview whose address contains or ends at the caret; Escape is
// left to the page. Enter on a title link navigates natively.
// Detection: complete whitespace-delimited absolute HTTP(S) addresses validated with `URL`. Pasted
// text and blur scan everything; while typing, the address the caret is still touching waits for
// whitespace. Occurrences are reconciled in order into opaque link ids, so duplicates stay
// separate. Requests: the consumer owns fetching. `onPreviewRequest` fires only from user edits,
// blur, suggestions and Retry, each with a new request id and an AbortSignal that aborts when its
// link disappears, is retried, or the composer unmounts. Records for another request id are ignored.
// State: `value` and `expanded` are independent controlled axes; a rejected request keeps the
// committed text and visibility. A send locks the draft (read-only field, inactive Remove and
// suggestions, all still focusable) until `onSend` settles; success requests an empty draft and
// no expanded ids, failure keeps the draft and shows `labels.error`.
import {
  useEffect,
  useId,
  useMemo,
  useLayoutEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type ComponentPropsWithoutRef,
  type ComponentPropsWithRef,
  type FocusEvent,
  type KeyboardEvent,
  type PointerEvent,
} from 'react';
import { useMergeRefs } from '@floating-ui/react';
import { MotionConfig, motion, useReducedMotion } from 'motion/react';
import { vars } from '@jfrader/tokens/vars';
import { css, type Interpolation, type Theme } from '../../styling/css';
import { inputControlStyle } from '../../styling/input-control';
import { visuallyHiddenStyle } from '../../styling/visually-hidden';
import { WithSx, type SxProps } from '../../styling/sx';
import { useControlledState } from '../../utils/use-controlled-state';
import { Button } from '../button';
import {
  PreviewHeading,
  PreviewBody,
  previewSurfaceStyle,
  previewHeaderStyle,
  type LinkPreviewData,
  type LinkPreviewStatus,
} from '../link-preview/link-preview';

export type LinkUnfurlPreviewStatus = LinkPreviewStatus;

export interface LinkUnfurlPreview extends LinkPreviewData {
  /** Identifies the link from the `onPreviewRequest` context. */
  linkId: string;
  /** Identifies the request being answered. Other request ids are ignored. */
  requestId: string;
  status: LinkUnfurlPreviewStatus;
}

export interface LinkUnfurlPreviewRequestContext {
  linkId: string;
  requestId: string;
  signal: AbortSignal;
}

export interface LinkUnfurlSuggestion {
  url: string;
  label: string;
}

export interface LinkUnfurlMessage {
  text: string;
  previews: LinkUnfurlPreview[];
}

export interface LinkUnfurlLabels {
  send: string;
  expand: string;
  collapse: string;
  remove: string;
  retry: string;
  pending: string;
  noPreview: string;
  sent: string;
  error: string;
  /** Keyboard description read with the field. */
  hint: string;
}

interface SlotStyle {
  className?: string;
  css?: Interpolation<Theme>;
}

type PartProps<E extends 'div' | 'a' | 'img' | 'p' | 'button'> = Omit<
  ComponentPropsWithoutRef<E>,
  'children' | 'id' | 'className' | 'dangerouslySetInnerHTML'
> &
  SlotStyle;

export interface LinkUnfurlSlotProps {
  /** Multiline textarea input for entering message text. */
  field?: Omit<
    ComponentPropsWithRef<'textarea'>,
    'children' | 'id' | 'value' | 'defaultValue' | 'readOnly' | 'className' | 'dangerouslySetInnerHTML'
  > &
    SlotStyle;
  /** List container element holding preview chips and cards. */
  lane?: PartProps<'div'>;
  /** Preview item container element holding the card and controls. */
  chip?: Omit<PartProps<'div'>, 'onAnimationStart' | 'onDrag' | 'onDragStart' | 'onDragEnd'>;
  /** Expanded preview card container element; renders `PreviewBody`. */
  card?: Omit<PartProps<'div'>, 'hidden' | 'inert'>;
  /** Anchor element displaying the unfurled link title. */
  title?: Omit<PartProps<'a'>, 'href'>;
  /** Image element displaying the unfurled link thumbnail. */
  image?: Omit<PartProps<'img'>, 'src' | 'alt'>;
  /** Action container holding expand, retry, and remove buttons. */
  controls?: PartProps<'div'>;
  /** Button element submitting the message; renders `Button`. */
  send?: Omit<PartProps<'button'>, 'type' | 'disabled'>;
  /** Live region container announcing preview and delivery status. */
  status?: Omit<PartProps<'div'>, 'role' | 'aria-live' | 'aria-atomic'>;
  /** Paragraph element displaying error or failure messages. */
  error?: Omit<PartProps<'p'>, 'role'>;
}

export interface LinkUnfurlProps
  extends Omit<ComponentPropsWithRef<'div'>, 'children' | 'defaultValue' | 'onChange'>, SxProps {
  /** Labels the message field. */
  label: string;
  /** Controls the draft text. */
  value?: string;
  /** Sets the initial uncontrolled text. Defaults to `''`. */
  defaultValue?: string;
  /** Requests new draft text. Controlled text changes only when `value` updates. */
  onValueChange?: (text: string) => void;
  /** Supplies preview records matching the current link and request ids. Defaults to `[]`. */
  previews?: LinkUnfurlPreview[];
  /** Requests metadata after user actions. Fetch in your app and use the supplied abort signal. */
  onPreviewRequest?: (url: string, context: LinkUnfurlPreviewRequestContext) => void;
  /** Controls which link ids have open previews, independently of `value`. */
  expanded?: string[];
  /** Sets the initially open link ids. Defaults to `[]`. */
  defaultExpanded?: string[];
  /** Requests open link ids. Controlled previews change only when `expanded` updates. */
  onExpandedChange?: (ids: string[]) => void;
  /** Adds buttons that insert URLs at the selection. Defaults to `[]`. */
  suggestions?: LinkUnfurlSuggestion[];
  /** Enables sending. A returned promise keeps the composer pending until it settles. */
  onSend?: (message: LinkUnfurlMessage) => void | Promise<unknown>;
  /** Replaces the default English labels and keyboard hint. */
  labels?: Partial<LinkUnfurlLabels>;
  /** Locale for the joined status announcements. */
  locale?: Intl.LocalesArgument;
  /** Sets animation behavior. Defaults to `'auto'`, respecting reduced motion. `'none'` disables animation. */
  motion?: 'auto' | 'none';
  slotProps?: LinkUnfurlSlotProps;
}

const DEFAULT_LABELS: LinkUnfurlLabels = {
  send: 'Send',
  expand: 'Expand',
  collapse: 'Collapse',
  remove: 'Remove',
  retry: 'Retry',
  pending: 'Loading preview',
  noPreview: 'No preview',
  sent: 'Message sent',
  error: 'Message not sent',
  hint: 'Enter sends, Shift+Enter adds a line, Alt+Enter opens or closes the preview at the cursor.',
};

const EMPTY: never[] = [];

/** Container widths that change spacing and wrapping. */
const NARROW = '@container (max-width: 22.5rem)';
const WIDE = '@container (min-width: 35rem)';
/** Normalized upward drag on an open card's header that folds it. */
const FOLD_PROGRESS = 0.4;

const LAYOUT_SPRING = { type: 'spring', stiffness: 420, damping: 38 } as const;

// ---------------------------------------------------------------------------------------------
// Detection and reconciliation

interface DetectedUrl {
  url: string;
  href: string;
  start: number;
  end: number;
}

interface Link extends DetectedUrl {
  id: string;
  /** `null` until a user action requests a preview (links that arrived with outside text). */
  requestId: string | null;
}

interface LinkState {
  text: string;
  links: Link[];
  seq: number;
  /** The links before an edit the parent has not committed yet; a rejected edit returns to them. */
  committed?: LinkState;
}

const HTTP_PREFIX = /^https?:\/\//i;

/** The token's normalized href when it is a complete absolute HTTP(S) address. */
function toHttpHref(token: string): string | undefined {
  if (!HTTP_PREFIX.test(token)) return undefined;
  try {
    const parsed = new URL(token);
    if ((parsed.protocol === 'http:' || parsed.protocol === 'https:') && parsed.hostname !== '') return parsed.href;
  } catch {
    return undefined;
  }
  return undefined;
}

function detectUrls(text: string): DetectedUrl[] {
  const found: DetectedUrl[] = [];
  for (const match of text.matchAll(/\S+/g)) {
    const href = toHttpHref(match[0]);
    if (href !== undefined) found.push({ url: match[0], href, start: match.index, end: match.index + match[0].length });
  }
  return found;
}

interface ReconcileOptions {
  prefix: string;
  /** Caret after the edit: an address ending exactly there is still being typed. `null` scans all. */
  caret: number | null;
  /** New links get a request id (user edits) or wait for Retry (outside text). */
  request: boolean;
  /** A link removed by the user, so a duplicate occurrence cannot inherit its id. */
  exclude?: string;
}

/** Matches the ordered occurrences in `text` to the previous links; new occurrences get new ids. */
function reconcile(previous: LinkState, text: string, options: ReconcileOptions) {
  let { seq } = previous;
  const candidates = previous.links.filter((link) => link.id !== options.exclude);
  const links: Link[] = [];
  const created: Link[] = [];
  let cursor = 0;
  for (const detected of detectUrls(text)) {
    const index = candidates.findIndex((link, i) => i >= cursor && link.url === detected.url);
    if (index !== -1) {
      links.push({ ...candidates[index]!, ...detected });
      cursor = index + 1;
      continue;
    }
    if (detected.end === options.caret) continue;
    seq += 1;
    const link: Link = {
      ...detected,
      id: `${options.prefix}link-${seq}`,
      requestId: options.request ? `${options.prefix}request-${seq}` : null,
    };
    links.push(link);
    if (options.request) created.push(link);
  }
  return { state: { text, links, seq }, created };
}

const settled = ({ committed: _committed, ...state }: LinkState): LinkState => state;

/** The draft without one occurrence and one whitespace character that separated it. */
function removeOccurrence(text: string, { start, end }: Pick<Link, 'start' | 'end'>) {
  if (/\s/.test(text[end] ?? '')) return text.slice(0, start) + text.slice(end + 1);
  if (start > 0 && /\s/.test(text[start - 1] ?? '')) return text.slice(0, start - 1) + text.slice(end);
  return text.slice(0, start) + text.slice(end);
}

function hostOf(href: string) {
  return new URL(href).hostname;
}

type LinkStatus = LinkUnfurlPreviewStatus | 'idle';

const isComposing = (event: KeyboardEvent<HTMLElement>) =>
  event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229;

function ids(...values: (string | false | undefined)[]) {
  return values.filter(Boolean).join(' ') || undefined;
}

function splitPart<P extends SlotStyle>(part: P | undefined) {
  const { className, css: partCss, ...attributes } = part ?? ({} as P);
  return { className, partCss, attributes };
}

// ---------------------------------------------------------------------------------------------
// Styles

const rootStyle = css({
  label: 'link-unfurl',
  display: 'grid',
  gap: vars.space[3],
  minInlineSize: 0,
  containerType: 'inline-size',
  color: vars.color.text,
  fontFamily: vars.font.sans,
  fontSize: vars.textSize.sm,
  lineHeight: vars.lineHeight.base,
});

const labelStyle = css({ fontWeight: vars.fontWeight.medium, justifySelf: 'start' });

const fieldStyle = css({
  minBlockSize: `calc(${vars.space[8]} * 2.5)`,
  paddingBlock: vars.space[2],
  paddingInline: vars.space[3],
  fontSize: vars.textSize.md,
  lineHeight: vars.lineHeight.base,
  resize: 'vertical',
  '&:read-only': { cursor: 'progress' },
});

const hintStyle = css({ margin: 0, color: vars.color.textMuted });

const laneStyle = css({
  display: 'grid',
  gap: vars.space[2],
  margin: 0,
  padding: 0,
  listStyle: 'none',
  justifyItems: 'start',
  [WIDE]: { gap: vars.space[3] },
});

const headerStyle = css([previewHeaderStyle, {
  touchAction: 'pan-x',
  '[data-state="open"] > &': { cursor: 'grab' },
}]);

const controlsStyle = css({
  display: 'flex',
  flexWrap: 'wrap',
  gap: vars.space[1],
  marginInlineStart: 'auto',
  [NARROW]: { flexBasis: '100%', marginInlineStart: 0 },
});

const actionStyle = css({ paddingInline: vars.space[2] });

const bodyStyle = css({
  opacity: 'calc(1 - var(--link-unfurl-fold, 0))',
});

const suggestionsStyle = css({ display: 'flex', flexWrap: 'wrap', gap: vars.space[2] });

const suggestionStyle = css({ whiteSpace: 'normal', blockSize: 'auto', minBlockSize: vars.space[8] });

const footerStyle = css({ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: vars.space[2] });

const sendStyle = css({ marginInlineStart: 'auto' });

const sendErrorStyle = css({ margin: 0, color: vars.color.dangerText, fontWeight: vars.fontWeight.medium });

// ---------------------------------------------------------------------------------------------
// Preview item

interface PreviewItemProps {
  link: Link;
  status: LinkStatus;
  record: LinkUnfurlPreview | undefined;
  open: boolean;
  animate: boolean;
  /** A pending send locks the draft, so Remove stays focusable but inactive. */
  locked: boolean;
  labels: LinkUnfurlLabels;
  slotProps: LinkUnfurlSlotProps | undefined;
  onToggle: () => void;
  onRetry: () => void;
  onRemove: () => void;
}

function PreviewItem({
  link,
  status,
  record,
  open,
  animate,
  locked,
  labels,
  slotProps,
  onToggle,
  onRetry,
  onRemove,
}: PreviewItemProps) {
  const id = useId();
  const titleId = `${id}-title`;
  const bodyId = `${id}-body`;
  const bodyRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ pointerId: number; startY: number; height: number; progress: number } | null>(null);
  const ready = status === 'ready' && record !== undefined;
  const imageHref = record?.image === undefined ? undefined : toHttpHref(record.image.src);
  const data = {
    ...record,
    url: link.href,
    image: imageHref && record?.image ? { ...record.image, src: imageHref } : undefined,
    favicon: record?.favicon === undefined ? undefined : toHttpHref(record.favicon),
  };
  const previewSlots = { title: slotProps?.title, image: slotProps?.image, body: slotProps?.card };
  const chip = splitPart(slotProps?.chip);
  const controls = splitPart(slotProps?.controls);

  const setFold = (progress: number) => bodyRef.current?.style.setProperty('--link-unfurl-fold', String(progress));
  const endDrag = (commit: boolean) => {
    const current = drag.current;
    drag.current = null;
    setFold(0);
    if (commit && current && current.progress >= FOLD_PROGRESS) onToggle();
  };
  const onHeaderPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!open || event.button !== 0 || (event.target as Element).closest('a, button')) return;
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Synthetic or already-released pointers cannot be captured; moves over the header still count.
    }
    drag.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      height: bodyRef.current?.getBoundingClientRect().height || 1,
      progress: 0,
    };
  };
  const onHeaderPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    current.progress = Math.min(1, Math.max(0, (current.startY - event.clientY) / current.height));
    setFold(current.progress);
  };

  return (
    <motion.div
      {...chip.attributes}
      layout={animate}
      transition={LAYOUT_SPRING}
      data-ui="link-unfurl-item"
      data-status={status}
      data-state={open ? 'open' : 'closed'}
      data-link-id={link.id}
      className={chip.className}
      css={[previewSurfaceStyle, chip.partCss]}
    >
      <motion.div
        layout={animate ? 'position' : false}
        transition={LAYOUT_SPRING}
        css={headerStyle}
        onPointerDown={onHeaderPointerDown}
        onPointerMove={onHeaderPointerMove}
        onPointerUp={() => endDrag(true)}
        onPointerCancel={() => endDrag(false)}
      >
        <PreviewHeading
          data={data}
          status={status}
          labels={{ pending: labels.pending, unavailable: labels.noPreview }}
          titleId={titleId}
          titleText={link.url}
          ui="link-unfurl"
          slotProps={previewSlots}
        />
        <div
          {...controls.attributes}
          data-ui="link-unfurl-controls"
          className={controls.className}
          css={[controlsStyle, controls.partCss]}
        >
          {ready ? (
            <Button
              size="sm"
              variant="ghost"
              css={actionStyle}
              aria-expanded={open}
              aria-controls={bodyId}
              aria-describedby={titleId}
              onClick={onToggle}
            >
              {open ? labels.collapse : labels.expand}
            </Button>
          ) : null}
          {status === 'idle' || status === 'error' ? (
            <Button size="sm" variant="ghost" css={actionStyle} aria-describedby={titleId} onClick={onRetry}>
              {labels.retry}
            </Button>
          ) : null}
          <Button
            size="sm"
            variant="ghost"
            tone="danger"
            css={actionStyle}
            aria-disabled={locked || undefined}
            aria-describedby={titleId}
            data-link-action="remove"
            onClick={onRemove}
          >
            {labels.remove}
          </Button>
        </div>
      </motion.div>
      {ready ? (
        <PreviewBody
          data={data}
          ref={bodyRef}
          id={bodyId}
          ui="link-unfurl"
          hidden={!open}
          inert={!open}
          slotProps={previewSlots}
          baseStyle={bodyStyle}
        />
      ) : null}
    </motion.div>
  );
}

// ---------------------------------------------------------------------------------------------
// Composer

export function LinkUnfurl({
  ref,
  label,
  value: valueProp,
  defaultValue = '',
  onValueChange,
  previews = EMPTY,
  onPreviewRequest,
  expanded: expandedProp,
  defaultExpanded = EMPTY,
  onExpandedChange,
  suggestions = EMPTY,
  onSend,
  labels: labelsProp,
  locale,
  motion: motionMode = 'auto',
  slotProps,
  className,
  sx,
  ...rest
}: LinkUnfurlProps) {
  const [textState, requestText] = useControlledState(valueProp, defaultValue, onValueChange);
  const [expandedState, requestExpanded] = useControlledState(expandedProp, defaultExpanded, onExpandedChange);
  const text = textState ?? '';
  const expandedIds = expandedState ?? EMPTY;
  const labels = { ...DEFAULT_LABELS, ...labelsProp };
  const id = useId();
  const fieldId = `${id}-field`;
  const labelId = `${id}-label`;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const fieldRef = useRef<HTMLTextAreaElement>(null);
  const laneRef = useRef<HTMLDivElement>(null);
  const field = splitPart(slotProps?.field);
  const { ref: fieldRefProp, ...fieldAttributes } = field.attributes;
  const mergedFieldRef = useMergeRefs([fieldRef, fieldRefProp]);
  const reduced = useReducedMotion();
  const animate = motionMode === 'auto' && !reduced;

  // Links are reconciled against the committed text. User edits reconcile in their handler (and
  // request previews there); text that arrives from outside reconciles here without requesting.
  const [linkState, setLinkState] = useState<LinkState>(
    () => reconcile({ text: '', links: [], seq: 0 }, text, { prefix: id, caret: null, request: false }).state,
  );
  let current = linkState;
  if (linkState.text !== text) {
    const { committed } = linkState;
    current =
      committed?.text === text
        ? { ...committed, seq: linkState.seq }
        : reconcile(linkState, text, { prefix: id, caret: null, request: false }).state;
    setLinkState(current);
  }
  const { links } = current;

  const recordFor = (link: Link) =>
    link.requestId === null
      ? undefined
      : previews.findLast((record) => record.linkId === link.id && record.requestId === link.requestId);
  const statusOf = (link: Link, record = recordFor(link)): LinkStatus =>
    link.requestId === null ? 'idle' : (record?.status ?? 'pending');

  const [sending, setSending] = useState(false);
  const [sendFailed, setSendFailed] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const sendingRef = useRef(false);
  const pasteRef = useRef(false);
  const mountedRef = useRef(true);
  const controllersRef = useRef(new Map<string, { requestId: string; controller: AbortController }>());
  const focusAfterRemoval = useRef<{ removed: string; candidates: string[] } | null>(null);

  const joiner = useMemo(() => new Intl.ListFormat(locale, { type: 'unit', style: 'short' }), [locale]);
  const titleOf = (link: Link) => {
    const record = recordFor(link);
    return (statusOf(link, record) === 'ready' && record?.title) || link.url;
  };

  // Announce preview status transitions once, from the records the consumer commits.
  const statusKey = links.map((link) => `${link.id}:${statusOf(link)}`).join('|');
  const [seenStatus, setSeenStatus] = useState(statusKey);
  if (seenStatus !== statusKey) {
    const before = new Map(seenStatus.split('|').map((entry) => entry.split(/:(?=[^:]*$)/) as [string, string]));
    const changed = [...links].reverse().find((link) => {
      const status = statusOf(link);
      return status !== 'idle' && before.get(link.id) !== status;
    });
    if (changed !== undefined) {
      const record = recordFor(changed);
      const messages: Record<LinkUnfurlPreviewStatus, string> = {
        pending: joiner.format([labels.pending, hostOf(changed.href)]),
        ready: titleOf(changed),
        none: joiner.format([labels.noPreview, changed.url]),
        error: joiner.format([record?.error || labels.noPreview, changed.url]),
      };
      setAnnouncement(messages[statusOf(changed, record) as LinkUnfurlPreviewStatus]);
    }
    setSeenStatus(statusKey);
  }

  const startRequest = (link: Link & { requestId: string }) => {
    const controller = new AbortController();
    controllersRef.current.get(link.id)?.controller.abort();
    controllersRef.current.set(link.id, { requestId: link.requestId, controller });
    onPreviewRequest?.(link.url, { linkId: link.id, requestId: link.requestId, signal: controller.signal });
  };

  const commitText = (next: string, options: Omit<ReconcileOptions, 'prefix'>) => {
    const result = reconcile(current, next, { ...options, prefix: id });
    setLinkState({ ...result.state, committed: settled(current) });
    if (next !== text) {
      setSendFailed(false);
      requestText(next);
    }
    for (const link of result.created) startRequest(link as Link & { requestId: string });
  };

  // Requests whose link disappeared (removal, edits, a reset, a rejected edit) or was retried abort.
  useEffect(() => {
    for (const [linkId, entry] of controllersRef.current) {
      const link = links.find((candidate) => candidate.id === linkId);
      if (link?.requestId === entry.requestId) continue;
      entry.controller.abort();
      controllersRef.current.delete(linkId);
    }
  });

  useEffect(() => {
    mountedRef.current = true;
    const controllers = controllersRef.current;
    return () => {
      mountedRef.current = false;
      for (const entry of controllers.values()) entry.controller.abort();
      controllers.clear();
    };
  }, []);

  // A removed item's button takes focus with it; continue on a surviving item or the field.
  // Only when focus actually fell to the body, so a rejected removal or async update never moves it.
  useLayoutEffect(() => {
    const pending = focusAfterRemoval.current;
    focusAfterRemoval.current = null;
    if (!pending || links.some((link) => link.id === pending.removed)) return;
    const doc = fieldRef.current?.ownerDocument;
    if (!doc || (doc.activeElement !== null && doc.activeElement !== doc.body)) return;
    const lane = laneRef.current;
    const target = pending.candidates
      .map((linkId) => lane?.querySelector<HTMLElement>(`[data-link-id="${CSS.escape(linkId)}"] a`))
      .find(Boolean);
    (target ?? fieldRef.current)?.focus();
  });

  // The decorative pending sweep stops while the lane is offscreen.
  const hasLinks = links.length > 0;
  useEffect(() => {
    const lane = laneRef.current;
    if (!lane || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(([entry]) => {
      lane.toggleAttribute('data-offscreen', entry ? !entry.isIntersecting : false);
    });
    observer.observe(lane);
    return () => observer.disconnect();
  }, [hasLinks]);

  const toggle = (link: Link) => {
    const open = expandedIds.includes(link.id);
    requestExpanded(open ? expandedIds.filter((linkId) => linkId !== link.id) : [...expandedIds, link.id]);
    setAnnouncement(joiner.format([open ? labels.collapse : labels.expand, titleOf(link)]));
  };

  const retry = (link: Link) => {
    const seq = current.seq + 1;
    const next: Link & { requestId: string } = { ...link, requestId: `${id}request-${seq}` };
    setLinkState({
      ...settled(current),
      seq,
      links: links.map((candidate) => (candidate.id === link.id ? next : candidate)),
    });
    startRequest(next);
  };

  const remove = (link: Link) => {
    const index = links.indexOf(link);
    focusAfterRemoval.current = {
      removed: link.id,
      candidates: [...links.slice(index + 1), ...links.slice(0, index).reverse()].map((candidate) => candidate.id),
    };
    setAnnouncement(joiner.format([labels.remove, titleOf(link)]));
    commitText(removeOccurrence(text, link), { caret: null, request: true, exclude: link.id });
  };

  const canSend = onSend !== undefined && text.trim() !== '' && !sending;

  const send = () => {
    if (!canSend || sendingRef.current) return;
    const message: LinkUnfurlMessage = {
      text,
      previews: links.map((link) => recordFor(link)).filter((record) => record !== undefined),
    };
    const succeed = () => {
      sendingRef.current = false;
      if (!mountedRef.current) return;
      setSending(false);
      setAnnouncement(labels.sent);
      requestText('');
      requestExpanded([]);
    };
    const fail = () => {
      sendingRef.current = false;
      if (!mountedRef.current) return;
      setSending(false);
      setSendFailed(true);
    };
    setSendFailed(false);
    let result: void | Promise<unknown>;
    try {
      result = onSend(message);
    } catch {
      fail();
      return;
    }
    // Any thenable counts, including promises from another realm.
    if (typeof (result as Promise<unknown> | undefined)?.then !== 'function') {
      succeed();
      return;
    }
    sendingRef.current = true;
    setSending(true);
    (result as Promise<unknown>).then(succeed, fail);
  };

  const onFieldKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    fieldAttributes.onKeyDown?.(event);
    if (event.defaultPrevented || event.key !== 'Enter' || isComposing(event)) return;
    if (event.altKey) {
      // Reserved for the preview toggle, so it never inserts a line even when no preview is at the caret.
      event.preventDefault();
      const caret = event.currentTarget.selectionStart;
      const link = [...links].reverse().find((candidate) => candidate.start <= caret && caret <= candidate.end);
      if (link !== undefined && statusOf(link) === 'ready') toggle(link);
      return;
    }
    if (event.shiftKey || event.ctrlKey || event.metaKey || onSend === undefined) return;
    event.preventDefault();
    if (!event.repeat) send();
  };

  const onFieldPaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    fieldAttributes.onPaste?.(event);
    pasteRef.current = true;
  };

  const onFieldBlur = (event: FocusEvent<HTMLTextAreaElement>) => {
    fieldAttributes.onBlur?.(event);
    if (!sending) commitText(text, { caret: null, request: true });
  };

  const insertSuggestion = (url: string) => {
    const element = fieldRef.current;
    const start = element?.selectionStart ?? text.length;
    const end = element?.selectionEnd ?? text.length;
    const before = text.slice(0, start);
    const after = text.slice(end);
    const lead = before === '' || /\s$/.test(before) ? '' : ' ';
    const trail = /^\s/.test(after) ? '' : ' ';
    commitText(`${before}${lead}${url}${trail}${after}`, { caret: null, request: true });
  };

  const lane = splitPart(slotProps?.lane);
  const sendPart = splitPart(slotProps?.send);
  const statusPart = splitPart(slotProps?.status);
  const errorPart = splitPart(slotProps?.error);

  return (
    <MotionConfig reducedMotion={motionMode === 'none' ? 'always' : 'user'}>
      <WithSx className={className} styles={rootStyle} sx={sx}>
        {(rootClassName) => (
          <div {...rest} ref={ref} data-ui="link-unfurl" data-motion={motionMode} className={rootClassName}>
            <label id={labelId} htmlFor={fieldId} css={labelStyle}>
              {label}
            </label>
            <textarea
              rows={3}
              {...fieldAttributes}
              ref={mergedFieldRef}
              id={fieldId}
              value={text}
              readOnly={sending}
              aria-labelledby={ids(fieldAttributes['aria-labelledby'], fieldAttributes['aria-labelledby'] && labelId)}
              aria-describedby={ids(fieldAttributes['aria-describedby'], hintId, sendFailed && errorId)}
              data-ui="link-unfurl-field"
              className={field.className}
              css={[inputControlStyle, fieldStyle, field.partCss]}
              onChange={(event) => {
                fieldAttributes.onChange?.(event);
                const pasted = pasteRef.current;
                pasteRef.current = false;
                const caret = event.currentTarget.selectionEnd;
                commitText(event.currentTarget.value, { caret: pasted ? null : caret, request: true });
              }}
              onKeyDown={onFieldKeyDown}
              onPaste={onFieldPaste}
              onBlur={onFieldBlur}
            />
            <p id={hintId} css={hintStyle}>
              {labels.hint}
            </p>
            {hasLinks ? (
              <div
                {...lane.attributes}
                ref={laneRef}
                data-ui="link-unfurl-lane"
                className={lane.className}
                css={[laneStyle, lane.partCss]}
              >
                {links.map((link) => {
                  const record = recordFor(link);
                  const status = statusOf(link, record);
                  return (
                    <PreviewItem
                      key={link.id}
                      link={link}
                      status={status}
                      record={record}
                      open={status === 'ready' && expandedIds.includes(link.id)}
                      animate={animate}
                      locked={sending}
                      labels={labels}
                      slotProps={slotProps}
                      onToggle={() => toggle(link)}
                      onRetry={() => retry(link)}
                      onRemove={() => remove(link)}
                    />
                  );
                })}
              </div>
            ) : null}
            {suggestions.length > 0 ? (
              <div data-ui="link-unfurl-suggestions" css={suggestionsStyle}>
                {suggestions.map((suggestion) => (
                  <Button
                    key={suggestion.url}
                    size="sm"
                    variant="outline"
                    css={suggestionStyle}
                    aria-disabled={sending || undefined}
                    onClick={() => insertSuggestion(suggestion.url)}
                  >
                    {suggestion.label}
                  </Button>
                ))}
              </div>
            ) : null}
            <div css={footerStyle}>
              {sendFailed ? (
                <p
                  {...errorPart.attributes}
                  id={errorId}
                  role="alert"
                  data-ui="link-unfurl-error"
                  className={errorPart.className}
                  css={[sendErrorStyle, errorPart.partCss]}
                >
                  {labels.error}
                </p>
              ) : null}
              <Button
                {...sendPart.attributes}
                tone="accent"
                loading={sending}
                disabled={!canSend && !sending}
                className={sendPart.className}
                css={[sendStyle, sendPart.partCss]}
                onClick={(event) => {
                  sendPart.attributes.onClick?.(event);
                  if (!event.defaultPrevented) send();
                }}
              >
                {labels.send}
              </Button>
            </div>
            <div
              {...statusPart.attributes}
              role="status"
              aria-live="polite"
              aria-atomic="true"
              data-ui="link-unfurl-status"
              className={statusPart.className}
              css={[visuallyHiddenStyle, statusPart.partCss]}
            >
              {announcement}
            </div>
          </div>
        )}
      </WithSx>
    </MotionConfig>
  );
}

LinkUnfurl.displayName = 'LinkUnfurl';
